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
  readonly shapes: RandomBagState<string>;
  readonly colors: RandomBagState<number>;
}

export class PieceRandomizer {
  private readonly randomizer: Randomizer;
  private readonly definitions = new Map<string, PieceDefinition>();
  private readonly shapeBag: RandomBag<string>;
  private readonly colorBag: RandomBag<number>;

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
    this.shapeBag = new RandomBag([...this.definitions.keys()], this.randomizer);
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

  public getState(): PieceRandomizerState {
    return {
      randomState: this.randomizer.getState(),
      shapes: this.shapeBag.getState(),
      colors: this.colorBag.getState(),
    };
  }

  public setState(state: PieceRandomizerState): void {
    this.randomizer.setState(state.randomState);
    this.shapeBag.setState(state.shapes);
    this.colorBag.setState(state.colors);
  }
}
