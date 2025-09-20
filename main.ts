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
}

const JP_NUM = '１２３４５６７８９';
function jpDigitToNum(ch: string): number {
  const idx = JP_NUM.indexOf(ch);
  if (idx >= 0) return idx + 1;
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
  const B:(Piece|null)[][] = Array.from({length:9},()=>Array(9).fill(null));
  const put = (f:number,r:number,kind:PieceKind, side:Side) => { B[r-1][f-1] = {kind, side}; };
  // --- 後手(W) 上段 ---
  put(1,9,'香','W'); put(2,9,'桂','W'); put(3,9,'銀','W'); put(4,9,'金','W'); put(5,9,'王','W'); put(6,9,'金','W'); put(7,9,'銀','W'); put(8,9,'桂','W'); put(9,9,'香','W');
  put(2,8,'飛','W'); put(8,8,'角','W');
  for (let f=1; f<=9; f++) put(f,7,'歩','W');
  // --- 先手(B) 下段 ---
  for (let f=1; f<=9; f++) put(f,3,'歩','B');
  put(2,2,'角','B'); put(8,2,'飛','B');
  put(1,1,'香','B'); put(2,1,'桂','B'); put(3,1,'銀','B'); put(4,1,'金','B'); put(5,1,'玉','B'); put(6,1,'金','B'); put(7,1,'銀','B'); put(8,1,'桂','B'); put(9,1,'香','B');
  return B;
}

function cloneBoard(B:(Piece|null)[][]){
  return B.map(row=>row.map(c=>c?{...c}:null));
}

// Very small KIF move parser for lines like:
// "   1 ２六歩(27)( 0:12/00:00:12)" or with comments lines starting with '*'
function parseKif(text: string): { header: Record<string,string>, moves: Move[] } {
  const header: Record<string,string> = {};
  const moves: Move[] = [];
  const lines = text.split(/\r?\n/);
  const moveRe = /^\s*(\d+)\s+([１２３４５６７８９1-9]{2})([歩香桂銀金角飛玉王と成香成桂成銀馬龍])(?:\((\d{2})\))?(?:\(([^\)]*)\))?/;
  // captures: n, toSquare, piece, fromXY?, timestamp?
  let lastMove: Move|undefined;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;
    if (line.startsWith('#') || line.startsWith('----')) continue;
    if (line.includes('：')) {
      const [k,v] = line.split('：');
      if (k && v) header[k.trim()] = v.trim();
      continue;
    }
    if (line.startsWith('*')) {
      if (lastMove) lastMove.comment = (lastMove.comment? lastMove.comment+'\n': '') + line.slice(1).trim();
      continue;
    }
    const m = line.match(moveRe);
    if (m) {
      const n = parseInt(m[1],10);
      const to = parseSquare(m[2]);
      const kind = m[3] as PieceKind;
      let from: {f:number;r:number}|undefined;
      if (m[4]) {
        const f = parseInt(m[4][0],10);
        const r = parseInt(m[4][1],10);
        from = { f, r };
      }
      const timestamp = m[5]?.trim();
      const mv: Move = { n, to, from, kind, timestamp };
      moves.push(mv);
      lastMove = mv;
    }
  }
  return { header, moves };
}

function squareToDisplayIndex(f:number,r:number): { row:number; col:number } {
  // Board UI left-to-right: file 9..1, top-to-bottom: rank 9..1
  // Given shogi coords (f:1..9 right->left from Sente, r:1..9 near->far), map to grid row/col
  const row = 9 - r;         // r=9 => row 0 (top)
  const col = 9 - f;         // f=9 => col 0 (left)
  return { row, col };
}

export default class ShogiKifViewer extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('kif', (src, el, ctx) => this.renderKif(src, el, ctx));
  }

  renderKif(src: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext) {
    const container = el.createDiv({ cls: 'shogi-kif' });
    const { header, moves } = parseKif(src);

    let board = initialBoard();
    let moveIdx = 0; // 0 = initial, 1..N = after that move
    let lastFrom: {f:number;r:number}|undefined;
    let lastTo: {f:number;r:number}|undefined;

    const toolbar = container.createDiv({ cls: 'toolbar' });
    const btnFirst = toolbar.createEl('button', { text: '⏮ 最初' });
    const btnPrev  = toolbar.createEl('button', { text: '◀ 一手戻る' });
    const btnNext  = toolbar.createEl('button', { text: '一手進む ▶' });
    const btnLast  = toolbar.createEl('button', { text: '最後 ⏭' });

    const boardHost = container.createDiv({ cls: 'board' });
    const meta = container.createDiv({ cls: 'meta' });

    function renderBoard(){
      boardHost.empty();
      for (let r=9; r>=1; r--) {
        for (let f=9; f>=1; f--) {
          const cell = boardHost.createDiv({ cls: 'cell' });
          const P = board[r-1][f-1];
          if (P) {
            cell.setText(P.kind);
            if (P.side==='W') cell.style.opacity = '0.75';
          }
          if (lastTo && lastTo.f===f && lastTo.r===r) cell.addClass('highlight-to');
          if (lastFrom && lastFrom.f===f && lastFrom.r===r) cell.addClass('highlight-from');
        }
      }
      const info = [
        header['棋戦']?`棋戦: ${header['棋戦']}`:undefined,
        header['戦型']?`戦型: ${header['戦型']}`:undefined,
        moveIdx>0 && moves[moveIdx-1]?.timestamp?`消費時間: ${moves[moveIdx-1].timestamp}`:undefined
      ].filter(Boolean).join(' / ');
      meta.setText(info);
    }

    function applyUpTo(idx:number){
      board = initialBoard();
      lastFrom = lastTo = undefined;
      // Very naive move applier: uses explicit (from) if present, ignores promotions/drops, handles simple capture
      for (let i=0; i<idx; i++) {
        const mv = moves[i];
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

    btnFirst.onclick = ()=> applyUpTo(0);
    btnPrev.onclick  = ()=> applyUpTo(Math.max(0, moveIdx-1));
    btnNext.onclick  = ()=> applyUpTo(Math.min(moves.length, moveIdx+1));
    btnLast.onclick  = ()=> applyUpTo(moves.length);

    // initial render
    applyUpTo(0);

    // If there are inline comments (*) after a move, show them beneath
    const commentsDiv = container.createDiv({ cls: 'meta' });
    const updateComments = () => {
      commentsDiv.empty();
      if (moveIdx>0) {
        const mv = moves[moveIdx-1];
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
    btnNext.onclick  = wrap(()=>applyUpTo(Math.min(moves.length, moveIdx+1)));
    btnLast.onclick  = wrap(()=>applyUpTo(moves.length));
    updateComments();
  }
}
