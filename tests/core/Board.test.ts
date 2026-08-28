import { describe, expect, it } from "vitest";
import { Board } from "../../assets/scripts/core/Board";

describe("Board", () => {
  it("converts coordinates and stores colors", () => {
    const board = new Board(3, 2);
    board.set(2, 1, 4);
    expect(board.indexOf(2, 1)).toBe(5);
    expect(board.get(2, 1)).toBe(4);
  });

  it("rejects out-of-bounds access", () => {
    const board = new Board(2, 2);
    expect(() => board.get(-1, 0)).toThrow(RangeError);
    expect(() => board.set(2, 0, 1)).toThrow(RangeError);
  });

  it("clears marked occupied cells and returns their count", () => {
    const board = new Board(3, 1, Uint8Array.from([1, 2, 0]));
    expect(board.clearMarked(Uint8Array.from([1, 0, 1]))).toBe(1);
    expect(board.snapshot()).toEqual(Uint8Array.from([0, 2, 0]));
  });

  it("does not expose mutable cell storage", () => {
    const board = new Board(2, 1, Uint8Array.from([1, 2]));
    const snapshot = board.snapshot();
    snapshot[0] = 9;
    expect(board.get(0, 0)).toBe(1);
  });

  it("copies cells into a caller-owned reusable buffer", () => {
    const board = new Board(2, 1, Uint8Array.from([3, 4]));
    const target = new Uint8Array(2);
    board.copyTo(target);
    expect(target).toEqual(Uint8Array.from([3, 4]));
  });
});
