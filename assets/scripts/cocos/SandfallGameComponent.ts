import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  Graphics,
  HorizontalTextAlignment,
  input,
  Input,
  KeyCode,
  Label,
  Node,
  profiler,
  ResolutionPolicy,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  VerticalTextAlignment,
  view,
} from "cc";
import { FixedStepRunner } from "../application/FixedStepRunner";
import { GameSession } from "../application/GameSession";
import { InputAutoRepeat } from "../application/InputAutoRepeat";
import { DEFAULT_RULES, type RulesConfig } from "../core/RulesConfig";
import { layoutPiecePreview } from "../rendering/PiecePreviewLayout";
import { PieceVisualAnimator } from "../rendering/PieceVisualAnimator";
import { sandifyGrainVisible } from "../rendering/SandifyDissolve";
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

  @property(Graphics)
  public nextPieceGraphics: Graphics | null = null;

  @property({ min: 1, max: 5, step: 1, tooltip: "Number of playable sand colors" })
  public colorCount = DEFAULT_RULES.colorCount;

  @property({ min: 4, max: 20, step: 1, tooltip: "Sand grains along one block edge" })
  public grainsPerCell = DEFAULT_RULES.grainsPerCell;

  @property({ min: 1, max: 4, step: 1, tooltip: "Gravity simulation passes per fixed tick" })
  public sandSubsteps = DEFAULT_RULES.sandSubsteps;

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

  @property({ min: 0, max: 500, step: 10, tooltip: "Delay before held left/right starts repeating" })
  public horizontalRepeatDelayMs = 170;

  @property({ min: 15, max: 200, step: 5, tooltip: "Interval between repeated left/right moves" })
  public horizontalRepeatIntervalMs = 55;

  private session!: GameSession;
  private runner!: FixedStepRunner;
  private rules!: Readonly<RulesConfig>;
  private pieceAnimator!: PieceVisualAnimator;
  private horizontalAutoRepeat!: InputAutoRepeat;
  private horizontalDirection: -1 | 0 | 1 = 0;
  private pixelBuffer!: SandPixelBuffer;
  private boardCells!: Uint8Array;
  private grainVariantCells!: Uint8Array;
  private clearMaskCells!: Uint8Array;
  private texture: Texture2D | null = null;
  private spriteFrame: SpriteFrame | null = null;
  private renderedPreviewKey = "";
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
      sandSubsteps: this.sandSubsteps,
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
    this.horizontalAutoRepeat = new InputAutoRepeat({
      initialDelayMs: this.horizontalRepeatDelayMs,
      repeatIntervalMs: this.horizontalRepeatIntervalMs,
      maxRepeatsPerUpdate: 4,
    });
    this.boardCells = new Uint8Array(this.session.boardWidth * this.session.boardHeight);
    this.grainVariantCells = new Uint8Array(this.boardCells.length);
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
    if (this.sandSprite === null || this.pieceGraphics === null) {
      const boardNode = new Node("SandBoard");
      boardNode.layer = this.node.layer;
      boardNode.setPosition(0, -54);
      this.node.addChild(boardNode);

      const transform = boardNode.addComponent(UITransform);
      transform.setContentSize(280, 672);

      const sprite = boardNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this.sandSprite = sprite;

      // A Cocos node may only own one renderable component. Keep the dynamic
      // texture and the active-piece overlay on separate, aligned nodes.
      const pieceNode = new Node("ActivePiece");
      pieceNode.layer = boardNode.layer;
      boardNode.addChild(pieceNode);
      pieceNode.addComponent(UITransform).setContentSize(280, 672);
      this.pieceGraphics = pieceNode.addComponent(Graphics);
    }

    if (this.nextPieceGraphics === null) {
      this.createNextPiecePanel();
    }
  }

  private createNextPiecePanel(): void {
    const panelNode = new Node("NextPiecePanel");
    panelNode.layer = this.node.layer;
    panelNode.setPosition(102, 342);
    this.node.addChild(panelNode);
    panelNode.addComponent(UITransform).setContentSize(88, 98);

    const panel = panelNode.addComponent(Graphics);
    panel.fillColor = new Color(12, 18, 31, 232);
    panel.roundRect(-44, -49, 88, 98, 10);
    panel.fill();
    panel.strokeColor = new Color(78, 99, 132, 255);
    panel.lineWidth = 2;
    panel.roundRect(-43, -48, 86, 96, 9);
    panel.stroke();

    const labelNode = new Node("NextLabel");
    labelNode.layer = panelNode.layer;
    labelNode.setPosition(0, 34);
    panelNode.addChild(labelNode);
    labelNode.addComponent(UITransform).setContentSize(76, 20);
    const label = labelNode.addComponent(Label);
    label.string = "NEXT";
    label.fontSize = 13;
    label.lineHeight = 18;
    label.color = new Color(180, 194, 219, 255);
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;

    const pieceNode = new Node("NextPiece");
    pieceNode.layer = panelNode.layer;
    pieceNode.setPosition(0, -10);
    panelNode.addChild(pieceNode);
    pieceNode.addComponent(UITransform).setContentSize(68, 58);
    this.nextPieceGraphics = pieceNode.addComponent(Graphics);
  }

  protected onEnable(): void {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
  }

  protected onDisable(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    this.pressedKeys.clear();
    this.stopHorizontalInput();
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
    this.updateHeldHorizontalInput(deltaTime);
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
    this.session.copyGrainVariantsTo(this.grainVariantCells);
    const hasClearEffect = this.session.copyClearMaskTo(this.clearMaskCells);
    const flashIntensity = hasClearEffect
      ? clearFlashIntensity(this.session.getClearProgress(renderAheadSeconds))
      : 0;
    const update = this.pixelBuffer.update(
      this.boardCells,
      hasClearEffect ? this.clearMaskCells : undefined,
      flashIntensity,
      this.grainVariantCells,
    );
    if (update.changedCount > 0) {
      this.texture?.uploadData(this.pixelBuffer.pixels);
    }
    this.renderActivePiece(deltaTime, renderAheadSeconds);
    this.renderNextPiece();
  }

  private renderNextPiece(): void {
    const graphics = this.nextPieceGraphics;
    const piece = this.session.nextPiece;
    if (graphics === null) {
      return;
    }
    const previewKey = piece === undefined ? "" : `${piece.definition.id}:${piece.color}`;
    if (previewKey === this.renderedPreviewKey) {
      return;
    }
    this.renderedPreviewKey = previewKey;
    graphics.clear();
    if (piece === undefined) {
      return;
    }

    const color = DEFAULT_SAND_PALETTE[piece.color];
    if (color === undefined) {
      throw new Error(`Missing preview color ${piece.color}`);
    }
    const layout = layoutPiecePreview(piece.definition, 60, 50, 15);
    graphics.fillColor = new Color(color.r, color.g, color.b, color.a);
    for (const cell of layout.cells) {
      graphics.roundRect(
        cell.x + 0.75,
        cell.y + 0.75,
        layout.cellSize - 1.5,
        layout.cellSize - 1.5,
        2,
      );
    }
    graphics.fill();

    graphics.fillColor = new Color(255, 255, 255, 38);
    for (const cell of layout.cells) {
      graphics.rect(
        cell.x + 2,
        cell.y + layout.cellSize - 3.5,
        Math.max(1, layout.cellSize - 4),
        1.5,
      );
    }
    graphics.fill();
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
    const cellInset = Math.max(0.75, Math.min(cellWidth, cellHeight) * 0.045);
    const cornerRadius = Math.max(2, Math.min(cellWidth, cellHeight) * 0.1);
    if (piece.mode === "sandifying") {
      const scale = this.rules.grainsPerCell;
      const grainWidth = cellWidth / scale;
      const grainHeight = cellHeight / scale;
      graphics.fillColor = new Color(color.r, color.g, color.b, color.a);
      for (const cell of rotation) {
        const macroX = Math.round(piece.x + cell.x);
        const macroY = Math.round(piece.y + cell.y);
        for (let grainY = 0; grainY < scale; grainY += 1) {
          for (let grainX = 0; grainX < scale; grainX += 1) {
            const boardGrainX = macroX * scale + grainX;
            const boardGrainY = macroY * scale + grainY;
            if (!sandifyGrainVisible(boardGrainX, boardGrainY, piece.opacity)) {
              continue;
            }
            graphics.rect(
              left + boardGrainX * grainWidth,
              top - (boardGrainY + 1) * grainHeight,
              grainWidth + 0.05,
              grainHeight + 0.05,
            );
          }
        }
      }
      graphics.fill();
      return;
    }

    graphics.fillColor = new Color(
      color.r,
      color.g,
      color.b,
      Math.round(color.a * piece.opacity),
    );
    for (const cell of rotation) {
      const macroX = piece.x + cell.x;
      const macroY = piece.y + cell.y;
      graphics.roundRect(
        left + macroX * cellWidth + cellInset,
        top - (macroY + 1) * cellHeight + cellInset,
        cellWidth - cellInset * 2,
        cellHeight - cellInset * 2,
        cornerRadius,
      );
    }
    graphics.fill();

    graphics.fillColor = new Color(255, 255, 255, Math.round(38 * piece.opacity));
    for (const cell of rotation) {
      const macroX = piece.x + cell.x;
      const macroY = piece.y + cell.y;
      graphics.rect(
        left + macroX * cellWidth + cellInset + 2,
        top - macroY * cellHeight - cellInset - 3,
        Math.max(1, cellWidth - cellInset * 2 - 4),
        1.5,
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
        this.beginHorizontalInput(-1);
        break;
      case KeyCode.ARROW_RIGHT:
      case KeyCode.KEY_D:
        this.beginHorizontalInput(1);
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
        this.renderedPreviewKey = "";
        break;
      default:
        break;
    }
    this.renderFrame(0);
  }

  private onKeyUp(event: EventKeyboard): void {
    this.pressedKeys.delete(event.keyCode);
    if (this.isHorizontalKey(event.keyCode)) {
      this.syncHorizontalInputAfterRelease();
    }
    if (event.keyCode === KeyCode.ARROW_DOWN || event.keyCode === KeyCode.KEY_S) {
      this.session.setSoftDrop(false);
    }
  }

  private beginHorizontalInput(direction: -1 | 1): void {
    if (this.horizontalDirection === direction) {
      return;
    }
    this.horizontalDirection = direction;
    this.horizontalAutoRepeat.reset();
    if (direction === -1) {
      this.session.moveLeft();
    } else {
      this.session.moveRight();
    }
  }

  private stopHorizontalInput(): void {
    this.horizontalDirection = 0;
    this.horizontalAutoRepeat?.reset();
  }

  private updateHeldHorizontalInput(deltaTime: number): void {
    const direction = this.horizontalDirection;
    if (direction === 0) {
      return;
    }
    const repeatCount = this.horizontalAutoRepeat.advance(deltaTime);
    for (let repeat = 0; repeat < repeatCount; repeat += 1) {
      const moved = direction === -1
        ? this.session.moveLeft()
        : this.session.moveRight();
      if (!moved) {
        break;
      }
    }
  }

  private syncHorizontalInputAfterRelease(): void {
    if (this.horizontalDirection === -1 && this.hasLeftKeyPressed()) {
      return;
    }
    if (this.horizontalDirection === 1 && this.hasRightKeyPressed()) {
      return;
    }
    if (this.hasLeftKeyPressed()) {
      this.beginHorizontalInput(-1);
    } else if (this.hasRightKeyPressed()) {
      this.beginHorizontalInput(1);
    } else {
      this.stopHorizontalInput();
    }
  }

  private hasLeftKeyPressed(): boolean {
    return this.pressedKeys.has(KeyCode.ARROW_LEFT) || this.pressedKeys.has(KeyCode.KEY_A);
  }

  private hasRightKeyPressed(): boolean {
    return this.pressedKeys.has(KeyCode.ARROW_RIGHT) || this.pressedKeys.has(KeyCode.KEY_D);
  }

  private isHorizontalKey(code: KeyCode): boolean {
    return code === KeyCode.ARROW_LEFT
      || code === KeyCode.KEY_A
      || code === KeyCode.ARROW_RIGHT
      || code === KeyCode.KEY_D;
  }

  private togglePause(): void {
    if (this.session.phase === "Paused") {
      this.session.resume();
    } else if (this.session.pause()) {
      this.runner.reset();
    }
  }
}
