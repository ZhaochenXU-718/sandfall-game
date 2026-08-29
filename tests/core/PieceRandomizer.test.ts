import { describe, expect, it } from "vitest";
import { TETROMINOES } from "../../assets/scripts/core/PieceDefinitions";
import { PieceRandomizer } from "../../assets/scripts/core/PieceRandomizer";

function sequence(randomizer: PieceRandomizer, length: number): string[] {
  return Array.from({ length }, () => {
    const next = randomizer.next();
    return `${next.definition.id}:${next.color}`;
  });
}

describe("PieceRandomizer", () => {
  it("emits every shape once per seven-piece bag", () => {
    const randomizer = new PieceRandomizer(123, TETROMINOES, 5);
    const ids = Array.from({ length: 7 }, () => randomizer.next().definition.id);
    expect(new Set(ids).size).toBe(7);
  });

  it("emits every color once per color bag", () => {
    const randomizer = new PieceRandomizer(456, TETROMINOES, 5);
    const colors = Array.from({ length: 5 }, () => randomizer.next().color);
    expect(new Set(colors)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("is deterministic for the same seed", () => {
    expect(sequence(new PieceRandomizer(99, TETROMINOES, 5), 30)).toEqual(
      sequence(new PieceRandomizer(99, TETROMINOES, 5), 30),
    );
  });

  it("continues identically after restoring all bag and PRNG state", () => {
    const original = new PieceRandomizer(77, TETROMINOES, 5);
    sequence(original, 11);
    const state = original.getState();
    const restored = new PieceRandomizer(0, TETROMINOES, 5);
    restored.setState(state);
    expect(sequence(restored, 30)).toEqual(sequence(original, 30));
  });

  it("starts a deterministic fresh color bag when more colors are unlocked", () => {
    const first = new PieceRandomizer(88, TETROMINOES, 4);
    const second = new PieceRandomizer(88, TETROMINOES, 4);
    sequence(first, 7);
    sequence(second, 7);

    first.setColorCount(5);
    second.setColorCount(5);
    const firstUnlocked = sequence(first, 5);
    const secondUnlocked = sequence(second, 5);

    expect(first.colorCount).toBe(5);
    expect(firstUnlocked).toEqual(secondUnlocked);
    expect(new Set(firstUnlocked.map((item) => Number(item.split(":")[1])))).toEqual(
      new Set([1, 2, 3, 4, 5]),
    );
  });
});
