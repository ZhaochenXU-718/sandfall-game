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
import { sandBoardSize } from "../core/RulesConfig";
import { SandSimulation } from "../core/SandSimulation";
import { StableDetector } from "../core/StableDetector";
import type { ConnectivityResult } from "../core/types";
import { GameStateMachine, type GamePhase } from "./GameStateMachine";

export interface GameSessionOptions {
  readonly rules: RulesConfig;
  readonly pieces?: readonly PieceDefinition[];
}

export class GameSession {
  private readonly rules: RulesConfig;
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
  private currentSeed = 0;
  private currentTick = 0;
  private currentChain = 0;
  private fallAccumulatorMs = 0;
  private softDropActive = false;

  public constructor(options: GameSessionOptions) {
    this.validateRules(options.rules);
    if (options.pieces !== undefined && options.pieces.length === 0) {
      throw new Error("GameSession requires at least one piece definition");
    }
    this.rules = Object.freeze({ ...options.rules });
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

  public get activePiece(): ActivePieceState | undefined {
    return this.currentPiece?.getState();
  }

  public get nextPiece(): NextPiece | undefined {
    return this.upcomingPiece;
  }

  public get boardWidth(): number {
    return this.board.width;
  }

  public get boardHeight(): number {
    return this.board.height;
  }

  public start(seed = Date.now()): void {
    if (!Number.isFinite(seed)) {
      throw new RangeError("Game seed must be finite");
    }
    this.currentSeed = seed >>> 0;
    this.currentTick = 0;
    this.currentChain = 0;
    this.fallAccumulatorMs = 0;
    this.softDropActive = false;
    this.currentPiece = undefined;
    this.pendingClear = undefined;

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
      this.rules.colorCount,
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
      this.softDropActive = active;
      this.fallAccumulatorMs = 0;
    }
  }

  public hardDrop(): number {
    if (!this.acceptsPieceCommands() || this.currentPiece === undefined) {
      return 0;
    }
    const distance = this.currentPiece.hardDrop();
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
        this.tickClearing();
        break;
      default:
        break;
    }
  }

  public getBoardSnapshot(): Uint8Array {
    return this.board.snapshot();
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

    const interval = this.softDropActive
      ? this.rules.softDropIntervalMs
      : this.rules.normalFallIntervalMs;
    this.fallAccumulatorMs += deltaMs;
    while (this.fallAccumulatorMs + 1e-9 >= interval) {
      this.fallAccumulatorMs -= interval;
      if (!piece.softDrop() || piece.isGrounded) {
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
    const written = this.rasterizer.rasterize(piece.getState());
    if (written === 0) {
      throw new Error("Active piece failed atomic rasterization");
    }
    this.currentPiece = undefined;
    this.softDropActive = false;
    this.fallAccumulatorMs = 0;
    this.stableDetector.reset();
    this.stateMachine.transition("Resolving");
  }

  private tickResolving(): void {
    const step = this.sandSimulation.step();
    this.stableDetector.update(step.movedCount);
    if (!this.stableDetector.isStable) {
      return;
    }

    const connectivity = this.connectivity.resolve();
    if (connectivity.markedCellCount > 0) {
      this.pendingClear = connectivity;
      this.stateMachine.transition("Clearing");
      return;
    }

    this.currentChain = 0;
    this.stateMachine.transition("Spawning");
  }

  private tickClearing(): void {
    const result = this.pendingClear;
    if (result === undefined) {
      throw new Error("Clearing state is missing its marked component result");
    }
    const cleared = this.board.clearMarked(result.removalMask);
    if (cleared !== result.markedCellCount || cleared === 0) {
      throw new Error("Clearing state has no valid spanning component");
    }
    this.currentChain += 1;
    this.pendingClear = undefined;
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
      connectivity: new ConnectivityResolver(board),
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
    if (!Number.isInteger(rules.maxLockResets) || rules.maxLockResets < 0) {
      throw new RangeError("maxLockResets must be a non-negative integer");
    }
  }
}
