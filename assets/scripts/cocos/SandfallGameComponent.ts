import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  EventTouch,
  game,
  Game,
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
import type { GamePhase } from "../application/GameStateMachine";
import {
  GestureRecognizer,
  type GestureCommand,
} from "../application/GestureRecognizer";
import { HighScoreStore, type StringStorage } from "../application/HighScoreStore";
import { InputAutoRepeat } from "../application/InputAutoRepeat";
import { DEFAULT_RULES, type RulesConfig } from "../core/RulesConfig";
import { CocosFeedbackController } from "./CocosFeedbackController";
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
  private homeScreenNode: Node | null = null;
  private homeBackground: Graphics | null = null;
  private homeHeroNode: Node | null = null;
  private homeStartButtonNode: Node | null = null;
  private homeBestLabel: Label | null = null;
  private homeAnimationSeconds = 0;
  private homeHeroImpulse = 0;
  private readonly homeHeroBaseY = 42;
  private feedback!: CocosFeedbackController;
  private highScoreStore!: HighScoreStore;
  private gameOverRecorded = false;
  private lastRenderedScore = 0;
  private scoreFeedbackAmount = 0;
  private scoreFeedbackElapsedSeconds = Number.POSITIVE_INFINITY;
  private scorePulseElapsedSeconds = Number.POSITIVE_INFINITY;
  private scoreFeedbackBaseY = 245;
  private renderedPreviewKey = "";
  private lastFeedbackPhase: GamePhase = "Idle";
  private lastFeedbackLockSequence = 0;
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
    this.feedback = new CocosFeedbackController(this.node, globalStorage);
    this.highScoreStore = new HighScoreStore(globalStorage);
    this.session = new GameSession({ rules: this.rules });
    this.resetFeedbackState();
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
    if (this.homeScreenNode === null) {
      this.createHomeScreen();
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

  private createHomeScreen(): void {
    const homeNode = new Node("HomeScreen");
    homeNode.layer = this.node.layer;
    this.node.addChild(homeNode);
    homeNode.addComponent(UITransform).setContentSize(360, 800);
    this.homeScreenNode = homeNode;
    this.homeBackground = homeNode.addComponent(Graphics);

    const brandNode = new Node("HomeBrand");
    brandNode.layer = homeNode.layer;
    brandNode.setPosition(0, 252);
    homeNode.addChild(brandNode);
    brandNode.addComponent(UITransform).setContentSize(310, 104);
    const brandBackground = brandNode.addComponent(Graphics);
    brandBackground.fillColor = new Color(11, 25, 44, 232);
    brandBackground.roundRect(-155, -52, 310, 104, 20);
    brandBackground.fill();
    brandBackground.strokeColor = new Color(72, 115, 163, 200);
    brandBackground.lineWidth = 2;
    brandBackground.roundRect(-154, -51, 308, 102, 19);
    brandBackground.stroke();

    const title = this.createLabel(brandNode, "HomeTitle", 0, 12, 286, 52, 36);
    title.string = "SANDFALL";
    title.color = new Color(244, 249, 255, 255);
    const tagline = this.createLabel(brandNode, "HomeTagline", 0, -29, 270, 26, 14);
    tagline.string = "让颜色贯穿沙海";
    tagline.color = new Color(150, 196, 230, 255);

    const brandAccentNode = new Node("BrandAccent");
    brandAccentNode.layer = brandNode.layer;
    brandAccentNode.setPosition(0, -48);
    brandNode.addChild(brandAccentNode);
    brandAccentNode.addComponent(UITransform).setContentSize(144, 5);
    const brandAccent = brandAccentNode.addComponent(Graphics);
    const accentColors = [
      new Color(65, 205, 195, 255),
      new Color(81, 133, 226, 255),
      new Color(255, 99, 107, 255),
      new Color(255, 196, 75, 255),
    ];
    accentColors.forEach((color, index) => {
      brandAccent.fillColor = color;
      brandAccent.roundRect(-70 + index * 36, 0, 32, 4, 2);
      brandAccent.fill();
    });

    const heroNode = new Node("HomeHero");
    heroNode.layer = homeNode.layer;
    heroNode.setPosition(0, this.homeHeroBaseY);
    homeNode.addChild(heroNode);
    heroNode.addComponent(UITransform).setContentSize(220, 190);
    this.homeHeroNode = heroNode;
    const heroGraphics = heroNode.addComponent(Graphics);
    this.drawHomeHero(heroGraphics);
    heroNode.on(Node.EventType.TOUCH_END, this.onHomeHeroTapped, this);

    this.createHomeFeatureTile(homeNode, "RankingEntry", -112, -105, "排行", "即将开放", 0);
    this.createHomeFeatureTile(homeNode, "AchievementEntry", 0, -105, "成就", "即将开放", 1);
    this.createHomeFeatureTile(homeNode, "SkinEntry", 112, -105, "皮肤", "即将开放", 2);

    this.homeBestLabel = this.createLabel(homeNode, "HomeBest", 0, -194, 300, 30, 16);
    this.homeBestLabel.color = new Color(190, 209, 233, 255);

    const start = this.createButton(homeNode, "HomeStartButton", 0, -263, 252, 64, "▶  开始游戏");
    this.homeStartButtonNode = start.node;
    start.label.fontSize = 21;
    start.label.lineHeight = 27;
    start.node.on(Node.EventType.TOUCH_END, this.onHomeStartButton, this);

    const hint = this.createLabel(homeNode, "HomeHint", 0, -316, 280, 24, 12);
    hint.string = "点击主视觉可互动  ·  SPACE / ENTER 开始";
    hint.color = new Color(111, 142, 177, 255);

    this.createHomeFeatureTile(homeNode, "SettingsEntry", -135, 340, "设置", "功能预留", 3, 82, 54);
    const version = this.createLabel(homeNode, "HomeVersion", 0, -374, 180, 20, 10);
    version.string = "SANDFALL  ·  PROTOTYPE 0.1";
    version.color = new Color(70, 99, 132, 255);
  }

  private createHomeFeatureTile(
    parent: Node,
    name: string,
    x: number,
    y: number,
    titleText: string,
    subtitleText: string,
    colorIndex: number,
    width = 88,
    height = 66,
  ): void {
    const node = new Node(name);
    node.layer = parent.layer;
    node.setPosition(x, y);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(width, height);
    const graphics = node.addComponent(Graphics);
    const color = DEFAULT_SAND_PALETTE[(colorIndex % (DEFAULT_SAND_PALETTE.length - 1)) + 1];
    if (color === undefined) {
      return;
    }
    graphics.fillColor = new Color(12, 27, 47, 238);
    graphics.roundRect(-width / 2, -height / 2, width, height, 13);
    graphics.fill();
    graphics.strokeColor = new Color(color.r, color.g, color.b, 150);
    graphics.lineWidth = 1.5;
    graphics.roundRect(-width / 2 + 1, -height / 2 + 1, width - 2, height - 2, 12);
    graphics.stroke();
    graphics.fillColor = new Color(color.r, color.g, color.b, 220);
    graphics.roundRect(-width / 2 + 8, height / 2 - 8, width - 16, 3, 1.5);
    graphics.fill();

    const title = this.createLabel(node, `${name}Title`, 0, 8, width - 8, 24, 15);
    title.string = titleText;
    title.color = new Color(232, 241, 252, 255);
    const subtitle = this.createLabel(node, `${name}Subtitle`, 0, -15, width - 6, 18, 10);
    subtitle.string = subtitleText;
    subtitle.color = new Color(105, 134, 168, 255);
  }

  private drawHomeHero(graphics: Graphics): void {
    graphics.clear();
    graphics.fillColor = new Color(0, 0, 0, 76);
    graphics.ellipse(-86, -78, 182, 28);
    graphics.fill();

    const cubes = [
      { x: -70, y: -28, color: 1 },
      { x: -22, y: -28, color: 2 },
      { x: 26, y: -28, color: 3 },
      { x: -22, y: 20, color: 4 },
    ];
    for (const cube of cubes) {
      const color = DEFAULT_SAND_PALETTE[cube.color];
      if (color !== undefined) {
        this.drawHomeCube(graphics, cube.x, cube.y, 43, color);
      }
    }

    const grains = [
      { x: -50, y: -61, size: 7, color: 1 },
      { x: 12, y: -68, size: 5, color: 2 },
      { x: 48, y: -57, size: 8, color: 3 },
      { x: -3, y: -83, size: 5, color: 4 },
    ];
    for (const grain of grains) {
      const color = DEFAULT_SAND_PALETTE[grain.color];
      if (color === undefined) continue;
      graphics.fillColor = new Color(color.r, color.g, color.b, 230);
      graphics.roundRect(grain.x, grain.y, grain.size, grain.size, 1.5);
      graphics.fill();
    }
  }

  private drawHomeCube(
    graphics: Graphics,
    x: number,
    y: number,
    size: number,
    color: { readonly r: number; readonly g: number; readonly b: number; readonly a: number },
  ): void {
    const depth = 9;
    graphics.fillColor = new Color(
      Math.min(255, color.r + 34),
      Math.min(255, color.g + 34),
      Math.min(255, color.b + 34),
      255,
    );
    graphics.moveTo(x, y + size);
    graphics.lineTo(x + depth, y + size + depth);
    graphics.lineTo(x + size + depth, y + size + depth);
    graphics.lineTo(x + size, y + size);
    graphics.close();
    graphics.fill();

    graphics.fillColor = new Color(
      Math.max(0, color.r - 45),
      Math.max(0, color.g - 45),
      Math.max(0, color.b - 45),
      255,
    );
    graphics.moveTo(x + size, y);
    graphics.lineTo(x + size + depth, y + depth);
    graphics.lineTo(x + size + depth, y + size + depth);
    graphics.lineTo(x + size, y + size);
    graphics.close();
    graphics.fill();

    graphics.fillColor = new Color(color.r, color.g, color.b, color.a);
    graphics.roundRect(x, y, size, size, 6);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 66);
    graphics.roundRect(x + 6, y + size - 10, size - 12, 4, 2);
    graphics.fill();
    graphics.fillColor = new Color(255, 255, 255, 40);
    graphics.circle(x + 10, y + 11, 2.4);
    graphics.circle(x + 20, y + 17, 1.7);
    graphics.fill();
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
    game.on(Game.EVENT_HIDE, this.onApplicationHide, this);
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
    game.off(Game.EVENT_HIDE, this.onApplicationHide, this);
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
    this.feedback?.pause();
  }

  protected update(deltaTime: number): void {
    // Avoid cascading frame errors if a future initialization failure occurs.
    if (this.session === undefined || this.runner === undefined) {
      return;
    }
    if (this.session.phase === "Idle") {
      this.renderHomeScreen(deltaTime);
      this.renderHudAndModal(0);
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
    game.off(Game.EVENT_HIDE, this.onApplicationHide, this);
    this.feedback?.destroy();
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

    const homeTransform = this.homeScreenNode?.getComponent(UITransform);
    homeTransform?.setContentSize(visibleSize.width, visibleSize.height);
    this.redrawHomeBackground(visibleSize.width, visibleSize.height);
  }

  private redrawHomeBackground(width: number, height: number): void {
    const graphics = this.homeBackground;
    if (graphics === null) {
      return;
    }
    const left = -width / 2;
    const bottom = -height / 2;
    graphics.clear();
    graphics.fillColor = new Color(5, 13, 25, 255);
    graphics.rect(left, bottom, width, height);
    graphics.fill();

    graphics.fillColor = new Color(25, 61, 89, 33);
    for (let y = bottom + 28, row = 0; y < height / 2; y += 54, row += 1) {
      const offset = row % 2 === 0 ? 0 : 27;
      for (let x = left + 18 + offset; x < width / 2; x += 54) {
        graphics.roundRect(x, y, 6, 6, 1.5);
        graphics.roundRect(x + 8, y - 8, 4, 4, 1);
        graphics.roundRect(x - 6, y - 12, 3, 3, 1);
      }
    }
    graphics.fill();

    graphics.fillColor = new Color(50, 143, 188, 18);
    graphics.circle(0, this.homeHeroBaseY + 22, 142);
    graphics.fill();
    graphics.strokeColor = new Color(78, 174, 208, 30);
    graphics.lineWidth = 2;
    graphics.circle(0, this.homeHeroBaseY + 22, 120);
    graphics.stroke();

    const layers = [
      { color: new Color(65, 205, 195, 30), y: bottom + 44, peak: 44 },
      { color: new Color(81, 133, 226, 28), y: bottom + 28, peak: 58 },
      { color: new Color(255, 99, 107, 24), y: bottom + 12, peak: 38 },
    ];
    layers.forEach((layer, index) => {
      graphics.fillColor = layer.color;
      graphics.moveTo(left, bottom);
      graphics.lineTo(left, layer.y);
      for (let x = left; x <= width / 2 + 48; x += 48) {
        const wave = Math.sin((x + index * 37) * 0.027) * layer.peak * 0.35;
        graphics.lineTo(x, layer.y + wave);
      }
      graphics.lineTo(width / 2, bottom);
      graphics.close();
      graphics.fill();
    });
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
    this.syncFeedbackState();
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
    this.renderHomeScreen(deltaTime);
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
    this.setGameplayChromeVisible(phase !== "Idle");
    if (phase === "Idle") {
      modal.active = false;
      if (this.pauseButtonLabel !== null) this.pauseButtonLabel.string = "Ⅱ";
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

  private renderHomeScreen(deltaTime: number): void {
    const home = this.homeScreenNode;
    if (home === null) {
      return;
    }
    const visible = this.session.phase === "Idle";
    home.active = visible;
    if (!visible) {
      return;
    }
    if (this.homeBestLabel !== null) {
      this.homeBestLabel.string = `最高分  ${this.formatScore(this.highScoreStore.value)}`;
    }

    const step = Math.min(0.05, Math.max(0, deltaTime));
    this.homeAnimationSeconds += step;
    this.homeHeroImpulse = Math.max(0, this.homeHeroImpulse - step * 1.8);
    const hero = this.homeHeroNode;
    if (hero !== null) {
      const bob = Math.sin(this.homeAnimationSeconds * 1.9) * 7;
      const idleSway = Math.sin(this.homeAnimationSeconds * 1.25) * 3.2;
      const impulseSway = Math.sin(this.homeAnimationSeconds * 18) * 13 * this.homeHeroImpulse;
      const impulseLift = Math.sin(this.homeHeroImpulse * Math.PI) * 14;
      const scale = 1
        + Math.sin(this.homeAnimationSeconds * 2.2) * 0.018
        + this.homeHeroImpulse * 0.045;
      hero.setPosition(0, this.homeHeroBaseY + bob + impulseLift);
      hero.angle = idleSway + impulseSway;
      hero.setScale(scale, scale, 1);
    }
    if (this.homeStartButtonNode !== null) {
      const pulse = 1 + Math.sin(this.homeAnimationSeconds * 2.6) * 0.014;
      this.homeStartButtonNode.setScale(pulse, pulse, 1);
    }
  }

  private setGameplayChromeVisible(visible: boolean): void {
    if (this.sandSprite !== null) {
      this.sandSprite.node.active = visible;
    }
    if (this.statusPanelNode !== null) {
      this.statusPanelNode.active = visible;
    }
    if (this.nextPanelNode !== null) {
      this.nextPanelNode.active = visible;
    }
    if (this.pauseButtonNode !== null) {
      this.pauseButtonNode.active = visible;
    }
    if (!visible && this.scoreFeedbackLabel !== null) {
      this.scoreFeedbackLabel.node.active = false;
    }
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
    this.feedback.unlock();

    if (this.session.phase === "Idle") {
      if (code === KeyCode.SPACE || code === KeyCode.ENTER || code === KeyCode.NUM_ENTER) {
        this.startNewGame();
      }
      return;
    }

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
        this.rotateActivePiece(true);
        break;
      case KeyCode.KEY_Z:
        this.rotateActivePiece(false);
        break;
      case KeyCode.SPACE:
        this.hardDropActivePiece();
        break;
      case KeyCode.KEY_P:
        this.togglePause();
        break;
      case KeyCode.ESCAPE:
        this.togglePause();
        break;
      case KeyCode.KEY_R:
        this.startNewGame();
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
    this.feedback.unlock();
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
            const moved = this.moveActivePiece(command.direction);
            if (!moved) {
              break;
            }
          }
          break;
        case "rotateCW":
          this.rotateActivePiece(true);
          break;
        case "softDrop":
          this.session.setSoftDrop(true);
          break;
        case "hardDrop":
          this.hardDropActivePiece();
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
    this.moveActivePiece(direction);
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
      const moved = this.moveActivePiece(direction);
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
      this.feedback.trigger("ui");
      if (this.session.phase === "Paused") {
        this.feedback.pause();
      } else {
        this.feedback.resume();
      }
      this.runner.reset();
      this.renderFrame(0);
    }
  }

  private startNewGame(): void {
    this.stopHorizontalInput();
    this.cancelActiveTouchGesture();
    this.session.start(Date.now());
    this.resetFeedbackState();
    this.runner.reset();
    this.pieceAnimator.reset(this.session.lockSequence);
    this.renderedPreviewKey = "";
    this.gameOverRecorded = false;
    this.feedback.trigger("ui");
    this.feedback.resume();
    this.renderFrame(0);
  }

  private onPauseButton(): void {
    this.feedback.unlock();
    this.togglePause();
  }

  private onHomeStartButton(): void {
    this.feedback.unlock();
    if (this.session.phase === "Idle") {
      this.startNewGame();
    }
  }

  private onHomeHeroTapped(): void {
    if (this.session.phase !== "Idle") {
      return;
    }
    this.feedback.unlock();
    this.feedback.trigger("ui");
    this.homeHeroImpulse = 1;
  }

  private onModalAction(): void {
    this.feedback.unlock();
    if (this.session.phase === "Paused") {
      this.togglePause();
    } else if (this.session.phase === "GameOver") {
      this.startNewGame();
    }
  }

  private moveActivePiece(direction: -1 | 1): boolean {
    const moved = direction === -1 ? this.session.moveLeft() : this.session.moveRight();
    if (moved) {
      this.feedback.trigger("move");
    }
    return moved;
  }

  private rotateActivePiece(clockwise: boolean): boolean {
    const rotated = clockwise ? this.session.rotateCW() : this.session.rotateCCW();
    if (rotated) {
      this.feedback.trigger("rotate");
    }
    return rotated;
  }

  private hardDropActivePiece(): void {
    const lockSequence = this.session.lockSequence;
    this.session.hardDrop();
    if (this.session.lockSequence > lockSequence) {
      this.feedback.trigger("hard-drop");
    }
  }

  private syncFeedbackState(): void {
    const phase = this.session.phase;
    if (phase === "LockDelay" && this.lastFeedbackPhase !== "LockDelay") {
      this.feedback.trigger("land");
    }
    if (this.session.lockSequence > this.lastFeedbackLockSequence) {
      this.feedback.trigger("sandify");
    }
    if (phase === "Clearing" && this.lastFeedbackPhase !== "Clearing") {
      this.feedback.trigger(this.session.chainLevel > 0 ? "clear-chain" : "clear");
    }
    if (phase === "GameOver" && this.lastFeedbackPhase !== "GameOver") {
      this.feedback.trigger("game-over");
      this.feedback.pause();
    }
    this.lastFeedbackPhase = phase;
    this.lastFeedbackLockSequence = this.session.lockSequence;
  }

  private resetFeedbackState(): void {
    this.lastFeedbackPhase = this.session.phase;
    this.lastFeedbackLockSequence = this.session.lockSequence;
  }

  private onApplicationHide(): void {
    if (
      this.session !== undefined
      && this.session.phase !== "Idle"
      && this.session.phase !== "Paused"
      && this.session.phase !== "GameOver"
    ) {
      this.session.pause();
      this.stopHorizontalInput();
      this.cancelActiveTouchGesture();
      this.runner?.reset();
      this.renderFrame(0);
    }
    this.feedback?.pause();
  }
}
