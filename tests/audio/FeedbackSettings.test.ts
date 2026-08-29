import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEEDBACK_SETTINGS,
  FEEDBACK_SETTINGS_STORAGE_KEY,
  FeedbackSettingsStore,
  type FeedbackSettingsStorage,
} from "../../assets/scripts/audio/FeedbackSettings";

class MemoryStorage implements FeedbackSettingsStorage {
  public readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("FeedbackSettingsStore", () => {
  it("uses enabled defaults without persisted settings", () => {
    expect(new FeedbackSettingsStore().value).toEqual(DEFAULT_FEEDBACK_SETTINGS);
  });

  it("persists partial updates without changing other channels", () => {
    const storage = new MemoryStorage();
    const store = new FeedbackSettingsStore(storage);
    expect(store.update({ bgmEnabled: false })).toEqual({
      bgmEnabled: false,
      sfxEnabled: true,
      hapticsEnabled: true,
    });

    expect(new FeedbackSettingsStore(storage).value).toEqual(store.value);
    expect(storage.values.has(FEEDBACK_SETTINGS_STORAGE_KEY)).toBe(true);
  });

  it("falls back safely when persisted data is invalid", () => {
    const storage = new MemoryStorage();
    storage.values.set(FEEDBACK_SETTINGS_STORAGE_KEY, "not-json");
    expect(new FeedbackSettingsStore(storage).value).toEqual(DEFAULT_FEEDBACK_SETTINGS);
  });
});
