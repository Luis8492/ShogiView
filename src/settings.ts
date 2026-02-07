export type ControlButtonLabelMode = 'text-with-icon' | 'icon-only';

export interface ShogiViewSettings {
  controlButtonLabelMode: ControlButtonLabelMode;
}

export const DEFAULT_SETTINGS: ShogiViewSettings = {
  controlButtonLabelMode: 'text-with-icon',
};
