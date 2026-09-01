import { Board } from "./Board";
import type { ConnectivityResult } from "./types";

export class ConnectivityResolver {
  private readonly board: Board;
  private readonly minBlobGrains: number;
  private readonly visited: Uint8Array;
  private readonly queue: Int32Array;
  private readonly result: ConnectivityResult;

  /**
   * `minBlobGrains` is required rather than defaulted: omitting the floor lets
   * every stray speck clear, so each caller must choose. Pass 1 to accept any
   * component.
   */
  public constructor(board: Board, minBlobGrains: number) {
    if (!Number.isInteger(minBlobGrains) || minBlobGrains < 1) {
      throw new RangeError("minBlobGrains must be a positive integer");
    }
    this.board = board;
    this.minBlobGrains = minBlobGrains;
    this.visited = new Uint8Array(board.size);
    this.queue = new Int32Array(board.size);
    this.result = {
      removalMask: new Uint8Array(board.size),
      clearedComponentCount: 0,
      markedCellCount: 0,
    };
  }

  /** The result and its mask are reused; consume them before the next call. */
  public resolve(): ConnectivityResult {
    this.visited.fill(0);
    this.result.removalMask.fill(0);
    this.result.clearedComponentCount = 0;
    this.result.markedCellCount = 0;

    for (let start = 0; start < this.board.size; start += 1) {
      const color = this.board.getByIndex(start);
      if (color === 0 || this.visited[start] !== 0) {
        continue;
      }

      let head = 0;
      let tail = 1;
      this.queue[0] = start;
      this.visited[start] = 1;

      while (head < tail) {
        const index = this.queue[head];
        if (index === undefined) {
          throw new Error("Connectivity queue invariant violated");
        }
        head += 1;

        const x = index % this.board.width;
        const y = Math.floor(index / this.board.width);

        const minY = Math.max(0, y - 1);
        const maxY = Math.min(this.board.height - 1, y + 1);
        const minX = Math.max(0, x - 1);
        const maxX = Math.min(this.board.width - 1, x + 1);

        for (let neighborY = minY; neighborY <= maxY; neighborY += 1) {
          for (let neighborX = minX; neighborX <= maxX; neighborX += 1) {
            if (neighborX === x && neighborY === y) {
              continue;
            }
            const neighbor = neighborY * this.board.width + neighborX;
            if (this.visited[neighbor] === 0 && this.board.getByIndex(neighbor) === color) {
              this.visited[neighbor] = 1;
              this.queue[tail] = neighbor;
              tail += 1;
            }
          }
        }
      }

      // `tail` is the component's grain count once the flood fill drains.
      // Size alone decides: wall contact used to be required, but it is free on
      // any sand surface, which made banking colour against both walls the one
      // viable strategy. See docs/02-game-rules.md section 5.
      if (tail >= this.minBlobGrains) {
        this.result.clearedComponentCount += 1;
        this.result.markedCellCount += tail;
        for (let componentIndex = 0; componentIndex < tail; componentIndex += 1) {
          const cellIndex = this.queue[componentIndex];
          if (cellIndex === undefined) {
            throw new Error("Connectivity queue invariant violated");
          }
          this.result.removalMask[cellIndex] = 1;
        }
      }
    }

    return this.result;
  }
}
