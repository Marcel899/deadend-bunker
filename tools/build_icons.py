"""Build icons for every room, composed from the game's own furniture sprites.

Each icon is a framed mini-room: the room's wall colours (its scene theme) with a lamp glow and wall
panels, a floor band, the room's signature furniture standing on the floor with soft contact
shadows, a vignette, the thick dark frame every icon shares, and a category badge. The sprites are
the cut-outs in assets/sprites (tools/cut_sprites.py), so an icon always matches what the room
contains.

    python3 tools/build_icons.py            # writes assets/rooms/icons/<room>.png (128x128)
                                            # and js/data/room_icons.js (the list of ids)

Theme colours are read from the game itself (node runs js/ui/scenes.js), so they stay in sync.
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, 'assets', 'rooms', 'icons')
SIZE = 128            # output size
S = SIZE * 3          # working resolution (downsampled for clean edges)
FLOOR = 0.80          # floor line, as a fraction of the height
INK = (28, 16, 32, 255)
CAT = {'production': (124, 196, 106), 'support': (91, 184, 240), 'defense': (231, 76, 90), 'housing': (255, 197, 49)}

# room -> sprites, back to front: (sprite, centre x, max width, max height[, bottom, flip])
# sizes are fractions of the icon; bottom defaults to just below the floor line
SIG = {
    'quarters': [('locker', .80, .24, .50), ('bunkbed', .40, .62, .60)],
    'dormitory': [('bunkbed', .68, .46, .46), ('bunkbed', .36, .56, .58)],
    'cafeteria': [('vending', .82, .22, .50), ('table', .42, .62, .40), ('chair', .12, .16, .32)],
    'kitchen': [('fridge', .82, .24, .58), ('kitchen', .40, .64, .50)],
    'storage': [('boxes', .80, .30, .30), ('storagerack', .38, .48, .66)],
    'coldstorage': [('fridge', .68, .28, .56), ('fridge', .36, .30, .64), ('boxes', .86, .22, .22)],
    'generator': [('jerrycan', .84, .18, .26), ('generator', .44, .68, .56)],
    'watertank': [('watertank2', .78, .28, .50), ('watertank', .40, .46, .66)],
    'workshop': [('toolbox', .85, .20, .22), ('workbench', .44, .70, .52)],
    'medbay': [('ivstand', .83, .20, .52), ('hospitalbed', .42, .64, .44)],
    'radio': [('radiodesk', .50, .82, .60)],
    'farm': [('f3_plant', .83, .26, .52), ('f3_planter', .42, .70, .42)],
    'security': [('f3_monitorwall', .50, .84, .58)],
    'water': [('f3_filter', .79, .26, .64), ('handpump', .40, .42, .60)],
    'concrete': [('boxes', .83, .26, .28), ('mixer', .42, .62, .62)],
    'hydroponics': [('growtank', .80, .24, .52), ('f3_traytower', .42, .40, .70)],
    'purification': [('watertank2', .79, .28, .52), ('f3_filter', .40, .30, .70)],
    'armory': [('grenade2', .84, .18, .22), ('gunrack', .46, .60, .66)],
    'barracks': [('gunrack', .80, .30, .52), ('bunkbed', .40, .58, .58)],
    'advworkshop': [('f3_press', .77, .34, .66), ('f3_lathe', .38, .50, .48)],
    'infirmary': [('medcabinet', .74, .40, .50), ('hospitalbed', .38, .60, .42)],
    'garage': [('toolbox', .87, .18, .20), ('f3_truck', .46, .70, .62)],
    'training': [('dumbbells', .82, .26, .20), ('f3_punchbag', .44, .40, .68)],
    'comms': [('serverrack', .80, .26, .58), ('f3_dish', .40, .50, .66)],
    'lab': [('labbench', .48, .82, .62)],
    'refinery': [('barrel', .81, .22, .40), ('gascylinders', .46, .32, .56), ('jerrycan2', .18, .18, .24)],
    'greenhouse': [('f3_plant', .75, .32, .62), ('f3_planter', .38, .60, .40)],
    'recycling': [('boxes', .83, .26, .30), ('f3_conveyor', .44, .80, .40)],
    'seccontrol': [('f3_turret', .72, .40, .58), ('console', .30, .32, .58)],
    'vehicleshop': [('toolbox', .87, .18, .20), ('f3_carlift', .44, .60, .68)],
    'ammofactory': [('grenade', .83, .20, .30), ('f3_press', .42, .40, .70)],
    'quarantine': [('hospitalbed', .40, .56, .36), ('f3_glass', .76, .40, .52)],
    'intel': [('terminal', .83, .26, .28), ('f3_mapscreen', .40, .56, .58)],
    'reactor': [('reactor', .50, .80, .64)],
    'genetics': [('f3_dna', .79, .28, .60), ('dnatank', .40, .40, .68)],
    'autofarm': [('f3_traytower', .79, .30, .64), ('f3_robotarm', .40, .46, .66)],
    'hospital': [('vitals', .83, .24, .52), ('hospitalbed', .42, .62, .42)],
    'dronehangar': [('f3_dronepad', .50, .80, .30), ('f3_drone', .50, .70, .28, .52)],
    'heavyweapons': [('f3_anvil', .84, .20, .30), ('f3_turret', .42, .48, .68)],
    'tactical': [('f3_flag', .84, .24, .52), ('table', .46, .62, .36), ('f3_mapscreen', .46, .50, .34, .46)],
    'cryo': [('f3_cryopod', .68, .30, .62), ('f3_cryopod', .36, .34, .70)],
    'seismic': [('f3_rock', .83, .28, .34), ('f3_seismo', .42, .40, .66)],
    'defcontrol': [('f3_missile', .82, .20, .60), ('console', .42, .34, .62)],
    'fusion': [('f3_fusion', .50, .58, .74)],
    'bioeng': [('f3_hologram', .75, .32, .64), ('f3_pod', .38, .34, .70)],
    'reservoir': [('handpump', .83, .22, .44), ('f3_water', .42, .46, .62)],
    'aicommand': [('serverrack', .17, .22, .50), ('serverrack', .83, .22, .50), ('f3_hologram', .50, .42, .72)],
    'autoplant': [('f3_robotarm', .52, .46, .62), ('f3_conveyor', .50, .88, .30)],
    'warroom': [('f3_flag', .85, .22, .50), ('gunrack', .16, .24, .50), ('table', .50, .60, .34), ('f3_hologram', .50, .26, .30, .56)],
    'uplink': [('f3_cablebox', .85, .20, .30), ('f3_dish', .46, .56, .72)],
    'medresearch': [('medcabinet', .77, .36, .50), ('microscope', .38, .44, .44)],
    'silo': [('f3_missile', .50, .40, .80)],
    'ark': [('f3_plant', .82, .26, .52), ('f3_water', .20, .24, .40), ('bunkbed', .50, .54, .56)],
    'geothermal': [('generator', .78, .34, .40), ('f3_lava', .38, .54, .52)],
    'aquifer': [('f3_crystal', .81, .26, .42), ('f3_water', .40, .46, .62)],
    'orevein': [('f3_minecart', .74, .40, .40), ('f3_ore', .32, .40, .52)],
    'minehead': [('f3_minecart', .66, .44, .36), ('pickaxe', .30, .34, .50), ('drill', .82, .22, .34)],
    'server': [('serverrack', .70, .30, .62), ('serverrack', .36, .32, .68)],
    'cache': [('supplyshelf', .70, .42, .52), ('boxes', .30, .34, .40)],
}


def themes():
    js = r"""
global.DE={};const fs=require('fs');const vm=require('vm');
['js/data/config.js','js/data/resources.js','js/data/rooms.js','js/data/sprites.js','js/data/scenes.js','js/ui/scenes.js'].forEach(f=>vm.runInThisContext(fs.readFileSync(f,'utf8')));
const D=globalThis.DE, out={};
for (const id in D.Data.ROOMS) { const L=D.Data.SCENES[id]||D.Data.SCENES._default; const t=D.Scenes.THEMES[L.theme]||D.Scenes.THEMES.default; out[id]={cat:D.Data.ROOMS[id].category, wall:t.wall, wall2:t.wall2, floor:t.floor, trim:t.trim, lamp:t.lamp}; }
process.stdout.write(JSON.stringify(out));"""
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))


def rgb(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def vgrad(w, h, top, bottom):
    g = Image.new('RGBA', (1, h))
    for y in range(h):
        g.putpixel((0, y), mix(top, bottom, y / max(1, h - 1)) + (255,))
    return g.resize((w, h))


def radial(w, h, cx, cy, r, color, alpha):
    """Soft radial glow: alpha falls off with distance (quadratic)."""
    m = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(m)
    steps = 48
    for i in range(steps, 0, -1):
        rr = r * i / steps
        a = int(alpha * (1 - (i / steps)) ** 2 * 255)
        d.ellipse((cx - rr, cy - rr, cx + rr, cy + rr), fill=a)
    m = m.filter(ImageFilter.GaussianBlur(r / 20))
    layer = Image.new('RGBA', (w, h), color + (0,))
    layer.putalpha(m)
    return layer


def build(room, theme):
    wall, wall2, floor, trim, lamp = (rgb(theme[k]) for k in ('wall', 'wall2', 'floor', 'trim', 'lamp'))
    img = vgrad(S, S, mix(wall, (255, 255, 255), .06), wall2)
    d = ImageDraw.Draw(img, 'RGBA')
    fy = int(S * FLOOR)
    # wall panels: faint seams and a darker skirting just above the floor
    for k in range(1, 4):
        x = int(S * k / 4)
        d.rectangle((x - S // 160, int(S * .1), x + S // 160, fy), fill=(0, 0, 0, 34))
        d.rectangle((x + S // 160, int(S * .1), x + S // 80, fy), fill=(255, 255, 255, 14))
    d.rectangle((0, fy - int(S * .06), S, fy), fill=mix(wall2, (0, 0, 0), .25) + (255,))
    # ceiling trim with a lamp
    d.rectangle((0, 0, S, int(S * .09)), fill=trim + (255,))
    d.rectangle((0, int(S * .09), S, int(S * .1)), fill=(0, 0, 0, 90))
    img.alpha_composite(radial(S, S, S // 2, int(S * .08), int(S * .78), lamp, .5))
    d = ImageDraw.Draw(img, 'RGBA')
    lw = int(S * .16)
    d.rounded_rectangle((S // 2 - lw // 2, int(S * .07), S // 2 + lw // 2, int(S * .115)), radius=S // 60, fill=lamp + (255,), outline=INK, width=S // 90)
    # floor band
    d.rectangle((0, fy, S, S), fill=floor + (255,))
    d.rectangle((0, fy, S, fy + int(S * .018)), fill=INK)
    d.rectangle((0, fy + int(S * .018), S, fy + int(S * .03)), fill=mix(floor, (255, 255, 255), .12) + (255,))
    for k in range(0, 9):
        x = int(S * (k / 8 + .03))
        d.line((x, fy + int(S * .05), x - int(S * .05), S), fill=(0, 0, 0, 40), width=S // 120)

    # furniture, back to front, each on a soft contact shadow
    for spec in SIG.get(room, []):
        name, cx, mw, mh = spec[:4]
        bottom = spec[4] if len(spec) > 4 else FLOOR + .045
        flip = spec[5] if len(spec) > 5 else False
        sp = Image.open(os.path.join(ROOT, 'assets', 'sprites', name + '.png')).convert('RGBA')
        k = min(mw * S / sp.width, mh * S / sp.height)
        w, h = max(1, int(sp.width * k)), max(1, int(sp.height * k))
        sp = sp.resize((w, h), Image.LANCZOS)
        if flip:
            sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        x, y = int(cx * S - w / 2), int(bottom * S - h)
        if bottom >= FLOOR:   # standing on the floor: contact shadow
            sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
            ImageDraw.Draw(sh).ellipse((x + w * .04, y + h - S * .03, x + w * .96, y + h + S * .025), fill=(0, 0, 0, 120))
            img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S / 90)))
        img.alpha_composite(sp, (x, y))
    return finish(img, theme['cat'])


def finish(img, cat):
    """Vignette, rounded clip, the shared frame and the category badge; downsampled to SIZE."""
    vig = Image.new('L', (S, S), 0)
    ImageDraw.Draw(vig).rectangle((0, 0, S, S), fill=110)
    hole = Image.new('L', (S, S), 0)
    ImageDraw.Draw(hole).ellipse((-S * .2, -S * .15, S * 1.2, S * 1.25), fill=255)
    hole = hole.filter(ImageFilter.GaussianBlur(S / 8))
    vig = Image.composite(Image.new('L', (S, S), 0), vig, hole)
    dark = Image.new('RGBA', (S, S), (10, 6, 14, 0))
    dark.putalpha(vig)
    img.alpha_composite(dark)

    # clip to the rounded tile, then the frame every icon shares
    pad, rad, bw = int(S * .03), int(S * .18), int(S * .055)
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((pad, pad, S - pad, S - pad), radius=rad, fill=255)
    tile = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    tile.paste(img, (0, 0), mask)
    d = ImageDraw.Draw(tile, 'RGBA')
    d.rounded_rectangle((pad, pad, S - pad, S - pad), radius=rad, outline=INK, width=bw)
    ins = pad + bw
    d.rounded_rectangle((ins, ins, S - ins, S - ins), radius=rad - bw, outline=(255, 255, 255, 46), width=max(2, S // 110))
    # category badge
    c = CAT.get(cat, (170, 170, 170))
    r, bx, by = S * .07, S * .835, S * .165
    d.ellipse((bx - r, by - r, bx + r, by + r), fill=c + (255,), outline=INK, width=int(S * .025))
    d.ellipse((bx - r * .45, by - r * .62, bx + r * .1, by - r * .1), fill=(255, 255, 255, 110))
    return tile.resize((SIZE, SIZE), Image.LANCZOS)


# surface structures: the same frame, outdoors at dusk; (folder/name, centre x, max w, max h[, bottom])
STRUCT = {
    'fence': [('sprites/f3_railing', .50, .86, .50)],
    'towers': [('icons/watchtower', .50, .60, .74)],
    'missile': [('sprites/f3_missile', .50, .40, .76)],
    'turret': [('sprites/f3_turret', .50, .64, .72)],
    'trap': [('icons/spikes', .70, .40, .22), ('sprites/landmine', .36, .46, .28)],
    'lights': 'lights', 'barricades': 'sandbags', 'road': 'road', 'wall': 'wall',
}


def place(img, path, cx, mw, mh, bottom=FLOOR + .045, shadow=True):
    sp = Image.open(os.path.join(ROOT, 'assets', path + '.png')).convert('RGBA')
    k = min(mw * S / sp.width, mh * S / sp.height)
    w, h = max(1, int(sp.width * k)), max(1, int(sp.height * k))
    sp = sp.resize((w, h), Image.LANCZOS)
    x, y = int(cx * S - w / 2), int(bottom * S - h)
    if shadow:
        sh = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse((x + w * .04, y + h - S * .03, x + w * .96, y + h + S * .025), fill=(0, 0, 0, 120))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(S / 90)))
    img.alpha_composite(sp, (x, y))


def outdoor():
    """Dusk sky, sun, ruined skyline and a grassy strip: the overworld's palette."""
    img = Image.new('RGBA', (S, S))
    top, mid, low = (58, 42, 94), (200, 96, 74), (240, 160, 80)
    for y in range(S):
        t = y / (S * FLOOR)
        c = mix(top, mid, min(1, t / .6)) if t < .6 else mix(mid, low, min(1, (t - .6) / .4))
        ImageDraw.Draw(img).line((0, y, S, y), fill=c + (255,))
    img.alpha_composite(radial(S, S, int(S * .74), int(S * .62), int(S * .3), (255, 214, 122), .9))
    d = ImageDraw.Draw(img, 'RGBA')
    hz = int(S * .7)
    sky = [(0, hz), (0, hz - S * .1), (S * .1, hz - S * .1), (S * .1, hz - S * .16), (S * .2, hz - S * .16), (S * .2, hz - S * .07), (S * .34, hz - S * .07), (S * .34, hz - S * .2),
           (S * .44, hz - S * .2), (S * .44, hz - S * .12), (S * .6, hz - S * .12), (S * .6, hz - S * .05), (S * .78, hz - S * .05), (S * .78, hz - S * .14), (S * .9, hz - S * .14), (S * .9, hz - S * .08), (S, hz - S * .08), (S, hz)]
    d.polygon(sky, fill=(106, 47, 95, 210))
    d.rectangle((0, hz, S, int(S * FLOOR)), fill=(122, 90, 68, 255))
    fy = int(S * FLOOR)
    d.rectangle((0, fy, S, S), fill=(92, 112, 38, 255))
    d.rectangle((0, fy, S, fy + int(S * .018)), fill=INK)
    d.rectangle((0, fy + int(S * .07), S, S), fill=(90, 58, 38, 255))
    return img


def ol(d, shape, box, fill, width=None):
    """A filled shape with the icons' thick dark outline."""
    width = width or int(S * .018)
    getattr(d, shape)(box, fill=fill, outline=INK, width=width)


def draw_struct(img, kind):
    d = ImageDraw.Draw(img, 'RGBA')
    fy = S * (FLOOR + .03)
    if kind == 'sandbags':
        w, h = S * .27, S * .13
        rows = [(3, fy - h / 2), (2, fy - h * 1.35), (1, fy - h * 2.2)]
        for n, cy in rows:
            for i in range(n):
                cx = S * .5 + (i - (n - 1) / 2) * w * .95
                ol(d, 'ellipse', (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2), (190, 146, 84, 255), int(S * .026))
                d.ellipse((cx - w * .34, cy - h * .34, cx + w * .18, cy - h * .02), fill=(232, 196, 136, 230))
                d.line((cx, cy - h * .4, cx, cy + h * .4), fill=(110, 78, 40, 255), width=int(S * .014))
    elif kind == 'lights':
        lampy = S * .26
        beam = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        ImageDraw.Draw(beam).polygon([(S * .42, lampy + S * .12), (S * .58, lampy + S * .12), (S * .8, fy), (S * .2, fy)], fill=(255, 226, 120, 120))
        img.alpha_composite(beam.filter(ImageFilter.GaussianBlur(S / 60)))
        d = ImageDraw.Draw(img, 'RGBA')
        ol(d, 'rectangle', (S * .465, lampy, S * .535, fy), (100, 105, 116, 255), int(S * .022))
        d.rectangle((S * .475, lampy + S * .02, S * .49, fy - S * .02), fill=(160, 166, 178, 255))
        place(img, 'sprites/f3_lamp', .5, .56, .32, (lampy + S * .17) / S, shadow=False)
        d = ImageDraw.Draw(img, 'RGBA')
        ol(d, 'rectangle', (S * .4, fy - S * .04, S * .6, fy), (70, 74, 82, 255), int(S * .022))
    elif kind == 'road':
        hz = S * .7
        ol(d, 'polygon', [(S * .44, hz), (S * .56, hz), (S * .96, S), (S * .04, S)], (74, 70, 80, 255))
        for a, b in [(.72, .77), (.81, .87), (.91, .99)]:
            d.polygon([(S * (.5 - .006 / (1.1 - a)), S * a), (S * (.5 + .006 / (1.1 - a)), S * a), (S * (.5 + .006 / (1.1 - b)), S * b), (S * (.5 - .006 / (1.1 - b)), S * b)], fill=(255, 211, 74, 255))
        place(img, 'icons/barrier', .76, .36, .16, .9)
    elif kind == 'wall':
        x0, x1, y0 = S * .1, S * .9, S * .38
        ol(d, 'rectangle', (x0, y0, x1, fy), (184, 181, 174, 255))
        rows = 5; rh = (fy - y0) / rows
        for r in range(rows):
            y = y0 + r * rh
            if r:
                d.line((x0, y, x1, y), fill=(108, 104, 101, 255), width=int(S * .012))
            off = (r % 2) * .5
            for j in range(-1, 5):
                x = x0 + (j + off) * (x1 - x0) / 4
                if x0 < x < x1:
                    d.line((x, y, x, y + rh), fill=(108, 104, 101, 255), width=int(S * .012))
            d.rectangle((x0 + S * .01, y + S * .012, x1 - S * .01, y + S * .03), fill=(255, 255, 255, 40))
        ol(d, 'rectangle', (x0 - S * .03, y0 - S * .05, x1 + S * .03, y0 + S * .005), (216, 214, 209, 255))


def build_struct(key):
    img = outdoor()
    spec = STRUCT[key]
    if isinstance(spec, str):
        draw_struct(img, spec)
    else:
        for path, cx, mw, mh, *rest in spec:
            place(img, path, cx, mw, mh, *(rest[:1] or [FLOOR + .045]))
    return finish(img, 'defense')


def save(img, path):
    # 256-colour palette PNG with alpha: a third of the size, no visible loss at icon size
    img.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(path, optimize=True)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    th = themes()
    missing = [r for r in th if r not in SIG]
    if missing:
        print('rooms without a signature (skipped):', ', '.join(missing))
    sprites_missing = sorted({s[0] for v in SIG.values() for s in v if not os.path.exists(os.path.join(ROOT, 'assets', 'sprites', s[0] + '.png'))})
    if sprites_missing:
        sys.exit('missing sprites: ' + ', '.join(sprites_missing))
    done = []
    for room in th:
        if room not in SIG:
            continue
        save(build(room, th[room]), os.path.join(OUT_DIR, room + '.png'))
        done.append(room)
    structs = []
    for key in STRUCT:
        save(build_struct(key), os.path.join(OUT_DIR, 's-' + key + '.png'))
        structs.append(key)
    with open(os.path.join(ROOT, 'js', 'data', 'room_icons.js'), 'w') as f:
        f.write('/* Generated by tools/build_icons.py: composed build icons in assets/rooms/icons/ —\n * rooms as <id>.png, surface structures as s-<key>.png. */\n')
        f.write('var DE = globalThis.DE = globalThis.DE || {};\nDE.Data = DE.Data || {};\n')
        f.write('DE.Data.ROOM_ICONS = ' + json.dumps(done) + ';\n')
        f.write('DE.Data.STRUCT_ICONS = ' + json.dumps(structs) + ';\n')
    print('built', len(done), 'room icons and', len(structs), 'structure icons')


if __name__ == '__main__':
    main()
