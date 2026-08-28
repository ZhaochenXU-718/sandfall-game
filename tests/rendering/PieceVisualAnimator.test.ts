import { describe, expect, it } from "vitest";
import { O_PIECE } from "../../assets/scripts/core/PieceDefinitions";
import type { ActivePieceState } from "../../assets/scripts/core/PieceTypes";
import { PieceVisualAnimator } from "../../assets/scripts/rendering/PieceVisualAnimator";

function piece(x: number, y: number): ActivePieceState {
  return {
    definition: O_PIECE,
    rotation: 0,
    x,
    y,
    color: 1,
    lockElapsedMs: 0,
    lockResets: 0,
    lockReady: false,
  };
}

function animator(): PieceVisualAnimator {
  return new PieceVisualAnimator({
    moveDurationSeconds: 0.1,
    sandifyDurationSeconds: 0.2,
  });
}

describe("PieceVisualAnimator", () => {
  it("smooths horizontal grid movement", () => {
    const visual = animator();
    expect(visual.update(0, piece(0, 0), undefined, 0)?.x).toBe(0);
    expect(visual.update(0, piece(1, 0), undefined, 0)?.x).toBe(0);
    expect(visual.update(0.05, piece(1, 0), undefined, 0)?.x).toBeCloseTo(0.5);
    expect(visual.update(0.05, piece(1, 0), undefined, 0)?.x).toBe(1);
  });

  it("renders continuous fall progress without pausing between logical rows", () => {
    const visual = animator();
    expect(visual.update(0, piece(0, 0), undefined, 0, 0)?.y).toBe(0);
    expect(visual.update(0.1, piece(0, 0), undefined, 0, 0.5)?.y).toBeCloseTo(0.5);
    expect(visual.update(0.1, piece(0, 0), undefined, 0, 0.99)?.y).toBeCloseTo(0.99);
    expect(visual.update(0, piece(0, 1), undefined, 0, 0)?.y).toBe(1);
  });

  it("fades the locked block while its sand texture is revealed", () => {
    const visual = animator();
    const locked = piece(0, 4);
    visual.update(0, locked, undefined, 0);
    const started = visual.update(0, undefined, locked, 1);
    expect(started?.mode).toBe("sandifying");
    expect(started?.opacity).toBe(1);
    expect(visual.update(0.1, undefined, locked, 1)?.opacity).toBeCloseTo(0.5);
    expect(visual.update(0.1, undefined, locked, 1)).toBeUndefined();
  });

  it("rejects invalid animation timing", () => {
    expect(() => new PieceVisualAnimator({
      moveDurationSeconds: -1,
      sandifyDurationSeconds: 0.2,
    })).toThrow(RangeError);

    const visual = animator();
    expect(() => visual.update(0, piece(0, 0), undefined, 0, 1.01)).toThrow(RangeError);
  });
});
