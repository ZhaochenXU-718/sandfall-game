import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformHapticsService } from "../../assets/scripts/audio/HapticsService";

describe("PlatformHapticsService", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("prefers the WeChat native API", () => {
    vi.useFakeTimers();
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
    expect(wxVibrate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(55);
    expect(wxVibrate).toHaveBeenCalledTimes(2);
    expect(ttVibrate).not.toHaveBeenCalled();
    expect(webVibrate).not.toHaveBeenCalled();
  });

  it("uses a three-pulse heavy pattern on Douyin without unsupported options", () => {
    vi.useFakeTimers();
    const ttVibrate = vi.fn();
    const webVibrate = vi.fn();
    new PlatformHapticsService({
      tt: { vibrateShort: ttVibrate },
      navigator: { vibrate: webVibrate },
    }).vibrate("heavy");

    expect(ttVibrate).toHaveBeenCalledWith();
    expect(ttVibrate).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120);
    expect(ttVibrate).toHaveBeenCalledTimes(3);
    expect(webVibrate).not.toHaveBeenCalled();
  });

  it("maps strength to a Web vibration pattern and ignores failures", () => {
    const webVibrate = vi.fn(() => true);
    new PlatformHapticsService({ navigator: { vibrate: webVibrate } }).vibrate("heavy");
    expect(webVibrate).toHaveBeenCalledWith([32, 42, 32, 42, 32]);

    expect(() => new PlatformHapticsService({
      navigator: { vibrate: () => { throw new Error("unsupported"); } },
    }).vibrate("light")).not.toThrow();
  });

  it("cancels the remainder of an older pattern when new feedback starts", () => {
    vi.useFakeTimers();
    const ttVibrate = vi.fn();
    const service = new PlatformHapticsService({ tt: { vibrateShort: ttVibrate } });

    service.vibrate("heavy");
    vi.advanceTimersByTime(30);
    service.vibrate("light");
    vi.advanceTimersByTime(200);

    expect(ttVibrate).toHaveBeenCalledTimes(2);
  });

  it("falls back to Web vibration when the native call throws", () => {
    const webVibrate = vi.fn(() => true);
    new PlatformHapticsService({
      wx: { vibrateShort: () => { throw new Error("unavailable"); } },
      navigator: { vibrate: webVibrate },
    }).vibrate("light");

    expect(webVibrate).toHaveBeenCalledWith([12]);
  });

  it("plays an uneven sandify texture with alternating WeChat strength", () => {
    vi.useFakeTimers();
    const wxVibrate = vi.fn();
    const service = new PlatformHapticsService({ wx: { vibrateShort: wxVibrate } });

    service.playSandifyTexture();
    expect(wxVibrate).toHaveBeenLastCalledWith({ type: "light" });
    vi.advanceTimersByTime(38);
    expect(wxVibrate).toHaveBeenLastCalledWith({ type: "medium" });
    vi.advanceTimersByTime(44);
    expect(wxVibrate).toHaveBeenLastCalledWith({ type: "light" });
    vi.advanceTimersByTime(53);

    expect(wxVibrate).toHaveBeenCalledTimes(4);
    expect(wxVibrate).toHaveBeenLastCalledWith({ type: "light" });
  });

  it("uses four parameterless sandify pulses on Douyin", () => {
    vi.useFakeTimers();
    const ttVibrate = vi.fn();
    const service = new PlatformHapticsService({ tt: { vibrateShort: ttVibrate } });

    service.playSandifyTexture();
    vi.advanceTimersByTime(135);

    expect(ttVibrate).toHaveBeenCalledTimes(4);
    expect(ttVibrate).toHaveBeenLastCalledWith();
  });

  it("maps the sandify texture to an equivalent Web vibration pattern", () => {
    const webVibrate = vi.fn(() => true);

    new PlatformHapticsService({ navigator: { vibrate: webVibrate } }).playSandifyTexture();

    expect(webVibrate).toHaveBeenCalledWith([10, 28, 14, 30, 10, 43, 10]);
  });
});
