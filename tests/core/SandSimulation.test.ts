import { describe, expect, it } from "vitest";
import { Board } from "../../assets/scripts/core/Board";
import { Randomizer } from "../../assets/scripts/core/Randomizer";
import { SandSimulation } from "../../assets/scripts/core/SandSimulation";

describe("SandSimulation", () => {
  it("moves a grain vertically into empty space", () => {
    const board = new Board(3, 3);
    board.set(1, 0, 2);
    const result = new SandSimulation(board, new Randomizer(1)).step();
    expect(result.movedCount).toBe(1);
    expect(board.get(1, 0)).toBe(0);
    expect(board.get(1, 1)).toBe(2);
  });

  it("moves diagonally to the only open side", () => {
    const board = new Board(3, 3);
    board.set(1, 0, 2);
    board.set(1, 1, 1);
    board.set(2, 1, 1);
    board.set(0, 2, 1);
    board.set(1, 2, 1);
    board.set(2, 2, 1);
    new SandSimulation(board, new Randomizer(2)).step();
    expect(board.get(0, 1)).toBe(2);
  });

  it("moves each grain at most once per tick", () => {
    const board = new Board(1, 5);
    board.set(0, 0, 3);
    new SandSimulation(board, new Randomizer(3)).step();
    expect(board.get(0, 1)).toBe(3);
    expect(board.get(0, 2)).toBe(0);
  });

  it("preserves grain count and colors", () => {
    const board = new Board(4, 4, Uint8Array.from([
      1, 0, 2, 0,
      0, 3, 0, 4,
      0, 0, 5, 0,
      0, 0, 0, 0,
    ]));
    const before = [...board.snapshot()].filter(Boolean).sort();
    new SandSimulation(board, new Randomizer(4)).step();
    const after = [...board.snapshot()].filter(Boolean).sort();
    expect(after).toEqual(before);
  });

  it("is deterministic for the same seed and board", () => {
    const cells = Uint8Array.from([
      0, 1, 0,
      0, 2, 0,
      3, 3, 3,
    ]);
    const first = new Board(3, 3, cells);
    const second = new Board(3, 3, cells);
    new SandSimulation(first, new Randomizer(99)).step();
    new SandSimulation(second, new Randomizer(99)).step();
    expect(first.snapshot()).toEqual(second.snapshot());
  });
});
