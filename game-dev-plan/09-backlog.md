# 09: Step-by-Step Backlog (how we actually start)

## How we'll work together
- **I (Claude)** can write C# scripts, assembly definitions, data-asset scripts, editor tools, tests, CI workflows, `.gitignore`/`.gitattributes` and docs in the game repo, then commit and push.
- **You** run the Unity Editor on your machine: open the project, wire prefabs/scenes in the Inspector where needed, press Play, playtest, and report back what felt off. (Unity's editor can't run in this cloud container, so scene wiring and feel testing are yours.)
- Each ticket below has **acceptance criteria (AC)**. We do them in order. Tickets marked 🧑 need you in the editor. 🤖 tickets I can do fully in code.

---

## Step 0: Machine and account setup (you)
- [ ] Install **Unity Hub** → install the latest **Unity 6 LTS** with modules: Windows Build Support (IL2CPP), (optional) Linux Build Support, documentation.
- [ ] Activate a **Unity Personal** license in Unity Hub.
- [ ] Install an IDE: **Rider** (recommended) or VS Code + C# Dev Kit + Unity extension. Set it as Unity's external script editor.
- [ ] Install **Git** + **Git LFS** (`git lfs install`).
- [ ] Install **Blender** (for later. Not needed until M6).
- [ ] Create a **private GitHub repo** `project-bogey` and add it to this Claude session (so I can push to it).
- [ ] Steam account (you already have one). Steamworks partner account + $100 app fee **only at M5/M9**. We use test app ID 480 until then.
- [ ] (Optional) A second PC or a friend for remote network tests in M2.

**When can we start?** As soon as you've reviewed this plan and finished Step 0. Step 1 can begin the same day.

---

## Step 1: M0 Project Foundation

| # | Ticket | Who | AC |
|---|---|---|---|
| M0‑1 | Create Unity project from **Universal 3D (URP)** template inside the repo, commit initial project | 🧑 | Project opens. `Assets/`, `Packages/`, `ProjectSettings/` committed |
| M0‑2 | `.gitignore`, `.gitattributes` (LFS + UnityYAMLMerge), `README`, `THIRD_PARTY_LICENSES.md`, `.editorconfig` | 🤖 | Clean `git status` after opening Unity. Binaries tracked by LFS |
| M0‑3 | Install packages via `Packages/manifest.json`: Input System, Cinemachine 3, Netcode for GameObjects 2.x, Unity Transport, Multiplayer Play Mode, Multiplayer Tools, ProBuilder, TextMeshPro, Test Framework, Animation Rigging | 🤖 (manifest) + 🧑 (open/resolve) | All packages resolve, no compile errors. Active input handling = Input System |
| M0‑4 | Folder layout + assembly definitions (04 §6.2, §6.4) | 🤖 | Assemblies compile. `Bogey.Core` has no reference to Gameplay (enforced) |
| M0‑5 | Project settings: physics fixed timestep 1/60, layers + collision matrix (05 §3.3), quality presets, color space Linear, Force Text serialization | 🤖 (settings files) + 🧑 verify | Settings committed. Layers named |
| M0‑6 | `Bootstrap` scene + `Services` registry + `NullPlatformService` + logging categories | 🤖 code, 🧑 scene wiring | Play from any scene auto-loads Bootstrap (editor helper). Services resolvable |
| M0‑7 | Dev console + overlay skeleton (`Bogey.DevTools`, `BOGEY_DEV` define) | 🤖 | Backtick opens the console. `help` lists commands. FPS shown |
| M0‑8 | Sample EditMode + PlayMode test | 🤖 | Tests pass in Test Runner |
| M0‑9 | GitHub Actions: GameCI test + Windows build | 🤖 workflow, 🧑 add license secrets | Green CI on PR. Downloadable Windows build artifact on `main` |

**M0 exit:** fresh clone → Play works · CI green · Windows build downloads and runs.

---

## Step 2: M1 Core Golf Feel (offline, gray-box)

| # | Ticket | Who | AC |
|---|---|---|---|
| M1‑1 | **Data definitions:** `ClubDefinition`, `SurfaceDefinition`, `MatchRulesDefinition` stubs + 4 club assets + 4 surface assets | 🤖 scripts, 🧑 create assets (or 🤖 via editor script) | Assets exist with GDD starting values |
| M1‑2 | **Gray-box test hole** (`Sandbox_Golf`): ProBuilder tee area, fairway, rough, sand, green with slope, cup, water | 🧑 (I give a layout spec) | Hole playable. Surfaces tagged |
| M1‑3 | `SurfaceTag` + `SurfaceProbe` | 🤖 | Debug overlay shows the surface under the ball |
| M1‑4 | **Player controller:** CharacterController movement, jump, gravity, slopes. Input System actions asset | 🤖 code, 🧑 prefab | Run/jump feel tunable live. Works with gamepad + KBM |
| M1‑5 | **Explore camera** (Cinemachine orbit + deoccluder) | 🤖 + 🧑 | Camera never clips into walls. Mouse + stick orbit |
| M1‑6 | **GolfBall** physics: drag, CCD, custom rolling resistance, rest detection, state machine (offline, no networking yet, but code shaped for server-only use) | 🤖 | Ball rests within 12 s on all surfaces. No tunneling at 40 m/s through 0.2 m walls (PlayMode test) |
| M1‑7 | `ShotMath` (Core) + unit tests | 🤖 | Velocity from (aim, power, club, surface) matches spec. Tests green |
| M1‑8 | **Golfer FSM:** address/aim/charge/swing, club auto-select + cycle, ping-pong power meter | 🤖 | All transitions in 05 §2.3 work. Can't address a moving ball |
| M1‑9 | **Address camera** + **trajectory preview** | 🤖 + 🧑 | Preview matches the real landing within 5% with no wind |
| M1‑10 | **Cup:** capture threshold + assist | 🤖 + 🧑 cup prefab | 5 m/s ball captured, 8 m/s lips out (PlayMode test) |
| M1‑11 | **Hazards:** water/OOB → +1 stroke, return to last safe position. Player kill volume + respawn | 🤖 | Ball in water returns to the last fairway rest spot |
| M1‑12 | **Practice mode** + dev commands (`ball.reset`, `club.set`, `wind.set`, `tune.*`) | 🤖 | Live-tune club speeds and resistances without recompiling |
| M1‑13 | **Placeholder juice:** hit-stop, thwack SFX, trail, landing puffs | 🤖 + 🧑 assign assets | Feels punchy |
| M1‑14 | **Playtest #1** (you + 3 friends, gray-box) → tuning pass | 🧑 | Exit criteria in 03 M1 met. Findings written to `docs/playtests/` |

---

## Step 3: M2 Networked Golf

| # | Ticket | Who | AC |
|---|---|---|---|
| M2‑1 | NetworkManager in Bootstrap, Unity Transport, host/join-by-IP debug UI | 🤖 + 🧑 | Two editor instances (Multiplayer Play Mode) connect |
| M2‑2 | Connection approval + `ConnectPayload` + `ProtocolVersion` (06 §1) | 🤖 | Version mismatch rejected with reason |
| M2‑3 | Player prefab → NetworkObject, owner-authoritative NetworkTransform, input only on owner, remote interpolation | 🤖 + 🧑 | 4 players move smoothly. Remote players don't jitter |
| M2‑4 | Ball → server-owned NetworkObject + NetworkRigidbody; client kinematic | 🤖 | Ball motion identical-looking on all clients |
| M2‑5 | `ShotRequestRpc` + validation + scheduled impact (06 §4, §6) | 🤖 | Invalid requests rejected with reason. Seq dedupe works |
| M2‑6 | Ball ownership mapping, player colors, spawn at tee spots | 🤖 | Each player has a colored ball at their tee |
| M2‑7 | Remote golfer presentation: address pose, aim yaw, swing FX via `ShotFxRpc` | 🤖 | You can see others aiming and swinging |
| M2‑8 | Knockback-ready plumbing: `TeleportRpc`, server movement sanity check | 🤖 | Speed hack (dev cheat) gets snapped back |
| M2‑9 | Network Simulator presets (Good / 150 ms / 250 ms + 2% loss) + net stats overlay | 🤖 + 🧑 | Overlay shows RTT/loss |
| M2‑10 | **Network playtest** (Play Mode + one remote friend via port-forward or a temporary relay) | 🧑 | M2 exit criteria met |

---

## Step 4: M3 Match Loop & Scoring (ticket outline)
M3‑1 `MatchStateMachine` (Core) + exhaustive tests · M3‑2 `ScoringRules` + tests · M3‑3 `HoleRoot` + `CourseDefinition` + validator · M3‑4 `MatchDirector` NetworkBehaviour + replicated state (06 §2) · M3‑5 hole transitions (teleport, wind roll) · M3‑6 HUD (strokes, timer from `PhaseEndsAt`, club, power, wind) · M3‑7 between-hole scoreboard + results screen · M3‑8 spectate camera · M3‑9 main menu + lobby scene + ready-check · M3‑10 6-hole gray-box course · M3‑11 playtest.

## Step 5: M4 Chaos Layer (ticket outline)
M4‑1 `HitResolver` + `HitInfo` + KnockbackRpc · M4‑2 `StatusEffects` + definitions (Stunned, Immune) · M4‑3 Shove · M4‑4 KO attribution + KO feed · M4‑5 `ItemDefinition` + effect modules + `DefinitionRegistry` · M4‑6 ItemSpawner/Pickup + `ItemRoller` (distribution tests) · M4‑7 Inventory + UseItemRpc + validation · M4‑8 Bonk Mallet · M4‑9 Sticky Grip (ball buffs) · M4‑10 Gust Can · M4‑11 telegraph VFX + ItemFxRpc · M4‑12 cosmetic ragdoll · M4‑13 items-on vs items-off A/B playtest.

M5–M9 get broken into tickets when we reach them, using what we learn. Detailed planning too far ahead is waste in game development, because playtests will change the design.

---

## Definition of Done (every ticket)
- [ ] Works in **host and client** (from M2 on). Tested with Multiplayer Play Mode
- [ ] No console errors/warnings introduced
- [ ] Tunables in data assets, not code
- [ ] Tests added where logic is in Core
- [ ] Network contract doc updated if RPCs/state changed
- [ ] Short note in the PR on how to test it in the editor
