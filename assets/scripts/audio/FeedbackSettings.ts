export const FEEDBACK_SETTINGS_STORAGE_KEY = "sandfall.feedback.v1";

export interface FeedbackSettings {
  readonly bgmEnabled: boolean;
  readonly sfxEnabled: boolean;
  readonly hapticsEnabled: boolean;
}

export interface FeedbackSettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_FEEDBACK_SETTINGS: Readonly<FeedbackSettings> = Object.freeze({
  bgmEnabled: true,
  sfxEnabled: true,
  hapticsEnabled: true,
});

/** Versioned persistence for audio and haptic preferences. */
export class FeedbackSettingsStore {
  private current: Readonly<FeedbackSettings>;

  public constructor(private readonly storage?: FeedbackSettingsStorage) {
    this.current = this.read();
  }

  public get value(): Readonly<FeedbackSettings> {
    return this.current;
  }

  public update(patch: Partial<FeedbackSettings>): Readonly<FeedbackSettings> {
    this.current = Object.freeze({ ...this.current, ...patch });
    try {
      this.storage?.setItem(FEEDBACK_SETTINGS_STORAGE_KEY, JSON.stringify(this.current));
    } catch {
      // Storage may be unavailable or full. Feedback should still work in memory.
    }
    return this.current;
  }

  private read(): Readonly<FeedbackSettings> {
    try {
      const serialized = this.storage?.getItem(FEEDBACK_SETTINGS_STORAGE_KEY);
      if (serialized === undefined || serialized === null) {
        return DEFAULT_FEEDBACK_SETTINGS;
      }
      const parsed = JSON.parse(serialized) as Partial<FeedbackSettings>;
      return Object.freeze({
        bgmEnabled: typeof parsed.bgmEnabled === "boolean"
          ? parsed.bgmEnabled
          : DEFAULT_FEEDBACK_SETTINGS.bgmEnabled,
        sfxEnabled: typeof parsed.sfxEnabled === "boolean"
          ? parsed.sfxEnabled
          : DEFAULT_FEEDBACK_SETTINGS.sfxEnabled,
        hapticsEnabled: typeof parsed.hapticsEnabled === "boolean"
          ? parsed.hapticsEnabled
          : DEFAULT_FEEDBACK_SETTINGS.hapticsEnabled,
      });
    } catch {
      return DEFAULT_FEEDBACK_SETTINGS;
    }
  }
}
