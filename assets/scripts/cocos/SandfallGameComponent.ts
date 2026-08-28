import {
  _decorator,
  Color,
  Component,
  EventKeyboard,
  Graphics,
  input,
  Input,
  KeyCode,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
} from "cc";
import { FixedStepRunner } from "../application/FixedStepRunner";
import { GameSession } from "../application/GameSession";
import { DEFAULT_RULES } from "../core/RulesConfig";
import { DEFAULT_SAND_PALETTE, SandPixelBuffer } from "../rendering/SandPixelBuffer";

const { ccclass, property } = _decorator;

/** Minimal Cocos Creator 3.8.8 prototype host for the deterministic game core. */
@ccclass("SandfallGameComponent")
export class SandfallGameComponent extends Component {
  @property(Sprite)
  public sandSprite: Sprite | null = null;

  @property(Graphics)
  public pieceGraphics: Graphics | null = null;

  private session!: GameSession;
  private runner!: FixedStepRunner;
  private pixelBuffer!: SandPixelBuffer;
  private boardCells!: Uint8Array;
  private texture: Texture2D | null = null;
  private spriteFrame: SpriteFrame | null = null;
  private readonly pressedKeys = new Set<KeyCode>();

  protected onLoad(): void {
    if (this.sandSprite === null || this.pieceGraphics === null) {
      throw new Error("SandfallGameComponent requires sandSprite and pieceGraphics assignments");
    }

    this.session = new GameSession({ rules: DEFAULT_RULES });
    this.session.start(Date.now());
    this.runner = new FixedStepRunner({
      fixedHz: DEFAULT_RULES.fixedHz,
      maxFrameDeltaSeconds: 0.25,
      maxStepsPerFrame: 5,
    }, (fixedDelta) => this.session.tick(fixedDelta));
    this.boardCells = new Uint8Array(this.session.boardWidth * this.session.boardHeight);
    this.pixelBuffer = new SandPixelBuffer({
      width: this.session.boardWidth,
      height: this.session.boardHeight,
      // Raw texture data starts at the bottom-left while game y=0 is at the top.
      flipY: true,
    });
    this.createTexture();
    this.renderFrame();
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
    if (this.session.phase === "Paused") {
      return;
    }
    this.runner.advance(deltaTime);
    this.renderFrame();
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

  private renderFrame(): void {
    this.session.copyBoardTo(this.boardCells);
    const update = this.pixelBuffer.update(this.boardCells);
    if (update.changedCount > 0) {
      this.texture?.uploadData(this.pixelBuffer.pixels);
    }
    this.renderActivePiece();
  }

  private renderActivePiece(): void {
    const graphics = this.pieceGraphics;
    const sprite = this.sandSprite;
    if (graphics === null || sprite === null) {
      return;
    }
    graphics.clear();
    const piece = this.session.activePiece;
    if (piece === undefined) {
      return;
    }
    const transform = sprite.node.getComponent(UITransform);
    const rotation = piece.definition.rotations[piece.rotation];
    const color = DEFAULT_SAND_PALETTE[piece.color];
    if (transform === null || rotation === undefined || color === undefined) {
      throw new Error("Active piece rendering configuration is invalid");
    }

    const cellWidth = transform.contentSize.width / DEFAULT_RULES.macroWidth;
    const cellHeight = transform.contentSize.height / DEFAULT_RULES.macroHeight;
    const left = -transform.contentSize.width * transform.anchorX;
    const top = transform.contentSize.height * (1 - transform.anchorY);
    graphics.fillColor = new Color(color.r, color.g, color.b, color.a);
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
        break;
      default:
        break;
    }
    this.renderFrame();
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
