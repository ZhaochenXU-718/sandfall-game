import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  EventTouch,
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
import {
  GestureRecognizer,
  type GestureCommand,
} from "../application/GestureRecognizer";
import { HighScoreStore, type StringStorage } from "../application/HighScoreStore";
import { InputAutoRepeat } from "../application/InputAutoRepeat";
import { DEFAULT_RULES, type RulesConfig } from "../core/RulesConfig";
import { layoutPiecePreview } from "../rendering/PiecePreviewLayout";
import { PieceVisualAnimator } from "../rendering/PieceVisualAnimator";
import { fitResponsiveGameLayout } from "../rendering/ResponsiveGameLayout";
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

  @property({ min: 12, max: 50, step: 1, tooltip: "Horizontal drag points per block move" })
  public touchHorizontalStepDistance = 22;

  @property({ min: 100, max: 500, step: 10, tooltip: "Stationary press time before soft drop" })
  public touchSoftDropHoldMs = 180;

  @property({ min: 40, max: 180, step: 2, tooltip: "Fast downward swipe distance for hard drop" })
  public touchHardDropDistance = 72;

  private session!: GameSession;
  private runner!: FixedStepRunner;
  private rules!: Readonly<RulesConfig>;
  private pieceAnimator!: PieceVisualAnimator;
  private horizontalAutoRepeat!: InputAutoRepeat;
  private touchGesture!: GestureRecognizer;
  private activeTouchId: number | undefined;
  private horizontalDirection: -1 | 0 | 1 = 0;
  private pixelBuffer!: SandPixelBuffer;
  private boardCells!: Uint8Array;
  private grainVariantCells!: Uint8Array;
  private clearMaskCells!: Uint8Array;
  private texture: Texture2D | null = null;
  private spriteFrame: SpriteFrame | null = null;
  private scoreLabel: Label | null = null;
  private scoreFeedbackLabel: Label | null = null;
  private timeLabel: Label | null = null;
  private chainLabel: Label | null = null;
  private statusPanelNode: Node | null = null;
  private nextPanelNode: Node | null = null;
  private pauseButtonNode: Node | null = null;
  private pauseButtonLabel: Label | null = null;
  private modalOverlayNode: Node | null = null;
  private modalTitleLabel: Label | null = null;
  private modalSummaryLabel: Label | null = null;
  private modalActionNode: Node | null = null;
  private modalActionLabel: Label | null = null;
  private modalHintLabel: Label | null = null;
  private modalBackdrop: Graphics | null = null;
  private highScoreStore!: HighScoreStore;
  private gameOverRecorded = false;
  private lastRenderedScore = 0;
  private scoreFeedbackAmount = 0;
  private scoreFeedbackElapsedSeconds = Number.POSITIVE_INFINITY;
  private scorePulseElapsedSeconds = Number.POSITIVE_INFINITY;
  private scoreFeedbackBaseY = 245;
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
    this.applyResponsiveLayout();
    const globalStorage = (globalThis as { localStorage?: StringStorage }).localStorage;
    this.highScoreStore = new HighScoreStore(globalStorage);
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
    this.touchGesture = new GestureRecognizer({
      horizontalStepDistance: this.touchHorizontalStepDistance,
      softDropHoldMs: this.touchSoftDropHoldMs,
      hardDropDistance: this.touchHardDropDistance,
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
    if (this.scoreLabel === null) {
      this.createStatusPanel();
    }
    if (this.modalOverlayNode === null) {
      this.createModalOverlay();
    }
  }

  private createNextPiecePanel(): void {
    const panelNode = new Node("NextPiecePanel");
    panelNode.layer = this.node.layer;
    panelNode.setPosition(102, 342);
    this.node.addChild(panelNode);
    this.nextPanelNode = panelNode;
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

  private createStatusPanel(): void {
    const panelNode = new Node("StatusPanel");
    panelNode.layer = this.node.layer;
    panelNode.setPosition(-102, 342);
    this.node.addChild(panelNode);
    this.statusPanelNode = panelNode;
    panelNode.addComponent(UITransform).setContentSize(112, 98);

    const panel = panelNode.addComponent(Graphics);
    panel.fillColor = new Color(12, 18, 31, 232);
    panel.roundRect(-56, -49, 112, 98, 10);
    panel.fill();
    panel.strokeColor = new Color(78, 99, 132, 255);
    panel.lineWidth = 2;
    panel.roundRect(-55, -48, 110, 96, 9);
    panel.stroke();

    this.scoreLabel = this.createLabel(panelNode, "ScoreLabel", 0, 23, 100, 32, 14);
    this.scoreLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.scoreLabel.string = "SCORE  000000";
    this.scoreLabel.color = new Color(238, 243, 255, 255);

    this.timeLabel = this.createLabel(panelNode, "TimeLabel", 0, -9, 100, 28, 13);
    this.timeLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.timeLabel.string = "TIME   00:00";
    this.timeLabel.color = new Color(180, 194, 219, 255);

    this.chainLabel = this.createLabel(panelNode, "ChainLabel", 0, -34, 100, 20, 12);
    this.chainLabel.string = "";
    this.chainLabel.color = new Color(255, 209, 92, 255);

    this.scoreFeedbackLabel = this.createLabel(
      this.node,
      "ScoreFeedback",
      0,
      245,
      160,
      40,
      22,
    );
    this.scoreFeedbackLabel.color = new Color(255, 222, 102, 255);
    this.scoreFeedbackLabel.node.active = false;

    const pauseButton = this.createButton(this.node, "PauseButton", 0, 367, 48, 38, "Ⅱ");
    this.pauseButtonNode = pauseButton.node;
    this.pauseButtonLabel = pauseButton.label;
    pauseButton.node.on(Node.EventType.TOUCH_END, this.onPauseButton, this);
  }

  private createModalOverlay(): void {
    const overlayNode = new Node("GameModalOverlay");
    overlayNode.layer = this.node.layer;
    this.node.addChild(overlayNode);
    overlayNode.addComponent(UITransform).setContentSize(360, 800);

    const backdrop = overlayNode.addComponent(Graphics);
    this.modalBackdrop = backdrop;
    backdrop.fillColor = new Color(3, 7, 15, 205);
    backdrop.rect(-180, -400, 360, 800);
    backdrop.fill();

    const cardNode = new Node("ModalCard");
    cardNode.layer = overlayNode.layer;
    overlayNode.addChild(cardNode);
    cardNode.addComponent(UITransform).setContentSize(286, 300);
    const card = cardNode.addComponent(Graphics);
    card.fillColor = new Color(16, 24, 40, 252);
    card.roundRect(-143, -150, 286, 300, 18);
    card.fill();
    card.strokeColor = new Color(94, 121, 164, 255);
    card.lineWidth = 2;
    card.roundRect(-142, -149, 284, 298, 17);
    card.stroke();

    this.modalTitleLabel = this.createLabel(cardNode, "ModalTitle", 0, 100, 250, 42, 27);
    this.modalTitleLabel.color = new Color(246, 249, 255, 255);
    this.modalSummaryLabel = this.createLabel(cardNode, "ModalSummary", 0, 28, 240, 96, 15);
    this.modalSummaryLabel.lineHeight = 24;
    this.modalSummaryLabel.color = new Color(194, 207, 230, 255);

    const action = this.createButton(cardNode, "ModalAction", 0, -67, 188, 48, "PLAY AGAIN");
    this.modalActionNode = action.node;
    this.modalActionLabel = action.label;
    action.node.on(Node.EventType.TOUCH_END, this.onModalAction, this);

    this.modalHintLabel = this.createLabel(cardNode, "ModalHint", 0, -119, 240, 24, 12);
    this.modalHintLabel.color = new Color(130, 148, 181, 255);
    overlayNode.active = false;
    this.modalOverlayNode = overlayNode;
  }

  private createLabel(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fontSize: number,
  ): Label {
    const labelNode = new Node(name);
    labelNode.layer = parent.layer;
    labelNode.setPosition(x, y);
    parent.addChild(labelNode);
    labelNode.addComponent(UITransform).setContentSize(width, height);
    const label = labelNode.addComponent(Label);
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 4;
    label.horizontalAlign = HorizontalTextAlignment.CENTER;
    label.verticalAlign = VerticalTextAlignment.CENTER;
    return label;
  }

  private createButton(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
  ): { readonly node: Node; readonly label: Label } {
    const buttonNode = new Node(name);
    buttonNode.layer = parent.layer;
    buttonNode.setPosition(x, y);
    parent.addChild(buttonNode);
    buttonNode.addComponent(UITransform).setContentSize(width, height);
    const background = buttonNode.addComponent(Graphics);
    background.fillColor = new Color(45, 92, 166, 255);
    background.roundRect(-width / 2, -height / 2, width, height, Math.min(9, height / 2));
    background.fill();
    background.strokeColor = new Color(108, 162, 245, 255);
    background.lineWidth = 1.5;
    background.roundRect(
      -width / 2 + 1,
      -height / 2 + 1,
      width - 2,
      height - 2,
      Math.min(8, height / 2 - 1),
    );
    background.stroke();

    const label = this.createLabel(buttonNode, `${name}Label`, 0, 0, width - 8, height - 4, 14);
    label.string = text;
    label.color = new Color(248, 251, 255, 255);
    return { node: buttonNode, label };
  }

  protected onEnable(): void {
    input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    view.on("canvas-resize", this.onViewResized, this);
    const boardNode = this.sandSprite?.node;
    boardNode?.on(Node.EventType.TOUCH_START, this.onBoardTouchStart, this);
    boardNode?.on(Node.EventType.TOUCH_MOVE, this.onBoardTouchMove, this);
    boardNode?.on(Node.EventType.TOUCH_END, this.onBoardTouchEnd, this);
    boardNode?.on(Node.EventType.TOUCH_CANCEL, this.onBoardTouchCancel, this);
  }

  protected onDisable(): void {
    input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
    view.off("canvas-resize", this.onViewResized, this);
    const boardNode = this.sandSprite?.node;
    boardNode?.off(Node.EventType.TOUCH_START, this.onBoardTouchStart, this);
    boardNode?.off(Node.EventType.TOUCH_MOVE, this.onBoardTouchMove, this);
    boardNode?.off(Node.EventType.TOUCH_END, this.onBoardTouchEnd, this);
    boardNode?.off(Node.EventType.TOUCH_CANCEL, this.onBoardTouchCancel, this);
    this.pressedKeys.clear();
    this.stopHorizontalInput();
    this.cancelActiveTouchGesture();
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
      this.renderHudAndModal(0);
      return;
    }
    if (this.activeTouchId !== undefined && this.canAcceptGameplayInput()) {
      this.applyGestureCommands(this.touchGesture.advance(deltaTime));
    }
    const frame = this.runner.advance(deltaTime);
    this.updateHeldHorizontalInput(deltaTime);
    if (this.activeTouchId !== undefined && !this.canAcceptGameplayInput()) {
      this.cancelActiveTouchGesture();
    }
    this.renderFrame(deltaTime, frame.interpolationAlpha * this.runner.fixedDelta);
  }

  protected onDestroy(): void {
    view.off("canvas-resize", this.onViewResized, this);
    this.spriteFrame?.destroy();
    this.texture?.destroy();
    this.spriteFrame = null;
    this.texture = null;
  }

  private applyResponsiveLayout(): void {
    if (this.rules === undefined) {
      return;
    }
    const visibleSize = view.getVisibleSize();
    const layout = fitResponsiveGameLayout({
      visibleWidth: visibleSize.width,
      visibleHeight: visibleSize.height,
      macroWidth: this.rules.macroWidth,
      macroHeight: this.rules.macroHeight,
    });

    const boardNode = this.sandSprite?.node;
    boardNode?.setPosition(0, layout.boardY);
    boardNode?.getComponent(UITransform)?.setContentSize(layout.boardWidth, layout.boardHeight);
    if (this.pieceGraphics !== null) {
      this.pieceGraphics.node.setPosition(0, 0);
      this.pieceGraphics.node
        .getComponent(UITransform)
        ?.setContentSize(layout.boardWidth, layout.boardHeight);
    }

    this.statusPanelNode?.setPosition(layout.statusX, layout.hudPanelY);
    this.nextPanelNode?.setPosition(layout.nextX, layout.hudPanelY);
    this.pauseButtonNode?.setPosition(0, layout.pauseY);
    this.scoreFeedbackBaseY = layout.feedbackY;
    this.scoreFeedbackLabel?.node.setPosition(0, layout.feedbackY);

    const overlayTransform = this.modalOverlayNode?.getComponent(UITransform);
    overlayTransform?.setContentSize(visibleSize.width, visibleSize.height);
    if (this.modalBackdrop !== null) {
      this.modalBackdrop.clear();
      this.modalBackdrop.fillColor = new Color(3, 7, 15, 205);
      this.modalBackdrop.rect(
        -visibleSize.width / 2,
        -visibleSize.height / 2,
        visibleSize.width,
        visibleSize.height,
      );
      this.modalBackdrop.fill();
    }
  }

  private onViewResized(): void {
    this.applyResponsiveLayout();
    if (this.session !== undefined) {
      this.renderFrame(0);
    }
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
    texture.setWrapMode(
      Texture2D.WrapMode.CLAMP_TO_EDGE,
      Texture2D.WrapMode.CLAMP_TO_EDGE,
    );
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
    this.renderHudAndModal(deltaTime);
  }

  private renderHudAndModal(deltaTime: number): void {
    this.updateScoreFeedback(deltaTime);
    if (this.scoreLabel !== null) {
      this.scoreLabel.string = `SCORE  ${this.formatScore(this.session.score)}`;
    }
    if (this.timeLabel !== null) {
      this.timeLabel.string = `TIME   ${this.formatTime(this.session.elapsedMilliseconds)}`;
    }
    if (this.chainLabel !== null) {
      this.chainLabel.string = this.session.chainLevel > 0
        ? `CHAIN  ×${this.session.chainLevel}`
        : "";
    }

    const phase = this.session.phase;
    const modal = this.modalOverlayNode;
    if (modal === null) {
      return;
    }
    if (phase !== "Paused" && phase !== "GameOver") {
      modal.active = false;
      if (this.pauseButtonLabel !== null) {
        this.pauseButtonLabel.string = "Ⅱ";
      }
      return;
    }

    modal.active = true;
    if (phase === "Paused") {
      if (this.modalTitleLabel !== null) this.modalTitleLabel.string = "PAUSED";
      if (this.modalSummaryLabel !== null) {
        this.modalSummaryLabel.string = [
          `SCORE   ${this.formatScore(this.session.score)}`,
          `TIME    ${this.formatTime(this.session.elapsedMilliseconds)}`,
          `BEST    ${this.formatScore(this.highScoreStore.value)}`,
        ].join("\n");
      }
      if (this.modalActionLabel !== null) this.modalActionLabel.string = "RESUME";
      if (this.modalHintLabel !== null) this.modalHintLabel.string = "P / ESC 继续游戏";
      if (this.pauseButtonLabel !== null) this.pauseButtonLabel.string = "▶";
      return;
    }

    if (!this.gameOverRecorded) {
      this.highScoreStore.record(this.session.score);
      this.gameOverRecorded = true;
    }
    if (this.modalTitleLabel !== null) this.modalTitleLabel.string = "GAME OVER";
    if (this.modalSummaryLabel !== null) {
      this.modalSummaryLabel.string = [
        `SCORE   ${this.formatScore(this.session.score)}    BEST  ${this.formatScore(this.highScoreStore.value)}`,
        `TIME    ${this.formatTime(this.session.elapsedMilliseconds)}`,
        `CLEARS  ${this.session.clearCount}    MAX CHAIN  ×${this.session.maxChain}`,
      ].join("\n");
    }
    if (this.modalActionLabel !== null) this.modalActionLabel.string = "PLAY AGAIN";
    if (this.modalHintLabel !== null) this.modalHintLabel.string = "R 重新开始";
    if (this.pauseButtonLabel !== null) this.pauseButtonLabel.string = "Ⅱ";
  }

  private updateScoreFeedback(deltaTime: number): void {
    const score = this.session.score;
    if (score > this.lastRenderedScore) {
      const added = score - this.lastRenderedScore;
      this.scoreFeedbackAmount = this.scoreFeedbackElapsedSeconds < 0.12
        ? this.scoreFeedbackAmount + added
        : added;
      this.scoreFeedbackElapsedSeconds = 0;
      this.scorePulseElapsedSeconds = 0;
      if (this.scoreFeedbackLabel !== null) {
        this.scoreFeedbackLabel.string = `+${this.scoreFeedbackAmount}`;
        this.scoreFeedbackLabel.node.active = true;
      }
    } else if (score < this.lastRenderedScore) {
      this.scoreFeedbackAmount = 0;
      this.scoreFeedbackElapsedSeconds = Number.POSITIVE_INFINITY;
      this.scorePulseElapsedSeconds = Number.POSITIVE_INFINITY;
      if (this.scoreFeedbackLabel !== null) {
        this.scoreFeedbackLabel.node.active = false;
      }
      this.scoreLabel?.node.setScale(1, 1, 1);
    }
    this.lastRenderedScore = score;

    const feedback = this.scoreFeedbackLabel;
    if (feedback !== null && Number.isFinite(this.scoreFeedbackElapsedSeconds)) {
      this.scoreFeedbackElapsedSeconds += Math.max(0, deltaTime);
      const duration = 0.72;
      const progress = Math.min(1, this.scoreFeedbackElapsedSeconds / duration);
      const fade = progress < 0.58 ? 1 : (1 - progress) / 0.42;
      const scale = 0.82 + 0.2 * Math.min(1, progress / 0.16);
      feedback.node.setPosition(0, this.scoreFeedbackBaseY + progress * 34);
      feedback.node.setScale(scale, scale, 1);
      feedback.color = new Color(255, 222, 102, Math.round(255 * fade));
      if (progress >= 1) {
        feedback.node.active = false;
        this.scoreFeedbackElapsedSeconds = Number.POSITIVE_INFINITY;
        this.scoreFeedbackAmount = 0;
      }
    }

    if (this.scoreLabel !== null && Number.isFinite(this.scorePulseElapsedSeconds)) {
      this.scorePulseElapsedSeconds += Math.max(0, deltaTime);
      const pulseDuration = 0.24;
      const progress = Math.min(1, this.scorePulseElapsedSeconds / pulseDuration);
      const scale = 1 + Math.sin(progress * Math.PI) * 0.1;
      this.scoreLabel.node.setScale(scale, scale, 1);
      if (progress >= 1) {
        this.scoreLabel.node.setScale(1, 1, 1);
        this.scorePulseElapsedSeconds = Number.POSITIVE_INFINITY;
      }
    }
  }

  private formatScore(score: number): string {
    return Math.max(0, Math.floor(score)).toString().padStart(6, "0");
  }

  private formatTime(elapsedMilliseconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(elapsedMilliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
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
      case KeyCode.ESCAPE:
        this.togglePause();
        break;
      case KeyCode.KEY_R:
        this.restartGame();
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

  private onBoardTouchStart(event: EventTouch): void {
    if (this.activeTouchId !== undefined || !this.canAcceptGameplayInput()) {
      return;
    }
    const point = event.getUILocation();
    this.activeTouchId = event.getID() ?? -1;
    this.touchGesture.begin(point.x, point.y);
    event.propagationStopped = true;
  }

  private onBoardTouchMove(event: EventTouch): void {
    if (!this.isActiveTouch(event)) {
      return;
    }
    const point = event.getUILocation();
    this.applyGestureCommands(this.touchGesture.move(point.x, point.y));
    event.propagationStopped = true;
    if (!this.canAcceptGameplayInput()) {
      this.cancelActiveTouchGesture();
    }
    this.renderFrame(0);
  }

  private onBoardTouchEnd(event: EventTouch): void {
    if (!this.isActiveTouch(event)) {
      return;
    }
    const point = event.getUILocation();
    const commands = this.touchGesture.end(point.x, point.y);
    this.activeTouchId = undefined;
    this.applyGestureCommands(commands);
    event.propagationStopped = true;
    this.renderFrame(0);
  }

  private onBoardTouchCancel(event: EventTouch): void {
    if (!this.isActiveTouch(event)) {
      return;
    }
    this.cancelActiveTouchGesture();
    event.propagationStopped = true;
    this.renderFrame(0);
  }

  private isActiveTouch(event: EventTouch): boolean {
    return this.activeTouchId !== undefined && (event.getID() ?? -1) === this.activeTouchId;
  }

  private canAcceptGameplayInput(): boolean {
    return this.session !== undefined
      && (this.session.phase === "Falling" || this.session.phase === "LockDelay");
  }

  private applyGestureCommands(commands: readonly GestureCommand[]): void {
    for (const command of commands) {
      if (command.type === "softDrop" && !command.active) {
        this.session.setSoftDrop(false);
        continue;
      }
      if (!this.canAcceptGameplayInput()) {
        continue;
      }
      switch (command.type) {
        case "moveHorizontal":
          for (let step = 0; step < command.steps; step += 1) {
            const moved = command.direction === -1
              ? this.session.moveLeft()
              : this.session.moveRight();
            if (!moved) {
              break;
            }
          }
          break;
        case "rotateCW":
          this.session.rotateCW();
          break;
        case "softDrop":
          this.session.setSoftDrop(true);
          break;
        case "hardDrop":
          this.session.hardDrop();
          break;
        default:
          break;
      }
    }
  }

  private cancelActiveTouchGesture(): void {
    if (this.touchGesture === undefined) {
      this.activeTouchId = undefined;
      return;
    }
    const commands = this.touchGesture.cancel();
    this.activeTouchId = undefined;
    if (this.session !== undefined) {
      this.applyGestureCommands(commands);
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
    let changed = false;
    if (this.session.phase === "Paused") {
      changed = this.session.resume();
    } else {
      changed = this.session.pause();
      if (changed) {
        this.stopHorizontalInput();
        this.cancelActiveTouchGesture();
      }
    }
    if (changed) {
      this.runner.reset();
      this.renderFrame(0);
    }
  }

  private restartGame(): void {
    this.stopHorizontalInput();
    this.cancelActiveTouchGesture();
    this.session.start(Date.now());
    this.runner.reset();
    this.pieceAnimator.reset(this.session.lockSequence);
    this.renderedPreviewKey = "";
    this.gameOverRecorded = false;
    this.renderFrame(0);
  }

  private onPauseButton(): void {
    this.togglePause();
  }

  private onModalAction(): void {
    if (this.session.phase === "Paused") {
      this.togglePause();
    } else if (this.session.phase === "GameOver") {
      this.restartGame();
    }
  }
}
