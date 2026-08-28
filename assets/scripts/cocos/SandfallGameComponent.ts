import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  Graphics,
  input,
  Input,
  KeyCode,
  Node,
  profiler,
  ResolutionPolicy,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  view,
} from "cc";
import { FixedStepRunner } from "../application/FixedStepRunner";
import { GameSession } from "../application/GameSession";
import { DEFAULT_RULES, type RulesConfig } from "../core/RulesConfig";
import { PieceVisualAnimator } from "../rendering/PieceVisualAnimator";
import {
  DEFAULT_SAND_PALETTE,
  DEFAULT_SAND_TEXTURE_STRENGTH,
  SandPixelBuffer,
  clearFlashIntensity,
} from "../rendering/SandPixelBuffer";

const { ccclass, property } = _decorator;

/** Minimal Cocos Creator 3.8.8 prototype host for the deterministic game core. */
@ccclass("SandfallGameComponent")
export class SandfallGameComponent extends Component {
  @property(Sprite)
  public sandSprite: Sprite | null = null;

  @property(Graphics)
  public pieceGraphics: Graphics | null = null;

  @property({ min: 1, max: 5, step: 1, tooltip: "Number of playable sand colors" })
  public colorCount = DEFAULT_RULES.colorCount;

  @property({ min: 4, max: 16, step: 1, tooltip: "Sand grains along one block edge" })
  public grainsPerCell = DEFAULT_RULES.grainsPerCell;

  @property({ min: 0, max: 1000, step: 10, tooltip: "Delay before a grounded piece becomes sand" })
  public lockDelayMs = DEFAULT_RULES.lockDelayMs;

  @property({ min: 100, max: 1500, step: 50, tooltip: "Milliseconds for one row of normal falling" })
  public normalFallIntervalMs = DEFAULT_RULES.normalFallIntervalMs;

  @property({ min: 0, max: 1000, step: 10, tooltip: "Duration of the two-flash clear confirmation" })
  public clearEffectDurationMs = DEFAULT_RULES.clearEffectDurationMs;

  @property({ min: 0, max: 0.35, step: 0.01, tooltip: "Per-grain light and dark color variation" })
  public sandTextureStrength = DEFAULT_SAND_TEXTURE_STRENGTH;

  @property({ min: 0, max: 300, step: 10, tooltip: "Horizontal movement animation duration" })
  public moveAnimationMs = 90;

  @property({ min: 0, max: 500, step: 10, tooltip: "Solid block fade after becoming sand" })
  public sandifyAnimationMs = 180;

  private session!: GameSession;
  private runner!: FixedStepRunner;
  private rules!: Readonly<RulesConfig>;
  private pieceAnimator!: PieceVisualAnimator;
  private pixelBuffer!: SandPixelBuffer;
  private boardCells!: Uint8Array;
  private clearMaskCells!: Uint8Array;
  private texture: Texture2D | null = null;
  private spriteFrame: SpriteFrame | null = null;
  private readonly pressedKeys = new Set<KeyCode>();

  protected onLoad(): void {
    profiler.hideStats();
    view.setDesignResolutionSize(360, 800, ResolutionPolicy.FIXED_HEIGHT);
    this.ensureRenderers();

    if (this.colorCount >= DEFAULT_SAND_PALETTE.length) {
      throw new RangeError(`colorCount cannot exceed ${DEFAULT_SAND_PALETTE.length - 1}`);
    }
    this.rules = Object.freeze({
      ...DEFAULT_RULES,
      colorCount: this.colorCount,
      grainsPerCell: this.grainsPerCell,
      lockDelayMs: this.lockDelayMs,
      normalFallIntervalMs: this.normalFallIntervalMs,
      clearEffectDurationMs: this.clearEffectDurationMs,
    });
    this.session = new GameSession({ rules: this.rules });
    this.session.start(Date.now());
    this.runner = new FixedStepRunner({
      fixedHz: this.rules.fixedHz,
      maxFrameDeltaSeconds: 0.25,
      maxStepsPerFrame: 5,
    }, (fixedDelta) => this.session.tick(fixedDelta));
    this.pieceAnimator = new PieceVisualAnimator({
      moveDurationSeconds: this.moveAnimationMs / 1000,
      sandifyDurationSeconds: this.sandifyAnimationMs / 1000,
    });
    this.boardCells = new Uint8Array(this.session.boardWidth * this.session.boardHeight);
    this.clearMaskCells = new Uint8Array(this.boardCells.length);
    this.pixelBuffer = new SandPixelBuffer({
      width: this.session.boardWidth,
      height: this.session.boardHeight,
      // SpriteFrame already handles the graphics API's texture orientation.
      flipY: false,
      shadeStrength: this.sandTextureStrength,
    });
    this.createTexture();
    this.renderFrame(0);
  }

  private ensureRenderers(): void {
    if (this.sandSprite !== null && this.pieceGraphics !== null) {
      return;
    }

    const boardNode = new Node("SandBoard");
    boardNode.layer = this.node.layer;
    this.node.addChild(boardNode);

    const transform = boardNode.addComponent(UITransform);
    transform.setContentSize(300, 720);

    const sprite = boardNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.sandSprite = sprite;

    // A Cocos node may only own one renderable component. Keep the dynamic
    // texture and the active-piece overlay on separate, aligned nodes.
    const pieceNode = new Node("ActivePiece");
    pieceNode.layer = boardNode.layer;
    boardNode.addChild(pieceNode);
    pieceNode.addComponent(UITransform).setContentSize(300, 720);
    this.pieceGraphics = pieceNode.addComponent(Graphics);
  }

  protected onEnable(): void {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  protected onDisable(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    this.pressedKeys.clear();
    if (this.session !== undefined) {
      this.session.setSoftDrop(false);
    }
  }

  protected update(deltaTime: number): void {
    // Avoid cascading frame errors if a future initialization failure occurs.
    if (this.session === undefined || this.runner === undefined) {
      return;
    }
    if (this.session.phase === "Paused") {
      return;
    }
    const frame = this.runner.advance(deltaTime);
    this.renderFrame(deltaTime, frame.interpolationAlpha * this.runner.fixedDelta);
  }

  protected onDestroy(): void {
    this.spriteFrame?.destroy();
    this.texture?.destroy();
    this.spriteFrame = null;
    this.texture = null;
  }

  private createTexture(): void {
    if (this.sandSprite === null) {
      return;
    }
    const texture = new Texture2D();
    texture.reset({
      width: this.session.boardWidth,
      height: this.session.boardHeight,
      format: Texture2D.PixelFormat.RGBA8888,
    });
    texture.setFilters(Texture2D.Filter.NEAREST, Texture2D.Filter.NEAREST);
    texture.uploadData(this.pixelBuffer.pixels);

    const spriteFrame = new SpriteFrame();
    spriteFrame.texture = texture;
    this.sandSprite.spriteFrame = spriteFrame;
    this.texture = texture;
    this.spriteFrame = spriteFrame;
  }

  private renderFrame(deltaTime: number, renderAheadSeconds = 0): void {
    this.session.copyBoardTo(this.boardCells);
    const hasClearEffect = this.session.copyClearMaskTo(this.clearMaskCells);
    const flashIntensity = hasClearEffect
      ? clearFlashIntensity(this.session.getClearProgress(renderAheadSeconds))
      : 0;
    const update = this.pixelBuffer.update(
      this.boardCells,
      hasClearEffect ? this.clearMaskCells : undefined,
      flashIntensity,
    );
    if (update.changedCount > 0) {
      this.texture?.uploadData(this.pixelBuffer.pixels);
    }
    this.renderActivePiece(deltaTime, renderAheadSeconds);
  }

  private renderActivePiece(deltaTime: number, renderAheadSeconds: number): void {
    const graphics = this.pieceGraphics;
    const sprite = this.sandSprite;
    if (graphics === null || sprite === null) {
      return;
    }
    graphics.clear();
    const piece = this.pieceAnimator.update(
      deltaTime,
      this.session.activePiece,
      this.session.lastLockedPiece,
      this.session.lockSequence,
      this.session.getFallProgress(renderAheadSeconds),
    );
    if (piece === undefined) {
      return;
    }
    const transform = sprite.node.getComponent(UITransform);
    const rotation = piece.definition.rotations[piece.rotation];
    const color = DEFAULT_SAND_PALETTE[piece.color];
    if (transform === null || rotation === undefined || color === undefined) {
      throw new Error("Active piece rendering configuration is invalid");
    }

    const cellWidth = transform.contentSize.width / this.rules.macroWidth;
    const cellHeight = transform.contentSize.height / this.rules.macroHeight;
    const left = -transform.contentSize.width * transform.anchorX;
    const top = transform.contentSize.height * (1 - transform.anchorY);
    graphics.fillColor = new Color(
      color.r,
      color.g,
      color.b,
      Math.round(color.a * piece.opacity),
    );
    for (const cell of rotation) {
      const macroX = piece.x + cell.x;
      const macroY = piece.y + cell.y;
      graphics.rect(
        left + macroX * cellWidth,
        top - (macroY + 1) * cellHeight,
        cellWidth,
        cellHeight,
      );
    }
    graphics.fill();
  }

  private onKeyDown(event: EventKeyboard): void {
    const code = event.keyCode;
    if (this.pressedKeys.has(code)) {
      return;
    }
    this.pressedKeys.add(code);

    switch (code) {
      case KeyCode.ARROW_LEFT:
      case KeyCode.KEY_A:
        this.session.moveLeft();
        break;
      case KeyCode.ARROW_RIGHT:
      case KeyCode.KEY_D:
        this.session.moveRight();
        break;
      case KeyCode.ARROW_DOWN:
      case KeyCode.KEY_S:
        this.session.setSoftDrop(true);
        break;
      case KeyCode.ARROW_UP:
      case KeyCode.KEY_X:
        this.session.rotateCW();
        break;
      case KeyCode.KEY_Z:
        this.session.rotateCCW();
        break;
      case KeyCode.SPACE:
        this.session.hardDrop();
        break;
      case KeyCode.KEY_P:
        this.togglePause();
        break;
      case KeyCode.KEY_R:
        this.session.start(Date.now());
        this.runner.reset();
        this.pieceAnimator.reset(this.session.lockSequence);
        break;
      default:
        break;
    }
    this.renderFrame(0);
  }

  private onKeyUp(event: EventKeyboard): void {
    this.pressedKeys.delete(event.keyCode);
    if (event.keyCode === KeyCode.ARROW_DOWN || event.keyCode === KeyCode.KEY_S) {
      this.session.setSoftDrop(false);
    }
  }

  private togglePause(): void {
    if (this.session.phase === "Paused") {
      this.session.resume();
    } else if (this.session.pause()) {
      this.runner.reset();
    }
  }
}
