import { describe, expect, it } from "vitest";
import { Board } from "../../assets/scripts/core/Board";
import { CollisionService } from "../../assets/scripts/core/CollisionService";
import { O_PIECE, T_PIECE } from "../../assets/scripts/core/PieceDefinitions";

describe("CollisionService", () => {
  it("accepts a piece whose occupied cells are inside an empty board", () => {
    const collision = new CollisionService(new Board(8, 8), 2);
    expect(collision.canPlace(O_PIECE, 0, 0, 0)).toBe(true);
  });

  it("rejects occupied cells outside the macro board", () => {
    const collision = new CollisionService(new Board(8, 8), 2);
    expect(collision.canPlace(O_PIECE, 0, -2, 0)).toBe(false);
    expect(collision.canPlace(O_PIECE, 0, 2, 0)).toBe(false);
    expect(collision.canPlace(T_PIECE, 0, 0, 3)).toBe(false);
  });

  it("rejects a macro cell when even one of its grains is occupied", () => {
    const board = new Board(8, 8);
    board.set(2, 0, 3);
    const collision = new CollisionService(board, 2);
    expect(collision.canPlace(O_PIECE, 0, 0, 0)).toBe(false);
  });
});
