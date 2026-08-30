export type LeaderboardResult = "shown" | "busy" | "unavailable";

export interface LeaderboardService {
  /** True when the host can draw a ranking; UI entry points hide when false. */
  readonly available: boolean;
  /** Hosts the score so the player becomes visible on friends' rankings. */
  submitScore(score: number): void;
  /** Opens the platform-drawn friend ranking. Never rejects. */
  showFriendRanking(): Promise<LeaderboardResult>;
}

interface DouyinCallbackError {
  readonly errMsg?: string;
  readonly errNo?: number;
}

interface DouyinCallbacks {
  readonly success?: () => void;
  readonly fail?: (error: DouyinCallbackError) => void;
  readonly complete?: () => void;
}

/** `dataType` 0 ranks numerically; 1 ranks enum tiers by `priority`. */
type DouyinRankDataType = 0 | 1;

export interface DouyinRankDataOptions extends DouyinCallbacks {
  readonly dataType: DouyinRankDataType;
  readonly value: string;
  readonly priority?: number;
  readonly extra?: string;
  readonly zoneId?: string;
}

export interface DouyinRankListOptions extends DouyinCallbacks {
  readonly dataType: DouyinRankDataType;
  readonly rankType: "day" | "week" | "month" | "all";
  readonly relationType?: "default" | "all" | "friend";
  readonly zoneId?: string;
  readonly suffix?: string;
  readonly rankTitle?: string;
}

/** Only the members this service touches; the host exposes many more. */
export interface DouyinRankApi {
  login?(options: DouyinCallbacks & { readonly force?: boolean }): void;
  setImRankData?(options: DouyinRankDataOptions): void;
  getImRankList?(options: DouyinRankListOptions): void;
}

export interface LeaderboardPlatformGlobals {
  readonly tt?: DouyinRankApi;
}

export interface DouyinLeaderboardOptions {
  /** 'default' is the live partition; 'test' is isolated from it. */
  readonly zoneId?: string;
  readonly rankTitle?: string;
  readonly suffix?: string;
}

// The host rejects values outside [0, int32_MAX) when dataType is 0.
const MAX_RANK_VALUE = 2147483646;

/** Douyin friend ranking. The host draws the list, so this only feeds it data. */
export class DouyinLeaderboardService implements LeaderboardService {
  private showing = false;

  public constructor(
    private readonly options: DouyinLeaderboardOptions = {},
    private readonly platform: LeaderboardPlatformGlobals =
      globalThis as LeaderboardPlatformGlobals,
  ) {}

  /**
   * The rank methods arrived in base library 2.70.0, so a present `tt` is not
   * enough — older hosts leave them undefined.
   */
  public get available(): boolean {
    const tt = this.platform.tt;
    return typeof tt?.setImRankData === "function"
      && typeof tt?.getImRankList === "function";
  }

  public submitScore(score: number): void {
    const tt = this.platform.tt;
    if (typeof tt?.setImRankData !== "function") {
      return;
    }
    const normalized = Math.min(
      MAX_RANK_VALUE,
      Math.max(0, Math.floor(Number.isFinite(score) ? score : 0)),
    );
    try {
      tt.setImRankData({
        dataType: 0,
        value: String(normalized),
        zoneId: this.zoneId,
      });
    } catch {
      // Ranking is optional; a failed upload must not disturb the game over flow.
    }
  }

  public showFriendRanking(): Promise<LeaderboardResult> {
    const tt = this.platform.tt;
    if (typeof tt?.getImRankList !== "function") {
      return Promise.resolve<LeaderboardResult>("unavailable");
    }
    // Error 21105 is "rank list is showing"; opening twice can wedge the host UI.
    if (this.showing) {
      return Promise.resolve<LeaderboardResult>("busy");
    }
    this.showing = true;
    return this.login()
      .then((loggedIn) => (loggedIn ? this.openRankList() : "unavailable"))
      .then((result: LeaderboardResult) => {
        this.showing = false;
        return result;
      });
  }

  private get zoneId(): string {
    return this.options.zoneId ?? "default";
  }

  /** Showing the list without a logged-in user can crash the host. */
  private login(): Promise<boolean> {
    const login = this.platform.tt?.login;
    if (typeof login !== "function") {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      try {
        login.call(this.platform.tt, {
          success: () => resolve(true),
          fail: () => resolve(false),
        });
      } catch {
        resolve(false);
      }
    });
  }

  private openRankList(): Promise<LeaderboardResult> {
    const getImRankList = this.platform.tt?.getImRankList;
    if (typeof getImRankList !== "function") {
      return Promise.resolve<LeaderboardResult>("unavailable");
    }
    return new Promise<LeaderboardResult>((resolve) => {
      try {
        getImRankList.call(this.platform.tt, {
          dataType: 0,
          rankType: "all",
          relationType: "friend",
          zoneId: this.zoneId,
          rankTitle: this.options.rankTitle ?? "好友排行",
          suffix: this.options.suffix ?? "分",
          success: () => resolve("shown"),
          fail: (error) => resolve(error?.errNo === 21105 ? "busy" : "unavailable"),
        });
      } catch {
        resolve("unavailable");
      }
    });
  }
}

/** Used on Web and WeChat builds, where no ranking host exists yet. */
export class NoopLeaderboardService implements LeaderboardService {
  public readonly available = false;

  public submitScore(score: number): void {
    void score; // No ranking host; the score still lands in the local high score store.
  }

  public showFriendRanking(): Promise<LeaderboardResult> {
    return Promise.resolve<LeaderboardResult>("unavailable");
  }
}

/** Picks the ranking host at construction time instead of at every call site. */
export function createLeaderboardService(
  options: DouyinLeaderboardOptions = {},
  platform: LeaderboardPlatformGlobals = globalThis as LeaderboardPlatformGlobals,
): LeaderboardService {
  const service = new DouyinLeaderboardService(options, platform);
  return service.available ? service : new NoopLeaderboardService();
}
