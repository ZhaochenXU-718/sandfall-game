"""Render the ART-A04 typography board with the approved source fonts.

Usage:
  python render-art-a04-typography.py \
    --noto /path/to/NotoSansSC[wght].ttf \
    --oxanium /path/to/Oxanium[wght].ttf \
    --output ../concepts/art-a04-typography-board.png

This is an art-source utility, not part of the Cocos runtime.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1600
HEIGHT = 1000

BG = "#050D19"
PANEL = "#0C121F"
PANEL_2 = "#091728"
OUTLINE = "#375373"
PRIMARY = "#EEF3FF"
SECONDARY = "#B4C2DB"
MUTED = "#6F8EB1"
CYAN = "#41CDC3"
BLUE = "#5B8DEF"
CORAL = "#FF636B"
GOLD = "#FFC44B"
GOLD_TEXT = "#101827"


def load_font(path: Path, size: int, variation: str) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(path), size=size)
    font.set_variation_by_name(variation)
    return font


def rounded_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 22) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=PANEL, outline=OUTLINE, width=2)


def draw_glow_text(
    image: Image.Image,
    xy: tuple[int, int],
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: str,
    glow: str,
) -> None:
    glow_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)
    glow_draw.text(xy, text, font=font, fill=glow, anchor="la", stroke_width=2, stroke_fill=glow)
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(12))
    image.alpha_composite(glow_layer)
    ImageDraw.Draw(image).text(xy, text, font=font, fill=fill, anchor="la")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--noto", required=True, type=Path)
    parser.add_argument("--oxanium", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    image = Image.new("RGBA", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    ox_60 = load_font(args.oxanium, 60, "SemiBold")
    ox_40 = load_font(args.oxanium, 40, "SemiBold")
    ox_34 = load_font(args.oxanium, 34, "SemiBold")
    ox_28 = load_font(args.oxanium, 28, "SemiBold")
    ox_24 = load_font(args.oxanium, 24, "SemiBold")
    ox_20 = load_font(args.oxanium, 20, "SemiBold")
    noto_34 = load_font(args.noto, 34, "SemiBold")
    noto_28 = load_font(args.noto, 28, "SemiBold")
    noto_24 = load_font(args.noto, 24, "Regular")
    noto_20 = load_font(args.noto, 20, "Regular")
    noto_18 = load_font(args.noto, 18, "Regular")

    # Header
    draw_glow_text(image, (80, 48), "SANDFALL TYPOGRAPHY", ox_60, PRIMARY, "#41CDC388")
    draw.text((82, 120), "ART-A04  ·  360 DESIGN WIDTH  ·  WECHAT / DOUYIN", font=ox_20, fill=MUTED)
    draw.rounded_rectangle((82, 158, 1518, 164), radius=3, fill=OUTLINE)
    for index, color in enumerate((CYAN, BLUE, CORAL, GOLD)):
        draw.rounded_rectangle((82 + index * 68, 158, 144 + index * 68, 164), radius=3, fill=color)

    # Left: pairing
    rounded_panel(draw, (70, 200, 765, 720))
    draw.text((108, 232), "FONT PAIRING", font=ox_24, fill=CYAN)
    draw.text((108, 280), "OXANIUM 600", font=ox_20, fill=MUTED)
    draw.text((108, 318), "SCORE  009528", font=ox_40, fill=PRIMARY)
    draw.text((108, 376), "TIME  01:41     NEXT", font=ox_28, fill=SECONDARY)
    draw_glow_text(image, (108, 430), "CHAIN ×4  +2400", ox_34, "#FFD66B", "#FFC44B88")

    draw.rounded_rectangle((108, 496, 727, 498), radius=1, fill=OUTLINE)
    draw.text((108, 526), "NOTO SANS SC 600 / 400", font=ox_20, fill=MUTED)
    draw.text((108, 566), "进阶模式", font=noto_34, fill=PRIMARY)
    draw.text((305, 570), "升级 · 解锁颜色", font=noto_24, fill=SECONDARY)
    draw.text((108, 630), "每 5 次消除升级并加速，连锁会获得更高分数。", font=noto_20, fill=SECONDARY)
    draw.text((108, 674), "中文正文保持现代、清晰，不使用低分辨率像素字。", font=noto_18, fill=MUTED)

    # Right: hierarchy
    rounded_panel(draw, (795, 200, 1530, 720))
    draw.text((835, 232), "TYPE SCALE", font=ox_24, fill=CYAN)
    rows = [
        ("36 / 44", "SANDFALL", ox_40, PRIMARY),
        ("26 / 34", "GAME OVER", ox_34, PRIMARY),
        ("22 / 28", "CHAIN ×3", ox_28, "#FFD66B"),
        ("18 / 24", "开始进阶模式", noto_28, PRIMARY),
        ("16 / 22", "经典休闲", noto_24, PRIMARY),
        ("12 / 18", "选择模式后开始", noto_18, MUTED),
    ]
    y = 288
    for token, sample, font, color in rows:
        draw.text((835, y + 5), token, font=ox_20, fill=MUTED)
        draw.text((990, y), sample, font=font, fill=color)
        y += 58

    # Bottom: rules
    rounded_panel(draw, (70, 750, 1530, 930))
    draw.text((108, 782), "CORE RULES", font=ox_24, fill=CYAN)
    rules = [
        (CYAN, "MIN 12", "操作提示与模式副标题 ≥ 12pt"),
        (BLUE, "TABULAR", "分数与计时使用等宽数字"),
        (GOLD, "GLOW", "只给 Logo、升级与连锁"),
        (CORAL, "NO PIXEL CJK", "中文正文禁用像素字体"),
    ]
    x_positions = (108, 460, 812, 1164)
    for x, (color, label, body) in zip(x_positions, rules):
        draw.rounded_rectangle((x, 830, x + 316, 904), radius=12, fill=PANEL_2, outline=color, width=2)
        draw.text((x + 18, 842), label, font=ox_20, fill=color)
        draw.text((x + 18, 878), body, font=noto_18, fill=SECONDARY)

    draw.text((80, 958), "Noto Sans SC + Oxanium  ·  SIL OFL 1.1  ·  runtime uses static TTF subsets", font=ox_20, fill=MUTED)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(args.output, optimize=True, quality=95)


if __name__ == "__main__":
    main()
