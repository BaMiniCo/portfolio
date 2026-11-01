# 01: Concept Document (the "vision" / one-pager)

## Elevator pitch
> **Golf, but nobody waits their turn.** Up to 8 players tee off together and race to sink their ball in the fewest strokes. Along the way they bonk each other with mallets, glue rivals' balls to the ground and blast them off cliffs. It's a party game built for friends on voice chat, where a perfect chip-in and a cheap shot are equally funny.

## Design pillars
Pillars are the tie-breakers for every future decision. If a feature doesn't serve at least one, cut it.

1. **Everyone plays at once.** Nobody waits. Downtime is the enemy: no turns, short holes, quick respawns.
2. **Skill shots, silly outcomes.** Golfing takes real skill (aim, power, club choice, reading slopes). The *chaos* comes from other players, not from random physics.
3. **Every sabotage has an answer.** Items and attacks must be dodgeable, blockable or recoverable. Getting hit should be funny, not frustrating.
4. **Readable chaos.** With 8 players and explosions you must still be able to see your ball, your player, and what just hit you.
5. **Ten seconds to understand, hours to master.** New players are holing out on their first hole. Veterans exploit slopes, items and routes.

## Target audience and platform
- **Players:** friend groups (2–8) who play party games together. Streamers and content creators are a key secondary audience, because chaos clips well.
- **Platform:** PC (Steam) first, keyboard/mouse and gamepad. Consoles maybe later, but nothing that rules them out (gamepad-first UI, no PC-only assumptions).
- **Session:** a match is about 10–15 minutes (one course of 6–9 short holes).
- **Business model (proposal):** premium, low price, with cosmetics earned by playing. No pay-to-win. See open questions in 10.

## Core loop

```
            ┌──────────────────────────────────────────────────────┐
            ▼                                                      │
   Tee off (all at once) ──► Run to your ball ──► Line up & shoot ─┤
            │                     │    ▲                           │
            │                     ▼    │                           │
            │          Grab item boxes / fight / dodge             │
            │                                                      │
            └──► Hole out (or timer ends) ──► Points ──► Next hole─┘
                                                     │
                                         after last hole ▼
                                 Results ─► XP / cosmetic unlocks ─► Play again
```

**Three loops at three timescales:**
| Loop | Length | What the player does |
|---|---|---|
| Moment-to-moment | 5–15 s | Walk, aim, charge, shoot. Grab an item, use it, dodge |
| Hole | 60–120 s | Race the field, choose risky vs safe routes, finish before the timer |
| Meta | across matches | Unlock cosmetics, learn courses, climb friend leaderboards |

## What makes it ours (differentiators to develop)
The genre exists already. These are directions **we** pick to stand out. Choose one or two to lean into during prototyping:
- **Surface-driven gameplay:** courses with strong surface identities (ice, mud, bounce pads, conveyors) that items can also *create*. For example, a mud item paints a temporary surface.
- **Ring-out KOs instead of health bars:** knocking someone into water or off the map is the payoff, like a platform fighter.
- **Catch-up item distribution:** players at the back get the better items, so the match stays close to the end.
- **A strong art identity:** e.g. toy-like, tabletop-diorama courses. To be decided in 07.

## Scope guardrails (explicitly NOT in v1)
- Vehicles / rideable carts
- Local split-screen
- Ranked matchmaking, dedicated servers, our own backend
- Host migration
- Level editor / user-generated courses
- Real-money purchases
- Consoles / mobile

These are good *post-launch* candidates. They're parked so the first version ships.
