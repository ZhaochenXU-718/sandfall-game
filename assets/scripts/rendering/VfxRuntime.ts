export type VfxKind = "particle" | "halo";

export const REQUIRED_VFX_SPRITES = Object.freeze([
  "dust-impact",
  "dust-rise",
  "dust-burst",
  "sand-fall",
  "glow-core",
  "noise-threshold",
  "noise-cluster",
  "pulse-ring",
  "diamond-halo",
] as const);

export type VfxSpriteName = typeof REQUIRED_VFX_SPRITES[number];

export interface VfxAtlasSprite {
  readonly source: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly kind: VfxKind;
}

export interface VfxAtlasLayout {
  readonly version: number;
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly sprites: Readonly<Record<VfxSpriteName, VfxAtlasSprite>>;
}

export interface VfxBudgetLimits {
  readonly total: number;
  readonly particle: number;
  readonly halo: number;
}

export const DEFAULT_VFX_BUDGET: Readonly<VfxBudgetLimits> = Object.freeze({
  total: 28,
  particle: 24,
  halo: 4,
});

export class VfxBudget {
  private readonly limits: Readonly<VfxBudgetLimits>;
  private totalCount = 0;
  private readonly counts: Record<VfxKind, number> = {
    particle: 0,
    halo: 0,
  };

  public constructor(limits: Readonly<VfxBudgetLimits> = DEFAULT_VFX_BUDGET) {
    for (const value of [limits.total, limits.particle, limits.halo]) {
      if (!Number.isInteger(value) || value < 0) {
        throw new RangeError("VFX budget limits must be non-negative integers");
      }
    }
    if (limits.particle + limits.halo < limits.total) {
      throw new RangeError("VFX category limits cannot be smaller than the total limit");
    }
    this.limits = limits;
  }

  public acquire(kind: VfxKind): boolean {
    if (this.totalCount >= this.limits.total || this.counts[kind] >= this.limits[kind]) {
      return false;
    }
    this.totalCount += 1;
    this.counts[kind] += 1;
    return true;
  }

  public release(kind: VfxKind): void {
    if (this.totalCount <= 0 || this.counts[kind] <= 0) {
      throw new Error(`Cannot release inactive ${kind} VFX`);
    }
    this.totalCount -= 1;
    this.counts[kind] -= 1;
  }

  public reset(): void {
    this.totalCount = 0;
    this.counts.particle = 0;
    this.counts.halo = 0;
  }

  public get total(): number {
    return this.totalCount;
  }

  public count(kind: VfxKind): number {
    return this.counts[kind];
  }
}

export function parseVfxAtlasLayout(value: unknown): VfxAtlasLayout {
  const root = record(value, "VFX atlas layout");
  const width = positiveInteger(root.width, "atlas width");
  const height = positiveInteger(root.height, "atlas height");
  const padding = nonNegativeInteger(root.padding, "atlas padding");
  const version = positiveInteger(root.version, "atlas version");
  const rawSprites = record(root.sprites, "atlas sprites");
  const sprites = {} as Record<VfxSpriteName, VfxAtlasSprite>;

  for (const name of REQUIRED_VFX_SPRITES) {
    const raw = record(rawSprites[name], `atlas sprite ${name}`);
    const kind = raw.kind;
    if (kind !== "particle" && kind !== "halo") {
      throw new TypeError(`Invalid VFX kind for ${name}`);
    }
    const source = raw.source;
    if (typeof source !== "string" || source.length === 0) {
      throw new TypeError(`Invalid VFX source for ${name}`);
    }
    const sprite: VfxAtlasSprite = {
      source,
      x: nonNegativeInteger(raw.x, `${name} x`),
      y: nonNegativeInteger(raw.y, `${name} y`),
      width: positiveInteger(raw.width, `${name} width`),
      height: positiveInteger(raw.height, `${name} height`),
      kind,
    };
    if (sprite.x + sprite.width > width || sprite.y + sprite.height > height) {
      throw new RangeError(`VFX sprite ${name} is outside the atlas`);
    }
    sprites[name] = sprite;
  }

  for (let leftIndex = 0; leftIndex < REQUIRED_VFX_SPRITES.length; leftIndex += 1) {
    const leftName = REQUIRED_VFX_SPRITES[leftIndex]!;
    const left = sprites[leftName];
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < REQUIRED_VFX_SPRITES.length;
      rightIndex += 1
    ) {
      const rightName = REQUIRED_VFX_SPRITES[rightIndex]!;
      const right = sprites[rightName];
      if (
        left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y
      ) {
        throw new RangeError(`VFX sprites overlap: ${leftName} / ${rightName}`);
      }
    }
  }

  return { version, width, height, padding, sprites };
}

function record(value: unknown, label: string): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new RangeError(`${label} must be a positive integer`);
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new RangeError(`${label} must be a non-negative integer`);
  }
  return value as number;
}
