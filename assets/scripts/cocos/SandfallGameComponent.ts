import {
  _decorator,
  Color,
  Component,
  director,
  EventKeyboard,
  EventTouch,
  game,
  Game,
  gfx,
  Graphics,
  HorizontalTextAlignment,
  input,
  Input,
  KeyCode,
  Label,
  Node,
  profiler,
  ResolutionPolicy,
  resources,
  Sprite,
  SpriteFrame,
  sys,
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
import {
  createLeaderboardService,
  type LeaderboardService,
} from "../platform/LeaderboardService";
import {
  DEFAULT_RULES,
  type GameMode,
  type RulesConfig,
} from "../core/RulesConfig";
import type { ActivePieceState } from "../core/PieceTypes";
import { CocosFeedbackController } from "./CocosFeedbackController";
import {
  CocosVfxController,
  type SandifyVfxCell,
  type VfxTint,
} from "./CocosVfxController";
import { layoutPiecePreview } from "../rendering/PiecePreviewLayout";
import { PieceVisualAnimator } from "../rendering/PieceVisualAnimator";
import {
  dangerZonePulse,
  sampleDangerZone,
} from "../rendering/DangerZoneEffect";
import {
  fitResponsiveGameLayout,
  type SafeAreaInsets,
} from "../rendering/ResponsiveGameLayout";
import {
  DEFAULT_SAND_PALETTE,
  DEFAULT_SAND_TEXTURE_STRENGTH,
  SandPixelBuffer,
  clearFlashIntensity,
  type PixelBufferUpdateResult,
} from "../rendering/SandPixelBuffer";

const { ccclass, property } = _decorator;
const CLASSIC_MIN_COLOR_COUNT = 2;
const CLASSIC_MAX_COLOR_COUNT = 5;
const CLASSIC_FALL_INTERVALS_MS = [900, 750, 600, 500, 400, 300] as const;
// Paused always shows three buttons; game over does too once a ranking host is
// present. Three across leaves no room for an icon beside a four-character label.
const THREE_BUTTON_MODAL_WIDTH = 82;
const THREE_BUTTON_MODAL_SPACING = 88;
// Two buttons fit four-character labels beside their icons at this wider size.
const TWO_BUTTON_MODAL_WIDTH = 112;
const TWO_BUTTON_MODAL_SPACING = 62;

interface HomeGrainParticle {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly colorIndex: number;
  readonly phase: number;
  readonly speed: number;
  readonly amplitude: number;
  readonly drifting: boolean;
}

type UiButtonState = "default" | "pressed" | "selected" | "disabled";

interface UiButtonVisual {
  readonly node: Node;
  readonly visualNode: Node;
  readonly background: Graphics;
  readonly label: Label;
  width: number;
  readonly height: number;
  readonly cut: number;
  readonly accentDefault: boolean;
  icon: Sprite | null;
  baseState: Exclude<UiButtonState, "pressed">;
}

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
  private readonly textureUploadRegion = new gfx.BufferTextureCopy();
  private scoreLabel: Label | null = null;
  private scoreFeedbackLabel: Label | null = null;
  private scoreFeedbackDecorationSprite: Sprite | null = null;
  private scoreFeedbackLevelFrame: SpriteFrame | null = null;
  private scoreFeedbackChainFrame: SpriteFrame | null = null;
  private scoreFeedbackChainLevel = 0;
  private timeLabel: Label | null = null;
  private chainLabel: Label | null = null;
  private statusPanelNode: Node | null = null;
  private nextPanelNode: Node | null = null;
  private pauseButtonNode: Node | null = null;
  private pauseButtonLabel: Label | null = null;
  private pauseButtonVisual: UiButtonVisual | null = null;
  private pauseIconFrame: SpriteFrame | null = null;
  private resumeIconFrame: SpriteFrame | null = null;
  private restartIconFrame: SpriteFrame | null = null;
  private homeIconFrame: SpriteFrame | null = null;
  private modalOverlayNode: Node | null = null;
  private modalTitleLabel: Label | null = null;
  private modalSummaryLabel: Label | null = null;
  private modalActionNode: Node | null = null;
  private modalActionLabel: Label | null = null;
  private modalActionVisual: UiButtonVisual | null = null;
  private modalHomeNode: Node | null = null;
  private modalHomeVisual: UiButtonVisual | null = null;
  private modalRestartNode: Node | null = null;
  private modalRestartVisual: UiButtonVisual | null = null;
  private modalRankingNode: Node | null = null;
  private modalRankingVisual: UiButtonVisual | null = null;
  private modalHintLabel: Label | null = null;
  private modalBackdrop: Graphics | null = null;
  private modalCardNode: Node | null = null;
  private modalDecorationSprite: Sprite | null = null;
  private modalPauseDecorationFrame: SpriteFrame | null = null;
  private modalGameOverDecorationFrame: SpriteFrame | null = null;
  private homeScreenNode: Node | null = null;
  private homeContentNode: Node | null = null;
  private homeBackground: Graphics | null = null;
  private homeBackgroundSprite: Sprite | null = null;
  private homeLogoSprite: Sprite | null = null;
  private homeHeroNode: Node | null = null;
  private homeHeroSprite: Sprite | null = null;
  private homeGrainFieldNode: Node | null = null;
  private homeGrainGraphics: Graphics | null = null;
  private readonly homeGrainParticles: HomeGrainParticle[] = [];
  private homeStartButtonNode: Node | null = null;
  private homeStartButtonLabel: Label | null = null;
  private homeBestLabel: Label | null = null;
  private homeProgressiveModeGraphics: Graphics | null = null;
  private homeClassicModeGraphics: Graphics | null = null;
  private homeProgressiveModeSprite: Sprite | null = null;
  private homeClassicModeSprite: Sprite | null = null;
  private homeProgressiveDetailsNode: Node | null = null;
  private homeClassicControlsNode: Node | null = null;
  private homeClassicColorValueLabel: Label | null = null;
  private homeClassicSpeedValueLabel: Label | null = null;
  private selectedGameMode: GameMode = "progressive";
  private classicColorCount = DEFAULT_RULES.colorCount;
  private classicSpeedIndex = 2;
  private homeAnimationSeconds = 0;
  private homeHeroImpulse = 0;
  private readonly homeHeroBaseY = 42;
  private feedback!: CocosFeedbackController;
  private leaderboard: LeaderboardService = createLeaderboardService();
  private highScoreStore!: HighScoreStore;
  private highScoreStorage: StringStorage | undefined;
  private gameOverRecorded = false;
  private lastRenderedScore = 0;
  private lastRenderedLevel = 1;
  private lastRenderedColorCount = DEFAULT_RULES.colorCount;
  private lastRenderedChainLevel = 0;
  private scoreFeedbackAmount = 0;
  private scoreFeedbackElapsedSeconds = Number.POSITIVE_INFINITY;
  private scoreFeedbackShowsLevelUp = false;
  private scoreFeedbackShowsChain = false;
  private scorePulseElapsedSeconds = Number.POSITIVE_INFINITY;
  private scoreFeedbackBaseY = 245;
  private scoreFeedbackBaseX = 0;
  private lastRenderedBoardRevision = -1;
  private lastRenderedClearEffect = false;
  private renderedPreviewKey = "";
  private lastFeedbackPhase: GamePhase = "Idle";
  private lastFeedbackLockSequence = 0;
  private readonly pressedKeys = new Set<KeyCode>();
  private gameplayUiAssetsRequested = false;
  private dangerZoneGraphics: Graphics | null = null;
  private dangerZoneTargetIntensity = 0;
  private dangerZoneVisualIntensity = 0;
  private dangerZoneElapsedSeconds = 0;
  private vfxController: CocosVfxController | null = null;

  protected onLoad(): void {
    profiler.hideStats();
    view.setDesignResolutionSize(360, 800, ResolutionPolicy.FIXED_HEIGHT);
    this.classicColorCount = Math.min(
      CLASSIC_MAX_COLOR_COUNT,
      Math.max(CLASSIC_MIN_COLOR_COUNT, Math.round(this.colorCount)),
    );
    this.classicSpeedIndex = this.nearestClassicSpeedIndex(this.normalFallIntervalMs);
    this.ensureRenderers();

    if (this.colorCount >= DEFAULT_SAND_PALETTE.length) {
      throw new RangeError(`colorCount cannot exceed ${DEFAULT_SAND_PALETTE.length - 1}`);
    }
    this.rules = this.createRulesForSelectedMode();
    this.applyResponsiveLayout();
    const globalStorage = (globalThis as { localStorage?: StringStorage }).localStorage;
    this.highScoreStorage = globalStorage;
    this.feedback = new CocosFeedbackController(this.node, globalStorage);
    this.highScoreStore = this.createHighScoreStoreForSelectedMode();
    this.session = new GameSession({ rules: this.rules, mode: this.selectedGameMode });
    this.resetFeedbackState();
    this.runner = new FixedStepRunner({
      fixedHz: this.rules.fixedHz,
      maxFrameDeltaSeconds: 0.25,
      // Two steps still preserve 60 Hz simulation on a 30 FPS display while
      // preventing expensive sand catch-up work from spiraling after a slow frame.
      maxStepsPerFrame: 2,
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

    if (this.dangerZoneGraphics === null && this.sandSprite !== null) {
      const dangerNode = new Node("DangerZoneEffect");
      dangerNode.layer = this.sandSprite.node.layer;
      this.sandSprite.node.addChild(dangerNode);
      dangerNode.addComponent(UITransform).setContentSize(280, 672);
      this.dangerZoneGraphics = dangerNode.addComponent(Graphics);
    }

    if (this.vfxController === null && this.sandSprite !== null) {
      this.vfxController = new CocosVfxController(this.sandSprite.node);
      this.vfxController.load();
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
    this.loadGameplayUiAssets();
  }

  private createNextPiecePanel(): void {
    const panelNode = new Node("NextPiecePanel");
    panelNode.layer = this.node.layer;
    panelNode.setPosition(102, 342);
    this.node.addChild(panelNode);
    this.nextPanelNode = panelNode;
    panelNode.addComponent(UITransform).setContentSize(88, 98);

    const panel = panelNode.addComponent(Graphics);
    this.drawHudPanel(panel, 88, 98, new Color(91, 141, 239, 255));

    const labelNode = new Node("NextLabel");
    labelNode.layer = panelNode.layer;
    labelNode.setPosition(0, 34);
    panelNode.addChild(labelNode);
    labelNode.addComponent(UITransform).setContentSize(76, 20);
    const label = labelNode.addComponent(Label);
    label.string = "下一个";
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
    this.drawHudPanel(panel, 112, 98, new Color(65, 205, 195, 255));

    this.scoreLabel = this.createLabel(panelNode, "ScoreLabel", 0, 23, 100, 32, 14);
    this.scoreLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.scoreLabel.string = "得分  000000";
    this.scoreLabel.color = new Color(238, 243, 255, 255);

    this.timeLabel = this.createLabel(panelNode, "TimeLabel", 0, -9, 100, 28, 13);
    this.timeLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.timeLabel.string = "时间  00:00";
    this.timeLabel.color = new Color(180, 194, 219, 255);

    this.chainLabel = this.createLabel(panelNode, "ChainLabel", 0, -34, 100, 20, 12);
    this.chainLabel.string = "";
    this.chainLabel.color = new Color(255, 209, 92, 255);

    const feedbackDecorationNode = new Node("ScoreFeedbackDecoration");
    feedbackDecorationNode.layer = this.node.layer;
    feedbackDecorationNode.setPosition(0, 245);
    this.node.addChild(feedbackDecorationNode);
    feedbackDecorationNode.addComponent(UITransform).setContentSize(280, 96);
    this.scoreFeedbackDecorationSprite = feedbackDecorationNode.addComponent(Sprite);
    this.scoreFeedbackDecorationSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    feedbackDecorationNode.active = false;

    this.scoreFeedbackLabel = this.createLabel(
      this.node,
      "ScoreFeedback",
      0,
      245,
      260,
      40,
      22,
    );
    this.scoreFeedbackLabel.color = new Color(255, 222, 102, 255);
    this.scoreFeedbackLabel.node.active = false;

    const pauseButton = this.createButton(this.node, "PauseButton", 0, 367, 48, 38, "暂停", true);
    this.pauseButtonNode = pauseButton.node;
    this.pauseButtonLabel = pauseButton.label;
    this.pauseButtonVisual = pauseButton;
    this.createButtonIcon(pauseButton, "PauseButtonIcon", 24, 0);
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
    this.modalCardNode = cardNode;
    cardNode.addComponent(UITransform).setContentSize(286, 300);
    const card = cardNode.addComponent(Graphics);
    card.fillColor = new Color(16, 24, 40, 252);
    this.tracePixelSteppedRect(card, -143, -150, 286, 300, 12);
    card.fill();
    card.fillColor = new Color(9, 23, 40, 138);
    this.tracePixelSteppedRect(card, -137, -144, 274, 288, 8);
    card.fill();

    const decorationNode = new Node("ModalDecorationSprite");
    decorationNode.layer = cardNode.layer;
    cardNode.addChild(decorationNode);
    decorationNode.addComponent(UITransform).setContentSize(286, 300);
    this.modalDecorationSprite = decorationNode.addComponent(Sprite);
    this.modalDecorationSprite.sizeMode = Sprite.SizeMode.CUSTOM;

    this.modalTitleLabel = this.createLabel(cardNode, "ModalTitle", 0, 100, 250, 42, 27);
    this.modalTitleLabel.color = new Color(246, 249, 255, 255);
    this.modalSummaryLabel = this.createLabel(cardNode, "ModalSummary", 0, 28, 240, 96, 15);
    this.modalSummaryLabel.lineHeight = 24;
    this.modalSummaryLabel.color = new Color(194, 207, 230, 255);

    const action = this.createButton(cardNode, "ModalAction", 0, -67, TWO_BUTTON_MODAL_WIDTH, 48, "再来一局");
    this.modalActionNode = action.node;
    this.modalActionLabel = action.label;
    this.modalActionVisual = action;
    this.createButtonIcon(action, "ModalActionIcon", 22, -42);
    action.node.on(Node.EventType.TOUCH_END, this.onModalAction, this);

    // layoutModalButtons owns the row positions; these are placeholders.
    const home = this.createButton(cardNode, "ModalHome", 0, -67, TWO_BUTTON_MODAL_WIDTH, 48, "返回首页");
    this.modalHomeNode = home.node;
    this.modalHomeVisual = home;
    this.createButtonIcon(home, "ModalHomeIcon", 22, -42);
    home.node.on(Node.EventType.TOUCH_END, this.onModalHome, this);
    home.node.active = false;

    const restart = this.createButton(cardNode, "ModalRestart", 0, -67, THREE_BUTTON_MODAL_WIDTH, 48, "重新开始");
    this.modalRestartNode = restart.node;
    this.modalRestartVisual = restart;
    restart.node.on(Node.EventType.TOUCH_END, this.onModalRestart, this);
    restart.node.active = false;

    const ranking = this.createButton(cardNode, "ModalRanking", 0, -67, THREE_BUTTON_MODAL_WIDTH, 48, "排行榜");
    this.modalRankingNode = ranking.node;
    this.modalRankingVisual = ranking;
    ranking.node.on(Node.EventType.TOUCH_END, this.onModalRanking, this);
    ranking.node.active = false;

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

    const backgroundSpriteNode = new Node("HomeBackgroundArt");
    backgroundSpriteNode.layer = homeNode.layer;
    homeNode.addChild(backgroundSpriteNode);
    backgroundSpriteNode.addComponent(UITransform).setContentSize(450, 800);
    this.homeBackgroundSprite = backgroundSpriteNode.addComponent(Sprite);
    this.homeBackgroundSprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const contentNode = new Node("HomeSafeContent");
    contentNode.layer = homeNode.layer;
    homeNode.addChild(contentNode);
    contentNode.addComponent(UITransform).setContentSize(360, 800);
    this.homeContentNode = contentNode;

    const brandNode = new Node("HomeBrand");
    brandNode.layer = contentNode.layer;
    brandNode.setPosition(0, 258);
    contentNode.addChild(brandNode);
    brandNode.addComponent(UITransform).setContentSize(280, 134);
    this.homeLogoSprite = brandNode.addComponent(Sprite);
    this.homeLogoSprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const grainFieldNode = new Node("HomeHeroGrainField");
    grainFieldNode.layer = contentNode.layer;
    grainFieldNode.setPosition(0, this.homeHeroBaseY);
    contentNode.addChild(grainFieldNode);
    grainFieldNode.addComponent(UITransform).setContentSize(300, 250);
    this.homeGrainFieldNode = grainFieldNode;
    this.homeGrainGraphics = grainFieldNode.addComponent(Graphics);
    this.createHomeGrainParticles();
    this.drawHomeGrainField();

    const heroNode = new Node("HomeHero");
    heroNode.layer = contentNode.layer;
    heroNode.setPosition(0, this.homeHeroBaseY);
    contentNode.addChild(heroNode);
    heroNode.addComponent(UITransform).setContentSize(224, 196);
    this.homeHeroNode = heroNode;
    this.homeHeroSprite = heroNode.addComponent(Sprite);
    this.homeHeroSprite.sizeMode = Sprite.SizeMode.CUSTOM;
    heroNode.on(Node.EventType.TOUCH_END, this.onHomeHeroTapped, this);

    this.homeProgressiveModeGraphics = this.createHomeModeButton(
      contentNode,
      "ProgressiveMode",
      -80,
      "进阶模式",
      "升级 · 解锁颜色",
      this.onProgressiveModeSelected,
    );
    this.homeClassicModeGraphics = this.createHomeModeButton(
      contentNode,
      "ClassicMode",
      80,
      "经典休闲",
      "固定难度 · 自定义",
      this.onClassicModeSelected,
    );
    this.createHomeDifficultyPanel(contentNode);

    this.homeBestLabel = this.createLabel(contentNode, "HomeBest", 0, -253, 300, 30, 15);
    this.homeBestLabel.color = new Color(190, 209, 233, 255);

    const start = this.createHomeStartButton(contentNode);
    this.homeStartButtonNode = start.node;
    this.homeStartButtonLabel = start.label;
    start.label.fontSize = 21;
    start.label.lineHeight = 27;
    start.node.on(Node.EventType.TOUCH_END, this.onHomeStartButton, this);

    const hint = this.createLabel(contentNode, "HomeHint", 0, -345, 300, 22, 11);
    hint.string = "选择模式后点击开始";
    hint.color = new Color(111, 142, 177, 255);

    const version = this.createLabel(contentNode, "HomeVersion", 0, -374, 180, 20, 10);
    version.string = "落沙  ·  测试版 0.1";
    version.color = new Color(70, 99, 132, 255);
    this.refreshHomeModeControls();
    this.loadHomeArtAssets();
  }

  private createHomeModeButton(
    parent: Node,
    name: string,
    x: number,
    titleText: string,
    subtitleText: string,
    handler: () => void,
  ): Graphics {
    const node = new Node(name);
    node.layer = parent.layer;
    node.setPosition(x, -105);
    parent.addChild(node);
    node.addComponent(UITransform).setContentSize(150, 72);
    const graphics = node.addComponent(Graphics);

    const iconNode = new Node(`${name}Icon`);
    iconNode.layer = node.layer;
    iconNode.setPosition(-47, 0);
    node.addChild(iconNode);
    iconNode.addComponent(UITransform).setContentSize(50, 50);
    const icon = iconNode.addComponent(Sprite);
    icon.sizeMode = Sprite.SizeMode.CUSTOM;
    if (name === "ProgressiveMode") {
      this.homeProgressiveModeSprite = icon;
    } else {
      this.homeClassicModeSprite = icon;
    }

    const title = this.createLabel(node, `${name}Title`, 25, 10, 92, 25, 15);
    title.string = titleText;
    title.color = new Color(239, 247, 255, 255);
    const subtitle = this.createLabel(node, `${name}Subtitle`, 25, -14, 94, 20, 9);
    subtitle.string = subtitleText;
    subtitle.color = new Color(143, 169, 202, 255);
    node.on(Node.EventType.TOUCH_END, handler, this);
    return graphics;
  }

  private loadHomeArtAssets(): void {
    this.loadHomeSpriteFrame("art/home/home-background", this.homeBackgroundSprite);
    this.loadHomeSpriteFrame("art/home/home-logo", this.homeLogoSprite);
    this.loadHomeSpriteFrame("art/home/home-hero", this.homeHeroSprite);
    this.loadHomeSpriteFrame("art/mode-icons/mode-progressive", this.homeProgressiveModeSprite);
    this.loadHomeSpriteFrame("art/mode-icons/mode-classic", this.homeClassicModeSprite);
  }

  private loadHomeSpriteFrame(path: string, sprite: Sprite | null): void {
    if (sprite === null) {
      return;
    }
    resources.load(`${path}/spriteFrame`, SpriteFrame, (error, frame) => {
      if (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Sandfall] Failed to load home art: ${path} · ${message}`);
        return;
      }
      sprite.spriteFrame = frame;
    });
  }

  private loadGameplayUiAssets(): void {
    if (this.gameplayUiAssetsRequested) {
      return;
    }
    this.gameplayUiAssetsRequested = true;
    this.loadGameplaySpriteFrame("art/ui/icons/pause", (frame) => {
      this.pauseIconFrame = frame;
      this.syncPhaseUiArt(this.session?.phase ?? "Idle");
    });
    this.loadGameplaySpriteFrame("art/ui/icons/resume", (frame) => {
      this.resumeIconFrame = frame;
      this.syncPhaseUiArt(this.session?.phase ?? "Idle");
    });
    this.loadGameplaySpriteFrame("art/ui/icons/restart", (frame) => {
      this.restartIconFrame = frame;
      this.syncPhaseUiArt(this.session?.phase ?? "Idle");
    });
    this.loadGameplaySpriteFrame("art/ui/icons/home", (frame) => {
      this.homeIconFrame = frame;
      this.syncPhaseUiArt(this.session?.phase ?? "Idle");
    });
    this.loadGameplaySpriteFrame("art/ui/modal/pause", (frame) => {
      this.modalPauseDecorationFrame = frame;
      this.syncPhaseUiArt(this.session?.phase ?? "Idle");
    });
    this.loadGameplaySpriteFrame("art/ui/modal/game-over", (frame) => {
      this.modalGameOverDecorationFrame = frame;
      this.syncPhaseUiArt(this.session?.phase ?? "Idle");
    });
    this.loadGameplaySpriteFrame("art/ui/feedback/level-up", (frame) => {
      this.scoreFeedbackLevelFrame = frame;
      this.syncScoreFeedbackDecoration(1);
    });
    this.loadGameplaySpriteFrame("art/ui/feedback/chain-mask", (frame) => {
      this.scoreFeedbackChainFrame = frame;
      this.syncScoreFeedbackDecoration(1);
    });
  }

  private loadGameplaySpriteFrame(
    path: string,
    onLoaded: (frame: SpriteFrame) => void,
  ): void {
    resources.load(`${path}/spriteFrame`, SpriteFrame, (error, frame) => {
      if (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Sandfall] Failed to load gameplay UI art: ${path} · ${message}`);
        return;
      }
      onLoaded(frame);
    });
  }

  private syncPhaseUiArt(phase: GamePhase): void {
    const paused = phase === "Paused";
    const gameOver = phase === "GameOver";
    const pauseFrame = paused ? this.resumeIconFrame : this.pauseIconFrame;
    if (this.pauseButtonVisual !== null) {
      const icon = this.pauseButtonVisual.icon;
      if (icon !== null) {
        icon.spriteFrame = pauseFrame;
        icon.node.active = pauseFrame !== null;
      }
      this.pauseButtonVisual.label.node.active = pauseFrame === null;
    }

    const showRanking = gameOver && this.leaderboard.available;
    this.layoutModalButtons(paused, showRanking);

    // A three-button row is too narrow for an icon beside its label, so those
    // rows run on text alone.
    const threeAcross = paused || showRanking;
    const actionFrame = threeAcross || !gameOver ? null : this.restartIconFrame;
    this.applyButtonIconLayout(this.modalActionVisual, actionFrame, 12, 80);
    this.applyButtonIconLayout(
      this.modalHomeVisual,
      threeAcross ? null : this.homeIconFrame,
      12,
      80,
    );

    if (this.modalDecorationSprite !== null) {
      const decorationFrame = paused
        ? this.modalPauseDecorationFrame
        : gameOver
          ? this.modalGameOverDecorationFrame
          : null;
      this.modalDecorationSprite.spriteFrame = decorationFrame;
      this.modalDecorationSprite.node.active = decorationFrame !== null;
    }
  }

  private layoutModalButtons(paused: boolean, showRanking: boolean): void {
    if (this.modalRestartNode !== null) {
      this.modalRestartNode.active = paused;
    }
    if (this.modalRankingNode !== null) {
      this.modalRankingNode.active = showRanking;
    }
    if (this.modalHomeNode !== null) {
      this.modalHomeNode.active = true;
    }
    if (paused || showRanking) {
      this.resizeButton(this.modalActionVisual, THREE_BUTTON_MODAL_WIDTH);
      this.resizeButton(this.modalHomeVisual, THREE_BUTTON_MODAL_WIDTH);
      this.modalActionNode?.setPosition(-THREE_BUTTON_MODAL_SPACING, -67);
      this.modalRestartNode?.setPosition(0, -67);
      this.modalRankingNode?.setPosition(0, -67);
      this.modalHomeNode?.setPosition(THREE_BUTTON_MODAL_SPACING, -67);
      return;
    }
    this.resizeButton(this.modalActionVisual, TWO_BUTTON_MODAL_WIDTH);
    this.resizeButton(this.modalHomeVisual, TWO_BUTTON_MODAL_WIDTH);
    this.modalActionNode?.setPosition(-TWO_BUTTON_MODAL_SPACING, -67);
    this.modalHomeNode?.setPosition(TWO_BUTTON_MODAL_SPACING, -67);
  }

  private resizeButton(button: UiButtonVisual | null, width: number): void {
    if (button === null || button.width === width) {
      return;
    }
    button.width = width;
    button.node.getComponent(UITransform)?.setContentSize(width, button.height);
    button.visualNode.getComponent(UITransform)?.setContentSize(width, button.height);
    this.setButtonVisualState(button, button.baseState);
  }

  private applyButtonIconLayout(
    button: UiButtonVisual | null,
    frame: SpriteFrame | null,
    labelX: number,
    labelWidth: number,
  ): void {
    if (button === null || button.icon === null) {
      return;
    }
    button.icon.spriteFrame = frame;
    button.icon.node.active = frame !== null;
    const labelTransform = button.label.node.getComponent(UITransform);
    if (frame === null) {
      button.label.node.setPosition(0, 0);
      labelTransform?.setContentSize(button.width - 8, button.height - 4);
    } else {
      button.label.node.setPosition(labelX, 0);
      labelTransform?.setContentSize(labelWidth, button.height - 4);
    }
  }

  private createHomeGrainParticles(): void {
    this.homeGrainParticles.length = 0;
    const noise = (index: number, salt: number): number => {
      const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
      return value - Math.floor(value);
    };

    // A persistent uneven halo keeps the reference screen's dense suspended-sand
    // atmosphere without creating one Cocos node per grain.
    for (let index = 0; index < 42; index += 1) {
      const angle = index * 2.399963 + (noise(index, 1) - 0.5) * 0.5;
      const radiusX = 92 + noise(index, 2) * 46;
      const radiusY = 64 + noise(index, 3) * 42;
      this.homeGrainParticles.push({
        x: Math.cos(angle) * radiusX,
        y: Math.sin(angle) * radiusY,
        size: 1.8 + noise(index, 4) * 3.1,
        colorIndex: 1 + Math.floor(noise(index, 5) * 4),
        phase: noise(index, 6) * Math.PI * 2,
        speed: 0.45 + noise(index, 7) * 0.65,
        amplitude: 1.5 + noise(index, 8) * 4.5,
        drifting: false,
      });
    }

    for (let index = 0; index < 12; index += 1) {
      const seedIndex = index + 64;
      this.homeGrainParticles.push({
        x: -132 + noise(seedIndex, 1) * 264,
        y: -112 + noise(seedIndex, 2) * 224,
        size: 2.1 + noise(seedIndex, 3) * 3.4,
        colorIndex: 1 + Math.floor(noise(seedIndex, 4) * 4),
        phase: noise(seedIndex, 5) * Math.PI * 2,
        speed: 0.55 + noise(seedIndex, 6) * 0.7,
        amplitude: 4 + noise(seedIndex, 7) * 8,
        drifting: true,
      });
    }
  }

  private drawHomeGrainField(): void {
    const graphics = this.homeGrainGraphics;
    if (graphics === null) {
      return;
    }
    graphics.clear();
    for (let colorIndex = 1; colorIndex <= 4; colorIndex += 1) {
      const color = DEFAULT_SAND_PALETTE[colorIndex];
      if (color === undefined) {
        continue;
      }
      graphics.fillColor = new Color(color.r, color.g, color.b, 218);
      for (const grain of this.homeGrainParticles) {
        if (grain.colorIndex !== colorIndex) {
          continue;
        }
        const time = this.homeAnimationSeconds;
        const motion = time * grain.speed + grain.phase;
        let x: number;
        let y: number;
        if (grain.drifting) {
          const progress = (time * grain.speed * 0.065 + grain.phase / (Math.PI * 2)) % 1;
          x = grain.x + Math.sin(motion * 1.7) * grain.amplitude;
          y = 112 - progress * 224;
        } else {
          x = grain.x + Math.sin(motion) * grain.amplitude;
          y = grain.y + Math.cos(motion * 0.83) * grain.amplitude * 0.7;
        }
        const burst = this.homeHeroImpulse;
        x += Math.sign(x || 1) * burst * (grain.drifting ? 11 : 7);
        y += burst * (grain.drifting ? 8 : 4);
        const twinkle = 0.9 + Math.sin(motion * 1.35) * 0.1;
        const size = grain.size * twinkle * (1 + burst * 0.18);
        graphics.roundRect(x - size / 2, y - size / 2, size, size, Math.min(1, size * 0.22));
      }
      graphics.fill();
    }
  }

  private createHomeDifficultyPanel(parent: Node): void {
    const panelNode = new Node("HomeDifficultyPanel");
    panelNode.layer = parent.layer;
    panelNode.setPosition(0, -191);
    parent.addChild(panelNode);
    panelNode.addComponent(UITransform).setContentSize(310, 88);
    const panel = panelNode.addComponent(Graphics);
    panel.fillColor = new Color(9, 23, 40, 238);
    this.tracePixelChamferRect(panel, -155, -44, 310, 88, 10);
    panel.fill();
    panel.strokeColor = new Color(62, 97, 139, 230);
    panel.lineWidth = 2;
    this.tracePixelChamferRect(panel, -154, -43, 308, 86, 9);
    panel.stroke();
    panel.strokeColor = new Color(25, 55, 88, 230);
    panel.lineWidth = 1;
    this.tracePixelChamferRect(panel, -150, -39, 300, 78, 7);
    panel.stroke();
    this.drawPixelCornerGrains(panel, -155, -44, 310, 88, new Color(60, 207, 210, 255));

    const progressiveDetails = new Node("ProgressiveDetails");
    progressiveDetails.layer = panelNode.layer;
    panelNode.addChild(progressiveDetails);
    progressiveDetails.addComponent(UITransform).setContentSize(286, 72);
    this.homeProgressiveDetailsNode = progressiveDetails;
    const progressiveLabel = this.createLabel(
      progressiveDetails,
      "ProgressiveDetailsLabel",
      0,
      0,
      282,
      64,
      13,
    );
    progressiveLabel.string = "每 5 次消除升级并加速\n等级 4 解锁第 5 色  ·  等级 6 速度封顶";
    progressiveLabel.lineHeight = 23;
    progressiveLabel.color = new Color(167, 205, 232, 255);

    const classicControls = new Node("ClassicControls");
    classicControls.layer = panelNode.layer;
    panelNode.addChild(classicControls);
    classicControls.addComponent(UITransform).setContentSize(300, 80);
    this.homeClassicControlsNode = classicControls;

    const colorCaption = this.createLabel(
      classicControls,
      "ClassicColorCaption",
      -96,
      20,
      82,
      26,
      13,
    );
    colorCaption.string = "颜色数量";
    colorCaption.horizontalAlign = HorizontalTextAlignment.LEFT;
    colorCaption.color = new Color(80, 205, 203, 255);
    this.homeClassicColorValueLabel = this.createLabel(
      classicControls,
      "ClassicColorValue",
      -8,
      20,
      92,
      26,
      15,
    );
    this.homeClassicColorValueLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.homeClassicColorValueLabel.color = new Color(239, 247, 255, 255);
    this.createClassicAdjustButtons(classicControls, 20, this.onClassicColorDecrease, this.onClassicColorIncrease);

    const speedCaption = this.createLabel(
      classicControls,
      "ClassicSpeedCaption",
      -96,
      -20,
      82,
      26,
      13,
    );
    speedCaption.string = "下落速度";
    speedCaption.horizontalAlign = HorizontalTextAlignment.LEFT;
    speedCaption.color = new Color(80, 205, 203, 255);
    this.homeClassicSpeedValueLabel = this.createLabel(
      classicControls,
      "ClassicSpeedValue",
      -8,
      -20,
      92,
      26,
      14,
    );
    this.homeClassicSpeedValueLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
    this.homeClassicSpeedValueLabel.color = new Color(239, 247, 255, 255);
    this.createClassicAdjustButtons(classicControls, -20, this.onClassicSpeedDecrease, this.onClassicSpeedIncrease);
  }

  private createClassicAdjustButtons(
    parent: Node,
    y: number,
    decrease: () => void,
    increase: () => void,
  ): void {
    const minus = this.createPixelAdjustButton(parent, `Decrease${y}`, 74, y, "−");
    minus.label.fontSize = 18;
    minus.node.on(Node.EventType.TOUCH_END, decrease, this);
    const plus = this.createPixelAdjustButton(parent, `Increase${y}`, 121, y, "+");
    plus.label.fontSize = 18;
    plus.node.on(Node.EventType.TOUCH_END, increase, this);
  }

  private refreshHomeModeControls(): void {
    this.drawHomeModeCard(
      this.homeProgressiveModeGraphics,
      this.selectedGameMode === "progressive",
      new Color(65, 205, 195, 255),
    );
    this.drawHomeModeCard(
      this.homeClassicModeGraphics,
      this.selectedGameMode === "classic",
      new Color(255, 196, 75, 255),
    );
    if (this.homeProgressiveDetailsNode !== null) {
      this.homeProgressiveDetailsNode.active = this.selectedGameMode === "progressive";
    }
    if (this.homeClassicControlsNode !== null) {
      this.homeClassicControlsNode.active = this.selectedGameMode === "classic";
    }
    if (this.homeClassicColorValueLabel !== null) {
      this.homeClassicColorValueLabel.string = `${this.classicColorCount}`;
    }
    if (this.homeClassicSpeedValueLabel !== null) {
      const interval = CLASSIC_FALL_INTERVALS_MS[this.classicSpeedIndex];
      this.homeClassicSpeedValueLabel.string = `${this.classicSpeedIndex + 1}/6 · ${interval}毫秒`;
    }
    if (this.homeStartButtonLabel !== null) {
      this.homeStartButtonLabel.string = this.selectedGameMode === "progressive"
        ? "开始进阶模式"
        : "开始经典休闲";
    }
  }

  private drawHomeModeCard(
    graphics: Graphics | null,
    selected: boolean,
    accent: Color,
  ): void {
    if (graphics === null) {
      return;
    }
    graphics.clear();
    graphics.fillColor = selected
      ? new Color(accent.r, accent.g, accent.b, 48)
      : new Color(10, 25, 43, 238);
    this.tracePixelChamferRect(graphics, -75, -36, 150, 72, 9);
    graphics.fill();
    graphics.strokeColor = selected
      ? accent
      : new Color(accent.r, accent.g, accent.b, 145);
    graphics.lineWidth = selected ? 2.5 : 1.5;
    this.tracePixelChamferRect(graphics, -74, -35, 148, 70, 8);
    graphics.stroke();
    graphics.strokeColor = selected
      ? new Color(255, 240, 190, 185)
      : new Color(35, 67, 102, 180);
    graphics.lineWidth = 1;
    this.tracePixelChamferRect(graphics, -70, -31, 140, 62, 6);
    graphics.stroke();
    this.drawPixelCornerGrains(graphics, -75, -36, 150, 72, accent, selected ? 255 : 150);
  }

  private drawHudPanel(
    graphics: Graphics,
    width: number,
    height: number,
    accent: Color,
  ): void {
    const left = -width / 2;
    const bottom = -height / 2;
    graphics.clear();
    graphics.fillColor = new Color(12, 18, 31, 245);
    this.tracePixelSteppedRect(graphics, left, bottom, width, height, 8);
    graphics.fill();

    graphics.strokeColor = new Color(78, 115, 152, 255);
    graphics.lineWidth = 2;
    this.tracePixelSteppedRect(graphics, left + 1, bottom + 1, width - 2, height - 2, 7);
    graphics.stroke();

    graphics.strokeColor = new Color(55, 83, 115, 210);
    graphics.lineWidth = 1;
    this.tracePixelSteppedRect(graphics, left + 3, bottom + 3, width - 6, height - 6, 5);
    graphics.stroke();

    graphics.strokeColor = accent;
    graphics.lineWidth = 2;
    graphics.moveTo(left + 14, bottom + height - 5);
    graphics.lineTo(left + Math.min(46, width * 0.48), bottom + height - 5);
    graphics.stroke();

    graphics.fillColor = accent;
    graphics.rect(left + 6, bottom + height - 12, 2, 2);
    graphics.rect(left + width - 8, bottom + 7, 2, 2);
    graphics.fill();
  }

  private tracePixelSteppedRect(
    graphics: Graphics,
    left: number,
    bottom: number,
    width: number,
    height: number,
    cut: number,
  ): void {
    const right = left + width;
    const top = bottom + height;
    const half = cut / 2;
    graphics.moveTo(left + cut, bottom);
    graphics.lineTo(right - cut, bottom);
    graphics.lineTo(right - half, bottom);
    graphics.lineTo(right - half, bottom + half);
    graphics.lineTo(right, bottom + half);
    graphics.lineTo(right, bottom + cut);
    graphics.lineTo(right, top - cut);
    graphics.lineTo(right, top - half);
    graphics.lineTo(right - half, top - half);
    graphics.lineTo(right - half, top);
    graphics.lineTo(right - cut, top);
    graphics.lineTo(left + cut, top);
    graphics.lineTo(left + half, top);
    graphics.lineTo(left + half, top - half);
    graphics.lineTo(left, top - half);
    graphics.lineTo(left, top - cut);
    graphics.lineTo(left, bottom + cut);
    graphics.lineTo(left, bottom + half);
    graphics.lineTo(left + half, bottom + half);
    graphics.lineTo(left + half, bottom);
    graphics.close();
  }

  private tracePixelChamferRect(
    graphics: Graphics,
    left: number,
    bottom: number,
    width: number,
    height: number,
    cut: number,
  ): void {
    graphics.moveTo(left + cut, bottom);
    graphics.lineTo(left + width - cut, bottom);
    graphics.lineTo(left + width, bottom + cut);
    graphics.lineTo(left + width, bottom + height - cut);
    graphics.lineTo(left + width - cut, bottom + height);
    graphics.lineTo(left + cut, bottom + height);
    graphics.lineTo(left, bottom + height - cut);
    graphics.lineTo(left, bottom + cut);
    graphics.close();
  }

  private drawPixelCornerGrains(
    graphics: Graphics,
    left: number,
    bottom: number,
    width: number,
    height: number,
    accent: Color,
    alpha = 210,
  ): void {
    const right = left + width;
    const top = bottom + height;
    graphics.fillColor = new Color(accent.r, accent.g, accent.b, alpha);
    graphics.rect(left + 8, top - 12, 4, 4);
    graphics.rect(left + 13, top - 18, 3, 3);
    graphics.rect(right - 12, bottom + 8, 4, 4);
    graphics.rect(right - 17, bottom + 13, 3, 3);
    graphics.fill();
    graphics.fillColor = new Color(69, 126, 214, Math.min(alpha, 190));
    graphics.rect(left + 8, bottom + 9, 3, 3);
    graphics.rect(right - 12, top - 13, 3, 3);
    graphics.fill();
  }

  private onProgressiveModeSelected(): void {
    this.feedback.unlock();
    if (this.selectedGameMode !== "progressive") {
      this.selectedGameMode = "progressive";
      this.highScoreStore = this.createHighScoreStoreForSelectedMode();
      this.feedback.trigger("ui");
      this.refreshHomeModeControls();
    }
  }

  private onClassicModeSelected(): void {
    this.feedback.unlock();
    if (this.selectedGameMode !== "classic") {
      this.selectedGameMode = "classic";
      this.highScoreStore = this.createHighScoreStoreForSelectedMode();
      this.feedback.trigger("ui");
      this.refreshHomeModeControls();
    }
  }

  private onClassicColorDecrease(): void {
    this.feedback.unlock();
    const next = Math.max(CLASSIC_MIN_COLOR_COUNT, this.classicColorCount - 1);
    if (next !== this.classicColorCount) {
      this.classicColorCount = next;
      this.highScoreStore = this.createHighScoreStoreForSelectedMode();
      this.feedback.trigger("ui");
      this.refreshHomeModeControls();
    }
  }

  private onClassicColorIncrease(): void {
    this.feedback.unlock();
    const next = Math.min(CLASSIC_MAX_COLOR_COUNT, this.classicColorCount + 1);
    if (next !== this.classicColorCount) {
      this.classicColorCount = next;
      this.highScoreStore = this.createHighScoreStoreForSelectedMode();
      this.feedback.trigger("ui");
      this.refreshHomeModeControls();
    }
  }

  private onClassicSpeedDecrease(): void {
    this.feedback.unlock();
    const next = Math.max(0, this.classicSpeedIndex - 1);
    if (next !== this.classicSpeedIndex) {
      this.classicSpeedIndex = next;
      this.highScoreStore = this.createHighScoreStoreForSelectedMode();
      this.feedback.trigger("ui");
      this.refreshHomeModeControls();
    }
  }

  private onClassicSpeedIncrease(): void {
    this.feedback.unlock();
    const next = Math.min(CLASSIC_FALL_INTERVALS_MS.length - 1, this.classicSpeedIndex + 1);
    if (next !== this.classicSpeedIndex) {
      this.classicSpeedIndex = next;
      this.highScoreStore = this.createHighScoreStoreForSelectedMode();
      this.feedback.trigger("ui");
      this.refreshHomeModeControls();
    }
  }

  private nearestClassicSpeedIndex(intervalMs: number): number {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    CLASSIC_FALL_INTERVALS_MS.forEach((candidate, index) => {
      const distance = Math.abs(candidate - intervalMs);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });
    return closestIndex;
  }

  private createRulesForSelectedMode(): Readonly<RulesConfig> {
    const progressive = this.selectedGameMode === "progressive";
    const classicInterval = CLASSIC_FALL_INTERVALS_MS[this.classicSpeedIndex]
      ?? DEFAULT_RULES.normalFallIntervalMs;
    return Object.freeze({
      ...DEFAULT_RULES,
      colorCount: progressive ? 4 : this.classicColorCount,
      grainsPerCell: this.grainsPerCell,
      sandSubsteps: this.sandSubsteps,
      lockDelayMs: this.lockDelayMs,
      normalFallIntervalMs: progressive ? DEFAULT_RULES.normalFallIntervalMs : classicInterval,
      clearEffectDurationMs: this.clearEffectDurationMs,
    });
  }

  private createHighScoreStoreForSelectedMode(): HighScoreStore {
    if (this.selectedGameMode === "progressive") {
      return new HighScoreStore(this.highScoreStorage);
    }
    const interval = CLASSIC_FALL_INTERVALS_MS[this.classicSpeedIndex]
      ?? DEFAULT_RULES.normalFallIntervalMs;
    const storageKey = `sandfall.high-score.classic.c${this.classicColorCount}.s${interval}.v1`;
    return new HighScoreStore(this.highScoreStorage, storageKey);
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

  private createPixelAdjustButton(
    parent: Node,
    name: string,
    x: number,
    y: number,
    text: string,
  ): { readonly node: Node; readonly label: Label } {
    const width = 42;
    const height = 30;
    const buttonNode = new Node(name);
    buttonNode.layer = parent.layer;
    buttonNode.setPosition(x, y);
    parent.addChild(buttonNode);
    buttonNode.addComponent(UITransform).setContentSize(width, height);
    const background = buttonNode.addComponent(Graphics);

    background.fillColor = new Color(30, 70, 126, 255);
    this.tracePixelChamferRect(background, -width / 2, -height / 2, width, height, 5);
    background.fill();
    background.strokeColor = new Color(88, 151, 237, 255);
    background.lineWidth = 2;
    this.tracePixelChamferRect(background, -width / 2 + 1, -height / 2 + 1, width - 2, height - 2, 4);
    background.stroke();
    background.strokeColor = new Color(147, 196, 255, 120);
    background.lineWidth = 1;
    this.tracePixelChamferRect(background, -width / 2 + 4, -height / 2 + 4, width - 8, height - 8, 2);
    background.stroke();
    background.fillColor = new Color(116, 191, 255, 230);
    background.rect(-width / 2 + 6, height / 2 - 7, 4, 2);
    background.rect(width / 2 - 8, -height / 2 + 5, 3, 3);
    background.fill();

    const label = this.createLabel(buttonNode, `${name}Label`, 0, 0, width - 8, height - 4, 18);
    label.string = text;
    label.color = new Color(244, 250, 255, 255);
    return { node: buttonNode, label };
  }

  private createHomeStartButton(parent: Node): { readonly node: Node; readonly label: Label } {
    const width = 266;
    const height = 60;
    const buttonNode = new Node("HomeStartButton");
    buttonNode.layer = parent.layer;
    buttonNode.setPosition(0, -306);
    parent.addChild(buttonNode);
    buttonNode.addComponent(UITransform).setContentSize(width, height);
    const background = buttonNode.addComponent(Graphics);

    // Dark gold outer body and two stepped outlines create the chunky pixel frame.
    background.fillColor = new Color(105, 63, 0, 255);
    this.tracePixelChamferRect(background, -width / 2, -height / 2, width, height, 10);
    background.fill();
    background.strokeColor = new Color(255, 220, 69, 255);
    background.lineWidth = 3;
    this.tracePixelChamferRect(background, -width / 2 + 1.5, -height / 2 + 1.5, width - 3, height - 3, 9);
    background.stroke();

    background.fillColor = new Color(247, 172, 14, 255);
    this.tracePixelChamferRect(background, -width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 6);
    background.fill();
    background.strokeColor = new Color(255, 235, 112, 255);
    background.lineWidth = 1.5;
    this.tracePixelChamferRect(background, -width / 2 + 8, -height / 2 + 8, width - 16, height - 16, 5);
    background.stroke();

    // A few broad tonal bands keep the gold from reading as a flat UI rectangle.
    background.fillColor = new Color(255, 210, 46, 90);
    background.rect(-width / 2 + 13, 8, width - 26, 12);
    background.fill();
    background.fillColor = new Color(177, 102, 0, 58);
    background.rect(-width / 2 + 13, -21, width - 26, 9);
    background.fill();

    const sandColors = [
      new Color(255, 232, 121, 190),
      new Color(255, 202, 36, 220),
      new Color(209, 124, 0, 175),
      new Color(255, 246, 185, 170),
    ];
    const noise = (index: number, salt: number): number => {
      const value = Math.sin((index + 1) * 17.213 + salt * 43.117) * 19341.177;
      return value - Math.floor(value);
    };
    for (let colorIndex = 0; colorIndex < sandColors.length; colorIndex += 1) {
      const sandColor = sandColors[colorIndex];
      if (sandColor === undefined) {
        continue;
      }
      background.fillColor = sandColor;
      for (let index = colorIndex; index < 108; index += sandColors.length) {
        const x = -width / 2 + 14 + noise(index, 1) * (width - 28);
        const y = -height / 2 + 12 + noise(index, 2) * (height - 24);
        const size = 1 + Math.floor(noise(index, 3) * 2.6);
        background.rect(Math.round(x), Math.round(y), size, size);
      }
      background.fill();
    }

    // Pixel chips at the corners echo the reference button's crumbling sand edges.
    background.fillColor = new Color(58, 40, 5, 225);
    background.rect(-width / 2 + 13, height / 2 - 16, 5, 5);
    background.rect(-width / 2 + 19, height / 2 - 12, 3, 3);
    background.rect(width / 2 - 18, height / 2 - 16, 5, 5);
    background.rect(width / 2 - 22, height / 2 - 11, 3, 3);
    background.fill();
    background.fillColor = new Color(255, 246, 174, 255);
    background.rect(-width / 2 + 11, -height / 2 + 10, 4, 4);
    background.rect(width / 2 - 15, -height / 2 + 10, 4, 4);
    background.fill();

    const label = this.createLabel(buttonNode, "HomeStartButtonLabel", 0, 0, width - 28, height - 8, 22);
    label.string = "开始进阶模式";
    label.lineHeight = 28;
    label.color = new Color(48, 34, 4, 255);
    return { node: buttonNode, label };
  }

  private createButton(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    accentDefault = false,
  ): UiButtonVisual {
    const buttonNode = new Node(name);
    buttonNode.layer = parent.layer;
    buttonNode.setPosition(x, y);
    parent.addChild(buttonNode);
    buttonNode.addComponent(UITransform).setContentSize(width, height);

    const visualNode = new Node(`${name}Visual`);
    visualNode.layer = buttonNode.layer;
    buttonNode.addChild(visualNode);
    visualNode.addComponent(UITransform).setContentSize(width, height);
    const background = visualNode.addComponent(Graphics);

    const label = this.createLabel(visualNode, `${name}Label`, 0, 0, width - 8, height - 4, 14);
    label.string = text;
    const button: UiButtonVisual = {
      node: buttonNode,
      visualNode,
      background,
      label,
      width,
      height,
      cut: height <= 38 ? 6 : 8,
      accentDefault,
      icon: null,
      baseState: "default",
    };
    this.setButtonVisualState(button, "default");

    buttonNode.on(Node.EventType.TOUCH_START, () => {
      if (button.baseState !== "disabled") {
        this.setButtonVisualState(button, "pressed");
      }
    });
    buttonNode.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => {
      if (button.baseState === "disabled") {
        return;
      }
      const transform = buttonNode.getComponent(UITransform);
      const inside = transform?.hitTest(event.getUILocation()) ?? false;
      this.setButtonVisualState(button, inside ? "pressed" : button.baseState);
    });
    const restore = (): void => this.setButtonVisualState(button, button.baseState);
    buttonNode.on(Node.EventType.TOUCH_END, restore);
    buttonNode.on(Node.EventType.TOUCH_CANCEL, restore);
    return button;
  }

  private createButtonIcon(
    button: UiButtonVisual,
    name: string,
    size: number,
    x: number,
  ): Sprite {
    const iconNode = new Node(name);
    iconNode.layer = button.visualNode.layer;
    iconNode.setPosition(x, 0);
    button.visualNode.addChild(iconNode);
    iconNode.addComponent(UITransform).setContentSize(size, size);
    const icon = iconNode.addComponent(Sprite);
    icon.sizeMode = Sprite.SizeMode.CUSTOM;
    iconNode.active = false;
    button.icon = icon;
    this.setButtonVisualState(button, button.baseState);
    return icon;
  }

  private setButtonVisualState(button: UiButtonVisual, state: UiButtonState): void {
    if (state !== "pressed") {
      button.baseState = state;
    }
    const disabled = state === "disabled";
    const fill = state === "pressed"
      ? new Color(11, 27, 44, 255)
      : state === "selected"
        ? new Color(16, 42, 53, 255)
        : disabled
          ? new Color(12, 18, 31, 107)
          : new Color(9, 23, 40, 255);
    const border = state === "pressed" || state === "selected" || (state === "default" && button.accentDefault)
      ? new Color(65, 205, 195, disabled ? 107 : 255)
      : disabled
        ? new Color(55, 83, 115, 107)
        : new Color(78, 115, 152, 255);
    const content = state === "pressed"
      ? new Color(238, 243, 255, 255)
      : state === "selected"
        ? new Color(65, 205, 195, 255)
        : state === "default" && button.accentDefault
          ? new Color(65, 205, 195, 255)
        : disabled
          ? new Color(111, 142, 177, 107)
          : new Color(180, 194, 219, 255);
    const inner = disabled
      ? new Color(55, 83, 115, 82)
      : new Color(55, 83, 115, 205);
    const graphics = button.background;
    const left = -button.width / 2;
    const bottom = -button.height / 2;
    graphics.clear();
    graphics.fillColor = fill;
    this.tracePixelSteppedRect(
      graphics,
      left,
      bottom,
      button.width,
      button.height,
      button.cut,
    );
    graphics.fill();
    graphics.strokeColor = border;
    graphics.lineWidth = disabled ? 1 : 2;
    this.tracePixelSteppedRect(
      graphics,
      left + 1,
      bottom + 1,
      button.width - 2,
      button.height - 2,
      button.cut - 1,
    );
    graphics.stroke();
    graphics.strokeColor = inner;
    graphics.lineWidth = 1;
    this.tracePixelSteppedRect(
      graphics,
      left + 3,
      bottom + 3,
      button.width - 6,
      button.height - 6,
      Math.max(2, button.cut - 3),
    );
    graphics.stroke();

    graphics.strokeColor = border;
    graphics.lineWidth = 2;
    graphics.moveTo(left + 12, bottom + button.height - 5);
    graphics.lineTo(
      left + (state === "selected" ? Math.min(button.width - 12, 58) : Math.min(button.width - 12, 36)),
      bottom + button.height - 5,
    );
    graphics.stroke();
    graphics.fillColor = border;
    graphics.rect(left + 6, bottom + 7, 2, 2);
    graphics.rect(left + button.width - 8, bottom + button.height - 10, 2, 2);
    if (state === "selected") {
      graphics.rect(left + button.width - 9, bottom + button.height - 9, 4, 4);
    }
    graphics.fill();

    button.visualNode.setPosition(0, state === "pressed" ? -2 : 0);
    button.label.color = content;
    if (button.icon !== null) {
      button.icon.color = content;
    }
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
    this.vfxController?.destroy();
    this.vfxController = null;
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
    const safeAreaInsets = this.resolveSafeAreaInsets(visibleSize.width, visibleSize.height);
    const layout = fitResponsiveGameLayout({
      visibleWidth: visibleSize.width,
      visibleHeight: visibleSize.height,
      macroWidth: this.rules.macroWidth,
      macroHeight: this.rules.macroHeight,
      safeAreaInsets,
    });

    const boardNode = this.sandSprite?.node;
    boardNode?.setPosition(layout.boardX, layout.boardY);
    boardNode?.getComponent(UITransform)?.setContentSize(layout.boardWidth, layout.boardHeight);
    if (this.pieceGraphics !== null) {
      this.pieceGraphics.node.setPosition(0, 0);
      this.pieceGraphics.node
        .getComponent(UITransform)
        ?.setContentSize(layout.boardWidth, layout.boardHeight);
    }
    this.dangerZoneGraphics?.node
      .getComponent(UITransform)
      ?.setContentSize(layout.boardWidth, layout.boardHeight);
    this.vfxController?.resize(layout.boardWidth, layout.boardHeight);

    this.statusPanelNode?.setPosition(layout.statusX, layout.hudPanelY);
    this.nextPanelNode?.setPosition(layout.nextX, layout.hudPanelY);
    this.pauseButtonNode?.setPosition(layout.boardX, layout.pauseY);
    this.scoreFeedbackBaseX = layout.boardX;
    this.scoreFeedbackBaseY = layout.feedbackY;
    this.scoreFeedbackLabel?.node.setPosition(layout.boardX, layout.feedbackY);
    this.scoreFeedbackDecorationSprite?.node.setPosition(layout.boardX, layout.feedbackY);

    const safeCenterX = (safeAreaInsets.left - safeAreaInsets.right) / 2;
    const safeCenterY = (safeAreaInsets.bottom - safeAreaInsets.top) / 2;
    this.modalCardNode?.setPosition(safeCenterX, safeCenterY);

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
    const homeSafeWidth = visibleSize.width - safeAreaInsets.left - safeAreaInsets.right;
    const homeSafeHeight = visibleSize.height - safeAreaInsets.top - safeAreaInsets.bottom;
    const homeScale = Math.max(0.1, Math.min(1, homeSafeWidth / 360, homeSafeHeight / 800));
    this.homeContentNode?.setPosition(safeCenterX, safeCenterY);
    this.homeContentNode?.setScale(homeScale, homeScale, 1);
    this.redrawHomeBackground(visibleSize.width, visibleSize.height);
  }

  private resolveSafeAreaInsets(visibleWidth: number, visibleHeight: number): SafeAreaInsets {
    const safeRect = sys.getSafeAreaRect(false);
    const insets: SafeAreaInsets = {
      top: Math.max(0, visibleHeight - safeRect.y - safeRect.height),
      right: Math.max(0, visibleWidth - safeRect.x - safeRect.width),
      bottom: Math.max(0, safeRect.y),
      left: Math.max(0, safeRect.x),
    };
    const capsuleBottom = miniGameCapsuleBottomInDesignUnits(visibleHeight);
    if (capsuleBottom === undefined) {
      return insets;
    }
    return {
      ...insets,
      // Keep interactive HUD controls below the platform-owned capsule.
      top: Math.max(insets.top, capsuleBottom + 8),
    };
  }

  private redrawHomeBackground(width: number, height: number): void {
    this.resizeHomeBackgroundSprite(width, height);
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

  private resizeHomeBackgroundSprite(width: number, height: number): void {
    const sprite = this.homeBackgroundSprite;
    if (sprite === null) {
      return;
    }
    const imageAspect = 720 / 1280;
    const viewportAspect = width / height;
    const spriteWidth = viewportAspect >= imageAspect ? width : height * imageAspect;
    const spriteHeight = viewportAspect >= imageAspect ? width / imageAspect : height;
    sprite.node.getComponent(UITransform)?.setContentSize(spriteWidth, spriteHeight);
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
    const boardRevision = this.session.boardRevision;
    const boardChanged = boardRevision !== this.lastRenderedBoardRevision;
    if (boardChanged) {
      this.session.copyBoardTo(this.boardCells);
      this.session.copyGrainVariantsTo(this.grainVariantCells);
      this.lastRenderedBoardRevision = boardRevision;
    }
    const hasClearEffect = this.session.phase === "Clearing"
      && this.session.copyClearMaskTo(this.clearMaskCells);
    if (boardChanged || hasClearEffect || this.lastRenderedClearEffect) {
      const flashIntensity = hasClearEffect
        ? clearFlashIntensity(
          this.session.getClearProgress(renderAheadSeconds),
          this.session.chainLevel + 1,
        )
        : 0;
      const update = this.pixelBuffer.update(
        this.boardCells,
        hasClearEffect ? this.clearMaskCells : undefined,
        flashIntensity,
        this.grainVariantCells,
      );
      if (update.changedCount > 0) {
        this.uploadBoardTexture(update);
      }
    }
    this.lastRenderedClearEffect = hasClearEffect;
    this.renderActivePiece(deltaTime, renderAheadSeconds);
    this.renderDangerZone(deltaTime, boardChanged);
    this.vfxController?.update(deltaTime);
    this.renderNextPiece();
    this.renderHudAndModal(deltaTime);
    this.renderHomeScreen(deltaTime);
  }

  private uploadBoardTexture(update: PixelBufferUpdateResult): void {
    const texture = this.texture;
    const gfxTexture = texture?.getGFXTexture();
    const device = director.root?.device;
    if (
      texture === null
      || gfxTexture === null
      || gfxTexture === undefined
      || device === undefined
      || update.dirtyMinX < 0
      || update.dirtyMinY < 0
    ) {
      texture?.uploadData(this.pixelBuffer.pixels);
      return;
    }

    const dirtyWidth = update.dirtyMaxX - update.dirtyMinX + 1;
    const dirtyHeight = update.dirtyMaxY - update.dirtyMinY + 1;
    const dirtyArea = dirtyWidth * dirtyHeight;
    const fullArea = this.pixelBuffer.width * this.pixelBuffer.height;
    if (dirtyArea >= fullArea * 0.7) {
      texture.uploadData(this.pixelBuffer.pixels);
      return;
    }

    const region = this.textureUploadRegion;
    region.buffOffset = (
      update.dirtyMinY * this.pixelBuffer.width + update.dirtyMinX
    ) * 4;
    region.buffStride = this.pixelBuffer.width;
    region.buffTexHeight = this.pixelBuffer.height;
    region.texOffset.x = update.dirtyMinX;
    region.texOffset.y = update.dirtyMinY;
    region.texOffset.z = 0;
    region.texExtent.width = dirtyWidth;
    region.texExtent.height = dirtyHeight;
    region.texExtent.depth = 1;
    region.texSubres.mipLevel = 0;
    region.texSubres.baseArrayLayer = 0;
    region.texSubres.layerCount = 1;
    device.copyBuffersToTexture(
      [this.pixelBuffer.pixels],
      gfxTexture,
      [region],
    );
  }

  private renderDangerZone(deltaTime: number, boardChanged: boolean): void {
    const graphics = this.dangerZoneGraphics;
    const transform = graphics?.node.getComponent(UITransform);
    if (
      graphics === null
      || graphics === undefined
      || transform === null
      || transform === undefined
    ) {
      return;
    }
    graphics.clear();
    if (this.session.phase === "Idle") {
      return;
    }

    if (boardChanged) {
      const zoneRows = Math.min(
        this.session.boardHeight,
        this.rules.grainsPerCell * 4,
      );
      this.dangerZoneTargetIntensity = sampleDangerZone(
        this.boardCells,
        this.session.boardWidth,
        this.session.boardHeight,
        zoneRows,
      ).intensity;
    }
    if (this.session.phase === "GameOver") {
      this.dangerZoneTargetIntensity = 1;
    }

    const step = Math.max(0, Math.min(0.05, deltaTime));
    this.dangerZoneElapsedSeconds = (
      this.dangerZoneElapsedSeconds + step
    ) % 1000;
    if (step > 0) {
      const response = this.dangerZoneTargetIntensity > this.dangerZoneVisualIntensity
        ? 6
        : 3.5;
      const blend = 1 - Math.exp(-step * response);
      this.dangerZoneVisualIntensity += (
        this.dangerZoneTargetIntensity - this.dangerZoneVisualIntensity
      ) * blend;
    }

    const width = transform.contentSize.width;
    const height = transform.contentSize.height;
    const left = -width / 2;
    const top = height / 2;
    const zoneHeight = (
      height * Math.min(4, this.rules.macroHeight) / this.rules.macroHeight
    );
    const boundaryY = top - zoneHeight;
    const intensity = dangerZonePulse(
      Math.max(0, Math.min(1, this.dangerZoneVisualIntensity)),
      this.dangerZoneElapsedSeconds,
    );

    if (intensity > 0.02) {
      const stripHeight = zoneHeight / 4;
      for (let strip = 0; strip < 4; strip += 1) {
        const fade = 1 - strip / 4;
        graphics.fillColor = new Color(255, 72, 85, Math.round(intensity * 22 * fade));
        graphics.rect(left, top - (strip + 1) * stripHeight, width, stripHeight);
        graphics.fill();
      }
      graphics.fillColor = new Color(255, 99, 107, Math.round(20 + intensity * 46));
      graphics.rect(left, top - 2, width, 2);
      graphics.fill();
    }

    const segmentWidth = Math.max(8, Math.floor(width / 22));
    const segmentGap = Math.max(4, Math.floor(segmentWidth * 0.55));
    graphics.fillColor = new Color(255, 99, 107, Math.round(34 + intensity * 102));
    for (let x = left; x < left + width; x += segmentWidth + segmentGap) {
      graphics.rect(x, boundaryY, Math.min(segmentWidth, left + width - x), 2);
    }
    graphics.fill();

    const moteCount = Math.ceil(intensity * 14);
    if (moteCount <= 0) {
      return;
    }
    graphics.fillColor = new Color(255, 99, 107, Math.round(34 + intensity * 82));
    for (let index = 0; index < moteCount; index += 1) {
      if (index % 4 === 0 && intensity > 0.55) {
        continue;
      }
      const seedX = dangerMoteUnit(index, 1);
      const seedY = dangerMoteUnit(index, 2);
      const speed = 0.055 + dangerMoteUnit(index, 3) * 0.055;
      const travel = (seedY + this.dangerZoneElapsedSeconds * speed) % 1;
      const size = index % 5 === 0 ? 3 : index % 2 === 0 ? 2 : 1;
      graphics.rect(
        left + 6 + seedX * Math.max(0, width - 12),
        top - 6 - travel * Math.max(0, zoneHeight - 12),
        size,
        size,
      );
    }
    graphics.fill();

    if (intensity > 0.55) {
      graphics.fillColor = new Color(255, 200, 87, Math.round(24 + intensity * 72));
      for (let index = 0; index < moteCount; index += 4) {
        const travel = (
          dangerMoteUnit(index, 5)
          + this.dangerZoneElapsedSeconds * (0.045 + dangerMoteUnit(index, 6) * 0.04)
        ) % 1;
        const size = index % 8 === 0 ? 3 : 2;
        graphics.rect(
          left + 6 + dangerMoteUnit(index, 4) * Math.max(0, width - 12),
          top - 6 - travel * Math.max(0, zoneHeight - 12),
          size,
          size,
        );
      }
      graphics.fill();
    }
  }

  private renderHudAndModal(deltaTime: number): void {
    this.updateScoreFeedback(deltaTime);
    if (this.scoreLabel !== null) {
      this.scoreLabel.string = `得分  ${this.formatScore(this.session.score)}`;
    }
    if (this.timeLabel !== null) {
      this.timeLabel.string = `时间  ${this.formatTime(this.session.elapsedMilliseconds)}`;
    }
    if (this.chainLabel !== null) {
      if (this.session.mode === "classic") {
        this.chainLabel.string = this.session.chainLevel > 0
          ? `经典  连锁×${this.session.chainLevel}`
          : `经典  ${this.session.activeColorCount} 色`;
      } else {
        this.chainLabel.string = this.session.chainLevel > 0
          ? `等级${this.session.level}  连锁×${this.session.chainLevel}`
          : `等级 ${this.session.level}`;
      }
    }

    const phase = this.session.phase;
    this.syncPhaseUiArt(phase);
    const modal = this.modalOverlayNode;
    if (modal === null) {
      return;
    }
    this.setGameplayChromeVisible(phase !== "Idle");
    if (phase === "Idle") {
      modal.active = false;
      if (this.pauseButtonLabel !== null) this.pauseButtonLabel.string = "暂停";
      return;
    }
    if (phase !== "Paused" && phase !== "GameOver") {
      modal.active = false;
      if (this.pauseButtonLabel !== null) {
        this.pauseButtonLabel.string = "暂停";
      }
      return;
    }

    modal.active = true;
    if (phase === "Paused") {
      if (this.modalTitleLabel !== null) this.modalTitleLabel.string = "已暂停";
      if (this.modalSummaryLabel !== null) {
        const difficulty = this.session.mode === "progressive"
          ? `等级 ${this.session.level}`
          : `经典 ${this.session.activeColorCount} 色`;
        this.modalSummaryLabel.string = [
          `得分   ${this.formatScore(this.session.score)}`,
          `时间   ${this.formatTime(this.session.elapsedMilliseconds)}    ${difficulty}`,
          `最高   ${this.formatScore(this.highScoreStore.value)}`,
        ].join("\n");
      }
      if (this.modalActionLabel !== null) this.modalActionLabel.string = "继续";
      if (this.modalHintLabel !== null) this.modalHintLabel.string = "";
      if (this.pauseButtonLabel !== null) this.pauseButtonLabel.string = "继续";
      return;
    }

    if (!this.gameOverRecorded) {
      this.highScoreStore.record(this.session.score);
      // Hosting the score is also what makes this player visible on friends'
      // rankings, so upload every run rather than only new personal bests.
      this.leaderboard.submitScore(this.session.score);
      this.gameOverRecorded = true;
    }
    if (this.modalTitleLabel !== null) this.modalTitleLabel.string = "游戏结束";
    if (this.modalSummaryLabel !== null) {
      const difficulty = this.session.mode === "progressive"
        ? `等级 ${this.session.level}`
        : `经典 ${this.session.activeColorCount} 色`;
      this.modalSummaryLabel.string = [
        `得分   ${this.formatScore(this.session.score)}    最高  ${this.formatScore(this.highScoreStore.value)}`,
        `时间   ${this.formatTime(this.session.elapsedMilliseconds)}    ${difficulty}`,
        `消除   ${this.session.clearCount}    最大连锁 ×${this.session.maxChain}`,
      ].join("\n");
    }
    if (this.modalActionLabel !== null) this.modalActionLabel.string = "再来一局";
    if (this.modalHintLabel !== null) this.modalHintLabel.string = "";
    if (this.pauseButtonLabel !== null) this.pauseButtonLabel.string = "暂停";
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
      const mode = this.selectedGameMode === "progressive" ? "进阶模式" : "经典休闲";
      this.homeBestLabel.string = `${mode}  ·  最高分  ${this.formatScore(this.highScoreStore.value)}`;
    }

    const step = Math.min(0.05, Math.max(0, deltaTime));
    this.homeAnimationSeconds += step;
    this.homeHeroImpulse = Math.max(0, this.homeHeroImpulse - step * 1.8);
    const bob = Math.sin(this.homeAnimationSeconds * 1.9) * 7;
    const idleSway = Math.sin(this.homeAnimationSeconds * 1.25) * 3.2;
    const impulseLift = Math.sin(this.homeHeroImpulse * Math.PI) * 14;
    const hero = this.homeHeroNode;
    if (hero !== null) {
      const impulseSway = Math.sin(this.homeAnimationSeconds * 18) * 13 * this.homeHeroImpulse;
      const scale = 1
        + Math.sin(this.homeAnimationSeconds * 2.2) * 0.018
        + this.homeHeroImpulse * 0.045;
      hero.setPosition(0, this.homeHeroBaseY + bob + impulseLift);
      hero.angle = idleSway + impulseSway;
      hero.setScale(scale, scale, 1);
    }
    const grains = this.homeGrainFieldNode;
    if (grains !== null) {
      grains.setPosition(0, this.homeHeroBaseY + bob * 0.62 + impulseLift * 0.35);
      grains.angle = idleSway * 0.22;
      this.drawHomeGrainField();
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
    if (!visible && this.scoreFeedbackDecorationSprite !== null) {
      this.scoreFeedbackDecorationSprite.node.active = false;
    }
  }

  private updateScoreFeedback(deltaTime: number): void {
    const score = this.session.score;
    const level = this.session.level;
    const colorCount = this.session.activeColorCount;
    const chainLevel = this.session.chainLevel;
    if (level > this.lastRenderedLevel) {
      this.vfxController?.emitLevelUp(0, 0, { r: 255, g: 209, b: 92 });
      this.scoreFeedbackAmount = 0;
      this.scoreFeedbackElapsedSeconds = 0;
      this.scoreFeedbackShowsLevelUp = true;
      this.scoreFeedbackShowsChain = false;
      this.scoreFeedbackChainLevel = 0;
      this.scorePulseElapsedSeconds = 0;
      if (this.scoreFeedbackLabel !== null) {
        this.scoreFeedbackLabel.string = colorCount > this.lastRenderedColorCount
          ? `等级 ${level}  ·  解锁新颜色`
          : `等级 ${level}  ·  速度提升`;
        this.scoreFeedbackLabel.node.active = true;
      }
    } else if (chainLevel >= 2 && chainLevel > this.lastRenderedChainLevel) {
      const added = Math.max(0, score - this.lastRenderedScore);
      this.scoreFeedbackAmount = added;
      this.scoreFeedbackElapsedSeconds = 0;
      this.scoreFeedbackShowsLevelUp = false;
      this.scoreFeedbackShowsChain = true;
      this.scoreFeedbackChainLevel = chainLevel;
      this.scorePulseElapsedSeconds = 0;
      if (this.scoreFeedbackLabel !== null) {
        this.scoreFeedbackLabel.string = `连锁 ×${chainLevel}  ·  +${added}`;
        this.scoreFeedbackLabel.node.active = true;
      }
    } else if (score > this.lastRenderedScore) {
      const added = score - this.lastRenderedScore;
      this.scoreFeedbackAmount = this.scoreFeedbackElapsedSeconds < 0.12
        && !this.scoreFeedbackShowsLevelUp
        && !this.scoreFeedbackShowsChain
        ? this.scoreFeedbackAmount + added
        : added;
      this.scoreFeedbackElapsedSeconds = 0;
      this.scoreFeedbackShowsLevelUp = false;
      this.scoreFeedbackShowsChain = false;
      this.scoreFeedbackChainLevel = 0;
      this.scorePulseElapsedSeconds = 0;
      if (this.scoreFeedbackLabel !== null) {
        this.scoreFeedbackLabel.string = `+${this.scoreFeedbackAmount}`;
        this.scoreFeedbackLabel.node.active = true;
      }
    } else if (score < this.lastRenderedScore) {
      this.scoreFeedbackAmount = 0;
      this.scoreFeedbackElapsedSeconds = Number.POSITIVE_INFINITY;
      this.scoreFeedbackShowsLevelUp = false;
      this.scoreFeedbackShowsChain = false;
      this.scoreFeedbackChainLevel = 0;
      this.scorePulseElapsedSeconds = Number.POSITIVE_INFINITY;
      if (this.scoreFeedbackLabel !== null) {
        this.scoreFeedbackLabel.node.active = false;
      }
      this.scoreLabel?.node.setScale(1, 1, 1);
    }
    this.lastRenderedScore = score;
    this.lastRenderedLevel = level;
    this.lastRenderedColorCount = colorCount;
    this.lastRenderedChainLevel = chainLevel;

    const feedback = this.scoreFeedbackLabel;
    if (feedback !== null && Number.isFinite(this.scoreFeedbackElapsedSeconds)) {
      this.scoreFeedbackElapsedSeconds += Math.max(0, deltaTime);
      const duration = this.scoreFeedbackShowsLevelUp || this.scoreFeedbackShowsChain
        ? 1.05
        : 0.72;
      const progress = Math.min(1, this.scoreFeedbackElapsedSeconds / duration);
      const fade = progress < 0.58 ? 1 : (1 - progress) / 0.42;
      const scaleBoost = this.scoreFeedbackShowsChain ? 0.3 : 0.2;
      const scale = 0.82 + scaleBoost * Math.min(1, progress / 0.16);
      feedback.node.setPosition(
        this.scoreFeedbackBaseX,
        this.scoreFeedbackBaseY + progress * 34,
      );
      feedback.node.setScale(scale, scale, 1);
      feedback.color = this.scoreFeedbackShowsLevelUp
        ? new Color(105, 220, 255, Math.round(255 * fade))
        : this.scoreFeedbackShowsChain
          ? this.chainFeedbackColor(this.scoreFeedbackChainLevel, Math.round(255 * fade))
          : new Color(255, 222, 102, Math.round(255 * fade));
      const decoration = this.scoreFeedbackDecorationSprite;
      if (decoration !== null) {
        decoration.node.setPosition(
          this.scoreFeedbackBaseX,
          this.scoreFeedbackBaseY + progress * 34,
        );
        decoration.node.setScale(scale, scale, 1);
        this.syncScoreFeedbackDecoration(fade);
      }
      if (progress >= 1) {
        feedback.node.active = false;
        if (decoration !== null) {
          decoration.node.active = false;
        }
        this.scoreFeedbackElapsedSeconds = Number.POSITIVE_INFINITY;
        this.scoreFeedbackAmount = 0;
        this.scoreFeedbackShowsLevelUp = false;
        this.scoreFeedbackShowsChain = false;
        this.scoreFeedbackChainLevel = 0;
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

  private chainFeedbackColor(chainLevel: number, alpha: number): Color {
    if (chainLevel >= 4) {
      return new Color(194, 87, 183, alpha);
    }
    if (chainLevel >= 3) {
      return new Color(255, 99, 107, alpha);
    }
    return new Color(255, 200, 87, alpha);
  }

  private syncScoreFeedbackDecoration(fade: number): void {
    const decoration = this.scoreFeedbackDecorationSprite;
    if (decoration === null) {
      return;
    }
    if (this.scoreFeedbackShowsLevelUp && this.scoreFeedbackLevelFrame !== null) {
      decoration.spriteFrame = this.scoreFeedbackLevelFrame;
      decoration.color = new Color(255, 255, 255, Math.round(255 * fade));
      decoration.node.active = true;
      return;
    }
    if (this.scoreFeedbackShowsChain && this.scoreFeedbackChainFrame !== null) {
      decoration.spriteFrame = this.scoreFeedbackChainFrame;
      const tierOpacity = this.scoreFeedbackChainLevel >= 4
        ? 1
        : this.scoreFeedbackChainLevel >= 3
          ? 0.92
          : 0.82;
      decoration.color = this.chainFeedbackColor(
        this.scoreFeedbackChainLevel,
        Math.round(255 * fade * tierOpacity),
      );
      decoration.node.active = true;
      return;
    }
    decoration.node.active = false;
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
      // The locked grains already live in the board texture underneath. Fade
      // only the four solid macro cells to reveal them, avoiding hundreds of
      // per-frame Graphics paths on mini-game runtimes.
      const dissolveInset = Math.min(cellWidth, cellHeight) * (1 - piece.opacity) * 0.08;
      graphics.fillColor = new Color(
        color.r,
        color.g,
        color.b,
        Math.round(color.a * piece.opacity),
      );
      for (const cell of rotation) {
        const macroX = piece.x + cell.x;
        const macroY = piece.y + cell.y;
        const inset = cellInset + dissolveInset;
        graphics.roundRect(
          left + macroX * cellWidth + inset,
          top - (macroY + 1) * cellHeight + inset,
          cellWidth - inset * 2,
          cellHeight - inset * 2,
          cornerRadius,
        );
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
    this.rules = this.createRulesForSelectedMode();
    this.session = new GameSession({
      rules: this.rules,
      mode: this.selectedGameMode,
    });
    this.session.start(Date.now());
    this.lastRenderedBoardRevision = -1;
    this.lastRenderedClearEffect = false;
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

  private onModalRestart(): void {
    if (this.session.phase !== "Paused" && this.session.phase !== "GameOver") {
      return;
    }
    this.feedback.unlock();
    this.startNewGame();
  }

  private onModalRanking(): void {
    if (this.session.phase !== "GameOver") {
      return;
    }
    this.feedback.unlock();
    this.feedback.trigger("ui");
    // The host draws the list over the game canvas; nothing to render here, and
    // a failure just leaves the game over card as it was.
    void this.leaderboard.showFriendRanking();
  }

  private onModalHome(): void {
    if (this.session.phase !== "Paused" && this.session.phase !== "GameOver") {
      return;
    }
    this.feedback.unlock();
    // Pausing suspends the BGM, so leaving a paused game for the home screen
    // has to lift that suspension or the next session starts silent.
    this.feedback.resume();
    this.rules = this.createRulesForSelectedMode();
    this.session = new GameSession({ rules: this.rules, mode: this.selectedGameMode });
    this.runner.reset();
    this.pieceAnimator.reset(0);
    this.lastRenderedBoardRevision = -1;
    this.lastRenderedClearEffect = false;
    this.renderedPreviewKey = "";
    this.gameOverRecorded = false;
    this.resetFeedbackState();
    this.feedback.trigger("ui");
    this.renderFrame(0);
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
      const geometry = this.resolvePieceVfxGeometry(this.session.lastLockedPiece);
      if (geometry !== undefined) {
        this.vfxController?.emitImpact(
          geometry.centerX,
          geometry.bottomY,
          geometry.color,
          1.25,
        );
      }
    }
  }

  private syncFeedbackState(): void {
    const phase = this.session.phase;
    if (phase === "LockDelay" && this.lastFeedbackPhase !== "LockDelay") {
      this.feedback.trigger("land");
      const geometry = this.resolvePieceVfxGeometry(this.session.activePiece);
      if (geometry !== undefined) {
        this.vfxController?.emitImpact(
          geometry.centerX,
          geometry.bottomY,
          geometry.color,
        );
      }
    }
    if (this.session.lockSequence > this.lastFeedbackLockSequence) {
      this.feedback.trigger("sandify");
      const geometry = this.resolvePieceVfxGeometry(this.session.lastLockedPiece);
      if (geometry !== undefined) {
        this.vfxController?.emitSandify(geometry.cells, geometry.color);
      }
    }
    if (phase === "Clearing" && this.lastFeedbackPhase !== "Clearing") {
      const pendingChain = this.session.chainLevel + 1;
      this.feedback.triggerClear(pendingChain);
      this.emitClearVfx(pendingChain);
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
    this.lastRenderedScore = this.session.score;
    this.lastRenderedLevel = this.session.level;
    this.lastRenderedColorCount = this.session.activeColorCount;
    this.lastRenderedChainLevel = this.session.chainLevel;
    this.scoreFeedbackAmount = 0;
    this.scoreFeedbackElapsedSeconds = Number.POSITIVE_INFINITY;
    this.scoreFeedbackShowsLevelUp = false;
    this.scoreFeedbackShowsChain = false;
    this.scoreFeedbackChainLevel = 0;
    this.scorePulseElapsedSeconds = Number.POSITIVE_INFINITY;
    this.dangerZoneTargetIntensity = 0;
    this.dangerZoneVisualIntensity = 0;
    this.dangerZoneElapsedSeconds = 0;
    this.dangerZoneGraphics?.clear();
    this.vfxController?.reset();
    if (this.scoreFeedbackLabel !== null) {
      this.scoreFeedbackLabel.node.active = false;
    }
    if (this.scoreFeedbackDecorationSprite !== null) {
      this.scoreFeedbackDecorationSprite.node.active = false;
    }
  }

  private resolvePieceVfxGeometry(piece: ActivePieceState | undefined): {
    readonly centerX: number;
    readonly centerY: number;
    readonly bottomY: number;
    readonly color: VfxTint;
    readonly cells: readonly SandifyVfxCell[];
  } | undefined {
    const transform = this.sandSprite?.node.getComponent(UITransform);
    const rotation = piece?.definition.rotations[piece.rotation];
    const paletteColor = piece === undefined ? undefined : DEFAULT_SAND_PALETTE[piece.color];
    if (piece === undefined || rotation === undefined || paletteColor === undefined || transform === null || transform === undefined) {
      return undefined;
    }
    const cellWidth = transform.contentSize.width / this.rules.macroWidth;
    const cellHeight = transform.contentSize.height / this.rules.macroHeight;
    const left = -transform.contentSize.width * transform.anchorX;
    const top = transform.contentSize.height * (1 - transform.anchorY);
    const cells = rotation.map((cell): SandifyVfxCell => ({
      x: left + (piece.x + cell.x + 0.5) * cellWidth,
      y: top - (piece.y + cell.y + 0.5) * cellHeight,
      scaleX: cellWidth / 64,
      scaleY: cellHeight / 64,
    }));
    const centerX = cells.reduce((sum, cell) => sum + cell.x, 0) / cells.length;
    const centerY = cells.reduce((sum, cell) => sum + cell.y, 0) / cells.length;
    const maxCellY = Math.max(...rotation.map((cell) => cell.y));
    return {
      centerX,
      centerY,
      bottomY: top - (piece.y + maxCellY + 1) * cellHeight,
      color: paletteColor,
      cells,
    };
  }

  private emitClearVfx(pendingChain: number): void {
    if (!this.session.copyClearMaskTo(this.clearMaskCells)) {
      return;
    }
    const transform = this.sandSprite?.node.getComponent(UITransform);
    if (transform === null || transform === undefined) {
      return;
    }
    const board = this.session.getBoardSnapshot();
    const width = this.session.boardWidth;
    let minX = width;
    let maxX = -1;
    let minY = this.session.boardHeight;
    let maxY = -1;
    let colorId = 0;
    for (let index = 0; index < this.clearMaskCells.length; index += 1) {
      if (this.clearMaskCells[index] === 0) {
        continue;
      }
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      colorId ||= board[index] ?? 0;
    }
    if (maxX < minX || maxY < minY) {
      return;
    }
    const grainWidth = transform.contentSize.width / this.session.boardWidth;
    const grainHeight = transform.contentSize.height / this.session.boardHeight;
    const left = -transform.contentSize.width * transform.anchorX;
    const top = transform.contentSize.height * (1 - transform.anchorY);
    const centerX = left + (minX + maxX + 1) * grainWidth / 2;
    const centerY = top - (minY + maxY + 1) * grainHeight / 2;
    const clearWidth = Math.max(64, (maxX - minX + 1) * grainWidth);
    const baseColor = DEFAULT_SAND_PALETTE[colorId] ?? DEFAULT_SAND_PALETTE[1];
    const color = pendingChain >= 4
      ? { r: 181, g: 109, b: 255 }
      : pendingChain === 3
        ? { r: 255, g: 99, b: 107 }
        : pendingChain === 2
          ? { r: 255, g: 209, b: 92 }
          : baseColor;
    this.vfxController?.emitClear(centerX, centerY, clearWidth, color, pendingChain);
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

interface MiniGameRuntimeApi {
  readonly getMenuButtonBoundingClientRect?: () => unknown;
  readonly getMenuButtonLayout?: () => unknown;
  readonly getWindowInfo?: () => unknown;
  readonly getSystemInfoSync?: () => unknown;
}

/** Returns the platform capsule's bottom edge measured from the design-space top. */
function miniGameCapsuleBottomInDesignUnits(visibleHeight: number): number | undefined {
  const runtimes = globalThis as unknown as {
    readonly wx?: MiniGameRuntimeApi;
    readonly tt?: MiniGameRuntimeApi;
  };
  for (const runtime of [runtimes.wx, runtimes.tt]) {
    if (runtime === undefined) {
      continue;
    }
    const menu = callMiniGameApi(
      runtime,
      runtime.getMenuButtonBoundingClientRect ?? runtime.getMenuButtonLayout,
    );
    const system = callMiniGameApi(runtime, runtime.getWindowInfo)
      ?? callMiniGameApi(runtime, runtime.getSystemInfoSync);
    const bottom = finiteRecordNumber(menu, "bottom");
    const windowHeight = finiteRecordNumber(system, "windowHeight")
      ?? finiteRecordNumber(system, "screenHeight");
    if (bottom !== undefined && windowHeight !== undefined && windowHeight > 0) {
      return Math.max(0, Math.min(visibleHeight, bottom / windowHeight * visibleHeight));
    }
  }
  return undefined;
}

function callMiniGameApi(
  runtime: MiniGameRuntimeApi,
  method: (() => unknown) | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (method === undefined) {
    return undefined;
  }
  try {
    const result = method.call(runtime);
    return typeof result === "object" && result !== null
      ? result as Readonly<Record<string, unknown>>
      : undefined;
  } catch {
    return undefined;
  }
}

function finiteRecordNumber(
  record: Readonly<Record<string, unknown>> | undefined,
  key: string,
): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function dangerMoteUnit(index: number, salt: number): number {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}
