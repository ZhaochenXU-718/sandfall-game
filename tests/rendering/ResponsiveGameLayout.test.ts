import { describe, expect, it } from "vitest";
import { fitResponsiveGameLayout } from "../../assets/scripts/rendering/ResponsiveGameLayout";

describe("fitResponsiveGameLayout", () => {
  it("uses the full 14-column board on a common mobile viewport", () => {
    expect(fitResponsiveGameLayout({
      visibleWidth: 442,
      visibleHeight: 800,
      macroWidth: 14,
      macroHeight: 24,
    })).toEqual({
      cellSize: 28,
      boardWidth: 392,
      boardHeight: 672,
      boardX: 0,
      boardY: -54,
      boardTop: 282,
      hudPanelY: 342,
      pauseY: 367,
      statusX: -140,
      nextX: 152,
      feedbackY: 245,
    });
  });

  it("keeps the HUD and board inside asymmetric safe-area insets", () => {
    const layout = fitResponsiveGameLayout({
      visibleWidth: 442,
      visibleHeight: 800,
      macroWidth: 14,
      macroHeight: 24,
      safeAreaInsets: { top: 72, right: 20, bottom: 24, left: 8 },
    });

    expect(layout.hudPanelY).toBe(270);
    expect(layout.pauseY).toBe(295);
    expect(layout.boardX).toBe(-6);
    expect(layout.cellSize).toBe(24);
    expect(layout.boardY - layout.boardHeight / 2).toBe(-366);
    expect(layout.boardTop).toBeLessThanOrEqual(800 / 2 - 72 - 108);
  });

  it("shrinks uniformly on a narrow tall screen without stretching cells", () => {
    const layout = fitResponsiveGameLayout({
      visibleWidth: 360,
      visibleHeight: 800,
      macroWidth: 14,
      macroHeight: 24,
    });

    expect(layout.cellSize).toBe(24);
    expect(layout.boardWidth).toBe(336);
    expect(layout.boardHeight).toBe(576);
    expect(layout.boardWidth / 14).toBe(layout.boardHeight / 24);
  });

  it("rejects impossible or invalid layouts", () => {
    expect(() => fitResponsiveGameLayout({
      visibleWidth: 20,
      visibleHeight: 20,
      macroWidth: 14,
      macroHeight: 24,
    })).toThrow(RangeError);
    expect(() => fitResponsiveGameLayout({
      visibleWidth: 360,
      visibleHeight: 800,
      macroWidth: 14.5,
      macroHeight: 24,
    })).toThrow(RangeError);
    expect(() => fitResponsiveGameLayout({
      visibleWidth: 360,
      visibleHeight: 800,
      macroWidth: 14,
      macroHeight: 24,
      safeAreaInsets: { top: -1, right: 0, bottom: 0, left: 0 },
    })).toThrow(RangeError);
  });
});
