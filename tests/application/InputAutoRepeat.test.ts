import { describe, expect, it } from "vitest";
import { InputAutoRepeat } from "../../assets/scripts/application/InputAutoRepeat";

describe("InputAutoRepeat", () => {
  it("waits for the initial delay and then repeats at a steady interval", () => {
    const repeat = new InputAutoRepeat({
      initialDelayMs: 170,
      repeatIntervalMs: 55,
    });

    expect(repeat.advance(0.1)).toBe(0);
    expect(repeat.advance(0.069)).toBe(0);
    expect(repeat.advance(0.001)).toBe(1);
    expect(repeat.advance(0.054)).toBe(0);
    expect(repeat.advance(0.001)).toBe(1);
  });

  it("resets to the initial hold delay when direction changes", () => {
    const repeat = new InputAutoRepeat({
      initialDelayMs: 100,
      repeatIntervalMs: 40,
    });

    expect(repeat.advance(0.1)).toBe(1);
    repeat.reset();
    expect(repeat.advance(0.05)).toBe(0);
    expect(repeat.advance(0.05)).toBe(1);
  });

  it("caps catch-up inputs after a stalled frame", () => {
    const repeat = new InputAutoRepeat({
      initialDelayMs: 100,
      repeatIntervalMs: 40,
      maxRepeatsPerUpdate: 3,
    });

    expect(repeat.advance(1)).toBe(3);
    expect(repeat.advance(0.019)).toBe(0);
    expect(repeat.advance(0.001)).toBe(1);
  });

  it("rejects invalid timing options and deltas", () => {
    expect(() => new InputAutoRepeat({ initialDelayMs: -1, repeatIntervalMs: 50 })).toThrow(
      RangeError,
    );
    const repeat = new InputAutoRepeat({ initialDelayMs: 100, repeatIntervalMs: 50 });
    expect(() => repeat.advance(-0.1)).toThrow(RangeError);
  });
});
