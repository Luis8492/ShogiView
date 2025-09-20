import { Plugin, MarkdownPostProcessorContext } from 'obsidian';

// --- Types & helpers ---
type Side = 'B' | 'W'; // B=先手, W=後手

type PieceKind = '歩'|'香'|'桂'|'銀'|'金'|'角'|'飛'|'玉'|'王'|'と'|'成香'|'成桂'|'成銀'|'馬'|'龍';
interface Piece { side: Side; kind: PieceKind; }
interface Move {
  n: number;             // 手数
  to: { f: number; r: number }; // 先(行き先): file(筋)1-9, rank(段)1-9
  from?: { f: number; r: number };// 元位置 例: (27)
  kind?: PieceKind;      // 記載の駒
  comment?: string;      // * コメント
  timestamp?: string;    // ( 0:12/00:00:12) など
  notation?: string;     // 元の指し手表記
  drop?: boolean;        // 打つ手かどうか
  variations: VariationLine[];
}

interface VariationLine {
  startFrom: number;           // この変化が始まる直前の手数（0始まり）
  firstMoveNumber: number;     // 変化の最初の手数（startFrom+1）
  moves: Move[];               // 変化の指し手
  rootVariations: VariationLine[]; // 変化開始位置でさらに分岐がある場合
}

interface LineOption {
  label: string;
  path: VariationLine[];
  moves: Move[];
}

const JP_NUM_FULL = '１２３４５６７８９';
const JP_NUM_KANJI = '一二三四五六七八九';
function jpDigitToNum(ch: string): number {
  const fullIdx = JP_NUM_FULL.indexOf(ch);
  if (fullIdx >= 0) return fullIdx + 1;
  const kanjiIdx = JP_NUM_KANJI.indexOf(ch);
  if (kanjiIdx >= 0) return kanjiIdx + 1;
  const n = parseInt(ch, 10);
  if (!isNaN(n) && n>=1 && n<=9) return n;
  throw new Error('Invalid digit: '+ch);
}

function parseSquare(s: string): { f:number; r:number } {
  // 例: "２六" または "26"
  if (s.length < 2) throw new Error('square short');
  const f = jpDigitToNum(s[0]);
  const r = jpDigitToNum(s[1]);
  return { f, r };
}

function initialBoard(): (Piece|null)[][] {
  // 9x9 [rank(1..9)][file(1..9)] as [r-1][f-1]
  // 段はKIF表記と同じ順序で、段1が後手側最上段、段9が先手側最下段
  const board:(Piece|null)[][] = Array.from({length:9},()=>Array(9).fill(null));
  const put = (f:number,r:number,kind:PieceKind, side:Side) => { board[r-1][f-1] = {kind, side}; };

  // --- 後手(W): 段1〜3 ---
  put(1,1,'香','W'); put(2,1,'桂','W'); put(3,1,'銀','W'); put(4,1,'金','W'); put(5,1,'王','W'); put(6,1,'金','W'); put(7,1,'銀','W'); put(8,1,'桂','W'); put(9,1,'香','W');
  put(8,2,'飛','W'); put(2,2,'角','W');
  for (let f=1; f<=9; f++) put(f,3,'歩','W');

  // --- 先手(B): 段7〜9 ---
  for (let f=1; f<=9; f++) put(f,7,'歩','B');
  put(2,8,'飛','B'); put(8,8,'角','B');
  put(1,9,'香','B'); put(2,9,'桂','B'); put(3,9,'銀','B'); put(4,9,'金','B'); put(5,9,'玉','B'); put(6,9,'金','B'); put(7,9,'銀','B'); put(8,9,'桂','B'); put(9,9,'香','B');
  return board;
}

function cloneBoard(B:(Piece|null)[][]){
  return B.map(row=>row.map(c=>c?{...c}:null));
}

const MOVE_LINE_RE = /^\s*(\d+)\s+(.*)$/;
const VARIATION_LINE_RE = /^変化：(\d+)手/;

function parsePieceToken(token: string): { kind: PieceKind; rest: string } | null {
  const patterns: Array<{ pattern: RegExp; kind: PieceKind }> = [
    { pattern: /^成香/, kind: '成香' },
    { pattern: /^成桂/, kind: '成桂' },
    { pattern: /^成銀/, kind: '成銀' },
    { pattern: /^と/, kind: 'と' },
    { pattern: /^馬/, kind: '馬' },
    { pattern: /^龍/, kind: '龍' },
    { pattern: /^竜/, kind: '龍' },
    { pattern: /^角成/, kind: '馬' },
    { pattern: /^飛成/, kind: '龍' },
    { pattern: /^銀成/, kind: '成銀' },
    { pattern: /^桂成/, kind: '成桂' },
    { pattern: /^香成/, kind: '成香' },
    { pattern: /^歩成/, kind: 'と' },
    { pattern: /^香/, kind: '香' },
    { pattern: /^桂/, kind: '桂' },
    { pattern: /^銀/, kind: '銀' },
    { pattern: /^金/, kind: '金' },
    { pattern: /^角/, kind: '角' },
    { pattern: /^飛/, kind: '飛' },
    { pattern: /^玉/, kind: '玉' },
    { pattern: /^王/, kind: '王' },
    { pattern: /^歩/, kind: '歩' },
  ];
  for (const entry of patterns) {
    const m = token.match(entry.pattern);
    if (m) {
      return { kind: entry.kind, rest: token.slice(m[0].length) };
    }
  }
  return null;
}

function parseMoveLine(raw: string, lastMove?: Move): Move | null {
  const line = raw.trimEnd();
  if (!line) return null;
  const match = line.match(MOVE_LINE_RE);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  let rest = match[2].trimEnd();

  let timestamp: string | undefined;
  const timeMatch = rest.match(/\(([^()]+)\)\s*$/);
  if (timeMatch && /[:\/]/.test(timeMatch[1])) {
    timestamp = timeMatch[1].trim();
    rest = rest.slice(0, timeMatch.index).trimEnd();
  }

  let from: { f: number; r: number } | undefined;
  const fromMatch = rest.match(/\((\d{2})\)\s*$/);
  if (fromMatch) {
    const digits = fromMatch[1];
    from = { f: parseInt(digits[0], 10), r: parseInt(digits[1], 10) };
    rest = rest.slice(0, fromMatch.index).trimEnd();
  }

  const notation = rest.trim();
  if (!notation) return null;

  let work = notation.replace(/　/g, ' ').replace(/\s+/g, '');
  if (!work) return null;

  let to: { f: number; r: number } | undefined;
  if (work.startsWith('同')) {
    to = lastMove?.to ? { ...lastMove.to } : undefined;
    work = work.slice(1);
  } else {
    const toMatch = work.match(/^([１２３４５６７８９1-9一二三四五六七八九]{2})/);
    if (!toMatch) return null;
    to = parseSquare(toMatch[1]);
    work = work.slice(toMatch[0].length);
  }
  if (!to) return null;

  let drop = false;
  if (work.endsWith('打')) {
    drop = true;
    work = work.slice(0, -1);
  }

  const pieceInfo = parsePieceToken(work);
  if (!pieceInfo) return null;
  const { kind } = pieceInfo;

  const move: Move = { n, to, from, kind, timestamp, notation, variations: [] };
  if (drop) move.drop = true;
  return move;
}

function parseVariation(
  lines: string[],
  startIndex: number,
  fromMove: number,
  baseMove?: Move
): { variation: VariationLine; nextIndex: number } {
  const base = fromMove - 1;
  const { moves, rootVariations, nextIndex } = parseMoves(lines, startIndex, base, baseMove);
  return {
    variation: {
      startFrom: base,
      firstMoveNumber: fromMove,
      moves,
      rootVariations,
    },
    nextIndex,
  };
}

function parseMoves(
  lines: string[],
  startIndex: number,
  base: number,
  initialLastMove?: Move
): { moves: Move[]; rootVariations: VariationLine[]; nextIndex: number } {
  const moves: Move[] = [];
  const rootVariations: VariationLine[] = [];
  const pending = new Map<number, VariationLine[]>();
  let lastMove = initialLastMove;
  let index = startIndex;

  const attachVariation = (variation: VariationLine) => {
    if (variation.startFrom <= base) {
      rootVariations.push(variation);
      return;
    }
    const target = moves.find((m) => m.n === variation.startFrom);
    if (target) {
      target.variations.push(variation);
      return;
    }
    const bucket = pending.get(variation.startFrom) ?? [];
    bucket.push(variation);
    pending.set(variation.startFrom, bucket);
  };

  while (index < lines.length) {
    const raw = lines[index];
    const trimmed = raw.trimEnd();
    const trimmedNoLead = trimmed.trimStart();
    if (!trimmed) {
      index++;
      continue;
    }
    if (trimmedNoLead.startsWith('#') || trimmedNoLead.startsWith('----') || trimmedNoLead.startsWith('手数')) {
      index++;
      continue;
    }
    if (trimmedNoLead.startsWith('*')) {
      if (lastMove) {
        const comment = trimmedNoLead.slice(1).trim();
        lastMove.comment = lastMove.comment ? `${lastMove.comment}\n${comment}` : comment;
      }
      index++;
      continue;
    }
    const variationMatch = trimmedNoLead.match(VARIATION_LINE_RE);
    if (variationMatch) {
      const fromMove = parseInt(variationMatch[1], 10);
      if (fromMove <= base) {
        break;
      }
      const baseMoveNumber = fromMove - 1;
      let baseMoveForVariation: Move | undefined;
      if (baseMoveNumber === base) {
        baseMoveForVariation = initialLastMove;
      } else {
        baseMoveForVariation = moves.find((m) => m.n === baseMoveNumber);
      }
      const { variation, nextIndex } = parseVariation(lines, index + 1, fromMove, baseMoveForVariation);
      attachVariation(variation);
      index = nextIndex;
      continue;
    }

    const move = parseMoveLine(raw, lastMove);
    if (move) {
      const waiting = pending.get(move.n);
      if (waiting) {
        move.variations.push(...waiting);
        pending.delete(move.n);
      }
      moves.push(move);
      lastMove = move;
    }
    index++;
  }

  return { moves, rootVariations, nextIndex: index };
}

function parseKif(text: string): { header: Record<string, string>; moves: Move[]; rootVariations: VariationLine[] } {
  const header: Record<string, string> = {};
  const lines = text.split(/\r?\n/);
  let index = 0;

  while (index < lines.length) {
    const raw = lines[index];
    const trimmed = raw.trim();
    if (!trimmed) {
      index++;
      continue;
    }
    if (trimmed.startsWith('#') || trimmed.startsWith('----') || trimmed.startsWith('手数')) {
      index++;
      continue;
    }
    if (VARIATION_LINE_RE.test(trimmed) || MOVE_LINE_RE.test(trimmed)) {
      break;
    }
    const parts = trimmed.split('：');
    if (parts.length >= 2) {
      const key = parts[0]?.trim();
      const value = parts.slice(1).join('：').trim();
      if (key && value) {
        header[key] = value;
      }
    }
    index++;
  }

  const { moves, rootVariations } = parseMoves(lines, index, 0);
  return { header, moves, rootVariations };
}

function mergeMoves(baseMoves: Move[], variation: VariationLine): Move[] {
  const start = variation.startFrom;
  const prefix = baseMoves.filter((mv) => mv.n <= start);
  return [...prefix, ...variation.moves];
}

function formatVariationLabel(variation: VariationLine): string {
  const first = variation.moves[0];
  if (first?.notation) {
    return `変化 ${variation.firstMoveNumber}手: ${first.notation}`;
  }
  return `変化 ${variation.firstMoveNumber}手`;
}

function buildLineOptions(mainMoves: Move[], rootVariations: VariationLine[]): LineOption[] {
  const options: LineOption[] = [{ label: '本譜', path: [], moves: mainMoves }];

  const visit = (
    context: { moves: Move[]; rootVariations: VariationLine[] },
    currentMoves: Move[],
    path: VariationLine[],
    labels: string[]
  ) => {
    const variations: VariationLine[] = [];
    if (context.rootVariations?.length) variations.push(...context.rootVariations);
    for (const mv of context.moves) {
      if (mv.variations?.length) variations.push(...mv.variations);
    }
    for (const variation of variations) {
      const labelParts = [...labels, formatVariationLabel(variation)];
      const lineMoves = mergeMoves(currentMoves, variation);
      const newPath = [...path, variation];
      options.push({ label: labelParts.join(' → '), path: newPath, moves: lineMoves });
      visit(variation, lineMoves, newPath, labelParts);
    }
  };

  visit({ moves: mainMoves, rootVariations }, mainMoves, [], []);
  return options;
}

function squareToDisplayIndex(f:number,r:number): { row:number; col:number } {
  // Board UI left-to-right: file 9..1, top-to-bottom: rank 1..9
  // Given shogi coords (f:1..9 right->left from Sente, r:1..9 bottom->top for Sente), map to grid row/col
  const row = r - 1;         // r=1 => row 0 (top)
  const col = 9 - f;         // f=9 => col 0 (left)
  return { row, col };
}

export default class ShogiKifViewer extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('kif', (src, el, ctx) => this.renderKif(src, el, ctx));
  }

  renderKif(src: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) {
    const container = el.createDiv({ cls: 'shogi-kif' });
    const { header, moves: mainMoves, rootVariations } = parseKif(src);
    const lineOptions = buildLineOptions(mainMoves, rootVariations);
    let activeOption = lineOptions[0];
    let activeMoves = activeOption.moves;

    let board = initialBoard();
    let moveIdx = 0; // 0 = initial, 1..N = after that move
    let lastFrom: {f:number;r:number}|undefined;
    let lastTo: {f:number;r:number}|undefined;

    const toolbar = container.createDiv({ cls: 'toolbar' });
    const btnFirst = toolbar.createEl('button', { text: '⏮ 最初' });
    const btnPrev  = toolbar.createEl('button', { text: '◀ 一手戻る' });
    const btnNext  = toolbar.createEl('button', { text: '一手進む ▶' });
    const btnLast  = toolbar.createEl('button', { text: '最後 ⏭' });

    let variationSelect: HTMLSelectElement | null = null;
    if (lineOptions.length > 1) {
      toolbar.createSpan({ text: '変化:' });
      variationSelect = toolbar.createEl('select');
      variationSelect.addClass('variation-select');
      lineOptions.forEach((opt, idx) => {
        variationSelect!.createEl('option', { value: String(idx), text: opt.label });
      });
      variationSelect.value = '0';
    }

    const boardHost = container.createDiv({ cls: 'board' });
    const meta = container.createDiv({ cls: 'meta' });

    function renderBoard(){
      boardHost.empty();
      for (let r=1; r<=9; r++) {
        for (let f=9; f>=1; f--) {
          const cell = boardHost.createDiv({ cls: 'cell' });
          const P = board[r-1][f-1];
          if (P) {
            const pieceEl = cell.createSpan({ cls: 'piece', text: P.kind });
            if (P.side === 'W') {
              pieceEl.addClass('piece-opponent');
            } else {
              pieceEl.addClass('piece-player');
            }
          }
          if (lastTo && lastTo.f===f && lastTo.r===r) cell.addClass('highlight-to');
          if (lastFrom && lastFrom.f===f && lastFrom.r===r) cell.addClass('highlight-from');
        }
      }
      const info = [
        header['棋戦']?`棋戦: ${header['棋戦']}`:undefined,
        header['戦型']?`戦型: ${header['戦型']}`:undefined,
        moveIdx>0 && activeMoves[moveIdx-1]?.timestamp?`消費時間: ${activeMoves[moveIdx-1].timestamp}`:undefined
      ].filter(Boolean).join(' / ');
      meta.setText(info);
    }

    function applyUpTo(idx:number){
      board = initialBoard();
      lastFrom = lastTo = undefined;
      // Very naive move applier: uses explicit (from) if present, ignores promotions/drops, handles simple capture
      for (let i=0; i<idx; i++) {
        const mv = activeMoves[i];
        if (!mv) break;
        const from = mv.from;
        const to = mv.to;
        if (!from) continue; // MVP: require (xx) source
        const src = board[from.r-1][from.f-1];
        if (!src) continue;
        // move piece
        board[to.r-1][to.f-1] = src; // capture if any
        board[from.r-1][from.f-1] = null;
        lastFrom = from; lastTo = to;
      }
      moveIdx = idx;
      renderBoard();
    }

    const moveCount = () => activeMoves.length;

    btnFirst.onclick = ()=> applyUpTo(0);
    btnPrev.onclick  = ()=> applyUpTo(Math.max(0, moveIdx-1));
    btnNext.onclick  = ()=> applyUpTo(Math.min(moveCount(), moveIdx+1));
    btnLast.onclick  = ()=> applyUpTo(moveCount());

    // initial render
    applyUpTo(0);

    // If there are inline comments (*) after a move, show them beneath
    const commentsDiv = container.createDiv({ cls: 'meta' });
    const updateComments = () => {
      commentsDiv.empty();
      if (moveIdx>0) {
        const mv = activeMoves[moveIdx-1];
        if (mv?.comment) {
          const pre = commentsDiv.createEl('pre');
          pre.textContent = mv.comment;
        }
      }
    };

    // patch buttons to also refresh comments
    const wrap = (fn: ()=>void) => () => { fn(); updateComments(); };
    btnFirst.onclick = wrap(()=>applyUpTo(0));
    btnPrev.onclick  = wrap(()=>applyUpTo(Math.max(0, moveIdx-1)));
    btnNext.onclick  = wrap(()=>applyUpTo(Math.min(moveCount(), moveIdx+1)));
    btnLast.onclick  = wrap(()=>applyUpTo(moveCount()));

    const applyLineOption = (option: LineOption) => {
      activeOption = option;
      activeMoves = option.moves;
      if (moveIdx > activeMoves.length) {
        moveIdx = activeMoves.length;
      }
      applyUpTo(moveIdx);
      updateComments();
    };

    if (variationSelect) {
      variationSelect.onchange = () => {
        const idx = Number(variationSelect!.value);
        const option = lineOptions[idx];
        if (option) {
          applyLineOption(option);
        }
      };
    }

    updateComments();
  }
}
