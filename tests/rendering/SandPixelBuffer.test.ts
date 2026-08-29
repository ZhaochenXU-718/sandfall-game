import { describe, expect, it } from "vitest";
import {
  SandPixelBuffer,
  clearFlashIntensity,
  clearGlowTargetChannel,
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

  it("glows only masked grains in their own hue and restores their texture", () => {
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
    expect(buffer.pixels).toEqual(Uint8Array.from([
      20, 38, 56, 255,
      10, 20, 30, 255,
    ]));

    buffer.update(cells);
    expect(buffer.pixels).toEqual(Uint8Array.from([
      10, 20, 30, 255,
      10, 20, 30, 255,
    ]));
  });

  it("brightens palette channels without flattening them to white", () => {
    expect(clearGlowTargetChannel(255)).toBe(255);
    expect(clearGlowTargetChannel(107)).toBe(169);
    expect(clearGlowTargetChannel(78)).toBe(132);
    expect(clearGlowTargetChannel(0)).toBe(0);
    expect(() => clearGlowTargetChannel(255.1)).toThrow(RangeError);
  });

  it("produces two colored-light peaks across one clear effect", () => {
    expect(clearFlashIntensity(0)).toBe(0);
    expect(clearFlashIntensity(0.25)).toBeCloseTo(1);
    expect(clearFlashIntensity(0.5)).toBeCloseTo(0);
    expect(clearFlashIntensity(0.75)).toBeCloseTo(1);
    expect(clearFlashIntensity(1)).toBe(0);
  });
});
