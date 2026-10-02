/* grade-3/math/equation 的檢查設定（找出神祕數字：等號兩邊一樣多、四種逆運算、（　）的位置、驗算、列式）。
   2026-10-01 新增 —— 和小遊戲「神祕數字偵探」改成五關五種玩法（§六之五）同一次寫成；在那之前這一課沒有設定檔。

   sim（review.html 的十一個產生器）：每個產生器一組不變條件；正解的第二套實作是**暴力解**：
   從渲染出來的題幹讀出算式，0～999 每一個整數代進去試，剛好一個成立才算數（不呼叫頁面的任何算法）。
   renderCheck 另外驗：每一個誘答代回去都不成立、解釋裡每一條算式都算得對、解釋引用的算法真的解得開題幹。
   跑起來抓到舊缺陷：八個產生器的誘答把題幹的數字抄回來（b、c 直接當誘答）—— makeWrongs 加上 avoid；
   唯一刻意的迷思誘答是 sibDivide 的 M（把「每份幾個」當成「幾份」，divide 那一課的核心迷思），只放行那一個值。

   data（index.html）：
   - I18N 靜態字串（含三層題庫的題幹與解釋）裡的算式逐條重算；題幹是「含（　）的算式」的題目，
     標的正解要代回去成立、而且是暴力解的唯一解。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲的規則把每一題從頭玩一遍（天平一顆一顆放、配對把 16 種配法都試、分類把 12 種放法都試、
     驗算兩位同學都驗、列式把 2 × 3 × 4 種排法都試），證明一定解得完、而且被收下的就是對的、被擋下的就是錯的；
     「對不對」用自己的暴力解和自己的故事模型判，不用頁面的函式。
     nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；切不出來的 RENDER 規則用原始碼形狀守住（need()）。
     每一句說明逐個比數字。版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、重疊區的最近格、畫板不跳動、375px 的實際尺寸由 HDIR 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function ap(a, op, b){ return op === '+' ? a + b : op === '-' ? a - b : op === '×' ? a * b : op === '÷' ? a / b : NaN; }
/* 把一段文字正規化：（　）→ X，全形符號 → 半形 */
function norm(t){
  return String(t).replace(/<[^>]+>/g, ' ').replace(/[（(]\s*[　 ]*\s*[）)]/g, 'X').replace(/＋/g, '+').replace(/[－−–]/g, '-').replace(/＝/g, '=').replace(/\s+/g, ' ').trim();
}
/* 暴力解：0～999 代進去，剛好一個成立 */
function brute(pos, op, x, y){
  const hits = [];
  for (let v = 0; v <= 999; v++){ const L = pos === 'first' ? ap(v, op, x) : ap(x, op, v); if (L === y) hits.push(v); }
  return hits.length === 1 ? hits[0] : NaN;
}
/* 從文字裡找出所有含（　）的算式：X op a = b 或 a op X = b */
function boxEqs(text){
  const t = norm(text), out = [];
  const re = /(?:X ?([+\-×÷]) ?(\d+)|(\d+) ?([+\-×÷]) ?X) ?= ?(\d+)/g;
  let m;
  while ((m = re.exec(t))){
    if (m[1]) out.push({ pos:'first', op:m[1], x:+m[2], y:+m[5], text:m[0] });
    else out.push({ pos:'second', op:m[4], x:+m[3], y:+m[5], text:m[0] });
  }
  return out;
}
/* 算式掃描：不含（　）的「a op b … ＝ c」逐條重算（× ÷ 先算，再由左到右 ＋ −） */
function scanEquations(text){
  const t = norm(text);
  const re = /(?<![\d.\/X])(?<![×+\-÷] ?)(\d+(?: ?[×+\-÷] ?\d+)+) ?= ?(\d+)(?![\d.\/])/g;
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const toks = m[1].split(/ ?([×+\-÷]) ?/), got = +m[2];
    const terms = [];
    let cur = +toks[0], sign = 1, bad = null;
    for (let i = 1; i < toks.length; i += 2){
      const op = toks[i], v = +toks[i + 1];
      if (op === '×') cur *= v;
      else if (op === '÷'){ if (cur % v) bad = 'does not divide evenly'; cur /= v; }
      else { terms.push(sign * cur); sign = op === '+' ? 1 : -1; cur = v; }
    }
    terms.push(sign * cur);
    const want = terms.reduce((x, y) => x + y, 0);
    if (!bad && want !== got) bad = 'should be ' + want;
    out.push({ text:m[0], bad });
    re.lastIndex = m.index + 1;
  }
  return out;
}
const INV = { '+':'-', '-':'+', '×':'÷', '÷':'×' };
/* 自己的「怎麼找（　）」：加法、乘法永遠是逆運算；減法、除法的（　）在前面也是逆運算，在後面是同一個運算 */
function myFinder(pos, op, x, y){ return (op === '+' || op === '×' || pos === 'first') ? [y, INV[op], x] : [x, op, y]; }

/* review.html：從渲染出來的題幹讀算式（文字題用自己的故事模型列式） */
function stemEquation(genId, d, q){
  const eqs = boxEqs(q.stem);
  if (eqs.length === 1) return eqs[0];
  if (genId === 'wordAdd') return { pos:'first', op:'+', x:nums(q.stem)[0], y:nums(q.stem)[1] };
  if (genId === 'wordSub') return { pos:'first', op:'-', x:nums(q.stem)[0], y:nums(q.stem)[1] };
  return null;
}

module.exports = {
  breaks: [
    /* ---- review.html ---- */
    { file:'review', expect:'is copied straight out of the stem', find:"var m = mixOpts(ans, [wrongSameOp], [b, c]);\n        return { b:b, ans:ans, c:c, opts:m.opts, ansIdx:m.ans };\n      },\n      fmt: function(d, lang){\n        return {\n          stem: lang === 'zh' ? '（　）＋ '", replace:"var m = mixOpts(ans, [wrongSameOp, b, c]);\n        return { b:b, ans:ans, c:c, opts:m.opts, ansIdx:m.ans };\n      },\n      fmt: function(d, lang){\n        return {\n          stem: lang === 'zh' ? '（　）＋ '" },
    { file:'review', expect:'is copied straight out of the stem', find:"var m = mixOpts(k, [k - 1, k + 1, M], avoidExcept([N, M], [M]));", replace:"var m = mixOpts(k, [k - 1, k + 1, M, N], avoidExcept([N, M], [M, N]));" },
    { file:'review', expect:'opts[ans] != correct', find:"        var ans = a - c;\n        var wrongInverse = a + c;", replace:"        var ans = a + c;\n        var wrongInverse = a - c;" },
    { file:'review', expect:'the explanation', find:"? '逆運算：' + d.c + ' ÷ ' + d.b + ' ＝ ' + d.ans + '。代回去：' + d.ans + ' × ' + d.b", replace:"? '逆運算：' + d.c + ' ÷ ' + d.b + ' ＝ ' + (d.ans + 1) + '。代回去：' + d.ans + ' × ' + d.b" },
    { file:'review', expect:'not a whole number from 1', find:"      if (c > 0 && c <= MAX_OPT && !seen[key]){", replace:"      if (c >= 0 && c <= MAX_OPT && !seen[key]){" },
    { file:'review', expect:'does not divide evenly', find:"        var c = randRange(2, 12);\n        var ans = c * b;", replace:"        var c = randRange(2, 12);\n        var ans = c * b + 1;" },

    { file:'review', expect:'read from the stem', find:"          stem: d.a + ' + ' + d.b + ' = ?',", replace:"          stem: d.a + ' - ' + d.b + ' = ?'," },
    { file:'review', expect:'is not "has a, spends b, gets c"', find:"            ? '小華有 ' + d.a + ' 元，買了 '", replace:"            ? '昨天小華有 ' + d.a + ' 元，買了 '" },
    { file:'review', expect:'is not "has a, spends b, gets c"', find:"元的東西後，又得到 ' + d.c + ' 元，現在有多少元？'", replace:"元的東西後，又花了 ' + d.c + ' 元，現在有多少元？'" },
    { file:'review', expect:'read from the stem', find:"stem: lang === 'zh' ? d.N + ' 顆糖，每 ' + d.M + ' 顆一份，可以分成幾份？' : d.N + ' candies, ' + d.M + ' per group — how many groups?',", replace:"stem: lang === 'zh' ? (d.N + 1) + ' 顆糖，每 ' + d.M + ' 顆一份，可以分成幾份？' : d.N + ' candies, ' + d.M + ' per group — how many groups?'," },

    /* ---- index.html：小遊戲 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['bal', 'inv', 'sort', 'check', 'build'];", replace:"var GAME_ORDER = ['bal', 'sort', 'inv', 'check', 'build'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(): a point inside the big box', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestOpen(): a drop in the overlap', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (best === null){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot', find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'without shuffle(...)', find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });", replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },

    /* 天平 */
    { file:'index', expect:'box holds 9', find:'var GAME_BAL = [ { k:5, N:12 },', replace:'var GAME_BAL = [ { k:5, N:15 },' },
    { file:'index', expect:'nothing to put in the box', find:'{ k:7, N:13 }, { k:8, N:13 } ];', replace:'{ k:7, N:13 }, { k:8, N:8 } ];' },
    { file:'index', expect:'balBoxXY(', find:'y:BAL_BOX.h / 2 + (Math.floor(i / 3) - 1) * BAL_BOX.step }; }', replace:'y:BAL_BOX.h / 2 + Math.floor(i / 3) * BAL_BOX.step }; }' },
    { file:'index', expect:'the box and the marbles outside it overlap', find:'BAL_KNOWN = { x:[100, 122], y0:86, step:22 }', replace:'BAL_KNOWN = { x:[80, 102], y0:86, step:22 }' },
    { file:'index', expect:'right-tray marble', find:'var BAL_RIGHT = { cx:228, y0:84, step:24, perRow:5 }', replace:'var BAL_RIGHT = { cx:228, y0:84, step:14, perRow:5 }' },
    { file:'index', expect:'the marble you drag overlaps', find:'BAL_TOKEN = { y:252, size:54 }', replace:'BAL_TOKEN = { y:230, size:54 }' },
    { file:'index', expect:'one too many is accepted', find:'        if (n + e.k >= e.N){ roundMiss(d.gBalOver(n, e.k, e.N)); return false; }', replace:'        if (n + e.k > e.N){ roundMiss(d.gBalOver(n, e.k, e.N)); return false; }' },
    { file:'index', expect:'"balanced" is accepted', find:'        if (n + e.k < e.N){ roundMiss(d.gBalShort(n, e.k, e.N)); return; }', replace:'        if (n + e.k < e.N - 1){ roundMiss(d.gBalShort(n, e.k, e.N)); return; }' },
    { file:'index', expect:'gBalDone zh', find:"return '(　) ＋ ' + k + ' ＝ ' + N + '：盒子裡要放 ' + n + ' 顆，'", replace:"return '(　) ＋ ' + k + ' ＝ ' + N + '：盒子裡要放 ' + (n + 1) + ' 顆，'" },
    { file:'index', expect:'gBal2 en', find:"' fewer than the ' + N + ' on the right.'; },", replace:"' fewer than the ' + (N + 1) + ' on the right.'; }," },

    /* 配對 */
    { file:'index', expect:'does not divide', find:'var GAME_INV = [ { b:2, c:10 },', replace:'var GAME_INV = [ { b:3, c:10 },' },
    { file:'index', expect:'two equations share an answer', find:'{ b:2, c:14 }, { b:4, c:20 } ];', replace:'{ b:2, c:4 }, { b:4, c:20 } ];' },
    { file:'index', expect:'does not fit the answer label', find:'{ b:4, c:12 }, { b:2, c:14 },', replace:'{ b:4, c:28 }, { b:2, c:14 },' },
    { file:'index', expect:'rows 0 and 1 overlap', find:'INV_ROW = { y0:34, step:60, h:52 }', replace:'INV_ROW = { y0:34, step:48, h:52 }' },
    { file:'index', expect:'the card tray reaches the rows', find:'var INV_CARD = { y:296, w:70, h:52, step:74 }', replace:'var INV_CARD = { y:256, w:70, h:52, step:74 }' },
    { file:'index', expect:'inv: cards 0 and 1 overlap', find:'var INV_CARD = { y:296, w:70, h:52, step:74 }', replace:'var INV_CARD = { y:296, w:70, h:52, step:64 }' },
    { file:'index', expect:'a card that does not solve', find:'        if (P.data.op !== INVERSE[s.op]){', replace:'        if (P.data.op === s.op){' },
    { file:'index', expect:'INVERSE', find:"var INVERSE = { '+':'-', '-':'+', '×':'÷', '÷':'×' };", replace:"var INVERSE = { '+':'-', '-':'-', '×':'÷', '÷':'×' };" },
    { file:'index', expect:'gInvDone zh', find:"'，(　) 有四個不同的答案：' + (c - b) + '、' + (c + b)", replace:"'，(　) 有四個不同的答案：' + (c - b) + '、' + (c + b + 1)" },
    { file:'index', expect:'gInvWrong en', find:"'-':'minus ' + b + ' leaves ' + c + ', so to find (\\u00a0\\u00a0) add the ' + b + ' back',", replace:"'-':'minus ' + b + ' leaves ' + c + ', so to find (\\u00a0\\u00a0) add the ' + c + ' back'," },

    /* 分類 */
    { file:'index', expect:'are the same number', find:'var GAME_SORT = [ { f:\'-\', b:3, c:5 },', replace:'var GAME_SORT = [ { f:\'-\', b:4, c:4 },' },
    { file:'index', expect:'sortCards(', find:"               { op:'+', p:'first', x:e.b, y:a, bin:1, ans:e.c }, { op:'+', p:'second', x:e.c, y:a, bin:1, ans:e.b } ];", replace:"               { op:'+', p:'first', x:e.b, y:a, bin:0, ans:e.c }, { op:'+', p:'second', x:e.c, y:a, bin:1, ans:e.b } ];" },
    { file:'index', expect:'sortCards(', find:"    return [ { op:'÷', p:'first', x:e.b, y:e.c, bin:0, ans:m },", replace:"    return [ { op:'÷', p:'first', x:e.b, y:e.c, bin:0, ans:m + 1 }," },
    { file:'index', expect:'baskets overlap', find:'SORT_BIN = { y:22, h:236, w:142, x:[74, 226] }', replace:'SORT_BIN = { y:22, h:236, w:160, x:[74, 226] }' },
    { file:'index', expect:'sorted card 3 sticks out of the basket', find:'SORT_IN = { y0:80, step:50 }', replace:'SORT_IN = { y0:80, step:60 }' },
    { file:'index', expect:'sort: tray card', find:'var SORT_CARD = { w:136, h:48, x:[76, 224], y0:290, step:52 }', replace:'var SORT_CARD = { w:136, h:48, x:[76, 224], y0:290, step:44 }' },
    { file:'index', expect:'the wrong basket is accepted', find:"        if (b.k !== c.bin){ roundMiss(d.gSortWrong(c)); return false; }", replace:"        if (b.k !== c.bin && c.op !== '-' && c.op !== '÷'){ roundMiss(d.gSortWrong(c)); return false; }" },
    { file:'index', expect:'undo(', find:"    if (op === '+' || op === '×' || pos === 'first') return { a:y, op:INVERSE[op], b:x };", replace:"    if (op === '+' || op === '×') return { a:y, op:INVERSE[op], b:x };" },
    { file:'index', expect:'gSortWrong zh', find:"return eq + '：(　) 是被拿走的那一份，' + c.x + ' 拿走它剩 ' + c.y", replace:"return eq + '：(　) 是被拿走的那一份，' + c.y + ' 拿走它剩 ' + c.x" },
    { file:'index', expect:'gSortDone en', find:"'All sorted! The ' + n0 + ' with (\\u00a0\\u00a0) in front of − are added back; the other ' + n1", replace:"'All sorted! The ' + n1 + ' with (\\u00a0\\u00a0) in front of − are added back; the other ' + n0" },

    /* 驗算 */
    { file:'index', expect:'is not the same-operation mistake', find:"  function sameOpClaim(e){ return applyOpG(e.result, e.op, e.known); }", replace:"  function sameOpClaim(e){ return applyOpG(e.result, e.op, e.known) + 1; }" },
    { file:'index', expect:'does not fit the 3-digit answer box', find:"{ pos:'first', op:'×', known:3, result:12 },", replace:"{ pos:'first', op:'×', known:9, result:126 }," },
    { file:'index', expect:'the wrong answer also works', find:"{ pos:'first', op:'÷', known:2, result:8 },", replace:"{ pos:'first', op:'÷', known:1, result:8 }," },
    { file:'index', expect:'is not a whole number', find:"{ pos:'second', op:'+', known:5, result:13 } ];", replace:"{ pos:'second', op:'-', known:5, result:3 } ];" },
    { file:'index', expect:'the cards overlap the names', find:'CHK_NAME = { y:186, h:26 }', replace:'CHK_NAME = { y:216, h:26 }' },
    { file:'index', expect:'the equation row overlaps', find:'CHK_ROW = { y:104, cell:52, op:28, x:[40, 94, 148, 196, 250] }', replace:'CHK_ROW = { y:104, cell:52, op:28, x:[40, 74, 148, 196, 250] }' },
    { file:'index', expect:'a wrong left side is accepted', find:'        if (v !== want){ roundMiss(d.gChkCalc(e.pos, e.op, e.known, cur.data.v, v)); return; }', replace:'        if (v !== want && v !== want + 1){ roundMiss(d.gChkCalc(e.pos, e.op, e.known, cur.data.v, v)); return; }' },
    { file:'index', expect:'the wrong comparison is accepted', find:'        if (isSame !== (val === e.result)){', replace:'        if (false){' },
    { file:'index', expect:'is counted as a mistake or read as a number', find:"        if (!/^(0|[1-9]\\d*)$/.test(t)){ gMsg.textContent = d.gChkEmpty; return; }", replace:"        if (!/^\\d+$/.test(t)){ gMsg.textContent = d.gChkEmpty; return; }" },
    { file:'index', expect:'leftWith(', find:"  function leftWith(e, v){ return e.pos === 'first' ? applyOpG(v, e.op, e.known) : applyOpG(e.known, e.op, v); }", replace:"  function leftWith(e, v){ return e.pos === 'first' ? applyOpG(e.known, e.op, v) : applyOpG(e.known, e.op, v); }" },
    { file:'index', expect:'gChkDone zh', find:"' —— ' + wrong + ' 是做了同一個運算（' + result + ' ' + opText(op) + ' ' + known + '）", replace:"' —— ' + wrong + ' 是做了同一個運算（' + known + ' ' + opText(op) + ' ' + result + '）" },
    { file:'index', expect:'gChkCalc en', find:"return L0 + ' is not ' + typed + ' — work it out again.';", replace:"return L0 + ' is not ' + (typed + 1) + ' — work it out again.';" },

    /* 列式 */
    { file:'index', expect:'the story says', find:"{ t:'subSecond', op:'-', pos:'second', known:20, result:8 }", replace:"{ t:'subSecond', op:'-', pos:'first', known:20, result:8 }" },
    { file:'index', expect:'is not a whole number', find:"{ t:'divSecond', op:'÷', pos:'second', known:24, result:6 }", replace:"{ t:'divSecond', op:'÷', pos:'second', known:24, result:5 }" },
    { file:'index', expect:'the story says', find:"{ t:'mulSecond', op:'×', pos:null, known:4, result:28 }", replace:"{ t:'mulSecond', op:'×', pos:'second', known:4, result:28 }" },
    { file:'index', expect:'build: accepts', find:"        if (c.kind === 'num' && need >= 0 && ((c.k === 'box') !== (s.i === need))){", replace:"        if (false){" },
    { file:'index', expect:'build: accepts', find:"        if (c.kind === 'op' && c.op !== e.op){ roundMiss(d.gBldOp(e, c.op)); return false; }", replace:"        if (c.kind === 'op' && c.op !== e.op && c.op !== INVERSE[e.op]){ roundMiss(d.gBldOp(e, c.op)); return false; }" },
    { file:'index', expect:'a sign is accepted in a number box', find:"        if (s.kind === 'num' && c.kind === 'op'){ roundMiss(d.gBldNotNum(d.op(c.op))); return false; }\n", replace:"" },
    { file:'index', expect:'the sign box and', find:'BLD_SLOT = { x:[50, 114, 178], w:[66, 52, 66] }', replace:'BLD_SLOT = { x:[50, 104, 178], w:[66, 52, 66] }' },
    { file:'index', expect:'is called sharing', find:"                 divSecond:'每幾個分成一份 → 用 ' + o + '；'", replace:"                 divSecond:'平分 → 用 ' + o + '；'" },
    { file:'index', expect:'is called sharing', find:"(e.t === 'divSecond' ? 'Making groups of ' + e.result + ' — use ÷, not ' : 'Shared out equally — use ÷, not ')", replace:"('Shared out equally — use ÷, not ')" },
    { file:'index', expect:'gStory en', find:"subSecond:'Ben has ' + k + ' marbles. After giving some to his brother, he has ' + r + ' left.", replace:"subSecond:'Ben has ' + r + ' marbles. After giving some to his brother, he has ' + k + ' left." },
    { file:'index', expect:'gBldDone zh', find:"return '列式：' + I18N.zh.gEq(pos, e.op, e.known, e.result) + '，(　) ＝ ' + u.a", replace:"return '列式：' + I18N.zh.gEq(pos, e.op, e.known, e.result) + '，(　) ＝ ' + u.b" }
  ],

  sim: {
    INVARIANTS: {
      addFirst: d => { if (d.ans + d.b !== d.c) return 'ans + b != c'; if (!(d.ans >= 3 && d.b >= 3)) return 'too small'; },
      subFirst: d => { if (d.ans - d.b !== d.c) return 'ans - b != c'; if (!(d.c >= 1)) return 'c must be at least 1'; },
      subSecond: d => { if (d.a - d.ans !== d.c) return 'a - ans != c'; if (!(d.ans >= 1 && d.c >= 1)) return 'a part is 0'; },
      mulFirst: d => { if (d.ans * d.b !== d.c) return 'ans * b != c'; if (!(d.b >= 2 && d.b <= 9)) return 'b outside the 9×9 table'; },
      divFirst: d => { if (d.c * d.b !== d.ans) return 'ans != c * b (does not divide evenly)'; if (!(d.b >= 2 && d.b <= 9)) return 'b outside the 9×9 table'; },
      divSecond: d => { if (d.ans * d.c !== d.a) return 'ans * c != a (does not divide evenly)'; if (!(d.ans >= 2 && d.ans <= 9 && d.c >= 2 && d.c <= 9)) return 'outside the 9×9 table'; },
      wordAdd: d => { if (d.ans + d.b !== d.c) return 'ans + b != c'; },
      wordSub: d => { if (d.ans - d.b !== d.c) return 'ans - b != c'; if (!(d.c >= 1)) return 'nothing left'; },
      sibDivide: d => { if (d.M * d.k !== d.N) return 'M*k != N'; if (!(d.k >= 2 && d.M >= 2)) return 'too small'; },
      sibTwoStep: d => { if (d.a - d.b + d.c !== d.ans) return 'a-b+c != ans'; if (d.b > d.a) return 'spends more than he has'; },
      sibAddSub: d => { if (d.a + d.b !== d.ans) return 'a+b != ans'; }
    },
    /* 正解的第二套實作：只用原始參數，暴力解 */
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'addFirst': case 'wordAdd': return String(brute('first', '+', d.b, d.c));
        case 'subFirst': case 'wordSub': return String(brute('first', '-', d.b, d.c));
        case 'subSecond': return String(brute('second', '-', d.a, d.c));
        case 'mulFirst': return String(brute('first', '×', d.b, d.c));
        case 'divFirst': return String(brute('first', '÷', d.b, d.c));
        case 'divSecond': return String(brute('second', '÷', d.a, d.c));
        case 'sibDivide': return String(brute('first', '×', d.M, d.N));
        case 'sibTwoStep': return String(d.a - d.b + d.c);
        case 'sibAddSub': return String(d.a + d.b);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s){
      if (!/^[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a whole number from 1';
      if (+s > 999) return 'option ' + s + ' outside 1~999';
    },
    stemEchoOk: { sibDivide: (d, opt) => String(opt) === String(d.M) },
    /* 渲染出來的那一題：題幹的算式自己解、每個誘答代回去都不成立、解釋的算式都算得對、解釋用的算法真的解得開 */
    renderCheck: function(d, q, lang, genId){
      const why = String(q.why);
      for (const e of scanEquations(why)) if (e.bad) return 'the explanation "' + e.text + '" ' + e.bad;
      /* 交錯的三種相關題：一樣從渲染出來的題幹讀，用自己的模型算正解 */
      if (/^sib/.test(genId)){
        const st = norm(q.stem), n = nums(q.stem);
        let want = NaN;
        if (genId === 'sibDivide'){
          if (!(lang === 'zh' ? /^\d+ 顆糖，每 \d+ 顆一份，可以分成幾份？$/ : /^\d+ candies, \d+ per group — how many groups\?$/).test(st)) return 'the sibDivide stem is not "N, M per group, how many groups": ' + q.stem;
          want = n[0] / n[1];
        } else if (genId === 'sibTwoStep'){
          if (!(lang === 'zh' ? /^小華有 \d+ 元，買了 \d+ 元的東西後，又得到 \d+ 元，現在有多少元？$/ : /^Jay has \$\d+\. He spends \$\d+, then gets \$\d+ more\. How much does he have now\?$/).test(st)) return 'the sibTwoStep stem is not "has a, spends b, gets c": ' + q.stem;
          want = n[0] - n[1] + n[2];
        } else {
          const m = st.match(/^(\d+) ([+\-]) (\d+) = \?$/);
          if (!m) return 'the sibAddSub stem is not "a + b = ?": ' + q.stem;
          want = ap(+m[1], m[2], +m[3]);
        }
        if (!isInt(want) || +q.opts[q.ans] !== want) return 'the marked answer ' + q.opts[q.ans] + ' is not ' + want + ' read from the stem: ' + q.stem;
        return;
      }
      const e = stemEquation(genId, d, q);
      if (!e) return 'cannot read the equation from the stem: ' + q.stem;
      const ans = brute(e.pos, e.op, e.x, e.y);
      if (!isInt(ans)) return 'the stem ' + e.text + ' has no single whole-number answer';
      if (+q.opts[q.ans] !== ans) return 'the marked answer ' + q.opts[q.ans] + ' does not solve ' + norm(q.stem);
      for (let i = 0; i < q.opts.length; i++){ if (i === q.ans) continue; const v = +q.opts[i]; const L = e.pos === 'first' ? ap(v, e.op, e.x) : ap(e.x, e.op, v); if (L === e.y) return 'distractor ' + v + ' also solves it'; }
      const f = myFinder(e.pos, e.op, e.x, e.y);
      const t = norm(why);
      const want = f[0] + ' ' + f[1] + ' ' + f[2] + ' = ' + ans;
      if (t.indexOf(want) < 0) return 'the explanation does not show the way to find (　) "' + want + '": ' + why;
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「神祕數字偵探」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GPICK, INVERSE, opText, opTextEn, BALL, BAL_H, BAL_BEAM, BAL_TRAY, BAL_SIGN, BAL_BOX, BAL_KNOWN, BAL_LBL, BAL_RIGHT, BAL_TOKEN, GAME_BAL, balBoxXY, balKnownXY, balRightXY, INV_H, INV_ROW, INV_EQ, INV_SLOT, INV_RES, INV_CARD, INV_PAD, GAME_INV, INV_OPS, SORT_H, SORT_BIN, SORT_LBL, SORT_IN, SORT_CARD, SORT_PAD, GAME_SORT, sortCards, CHK_H, CHK_EQ, CHK_ROW, CHK_RIGHT, CHK_NAME, CHK_CARD, GAME_CHECK, applyOpG, solveG, undo, leftWith, sameOpClaim, BLD_H, BLD_ROW, BLD_SLOT, BLD_EQ, BLD_RES, BLD_NUM, BLD_OP, BLD_PAD, GAME_BUILD}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 掃描器自己先證明會響 --- */
      [['15 － 8 ＝ 7', true], ['15 － 8 ＝ 6', false], ['6 × 3 ＝ 18', true], ['20 ÷ 5 ＝ 4', true], ['20 ÷ 5 = 5', false], ['20 + 20 − 8 = 32', true], ['20 + 20 − 8 = 31', false], ['14 ÷ 4 = 3', false]]
        .forEach(([t, good]) => { const r = scanEquations(t); if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r)); });
      [['(　) ＋ 8 ＝ 15', 'first', '+', 8, 15], ['9 － (　) ＝ 4', 'second', '-', 9, 4], ['(  ) ÷ 5 = 4', 'first', '÷', 5, 4], ['20 ÷ （　）＝ 5', 'second', '÷', 20, 5]]
        .forEach(([t, p, o, x, y]) => { const r = boxEqs(t); if (r.length !== 1 || r[0].pos !== p || r[0].op !== o || r[0].x !== x || r[0].y !== y) fail('boxEqs() self-test: "' + t + '" read as ' + JSON.stringify(r)); });
      if (scanEquations('(　) ＋ 8 ＝ 15').length) fail('scanEquations() self-test: an equation with (　) must not be read as "8 = 15"');

      /* --- 1. 每一條 I18N 靜態字串裡的算式逐條重算；題庫裡「含（　）的算式」題，正解代回去要成立 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        scanEquations(s).forEach(e => { checkedEq++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
      }));
      if (checkedEq < 30) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
      let boxStems = 0;
      LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
        const eqs = boxEqs(q.stem).concat(/文字題|Word problem/.test(q.stem) ? [] : []);
        const e = eqs[0] || boxEqs(q.why)[0];
        if (!e) return;
        if (bank === 'qsAdv' && i === 3) return;   /* 兩步驟：(　) ＋ 20 － 8 ＝ 32，下面另外驗 */
        boxStems++;
        const ans = brute(e.pos, e.op, e.x, e.y);
        if (+q.opts[q.ans] !== ans) fail(bank + '[' + i + '] ' + L + ': ' + e.text + ' is solved by ' + ans + ', marked answer is ' + q.opts[q.ans]);
        q.opts.forEach((o, oi) => { if (oi !== q.ans && +o === ans) fail(bank + '[' + i + '] ' + L + ': option ' + o + ' is also the answer'); });
      })));
      if (boxStems < 20) fail('only ' + boxStems + ' quiz questions with (　) found — the quiz answer check is not reading them');
      LANGS.forEach(L => { const q = I18N[L].qsAdv[3]; if (+q.opts[q.ans] + 20 - 8 !== 32) fail('qsAdv[3] ' + L + ': (　) + 20 − 8 = 32 is solved by 20, marked ' + q.opts[q.ans]); });

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['bal', 'inv', 'sort', 'check', 'build'];
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the examples), got ' + types.join());
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
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        scanEquations(text).filter(e => e.bad).forEach(e => fail(where + ': "' + e.text + '" ' + e.bad));
      };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const within = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_BAL', 'GAME_INV', 'GAME_SORT', 'GAME_CHECK', 'GAME_BUILD'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });
      if (JSON.stringify(D.INVERSE) !== JSON.stringify({ '+':'-', '-':'+', '×':'÷', '÷':'×' })) fail('INVERSE is not + ↔ −, × ↔ ÷: ' + JSON.stringify(D.INVERSE));

      /* 手機上至少 44px（375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍）；點目的地的格子加上 pad */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('the marble (' + D.BAL_TOKEN.size + ')', D.BAL_TOKEN.size);
      tooSmall('a match card height', D.INV_CARD.h); tooSmall('a match card width', D.INV_CARD.w);
      tooSmall('a sort card height', D.SORT_CARD.h);
      tooSmall('a check card height', D.CHK_CARD.h); tooSmall('a check card width', D.CHK_CARD.w);
      tooSmall('a number card height', D.BLD_NUM.h); tooSmall('a sign card', D.BLD_OP.size);
      tooSmall('the (　) box in round 4 with its pad', D.CHK_ROW.cell + 2 * 6);
      tooSmall('the sign box in round 5 with its pad', Math.min(D.BLD_SLOT.w[1], D.BLD_ROW.h) + 2 * D.BLD_PAD);
      [D.BAL_TOKEN.size, D.INV_CARD.h, D.SORT_CARD.h, D.CHK_CARD.h, D.BLD_NUM.h, D.BLD_OP.size].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('bal', /addPiece\(B, \{ w:BAL_TOKEN\.size, h:BAL_TOKEN\.size, cx:150, cy:BAL_TOKEN\.y,/, 'the marble is not BAL_TOKEN.size at (150, BAL_TOKEN.y)');
      need('inv', /addPiece\(B, \{ w:INV_CARD\.w, h:INV_CARD\.h, cx:cx, cy:cy,/, 'the match cards are not INV_CARD');
      need('sort', /addPiece\(B, \{ w:SORT_CARD\.w, h:SORT_CARD\.h, cx:SORT_CARD\.x\[t % 2\], cy:SORT_CARD\.y0 \+ Math\.floor\(t \/ 2\) \* SORT_CARD\.step,/, 'the sort cards are not at SORT_CARD');
      need('check', /addPiece\(B, \{ w:CHK_CARD\.w, h:CHK_CARD\.h, cx:CHK_CARD\.x\[i\], cy:CHK_CARD\.y,/, 'the answer cards are not CHK_CARD');
      need('build', /addPiece\(B, \{ w:BLD_NUM\.w, h:BLD_NUM\.h, cx:BLD_NUM\.x\[i\], cy:BLD_NUM\.y,/, 'the number cards are not BLD_NUM');
      need('build', /addPiece\(B, \{ w:BLD_OP\.size, h:BLD_OP\.size, cx:cx, cy:cy,/, 'the sign cards are not BLD_OP');

      /* 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0 —— 中年級「輕度計分」（§三） */
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
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
        if (I18N[L].op('-') !== (L === 'zh' ? '－' : '−') || I18N[L].op('+') !== (L === 'zh' ? '＋' : '+')) fail('op() ' + L + ' does not print the signs');
      });

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          /* 第 5 關的三格（真的版面）：每一格裡面的點都判給那一格；重疊區裡比較近的那一格（不是陣列裡第一個） */
          const S = D.BLD_SLOT, list = [0, 1, 2].map(i => ({ id:i, cx:S.x[i], cy:D.BLD_ROW.y, hw:S.w[i] / 2, hh:D.BLD_ROW.h / 2, done:false }));
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 1) { const g = nearestOpen(list, { x, y:b.cy }, D.BLD_PAD); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a round-5 box are given to another box (or none)');
          const aR = list[0].cx + list[0].hw, oL = list[1].cx - list[1].hw, gap = oL - aR;
          if (!(gap > 0 && gap < 2 * D.BLD_PAD)) fail('round 5: the boxes are ' + gap + ' apart — the overlap the e2e test relies on is gone');
          const p1 = nearestOpen(list, { x:aR + gap / 2 + 1, y:list[0].cy }, D.BLD_PAD);
          if (!p1 || p1.id !== 1) fail('nearestOpen(): a drop in the overlap nearer the sign box is given to the first box (first match, not nearest)');
          const p2 = nearestOpen(list, { x:aR + gap / 2 - 0.5, y:list[0].cy }, D.BLD_PAD);
          if (!p2 || p2.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：天平（範例 1） --- */
      {
        const BX = D.BAL_BOX, TR = D.BAL_TRAY, H = D.BAL_H, r = D.BALL / 2;
        const trays = [0, 1].map(s => ({ x:TR.x[s] - TR.w / 2, y:TR.y, w:TR.w, h:TR.h }));
        trays.forEach((t, i) => inside(t, 'balance tray ' + i, W, H));
        noHits(trays, 'balance trays');
        const box = sq(BX.cx, BX.cy, BX.w, BX.h);
        if (!within(box, trays[0])) fail('balance: the box is not inside the left tray');
        const tok = sq(150, D.BAL_TOKEN.y, D.BAL_TOKEN.size);
        inside(tok, 'the marble you drag', W, H);
        trays.forEach(t => { if (hit(tok, t)) fail('balance: the marble you drag overlaps a tray'); });
        const lblL = { x:trays[0].x, y:D.BAL_LBL.y, w:TR.w, h:D.BAL_LBL.h };
        if (!within(lblL, trays[0])) fail('balance: the tray label is outside the tray');
        const seen = new Set();
        D.GAME_BAL.forEach((e, i) => {
          const w = 'GAME_BAL[' + i + ']';
          if (!isInt(e.k) || !isInt(e.N)) return fail(w + ' is not whole numbers');
          const ans = brute('first', '+', e.k, e.N);
          if (!(ans >= 1)) return fail(w + ': ' + e.k + ' + (　) = ' + e.N + ' leaves nothing to put in the box');
          if (ans > 9) fail(w + ': the box needs ' + ans + ' — the box holds 9 (3 rows of 3)');
          if (e.k > 8) fail(w + ': ' + e.k + ' marbles outside — two columns of 4 hold 8');
          if (e.N > 20) fail(w + ': ' + e.N + ' on the right — 4 rows of 5 hold 20');
          seen.add(ans);
          /* 照遊戲的規則玩一次：一顆一顆放，「再放就比右邊多」時被擋下；「平衡了」只在兩邊一樣多時收 */
          let n = 0, refused = false, guard = 0;
          while (guard++ < 40){ if (n + e.k >= e.N){ refused = true; break; } n++; }
          if (!refused || n !== ans) fail(w + ': playing by the rules ends with ' + n + ' in the box, should be ' + ans);
          /* 畫出來的點：盒子裡 ans 顆、外面 k 顆、右邊 N 顆 —— 都在自己的範圍裡、互不重疊 */
          const inBox = [], out = [], right = [];
          for (let j = 0; j < 9; j++){ const p = D.balBoxXY(j); inBox.push({ x:BX.cx - BX.w / 2 + p.x - r, y:BX.cy - BX.h / 2 + p.y - r, w:2 * r, h:2 * r }); }
          for (let j = 0; j < e.k; j++){ const p = D.balKnownXY(j); out.push(sq(p.x, p.y, D.BALL)); }
          for (let j = 0; j < e.N; j++){ const p = D.balRightXY(j); right.push(sq(p.x, p.y, D.BALL)); }
          inBox.forEach((b, j) => { if (!within(b, box)) fail(w + ': balBoxXY(' + j + ') is outside the box — box holds 9'); });
          noHits(inBox, w + ' box marble'); noHits(out, w + ' outside marble'); noHits(right, w + ' right-tray marble');
          out.forEach((b, j) => { if (!within(b, trays[0]) || hit(b, box)) fail(w + ': the box and the marbles outside it overlap (marble ' + j + ')'); if (hit(b, lblL)) fail(w + ': marble ' + j + ' covers the tray label'); });
          right.forEach((b, j) => { if (!within(b, trays[1])) fail(w + ': right-tray marble ' + j + ' is outside the tray'); if (hit(b, { x:trays[1].x, y:D.BAL_LBL.y, w:TR.w, h:D.BAL_LBL.h })) fail(w + ': right-tray marble ' + j + ' covers the label'); });
          /* 每一句說明 */
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gBalNow ' + L, d.gBalNow(2, e.k, e.N), [2, e.k, 2 + e.k, e.N]);
            seq(w + ' gBalLeft ' + L, d.gBalLeft(e.k), [e.k]);
            seq(w + ' gBalRight ' + L, d.gBalRight(e.N), [e.N]);
            seq(w + ' gBalShort ' + L, d.gBalShort(1, e.k, e.N), [1, e.k, 1 + e.k, e.N]);
            seq(w + ' gBalOver ' + L, d.gBalOver(ans, e.k, e.N), [ans, e.k, e.N, e.N]);
            seq(w + ' gBalDone ' + L, d.gBalDone(e.k, e.N, ans), [e.k, e.N, ans, ans, e.k, e.N]);
            seq(w + ' gBal2 ' + L, d.gBal2(1, e.k, e.N), L === 'zh' ? [1, 1 + e.k, e.N, e.N - 1 - e.k] : [1, 1 + e.k, e.N - 1 - e.k, e.N]);
          });
        });
        if (seen.size < 3) fail('GAME_BAL: only ' + seen.size + ' different answers in the pool');
        need('bal', /if \(n \+ e\.k >= e\.N\)\{ roundMiss\(d\.gBalOver/, 'one too many is accepted (no gBalOver refusal at n + k >= N)');
        need('bal', /if \(n \+ e\.k < e\.N\)\{ roundMiss\(d\.gBalShort/, '"balanced" is accepted before both sides match');
        need('bal', /nearestOpen\(\[target\], pt, 6\)/, 'the marble is not dropped by nearestOpen() into the box');
      }

      /* --- 第 2 關：配對（範例 2） --- */
      {
        const R = D.INV_ROW, H = D.INV_H, ops = ['+', '-', '×', '÷'];
        if (D.INV_OPS.slice().sort().join() !== ops.slice().sort().join()) fail('INV_OPS should be the four operations');
        const rows = [], slots = [];
        for (let i = 0; i < 4; i++){
          const cy = R.y0 + i * R.step;
          const eq = sq(D.INV_EQ.cx, cy, D.INV_EQ.w, R.h), sl = sq(D.INV_SLOT.cx, cy, D.INV_SLOT.w, R.h), rs = sq(D.INV_RES.cx, cy, D.INV_RES.w, R.h);
          [eq, sl, rs].forEach((o, j) => inside(o, 'match row ' + i + ' part ' + j, W, H));
          if (hit(eq, sl) || hit(sl, rs)) fail('match row ' + i + ': the equation, the box and the answer overlap');
          rows.push(sq(150, cy, W, R.h)); slots.push(sl);
          if (D.INV_CARD.w > D.INV_SLOT.w || D.INV_CARD.h > R.h) fail('match: a card does not fit in the box');
        }
        noHits(rows, 'inv: rows');
        if (rows.length === 4 && rows[1].y - (rows[0].y + rows[0].h) >= 0 && rows[1].y - (rows[0].y + rows[0].h) >= 2 * D.INV_PAD) fail('match: the rows are ' + (rows[1].y - rows[0].y - rows[0].h) + ' apart — no snap overlap (fine) but the e2e overlap test needs one');
        const x0 = (W - 3 * D.INV_CARD.step) / 2, cards = [0, 1, 2, 3].map(i => sq(x0 + i * D.INV_CARD.step, D.INV_CARD.y, D.INV_CARD.w, D.INV_CARD.h));
        cards.forEach((c, i) => inside(c, 'match card ' + i, W, H));
        noHits(cards, 'inv: cards');
        cards.forEach(c => rows.forEach(r => { if (hit(c, r)) fail('match: the card tray reaches the rows'); }));
        D.GAME_INV.forEach((e, i) => {
          const w = 'GAME_INV[' + i + ']';
          if (!isInt(e.b) || !isInt(e.c) || e.b < 2 || e.b > 9) return fail(w + ': b should be 2~9');
          if (e.c % e.b) return fail(w + ': ' + e.c + ' ÷ ' + e.b + ' does not divide — (　) × b = c has no whole answer');
          const answers = ops.map(op => brute('first', op, e.b, e.c));
          if (answers.some(a => !(a >= 1))) return fail(w + ': an equation has no answer ≥ 1: ' + answers.join());
          if (new Set(answers).size !== 4) fail(w + ': two equations share an answer (' + answers.join() + ') — the four cards are not four different ideas');
          answers.forEach(a => { if (a > 99) fail(w + ': answer ' + a + ' does not fit the answer label (≤ 99)'); });
          /* 每一種配法都試：一張卡被收下 ⇔ 它的算法真的解得開那個算式（自己的暴力解判） */
          ops.forEach(eqOp => ops.forEach(cardOp => {
            const accepted = cardOp === D.INVERSE[eqOp];
            const solves = ap(e.c, cardOp, e.b) === brute('first', eqOp, e.b, e.c);
            if (accepted !== solves) fail(w + ': the card ' + e.c + ' ' + cardOp + ' ' + e.b + ' on (　) ' + eqOp + ' ' + e.b + ' = ' + e.c + ' is ' + (accepted ? 'accepted but does not solve it' : 'refused but solves it') + ' — a card that does not solve is accepted, or INVERSE is wrong');
          }));
          LANGS.forEach(L => {
            const d = I18N[L];
            ops.forEach(op => {
              const be = boxEqs(d.gInvEq(op, e.b, e.c));
              if (be.length !== 1 || be[0].op !== op || be[0].x !== e.b || be[0].y !== e.c) fail(w + ' gInvEq ' + L + ' ' + op + ': ' + d.gInvEq(op, e.b, e.c));
              const card = norm(d.gInvCard(op, e.b, e.c));
              if (card !== e.c + ' ' + op + ' ' + e.b) fail(w + ' gInvCard ' + L + ': "' + card + '"');
              seq(w + ' gInvWrong ' + L + ' ' + op, d.gInvWrong(op, e.b, e.c, op), [e.b, e.c, e.b, e.c, e.b, e.c, e.b]);
              const h2 = norm(d.gInv2(op, e.b, e.c));
              if (h2.indexOf(e.c + ' ' + D.INVERSE[op] + ' ' + e.b) < 0) fail(w + ' gInv2 ' + L + ': does not name the inverse: ' + h2);
            });
            seq(w + ' gInvDone ' + L, d.gInvDone(e.b, e.c), [e.b, e.c].concat(answers));
            seq(w + ' gInvNow ' + L, d.gInvNow(3), [3, 4]);
          });
        });
        need('inv', /if \(P\.data\.op !== INVERSE\[s\.op\]\)\{ roundMiss\(d\.gInvWrong/, 'a card that does not solve is accepted (no INVERSE check)');
        need('inv', /s\.res\.textContent = '＝ ' \+ applyOpG\(e\.c, P\.data\.op, e\.b\);/, 'the row does not show the card\'s own answer');
        need('inv', /if \(placed === 4\) roundSolved/, 'the round is not solved after four cards');
      }

      /* --- 第 3 關：分類（範例 3） --- */
      {
        const SB = D.SORT_BIN, H = D.SORT_H, C = D.SORT_CARD;
        const bins = [0, 1].map(k => ({ x:SB.x[k] - SB.w / 2, y:SB.y, w:SB.w, h:SB.h }));
        bins.forEach((b, k) => inside(b, 'basket ' + k, W, H));
        if (hit(bins[0], bins[1])) fail('sort: the baskets overlap');
        const gap = bins[1].x - (bins[0].x + bins[0].w);
        if (!(gap > 0 && gap < 2 * D.SORT_PAD)) fail('sort: the baskets are ' + gap + ' apart — the overlap the e2e relies on is gone');
        const lbl = { x:bins[0].x, y:SB.y, w:SB.w, h:D.SORT_LBL.h };
        for (let j = 0; j < 4; j++){
          const c = sq(SB.x[0], D.SORT_IN.y0 + j * D.SORT_IN.step, C.w, C.h);
          if (!within(c, bins[0])) fail('sort: sorted card ' + j + ' sticks out of the basket');
          if (hit(c, lbl)) fail('sort: sorted card ' + j + ' covers the basket label');
          if (j && hit(c, sq(SB.x[0], D.SORT_IN.y0 + (j - 1) * D.SORT_IN.step, C.w, C.h))) fail('sort: sorted cards ' + (j - 1) + ' and ' + j + ' overlap');
        }
        const tray = [];
        for (let t = 0; t < 6; t++) tray.push(sq(C.x[t % 2], C.y0 + Math.floor(t / 2) * C.step, C.w, C.h));
        tray.forEach((c, t) => { inside(c, 'sort: tray card ' + t, W, H); bins.forEach(b => { if (hit(c, b)) fail('sort: tray card ' + t + ' overlaps a basket'); }); });
        noHits(tray, 'sort: tray card');
        D.GAME_SORT.forEach((e, i) => {
          const w = 'GAME_SORT[' + i + ']';
          if (e.f !== '-' && e.f !== '÷') return fail(w + ': family should be - or ÷');
          if (e.b === e.c) return fail(w + ': b and c are the same number — two cards would be the same equation');
          if (e.f === '÷' && (e.b < 2 || e.c < 2 || e.b > 9 || e.c > 9)) fail(w + ': outside the 9×9 table');
          const cards = D.sortCards(e);
          if (!Array.isArray(cards) || cards.length !== 6) return fail(w + ': sortCards() should give six equations');
          const big = e.f === '-' ? e.b + e.c : e.b * e.c, texts = new Set();
          let n0 = 0;
          cards.forEach((c, j) => {
            const cw = w + ' card ' + j;
            /* 自己的暴力解 + 自己的「用哪一種運算找」：籃子 0 是 ＋／×、籃子 1 是 －／÷ */
            const ans = brute(c.p, c.op, c.x, c.y), f = myFinder(c.p, c.op, c.x, c.y);
            if (!(ans >= 1)) return fail(cw + ': has no answer ≥ 1');
            if (c.ans !== ans) fail(cw + ': sortCards() says (　) = ' + c.ans + ', it is ' + ans);
            if (ap(f[0], f[1], f[2]) !== ans) fail(cw + ': my finder does not solve it (config bug)');
            const myBin = (f[1] === '+' || f[1] === '×') ? 0 : 1;
            if (c.bin !== myBin) fail(cw + ': sortCards() puts ' + c.x + ' ' + c.op + ' ' + c.y + ' (' + c.p + ') in basket ' + c.bin + ', it is found with ' + f[1]);
            if ([c.x, c.y, ans].sort((a, b) => a - b)[2] !== big) fail(cw + ': not built from the family ' + e.b + ', ' + e.c + ', ' + big);
            if (myBin === 0) n0++;
            const key = c.p + c.op + c.x + ',' + c.y; if (texts.has(key)) fail(cw + ': the same equation twice'); texts.add(key);
            const u = D.undo(c.p, c.op, c.x, c.y);
            if (u.a !== f[0] || u.op !== f[1] || u.b !== f[2]) fail(cw + ': undo() says ' + u.a + ' ' + u.op + ' ' + u.b + ', should be ' + f.join(' '));
            LANGS.forEach(L => {
              const d = I18N[L];
              const be = boxEqs(d.gEq(c.p, c.op, c.x, c.y));
              if (be.length !== 1 || be[0].pos !== c.p || be[0].op !== c.op || be[0].x !== c.x || be[0].y !== c.y) fail(cw + ' gEq ' + L + ': ' + d.gEq(c.p, c.op, c.x, c.y));
              seq(cw + ' gSortSolved ' + L, d.gSortSolved(c), [c.x, c.y, f[0], f[2], ans]);
              const wt = d.gSortWrong(c);
              seq(cw + ' gSortWrong ' + L, wt, myBin === 0 || c.op === e.f ? [c.x, c.y, c.x, c.y, f[0], f[2]] : [c.x, c.y, c.x, c.y, c.x, f[0], f[2]]);
              if (norm(wt).indexOf(f[0] + ' ' + f[1] + ' ' + f[2]) < 0) fail(cw + ' gSortWrong ' + L + ': does not show ' + f.join(' '));
              if (norm(d.gSort2(c)).indexOf(f[0] + ' ' + f[1] + ' ' + f[2]) < 0) fail(cw + ' gSort2 ' + L + ': does not show ' + f.join(' '));
            });
          });
          if (n0 !== 2) fail(w + ': ' + n0 + ' cards go in the first basket, should be 2');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gSortDone ' + L, d.gSortDone(e.f, 2, 4), [2, 4]);
            const b0 = norm(d.gSortBin(e.f, 0)), b1 = norm(d.gSortBin(e.f, 1));
            if (b0.indexOf(e.f === '-' ? '+' : '×') < 0 || b1.indexOf(e.f === '-' ? '-' : '÷') < 0) fail(w + ' gSortBin ' + L + ': labels "' + b0 + '" / "' + b1 + '" do not match the baskets');
          });
        });
        LANGS.forEach(L => seq('gSortNow ' + L, I18N[L].gSortNow(2), [2, 6]));
        need('sort', /if \(b\.k !== c\.bin\)\{ roundMiss\(d\.gSortWrong\(c\)\); return false; \}/, 'the wrong basket is accepted');
        need('sort', /P\.lock\(SB\.x\[b\.k\], SORT_IN\.y0 \+ put\[b\.k\] \* SORT_IN\.step\)/, 'a sorted card is not stacked in its basket');
        need('sort', /var line = trailLine\(d\.gSortNow\(0\)\);/, 'the first line is not gSortNow(0)');
      }

      /* --- 第 4 關：驗算（範例 4） --- */
      {
        const RW = D.CHK_ROW, H = D.CHK_H, h = RW.cell / 2;
        const cells = [0, 1, 2, 3, 4].map(i => (i === 1 || i === 3) ? sq(RW.x[i], RW.y, RW.op, RW.cell) : sq(RW.x[i], RW.y, RW.cell));
        cells.forEach((c, i) => inside(c, 'check: cell ' + i, W, H));
        noHits(cells, 'check: the equation row overlaps — cell');
        const fact = { x:0, y:D.CHK_EQ.y - D.CHK_EQ.h / 2, w:W, h:D.CHK_EQ.h }, right = { x:0, y:D.CHK_RIGHT.y - D.CHK_RIGHT.h / 2, w:W, h:D.CHK_RIGHT.h };
        [fact, right].forEach((o, j) => { inside(o, 'check: label ' + j, W, H); cells.forEach(c => { if (hit(o, c)) fail('check: label ' + j + ' overlaps the equation row'); }); });
        const names = D.CHK_CARD.x.map(x => sq(x, D.CHK_NAME.y, 120, D.CHK_NAME.h)), cards = D.CHK_CARD.x.map(x => sq(x, D.CHK_CARD.y, D.CHK_CARD.w, D.CHK_CARD.h));
        cards.forEach((c, j) => { inside(c, 'check: card ' + j, W, H); names.forEach(n => { if (hit(c, n)) fail('check: the cards overlap the names'); }); if (hit(c, right)) fail('check: card ' + j + ' overlaps the right-side label'); });
        noHits(names, 'check: name'); noHits(cards, 'check: card');
        if (D.CHK_CARD.w > RW.cell + 30) fail('check: a card is much wider than (　)');
        D.GAME_CHECK.forEach((e, i) => {
          const w = 'GAME_CHECK[' + i + ']';
          const ans = brute(e.pos, e.op, e.known, e.result);
          if (!isInt(ans) || ans < 1) return fail(w + ': ' + JSON.stringify(e) + ' is not a whole number answer ≥ 1');
          if (D.solveG(e.pos, e.op, e.known, e.result) !== ans) fail(w + ': solveG() is ' + D.solveG(e.pos, e.op, e.known, e.result) + ', should be ' + ans);
          /* 錯的那個答案：自己算「做了同一個運算」 */
          const wrong = ap(e.result, e.op, e.known);
          if (D.sameOpClaim(e) !== wrong) fail(w + ': the wrong answer ' + D.sameOpClaim(e) + ' is not the same-operation mistake ' + e.result + ' ' + e.op + ' ' + e.known + ' = ' + wrong);
          if (!isInt(wrong) || wrong < 0) return fail(w + ': the same-operation answer ' + wrong + ' is not a whole number');
          if (wrong === ans) return fail(w + ': the wrong answer also works (' + wrong + ')');
          const Lw = e.pos === 'first' ? ap(wrong, e.op, e.known) : ap(e.known, e.op, wrong);
          if (!isInt(Lw) || Lw < 0) return fail(w + ': substituting ' + wrong + ' gives ' + Lw + ' — is not a whole number a third grader can work out');
          if (Lw > 999) fail(w + ': substituting ' + wrong + ' gives ' + Lw + ' — does not fit the 3-digit answer box');
          if (Lw === e.result) fail(w + ': the wrong answer also works');
          [ans, wrong].forEach(v => { const L0 = e.pos === 'first' ? ap(v, e.op, e.known) : ap(e.known, e.op, v); if (D.leftWith(e, v) !== L0) fail(w + ': leftWith(' + v + ') is ' + D.leftWith(e, v) + ', should be ' + L0); });
          LANGS.forEach(L => {
            const d = I18N[L];
            const sub = v => e.pos === 'first' ? [v, e.known] : [e.known, v];
            const be = boxEqs(d.gEq(e.pos, e.op, e.known, e.result));
            if (be.length !== 1 || be[0].pos !== e.pos || be[0].x !== e.known) fail(w + ' gEq ' + L + ': ' + d.gEq(e.pos, e.op, e.known, e.result));
            seq(w + ' gChkSub ' + L, d.gChkSub(e.pos, e.op, e.known, wrong, null), sub(wrong));
            seq(w + ' gChkSub= ' + L, d.gChkSub(e.pos, e.op, e.known, ans, e.result), sub(ans).concat([e.result]));
            seq(w + ' gChkCalc ' + L, d.gChkCalc(e.pos, e.op, e.known, wrong, Lw + 1), sub(wrong).concat([Lw + 1]));
            seq(w + ' gChkCompare ' + L, d.gChkCompare(Lw, e.result), [Lw, e.result]);
            seq(w + ' gChkNotSame ' + L, d.gChkNotSame(Lw, e.result), [Lw, e.result]);
            seq(w + ' gChkIsSame ' + L, d.gChkIsSame(e.result, e.result), [e.result, e.result]);
            seq(w + ' gChkDone ' + L, d.gChkDone(e.pos, e.op, e.known, e.result, ans, wrong, Lw), sub(ans).concat([e.result, ans]).concat(sub(wrong)).concat([Lw, e.result, wrong, e.result, e.known]));
            seq(w + ' gChk2a ' + L, d.gChk2a(ans, wrong), [ans, wrong]);
            seq(w + ' gChk2b ' + L, d.gChk2b(e.pos, e.op, e.known, wrong), sub(wrong));
            seq(w + ' gChk2c ' + L, d.gChk2c(Lw, e.result), [Lw, e.result]);
            seq(w + ' gChkRight ' + L, d.gChkRight(e.result), [e.result]);
          });
        });
        LANGS.forEach(L => { seq('gChkNow ' + L, I18N[L].gChkNow(1), [1, 2]); if (!I18N[L].gChkName(0) || !I18N[L].gChkName(1) || I18N[L].gChkName(0) === I18N[L].gChkName(1)) fail('gChkName ' + L + ': two different names'); });
        need('check', /if \(v !== want\)\{ roundMiss\(d\.gChkCalc/, 'a wrong left side is accepted');
        need('check', /if \(isSame !== \(val === e\.result\)\)\{ roundMiss/, 'the wrong comparison is accepted');
        need('check', /var t = inp\.value\.trim\(\);\n\s+if \(!\/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(t\)\)\{ gMsg\.textContent = d\.gChkEmpty; return; \}/, 'an oddly written number ("0 27", "2 7", "27.0") is counted as a mistake or read as a number');
        need('check', /inp\.maxLength = 3;/, 'the answer box does not fit the 3-digit answer box');
        need('check', /var claims = shuffle\(\[right, wrong\]\)/, 'the two answers are not shuffled');
        need('check', /if \(judged === 2\)\{/, 'the round ends before both answers are checked');
      }

      /* --- 第 5 關：列式（進階題） --- */
      {
        const R = D.BLD_ROW, H = D.BLD_H, S = D.BLD_SLOT;
        const row = [0, 1, 2].map(i => sq(S.x[i], R.y, S.w[i], R.h)).concat([sq(D.BLD_EQ.x, R.y, D.BLD_EQ.w, R.h), sq(D.BLD_RES.x, R.y, D.BLD_RES.w, R.h)]);
        row.forEach((o, i) => inside(o, 'build: row part ' + i, W, H));
        noHits(row, 'build: the sign box and the number boxes — part');
        if (D.BLD_NUM.w > S.w[0] || D.BLD_NUM.w > S.w[2] || D.BLD_OP.size > S.w[1]) fail('build: a card is wider than its box');
        const nc = D.BLD_NUM.x.map(x => sq(x, D.BLD_NUM.y, D.BLD_NUM.w, D.BLD_NUM.h)), oc = D.BLD_OP.x.map(x => sq(x, D.BLD_OP.y, D.BLD_OP.size));
        nc.concat(oc).forEach((c, j) => { inside(c, 'build: card ' + j, W, H); row.forEach(r => { if (hit(c, r)) fail('build: card ' + j + ' reaches the equation row'); }); });
        noHits(nc.concat(oc), 'build: card');
        if (!(D.BLD_OP.x[1] - D.BLD_OP.x[0] > 0) || D.BLD_OP.x.some((x, j) => j && !near(x - D.BLD_OP.x[j - 1], D.BLD_OP.x[1] - D.BLD_OP.x[0]))) fail('build: the sign cards are not evenly spaced (renderTray uses one step)');
        if (!near((W - 3 * (D.BLD_OP.x[1] - D.BLD_OP.x[0])) / 2, D.BLD_OP.x[0])) fail('build: renderTray() would not put the sign cards at BLD_OP.x');
        /* 自己的故事模型：每一種故事，哪幾種排法是對的（op、（　）在前或在後），以及答案 */
        const MODEL = {
          addFirst:  { op:'+', pos:['first', 'second'], ans:e => e.result - e.known, zh:/又買了/, en:/bought/ },
          subFirst:  { op:'-', pos:['first'],           ans:e => e.result + e.known, zh:/吃掉/, en:/eating/ },
          subSecond: { op:'-', pos:['second'],          ans:e => e.known - e.result, zh:/送給/, en:/giving/ },
          mulSecond: { op:'×', pos:['first', 'second'], ans:e => e.result / e.known, zh:/分成 \d+ 組/, en:/equal groups/ },
          divFirst:  { op:'÷', pos:['first'],           ans:e => e.result * e.known, zh:/平分給/, en:/shared equally/ },
          divSecond: { op:'÷', pos:['second'],          ans:e => e.known / e.result, zh:/每人分/, en:/for each child/ }
        };
        const kinds = new Set();
        D.GAME_BUILD.forEach((e, i) => {
          const w = 'GAME_BUILD[' + i + '] ' + e.t, M = MODEL[e.t];
          if (!M) return fail(w + ': no story model for ' + e.t);
          kinds.add(e.t);
          const a = M.ans(e);
          if (!isInt(a) || a < 1) return fail(w + ': the answer ' + a + ' is not a whole number ≥ 1');
          if (e.op !== M.op || JSON.stringify(e.pos === null ? ['first', 'second'] : [e.pos]) !== JSON.stringify(M.pos)) fail(w + ': the story says ' + M.op + ' with (　) ' + M.pos.join('/') + ', the data says ' + e.op + ' ' + e.pos);
          /* 照遊戲的規則把每一種排法都試（（　）在左或右 × 四個符號）：收下 ⇔ 故事模型說對 */
          ['first', 'second'].forEach(p => ['+', '-', '×', '÷'].forEach(op => {
            const accepted = op === e.op && (e.pos === null || e.pos === p);
            const right = op === M.op && M.pos.indexOf(p) >= 0;
            if (accepted !== right) fail(w + ': build: accepts ' + (p === 'first' ? '(　) ' + op + ' ' + e.known : e.known + ' ' + op + ' (　)') + ' = ' + e.result + ' — ' + (accepted ? 'the story says it is wrong' : 'the story says it is right'));
            if (right){
              const b = brute(p, op, e.known, e.result);
              if (b !== a) fail(w + ': ' + p + ' ' + op + ' solves to ' + b + ', the story answer is ' + a);
              if (D.solveG(p, op, e.known, e.result) !== a) fail(w + ': solveG() for ' + p + ' is ' + D.solveG(p, op, e.known, e.result));
            }
          }));
          LANGS.forEach(L => {
            const d = I18N[L], st = d.gStory(e);
            seq(w + ' gStory ' + L, st, [e.known, e.result]);
            if (!M[L].test(st)) fail(w + ' gStory ' + L + ': the story says ' + st + ' — the story model expects ' + M[L]);
            M.pos.forEach(p => {
              const f = myFinder(p, e.op, e.known, e.result);
              seq(w + ' gBldDone ' + L + ' ' + p, d.gBldDone(e, p, a), [e.known, e.result, f[0], f[2], a]);
              const be = boxEqs(d.gBldDone(e, p, a));
              if (be.length !== 1 || be[0].pos !== p || be[0].op !== e.op) fail(w + ' gBldDone ' + L + ': does not show the equation');
            });
            seq(w + ' gBldNow ' + L, d.gBldNow(['box', e.op, 'known'], e.result, e.known), [e.known, e.result]);
            seq(w + ' gBld2 ' + L, d.gBld2(e), [e.known]);
            if (norm(d.gBld2(e)).indexOf(d.op(e.op) === '－' ? '-' : norm(d.op(e.op))) < 0) fail(w + ' gBld2 ' + L + ': does not name ' + e.op);
            if (e.pos) seq(w + ' gBldPos ' + L, d.gBldPos(e), e.pos === 'second' ? [e.known] : []);
            /* 包含除（每幾個一份，問幾份）不是平分：提示與說明都不可以叫它平分／sharing */
            if (e.t === 'divSecond') [d.gBld2(e), d.gBldOp(e, '×')].forEach(t => { if (/平分|[Ss]har/.test(t)) fail(w + ' ' + L + ': a grouping story (how many groups of ' + e.result + ') is called sharing: ' + t); });
            if (e.t === 'divFirst') [d.gBld2(e), d.gBldOp(e, '×')].forEach(t => { if (!/平分|[Ss]har/.test(t)) fail(w + ' ' + L + ': the sharing story is not called sharing: ' + t); });
            ['+', '-', '×', '÷'].filter(o => o !== e.op).forEach(o => { const t = norm(d.gBldOp(e, o)); if (t.indexOf(norm(d.op(e.op))) < 0 || t.indexOf(norm(d.op(o))) < 0) fail(w + ' gBldOp ' + L + ' ' + o + ': ' + t); });
          });
        });
        Object.keys(MODEL).forEach(t => { if (!kinds.has(t)) fail('GAME_BUILD: no ' + t + ' story — every kind of story should be in the pool'); });
        LANGS.forEach(L => { if (nums(I18N[L].gBldNotOp).length) fail('gBldNotOp ' + L + ' has numbers'); if (!/×/.test(I18N[L].gBldNotNum('×'))) fail('gBldNotNum ' + L); });
        need('build', /if \(s\.kind === 'op' && c\.kind !== 'op'\)\{ roundMiss\(d\.gBldNotOp\); return false; \}/, 'a number is accepted in the sign box');
        need('build', /if \(s\.kind === 'num' && c\.kind === 'op'\)\{ roundMiss\(d\.gBldNotNum/, 'a sign is accepted in a number box');
        need('build', /if \(c\.kind === 'op' && c\.op !== e\.op\)\{ roundMiss\(d\.gBldOp/, 'build: accepts the wrong sign');
        need('build', /if \(c\.kind === 'num' && need >= 0 && \(\(c\.k === 'box'\) !== \(s\.i === need\)\)\)\{ roundMiss\(d\.gBldPos/, 'build: accepts (　) in the wrong place');
        need('build', /var need = e\.pos === 'first' \? 0 : e\.pos === 'second' \? 2 : -1;/, 'build: accepts — the required place of (　) is not first → box 0, second → box 2');
        need('build', /nearestOpen\(slots, pt, BLD_PAD\)/, 'build: drops do not go through nearestOpen(slots, pt, BLD_PAD)');
      }
    }
  }
};
