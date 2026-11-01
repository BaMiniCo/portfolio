# Project Bogey: Game Development Plan (Unity)

> **Working title:** *Project Bogey* (placeholder, rename freely)
> **Genre:** Online multiplayer party golf. Everyone plays at once and can sabotage each other with items and knockback.
> **Engine:** Unity 6 LTS · URP · C#
> **Status:** Pre-production, awaiting your review

This is an **original** game in the "chaotic party golf" genre. It is not a clone of any existing title. Every character, item, course and rule here is our own design, and it should stay that way as we build.

---

## How game development maps to what you already know

You're used to: Idea → PRD → Design → Workflows → HLD → LLD → API contracts → Build.
Game development has a similar order, with one big difference: **fun can't be specified up front, it has to be found by prototyping.** Design documents stay "living" and change after every playtest.

| Software engineering | Game development equivalent | In this plan |
|---|---|---|
| Idea / vision | **Concept doc**: pitch, pillars, audience, what makes it different | [01-concept.md](01-concept.md) |
| PRD | **Game Design Document (GDD)**: rules, mechanics, items, courses, modes, controls | [02-game-design-document.md](02-game-design-document.md) |
| Roadmap / releases | **Milestones**: Prototype → Vertical Slice → Alpha → Beta → Launch | [03-feature-roadmap.md](03-feature-roadmap.md) |
| UX design / workflows | **UX flows and screen map**, plus the in-match player journey | in 02 (§10) |
| HLD | **Technical Design Doc: architecture** | [04-technical-architecture.md](04-technical-architecture.md) |
| LLD | **Per-system design**: classes, state machines, sequence diagrams, data schemas | [05-low-level-design.md](05-low-level-design.md) |
| API contracts | **Network protocol**: synced state, RPCs, authority, validation, bandwidth | [06-network-contracts.md](06-network-contracts.md) |
| Design system / brand | **Art direction and content pipeline**: style guide, asset specs, level design workflow, audio | [07-content-pipeline.md](07-content-pipeline.md) |
| Eng practices / CI | **Engineering practices**: Git LFS, CI builds, tests, debug tools, perf budgets, release | [08-engineering-practices.md](08-engineering-practices.md) |
| Sprint backlog | **Step-by-step backlog**: setup checklist and tickets for the first milestones | [09-backlog.md](09-backlog.md) |
| ADRs / risk register | **Decisions, open questions, risks** | [10-decisions-and-risks.md](10-decisions-and-risks.md) |

### The game development lifecycle in one picture

```
 CONCEPT ──► PRE-PRODUCTION ─────────────────────► PRODUCTION ───────────────► ALPHA ──► BETA ──► LAUNCH ──► LIVE OPS
 pitch,      GDD v0, gray-box prototypes,           build features & content    feature   content   ship      patches,
 pillars     "find the fun", tech spikes,           on proven foundations       complete  complete, (Early    new content,
             VERTICAL SLICE (1 polished hole)                                             bug-fix   Access)   events
               ▲
               └── the "is this a real game?" gate. Don't scale content before passing it.
```

Two concepts with no direct software engineering equivalent:
- **Gray-boxing:** build everything out of untextured cubes first. Art comes only after the mechanic is fun.
- **Vertical slice:** one small piece of the game at *final quality* (art, sound, UI, feel). It proves the whole pipeline works and sets the quality bar.

---

## How to review this plan

1. Read **01 → 03** first (what we're building, and in what order). These hold the product decisions.
2. Skim **04 → 06** (how it's built). These hold the engineering decisions.
3. Answer the **open questions in [10-decisions-and-risks.md](10-decisions-and-risks.md#open-questions-for-you)**. Every recommendation there is a default I'll go with unless you say otherwise.
4. Once you approve, we start at **[09-backlog.md → Step 0](09-backlog.md#step-0--machine--account-setup-you)**.

> Note: this folder lives in the `portfolio` repo only for review. GitHub Pages serves this repo, so if it's merged to `main` these files become public. Once approved, the game gets its **own repository** (see 08 §1) and this plan moves there as `/docs`.
