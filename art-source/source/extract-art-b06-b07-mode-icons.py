#!/usr/bin/env python3
"""Extract the approved 2D mode icons from the home-screen reference crops."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
CONCEPTS = ROOT / "art-source" / "concepts"
EXPORTS = ROOT / "art-source" / "exports" / "mode-icons"

ICONS = {
    "progressive": CONCEPTS / "art-b06-progressive-icon-reference.png",
    "classic": CONCEPTS / "art-b07-classic-icon-reference.png",
}

RESAMPLING = getattr(Image, "Resampling", Image)


def smoothstep(low: float, high: float, value: float) -> float:
    t = max(0.0, min(1.0, (value - low) / (high - low)))
    return t * t * (3.0 - 2.0 * t)


def extract_foreground(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    pixels = []

    # The approved crops sit on #050e1e-like navy. Bright square grains become
    # opaque; the surrounding UI grid is intentionally removed from the sprite.
    for red, green, blue, _ in image.getdata():
        peak = max(red, green, blue)
        alpha = round(255 * smoothstep(52, 112, peak))
        pixels.append((red, green, blue, alpha))

    extracted = Image.new("RGBA", image.size)
    extracted.putdata(pixels)

    alpha = extracted.getchannel("A")
    strong_mask = alpha.point(lambda value: 255 if value >= 72 else 0)
    bounds = strong_mask.getbbox()
    if not bounds:
        raise RuntimeError(f"No foreground detected in {source}")

    left, top, right, bottom = bounds
    width = right - left
    height = bottom - top
    padding = round(max(width, height) * 0.07)
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(extracted.width, right + padding)
    bottom = min(extracted.height, bottom + padding)
    return extracted.crop((left, top, right, bottom))


def normalize_square(subject: Image.Image, size: int = 256) -> Image.Image:
    available = round(size * 0.86)
    scale = min(available / subject.width, available / subject.height)
    fitted = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        RESAMPLING.LANCZOS,
    )
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - fitted.width) // 2
    y = (size - fitted.height) // 2
    canvas.alpha_composite(fitted, (x, y))
    return canvas


def export_icon(name: str, source: Path) -> None:
    normalized = normalize_square(extract_foreground(source))
    EXPORTS.mkdir(parents=True, exist_ok=True)

    normalized.save(EXPORTS / f"luosha-mode-{name}-256.png")
    normalized.resize((1024, 1024), RESAMPLING.NEAREST).save(
        EXPORTS / f"luosha-mode-{name}-1024.png"
    )
    for size in (128, 64, 48):
        normalized.resize((size, size), RESAMPLING.LANCZOS).save(
            EXPORTS / f"luosha-mode-{name}-{size}.png"
        )


def main() -> None:
    for name, source in ICONS.items():
        export_icon(name, source)


if __name__ == "__main__":
    main()
