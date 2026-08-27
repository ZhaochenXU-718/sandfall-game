import { Randomizer } from "./Randomizer";

type BagValue = string | number;

export interface RandomBagState<T extends BagValue> {
  readonly items: readonly T[];
  readonly cursor: number;
}

export class RandomBag<T extends BagValue> {
  private readonly source: readonly T[];
  private readonly items: T[];
  private readonly randomizer: Randomizer;
  private cursor: number;

  public constructor(values: readonly T[], randomizer: Randomizer) {
    if (values.length === 0 || new Set(values).size !== values.length) {
      throw new Error("A random bag requires unique values and cannot be empty");
    }
    this.source = Object.freeze([...values]);
    this.items = [...values];
    this.cursor = values.length;
    this.randomizer = randomizer;
  }

  public next(): T {
    if (this.cursor >= this.items.length) {
      this.refill();
    }
    const value = this.items[this.cursor];
    if (value === undefined) {
      throw new Error("Random bag invariant violated");
    }
    this.cursor += 1;
    return value;
  }

  public getState(): RandomBagState<T> {
    return { items: [...this.items], cursor: this.cursor };
  }

  public setState(state: RandomBagState<T>): void {
    if (!Number.isInteger(state.cursor) || state.cursor < 0 || state.cursor > this.items.length) {
      throw new RangeError("Random bag cursor is outside its valid range");
    }
    if (state.items.length !== this.source.length || new Set(state.items).size !== this.source.length) {
      throw new Error("Random bag state does not contain the expected unique values");
    }
    for (const value of this.source) {
      if (!state.items.includes(value)) {
        throw new Error("Random bag state contains unexpected values");
      }
    }
    this.items.splice(0, this.items.length, ...state.items);
    this.cursor = state.cursor;
  }

  private refill(): void {
    this.items.splice(0, this.items.length, ...this.source);
    for (let index = this.items.length - 1; index > 0; index -= 1) {
      const swapIndex = this.randomizer.nextInt(index + 1);
      const value = this.items[index];
      const swapValue = this.items[swapIndex];
      if (value === undefined || swapValue === undefined) {
        throw new Error("Random bag invariant violated");
      }
      this.items[index] = swapValue;
      this.items[swapIndex] = value;
    }
    this.cursor = 0;
  }
}
