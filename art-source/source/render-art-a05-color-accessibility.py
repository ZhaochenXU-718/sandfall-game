"""Render the ART-A05 palette and accessibility review board.

Usage:
  python render-art-a05-color-accessibility.py \
    --noto /path/to/NotoSansSC[wght].ttf \
    --oxanium /path/to/Oxanium[wght].ttf \
    --output ../concepts/art-a05-color-accessibility-board.png

The CVD previews use the 100% severity matrices from Machado et al. (2009).
This is an art-source review utility, not part of the Cocos runtime.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


WIDTH = 1600
HEIGHT = 1100

BG = "#050D19"
BOARD = "#111827"
PANEL = "#0C121F"
PANEL_2 = "#091728"
OUTLINE = "#4E7398"
PRIMARY = "#EEF3FF"
SECONDARY = "#B4C2DB"
MUTED = "#6F8EB1"
CYAN_UI = "#41CDC3"
BLUE_UI = "#5B8DEF"
CORAL_UI = "#FF636B"
GOLD_UI = "#FFC44B"

SAND_COLORS = [
    ("C1", "CORAL", "#FF6B6B"),
    ("C2", "GOLD", "#FFC857"),
    ("C3", "CYAN", "#4ECDC4"),
    ("C4", "BLUE", "#5B8DEF"),
    ("C5", "MAGENTA", "#C257B7"),
]

CVD_MATRICES = {
    "PROTANOPIA": np.array(
        [[0.152286, 1.052583, -0.204868],
         [0.114503, 0.786281, 0.099216],
         [-0.003882, -0.048116, 1.051998]],
    ),
    "DEUTERANOPIA": np.array(
        [[0.367322, 0.860646, -0.227968],
         [0.280085, 0.672501, 0.047413],
         [-0.011820, 0.042940, 0.968881]],
    ),
    "TRITANOPIA": np.array(
        [[1.255528, -0.076749, -0.178779],
         [-0.078411, 0.930809, 0.147602],
         [0.004733, 0.691367, 0.303900]],
    ),
}


def load_font(path: Path, size: int, variation: str) -> ImageFont.FreeTypeFont:
    font = ImageFont.truetype(str(path), size=size)
    font.set_variation_by_name(variation)
    return font


def hex_rgb(value: str) -> np.ndarray:
    return np.array([int(value[index:index + 2], 16) / 255 for index in (1, 3, 5)])


def srgb_to_linear(value: np.ndarray) -> np.ndarray:
    return np.where(value <= 0.04045, value / 12.92, ((value + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(value: np.ndarray) -> np.ndarray:
    return np.where(value <= 0.0031308, value * 12.92, 1.055 * value ** (1 / 2.4) - 0.055)


def rgb_hex(value: np.ndarray) -> str:
    channels = np.clip(np.round(value * 255), 0, 255).astype(int)
    return "#" + "".join(f"{channel:02X}" for channel in channels)


def cvd_color(value: str, matrix: np.ndarray) -> str:
    linear = srgb_to_linear(hex_rgb(value))
    simulated = np.clip(matrix @ linear, 0, 1)
    return rgb_hex(np.clip(linear_to_srgb(simulated), 0, 1))


def low_light_color(value: str, exposure: float = 0.35) -> str:
    linear = srgb_to_linear(hex_rgb(value)) * exposure
    return rgb_hex(np.clip(linear_to_srgb(linear), 0, 1))


def relative_luminance(value: str) -> float:
    red, green, blue = srgb_to_linear(hex_rgb(value))
    return float(0.2126 * red + 0.7152 * green + 0.0722 * blue)


def contrast_ratio(first: str, second: str) -> float:
    first_luminance = relative_luminance(first)
    second_luminance = relative_luminance(second)
    lighter = max(first_luminance, second_luminance)
    darker = min(first_luminance, second_luminance)
    return (lighter + 0.05) / (darker + 0.05)


def rounded_panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 22) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=PANEL, outline="#375373", width=2)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--noto", required=True, type=Path)
    parser.add_argument("--oxanium", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    draw = ImageDraw.Draw(image)

    ox_54 = load_font(args.oxanium, 54, "SemiBold")
    ox_26 = load_font(args.oxanium, 26, "SemiBold")
    ox_22 = load_font(args.oxanium, 22, "SemiBold")
    ox_18 = load_font(args.oxanium, 18, "SemiBold")
    noto_22 = load_font(args.noto, 22, "SemiBold")
    noto_18 = load_font(args.noto, 18, "Regular")

    draw.text((76, 48), "COLOR & READABILITY", font=ox_54, fill=PRIMARY)
    draw.text((78, 116), "ART-A05  ·  FINAL CORE PALETTE  ·  360 DESIGN WIDTH", font=ox_18, fill=MUTED)
    draw.rounded_rectangle((78, 154, 1522, 160), radius=3, fill="#375373")
    for index, color in enumerate((CYAN_UI, BLUE_UI, CORAL_UI, GOLD_UI)):
        draw.rounded_rectangle((78 + index * 68, 154, 140 + index * 68, 160), radius=3, fill=color)

    # Final palette.
    rounded_panel(draw, (70, 194, 1050, 474))
    draw.text((105, 222), "FINAL SAND PALETTE", font=ox_22, fill=CYAN_UI)
    swatch_width = 166
    start_x = 105
    for index, (color_id, name, color) in enumerate(SAND_COLORS):
        x = start_x + index * 184
        draw.rounded_rectangle((x, 272, x + swatch_width, 396), radius=16, fill=BOARD, outline="#243650", width=2)
        draw.rounded_rectangle((x + 10, 282, x + swatch_width - 10, 356), radius=10, fill=color)
        draw.text((x + 14, 366), f"{color_id}  {name}", font=ox_18, fill=PRIMARY)
        ratio = contrast_ratio(color, BOARD)
        draw.text((x + 14, 418), f"{color}  {ratio:.2f}:1", font=ox_18, fill=MUTED)

    # Corrections.
    rounded_panel(draw, (1080, 194, 1530, 474))
    draw.text((1115, 222), "TWO CORRECTIONS", font=ox_22, fill=CYAN_UI)
    corrections = [
        ("C5 SAND", "#A66CFF", "#C257B7", "blue-purple TO magenta"),
        ("IDLE BORDER", "#375373", "#4E7398", "2.36:1 TO 3.77:1"),
    ]
    y = 267
    for label, old, new, note in corrections:
        draw.text((1115, y), label, font=ox_18, fill=MUTED)
        draw.rounded_rectangle((1115, y + 32, 1219, y + 72), radius=8, fill=old)
        draw.line((1238, y + 52, 1266, y + 52), fill=SECONDARY, width=3)
        draw.polygon(((1266, y + 52), (1258, y + 46), (1258, y + 58)), fill=SECONDARY)
        draw.rounded_rectangle((1284, y + 32, 1388, y + 72), radius=8, fill=new)
        draw.text((1405, y + 38), "PASS", font=ox_18, fill=CYAN_UI)
        draw.text((1115, y + 82), note, font=ox_18, fill=SECONDARY)
        y += 103

    # CVD simulations.
    rounded_panel(draw, (70, 504, 1530, 810))
    draw.text((105, 532), "COLOR-VISION SIMULATION", font=ox_22, fill=CYAN_UI)
    row_names = ["NORMAL", *CVD_MATRICES.keys()]
    row_y = 582
    for row_name in row_names:
        draw.text((105, row_y + 14), row_name, font=ox_18, fill=MUTED)
        for index, (color_id, _name, color) in enumerate(SAND_COLORS):
            shown = color if row_name == "NORMAL" else cvd_color(color, CVD_MATRICES[row_name])
            x = 330 + index * 222
            draw.rounded_rectangle((x, row_y, x + 190, row_y + 48), radius=10, fill=shown)
            text_color = "#07101C" if contrast_ratio(shown, "#07101C") >= 4.5 else PRIMARY
            draw.text((x + 14, row_y + 12), color_id, font=ox_18, fill=text_color)
        row_y += 58
    # Text and UI contrast.
    rounded_panel(draw, (70, 840, 1035, 1030))
    draw.text((105, 868), "TEXT / UI CONTRAST", font=ox_22, fill=CYAN_UI)
    samples = [
        ("PRIMARY", "#EEF3FF", "TEXT", 16.85),
        ("SECONDARY", "#B4C2DB", "TEXT", 10.41),
        ("HINT", "#6F8EB1", "TEXT", 5.51),
        ("DANGER", "#FF636B", "TEXT", 6.46),
        ("IDLE BORDER", "#4E7398", "UI", 3.77),
    ]
    x = 105
    for name, color, kind, ratio in samples:
        draw.rounded_rectangle((x, 920, x + 164, 992), radius=10, fill=PANEL_2, outline=color, width=2)
        draw.text((x + 12, 932), name, font=ox_18, fill=color)
        draw.text((x + 12, 964), f"{ratio:.2f}:1 {kind}", font=ox_18, fill=SECONDARY)
        x += 180

    # Low-light review.
    rounded_panel(draw, (1065, 840, 1530, 1030))
    draw.text((1100, 868), "LOW LIGHT · 35%", font=ox_22, fill=CYAN_UI)
    for index, (color_id, _name, color) in enumerate(SAND_COLORS):
        x = 1100 + index * 80
        shown = low_light_color(color)
        draw.rounded_rectangle((x, 922, x + 64, 986), radius=10, fill=shown)
        draw.text((x + 20, 996), color_id, font=ox_18, fill=MUTED)

    draw.text((78, 1062), "WCAG 2.2 review baseline  ·  Machado et al. CVD preview  ·  final validation on WeChat and Douyin devices", font=ox_18, fill=MUTED)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, optimize=True, quality=95)


if __name__ == "__main__":
    main()
