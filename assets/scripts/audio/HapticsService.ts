export type HapticStrength = "light" | "medium" | "heavy";

export interface HapticsService {
  vibrate(strength: HapticStrength): void;
  playSandifyTexture(): void;
}

interface VibrationCallbacks {
  readonly success?: () => void;
  readonly fail?: (error: unknown) => void;
  readonly complete?: () => void;
}

interface WeChatVibrationApi {
  vibrateShort(options?: VibrationCallbacks & { readonly type?: HapticStrength }): void;
}

interface DouyinVibrationApi {
  vibrateShort(options?: VibrationCallbacks): void;
}

interface WebVibrationApi {
  vibrate(pattern: number | number[]): boolean;
}

export interface HapticsPlatformGlobals {
  readonly wx?: WeChatVibrationApi;
  readonly tt?: DouyinVibrationApi;
  readonly navigator?: WebVibrationApi;
}

const NATIVE_PULSE_DELAYS_MS: Readonly<Record<HapticStrength, readonly number[]>> = Object.freeze({
  light: Object.freeze([0]),
  medium: Object.freeze([0, 55]),
  heavy: Object.freeze([0, 60, 120]),
});

const WEB_VIBRATION_PATTERNS: Readonly<Record<HapticStrength, readonly number[]>> = Object.freeze({
  light: Object.freeze([12]),
  medium: Object.freeze([22, 40, 22]),
  heavy: Object.freeze([32, 42, 32, 42, 32]),
});

interface NativePulse {
  readonly delayMs: number;
  readonly strength: HapticStrength;
}

const SANDIFY_NATIVE_PULSES: readonly NativePulse[] = Object.freeze([
  Object.freeze({ delayMs: 0, strength: "light" }),
  Object.freeze({ delayMs: 38, strength: "medium" }),
  Object.freeze({ delayMs: 82, strength: "light" }),
  Object.freeze({ delayMs: 135, strength: "light" }),
]);

const SANDIFY_WEB_PATTERN = Object.freeze([10, 28, 14, 30, 10, 43, 10]);

/** Uses distinct short-pulse patterns on mini-game hosts, then the Web Vibration API. */
export class PlatformHapticsService implements HapticsService {
  private pulseGeneration = 0;

  public constructor(
    private readonly platform: HapticsPlatformGlobals = globalThis as HapticsPlatformGlobals,
  ) {}

  public vibrate(strength: HapticStrength): void {
    const pulses = NATIVE_PULSE_DELAYS_MS[strength].map((delayMs) => ({
      delayMs,
      strength,
    }));
    if (this.playNativePattern(pulses)) {
      return;
    }

    this.vibrateWeb(WEB_VIBRATION_PATTERNS[strength]);
  }

  public playSandifyTexture(): void {
    if (this.playNativePattern(SANDIFY_NATIVE_PULSES)) {
      return;
    }
    this.vibrateWeb(SANDIFY_WEB_PATTERN);
  }

  private playNativePattern(pulses: readonly NativePulse[]): boolean {
    const firstPulse = pulses[0];
    if (firstPulse === undefined) {
      return false;
    }
    const nativePulse = this.createNativePulse(firstPulse.strength);
    if (nativePulse === undefined || !this.triggerNativePulse(nativePulse)) {
      return false;
    }

    const generation = ++this.pulseGeneration;
    for (const pulse of pulses.slice(1)) {
      setTimeout(() => {
        if (generation !== this.pulseGeneration) {
          return;
        }
        const scheduledPulse = this.createNativePulse(pulse.strength);
        if (scheduledPulse !== undefined) {
          this.triggerNativePulse(scheduledPulse);
        }
      }, pulse.delayMs);
    }
    return true;
  }

  private vibrateWeb(pattern: readonly number[]): void {
    ++this.pulseGeneration;
    try {
      this.platform.navigator?.vibrate([...pattern]);
    } catch {
      // Vibration is optional and unsupported devices should degrade silently.
    }
  }

  private createNativePulse(strength: HapticStrength): (() => void) | undefined {
    if (this.platform.wx !== undefined) {
      return () => this.platform.wx?.vibrateShort({ type: strength });
    }
    if (this.platform.tt !== undefined) {
      // Douyin's vibrateShort has no strength parameter; pulse count supplies intensity.
      return () => this.platform.tt?.vibrateShort();
    }
    return undefined;
  }

  private triggerNativePulse(pulse: () => void): boolean {
    try {
      pulse();
      return true;
    } catch {
      return false;
    }
  }
}
