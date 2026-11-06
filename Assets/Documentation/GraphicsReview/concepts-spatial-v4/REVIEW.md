# Lens Sweeper — room-scale concept review

Status: the user approved a trial implementation. See `../spatial-v4-implemented/IMPLEMENTATION.md` for changes, captures and verification. The GIFs below remain generated concept studies rather than gameplay footage.

## Current visual problems

- Wide saturated red tile fills dominate both clues and the struck cell. Several equal red areas make the cause of the loss hard to identify.
- Small diamond mines resemble collectibles. A recognizable spherical studded silhouette gives the hit sequence a clearer subject.
- Overlapping translucent rails produce distracting stripes, and near-uniform blue cell faces weaken the covered/revealed distinction.
- The existing result card occupies a large part of the view. Large progress figures, multiple text rows and a weak replay button compete with the board.
- The first proposed redesign overcorrected toward raised plastic caps and a small enclosing frame. The user rejected its tabletop/minigame character. That is a superseded direction, not the recommendation.

## Revised direction

The real floor is the play space. Preserve the full 3m footprint, 50cm cells, existing camera-facing extruded clues and waving flags. The camera is the standing player's viewpoint, with near cells extending out of view. Thin cyan floor-corner marks and quiet washes communicate cell states. Remove chunky corner towers and stacked rails. Do not shrink the game into a tray that fits entirely in the view.

Only the struck cell owns the strong coral accent. A brief, readable spherical mine silhouette precedes the compact breakup. Pieces clear quickly; other mine positions use small points or rings. Keep spatial clues readable throughout.

The result state uses a compact, softly rounded spatial panel with sentence-case type and one replay action. It groups the result and useful stats without taking over the floor. It is placed once in the player's view and then world anchored. Use native UIKit and comfortable target sizes; do not copy arbitrary generated panel dimensions.

## GIF studies

1. **01-floor-reveal-concept.gif:** selected-cell corners brighten, a scan crosses the cell, the floor wash clears and the spatial clue rises. Six held frames, 2.88s review loop.
2. **02-mine-hit-concept.gif:** selected-cell warning, recognizable mine, brief anticipation, compact breakup, clearing ring and settled impact marker. Six held frames, 3.18s review loop.
3. **03-round-over-concept.gif:** impact settles, compact panel appears, result and summary arrive, replay receives a restrained highlight. Six held frames, 3.60s review loop.

Generated with the built-in image-generation tool. GIFs are mechanically extracted from three-by-two generated contact sheets using one shared palette per sheet. They are keyframe animatics, not smooth video, gameplay captures, performance demonstrations, or finalized easing. Review pace is deliberately slower than the intended hit animation. Small frame-to-frame generation drift and painterly shading are not requirements. The faint coral wash inherited by the first floor-reveal sheet is not a proposed idle-state fill; the mine-hit and round-over sheets show the intended quiet floor treatment.

## Practical implementation targets after design approval

- Shared floor marker geometry and one shallow, controlled per-state wash. Keep the actual difficulty grids and tracking behavior.
- Shared low-poly mine mesh and pooled, depth-tested pieces. One brief flash and floor ring, no persistent debris or environmental lighting requirements.
- Use front/side shading to preserve volume on additive displays. Do not depend on black surfaces, real-world blur, cast shadows, reflections, or heavy bloom.
- UIKit for the result panel and replay action; maintain target sizes and test against bright outdoor backgrounds.
- Validate first-person scale on device and in a trailer-sized capture. Verify board anchoring and walking movement again before changing placement-related visuals.

The earlier `concepts-v3` images are retained as superseded studies and should not be implemented.

