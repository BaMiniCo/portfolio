# 10: Decisions, Open Questions and Risks

## Open questions for you
Each has a **recommended default**. If you don't object, I go with the default.

| # | Question | Options | Recommended default |
|---|---|---|---|
| Q1 | Working title and theme | Keep "Project Bogey" as codename / pick now | Codename now. Real name before the M6 vertical slice |
| Q2 | Art direction | Toy diorama (low-poly) / stylized hand-painted / realistic | **Toy diorama**: cheapest for a solo engineer, readable (07 §1) |
| Q3 | Networking stack | NGO / FishNet / Photon Fusion 2 | **NGO** (ADR-001). Revisit only if M2 feel fails |
| Q4 | Scoring | Points (strokes + finish order + KOs) / pure strokes | **Points** for Party mode, strokes for Classic mode |
| Q5 | Combat model | Ring-out KOs, no health / health bars | **Ring-out KOs, no health** |
| Q6 | Hit other players' balls with your club? | Yes / No (items only) | **No.** Keeps golf readable. Items handle ball sabotage |
| Q7 | Player count | 2–4 / 2–8 / 2–12 | **2–8** (design and test for 4 first, scale to 8 in M5) |
| Q8 | Platform | Steam PC only / + consoles | **Steam PC first**, gamepad-first UI to keep console options open |
| Q9 | Business model | Premium (~$10–15) / free-to-play + cosmetics | **Premium + earned cosmetics**, no microtransactions at launch |
| Q10 | Art budget | $0 (asset store + self) / small commissions / larger | Your call. The plan assumes **asset store + a few commissions** (character, UI, capsule art) |
| Q11 | Vehicles / carts | v1 / post-launch | **Post-launch** |
| Q12 | Bots | v1 / post-launch | **Post-launch** (useful, but golf AI is expensive) |
| Q13 | Mid-match joins | No / spectator until next hole | **No** at MVP, spectator in V1 |
| Q14 | Your differentiator (01) | Surface play / ring-outs / catch-up items / art identity | Lean on **surface play + ring-outs**, refine after M4 playtests |

---

## Architecture Decision Records (ADRs)

### ADR-001: Netcode for GameObjects with host mode and Steam relay
- **Context:** physics-heavy party game, 2–8 players, solo developer, no budget for servers, first networked game.
- **Options:**
  - **NGO**: first-party, best docs/samples, Multiplayer Play Mode + Network Simulator + Network Profiler integrated. No built-in client prediction (not needed with owner-auth movement). Community Steam transports exist.
  - **FishNet**: free, feature-rich (built-in prediction, lag compensation), Steam transport available. Smaller docs/community, more concepts to learn.
  - **Photon Fusion 2**: best-in-class prediction and physics sync. Paid by CCU at scale, tied to Photon cloud relay rather than Steam. More complex mental model.
- **Decision:** NGO, host mode, owner-authoritative movement, server-authoritative balls/items/scoring, Steam Networking Sockets transport for production.
- **Consequences:** simple to learn and test. We accept some host advantage and slight hit latency for clients. Revisit (FishNet or Fusion) only if the M2 exit criteria fail at 150 ms RTT.

### ADR-002: Owner-authoritative player movement
- **Decision:** clients own their character transform. The server sanity-checks it.
- **Why:** instant movement without writing prediction/reconciliation. Cheating risk is acceptable for a friends-first casual game.
- **Consequence:** knockback must go through the owner (`KnockbackRpc`), so it arrives ~½ RTT late, masked by hit-stop/flinch.

### ADR-003: Server-authoritative ball physics + swing-animation latency hiding
- **Decision:** only the server simulates balls. Shot requests are sent at swing start, impact is applied ~0.2 s later.
- **Why:** balls collide with each other and with items, so client-side simulation would diverge. A golf shot is a discrete event with a natural wind-up, perfect for hiding latency.

### ADR-004: All holes of a course in one scene
- **Decision:** one scene per course, holes as `HoleRoot`s, teleport between holes.
- **Why:** instant hole transitions and simpler networking (no scene loads mid-match). **Revisit** if memory or lightmap bake times grow. Then split per hole into additive scenes.

### ADR-005: Data-driven definitions + composable item effects
- **Decision:** ScriptableObject definitions for all tunables. Items composed of `[SerializeReference] ItemEffect` modules.
- **Why:** constant balance changes, new items without new class hierarchies, designer-style iteration.

### ADR-006: Pure-C# Core assembly for rules
- **Decision:** scoring, match FSM, shot math and item rolling live in `Bogey.Core` without engine dependencies.
- **Why:** fast EditMode unit tests and clear separation, which suits your software engineering strengths.

### ADR-007: Practice/offline = host with zero clients
- **Decision:** there's no separate offline code path.
- **Why:** one code path means no "works online but not offline" (or vice versa) bugs.

---

## Risk register

| # | Risk | Likelihood | Impact | Mitigation | Detect early at |
|---|---|---|---|---|---|
| R1 | **Core golf isn't fun** (shot feel) | Med | Critical | Gray-box M1 with live tuning. Playtest before anything else | M1 exit |
| R2 | **Networked physics feels laggy/jittery** | Med | High | Server-auth balls + swing latency hiding. Test with simulated latency from M2. Fallback: FishNet/Fusion | M2 exit |
| R3 | **Scope creep** (items, courses, vehicles…) | High | High | Pillars + parked list (01). Milestone gates. MVP = 1 course, 3 items | Every milestone |
| R4 | **Art bottleneck** (you're an engineer) | High | High | Low-poly style, asset store base, targeted commissions, art only after M6 gate | M6 |
| R5 | **Chaos becomes frustration** (griefing, stun-lock) | Med | High | Immunity windows, telegraphs, counterplay rule, shields, KO cap | M4 playtest |
| R6 | **Steam transport maturity/bugs** for NGO | Med | Med | Spike in M5 start. Fallback: Unity Relay (paid per use) or Steamworks.NET transport | M5 |
| R7 | **Too few players** (party game needs friends online) | Med | High | Strong friend invite flow, Practice mode, bots post-launch, streamer-friendly moments | M9 |
| R8 | **IP similarity** to existing games | Low (if we stay original) | High | Original names, art, items and rules. No referencing others' assets. Legal review of store page | Ongoing |
| R9 | **Solo burnout / long timeline** | Med | High | Small milestone wins, visible progress builds, playtests with friends as motivation | Ongoing |
| R10 | **Physics edge cases** (tunneling, balls stuck, never resting) | High | Med | CCD, rest hard cap, stuck detection → auto-reset, PlayMode tests per surface | M1 |
| R11 | **Unity licensing/terms changes** | Low | Med | Stay on an LTS version. Monitor terms | Ongoing |
