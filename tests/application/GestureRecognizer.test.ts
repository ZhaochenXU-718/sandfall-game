import { describe, expect, it } from "vitest";
import { GestureRecognizer } from "../../assets/scripts/application/GestureRecognizer";

describe("GestureRecognizer", () => {
  it("maps a short tap to one clockwise rotation", () => {
    const gesture = new GestureRecognizer();
    gesture.begin(120, 300);
    gesture.advance(0.08);

    expect(gesture.end(125, 296)).toEqual([{ type: "rotateCW" }]);
    expect(gesture.isTracking).toBe(false);
  });

  it("maps horizontal drag distance to discrete movement without rotating", () => {
    const gesture = new GestureRecognizer();
    gesture.begin(100, 300);

    expect(gesture.move(116, 298)).toEqual([
      { type: "moveHorizontal", direction: 1, steps: 1 },
    ]);
    expect(gesture.move(159, 298)).toEqual([
      { type: "moveHorizontal", direction: 1, steps: 1 },
    ]);
    expect(gesture.move(92, 299)).toEqual([
      { type: "moveHorizontal", direction: -1, steps: 2 },
    ]);
    expect(gesture.end(92, 299)).toEqual([]);
  });

  it("starts soft drop after a stationary long press and releases it on end", () => {
    const gesture = new GestureRecognizer();
    gesture.begin(100, 300);

    expect(gesture.move(104, 297)).toEqual([]);
    expect(gesture.advance(0.179)).toEqual([]);
    expect(gesture.advance(0.001)).toEqual([{ type: "softDrop", active: true }]);
    expect(gesture.move(106, 295)).toEqual([]);
    expect(gesture.end(106, 295)).toEqual([{ type: "softDrop", active: false }]);
  });

  it("maps a fast downward swipe to one hard drop", () => {
    const gesture = new GestureRecognizer();
    gesture.begin(100, 300);
    gesture.advance(0.08);

    expect(gesture.move(104, 220)).toEqual([]);
    expect(gesture.move(104, 180)).toEqual([]);
    expect(gesture.end(104, 180)).toEqual([{ type: "hardDrop" }]);
  });

  it("reserves a downward swipe for hard drop instead of starting soft drop", () => {
    const gesture = new GestureRecognizer();
    gesture.begin(100, 300);
    gesture.advance(0.08);
    gesture.move(102, 210);

    expect(gesture.advance(0.1)).toEqual([]);
    expect(gesture.end(102, 210)).toEqual([{ type: "hardDrop" }]);
  });

  it("does not hard drop after a slow downward drag", () => {
    const gesture = new GestureRecognizer();
    gesture.begin(100, 300);
    expect(gesture.move(100, 220)).toEqual([]);
    gesture.advance(0.3);
    expect(gesture.end(100, 220)).toEqual([]);
  });

  it("does not guess an intent for a diagonal drag", () => {
    const gesture = new GestureRecognizer();
    gesture.begin(100, 300);
    gesture.advance(0.1);

    expect(gesture.move(145, 255)).toEqual([]);
    expect(gesture.end(145, 255)).toEqual([]);
  });

  it("releases an active soft drop when the touch is cancelled", () => {
    const gesture = new GestureRecognizer();
    gesture.begin(100, 300);
    gesture.advance(0.18);

    expect(gesture.cancel()).toEqual([{ type: "softDrop", active: false }]);
    expect(gesture.cancel()).toEqual([]);
  });

  it("rejects invalid options, deltas, and coordinates", () => {
    expect(() => new GestureRecognizer({ horizontalStepDistance: 0 })).toThrow(RangeError);
    expect(() => new GestureRecognizer({ softDropMaxDriftDistance: 0 })).toThrow(RangeError);
    expect(() => new GestureRecognizer({ directionBias: 0.9 })).toThrow(RangeError);
    const gesture = new GestureRecognizer();
    expect(() => gesture.begin(Number.NaN, 0)).toThrow(RangeError);
    expect(() => gesture.advance(-0.01)).toThrow(RangeError);
  });
});
