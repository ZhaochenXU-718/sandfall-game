import { Board } from "./Board";
import type { ConnectivityResult } from "./types";

export class ConnectivityResolver {
  private readonly board: Board;
  private readonly visited: Uint8Array;
  private readonly queue: Int32Array;
  private readonly result: ConnectivityResult;

  public constructor(board: Board) {
    this.board = board;
    this.visited = new Uint8Array(board.size);
    this.queue = new Int32Array(board.size);
    this.result = {
      removalMask: new Uint8Array(board.size),
      spanningComponentCount: 0,
      markedCellCount: 0,
    };
  }

  /** The result and its mask are reused; consume them before the next call. */
  public resolve(): ConnectivityResult {
    this.visited.fill(0);
    this.result.removalMask.fill(0);
    this.result.spanningComponentCount = 0;
    this.result.markedCellCount = 0;

    for (let start = 0; start < this.board.size; start += 1) {
      const color = this.board.getByIndex(start);
      if (color === 0 || this.visited[start] !== 0) {
        continue;
      }

      let head = 0;
      let tail = 1;
      let touchesLeft = false;
      let touchesRight = false;
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
        touchesLeft ||= x === 0;
        touchesRight ||= x === this.board.width - 1;

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

      if (touchesLeft && touchesRight) {
        this.result.spanningComponentCount += 1;
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
