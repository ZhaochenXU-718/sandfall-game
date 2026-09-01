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
  // Lime fills the widest hue gap (~95 deg) left by coral/amber/teal/blue/violet.
  Object.freeze({ r: 132, g: 214, b: 96, a: 255 }),
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
  private readonly glowColorIds: Uint8Array;
  private readonly glowStrengths: Uint8Array;
  private readonly cachedFlashMask: Uint8Array;
  private readonly cachedFlashColors: Uint8Array;
  private readonly previousGlowColorIds: Uint8Array;
  private readonly previousGlowStrengths: Uint8Array;
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
    this.clearGlowPalette = palette.map(clearGlowColor);
    this.flipY = options.flipY ?? false;
    this.shadeStrength = shadeStrength;
    this.previousCells = new Uint8Array(this.width * this.height);
    this.previousGrainVariants = new Uint8Array(this.width * this.height);
    this.glowColorIds = new Uint8Array(this.width * this.height);
    this.glowStrengths = new Uint8Array(this.width * this.height);
    this.cachedFlashMask = new Uint8Array(this.width * this.height);
    this.cachedFlashColors = new Uint8Array(this.width * this.height);
    this.previousGlowColorIds = new Uint8Array(this.width * this.height);
    this.previousGlowStrengths = new Uint8Array(this.width * this.height);
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
    if (!Number.isFinite(flashIntensity) || flashIntensity < 0 || flashIntensity > 1.6) {
      throw new RangeError("Flash intensity must be between zero and 1.6");
    }
    this.resetResult();
    this.buildGlowMap(cells, flashMask);

    for (let sourceIndex = 0; sourceIndex < cells.length; sourceIndex += 1) {
      const colorId = cells[sourceIndex];
      if (colorId === undefined) {
        throw new Error("Cell buffer invariant violated");
      }
      const glowColorId = this.glowColorIds[sourceIndex] ?? 0;
      const glowStrength = this.glowStrengths[sourceIndex] ?? 0;
      const previousGlowColorId = this.previousGlowColorIds[sourceIndex] ?? 0;
      const previousGlowStrength = this.previousGlowStrengths[sourceIndex] ?? 0;
      const flashed = glowStrength > 0;
      const previouslyFlashed = previousGlowStrength > 0;
      const sourceX = sourceIndex % this.width;
      const sourceY = Math.floor(sourceIndex / this.width);
      const grainVariant = colorId === 0
        ? 0
        : grainVariants?.[sourceIndex] ?? coordinateGrainVariant(sourceX, sourceY, colorId);
      const cellChanged = !this.initialized
        || colorId !== this.previousCells[sourceIndex]
        || grainVariant !== this.previousGrainVariants[sourceIndex];
      const flashChanged = glowColorId !== previousGlowColorId
        || glowStrength !== previousGlowStrength
        || ((flashed || previouslyFlashed) && flashIntensity !== this.previousFlashIntensity);
      if (!cellChanged && !flashChanged) {
        continue;
      }
      const color = this.palette[colorId];
      const glowColor = this.clearGlowPalette[glowColorId];
      if (color === undefined || glowColor === undefined) {
        throw new RangeError(`Color id ${colorId} has no palette entry`);
      }

      this.previousCells[sourceIndex] = colorId;
      this.previousGrainVariants[sourceIndex] = grainVariant;
      this.previousGlowColorIds[sourceIndex] = glowColorId;
      this.previousGlowStrengths[sourceIndex] = glowStrength;
      const targetY = this.flipY ? this.height - 1 - sourceY : sourceY;
      const pixelOffset = (targetY * this.width + sourceX) * 4;
      const shade = colorId === 0
        ? 0
        : grainShade(grainVariant, this.shadeStrength);
      this.pixels[pixelOffset] = flashChannel(
        shadeChannel(color.r, shade),
        glowColor.r,
        flashIntensity * glowStrength / 255,
      );
      this.pixels[pixelOffset + 1] = flashChannel(
        shadeChannel(color.g, shade),
        glowColor.g,
        flashIntensity * glowStrength / 255,
      );
      this.pixels[pixelOffset + 2] = flashChannel(
        shadeChannel(color.b, shade),
        glowColor.b,
        flashIntensity * glowStrength / 255,
      );
      this.pixels[pixelOffset + 3] = color.a;
      this.includeDirty(sourceX, targetY);
    }

    this.initialized = true;
    this.previousFlashIntensity = flashIntensity;
    return this.result;
  }

  /** Builds a three-pixel additive halo around every grain selected for clearing. */
  private buildGlowMap(cells: Uint8Array, flashMask?: Uint8Array): void {
    let sourceChanged = false;
    for (let index = 0; index < cells.length; index += 1) {
      const masked = flashMask?.[index] !== undefined && flashMask[index] !== 0;
      const maskValue = masked ? 1 : 0;
      const colorValue = masked ? cells[index] ?? 0 : 0;
      if (
        this.cachedFlashMask[index] !== maskValue
        || this.cachedFlashColors[index] !== colorValue
      ) {
        this.cachedFlashMask[index] = maskValue;
        this.cachedFlashColors[index] = colorValue;
        sourceChanged = true;
      }
    }
    if (!sourceChanged) {
      return;
    }

    this.glowColorIds.fill(0);
    this.glowStrengths.fill(0);
    if (flashMask === undefined) {
      return;
    }

    const radius = 3;
    for (let sourceIndex = 0; sourceIndex < cells.length; sourceIndex += 1) {
      if (this.cachedFlashMask[sourceIndex] === 0) {
        continue;
      }
      const colorId = this.cachedFlashColors[sourceIndex] ?? 0;
      if (colorId === 0) {
        continue;
      }
      const sourceX = sourceIndex % this.width;
      const sourceY = Math.floor(sourceIndex / this.width);
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const targetY = sourceY + offsetY;
        if (targetY < 0 || targetY >= this.height) {
          continue;
        }
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const targetX = sourceX + offsetX;
          if (targetX < 0 || targetX >= this.width) {
            continue;
          }
          const distanceSquared = offsetX * offsetX + offsetY * offsetY;
          const strength = glowStrengthForDistance(distanceSquared);
          if (strength === 0) {
            continue;
          }
          const targetIndex = targetY * this.width + targetX;
          const existingStrength = this.glowStrengths[targetIndex] ?? 0;
          if (strength > existingStrength) {
            this.glowStrengths[targetIndex] = strength;
            this.glowColorIds[targetIndex] = colorId;
          }
        }
      }
    }
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
  intensity: number,
): number {
  if (intensity <= 0) {
    return channel;
  }
  const screened = 255 - ((255 - channel) * (255 - glowTarget)) / 255;
  return Math.max(0, Math.min(255, Math.round(channel + (screened - channel) * intensity)));
}

/** Creates a bright, high-saturation emissive color without washing it toward white. */
export function clearGlowColor(color: RgbaColor): RgbaColor {
  const channels = [color.r, color.g, color.b];
  for (const channel of [...channels, color.a]) {
    if (!Number.isInteger(channel) || channel < 0 || channel > 255) {
      throw new RangeError("Clear glow channels must be integers between zero and 255");
    }
  }
  const minimum = Math.min(...channels);
  const maximum = Math.max(...channels);
  if (maximum === minimum) {
    return { ...color };
  }
  const saturatedFloor = 18;
  const saturated = channels.map((channel) => (
    saturatedFloor
      + ((channel - minimum) / (maximum - minimum)) * (255 - saturatedFloor)
  ));
  return {
    r: Math.round(saturated[0] ?? color.r),
    g: Math.round(saturated[1] ?? color.g),
    b: Math.round(saturated[2] ?? color.b),
    a: color.a,
  };
}

function glowStrengthForDistance(distanceSquared: number): number {
  if (distanceSquared === 0) return 255;
  if (distanceSquared <= 1) return 150;
  if (distanceSquared <= 2) return 112;
  if (distanceSquared <= 4) return 78;
  if (distanceSquared <= 5) return 54;
  if (distanceSquared <= 8) return 34;
  if (distanceSquared <= 9) return 22;
  return 0;
}

/** Two sustained colored-light pulses, amplified by successive chain clears. */
export function clearFlashIntensity(progress: number, chainLevel = 1): number {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError("Clear flash progress must be between zero and one");
  }
  if (!Number.isInteger(chainLevel) || chainLevel <= 0) {
    throw new RangeError("Clear flash chain level must be a positive integer");
  }
  if (progress === 1) {
    return 0;
  }
  const wave = Math.sin(progress * Math.PI * 2);
  const sustainedPulse = Math.pow(wave * wave, 0.38);
  const chainBoost = Math.min(1.6, 1 + (chainLevel - 1) * 0.18);
  return sustainedPulse * chainBoost;
}
