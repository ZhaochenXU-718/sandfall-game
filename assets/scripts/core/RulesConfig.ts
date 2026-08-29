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
  readonly spanningComponentBonus: number;
  readonly chainMultiplierStep: number;
}

export const DEFAULT_RULES: Readonly<RulesConfig> = Object.freeze({
  version: "0.10.0",
  macroWidth: 14,
  macroHeight: 24,
  grainsPerCell: 8,
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
  spanningComponentBonus: 200,
  chainMultiplierStep: 0.5,
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
