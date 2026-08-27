export class StableDetector {
  private readonly threshold: number;
  private stableTickCount = 0;

  public constructor(threshold = 4) {
    if (!Number.isInteger(threshold) || threshold <= 0) {
      throw new RangeError("Stable threshold must be a positive integer");
    }
    this.threshold = threshold;
  }

  public get count(): number {
    return this.stableTickCount;
  }

  public get isStable(): boolean {
    return this.stableTickCount >= this.threshold;
  }

  public update(movedCount: number): void {
    if (!Number.isInteger(movedCount) || movedCount < 0) {
      throw new RangeError("Moved count must be a non-negative integer");
    }
    this.stableTickCount = movedCount === 0 ? this.stableTickCount + 1 : 0;
  }

  public reset(): void {
    this.stableTickCount = 0;
  }
}
