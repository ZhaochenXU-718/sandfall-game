import { describe, expect, it } from "vitest";
import { sandifyGrainVisible } from "../../assets/scripts/rendering/SandifyDissolve";

describe("sandifyGrainVisible", () => {
  it("keeps full coverage visible and zero coverage hidden", () => {
    expect(sandifyGrainVisible(3, 7, 1)).toBe(true);
    expect(sandifyGrainVisible(3, 7, 0)).toBe(false);
  });

  it("removes grains monotonically as coverage decreases", () => {
    for (let y = 0; y < 12; y += 1) {
      for (let x = 0; x < 12; x += 1) {
        if (sandifyGrainVisible(x, y, 0.35)) {
          expect(sandifyGrainVisible(x, y, 0.7)).toBe(true);
        }
      }
    }
  });

  it("creates a mixed deterministic mask at partial coverage", () => {
    const first = Array.from({ length: 144 }, (_, index) =>
      sandifyGrainVisible(index % 12, Math.floor(index / 12), 0.5));
    const second = Array.from({ length: 144 }, (_, index) =>
      sandifyGrainVisible(index % 12, Math.floor(index / 12), 0.5));

    expect(new Set(first).size).toBe(2);
    expect(second).toEqual(first);
  });

  it("validates coordinates and coverage", () => {
    expect(() => sandifyGrainVisible(0.5, 1, 0.5)).toThrow(RangeError);
    expect(() => sandifyGrainVisible(1, 1, 1.1)).toThrow(RangeError);
  });
});
