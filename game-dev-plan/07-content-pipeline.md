# 07: Art Direction and Content Pipeline (the "design system")

As an engineer, **content is your biggest bottleneck**. Code is maybe 30–40% of a game. This doc is about producing art, levels and audio efficiently and consistently.

## 1. Art direction (to be decided, proposal)

**Proposal: "Toy diorama."** Courses look like handcrafted tabletop models. Chunky low-poly shapes, soft lighting, saturated colors. Characters are small, round, toy-like golfers with big heads and simple faces.

Why this style suits a solo engineer:
- Low-poly + flat or gradient colors → **no texture painting**. Materials are a palette atlas (one small texture of color swatches).
- Simple shapes are easy to model and forgiving of imperfect animation.
- It reads well at distance with 8 players (Pillar 4).
- It ages well and is cheap to render.

**Deliverables before M6 (style guide):**
- Mood board (reference images of *styles*, not other golf games)
- Color palette: environment (per course), 8 **player colors** (colorblind-safe, distinct in hue *and* value) + gameplay colors (red = danger, blue = defense, yellow = ball effects)
- Character proportions sheet (height ≈ 1.2 m, head ≈ 40% of height)
- Shape language: round = friendly/safe, spiky = hazard
- Lighting reference: warm key light, soft shadows, light fog

**Decision for you:** keep this style or pick another (see 10).

## 2. Sourcing strategy (build vs buy vs commission)

| Asset | Gray-box phase (M1–M5) | Vertical slice and beyond |
|---|---|---|
| Characters | Capsule + Unity starter character | **Commission** 1 base character (rig + skin) from a freelance 3D artist, or a customizable asset-store pack restyled |
| Animations | Mixamo / Unity Starter Assets | Mixamo base + custom golf swing (commission or keyframe yourself) |
| Environment | ProBuilder blocks | Asset store low-poly kit as base → customize + palette swap; commission signature props |
| Items/props | Primitives | Model yourself in Blender (simple shapes) or commission |
| VFX | Default particles | Stylized VFX pack + customization |
| UI | Default uGUI | Commission a UI artist for a style pass (icons, frames), or a UI kit |
| Music | none / placeholder | License from a composer or royalty-free library (verify commercial license) |
| SFX | Free libraries | Paid SFX bundles (one-time license) + custom foley |

**Licensing rule:** keep a `THIRD_PARTY_LICENSES.md` from day one: every asset, source URL, license, purchase receipt. No assets ripped or "inspired" from other games.

## 3. Asset specifications

| Asset type | Spec |
|---|---|
| Units | 1 Unity unit = 1 m. Model in meters in Blender, apply scale, Y-up handled by FBX export (`Apply Transform`) |
| Characters | ≤ 8k tris, 1 skinned mesh + attachment sockets (`Socket_Head`, `Socket_HandR`, `Socket_Back`), humanoid rig (Mecanim Humanoid for retargeting) |
| Environment props | ≤ 2k tris typical, shared palette material, LOD only for big hero pieces |
| Colliders | **Separate simplified collision meshes** (`*_COL` suffix) or primitive colliders. Never mesh-collide detailed visuals. Fairway/green collision surfaces must be **smooth** (no tiny bumps that deflect the ball) |
| Textures | Palette atlas 256×256 per course. UI sprites in atlases. Max 2048 for anything |
| Materials | URP Lit/Simple Lit or one custom toon Shader Graph shader + variants |
| Audio | WAV 48 kHz source. Unity import: SFX = Vorbis/ADPCM, Decompress on Load for short clips. Music = Streaming |
| Animations | 30 fps, root motion **off** (code drives movement), events on swing impact frame (`Impact`) and footsteps |

### Character animation list (MVP)
Idle, Run, Jump (start/loop/land), Address idle, Backswing (per club family: full/putt), Swing impact + follow-through, Shove, Item use (overhead swing, throw, place, spray), Flinch, Stunned loop, Get-up, Celebrate (2), Disappointed, Spectate idle.

## 4. Naming conventions
| Kind | Pattern | Example |
|---|---|---|
| Prefabs | `PF_<Category>_<Name>` | `PF_Player`, `PF_Item_BonkMallet` |
| Data assets | `<TYPE>_<Name>` | `ITEM_BonkMallet`, `CLUB_Driver`, `SURF_Rough`, `RULES_Party` |
| Meshes | `SM_` static, `SK_` skinned | `SM_Tree_Oak_01`, `SK_Golfer` |
| Materials | `M_` | `M_Palette_Meadow` |
| Textures | `T_<Name>_<Type>` | `T_Palette_Meadow_D` |
| Animations | `A_<Char>_<Action>` | `A_Golfer_Swing_Full` |
| Audio | `SFX_<Category>_<Name>_<NN>`, `MUS_` | `SFX_Ball_Land_Sand_01` |
| Scenes | `Course_<Name>`, `Sandbox_<YourName>` | `Course_MeadowLinks` |

## 5. Level design workflow (per hole)

```
1. Paper sketch: top-down routes (safe vs risky), item box spots, convergence points, par estimate
2. Gray-box: ProBuilder blocks in a Sandbox scene: tees, fairway, cup, hazards (NO art)
3. Tag surfaces: SurfaceTag on colliders; HoleRoot with 8 tees, cup, par, intro spline
4. Validate: Bogey/Validate Hole (editor tool): tees, cup, bounds, kill volumes covering every fall-off edge
5. Playtest: solo practice (par realistic? 60–90 s?), then 4-player test (do players meet? pile-ups at tee?)
6. Iterate: repeat 2–5 until the hole is fun gray-boxed
7. Art pass: replace blocks with environment kit pieces, KEEP collision from the gray-box (or regenerate carefully)
8. Dressing and lighting: props, foliage (no colliders on small foliage), light probes, bake
9. Final check: performance (draw calls in budget), re-validate, re-playtest
```
**Rule:** gameplay geometry is finalized *before* art. Art never changes the collision of the play surface without a re-test.

**Editor tooling to build (worth it early):**
- Hole validator + scene gizmos (tees, cup, par label, bounds)
- "Test this hole" button: enters Practice on the selected HoleRoot
- Shot heatmap logger (dev builds record shot origin/landing → visualize where players struggle) [V1]

## 6. Audio pipeline
- Every sound is an `AudioCue` asset (clips with random pitch/volume) → designers swap clips without code changes.
- Surface-driven SFX: `SurfaceDefinition.fx` maps to landing/rolling/footstep cue sets.
- Music: menu theme, lobby loop, 1 track per course, results sting. [Later]: dynamic layers (intensity rises in FinishTimer) via FMOD.
- Mix check on cheap earbuds **and** headphones. Key gameplay cues (incoming mallet wind-up!) must cut through.

## 7. VFX language
| Meaning | Color | Example |
|---|---|---|
| Danger / hurts you | red/orange | Mallet wind-up arc, bomb fuse |
| Defensive | blue/cyan | Bubble shield |
| Ball effect | yellow/gold | Sticky Grip aura, Magnet trail |
| Player identity | player color | Ball trail, name tag, ring under feet |
Telegraphs (wind-ups) must be visible from 20 m and readable within 0.3 s.
