import { describe, expect, it } from "vitest";
import { GameStateMachine } from "../../assets/scripts/application/GameStateMachine";

describe("GameStateMachine", () => {
  it("follows the core round transition path", () => {
    const machine = new GameStateMachine();
    machine.start();
    machine.transition("Falling");
    machine.transition("LockDelay");
    machine.transition("Resolving");
    machine.transition("Clearing");
    machine.transition("Resolving");
    machine.transition("Spawning");
    expect(machine.phase).toBe("Spawning");
  });

  it("preserves and restores the phase when paused", () => {
    const machine = new GameStateMachine();
    machine.start();
    machine.transition("Falling");
    expect(machine.pause()).toBe(true);
    expect(machine.phase).toBe("Paused");
    expect(machine.resume()).toBe(true);
    expect(machine.phase).toBe("Falling");
  });

  it("rejects invalid transitions", () => {
    const machine = new GameStateMachine();
    machine.start();
    expect(() => machine.transition("Clearing")).toThrow();
  });
});
