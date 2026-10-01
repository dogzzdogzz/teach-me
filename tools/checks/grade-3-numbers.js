/* grade-3/math/numbers 的檢查設定（數字大樓：一萬以內的位值、化聚、讀寫與 0 佔位、比大小、數線上的大概位置）。
   2026-10-01 新增 —— 和小遊戲「蓋數字大樓」改成五關五種玩法（§六之五）同一次寫成。

   sim（review.html 的十二個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算；
   中文念法用這裡自己寫的 myZh()，不呼叫課程的 toChineseNumber）。題目的圖（數線、長方形）
   改成 fmt() 只回傳資料，renderCheck 驗資料和題目一致。

   data（index.html）：
   - 課程的 toChineseNumber() 與 toEnglishNumber() 拿 1～9999 每一個數和這裡自己的念法逐一比，
     再用這裡自己的「念法 → 數字」讀回來（兩個方向都驗）。
   - 三層題庫：每一題的正解用自己的算法重算（不是讀 ans）；所有 I18N 靜態字串裡的算式逐條重算
     （a ÷ b ＝ q（餘 r）、a × b ＝ c、a ＋ b ＝ c、a − b ＝ c）。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區；切片從「共用數學引擎」開始（念法函式在那裡）。
     每一關用自己的算法重算答案，並且照遊戲的規則把每一題從頭玩一次；每一句說明逐個比數字；
     版面數字一律從 index.html 讀；nearestOpen()、roundMiss() 與拆千的 submit() 從原始碼切出來實際執行；
     RENDER 裡切不出來的幾條關鍵規則用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-numbers 的端對端測試驗
   （合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
const VAL = [1000, 100, 10, 1];
const dig = (n, p) => Math.floor(n / VAL[p]) % 10;

/* ---- 自己的念法（第二套實作）---- */
const ZD = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function myZh(n){
  if (n === 0) return '零';
  const ds = [0, 1, 2, 3].map(p => dig(n, p)), U = ['千', '百', '十', ''];
  let out = '', started = false, gap = false;
  for (let p = 0; p < 4; p++){
    const d = ds[p];
    if (d === 0){ if (started) gap = true; continue; }
    if (gap){ out += '零'; gap = false; }
    /* 十位是 1：最高位就是十位時念「十」，前面有千或百時念「一十」 */
    out += (p === 2 && d === 1 && !started) ? '十' : ZD[d] + U[p];
    started = true;
  }
  return out;
}
function parseZh(s){
  const D = { '零':0, '一':1, '二':2, '兩':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 }, U = { '千':1000, '百':100, '十':10 };
  let v = 0, cur = 0;
  for (const c of s){
    if (c in D) cur = D[c];
    else if (c in U){ v += (cur || 1) * U[c]; cur = 0; }
    else return NaN;
  }
  return v + cur;
}
const W1 = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const WT = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const W10 = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function myEn(n){
  if (n === 0) return 'zero';
  const out = [];
  if (dig(n, 0)) out.push(W1[dig(n, 0)] + ' thousand');
  if (dig(n, 1)) out.push(W1[dig(n, 1)] + ' hundred');
  const r = n % 100;
  if (r){
    let w;
    if (r < 10) w = W1[r]; else if (r < 20) w = WT[r - 10]; else w = W10[Math.floor(r / 10)] + (r % 10 ? '-' + W1[r % 10] : '');
    out.push((out.length ? 'and ' : '') + w);
  }
  return out.join(' ');
}
function parseEn(s){
  const O = {};
  W1.forEach((w, i) => { O[w] = i; }); WT.forEach((w, i) => { O[w] = 10 + i; }); W10.forEach((w, i) => { if (w) O[w] = i * 10; });
  let v = 0, cur = 0;
  for (const w of s.replace(/-/g, ' ').split(/\s+/)){
    if (w === 'and') continue;
    if (w in O) cur += O[w];
    else if (w === 'hundred') cur *= 100;
    else if (w === 'thousand'){ v += cur * 1000; cur = 0; }
    else return NaN;
  }
  return v + cur;
}

/* 算式掃描：把一段文字裡所有「數 op 數 … ＝ 結果」找出來重算；÷ 可以帶「（餘 r）」／「(remainder r)」 */
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/[＋]/g, '+').replace(/[−–－]/g, '-').replace(/\s+/g, ' ');
  const re = /(?<![\d.\/])(?<![×+\-÷] ?)(\d+(?: ?[×+\-÷] ?\d+)+) ?= ?(\d+)(?![\d.\/])(?: ?(?:[（(](?:餘|remainder) ?(\d+)[)）]|(?:餘|remainder) (\d+)))?/g;
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const chain = m[1], got = +m[2], rem = m[3] !== undefined ? +m[3] : m[4] !== undefined ? +m[4] : null;
    const toks = chain.split(/ ?([×+\-÷]) ?/);
    let bad = null;
    if (chain.indexOf('÷') >= 0){
      if (toks.length !== 3) bad = 'a division chained with other operations';
      else {
        const a = +toks[0], b = +toks[2], q = Math.floor(a / b), r = a % b;
        if (got !== q || (rem === null ? r !== 0 : rem !== r)) bad = 'should be ' + q + (r ? ' remainder ' + r : '');
      }
    } else {
      const terms = [];
      let cur = +toks[0], sign = 1;
      for (let i = 1; i < toks.length; i += 2){
        const op = toks[i], v = +toks[i + 1];
        if (op === '×') cur *= v;
        else { terms.push(sign * cur); sign = op === '+' ? 1 : -1; cur = v; }
      }
      terms.push(sign * cur);
      const want = terms.reduce((x, y) => x + y, 0);
      if (rem !== null) bad = 'a remainder after a non-division';
      else if (want !== got) bad = 'should be ' + want;
    }
    out.push({ text:m[0], bad });
    re.lastIndex = m.index + 1;
  }
  return out;
}

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)', find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });", replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'come out already sorted', find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }", replace:"    if (false){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }" },
    { file:'index', expect:'come out already sorted', find:"    var up = a.length > 1;", replace:"    var up = false;" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['build', 'regroup', 'write', 'sort', 'line'];", replace:"var GAME_ORDER = ['build', 'write', 'regroup', 'sort', 'line'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'measure to the box', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot', find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },

    /* 念法、題庫、範例 */
    { file:'index', expect:'number words', find:"          parts.push('一十');", replace:"          parts.push('十');" },
    { file:'index', expect:'number words', find:"      parts.push((parts.length ? 'and ' : '') + w);", replace:"      parts.push(w);" },
    { file:'index', expect:'number words', find:"'thirty', 'forty', 'fifty',", replace:"'thirty', 'fourty', 'fifty'," },
    { file:'index', expect:"qs[0] zh: marked answer", find:"{ stem:'3456 這個數字，百位的數字是多少？', opts:['4','3','5','6'], ans:0,", replace:"{ stem:'3456 這個數字，百位的數字是多少？', opts:['4','3','5','6'], ans:2," },
    { file:'index', expect:'should be 42 remainder 18', find:"why:'4218 ÷ 100 ＝ 42（餘 18）", replace:"why:'4218 ÷ 100 ＝ 42（餘 17）" },
    { file:'index', expect:'「里面」', find:"所以 3456 裡面有 34 個百，不是只看百位數字 4。345", replace:"所以 3456 里面有 34 個百，不是只看百位數字 4。345" },
    { file:'index', expect:'s2line(', find:"' 的千位是 ' + qian + '，代表 ' + qian + ' × 10 ＝ ' + (qian * 10)", replace:"' 的千位是 ' + qian + '，代表 ' + qian + ' × 10 ＝ ' + (qian * 100)" },
    { file:'index', expect:'s5explain(', find:"closest to the round thousand <b>' + nearest + '</b>.'", replace:"closest to the round thousand <b>' + (nearest + 1000) + '</b>.'" },

    /* 第 1 關：蓋大樓 */
    { file:'index', expect:'no floor is 0', find:'var GAME_BUILD = [3052,', replace:'var GAME_BUILD = [3452,' },
    { file:'index', expect:'at most 6 fit', find:'2406, 4130, 1305,', replace:'2406, 4170, 1305,' },
    { file:'index', expect:'build: floors', find:'BUILD_FLOOR = { x:74, w:218, h:50, y0:10, step:58 }', replace:'BUILD_FLOOR = { x:74, w:218, h:50, y0:10, step:48 }' },
    { file:'index', expect:'build: tray', find:'BUILD_SRC = { y:282, step:70, size:56 }', replace:'BUILD_SRC = { y:250, step:70, size:56 }' },
    { file:'index', expect:'build: trays', find:'BUILD_SRC = { y:282, step:70, size:56 }', replace:'BUILD_SRC = { y:282, step:54, size:56 }' },
    { file:'index', expect:'a block tray', find:'BUILD_SRC = { y:282, step:70, size:56 }', replace:'BUILD_SRC = { y:282, step:70, size:44 }' },
    { file:'index', expect:'blocks of floor', find:'var BUILD_BLK = { x0:20, step:26,', replace:'var BUILD_BLK = { x0:20, step:20,' },
    { file:'index', expect:'buildBlockX(', find:'function buildBlockX(k){ return BUILD_BLK.x0 + k * BUILD_BLK.step; }', replace:'function buildBlockX(k){ return BUILD_BLK.x0 + k * BUILD_BLK.step + 2; }' },
    { file:'index', expect:'a block on the wrong floor is accepted', find:'        if (f.p !== b){ roundMiss(d.gBuildWrong(b, f.p)); return false; }', replace:'        if (f.p !== b && b === 0){ roundMiss(d.gBuildWrong(b, f.p)); return false; }' },
    { file:'index', expect:'a floor accepts more blocks', find:'        if (f.n >= f.need){', replace:'        if (f.n > f.need){' },
    { file:'index', expect:'gBuildFull(', find:"' 塊，變成 ' + (n + PLACE_VAL[p]) + '，不是 '", replace:"' 塊，變成 ' + (n + 1) + '，不是 '" },
    { file:'index', expect:'should name the right floor', find:"' block (' + PLACE_VAL[b] + ') — it lives on the ' + I18N.en.gPlace[b] + ' floor, not the ' + I18N.en.gPlace[f] + ' floor.'", replace:"' block (' + PLACE_VAL[b] + ') — it lives on the ' + I18N.en.gPlace[f] + ' floor, not the ' + I18N.en.gPlace[b] + ' floor.'" },
    { file:'index', expect:'gBuildZero(', find:"'是 0：這一層要空著，一塊都不放。'", replace:"'是 1：這一層要空著，一塊都不放。'" },
    { file:'index', expect:'gBuildDone', find:"' make ' + n + '! Every empty floor is written as 0.';", replace:"' make ' + (n + 1) + '! Every empty floor is written as 0.';" },

    /* 第 2 關：拆千 */
    { file:'index', expect:'thousands — should be 1~3', find:'var GAME_BREAK = [2356,', replace:'var GAME_BREAK = [4356,' },
    { file:'index', expect:'equals the hundreds digit', find:'2356, 3108, 2045,', replace:'2356, 3308, 2045,' },
    { file:'index', expect:'at most 8 fit', find:'3270, 1830];', replace:'3270, 1930];' },
    { file:'index', expect:'straight into the box is accepted', find:'        if (!z.ham){ roundMiss(d.gRegDirect); return false; }', replace:'        if (!z){ roundMiss(d.gRegDirect); return false; }' },
    { file:'index', expect:'with a thousand still unbroken', find:'        if (gSolved || left > 0) return;', replace:'        if (gSolved) return;' },
    { file:'index', expect:'should give EMPTY/-', find:"        if (!/^(0|[1-9]\\d*)$/.test(s)){", replace:"        if (!/^\\d+$/.test(s)){" },
    { file:'index', expect:'should give gRegDone/SOLVED/closed', find:'        var s = inp.value.trim();', replace:'        var s = inp.value;' },
    { file:'index', expect:'should give gRegDigit/MISS', find:'        else if (v === bai) roundMiss(d.gRegDigit(bai, q));\n', replace:'' },
    { file:'index', expect:'should give gRegTens/MISS', find:'        else if (v === Math.floor(n / 10)) roundMiss(d.gRegTens(v));', replace:'        else if (v === Math.floor(n / 10)) roundMiss(d.gRegQian(q));' },
    { file:'index', expect:'gRegDone', find:"' 個百：' + n + ' ÷ 100 ＝ ' + h + '（餘 ' + (n % 100) + '）。'", replace:"' 個百：' + n + ' ÷ 100 ＝ ' + h + '（餘 ' + (n % 10) + '）。'" },
    { file:'index', expect:'gRegDigit', find:"' hundreds that were already there — the ' + (q * 10) + ' hundreds from the '", replace:"' hundreds that were already there — the ' + (q * 100) + ' hundreds from the '" },
    { file:'index', expect:'overlaps the hammer or the box', find:'BREAK_HAM = { x:222, y:8, w:70, h:76 }', replace:'BREAK_HAM = { x:180, y:8, w:70, h:76 }' },
    { file:'index', expect:'drawn different sizes', find:'BREAK_LOOSE = { y:220, x0:24, step:18, size:12 }', replace:'BREAK_LOOSE = { y:220, x0:24, step:18, size:15 }' },
    { file:'index', expect:'regroup: bundles', find:'BREAK_BUNDLE = { y:160, x0:52, step:82,', replace:'BREAK_BUNDLE = { y:160, x0:52, step:70,' },
    { file:'index', expect:'bundleSqXY(', find:'y:(B.h - gh) / 2 + Math.floor(s / 5) * (B.sq + B.gap) };', replace:'y:(B.h - gh) / 2 + Math.floor(s / 5) * B.sq };' },
    { file:'index', expect:'is not drawn as 10 hundreds', find:'        for (var s = 0; s < 10; s++){', replace:'        for (var s = 0; s < 9; s++){' },
    { file:'index', expect:'the loose hundreds drawn are not', find:'      for (var i = 0; i < bai; i++) addZone(B, breakLooseX(i)', replace:'      for (var i = 0; i <= bai; i++) addZone(B, breakLooseX(i)' },
    { file:'index', expect:'opens before every thousand', find:'        if (left === 0){ inp.disabled = false; go.disabled = false;', replace:'        if (left <= 1){ inp.disabled = false; go.disabled = false;' },

    /* 第 3 關：寫數字 */
    { file:'index', expect:'no 0 — the round', find:'var GAME_WRITE = [3056,', replace:'var GAME_WRITE = [3456,' },
    { file:'index', expect:'tens digit is 1', find:'2408, 5370, 3005,', replace:'2408, 5310, 3005,' },
    { file:'index', expect:'gChunk(', find:"return CN[placeDigit(n, p)] + ['千', '百', '十', ''][p]; },", replace:"return CN[placeDigit(n, p)] + ['千', '百', '十', '個'][p]; }," },
    { file:'index', expect:'a wrong digit is accepted', find:'        if (v !== bx.c){ roundMiss(', replace:'        if (v !== bx.c && v !== 0){ roundMiss(' },
    { file:'index', expect:'gWriteZero(', find:"' — that box is empty, so it gets a 0.'", replace:"' — that box is empty, so it gets a 0 or 1.'" },
    { file:'index', expect:'the words shown are', find:'      gRead: function(n){ return toEnglishNumber(n); },', replace:'      gRead: function(n){ return toEnglishNumber(n).replace(" and ", " "); },' },
    { file:'index', expect:'boxes with their pad', find:'WRITE_BOX = { y:64, size:56, pad:4, x:[48, 116, 184, 252] }', replace:'WRITE_BOX = { y:64, size:56, pad:4, x:[48, 108, 184, 252] }' },
    { file:'index', expect:'write: digit card', find:'var WRITE_KEYS = { y:174,', replace:'var WRITE_KEYS = { y:100,' },
    { file:'index', expect:'write box with its pad', find:'WRITE_BOX = { y:64, size:56, pad:4,', replace:'WRITE_BOX = { y:64, size:36, pad:4,' },

    /* 第 4 關：排大小 */
    { file:'index', expect:'should start with a bigger digit', find:'var GAME_SORT = [ [987,', replace:'var GAME_SORT = [ [287,' },
    { file:'index', expect:'exactly one 3-digit', find:'[999, 5203, 5230, 4990]', replace:'[1999, 5203, 5230, 4990]' },
    { file:'index', expect:'compare down to the tens', find:'[958, 2580, 2508, 2850]', replace:'[958, 2580, 2408, 2850]' },
    { file:'index', expect:'a card in the wrong slot is accepted', find:'        if (x !== y){ roundMiss(d.gSortWhy(', replace:'        if (x < y){ roundMiss(d.gSortWhy(' },
    { file:'index', expect:'numeric order', find:'sorted = set.slice().sort(function(a, b){ return a - b; }), SS = SORT_SLOT', replace:'sorted = set.slice().sort(), SS = SORT_SLOT' },
    { file:'index', expect:'sortCompare(', find:"return { kind:'digit', len:sx.length, p:4 - sx.length + i,", replace:"return { kind:'digit', len:sx.length, p:i," },
    { file:'index', expect:'points the wrong way', find:"var rel = x < y ? '小' : '大', dir = x < y ? '左' : '右';", replace:"var rel = x < y ? '小' : '大', dir = x < y ? '右' : '左';" },
    { file:'index', expect:'should be named as the same', find:"var same = I18N.en.gPlace.slice(4 - c.len, c.p).join(' and ');", replace:"var same = I18N.en.gPlace.slice(4 - c.len, c.p - 1).join(' and ');" },
    { file:'index', expect:'no room for "<"', find:'x:[39, 113, 187, 261] }', replace:'x:[39, 103, 167, 231] }' },
    { file:'index', expect:'sort: tray card', find:'var SORT_TRAY = { y:188,', replace:'var SORT_TRAY = { y:110,' },

    /* 第 5 關：放數線 */
    { file:'index', expect:'exactly halfway', find:'var GAME_LINE = [ [1800,', replace:'var GAME_LINE = [ [1500,' },
    { file:'index', expect:'exactly on a tick', find:'[1800, 5300, 8900]', replace:'[1800, 5000, 8900]' },
    { file:'index', expect:'3000 apart', find:'[700, 4200, 7600]', replace:'[700, 2200, 7600]' },
    { file:'index', expect:'a card on the wrong thousand is accepted', find:'        if (s.t !== want){ var b = bounds(v);', replace:'        if (Math.abs(s.t - want) > 1000){ var b = bounds(v);' },
    { file:'index', expect:'lineNearest(', find:'function lineNearest(v){ return Math.round(v / 1000) * 1000; }', replace:'function lineNearest(v){ return Math.floor(v / 1000) * 1000; }' },
    { file:'index', expect:'gLineWhy(', find:"'，比較靠近 ' + t + '。'; },", replace:"'，比較靠近 ' + lo + '。'; }," },
    { file:'index', expect:'tick is outside the', find:'LINE = { x0:36, x1:264, y:140 }', replace:'LINE = { x0:36, x1:290, y:140 }' },
    { file:'index', expect:'wider than 3 steps', find:'LINE_CARD = { w:56, h:48 }', replace:'LINE_CARD = { w:70, h:48 }' },
    { file:'index', expect:'covers the axis', find:'LINE_SLOT = { y:94, hh:40, pad:6 }', replace:'LINE_SLOT = { y:110, hh:40, pad:6 }' },
    { file:'index', expect:'one per thousand, a step wide', find:'hw:pitch / 2, hh:LS.hh, done:false });', replace:'hw:pitch / 3, hh:LS.hh, done:false });' },
    { file:'index', expect:'the exact position is not marked', find:"addZone(B, lineX(v) - 6, LINE.y - 6, 12, 12, 'gmark');", replace:"addZone(B, lineX(want) - 6, LINE.y - 6, 12, 12, 'gmark');" },

    /* ---- review.html：產生器 ---- */
    { file:'review', expect:'copied straight out of the stem', find:'    (avoid || []).forEach(function(a){ seen[String(a)] = true; });\n', replace:'' },
    { file:'review', expect:'is not longer than width', find:'        var l = Math.max(s1, s2), w = Math.min(s1, s2);', replace:'        var l = s1, w = s2;' },
    { file:'review', expect:'no single closest round thousand', find:'pickUnused([800,1800,2600,', replace:'pickUnused([4500,1800,2600,' },
    { file:'review', expect:'are not how', find:'        return { n:n, words: toChineseNumber(n), opts:m.opts, ans:m.ans };', replace:'        return { n:n, words: toChineseNumber(n).replace("零", ""), opts:m.opts, ans:m.ans };' },
    { file:'review', expect:'numeralRule', find:'var s = String(n), mid = /0+[1-9]/.test(s.slice(1)),', replace:'var s = String(n), mid = /0/.test(s.slice(1)),' },
    { file:'review', expect:'opts[ans] != correct', find:'        var correct = Math.floor(n / 100);\n        var m = mixOptsInt(correct, [digitsOf(n).bai,', replace:'        var correct = Math.floor(n / 10);\n        var m = mixOptsInt(correct, [digitsOf(n).bai,' },
    { file:'review', expect:'digits must be 4 different', find:'          if (new Set(digits).size === 4) break;', replace:'          break;' },
    { file:'review', expect:'outside 100~9999', find:"x !== null && x.length >= 3 && x.length <= 4 && x !== str; }).map(Number);", replace:"x !== null && x.length >= 3 && x.length <= 5 && x !== str; }).map(Number);" },
    { file:'review', expect:'d.correct is', find:"        return { x:x, correct:correct, opts:m.opts, ans:m.ans };", replace:"        return { x:x, correct:correct + 100, opts:m.opts, ans:m.ans };" },
    { file:'review', expect:'the why should read', find:"            ? d.x + ' × 100 ＝ ' + d.correct + '。'", replace:"            ? d.x + ' × 10 ＝ ' + d.correct + '。'" },
    { file:'review', expect:'the why should read', find:"            ? d.dividend + ' ÷ ' + d.divisor + ' ＝ ' + d.quotient + ' 餘 ' + d.remainder +", replace:"            ? d.dividend + ' ÷ ' + d.divisor + ' ＝ ' + d.quotient + ' 餘 ' + d.remainder + '，' + d.dividend + ' ÷ ' + d.divisor + ' ＝ ' + (d.quotient + 1) +" },
    { file:'index', expect:'does not say the total', find:"一共 ' + h + ' 個百：' + n + ' ÷ 100", replace:"一共 ' + h + ' 個十：' + n + ' ÷ 100" },
    { file:'index', expect:'is closer to', find:"' — closer to ' + t + '.'; },", replace:"' — closer to ' + lo + '.'; }," },
    { file:'index', expect:'narrower than the documented 22', find:'LINE = { x0:36, x1:264, y:140 }', replace:'LINE = { x0:36, x1:250, y:140 }' },
    { file:'review', expect:'does not point at', find:"pic: { kind:'line', v:d.v },", replace:"pic: { kind:'line', v:d.correct }," }
  ],

  sim: {
    INVARIANTS: {
      digitAtPlace: d => {
        if (d.digits[0] < 1 || new Set(d.digits).size !== 4) return 'digits must be 4 different with a non-zero thousands';
        if (d.n !== d.digits[0] * 1000 + d.digits[1] * 100 + d.digits[2] * 10 + d.digits[3]) return 'n is not made of its digits';
        if (d.opts.slice().sort().join() !== d.digits.slice().sort().join()) return 'options are not exactly the four digits of n';
      },
      howManyHundreds: d => { if (!(d.n >= 1000 && d.n <= 9999)) return 'n not 4-digit'; if (d.correct !== Math.floor(d.n / 100)) return 'correct != n div 100'; },
      howManyTens: d => { if (!(d.n >= 1000 && d.n <= 9999)) return 'n not 4-digit'; if (d.correct !== Math.floor(d.n / 10)) return 'correct != n div 10'; },
      composeParts: d => { if (!(d.qian >= 1 && d.qian <= 9) || [d.bai, d.shi, d.ge].some(x => !(isInt(x) && x >= 0 && x <= 9))) return 'parts out of 0~9'; },
      chineseToNumeral: d => { if (d.words !== myZh(d.n)) return 'words "' + d.words + '" are not how ' + d.n + ' is read (' + myZh(d.n) + ')'; },
      numeralToChinese: d => {
        for (const o of d.opts){ const v = parseZh(o); if (!(isInt(v) && v >= 1)) return 'option "' + o + '" is not a Chinese number'; if (o !== myZh(v)) return 'option "' + o + '" is not a well-formed reading of ' + v; }
      },
      compareTwo: d => { if (new Set(d.nums).size !== 4) return 'numbers not all different: ' + d.nums.join(); },
      numberLinePosition: d => { if (d.v % 1000 === 500 || d.v % 1000 === 0) return d.v + ' has no single closest round thousand / is on a tick'; },
      bundleConvert: d => { if (!(d.x >= 10 && d.x <= 99)) return 'x not 10~99'; },
      multiplyCol: d => { if (!(d.a >= 10 && d.a <= 99 && d.d >= 2 && d.d <= 9)) return 'factors out of range'; },
      divideRem: d => {
        if (d.dividend !== d.quotient * d.divisor + d.remainder) return 'dividend != q*k + r';
        if (!(d.remainder >= 1 && d.remainder < d.divisor)) return 'remainder not 1..k-1';
      },
      perimeterCalc: d => { if (!(d.l > d.w)) return 'length ' + d.l + ' is not longer than width ' + d.w; }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'digitAtPlace': return String(dig(d.n, d.placeIdx));
        case 'howManyHundreds': return String(Math.floor(d.n / 100));
        case 'howManyTens': return String(Math.floor(d.n / 10));
        case 'composeParts': return String(d.qian * 1000 + d.bai * 100 + d.shi * 10 + d.ge);
        case 'chineseToNumeral': return String(parseZh(d.words));
        case 'numeralToChinese': return myZh(d.n);
        case 'compareTwo': return String(Math.max.apply(null, d.nums));
        case 'numberLinePosition': return String(Math.round(d.v / 1000) * 1000);
        case 'bundleConvert': return String(d.x * 100);
        case 'multiplyCol': return String(d.a * d.d);
        case 'divideRem': return String(d.dividend % d.divisor);
        case 'perimeterCalc': return String(2 * (d.l + d.w));
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang, isCorrect){
      if (genId === 'numeralToChinese'){ const v = parseZh(s); if (!(v >= 100 && v <= 9999)) return 'option "' + s + '" is not a Chinese number from 100 to 9999'; return; }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const n = +s;
      const R = {
        /* 正解與誘答分開：正解的範圍從題型本身推（四位數的百數是 10～99、十數是 100～999）；
           誘答可以是刻意的迷思值 —— 百位數字 0（5008 的「0 個百」）、商當成餘數（最大 12）、少一個或多一個 0 的念法（306、30006） */
        digitAtPlace:[0, 9], howManyHundreds: isCorrect ? [10, 99] : [0, 999], howManyTens: isCorrect ? [100, 999] : [0, 9999],
        composeParts: isCorrect ? [1000, 9999] : [100, 9999],   /* 1 個千、0、0、0 → 保底 ±1 會是 999 */ chineseToNumeral: isCorrect ? [1000, 9999] : [100, 9999], compareTwo:[100, 9999],
        numberLinePosition:[0, 10000], bundleConvert: isCorrect ? [1000, 9900] : [100, 10000], multiplyCol:[1, 999],
        divideRem: isCorrect ? [1, 8] : [0, 12], perimeterCalc:[1, 9999]
      }[genId];
      if (!R) return 'no range for ' + genId;
      if (n < R[0] || n > R[1]) return 'option ' + n + ' outside ' + R[0] + '~' + R[1];
      if (genId === 'numberLinePosition' && n % 1000) return 'option ' + n + ' is not a round thousand';
    },
    renderCheck: function(d, q, lang, genId){
      /* 解釋裡的數字：照順序逐個比（用原始參數自己算），句子裡的算式逐條重算；d.correct 也要等於自己算的正解
         （解釋印的是 d.correct，選項印的是 opts —— 兩個都要對） */
      if ('correct' in d && String(d.correct) !== module.exports.sim.expectedCorrect(d, genId, lang)) return 'd.correct is ' + d.correct + ' — the explanation would print a wrong answer';
      const why = String(q.why).replace(/<[^>]+>/g, '');
      const c = module.exports.sim.expectedCorrect(d, genId, lang);
      const W = {
        digitAtPlace: () => [d.n].concat(d.digits, [dig(d.n, d.placeIdx)]),
        howManyHundreds: () => [d.n, 100, +c, d.n % 100, +c], howManyTens: () => [d.n, 10, +c, d.n % 10, +c],
        composeParts: () => [d.qian, d.bai, d.shi, d.ge, +c], chineseToNumeral: () => [d.n, 0],
        numeralToChinese: () => (d.n % 10 === 0 ? [d.n, 0] : [d.n]), compareTwo: () => [+c], numberLinePosition: () => [d.v, +c],
        bundleConvert: () => [d.x, 100, +c], multiplyCol: () => [d.a, d.d, +c],
        divideRem: () => [d.dividend, d.divisor, Math.floor(d.dividend / d.divisor), +c, d.divisor], perimeterCalc: () => [2, d.l, d.w, 2, +c]
      }[genId];
      if (!W) return 'no explanation check for ' + genId;
      if (nums(why).join() !== W().join()) return 'the why should read ' + W().join() + ', got ' + nums(why).join() + ': ' + why;
      if (genId !== 'perimeterCalc'){ const bad = scanEquations(why).filter(e => e.bad); if (bad.length) return 'the why says "' + bad[0].text + '" — ' + bad[0].bad; }
      else if (2 * (d.l + d.w) !== +c) return 'perimeter';
      /* 念法題的解釋只說這個數用得到的規則：中間有空的樓層（後面還有數字）才說「只念一次零」，末尾是 0 才說「末尾不念」 */
      if (genId === 'numeralToChinese'){
        const ds = [0, 1, 2, 3].map(p => dig(d.n, p));
        const mid = [1, 2].some(i => ds[i] === 0 && ds.slice(i + 1).some(x => x > 0)), tail = ds[3] === 0;
        const saysMid = lang === 'zh' ? q.why.indexOf('只念一次「零」') >= 0 : q.why.indexOf('one "zero"') >= 0;
        const saysTail = lang === 'zh' ? q.why.indexOf('末尾的 0 不念') >= 0 : q.why.indexOf('0 at the end is not read') >= 0;
        if (saysMid !== mid) return 'numeralRule: the why ' + (mid ? 'misses' : 'states') + ' the middle-zero rule for ' + d.n + ': ' + q.why;
        if (saysTail !== tail) return 'numeralRule: the why ' + (tail ? 'misses' : 'states') + ' the trailing-zero rule for ' + d.n + ': ' + q.why;
      }
      if (genId === 'numberLinePosition'){ if (!q.pic || q.pic.kind !== 'line' || q.pic.v !== d.v) return 'the number line does not point at ' + d.v; }
      else if (genId === 'perimeterCalc'){ if (!q.pic || q.pic.kind !== 'rect' || q.pic.l !== d.l || q.pic.w !== d.w) return 'the rectangle is not ' + d.l + ' by ' + d.w; }
      else if (q.pic) return 'unexpected picture';
    }
  },

  data: {
    dataStart: '  /* ===================== 共用數學引擎 ===================== */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{toChineseNumber, toEnglishNumber, GPICK, PLACE_VAL, placeDigit, BUILD_H, BUILD_FLOOR, BUILD_LBL, BUILD_BLK, BUILD_SRC, BUILD_ICON, GAME_BUILD, buildFloorTop, buildSrcX, buildBlockX, BREAK_H, BREAK_TH, BREAK_HAM, BREAK_BOX, BREAK_BOXLBL, BREAK_BUNDLE, BREAK_LOOSE, BREAK_REST, GAME_BREAK, breakThX, breakBundleX, bundleSqXY, breakLooseX, WRITE_H, WRITE_BOX, WRITE_LBL, WRITE_KEYS, GAME_WRITE, SORT_H, SORT_SLOT, SORT_LBL, SORT_TRAY, SORT_CARD, GAME_SORT, sortCompare, LINE_H, LINE, LINE_SLOT, LINE_CARD, LINE_TRAY, LINE_LBL, GAME_LINE, lineX, lineNearest}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;
      const near = (a, b) => Math.abs(a - b) < 1e-6;

      /* --- 0. 自己的工具先證明會響（positive / negative control） --- */
      [['4218 ÷ 100 ＝ 42（餘 18）', true], ['4218 ÷ 100 ＝ 42（餘 17）', false], ['4218 ÷ 100 = 42 (remainder 18)', true], ['3456 ÷ 100 ＝ 35（餘 56）', false],
       ['2 × 10 ＝ 20', true], ['17 ÷ 5 ＝ 3 餘 2', true], ['17 ÷ 5 ＝ 3 餘 1', false], ['17 ÷ 5 = 3 remainder 2', true], ['17 ÷ 5 = 3 remainder 4', false], ['2 × 10 ＝ 21', false], ['4－1＝3', true], ['4－1＝2', false], ['3 + 4 = 7', true]].forEach(([t, good]) => {
        const r = scanEquations(t);
        if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
      });
      [[3056, '三千零五十六'], [3006, '三千零六'], [2070, '二千零七十'], [3400, '三千四百'], [4010, '四千零一十'], [10, '十'], [115, '一百一十五'], [9999, '九千九百九十九']].forEach(([n, w]) => {
        if (myZh(n) !== w || parseZh(w) !== n) fail('myZh()/parseZh() self-test: ' + n + ' ↔ ' + w + ' (got ' + myZh(n) + ' / ' + parseZh(w) + ')');
      });
      [[3056, 'three thousand and fifty-six'], [3005, 'three thousand and five'], [2408, 'two thousand four hundred and eight'], [5370, 'five thousand three hundred and seventy'], [1015, 'one thousand and fifteen'], [700, 'seven hundred']].forEach(([n, w]) => {
        if (myEn(n) !== w || parseEn(w) !== n) fail('myEn()/parseEn() self-test: ' + n + ' ↔ ' + w + ' (got ' + myEn(n) + ' / ' + parseEn(w) + ')');
      });

      /* --- 1. 課程的念法函式：1～9999 每一個數都和自己的念法一樣，而且讀得回來 --- */
      {
        let badZh = 0, badEn = 0, first = '';
        for (let n = 1; n <= 9999; n++){
          const z = D.toChineseNumber(n), e = D.toEnglishNumber(n);
          if (z !== myZh(n) || parseZh(z) !== n){ badZh++; if (!first) first = n + ' → ' + z + ' (want ' + myZh(n) + ')'; }
          if (e !== myEn(n) || parseEn(e) !== n){ badEn++; if (!first) first = n + ' → ' + e + ' (want ' + myEn(n) + ')'; }
        }
        if (badZh || badEn) fail('number words: ' + badZh + ' Chinese and ' + badEn + ' English readings in 1~9999 are wrong, e.g. ' + first);
      }

      /* --- 2. 三層題庫：正解用自己的算法重算（不是讀 ans） --- */
      {
        const placeZh = ['千位', '百位', '十位', '個位'], placeEn = ['thousands', 'hundreds', 'tens', 'ones'];
        const firstDiff = (a, b) => { const x = String(a), y = String(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return i; return -1; };
        const want = {
          qs: [L => String(dig(3456, 1)), L => String(2 * 1000 + 7 * 100 + 0 * 10 + 9),
               (L, q) => q.opts.filter(o => dig(+o, 2) === 0)[0], L => String(parseZh('三千零五')),
               (L, q) => String(Math.max.apply(null, q.opts.map(Number))), L => (L === 'zh' ? placeZh : placeEn)[firstDiff(5623, 5698)]],
          qsAdv: [L => String(3 * 1000 + 5 * 100 + 0 * 10 + 8), L => String(4 * 1000 + (4 - 1) * 100 + 0 * 10 + 6), L => String(Math.floor(4218 / 100)),
                  L => (2000 > 987 ? (L === 'zh' ? '小安' : 'Ann') : '?')],
          qsBoost: [L => String(parseZh('三千零六')), L => String(Math.floor(3456 / 100))]
        };
        LANGS.forEach(L => Object.keys(want).forEach(bank => {
          const list = I18N[L][bank] || [];
          if (list.length !== want[bank].length) fail(bank + ' ' + L + ': ' + list.length + ' questions, the config recomputes ' + want[bank].length + ' — add the new ones here');
          list.forEach((q, i) => {
            if (!want[bank][i]) return;
            const w = want[bank][i](L, q);
            if (q.opts[q.ans] !== w) fail(bank + '[' + i + '] ' + L + ': marked answer "' + q.opts[q.ans] + '", recomputed "' + w + '"');
            if (q.opts.filter(o => o === w).length !== 1) fail(bank + '[' + i + '] ' + L + ': the recomputed answer "' + w + '" is not exactly one option');
          });
        }));
        /* qs[2]：只有一個選項的十位是 0；qs[4]：最大的那個真的是唯一的四位數 */
        LANGS.forEach(L => {
          const q2 = I18N[L].qs[2], q4 = I18N[L].qs[4];
          if (q2.opts.filter(o => dig(+o, 2) === 0).length !== 1) fail('qs[2] ' + L + ': not exactly one option has a 0 in the tens');
          if (q4.opts.filter(o => o.length === 4).length !== 1) fail('qs[4] ' + L + ': the why says the answer is the only 4-digit option');
        });
      }

      /* --- 3. 每一條 I18N 靜態字串裡的算式逐條重算，範例的旁白拿範例的數字去呼叫 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        if (/里面/.test(s)) fail(where + ': 「里面」 should be 「裡面」 (Traditional Chinese)');
        scanEquations(s).forEach(e => { checkedEq++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
      }));
      /* 釘住數量：qsAdv[1] 的 4－1＝3、qsAdv[2] 的 4218 ÷ 100、qsBoost[1] 的 3456 ÷ 100，兩種語言各一條。
         讀不到（正規化壞掉）會變少；新加了算式就要來這裡改數字 —— 兩種都要有人看到。 */
      if (checkedEq !== 6) fail(checkedEq + ' equations found in the I18N strings, expected 6 — the arithmetic scan is not reading them, or a new one needs counting');
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        scanEquations(text).forEach(e => { if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
      };
      {
        const arr = name => { const m = src.match(new RegExp('var ' + name + ' = \\[([^\\]]*)\\]')); return m ? m[1].split(',').map(Number) : null; };
        const S2 = arr('S2_NUMS'), S5 = arr('S5_NUMS');
        if (!S2 || !S5) fail('cannot read S2_NUMS / S5_NUMS from index.html');
        else LANGS.forEach(L => {
          S2.forEach(n => { const q = dig(n, 0), b = dig(n, 1); seq('s2line(' + n + ') ' + L, I18N[L].s2line(n, Math.floor(n / 100), n % 100, q, b), L === 'zh' ? [n, q, q, 10, q * 10, b, Math.floor(n / 100), n % 100, n, Math.floor(n / 100), b] : [n, q, q, 10, q * 10, b, Math.floor(n / 100), n % 100, n, Math.floor(n / 100), b]); });
          S5.forEach(v => { if (v % 1000 === 500) fail('S5_NUMS: ' + v + ' is exactly halfway'); seq('s5explain(' + v + ') ' + L, I18N[L].s5explain(v, Math.round(v / 1000) * 1000), [v, Math.round(v / 1000) * 1000]); });
        });
      }

      /* --- 4. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      /* 托盤一開始不可以已經由小到大（排大小那一關就白排了）：shuffle() 切出來跑。
         ① 決定性：Math.random 一律給 0.9999（Fisher–Yates 每一步都不換 → 正好是由小到大）—— 一定要改掉，而且不可以卡住；
         ② 每一組 GAME_SORT／GAME_LINE 各洗 2000 次，一次都不可以由小到大，而且每一個位置都要出現過兩種以上的數 */
      {
        const fsrc = extractFunction(src, 'shuffle');
        const up = a => a.every((v, k) => k === 0 || a[k - 1] < v);
        if (!fsrc) fail('cannot find shuffle() in index.html');
        else {
          let calls = 0;
          const fake = { random:() => { if (++calls > 100) throw new Error('shuffle() keeps asking for random numbers — it may never return'); return 0.9999; }, floor:Math.floor };
          let sh = null;
          try { sh = new Function('Math', fsrc + '\nreturn shuffle;')(fake); } catch (e){ fail('shuffle() could not be evaluated: ' + e.message); }
          if (sh){
            let first = [987, 3456, 3465, 3546];
            try { first = sh(first); } catch (e){ fail(e.message); }
            if (first.slice().sort((a, b) => a - b).join() !== '987,3456,3465,3546') fail('shuffle() is not a permutation: ' + first.join());
            if (up(first)) fail('shuffle(): the tray can come out already sorted from smallest to biggest — the sort round would be done before it starts');
            const real = new Function(fsrc + '\nreturn shuffle;')();
            D.GAME_SORT.concat(D.GAME_LINE).forEach(set => {
              const sorted = set.slice().sort((a, b) => a - b), seen = set.map(() => new Set());
              for (let k = 0; k < 2000; k++){
                const o = real(sorted);
                if (up(o)){ fail('shuffle(): ' + set.join('/') + ' came out already sorted'); break; }
                o.forEach((v, pos) => seen[pos].add(v));
              }
              if (seen.some(x => x.size < 2)) fail('shuffle(): a tray position always holds the same card for ' + set.join('/'));
            });
          }
        }
      }
      const TYPES = ['build', 'regroup', 'write', 'sort', 'line'];
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
      const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const noneHit = (a, list, what) => list.forEach((b, i) => { if (hit(a, b)) fail(what + ' overlaps #' + i); });
      ['GAME_BUILD', 'GAME_BREAK', 'GAME_WRITE', 'GAME_SORT', 'GAME_LINE'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });
      for (let n = 0; n < 10000; n += 37) for (let p = 0; p < 4; p++) if (D.placeDigit(n, p) !== dig(n, p)) { fail('placeDigit(' + n + ', ' + p + ') should be ' + dig(n, p)); break; }
      if (D.PLACE_VAL.join() !== VAL.join()) fail('PLACE_VAL should be 1000,100,10,1 (thousands floor on top)');

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡） */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      [['a block tray', D.BUILD_SRC.size], ['a thousand', D.BREAK_TH.size], ['a digit card', D.WRITE_KEYS.size], ['a sort card (w)', D.SORT_CARD.w], ['a sort card (h)', D.SORT_CARD.h],
       ['a number-line card (w)', D.LINE_CARD.w], ['a number-line card (h)', D.LINE_CARD.h]].forEach(([w, s]) => { tooSmall(w + ' (' + s + ')', s); if (s < D.GPICK) fail(w + ' of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      tooSmall('a write box with its pad', D.WRITE_BOX.size + 2 * D.WRITE_BOX.pad);
      tooSmall('a sort slot with its pad (h)', D.SORT_SLOT.h + 2 * D.SORT_SLOT.pad);
      need('build', /addPiece\(B, \{ w:BUILD_SRC\.size, h:BUILD_SRC\.size, cx:buildSrcX\(p\), cy:BUILD_SRC\.y,/, 'the block trays are not BUILD_SRC.size at buildSrcX()');
      need('regroup', /addPiece\(B, \{ w:BREAK_TH\.size, h:BREAK_TH\.size, cx:breakThX\(t\), cy:BREAK_TH\.y,/, 'the thousands are not BREAK_TH.size at breakThX()');
      need('write', /addPiece\(B, \{ w:WRITE_KEYS\.size, h:WRITE_KEYS\.size,/, 'the digit cards are not WRITE_KEYS.size');
      need('sort', /addPiece\(B, \{ w:SORT_CARD\.w, h:SORT_CARD\.h, cx:cx, cy:cy,/, 'the cards are not SORT_CARD');
      need('line', /addPiece\(B, \{ w:LC\.w, h:LC\.h, cx:cx, cy:cy,/, 'the cards are not LINE_CARD');
      need('build', /makeBoard\(300, BUILD_H\)/, 'board is not 300 × BUILD_H');
      need('regroup', /makeBoard\(300, BREAK_H\)/, 'board is not 300 × BREAK_H');
      need('write', /makeBoard\(300, WRITE_H\)/, 'board is not 300 × WRITE_H');
      need('sort', /makeBoard\(300, SORT_H\)/, 'board is not 300 × SORT_H');
      need('line', /makeBoard\(300, LINE_H\)/, 'board is not 300 × LINE_H');

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
        ['gPlace', 'gPlaceLbl', 'gBlk'].forEach(k => { if (!Array.isArray(I18N[L][k]) || I18N[L][k].length !== 4) fail(k + ' ' + L + ' should list the four places'); });
      });
      if (I18N.zh.gPlace.join() !== '千位,百位,十位,個位' || I18N.en.gPlace.join() !== 'thousands,hundreds,tens,ones') fail('gPlace is not thousands, hundreds, tens, ones in that order');

      /* --- nearestOpen()：從原始碼切出來真的跑 --- */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }
      const runNearest = (list, pt, pad) => nearestOpen ? nearestOpen(list, pt, pad) : null;

      /* ================= 第 1 關：蓋大樓（範例 1） ================= */
      {
        const FL = D.BUILD_FLOOR, BK = D.BUILD_BLK, SR = D.BUILD_SRC, H = D.BUILD_H;
        const floors = [0, 1, 2, 3].map(p => {
          const top = FL.y0 + p * FL.step;
          if (!near(D.buildFloorTop(p), top)) fail('buildFloorTop(' + p + ') should be ' + top);
          return { x:FL.x, y:top, w:FL.w, h:FL.h };
        });
        floors.forEach((f, p) => inside(f, 'build: floor ' + p, H));
        noHits(floors, 'build: floors');
        const lbls = floors.map(f => ({ x:D.BUILD_LBL.x, y:f.y, w:D.BUILD_LBL.w, h:f.h }));
        lbls.forEach((l, p) => { inside(l, 'build: label ' + p, H); noneHit(l, floors, 'build: label ' + p); });
        const srcs = [0, 1, 2, 3].map(p => {
          const cx = 150 + (p - 1.5) * SR.step;
          if (!near(D.buildSrcX(p), cx)) fail('buildSrcX(' + p + ') should be ' + cx);
          return sq(cx, SR.y, SR.size);
        });
        srcs.forEach((s, p) => { inside(s, 'build: tray ' + p, H); noneHit(s, floors, 'build: tray ' + p); });
        noHits(srcs, 'build: trays');
        [0, 1, 2, 3].forEach(p => { if (D.BUILD_ICON.h[p] + 18 > SR.size - 6 || D.BUILD_ICON.w[p] > SR.size - 10) fail('build: the icon of tray ' + p + ' and its caption do not fit in ' + SR.size); });
        /* 一層最多 6 塊：每一塊在那一層裡面、不碰到右邊的數字、彼此不碰 */
        const MAXB = 6;
        for (let p = 0; p < 4; p++){
          const bl = [];
          for (let k = 0; k < MAXB; k++){
            const cx = BK.x0 + k * BK.step;
            if (!near(D.buildBlockX(k), cx)) { fail('buildBlockX(' + k + ') should be ' + cx); break; }
            bl.push(sq(cx, FL.h / 2, BK.w[p] + 4, BK.h[p] + 4));
          }
          bl.forEach((b, k) => { if (b.x < 3 || b.x + b.w > FL.w - 40 || b.y < 3 || b.y + b.h > FL.h - 3) fail('build: block ' + k + ' of floor ' + p + ' sticks out of the floor or into its count'); });
          noHits(bl, 'build: blocks of floor ' + p);
        }
        need('build', /var n = pick\(GAME_BUILD\)/, 'the target is not drawn from GAME_BUILD');
        need('build', /need:placeDigit\(n, p\)/, 'a floor does not need exactly its digit');
        need('build', /if \(f\.p !== b\)\{ roundMiss\(d\.gBuildWrong\(b, f\.p\)\); return false; \}/, 'a block on the wrong floor is accepted');
        need('build', /if \(f\.n >= f\.need\)\{ roundMiss\(f\.need === 0 \? d\.gBuildZero\(n, f\.p\) : d\.gBuildFull\(n, f\.p, f\.need\)\); return false; \}/, 'a floor accepts more blocks than its digit');
        need('build', /if \(!nextFloor\(\)\)\{/, 'the round does not end exactly when every floor matches');
        need('build', /var f = nearestOpen\(floors, pt, 6\);\s*if \(!f\) return false;/, 'a drop away from every floor is not a silent bounce');
        D.GAME_BUILD.forEach((n, i) => {
          const w = 'GAME_BUILD[' + i + '] ' + n, ds = [0, 1, 2, 3].map(p => dig(n, p));
          if (!(isInt(n) && n >= 1000 && n <= 9999)) return fail(w + ' is not a 4-digit number');
          if (ds.indexOf(0) < 0) fail(w + ': no floor is 0 — the round never shows that an empty floor is written 0');
          if (Math.max.apply(null, ds) > MAXB) fail(w + ': a floor needs ' + Math.max.apply(null, ds) + ' blocks — at most ' + MAXB + ' fit');
          /* 照遊戲的規則把它蓋完：一塊只收進同一種的那一層、不能超過那一位 —— 蓋完一定是 n，而且每一層都放到 */
          const cnt = [0, 0, 0, 0];
          let guard = 0;
          for (let p = 0; p < 4; p++) while (cnt[p] < ds[p] && guard++ < 100) cnt[p]++;
          if (cnt[0] * 1000 + cnt[1] * 100 + cnt[2] * 10 + cnt[3] !== n) fail(w + ': building by the rules does not give ' + n);
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gBuildNow ' + L, d.gBuildNow(n, 0), [n, 0]);
            seq(w + ' gBuildDone ' + L, d.gBuildDone(n, ds), ds.concat([n, 0]));
            for (let p = 0; p < 4; p++){
              if (ds[p] === 0){
                const z = d.gBuildZero(n, p);
                seq(w + ' gBuildZero(' + p + ') ' + L, z, [n, 0]);
                if (z.indexOf(d.gPlace[p]) < 0) fail(w + ' gBuildZero ' + L + ' does not name the ' + d.gPlace[p] + ': ' + z);
              } else {
                const t = d.gBuildFull(n, p, ds[p]), more = n + VAL[p];
                if (dig(more, p) !== ds[p] + 1 || Math.floor(more / 10000)) fail(w + ': one more on floor ' + p + ' carries — the "would be" number is not just that digit + 1');
                seq(w + ' gBuildFull(' + p + ') ' + L, t, [n, ds[p], ds[p], ds[p] + 1, more, n]);
                if (t.indexOf(d.gPlace[p]) < 0) fail(w + ' gBuildFull ' + L + ' does not name the ' + d.gPlace[p] + ': ' + t);
                seq(w + ' gBuild2(' + p + ') ' + L, d.gBuild2(p, ds[p], 0), [ds[p], 0]);
              }
            }
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let b = 0; b < 4; b++) for (let f = 0; f < 4; f++){
            if (b === f) continue;
            const t = d.gBuildWrong(b, f);
            seq('gBuildWrong(' + b + ', ' + f + ') ' + L, t, [VAL[b]]);
            if (t.indexOf(d.gPlace[b]) < 0 || t.indexOf(d.gPlace[f]) < 0 || t.indexOf(d.gPlace[b]) > t.indexOf(d.gPlace[f])) fail('gBuildWrong ' + L + ' should name the right floor (' + d.gPlace[b] + ') and then the wrong one (' + d.gPlace[f] + '): ' + t);
          }
        });
      }

      /* ================= 第 2 關：拆千（範例 2） ================= */
      {
        const TH = D.BREAK_TH, HM = D.BREAK_HAM, BX = D.BREAK_BOX, BU = D.BREAK_BUNDLE, LO = D.BREAK_LOOSE, H = D.BREAK_H;
        const ham = { x:HM.x, y:HM.y, w:HM.w, h:HM.h }, box = { x:BX.x, y:BX.y, w:BX.w, h:BX.h };
        inside(ham, 'regroup: the hammer', H); inside(box, 'regroup: the hundreds box', H);
        if (hit(ham, box)) fail('regroup: the hammer overlaps the hundreds box');
        const rest = { x:0, y:D.BREAK_REST.y, w:W, h:D.BREAK_REST.h };
        inside(rest, 'regroup: the tens-and-ones line', H); if (hit(rest, box)) fail('regroup: the tens-and-ones line overlaps the box');
        const boxLbl = { x:BX.x, y:D.BREAK_BOXLBL.y, w:BX.w, h:D.BREAK_BOXLBL.h };
        const ths = [0, 1, 2].map(t => { const cx = TH.x0 + t * TH.step; if (!near(D.breakThX(t), cx)) fail('breakThX(' + t + ') should be ' + cx); return sq(cx, TH.y, TH.size); });
        ths.forEach((r, t) => { inside(r, 'regroup: thousand ' + t, H); if (hit(r, ham) || hit(r, box)) fail('regroup: thousand ' + t + ' overlaps the hammer or the box'); });
        noHits(ths, 'regroup: thousands');
        const bundles = [0, 1, 2].map(j => { const cx = BU.x0 + j * BU.step; if (!near(D.breakBundleX(j), cx)) fail('breakBundleX(' + j + ') should be ' + cx); return sq(cx, BU.y, BU.w, BU.h); });
        bundles.forEach((r, j) => { if (r.x < box.x + 3 || r.x + r.w > box.x + box.w - 3 || r.y < boxLbl.y + boxLbl.h || r.y + r.h > box.y + box.h - 3) fail('regroup: bundle ' + j + ' is not inside the box below its label'); });
        noHits(bundles, 'regroup: bundles');
        /* 一捆 10 個百：五個一排、兩排，都在那一捆裡面、彼此不碰 */
        const gw = 5 * BU.sq + 4 * BU.gap, gh = 2 * BU.sq + BU.gap, sqs = [];
        for (let s = 0; s < 10; s++){
          const my = { x:(BU.w - gw) / 2 + (s % 5) * (BU.sq + BU.gap), y:(BU.h - gh) / 2 + Math.floor(s / 5) * (BU.sq + BU.gap) }, got = D.bundleSqXY(s);
          if (!near(got.x, my.x) || !near(got.y, my.y)) fail('bundleSqXY(' + s + ') is ' + JSON.stringify(got) + ', should be ' + JSON.stringify(my));
          sqs.push({ x:my.x, y:my.y, w:BU.sq, h:BU.sq });
        }
        sqs.forEach((r, s) => { if (r.x < 2 || r.y < 2 || r.x + r.w > BU.w - 2 || r.y + r.h > BU.h - 2) fail('regroup: square ' + s + ' sticks out of its bundle'); });
        noHits(sqs, 'regroup: squares of a bundle');
        const loose = [];
        for (let i = 0; i < 8; i++){ const cx = LO.x0 + i * LO.step; if (!near(D.breakLooseX(i), cx)) fail('breakLooseX(' + i + ') should be ' + cx); loose.push(sq(cx, LO.y, LO.size)); }
        loose.forEach((r, i) => { if (r.x < box.x + 3 || r.x + r.w > box.x + box.w - 3 || r.y + r.h > box.y + box.h - 3) fail('regroup: loose hundred ' + i + ' is outside the box'); noneHit(r, bundles, 'regroup: loose hundred ' + i); });
        if (LO.step < LO.size + 2) fail('regroup: loose hundreds ' + LO.step + ' apart touch');
        if (LO.size !== BU.sq) fail('regroup: a loose hundred (' + LO.size + ') and a hundred in a bundle (' + BU.sq + ') are drawn different sizes — they are the same thing');
        need('regroup', /var n = pick\(GAME_BREAK\), q = placeDigit\(n, 0\), bai = placeDigit\(n, 1\), h = Math\.floor\(n \/ 100\), left = q,/, 'the round is not n ÷ 100 with q thousands to break');
        need('regroup', /if \(!z\.ham\)\{ roundMiss\(d\.gRegDirect\); return false; \}/, 'a thousand dropped straight into the box is accepted');
        need('regroup', /for \(var s = 0; s < 10; s\+\+\)/, 'a broken thousand is not drawn as 10 hundreds');
        need('regroup', /for \(var i = 0; i < bai; i\+\+\) addZone\(B, breakLooseX\(i\)/, 'the loose hundreds drawn are not the hundreds digit');
        need('regroup', /if \(left === 0\)\{ inp\.disabled = false; go\.disabled = false;/, 'the answer box opens before every thousand is broken');
        need('regroup', /inp\.maxLength = 4; inp\.disabled = true;/, 'the answer box is not closed at the start');
        /* submit()：從原始碼切出來，用每一題、每一種打法真的跑 */
        const fsrc = extractFunction(B.regroup, 'submit');
        let submitRun = null;
        if (!fsrc) fail('regroup: cannot cut submit() out of RENDER.regroup');
        else submitRun = (n, typed, left) => {
          const q = dig(n, 0), bai = dig(n, 1), h = Math.floor(n / 100);
          const calls = [];
          const d = new Proxy({}, { get:(o, k) => (k === 'gRegEmpty' ? '@EMPTY@' : (...a) => { calls.push([k].concat(a)); return k; }) });
          try {
            return new Function('d', 'n', 'q', 'bai', 'h', 'left', 'typed', 'calls',
              'var gSolved = false, gMsg = {}, inp = { value:typed, disabled:false }, go = { disabled:false };\n' +
              'function roundSolved(t){ calls.push(["SOLVED", t]); gSolved = true; } function roundMiss(t){ calls.push(["MISS", t]); }\n' +
              fsrc + '\nsubmit(); return { calls:calls, msg:gMsg.textContent, closed:inp.disabled && go.disabled };')(d, n, q, bai, h, left, typed, calls);
          } catch (e){ fail('regroup: submit() could not run: ' + e.message); return null; }
        };
        D.GAME_BREAK.forEach((n, i) => {
          const w = 'GAME_BREAK[' + i + '] ' + n, q = dig(n, 0), bai = dig(n, 1), h = Math.floor(n / 100), t = dig(n, 2), o = dig(n, 3);
          if (!(isInt(n) && n >= 1000 && n <= 9999)) return fail(w + ' is not a 4-digit number');
          if (q < 1 || q > 3) fail(w + ': ' + q + ' thousands — should be 1~3 (three bundles fit in the box)');
          if (bai > 8) fail(w + ': ' + bai + ' loose hundreds — at most 8 fit in a row');
          if (q === bai) fail(w + ': the thousands digit equals the hundreds digit — typing either cannot be told apart');
          /* 畫面決定答案：q 捆 × 10 ＋ bai 個散的 ＝ n ÷ 100 */
          if (q * 10 + bai !== h) fail(w + ': the box would show ' + (q * 10 + bai) + ' hundreds, but ' + n + ' has ' + h);
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gRegNow ' + L, d.gRegNow(n, q), [n, q]);
            seq(w + ' gRegNow(0) ' + L, d.gRegNow(n, 0), [n]);
            seq(w + ' gRegRest ' + L, d.gRegRest(t, o), [t, o]);
            seq(w + ' gRegDone ' + L, d.gRegDone(n, q, bai, h), [q, q * 10, bai, h, n, 100, h, n % 100]);
            /* 數字對了、單位換掉也是錯（「23 個十」）：每一句要說到它在數的東西 */
            const H = L === 'zh' ? '個百' : 'hundreds', T = L === 'zh' ? '個千' : 'thousand';
            [['gRegDone', d.gRegDone(n, q, bai, h), [H, T]], ['gRegDigit', d.gRegDigit(bai, q), [H, T]], ['gRegNoLoose', d.gRegNoLoose(q * 10, bai), [H]],
             ['gRegQian', d.gRegQian(q), [T]], ['gRegTens', d.gRegTens(10), [L === 'zh' ? '個十' : 'tens']]].forEach(([k, t, words]) => words.forEach(wd => { if (t.indexOf(wd) < 0) fail(w + ' ' + k + ' ' + L + ' does not say "' + wd + '": ' + t); }));
            if ((L === 'zh' ? /(\d+) 個百：/ : /that’s (\d+) hundreds/).exec(d.gRegDone(n, q, bai, h)) === null) fail(w + ' gRegDone ' + L + ' does not say the total is ' + h + ' hundreds');
            seq(w + ' gRegDigit ' + L, d.gRegDigit(bai, q), L === 'zh' ? [bai, bai, q, q * 10] : [bai, bai, q * 10]);
            if (bai) seq(w + ' gRegNoLoose ' + L, d.gRegNoLoose(q * 10, bai), [q * 10, bai]);
            seq(w + ' gRegQian ' + L, d.gRegQian(q), [q, 1, 10]);
            seq(w + ' gRegTens ' + L, d.gRegTens(Math.floor(n / 10)), [Math.floor(n / 10), Math.floor(n / 10)]);
            seq(w + ' gReg2(left) ' + L, d.gReg2(q, 0, bai), [q]);
            seq(w + ' gReg2(done) ' + L, d.gReg2(0, q, bai), [q, 10, bai]);
          });
          if (submitRun){
            const cls = (typed, left) => { const r = submitRun(n, typed, left); if (!r) return '?'; const k = r.calls.filter(c => c[0] !== 'MISS' && c[0] !== 'SOLVED').map(c => c[0]); const end = r.calls.filter(c => c[0] === 'MISS' || c[0] === 'SOLVED').map(c => c[0]); return (k.join('+') || (r.msg === '@EMPTY@' ? 'EMPTY' : 'NONE')) + '/' + (end.join('+') || '-') + (r.closed ? '/closed' : ''); };
            const want = [[String(h), 0, 'gRegDone/SOLVED/closed'], [String(h), 1, 'NONE/-'], [String(bai), 0, 'gRegDigit/MISS'], [String(q), 0, 'gRegQian/MISS'],
                          [String(Math.floor(n / 10)), 0, 'gRegTens/MISS'], [String(h + 1), 0, 'gRegWrong/MISS'], ['', 0, 'EMPTY/-'], ['0' + h, 0, 'EMPTY/-'],
                          [String(h).charAt(0) + ' ' + String(h).slice(1), 0, 'EMPTY/-'], [h + '.0', 0, 'EMPTY/-'], [' ' + h + ' ', 0, 'gRegDone/SOLVED/closed']];
            if (bai) want.push([String(q * 10), 0, 'gRegNoLoose/MISS']);
            want.forEach(([typed, left, exp]) => { const got = cls(typed, left); if (got !== exp) fail(w + ': typing "' + typed + '"' + (left ? ' with a thousand still unbroken' : '') + ' should give ' + exp + ', got ' + got); });
          }
        });
        LANGS.forEach(L => {
          seq('gRegDirect ' + L, I18N[L].gRegDirect, L === 'zh' ? [1, 1, 1, 10] : [1, 1, 10]);
          seq('gRegWrong ' + L, I18N[L].gRegWrong(17), [17, 10]);
          seq('gHints.regroup ' + L, I18N[L].gHints.regroup, [1, 10]);
        });
      }

      /* ================= 第 3 關：寫數字（範例 3） ================= */
      {
        const WB = D.WRITE_BOX, K = D.WRITE_KEYS, H = D.WRITE_H, hb = WB.size / 2;
        const boxes = WB.x.map(x => sq(x, WB.y, WB.size));
        if (WB.x.length !== 4) fail('write: should have 4 boxes');
        boxes.forEach((b, p) => { inside(b, 'write: box ' + p, H); const l = { x:WB.x[p] - 34, y:D.WRITE_LBL.y, w:68, h:D.WRITE_LBL.h }; if (l.y + l.h > b.y) fail('write: label ' + p + ' runs into its box'); });
        noHits(boxes.map(b => ({ x:b.x - WB.pad, y:b.y, w:b.w + 2 * WB.pad, h:b.h })), 'write: boxes with their pad');
        for (let i = 1; i < 4; i++) if (!(WB.x[i] > WB.x[i - 1])) fail('write: the boxes are not thousands → ones from left to right');
        const keys = [];
        for (let v = 0; v <= 9; v++) keys.push(sq(150 + ((v % 5) - 2) * K.step, K.y + Math.floor(v / 5) * K.rowStep, K.size));
        keys.forEach((k, v) => { inside(k, 'write: digit card ' + v, H); noneHit(k, boxes, 'write: digit card ' + v); });
        noHits(keys, 'write: digit cards');
        need('write', /var n = pick\(GAME_WRITE\), r = d\.gRead\(n\)/, 'the words shown are not the reading of the number');
        need('write', /c:placeDigit\(n, p\)/, 'a box does not want exactly its digit');
        need('write', /if \(v !== bx\.c\)\{ roundMiss\(bx\.c === 0 \? d\.gWriteZero\(r, bx\.p\) : d\.gWriteDigit\(r, bx\.p, bx\.c, d\.gChunk\(n, bx\.p\)\)\); return false; \}/, 'a wrong digit is accepted, or the wrong reason is given');
        need('write', /if \(filled === 4\) roundSolved/, 'the round does not end when all four boxes are filled');
        need('write', /trailLine\(d\.gWriteNow\(r\)\)/, 'the words are not shown');
        if (nearestOpen){
          const list = WB.x.map((x, p) => ({ id:p, cx:x, cy:WB.y, hw:hb, hh:hb, done:false }));
          let bad = 0;
          list.forEach(b => { for (let x = b.cx - hb + 0.5; x < b.cx + hb; x += 2) for (let y = b.cy - hb + 0.5; y < b.cy + hb; y += 2){ const g = runNearest(list, { x, y }, WB.pad); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('write: nearestOpen() gives ' + bad + ' points inside a box to another box (or none)');
        }
        D.GAME_WRITE.forEach((n, i) => {
          const w = 'GAME_WRITE[' + i + '] ' + n, ds = [0, 1, 2, 3].map(p => dig(n, p));
          if (!(isInt(n) && n >= 1000 && n <= 9999)) return fail(w + ' is not a 4-digit number');
          if (ds.indexOf(0) < 0) fail(w + ': no 0 — the round never asks for a placeholder');
          if (ds[2] === 1) fail(w + ': the tens digit is 1 (一十 / teen words) — not what this round teaches');
          LANGS.forEach(L => {
            const d = I18N[L], r = d.gRead(n), mine = L === 'zh' ? myZh(n) : myEn(n);
            if (r !== mine) fail(w + ' ' + L + ': the words shown are "' + r + '", should be "' + mine + '"');
            if ((L === 'zh' ? parseZh(r) : parseEn(r)) !== n) fail(w + ' ' + L + ': "' + r + '" does not read back as ' + n);
            if (/\d/.test(r)) fail(w + ' ' + L + ': the words contain digits — they would give the answer away: ' + r);
            seq(w + ' gWriteNow ' + L, d.gWriteNow(r), []);
            seq(w + ' gWriteDone ' + L, d.gWriteDone(r, n), [n, 0]);
            for (let p = 0; p < 4; p++){
              if (ds[p] === 0){
                const z = d.gWriteZero(r, p);
                seq(w + ' gWriteZero(' + p + ') ' + L, z, [0]);
                if (z.indexOf(d.gPlace[p]) < 0) fail(w + ' gWriteZero ' + L + ' does not name the ' + d.gPlace[p]);
                /* 「沒有說到那一層」要是真的：那一層的字不在念法裡 */
                const unitWord = L === 'zh' ? ['千', '百', '十', null][p] : ['thousand', 'hundred', null, null][p];
                if (unitWord && r.indexOf(unitWord) >= 0) fail(w + ' ' + L + ': gWriteZero says the words skip the ' + d.gPlace[p] + ', but "' + r + '" has ' + unitWord);
                if (L === 'en' && p === 2 && /twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|teen|\bten\b|eleven|twelve/.test(r)) fail(w + ' en: the words have a tens word but the tens is 0');
              } else {
                const ch = d.gChunk(n, p), myCh = L === 'zh' ? ZD[ds[p]] + ['千', '百', '十', ''][p] : [W1[ds[p]] + ' thousand', W1[ds[p]] + ' hundred', W10[ds[p]], W1[ds[p]]][p];
                if (ch !== myCh) fail(w + ' gChunk(' + p + ') ' + L + ' is "' + ch + '", should be "' + myCh + '"');
                if (r.indexOf(ch) < 0) fail(w + ' ' + L + ': gWriteDigit quotes "' + ch + '", which is not in "' + r + '"');
                const t = d.gWriteDigit(r, p, ds[p], ch);
                seq(w + ' gWriteDigit(' + p + ') ' + L, t, [ds[p]]);
                if (t.indexOf(d.gPlace[p]) < 0) fail(w + ' gWriteDigit ' + L + ' does not name the ' + d.gPlace[p]);
              }
              seq(w + ' gWrite2(' + p + ') ' + L, d.gWrite2(p, ds[p]), [ds[p]]);
            }
          });
        });
      }

      /* ================= 第 4 關：排大小（範例 4） ================= */
      {
        const SS = D.SORT_SLOT, H = D.SORT_H, TR = D.SORT_TRAY, C = D.SORT_CARD;
        const slots = SS.x.map(x => sq(x, SS.y, SS.w, SS.h));
        slots.forEach((s, i) => inside(s, 'sort: slot ' + i, H));
        noHits(slots, 'sort: slots');
        for (let i = 1; i < 4; i++){ if (!(SS.x[i] > SS.x[i - 1])) fail('sort: the slots are not left to right'); if (SS.x[i] - SS.x[i - 1] - SS.w < 10) fail('sort: no room for "<" between slot ' + (i - 1) + ' and ' + i); }
        if (C.w !== SS.w || C.h !== SS.h) fail('sort: a card (' + C.w + '×' + C.h + ') does not fill its slot (' + SS.w + '×' + SS.h + ')');
        const x0 = (W - 3 * TR.step) / 2, tray = [0, 1, 2, 3].map(i => sq(x0 + i * TR.step, TR.y, C.w, C.h));
        tray.forEach((t, i) => { inside(t, 'sort: tray card ' + i, H); noneHit(t, slots, 'sort: tray card ' + i); });
        noHits(tray, 'sort: tray cards');
        const lbl = { x:0, y:D.SORT_LBL.y, w:W, h:D.SORT_LBL.h };
        noneHit(lbl, slots.concat(tray), 'sort: the smallest/biggest labels');
        need('sort', /var set = pick\(GAME_SORT\), sorted = set\.slice\(\)\.sort\(function\(a, b\)\{ return a - b; \}\)/, 'the slots do not want the numbers in numeric order');
        need('sort', /var x = P\.data\.v, y = sorted\[s\.i\];\s*if \(x !== y\)\{ roundMiss\(d\.gSortWhy\(x, y, sortCompare\(x, y\)\)\); return false; \}/, 'a card in the wrong slot is accepted, or the reason compares the wrong two numbers');
        need('sort', /if \(placed === 4\) roundSolved\(d\.gSortDone\(sorted\)\)/, 'the round does not end with the sorted row');
        need('sort', /renderTray\(B, set, SORT_TRAY\.y,/, 'the cards are not laid out by renderTray()');
        const myCmp = (x, y) => {
          const a = String(x), b = String(y);
          if (a.length !== b.length) return { kind:'len', lx:a.length, ly:b.length };
          for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { kind:'digit', len:a.length, p:4 - a.length + i, a:+a[i], b:+b[i] };
          return null;
        };
        /* sortCompare() 不只對題庫：三位數對三位數、四位數對四位數、位數不同，都和自己的比法一樣 */
        for (let x = 100; x <= 9999; x += 89) for (let y = 103; y <= 9999; y += 97){
          if (x === y) continue;
          if (JSON.stringify(D.sortCompare(x, y)) !== JSON.stringify(myCmp(x, y))){ fail('sortCompare(' + x + ', ' + y + ') is ' + JSON.stringify(D.sortCompare(x, y)) + ', should be ' + JSON.stringify(myCmp(x, y))); x = 1e9; break; }
        }
        D.GAME_SORT.forEach((set, i) => {
          const w = 'GAME_SORT[' + i + '] ' + set.join('/');
          if (!Array.isArray(set) || set.length !== 4 || new Set(set).size !== 4 || !set.every(v => isInt(v) && v >= 100 && v <= 9999)) return fail(w + ': should be 4 different 3- or 4-digit numbers');
          const three = set.filter(v => v < 1000), four = set.filter(v => v >= 1000);
          if (three.length !== 1) fail(w + ': should have exactly one 3-digit number');
          else if (!four.every(v => dig(three[0], 1) > dig(v, 0))) fail(w + ': the 3-digit ' + three[0] + ' should start with a bigger digit than every 4-digit number (the "more digits wins" trap)');
          const pairTens = four.some(a => four.some(b => a !== b && dig(a, 0) === dig(b, 0) && dig(a, 1) === dig(b, 1)));
          if (!pairTens) fail(w + ': no two 4-digit numbers share their thousands and hundreds — nobody has to compare down to the tens');
          const sorted = set.slice().sort((a, b) => a - b);
          /* 照遊戲的規則：第 i 格只收第 i 小的那一張 —— 放完一定是由小到大 */
          for (let k = 1; k < 4; k++) if (!(sorted[k - 1] < sorted[k])) fail(w + ': the row is not increasing');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gSortDone ' + L, d.gSortDone(sorted), sorted);
            sorted.forEach((v, k) => seq(w + ' gSort2 ' + L, d.gSort2(k + 1, v), [k + 1, v]));
            set.forEach(x => set.forEach(y => {
              if (x === y) return;
              const c = D.sortCompare(x, y), m = myCmp(x, y);
              if (JSON.stringify(c) !== JSON.stringify(m)) fail('sortCompare(' + x + ', ' + y + ') is ' + JSON.stringify(c) + ', should be ' + JSON.stringify(m));
              const t = d.gSortWhy(x, y, m);
              seq(w + ' gSortWhy(' + x + ', ' + y + ') ' + L, t, m.kind === 'len' ? [x, m.lx, y, m.ly, x, y] : [x, y, m.len, m.a, m.b, x, y]);
              const left = L === 'zh' ? '往左' : 'to the left', right = L === 'zh' ? '往右' : 'to the right';
              if (t.indexOf(x < y ? left : right) < 0 || t.indexOf(x < y ? right : left) >= 0) fail(w + ' gSortWhy ' + L + ': ' + x + ' vs ' + y + ' points the wrong way: ' + t);
              const rel = L === 'zh' ? (x < y ? ' 小' : ' 大') : (x < y ? 'smaller' : 'bigger');
              if (t.indexOf(rel) < 0) fail(w + ' gSortWhy ' + L + ': ' + x + ' vs ' + y + ' says the wrong size: ' + t);
              if (m.kind === 'digit'){
                if (t.indexOf(d.gPlace[m.p]) < 0) fail(w + ' gSortWhy ' + L + ' does not name the ' + d.gPlace[m.p] + ' where ' + x + ' and ' + y + ' first differ');
                for (let p = 4 - m.len; p < m.p; p++) if (dig(x, p) !== dig(y, p) || t.indexOf(d.gPlace[p]) < 0) fail(w + ' gSortWhy ' + L + ': the ' + d.gPlace[p] + ' should be named as the same');
              }
            }));
          });
        });
      }

      /* ================= 第 5 關：放數線（範例 5） ================= */
      {
        const LN = D.LINE, LS = D.LINE_SLOT, C = D.LINE_CARD, TR = D.LINE_TRAY, H = D.LINE_H, pitch = (LN.x1 - LN.x0) / 10;
        for (let v = 0; v <= 10000; v += 100){ const x = LN.x0 + (LN.x1 - LN.x0) * v / 10000; if (!near(D.lineX(v), x)) { fail('lineX(' + v + ') should be ' + x); break; } }
        for (let v = 0; v <= 10000; v += 50){ if (v % 1000 === 500) continue; if (D.lineNearest(v) !== Math.round(v / 1000) * 1000) { fail('lineNearest(' + v + ') should be ' + Math.round(v / 1000) * 1000); break; } }
        inside({ x:LN.x0, y:LN.y - 2, w:LN.x1 - LN.x0, h:4 }, 'line: the axis', H);
        const cards = [];
        for (let t = 0; t <= 10; t++){
          const c = sq(LN.x0 + t * pitch, LS.y, C.w, C.h);
          inside(c, 'line: a card on the ' + (t * 1000) + ' tick', H);
          if (c.y + c.h > LN.y - 8) fail('line: a placed card covers the axis');
          cards.push(c);
        }
        /* ⚠️ 已知例外（codex 第一輪）：一萬的數線放在 300 寬的畫板上，每一格只有 pitch（約 22.8）寬，
           「目的地 ≥ 44」做不到（11 個整千要 484 寬）。拿得起來的卡片是 56×48；落點一格高 LS.hh × 2 ＋ pad。
           這裡釘住它不會更窄：一格至少 22，而且整條線沒有空隙（每一格的落點正好一格寬）。留給 Tony 決定要不要換版面。 */
        if (pitch < 22) fail('line: one thousand is only ' + pitch.toFixed(1) + ' wide — narrower than the documented 22');
        if (Math.ceil(C.w / pitch) > 3) fail('line: a card (' + C.w + ') is wider than 3 steps (' + (3 * pitch).toFixed(1) + ') — cards 3000 apart would overlap');
        if (LS.y - LS.hh < 0) fail('line: the drop zone starts above the board');
        if (LS.y + LS.hh > LN.y + 12) fail('line: the drop zone reaches below the tick labels');
        const labels = [];
        for (let t = 0; t <= 10; t += 2) labels.push({ x:LN.x0 + t * pitch - D.LINE_LBL.w / 2, y:D.LINE_LBL.y, w:D.LINE_LBL.w, h:D.LINE_LBL.h });
        labels.forEach((l, i) => inside(l, 'line: label ' + (i * 2000), H));
        noHits(labels, 'line: tick labels');
        const x0 = (W - 2 * TR.step) / 2, tray = [0, 1, 2].map(i => sq(x0 + i * TR.step, TR.y, C.w, C.h));
        tray.forEach((t, i) => { inside(t, 'line: tray card ' + i, H); labels.forEach((l, j) => { if (hit(t, l)) fail('line: tray card ' + i + ' overlaps label ' + j); }); });
        noHits(tray, 'line: tray cards');
        need('line', /var v = P\.data\.v, want = lineNearest\(v\);\s*if \(s\.t !== want\)\{ var b = bounds\(v\); roundMiss\(d\.gLineWhy\(v, b\.lo, b\.hi, want\)\); return false; \}/, 'a card on the wrong thousand is accepted, or the reason uses other numbers');
        need('line', /slots\.push\(\{ t:t \* 1000, cx:x, cy:LS\.y, hw:pitch \/ 2, hh:LS\.hh, done:false \}\)/, 'the drop zones are not one per thousand, a step wide');
        need('line', /var x = lineX\(t \* 1000\), big = t % 2 === 0;/, 'the ticks are not at every thousand with a label every other one');
        need('line', /addZone\(B, lineX\(v\) - 6, LINE\.y - 6, 12, 12, 'gmark'\)/, 'the exact position is not marked at lineX(v)');
        need('line', /var lo = Math\.floor\(v \/ 1000\) \* 1000; return \{ lo:lo, hi:lo \+ 1000 \};/, 'the two neighbouring thousands are not the ones around v');
        if (nearestOpen){
          const list = [];
          for (let t = 0; t <= 10; t++) list.push({ t:t * 1000, cx:LN.x0 + t * pitch, cy:LS.y, hw:pitch / 2, hh:LS.hh, done:false });
          let bad = 0;
          list.forEach(s => { for (let x = s.cx - pitch / 2 + 0.25; x < s.cx + pitch / 2 - 0.2; x += 0.5) [LS.y - LS.hh + 1, LS.y, LS.y + LS.hh - 1].forEach(y => { const g = runNearest(list, { x, y }, LS.pad); if (!g || g.t !== s.t) bad++; }); });
          if (bad) fail('line: nearestOpen() gives ' + bad + ' points over one thousand to another (or none)');
        }
        D.GAME_LINE.forEach((set, i) => {
          const w = 'GAME_LINE[' + i + '] ' + set.join('/');
          if (!Array.isArray(set) || set.length !== 3 || new Set(set).size !== 3) return fail(w + ': should be 3 different numbers');
          set.forEach(v => {
            if (!(isInt(v) && v > 0 && v < 10000 && v % 100 === 0)) fail(w + ': ' + v + ' is not a whole hundred between 0 and 10000');
            if (v % 1000 === 0) fail(w + ': ' + v + ' is exactly on a tick — nothing to estimate');
            if (v % 1000 === 500) fail(w + ': ' + v + ' is exactly halfway — no single closest thousand');
          });
          const ts = set.map(v => Math.round(v / 1000) * 1000).sort((a, b) => a - b);
          for (let k = 1; k < 3; k++) if (ts[k] - ts[k - 1] < 3000) fail(w + ': closest thousands ' + ts[k - 1] + ' and ' + ts[k] + ' are less than 3000 apart — the cards would overlap');
          const s = set.slice().sort((a, b) => a - b);
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gLineDone ' + L, d.gLineDone(s.map(v => [v, Math.round(v / 1000) * 1000])), [].concat.apply([], s.map(v => [v, Math.round(v / 1000) * 1000])));
            s.forEach(v => {
              const lo = Math.floor(v / 1000) * 1000, hi = lo + 1000, t = Math.round(v / 1000) * 1000;
              /* 那一句說「比較靠近 t」要是真的：t 那一邊差得比較少 */
              if ((t === lo) !== (v - lo < hi - v)) fail(w + ': ' + v + ' is not closer to ' + t);
              seq(w + ' gLineWhy(' + v + ') ' + L, d.gLineWhy(v, lo, hi, t), L === 'zh' ? [v, lo, hi, lo, v - lo, hi, hi - v, t] : [v, lo, hi, v - lo, lo, hi - v, hi, t]);
              if (d.gLineWhy(v, lo, hi, t).indexOf(L === 'zh' ? '比較靠近 ' + t : 'closer to ' + t) < 0) fail(w + ' gLineWhy ' + L + ' does not say ' + v + ' is closer to ' + t);
              seq(w + ' gLine2(' + v + ') ' + L, d.gLine2(v, lo, hi), [v, lo, hi]);
            });
          });
        });
        LANGS.forEach(L => seq('gHints.line ' + L, I18N[L].gHints.line, [1000]));
      }

      /* 讀數行：排好／放好了幾張 */
      LANGS.forEach(L => { seq('gSortNow ' + L, I18N[L].gSortNow(2), [2, 4]); seq('gLineNow ' + L, I18N[L].gLineNow(1), [1, 3]); });
    }
  }
};
