export type GestureCommand =
  | { readonly type: "moveHorizontal"; readonly direction: -1 | 1; readonly steps: number }
  | { readonly type: "rotateCW" }
  | { readonly type: "softDrop"; readonly active: boolean }
  | { readonly type: "hardDrop" };

export interface GestureRecognizerOptions {
  readonly tapMaxDistance: number;
  readonly tapMaxDurationMs: number;
  readonly horizontalActivationDistance: number;
  readonly horizontalStepDistance: number;
  readonly downwardActivationDistance: number;
  readonly softDropHoldMs: number;
  readonly hardDropDistance: number;
  readonly hardDropMaxDurationMs: number;
  readonly directionBias: number;
}

export const DEFAULT_GESTURE_OPTIONS: Readonly<GestureRecognizerOptions> = Object.freeze({
  tapMaxDistance: 12,
  tapMaxDurationMs: 300,
  horizontalActivationDistance: 14,
  horizontalStepDistance: 22,
  downwardActivationDistance: 24,
  softDropHoldMs: 120,
  hardDropDistance: 72,
  hardDropMaxDurationMs: 250,
  directionBias: 1.15,
});

type GestureMode = "idle" | "pending" | "horizontal" | "softDrop" | "completed";

/**
 * Converts a single pointer stream into mutually exclusive gameplay commands.
 * Coordinates and thresholds use Cocos UI/design-resolution points, so they do
 * not change with the physical screen DPI.
 */
export class GestureRecognizer {
  private readonly options: Readonly<GestureRecognizerOptions>;
  private mode: GestureMode = "idle";
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private horizontalAnchorX = 0;
  private elapsedMs = 0;

  public constructor(options: Partial<GestureRecognizerOptions> = {}) {
    this.options = Object.freeze({ ...DEFAULT_GESTURE_OPTIONS, ...options });
    this.validateOptions();
  }

  public get isTracking(): boolean {
    return this.mode !== "idle";
  }

  public begin(x: number, y: number): void {
    this.validatePoint(x, y);
    this.mode = "pending";
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
    this.horizontalAnchorX = x;
    this.elapsedMs = 0;
  }

  public move(x: number, y: number): GestureCommand[] {
    this.validatePoint(x, y);
    if (this.mode === "idle" || this.mode === "completed" || this.mode === "softDrop") {
      return [];
    }
    this.currentX = x;
    this.currentY = y;

    if (this.mode === "horizontal") {
      return this.consumeHorizontalSteps();
    }
    return this.classifyPendingGesture(false);
  }

  public advance(deltaSeconds: number): GestureCommand[] {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
      throw new RangeError("deltaSeconds must be a finite non-negative number");
    }
    if (this.mode === "idle" || this.mode === "completed") {
      return [];
    }
    this.elapsedMs += deltaSeconds * 1000;
    if (this.mode !== "pending" || this.elapsedMs < this.options.softDropHoldMs) {
      return [];
    }

    const deltaX = Math.abs(this.currentX - this.startX);
    const downwardDistance = this.startY - this.currentY;
    if (
      downwardDistance >= this.options.downwardActivationDistance
      && downwardDistance >= deltaX * this.options.directionBias
    ) {
      this.mode = "softDrop";
      return [{ type: "softDrop", active: true }];
    }
    return [];
  }

  public end(x: number, y: number): GestureCommand[] {
    this.validatePoint(x, y);
    if (this.mode === "idle") {
      return [];
    }
    this.currentX = x;
    this.currentY = y;

    let commands: GestureCommand[] = [];
    if (this.mode === "softDrop") {
      commands = [{ type: "softDrop", active: false }];
    } else if (this.mode === "horizontal") {
      commands = this.consumeHorizontalSteps();
    } else if (this.mode === "pending") {
      commands = this.classifyPendingGesture(true);
      if (this.mode === "pending" && this.isTap()) {
        commands.push({ type: "rotateCW" });
      }
    }
    this.reset();
    return commands;
  }

  public cancel(): GestureCommand[] {
    if (this.mode === "idle") {
      return [];
    }
    const commands: GestureCommand[] = this.mode === "softDrop"
      ? [{ type: "softDrop", active: false }]
      : [];
    this.reset();
    return commands;
  }

  private classifyPendingGesture(allowHardDrop: boolean): GestureCommand[] {
    const signedDeltaX = this.currentX - this.startX;
    const horizontalDistance = Math.abs(signedDeltaX);
    const verticalDistance = Math.abs(this.currentY - this.startY);
    const downwardDistance = this.startY - this.currentY;
    const horizontalIntent = horizontalDistance >= this.options.horizontalActivationDistance
      && horizontalDistance >= verticalDistance * this.options.directionBias;
    const downwardIntent = downwardDistance >= this.options.downwardActivationDistance
      && downwardDistance >= horizontalDistance * this.options.directionBias;

    if (horizontalIntent) {
      const direction: -1 | 1 = signedDeltaX < 0 ? -1 : 1;
      this.mode = "horizontal";
      this.horizontalAnchorX = this.currentX;
      return [{ type: "moveHorizontal", direction, steps: 1 }];
    }
    if (
      allowHardDrop
      && downwardIntent
      && downwardDistance >= this.options.hardDropDistance
      && this.elapsedMs <= this.options.hardDropMaxDurationMs
    ) {
      this.mode = "completed";
      return [{ type: "hardDrop" }];
    }
    return [];
  }

  private consumeHorizontalSteps(): GestureCommand[] {
    const delta = this.currentX - this.horizontalAnchorX;
    const steps = Math.trunc(Math.abs(delta) / this.options.horizontalStepDistance);
    if (steps === 0) {
      return [];
    }
    const direction: -1 | 1 = delta < 0 ? -1 : 1;
    this.horizontalAnchorX += direction * steps * this.options.horizontalStepDistance;
    return [{ type: "moveHorizontal", direction, steps }];
  }

  private isTap(): boolean {
    const deltaX = this.currentX - this.startX;
    const deltaY = this.currentY - this.startY;
    return Math.hypot(deltaX, deltaY) <= this.options.tapMaxDistance
      && this.elapsedMs <= this.options.tapMaxDurationMs;
  }

  private reset(): void {
    this.mode = "idle";
    this.elapsedMs = 0;
  }

  private validateOptions(): void {
    const positiveKeys: ReadonlyArray<keyof GestureRecognizerOptions> = [
      "tapMaxDistance",
      "tapMaxDurationMs",
      "horizontalActivationDistance",
      "horizontalStepDistance",
      "downwardActivationDistance",
      "softDropHoldMs",
      "hardDropDistance",
      "hardDropMaxDurationMs",
    ];
    for (const key of positiveKeys) {
      const value = this.options[key];
      if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`${key} must be a finite positive number`);
      }
    }
    if (!Number.isFinite(this.options.directionBias) || this.options.directionBias < 1) {
      throw new RangeError("directionBias must be a finite number greater than or equal to 1");
    }
    if (this.options.hardDropDistance < this.options.downwardActivationDistance) {
      throw new RangeError("hardDropDistance must not be less than downwardActivationDistance");
    }
  }

  private validatePoint(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new RangeError("gesture coordinates must be finite numbers");
    }
  }
}
