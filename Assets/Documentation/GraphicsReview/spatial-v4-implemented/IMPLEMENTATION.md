# Room-scale visual trial

Implemented following the user's approval of the revised spatial concepts.

- Replaced tile slabs, chunky posts and layered hologram rails with floor corner marks, a shared quiet grid mesh and very subtle covered-cell washes. The difficulty dimensions, cell colliders and fixed Preview floor are preserved.
- Safe reveals scan across a cell and clear its wash as the existing extruded clue rises. Empty safe cells retain a small floor marker. Red pennants continue to wave.
- Other mine locations use small coral rings. Only the struck mine appears as a closed, faceted sphere with six blunt studs, then compresses and breaks apart. The burst pools eight pieces and four sparks, uses one fading floor ring and leaves a crossed-circle marker.
- The loss card waits 0.95 seconds. The result panel is 60×31 cm, placed 170 cm along the view direction and 22 cm above its center, then stays world anchored. It uses sentence-case text, a cleared-cell summary, concise stats and one cyan native UIKit replay button with hover/press states. Difficulty and music controls remain available in the gameplay UI.
- Typography, panel and floor colors, wash opacity, reveal duration and result placement remain tunable through existing roles and Inspector inputs. No image-generation output is used as a runtime texture or video.

Verification: all five LEAF Preview scenarios pass. Native Preview camera movement independently entered cells 0,2 and 1,2, while board and tile transforms stayed unchanged. A separate camera move confirmed the result panel also stays world anchored. The mine was inspected from front and back for closed geometry. Preview runtime logs contain no project script errors; device-link warnings are unrelated to local Preview execution.

Captures in this directory are actual Lens Studio renders. The mine anticipation and 0.32/0.60 second burst captures use a held production-effect fixture; they are not real-time explosion recordings. Result captures use debug-forced rounds after a normal first reveal. Hardware display readability and device performance still require a Specs pass.
