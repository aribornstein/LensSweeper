# Controlled tile comparison

Baseline: `02-flags.png`, trailer at 00:16. User requested incremental refinement of the original visual style. Earlier redesigns v1 and v2 are rejected.

Method: built-in image generation, separate edits referencing the same original frame.

Variant A prompt: Make only the existing internal cyan tile boundary lines uniform, crisp and approximately 25% stronger. Preserve camera, scene, lighting, crop, board topology, materials, numbered backplates, all numbers including zeros, rails, title, toolbar and cursor. Do not add props, UI, bevels, shadows, reflections, bloom or effects.

Variant B prompt: Keep unrevealed cells unchanged; lighten existing revealed numbered cells with approximately 15% brighter cyan while preserving pavement visibility. Preserve camera, scene, crop, board topology, exact numbers and backplates, rails, title, toolbar and cursor. Do not add props, UI, bevels, shadows, reflections, bloom or effects.

These are visual proposals for comparison, not captured runtime changes or approved implementation. Generative edits may drift despite invariance instructions; judge that explicitly against the original before approval.

Outputs: `tiles-A-clean-borders.png` and `tiles-B-reveal-contrast.png`. Visual review: both retain the original composition, visible numbers and cyan board identity substantially better than rejected concepts. A strengthens the grid noticeably, potentially making it too dominant. B retains the quieter lines and provides a modest state-contrast change. Neither is a pixel-identical edit: generation changes image resolution and small background details. Compare material direction only. No implementation changes were made.
