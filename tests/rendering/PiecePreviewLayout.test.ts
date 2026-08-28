import { describe, expect, it } from "vitest";
import { I_PIECE, O_PIECE, T_PIECE } from "../../assets/scripts/core/PieceDefinitions";
import { layoutPiecePreview } from "../../assets/scripts/rendering/PiecePreviewLayout";

describe("layoutPiecePreview", () => {
  it("centers pieces using their occupied bounds", () => {
    const layout = layoutPiecePreview(T_PIECE, 60, 50, 15);

    expect(layout.cellSize).toBe(15);
    expect(Math.min(...layout.cells.map((cell) => cell.x))).toBe(-22.5);
    expect(Math.max(...layout.cells.map((cell) => cell.x + layout.cellSize))).toBe(22.5);
    expect(Math.min(...layout.cells.map((cell) => cell.y))).toBe(-15);
    expect(Math.max(...layout.cells.map((cell) => cell.y + layout.cellSize))).toBe(15);
  });

  it("scales long pieces down to fit the available width", () => {
    const layout = layoutPiecePreview(I_PIECE, 40, 50, 15);

    expect(layout.cellSize).toBe(10);
    expect(Math.min(...layout.cells.map((cell) => cell.x))).toBe(-20);
    expect(Math.max(...layout.cells.map((cell) => cell.x + layout.cellSize))).toBe(20);
  });

  it("ignores unused coordinates in a definition's rotation box", () => {
    const layout = layoutPiecePreview(O_PIECE, 60, 50, 15);

    expect(layout.cellSize).toBe(15);
    expect(Math.min(...layout.cells.map((cell) => cell.x))).toBe(-15);
    expect(Math.max(...layout.cells.map((cell) => cell.y + layout.cellSize))).toBe(15);
  });

  it("rejects invalid preview dimensions", () => {
    expect(() => layoutPiecePreview(T_PIECE, 0, 50, 15)).toThrow(RangeError);
  });
});
