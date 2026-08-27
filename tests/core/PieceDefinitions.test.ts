import { describe, expect, it } from "vitest";
import {
  TETROMINOES,
  validatePieceDefinition,
} from "../../assets/scripts/core/PieceDefinitions";

describe("piece definitions", () => {
  it("contains the seven unique MVP tetrominoes", () => {
    expect(TETROMINOES.map(({ id }) => id).sort()).toEqual(["I", "J", "L", "O", "S", "T", "Z"]);
  });

  it("defines four unique macro cells in every rotation", () => {
    for (const definition of TETROMINOES) {
      expect(() => validatePieceDefinition(definition)).not.toThrow();
      for (const rotation of definition.rotations) {
        expect(rotation).toHaveLength(4);
        expect(new Set(rotation.map(({ x, y }) => `${x},${y}`)).size).toBe(4);
      }
    }
  });
});
