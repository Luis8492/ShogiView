# ShogiView

## Overview

**ShogiView** is an Obsidian plugin that renders Shogi data directly inside Markdown notes. It supports **KIF game records** and board-position formats such as **SFEN**, **BOD**, and **CSA**. It provides an interactive board, move navigation, variation browsing, and comments, allowing you to review and study games without leaving Obsidian.

---

## Features

### Core Functionality

* Render Shogi data embedded in Markdown code blocks (`kif`, `sfen`, `bod`, `csa`)
* Interactive Shogi board with real-time updates
* Display captured pieces and highlight move origin/destination
* Show comments, elapsed time, and metadata (event, opening, etc.)

### Navigation & Playback

* Move controls: **First / Back / Forward / Last**
* Control button labels can be configured via `controlButtonLabelMode` (`"text-with-icon"` or `"icon-only"`)
* Board wrapper width (board + captured pieces) can be configured via `boardWidthMode` (`"auto"` or `"manual"`) and `boardWrapperWidth` (manual width in px)
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

### Writing supported code blocks

#### KIF (move record)

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

#### SFEN (board position)

````markdown
```sfen
ln5nl/1rk2bg2/3p1gspp/pSP1p1p2/5P1PP/Pp1BP1S2/1P1PG1P2/K1G3+r2/LNs5L w NPp
```
````

#### BOD (board diagram)

````markdown
```bod
後手の持駒：歩
  ９ ８ ７ ６ ５ ４ ３ ２ １
+---------------------------+
|v香v桂 ・ ・ ・ ・ ・v桂v香|一
| ・v飛v玉 ・ ・v角v金 ・ ・|二
| ・ ・ ・v歩 ・v金v銀v歩v歩|三
|v歩 銀 歩 ・v歩 ・v歩 ・ ・|四
| ・ ・ ・ ・ ・ 歩 ・ 歩 歩|五
| 歩v歩 ・ 角 歩 ・ 銀 ・ ・|六
| ・ 歩 ・ 歩 金 ・ 歩 ・ ・|七
| 玉 ・ 金 ・ ・ ・v龍 ・ ・|八
| 香 桂v銀 ・ ・ ・ ・ ・ 香|九
+---------------------------+
先手の持駒：桂 歩
後手番
```
````

#### CSA (board position)

````markdown
```csa
P1-KY-KE *  *  *  *  * -KE-KY
P2 * -HI-OU *  * -KA-KI *  *
P3 *  *  * -FU * -KI-GI-FU-FU
P4-FU+GI+FU * -FU * -FU *  *
P5 *  *  *  *  * +FU * +FU+FU
P6+FU-FU * +KA+FU * +GI *  *
P7 * +FU * +FU+KI * +FU *  *
P8+OU * +KI *  *  * -RY *  *
P9+KY+KE-GI *  *  *  *  * +KY
P+00FU00KE
P-00FU
-
```
````

---

### Viewer Layout

* **Board & controls**: top
* **Variation tree**: below the board
* **Comments panel**: below the variation tree

Click inside the viewer (or its controls) once to enable keyboard shortcuts.

### Settings

You can change viewer display settings from **Settings → Community plugins → ShogiView**:

1. In **Control button labels**, choose one of:
   * **Text + icon** (`text-with-icon`)
     * `First ⏮` / `Back ◀` / `Forward ▶` / `Last ⏭`
     * `Autoplay ▶` (stopped) / `Pause ⏸` (playing)
   * **Icon only** (`icon-only`)
     * `⏮` / `◀` / `▶` / `⏭`
     * `▶` (stopped) / `⏸` (playing)
2. In **Board width mode**, choose one of:
   * **Auto** (`auto`): board-wrapper width is derived from the smaller value of the note reading area width and height.
   * **Manual** (`manual`): board-wrapper width is fixed to the value in **Board wrapper width (px)**.
3. In **Board wrapper width (px)**, set a width between `360` and `1400` when manual mode is selected. The value is applied when you press **Enter** or leave the field.

When board width changes, cell size is scaled and piece text (including captured pieces) scales with the same ratio, so promoted piece rendering remains visually consistent.

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

## Position format support details (SFEN / BOD / CSA)

* `sfen` code block: parses board, side-to-move, and pieces in hand.
* `bod` code block: parses board diagram rows (`|...|`), `先手の持駒`, `後手の持駒`, and side-to-move (`先手番` / `後手番`).
* `csa` code block: parses `P1`-`P9` board rows, `P+` / `P-` hands (`00XX`), and side-to-move (`+` / `-`).
* These formats are position-first inputs. Move list playback is not included unless the source itself provides moves (e.g. KIF).

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
