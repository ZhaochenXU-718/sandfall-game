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
}

export const DEFAULT_RULES: Readonly<RulesConfig> = Object.freeze({
  version: "0.6.0",
  macroWidth: 10,
  macroHeight: 24,
  grainsPerCell: 12,
  colorCount: 4,
  fixedHz: 60,
  stableTicks: 4,
  sandSubsteps: 2,
  normalFallIntervalMs: 600,
  softDropIntervalMs: 50,
  lockDelayMs: 120,
  clearEffectDurationMs: 420,
  maxLockResets: 10,
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
