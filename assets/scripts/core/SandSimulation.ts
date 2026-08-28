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

    for (let y = this.board.height - 2; y >= 0; y -= 1) {
      // A deterministic random start and direction avoids even/odd row bands
      // while keeping replays reproducible for the same game seed.
      const scanLeftToRight = this.randomizer.nextBoolean();
      const startX = this.randomizer.nextInt(this.board.width);
      for (let offset = 0; offset < this.board.width; offset += 1) {
        const rawX = scanLeftToRight ? startX + offset : startX - offset;
        const x = rawX >= this.board.width
          ? rawX - this.board.width
          : rawX < 0
            ? rawX + this.board.width
            : rawX;
        this.tryMove(x, y);
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
