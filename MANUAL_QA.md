# Manual QA status

Last verification: 2026-07-20

## Completed

- [x] Title screen renders at 1280×720 with readable hierarchy and working mouse navigation
- [x] Chinese controls and settings screens render without missing glyphs, clipping, or button overflow
- [x] Solo stage selection renders all stage/difficulty/best-time information without clipping
- [x] Tutorial shows separate safe small-jump and large-jump obstacles with concise Chinese prompts
- [x] Tutorial includes a physically prone-only low tunnel, prone-jump prompt, and moving-platform crawl corridor
- [x] Solo GameplayScene boots with Matter physics, player, course, anchors, hazards, HUD, timer, and local camera
- [x] Race setup changes device assignment and launches without page reload
- [x] Race renders P1 on the left and P2 on the right with equal full-height cameras/layers and a narrow central progress divider
- [x] Race countdown starts from a scene-local clock and the timer begins at zero after countdown
- [x] Keyboard + missing gamepad reports fallback only in the affected player's viewport
- [x] Grounded Down enters `prone` with a pose-matched ~59×26 px body and safely returns to `grounded-run`
- [x] Prone jump enters `airborne` with a pose-width × 64 px body; airborne Down remains fast-fall
- [x] Restarting while prone restores the pose-width × 64 px standing body
- [x] Both keyboard players can crawl simultaneously; either player's state can change without affecting the other
- [x] Grounded and airborne directional input share the same maximum speed, acceleration, and reversal response
- [x] Down plus direction produces controlled 92 px/s prone movement without retaining running momentum
- [x] Every articulated keyframe remains inside its active collider and aligns its lowest visible point to the collider floor
- [x] Horizontal solid contact follows the current visible pose with at most 0.1 px skin per side
- [x] Spikes, blades, enemies, and projectiles apply damage only when their filled geometry touches the visible player bounds
- [x] Tutorial cards use fixed dimensions, consistent spacing, and wrapped text without overlap at 1280×720
- [x] Expanded tutorial opening shows fair small/large jump obstacles and a clearly marked first grapple pit
- [x] Neon Rooftops, Arcane Foundry, and Gravity Ruins openings render with readable obstacle silhouettes and safe reaction space
- [x] Every ground gap has automated visible-pit, runway, landing, range, and unobstructed-grapple checks
- [x] Strict typecheck, lint, deterministic tests, and production build pass

## Hardware/manual pass still recommended

- [ ] Complete every stage end to end with a physical keyboard and tune edge cases in swing release, wall contact, slopes, ice, and prone clearance
- [ ] Measure small/large jump apex and stopping distance from captured frame data on a physical keyboard
- [ ] Repeat a full course at forced 30 Hz and on a 120 Hz display; deterministic movement tests already cover those integration steps mathematically
- [ ] Complete a race with two physical gamepads and verify disconnect/reconnect on Chrome, Firefox, and Safari
- [ ] Exercise every ability against every supported enemy/hazard counter in one continuous play session
- [ ] Verify death, fall recovery, race respawn, rematch, and result flows under repeated restarts
- [ ] Resize through ultrawide and 4:3 desktop windows and check fullscreen transitions

These unchecked items are not claimed as completed; they are the final feel/hardware QA pass for a continued production effort.
