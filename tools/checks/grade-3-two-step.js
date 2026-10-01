/* grade-3/math/two-step 的檢查設定（兩步驟解題王：兩步驟的結構、分開列式 → 併式、括號、先乘除後加減、算式對回情境）。
   2026-10-01 新增 —— 和小遊戲「併成一個算式」改成五關五種玩法（§六之五）同一次寫成。在這之前這一課沒有設定檔，
   simgen／verify_lesson_data 一律直接報 no check config，等於完全沒有保護。

   sim（review.html 的十個產生器）：每個產生器一組不變條件、正解的第二套實作（只用 make() 留下的原始參數重算；
   併式題自己拼「a×b+c」「(a+b)×c」，故事題自己拼那一句），renderCheck 用**自己的算式求值器**（括號、先乘後加）
   把每一個算式選項算出值：兩兩不同值、正解的值等於題目要的數；「先算哪一步」不可以有兩個其實是同一步的選項（a×b 和 b×a）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的「… ＝ … ＝ …」逐條用自己的求值器重算（含括號；掃描器自己先跑正反例）。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關用自己的算法重算答案，並且**照遊戲的規則把每一題的每一種放法走一遍**（接力：每一張卡放進每一格、每一種順序；
     加括號：每一種「(」「)」的位置；電腦怎麼算：先點每一個符號；對故事：每一張卡放進每一列），證明
     收的那一種一定是對的、擋掉的每一種用自己的求值器算出來都真的是錯的、而且每一題都解得完；
     頁面的純函式（mergeCells／brRow／brNeed／calcTokens／calcFirst／calcValue／calcProgress／matchPic／matchExpr／matchVal／matchLoose）
     一律拿整個題庫去呼叫再和自己的算法比；nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的
     關鍵規則用原始碼形狀守住（need()）。每一句說明逐個比數字（每一題、每一種放錯）。版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-two-step 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function qr(q, r, lang){ return lang === 'zh' ? '商 ' + q + '、餘 ' + r : q + ' r ' + r; }

/* ---------- 自己的算式求值器：括號最先、× ÷ 再來、＋ − 由左到右。寫法不對（括號不成對、兩個符號連在一起）回 null ---------- */
function tokenize(s){
  const t = String(s).replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/＝/g, '=').replace(/\s+/g, '');
  const toks = t.match(/\d+|[×+\-÷()]|./g) || [];
  return toks;
}
function parseExpr(toks){
  let i = 0, bad = false;
  function factor(){
    if (toks[i] === '('){ i++; const v = expr(); if (toks[i] !== ')'){ bad = true; return NaN; } i++; return v; }
    if (/^\d+$/.test(toks[i] || '')) return +toks[i++];
    bad = true; return NaN;
  }
  function term(){
    let v = factor();
    while (!bad && (toks[i] === '×' || toks[i] === '÷')){
      const op = toks[i++], w = factor();
      if (op === '×') v *= w; else { if (w === 0 || v % w !== 0){ bad = true; return NaN; } v /= w; }
    }
    return v;
  }
  function expr(){
    let v = term();
    while (!bad && (toks[i] === '+' || toks[i] === '-')){ const op = toks[i++], w = term(); v = op === '+' ? v + w : v - w; }
    return v;
  }
  if (!toks.length) return null;
  const v = expr();
  return bad || i !== toks.length ? null : v;
}
function evalExpr(s){ return parseExpr(tokenize(s)); }

/* 算式掃描：一段文字裡每一串「式 ＝ 式 ＝ …」，每一段都用自己的求值器算，全部要相等。
   第一段取「能讀成算式的最長結尾」、最後一段取「能讀成算式的最長開頭」（「＝ 60（4 天…」的括號是旁白）。 */
function scanEquations(text){
  /* 「a ＋ b × c ＝ ？」是題目：最後一段是「?」的不比值，但 ＝ 左邊照樣要讀得成完整的算式（「4 × ＝ ？」「＝ ？」都算寫壞了）。
     其他任何一端空著的 ＝ 都算寫壞了（codex 第二、三輪抓到）。 */
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/= ?[？?]/g, '=?');
  const runs = t.split(/[^\d×+\-÷()=? ]+/);
  const out = [];
  runs.forEach(run => {
    if (run.indexOf('=') < 0) return;
    const raw = run.split('=');
    const parts = raw.map(p => (p.replace(/\s+/g, '').match(/\d+|[×+\-÷()]/g) || []));
    const vals = [];
    for (let k = 0; k < parts.length; k++){
      const p = parts[k];
      if (k === parts.length - 1 && k > 0 && /^\s*\?/.test(raw[k])){ vals.push('Q'); continue; }   /* 題目的「＝ ？」 */
      if (raw[k].indexOf('?') >= 0){ out.push({ text:run.trim(), bad:'has a "?" inside an equation' }); vals.push(null); continue; }
      if (!p.length){
        if (k === 0 || k === parts.length - 1) out.push({ text:run.trim(), bad:'has nothing on one side of "="' });
        vals.push(null); continue;
      }
      let v = null, cut = null;
      if (k === 0){ for (let s = 0; s < p.length && v === null; s++){ v = parseExpr(p.slice(s)); if (v !== null) cut = p[s - 1]; } }
      else if (k === parts.length - 1){ for (let e = p.length; e > 0 && v === null; e--){ v = parseExpr(p.slice(0, e)); if (v !== null) cut = p[e]; } }
      else v = parseExpr(p);
      /* 旁白只可以是被切掉的「(4 天…」那種；被切掉的那一個字緊貼著算式又是運算符號（「4 ＋＋ 5」「＝ 9 ×」），是算式寫壞了 */
      if ((k === 0 || k === parts.length - 1) && (v === null || /^[×+\-÷]$/.test(cut || ''))){
        out.push({ text:run.trim(), bad:'cannot read "' + p.join('') + '" as an expression (a sign is left dangling)' });
        v = null;
      }
      vals.push(v);
    }
    for (let k = 0; k + 1 < vals.length; k++){
      if (vals[k + 1] === 'Q') continue;
      if (vals[k] === null || vals[k + 1] === null){
        /* 中間那一段讀不成算式 —— 是寫壞了，不是旁白 */
        if (k + 1 < vals.length - 1 && parts[k + 1].length && vals[k + 1] === null) out.push({ text:run.trim(), bad:'cannot read "' + parts[k + 1].join('') + '" as an expression' });
        continue;
      }
      out.push({ text:run.trim(), bad:vals[k] === vals[k + 1] ? null : 'is ' + vals[k] + ' on one side and ' + vals[k + 1] + ' on the other' });
    }
  });
  return out;
}

/* review.html：選項裡的算式要能讀；「先算哪一步」的兩個選項不可以其實是同一步（a×b 與 b×a、a+b 與 b+a） */
function stepKey(s){
  const m = String(s).match(/^(\d+)([×+])(\d+)$/);
  if (!m) return null;
  const [x, y] = [+m[1], +m[3]].sort((p, q) => p - q);
  return x + m[2] + y;
}
const EXPR_GENS = ['chooseExprNoBracket', 'chooseExprBracket', 'combineSteps'];
const NUM_GENS = ['bridgeCalc', 'bracketCalc', 'barePrecedence', 'multiplyFact'];
const MATCH_GAP = 4;   /* 對故事：圖和空格之間至少留這麼寬 */
function storyText(kind, x, y, z, lang){
  /* 自己寫一份四種故事句（第二套實作）：right ＝ y 包、每包 x 元、再花 z 元；bracket ＝ 原本 y 包、又買 z 包、每包 x 元 */
  if (lang === 'zh') return kind === 'bracket'
    ? '原本有 ' + y + ' 包，又多買了 ' + z + ' 包，每包都是 ' + x + ' 元，一共花了多少錢？'
    : '買了 ' + y + ' 包東西，每包 ' + x + ' 元，又多花了 ' + z + ' 元買別的東西，一共花了多少錢？';
  return kind === 'bracket'
    ? 'Started with ' + y + ' packs, bought ' + z + ' more packs, $' + x + ' each. How much in total?'
    : 'Bought ' + y + ' packs at $' + x + ' each, then spent $' + z + ' more on something else. How much in total?';
}
/* 一句故事的值（自己讀：括號那一種是 (y+z)×x，其他是 y×x+z） */
function storyValue(s, lang){
  const n = nums(s);
  const br = lang === 'zh' ? /^原本有/.test(s) : /^Started with/.test(s);
  if (n.length !== 3) return null;
  return br ? (n[0] + n[1]) * n[2] : n[0] * n[1] + n[2];
}

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['relay', 'merge', 'bracket', 'calc', 'match'];", replace:"var GAME_ORDER = ['relay', 'bracket', 'merge', 'calc', 'match'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48, PILE_DOT = 16;', replace:'  var GPICK = 40, PILE_DOT = 16;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot',
      find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'no tap-then-tap alternative', find:"      gCtx.hint2 = function(){ return d.gBr2(e.a, e.b); };\n      useTapSelect(B, function(P, pt){", replace:"      gCtx.hint2 = function(){ return d.gBr2(e.a, e.b); };\n      B.onDrop = (function(P, pt){" },
    { file:'index', expect:'gOp en', find:"      gOp: { plus:'+', eq:'=' },", replace:"      gOp: { plus:'＋', eq:'=' }," },

    /* 接力 */
    { file:'index', expect:'are not all different', find:'var GAME_RELAY = [ { a:3, b:7, c:5 },', replace:'var GAME_RELAY = [ { a:3, b:7, c:7 },' },
    { file:'index', expect:'boxes — the picture holds 3~5', find:'{ a:4, b:6, c:9 }, { a:5, b:8, c:6 },', replace:'{ a:6, b:4, c:9 }, { a:5, b:8, c:6 },' },
    { file:'index', expect:'loose ones — the row holds 3~9', find:'{ a:4, b:5, c:7 }, { a:5, b:4, c:8 } ];', replace:'{ a:4, b:5, c:7 }, { a:5, b:4, c:11 } ];' },
    { file:'index', expect:'spreadX(', find:'  function spreadX(n, i, step){ return 150 + (i - (n - 1) / 2) * step; }', replace:'  function spreadX(n, i, step){ return 150 + (i - n / 2) * step; }' },
    { file:'index', expect:'GAME_RELAY[0]: boxes 0 and 1 overlap', find:'RELAY_BOX = { y:30, w:40, h:46, step:46 }', replace:'RELAY_BOX = { y:30, w:40, h:46, step:36 }' },
    { file:'index', expect:'the picture reaches the first step', find:'RELAY_LOOSE = { y:78, step:22 }', replace:'RELAY_LOOSE = { y:100, step:22 }' },
    { file:'index', expect:'the two steps are closer than their drop pads', find:'var RELAY_EQ = { y:[132, 200],', replace:'var RELAY_EQ = { y:[132, 182],' },
    { file:'index', expect:'the card tray reaches the second step', find:'RELAY_TRAY = { y:266, step:72 }', replace:'RELAY_TRAY = { y:250, step:72 }' },
    { file:'index', expect:'relay: cards 0 and 1 overlap', find:'RELAY_TRAY = { y:266, step:72 }', replace:'RELAY_TRAY = { y:266, step:44 }' },
    { file:'index', expect:'the step-1 answer card overlaps', find:'res:{ x:228, w:58 }, lbl:22 }', replace:'res:{ x:208, w:58 }, lbl:22 }' },
    { file:'index', expect:'the loose ones are accepted in the × step', find:"        if (s.row === 0 && v === e.c && !P.data.res){ roundMiss(d.gRelayLoose(e.c)); return false; }\n", replace:'' },
    { file:'index', expect:'the second step can be filled before the first', find:"        if (s.row === 1 && !step1){ roundMiss(d.gRelayFirst); return false; }\n", replace:'' },
    { file:'index', expect:'the combined line does not follow', find:'          var v1Left = slots[2].res;', replace:'          var v1Left = true;' },
    { file:'index', expect:'the answers are not a × b', find:'var e = pick(GAME_RELAY), v1 = e.a * e.b, v2 = v1 + e.c,', replace:'var e = pick(GAME_RELAY), v1 = e.a * e.b, v2 = v1 + e.b,' },
    { file:'index', expect:'gRelayLoose zh', find:"return '這 ' + c + ' 個是散的", replace:"return '這 ' + (c + 1) + ' 個是散的" },
    { file:'index', expect:'gRelayDone en', find:"'. As one expression: ' + (v1Left ? x + ' × ' + y + ' + ' + c : c + ' + ' + x + ' × ' + y) + ' = ' + v2 + '!';", replace:"'. As one expression: ' + (v1Left ? x + ' × ' + y + ' + ' + c : c + ' + ' + y + ' × ' + x) + ' = ' + v2 + '!';" },
    { file:'index', expect:'gRelayLine zh', find:"gRelayLine: function(x, y, c, v2, v1Left){ return (v1Left ? x + ' × ' + y + ' ＋ ' + c : c + ' ＋ ' + x + ' × ' + y) + ' ＝ ' + v2; },", replace:"gRelayLine: function(x, y, c, v2, v1Left){ return (v1Left ? x + ' × ' + y + ' ＋ ' + c : '(' + c + ' ＋ ' + x + ') × ' + y) + ' ＝ ' + v2; }," },
    { file:'index', expect:'gRelay2(v1) en', find:"'Put the first step’s answer ' + v1 + ' and the ' + c + ' loose ones", replace:"'Put the first step’s answer ' + (v1 + 1) + ' and the ' + c + ' loose ones" },

    /* 併式 */
    { file:'index', expect:'are not all different — "drop it on', find:'var GAME_MERGE = [ { a:6, b:4, c:9 },', replace:'var GAME_MERGE = [ { a:6, b:4, c:24 },' },
    { file:'index', expect:'should be 3~9 and c at least 2', find:'{ a:9, b:4, c:7 }, { a:5, b:6, c:14 } ];', replace:'{ a:9, b:4, c:7 }, { a:5, b:6, c:1 } ];' },
    { file:'index', expect:'without brackets', find:"{ p:2, q:7, r:4, side:'L' },", replace:"{ p:2, q:7, r:1, side:'L' }," },
    { file:'index', expect:'both (p + q) × r and r × (p + q)', find:"{ p:5, q:2, r:8, side:'R' }, { p:4, q:5, r:7, side:'L' }, { p:6, q:3, r:5, side:'R' }, { p:2, q:7, r:4, side:'L' }, { p:3, q:5, r:9, side:'R' } ];", replace:"{ p:5, q:2, r:8, side:'L' }, { p:4, q:5, r:7, side:'L' }, { p:6, q:3, r:5, side:'L' }, { p:2, q:7, r:4, side:'L' }, { p:3, q:5, r:9, side:'L' } ];" },
    { file:'index', expect:'mergeCells()', find:"    var nums = part ? (e.side === 'L' ? [['s', s], ['n', e.r]] : [['n', e.r], ['s', s]]) : [['s', s], ['n', e.c]];", replace:"    var nums = part ? (e.side === 'L' ? [['s', s], ['n', e.r]] : [['s', s], ['n', e.r]]) : [['s', s], ['n', e.c]];" },
    { file:'index', expect:'mergeCells()', find:'    var s = part ? e.p + e.q : e.a * e.b, t = part ? s * e.r : s + e.c;', replace:'    var s = part ? e.p + e.q : e.a * e.b, t = part ? s * e.r : s * e.c;' },
    { file:'index', expect:'pieces reach the second step', find:'MERGE_PART = [ { y1:30, y2:88, tray:150 },', replace:'MERGE_PART = [ { y1:30, y2:88, tray:136 },' },
    { file:'index', expect:'the line between the pairs is not between them', find:'MERGE_SEP = 182;', replace:'MERGE_SEP = 214;' },
    { file:'index', expect:'drop pads touch', find:'var MERGE_ROW = { x:[70, 116, 162, 204, 250],', replace:'var MERGE_ROW = { x:[70, 116, 130, 204, 250],' },
    { file:'index', expect:'merge: pair 1 parts', find:'var MERGE_CHUNK = { w:124, h:48, step:140 }', replace:'var MERGE_CHUNK = { w:124, h:48, step:110 }' },
    { file:'index', expect:'step 1 is accepted on a number it did not make', find:"        if (s.role === 'n'){ roundMiss(d.gMergeNotThis(s.v, M.s)); return false; }\n", replace:'' },
    { file:'index', expect:'step 1 is accepted on a number it did not make', find:"        if (s.role === 't'){ roundMiss(d.gMergeNotAns(M.t, M.s)); return false; }\n", replace:'' },
    { file:'index', expect:'the addition without brackets is accepted', find:'        if (part === 1 && !P.data.br){', replace:'        if (part === 2 && !P.data.br){' },
    { file:'index', expect:'with and without brackets', find:"var items = p ? [{ t:g.step1, br:false }, { t:'(' + g.step1 + ')', br:true }] : [{ t:g.step1, br:false }];", replace:"var items = p ? [{ t:'(' + g.step1 + ')', br:true }] : [{ t:g.step1, br:false }];" },
    { file:'index', expect:'the combined expression is not built', find:"g.merged = p ? (e.side === 'L' ? '(' + step1 + ') × ' + e.r : e.r + ' × (' + step1 + ')') : step1 + ' ' + O.plus + ' ' + e.c;", replace:"g.merged = p ? (e.side === 'L' ? step1 + ' × ' + e.r : e.r + ' × ' + step1) : step1 + ' ' + O.plus + ' ' + e.c;" },
    { file:'index', expect:'gMergeNoBr zh', find:"return '沒有括號，電腦會先算 ' + x + ' × ' + y + ' ＝ ' + xy + '，再加 ' + z", replace:"return '沒有括號，電腦會先算 ' + x + ' × ' + y + ' ＝ ' + (xy + z) + '，再加 ' + z" },
    { file:'index', expect:'does not describe', find:"          if (e.side === 'L') roundMiss(d.gMergeNoBr(e.q, e.r, e.q * e.r, e.p, e.p + e.q * e.r, M.t));", replace:"          if (e.side === 'L') roundMiss(d.gMergeNoBr(e.p, e.r, e.p * e.r, e.q, e.p + e.q * e.r, M.t));" },
    { file:'index', expect:'gMergeNotAns en', find:"return t + ' is the final answer — it stays. The number to replace is ' + s + ',", replace:"return t + ' is the final answer — it stays. The number to replace is ' + t + '," },
    { file:'index', expect:'gMergeDone zh', find:"return '兩組都併好了：' + e1 + ' ＝ ' + t1 + '，' + e2 + ' ＝ ' + t2", replace:"return '兩組都併好了：' + e1 + ' ＝ ' + t2 + '，' + e2 + ' ＝ ' + t2" },

    /* 加括號 */
    { file:'index', expect:'are not all different — the reasons', find:"var GAME_BRACKET = [ { a:3, b:2, c:14, form:'L' },", replace:"var GAME_BRACKET = [ { a:3, b:3, c:14, form:'L' }," },
    { file:'index', expect:'the picture holds 2~7', find:"{ a:2, b:5, c:6, form:'L' },", replace:"{ a:4, b:5, c:6, form:'L' }," },
    { file:'index', expect:'both a ＋ b × c and c × a ＋ b', find:"{ a:4, b:3, c:8, form:'R' }, { a:2, b:5, c:6, form:'L' }, { a:3, b:4, c:9, form:'R' }, { a:4, b:2, c:15, form:'L' }, { a:2, b:3, c:11, form:'R' } ];", replace:"{ a:4, b:3, c:8, form:'L' }, { a:2, b:5, c:6, form:'L' }, { a:3, b:4, c:9, form:'L' }, { a:4, b:2, c:15, form:'L' }, { a:2, b:3, c:11, form:'L' } ];" },
    { file:'index', expect:'brNeed(', find:"  function brNeed(form){ return form === 'L' ? { o:0, c:1 } : { o:1, c:2 }; }", replace:"  function brNeed(form){ return form === 'L' ? { o:0, c:1 } : { o:0, c:2 }; }" },
    { file:'index', expect:'brRow()', find:"    var n = e.form === 'L' ? [e.a, e.b, e.c] : [e.c, e.a, e.b], ops = e.form === 'L' ? [plus, '×'] : ['×', plus];", replace:"    var n = e.form === 'L' ? [e.a, e.b, e.c] : [e.c, e.a, e.b], ops = e.form === 'L' ? [plus, '×'] : [plus, '×'];" },
    { file:'index', expect:'the bracket gaps are', find:"{ k:'o', id:1, num:n[1], w:R.slot }, { k:'n', text:String(n[1]), w:R.num }, { k:'c', id:1, num:n[1], w:R.slot },", replace:"{ k:'o', id:1, num:n[0], w:R.slot }, { k:'n', text:String(n[1]), w:R.num }, { k:'c', id:1, num:n[1], w:R.slot }," },
    { file:'index', expect:'is not right before the number', find:"{ k:'o', id:0, num:n[0], w:R.slot }, { k:'n', text:String(n[0]), w:R.num },", replace:"{ k:'n', text:String(n[0]), w:R.num }, { k:'o', id:0, num:n[0], w:R.slot }," },
    { file:'index', expect:'brBoxX(', find:'  function brBoxX(a, b, i){ return spreadX(a + b, i, BRK_BOX.step) + (i < a ? -1 : 1) * BRK_BOX.gap / 2; }', replace:'  function brBoxX(a, b, i){ return spreadX(a + b, i, BRK_BOX.step); }' },
    { file:'index', expect:'gaps are closer than their drop pads', find:'BRK_PAD = 14,', replace:'BRK_PAD = 40,' },
    { file:'index', expect:'the labels reach the expression', find:'var BRK_ROW = { y:136,', replace:'var BRK_ROW = { y:110,' },
    { file:'index', expect:'the pieces reach the expression', find:'BRK_TRAY = { y:220, step:96, size:52 }', replace:'BRK_TRAY = { y:190, step:96, size:52 }' },
    { file:'index', expect:'a bracket in the wrong gap is accepted', find:'        if (s.id !== need[s.k]){', replace:'        if (s.id === -1){' },
    { file:'index', expect:'a gap of the other kind is not explained', find:"        if (s.k !== P.data.k){ roundMiss(P.data.k === 'o' ? d.gBrKindO : d.gBrKindC); return false; }", replace:"        if (s.k !== P.data.k) return false;" },
    { file:'index', expect:'the finished message is not built', find:"          var wrong = e.form === 'L' ? e.a + e.b * e.c : e.c * e.a + e.b;", replace:"          var wrong = e.form === 'L' ? e.a + e.b * e.c : e.c * (e.a + e.b);" },
    { file:'index', expect:'gBrCloseAt zh', find:"'，括號要在 ' + b + ' 後面關起來。'; },", replace:"'，括號要在 ' + a + ' 後面關起來。'; }," },
    { file:'index', expect:'gBrDone en', find:"return expr + ' = ' + mid + ' = ' + v + ' — ' + v + ' altogether!", replace:"return expr + ' = ' + mid + ' = ' + (v + 1) + ' — ' + v + ' altogether!" },

    /* 電腦怎麼算 */
    { file:'index', expect:'not three different answers', find:'var GAME_CALC = [ { a:6, b:3, c:7 },', replace:'var GAME_CALC = [ { a:6, b:3, c:6 },' },
    { file:'index', expect:'calcFirst() points at the wrong sign', find:"  function calcFirst(form){ return form === 'addMul' ? 1 : 0; }", replace:"  function calcFirst(form){ return 0; }" },
    { file:'index', expect:'calcValue(', find:"  function calcValue(form, e){ return form === 'addMul' ? e.a + e.b * e.c :", replace:"  function calcValue(form, e){ return form === 'addMul' ? (e.a + e.b) * e.c :" },
    { file:'index', expect:'after the first tap', find:"    var mid = form === 'addMul' ? e.a + ' ' + plus + ' ' + (e.b * e.c) :", replace:"    var mid = form === 'addMul' ? (e.a + e.b) + ' × ' + e.c :" },
    { file:'index', expect:'after the second tap', find:"    return eq + ' ' + mid + (step >= 2 ? ' ' + eq + ' ' + calcValue(form, e) : '');", replace:"    return step >= 2 ? eq + ' ' + calcValue(form, e) : eq + ' ' + mid;" },
    { file:'index', expect:'calcTokens(', find:"          : [['n', e.a], ['op', '×'], ['n', e.b], ['op', plus], ['n', e.c]];", replace:"          : [['n', e.a], ['op', plus], ['n', e.b], ['op', '×'], ['n', e.c]];" },
    { file:'index', expect:'not packed in a centred row', find:"    out.forEach(function(c){ c.x = x + c.w / 2; x += c.w + K.gap; });", replace:"    out.forEach(function(c){ c.x = x + c.w / 2; x += c.w; });" },
    { file:'index', expect:'sign button', find:'CALC_TOK = { num:34, op:48, par:14, gap:4, h:48 }', replace:'CALC_TOK = { num:34, op:40, par:14, gap:4, h:48 }' },
    { file:'index', expect:'overlaps the worked-out line above it', find:'CALC_Y = [40, 128, 216]', replace:'CALC_Y = [40, 100, 216]' },
    { file:'index', expect:'the wrong sign first is accepted', find:'        if (R.step === 0 && op !== first){', replace:'        if (R.step === 0 && op === -1){' },
    { file:'index', expect:'the same sign tapped twice', find:'        if (R.step === 1 && op === first) return;\n', replace:'' },
    { file:'index', expect:'a sign in a line that is not up yet', find:'        if (gSolved || r !== row) return;', replace:'        if (gSolved) return;' },
    { file:'index', expect:'the three lines are not shuffled', find:'forms = shuffle(CALC_FORMS),', replace:'forms = CALC_FORMS,' },
    { file:'index', expect:'gCalcMul en', find:"work out ' + x + ' × ' + y + ' = ' + xy + ' first.'", replace:"work out ' + x + ' × ' + y + ' = ' + (xy + 1) + ' first.'" },
    { file:'index', expect:'gCalcDone zh', find:"return '同樣的數字，' + a + ' ＋ ' + b + ' × ' + c + ' ＝ ' + v1", replace:"return '同樣的數字，(' + a + ' ＋ ' + b + ') × ' + c + ' ＝ ' + v1" },

    /* 對故事 */
    { file:'index', expect:'b = c', find:'var GAME_MATCH = [ { a:6, b:4, c:3 },', replace:'var GAME_MATCH = [ { a:6, b:3, c:3 },' },
    { file:'index', expect:'together at most 7 packs', find:'{ a:8, b:5, c:2 }, { a:9, b:3, c:4 },', replace:'{ a:8, b:5, c:4 }, { a:9, b:3, c:4 },' },
    { file:'index', expect:'not one of the counts', find:'{ a:4, b:2, c:5 },', replace:'{ a:2, b:2, c:5 },' },
    { file:'index', expect:'matchExpr(', find:"k === 'mc' ? e.a + '×' + e.c + '+' + e.b : '(' + e.b + '+' + e.c + ')×' + e.a; }", replace:"k === 'mc' ? e.a + '×' + e.b + '+' + e.c : '(' + e.b + '+' + e.c + ')×' + e.a; }" },
    { file:'index', expect:'matchLoose(', find:"  function matchLoose(k, e){ return k === 'mb' ? e.c : k === 'mc' ? e.b : 0; }", replace:"  function matchLoose(k, e){ return k === 'mb' ? e.b : k === 'mc' ? e.c : 0; }" },
    { file:'index', expect:'matchPic(', find:"    var P = MATCH_PACK, n1 = k === 'mc' ? e.c : e.b, n2 = k === 'br' ? e.c : 0,", replace:"    var P = MATCH_PACK, n1 = e.b, n2 = k === 'br' ? e.c : 0," },
    { file:'index', expect:'runs into the slot', find:'MATCH_PACK = { x0:10, w:22, h:30, step:25, gap:10 }', replace:'MATCH_PACK = { x0:10, w:22, h:30, step:30, gap:10 }' },
    { file:'index', expect:'their drop pads touch', find:'var MATCH_H = 300, MATCH_Y = [36, 106, 176],', replace:'var MATCH_H = 300, MATCH_Y = [36, 96, 176],' },
    { file:'index', expect:'the cards reach the last row', find:'MATCH_TRAY = { y:262, step:98 }', replace:'MATCH_TRAY = { y:230, step:98 }' },
    { file:'index', expect:'match: cards 0 and 1 overlap', find:'MATCH_TRAY = { y:262, step:98 }', replace:'MATCH_TRAY = { y:262, step:80 }' },
    { file:'index', expect:'a card is accepted next to another story', find:'        if (ck !== s.kind){', replace:'        if (ck === -1){' },
    { file:'index', expect:'a card is accepted next to another story', find:"          else if (s.kind === 'br') roundMiss(d.gMatchNoLoose(matchLoose(ck, e)));", replace:"          else if (s.kind === 'br') roundMiss(d.gMatchNoLoose(matchLoose(s.kind, e)));" },
    { file:'index', expect:'the story rows are not shuffled', find:'kinds = shuffle(MATCH_KINDS),', replace:'kinds = MATCH_KINDS,' },
    { file:'index', expect:'zh gMatchLoose', find:"return '這張卡最後加的是 ' + x + '，可是這一列散的有 ' + y + ' 個。'; },", replace:"return '這張卡最後加的是 ' + y + '，可是這一列散的有 ' + x + ' 個。'; }," },
    { file:'index', expect:'gMatch2 en', find:"find the card that ends in \"+' + y + '\".'", replace:"find the card that ends in \"+' + r + '\".'" },

    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'is 60 on one side and 61', find:"s3good:'括號先把 3 盒和 2 盒加成 5 盒，再乘以每盒 12 顆：(3＋2)×12＝5×12＝60。'", replace:"s3good:'括號先把 3 盒和 2 盒加成 5 盒，再乘以每盒 12 顆：(3＋2)×12＝5×12＝61。'" },
    { file:'index', expect:'is 66 on one side and 65', find:"why:'First 15 × 4 = 60 (4 days of folding), then 60 + 6 = 66.", replace:"why:'First 15 × 4 = 60 (4 days of folding), then 60 + 6 = 65." },
    { file:'index', expect:'is 358 on one side and 750', find:"why:'要先把箱數加起來變成 15 箱，再乘以每箱 50 個：(8+7)×50＝750。", replace:"why:'要先把箱數加起來變成 15 箱，再乘以每箱 50 個：8+7×50＝750。" },

    /* ---- review.html ---- */
    { file:'review', expect:'is copied straight out of the stem', find:"        var c = pick([2,3,4,5,6,7,8].filter(function(x){ return x !== a * b; }));", replace:"        var c = pick([8]);" },
    { file:'review', expect:'opts[ans] != correct', find:"        return { a:a, b:b, c:c, val:(a + b) * c };\n      },\n      fmt: function(d, lang){\n        var m = mixOpts(d.val, [d.a + d.b * d.c,", replace:"        return { a:a, b:b, c:c, val:a + b * c };\n      },\n      fmt: function(d, lang){\n        var m = mixOpts(d.val, [d.a + d.b * d.c," },
    { file:'review', expect:'two expression options have the same value', find:"          { expr: d.a + '×' + d.b + '×' + d.c, val: d.a * d.b * d.c }\n        ]);\n        return {\n          stem: lang === 'zh'\n            ? '小美", replace:"          { expr: d.b + '×' + d.a + '+' + d.c, val: -1 }\n        ]);\n        return {\n          stem: lang === 'zh'\n            ? '小美" },
    { file:'review', expect:'two "first step" options are the same step', find:"        var rawCands = [d.exist + '+' + d.a, d.a + '×' + d.exist, d.exist + '+' + d.b];", replace:"        var rawCands = [d.exist + '+' + d.a, d.a + '×' + d.exist, d.exist + '×' + d.a];" },
    { file:'review', expect:'the same total', find:"          if (allDistinct(vals)) break;", replace:"          if (allDistinct(vals) || true) break;" },
    { file:'review', expect:'why: "', find:"? d.a + ' × ' + d.b + ' ＝ ' + (d.a * d.b) + '，' + (d.a * d.b) + ' ＋ ' + d.c + ' ＝ ' + d.val + '。'", replace:"? d.a + ' × ' + d.b + ' ＝ ' + (d.a * d.b) + '，' + (d.a * d.b) + ' ＋ ' + d.c + ' ＝ ' + (d.val + 1) + '。'" },
    { file:'review', expect:'options are a correct quotient and remainder', find:"          fmtQR(d.q, d.r + d.k),", replace:"          fmtQR(d.q, d.r) + ' '," },
    { file:'review', expect:'left-to-right gives the same answer', find:"        var b = pick([4,5,6,7,8,9]);\n        /* c 不可以等於 a × b", replace:"        var b = pick([1]);\n        /* c 不可以等於 a × b" }
  ],

  sim: {
    INVARIANTS: {
      bridgeCalc: d => {
        if (d.val !== d.a * d.b + d.c) return 'val != a*b + c';
        if (d.b < 2 || d.c < 1) return 'b/c too small for a two-step story';
      },
      bracketCalc: d => {
        if (d.val !== (d.a + d.b) * d.c) return 'val != (a+b)*c';
        if (d.a < 2 || d.b < 2 || d.c < 2) return 'a, b, c must be at least 2 (otherwise the bracket changes nothing)';
      },
      chooseExprNoBracket: d => {
        if (d.val !== d.a * d.b + d.c) return 'val != a*b + c';
        if (d.a < 2) return 'a must be at least 2';
      },
      chooseExprBracket: d => {
        if (d.val !== (d.a + d.b) * d.c) return 'val != (a+b)*c';
        if (d.c < 2) return 'c must be at least 2 (otherwise a+b×c is also right)';
      },
      barePrecedence: d => {
        if (d.val !== d.c + d.a * d.b) return 'val != c + a*b';
        /* 「先乘除」這一題的重點：從左算到右會得到不同的數 */
        if ((d.c + d.a) * d.b === d.val) return 'left-to-right gives the same answer — the question tests nothing';
      },
      storyMatch: d => {
        if (d.val !== d.a * d.b + d.c) return 'val != a*b + c';
        const v = [d.a * d.b + d.c, (d.b + d.c) * d.a, d.a * d.c + d.b, d.b * d.c + d.a];
        if (new Set(v).size !== 4) return 'two of the four stories make the same total (' + v.join(',') + ') — a "wrong" story is also right by the numbers';
      },
      firstStepPick: d => {
        if (d.b === d.a || d.b === d.exist) return 'b must differ from a and from the existing count';
      },
      combineSteps: d => {
        if (d.p !== d.a * d.b || d.val !== d.p + d.c) return 'p != a*b or val != p + c';
      },
      multiplyFact: d => {
        if (d.val !== d.a * d.d) return 'val != a*d';
        if (d.a < 10 || d.a > 99 || d.d < 2 || d.d > 9) return 'a must be two-digit and d one-digit';
      },
      divideFact: d => {
        if (d.dividend !== d.k * d.q + d.r) return 'dividend != k*q + r';
        if (!(d.r >= 0 && d.r < d.k)) return 'remainder not 0..k-1';
      }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'bridgeCalc': return String(d.a * d.b + d.c);
        case 'bracketCalc': return String((d.a + d.b) * d.c);
        case 'chooseExprNoBracket': return d.a + '×' + d.b + '+' + d.c;
        case 'chooseExprBracket': return '(' + d.a + '+' + d.b + ')×' + d.c;
        case 'barePrecedence': return String(d.c + d.a * d.b);
        case 'storyMatch': return storyText('right', d.a, d.b, d.c, lang);
        case 'firstStepPick': return d.a + '×' + d.b;
        case 'combineSteps': return d.a + '×' + d.b + '+' + d.c;
        case 'multiplyFact': return String(d.a * d.d);
        case 'divideFact': return qr(d.q, d.r, lang);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (NUM_GENS.indexOf(genId) >= 0){
        if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
        const n = Number(s);
        if (n < 1 || n > 999) return 'option ' + n + ' outside 1~999';
        return;
      }
      if (EXPR_GENS.indexOf(genId) >= 0){
        if (!/^[\d+×()]+$/.test(s) || evalExpr(s) === null) return 'option "' + s + '" is not a readable expression';
        return;
      }
      if (genId === 'firstStepPick'){ if (!/^\d+[+×]\d+$/.test(s)) return 'option "' + s + '" is not one step (a+b or a×b)'; return; }
      if (genId === 'divideFact'){
        const m = lang === 'zh' ? s.match(/^商 (\d+)、餘 (\d+)$/) : s.match(/^(\d+) r (\d+)$/);
        if (!m) return 'option "' + s + '" is not a quotient-and-remainder in ' + lang;
        return;
      }
      if (genId === 'storyMatch'){ if (storyValue(s, lang) === null) return 'option "' + s.slice(0, 40) + '" is not one of the story shapes'; return; }
      return 'no option rule for ' + genId;
    },
    renderCheck: function(d, q, lang, genId){
      if (EXPR_GENS.indexOf(genId) >= 0){
        const v = q.opts.map(evalExpr);
        if (new Set(v).size !== v.length) return 'two expression options have the same value: ' + q.opts.join(' | ') + ' → ' + v.join(',');
        if (v[q.ans] !== d.val) return 'the marked expression ' + q.opts[q.ans] + ' makes ' + v[q.ans] + ', not ' + d.val;
      }
      if (genId === 'firstStepPick'){
        const k = q.opts.map(stepKey);
        if (new Set(k).size !== k.length) return 'two "first step" options are the same step: ' + q.opts.join(' | ');
      }
      if (genId === 'storyMatch'){
        const v = q.opts.map(s => storyValue(s, lang));
        if (new Set(v).size !== v.length) return 'two stories make the same total: ' + v.join(',');
        if (v[q.ans] !== d.val) return 'the marked story makes ' + v[q.ans] + ', not ' + d.val;
      }
      if (genId === 'divideFact'){
        const right = q.opts.filter(s => { const n = nums(s); return n.length === 2 && d.k * n[0] + n[1] === d.dividend && n[1] < d.k; });
        if (right.length !== 1) return right.length + ' options are a correct quotient and remainder';
      }
      /* 解釋裡的每一條算式都要算得對 */
      const bad = scanEquations(q.why).filter(e => e.bad);
      if (bad.length) return 'why: "' + bad[0].text + '" ' + bad[0].bad;
    },
    stemEchoOk: {}
  },

  data: {
    dataStart: '  /* ============ 小遊戲「併成一個算式」',
    dataEnd: '  /* ===================== i18n ===================== */',
    dataReturn: '{GPICK, PILE_DOT, spreadX, RELAY_H, RELAY_BOX, RELAY_LOOSE, RELAY_EQ, RELAY_TRAY, RELAY_PAD, GAME_RELAY, MERGE_H, MERGE_PART, MERGE_SEP, MERGE_ROW, MERGE_STEP1, MERGE_CHUNK, MERGE_PAD, GAME_MERGE, GAME_MERGEB, mergeCells, BRK_H, BRK_BOX, BRK_LBL, BRK_ROW, BRK_PAD, BRK_TRAY, GAME_BRACKET, brBoxX, brRow, brNeed, CALC_H, CALC_Y, CALC_PROG, CALC_TOK, GAME_CALC, CALC_FORMS, calcTokens, calcFirst, calcValue, calcProgress, MATCH_H, MATCH_Y, MATCH_SLOT, MATCH_PAD, MATCH_PACK, MATCH_DOT, MATCH_CARD, MATCH_TRAY, GAME_MATCH, MATCH_KINDS, matchExpr, matchVal, matchLoose, matchPic}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 求值器與算式掃描器自己先證明會響（positive / negative control） --- */
      [['(4+5)×6', 54], ['4+5×6', 34], ['6×4+5', 29], ['(4+5', null], ['4++5', null], ['8 × (3 ＋ 5)', 64], ['12÷4+1', 4], ['13÷4', null]]
        .forEach(([t, v]) => { if (evalExpr(t) !== v) fail('evalExpr() self-test: ' + t + ' should be ' + v + ', got ' + evalExpr(t)); });
      [['(3＋2)×12＝5×12＝60', true], ['(3＋2)×12＝61', false], ['3 ＋ 2 × 12 ＝ 27', true], ['3 ＋ 2 × 12 ＝ 60', false], ['15 × 4 = 60 (4 days', true],
       ['4 + 5 = 9 = 10', false], ['6 × 4 ＋ 5 ＝ 29', true], ['4 × = 9', false], ['4 × 5 =', false], ['= 20', false], ['3 ＋ 2 × 12 ＝ ？ 先算', null], ['3 + 2 × 12 = ?', null], ['4 × = ?', false], ['＝ ？', false], ['4 + 5 = 9 ×', false], ['4++5=9', false], ['12 + 6×2 = 24', true], ['12 + 6×2 = 36', false], ['先算 (6+9)×15＝225。', true]]
        .forEach(([t, good]) => {
          const r = scanEquations(t);
          if (good === null){ if (r.length) fail('scanEquations() self-test: "' + t + '" is a question, not an equation — got ' + JSON.stringify(r)); return; }
          if (!r.length || r.some(e => e.bad) === good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
        });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => { if (k !== 'gOp') walk(v[k], where + '.' + k, out); });   /* gOp 是符號表（＋、＝），不是句子 */
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        scanEquations(s).forEach(e => { checkedEq++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
      }));
      if (checkedEq < 60) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['relay', 'merge', 'bracket', 'calc', 'match'];
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the five examples), got ' + types.join());
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
      /* 每一句說明：數字照順序逐個比，而且句子裡的每一條算式都要算得對 */
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
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      const mySpread = (n, i, step) => 150 + (i - (n - 1) / 2) * step;
      ['GAME_RELAY', 'GAME_MERGE', 'GAME_MERGEB', 'GAME_BRACKET', 'GAME_CALC', 'GAME_MATCH'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });
      const H = { relay:'RELAY_H', merge:'MERGE_H', bracket:'BRK_H', calc:'CALC_H', match:'MATCH_H' };
      TYPES.forEach(t => need(t, new RegExp('var B = makeBoard\\(300, ' + H[t] + '\\);'), 'the board is not 300 × ' + H[t]));
      ['relay', 'merge', 'bracket', 'match'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'no tap-then-tap alternative for the drag'));

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。
         點目的地的格子也要點得到：格子加上兩邊的 pad 至少 44。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('a merge piece (' + D.MERGE_CHUNK.h + ' high)', Math.min(D.MERGE_CHUNK.w, D.MERGE_CHUNK.h));
      tooSmall('a bracket piece (' + D.BRK_TRAY.size + ')', D.BRK_TRAY.size);
      tooSmall('a sign button (' + D.CALC_TOK.op + '×' + D.CALC_TOK.h + ')', Math.min(D.CALC_TOK.op, D.CALC_TOK.h));
      tooSmall('an expression card (' + D.MATCH_CARD.w + '×' + D.MATCH_CARD.h + ')', Math.min(D.MATCH_CARD.w, D.MATCH_CARD.h));
      tooSmall('a relay box with its pad', D.RELAY_EQ.slot + 2 * D.RELAY_PAD);
      tooSmall('a merge number box with its pad', Math.min(...D.MERGE_ROW.w.filter((w, i) => i % 2 === 0), D.MERGE_ROW.h) + 2 * D.MERGE_PAD);
      tooSmall('a bracket gap with its pad', Math.min(D.BRK_ROW.slot, D.BRK_ROW.h) + 2 * D.BRK_PAD);
      tooSmall('a story slot with its pad', Math.min(D.MATCH_SLOT.w, D.MATCH_SLOT.h) + 2 * D.MATCH_PAD);
      [D.MERGE_CHUNK.h, D.BRK_TRAY.size, D.MATCH_CARD.h].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('relay', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:cx, cy:cy, text:String\(v\), cls:'gcard'/, 'the number cards are not GPICK × GPICK');
      need('relay', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:EQ\.res\.x, cy:EQ\.y\[0\], text:String\(v1\), cls:'gcard gans', label:String\(v1\), data:\{ v:v1, res:true \} \}\);/, 'the step-1 answer card is not GPICK × GPICK on the step-1 answer box');
      need('merge', /addPiece\(B, \{ w:MERGE_CHUNK\.w, h:MERGE_CHUNK\.h, cx:cx, cy:cy,/, 'the merge pieces are not MERGE_CHUNK');
      need('bracket', /addPiece\(B, \{ w:BRK_TRAY\.size, h:BRK_TRAY\.size, cx:cx, cy:cy,/, 'the bracket pieces are not BRK_TRAY.size');
      need('match', /addPiece\(B, \{ w:MATCH_CARD\.w, h:MATCH_CARD\.h, cx:cx, cy:cy,/, 'the expression cards are not MATCH_CARD');
      need('calc', /b\.style\.width = t\.w \+ 'px'; b\.style\.height = K\.h \+ 'px';/, 'the sign buttons are not drawn at their token size');

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
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
        const O = I18N[L].gOp;
        if (!O || O.plus !== (L === 'zh' ? '＋' : '+') || O.eq !== (L === 'zh' ? '＝' : '=')) fail('gOp ' + L + ' should be the lesson\'s own ＋／＝ signs');
      });

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          /* 接力的四格：點在格子裡的一定判給那一格 */
          const h = D.RELAY_EQ.slot / 2, list = [];
          D.RELAY_EQ.y.forEach(y => D.RELAY_EQ.x.forEach(x => list.push({ id:list.length, cx:x, cy:y, hw:h, hh:h, done:false })));
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - h + 0.5; x < b.cx + h; x += 2) for (let y = b.cy - h + 0.5; y < b.cy + h; y += 2){ const g = nearestOpen(list, { x, y }, D.RELAY_PAD); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a relay box are given to another box (or none)');
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：接力（範例 1：第一步的答案是第二步的材料） --- */
      {
        const RB = D.RELAY_BOX, RL = D.RELAY_LOOSE, EQ = D.RELAY_EQ, TR = D.RELAY_TRAY, h = EQ.slot / 2, Hh = D.RELAY_H;
        D.GAME_RELAY.forEach((e, i) => {
          const w = 'GAME_RELAY[' + i + ']';
          if (![e.a, e.b, e.c].every(isInt)) return fail(w + ' is not whole numbers');
          const v1 = e.a * e.b, v2 = v1 + e.c;
          if (e.a < 3 || e.a > 5) fail(w + ': ' + e.a + ' boxes — the picture holds 3~5');
          if (e.b < 4 || e.b > 9) fail(w + ': ' + e.b + ' per box — should be 4~9');
          if (e.c < 3 || e.c > 9) fail(w + ': ' + e.c + ' loose ones — the row holds 3~9');
          /* 卡片要認得出來：a、b、c 和第一步的答案四個數兩兩不同（不然「c 放進 ×」判不出是哪一張） */
          if (new Set([e.a, e.b, e.c, v1]).size !== 4) fail(w + ': the cards ' + [e.a, e.b, e.c].join(',') + ' and the step-1 answer ' + v1 + ' are not all different');
          if (v2 > 99) fail(w + ': the answer ' + v2 + ' does not fit the answer box');
          const boxes = []; for (let b = 0; b < e.a; b++){ const cx = mySpread(e.a, b, RB.step); if (!near(D.spreadX(e.a, b, RB.step), cx)) fail(w + ': spreadX(' + e.a + ', ' + b + ') should be ' + cx); boxes.push(sq(cx, RB.y, RB.w, RB.h)); }
          boxes.forEach((o, b) => inside(o, w + ' box ' + b, W, Hh)); noHits(boxes, w + ': boxes');
          const dots = []; for (let k = 0; k < e.c; k++) dots.push(sq(mySpread(e.c, k, RL.step), RL.y, D.PILE_DOT));
          dots.forEach((o, k) => inside(o, w + ' loose ' + k, W, Hh)); noHits(dots, w + ': loose ones');
          /* 照遊戲的規則把每一種放法走一遍：× 那一排只收 a、b（散的 c 不收）；第二步要等第一步排好；
             第一步排好才有答案卡 v1；第二步收 v1 和 c。每一種走得到的結局都要算出 a × b ＋ c，而且一定走得完。 */
          const cards0 = ['a', 'b', 'c'], val = { a:e.a, b:e.b, c:e.c, v1:v1 };
          let ends = 0;
          const dfs = (slots, cards) => {
            const step1 = slots[0] && slots[1];
            const moves = [];
            cards.forEach(cd => [0, 1, 2, 3].forEach(si => {
              if (slots[si]) return;
              const row = si < 2 ? 0 : 1;
              if (row === 0 && cd === 'c') return;           /* 散的放進 × → 不收 */
              if (row === 1 && !step1) return;               /* 第一步還沒好 → 不收 */
              moves.push([cd, si]);
            }));
            if (slots.every(Boolean)){
              ends++;
              const S = slots.map(x => val[x]);
              if (!(S.slice(0, 2).sort().join() === [e.a, e.b].sort().join() && S.slice(2).sort().join() === [v1, e.c].sort().join())) fail(w + ': the rules let it finish as ' + S.join(','));
              const line = slots[2] === 'v1' ? S[0] + '×' + S[1] + '+' + S[3] : S[2] + '+' + S[0] + '×' + S[1];
              if (evalExpr(line) !== v2) fail(w + ': a finish of the rules, ' + line + ', does not make ' + v2);
              return;
            }
            if (!moves.length) return fail(w + ': stuck at ' + slots.join(','));
            moves.forEach(([cd, si]) => {
              const ns = slots.slice(); ns[si] = cd;
              let nc = cards.filter(x => x !== cd);
              if (ns[0] && ns[1] && !(slots[0] && slots[1])) nc = nc.concat(['v1']);   /* 第一步排好：答案卡出現 */
              dfs(ns, nc);
            });
          };
          dfs([null, null, null, null], cards0);
          if (!ends) fail(w + ': the relay can never be finished');
          /* 擋掉的「散的放進 ×」真的是錯的：c × a ＋ b、c × b ＋ a 都不是 a × b ＋ c */
          [[e.c, e.a, e.b], [e.c, e.b, e.a]].forEach(([x, y, z]) => { if (x * y + z === v2) fail(w + ': putting the loose ' + e.c + ' into × also makes ' + v2 + ' — the rule would reject a right answer'); });
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gRelayNow ' + L, d.gRelayNow(null), []);
            seq(w + ' gRelayNow(v1) ' + L, d.gRelayNow(v1), [v1]);
            seq(w + ' gRelayLoose ' + L, d.gRelayLoose(e.c), [e.c]);
            seq(w + ' gRelayFirst ' + L, d.gRelayFirst, []);
            seq(w + ' gRelay2 ' + L, d.gRelay2(null, e.a, e.b, e.c), [e.a, e.b, e.a, e.b]);
            seq(w + ' gRelay2(v1) ' + L, d.gRelay2(v1, e.a, e.b, e.c), [v1, e.c]);
            seq(w + ' gRelayBox ' + L, d.gRelayBox(e.b), [e.b]);
            [[e.a, e.b], [e.b, e.a]].forEach(([x, y]) => [true, false].forEach(left => {
              const ln = d.gRelayLine(x, y, e.c, v2, left);
              seq(w + ' gRelayLine ' + L, ln, left ? [x, y, e.c, v2] : [e.c, x, y, v2]);
              if (!scanEquations(ln).length) fail(w + ' gRelayLine ' + L + ': no equation found in ' + ln);
              seq(w + ' gRelayDone ' + L, d.gRelayDone(x, y, e.c, v1, v2, left), [x, y, v1].concat(left ? [v1, e.c] : [e.c, v1], [v2], left ? [x, y, e.c] : [e.c, x, y], [v2]));
            }));
          });
        });
        /* 版面：兩排、每排 ①、□、×／＋、□、＝、答案 —— 在畫板裡、互不重疊；圖在上面、卡片在下面 */
        const rowParts = y => [sq(EQ.lbl, y, 30, EQ.slot), sq(EQ.x[0], y, EQ.slot), sq(EQ.op, y, 24, EQ.slot), sq(EQ.x[1], y, EQ.slot), sq(EQ.eq, y, 24, EQ.slot), sq(EQ.res.x, y, EQ.res.w, EQ.slot)];
        EQ.y.forEach((y, r) => { const p = rowParts(y); p.forEach((o, k) => inside(o, 'relay: row ' + r + ' part ' + k, W, Hh)); noHits(p, 'relay: row ' + r + ' parts'); });
        if (EQ.y[1] - EQ.y[0] < EQ.slot + 2 * D.RELAY_PAD + 4) fail('relay: the two steps are closer than their drop pads');
        if (EQ.x[1] - EQ.x[0] < EQ.slot + 2 * D.RELAY_PAD + 4) fail('relay: the two boxes of a step are closer than their drop pads');
        if (RL.y + D.PILE_DOT / 2 > EQ.y[0] - h - D.RELAY_PAD - 4) fail('relay: the picture reaches the first step');
        if (RB.y + RB.h / 2 + 4 > RL.y - D.PILE_DOT / 2) fail('relay: the boxes touch the loose ones');
        const tray = [0, 1, 2].map(k => sq((W - 2 * TR.step) / 2 + k * TR.step, TR.y, D.GPICK));
        tray.forEach((o, k) => inside(o, 'relay: card ' + k, W, Hh)); noHits(tray, 'relay: cards');
        if (TR.y - D.GPICK / 2 < EQ.y[1] + h + D.RELAY_PAD + 4) fail('relay: the card tray reaches the second step');
        const ans = sq(EQ.res.x, EQ.y[0], D.GPICK);
        rowParts(EQ.y[0]).slice(0, 5).forEach((o, k) => { if (hit(ans, o)) fail('relay: the step-1 answer card overlaps row part ' + k); });
        need('relay', /var e = pick\(GAME_RELAY\), v1 = e\.a \* e\.b, v2 = v1 \+ e\.c/, 'the answers are not a × b and a × b + c');
        need('relay', /renderTray\(B, \[e\.a, e\.b, e\.c\], RELAY_TRAY\.y,/, 'the cards are not a, b and c');
        need('relay', /var s = nearestOpen\(slots, pt, RELAY_PAD\);\s*if \(!s\) return false;/, 'a drop away from every box is not silent');
        need('relay', /if \(s\.row === 0 && v === e\.c && !P\.data\.res\)\{ roundMiss\(d\.gRelayLoose\(e\.c\)\); return false; \}/, 'the loose ones are accepted in the × step');
        need('relay', /if \(s\.row === 1 && !step1\)\{ roundMiss\(d\.gRelayFirst\); return false; \}/, 'the second step can be filled before the first');
        need('relay', /if \(s\.row === 0 && slots\[0\]\.done && slots\[1\]\.done\)\{\s*step1 = true;\s*res\[0\]\.textContent = String\(v1\);/, 'the first step is not finished exactly when both × boxes are filled');
        need('relay', /if \(filled2 === 2\)\{\s*res\[1\]\.textContent = String\(v2\);[\s\S]*?roundSolved\(d\.gRelayDone\(slots\[0\]\.v, slots\[1\]\.v, e\.c, v1, v2, v1Left\)\);/, 'the round is not solved from what was placed when step 2 is full');
        need('relay', /var v1Left = slots\[2\]\.res;/, 'the combined line does not follow where the step-1 answer was put');
        need('relay', /\[0, 1\]\.forEach\(function\(s\)\{\s*slots\.push\(\{ row:r,/, 'cannot read how the step boxes are made');
        need('relay', /bz\.innerHTML = '📦<b>' \+ e\.b \+ '<\/b>';/, 'the boxes do not show how many are in each');
      }

      /* --- 第 2 關：併式（範例 2：把第一步整個搬進第二步；接到範例 3：先加的那一步要帶括號） --- */
      {
        const MR = D.MERGE_ROW, MP = D.MERGE_PART, MC = D.MERGE_CHUNK, h = MR.h / 2, Hh = D.MERGE_H;
        const myCells = (part, e) => {
          const s = part ? e.p + e.q : e.a * e.b, t = part ? s * e.r : s + e.c;
          const n = part ? (e.side === 'L' ? [['s', s], ['n', e.r]] : [['n', e.r], ['s', s]]) : [['s', s], ['n', e.c]];
          return { s, t, roles:[n[0][0], 'op', n[1][0], 'eq', 't'], vals:[n[0][1], null, n[1][1], null, t] };
        };
        const checkCells = (w, part, e, L) => {
          const mine = myCells(part, e), M = D.mergeCells(part, e, I18N[L].gOp.plus);
          if (M.s !== mine.s || M.t !== mine.t) fail(w + ': mergeCells() works out ' + M.s + ' → ' + M.t + ', should be ' + mine.s + ' → ' + mine.t);
          M.cells.forEach((c, k) => {
            if (c.role !== mine.roles[k] || (mine.vals[k] !== null && c.v !== mine.vals[k])) fail(w + ': mergeCells() box ' + k + ' is ' + c.role + ' ' + c.v + ', should be ' + mine.roles[k] + ' ' + mine.vals[k]);
            if (c.x !== MR.x[k] || c.w !== MR.w[k]) fail(w + ': mergeCells() box ' + k + ' is not at MERGE_ROW');
          });
          if (part === 0 && M.cells[1].text !== I18N[L].gOp.plus) fail(w + ' ' + L + ': the second step of pair 1 is not "+"');
          if (part === 1 && M.cells[1].text !== '×') fail(w + ' ' + L + ': the second step of pair 2 is not "×"');
          return mine;
        };
        D.GAME_MERGE.forEach((e, i) => {
          const w = 'GAME_MERGE[' + i + ']';
          if (![e.a, e.b, e.c].every(isInt)) return fail(w + ' is not whole numbers');
          const s = e.a * e.b, t = s + e.c;
          if (e.a < 3 || e.a > 9 || e.b < 3 || e.b > 9 || e.c < 2) fail(w + ': a, b should be 3~9 and c at least 2');
          if (new Set([s, e.c, t]).size !== 3) fail(w + ': the numbers in step 2 (' + [s, e.c, t].join(',') + ') are not all different — "drop it on ' + s + '" cannot be told apart');
          if (String(t).length > 2 || String(s).length > 2) fail(w + ': ' + s + ' / ' + t + ' do not fit the number boxes');
          LANGS.forEach(L => {
            const d = I18N[L], P = d.gOp.plus;
            checkCells(w, 0, e, L);
            /* 規則：第一步只能放在 s 上；放在 c 或答案上都不收。放在 s 上的結果自己拼、自己算 */
            const merged = e.a + ' × ' + e.b + ' ' + P + ' ' + e.c;
            if (evalExpr(merged) !== t) fail(w + ' ' + L + ': the combined ' + merged + ' does not make ' + t);
            if (evalExpr(e.c + '×' + e.b + '+' + s) === t) fail(w + ': dropping step 1 on the wrong number also makes ' + t);
            seq(w + ' gMergeNotThis ' + L, d.gMergeNotThis(e.c, s), [e.c, s]);
            seq(w + ' gMergeNotAns ' + L, d.gMergeNotAns(t, s), [t, s]);
            seq(w + ' gMerge2 ' + L, d.gMerge2(s, false), [s, s]);
            seq(w + ' gMergeOk ' + L, d.gMergeOk(merged, t), [e.a, e.b, e.c, t]);
          });
        });
        let anyL = false, anyR = false;
        D.GAME_MERGEB.forEach((e, i) => {
          const w = 'GAME_MERGEB[' + i + ']';
          if (![e.p, e.q, e.r].every(isInt) || (e.side !== 'L' && e.side !== 'R')) return fail(w + ' is not whole numbers with side L or R');
          if (e.side === 'L') anyL = true; else anyR = true;
          const s = e.p + e.q, t = s * e.r;
          if (e.p < 2 || e.q < 2 || e.r < 2 || e.r > 9) fail(w + ': p, q should be at least 2 and r 2~9');
          if (new Set([s, e.r, t]).size !== 3) fail(w + ': the numbers in step 2 (' + [s, e.r, t].join(',') + ') are not all different');
          if (String(t).length > 2) fail(w + ': ' + t + ' does not fit the number box');
          const bare = e.side === 'L' ? e.p + '+' + e.q + '×' + e.r : e.r + '×' + e.p + '+' + e.q, wrong = evalExpr(bare);
          if (wrong === t) fail(w + ': without brackets ' + bare + ' also makes ' + t + ' — the bracket rule would reject a right answer');
          LANGS.forEach(L => {
            const d = I18N[L], P = d.gOp.plus;
            checkCells(w, 1, e, L);
            const inner = e.p + ' ' + P + ' ' + e.q, merged = e.side === 'L' ? '(' + inner + ') × ' + e.r : e.r + ' × (' + inner + ')';
            if (evalExpr(merged) !== t) fail(w + ' ' + L + ': the combined ' + merged + ' does not make ' + t);
            const x = e.side === 'L' ? e.q : e.r, y = e.side === 'L' ? e.r : e.p, z = e.side === 'L' ? e.p : e.q;
            if (evalExpr(x + '×' + y + '+' + z) !== wrong) fail(w + ': the "without brackets" reason does not describe ' + bare);
            seq(w + ' gMergeNoBr ' + L, d.gMergeNoBr(x, y, x * y, z, wrong, t), [x, y, x * y, z, wrong, t]);
            seq(w + ' gMergeNotThis ' + L, d.gMergeNotThis(e.r, s), [e.r, s]);
            seq(w + ' gMergeNotAns ' + L, d.gMergeNotAns(t, s), [t, s]);
            seq(w + ' gMerge2 ' + L, d.gMerge2(s, true), [s, s]);
            D.GAME_MERGE.forEach(A => {
              const tA = A.a * A.b + A.c, mA = A.a + ' × ' + A.b + ' ' + P + ' ' + A.c;
              seq(w + ' gMergeDone ' + L, d.gMergeDone(mA, tA, merged, t), [A.a, A.b, A.c, tA].concat(e.side === 'L' ? [e.p, e.q, e.r] : [e.r, e.p, e.q], [t]));
            });
          });
        });
        if (!anyL || !anyR) fail('GAME_MERGEB: both (p + q) × r and r × (p + q) should appear');
        LANGS.forEach(L => [1, 2].forEach(k => seq('gMergeNow ' + L, I18N[L].gMergeNow(k), [k, 2])));
        /* 版面：兩組各三排（第一步、第二步、托盤），互不重疊、在畫板裡；兩組中間有分隔線 */
        MP.forEach((Y, p) => {
          const parts = [sq(MR.lbl, Y.y1, 30, MR.h), sq(D.MERGE_STEP1.x, Y.y1, D.MERGE_STEP1.w, MR.h), sq(MR.lbl, Y.y2, 30, MR.h)].concat(MR.x.map((x, k) => sq(x, Y.y2, MR.w[k], MR.h)));
          const chunks = p ? [sq(150 - MC.step / 2, Y.tray, MC.w, MC.h), sq(150 + MC.step / 2, Y.tray, MC.w, MC.h)] : [sq(150, Y.tray, MC.w, MC.h)];
          parts.concat(chunks).forEach((o, k) => inside(o, 'merge: pair ' + p + ' part ' + k, W, Hh));
          noHits(parts.concat(chunks), 'merge: pair ' + p + ' parts');
          if (Y.y2 - Y.y1 < MR.h + 4) fail('merge: pair ' + p + ' steps overlap');
          if (Y.tray - MC.h / 2 < Y.y2 + h + D.MERGE_PAD + 4) fail('merge: pair ' + p + ' pieces reach the second step (with its drop pad)');
          inside(sq((MR.x[0] - MR.w[0] / 2 + MR.x[4] + MR.w[4] / 2) / 2, Y.y2, MR.x[4] + MR.w[4] / 2 - (MR.x[0] - MR.w[0] / 2), MR.h), 'merge: the combined line', W, Hh);
        });
        if (!(MP[0].tray + MC.h / 2 < D.MERGE_SEP - 2 && D.MERGE_SEP + 2 < MP[1].y1 - h)) fail('merge: the line between the pairs is not between them');
        for (let k = 0; k < 4; k += 2) if (MR.x[k + 2] - MR.x[k] < (MR.w[k] + MR.w[k + 2]) / 2 + 2 * D.MERGE_PAD) fail('merge: number boxes ' + k + ' and ' + (k + 2) + ' — their drop pads touch');
        need('merge', /var step1 = p \? e\.p \+ ' ' \+ O\.plus \+ ' ' \+ e\.q : e\.a \+ ' × ' \+ e\.b;/, 'the first step is not p ＋ q / a × b');
        need('merge', /g\.merged = p \? \(e\.side === 'L' \? '\(' \+ step1 \+ '\) × ' \+ e\.r : e\.r \+ ' × \(' \+ step1 \+ '\)'\) : step1 \+ ' ' \+ O\.plus \+ ' ' \+ e\.c;/, 'the combined expression is not built from step 1 in brackets');
        need('merge', /var items = p \? \[\{ t:g\.step1, br:false \}, \{ t:'\(' \+ g\.step1 \+ '\)', br:true \}\] : \[\{ t:g\.step1, br:false \}\];/, 'pair 2 does not offer the piece with and without brackets');
        need('merge', /var s = nearestOpen\(g\.targets, pt, MERGE_PAD\);\s*if \(!s\) return false;/, 'a drop away from the number boxes is not silent (or reaches the other pair)');
        need('merge', /if \(s\.role === 'n'\)\{ roundMiss\(d\.gMergeNotThis\(s\.v, M\.s\)\); return false; \}\s*if \(s\.role === 't'\)\{ roundMiss\(d\.gMergeNotAns\(M\.t, M\.s\)\); return false; \}/, 'step 1 is accepted on a number it did not make');
        need('merge', /if \(part === 1 && !P\.data\.br\)\{\s*if \(e\.side === 'L'\) roundMiss\(d\.gMergeNoBr\(e\.q, e\.r, e\.q \* e\.r, e\.p, e\.p \+ e\.q \* e\.r, M\.t\)\);\s*else roundMiss\(d\.gMergeNoBr\(e\.r, e\.p, e\.r \* e\.p, e\.q, e\.r \* e\.p \+ e\.q, M\.t\)\);\s*return false;/, 'the addition without brackets is accepted in pair 2, or its reason does not describe the bare expression');
        need('merge', /if \(isNum\) g\.targets\.push\(\{ role:c\.role, v:c\.v,/, 'the drop targets are not the numbers of step 2');
        need('merge', /if \(part === 0\)\{\s*done1 = g;\s*part = 1; deal\(1\);/, 'pair 2 does not start after pair 1');
        need('merge', /roundSolved\(d\.gMergeDone\(done1\.merged, done1\.M\.t, g\.merged, M\.t\)\);/, 'the round is not solved with both combined expressions');
        need('merge', /deal\(0\);/, 'pair 1 is not dealt');
      }

      /* --- 第 3 關：加括號（範例 3） --- */
      {
        const BX = D.BRK_BOX, R = D.BRK_ROW, TR = D.BRK_TRAY, h = R.h / 2, Hh = D.BRK_H;
        let anyL = false, anyR = false;
        D.GAME_BRACKET.forEach((e, i) => {
          const w = 'GAME_BRACKET[' + i + ']';
          if (![e.a, e.b, e.c].every(isInt) || (e.form !== 'L' && e.form !== 'R')) return fail(w + ' is not whole numbers with form L or R');
          if (e.form === 'L') anyL = true; else anyR = true;
          if (e.a < 2 || e.b < 2 || e.a + e.b > 7) fail(w + ': ' + e.a + ' + ' + e.b + ' boxes — the picture holds 2~7, at least 2 in each pile');
          if (e.c < 4 || e.c > 15) fail(w + ': ' + e.c + ' per box should be 4~15');
          if (new Set([e.a, e.b, e.c]).size !== 3) fail(w + ': ' + [e.a, e.b, e.c].join(',') + ' are not all different — the reasons name the numbers');
          const s1 = e.a + e.b, v = s1 * e.c, n = e.form === 'L' ? [e.a, e.b, e.c] : [e.c, e.a, e.b];
          const needMine = e.form === 'L' ? { o:0, c:1 } : { o:1, c:2 }, needPage = D.brNeed(e.form);
          if (needPage.o !== needMine.o || needPage.c !== needMine.c) fail(w + ': brNeed(' + e.form + ') is ' + JSON.stringify(needPage) + ', should be ' + JSON.stringify(needMine));
          /* 每一種「(」「)」的位置：自己拼、自己算。收的那一種一定是 (a + b) × c；只要「(」或「)」放錯，不管另一個放哪裡都算不出來 */
          const opsMine = e.form === 'L' ? ['+', '×'] : ['×', '+'];
          const build = (o, c) => n.map((x, k) => (k === o ? '(' : '') + x + (k === c ? ')' : '') + (k < 2 ? opsMine[k] : '')).join('');
          [0, 1].forEach(o => [1, 2].forEach(c => {
            const val = evalExpr(build(o, c));
            const ok = o === needMine.o && c === needMine.c;
            if (ok && val !== v) fail(w + ': the accepted ' + build(o, c) + ' makes ' + val + ', not ' + v);
            if (!ok && val === v) fail(w + ': ' + build(o, c) + ' also makes ' + v + ' — the rule rejects a right answer');
          }));
          const bare = n[0] + opsMine[0] + n[1] + opsMine[1] + n[2], wrong = evalExpr(bare);
          if (wrong === v) fail(w + ': without brackets it also makes ' + v + ' — the brackets change nothing');
          LANGS.forEach(L => {
            const d = I18N[L], P = d.gOp.plus;
            const row = D.brRow(e, P);
            const kinds = row.map(c => c.k).join(), wantK = 'o,n,op,o,n,c,op,n,c';
            if (kinds !== wantK) fail(w + ' ' + L + ': brRow() is ' + kinds + ', should be ' + wantK);
            const texts = row.filter(c => c.k === 'n' || c.k === 'op').map(c => c.text).join(' ');
            const wantT = [n[0], e.form === 'L' ? P : '×', n[1], e.form === 'L' ? '×' : P, n[2]].join(' ');
            if (texts !== wantT) fail(w + ' ' + L + ': brRow() reads ' + texts + ', should be ' + wantT);
            const gaps = row.filter(c => c.k === 'o' || c.k === 'c').map(c => c.k + c.id + ':' + c.num).join();
            const wantG = ['o0:' + n[0], 'o1:' + n[1], 'c1:' + n[1], 'c2:' + n[2]].join();
            if (gaps !== wantG) fail(w + ' ' + L + ': the bracket gaps are ' + gaps + ', should be ' + wantG);
            /* 每一個空位都要分得出種類：「(」的空位緊接在數字前面、「)」的空位緊跟在數字後面 —— 放錯種類的那一句才是真的 */
            row.forEach((c, k) => {
              if (c.k === 'o' && !(row[k + 1] && row[k + 1].k === 'n' && +row[k + 1].text === c.num)) fail(w + ' ' + L + ': "(" gap ' + c.id + ' is not right before the number ' + c.num);
              if (c.k === 'c' && !(row[k - 1] && row[k - 1].k === 'n' && +row[k - 1].text === c.num)) fail(w + ' ' + L + ': ")" gap ' + c.id + ' is not right after the number ' + c.num);
            });
            const total = row.reduce((x, c) => x + c.w, 0);
            let x0 = 150 - total / 2;
            row.forEach((c, k) => { if (!near(c.x, x0 + c.w / 2)) fail(w + ' ' + L + ': brRow() part ' + k + ' is not packed in a centred row'); x0 += c.w; });
            const parts = row.map(c => sq(c.x, R.y, c.w, R.h));
            parts.forEach((o, k) => inside(o, w + ' row part ' + k, W, Hh)); noHits(parts, w + ': row parts');
            ['o', 'c'].forEach(k => { const g = row.filter(c => c.k === k); if (Math.abs(g[1].x - g[0].x) < R.slot + 2 * D.BRK_PAD) fail(w + ': the two "' + k + '" gaps are closer than their drop pads'); });
            seq(w + ' gBrStory ' + L, d.gBrStory(e.a, e.b, e.c), [e.a, e.b, e.c]);
            const wrongOpen = n[1 - needMine.o], wrongClose = n[needMine.c === 1 ? 2 : 1];
            seq(w + ' gBrOpenAt ' + L, d.gBrOpenAt(wrongOpen, e.a, e.b), [wrongOpen, e.a, e.b, e.a]);
            seq(w + ' gBrCloseAt ' + L, d.gBrCloseAt(wrongClose, e.a, e.b), [wrongClose, e.a, e.b, e.b]);
            seq(w + ' gBr2 ' + L, d.gBr2(e.a, e.b), [e.a, e.b]);
            /* 說明的理由要成立：要先加的是 a ＋ b，「(」要在 a 前面、「)」要在 b 後面 —— 這正是收的那一種 */
            if (n[needMine.o] !== e.a || n[needMine.c] !== e.b) fail(w + ': the accepted gaps are not "before ' + e.a + '" and "after ' + e.b + '" as the reasons say');
            const inner = '(' + e.a + ' ' + P + ' ' + e.b + ')';
            const expr = e.form === 'L' ? inner + ' × ' + e.c : e.c + ' × ' + inner, mid = e.form === 'L' ? s1 + ' × ' + e.c : e.c + ' × ' + s1;
            const bareT = e.form === 'L' ? e.a + ' ' + P + ' ' + e.b + ' × ' + e.c : e.c + ' × ' + e.a + ' ' + P + ' ' + e.b;
            if (evalExpr(bareT) !== wrong) fail(w + ' ' + L + ': "without brackets" ' + bareT + ' does not make ' + wrong);
            seq(w + ' gBrDone ' + L, d.gBrDone(expr, mid, v, bareT, wrong), nums(expr).concat(nums(mid), [v, v], nums(bareT), [wrong]));
          });
          /* 圖：原本 a 盒、送的 b 盒，兩堆中間空一點 */
          const boxes = [];
          for (let k = 0; k < e.a + e.b; k++){
            const cx = mySpread(e.a + e.b, k, BX.step) + (k < e.a ? -1 : 1) * BX.gap / 2;
            if (!near(D.brBoxX(e.a, e.b, k), cx)) fail(w + ': brBoxX(' + k + ') should be ' + cx);
            boxes.push(sq(cx, BX.y, BX.w, BX.h));
          }
          boxes.forEach((o, k) => inside(o, w + ' box ' + k, W, Hh)); noHits(boxes, w + ': boxes');
          if (boxes[e.a].x - (boxes[e.a - 1].x + BX.w) < BX.gap) fail(w + ': the two piles of boxes are not apart');
        });
        if (!anyL || !anyR) fail('GAME_BRACKET: both a ＋ b × c and c × a ＋ b should appear (brackets at the start and at the end)');
        if (BX.y + BX.h / 2 > D.BRK_LBL.y - D.BRK_LBL.h / 2) fail('bracket: the box labels overlap the boxes');
        if (D.BRK_LBL.y + D.BRK_LBL.h / 2 > R.y - h - D.BRK_PAD) fail('bracket: the labels reach the expression');
        const tray = [sq(150 - TR.step / 2, TR.y, TR.size), sq(150 + TR.step / 2, TR.y, TR.size)];
        tray.forEach((o, k) => inside(o, 'bracket: piece ' + k, W, Hh)); noHits(tray, 'bracket: pieces');
        if (TR.y - TR.size / 2 < R.y + h + D.BRK_PAD + 4) fail('bracket: the pieces reach the expression (with its drop pad)');
        need('bracket', /var s = nearestOpen\(slots, pt, BRK_PAD\);\s*if \(!s\) return false;\s*\/\*[^*]*\*\/\s*if \(s\.k !== P\.data\.k\)\{ roundMiss\(P\.data\.k === 'o' \? d\.gBrKindO : d\.gBrKindC\); return false; \}/, 'a bracket dropped in a gap of the other kind is not explained as a mistake, or a drop away from the gaps is not silent');
        LANGS.forEach(L => ['gBrKindO', 'gBrKindC'].forEach(k => { const t = I18N[L][k]; if (typeof t !== 'string' || !t) fail(k + ' missing in ' + L); else if (nums(t).length) fail(k + ' ' + L + ': should name no numbers'); }));
        need('bracket', /if \(s\.id !== need\[s\.k\]\)\{ roundMiss\(s\.k === 'o' \? d\.gBrOpenAt\(s\.num, e\.a, e\.b\) : d\.gBrCloseAt\(s\.num, e\.a, e\.b\)\); return false; \}/, 'a bracket in the wrong gap is accepted');
        need('bracket', /need = brNeed\(e\.form\)/, 'the right gaps are not brNeed()');
        need('bracket', /data:\{ k:t === '\(' \? 'o' : 'c' \}/, 'the pieces do not know which kind of bracket they are');
        need('bracket', /var inner = '\(' \+ e\.a \+ ' ' \+ O\.plus \+ ' ' \+ e\.b \+ '\)';\s*var expr = e\.form === 'L' \? inner \+ ' × ' \+ e\.c : e\.c \+ ' × ' \+ inner;\s*var mid = e\.form === 'L' \? s1 \+ ' × ' \+ e\.c : e\.c \+ ' × ' \+ s1;\s*var bare = e\.form === 'L' \? e\.a \+ ' ' \+ O\.plus \+ ' ' \+ e\.b \+ ' × ' \+ e\.c : e\.c \+ ' × ' \+ e\.a \+ ' ' \+ O\.plus \+ ' ' \+ e\.b;\s*var wrong = e\.form === 'L' \? e\.a \+ e\.b \* e\.c : e\.c \* e\.a \+ e\.b;\s*roundSolved\(d\.gBrDone\(expr, mid, v, bare, wrong\)\);/, 'the finished message is not built from a, b, c the way the check rebuilds it');
        need('bracket', /var s1 = e\.a \+ e\.b, v = s1 \* e\.c;/, 'the answer is not (a + b) × c');
        need('bracket', /if \(placed === 2\)\{/, 'the round is not solved exactly when both brackets are in');
        need('bracket', /brRow\(e, O\.plus\)\.forEach/, 'the expression is not drawn from brRow()');
        need('bracket', /addZone\(B, brBoxX\(e\.a, e\.b, i\) - BX\.w \/ 2, BX\.y - BX\.h \/ 2, BX\.w, BX\.h, 'gbx ' \+ \(i < e\.a \? 'gold' : 'gnew'\), String\(e\.c\)\);/, 'the boxes are not drawn at brBoxX() with c in each');
      }

      /* --- 第 4 關：電腦怎麼算（範例 4：先乘除、後加減；括號最優先） --- */
      {
        const K = D.CALC_TOK, Hh = D.CALC_H;
        if (D.CALC_FORMS.slice().sort().join() !== 'addMul,brk,mulAdd') fail('CALC_FORMS should be the three lines a ＋ b × c, (a ＋ b) × c, a × b ＋ c');
        D.GAME_CALC.forEach((e, i) => {
          const w = 'GAME_CALC[' + i + ']';
          if (![e.a, e.b, e.c].every(isInt)) return fail(w + ' is not whole numbers');
          if (new Set([e.a, e.b, e.c]).size !== 3 || Math.min(e.a, e.b, e.c) < 2 || Math.max(e.a, e.b, e.c) > 9) fail(w + ': a, b, c should be different one-digit numbers from 2');
          const vals = {};
          D.CALC_FORMS.forEach(f => {
            const P = '+';
            const str = f === 'addMul' ? e.a + '+' + e.b + '×' + e.c : f === 'brk' ? '(' + e.a + '+' + e.b + ')×' + e.c : e.a + '×' + e.b + '+' + e.c;
            const v = evalExpr(str); vals[f] = v;
            if (D.calcValue(f, e) !== v) fail(w + ': calcValue(' + f + ') is ' + D.calcValue(f, e) + ', should be ' + v);
            /* 先做第 k 個符號：自己把那兩個數併起來再算剩下的。收的那一個一定得到正解；擋掉的那一個一定得到別的數 */
            const n = [e.a, e.b, e.c], ops = f === 'mulAdd' ? ['×', '+'] : ['+', '×'];
            const ap = (x, op, y) => op === '×' ? x * y : x + y;
            const first0 = ap(ap(n[0], ops[0], n[1]), ops[1], n[2]), first1 = ap(n[0], ops[0], ap(n[1], ops[1], n[2]));
            const fp = D.calcFirst(f), right = fp === 0 ? first0 : first1, other = fp === 0 ? first1 : first0;
            if (right !== v) fail(w + ': doing sign ' + fp + ' of ' + str + ' first gives ' + right + ', not ' + v + ' — calcFirst() points at the wrong sign');
            if (other === v) fail(w + ': doing the other sign of ' + str + ' first also gives ' + v + ' — the rule rejects a right order');
            /* 算完第一步，下面那一行要寫的數（自己算） */
            const mid = f === 'addMul' ? [e.a, e.b * e.c] : f === 'brk' ? [e.a + e.b, e.c] : [e.a * e.b, e.c];
            LANGS.forEach(L => {
              const O = I18N[L].gOp, p1 = D.calcProgress(f, e, 1, O.plus, O.eq), p2 = D.calcProgress(f, e, 2, O.plus, O.eq);
              if (nums(p1).join() !== mid.join() || evalExpr(p1.replace(O.eq, '')) !== v) fail(w + ' ' + L + ': after the first tap ' + str + ' should read ' + mid.join(' … ') + ' (still worth ' + v + '), got ' + p1);
              if (nums(p2).join() !== mid.concat([v]).join() || p2.indexOf(p1) !== 0) fail(w + ' ' + L + ': after the second tap ' + str + ' should read ' + mid.join(' … ') + ' = ' + v + ', got ' + p2);
              scanEquations(str + p2).filter(x => x.bad).forEach(x => fail(w + ' ' + L + ': the worked-out line "' + x.text + '" ' + x.bad));
              const toks = D.calcTokens(f, e, O.plus);
              const txt = toks.map(t => t.text).join(''), wantTxt = str.replace('+', O.plus);
              if (txt !== wantTxt) fail(w + ' ' + L + ': calcTokens(' + f + ') reads ' + txt + ', should be ' + wantTxt);
              if (toks.filter(t => t.k === 'op').map(t => t.op).join() !== '0,1') fail(w + ' ' + L + ': the signs of ' + str + ' are not numbered 0, 1 left to right');
              if (toks.some(t => t.w !== (t.k === 'n' ? K.num : t.k === 'op' ? K.op : K.par))) fail(w + ' ' + L + ': a token of ' + str + ' is not its CALC_TOK size');
              let x0 = 150 - (toks.reduce((s, t) => s + t.w, 0) + K.gap * (toks.length - 1)) / 2;
              toks.forEach((t, k) => { if (!near(t.x, x0 + t.w / 2)) fail(w + ' ' + L + ': token ' + k + ' of ' + str + ' is not packed in a centred row'); x0 += t.w + K.gap; });
              D.CALC_Y.forEach((y, r) => {
                const parts = toks.map(t => sq(t.x, y, t.w, K.h));
                parts.forEach((o, k) => inside(o, w + ' line ' + r + ' token ' + k, W, Hh)); noHits(parts, w + ': line ' + r + ' tokens');
              });
            });
            LANGS.forEach(L => {
              const d = I18N[L], O = d.gOp;
              const pr = f === 'addMul' ? [e.b, '×', e.c] : f === 'brk' ? [e.a, O.plus, e.b] : [e.a, '×', e.b];
              seq(w + ' gCalc2 ' + L, d.gCalc2(pr[0], pr[1], pr[2]), [pr[0], pr[2]]);
              if (f === 'brk') seq(w + ' gCalcBr ' + L, d.gCalcBr(e.a, e.b, e.a + e.b), [e.a, e.b, e.a + e.b]);
              else seq(w + ' gCalcMul ' + L, d.gCalcMul(pr[0], pr[2], pr[0] * pr[2]), [pr[0], pr[2], pr[0] * pr[2]]);
            });
          });
          if (new Set(Object.values(vals)).size !== 3) fail(w + ': the three lines make ' + JSON.stringify(vals) + ' — not three different answers');
          LANGS.forEach(L => seq(w + ' gCalcDone ' + L, I18N[L].gCalcDone(e.a, e.b, e.c, vals.addMul, vals.brk, vals.mulAdd), [e.a, e.b, e.c, vals.addMul, e.a, e.b, e.c, vals.brk, e.a, e.b, e.c, vals.mulAdd]));
        });
        LANGS.forEach(L => { [1, 2, 3].forEach(k => seq('gCalcNow ' + L, I18N[L].gCalcNow(k), [k, 3])); seq('gCalcNext ' + L, I18N[L].gCalcNext, []); });
        for (let r = 1; r < D.CALC_Y.length; r++) if (D.CALC_Y[r] - K.h / 2 < D.CALC_Y[r - 1] + D.CALC_PROG + 12 + 2) fail('calc: line ' + r + ' overlaps the worked-out line above it');
        D.CALC_Y.forEach((y, r) => { inside({ x:20, y:y + D.CALC_PROG - 12, w:260, h:24 }, 'calc: worked-out line ' + r, W, Hh); if (D.CALC_PROG - 12 < K.h / 2) fail('calc: the worked-out line overlaps its tokens'); });
        if (D.CALC_Y.length !== 3) fail('calc: three lines are drawn');
        need('calc', /var e = pick\(GAME_CALC\), O = d\.gOp, forms = shuffle\(CALC_FORMS\),/, 'the three lines are not shuffled');
        need('calc', /if \(gSolved \|\| r !== row\) return;/, 'a sign in a line that is not up yet can be tapped');
        need('calc', /b\.disabled = r !== 0;/, 'the lines after the first are not locked at the start');
        need('calc', /var R = rows\[r\], first = calcFirst\(R\.form\);\s*if \(R\.step === 0 && op !== first\)\{\s*roundMiss\(R\.form === 'brk' \? d\.gCalcBr\(e\.a, e\.b, e\.a \+ e\.b\) : R\.form === 'addMul' \? d\.gCalcMul\(e\.b, e\.c, e\.b \* e\.c\) : d\.gCalcMul\(e\.a, e\.b, e\.a \* e\.b\)\);\s*return;\s*\}/, 'the wrong sign first is accepted, or its reason does not name the right pair');
        need('calc', /if \(R\.step === 1 && op === first\) return;/, 'the same sign tapped twice counts as the second step');
        need('calc', /R\.prog\.textContent = calcProgress\(R\.form, e, R\.step, O\.plus, O\.eq\);/, 'the worked-out line is not calcProgress()');
        need('calc', /roundSolved\(d\.gCalcDone\(e\.a, e\.b, e\.c, calcValue\('addMul', e\), calcValue\('brk', e\), calcValue\('mulAdd', e\)\)\);/, 'the finished message is not the three values');
        need('calc', /var y = CALC_Y\[r\], toks = calcTokens\(f, e, O\.plus\)/, 'the lines are not drawn from calcTokens()');
        need('calc', /R\.prog = addZone\(B, 20, y \+ CALC_PROG - 12, 260, 24,/, 'cannot read where the worked-out line is drawn');
      }

      /* --- 第 5 關：對故事（範例 5） --- */
      {
        const MS = D.MATCH_SLOT, PK = D.MATCH_PACK, DT = D.MATCH_DOT, Hh = D.MATCH_H;
        if (D.MATCH_KINDS.slice().sort().join() !== 'br,mb,mc') fail('MATCH_KINDS should be the three stories');
        D.GAME_MATCH.forEach((e, i) => {
          const w = 'GAME_MATCH[' + i + ']';
          if (![e.a, e.b, e.c].every(isInt)) return fail(w + ' is not whole numbers');
          if (e.b === e.c) fail(w + ': b = c — the two "+ loose" stories would be the same picture');
          if (e.b < 2 || e.c < 2 || e.b > 5 || e.c > 5 || e.b + e.c > 7) fail(w + ': ' + e.b + ' and ' + e.c + ' should be 2~5, together at most 7 packs');
          if (e.a < 3 || e.a > 9 || e.a === e.b || e.a === e.c) fail(w + ': ' + e.a + ' per pack should be 3~9 and not one of the counts');
          const mine = {
            mb:{ ex:e.a + '×' + e.b + '+' + e.c, n1:e.b, n2:0, loose:e.c }, mc:{ ex:e.a + '×' + e.c + '+' + e.b, n1:e.c, n2:0, loose:e.b },
            br:{ ex:'(' + e.b + '+' + e.c + ')×' + e.a, n1:e.b, n2:e.c, loose:0 }
          };
          const pics = {};
          D.MATCH_KINDS.forEach(k => {
            const m = mine[k], ex = D.matchExpr(k, e), v = evalExpr(m.ex);
            if (ex !== m.ex) fail(w + ': matchExpr(' + k + ') is ' + ex + ', should be ' + m.ex);
            if (D.matchVal(k, e) !== v) fail(w + ': matchVal(' + k + ') is ' + D.matchVal(k, e) + ', should be ' + v);
            if (D.matchLoose(k, e) !== m.loose) fail(w + ': matchLoose(' + k + ') should be ' + m.loose);
            /* 圖：第一堆 n1 包、第二堆 n2 包（中間空 gap）、散的接在後面 */
            const p = D.matchPic(k, e);
            const wantPacks = []; for (let j = 0; j < m.n1 + m.n2; j++) wantPacks.push({ x:PK.x0 + PK.w / 2 + j * PK.step + (j >= m.n1 ? PK.gap : 0), g:j >= m.n1 ? 1 : 0 });
            const x0 = PK.x0 + (m.n1 - 1) * PK.step + PK.w + PK.gap + DT.size / 2, wantDots = []; for (let j = 0; j < m.loose; j++) wantDots.push(x0 + j * DT.step);
            if (JSON.stringify(p.packs) !== JSON.stringify(wantPacks) || JSON.stringify(p.dots) !== JSON.stringify(wantDots)) fail(w + ': matchPic(' + k + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify({ packs:wantPacks, dots:wantDots }));
            const items = p.packs.map(q => sq(q.x, 0, PK.w, PK.h)).concat(p.dots.map(x => sq(x, 0, DT.size)));
            noHits(items, w + ' ' + k + ': picture');
            items.forEach((o, j) => { if (o.x < 2 || o.x + o.w > MS.x - MS.w / 2 - MATCH_GAP) fail(w + ' ' + k + ': picture part ' + j + ' runs into the slot or the edge'); });
            /* 讀圖（只用畫出來的東西）：一堆 → 每包 a 個 × 包數 ＋ 散的；兩堆 → (兩堆包數相加) × a */
            const g1 = p.packs.filter(q => !q.g).length, g2 = p.packs.length - g1;
            pics[k] = g2 ? '(' + g1 + '+' + g2 + ')×' + e.a : e.a + '×' + g1 + '+' + p.dots.length;
          });
          /* 畫面決定得了答案：每一列讀出來的算式剛好是一張卡、而且就是它自己那一張；三列的圖兩兩不同 */
          D.MATCH_KINDS.forEach(k => {
            const hits = D.MATCH_KINDS.filter(c => D.matchExpr(c, e) === pics[k]);
            if (hits.length !== 1 || hits[0] !== k) fail(w + ': the ' + k + ' picture reads ' + pics[k] + ', which matches the cards ' + JSON.stringify(hits));
          });
          if (new Set(D.MATCH_KINDS.map(k => evalExpr(mine[k].ex))).size !== 3) fail(w + ': two stories make the same total');
          /* 規則：每一張卡放進每一列 —— 只收自己的那一列；放錯的說明照卡片與那一列算，而且說的是真的（加的數 ≠ 散的個數） */
          LANGS.forEach(L => {
            const d = I18N[L];
            D.MATCH_KINDS.forEach(ck => D.MATCH_KINDS.forEach(rk => {
              if (ck === rk) return;
              const x = mine[ck].loose, y = mine[rk].loose, tag = w + ' card ' + ck + ' on ' + rk + ' ' + L;
              if (ck === 'br') seq(tag + ' gMatchHasLoose', d.gMatchHasLoose(y), [y]);
              else if (rk === 'br') seq(tag + ' gMatchNoLoose', d.gMatchNoLoose(x), [x]);
              else { seq(tag + ' gMatchLoose', d.gMatchLoose(x, y), [x, y]); if (x === y) fail(tag + ': the reason says the card adds a different number, but both are ' + x); }
            }));
            [1, 2, 3].forEach(r => { seq(w + ' gMatchRow ' + L, d.gMatchRow(r), [r]); D.MATCH_KINDS.forEach(k => { const y = mine[k].loose; seq(w + ' gMatch2 ' + L, d.gMatch2(r, y), y ? [r, y, y] : [r]); }); });
            const ks = ['mb', 'br', 'mc'];
            seq(w + ' gMatchDone ' + L, d.gMatchDone(mine[ks[0]].ex, evalExpr(mine[ks[0]].ex), mine[ks[1]].ex, evalExpr(mine[ks[1]].ex), mine[ks[2]].ex, evalExpr(mine[ks[2]].ex)),
              ks.reduce((acc, k) => acc.concat(nums(mine[k].ex), [evalExpr(mine[k].ex)]), []));
          });
        });
        LANGS.forEach(L => [0, 1, 2, 3].forEach(k => seq('gMatchNow ' + L, I18N[L].gMatchNow(k), [k, 3])));
        /* 版面：三列不重疊、空格在畫板裡；卡片托盤在最下面、不重疊 */
        const slots = D.MATCH_Y.map(y => sq(MS.x, y, MS.w, MS.h));
        slots.forEach((o, k) => inside(o, 'match: slot ' + k, W, Hh)); noHits(slots, 'match: slots');
        for (let r = 1; r < D.MATCH_Y.length; r++) if (D.MATCH_Y[r] - D.MATCH_Y[r - 1] < Math.max(MS.h, PK.h) + 2 * D.MATCH_PAD + 4) fail('match: rows ' + (r - 1) + ' and ' + r + ' — their drop pads touch');
        D.MATCH_Y.forEach((y, r) => inside(sq(150, y, 296, PK.h), 'match: row ' + r + ' picture', W, Hh));
        const tray = [0, 1, 2].map(k => sq((W - 2 * D.MATCH_TRAY.step) / 2 + k * D.MATCH_TRAY.step, D.MATCH_TRAY.y, D.MATCH_CARD.w, D.MATCH_CARD.h));
        tray.forEach((o, k) => inside(o, 'match: card ' + k, W, Hh)); noHits(tray, 'match: cards');
        if (D.MATCH_TRAY.y - D.MATCH_CARD.h / 2 < D.MATCH_Y[2] + MS.h / 2 + D.MATCH_PAD + 4) fail('match: the cards reach the last row (with its drop pad)');
        need('match', /var e = pick\(GAME_MATCH\), kinds = shuffle\(MATCH_KINDS\),/, 'the story rows are not shuffled');
        need('match', /renderTray\(B, MATCH_KINDS, MATCH_TRAY\.y,/, 'the cards are not the three stories');
        need('match', /var s = nearestOpen\(slots, pt, MATCH_PAD\);\s*if \(!s\) return false;/, 'a drop away from the story slots is not silent');
        need('match', /if \(ck !== s\.kind\)\{\s*if \(ck === 'br'\) roundMiss\(d\.gMatchHasLoose\(matchLoose\(s\.kind, e\)\)\);\s*else if \(s\.kind === 'br'\) roundMiss\(d\.gMatchNoLoose\(matchLoose\(ck, e\)\)\);\s*else roundMiss\(d\.gMatchLoose\(matchLoose\(ck, e\), matchLoose\(s\.kind, e\)\)\);\s*return false;\s*\}/, 'a card is accepted next to another story, or its reason is not the card and the row');
        need('match', /if \(matched === 3\)\{/, 'the round is not solved exactly when all three are matched');
        need('match', /var y = MATCH_Y\[r\], pic = matchPic\(k, e\);/, 'the pictures are not matchPic()');
        need('match', /addZone\(B, p\.x - PK\.w \/ 2, y - PK\.h \/ 2, PK\.w, PK\.h, 'gpack' \+ \(p\.g \? ' gnew' : ' gold'\), String\(e\.a\)\);/, 'the packs are not drawn with a in each');
      }
    }
  }
};
module.exports._test = { scanEquations, evalExpr, stepKey, storyValue };
