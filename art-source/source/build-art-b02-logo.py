"""Build the ART-B02 pixel-grain logo system.

The Chinese wordmark is sampled once from Noto Sans SC Bold and rebuilt as
independent square vector grains.  The output therefore keeps a recognizable
glyph skeleton without depending on a font at runtime.  English lettering is
converted to self-contained Oxanium paths by the companion Swift extractor.

Usage:
  python build-art-b02-logo.py \
    --noto /path/to/NotoSansSC[wght].ttf \
    --oxanium /path/to/Oxanium[wght].ttf \
    --output-dir art-source/source/logo
"""

from __future__ import annotations

import argparse
import math
import re
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
EXTRACTOR_SOURCE = ROOT / "extract-font-glyphs.swift"
EXTRACTOR_BINARY = Path("/private/tmp/sandfall-extract-font-glyphs")
SWIFT_CACHE = Path("/private/tmp/sandfall-swift-cache")

GRID = 28
STEP = 6.1
CELL = 5.45
GLYPH_SIZE = (GRID - 1) * STEP + CELL
WORD_GAP = 58.0
WORD_WIDTH = GLYPH_SIZE * 2 + WORD_GAP

WARM_STOPS = ((255, 200, 87), (255, 145, 54), (255, 93, 88))
COOL_STOPS = ((68, 224, 211), (40, 181, 229), (73, 101, 240))
ENGLISH_COLORS = [
    "#44DDD3", "#38BDEB", "#4C7BEE", "#D155C2",
    "#FF625F", "#FFC857", "#39D5CD", "#B35BD0",
]


def compile_extractor() -> None:
    SWIFT_CACHE.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "swiftc",
            "-module-cache-path",
            str(SWIFT_CACHE),
            str(EXTRACTOR_SOURCE),
            "-o",
            str(EXTRACTOR_BINARY),
        ],
        check=True,
    )


def extract_paths(font: Path, text: str, size: int, weight: int, tracking: int) -> tuple[float, list[str]]:
    result = subprocess.run(
        [
            str(EXTRACTOR_BINARY),
            "--font",
            str(font),
            "--text",
            text,
            "--size",
            str(size),
            "--weight",
            str(weight),
            "--tracking",
            str(tracking),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    lines = result.stdout.strip().splitlines()
    width_match = re.search(r"width=([0-9.]+)", lines[0])
    if width_match is None:
        raise RuntimeError("glyph extractor did not report a width")
    paths = [line for line in lines[1:] if line.startswith("<path ")]
    if not paths:
        raise RuntimeError("glyph extractor did not report any paths")
    return float(width_match.group(1)), paths


def glyph_mask(font_path: Path, glyph: str) -> np.ndarray:
    """Rasterize a complete Bold skeleton into a deterministic 28-square mask."""
    font = ImageFont.truetype(str(font_path), 448)
    font.set_variation_by_name("Bold")
    bbox = font.getbbox(glyph, stroke_width=0)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    canvas = Image.new("L", (width + 48, height + 48), 0)
    draw = ImageDraw.Draw(canvas)
    draw.text((24 - bbox[0], 24 - bbox[1]), glyph, font=font, fill=255)
    crop = canvas.getbbox()
    if crop is None:
        raise RuntimeError(f"could not rasterize {glyph}")
    image = canvas.crop(crop)
    # One clear cell of breathing room prevents edge clipping in the SVG.
    image.thumbnail((GRID - 2, GRID - 2), Image.Resampling.LANCZOS)
    grid = Image.new("L", (GRID, GRID), 0)
    grid.paste(image, ((GRID - image.width) // 2, (GRID - image.height) // 2))
    return np.asarray(grid) >= 108


def interpolate(stops: tuple[tuple[int, int, int], ...], position: float) -> tuple[int, int, int]:
    position = max(0.0, min(1.0, position))
    scaled = position * (len(stops) - 1)
    index = min(int(scaled), len(stops) - 2)
    local = scaled - index
    return tuple(round(a + (b - a) * local) for a, b in zip(stops[index], stops[index + 1]))


def tint(color: tuple[int, int, int], delta: int) -> tuple[int, int, int]:
    return tuple(max(0, min(255, channel + delta)) for channel in color)


def hex_color(color: tuple[int, int, int]) -> str:
    return "#%02X%02X%02X" % color


def grain_cell(x: float, y: float, size: float, color: tuple[int, int, int], key: int, mono: bool = False) -> str:
    variation = 0 if mono else ((key * 19 + 7) % 17) - 8
    base = tint(color, variation)
    highlight_height = max(0.55, size * 0.12)
    shade_width = max(0.5, size * 0.11)
    return (
        f'<rect x="{x:.2f}" y="{y:.2f}" width="{size:.2f}" height="{size:.2f}" rx="0.55" fill="{hex_color(base)}"/>'
        f'<rect x="{x + 0.55:.2f}" y="{y + 0.48:.2f}" width="{max(0.6, size - 1.1):.2f}" height="{highlight_height:.2f}" rx="0.25" fill="#FFFFFF" opacity="0.24"/>'
        f'<rect x="{x + size - shade_width:.2f}" y="{y + 0.7:.2f}" width="{shade_width:.2f}" height="{max(0.5, size - 1.15):.2f}" rx="0.2" fill="#07101F" opacity="0.18"/>'
        f'<rect x="{x + 0.7:.2f}" y="{y + size - highlight_height:.2f}" width="{max(0.5, size - 1.25):.2f}" height="{highlight_height:.2f}" rx="0.2" fill="#07101F" opacity="0.13"/>'
    )


def grain_glyph(mask: np.ndarray, identifier: str, stops: tuple[tuple[int, int, int], ...], mono: str | None = None) -> str:
    cells: list[str] = []
    mono_rgb = tuple(int(mono[index:index + 2], 16) for index in (1, 3, 5)) if mono else None
    for row, column in np.argwhere(mask):
        position = row / max(1, GRID - 1)
        color = mono_rgb or interpolate(stops, position)
        cells.append(grain_cell(column * STEP, row * STEP, CELL, color, row * GRID + column, mono=bool(mono)))
    return f'<g id="{identifier}" shape-rendering="geometricPrecision">{"".join(cells)}</g>'


def logo_defs(warm_mask: np.ndarray, cool_mask: np.ndarray, prefix: str, mono: str | None = None) -> str:
    return f'''  <defs>
    <filter id="{prefix}-warm-glow" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="4.8"/>
    </filter>
    <filter id="{prefix}-cool-glow" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="4.8"/>
    </filter>
    {grain_glyph(warm_mask, f'{prefix}-warm-glyph', WARM_STOPS, mono)}
    {grain_glyph(cool_mask, f'{prefix}-cool-glyph', COOL_STOPS, mono)}
  </defs>'''


def bridge_grains(x: float, y: float, scale: float = 1.0, mono: str | None = None) -> str:
    palette = [WARM_STOPS[-1], (236, 78, 124), (195, 81, 181), (135, 91, 210), (75, 115, 237), COOL_STOPS[1]]
    cells: list[str] = []
    # A broad, broken stream reads as moving sand after the logo is scaled down.
    # The central spine carries continuity; two irregular satellite lanes keep it
    # from collapsing into a single pixel line.
    count = 21
    for index in range(count):
        progress = index / (count - 1)
        px = x + index * 5.4 * scale
        py = y + (math.sin(index * 0.82) * 3.4 + ((index * 7) % 3 - 1) * 1.15) * scale
        size = (4.9 + (index * 5 % 4) * 0.38) * scale
        color = tuple(int(mono[k:k + 2], 16) for k in (1, 3, 5)) if mono else interpolate(tuple(palette), progress)
        cells.append(grain_cell(px, py, size, color, 900 + index, mono=bool(mono)))
    satellites = [
        (-8, -9, 4.5, 0.02), (2, 8, 3.7, 0.08), (11, -7, 4.1, 0.13),
        (20, 10, 4.6, 0.20), (31, -10, 3.5, 0.29), (39, 7, 4.1, 0.36),
        (49, -7, 4.8, 0.44), (58, 11, 3.6, 0.52), (68, -10, 4.3, 0.61),
        (77, 8, 4.8, 0.69), (88, -7, 3.7, 0.78), (96, 11, 4.2, 0.86),
        (107, -9, 4.5, 0.94), (116, 6, 3.6, 0.99),
        (15, 16, 2.9, 0.17), (42, -16, 3.0, 0.39),
        (73, 16, 3.1, 0.66), (101, -15, 2.9, 0.91),
    ]
    for index, (dx, dy, size, progress) in enumerate(satellites):
        color = tuple(int(mono[k:k + 2], 16) for k in (1, 3, 5)) if mono else interpolate(tuple(palette), progress)
        cells.append(grain_cell(x + dx * scale, y + dy * scale, size * scale, color, 980 + index, mono=bool(mono)))
    return f'<g aria-hidden="true">{"".join(cells)}</g>'


def falling_grains(word_x: float, word_y: float, scale: float = 1.0, mono: str | None = None) -> str:
    entries = [
        (18, 172, 7.2, WARM_STOPS[2]), (35, 181, 5.8, WARM_STOPS[1]),
        (51, 175, 6.4, WARM_STOPS[2]), (68, 192, 5.1, WARM_STOPS[0]),
        (87, 184, 4.8, WARM_STOPS[1]), (103, 207, 4.3, WARM_STOPS[2]),
        (43, 215, 3.8, WARM_STOPS[0]),
        (316, 173, 7.0, COOL_STOPS[2]), (334, 185, 6.2, COOL_STOPS[0]),
        (351, 177, 5.4, COOL_STOPS[1]), (367, 198, 5.8, (194, 81, 181)),
        (341, 207, 4.7, COOL_STOPS[1]), (382, 216, 4.2, WARM_STOPS[2]),
        (359, 224, 3.7, COOL_STOPS[0]),
    ]
    cells: list[str] = []
    mono_rgb = tuple(int(mono[k:k + 2], 16) for k in (1, 3, 5)) if mono else None
    for index, (dx, dy, size, color) in enumerate(entries):
        cells.append(grain_cell(word_x + dx * scale, word_y + dy * scale, size * scale, mono_rgb or color, 1100 + index, mono=bool(mono)))
    return f'<g aria-hidden="true">{"".join(cells)}</g>'


def wordmark(warm_id: str, cool_id: str, x: float, y: float, prefix: str, scale: float = 1.0, mono: str | None = None) -> str:
    second_x = GLYPH_SIZE + WORD_GAP
    bridge_x = GLYPH_SIZE - 24
    bridge_y = 84
    glow_opacity = 0.25 if mono is None else 0.13
    return f'''  <g transform="translate({x:.2f} {y:.2f}) scale({scale:.4f})" aria-label="落沙">
    <use href="#{warm_id}" filter="url(#{prefix}-warm-glow)" opacity="{glow_opacity}"/>
    <use href="#{cool_id}" x="{second_x:.2f}" filter="url(#{prefix}-cool-glow)" opacity="{glow_opacity}"/>
    <use href="#{warm_id}"/>
    <use href="#{cool_id}" x="{second_x:.2f}"/>
    {bridge_grains(bridge_x, bridge_y, mono=mono)}
  </g>
  {falling_grains(x, y, scale, mono)}'''


def english_paths(paths: list[str], width: float, center_x: float, baseline: float, scale: float = 1.0, mono: str | None = None) -> str:
    x = center_x - width * scale / 2
    output = []
    for index, path in enumerate(paths):
        color = mono or ENGLISH_COLORS[index % len(ENGLISH_COLORS)]
        output.append(path.replace("<path ", f'<path fill="{color}" '))
    return f'''  <g transform="translate({x:.2f} {baseline:.2f}) scale({scale:.4f})" aria-label="SANDFALL">
    {''.join(output)}
  </g>'''


def svg_document(width: int, height: int, title: str, body: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">
  <title id="title">{title}</title>
  <desc id="desc">Sandfall / 落沙 logo built from illuminated square sand grains joined by a horizontal stream.</desc>
  <metadata>
    ART-B02. Chinese skeleton sampled from Noto Sans SC Bold and rebuilt as square vector grains; English paths derived from Oxanium SemiBold. Source fonts use SIL OFL 1.1.
  </metadata>
{body}
</svg>
'''


def build_mark() -> str:
    left = [
        "1111110", "1100000", "1100000", "1111100", "1100000", "1100000", "1111110",
    ]
    right = [
        "0111111", "0000011", "0000011", "0011111", "0000011", "0000011", "0111111",
    ]
    cells: list[str] = []
    step = 14.0
    size = 12.4
    for side, pattern, origin, stops in ((0, left, (29, 52), WARM_STOPS), (1, right, (129, 52), COOL_STOPS)):
        for row, line in enumerate(pattern):
            for column, occupied in enumerate(line):
                if occupied == "1":
                    cells.append(grain_cell(origin[0] + column * step, origin[1] + row * step, size, interpolate(stops, row / 6), side * 100 + row * 7 + column))
    cells.append(bridge_grains(104, 96, 0.48))
    for index, (x, y, size, color) in enumerate(((198, 166, 9, COOL_STOPS[2]), (213, 183, 8, COOL_STOPS[0]), (202, 201, 6.5, (195, 81, 181)), (218, 216, 5, WARM_STOPS[0]))):
        cells.append(grain_cell(x, y, size, color, 1300 + index))
    return "".join(cells)


def build_files(noto: Path, oxanium: Path, output_dir: Path) -> None:
    compile_extractor()
    masks = [glyph_mask(noto, glyph) for glyph in "落沙"]
    english_width, english = extract_paths(oxanium, "SANDFALL", 38, 600, 7)
    output_dir.mkdir(parents=True, exist_ok=True)

    x = (640 - WORD_WIDTH) / 2
    y = 25.0
    horizontal = "\n".join([
        logo_defs(masks[0], masks[1], "h"),
        wordmark("h-warm-glyph", "h-cool-glyph", x, y, "h"),
    ])
    (output_dir / "luosha-logo-horizontal.svg").write_text(svg_document(640, 260, "落沙 horizontal pixel-grain logo", horizontal), encoding="utf-8")

    lockup = "\n".join([
        logo_defs(masks[0], masks[1], "l"),
        wordmark("l-warm-glyph", "l-cool-glyph", x, 17, "l"),
        english_paths(english, english_width, 320, 286, 0.96),
    ])
    (output_dir / "luosha-logo-lockup.svg").write_text(svg_document(640, 320, "落沙 and SANDFALL pixel-grain lockup", lockup), encoding="utf-8")

    vertical_scale = 0.78
    vertical_x = (420 - WORD_WIDTH * vertical_scale) / 2
    vertical = "\n".join([
        logo_defs(masks[0], masks[1], "v"),
        wordmark("v-warm-glyph", "v-cool-glyph", vertical_x, 64, "v", vertical_scale),
        english_paths(english, english_width, 210, 334, 0.78),
    ])
    (output_dir / "luosha-logo-vertical.svg").write_text(svg_document(420, 420, "落沙 vertical pixel-grain logo lockup", vertical), encoding="utf-8")

    for filename, color in (("luosha-logo-monochrome.svg", "#EEF3FF"), ("luosha-logo-monochrome-dark.svg", "#101827")):
        prefix = "ml" if color == "#EEF3FF" else "md"
        mono = "\n".join([
            logo_defs(masks[0], masks[1], prefix, color),
            wordmark(f"{prefix}-warm-glyph", f"{prefix}-cool-glyph", x, y, prefix, mono=color),
        ])
        (output_dir / filename).write_text(svg_document(640, 260, "落沙 monochrome pixel-grain logo", mono), encoding="utf-8")

    mark_body = f'''  <defs>
    <filter id="mark-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
    <g id="mark-grains">{build_mark()}</g>
  </defs>
  <use href="#mark-grains" filter="url(#mark-glow)" opacity="0.24"/>
  <use href="#mark-grains" aria-label="Sand bridge brand mark"/>'''
    (output_dir / "luosha-logo-mark.svg").write_text(svg_document(256, 256, "落沙 square-grain bridge mark", mark_body), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--noto", required=True, type=Path)
    parser.add_argument("--oxanium", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    arguments = parser.parse_args()
    build_files(arguments.noto, arguments.oxanium, arguments.output_dir)


if __name__ == "__main__":
    main()
