import { App, PluginSettingTab, Setting } from 'obsidian';

import type ShogiKifViewer from '../main';

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
            this.plugin.settings.controlButtonLabelMode = value as 'text-with-icon' | 'icon-only';
            await this.plugin.saveSettings();
          });
      });
  }
}
