# Preview movement diagnosis — November 6, 2026

The board was stationary in world space, but its plane did not match the Sunlit Outdoor pavement. The Preview fallback used `camera.y - 150` at startup and recenter. The camera had also been left lowered for a flag close-up. Restarting or recentering from that height moved the board's floor below the normal environment floor. Even at the default pose, the old estimate produced different parallax from the pavement.

Preview now uses an explicit world floor Y, calibrated to −170 cm for this environment. Camera position and heading still determine horizontal placement when explicitly placing/recentering. During play, no camera-follow transform is applied. On device, World Query continues to place against the real detected surface.

Verification:

- Moving the native Preview camera 37 cm sideways changed camera X from 0 to 37; the board stayed at `(0, -170, -340)` with the same rotation, and cell 2,2 stayed at `(25, -170, -365)`.
- Rebuilding and recentering with the camera raised to Y=45 kept board Y at −170. The progression/placement scenario asserts this fixed floor height.
- Native Preview camera movement onto neighboring cells produced `PLAYER 0,2` and `PLAYER 1,2`; the first entry revealed safe cells. Tracking works independently of the simulated-movement buttons.
- Before/after pavement-image matching indicated a substantial reduction in differential parallax after calibration. This is a visual calibration for Sunlit Outdoor, not a universal floor estimate for every Preview environment.
- Direct runtime camera-transform writes in a test are overwritten by device tracking; native Preview camera movement was used for the movement checks above.

Reset the Interactive Preview camera before a new demonstration. Changing environment may require adjusting `emulatorFloorY` in the Inspector. Physical Specs tracking was not tested during this diagnosis.
