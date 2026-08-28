/** Stable dither mask used while the solid piece reveals its moving grains. */
export function sandifyGrainVisible(
  grainX: number,
  grainY: number,
  remainingCoverage: number,
): boolean {
  if (!Number.isInteger(grainX) || !Number.isInteger(grainY)) {
    throw new RangeError("Sandify grain coordinates must be integers");
  }
  if (
    !Number.isFinite(remainingCoverage)
    || remainingCoverage < 0
    || remainingCoverage > 1
  ) {
    throw new RangeError("Sandify coverage must be between zero and one");
  }
  if (remainingCoverage === 0) {
    return false;
  }
  if (remainingCoverage === 1) {
    return true;
  }

  let hash = Math.imul(grainX + 0x51ed, 0x45d9f3b)
    ^ Math.imul(grainY + 0x9e37, 0x119de1f3);
  hash ^= hash >>> 16;
  const threshold = (hash & 0xffff) / 0x1_0000;
  return threshold < remainingCoverage;
}
