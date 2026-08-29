export type HapticStrength = "light" | "medium" | "heavy";

export interface HapticsService {
  vibrate(strength: HapticStrength): void;
}

interface MiniGameVibrationApi {
  vibrateShort(options?: { readonly type?: HapticStrength }): void;
}

interface WebVibrationApi {
  vibrate(pattern: number | number[]): boolean;
}

export interface HapticsPlatformGlobals {
  readonly wx?: MiniGameVibrationApi;
  readonly tt?: MiniGameVibrationApi;
  readonly navigator?: WebVibrationApi;
}

const WEB_VIBRATION_MS: Readonly<Record<HapticStrength, number>> = Object.freeze({
  light: 12,
  medium: 24,
  heavy: 38,
});

/** Uses a mini-game native vibrator when present, then the Web Vibration API. */
export class PlatformHapticsService implements HapticsService {
  public constructor(
    private readonly platform: HapticsPlatformGlobals = globalThis as HapticsPlatformGlobals,
  ) {}

  public vibrate(strength: HapticStrength): void {
    try {
      const nativeApi = this.platform.wx ?? this.platform.tt;
      if (nativeApi !== undefined) {
        nativeApi.vibrateShort({ type: strength });
        return;
      }
      this.platform.navigator?.vibrate(WEB_VIBRATION_MS[strength]);
    } catch {
      // Vibration is optional and unsupported devices should degrade silently.
    }
  }
}
