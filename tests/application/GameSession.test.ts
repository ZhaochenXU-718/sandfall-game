import { describe, expect, it } from "vitest";
import { GameSession } from "../../assets/scripts/application/GameSession";
import { I_PIECE, O_PIECE } from "../../assets/scripts/core/PieceDefinitions";
import type { RulesConfig } from "../../assets/scripts/core/RulesConfig";

const STEP = 0.1;

function rules(overrides: Partial<RulesConfig> = {}): RulesConfig {
  return {
    version: "test",
    macroWidth: 4,
    macroHeight: 6,
    grainsPerCell: 1,
    colorCount: 5,
    fixedHz: 10,
    stableTicks: 1,
    sandSubsteps: 1,
    normalFallIntervalMs: 100,
    softDropIntervalMs: 20,
    lockDelayMs: 100,
    clearEffectDurationMs: 0,
    maxLockResets: 2,
    softDropPointsPerRow: 1,
    hardDropPointsPerRow: 2,
    spanningComponentBonus: 200,
    chainMultiplierStep: 0.5,
    ...overrides,
  };
}

describe("GameSession", () => {
  it("spawns, naturally falls, locks, and rasterizes a piece", () => {
    const session = new GameSession({ rules: rules(), pieces: [O_PIECE] });
    session.start(1);
    expect(session.phase).toBe("Spawning");

    session.tick(STEP);
    expect(session.phase).toBe("Falling");
    expect(session.activePiece?.y).toBe(0);

    for (let tick = 0; tick < 4; tick += 1) {
      session.tick(STEP);
    }
    expect(session.phase).toBe("LockDelay");
    expect(session.activePiece?.y).toBe(4);

    session.tick(STEP);
    expect(session.phase).toBe("Resolving");
    expect(session.activePiece).toBeUndefined();
    expect(session.lockSequence).toBe(1);
    expect(session.lastLockedPiece?.y).toBe(4);
    expect([...session.getBoardSnapshot()].filter(Boolean)).toHaveLength(4);
  });

  it("hard drops and completes a spanning clear cycle", () => {
    const session = new GameSession({ rules: rules(), pieces: [I_PIECE] });
    session.start(2);
    session.tick(STEP);
    expect(session.hardDrop()).toBe(5);
    expect(session.score).toBe(10);
    expect(session.phase).toBe("Resolving");

    session.tick(STEP);
    expect(session.phase).toBe("Clearing");
    session.tick(STEP);
    expect(session.phase).toBe("Resolving");
    expect(session.chainLevel).toBe(1);
    expect(session.score).toBe(214);
    expect(session.clearCount).toBe(1);
    expect(session.maxChain).toBe(1);
    expect(session.getBoardSnapshot()).toEqual(new Uint8Array(24));

    session.tick(STEP);
    expect(session.phase).toBe("Spawning");
    expect(session.chainLevel).toBe(0);
  });

  it("keeps a spanning component visible until the clear effect completes", () => {
    const session = new GameSession({
      rules: rules({ clearEffectDurationMs: 400 }),
      pieces: [I_PIECE],
    });
    const mask = new Uint8Array(24);
    session.start(20);
    session.tick(STEP);
    session.hardDrop();
    session.tick(STEP);

    expect(session.phase).toBe("Clearing");
    expect(session.getClearProgress()).toBe(0);
    expect(session.getClearProgress(0.05)).toBeCloseTo(0.125);
    expect(session.copyClearMaskTo(mask)).toBe(true);
    expect([...mask].filter(Boolean)).toHaveLength(4);
    expect([...session.getBoardSnapshot()].filter(Boolean)).toHaveLength(4);

    for (let tick = 0; tick < 3; tick += 1) {
      session.tick(STEP);
    }
    expect(session.phase).toBe("Clearing");
    expect(session.getClearProgress()).toBeCloseTo(0.75);
    expect([...session.getBoardSnapshot()].filter(Boolean)).toHaveLength(4);

    session.tick(STEP);
    expect(session.phase).toBe("Resolving");
    expect(session.copyClearMaskTo(mask)).toBe(false);
    expect(mask).toEqual(new Uint8Array(24));
    expect(session.getBoardSnapshot()).toEqual(new Uint8Array(24));
  });

  it("soft drop uses its shorter configured interval", () => {
    const session = new GameSession({
      rules: rules({ normalFallIntervalMs: 1000, softDropIntervalMs: 100 }),
      pieces: [O_PIECE],
    });
    session.start(3);
    session.tick(STEP);
    session.setSoftDrop(true);
    session.tick(STEP);
    expect(session.activePiece?.y).toBe(1);
    expect(session.score).toBe(1);
  });

  it("promotes the advertised next piece on the following spawn", () => {
    const session = new GameSession({
      rules: rules({ macroWidth: 6, macroHeight: 10 }),
      pieces: [I_PIECE, O_PIECE],
    });
    session.start(31);
    session.tick(STEP);
    const advertised = session.nextPiece;

    expect(advertised).toBeDefined();
    session.hardDrop();
    for (let tick = 0; tick < 100 && session.phase !== "Spawning"; tick += 1) {
      session.tick(STEP);
    }
    expect(session.phase).toBe("Spawning");
    session.tick(STEP);

    expect(session.activePiece?.definition.id).toBe(advertised?.definition.id);
    expect(session.activePiece?.color).toBe(advertised?.color);
  });

  it("exposes continuous fall progress and preserves it when fall speed changes", () => {
    const session = new GameSession({
      rules: rules({ normalFallIntervalMs: 400, softDropIntervalMs: 100 }),
      pieces: [O_PIECE],
    });
    session.start(30);
    session.tick(STEP);

    expect(session.getFallProgress()).toBe(0);
    expect(session.getFallProgress(0.05)).toBeCloseTo(0.125);
    session.tick(STEP);
    expect(session.getFallProgress()).toBeCloseTo(0.25);

    session.setSoftDrop(true);
    expect(session.getFallProgress()).toBeCloseTo(0.25);
    session.setSoftDrop(false);
    expect(session.getFallProgress()).toBeCloseTo(0.25);
  });

  it("pauses without advancing simulation time or piece position", () => {
    const session = new GameSession({ rules: rules(), pieces: [O_PIECE] });
    session.start(4);
    session.tick(STEP);
    const tickBeforePause = session.simulationTick;
    const timeBeforePause = session.elapsedMilliseconds;
    const yBeforePause = session.activePiece?.y;

    expect(session.pause()).toBe(true);
    expect(session.moveLeft()).toBe(false);
    expect(session.hardDrop()).toBe(0);
    session.tick(STEP);
    expect(session.simulationTick).toBe(tickBeforePause);
    expect(session.elapsedMilliseconds).toBe(timeBeforePause);
    expect(session.activePiece?.y).toBe(yBeforePause);
    expect(session.resume()).toBe(true);
    session.tick(STEP);
    expect(session.simulationTick).toBe(tickBeforePause + 1);
    expect(session.elapsedMilliseconds).toBe(timeBeforePause + 100);
  });

  it("locks on the landing tick when lock delay is zero", () => {
    const session = new GameSession({
      rules: rules({ lockDelayMs: 0 }),
      pieces: [O_PIECE],
    });
    session.start(40);
    session.tick(STEP);
    for (let tick = 0; tick < 4; tick += 1) {
      session.tick(STEP);
    }
    expect(session.phase).toBe("Resolving");
    expect(session.activePiece).toBeUndefined();
  });

  it("enters game over when the next piece cannot spawn", () => {
    const session = new GameSession({
      rules: rules({ macroHeight: 1 }),
      pieces: [O_PIECE],
    });
    session.start(5);
    session.tick(STEP);
    expect(session.phase).toBe("GameOver");
    expect(session.activePiece).toBeUndefined();
    const endedAt = session.elapsedMilliseconds;
    session.tick(STEP);
    expect(session.elapsedMilliseconds).toBe(endedAt);

    session.start(50);
    expect(session.score).toBe(0);
    expect(session.clearCount).toBe(0);
    expect(session.maxChain).toBe(0);
    expect(session.elapsedMilliseconds).toBe(0);
  });

  it("rejects a variable simulation step", () => {
    const session = new GameSession({ rules: rules(), pieces: [O_PIECE] });
    session.start(6);
    expect(() => session.tick(0.2)).toThrow(RangeError);
  });

  it("produces identical sessions for the same seed and commands", () => {
    const sessionRules = rules({ macroWidth: 6, macroHeight: 8 });
    const first = new GameSession({ rules: sessionRules, pieces: [O_PIECE] });
    const second = new GameSession({ rules: sessionRules, pieces: [O_PIECE] });
    first.start(12345);
    second.start(12345);

    for (let tick = 0; tick < 100; tick += 1) {
      if (first.phase === "Falling" || first.phase === "LockDelay") {
        first.hardDrop();
        second.hardDrop();
      }
      first.tick(STEP);
      second.tick(STEP);
    }

    expect(second.phase).toBe(first.phase);
    expect(second.simulationTick).toBe(first.simulationTick);
    expect(second.chainLevel).toBe(first.chainLevel);
    expect(second.score).toBe(first.score);
    expect(second.clearCount).toBe(first.clearCount);
    expect(second.maxChain).toBe(first.maxChain);
    expect(second.activePiece).toEqual(first.activePiece);
    expect(second.nextPiece).toEqual(first.nextPiece);
    expect(second.getBoardSnapshot()).toEqual(first.getBoardSnapshot());
  });
});
