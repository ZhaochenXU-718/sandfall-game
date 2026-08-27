import { Board } from "./Board";
import type { PieceDefinition, PiecePlacement } from "./PieceTypes";

export class CollisionService {
  public readonly macroWidth: number;
  public readonly macroHeight: number;
  public readonly grainsPerCell: number;

  private readonly board: Board;

  public constructor(board: Board, grainsPerCell: number) {
    if (!Number.isInteger(grainsPerCell) || grainsPerCell <= 0) {
      throw new RangeError("grainsPerCell must be a positive integer");
    }
    if (board.width % grainsPerCell !== 0 || board.height % grainsPerCell !== 0) {
      throw new RangeError("Sand board dimensions must be divisible by grainsPerCell");
    }
    this.board = board;
    this.grainsPerCell = grainsPerCell;
    this.macroWidth = board.width / grainsPerCell;
    this.macroHeight = board.height / grainsPerCell;
  }

  public canPlace(
    definition: PieceDefinition,
    rotation: number,
    originX: number,
    originY: number,
  ): boolean {
    if (!Number.isInteger(originX) || !Number.isInteger(originY)) {
      return false;
    }
    const cells = definition.rotations[rotation];
    if (cells === undefined) {
      throw new RangeError(`Rotation ${rotation} does not exist for piece ${definition.id}`);
    }

    for (const cell of cells) {
      const macroX = originX + cell.x;
      const macroY = originY + cell.y;
      if (macroX < 0 || macroX >= this.macroWidth || macroY < 0 || macroY >= this.macroHeight) {
        return false;
      }

      const startX = macroX * this.grainsPerCell;
      const startY = macroY * this.grainsPerCell;
      for (let grainY = 0; grainY < this.grainsPerCell; grainY += 1) {
        for (let grainX = 0; grainX < this.grainsPerCell; grainX += 1) {
          if (this.board.get(startX + grainX, startY + grainY) !== 0) {
            return false;
          }
        }
      }
    }
    return true;
  }

  public canPlacePiece(piece: PiecePlacement): boolean {
    return this.canPlace(piece.definition, piece.rotation, piece.x, piece.y);
  }

  public belongsTo(board: Board): boolean {
    return this.board === board;
  }
}
