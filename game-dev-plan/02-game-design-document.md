# 02: Game Design Document (GDD), the "PRD"

> Living document. Every number here is a **starting value to tune in playtests**, not a final answer. Tunables live in ScriptableObject assets (see 05) so they can change without code changes.
> Priority tags: **[MVP]** needed for the vertical slice · **[V1]** needed for Early Access · **[Later]** post-launch.

---

## 1. Match structure [MVP]

| Setting | Default | Range |
|---|---|---|
| Players per match | 2–8 | 1 for practice mode |
| Holes per match | 6 | 3 / 6 / 9 (host setting) |
| Hole length | short, par 3–5, finishable in about 60–90 s | |
| Match length | about 10–12 min for 6 holes | |

### Hole lifecycle
```
HoleIntro (5 s flyover, players frozen, wind shown)
   └─► Countdown (3‑2‑1)
         └─► Playing ──(first player holes out)──► FinishTimer (30 s countdown starts for everyone else)
               │                                        │
               └─(hole time limit reached)──────────────┴─► HoleEnd (scores shown 5 s) ─► next hole / Results
```
- **Hole time limit:** `par × 25 s + 30 s` (par 3 = 105 s). Shown as a timer.
- **Finish timer:** once the first player holes out, everyone else has 30 s (or whatever is left of the limit, if less).
- **Did not finish (DNF):** stroke count is set to `par + 4` (the "max strokes" cap).
- **Max strokes per hole:** `par + 4`. Reaching it auto-DNFs you. You become a spectator who can still use items (stay involved, Pillar 1).

## 2. Scoring [MVP]
Points instead of pure strokes, so chaos and speed matter, not only accuracy.

| Source | Points | Notes |
|---|---|---|
| Strokes vs par | `max(0, 50 + (par − strokes) × 15)` | Eagle = 80, birdie = 65, par = 50, bogey = 35… DNF = 0 |
| Finish order | 1st +30, 2nd +20, 3rd +10 | Rewards speed (simultaneous play) |
| Knockouts | +10 per KO | See §5.4. Capped at +30 per hole so fighting doesn't replace golfing |
| Hole-in-one | +50 bonus | Big celebratory moment |

- Winner = highest total after the last hole. Tie-break: fewest total strokes.
- Leaderboard between holes shows the per-hole breakdown (players love seeing "+10 KO").
- **Alternate mode [V1]:** "Classic": pure stroke play, items off. Easy to support because the scoring rules are data-driven.

## 3. Golfing mechanics [MVP]

### 3.1 Player golfing states
```
 Roaming ──(within 2.5 m of own ball, ball at rest, press Interact)──► Addressing
 Addressing ──(press Cancel / get hit)──► Roaming
 Addressing ──(hold Shoot)──► Charging ──(release)──► Swinging ──(impact frame)──► Roaming
 Charging ──(get hit)──► Roaming (shot cancelled, no stroke counted)
```
- You can only hit **your own ball**, and only when it's **at rest**.
- When you enter Addressing, the character snaps to stand beside the ball facing the aim direction.
- While Addressing/Charging you **can still be hit**. This is a risk/reward moment, and the reason shields exist.

### 3.2 Clubs (4 at MVP)
| Club | Launch angle | Max ball speed | Best for | Preview arc length |
|---|---|---|---|---|
| Driver | 14° | 40 m/s | Tee shots, distance | 35% of flight |
| Iron | 28° | 28 m/s | Mid-range, controllable | 50% |
| Wedge | 50° | 18 m/s | Over obstacles, short high shots | 70% |
| Putter | 0° (ground roll) | 12 m/s | Greens | Short line, 2 m |

- Auto-select a sensible club from distance to the hole and surface (putter on green). The player can cycle with Q/E or the bumpers.
- The **preview arc** is deliberately partial. Reading the rest is the skill.

### 3.3 Shot input
- **Aim:** horizontal direction with mouse/right stick. Fine-aim modifier (hold Shift/LT = 25% sensitivity).
- **Power:** *hold-to-charge* meter that fills from 0 to 100% in 1.2 s, then **drains back down** (ping-pong), so holding too long is punished. Release sets the power.
- **Power curve:** `speed = club.maxSpeed × curve(power)`, where `curve` is slightly ease-in. Low powers are more precise for putting.
- **Accuracy (optional, [V1]):** a small random horizontal spread when power > 90% ("over-swing"). Off for MVP.
- **Spin / curve:** [Later].

### 3.4 Ball physics model
Physics is "arcade-real": believable but tuned for fun (see 05 §3 for implementation).
- **Ball size:** exaggerated, radius about **0.12 m** (a real golf ball is 0.021 m). It's visible and physics-stable. The world scale matches.
- **In flight:** gravity + linear air drag + **wind** force (per hole, 0–10 m/s, direction shown on the HUD).
- **On ground:** rolls and bounces according to **surface** (below). A custom rolling resistance makes the ball actually stop.
- **At rest:** speed < 0.15 m/s for 0.5 s → ball is "at rest" and shootable. Safety cap: after 12 s of rolling, the ball is force-stopped.
- **Ball–ball collisions:** ON (chaos). **Ball–player collisions:** the ball bounces off players. Players are not knocked back by balls at MVP. [V1]: a fast ball (> 25 m/s) staggers the player it hits.

### 3.5 Surfaces
| Surface | Bounce | Roll resistance | Other |
|---|---|---|---|
| Fairway | medium | low | baseline |
| Rough | low | high | max shot power ×0.8 when shooting from it |
| Green | low | very low | putter auto-selected |
| Sand (bunker) | none | very high | max power ×0.6, wedge auto-selected |
| Ice [V1] | medium | near zero | player movement slippery too |
| Bounce pad [V1] | very high | n/a | |
| Mud (item-created) | none | extreme | temporary, see items |
| Wall/rock | high | n/a | |

### 3.6 Hazards and penalties
| Hazard | Effect on ball | Effect on player |
|---|---|---|
| Water | +1 stroke, ball returns to **last safe rest position** | Player respawns next to their ball after 2 s (counts as KO if recently hit) |
| Out of bounds | same as water | same |
| Kill volume (fall off map) | same | same |

"Last safe rest position" = the last place the ball came to rest on a valid surface (stored server-side).

### 3.7 The cup (holing out)
- The ball is captured if it enters the cup **slower than 6 m/s**. Faster balls lip out and bounce away naturally.
- **Cup assist:** within 0.6 m of the cup, a gentle pull toward it when the ball is slower than 3 m/s. Makes putting feel good. Tunable, can be turned off.
- On capture: celebration VFX/SFX, the player's character does a quick emote, the camera switches to spectate, and score is shown.

### 3.8 Wind [MVP-lite]
- Each hole defines a wind range. A random value is picked at HoleIntro. MVP: some holes have wind and some don't.
- Shown on the HUD as an arrow + m/s. It affects the ball only while airborne (not the preview arc, which is part of the skill).

## 4. Character [MVP]

### 4.1 Movement
| Param | Value |
|---|---|
| Walk/run speed | 7 m/s (no separate walk at MVP) |
| Sprint | [V1] stamina-free sprint 10 m/s, can't use items while sprinting |
| Jump | 1.2 m height |
| Air control | 50% |
| Respawn | 2 s, at own ball |

All characters have **identical stats**. Differences are purely cosmetic, so there's nothing to balance.

### 4.2 Base actions (no item needed)
- **Shove** (melee, 0.8 s cooldown): small knockback (4 m/s), no stun. Always available, so players can always interact (Pillar 1).
- **Interact:** address ball / pick up item (pickups are automatic on touch).

### 4.3 Hit reactions
| Reaction | Trigger | Player control |
|---|---|---|
| Flinch | Shove | Brief 0.2 s slowdown |
| Knockback | Most attack items | Launched by impulse, ~0.4 s no control |
| Stun | Heavy items | 1.5 s no control, dizzy stars |
| Ragdoll | Big launches (> 12 m/s) | Visual ragdoll until landed + 0.5 s get-up |

- **Hit immunity:** after a stun/ragdoll, 1.5 s of immunity to further stuns (stops stun-locking, Pillar 3). Knockback still applies, but reduced.

### 4.4 Knockouts (KO)
- No health bars. A **KO** happens when a player enters a hazard/kill volume within **5 s of being hit** by another player. The **last hitter** gets credit.
- KO feed message: "🔨 Alex bonked Sam into the lake".

## 5. Items [MVP: 3 items, V1: ~12]

### 5.1 Item boxes
- Placed by the level designer, typically 4–8 per hole, often at risky/off-route spots.
- Pick up by touching. The box respawns after 15 s. Players hold **1 item** (V1: maybe 2).
- Visual: floating, rotating box with a "?" in the player's eventual style.

### 5.2 Distribution (catch-up mechanic)
The server rolls an item using **weighted tables by "position"**:
- Position = rank by `(strokes taken − progress toward hole)`. Simplified: rank by remaining distance to cup + strokes.
- Leaders get weak/defensive items. Trailing players get strong/disruptive ones.
- Weights live in a `ItemDistributionTable` asset (see 05), tunable.

### 5.3 Item catalog (all original)
| # | Item | Type | Effect | Counterplay | Tier | Priority |
|---|---|---|---|---|---|---|
| 1 | **Bonk Mallet** | Melee attack | Big overhead swing, 0.35 s wind-up. Hit = knockback 10 m/s + 1.5 s stun | Telegraphed wind-up, dodge/jump, Bubble Shield | Common | **MVP** |
| 2 | **Sticky Grip** | Self ball buff | Next shot: ball stops dead on its first ground contact (no roll) | None needed (self-buff) | Common | **MVP** |
| 3 | **Gust Can** | Cone blast | 8 m cone in front: pushes players (8 m/s) **and balls** (rolling balls get shoved; resting balls nudged up to 3 m) | Stay out of the cone, Shield | Uncommon | **MVP** |
| 4 | Bubble Shield | Defensive | Blocks the next hit (any attack) within 10 s | — | Common (leaders) | V1 |
| 5 | Mud Pie | Thrown | Lobbed projectile, splats a 3 m mud patch for 12 s: players slowed 50%, balls stop rolling | Avoid the zone, shoot over it | Common | V1 |
| 6 | Spring Pad | Placeable | Places a pad that launches any player/ball upward + forward | Can be used by anyone (including you) | Uncommon | V1 |
| 7 | Rubber Core | Self ball buff | Next shot: ball is super bouncy and **skips once across water** | — | Uncommon | V1 |
| 8 | Net Trap | Placeable trap | Invisible to others after 1 s. Catches the next *ball* that rolls in; that ball's owner must walk there to free it (+0 strokes, just time) | Visible shimmer up close | Uncommon | V1 |
| 9 | Dash Boots | Movement | 3 dashes over 8 s (6 m each) | — | Common | V1 |
| 10 | Magnet Ball | Self ball buff | Next shot: mild curve toward the cup during flight | — | Rare (trailing only) | V1 |
| 11 | Swap Ticket | Ball swap | Swap your ball's position with the ball of the player **1 rank above you** | Bubble Shield blocks | Rare (last place only) | V1 |
| 12 | Bowling Bomb | Thrown roller | Rolls along the ground, explodes on contact or after 4 s: big knockback 12 m/s + launches balls | Jump over it | Rare | V1 |

Rules every item follows:
- **Telegraph** (wind-up, sound cue, or visual) for every attack (Pillar 3).
- Clear **VFX color language**: red = hurts you, blue = defensive, yellow = affects balls.
- Ball items (Sticky Grip, Rubber Core, Magnet Ball) **apply on the next shot** and show an aura on your ball.

## 6. Courses and holes

### 6.1 Hole design rules (for simultaneous play)
1. **Short:** 120–300 m equivalent. Par 3–5, holeable in 60–90 s.
2. **Multiple routes:** a safe long route and a risky shortcut (over water, through a narrow gap).
3. **Convergence points:** places where players meet (bridges, greens) so interaction happens.
4. **Wide tees:** 8 tee spots spread out to avoid instant pile-ups.
5. **Item placement:** boxes reward detours. Never right on the optimal line.
6. **Readable greens:** slopes visible through grid/texture, so putts are skill, not guesses.
7. **Fail-forward hazards:** penalties cost a stroke and some time, never a full restart.

### 6.2 Course catalog (themes)
| Course | Theme / identity | Signature mechanic | Priority |
|---|---|---|---|
| Meadow Links | Gentle grassy hills, tutorial-friendly | Basics, light wind | **MVP (3–6 holes)** |
| Tidepool Dunes | Beach, islands, tides | Strong wind, lots of water | V1 |
| Frostbite Peaks | Snowy mountain | Ice surfaces, slopes | V1 |
| Clockwork Yard | Toy factory | Conveyor belts, moving platforms, timed gates | V1 |
| Magma Garden | Volcano | Lava kill zones, eruptions that launch balls | Later |

## 7. Game modes
| Mode | Description | Priority |
|---|---|---|
| **Party Match** | Standard: items on, points scoring | MVP |
| **Practice** | Solo, any hole, no timer, reset ball freely | MVP (doubles as dev test bed) |
| **Classic** | Items off, pure stroke play | V1 |
| **Custom** | Host toggles: items list, timers, holes, wind on/off | V1 |
| Teams (2v2v2v2) | Team scores summed | Later |
| Bots | AI opponents | Later |

## 8. Progression and cosmetics [V1]
- **XP** per match (participation + placement + feats). Levels unlock cosmetics.
- **Cosmetic slots:** Hat, Outfit (body color/pattern), Club skin, Ball skin, Ball trail, Victory emote.
- Stored locally + Steam Cloud. Achievements through Steam.
- No currencies or shops in v1 (avoids economy design and backend).

## 9. Social / online [MVP: friends-only, V1: public]
- **Host a lobby** → invite friends through the Steam overlay, or share a lobby code.
- **Quick join** public lobbies [V1].
- **Mid-match join:** not supported at MVP. Joiners wait in the lobby for the next match. [V1]: join as spectator until the next hole.
- **Host leaves:** match ends, everyone returns to the menu with a message (no host migration, see 10).
- **Text chat:** none. Rely on Steam/Discord voice. [Later]: quick-chat emotes.

## 10. UX flows and screen map

### 10.1 Screen map
```
Boot/Splash ─► Main Menu ─┬─► Play ─┬─► Host Lobby ──► Lobby Room ──► (Match) ──► Results ──► Lobby Room
                          │         └─► Join (code / browser / invite) ─┘
                          ├─► Practice ─► Course/Hole select ─► (Practice session)
                          ├─► Locker (cosmetics) [V1]
                          ├─► Settings (Video / Audio / Controls / Accessibility)
                          └─► Quit
```

### 10.2 Lobby room
- Your character is in a small playable lobby area, so players can run around and test items while waiting.
- Host panel: course, hole count, mode, ready-check. "Start" is enabled when ≥ 2 players are ready (or 1 in dev builds).

### 10.3 In-match HUD
```
┌───────────────────────────────────────────────────────────────┐
│ Hole 3/6  Par 4    ⏱ 1:12           ▲ Wind 6 m/s  ↗          │
│                                                              │
│                      [KO feed / events]          Mini-board: │
│                                                  1. Alex 145 │
│                     (world: name tags, ball      2. You  130 │
│                      markers, item boxes)        3. Sam  110 │
│                                                              │
│ [Item slot: 🔨]                       Strokes: 2   Club: Iron │
│                                       [ Power meter ▓▓▓░░ ]  │
└───────────────────────────────────────────────────────────────┘
```
- **Ball locator:** an always-visible off-screen arrow to your ball, and to the cup (Pillar 4).
- Opponent balls: small colored markers with the player's color.

## 11. Controls (default bindings)
| Action | Keyboard/mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Camera / aim | Mouse | Right stick |
| Jump | Space | A / Cross |
| Interact / address ball | E | X / Square |
| Shoot (hold/release) | Left mouse | RT |
| Cancel address | Right mouse / Esc | B / Circle |
| Use item | F / Right mouse while roaming | RB |
| Shove | V | Y / Triangle |
| Cycle club | Q / E (while addressing) or wheel | LB / RB while addressing |
| Fine aim | Shift | LT |
| Scoreboard | Tab | Back/View |

All rebindable (Unity Input System rebinding UI) [V1].

## 12. Camera
| Mode | When | Behavior |
|---|---|---|
| Explore | Roaming | Third-person orbit behind the character, collision-aware |
| Address | Addressing/Charging | Behind ball looking down the aim line, higher pitch, slight zoom |
| Ball follow | First ~2 s after own shot (optional, skippable by moving) | Follows the ball's flight, then returns |
| Hole intro | HoleIntro | Spline flyover tee → cup |
| Spectate | After holing out / DNF | Cycle between players |

## 13. Game feel ("juice") checklist [MVP for core actions]
- **Shot impact:** 2-frame hit-stop, club "thwack" SFX scaled by power, dust/grass particles, small camera kick.
- **Ball:** trail while airborne, landing puffs per surface, rolling SFX per surface.
- **Hits:** screen shake on being hit, impact frames, cartoon SFX, stars on stun.
- **Hole out:** cup "plunk", confetti, crowd cheer, score popup.
- **UI:** animated counters, punchy transitions, sounds on every button.

## 14. Settings and accessibility [V1]
- Video: resolution, window mode, vsync, quality presets, FOV, frame cap.
- Audio: master / music / SFX / UI.
- Controls: sensitivity (separate aim sensitivity), invert Y, rebinding, vibration.
- Accessibility: colorblind-safe player colors (shapes + colors on markers), screen-shake toggle, subtitles for announcer lines, hold-to-toggle options.
