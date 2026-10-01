/* grade-3/math/multiply 的檢查設定（直式乘法工廠：拆成十和個、直式進位、二位數 × 二位數的四塊與第二排往左移、先估再算）。
   2026-10-01 新增 —— 三年級第一份設定檔，和小遊戲「工廠出貨」改成五關五種玩法（§六之五）同一次寫成。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算），
   選項一律是正整數。inverseMissingFactor 的誘答「乘積 p」是刻意的迷思（把乘積當成答案），白名單只放行那一個值。

   data（index.html）：
   - 題庫與所有 I18N 靜態字串裡的「a × b = c」「a + b = c」逐條重算（範例、估算卡、解釋）。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關的答案在這裡用自己的算法重算（剪在哪裡、直式每一格與進位、四塊面積、第二排移幾格、估計與合理與否），
     頁面的純函式（splitCutX／splitNearest／columnSteps／estOk）一律**拿整個輸入範圍去呼叫**再和自己的算法比，
     nearestOpen() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。
     版面數字一律從 index.html 讀，不在這裡另抄一份。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 scratchpad 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
/* 二位數估成最接近的整十；一位數不估。個位是 5 的不出題（四捨五入在三年級還沒教，最近的整十有兩個）。 */
function myRound(n){ if (n < 10) return n; const o = n % 10; return o < 5 ? n - o : n - o + 10; }
/* 直式（多位數 × 一位數）每一格的第二套實作：一欄一欄算，記「這一格」是哪一種、在哪一欄、寫什麼 */
function mySteps(a, d){
  const ds = String(a).split('').reverse().map(Number), out = [];
  let carry = 0;
  ds.forEach((g, i) => {
    const prod = g * d, tot = prod + carry, last = i === ds.length - 1;
    out.push({ kind:'r', col:i, v:tot % 10, from:i, digit:g, prod, cin:carry, tot });
    if (tot >= 10) out.push({ kind:last ? 'r' : 'c', col:i + 1, v:Math.floor(tot / 10), from:i, digit:g, prod, cin:carry, tot });
    carry = last ? 0 : Math.floor(tot / 10);
  });
  return out;
}

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });" },
    { file:'index', expect:'GAME_SPLIT should be a pool', find:'  var GAME_SPLIT = [ ', replace:'  var GAME_SPLIT = [] || [ ' },
    { file:'index', expect:'ones digit is 0', find:'{ a:23, d:4 }, { a:27, d:3 }', replace:'{ a:20, d:4 }, { a:27, d:3 }' },
    { file:'index', expect:'columns narrower than 8', find:'{ a:25, d:4 }, { a:28, d:3 }', replace:'{ a:35, d:4 }, { a:28, d:3 }' },
    { file:'index', expect:'rows do not fit above the labels', find:'{ a:26, d:5 }, { a:24, d:6 } ];', replace:'{ a:26, d:5 }, { a:24, d:8 } ];' },
    { file:'index', expect:'splitCutX(',
      find:"    return j % 10 === 0 ? splitColX(a, j) - SPLIT_ARR.gap / 2 : splitColX(a, j);",
      replace:"    return splitColX(a, j);" },
    /* 縫上的那幾條被「推遠」：靠近整十那一條的點會被判到隔壁 —— 剪對的地方就剪不到了 */
    { file:'index', expect:'splitNearest(',
      find:"var dd = Math.abs(splitCutX(a, j) - x); if (dd < bd){ bd = dd; best = j; }",
      replace:"var dd = Math.abs(splitCutX(a, j) - x) + (j % 10 === 0 ? 20 : 0); if (dd < bd){ bd = dd; best = j; }" },
    /* 只認得縫附近 1px、其他地方回端點 0（codex 第一輪） */
    { file:'index', expect:'splitNearest(',
      find:"var dd = Math.abs(splitCutX(a, j) - x); if (dd < bd){ bd = dd; best = j; }",
      replace:"var dd = Math.abs(splitCutX(a, j) - x); if (dd < bd && dd < 1){ bd = dd; best = j; }" },
    { file:'index', expect:'gAreaNot zh',
      find:"return '這一塊是 ' + w + ' × ' + h + '，不是 ' + v + '，再算算看。';",
      replace:"return '這一塊是 ' + w + ' × ' + h + '，不是 ' + (v === w * h ? v : v + 1) + '，再算算看。';" },
    { file:'index', expect:'the knob sticks out of the board', find:'SPLIT_ARR = { x:24, y:72, w:252,', replace:'SPLIT_ARR = { x:24, y:72, w:270,' },
    { file:'index', expect:'the knob covers the top row', find:'SPLIT_KNOB = { y:30, size:48 }', replace:'SPLIT_KNOB = { y:56, size:48 }' },
    { file:'index', expect:'any cut is accepted', find:'        if (j !== T){ roundMiss(', replace:'        if (j === -1){ roundMiss(' },
    { file:'index', expect:'gSplitOnes zh', find:"'：左邊的 ' + j + ' 多帶了 ' + (j - T) + ' 個「個」", replace:"'：左邊的 ' + j + ' 多帶了 ' + (j - 10) + ' 個「個」" },
    { file:'index', expect:'gSplitDone en', find:"' = ' + (T * d) + ' + ' + (O * d) + ' = ' + (a * d) + '! Split it", replace:"' = ' + (T * d) + ' + ' + (O * d) + ' = ' + (a * d + 1) + '! Split it" },

    { file:'index', expect:'no carry in a middle column', find:'var GAME_COLUMN = [ { a:27, d:4 },', replace:'var GAME_COLUMN = [ { a:12, d:4 },' },
    { file:'index', expect:'no entry leaves a carry box unused', find:'{ a:214, d:3 }, { a:129, d:7 } ];', replace:'{ a:254, d:3 }, { a:129, d:7 } ];' },
    { file:'index', expect:'columnSteps(',
      find:"      if (s.total >= 10) out.push(Object.assign({ kind:s.isLast ? 'r' : 'c', col:s.i + 1, v:Math.floor(s.total / 10) }, base));",
      replace:"      if (s.total >= 10 && !s.isLast) out.push(Object.assign({ kind:'c', col:s.i + 1, v:Math.floor(s.total / 10) }, base));" },
    { file:'index', expect:'answer boxes 40 apart overlap', find:'COL = { right:276, cw:48, opX:52 }', replace:'COL = { right:276, cw:40, opX:52 }' },
    { file:'index', expect:'a carry box with its pad', find:'COL_SLOT = 44, COL_CARRY = 36, COL_PAD = 6,', replace:'COL_SLOT = 44, COL_CARRY = 30, COL_PAD = 6,' },
    { file:'index', expect:'digit cards overlap', find:'COL_KEYS = { y:248, step:56, rowStep:56, size:48 }', replace:'COL_KEYS = { y:248, step:50, rowStep:56, size:48 }' },
    { file:'index', expect:'digit cards reach into the answer row', find:'COL_KEYS = { y:248, step:56, rowStep:56, size:48 }', replace:'COL_KEYS = { y:210, step:56, rowStep:56, size:48 }' },
    { file:'index', expect:'a wrong box is accepted', find:'        if (s.kind !== N.kind || s.col !== N.col){', replace:'        if (s.kind !== N.kind && s.col !== N.col){' },
    { file:'index', expect:'a wrong digit is accepted', find:'        if (v !== N.v){\n', replace:'        if (v === -1){\n' },
    { file:'index', expect:'the digit card does not go back', find:'        P.home();             /* 數字卡拿不完', replace:'        P.lock(P.cx, P.cy);   /* 數字卡拿不完' },
    { file:'index', expect:'zh gColForgot', find:"'別忘了加上進位的 ' + cin + '：' + digit + ' × ' + d + ' ＝ ' + prod + '，還要再加 ' + cin + '。'", replace:"'別忘了加上進位的 ' + cin + '：' + digit + ' × ' + d + ' ＝ ' + prod + '，還要再加 ' + d + '。'" },
    { file:'index', expect:'en gCol2',
      find:"' — write the ones digit ' + (total % 10) + ' below.'",
      replace:"' — write the ones digit ' + (prod % 10) + ' below.'" },

    { file:'index', expect:'are not all different', find:'{ a:41, b:23 }, { a:35, b:12 } ];\n\n  /* 第 4 關', replace:'{ a:41, b:23 }, { a:22, b:11 } ];\n\n  /* 第 4 關' },
    { file:'index', expect:'has a 0 digit', find:'var GAME_AREA = [ { a:23, b:14 },', replace:'var GAME_AREA = [ { a:20, b:14 },' },
    { file:'index', expect:'a card does not fit inside', find:'AREA = { x:52, y:34, tw:136, ow:96, th:84, oh:62 }', replace:'AREA = { x:52, y:34, tw:136, ow:96, th:84, oh:50 }' },
    { file:'index', expect:'area cards 58 apart overlap', find:'AREA_CARD = { w:52, h:48 }, AREA_TRAY = { y:220, step:58 }', replace:'AREA_CARD = { w:58, h:48 }, AREA_TRAY = { y:220, step:58 }' },
    { file:'index', expect:'the trap card is not', find:"decoy = (ta / 10) * (tb / 10);", replace:"decoy = ta * tb / 10;" },
    { file:'index', expect:'a card fits any piece', find:'        if (v !== r.v){ roundMiss(v === decoy', replace:'        if (v === -1){ roundMiss(v === decoy' },
    { file:'index', expect:'a piece is not w × h',
      find:"        { w:oa, h:tb, x:A.x + A.tw, y:A.y, cw:A.ow, ch:A.th },",
      replace:"        { w:oa, h:ob, x:A.x + A.tw, y:A.y, cw:A.ow, ch:A.th }," },
    { file:'index', expect:'nearestOpen(',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot',
      find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'gAreaDecoy en', find:"' as ' + (ta / 10) + ' × ' + (tb / 10) + ' — multiply", replace:"' as ' + (ta / 10) + ' × ' + (tb) + ' — multiply" },

    { file:'index', expect:'tens digit is 0', find:'var GAME_SHIFT = [ { a:23, b:14 },', replace:'var GAME_SHIFT = [ { a:23, b:4 },' },
    { file:'index', expect:'no entry has a tens digit of 2 or more', find:'{ a:34, b:21 }, { a:26, b:13 }, { a:41, b:32 } ];', replace:'{ a:34, b:11 }, { a:26, b:13 }, { a:41, b:12 } ];' },
    { file:'index', expect:'does not fit the 3 columns', find:'SHIFT = { right:290, cw:46, opX:36, nc:5 }', replace:'SHIFT = { right:290, cw:46, opX:36, nc:3 }' },
    { file:'index', expect:'the snap band reaches', find:'SHIFT_SNAP_Y = 36;', replace:'SHIFT_SNAP_Y = 50;' },
    { file:'index', expect:'the strip tray overlaps', find:'SHIFT_STRIP = { h:46, y:278 }', replace:'SHIFT_STRIP = { h:46, y:240 }' },
    { file:'index', expect:'an unshifted row is accepted', find:"        if (k === 0){ roundMiss(d.gShift0(e.a, t, s, n1)); return false; }\n", replace:"" },
    { file:'index', expect:'a row shifted two places is accepted', find:"        if (k >= 2){ roundMiss(d.gShiftFar(e.a, t, s, k)); return false; }\n", replace:"" },
    { file:'index', expect:'the strip is not read at its last digit',
      find:"var rx = pt.tap ? pt.x : pt.x + (len - 1) * SHIFT.cw / 2;",
      replace:"var rx = pt.tap ? pt.x : pt.x + len * SHIFT.cw / 2;" },
    { file:'index', expect:'gShift0 zh', find:"加起來只有 ' + n1 + ' ＋ ' + s + ' ＝ ' + (n1 + s) + '，太小了。）'", replace:"加起來只有 ' + n1 + ' ＋ ' + s + ' ＝ ' + (n1 + s * 10) + '，太小了。）'" },
    { file:'index', expect:'gShiftDone en', find:"return n1 + ' + ' + n2 + ' = ' + total + ' — ' + a + ' × ' + b", replace:"return n1 + ' + ' + n2 + ' = ' + (total + 10) + ' — ' + a + ' × ' + b" },

    { file:'index', expect:'should have 2 reasonable', find:'[ [29, 4, 116], [47, 2, 814],', replace:'[ [29, 4, 116], [47, 2, 94],' },
    { file:'index', expect:'reasonable but not exactly right', find:'[ [32, 3, 96], [18, 6, 108],', replace:'[ [32, 3, 96], [18, 6, 110],' },
    { file:'index', expect:'is neither clearly close nor clearly way off', find:'[27, 3, 621], [31, 22, 124] ]', replace:'[27, 3, 621], [31, 22, 341] ]' },
    { file:'index', expect:'ends in 5', find:'[ [19, 5, 95], [33, 12, 396],', replace:'[ [19, 5, 95], [35, 12, 420],' },
    { file:'index', expect:'estOk(', find:'return c[2] * 3 >= E * 2 && c[2] * 2 <= E * 3; }', replace:'return c[2] * 2 >= E && c[2] <= E * 3; }' },
    { file:'index', expect:'roundTen(', find:'function roundTen(n){ return n < 10 ? n : Math.round(n / 10) * 10; }', replace:'function roundTen(n){ return n < 10 ? n : Math.floor(n / 10) * 10; }' },
    { file:'index', expect:'two cards do not fit in a bin', find:'EST_BIN = { y:4, w:144, h:142,', replace:'EST_BIN = { y:4, w:144, h:110,' },
    { file:'index', expect:'claim cards overlap the bins', find:'EST_TRAY = { y:188, step:148 }', replace:'EST_TRAY = { y:150, step:148 }' },
    { file:'index', expect:'a card goes in either bin', find:'        if (bin.ok !== ok){ roundMiss(', replace:'        if (bin.ok === null){ roundMiss(' },
    { file:'index', expect:'gEstNot zh', find:"'估一估：' + a + ' × ' + b + ' 大約是 ' + ea + ' × ' + eb + ' ＝ ' + (ea * eb) + '，' + c + (ok", replace:"'估一估：' + a + ' × ' + b + ' 大約是 ' + ea + ' × ' + eb + ' ＝ ' + (a * b) + '，' + c + (ok" },

    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'note is missing', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (!lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['split', 'column', 'area', 'shift', 'est'];", replace:"var GAME_ORDER = ['split', 'column', 'area', 'est', 'shift'];" },

    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'arithmetic', find:"est2:{ label:'42 × 23', round:'40 × 20 ＝ 800（估計）'", replace:"est2:{ label:'42 × 23', round:'40 × 20 ＝ 900（估計）'" },
    { file:'index', expect:'marked answer',
      find:"{ stem:'32 × 3 = ？', opts:['906','69','96','35'], ans:2,",
      replace:"{ stem:'32 × 3 = ？', opts:['906','69','96','35'], ans:0," },

    /* ---- review.html ---- */
    { file:'review', expect:'p != a*b', find:'        var p = a * b;\n        var shiftForgotten', replace:'        var p = a * b + 1;\n        var shiftForgotten' },
    { file:'review', expect:'not the nearest ten', find:'        var roundedA = Math.round(a / 10) * 10;', replace:'        var roundedA = Math.floor(a / 10) * 10;' },
    { file:'review', expect:'no carry', find:'          if (onesA * d >= 10) break;', replace:'          if (onesA * d >= 1) break;' },
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    { file:'review', expect:'opts[ans] != correct', find:"    return { opts: opts, ans: opts.indexOf(correct) };", replace:"    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };" }
  ],

  sim: {
    INVARIANTS: {
      twoByOne: d => {
        if (d.p !== d.a * d.d) return 'p != a*d';
        if (d.a < 10 || d.a > 99 || d.d < 2 || d.d > 9) return 'a must be two-digit and d one-digit';
      },
      twoByOneCarry: d => {
        if (d.p !== d.a * d.d) return 'p != a*d';
        /* 題幹說「有進位喔」—— 個位乘完真的要滿十 */
        if ((d.a % 10) * d.d < 10) return 'no carry: the stem promises one';
      },
      threeByOne: d => {
        if (d.p !== d.a * d.d) return 'p != a*d';
        if (d.a < 100 || d.a > 999) return 'a must be three-digit';
      },
      twoByTwo: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.b < 11 || d.b > 99 || d.b % 10 === 0) return 'b must be two-digit with a ones digit (the why multiplies by it)';
      },
      estimate: d => {
        if (d.actual !== d.a * d.d) return 'actual != a*d';
        if (d.roundedA !== myRound(d.a) || d.a % 10 === 5) return 'roundedA ' + d.roundedA + ' is not the nearest ten to ' + d.a;
        if (d.est !== d.roundedA * d.d) return 'est != roundedA*d';
      },
      wordProblem: d => {
        if (d.total !== d.perBox * d.boxes + d.extra) return 'total != perBox*boxes + extra';
        if (d.boxes < 2 || d.extra < 1) return 'boxes/extra too small for the story';
      },
      inverseMissingFactor: d => {
        if (d.p !== d.d * d.missing) return 'p != d*missing';
        if (d.missing < 1) return 'missing must be positive';
      },
      perimeterRect: d => {
        if (d.perimeter !== 2 * (d.length + d.width)) return 'perimeter != 2(l+w)';
        if (d.width > d.length) return 'width longer than length';
      }
    },
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'twoByOne': case 'twoByOneCarry': case 'threeByOne': return String(d.a * d.d);
        case 'twoByTwo': return String(d.a * d.b);
        case 'estimate': return String(myRound(d.a) * d.d);
        case 'wordProblem': return String(d.perBox * d.boxes + d.extra);
        case 'inverseMissingFactor': return String(d.p / d.d);
        case 'perimeterRect': return String(2 * (d.length + d.width));
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s){
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const n = Number(s);
      if (n < 1 || n > 9999) return 'option ' + n + ' outside 1~9999';
    },
    /* 「已知 ▢ × d = p」—— 把乘積 p 當成答案是刻意的迷思誘答；只放行 p 這一個值 */
    stemEchoOk: {
      inverseMissingFactor: (d, opt) => String(opt) === String(d.p),
      /* 「只乘了個位」的迷思誘答 a × (b 的個位)：b 的個位是 1 時剛好就是 a —— 只放行那一種情況的那一個值 */
      twoByTwo: (d, opt) => d.b % 10 === 1 && String(opt) === String(d.a)
    }
  },

  data: {
    dataStart: '  /* ===================== 數學引擎',
    dataEnd: '  /* ===================== i18n ===================== */',
    dataReturn: '{stepMultiplySingleDigit, GPICK, SPLIT_H, SPLIT_ARR, SPLIT_KNOB, SPLIT_LBL, GAME_SPLIT, splitUnit, splitColX, splitCutX, splitNearest, COL_H, COL, COL_Y, COL_SLOT, COL_CARRY, COL_PAD, COL_KEYS, GAME_COLUMN, colX, columnSteps, AREA_H, AREA, AREA_CARD, AREA_TRAY, GAME_AREA, SHIFT_H, SHIFT, SHIFT_Y, SHIFT_STRIP, SHIFT_SNAP_Y, GAME_SHIFT, shiftX, EST_H, EST_BIN, EST_CARD, EST_TRAY, GAME_EST, roundTen, estOf, estOk}',
    check: function(data, I18N, fail, src){
      const D = data;
      const LANGS = ['zh', 'en'];

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的 a × b = c、a + b = c 逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        const t = s.replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/\s+/g, ' ');
        const re = /(?=(?<![\d.])(\d+) ?([×+]) ?(\d+) ?= ?(\d+)(?![\d.]))/g;
        let m;
        while ((m = re.exec(t))){
          const x = +m[1], y = +m[3], z = +m[4], want = m[2] === '×' ? x * y : x + y;
          checkedEq++;
          if (want !== z) fail(where + ': arithmetic "' + x + ' ' + m[2] + ' ' + y + ' = ' + z + '" should be ' + want);
          re.lastIndex = m.index + 1;
        }
      }));
      if (checkedEq < 30) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
      /* 直接寫成「a × b = ？」的題目：正解要等於 a × b；先估再算：正解是最接近的整十 × d */
      LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
        const stem = String(q.stem).replace(/<[^>]+>/g, '');
        let m;
        if ((m = stem.match(/^(?:[^：:]*[：:]\s*)?(\d+) × (\d+) = [？?]/))){
          if (+q.opts[q.ans] !== m[1] * m[2]) fail(bank + '[' + i + '] ' + L + ': ' + m[1] + ' × ' + m[2] + ' = ' + (m[1] * m[2]) + ', marked answer is ' + q.opts[q.ans]);
        } else if ((m = stem.match(/(\d+) × (\d+) (?:大約是多少|is about|\?)/)) && /估|Estimate/.test(stem)){
          if (+q.opts[q.ans] !== myRound(+m[1]) * m[2]) fail(bank + '[' + i + '] ' + L + ': estimate of ' + m[1] + ' × ' + m[2] + ' is ' + (myRound(+m[1]) * m[2]) + ', marked answer is ' + q.opts[q.ans]);
        }
      })));

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['split', 'column', 'area', 'shift', 'est'];
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the four examples), got ' + types.join());
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
        if (typeof text !== 'string' || /undefined|NaN/.test(text)) return fail(where + ': text has undefined/NaN: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
      };
      const box = (o, what, W, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      ['GAME_SPLIT', 'GAME_COLUMN', 'GAME_AREA', 'GAME_SHIFT', 'GAME_EST'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。
         點目的地的格子（直式的答案格、進位格）也要點得到：格子加上兩邊的 pad 至少 44。 */
      const scale = Math.min(1.5, 290 / 300);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('the scissors (' + D.SPLIT_KNOB.size + ')', D.SPLIT_KNOB.size);
      tooSmall('a digit card (' + D.COL_KEYS.size + ')', D.COL_KEYS.size);
      tooSmall('an answer box with its pad', D.COL_SLOT + 2 * D.COL_PAD);
      tooSmall('a carry box with its pad (' + D.COL_CARRY + ' + 2 × ' + D.COL_PAD + ')', D.COL_CARRY + 2 * D.COL_PAD);
      tooSmall('an area card (' + D.AREA_CARD.w + '×' + D.AREA_CARD.h + ')', Math.min(D.AREA_CARD.w, D.AREA_CARD.h));
      tooSmall('the number strip (height ' + D.SHIFT_STRIP.h + ')', Math.min(D.SHIFT_STRIP.h, D.SHIFT.cw * 2));
      tooSmall('a claim card (' + D.EST_CARD.w + '×' + D.EST_CARD.h + ')', Math.min(D.EST_CARD.w, D.EST_CARD.h));
      [D.SPLIT_KNOB.size, D.COL_KEYS.size].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });

      /* 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0 —— 中年級「輕度計分，答錯小扣分但不會結束」（§三） */
      if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('scoring: a round should give +20 with no mistakes and +10 after mistakes');
      /* roundMiss() 切出來真的跑（codex 第二輪：只看原始碼形狀的話，「0 分也照樣說 −5」會漏掉）：
         扣 5、最低 0；有扣才說「−5 分」，0 分時不扣也不說；一律記成犯過錯 */
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
      });

      /* --- nearestOpen()：從原始碼切出來真的跑 ---
         ① 點在框裡的，一定判給那一框（四塊面積大小不一樣：量中心的話，大塊裡靠近小塊邊上的點會被判給小塊 —— e2e 抓到的）
         ② 最近的那格已經放好了，就不收（不可以跳過它、改放進旁邊的空格） */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const A = D.AREA;
          const rects = [ { x:A.x, y:A.y, w:A.tw, h:A.th }, { x:A.x, y:A.y + A.th, w:A.tw, h:A.oh }, { x:A.x + A.tw, y:A.y, w:A.ow, h:A.th }, { x:A.x + A.tw, y:A.y + A.th, w:A.ow, h:A.oh } ];
          const list = rects.map((r, i) => ({ id:i, cx:r.x + r.w / 2, cy:r.y + r.h / 2, hw:r.w / 2, hh:r.h / 2, done:false }));
          let bad = 0;
          rects.forEach((r, i) => { for (let x = r.x + 0.5; x < r.x + r.w; x += 2) for (let y = r.y + 0.5; y < r.y + r.h; y += 2){ const b = nearestOpen(list, { x, y }, 4); if (!b || b.id !== i) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside an area piece are given to another piece (or none)');
          const two = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          const r1 = nearestOpen(two, { x:121, y:100 }, 6);
          if (r1 !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(two, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：剪一刀（範例 1） --- */
      {
        const A = D.SPLIT_ARR, K = D.SPLIT_KNOB;
        D.GAME_SPLIT.forEach((e, i) => {
          const w = 'GAME_SPLIT[' + i + ']';
          if (!isInt(e.a) || !isInt(e.d)) return fail(w + ' is not whole numbers');
          if (e.a < 11 || e.a > 99) fail(w + ': a ' + e.a + ' should be two-digit');
          if (e.a % 10 === 0) fail(w + ': the ones digit is 0 — nothing to cut off');
          if (e.d < 2 || e.d > 9) fail(w + ': d ' + e.d + ' should be one-digit');
          const tens = Math.floor(e.a / 10), T = e.a - e.a % 10, O = e.a % 10;
          /* 自己的幾何：第 k 直排的左邊 = x + k·u + ⌊k/10⌋·gap；整十那條在縫的正中間 */
          const u = (A.w - tens * A.gap) / e.a;
          if (u < 8) fail(w + ': columns narrower than 8 (' + u.toFixed(1) + ') — too fiddly to cut on a phone');
          const left = k => A.x + k * u + Math.floor(k / 10) * A.gap;
          const cut = j => j <= 0 ? A.x : j >= e.a ? A.x + A.w : (j % 10 === 0 ? left(j) - A.gap / 2 : left(j));
          for (let j = 0; j <= e.a; j++){
            if (Math.abs(D.splitCutX(e.a, j) - cut(j)) > 1e-6) { fail(w + ': splitCutX(' + e.a + ', ' + j + ') = ' + D.splitCutX(e.a, j) + ', should be ' + cut(j)); break; }
          }
          if (Math.abs(left(e.a) - (A.x + A.w)) > 1e-6) fail(w + ': the columns do not fill the array width');
          /* splitNearest 要回最近的那一條：每一條縫的兩邊各一點、每兩條縫正中間的兩邊各一點
             （codex 第一輪：只驗縫的 ±0.4，「只認得縫附近 1px、其他地方回端點」的版本照樣全綠） */
          const probe = (x, want) => { const got = D.splitNearest(e.a, x); if (got !== want){ fail(w + ': splitNearest(' + e.a + ', ' + x.toFixed(1) + ') = ' + got + ', should be ' + want); return false; } return true; };
          let okAll = true;
          for (let j = 0; j <= e.a && okAll; j++){
            okAll = probe(cut(j) - 0.4, j) && probe(cut(j) + 0.4, j);
            if (okAll && j < e.a){ const m = (cut(j) + cut(j + 1)) / 2; okAll = probe(m - 0.3, j) && probe(m + 0.3, j + 1); }
          }
          /* 剪對的那一條在縫裡：它左右兩邊各有一個 gap/2 的空白 */
          const gapL = left(T - 1) + u, gapR = left(T);
          if (!(cut(T) > gapL && cut(T) < gapR)) fail(w + ': the right cut ' + T + ' is not inside the gap between the tens and the ones');
          /* 整條縫（看得見的空白）裡的每一點都要剪在 T */
          for (let x = gapL; x <= gapR + 1e-9; x += 0.5) if (D.splitNearest(e.a, x) !== T){ fail(w + ': splitNearest(' + e.a + ', ' + x.toFixed(1) + ') inside the tens/ones gap is not ' + T); break; }
          if (A.y + e.d * A.rowH > D.SPLIT_LBL.y - 4) fail(w + ': ' + e.d + ' rows do not fit above the labels');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gSplitNow ' + L, d.gSplitNow(e.a, e.d, e.a), [e.a, e.d]);
            seq(w + ' gSplitNow(cut) ' + L, d.gSplitNow(e.a, e.d, T), [e.a, e.d, T, O]);
            seq(w + ' gSplitDone ' + L, d.gSplitDone(e.a, e.d, T, O), [e.a, e.d, T, e.d, O, e.d, T * e.d, O * e.d, e.a * e.d]);
            seq(w + ' gSplitPart ' + L, d.gSplitPart(T, e.d), [T, e.d, T * e.d]);
            seq(w + ' gSplit2 ' + L, d.gSplit2(T, O), [T, O, T, O]);
            for (let j = 1; j < e.a; j++){
              if (j === T) continue;
              if (j > T) seq(w + ' gSplitOnes ' + L + ' j=' + j, d.gSplitOnes(e.a, j, T), [j, e.a - j, j, j - T]);
              else if (j % 10 === 0) seq(w + ' gSplitTen ' + L + ' j=' + j, d.gSplitTen(e.a, j), [j, e.a - j, e.a - j]);
              else seq(w + ' gSplitOdd ' + L + ' j=' + j, d.gSplitOdd(e.a, j), [j, e.a - j]);
            }
          });
        });
        /* 剪刀在兩端都要在畫板裡、不可以蓋住最上面一排 */
        if (A.x - K.size / 2 < 0 || A.x + A.w + K.size / 2 > 300) fail('split: the knob sticks out of the board at an end of the array');
        if (K.y + K.size / 2 > A.y - 4) fail('split: the knob covers the top row of the array');
        if (K.y - K.size / 2 < 0) fail('split: the knob sticks out of the top of the board');
        if (D.SPLIT_LBL.y + D.SPLIT_LBL.h > D.SPLIT_H) fail('split: the labels are below the board');
        need('split', /var e = pick\(GAME_SPLIT\), T = e\.a - e\.a % 10, O = e\.a % 10/, 'the right cut is not 10 × the tens digit');
        need('split', /var j = splitNearest\(e\.a, pt\.x\);\s*if \(j <= 0 \|\| j >= e\.a\) return false;/, 'the cut is not read as the nearest gap, or a release at an end is not silent');
        need('split', /if \(j !== T\)\{ roundMiss\(j > T \? d\.gSplitOnes\(e\.a, j, T\) : j % 10 === 0 \? d\.gSplitTen\(e\.a, j\) : d\.gSplitOdd\(e\.a, j\)\); return false; \}/, 'any cut is accepted (only the gap between the tens and the ones is right)');
        need('split', /axis:'x', minX:splitCutX\(e\.a, 0\), maxX:splitCutX\(e\.a, e\.a\)/, 'the scissors are not kept on the line of gaps');
      }

      /* --- 第 2 關：填直式（範例 2） --- */
      {
        const C = D.COL, Y = D.COL_Y;
        let anyUnused = false, anyLead = false;
        D.GAME_COLUMN.forEach((e, i) => {
          const w = 'GAME_COLUMN[' + i + ']';
          if (!isInt(e.a) || !isInt(e.d)) return fail(w + ' is not whole numbers');
          const la = String(e.a).length;
          if (la < 2 || la > 3) fail(w + ': a ' + e.a + ' should be two- or three-digit');
          if (e.d < 2 || e.d > 9) fail(w + ': d should be one-digit 2~9');
          if (e.a * e.d > 9999) fail(w + ': product over 9999');
          if (la + 1 > 4) fail(w + ': needs more than 4 answer boxes');
          if (D.colX(la) - D.COL_SLOT / 2 < C.opX + 22 + 2) fail(w + ': the leftmost answer box runs into the × sign');
          const mine = mySteps(e.a, e.d);
          const theirs = D.columnSteps(e.a, e.d);
          const key = s => s.kind + s.col + '=' + s.v + '@' + s.from;
          if (theirs.map(key).join() !== mine.map(key).join()) fail(w + ': columnSteps(' + e.a + ', ' + e.d + ') is ' + theirs.map(key).join() + ', should be ' + mine.map(key).join());
          if (!mine.some(s => s.kind === 'c')) fail(w + ': no carry in a middle column — the carry box is never used');
          if (mine.some(s => s.kind === 'r' && s.col === s.from && s.tot < 10 && s.from < la - 1)) anyUnused = true;
          if (mine.some(s => s.kind === 'r' && s.col > s.from)) anyLead = true;
          /* 每一格都在畫板上（答案格 0..la、進位格 1..la−1） */
          mine.forEach(s => { if (s.kind === 'c' && (s.col < 1 || s.col > la - 1)) fail(w + ': a carry lands outside the carry boxes'); if (s.kind === 'r' && s.col > la) fail(w + ': an answer digit lands outside the answer boxes'); });
          const rd = mine.filter(s => s.kind === 'r').sort((p, q) => q.col - p.col).map(s => s.v).join('');
          if (+rd !== e.a * e.d) fail(w + ': the answer boxes read ' + rd + ', not ' + (e.a * e.d));
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gColNow ' + L, d.gColNow(e.a, e.d), [e.a, e.d]);
            seq(w + ' gColDone ' + L, d.gColDone(e.a, e.d, e.a * e.d), [e.a, e.d, e.a * e.d]);
            mine.forEach((s, k) => {
              const tag = w + ' step ' + k + ' ' + L;
              const kind = s.kind === 'c' ? 'carry' : (s.col > s.from ? 'lead' : 'main');
              const place = d.gPlaces[s.from];
              if (typeof place !== 'string' || !place) fail(tag + ': no place name for column ' + s.from);
              const h2 = d.gCol2(kind, place, s.digit, e.d, s.prod, s.cin, s.tot);
              if (kind === 'main') seq(tag + ' gCol2', h2, [s.digit, e.d, s.prod].concat(s.cin ? [s.cin, s.tot] : []).concat([s.tot % 10]));
              else seq(tag + ' gCol2', h2, [s.tot, Math.floor(s.tot / 10)]);
              if (kind === 'main'){
                if (s.cin) seq(tag + ' gColForgot', d.gColForgot(s.digit, e.d, s.prod, s.cin), [s.cin, s.digit, e.d, s.prod, s.cin]);
                if (s.tot >= 10) seq(tag + ' gColTens', d.gColTens(s.tot), [s.tot]);
                seq(tag + ' gColWrong', d.gColWrong(s.digit, e.d, s.cin, (s.v + 1) % 10), [s.digit, e.d].concat(s.cin ? [s.cin] : []).concat([(s.v + 1) % 10]));
                if (s.tot < 10 && s.from < la - 1) seq(tag + ' gColNoNeed', d.gColNoNeed(s.digit, e.d, s.cin, s.tot), [s.digit, e.d].concat(s.cin ? [s.cin] : []).concat([s.tot]));
              } else {
                seq(tag + ' gColCarryNow', d.gColCarryNow(s.tot), [s.tot]);
                seq(tag + (kind === 'carry' ? ' gColWrongCarry' : ' gColWrongLead'), (kind === 'carry' ? d.gColWrongCarry : d.gColWrongLead)(s.tot, (s.v + 1) % 10), [s.tot, (s.v + 1) % 10]);
              }
              if (d.gColOrder(place).indexOf(place) < 0) fail(tag + ': gColOrder does not name the column');
            });
          });
        });
        if (!anyUnused) fail('GAME_COLUMN: no entry leaves a carry box unused — "nothing to carry" is never practised');
        if (!anyLead) fail('GAME_COLUMN: no entry where the last column makes ten or more');
        LANGS.forEach(L => { if (I18N[L].gPlaces.length < 3) fail('gPlaces ' + L + ' should name at least ones/tens/hundreds'); });
        /* 版面：答案格互不重疊、進位格在上面的數字上方、數字卡不碰到答案格 */
        if (C.cw < D.COL_SLOT + 2) fail('column: answer boxes ' + C.cw + ' apart overlap (box ' + D.COL_SLOT + ')');
        if (D.colX(0) + D.COL_SLOT / 2 > 300) fail('column: the ones box sticks out of the board');
        if (Y.carry - D.COL_CARRY / 2 < 0 || Y.carry + D.COL_CARRY / 2 + D.COL_PAD > Y.a - 22) fail('column: carry boxes overlap the top number or leave the board');
        if (Y.d - Y.a < 44 || Y.rule < Y.d + 22 || Y.res - D.COL_SLOT / 2 < Y.rule + 3) fail('column: the rows of the column form overlap');
        const KY = D.COL_KEYS;
        if (KY.step < KY.size + 4 || KY.rowStep < KY.size + 4) fail('column: digit cards overlap');
        if (KY.y - KY.size / 2 < Y.res + D.COL_SLOT / 2 + D.COL_PAD + 4) fail('column: digit cards reach into the answer row');
        if (150 - 2 * KY.step - KY.size / 2 < 0 || 150 + 2 * KY.step + KY.size / 2 > 300 || KY.y + KY.rowStep + KY.size / 2 > D.COL_H) fail('column: digit cards stick out of the board');
        need('column', /cx:150 \+ \(\(v % 5\) - 2\) \* COL_KEYS\.step, cy:COL_KEYS\.y \+ Math\.floor\(v \/ 5\) \* COL_KEYS\.rowStep/, 'cannot read where the digit cards are drawn');
        need('column', /for \(var i = 0; i <= la; i\+\+\) mkSlot\('r', i, COL_Y\.res, COL_SLOT\);\s*for \(var j = 1; j < la; j\+\+\) mkSlot\('c', j, COL_Y\.carry, COL_CARRY\);/, 'the boxes are not la + 1 answer boxes and la − 1 carry boxes');
        need('column', /var s = nearestOpen\(slots, pt, COL_PAD\);/, 'a box is not picked as the nearest open box');
        need('column', /if \(s\.kind !== N\.kind \|\| s\.col !== N\.col\)\{/, 'a wrong box is accepted (the boxes must be filled in order)');
        need('column', /\n {8}if \(v !== N\.v\)\{\n/, 'a wrong digit is accepted');
        need('column', /else if \(N\.carryIn > 0 && v === N\.prod % 10\) roundMiss\(d\.gColForgot\(N\.digit, N\.d, N\.prod, N\.carryIn\)\);/, 'forgetting the carry has no reason of its own');
        need('column', /s\.done = true; s\.el\.textContent = String\(v\);[\s\S]*?next\+\+;\s*P\.home\(\);/, 'the digit card does not go back (cards must never run out)');
        need('column', /if \(next === steps\.length\)\{/, 'the round is not solved exactly when every box is filled');
      }

      /* --- 第 3 關：拼面積（範例 3 的四塊） --- */
      {
        const A = D.AREA, CD = D.AREA_CARD, TR = D.AREA_TRAY;
        D.GAME_AREA.forEach((e, i) => {
          const w = 'GAME_AREA[' + i + ']';
          if (!isInt(e.a) || !isInt(e.b)) return fail(w + ' is not whole numbers');
          [e.a, e.b].forEach(n => { if (n < 11 || n > 99 || n % 10 === 0) fail(w + ': ' + n + ' should be two-digit and has a 0 digit'); });
          const ta = e.a - e.a % 10, oa = e.a % 10, tb = e.b - e.b % 10, ob = e.b % 10;
          const parts = [ta * tb, ta * ob, oa * tb, oa * ob], decoy = (ta / 10) * (tb / 10);
          if (new Set(parts).size !== 4) fail(w + ': the four pieces ' + parts.join(',') + ' are not all different');
          if (parts.indexOf(decoy) >= 0) fail(w + ': the trap ' + decoy + ' equals a piece — two cards would fit');
          if (parts.reduce((x, y) => x + y, 0) !== e.a * e.b) fail(w + ': the pieces do not add up to a × b');
          if (Math.max(...parts) > 999) fail(w + ': a 4-digit card does not fit the ' + CD.w + ' card');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gAreaNow ' + L, d.gAreaNow(e.a, e.b, []), [e.a, e.b]);
            seq(w + ' gAreaNow(all) ' + L, d.gAreaNow(e.a, e.b, parts), parts.concat([e.a * e.b]));
            seq(w + ' gAreaDone ' + L, d.gAreaDone(e.a, e.b, parts, e.a * e.b), [e.a, e.b].concat(parts).concat([e.a * e.b]));
            seq(w + ' gAreaDecoy ' + L, d.gAreaDecoy(ta, tb, decoy), [decoy, ta, tb, ta / 10, tb / 10]);
            const dims = [[ta, tb], [ta, ob], [oa, tb], [oa, ob]];
            /* gAreaNot 只會收到「別塊的面積」（陷阱卡走 gAreaDecoy）—— 每一塊配每一張別的卡（codex 第一輪） */
            dims.forEach(([x, y], r) => parts.forEach((v, k) => { if (k !== r) seq(w + ' gAreaNot ' + L + ' piece ' + r + ' card ' + v, d.gAreaNot(x, y, v), [x, y, v]); }));
            dims.forEach(([x, y]) => {
              seq(w + ' gAreaOk ' + L, d.gAreaOk(x, y, x * y), [x, y, x * y]);
              seq(w + ' gArea2 ' + L, d.gArea2(x, y, x * y), [x, y, x * y]);
            });
          });
        });
        /* 版面：四塊在畫板裡、邊上的數字不出界、每一塊放得下一張卡、托盤的五張不重疊不出界 */
        if (A.x - 48 < 0 || A.y - 28 < 0 || A.x + A.tw + A.ow > 300) fail('area: the rectangle or its side labels leave the board');
        if (Math.min(A.tw, A.ow) < CD.w + 8 || Math.min(A.th, A.oh) < CD.h + 8) fail('area: a card does not fit inside the smallest piece');
        if (A.tw <= A.ow || A.th <= A.oh) fail('area: the tens part is not drawn bigger than the ones part');
        if (TR.step < CD.w + 4) fail('area cards ' + TR.step + ' apart overlap (card ' + CD.w + ')');
        const x0 = (300 - 4 * TR.step) / 2;
        if (x0 - CD.w / 2 < 0 || x0 + 4 * TR.step + CD.w / 2 > 300) fail('area: the card tray sticks out of the board');
        if (TR.y - CD.h / 2 < A.y + A.th + A.oh + 6 || TR.y + CD.h / 2 > D.AREA_H) fail('area: the card tray overlaps the rectangle or leaves the board');
        need('area', /var oa = e\.a % 10, ta = e\.a - oa, ob = e\.b % 10, tb = e\.b - ob, decoy = \(ta \/ 10\) \* \(tb \/ 10\);/, 'the trap card is not the tens multiplied as ones (ta/10 × tb/10)');
        need('area', /\{ w:ta, h:tb, x:A\.x, y:A\.y, cw:A\.tw, ch:A\.th \},\s*\{ w:ta, h:ob, x:A\.x, y:A\.y \+ A\.th, cw:A\.tw, ch:A\.oh \},\s*\{ w:oa, h:tb, x:A\.x \+ A\.tw, y:A\.y, cw:A\.ow, ch:A\.th \},\s*\{ w:oa, h:ob, x:A\.x \+ A\.tw, y:A\.y \+ A\.th, cw:A\.ow, ch:A\.oh \}/, 'a piece is not w × h of the sides drawn next to it');
        need('area', /addZone\(B, A\.x, A\.y - 28, A\.tw, 24, 'glbl', String\(ta\)\);\s*addZone\(B, A\.x \+ A\.tw, A\.y - 28, A\.ow, 24, 'glbl', String\(oa\)\);\s*addZone\(B, A\.x - 48, A\.y, 44, A\.th, 'glbl', String\(tb\)\);\s*addZone\(B, A\.x - 48, A\.y \+ A\.th, 44, A\.oh, 'glbl', String\(ob\)\);/, 'the side labels are not drawn next to their parts');
        need('area', /renderTray\(B, regions\.map\(function\(r\)\{ return r\.v; \}\)\.concat\(\[decoy\]\), AREA_TRAY\.y/, 'the cards are not the four pieces plus the trap');
        need('area', /if \(v !== r\.v\)\{ roundMiss\(v === decoy \? d\.gAreaDecoy\(ta, tb, v\) : d\.gAreaNot\(r\.w, r\.h, v\)\); return false; \}/, 'a card fits any piece');
      }

      /* --- 第 4 關：移一格（範例 3 的第二排） --- */
      {
        const S = D.SHIFT, Y = D.SHIFT_Y;
        let anyT2 = false;
        D.GAME_SHIFT.forEach((e, i) => {
          const w = 'GAME_SHIFT[' + i + ']';
          if (!isInt(e.a) || !isInt(e.b)) return fail(w + ' is not whole numbers');
          const o = e.b % 10, t = (e.b - o) / 10;
          if (e.a < 11 || e.a > 99) fail(w + ': a should be two-digit');
          if (t < 1) fail(w + ': the tens digit is 0 — there is no second row');
          if (o < 1) fail(w + ': the ones digit is 0 — the first row would be 0');
          if (t >= 2) anyT2 = true;
          const n1 = e.a * o, s = e.a * t, len = String(s).length;
          if (len + 1 > S.nc || String(e.a * e.b).length > S.nc || String(n1).length > S.nc) fail(w + ': does not fit the ' + S.nc + ' columns');
          if (n1 + s * 10 !== e.a * e.b) fail(w + ': the two rows do not add up');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gShiftNow ' + L, d.gShiftNow(e.a, t), [e.a, t]);
            seq(w + ' gShift0 ' + L, d.gShift0(e.a, t, s, n1), [t, 10 * t, e.a, 10 * t, 10 * s, n1, s, n1 + s]);
            for (let k = 2; k + len <= S.nc; k++) seq(w + ' gShiftFar k=' + k + ' ' + L, d.gShiftFar(e.a, t, s, k), [s * Math.pow(10, k), e.a, 10 * t, 10 * s]);
            seq(w + ' gShift2 ' + L, d.gShift2(e.a, t, s), [e.a, 10 * t, 10 * s, 0]);
            seq(w + ' gShiftDone ' + L, d.gShiftDone(e.a, e.b, n1, s * 10, e.a * e.b), [n1, s * 10, e.a * e.b, e.a, e.b, e.a * e.b]);
          });
          /* 數字條在托盤上時：整條在畫板裡 */
          if (150 - len * S.cw / 2 < 0 || 150 + len * S.cw / 2 > 300) fail(w + ': the strip at home sticks out of the board');
        });
        if (!anyT2) fail('GAME_SHIFT: no entry has a tens digit of 2 or more — the strip would always just copy a');
        if (D.shiftX(S.nc - 1) - 22 < S.opX + 22) fail('shift: the leftmost column runs into the × sign');
        if (D.shiftX(0) + 22 > 300) fail('shift: the ones column sticks out of the board');
        ['b', 'r1', 'r2', 'sum'].forEach((k, i) => { const prev = ['a', 'b', 'r1', 'r2'][i]; if (Y[k] - Y[prev] < 44) fail('shift: rows ' + prev + ' and ' + k + ' overlap'); });
        if (!(Y.rule1 > Y.b + 22 && Y.rule1 < Y.r1 - 22 && Y.rule2 > Y.r2 + 22 && Y.rule2 < Y.sum - 22)) fail('shift: a rule line crosses a row of digits');
        if (D.SHIFT_SNAP_Y >= Y.r2 - Y.r1 || D.SHIFT_SNAP_Y >= Y.sum - Y.r2) fail('shift: the snap band reaches the first row or the sum row');
        if (D.SHIFT_STRIP.y - D.SHIFT_STRIP.h / 2 < Y.sum + 22 + 4 || D.SHIFT_STRIP.y + D.SHIFT_STRIP.h / 2 > D.SHIFT_H) fail('shift: the strip tray overlaps the sum row or leaves the board');
        if (Math.abs(D.SHIFT_STRIP.y - Y.r2) <= D.SHIFT_SNAP_Y) fail('shift: the strip at home is already inside the snap band');
        need('shift', /var rx = pt\.tap \? pt\.x : pt\.x \+ \(len - 1\) \* SHIFT\.cw \/ 2;/, 'the strip is not read at its last digit');
        need('shift', /var k = Math\.round\(\(shiftX\(0\) - rx\) \/ SHIFT\.cw\);\s*if \(k < 0 \|\| k \+ len > SHIFT\.nc\) return false;/, 'the shift is not the nearest column of the last digit');
        need('shift', /if \(k === 0\)\{ roundMiss\(d\.gShift0\(e\.a, t, s, n1\)\); return false; \}/, 'an unshifted row is accepted');
        need('shift', /if \(k >= 2\)\{ roundMiss\(d\.gShiftFar\(e\.a, t, s, k\)\); return false; \}/, 'a row shifted two places is accepted');
        need('shift', /P\.lock\(shiftX\(1\) - \(len - 1\) \* SHIFT\.cw \/ 2, SHIFT_Y\.r2\);/, 'the strip is not locked with its last digit in the tens column');
        need('shift', /addPiece\(B, \{ w:len \* SHIFT\.cw, h:SHIFT_STRIP\.h,/, 'the strip is not exactly one column per digit');
      }

      /* --- 第 5 關：估一估（範例 4） --- */
      {
        const BN = D.EST_BIN, CD = D.EST_CARD, TR = D.EST_TRAY;
        const classOf = c => {
          const E = myRound(c[0]) * myRound(c[1]), r = c[2] / E, exact = c[2] === c[0] * c[1];
          if (exact && r >= 2 / 3 && r <= 1.5) return 'ok';
          if (!exact && (r >= 3 || r <= 1 / 3)) return 'off';
          return 'unclear';
        };
        D.GAME_EST.forEach((set, i) => {
          const w = 'GAME_EST[' + i + ']';
          if (!Array.isArray(set) || set.length !== 4) return fail(w + ' should have 4 answers');
          const cls = set.map(classOf);
          if (cls.filter(x => x === 'ok').length !== 2 || cls.filter(x => x === 'off').length !== 2) fail(w + ' should have 2 reasonable (right and close) and 2 way-off answers, got ' + cls.join(','));
          const seen = new Set();
          set.forEach((c, k) => {
            const tag = w + '[' + k + '] ' + c.join('×').replace(/×(\d+)$/, '=$1');
            if (!c.every(isInt) || c.length !== 3) return fail(tag + ' is not [a, b, claimed]');
            [c[0], c[1]].forEach(n => { if (n >= 100) fail(tag + ': factor ' + n + ' is more than two digits'); if (n >= 10 && n % 10 === 5) fail(tag + ': factor ' + n + ' ends in 5 — the nearest ten is not one number'); });
            if (cls[k] === 'unclear') fail(tag + ' is neither clearly close nor clearly way off' + (c[2] !== c[0] * c[1] && Math.abs(c[2] / (myRound(c[0]) * myRound(c[1])) - 1) < 0.5 ? ' (reasonable but not exactly right — would teach that a wrong answer is fine)' : ''));
            if (D.roundTen(c[0]) !== myRound(c[0]) || D.roundTen(c[1]) !== myRound(c[1])) fail(tag + ': roundTen() is not the nearest ten');
            if (D.estOk(c) !== (cls[k] === 'ok')) fail(tag + ': estOk() says ' + D.estOk(c) + ', but it is ' + cls[k]);
            const key = c[0] + 'x' + c[1]; if (seen.has(key)) fail(tag + ': the same multiplication twice in one set'); seen.add(key);
            const txt = c[0] + ' × ' + c[1] + ' = ' + c[2];
            if (txt.length > 13) fail(tag + ': "' + txt + '" is too long for a ' + CD.w + ' card');
            const ea = myRound(c[0]), eb = myRound(c[1]);
            LANGS.forEach(L => {
              const d = I18N[L];
              [true, false].forEach(ok => {
                seq(tag + ' gEstNot ' + L, d.gEstNot(c[0], c[1], c[2], ea, eb, ok), [c[0], c[1], ea, eb, ea * eb, c[2]]);
                seq(tag + ' gEstOk ' + L, d.gEstOk(c[0], c[1], c[2], ea, eb, ok), [c[0], c[1], ea, eb, ea * eb, c[2]]);
              });
              seq(tag + ' gEst2 ' + L, d.gEst2(c[0], c[1], ea, eb), [c[0], c[1], ea, eb, ea * eb]);
            });
          });
        });
        /* estOk() 在整個範圍上和自己的規則一致（對的答案：差不到一倍半才算合理） */
        for (let a = 11; a <= 49; a++){
          if (a % 10 === 0 || a % 10 === 5) continue;
          for (let b = 2; b <= 49; b++){
            if (b >= 10 && (b % 10 === 0 || b % 10 === 5)) continue;
            const E = myRound(a) * myRound(b), c = a * b, r = c / E, want = r >= 2 / 3 && r <= 1.5;
            if (D.estOf(a, b) !== E){ fail('estOf(' + a + ', ' + b + ') = ' + D.estOf(a, b) + ', should be ' + E); a = 99; break; }
            if (D.estOk([a, b, c]) !== want){ fail('estOk([' + a + ', ' + b + ', ' + c + ']) = ' + D.estOk([a, b, c]) + ', should be ' + want); a = 99; break; }
          }
        }
        LANGS.forEach(L => { seq('gEstNow ' + L, I18N[L].gEstNow(2, 4), [2, 4]); if (!/✅/.test(I18N[L].gEstYes) || !/❌/.test(I18N[L].gEstNo)) fail('the bins are not labelled ✅ / ❌ (' + L + ')'); });
        /* 版面：兩個箱子並排不重疊、放得下兩張卡；托盤兩排在箱子下面、不出界 */
        BN.x.forEach((x, k) => box({ x, y:BN.y, w:BN.w, h:BN.h }, 'bin ' + k, 300, D.EST_H));
        if (hit({ x:BN.x[0], y:BN.y, w:BN.w, h:BN.h }, { x:BN.x[1], y:BN.y, w:BN.w, h:BN.h })) fail('est: the two bins overlap');
        if (CD.w > BN.w - 4 || BN.lbl + 4 + 2 * (CD.h + 4) > BN.h) fail('est: two cards do not fit in a bin');
        if (TR.step < CD.w + 4 || 56 < CD.h + 4) fail('est: claim cards in the tray overlap');
        const x0 = (300 - TR.step) / 2;
        if (x0 - CD.w / 2 < 0 || x0 + TR.step + CD.w / 2 > 300) fail('est: the tray sticks out of the board');
        if (TR.y - CD.h / 2 < BN.y + BN.h + 6) fail('est: claim cards overlap the bins');
        if (TR.y + 56 + CD.h / 2 > D.EST_H) fail('est: the second tray row is below the board');
        need('est', /if \(bin\.ok !== ok\)\{ roundMiss\(d\.gEstNot\(c\[0\], c\[1\], c\[2\], ea, eb, ok\)\); return false; \}/, 'a card goes in either bin');
        need('est', /var c = P\.data\.c, ok = estOk\(c\), ea = roundTen\(c\[0\]\), eb = roundTen\(c\[1\]\);/, 'the bin is not decided by estOk()');
        need('est', /P\.lock\(bin\.cx, EST_BIN\.y \+ EST_BIN\.lbl \+ 4 \+ EST_CARD\.h \/ 2 \+ bin\.n \* \(EST_CARD\.h \+ 4\)\);/, 'cards in a bin are not stacked under its label');
        need('est', /renderTray\(B, set\.slice\(\), EST_TRAY\.y, function\(c, cx, cy\)\{[\s\S]*?\}, EST_TRAY\.step, 2\);/, 'the claim cards are not laid out two per row');
      }
    }
  }
};
