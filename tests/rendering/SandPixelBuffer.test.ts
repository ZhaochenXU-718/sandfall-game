import { describe, expect, it } from "vitest";
import {
  SandPixelBuffer,
  clearFlashIntensity,
  clearGlowColor,
} from "../../assets/scripts/rendering/SandPixelBuffer";

const PALETTE = [
  { r: 1, g: 2, b: 3, a: 255 },
  { r: 10, g: 20, b: 30, a: 255 },
] as const;

describe("SandPixelBuffer", () => {
  it("maps every color id to RGBA8888 pixels on first upload", () => {
    const buffer = new SandPixelBuffer({
      width: 2,
      height: 1,
      palette: PALETTE,
      shadeStrength: 0,
    });
    const result = buffer.update(Uint8Array.from([0, 1]));
    expect(result.changedCount).toBe(2);
    expect(buffer.pixels).toEqual(Uint8Array.from([
      1, 2, 3, 255,
      10, 20, 30, 255,
    ]));
  });

  it("skips an upload when source colors did not change", () => {
    const buffer = new SandPixelBuffer({ width: 2, height: 1, palette: PALETTE });
    const cells = Uint8Array.from([0, 1]);
    buffer.update(cells);
    const result = buffer.update(cells);
    expect(result.changedCount).toBe(0);
    expect(result.dirtyMinX).toBe(-1);
  });

  it("flips rows for bottom-origin texture coordinates", () => {
    const buffer = new SandPixelBuffer({
      width: 1,
      height: 2,
      palette: PALETTE,
      flipY: true,
      shadeStrength: 0,
    });
    buffer.update(Uint8Array.from([1, 0]));
    expect(buffer.pixels).toEqual(Uint8Array.from([
      1, 2, 3, 255,
      10, 20, 30, 255,
    ]));
  });

  it("rejects a color id without a palette entry", () => {
    const buffer = new SandPixelBuffer({ width: 1, height: 1, palette: PALETTE });
    expect(() => buffer.update(Uint8Array.from([2]))).toThrow(RangeError);
  });

  it("adds stable light and dark variants to grains of the same color", () => {
    const first = new SandPixelBuffer({
      width: 8,
      height: 1,
      palette: PALETTE,
      shadeStrength: 0.2,
    });
    const second = new SandPixelBuffer({
      width: 8,
      height: 1,
      palette: PALETTE,
      shadeStrength: 0.2,
    });
    const cells = Uint8Array.from({ length: 8 }, () => 1);
    first.update(cells);
    second.update(cells);

    const redChannels = Array.from({ length: 8 }, (_, index) => first.pixels[index * 4]);
    expect(new Set(redChannels).size).toBeGreaterThan(1);
    expect(second.pixels).toEqual(first.pixels);
  });

  it("keeps an explicit shade variant attached to a moving grain", () => {
    const buffer = new SandPixelBuffer({
      width: 2,
      height: 1,
      palette: PALETTE,
      shadeStrength: 0.2,
    });
    buffer.update(
      Uint8Array.from([1, 0]),
      undefined,
      0,
      Uint8Array.from([37, 0]),
    );
    const shadeBeforeMove = buffer.pixels[0];

    buffer.update(
      Uint8Array.from([0, 1]),
      undefined,
      0,
      Uint8Array.from([0, 37]),
    );
    expect(buffer.pixels[4]).toBe(shadeBeforeMove);
  });

  it("keeps empty board pixels flat and validates texture strength", () => {
    const buffer = new SandPixelBuffer({
      width: 2,
      height: 1,
      palette: PALETTE,
      shadeStrength: 0.3,
    });
    buffer.update(Uint8Array.from([0, 0]));
    expect(buffer.pixels).toEqual(Uint8Array.from([
      1, 2, 3, 255,
      1, 2, 3, 255,
    ]));
    expect(() => new SandPixelBuffer({
      width: 1,
      height: 1,
      shadeStrength: 1.01,
    })).toThrow(RangeError);
  });

  it("adds a saturated halo around masked grains and restores their texture", () => {
    const buffer = new SandPixelBuffer({
      width: 2,
      height: 1,
      palette: PALETTE,
      shadeStrength: 0,
    });
    const cells = Uint8Array.from([1, 1]);
    const mask = Uint8Array.from([1, 0]);
    buffer.update(cells);
    buffer.update(cells, mask, 1);
    const core = [...buffer.pixels.slice(0, 3)];
    const halo = [...buffer.pixels.slice(4, 7)];
    expect(core[2]).toBe(255);
    expect(halo[2]).toBeGreaterThan(30);
    expect(halo[2]).toBeLessThan(core[2] ?? 0);

    buffer.update(cells);
    expect(buffer.pixels).toEqual(Uint8Array.from([
      10, 20, 30, 255,
      10, 20, 30, 255,
    ]));
  });

  it("creates high-saturation glow colors without flattening them to white", () => {
    expect(clearGlowColor({ r: 255, g: 107, b: 107, a: 255 })).toEqual({
      r: 255, g: 18, b: 18, a: 255,
    });
    expect(clearGlowColor({ r: 78, g: 205, b: 196, a: 255 })).toEqual({
      r: 18, g: 255, b: 238, a: 255,
    });
    expect(() => clearGlowColor({ r: 255.1, g: 0, b: 0, a: 255 })).toThrow(RangeError);
  });

  it("produces two colored-light peaks across one clear effect", () => {
    expect(clearFlashIntensity(0)).toBe(0);
    expect(clearFlashIntensity(0.25)).toBeCloseTo(1);
    expect(clearFlashIntensity(0.125)).toBeGreaterThan(0.75);
    expect(clearFlashIntensity(0.5)).toBeCloseTo(0);
    expect(clearFlashIntensity(0.75)).toBeCloseTo(1);
    expect(clearFlashIntensity(0.25, 3)).toBeCloseTo(1.36);
    expect(clearFlashIntensity(1)).toBe(0);
  });
});
