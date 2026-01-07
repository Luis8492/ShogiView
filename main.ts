import { MarkdownPostProcessorContext, MarkdownRenderChild, Plugin } from 'obsidian';

import { renderKif } from './src/kif-viewer';

class ShogiKifRenderChild extends MarkdownRenderChild {
  constructor(containerEl: HTMLElement) {
    super(containerEl);
  }
}

export default class ShogiKifViewer extends Plugin {
  override onload(): Promise<void> {
    this.registerMarkdownCodeBlockProcessor('kif', (src, el, ctx) => this.renderKif(src, el, ctx));
    return Promise.resolve();
  }

  renderKif(src: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    renderKif(src, el, ctx, {
      createRenderChild: (container: HTMLElement) => new ShogiKifRenderChild(container),
    });
  }
}
