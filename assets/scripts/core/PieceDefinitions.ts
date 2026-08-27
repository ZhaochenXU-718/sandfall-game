import type { PieceDefinition, ReadonlyVec2 } from "./PieceTypes";

function piece(id: string, rotations: readonly (readonly ReadonlyVec2[])[]): PieceDefinition {
  const frozenRotations = rotations.map((rotation) =>
    Object.freeze(rotation.map((cell) => Object.freeze({ ...cell }))),
  );
  return Object.freeze({ id, rotations: Object.freeze(frozenRotations) });
}

// Rotation states are explicit data so replay behavior never depends on a
// runtime rotation algorithm. Coordinates follow the usual 3x3/4x4 boxes.
export const I_PIECE = piece("I", [
  [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
  [{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }],
  [{ x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }],
]);

export const O_PIECE = piece("O", [
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
]);

export const T_PIECE = piece("T", [
  [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
  [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
  [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
]);

export const J_PIECE = piece("J", [
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
  [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
]);

export const L_PIECE = piece("L", [
  [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
  [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
]);

export const S_PIECE = piece("S", [
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }],
  [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }],
]);

export const Z_PIECE = piece("Z", [
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }],
  [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }],
  [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }],
]);

export const TETROMINOES: readonly PieceDefinition[] = Object.freeze([
  I_PIECE,
  O_PIECE,
  T_PIECE,
  J_PIECE,
  L_PIECE,
  S_PIECE,
  Z_PIECE,
]);

export function validatePieceDefinition(definition: PieceDefinition): void {
  if (definition.id.length === 0 || definition.rotations.length === 0) {
    throw new Error("A piece needs an id and at least one rotation");
  }

  const expectedCellCount = definition.rotations[0]?.length;
  if (expectedCellCount === undefined || expectedCellCount === 0) {
    throw new Error(`Piece ${definition.id} has an empty rotation`);
  }

  for (const rotation of definition.rotations) {
    if (rotation.length !== expectedCellCount) {
      throw new Error(`Piece ${definition.id} rotations must contain the same number of cells`);
    }
    const occupied = new Set<string>();
    for (const cell of rotation) {
      if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y)) {
        throw new Error(`Piece ${definition.id} coordinates must be integers`);
      }
      const key = `${cell.x},${cell.y}`;
      if (occupied.has(key)) {
        throw new Error(`Piece ${definition.id} rotation contains duplicate cells`);
      }
      occupied.add(key);
    }
  }
}
