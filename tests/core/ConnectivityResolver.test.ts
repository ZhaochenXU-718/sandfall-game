import { describe, expect, it } from "vitest";
import { Board } from "../../assets/scripts/core/Board";
import { ConnectivityResolver } from "../../assets/scripts/core/ConnectivityResolver";

describe("ConnectivityResolver", () => {
  it("marks a horizontal spanning component", () => {
    const board = new Board(4, 2, Uint8Array.from([
      2, 2, 2, 2,
      0, 0, 0, 0,
    ]));
    const result = new ConnectivityResolver(board).resolve();
    expect(result.spanningComponentCount).toBe(1);
    expect(result.markedCellCount).toBe(4);
  });

  it("uses diagonal eight-way connectivity", () => {
    const board = new Board(4, 4);
    board.set(0, 0, 1);
    board.set(1, 1, 1);
    board.set(2, 2, 1);
    board.set(3, 3, 1);
    const result = new ConnectivityResolver(board).resolve();
    expect(result.spanningComponentCount).toBe(1);
    expect(result.markedCellCount).toBe(4);
  });

  it("does not mark a component touching only one edge", () => {
    const board = new Board(4, 2, Uint8Array.from([
      3, 3, 0, 0,
      3, 0, 0, 0,
    ]));
    const result = new ConnectivityResolver(board).resolve();
    expect(result.spanningComponentCount).toBe(0);
    expect(result.markedCellCount).toBe(0);
  });

  it("marks all spanning components and clears them simultaneously", () => {
    const board = new Board(3, 3, Uint8Array.from([
      1, 1, 1,
      0, 0, 0,
      2, 2, 2,
    ]));
    const result = new ConnectivityResolver(board).resolve();
    expect(result.spanningComponentCount).toBe(2);
    expect(board.clearMarked(result.removalMask)).toBe(6);
    expect(board.snapshot()).toEqual(new Uint8Array(9));
  });

  it("marks the entire component rather than only a crossing path", () => {
    const board = new Board(3, 2, Uint8Array.from([
      4, 4, 4,
      0, 4, 0,
    ]));
    const result = new ConnectivityResolver(board).resolve();
    expect(result.markedCellCount).toBe(4);
    expect(result.removalMask[4]).toBe(1);
  });
});
