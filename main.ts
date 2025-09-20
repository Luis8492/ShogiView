import { Plugin, MarkdownPostProcessorContext } from 'obsidian';
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
btnPrev.onclick = ()=> applyUpTo(Math.max(0, moveIdx-1));
btnNext.onclick = ()=> applyUpTo(Math.min(moves.length, moveIdx+1));
btnLast.onclick = ()=> applyUpTo(moves.length);


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
btnPrev.onclick = wrap(()=>applyUpTo(Math.max(0, moveIdx-1)));
btnNext.onclick = wrap(()=>applyUpTo(Math.min(moves.length, moveIdx+1)));
btnLast.onclick = wrap(()=>applyUpTo(moves.length));
updateComments();
}
}


// =============================
// Usage in a note
// =============================
// ```kif
// # ---- ぴよ将棋 棋譜ファイル ----
// 棋戦：ぴよ将棋
// 戦型：△ツノ銀雁木
// 開始日時：2025/09/20 17:38:04
// 終了日時：2025/09/20 17:54:54
// 手合割：平手
// 先手：プレイヤー
// 後手：プレイヤー
// 手数----指手---------消費時間--
// 1 ２六歩(27)( 0:12/00:00:12)
// 2 ３四歩(33)( 0:05/00:00:05)
// 3 ２五歩(26)( 0:01/00:00:13)
// ```
