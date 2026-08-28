import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, sandBoardSize } from "../../assets/scripts/core/RulesConfig";

describe("DEFAULT_RULES", () => {
  it("uses four colors and the fine-grain board preset", () => {
    expect(DEFAULT_RULES.colorCount).toBe(4);
    expect(DEFAULT_RULES.grainsPerCell).toBe(10);
    expect(DEFAULT_RULES.normalFallIntervalMs).toBe(600);
    expect(DEFAULT_RULES.lockDelayMs).toBe(120);
    expect(DEFAULT_RULES.clearEffectDurationMs).toBe(420);
    expect(sandBoardSize(DEFAULT_RULES)).toEqual({ width: 100, height: 240 });
  });
});
