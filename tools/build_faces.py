"""Face icons from the illustrated character cut-outs.

assets/chars/<id>.png (full figure)  ->  assets/chars/face-<id>.png (96x96 head-and-shoulders)

The head is found from the top of the figure: the crown (first opaque rows) gives its centre, and
the opaque run through that centre on each row of the head band gives its width (so a raised gun
or a claw beside the head is ignored). The crop is a square around the head with a little of the
shoulders, which keeps tiny profession / zombie icons readable.

    python3 tools/build_faces.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'chars')
OUT = 96
# hand-tuned crops (x centre, top, side) where the automatic head finder is fooled
OVERRIDE = {
    'crawler': (0.36, 0.0, 0.62),
}


def run_through(px, w, y, cx):
    """Opaque run on row y containing (or nearest to) column cx."""
    xs = [x for x in range(w) if px[x, y] > 60]
    if not xs:
        return None
    if px[cx, y] <= 60:
        cx = min(xs, key=lambda x: abs(x - cx))
    x0 = cx
    while x0 > 0 and px[x0 - 1, y] > 60:
        x0 -= 1
    x1 = cx
    while x1 < w - 1 and px[x1 + 1, y] > 60:
        x1 += 1
    return x0, x1


def face_box(im, name):
    w, h = im.size
    if name in OVERRIDE:
        fx, fy, fs = OVERRIDE[name]
        side = fs * h
        return fx * w - side / 2, fy * h, side
    a = im.split()[3].load()
    top = next(y for y in range(h) if any(a[x, y] > 60 for x in range(w)))
    crown = [x for y in range(top, min(h, top + 8)) for x in range(w) if a[x, y] > 60]
    cx = int(sum(crown) / len(crown))
    lo, hi = w, 0
    for y in range(top, min(h, top + int(.34 * h))):
        r = run_through(a, w, y, cx)
        if not r:
            continue
        x0, x1 = max(r[0], cx - int(.42 * w)), min(r[1], cx + int(.42 * w))
        lo, hi = min(lo, x0), max(hi, x1)
    side = max((hi - lo) * 1.2, .38 * h)
    return (lo + hi) / 2 - side / 2, top - .03 * side, side


def build(name):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    x, y, side = face_box(im, name)
    s = int(round(side))
    canvas = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    canvas.paste(im, (int(round(-x)), int(round(-y))), im)
    face = canvas.resize((OUT, OUT), Image.LANCZOS)
    face.save(os.path.join(SRC, 'face-' + name + '.png'), optimize=True)


def main():
    names = sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png') and not f.startswith('face-'))
    for n in names:
        build(n)
    print('faces:', len(names))


if __name__ == '__main__':
    main()
