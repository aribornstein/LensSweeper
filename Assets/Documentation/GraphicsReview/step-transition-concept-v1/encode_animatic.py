"""Encode image-generated storyboard cells as a slowed review GIF."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parent
sheet = Image.open(root / "step-transition-keyframes.png").convert("RGB")
w, h = sheet.size
assert w % 3 == 0 and h % 2 == 0
palette = sheet.quantize(colors=240, method=Image.Quantize.MEDIANCUT)
accents = [(251,112,101),(238,103,95),(224,99,90),(202,88,83),
           (241,159,143),(223,145,132),(252,220,104),(246,212,91),
           (255,240,130),(177,241,248),(137,215,225),(91,178,194),
           (255,255,255),(227,248,250),(126,188,206),(191,237,241)]
palette.putpalette(palette.getpalette()[:720] + [c for rgb in accents for c in rgb])
frames = []
for i in range(6):
    x, y = i % 3, i // 3
    crop = sheet.crop((x*w//3, y*h//2, (x+1)*w//3, (y+1)*h//2))
    frames.append(crop.quantize(palette=palette, dither=Image.Dither.NONE))
durations = [650, 240, 200, 300, 320, 1450]
target = root / "step-transition-concept.gif"
frames[0].save(target, save_all=True, append_images=frames[1:],
               duration=durations, loop=0, disposal=2, optimize=False)
with Image.open(target) as check:
    assert check.n_frames == 6
    assert check.info["loop"] == 0
    assert check.size == (w//3, h//2)
    total = 0
    for i in range(6):
        check.seek(i)
        total += check.info["duration"]
    assert total == sum(durations)
print(f"{target}: 6 frames, {w//3}x{h//2}, {total}ms, {target.stat().st_size} bytes")

