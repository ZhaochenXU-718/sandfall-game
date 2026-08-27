import { describe, expect, it } from "vitest";
import { StableDetector } from "../../assets/scripts/core/StableDetector";

describe("StableDetector", () => {
  it("becomes stable on the fourth motionless tick", () => {
    const detector = new StableDetector(4);
    for (let tick = 0; tick < 3; tick += 1) {
      detector.update(0);
      expect(detector.isStable).toBe(false);
    }
    detector.update(0);
    expect(detector.isStable).toBe(true);
  });

  it("resets its counter after any movement", () => {
    const detector = new StableDetector(4);
    detector.update(0);
    detector.update(0);
    detector.update(1);
    expect(detector.count).toBe(0);
  });
});
