const UINT32_RANGE = 0x1_0000_0000;

/** Mulberry32: a compact deterministic generator with serializable 32-bit state. */
export class Randomizer {
  private state: number;

  public constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new RangeError("Random seed must be finite");
    }
    this.state = seed >>> 0;
  }

  public nextUint32(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  }

  public nextFloat(): number {
    return this.nextUint32() / UINT32_RANGE;
  }

  public nextBoolean(): boolean {
    return (this.nextUint32() & 1) === 1;
  }

  public nextInt(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be a positive safe integer");
    }
    return Math.floor(this.nextFloat() * maxExclusive);
  }

  public getState(): number {
    return this.state;
  }

  public setState(state: number): void {
    if (!Number.isInteger(state) || state < 0 || state > 0xffff_ffff) {
      throw new RangeError("PRNG state must be an unsigned 32-bit integer");
    }
    this.state = state >>> 0;
  }
}
