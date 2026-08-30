export interface DangerZoneSample {
  readonly intensity: number;
  readonly occupiedCount: number;
  readonly topmostOccupiedRow: number | undefined;
}

/** Measures how close settled sand is to the spawn area without changing game rules. */
export function sampleDangerZone(
  cells: Uint8Array,
  width: number,
  height: number,
  zoneRows: number,
): DangerZoneSample {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    throw new RangeError("Danger-zone dimensions must be positive integers");
  }
  if (!Number.isInteger(zoneRows) || zoneRows <= 0 || zoneRows > height) {
    throw new RangeError("Danger-zone rows must be an integer within the board");
  }
  if (cells.length !== width * height) {
    throw new RangeError(`Expected ${width * height} danger-zone cells, got ${cells.length}`);
  }

  let occupiedCount = 0;
  let topmostOccupiedRow: number | undefined;
  for (let y = 0; y < zoneRows; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      if (cells[rowOffset + x] === 0) {
        continue;
      }
      occupiedCount += 1;
      topmostOccupiedRow = topmostOccupiedRow === undefined
        ? y
        : Math.min(topmostOccupiedRow, y);
    }
  }

  if (topmostOccupiedRow === undefined) {
    return { intensity: 0, occupiedCount: 0, topmostOccupiedRow: undefined };
  }

  const proximity = (zoneRows - topmostOccupiedRow) / zoneRows;
  const density = occupiedCount / (width * zoneRows);
  return {
    intensity: Math.min(1, proximity * 0.82 + Math.sqrt(density) * 0.18),
    occupiedCount,
    topmostOccupiedRow,
  };
}

/** Restrained sub-hertz pulse used by the visual layer; never exceeds its input. */
export function dangerZonePulse(intensity: number, elapsedSeconds: number): number {
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 1) {
    throw new RangeError("Danger-zone intensity must be between zero and one");
  }
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError("Danger-zone elapsed time must be non-negative");
  }
  if (intensity === 0) {
    return 0;
  }
  const pulse = 0.88 + Math.sin(elapsedSeconds * Math.PI * 2 * 0.72) * 0.12;
  return intensity * pulse;
}
