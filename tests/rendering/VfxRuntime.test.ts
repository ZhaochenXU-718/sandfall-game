import { describe, expect, it } from "vitest";
import {
  parseVfxAtlasLayout,
  REQUIRED_VFX_SPRITES,
  VfxBudget,
} from "../../assets/scripts/rendering/VfxRuntime";

function validLayout(): unknown {
  const sprites: Record<string, unknown> = {};
  REQUIRED_VFX_SPRITES.forEach((name, index) => {
    sprites[name] = {
      source: `${name}.png`,
      x: index * 8,
      y: 0,
      width: 8,
      height: 8,
      kind: name.includes("halo") || name.includes("ring") || name === "glow-core"
        ? "halo"
        : "particle",
    };
  });
  return { version: 1, width: 128, height: 16, padding: 0, sprites };
}

describe("parseVfxAtlasLayout", () => {
  it("accepts a complete non-overlapping atlas", () => {
    const layout = parseVfxAtlasLayout(validLayout());

    expect(layout.width).toBe(128);
    expect(Object.keys(layout.sprites)).toEqual([...REQUIRED_VFX_SPRITES]);
  });

  it("rejects missing, out-of-range, and overlapping sprites", () => {
    const missing = validLayout() as { sprites: Record<string, unknown> };
    delete missing.sprites[REQUIRED_VFX_SPRITES[0]];
    expect(() => parseVfxAtlasLayout(missing)).toThrow();

    const outside = validLayout() as { sprites: Record<string, { x: number }> };
    outside.sprites[REQUIRED_VFX_SPRITES[0]]!.x = 124;
    expect(() => parseVfxAtlasLayout(outside)).toThrow(RangeError);

    const overlap = validLayout() as { sprites: Record<string, { x: number }> };
    overlap.sprites[REQUIRED_VFX_SPRITES[1]]!.x = 0;
    expect(() => parseVfxAtlasLayout(overlap)).toThrow(RangeError);
  });
});

describe("VfxBudget", () => {
  it("enforces category and total limits", () => {
    const budget = new VfxBudget({ total: 3, particle: 2, halo: 1 });

    expect(budget.acquire("particle")).toBe(true);
    expect(budget.acquire("particle")).toBe(true);
    expect(budget.acquire("particle")).toBe(false);
    expect(budget.acquire("halo")).toBe(true);
    expect(budget.acquire("halo")).toBe(false);
    expect(budget.total).toBe(3);
  });

  it("releases and resets slots deterministically", () => {
    const budget = new VfxBudget({ total: 2, particle: 1, halo: 1 });
    budget.acquire("particle");
    budget.acquire("halo");

    budget.release("particle");
    expect(budget.count("particle")).toBe(0);
    expect(budget.acquire("particle")).toBe(true);
    budget.reset();
    expect(budget.total).toBe(0);
    expect(() => budget.release("halo")).toThrow();
  });

  it("validates impossible budgets", () => {
    expect(() => new VfxBudget({ total: 4, particle: 1, halo: 1 })).toThrow();
    expect(() => new VfxBudget({ total: -1, particle: 0, halo: 0 })).toThrow();
  });
});
