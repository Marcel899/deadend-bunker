"""Cut the furniture / weapon / tool sprite sheets in assets/src into individual transparent PNGs.

Run from the project root:  python tools/cut_sprites.py [--preview]
Background (near-white, connected to the sheet border) becomes transparent; each sprite is a
connected blob (fragments within a few px, e.g. a flame tip, are merged). Sprites are numbered in
reading order (row by row, left to right) and written to assets/sprites/<sheet>/<nn>.png.
NAMES below then copies the named ones to assets/sprites/<name>.png for the game to use.
"""
import os, sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'src'); OUT = os.path.join(ROOT, 'assets', 'sprites')

def cut(sheet):
    im = Image.open(os.path.join(SRC, sheet + '.webp')).convert('RGBA')
    a = np.asarray(im).astype(int)
    # the sheets already have an alpha channel; otherwise treat near-white border-connected pixels as background
    if (a[..., 3] < 20).mean() > 0.2:
        bg = a[..., 3] < 20; light = np.zeros_like(bg)
    else:
        light = (a[..., :3].min(axis=2) > 225) & ((a[..., :3].max(axis=2) - a[..., :3].min(axis=2)) < 22)
        lab, _ = ndimage.label(light)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        bg = np.isin(lab, list(border))
    fg = ndimage.binary_opening(~bg, iterations=1)
    blobs, n = ndimage.label(ndimage.binary_dilation(fg, iterations=1))
    out = np.asarray(im).copy(); out[bg] = (0, 0, 0, 0)
    # soften the cut edge: half-transparent ring of light pixels next to the background
    edge = ndimage.binary_dilation(bg) & ~bg & light
    out[edge, 3] = 110
    res = []
    for i, sl in enumerate(ndimage.find_objects(blobs), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h * w < 500: continue
        mask = (blobs[sl] == i) & fg[sl]
        crop = out[sl].copy(); crop[~mask & (crop[..., 3] > 0) & (blobs[sl] != i)] = 0
        res.append(((sl[0].start + sl[0].stop) / 2, sl[1].start, crop, sl))
    # reading order: group into rows by vertical centre
    res.sort(key=lambda r: r[0]); rows = []
    for r in res:
        if rows and abs(rows[-1][-1][0] - r[0]) < 60: rows[-1].append(r)
        else: rows.append([r])
    ordered = [r for row in rows for r in sorted(row, key=lambda r: r[1])]
    if PREVIEW:   # numbered cut-outs, to check / extend the NAMES table
        d = os.path.join(OUT, 'preview', sheet); os.makedirs(d, exist_ok=True)
        for k, (_, _, crop, _) in enumerate(ordered):
            Image.fromarray(crop.astype('uint8')).save(os.path.join(d, '%02d.png' % k))
    return ordered

# sheet index → game name
NAMES = {
  'furniture1': {0: 'locker', 1: 'sofa', 2: 'clock', 3: 'bed', 4: 'bookshelf', 5: 'painting', 6: 'generator', 7: 'storagerack', 8: 'barrel', 9: 'table', 10: 'chair', 11: 'fridge', 12: 'washer', 13: 'kitchen', 14: 'boxes', 15: 'gunrack',
                 16: 'counter', 17: 'handpump', 18: 'watercooler', 19: 'radiodesk', 20: 'bunkbed', 21: 'watertank', 22: 'watertank2', 23: 'monitor', 24: 'pc', 25: 'computer', 27: 'laptop', 28: 'camera', 29: 'mixer', 30: 'workbench', 31: 'bike',
                 32: 'medcabinet', 33: 'hospitalbed', 34: 'medcart', 35: 'vitals', 36: 'medkit', 37: 'stretcher', 38: 'oxygen', 39: 'dnatank', 40: 'reactorbox', 41: 'serverrack'},
  'furniture2': {16: 'benchshelf', 19: 'desk', 29: 'workbench2', 31: 'supplyshelf', 32: 'gamingchair', 33: 'wardrobe', 34: 'coatrack', 35: 'firstaid', 37: 'ivstand', 38: 'vitals2', 39: 'labbench', 40: 'fumehood',
                 41: 'centrifuge', 42: 'microscope', 43: 'reactor', 44: 'console', 45: 'powercell', 46: 'growtank', 47: 'server2', 48: 'terminal', 49: 'medkit_green', 51: 'gascylinders', 52: 'pipes', 53: 'furnace',
                 54: 'vent', 55: 'hatch', 56: 'sink', 57: 'bathroom', 58: 'vending', 59: 'gymbench', 60: 'dumbbells', 61: 'treadmill'},
  'furniture3': {0: 'f3_pipevalve', 1: 'f3_pipe', 2: 'f3_sign', 3: 'f3_monitorwall', 4: 'f3_neon', 5: 'f3_stripe', 6: 'f3_mapscreen', 7: 'f3_wire', 8: 'f3_cablebox', 9: 'f3_flag', 10: 'f3_dartboard', 11: 'f3_lamp',
                 12: 'f3_robotarm', 13: 'f3_conveyor', 14: 'f3_turret', 15: 'f3_press', 16: 'f3_filter', 17: 'f3_toolboard', 18: 'f3_missile', 19: 'f3_anvil', 20: 'f3_carlift', 21: 'f3_lathe', 22: 'f3_truck', 23: 'f3_fusion',
                 24: 'f3_minecart', 25: 'f3_seismo', 26: 'f3_hologram', 27: 'f3_dna', 28: 'f3_testtubes', 29: 'f3_glass', 30: 'f3_pod', 31: 'f3_cryopod', 32: 'f3_plant', 33: 'f3_rock', 34: 'f3_traytower', 35: 'f3_water',
                 36: 'f3_crystal', 37: 'f3_planter', 38: 'f3_sprinkler', 39: 'f3_tree', 40: 'f3_lava', 41: 'f3_ore', 42: 'f3_railing', 43: 'f3_bench', 44: 'f3_cage', 45: 'f3_dish', 46: 'f3_drone', 47: 'f3_punchbag', 48: 'f3_arcade', 49: 'f3_dronepad'},
  'weapons1': {0: 'sword', 1: 'dagger', 2: 'axe', 3: 'bow', 4: 'arrow', 5: 'spear', 6: 'pistol', 7: 'rifle', 8: 'shotgun', 9: 'grenade', 10: 'bomb', 11: 'flamethrower', 12: 'raygun'},
  'weapons2': {0: 'pistol2', 1: 'revolver', 2: 'smg', 3: 'ak', 4: 'carbine', 5: 'sniper', 6: 'shotgun2', 7: 'bullpup', 8: 'scar', 9: 'lmg', 10: 'rpg',
               11: 'knife', 12: 'bowieknife', 13: 'stiletto', 14: 'karambit', 15: 'karambit2', 16: 'sickle', 17: 'katana', 18: 'cleaver', 19: 'blade', 20: 'flail',
               21: 'fireaxe', 22: 'doubleaxe', 23: 'sledgehammer', 24: 'pickaxe', 25: 'crowbar', 26: 'shovel', 27: 'spade', 28: 'rake', 29: 'broom',
               30: 'chainsaw', 31: 'handsaw', 32: 'hacksaw', 33: 'wrench', 34: 'pipewrench', 35: 'screwdriver', 36: 'screwdriver2', 37: 'pliers', 38: 'boltcutter', 39: 'shears', 40: 'scissors', 41: 'nailbat',
               42: 'grenade2', 43: 'smokegrenade', 44: 'flashbang', 45: 'molotov', 46: 'bomb2', 47: 'landmine', 48: 'dynamite', 49: 'satchel', 50: 'kettlebell', 51: 'flare', 52: 'glowstick', 53: 'torch',
               54: 'extinguisher', 55: 'jerrycan', 56: 'jerrycan2', 57: 'toolbox', 58: 'medkit2', 59: 'toolbox2', 60: 'chainsaw2', 61: 'drill', 62: 'circularsaw', 63: 'rope', 64: 'hook', 65: 'pulley', 66: 'lantern'},
}
# UI kit pieces (9-slice skins for buttons / panels): written to assets/ui/<name>.png at full size
UIKIT = {'ui1': {0: 'btn-green', 4: 'btn-yellow', 27: 'btn-blue', 33: 'btn-red', 21: 'btn-dark', 9: 'slot', 10: 'panel-hazard', 22: 'panel-gold',
                 36: 'panel', 12: 'bar', 85: 'chevron', 43: 'ok', 44: 'no', 42: 'plus', 64: 'minus', 72: 'alert', 25: 'shield', 31: 'shield-dark'}}
# UI icon sheets: written to assets/icons/<name>.png (the HUD / navigation icon set)
ICONS = {'icons1': {1: 'water', 2: 'truck'}, 'power': {0: 'power'},
  'icons2': {0: 'coin', 2: 'ingot', 3: 'jerrycan', 4: 'brick', 6: 'flask', 7: 'people', 8: 'zombie', 9: 'biohazard', 10: 'radiation', 12: 'clock', 13: 'shield', 14: 'heart',
             15: 'up', 16: 'alert', 17: 'gear', 18: 'star', 19: 'trophy', 20: 'medal', 21: 'scroll', 25: 'bunker', 26: 'factory', 27: 'hospital', 28: 'labbuilding', 29: 'construction',
             30: 'garage', 31: 'watchtower', 32: 'dish', 35: 'van', 37: 'wrench', 38: 'hammer', 42: 'pickaxe', 43: 'shovel', 47: 'medkit', 49: 'helmet', 51: 'check', 53: 'coins',
             54: 'home', 57: 'cross', 63: 'group', 66: 'info', 70: 'chest', 73: 'search', 75: 'warning', 82: 'chart', 88: 'move', 91: 'mappin', 93: 'lock', 99: 'mail', 104: 'turret',
             107: 'trash', 109: 'calendar', 114: 'plus', 122: 'crown', 127: 'refresh', 129: 'diamond', 133: 'barrier', 137: 'gift', 143: 'spikes', 146: 'signal', 147: 'fire',
             150: 'play', 152: 'snow', 159: 'bolt', 171: 'skull'}}

PREVIEW = '--preview' in sys.argv
MAX = 256   # longest side in px: crisp at 2x for the sizes the game draws them

if __name__ == '__main__':
    meta = {}
    os.makedirs(OUT, exist_ok=True)
    for sheet in ['furniture1', 'furniture2', 'furniture3', 'weapons1', 'weapons2']:
        ordered = cut(sheet)
        print(sheet, len(ordered))
        for k, name in NAMES.get(sheet, {}).items():
            if k < len(ordered):
                im = Image.fromarray(ordered[k][2].astype('uint8')); im = im.crop(im.getbbox())
                im.thumbnail((MAX, MAX), Image.LANCZOS)
                im.save(os.path.join(OUT, name + '.png'), optimize=True)
                meta[name] = [im.width, im.height]
    for sheet, names in ICONS.items():
        ordered = cut(sheet); print(sheet, len(ordered))
        for k, name in names.items():
            im = Image.fromarray(ordered[k][2].astype('uint8')); im = im.crop(im.getbbox())
            im.thumbnail((128, 128), Image.LANCZOS)
            im.save(os.path.join(ROOT, 'assets', 'icons', name + '.png'), optimize=True)
    for sheet, names in UIKIT.items():
        ordered = cut(sheet); print(sheet, len(ordered))
        for k, name in names.items():
            im = Image.fromarray(ordered[k][2].astype('uint8')); im = im.crop(im.getbbox())
            im.save(os.path.join(ROOT, 'assets', 'ui', name + '.png'), optimize=True)
    # pixel sizes for the game (aspect ratios), loaded before the UI scripts
    with open(os.path.join(ROOT, 'js', 'data', 'sprites.js'), 'w') as f:
        f.write('/* Generated by tools/cut_sprites.py: cut-out sprite name -> [width, height] in px (assets/sprites/<name>.png). */\n')
        f.write('var DE = globalThis.DE = globalThis.DE || {};\nDE.Data = DE.Data || {};\nDE.Data.SPRITES = ' + json.dumps(meta, sort_keys=True, separators=(',', ':')) + ';\n')
