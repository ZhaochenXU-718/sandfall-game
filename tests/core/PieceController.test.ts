import { describe, expect, it } from "vitest";
import { Board } from "../../assets/scripts/core/Board";
import { CollisionService } from "../../assets/scripts/core/CollisionService";
import { O_PIECE, T_PIECE } from "../../assets/scripts/core/PieceDefinitions";
import { PieceController } from "../../assets/scripts/core/PieceController";

const OPTIONS = { lockDelayMs: 350, maxLockResets: 2 } as const;

describe("PieceController", () => {
  it("moves within bounds and rejects a wall collision", () => {
    const collision = new CollisionService(new Board(8, 8), 2);
    const piece = new PieceController(O_PIECE, 1, -1, 0, collision, OPTIONS);
    expect(piece.moveLeft()).toBe(false);
    expect(piece.moveRight()).toBe(true);
    expect(piece.x).toBe(0);
  });

  it("rejects a rotation that overlaps sand", () => {
    const board = new Board(8, 8);
    board.set(2, 4, 5);
    const collision = new CollisionService(board, 2);
    const piece = new PieceController(T_PIECE, 1, 0, 0, collision, OPTIONS);
    expect(piece.rotateCW()).toBe(false);
    expect(piece.rotation).toBe(0);
  });

  it("hard drops to the lowest valid row and locks immediately", () => {
    const collision = new CollisionService(new Board(8, 8), 2);
    const piece = new PieceController(O_PIECE, 2, 0, 0, collision, OPTIONS);
    expect(piece.hardDrop()).toBe(2);
    expect(piece.y).toBe(2);
    expect(piece.isGrounded).toBe(true);
    expect(piece.isLockReady).toBe(true);
    expect(piece.moveLeft()).toBe(false);
  });

  it("soft drops exactly one macro row when space is available", () => {
    const collision = new CollisionService(new Board(8, 8), 2);
    const piece = new PieceController(O_PIECE, 2, 0, 0, collision, OPTIONS);
    expect(piece.softDrop()).toBe(true);
    expect(piece.y).toBe(1);
  });

  it("locks only after the configured grounded delay", () => {
    const collision = new CollisionService(new Board(8, 8), 2);
    const piece = new PieceController(O_PIECE, 2, 0, 2, collision, OPTIONS);
    expect(piece.updateLock(349)).toBe(false);
    expect(piece.updateLock(1)).toBe(true);
  });

  it("resets active lock delay only up to the configured limit", () => {
    const collision = new CollisionService(new Board(8, 8), 2);
    const piece = new PieceController(T_PIECE, 3, 0, 1, collision, OPTIONS, 1);

    piece.updateLock(100);
    expect(piece.rotateCW()).toBe(true);
    expect(piece.lockElapsedMs).toBe(0);
    expect(piece.lockResets).toBe(1);

    piece.updateLock(100);
    expect(piece.rotateCCW()).toBe(true);
    expect(piece.lockElapsedMs).toBe(0);
    expect(piece.lockResets).toBe(2);

    piece.updateLock(100);
    expect(piece.rotateCW()).toBe(true);
    expect(piece.lockElapsedMs).toBe(100);
    expect(piece.lockResets).toBe(2);
    expect(piece.updateLock(250)).toBe(true);
  });
});
