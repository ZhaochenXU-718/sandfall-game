export type ColorId = number;

export interface SandStepResult {
  movedCount: number;
  dirtyMinX: number;
  dirtyMinY: number;
  dirtyMaxX: number;
  dirtyMaxY: number;
}

export interface ConnectivityResult {
  /** Reused by the resolver; consume before calling resolve() again. */
  readonly removalMask: Uint8Array;
  clearedComponentCount: number;
  markedCellCount: number;
}
