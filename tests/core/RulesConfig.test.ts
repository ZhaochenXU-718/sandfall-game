import { describe, expect, it } from "vitest";
import {
  CLEARS_PER_LEVEL,
  DEFAULT_LEVEL_FALL_INTERVALS_MS,
  DEFAULT_RULES,
  PROGRESSIVE_COLOR_UNLOCK_LEVEL,
  colorCountForLevel,
  levelForClearCount,
  normalFallIntervalForLevel,
  sandBoardSize,
} from "../../assets/scripts/core/RulesConfig";

describe("DEFAULT_RULES", () => {
  it("uses four colors and the fine-grain board preset", () => {
    expect(DEFAULT_RULES.colorCount).toBe(4);
    expect(DEFAULT_RULES.grainsPerCell).toBe(9);
    expect(DEFAULT_RULES.sandSubsteps).toBe(2);
    expect(DEFAULT_RULES.normalFallIntervalMs).toBe(600);
    expect(DEFAULT_RULES.lockDelayMs).toBe(120);
    expect(DEFAULT_RULES.clearEffectDurationMs).toBe(420);
    expect(DEFAULT_RULES.softDropPointsPerRow).toBe(1);
    expect(DEFAULT_RULES.hardDropPointsPerRow).toBe(2);
    expect(DEFAULT_RULES.spanningComponentBonus).toBe(200);
    expect(DEFAULT_RULES.chainMultiplierStep).toBe(0.5);
    expect(DEFAULT_RULES.macroWidth).toBe(12);
    expect(DEFAULT_RULES.macroHeight).toBe(20);
    expect(sandBoardSize(DEFAULT_RULES)).toEqual({ width: 108, height: 180 });
  });

  it("raises the level every five clears and caps the fall-speed curve at level 6", () => {
    expect(CLEARS_PER_LEVEL).toBe(5);
    expect(DEFAULT_LEVEL_FALL_INTERVALS_MS).toEqual([600, 520, 450, 390, 340, 300]);
    expect(levelForClearCount(0)).toBe(1);
    expect(levelForClearCount(4)).toBe(1);
    expect(levelForClearCount(5)).toBe(2);
    expect(levelForClearCount(25)).toBe(6);
    expect(levelForClearCount(100)).toBe(6);
    expect(normalFallIntervalForLevel(600, 4)).toBe(390);
    expect(normalFallIntervalForLevel(600, 99)).toBe(300);
  });

  it("unlocks the fifth color at progressive level 4 but keeps classic rules fixed", () => {
    expect(PROGRESSIVE_COLOR_UNLOCK_LEVEL).toBe(4);
    expect(colorCountForLevel(4, 3, "progressive")).toBe(4);
    expect(colorCountForLevel(4, 4, "progressive")).toBe(5);
    expect(colorCountForLevel(3, 6, "classic")).toBe(3);
    expect(levelForClearCount(100, "classic")).toBe(1);
    expect(normalFallIntervalForLevel(750, 6, "classic")).toBe(750);
  });
});
