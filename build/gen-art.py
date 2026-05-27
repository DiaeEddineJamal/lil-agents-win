from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ---- Brand palette (Peach theme) ----
CREAM_TOP = (255, 249, 241)
CREAM_BOT = (251, 224, 208)
GROUND = (249, 221, 206)
PINK = (217, 89, 115)          # brand accent — used for "lil agents"
PINK_SOFT = (242, 140, 166)
GREY = (138, 128, 140)
INK = (52, 46, 54)

BLACK = "C:/Windows/Fonts/seguibl.ttf"   # Segoe UI Black
BOLD = "C:/Windows/Fonts/segoeuib.ttf"
SEMI = "C:/Windows/Fonts/seguisb.ttf"

bruce = Image.open("assets/walk-bruce-sheet.png").convert("RGBA").crop((0, 0, 225, 400))
jazz = Image.open("assets/walk-jazz-sheet.png").convert("RGBA").crop((0, 0, 225, 400))


def vgrad(w, h, top, bot):
    img = Image.new("RGB", (w, h))
    px = img.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px_row = (int(top[0] + (bot[0] - top[0]) * t),
                  int(top[1] + (bot[1] - top[1]) * t),
                  int(top[2] + (bot[2] - top[2]) * t))
        for x in range(w):
            px[x, y] = px_row
    return img


def fit(im, h):
    return im.resize((max(1, int(im.width * h / im.height)), h), Image.LANCZOS)


def glow(base, cx, cy, radius, color, strength=70):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius],
              fill=color + (strength,))
    layer = layer.filter(ImageFilter.GaussianBlur(radius * 0.55))
    base.alpha_composite(layer)


def tracked_text(draw, xy, text, font, fill, tracking=0, anchor_center=None, width=None):
    # draw text char-by-char with letter spacing
    widths = [draw.textlength(c, font=font) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x, y = xy
    if anchor_center is not None and width is not None:
        x = (width - total) / 2
    for c, w in zip(text, widths):
        draw.text((x, y), c, font=font, fill=fill)
        x += w + tracking
    return total


def soft_shadow(base, cx, cy, w, h):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], fill=(120, 70, 80, 60))
    layer = layer.filter(ImageFilter.GaussianBlur(4))
    base.alpha_composite(layer)


def speech_bubble(base, cx, top, text, font):
    d = ImageDraw.Draw(base)
    tw = d.textlength(text, font=font)
    pad = 8
    w = tw + pad * 2
    h = 22
    x0 = cx - w / 2
    box = [x0, top, x0 + w, top + h]
    d.rounded_rectangle(box, radius=9, fill=(255, 250, 245, 255), outline=PINK_SOFT + (255,), width=2)
    # little tail
    d.polygon([(cx - 5, top + h - 1), (cx + 5, top + h - 1), (cx, top + h + 6)],
              fill=(255, 250, 245, 255))
    d.text((cx - tw / 2, top + 3), text, font=font, fill=PINK)


# ================= Sidebar 164 x 314 =================
W, H = 164, 314
side = vgrad(W, H, CREAM_TOP, CREAM_BOT).convert("RGBA")
glow(side, W // 2, 60, 90, (255, 200, 210), strength=90)
d = ImageDraw.Draw(side)

# decorative sparkles
for (sx, sy, r) in [(24, 40, 2), (140, 32, 2), (134, 96, 1), (20, 110, 1), (150, 150, 2)]:
    d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=PINK_SOFT + (180,))

# title + subtitle
title_f = ImageFont.truetype(BLACK, 24)
sub_f = ImageFont.truetype(SEMI, 10)
tracked_text(d, (0, 30), "lil agents", title_f, PINK, tracking=1, anchor_center=True, width=W)
sub = "tiny AI companions"
sw = d.textlength(sub, font=sub_f)
d.text(((W - sw) / 2, 62), sub, font=sub_f, fill=GREY)
sub2 = "for your taskbar"
sw2 = d.textlength(sub2, font=sub_f)
d.text(((W - sw2) / 2, 76), sub2, font=sub_f, fill=GREY)

# ground band (the "taskbar" they walk on)
gb_top = H - 86
d.rectangle([0, gb_top, W, H], fill=GROUND)
d.line([(0, gb_top), (W, gb_top)], fill=PINK_SOFT + (170,), width=2)

# characters
bh = 150
b = fit(bruce, bh)
j = fit(jazz, int(bh * 0.92))
bx = int(W * 0.30 - b.width / 2)
jx = int(W * 0.70 - j.width / 2)
feet = H - 8
soft_shadow(side, int(W * 0.30), feet - 2, b.width * 0.8, 14)
soft_shadow(side, int(W * 0.70), feet - 2, j.width * 0.8, 14)
side.alpha_composite(b, (bx, feet - b.height))
side.alpha_composite(j, (jx, feet - j.height))

# "hi!" speech bubble above Bruce
bubble_f = ImageFont.truetype(BOLD, 11)
speech_bubble(side, int(W * 0.30), feet - b.height - 20, "hi!", bubble_f)

side.convert("RGB").save("build/installerSidebar.bmp")
side.convert("RGB").save("build/uninstallerSidebar.bmp")

# ================= Header 150 x 57 =================
HW, HH = 150, 57
head = vgrad(HW, HH, CREAM_TOP, (255, 240, 232)).convert("RGBA")
hd = ImageDraw.Draw(head)
hf = ImageFont.truetype(BLACK, 17)
tracked_text(hd, (12, 8), "lil agents", hf, PINK, tracking=0.5)
hf2 = ImageFont.truetype(SEMI, 8)
hd.text((13, 32), "AI on your taskbar", font=hf2, fill=GREY)
hd.line([(12, 47), (104, 47)], fill=PINK_SOFT + (160,), width=1)
bb = fit(bruce, 50)
head.alpha_composite(bb, (HW - bb.width - 6, HH - bb.height + 3))
head.convert("RGB").save("build/installerHeader.bmp")

print("art v2 generated:", side.size, head.size)
