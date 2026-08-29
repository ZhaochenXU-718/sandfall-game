import { describe, expect, it, vi } from "vitest";
import { PlatformHapticsService } from "../../assets/scripts/audio/HapticsService";

describe("PlatformHapticsService", () => {
  it("prefers the WeChat native API", () => {
    const wxVibrate = vi.fn();
    const ttVibrate = vi.fn();
    const webVibrate = vi.fn();
    const service = new PlatformHapticsService({
      wx: { vibrateShort: wxVibrate },
      tt: { vibrateShort: ttVibrate },
      navigator: { vibrate: webVibrate },
    });

    service.vibrate("medium");
    expect(wxVibrate).toHaveBeenCalledWith({ type: "medium" });
    expect(ttVibrate).not.toHaveBeenCalled();
    expect(webVibrate).not.toHaveBeenCalled();
  });

  it("uses Douyin before the Web fallback", () => {
    const ttVibrate = vi.fn();
    const webVibrate = vi.fn();
    new PlatformHapticsService({
      tt: { vibrateShort: ttVibrate },
      navigator: { vibrate: webVibrate },
    }).vibrate("heavy");

    expect(ttVibrate).toHaveBeenCalledWith({ type: "heavy" });
    expect(webVibrate).not.toHaveBeenCalled();
  });

  it("maps strength to a Web vibration duration and ignores failures", () => {
    const webVibrate = vi.fn(() => true);
    new PlatformHapticsService({ navigator: { vibrate: webVibrate } }).vibrate("heavy");
    expect(webVibrate).toHaveBeenCalledWith(38);

    expect(() => new PlatformHapticsService({
      navigator: { vibrate: () => { throw new Error("unsupported"); } },
    }).vibrate("light")).not.toThrow();
  });
});
