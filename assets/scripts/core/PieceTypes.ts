import type { ColorId } from "./types";

export interface ReadonlyVec2 {
  readonly x: number;
  readonly y: number;
}

export interface PieceDefinition {
  readonly id: string;
  readonly rotations: ReadonlyArray<ReadonlyArray<ReadonlyVec2>>;
}

export interface PiecePlacement {
  readonly definition: PieceDefinition;
  readonly rotation: number;
  readonly x: number;
  readonly y: number;
  readonly color: ColorId;
}

export interface ActivePieceState extends PiecePlacement {
  readonly lockElapsedMs: number;
  readonly lockResets: number;
  readonly lockReady: boolean;
}
