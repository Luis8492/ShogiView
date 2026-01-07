import { renderKif } from '../src/kif-viewer';

type CreateElOptions = {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string>;
};

const installDomHelpers = () => {
  const applyClass = (element: HTMLElement, cls?: string | string[]) => {
    if (!cls) return;
    const classes = Array.isArray(cls) ? cls : cls.split(' ').filter(Boolean);
    if (classes.length) {
      element.classList.add(...classes);
    }
  };

  const applyOptions = (element: HTMLElement, options?: CreateElOptions) => {
    if (!options) return;
    applyClass(element, options.cls);
    if (options.text !== undefined) {
      element.textContent = options.text;
    }
    if (options.attr) {
      Object.entries(options.attr).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
  };

  const proto = HTMLElement.prototype as any;

  if (!proto.createEl) {
    proto.createEl = function createEl(tag: string, options?: CreateElOptions) {
      const element = document.createElement(tag);
      applyOptions(element, options);
      this.appendChild(element);
      return element;
    };
  }

  if (!proto.createDiv) {
    proto.createDiv = function createDiv(options?: CreateElOptions) {
      return this.createEl?.('div', options) as HTMLDivElement;
    };
  }

  if (!proto.createSpan) {
    proto.createSpan = function createSpan(options?: CreateElOptions) {
      return this.createEl?.('span', options) as HTMLSpanElement;
    };
  }

  if (!proto.setAttr) {
    proto.setAttr = function setAttr(key: string, value: string) {
      this.setAttribute(key, value);
    };
  }

  if (!proto.setText) {
    proto.setText = function setText(text: string) {
      this.textContent = text;
    };
  }

  if (!proto.addClass) {
    proto.addClass = function addClass(...cls: string[]) {
      this.classList.add(...cls);
    };
  }

  if (!proto.empty) {
    proto.empty = function empty() {
      while (this.firstChild) {
        this.removeChild(this.firstChild);
      }
    };
  }
};

const mockApp = {
  vault: {},
  workspace: {},
};

installDomHelpers();

const root = document.getElementById('shogi-preview-root');
if (!root) {
  throw new Error('Preview root element not found.');
}

const sampleKif = `# ----  ぴよ将棋 棋譜ファイル  ----
棋戦：ぴよ将棋
戦型：△ツノ銀雁木
開始日時：2025/09/20 17:38:04
終了日時：2025/09/20 17:54:54
手合割：平手
先手：プレイヤー
後手：プレイヤー
手数----指手---------消費時間--
   1 ２六歩(27)( 0:12/00:00:12)
   2 ３四歩(33)( 0:05/00:00:05)
   3 ２五歩(26)( 0:01/00:00:13)
   4 ３三角(22)( 0:01/00:00:06)
   5 ７六歩(77)( 0:00/00:00:13)
   6 ８四歩(83)( 0:02/00:00:08)
   7 ７七角(88)( 0:03/00:00:16)
   8 ２二銀(31)( 0:05/00:00:13)
* コメント例: ここで角のラインを開く。
`;

try {
  renderKif(sampleKif, root);
  (window as typeof window & { app?: typeof mockApp }).app = mockApp;
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  root.textContent = `Preview failed: ${message}`;
}
