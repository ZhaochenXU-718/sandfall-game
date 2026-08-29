import type { PieceDefinition } from "./PieceTypes";
import { validatePieceDefinition } from "./PieceDefinitions";
import { RandomBag, type RandomBagState } from "./RandomBag";
import { Randomizer } from "./Randomizer";
import type { ColorId } from "./types";

export interface NextPiece {
  readonly definition: PieceDefinition;
  readonly color: ColorId;
}

export interface PieceRandomizerState {
  readonly randomState: number;
  readonly colorCount: number;
  readonly shapes: RandomBagState<string>;
  readonly colors: RandomBagState<number>;
}

export class PieceRandomizer {
  private readonly randomizer: Randomizer;
  private readonly definitions = new Map<string, PieceDefinition>();
  private readonly shapeBag: RandomBag<string>;
  private colorBag: RandomBag<number>;
  private currentColorCount: number;

  public constructor(seed: number, definitions: readonly PieceDefinition[], colorCount: number) {
    if (definitions.length === 0) {
      throw new Error("At least one piece definition is required");
    }
    if (!Number.isInteger(colorCount) || colorCount <= 0 || colorCount > 255) {
      throw new RangeError("colorCount must be an integer between 1 and 255");
    }
    for (const definition of definitions) {
      validatePieceDefinition(definition);
      if (this.definitions.has(definition.id)) {
        throw new Error(`Duplicate piece id: ${definition.id}`);
      }
      this.definitions.set(definition.id, definition);
    }

    this.randomizer = new Randomizer(seed);
    // Cocos Creator's web-mobile transpiler does not preserve iterable spread
    // for Map iterators (it emits `[map.keys()]`). Array.from is portable.
    this.shapeBag = new RandomBag(Array.from(this.definitions.keys()), this.randomizer);
    this.currentColorCount = colorCount;
    this.colorBag = new RandomBag(
      Array.from({ length: colorCount }, (_, index) => index + 1),
      this.randomizer,
    );
  }

  public next(): NextPiece {
    const id = this.shapeBag.next();
    const definition = this.definitions.get(id);
    if (definition === undefined) {
      throw new Error(`Unknown piece id in shape bag: ${id}`);
    }
    return { definition, color: this.colorBag.next() };
  }

  public get colorCount(): number {
    return this.currentColorCount;
  }

  /** Starts a fresh color bag while preserving the deterministic PRNG stream. */
  public setColorCount(colorCount: number): void {
    if (!Number.isInteger(colorCount) || colorCount <= 0 || colorCount > 255) {
      throw new RangeError("colorCount must be an integer between 1 and 255");
    }
    if (colorCount === this.currentColorCount) {
      return;
    }
    this.currentColorCount = colorCount;
    this.colorBag = new RandomBag(
      Array.from({ length: colorCount }, (_, index) => index + 1),
      this.randomizer,
    );
  }

  public getState(): PieceRandomizerState {
    return {
      randomState: this.randomizer.getState(),
      colorCount: this.currentColorCount,
      shapes: this.shapeBag.getState(),
      colors: this.colorBag.getState(),
    };
  }

  public setState(state: PieceRandomizerState): void {
    this.setColorCount(state.colorCount);
    this.randomizer.setState(state.randomState);
    this.shapeBag.setState(state.shapes);
    this.colorBag.setState(state.colors);
  }
}
