export type ControlButtonLabelMode = 'text-with-icon' | 'icon-only';

export interface ShogiViewSettings {
  controlButtonLabelMode: ControlButtonLabelMode;
  boardCellSizePx: number;
}

export const DEFAULT_SETTINGS: ShogiViewSettings = {
  controlButtonLabelMode: 'text-with-icon',
  boardCellSizePx: 36,
};

export const BOARD_CELL_SIZE_RANGE = {
  min: 24,
  max: 64,
};

export function clampBoardCellSizePx(value: number): number {
  return Math.min(BOARD_CELL_SIZE_RANGE.max, Math.max(BOARD_CELL_SIZE_RANGE.min, value));
}

