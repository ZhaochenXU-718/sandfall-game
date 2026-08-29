export const HIGH_SCORE_STORAGE_KEY = "sandfall.high-score.v1";

export interface StringStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Small storage adapter so browser and mini-game persistence can share the UI flow. */
export class HighScoreStore {
  private cachedScore = 0;

  public constructor(
    private readonly storage?: StringStorage,
    private readonly storageKey = HIGH_SCORE_STORAGE_KEY,
  ) {
    this.cachedScore = this.readStoredScore();
  }

  public get value(): number {
    return this.cachedScore;
  }

  /** Records a score if it is a new high, and always returns the current high score. */
  public record(score: number): number {
    const normalized = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0));
    if (normalized <= this.cachedScore) {
      return this.cachedScore;
    }
    this.cachedScore = normalized;
    try {
      this.storage?.setItem(this.storageKey, String(normalized));
    } catch {
      // Storage can be disabled or full; the in-memory value still works this run.
    }
    return this.cachedScore;
  }

  private readStoredScore(): number {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      if (raw === undefined || raw === null || raw.trim() === "") {
        return 0;
      }
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
    } catch {
      return 0;
    }
  }
}
