"""Cut the provided reference sheets into individual game assets.
Run from the project root:  python tools/cut_assets.py
Outputs PNGs into assets/icons, assets/rooms, assets/ui, assets/zombies."""
from PIL import Image, ImageDraw
import os

ROOT = os.path.join(os.path.dirname(__file__), '..')
A = lambda *p: os.path.join(ROOT, 'assets', *p)

def white_to_alpha(im, thresh=60):
    """Make background white transparent by flood-filling from the corners (keeps interior whites)."""
    im = im.convert('RGBA')
    rgb = im.convert('RGB')
    marker = (255, 0, 255)
    w, h = rgb.size
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if rgb.getpixel(xy) != marker:
            ImageDraw.floodfill(rgb, xy, marker, thresh=thresh)
    px = im.load(); mp = rgb.load()
    for y in range(h):
        for x in range(w):
            if mp[x, y] == marker:
                px[x, y] = (0, 0, 0, 0)
    return im

def trim(im, pad=6):
    bbox = im.getbbox()
    if not bbox: return im
    l, t, r, b = bbox
    l = max(0, l - pad); t = max(0, t - pad); r = min(im.width, r + pad); b = min(im.height, b + pad)
    return im.crop((l, t, r, b))

def square(im, size=256):
    s = max(im.width, im.height)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    return out.resize((size, size), Image.LANCZOS)

# ---------- icon sheet: 5 x 4 grid ----------
icons = Image.open(A('ui', 'icons-src.webp')).convert('RGBA')
names = [
    ['home', 'backpack', 'chart', 'map', 'gear'],
    ['power', 'brick', 'ingot', 'can', 'flask'],
    ['shield', 'people', 'scroll', 'factory', 'drop'],
    ['medal', 'radiation', 'zombie', 'barrel', 'badge'],
]
cw, ch = icons.width / 5, icons.height / 4
for r, row in enumerate(names):
    for c, name in enumerate(row):
        cell = icons.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
        cell = square(trim(white_to_alpha(cell)))
        cell.save(A('icons', name + '.png'))

# ---------- UI sheet: room thumbnails, bunker illustration, zombie, inventory items ----------
sheet = Image.open(A('ui', 'sheet-src.webp')).convert('RGBA')
def cut(box, path, size=None, alpha=False):
    im = sheet.crop(box)
    if alpha: im = trim(white_to_alpha(im))
    if size: im = im.resize(size, Image.LANCZOS)
    im.save(A(*path))
    return im

ROOM_BOXES = {  # (left, top, right, bottom) in the 1672x941 sheet
    'farm': (778, 266, 902, 404), 'workshop': (922, 266, 1046, 404), 'quarters': (1066, 266, 1190, 404),
    'generator': (778, 434, 902, 572), 'storage': (922, 434, 1046, 572), 'lab': (1066, 434, 1190, 572),
}
for name, box in ROOM_BOXES.items():
    cut(box, ('rooms', name + '-thumb.png'))
cut((272, 238, 718, 438), ('ui', 'bunker-entrance.png'))
cut((1052, 695, 1322, 888), ('zombies', 'walker-art.png'))

# ---------- logo ----------
logo = Image.open(A('ui', 'logo-src.webp')).convert('RGBA')
trim(white_to_alpha(logo, thresh=40)).save(A('ui', 'logo.png'))

# ---------- contact sheet for review ----------
files = sorted(f for f in os.listdir(A('icons')) if f.endswith('.png'))
tile = 96; cols = 8; rows = (len(files) + cols - 1) // cols
contact = Image.new('RGBA', (cols * tile, rows * tile + 300), (40, 40, 60, 255))
for i, f in enumerate(files):
    im = Image.open(A('icons', f)).convert('RGBA'); im.thumbnail((tile - 8, tile - 8))
    contact.paste(im, ((i % cols) * tile + 4, (i // cols) * tile + 4), im)
x = 0
for name in ROOM_BOXES:
    im = Image.open(A('rooms', name + '-thumb.png')).convert('RGBA'); im.thumbnail((120, 120))
    contact.paste(im, (x, rows * tile + 10)); x += 124
z = Image.open(A('zombies', 'walker-art.png')); z.thumbnail((120, 120)); contact.paste(z, (x, rows * tile + 10))
contact.save(os.path.join(ROOT, 'tools', 'contact.png'))
print('icons:', len(files), '| rooms:', len(ROOM_BOXES))
