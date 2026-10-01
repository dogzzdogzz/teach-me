/* grade-3/math/decimal 的檢查設定（小數初登場：0.1 ＝ 1/10、個位和十分位、數線、比大小先比整數、一位小數的直式加減）。
   2026-10-01 新增 —— 和小遊戲改成五關五種玩法（「小數工作坊」，§六之五）同一次寫成。在這之前這一課沒有設定檔。

   sim（review.html 的十三個產生器）：每個產生器一組不變條件、正解的第二套實作（只用 make() 留下的原始參數，
   用自己的格式化 myDec() 重算，不呼叫 review.html 的 fmtTenths）。跑起來抓到四個舊缺陷：
   subtractionBorrow 的解釋把借位講反了（「個位不夠減，向十分位借」，兩種語言都是）、
   subtractionBorrow 差 5 時「只算十分位」的誘答等於正解（一題三個選項）、fracDecimalLink 的 n ＝ 1 時兩個誘答都是 1/1、
   divideShare／multiplyBasic 的誘答把題幹的數抄回來。刻意的迷思誘答（十分位題把個位數當答案）白名單只放行那一個值。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的小數算式，用 lib/decarith.js 逐條重算（CLAIM_PROBES 先證明它會響）；
     三層題庫的正解用自己的算法再算一次（圖的塗色格數、數線的點、比大小、加減的文字題）。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關**照遊戲的規則把每一題從頭玩一次**（擺位值把每一種放法走完、青蛙把每一種跳法走完、排排站只有一種排得完），
     證明每一題都解得完、而且解完一定是對的；頁面的純函式（paintCount／placeBarXY／placePieceXY／hopX／sortSlotX／colKeyXY／colSteps）
     一律拿整個題庫或整個定義域去呼叫，再和自己的算法比；nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；
     只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。每一句說明逐個比數字，並且用 decArith 驗它的算式。
     版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-decimal 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');
const { decArith, seen: DEC_SEEN } = require('./lib/decarith.js')();

const isInt = v => Number.isInteger(v);
/* 自己的格式化：十分位整數 → 'w.t'（不呼叫頁面的 gDec／fmtTenths） */
const myDec = t => String((t - t % 10) / 10) + '.' + String(t % 10);
/* 一句話裡的數（小數算一個） */
function toks(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []); }

/* decArith 的正反例：bad:false 必須零誤報、bad:true 一定要抓到 */
const CLAIM_PROBES = [
  { text:'0.4 ＋ 0.3 ＝ 0.7', bad:false }, { text:'0.4 ＋ 0.3 ＝ 0.8', bad:true },
  { text:'十分位：8 ＋ 4 ＝ 12，寫 2', bad:false }, { text:'十分位：8 ＋ 4 ＝ 13', bad:true },
  { text:'2 ＋ 0 ＋ 1 ＝ 3。', bad:false }, { text:'2 ＋ 0 ＋ 1 ＝ 4。', bad:true },
  { text:'3.7 － 1.4 ＝ 2.3', bad:false }, { text:'3.7 − 1.4 = 2.4', bad:true },
  { text:'2.4 + 0.8 = 3.2 — points lined up', bad:false }, { text:'2.4 + 0.8 = 2.12', bad:true },
  { text:'13 － 7 ＝ 6 個 0.1', bad:false }, { text:'0.7 － 0.2 ＝ 0.5 元。', bad:false }, { text:'0.7 － 0.2 ＝ 0.4 元。', bad:true }
];

/* ---------- review.html：正解的第二套實作與選項形狀 ---------- */
const DEC_RE = /^(\d)\.(\d)$/;
const TENTHS_OF = s => { const m = DEC_RE.exec(s); return m ? +m[1] * 10 + +m[2] : NaN; };

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)', find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });", replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['paint', 'place', 'hop', 'sort', 'col'];", replace:"var GAME_ORDER = ['paint', 'hop', 'place', 'sort', 'col'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot',
      find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'gDec(', find:"function gDec(t){ return Math.floor(t / 10) + '.' + (t % 10); }", replace:"function gDec(t){ return Math.round(t / 10) + '.' + (t % 10); }" },

    /* 塗緞帶 */
    { file:'index', expect:'0.5 is half the ribbon', find:"var GAME_PAINT = [ { m:7, f:'d' },", replace:"var GAME_PAINT = [ { m:5, f:'d' }," },
    { file:'index', expect:'both forms', find:"{ m:3, f:'f' }, { m:6, f:'d' }, { m:9, f:'f' }, { m:4, f:'d' }, { m:8, f:'f' } ];", replace:"{ m:3, f:'d' }, { m:6, f:'d' }, { m:9, f:'d' }, { m:4, f:'d' }, { m:8, f:'d' } ];" },
    { file:'index', expect:'appears twice', find:"{ m:4, f:'d' }, { m:8, f:'f' } ];", replace:"{ m:4, f:'d' }, { m:7, f:'f' } ];" },
    { file:'index', expect:'paintCount():', find:'function paintCount(x){ return Math.max(1, Math.min(10, Math.ceil((x - PAINT_RIB.x) / (PAINT_RIB.w / 10)))); }', replace:'function paintCount(x){ return Math.max(1, Math.min(10, Math.round((x - PAINT_RIB.x) / (PAINT_RIB.w / 10)))); }' },
    { file:'index', expect:'a painted length other than m is accepted', find:"        if (done !== e.m){ roundMiss(d.gPaintWrong(done, e.m, e.f)); return; }", replace:"        if (done < 1){ roundMiss(d.gPaintWrong(done, e.m, e.f)); return; }" },
    { file:'index', expect:'"done" before painting counts as a mistake', find:"        if (!done){ roundInfo(d.gPaintFirst); return; }", replace:"        if (!done){ roundMiss(d.gPaintFirst); return; }" },
    { file:'index', expect:'the painted length is not read from where the brush stops', find:"        done = paintCount(pt.x);", replace:"        done = paintCount(pt.x + 28);" },
    { file:'index', expect:'the paint does not follow the brush while dragging', find:"onPlace:function(P){ setPaint(P.busy && P.busy() && onRib(P.cx, P.cy) ? paintCount(P.cx) : done); }", replace:"onPlace:function(P){ setPaint(onRib(P.cx, P.cy) ? paintCount(P.cx) : done); }" },
    { file:'index', expect:'already on the ribbon', find:'PAINT_BRUSH = { x:150, y:150, size:56 };', replace:'PAINT_BRUSH = { x:150, y:80, size:56 };' },
    { file:'index', expect:'whole-pixel pieces', find:'PAINT_RIB = { x:10, y:30, w:280, h:56 }', replace:'PAINT_RIB = { x:10, y:30, w:275, h:56 }' },
    { file:'index', expect:'the ribbon is not 10 equal pieces', find:'      ribbonInto(rib, 10, 0, R.w, R.h);', replace:'      ribbonInto(rib, 9, 0, R.w, R.h);' },
    { file:'index', expect:'gPaintWrong(', find:"' 是 ' + m + ' 個 0.1，要塗 ' + m + ' 段。';", replace:"' 是 ' + m + ' 個 0.1，要塗 ' + (m + 1) + ' 段。';" },
    { file:'index', expect:'gPaintDone en', find:"' lots of 0.1 is ' + gDec(m) + ', which is also ' + m + '/10!'; }", replace:"' lots of 0.1 is ' + gDec(m) + ', which is also ' + m + '/100!'; }" },

    /* 擺位值 */
    { file:'index', expect:'exactly one tenth of the ribbon', find:'PLACE_PC = { w:10, h:14, gap:4,', replace:'PLACE_PC = { w:12, h:14, gap:4,' },
    { file:'index', expect:'the wrong way round would be accepted', find:'var GAME_PLACE = [ { w:2, t:6 },', replace:'var GAME_PLACE = [ { w:2, t:2 },' },
    { file:'index', expect:'should be 1~3', find:'{ w:1, t:8 }, { w:3, t:4 },', replace:'{ w:4, t:8 }, { w:3, t:4 },' },
    { file:'index', expect:'placeRule(one, tenths', find:"    if (kind === 'one' && col === 'tenths') return 'oneNot';", replace:"    if (kind === 'one' && col === 'tenths') return '';" },
    { file:'index', expect:'placeRule(tenth, ones', find:"    if (kind === 'tenth' && col === 'ones') return 'oneNot';".replace("'oneNot'","'tenthNot'"), replace:"    if (kind === 'tenth' && col === 'ones') return 'oneNot';" },
    { file:'index', expect:'can pass', find:"    if (kind === 'one') return a >= w ? 'onesFull' : '';", replace:"    if (kind === 'one') return a > w ? 'onesFull' : '';" },
    { file:'index', expect:'a reason is paired with the wrong rule', find:"why === 'onesFull' ? d.gPlaceOnesFull(e.w, e.t) : d.gPlaceTenthsFull(e.w, e.t));", replace:"why === 'onesFull' ? d.gPlaceTenthsFull(e.w, e.t) : d.gPlaceTenthsFull(e.w, e.t));" },
    { file:'index', expect:'place: whole ribbons 0 and 1 overlap', find:'PLACE_BAR = { w:100, h:14, top:50, step:26 }', replace:'PLACE_BAR = { w:100, h:14, top:50, step:12 }' },
    { file:'index', expect:'a card at home sits on a column', find:'var PLACE_TOK = { y:236, h:60,', replace:'var PLACE_TOK = { y:200, h:60,' },
    { file:'index', expect:'placePieceXY(', find:'y:P.top + Math.floor(i / P.perRow) * P.step + P.h / 2 };', replace:'y:P.top + (i % P.perRow) * P.step + P.h / 2 };' },
    { file:'index', expect:'gPlaceOnesFull zh', find:"return w + '.' + t + ' 的個位是 ' + w + '：已經有 ' + w + ' 條了", replace:"return w + '.' + t + ' 的個位是 ' + t + '：已經有 ' + w + ' 條了" },
    { file:'index', expect:'gPlaceTenthNot en', find:"gPlaceTenthNot:'A small piece is only one tenth of a whole ribbon, so it is 0.1", replace:"gPlaceTenthNot:'A small piece is only one tenth of a whole ribbon, so it is 0.01" },
    { file:'index', expect:'the decimal point is not between', find:'PLACE_DOT = { x:164, y:160 }', replace:'PLACE_DOT = { x:150, y:160 }' },
    { file:'index', expect:'gPlaceDone en', find:"return w + '.' + t + ' is ' + w + (w === 1 ? ' one' : ' ones') + ' and ' + t + ' lots of 0.1!'; }", replace:"return w + '.' + t + ' is ' + t + (w === 1 ? ' one' : ' ones') + ' and ' + w + ' lots of 0.1!'; }" },

    /* 青蛙跳 */
    { file:'index', expect:'strictly between 1 and 2', find:'var GAME_HOP = [13, 16, 18, 12, 17, 14];', replace:'var GAME_HOP = [13, 16, 18, 12, 17, 9];' },
    { file:'index', expect:'appears twice', find:'var GAME_HOP = [13, 16, 18, 12, 17, 14];', replace:'var GAME_HOP = [13, 16, 18, 12, 17, 13];' },
    { file:'index', expect:'the frog can jump past the flag', find:"    if (big) return rem < 10 ? 'over' : '';", replace:"    if (big) return rem < 0 ? 'over' : '';" },
    { file:'index', expect:'jumping past the flag is not a mistake', find:"        if (why === 'over'){ roundMiss(d.gHopOver); return false; }", replace:"        if (why === 'over'){ roundInfo(d.gHopOver); return false; }" },
    { file:'index', expect:'"Done painting" judges while the brush is still being dragged', find:"        if (gSolved || brush.busy()) return;", replace:"        if (gSolved) return;" },
    { file:'index', expect:'disagrees with the rule', find:"    return rem >= 1 ? '' : 'over';", replace:"    return rem >= 0 ? '' : 'over';" },
    { file:'index', expect:'hopRule at', find:"    if (rem >= 10) return 'bigFirst';", replace:"    if (rem >= 20) return 'bigFirst';" },
    { file:'index', expect:'or it is counted as a mistake', find:"        if (why === 'bigFirst'){ roundInfo(d.gHopBigFirst); return false; }", replace:"        if (why === 'bigFirst'){ roundMiss(d.gHopBigFirst); return false; }" },
    { file:'index', expect:'a malformed answer', find:"        var m = /^(0|[1-9]\\d*)(?:\\.(\\d))?$/.exec(s);", replace:"        var m = /^(\\d+)(?:\\.(\\d+))?$/.exec(s);" },
    { file:'index', expect:'the two common mistakes', find:"        else if (v === T % 10) roundMiss(d.gHopNoWhole(s));", replace:"        else if (v === -1) roundMiss(d.gHopNoWhole(s));" },
    { file:'index', expect:'from 0 to 2', find:'HOP_LINE = { x0:20, x1:280, y:120, max:20 }', replace:'HOP_LINE = { x0:20, x1:280, y:120, max:30 }' },
    { file:'index', expect:'inside the drop zone', find:'var HOP_TOK = { y:198, w:96, h:56,', replace:'var HOP_TOK = { y:150, w:96, h:56,' },
    { file:'index', expect:'sticks out of the board', find:'HOP_LINE = { x0:20, x1:280,', replace:'HOP_LINE = { x0:10, x1:280,' },
    { file:'index', expect:'gHopDone zh', find:"return gDec(T) + '：跳了 ' + Math.floor(T / 10) + ' 次 1、' + (T % 10) + ' 次 0.1", replace:"return gDec(T) + '：跳了 ' + Math.floor(T / 10) + ' 次 1、' + (T % 10 + 1) + ' 次 0.1" },
    { file:'index', expect:'gHop2(', find:"if (rem > 0) return 'Hint 2: the flag is ' + rem + (rem === 1", replace:"if (rem > 0) return 'Hint 2: the flag is ' + (rem + 1) + (rem === 1" },
    { file:'index', expect:'hopX(', find:'function hopX(t){ return HOP_LINE.x0 + t * (HOP_LINE.x1 - HOP_LINE.x0) / HOP_LINE.max; }', replace:'function hopX(t){ return HOP_LINE.x0 + t * 12; }' },
    { file:'index', expect:'the flag is not drawn at hopX(T)', find:"      addZone(B, hopX(T) - 1.5, HOP_FLAG.top,", replace:"      addZone(B, hopX(T + 1) - 1.5, HOP_FLAG.top," },
    { file:'index', expect:'the answer can be checked before the frog is on the flag', find:'        if (gSolved || pos !== T) return;', replace:'        if (gSolved) return;' },

    /* 排排站 */
    { file:'index', expect:'the whole-part trap is never practised', find:'var GAME_SORT = [ [9, 12, 4, 17],', replace:'var GAME_SORT = [ [1, 12, 2, 17],' },
    { file:'index', expect:'comparing the tenths is never practised', find:'[13, 8, 21, 16]', replace:'[13, 8, 21, 36]' },
    { file:'index', expect:'two cards are the same', find:'[24, 19, 6, 22]', replace:'[24, 19, 6, 24]' },
    { file:'index', expect:'a card is accepted in a slot that is not its place', find:"        if (v !== c){ roundMiss(d.gSortWrong(v, c)); return false; }", replace:"        if (v === -1){ roundMiss(d.gSortWrong(v, c)); return false; }" },
    { file:'index', expect:'puts it on the wrong side', find:"' 的' + (less ? '前面' : '後面') + '。';", replace:"' 的' + (less ? '後面' : '前面') + '。';" },
    { file:'index', expect:'gSortWrong(', find:"'the whole parts are both ' + wv + ', so compare the tenths: ' + (v % 10)", replace:"'the whole parts are both ' + wv + ', so compare the tenths: ' + (c % 10)" },
    { file:'index', expect:'a card at home is inside a slot', find:'SORT_CARD = { y:184 }', replace:'SORT_CARD = { y:140 }' },
    { file:'index', expect:'sortSlotX(', find:'function sortSlotX(i){ return 150 + (i - 1.5) * SORT_SLOT.step; }', replace:'function sortSlotX(i){ return 150 + (i - 1.5) * (SORT_SLOT.step - 2); }' },
    { file:'index', expect:'"small" is not over the first slot', find:"addZone(B, sortSlotX(0) - S.w / 2, SORT_LBL.y, S.w, SORT_LBL.h, 'glbl', d.gSortSmall);", replace:"addZone(B, sortSlotX(0) - S.w / 2, SORT_LBL.y, S.w, SORT_LBL.h, 'glbl', d.gSortBig);" },

    /* 直式 */
    { file:'index', expect:'does not carry', find:"var GAME_COL = [ { a:24, b:8, op:'+' },", replace:"var GAME_COL = [ { a:24, b:5, op:'+' }," },
    { file:'index', expect:'needs borrowing', find:"{ a:37, b:14, op:'-' }", replace:"{ a:32, b:14, op:'-' }" },
    { file:'index', expect:'colSteps()', find:"      S.push({ k:'t', v:ts % 10, x:tA, y:tB, s:ts, c:c });", replace:"      S.push({ k:'t', v:ts, x:tA, y:tB, s:ts, c:c });" },
    { file:'index', expect:'a box can be filled out of order', find:"          if (s.i !== next){ roundMiss(d.gColOrder(d.gColKinds[N.k])); return false; }", replace:"          if (s.i < next){ roundMiss(d.gColOrder(d.gColKinds[N.k])); return false; }" },
    { file:'index', expect:'a digit is accepted in the point box', find:"          if (!P.data.dot){ roundMiss(d.gColDotNeed); return false; }", replace:"          if (false){ roundMiss(d.gColDotNeed); return false; }" },
    { file:'index', expect:'the point is accepted in a digit box', find:"          if (P.data.dot){ roundMiss(d.gColDotNot); return false; }", replace:"          if (P.data.dot && false){ roundMiss(d.gColDotNot); return false; }" },
    { file:'index', expect:'colRule(step o', find:"    return N.c && val === N.x + N.y ? 'forgot' : 'o';", replace:"    return 'o';" },
    { file:'index', expect:'colRule(step t', find:"    if (N.k === 't') return N.c ? 'tc' : 't';", replace:"    if (N.k === 't') return 't';" },
    { file:'index', expect:'a reason is paired with the wrong rule', find:"why === 'c' ? d.gColC(N.s, val)\n", replace:"why === 'c' ? d.gColT(N.x, N.y, N.v, e.op, val)\n" },
    /* 出關的順序、題庫逐題、產生器的題幹／解釋／誘答（codex 第一輪補上的守門） */
    { file:'index', expect:'the round type is not GAME_ORDER[gRound]', find:"    var type = GAME_ORDER[gRound];\n    gSolved = false;", replace:"    var type = GAME_ORDER[0];\n    gSolved = false;" },
    { file:'index', expect:'it does not draw RENDER[type]', find:"    RENDER[type](d);\n    if (mode === 'ahead')", replace:"    RENDER.paint(d);\n    if (mode === 'ahead')" },
    { file:'index', expect:'does not advance one round at a time', find:"    if (gRound < GAME_ORDER.length - 1){ gRound++; startRound(); }", replace:"    if (gRound < GAME_ORDER.length){ gRound++; startRound(); }" },
    { file:'index', expect:'is not the one the config expects', find:"0.5 是十分之幾？',\n          opts:['5/10','1/5','5/1','1/10'], ans:0,", replace:"0.5 是十分之幾？',\n          opts:['5/10','1/5','5/1','1/10'], ans:1," },
    { file:'review', expect:'the stem does not ask what the answer answers', find:"' 裡面，十分位是多少？'", replace:"' 裡面，個位是多少？'" },
    { file:'review', expect:'the explanation does not carry the working', find:"? d.total + ' ÷ ' + d.divisor + ' ＝ ' + d.quotient + '，每人分到 ' + d.quotient + ' 顆。'", replace:"? '把糖果平分，每人分到一樣多。'" },
    { file:'review', expect:'is not one of the mistakes this generator models', find:"'1/' + d.n, d.n + '/1', (d.n + 1) + '/10']);", replace:"'99/99', d.n + '/1', (d.n + 1) + '/10']);" },
    { file:'index', expect:'col: boxes 0 and 1 overlap', find:'COL_X = { op:66, o:120, p:162, t:204 }', replace:'COL_X = { op:66, o:120, p:150, t:204 }' },
    { file:'index', expect:'a card at home is inside a box', find:'COL_KEYS = { y:256,', replace:'COL_KEYS = { y:214,' },
    { file:'index', expect:'step t card', find:"'，' + s + ' 個 0.1 是 1 和 ' + (s - 10) + ' 個 0.1 —— 十分位寫 ' + (s - 10) + '，1 進到個位", replace:"'，' + s + ' 個 0.1 是 1 和 ' + (s - 10) + ' 個 0.1 —— 十分位寫 ' + s + '，1 進到個位" },
    { file:'index', expect:'step o card', find:"return 'Don’t forget the 1 carried up from the tenths: ' + x + ' + ' + y + ' + 1 = ' + r + '.'; }", replace:"return 'Don’t forget the 1 carried up from the tenths: ' + x + ' + ' + y + ' = ' + r + '.'; }" },
    { file:'index', expect:'gColDone zh', find:"return gDec(a) + (op === '+' ? ' ＋ ' : ' － ') + gDec(b) + ' ＝ ' + gDec(r) + ' —— 小數點對齊", replace:"return gDec(a) + (op === '+' ? ' ＋ ' : ' － ') + gDec(b) + ' ＝ ' + gDec(r + 1) + ' —— 小數點對齊" },
    { file:'index', expect:'the answer point box is not under the two points', find:"el:addZone(B, X.p - COL_PSLOT / 2, Y.s - h, COL_PSLOT, COL_SLOT, 'gslot'), cx:X.p, cy:Y.s,", replace:"el:addZone(B, X.t - COL_PSLOT / 2, Y.s - h, COL_PSLOT, COL_SLOT, 'gslot'), cx:X.t, cy:Y.s," },
    { file:'index', expect:'colKeyXY(', find:'return { x:150 + ((v % K.perRow) - (inRow - 1) / 2) * K.step, y:K.y + row * K.rowStep };', replace:'return { x:150 + ((v % K.perRow) - 1.5) * K.step, y:K.y + row * K.rowStep };' },
    { file:'index', expect:'solved before every digit and the point', find:'        if (next === steps.length && dotDone){', replace:'        if (next === steps.length){' },
    { file:'index', expect:'must never run out', find:"          P.home(); P.el.classList.remove('sel'); if (B.selected === P) B.selected = null;   /* 數字卡拿不完", replace:"          P.lock(P.cx, P.cy); P.el.classList.remove('sel'); if (B.selected === P) B.selected = null;   /* 數字卡拿不完" },

    /* ---- index.html：題庫與範例字串 ---- */
    { file:'index', expect:'the answer should be 0.4', find:"        { pic:{type:'strip', m:3}, stem:'這條緞帶剪成 10 段，塗色的部分是多少？',", replace:"        { pic:{type:'strip', m:4}, stem:'這條緞帶剪成 10 段，塗色的部分是多少？'," },
    { file:'index', expect:'qsAdv[2].why', find:"why:'先算存的：0.4 ＋ 0.3 ＝ 0.7 元", replace:"why:'先算存的：0.4 ＋ 0.3 ＝ 0.8 元" },
    { file:'index', expect:'the borrowing explanation must say the tenths are short', find:"why:'The tenths digit isn’t enough to subtract (3 is smaller than 7), so borrow from the ones:", replace:"why:'The ones digit isn’t enough to subtract, so borrow:" },
    { file:'index', expect:'qsAdv[0] en', find:"{ stem:'Word problem: a ribbon is 0.8 m long. Another 0.5 m is joined on. How long is it now?',\n          opts:['13','0.13','1.3','0.3'], ans:2,", replace:"{ stem:'Word problem: a ribbon is 0.8 m long. Another 0.5 m is joined on. How long is it now?',\n          opts:['13','0.13','1.3','0.3'], ans:3," },

    /* ---- review.html ---- */
    { file:'review', expect:'tB − tA ≥ 5', find:'        var tB = tA + 1 + rand(4);', replace:'        var tB = tA + 1 + rand(5);' },
    { file:'review', expect:'it is the tenths that are short', find:"? '十分位不夠減（' + d.tA + ' 比 ' + d.tB + ' 小），要向個位借：", replace:"? '個位不夠減（' + d.tA + ' 比 ' + d.tB + ' 小），要向十分位借：" },
    { file:'review', expect:'outside 0~9', find:'        var mix = mixOptsInt(d.t, [d.w, (d.t + 1) % 10, (d.t + 9) % 10, (d.t + 2) % 10]);', replace:'        var mix = mixOptsInt(d.t, [d.w, d.t + 1, d.t - 1]);' },
    { file:'review', expect:'copied straight out of the stem', find:'    (avoid || []).forEach(function(v){ seen[v] = true; });', replace:'    ([]).forEach(function(v){ seen[v] = true; });' },
    { file:'review', expect:'option count 3', find:"        var mix = mixOptsText(correct, ['10/' + d.n, '1/' + d.n, d.n + '/1', (d.n + 1) + '/10']);", replace:"        var mix = mixOptsText(correct, ['10/' + d.n, '1/' + d.n, d.n + '/1']);" },
    { file:'review', expect:'has a shape this generator should not make', find:'        var forgotOnes = fmtTenths(d.diff + 10);', replace:'        var forgotOnes = fmtTenths(d.a + d.b);' },
    { file:'review', expect:'the ribbon does not show', find:"          pic: { type:'strip', n:10, m:d.m },", replace:"          pic: { type:'strip', n:10, m:d.m + 1 }," },
    { file:'review', expect:'additionCrossing', find:"? '十分位 ' + d.tA + ' ＋ ' + d.tB + ' ＝ ' + (d.tA + d.tB) + '，超過 10", replace:"? '十分位 ' + d.tA + ' ＋ ' + d.tB + ' ＝ ' + (d.tA + d.tB + 1) + '，超過 10" },
    { file:'review', expect:'opts[ans] != correct', find:"        var correct = fmtTenths(d.a), other = fmtTenths(d.b);", replace:"        var correct = fmtTenths(d.b), other = fmtTenths(d.a);" },
    { file:'review', expect:'the tenths do not cross 10', find:'        var tA = pickUnused([5, 6, 7, 8, 9], used);', replace:'        var tA = pickUnused([1, 6, 7, 8, 9], used);' }
  ],

  sim: {
    /* fmt() 會用到前面的 fmtTenths／toTenths（純函式；中間的 makeStrip 等畫圖函式只宣告、不呼叫，不碰 DOM） */
    blockStart: '  /* ---------- 小數點安全',
    INVARIANTS: {
      stripRead: d => { if (!(isInt(d.m) && d.m >= 1 && d.m <= 9 && d.m !== 5)) return 'm should be 1~9 without 5 (0.5 and its complement are the same)'; },
      placeValue: d => {
        if (!(isInt(d.w) && d.w >= 1 && d.w <= 8)) return 'w should be 1~8';
        if (!(isInt(d.t) && d.t >= 1 && d.t <= 9)) return 't should be 1~9';
      },
      lineRead: d => {
        if (!(isInt(d.t) && d.t >= 1 && d.t <= 19 && d.t % 10 !== 0)) return 't should be 0.1~1.9 and not a whole number';
        if (d.maxT !== (d.t < 10 ? 10 : 20)) return 'the line should end at 1 for t < 1 and at 2 otherwise';
      },
      compareTrap: d => {
        const wa = Math.floor(d.a / 10), wb = Math.floor(d.b / 10);
        if (!(wa > wb)) return 'a must have the bigger whole part';
        if (!(d.a % 10 < d.b % 10)) return 'the trap needs a smaller tenths digit on the bigger number';
      },
      additionCrossing: d => {
        if (d.a !== d.wA * 10 + d.tA || d.b !== d.wB * 10 + d.tB || d.total !== d.a + d.b) return 'a, b, total do not add up';
        if (d.tA + d.tB < 10) return 'the tenths do not cross 10 — there is no carry';
        if (d.total > 99) return 'total ' + d.total + ' is above 9.9';
      },
      subtractionBorrow: d => {
        if (d.a !== d.wA * 10 + d.tA || d.b !== d.wB * 10 + d.tB || d.diff !== d.a - d.b) return 'a, b, diff do not add up';
        if (!(d.tA < d.tB)) return 'the tenths do not need borrowing — the explanation says they do';
        if (!(d.diff > 0)) return 'the difference is not positive';
        if (d.tB - d.tA >= 5) return 'tB − tA ≥ 5 makes "just the tenths" equal to the answer';
      },
      fracDecimalLink: d => { if (!(isInt(d.n) && d.n >= 1 && d.n <= 9)) return 'n should be 1~9'; },
      compareBasic: d => {
        if (!(d.t1 !== d.t2 && d.t1 >= 1 && d.t2 >= 1 && d.t1 <= 9 && d.t2 <= 9)) return 'two different tenths digits 1~9';
        if (d.bigger !== Math.max(d.t1, d.t2)) return 'bigger is not the bigger tenths digit';
      },
      additionSamePlace: d => {
        if (d.sum !== d.a + d.b) return 'sum != a + b';
        if (d.a % 10 + d.b % 10 >= 10) return 'the tenths cross 10 — this generator is the no-carry one';
      },
      subtractionSamePlace: d => {
        if (d.diff !== d.a - d.b) return 'diff != a - b';
        if (d.a % 10 < d.b % 10) return 'the tenths need borrowing — this generator is the no-borrow one';
        if (!(d.diff > 0)) return 'the difference is not positive';
      },
      fractionLink: d => { if (!(d.n >= 4 && d.n <= 8 && d.m >= 1 && d.m < d.n)) return 'need 1 ≤ m < n, n 4~8'; },
      divideShare: d => { if (d.total !== d.divisor * d.quotient || d.quotient < 2) return 'total != divisor × quotient'; },
      multiplyBasic: d => { if (d.product !== d.a * d.b) return 'product != a × b'; }
    },
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'stripRead': return '0.' + d.m;
        case 'placeValue': return String(d.t);
        case 'lineRead': return myDec(d.t);
        case 'compareTrap': return d.a > d.b ? myDec(d.a) : myDec(d.b);
        case 'additionCrossing': return myDec(d.wA * 10 + d.tA + d.wB * 10 + d.tB);
        case 'subtractionBorrow': return myDec((d.wA * 10 + d.tA) - (d.wB * 10 + d.tB));
        case 'fracDecimalLink': return d.n + '/10';
        case 'compareBasic': return d.w + '.' + Math.max(d.t1, d.t2);
        case 'additionSamePlace': return myDec(d.a + d.b);
        case 'subtractionSamePlace': return myDec(d.a - d.b);
        case 'fractionLink': return d.m + '/' + d.n;
        case 'divideShare': return String(d.total / d.divisor);
        case 'multiplyBasic': return String(d.a * d.b);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang, isCorrect){
      const words = lang === 'zh' ? ['一樣大', '沒辦法比較'] : ['They are equal', 'Cannot be compared'];
      if (genId === 'compareTrap' || genId === 'compareBasic'){
        if (words.indexOf(s) >= 0) return isCorrect ? 'the answer cannot be "' + s + '"' : undefined;
        if (!DEC_RE.test(s)) return 'option "' + s + '" is not a one-place decimal';
        return;
      }
      if (genId === 'placeValue' || genId === 'divideShare' || genId === 'multiplyBasic'){
        if (!/^(0|[1-9]\d*)$/.test(s)) return 'option "' + s + '" is not a whole number';
        const n = +s, max = genId === 'placeValue' ? 9 : 99;
        if (n > max) return 'option ' + n + ' outside 0~' + max;
        if (genId !== 'placeValue' && n === 0) return 'option 0 makes no sense for ' + genId;
        return;
      }
      if (genId === 'fracDecimalLink' || genId === 'fractionLink'){
        if (!/^[1-9]\d*\/[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a fraction';
        return;
      }
      /* 小數的答案：正解一定是一位小數 0.0~9.9；誘答可以是刻意的迷思形狀（十分位寫成兩位、漏掉小數點、位置擺錯），
         逐個產生器只放行那一種 */
      if (DEC_RE.test(s)) return;
      if (isCorrect) return 'the answer "' + s + '" is not a one-place decimal';
      if (genId === 'stripRead' && /^0\.0[1-9]$/.test(s)) return;               /* 0.03：位置擺錯 */
      if (genId === 'stripRead' && /^[1-9]$/.test(s)) return;                   /* 3：漏掉小數點 */
      if (genId === 'additionCrossing' && /^\d\.1\d$/.test(s)) return;          /* 1.13：十分位沒進位，直接寫 13 */
      if (genId === 'additionCrossing' && /^[1-9]\d$/.test(s)) return;          /* 13：漏掉小數點 */
      return 'option "' + s + '" has a shape this generator should not make';
    },
    /* 渲染出來的那一題：解釋裡的算式逐條驗（decArith）、圖畫的就是資料說的那一題、借位那一句說的是十分位不夠減 */
    renderCheck: function(d, q, lang, genId){
      const pr = decArith(q.stem + ' ' + q.why).problems;
      if (pr.length) return pr[0];
      if (genId === 'subtractionBorrow' && (lang === 'zh' ? q.why.indexOf('十分位不夠減') : q.why.indexOf('tenths digit isn’t enough')) < 0) return 'the explanation does not say it is the tenths that are short — ' + q.why;
      if (genId === 'subtractionBorrow' && (lang === 'zh' ? q.why.indexOf('向個位借') : q.why.indexOf('borrow from the ones')) < 0) return 'the explanation does not borrow from the ones — ' + q.why;
      if (genId === 'stripRead' && !(q.pic && q.pic.type === 'strip' && q.pic.n === 10 && q.pic.m === d.m)) return 'the ribbon does not show ' + d.m + ' of 10 pieces';
      if (genId === 'lineRead' && !(q.pic && q.pic.type === 'numline' && q.pic.markT === d.t && q.pic.maxT === d.maxT)) return 'the number line does not mark ' + d.t + ' tenths';
      if (genId === 'fractionLink' && !(q.pic && q.pic.type === 'pie' && q.pic.n === d.n && q.pic.m === d.m)) return 'the cake does not show ' + d.m + ' of ' + d.n;
      if (genId === 'lineRead' && toks(q.why).indexOf(myDec(d.t)) < 0) return 'the explanation does not name the point';
      const stem = String(q.stem).replace(/<[^>]+>/g, ''), why = String(q.why), zh = lang === 'zh';
      /* ① 題幹問的就是正解回答的那件事 */
      const ASK = {
        stripRead: zh ? /剪成 10 段，塗色的部分是多少/ : /cut into 10 pieces\. What is the shaded part/,
        placeValue: zh ? new RegExp('^' + d.w + '\\.' + d.t + ' 裡面，十分位是多少？$') : new RegExp('^' + d.w + '\\.' + d.t + ' — what is the tenths digit\\?$'),
        lineRead: zh ? /數線上這個點是多少/ : /What value is this marked point/,
        compareTrap: zh ? /哪一個比較大/ : /^Which is bigger/, compareBasic: zh ? /哪一個比較大/ : /^Which is bigger/,
        additionCrossing: zh ? /又接上 .* 公尺，現在一共多少公尺/ : /is joined on\. How long is it now/,
        subtractionBorrow: zh ? /剪掉 .* 公尺，還剩多少公尺/ : /cuts off .* m\. How much is left/,
        fracDecimalLink: zh ? /^0\.\d 是十分之幾？$/ : /^How many tenths is 0\.\d\?$/,
        additionSamePlace: /^\d\.\d \+ \d\.\d = \?$/, subtractionSamePlace: /^\d\.\d − \d\.\d = \?$/,
        fractionLink: zh ? /塗色的部分，是幾分之幾/ : /What fraction of this cake is shaded/,
        divideShare: zh ? /顆糖平分給 \d+ 個人，每人分到幾顆/ : /shared equally among \d+ people\. How many does each get/,
        multiplyBasic: /^\d × \d+ = \?$/
      };
      if (!ASK[genId] || !ASK[genId].test(stem)) return 'the stem does not ask what the answer answers: ' + stem;
      /* 題幹印出來的數就是資料 */
      const STEMNUMS = {
        placeValue:[myDec(d.w * 10 + d.t)], compareTrap:zh ? [myDec(d.a), myDec(d.b)] : [myDec(d.a), myDec(d.b)],
        compareBasic:[myDec(d.w * 10 + d.t1), myDec(d.w * 10 + d.t2)], additionCrossing:[myDec(d.a), myDec(d.b)], subtractionBorrow:[myDec(d.a), myDec(d.b)],
        fracDecimalLink:['0.' + d.n], additionSamePlace:[myDec(d.a), myDec(d.b)], subtractionSamePlace:[myDec(d.a), myDec(d.b)],
        divideShare:[d.total, d.divisor], multiplyBasic:[d.a, d.b], stripRead:[10], lineRead:[], fractionLink:[]
      };
      if (toks(stem).join(' ') !== STEMNUMS[genId].map(String).join(' ')) return 'the stem prints ' + toks(stem).join(' ') + ', not ' + STEMNUMS[genId].join(' ');
      /* ② 解釋真的寫出算法（數照順序出現，算式由上面的 decArith 驗） */
      const sub = (have, want) => { let i = 0; for (const x of have) if (i < want.length && x === String(want[i])) i++; return i === want.length; };
      const WHY = {
        stripRead:[10, d.m, d.m, '0.1', '0.' + d.m], placeValue:[myDec(d.w * 10 + d.t), d.t, d.w],
        lineRead:[0, d.t, '0.1', myDec(d.t)], compareTrap:[Math.floor(d.a / 10), Math.floor(d.b / 10), myDec(d.a)],
        additionCrossing:[d.tA, d.tB, d.tA + d.tB, 10, 1, d.tA + d.tB - 10, myDec(d.total)],
        subtractionBorrow:[d.tA, d.tB, myDec(d.a), d.a, d.a, d.b, d.diff, myDec(d.diff)],
        fracDecimalLink:['0.' + d.n, d.n, '0.1', d.n],
        compareBasic:[d.w, d.bigger, d.t1 === d.bigger ? d.t2 : d.t1, myDec(d.w * 10 + d.bigger)],
        additionSamePlace:[myDec(d.a), myDec(d.b), myDec(d.sum)], subtractionSamePlace:[myDec(d.a), myDec(d.b), myDec(d.diff)],
        fractionLink:[d.n, d.m], divideShare:[d.total, d.divisor, d.quotient, d.quotient], multiplyBasic:[d.a, d.b, d.product]
      };
      if (!sub(toks(why), WHY[genId])) return 'the explanation does not carry the working ' + WHY[genId].join(' ') + ' — ' + why;
      /* ③ 誘答只能是這個產生器說得出名字的那幾種錯 */
      const dist = q.opts.filter((o, i) => i !== q.ans).map(String);
      const near = (o, c, r) => { const v = TENTHS_OF(o); return !isNaN(v) && Math.abs(v - c) <= r; };
      const words = zh ? ['一樣大', '沒辦法比較'] : ['They are equal', 'Cannot be compared'];
      const FAM = {
        stripRead: o => o === '0.' + (10 - d.m) || o === String(d.m) || o === '0.0' + d.m,
        placeValue: o => [d.w, (d.t + 1) % 10, (d.t + 9) % 10, (d.t + 2) % 10].map(String).indexOf(o) >= 0,
        lineRead: o => near(o, d.t, 3),
        compareTrap: o => o === myDec(d.b) || words.indexOf(o) >= 0,
        compareBasic: o => o === myDec(d.w * 10 + Math.min(d.t1, d.t2)) || words.indexOf(o) >= 0,
        additionCrossing: o => o === (d.wA + d.wB) + '.' + (d.tA + d.tB) || o === String(d.total) || o === myDec(d.total - 10),
        subtractionBorrow: o => o === (d.wA - d.wB) + '.' + (d.tB - d.tA) || o === myDec(d.tB - d.tA) || o === myDec(d.diff + 10),
        fracDecimalLink: o => ['10/' + d.n, '1/' + d.n, d.n + '/1', (d.n + 1) + '/10'].indexOf(o) >= 0,
        additionSamePlace: o => near(o, d.sum, 3) || o === myDec(Math.abs(d.a - d.b)),
        subtractionSamePlace: o => near(o, d.diff, 3) || o === myDec(d.a + d.b),
        fractionLink: o => [d.n + '/' + d.m, (d.m + 1) + '/' + d.n, d.m + '/' + (d.n + 1)].indexOf(o) >= 0,
        divideShare: o => +o >= d.quotient - 1 && +o <= d.quotient + 4,
        multiplyBasic: o => [d.a * (d.b - 1), d.a * (d.b + 1), d.a + d.b].map(String).indexOf(o) >= 0 || Math.abs(+o - d.product) <= 3
      };
      const odd = dist.filter(o => !FAM[genId](o));
      if (odd.length) return 'distractor ' + odd.join(', ') + ' is not one of the mistakes this generator models';
    },
    /* 刻意的迷思誘答：十分位題把個位數當答案（3.7 的十分位 → 3）。只放行那一個值。 */
    stemEchoOk: {
      placeValue: (d, opt) => String(opt) === String(d.w)
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「小數工作坊」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GPICK, shuffle, pick, gDec, PAINT_H, PAINT_RIB, PAINT_PAD, PAINT_BRUSH, GAME_PAINT, paintCount, PLACE_H, PLACE_ONES, PLACE_TENTHS, PLACE_DOT, PLACE_BAR, PLACE_PC, PLACE_TOK, GAME_PLACE, placeBarXY, placePieceXY, placeRule, HOP_H, HOP_LINE, HOP_TICK, HOP_LBL, HOP_FROG, HOP_FLAG, HOP_ARC, HOP_ZONE, HOP_TOK, GAME_HOP, hopX, hopRule, SORT_H, SORT_LBL, SORT_SLOT, SORT_CARD, SORT_PAD, GAME_SORT, sortSlotX, COL_H, COL_X, COL_Y, COL_SLOT, COL_PSLOT, COL_CSLOT, COL_PAD, COL_KEYS, GAME_COL, colKeyXY, colSteps, colRule}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. decArith 先證明會響；之後把 DEC_SEEN 歸零再數覆蓋率 --- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = decArith(pr.text).problems.length > 0;
        if (caught !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"');
      });
      DEC_SEEN.length = 0;

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        decArith(s).problems.forEach(p => fail(where + ': ' + p));
      }));
      const staticSeen = DEC_SEEN.length;
      /* 釘死數量：一個壞掉的正規化會讓每條算式都靜靜讀不到，那樣也是零錯誤 */
      if (staticSeen !== 7) fail('read ' + staticSeen + ' equations in the I18N strings, expected exactly 7 — the arithmetic scan is not reading them (or a quiz sentence was added: update the pin)');

      /* --- 2. 三層題庫：正解用自己的算法再算一次 --- */
      {
        let checked = 0;
        LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
          const w = bank + '[' + i + '] ' + L, stem = String(q.stem).replace(/<[^>]+>/g, ''), ans = q.opts[q.ans];
          let want = null;
          if (q.pic && q.pic.type === 'strip') want = myDec(q.pic.m);
          else if (q.pic && q.pic.type === 'numline') want = myDec(q.pic.markT);
          else {
            let m = stem.match(/^(\d\.\d) ([+−-]) (\d\.\d) = [？?]$/);
            if (m) want = myDec(m[2] === '+' ? TENTHS_OF(m[1]) + TENTHS_OF(m[3]) : TENTHS_OF(m[1]) - TENTHS_OF(m[3]));
            m = stem.match(/^(\d\.\d) 和 (\d\.\d)，哪一個比較大？$/) || stem.match(/^Which is bigger, (\d\.\d) or (\d\.\d)\?$/);
            if (m) want = myDec(Math.max(TENTHS_OF(m[1]), TENTHS_OF(m[2])));
          }
          if (want === null){
            /* 題幹不是算式／比大小／圖的那幾題：逐題寫下自己判斷的正解（換了題目就要來這裡改，不會靜靜跳過） */
            const OWN = { 'qs[1]':{ zh:'十分位', en:'Tenths digit' }, 'qsBoost[0]':{ zh:/^不對，要先比整數部分/, en:/^No — compare the whole part first/ },
                          'qsBoost[1]':{ zh:'5/10', en:'5/10' } };
            const o = OWN[bank + '[' + i + ']'];
            if (bank === 'qsAdv') return;   /* 文字題在下面另外重算 */
            if (!o) return fail(w + ': no independent answer for this question — add it to the config');
            checked++;
            const ok = o[L] instanceof RegExp ? o[L].test(ans) : ans === o[L];
            if (!ok) fail(w + ': the marked answer "' + ans + '" is not the one the config expects');
            return;
          }
          checked++;
          if (ans !== want) fail(w + ': the answer should be ' + want + ', marked "' + ans + '"');
        })));
        if (checked < 10) fail('only ' + checked + ' quiz answers recomputed — the stems are not being read');
        /* 借位的解釋要說「十分位不夠減、向個位借」（review.html 的 subtractionBorrow 原本把它講反了） */
        let borrows = 0;
        LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
          const y = String(q.why);
          if (!/借|borrow/.test(y)) return;
          borrows++;
          const ok = L === 'zh' ? /十分位不夠減/.test(y) && /向個位借/.test(y) : /tenths digit isn’t enough/.test(y) && /borrow from the ones/.test(y);
          if (!ok) fail(bank + '[' + i + '] ' + L + ': the borrowing explanation must say the tenths are short and borrow from the ones — ' + y);
        })));
        if (borrows !== 2) fail('expected the one borrowing question in both languages, found ' + borrows);
        /* 文字題：題幹的數照順序讀出來，用自己的算式算 */
        const WORD = { qsAdv:[ ['+', '1.3'], ['who', 1], ['+-', '0.5'], ['-', '0.6'] ] };
        LANGS.forEach(L => (I18N[L].qsAdv || []).forEach((q, i) => {
          const spec = WORD.qsAdv[i]; if (!spec) return fail('qsAdv[' + i + '] has no recomputation in the config');
          const n = toks(q.stem).filter(x => /\./.test(x)).map(TENTHS_OF);
          let got;
          if (spec[0] === '+') got = myDec(n[0] + n[1]);
          else if (spec[0] === '-') got = myDec(n[0] - n[1]);
          else if (spec[0] === '+-') got = myDec(n[0] + n[1] - n[2]);
          else got = n[0] > n[1] ? 0 : 1;   /* 第一個人比較多 → 第一個名字 */
          if (spec[0] === 'who'){
            const first = L === 'zh' ? '小華' : 'Jay';
            if ((q.opts[q.ans] === first) !== (got === 0)) fail('qsAdv[' + i + '] ' + L + ': the one with more water is marked wrong');
          } else if (got !== spec[1] || q.opts[q.ans] !== got) fail('qsAdv[' + i + '] ' + L + ': stem numbers give ' + got + ', marked "' + q.opts[q.ans] + '"');
        }));
      }

      /* --- 3. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['paint', 'place', 'hop', 'sort', 'col'];
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of examples 2~6), got ' + types.join());
      }
      TYPES.forEach(t => {
        if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
        LANGS.forEach(L => {
          if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
          if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
        });
      });
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      /* 每一句說明：數照順序逐個比（小數算一個），而且句子裡的每一條算式都要算得對 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = toks(text).join(' ');
        if (got !== want.map(String).join(' ')) fail(where + ': numbers should read ' + want.join(' ') + ', got ' + got + ' — ' + text);
        decArith(text).problems.forEach(p => fail(where + ': ' + p));
      };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const grow = (r, p) => ({ x:r.x - p, y:r.y - p, w:r.w + 2 * p, h:r.h + 2 * p });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_PAINT', 'GAME_PLACE', 'GAME_HOP', 'GAME_SORT', 'GAME_COL'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });
      if (D.gDec(13) !== '1.3' || D.gDec(7) !== '0.7' || D.gDec(40) !== '4.0') fail('gDec() does not write tenths as w.t');
      for (let t = 0; t <= 99; t++) if (D.gDec(t) !== myDec(t)) { fail('gDec(' + t + ') is ' + D.gDec(t) + ', should be ' + myDec(t)); break; }

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。
         點目的地的格子（排排站、直式）也要點得到：格子加上兩邊的 pad 至少 44。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('the brush (' + D.PAINT_BRUSH.size + ')', D.PAINT_BRUSH.size);
      tooSmall('the whole-ribbon card height', D.PLACE_TOK.h); tooSmall('the small-piece card width', D.PLACE_TOK.tenth.w);
      tooSmall('a hop card height', D.HOP_TOK.h);
      tooSmall('a decimal card (' + D.SORT_SLOT.w + '×' + D.SORT_SLOT.h + ')', Math.min(D.SORT_SLOT.w, D.SORT_SLOT.h));
      tooSmall('a digit card (' + D.COL_KEYS.size + ')', D.COL_KEYS.size);
      tooSmall('a sort slot with its pad', Math.min(D.SORT_SLOT.w, D.SORT_SLOT.h) + 2 * D.SORT_PAD);
      tooSmall('a column box with its pad', D.COL_SLOT + 2 * D.COL_PAD);
      tooSmall('the point box with its pad', D.COL_PSLOT + 2 * D.COL_PAD);
      tooSmall('the carry box with its pad', D.COL_CSLOT + 2 * D.COL_PAD);
      tooSmall('the ribbon height with its pad', D.PAINT_RIB.h + 2 * D.PAINT_PAD);
      [D.PAINT_BRUSH.size, D.PLACE_TOK.h, D.PLACE_TOK.tenth.w, D.HOP_TOK.h, D.SORT_SLOT.h, D.COL_KEYS.size].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('paint', /addPiece\(B, \{ w:PAINT_BRUSH\.size, h:PAINT_BRUSH\.size, cx:PAINT_BRUSH\.x, cy:PAINT_BRUSH\.y,/, 'the brush is not PAINT_BRUSH');
      need('place', /addPiece\(B, \{ w:T\.one\.w, h:T\.h, cx:T\.one\.x, cy:T\.y,/, 'the whole-ribbon card is not PLACE_TOK.one');
      need('place', /addPiece\(B, \{ w:T\.tenth\.w, h:T\.h, cx:T\.tenth\.x, cy:T\.y,/, 'the small-piece card is not PLACE_TOK.tenth');
      need('hop', /addPiece\(B, \{ w:K\.w, h:K\.h, cx:K\.big, cy:K\.y,[\s\S]*?addPiece\(B, \{ w:K\.w, h:K\.h, cx:K\.small, cy:K\.y,/, 'the hop cards are not HOP_TOK');
      need('sort', /addPiece\(B, \{ w:S\.w, h:S\.h, cx:cx, cy:cy, text:gDec\(v\)/, 'the decimal cards are not SORT_SLOT-sized with gDec(v) on them');
      need('col', /addPiece\(B, \{ w:COL_KEYS\.size, h:COL_KEYS\.size, cx:kp\.x, cy:kp\.y,/, 'the digit cards are not COL_KEYS.size at colKeyXY()');

      /* 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0 —— 中年級「輕度計分，答錯小扣分但不會結束」（§三） */
      if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(src, 'roundMiss');
        if (!fsrc) fail('scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ return fail('scoring: roundMiss() could not run: ' + e.message); }
          if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m) fail('scoring: roundMiss() does not show the reason or record the mistake');
        });
      }
      LANGS.forEach(L => {
        seq('gPts ' + L, I18N[L].gPts(20), [20]);
        seq('gMinus ' + L, I18N[L].gMinus, [5]);
        if (toks(I18N[L].gWin(85)).indexOf('85') < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
      });

      /* --- 每一關真的照 GAME_ORDER 出：startRound() 用 gRound 去查、gNext 一關一關往下、最後一關不再往下 --- */
      {
        const sr = extractFunction(src, 'startRound');
        if (!sr) fail('cannot find startRound() in index.html');
        else {
          if (!/var type = GAME_ORDER\[gRound\];/.test(sr)) fail('startRound(): the round type is not GAME_ORDER[gRound]');
          if (!/RENDER\[type\]\(d\);/.test(sr)) fail('startRound(): it does not draw RENDER[type]');
          if (!/ask\.textContent = d\.gAsks\[type\];/.test(sr)) fail('startRound(): the question is not gAsks[type]');
          if (!/gameStage\.textContent = '';/.test(sr)) fail('startRound(): the stage is not cleared before drawing');
        }
        if (!/gNext\.addEventListener\('click', function\(\)\{\s*if \(gRound < GAME_ORDER\.length - 1\)\{ gRound\+\+; startRound\(\); \}/.test(src)) fail('"Next" does not advance one round at a time (and stop at the last)');
        const sh = extractFunction(src, 'showHint');
        if (!sh || !/d\.gHints\[type\] \+ \(hintLevel >= 2 && gCtx\.hint2 \? ' ' \+ gCtx\.hint2\(\) : ''\)/.test(sh) || !/type = GAME_ORDER\[gRound\]/.test(sh)) fail('showHint(): the two-level hint is not gHints[type] + hint2()');
      }

      /* --- nearestOpen()：從原始碼切出來真的跑 ---
         ① 點在格子裡的，一定判給那一格（直式的格子左右只差 2px，放寬之後會重疊）
         ② 最近的那格已經放好了，就不收（不可以跳過它、改放進旁邊的空格）③ 離每一格都遠 → 不收 */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const X = D.COL_X, Y = D.COL_Y, h = D.COL_SLOT / 2, ph = D.COL_PSLOT / 2, ch = D.COL_CSLOT / 2;
          const list = [ { id:'o', cx:X.o, cy:Y.s, hw:h, hh:h, done:false }, { id:'p', cx:X.p, cy:Y.s, hw:ph, hh:h, done:false },
                         { id:'t', cx:X.t, cy:Y.s, hw:h, hh:h, done:false }, { id:'c', cx:X.o, cy:Y.c, hw:ch, hh:ch, done:false } ];
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 1) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 1){ const g = nearestOpen(list, { x, y }, D.COL_PAD); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a column box are given to another box (or none)');
          /* 大小不一樣的兩格（個位的格子 vs 窄的小數點格）：大格裡、靠近小格邊上的點要判給大格 */
          const r0 = nearestOpen(list, { x:X.o + h - 1, y:Y.s }, D.COL_PAD);
          if (!r0 || r0.id !== 'o') fail('nearestOpen(): a point inside the ones box near the point box is given to the point box (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：塗緞帶（範例 2：0.m 是 m 個 0.1，也是 m/10） --- */
      {
        const R = D.PAINT_RIB, BR = D.PAINT_BRUSH, seg = R.w / 10;
        const seenM = new Set(); let anyD = false, anyF = false;
        D.GAME_PAINT.forEach((e, i) => {
          const w = 'GAME_PAINT[' + i + ']';
          if (!isInt(e.m) || e.m < 2 || e.m > 9) return fail(w + ': m ' + e.m + ' should be 2~9 pieces');
          if (e.m === 5) fail(w + ': 0.5 is half the ribbon — painting it can be done by eye, not by counting tenths');
          if (e.f !== 'd' && e.f !== 'f') fail(w + ': f must be "d" (decimal) or "f" (fraction)');
          if (seenM.has(e.m)) fail(w + ': m ' + e.m + ' appears twice'); seenM.add(e.m);
          if (e.f === 'd') anyD = true; else anyF = true;
          /* 照遊戲的規則：「塗好了」只在 paintCount(刷子的位置) ＝ m 時收 —— 收的位置剛好是第 m 段那一整段（一段寬），不會多也不會少 */
          let lo = Infinity, hi = -Infinity;
          for (let x = D.PAINT_RIB.x - D.PAINT_PAD; x <= D.PAINT_RIB.x + D.PAINT_RIB.w + D.PAINT_PAD; x += 0.25) if (D.paintCount(x) === e.m){ lo = Math.min(lo, x); hi = Math.max(hi, x); }
          const segW = D.PAINT_RIB.w / 10;
          if (!(lo > D.PAINT_RIB.x + (e.m - 1) * segW - 0.01 && hi <= D.PAINT_RIB.x + e.m * segW + 0.01 && hi - lo >= segW - 0.5)) fail(w + ': the brush positions that paint ' + e.m + ' pieces are not exactly piece ' + e.m + ' (' + lo + '~' + hi + ')');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gPaintNow ' + L, d.gPaintNow(e.m, e.f), e.f === 'f' ? [e.m, 10] : [myDec(e.m), 1]);
            for (let k = 1; k <= 10; k++){
              if (k === e.m) continue;
              const t = d.gPaintWrong(k, e.m, e.f);
              if (e.f === 'f') seq(w + ' gPaintWrong(' + k + ') ' + L, t, L === 'zh' ? [k, k, 10, myDec(k), e.m, 10, e.m, 10, 10, e.m] : [k, k, 10, myDec(k), e.m, 10, e.m, 10, e.m, 10]);
              else seq(w + ' gPaintWrong(' + k + ') ' + L, t, [k, myDec(k), k, 10, myDec(e.m), myDec(e.m), e.m, '0.1', e.m]);
            }
            seq(w + ' gPaintDone ' + L, d.gPaintDone(e.m), [e.m, e.m, '0.1', myDec(e.m), e.m, 10]);
            seq(w + ' gPaint2 ' + L, d.gPaint2(e.m, e.f), e.f === 'f' ? (L === 'zh' ? [2, e.m, 10, 10, e.m, e.m] : [2, e.m, 10, e.m, 10, e.m]) : [2, myDec(e.m), e.m, '0.1', e.m]);
          });
        });
        if (!anyD || !anyF) fail('GAME_PAINT: both forms (a decimal 0.m and a fraction m/10) must be practised');
        /* paintCount()：第二套實作 —— 數「左邊界在 x 左邊的段數」，整條緞帶（含兩邊放寬）每 0.25px 比一次 */
        let badPc = 0, n = 0;
        for (let x = R.x - D.PAINT_PAD; x <= R.x + R.w + D.PAINT_PAD; x += 0.25){
          let k = 0; for (let s = 0; s < 10; s++) if (R.x + s * seg < x) k++;
          k = Math.max(1, Math.min(10, k)); n++;
          if (D.paintCount(x) !== k) badPc++;
        }
        if (badPc || n < 1000) fail('paintCount(): ' + badPc + ' of ' + n + ' positions paint a different number of pieces than the piece the brush is on');
        for (let m = 1; m <= 10; m++) if (D.paintCount(R.x + (m - 0.5) * seg) !== m) fail('paintCount(): the middle of piece ' + m + ' does not paint ' + m);
        if (Math.abs(R.w / 10 - Math.round(R.w / 10)) > 1e-9) fail('paint: the ribbon width ' + R.w + ' does not split into 10 whole-pixel pieces');
        /* 一段只有 seg px：點錯段不扣分（只是重塗，「塗好了」才算數），所以不要求 44；但要寬到數得出來 */
        if (seg * scale < 24) fail('paint: a ribbon piece is ' + (seg * scale).toFixed(1) + 'px on a phone — too narrow to count or tap');
        inside({ x:R.x, y:R.y, w:R.w, h:R.h }, 'paint: the ribbon', W, D.PAINT_H);
        inside({ x:R.x - 10, y:R.y + R.h + 4, w:20, h:22 }, 'paint: the 0 label', W, D.PAINT_H);
        inside({ x:R.x + R.w - 10, y:R.y + R.h + 4, w:20, h:22 }, 'paint: the 1 label', W, D.PAINT_H);
        const brush = sq(BR.x, BR.y, BR.size);
        inside(brush, 'paint: the brush', W, D.PAINT_H);
        if (Math.abs(BR.y - (R.y + R.h / 2)) <= R.h / 2 + D.PAINT_PAD) fail('paint: the brush at home is already on the ribbon (it would paint before it is moved)');
        if (hit(brush, { x:R.x - 10, y:R.y + R.h + 4, w:R.w + 20, h:22 })) fail('paint: the brush overlaps the 0 / 1 labels');
        need('paint', /var e = pick\(GAME_PAINT\)/, 'the target is not picked from GAME_PAINT');
        need('paint', /if \(!done\)\{ roundInfo\(d\.gPaintFirst\); return; \}\s*if \(done !== e\.m\)\{ roundMiss\(d\.gPaintWrong\(done, e\.m, e\.f\)\); return; \}/, 'a painted length other than m is accepted (or "done" before painting counts as a mistake)');
        need('paint', /if \(gSolved \|\| brush\.busy\(\)\) return;/, '"Done painting" judges while the brush is still being dragged (the ribbon shows a preview, not what is painted)');
        need('paint', /done = paintCount\(pt\.x\);/, 'the painted length is not read from where the brush stops');
        need('paint', /if \(!onRib\(pt\.x, pt\.y\)\) return false;/, 'a drop off the ribbon is not silent');
        need('paint', /onPlace:function\(P\)\{ setPaint\(P\.busy && P\.busy\(\) && onRib\(P\.cx, P\.cy\) \? paintCount\(P\.cx\) : done\); \}/, 'the paint does not follow the brush while dragging (and show what is painted otherwise)');
        LANGS.forEach(L => { seq('gPaintFirst ' + L, I18N[L].gPaintFirst, []); if (!I18N[L].gPaintBtn) fail('gPaintBtn missing in ' + L); });
        need('paint', /ribbonInto\(rib, 10, 0, R\.w, R\.h\);/, 'the ribbon is not 10 equal pieces');
        need('paint', /roundSolved\(d\.gPaintDone\(e\.m\)\);/, 'the result is not read from m');
        if (!/function onRib\(x, y\)\{ return x >= R\.x - PAINT_PAD && x <= R\.x \+ R\.w \+ PAINT_PAD && Math\.abs\(y - \(R\.y \+ R\.h \/ 2\)\) <= R\.h \/ 2 \+ PAINT_PAD; \}/.test(B.paint)) fail('paint: onRib() is not the ribbon box widened by PAINT_PAD');
      }

      /* --- 第 2 關：擺位值（範例 3：w.t 是 w 個 1 和 t 個 0.1） --- */
      {
        const PO = D.PLACE_ONES, PT = D.PLACE_TENTHS, BA = D.PLACE_BAR, PC = D.PLACE_PC, TK = D.PLACE_TOK;
        const seenV = new Set(), seenBad = new Set();
        /* 實物：一小段是一整條的十分之一長 */
        if (PC.w * 10 !== BA.w) fail('place: a small piece is ' + PC.w + ' wide but a whole ribbon is ' + BA.w + ' — a piece must be exactly one tenth of the ribbon');
        if (PC.h !== BA.h) fail('place: a small piece and a whole ribbon must be the same height (it is cut from the same ribbon)');
        D.GAME_PLACE.forEach((e, i) => {
          const w = 'GAME_PLACE[' + i + ']';
          if (!isInt(e.w) || !isInt(e.t)) return fail(w + ' is not whole numbers');
          if (e.w < 1 || e.w > 3) fail(w + ': ' + e.w + ' whole ribbons — should be 1~3 (the ones column holds 3)');
          if (e.t < 1 || e.t > 9) fail(w + ': ' + e.t + ' tenths — should be 1~9');
          if (e.w === e.t) fail(w + ': w ＝ t — putting them the wrong way round would be accepted');
          const v = e.w * 10 + e.t; if (seenV.has(v)) fail(w + ' appears twice'); seenV.add(v);
          /* 照遊戲的規則把每一種放法都走一遍（每一步：一整條或一小段 × 放進個位或十分位） */
          const seen = new Set(), stack = [[0, 0]];
          let ends = 0;
          while (stack.length){
            const [a, b] = stack.pop(), key = a + ',' + b; if (seen.has(key)) continue; seen.add(key);
            if (a === e.w && b === e.t){ ends++; continue; }
            const moves = [];
            /* 每一步的四種動作都問頁面自己的 placeRule()：收了才往下走 */
            [['one', 'ones'], ['one', 'tenths'], ['tenth', 'ones'], ['tenth', 'tenths']].forEach(([kind, col]) => {
              if (D.placeRule(kind, col, a, b, e.w, e.t) !== '') return;
              moves.push(kind === 'one' ? [a + 1, b] : [a, b + 1]);
            });
            if (!moves.length) fail(w + ': stuck at ' + key);
            moves.forEach(m => { if (m[0] > e.w || m[1] > e.t) return fail(w + ': can pass ' + m.join('.')); stack.push(m); });
          }
          if (ends !== 1 || !seen.has(e.w + ',' + e.t)) fail(w + ': the building does not end at exactly ' + e.w + '.' + e.t);
          /* 反過來擺（t 條、w 段）一定在某一步被擋 */
          if (seen.has(e.t + ',' + e.w)) fail(w + ': the reversed number ' + e.t + '.' + e.w + ' can be built');
          /* placeRule() 和自己的規則表在整個定義域上一致（放錯欄、放滿了各有自己的原因） */
          for (let a = 0; a <= 4; a++) for (let b = 0; b <= 10; b++) [['one', 'ones'], ['one', 'tenths'], ['tenth', 'ones'], ['tenth', 'tenths']].forEach(([kind, col]) => {
            const own = kind === 'one' && col === 'tenths' ? 'oneNot' : kind === 'tenth' && col === 'ones' ? 'tenthNot' : kind === 'one' ? (a < e.w ? '' : 'onesFull') : (b < e.t ? '' : 'tenthsFull');
            const got = D.placeRule(kind, col, a, b, e.w, e.t);
            if (got !== own && !seenBad.has(w)){ seenBad.add(w); fail(w + ': placeRule(' + [kind, col, a, b].join(', ') + ') says "' + got + '", should be "' + own + '"'); }
          });
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let a = 0; a <= e.w; a++) for (let b = 0; b <= e.t; b++){
              seq(w + ' gPlaceNow ' + L, d.gPlaceNow(e.w, e.t, a, b), [myDec(v), myDec(a * 10 + b)]);
              seq(w + ' gPlace2 ' + L, d.gPlace2(e.w, e.t, a, b), [2, e.w, e.w - a, e.t, e.t - b]);
            }
            seq(w + ' gPlaceOnesFull ' + L, d.gPlaceOnesFull(e.w, e.t), [myDec(v), e.w, e.w]);
            seq(w + ' gPlaceTenthsFull ' + L, d.gPlaceTenthsFull(e.w, e.t), [myDec(v), e.t, e.t]);
            seq(w + ' gPlaceDone ' + L, d.gPlaceDone(e.w, e.t), L === 'zh' ? [myDec(v), e.w, 1, e.t, '0.1'] : [myDec(v), e.w, e.t, '0.1']);
          });
        });
        LANGS.forEach(L => { seq('gPlaceOneNot ' + L, I18N[L].gPlaceOneNot, [1, '0.1']); seq('gPlaceTenthNot ' + L, I18N[L].gPlaceTenthNot, ['0.1']); });
        /* 版面：三條緞帶、九小段都在自己那一欄裡，不互相碰到、不碰到欄頂的字和欄底的數字 */
        const bars = [], pcs = [];
        for (let i = 0; i < 3; i++){
          const p = D.placeBarXY(i), m = { x:PO.x + PO.w / 2, y:BA.top + i * BA.step + BA.h / 2 };
          if (!near(p.x, m.x) || !near(p.y, m.y)) fail('placeBarXY(' + i + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
          bars.push(sq(m.x, m.y, BA.w, BA.h));
        }
        for (let i = 0; i < 9; i++){
          const p = D.placePieceXY(i), c = i % PC.perRow, inRow = PC.perRow;
          const m = { x:PT.x + PT.w / 2 + (c - (inRow - 1) / 2) * (PC.w + PC.gap), y:PC.top + Math.floor(i / PC.perRow) * PC.step + PC.h / 2 };
          if (!near(p.x, m.x) || !near(p.y, m.y)) fail('placePieceXY(' + i + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
          pcs.push(sq(m.x, m.y, PC.w, PC.h));
        }
        const inner = (Z, r, what) => { if (!(r.x >= Z.x + 6 && r.x + r.w <= Z.x + Z.w - 6 && r.y >= Z.y + 34 && r.y + r.h <= Z.y + Z.h - 50)) fail('place: ' + what + ' runs into its column edge, header or digit'); };
        bars.forEach((r, i) => inner(PO, r, 'whole ribbon ' + (i + 1)));
        pcs.forEach((r, i) => inner(PT, r, 'small piece ' + (i + 1)));
        noHits(bars, 'place: whole ribbons'); noHits(pcs, 'place: small pieces');
        const colO = { x:PO.x, y:PO.y, w:PO.w, h:PO.h }, colT = { x:PT.x, y:PT.y, w:PT.w, h:PT.h };
        inside(colO, 'place: the ones column', W, D.PLACE_H); inside(colT, 'place: the tenths column', W, D.PLACE_H);
        if (hit(grow(colO, 4), grow(colT, 4))) fail('place: the two columns (with their drop pads) overlap');
        if (!(D.PLACE_DOT.x > PO.x + PO.w && D.PLACE_DOT.x < PT.x)) fail('place: the decimal point is not between the ones and the tenths');
        const tOne = sq(TK.one.x, TK.y, TK.one.w, TK.h), tTen = sq(TK.tenth.x, TK.y, TK.tenth.w, TK.h);
        inside(tOne, 'place: the whole-ribbon card', W, D.PLACE_H); inside(tTen, 'place: the small-piece card', W, D.PLACE_H);
        if (hit(tOne, tTen)) fail('place: the two cards overlap');
        if (hit(tOne, grow(colO, 4)) || hit(tOne, grow(colT, 4)) || hit(tTen, grow(colO, 4)) || hit(tTen, grow(colT, 4))) fail('place: a card at home sits on a column (or its drop pad)');
        if (TK.one.w < BA.w + 12) fail('place: the whole-ribbon card is too narrow for the ' + BA.w + 'px ribbon drawn on it');
        need('place', /var c = nearestOpen\(\[ones, tenths\], pt, 4\);\s*if \(!c\) return false;/, 'a drop away from the columns is not silent');
        need('place', /var why = placeRule\(P\.data\.kind, c === ones \? 'ones' : 'tenths', nO, nT, e\.w, e\.t\);\s*if \(why\)\{\s*roundMiss\(why === 'oneNot' \? d\.gPlaceOneNot : why === 'tenthNot' \? d\.gPlaceTenthNot : why === 'onesFull' \? d\.gPlaceOnesFull\(e\.w, e\.t\) : d\.gPlaceTenthsFull\(e\.w, e\.t\)\);\s*return false;/, 'a drop is not judged by placeRule(), or a reason is paired with the wrong rule');
        need('place', /if \(nO === e\.w && nT === e\.t\)\{[\s\S]*?roundSolved\(d\.gPlaceDone\(e\.w, e\.t\)\);/, 'the round is not solved exactly when both columns are full');
        need('place', /var p = placeBarXY\(nO\), z = addZone\(B, p\.x - PLACE_BAR\.w \/ 2, p\.y - PLACE_BAR\.h \/ 2, PLACE_BAR\.w, PLACE_BAR\.h,/, 'the whole ribbons are not drawn at placeBarXY()');
        need('place', /var q = placePieceXY\(nT\);\s*addZone\(B, q\.x - PLACE_PC\.w \/ 2, q\.y - PLACE_PC\.h \/ 2, PLACE_PC\.w, PLACE_PC\.h, 'gpc'\);/, 'the small pieces are not drawn at placePieceXY()');
        need('place', /ribbonInto\(bar, 10, 10, PLACE_BAR\.w, PLACE_BAR\.h\);[\s\S]*?ribbonInto\(pc, 1, 1, PLACE_PC\.w, PLACE_PC\.h\);/, 'the cards do not show a whole ribbon (10 pieces) and one small piece at the same scale as the columns');
      }

      /* --- 第 3 關：青蛙跳數線（範例 4：先數整數、再數幾個 0.1 小格） --- */
      {
        const Ln = D.HOP_LINE, step = (Ln.x1 - Ln.x0) / Ln.max, Z = D.HOP_ZONE, K = D.HOP_TOK;
        if (Ln.max !== 20) fail('hop: the number line should go from 0 to 2 (20 tenths)');
        for (let t = 0; t <= Ln.max; t++) if (!near(D.hopX(t), Ln.x0 + t * step)) fail('hopX(' + t + ') is ' + D.hopX(t) + ', should be ' + (Ln.x0 + t * step));
        if (step < 12) fail('hop: tenths ' + step.toFixed(1) + 'px apart are too close to count');
        const seenT = new Set();
        D.GAME_HOP.forEach((T, i) => {
          const w = 'GAME_HOP[' + i + ']';
          if (!isInt(T) || T <= 10 || T >= 20) return fail(w + ': the flag at ' + T + ' tenths should be strictly between 1 and 2 (it needs one hop of 1 and some hops of 0.1)');
          if (seenT.has(T)) fail(w + ' appears twice'); seenT.add(T);
          /* 照遊戲的規則把每一種跳法都走一遍：跳 1 只在還差 1 以上時收、跳 0.1 只在還差不到 1 時收 */
          const seen = new Set(), stack = [[0, 0, 0]];
          let ends = 0;
          while (stack.length){
            const [pos, nb, ns] = stack.pop(), key = pos + ',' + nb + ',' + ns; if (seen.has(key)) continue; seen.add(key);
            if (pos > T) fail(w + ': the frog can jump past the flag to ' + pos);
            if (pos === T){ ends++; if (nb !== 1 || ns !== T - 10) fail(w + ': lands with ' + nb + ' hops of 1 and ' + ns + ' of 0.1'); continue; }
            const moves = [];
            /* 兩張卡都問頁面自己的 hopRule()，也和自己的規則比 */
            const rb = D.hopRule(true, pos, T), rs = D.hopRule(false, pos, T);
            const ob = T - pos >= 10 ? '' : 'over', os = T - pos >= 10 ? 'bigFirst' : T - pos >= 1 ? '' : 'over';
            if (rb !== ob || rs !== os) fail(w + ': hopRule at ' + pos + ' says ' + rb + '/' + rs + ', should be ' + ob + '/' + os);
            if (rb === '') moves.push([pos + 10, nb + 1, ns]);
            if (rs === '') moves.push([pos + 1, nb, ns + 1]);
            if (!moves.length) fail(w + ': stuck at ' + pos);
            moves.forEach(m => stack.push(m));
          }
          if (ends !== 1) fail(w + ': ' + ends + ' ways to land — the rule should force one big hop first');
          /* hopRule() 在整個定義域（每一個位置 0～2、兩張卡）都和自己的規則一致，不只走得到的那幾格 */
          for (let pos = 0; pos <= 20; pos++){
            const rem = T - pos, ob = rem >= 10 ? '' : 'over', os = rem >= 10 ? 'bigFirst' : rem >= 1 ? '' : 'over';
            if (D.hopRule(true, pos, T) !== ob || D.hopRule(false, pos, T) !== os){ fail(w + ': hopRule(·, ' + pos + ', ' + T + ') disagrees with the rule (' + D.hopRule(true, pos, T) + '/' + D.hopRule(false, pos, T) + ')'); break; }
          }
          LANGS.forEach(L => {
            const d = I18N[L], a = Math.floor(T / 10), b = T % 10;
            seq(w + ' gHopDone ' + L, d.gHopDone(T), [myDec(T), a, 1, b, '0.1', a, 1, b, '0.1'].filter((x, k) => L === 'zh' || k !== 6));
            for (let pos = 0; pos <= T; pos = pos < 10 ? 10 : pos + 1){
              const rem = T - pos;
              seq(w + ' gHop2(' + rem + ') ' + L, d.gHop2(rem, pos >= 10 ? 1 : 0, pos >= 10 ? pos - 10 : 0),
                rem >= 10 ? [2, 1, 1] : rem > 0 ? [2, rem, '0.1', rem] : [2, 1, 1, b, '0.1', 1, b]);
              if (pos >= T) break;
            }
            seq(w + ' gHopNoPoint ' + L, d.gHopNoPoint(String(T)), [T, T, '0.1']);
            seq(w + ' gHopNoWhole ' + L, d.gHopNoWhole(myDec(b)), [myDec(b)]);
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let nb = 0; nb <= 1; nb++) for (let ns = 0; ns <= 9; ns++) seq('gHopNow ' + L, d.gHopNow(nb, ns), [1, nb, '0.1', ns]);
          seq('gHopOver ' + L, d.gHopOver, [1, 1, '0.1']);
          seq('gHopBigFirst ' + L, d.gHopBigFirst, [1, 1]);
          seq('gHopTokBig ' + L, d.gHopTokBig, [1]); seq('gHopTokSmall ' + L, d.gHopTokSmall, ['0.1']);
          seq('gHopWrong ' + L, d.gHopWrong('2.5'), ['2.5', 1, '0.1']);
        });
        /* 版面 */
        if (Ln.x0 - D.HOP_FROG.size / 2 < 0 || D.hopX(20) + D.HOP_FROG.size / 2 > W) fail('hop: the frog at 0 or 2 sticks out of the board');
        if (D.HOP_FROG.y + D.HOP_FROG.size / 2 > Ln.y - D.HOP_ARC.big) fail('hop: the frog sits on the hop arcs');
        if (D.HOP_FLAG.top < 0 || D.HOP_FLAG.top > D.HOP_FROG.y - D.HOP_FROG.size / 2) fail('hop: the flag is shorter than the frog (or above the board)');
        inside({ x:0, y:D.HOP_LBL.y, w:W, h:D.HOP_LBL.h }, 'hop: the labels', W, D.HOP_H);
        if (D.HOP_LBL.y < Ln.y + D.HOP_TICK.big / 2) fail('hop: the 0 / 1 / 2 labels touch the big ticks');
        const bigC = sq(K.big, K.y, K.w, K.h), smallC = sq(K.small, K.y, K.w, K.h), zone = { x:Z.x, y:Z.y, w:Z.w, h:Z.h };
        inside(bigC, 'hop: the hop-1 card', W, D.HOP_H); inside(smallC, 'hop: the hop-0.1 card', W, D.HOP_H); inside(zone, 'hop: the drop zone', W, D.HOP_H);
        if (hit(bigC, smallC)) fail('hop: the two hop cards overlap');
        if (hit(bigC, zone) || hit(smallC, zone)) fail('hop: a hop card at home is inside the drop zone (it would hop before it is moved)');
        if (hit(zone, { x:0, y:D.HOP_LBL.y + D.HOP_LBL.h, w:W, h:0.01 }) && D.HOP_LBL.y + D.HOP_LBL.h > Z.y + Z.h) fail('hop: the labels are below the drop zone');
        if (!(Z.y <= D.HOP_FROG.y - D.HOP_FROG.size / 2 && Z.y + Z.h >= Ln.y + D.HOP_TICK.big / 2)) fail('hop: the drop zone does not cover the frog and the line');
        need('hop', /var T = pick\(GAME_HOP\), pos = 0/, 'the flag is not picked from GAME_HOP, or the frog does not start at 0');
        need('hop', /var why = hopRule\(P\.data\.big, pos, T\);\s*if \(why === 'over'\)\{ roundMiss\(d\.gHopOver\); return false; \}/, 'a hop is not judged by hopRule(), or jumping past the flag is not a mistake');
        need('hop', /if \(P\.data\.big\)\{ arc\(pos, pos \+ 10, true\); pos \+= 10; nb\+\+; \}\s*else \{ arc\(pos, pos \+ 1, false\); pos \+= 1; ns\+\+; \}/, 'a hop does not move the frog by 1 or 0.1');
        need('hop', /if \(why === 'bigFirst'\)\{ roundInfo\(d\.gHopBigFirst\); return false; \}/, 'a hop of 0.1 is accepted while the flag is still 1 or more away (or it is counted as a mistake)');
        need('hop', /if \(pos === T\)\{\s*hBig\.lock\(hBig\.homeX, hBig\.homeY\); hSmall\.lock\(hSmall\.homeX, hSmall\.homeY\);\s*inp\.disabled = false; go\.disabled = false;/, 'the answer box does not open (and the cards do not lock) exactly when the frog is on the flag');
        need('hop', /if \(gSolved \|\| pos !== T\) return;/, 'the answer can be checked before the frog is on the flag');
        need('hop', /var m = \/\^\(0\|\[1-9\]\\d\*\)\(\?:\\\.\(\\d\)\)\?\$\/\.exec\(s\);\s*if \(!m\)\{ gMsg\.textContent = d\.gHopEmpty; return; \}/, 'a malformed answer ("1 3", "01.3", "1.30") is counted as a mistake or read as a number');
        need('hop', /if \(v === T\)\{ inp\.disabled = true; go\.disabled = true; roundSolved\(d\.gHopDone\(T\)\); \}/, 'the typed number is not compared with the flag');
        need('hop', /else if \(m\[2\] === undefined && \+m\[1\] === T\) roundMiss\(d\.gHopNoPoint\(s\)\);\s*(?:\/\*[^*]*\*\/\s*)?else if \(v === T % 10\) roundMiss\(d\.gHopNoWhole\(s\)\);\s*(?:\/\*[^*]*\*\/\s*)?else roundMiss\(d\.gHopWrong\(s\)\);/, 'a wrong number is accepted, or the two common mistakes (no point / no whole part) have no reason of their own');
        need('hop', /addZone\(B, hopX\(T\) - 1\.5, HOP_FLAG\.top,/, 'the flag is not drawn at hopX(T)');
        need('hop', /for \(var t = 0; t <= Ln\.max; t\+\+\)\{/, 'not every tenth has a tick');
        need('hop', /if \(!nearestOpen\(\[zone\], pt, 0\)\) return false;/, 'a drop away from the line is not silent');
        /* 打出來的字：自己的判讀（和頁面的正規式分開寫）——哪些算一個數、讀成幾個 0.1 */
        const canon = s => /^(0|[1-9][0-9]*)(\.[0-9])?$/.test(s);
        [['1.3', true], ['13', true], ['0.3', true], ['1 3', false], ['01.3', false], ['1.30', false], ['.3', false], ['1.', false], ['', false]].forEach(([s, good]) => {
          if (canon(s) !== good) fail('hop: the own answer reader disagrees on "' + s + '"');
          const pageRe = /^(0|[1-9]\d*)(?:\.(\d))?$/;
          if (pageRe.test(s) !== good) fail('hop: the answer pattern reads "' + s + '" as ' + (good ? 'malformed' : 'a number'));
        });
      }

      /* --- 第 4 關：排排站（範例 5：先比整數部分，一樣再比十分位） --- */
      {
        const S = D.SORT_SLOT;
        const cmp = (a, b) => { const wa = (a - a % 10) / 10, wb = (b - b % 10) / 10; return wa !== wb ? wa - wb : a % 10 - b % 10; };   /* 自己的比法：先比整數、再比十分位 */
        D.GAME_SORT.forEach((e, i) => {
          const w = 'GAME_SORT[' + i + ']';
          if (!Array.isArray(e) || e.length !== 4 || !e.every(v => isInt(v) && v >= 1 && v <= 99)) return fail(w + ' should be four tenths counts 0.1~9.9');
          if (new Set(e).size !== 4) fail(w + ': two cards are the same');
          const sorted = e.slice().sort(cmp);
          let trap = false, same = false;
          e.forEach(a => e.forEach(b => { if (a !== b && Math.floor(a / 10) < Math.floor(b / 10) && a % 10 > b % 10) trap = true; if (a < b && Math.floor(a / 10) === Math.floor(b / 10)) same = true; }));
          if (!trap) fail(w + ': no "smaller whole part, bigger tenths digit" pair — the whole-part trap is never practised');
          if (!same) fail(w + ': no two cards share a whole part — comparing the tenths is never practised');
          if (sorted.slice().sort((a, b) => a - b).join() !== sorted.join()) fail(w + ': comparing whole part then tenths disagrees with comparing the values');
          /* 照遊戲的規則：第 s 格只收排第 s 的那一張 —— 每一種放的順序都會排完、而且排出來一定是由小到大 */
          for (let s = 0; s < 4; s++){ const ok = e.filter(v => v === sorted[s]); if (ok.length !== 1) fail(w + ': slot ' + s + ' accepts ' + ok.length + ' cards'); }
          LANGS.forEach(L => {
            const d = I18N[L];
            e.forEach(v => e.forEach(c => {
              if (v === c) return;
              const t = d.gSortWrong(v, c), wv = Math.floor(v / 10), wc = Math.floor(c / 10), less = cmp(v, c) < 0;
              seq(w + ' gSortWrong(' + v + ',' + c + ') ' + L, t, wv !== wc ? [myDec(v), myDec(c), wv, wc, myDec(v), myDec(c)] : [myDec(v), myDec(c), wv, v % 10, c % 10, myDec(v), myDec(c)]);
              const says = L === 'zh' ? (t.indexOf(myDec(c) + ' 小') >= 0 ? -1 : t.indexOf(myDec(c) + ' 大') >= 0 ? 1 : 0) : (t.indexOf(' is smaller than ') >= 0 ? -1 : t.indexOf(' is bigger than ') >= 0 ? 1 : 0);
              if (says !== (less ? -1 : 1)) fail(w + ' gSortWrong(' + v + ',' + c + ') ' + L + ': says the wrong direction — ' + t);
              const goes = L === 'zh' ? (/的前面。$/.test(t) ? -1 : /的後面。$/.test(t) ? 1 : 0) : (t.indexOf(' goes before ') >= 0 ? -1 : t.indexOf(' goes after ') >= 0 ? 1 : 0);
              if (goes !== (less ? -1 : 1)) fail(w + ' gSortWrong(' + v + ',' + c + ') ' + L + ': puts it on the wrong side — ' + t);
              if ((wv !== wc) !== (L === 'zh' ? t.indexOf('先比整數部分') >= 0 : t.indexOf('compare the whole part first') >= 0)) fail(w + ' gSortWrong ' + L + ': the reason does not match which part decides — ' + t);
            }));
            seq(w + ' gSortDone ' + L, d.gSortDone(e.slice().sort((a, b) => a - b)), sorted.map(myDec));
            e.forEach(c => seq(w + ' gSort2 ' + L, d.gSort2(c), [2, myDec(c)]));
          });
        });
        LANGS.forEach(L => { for (let n = 0; n <= 4; n++) seq('gSortNow ' + L, I18N[L].gSortNow(n), [n, 4]); });
        const slots = [0, 1, 2, 3].map(i => { const x = D.sortSlotX(i); if (!near(x, 150 + (i - 1.5) * S.step)) fail('sortSlotX(' + i + ') is ' + x); return sq(x, S.y, S.w, S.h); });
        slots.forEach((r, i) => inside(r, 'sort: slot ' + i, W, D.SORT_H)); noHits(slots.map(r => grow(r, D.SORT_PAD / 2)), 'sort: slots (with half their pad)');
        /* 托盤：renderTray 從 (W − 3 × step) / 2 開始排 —— 卡片要剛好在格子正下方，而且碰不到格子的放寬範圍 */
        const x0 = (W - 3 * S.step) / 2;
        if (!near(x0, D.sortSlotX(0))) fail('sort: the tray does not line up under the slots');
        const cards = [0, 1, 2, 3].map(i => sq(x0 + i * S.step, D.SORT_CARD.y, S.w, S.h));
        cards.forEach((r, i) => inside(r, 'sort: card ' + i, W, D.SORT_H)); noHits(cards, 'sort: cards');
        if (cards.some(c => slots.some(s => hit(c, grow(s, D.SORT_PAD))))) fail('sort: a card at home is inside a slot (or its drop pad)');
        if (D.SORT_LBL.y + D.SORT_LBL.h > S.y - S.h / 2 - D.SORT_PAD) fail('sort: the small / big labels reach the slots');
        need('sort', /var e = pick\(GAME_SORT\), sorted = e\.slice\(\)\.sort\(function\(a, b\)\{ return a - b; \}\)/, 'the slots are not filled in order of size');
        need('sort', /var v = P\.data\.v, c = sorted\[s\.i\];\s*if \(v !== c\)\{ roundMiss\(d\.gSortWrong\(v, c\)\); return false; \}/, 'a card is accepted in a slot that is not its place in the order');
        need('sort', /if \(placed === 4\) roundSolved\(d\.gSortDone\(sorted\)\);/, 'the round is not solved exactly when all four are placed');
        need('sort', /renderTray\(B, e, SORT_CARD\.y,[\s\S]*?\}, S\.step\);/, 'the cards are not laid out with renderTray (shuffled, one step apart)');
        need('sort', /var s = nearestOpen\(slots, pt, SORT_PAD\);\s*if \(!s\) return false;/, 'a drop away from the slots is not silent');
        need('sort', /addZone\(B, sortSlotX\(0\) - S\.w \/ 2, SORT_LBL\.y, S\.w, SORT_LBL\.h, 'glbl', d\.gSortSmall\);\s*addZone\(B, sortSlotX\(3\) - S\.w \/ 2, SORT_LBL\.y, S\.w, SORT_LBL\.h, 'glbl', d\.gSortBig\);/, '"small" is not over the first slot and "big" over the last');
      }

      /* --- 第 5 關：直式（範例 6：小數點對齊；十分位滿 10 個 0.1 進 1；減法不借位） --- */
      {
        const X = D.COL_X, Y = D.COL_Y, h = D.COL_SLOT / 2;
        /* 自己的直式：十分位、（進位）、個位 */
        const myCol = (a, b, op) => {
          const wA = Math.floor(a / 10), tA = a - wA * 10, wB = Math.floor(b / 10), tB = b - wB * 10;
          if (op === '+'){
            const s = tA + tB, c = s > 9 ? 1 : 0;
            return { cells:[['t', s - 10 * c]].concat(c ? [['c', 1]] : []).concat([['o', wA + wB + c]]), res:a + b, c, s, wA, tA, wB, tB };
          }
          return { cells:[['t', tA - tB], ['o', wA - wB]], res:a - b, c:0, s:tA - tB, wA, tA, wB, tB };
        };
        let adds = 0, subs = 0;
        D.GAME_COL.forEach((e, i) => {
          const w = 'GAME_COL[' + i + ']';
          if (!isInt(e.a) || !isInt(e.b) || (e.op !== '+' && e.op !== '-')) return fail(w + ' is malformed');
          const M = myCol(e.a, e.b, e.op), CS = D.colSteps(e.a, e.b, e.op);
          if (e.a < 1 || e.a > 99 || e.b < 1 || e.b > 99) fail(w + ': numbers should be 0.1~9.9');
          if (e.op === '+'){ adds++; if (M.c !== 1) fail(w + ': ' + myDec(e.a) + ' + ' + myDec(e.b) + ' does not carry — the round is about 10 tenths making 1'); if (M.res > 99) fail(w + ': the sum is above 9.9'); }
          else { subs++; if (M.tA < M.tB) fail(w + ': ' + myDec(e.a) + ' − ' + myDec(e.b) + ' needs borrowing — this lesson does not teach it'); if (M.res < 1) fail(w + ': the difference is not positive'); }
          if (CS.res !== M.res || CS.carry !== M.c) fail(w + ': colSteps() gives ' + CS.res + ' / carry ' + CS.carry + ', should be ' + M.res + ' / ' + M.c);
          if (CS.steps.map(s => s.k + s.v).join() !== M.cells.map(c => c[0] + c[1]).join()) fail(w + ': colSteps() is ' + CS.steps.map(s => s.k + s.v).join() + ', should be ' + M.cells.map(c => c[0] + c[1]).join());
          LANGS.forEach(L => {
            const d = I18N[L];
            CS.steps.forEach((N, k) => {
              /* 每一張錯的數字卡會看到哪一句：照頁面的分支，用自己的資料算該出現的數 */
              for (let v = 0; v <= 9; v++){
                /* 頁面自己的 colRule() 判斷這張卡：要和自己的分支一致 */
                const ownWhy = v === M.cells[k][1] ? '' : N.k === 't' ? (M.c ? 'tc' : 't') : N.k === 'c' ? 'c' : (M.c && v === M.wA + M.wB ? 'forgot' : 'o');
                if (L === 'zh' && D.colRule(N, v) !== ownWhy) fail(w + ' colRule(step ' + N.k + ', card ' + v + ') says "' + D.colRule(N, v) + '", should be "' + ownWhy + '"');
                if (v === M.cells[k][1]) continue;
                let t, want;
                if (N.k === 't'){
                  if (M.c){ t = d.gColTc(M.tA, M.tB, M.s, v); want = L === 'zh' ? [M.tA, M.tB, M.s, M.s, '0.1', 1, M.s - 10, '0.1', M.s - 10, 1, v] : [M.tA, M.tB, M.s, M.s, 1, M.s - 10, M.s - 10, 1, v]; }
                  else { t = d.gColT(M.tA, M.tB, M.s, e.op, v); want = [M.tA, M.tB, M.s, M.s, v]; }
                } else if (N.k === 'c'){ t = d.gColC(M.s, v); want = L === 'zh' ? [M.s, '0.1', 10, '0.1', 1, 1, v] : [M.s, 10, 1, 1, v]; }
                else if (M.c && v === M.wA + M.wB){ t = d.gColForgot(M.wA, M.wB, M.cells[k][1]); want = [1, M.wA, M.wB, 1, M.cells[k][1]]; }
                else { t = d.gColO(M.wA, M.wB, M.c, M.cells[k][1], e.op, v); want = [M.wA, M.wB].concat(M.c ? [1] : []).concat([M.cells[k][1], M.cells[k][1], v]); }
                seq(w + ' step ' + N.k + ' card ' + v + ' ' + L, t, want);
              }
              const h2 = d.gCol2(N, e.op);
              seq(w + ' gCol2 ' + N.k + ' ' + L, h2, N.k === 't' ? [2, M.tA, M.tB, M.s].concat(M.c ? [M.s - 10, 1] : [])
                : N.k === 'c' ? (L === 'zh' ? [2, M.s, '0.1', 10, '0.1', 1, 1] : [2, 10, M.s, 1, 1]) : [2, M.wA, M.wB].concat(M.c ? [1] : []).concat([M.cells[k][1]]));
            });
            seq(w + ' gColDone ' + L, d.gColDone(e.a, e.b, e.op, M.res, M.c), [myDec(e.a), myDec(e.b), myDec(M.res)].concat(M.c ? (L === 'zh' ? [10, '0.1', 1] : [10, 1]) : []));
            seq(w + ' gColLine ' + L, d.gColLine(e.a, e.b, e.op, M.res), [myDec(e.a), myDec(e.b), myDec(M.res)]);
            if (d.gColLine(e.a, e.b, e.op, M.res).indexOf(e.op === '+' ? (L === 'zh' ? '＋' : '+') : (L === 'zh' ? '－' : '−')) < 0) fail(w + ' gColLine ' + L + ': the sign is wrong');
            /* gColForgot 一定走得到：忘了進位的那張卡（wA + wB）是 0～9 的一張 */
            if (M.c && !(M.wA + M.wB >= 0 && M.wA + M.wB <= 9)) fail(w + ': "forgot the carry" (' + (M.wA + M.wB) + ') is not a digit card');
          });
        });
        if (adds < 2 || subs < 1) fail('GAME_COL: needs at least two carrying additions and one subtraction (example 6 does both)');
        LANGS.forEach(L => {
          const d = I18N[L];
          seq('gColDotNot ' + L, d.gColDotNot, []); seq('gColDotNeed ' + L, d.gColDotNeed, []);
          ['t', 'c', 'o'].forEach(k => { if (!d.gColKinds || typeof d.gColKinds[k] !== 'string') fail('gColKinds.' + k + ' missing in ' + L); else seq('gColOrder ' + L, d.gColOrder(d.gColKinds[k]), []); });
          seq('gCol2 (point) ' + L, d.gCol2(undefined, '+'), [2]);
        });
        /* 版面：兩排數字的小數點在同一條直線上，答案的小數點格也在那條線上 */
        for (let v = 0; v <= 10; v++){
          const p = D.colKeyXY(v), K = D.COL_KEYS, row = Math.floor(v / K.perRow), cnt = Math.min(K.perRow, 11 - row * K.perRow);
          const m = { x:150 + ((v % K.perRow) - (cnt - 1) / 2) * K.step, y:K.y + row * K.rowStep };
          if (!near(p.x, m.x) || !near(p.y, m.y)) fail('colKeyXY(' + v + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m));
        }
        const keys = []; for (let v = 0; v <= 10; v++){ const p = D.colKeyXY(v); keys.push(sq(p.x, p.y, D.COL_KEYS.size)); }
        keys.forEach((r, v) => inside(r, 'col: card ' + v, W, D.COL_H)); noHits(keys, 'col: cards');
        const boxes = [sq(X.o, Y.s, D.COL_SLOT), sq(X.p, Y.s, D.COL_PSLOT, D.COL_SLOT), sq(X.t, Y.s, D.COL_SLOT), sq(X.o, Y.c, D.COL_CSLOT)];
        boxes.forEach((r, i) => inside(r, 'col: box ' + i, W, D.COL_H)); noHits(boxes, 'col: boxes');
        const rows = [Y.a, Y.b].map(y => [sq(X.o, y, D.COL_SLOT), sq(X.p, y, 20, D.COL_SLOT), sq(X.t, y, D.COL_SLOT)]);
        rows.forEach((r, i) => noHits(r.concat(boxes), 'col: row ' + i + ' and the boxes'));
        if (keys.some(k => boxes.some(b => hit(k, grow(b, D.COL_PAD))))) fail('col: a card at home is inside a box (or its drop pad)');
        if (!(X.o < X.p && X.p < X.t)) fail('col: the point column is not between the ones and the tenths');
        if (X.op + 14 > X.o - h) fail('col: the sign touches the ones digit');
        if (Y.rule < Y.b + h || Y.rule > Y.s - h) fail('col: the line is not between the second number and the answer');
        need('col', /var e = pick\(GAME_COL\), CS = colSteps\(e\.a, e\.b, e\.op\), steps = CS\.steps, next = 0, dotDone = false/, 'the steps are not colSteps() of the picked sum');
        need('col', /addZone\(B, X\.o - h, r\[1\] - h, COL_SLOT, COL_SLOT, 'gcell', String\(Math\.floor\(r\[0\] \/ 10\)\)\);\s*addZone\(B, X\.p - 10, r\[1\] - h, 20, COL_SLOT, 'gcell', '\.'\);\s*addZone\(B, X\.t - h, r\[1\] - h, COL_SLOT, COL_SLOT, 'gcell', String\(r\[0\] % 10\)\);/, 'the two numbers are not written ones | point | tenths in the same three columns');
        need('col', /var pslot = \{ i:-1, dot:true, el:addZone\(B, X\.p - COL_PSLOT \/ 2, Y\.s - h, COL_PSLOT, COL_SLOT, 'gslot'\), cx:X\.p, cy:Y\.s,/, 'the answer point box is not under the two points');
        need('col', /if \(s\.dot\)\{\s*if \(!P\.data\.dot\)\{ roundMiss\(d\.gColDotNeed\); return false; \}/, 'a digit is accepted in the point box');
        need('col', /if \(P\.data\.dot\)\{ roundMiss\(d\.gColDotNot\); return false; \}/, 'the point is accepted in a digit box');
        need('col', /if \(s\.i !== next\)\{ roundMiss\(d\.gColOrder\(d\.gColKinds\[N\.k\]\)\); return false; \}/, 'a box can be filled out of order');
        need('col', /var why = colRule\(N, val\);\s*if \(why\)\{\s*roundMiss\(why === 'tc' \? d\.gColTc\(N\.x, N\.y, N\.s, val\) : why === 't' \? d\.gColT\(N\.x, N\.y, N\.v, e\.op, val\) : why === 'c' \? d\.gColC\(N\.s, val\)\s*: why === 'forgot' \? d\.gColForgot\(N\.x, N\.y, N\.v\) : d\.gColO\(N\.x, N\.y, N\.c, N\.v, e\.op, val\)\);\s*return false;/, 'a wrong digit is not judged by colRule(), or a reason is paired with the wrong rule');
        need('col', /if \(next === steps\.length && dotDone\)\{/, 'the round is solved before every digit and the point are down');
        need('col', /P\.home\(\); P\.el\.classList\.remove\('sel'\); if \(B\.selected === P\) B\.selected = null;/, 'the digit cards must never run out (a used card goes back)');
        need('col', /var s = nearestOpen\(slots\.concat\(\[pslot\]\), pt, COL_PAD\);\s*if \(!s\) return false;/, 'a drop away from the boxes is not silent');
      }

      if (DEC_SEEN.length !== 271) fail('the arithmetic checker read ' + DEC_SEEN.length + ' equations in total, expected exactly 271 — it may have stopped reading them (or a message changed: update the pin)');
    }
  }
};
