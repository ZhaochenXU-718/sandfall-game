import type { PieceDefinition } from "../core/PieceTypes";

export interface PiecePreviewCell {
  readonly x: number;
  readonly y: number;
}

export interface PiecePreviewLayout {
  readonly cellSize: number;
  readonly cells: readonly PiecePreviewCell[];
}

/** Centers a piece's spawn rotation inside a preview area. */
export function layoutPiecePreview(
  definition: PieceDefinition,
  availableWidth: number,
  availableHeight: number,
  maximumCellSize: number,
): PiecePreviewLayout {
  if (
    !Number.isFinite(availableWidth)
    || !Number.isFinite(availableHeight)
    || !Number.isFinite(maximumCellSize)
    || availableWidth <= 0
    || availableHeight <= 0
    || maximumCellSize <= 0
  ) {
    throw new RangeError("Preview dimensions and cell size must be positive finite numbers");
  }

  const rotation = definition.rotations[0];
  const firstCell = rotation?.[0];
  if (rotation === undefined || firstCell === undefined) {
    throw new Error(`Piece ${definition.id} has no spawn rotation`);
  }

  let minX = firstCell.x;
  let maxX = firstCell.x;
  let minY = firstCell.y;
  let maxY = firstCell.y;
  for (const cell of rotation) {
    minX = Math.min(minX, cell.x);
    maxX = Math.max(maxX, cell.x);
    minY = Math.min(minY, cell.y);
    maxY = Math.max(maxY, cell.y);
  }

  const columnCount = maxX - minX + 1;
  const rowCount = maxY - minY + 1;
  const cellSize = Math.min(
    maximumCellSize,
    availableWidth / columnCount,
    availableHeight / rowCount,
  );
  const left = -(columnCount * cellSize) / 2;
  const top = (rowCount * cellSize) / 2;

  return {
    cellSize,
    cells: rotation.map((cell) => ({
      x: left + (cell.x - minX) * cellSize,
      y: top - (cell.y - minY + 1) * cellSize,
    })),
  };
}
