export interface RulesConfig {
  readonly version: string;
  readonly macroWidth: number;
  readonly macroHeight: number;
  readonly grainsPerCell: number;
  readonly colorCount: number;
  readonly fixedHz: number;
  readonly stableTicks: number;
  readonly sandSubsteps: number;
  readonly normalFallIntervalMs: number;
  readonly softDropIntervalMs: number;
  readonly lockDelayMs: number;
  readonly clearEffectDurationMs: number;
  readonly maxLockResets: number;
  readonly softDropPointsPerRow: number;
  readonly hardDropPointsPerRow: number;
  readonly clearedComponentBonus: number;
  readonly chainMultiplierStep: number;
  /**
   * Smallest same-colour component that clears. Position is irrelevant; only
   * size counts.
   *
   * Three pieces' worth sits on a measured cliff. Below it random placement
   * stumbles into clears and nothing is loseable; above it the only workable
   * play is farming one colour per zone, which beats everything else 3x. See
   * docs/02-game-rules.md section 5.
   */
  readonly minBlobGrains: number;
}

/** Every piece is a tetromino, so each lock rasterises to this many grains. */
export const PIECE_CELL_COUNT = 4;

export function grainsPerPiece(config: Pick<RulesConfig, "grainsPerCell">): number {
  return PIECE_CELL_COUNT * config.grainsPerCell * config.grainsPerCell;
}

export type GameMode = "progressive" | "classic";

export const CLEARS_PER_LEVEL = 5;
export const PROGRESSIVE_COLOR_UNLOCK_LEVEL = 4;
export const PROGRESSIVE_UNLOCKED_COLOR_COUNT = 5;

/** Normal-fall cadence for levels 1-6 at the default 600 ms starting speed. */
export const DEFAULT_LEVEL_FALL_INTERVALS_MS: readonly number[] = Object.freeze([
  600,
  520,
  450,
  390,
  340,
  300,
]);

export function levelForClearCount(
  clearCount: number,
  mode: GameMode = "progressive",
): number {
  if (!Number.isInteger(clearCount) || clearCount < 0) {
    throw new RangeError("clearCount must be a non-negative integer");
  }
  return mode === "classic" ? 1 : Math.min(
    DEFAULT_LEVEL_FALL_INTERVALS_MS.length,
    Math.floor(clearCount / CLEARS_PER_LEVEL) + 1,
  );
}

export function normalFallIntervalForLevel(
  baseIntervalMs: number,
  level: number,
  mode: GameMode = "progressive",
): number {
  if (!Number.isFinite(baseIntervalMs) || baseIntervalMs <= 0) {
    throw new RangeError("baseIntervalMs must be positive");
  }
  if (!Number.isInteger(level) || level <= 0) {
    throw new RangeError("level must be a positive integer");
  }
  if (mode === "classic") {
    return Math.round(baseIntervalMs);
  }
  const scheduleIndex = Math.min(level, DEFAULT_LEVEL_FALL_INTERVALS_MS.length) - 1;
  const scheduledInterval = DEFAULT_LEVEL_FALL_INTERVALS_MS[scheduleIndex];
  if (scheduledInterval === undefined) {
    throw new Error("Fall interval schedule is empty");
  }
  return Math.max(1, Math.round(baseIntervalMs * scheduledInterval / 600));
}

export function colorCountForLevel(baseColorCount: number, level: number, mode: GameMode): number {
  if (!Number.isInteger(baseColorCount) || baseColorCount <= 0 || baseColorCount > 255) {
    throw new RangeError("baseColorCount must be an integer between 1 and 255");
  }
  if (!Number.isInteger(level) || level <= 0) {
    throw new RangeError("level must be a positive integer");
  }
  if (mode === "progressive" && level >= PROGRESSIVE_COLOR_UNLOCK_LEVEL) {
    return Math.max(baseColorCount, PROGRESSIVE_UNLOCKED_COLOR_COUNT);
  }
  return baseColorCount;
}

const DEFAULT_GRAINS_PER_CELL = 9;
/** Blob threshold in whole pieces; 3 measured as the balanced setting. */
const DEFAULT_MIN_BLOB_PIECES = 3;

export const DEFAULT_RULES: Readonly<RulesConfig> = Object.freeze({
  version: "0.15.0",
  macroWidth: 12,
  macroHeight: 20,
  grainsPerCell: DEFAULT_GRAINS_PER_CELL,
  colorCount: 4,
  fixedHz: 60,
  stableTicks: 4,
  sandSubsteps: 2,
  normalFallIntervalMs: 600,
  softDropIntervalMs: 50,
  lockDelayMs: 120,
  clearEffectDurationMs: 420,
  maxLockResets: 10,
  softDropPointsPerRow: 1,
  hardDropPointsPerRow: 2,
  clearedComponentBonus: 200,
  chainMultiplierStep: 0.5,
  minBlobGrains: DEFAULT_MIN_BLOB_PIECES
    * PIECE_CELL_COUNT * DEFAULT_GRAINS_PER_CELL * DEFAULT_GRAINS_PER_CELL,
});

export function sandBoardSize(config: RulesConfig): {
  readonly width: number;
  readonly height: number;
} {
  return {
    width: config.macroWidth * config.grainsPerCell,
    height: config.macroHeight * config.grainsPerCell,
  };
}
