import { describe, expect, it, vi } from "vitest";
import {
  createLeaderboardService,
  DouyinLeaderboardService,
  NoopLeaderboardService,
  type DouyinRankApi,
  type DouyinRankDataOptions,
  type DouyinRankListOptions,
} from "../../assets/scripts/platform/LeaderboardService";

function douyinHost(overrides: Partial<DouyinRankApi> = {}): { readonly tt: DouyinRankApi } {
  return {
    tt: {
      login: (options) => options.success?.(),
      setImRankData: () => undefined,
      getImRankList: (options) => options.success?.(),
      ...overrides,
    },
  };
}

describe("DouyinLeaderboardService availability", () => {
  it("is unavailable without a host", () => {
    expect(new DouyinLeaderboardService({}, {}).available).toBe(false);
  });

  it("is unavailable on base libraries older than 2.70.0", () => {
    // `tt` exists but the rank methods were only added in 2.70.0.
    const service = new DouyinLeaderboardService({}, { tt: { login: () => undefined } });

    expect(service.available).toBe(false);
  });

  it("is available once both rank methods exist", () => {
    expect(new DouyinLeaderboardService({}, douyinHost()).available).toBe(true);
  });
});

describe("DouyinLeaderboardService.submitScore", () => {
  it("uploads the score as a numeric string in the configured zone", () => {
    const setImRankData = vi.fn<(options: DouyinRankDataOptions) => void>();
    const service = new DouyinLeaderboardService(
      { zoneId: "test" },
      douyinHost({ setImRankData }),
    );

    service.submitScore(12340);

    expect(setImRankData).toHaveBeenCalledWith({
      dataType: 0,
      value: "12340",
      zoneId: "test",
    });
  });

  it("defaults to the live zone", () => {
    const setImRankData = vi.fn<(options: DouyinRankDataOptions) => void>();
    new DouyinLeaderboardService({}, douyinHost({ setImRankData })).submitScore(7);

    expect(setImRankData.mock.calls[0]?.[0].zoneId).toBe("default");
  });

  it("clamps to the host's accepted range and drops fractions", () => {
    const setImRankData = vi.fn<(options: DouyinRankDataOptions) => void>();
    const service = new DouyinLeaderboardService({}, douyinHost({ setImRankData }));

    service.submitScore(-5);
    service.submitScore(10.9);
    // The host rejects dataType 0 values at or above int32_MAX.
    service.submitScore(3_000_000_000);
    // Non-finite input is garbage, not a huge score; HighScoreStore treats it the same way.
    service.submitScore(Number.POSITIVE_INFINITY);
    service.submitScore(Number.NaN);

    expect(setImRankData.mock.calls.map((call) => call[0].value)).toEqual([
      "0",
      "10",
      "2147483646",
      "0",
      "0",
    ]);
  });

  it("stays silent when the host throws or is absent", () => {
    const throwing = new DouyinLeaderboardService({}, douyinHost({
      setImRankData: () => {
        throw new Error("host failure");
      },
    }));

    expect(() => throwing.submitScore(1)).not.toThrow();
    expect(() => new DouyinLeaderboardService({}, {}).submitScore(1)).not.toThrow();
  });
});

describe("DouyinLeaderboardService.showFriendRanking", () => {
  it("logs in first, then requests the friend ranking", async () => {
    const calls: string[] = [];
    const getImRankList = vi.fn<(options: DouyinRankListOptions) => void>(
      (options) => {
        calls.push("rank");
        options.success?.();
      },
    );
    const service = new DouyinLeaderboardService(
      { rankTitle: "好友排行", suffix: "分" },
      douyinHost({
        login: (options) => {
          calls.push("login");
          options.success?.();
        },
        getImRankList,
      }),
    );

    await expect(service.showFriendRanking()).resolves.toBe("shown");
    expect(calls).toEqual(["login", "rank"]);
    expect(getImRankList).toHaveBeenCalledWith(expect.objectContaining({
      dataType: 0,
      rankType: "all",
      relationType: "friend",
      zoneId: "default",
      rankTitle: "好友排行",
      suffix: "分",
    }));
  });

  it("never opens the global ranking", async () => {
    const getImRankList = vi.fn<(options: DouyinRankListOptions) => void>(
      (options) => options.success?.(),
    );
    await new DouyinLeaderboardService({}, douyinHost({ getImRankList })).showFriendRanking();

    expect(getImRankList.mock.calls[0]?.[0].relationType).toBe("friend");
  });

  it("does not open the list when login fails", async () => {
    const getImRankList = vi.fn<(options: DouyinRankListOptions) => void>();
    const service = new DouyinLeaderboardService({}, douyinHost({
      login: (options) => options.fail?.({ errNo: 10601, errMsg: "not login" }),
      getImRankList,
    }));

    await expect(service.showFriendRanking()).resolves.toBe("unavailable");
    expect(getImRankList).not.toHaveBeenCalled();
  });

  it("reports a busy host instead of reopening the list", async () => {
    const service = new DouyinLeaderboardService({}, douyinHost({
      getImRankList: (options) => options.fail?.({ errNo: 21105, errMsg: "rank list is showing" }),
    }));

    await expect(service.showFriendRanking()).resolves.toBe("busy");
  });

  it("rejects a second request while the first is still settling", async () => {
    let release: (() => void) | undefined;
    const getImRankList = vi.fn<(options: DouyinRankListOptions) => void>((options) => {
      release = () => options.success?.();
    });
    const service = new DouyinLeaderboardService({}, douyinHost({ getImRankList }));

    const first = service.showFriendRanking();
    await Promise.resolve();
    await expect(service.showFriendRanking()).resolves.toBe("busy");

    release?.();
    await expect(first).resolves.toBe("shown");
    expect(getImRankList).toHaveBeenCalledTimes(1);
  });

  it("clears the guard so a later request can open the list again", async () => {
    const service = new DouyinLeaderboardService({}, douyinHost());

    await expect(service.showFriendRanking()).resolves.toBe("shown");
    await expect(service.showFriendRanking()).resolves.toBe("shown");
  });

  it("survives a host that throws", async () => {
    const service = new DouyinLeaderboardService({}, douyinHost({
      getImRankList: () => {
        throw new Error("host failure");
      },
    }));

    await expect(service.showFriendRanking()).resolves.toBe("unavailable");
  });

  it("is unavailable without a host", async () => {
    await expect(
      new DouyinLeaderboardService({}, {}).showFriendRanking(),
    ).resolves.toBe("unavailable");
  });
});

describe("createLeaderboardService", () => {
  it("returns the Douyin service on a capable host", () => {
    expect(createLeaderboardService({}, douyinHost()))
      .toBeInstanceOf(DouyinLeaderboardService);
  });

  it("falls back to a no-op service on Web and WeChat", () => {
    const service = createLeaderboardService({}, {});

    expect(service).toBeInstanceOf(NoopLeaderboardService);
    expect(service.available).toBe(false);
  });
});

describe("NoopLeaderboardService", () => {
  it("absorbs every call", async () => {
    const service = new NoopLeaderboardService();

    expect(() => service.submitScore(100)).not.toThrow();
    await expect(service.showFriendRanking()).resolves.toBe("unavailable");
  });
});
