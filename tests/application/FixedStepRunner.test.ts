import { describe, expect, it, vi } from "vitest";
import { FixedStepRunner } from "../../assets/scripts/application/FixedStepRunner";

describe("FixedStepRunner", () => {
  it("converts a render delta into fixed simulation steps", () => {
    const step = vi.fn();
    const runner = new FixedStepRunner({ fixedHz: 60 }, step);
    const result = runner.advance(1 / 30);
    expect(result.steps).toBe(2);
    expect(step).toHaveBeenCalledTimes(2);
    expect(step).toHaveBeenCalledWith(1 / 60);
    expect(result.interpolationAlpha).toBeCloseTo(0);
  });

  it("caps catch-up work and reports discarded time", () => {
    const step = vi.fn();
    const runner = new FixedStepRunner({
      fixedHz: 10,
      maxFrameDeltaSeconds: 0.5,
      maxStepsPerFrame: 2,
    }, step);
    const result = runner.advance(1);
    expect(result.steps).toBe(2);
    expect(result.droppedSeconds).toBeCloseTo(0.8);
    expect(step).toHaveBeenCalledTimes(2);
  });

  it("can discard partial accumulated time after a pause", () => {
    const step = vi.fn();
    const runner = new FixedStepRunner({ fixedHz: 10 }, step);
    runner.advance(0.05);
    runner.reset();
    expect(runner.advance(0.05).steps).toBe(0);
    expect(step).not.toHaveBeenCalled();
  });
});
