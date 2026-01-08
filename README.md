# ShogiView

## Overview

ShogiView lets you paste shogi game records written in the KIF format into Obsidian Markdown notes and replay them on an interactive board. It keeps game reviews and reference studies within Obsidian.

## Key Features

- Parse and render KIF-formatted game records inside ` ```kif` code blocks
- Update the board and captured pieces in real time while highlighting the previous move's origin and destination
- Navigate the moves with **First / Back / Forward / Last** buttons
- Provide keyboard shortcuts to move through positions with the ←/→ and Home/End keys when the viewer or its controls are focused
- Start or stop autoplay with the space key or toolbar button
- Jump to and start playback from any move number
- Support branching variations with breadcrumbs, a button to return to the parent line, and a dropdown to select variations
- Explore variations in an SVG tree view below the board, click nodes to jump, and scroll with the mouse wheel (Shift+wheel for horizontal) to move around
- Display comments on the latest move, elapsed time, and metadata such as tournament and opening name

## Usage

1. Build the plugin and place the generated `main.js`, `manifest.json`, and optionally `styles.css` files in your Obsidian vault under `/.obsidian/plugins/shogi-kif-viewer/`. The folder name must match the `id` in `manifest.json` (`shogi-kif-viewer`) or the plugin will not load.
2. Restart Obsidian and enable the plugin from **Settings → Community plugins**.
3. Add a code block like the following to your note (most published KIF files use Japanese headers and move notation):

   ````markdown
   ```kif
   # ----  ぴよ将棋 棋譜ファイル  ----
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
   ```
   ````

4. Open the note in Reading view to see the board, captured pieces, and the variation tree below the board. Use the controls or the tree nodes to replay the game. Scroll the tree with the mouse wheel (Shift+wheel for horizontal), and click inside the viewer once (or focus its controls) to enable keyboard shortcuts such as ←/→, Home/End, and Space.

### ツリー表示の操作

- ツリーは盤面の下に表示される。
- コメント欄は棋譜ツリーの下に表示される。
- ノードをクリックすると対応する手数へジャンプする。
- マウスホイールでスクロールする（横移動はShift+ホイール）。
- 折り畳み機能は廃止した。

### About the KIF Notation

- Supports common KIF headers such as `棋戦` (event) and `戦型` (opening) along with move rows.
- Parses notation like "同", `打`, promotions (`成`), non-promotions (`不成`), original coordinates `(27)`, and elapsed time `( 0:12/00:00:12)`.
- Associates comment lines starting with `*` to the preceding move and shows them in the comment panel.
- Expands branches that begin with `変化：n手` into a tree so you can move to any variation.
- You can set the initial position by adding lines like `初期表示手：15` or `start-move: 15` near the top of the code block.

## For Developers

### Requirements

- Node.js 18 or later recommended
- npm (this repository relies on npm scripts)

### Setup

```bash
npm install
```

### Development Build (watch)

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

After building, copy the generated `main.js` and `manifest.json` (and `styles.css` if needed) into your target vault to test.

### UI Preview (standalone)

If you want to check the UI in a browser without launching Obsidian, use the preview scripts to bundle and serve the standalone HTML.

```bash
npm run ui:serve
```

Then open `http://localhost:4173/preview/index.html` in a browser (or the URL printed in the terminal). The preview uses a small mock app object and DOM helpers to render the same UI as the plugin.

### Instant UI Check（Codex）

When checking the UI in the Codex environment, start the preview and take a screenshot using the following procedure.

1. Start the preview server.

   ```bash
   npm run ui:serve
   ```

2. In a separate terminal, take a screenshot.

   ```bash
   npm run ui:screenshot
   ```

The screenshot is output to `artifacts/ui-preview.png`.


### UI Screenshot (Playwright)

To generate a UI screenshot, run the Playwright helper. It will start the preview server, open the page, and write the output to `artifacts/ui-preview.png` (ignored by Git).

```bash
npm run ui:screenshot
```

## Future Roadmap
- language

## License

MIT License (see `LICENSE` for details).

---
