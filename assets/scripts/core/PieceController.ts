import { CollisionService } from "./CollisionService";
import type { ActivePieceState, PieceDefinition } from "./PieceTypes";
import type { ColorId } from "./types";

export interface PieceControllerOptions {
  readonly lockDelayMs: number;
  readonly maxLockResets: number;
}

export class PieceController {
  public readonly definition: PieceDefinition;
  public readonly color: ColorId;

  private readonly collision: CollisionService;
  private readonly lockDelayMs: number;
  private readonly maxLockResets: number;
  private currentX: number;
  private currentY: number;
  private currentRotation: number;
  private currentLockElapsedMs = 0;
  private currentLockResets = 0;
  private currentLockReady = false;

  public constructor(
    definition: PieceDefinition,
    color: ColorId,
    x: number,
    y: number,
    collision: CollisionService,
    options: PieceControllerOptions,
    rotation = 0,
  ) {
    if (!Number.isInteger(color) || color <= 0 || color > 255) {
      throw new RangeError("An active piece color must be between 1 and 255");
    }
    if (!Number.isFinite(options.lockDelayMs) || options.lockDelayMs < 0) {
      throw new RangeError("lockDelayMs must be non-negative");
    }
    if (!Number.isInteger(options.maxLockResets) || options.maxLockResets < 0) {
      throw new RangeError("maxLockResets must be a non-negative integer");
    }
    if (!collision.canPlace(definition, rotation, x, y)) {
      throw new Error(`Cannot spawn piece ${definition.id} at (${x}, ${y})`);
    }

    this.definition = definition;
    this.color = color;
    this.currentX = x;
    this.currentY = y;
    this.currentRotation = rotation;
    this.collision = collision;
    this.lockDelayMs = options.lockDelayMs;
    this.maxLockResets = options.maxLockResets;
  }

  public get x(): number {
    return this.currentX;
  }

  public get y(): number {
    return this.currentY;
  }

  public get rotation(): number {
    return this.currentRotation;
  }

  public get lockElapsedMs(): number {
    return this.currentLockElapsedMs;
  }

  public get lockResets(): number {
    return this.currentLockResets;
  }

  public get isLockReady(): boolean {
    return this.currentLockReady;
  }

  public get isGrounded(): boolean {
    return !this.collision.canPlace(
      this.definition,
      this.currentRotation,
      this.currentX,
      this.currentY + 1,
    );
  }

  public moveLeft(): boolean {
    return this.tryMove(-1, 0);
  }

  public moveRight(): boolean {
    return this.tryMove(1, 0);
  }

  public softDrop(): boolean {
    const moved = this.tryMove(0, 1);
    if (moved) {
      this.resetActiveLockDelay();
    }
    return moved;
  }

  public rotateCW(): boolean {
    return this.tryRotate(1);
  }

  public rotateCCW(): boolean {
    return this.tryRotate(-1);
  }

  public hardDrop(): number {
    if (this.currentLockReady) {
      return 0;
    }
    let distance = 0;
    while (this.collision.canPlace(
      this.definition,
      this.currentRotation,
      this.currentX,
      this.currentY + distance + 1,
    )) {
      distance += 1;
    }
    this.currentY += distance;
    this.currentLockElapsedMs = this.lockDelayMs;
    this.currentLockReady = true;
    return distance;
  }

  /** Advances only the lock timer; natural falling cadence belongs to GameSession. */
  public updateLock(deltaMs: number): boolean {
    if (!Number.isFinite(deltaMs) || deltaMs < 0) {
      throw new RangeError("Lock delta must be a non-negative finite number");
    }
    if (this.currentLockReady) {
      return true;
    }
    if (!this.isGrounded) {
      this.currentLockElapsedMs = 0;
      return false;
    }

    this.currentLockElapsedMs = Math.min(
      this.lockDelayMs,
      this.currentLockElapsedMs + deltaMs,
    );
    this.currentLockReady = this.currentLockElapsedMs >= this.lockDelayMs;
    return this.currentLockReady;
  }

  public getState(): ActivePieceState {
    return {
      definition: this.definition,
      rotation: this.currentRotation,
      x: this.currentX,
      y: this.currentY,
      color: this.color,
      lockElapsedMs: this.currentLockElapsedMs,
      lockResets: this.currentLockResets,
      lockReady: this.currentLockReady,
    };
  }

  private tryMove(deltaX: number, deltaY: number): boolean {
    if (this.currentLockReady) {
      return false;
    }
    const targetX = this.currentX + deltaX;
    const targetY = this.currentY + deltaY;
    if (!this.collision.canPlace(
      this.definition,
      this.currentRotation,
      targetX,
      targetY,
    )) {
      return false;
    }
    this.currentX = targetX;
    this.currentY = targetY;
    return true;
  }

  private tryRotate(direction: -1 | 1): boolean {
    if (this.currentLockReady || this.definition.rotations.length <= 1) {
      return false;
    }
    const rotationCount = this.definition.rotations.length;
    const targetRotation = (this.currentRotation + direction + rotationCount) % rotationCount;
    if (!this.collision.canPlace(
      this.definition,
      targetRotation,
      this.currentX,
      this.currentY,
    )) {
      return false;
    }
    this.currentRotation = targetRotation;
    this.resetActiveLockDelay();
    return true;
  }

  private resetActiveLockDelay(): void {
    if (this.currentLockElapsedMs <= 0 || this.currentLockResets >= this.maxLockResets) {
      return;
    }
    this.currentLockElapsedMs = 0;
    this.currentLockResets += 1;
  }
}
