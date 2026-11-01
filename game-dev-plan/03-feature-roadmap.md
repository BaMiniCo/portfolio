# 03: Feature Roadmap (milestones, no dates)

Each milestone is a **gate**: we don't start the next one until the exit criteria pass. Milestones build on each other in dependency order. The ordering principle:

> **Feel → Network → Loop → Chaos → Online → Polish → Content → Meta → Ship.**
> Prove the riskiest things (shot feel, networked physics) while everything is still cheap gray boxes.

```
M0 Foundation
 └─► M1 Core Golf Feel (offline)
      └─► M2 Networked Golf ◄── biggest technical risk, retired early
           └─► M3 Match Loop & Scoring
                └─► M4 Chaos Layer (combat + first 3 items)
                     ├─► M5 Steam & Lobbies (real online play)
                     └─► M6 VERTICAL SLICE (1 course at final quality) ◄── "is this a game?" gate
                          └─► M7 Content Expansion  (items, courses, hazards, modes)  = ALPHA at end
                               └─► M8 Meta & Polish (progression, cosmetics, settings, a11y)
                                    └─► M9 Release Readiness (perf, stability, Steam page, playtests) = BETA → EARLY ACCESS
                                         └─► M10 Live Ops (post-launch)
```

---

## M0: Project Foundation
**Goal:** a clean, buildable Unity project with tooling, so feature work never fights infrastructure.

| Feature | Details |
|---|---|
| Repo and version control | New `project-bogey` repo, Unity `.gitignore`, Git LFS for binaries, Smart Merge for YAML |
| Unity project | Unity 6 LTS, URP template, Input System, Cinemachine 3, NGO, Multiplayer Play Mode, TextMeshPro |
| Code architecture skeleton | Folder layout + assembly definitions (see 04 §6), Bootstrap scene, service registry |
| CI | GitHub Actions + GameCI: run EditMode/PlayMode tests on PR, build a Windows player on `main` |
| Debug foundations | In-game debug console/overlay (FPS, ping, state), log categories |

**Exit criteria:** fresh clone → open → Play works. CI is green and produces a downloadable Windows build. One sample unit test runs in CI.

---

## M1: Core Golf Feel (single player, gray-box)
**Goal:** hitting the ball is satisfying. **If this isn't fun, nothing else matters.**

| Feature | Details (GDD ref) |
|---|---|
| Character controller | Run, jump, third-person camera (02 §4.1, §12) |
| Golf ball physics | Flight, drag, bounce, custom roll resistance, rest detection (02 §3.4) |
| Surfaces | Fairway/rough/green/sand via SurfaceDefinition data (02 §3.5) |
| Shot system | Address → aim → charge → swing, 4 clubs, preview arc (02 §3.1–3.3) |
| Cup | Capture speed threshold, cup assist (02 §3.7) |
| Hazards | Water/OOB → penalty, return to last safe position (02 §3.6) |
| Gray-box hole | 1–3 test holes built with ProBuilder |
| Practice mode | Reset ball, change club/surface, tune live via debug panel |
| Minimum juice | Hit SFX placeholder, ball trail, hit-stop |

**Exit criteria:** 3+ outside playtesters (friends) play the gray-box holes and **want to keep playing**. They can sink a putt intentionally. Shot distances feel consistent per club.

---

## M2: Networked Golf (simultaneous play)
**Goal:** 2–4 players golf the same hole at the same time over a network with good feel. This retires the biggest technical risk.

| Feature | Details |
|---|---|
| NGO host/client | Host mode with Unity Transport (direct IP / LAN for now) |
| Networked players | Owner-authoritative movement, interpolated remote players |
| Networked balls | Server-authoritative ball physics, interpolated on clients |
| Shot RPC flow | Shot request at swing start; animation hides latency (06 §4) |
| Player spawn/despawn | Join/leave handling, color assignment |
| Network test tooling | Multiplayer Play Mode (multiple players in the editor), Network Simulator (latency/loss presets), net stats overlay |

**Exit criteria:** 4 players (Multiplayer Play Mode + one remote friend) complete a hole together. At **150 ms simulated RTT + 2% loss**, shots still feel responsive and balls never visibly teleport.

---

## M3: Match Loop and Scoring
**Goal:** a complete, multi-hole match from lobby to results (still gray-box).

| Feature | Details |
|---|---|
| Match state machine | Lobby → HoleIntro → Countdown → Playing → FinishTimer → HoleEnd → Results (02 §1) |
| Course definition | Course = ordered holes, each with tees, cup, par, wind (data-driven) |
| Scoring | Points rules (02 §2), max strokes / DNF |
| Basic UI | HUD (strokes, timer, club, power), scoreboard between holes, results screen |
| Spectate | After holing out |
| Basic menus | Main menu, host/join by IP, simple lobby list |

**Exit criteria:** a 6-hole gray-box match with 4 players runs start to finish with correct scores, without errors, three times in a row.

---

## M4: Chaos Layer (combat + first items)
**Goal:** prove that "golf + sabotage" is more fun than golf alone.

| Feature | Details |
|---|---|
| Hit/knockback framework | Damage-less hit events, knockback impulses, stun, immunity (02 §4.3) |
| Shove | Base action |
| KO attribution | Last-hitter within 5 s (02 §4.4), KO feed |
| Item framework | Item boxes, inventory, distribution tables, data-driven item effects (05 §6) |
| 3 MVP items | Bonk Mallet, Sticky Grip, Gust Can |
| Status effects | Stun, ball buffs, immunity (generic system) |
| Simple ragdoll | Cosmetic local ragdoll on big hits |

**Exit criteria:** blind A/B playtest: groups play with items on vs off and **prefer items on**. No "that felt unfair" complaints that the counterplay design can't explain.

---

## M5: Steam and Lobbies (real online with friends)
**Goal:** friends can find each other and play over the internet without port forwarding.

| Feature | Details |
|---|---|
| Steamworks integration | Facepunch.Steamworks, app ID 480 (Spacewar) during dev |
| Steam transport | NGO transport over Steam Networking Sockets (relay, NAT-free) |
| Lobbies | Create/invite/join through overlay, lobby codes, ready-check |
| Persona | Steam name and avatar in game |
| Disconnect handling | Graceful errors, timeouts, host-left flow |

**Exit criteria:** 4 friends in different homes join through Steam invite and finish a match. Disconnects show clear messages, not crashes.

---

## M6: Vertical Slice ⭐
**Goal:** **one course (Meadow Links, 3–6 holes) at final quality.** It proves the art pipeline and sets the quality bar. It also works as a trailer/demo.

| Feature | Details |
|---|---|
| Art direction locked | Style guide, color palette, character proportions (07 §1) |
| Character art | 1 base character, rig, animation set, 3–5 cosmetic variants |
| Course art | Modular environment kit, Meadow Links holes dressed and lit |
| Items art | Final models/VFX for the 3 items + item box |
| Audio | Music track, full SFX set for core actions, ambience |
| UI art | Final HUD, menus, transitions, fonts, iconography |
| Juice pass | Everything in GDD §13 |
| Hole intro cameras | Flyovers |
| Performance pass | Hits budgets in 08 §6 on min-spec |

**Exit criteria:** strangers (not friends) play it and ask "when can I buy this?". It's watchable as a 60-second capture. Performance budgets are met.

> **Decision gate:** after M6, review honestly. If it's not fun, iterate on M1–M4 mechanics *before* producing more content.

---

## M7: Content Expansion → **Alpha** (feature complete)
| Feature | Details |
|---|---|
| Items 4–12 | Remaining V1 catalog (02 §5.3) |
| Surfaces | Ice, bounce pads, mud zones |
| Dynamic hazards | Moving platforms, conveyors, timed gates |
| Courses 2–4 | Tidepool Dunes, Frostbite Peaks, Clockwork Yard |
| Modes | Classic, Custom rules |
| Mid-match join as spectator | |

**Exit criteria (Alpha):** every V1 feature exists in the game (placeholder art allowed for new content), playable end to end.

## M8: Meta and Polish
| Feature | Details |
|---|---|
| Progression | XP, levels, unlock tracks |
| Cosmetics | Locker screen, all slots, save/load + Steam Cloud |
| Achievements | Steam achievements and stats |
| Settings | Full video/audio/controls, rebinding |
| Accessibility | Colorblind support, shake toggle, subtitles |
| Tutorial | Interactive first-time tutorial hole |
| Public lobbies | Quick join / lobby browser |

## M9: Release Readiness → **Beta** → **Early Access launch**
| Feature | Details |
|---|---|
| Stability | Crash reporting (Sentry/Backtrace), soak tests, bug burn-down |
| Performance | Min-spec testing, GPU/CPU profiling |
| Steam store | Store page, capsule art, trailer, screenshots, Steam Playtest, wishlist push |
| Build pipeline | Steam depots via SteamPipe, branches (beta/default) |
| Legal | EULA, privacy policy, third-party license credits, age rating questionnaire |
| Feedback | In-game feedback button, Discord community |

**Exit criteria (Beta):** content complete, no crash bugs. **Launch:** release-candidate build passes the release checklist (08 §8).

## M10: Live Ops (post-launch)
Patches from player feedback. New courses/items as content updates. Then candidates from the "parked" list: bots, vehicles, teams, level editor, consoles.
