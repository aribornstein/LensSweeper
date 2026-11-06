# Flag and mine animation proposal

Status: approved by the user and implemented November 6, 2026.

## Visual direction

Retain the cyan floor board and dimensional camera-facing clues. Give props similarly simple dimensional silhouettes and contrasting face shading. Flags are deliberate and satisfying; mine hits are fast and surprising. Effects remain anchored to the affected cell.

## Flag

Proposed mesh: broad red triangular pennant with shallow thickness and two folded facets, pale slender pole, small coral tip, simple floor anchor. Keep height around 30–38 cm and pennant width 14–18 cm as starting hypotheses; tune against the existing 27 cm clue centers. Flag orientation should remain identifiable from both sides, independent from the clue billboards.

Suggested runtime timing:

- 0–80 ms: anchor appears.
- 80–180 ms: pole extends from the tile.
- 180–320 ms: pennant unfolds, slightly overshoots.
- 320–500 ms: pennant settles; one floor confirmation ring expands and fades.
- Idle: small, slow pennant deformation or rotation; no continual particle effect.
- Unflag: reverse fold/retract in 180–250 ms; cancel any pending deployment cleanly.

## Mine and hit effect

Proposed mesh: faceted charcoal core with six short coral-tipped studs and a small orange fuse indicator. Geometry and side shading communicate volume; avoid depending on dark surfaces to hide the real world.

Suggested runtime timing:

- 0–70 ms: mine appears; small core brightens.
- 70–150 ms: short anticipation/compression.
- 150–280 ms: compact angular burst, 8–12 fragments and up to four sparks.
- 200–650 ms: one floor-aligned ring expands to roughly 1–1.5 tile radii; fragments arc outward and shrink.
- 650–1000 ms: clear fragments; leave a small coral hit marker.
- Show the result panel after the main burst, around 600–800 ms; block further gameplay immediately when the mine is hit.

No screen-filling flash, camera shake, opaque smoke or persistent debris. Keep neighboring clues readable. Other mines can reveal with a restrained pulse, rather than every mine exploding simultaneously.

## Implementation after visual approval

1. Replace/refine flag and mine meshes first; verify static silhouettes beside the spatial clues.
2. Add a per-flag deploy/idle/retract state machine, respecting rapid toggle and restart.
3. Replace current four-bar shockwave and box flash with one floor ring, compact burst and pooled fragments. Existing code has 24 cube particles and depth-disabled effects; review depth testing rather than copying those defaults.
4. Coordinate audio accents and result-panel timing.
5. Verify first flag, quick flag/unflag, mine hit, replay during an effect, and all difficulty presets. Compare at normal trailer size and from multiple viewing angles.

## Generation and deliverables

No dedicated GIF/video generator is exposed in this session. Use the built-in image generator for two six-keyframe contact sheets, then mechanically extract equal cells and encode looping GIF animatics with ffmpeg. These show state progression with held frames; they do not establish final easing, continuous motion, frame rate or device performance. All images are concept studies, not captured gameplay.

Flag prompt: six aligned frames of the same tile, red faceted pennant, pole rise, unfurl, overshoot, confirmation ring, settled state; preserve cyan board, dimensional neighboring clues and real pavement.

Mine prompt: six aligned frames of the same tile, faceted studded core, anticipation, compact angular burst, eight fragments, expanding floor ring, fade and coral X marker; preserve neighboring clues and pavement, no smoke or screen flash.

The first mine-sheet request was rejected by the image tool's violence filter. The produced replacement is an explicitly abstract arcade wrong-answer effect: a coral crystal squashes, pops into eight geometric pieces with a compact star-shaped center, then a floor ring expands and fades to an X marker. The mine mesh itself remains a written proposal, not an approved generated asset.

Deliverables: `flag-deploy-keyframes.png`, `flag-deploy-concept.gif`, `mine-burst-keyframes.png`, `mine-burst-concept.gif`. GIFs hold six AI-generated poses at a deliberately slowed review pace (about 250 ms per transition, with a final hold). Runtime timing proposed above is considerably faster. Minor frame-to-frame image drift is a generation artifact, not proposed camera or board animation. Do not interpret raster shading, shadows or background changes as implementation requirements.

## Implementation

`StepSweeperBoardEffects.ts` creates shared faceted prop meshes and shaded unlit palettes. Deployment lasts 0.5 s and retraction 0.22 s; reversals start from current progress. The revised flag has a double-sided triangular cloth mesh with twelve longitudinal subdivisions. Two traveling waves deform its free edge while the mast seam stays fixed. Only visible flags update their vertices, capped at 30 updates per second; topology is created once. This is an authored wind animation, not a physics simulation.

The implemented mine follows the approved abstract crystal study. Only the struck crystal bursts. The revised reusable burst contains twelve elongated fragments, six sparks, a cream faceted star facing the player, and two staggered depth-tested floor rings. The flash lasts about 0.09–0.43 s; fragments clear by about 1.1 s, leaving a coral X. Restart clears all burst state. The loss card waits 0.95 s, guarded by round generation and canceled on restart; game input stops immediately. Wins add a 0.95 s mint floor sweep. Existing audio is reused.

The revised result card appears 170 cm in front of the current viewer and stays world anchored. Mint indicates a win; coral indicates a loss. It shows earned score (or tiles cleared when no score is recorded), separate time/steps/flags, local record information, a wide replay button, and a secondary change-mode action. Preview debug-forced wins do not earn or persist scores.

Visual verification: revised captures are `flag-wave-gameplay.png`, `burst-refined-032.png`, `burst-refined-060.png`, `victory-result-refined.png`, and `loss-result-refined.png`. Burst images use a LEAF render fixture holding production geometry at a fixed pose; they are not live explosion timing captures. Gameplay timing and cleanup are checked separately. The result captures use debug-forced rounds.

LEAF coverage includes normal flagging, rapid flag/unflag/reflag, restart during deployment, depth-tested fragments, expanding shockwave, delayed result card, effect cleanup, restart during a burst, camera-facing clues, and difficulty rebuilding. Physical Specs hardware remains untested.
