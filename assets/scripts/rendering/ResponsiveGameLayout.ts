export interface ResponsiveGameLayoutOptions {
  readonly visibleWidth: number;
  readonly visibleHeight: number;
  readonly macroWidth: number;
  readonly macroHeight: number;
  readonly maxCellSize?: number;
  readonly horizontalMargin?: number;
  readonly hudHeight?: number;
  readonly bottomMargin?: number;
  readonly safeAreaInsets?: SafeAreaInsets;
}

export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface ResponsiveGameLayout {
  readonly cellSize: number;
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly boardX: number;
  readonly boardY: number;
  readonly boardTop: number;
  readonly hudPanelY: number;
  readonly pauseY: number;
  readonly statusX: number;
  readonly nextX: number;
  readonly feedbackY: number;
}

/** Fits a square-cell playfield below the HUD without cropping on narrow phones. */
export function fitResponsiveGameLayout(
  options: ResponsiveGameLayoutOptions,
): ResponsiveGameLayout {
  const maxCellSize = options.maxCellSize ?? 28;
  const horizontalMargin = options.horizontalMargin ?? 12;
  const hudHeight = options.hudHeight ?? 108;
  const bottomMargin = options.bottomMargin ?? 10;
  const safeAreaInsets = options.safeAreaInsets ?? {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const positiveValues = [
    options.visibleWidth,
    options.visibleHeight,
    options.macroWidth,
    options.macroHeight,
    maxCellSize,
  ];
  if (positiveValues.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new RangeError("layout sizes must be finite positive numbers");
  }
  if (!Number.isInteger(options.macroWidth) || !Number.isInteger(options.macroHeight)) {
    throw new RangeError("macro board dimensions must be integers");
  }
  if (
    !Number.isFinite(horizontalMargin)
    || !Number.isFinite(hudHeight)
    || !Number.isFinite(bottomMargin)
    || horizontalMargin < 0
    || hudHeight < 0
    || bottomMargin < 0
    || Object.values(safeAreaInsets).some((value) => !Number.isFinite(value) || value < 0)
  ) {
    throw new RangeError("layout margins must be finite non-negative numbers");
  }

  const safeWidth = options.visibleWidth - safeAreaInsets.left - safeAreaInsets.right;
  const safeHeight = options.visibleHeight - safeAreaInsets.top - safeAreaInsets.bottom;
  const widthCellSize = (safeWidth - horizontalMargin * 2) / options.macroWidth;
  const heightCellSize = (
    safeHeight - hudHeight - bottomMargin
  ) / options.macroHeight;
  const cellSize = Math.floor(Math.min(maxCellSize, widthCellSize, heightCellSize));
  if (cellSize <= 0) {
    throw new RangeError("visible area is too small for the game layout");
  }

  const boardWidth = cellSize * options.macroWidth;
  const boardHeight = cellSize * options.macroHeight;
  const safeLeft = -options.visibleWidth / 2 + safeAreaInsets.left;
  const safeRight = options.visibleWidth / 2 - safeAreaInsets.right;
  const boardX = (safeLeft + safeRight) / 2;
  const boardBottom = -options.visibleHeight / 2 + safeAreaInsets.bottom + bottomMargin;
  const boardY = boardBottom + boardHeight / 2;
  const boardTop = boardBottom + boardHeight;
  const hudPanelY = options.visibleHeight / 2 - safeAreaInsets.top - 58;

  return Object.freeze({
    cellSize,
    boardWidth,
    boardHeight,
    boardX,
    boardY,
    boardTop,
    hudPanelY,
    pauseY: hudPanelY + 25,
    statusX: boardX - boardWidth / 2 + 56,
    nextX: boardX + boardWidth / 2 - 44,
    feedbackY: boardTop - 37,
  });
}
