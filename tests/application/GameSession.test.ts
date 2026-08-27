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
    normalFallIntervalMs: 100,
    softDropIntervalMs: 20,
    lockDelayMs: 100,
    maxLockResets: 2,
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
    expect([...session.getBoardSnapshot()].filter(Boolean)).toHaveLength(4);
  });

  it("hard drops and completes a spanning clear cycle", () => {
    const session = new GameSession({ rules: rules(), pieces: [I_PIECE] });
    session.start(2);
    session.tick(STEP);
    expect(session.hardDrop()).toBe(5);
    expect(session.phase).toBe("Resolving");

    session.tick(STEP);
    expect(session.phase).toBe("Clearing");
    session.tick(STEP);
    expect(session.phase).toBe("Resolving");
    expect(session.chainLevel).toBe(1);
    expect(session.getBoardSnapshot()).toEqual(new Uint8Array(24));

    session.tick(STEP);
    expect(session.phase).toBe("Spawning");
    expect(session.chainLevel).toBe(0);
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
  });

  it("pauses without advancing simulation time or piece position", () => {
    const session = new GameSession({ rules: rules(), pieces: [O_PIECE] });
    session.start(4);
    session.tick(STEP);
    const tickBeforePause = session.simulationTick;
    const yBeforePause = session.activePiece?.y;

    expect(session.pause()).toBe(true);
    expect(session.moveLeft()).toBe(false);
    expect(session.hardDrop()).toBe(0);
    session.tick(STEP);
    expect(session.simulationTick).toBe(tickBeforePause);
    expect(session.activePiece?.y).toBe(yBeforePause);
    expect(session.resume()).toBe(true);
    session.tick(STEP);
    expect(session.simulationTick).toBe(tickBeforePause + 1);
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
    expect(second.activePiece).toEqual(first.activePiece);
    expect(second.nextPiece).toEqual(first.nextPiece);
    expect(second.getBoardSnapshot()).toEqual(first.getBoardSnapshot());
  });
});
