# 06: Network Contracts (the "API contracts")

In web terms: **NetworkVariables are your replicated state/resources** (like a read model the server pushes), and **RPCs are your endpoints** (commands/events). Everything below is the contract between host and clients. Changing it means bumping `ProtocolVersion` (checked on connect, mismatched clients are rejected with a "please update" message).

Conventions (NGO 2.x):
- RPC methods end in `Rpc` and use `[Rpc(SendTo.Server)]`, `[Rpc(SendTo.Owner)]`, `[Rpc(SendTo.Everyone)]`, `[Rpc(SendTo.NotServer)]`.
- **Reliable** by default. Purely cosmetic, frequent RPCs use `RpcDelivery.Unreliable`.
- Client→server RPCs carry a per-player increasing `seq` for de-duplication and ordering logic.
- Time: `NetworkManager.ServerTime` is the shared clock. Timers are sent as **absolute end times**, never per-frame countdowns.
- Enums are sent as `byte`. Definitions (items, clubs, statuses) are sent as **registry indices** (`ushort`) into a `DefinitionRegistry` asset that is identical on all builds.

---

## 1. Connection

| Step | Direction | Payload | Notes |
|---|---|---|---|
| Connection approval | client → host (NGO ConnectionData) | `ConnectPayload { ushort protocolVersion; string displayName; ulong platformId; CosmeticLoadout loadout; }` | Host rejects if: version mismatch, lobby full (8), match in progress (MVP) |
| Approval response | host → client | approved / `DisconnectReason` enum | Reason shown in UI |
| Disconnect reason | host → client | `byte DisconnectReason { HostLeft, Kicked, Full, VersionMismatch, MatchInProgress, Timeout }` | via NGO `DisconnectReason` string |

## 2. Replicated state (NetworkVariables / NetworkLists)

| Owner object | Field | Type | Write | Update rate | Purpose |
|---|---|---|---|---|---|
| **MatchDirector** | `Phase` | `MatchPhase` (byte) | Server | on change | Drives UI/camera/input on all clients |
| | `HoleIndex` | `byte` | Server | on change | |
| | `PhaseEndsAt` | `double` (server time) | Server | on change | Timer display |
| | `WindVector` | `Vector2` (half precision ok) | Server | per hole | HUD + client-side previews (if enabled) |
| | `HoleStates` | `NetworkList<PlayerHoleState>` | Server | on change | `{ulong clientId; byte strokes; bool holed; byte finishOrder; byte kos; bool dnf;}` |
| | `Scores` | `NetworkList<PlayerMatchScore>` | Server | on change | `{ulong clientId; short total; short lastHoleDelta;}` |
| | `RulesIndex`, `CourseIndex` | `ushort` | Server | match start | |
| **Player** | Transform | NetworkTransform (pos xyz, rot y only, half-float) | **Owner** | tick (30 Hz), on change only | Movement |
| | `AnimState` | `byte` packed flags (grounded, swinging, stunned…) + `float` speed (quantized) | Owner | on change | Remote animation |
| | `GolferState` | `GolferState` byte | Owner | on change | Remote players' address/charge poses, "aiming" indicator |
| | `AimYaw` | `half` | Owner | 10 Hz while addressing | Remote aim display |
| | `HeldItem` | `short` (−1 = none) | Server | on change | HUD + held visual |
| | `ActiveEffects` | `NetworkList<ActiveEffect>` | Server | on change | `{ushort defIndex; double endsAt; ulong source;}` |
| | `Identity` | `{FixedString32 name; byte colorIndex; CosmeticLoadout loadout;}` | Server | join | |
| **GolfBall** | Transform + Rigidbody | NetworkTransform + NetworkRigidbody (server-auth, pos + rot, interpolate) | Server | tick, on change | Ball motion. Rotation can be dropped/lower-rate if bandwidth matters |
| | `OwnerClientId` (logical owner, not NGO ownership) | `ulong` | Server | spawn | Color, whose ball |
| | `BallState` | byte | Server | on change | AtRest/InFlight/Rolling/Holed/Penalized → UI ("ball ready") |
| | `PendingBuff` | `short` | Server | on change | Aura visual |
| **ItemPickup** | existence (spawn/despawn) | NetworkObject | Server | — | |
| **Placed/projectile objects** | Transform | server-auth NetworkTransform | Server | tick | Mud Pie, Bomb, Spring Pad, Net Trap |
| | `OwnerClientId`, `ExpiresAt` | `ulong`, `double` | Server | spawn | Net Trap visibility rule: hidden for non-owners via `NetworkObject.CheckObjectVisibility` / local renderer toggle |

## 3. RPCs (commands and events)

### 3.1 Client → Server (commands, always validated, see §6)
| RPC | On | Params | Server effect |
|---|---|---|---|
| `RequestAddressRpc` | Golfer | `uint seq` | Optional at MVP (owner FSM is trusted for addressing; validated at shot time) |
| `ShotRequestRpc` | Golfer | `uint seq, half aimYaw, byte power (0–255), ushort clubIndex` | Validate → schedule impact (+swing delay) → `GolfBall.ApplyShot` → `MatchDirector.Server_OnShotTaken` |
| `UseItemRpc` | Inventory | `uint seq, half aimYaw, Vector3 aimPoint (for placed/thrown)` | Validate → clear item → `ItemExecutor.Run` |
| `ShoveRpc` | PlayerCombat | `uint seq, half facingYaw` | Validate cooldown → HitQuery at impact time |
| `SetReadyRpc` | LobbyPlayer | `bool ready` | Lobby ready-check |
| `SetLoadoutRpc` | PlayerIdentity | `CosmeticLoadout` | Validate unlocked (trust, cosmetic only) → broadcast via Identity |
| `PracticeCommandRpc` | DevTools | `byte cmd, int arg` | Practice/dev only (reset ball, spawn item). Disabled in Party mode |

### 3.2 Server → Owner (targeted commands)
| RPC | On | Params | Client effect |
|---|---|---|---|
| `KnockbackRpc` | PlayerController | `Vector3 impulse, byte severity` | Owner applies impulse/stun animation |
| `TeleportRpc` | PlayerController | `Vector3 pos, half yaw, byte reason` | Respawn/tee placement (owner moves its transform; NGO teleport to skip interpolation) |
| `ShotRejectedRpc` | Golfer | `uint seq, byte reason` | Back to Addressing + toast |
| `ItemUseRejectedRpc` | Inventory | `uint seq, byte reason` | Cancel local wind-up |

### 3.3 Server → Everyone (events, presentation)
| RPC | Delivery | Params | Effect |
|---|---|---|---|
| `ShotFxRpc` | Unreliable | `NetworkObjectReference ball, byte power, ushort clubIndex` | Swing SFX/VFX for remote observers (shooter already played it locally → skip if owner) |
| `HitFxRpc` | Unreliable | `Vector3 pos, byte severity, ulong victim` | Impact VFX, local victim camera shake |
| `ItemFxRpc` | Reliable | `ushort itemIndex, ulong user, Vector3 pos, half yaw` | Wind-up telegraph visuals for everyone (must arrive, since it's counterplay info) |
| `BallEventRpc` | Unreliable | `NetworkObjectReference ball, byte evt (Landed/Splash/Holed/HoleInOne), byte surface` | Landing puffs, splash, celebration |
| `KoFeedRpc` | Reliable | `ulong attacker, ulong victim, ushort itemIndex (or shove), byte hazardType` | KO feed |
| `AnnouncerRpc` | Reliable | `byte line` | "Birdie!", "Final 30 seconds!" |

## 4. Shot timing contract (latency hiding)
```
t=0          owner releases Shoot; starts swing anim; sends ShotRequestRpc
t=RTT/2      server receives; validates; impactAt = max(now, requestedAt + SWING_IMPACT_DELAY − RTT/2)
             SWING_IMPACT_DELAY = 0.20 s (tied to anim impact frame; constant in ClubDefinition/animation)
impactAt     server applies velocity; ball starts moving on server
+~RTT/2+interp  ball starts moving on owner's screen
```
**Target:** at RTT ≤ 150 ms the visible gap between the club impact and ball motion is < 100 ms. Validated in M2 with the Network Simulator.

## 5. Bandwidth budget (per client, downstream, 8 players)
| Stream | Objects | Rate | Approx bytes/update | Total |
|---|---|---|---|---|
| Player transforms | 7 remote | 30 Hz (when moving) | ~14 B | ~2.9 KB/s |
| Ball transforms | 8 | 30 Hz (when moving) | ~20 B | ~4.8 KB/s |
| Projectiles/placed | ≤ 6 | 30 Hz | ~14 B | ~2.5 KB/s |
| State + RPCs | — | bursty | — | ~1–2 KB/s |
| **Total (worst case)** | | | | **≈ 12 KB/s ≈ 100 kbps** |
Host upstream ≈ 7 × that ≈ **0.7 Mbps** worst case. Fine for home connections. Resting objects send nothing (NetworkTransform sends deltas only).

## 6. Server-side validation rules
| Request | Checks (reject with reason code) |
|---|---|
| `ShotRequestRpc` | Phase ∈ {Playing, FinishTimer} · player not holed/DNF · ball `AtRest` · player within 3.0 m of own ball (server view, slack for lag) · not Stunned · `seq` > last seq · club index valid · ≥ 0.5 s since last shot |
| `UseItemRpc` | Player holds an item · not Stunned · phase allows items · rules.itemsEnabled · aimPoint within item's max distance (clamp, don't reject) |
| `ShoveRpc` | Cooldown 0.8 s · not Stunned |
| Owner movement (continuous) | Horizontal speed ≤ max(possible) × 1.3, excluding active knockback windows · no teleports > 5 m except after `TeleportRpc` · violations → `TeleportRpc` back to the last valid position + log |

## 7. Disconnect and edge-case behaviour
| Case | Behaviour |
|---|---|
| Client disconnects mid-hole | Their ball despawns, they're DNF for the remaining holes, score stays on the board, marked "(left)" |
| Host disconnects/quits | All clients get `HostLeft`, return to the main menu with a message. No migration in v1 |
| Client joins during a match | Rejected with `MatchInProgress` (MVP). [V1] admitted as spectator, gets a ball at the next HoleIntro |
| Packet loss burst | Interpolation hides it. NGO reliable channel retransmits commands. The UI shows a connection-quality icon if RTT > 250 ms or loss > 5% |
| Scene transitions | NGO NetworkSceneManager (server-driven). Clients show a loading screen until `OnLoadEventCompleted` for all |

## 8. Versioning
- `ProtocolVersion` (ushort) constant in Core. Bump it on any change in this document.
- `DefinitionRegistry` hash is also compared on connect, so data mismatches are caught (e.g. a different item list between builds).
