"""Mechanically extract six generated storyboard cells into looping GIFs.

No drawing, interpolation, or generated-image retouching is performed.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
STUDIES = [
    ("01-floor-reveal", [600, 220, 180, 220, 260, 1400]),
    ("02-mine-hit", [600, 280, 180, 200, 420, 1500]),
    ("03-round-over", [600, 250, 300, 300, 350, 1800]),
]

for name, durations in STUDIES:
    source = ROOT / f"{name}-keyframes.png"
    if not source.exists():
        continue
    sheet = Image.open(source).convert("RGB")
    width, height = sheet.size
    assert width % 3 == 0 and height % 2 == 0, sheet.size
    palette = sheet.quantize(colors=240, method=Image.Quantize.MEDIANCUT)
    # Preserve tiny bright AR marks that otherwise lose their hue when the
    # palette is dominated by the much larger gray pavement/background.
    accent_colors = [(251,112,101), (238,103,95), (224,99,90), (202,88,83),
                     (241,159,143), (223,145,132), (252,220,104), (246,212,91),
                     (255,240,130), (177,241,248), (137,215,225), (91,178,194),
                     (255,255,255), (227,248,250), (126,188,206), (191,237,241)]
    palette.putpalette(palette.getpalette()[:720] + [c for color in accent_colors for c in color])
    frames = []
    for index in range(6):
        column, row = index % 3, index // 3
        frame = sheet.crop((column * width // 3, row * height // 2,
                            (column + 1) * width // 3, (row + 1) * height // 2))
        frames.append(frame.quantize(palette=palette, dither=Image.Dither.NONE))
    target = ROOT / f"{name}-concept.gif"
    frames[0].save(target, save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, disposal=2, optimize=False)
    with Image.open(target) as check:
        assert check.n_frames == 6
        assert check.size == (width // 3, height // 2)
        assert check.info["loop"] == 0
        total = 0
        for index in range(check.n_frames):
            check.seek(index)
            total += check.info["duration"]
        assert total == sum(durations)
    print(f"{target.name}: six {width // 3}x{height // 2} frames, {total}ms loop, {target.stat().st_size} bytes")
