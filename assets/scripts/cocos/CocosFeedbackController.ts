import { AudioClip, AudioSource, Node, resources } from "cc";
import {
  FeedbackSettingsStore,
  type FeedbackSettings,
  type FeedbackSettingsStorage,
} from "../audio/FeedbackSettings";
import {
  PlatformHapticsService,
  type HapticStrength,
  type HapticsService,
} from "../audio/HapticsService";

export type FeedbackCue =
  | "move"
  | "rotate"
  | "land"
  | "hard-drop"
  | "sandify"
  | "clear"
  | "clear-chain"
  | "game-over"
  | "ui";

interface CueConfig {
  readonly path: string;
  readonly volume: number;
  readonly cooldownMs: number;
  readonly haptic?: HapticStrength;
}

const BGM_PATH = "audio/bgm-loop";
const CUE_CONFIG: Readonly<Record<FeedbackCue, CueConfig>> = Object.freeze({
  move: { path: "audio/move", volume: 0.22, cooldownMs: 55 },
  rotate: { path: "audio/rotate", volume: 0.38, cooldownMs: 45 },
  land: { path: "audio/land", volume: 0.48, cooldownMs: 100, haptic: "light" },
  "hard-drop": {
    path: "audio/hard-drop",
    volume: 0.68,
    cooldownMs: 120,
    haptic: "medium",
  },
  sandify: { path: "audio/sandify", volume: 0.34, cooldownMs: 120 },
  clear: { path: "audio/clear", volume: 0.56, cooldownMs: 240, haptic: "light" },
  "clear-chain": {
    path: "audio/clear-chain",
    volume: 0.68,
    cooldownMs: 240,
    haptic: "medium",
  },
  "game-over": {
    path: "audio/game-over",
    volume: 0.72,
    cooldownMs: 800,
    haptic: "heavy",
  },
  ui: { path: "audio/ui", volume: 0.3, cooldownMs: 60 },
});

/** Cocos audio host plus platform-aware haptic feedback. */
export class CocosFeedbackController {
  private readonly audioNode: Node;
  private readonly bgmSource: AudioSource;
  private readonly sfxSource: AudioSource;
  private readonly settingsStore: FeedbackSettingsStore;
  private readonly haptics: HapticsService;
  private readonly clips = new Map<string, AudioClip>();
  private readonly lastPlayedAt = new Map<FeedbackCue, number>();
  private readonly loading: Promise<void>;
  private unlocked = false;
  private suspended = false;
  private destroyed = false;

  public constructor(
    parent: Node,
    storage?: FeedbackSettingsStorage,
    haptics: HapticsService = new PlatformHapticsService(),
  ) {
    this.audioNode = new Node("GameFeedbackAudio");
    parent.addChild(this.audioNode);
    this.bgmSource = this.audioNode.addComponent(AudioSource);
    this.bgmSource.loop = true;
    this.bgmSource.volume = 0.24;
    this.sfxSource = this.audioNode.addComponent(AudioSource);
    this.sfxSource.volume = 1;
    this.settingsStore = new FeedbackSettingsStore(storage);
    this.haptics = haptics;
    this.loading = this.loadAssets();
  }

  public get settings(): Readonly<FeedbackSettings> {
    return this.settingsStore.value;
  }

  /** Call from a direct player input so Web autoplay policies can be satisfied. */
  public unlock(): void {
    this.unlocked = true;
    this.suspended = false;
    void this.loading.then(() => this.startBgmIfAllowed());
  }

  public trigger(cue: FeedbackCue): void {
    this.triggerCue(cue, 1);
  }

  public triggerClear(chainLevel: number): void {
    if (!Number.isInteger(chainLevel) || chainLevel <= 0) {
      throw new RangeError("chainLevel must be a positive integer");
    }
    if (chainLevel === 1) {
      this.triggerCue("clear", 1, "light");
      return;
    }
    const volumeScale = Math.min(1.42, 1 + (chainLevel - 2) * 0.12);
    const haptic: HapticStrength = chainLevel >= 4 ? "heavy" : "medium";
    this.triggerCue("clear-chain", volumeScale, haptic);
  }

  private triggerCue(
    cue: FeedbackCue,
    volumeScale: number,
    hapticOverride?: HapticStrength,
  ): void {
    if (this.destroyed) {
      return;
    }
    const config = CUE_CONFIG[cue];
    const haptic = hapticOverride ?? config.haptic;
    if (this.settings.hapticsEnabled && haptic !== undefined) {
      this.haptics.vibrate(haptic);
    }
    if (!this.settings.sfxEnabled) {
      return;
    }
    const now = Date.now();
    const previous = this.lastPlayedAt.get(cue) ?? Number.NEGATIVE_INFINITY;
    if (now - previous < config.cooldownMs) {
      return;
    }
    this.lastPlayedAt.set(cue, now);
    void this.loading.then(() => {
      const clip = this.clips.get(config.path);
      if (!this.destroyed && clip !== undefined && this.settings.sfxEnabled) {
        this.sfxSource.playOneShot(clip, Math.min(1, config.volume * volumeScale));
      }
    });
  }

  public pause(): void {
    this.suspended = true;
    if (this.bgmSource.playing) {
      this.bgmSource.pause();
    }
  }

  public resume(): void {
    this.suspended = false;
    this.startBgmIfAllowed();
  }

  public updateSettings(patch: Partial<FeedbackSettings>): Readonly<FeedbackSettings> {
    const settings = this.settingsStore.update(patch);
    if (!settings.bgmEnabled) {
      this.bgmSource.pause();
    } else {
      this.startBgmIfAllowed();
    }
    return settings;
  }

  public destroy(): void {
    this.destroyed = true;
    this.bgmSource.stop();
    this.sfxSource.stop();
    this.audioNode.destroy();
    this.clips.clear();
    this.lastPlayedAt.clear();
  }

  private startBgmIfAllowed(): void {
    if (
      this.destroyed
      || !this.unlocked
      || this.suspended
      || !this.settings.bgmEnabled
      || this.bgmSource.playing
    ) {
      return;
    }
    const clip = this.clips.get(BGM_PATH);
    if (clip === undefined) {
      return;
    }
    this.bgmSource.clip = clip;
    this.bgmSource.play();
  }

  private async loadAssets(): Promise<void> {
    const cuePaths = Array.from(new Set(Object.values(CUE_CONFIG).map((cue) => cue.path)));
    const paths = [BGM_PATH, ...cuePaths];
    await Promise.all(paths.map(async (path) => {
      try {
        const clip = await this.loadClip(path);
        if (!this.destroyed) {
          this.clips.set(path, clip);
        }
      } catch (error) {
        console.warn(`[feedback] failed to load ${path}: ${this.describeError(error)}`);
      }
    }));
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return `${error.name}: ${error.message}`;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  private loadClip(path: string): Promise<AudioClip> {
    return new Promise((resolve, reject) => {
      resources.load(path, AudioClip, (error, clip) => {
        // Creator's Web runtime may omit the error argument on success even
        // though its TypeScript signature describes the value as `null`.
        if (error) {
          reject(error);
          return;
        }
        resolve(clip);
      });
    });
  }
}
