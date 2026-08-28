export interface InputAutoRepeatOptions {
  readonly initialDelayMs: number;
  readonly repeatIntervalMs: number;
  readonly maxRepeatsPerUpdate?: number;
}

/** Frame-rate-independent key repeat timing for held gameplay inputs. */
export class InputAutoRepeat {
  private readonly initialDelayMs: number;
  private readonly repeatIntervalMs: number;
  private readonly maxRepeatsPerUpdate: number;
  private remainingMs: number;

  public constructor(options: InputAutoRepeatOptions) {
    if (!Number.isFinite(options.initialDelayMs) || options.initialDelayMs < 0) {
      throw new RangeError("Initial repeat delay must be a non-negative finite number");
    }
    if (!Number.isFinite(options.repeatIntervalMs) || options.repeatIntervalMs <= 0) {
      throw new RangeError("Repeat interval must be a positive finite number");
    }
    const maxRepeats = options.maxRepeatsPerUpdate ?? 4;
    if (!Number.isInteger(maxRepeats) || maxRepeats <= 0) {
      throw new RangeError("Maximum repeats per update must be a positive integer");
    }

    this.initialDelayMs = options.initialDelayMs;
    this.repeatIntervalMs = options.repeatIntervalMs;
    this.maxRepeatsPerUpdate = maxRepeats;
    this.remainingMs = this.initialDelayMs;
  }

  public reset(): void {
    this.remainingMs = this.initialDelayMs;
  }

  /** Returns how many repeat actions should be emitted for this frame. */
  public advance(deltaSeconds: number): number {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("Input repeat delta must be a non-negative finite number");
    }
    if (deltaSeconds === 0) {
      return 0;
    }

    this.remainingMs -= deltaSeconds * 1000;
    let repeats = 0;
    while (this.remainingMs <= 1e-9 && repeats < this.maxRepeatsPerUpdate) {
      repeats += 1;
      this.remainingMs += this.repeatIntervalMs;
    }

    // A stalled frame should not cause a long burst of delayed inputs.
    if (this.remainingMs <= 0) {
      const overdueMs = -this.remainingMs;
      this.remainingMs = this.repeatIntervalMs - (overdueMs % this.repeatIntervalMs);
    }
    return repeats;
  }
}
