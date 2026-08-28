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

  it("keeps a collapsing ledge free of alternating horizontal spikes", () => {
    const width = 28;
    const height = 22;
    const board = new Board(width, height);
    for (let x = 0; x < width; x += 1) {
      const supportTop = Math.min(height - 1, 10 + Math.floor(x * 0.45));
      for (let y = supportTop; y < height; y += 1) {
        board.set(x, y, 1);
      }
    }
    for (let x = 0; x < 12; x += 1) {
      for (let y = 2; y < 10; y += 1) {
        board.set(x, y, 4);
      }
    }

    const simulation = new SandSimulation(board, new Randomizer(123));
    for (let step = 0; step < 18; step += 1) {
      simulation.step();
    }

    const cells = board.snapshot();
    const rightEdges: number[] = [];
    for (let y = 0; y < height; y += 1) {
      let rightEdge = -1;
      for (let x = 0; x < width; x += 1) {
        if (cells[y * width + x] === 4) {
          rightEdge = x;
        }
      }
      if (rightEdge >= 0) {
        rightEdges.push(rightEdge);
      }
    }

    for (let index = 1; index < rightEdges.length; index += 1) {
      expect(Math.abs((rightEdges[index] ?? 0) - (rightEdges[index - 1] ?? 0))).toBeLessThanOrEqual(3);
    }
  });
});
