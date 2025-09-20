import { Plugin, MarkdownPostProcessorContext } from 'obsidian';


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
