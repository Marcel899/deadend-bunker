"""Cut the minigame sprite sheets (assets/src/mg_*.webp) into assets/mg/<name>.png.

Run from the project root:  python tools/cut_mg.py [--preview]
The sheets have a transparent background; every sprite is a connected blob (parts a couple of px
apart are merged). Blobs are numbered in reading order. A few sprites touch their neighbours on the
sheet (the portraits, the stacked scrolls and buttons, two bins): those are split along the
transparent rows / columns between them, or cut from a box.
--preview writes a numbered contact sheet per sheet to assets/mg/preview/ to extend NAMES.
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'src'); OUT = os.path.join(ROOT, 'assets', 'mg')

def load(sheet):
    a = np.asarray(Image.open(os.path.join(SRC, sheet + '.webp')).convert('RGBA')).copy()
    a[a[..., 3] < 20] = 0
    return a

def blobs(a, merge=2):
    fg = a[..., 3] > 0
    lab, _ = ndimage.label(ndimage.binary_dilation(fg, iterations=merge))
    res = []
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if (sl[0].stop - sl[0].start) * (sl[1].stop - sl[1].start) < 300: continue
        crop = a[sl].copy(); crop[lab[sl] != i] = 0
        res.append(((sl[0].start + sl[0].stop) / 2, sl[1].start, crop))
    res.sort(key=lambda r: r[0]); rows = []
    for r in res:
        if rows and abs(rows[-1][-1][0] - r[0]) < 40: rows[-1].append(r)
        else: rows.append([r])
    return [r[2] for row in rows for r in sorted(row, key=lambda r: r[1])]

def split(crop, axis, min_gap=1):
    """Pieces of a crop separated by fully transparent rows (axis 0) or columns (axis 1)."""
    filled = (crop[..., 3] > 0).any(axis=1 - axis)
    out, start = [], None
    for i, f in enumerate(list(filled) + [False]):
        if f and start is None: start = i
        if not f and start is not None:
            if i - start > 4: out.append(crop[start:i] if axis == 0 else crop[:, start:i])
            start = None
    return out

def grid(crop, cols, rows):
    """Even grid cut (figures that touch); each cell keeps its largest blob plus attached bits."""
    h, w = crop.shape[:2]; out = []
    for r in range(rows):
        for c in range(cols):
            cell = crop[h * r // rows:h * (r + 1) // rows, w * c // cols:w * (c + 1) // cols].copy()
            lab, n = ndimage.label(cell[..., 3] > 0)
            if n > 1:
                sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
                cell[~np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * .15])] = 0
            out.append(cell)
    return out

def stack(crop, n):
    """n pieces stacked top to bottom that touch: cut at the emptiest row near each even boundary,
    then keep each piece's main blob (drops the neighbour's edge that spilled over)."""
    h = crop.shape[0]; rows = (crop[..., 3] > 0).sum(axis=1); cuts = [0]
    for k in range(1, n):
        lo, hi = int(h * (k - .25) / n), int(h * (k + .25) / n); cuts.append(lo + int(np.argmin(rows[lo:hi])))
    cuts.append(h)
    return [grid(crop[cuts[k]:cuts[k + 1]], 1, 1)[0] for k in range(n)]

def trim(crop):
    im = Image.fromarray(crop.astype('uint8')); b = im.getbbox(); return im.crop(b) if b else im

# sheet -> {index: name}; a tuple value (name list, how) splits that blob first
NAMES = {
  'mg_forge': {1: 'anvil', 2: 'hammer', 3: 'slot', 5: 'arrow', 8: (['scroll_sword', 'scroll_pistol', 'scroll_vest', 'scroll_helmet'], 'even'),
               9: 'btn_hammer', 10: 'anvil_base', 11: 'pillar', 14: 'plank'},
  'mg_workshop': {0: 'gun_cabinet', 1: 'rifle_rack', 2: 'ammo_cabinet', 3: 'armor_plate', 4: 'armor_vest', 5: 'armor_riot', 8: 'furnace_stone', 9: 'furnace_iron',
                  12: 'grindstone', 13: 'toolbench', 17: 'hearth', 19: 'helmet_shelf', 21: 'barrels', 22: 'drum', 23: 'generator', 25: 'gas_bottles'},
  'mg_medical': {1: 'scanner', 3: 'clipboard', 7: 'bed', 10: 'medkit', 11: 'medkit_white', 12: 'bandage', 13: 'plaster', 14: 'syringe', 15: 'gauze', 16: 'pills_small',
                 17: 'bottle', 18: 'pills', 21: 'stethoscope', 23: 'ecg_cart', 24: 'defib_unit', 30: 'monitor', 31: 'defib',
                 25: (['btn_bandage', 'btn_syringe', 'btn_cross', 'btn_pills', 'btn_bed'], 'even'), 26: (['ico_heart', 'ico_blood'], 'icons'),
                 35: 'plus', 38: 'blood', 39: 'fever', 40: 'skull', 41: 'biohazard', 42: 'warning', 43: 'alert'},
  'mg_items': {0: 'crate', 1: 'crate_open', 3: 'crate_mil', 4: 'box_grey', 5: 'box_blue', 6: (['bin_blue', 'bin_red'], 'cols'), 7: 'bin_green', 8: 'crate_hazard', 9: 'crate2',
               12: 'can_tomato', 13: 'can_fish', 14: 'water_bottle', 15: 'medkit_small', 16: 'bandage_roll', 17: 'tape', 18: 'firstaid', 19: 'metal_bars', 20: 'gear',
               21: 'circuit', 22: 'battery', 23: 'leaky_can', 24: 'cartridge', 25: 'bullets', 26: 'grenade', 27: 'grenade2', 28: 'jerrycan', 29: 'hammer_s', 30: 'wrench',
               31: 'pliers', 32: 'screwdriver', 35: 'crowbar', 36: 'shovel', 38: 'pistol', 39: 'ak', 40: 'shotgun', 41: 'smg', 44: 'machete', 48: 'tire',
               49: 'rad_barrel', 50: 'crystal_blue', 51: 'crystal_purple', 52: 'canister_blue', 53: 'alien_device', 54: 'rad_canister', 55: 'water_jug', 56: 'fuel_can',
               57: 'rad_box', 58: 'fuel_yellow', 59: 'cell_green', 60: 'box_tech', 62: 'cell_blue', 65: 'orb',
               70: 'star_grey', 74: 'star_gold', 82: 'trophy', 83: 'crown', 86: 'burst', 87: 'bolt', 88: 'skull_red', 93: 'tick', 94: 'star_x5', 95: 'stopwatch',
               104: 'ok', 105: 'no', 113: 'crosshair', 116: 'crosshair_dark', 117: 'skull'},
  'mg_radio': {0: 'radio_set', 7: 'radio_speaker', 8: 'mast', 10: 'rocker_off', 11: 'rocker_on', 16: 'knob', 18: 'knob2', 31: 'dish', 32: 'antenna',
               33: 'vu', 36: 'ledbar', 39: 'screen', 44: 'led_green', 46: 'led_yellow', 47: 'led_red', 54: 'static', 55: 'wave_green', 56: 'wave_orange',
               61: 'fader', 63: 'fader_orange', 74: 'led_off', 77: 'speaker', 78: 'led_glow', 98: 'mic', 99: 'tower_ok', 102: 'lock', 105: 'tower_lost'},
}
# cut from a box (x0, y0, x1, y1) because they touch something else on the sheet
BOXES = {'mg_forge': {'furnace': (0, 512, 345, 853)}}
# the ten patient portraits: two rows of five that touch each other
FACES = ('mg_medical', (628, 0, 1280, 335), 5, 2)
MAX = {'default': 160, 'furnace': 300, 'gun_cabinet': 256, 'rifle_rack': 256, 'ammo_cabinet': 256, 'scanner': 256, 'clipboard': 256, 'monitor': 256, 'radio_set': 256,
       'anvil_base': 256, 'hearth': 256, 'generator': 200, 'screen': 256, 'vu': 200, 'fader': 256, 'fader_orange': 256, 'ledbar': 256, 'plank': 300, 'scroll_sword': 220}

def save(img, name):
    m = MAX.get(name, MAX['default']); img = img.copy(); img.thumbnail((m, m), Image.LANCZOS)
    # a 256-colour palette with alpha: a third of the size, no visible difference at game sizes
    img.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(os.path.join(OUT, name + '.png'), optimize=True)

def preview(sheet, items):
    S, cols = 96, 14; rows = (len(items) + cols - 1) // cols
    sh = Image.new('RGB', (cols * S, rows * (S + 14)), (52, 48, 64)); d = ImageDraw.Draw(sh)
    for k, c in enumerate(items):
        t = trim(c); t.thumbnail((S - 8, S - 8)); x, y = (k % cols) * S, (k // cols) * (S + 14)
        sh.paste(t, (x + 4, y + 2), t); d.text((x + 3, y + S - 2), str(k), fill=(255, 230, 120))
    os.makedirs(os.path.join(OUT, 'preview'), exist_ok=True); sh.save(os.path.join(OUT, 'preview', sheet + '.png'))

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); n = 0
    for sheet, names in NAMES.items():
        a = load(sheet); items = blobs(a)
        if '--preview' in sys.argv: preview(sheet, items)
        for k, name in names.items():
            if isinstance(name, tuple):
                names2, how = name
                if how == 'icons':   # the small icons left of the bars: separate blobs, top to bottom
                    c = items[k]; lab, m = ndimage.label(c[..., 3] > 0); parts = []
                    for i, sl in enumerate(ndimage.find_objects(lab), 1):
                        if sl[1].start < c.shape[1] * .2 and (sl[0].stop - sl[0].start) > 12: p = c[sl].copy(); p[lab[sl] != i] = 0; parts.append((sl[0].start, p))
                    pieces = [p for _, p in sorted(parts, key=lambda q: q[0])]
                elif how == 'even': pieces = stack(items[k], len(names2))
                else: pieces = split(items[k], 0 if how == 'rows' else 1)
                for nm, p in zip(names2, pieces): save(trim(p), nm); n += 1
            else: save(trim(items[k]), name); n += 1
        for name, (x0, y0, x1, y1) in BOXES.get(sheet, {}).items(): save(trim(grid(a[y0:y1, x0:x1], 1, 1)[0]), name); n += 1
    sheet, (x0, y0, x1, y1), cols, rows = FACES
    a = load(sheet); reg = a[y0:y1, x0:x1]; ys, xs = np.where(reg[..., 3] > 0); reg = reg[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    for k, cell in enumerate(grid(reg, cols, rows)): save(trim(cell), 'face%d' % k); n += 1
    cur = Image.open(os.path.join(OUT, 'crosshair.png')).convert('RGBA'); cur.thumbnail((36, 36), Image.LANCZOS); cur.save(os.path.join(OUT, 'cursor.png'), optimize=True); n += 1   # the range's mouse cursor
    print(n, 'sprites written to assets/mg')
