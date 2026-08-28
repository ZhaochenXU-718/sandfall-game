export interface RgbaColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface PixelBufferUpdateResult {
  changedCount: number;
  dirtyMinX: number;
  dirtyMinY: number;
  dirtyMaxX: number;
  dirtyMaxY: number;
}

export interface SandPixelBufferOptions {
  readonly width: number;
  readonly height: number;
  readonly palette?: readonly RgbaColor[];
  readonly flipY?: boolean;
}

export const DEFAULT_SAND_PALETTE: readonly RgbaColor[] = Object.freeze([
  Object.freeze({ r: 17, g: 24, b: 39, a: 255 }),
  Object.freeze({ r: 255, g: 107, b: 107, a: 255 }),
  Object.freeze({ r: 255, g: 200, b: 87, a: 255 }),
  Object.freeze({ r: 78, g: 205, b: 196, a: 255 }),
  Object.freeze({ r: 91, g: 141, b: 239, a: 255 }),
  Object.freeze({ r: 166, g: 108, b: 255, a: 255 }),
]);

/** Converts color ids to a reusable RGBA8888 upload buffer. */
export class SandPixelBuffer {
  public readonly width: number;
  public readonly height: number;
  public readonly pixels: Uint8Array;

  private readonly palette: readonly RgbaColor[];
  private readonly previousCells: Uint8Array;
  private readonly flipY: boolean;
  private initialized = false;
  private readonly result: PixelBufferUpdateResult = {
    changedCount: 0,
    dirtyMinX: -1,
    dirtyMinY: -1,
    dirtyMaxX: -1,
    dirtyMaxY: -1,
  };

  public constructor(options: SandPixelBufferOptions) {
    if (!Number.isInteger(options.width) || options.width <= 0) {
      throw new RangeError("Pixel buffer width must be a positive integer");
    }
    if (!Number.isInteger(options.height) || options.height <= 0) {
      throw new RangeError("Pixel buffer height must be a positive integer");
    }
    const palette = options.palette ?? DEFAULT_SAND_PALETTE;
    if (palette.length === 0) {
      throw new Error("Pixel buffer palette cannot be empty");
    }
    for (const color of palette) {
      for (const channel of [color.r, color.g, color.b, color.a]) {
        if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
          throw new RangeError("Palette channels must be integers between 0 and 255");
        }
      }
    }

    this.width = options.width;
    this.height = options.height;
    this.palette = palette;
    this.flipY = options.flipY ?? false;
    this.previousCells = new Uint8Array(this.width * this.height);
    this.pixels = new Uint8Array(this.width * this.height * 4);
  }

  public update(cells: Uint8Array): PixelBufferUpdateResult {
    if (cells.length !== this.previousCells.length) {
      throw new RangeError(`Expected ${this.previousCells.length} cells, got ${cells.length}`);
    }
    this.resetResult();

    for (let sourceIndex = 0; sourceIndex < cells.length; sourceIndex += 1) {
      const colorId = cells[sourceIndex];
      if (colorId === undefined) {
        throw new Error("Cell buffer invariant violated");
      }
      if (this.initialized && colorId === this.previousCells[sourceIndex]) {
        continue;
      }
      const color = this.palette[colorId];
      if (color === undefined) {
        throw new RangeError(`Color id ${colorId} has no palette entry`);
      }

      this.previousCells[sourceIndex] = colorId;
      const sourceX = sourceIndex % this.width;
      const sourceY = Math.floor(sourceIndex / this.width);
      const targetY = this.flipY ? this.height - 1 - sourceY : sourceY;
      const pixelOffset = (targetY * this.width + sourceX) * 4;
      this.pixels[pixelOffset] = color.r;
      this.pixels[pixelOffset + 1] = color.g;
      this.pixels[pixelOffset + 2] = color.b;
      this.pixels[pixelOffset + 3] = color.a;
      this.includeDirty(sourceX, targetY);
    }

    this.initialized = true;
    return this.result;
  }

  private includeDirty(x: number, y: number): void {
    this.result.changedCount += 1;
    if (this.result.dirtyMinX === -1) {
      this.result.dirtyMinX = x;
      this.result.dirtyMinY = y;
      this.result.dirtyMaxX = x;
      this.result.dirtyMaxY = y;
      return;
    }
    this.result.dirtyMinX = Math.min(this.result.dirtyMinX, x);
    this.result.dirtyMinY = Math.min(this.result.dirtyMinY, y);
    this.result.dirtyMaxX = Math.max(this.result.dirtyMaxX, x);
    this.result.dirtyMaxY = Math.max(this.result.dirtyMaxY, y);
  }

  private resetResult(): void {
    this.result.changedCount = 0;
    this.result.dirtyMinX = -1;
    this.result.dirtyMinY = -1;
    this.result.dirtyMaxX = -1;
    this.result.dirtyMaxY = -1;
  }
}
