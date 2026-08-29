import { describe, expect, it } from "vitest";
import {
  HIGH_SCORE_STORAGE_KEY,
  HighScoreStore,
  type StringStorage,
} from "../../assets/scripts/application/HighScoreStore";

class MemoryStorage implements StringStorage {
  public readonly values = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("HighScoreStore", () => {
  it("loads and updates only a new local high score", () => {
    const storage = new MemoryStorage();
    storage.values.set(HIGH_SCORE_STORAGE_KEY, "120");
    const highScore = new HighScoreStore(storage);

    expect(highScore.value).toBe(120);
    expect(highScore.record(80)).toBe(120);
    expect(highScore.record(245.9)).toBe(245);
    expect(storage.values.get(HIGH_SCORE_STORAGE_KEY)).toBe("245");
  });

  it("falls back safely when persisted data is invalid or storage fails", () => {
    const invalid = new MemoryStorage();
    invalid.values.set(HIGH_SCORE_STORAGE_KEY, "not-a-score");
    expect(new HighScoreStore(invalid).value).toBe(0);

    const unavailable: StringStorage = {
      getItem: () => { throw new Error("disabled"); },
      setItem: () => { throw new Error("disabled"); },
    };
    const highScore = new HighScoreStore(unavailable);
    expect(highScore.record(99)).toBe(99);
    expect(highScore.value).toBe(99);
  });

  it("keeps scores for different mode configurations independent", () => {
    const storage = new MemoryStorage();
    const progressive = new HighScoreStore(storage);
    const classic = new HighScoreStore(storage, "sandfall.high-score.classic.c3.s900.v1");

    progressive.record(500);
    classic.record(1200);

    expect(new HighScoreStore(storage).value).toBe(500);
    expect(new HighScoreStore(storage, "sandfall.high-score.classic.c3.s900.v1").value).toBe(1200);
  });
});
