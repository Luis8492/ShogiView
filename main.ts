import { MarkdownPostProcessorContext, MarkdownRenderChild, Plugin } from 'obsidian';

import { renderKif } from './src/kif-viewer';
import { DEFAULT_SETTINGS, ShogiViewSettings } from './src/settings';
import { ShogiViewSettingTab } from './src/settings-tab';

class ShogiKifRenderChild extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement) {
    super(containerEl);
  }
}

export default class ShogiKifViewer extends Plugin {
  settings: ShogiViewSettings;

  override async onload(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.addSettingTab(new ShogiViewSettingTab(this.app, this));
    this.registerMarkdownCodeBlockProcessor('kif', (src, el, ctx) => this.renderKif(src, el, ctx));
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  renderKif(src: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    renderKif(src, el, ctx, {
      createRenderChild: (container: HTMLElement) => new ShogiKifRenderChild(container),
      controlButtonLabelMode: this.settings.controlButtonLabelMode,
    });
  }
}
