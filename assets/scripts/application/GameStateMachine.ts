export type GamePhase =
  | "Idle"
  | "Spawning"
  | "Falling"
  | "LockDelay"
  | "Resolving"
  | "Clearing"
  | "Paused"
  | "GameOver";

const ALLOWED_TRANSITIONS: Readonly<Record<Exclude<GamePhase, "Paused">, readonly GamePhase[]>> = {
  Idle: ["Spawning"],
  Spawning: ["Falling", "GameOver"],
  Falling: ["LockDelay", "Resolving"],
  LockDelay: ["Falling", "Resolving"],
  Resolving: ["Clearing", "Spawning"],
  Clearing: ["Resolving"],
  GameOver: ["Spawning"],
};

export class GameStateMachine {
  private currentPhase: GamePhase = "Idle";
  private phaseBeforePause: Exclude<GamePhase, "Paused"> | undefined;

  public get phase(): GamePhase {
    return this.currentPhase;
  }

  /** Starts or restarts a session and discards any paused phase. */
  public start(): void {
    this.currentPhase = "Spawning";
    this.phaseBeforePause = undefined;
  }

  public transition(next: GamePhase): void {
    if (this.currentPhase === "Paused" || next === "Paused") {
      throw new Error("Use pause() or resume() for paused state transitions");
    }
    const allowed = ALLOWED_TRANSITIONS[this.currentPhase];
    if (!allowed.includes(next)) {
      throw new Error(`Invalid game phase transition: ${this.currentPhase} -> ${next}`);
    }
    this.currentPhase = next;
  }

  public pause(): boolean {
    if (this.currentPhase === "Idle" || this.currentPhase === "GameOver" || this.currentPhase === "Paused") {
      return false;
    }
    this.phaseBeforePause = this.currentPhase;
    this.currentPhase = "Paused";
    return true;
  }

  public resume(): boolean {
    if (this.currentPhase !== "Paused" || this.phaseBeforePause === undefined) {
      return false;
    }
    this.currentPhase = this.phaseBeforePause;
    this.phaseBeforePause = undefined;
    return true;
  }
}
