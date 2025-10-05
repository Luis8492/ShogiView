# ShogiView

## Overview

ShogiView lets you paste shogi game records written in the KIF format into Obsidian Markdown notes and replay them on an interactive board. It keeps game reviews and reference studies within Obsidian.

## Key Features

- Parse and render KIF-formatted game records inside ` ```kif` code blocks
- Update the board and captured pieces in real time while highlighting the previous move's origin and destination
- Navigate the moves with **First / Back / Forward / Last** buttons
- Provide keyboard shortcuts to move through positions with the ←/→ and Home/End keys
- Start or stop autoplay with the space key or toolbar button
- Jump to and start playback from any move number
- Support branching variations with breadcrumbs, a button to return to the parent line, and a dropdown to select variations
- Explore variations in an expandable tree view
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

4. Open the note in Reading view to see the board, captured pieces, and move list. Use the controls or variation tree to replay the game.

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

## License

MIT License (see `LICENSE` for details).

---

## ShogiView（日本語）

Obsidian の Markdown ノートに KIF 形式の棋譜を貼り付けると、インタラクティブな将棋盤で局面を再生できるプラグインです。対局の振り返りや参考棋譜の閲覧を、Obsidian の中で完結させることを目的としています。

## 主な機能

- ` ```kif` コードブロックに書かれた KIF 形式の棋譜を解析して表示
- 盤面と双方の持ち駒をリアルタイムに更新し、直前の移動元・移動先をハイライト
- 「最初 / 一手戻る / 一手進む / 最後」ボタンで手順を順送り・巻き戻し
- ←/→・Home/End キーで局面を移動できるキーボードショートカットを提供
- スペースキーまたはツールバーのボタンで自動再生を開始・停止
- 任意の手数を指定してその局面から再生を開始可能
- 分岐棋譜に対応し、現在の分岐を示すパンくず表示・親手順へ戻るボタン・分岐選択ドロップダウンを提供
- 棋譜ツリーを展開／折りたたみしながら閲覧できる変化一覧ビュー
- 最新手のコメントや消費時間、棋戦・戦型などのメタ情報を表示

## 使い方

1. プラグインをビルドし、生成された `main.js`, `manifest.json`, `styles.css` (任意) を Obsidian Vault の `/.obsidian/plugins/shogi-kif-viewer/` フォルダに配置します。フォルダ名は `manifest.json` の `id` (`shogi-kif-viewer`) と一致させないとプラグインが読み込まれません。
2. Obsidian を再起動し、**設定 → Community plugins** からプラグインを有効化します。
3. ノートに以下のようなコードブロックを追加します。

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

4. プレビューまたは Reading モードでノートを開くと、盤面・持ち駒・棋譜一覧が表示されます。ボタンや変化一覧を操作して局面を再生してください。

### KIF 記法について

- 基本的な KIF header (`棋戦`, `戦型` など) と棋譜行をサポートしています。
- 「同」や `打`、成り (`成`)・不成 (`不成`) 表記、座標付きの元位置 `(27)`、時間表記 `( 0:12/00:00:12)` を解析します。
- `* コメント` 形式のコメント行は直前の手にひも付き、コメント欄に表示されます。
- `変化：n手` から始まる分岐はツリー状に展開され、任意の分岐へ移動できます。
- コードブロック先頭付近に `初期表示手：15` や `start-move: 15` のような記述を入れると、その手数から盤面を初期表示できます。

## 開発者向け情報

### 動作環境

- Node.js 18 以上を推奨
- npm (このリポジトリは npm scripts を利用しています)

### セットアップ

```bash
npm install
```

### 開発用ビルド (watch)

```bash
npm run dev
```

### 本番ビルド

```bash
npm run build
```

ビルド後は生成された `main.js` と `manifest.json` (および必要に応じて `styles.css`) を対象の Vault にコピーして動作確認してください。

## ライセンス

MIT License (詳細は `LICENSE` を参照してください)。
