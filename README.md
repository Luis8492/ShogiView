# ShogiView

## Overview

**ShogiView** is an Obsidian plugin that renders Shogi game records written in **KIF format** directly inside Markdown notes. It provides an interactive board, move navigation, variation browsing, and comments, allowing you to review and study games without leaving Obsidian.

---

## Features

### Core Functionality

* Render KIF game records embedded in Markdown code blocks
* Interactive Shogi board with real-time updates
* Display captured pieces and highlight move origin/destination
* Show comments, elapsed time, and metadata (event, opening, etc.)

### Navigation & Playback

* Move controls: **First / Back / Forward / Last**
* Control button labels can be configured via `controlButtonLabelMode` (`"text-with-icon"` or `"icon-only"`)
* Keyboard shortcuts (when focused):

  * ← / → : previous / next move
  * Home / End : first / last move
  * Space : start / stop autoplay
* Jump to any move number
* Autoplay from any selected position

### Variation Tree

* SVG-based variation tree displayed below the board
* Click nodes to jump to corresponding moves
* Scroll with mouse wheel

  * Vertical: wheel
  * Horizontal: Shift + wheel
* All variations are expanded by default (no folding)

---

## Usage

### Installation

1. Build the plugin.

2. Copy the generated files into your Obsidian vault:

   ```
   .obsidian/plugins/shogi-kif-viewer/
     ├─ main.js
     ├─ manifest.json
     └─ styles.css (optional)
   ```

   The folder name **must** match the `id` in `manifest.json` (`shogi-kif-viewer`).

3. Restart Obsidian.

4. Enable the plugin from **Settings → Community plugins**.

---

### Writing a KIF Block

Insert a KIF record using a fenced code block:

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

Open the note in **Reading View** to display the board and variation tree.

---

### Viewer Layout

* **Board & controls**: top
* **Variation tree**: below the board
* **Comments panel**: below the variation tree

Click inside the viewer (or its controls) once to enable keyboard shortcuts.

### Settings

You can change how the viewer control button labels are displayed:

1. Open **Settings → Community plugins**.
2. Select **ShogiView**.
3. In **Control button labels**, choose one of:
   * **文字 + アイコン** (`text-with-icon`)
     * `First ⏮` / `Back ◀` / `Forward ▶` / `Last ⏭`
     * `Autoplay ▶` (stopped) / `Pause ⏸` (playing)
   * **アイコンのみ** (`icon-only`)
     * `⏮` / `◀` / `▶` / `⏭`
     * `▶` (stopped) / `⏸` (playing)

---

## KIF Support Details

* Supports common KIF headers (e.g. `棋戦`, `戦型`)
* Parses:

  * Same-square moves (`同`)
  * Drops (`打`)
  * Promotions (`成`) and non-promotions (`不成`)
  * Original coordinates `(27)`
  * Time notation `( 0:12/00:00:12)`
* Comment lines starting with `*` are attached to the preceding move
* Variations defined by `変化：n手` are expanded into a move tree
* Initial position can be set with:

  * `初期表示手：15`
  * `start-move: 15`

---

## Development

### Requirements

* Node.js 18 or later
* npm

### Setup

```bash
npm install
```

### Development Build (Watch Mode)

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

Copy the generated artifacts into your Obsidian vault to test.

---

## UI Preview (Standalone)

To preview the UI without Obsidian:

```bash
npm run ui:serve
```

Open the printed URL (typically `http://localhost:4173/preview/index.html`).
This preview uses a lightweight mock environment but renders the same UI as the plugin.

---

## UI Screenshot

### Quick Screenshot (Playwright)

```bash
npm run ui:screenshot
```

This command:

* Starts the preview server
* Opens the page in a headless browser
* Saves a screenshot to:

```
artifacts/ui-preview.png
```

(The file is ignored by Git.)

---

## Roadmap

* Language support improvements
* 

---

## License

MIT License. See `LICENSE` for details.
