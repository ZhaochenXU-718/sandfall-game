export interface RulesConfig {
  readonly version: string;
  readonly macroWidth: number;
  readonly macroHeight: number;
  readonly grainsPerCell: number;
  readonly colorCount: number;
  readonly fixedHz: number;
  readonly stableTicks: number;
  readonly normalFallIntervalMs: number;
  readonly softDropIntervalMs: number;
  readonly lockDelayMs: number;
  readonly maxLockResets: number;
}

export const DEFAULT_RULES: Readonly<RulesConfig> = Object.freeze({
  version: "0.3.0",
  macroWidth: 10,
  macroHeight: 24,
  grainsPerCell: 6,
  colorCount: 5,
  fixedHz: 60,
  stableTicks: 4,
  normalFallIntervalMs: 800,
  softDropIntervalMs: 50,
  lockDelayMs: 350,
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
