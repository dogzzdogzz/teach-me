/* grade-5/math/operations 的檢查設定（運算律魔術師：運算順序、交換律、結合律、分配律）。
   2026-10-10 新增 —— 和小遊戲「湊整數大挑戰」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔。

   sim（review.html 的九個產生器 —— 運算律、面積、小數、平均交錯的複習）：每個產生器一組不變條件、
   正解的第二套實作（只用原始參數重算，不呼叫頁面的格式化函式）、選項的形狀與範圍。
   跑起來抓到的舊缺陷（review.html 修掉，有一筆 break）：
     - 九個產生器裡有五個的誘答會把題幹的數字抄回來（平均題的「平均 ± 1」剛好是清單裡的一個數、
       「x ÷ 2」的「商 × 2」就是被除數……；§六之三第 4 點）—— makeWrongs() 加上 avoid（題幹數字先當成用過）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）裡的算式用 lib/arith.js 逐條重算（含括號與先乘除後加減）。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍：
       先算誰 —— 走遍每一種「現在可以算」的順序，每一步用自己的算式樹判斷誰可以算（兩個孩子都已經是數），和頁面的 stepWhy() 逐個比；
                 每一個被擋下的「兩邊都是數」的符號，先算它真的會讓答案變（不會擋掉其實無害的一步）；說明句的種類與數字逐個比；
       換位置 —— 每一張卡「換的那兩塊」真的是同一個 + 或 × 的兩個孩子（答案一樣）、或不是而且答案真的變了；
       先湊整數 —— 每一列剛好一對湊得出整十整百；拆開乘 —— 每一種剪法只有「一塊剛好 10 直排」收；
       合起來 —— 每一張卡 × 每一個空格，收不收和自己的規則一樣，收完一定是原來的算式、括號裡一定是整十。
     每一句說明兩種語言逐個比數字；shuffle()、nearestOpen()、roundMiss() 從原始碼切出來真的跑；
     版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；RENDER 裡「判斷的是丟下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、文字放不放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-operations 的端對端測試驗（合成 PointerEvent）。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number); }

/* ---------- 這一份設定自己的算式樹（不呼叫頁面的 stepWhy／evalTok） ---------- */
const LV = { '×':1, '÷':1, '+':0, '−':0 };
function lex(s){ return (String(s).replace(/[{}]/g, '').match(/\d+|[+−×÷()]/g) || []).map(t => /^\d+$/.test(t) ? +t : t); }
function parse(tk){
  let p = 0;
  function factor(){ const t = tk[p]; if (t === '('){ p++; const e = expr(); if (tk[p] !== ')') throw new Error('no )'); p++; return e; } if (typeof t !== 'number') throw new Error('number expected at ' + p); p++; return { v:t, i:p - 1, s:p - 1, e:p - 1 }; }
  function term(){ let l = factor(); while (LV[tk[p]] === 1){ const i = p, op = tk[p++], r = factor(); l = { op, i, l, r, s:l.s, e:r.e }; } return l; }
  function expr(){ let l = term(); while (LV[tk[p]] === 0){ const i = p, op = tk[p++], r = term(); l = { op, i, l, r, s:l.s, e:r.e }; } return l; }
  const t = expr();
  if (p !== tk.length) throw new Error('trailing tokens');
  return t;
}
function ap(a, op, b){ return op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b; }
/* 每一步都要是 0 以上的整數（五年級沒有負數；除法要整除） */
function valStrict(n, bad){ if (!n.op) return n.v; const v = ap(valStrict(n.l, bad), n.op, valStrict(n.r, bad)); if (!(isInt(v) && v >= 0)) bad.push(v); return v; }
function evalT(tk){ return valStrict(parse(tk), []); }
function val(n){ return n.op ? ap(val(n.l), n.op, val(n.r)) : n.v; }
function readyOps(tk){ const out = []; (function w(n){ if (!n.op) return; if (!n.l.op && !n.r.op) out.push(n.i); w(n.l); w(n.r); })(parse(tk)); return out.sort((a, b) => a - b); }
function collapse(tk, i){
  let out = tk.slice(0, i - 1).concat([ap(tk[i - 1], tk[i], tk[i + 1])], tk.slice(i + 2));
  const j = i - 1;
  if (out[j - 1] === '(' && out[j + 1] === ')') out = out.slice(0, j - 1).concat([out[j]], out.slice(j + 2));
  return out;
}
/* 被擋下的符號：說明應該是哪一種、要帶哪些數（括號 → 括號裡的數；先乘除 → x, y, 共用的那個數；由左而右 → x, y,（左邊那一步的兩個數）） */
function whyRef(tk, i){
  const num = t => typeof t === 'number';
  if (!num(tk[i - 1]) || !num(tk[i + 1])){
    let p, e, d = 0;
    if (tk[i + 1] === '(') p = i + 1; else for (p = i - 1; p >= 0; p--){ if (tk[p] === ')') d++; else if (tk[p] === '('){ d--; if (d === 0) break; } }
    d = 0; for (e = p; e < tk.length; e++){ if (tk[e] === '(') d++; else if (tk[e] === ')'){ d--; if (d === 0) break; } }
    return { kind:'paren', nums:tk.slice(p + 1, e).filter(num) };
  }
  let lo = i, hi = i, dd = 0;
  while (lo > 0){ if (tk[lo - 1] === ')') dd++; else if (tk[lo - 1] === '('){ if (dd === 0) break; dd--; } lo--; }
  dd = 0; while (hi < tk.length - 1){ if (tk[hi + 1] === '(') dd++; else if (tk[hi + 1] === ')'){ if (dd === 0) break; dd--; } hi++; }
  const x = tk[i - 1], y = tk[i + 1];
  /* 說「j 要先算」的時候，j 自己若還不能算，說明要把「現在真的可以算」的那一步也帶上（不然照著點 j 又會被擋）。
     自己的定義：在算式樹裡從 j 往下走，走進還沒算完的那個孩子（先左後右），走到兩個孩子都是數的那一步。 */
  const tail = j => {
    if (readyOps(tk).indexOf(j) >= 0) return [];
    let n = null; (function f(m){ if (!m.op || n) return; if (m.i === j) n = m; else { f(m.l); f(m.r); } })(parse(tk));
    while (n.l.op || n.r.op) n = n.l.op ? n.l : n.r;
    return tk.slice(n.s, n.e + 1);
  };
  const mk = (kind, base, j) => { const t = tail(j); return { kind, nums:base.concat(t.filter(num)), chained:t.length > 0, step:t.join(' '), blockedOther:false }; };
  if (LV[tk[i]] === 1){ let j = i; while (j - 2 >= lo && LV[tk[j - 2]] === 1) j -= 2; return mk('ltr', [x, y].concat(num(tk[j - 1]) && num(tk[j + 1]) ? [tk[j - 1], tk[j + 1]] : []), j); }
  if (i - 2 >= lo && LV[tk[i - 2]] === 1) return mk('muldiv', [x, y, x], i - 2);
  if (i + 2 <= hi && LV[tk[i + 2]] === 1) return mk('muldiv', [x, y, y], i + 2);
  let depth = 0;
  for (let k = lo; k < i; k++){ if (tk[k] === '(') depth++; else if (tk[k] === ')') depth--; else if (depth === 0 && LV[tk[k]] === 0) return mk('ltr', [x, y].concat(num(tk[k - 1]) && num(tk[k + 1]) ? [tk[k - 1], tk[k + 1]] : []), k); }
  return null;
}
/* 換位置：{ } 標出來的兩塊 */
function braces(s){ return (String(s).match(/\{([^{}]*)\}/g) || []).map(x => x.slice(1, -1).trim()); }
/* 樹裡找「兩個孩子剛好是這兩塊」的節點（用 token 範圍比對） */
function siblingOp(s){
  const plain = String(s).replace(/[{}]/g, ''), tk = lex(plain), g = braces(s).map(lex);
  let found = null;
  (function w(n){
    if (!n.op) return;
    const L = tk.slice(n.l.s - (tk[n.l.s - 1] === '(' && tk[n.l.e + 1] === ')' ? 1 : 0), n.l.e + 1 + (tk[n.l.s - 1] === '(' && tk[n.l.e + 1] === ')' ? 1 : 0));
    const Rr = tk.slice(n.r.s - (tk[n.r.s - 1] === '(' && tk[n.r.e + 1] === ')' ? 1 : 0), n.r.e + 1 + (tk[n.r.s - 1] === '(' && tk[n.r.e + 1] === ')' ? 1 : 0));
    if (L.join(' ') === g[0].join(' ') && Rr.join(' ') === g[1].join(' ')) found = n.op;
    w(n.l); w(n.r);
  })(parse(tk));
  return found;
}

/* review.html：正解的第二套實作 */
const SIM_EXPECT = {
  orderEval: d => d.patt === 'A' ? d.p + d.q * d.r : (d.p - d.q) * d.r + d.s,
  distributiveExpand: d => d.a * d.b + d.a * d.c,
  distributiveFactor: d => d.a * (d.b + d.c),
  associativeRegroup: d => d.x * d.y * d.z,
  commutativeCheck: d => d.m - d.n,
  mixedOrderWord: d => d.p * d.q + d.r,
  areaRect: d => d.base * d.height,
  decimalDivide: d => (d.qt * d.k / 10) / d.k,
  avgCalc: d => d.nums.reduce((a, b) => a + b, 0) / d.nums.length
};
/* 選項的上限從產生器自己的參數範圍推出來（最大的那個候選 ＋ 保底最多往外找幾步），不是隨手給的大數：
   orderEval (p+q)×r ≤ 18×9＝162；distributiveExpand a×b×c ≤ 9³＝729；distributiveFactor a×(b+c) ≤ 9×20＝180；
   associativeRegroup 125×8×9＝9000；commutativeCheck m+n ≤ 45+10＝55；mixedOrderWord p×(q+r) ≤ 9×49＝441；
   areaRect 底×高×2 ≤ 15×10×2＝300；decimalDivide 商×2 ≤ 8.9×2＝17.8；avgCalc 總和 ≤ 25×5＝125。 */
const SIM_MAX = { orderEval:170, distributiveExpand:740, distributiveFactor:190, associativeRegroup:9010, commutativeCheck:60, mixedOrderWord:450, areaRect:310, decimalDivide:20, avgCalc:130 };

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲「湊整數大挑戰」—— 引擎與計分 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['order', 'swap', 'group', 'cut', 'join'];", replace:"var GAME_ORDER = ['swap', 'order', 'group', 'cut', 'join'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 44;' },
    { file:'index', expect:'shuffle(): only', find:'      var k = Math.floor(Math.random() * (j + 1));   /* 自足', replace:'      var k = j;   /* 自足' },
    { file:'index', expect:'the tray starts in box order', find:'    if (sorted) t.reverse();\n', replace:'' },
    { file:'index', expect:'scoring: a round should give', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'GAME bonus: round', find:'bonus = last && !gAnyMistake;', replace:'bonus = last;' },
    { file:'index', expect:'GAME bonus: round', find:'    if (bonus) gScore += 20;\n', replace:'' },
    { file:'index', expect:'record the mistake', find:'    gMistake = true; gAnyMistake = true;', replace:'    gMistake = true;' },
    { file:'index', expect:'restartGame() does not clear gAnyMistake', find:'gScore = 0; gAnyMistake = false; elScore', replace:'gScore = 0; elScore' },
    { file:'index', expect:'GAME bonus: the clean-run bonus line is missing', find:'var tail = last ? L().gWin(gScore, bonus) : L().gClear;', replace:'var tail = last ? L().gWin(gScore, false) : L().gClear;' },
    { file:'index', expect:'gWin zh', find:"return bonus ? ('五關全破，而且一次都沒放錯，再加 20 分！總分 ' + s + ' 分 🏆')", replace:"return bonus ? ('五關全破，而且一次都沒放錯！總分 ' + s + ' 分 🏆')" },
    { file:'index', expect:'gWin en', find:"Press “Restart” and try a run with no wrong moves (+20 bonus).", replace:"Press “Restart” and try a run with no wrong moves." },
    { file:'index', expect:'s6lead zh', find:"五關都沒放錯，最後再加 20 分。'", replace:"'" },
    { file:'index', expect:'s6lead en', find:" Clear all five without a wrong move for a 20-point bonus.'", replace:"'" },
    { file:'index', expect:'gWin zh', find:"按「重新開始」，挑戰一次都不放錯（再加 20 分）。", replace:"按「重新開始」，挑戰一次都不放錯。" },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'does not clear the hint', find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:'index', expect:'nearestOpen(): a point inside the big box', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'it must pick the nearest, not the first', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestOpen(): a drop nearest to a finished slot', find:"    return best && !best.done ? best : null;\n  }", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }" },
    { file:'index', expect:'board generation', find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:'' },
    { file:'index', expect:'second finger', find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:'index', expect:'losing pointer capture', find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:'' },
    { file:'index', expect:'placed pieces still catch taps', find:'  .gpiece.locked{cursor:default;pointer-events:none}', replace:'  .gpiece.locked{cursor:default}' },
    { file:'index', expect:'does not snap', find:"      if (o.axis === 'x') P.place(o.snapX(orig.x + dx), orig.y);", replace:"      if (o.axis === 'x') P.place(orig.x + dx, orig.y);" },
    { file:'index', expect:'ahead mode', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", replace:"    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式" },
    { file:'index', expect:'does not clear the stage', find:"    gameStage.textContent = '';\n", replace:'' },

    /* 第 1 關：先算誰 */
    { file:'index', expect:'cannot be worked out yet, but stepWhy() accepts it', find:"    if (i - 2 >= g.gs && OPS[tk[i - 2]] === 1) return chain(tk, { kind:'muldiv',", replace:"    if (false) return chain(tk, { kind:'muldiv'," },
    { file:'index', expect:'cannot be worked out yet, but stepWhy() accepts it', find:"      if (i - 2 >= g.gs && OPS[tk[i - 2]] === 1){\n        var j = i - 2;", replace:"      if (false){\n        var j = i - 2;" },
    { file:'index', expect:'cannot be worked out yet, but stepWhy() accepts it', find:"      else if (depth === 0 && OPS[tk[k]] === 0)\n", replace:"      else if (false)\n" },
    { file:'index', expect:'can be worked out now, but stepWhy() refuses it', find:"    if (i + 2 <= g.ge && OPS[tk[i + 2]] === 1) return chain(tk, { kind:'muldiv',", replace:"    if (i + 2 <= g.ge && OPS[tk[i + 2]] >= 0) return chain(tk, { kind:'muldiv'," },
    { file:'index', expect:'GAME order: working out', find:"    if (out[j - 1] === '(' && out[j + 1] === ')') out = out.slice(0, j - 1).concat([v], out.slice(j + 2));", replace:"" },
    { file:'index', expect:'first gives the same answer, but the game refuses it', find:"'15 − 7 + 2 × 3'", replace:"'15 + 7 − 2 × 3'" },
    { file:'index', expect:'pool B', find:"'30 − 10 − 5 × 2'", replace:"'30 − ( 10 − 5 ) × 2'" },
    { file:'index', expect:'has no parentheses', find:"var GAME_STEP_A = ['4 × ( 3 + 2 ) − 6',", replace:"var GAME_STEP_A = ['4 × 3 + 2 − 6'," },
    { file:'index', expect:'not a whole number of 0 or more', find:"'20 − ( 6 + 4 ) ÷ 2'", replace:"'2 − ( 6 + 4 ) ÷ 2'" },
    { file:'index', expect:'never needs "left to right"', find:"'18 − 6 ÷ 3 + 1'", replace:"'2 × 3 + 4 × 5'" },
    { file:'index', expect:'operation button (width)', find:'h:48, opW:46, parW:14,', replace:'h:48, opW:40, parW:14,' },
    { file:'index', expect:'a log line is', find:'logY:52, logH:28,', replace:'logY:52, logH:26,' },
    { file:'index', expect:'it does not fit the board', find:'parW:14, digW:13, numPad:10,', replace:'parW:14, digW:20, numPad:10,' },
    { file:'index', expect:'the operation judged is not the one tapped', find:'var tk = rows[r], w = stepWhy(tk, i);', replace:'var tk = rows[r], w = stepWhy(tk, firstReady(tk));' },
    { file:'index', expect:'tapping the same blocked operation again costs again', find:'          if (lastBad === key) return;', replace:'          if (false) return;' },
    { file:'index', expect:'order why', find:"'：先乘除、後加減 —— ' + at + ' 旁邊的 '", replace:"'：先乘除、後加減 —— ' + y + ' 旁邊的 '" },
    { file:'index', expect:'order why', find:"' sits next to parentheses — work out ' + inner + ' inside them first.'", replace:"' sits next to parentheses — work out the inside first.'" },
    { file:'index', expect:'must say "由左而右"', find:"'：同一層要由左而右 —— '", replace:"'：同一層要由右而左 —— '" },
    { file:'index', expect:'gOrderLog en', find:"gOrderLog: function(x, op, y, v){ return x + ' ' + op + ' ' + y + ' = ' + v; },", replace:"gOrderLog: function(x, op, y, v){ return x + ' ' + op + ' ' + y + ' = ' + (v + 1); }," },
    { file:'index', expect:'order why', find:"    if (w.kind === 'muldiv') return d.gOrderWhy.muldiv(", replace:"    if (w.kind === 'muldiv') return d.gOrderWhy.ltr(" },
    { file:'index', expect:'gOrder2', find:"gOrder2: function(x, op, y){ return '提示 2：現在可以算 ' + x + ' ' + op + ' ' + y + '。'; },", replace:"gOrder2: function(x, op, y){ return '提示 2：現在可以算 ' + y + ' ' + op + ' ' + x + '。'; }," },

    /* 第 2 關：換位置 */
    { file:'index', expect:'GAME swap s2: marked', find:"s2:{ a:'{4} × {7}', b:'{7} × {4}', s:'×' }", replace:"s2:{ a:'{4} × {7}', b:'{7} × {4}', s:null }" },
    { file:'index', expect:'the two marked groups are not swapped', find:"d1:{ a:'20 − {8} + {2}', b:'20 − {2} + {8}', s:null }", replace:"d1:{ a:'20 − {8} + {2}', b:'20 − {2} + {9}', s:null }" },
    { file:'index', expect:'not a whole number of 0 or more', find:"s5:{ a:'20 − {4} × {3}', b:'20 − {3} × {4}', s:'×' }", replace:"s5:{ a:'10 − {4} × {3}', b:'10 − {3} × {4}', s:'×' }" },
    { file:'index', expect:'the two swapped are not the two sides of one', find:"s7:{ a:'{15} + {8} − 3', b:'{8} + {15} − 3', s:'+' }", replace:"s7:{ a:'{15} + {8} − 3', b:'{8} + {15} − 3', s:'×' }" },
    { file:'index', expect:'three same-answer and three different-answer', find:"['s2', 's3', 's8', 'd4', 'd6', 'd8']", replace:"['s2', 's3', 's8', 's4', 'd6', 'd8']" },
    { file:'index', expect:'swapKind() is wrong', find:"function swapKind(c){ var v = swapVals(c); return v[0] === v[1] ? 'same' : 'diff'; }", replace:"function swapKind(c){ var v = swapVals(c); return v[0] <= v[1] ? 'same' : 'diff'; }" },
    { file:'index', expect:'the wrong box is accepted', find:"    if (k === bin) return null;\n    return k === 'same'", replace:"    if (true) return null;\n    return k === 'same'" },
    { file:'index', expect:'the box judged is not the one', find:'why = swapWhy(d, c, bin.kind);', replace:"why = swapWhy(d, c, 'same');" },
    { file:'index', expect:'gBinsSwap.same zh', find:"gBinsSwap: { same:'答案一樣', diff:'答案不一樣' },", replace:"gBinsSwap: { same:'答案不一樣', diff:'答案一樣' }," },
    { file:'index', expect:'catch zones should overlap', find:'slotPad:2, pad:8,', replace:'slotPad:2, pad:1,' },
    { file:'index', expect:'sits on a box', find:'trayY:[236, 298, 360] }', replace:'trayY:[186, 298, 360] }' },
    { file:'index', expect:'sits on a box', find:'lblH:34, slotH:46, slotGap:4,', replace:'lblH:34, slotH:56, slotGap:4,' },   /* 箱子跟著格子長高，壓到托盤 */
    { file:'index', expect:'swapHtml()', find:".replace(/\\{/g, '<b class=\"gsw\">')", replace:".replace(/\\{/g, '<b>')" },
    { file:'index', expect:'must say "Actually the same"', find:"return 'Actually the same: ' + a", replace:"return 'Not the same: ' + a" },
    { file:'index', expect:'swapWhy', find:"'不一樣：' + a + ' ＝ ' + va + '，' + b + ' ＝ ' + vb + ' —— 換的兩個", replace:"'不一樣：' + a + ' ＝ ' + va + '，' + b + ' ＝ ' + (vb + 1) + ' —— 換的兩個" },
    /* codex 第一輪 */
    { file:'index', expect:'a mistake ends the round', find:'    gMistake = true; gAnyMistake = true;\n    var lost', replace:'    gMistake = true; gAnyMistake = true; gSolved = true;\n    var lost' },
    { file:'index', expect:'order why', find:"  function chain(tk, w, j, bare){ if (!bare && stepWhy(tk, j, true)){ var t = nowText(tk, j, 1); if (t) w.inner = t; } return w; }", replace:"  function chain(tk, w, j, bare){ return w; }" },
    { file:'index', expect:'order why (chained)', find:"'；可是它自己也還要等，現在要先算 ' + inner + '。' : '。'); },", replace:"'。' : '。'); }," },
    { file:'index', expect:'a negative number in', find:"counterText: '8 − 3 ＝ 5，但 3 − 8 根本不夠減，兩個不一樣；", replace:"counterText: '8 − 3 ＝ 5，但 3 − 8 ＝ −5，兩個不一樣；" },
    { file:'index', expect:"a box's catch zone is not the drawn box", find:"hw:SWAP.binW / 2, hh:binH / 2, done:false };", replace:"hw:SWAP.binW / 4, hh:binH / 2, done:false };" },
    { file:'index', expect:"a number's catch zone is not the drawn tile", find:"hw:GROUP.tileW / 2, hh:GROUP.tileH / 2, done:false }; });", replace:"hw:GROUP.tileW / 4, hh:GROUP.tileH / 2, done:false }; });" },
    { file:'index', expect:"a blank's catch zone is not the drawn blank", find:"hw:c.w / 2, hh:JOIN.slotH / 2, done:false });", replace:"hw:c.w / 4, hh:JOIN.slotH / 2, done:false });" },
    { file:'index', expect:'blanks are not caught with JOIN.pad', find:'var s = nearestOpen(slots, pt, JOIN.pad);', replace:'var s = nearestOpen(slots, pt, 0);' },
    { file:'index', expect:'JOIN.pad is', find:'cardY:196, pad:10 }', replace:'cardY:196, pad:2 }' },
    { file:'index', expect:'reaches into blank', find:'cardY:196, pad:10 }', replace:'cardY:196, pad:30 }' },
    { file:'index', expect:'gOrder2 en: must say', find:"gOrder2: function(x, op, y){ return 'Hint 2: you can work out '", replace:"gOrder2: function(x, op, y){ return 'Hint 2: you cannot work out '" },
    { file:'index', expect:'gGroup2 zh: must read exactly', find:"' 的夥伴是 ' + y + '（'", replace:"' 的夥伴不是 ' + y + '（'" },
    /* codex 第二輪 */
    { file:'index', expect:'gGroup2 en: must read exactly', find:"' is ' + y + ': ' + x + ' ' + op + ' ' + y + ' = ' + v + '.'; },", replace:"' is ' + y + ', but it is definitely not its partner: ' + x + ' ' + op + ' ' + y + ' = ' + v + '.'; }," },
    { file:'index', expect:'gGroup2 zh: must read exactly', find:"' 的夥伴是 ' + y + '（'", replace:"' 的夥伴是第 ' + r + ' 列的 ' + y + '（'" },
    { file:'index', expect:'as the step to do now', find:"    if (!b) return tokText(tk.slice(j - 1, j + 2));", replace:"    if (!b) return tokText([tk[j - 1], '+', tk[j + 1]]);" },
    { file:'index', expect:'a negative number in', find:"why:'先算括號：8−3＝5；再算乘法：5×2＝10；最後加法：10＋4＝14。' },", replace:"why:'先算括號：8−3＝5；再算乘法：5×2＝10；最後加法：10＋4＝14（不是 ＝ −14）。' }," },
    { file:'index', expect:'gCut2 en: must not say', find:"'Hint 2: count 10 columns from the left and cut between", replace:"'Hint 2: do not count 10 columns from the left and cut between" },
    { file:'index', expect:'joinWhy commonInside zh', find:"commonInside: function(a){ return a + ' 兩項都有，要放到括號外面。'; },", replace:"commonInside: function(a){ return a + ' 兩項都有，要放到括號裡面，不是括號外面。'; }," },
    { file:'index', expect:'joinWhy double en', find:"', but both terms share the same ' + a + ' — it goes outside the parentheses only once.'", replace:"', but both terms share the same ' + a + ' — it goes outside the parentheses twice.'" },
    { file:'index', expect:'joinWhy minusOrder en', find:"' second. Subtraction cannot be swapped, so inside it is '", replace:"' second. Subtraction can be swapped, so inside it is '" },
    { file:'index', expect:'joinWhy notCommon zh', find:"notCommon: function(v){ return v + ' 只在其中一項裡 —— 括號外面要放兩項都有的那個數。'; },", replace:"notCommon: function(v){ return v + ' 只在其中一項裡 —— 括號外面隨便放一個數。'; }," },
    { file:'index', expect:'gJoin2 en: must not say', find:"gJoin2: function(a){ return 'Hint 2: the number both terms share is ' + a + '.'; },", replace:"gJoin2: function(a){ return 'Hint 2: the number both terms share is not ' + a + '.'; }," },
    { file:'review', expect:'a negative number in', find:"' 不夠減，減法沒有交換律，順序不能任意調換。'", replace:"' ＝ −' + (d.m - d.n) + '，減法沒有交換律，順序不能任意調換。'" },

    /* 第 3 關：先湊整數 */
    { file:'index', expect:'pairs make a round number', find:"{ op:'×', n:[9, 2, 5] }", replace:"{ op:'×', n:[4, 2, 5] }" },
    { file:'index', expect:'groupRefuse(', find:'  function groupRefuse(op, a, b){ var v = calc(a, op, b); return groupRound(v) ? null : v; }', replace:'  function groupRefuse(op, a, b){ var v = calc(a, op, b); return null; }' },
    { file:'index', expect:'the pair judged is not', find:'        var bad = groupRefuse(row.op, a, b);', replace:'        var bad = groupRefuse(row.op, a, a);' },
    { file:'index', expect:'can pair with a number of another row', find:'var list = rowTiles(P.data.r).filter(function(t){ return t !== P && !t.locked; })', replace:'var list = tiles.filter(function(t){ return t !== P && !t.locked; })' },
    { file:'index', expect:'partners apart', find:"[ { op:'×', n:[25, 13, 4] },  { op:'×', n:[7, 8, 5] },", replace:"[ { op:'×', n:[25, 4, 13] },  { op:'×', n:[7, 8, 5] }," },
    { file:'index', expect:'result line is', find:'resDy:30, resH:30, pad:8 }', replace:'resDy:30, resH:26, pad:8 }' },
    { file:'index', expect:'must say "不是整十、整百或整千"', find:"' ＝ ' + v + '，不是整十、整百或整千 —— 先算它", replace:"' ＝ ' + v + '，是整十、整百或整千 —— 先算它" },
    { file:'index', expect:'gGroupRes en', find:"gGroupRes: function(v, op, z, tot){ return '= ' + v + ' ' + op + ' ' + z + ' = ' + tot; },", replace:"gGroupRes: function(v, op, z, tot){ return '= ' + v + ' ' + op + ' ' + z + ' = ' + (tot + 1); }," },
    { file:'index', expect:'does not show the value it is judged by', find:"text:String(v), cls:'gcard gnumcard', data:{ r:r, j:j, v:v }", replace:"text:String(v + 1), cls:'gcard gnumcard', data:{ r:r, j:j, v:v }" },
    { file:'index', expect:'tap-then-tap does not pair two numbers of the same row', find:'if (S && S !== P && S.data.r === P.data.r){', replace:'if (S && S !== P){' },
    { file:'index', expect:'does not read "(a op b) op c"', find:"'grow', '(' + a + ' ' + row.op + ' ' + b + ') ' + row.op + ' ' + z);", replace:"'grow', a + ' ' + row.op + ' ' + b + ' ' + row.op + ' ' + z);" },

    /* 第 4 關：拆開乘 */
    { file:'index', expect:'cutOk(', find:'  function cutOk(n, k){ return k === 10 || n - k === 10; }', replace:'  function cutOk(n, k){ return k >= 10 || n - k === 10; }' },
    { file:'index', expect:'cutK() does not snap', find:'Math.round((x - cutX0(n)) / CUT.cell))); }', replace:'Math.floor((x - cutX0(n)) / CUT.cell))); }' },
    { file:'index', expect:'tapping column', find:'var c = Math.floor((x - cutX0(n)) / CUT.cell) + 1;', replace:'var c = Math.round((x - cutX0(n)) / CUT.cell) + 1;' },
    { file:'index', expect:'should be 11–19 columns', find:'[6, 16], [7, 14], [4, 13]]', replace:'[6, 16], [7, 20], [4, 13]]' },
    { file:'index', expect:'is outside the 300', find:'[6, 16], [7, 14], [4, 13]]', replace:'[6, 16], [7, 17], [4, 13]]' },   /* 17 直排畫不下（左邊的橫排數跑出畫板） */
    { file:'index', expect:'the start (10)', find:'  function cutStart(n){ return Math.floor(n / 2); }', replace:'  function cutStart(n){ return 10; }' },
    { file:'index', expect:'a column is', find:'var CUT = { cell:16,', replace:'var CUT = { cell:12,' },
    { file:'index', expect:'column count label is', find:'lblY:50, lblH:26,', replace:'lblY:50, lblH:22,' },
    { file:'index', expect:'the ↔, the column counts and the grid overlap', find:'y0:80, gripY:25,', replace:'y0:80, gripY:40,' },
    { file:'index', expect:'Cut judges something other', find:'        if (!cutOk(n, k)){', replace:'        if (!cutOk(n, cutStart(n))){' },
    { file:'index', expect:'gCutNo zh', find:"'，加起來也是 ' + tot + '，可是兩塊都不是 10 直排", replace:"'，加起來也是 ' + (tot + 1) + '，可是兩塊都不是 10 直排" },
    { file:'index', expect:'gCutYes en', find:"' = ' + pl + ' + ' + pr + ' = ' + tot + ' (the distributive law)'", replace:"' = ' + pl + ' + ' + pr + ' = ' + (tot - 1) + ' (the distributive law)'" },
    /* Tony 的決定（2026-10-11）：數學上對、只是不好算的一步，只提醒、不扣分 */
    { file:'index', expect:'a correct-but-not-easier pair must be a free reminder', find:'if (bad !== null){ roundNote(d.gGroupBad(a, row.op, b, bad)); return false; }', replace:'if (bad !== null){ roundMiss(d.gGroupBad(a, row.op, b, bad)); return false; }' },
    { file:'index', expect:'a correct-but-not-easier cut must be a free reminder', find:'          roundNote(d.gCutNo(a, k, n - k,', replace:'          roundMiss(d.gCutNo(a, k, n - k,' },
    { file:'index', expect:'the pieces do not follow the ↔', find:'if (nk !== k && !gSolved){ k = nk; clearNote(); draw(); }', replace:'if (nk !== k && !gSolved){ k = nk; clearNote(); }' },
    { file:'index', expect:'the column counts over the pieces', find:"lblR.textContent = String(n - k);", replace:"lblR.textContent = String(n);" },

    /* 第 5 關：合起來 */
    { file:'index', expect:'expected refused', find:"    if (q.op === '−' && ((slot === 'B' && v !== q.b) || (slot === 'C' && v !== q.c))) return 'minusOrder';\n", replace:'' },
    { file:'index', expect:'expected refused', find:"    if (v === q.a) return 'commonInside';", replace:"    if (false) return 'commonInside';" },
    { file:'index', expect:'all different', find:"{ a:7, b:12, c:8, op:'+', side:'L' }", replace:"{ a:4, b:12, c:8, op:'+', side:'L' }" },
    { file:'index', expect:'not a round ten', find:"{ a:9, b:15, c:5, op:'−', side:'L' }", replace:"{ a:9, b:15, c:6, op:'−', side:'L' }" },
    { file:'index', expect:'lays the three right cards out in blank order', find:"    if (keys[0] < keys[1] && keys[1] < keys[2]){ var x = t[pos[0]]; t[pos[0]] = t[pos[1]]; t[pos[1]] = x; }\n", replace:'' },
    { file:'index', expect:'does not fit with 2px to spare', find:'slotW:56, slotH:48, symW:28,', replace:'slotW:56, slotH:48, symW:24,' },
    { file:'index', expect:'the row reads', find:"['＝', '(', 'B', q.op, 'C', ')', '×', 'A']", replace:"['＝', 'A', '×', '(', 'B', q.op, 'C', ')']" },
    { file:'index', expect:'the blank judged is not', find:'why = joinWhy(q, s.id, v);', replace:"why = joinWhy(q, 'A', v);" },
    { file:'index', expect:'joinWhy double en', find:"double: function(v, a){ return v + ' = ' + a + ' + ' + a + ', but", replace:"double: function(v, a){ return v + ' = ' + a + ' + ' + v + ', but" },
    { file:'index', expect:'joinWhy otherOp zh', find:"(orig === '+' ? '相加' : '相減')", replace:"(orig === '+' ? '相減' : '相加')" },
    { file:'index', expect:'gJoinRes zh', find:"'＝ ' + inner + ' × ' + a + ' ＝ ' + tot; },", replace:"'＝ ' + inner + ' × ' + a + ' ＝ ' + (tot + 10); }," },
    { file:'index', expect:'a filled blank does not show the card', find:'        s.z.textContent = String(v);', replace:'        s.z.textContent = String(v + 1);' },

    /* 第一層提示的意思 */
    { file:'index', expect:'gHints.order en: must say "left to right"', find:"within the same level, left to right. Tap a sign", replace:"within the same level, right to left. Tap a sign" },
    { file:'index', expect:'gHints.join zh: must say', find:"a × b + a × c ＝ a × (b + c)。", replace:"a × b + a × c ＝ a × b + c。" },

    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'arithmetic is wrong', find:"why:'先乘除後加減：3 × 4 ＝ 12，5 ＋ 12 ＝ 17。' },", replace:"why:'先乘除後加減：3 × 4 ＝ 12，5 ＋ 12 ＝ 18。' }," },
    { file:'index', expect:'arithmetic is wrong', find:"= 100×35 + 2×35 = 3500 + 70 = 3570, which is easier", replace:"= 100×35 + 2×35 = 3500 + 70 = 3560, which is easier" },

    /* ---- review.html ---- */
    { file:'review', expect:'is copied straight out of the stem', find:"    (avoid || []).forEach(function(v){ seen[String(v)] = true; });\n", replace:'' },
    { file:'review', expect:'groups into a round number', find:"{ x:5, y:2 }, { x:5, y:6 }", replace:"{ x:5, y:2 }, { x:5, y:7 }" },
    { file:'review', expect:'orderEval A: value is not', find:'          var value = p + q * r;', replace:'          var value = (p + q) * r;' },
    { file:'review', expect:'dividend / quotient do not match', find:'        var q = round1(qt / 10);', replace:'        var q = round1(qt / 10 + 0.1);' },
    { file:'review', expect:'m − n is not positive', find:'pickUnused([12, 15, 18,', replace:'pickUnused([5, 15, 18,' },
    { file:'review', expect:'is above 310 for areaRect', find:'[base + height, (base + height) * 2, base * height * 2]', replace:'[base + height, (base + height) * 20, base * height * 2]' }
  ],

  sim: {
    INVARIANTS: {
      orderEval: d => {
        if (d.patt === 'A'){ if (!(d.p >= 2 && d.q >= 2 && d.r >= 2)) return 'orderEval A: a number below 2'; if (d.value !== d.p + d.q * d.r) return 'orderEval A: value is not p + q × r'; }
        else if (d.patt === 'B'){ if (!(d.q < d.p)) return 'orderEval B: (p − q) is not positive'; if (d.value !== (d.p - d.q) * d.r + d.s) return 'orderEval B: value is not (p − q) × r + s'; }
        else return 'orderEval: unknown pattern ' + d.patt;
      },
      distributiveExpand: d => { if (d.value !== d.a * (d.b + d.c)) return 'distributiveExpand: value is not a × (b + c)'; },
      distributiveFactor: d => { if (d.value !== d.a * d.b + d.a * d.c) return 'distributiveFactor: value is not a × b + a × c'; },
      associativeRegroup: d => {
        if (d.value !== d.x * d.y * d.z) return 'associativeRegroup: value is not x × y × z';
        if ((d.x * d.y) % 10 !== 0) return 'associativeRegroup: the hint says ' + d.x + ' × ' + d.y + ' groups into a round number, but it is ' + d.x * d.y;
      },
      commutativeCheck: d => { if (!(d.m > d.n)) return 'commutativeCheck: m − n is not positive'; if (d.value !== d.m - d.n) return 'commutativeCheck: value is not m − n'; },
      mixedOrderWord: d => { if (d.value !== d.p * d.q + d.r) return 'mixedOrderWord: value is not p × q + r'; },
      areaRect: d => { if (d.value !== d.base * d.height) return 'areaRect: value is not base × height'; },
      decimalDivide: d => {
        if (d.dividendTenths !== d.qt * d.k) return 'decimalDivide: the tenths are not qt × k';
        if (Math.abs(d.dividend * 10 - d.dividendTenths) > 1e-9 || Math.abs(d.q * 10 - d.qt) > 1e-9) return 'decimalDivide: dividend / quotient do not match their tenths';
      },
      avgCalc: d => {
        const s = d.nums.reduce((a, b) => a + b, 0);
        if (d.nums.length !== d.n || s !== d.sum || s !== d.avg * d.n) return 'avgCalc: the numbers do not average to ' + d.avg;
        if (d.nums.some(v => !(isInt(v) && v > 0))) return 'avgCalc: a number is not a positive whole number';
      }
    },
    expectedCorrect: (d, id) => {
      const v = SIM_EXPECT[id] ? SIM_EXPECT[id](d) : NaN;
      return id === 'decimalDivide' ? String(Math.round(v * 10) / 10) : String(v);
    },
    optionOk: function(s, id){
      if (id === 'decimalDivide'){
        if (!/^\d+(\.\d)?$/.test(s)) return 'option "' + s + '" is not a number with at most one decimal place';
      } else if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const v = Number(s);
      if (!(v > 0)) return 'option ' + s + ' is not positive';
      if (v > SIM_MAX[id]) return 'option ' + s + ' is above ' + SIM_MAX[id] + ' for ' + id;
    },
    /* simgen 掃題幹數字用 \d+，會把「23.4」切成 23 和 4 —— 小數題的選項「4」不是抄題幹（題幹是 23.4）。
       只放行「真的不是題幹上那兩個數」的值；真的抄到 dividend 或 k 照樣抓。 */
    /* 五年級沒有負數：渲染出來的題幹、選項、解釋都不可以出現負數（以前 commutativeCheck 的解釋寫「甚至是負數」）。
       「數 − 數」的減號先拿掉，剩下的減號後面接數字就是負數。 */
    renderCheck: function(d, q){
      const all = [q.stem, q.why].concat(q.opts.map(String)).join(' | ').replace(/<[^>]+>/g, ' ');
      if (/[−-]\s*\d/.test(all.replace(/([\d)])\s*[−-](?=\s*[\d(])/g, '$1 '))) return 'a negative number in "' + all.slice(0, 160) + '"';
    },
    stemEchoOk: { decimalDivide: (d, o) => [d.dividend, d.k].map(String).indexOf(String(o)) < 0 }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「湊整數大挑戰」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GPICK, shuffle, unsorted, OPS, isNum, isOp, toks, calc, tokText, stepWhy, stepDo, firstReady, evalTok, STEP, STEP_H, GAME_STEP_A, GAME_STEP_B, stepCellW, stepLayout, SWAP_KINDS, SWAP, SWAP_H, SWAP_CARDS, GAME_SWAP, swapVals, swapKind, swapTray, swapHtml, GROUP, GROUP_H, GAME_GROUP, groupRound, groupRefuse, groupPartner, CUT, CUT_H, GAME_CUT, cutX0, cutEdgeX, cutK, cutCol, cutOk, cutStart, JOIN, JOIN_H, GAME_JOIN, joinTop, joinDecoy, joinCards, joinLayout, joinWhy, orderWhyText, swapPlain, swapWhy, swapOkText, joinWhyText, joinKey, joinTray}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300, EPS = 1e-9;
      const EQ = { zh:'＝', en:'=' };
      const arith = makeArith({ units:['元', '支', '包', '盒', '瓶', '件', '枝', '個', '班', '分'], unitsEn:[] });
      /* 一段文字：沒有 undefined／NaN、英文沒有中文、算式全對、數字剛好是 want */
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        arith(s).problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
      };
      const has = (where, L, text, words) => { const s = String(text); words[L].forEach(w => { if (s.indexOf(w) < 0) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); words[L].forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 自己的算式樹先證明會響 --- */
      {
        const t = (s, v) => { let g; try { g = evalT(lex(s)); } catch (e){ g = 'error'; } if (g !== v) fail('self-test: ' + s + ' should be ' + v + ', got ' + g); };
        t('4 × ( 3 + 2 ) − 6', 14); t('20 ÷ 4 × 5 − 3', 22); t('30 − 10 − 5 × 2', 10); t('24 ÷ 6 ÷ 2 + 5', 7);
        if (readyOps(lex('4 × ( 3 + 2 ) − 6 ÷ 3')).join() !== '4,9') fail('self-test: readyOps(4 × (3 + 2) − 6 ÷ 3) should be the + and the ÷');
        if (siblingOp('{( 9 − 4 )} × {3}') !== '×' || siblingOp('20 − {8} + {2}') !== null || siblingOp('{15} + {8} − 3') !== '+') fail('self-test: siblingOp() is wrong');
        const bad = []; valStrict(parse(lex('3 − 8')), bad); if (!bad.length) fail('self-test: valStrict() lets a negative through');
      }

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的算式逐條重算 ---
         ⚠️ 兩種課文的寫法 lib/arith.js 讀不懂，先在這裡處理，不讓它們靜靜跳過：
           英文的「$105」—— 把錢號拿掉；英文 areaSplitLine 用好幾個空白隔開三條算式 —— 換成分號。
           五年級沒有負數：除了計分的「−5 分」，任何字串出現負數都是缺陷（課文原本寫「3 − 8 ＝ −5」，codex 第一輪後改成「不夠減」）。 */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s0]) => {
        let s = s0.replace(/\$(\d)/g, '$1').replace(/(\d) {2,}(\d)/g, '$1；$2');
        /* 減號前面是數或「)」＝ 減法；其他位置的減號後面接數字 ＝ 負數（「＝ −5」有空白也算；codex 第二輪） */
        if (/[−-]\s*\d/.test(s.replace(/^[−-]5 (分|points)$/, '').replace(/([\d)])\s*[−-](?=\s*[\d(])/g, '$1 '))) fail(where + ': a negative number in "' + s0 + '"');
        const r = arith(s);
        checkedEq += r.verified;
        r.problems.forEach(p => fail(where + ': ' + p));
      }));
      if (checkedEq < 80) fail('only ' + checkedEq + ' equations verified in the I18N strings — the arithmetic scan is not reading them');

      /* ================= 2. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：湊整數大挑戰');
      const ge = src.indexOf('  /* ---------- 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const fin = v => typeof v === 'number' && isFinite(v);
      const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && fin(o.w) && fin(o.h) && o.x >= -EPS && o.y >= -EPS && o.x + o.w <= W + EPS && o.y + o.h <= H + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); return; } };

      const TYPES = ['order', 'swap', 'group', 'cut', 'join'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, 4 backward), got ' + D.GAME_ORDER);
      tooSmall('GPICK', D.GPICK);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        order: { has:{ zh:['括號', '× ÷', '由左而右'], en:['parentheses', '× and ÷', 'left to right'] }, not:{ zh:['先加減'], en:['add first'] } },
        swap: { has:{ zh:['交換律', '+ 和 ×', '同一個'], en:['commutative', '+ and ×', 'one +'] }, not:{ zh:['− 和 ÷ 也'], en:['− and ÷ also'] } },
        group: { has:{ zh:['整十、整百或整千', '交換律'], en:['multiple of 10', 'commutative'] }, not:{ zh:['相鄰的'], en:['next to each other only'] } },
        cut: { has:{ zh:['分配律', '10 直排', '□ × 10'], en:['distributive', '10 columns', '□ × 10'] }, not:{ zh:['不一樣大'], en:['not the same'] } },
        join: { has:{ zh:['a × b + a × c ＝ a × (b + c)', '括號外面'], en:['a × b + a × c = a × (b + c)', 'outside the parentheses'] }, not:{ zh:['括號裡面放兩項都有'], en:['shared number goes inside'] } }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
          if (typeof a !== 'string' || !a) fail('GAME: gAsks.' + t + ' missing in ' + L); else say('gAsks.' + t, L, a, t === 'cut' ? [10] : (t === 'group' && L === 'en' ? [10, 40, 100, 1000] : []));   /* 英文寫「multiple of 10 (like 40, 100 or 1000)」 */
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h, { order:[1], swap:[1], group:L === 'en' ? [1, 10, 25, 4, 100] : [1, 25, 4], cut:[1, 10, 10], join:[1] }[t]); has('gHints.' + t, L, h, HINT_SEM[t].has); hasNot('gHints.' + t, L, h, HINT_SEM[t].not); }
        });
      });
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };

      /* --- 拖拉引擎與計分的保護（原始碼形狀） --- */
      need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
      need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
      need(null, /gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/, 'startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
      need(null, /if \(gen !== gGen\) return;/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
      need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
      need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      need(null, /if \(o\.axis === 'x'\) P\.place\(o\.snapX\(orig\.x \+ dx\), orig\.y\);/, 'the ↔ does not snap to a seam while it is dragged');
      need(null, /gameStage\.textContent = '';/, 'startRound() does not clear the stage before drawing');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      ['swap', 'cut', 'join'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      need('group', /B\.onTap = function\(P\)\{\s*var S = B\.selected;\s*if \(S && S !== P && S\.data\.r === P\.data\.r\)\{/, 'tap-then-tap does not pair two numbers of the same row');
      need('group', /if \(S\.busy\(\) \|\| S\.locked \|\| gSolved\) return;/, 'tap-then-tap pairs a number another finger is still dragging');
      need('group', /var list = rowTiles\(P\.data\.r\)\.filter\(function\(t\)\{ return t !== P && !t\.locked; \}\)/, 'a dropped number can pair with a number of another row');
      {
        const rs = extractFunction(gsrc, 'roundSolved');
        if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint — a level-2 hint stays on the solved board');
      }
      need(null, /var pts = gMistake \? 10 : 20;/, 'scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(gsrc, 'roundMiss');
        if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try { r = new Function('var gMistake = false, gAnyMistake = false, gSolved = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}, gNext = { disabled:true }; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake, any:gAnyMistake, solved:gSolved, next:gNext.disabled };')(); }
          catch (e){ return fail('GAME scoring: roundMiss() could not run: ' + e.message); }
          if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m || !r.any) fail('GAME scoring: roundMiss() does not show the reason or record the mistake (for this round and the whole run)');
          if (r.solved !== false || r.next !== true) fail('GAME scoring: a mistake ends the round (gSolved / Next changed) — a mistake must never end the game');
        });
      }
      {
        /* 全程沒放錯 +20：roundSolved() 真的跑；提醒（roundNote）不算錯，所以不會弄丟加碼 */
        const ssrc = extractFunction(gsrc, 'roundSolved');
        if (!ssrc) fail('GAME bonus: cannot find roundSolved()');
        else [[0, false, false, 20], [0, true, true, 10], [4, false, false, 40], [4, true, true, 10], [4, false, true, 20]].forEach(([round, mis, any, want]) => {
          let r;
          try {
            r = new Function('var gSolved = false, gScore = 0, gMistake = ' + mis + ', gAnyMistake = ' + any + ', gRound = ' + round + ', GAME_ORDER = [1,2,3,4,5];' +
              'var gameStage = { querySelectorAll:function(){ return []; } }, elScore = {}, gHintBtn = {}, elHint = { textContent:"old hint" }, gMsg = {}, gNext = { disabled:true };' +
              'function L(){ return { gPts:function(p){ return "+" + p; }, gWin:function(s, b){ return "WIN" + s + (b ? "B" : ""); }, gClear:"CLEAR" }; }\n' + ssrc +
              '\nroundSolved("ok"); return { s:gScore, html:gMsg.innerHTML };')();
          } catch (e){ return fail('GAME bonus: roundSolved() could not run: ' + e.message); }
          if (r.s !== want) fail('GAME bonus: round ' + (round + 1) + (mis ? ' with' : ' without') + ' mistakes' + (any ? ' (earlier mistakes in the run)' : '') + ' gives ' + r.s + ', expected ' + want);
          if (round === 4 && /B/.test(r.html) !== (!any)) fail('GAME bonus: the clean-run bonus line is ' + (any ? 'shown after mistakes' : 'missing'));
        });
        if (!/function restartGame\(\)\{[^}]*gAnyMistake = false;/.test(gsrc)) fail('GAME bonus: restartGame() does not clear gAnyMistake — the next run starts without its bonus chance');
        LANGS.forEach(L => {
          if (nums(I18N[L].s6lead).join() !== '20') fail('GAME s6lead ' + L + ' should state the 20-point clean-run bonus (and no other number): ' + I18N[L].s6lead);
        });
        LANGS.forEach(L => {
          if (nums(I18N[L].gWin(120, true)).indexOf(20) < 0) fail('GAME gWin ' + L + ' does not name the 20-point bonus');
          if (nums(I18N[L].gWin(85, false)).indexOf(20) < 0) fail('GAME gWin ' + L + ' (no bonus) does not invite a run for the 20-point bonus');
        });
      }
      if (/function roundNote\(text\)\{[^}]*(gMistake|gAnyMistake|gScore)/.test(gsrc)) fail('GAME: roundNote() changes the score or records a mistake');
      LANGS.forEach(L => {
        const d = I18N[L];
        if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
        if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
        say('gWin', L, d.gWin(85, false), [85, 20]);
        say('gWin bonus', L, d.gWin(120, true), [20, 120]);
        say('gClear', L, d.gClear, []);
        if (d.gEq !== EQ[L]) fail('GAME gEq ' + L + ' should be "' + EQ[L] + '"');
      });

      /* --- shuffle()：切出來真的跑；托盤不可以一開始就照答案排好 --- */
      {
        let shuffleFn = null;
        const fsrc = extractFunction(src, 'shuffle');
        if (!fsrc) fail('GAME: cannot find shuffle() in index.html');
        else { try { shuffleFn = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('GAME: shuffle() could not be evaluated: ' + e.message); } }
        if (shuffleFn){
          const seen = new Set();
          for (let i = 0; i < 400; i++){
            const a = [1, 2, 3, 4], r = shuffleFn(a);
            if (r.slice().sort().join() !== '1,2,3,4' || a.join() !== '1,2,3,4'){ fail('GAME shuffle(): not a permutation of its input (or it changed the input)'); break; }
            seen.add(r.join());
          }
          if (seen.size < 20) fail('GAME shuffle(): only ' + seen.size + ' of 24 orders in 400 draws — it does not really shuffle');
        }
      }

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(gsrc, 'nearestOpen');
        if (!fsrc) fail('GAME: cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const two = [{ id:0, cx:60, cy:100, hw:60, hh:40, done:false }, { id:1, cx:140, cy:100, hw:20, hh:20, done:false }];
          const r0 = nearestOpen(two, { x:115, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('GAME nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const side = [{ id:0, cx:76, cy:100, hw:72, hh:94, done:false }, { id:1, cx:224, cy:100, hw:72, hh:94, done:false }];
          const r1 = nearestOpen(side, { x:154, y:100 }, 8);
          if (!r1 || r1.id !== 1) fail('GAME nearestOpen(): a drop inside the second box, within the first box\'s pad, goes to the first box (it must pick the nearest, not the first)');
          const done = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:true }, { id:1, cx:144, cy:100, hw:20, hh:20, done:false }];
          if (nearestOpen(done, { x:119, y:100 }, 6) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('GAME nearestOpen(): a drop far from every slot is accepted');
          const edge = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:false }];
          if (!nearestOpen(edge, { x:125.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop inside the pad is refused');
          if (nearestOpen(edge, { x:126.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop outside the pad is accepted');
        }
      }

      /* --- 每一個收件目標的範圍 ＝ 畫出來的那一塊（一半寬、一半高）＋ 正的 pad（codex 第一輪） --- */
      need('swap', /return \{ kind:kind, i:i, n:0, cx:SWAP\.binX\[i\] \+ SWAP\.binW \/ 2, cy:SWAP\.binY \+ binH \/ 2, hw:SWAP\.binW \/ 2, hh:binH \/ 2, done:false \};/, 'a box\'s catch zone is not the drawn box');
      need('swap', /addZone\(B, SWAP\.binX\[i\], SWAP\.binY, SWAP\.binW, binH, 'gbin'\);/, 'the drawn box is not the box judged');
      need('swap', /var bin = nearestOpen\(bins, pt, SWAP\.pad\);/, 'boxes are not caught with SWAP.pad');
      need('group', /\{ P:t, cx:t\.homeX, cy:t\.homeY, hw:GROUP\.tileW \/ 2, hh:GROUP\.tileH \/ 2, done:false \}/, 'a number\'s catch zone is not the drawn tile');
      need('group', /var t = nearestOpen\(list, pt, GROUP\.pad\);/, 'numbers are not caught with GROUP.pad');
      need('join', /var z = addZone\(B, c\.x, JOIN\.rowY, c\.w, JOIN\.slotH, 'gblank'\);\s*slots\.push\(\{ id:c\.t, z:z, cx:c\.x \+ c\.w \/ 2, cy:JOIN\.rowY \+ JOIN\.slotH \/ 2, hw:c\.w \/ 2, hh:JOIN\.slotH \/ 2, done:false \}\);/, 'a blank\'s catch zone is not the drawn blank');
      need('join', /var s = nearestOpen\(slots, pt, JOIN\.pad\);/, 'blanks are not caught with JOIN.pad');
      [['SWAP', D.SWAP.pad], ['GROUP', D.GROUP.pad], ['JOIN', D.JOIN.pad]].forEach(([n, p]) => { if (!(p >= 6)) fail('GAME ' + n + '.pad is ' + p + ' — a drop just outside the drawn edge must still count'); });
      {
        /* 相鄰兩格放寬之後不可以蓋到另一格畫出來的地方（不然放在 B 上會被判給 A） */
        const J = D.JOIN;
        D.GAME_JOIN.slice(0, 2).forEach(q => { const sl = D.joinLayout(q).filter(c => 'ABC'.indexOf(c.t) >= 0); for (let i = 0; i + 1 < sl.length; i++) if (sl[i].x + sl[i].w + J.pad > sl[i + 1].x + EPS) fail('GAME join: blank ' + sl[i].t + '\'s catch zone reaches into blank ' + sl[i + 1].t); });
        if (D.GROUP.x[1] - D.GROUP.x[0] - D.GROUP.tileW < D.GROUP.pad) fail('GAME group: a number\'s catch zone reaches into its neighbour');
      }

      /* ================= 第 1 關：先算誰 ================= */
      {
        const S = D.STEP;
        tooSmall('order: an operation button (width)', S.opW); tooSmall('order: an operation button (height)', S.h);
        const allA = D.GAME_STEP_A, allB = D.GAME_STEP_B;
        if (!(allA.length >= 5 && allB.length >= 5)) fail('GAME order: each pool needs at least 5 expressions');
        if (new Set(allA.concat(allB)).size !== allA.length + allB.length) fail('GAME order: an expression appears twice');
        if (S.rowY[0] + S.logY + 3 * S.logH > S.rowY[1] + EPS) fail('GAME order: row 1\'s three log lines run into row 2');
        if (S.rowY[1] + S.logY + 3 * S.logH > D.STEP_H + EPS) fail('GAME order: row 2\'s three log lines run off the board');
        if (S.logH < 28) fail('GAME order: a log line is ' + S.logH + ' tall — the text does not fit with 2px to spare');
        need('order', /var tk = rows\[r\], w = stepWhy\(tk, i\);/, 'the operation judged is not the one tapped');
        need('order', /b\.type = 'button'; b\.className = 'gop'; b\.textContent = t;[\s\S]{0,200}b\.addEventListener\('click', function\(\)\{ act\(r, i, b\); \}\);/, 'an operation button does not show the operation it works out');
        need('order', /if \(lastBad === key\) return;/, 'tapping the same blocked operation again costs again');
        need('order', /var rows = \[toks\(pick\(GAME_STEP_A\)\), toks\(pick\(GAME_STEP_B\)\)\]/, 'the two rows are not one A (parentheses) and one B (left to right)');
        let states = 0, blocked = 0, chained = 0, kinds = { paren:0, muldiv:0, ltr:0 };
        const visit = (tk, where, seen) => {
          const key = tk.join(' ');
          if (seen.has(key)) return; seen.add(key);
          states++;
          const L = D.stepLayout(tk), wsum = L.reduce((a, c) => a + c.w, 0);
          if (!(L[0].x >= 2 && L[L.length - 1].x + L[L.length - 1].w <= W - 2)) fail('GAME order: "' + key + '" is ' + wsum + ' wide — it does not fit the board');
          tk.forEach((t, i) => { if (typeof t === 'number' && L[i].w < 10 + 13 * String(t).length - EPS) fail('GAME order: the cell for ' + t + ' is too narrow'); });
          const ready = readyOps(tk);
          tk.forEach((t, i) => {
            if (!D.isOp(t)) return;
            const pw = D.stepWhy(tk, i), mine = ready.indexOf(i) >= 0;
            if (mine && pw) fail('GAME order: in "' + key + '" the ' + t + ' can be worked out now, but stepWhy() refuses it (' + pw.kind + ')');
            if (!mine && !pw) fail('GAME order: in "' + key + '" the ' + t + ' cannot be worked out yet, but stepWhy() accepts it');
            if (!mine){
              blocked++;
              const ref = whyRef(tk, i);
              if (pw && ref && pw.kind !== ref.kind) fail('GAME order: in "' + key + '" the ' + t + ' is refused as ' + pw.kind + ', expected ' + ref.kind);
              if (ref) kinds[ref.kind]++;
              if (pw && ref && ref.chained && String(pw.inner).replace(/[()]/g, '').replace(/\s+/g, ' ').trim() !== ref.step) fail('GAME order: in "' + key + '" the reason for ' + t + ' names "' + pw.inner + '" as the step to do now, expected "' + ref.step + '"');
              if (pw && ref && ref.chained){ chained++; LANGS.forEach(Lg => has('order why (chained) ' + key, Lg, D.orderWhyText(I18N[Lg], pw), { zh:['也還要等，現在要先算'], en:['has to wait too, so first work out'] })); }
              /* 被擋下的「兩邊都是數」的那一步，先算它真的會讓答案變 —— 不可以擋掉其實無害的一步 */
              if (typeof tk[i - 1] === 'number' && typeof tk[i + 1] === 'number'){
                let naive = null;
                try { naive = val(parse(tk.slice(0, i - 1).concat([ap(tk[i - 1], t, tk[i + 1])], tk.slice(i + 2)))); } catch (e){ naive = 'error'; }
                if (naive === evalT(tk)) fail('GAME order: in "' + key + '" working out ' + tk[i - 1] + ' ' + t + ' ' + tk[i + 1] + ' first gives the same answer, but the game refuses it');
              }
              if (pw && ref) LANGS.forEach(Lg => say('order why ' + key + ' @' + i, Lg, D.orderWhyText(I18N[Lg], pw), ref.nums));
              if (pw && ref) LANGS.forEach(Lg => has('order why ' + key, Lg, D.orderWhyText(I18N[Lg], pw), { paren:{ zh:['括號'], en:['parentheses'] }, muldiv:{ zh:['先乘除'], en:['multiply and divide come before'] }, ltr:{ zh:['由左而右'], en:['left to right'] } }[ref.kind]));
            } else {
              const out = D.stepDo(tk, i), want = collapse(tk, i);
              if (out.join(' ') !== want.join(' ')) fail('GAME order: working out ' + t + ' in "' + key + '" gives "' + out.join(' ') + '", expected "' + want.join(' ') + '"');
              const v = ap(tk[i - 1], t, tk[i + 1]);
              if (!(isInt(v) && v >= 0)) fail('GAME order: "' + key + '": ' + tk[i - 1] + ' ' + t + ' ' + tk[i + 1] + ' is ' + v + ' — not a whole number of 0 or more');
              LANGS.forEach(Lg => say('gOrderLog', Lg, I18N[Lg].gOrderLog(tk[i - 1], t, tk[i + 1], v), [tk[i - 1], tk[i + 1], v]));
              if (out.length > 1) visit(want, where, seen);
            }
          });
          if (tk.length > 1){
            const fr = D.firstReady(tk);
            if (ready.indexOf(fr) < 0) fail('GAME order: firstReady("' + key + '") is not an operation that can be worked out');
            else LANGS.forEach(Lg => { const t2 = I18N[Lg].gOrder2(tk[fr - 1], tk[fr], tk[fr + 1]); say('gOrder2', Lg, t2, [2, tk[fr - 1], tk[fr + 1]]); has('gOrder2', Lg, t2, { zh:['現在可以算'], en:['you can work out'] }); hasNot('gOrder2', Lg, t2, { zh:['不可以', '還不能'], en:['cannot', 'not yet'] }); });
          }
        };
        [['A', allA], ['B', allB]].forEach(([nm, pool]) => pool.forEach(s => {
          const tk = D.toks(s);
          if (tk.join(' ') !== lex(s).join(' ')) fail('GAME order: toks("' + s + '") reads it wrong');
          if (tk.filter(t => LV.hasOwnProperty(t)).length !== 3) fail('GAME order: "' + s + '" should have three operations');
          if (nm === 'A' && tk.indexOf('(') < 0) fail('GAME order: pool A "' + s + '" has no parentheses');
          if (nm === 'B' && tk.indexOf('(') >= 0) fail('GAME order: pool B "' + s + '" has parentheses');
          if (nm === 'B' && !tk.some((t, i) => LV.hasOwnProperty(t) && whyRef(tk, i) && whyRef(tk, i).kind === 'ltr' && readyOps(tk).indexOf(i) < 0) && !(function(){ let ok = false; const seen = new Set(); (function w(t){ if (ok || seen.has(t.join())) return; seen.add(t.join()); t.forEach((x, i) => { if (LV.hasOwnProperty(x)){ const r = whyRef(t, i); if (r && r.kind === 'ltr' && readyOps(t).indexOf(i) < 0) ok = true; } }); readyOps(t).forEach(i => { const o = collapse(t, i); if (o.length > 1) w(o); }); })(tk); return ok; })())
            fail('GAME order: pool B "' + s + '" never needs "left to right"');
          const bad = []; const v = valStrict(parse(tk), bad);
          if (bad.length) fail('GAME order: "' + s + '" has a step that is not a whole number of 0 or more (' + bad + ')');
          if (D.evalTok(tk) !== v) fail('GAME order: evalTok("' + s + '") is ' + D.evalTok(tk) + ', expected ' + v);
          visit(tk, s, new Set());
          LANGS.forEach(Lg => say('gOrderRow', Lg, I18N[Lg].gOrderRow(1, D.tokText(tk), v), [1].concat(tk.filter(t => typeof t === 'number'), [v])));
        }));
        if (!chained) fail('GAME order: no reason ever has to send the child into the parentheses first — the chained case is not exercised');
        if (!(kinds.paren > 0 && kinds.muldiv > 0 && kinds.ltr > 0)) fail('GAME order: the pools never block for one of the three reasons: ' + JSON.stringify(kinds));
        if (states < 3 * (allA.length + allB.length)) fail('GAME order: only ' + states + ' states visited — every expression has at least three (start, after one step, after two)');
        LANGS.forEach(Lg => { say('gOrderNow', Lg, I18N[Lg].gOrderNow(1, 2), [1, 2]); say('gOrderDone', Lg, I18N[Lg].gOrderDone, []); });
      }

      /* ================= 第 2 關：換位置 ================= */
      {
        const S = D.SWAP, binH = S.lblH + 3 * (S.slotH + S.slotGap) + S.slotGap;
        if (D.SWAP_KINDS.join() !== 'same,diff') fail('GAME swap: the boxes should be same, diff');
        const bins = [0, 1].map(i => ({ x:S.binX[i], y:S.binY, w:S.binW, h:binH }));
        bins.forEach((b, i) => inside(b, 'swap box ' + i, D.SWAP_H));
        noHits(bins, 'swap boxes');
        const gap = S.binX[1] - (S.binX[0] + S.binW);
        if (!(gap >= 0 && gap < 2 * S.pad)) fail('GAME swap: the two boxes\' catch zones should overlap across the ' + gap + 'px gap (pad ' + S.pad + ') — the nearest-box rule is what the e2e tests there');
        const tray = [];
        for (let j = 0; j < 6; j++) tray.push(sq(S.trayX[j % 2], S.trayY[Math.floor(j / 2)], S.cardW, S.cardH));
        tray.forEach((c, j) => { inside(c, 'swap card ' + j, D.SWAP_H); bins.forEach(b => { if (hit(c, b)) fail('GAME swap: card ' + j + ' sits on a box'); }); });
        noHits(tray, 'swap cards');
        tooSmall('swap card height', S.cardH);
        /* 箱子的高度是從三格算出來的（lblH ＋ 3 格），所以放好的卡一定在箱子裡；格子太高的話箱子會壓到托盤 —— 上面那條會響 */
        if (!(S.slotH >= 44 && S.binW - 2 * S.slotPad >= S.cardW)) fail('GAME swap: a placed card is smaller than the card itself');
        need('swap', /var c = SWAP_CARDS\[P\.data\.id\], why = swapWhy\(d, c, bin\.kind\);/, 'the box judged is not the one the card was dropped in');
        need('swap', /P\.el\.innerHTML = cardHtml\(SWAP_CARDS\[id\]\);/, 'a card does not show the expressions it is judged by');
        need('swap', /addZone\(B, SWAP\.binX\[i\] \+ 6, SWAP\.binY \+ 4, SWAP\.binW - 12, SWAP\.lblH - 6, 'gbinlbl', d\.gBinsSwap\[kind\]\);\s*return \{ kind:kind, i:i,/, 'a box does not show the label of the kind it is judged as');
        const LBL = { zh:{ same:'答案一樣', diff:'答案不一樣' }, en:{ same:'Same answer', diff:'Different answer' } };
        LANGS.forEach(L => ['same', 'diff'].forEach(k => { if (I18N[L].gBinsSwap[k] !== LBL[L][k]) fail('GAME gBinsSwap.' + k + ' ' + L + ' should read "' + LBL[L][k] + '"'); }));
        Object.keys(D.SWAP_CARDS).forEach(id => {
          const c = D.SWAP_CARDS[id], ga = braces(c.a), gb = braces(c.b);
          if (ga.length !== 2 || gb.length !== 2){ fail('GAME swap ' + id + ': each side needs exactly two {…} groups'); return; }
          if (ga[0] !== gb[1] || ga[1] !== gb[0]) fail('GAME swap ' + id + ': the two marked groups are not swapped ({' + ga + '} → {' + gb + '})');
          const swapped = c.a.replace(/\{([^{}]*)\}/g, '\u0000').split('\u0000');
          if (swapped.length !== 3 || swapped[0] + '{' + ga[1] + '}' + swapped[1] + '{' + ga[0] + '}' + swapped[2] !== c.b) fail('GAME swap ' + id + ': the after-card is not the before-card with the two groups swapped');
          const badA = [], badB = [], va = valStrict(parse(lex(c.a)), badA), vb = valStrict(parse(lex(c.b)), badB);
          if (badA.length || badB.length) fail('GAME swap ' + id + ': a step is not a whole number of 0 or more (' + badA.concat(badB) + ')');
          const sib = siblingOp(c.a);
          if ((va === vb) !== (c.s !== null)) fail('GAME swap ' + id + ': marked ' + (c.s ? 'same' : 'different') + ' but ' + c.a + ' = ' + va + ', ' + c.b + ' = ' + vb);
          if (c.s !== null && sib !== c.s) fail('GAME swap ' + id + ': the two swapped are not the two sides of one ' + c.s + ' (' + sib + ')');
          if (c.s === null && (sib === '+' || sib === '×')) fail('GAME swap ' + id + ': a swap across one ' + sib + ' is marked different');
          if (sib === null && va === vb) fail('GAME swap ' + id + ': not a sibling swap but the answer stays — the card does not teach the law');
          const sv = D.swapVals(c);
          if (sv[0] !== va || sv[1] !== vb) fail('GAME swap ' + id + ': swapVals() is ' + sv + ', expected ' + [va, vb]);
          if (D.swapKind(c) !== (va === vb ? 'same' : 'diff')) fail('GAME swap ' + id + ': swapKind() is wrong');
          const pa = lex(c.a).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')'), pb = lex(c.b).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
          if (D.swapPlain(c.a) !== pa) fail('GAME swap ' + id + ': swapPlain() shows "' + D.swapPlain(c.a) + '", expected "' + pa + '"');
          const html = D.swapHtml(c.a);
          if (html.replace(/<[^>]+>/g, '') !== pa || (html.match(/<b class="gsw">/g) || []).length !== 2) fail('GAME swap ' + id + ': swapHtml() does not show the expression with the two moved groups in orange');
          const want = nums(pa).concat([va], nums(pb), [vb]);
          LANGS.forEach(L => {
            const d = I18N[L];
            ['same', 'diff'].forEach(bin => {
              const w = D.swapWhy(d, c, bin);
              if (bin === D.swapKind(c)){ if (w !== null) fail('GAME swap ' + id + ': the right box is refused'); return; }
              if (typeof w !== 'string'){ fail('GAME swap ' + id + ': the wrong box is accepted'); return; }
              say('swapWhy ' + id, L, w, want);
              has('swapWhy ' + id, L, w, c.s ? { zh:['其實一樣', '交換律', c.s], en:['Actually the same', 'commutative', c.s] } : { zh:['不一樣', '不能換'], en:['Not the same', 'cannot be swapped'] });
            });
            say('swapOkText ' + id, L, D.swapOkText(d, c), c.s ? nums(pa).concat(nums(pb), [va]) : want);
            say('gSwap2 ' + id, L, d.gSwap2(pa, va, pb, vb), [2].concat(want));
          });
        });
        D.GAME_SWAP.forEach((ids, bi) => {
          if (ids.length !== 6 || new Set(ids).size !== 6 || ids.some(id => !D.SWAP_CARDS[id])) fail('GAME swap batch ' + bi + ': needs six different known cards');
          const ks = ids.filter(id => D.SWAP_CARDS[id]).map(id => D.swapKind(D.SWAP_CARDS[id]));
          if (ks.filter(k => k === 'same').length !== 3) fail('GAME swap batch ' + bi + ': should have three same-answer and three different-answer cards (' + ks + ')');
          for (let t = 0; t < 2000; t++){
            const tr = D.swapTray(ids);
            if (tr.slice().sort().join() !== ids.slice().sort().join()){ fail('GAME swap batch ' + bi + ': the tray is not the batch\'s cards'); break; }
            const kk = tr.map(id => D.SWAP_KINDS.indexOf(D.swapKind(D.SWAP_CARDS[id])));
            if (kk.every((x, j) => j === 0 || kk[j - 1] <= x)){ fail('GAME swap batch ' + bi + ': the tray starts in box order'); break; }
          }
        });
        LANGS.forEach(L => { say('gSwapNow', L, I18N[L].gSwapNow(2, 6), [2, 6]); say('gSwapDone', L, I18N[L].gSwapDone, []); has('gSwapDone', L, I18N[L].gSwapDone, { zh:['同一個 + 或 × 的兩邊', '交換律'], en:['one + or ×', 'commutative'] }); });
      }

      /* ================= 第 3 關：先湊整數 ================= */
      {
        const G = D.GROUP;
        const tiles = [];
        G.y.forEach(y => G.x.forEach(x => tiles.push(sq(x, y, G.tileW, G.tileH))));
        tiles.forEach((t, i) => inside(t, 'group number ' + i, D.GROUP_H));
        noHits(tiles, 'group numbers');
        tooSmall('group number width', G.tileW); tooSmall('group number height', G.tileH);
        G.y.forEach((y, r) => {
          const res = { x:10, y:y + G.resDy, w:280, h:G.resH };
          inside(res, 'group result line ' + r, D.GROUP_H);
          tiles.forEach((t, i) => { if (Math.floor(i / 3) !== r && hit(res, t)) fail('GAME group: the result line of row ' + r + ' runs into row ' + Math.floor(i / 3)); });
          for (let k = 0; k < 2; k++){ const s = { x:(G.x[k] + G.x[k + 1]) / 2 - 12, y:y - G.tileH / 2, w:24, h:G.tileH }; tiles.forEach(t => { if (hit(s, t)) fail('GAME group: a sign runs under a number'); }); }
        });
        if (G.resH < 28) fail('GAME group: the result line is ' + G.resH + ' tall — the text does not fit with 2px to spare');
        need('group', /var bad = groupRefuse\(row\.op, a, b\);/, 'the pair judged is not the two numbers put together');
        /* 先算一對湊不出整十的數，數學上沒有錯：只提醒、不扣分（Tony 的決定，2026-10-11） */
        need('group', /if \(bad !== null\)\{ roundNote\(d\.gGroupBad\(a, row\.op, b, bad\)\); return false; \}/, 'a correct-but-not-easier pair must be a free reminder (roundNote), not a mistake');
        if (/roundMiss\(d\.gGroupBad/.test(RB.group || '')) fail('GAME group: a correct-but-not-easier pair must be a free reminder (roundNote), not a mistake');
        need('group', /tiles\.push\(addPiece\(B, \{ w:GROUP\.tileW, h:GROUP\.tileH, cx:GROUP\.x\[j\], cy:y, text:String\(v\), cls:'gcard gnumcard', data:\{ r:r, j:j, v:v \} \}\)\);/, 'a number tile does not show the value it is judged by');
        need('group', /addZone\(B, 10, y - GROUP\.tileH \/ 2, 280, GROUP\.tileH, 'grow', '\(' \+ a \+ ' ' \+ row\.op \+ ' ' \+ b \+ '\) ' \+ row\.op \+ ' ' \+ z\);/, 'the grouped row does not read "(a op b) op c"');
        if (D.GAME_GROUP.length < 5) fail('GAME group: at least 5 batches');
        D.GAME_GROUP.forEach((rows, bi) => {
          if (rows.length !== 3) fail('GAME group batch ' + bi + ': three rows');
          if (!rows.some(r => r.op === '+') || !rows.some(r => r.op === '×')) fail('GAME group batch ' + bi + ': needs a × row and a + row');
          let apart = false;
          rows.forEach((row, ri) => {
            const n = row.n, pairs = [];
            if (n.length !== 3 || new Set(n).size !== 3) fail('GAME group batch ' + bi + ' row ' + ri + ': three different numbers');
            for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++){
              const v = ap(n[i], row.op, n[j]), round = v % 10 === 0;
              if (round) pairs.push([i, j]);
              const ref = D.groupRefuse(row.op, n[i], n[j]);
              if (round ? ref !== null : ref !== v) fail('GAME group: groupRefuse(' + n[i] + ' ' + row.op + ' ' + n[j] + ') is ' + ref);
              const z = n[3 - i - j], tot = ap(v, row.op, z);
              LANGS.forEach(L => {
                const d = I18N[L];
                if (!round){ say('gGroupBad', L, d.gGroupBad(n[i], row.op, n[j], v), [n[i], n[j], v].concat(L === 'en' ? [10] : [])); has('gGroupBad', L, d.gGroupBad(n[i], row.op, n[j], v), { zh:['不是整十、整百或整千'], en:['not a multiple of 10'] }); }
                else { say('gGroupOk', L, d.gGroupOk(n[i], row.op, n[j], v), [n[i], n[j], v].concat(L === 'en' ? [10] : [])); say('gGroupRes', L, '(' + n[i] + ' ' + row.op + ' ' + n[j] + ') ' + row.op + ' ' + z + ' ' + d.gGroupRes(v, row.op, z, tot), [n[i], n[j], z, v, z, tot]);   /* 畫面上這一行接在「(a op b) op c」下面：接起來整條驗 */ say('gGroup2', L, d.gGroup2(ri + 1, n[i], n[j], row.op, v), [2, ri + 1, n[i], n[j], n[i], n[j], v]); { const want2 = L === 'zh' ? '提示 2：第 ' + (ri + 1) + ' 列，' + n[i] + ' 的夥伴是 ' + n[j] + '（' + n[i] + ' ' + row.op + ' ' + n[j] + ' ＝ ' + v + '）。' : 'Hint 2: in row ' + (ri + 1) + ', the partner of ' + n[i] + ' is ' + n[j] + ': ' + n[i] + ' ' + row.op + ' ' + n[j] + ' = ' + v + '.';
                  if (d.gGroup2(ri + 1, n[i], n[j], row.op, v) !== want2) fail('GAME gGroup2 ' + L + ': must read exactly "' + want2 + '", got "' + d.gGroup2(ri + 1, n[i], n[j], row.op, v) + '"'); }   /* 整句逐字釘住：否定的寫法列不完（codex 第三、四輪） */ }
              });
              if (round && tot !== n[0] * (row.op === '×' ? n[1] * n[2] : 1) && row.op === '×') fail('GAME group: regrouping changed the product');
              if (round && row.op === '+' && tot !== n[0] + n[1] + n[2]) fail('GAME group: regrouping changed the sum');
            }
            if (pairs.length !== 1) fail('GAME group batch ' + bi + ' row ' + ri + ' (' + n.join(' ' + row.op + ' ') + '): ' + pairs.length + ' pairs make a round number — exactly one should');
            else { const gp = D.groupPartner(row); if (!gp || gp.join() !== pairs[0].join()) fail('GAME group: groupPartner() is wrong for ' + n); if (pairs[0][1] - pairs[0][0] === 2) apart = true; }
          });
          if (!apart) fail('GAME group batch ' + bi + ': in no row are the partners apart — the commutative step is never needed');
        });
        LANGS.forEach(L => { say('gGroupNow', L, I18N[L].gGroupNow(1, 3), [1, 3]); say('gGroupDone', L, I18N[L].gGroupDone, L === 'en' ? [10] : []); });
      }

      /* ================= 第 4 關：拆開乘 ================= */
      {
        const C = D.CUT;
        tooSmall('cut: ↔', D.GPICK);
        need('cut', /if \(!cutOk\(n, k\)\)\{/, 'Cut judges something other than the cut shown');
        /* 剪在別處加起來也對：只提醒、不扣分（Tony 的決定，2026-10-11） */
        need('cut', /roundNote\(d\.gCutNo\(a, k, n - k, a \* k, a \* \(n - k\), a \* n\)\);/, 'a correct-but-not-easier cut must be a free reminder (roundNote), not a mistake');
        if (/roundMiss\(d\.gCutNo/.test(RB.cut || '')) fail('GAME cut: a correct-but-not-easier cut must be a free reminder (roundNote), not a mistake');
        need('cut', /onPlace:function\(P\)\{ var nk = cutK\(n, P\.cx\); if \(nk !== k && !gSolved\)\{ k = nk; clearNote\(\); draw\(\); \} \}/, 'the pieces do not follow the ↔ while it is dragged');
        need('cut', /line\.textContent = d\.gCutNow\(a, n, k, n - k\);/, 'the trail does not show the cut being judged');
        need('cut', /lblL\.textContent = String\(k\);[\s\S]{0,140}lblR\.textContent = String\(n - k\);/, 'the column counts over the pieces do not show the cut');
        if (D.GAME_CUT.length < 6) fail('GAME cut: at least 6 grids');
        D.GAME_CUT.forEach(([a, n]) => {
          if (!(n > 10 && n < 20 && a >= 2 && a <= 9)) fail('GAME cut: ' + a + ' × ' + n + ' should be 11–19 columns and 2–9 rows');
          const x0 = D.cutX0(n), grid = { x:x0, y:C.y0, w:n * C.cell, h:a * C.cell };
          inside(grid, 'cut grid ' + a + '×' + n, D.CUT_H);
          inside({ x:x0 - C.sideW - 2, y:C.y0, w:C.sideW, h:a * C.cell }, 'cut row count ' + a + '×' + n, D.CUT_H);
          const okKs = [];
          for (let k = 1; k < n; k++){
            if (D.cutOk(n, k) !== (k === 10 || n - k === 10)) fail('GAME cut: cutOk(' + n + ', ' + k + ') is wrong');
            if (D.cutOk(n, k)) okKs.push(k);
            const ex = D.cutEdgeX(n, k);
            if (Math.abs(ex - (x0 + k * C.cell)) > EPS) fail('GAME cut: cutEdgeX(' + n + ', ' + k + ')');
            inside(sq(ex, C.gripY, D.GPICK, D.GPICK), 'cut ↔ at ' + k + ' of ' + n, D.CUT_H);
            [-0.49, 0, 0.49].forEach(f => { if (D.cutK(n, ex + f * C.cell) !== k) fail('GAME cut: cutK() does not snap ' + f + ' of a column around seam ' + k + ' to it'); });
            /* 點第 j 直排：中間與 ±35% 都是自己 */
            [0.15, 0.5, 0.85].forEach(f => { if (D.cutCol(n, x0 + (k - 1 + f) * C.cell) !== k) fail('GAME cut: tapping column ' + k + ' at ' + f + ' does not cut after it'); });
            const l = k, r = n - k;
            LANGS.forEach(L => {
              const d = I18N[L];
              say('gCutNow', L, d.gCutNow(a, n, l, r), [a, n, a, l, a, r]);
              if (D.cutOk(n, k)) say('gCutYes', L, d.gCutYes(a, n, l, r, a * l, a * r, a * n), [a, n, a, l, a, r, a * l, a * r, a * n]);
              else { say('gCutNo', L, d.gCutNo(a, l, r, a * l, a * r, a * n), [a, l, a, r, a * l, a * r, a * n, 10, 10]); has('gCutNo', L, d.gCutNo(a, l, r, a * l, a * r, a * n), { zh:['也是', '不是 10 直排'], en:['also makes', 'neither piece is 10 columns'] }); }
            });
          }
          if (okKs.length !== 2) fail('GAME cut: ' + n + ' columns should have exactly two good cuts (10 from either side), got ' + okKs);
          [0, n].forEach(c => { if (D.cutCol(n, c === 0 ? x0 - 3 : x0 + (n - 0.5) * C.cell) !== c) fail('GAME cut: tapping ' + (c === 0 ? 'left of the grid' : 'the last column') + ' should give ' + c + ' (a reminder only)'); });
          if (D.cutK(n, -50) !== 1 || D.cutK(n, 999) !== n - 1) fail('GAME cut: cutK() does not stop at 1 and ' + (n - 1));
          const k0 = D.cutStart(n);
          if (!(k0 >= 1 && k0 < n) || D.cutOk(n, k0)) fail('GAME cut: the start (' + k0 + ') already makes a 10-column piece');
          /* 上面兩個直排數的標籤：最窄的一塊（1 直排）也放得下一位數 */
          if (C.cell < 14) fail('GAME cut: a column is ' + C.cell + ' wide — the count "1" over a one-column piece does not fit');
          if (!(C.lblY + C.lblH <= C.y0 + EPS && C.gripY + D.GPICK / 2 <= C.lblY + EPS)) fail('GAME cut: the ↔, the column counts and the grid overlap');
          if (C.lblH < 24) fail('GAME cut: the column count label is ' + C.lblH + ' tall — the text does not fit with 2px to spare');
        });
        LANGS.forEach(L => { say('gCut2', L, I18N[L].gCut2, [2, 10, 10, 11]); has('gCut2', L, I18N[L].gCut2, { zh:['數 10 直排', '剪在第 10 和第 11 直排中間'], en:['count 10 columns', 'cut between column 10 and column 11'] }); hasNot('gCut2', L, I18N[L].gCut2, { zh:['不要'], en:['do not', "don't"] }); say('gCutEdge', L, I18N[L].gCutEdge, []); });
      }

      /* ================= 第 5 關：合起來 ================= */
      {
        const J = D.JOIN;
        tooSmall('join card width', J.cardW); tooSmall('join card height', J.cardH); tooSmall('join blank height', J.slotH);
        const cards = J.cardX.map(x => sq(x, J.cardY, J.cardW, J.cardH));
        cards.forEach((c, i) => inside(c, 'join card ' + i, D.JOIN_H));
        noHits(cards, 'join cards');
        if (J.resY < J.rowY + J.slotH || J.resY + J.resH > J.cardY - J.cardH / 2 + EPS) fail('GAME join: the result line runs into the blanks or the cards');
        if (J.topY + J.topH > J.rowY + EPS) fail('GAME join: the expression runs into the blanks');
        need('join', /var v = P\.data\.v, why = joinWhy\(q, s\.id, v\);/, 'the blank judged is not the one the card was dropped in');
        need('join', /text:String\(v\), cls:'gcard gnumcard', data:\{ v:v \} \}\);/, 'a card does not show the value it is judged by');
        need('join', /s\.z\.textContent = String\(v\);/, 'a filled blank does not show the card that was placed');
        need('join', /addZone\(B, 0, JOIN\.topY, 300, JOIN\.topH, 'gtop', top\);/, 'the expression on top is not the one judged');
        if (D.GAME_JOIN.length < 6) fail('GAME join: at least 6 expressions');
        if (!D.GAME_JOIN.some(q => q.op === '−') || !D.GAME_JOIN.some(q => q.side === 'R') || !D.GAME_JOIN.some(q => q.side === 'L')) fail('GAME join: needs a − one and both sides (a × b and b × a)');
        D.GAME_JOIN.forEach(q => {
          const top = D.joinTop(q), tk = lex(top);
          const want = q.side === 'L' ? [q.a, '×', q.b, q.op, q.a, '×', q.c] : [q.b, '×', q.a, q.op, q.c, '×', q.a];
          if (tk.join(' ') !== want.join(' ')) fail('GAME join: joinTop() reads "' + top + '"');
          const bad = [], v = valStrict(parse(tk), bad), inner = ap(q.b, q.op, q.c);
          if (bad.length) fail('GAME join "' + top + '": a step is not a whole number of 0 or more');
          if (!(inner > 0 && inner % 10 === 0)) fail('GAME join "' + top + '": the parentheses give ' + inner + ' — not a round ten');
          if (q.a * inner !== v) fail('GAME join "' + top + '": a × (b op c) is not the expression');
          if (q.b === q.a || q.c === q.a || q.b === q.c) fail('GAME join "' + top + '": the three numbers must differ (a card would be ambiguous)');
          const cs = D.joinCards(q), d2 = q.op === '+' ? Math.abs(q.b - q.c) : q.b + q.c;
          if (cs.slice().sort((x, y) => x - y).join() !== [q.a, q.b, q.c, 2 * q.a, d2].sort((x, y) => x - y).join() || new Set(cs).size !== 5) fail('GAME join "' + top + '": the cards should be a, b, c, 2a and ' + d2 + ', all different (' + cs + ')');
          const lay = D.joinLayout(q);
          const L0 = lay[0].x, L1 = lay[lay.length - 1].x + lay[lay.length - 1].w;
          if (!(L0 >= 2 && L1 <= W - 2)) fail('GAME join "' + top + '": the row of blanks does not fit');
          const seq = lay.map(c => c.t).join(' '), ws = q.side === 'L' ? '＝ A × ( B ' + q.op + ' C )' : '＝ ( B ' + q.op + ' C ) × A';
          if (seq !== ws) fail('GAME join "' + top + '": the row reads "' + seq + '", expected "' + ws + '"');
          lay.forEach(c => { if (c.t === '＝' || c.t === '×' || c.t === '+' || c.t === '−'){ if (c.w < 28) fail('GAME join: a sign cell is ' + c.w + ' wide — "＝" does not fit with 2px to spare'); } if ('ABC'.indexOf(c.t) >= 0){ tooSmall('join blank width', c.w); if (c.w < J.cardW) fail('GAME join: a blank is narrower than a card'); } });
          /* 每一張卡 × 每一個空格 */
          ['A', 'B', 'C'].forEach(slot => cs.forEach(v => {
            let ok;
            if (slot === 'A') ok = v === q.a;
            else if (q.op === '+') ok = v === q.b || v === q.c;
            else ok = v === (slot === 'B' ? q.b : q.c);
            const w = D.joinWhy(q, slot, v);
            if (ok !== (w === null)) fail('GAME join "' + top + '": card ' + v + ' in blank ' + slot + ' is ' + (w === null ? 'accepted' : 'refused (' + w + ')') + ', expected ' + (ok ? 'accepted' : 'refused'));
            if (w === null) return;
            const kind = v === 2 * q.a ? 'double' : v === d2 ? 'otherOp' : slot === 'A' ? 'notCommon' : v === q.a ? 'commonInside' : 'minusOrder';
            if (w !== kind) fail('GAME join "' + top + '": card ' + v + ' in ' + slot + ' is refused as ' + w + ', expected ' + kind);
            const wantN = { double:[v, q.a, q.a, q.a], otherOp:q.op === '+' ? [v, Math.max(q.b, q.c), Math.min(q.b, q.c)] : [v, q.b, q.c], notCommon:[v], commonInside:[q.a], minusOrder:nums(top).concat([q.b, q.c, q.b, q.c]) }[kind];
            LANGS.forEach(L => {
              const t = D.joinWhyText(I18N[L], q, w, v);
              say('joinWhy ' + kind, L, t, wantN);
              const SEM = {
                double:{ has:{ zh:['同一個', '只要放一次'], en:['same', 'only once'] }, not:{ zh:['放兩次'], en:['twice'] } },
                otherOp:{ has:{ zh:[q.op === '+' ? '相加' : '相減', '括號裡也要用 ' + q.op], en:[q.op === '+' ? 'added' : 'subtracted', 'the parentheses use ' + q.op] }, not:{ zh:[], en:[] } },
                notCommon:{ has:{ zh:['只在其中一項', '括號外面要放兩項都有的'], en:['only one of the terms', 'outside the parentheses goes the number both terms share'] }, not:{ zh:[], en:[] } },
                commonInside:{ has:{ zh:['兩項都有', '括號外面'], en:['in both terms', 'outside the parentheses'] }, not:{ zh:['括號裡面'], en:['inside'] } },
                minusOrder:{ has:{ zh:['在前', '在後', '減法不能交換'], en:['first', 'second', 'Subtraction cannot be swapped'] }, not:{ zh:[], en:[] } }
              }[kind];
              has('joinWhy ' + kind, L, t, SEM.has); hasNot('joinWhy ' + kind, L, t, SEM.not);
            });
          }));
          if (D.joinDecoy(q) !== d2) fail('GAME join: joinDecoy() is wrong');
          for (let t = 0; t < 2000; t++){
            const tr = D.joinTray(q), ans = q.side === 'L' ? [q.a, q.b, q.c] : [q.b, q.c, q.a];
            if (tr.slice().sort((x, y) => x - y).join() !== cs.slice().sort((x, y) => x - y).join()){ fail('GAME join: the tray is not the five cards'); break; }
            if (tr.filter(x => ans.indexOf(x) >= 0).join() === ans.join()){ fail('GAME join "' + top + '": the tray lays the three right cards out in blank order'); break; }
          }
          LANGS.forEach(L => {
            const d = I18N[L], mid = d.gEq + ' ' + (q.side === 'L' ? q.a + ' × (' + q.b + ' ' + q.op + ' ' + q.c + ')' : '(' + q.b + ' ' + q.op + ' ' + q.c + ') × ' + q.a);
            const res = d.gJoinRes(q.a, inner, v, q.side);
            say('gJoinRes', L, top + ' ' + res, nums(top).concat(q.side === 'L' ? [q.a, inner, v] : [inner, q.a, v]));   /* 畫面上它接在上面的算式之後 */
            const full = d.gJoinDone(top, mid, res);
            const exN = nums(top).concat(q.side === 'L' ? [q.a, q.b, q.c, q.a, inner, v] : [q.b, q.c, q.a, inner, q.a, v]);
            if (nums(full).join() !== exN.join()) fail('GAME gJoinDone ' + L + ': numbers ' + nums(full) + ', expected ' + exN + ' — "' + full + '"');
            say('gJoin2', L, d.gJoin2(q.a), [2, q.a]); has('gJoin2', L, d.gJoin2(q.a), { zh:['兩項都有的是'], en:['both terms share is'] }); hasNot('gJoin2', L, d.gJoin2(q.a), { zh:['不是'], en:['not'] });
          });
        });
        LANGS.forEach(L => { say('gJoinNow', L, I18N[L].gJoinNow(2), [2, 3]); say('gJoinOk', L, I18N[L].gJoinOk(12), [12]); });
      }
    }
  }
};
