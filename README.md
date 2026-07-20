# Hookline Rush

The complete player-facing game now defaults to Simplified Chinese (`zh-CN`) under the title **钩索疾驰**. Player-facing strings live in `src/game/i18n.ts`; internal identifiers and developer-only debug labels remain English.

Hookline Rush is a polished browser-game vertical slice about running, jumping, prone crawling, wall jumps, physical grappling, hazards, enemies, and a one-slot cooldown ability. It is built with strict TypeScript, Phaser 3, Matter physics, and Vite.

Everything is original and code-drawn. The game has no backend, remote assets, accounts, or network dependency after installation.

## Run it

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Other useful commands:

```bash
npm run typecheck   # strict TypeScript check
npm run lint        # ESLint
npm test            # deterministic Vitest suite
npm run build       # typecheck + production bundle
npm run preview     # serve the production bundle locally
npm run check       # all checks in sequence
```

## Modes and content

- **Single Player Stage Run** uses one full-screen course. Falls cost HP and recover at the latest safe checkpoint. The run ends only at 0 HP.
- **Two Player Local Race** uses equal left/right full-height viewports, two cameras, independent physics categories, isolated entity arrays, and the same immutable stage blueprint/seed. The full-height framing keeps grapple anchors and vertical routes visible while each side retains its own HUD, countdown, progress, and timer. A 0-HP racer returns to the stage start at full health and loses the held skill; the opponent continues.
- **Momentum Lab** is an expanded interactive route that teaches one mechanic at a time, then combines prone corridors, moving-platform low routes, grapples, and Impact Dash.
- **Neon Rooftops** now opens with a readable jump cadence before combining prone tunnels, visible grapple pits, moving trains, drones, lasers, and alternate elevated routes.
- **Arcane Foundry** uses jump-reachable conveyors, protected takeoff/landing zones, crushers, flame jets, fragile floors, rotating blades, and cooldown routing.
- **Gravity Ruins** uses clearly marked pit edges, consistently selectable moving anchors, recovery landings, gravity/wind fields, disappearing platforms, and Temporary Anchor.
- Five shared data presets range from Beginner to Nightmare. They change hazard timing, enemy cadence, damage, grapple assistance, healing, timing windows, and cooldowns without duplicating level files.

The six registered abilities are Impact Dash, Energy Bolt, Energy Shield, Freeze Pulse, Ground Slam, and Temporary Anchor. Pickups replace the current skill immediately; there is no inventory or extra combat button.

Implemented danger set: spikes, pits, low prone tunnels, cracked walls, moving/disappearing/fragile/conveyor platforms, crushers, timed lasers, rotating blades, flame jets, gravity fields, and wind fields. Enemy archetypes are Charger, Flyer, Turret, and Armored Blocker.

## Controls

Only directional input plus Jump, Grapple, and Skill are used during play.

| Action                                         | Player 1 | Player 2      | Gamepad             |
| ---------------------------------------------- | -------- | ------------- | ------------------- |
| Move / grapple bias / prone crawl / fast-fall  | `WASD`   | Arrow keys    | Left stick or D-pad |
| Small jump / double-tap large jump / wall jump | `Space`  | `Right Shift` | A / Cross           |
| Grapple (hold, release to detach)              | `E`      | `Enter`       | Right Trigger       |
| Skill                                          | `Q`      | `/`           | X / Square          |
| Pause                                          | `Esc`    | `Esc`         | Start / Menu        |

Race setup supports shared keyboard, keyboard plus gamepad, or two gamepads. If an assigned gamepad disconnects, that player receives a readable warning and falls back to the corresponding keyboard layout; reconnecting is detected by polling the browser gamepad list.

The first jump press launches immediately at the small-jump velocity. A real release followed by a second press within 220 ms upgrades the same rising jump once; holding, keyboard repeat, late taps, and third taps cannot stack height. Wall jump remains one fixed moderate jump because applying the upgrade there made repeated wall contact less predictable. Coyote time is 110 ms and jump buffering is 130 ms.

Low-profile movement uses one explicit `Prone` state. Grounded Down immediately removes running momentum and enters a controlled 92 px/s prone crawl; airborne Down remains fast-fall. The existing Matter body keeps a 64 px standing height and switches to a 26 px prone height while its horizontal contact width follows the current articulated silhouette (about 19 px while idle, expanding through running/jumping poses, and about 59 px while prone). Foot position, velocity, collision filters, owner, constraints, and listeners are preserved; no body is recreated. Releasing Down restores the standing height only after a Matter region query confirms headroom, while jumping from prone restores it before takeoff.

Movement values are centralized in `MOVEMENT` and expressed in pixels per second. With the current 64 px tile reference, grounded and airborne directional movement both reach about 4.45 tiles/s with the same acceleration and reversal response. Full speed is reached in about 0.18 s, while grounded release still stops within about 0.41 tile so platform positioning remains controllable. Grapple/skill momentum, knockback, soft damping, and emergency caps remain separately bounded. Core movement speed does not vary by difficulty.

## Architecture

```text
src/game/
  core/       deterministic movement/jump/input state, RNG, health, targeting, persistence
  entities/   Matter-backed player avatar and movement state
  levels/     immutable blueprints, seeded materialization, development validation
  scenes/     boot, menu, stage select, controls/settings, gameplay, results
  systems/    audio, input, ability registry, isolated course runtime
  ui/         HUD, cooldown display, menu primitives
  visuals/    articulated player rig and runtime pose rendering
  config.ts   centralized movement, grapple, damage, ability, difficulty, and color tuning
tests/        deterministic regression coverage
```

`GameplayScene` owns flow, countdown, pausing, cameras, and results. Each `CourseRuntime` owns exactly one player and all anchors, hazards, enemies, pickups, projectiles, effects, timers, and HUD state for that course. Race courses use different Matter collision categories and different Phaser layers. Each race camera ignores the other course layer, while a third overlay camera renders the shared central progress divider. Effects never receive a reference to the other course.

The visible player is a lightweight articulated rig layered over the hidden Matter collision body. Head, torso, upper/lower arms, and upper/lower legs are positioned and rotated independently from interpolated keyframe clips for idle, running, prone crawling, jumping, grappling, slamming, and knockback. Every frame recenters its visible horizontal bounds on a pose-width Matter collider with only a 0.1 px contact skin per side; feet remain aligned to the collider floor, and the rope begins at the front hand rather than crossing the torso. Damage checks use the visible player bounds plus the actual filled geometry of triangular spikes/chargers, star blades, elliptical projectiles, and multipart enemies instead of the old broad body rectangle.

The rig now renders the original **Comet Courier** character: meteor helmet, asymmetrical courier jacket, armored grapple forearm, parkour shoes, and two speed-reactive energy scarf ribbons. The costume remains split at the existing joints, so the stronger silhouette and layered details do not replace or restrict any animation clip. The generated visual-development sheet is in `docs/concepts/comet-courier-concept.png`, and `docs/character-art-prompt.md` contains a reusable prompt and segmentation contract for future character variants.

Grapple target selection is a pure function: it filters activity/range/forward cone, rejects line segments occluded by solid rectangles, then scores forward and upward intent. The runtime turns the selected anchor into one Matter constraint and removes that constraint on release, recovery, death, finish, restart, and scene shutdown.

The ability registry in `src/game/systems/abilities.ts` is the extension boundary for the single active slot. `SkillSlot` owns equip/replacement/readiness; the registered activation receives a course-scoped capability context, which prevents cross-course effects.

## Add content

### Stage

1. Add a typed immutable `StageBlueprint` in `src/game/levels/stages.ts`.
2. Define platforms, anchors, hazards, enemies, pickups, checkpoints, and finish position in local stage coordinates.
3. Add the stage to `STAGES`; add it to `PLAYABLE_STAGE_IDS` only when it is complete.
4. Run `npm test`. Boot also calls `assertValidStage`, so duplicate IDs, invalid finish positions, missing checkpoints, and malformed skill pickups fail loudly in development.

Future-ready themes documented by the current schema are Frozen Sanctum, Jungle Ruins, Monster Nest, Collapsing Temple, Sky Fortress, Magma Core, and Digital Rift. They are deliberately not shown as empty menu entries.

### Ability

1. Add the ID to `AbilityId` in `src/game/types.ts`.
2. Add display/cooldown data to `ABILITIES` in `src/game/config.ts`.
3. Add one implementation to `ABILITY_REGISTRY` and expose only the minimal course-scoped capability it needs.
4. Place a typed skill pickup in a stage and add a deterministic test.

### Hazard or enemy

Add the new discriminant and data to the relevant typed spec, create its visual/body in `CourseRuntime`, and keep all mutable runtime state inside that `CourseRuntime`. Never use a global event or entity list for gameplay effects.

## Persistence, audio, and accessibility

Settings, tutorial completion, and solo best times by stage+difficulty are stored in one versioned `localStorage` record with bounded values and safe defaults. Movement update v2 preserves v1 preferences/tutorial completion but deliberately clears old best times because the new pacing makes them incompatible. The settings screen includes master/music/SFX volume, screen shake, reduced effects, debug overlay, and fullscreen. Audio uses lightweight original Web Audio oscillators for ambience and distinct interaction cues.

The optional debug overlay shows velocity, grounded state, current/selected grapple anchor, HP, cooldown information, and FPS. Reduced effects suppresses landing particles; hazards use consistent cyan/gold/red/green/violet interaction colors and avoid full-screen flashes.

## Verification and honest limitations

Automated coverage checks matching grounded/airborne directional response, prone crawl speed and momentum removal, immediate/double-tap jump behavior, input edge equivalence and player isolation, coyote/buffer timing, physical prone collider sizing/foot anchoring/filter retention, pose-width solid contact, filled-shape damage contact, pose-to-collider containment, headroom blocking and release, repeated prone/body stability, all authored low-tunnel clearances, exact small/large jump obstacle margins, visible pit coverage, takeoff runways, recovery landings, unobstructed grapple targeting, safe checkpoints, hazard variety, Chinese localization coverage/fallback, seeded equivalence, blueprint validation, health/failure rules, skills, course isolation, and versioned saves.

Browser visual QA was performed at 1280×720 for the Chinese title, controls, settings, solo stage selection, tutorial, race setup/device assignment, and live dual-camera split-screen. Runtime debug QA also verifies pose-driven horizontal contact widths, 64→26→64 height transitions, prone-to-airborne jumping, airborne Down/fast-fall exclusivity, restart cleanup, simultaneous two-player crawling, and one-player-only state isolation. See [MANUAL_QA.md](MANUAL_QA.md) for the exact status.

Current limitations:

- Visual QA used keyboard-fallback state for a missing physical gamepad; real two-gamepad hardware should receive a final platform-specific pass.
- The three main stages are intentionally compact vertical-slice routes (generally faster than the specification's 2–5 minute first-clear target once the controls are learned).
- Sound is synthesized ambience and feedback rather than a produced music soundtrack.
- Common projectiles are lightweight and short-lived but are not yet object-pooled; pooling is a sensible next step if later levels greatly increase projectile counts.

Highest-value follow-ups are a full two-gamepad couch playtest and animation tuning pass, produced audio layers, and route expansion with per-stage mastery medals/ghost splits.
