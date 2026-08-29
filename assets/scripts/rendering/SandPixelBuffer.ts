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
  /** Maximum per-grain lightness variation, from 0 (flat) to 1. */
  readonly shadeStrength?: number;
}

export const DEFAULT_SAND_TEXTURE_STRENGTH = 0.18;

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
  private readonly clearGlowPalette: readonly RgbaColor[];
  private readonly previousCells: Uint8Array;
  private readonly previousGrainVariants: Uint8Array;
  private readonly previousFlashMask: Uint8Array;
  private readonly flipY: boolean;
  private readonly shadeStrength: number;
  private previousFlashIntensity = 0;
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
    const shadeStrength = options.shadeStrength ?? DEFAULT_SAND_TEXTURE_STRENGTH;
    if (!Number.isFinite(shadeStrength) || shadeStrength < 0 || shadeStrength > 1) {
      throw new RangeError("Sand shade strength must be between zero and one");
    }

    this.width = options.width;
    this.height = options.height;
    this.palette = palette;
    this.clearGlowPalette = palette.map((color) => ({
      r: clearGlowTargetChannel(color.r),
      g: clearGlowTargetChannel(color.g),
      b: clearGlowTargetChannel(color.b),
      a: color.a,
    }));
    this.flipY = options.flipY ?? false;
    this.shadeStrength = shadeStrength;
    this.previousCells = new Uint8Array(this.width * this.height);
    this.previousGrainVariants = new Uint8Array(this.width * this.height);
    this.previousFlashMask = new Uint8Array(this.width * this.height);
    this.pixels = new Uint8Array(this.width * this.height * 4);
  }

  public update(
    cells: Uint8Array,
    flashMask?: Uint8Array,
    flashIntensity = 0,
    grainVariants?: Uint8Array,
  ): PixelBufferUpdateResult {
    if (cells.length !== this.previousCells.length) {
      throw new RangeError(`Expected ${this.previousCells.length} cells, got ${cells.length}`);
    }
    if (flashMask !== undefined && flashMask.length !== cells.length) {
      throw new RangeError(`Expected a flash mask of length ${cells.length}`);
    }
    if (grainVariants !== undefined && grainVariants.length !== cells.length) {
      throw new RangeError(`Expected grain variants of length ${cells.length}`);
    }
    if (!Number.isFinite(flashIntensity) || flashIntensity < 0 || flashIntensity > 1) {
      throw new RangeError("Flash intensity must be between zero and one");
    }
    this.resetResult();

    for (let sourceIndex = 0; sourceIndex < cells.length; sourceIndex += 1) {
      const colorId = cells[sourceIndex];
      if (colorId === undefined) {
        throw new Error("Cell buffer invariant violated");
      }
      const flashed = flashMask?.[sourceIndex] !== undefined
        && flashMask[sourceIndex] !== 0;
      const previouslyFlashed = this.previousFlashMask[sourceIndex] !== 0;
      const sourceX = sourceIndex % this.width;
      const sourceY = Math.floor(sourceIndex / this.width);
      const grainVariant = colorId === 0
        ? 0
        : grainVariants?.[sourceIndex] ?? coordinateGrainVariant(sourceX, sourceY, colorId);
      const cellChanged = !this.initialized
        || colorId !== this.previousCells[sourceIndex]
        || grainVariant !== this.previousGrainVariants[sourceIndex];
      const flashChanged = flashed !== previouslyFlashed
        || ((flashed || previouslyFlashed) && flashIntensity !== this.previousFlashIntensity);
      if (!cellChanged && !flashChanged) {
        continue;
      }
      const color = this.palette[colorId];
      const glowColor = this.clearGlowPalette[colorId];
      if (color === undefined || glowColor === undefined) {
        throw new RangeError(`Color id ${colorId} has no palette entry`);
      }

      this.previousCells[sourceIndex] = colorId;
      this.previousGrainVariants[sourceIndex] = grainVariant;
      this.previousFlashMask[sourceIndex] = flashed ? 1 : 0;
      const targetY = this.flipY ? this.height - 1 - sourceY : sourceY;
      const pixelOffset = (targetY * this.width + sourceX) * 4;
      const shade = colorId === 0
        ? 0
        : grainShade(grainVariant, this.shadeStrength);
      this.pixels[pixelOffset] = flashChannel(
        shadeChannel(color.r, shade),
        glowColor.r,
        flashed,
        flashIntensity,
      );
      this.pixels[pixelOffset + 1] = flashChannel(
        shadeChannel(color.g, shade),
        glowColor.g,
        flashed,
        flashIntensity,
      );
      this.pixels[pixelOffset + 2] = flashChannel(
        shadeChannel(color.b, shade),
        glowColor.b,
        flashed,
        flashIntensity,
      );
      this.pixels[pixelOffset + 3] = color.a;
      this.includeDirty(sourceX, targetY);
    }

    this.initialized = true;
    this.previousFlashIntensity = flashIntensity;
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

function coordinateGrainVariant(x: number, y: number, colorId: number): number {
  let hash = Math.imul(x + colorId * 31, 0x045d9f3b)
    ^ Math.imul(y + colorId * 17, 0x119de1f3);
  hash ^= hash >>> 16;
  return hash & 0xff;
}

/** The variant moves with its grain, preventing texture shimmer during collapse. */
function grainShade(variant: number, strength: number): number {
  const centered = (variant / 255) * 2 - 1;
  return centered < 0 ? centered * strength : centered * strength * 0.7;
}

function shadeChannel(channel: number, shade: number): number {
  const value = shade < 0
    ? channel * (1 + shade)
    : channel + (255 - channel) * shade;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function flashChannel(
  channel: number,
  glowTarget: number,
  flashed: boolean,
  intensity: number,
): number {
  return flashed ? Math.round(channel + (glowTarget - channel) * intensity) : channel;
}

/** Screen-blends a palette channel with itself to brighten it without losing hue. */
export function clearGlowTargetChannel(channel: number): number {
  if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
    throw new RangeError("Clear glow channel must be an integer between zero and 255");
  }
  return Math.round(255 - ((255 - channel) * (255 - channel)) / 255);
}

/** Two smooth colored-light pulses over normalized clear-effect progress. */
export function clearFlashIntensity(progress: number): number {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError("Clear flash progress must be between zero and one");
  }
  if (progress === 1) {
    return 0;
  }
  const wave = Math.sin(progress * Math.PI * 2);
  return wave * wave;
}
