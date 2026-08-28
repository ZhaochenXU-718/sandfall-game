import type { ActivePieceState, PieceDefinition } from "../core/PieceTypes";
import type { ColorId } from "../core/types";

export interface PieceVisualAnimatorOptions {
  readonly moveDurationSeconds: number;
  readonly sandifyDurationSeconds: number;
}

export interface PieceVisualState {
  readonly definition: PieceDefinition;
  readonly rotation: number;
  readonly x: number;
  readonly y: number;
  readonly color: ColorId;
  readonly opacity: number;
  readonly mode: "active" | "sandifying";
}

/**
 * Smooths discrete deterministic piece coordinates for presentation only.
 * Core collision, locking, replay, and sand simulation remain grid based.
 */
export class PieceVisualAnimator {
  private readonly moveDurationSeconds: number;
  private readonly sandifyDurationSeconds: number;

  private hasActivePiece = false;
  private activeDefinition: PieceDefinition | undefined;
  private activeColor: ColorId = 0;
  private visualX = 0;
  private motionStartX = 0;
  private motionTargetX = 0;
  private motionElapsedSeconds = 0;

  private observedLockSequence = 0;
  private sandifyingPiece: ActivePieceState | undefined;
  private sandifyElapsedSeconds = 0;

  public constructor(options: PieceVisualAnimatorOptions) {
    for (const duration of [
      options.moveDurationSeconds,
      options.sandifyDurationSeconds,
    ]) {
      if (!Number.isFinite(duration) || duration < 0) {
        throw new RangeError("Piece animation durations must be non-negative finite numbers");
      }
    }
    this.moveDurationSeconds = options.moveDurationSeconds;
    this.sandifyDurationSeconds = options.sandifyDurationSeconds;
  }

  public reset(lockSequence = 0): void {
    this.hasActivePiece = false;
    this.activeDefinition = undefined;
    this.activeColor = 0;
    this.motionElapsedSeconds = 0;
    this.observedLockSequence = lockSequence;
    this.sandifyingPiece = undefined;
    this.sandifyElapsedSeconds = 0;
  }

  public update(
    deltaTimeSeconds: number,
    activePiece: ActivePieceState | undefined,
    lastLockedPiece: ActivePieceState | undefined,
    lockSequence: number,
    fallProgress = 0,
  ): PieceVisualState | undefined {
    if (!Number.isFinite(deltaTimeSeconds) || deltaTimeSeconds < 0) {
      throw new RangeError("Piece animation delta must be a non-negative finite number");
    }
    if (!Number.isFinite(fallProgress) || fallProgress < 0 || fallProgress > 1) {
      throw new RangeError("Piece fall progress must be between zero and one");
    }

    if (activePiece !== undefined) {
      this.sandifyingPiece = undefined;
      this.sandifyElapsedSeconds = 0;
      this.updateActiveMotion(deltaTimeSeconds, activePiece);
      return {
        definition: activePiece.definition,
        rotation: activePiece.rotation,
        x: this.visualX,
        y: activePiece.y + fallProgress,
        color: activePiece.color,
        opacity: 1,
        mode: "active",
      };
    }

    this.hasActivePiece = false;
    if (lockSequence !== this.observedLockSequence) {
      this.observedLockSequence = lockSequence;
      this.sandifyingPiece = lastLockedPiece;
      this.sandifyElapsedSeconds = 0;
    } else {
      this.sandifyElapsedSeconds += deltaTimeSeconds;
    }

    const piece = this.sandifyingPiece;
    if (piece === undefined || this.sandifyDurationSeconds === 0) {
      return undefined;
    }
    const progress = Math.min(1, this.sandifyElapsedSeconds / this.sandifyDurationSeconds);
    if (progress >= 1) {
      this.sandifyingPiece = undefined;
      return undefined;
    }
    return {
      definition: piece.definition,
      rotation: piece.rotation,
      x: piece.x,
      y: piece.y,
      color: piece.color,
      opacity: 1 - smoothStep(progress),
      mode: "sandifying",
    };
  }

  private updateActiveMotion(deltaTimeSeconds: number, piece: ActivePieceState): void {
    const samePiece = this.hasActivePiece
      && this.activeDefinition === piece.definition
      && this.activeColor === piece.color;
    if (!samePiece) {
      this.hasActivePiece = true;
      this.activeDefinition = piece.definition;
      this.activeColor = piece.color;
      this.visualX = piece.x;
      this.motionStartX = piece.x;
      this.motionTargetX = piece.x;
      this.motionElapsedSeconds = 0;
      return;
    }

    this.advanceMotion(deltaTimeSeconds);
    if (piece.x === this.motionTargetX) {
      return;
    }

    this.motionStartX = this.visualX;
    this.motionTargetX = piece.x;
    this.motionElapsedSeconds = 0;
    if (this.moveDurationSeconds === 0) {
      this.visualX = this.motionTargetX;
    }
  }

  private advanceMotion(deltaTimeSeconds: number): void {
    if (this.moveDurationSeconds === 0 || this.visualX === this.motionTargetX) {
      return;
    }
    this.motionElapsedSeconds = Math.min(
      this.moveDurationSeconds,
      this.motionElapsedSeconds + deltaTimeSeconds,
    );
    const progress = this.motionElapsedSeconds / this.moveDurationSeconds;
    const eased = smoothStep(progress);
    this.visualX = lerp(this.motionStartX, this.motionTargetX, eased);
  }
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function smoothStep(progress: number): number {
  return progress * progress * (3 - 2 * progress);
}
