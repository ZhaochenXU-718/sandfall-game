import {
  Color,
  JsonAsset,
  Node,
  Rect,
  resources,
  Size,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec2,
} from "cc";
import {
  DEFAULT_VFX_BUDGET,
  parseVfxAtlasLayout,
  REQUIRED_VFX_SPRITES,
  VfxBudget,
  type VfxAtlasLayout,
  type VfxKind,
  type VfxSpriteName,
} from "../rendering/VfxRuntime";

interface VfxPoint {
  readonly x: number;
  readonly y: number;
}

export interface SandifyVfxCell extends VfxPoint {
  readonly scaleX: number;
  readonly scaleY: number;
}

export interface VfxTint {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface SpawnOptions {
  readonly frame: VfxSpriteName;
  readonly kind: VfxKind;
  readonly x: number;
  readonly y: number;
  readonly velocityX?: number;
  readonly velocityY?: number;
  readonly startScaleX: number;
  readonly startScaleY: number;
  readonly endScaleX: number;
  readonly endScaleY: number;
  readonly startAlpha: number;
  readonly endAlpha?: number;
  readonly duration: number;
  readonly angle?: number;
  readonly spin?: number;
  readonly color: VfxTint;
}

interface VfxSlot {
  readonly node: Node;
  readonly sprite: Sprite;
  readonly transform: UITransform;
  readonly tint: Color;
  active: boolean;
  kind: VfxKind;
  elapsed: number;
  duration: number;
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  startScaleX: number;
  startScaleY: number;
  endScaleX: number;
  endScaleY: number;
  startAlpha: number;
  endAlpha: number;
  startAngle: number;
  spin: number;
}

const ATLAS_SPRITE_PATH = "art/vfx/luosha-vfx-atlas/spriteFrame";
const ATLAS_LAYOUT_PATH = "art/vfx/luosha-vfx-atlas-layout";

/** One-atlas, fixed-pool visual effects renderer for gameplay feedback. */
export class CocosVfxController {
  private readonly root: Node;
  private readonly slots: VfxSlot[] = [];
  private readonly budget = new VfxBudget(DEFAULT_VFX_BUDGET);
  private readonly frames = new Map<VfxSpriteName, SpriteFrame>();
  private layout: VfxAtlasLayout | undefined;
  private emissionSequence = 0;

  public constructor(parent: Node) {
    this.root = new Node("VfxPool");
    this.root.layer = parent.layer;
    parent.addChild(this.root);
    this.root.addComponent(UITransform).setContentSize(280, 672);

    for (let index = 0; index < DEFAULT_VFX_BUDGET.total; index += 1) {
      const node = new Node(`Vfx-${index}`);
      node.layer = this.root.layer;
      node.active = false;
      this.root.addChild(node);
      const transform = node.addComponent(UITransform);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      this.slots.push({
        node,
        sprite,
        transform,
        tint: new Color(255, 255, 255, 0),
        active: false,
        kind: "particle",
        elapsed: 0,
        duration: 0,
        startX: 0,
        startY: 0,
        velocityX: 0,
        velocityY: 0,
        startScaleX: 1,
        startScaleY: 1,
        endScaleX: 1,
        endScaleY: 1,
        startAlpha: 0,
        endAlpha: 0,
        startAngle: 0,
        spin: 0,
      });
    }
  }

  public load(): void {
    resources.load(ATLAS_SPRITE_PATH, SpriteFrame, (frameError, atlasFrame) => {
      if (frameError || atlasFrame === null || atlasFrame === undefined) {
        console.warn("VFX atlas failed to load", frameError);
        return;
      }
      resources.load(ATLAS_LAYOUT_PATH, JsonAsset, (layoutError, layoutAsset) => {
        if (layoutError || layoutAsset === null || layoutAsset === undefined) {
          console.warn("VFX atlas layout failed to load", layoutError);
          return;
        }
        try {
          const layout = parseVfxAtlasLayout(layoutAsset.json);
          this.installFrames(atlasFrame, layout);
        } catch (error) {
          console.warn("VFX atlas layout is invalid", error);
        }
      });
    });
  }

  public resize(width: number, height: number): void {
    this.root.getComponent(UITransform)?.setContentSize(width, height);
  }

  public reset(): void {
    for (const slot of this.slots) {
      slot.active = false;
      slot.node.active = false;
      slot.sprite.spriteFrame = null;
    }
    this.budget.reset();
    this.emissionSequence = 0;
  }

  public destroy(): void {
    this.reset();
    for (const frame of this.frames.values()) {
      frame.destroy();
    }
    this.frames.clear();
    this.root.destroy();
  }

  public update(deltaTime: number): void {
    const step = Math.max(0, Math.min(0.05, deltaTime));
    if (step === 0) {
      return;
    }
    for (const slot of this.slots) {
      if (!slot.active) {
        continue;
      }
      slot.elapsed = Math.min(slot.duration, slot.elapsed + step);
      const progress = slot.duration <= 0 ? 1 : slot.elapsed / slot.duration;
      const eased = 1 - (1 - progress) * (1 - progress);
      slot.node.setPosition(
        slot.startX + slot.velocityX * slot.elapsed,
        slot.startY + slot.velocityY * slot.elapsed,
      );
      slot.node.setScale(
        lerp(slot.startScaleX, slot.endScaleX, eased),
        lerp(slot.startScaleY, slot.endScaleY, eased),
        1,
      );
      slot.node.angle = slot.startAngle + slot.spin * slot.elapsed;
      slot.tint.a = Math.round(lerp(slot.startAlpha, slot.endAlpha, eased));
      slot.sprite.color = slot.tint;
      if (progress >= 1) {
        this.release(slot);
      }
    }
  }

  public emitImpact(x: number, y: number, color: VfxTint, strength = 1): void {
    this.spawn({
      frame: "glow-core",
      kind: "halo",
      x,
      y,
      startScaleX: 0.28 * strength,
      startScaleY: 0.22 * strength,
      endScaleX: 0.56 * strength,
      endScaleY: 0.34 * strength,
      startAlpha: 150,
      duration: 0.22,
      color,
    });
    const count = strength > 1 ? 5 : 3;
    for (let index = 0; index < count; index += 1) {
      const random = this.random(index, 1);
      const direction = index % 2 === 0 ? -1 : 1;
      this.spawn({
        frame: "dust-impact",
        kind: "particle",
        x: x + direction * (3 + random * 9),
        y: y + this.random(index, 2) * 3,
        velocityX: direction * (12 + random * 20),
        velocityY: 8 + this.random(index, 3) * 14,
        startScaleX: 0.28 + random * 0.18,
        startScaleY: 0.24 + random * 0.14,
        endScaleX: 0.52 + random * 0.16,
        endScaleY: 0.38 + random * 0.14,
        startAlpha: 150,
        duration: 0.3 + random * 0.15,
        color,
      });
    }
    this.emissionSequence += 1;
  }

  public emitSandify(cells: readonly SandifyVfxCell[], color: VfxTint): void {
    cells.slice(0, 4).forEach((cell, index) => {
      this.spawn({
        frame: index % 2 === 0 ? "noise-cluster" : "noise-threshold",
        kind: "particle",
        x: cell.x,
        y: cell.y,
        velocityY: -8,
        startScaleX: cell.scaleX,
        startScaleY: cell.scaleY,
        endScaleX: cell.scaleX * 1.04,
        endScaleY: cell.scaleY * 1.08,
        startAlpha: 112,
        duration: 0.2,
        color,
      });
      const random = this.random(index, 4);
      this.spawn({
        frame: index % 2 === 0 ? "sand-fall" : "dust-rise",
        kind: "particle",
        x: cell.x + (random - 0.5) * 12,
        y: cell.y,
        velocityX: (random - 0.5) * 14,
        velocityY: index % 2 === 0 ? -18 - random * 14 : 10 + random * 16,
        startScaleX: 0.3 + random * 0.16,
        startScaleY: 0.34 + random * 0.2,
        endScaleX: 0.48 + random * 0.14,
        endScaleY: 0.58 + random * 0.2,
        startAlpha: 136,
        duration: 0.34 + random * 0.18,
        color,
      });
    });
    this.emissionSequence += 1;
  }

  public emitClear(
    x: number,
    y: number,
    width: number,
    color: VfxTint,
    pendingChain: number,
  ): void {
    this.spawn({
      frame: "pulse-ring",
      kind: "halo",
      x,
      y,
      startScaleX: 0.48,
      startScaleY: 0.48,
      endScaleX: 0.94 + Math.min(0.16, pendingChain * 0.04),
      endScaleY: 0.94 + Math.min(0.16, pendingChain * 0.04),
      startAlpha: Math.min(178, 138 + pendingChain * 14),
      duration: 0.34,
      color,
    });
    const particleCount = Math.min(12, 6 + pendingChain * 2);
    for (let index = 0; index < particleCount; index += 1) {
      const progress = particleCount <= 1 ? 0.5 : index / (particleCount - 1);
      const random = this.random(index, 7);
      const direction = progress < 0.5 ? -1 : 1;
      this.spawn({
        frame: "dust-burst",
        kind: "particle",
        x: x + (progress - 0.5) * width * 0.88,
        y: y + (random - 0.5) * 16,
        velocityX: direction * (8 + random * 20),
        velocityY: (this.random(index, 8) - 0.35) * 34,
        startScaleX: 0.24 + random * 0.22,
        startScaleY: 0.24 + random * 0.22,
        endScaleX: 0.5 + random * 0.22,
        endScaleY: 0.5 + random * 0.22,
        startAlpha: 124 + Math.min(42, pendingChain * 10),
        duration: 0.34 + random * 0.2,
        spin: direction * (18 + random * 24),
        color,
      });
    }
    this.emissionSequence += 1;
  }

  public emitLevelUp(x: number, y: number, color: VfxTint): void {
    this.spawn({
      frame: "diamond-halo",
      kind: "halo",
      x,
      y,
      startScaleX: 0.55,
      startScaleY: 0.55,
      endScaleX: 0.98,
      endScaleY: 0.98,
      startAlpha: 172,
      duration: 0.48,
      color,
    });
    for (let index = 0; index < 6; index += 1) {
      const random = this.random(index, 11);
      this.spawn({
        frame: "dust-rise",
        kind: "particle",
        x: x + (random - 0.5) * 86,
        y: y - 18 + this.random(index, 12) * 22,
        velocityX: (random - 0.5) * 18,
        velocityY: 18 + this.random(index, 13) * 26,
        startScaleX: 0.26 + random * 0.18,
        startScaleY: 0.3 + random * 0.18,
        endScaleX: 0.46 + random * 0.16,
        endScaleY: 0.58 + random * 0.2,
        startAlpha: 142,
        duration: 0.42 + random * 0.18,
        color,
      });
    }
    this.emissionSequence += 1;
  }

  private installFrames(atlasFrame: SpriteFrame, layout: VfxAtlasLayout): void {
    for (const frame of this.frames.values()) {
      frame.destroy();
    }
    this.frames.clear();
    this.layout = layout;
    for (const name of REQUIRED_VFX_SPRITES) {
      const sprite = layout.sprites[name];
      const frame = new SpriteFrame();
      frame.reset({
        texture: atlasFrame.texture,
        originalSize: new Size(sprite.width, sprite.height),
        rect: new Rect(sprite.x, sprite.y, sprite.width, sprite.height),
        offset: new Vec2(0, 0),
        isRotate: false,
      });
      this.frames.set(name, frame);
    }
  }

  private spawn(options: SpawnOptions): boolean {
    const frame = this.frames.get(options.frame);
    const spriteLayout = this.layout?.sprites[options.frame];
    if (frame === undefined || spriteLayout === undefined || !this.budget.acquire(options.kind)) {
      return false;
    }
    const slot = this.slots.find((candidate) => !candidate.active);
    if (slot === undefined) {
      this.budget.release(options.kind);
      return false;
    }

    slot.active = true;
    slot.kind = options.kind;
    slot.elapsed = 0;
    slot.duration = Math.max(0.001, options.duration);
    slot.startX = options.x;
    slot.startY = options.y;
    slot.velocityX = options.velocityX ?? 0;
    slot.velocityY = options.velocityY ?? 0;
    slot.startScaleX = options.startScaleX;
    slot.startScaleY = options.startScaleY;
    slot.endScaleX = options.endScaleX;
    slot.endScaleY = options.endScaleY;
    slot.startAlpha = clampByte(options.startAlpha);
    slot.endAlpha = clampByte(options.endAlpha ?? 0);
    slot.startAngle = options.angle ?? 0;
    slot.spin = options.spin ?? 0;
    slot.transform.setContentSize(spriteLayout.width, spriteLayout.height);
    slot.sprite.spriteFrame = frame;
    slot.tint.set(options.color.r, options.color.g, options.color.b, slot.startAlpha);
    slot.sprite.color = slot.tint;
    slot.node.setPosition(slot.startX, slot.startY);
    slot.node.setScale(slot.startScaleX, slot.startScaleY, 1);
    slot.node.angle = slot.startAngle;
    slot.node.active = true;
    return true;
  }

  private release(slot: VfxSlot): void {
    this.budget.release(slot.kind);
    slot.active = false;
    slot.node.active = false;
    slot.sprite.spriteFrame = null;
  }

  private random(index: number, salt: number): number {
    const value = Math.sin(
      (index + 1 + this.emissionSequence * 17) * 12.9898 + salt * 78.233,
    ) * 43758.5453;
    return value - Math.floor(value);
  }
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function clampByte(value: number): number {
  return Math.round(Math.max(0, Math.min(255, value)));
}
