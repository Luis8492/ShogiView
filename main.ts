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
  drop?: boolean;        // 持ち駒からの打ち
  comment?: string;      // * コメント
  timestamp?: string;    // ( 0:12/00:00:12) など
  rawTo?: string;        // 元の移動先表示 (例: "同")
}

interface VariationLine {
  startMoveNumber: number;
  moves: ParsedMove[];
  parent?: { line: VariationLine; anchorMoveCount: number };
  leadVariations: VariationLine[];
}

interface ParsedMove extends Move {
  variations: VariationLine[];
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

function demoteKind(kind: PieceKind): PieceKind {
  switch (kind) {
    case 'と': return '歩';
    case '成香': return '香';
    case '成桂': return '桂';
    case '成銀': return '銀';
    case '馬': return '角';
    case '龍': return '飛';
    default: return kind;
  }
}

const HAND_PIECE_ORDER: PieceKind[] = ['飛','角','金','銀','桂','香','歩','玉','王'];

type Hands = Record<Side, PieceKind[]>;

// Very small KIF move parser for lines like:
// "   1 ２六歩(27)( 0:12/00:00:12)" or with comments lines starting with '*'
function parseKif(text: string): { header: Record<string,string>, root: VariationLine } {
  const header: Record<string,string> = {};
  const root: VariationLine = { startMoveNumber: 1, moves: [], leadVariations: [] };
  interface ParseContext { line: VariationLine; prevMove?: ParsedMove; }
  const rootContext: ParseContext = { line: root };
  const contextStack: ParseContext[] = [rootContext];

  const lines = text.split(/\r?\n/);
  const piecePattern = '(成香|成桂|成銀|馬|龍|と|歩|香|桂|銀|金|角|飛|玉|王)';
  const moveRe = new RegExp(`^\\s*(\\d+)\\s+((?:同(?:\\s|　)?)|[${JP_NUM_FULL}1-9${JP_NUM_KANJI}]{2})${piecePattern}(打?)(?:\\((\\d{2})\\))?(?:\\(([^\\)]*)\\))?`);
  const variationRe = /^変化：(\d+)手/;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#') || trimmed.startsWith('----')) continue;

    const variationMatch = trimmed.match(variationRe);
    if (variationMatch) {
      const start = parseInt(variationMatch[1], 10);
      const targetNumber = start - 1;
      let anchorContext: ParseContext | undefined;
      let anchorMove: ParsedMove | undefined;
      if (start === 1) {
        anchorContext = rootContext;
      } else {
        for (let i = contextStack.length - 1; i >= 0; i--) {
          const ctx = contextStack[i];
          const mv = ctx.line.moves.find(m => m.n === targetNumber);
          if (mv) {
            anchorContext = ctx;
            anchorMove = mv;
            break;
          }
        }
      }
      if (!anchorContext) {
        anchorContext = rootContext;
        anchorMove = undefined;
      }
      while (contextStack.length && contextStack[contextStack.length - 1] !== anchorContext) {
        contextStack.pop();
      }
      const anchorMoveCount = anchorMove ? (anchorContext.line.moves.indexOf(anchorMove) + 1) : 0;
      const variationLine: VariationLine = {
        startMoveNumber: start,
        moves: [],
        parent: { line: anchorContext.line, anchorMoveCount },
        leadVariations: [],
      };
      if (anchorMove) {
        anchorMove.variations.push(variationLine);
      } else {
        anchorContext.line.leadVariations.push(variationLine);
      }
      contextStack.push({ line: variationLine, prevMove: anchorMove });
      continue;
    }

    if (trimmed.includes('：')) {
      const [k, v] = trimmed.split('：');
      if (k && v) header[k.trim()] = v.trim();
      continue;
    }

    if (trimmed.startsWith('*')) {
      const ctx = contextStack[contextStack.length - 1];
      if (ctx.prevMove) {
        ctx.prevMove.comment = (ctx.prevMove.comment ? ctx.prevMove.comment + '\n' : '') + trimmed.slice(1).trim();
      }
      continue;
    }

    const m = line.match(moveRe);
    if (m) {
      const ctx = contextStack[contextStack.length - 1];
      const n = parseInt(m[1], 10);
      const toToken = m[2].replace(/[\s　]/g, '');
      let to: { f: number; r: number } | undefined;
      if (toToken === '同') {
        if (ctx.prevMove?.to) {
          to = { ...ctx.prevMove.to };
        }
      } else {
        try {
          to = parseSquare(toToken);
        } catch {
          to = undefined;
        }
      }
      if (!to) continue;
      const kind = m[3] as PieceKind;
      const drop = m[4] === '打';
      let from: { f: number; r: number } | undefined;
      if (m[5]) {
        const f = parseInt(m[5][0], 10);
        const r = parseInt(m[5][1], 10);
        from = { f, r };
      }
      const timestamp = m[6]?.trim();
      const mv: ParsedMove = {
        n,
        to,
        from,
        kind,
        drop,
        timestamp,
        rawTo: toToken || undefined,
        variations: [],
      };
      ctx.line.moves.push(mv);
      ctx.prevMove = mv;
    }
  }
  return { header, root };
}

function squareToDisplayIndex(f:number,r:number): { row:number; col:number } {
  // Board UI left-to-right: file 9..1, top-to-bottom: rank 1..9
  // Given shogi coords (f:1..9 right->left from Sente, r:1..9 bottom->top for Sente), map to grid row/col
  const row = r - 1;         // r=1 => row 0 (top)
  const col = 9 - f;         // f=9 => col 0 (left)
  return { row, col };
}

function numToFullWidth(n: number): string {
  if (n >= 1 && n <= 9) {
    return JP_NUM_FULL[n - 1];
  }
  return n.toString();
}

function squareToText(square: { f: number; r: number }): string {
  return `${numToFullWidth(square.f)}${numToFullWidth(square.r)}`;
}

function formatMoveLabel(mv: Move): string {
  const squareText = mv.rawTo === '同' ? '同' : squareToText(mv.to);
  const kindText = mv.kind ?? '';
  const dropText = mv.drop ? '打' : '';
  const fromText = !mv.drop && mv.from ? `(${mv.from.f}${mv.from.r})` : '';
  return `${squareText}${kindText}${dropText}${fromText}`;
}

export default class ShogiKifViewer extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('kif', (src, el, ctx) => this.renderKif(src, el, ctx));
  }

  renderKif(src: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) {
    const container = el.createDiv({ cls: 'shogi-kif' });
    const { header, root } = parseKif(src);

    let board = initialBoard();
    let hands: Hands = { B: [], W: [] };
    let lastFrom: { f: number; r: number } | undefined;
    let lastTo: { f: number; r: number } | undefined;
    let latestMove: ParsedMove | undefined;

    let currentLine: VariationLine = root;
    let currentMoveIdx = 0;
    const lineState = new WeakMap<VariationLine, number>();

    const toolbar = container.createDiv({ cls: 'toolbar' });
    const btnFirst = toolbar.createEl('button', { text: '⏮ 最初' });
    const btnPrev = toolbar.createEl('button', { text: '◀ 一手戻る' });
    const btnNext = toolbar.createEl('button', { text: '一手進む ▶' });
    const btnLast = toolbar.createEl('button', { text: '最後 ⏭' });

    const variationBar = container.createDiv({ cls: 'variation-bar' });
    const pathLabel = variationBar.createSpan({ cls: 'variation-current' });
    const btnParent = variationBar.createEl('button', { text: '↩ 親の手順へ' });
    btnParent.addClass('variation-parent');
    const variationSelect = variationBar.createEl('select');
    variationSelect.addClass('variation-select');
    let availableVariations: VariationLine[] = [];

    const layout = container.createDiv({ cls: 'board-layout' });
    const boardArea = layout.createDiv({ cls: 'board-area' });
    const handOpponent = boardArea.createDiv({ cls: 'hands hands-opponent' });
    const boardHost = boardArea.createDiv({ cls: 'board' });
    const handPlayer = boardArea.createDiv({ cls: 'hands hands-player' });
    const handDisplays: Record<Side, HTMLElement> = { W: handOpponent, B: handPlayer };
    const meta = boardArea.createDiv({ cls: 'meta' });
    const commentsDiv = boardArea.createDiv({ cls: 'meta comments' });

    const moveListContainer = layout.createDiv({ cls: 'move-list' });
    moveListContainer.createDiv({ cls: 'move-list-title', text: '棋譜' });
    const moveListBody = moveListContainer.createDiv({ cls: 'move-list-body' });

    function lineLabel(line: VariationLine): string {
      if (!line.parent) return '本筋';
      const first = line.moves[0];
      const moveText = first ? formatMoveLabel(first) : '';
      return moveText ? `変化 ${line.startMoveNumber}手: ${moveText}` : `変化 ${line.startMoveNumber}手`;
    }

    function gatherMoves(line: VariationLine, upto: number): ParsedMove[] {
      const count = Math.max(0, Math.min(upto, line.moves.length));
      const prefix = line.moves.slice(0, count);
      if (!line.parent) {
        return prefix;
      }
      const parentCount = Math.max(
        0,
        Math.min(line.parent.anchorMoveCount, line.parent.line.moves.length)
      );
      const parentSeq = gatherMoves(line.parent.line, parentCount);
      return parentSeq.concat(prefix);
    }

    function renderBoard() {
      boardHost.empty();
      for (let r = 1; r <= 9; r++) {
        for (let f = 9; f >= 1; f--) {
          const cell = boardHost.createDiv({ cls: 'cell' });
          const piece = board[r - 1][f - 1];
          if (piece) {
            const pieceEl = cell.createSpan({ cls: 'piece', text: piece.kind });
            if (piece.side === 'W') {
              pieceEl.addClass('piece-opponent');
            } else {
              pieceEl.addClass('piece-player');
            }
          }
          if (lastTo && lastTo.f === f && lastTo.r === r) cell.addClass('highlight-to');
          if (lastFrom && lastFrom.f === f && lastFrom.r === r) cell.addClass('highlight-from');
        }
      }
    }

    function renderHands() {
      const sides: Side[] = ['W', 'B'];
      for (const side of sides) {
        const div = handDisplays[side];
        div.empty();
        const label = side === 'B' ? '先手' : '後手';
        div.createSpan({ cls: 'hands-label', text: `${label}持ち駒: ` });
        const pieces = hands[side];
        if (!pieces.length) {
          div.createSpan({ cls: 'hands-empty', text: 'なし' });
          continue;
        }
        const counts = new Map<PieceKind, number>();
        for (const k of pieces) {
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        for (const kind of HAND_PIECE_ORDER) {
          const cnt = counts.get(kind);
          if (!cnt) continue;
          div.createSpan({ cls: 'hand-piece', text: cnt > 1 ? `${kind}${cnt}` : kind });
          counts.delete(kind);
        }
        for (const [kind, cnt] of counts) {
          div.createSpan({ cls: 'hand-piece', text: cnt > 1 ? `${kind}${cnt}` : kind });
        }
      }
    }

    function updateMeta() {
      const info = [
        header['棋戦'] ? `棋戦: ${header['棋戦']}` : undefined,
        header['戦型'] ? `戦型: ${header['戦型']}` : undefined,
        latestMove?.timestamp ? `消費時間: ${latestMove.timestamp}` : undefined,
      ]
        .filter(Boolean)
        .join(' / ');
      meta.setText(info);
    }

    function updateComments() {
      commentsDiv.empty();
      if (latestMove?.comment) {
        const pre = commentsDiv.createEl('pre');
        pre.textContent = latestMove.comment;
      }
    }

    function renderMoveList() {
      moveListBody.empty();
      const displaySequence = gatherMoves(currentLine, currentLine.moves.length);
      if (!displaySequence.length) {
        moveListBody.createSpan({ cls: 'move-list-empty', text: '棋譜はありません。' });
        return;
      }
      const executedMoves = new Set(gatherMoves(currentLine, currentMoveIdx));
      const table = moveListBody.createEl('table', { cls: 'move-table' });
      const tbody = table.createEl('tbody');
      const grouped = new Map<number, { n: number; B?: ParsedMove; W?: ParsedMove }>();
      for (const mv of displaySequence) {
        const num = mv.n;
        let entry = grouped.get(num);
        if (!entry) {
          entry = { n: num };
          grouped.set(num, entry);
        }
        if (mv.n % 2 === 1) {
          entry.B = mv;
        } else {
          entry.W = mv;
        }
      }
      const ordered = Array.from(grouped.values()).sort((a, b) => a.n - b.n);
      for (const entry of ordered) {
        const row = tbody.createEl('tr');
        row.createEl('th', { text: entry.n.toString() });
        const senteCell = row.createEl('td');
        const goteCell = row.createEl('td');
        if (entry.B) {
          senteCell.setText(formatMoveLabel(entry.B));
          if (executedMoves.has(entry.B)) senteCell.addClass('move-done');
          if (latestMove && latestMove === entry.B) senteCell.addClass('move-current');
        } else {
          senteCell.addClass('move-empty');
        }
        if (entry.W) {
          goteCell.setText(formatMoveLabel(entry.W));
          if (executedMoves.has(entry.W)) goteCell.addClass('move-done');
          if (latestMove && latestMove === entry.W) goteCell.addClass('move-current');
        } else {
          goteCell.addClass('move-empty');
        }
      }
    }

    function applyCurrent(idx: number) {
      const clamped = Math.max(0, Math.min(idx, currentLine.moves.length));
      currentMoveIdx = clamped;
      lineState.set(currentLine, currentMoveIdx);
      board = initialBoard();
      hands = { B: [], W: [] };
      lastFrom = undefined;
      lastTo = undefined;
      latestMove = undefined;
      const sequence = gatherMoves(currentLine, currentMoveIdx);
      for (const mv of sequence) {
        const side: Side = mv.n % 2 === 1 ? 'B' : 'W';
        let moving: Piece | null = null;
        if (mv.drop) {
          const dropKind = demoteKind(mv.kind ?? '歩');
          const hand = hands[side];
          const idxInHand = hand.findIndex(k => k === dropKind);
          if (idxInHand >= 0) {
            hand.splice(idxInHand, 1);
          }
          moving = { side, kind: dropKind };
          lastFrom = undefined;
        } else if (mv.from) {
          const src = board[mv.from.r - 1][mv.from.f - 1];
          if (!src) continue;
          moving = { ...src };
          board[mv.from.r - 1][mv.from.f - 1] = null;
          lastFrom = mv.from;
        } else {
          continue;
        }
        const to = mv.to;
        const target = board[to.r - 1][to.f - 1];
        if (target && target.side !== side) {
          const capturedKind = demoteKind(target.kind);
          hands[side].push(capturedKind);
        }
        if (moving) {
          board[to.r - 1][to.f - 1] = moving;
        }
        lastTo = to;
        latestMove = mv;
      }
      renderBoard();
      renderHands();
      updateMeta();
      updateComments();
      renderMoveList();
    }

    function updateVariationUI() {
      const pathParts: string[] = [];
      let node: VariationLine | undefined = currentLine;
      while (node) {
        pathParts.push(lineLabel(node));
        node = node.parent?.line;
      }
      pathLabel.setText(`現在: ${pathParts.reverse().join(' → ')}`);
      const parentInfo = currentLine.parent;
      btnParent.disabled = !parentInfo;
      btnParent.toggleClass('is-hidden', !parentInfo);
      variationSelect.empty();
      availableVariations = [];
      const variations: VariationLine[] = [];
      variations.push(...currentLine.leadVariations);
      for (const mv of currentLine.moves) {
        variations.push(...mv.variations);
      }
      if (!variations.length) {
        variationSelect.addClass('is-hidden');
        variationSelect.value = '';
        return;
      }
      variationSelect.removeClass('is-hidden');
      variationSelect.createEl('option', { text: '変化を選択', value: '' });
      variations.forEach((variation, idx) => {
        availableVariations.push(variation);
        let label = lineLabel(variation);
        const anchorCount = variation.parent?.anchorMoveCount ?? 0;
        if (variation.parent?.line === currentLine && anchorCount > currentMoveIdx) {
          label += '（未到達）';
        }
        variationSelect.createEl('option', { text: label, value: String(idx) });
      });
      variationSelect.value = '';
    }

    function switchToVariation(variation: VariationLine) {
      lineState.set(currentLine, currentMoveIdx);
      currentLine = variation;
      const saved = lineState.get(currentLine);
      const target =
        saved !== undefined
          ? Math.max(0, Math.min(saved, currentLine.moves.length))
          : 0;
      applyCurrent(target);
      updateVariationUI();
    }

    function goToParent() {
      const parentInfo = currentLine.parent;
      if (!parentInfo) return;
      lineState.set(currentLine, currentMoveIdx);
      currentLine = parentInfo.line;
      const saved = lineState.get(currentLine);
      const target =
        saved !== undefined
          ? Math.max(0, Math.min(saved, currentLine.moves.length))
          : Math.min(parentInfo.anchorMoveCount, currentLine.moves.length);
      applyCurrent(target);
      updateVariationUI();
    }

    btnFirst.onclick = () => {
      applyCurrent(0);
      updateVariationUI();
    };
    btnPrev.onclick = () => {
      applyCurrent(Math.max(0, currentMoveIdx - 1));
      updateVariationUI();
    };
    btnNext.onclick = () => {
      applyCurrent(Math.min(currentLine.moves.length, currentMoveIdx + 1));
      updateVariationUI();
    };
    btnLast.onclick = () => {
      applyCurrent(currentLine.moves.length);
      updateVariationUI();
    };
    btnParent.onclick = () => {
      goToParent();
    };
    variationSelect.onchange = () => {
      const value = variationSelect.value;
      if (!value) return;
      const idx = parseInt(value, 10);
      if (Number.isNaN(idx)) return;
      const variation = availableVariations[idx];
      if (variation) {
        switchToVariation(variation);
      }
    };

    applyCurrent(0);
    updateVariationUI();
  }
}
