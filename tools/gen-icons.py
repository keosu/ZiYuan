# 生成 PWA 图标：朱砂底、米色小篆「字」
# 用法：python tools/gen-icons.py   （需要 fontTools、brotli、Pillow）
import io
import os

from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

BG = (224, 85, 58)
INK = (255, 243, 234)
CHAR = "字"
OUT = "assets/icons"

font = TTFont("assets/fonts/Chine-Culture-Xiaozhuan.woff2")
font.flavor = None
buf = io.BytesIO()
font.save(buf)
font_bytes = buf.getvalue()


def icon(size, maskable=False):
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if maskable:
        draw.rectangle([0, 0, s, s], fill=BG)
        glyph = 0.5
    else:
        draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=BG)
        inset = int(s * 0.07)
        draw.rounded_rectangle([inset, inset, s - inset, s - inset], radius=int(s * 0.16), outline=(255, 240, 230, 70), width=max(2, s // 90))
        glyph = 0.66
    f = ImageFont.truetype(io.BytesIO(font_bytes), int(s * glyph))
    l, t, r, b = draw.textbbox((0, 0), CHAR, font=f)
    draw.text(((s - (r - l)) / 2 - l, (s - (b - t)) / 2 - t), CHAR, font=f, fill=INK)
    return img.resize((size, size), Image.LANCZOS)


os.makedirs(OUT, exist_ok=True)
for size in (192, 512):
    icon(size).save(f"{OUT}/icon-{size}.png")
icon(512, maskable=True).save(f"{OUT}/maskable-512.png")
icon(180, maskable=True).save(f"{OUT}/apple-touch-icon.png")
icon(64).save(f"{OUT}/favicon.png")
print(sorted(os.listdir(OUT)))
