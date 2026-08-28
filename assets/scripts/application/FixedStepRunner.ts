export interface FixedStepFrameResult {
  steps: number;
  droppedSeconds: number;
  interpolationAlpha: number;
}

export interface FixedStepRunnerOptions {
  readonly fixedHz: number;
  readonly maxFrameDeltaSeconds?: number;
  readonly maxStepsPerFrame?: number;
}

/**
 * Converts variable render deltas into deterministic fixed simulation ticks.
 * The returned result object is reused on the next call.
 */
export class FixedStepRunner {
  public readonly fixedDelta: number;

  private readonly maxFrameDeltaSeconds: number;
  private readonly maxStepsPerFrame: number;
  private readonly step: (fixedDelta: number) => void;
  private accumulator = 0;
  private readonly result: FixedStepFrameResult = {
    steps: 0,
    droppedSeconds: 0,
    interpolationAlpha: 0,
  };

  public constructor(options: FixedStepRunnerOptions, step: (fixedDelta: number) => void) {
    if (!Number.isFinite(options.fixedHz) || options.fixedHz <= 0) {
      throw new RangeError("fixedHz must be positive");
    }
    const maxFrameDelta = options.maxFrameDeltaSeconds ?? 0.25;
    const maxSteps = options.maxStepsPerFrame ?? 5;
    if (!Number.isFinite(maxFrameDelta) || maxFrameDelta <= 0) {
      throw new RangeError("maxFrameDeltaSeconds must be positive");
    }
    if (!Number.isInteger(maxSteps) || maxSteps <= 0) {
      throw new RangeError("maxStepsPerFrame must be a positive integer");
    }

    this.fixedDelta = 1 / options.fixedHz;
    this.maxFrameDeltaSeconds = maxFrameDelta;
    this.maxStepsPerFrame = maxSteps;
    this.step = step;
  }

  public advance(frameDeltaSeconds: number): FixedStepFrameResult {
    if (!Number.isFinite(frameDeltaSeconds) || frameDeltaSeconds < 0) {
      throw new RangeError("Frame delta must be a non-negative finite number");
    }
    this.result.steps = 0;
    this.result.droppedSeconds = Math.max(0, frameDeltaSeconds - this.maxFrameDeltaSeconds);
    const acceptedDelta = Math.min(frameDeltaSeconds, this.maxFrameDeltaSeconds);
    this.accumulator += acceptedDelta;

    while (
      this.accumulator + Number.EPSILON >= this.fixedDelta
      && this.result.steps < this.maxStepsPerFrame
    ) {
      this.step(this.fixedDelta);
      this.accumulator -= this.fixedDelta;
      this.result.steps += 1;
    }

    if (this.accumulator + Number.EPSILON >= this.fixedDelta) {
      const retained = this.accumulator % this.fixedDelta;
      this.result.droppedSeconds += this.accumulator - retained;
      this.accumulator = retained;
    }
    this.result.interpolationAlpha = Math.min(1, Math.max(0, this.accumulator / this.fixedDelta));
    return this.result;
  }

  public reset(): void {
    this.accumulator = 0;
    this.result.steps = 0;
    this.result.droppedSeconds = 0;
    this.result.interpolationAlpha = 0;
  }
}
