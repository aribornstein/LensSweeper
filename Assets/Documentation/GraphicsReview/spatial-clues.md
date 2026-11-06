# Spatial clue concepts

Source edit target: `02-flags.png` from original trailer. These are generated visual studies, not live game screenshots or approved implementation.

Built-in image generation; two independent edits from the same original frame.

Shared prompt constraints: preserve original camera, cyan board, grid, materials, environment, lighting, rails, toolbar and trailer header. Change only clue rendering. Keep cyan 1, amber 2, coral 3 at original tile centers. Remove dark number backplates; replace zero numerals with quiet floor dots. Use upright flat camera-facing text. No new UI, props, materials or effects.

Concept A prompt: low floating digits approximately 12 cm above each tile, small anchor dot and fine short stem. Modest type size contained within tile width.

Concept B prompt: taller floating digits approximately 25 cm above each tile, slender colored tether to a small circular floor footprint. Modest type size, retain cell ownership and test potential overlap.

Heights are design hypotheses for later runtime tuning. A still image cannot verify camera-facing behavior while moving, overlap across viewpoints, or on-device readability.

## Concept C: dimensional numerals

User feedback: A/B are better, but still feel flat. Edit target: `spatial-B-tall.png`.

Prompt: change only floating numeral geometry/material. Bold rounded 3D numeral meshes with extrusion about 20% of digit height, gently beveled edges, bright colored front faces, moderately darker colored sides and restrained edge highlights. Preserve original digit values, dimensions, floor anchors, colors, board, framing, environment and UI. No new props, bloom, reflections, platforms or background changes. Preserve zero dots. Show enough side/top facets to communicate volume while keeping faces readable.

Implementation would require numeral mesh assets or equivalent geometry. This is distinct from simply rotating flat text toward the camera. Material readability and camera-facing orientation require runtime validation.

## Implemented November 6, 2026

Implemented via native `Component.Text3D` with 0.2 em extrusion, a 27 cm floor-relative label center, per-clue colored caps and darker side faces, and a subtle fixed glyph tilt so depth is visible from the tracked viewing direction. The label parent faces the tracked camera every LateUpdate. Nonzero clues retain a stem and floor ring; zero cells use a small mint floor ring. Existing floor board and game rules are preserved. Native text geometry does not reproduce the generated concept's rounded bevel exactly.

Material and shader were created through Lens Studio's Text3D preset. Palette materials and marker mesh are shared across cells and difficulty rebuilds. No new Inspector wiring is needed.

Verification: TypeScript compilation and runtime startup passed. LEAF start-reachability, core-flow, and progression-placement scenarios passed. Core-flow now asserts actual extrusion, correct numeric values, depth testing, and camera-facing rotation before/after lateral viewer movement. Visual verification includes live gameplay, an isolated isometric numeral capture, and a lateral gameplay view. Glasses hardware was not available for verification.

Captures: `spatial-clues-implemented.png` and `spatial-clues-side-view.png` are actual Lens Studio preview captures, not generated concepts.
