import { describe, expect, it } from "vitest";
import { Randomizer } from "../../assets/scripts/core/Randomizer";

describe("Randomizer", () => {
  it("produces the same sequence for the same seed", () => {
    const first = new Randomizer(12345);
    const second = new Randomizer(12345);
    expect(Array.from({ length: 20 }, () => first.nextUint32())).toEqual(
      Array.from({ length: 20 }, () => second.nextUint32()),
    );
  });

  it("continues the sequence after restoring state", () => {
    const original = new Randomizer(77);
    original.nextUint32();
    const restored = new Randomizer(0);
    restored.setState(original.getState());
    expect(restored.nextUint32()).toBe(original.nextUint32());
  });
});
