/* grade-5/math/common-factor 的檢查設定（好朋友車站：公因數、最大公因數、公倍數、最小公倍數 —— 列舉法，不用短除法）。
   2026-10-10 新增 —— 和小遊戲「好朋友車站大挑戰」改成五關五種玩法（§六之五）同一次寫成。這一課之前沒有設定檔。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（最大公因數用輾轉相除，
   頁面是列舉因數；最小公倍數用 a × b ÷ 最大公因數，頁面是 lcm()）。刻意的迷思誘答見 stemEchoOk。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋、範例 1／2 的四句說明對每一個能點的數）裡的算式逐條重算：
     a ＝ b × c ＝ d × e 這種連等、a ÷ b ＝ q（必須整除）、a ÷ b ＝ q 餘 r（餘數比除數小、而且不是 0）。
     掃描器自己先跑正反例（scanEq 的 PROBES）。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關用自己的算法重算答案，並且**照遊戲的規則把每一題玩一次**：
       分一分 —— 卡片就是兩個數的因數合在一起、每一張只屬於一個框、框裝得下；
       鋪地磚 —— 四張卡剛好是「最大公因數、比它小的公因數、只整除一邊的兩張」，只有最大公因數那一張會過關；
       青蛙跳 —— 照「只有落後的那一隻可以跳」把兩種起跳順序都跳完，第一次停在同一格一定是最小公倍數；
       找公倍數 —— 36 以內 2～3 個、而且最小公倍數比兩個數都大（不是「大的那個數」）；
       裝袋子 —— 1～60 每一個打得出來的袋數都照頁面的順序判一次，只有最大公因數會過關。
     頁面的純函式（divs／commonDivs／gcfOf／lcmOf／regionOf／vennCards／tileFloor／hopX／stripXY／stripBeyond／
     packDotXY／packBagXY）拿整個題庫去呼叫再和自己的算法比；shuffle()／readInt()／nearestAny()／dropTarget()／
     roundMiss() 從原始碼切出來實際執行。只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。
     每一句說明逐個比數字（每一題、每一種放錯、每一個打得出來的袋數），而且句子裡的算式都要算得對。
     版面與觸控 ≥ 44px 從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行，寫在註解裡也會通過 —— 見 need() 旁的說明）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、文字放得進框、375px 的實際尺寸由 teaching-workspace/game-harness/g5-common-factor 的
   端對端測試驗（合成 PointerEvent），不在這裡。 */

const { extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
/* 第二套數論：輾轉相除（頁面是列舉因數） */
function gcdRef(a, b){ while (b){ const t = a % b; a = b; b = t; } return a; }
function lcmRef(a, b){ return a / gcdRef(a, b) * b; }
function divsRef(n){ const o = []; for (let i = 1; i * i <= n; i++) if (n % i === 0){ o.push(i); if (i * i !== n) o.push(n / i); } return o.sort((x, y) => x - y); }
function cfRef(a, b){ return divsRef(gcdRef(a, b)); }
function joinRef(list, lang){ return list.join(lang === 'zh' ? '、' : ', '); }

/* 算式掃描：把一段文字裡的每一條「項 ＝ 項 ＝ …」找出來重算。
   項＝數字與 × ÷ ＋ − 組成的式子；「q 餘 r」（英文 q remainder r）只能接在一個除法的後面。
   ⚠️ 不可以從另一個式子的中間開始（「3 × 4 = 12」的「4 = 12」不是一條） */
const TERM = '\\d+(?:\\s*[×÷+\\-]\\s*\\d+)*(?:\\s*餘\\s*\\d+)?';
function evalTerm(t){
  /* 回傳 { v:值（分數用 [分子, 分母]）, rem:null | [q, r] } */
  const m = t.match(/^(\d+)\s*餘\s*(\d+)$/);
  if (m) return { rem:[+m[1], +m[2]] };
  if (/餘/.test(t)) return { bad:'"' + t + '" has 餘 after an expression' };
  const toks = t.split(/\s*([×÷+\-])\s*/);
  /* × ÷ 先算（有理數），再由左到右 ＋ − */
  let sum = [0, 1], cur = [+toks[0], 1], sign = 1;
  const mul = (p, q) => [p[0] * q[0], p[1] * q[1]], add = (p, q, s) => [p[0] * q[1] + s * q[0] * p[1], p[1] * q[1]];
  for (let i = 1; i < toks.length; i += 2){
    const op = toks[i], v = [+toks[i + 1], 1];
    if (op === '×') cur = mul(cur, v);
    else if (op === '÷'){ if (v[0] === 0) return { bad:'÷ 0' }; cur = [cur[0], cur[1] * v[0]]; }
    else { sum = add(sum, cur, sign); sign = op === '+' ? 1 : -1; cur = v; }
  }
  sum = add(sum, cur, sign);
  return { v:sum, div:toks.length === 3 && toks[1] === '÷' ? [+toks[0], +toks[2]] : null };
}
function scanEq(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/[＝]/g, '=').replace(/＋/g, '+').replace(/[－−–]/g, '-')
    .replace(/\s+remainder\s+/g, ' 餘 ').replace(/\s+/g, ' ');
  const re = new RegExp('(?<![\\d.\\/×÷+\\-] ?)(' + TERM + ')((?: ?= ?' + TERM + ')+)(?!\\.?\\d|\\/)', 'g');
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const terms = [m[1]].concat(m[2].split(/ ?= ?/).filter(Boolean));
    let bad = null, ref = null;
    for (let i = 0; i < terms.length && !bad; i++){
      const e = evalTerm(terms[i].trim());
      if (e.bad){ bad = e.bad; break; }
      if (e.rem){
        /* 「a ÷ b = q 餘 r」只能剛好兩項：前面再接一項或後面再接「= 999」都不可以靜靜放過（codex 第一輪） */
        if (i !== 1 || terms.length !== 2){ bad = 'a remainder must close a two-term "a ÷ b = q 餘 r" (got ' + terms.length + ' terms)'; break; }
        const prev = i ? evalTerm(terms[i - 1].trim()) : null;
        if (!prev || !prev.div){ bad = '"' + terms[i] + '" does not follow a single division'; break; }
        const [a, b] = prev.div, [q, r] = e.rem;
        if (!(r > 0 && r < b && a === b * q + r)) bad = a + ' ÷ ' + b + ' is not ' + q + ' remainder ' + r;
        ref = null;
        continue;
      }
      if (e.div && i + 1 < terms.length && /餘/.test(terms[i + 1])) continue;   /* 「a ÷ b = q 餘 r」：在下一項驗 */
      if (e.div && e.v[0] % e.v[1] !== 0 && e.div[0] % e.div[1] !== 0){ bad = e.div[0] + ' ÷ ' + e.div[1] + ' does not divide exactly but no remainder is written'; break; }
      if (ref && ref[0] * e.v[1] !== e.v[0] * ref[1]) bad = '"' + terms[i - 1] + ' = ' + terms[i] + '" is false';
      ref = e.v;
    }
    out.push({ text:m[0], bad });
  }
  return out;
}
const PROBES = [
  ['12 ÷ 4 = 3', true], ['12 ÷ 4 = 4', false], ['18 ÷ 4 = 4 餘 2', true], ['18 ÷ 4 = 4 餘 3', false], ['18 ÷ 4 = 4 remainder 2', true],
  ['18 ÷ 4 = 4', false], ['12 ÷ 4 = 3 餘 0', false], ['18 ÷ 4 = 3 餘 6', false], ['12 = 3 × 4 = 4 × 3', true], ['24 = 3 × 8 = 4 × 7', false],
  ['8 ＋ 4 = 12', true], ['8 + 4 = 13', false], ['4 × 3 = 12 塊', true], ['3 × 2 = 7 塊', false], ['20 = 4 × 5', true], ['20 = 4 × 6', false],
  ['看 4：12 ÷ 4 = 3，18 ÷ 4 = 4 餘 2。', true], ['長：18 ÷ 4 = 4 餘 2，剩 2 公分', true],
  /* 英文句末的句點不可以讓餘數那一節讀不到（讀不到就會回溯成「12 ÷ 8 = 1」） */
  ['Look at 8: 8 ÷ 8 = 1, 12 ÷ 8 = 1 remainder 4.', true], ['1 = 18 ÷ 4 = 4 餘 2', false], ['18 ÷ 4 = 4 餘 2 = 999', false], ['so 12 ÷ 8 = 1 remainder 3.', false], ['That is 12 ÷ 4 = 3.', true]
];

/* 這一課的英文字典沒有分單複數的地方要盯（「1 bags」） */
const LANGS = ['zh', 'en'];

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-10 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['venn', 'tile', 'hop', 'strip', 'pack'];", replace:"var GAME_ORDER = ['venn', 'hop', 'tile', 'strip', 'pack'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 46;', replace:'  var GPICK = 42;' },
    { file:'index', expect:'scoring: a round should give', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'first match instead of nearest', find:'      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }', replace:'      if (!best){ bd = dd; bc = dc; best = b; }' },
    { file:'index', expect:'measure to the box, not the centre', find:'      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }', replace:'      if (dc < bc){ bd = dd; bc = dc; best = b; }' },
    { file:'index', expect:'the finger in the right box does not win', find:'    if (good(tf)) return tf;\n', replace:'' },
    { file:'index', expect:'a drop on empty space is not silent', find:'    return tc || tf || null;', replace:'    return tc || tf || { ok:false };' },
    { file:'index', expect:'already in order', find:'    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }', replace:'' },
    { file:'index', expect:'shuffle() changes its input', find:'    var a = arr.slice();\n    for (var j = a.length - 1; j > 0; j--){\n      var k = Math.floor(', replace:'    var a = arr;\n    for (var j = a.length - 1; j > 0; j--){\n      var k = Math.floor(' },
    { file:'index', expect:'board-generation guard', find:'      if (gen !== gGen) return;   /* 這一張屬於已經拿掉的畫板 */\n', replace:'' },
    { file:'index', expect:'ahead mode does not show hint level 1', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"    if (mode === 'ahead'){ hintLevel = 1; }" },
    { file:'index', expect:'keeps a stale hint', find:"    elHint.textContent = '';   /* 過關後提示不再適用", replace:"    /* 過關後提示不再適用" },
    /* 數論 */
    { file:'index', expect:'regionOf(', find:"return x && y ? 'both' : x ? 'a' : y ? 'b' : null; }", replace:"return x && y ? 'both' : x ? 'a' : 'b'; }" },
    { file:'index', expect:'disagree with Euclid', find:'  function lcmOf(a, b){ for (var m = a; m <= a * b; m += a) if (m % b === 0) return m; return a * b; }', replace:'  function lcmOf(a, b){ return a * b; }' },
    /* 第 1 關：分一分 */
    { file:'index', expect:'vennCards() =', find:'divs(b).forEach(function(v){ if (out.indexOf(v) < 0) out.push(v); });', replace:'divs(b).forEach(function(v){ out.push(v); });' },
    { file:'index', expect:'box gets 0 cards', find:'var GAME_VENN = [[8, 12], [12, 20],', replace:'var GAME_VENN = [[9, 18], [12, 20],' },
    { file:'index', expect:'only 1 in common', find:'var GAME_VENN = [[8, 12], [12, 20],', replace:'var GAME_VENN = [[8, 15], [12, 20],' },
    { file:'index', expect:'do not fit the tray', find:'var GAME_VENN = [[8, 12], [12, 20],', replace:'var GAME_VENN = [[24, 36], [12, 20],' },
    { file:'index', expect:'have no visible gap', find:'var VENN_G = { binY:[0, 70, 140], binH:66,', replace:'var VENN_G = { binY:[0, 66, 132], binH:66,' },
    { file:'index', expect:'covers the label', find:'lblX:2, lblW:99, spotX0:126, spotDX:49,', replace:'lblX:2, lblW:99, spotX0:118, spotDX:49,' },
    { file:'index', expect:'spots of box', find:'lblX:2, lblW:99, spotX0:126, spotDX:49,', replace:'lblX:2, lblW:99, spotX0:126, spotDX:44,' },
    { file:'index', expect:'overlaps the boxes', find:'trayY:[238, 294], H:322 };', replace:'trayY:[220, 294], H:322 };' },
    { file:'index', expect:'a card in the wrong box is not refused', find:'        if (t.rg !== P.data.rg){ roundMiss(d.gVennWhy(a, b, P.data.v, t.rg)); return false; }', replace:'        if (false){ roundMiss(d.gVennWhy(a, b, P.data.v, t.rg)); return false; }' },
    { file:'index', expect:'the tray is not shuffled', find:'      var pieces = shuffle(cards).map(', replace:'      var pieces = cards.map(' },
    { file:'index', expect:"a card's box is not regionOf", find:'data:{ v:v, rg:regionOf(a, b, v) }', replace:'data:{ v:v, rg:regionOf(b, a, v) }' },
    { file:'index', expect:'the SMALLER number', find:'roundSolved(d.gVennDone(a, b, commonDivs(a, b), Math.min(a, b)));', replace:'roundSolved(d.gVennDone(a, b, commonDivs(a, b), Math.max(a, b)));' },
    { file:'index', expect:'numbers should read', find:"        return v + ' 也是 ' + o + ' 的因數（' + D.gDiv(o, v) + '）—— 它不只是 ' + n + ' 的因數。';", replace:"        return v + ' 也是 ' + o + ' 的因數（' + D.gDiv(o, v) + '）—— 它不只是 ' + o + ' 的因數。';" },
    { file:'index', expect:'names where the card goes', find:"        return v + ' 也是 ' + o + ' 的因數（' + D.gDiv(o, v) + '）—— 它不只是 ' + n + ' 的因數。';", replace:"        return v + ' 也是 ' + o + ' 的因數（' + D.gDiv(o, v) + '）—— 它不只是 ' + n + ' 的因數，要放中間。';" },
    { file:'index', expect:'is not 4 remainder', find:"      gDiv: function(n, v){ var r = n % v; return n + ' ÷ ' + v + ' = ' + Math.floor(n / v) + (r ? ' 餘 ' + r : ''); },", replace:"      gDiv: function(n, v){ var r = n % v; return n + ' ÷ ' + v + ' = ' + Math.floor(n / v) + (r ? ' 餘 ' + (r + 1) : ''); }," },
    { file:'index', expect:'no remainder is written', find:"(r ? ' remainder ' + r : ''); },", replace:"''; }," },
    { file:'index', expect:'missing space between Chinese and a digit', find:"      gVennNow: function(k, n){ return '放好 ' + k", replace:"      gVennNow: function(k, n){ return '放好' + k" },
    /* 第 2 關：鋪地磚 */
    { file:'index', expect:'must each divide exactly ONE side', find:'{ L:18, W:12, cards:[6, 3, 9, 12] },', replace:'{ L:18, W:12, cards:[6, 2, 3, 12] },' },
    { file:'index', expect:'wider than the floor', find:'{ L:15, W:9, cards:[3, 1, 5, 9] }', replace:'{ L:15, W:9, cards:[3, 1, 5, 10] }' },
    { file:'index', expect:'no smaller common factor', find:'{ L:20, W:15, cards:[5, 1, 10, 15] },', replace:'{ L:20, W:15, cards:[5, 4, 10, 15] },' },
    { file:'index', expect:'must be a card exactly once', find:'{ L:24, W:16, cards:[8, 4, 6, 12] },', replace:'{ L:24, W:16, cards:[2, 4, 6, 12] },' },
    { file:'index', expect:'not in that order', find:'        if (k < g){ roundMiss(d.gTileSmall(e.L, e.W, k)); return false; }', replace:'        if (false){ roundMiss(d.gTileSmall(e.L, e.W, k)); return false; }' },
    { file:'index', expect:'the floor is not laid', find:'        lay(k);\n        if (e.L % k', replace:'        if (e.L % k' },
    { file:'index', expect:'the tile cards are not shuffled', find:'      shuffle(e.cards).forEach(', replace:'      e.cards.forEach(' },
    { file:'index', expect:'not drawn to scale', find:'var s = tileScale(e), w = e.L * s, h = e.W * s;', replace:'var s = tileScale(e), w = e.L * s, h = e.W * s * 0.9;' },
    { file:'index', expect:'overlaps the width label', find:'floorY:30, floorX:46,', replace:'floorY:30, floorX:40,' },
    { file:'index', expect:'tile cards', find:'trayX:[39, 113, 187, 261], trayY:232,', replace:'trayX:[39, 100, 187, 261], trayY:232,' },
    { file:'index', expect:'numbers should read', find:"        if (L % k) out.push('長：' + D.gDiv(L, k) + '，剩 ' + (L % k) + ' 公分');", replace:"        if (L % k) out.push('長：' + D.gDiv(L, k) + '，剩 ' + (L % k + 1) + ' 公分');" },
    { file:'index', expect:'is false', find:"'，一共 ' + (L / g) + ' × ' + (W / g) + ' = ' + (L / g) * (W / g) + ' 塊。'", replace:"'，一共 ' + (L / g) + ' × ' + (W / g) + ' = ' + ((L / g) + (W / g)) + ' 塊。'" },
    /* 第 3 關：青蛙跳 */
    { file:'index', expect:'the frog ahead is not refused', find:'        if (pos[i] > pos[j]){ roundMiss(d.gHopWhy(hop[i], pos[i], hop[j], pos[j])); return; }\n', replace:'' },
    { file:'index', expect:'the round does not end', find:'        var meet = pos[0] === pos[1];', replace:'        var meet = pos[0] === pos[1] && pos[0] > 2 * hop[0];' },
    { file:'index', expect:'the LCM is one of the two numbers', find:'var GAME_HOP = [[3, 4], [6, 8],', replace:'var GAME_HOP = [[3, 6], [6, 8],' },
    { file:'index', expect:'the line should end at 2', find:'  function hopX(pos, m){ return HOP_G.x0 + pos * HOP_G.len / (2 * m); }', replace:'  function hopX(pos, m){ return HOP_G.x0 + pos * HOP_G.len / (1.5 * m); }' },
    { file:'index', expect:'the numbers under the line overlap', find:'numY:8, numW:22, numH:24,', replace:'numY:8, numW:28, numH:24,' },
    { file:'index', expect:"run into lane 2", find:'laneY:[86, 208],', replace:'laneY:[86, 180],' },
    { file:'index', expect:'a frog is', find:'lblH:28, frog:48, frogUp:4,', replace:'lblH:28, frog:44, frogUp:4,' },
    { file:'index', expect:'is false', find:"      gHopOk: function(h, from, to){ return h + ' 號蛙：' + from + ' ＋ ' + h + ' = ' + to + '。'; },", replace:"      gHopOk: function(h, from, to){ return h + ' 號蛙：' + from + ' ＋ ' + h + ' = ' + (to + 1) + '。'; }," },
    { file:'index', expect:'numbers should read', find:"' —— 該跳的是 ' + (pa < pb ? a : b) + ' 號蛙。';", replace:"' —— 該跳的是 ' + (pa < pb ? b : a) + ' 號蛙。';" },
    /* 第 4 關：找公倍數 */
    { file:'index', expect:'common multiples up to 36', find:'var GAME_STRIP = [[3, 4], [6, 9],', replace:'var GAME_STRIP = [[4, 9], [6, 9],' },
    { file:'index', expect:'the LCM is the bigger number', find:'var GAME_STRIP = [[3, 4], [6, 9],', replace:'var GAME_STRIP = [[3, 4], [6, 18],' },
    { file:'index', expect:'strip cells', find:'var STRIP_G = { cols:6, cell:46, pitch:50,', replace:'var STRIP_G = { cols:6, cell:46, pitch:44,' },
    { file:'index', expect:'stripBeyond() =', find:'f = (Math.floor(STRIP_N / m) + 1) * m; return [f, f + m]; }', replace:'f = (Math.floor(STRIP_N / m) + 2) * m; return [f, f + m]; }' },
    { file:'index', expect:'is not judged as', find:'          if (v % a === 0 && v % b === 0){', replace:'          if (v % a === 0 || v % b === 0){' },
    { file:'index', expect:'is false', find:"        if (v % a === 0) return v + ' = ' + a + ' × ' + (v / a) + '，是 ' + a + ' 的倍數；", replace:"        if (v % a === 0) return v + ' = ' + a + ' × ' + (v / a + 1) + '，是 ' + a + ' 的倍數；" },
    /* 第 5 關：裝袋子 */
    { file:'index', expect:'readInt("', find:"  function readInt(s){ s = String(s); return /^(0|[1-9]\\d{0,5})$/.test(s) ? +s : null; }", replace:"  function readInt(s){ s = String(s).trim(); return /^(0|[1-9]\\d{0,2})$/.test(s) ? +s : null; }" },
    { file:'index', expect:'not capped at 6', find:' inp.maxLength = 6;', replace:'' },
    { file:'index', expect:'GAME_W should be 300', find:'  var GAME_W = 300;', replace:'  var GAME_W = 320;' },
    { file:'index', expect:'STRIP_N should be 36', find:'  var STRIP_N = 36;', replace:'  var STRIP_N = 30;' },
    { file:'index', expect:'before every card is placed', find:'        if (done === n) roundSolved(', replace:'        if (done === 1) roundSolved(' },
    { file:'index', expect:'before every common multiple is found', find:'            if (found === want.length){', replace:'            if (found === 1){' },
    { file:'index', expect:'no tap-then-tap alternative (useTapSelect) for the cards', find:'      useTapSelect(B, function(P, pt){\n        var f = fingerOf(pt);\n        var t = dropTarget(', replace:'      B.onDrop = (function(P, pt){\n        var f = fingerOf(pt);\n        var t = dropTarget(' },
    { file:'index', expect:'for the tile cards', find:'      useTapSelect(B, function(P, pt){\n        var f = fingerOf(pt);\n        if (!nearestAny', replace:'      B.onDrop = (function(P, pt){\n        var f = fingerOf(pt);\n        if (!nearestAny' },
    { file:'index', expect:'not a silent reminder', find:'        if (k === null || k === 0){ roundInfo(d.gPackType); return; }', replace:'        if (k === null){ roundInfo(d.gPackType); return; }' },
    { file:'index', expect:'the pack verdicts', find:'        if (k < g){ roundMiss(d.gPackSmall(k, e.a, e.b, e.k)); return; }', replace:'' },
    { file:'index', expect:'the quiz question', find:"{ a:12, b:18, k:'fruit' }, { a:16, b:24, k:'pen' },", replace:"{ a:24, b:36, k:'fruit' }, { a:16, b:24, k:'pen' }," },
    { file:'index', expect:'more than 30 of one thing', find:"{ a:24, b:30, k:'card' }", replace:"{ a:24, b:32, k:'card' }" },
    { file:'index', expect:'is not 2~10', find:"{ a:15, b:25, k:'pen' },", replace:"{ a:15, b:22, k:'pen' }," },
    { file:'index', expect:'no item names', find:"{ a:15, b:25, k:'pen' },", replace:"{ a:15, b:25, k:'pens' }," },
    { file:'index', expect:'dots 0 and 1 overlap', find:'pileY:32, dot:9, step:12.6,', replace:'pileY:32, dot:9, step:8,' },
    { file:'index', expect:'bags 0 and 1 overlap', find:'bagW:52, bagH:56, bagDX:58,', replace:'bagW:52, bagH:56, bagDX:50,' },
    { file:'index', expect:'pack input row', find:'postX:158, postW:54,', replace:'postX:150, postW:54,' },
    { file:'index', expect:'singular/plural', find:"(a % k === 1 ? t[0].replace(/s$/, '') : t[0])", replace:"t[0]" },
    { file:'index', expect:'singular/plural', find:"(k === 1 ? ' bag shares' : ' bags share')", replace:"' bags share'" },
    { file:'index', expect:'numbers should read', find:"'都沒有 —— 袋數不會比 ' + s + ' 還多。';", replace:"'都沒有 —— 袋數不會比 ' + k + ' 還多。';" },
    /* 題庫與範例 */
    { file:'index', expect:'prime factorisation', find:'最大公因數是 12。\' },', replace:'最大公因數是 12（2²×3）。\' },' },
    { file:'index', expect:'factors of 24 listed', find:'24 的因數：1、2、3、4、6、8、12、24；', replace:'24 的因數：1、2、3、4、6、12、24；' },
    { file:'index', expect:'example 1', find:"' 餘 ' + r18 + '）→ ' + n + ' 不是公因數。'; },\n      gvOnly18", replace:"' 餘 ' + (r18 + 1) + '）→ ' + n + ' 不是公因數。'; },\n      gvOnly18" },
    { file:'index', expect:'is false', find:'24 = 3 × 8 = 4 × 6，也同時是 3 和 4 的倍數', replace:'24 = 3 × 8 = 4 × 7，也同時是 3 和 4 的倍數' },

    /* ---- review.html（2026-10-10 跑起來抓到的三類舊缺陷，與其他不變條件） ---- */
    { file:'review', expect:'copied straight out of the stem', find:'return common.indexOf(x) < 0 && x !== big; });\n    if (ncB.length)', replace:'return common.indexOf(x) < 0; });\n    if (ncB.length)' },
    { file:'review', expect:'copied straight out of the stem', find:'.filter(function(x){ return x > 0 && x !== k && x !== range; }).slice(0, 3));', replace:'.slice(0, 3));' },
    { file:'review', expect:'why quotes', find:'— and “together again” asks for the soonest one, the LCM.', replace:'— “next time” means the LCM.' },
    { file:'review', expect:'!= gcd', find:'        var common = commonFactorsOf(p.a, p.b);\n        var correct = common[common.length - 1];\n        var wrongs = buildGcfWrongs(p.a, p.b, common, correct);\n        var m = mixOpts(correct, wrongs);\n        return { a:p.a, b:p.b, common:common,', replace:'        var common = commonFactorsOf(p.a, p.b);\n        var correct = common[common.length - 2];\n        var wrongs = buildGcfWrongs(p.a, p.b, common, correct);\n        var m = mixOpts(correct, wrongs);\n        return { a:p.a, b:p.b, common:common,' },
    { file:'review', expect:'!= lcm', find:'  function lcm(a, b){ return a * b / gcd(a, b); }', replace:'  function lcm(a, b){ return a * b; }' },
    { file:'review', expect:'!= common factors', find:'        var correct = commonFactorsOf(p.a, p.b);\n        var fullA', replace:'        var correct = factorsOf(p.a);\n        var fullA' },
    { file:'review', expect:'factor list/count', find:'        var facs = factorsOf(n), c = facs.length;', replace:'        var facs = factorsOf(n), c = facs.length + 1;' },
    { file:'review', expect:'options are multiples', find:'if (cand > 0 && cand % k !== 0 && wrongs.indexOf(cand) < 0) wrongs.push(cand);', replace:'if (cand > 0 && wrongs.indexOf(cand) < 0) wrongs.push(cand + (wrongs.length ? 0 : k - 1));' },
    { file:'review', expect:'count of multiples', find:'        var c = Math.floor(range / k);', replace:'        var c = Math.ceil(range / k);' },
    { file:'review', expect:'above 600', find:'    var cand = [gcd(a, b), a * b, 2 * a, 2 * b, a + b];', replace:'    var cand = [gcd(a, b), 2 * a * b, 2 * a, 2 * b, a + b];' }
  ],

  sim: {
    INVARIANTS: {
      commonSet: d => {
        const want = cfRef(d.a, d.b).join();
        if (d.correct.join() !== want) return 'correct ' + d.correct.join() + ' != common factors ' + want;
        const keys = d.opts.map(o => o.slice().sort((x, y) => x - y).join());
        if (new Set(keys).size !== 4) return 'two options are the same set';
        for (let i = 0; i < 4; i++){
          const o = d.opts[i];
          if (!o.length || o.some((v, j) => !isInt(v) || v < 1 || (j && v <= o[j - 1]))) return 'option ' + o.join() + ' is not an increasing list of whole numbers';
          if (i !== d.ans && keys[i] === want) return 'a distractor is the right set';
        }
      },
      gcf: d => { if (d.correct !== gcdRef(d.a, d.b)) return 'correct ' + d.correct + ' != gcd ' + gcdRef(d.a, d.b); if (d.common.join() !== cfRef(d.a, d.b).join()) return 'common list wrong'; },
      lcm: d => { if (d.correct !== lcmRef(d.a, d.b)) return 'correct ' + d.correct + ' != lcm ' + lcmRef(d.a, d.b); },
      gcfWord: d => { if (d.correct !== gcdRef(d.a, d.b)) return 'correct != gcd'; if (d.common.join() !== cfRef(d.a, d.b).join()) return 'common list wrong'; },
      lcmWord: d => { if (d.correct !== lcmRef(d.a, d.b)) return 'correct != lcm'; },
      factorCount: d => { if (d.facs.join() !== divsRef(d.n).join() || d.c !== divsRef(d.n).length) return 'factor list/count of ' + d.n + ' wrong'; },
      /* 「哪一個是 k 的倍數」：剛好一個選項是 k 的倍數 */
      isMultiple: d => {
        if (d.c % d.k || d.q !== d.c / d.k) return d.c + ' is not k × q';
        const mult = d.opts.filter(o => o % d.k === 0);
        if (mult.length !== 1) return mult.length + ' options are multiples of ' + d.k;
      },
      multiplesCount: d => { if (d.c !== Math.floor(d.range / d.k)) return 'count of multiples of ' + d.k + ' up to ' + d.range + ' should be ' + Math.floor(d.range / d.k); }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'commonSet': return joinRef(cfRef(d.a, d.b), lang);
        case 'gcf': case 'gcfWord': return String(gcdRef(d.a, d.b));
        case 'lcm': case 'lcmWord': return String(lcmRef(d.a, d.b));
        case 'factorCount': return divsRef(d.n).length + (lang === 'zh' ? ' 個' : '');
        case 'isMultiple': return String(d.c);
        case 'multiplesCount': return Math.floor(d.range / d.k) + (lang === 'zh' ? ' 個' : '');
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    /* 範圍從這一課自己的題目推：數對都在 40 以內，所以公因數類的選項 ≤ 40；最小公倍數類的誘答有 a × b（忘了找更小的那一個），
       數對最大 20 × 30、14 × 21，所以 ≤ 600；因數個數 ≤ 12 ＋ 2；倍數題的數 ≤ 9 × 9 ＋ 6；1～50 裡倍數個數 ≤ 16 ＋ 2。 */
    optionOk: function(s, genId, lang){
      if (genId === 'commonSet'){
        const sep = lang === 'zh' ? '、' : ', ';
        const parts = s.split(sep);
        if (!parts.every(p => /^[1-9]\d*$/.test(p))) return 'option "' + s + '" is not a list of whole numbers joined by "' + sep + '"';
        if (parts.some(p => +p > 40)) return 'option "' + s + '" has a number above 40';
        return;
      }
      const unit = (genId === 'factorCount' || genId === 'multiplesCount') && lang === 'zh' ? ' 個' : '';
      if (unit && !s.endsWith(unit)) return 'option "' + s + '" should end with "個"';
      const t = unit ? s.slice(0, -unit.length) : s;
      if (!/^[1-9]\d*$/.test(t)) return 'option "' + s + '" is not a whole number ≥ 1';
      const n = +t, max = { gcf:40, gcfWord:40, lcm:600, lcmWord:600, factorCount:14, isMultiple:87, multiplesCount:18 }[genId];
      if (!(n <= max)) return 'option ' + n + ' above ' + max + ' for ' + genId;
    },
    /* 刻意的迷思誘答：「最大公因數就是較小的那個數」（qsBoost[1] 就是這個迷思）。只放行較小的那一個值 ——
       較大的那一個連較小的數都除不盡，是抄題，不放行。review.html 的 buildGcfWrongs() 各自獨立地說出同一件事。 */
    stemEchoOk: {
      gcf: (d, opt) => +opt === Math.min(d.a, d.b),
      gcfWord: (d, opt) => +opt === Math.min(d.a, d.b)
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「好朋友車站大挑戰」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GAME_W, GPICK, divs, commonDivs, gcfOf, lcmOf, regionOf, VENN_REGIONS, GAME_VENN, VENN_G, vennCards, vennSpot, vennTray, GAME_TILE, TILE_G, tileScale, tileFloor, GAME_HOP, HOP_G, hopX, GAME_STRIP, STRIP_N, STRIP_G, stripXY, stripBeyond, GAME_PACK, PACK_BAGMAX, PACK_G, packDotXY, packBagXY}',
    check: function(D, I18N, fail, src){
      if (D.GAME_W !== 300) fail('GAME_W should be 300 (the logical board width the phone scale is worked out from), got ' + D.GAME_W);
      if (D.STRIP_N !== 36) fail('STRIP_N should be 36 (a 6 × 6 grid, 2~3 common multiples per pair), got ' + D.STRIP_N);
      const W = 300;
      /* --- 0. 算式掃描器自己先證明會響 --- */
      PROBES.forEach(([t, good]) => {
        const r = scanEq(t);
        if (r.length < 1 || r.some(x => x.bad) === good) fail('scanEq() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
      });
      let eqCount = 0;
      const arith = (where, text) => { scanEq(text).forEach(e => { eqCount++; if (e.bad) fail(where + ': "' + e.text + '" — ' + e.bad); }); };
      /* 每一句：沒有 undefined/NaN、中文和數字之間有空格、數字照順序逐個比（want 給了才比）、算式算得對 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN|null|\[object/.test(text)) return fail(where + ': bad text: ' + text);
        if (/^zh/.test(where.split(' ').pop()) || / zh\b/.test(where)){ const g = text.replace(/<[^>]+>/g, '').match(/[一-鿿]\d|\d[一-鿿]/g); if (g) fail(where + ': missing space between Chinese and a digit: ' + g.join(' ')); }
        if (want){ const got = nums(text).join(); if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text); }
        arith(where, text);
      };

      /* --- 1. 每一條 I18N 靜態字串裡的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => arith(where, s)));
      const eqStatic = eqCount;
      if (eqStatic < 4) fail('only ' + eqStatic + ' equations found in the static I18N strings — the scan is not reading them');
      /* 題庫的解釋：列出來的因數／公因數要真的是那樣（qsAdv 的兩題原本用 2³×3 —— 那是六年級的質因數分解） */
      LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
        if (/[²³]|\^/.test(q.why + q.stem)) fail(bank + '[' + i + '] ' + L + ': uses powers / prime factorisation — that is grade 6 (短除法魔法梯), this lesson lists factors');
        const re = L === 'zh' ? /(\d+) 的因數：([\d、]+)/g : /[Ff]actors of (\d+): ([\d, ]+\d)/g;
        let m;
        while ((m = re.exec(q.why))){ const want = divsRef(+m[1]).join(); const got = nums(m[2]).join(); if (got !== want) fail(bank + '[' + i + '] ' + L + ': factors of ' + m[1] + ' listed as ' + got + ', should be ' + want); }
      })));
      /* 範例 1、2 的四句說明：每一個能點的數 */
      LANGS.forEach(L => {
        const d = I18N[L];
        for (let v = 1; v <= 20; v++){
          const a = 12 % v === 0, b = 18 % v === 0, q12 = Math.floor(12 / v), r12 = 12 % v, q18 = Math.floor(18 / v), r18 = 18 % v;
          const t = a && b ? d.gvBoth(v, q12, q18) : a ? d.gvOnly12(v, q12, q18, r18) : b ? d.gvOnly18(v, q12, r12, q18) : d.gvNeither(v, q12, r12, q18, r18);
          seq('example 1 v=' + v + ' ' + L, t);
        }
        for (let v = 1; v <= 48; v++){
          const a = v % 4 === 0, b = v % 6 === 0, q4 = Math.floor(v / 4), r4 = v % 4, q6 = Math.floor(v / 6), r6 = v % 6;
          const t = a && b ? d.mvBoth(v, q4, q6) : a ? d.mvOnly4(v, q4, q6, r6) : b ? d.mvOnly6(v, q4, r4, q6) : d.mvNeither(v, q4, r4, q6, r6);
          seq('example 2 v=' + v + ' ' + L, t);
        }
      });

      /* --- 2. 小遊戲：順序、每一關都有題目、提示 --- */
      const TYPES = ['venn', 'tile', 'hop', 'strip', 'pack'];
      if (D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, the tile question, 2, 2 + fact 3, the bag question), got ' + D.GAME_ORDER.join());
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d, ask\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      /* ⚠️ need() 是字面掃描：證明那一行寫著，證明不了它會被執行 —— 寫在註解裡的同一行也會通過。
         codex 第二～四輪試過先拿掉註解：正規式版會吃掉字串、手寫的 lexer 分不清 return /re/ 與除號、樣板字串裡的 ${}，
         三輪各有新洞，而這個 repo 不放外部依賴（沒有 acorn）。所以不再假裝擋得住：這幾條規則的「行為」由
         teaching-workspace/game-harness/g5-common-factor 的端對端測試（body.js）執行頁面來驗；其中主要的幾條（放錯框、地磚太小、
         跳前面那隻、點錯格、太多袋／打 0、托盤沒洗牌、點選、舊畫板）各有一個改壞頁面（broken-*.html），在 8 個組合裡都 FAIL
         （broken-final.log）。沒有改壞頁面的幾條（完成條件、GPICK 尺寸、maxLength、超前模式提示…）只有這裡的字面掃描與 e2e 的正常流程。
         所以 need() 的訊息一律寫成「原始碼裡找不到這個寫法」，不是「行為錯了」。 */
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(k === '*' ? src : (B[k] || ''))) fail(k + ': expected source pattern not found — ' + what); };
      LANGS.forEach(L => TYPES.forEach(t => { if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t].length > 20)) fail('gHints.' + t + ' missing in ' + L); }));
      ['GAME_VENN', 'GAME_TILE', 'GAME_HOP', 'GAME_STRIP', 'GAME_PACK'].forEach(k => { if (!Array.isArray(D[k]) || D[k].length < 4) fail(k + ' should be a pool of at least 4 entries'); });

      /* 數論函式：頁面的列舉 vs 輾轉相除，1～60 每一對 */
      for (let a = 1; a <= 60; a++){
        if (D.divs(a).join() !== divsRef(a).join()) { fail('divs(' + a + ') = ' + D.divs(a).join()); break; }
        for (let b = 1; b <= 60; b++){
          if (D.commonDivs(a, b).join() !== cfRef(a, b).join() || D.gcfOf(a, b) !== gcdRef(a, b) || D.lcmOf(a, b) !== lcmRef(a, b)){ fail('commonDivs/gcfOf/lcmOf(' + a + ', ' + b + ') disagree with Euclid'); a = 99; break; }
          for (let v = 1; v <= 60; v++){
            const want = a % v === 0 && b % v === 0 ? 'both' : a % v === 0 ? 'a' : b % v === 0 ? 'b' : null;
            if (D.regionOf(a, b, v) !== want){ fail('regionOf(' + a + ', ' + b + ', ' + v + ') = ' + D.regionOf(a, b, v) + ', should be ' + want); a = 99; b = 99; break; }
          }
        }
      }

      /* 版面小工具 */
      const scale = Math.min(1.5, 290 / W);   /* 375px 手機上卡片內寬約 290px（實際量測在端對端測試裡） */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const box = (x, y, w, h) => ({ x, y, w, h });
      const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W + 1e-9 && o.y + o.h <= H + 1e-9)) fail(what + ' ' + JSON.stringify(o) + ' is outside the ' + W + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const sq = (c, w, h) => box(c.x - w / 2, c.y - (h === undefined ? w : h) / 2, w, h === undefined ? w : h);
      tooSmall('GPICK ' + D.GPICK, D.GPICK);

      /* --- 第 1 關：分一分 --- */
      {
        const G = D.VENN_G;
        if (D.VENN_REGIONS.join() !== 'a,both,b') fail('venn: the boxes should be a only / both / b only (top to bottom)');
        D.GAME_VENN.forEach(([a, b], i) => {
          const w = 'GAME_VENN[' + i + '] ' + a + '/' + b;
          const union = [...new Set(divsRef(a).concat(divsRef(b)))].sort((x, y) => x - y);
          if (D.vennCards(a, b).join() !== union.join()) fail(w + ': vennCards() = ' + D.vennCards(a, b).join() + ', should be every factor of either once: ' + union.join());
          if (union.length > G.trayX.length * G.trayY.length) fail(w + ': ' + union.length + ' cards do not fit the tray');
          const per = { a:0, both:0, b:0 };
          union.forEach(v => { per[a % v === 0 && b % v === 0 ? 'both' : a % v === 0 ? 'a' : 'b']++; });
          ['a', 'both', 'b'].forEach(k => { if (per[k] < 1 || per[k] > 4) fail(w + ': the ' + k + ' box gets ' + per[k] + ' cards (needs 1~4: one row of four spots)'); });
          if (per.both < 2) fail(w + ': only 1 in common — the middle box would just be "1"');
          if (a === b) fail(w + ': the two numbers are equal');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' ask ' + L, d.gVennAsk(a, b), [a, b]);
            seq(w + ' label a ' + L, d.gVennLbl('a', a, b), [a]); seq(w + ' label both ' + L, d.gVennLbl('both', a, b), [a, b]); seq(w + ' label b ' + L, d.gVennLbl('b', a, b), [b]);
            seq(w + ' trail ' + L, d.gVennNow(2, union.length), [2, union.length]);
            union.forEach(v => {
              const rg = a % v === 0 && b % v === 0 ? 'both' : a % v === 0 ? 'a' : 'b';
              const dv = (n) => n % v ? [n, v, Math.floor(n / v), n % v] : [n, v, n / v];
              seq(w + ' ok ' + v + ' ' + L, d.gVennOk(a, b, v, rg), rg === 'both' ? [v].concat(dv(a), dv(b)) : (rg === 'a' ? [v, a].concat(dv(a), [b], dv(b)) : [v, b].concat(dv(b), [a], dv(a))));
              seq(w + ' hint2 ' + v + ' ' + L, d.gVenn2(a, b, v), [v].concat(dv(a), dv(b)));
              ['a', 'both', 'b'].filter(bin => bin !== rg).forEach(bin => {
                const t = d.gVennWhy(a, b, v, bin);
                let want;
                if (bin === 'both'){ const n = a % v ? a : b; want = dv(n).concat([v, n]); }
                else { const n = bin === 'a' ? a : b, o = bin === 'a' ? b : a; want = n % v ? dv(n).concat([v, n]) : [v, o].concat(dv(o), [n]); }
                seq(w + ' why ' + v + '→' + bin + ' ' + L, t, want);
                /* 只說「為什麼不是這一框」：不可以說出它屬於哪一框的字 */
                if (L === 'zh' && /放中間|放上面|放下面/.test(t)) fail(w + ': the reason names where the card goes: ' + t);
              });
            });
            const cf = cfRef(a, b);
            seq(w + ' done ' + L, d.gVennDone(a, b, D.commonDivs(a, b), Math.min(a, b)), [a, b].concat(cf, [cf[cf.length - 1], 1, Math.min(a, b)]));
          });
        });
        /* 三個框由上到下排、不重疊、中間有縫；每一框四個位置在框裡、在標籤右邊、互不重疊；托盤在框的下面 */
        const bins = G.binY.map(y => box(0, y, W, G.binH));
        bins.forEach((b, i) => inside(b, 'venn box ' + i, G.H));
        for (let i = 0; i + 1 < bins.length; i++) if (!(bins[i + 1].y - (bins[i].y + G.binH) >= 2)) fail('venn: boxes ' + i + ' and ' + (i + 1) + ' have no visible gap');
        bins.forEach((bx, bi) => {
          const lbl = box(G.lblX, bx.y + 3, G.lblW, G.binH - 6);
          const spots = [0, 1, 2, 3].map(j => sq(D.vennSpot(bi, j), D.GPICK));
          spots.forEach((s, j) => { if (!(s.x >= bx.x && s.x + s.w <= bx.x + bx.w && s.y >= bx.y && s.y + s.h <= bx.y + bx.h)) fail('venn: spot ' + j + ' of box ' + bi + ' sticks out of the box'); if (hit(s, lbl)) fail('venn: spot ' + j + ' of box ' + bi + ' covers the label'); });
          noHits(spots, 'venn: spots of box ' + bi);
        });
        const tray = [];
        for (let i = 0; i < G.trayX.length * G.trayY.length; i++) tray.push(sq(D.vennTray(i), D.GPICK));
        tray.forEach((t, i) => { inside(t, 'venn tray ' + i, G.H); if (t.y < bins[2].y + G.binH) fail('venn tray ' + i + ' overlaps the boxes'); });
        noHits(tray, 'venn tray');
        need('venn', /if \(t\.rg !== P\.data\.rg\)\{ roundMiss\(d\.gVennWhy\(a, b, P\.data\.v, t\.rg\)\); return false; \}/, 'a card in the wrong box is not refused with gVennWhy()');
        need('venn', /shuffle\(cards\)\.map\(/, 'the tray is not shuffled');
        need('venn', /useTapSelect\(B, function\(P, pt\)\{/, 'no tap-then-tap alternative (useTapSelect) for the cards');
        need('venn', /if \(done === n\) roundSolved\(/, 'the round can end before every card is placed');
        need('venn', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:h\.x, cy:h\.y,/, 'the cards are not GPICK × GPICK at vennTray()');
        need('venn', /data:\{ v:v, rg:regionOf\(a, b, v\) \}/, 'a card\'s box is not regionOf(a, b, v)');
        need('venn', /roundSolved\(d\.gVennDone\(a, b, commonDivs\(a, b\), Math\.min\(a, b\)\)\)/, 'the finishing sentence is not given the common factors and the SMALLER number');
      }

      /* --- 第 2 關：鋪地磚 --- */
      {
        const G = D.TILE_G;
        D.GAME_TILE.forEach((e, i) => {
          const w = 'GAME_TILE[' + i + '] ' + e.L + '×' + e.W, g = gcdRef(e.L, e.W);
          if (!(e.L > e.W)) fail(w + ': the length should be the longer side');
          if (e.cards.length !== 4 || new Set(e.cards).size !== 4) fail(w + ': needs four different cards');
          const fits = k => e.L % k === 0 && e.W % k === 0;
          if (e.cards.filter(k => k === g).length !== 1) fail(w + ': the GCF ' + g + ' must be a card exactly once');
          if (!e.cards.some(k => fits(k) && k < g)) fail(w + ': no smaller common factor (a card that covers it but is not the biggest)');
          const one = e.cards.filter(k => !fits(k));
          if (one.length !== 2 || one.some(k => (e.L % k === 0) === (e.W % k === 0))) fail(w + ': the two wrong cards must each divide exactly ONE side (' + one.join() + ')');
          if (e.cards.some(k => k > e.W)) fail(w + ': a card is wider than the floor — the reason "W ÷ k = 0 r W" makes no sense');
          if (g < 2) fail(w + ': the GCF is 1 — every tile would be 1 cm');
          /* 只有最大公因數會過關（照頁面的判斷順序：鋪不滿 → 鋪得滿但比最大公因數小 → 過關） */
          e.cards.forEach(k => { const pass = !(e.L % k || e.W % k) && !(k < D.gcfOf(e.L, e.W)); if (pass !== (k === g)) fail(w + ': card ' + k + ' ' + (pass ? 'passes' : 'is refused') + ' by the page\'s rule'); });
          /* 地板照比例、在畫板裡；1 公分的地磚也看得到（≥ 8px） */
          const F = D.tileFloor(e), s = Math.min(G.floorW / e.L, G.floorH / e.W);
          if (Math.abs(F.s - s) > 1e-9 || Math.abs(F.w - e.L * s) > 1e-9 || Math.abs(F.h - e.W * s) > 1e-9) fail(w + ': tileFloor() is not drawn to scale');
          inside(box(F.x, F.y, F.w, F.h), w + ' floor', G.H);
          if (F.x < G.sideW + 1) fail(w + ': the floor overlaps the width label');
          if (Math.min.apply(null, e.cards) * s < 8) fail(w + ': the smallest tile is ' + (Math.min.apply(null, e.cards) * s).toFixed(1) + 'px — too small to see');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' ask ' + L, d.gTileAsk(e.L, e.W), [e.L, e.W]);
            e.cards.forEach(k => {
              if (!fits(k)){
                const want = [];
                if (e.L % k) want.push(e.L, k, Math.floor(e.L / k), e.L % k, e.L % k);
                if (e.W % k) want.push(e.W, k, Math.floor(e.W / k), e.W % k, e.W % k);
                seq(w + ' why ' + k + ' ' + L, d.gTileWhy(e.L, e.W, k), want.concat([k]));
              } else if (k < g) seq(w + ' small ' + k + ' ' + L, d.gTileSmall(e.L, e.W, k), [k, e.L, k, e.L / k, e.W, k, e.W / k]);
            });
            seq(w + ' done ' + L, d.gTileDone(e.L, e.W, g), [g, e.L, g, e.L / g, e.W, g, e.W / g, e.L / g, e.W / g, (e.L / g) * (e.W / g), g, e.L, e.W]);
            seq(w + ' hint2 ' + L, d.gTile2(e.L, e.W, D.commonDivs(e.L, e.W)), [e.L, e.W].concat(cfRef(e.L, e.W)));
            seq(w + ' tried ' + L, d.gTileTried([e.cards[1], e.cards[2]]), [e.cards[1], e.cards[2]]);
          });
        });
        const cards = G.trayX.map(x => box(x - G.cardW / 2, G.trayY - G.cardH / 2, G.cardW, G.cardH));
        cards.forEach((c, i) => { inside(c, 'tile card ' + i, G.H); if (c.y < G.floorY + G.floorH) fail('tile card ' + i + ' overlaps the floor area'); });
        noHits(cards, 'tile cards');
        tooSmall('a tile card', Math.min(G.cardW, G.cardH));
        need('tile', /if \(e\.L % k \|\| e\.W % k\)\{ roundMiss\(d\.gTileWhy\(e\.L, e\.W, k\)\); return false; \}\n {8}if \(k < g\)\{ roundMiss\(d\.gTileSmall\(e\.L, e\.W, k\)\); return false; \}/, 'the two refusals (does not cover / not the biggest) are not in that order');
        need('tile', /shuffle\(e\.cards\)\.forEach\(/, 'the tile cards are not shuffled');
        need('tile', /useTapSelect\(B, function\(P, pt\)\{/, 'no tap-then-tap alternative (useTapSelect) for the tile cards');
        need('tile', /lay\(k\);\n {8}if \(e\.L % k/, 'the floor is not laid with the card before it is judged (the picture must show why)');
      }

      /* --- 第 3 關：青蛙跳 --- */
      {
        const G = D.HOP_G;
        D.GAME_HOP.forEach(([a, b], i) => {
          const w = 'GAME_HOP[' + i + '] ' + a + '/' + b, m = lcmRef(a, b);
          if (a === b || m === Math.max(a, b)) fail(w + ': the LCM is one of the two numbers — the frogs would meet at the first hop');
          /* 照規則跳：只有落後的那一隻可以跳；兩種起跳順序都跳完 */
          [0, 1].forEach(first => {
            const pos = [0, 0], hop = [a, b]; let steps = 0, meet = null, firstHop = true;
            while (steps++ < 200){
              const i2 = pos[0] === pos[1] ? (firstHop ? first : 0) : (pos[0] < pos[1] ? 0 : 1);
              pos[i2] += hop[i2]; firstHop = false;
              if (pos[0] === pos[1]){ meet = pos[0]; break; }
            }
            if (meet !== m) fail(w + ': starting with frog ' + hop[first] + ' the frogs first meet on ' + meet + ', not the LCM ' + m);
          });
          /* 數線：一跳 ≥ 數字框寬＋2，數字不會疊在一起；相遇的地方不在線的盡頭；青蛙與數字都在畫板裡 */
          [a, b].forEach(h => { const px = D.hopX(h, m) - D.hopX(0, m); if (!(px >= G.numW + 2)) fail(w + ': one hop of ' + h + ' is ' + px.toFixed(1) + 'px — the numbers under the line overlap'); });
          if (Math.abs(D.hopX(2 * m, m) - (G.x0 + G.len)) > 1e-9) fail(w + ': the line should end at 2 × the LCM');
          G.laneY.forEach((y, li) => {
            inside(box(D.hopX(0, m) - G.frog / 2, y - G.frogUp - G.frog, G.frog, G.frog), w + ' frog at 0, lane ' + li, G.H);
            inside(box(D.hopX(m, m) - G.frog / 2, y - G.frogUp - G.frog, G.frog, G.frog), w + ' frog at the LCM, lane ' + li, G.H);
            inside(box(D.hopX(m, m) - G.numW / 2, y + G.numY, G.numW, G.numH), w + ' number under the LCM, lane ' + li, G.H);
            inside(box(D.hopX(0, m) - G.numW / 2, y + G.numY, G.numW, G.numH), w + ' number under 0, lane ' + li, G.H);
          });
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' ask ' + L, d.gHopAsk(a, b), [a, a, b, b, 0]);
            seq(w + ' done ' + L, d.gHopDone(a, b, m), [m, m, a, m / a, b, m / b, m, a, b]);
            [a, b].forEach(h => seq(w + ' lane ' + h + ' ' + L, d.gHopLbl(h), [h, h]));
            for (let pa = 0; pa < m; pa += a) for (let pb = 0; pb < m; pb += b){
              seq(w + ' trail ' + L, d.gHopNow(a, pa, b, pb), [a, pa, b, pb]);
              const h2 = d.gHop2(a, pa, b, pb);
              seq(w + ' hint2 ' + pa + '/' + pb + ' ' + L, h2, pa === pb ? [pa] : [a, pa, b, pb, pa < pb ? a : b]);
              if (pa > pb) seq(w + ' why ' + L, d.gHopWhy(a, pa, b, pb), [a, pa, b, pb]);
              if (pb > pa) seq(w + ' why ' + L, d.gHopWhy(b, pb, a, pa), [b, pb, a, pa]);
              if (pa <= pb) seq(w + ' ok ' + L, d.gHopOk(a, pa, pa + a), [a, pa, a, pa + a]);
              if (pb <= pa) seq(w + ' ok b ' + L, d.gHopOk(b, pb, pb + b), [b, pb, b, pb + b]);
            }
          });
        });
        const lanes = G.laneY;
        if (!(lanes[0] + G.numY + G.numH <= lanes[1] - G.lblUp)) fail('hop: the numbers under lane 1 run into lane 2\'s label');
        if (!(lanes[0] - G.lblUp + G.lblH <= lanes[0] - G.frogUp - G.frog && lanes[1] - G.lblUp + G.lblH <= lanes[1] - G.frogUp - G.frog)) fail('hop: a lane label overlaps its frog');
        if (lanes[0] - G.lblUp < 0 || lanes[1] + G.numY + G.numH > G.H) fail('hop: the lanes do not fit the board');
        tooSmall('a frog', G.frog);
        need('hop', /if \(pos\[i\] > pos\[j\]\)\{ roundMiss\(d\.gHopWhy\(hop\[i\], pos\[i\], hop\[j\], pos\[j\]\)\); return; \}\n {8}var from = pos\[i\];\n {8}pos\[i\] \+= hop\[i\];/, 'the frog ahead is not refused before it hops');
        need('hop', /var meet = pos\[0\] === pos\[1\];/, 'the round does not end when the frogs share a square');
        need('hop', /if \(meet\)\{[\s\S]*?roundSolved\(d\.gHopDone\(hop\[0\], hop\[1\], pos\[0\]\)\);/, 'meeting does not solve the round');
      }

      /* --- 第 4 關：找公倍數 --- */
      {
        const G = D.STRIP_G, N = 36;
        D.GAME_STRIP.forEach(([a, b], i) => {
          const w = 'GAME_STRIP[' + i + '] ' + a + '/' + b, m = lcmRef(a, b), want = [];
          for (let v = m; v <= N; v += m) want.push(v);
          const mine = []; for (let v = 1; v <= N; v++) if (v % a === 0 && v % b === 0) mine.push(v);
          if (mine.join() !== want.join()) fail(w + ': the common multiples are not the multiples of the LCM?');
          if (want.length < 2 || want.length > 3) fail(w + ': ' + want.length + ' common multiples up to ' + N + ' (want 2~3: at least one after the LCM)');
          if (m === Math.max(a, b)) fail(w + ': the LCM is the bigger number');
          const f = (Math.floor(N / m) + 1) * m;
          if (D.stripBeyond(a, b).join() !== [f, f + m].join()) fail(w + ': stripBeyond() = ' + D.stripBeyond(a, b).join() + ', should be ' + f + ',' + (f + m));
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' ask ' + L, d.gStripAsk(a, b, N), L === 'zh' ? [1, N, a, b] : [a, b, 1, N]);
            seq(w + ' done ' + L, d.gStripDone(a, b, N, want, m, [f, f + m]), L === 'zh' ? [N, a, b].concat(want, [m, f, f + m]) : [a, b, N].concat(want, [m, N, f, f + m]));
            seq(w + ' hint2 ' + L, d.gStrip2(m), [m, m]);
            seq(w + ' trail ' + L, d.gStripNow(1, want.length), [1, want.length]);
            for (let v = 1; v <= N; v++){
              if (v % a === 0 && v % b === 0){ seq(w + ' ok ' + v + ' ' + L, d.gStripOk(v, a, b), [v, a, v / a, b, v / b]); continue; }
              const t = d.gStripWhy(v, a, b);
              const want2 = v % a === 0 ? [v, a, v / a, a, v, b, Math.floor(v / b), v % b, b]
                          : v % b === 0 ? [v, b, v / b, b, v, a, Math.floor(v / a), v % a, a]
                          : [v, a, Math.floor(v / a), v % a, v, b, Math.floor(v / b), v % b];
              seq(w + ' why ' + v + ' ' + L, t, want2);
            }
          });
        });
        const cells = [];
        for (let v = 1; v <= N; v++){ const p = D.stripXY(v); cells.push(box(p.x, p.y, G.cell, G.cell)); }
        cells.forEach((c, i) => inside(c, 'strip cell ' + (i + 1), G.H));
        noHits(cells, 'strip cells');
        for (let v = 2; v <= N; v++){ const p = D.stripXY(v), q = D.stripXY(v - 1); if (!(p.y > q.y || (p.y === q.y && p.x > q.x))) fail('strip: cell ' + v + ' is not after cell ' + (v - 1) + ' in reading order'); }
        tooSmall('a strip cell', G.cell);
        need('strip', /if \(v % a === 0 && v % b === 0\)\{/, 'a tapped cell is not judged as "a multiple of both"');
        need('strip', /roundMiss\(d\.gStripWhy\(v, a, b\)\);/, 'a wrong cell is not refused with gStripWhy()');
        need('strip', /if \(found === want\.length\)\{/, 'the round can end before every common multiple is found');
      }

      /* --- 第 5 關：裝袋子 --- */
      {
        const G = D.PACK_G;
        let readInt = null;
        const rsrc = extractFunction(src, 'readInt');
        if (!rsrc) fail('cannot find readInt() in index.html');
        else { try { readInt = new Function(rsrc + '\nreturn readInt;')(); } catch (e){ fail('readInt() could not be evaluated: ' + e.message); } }
        if (readInt) [['6', 6], [' 6 ', null], ['6 ', null], ['12', 12], ['0', 0], ['06', null], ['3 4', null], ['2.5', null], ['', null], ['abc', null], ['-3', null], ['1000', 1000], ['999999', 999999], ['６', null]]
          .forEach(([s, want]) => { if (readInt(s) !== want) fail('readInt("' + s + '") = ' + readInt(s) + ', should be ' + want); });
        D.GAME_PACK.forEach((e, i) => {
          const w = 'GAME_PACK[' + i + '] ' + e.a + '/' + e.b, g = gcdRef(e.a, e.b), s = Math.min(e.a, e.b), cf = cfRef(e.a, e.b);
          if (e.a === 24 && e.b === 36) fail(w + ': this is the quiz question (qsAdv[0]) — the game should not hand out its answer');
          if (!(g >= 2 && g <= D.PACK_BAGMAX)) fail(w + ': the GCF ' + g + ' is not 2~' + D.PACK_BAGMAX + ' (the bags are drawn)');
          if (e.a > 30 || e.b > 30) fail(w + ': more than 30 of one thing — the pile is three rows of ten');
          if (e.a / g < 2 || e.b / g < 2) fail(w + ': a bag would hold just one of something');
          const missing = LANGS.filter(L => !(I18N[L].gPackItems && I18N[L].gPackItems[e.k]));
          if (missing.length){ fail(w + ': no item names for "' + e.k + '" in ' + missing.join('/') + ' — its sentences cannot be built'); return; }
          /* 照頁面的判斷順序，1～60 每一個打得出來的袋數 */
          for (let k = 1; k <= 60; k++){
            const verdict = k > s ? 'tooMany' : (e.a % k || e.b % k) ? 'left' : k < D.gcfOf(e.a, e.b) ? 'small' : 'done';
            if ((verdict === 'done') !== (k === g)) fail(w + ': ' + k + ' bags ends as "' + verdict + '"');
            LANGS.forEach(L => {
              const d = I18N[L], wh = w + ' k=' + k + ' ' + L;
              if (verdict === 'tooMany') seq(wh, d.gPackTooMany(k, e.a, e.b, e.k), L === 'zh' ? [s, k, 1, s] : [s, k, s]);
              else if (verdict === 'left'){
                const want = [];
                if (e.a % k) want.push(e.a, k, Math.floor(e.a / k), e.a % k, e.a % k);
                if (e.b % k) want.push(e.b, k, Math.floor(e.b / k), e.b % k, e.b % k);
                seq(wh, d.gPackLeft(k, e.a, e.b, e.k), want.concat([k]));
              } else if (verdict === 'small') seq(wh, d.gPackSmall(k, e.a, e.b, e.k), [k, e.a / k, e.b / k]);
              else seq(wh, d.gPackDone(e.a, e.b, e.k, D.commonDivs(e.a, e.b)), [g, e.a / g, e.b / g, e.a, e.b].concat(cf, [g]));
              if (L === 'en'){
                const t = verdict === 'small' ? d.gPackSmall(k, e.a, e.b, e.k) : verdict === 'left' ? d.gPackLeft(k, e.a, e.b, e.k) : '';
                if (/\b1 bags\b|\b1 (apples|oranges|pencils|erasers|stickers|cards)\b|\b([2-9]|\d\d+) (apple|orange|pencil|eraser|sticker|card) /.test(t)) fail(wh + ': singular/plural: ' + t);
              }
            });
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' ask ' + L, d.gPackAsk(e.a, e.b, e.k), [e.a, e.b]);
            seq(w + ' pile ' + L, d.gPackPile(e.a, e.k, 0) + ' / ' + d.gPackPile(e.b, e.k, 1), [e.a, e.b]);
            seq(w + ' hint2 ' + L, d.gPack2(e.a, e.b, D.commonDivs(e.a, e.b)), [e.a, e.b].concat(cf));
          });
          /* 點：一排十個、在自己那一堆的範圍裡、不疊、不碰到標籤與輸入那一排 */
          [e.a, e.b].forEach((n, side) => {
            const dots = [];
            for (let j = 0; j < n; j++){ const p = D.packDotXY(j, side); dots.push(sq(p, G.dot)); }
            noHits(dots, w + ' pile ' + side + ' dots');
            dots.forEach((dd, j) => { inside(dd, w + ' dot ' + j, G.H); if (dd.y < G.lblY + G.lblH || dd.y + dd.h > G.rowY || dd.x < G.pileX[side] || dd.x + dd.w > G.pileX[side] + 10 * G.step + 1e-9) fail(w + ' pile ' + side + ' dot ' + j + ' leaves its pile'); });
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          seq('gPackTried ' + L, d.gPackTried([4, 3]), [4, 3]);
          if (d.gPackTried([]) !== '') fail('gPackTried([]) should be empty in ' + L);
          if (typeof d.gPackType !== 'string' || !d.gPackType) fail('gPackType missing in ' + L);
          if (typeof d.gPackAria !== 'string' || !d.gPackAria || /\?/.test(d.gPackAria)) fail('gPackAria (the input box label) missing or a placeholder in ' + L);
        });
        for (let k = 1; k <= D.PACK_BAGMAX; k++){
          const bags = []; for (let j = 0; j < k; j++) bags.push(sq(D.packBagXY(j), G.bagW, G.bagH));
          bags.forEach((bb, j) => { inside(bb, 'bag ' + j + ' of ' + k, G.H); if (bb.y < G.rowY + G.rowH) fail('bag ' + j + ' overlaps the input row'); });
          noHits(bags, k + ' bags');
        }
        const row = [box(G.preX, G.rowY, G.preW, G.rowH), box(G.inX, G.rowY, G.inW, G.rowH), box(G.postX, G.rowY, G.postW, G.rowH), box(G.btnX, G.rowY, G.btnW, G.rowH)];
        row.forEach((r, i) => inside(r, 'pack input row ' + i, G.H));
        noHits(row, 'pack input row');
        tooSmall('the input box', Math.min(G.inW, G.rowH)); tooSmall('the pack button', Math.min(G.btnW, G.rowH));
        need('pack', /inp\.maxLength = 6;/, 'the input box is not capped at 6 characters (readInt classifies up to 6 digits)');
        need('pack', /if \(k === null \|\| k === 0\)\{ roundInfo\(d\.gPackType\); return; \}/, 'a malformed or 0 entry is not a silent reminder');
        need('pack', /if \(k > Math\.min\(e\.a, e\.b\)\)\{ drawBags\(0\); roundMiss\(d\.gPackTooMany\(k, e\.a, e\.b, e\.k\)\); return; \}\n {8}if \(e\.a % k \|\| e\.b % k\)\{ drawBags\(0\); roundMiss\(d\.gPackLeft\(k, e\.a, e\.b, e\.k\)\); return; \}\n {8}drawBags\(k\);\n {8}if \(k < g\)\{ roundMiss\(d\.gPackSmall\(k, e\.a, e\.b, e\.k\)\); return; \}/, 'the pack verdicts are not tooMany → left → (draw) → small, in that order');
      }

      /* --- 共用的機制 --- */
      /* shuffle()：切出來跑 —— 是排列、不改輸入、有兩種以上的順序、由小到大的輸入一律不會原樣回來（托盤不可以一開始就排好） */
      {
        const ssrc = extractFunction(src, 'shuffle');
        let sh = null;
        if (!ssrc) fail('cannot find shuffle() in index.html');
        else { try { sh = new Function(ssrc + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated: ' + e.message); } }
        if (sh) for (let n = 2; n <= 10; n++){
          const input = []; for (let j = 1; j <= n; j++) input.push(j);
          const orders = new Set();
          for (let r = 0; r < 400; r++){
            const out = sh(input);
            if (input.join() !== Array.from({ length:n }, (_, j) => j + 1).join()){ fail('shuffle() changes its input'); break; }
            if (out.slice().sort((x, y) => x - y).join() !== input.join()){ fail('shuffle() is not a permutation'); break; }
            if (out.every((v, j) => !j || out[j - 1] < v)){ fail('shuffle() returned ' + n + ' cards already in order — the tray would start sorted'); break; }
            orders.add(out.join());
          }
          if (orders.size < Math.min(2, n - 1)) fail('shuffle() of ' + n + ' gives only ' + orders.size + ' order(s)');
        }
      }
      /* nearestAny()：切出來跑 —— 框裡的點一定給那一框；兩框之間的縫裡，給比較近的那一框（不是陣列裡第一個）；大框裡靠近小框的點給大框 */
      {
        const fsrc = extractFunction(src, 'nearestAny');
        let near = null;
        if (!fsrc) fail('cannot find nearestAny() in index.html');
        else { try { near = new Function(fsrc + '\nreturn nearestAny;')(); } catch (e){ fail('nearestAny() could not be evaluated: ' + e.message); } }
        if (near){
          const G = D.VENN_G;
          const bins = G.binY.map((y, id) => ({ id, cx:W / 2, cy:y + G.binH / 2, hw:W / 2, hh:G.binH / 2 }));
          let bad = 0;
          bins.forEach(b => { for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 1.5) for (let x = 1; x < W; x += 7){ const g = near(bins, { x, y }, 6); if (!g || g.id !== b.id) bad++; } });
          if (bad) fail('nearestAny(): ' + bad + ' points inside a venn box are given to another box (or none)');
          for (let i = 0; i + 1 < bins.length; i++){
            const top = G.binY[i] + G.binH, bottom = G.binY[i + 1];
            const g1 = near(bins, { x:150, y:bottom - (bottom - top) * 0.25 }, 6), g0 = near(bins, { x:150, y:top + (bottom - top) * 0.25 }, 6);
            if (!g1 || g1.id !== i + 1) fail('nearestAny(): a drop in the gap nearer the lower box ' + (i + 1) + ' is given to ' + (g1 && g1.id) + ' (first match instead of nearest?)');
            if (!g0 || g0.id !== i) fail('nearestAny(): a drop in the gap nearer the upper box ' + i + ' is given to ' + (g0 && g0.id));
          }
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42 }, { id:1, cx:155, cy:100, hw:12, hh:12 } ];
          const r0 = near(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestAny(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          if (near(bins, { x:150, y:G.binY[2] + G.binH + 7 }, 6) !== null) fail('nearestAny(): a drop 7 below the last box (pad 6) is accepted');
        }
      }
      /* dropTarget()：切出來跑 */
      {
        const fsrc = extractFunction(src, 'dropTarget');
        let dt = null;
        if (!fsrc) fail('cannot find dropTarget() in index.html');
        else { try { dt = new Function(fsrc + '\nreturn dropTarget;')(); } catch (e){ fail('dropTarget() could not be evaluated: ' + e.message); } }
        if (dt){
          const A = { id:'A', ok:true }, Bx = { id:'B', ok:false }, ok = t => t.ok;
          if (dt(Bx, A, ok) !== A) fail('dropTarget(): the finger in the right box does not win over the card centre in a wrong box');
          if (dt(A, Bx, ok) !== A) fail('dropTarget(): the card centre in the right box is not taken');
          if (dt(Bx, null, ok) !== Bx) fail('dropTarget(): a wrong box under the card centre is not reported (no reason would be shown)');
          if (dt(null, null, ok) !== null) fail('dropTarget(): a drop on empty space is not silent');
        }
      }
      /* 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0 */
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
        if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score');
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
        for (let n = 1; n <= 40; n++) for (let v = 1; v <= 40; v++){ seq('gDiv ' + L, I18N[L].gDiv(n, v), n % v ? [n, v, Math.floor(n / v), n % v] : [n, v, n / v]); }
      });
      need('*', /if \(gen !== gGen\) return;/, 'a card from an old board (Restart / language switch while held) can still act — the board-generation guard is gone');
      need('*', /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode does not show hint level 1 automatically');
      need('*', /gSolved = true;[\s\S]{0,300}elHint\.textContent = '';/, 'a solved round keeps a stale hint');
      if (eqCount - eqStatic < 2000) fail('only ' + (eqCount - eqStatic) + ' game-text equations checked — the game sentences are not being scanned');
    }
  }
};

module.exports._test = { scanEq, gcdRef, lcmRef, cfRef };
