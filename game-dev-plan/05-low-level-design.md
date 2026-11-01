# 05: Low-Level Design (per system)

Signatures are indicative C#. They show responsibilities and contracts, not final code.

---

## 1. Data definitions (ScriptableObjects)

```csharp
[CreateAssetMenu] public class ClubDefinition : ScriptableObject {
    public string id;                 // "club.driver"
    public string displayName;
    public Sprite icon;
    public float launchAngleDeg;      // 14
    public float maxSpeed;            // m/s, 40
    public AnimationCurve powerCurve; // 0..1 → 0..1
    public float previewFraction;     // 0.35 of flight shown
    public bool isPutter;             // ground roll, flat
}

[CreateAssetMenu] public class SurfaceDefinition : ScriptableObject {
    public string id;                 // "surface.rough"
    public float bounciness;          // 0..1 (applied via PhysicsMaterial too)
    public float rollingResistance;   // deceleration m/s² while rolling
    public float maxPowerMultiplier;  // 0.8 for rough
    public ClubDefinition preferredClub; // auto-select (putter on green, wedge in sand)
    public bool isSafeRestSurface;    // can be "last safe position"
    public float playerSpeedMultiplier; // ice/mud
    public float playerFriction;      // ice slipperiness
    public SurfaceFx fx;              // landing particle, roll SFX loop, footstep set
}

[CreateAssetMenu] public class ItemDefinition : ScriptableObject {
    public string id;                 // "item.bonk_mallet"
    public string displayName; public Sprite icon; public GameObject heldVisualPrefab;
    public ItemUseMode useMode;       // Instant, Melee, Throw, Place, NextShotBuff
    public float windupSeconds;       // telegraph
    [SerializeReference] public List<ItemEffect> effects; // composed behaviour (see §6)
    public AudioCue useCue; public VfxCue useVfx;
}

[CreateAssetMenu] public class StatusEffectDefinition : ScriptableObject {
    public string id; public float duration; public StatusFlags flags; // Stunned, Immune, Slowed, Shielded…
    public float moveSpeedMultiplier; public VfxCue loopVfx;
    public StackPolicy stacking;      // Refresh, Ignore, Stack
}

[CreateAssetMenu] public class ItemDistributionTable : ScriptableObject {
    [Serializable] public class Row { public ItemDefinition item; public AnimationCurve weightByPosition; } // x: 0=leader..1=last
    public List<Row> rows;
}

[CreateAssetMenu] public class MatchRulesDefinition : ScriptableObject {
    public int holesPerMatch; public bool itemsEnabled;
    public float holeTimeBase, holeTimePerPar, finishTimerSeconds;
    public int maxStrokesOverPar;     // 4
    public ScoringRules scoring;      // pure C# serializable class in Core (testable)
    public ItemDistributionTable distribution;
}

[CreateAssetMenu] public class CourseDefinition : ScriptableObject {
    public string id; public string displayName; public string sceneName; public Sprite thumbnail;
    public int holeCount;             // HoleRoots found in scene must match → editor validator
}
```

**Editor validators** (Bogey.Editor): menu `Bogey/Validate All Data` checks that IDs are unique, references aren't missing, and each course scene's hole count matches. Runs in CI.

---

## 2. Player

### 2.1 Components on the Player prefab
| Component | Type | Responsibility |
|---|---|---|
| `NetworkObject` | NGO | Identity, ownership |
| `PlayerNetworkTransform` | NetworkTransform (owner-auth) | Syncs root position/rotation |
| `PlayerController` | NetworkBehaviour | Movement (CharacterController), jump, gravity, external impulses |
| `PlayerInputRouter` | MonoBehaviour (owner only) | Reads Input System actions → intents, switches action maps |
| `Golfer` | NetworkBehaviour | Golfing FSM (Roaming/Addressing/Charging/Swinging), club selection, sends ShotRequestRpc |
| `PlayerCombat` | NetworkBehaviour | Shove, hit reception, knockback, last-hitter tracking |
| `StatusEffects` | NetworkBehaviour | Active effects (server-auth NetworkList), query flags |
| `Inventory` | NetworkBehaviour | Held item (NetworkVariable<int itemIndex>) |
| `PlayerIdentity` | NetworkBehaviour | Display name, color, cosmetic loadout |
| `PlayerAnimator` | MonoBehaviour | Drives Animator from state (local on all clients) |
| `RagdollRig` | MonoBehaviour | Local cosmetic ragdoll toggle |

### 2.2 Movement (`PlayerController`)
- Kinematic **`CharacterController`** (not a Rigidbody). Predictable and stable. Custom gravity, slope handling and a step offset.
- Velocity = input velocity (blended by the surface's `playerFriction`) + **external velocity** (knockback, decays with drag).
- `public void ApplyImpulse(Vector3 v, HitSeverity s)`: owner-only, called through `KnockbackRpc`.
- Control is locked while `StatusEffects.Has(Stunned)` or during the knockback window.
- Interacts with platforms/conveyors via `IMovingSurface.GetVelocityAt(point)` [V1].

### 2.3 Golfer FSM
```
          ┌──────────┐ Interact & InRange & BallAtRest      ┌────────────┐
          │ Roaming  │─────────────────────────────────────►│ Addressing │◄──┐
          └──────────┘◄──────── Cancel / Hit ───────────────└─────┬──────┘   │ club change,
               ▲                                                  │ Shoot↓   │ aim
               │                                            ┌─────▼──────┐   │
               │◄────────── Hit (cancel, no stroke) ────────│  Charging  │───┘ (release w/ power<5% → back)
               │                                            └─────┬──────┘
               │                                                  │ Shoot↑ → send ShotRequestRpc(aim, power, clubId, seq)
               │                                            ┌─────▼──────┐
               └──────────── swing anim complete ───────────│  Swinging  │ (inputs locked ~0.45 s)
                                                            └────────────┘
```
- The FSM runs on the **owner** for responsiveness. The server re-validates the shot (06 §6). If the server rejects it, `ShotRejectedRpc` → owner returns to Addressing and shows a toast.
- The charge meter is purely local. Only the final `power` value is sent.

---

## 3. Golf ball

### 3.1 Components
| Component | Responsibility |
|---|---|
| `NetworkObject` (server-owned) | |
| `Rigidbody` | mass 0.5, interpolation on, **CCD: ContinuousDynamic**, max angular velocity raised |
| `SphereCollider` r = 0.12 | PhysicsMaterial baseline, combine = Multiply |
| `NetworkRigidbody` + `NetworkTransform` (server-auth) | Kinematic on clients, interpolated |
| `GolfBall` | NetworkBehaviour: state, surface detection, rolling resistance, rest detection, buffs |
| `BallVisuals` | Trail, aura for buffs, owner color, landing VFX (local) |

### 3.2 `GolfBall` state (server)
```
 AtRest ──(ApplyShot)──► InFlight ──(ground contact)──► Rolling ──(speed<0.15 for 0.5s)──► AtRest
   ▲                         │                            │
   │                         └──(hazard)──► Penalized ────┴──► (teleport to lastSafePosition) ──► AtRest
   └────────────────────────────────────── Holed (terminal for this hole) ◄──(cup capture)
```

### 3.3 Physics details
```csharp
void FixedUpdate() {                       // server only
  if (state == InFlight) {
     rb.AddForce(-airDrag * rb.velocity, ForceMode.Acceleration);
     rb.AddForce(wind.Current, ForceMode.Acceleration);        // HoleWind service
     buffs.ApplyInFlight(this);                                 // e.g. Magnet Ball curve
  }
  if (grounded) {
     var s = SurfaceProbe.Sample(transform.position);           // raycast down → SurfaceTag on collider
     // custom rolling resistance: decelerate horizontal velocity, preserve slope gravity
     var v = rb.velocity; var horiz = Vector3.ProjectOnPlane(v, groundNormal);
     var dv = Mathf.Min(horiz.magnitude, s.rollingResistance * Time.fixedDeltaTime);
     rb.velocity = v - horiz.normalized * dv;
     CupAssist.Apply(this);                                     // pull toward cup if close & slow
  }
  RestDetector.Tick(rb.velocity.magnitude);                     // 0.15 m/s for 0.5 s, 12 s hard cap
}
```
- **Ground detection:** `SphereCast` down by r + 0.02, filtered to the Environment layer.
- **Surface lookup:** each environment collider gets a `SurfaceTag { SurfaceDefinition def; }`. A missing tag → default Fairway and a warning in dev builds.
- **Applying a shot:** `velocity = Quaternion.AngleAxis(-launchAngle, right) * aimDir * club.maxSpeed * club.powerCurve(power) * surface.maxPowerMultiplier`. Reset angular velocity first. Then apply "next shot" buffs.
- **Trajectory preview** (client-side, local): an analytic integrator using the same drag + gravity (no wind), stepped at 1/60 for `previewFraction` of estimated flight time, then a LineRenderer. It's shared code in `Bogey.Core.ShotMath` so the preview and the real shot agree. Unit-tested against PhysX in a PlayMode test (tolerance: landing point within 5%).
- **Layers and collision matrix:** `Environment`, `Ball`, `Player`, `Pickup`, `Trigger`, `ItemEffect`, `CameraBlocker`. Ball↔Ball on, Ball↔Player on, Player↔Player on (CharacterController pushes softly), Pickup only vs Player.

### 3.4 Cup
`Cup` trigger at the bottom of the cup mesh. `OnTriggerEnter(ball)` on the server: if `ball.speed < captureSpeed` → `ball.SetHoled()` → `MatchDirector.Server_OnBallHoled(ownerId)`. The cup mesh's real hole geometry handles lip-outs physically (a cylinder with a collider rim).

### 3.5 Hazards
`HazardVolume { HazardType type; }` trigger on the server:
- Ball enters → `ball.Penalize()`: stroke +1, short delay (1 s, splash VFX), teleport to `lastSafePosition`, state = AtRest.
- Player enters → `PlayerCombat.Server_OnHazard()` → KO attribution check → respawn the owner beside their ball after 2 s (`RespawnRpc` to owner, who teleports).

---

## 4. Match system

### 4.1 `MatchDirector` (server-auth NetworkBehaviour, one per course scene)
```csharp
NetworkVariable<MatchPhase> Phase;            // Lobby, HoleIntro, Countdown, Playing, FinishTimer, HoleEnd, Results
NetworkVariable<int> HoleIndex;
NetworkVariable<double> PhaseEndsAtServerTime; // clients render timers from server time (no per-frame sync)
NetworkList<PlayerHoleState> HoleStates;       // per player: clientId, strokes, holed, finishOrder, kos
NetworkList<PlayerMatchScore> Scores;          // per player totals

void Server_StartMatch(MatchRulesDefinition rules, CourseDefinition course);
void Server_OnShotTaken(ulong clientId);       // strokes++ ; DNF check
void Server_OnBallHoled(ulong clientId);       // finish order, start FinishTimer if first
void Server_OnPenalty(ulong clientId);         // strokes++
void Server_OnKnockout(ulong attacker, ulong victim);
void Server_OnPlayerDisconnected(ulong clientId); // mark DNF for rest, keep scores visible
```
- Phase transition logic lives in **`Bogey.Core.MatchStateMachine`** (pure C#, given time + events → next phase). Unit-tested exhaustively. `MatchDirector` is a thin adapter.
- Scoring lives in **`Bogey.Core.ScoringRules.ScoreHole(par, strokes, finishOrder, kos, holed)`**, also unit-tested.
- Between holes: `HoleRoot.Server_BeginHole()` → assign tee spots → teleport players (RespawnRpc) and spawn/teleport balls → roll wind → enable that hole's item spawners.

### 4.2 `HoleRoot` (scene component per hole)
```csharp
public int par; public Transform[] teeSpots /*8*/; public Cup cup;
public Vector2 windRangeMs; public SplineContainer introPath;
public ItemSpawner[] itemSpawners; public HazardVolume[] hazards; public Bounds playBounds;
```
Editor gizmos draw tee spots, cup and par label. The validator checks that there are 8 tees, one cup and the intro path is set.

---

## 5. Combat and status effects

### 5.1 Hit pipeline (server)
```
Attack source (Shove/Mallet/Gust/Bomb)
  └─► HitQuery (OverlapSphere / OverlapBox / cone check on server at impact frame, using server-side positions)
        └─► for each target: HitResolver.Resolve(HitInfo{attacker, dir, force, severity, stunSeconds, affectsBalls})
              ├─ target Shielded? → consume shield, play block FX, stop
              ├─ target Immune & severity ≥ Stun? → downgrade to Knockback × 0.5
              ├─ PlayerCombat.lastHitter = attacker, lastHitTime = now
              ├─ StatusEffects.Server_Add(Stunned, …) (+ Immune after it ends)
              ├─ KnockbackRpc(dir*force, severity) → owner applies impulse
              └─ HitFxRpc(position, severity) → everyone (camera shake if victim is local)
```
- **Lag note:** hits are resolved against the *server's* view of player positions. Remote players are about 100–150 ms behind, so give hitboxes **generous sizes** (forgiving for the attacker). Lag compensation (rewind) is [Later] if needed.

### 5.2 `StatusEffects`
- `NetworkList<ActiveEffect { ushort defIndex; double endsAt; ulong sourceClient; }>`, server-write.
- `Has(StatusFlags)` evaluated locally from the list + server time.
- Expiry: the server removes entries; clients also hide visuals at `endsAt` for smoothness.

---

## 6. Item system

### 6.1 Flow
```
ItemSpawner (server) ─► spawns ItemPickup (NetworkObject) ─► player touches (trigger on server)
   └─► ItemRoller.Roll(table, positionFraction(player)) ─► Inventory.HeldItem = index ─► pickup despawn, respawn timer 15 s
Player presses Use ─► (owner) UseItemRpc(aimDir, aimPoint, seq)
   └─► server: validate (has item, not stunned, cooldown) ─► Inventory.Clear()
         ─► ItemExecutor runs effects in order (with windup delay) ─► PlayItemFxRpc for presentation
```

### 6.2 Effect modules (composition)
```csharp
[Serializable] public abstract class ItemEffect { public abstract void Execute(ItemContext ctx); }
// Server-side context: user, aimDir, aimPoint, serverTime, services (HitResolver, Spawner, ball lookup)

class MeleeHitEffect      : ItemEffect { float range, radius, force, stun; }          // Bonk Mallet
class ConeBlastEffect     : ItemEffect { float length, angle, playerForce, ballForce; } // Gust Can
class NextShotBuffEffect  : ItemEffect { BallBuffDefinition buff; }                    // Sticky Grip, Rubber Core, Magnet
class SpawnProjectileEffect : ItemEffect { GameObject projectilePrefab; float speed; } // Mud Pie, Bowling Bomb
class PlaceObjectEffect   : ItemEffect { GameObject prefab; float maxDistance; }       // Spring Pad, Net Trap
class ApplyStatusEffect   : ItemEffect { StatusEffectDefinition status; TargetMode target; } // Bubble Shield, Dash
class BallSwapEffect      : ItemEffect { RankTarget target; }                          // Swap Ticket
```
**Adding a new item** = new `ItemDefinition` asset + (only if needed) one new effect class + prefab/VFX. Most V1 items reuse existing effect classes.

### 6.3 Ball buffs
`BallBuffDefinition` (StickyOnFirstContact, ExtraBounce + WaterSkipOnce, InFlightCurveToCup). Stored on `GolfBall.PendingBuff` (NetworkVariable). Consumed on the next `ApplyShot`, and active until the ball is at rest.

---

## 7. Camera system
- `CameraRig` (local, per client) holds Cinemachine cameras: `ExploreCam` (OrbitalFollow + RotationComposer + Deoccluder), `AddressCam`, `BallFollowCam`, `IntroCam` (SplineDolly), `SpectateCam`.
- `CameraDirector` picks the active camera by priority from local state: Golfer state, Match phase, holed/DNF. Blends are defined in a CinemachineBlenderSettings asset.
- Aim input while addressing rotates the golfer *and* the AddressCam together. The camera is always behind the aim line.

## 8. UI architecture
- **MVP pattern (Model-View-Presenter):** Presenters subscribe to gameplay state (NetworkVariable `OnValueChanged`, C# events) and push into dumb Views (uGUI prefabs).
- Screens: `UIScreenStack` for menus (push/pop, back button = pop). The HUD is separate and always present in-match.
- World-space UI: name tags + ball markers via a single `WorldMarkerLayer` canvas that projects positions to screen and clamps to edges for off-screen arrows.

## 9. Audio
- `AudioService` with pooled `AudioSource`s, `AudioCue` ScriptableObjects (clips[], volume/pitch randomization, spatial settings).
- Mixer groups: Master → Music, SFX, UI, Ambience. Snapshot ducking on hole-out/results.

## 10. Key sequence diagrams

### 10.1 Shot (owner = client B, server = host A)
```
Client B (owner)                         Host A (server)                       All clients
 │ Shoot released (power .73)               │                                     │
 │ start swing anim (backswing 0.2s)        │                                     │
 │── ShotRequestRpc(seq, aim, .73, iron) ─►│ validate (in range? at rest?          │
 │                                          │  not stunned? seq new?)             │
 │                                          │ schedule impact at serverTime+0.2s  │
 │ impact frame (local): hit-stop, SFX      │ ApplyShot(): velocity, strokes++    │
 │                                          │── NetworkVariable/NetworkTransform ►│ ball moves (interpolated)
 │                                          │── ShotFxRpc(ballId, power) ────────►│ VFX/SFX for others
 │ (if rejected) ◄── ShotRejectedRpc ───────│                                     │
```
With RTT ≤ ~200 ms the ball starts moving on B's screen at about the same time as the local impact frame. Beyond that it starts slightly late. Acceptable, and tested in M2.

### 10.2 Item pickup race
Two players touch the same box in the same tick. The server processes triggers sequentially, so the first one wins and the box despawns. The second player gets nothing. No client-side "phantom pickups": the client shows a pickup only on the server-confirmed Inventory change.

### 10.3 Ring-out KO
```
A uses Gust Can ─► server cone check hits B ─► B.lastHitter=A ─► KnockbackRpc to B ─► B flies into water
B's owner moves B into HazardVolume ─► (server sees B's NetworkTransform inside volume) ─► HazardVolume.OnTriggerEnter(B)
 ─► now - B.lastHitTime < 5s ─► MatchDirector.Server_OnKnockout(A, B) ─► KoFeedRpc ─► respawn B
```
