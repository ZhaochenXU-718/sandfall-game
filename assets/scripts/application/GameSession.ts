import { Board } from "../core/Board";
import { CollisionService } from "../core/CollisionService";
import { ConnectivityResolver } from "../core/ConnectivityResolver";
import { PieceController } from "../core/PieceController";
import { TETROMINOES } from "../core/PieceDefinitions";
import { PieceRandomizer, type NextPiece } from "../core/PieceRandomizer";
import { PieceRasterizer } from "../core/PieceRasterizer";
import type { ActivePieceState, PieceDefinition } from "../core/PieceTypes";
import { Randomizer } from "../core/Randomizer";
import type { RulesConfig } from "../core/RulesConfig";
import {
  colorCountForLevel,
  levelForClearCount,
  normalFallIntervalForLevel,
  sandBoardSize,
} from "../core/RulesConfig";
import type { GameMode } from "../core/RulesConfig";
import { SandSimulation } from "../core/SandSimulation";
import { StableDetector } from "../core/StableDetector";
import type { ConnectivityResult } from "../core/types";
import { GameStateMachine, type GamePhase } from "./GameStateMachine";

export interface GameSessionOptions {
  readonly rules: RulesConfig;
  readonly pieces?: readonly PieceDefinition[];
  readonly mode?: GameMode;
}

export class GameSession {
  private readonly rules: RulesConfig;
  private readonly gameMode: GameMode;
  private readonly definitions: readonly PieceDefinition[];
  private readonly stateMachine = new GameStateMachine();

  private board: Board;
  private collision: CollisionService;
  private rasterizer: PieceRasterizer;
  private sandSimulation: SandSimulation;
  private connectivity: ConnectivityResolver;
  private stableDetector: StableDetector;
  private pieceRandomizer: PieceRandomizer | undefined;
  private currentPiece: PieceController | undefined;
  private upcomingPiece: NextPiece | undefined;
  private pendingClear: ConnectivityResult | undefined;
  private mostRecentLockedPiece: ActivePieceState | undefined;
  private completedLockCount = 0;
  private currentSeed = 0;
  private currentTick = 0;
  private currentChain = 0;
  private currentScore = 0;
  private completedClearCount = 0;
  private highestChain = 0;
  private fallAccumulatorMs = 0;
  private clearElapsedMs = 0;
  private softDropActive = false;

  public constructor(options: GameSessionOptions) {
    this.validateRules(options.rules);
    if (options.pieces !== undefined && options.pieces.length === 0) {
      throw new Error("GameSession requires at least one piece definition");
    }
    this.rules = Object.freeze({ ...options.rules });
    this.gameMode = options.mode ?? "progressive";
    this.definitions = Object.freeze([...(options.pieces ?? TETROMINOES)]);

    const modules = this.createBoardModules(0);
    this.board = modules.board;
    this.collision = modules.collision;
    this.rasterizer = modules.rasterizer;
    this.sandSimulation = modules.sandSimulation;
    this.connectivity = modules.connectivity;
    this.stableDetector = modules.stableDetector;
  }

  public get phase(): GamePhase {
    return this.stateMachine.phase;
  }

  public get seed(): number {
    return this.currentSeed;
  }

  public get simulationTick(): number {
    return this.currentTick;
  }

  public get chainLevel(): number {
    return this.currentChain;
  }

  public get score(): number {
    return this.currentScore;
  }

  public get clearCount(): number {
    return this.completedClearCount;
  }

  public get level(): number {
    return levelForClearCount(this.completedClearCount, this.gameMode);
  }

  public get normalFallIntervalMilliseconds(): number {
    return normalFallIntervalForLevel(
      this.rules.normalFallIntervalMs,
      this.level,
      this.gameMode,
    );
  }

  public get activeColorCount(): number {
    return colorCountForLevel(this.rules.colorCount, this.level, this.gameMode);
  }

  public get mode(): GameMode {
    return this.gameMode;
  }

  public get maxChain(): number {
    return this.highestChain;
  }

  /** Active play time derived from deterministic simulation ticks. */
  public get elapsedMilliseconds(): number {
    return this.currentTick * 1000 / this.rules.fixedHz;
  }

  public get activePiece(): ActivePieceState | undefined {
    return this.currentPiece?.getState();
  }

  public get nextPiece(): NextPiece | undefined {
    return this.upcomingPiece;
  }

  /** Last piece placement committed to the sand board, for visual transitions only. */
  public get lastLockedPiece(): ActivePieceState | undefined {
    return this.mostRecentLockedPiece;
  }

  /** Monotonic sequence used by renderers to detect a new lock event. */
  public get lockSequence(): number {
    return this.completedLockCount;
  }

  /**
   * Fractional progress toward the next logical row. Renderers may provide the
   * fixed-step runner's unsimulated remainder so motion stays smooth even when
   * the display refresh rate is higher than the simulation frequency.
   */
  public getFallProgress(renderAheadSeconds = 0): number {
    if (!Number.isFinite(renderAheadSeconds) || renderAheadSeconds < 0) {
      throw new RangeError("Render-ahead time must be a non-negative finite number");
    }
    const piece = this.currentPiece;
    if (piece === undefined || this.phase !== "Falling" || piece.isGrounded) {
      return 0;
    }
    const interval = this.currentFallIntervalMs();
    return Math.min(1, (this.fallAccumulatorMs + renderAheadSeconds * 1000) / interval);
  }

  /** Progress of the pending clear confirmation effect, from zero to one. */
  public getClearProgress(renderAheadSeconds = 0): number {
    if (!Number.isFinite(renderAheadSeconds) || renderAheadSeconds < 0) {
      throw new RangeError("Render-ahead time must be a non-negative finite number");
    }
    if (this.phase !== "Clearing" || this.pendingClear === undefined) {
      return 0;
    }
    if (this.rules.clearEffectDurationMs === 0) {
      return 1;
    }
    return Math.min(
      1,
      (this.clearElapsedMs + renderAheadSeconds * 1000) / this.rules.clearEffectDurationMs,
    );
  }

  public get boardWidth(): number {
    return this.board.width;
  }

  public get boardHeight(): number {
    return this.board.height;
  }

  /** Changes whenever the rendered sand board contents change. */
  public get boardRevision(): number {
    return this.board.revision;
  }

  public start(seed = Date.now()): void {
    if (!Number.isFinite(seed)) {
      throw new RangeError("Game seed must be finite");
    }
    this.currentSeed = seed >>> 0;
    this.currentTick = 0;
    this.currentChain = 0;
    this.currentScore = 0;
    this.completedClearCount = 0;
    this.highestChain = 0;
    this.fallAccumulatorMs = 0;
    this.clearElapsedMs = 0;
    this.softDropActive = false;
    this.currentPiece = undefined;
    this.pendingClear = undefined;
    this.mostRecentLockedPiece = undefined;
    this.completedLockCount = 0;

    const modules = this.createBoardModules(this.currentSeed);
    this.board = modules.board;
    this.collision = modules.collision;
    this.rasterizer = modules.rasterizer;
    this.sandSimulation = modules.sandSimulation;
    this.connectivity = modules.connectivity;
    this.stableDetector = modules.stableDetector;
    this.pieceRandomizer = new PieceRandomizer(
      this.currentSeed,
      this.definitions,
      this.activeColorCount,
    );
    this.upcomingPiece = this.pieceRandomizer.next();
    this.stateMachine.start();
  }

  public pause(): boolean {
    const paused = this.stateMachine.pause();
    if (paused) {
      this.softDropActive = false;
    }
    return paused;
  }

  public resume(): boolean {
    return this.stateMachine.resume();
  }

  public moveLeft(): boolean {
    return this.moveHorizontally(-1);
  }

  public moveRight(): boolean {
    return this.moveHorizontally(1);
  }

  public rotateCW(): boolean {
    return this.rotate("cw");
  }

  public rotateCCW(): boolean {
    return this.rotate("ccw");
  }

  public setSoftDrop(active: boolean): void {
    if (!this.acceptsPieceCommands()) {
      return;
    }
    if (this.softDropActive !== active) {
      const previousInterval = this.currentFallIntervalMs();
      const progress = this.fallAccumulatorMs / previousInterval;
      this.softDropActive = active;
      this.fallAccumulatorMs = progress * this.currentFallIntervalMs();
    }
  }

  public hardDrop(): number {
    if (!this.acceptsPieceCommands() || this.currentPiece === undefined) {
      return 0;
    }
    const distance = this.currentPiece.hardDrop();
    this.currentScore += distance * this.rules.hardDropPointsPerRow;
    this.lockActivePiece();
    return distance;
  }

  public tick(fixedDelta: number): void {
    const expectedDelta = 1 / this.rules.fixedHz;
    if (!Number.isFinite(fixedDelta) || Math.abs(fixedDelta - expectedDelta) > 1e-9) {
      throw new RangeError(`GameSession.tick requires the fixed step ${expectedDelta}`);
    }
    if (this.phase === "Idle" || this.phase === "Paused" || this.phase === "GameOver") {
      return;
    }

    this.currentTick += 1;
    const deltaMs = 1000 / this.rules.fixedHz;
    switch (this.phase) {
      case "Spawning":
        this.spawnNextPiece();
        break;
      case "Falling":
        this.tickFalling(deltaMs);
        break;
      case "LockDelay":
        this.tickLockDelay(deltaMs);
        break;
      case "Resolving":
        this.tickResolving();
        break;
      case "Clearing":
        this.tickClearing(deltaMs);
        break;
      default:
        break;
    }
  }

  public getBoardSnapshot(): Uint8Array {
    return this.board.snapshot();
  }

  public copyBoardTo(target: Uint8Array): void {
    this.board.copyTo(target);
  }

  public copyGrainVariantsTo(target: Uint8Array): void {
    this.board.copyGrainVariantsTo(target);
  }

  /** Copies the component selected for clearing; returns false outside the clear effect. */
  public copyClearMaskTo(target: Uint8Array): boolean {
    if (target.length !== this.board.width * this.board.height) {
      throw new RangeError(`Expected a target of length ${this.board.width * this.board.height}`);
    }
    const result = this.pendingClear;
    if (this.phase !== "Clearing" || result === undefined) {
      target.fill(0);
      return false;
    }
    target.set(result.removalMask);
    return true;
  }

  private spawnNextPiece(): void {
    const candidate = this.upcomingPiece;
    const randomizer = this.pieceRandomizer;
    if (candidate === undefined || randomizer === undefined) {
      throw new Error("GameSession must be started before spawning");
    }

    const rotation = candidate.definition.rotations[0];
    if (rotation === undefined || rotation.length === 0) {
      throw new Error(`Piece ${candidate.definition.id} has no spawn rotation`);
    }
    let minX = rotation[0]?.x ?? 0;
    let maxX = minX;
    let minY = rotation[0]?.y ?? 0;
    for (const cell of rotation) {
      minX = Math.min(minX, cell.x);
      maxX = Math.max(maxX, cell.x);
      minY = Math.min(minY, cell.y);
    }
    const pieceWidth = maxX - minX + 1;
    const spawnX = Math.floor((this.collision.macroWidth - pieceWidth) / 2) - minX;
    const spawnY = minY === 0 ? 0 : -minY;

    if (!this.collision.canPlace(candidate.definition, 0, spawnX, spawnY)) {
      this.currentPiece = undefined;
      this.stateMachine.transition("GameOver");
      return;
    }

    this.currentPiece = new PieceController(
      candidate.definition,
      candidate.color,
      spawnX,
      spawnY,
      this.collision,
      {
        lockDelayMs: this.rules.lockDelayMs,
        maxLockResets: this.rules.maxLockResets,
      },
    );
    this.upcomingPiece = randomizer.next();
    this.fallAccumulatorMs = 0;
    this.stateMachine.transition("Falling");
  }

  private tickFalling(deltaMs: number): void {
    const piece = this.requireActivePiece();
    if (piece.isGrounded) {
      this.fallAccumulatorMs = 0;
      this.stateMachine.transition("LockDelay");
      this.tickLockDelay(deltaMs);
      return;
    }

    const interval = this.currentFallIntervalMs();
    this.fallAccumulatorMs += deltaMs;
    while (this.fallAccumulatorMs + 1e-9 >= interval) {
      this.fallAccumulatorMs -= interval;
      const moved = piece.softDrop();
      if (moved && this.softDropActive) {
        this.currentScore += this.rules.softDropPointsPerRow;
      }
      if (!moved || piece.isGrounded) {
        this.fallAccumulatorMs = 0;
        this.stateMachine.transition("LockDelay");
        if (this.rules.lockDelayMs === 0) {
          this.tickLockDelay(0);
        }
        return;
      }
    }
  }

  private tickLockDelay(deltaMs: number): void {
    const piece = this.requireActivePiece();
    if (!piece.isGrounded) {
      piece.updateLock(0);
      this.stateMachine.transition("Falling");
      return;
    }
    if (piece.updateLock(deltaMs)) {
      this.lockActivePiece();
    }
  }

  private lockActivePiece(): void {
    const piece = this.requireActivePiece();
    const lockedState = piece.getState();
    const written = this.rasterizer.rasterize(lockedState);
    if (written === 0) {
      throw new Error("Active piece failed atomic rasterization");
    }
    this.currentPiece = undefined;
    this.mostRecentLockedPiece = lockedState;
    this.completedLockCount += 1;
    this.softDropActive = false;
    this.fallAccumulatorMs = 0;
    this.stableDetector.reset();
    this.stateMachine.transition("Resolving");
  }

  private tickResolving(): void {
    let movedCount = 0;
    for (let substep = 0; substep < this.rules.sandSubsteps; substep += 1) {
      const step = this.sandSimulation.step();
      movedCount += step.movedCount;
      if (step.movedCount === 0) {
        break;
      }
    }
    this.stableDetector.update(movedCount);
    if (!this.stableDetector.isStable) {
      return;
    }

    const connectivity = this.connectivity.resolve();
    if (connectivity.markedCellCount > 0) {
      this.pendingClear = connectivity;
      this.clearElapsedMs = 0;
      this.stateMachine.transition("Clearing");
      return;
    }

    this.currentChain = 0;
    this.stateMachine.transition("Spawning");
  }

  private tickClearing(deltaMs: number): void {
    const result = this.pendingClear;
    if (result === undefined) {
      throw new Error("Clearing state is missing its marked component result");
    }
    this.clearElapsedMs = Math.min(
      this.rules.clearEffectDurationMs,
      this.clearElapsedMs + deltaMs,
    );
    if (this.clearElapsedMs + 1e-9 < this.rules.clearEffectDurationMs) {
      return;
    }
    const cleared = this.board.clearMarked(result.removalMask);
    if (cleared !== result.markedCellCount || cleared === 0) {
      throw new Error("Clearing state has no valid spanning component");
    }
    this.currentChain += 1;
    const clearBase = cleared
      + result.clearedComponentCount * this.rules.clearedComponentBonus;
    const multiplier = 1 + (this.currentChain - 1) * this.rules.chainMultiplierStep;
    this.currentScore += Math.round(clearBase * multiplier);
    this.completedClearCount += result.clearedComponentCount;
    this.pieceRandomizer?.setColorCount(this.activeColorCount);
    this.highestChain = Math.max(this.highestChain, this.currentChain);
    this.pendingClear = undefined;
    this.clearElapsedMs = 0;
    this.stableDetector.reset();
    this.stateMachine.transition("Resolving");
  }

  private moveHorizontally(direction: -1 | 1): boolean {
    if (!this.acceptsPieceCommands() || this.currentPiece === undefined) {
      return false;
    }
    const moved = direction === -1
      ? this.currentPiece.moveLeft()
      : this.currentPiece.moveRight();
    if (moved) {
      this.syncPhaseAfterPieceCommand();
    }
    return moved;
  }

  private rotate(direction: "cw" | "ccw"): boolean {
    if (!this.acceptsPieceCommands() || this.currentPiece === undefined) {
      return false;
    }
    const rotated = direction === "cw"
      ? this.currentPiece.rotateCW()
      : this.currentPiece.rotateCCW();
    if (rotated) {
      this.syncPhaseAfterPieceCommand();
    }
    return rotated;
  }

  private syncPhaseAfterPieceCommand(): void {
    const piece = this.requireActivePiece();
    if (this.phase === "LockDelay" && !piece.isGrounded) {
      piece.updateLock(0);
      this.stateMachine.transition("Falling");
    } else if (this.phase === "Falling" && piece.isGrounded) {
      this.fallAccumulatorMs = 0;
      this.stateMachine.transition("LockDelay");
    }
  }

  private acceptsPieceCommands(): boolean {
    return this.phase === "Falling" || this.phase === "LockDelay";
  }

  private currentFallIntervalMs(): number {
    return this.softDropActive
      ? Math.min(this.rules.softDropIntervalMs, this.normalFallIntervalMilliseconds)
      : this.normalFallIntervalMilliseconds;
  }

  private requireActivePiece(): PieceController {
    if (this.currentPiece === undefined) {
      throw new Error(`Game phase ${this.phase} requires an active piece`);
    }
    return this.currentPiece;
  }

  private createBoardModules(seed: number): {
    board: Board;
    collision: CollisionService;
    rasterizer: PieceRasterizer;
    sandSimulation: SandSimulation;
    connectivity: ConnectivityResolver;
    stableDetector: StableDetector;
  } {
    const size = sandBoardSize(this.rules);
    const board = new Board(size.width, size.height);
    const collision = new CollisionService(board, this.rules.grainsPerCell);
    return {
      board,
      collision,
      rasterizer: new PieceRasterizer(board, collision),
      sandSimulation: new SandSimulation(board, new Randomizer(seed ^ 0xa511e9b3)),
      connectivity: new ConnectivityResolver(board, this.rules.minBlobGrains),
      stableDetector: new StableDetector(this.rules.stableTicks),
    };
  }

  private validateRules(rules: RulesConfig): void {
    const positiveIntegers = [
      rules.macroWidth,
      rules.macroHeight,
      rules.grainsPerCell,
      rules.colorCount,
      rules.fixedHz,
      rules.stableTicks,
      rules.sandSubsteps,
      rules.minBlobGrains,
    ];
    if (positiveIntegers.some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new RangeError("Board, color, frequency, and stability rules must be positive integers");
    }
    if (rules.colorCount > 255) {
      throw new RangeError("colorCount cannot exceed Uint8 color capacity");
    }
    if (!Number.isFinite(rules.normalFallIntervalMs) || rules.normalFallIntervalMs <= 0) {
      throw new RangeError("normalFallIntervalMs must be positive");
    }
    if (!Number.isFinite(rules.softDropIntervalMs) || rules.softDropIntervalMs <= 0) {
      throw new RangeError("softDropIntervalMs must be positive");
    }
    if (rules.softDropIntervalMs > rules.normalFallIntervalMs) {
      throw new RangeError("Soft drop cannot be slower than normal falling");
    }
    if (!Number.isFinite(rules.lockDelayMs) || rules.lockDelayMs < 0) {
      throw new RangeError("lockDelayMs must be non-negative");
    }
    if (!Number.isFinite(rules.clearEffectDurationMs) || rules.clearEffectDurationMs < 0) {
      throw new RangeError("clearEffectDurationMs must be non-negative");
    }
    if (!Number.isInteger(rules.maxLockResets) || rules.maxLockResets < 0) {
      throw new RangeError("maxLockResets must be a non-negative integer");
    }
    if (!Number.isInteger(rules.hardDropPointsPerRow) || rules.hardDropPointsPerRow < 0) {
      throw new RangeError("hardDropPointsPerRow must be a non-negative integer");
    }
    if (!Number.isInteger(rules.softDropPointsPerRow) || rules.softDropPointsPerRow < 0) {
      throw new RangeError("softDropPointsPerRow must be a non-negative integer");
    }
    if (!Number.isInteger(rules.clearedComponentBonus) || rules.clearedComponentBonus < 0) {
      throw new RangeError("clearedComponentBonus must be a non-negative integer");
    }
    if (!Number.isFinite(rules.chainMultiplierStep) || rules.chainMultiplierStep < 0) {
      throw new RangeError("chainMultiplierStep must be non-negative");
    }
  }
}
