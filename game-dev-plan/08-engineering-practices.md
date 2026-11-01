# 08: Engineering Practices

## 1. Repository and version control
- **Separate repo:** `project-bogey` (private). Not this portfolio repo.
- **Git + Git LFS** (GitHub LFS quota: watch storage/bandwidth. Alternatives if assets grow large: Unity Version Control or Azure DevOps with free LFS).
- `.gitignore`: the standard Unity template (`Library/`, `Temp/`, `Obj/`, `Build*/`, `Logs/`, `UserSettings/`, `*.csproj`, `*.sln`).
- `.gitattributes`: LFS for `*.fbx *.blend *.png *.psd *.tga *.wav *.mp3 *.ogg *.ttf *.otf *.exr *.hdr *.unitypackage *.asset (large baked data only, e.g. LightingData)`. Mark `*.unity *.prefab *.asset *.mat *.anim *.controller` as `merge=unityyamlmerge` text.
- **Unity settings:** Asset Serialization = **Force Text**, Version Control = **Visible Meta Files** (defaults in Unity 6). Configure **UnityYAMLMerge** (Smart Merge) as the git merge tool.
- **Always commit `.meta` files** with their assets. A missing meta = broken references.
- **Scene conflict avoidance:** build gameplay as prefabs. Scenes mostly hold prefab instances. Personal `Sandbox_<name>` scenes for experiments.
- **Branching:** trunk-based. Short-lived `feature/<ticket>` branches → PR → squash-merge to `main`. `main` is always buildable.
- Commit messages: `[M2] Ball: server-auth NetworkRigidbody + interpolation`.

## 2. CI/CD (GitHub Actions + GameCI)
| Workflow | Trigger | Steps |
|---|---|---|
| `ci.yml` | PR | Cache `Library/` → EditMode tests → PlayMode tests → data validators (`Bogey/Validate All Data` via `-executeMethod`) |
| `build.yml` | push to `main`, nightly | Windows64 player build (+ Linux dedicated test client later) → artifact upload |
| `release.yml` | tag `v*` | Release build → SteamPipe upload to `beta` branch (M9) |
Notes: GameCI needs Unity license activation secrets (`UNITY_LICENSE`/`UNITY_EMAIL`/`UNITY_PASSWORD`, Personal license works). Cache the Library folder or builds take very long. Expect Unity CI builds of 10–30+ min.

## 3. Testing strategy
| Layer | Tool | What | Examples |
|---|---|---|---|
| Unit (fast, many) | EditMode tests (NUnit) on `Bogey.Core` | Pure logic | `ScoringRules`, `MatchStateMachine` transitions, `ItemRoller` weight distribution (statistical), `ShotMath` |
| Integration (PlayMode) | PlayMode tests with test scenes | Physics + components | Ball rests within N s on each surface · cup captures at 5 m/s, lips out at 8 m/s · hazard returns ball to last safe spot · preview vs real landing within 5% |
| Network integration | PlayMode with NGO host + client in one process (or Multiplayer Play Mode for manual) | RPC contracts | Shot request rejected when ball moving · item pickup race → one winner |
| Data validation | Editor scripts in CI | Asset integrity | Unique IDs, no null refs, hole setup valid |
| Manual playtest | Scheduled sessions | **Fun**, feel, clarity | See §4 |
| Soak (M9) | Bots/automated clients | Stability | 50 consecutive matches, no leaks/errors |

Game-specific note: test **logic** heavily and **feel** with humans. Don't try to unit-test fun.

## 4. Playtesting protocol (the game equivalent of user research)
- **Every milestone ends with a playtest.** Internal (you) → friends → strangers.
- Watch, don't explain. Record the screen + voice (with consent). Note confusion moments.
- Ask 3 questions: *What was the most fun moment? Most frustrating? What would make you play again?*
- Dev builds log telemetry locally (JSON): shots per hole, time per hole, items used, KOs, DNFs, quits → simple Python/Notebook analysis. (Respect privacy, local/opt-in only.)
- Steam Playtest (M9) for large external tests.

## 5. Debug tooling (build in M0–M2, it pays back massively)
- **Dev console** (backtick key): commands like `ball.reset`, `item.give bonk_mallet`, `hole.goto 3`, `time.scale 0.25`, `net.sim lag 150`, `god`.
- **Overlay:** FPS, frame time, RTT, packet loss, player/ball states, server vs client positions (ghost gizmos).
- **Physics debug draw:** shot trajectory recording, surface under ball, hit query volumes (OverlapSphere gizmos for 1 s).
- **Unity tools:** Profiler, Frame Debugger, Memory Profiler, Physics Debugger, Multiplayer Tools Network Profiler + Runtime Network Stats Monitor.
- All dev tools live in `Bogey.DevTools`, compiled only with the `BOGEY_DEV` define.

## 6. Performance budgets
| Metric | Target (min-spec: ~GTX 1050 / integrated Iris Xe, 4-core CPU, 8 GB RAM) |
|---|---|
| Frame rate | 60 fps at 1080p, Medium preset |
| CPU frame time | ≤ 12 ms main thread |
| Draw calls (SRP batches) | ≤ 1500 batches (use SRP Batcher, GPU instancing for foliage) |
| Physics | ≤ 2 ms per fixed step on host with 8 players + 8 balls |
| GC allocations | **0 B/frame** in steady-state gameplay (pool VFX/SFX/projectiles; avoid LINQ/string alloc in Update) |
| Memory | ≤ 3 GB process |
| Load time | Course load ≤ 10 s on SSD |
| Network | see 06 §5 |
Profile on the min-spec machine at every milestone from M6 on, not only at the end.

## 7. Coding standards
- `.editorconfig` with C# rules. Rider/IDE inspections clean before PR.
- No public fields for runtime state. `[SerializeField] private` for inspector values.
- No balance numbers in code. They go in data assets.
- Every NetworkBehaviour documents its **authority** in a header comment (`// Authority: Server` / `// Authority: Owner`).
- Avoid `Update()` sprawl. Prefer event-driven code. One `Update` per system where possible.
- PR checklist: tests pass, no new warnings, profiled if gameplay-hot, network contract updated if RPCs changed.

## 8. Release checklist (M9)
- [ ] Version bumped (`Application.version` + `ProtocolVersion` if changed)
- [ ] Release build without `BOGEY_DEV`, IL2CPP backend, stripping level tested
- [ ] Crash reporter receiving events from the RC build
- [ ] Full 8-player online match on RC with real Steam app ID
- [ ] Min-spec performance check
- [ ] Settings/save migration from the previous version tested
- [ ] Third-party licenses file included in the build/credits
- [ ] SteamPipe upload to `beta`, smoke test, then promote to `default`
- [ ] Patch notes + Discord/Steam announcement

## 9. Costs to expect (one-time / yearly, rough)
| Item | Cost |
|---|---|
| Unity Personal | Free (under the revenue/funding threshold; check current Unity terms) |
| Steam Direct fee | $100 per app (recoupable after sales threshold) |
| Rider | Free for non-commercial; paid if commercial |
| Asset store (kits, VFX, SFX, tools) | ~$200–800 |
| Commissions (character, UI, music, capsule art) | Varies widely. Budget is your call (see 10) |
| GitHub LFS data packs | small monthly if assets grow |
| Servers | $0 (Steam relay, host mode) |
