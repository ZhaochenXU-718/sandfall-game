import { Board } from "./Board";
import { CollisionService } from "./CollisionService";
import type { PiecePlacement } from "./PieceTypes";

export class PieceRasterizer {
  private readonly board: Board;
  private readonly collision: CollisionService;

  public constructor(board: Board, collision: CollisionService) {
    if (!collision.belongsTo(board)) {
      throw new Error("PieceRasterizer and CollisionService must use the same board");
    }
    this.board = board;
    this.collision = collision;
  }

  /** Returns the number of grains written, or 0 without modifying the board. */
  public rasterize(piece: PiecePlacement): number {
    if (!Number.isInteger(piece.color) || piece.color <= 0 || piece.color > 255) {
      throw new RangeError("A rasterized piece color must be between 1 and 255");
    }
    // Validate every destination before the first write to keep locking atomic.
    if (!this.collision.canPlacePiece(piece)) {
      return 0;
    }

    const cells = piece.definition.rotations[piece.rotation];
    if (cells === undefined) {
      throw new RangeError(`Rotation ${piece.rotation} does not exist for ${piece.definition.id}`);
    }
    const scale = this.collision.grainsPerCell;
    for (const cell of cells) {
      const startX = (piece.x + cell.x) * scale;
      const startY = (piece.y + cell.y) * scale;
      for (let grainY = 0; grainY < scale; grainY += 1) {
        for (let grainX = 0; grainX < scale; grainX += 1) {
          this.board.set(startX + grainX, startY + grainY, piece.color);
        }
      }
    }
    return cells.length * scale * scale;
  }
}
