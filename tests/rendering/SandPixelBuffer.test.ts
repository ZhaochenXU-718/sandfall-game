import { describe, expect, it } from "vitest";
import { SandPixelBuffer } from "../../assets/scripts/rendering/SandPixelBuffer";

const PALETTE = [
  { r: 1, g: 2, b: 3, a: 255 },
  { r: 10, g: 20, b: 30, a: 255 },
] as const;

describe("SandPixelBuffer", () => {
  it("maps every color id to RGBA8888 pixels on first upload", () => {
    const buffer = new SandPixelBuffer({ width: 2, height: 1, palette: PALETTE });
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
});
