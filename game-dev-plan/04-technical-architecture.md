# 04: Technical Architecture (HLD)

## 1. Technology stack

| Concern | Choice | Why / alternatives |
|---|---|---|
| Engine | **Unity 6 LTS** (latest 6.x LTS at project start) | Mature 3D, C#, huge ecosystem. LTS = stable APIs for the project's life |
| Render pipeline | **URP** | Performant, scalable to low-end PCs, Shader Graph, good for stylized art. HDRP is overkill |
| Language | C# (.NET Standard 2.1 / Unity's C# 9) | |
| IDE | JetBrains Rider (best Unity support) or VS Code + C# Dev Kit + Unity extension | |
| Networking | **Netcode for GameObjects (NGO) 2.x** | See ADR-001 in 10. First-party, best docs, Multiplayer Play Mode + Network Simulator. Alternatives: FishNet (free, built-in prediction), Photon Fusion 2 (best physics netcode, paid per CCU, Photon cloud) |
| Transport | Unity Transport (dev/LAN) → **Steam Networking Sockets transport** (prod) | Steam relay = no NAT/port forwarding, free, no servers to run |
| Platform SDK | **Facepunch.Steamworks** | Modern C# wrapper. Lobbies, invites, relay, achievements, cloud. (Alt: Steamworks.NET) |
| Input | Unity **Input System** | Action maps, gamepad + KBM, rebinding |
| Camera | **Cinemachine 3** | Orbit, follow, spline dolly, blends |
| Physics | Built-in **PhysX** (3D) | Fixed timestep, CCD for the ball |
| UI | **uGUI + TextMeshPro** for HUD/world-space · UI Toolkit optional for menus | uGUI has the most learning material. Revisit UI Toolkit later |
| Gray-box levels | **ProBuilder** + Polybrush | In-editor modeling, fast iteration |
| Animation | Mecanim (Animator), Animation Rigging (club IK) | |
| VFX | VFX Graph / Shuriken particles | Shuriken is simpler and CPU-based. Fine for this scale |
| Audio | Unity audio (MVP) → FMOD later if needed | FMOD is free for small indie budgets. Adds adaptive music |
| Tests | Unity Test Framework (NUnit), EditMode + PlayMode | |
| CI/CD | GitHub Actions + **GameCI** | Unity builds/tests in Docker |
| Crash reporting | Sentry for Unity or Backtrace | M9 |
| Asset store (likely) | DOTween (UI/juice tweens), Odin Inspector (optional, editor QoL) | Keep third-party dependencies minimal |

## 2. Network topology

```
                ┌───────────────────────── Steam Relay (SDR) ─────────────────────────┐
                │                                                                      │
  ┌─────────────┴───────────┐                                         ┌────────────────┴──────┐
  │  HOST (a player's PC)   │◄────────── reliable + unreliable ──────►│  CLIENT (player 2..8) │
  │  ┌───────────────────┐  │             NGO messages                │  ┌─────────────────┐  │
  │  │ SERVER logic      │  │                                         │  │ Local player    │  │
  │  │  • MatchDirector  │  │                                         │  │  (owner-auth    │  │
  │  │  • Ball physics   │  │                                         │  │   movement)     │  │
  │  │  • Items/hits     │  │                                         │  │ Interpolated    │  │
  │  │  • Scoring        │  │                                         │  │  balls & others │  │
  │  ├───────────────────┤  │                                         │  └─────────────────┘  │
  │  │ CLIENT (host's    │  │                                         └───────────────────────┘
  │  │ own player)       │  │
  │  └───────────────────┘  │
  └─────────────────────────┘
```
- **Listen-server / host mode:** one player's game is both server and client. No servers to pay for.
- No dedicated servers and no custom backend for v1. Steam provides lobbies, relay, identity, cloud saves and achievements.

## 3. Authority model (who owns the truth)

| Entity | Authority | Rationale |
|---|---|---|
| Match state, timers, scores | **Server** | Single source of truth, prevents disputes |
| Golf balls (physics) | **Server** | Balls interact with each other and with items, so one simulation avoids divergence |
| Player movement | **Owner (client)**, with server sanity checks | Instant responsive movement without writing prediction/reconciliation. Acceptable for a casual friends game |
| Knockback on a player | Server decides → tells owner → **owner applies** | Owner owns the transform. The impulse arrives about ½ RTT late, which is masked by hit-stop and flinch |
| Item pickup, item use, hits | **Server** validates and resolves | Prevents double pickups and contested hits |
| Cosmetic effects (VFX, SFX, ragdoll bones) | **Local** on each client | Never networked, only triggered by events |
| Cosmetic loadout | Owner sends it, server broadcasts | |

**Key latency trick:** shots are requested at **swing start**. The server applies the impulse on the **impact frame** (~200 ms later), so the swing animation hides the network round trip. See 06 §4.

## 4. Simulation timing

| Setting | Value |
|---|---|
| Physics fixed timestep | 1/60 s (60 Hz) |
| Network tick rate (NGO `TickRate`) | 30 Hz |
| Client interpolation buffer | about 100 ms (NGO default buffered interpolation) |
| Render | uncapped / vsync, decoupled from physics (Rigidbody interpolation on) |

## 5. Scene architecture

```
Bootstrap.unity  (loaded once, DontDestroyOnLoad)
 ├─ Services:   NetworkManager, SteamService, AudioService, SaveService, SettingsService, InputService
 ├─ UI root:    loading screen, toasts, debug console
 └─► loads MainMenu.unity
      └─► Lobby.unity  (networked; NGO NetworkSceneManager from here on)
           └─► Course_MeadowLinks.unity   (all holes of a course in one scene)
                 ├─ CourseDefinition reference
                 ├─ Hole_01 … Hole_06  (HoleRoot components: tees, cup, bounds, item spawners, intro spline)
                 ├─ Shared: lighting, skybox, water, kill volumes
                 └─ Runtime-spawned: players, balls, item pickups, item effects
           └─► back to Lobby.unity after Results
Practice.unity — loads a course scene in offline "host-only" mode (same code path as online)
```
- **Practice/offline = host with zero clients.** One code path, so no "offline mode" bugs.
- Course scenes contain **all holes**. Moving to the next hole teleports players/balls and swaps cameras. No scene load between holes means fast transitions (Pillar 1).
- Teams later: split heavy art into **additive scenes** per hole if memory/bake times grow.

## 6. Code architecture

### 6.1 Layers
```
┌──────────────────────────────────────────────────────────────────────┐
│ Presentation   UI (HUD, menus), VFX/SFX presenters, camera rigs     │  reads state, never mutates gameplay
├──────────────────────────────────────────────────────────────────────┤
│ Gameplay       PlayerController, Golfer, GolfBall, Items, Hazards,  │  MonoBehaviours / NetworkBehaviours
│                MatchDirector, Hole, StatusEffects                    │
├──────────────────────────────────────────────────────────────────────┤
│ Core (pure C#) Scoring rules, shot math, item roll tables,          │  NO UnityEngine.Object deps → unit-testable
│                match state machine logic, data contracts             │
├──────────────────────────────────────────────────────────────────────┤
│ Data           ScriptableObject definitions (clubs, surfaces,       │  designer-tunable assets
│                items, rules, courses, cosmetics)                     │
├──────────────────────────────────────────────────────────────────────┤
│ Infrastructure Networking glue, Steam, save, audio, input, logging  │  behind interfaces
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Assembly definitions (compile boundaries = enforced architecture)
| Assembly | References | Contains |
|---|---|---|
| `Bogey.Core` | none (no Unity Engine refs if possible, `noEngineReferences` where feasible; else only math) | Rules, math, state machines, interfaces |
| `Bogey.Data` | Core | ScriptableObject definitions |
| `Bogey.Infrastructure` | Core, NGO, Steamworks | Services, transports, save |
| `Bogey.Gameplay` | Core, Data, Infrastructure, NGO | All in-game behaviours |
| `Bogey.UI` | Core, Data, Gameplay (read-only usage) | HUD, menus |
| `Bogey.DevTools` | everything | Debug console, cheats. Stripped from release builds via define constraint `BOGEY_DEV` |
| `Bogey.Editor` | everything (Editor platform only) | Inspectors, validators, level tools |
| `Bogey.Tests.EditMode` / `Bogey.Tests.PlayMode` | as needed | Tests |

### 6.3 Patterns and conventions
- **Data-driven definitions:** every tunable is a ScriptableObject asset (`ClubDefinition`, `ItemDefinition`, …). Code never hardcodes balance numbers.
- **Composition over inheritance:** items are compositions of `ItemEffect` modules (`[SerializeReference]` polymorphic lists), not deep class hierarchies.
- **Service registry:** a small `Services` static locator populated in Bootstrap, with interfaces (`IAudioService`, `ISaveService`, `IPlatformService`). Swappable for tests and for the non-Steam dev path.
- **Events:** C# events/`Action`s on gameplay components for local presentation hooks (e.g. `GolfBall.OnLanded(surface)` → VFX/SFX). Networked events go through RPCs (06), never a global event bus over the network.
- **State machines:** explicit enum-based FSMs for Match, Golfer and Player-hit states, with transitions in one place. Logic lives in Core and is unit-tested.
- **Server/client split inside NetworkBehaviours:** `if (IsServer)` blocks kept minimal. Prefer separate methods `Server_*` / `Client_*` for readability.
- **No `FindObjectOfType` in gameplay code**, no singletons outside Services.
- Naming: `PascalCase` types/methods, `_camelCase` private fields, `SO` assets named `ITEM_BonkMallet`, `CLUB_Driver` etc. (see 07 §4).

### 6.4 Project folder layout
```
Assets/
  _Project/
    Art/            Characters/ Environment/ Items/ VFX/ UI/ Materials/ Shaders/
    Audio/          Music/ SFX/ Mixers/
    Data/           Clubs/ Surfaces/ Items/ StatusEffects/ Rules/ Courses/ Cosmetics/ DistributionTables/
    Prefabs/        Player/ Ball/ Items/ Hazards/ Course/ UI/
    Scenes/         Bootstrap, MainMenu, Lobby, Practice, Courses/, Sandbox/ (personal test scenes)
    Scripts/
      Core/         (Bogey.Core.asmdef)
      Data/
      Infrastructure/
      Gameplay/     Player/ Golf/ Items/ Match/ Hazards/ Camera/
      UI/
      DevTools/
      Editor/
    Settings/       URP assets, Input actions, Physics/Network configs
  Plugins/          third-party
Tests/ (inside Assets/_Project/Tests) EditMode/ PlayMode/
```

## 7. System context diagram

```
                  ┌──────────────┐        ┌──────────────┐
  Input System ──►│ PlayerInput  │──────► │ PlayerCtrl   │──(owner transform sync)──► Network
                  │  Router      │──┐     │ (movement)   │
                  └──────────────┘  │     └──────┬───────┘
                                    │            │ addresses
                                    ▼            ▼
                              ┌──────────┐  ShotRequestRpc   ┌──────────────┐
                              │ Golfer   │──────────────────►│ ShotSystem   │ (server)
                              │ (FSM)    │                   │ validates,   │
                              └────┬─────┘                   │ applies impulse
                                   │ UseItemRpc              └──────┬───────┘
                                   ▼                                ▼
                            ┌──────────────┐  effects  ┌──────────────────┐   events   ┌───────────────┐
                            │ ItemSystem   │──────────►│ GolfBall / Player│──────────► │ MatchDirector │
                            │ (server)     │           │ StatusEffects    │  holed,    │ (server FSM,  │
                            └──────────────┘           └──────────────────┘  KO, OOB   │ scoring)      │
                                                                                       └──────┬────────┘
                                                                         NetworkVariables     │
                                                         ┌────────────────────────────────────┘
                                                         ▼
                                              HUD / Scoreboard / Camera / Audio (presentation)
```

## 8. Persistence
| Data | Where | Format |
|---|---|---|
| Settings | `Application.persistentDataPath/settings.json` | JSON (versioned schema) |
| Profile (XP, unlocks, loadout) | `profile.json` + **Steam Cloud** sync | JSON with `schemaVersion` + migration functions |
| Stats/achievements | Steam Stats API | |
Saves are local and trusted (cosmetic only, no competitive value), so no server validation is needed.

## 9. Security / cheating posture
Casual, friends-first game, so reasonable effort only:
- Server validates every gameplay request (06 §6): ranges, cooldowns, item ownership, ball-at-rest, distance-to-ball.
- Owner-authoritative movement → **server sanity check** on speed/teleport distance and snap-back if violated.
- No anti-cheat SDK in v1. Revisit if public matchmaking becomes popular.

## 10. Platform abstraction
`IPlatformService` with `SteamPlatformService` and `NullPlatformService` (dev/LAN, editor, CI). The game must be fully runnable without Steam running, for tests and Multiplayer Play Mode.
