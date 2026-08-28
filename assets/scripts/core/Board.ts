import type { ColorId } from "./types";

export class Board {
  public readonly width: number;
  public readonly height: number;

  private readonly cells: Uint8Array;
  private readonly movedFlags: Uint8Array;

  public constructor(width: number, height: number, initialCells?: Uint8Array) {
    if (!Number.isInteger(width) || width <= 0) {
      throw new RangeError("Board width must be a positive integer");
    }
    if (!Number.isInteger(height) || height <= 0) {
      throw new RangeError("Board height must be a positive integer");
    }

    const size = width * height;
    if (initialCells !== undefined && initialCells.length !== size) {
      throw new RangeError(`Expected ${size} initial cells, got ${initialCells.length}`);
    }

    this.width = width;
    this.height = height;
    this.cells = initialCells?.slice() ?? new Uint8Array(size);
    this.movedFlags = new Uint8Array(size);
  }

  public get size(): number {
    return this.cells.length;
  }

  public isInside(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  public indexOf(x: number, y: number): number {
    this.assertCoordinates(x, y);
    return y * this.width + x;
  }

  public get(x: number, y: number): ColorId {
    const value = this.cells[this.indexOf(x, y)];
    if (value === undefined) {
      throw new RangeError("Cell index is outside the board");
    }
    return value;
  }

  public getByIndex(index: number): ColorId {
    this.assertIndex(index);
    const value = this.cells[index];
    if (value === undefined) {
      throw new RangeError("Cell index is outside the board");
    }
    return value;
  }

  public set(x: number, y: number, color: ColorId): void {
    this.setByIndex(this.indexOf(x, y), color);
  }

  public setByIndex(index: number, color: ColorId): void {
    this.assertIndex(index);
    this.assertColor(color);
    this.cells[index] = color;
  }

  public swap(a: number, b: number): void {
    this.assertIndex(a);
    this.assertIndex(b);
    const valueA = this.cells[a];
    const valueB = this.cells[b];
    if (valueA === undefined || valueB === undefined) {
      throw new RangeError("Cell index is outside the board");
    }
    this.cells[a] = valueB;
    this.cells[b] = valueA;
  }

  public clearMarked(mask: Uint8Array): number {
    if (mask.length !== this.size) {
      throw new RangeError(`Expected a mask of length ${this.size}, got ${mask.length}`);
    }

    let cleared = 0;
    for (let index = 0; index < this.size; index += 1) {
      if (mask[index] !== 0 && this.cells[index] !== 0) {
        this.cells[index] = 0;
        cleared += 1;
      }
    }
    return cleared;
  }

  public canOccupy(indices: readonly number[]): boolean {
    for (const index of indices) {
      if (!Number.isInteger(index) || index < 0 || index >= this.size) {
        return false;
      }
      if (this.cells[index] !== 0) {
        return false;
      }
    }
    return true;
  }

  public snapshot(): Uint8Array {
    return this.cells.slice();
  }

  public copyTo(target: Uint8Array): void {
    if (target.length !== this.size) {
      throw new RangeError(`Expected a target of length ${this.size}, got ${target.length}`);
    }
    target.set(this.cells);
  }

  /** Internal simulation workspace. Kept on Board so it is allocated only once. */
  public resetMovedFlags(): void {
    this.movedFlags.fill(0);
  }

  public wasMoved(index: number): boolean {
    return this.movedFlags[index] === 1;
  }

  public markMoved(index: number): void {
    this.movedFlags[index] = 1;
  }

  private assertCoordinates(x: number, y: number): void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !this.isInside(x, y)) {
      throw new RangeError(`Coordinates (${x}, ${y}) are outside the board`);
    }
  }

  private assertIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new RangeError(`Cell index ${index} is outside the board`);
    }
  }

  private assertColor(color: ColorId): void {
    if (!Number.isInteger(color) || color < 0 || color > 255) {
      throw new RangeError(`Color ${color} must be an integer between 0 and 255`);
    }
  }
}
