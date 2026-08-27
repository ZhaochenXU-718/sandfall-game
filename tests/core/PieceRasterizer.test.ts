import { describe, expect, it } from "vitest";
import { Board } from "../../assets/scripts/core/Board";
import { CollisionService } from "../../assets/scripts/core/CollisionService";
import { O_PIECE } from "../../assets/scripts/core/PieceDefinitions";
import { PieceRasterizer } from "../../assets/scripts/core/PieceRasterizer";

describe("PieceRasterizer", () => {
  it("rejects a collision service that belongs to another board", () => {
    const board = new Board(8, 8);
    const otherCollision = new CollisionService(new Board(8, 8), 2);
    expect(() => new PieceRasterizer(board, otherCollision)).toThrow();
  });

  it("turns every macro cell into a full block of same-color grains", () => {
    const board = new Board(8, 8);
    const collision = new CollisionService(board, 2);
    const rasterizer = new PieceRasterizer(board, collision);
    const written = rasterizer.rasterize({
      definition: O_PIECE,
      rotation: 0,
      x: 0,
      y: 0,
      color: 4,
    });
    expect(written).toBe(16);
    expect([...board.snapshot()].filter((color) => color === 4)).toHaveLength(16);
  });

  it("does not partially modify the board when validation fails", () => {
    const board = new Board(8, 8);
    board.set(2, 0, 5);
    const before = board.snapshot();
    const collision = new CollisionService(board, 2);
    const rasterizer = new PieceRasterizer(board, collision);
    expect(rasterizer.rasterize({
      definition: O_PIECE,
      rotation: 0,
      x: 0,
      y: 0,
      color: 2,
    })).toBe(0);
    expect(board.snapshot()).toEqual(before);
  });
});
