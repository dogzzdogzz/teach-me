/* grade-3/math/capacity 的檢查設定（裝得下多少？：水位不一定代表容量、1 公升 ＝ 1000 毫升、讀量杯先看一小格、公升毫升互換）。
   2026-10-01 新增 —— 和小遊戲「倒倒看」改成五關五種玩法（§六之五）同一次寫成。在那之前這一課沒有設定檔，
   simgen／verify_lesson_data 一跑就報「找不到設定」。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，
   「幾公升幾毫升」自己拼）、選項範圍從每個產生器自己的參數推出來。
   跑起來抓到的舊缺陷：六個產生器的誘答把題幹的數字抄回來（readCup 的一小格、convertLtoML 的毫升、
   fitsCapacity 的容量與已經倒的量、gridRelation 的一大格、shareDivide 的人數、multiplyCheck 的每瓶）；
   shareDivide 的 500 毫升印成「0.5 公升」（這一課沒有小數）；convertMLtoL 的選項「2公升750毫升」中文與數字之間沒有空格。
   刻意的迷思誘答只有一個：readCup 把「第幾格」當成毫升數（忘了乘一小格），見 stemEchoOk。

   data（index.html）：
   - 所有 I18N 字串（含三層題庫的題幹與解釋、範例的旁白、遊戲的每一句）裡的算式，交給 lib/arith.js 逐條驗算，
     單位真的換算（公升 → × 1000）。這一課自己的兩種寫法先轉成等價的算式再交出去（pre()）：
     「2 公升 400 毫升」→「2400 毫升」，「2750 ÷ 1000 ＝ 2…餘 750」→「2750 ＝ 1000 × 2 ＋ 750」（並且要求餘數比除數小）。
     pre() 自己先跑正反例（PROBES）。跑起來抓到舊缺陷：範例 2 的「1 公升 × 1000 ＝ 1000 毫升」單位不對（1 公升 × 1000 是 1000 公升）。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關用自己的算法重算答案，並且**照遊戲的規則把每一題從頭玩一次**，證明每一題都解得完、而且只有對的玩法解得完；
     頁面的純函式（cmpWaterH／sortBin／sortCardXY／levelY／levelSnap／digOf／botCellXY／…）一律拿整個範圍去呼叫再和自己的算法比；
     nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。
     每一句說明逐個比數字（每一題、每一步、每一種放錯），版面數字一律從 index.html 讀。
   - 「畫面決定得了答案」：比一比的第三杯一定和其中一杯水位一樣高（看水位配對一定配錯）、配對的兩杯水位一定不一樣高；
     倒到刻度的目標一定不在標了數字的線上、而且「一小格當成 100 毫升」會倒到別的格子；裝瓶子的水槽一格就是 100 毫升（標籤寫著）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-capacity 的端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function lmL(L, mL, lang){ return lang === 'zh' ? L + ' 公升 ' + mL + ' 毫升' : L + ' L ' + mL + ' mL'; }

/* ---------- 算式：lib/arith.js ＋ 這一課的兩種寫法 ---------- */
const arith = makeArith({ conversions:{ '公升':1000, '毫升':1, 'liter(s)':1000, 'liters':1000, 'liter':1000, 'L':1000, 'mL':1 } });
/* 「L 公升 m 毫升」是一個量（隱藏的加法），「a ÷ b ＝ q…餘 r」是帶餘數的除法 —— arith.js 兩種都不認得，
   先換成等價的寫法。餘數不比除數小的，直接回報（那不是除法）。 */
function pre(text, bad){
  /* 半形括號折成全形（和中文的散文括號一樣），括號裡的算式才不會和前面的數字黏成一條鏈；
     「liter(s)」先換掉，不然它的括號也會被折掉。 */
  return String(text).replace(/<[^>]+>/g, ' ').replace(/liter\(s\)/g, 'liters').replace(/\(/g, '（').replace(/\)/g, '）')
    .replace(/(\d+)\s*÷\s*(\d+)\s*[＝=]\s*(\d+)\s*(?:…\s*)?(?:餘|remainder)\s*(\d+)/g, (m, a, b, q, r) => {
      if (+r >= +b) bad.push('"' + m + '": the remainder ' + r + ' is not smaller than ' + b);
      return a + ' ＝ ' + b + ' × ' + q + ' ＋ ' + r;
    })
    .replace(/(\d+)\s*(公升|liter\(s\)|liters|liter|L)\s*(\d+)\s*(毫升|mL)(?![A-Za-z])/g, (m, L, u, mL) => {
      if (+mL >= 1000) bad.push('"' + m + '": the mL part ' + mL + ' is 1000 or more — that is not how "L liters mL milliliters" is written');
      return (+L * 1000 + +mL) + ' 毫升';
    });
}
function eqOf(text){
  const bad = [], r = arith(pre(text, bad));
  return { problems:bad.concat(r.problems), verified:r.verified, questions:r.questions };
}
const PROBES = [
  ['2 公升 400 毫升 ＝ 2 × 1000 ＋ 400 ＝ 2400 毫升', true], ['2 公升 400 毫升 ＝ 2 × 1000 ＋ 400 ＝ 2040 毫升', false],
  ['2750 ÷ 1000 ＝ 2…餘 750', true], ['2750 ÷ 1000 ＝ 2…餘 75', false], ['(2400 ÷ 1000 = 2 remainder 400)', true],
  ['2400 毫升 ＝ 2 公升 400 毫升（2400 ÷ 1000 ＝ 2 … 餘 400）', true], ['1300 ÷ 100 = 3 remainder 1000', false],
  ['1 公升 ＝ 1000 毫升', true], ['1 公升 ＝ 100 毫升', false], ['2600 毫升 ＝ 2 公升 600 毫升', true], ['2600 mL = 2 L 60 mL', false],
  ['7 × 50 ＝ 350 毫升', true], ['1 L 50 mL = 1050 mL', true], ['2 liter(s) 400 mL = 2 × 1000 + 400 = 2400 mL', true],
  ['1 公升 × 1000 ＝ 1000 毫升', false], ['2 liters = 2 × 1000 = 2000 mL', true], ['6 格是 6 × 100 ＝ 600 毫升', true], ['6 squares are 6 × 100 = 500 mL', false],
  ['1 公升 1050 毫升', false], ['2050 mL = 1 L 1050 mL', false], ['2750 毫升 ＝ 1 公升 1750 毫升', false]
];

/* 中文寫在卡片上的寬度（px）：中文字一個字寬、數字和英文字母約 0.6 字寬、空白 0.3 —— 估大不估小 */
function textW(s, px){ let w = 0; for (const ch of String(s)) w += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? px : ch === ' ' ? 0.28 * px : 0.58 * px; return w; }

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)', find:"    shuffle(items).forEach(function(it, i){ var p = pos(i); mk(it, p.x, p.y); });", replace:"    items.forEach(function(it, i){ var p = pos(i); mk(it, p.x, p.y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['cmp', 'sort', 'level', 'dig', 'bot'];", replace:"var GAME_ORDER = ['cmp', 'level', 'sort', 'dig', 'bot'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot',
      find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'only moves up and down', find:"      if (o.axis === 'y') dx = 0;\n", replace:'' },

    /* 比一比 */
    { file:'index', expect:'no cup has the same water level', find:'    [ { w:30, v:600 }, { w:90, v:600 }, { w:60, v:400 } ],', replace:'    [ { w:30, v:600 }, { w:90, v:600 }, { w:60, v:500 } ],' },
    { file:'index', expect:'should hold exactly two equal cups', find:'    [ { w:30, v:400 }, { w:60, v:400 }, { w:90, v:600 } ],', replace:'    [ { w:30, v:400 }, { w:60, v:400 }, { w:90, v:400 } ],' },
    { file:'index', expect:'widths should be 30, 60, 90', find:'    [ { w:60, v:600 }, { w:90, v:600 }, { w:30, v:300 } ],', replace:'    [ { w:60, v:600 }, { w:90, v:600 }, { w:60, v:300 } ],' },
    { file:'index', expect:'more than the measuring cup', find:'    [ { w:60, v:900 }, { w:90, v:900 }, { w:30, v:300 } ],', replace:'    [ { w:60, v:1200 }, { w:90, v:1200 }, { w:30, v:400 } ],' },
    { file:'index', expect:'cmpWaterH(', find:'  function cmpWaterH(c){ return c.v * CMP_K / c.w; }', replace:'  function cmpWaterH(c){ return c.v * CMP_K / 60; }' },
    { file:'index', expect:'): cups', find:'CMP_X = [54, 150, 246]', replace:'CMP_X = [64, 150, 236]' },
    { file:'index', expect:'the amount labels reach', find:'CMP_AMT = { y:138, w:96, h:20 }', replace:'CMP_AMT = { y:158, w:96, h:20 }' },
    { file:'index', expect:'overlap each other', find:'CMP_BOX = { x:212, y:222, w:150, h:100 }', replace:'CMP_BOX = { x:182, y:222, w:150, h:100 }' },
    { file:'index', expect:'"same amount" before every cup is measured', find:"        if (count() < 3){ roundInfo(d.gCmpAll); return false; }   /* 還沒全部量過：不算錯，先去量 */\n", replace:'' },
    { file:'index', expect:'the odd cup is accepted', find:"        if (P.data.i === odd){ roundMiss(d.gCmpOdd(c.nm, c.v, cups[twin].nm, cups[twin].v)); return false; }\n", replace:'' },
    { file:'index', expect:'is not shown after pouring', find:"          c.amt.textContent = d.gCmpAmt(c.v);\n", replace:'' },
    { file:'index', expect:'the measuring cup does not show', find:"          mw.style.height = (c.v / M.max * M.h) + 'px';", replace:"          mw.style.height = (c.v / 1000 * 90) + 'px';" },
    { file:'index', expect:'gCmpOdd zh', find:"' 杯一樣高，可是 ' + o + ' 杯是 ' + vo + ' 毫升、'", replace:"' 杯一樣高，可是 ' + o + ' 杯是 ' + vs + ' 毫升、'" },
    { file:'index', expect:'gCmpDone en', find:"return 'Cups ' + a + ' and ' + b + ' are both ' + v + ' mL", replace:"return 'Cups ' + a + ' and ' + b + ' are both ' + (v + 100) + ' mL" },

    { file:'index', expect:"is not example 1's AREA_PER_ML", find:'var CMP_H = 300, CMP_K = 4,', replace:'var CMP_H = 300, CMP_K = 3,' },
    { file:'index', expect:'the same cup could be put in twice', find:"        P.lock(P.homeX, P.homeY); P.el.classList.add('placed');", replace:"        P.el.classList.add('placed');" },
    /* 分一分 */
    { file:'index', expect:'sortBin(', find:"  function sortBin(v){ return v < 1000 ? 'lt' : (v === 1000 ? 'eq' : 'gt'); }", replace:"  function sortBin(v){ return v < 1000 ? 'lt' : (v <= 1050 ? 'eq' : 'gt'); }" },
    { file:'index', expect:'no card for bin', find:'    [ { v:900, f:\'m\' }, { v:1000, f:\'m\' }, { v:1050, f:\'Lm\' }, { v:2000, f:\'L\' }, { v:600, f:\'m\' } ],', replace:'    [ { v:900, f:\'m\' }, { v:800, f:\'m\' }, { v:1050, f:\'Lm\' }, { v:2000, f:\'L\' }, { v:600, f:\'m\' } ],' },
    { file:'index', expect:'is not written as', find:"{ v:1300, f:'Lm' }", replace:"{ v:1300, f:'L' }" },
    { file:'index', expect:'two cards are both', find:"{ v:700, f:'m' }, { v:1000, f:'m' }, { v:1250, f:'Lm' }, { v:2000, f:'m' }, { v:300, f:'m' }", replace:"{ v:700, f:'m' }, { v:1000, f:'m' }, { v:1250, f:'Lm' }, { v:2000, f:'m' }, { v:700, f:'m' }" },
    { file:'index', expect:'bin holds at most', find:"{ v:1000, f:'L' }, { v:999, f:'m' }, { v:1010, f:'m' }, { v:1100, f:'Lm' }, { v:400, f:'m' }", replace:"{ v:1000, f:'L' }, { v:999, f:'m' }, { v:10, f:'m' }, { v:20, f:'m' }, { v:400, f:'m' }" },
    { file:'index', expect:'no entry has "100 毫升"', find:"{ v:3000, f:'L' }, { v:100, f:'m' } ],\n    [ { v:100, f:'m' }, { v:1000, f:'L' },", replace:"{ v:3000, f:'L' }, { v:200, f:'m' } ],\n    [ { v:200, f:'m' }, { v:1000, f:'L' }," },
    { file:'index', expect:'sortCardXY(', find:"{ x:i % 2 ? 224 : 76, y:150 + Math.floor(i / 2) * 58 }", replace:"{ x:i % 2 ? 224 : 76, y:150 + Math.floor(i / 2) * 48 }" },
    { file:'index', expect:'reach the bins', find:"SORT_BIN = { x:[50, 150, 250], y:4, w:94, h:112, head:40, step:22 }", replace:"SORT_BIN = { x:[50, 150, 250], y:4, w:94, h:132, head:40, step:22 }" },
    { file:'index', expect:'is wider than the card', find:'var SORT_CARD = { w:140, h:48 };', replace:'var SORT_CARD = { w:96, h:48 };' },
    { file:'index', expect:'a card is accepted in the wrong bin', find:"        if (b.k !== want){ roundMiss(d.gSortWhy(txt, v, P.data.f, want)); return false; }\n", replace:'' },
    { file:'index', expect:'gSortWhy zh', find:"'，' + (k === 'lt' ? '比 1000 毫升少' : k === 'eq' ? '剛好是 1000 毫升' : '比 1000 毫升多')", replace:"'，' + (k === 'lt' ? '比 1000 毫升多' : k === 'eq' ? '剛好是 1000 毫升' : '比 1000 毫升少')" },
    { file:'index', expect:'does not fit one line of a bin', find:"gSortBins: { lt:'Under 1 L', eq:'Exactly 1 L', gt:'Over 1 L' },", replace:"gSortBins: { lt:'Less than 1 L', eq:'Exactly 1 L', gt:'More than 1 L' }," },
    { file:'index', expect:'cannot read the font size', find:"  .gscard{font-size:17px;white-space:nowrap}", replace:"  .gscard{white-space:nowrap}" },
    { file:'index', expect:'gSortCard en', find:"Math.floor(v / 1000) + ' L ' + (v % 1000) + ' mL'; },", replace:"Math.floor(v / 1000) + ' L ' + (v % 100) + ' mL'; }," },

    { file:'index', expect:'one card could be sorted five times', find:"        P.lock(P.homeX, P.homeY); P.el.classList.add('gone');\n        done++;", replace:"        P.home(); P.el.classList.add('gone');\n        done++;" },
    /* 倒到刻度 */
    { file:'index', expect:'is on a numbered line', find:'GAME_LEVEL = [ { t:50, every:2, X:350 },', replace:'GAME_LEVEL = [ { t:50, every:2, X:400 },' },
    { file:'index', expect:'is not a whole number of ticks', find:'{ t:20, every:5, X:160 },', replace:'{ t:20, every:5, X:170 },' },
    { file:'index', expect:'one tick of 100', find:'{ t:20, every:5, X:60 } ];', replace:'{ t:100, every:2, X:700 } ];' },
    { file:'index', expect:'beyond the top', find:'{ t:50, every:2, X:450 },', replace:'{ t:50, every:2, X:550 },' },
    { file:'index', expect:'levelSnap(', find:'Math.round((levelY(0) - y) / LEVEL.step)', replace:'Math.floor((levelY(0) - y) / LEVEL.step)' },
    { file:'index', expect:'levelY(', find:'function levelY(k){ return LEVEL.top + (LEVEL.n - k) * LEVEL.step; }', replace:'function levelY(k){ return LEVEL.top + (LEVEL.n - k) * LEVEL.step + 2; }' },
    { file:'index', expect:'the handle overlaps the cup', find:'LEVEL = { cx:130, w:90, top:44, step:22, n:10, hx:211,', replace:'LEVEL = { cx:130, w:90, top:44, step:22, n:10, hx:190,' },
    { file:'index', expect:'outside the', find:'LEVEL = { cx:130, w:90, top:44, step:22,', replace:'LEVEL = { cx:130, w:90, top:44, step:26,' },
    { file:'index', expect:'a wrong level is accepted', find:"        if (k !== want){ roundMiss(d.gLevelWrong(major, e.every, e.t, k, e.X)); return; }\n", replace:'' },
    { file:'index', expect:'an empty cup is', find:"        if (k === 0){ gMsg.textContent = d.gLevelEmpty; return; }   /* 還沒倒水：只提醒，不算錯 */\n", replace:'' },
    { file:'index', expect:'the numbered lines', find:"'glbl gmaj', String(j * e.t));", replace:"'glbl gmaj', String(j * 100));" },
    { file:'index', expect:'gLevelWrong en', find:"' = ' + (k * t) + ' mL, not ' + X + ' mL.'; },", replace:"' = ' + (k * 100) + ' mL, not ' + X + ' mL.'; }," },
    { file:'index', expect:'gLevel2 zh', find:"'，倒到第 ' + (X / t) + ' 小格。'; },", replace:"'，倒到第 ' + (X / t + 1) + ' 小格。'; }," },

    /* 數字卡 */
    { file:'index', expect:'no entry with 0 < mL < 100', find:'{ L:1, mL:50 }, { L:3, mL:0 }, { L:1, mL:250 }, { L:2, mL:80 },', replace:'{ L:1, mL:150 }, { L:3, mL:0 }, { L:1, mL:250 }, { L:2, mL:180 },' },
    { file:'index', expect:'no entry with 0 mL', find:'{ L:3, mL:0 }, { L:1, mL:250 },', replace:'{ L:3, mL:10 }, { L:1, mL:250 },' },
    { file:'index', expect:'should be 1~4 liters', find:'{ L:3, mL:605 } ];', replace:'{ L:12, mL:605 } ];' },
    { file:'index', expect:'digOf(', find:'Math.floor(T / 100) % 10, Math.floor(T / 10) % 10, T % 10]; }', replace:'Math.floor(T / 100) % 10, Math.floor(T / 10) % 10, T % 100]; }' },
    { file:'index', expect:'drop pads touch', find:'x:[42, 102, 162, 222], ux:272, uw:44 }', replace:'x:[42, 96, 150, 204], ux:254, uw:44 }' },
    { file:'index', expect:'the digit cards reach the boxes', find:'var DIG_KEYS = { y:172, step:56, rowStep:56, size:48 };', replace:'var DIG_KEYS = { y:140, step:56, rowStep:56, size:48 };' },
    { file:'index', expect:'dig: digit cards', find:'var DIG_KEYS = { y:172, step:56, rowStep:56, size:48 };', replace:'var DIG_KEYS = { y:172, step:46, rowStep:56, size:48 };' },
    { file:'index', expect:'a wrong digit is accepted', find:"        if (v !== s.v){ roundMiss(s.i === 0 ? d.gDigL(e.L, v) : d.gDigM(e.mL, s.i, s.v, v)); return false; }\n", replace:'' },
    { file:'index', expect:'cards must never run out', find:"        P.home(); P.el.classList.remove('sel'); if (B.selected === P) B.selected = null;   /* 數字卡拿不完：卡片回原位 */", replace:"        P.lock(P.cx, P.cy);" },
    { file:'index', expect:'gDigM zh', find:"mL + ' 毫升寫在後面三位：' + ('00' + mL).slice(-3)", replace:"mL + ' 毫升寫在後面三位：' + ('0' + mL).slice(-3)" },
    { file:'index', expect:'gDigL card 0 en', find:"return L + ' L = ' + (L * 1000) + ' mL, so the thousands digit is '", replace:"return L + ' L = ' + (L * 100) + ' mL, so the thousands digit is '" },
    { file:'index', expect:'gDigM en does not say', find:"' — the ' + ['', 'hundreds', 'tens', 'ones'][i] + ' digit is '", replace:"' — the ' + ['', 'tens', 'hundreds', 'ones'][i] + ' digit is '" },

    /* 裝瓶子 */
    { file:'index', expect:'is not a whole number of 100', find:'var GAME_BOT = [2600, 1400, 3200, 2000, 1900, 3700];', replace:'var GAME_BOT = [2650, 1400, 3200, 2000, 1900, 3700];' },
    { file:'index', expect:'no entry fills the bottles exactly', find:'var GAME_BOT = [2600, 1400, 3200, 2000, 1900, 3700];', replace:'var GAME_BOT = [2600, 1400, 3200, 2100, 1900, 3700];' },
    { file:'index', expect:'should be 1100~3900', find:'var GAME_BOT = [2600, 1400, 3200, 2000, 1900, 3700];', replace:'var GAME_BOT = [2600, 1400, 3200, 2000, 900, 3700];' },
    { file:'index', expect:'botCellXY(', find:'x:BOT_TANK.pad + (c % 10) * BOT_TANK.step +', replace:'x:BOT_TANK.pad + (c % 11) * BOT_TANK.step +' },
    { file:'index', expect:'squares stick out of the tank', find:'BOT_TANK = { x:26, y:34, w:248,', replace:'BOT_TANK = { x:30, y:34, w:240,' },
    { file:'index', expect:'reaches the full bottles', find:'var BOT_FULL = { y:176,', replace:'var BOT_FULL = { y:160,' },
    { file:'index', expect:'the bottle you drag overlaps its label', find:'BOT_CAP = { x:110, y:238, w:180, h:32 }', replace:'BOT_CAP = { x:90, y:238, w:180, h:32 }' },
    { file:'index', expect:'a bottle that cannot be filled is accepted', find:"        if (left < 1000){ roundMiss(d.gBotShort(left)); return false; }\n", replace:'' },
    { file:'index', expect:'"all poured" is accepted', find:"        if (left >= 1000){ roundMiss(d.gBotMore(left)); return; }\n", replace:'' },
    { file:'index', expect:'a wrong leftover is accepted', find:"        else if (left > 0 && v === left / 100) roundMiss(d.gBotCells(left / 100, left));", replace:"        else if (left > 0 && v === left / 100) roundSolved(d.gBotCells(left / 100, left));" },
    { file:'index', expect:'read as a number', find:"if (!/^(0|[1-9]\\d*)$/.test(t)){ gMsg.textContent = d.gBotEmpty; return; }", replace:"if (!/^\\d+$/.test(t)){ gMsg.textContent = d.gBotEmpty; return; }" },
    { file:'index', expect:'read as a number', find:"        var t = inp.value.trim();", replace:"        var t = inp.value.replace(/\\s/g, '');" },
    { file:'index', expect:'gBotDone zh', find:"' 毫升：倒滿 ' + q + ' 瓶 1 公升，還剩 ' + left + ' 毫升。'", replace:"' 毫升：倒滿 ' + q + ' 瓶 1 公升，還剩 ' + (left + 100) + ' 毫升。'" },
    { file:'index', expect:'gBotLine en', find:"return left ? T + ' mL = ' + q + ' L ' + left + ' mL' : T + ' mL = ' + q + ' L'; },", replace:"return left ? T + ' mL = ' + q + ' L ' + (left / 10) + ' mL' : T + ' mL = ' + q + ' L'; }," },
    { file:'index', expect:'gBotTank', find:"return '水槽：' + T + ' 毫升（一格 100 毫升）'; },", replace:"return '水槽：' + T + ' 毫升'; }," },

    { file:'index', expect:'an exact fill does not finish on its own', find:"          roundSolved(d.gBotDone(T, q, 0));\n", replace:'' },
    { file:'index', expect:'is 1000 or more', find:"opts:['27 公升 50 毫升','2 公升 75 毫升','2 公升 750 毫升','7 公升 50 毫升'], ans:2,\n          why:'2750 ÷ 1000 ＝ 2…餘 750，所以是 2 公升 750 毫升。'", replace:"opts:['27 公升 50 毫升','2 公升 75 毫升','2 公升 750 毫升','7 公升 50 毫升'], ans:2,\n          why:'2750 ÷ 1000 ＝ 2…餘 750，所以 2750 毫升 ＝ 1 公升 1750 毫升。'" },
    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'arithmetic is wrong', find:"why:'100 ＋ 600 ＝ 700，", replace:"why:'100 ＋ 600 ＝ 800，" },
    { file:'index', expect:'the remainder', find:"why:'2750 ÷ 1000 ＝ 2…餘 750，", replace:"why:'2750 ÷ 1000 ＝ 1…餘 1750，" },
    { file:'index', expect:'arithmetic is wrong', find:"ladderRule:'公升 → 毫升：× 1000（1 × 1000 ＝ 1000）", replace:"ladderRule:'公升 → 毫升：× 1000（1 公升 × 1000 ＝ 1000 毫升）" },
    { file:'index', expect:'readLine', find:"return 'The water is at tick ' + ticks + ': ' + ticks + ' × ' + tickValue + ' mL = <b>' + amount + ' mL</b>';", replace:"return 'The water is at tick ' + ticks + ': ' + ticks + ' × ' + tickValue + ' mL = <b>' + (amount + 10) + ' mL</b>';" },
    { file:'index', expect:'convertLine2', find:"return total + ' 毫升 ＝ <b>' + L + ' 公升 ' + mL + ' 毫升</b>（' + total + ' ÷ 1000 ＝ ' + L + ' … 餘 ' + mL + '）';", replace:"return total + ' 毫升 ＝ <b>' + L + ' 公升 ' + mL + ' 毫升</b>（' + total + ' ÷ 100 ＝ ' + L + ' … 餘 ' + mL + '）';" },

    /* ---- review.html ---- */
    { file:'review', expect:'is copied straight out of the stem', find:"        var m = mixOptsNum(remaining, candidates, [capacity, poured]);", replace:"        var m = mixOptsNum(remaining, candidates.concat([poured]), [capacity]);" },
    { file:'review', expect:'is copied straight out of the stem', find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });', replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    { file:'review', expect:'missing space between Chinese and a digit', find:"      fmtLmL: function(L, mL){ return L + ' 公升 ' + mL + ' 毫升'; }", replace:"      fmtLmL: function(L, mL){ return L + '公升' + mL + '毫升'; }" },
    { file:'review', expect:'decimal', find:"lang === 'zh' ? (whole ? totalL + ' 公升' : d.total + ' 毫升')", replace:"lang === 'zh' ? (totalL + ' 公升')" },
    { file:'review', expect:'opts[ans] != correct', find:"        var amount = ticks * tickValue;", replace:"        var amount = ticks * tickValue + (ticks === 5 ? 10 : 0);" },
    { file:'review', expect:'why: arithmetic is wrong', find:"? d.L + ' 公升 ＝ ' + (d.L * 1000) + ' 毫升，'", replace:"? d.L + ' 公升 ＝ ' + (d.L * 100) + ' 毫升，'" },
    { file:'review', expect:'is not smaller than 1000', find:"? d.total + ' ÷ 1000 ＝ ' + d.L + '…餘 ' + d.mL", replace:"? d.total + ' ÷ 1000 ＝ ' + (d.L - 1) + '…餘 ' + (d.mL + 1000)" },
    { file:'review', expect:'total != L × 1000 + mL (mL 1~999)', find:"        var mL = pick([50, 150, 250, 350, 450, 550, 650, 750, 850, 950]);", replace:"        var mL = pick([50, 150, 250, 350, 450, 550, 650, 750, 850, 1050]);" }
  ],

  sim: {
    blockStart: '  var TXT = {',
    INVARIANTS: {
      readCup: d => {
        if ([10, 50, 100].indexOf(d.tickValue) < 0) return 'one tick ' + d.tickValue + ' is not 10/50/100';
        if (!(d.ticks >= 2 && d.ticks <= 9)) return 'tick ' + d.ticks + ' outside 2~9 (a 10-tick cup)';
        if (d.amount !== d.ticks * d.tickValue) return 'amount != ticks × tick';
      },
      convertLtoML: d => {
        if (!(d.L >= 1 && d.L <= 4) || !(d.mL >= 0 && d.mL <= 900 && d.mL % 100 === 0)) return 'L ' + d.L + ' / mL ' + d.mL + ' out of range';
        if (d.total !== d.L * 1000 + d.mL) return 'total != L × 1000 + mL';
      },
      convertMLtoL: d => {
        if (d.total !== d.L * 1000 + d.mL || !(d.mL > 0 && d.mL < 1000)) return 'total != L × 1000 + mL (mL 1~999)';
        const vals = d.opts.map(o => o.L * 1000 + o.mL);
        if (new Set(vals).size !== 4) return 'two options are the same amount: ' + vals.join();
        if (d.opts.some(o => !(isInt(o.L) && isInt(o.mL) && o.L >= 0 && o.mL >= 0 && o.mL < 1000))) return 'an option is not a real "L liters mL milliliters" (mL must be 0~999)';
        if (vals[d.ans] !== d.total) return 'ans does not point at ' + d.total;
      },
      addMixedUnits: d => {
        if (d.total !== d.aL * 1000 + d.aML + d.bML) return 'total != aL × 1000 + aML + bML';
      },
      fitsCapacity: d => {
        if (!(d.poured > 0 && d.poured < d.capacity)) return 'poured ' + d.poured + ' is not 1 ~ capacity−1';
        if (d.remaining !== d.capacity - d.poured) return 'remaining != capacity − poured';
      },
      gridRelation: d => {
        if (!isInt(d.minor) || d.minor * d.n !== d.major) return 'minor × n != major';
      },
      multiplyCheck: d => { if (d.total !== d.per * d.n) return 'total != per × n'; },
      shareDivide: d => { if (!isInt(d.share) || d.share * d.n !== d.total) return 'share × n != total'; }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'readCup': return String(d.ticks * d.tickValue);
        case 'convertLtoML': return String(d.L * 1000 + d.mL);
        case 'convertMLtoL': return lmL(Math.floor(d.total / 1000), d.total % 1000, lang);
        case 'addMixedUnits': return String(d.aL * 1000 + d.aML + d.bML);
        case 'fitsCapacity': return String(d.capacity - d.poured);
        case 'gridRelation': return String(d.major / d.n);
        case 'multiplyCheck': return String(d.per * d.n);
        case 'shareDivide': return String(d.total / d.n);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    /* 範圍從每個產生器自己的參數推出來：量杯 10 小格、一小格最多 100 → 1000；1～4 公升＋最多 900 毫升（誘答再 ＋100）；
       水壺最多 3000 ＋ 最多倒了 800；一大格最多 500、最多分 10 格；每瓶最多 500 × 最多 7 瓶（誘答 n＋1）；平分最多 2000。 */
    optionOk: function(s, genId, lang){
      if (genId === 'convertMLtoL'){
        const m = lang === 'zh' ? s.match(/^(\d+) 公升 (\d+) 毫升$/) : s.match(/^(\d+) L (\d+) mL$/);
        if (!m) return 'option "' + s + '" is not "L liters mL milliliters" in ' + lang;
        if (+m[2] > 999) return 'option "' + s + '" has 1000 mL or more — that is not how "L liters mL milliliters" is written';
        if (+m[1] > 49) return 'option "' + s + '" has more than 49 liters (the misconception L × 10 of a 1~4 liter question)';
        return;
      }
      if (!/^[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a positive whole number';
      const n = Number(s), MAX = { readCup:1000, convertLtoML:5000, addMixedUnits:3000, fitsCapacity:3800, gridRelation:5000, multiplyCheck:3500, shareDivide:2000 }[genId];
      if (MAX === undefined) return 'no range for ' + genId;
      if (n > MAX) return 'option ' + n + ' outside 1~' + MAX + ' for ' + genId;
    },
    /* 刻意的迷思誘答：讀量杯時把「第幾格」當成毫升數（忘了乘一小格）—— 只放行 ticks 那一個值；
       review.html 那一側用 avoidExcept([tickValue, ticks], [ticks]) 各自獨立地說出同一件事。 */
    /* 渲染出來的題目：沒有小數（這一課不教）；解釋與題幹裡的算式一律交給 arith.js 驗算（單位真的換算） */
    renderCheck: function(d, q){
      const all = [q.stem, q.why].concat(q.opts).join(' ').replace(/<[^>]+>/g, ' ');
      if (/\d\.\d/.test(all)) return 'a decimal number in a lesson without decimals: ' + all.slice(0, 80);
      const w = eqOf(q.why);
      if (w.problems.length) return 'why: ' + w.problems[0] + ' — ' + q.why;
      if (!w.verified) return 'why has no verified equation: ' + q.why;
      const s = eqOf(q.stem);
      if (s.problems.length) return 'stem: ' + s.problems[0] + ' — ' + q.stem;
    },
    stemEchoOk: {
      readCup: (d, opt) => String(opt) === String(d.ticks)
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「倒倒看」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GPICK, CMP_H, CMP_K, CMP_X, CMP_CUP, CMP_AMT, CMP_MEAS, CMP_BOX, GAME_CMP, cmpWaterH, cmpPieceW, SORT_H, SORT_BINS, SORT_BIN, SORT_CARD, GAME_SORT, sortBin, sortCardXY, LEVEL_H, LEVEL, GAME_LEVEL, levelY, levelSnap, DIG_H, DIG, DIG_KEYS, GAME_DIG, digOf, BOT_H, BOT_LBL, BOT_TANK, BOT_FULL, BOT_TOKEN, BOT_CAP, GAME_BOT, botTankH, botCellXY, botFullX}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. pre() ＋ arith.js 自己先證明會響（positive / negative control） --- */
      PROBES.forEach(([t, good]) => {
        const r = eqOf(t);
        if (good && (r.problems.length || r.verified < 1)) fail('arith self-test: "' + t + '" should be verified, got ' + JSON.stringify(r));
        if (!good && !r.problems.length) fail('arith self-test: "' + t + '" should be rejected, got ' + JSON.stringify(r));
      });
      let checkedEq = 0;
      const eq = (where, text) => { const r = eqOf(text); checkedEq += r.verified; r.problems.forEach(p => fail(where + ': ' + p + ' — ' + text)); return r; };

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      /* 題庫的誘答本來就是錯的說法（「不對，1 公升 ＝ 10 毫升」）：只驗正解那一個選項 */
      const banks = ['qs', 'qsAdv', 'qsBoost'];
      LANGS.forEach(L => {
        const rest = Object.assign({}, I18N[L]); banks.forEach(b => delete rest[b]);
        walk(rest, L, []).forEach(([where, s]) => eq(where, s));
        banks.forEach(b => (I18N[L][b] || []).forEach((q, i) => {
          const w = L + '.' + b + '[' + i + ']';
          eq(w + '.stem', q.stem); eq(w + '.why', q.why); eq(w + '.opts[ans]', q.opts[q.ans]);
        }));
      });
      const staticEq = checkedEq;
      if (staticEq < 30) fail('only ' + staticEq + ' equations verified in the I18N strings — the arithmetic scan is not reading them');
      /* 範例的旁白（函式）：拿範例自己的資料呼叫（資料從 index.html 讀） */
      const arr = re => { const m = src.match(re); if (!m) { fail('cannot read ' + re); return null; } return new Function('return ' + m[1])(); };
      const AMOUNTS = arr(/var AMOUNTS = (\[[^\]]*\]);/), TICKS = arr(/var TICKVALUES = (\[[^\]]*\]);/), CASES = arr(/var CONVERT_CASES = (\[[\s\S]*?\]);/);
      const FT = +((src.match(/var FILLED_TICKS = (\d+)/) || [])[1]);
      if (!FT) fail('cannot read FILLED_TICKS');
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        eq(where, text);
      };
      LANGS.forEach(L => {
        const d = I18N[L];
        (AMOUNTS || []).forEach(v => { seq('amtLine ' + L, d.amtLine(v), [v]); seq('amtChip ' + L, d.amtChip(v), [v]); });
        (TICKS || []).forEach(t => { seq('readLine ' + L, d.readLine(FT, t, FT * t), [FT, FT, t, FT * t]); seq('tickChip ' + L, d.tickChip(t), [t]); });
        (CASES || []).forEach(c => {
          const T = c.L * 1000 + c.mL;
          seq('convertLine1 ' + L, d.convertLine1(c.L, c.mL, T), [c.L, c.mL, c.L, 1000, c.mL, T]);
          seq('convertLine2 ' + L, d.convertLine2(T, Math.floor(T / 1000), T % 1000), [T, Math.floor(T / 1000), T % 1000, T, 1000, Math.floor(T / 1000), T % 1000]);
          seq('convertChip ' + L, d.convertChip(c.L, c.mL), [c.L, c.mL]);
        });
      });

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['cmp', 'sort', 'level', 'dig', 'bot'];
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
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_CMP', 'GAME_SORT', 'GAME_LEVEL', 'GAME_DIG', 'GAME_BOT'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });
      const addPieceSrc = extractFunction(src, 'addPiece') || '';
      if (!/if \(o\.axis === 'y'\) dx = 0;\s*P\.place\(orig\.x \+ dx, orig\.y \+ dy\);/.test(addPieceSrc)) fail('addPiece(): the water-level ▲ (axis "y") only moves up and down — that line is missing');

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('a sorting card (' + D.SORT_CARD.h + ' tall)', Math.min(D.SORT_CARD.w, D.SORT_CARD.h));
      tooSmall('a digit card (' + D.DIG_KEYS.size + ')', D.DIG_KEYS.size);
      tooSmall('a digit box with its pad', D.DIG.slot + 2 * D.DIG.pad);
      tooSmall('the empty bottle (' + D.BOT_TOKEN.size + ')', D.BOT_TOKEN.size);
      [D.SORT_CARD.h, D.DIG_KEYS.size, D.BOT_TOKEN.size].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('level', /var tok = addPiece\(B, \{ w:GPICK, h:GPICK, cx:V\.hx, cy:levelY\(0\),/, 'the ▲ is not GPICK × GPICK at the bottom of the cup');

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
      });

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const h = D.DIG.slot / 2, list = D.DIG.x.map((x, i) => ({ id:i, cx:x, cy:D.DIG.y, hw:h, hh:h, done:false }));
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - h + 0.5; x < b.cx + h; x += 2) for (let y = b.cy - h + 0.5; y < b.cy + h; y += 2){ const g = nearestOpen(list, { x, y }, D.DIG.pad); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestOpen(): ' + bad + ' points inside a digit box are given to another box (or none)');
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
          /* 比一比的兩個目的地：量杯和「一樣多」—— 量杯裡的點判給量杯，框裡的點判給框 */
          const M = D.CMP_MEAS, X = D.CMP_BOX, tg = [ { id:'m', cx:M.x, cy:M.y, hw:M.w / 2, hh:M.h / 2, done:false }, { id:'b', cx:X.x, cy:X.y, hw:X.w / 2, hh:X.h / 2, done:false } ];
          let badc = 0;
          for (let x = 0; x <= W; x += 2) for (let y = M.y - M.h / 2; y <= M.y + M.h / 2; y += 4){
            const g = nearestOpen(tg, { x, y }, 6), inM = Math.abs(x - M.x) <= M.w / 2, inX = Math.abs(x - X.x) <= X.w / 2;
            if ((inM && (!g || g.id !== 'm')) || (inX && (!g || g.id !== 'b'))) badc++;
          }
          if (badc) fail('nearestOpen(): ' + badc + ' points inside the measuring cup or the "same amount" box are given to the other one');
        }
      }

      /* --- 第 1 關：比一比（範例 1） --- */
      {
        const C = D.CMP_CUP, M = D.CMP_MEAS, X = D.CMP_BOX, A = D.CMP_AMT;
        /* 杯子的畫法要和範例 1 一樣（面積代表水量）：K 從範例 1 的 AREA_PER_ML 讀，不拿遊戲自己的 CMP_K 來驗它自己 */
        const AREA = +((src.match(/var AREA_PER_ML = (\d+);/) || [])[1]);
        if (!AREA) fail('cmp: cannot read AREA_PER_ML (example 1) from index.html');
        if (D.CMP_K !== AREA) fail('cmp: CMP_K ' + D.CMP_K + ' is not example 1\'s AREA_PER_ML ' + AREA + ' — the game draws water differently from the lesson');
        D.GAME_CMP.forEach((e, i) => {
          const w = 'GAME_CMP[' + i + ']';
          if (!Array.isArray(e) || e.length !== 3) return fail(w + ' should be three cups');
          if (e.map(c => c.w).sort((a, b) => a - b).join() !== '30,60,90') fail(w + ': widths should be 30, 60, 90 (one of each), got ' + e.map(c => c.w).join());
          e.forEach((c, k) => {
            if (!isInt(c.v) || c.v % 100 !== 0 || c.v < 100) fail(w + ' cup ' + k + ': ' + c.v + ' mL is not a whole number of 100 mL');
            if (c.v > M.max) fail(w + ' cup ' + k + ': ' + c.v + ' mL is more than the measuring cup holds (' + M.max + ')');
            const hMine = c.v * AREA / c.w;
            if (!near(D.cmpWaterH(c), hMine)) fail(w + ' cup ' + k + ': cmpWaterH() is ' + D.cmpWaterH(c) + ', should be ' + hMine + ' (mL × K ÷ width — the area is the amount)');
            if (hMine < 10 || hMine > C.h - 12) fail(w + ' cup ' + k + ': the water is ' + hMine.toFixed(1) + ' high in a ' + C.h + ' cup — too low to see or too close to the brim');
            const pw = Math.max(c.w + 12, D.GPICK);
            if (!near(D.cmpPieceW(c), pw)) fail(w + ': cmpPieceW() should be ' + pw);
          });
          const eqPairs = [];
          for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) if (e[a].v === e[b].v) eqPairs.push([a, b]);
          if (eqPairs.length !== 1) return fail(w + ': should hold exactly two equal cups, got ' + eqPairs.length + ' equal pairs');
          const [p, q] = eqPairs[0], o = [0, 1, 2].find(k => k !== p && k !== q);
          const H = k => e[k].v * D.CMP_K / e[k].w;
          if (Math.abs(H(p) - H(q)) < 6) fail(w + ': the two equal cups have (almost) the same water level — the picture alone would answer it');
          const twins = [p, q].filter(k => Math.abs(H(k) - H(o)) < 0.01);
          if (twins.length !== 1) fail(w + ': no cup has the same water level as the odd cup — "same level = same amount" must lead to a wrong pair');
          /* 照遊戲的規則玩：三杯都量過才能放；放第三杯（不一樣多的那杯）一律不收 → 唯一的解就是那一對 */
          const ends = new Set();
          (function go(meas, placed){
            if (placed.length === 2){ ends.add(placed.slice().sort().join()); return; }
            for (let k = 0; k < 3; k++){
              if (!(meas & (1 << k))) go(meas | (1 << k), placed);
              else if (meas === 7 && placed.indexOf(k) < 0 && k !== o) go(meas, placed.concat([k]));
            }
          })(0, []);
          if (ends.size !== 1 || !ends.has([p, q].sort().join())) fail(w + ': the rules can end with ' + [...ends].join(' / ') + ' — not only the equal pair');
          /* 版面：三杯放在三個位置的每一種排法都不重疊、都在畫板裡 */
          const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
          perms.forEach(pm => {
            const rects = pm.map((k, s) => sq(D.CMP_X[s], C.top + (C.h + C.lbl) / 2, Math.max(e[k].w + 12, D.GPICK), C.h + C.lbl));
            rects.forEach((r, s) => inside(r, w + ' cup at slot ' + s, W, D.CMP_H));
            noHits(rects, w + ' (order ' + pm.join('') + '): cups');
          });
          LANGS.forEach(L => {
            const d = I18N[L], nm = d.gCmpNames;
            if (!Array.isArray(nm) || nm.length !== 3 || new Set(nm).size !== 3) return fail('gCmpNames ' + L + ' should be three different names');
            const t = twins[0] === undefined ? p : twins[0];
            const odd = d.gCmpOdd(nm[o], e[o].v, nm[t], e[t].v);
            seq(w + ' gCmpOdd ' + L, odd, [e[o].v, e[t].v, e[o].v]);
            if (odd.indexOf(nm[o]) < 0 || odd.indexOf(nm[t]) < 0) fail(w + ' gCmpOdd ' + L + ' does not name both cups: ' + odd);
            if (e[o].v === e[t].v) fail(w + ': the odd cup is as much as its same-level cup — gCmpOdd would be false');
            seq(w + ' gCmpDone ' + L, d.gCmpDone(nm[p], nm[q], e[p].v), [e[p].v]);
            seq(w + ' gCmp2b ' + L, d.gCmp2b(nm[p], nm[q], e[p].v), [e[p].v]);
            e.forEach(c => { seq(w + ' gCmpPour ' + L, d.gCmpPour(nm[0], c.v), [c.v]); seq(w + ' gCmpAmt ' + L, d.gCmpAmt(c.v), [c.v]); seq(w + ' gCmpMeasLbl ' + L, d.gCmpMeasLbl(c.v), [c.v]); });
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let m = 0; m <= 3; m++) for (let p = 0; p <= 2; p++) seq('gCmpNow ' + L, d.gCmpNow(m, p), [m, 3, p, 2]);
          seq('gCmpMeasLbl(null) ' + L, d.gCmpMeasLbl(null), []);
          seq('gCmp2a ' + L, d.gCmp2a(d.gCmpNames.slice(1)), []);
          seq('gCmpAll ' + L, d.gCmpAll, []);
        });
        /* 量杯：每 100 毫升一條刻度；量杯、框、標籤不重疊 */
        if (M.max % 100 !== 0) fail('cmp: the measuring cup holds ' + M.max + ' — not whole 100s');
        const amts = D.CMP_X.map(x => ({ x:x - A.w / 2, y:A.y, w:A.w, h:A.h }));
        amts.forEach((r, k) => inside(r, 'cmp: amount label ' + k, W, D.CMP_H)); noHits(amts, 'cmp: amount labels');
        if (A.y < C.top + C.h + C.lbl) fail('cmp: the amount labels overlap the cups');
        const meas = sq(M.x, M.y, M.w, M.h), box = sq(X.x, X.y, X.w, X.h), mlbl = { x:M.x - 60, y:M.y + M.h / 2 + 2, w:120, h:M.lbl };
        [meas, box, mlbl].forEach((r, k) => inside(r, 'cmp: part ' + k, W, D.CMP_H));
        if (hit({ x:meas.x - 6, y:meas.y - 6, w:meas.w + 12, h:meas.h + 12 }, { x:box.x - 6, y:box.y - 6, w:box.w + 12, h:box.h + 12 })) fail('cmp: the measuring cup and the "same amount" box (with their drop pads) overlap each other');
        if (hit(mlbl, box)) fail('cmp: the measuring cup label overlaps the box');
        if (Math.min(meas.y, box.y) - 6 < A.y + A.h) fail('cmp: the amount labels reach the measuring cup or the box');
        need('cmp', /cups\.forEach\(function\(c, i\)\{ if \(cups\.filter\(function\(o\)\{ return o\.v === c\.v; \}\)\.length === 2\) pair\.push\(i\); else odd = i; \}\);/, 'the pair is not the two cups with the same mL');
        need('cmp', /pair\.forEach\(function\(i\)\{ if \(Math\.abs\(cups\[i\]\.h - cups\[odd\]\.h\) < 0\.01\) twin = i; \}\);/, 'the same-level cup is not found by water level');
        need('cmp', /if \(count\(\) < 3\)\{ roundInfo\(d\.gCmpAll\); return false; \}/, '"same amount" before every cup is measured is accepted (or counted as a mistake)');
        need('cmp', /if \(P\.data\.i === odd\)\{ roundMiss\(d\.gCmpOdd\(c\.nm, c\.v, cups\[twin\]\.nm, cups\[twin\]\.v\)\); return false; \}/, 'the odd cup is accepted in "same amount"');
        need('cmp', /if \(tg === meas\)\{[\s\S]*?c\.measured = true;\s*mw\.style\.height = \(c\.v \/ M\.max \* M\.h\) \+ 'px';[\s\S]*?return false;\s*\}/, 'the measuring cup does not show the poured amount (or the cup is kept there)');
        need('cmp', /placed\.push\(P\.data\.i\);\s*P\.lock\(P\.homeX, P\.homeY\); P\.el\.classList\.add\('placed'\);/, 'an accepted cup is not locked before it counts (the same cup could be put in twice)');
        need('cmp', /c\.amt\.textContent = d\.gCmpAmt\(c\.v\);/, 'the amount is not shown after pouring');
        need('cmp', /if \(placed\.length === 2\)\{ box\.done = true; roundSolved\(d\.gCmpDone\(cups\[pair\[0\]\]\.nm, cups\[pair\[1\]\]\.nm, cups\[pair\[0\]\]\.v\)\); \}/, 'the round is not solved exactly when both cups are in');
        need('cmp', /var html = '<div class="gvessel" style="width:' \+ c\.w \+ 'px;height:' \+ C\.h \+ 'px"><div class="gwater" style="width:' \+ c\.w \+ 'px;height:' \+ cmpWaterH\(c\) \+ 'px">/, 'the cups are not drawn c.w wide with cmpWaterH() of water');
        need('cmp', /var P = addPiece\(B, \{ w:cmpPieceW\(c\), h:C\.h \+ C\.lbl, cx:cx, cy:cy,/, 'the cups are not cmpPieceW() wide');
        need('cmp', /renderTray\(B, e, function\(i\)\{ return \{ x:CMP_X\[i\], y:C\.top \+ \(C\.h \+ C\.lbl\) \/ 2 \}; \}/, 'the cups are not placed at CMP_X');
      }

      /* --- 第 2 關：分一分（範例 2：1 公升 ＝ 1000 毫升） --- */
      {
        const S = D.SORT_BIN, CD = D.SORT_CARD, cap = Math.floor((S.h - 3 - 20 - S.head) / S.step) + 1;
        /* 字的大小從 index.html 的 CSS 讀（卡片 .gscard、格子裡的小卡 .gbini），不在這裡另抄一份 */
        const cssPx = sel => { const m = src.match(new RegExp('\\n\\s*\\' + sel + '\\{[^}]*?font-size:([\\d.]+)px')); return m ? +m[1] : NaN; };
        const cardPx = cssPx('.gscard'), binPx = cssPx('.gbini'), headPx = cssPx('.gbinh');
        if (!(cardPx > 0) || !(binPx > 0) || !(headPx > 0)) fail('sort: cannot read the font size of .gscard / .gbini from index.html');
        for (let v = 0; v <= 5000; v++){ const mine = v < 1000 ? 'lt' : v === 1000 ? 'eq' : 'gt'; if (D.sortBin(v) !== mine){ fail('sortBin(' + v + ') is ' + D.sortBin(v) + ', should be ' + mine); break; } }
        if (D.SORT_BINS.join() !== 'lt,eq,gt') fail('SORT_BINS should be lt,eq,gt (left to right: less, exactly, more)');
        let any100 = false, anyBig = false, anyMLge = false;
        D.GAME_SORT.forEach((e, i) => {
          const w = 'GAME_SORT[' + i + ']';
          if (!Array.isArray(e) || e.length !== 5) return fail(w + ' should be five cards');
          if (new Set(e.map(c => c.v)).size !== 5) fail(w + ': two cards are both the same amount');
          const per = { lt:0, eq:0, gt:0 };
          e.forEach(c => {
            per[c.v < 1000 ? 'lt' : c.v === 1000 ? 'eq' : 'gt']++;
            if (!isInt(c.v) || c.v < 1 || c.v > 3000) fail(w + ': ' + c.v + ' mL outside 1~3000');
            if (c.f === 'L' && c.v % 1000 !== 0) fail(w + ': ' + c.v + ' is not written as whole liters');
            if (c.f === 'Lm' && !(c.v > 1000 && c.v % 1000 !== 0)) fail(w + ': ' + c.v + ' is not written as "L liters mL milliliters" (needs liters and mL)');
            if (['m', 'L', 'Lm'].indexOf(c.f) < 0) fail(w + ': unknown form ' + c.f);
            if (c.f === 'm' && c.v === 100) any100 = true;
            if (c.f === 'm' && c.v >= 600 && c.v < 1000) anyBig = true;
            if (c.f === 'm' && c.v >= 1000) anyMLge = true;
          });
          ['lt', 'eq', 'gt'].forEach(k => { if (!per[k]) fail(w + ': no card for bin ' + k); if (per[k] > cap) fail(w + ': ' + per[k] + ' cards for bin ' + k + ' — a bin holds at most ' + cap); });
          if (!e.some(c => c.f !== 'm')) fail(w + ': every card is in mL — nothing to convert');
          LANGS.forEach(L => {
            const d = I18N[L];
            e.forEach(c => {
              const txt = d.gSortCard(c.v, c.f), want = c.f === 'm' ? [c.v] : c.f === 'L' ? [c.v / 1000] : [Math.floor(c.v / 1000), c.v % 1000];
              seq(w + ' gSortCard ' + L, txt, want);
              const shown = c.f === 'm' ? txt : txt + (L === 'zh' ? ' ＝ ' : ' = ') + c.v + (L === 'zh' ? ' 毫升' : ' mL');
              if (eqOf(shown).problems.length) fail(w + ' gSortCard ' + L + ': "' + txt + '" is not ' + c.v + ' mL');
              if (textW(txt, cardPx) > CD.w - 6) fail(w + ' gSortCard ' + L + ': "' + txt + '" is wider than the card (' + textW(txt, cardPx).toFixed(0) + ' > ' + (CD.w - 6) + ')');
              if (textW(txt, binPx) > S.w - 6) fail(w + ' gSortCard ' + L + ': "' + txt + '" does not fit in a bin (' + textW(txt, binPx).toFixed(0) + ' > ' + (S.w - 6) + ')');
              const k = c.v < 1000 ? 'lt' : c.v === 1000 ? 'eq' : 'gt', why = d.gSortWhy(txt, c.v, c.f, k);
              seq(w + ' gSortWhy ' + L, why, want.concat(c.f === 'm' ? [] : [c.v]).concat([1000, 1]));
              const word = L === 'zh' ? { lt:'比 1000 毫升少', eq:'剛好是 1000 毫升', gt:'比 1000 毫升多' }[k] : { lt:'less than 1000', eq:'exactly 1000', gt:'more than 1000' }[k];
              if (why.indexOf(word) < 0 || why.indexOf(d.gSortBins[k]) < 0) fail(w + ' gSortWhy ' + L + ': does not say "' + word + '" and name the bin "' + d.gSortBins[k] + '": ' + why);
              seq(w + ' gSort2 ' + L, d.gSort2(txt, c.v, c.f), c.f === 'm' ? [c.v, 1000] : want.concat([c.v]));
            });
          });
          /* 照規則玩：每張卡只收進 sortBin(v) —— 五張都放得進去，而且每一格最後裝的都是對的卡 */
          const placed = { lt:[], eq:[], gt:[] };
          e.forEach(c => ['lt', 'eq', 'gt'].forEach(k => { if (D.sortBin(c.v) === k) placed[k].push(c.v); }));
          if (placed.lt.concat(placed.eq, placed.gt).length !== 5 || placed.lt.some(v => v >= 1000) || placed.eq.some(v => v !== 1000) || placed.gt.some(v => v <= 1000)) fail(w + ': the sorting rule puts a card in the wrong bin');
        });
        if (!any100) fail('GAME_SORT: no entry has "100 毫升" — the "1 liter = 100 mL" misconception is never tested');
        if (!anyBig) fail('GAME_SORT: no "600~999 mL" card — a big-looking number below 1 liter is never tested');
        if (!anyMLge) fail('GAME_SORT: no card of 1000 mL or more written in mL');
        LANGS.forEach(L => {
          const d = I18N[L];
          ['lt', 'eq', 'gt'].forEach(k => { seq('gSortBins.' + k + ' ' + L, d.gSortBins[k], [1]); if (textW(d.gSortBins[k], headPx) > S.w - 12) fail('gSortBins.' + k + ' ' + L + ' "' + d.gSortBins[k] + '" does not fit one line of a bin (' + textW(d.gSortBins[k], headPx).toFixed(0) + ' > ' + (S.w - 12) + ')'); });
          for (let p = 0; p <= 5; p++) seq('gSortNow ' + L, d.gSortNow(p, 5), [p, 5]);
          seq('gSortDone ' + L, d.gSortDone(5), [5, 1000]);
        });
        const cards = [];
        for (let k = 0; k < 5; k++){
          const pt = D.sortCardXY(k), m = k < 4 ? { x:k % 2 ? 224 : 76, y:150 + Math.floor(k / 2) * 58 } : { x:150, y:266 };
          if (!near(pt.x, m.x) || !near(pt.y, m.y)) fail('sortCardXY(' + k + ') is ' + JSON.stringify(pt) + ', should be ' + JSON.stringify(m));
          cards.push(sq(m.x, m.y, CD.w, CD.h));
        }
        cards.forEach((r, k) => inside(r, 'sort: card ' + k, W, D.SORT_H)); noHits(cards, 'sort: cards');
        const bins = S.x.map(x => ({ x:x - S.w / 2, y:S.y, w:S.w, h:S.h }));
        bins.forEach((r, k) => inside(r, 'sort: bin ' + k, W, D.SORT_H)); noHits(bins, 'sort: bins');
        if (Math.min(...cards.map(c => c.y)) < S.y + S.h + 4 + 4) fail('sort: the cards reach the bins (or their drop pad)');
        need('sort', /var v = P\.data\.v, want = sortBin\(v\), txt = d\.gSortCard\(v, P\.data\.f\);/, 'the right bin is not sortBin(v)');
        need('sort', /if \(b\.k !== want\)\{ roundMiss\(d\.gSortWhy\(txt, v, P\.data\.f, want\)\); return false; \}/, 'a card is accepted in the wrong bin');
        need('sort', /P\.lock\(P\.homeX, P\.homeY\); P\.el\.classList\.add\('gone'\);\s*done\+\+;/, 'an accepted card is not locked before it counts (one card could be sorted five times)');
        need('sort', /if \(done === n\) roundSolved\(d\.gSortDone\(n\)\);/, 'the round is not solved exactly when every card is sorted');
        need('sort', /var b = nearestOpen\(bins, pt, 4\);\s*if \(!b\) return false;/, 'a drop away from the bins is not silent');
        need('sort', /addIn\(b\.el, 'gbini', \{ top:\(S\.head \+ b\.n \* S\.step\) \+ 'px' \}, txt\);/, 'cannot read where a sorted card is listed in its bin');
        need('sort', /renderTray\(B, e, sortCardXY,/, 'the cards are not placed at sortCardXY()');
      }

      /* --- 第 3 關：倒到刻度（範例 3） --- */
      {
        const V = D.LEVEL, bottom = V.top + V.n * V.step;
        for (let k = 0; k <= V.n; k++) if (!near(D.levelY(k), V.top + (V.n - k) * V.step)) fail('levelY(' + k + ') should be ' + (V.top + (V.n - k) * V.step));
        for (let y = -20; y <= D.LEVEL_H + 20; y += 0.5){
          const mine = Math.max(0, Math.min(V.n, Math.round((bottom - y) / V.step)));
          if (D.levelSnap(y) !== mine){ fail('levelSnap(' + y + ') is ' + D.levelSnap(y) + ', should be ' + mine + ' (the nearest tick)'); break; }
        }
        if (V.n !== 10) fail('LEVEL.n should be 10 (the lesson\'s measuring cup has 10 small ticks)');
        const ts = new Set();
        D.GAME_LEVEL.forEach((e, i) => {
          const w = 'GAME_LEVEL[' + i + ']';
          if (![e.t, e.every, e.X].every(isInt)) return fail(w + ' is not whole numbers');
          ts.add(e.t);
          if ([10, 20, 25, 50].indexOf(e.t) < 0) fail(w + ': one tick ' + e.t + ' mL — should be 10, 20, 25 or 50 (one tick of 100 would make "every tick is 100 mL" right)');
          if (e.every < 2 || e.every > 5) fail(w + ': a numbered line every ' + e.every + ' ticks — should be 2~5');
          if (e.X % e.t !== 0) return fail(w + ': ' + e.X + ' mL is not a whole number of ticks of ' + e.t);
          const k = e.X / e.t, M = e.t * e.every;
          if (k < 1 || k > V.n - 1) fail(w + ': tick ' + k + ' is beyond the top of a ' + V.n + '-tick cup (or empty)');
          if (e.X % M === 0) fail(w + ': ' + e.X + ' mL is on a numbered line — reading one small tick is never needed');
          if (e.X % 100 === 0 && e.X / 100 === k) fail(w + ': "one tick of 100 mL" gives the right tick too');
          /* 照規則玩：水位停在 0～n 的一小格；只有 k 這一格按「倒好了」會過關，0 只提醒 */
          const outcomes = []; for (let j = 0; j <= V.n; j++) outcomes.push(j === 0 ? 'note' : j === k ? 'win' : 'miss');
          if (outcomes.filter(x => x === 'win').length !== 1) fail(w + ': the level can be won at ' + outcomes.filter(x => x === 'win').length + ' ticks');
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let j = 0; j <= V.n; j++){
              seq(w + ' gLevelNow ' + L, d.gLevelNow(e.X, j), [e.X, j]);
              if (j >= 1 && j !== k) seq(w + ' gLevelWrong ' + L, d.gLevelWrong(M, e.every, e.t, j, e.X), [M, e.every, e.t, j, j, e.t, j * e.t, e.X]);
            }
            seq(w + ' gLevelDone ' + L, d.gLevelDone(k, e.t, e.X), [k, k, e.t, e.X]);
            seq(w + ' gLevel2 ' + L, d.gLevel2(M, e.every, e.t, e.X), [M, e.every, e.t, e.X, e.t, k, k]);
          });
          /* 標了數字的線：每 every 小格一條，數字是 j × t，互不重疊、在量杯左邊、在畫板裡 */
          const labs = []; for (let j = e.every; j <= V.n; j += e.every) labs.push({ x:V.cx - V.w / 2 - 6 - V.lw, y:D.levelY(j) - 11, w:V.lw, h:22 });
          labs.forEach((r, j) => inside(r, w + ' numbered line ' + j, W, D.LEVEL_H)); noHits(labs, w + ': numbered lines');
          if (textW(String(V.n * e.t), 15) > V.lw) fail(w + ': the top number ' + (V.n * e.t) + ' does not fit ' + V.lw);
        });
        if (ts.size < 3) fail('GAME_LEVEL: only ' + ts.size + ' different tick sizes');
        LANGS.forEach(L => { seq('gLevelEmpty ' + L, I18N[L].gLevelEmpty, []); seq('gLevelUnit ' + L, I18N[L].gLevelUnit, []); });
        const cup = { x:V.cx - V.w / 2, y:V.top, w:V.w, h:V.n * V.step }, unit = { x:V.cx - V.w / 2, y:V.unitY, w:V.w, h:24 };
        inside(cup, 'level: the cup', W, D.LEVEL_H); inside(unit, 'level: the unit label', W, D.LEVEL_H);
        if (hit(unit, cup)) fail('level: the unit label overlaps the cup');
        const hLo = sq(V.hx, D.levelY(0), D.GPICK), hHi = sq(V.hx, D.levelY(V.n), D.GPICK);
        inside(hLo, 'level: the ▲ at the bottom', W, D.LEVEL_H); inside(hHi, 'level: the ▲ at the top', W, D.LEVEL_H);
        if (hLo.x < cup.x + cup.w + 4) fail('level: the handle overlaps the cup');
        if (V.step * 2 < 22 + 2) fail('level: ticks ' + V.step + ' apart — the numbered lines would touch');
        need('level', /var e = pick\(GAME_LEVEL\), V = LEVEL, k = 0, want = e\.X \/ e\.t, major = e\.t \* e\.every;/, 'the answer is not X ÷ t');
        need('level', /if \(k === 0\)\{ gMsg\.textContent = d\.gLevelEmpty; return; \}/, 'an empty cup is counted as a mistake (or accepted)');
        need('level', /if \(k !== want\)\{ roundMiss\(d\.gLevelWrong\(major, e\.every, e\.t, k, e\.X\)\); return; \}/, 'a wrong level is accepted');
        need('level', /k = levelSnap\(pt\.y\);\s*P\.homeY = levelY\(k\); P\.home\(\);/, 'the level is not snapped to the nearest tick');
        need('level', /onPlace:function\(P\)\{ water\.style\.height = \(levelSnap\(P\.cy\) \* V\.step\) \+ 'px'; \}/, 'the water does not follow the ▲');
        need('level', /for \(var j = e\.every; j <= V\.n; j \+= e\.every\) addZone\(B, V\.cx - V\.w \/ 2 - 6 - V\.lw, levelY\(j\) - 11, V\.lw, 22, 'glbl gmaj', String\(j \* e\.t\)\);/, 'the numbered lines are not j × t at levelY(j)');
        need('level', /addIn\(cz, 'gtick' \+ \(i % e\.every === 0 \? ' major' : ''\), \{ bottom:\(i \* V\.step\) \+ 'px' \}\);/, 'the ticks are not one every V.step (big every e.every)');
        need('level', /if \(pt\.tap && \(pt\.x < V\.cx - V\.w \/ 2 - 8 \|\| pt\.x > V\.hx \+ GPICK \/ 2 \|\| pt\.y < V\.top - 12 \|\| pt\.y > levelY\(0\) \+ 12\)\) return false;/, 'a tap away from the cup moves the water');
      }

      /* --- 第 4 關：數字卡（範例 4：公升毫升 → 毫升） --- */
      {
        const G = D.DIG, KY = D.DIG_KEYS, h = G.slot / 2;
        let anyZero = false, anyPad = false, anyBig = false;
        D.GAME_DIG.forEach((e, i) => {
          const w = 'GAME_DIG[' + i + ']';
          if (!isInt(e.L) || !isInt(e.mL)) return fail(w + ' is not whole numbers');
          if (e.L < 1 || e.L > 4) fail(w + ': ' + e.L + ' liters — should be 1~4 liters (a four-digit answer)');
          if (e.mL < 0 || e.mL > 999) fail(w + ': ' + e.mL + ' mL — should be 0~999');
          if (e.mL === 0) anyZero = true; else if (e.mL < 100) anyPad = true; else anyBig = true;
          const T = e.L * 1000 + e.mL, mine = [Math.floor(T / 1000), Math.floor(T / 100) % 10, Math.floor(T / 10) % 10, T % 10];
          if (D.digOf(T).join() !== mine.join()) fail(w + ': digOf(' + T + ') is ' + D.digOf(T).join() + ', should be ' + mine.join());
          if (mine.join('') !== String(T)) fail(w + ': my own digits are off');
          /* 照規則玩：每一格只收自己的數字、數字卡用完回原位 → 任何順序都填得完，填完就是 T */
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gDigFact ' + L, d.gDigFact(e.L, e.mL), [e.L, e.mL]);
            seq(w + ' gDigDone ' + L, d.gDigDone(e.L, e.mL, T), [e.L, e.mL, e.L, 1000, e.mL, T]);
            seq(w + ' gDig2 ' + L, d.gDig2(e.L, e.mL), [e.L, e.L * 1000, e.L * 1000, e.mL, T]);
            for (let v = 0; v <= 9; v++){
              if (v !== mine[0]) seq(w + ' gDigL card ' + v + ' ' + L, d.gDigL(e.L, v), [e.L, e.L * 1000, e.L, v]);
              for (let s = 1; s <= 3; s++){
                if (v === mine[s]) continue;
                const txt = d.gDigM(e.mL, s, mine[s], v), pad = ('00' + e.mL).slice(-3);
                seq(w + ' gDigM box ' + s + ' card ' + v + ' ' + L, txt, [e.mL, +pad, mine[s], v]);
                if (txt.indexOf(pad) < 0) fail(w + ' gDigM ' + L + ': does not show the last three digits "' + pad + '": ' + txt);
                const word = L === 'zh' ? ['', '百位', '十位', '個位'][s] : ['', 'hundreds', 'tens', 'ones'][s];
                if (txt.indexOf(word) < 0) fail(w + ' gDigM ' + L + ' does not say "' + word + '": ' + txt);
              }
            }
          });
        });
        if (!anyZero) fail('GAME_DIG: no entry with 0 mL — "3 liters = 3000" is never practised');
        if (!anyPad) fail('GAME_DIG: no entry with 0 < mL < 100 — the missing zero (1 liter 50 mL = 1050, not 150) is never practised');
        if (!anyBig) fail('GAME_DIG: no entry with 100 mL or more');
        LANGS.forEach(L => {
          const d = I18N[L];
          if (!Array.isArray(d.gDigPlaces) || d.gDigPlaces.length !== 4) fail('gDigPlaces ' + L + ' should be 4 place names');
          for (let p = 0; p <= 4; p++) seq('gDigNow ' + L, d.gDigNow(p), [p, 4]);
        });
        const slots = G.x.map(x => sq(x, G.y, G.slot)), places = G.x.map(x => ({ x:x - h, y:G.py, w:G.slot, h:G.ph }));
        const unit = { x:G.ux - G.uw / 2, y:G.y - h, w:G.uw, h:G.slot }, fact = { x:0, y:G.fy, w:W, h:G.fh };
        slots.concat(places, [unit, fact]).forEach((r, k) => inside(r, 'dig: part ' + k, W, D.DIG_H));
        noHits(slots.concat([unit]), 'dig: boxes'); noHits(places, 'dig: place names');
        for (let s = 1; s < 4; s++) if (G.x[s] - G.x[s - 1] < G.slot + 2 * G.pad + 6) fail('dig: boxes ' + (s - 1) + ' and ' + s + ' — their drop pads touch');
        if (G.py + G.ph > G.y - h) fail('dig: the place names overlap the boxes');
        if (G.fy + G.fh > G.py) fail('dig: the question overlaps the place names');
        if (unit.x < G.x[3] + h + 2) fail('dig: the unit touches the last box');
        const keys = []; for (let v = 0; v <= 9; v++) keys.push(sq(150 + ((v % 5) - 2) * KY.step, KY.y + Math.floor(v / 5) * KY.rowStep, KY.size));
        keys.forEach((o, k) => inside(o, 'dig: digit card ' + k, W, D.DIG_H)); noHits(keys, 'dig: digit cards');
        if (KY.y - KY.size / 2 < G.y + h + G.pad + 4) fail('dig: the digit cards reach the boxes');
        need('dig', /var e = pick\(GAME_DIG\), T = e\.L \* 1000 \+ e\.mL, ds = digOf\(T\),/, 'the answer is not L × 1000 + mL');
        need('dig', /return \{ i:i, v:ds\[i\], el:addZone\(B, x - h, G\.y - h, G\.slot, G\.slot, 'gslot'\), cx:x, cy:G\.y, hw:h, hh:h, done:false \};/, 'the boxes are not digOf(T) at DIG.x');
        need('dig', /var s = nearestOpen\(slots, pt, G\.pad\);\s*if \(!s\) return false;/, 'a drop away from the boxes is not silent');
        need('dig', /if \(v !== s\.v\)\{ roundMiss\(s\.i === 0 \? d\.gDigL\(e\.L, v\) : d\.gDigM\(e\.mL, s\.i, s\.v, v\)\); return false; \}/, 'a wrong digit is accepted (or has no reason of its own)');
        need('dig', /P\.home\(\); P\.el\.classList\.remove\('sel'\); if \(B\.selected === P\) B\.selected = null;/, 'the digit card does not go back (cards must never run out)');
        need('dig', /if \(filled === 4\) roundSolved\(d\.gDigDone\(e\.L, e\.mL, T\)\);/, 'the round is not solved exactly when every box is filled');
        need('dig', /cx:150 \+ \(\(v % 5\) - 2\) \* DIG_KEYS\.step, cy:DIG_KEYS\.y \+ Math\.floor\(v \/ 5\) \* DIG_KEYS\.rowStep,/, 'cannot read where the digit cards are drawn');
      }

      /* --- 第 5 關：裝瓶子（範例 4：毫升 → 公升毫升） --- */
      {
        const Z = D.BOT_TANK, F = D.BOT_FULL, TK = D.BOT_TOKEN, CP = D.BOT_CAP;
        const maxLen = +((B.bot.match(/inp\.maxLength = (\d+);/) || [])[1]);
        if (!maxLen) fail('bot: cannot read the answer box maxLength');
        const reSrc = (B.bot.match(/if \(!(\/\^[^\n]*?\$\/)\.test\(t\)\)\{ gMsg\.textContent = d\.gBotEmpty; return; \}/) || [])[1];
        if (!reSrc) fail('bot: cannot read the answer pattern');
        else {
          const re = new Function('return ' + reSrc)();
          ['600', '0', '1000'].forEach(t => { if (!re.test(t)) fail('bot: the answer "' + t + '" is not accepted'); });
          ['6 0', '060', '6.0', '', '-6', '600mL'].forEach(t => { if (re.test(t)) fail('bot: the malformed answer "' + t + '" is counted as a mistake or read as a number'); });
        }
        need('bot', /var t = inp\.value\.trim\(\);/, 'the answer is not just trimmed (inner spaces would be read as a number)');
        let anyZero = false, anyBig = false;
        D.GAME_BOT.forEach((T, i) => {
          const w = 'GAME_BOT[' + i + ']';
          if (!isInt(T) || T % 100 !== 0) return fail(w + ': ' + T + ' mL is not a whole number of 100 mL squares');
          if (T < 1100 || T > 3900) fail(w + ': ' + T + ' mL — should be 1100~3900 (1~3 bottles and a 4-row tank)');
          const q = Math.floor(T / 1000), r = T % 1000, rows = Math.ceil(T / 1000);
          if (r === 0) anyZero = true;
          if (r >= 500) anyBig = true;
          if (String(r).length > maxLen) fail(w + ': the leftover ' + r + ' does not fit the ' + maxLen + '-digit answer box');
          /* 照規則玩：還有 1000 以上就一定要再倒（「倒完了」不收），不到 1000 就不能再倒 */
          let left = T, bottles = 0;
          while (left >= 1000){ left -= 1000; bottles++; }
          if (bottles !== q || left !== r) fail(w + ': pouring ends at ' + bottles + ' bottles, ' + left + ' left');
          const tank = { x:Z.x, y:Z.y, w:Z.w, h:D.botTankH(rows) };
          if (!near(tank.h, rows * Z.step + 2 * Z.pad)) fail(w + ': botTankH(' + rows + ') should be ' + (rows * Z.step + 2 * Z.pad));
          inside(tank, w + ' tank', W, D.BOT_H);
          const cells = [];
          for (let c = 0; c < T / 100; c++){
            const p = D.botCellXY(c), m = { x:Z.pad + (c % 10) * Z.step + (Z.step - Z.cell) / 2, y:Z.pad + Math.floor(c / 10) * Z.step + (Z.step - Z.cell) / 2 };
            if (!near(p.x, m.x) || !near(p.y, m.y)){ fail(w + ': botCellXY(' + c + ') is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(m)); break; }
            if (m.x < 3 || m.y < 3 || m.x + Z.cell > Z.w - 3 || m.y + Z.cell > tank.h - 3){ fail(w + ': squares stick out of the tank (or touch its 3px outline)'); break; }
            cells.push({ x:m.x, y:m.y, w:Z.cell, h:Z.cell });
          }
          noHits(cells, w + ': squares');
          if (Z.y + tank.h + 6 > F.y - F.h / 2 - 4) fail(w + ': the tank (with its drop pad) reaches the full bottles');
          const full = []; for (let b = 0; b < q; b++){ if (!near(D.botFullX(b), F.x0 + b * F.step)) fail('botFullX(' + b + ') should be ' + (F.x0 + b * F.step)); full.push(sq(F.x0 + b * F.step, F.y, F.w, F.h)); }
          full.forEach((o, b) => inside(o, w + ' full bottle ' + b, W, D.BOT_H)); noHits(full, w + ': full bottles');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gBotTank ' + L, d.gBotTank(T), [T, 100]);
            for (let b = 0; b <= q; b++){
              const lf = T - b * 1000;
              seq(w + ' gBotNow ' + L, d.gBotNow(T, b, lf), [T, b, lf]);
              if (lf >= 1000){ seq(w + ' gBotMore ' + L, d.gBotMore(lf), [lf, 1, 1000]); seq(w + ' gBot2 ' + L, d.gBot2(lf), [lf]); }
            }
            seq(w + ' gBotLine ' + L, d.gBotLine(T, q, r), r ? [T, q, r] : [T, q]);
            seq(w + ' gBotDone ' + L, d.gBotDone(T, q, r), r ? [T, q, r, q, 1, r] : [T, q, q, 1]);
            if (r){
              seq(w + ' gBotShort ' + L, d.gBotShort(r), [r, 1000, 1]);
              seq(w + ' gBot2 ' + L, d.gBot2(r), [r / 100, r / 100, 100, r]);
              seq(w + ' gBotCells ' + L, d.gBotCells(r / 100, r), [100, r / 100, r / 100, 100, r]);
              [r + 100, r - 100, 7].forEach(v => seq(w + ' gBotWrong ' + L, d.gBotWrong(v, r / 100), [r / 100, 100, v]));
            }
            seq(w + ' gBotType ' + L, d.gBotType(q), [q]);
          });
        });
        if (!anyZero) fail('GAME_BOT: no entry fills the bottles exactly — "nothing left over" is never practised');
        if (!anyBig) fail('GAME_BOT: no entry leaves 500 mL or more');
        LANGS.forEach(L => { const d = I18N[L]; seq('gBotCap ' + L, d.gBotCap, [1]); seq('gBotFull ' + L, d.gBotFull, [1]); seq('gBotEmpty ' + L, d.gBotEmpty, L === 'zh' ? [0] : []); });
        const tok = sq(TK.x, TK.y, TK.size), cap = { x:CP.x, y:CP.y, w:CP.w, h:CP.h };
        inside(tok, 'bot: the bottle', W, D.BOT_H); inside(cap, 'bot: its label', W, D.BOT_H); inside({ x:0, y:D.BOT_LBL.y, w:W, h:D.BOT_LBL.h }, 'bot: the tank label', W, D.BOT_H);
        if (hit(tok, cap)) fail('bot: the bottle you drag overlaps its label');
        if (F.y + F.h / 2 > Math.min(tok.y, cap.y) - 4) fail('bot: the full bottles overlap the bottle you drag');
        if (D.BOT_LBL.y + D.BOT_LBL.h > Z.y) fail('bot: the tank label overlaps the tank');
        if (Z.w !== 10 * Z.step + 2 * Z.pad) fail('bot: the tank is ' + Z.w + ' wide — a row of 10 squares needs ' + (10 * Z.step + 2 * Z.pad));
        need('bot', /if \(left < 1000\)\{ roundMiss\(d\.gBotShort\(left\)\); return false; \}/, 'a bottle that cannot be filled is accepted');
        need('bot', /if \(left >= 1000\)\{ roundMiss\(d\.gBotMore\(left\)\); return; \}/, '"all poured" is accepted while a full bottle is still possible');
        need('bot', /for \(var j = 0; j < 10; j\+\+\) cells\[q \* 10 \+ j\]\.style\.visibility = 'hidden';[^\n]*\n\s*left -= 1000; q\+\+;/, 'a bottle does not take exactly one row of 10 squares');
        need('bot', /if \(v === left\)\{/, 'the typed leftover is not compared with what is left');
        need('bot', /else if \(left > 0 && v === left \/ 100\) roundMiss\(d\.gBotCells\(left \/ 100, left\)\);\s*else roundMiss\(d\.gBotWrong\(v, left \/ 100\)\);/, 'a wrong leftover is accepted, or typing the number of squares has no reason of its own');
        need('bot', /if \(left === 0\)\{\s*typing = true; done\.disabled = true;\s*P\.lock\(P\.homeX, P\.homeY\); P\.el\.classList\.add\('gone'\);\s*line\.textContent = d\.gBotLine\(T, q, 0\);\s*roundSolved\(d\.gBotDone\(T, q, 0\)\);/, 'an exact fill does not finish on its own');
        need('bot', /if \(!nearestOpen\(\[tank\], pt, 6\)\) return false;/, 'a drop away from the tank is not silent');
        need('bot', /for \(var c = 0; c < T \/ 100; c\+\+\)\{ var p = botCellXY\(c\);/, 'the tank is not T ÷ 100 squares at botCellXY()');
        need('bot', /var tz = addZone\(B, Z\.x, Z\.y, Z\.w, botTankH\(rows\), 'gtank'\)/, 'cannot read where the tank is drawn');
      }
      if (checkedEq < 400) fail('only ' + checkedEq + ' equations verified in total — the game sentences are not being checked');
    }
  }
};
module.exports._test = { pre, eqOf };
