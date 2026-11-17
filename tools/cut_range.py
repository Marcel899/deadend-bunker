"""Cut the training-range art (assets/src/range_*.webp, white-backed JPEG renders) into assets/mg/.

Run from the project root:  python tools/cut_range.py
range_bg      -> range_bg.jpg (the room, resized)
range_gun     -> rg_gun.png   (first-person pistol, white background keyed out)
range_zombies -> rg_z0..2.png (three zombie targets, white background keyed out)
Only near-white pixels connected to the image border are removed, so whites inside the outlines
(eyes, teeth, the crosshair rings) stay.
"""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'src'); OUT = os.path.join(ROOT, 'assets', 'mg')

def key_white(img, thr=232):
    a = np.asarray(img.convert('RGBA')).copy()
    white = (a[..., :3].min(axis=2) >= thr)
    lab, _ = ndimage.label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    bg = ndimage.binary_dilation(bg, iterations=1) & (a[..., :3].min(axis=2) >= 200)  # eat the JPEG halo
    a[bg, 3] = 0
    return a

def trim(a, pad=2):
    ys, xs = np.nonzero(a[..., 3])
    return a[max(0, ys.min() - pad):ys.max() + pad + 1, max(0, xs.min() - pad):xs.max() + pad + 1]

def save(a, name, h):
    im = Image.fromarray(trim(a)); im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.png'), optimize=True); print(name, im.size)

bg = Image.open(os.path.join(SRC, 'range_bg.webp')).convert('RGB')
bg.resize((1200, round(1200 * bg.height / bg.width)), Image.LANCZOS).save(os.path.join(OUT, 'range_bg.jpg'), quality=84)
save(key_white(Image.open(os.path.join(SRC, 'range_gun.webp'))), 'rg_gun', 420)
z = key_white(Image.open(os.path.join(SRC, 'range_zombies.webp')))
w = z.shape[1]
for i, (x0, x1) in enumerate(((0, w // 3 + 10), (w // 3 + 10, 2 * w // 3 + 10), (2 * w // 3 + 10, w))):
    part = np.zeros_like(z); part[:, x0:x1] = z[:, x0:x1]
    lab, n = ndimage.label(part[..., 3] > 0); sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    keep = np.isin(lab, [k + 1 for k, s in enumerate(sizes) if s > 400]); part[~keep] = 0
    save(part, 'rg_z%d' % i, 300)
