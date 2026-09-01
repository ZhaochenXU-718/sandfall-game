import { describe, expect, it } from "vitest";
import { Board } from "../../assets/scripts/core/Board";
import { ConnectivityResolver } from "../../assets/scripts/core/ConnectivityResolver";

describe("ConnectivityResolver", () => {
  it("clears a component that touches no wall at all", () => {
    // The defining change: position is irrelevant, only size counts. Requiring
    // wall contact made banking colour against both walls the only viable play.
    const board = new Board(5, 3, Uint8Array.from([
      0, 0, 0, 0, 0,
      0, 2, 2, 2, 0,
      0, 0, 0, 0, 0,
    ]));

    const result = new ConnectivityResolver(board, 3).resolve();

    expect(result.clearedComponentCount).toBe(1);
    expect(result.markedCellCount).toBe(3);
  });

  it("uses diagonal eight-way connectivity", () => {
    const board = new Board(4, 4);
    board.set(0, 0, 1);
    board.set(1, 1, 1);
    board.set(2, 2, 1);
    board.set(3, 3, 1);

    const result = new ConnectivityResolver(board, 4).resolve();

    expect(result.clearedComponentCount).toBe(1);
    expect(result.markedCellCount).toBe(4);
  });

  it("keeps same-coloured grains apart when they are not connected", () => {
    const board = new Board(5, 3, Uint8Array.from([
      3, 3, 0, 3, 3,
      0, 0, 0, 0, 0,
      0, 0, 0, 0, 0,
    ]));

    // Two separate pairs, neither reaching the floor of 3.
    const result = new ConnectivityResolver(board, 3).resolve();

    expect(result.clearedComponentCount).toBe(0);
    expect(result.markedCellCount).toBe(0);
  });

  it("clears every qualifying component in one pass", () => {
    const board = new Board(3, 3, Uint8Array.from([
      1, 1, 1,
      0, 0, 0,
      2, 2, 2,
    ]));

    const result = new ConnectivityResolver(board, 3).resolve();

    expect(result.clearedComponentCount).toBe(2);
    expect(board.clearMarked(result.removalMask)).toBe(6);
    expect(board.snapshot()).toEqual(new Uint8Array(9));
  });

  it("removes the whole component, not just part of it", () => {
    const board = new Board(3, 2, Uint8Array.from([
      4, 4, 4,
      0, 4, 0,
    ]));

    const result = new ConnectivityResolver(board, 4).resolve();

    expect(result.markedCellCount).toBe(4);
    expect(result.removalMask[4]).toBe(1);
  });

  describe("minimum blob size", () => {
    /** Three connected grains of colour 5. */
    function smallBlob(): Board {
      return new Board(3, 2, Uint8Array.from([
        5, 5, 5,
        0, 0, 0,
      ]));
    }

    it("ignores a component below the floor", () => {
      const result = new ConnectivityResolver(smallBlob(), 4).resolve();

      expect(result.clearedComponentCount).toBe(0);
      expect(result.markedCellCount).toBe(0);
    });

    it("accepts a component exactly at the floor", () => {
      const result = new ConnectivityResolver(smallBlob(), 3).resolve();

      expect(result.clearedComponentCount).toBe(1);
      expect(result.markedCellCount).toBe(3);
    });

    it("judges each colour separately", () => {
      const board = new Board(3, 3, Uint8Array.from([
        6, 6, 6,
        6, 6, 6,
        7, 7, 7,
      ]));

      const result = new ConnectivityResolver(board, 4).resolve();

      expect(result.clearedComponentCount).toBe(1);
      expect(result.markedCellCount).toBe(6);
      // Colour 7 has only three grains, under the floor.
      expect(result.removalMask[6]).toBe(0);
    });

    it("rejects a floor below one", () => {
      expect(() => new ConnectivityResolver(smallBlob(), 0)).toThrow(RangeError);
      expect(() => new ConnectivityResolver(smallBlob(), 1.5)).toThrow(RangeError);
    });
  });
});
