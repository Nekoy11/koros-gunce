"""Renders the Koros Günce icon (108-unit adaptive-icon space) with PIL."""
import sys, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

N = 1296            # render size for 108 units (12 px / unit)
U = N / 108
NAVY = (28, 28, 40)
BG = (19, 19, 28)

def lin_grad(size, c0, c1, c2, angle_deg=150):
    w, h = size
    img = Image.new('RGBA', size)
    px = img.load()
    a = math.radians(angle_deg - 90)
    dx, dy = math.cos(a), math.sin(a)
    proj = [x * dx + y * dy for x, y in ((0, 0), (w, 0), (0, h), (w, h))]
    lo, hi = min(proj), max(proj)
    for y in range(h):
        for x in range(w):
            t = ((x * dx + y * dy) - lo) / (hi - lo)
            if t < 0.5:
                k = t / 0.5; A, B = c0, c1
            else:
                k = (t - 0.5) / 0.5; A, B = c1, c2
            px[x, y] = tuple(int(A[i] + (B[i] - A[i]) * k) for i in range(3)) + (255,)
    return img

def background():
    img = Image.new('RGBA', (N, N), BG + (255,))
    glow = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse([60 * U, -10 * U, 130 * U, 60 * U], fill=(30, 193, 203, 150))
    d.ellipse([-30 * U, 60 * U, 40 * U, 130 * U], fill=(150, 160, 255, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(18 * U))
    return Image.alpha_composite(img, glow)

def card_layer():
    x0, y0, x1, y1, r = 32, 28, 76, 80, 9
    box = [int(x0 * U), int(y0 * U), int(x1 * U), int(y1 * U)]
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    # soft cyan shadow / glow under the card
    sh = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([box[0], box[1] + int(3 * U), box[2], box[3] + int(3 * U)], int(r * U), fill=(30, 193, 203, 120))
    layer = Image.alpha_composite(layer, sh.filter(ImageFilter.GaussianBlur(5 * U)))
    # gradient body
    w, h = box[2] - box[0], box[3] - box[1]
    body = lin_grad((w // 4, h // 4), (110, 222, 228), (30, 193, 203), (14, 150, 160)).resize((w, h), Image.BICUBIC)
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], int(r * U), fill=255)
    # glass shine: diagonal soft white band
    shine = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shine)
    sd.polygon([(-w * 0.1, h * 0.55), (w * 0.55, -h * 0.1), (w * 0.85, -h * 0.1), (-w * 0.1, h * 0.85)], fill=(255, 255, 255, 70))
    shine = shine.filter(ImageFilter.GaussianBlur(6 * U))
    body = Image.alpha_composite(body, shine)
    # inner light edge
    edge = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle([1, 1, w - 2, h - 2], int(r * U), outline=(255, 255, 255, 90), width=max(2, int(0.6 * U)))
    body = Image.alpha_composite(body, edge)
    body.putalpha(ImageChops.multiply(body.getchannel('A'), mask))
    layer.alpha_composite(body, (box[0], box[1]))
    return layer

def monogram(color=NAVY + (255,), only=False):
    layer = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    sw = int(6.2 * U)
    def line(p, q):
        d.line([(p[0] * U, p[1] * U), (q[0] * U, q[1] * U)], fill=color, width=sw)
        for c in (p, q):
            d.ellipse([c[0] * U - sw / 2, c[1] * U - sw / 2, c[0] * U + sw / 2, c[1] * U + sw / 2], fill=color)
    line((44, 40), (44, 66))
    line((60, 40), (47, 53))
    line((48, 52), (61, 66))
    if not only:
        # little chip, like the reference card's label
        d.rounded_rectangle([56 * U, 71 * U, 70 * U, 75.5 * U], int(2.25 * U), fill=NAVY + (90,))
        d.rounded_rectangle([38 * U, 71.6 * U, 49 * U, 73.2 * U], int(0.8 * U), fill=NAVY + (110,))
        d.rounded_rectangle([38 * U, 74.2 * U, 45 * U, 75.8 * U], int(0.8 * U), fill=NAVY + (80,))
    return layer

def full():
    img = background()
    img = Image.alpha_composite(img, card_layer())
    return Image.alpha_composite(img, monogram())

def foreground():
    return Image.alpha_composite(card_layer(), monogram())

if __name__ == '__main__':
    out = sys.argv[1]
    f = full()
    f.save(f'{out}/full_108.png')
    foreground().save(f'{out}/fg_108.png')
    background().save(f'{out}/bg_108.png')
    monogram(color=(255, 255, 255, 255), only=True).save(f'{out}/mono_108.png')
    # preview: visible 72-unit area, rounded square + circle
    crop = f.crop((int(18 * U), int(18 * U), int(90 * U), int(90 * U))).resize((512, 512), Image.LANCZOS)
    m = Image.new('L', (512, 512), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, 511, 511], 115, fill=255)
    sq = crop.copy(); sq.putalpha(m)
    mc = Image.new('L', (512, 512), 0); ImageDraw.Draw(mc).ellipse([0, 0, 511, 511], fill=255)
    rd = crop.copy(); rd.putalpha(mc)
    prev = Image.new('RGBA', (1140, 560), (236, 240, 244, 255))
    prev.alpha_composite(sq, (24, 24)); prev.alpha_composite(rd, (604, 24))
    prev.save(f'{out}/preview.png')
    sq.save(f'{out}/legacy_512.png'); rd.save(f'{out}/round_512.png')
