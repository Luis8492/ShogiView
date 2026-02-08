export type ControlButtonLabelMode = 'text-with-icon' | 'icon-only';
export type BoardWidthMode = 'auto' | 'manual';

export interface ShogiViewSettings {
  controlButtonLabelMode: ControlButtonLabelMode;
  boardWidthMode: BoardWidthMode;
  boardWrapperWidth: number;
}

export const DEFAULT_SETTINGS: ShogiViewSettings = {
  controlButtonLabelMode: 'text-with-icon',
  boardWidthMode: 'auto',
  boardWrapperWidth: 560,
};
