import { Board } from "./Board";
import { Randomizer } from "./Randomizer";
import type { SandStepResult } from "./types";

/**
 * Runs one bottom-up gravity pass. The returned result object is reused on the
 * next call so the fixed-tick hot path does not allocate.
 */
export class SandSimulation {
  private readonly board: Board;
  private readonly randomizer: Randomizer;
  private tick = 0;
  private readonly result: SandStepResult = {
    movedCount: 0,
    dirtyMinX: -1,
    dirtyMinY: -1,
    dirtyMaxX: -1,
    dirtyMaxY: -1,
  };

  public constructor(board: Board, randomizer: Randomizer) {
    this.board = board;
    this.randomizer = randomizer;
  }

  public step(): SandStepResult {
    this.board.resetMovedFlags();
    this.resetResult();

    const scanParity = this.tick & 1;
    this.tick += 1;

    for (let y = this.board.height - 2; y >= 0; y -= 1) {
      // Adjacent rows use opposite directions, and every tick flips them all.
      const scanLeftToRight = ((y + scanParity) & 1) === 0;
      if (scanLeftToRight) {
        for (let x = 0; x < this.board.width; x += 1) {
          this.tryMove(x, y);
        }
      } else {
        for (let x = this.board.width - 1; x >= 0; x -= 1) {
          this.tryMove(x, y);
        }
      }
    }

    return this.result;
  }

  private tryMove(x: number, y: number): void {
    const source = y * this.board.width + x;
    if (this.board.getByIndex(source) === 0 || this.board.wasMoved(source)) {
      return;
    }

    const below = source + this.board.width;
    if (this.board.getByIndex(below) === 0) {
      this.move(source, below, x, y, x, y + 1);
      return;
    }

    const canMoveLeft = x > 0 && this.board.getByIndex(below - 1) === 0;
    const canMoveRight = x + 1 < this.board.width && this.board.getByIndex(below + 1) === 0;
    if (!canMoveLeft && !canMoveRight) {
      return;
    }

    const moveLeft = canMoveLeft && (!canMoveRight || this.randomizer.nextBoolean());
    const target = moveLeft ? below - 1 : below + 1;
    const targetX = moveLeft ? x - 1 : x + 1;
    this.move(source, target, x, y, targetX, y + 1);
  }

  private move(
    source: number,
    target: number,
    sourceX: number,
    sourceY: number,
    targetX: number,
    targetY: number,
  ): void {
    this.board.swap(source, target);
    this.board.markMoved(target);
    this.result.movedCount += 1;

    if (this.result.dirtyMinX === -1) {
      this.result.dirtyMinX = Math.min(sourceX, targetX);
      this.result.dirtyMinY = sourceY;
      this.result.dirtyMaxX = Math.max(sourceX, targetX);
      this.result.dirtyMaxY = targetY;
      return;
    }

    this.result.dirtyMinX = Math.min(this.result.dirtyMinX, sourceX, targetX);
    this.result.dirtyMinY = Math.min(this.result.dirtyMinY, sourceY, targetY);
    this.result.dirtyMaxX = Math.max(this.result.dirtyMaxX, sourceX, targetX);
    this.result.dirtyMaxY = Math.max(this.result.dirtyMaxY, sourceY, targetY);
  }

  private resetResult(): void {
    this.result.movedCount = 0;
    this.result.dirtyMinX = -1;
    this.result.dirtyMinY = -1;
    this.result.dirtyMaxX = -1;
    this.result.dirtyMaxY = -1;
  }
}
