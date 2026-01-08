// --- Types & helpers ---
export interface RenderChildLike {
  registerInterval(id: number): void;
  register(cleanup: () => void): void;
  registerDomEvent(
    element: EventTarget,
    event: string,
    handler: (event: Event) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

export interface RenderContextLike {
  addChild(child: RenderChildLike): void;
}

export interface RenderKifOptions {
  createRenderChild?: (container: HTMLElement) => RenderChildLike;
}
type Side = 'B' | 'W'; // B=先手, W=後手

type PieceKind = '歩'|'香'|'桂'|'銀'|'金'|'角'|'飛'|'玉'|'王'|'と'|'成香'|'成桂'|'成銀'|'馬'|'龍';
interface Piece { side: Side; kind: PieceKind; }
interface Move {
  n: number;             // 手数
  to: { f: number; r: number }; // 先(行き先): file(筋)1-9, rank(段)1-9
  from?: { f: number; r: number };// 元位置 例: (27)
  kind?: PieceKind;      // 記載の駒
  rawKind?: string;      // 表示用の駒表記（例: 歩成）
  promoted?: boolean;    // 成った指し手か
  promotionDeclined?: boolean; // 不成の指し手か
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
  isExpanded: boolean;
}

interface ParsedMove extends Move {
  variations: VariationLine[];
  areVariationsExpanded: boolean;
}

export interface MoveJumpRef {
  line: VariationLine;
  moveIndex: number;
  moveNumber: number;
}

export interface MoveNode {
  id: string;
  label: string;
  ply: number;
  parentId: string | null;
  childIds: string[];
  jumpRef: MoveJumpRef;
}

export interface MoveTree {
  rootId: string;
  nodes: Record<string, MoveNode>;
}

const JP_NUM_FULL = '１２３４５６７８９';
const JP_NUM_KANJI = '一二三四五六七八九';
const BOARD_FILE_LABELS = Array.from(JP_NUM_FULL).reverse();
const BOARD_RANK_LABELS = Array.from(JP_NUM_KANJI);
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

export function initialBoard(): (Piece|null)[][] {
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

export function promoteKind(kind: PieceKind): PieceKind {
  switch (kind) {
    case '歩': return 'と';
    case '香': return '成香';
    case '桂': return '成桂';
    case '銀': return '成銀';
    case '角': return '馬';
    case '飛': return '龍';
    default: return kind;
  }
}

export function demoteKind(kind: PieceKind): PieceKind {
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

interface PieceTokenInfo {
  kind: PieceKind;
  raw: string;
  promoted?: boolean;
  promotionDeclined?: boolean;
}

const PIECE_DIRECTIONS_RE = /(右|左|直|上|引|寄)/g;

function parsePieceToken(token: string): PieceTokenInfo | null {
  const raw = token;
  if (!token) return null;

  let working = token;
  let promoted = false;
  let promotionDeclined = false;

  if (working.endsWith('不成')) {
    promotionDeclined = true;
    working = working.slice(0, -2);
  } else if (working.endsWith('成')) {
    promoted = true;
    working = working.slice(0, -1);
  }

  working = working.replace(PIECE_DIRECTIONS_RE, '');

  let baseKind: PieceKind | undefined;
  switch (working) {
    case '歩':
    case '香':
    case '桂':
    case '銀':
    case '金':
    case '角':
    case '飛':
    case '玉':
    case '王':
    case 'と':
    case '成香':
    case '成桂':
    case '成銀':
    case '馬':
    case '龍':
      baseKind = working as PieceKind;
      break;
    default:
      return null;
  }

  let resultingKind = baseKind;
  if (promoted && !promotionDeclined) {
    const promotedKind = promoteKind(baseKind);
    if (promotedKind !== baseKind) {
      resultingKind = promotedKind;
    } else {
      promoted = false;
    }
  }

  if (promotionDeclined) {
    promoted = false;
  }

  return {
    kind: resultingKind,
    raw,
    promoted: promoted ? true : undefined,
    promotionDeclined: promotionDeclined ? true : undefined,
  };
}

const HAND_PIECE_ORDER: PieceKind[] = ['飛','角','金','銀','桂','香','歩','玉','王'];

const PROMOTED_KINDS = new Set<PieceKind>(['と', '成香', '成桂', '成銀', '馬', '龍']);

function isPromotedKind(kind: PieceKind): boolean {
  return PROMOTED_KINDS.has(kind);
}

type Hands = Record<Side, PieceKind[]>;

// Very small KIF move parser for lines like:
// "   1 ２六歩(27)( 0:12/00:00:12)" or with comments lines starting with '*'
export function parseKif(text: string): { header: Record<string,string>, root: VariationLine } {
  const header: Record<string,string> = {};
  const root: VariationLine = { startMoveNumber: 1, moves: [], leadVariations: [], isExpanded: true };
  interface ParseContext { line: VariationLine; prevMove?: ParsedMove; }
  const rootContext: ParseContext = { line: root };
  const contextStack: ParseContext[] = [rootContext];

  const lines = text.split(/\r?\n/);
  const piecePattern = '((?:成香|成桂|成銀|馬|龍|と|歩|香|桂|銀|金|角|飛|玉|王)(?:右|左|直|上|引|寄)*(?:成|不成)?)';
  const moveRe = new RegExp(`^\\s*(\\d+)\\s+((?:同(?:\\s|\\u3000)?)|[${JP_NUM_FULL}1-9${JP_NUM_KANJI}]{2})${piecePattern}(打?)(?:\\((\\d{2})\\))?(?:\\(([^\\)]*)\\))?`);
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
        isExpanded: false,
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
      const toToken = m[2].replace(/[\s\u3000]/g, '');
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
      const pieceToken = parsePieceToken(m[3]);
      if (!pieceToken) continue;
      const { kind, raw, promoted, promotionDeclined } = pieceToken;
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
        rawKind: raw,
        promoted,
        promotionDeclined,
        drop,
        timestamp,
        rawTo: toToken || undefined,
        variations: [],
        areVariationsExpanded: false,
      };
      ctx.line.moves.push(mv);
      ctx.prevMove = mv;
    }
  }
  return { header, root };
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
  const kindText = mv.rawKind ?? mv.kind ?? '';
  const dropText = mv.drop ? '打' : '';
  const fromText = !mv.drop && mv.from ? `(${mv.from.f}${mv.from.r})` : '';
  return `${squareText}${kindText}${dropText}${fromText}`;
}

export function buildMoveTree(root: VariationLine): MoveTree {
  const nodes: Record<string, MoveNode> = {};
  let counter = 0;

  const createNode = (node: Omit<MoveNode, 'id'>): string => {
    const id = `move-node-${counter++}`;
    nodes[id] = { ...node, id };
    return id;
  };

  const buildLineNodes = (line: VariationLine, parentId: string): string | null => {
    const moveNodeIds = line.moves.map((mv, idx) => {
      const id = createNode({
        label: formatMoveLabel(mv),
        ply: mv.n,
        parentId: idx === 0 ? parentId : null,
        childIds: [],
        jumpRef: {
          line,
          moveIndex: idx,
          moveNumber: mv.n,
        },
      });
      return id;
    });

    for (let i = 0; i < moveNodeIds.length; i++) {
      const nodeId = moveNodeIds[i];
      if (i === 0) {
        nodes[nodeId].parentId = parentId;
      } else {
        const parentMoveId = moveNodeIds[i - 1];
        nodes[nodeId].parentId = parentMoveId;
        nodes[parentMoveId].childIds.push(nodeId);
      }
    }

    for (let i = 0; i < line.moves.length; i++) {
      const mv = line.moves[i];
      const nodeId = moveNodeIds[i];
      for (const variation of mv.variations) {
        const variationRoot = buildLineNodes(variation, nodeId);
        if (variationRoot) {
          nodes[nodeId].childIds.push(variationRoot);
        }
      }
    }

    for (const leadVariation of line.leadVariations) {
      const variationRoot = buildLineNodes(leadVariation, parentId);
      if (variationRoot) {
        nodes[parentId].childIds.push(variationRoot);
      }
    }

    return moveNodeIds[0] ?? null;
  };

  const rootId = createNode({
    label: '開始局面',
    ply: 0,
    parentId: null,
    childIds: [],
    jumpRef: {
      line: root,
      moveIndex: -1,
      moveNumber: 0,
    },
  });

  const mainRoot = buildLineNodes(root, rootId);
  if (mainRoot) {
    nodes[rootId].childIds.push(mainRoot);
  }

  return { rootId, nodes };
}

export function renderKif(
  src: string,
  el: HTMLElement,
  ctx?: RenderContextLike,
  options?: RenderKifOptions,
): void {
  const container = el.createDiv({ cls: 'shogi-kif' });
  container.tabIndex = 0;
  container.setAttr('role', 'region');
  container.setAttr('aria-label', 'Shogi KIF viewer');
  const renderChild = options?.createRenderChild ? options.createRenderChild(container) : {
    registerInterval: () => {},
    register: () => {},
    registerDomEvent: () => {},
  };
  if (ctx && options?.createRenderChild) {
    ctx.addChild(renderChild);
  }
    const startMoveMatch = src.match(/^[\t ]*(?:[#;]|\/\/)?[\t ]*(?:start(?:-?move)?|開始手(?:数)?|表示開始手(?:数)?|初期表示手(?:数)?)[\t ]*(?:[:：=])[\t ]*(\d+)/im);
    const requestedInitialMove = startMoveMatch ? parseInt(startMoveMatch[1], 10) : undefined;
    const { header, root } = parseKif(src);

    let board = initialBoard();
    let hands: Hands = { B: [], W: [] };
    let lastFrom: { f: number; r: number } | undefined;
    let lastTo: { f: number; r: number } | undefined;
    let latestMove: ParsedMove | undefined;

    let currentLine: VariationLine = root;
    let currentMoveIdx = 0;
    const lineState = new WeakMap<VariationLine, number>();

    const viewerRoot = container.createDiv({ cls: 'viewer-root' });
    const boardSection = viewerRoot.createDiv({ cls: 'board-section' });
    const toolbar = boardSection.createDiv({ cls: 'toolbar' });
    const btnFirst = toolbar.createEl('button', {
      text: 'Go to start ⏮',
      attr: {
        type: 'button',
        'aria-label': 'Go to the first move (home)',
        title: 'Go to the first move (home)',
      },
    });
    const btnPrev = toolbar.createEl('button', {
      text: 'Step back ◀',
      attr: {
        type: 'button',
        'aria-label': 'Step back one move (arrrow-left)',
        title: 'Step back one move (arrrow-left)',
      },
    });
    const btnNext = toolbar.createEl('button', {
      text: 'Step forward ▶',
      attr: {
        type: 'button',
        'aria-label': 'Step forward one move (arrow-right)',
        title: 'Step forward one move (arrow-right)',
      },
    });
    const btnLast = toolbar.createEl('button', {
      text: 'Go to end ⏭',
      attr: {
        type: 'button',
        'aria-label': 'Go to the final move (end)',
        title: 'Go to the final move (end)',
      },
    });
    const btnPlayPause = toolbar.createEl('button', {
      text: 'Start autoplay ▶',
      attr: {
        type: 'button',
        'aria-label': 'Start autoplay (space)',
        title: 'Start autoplay (space)',
      },
    });

    const startMoveControls = toolbar.createDiv({ cls: 'start-move-control' });
    startMoveControls.createSpan({ cls: 'start-move-label', text: 'Jump to move:' });
    const startMoveInput = startMoveControls.createEl('input', {
      cls: 'start-move-input',
      attr: {
        type: 'number',
        min: '0',
        step: '1',
        placeholder: 'Move #',
        inputmode: 'numeric',
      },
    });
    const startMoveApply = startMoveControls.createEl('button', {
      cls: 'start-move-apply',
      text: 'Jump!',
      attr: { type: 'button' },
    });
    const startMoveFeedback = startMoveControls.createSpan({ cls: 'start-move-feedback' });

    const variationBar = boardSection.createDiv({ cls: 'variation-bar' });
    const pathLabel = variationBar.createSpan({ cls: 'variation-current' });
    const btnParent = variationBar.createEl('button', { text: 'Return to parent line ↩' });
    btnParent.addClass('variation-parent');
    const variationSelect = variationBar.createEl('select');
    variationSelect.addClass('variation-select');
    let availableVariations: VariationLine[] = [];

    const AUTOPLAY_INTERVAL_MS = 1500;
    let isPlaying = false;
    let autoPlayIntervalId: number | null = null;

    function updatePlayButton() {
      if (isPlaying) {
        btnPlayPause.setText('Pause autoplay ⏸');
        btnPlayPause.setAttr('aria-label', 'Pause autoplay (Space)');
        btnPlayPause.setAttr('title', 'Pause autoplay (Space)');
        btnPlayPause.setAttr('aria-pressed', 'true');
      } else {
        btnPlayPause.setText('Start autoplay ▶');
        btnPlayPause.setAttr('aria-label', 'Start autoplay (Space)');
        btnPlayPause.setAttr('title', 'Start autoplay (Space)');
        btnPlayPause.setAttr('aria-pressed', 'false');
      }
    }

    function stopAutoplay() {
      if (autoPlayIntervalId !== null) {
        window.clearInterval(autoPlayIntervalId);
        autoPlayIntervalId = null;
      }
      if (isPlaying) {
        isPlaying = false;
        updatePlayButton();
      }
    }

    const startAutoplay = () => {
      if (isPlaying) return;
      isPlaying = true;
      const id = window.setInterval(() => {
        if (currentMoveIdx >= currentLine.moves.length) {
          stopAutoplay();
          return;
        }
        applyCurrent(Math.min(currentLine.moves.length, currentMoveIdx + 1));
        updateVariationUI();
      }, AUTOPLAY_INTERVAL_MS);
      autoPlayIntervalId = id;
      renderChild.registerInterval(id);
      updatePlayButton();
    };

    function toggleAutoplay() {
      if (isPlaying) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    }

    const layout = boardSection.createDiv({ cls: 'board-layout' });
    const boardArea = layout.createDiv({ cls: 'board-area' });
    const boardWrapper = boardArea.createDiv({ cls: 'board-wrapper' });
    const handOpponent = boardWrapper.createDiv({ cls: 'hands hands-opponent' });
    const boardWithCoordinates = boardWrapper.createDiv({ cls: 'board-with-coordinates' });
    const handPlayer = boardWrapper.createDiv({ cls: 'hands hands-player' });
    const handDisplays: Record<Side, HTMLElement> = { W: handOpponent, B: handPlayer };
    let boardHost: HTMLDivElement;
    const meta = boardArea.createDiv({ cls: 'meta' });

    const treeViewport = viewerRoot.createDiv({ cls: 'tree-viewport' });
    const treeInner = treeViewport.createDiv({ cls: 'tree-inner' });
    const treeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    treeSvg.setAttribute('class', 'variation-tree-svg');
    treeSvg.style.userSelect = 'none';
    treeViewport.style.userSelect = 'none';
    treeInner.appendChild(treeSvg);

    const commentsContainer = viewerRoot.createDiv({ cls: 'comments-container' });
    const commentsDiv = commentsContainer.createDiv({ cls: 'meta comments' });

    let activeTree: MoveTree | null = null;
    renderChild.registerDomEvent(treeSvg, 'click', (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const nodeEl = target?.closest('[data-node-id]');
      if (!nodeEl || !activeTree) return;
      const nodeId = nodeEl.getAttribute('data-node-id');
      if (!nodeId) return;
      const node = activeTree.nodes[nodeId];
      if (!node) return;
      jumpTo(node.jumpRef.line, node.jumpRef.moveIndex);
    });

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
      const sharedTime = header['持ち時間'];

      const renderPlayerInfo = (container: HTMLElement, side: Side): boolean => {
        const nameKey = side === 'B' ? '先手' : '後手';
        const name = header[nameKey];
        const timeKeys =
          side === 'B'
            ? ['先手持ち時間', '先手持時間']
            : ['後手持ち時間', '後手持時間'];
        let time: string | undefined;
        for (const key of timeKeys) {
          const value = header[key];
          if (value) {
            time = value;
            break;
          }
        }
        if (!time && side === 'B' && sharedTime) {
          time = sharedTime;
        }
        if (name) {
          container.createSpan({ cls: 'player-name', text: name });
        }
        if (time) {
          container.createSpan({ cls: 'player-time', text: time });
        }
        return container.childElementCount > 0;
      };

      const addFileLabels = (container: HTMLElement) => {
        for (const label of BOARD_FILE_LABELS) {
          container.createSpan({ cls: 'board-coordinate board-coordinate-file', text: label });
        }
      };

      const addRankLabels = (container: HTMLElement) => {
        for (const label of BOARD_RANK_LABELS) {
          container.createSpan({ cls: 'board-coordinate board-coordinate-rank', text: label });
        }
      };

      boardWithCoordinates.empty();

      const goteInfo = boardWithCoordinates.createDiv({ cls: 'player-info player-info-opponent' });
      if (!renderPlayerInfo(goteInfo, 'W')) {
        goteInfo.remove();
      }

      const filesTop = boardWithCoordinates.createDiv({ cls: 'board-files board-files-top' });
      addFileLabels(filesTop);

      const middle = boardWithCoordinates.createDiv({ cls: 'board-middle' });
      const ranksLeft = middle.createDiv({ cls: 'board-ranks board-ranks-left' });
      addRankLabels(ranksLeft);

      boardHost = middle.createDiv({ cls: 'board' });

      const ranksRight = middle.createDiv({ cls: 'board-ranks board-ranks-right' });
      addRankLabels(ranksRight);

      const filesBottom = boardWithCoordinates.createDiv({ cls: 'board-files board-files-bottom' });
      addFileLabels(filesBottom);

      const senteInfo = boardWithCoordinates.createDiv({ cls: 'player-info player-info-player' });
      if (!renderPlayerInfo(senteInfo, 'B')) {
        senteInfo.remove();
      }

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
            if (isPromotedKind(piece.kind)) {
              pieceEl.addClass('piece-promoted');
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
        const pieces = hands[side];
        if (!pieces.length) {
          const empty = div.createSpan({ cls: 'hands-empty', text: 'なし' });
          if (side === 'W') empty.addClass('hand-piece-opponent');
          continue;
        }
        const counts = new Map<PieceKind, number>();
        for (const k of pieces) {
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        for (const kind of HAND_PIECE_ORDER) {
          const cnt = counts.get(kind);
          if (!cnt) continue;
          const span = div.createSpan({
            cls: 'hand-piece',
            text: cnt > 1 ? `${kind}${cnt}` : kind,
          });
          if (side === 'W') span.addClass('hand-piece-opponent');
          counts.delete(kind);
        }
        for (const [kind, cnt] of counts) {
          const span = div.createSpan({
            cls: 'hand-piece',
            text: cnt > 1 ? `${kind}${cnt}` : kind,
          });
          if (side === 'W') span.addClass('hand-piece-opponent');
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

    function jumpTo(line: VariationLine, moveIndex: number) {
      stopAutoplay();
      lineState.set(currentLine, currentMoveIdx);
      currentLine = line;
      const targetCount = Math.max(0, Math.min(moveIndex + 1, currentLine.moves.length));
      applyCurrent(targetCount);
      updateVariationUI();
    }

    function findMoveByNumber(
      line: VariationLine,
      moveNumber: number,
    ): { line: VariationLine; moveIndex: number } | null {
      const idx = line.moves.findIndex((mv) => mv.n === moveNumber);
      if (idx >= 0) {
        return { line, moveIndex: idx };
      }
      for (const mv of line.moves) {
        for (const variation of mv.variations) {
          const found = findMoveByNumber(variation, moveNumber);
          if (found) {
            return found;
          }
        }
      }
      for (const variation of line.leadVariations) {
        const found = findMoveByNumber(variation, moveNumber);
        if (found) {
          return found;
        }
      }
      return null;
    }

    function goToMoveNumber(moveNumber: number): boolean {
      if (!Number.isFinite(moveNumber) || moveNumber < 0) {
        return false;
      }
      stopAutoplay();
      if (moveNumber === 0) {
        applyCurrent(0);
        updateVariationUI();
        return true;
      }
      const found = findMoveByNumber(root, moveNumber);
      if (!found) {
        return false;
      }
      if (found.line === currentLine) {
        const target = Math.max(0, Math.min(found.moveIndex + 1, currentLine.moves.length));
        applyCurrent(target);
        updateVariationUI();
      } else {
        jumpTo(found.line, found.moveIndex);
      }
      return true;
    }

    function hasAnyMoves(line: VariationLine): boolean {
      if (line.moves.length > 0) {
        return true;
      }
      for (const lead of line.leadVariations) {
        if (hasAnyMoves(lead)) {
          return true;
        }
      }
      return false;
    }

    function renderMoveTree() {
      while (treeSvg.firstChild) {
        treeSvg.removeChild(treeSvg.firstChild);
      }

      if (!hasAnyMoves(root)) {
        const width = 260;
        const height = 80;
        treeSvg.setAttribute('width', String(width));
        treeSvg.setAttribute('height', String(height));
        treeInner.style.width = `${width}px`;
        treeInner.style.height = `${height}px`;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(width / 2));
        text.setAttribute('y', String(height / 2));
        text.setAttribute('class', 'tree-empty');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.textContent = '棋譜はありません。';
        treeSvg.appendChild(text);
        activeTree = null;
        return;
      }

      const tree = buildMoveTree(root);
      activeTree = tree;
      const executedMoves = new Set(gatherMoves(currentLine, currentMoveIdx));
      const activeLineRanges = new Map<VariationLine, number | null>();
      let pointer: VariationLine | undefined = currentLine;
      let limit: number | null = null;
      while (pointer) {
        activeLineRanges.set(pointer, limit);
        const parentLink: VariationLine['parent'] = pointer.parent;
        if (!parentLink) break;
        limit = Math.max(parentLink.anchorMoveCount - 1, -1);
        pointer = parentLink.line;
      }

      const NODE_WIDTH = 140;
      const NODE_HEIGHT = 32;
      const H_GAP = 56;
      const V_GAP = 24;
      const PADDING = 24;
      const positions: Record<string, { x: number; y: number; depth: number }> = {};
      let maxDepth = 0;

      const layoutNode = (nodeId: string, depth: number, yStart: number): number => {
        const node = tree.nodes[nodeId];
        maxDepth = Math.max(maxDepth, depth);
        positions[nodeId] = { x: depth * (NODE_WIDTH + H_GAP), y: yStart, depth };
        if (!node.childIds.length) {
          return yStart + NODE_HEIGHT + V_GAP;
        }
        const [mainChild, ...branchChildren] = node.childIds;
        let cursor = layoutNode(mainChild, depth + 1, yStart);
        for (const childId of branchChildren) {
          cursor = layoutNode(childId, depth + 1, cursor);
        }
        return Math.max(cursor, yStart + NODE_HEIGHT + V_GAP);
      };

      const layoutEnd = layoutNode(tree.rootId, 0, 0);

      const totalHeight = Math.max(layoutEnd - V_GAP, NODE_HEIGHT);
      const totalWidth = maxDepth * (NODE_WIDTH + H_GAP) + NODE_WIDTH;
      const svgWidth = totalWidth + PADDING * 2;
      const svgHeight = totalHeight + PADDING * 2;
      treeSvg.setAttribute('width', String(svgWidth));
      treeSvg.setAttribute('height', String(svgHeight));
      treeInner.style.width = `${svgWidth}px`;
      treeInner.style.height = `${svgHeight}px`;

      const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      edgeGroup.setAttribute('class', 'tree-edges');
      edgeGroup.setAttribute('transform', `translate(${PADDING}, ${PADDING})`);

      for (const node of Object.values(tree.nodes)) {
        if (!node.parentId) continue;
        const parentPos = positions[node.parentId];
        const childPos = positions[node.id];
        if (!parentPos || !childPos) continue;
        const startX = parentPos.x + NODE_WIDTH;
        const startY = parentPos.y + NODE_HEIGHT / 2;
        const endX = childPos.x;
        const endY = childPos.y + NODE_HEIGHT / 2;
        const midX = startX + H_GAP / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute(
          'd',
          `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`,
        );
        path.setAttribute('class', 'tree-edge');
        edgeGroup.appendChild(path);
      }

      const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      nodeGroup.setAttribute('class', 'tree-nodes');
      nodeGroup.setAttribute('transform', `translate(${PADDING}, ${PADDING})`);

      for (const node of Object.values(tree.nodes)) {
        const pos = positions[node.id];
        if (!pos) continue;
        const isDone =
          node.jumpRef.moveIndex >= 0 &&
          executedMoves.has(node.jumpRef.line.moves[node.jumpRef.moveIndex]);
        const isCurrent =
          latestMove !== undefined &&
          node.jumpRef.moveIndex >= 0 &&
          node.jumpRef.line.moves[node.jumpRef.moveIndex] === latestMove;
        const activeLimit = activeLineRanges.get(node.jumpRef.line);
        const isActiveLine =
          activeLimit !== undefined &&
          (node.jumpRef.moveIndex < 0 ||
            activeLimit === null ||
            node.jumpRef.moveIndex <= activeLimit);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'tree-node');
        if (isDone) group.classList.add('is-done');
        if (isCurrent) group.classList.add('is-current');
        if (isActiveLine) group.classList.add('is-active-line');
        group.setAttribute('data-node-id', node.id);
        group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'tree-node-rect');
        rect.setAttribute('width', String(NODE_WIDTH));
        rect.setAttribute('height', String(NODE_HEIGHT));
        rect.setAttribute('rx', '6');
        rect.setAttribute('ry', '6');
        group.appendChild(rect);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'tree-node-text');
        text.setAttribute('x', String(NODE_WIDTH / 2));
        text.setAttribute('y', String(NODE_HEIGHT / 2));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        const label =
          node.ply === 0
            ? '開始局面'
            : `${node.ply}${node.ply % 2 === 1 ? '▲' : '△'}${node.label}`;
        text.textContent = label;
        group.appendChild(text);

        nodeGroup.appendChild(group);
      }

      treeSvg.appendChild(edgeGroup);
      treeSvg.appendChild(nodeGroup);

      const currentNode = Object.values(tree.nodes).find((node) => {
        if (!latestMove) return node.ply === 0 && currentMoveIdx === 0;
        return (
          node.jumpRef.moveIndex >= 0 &&
          node.jumpRef.line.moves[node.jumpRef.moveIndex] === latestMove
        );
      });
      if (currentNode) {
        const pos = positions[currentNode.id];
        if (pos) {
          const margin = 40;
          const viewLeft = treeViewport.scrollLeft;
          const viewTop = treeViewport.scrollTop;
          const viewRight = viewLeft + treeViewport.clientWidth;
          const viewBottom = viewTop + treeViewport.clientHeight;
          const nodeLeft = pos.x + PADDING;
          const nodeRight = nodeLeft + NODE_WIDTH;
          const nodeTop = pos.y + PADDING;
          const nodeBottom = nodeTop + NODE_HEIGHT;
          let targetLeft: number | null = null;
          let targetTop: number | null = null;
          if (nodeLeft - margin < viewLeft) {
            targetLeft = Math.max(nodeLeft - margin, 0);
          } else if (nodeRight + margin > viewRight) {
            const maxLeft = Math.max(treeViewport.scrollWidth - treeViewport.clientWidth, 0);
            targetLeft = Math.min(nodeRight + margin - treeViewport.clientWidth, maxLeft);
          }
          if (nodeTop - margin < viewTop) {
            targetTop = Math.max(nodeTop - margin, 0);
          } else if (nodeBottom + margin > viewBottom) {
            const maxTop = Math.max(treeViewport.scrollHeight - treeViewport.clientHeight, 0);
            targetTop = Math.min(nodeBottom + margin - treeViewport.clientHeight, maxTop);
          }
          if (targetLeft !== null || targetTop !== null) {
            treeViewport.scrollTo({
              left: targetLeft ?? treeViewport.scrollLeft,
              top: targetTop ?? treeViewport.scrollTop,
              behavior: isPlaying ? 'smooth' : 'auto',
            });
          }
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
          if (!mv.drop && mv.promoted) {
            moving.kind = promoteKind(moving.kind);
          }
          if (!mv.drop && mv.promotionDeclined && !mv.kind) {
            moving.kind = demoteKind(moving.kind);
          }
          if (mv.kind) {
            moving.kind = mv.kind;
          }
          board[to.r - 1][to.f - 1] = moving;
        }
        lastTo = to;
        latestMove = mv;
      }
      renderBoard();
      renderHands();
      updateMeta();
      updateComments();
      if (isPlaying && currentMoveIdx >= currentLine.moves.length) {
        stopAutoplay();
      }
    }

    function updateVariationUI() {
      const pathParts: string[] = [];
      let node: VariationLine | undefined = currentLine;
      while (node) {
        pathParts.push(lineLabel(node));
        node = node.parent?.line;
      }
      pathLabel.setText(`現在: ${pathParts.reverse().join(' → ')}`);
      const parentInfo: VariationLine['parent'] = currentLine.parent;
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
      } else {
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

      renderMoveTree();
    }

    function switchToVariation(variation: VariationLine) {
      stopAutoplay();
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
      stopAutoplay();
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
      stopAutoplay();
      applyCurrent(0);
      updateVariationUI();
    };
    btnPrev.onclick = () => {
      stopAutoplay();
      applyCurrent(Math.max(0, currentMoveIdx - 1));
      updateVariationUI();
    };
    btnNext.onclick = () => {
      stopAutoplay();
      applyCurrent(Math.min(currentLine.moves.length, currentMoveIdx + 1));
      updateVariationUI();
    };
    btnLast.onclick = () => {
      stopAutoplay();
      applyCurrent(currentLine.moves.length);
      updateVariationUI();
    };
    btnPlayPause.onclick = () => {
      toggleAutoplay();
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

    function handleStartMoveApply() {
      const raw = startMoveInput.value.trim();
      if (!raw) {
        startMoveControls.removeClass('has-error');
        startMoveFeedback.setText('');
        return;
      }
      const moveNumber = parseInt(raw, 10);
      if (Number.isNaN(moveNumber)) {
        startMoveControls.addClass('has-error');
        startMoveFeedback.setText('手数は数字で入力してください。');
        return;
      }
      const success = goToMoveNumber(moveNumber);
      if (!success) {
        startMoveControls.addClass('has-error');
        startMoveFeedback.setText('指定した手が見つかりません。');
      } else {
        startMoveControls.removeClass('has-error');
        startMoveFeedback.setText('');
        startMoveInput.value = moveNumber.toString();
      }
    }

    startMoveApply.onclick = (event) => {
      event.preventDefault();
      handleStartMoveApply();
    };
    startMoveInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleStartMoveApply();
      }
    });

    renderChild.registerDomEvent(container, 'keydown', (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const rawTarget = event.target;
      const target = rawTarget instanceof HTMLElement ? rawTarget : null;
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const isEditable = (el: HTMLElement | null): boolean => {
        if (!el) return false;
        if (el.isContentEditable) return true;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      };

      if (isEditable(target) || (target && target.closest('input, textarea, select, [contenteditable="true"]'))) {
        return;
      }
      if (isEditable(activeElement) || (activeElement && activeElement.closest('input, textarea, select, [contenteditable="true"]'))) {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          stopAutoplay();
          applyCurrent(Math.max(0, currentMoveIdx - 1));
          updateVariationUI();
          break;
        case 'ArrowRight':
          event.preventDefault();
          stopAutoplay();
          applyCurrent(Math.min(currentLine.moves.length, currentMoveIdx + 1));
          updateVariationUI();
          break;
        case 'Home':
          event.preventDefault();
          stopAutoplay();
          applyCurrent(0);
          updateVariationUI();
          break;
        case 'End':
          event.preventDefault();
          stopAutoplay();
          applyCurrent(currentLine.moves.length);
          updateVariationUI();
          break;
        case ' ': // Space key in some browsers
        case 'Space':
        case 'Spacebar':
          event.preventDefault();
          toggleAutoplay();
          break;
        default:
          break;
      }
    });

    updatePlayButton();
    applyCurrent(0);
    updateVariationUI();
    if (requestedInitialMove !== undefined && !Number.isNaN(requestedInitialMove)) {
      startMoveInput.value = requestedInitialMove.toString();
      const success = goToMoveNumber(requestedInitialMove);
      if (!success) {
        startMoveControls.addClass('has-error');
        startMoveFeedback.setText('指定した手が見つかりません。');
      }
    }
  }
