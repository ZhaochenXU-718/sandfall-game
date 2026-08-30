import { describe, expect, it } from "vitest";
import {
  dangerZonePulse,
  sampleDangerZone,
} from "../../assets/scripts/rendering/DangerZoneEffect";

describe("sampleDangerZone", () => {
  const width = 12;
  const height = 20;
  const zoneRows = 4;

  it("stays inactive while the top zone is empty", () => {
    const cells = new Uint8Array(width * height);
    cells[zoneRows * width] = 1;

    expect(sampleDangerZone(cells, width, height, zoneRows)).toEqual({
      intensity: 0,
      occupiedCount: 0,
      topmostOccupiedRow: undefined,
    });
  });

  it("increases as settled sand approaches the spawn row", () => {
    const low = new Uint8Array(width * height);
    const high = new Uint8Array(width * height);
    low[(zoneRows - 1) * width + 3] = 1;
    high[3] = 1;

    const lowSample = sampleDangerZone(low, width, height, zoneRows);
    const highSample = sampleDangerZone(high, width, height, zoneRows);

    expect(lowSample.topmostOccupiedRow).toBe(zoneRows - 1);
    expect(highSample.topmostOccupiedRow).toBe(0);
    expect(highSample.intensity).toBeGreaterThan(lowSample.intensity);
  });

  it("uses density as a secondary signal and clamps the result", () => {
    const sparse = new Uint8Array(width * height);
    const dense = new Uint8Array(width * height);
    sparse[width + 1] = 1;
    dense.fill(1, width, zoneRows * width);

    const sparseSample = sampleDangerZone(sparse, width, height, zoneRows);
    const denseSample = sampleDangerZone(dense, width, height, zoneRows);

    expect(denseSample.intensity).toBeGreaterThan(sparseSample.intensity);
    expect(denseSample.intensity).toBeLessThanOrEqual(1);
  });

  it("validates dimensions and buffer length", () => {
    expect(() => sampleDangerZone(new Uint8Array(4), 2, 2, 3)).toThrow(RangeError);
    expect(() => sampleDangerZone(new Uint8Array(3), 2, 2, 1)).toThrow(RangeError);
  });
});

describe("dangerZonePulse", () => {
  it("uses restrained modulation without exceeding the source intensity", () => {
    const samples = Array.from({ length: 120 }, (_, index) =>
      dangerZonePulse(0.8, index / 60));

    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0.8 * 0.76);
    expect(Math.max(...samples)).toBeLessThanOrEqual(0.8);
  });

  it("validates its inputs", () => {
    expect(() => dangerZonePulse(1.1, 0)).toThrow(RangeError);
    expect(() => dangerZonePulse(0.5, -1)).toThrow(RangeError);
  });
});
