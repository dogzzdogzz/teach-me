/* grade-5/math/polygon 的檢查設定（多邊形轉轉盤：正多邊形、內角和 (n − 2) × 180°、正多邊形的每一個角、扇形占整個圓的幾分之幾）。
   2026-10-11 新增 —— 和小遊戲「轉盤大師」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的十個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，不呼叫頁面的 fmt／reduceFrac）、
   選項的形狀與範圍；「從 n 邊形切成 n 個三角形」是刻意的迷思誘答，stemEchoOk 只放行那一個值。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）裡的算式逐條重算（lib/arith.js，度數 ° 當量詞）。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍，答案用這裡自己的幾何／算術重算：
       分一分 —— 每一種圖的頂點量出邊長與角度，自己判斷是不是正多邊形、差的是邊還是角；小記號要剛好說出哪幾條邊一樣長；
                 sortBoard() 3000 次：三正三不正、正的邊數不重複、一張只差角、一張只差邊；托盤 3000 次不出現「上一排全同一種」；
       切三角形 —— 每一個 n、每一種畫對角線的順序（全部排列）都照規則走完：每一步塊數 ＝ 線數 ＋ 1，最後 n − 2 個三角形、
                 每一塊都有紅點、面積加起來等於多邊形；cutPick 整片畫板逐點和這裡自己的「最近的頂點」比；
       每一個角 —— 每一個 n × 0～400 的每一個整數，judge 的分類、「太大／太小」都和這裡自己算的一致；打字的格式逐條驗；
       轉轉盤 —— 每一個 p/q × 每一格 15°～345°，說的分數、比大比小、「那只是 1 份」都成立；dialSnap／dialTap 整圈每 0.1° 驗；
       拼分數 —— 每一個 A × 數字卡 1～9 的每一對：只有最簡分數那一對收；說的角度、「除不盡」、「比一整個圓還多」都成立。
     每一句說明兩種語言逐個比數字、句子裡的算式逐條重算；shuffle()、nearestOpen()、roundMiss()、missOnce() 從原始碼切出來真的跑；
     版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；RENDER 裡「判斷的是放下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   刻意的 44px 例外：轉轉盤的「點圓周」每一格只管 15° 的一段（半徑 100 → 弧長約 26px，手機上約 25px），比 44px 窄 ——
   24 格排一圈，放寬就會蓋到隔壁那一格（每一格必須只對應它自己那一條刻度）。拿得起來的旋鈕是 48px、◀ ▶ 兩個按鈕各 48px，
   點圓周只是第三種做法。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   文字放不放得進框、375px 的實際尺寸、畫出來的圖和量出來的數字對不對，由 teaching-workspace/game-harness/g5-polygon 的端對端測試驗
   （合成 PointerEvent，從畫出來的圖讀數）。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const red = (n, d) => { const k = gcd(n, d); return (n / k) + '/' + (d / k); };
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const arith = makeArith({ units:['°', '個三角形'], unitsEn:['°', 'triangles'] });
const aNumRef = n => (n === 8 || n === 11 || n === 18 || (n >= 80 && n < 90)) ? 'an ' : 'a ';

/* 幾何（自己的實作，不呼叫頁面的） */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sidesOf = V => V.map((a, i) => dist(a, V[(i + 1) % V.length]));
const anglesOf = V => V.map((p, i) => {
  const a = V[(i + V.length - 1) % V.length], b = V[(i + 1) % V.length];
  const u = { x:a.x - p.x, y:a.y - p.y }, w = { x:b.x - p.x, y:b.y - p.y };
  return Math.acos(Math.max(-1, Math.min(1, (u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y))))) * 180 / Math.PI;
});
const spread = L => Math.max(...L) - Math.min(...L);
const areaOf = V => { let s = 0; for (let i = 0; i < V.length; i++){ const a = V[i], b = V[(i + 1) % V.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; };
const convexRef = V => { let s = 0; for (let i = 0; i < V.length; i++){ const a = V[i], b = V[(i + 1) % V.length], c = V[(i + 2) % V.length]; const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x); if (Math.abs(cr) < 1e-9) return false; if (!s) s = Math.sign(cr); else if (Math.sign(cr) !== s) return false; } return true; };
const regRef = (n, cx, cy, r) => Array.from({ length:n }, (_, k) => ({ x:cx + r * Math.cos(-Math.PI / 2 + 2 * Math.PI * k / n), y:cy + r * Math.sin(-Math.PI / 2 + 2 * Math.PI * k / n) }));

module.exports = {
  breaks: [
    /* ---- review.html：產生器 ---- */
    { file:'review', expect:'missing space between Chinese and a digit', find:"'正 ' + d.n + ' 邊形，每一個內角是多少度？'", replace:"'正' + d.n + '邊形，每一個內角是多少度？'" },
    { file:'review', expect:'misconception is not offered', find:"var m = mixOpts(c, [n, n - 1, n - 3 > 0 ? n - 3 : n + 1]);", replace:"var m = mixOpts(c, [n + 1, n - 1, n - 3 > 0 ? n - 3 : n + 2]);" },
    { file:'review', expect:'English article', find:"function aNum(n){ return (n === 8 || n === 11 || n === 18 || (n >= 80 && n < 90)) ? 'an ' : 'a '; }", replace:"function aNum(n){ return 'an '; }" },
    { file:'review', expect:'polygonSum', find:'var sum = (n - 2) * 180;\n        var m = mixOpts(sum, [n * 180,', replace:'var sum = (n - 1) * 180;\n        var m = mixOpts(sum, [n * 180,' },
    { file:'review', expect:'sectorFromFraction', find:"var m = mixOpts(item.deg, [forgetDivide, denAsDeg, otherDeg]);", replace:"var m = mixOpts(item.deg + 15, [forgetDivide, denAsDeg, otherDeg]);" },
    { file:'review', expect:'sectorRemaining', find:'var rem = 360 - deg;', replace:'var rem = 360 - deg - 30;' },
    { file:'review', expect:'option', find:"{frac:'1/12',deg:30}, {frac:'1/8',deg:45}", replace:"{frac:'1/12',deg:30}, {frac:'1/8',deg:4500}" },
    { file:'review', expect:'is not a fraction a/b', find:"[justFirst, justSecond].concat(sumR.den > 1 ? [sumStr] : [], [", replace:"[justFirst, justSecond].concat([sumStr], [" },

    /* ---- index.html：小遊戲「轉盤大師」的引擎與計分 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['sort', 'cut', 'each', 'dial', 'frac'];", replace:"var GAME_ORDER = ['cut', 'sort', 'each', 'dial', 'frac'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'shuffle(): only', find:'      var k = Math.floor(Math.random() * (j + 1));   /* 自足', replace:'      var k = j;   /* 自足' },
    { file:'index', expect:'scoring: a round should give', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'does not clear the hint', find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:'index', expect:'nearestOpen(): a point inside', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'not the first in the array', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestOpen(): a drop nearest to a finished slot', find:"    return best && !best.done ? best : null;\n  }\n", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n" },
    { file:'index', expect:'board generation', find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:'' },
    { file:'index', expect:'second finger', find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:'index', expect:'second finger can start a board tap', find:"      if (!e.isPrimary) return;   /* 第二根手指", replace:"      if (false) return;   /* 第二根手指" },
    { file:'index', expect:'losing pointer capture', find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:'' },
    { file:'index', expect:'placed pieces still catch taps', find:'  .gpiece.locked{cursor:default;pointer-events:none}', replace:'  .gpiece.locked{cursor:default}' },
    { file:'index', expect:'does not snap while it is dragged', find:"      if (o.snap){ var sp = o.snap({ x:orig.x + dx, y:orig.y + dy }); P.place(sp.x, sp.y); }", replace:"      if (false){ }" },
    { file:'index', expect:'ahead mode', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", replace:"    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式" },
    { file:'index', expect:'gets a viewBox', find:"    var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, 'aria-hidden':'true' });", replace:"    var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, viewBox:'0 0 ' + B.W + ' ' + B.H, 'aria-hidden':'true' });" },
    { file:'index', expect:'roundSolved() clean should take', find:'    gScore += pts; elScore.textContent = gScore;', replace:'    gScore -= pts; elScore.textContent = gScore;' },
    { file:'index', expect:'roundSolved() clean should take', find:'    gScore += pts; elScore.textContent = gScore;', replace:'    gScore += pts; elScore.textContent = gScore; gScore += pts;' },
    { file:'index', expect:'roundMiss() ends the round', find:'    gMistake = true;\n    var lost = gScore >= 5 ? 5 : 0;', replace:'    gMistake = true; if (gScore < 5) gSolved = true;\n    var lost = gScore >= 5 ? 5 : 0;' },
    { file:'index', expect:'sort: a placed card is not counted', find:'        bin.n++; done++;', replace:'        bin.n++;' },
    { file:'index', expect:'cut: a tap or drop away from every vertex is not silent', find:'        if (k === null || gSolved) return;', replace:'        if (gSolved) return;' },
    { file:'index', expect:'dial: the right angle does not lock', find:'        knob.lock(knob.cx, knob.cy);\n', replace:'' },
    { file:'index', expect:'frac: the right fraction does not solve the round', find:'          if (!bad){ roundSolved(d.gFracDone(A, a, b, g)); return true; }', replace:'          if (!bad){ return true; }' },
    { file:'index', expect:'frac: tapping a placed card does not take it back', find:"        slots.forEach(function(s){ if (s.P && Math.abs(pt.x - s.cx) <= s.hw && Math.abs(pt.y - s.cy) <= s.hh){ take(s); line.textContent = now(); } });", replace:'' },
    { file:'index', expect:'eachJudge(', find:"    if (x === E) return null;", replace:"    if (x === E || x > 5000) return null;" },
    { file:'index', expect:'roundNote', find:"  function roundNote(text){ gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }", replace:"  function roundNote(text){ roundMiss(text); }" },
    { file:'index', expect:'missOnce(): wrong A, B, A, A, B', find:"    if (seen.map[key]){ if (seen.last !== key || !gMsg.querySelector('.no')){ seen.last = key; roundAgain(text); } return; }", replace:"    if (seen.last === key) return;" },
    { file:'index', expect:'missOnce(): wrong A, B, A, A, B', find:"    if (seen.map[key]){ if (seen.last !== key || !gMsg.querySelector('.no')){ seen.last = key; roundAgain(text); } return; }", replace:"    if (seen.map[key]){ if (seen.last !== key || !gMsg.querySelector('.no')){ seen.last = key; roundMiss(text); } return; }" },
    { file:'index', expect:'a repeat after the reason was cleared re-explains it', find:"    if (seen.map[key]){ if (seen.last !== key || !gMsg.querySelector('.no')){ seen.last = key; roundAgain(text); } return; }", replace:"    if (seen.map[key]){ if (seen.last !== key){ seen.last = key; roundAgain(text); } return; }" },
    { file:'index', expect:'s6lead: the markup fallback', find:'<p class="lead" data-i18n="s6lead">分一分、切三角形', replace:'<p class="lead" data-i18n="s6lead">分一分，切三角形' },

    /* 第 1 關：分一分 */
    { file:'index', expect:'sort: the regular pool', find:'  var SORT_REG = [3, 4, 5, 6, 8];', replace:'  var SORT_REG = [3, 4, 5, 6, 6];' },
    { file:'index', expect:'sort rhombus', find:'      var w = 38 * Math.cos(Math.PI / 6), h = 38 * Math.sin(Math.PI / 6);', replace:'      var w = 38 * Math.cos(Math.PI / 4), h = 38 * Math.sin(Math.PI / 4);' },
    { file:'index', expect:'sort house', find:'      var a = 30, rh = a * Math.sqrt(3) / 2, y0 = (a + rh) / 2 - rh;', replace:'      var a = 30, rh = a * Math.sqrt(3) / 1.5, y0 = (a + rh) / 2 - rh;' },
    { file:'index', expect:'sort rect', find:"      var rr = P([[-32, -16], [32, -16], [32, 16], [-32, 16]]);", replace:"      var rr = P([[-24, -24], [24, -24], [24, 24], [-24, 24]]);" },
    { file:'index', expect:'sort hexalt', find:'      var len = [30, 12, 30, 12, 30, 12], x = 0, y = 0, q = [];', replace:'      var len = [21, 21, 21, 21, 21, 21], x = 0, y = 0, q = [];' },
    { file:'index', expect:'tick marks', find:"      return { pts:rr, ticks:[1, 2, 1, 2], right:[0, 1, 2, 3] };", replace:"      return { pts:rr, ticks:[1, 1, 1, 1], right:[0, 1, 2, 3] };" },
    { file:'index', expect:'tick marks', find:"    return { pts:ip, ticks:[1, 0, 1], right:[] };", replace:"    return { pts:ip, ticks:[1, 1, 1], right:[] };" },
    { file:'index', expect:'right-angle mark', find:"      return { pts:hp, ticks:all(hp, 1), right:[0, 4] };", replace:"      return { pts:hp, ticks:all(hp, 1), right:[0, 1] };" },
    { file:'index', expect:'sortWhy(', find:"    if (SORT_ODD.sides.indexOf(c.kind) >= 0) return 'sides';", replace:"    if (SORT_ODD.sides.indexOf(c.kind) >= 0) return 'angles';" },
    { file:'index', expect:'sortRefuse(', find:"  function sortRefuse(c, isReg){ return (c.kind === 'reg') === isReg ? null : sortWhy(c); }", replace:"  function sortRefuse(c, isReg){ return (c.kind === 'reg' || c.kind === 'rhombus') === isReg ? null : sortWhy(c); }" },
    { file:'index', expect:'sortBoard(): ', find:"    var odd = [a, s, pick(rest)].map(", replace:"    var odd = [a, pick(rest), pick(rest)].map(" },
    { file:'index', expect:'sortTray(): ', find:"    for (var i = 0; i < 100 && sortGrouped(t); i++) t = shuffle(cards);\n    if (sortGrouped(t)){ var x = t[2]; t[2] = t[3]; t[3] = x; }", replace:"" },
    { file:'index', expect:'position-only player', find:"    for (var i = 0; i < 100 && sortGrouped(t); i++) t = shuffle(cards);\n", replace:"" },
    { file:'index', expect:'sort: the boxes', find:'var SORT = { cardW:88, cardH:84, trayX:[52, 150, 248], trayY:[164, 256], binX:[4, 154],', replace:'var SORT = { cardW:88, cardH:84, trayX:[52, 150, 248], trayY:[164, 256], binX:[4, 174],' },
    { file:'index', expect:'sort: card', find:'var SORT = { cardW:88, cardH:84, trayX:[52, 150, 248], trayY:[164, 256],', replace:'var SORT = { cardW:88, cardH:84, trayX:[52, 150, 248], trayY:[150, 256],' },
    { file:'index', expect:'sort: the minis', find:'binH:106, lblH:50, miniS:40, miniGap:4, pad:8, area:1400,', replace:'binH:106, lblH:50, miniS:40, miniGap:9, pad:8, area:1400,' },
    { file:'index', expect:'gSortBad rect zh', find:"          rect: '這是長方形：4 個角都是直角，可是邊不是全部一樣長（長邊比短邊長）", replace:"          rect: '這是長方形：4 條邊一樣長，可是角不是全部一樣大（長邊比短邊長）" },
    { file:'index', expect:'gSortBad hexalt en', find:"          hexalt: 'All 6 angles of this hexagon are the same size, but its sides are long and short", replace:"          hexalt: 'All 5 angles of this hexagon are the same size, but its sides are long and short" },
    { file:'index', expect:'gSortBad reg3 zh', find:"if (why === 'reg') return '這是' + I18N.zh.polyName(n) + '：' + n + ' 條邊都一樣長，' + n + ' 個角也都一樣大", replace:"if (why === 'reg') return '這是' + I18N.zh.polyName(n) + '：' + n + ' 條邊都一樣長，' + (n - 1) + ' 個角也都一樣大" },
    { file:'index', expect:'gSortHint2 iso en', find:"          iso: 'only two sides are the same length, and the angles are not all the same size.'", replace:"          iso: 'all sides are the same length, and the angles are not all the same size.'" },
    { file:'index', expect:'must not say', find:"（兩個尖、兩個鈍）—— 角不全相等，不是正多邊形。", replace:"（兩個尖、兩個鈍）—— 角不相等，不是正多邊形。" },
    { file:'index', expect:'must not say', find:"          iso: 'only two sides are the same length, and the angles are not all the same size.'", replace:"          iso: 'only two sides are the same length, and the angles are not the same size.'" },
    { file:'index', expect:'size-only player', find:'    var k = Math.sqrt(SORT.area / (Math.abs(A) / 2)) * (c.s || 1);', replace:'    var k = 1;' },
    { file:'index', expect:'the card scale s depends on the answer', find:'    return regs.concat(odd).map(size);', replace:'    regs.forEach(function(c){ c.s = 1; }); odd.forEach(function(c){ c.s = SORT.sMin; }); return regs.concat(odd);' },
    { file:'index', expect:'gives the answer away', find:"fill:SHAPE_FILL, stroke:'#2B2A33', 'stroke-width':s < 1 ? 1.5 : 2.5, 'class':'gshp' }));", replace:"fill:c.kind === 'reg' ? '#E3F4EB' : '#FDF0E0', stroke:'#2B2A33', 'stroke-width':s < 1 ? 1.5 : 2.5, 'class':'gshp' }));" },
    { file:'index', expect:'gives the answer away', find:"fill:SHAPE_FILL, stroke:'#2B2A33', 'stroke-width':s < 1 ? 1.5 : 2.5, 'class':'gshp' }));", replace:"fill:SHAPE_FILL, stroke:sortWhy(c) === 'reg' ? '#2F9E69' : '#2B2A33', 'stroke-width':s < 1 ? 1.5 : 2.5, 'class':'gshp' }));" },
    { file:'index', expect:'sort: the box judged', find:"        var c = P.data.c, why = sortRefuse(c, bin.isReg);", replace:"        var c = P.data.c, why = sortRefuse(c, true);" },

    /* 第 2 關：切三角形 */
    { file:'index', expect:'cut: the pool', find:'  var GAME_CUT = [5, 6, 7, 8];', replace:'  var GAME_CUT = [5, 6, 7, 8, 4];' },
    { file:'index', expect:'cutRefuse(', find:"  function cutRefuse(n, k){ return k === 0 ? 'self' : (k === 1 || k === n - 1 ? 'side' : null); }", replace:"  function cutRefuse(n, k){ return k === 0 ? 'self' : (k === 1 ? 'side' : null); }" },
    { file:'index', expect:'cutPick(', find:'      if (d <= CUT.pad && d < bd){ bd = d; best = k; }', replace:'      if (d <= CUT.pad * 2 && d < bd){ bd = d; best = k; }' },
    { file:'index', expect:'cutRegions(', find:"    var L = [1].concat(drawn.slice().sort(function(a, b){ return a - b; }), [n - 1]), out = [];", replace:"    var L = [1].concat(drawn.slice(), [n - 1]), out = [];" },
    { file:'index', expect:'cut 5: vertex 0 tap zone is outside', find:'  var CUT = { cx:150, cy:150, r:110, pad:24 };', replace:'  var CUT = { cx:150, cy:150, r:140, pad:24 };' },
    { file:'index', expect:'tap zones of vertices', find:'  var CUT = { cx:150, cy:150, r:110, pad:24 };', replace:'  var CUT = { cx:150, cy:150, r:110, pad:44 };' },
    { file:'index', expect:'gCutTotal(5) zh', find:"gCutTotal: function(n){ return n + ' − 2 ＝ ' + (n - 2) + ' 個三角形：' + (n - 2) + ' × 180° ＝ ' + ((n - 2) * 180) + '°'; },", replace:"gCutTotal: function(n){ return n + ' − 2 ＝ ' + (n - 2) + ' 個三角形：' + (n - 2) + ' × 180° ＝ ' + ((n - 2) * 180 + 180) + '°'; }," },
    { file:'index', expect:'gCutDone(5) en', find:"      gCutDone: function(n){ return (n - 3) + ' diagonals from one vertex", replace:"      gCutDone: function(n){ return (n - 2) + ' diagonals from one vertex" },
    { file:'index', expect:'gCutNow(1) zh', find:"'畫了 ' + dg + ' 條對角線，切成 ' + pieces + ' 塊'", replace:"'畫了 ' + dg + ' 條對角線，切成 ' + (pieces + 1) + ' 塊'" },
    { file:'index', expect:'cut: the vertex judged', find:"      useTapSelect(B, function(P, pt){ judge(cutPick(n, pt)); return false; });", replace:"      useTapSelect(B, function(P, pt){ judge(2); return false; });" },
    { file:'index', expect:'cut: the round is solved', find:"        if (drawn.length === n - 3){ pen.lock(V[0].x, V[0].y); roundSolved(d.gCutDone(n)); }", replace:"        if (drawn.length === n - 4){ pen.lock(V[0].x, V[0].y); roundSolved(d.gCutDone(n)); }" },

    /* 第 3 關：每一個角 */
    { file:'index', expect:'each: the pool', find:'  var GAME_EACH = [5, 6, 8, 9, 10, 12];', replace:'  var GAME_EACH = [5, 6, 7, 8, 9, 10, 12];' },
    { file:'index', expect:'eachRead(', find:"    return /^(0|[1-9]\\d{0,5})$/.test(t) ? +t : null;", replace:"    return /^\\d{1,6}$/.test(t) ? +t : null;" },
    { file:'index', expect:'eachRead(', find:"    var t = String(raw).replace(/^\\s+|\\s+$/g, '').replace(/°$/, '');", replace:"    var t = String(raw).replace(/\\s+/g, '').replace(/°$/, '');" },
    { file:'index', expect:'eachJudge(', find:"    if (x === S) return { k:'sum', S:S };", replace:"    if (x === S || x === 360) return { k:'sum', S:S };" },
    { file:'index', expect:'eachJudge(', find:"    return { k:'wrong', S:S, Y:n * x, big:n * x > S };", replace:"    return { k:'wrong', S:S, Y:n * x, big:n * x >= S - n };" },
    { file:'index', expect:'gEachWrong zh', find:"'° ＝ ' + Y + '°；可是內角和是 (' + n + ' − 2) × 180° ＝ ' + S + '°，所以 ' + x + '° 太' + (big ? '大' : '小') + '了。'", replace:"'° ＝ ' + Y + '°；可是內角和是 (' + n + ' − 2) × 180° ＝ ' + S + '°，所以 ' + x + '° 太' + (big ? '小' : '大') + '了。'" },
    { file:'index', expect:'gEachDone en', find:"'°; shared among ' + n + ' angles, ' + S + '° ÷ ' + n + ' = ' + E + '°.'", replace:"'°; shared among ' + n + ' angles, ' + S + '° ÷ ' + n + ' = ' + (E + 1) + '°.'" },
    { file:'index', expect:'gEachTri', find:"      gEachTri: function(n){ return '180° 是一個三角形的內角和。這個圖形切得出不只一個三角形，而且內角和還要平分給 ' + n + ' 個角。'; },", replace:"      gEachTri: function(n){ return '180° 是一個三角形的內角和。這個圖形切得出不只一個三角形，而且內角和還要平分給 ' + (n - 2) + ' 個角。'; }," },
    { file:'index', expect:'the number judged is not the typed one', find:"        var x = eachRead(inp.value);", replace:"        var x = eachRead(inp.value); if (x !== null) x = E;" },

    /* 第 4 關：轉轉盤 */
    { file:'index', expect:'dial: pool entry 1/4', find:"[1, 12], [5, 12], [7, 12], [11, 12], [1, 3], [2, 3], [3, 4]];   /* [p, q] */", replace:"[1, 12], [5, 12], [7, 12], [11, 12], [1, 3], [2, 3], [3, 4], [1, 4]];   /* [p, q] */" },
    { file:'index', expect:'dial: pool entry 1/5', find:"[1, 12], [5, 12], [7, 12], [11, 12], [1, 3], [2, 3], [3, 4]];   /* [p, q] */", replace:"[1, 12], [5, 12], [7, 12], [11, 12], [1, 3], [2, 3], [3, 4], [1, 5]];   /* [p, q] */" },
    { file:'index', expect:'dialSnap(', find:'    var k = Math.round(deg / DIAL.step), last = 360 / DIAL.step - 1;', replace:'    var k = Math.floor(deg / DIAL.step), last = 360 / DIAL.step - 1;' },
    { file:'index', expect:'dialSnap(', find:'    if (k < 1) k = 1;              /* 正上方偏右一點 → 15° */', replace:'    if (k < 1) k = last;              /* 正上方偏右一點 → 15° */' },
    { file:'index', expect:'dialTap(', find:'    if (Math.abs(d - DIAL.r) > DIAL.band) return null;', replace:'    if (d < 10) return null;' },
    { file:'index', expect:'dialTap(', find:'    return deg < DIAL.step / 2 || deg > 360 - DIAL.step / 2 ? null : dialSnap(pt);', replace:'    return dialSnap(pt);' },
    { file:'index', expect:'dialRefuse(', find:"    return { a:x / g, b:360 / g, less:x * q < 360 * p, one:p > 1 && x * q === 360 };", replace:"    return { a:x / g, b:360 / g, less:x < 180, one:p > 1 && x * q === 360 };" },
    { file:'index', expect:'dial: the dial and its ticks', find:'  var DIAL = { cx:150, cy:138, r:100, band:24, step:15, start:90 };', replace:'  var DIAL = { cx:150, cy:100, r:100, band:24, step:15, start:90 };' },
    { file:'index', expect:'dial: pool entry 3/8', find:'  var DIAL = { cx:150, cy:138, r:100, band:24, step:15, start:90 };', replace:'  var DIAL = { cx:150, cy:138, r:100, band:24, step:15, start:135 };' },
    { file:'index', expect:'gDialBad zh', find:"'（' + x + ' ÷ 360，約分）—— 比 ' + p + '/' + q + ' ' + (less ? '小' : '大') + '。'", replace:"'（' + x + ' ÷ 360，約分）—— 比 ' + p + '/' + q + ' ' + (less ? '大' : '小') + '。'" },
    { file:'index', expect:'gDialDone en', find:"(p === 1 ? ' is ' : 's are ') + (360 / q) + '° × ' + p + ' = ' + (360 / q * p) + '°", replace:"(p === 1 ? ' is ' : 's are ') + (360 / q) + '° × ' + p + ' = ' + (360 / q * p + 15) + '°" },
    { file:'index', expect:'gDial2(1/8) zh', find:"gDial2: function(p, q){ return '360° ÷ ' + q + ' ＝ ' + (360 / q) + '°，一份是 ' + (360 / q) + '°；要轉 ' + p + ' 份。'; },", replace:"gDial2: function(p, q){ return '360° ÷ ' + q + ' ＝ ' + (360 / q) + '°，一份是 ' + (360 / q) + '°；要轉 ' + q + ' 份。'; }," },
    { file:'index', expect:'dial: the angle judged', find:"        var bad = dialRefuse(p, q, x);", replace:"        var bad = dialRefuse(p, q, 360 * p / q);" },
    { file:'index', expect:'dial: That’s it judges while the knob is held', find:"        if (gSolved || knob.busy()) return;   /* 旋鈕正被拖著", replace:"        if (gSolved) return;   /* 旋鈕正被拖著" },

    /* 第 5 關：拼分數 */
    { file:'index', expect:'frac 90°: the cards accept', find:'  var GAME_FRAC = [40, 45, 60, 72, 80, 135, 144, 160, 200, 216, 225, 280, 288, 315];', replace:'  var GAME_FRAC = [40, 45, 60, 72, 80, 90, 135, 144, 160, 200, 216, 225, 280, 288, 315];' },
    { file:'index', expect:'frac: 150°', find:'  var GAME_FRAC = [40, 45, 60, 72, 80, 135, 144, 160, 200, 216, 225, 280, 288, 315];', replace:'  var GAME_FRAC = [40, 45, 60, 72, 80, 135, 144, 150, 160, 200, 216, 225, 280, 288, 315];' },
    { file:'index', expect:'fracJudge(', find:"    if (a * 360 === A * b) return null;", replace:"    if (a * 360 === A * b || a * 360 === A * b * 2) return null;" },
    { file:'index', expect:'fracJudge(', find:"    if (a >= b) return { k:'big' };", replace:"    if (a > b) return { k:'big' };" },
    { file:'index', expect:'frac: card 9', find:"  function fracCardXY(v){ var r = v <= 5 ? 0 : 1; return { x:FRAC.trayX[r][r ? v - 6 : v - 1], y:FRAC.trayY[r] }; }", replace:"  function fracCardXY(v){ var r = v <= 4 ? 0 : 1; return { x:FRAC.trayX[r][r ? v - 5 : v - 1], y:FRAC.trayY[r] }; }" },
    { file:'index', expect:'a card’s home sits inside a box’s drop zone', find:"var FRAC = { cx:82, cy:104, r:66, slotX:222, numY:62, denY:146,", replace:"var FRAC = { cx:82, cy:104, r:66, slotX:222, numY:62, denY:186," },
    { file:'index', expect:'gFracInt zh', find:"return a + '/' + b + ' 個圓的圓心角是 360° ÷ ' + b + ' × ' + a + ' ＝ ' + y + '°，不是 ' + A + '°。'; },", replace:"return a + '/' + b + ' 個圓的圓心角是 360° ÷ ' + b + ' × ' + a + ' ＝ ' + (y + 1) + '°，不是 ' + A + '°。'; }," },
    { file:'index', expect:'gFracDone(40) en', find:"'° ÷ 360°: divide the top, ' + A + ', and the bottom, 360, by ' + g + ' — it reduces to ' + p + '/' + q + '.'", replace:"'° ÷ 360°: divide the top, ' + A + ', and the bottom, 360, by ' + (g * 2) + ' — it reduces to ' + p + '/' + q + '.'" },
    { file:'index', expect:'gFracNoInt en', find:"      gFracNoInt: function(a, b, A){ return '360 ÷ ' + b + ' does not divide evenly", replace:"      gFracNoInt: function(a, b, A){ return '360 ÷ ' + a + ' does not divide evenly" },
    { file:'index', expect:'frac: the fraction judged', find:"          var a = slots[0].P.data.v, b = slots[1].P.data.v, bad = fracJudge(A, a, b);", replace:"          var a = slots[0].P.data.v, b = slots[1].P.data.v, bad = fracJudge(A, b, a);" },

    /* 範例與 i18n */
    { file:'index', expect:'is wrong', find:"why:'(8−2)×180°=6×180°=1080°。' },", replace:"why:'(8−2)×180°=6×180°=1260°。' }," },
    { file:'index', expect:'polyName', find:"9:'正九邊形',10:'正十邊形',12:'正十二邊形'};", replace:"9:'正九邊形',10:'正十邊形'};" }
  ],

  sim: {
    INVARIANTS: {
      polygonSum: d => { if (d.sum !== (d.n - 2) * 180 || d.n < 4) return 'polygonSum: sum ' + d.sum + ' != (n − 2) × 180'; },
      polygonEach: d => { if (d.sum !== (d.n - 2) * 180 || d.each * d.n !== d.sum || !isInt(d.each)) return 'polygonEach: each ' + d.each + ' × n != (n − 2) × 180 (or not whole)'; },
      polygonFromSum: d => { if (d.sum !== (d.n - 2) * 180) return 'polygonFromSum: sum != (n − 2) × 180'; },
      triangleCount: d => {
        if (d.c !== d.n - 2) return 'triangleCount: c != n − 2';
        /* 刻意的迷思誘答「切成 n 個」要真的在選項裡 */
        if (d.opts.indexOf(d.n) < 0) return 'triangleCount: the "n triangles" misconception is not offered';
      },
      sectorFraction: d => { if (red(d.deg, 360) !== d.num + '/' + d.den || d.deg <= 0 || d.deg >= 360) return 'sectorFraction: ' + d.num + '/' + d.den + ' != ' + d.deg + '/360 reduced'; },
      sectorFromFraction: d => { const [a, b] = d.frac.split('/').map(Number); if (d.deg * b !== 360 * a) return 'sectorFromFraction: ' + d.deg + '° is not ' + d.frac + ' of 360°'; },
      sectorRemaining: d => { if (d.rem !== 360 - d.deg || red(d.rem, 360) !== d.num + '/' + d.den) return 'sectorRemaining: the remainder is not 360 − deg, or not reduced'; },
      angleSumThird: d => { if (d.third !== 180 - d.a - d.b || d.third <= 0) return 'angleSumThird: third != 180 − a − b (or not positive)'; },
      symmetrySides: d => { if ([3, 4, 5, 6, 8].indexOf(d.n) < 0) return 'symmetrySides: n out of pool'; },
      fractionMultiplyWord: d => { if (red(d.a * d.c, d.b * d.d) !== d.num + '/' + d.den) return 'fractionMultiplyWord: not a/b × c/d reduced'; }
    },
    expectedCorrect: function(d, id){
      switch (id){
        case 'polygonSum': return (d.n - 2) * 180 + '°';
        case 'polygonEach': return (d.n - 2) * 180 / d.n + '°';
        case 'polygonFromSum': return String(d.sum / 180 + 2);
        case 'triangleCount': return String(d.n - 2);
        case 'sectorFraction': return red(d.deg, 360);
        case 'sectorFromFraction': { const [a, b] = d.frac.split('/').map(Number); return 360 / b * a + '°'; }
        case 'sectorRemaining': return red(360 - d.deg, 360);
        case 'angleSumThird': return (180 - d.a - d.b) + '°';
        case 'symmetrySides': return String(d.n);
        case 'fractionMultiplyWord': return red(d.a * d.c, d.b * d.d);
      }
      return 'UNKNOWN GENERATOR ' + id;
    },
    optionOk: function(s, id, lang){
      const kind = { polygonSum:'deg', polygonEach:'deg', sectorFromFraction:'deg', angleSumThird:'deg', polygonFromSum:'int', triangleCount:'int', symmetrySides:'int', sectorFraction:'frac', sectorRemaining:'frac', fractionMultiplyWord:'frac' }[id];
      const t = String(s);
      if (kind === 'deg'){
        const m = t.match(/^(\d+)°$/);
        if (!m) return 'option "' + t + '" is not a whole number of degrees';
        /* 範圍從產生器自己的參數推：內角和最大 12 邊形 (12 − 1) × 180、扇形的 num × 360 最大 3 × 360、第三個角最大 180 − 20 − 20 */
        const MAX = { polygonSum:12 * 180, polygonEach:(12 - 2) * 180, sectorFromFraction:3 * 360, angleSumThird:180 }[id];
        if (+m[1] < 1 || +m[1] > MAX + 3) return 'option ' + t + ' outside 1~' + (MAX + 3);
      } else if (kind === 'int'){
        if (!/^\d+$/.test(t) || +t < 1 || +t > 24) return 'option "' + t + '" is not a whole number 1~24';
      } else if (kind === 'frac'){
        const m = t.match(/^(\d+)\/(\d+)$/);
        if (!m || +m[1] < 1 || +m[2] < 2 || +m[1] >= +m[2] * 2) return 'option "' + t + '" is not a fraction a/b';
      } else return 'unknown generator ' + id;
    },
    stemEchoOk: {
      /* 「n 邊形切成 n 個三角形」：刻意的迷思誘答（忘了 −2）—— 只放行 n 那一個值 */
      triangleCount: function(d, opt){ return +opt === d.n; }
    },
    /* 英文冠詞跟著數字唸法走（舊版一律 an：an 4-sided polygon） */
    renderCheck: function(d, q, lang, id){
      if (lang !== 'en' || (id !== 'polygonSum' && id !== 'triangleCount')) return;
      const m = q.stem.match(/\b(a|an) (\d+)-sided/);
      if (!m) return id + ': cannot read the article in "' + q.stem + '"';
      if (m[1] + ' ' !== aNumRef(+m[2])) return id + ': English article "' + m[1] + ' ' + m[2] + '-sided" is wrong';
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「轉盤大師」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GW, GPICK, shuffle, pick, gGcd, regPts, rimPt, SORT, SORT_H, SORT_REG, SORT_ODD, sortWhy, sortRefuse, sortBoard, sortGrouped, sortTray, sortShape, CUT, CUT_H, GAME_CUT, cutPts, cutPick, cutRefuse, cutRegions, EACH, EACH_H, GAME_EACH, eachPts, eachRead, eachJudge, DIAL, DIAL_H, GAME_DIAL, dialSnap, dialTap, dialRefuse, FRAC, FRAC_H, GAME_FRAC, fracSlots, fracCardXY, fracJudge, nearestOpen}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], EPS = 1e-9, W = 300;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        const r = arith(s);
        r.problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ' zh: missing space between Chinese and a digit in "' + s + '"');
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        return r.verified;
      };
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 1. 每一條 I18N 靜態字串（含三層題庫的題幹、選項與解釋）裡的算式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        const r = arith(s);
        checkedEq += r.verified;
        r.problems.forEach(p => fail(where + ': ' + p + ' — "' + s + '"'));
      }));
      if (checkedEq < 30) fail('only ' + checkedEq + ' equations verified in the I18N strings — the arithmetic scan is not reading them');
      /* 範例 3 的鋪排：正多邊形的名字都要有（遊戲會出 9、10、12 邊形） */
      LANGS.forEach(L => [3, 4, 5, 6, 8, 9, 10, 12].forEach(n => {
        const nm = I18N[L].polyName(n);
        if (L === 'zh' ? !/^正/.test(nm) || /\d/.test(nm) : !/^(Regular |Square$|Equilateral )/.test(nm)) fail('polyName(' + n + ') ' + L + ' is "' + nm + '" — not a named regular polygon');
      }));

      /* --- 1b. 遊戲的開場白：頁面上的備用字和中文字典是同一句 --- */
      {
        const m = src.match(/<p class="lead" data-i18n="s6lead">([\s\S]*?)<\/p>/);
        if (!m || m[1] !== I18N.zh.s6lead) fail('GAME s6lead: the markup fallback is not the same sentence as the zh dictionary');
        LANGS.forEach(L => has('s6lead', L, I18N[L].s6lead, { zh:['分一分', '切三角形', '算每個角', '轉轉盤', '拼分數'], en:['Sort', 'cut', 'each angle', 'dial', 'fraction'] }));
        if (/var ROUNDS = \[|gAskSum|gCorrectFirst/.test(src)) fail('GAME: the old multiple-choice game is still in the page');
      }

      /* ================= 2. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：轉盤大師');
      const ge = src.indexOf('  /* ---------- 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const fin = v => typeof v === 'number' && isFinite(v);
      const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= -EPS && o.y >= -EPS && o.x + o.w <= W + EPS && o.y + o.h <= H + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
      const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); return; } };
      if (D.GW !== W) fail('GAME: the board width GW should be ' + W);
      tooSmall('a piece (GPICK)', D.GPICK);

      const TYPES = ['sort', 'cut', 'each', 'dial', 'frac'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, then 4 backwards), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        sort: { has:{ zh:['邊一樣長', '角也一樣大', '少一件'], en:['same length', 'same size', 'either'] } },
        cut: { has:{ zh:['紅色的頂點', '不相鄰'], en:['red vertex', 'not next to it'] } },
        each: { has:{ zh:['(邊數 − 2) × 180°', '平分'], en:['(number of sides − 2) × 180°', 'share'] } },
        dial: { has:{ zh:['360°', '分母', '分子'], en:['360°', 'bottom number', 'top number'] } },
        frac: { has:{ zh:['÷ 360°', '最簡'], en:['÷ 360°', 'simplest'] } }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
          if (t === 'sort'){ if (typeof a !== 'string' || !a) fail('GAME: gAsks.sort missing in ' + L); }
          else if (typeof a !== 'function') fail('GAME: gAsks.' + t + ' must be a function (' + L + ')');
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h, null); has('gHints.' + t, L, h, HINT_SEM[t].has); }
        });
      });
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };

      /* --- 拖拉引擎與計分的保護（原始碼形狀） --- */
      need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
      need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
      need(null, /gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+; BOARD_TAP = null; PIECE_PTR = \{\};/, 'startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
      need(null, /if \(gen !== gGen\) return;   \/\* 這一塊屬於已經拿掉的畫板/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
      need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
      need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      need(null, /if \(o\.snap\)\{ var sp = o\.snap\(\{ x:orig\.x \+ dx, y:orig\.y \+ dy \}\); P\.place\(sp\.x, sp\.y\); \}/, 'the knob does not snap while it is dragged (the readout would not be what is judged)');
      need(null, /function roundNote\(text\)\{ gMsg\.innerHTML = '<span class="gnote">' \+ text \+ '<\/span>'; \}/, 'roundNote() (a reminder) must not count as a mistake');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      { const g = extractFunction(gsrc, 'gSvg'); if (!g || /viewBox/.test(g.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME: the board SVG gets a viewBox — the drawing would no longer match the hit zones'); }
      ['sort', 'cut', 'dial', 'frac'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      { const rs = extractFunction(gsrc, 'roundSolved'); if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint'); }
      need(null, /var pts = gMistake \? 10 : 20;/, 'scoring: a round should give +20 with no mistakes and +10 after mistakes');
      /* roundSolved() 真的跑：沒犯錯 +20、犯過錯 +10，過關後 gSolved；第二次呼叫不再加分（codex 1b） */
      {
        const fsrc = extractFunction(gsrc, 'roundSolved');
        [[false, 30, 50], [true, 30, 40]].forEach(([mis, s0, want]) => {
          let r;
          try {
            r = new Function('var gSolved = false, gMistake = ' + mis + ', gScore = ' + s0 + ', gRound = 0, GAME_ORDER = [1, 2, 3, 4, 5], elScore = { textContent:"" }, gHintBtn = {}, elHint = { textContent:"x" }, gNext = { disabled:true }, gMsg = { innerHTML:"" };' +
              'var gameStage = { querySelectorAll:function(){ return []; } };' +
              'function L(){ return { gWin:function(){ return "WIN"; }, gClear:"CLEAR", gPts:function(p){ return "+" + p; } }; }' + fsrc +
              '; roundSolved("ok"); roundSolved("again"); return { s:gScore, solved:gSolved, shown:elScore.textContent, next:gNext.disabled };')();
          } catch (e){ fail('GAME scoring: roundSolved() could not run: ' + e.message); return; }
          if (r.s !== want || String(r.shown) !== String(want) || !r.solved || r.next) fail('GAME scoring: roundSolved() ' + (mis ? 'after mistakes' : 'clean') + ' should take ' + s0 + ' to ' + want + ' once, solve the round and enable Next — got ' + JSON.stringify(r));
        });
        if (/gSolved\s*=\s*true/.test(extractFunction(gsrc, 'roundMiss') || '')) fail('GAME scoring: roundMiss() ends the round (game over)');
      }
      {
        const fsrc = extractFunction(gsrc, 'roundMiss');
        if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try {
            r = new Function('var gScore = ' + s0 + ', gMistake = false, elScore = { textContent:"" }, gMsg = { innerHTML:"" };' +
              'function L(){ return { gMinus:"MINUS" }; }' + fsrc + '; roundMiss("why"); return { s:gScore, m:gMistake, html:gMsg.innerHTML, shown:elScore.textContent };')();
          } catch (e){ fail('GAME scoring: roundMiss() could not run: ' + e.message); return; }
          if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake does not cost 5 (floored at 0): ' + s0 + ' → ' + r.s);
          if (!r.m) fail('GAME scoring: roundMiss() does not record the mistake');
          if (/MINUS/.test(r.html) !== shows) fail('GAME scoring: "−5" is ' + (shows ? 'not shown although 5 was taken' : 'shown although nothing was taken') + ' (at ' + s0 + ')');
        });
      }
      /* 同一個錯只扣一次：A、B、A、A、B 只扣兩次；說明被收掉之後的同一個錯要再說一次（不扣） */
      {
        const fsrc = extractFunction(gsrc, 'missOnce');
        if (!fsrc) fail('GAME: cannot find missOnce()');
        else {
          let log;
          try {
            log = new Function('var log = [], shown = false, gMsg = { querySelector:function(){ return shown ? {} : null; } };' +
              'function roundMiss(t){ log.push("miss"); shown = true; } function roundAgain(t){ log.push("again"); shown = true; }' + fsrc +
              'var seen = { map:{}, last:null };' +
              '["A", "B", "A", "A", "B"].forEach(function(k){ log.push("@" + k); missOnce(seen, k, "why"); });' +
              'shown = false; log.push("@B(cleared)"); missOnce(seen, "B", "why"); return log.join(" ");')();
          } catch (e){ fail('GAME: missOnce() could not run: ' + e.message); log = ''; }
          if (log && log !== '@A miss @B miss @A again @A @B again @B(cleared) again') fail('GAME missOnce(): wrong A, B, A, A, B should be charged twice (then re-explain A, nothing, re-explain B), and a repeat after the reason was cleared re-explains it — got "' + log + '"');
        }
      }
      /* shuffle() 真的跑：每一個元素每一個位置都出現過 */
      {
        const ssrc = extractFunction(src.slice(src.indexOf(module.exports.data.dataStart)), 'shuffle');
        let seen;
        try { seen = new Function(ssrc + '; var s = {}; for (var i = 0; i < 3000; i++){ shuffle([0, 1, 2, 3, 4, 5]).forEach(function(v, j){ s[v + "@" + j] = 1; }); } return Object.keys(s).length;')(); } catch (e){ seen = -1; }
        if (seen !== 36) fail('GAME shuffle(): only ' + seen + ' of 36 value@position pairs in 3000 shuffles');
      }
      /* nearestOpen()：兩個重疊的格子，點在重疊裡 —— 挑到方框最近的（不是陣列第一個、不是中心最近的）；最近的放好了就不收 */
      {
        const no = D.nearestOpen;
        const A = { cx:50, cy:50, hw:40, hh:40 }, B = { cx:105, cy:50, hw:10, hh:10 };
        if (no([A, B], { x:88, y:50 }, 8) !== A) fail('GAME nearestOpen(): a point inside box 1 (but nearer box 2’s centre) must go to box 1');
        if (no([A, B], { x:94, y:50 }, 8) !== B) fail('GAME nearestOpen(): a point 4px from box 1 and 1px from box 2 must go to box 2 — not the first in the array');
        const Bd = Object.assign({}, B, { done:true });
        if (no([A, Bd], { x:94, y:50 }, 8) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot must not jump to the other one');
        if (no([A, B], { x:200, y:50 }, 8) !== null) fail('GAME nearestOpen(): a far drop must land nowhere');
      }

      /* ---------- 第 1 關：分一分 ---------- */
      {
        const S = D.SORT, H = D.SORT_H;
        const KINDS = D.SORT_ODD.angles.concat(D.SORT_ODD.sides, D.SORT_ODD.both);
        if (D.SORT_REG.join() !== '3,4,5,6,8') fail('GAME sort: the regular pool should be 3, 4, 5, 6, 8 (the shapes of example 1), got ' + D.SORT_REG);
        if (KINDS.sort().join() !== 'hexalt,house,iso,rect,rhombus') fail('GAME sort: the decoy kinds changed: ' + KINDS);
        const all = D.SORT_REG.map(n => ({ kind:'reg', n:n })).concat(KINDS.map(k => ({ kind:k })));
        const geo = {};
        all.forEach(c => {
          const sh = D.sortShape(c), V = sh.pts, name = c.kind + (c.n || '');
          const L = sidesOf(V), A = anglesOf(V), sEq = spread(L) < 0.01, aEq = spread(A) < 0.01;
          geo[name] = { V:V, L:L, A:A, sEq:sEq, aEq:aEq, n:V.length };
          if (!convexRef(V)) fail('GAME sort ' + name + ': the shape is not a simple convex polygon');
          if (Math.abs(A.reduce((s, a) => s + a, 0) - (V.length - 2) * 180) > 0.01) fail('GAME sort ' + name + ': the angles do not add up to (n − 2) × 180');
          /* 小記號：一樣長 ⇔ 一樣的記號；正多邊形每條邊都有記號 */
          if (sh.ticks.length !== V.length) fail('GAME sort ' + name + ': tick marks are not given for every side');
          for (let i = 0; i < V.length; i++) for (let j = 0; j < V.length; j++)
            if ((Math.abs(L[i] - L[j]) < 0.01) !== (sh.ticks[i] === sh.ticks[j])){ fail('GAME sort ' + name + ': the tick marks do not say which sides are equal (sides ' + L.map(v => v.toFixed(2)) + ', ticks ' + sh.ticks + ')'); i = j = 99; }
          if (sEq && sh.ticks.some(t => t < 1)) fail('GAME sort ' + name + ': an equal side carries no tick mark');
          sh.right.forEach(i => { if (Math.abs(A[i] - 90) > 0.01) fail('GAME sort ' + name + ': a right-angle mark on a ' + A[i].toFixed(1) + '° corner'); });
          if (A.every(a => Math.abs(a - 90) < 0.01) && sh.right.length !== 4) fail('GAME sort ' + name + ': a four-right-angle shape does not show its right angles');
          /* 放得進卡片（框 3px ＋ 2px）與小圖（框 2px ＋ 2px，放大 0.42） */
          const xs = V.map(p => p.x), ys = V.map(p => p.y);
          if (Math.max(...xs.map(Math.abs)) > S.cardW / 2 - 5 - 1.5 || Math.max(...ys.map(Math.abs)) > S.cardH / 2 - 5 - 1.5) fail('GAME sort ' + name + ': the picture spills out of its card');
          if (Math.max(...xs.map(Math.abs), ...ys.map(Math.abs)) * 0.42 > (S.miniS - 4) / 2 - 2 - 1) fail('GAME sort: the mini of ' + name + ' does not fit its box');
          /* 是不是正多邊形、差的是哪一個條件：用量出來的邊和角自己判斷 */
          const want = (sEq && aEq) ? 'reg' : (sEq ? 'angles' : (aEq ? 'sides' : 'both'));
          if (D.sortWhy(c) !== want) fail('GAME sortWhy(' + name + '): says ' + D.sortWhy(c) + ', the drawing says ' + want);
          [true, false].forEach(isReg => { const r = D.sortRefuse(c, isReg), ok = (want === 'reg') === isReg; if (ok ? r !== null : r !== want) fail('GAME sortRefuse(' + name + ', ' + (isReg ? 'regular box' : 'not box') + ') = ' + r); });
          if (c.kind === 'reg' && V.length !== c.n) fail('GAME sort: regular ' + c.n + '-gon drawn with ' + V.length + ' vertices');
          /* 正方形擺正：不要一個角朝上（看起來像菱形） */
          if (c.kind === 'reg' && c.n === 4 && !V.some(p => V.some(q => q !== p && Math.abs(p.y - q.y) < 0.01))) fail('GAME sort: the square stands on a corner — it looks like the rhombus');
          /* 說明：兩種語言都說得出差的是什麼，數字是這張圖的邊數 */
          LANGS.forEach(Lg => {
            const why = want === 'reg' ? 'reg' : want;
            const t = I18N[Lg].gSortBad(why, c.kind, V.length);
            const wantNums = want === 'reg' ? [V.length, V.length] : (c.kind === 'iso' ? [] : [V.length]);
            say('gSortBad ' + name, Lg, t, wantNums);
            const W2 = {
              reg: { zh:['邊都一樣長', '角也都一樣大', '是正多邊形'], en:['same length', 'same size', 'IS a regular polygon'] },
              angles: { zh:['邊一樣長', '角不是全部一樣大', '不是正多邊形'], en:['same length', 'angles are not all the same size', 'not regular'] },
              sides: { zh:[/邊不是全部一樣長|有長有短/, /直角|角一樣大/, '不是正多邊形'], en:[/not all the same length|long and short/, /right angles|same size/, 'not regular'] },
              both: { zh:['只有兩條邊一樣長', '角也不是全部一樣大', '不是正多邊形'], en:['Only two sides', 'not all the same size', 'not regular'] }
            }[want];
            has('gSortBad ' + name, Lg, t, W2);
            /* 菱形、屋頂五邊形、長方形、等腰三角形都有一樣大的角或一樣長的邊：只能說「不是全部…」「不全相等」，不可以說「角不一樣大／邊不相等」（驗證者 2026-10-11） */
            hasNot('gSortBad ' + name, Lg, t, { zh:[/角(也)?不一樣大|邊不一樣長|[角邊]不相等/], en:[/(angles|sides) are not (the same|equal)|angles are not \(/] });
            const h2 = I18N[Lg].gSortHint2(c.kind);
            say('gSortHint2 ' + name, Lg, h2, []);
            hasNot('gSortHint2 ' + name, Lg, h2, { zh:[/角(也)?不一樣大/], en:[/angles are not the same size/] });
            has('gSortHint2 ' + name, Lg, h2, { reg:{ zh:['邊都一樣長', '角也都一樣大'], en:['same length', 'same size'] }, angles:{ zh:['邊都一樣長', /尖|鈍/], en:['same length', /sharp|wide/] }, sides:{ zh:['邊有長有短'], en:['long and short'] }, both:{ zh:['只有兩條邊'], en:['only two sides'] } }[want]);
          });
          if (c.kind === 'iso'){ let pairs = 0; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (Math.abs(L[i] - L[j]) < 0.01) pairs++; if (pairs !== 1) fail('GAME sort iso: "only two sides are equal" is false for the drawing'); }
          if (c.kind === 'house'){ const a = A.map(v => Math.round(v)).sort((p, q) => p - q).join(); if (a !== '60,90,90,150,150') fail('GAME sort house: the angles are ' + a + ' — the reason says right angles, a sharp one and wide ones'); }
          if (c.kind === 'rhombus'){ const a = A.map(v => Math.round(v)).sort((p, q) => p - q).join(); if (a !== '60,60,120,120') fail('GAME sort rhombus: the angles are ' + a + ' — the reason says two sharp, two wide'); }
        });
        /* 同一塊板子上沒有兩張「轉一轉、翻一翻就一樣」的圖：同邊數的兩張，排好的邊長或角度一定要不同 */
        const names = Object.keys(geo);
        for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++){
          const a = geo[names[i]], b = geo[names[j]];
          if (a.n !== b.n) continue;
          const sl = g => g.L.map(v => v / Math.max(...g.L)).sort().map(v => v.toFixed(3)).join(), sa = g => g.A.map(v => v.toFixed(2)).sort().join();
          if (sl(a) === sl(b) && sa(a) === sa(b)) fail('GAME sort: ' + names[i] + ' and ' + names[j] + ' are the same shape');
        }
        /* sortBoard()：3000 次 */
        const kindsSeen = {};
        let bad = 0, grouped = 0;
        for (let it = 0; it < 3000; it++){
          const cards = D.sortBoard(), regs = cards.filter(c => c.kind === 'reg'), odd = cards.filter(c => c.kind !== 'reg');
          cards.forEach(c => { kindsSeen[c.kind + (c.kind === 'reg' ? c.n : '')] = 1; });
          const whys = odd.map(c => D.sortWhy(c));
          if (cards.length !== 6 || regs.length !== 3 || new Set(regs.map(c => c.n)).size !== 3 || new Set(odd.map(c => c.kind)).size !== 3 ||
              whys.indexOf('angles') < 0 || whys.indexOf('sides') < 0 || odd.some(c => c.n !== D.sortShape(c).pts.length)){ if (!bad++) fail('GAME sortBoard(): a board is not three different regular polygons + three different decoys incl. one angles-only and one sides-only: ' + JSON.stringify(cards)); }
          const t = D.sortTray(cards);
          if (t.length !== 6 || cards.some(c => t.indexOf(c) < 0)) { if (!bad++) fail('GAME sortTray(): not a rearrangement of the cards'); }
          const top = t.slice(0, 3).map(c => c.kind === 'reg');
          if (top[0] === top[1] && top[1] === top[2]) grouped++;
        }
        if (grouped) fail('GAME sortTray(): the tray starts sorted (top row all one kind) in ' + grouped + ' of 3000 boards');
        /* 位置也不可以透露答案：顯示出來的排法（哪幾個位置是正多邊形）每一種都要差不多一樣常見 —— 只看位置的玩家，最常見的那一種排法不可以超過 8%（18 種排法，各約 5.6%） */
        {
          const masks = {}, N2 = 30000;
          for (let it = 0; it < N2; it++){ const m = D.sortTray(D.sortBoard()).map(c => c.kind === 'reg' ? 'R' : 'D').join(''); masks[m] = (masks[m] || 0) + 1; }
          const top = Object.keys(masks).sort((x, y) => masks[y] - masks[x])[0];
          if (Object.keys(masks).length !== 18 || masks[top] / N2 > 0.08) fail('GAME sort: a position-only player wins ' + (100 * masks[top] / N2).toFixed(1) + '% of boards with layout ' + top + ' (' + Object.keys(masks).length + ' layouts seen; each should be about 5.6%)');
        }
        if (Object.keys(kindsSeen).length !== 10) fail('GAME sortBoard(): only ' + Object.keys(kindsSeen).length + ' of 10 cards ever appear');
        if (!D.sortGrouped([{ kind:'reg' }, { kind:'reg' }, { kind:'reg' }, { kind:'rect' }, { kind:'iso' }, { kind:'house' }]) || D.sortGrouped([{ kind:'reg' }, { kind:'rect' }, { kind:'reg' }, { kind:'reg' }, { kind:'iso' }, { kind:'house' }])) fail('GAME sortGrouped(): does not recognise a sorted top row');
        /* 版面：兩個箱子、六張卡（兩排三張）、小圖，都在畫板裡、互不重疊；箱子之間的空隙比兩邊的放寬加起來窄（nearest 的 e2e 用得到） */
        const bins = S.binX.map(x => ({ x:x, y:S.binY, w:S.binW, h:S.binH }));
        bins.forEach((b, i) => inside(b, 'sort: the boxes ' + i, H));
        if (!(bins[1].x - (bins[0].x + bins[0].w) < 2 * S.pad && bins[1].x > bins[0].x + bins[0].w)) fail('GAME sort: the boxes should leave a gap narrower than the two pads (the overlap the e2e drops into)');
        const cards = []; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) cards.push(box(S.trayX[c], S.trayY[r], S.cardW, S.cardH));
        cards.forEach((c, i) => { inside(c, 'sort: card ' + i, H); if (bins.some(b => hit(c, { x:b.x - S.pad, y:b.y - S.pad, w:b.w + 2 * S.pad, h:b.h + 2 * S.pad }))) fail('GAME sort: card ' + i + ' sits inside a box’s drop zone'); });
        noHits(cards, 'sort: cards');
        tooSmall('sort: card', Math.min(S.cardW, S.cardH));
        for (let i = 0; i < 3; i++){ const mx = S.binX[1] + 8 + i * (S.miniS + S.miniGap), my = S.binY + S.lblH + 8; if (mx + S.miniS > S.binX[1] + S.binW - 3 || my + S.miniS > S.binY + S.binH - 3) fail('GAME sort: the minis do not fit in the box'); }
        if (S.lblH < 2 * 15 * 1.2 + 4 + 2 * 2) fail('GAME sort: the box label has no room for two lines');
        need('sort', /var c = P\.data\.c, why = sortRefuse\(c, bin\.isReg\);\s*if \(why\)\{ missOnce\(seen, pieces\.indexOf\(P\) \+ ':' \+ bin\.i, d\.gSortBad\(why, c\.kind, c\.n\)\); return false; \}/, 'sort: the box judged is not the one dropped on, the card is not the one dropped, or the reason does not match');
        need('sort', /var bin = nearestOpen\(bins, pt, SORT\.pad\);\s*if \(!bin\) return false;/, 'sort: the box is not picked by nearestOpen (or a drop outside every box is not silent)');
        need('sort', /addZone\(B, x \+ 4, SORT\.binY \+ 4, SORT\.binW - 8, SORT\.lblH, 'gbinlbl', isReg \? d\.gBin\.reg : d\.gBin\.not\);/, 'sort: a box label does not say which box it is');
        need('sort', /var pieces = sortTray\(cards\)\.map\(function\(c, j\)\{\s*return addPiece\(B, \{ w:SORT\.cardW, h:SORT\.cardH, cx:SORT\.trayX\[j % 3\], cy:SORT\.trayY\[Math\.floor\(j \/ 3\)\], cls:'gcard gshape', node:shapeSvg\(c, SORT\.cardW, SORT\.cardH, 1\), data:\{ c:c \} \}\);/, 'sort: a card does not show the picture it is judged by, or the tray is not shuffled');
        /* 卡片的樣子不可以透露答案：shapeSvg 只能從 sortShape(c) 拿頂點、記號與直角（那是題目本身），顏色、框線、粗細一律固定（驗證者 2026-10-11：正綠、不是橘，只看顏色就分對 49/49） */
        {
          const ss = extractFunction(gsrc, 'shapeSvg');
          const bodyNoShape = (ss || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/sortShape\(c\)/g, '');
          if (!ss || /\bc\.|\bc\[|sortWhy|sortRefuse|\bkind\b/.test(bodyNoShape)) fail('GAME sort: the card picture depends on the card’s kind or answer beyond its geometry — its look gives the answer away');
          if (!/fill:SHAPE_FILL, stroke:'#2B2A33',/.test(ss || '')) fail('GAME sort: every card must use the one fill SHAPE_FILL and the same stroke — its look gives the answer away');
          /* 大小也不可以透露答案：每一張的面積都是 SORT.area × s²，s 跟答案無關；只看外框大小的玩家，整板全對不可以比亂猜（1/20）好多少 */
          let sizeBad = 0;
          all.forEach(cc => { [S.sMin, 1].forEach(sv => { const V = D.sortShape(Object.assign({ s:sv }, cc)).pts; if (Math.abs(areaOf(V) - S.area * sv * sv) > 1e-6 && !sizeBad++) fail('GAME sort: ' + cc.kind + (cc.n || '') + ' is not drawn at area SORT.area × s² (' + areaOf(V).toFixed(1) + ')'); }); });
          const st = {}, N = 20000, sMean = { reg:[0, 0], odd:[0, 0] };
          for (let it = 0; it < N; it++){
            const cs = D.sortBoard().map(cc => {
              const V = D.sortShape(cc).pts, xs = V.map(p => p.x), ys = V.map(p => p.y), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
              const g = sMean[cc.kind === 'reg' ? 'reg' : 'odd']; g[0] += cc.s; g[1]++;
              if (!(cc.s >= S.sMin && cc.s <= 1)) sizeBad++;
              return { reg:cc.kind === 'reg', area:w * h, height:h, width:w };
            });
            ['area', 'height', 'width'].forEach(f => {
              const up = cs.slice().sort((x, y) => y[f] - x[f]);
              st[f + ' biggest'] = (st[f + ' biggest'] || 0) + (up.slice(0, 3).every(x => x.reg) ? 1 : 0);
              st[f + ' smallest'] = (st[f + ' smallest'] || 0) + (up.slice(3).every(x => x.reg) ? 1 : 0);
              st[f + ' card'] = (st[f + ' card'] || 0) + up.slice(0, 3).filter(x => x.reg).length / 3;
            });
          }
          if (sizeBad) fail('GAME sort: a card scale s is outside ' + S.sMin + '~1, or a card is not drawn at its area');
          if (Math.abs(sMean.reg[0] / sMean.reg[1] - sMean.odd[0] / sMean.odd[1]) > 0.01) fail('GAME sort: the card scale s depends on the answer');
          Object.keys(st).forEach(k => {
            const r = st[k] / N;
            if (/card$/.test(k) ? (r > 0.65 || r < 0.35) : r > 0.08) fail('GAME sort: a size-only player ("' + k + '" → regular) is right ' + (r * 100).toFixed(1) + '% of the time — chance is ' + (/card$/.test(k) ? '50% per card' : '5% per board'));
          });
          all.forEach(cc => { const keys = Object.keys(D.sortShape(cc)).sort().join(); if (keys !== 'pts,right,ticks') fail('GAME sort: sortShape returns ' + keys + ' — a style field could give the answer away'); });
        }
        need('sort', /bin\.n\+\+; done\+\+;[^\n]*\n[^\n]*\n\s*line\.textContent = d\.gSortNow\(done, cards\.length\);\s*refreshHint\(\);\s*if \(done === cards\.length\) roundSolved\(d\.gSortDone\);/, 'sort: a placed card is not counted, or the round is not solved exactly when all six are in');
        LANGS.forEach(Lg => {
          const b = I18N[Lg].gBin;
          if (!b || b.reg.indexOf('✅') < 0 || b.not.indexOf('❌') < 0) fail('GAME gBin ' + Lg + ': the boxes must be marked ✅ / ❌');
          say('gSortNow', Lg, I18N[Lg].gSortNow(4, 6), [4, 6]);
          say('gSortDone', Lg, I18N[Lg].gSortDone, []);
          has('gSortDone', Lg, I18N[Lg].gSortDone, { zh:['邊都一樣長', '角都一樣大'], en:['equal sides', 'equal angles'] });
        });
      }

      /* ---------- 第 2 關：切三角形 ---------- */
      {
        const C = D.CUT, H = D.CUT_H;
        if (D.GAME_CUT.join() !== '5,6,7,8') fail('GAME cut: the pool should be 5, 6, 7, 8 (a quadrilateral needs only one diagonal), got ' + D.GAME_CUT);
        tooSmall('cut: a vertex tap zone', 2 * C.pad);
        D.GAME_CUT.forEach(n => {
          const V = D.cutPts(n), R = regRef(n, C.cx, C.cy, C.r);
          if (V.length !== n || V.some((p, i) => dist(p, R[i]) > 1e-6)) fail('GAME cut: cutPts(' + n + ') is not the regular ' + n + '-gon with vertex 0 on top, clockwise');
          V.forEach((p, k) => inside(box(p.x, p.y, 2 * C.pad, 2 * C.pad), 'cut ' + n + ': vertex ' + k + ' tap zone', H));
          inside(box(V[0].x, V[0].y, D.GPICK, D.GPICK), 'cut ' + n + ': the pen', H);
          for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (dist(V[i], V[j]) <= 2 * C.pad) fail('GAME cut ' + n + ': the tap zones of vertices ' + i + ' and ' + j + ' overlap');
          if (dist(V[0], V[1]) <= C.pad + D.GPICK / 2) fail('GAME cut ' + n + ': the pen covers vertex 1’s tap zone');
          /* cutPick 整片畫板每 1px：和這裡自己的「pad 以內最近的頂點」一樣 */
          let wrong = 0;
          for (let x = 0; x <= W; x++) for (let y = 0; y <= H; y++){
            let best = null, bd = Infinity;
            R.forEach((p, k) => { const d0 = Math.hypot(x - p.x, y - p.y); if (d0 <= C.pad && d0 < bd){ bd = d0; best = k; } });
            if (D.cutPick(n, { x:x, y:y }) !== best && !wrong++) fail('GAME cutPick(' + n + '): (' + x + ', ' + y + ') → ' + D.cutPick(n, { x:x, y:y }) + ', the nearest vertex within ' + C.pad + 'px is ' + best);
          }
          for (let k = 0; k < n; k++){ const want = k === 0 ? 'self' : (k === 1 || k === n - 1 ? 'side' : null); if (D.cutRefuse(n, k) !== want) fail('GAME cutRefuse(' + n + ', ' + k + ') = ' + D.cutRefuse(n, k) + ', expected ' + want); }
          /* 每一種畫的順序都照規則走完 */
          const goods = []; for (let k = 2; k <= n - 2; k++) goods.push(k);
          const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
          let pbad = 0;
          perms(goods).forEach(order => {
            const drawn = [];
            order.forEach(k => {
              drawn.push(k);
              const regs = D.cutRegions(n, drawn);
              if (regs.length !== drawn.length + 1 || regs.some(v => v[0] !== 0)) { if (!pbad++) fail('GAME cutRegions(' + n + ', ' + drawn + '): ' + regs.length + ' pieces for ' + drawn.length + ' lines, or a piece without the red vertex'); }
              const sum = regs.reduce((s, v) => s + areaOf(v.map(i => V[i])), 0);
              if (Math.abs(sum - areaOf(V)) > 1e-6) { if (!pbad++) fail('GAME cutRegions(' + n + ', ' + drawn + '): the pieces do not fill the polygon'); }
            });
            const regs = D.cutRegions(n, drawn);
            if (regs.length !== n - 2 || regs.some(v => v.length !== 3)) { if (!pbad++) fail('GAME cut ' + n + ': after all ' + (n - 3) + ' diagonals (' + order + ') the pieces are not ' + (n - 2) + ' triangles'); }
          });
          LANGS.forEach(Lg => {
            const S0 = (n - 2) * 180;
            say('gCutTotal(' + n + ')', Lg, I18N[Lg].gCutTotal(n), [n, 2, n - 2, n - 2, 180, S0]);
            const done = I18N[Lg].gCutDone(n);
            if (say('gCutDone(' + n + ')', Lg, done, [n - 3, n - 2, 180, n - 2, 180, S0]) < 1) fail('GAME gCutDone ' + Lg + ': no equation verified');
            has('gCutDone(' + n + ')', Lg, done, { zh:[I18N.zh.plainName(n)], en:[I18N.en.plainName(n)] });
            const ask = I18N[Lg].gAsks.cut(n);
            say('gAsks.cut(' + n + ')', Lg, ask, []);
            has('gAsks.cut', Lg, ask, { zh:[I18N.zh.plainName(n), '紅色的頂點'], en:[I18N.en.plainName(n), 'red vertex'] });
            for (let m = 1; m <= n - 3; m++) say('gCut2(' + m + ')', Lg, I18N[Lg].gCut2(m), [m]);
            for (let dg = 0; dg < n - 3; dg++) say('gCutNow(' + dg + ')', Lg, I18N[Lg].gCutNow(dg, dg + 1), dg ? [dg, dg + 1] : []);
          });
        });
        LANGS.forEach(Lg => { say('gCutSide', Lg, I18N[Lg].gCutSide, []); has('gCutSide', Lg, I18N[Lg].gCutSide, { zh:['本來就有一條邊', '不相鄰', '對角線'], en:['already joined', 'not next to it', 'diagonal'] }); });
        need('cut', /useTapSelect\(B, function\(P, pt\)\{ judge\(cutPick\(n, pt\)\); return false; \}\);\s*B\.onBoardTap = function\(pt\)\{ judge\(cutPick\(n, pt\)\); \};/, 'cut: the vertex judged is not the one dropped on / tapped');
        need('cut', /function judge\(k\)\{\s*if \(k === null \|\| gSolved\) return;/, 'cut: a tap or drop away from every vertex is not silent (null would be drawn as a diagonal)');
        need('cut', /var bad = cutRefuse\(n, k\);\s*if \(bad === 'self' \|\| drawn\.indexOf\(k\) >= 0\) return;[^\n]*\s*if \(bad\)\{ missOnce\(seen, k, d\.gCutSide\); return; \}\s*drawn\.push\(k\);/, 'cut: a side, the red vertex or an already-joined vertex is not handled by the rule');
        need('cut', /if \(drawn\.length === n - 3\)\{ pen\.lock\(V\[0\]\.x, V\[0\]\.y\); roundSolved\(d\.gCutDone\(n\)\); \}/, 'cut: the round is solved when all n − 3 diagonals are drawn');
        need('cut', /cutRegions\(n, drawn\)\.forEach\(function\(v, m\)\{\s*if \(v\.length === 3\) fills\.appendChild/, 'cut: the shaded triangles are not the pieces cutRegions found');
        need('cut', /var n = pick\(GAME_CUT\), V = cutPts\(n\),/, 'cut: the polygon drawn is not cutPts of the pool entry');
        need('cut', /line\.textContent = drawn\.length === n - 3 \? d\.gCutTotal\(n\) : d\.gCutNow\(drawn\.length, drawn\.length \+ 1\);/, 'cut: the readout is not lines / pieces, then the total');
      }

      /* ---------- 第 3 關：每一個角 ---------- */
      {
        const E0 = D.EACH, H = D.EACH_H;
        if (D.GAME_EACH.join() !== '5,6,8,9,10,12') fail('GAME each: the pool should be 5, 6, 8, 9, 10, 12 (every angle a whole number; 3 and 4 too familiar), got ' + D.GAME_EACH);
        const reads = [['120', 120], [' 120 ', 120], ['120°', 120], ['0', 0], ['0120', null], ['1 20', null], ['12.0', null], ['', null], ['-5', null], ['120°°', null], ['abc', null], ['1234567', null]];
        reads.forEach(([raw, want]) => { if (D.eachRead(raw) !== want) fail('GAME eachRead("' + raw + '") = ' + D.eachRead(raw) + ', expected ' + want); });
        D.GAME_EACH.forEach(n => {
          const S0 = (n - 2) * 180, E = S0 / n, V = D.eachPts(n);
          if (!isInt(E)) fail('GAME each ' + n + ': each angle ' + E + ' is not whole');
          if (spread(sidesOf(V)) > 1e-6 || spread(anglesOf(V)) > 1e-6 || Math.abs(anglesOf(V)[0] - E) > 1e-6) fail('GAME each ' + n + ': eachPts is not a regular ' + n + '-gon with ' + E + '° angles');
          V.forEach((p, k) => inside(box(p.x, p.y, 10, 10), 'each ' + n + ': vertex ' + k, H));
          if (E0.arc >= sidesOf(V)[0] / 2) fail('GAME each ' + n + ': the angle arcs meet in the middle of a side');
          for (let x = 0; x <= 999999; x++){   /* eachRead 收到 999999 為止：整個範圍都要判對（codex 1b） */
            const r = D.eachJudge(n, x);
            const want = x === E ? null : (x === S0 ? 'sum' : (x === 180 ? 'tri' : 'wrong'));
            if ((r && r.k) !== (want || undefined) && !(r === null && want === null)){ fail('GAME eachJudge(' + n + ', ' + x + ') = ' + JSON.stringify(r) + ', expected ' + want); break; }
            if (want === 'wrong' && (r.Y !== n * x || r.big !== (x > E) || r.S !== S0)){ fail('GAME eachJudge(' + n + ', ' + x + '): Y / big / S wrong: ' + JSON.stringify(r)); break; }
          }
          if ((D.eachJudge(n, S0) || {}).k !== 'sum') fail('GAME eachJudge(' + n + ', ' + S0 + '): the angle sum must get its own reason');
          LANGS.forEach(Lg => {
            const T = I18N[Lg];
            say('gAsks.each(' + n + ')', Lg, T.gAsks.each(n), []);
            has('gAsks.each', Lg, T.gAsks.each(n), { zh:[T.polyName(n)], en:[T.polyName(n).toLowerCase()] });
            say('gEachSum(' + n + ')', Lg, T.gEachSum(n, S0), [S0, n, n]);
            say('gEachTri(' + n + ')', Lg, T.gEachTri(n), [180, n]);
            if (n - 2 <= 1) fail('GAME gEachTri: "more than one triangle" is false for n = ' + n);
            [0, 1, E - 1, E + 1, E - 12, E + 10, 179, 181, 360, S0 - 1, S0 + 1].forEach(x => {
              if (x === E || x === S0 || x === 180) return;
              const r = D.eachJudge(n, x), t = T.gEachWrong(n, x, r.Y, S0, r.big);
              if (say('gEachWrong(' + n + ', ' + x + ')', Lg, t, [x, n, n, x, n * x, n, 2, 180, S0, x]) < 2) fail('GAME gEachWrong ' + Lg + ': the two equations are not both verified — "' + t + '"');
              has('gEachWrong', Lg, t, x > E ? { zh:['太大'], en:['too big'] } : { zh:['太小'], en:['too small'] });
            });
            if (say('gEachDone(' + n + ')', Lg, T.gEachDone(n, S0, E), [n, 2, 180, S0, n, S0, n, E]) < 2) fail('GAME gEachDone ' + Lg + ': the equations are not verified');
            say('gEach2(' + n + ')', Lg, T.gEach2(n, S0), [n, 2, 180, S0, n]);
            say('gEachNow', Lg, T.gEachNow(E), [E]);
          });
        });
        LANGS.forEach(Lg => { say('gEachBlank', Lg, I18N[Lg].gEachBlank, [100, 0]); if (D.eachRead('100') !== 100) fail('GAME gEachBlank: its example 100 is not accepted'); });
        need('each', /var x = eachRead\(inp\.value\);\s*if \(x === null\)\{ roundNote\(d\.gEachBlank\); return; \}\s*var bad = eachJudge\(n, x\);/, 'each: the number judged is not the typed one, or a non-number is not just a reminder');
        need('each', /var text = bad\.k === 'sum' \? d\.gEachSum\(n, S\) : \(bad\.k === 'tri' \? d\.gEachTri\(n\) : d\.gEachWrong\(n, x, bad\.Y, S, bad\.big\)\);\s*missOnce\(seen, x, text\);/, 'each: the reason does not match the kind of mistake, or the same number costs again');
        need('each', /roundSolved\(d\.gEachDone\(n, S, E\)\);/, 'each: the message is not about this polygon');
        need('each', /var n = pick\(GAME_EACH\), V = eachPts\(n\), S = \(n - 2\) \* 180, E = S \/ n,/, 'each: the polygon drawn is not the pool entry');
      }

      /* ---------- 第 4 關：轉轉盤 ---------- */
      {
        const G = D.DIAL, H = D.DIAL_H;
        if (G.step !== 15 || G.start % 15 || G.start < 15 || G.start > 345) fail('GAME dial: the step must be 15° and the start a tick');
        const seenPQ = {};
        D.GAME_DIAL.forEach(([p, q]) => {
          const T = 360 * p / q;
          if (gcd(p, q) !== 1 || p >= q || !isInt(T) || T % 15 || T === G.start || q === 2 || seenPQ[p + '/' + q]) fail('GAME dial: pool entry ' + p + '/' + q + ' is not a reduced proper fraction of 15° steps, is 1/2, repeats, or is the start');
          seenPQ[p + '/' + q] = 1;
          for (let x = 15; x <= 345; x += 15){
            const r = D.dialRefuse(p, q, x);
            if (x === T){ if (r !== null) fail('GAME dialRefuse(' + p + '/' + q + ', ' + x + ') refuses the answer'); continue; }
            const g = gcd(x, 360);
            if (!r || r.a !== x / g || r.b !== 360 / g || r.less !== (x < T) || r.one !== (p > 1 && x * q === 360)){ fail('GAME dialRefuse(' + p + '/' + q + ', ' + x + ') = ' + JSON.stringify(r)); continue; }
            LANGS.forEach(Lg => {
              const t = I18N[Lg].gDialBad(x, r.a, r.b, p, q, r.less, r.one);
              say('gDialBad(' + p + '/' + q + ', ' + x + ')', Lg, t, [x, r.a, r.b, x, 360, p, q].concat(r.one ? [1, p, q, p] : []));
              has('gDialBad', Lg, t, r.less ? { zh:['比 ' + p + '/' + q + ' 小'], en:['less than ' + p + '/' + q] } : { zh:['比 ' + p + '/' + q + ' 大'], en:['more than ' + p + '/' + q] });
            });
          }
          LANGS.forEach(Lg => {
            const T2 = I18N[Lg];
            if (say('gDialDone(' + p + '/' + q + ')', Lg, T2.gDialDone(p, q), [360, q, 360 / q, p, 360 / q, p, T, T, p, q]) < 2) fail('GAME gDialDone ' + Lg + ': the equations are not verified');
            say('gDial2(' + p + '/' + q + ')', Lg, T2.gDial2(p, q), [360, q, 360 / q, 360 / q, p]);
            say('gAsks.dial', Lg, T2.gAsks.dial(p, q), [p, q]);
          });
        });
        /* dialSnap 整圈每 0.1°、三個半徑：四捨五入到最近的 15°（拖過正上方停在 345、15）；dialTap 只在圓周附近、而且正上方左右半格不算 */
        let bad = 0;
        for (let t10 = 0; t10 < 3600; t10++){
          const t = t10 / 10;
          [40, G.r, G.r + G.band - 0.5].forEach(rr => {
            const pt = { x:G.cx + rr * Math.sin(t * Math.PI / 180), y:G.cy - rr * Math.cos(t * Math.PI / 180) };
            let k = Math.round(t / 15); if (k >= 24) k = 23; if (k < 1) k = 1;
            if (Math.abs((t / 15) % 1 - 0.5) < 1e-6) return;   /* 正好在兩格中間：哪一格都可以 */
            if (D.dialSnap(pt) !== k * 15 && !bad++) fail('GAME dialSnap(): ' + t + '° (r ' + rr + ') → ' + D.dialSnap(pt) + ', expected ' + k * 15);
            /* 點圓周：每一條刻度只管自己的 ±7.5°；正上方（固定的半徑）左右半格不算任何一格 */
            const tap = D.dialTap(pt), wantTap = Math.abs(rr - G.r) <= G.band && t > 7.5 && t < 352.5 ? k * 15 : null;
            if (tap !== wantTap && !bad++) fail('GAME dialTap(): ' + t + '° at radius ' + rr + ' → ' + tap + ', expected ' + wantTap);
          });
        }
        [G.r - G.band - 1, G.r + G.band + 1, 0, 20].forEach(rr => { if (D.dialTap({ x:G.cx + rr, y:G.cy }) !== null) fail('GAME dialTap(): a tap ' + rr + 'px from the centre (off the rim) sets an angle'); });
        /* 每一格（每一條刻度）各管自己的 ±7.4° */
        for (let t = 15; t <= 345; t += 15) [-7.4, 0, 7.4].forEach(o => { const a = (t + o) * Math.PI / 180; if (D.dialSnap({ x:G.cx + G.r * Math.sin(a), y:G.cy - G.r * Math.cos(a) }) !== t) fail('GAME dialSnap(): ' + (t + o) + '° is not the ' + t + '° tick’s'); });
        /* 版面：圓、刻度、旋鈕（任何角度）都在畫板裡 */
        inside(box(G.cx, G.cy, 2 * (G.r + 7) + 2, 2 * (G.r + 7) + 2), 'dial: the dial and its ticks', H);
        for (let t = 15; t <= 345; t += 15){ const a = t * Math.PI / 180; inside(box(G.cx + G.r * Math.sin(a), G.cy - G.r * Math.cos(a), D.GPICK, D.GPICK), 'dial: the knob at ' + t + '°', H); }
        LANGS.forEach(Lg => { [15, 135, 345].forEach(x => say('gDialNow', Lg, I18N[Lg].gDialNow(x), [x])); });
        need('dial', /snap:function\(pt\)\{ return rimPt\(DIAL\.cx, DIAL\.cy, DIAL\.r, dialSnap\(pt\)\); \},\s*onPlace:function\(P\)\{ var v = dialSnap\(\{ x:P\.cx, y:P\.cy \}\); if \(v !== x\) show\(v\); \}/, 'dial: the knob does not snap to a tick while dragged, or the drawing does not follow it');
        need('dial', /if \(gSolved \|\| knob\.busy\(\)\) return;   \/\* 旋鈕正被拖著/, 'dial: That’s it judges while the knob is held');
        need('dial', /if \(bad\)\{ missOnce[^\n]*return; \}\s*knob\.lock\(knob\.cx, knob\.cy\);\s*less\.disabled = more\.disabled = ok\.disabled = true;\s*roundSolved\(d\.gDialDone\(p, q\)\);/, 'dial: the right angle does not lock the knob, turn the buttons off and solve the round');
        need('dial', /var bad = dialRefuse\(p, q, x\);\s*if \(bad\)\{ missOnce\(seen, x, d\.gDialBad\(x, bad\.a, bad\.b, p, q, bad\.less, bad\.one\)\); return; \}/, 'dial: the angle judged is not the one shown, or the reason does not match');
        need('dial', /function show\(v\)\{\s*x = v;[\s\S]{0,300}sec\.setAttribute\('d', sectorD\(DIAL\.cx, DIAL\.cy, DIAL\.r, v\)\);\s*arm\.setAttribute\('x2', r\.x\); arm\.setAttribute\('y2', r\.y\);\s*line\.textContent = d\.gDialNow\(v\);/, 'dial: the sector, the arm and the readout do not all show the angle judged');
        need('dial', /var e = pick\(GAME_DIAL\), p = e\[0\], q = e\[1\], x = DIAL\.start,/, 'dial: the target is not the pool entry, or it does not start at DIAL.start');
        need('dial', /var a0 = rimPt\(DIAL\.cx, DIAL\.cy, DIAL\.r, x\);\s*var arm = svgEl\('line', \{ x1:DIAL\.cx, y1:DIAL\.cy, x2:a0\.x, y2:a0\.y,/, 'dial: the arm does not start at the start angle');
        need('dial', /B\.onBoardTap = function\(pt\)\{ var v = dialTap\(pt\); if \(v !== null\) setX\(v\); \};/, 'dial: tapping the rim does not set the angle');
        need('dial', /less\.addEventListener\('click', function\(\)\{ if \(!gSolved && !knob\.busy\(\) && x > DIAL\.step\) setX\(x - DIAL\.step\); \}\);/, 'dial: ◀ does not turn back one step (or works while held / below 15°)');
        need('dial', /more\.addEventListener\('click', function\(\)\{ if \(!gSolved && !knob\.busy\(\) && x < 360 - DIAL\.step\) setX\(x \+ DIAL\.step\); \}\);/, 'dial: ▶ does not turn on one step (or works while held / past 345°)');
      }

      /* ---------- 第 5 關：拼分數 ---------- */
      {
        const F = D.FRAC, H = D.FRAC_H;
        const seenA = {};
        D.GAME_FRAC.forEach(A => {
          const g = gcd(A, 360), P = A / g, Q = 360 / g;
          if (A <= 0 || A >= 360 || seenA[A] || P > 9 || Q > 9) fail('GAME frac: ' + A + '° (' + P + '/' + Q + ') repeats or cannot be built from one-digit cards');
          seenA[A] = 1;
          const goods = [];
          for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++){
            const r = D.fracJudge(A, a, b);
            if (a * 360 === A * b){ goods.push(a + '/' + b); if (r !== null) fail('GAME fracJudge(' + A + ', ' + a + '/' + b + ') refuses the answer'); continue; }
            const want = a >= b ? 'big' : ((360 * a) % b === 0 ? 'int' : 'frac');
            if (!r || r.k !== want || (want === 'int' && r.y !== 360 * a / b)){ fail('GAME fracJudge(' + A + ', ' + a + '/' + b + ') = ' + JSON.stringify(r) + ', expected ' + want); continue; }
            LANGS.forEach(Lg => {
              const T = I18N[Lg];
              if (want === 'big') say('gFracBig', Lg, T.gFracBig(a, b), [a, b]);
              else if (want === 'int'){ if (say('gFracInt', Lg, T.gFracInt(a, b, r.y, A), [a, b, 360, b, a, r.y, A]) < 1) fail('GAME gFracInt ' + Lg + ': the equation is not verified'); if (r.y === A) fail('GAME gFracInt: says not ' + A + '° but it is'); }
              else { say('gFracNoInt', Lg, T.gFracNoInt(a, b, A), [360, b, a, b, A]); if (360 % b === 0) fail('GAME gFracNoInt: "360 ÷ ' + b + ' does not divide evenly" is false'); }
            });
          }
          if (goods.join() !== P + '/' + Q) fail('GAME frac ' + A + '°: the cards accept ' + goods.join(' ') + ' — only the simplest form ' + P + '/' + Q + ' may be buildable');
          LANGS.forEach(Lg => {
            const T = I18N[Lg];
            say('gFracDone(' + A + ')', Lg, T.gFracDone(A, P, Q, g), [A, 360, A, 360, g, P, Q]);
            say('gFrac2(' + A + ')', Lg, T.gFrac2(A, g), [A, 360, g]);
            say('gAsks.frac(' + A + ')', Lg, T.gAsks.frac(A), [A]);
          });
          if (g !== gcd(A, 360) || A / g !== P) fail('GAME frac: the done message would divide by the wrong number');
        });
        /* 版面：九張卡、兩個格子、扇形 */
        const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(v => { const at = D.fracCardXY(v); return box(at.x, at.y, F.cardS, F.cardS); });
        cards.forEach((c, i) => inside(c, 'frac: card ' + (i + 1), H));
        noHits(cards, 'frac: cards');
        tooSmall('frac: card', F.cardS);
        const sl = D.fracSlots();
        if (sl.length !== 2 || !(sl[0].cy < sl[1].cy) || sl[0].cx !== sl[1].cx) fail('GAME frac: the numerator box must sit straight above the denominator box');
        const slotBoxes = sl.map(s => ({ x:s.cx - s.hw - F.pad, y:s.cy - s.hh - F.pad, w:2 * (s.hw + F.pad), h:2 * (s.hh + F.pad) }));
        slotBoxes.forEach((b, i) => { inside(b, 'frac: the slots ' + i, H); if (cards.some(c => hit(c, b))) fail('GAME frac: a card’s home sits inside a box’s drop zone'); });
        if (hit(slotBoxes[0], slotBoxes[1])) fail('GAME frac: the slots’ drop zones overlap');
        if (F.cardS > F.slotS) fail('GAME frac: a card is bigger than its box');
        const sec = box(F.cx, F.cy, 2 * F.r + 4, 2 * F.r + 4);
        inside(sec, 'frac: the sector', H);
        if (cards.concat(slotBoxes).some(c => hit(c, sec))) fail('GAME frac: the slots or cards cover the sector');
        LANGS.forEach(Lg => { say('gFracNow', Lg, I18N[Lg].gFracNow(3, 8), [3, 8]); say('gFracNow', Lg, I18N[Lg].gFracNow(null, null), []); });
        need('frac', /var a = slots\[0\]\.P\.data\.v, b = slots\[1\]\.P\.data\.v, bad = fracJudge\(A, a, b\);/, 'frac: the fraction judged is not top card / bottom card');
        need('frac', /if \(slots\[0\]\.P && slots\[1\]\.P\)\{/, 'frac: it does not wait until both boxes are filled');
        need('frac', /var a = slots\[0\]\.P\.data\.v, b = slots\[1\]\.P\.data\.v, bad = fracJudge\(A, a, b\);\s*if \(!bad\)\{ roundSolved\(d\.gFracDone\(A, a, b, g\)\); return true; \}/, 'frac: the right fraction does not solve the round');
        need('frac', /B\.onBoardTap = function\(pt\)\{\s*slots\.forEach\(function\(s\)\{ if \(s\.P && Math\.abs\(pt\.x - s\.cx\) <= s\.hw && Math\.abs\(pt\.y - s\.cy\) <= s\.hh\)\{ take\(s\); line\.textContent = now\(\); \} \}\);/, 'frac: tapping a placed card does not take it back');
        need('frac', /function take\(s\)\{ var P = s\.P; s\.P = null; s\.done = false; s\.z\.classList\.remove\('filled'\); P\.unlock\(\); \}/, 'frac: taking a card back does not empty its box and unlock the card');
        need(null, /P\.unlock = function\(\)\{\s*P\.locked = false;\s*el\.classList\.remove\('locked'\);\s*P\.home\(\);\s*\};/, 'frac: an unlocked card does not go home and become movable again');
        need('frac', /take\(slots\[0\]\); take\(slots\[1\]\);\s*line\.textContent = now\(\);\s*missOnce\(seen, a \+ '\/' \+ b, bad\.k === 'big' \? d\.gFracBig\(a, b\) : \(bad\.k === 'int' \? d\.gFracInt\(a, b, bad\.y, A\) : d\.gFracNoInt\(a, b, A\)\)\);/, 'frac: a wrong fraction does not send both cards back with the matching reason');
        need('frac', /var sl = nearestOpen\(slots, pt, FRAC\.pad\);\s*if \(!sl\) return false;/, 'frac: the box is not picked by nearestOpen');
        need('frac', /return addPiece\(B, \{ w:FRAC\.cardS, h:FRAC\.cardS, cx:at\.x, cy:at\.y, text:String\(v\), cls:'gcard gnumcard', data:\{ v:v \} \}\);/, 'frac: a card does not show the digit it is judged by');
        need('frac', /svg\.appendChild\(svgEl\('path', \{ d:sectorD\(FRAC\.cx, FRAC\.cy, FRAC\.r, A\),/, 'frac: the sector drawn is not A°');
        need('frac', /var A = pick\(GAME_FRAC\), g = gGcd\(A, 360\),/, 'frac: the angle is not the pool entry');
      }
    }
  }
};
