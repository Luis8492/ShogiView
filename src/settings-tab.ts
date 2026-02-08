import { App, PluginSettingTab, Setting, TextComponent } from 'obsidian';

import type ShogiKifViewer from '../main';
import type { BoardWidthMode, ControlButtonLabelMode } from './settings';

const MIN_BOARD_WRAPPER_WIDTH = 360;
const MAX_BOARD_WRAPPER_WIDTH = 1400;

export class ShogiViewSettingTab extends PluginSettingTab {
  plugin: ShogiKifViewer;

  constructor(app: App, plugin: ShogiKifViewer) {
    super(app, plugin);
    this.plugin = plugin;
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Control button labels')
      .setDesc('First/Back/Forward/Last/Autoplay ボタンを文字付きまたはアイコンのみで表示する')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('text-with-icon', '文字 + アイコン')
          .addOption('icon-only', 'アイコンのみ')
          .setValue(this.plugin.settings.controlButtonLabelMode)
          .onChange(async (value) => {
            this.plugin.settings.controlButtonLabelMode = value as ControlButtonLabelMode;
            await this.plugin.saveSettings();
          });
      });

    let widthValueSetting: Setting;

    const updateWidthInputState = () => {
      const isManual = this.plugin.settings.boardWidthMode === 'manual';
      widthValueSetting.settingEl.toggleClass('is-disabled', !isManual);
      widthValueSetting.controlEl.toggleClass('is-disabled', !isManual);
      const input = widthValueSetting.controlEl.querySelector('input');
      if (input instanceof HTMLInputElement) {
        input.disabled = !isManual;
      }
    };

    const commitManualWidth = async (text: TextComponent) => {
      const rawValue = text.getValue().trim();
      const parsed = Number.parseInt(rawValue, 10);
      if (!Number.isFinite(parsed)) {
        text.setValue(String(this.plugin.settings.boardWrapperWidth));
        return;
      }

      const clamped = Math.max(MIN_BOARD_WRAPPER_WIDTH, Math.min(MAX_BOARD_WRAPPER_WIDTH, parsed));
      text.setValue(String(clamped));

      if (this.plugin.settings.boardWrapperWidth === clamped) {
        return;
      }

      this.plugin.settings.boardWrapperWidth = clamped;
      await this.plugin.saveSettings();
    };

    new Setting(containerEl)
      .setName('Board width mode')
      .setDesc('盤面+持ち駒全体の幅をノート表示幅から自動決定するか、手動で固定するかを選択する')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('auto', '自動')
          .addOption('manual', '手動')
          .setValue(this.plugin.settings.boardWidthMode)
          .onChange(async (value) => {
            this.plugin.settings.boardWidthMode = value as BoardWidthMode;
            updateWidthInputState();
            await this.plugin.saveSettings();
          });
      });

    widthValueSetting = new Setting(containerEl)
      .setName('Board wrapper width (px)')
      .setDesc(`手動モード時の board-wrapper 幅を ${MIN_BOARD_WRAPPER_WIDTH}px〜${MAX_BOARD_WRAPPER_WIDTH}px で指定する`)
      .addText((text) => {
        text
          .setPlaceholder('560')
          .setValue(String(this.plugin.settings.boardWrapperWidth))
          .onChange(() => {
            // タイピング中は値を確定しない。blur/Enterで確定する。
          });

        text.inputEl.type = 'number';
        text.inputEl.min = String(MIN_BOARD_WRAPPER_WIDTH);
        text.inputEl.max = String(MAX_BOARD_WRAPPER_WIDTH);
        text.inputEl.step = '1';

        text.inputEl.addEventListener('blur', () => {
          void commitManualWidth(text);
        });

        text.inputEl.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          void commitManualWidth(text);
          text.inputEl.blur();
        });
      });

    updateWidthInputState();
  }
}
