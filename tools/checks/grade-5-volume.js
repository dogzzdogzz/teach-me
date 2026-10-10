/* grade-5/math/volume 的檢查設定（體積積木塔：長方體、正方體的體積，容積與 1 立方公分 ＝ 1 毫升、1000 立方公分 ＝ 1 公升）。
   2026-10-10 新增 —— 和小遊戲「搬家公司」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，不呼叫頁面的 fmt）、
   選項的形狀與範圍（範圍從各產生器自己的題庫推出來）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）裡「數 ＝ 數」的每一個等號逐個重算；範例 1、2 的兩句說明在每一種長寬高組合下逐條重算。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍，答案用這裡自己的算法重算：
       鋪一層 —— 三種長度 × 每一排，只有剛好 L 塊的收，鋪滿 W 排剛好 L × W 塊；
       疊幾層 —— 每一個高度按「裝好了」，只有 L × W × h ＝ V 的收，說的塊數、少／多都要成立；
       排大小 —— 每一張卡 × 每一格，「正方體只乘兩次／乘 3 會被排到最少、可是它不是最少」「最高的不是最多」每一組都成立；
       換成公升 —— 每一張標籤 × 每一個水箱，剛好一張配一個，多的那一張是某個水箱差 10 倍；
       找一樣大 —— 每一箱算體積，剛好的有 2～3 箱、不對的至少 2 箱、而且有一箱「長寬高加起來一樣」卻不一樣大。
     立體圖：每一個箱子的三個面、格線、標籤用這裡自己的斜二測重畫一次比對，標籤（估計字寬）放得進框；
     nearestOpen()、roundMiss()、missOnce() 從原始碼切出來真的跑；托盤 3000 次不出現答案的排法；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 裡「判斷的是丟下去／點下去的那一個」與拖拉引擎的保護，用原始碼形狀守住（need()）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   真正的字寬（文字放不放得進框）、375px 的實際尺寸由 teaching-workspace/game-harness/g5-volume 的端對端測試驗（合成 PointerEvent，從畫出來的圖讀數）。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const crypto = require('crypto');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const arithGame = makeArith({ units:['立方公分', '平方公分', '公分', '毫升', '塊', '層', '排', '箱', '分'], unitsEn:['cubic cm', 'square cm', 'cm', 'mL', 'cubes?', 'layers?', 'rows?', 'boxes', 'points'] });
/* 換單位的等號（「1000 立方公分 ＝ 1 公升」）不是算術：公升先換成毫升數再驗（1 公升 → 1000 毫升），兩邊才是同一個數 */
/* 等號左邊是字（規則、名稱：「長 × 寬 ＝」「底 × 高 ÷ 2 ＝」「一層 ＝」）的不是宣稱 —— 換成冒號，只驗數的那一段 */
const ruleFix = s => String(s).replace(/([A-Za-z一-鿿])\s*÷\s*2\s*[=＝]/g, '$1：').replace(/([^\d\s)])\s*[=＝]/g, '$1：');
const literNorm = s => String(s).replace(/(\d+(?:\.\d+)?)\s*(公升|L\b|liters?\b)/g, (m, v) => Math.round(+v * 1000) + (/[a-z]/i.test(m.slice(-1)) ? ' mL' : ' 毫升'));

/* 靜態字串的等號：每一個「數的算式 ＝ 數的算式」逐個重算。左邊緊貼著運算子的是規則式，不是宣稱，另外數。 */
function chainClaims(text){
  /* 換單位：公升先換成毫升，再把體積／容量的單位拿掉 —— 「1000 立方公分 ＝ 1 公升」變成 1000 ＝ 1000，才驗得到 */
  const t = literNorm(String(text).replace(/<[^>]+>/g, ' ')).replace(/(\d)\s*(?:立方公分|毫升|cubic cm|cubic centimeters|milliliters?|mL)/g, '$1').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/＋/g, '+').replace(/[－−–]/g, '-').replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/＝/g, '=').replace(/,(?=\d{3})/g, '');
  const out = { claims:[], rules:0 };
  t.split(/[，。；;,\n]|(?:\s—\s)|——/).forEach(cl => {
    const seg = cl.split('=');
    for (let i = 0; i + 1 < seg.length; i++){
      const L = seg[i].match(/([\d\s+\-*/().]*\d[\d\s+\-*/().]*)$/), R = seg[i + 1].match(/^([\d\s+\-*/().]*\d[\d\s+\-*/().]*)/);
      if (!L || !R) continue;
      let le = L[1].trim(), re = R[1].trim();
      const before = seg[i].slice(0, seg[i].length - L[1].length).trim();
      if (/^[+\-*/]/.test(le) || /[+\-*/]$/.test(before)) { out.rules++; continue; }
      const bal = s => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
      if (bal(le) < 0) { out.rules++; continue; }
      while (bal(re) > 0) re = re.replace(/\([^()]*$/, '').trim();
      while (bal(re) < 0) re = re.replace(/\)\s*$/, '').trim();
      if (!re || !/\d/.test(re)) continue;
      let a, b;
      try { a = Function('return (' + le + ')')(); b = Function('return (' + re + ')')(); } catch (e){ out.claims.push({ text:le + ' = ' + re, bad:'cannot evaluate' }); continue; }
      out.claims.push({ text:le + ' = ' + re, bad:Math.abs(a - b) > 1e-9 ? 'left is ' + a + ', right is ' + b : null });
    }
  });
  return out;
}

const W = 300;
/* 自己的斜二測：往後一格 ＝ 往右 0.4、往上 0.3 格（和頁面各寫各的） */
const OB = { dx:0.4, dy:0.3 };
const projRef = (o, u, p) => ({ x:o.x + (p[0] + p[2] * OB.dx) * u, y:o.y - (p[1] + p[2] * OB.dy) * u });
const vol = b => b[0] * b[1] * b[2];

module.exports = {
  breaks: [
    { file:"index", expect:"GAME_ORDER should be", find:"var GAME_ORDER = ['layer', 'stack', 'cube', 'liter', 'find'];", replace:"var GAME_ORDER = ['stack', 'layer', 'cube', 'liter', 'find'];" },
    { file:"index", expect:"under 44", find:"  var GPICK = 48;", replace:"  var GPICK = 40;" },
    { file:"index", expect:"shuffle(): only", find:"      var k = Math.floor(Math.random() * (j + 1));   /* 自足", replace:"      var k = j;   /* 自足" },
    { file:"index", expect:"started in the answer order", find:"    if (inOrder(t)){ var x = t[0]; t[0] = t[1]; t[1] = x; }\n", replace:"" },
    { file:"index", expect:"scoring: a round should give", find:"    var pts = gMistake ? 10 : 20;", replace:"    var pts = 20;" },
    { file:"index", expect:"roundMiss() at", find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", replace:"    elScore.textContent = gScore;" },
    { file:"index", expect:"roundMiss() at", find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:"index", expect:"does not clear the hint", find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:"index", expect:"does not clear the hint glow", find:"gameStage.querySelectorAll('.sel, .gglow'), function(x){ x.classList.remove('sel'); x.classList.remove('gglow'); });", replace:"gameStage.querySelectorAll('.sel'), function(x){ x.classList.remove('sel'); });" },
    { file:"index", expect:"nearestOpen() disagrees", find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:"index", expect:"nearestOpen() disagrees", find:"    return best && !best.done ? best : null;\n  }\n\n  function roundSolved", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  function roundSolved" },
    { file:"index", expect:"does not start a new board generation", find:"gSolved = false; gMistake = false; gCtx = {}; gGen++; BOARD_TAP = null; PIECE_PTR = {};", replace:"gSolved = false; gMistake = false; gCtx = {}; BOARD_TAP = null; PIECE_PTR = {};" },
    { file:"index", expect:"does not check its board generation", find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板", replace:"      /* 這一塊屬於已經拿掉的畫板" },
    { file:"index", expect:"can be picked up by a second finger", find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:"index", expect:"losing pointer capture no longer", find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:"" },
    { file:"index", expect:"can start a board tap", find:"      if (!e.isPrimary) return;   /* 第二根手指", replace:"      /* 第二根手指" },
    { file:"index", expect:"does not snap to a layer while", find:"if (o.axis === 'y') P.place(orig.x, o.snapY(orig.y + dy));", replace:"if (o.axis === 'y') P.place(orig.x, orig.y + dy);" },
    { file:"index", expect:"placed pieces still catch taps", find:".gpiece.locked{cursor:default;pointer-events:none}", replace:".gpiece.locked{cursor:default}" },
    { file:"index", expect:"gets a viewBox", find:"var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, 'aria-hidden':'true' });", replace:"var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, viewBox:'0 0 ' + B.W + ' ' + B.H, 'aria-hidden':'true' });" },
    { file:"index", expect:"ahead mode no longer", find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"    if (mode === 'ahead'){ hintLevel = 1; }" },
    { file:"index", expect:"not disabled after the second level", find:"    if (hintLevel >= 2) gHintBtn.disabled = true;", replace:"" },
    { file:"index", expect:"missOnce(): wrong A, B", find:"    if (seen.keys[key]){ if (seen.last !== key){ seen.last = key; roundAgain(text); } return; }", replace:"    if (seen.keys[key] && seen.last === key) return;" },
    { file:"index", expect:"roundAgain() must only", find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){ gMistake = true; gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }" },
    { file:"index", expect:"the same wrong row could be charged twice", find:"if (bad){ missOnce(seen, P.data.n, bad === 'long'", replace:"if (bad){ roundMiss(bad === 'long'" },
    { file:"index", expect:"layerRefuse(", find:"  function layerRefuse(L, n){ return n === L ? null", replace:"  function layerRefuse(L, n){ return n >= L ? null" },
    { file:"index", expect:"the tray should hold", find:"  function layerTray(L){ return shuffle([L - 1, L, L + 1]); }", replace:"  function layerTray(L){ return shuffle([L - 1, L, L + 2]); }" },
    { file:"index", expect:"is not the j-th strip", find:"cy:LAYER.gy + j * LAYER.U + LAYER.U / 2, hw:", replace:"cy:LAYER.gy + j * LAYER.U, hw:" },
    { file:"index", expect:"tray slots / floor", find:"var LAYER = { U:32, gy:44, gap:30,", replace:"var LAYER = { U:32, gy:44, gap:4," },
    { file:"index", expect:"L must be 3..5", find:"[[3, 2], [4, 2], [4, 3],", replace:"[[6, 2], [4, 2], [4, 3]," },
    { file:"index", expect:"the tray is not refilled", find:"        addRod(Lx, P.data.slot);   /* 托盤同一個位置", replace:"        /* 托盤同一個位置" },
    { file:"index", expect:"gLayerLong zh: numbers", find:"'這一排有 ' + n + ' 塊，箱子一排只放得下 ' + L + ' 塊", replace:"'這一排有 ' + n + ' 塊，箱子一排只放得下 ' + n + ' 塊" },
    { file:"index", expect:"must say \"gap\"", find:"so it would leave a gap — every row", replace:"so it would not fill up — every row" },
    { file:"index", expect:"gLayerDone zh", find:"' 塊，' + W + ' × ' + L + ' ＝ ' + (L * W) + ' 塊 —— 就是", replace:"' 塊，' + W + ' × ' + L + ' ＝ ' + (L * W + 1) + ' 塊 —— 就是" },
    { file:"index", expect:"stackRefuse at", find:"var x = L * W * h; return x === V ? null : { x:x, less:x < V }; }", replace:"var x = L * W * h; return x >= V ? null : { x:x, less:x < V }; }" },
    { file:"index", expect:"stackRefuse at", find:"return x === V ? null : { x:x, less:x < V }; }\n\n  /* ---- 第 3 關", replace:"return x === V ? null : { x:x, less:x > V }; }\n\n  /* ---- 第 3 關" },
    { file:"index", expect:"stackH(", find:"Math.round((STACK.oy - y) / STACK.U)", replace:"Math.floor((STACK.oy - y) / STACK.U)" },
    { file:"index", expect:"is not a whole number of layers", find:"[[4, 3, 36], [3, 2, 24],", replace:"[[4, 3, 35], [3, 2, 24]," },
    { file:"index", expect:"judges while the handle is still held", find:"        if (gSolved || grip.busy()) return;   /* 把手正被拖著", replace:"        if (gSolved) return;   /* 把手正被拖著" },
    { file:"index", expect:"gStackBad", find:"' 塊，比 ' + V + ' 塊' + (less ? '少' : '多') + '。'; },", replace:"' 塊，比 ' + V + ' 塊' + (less ? '多' : '少') + '。'; }," },
    { file:"index", expect:"gStackDone en", find:"' — exactly right! You can also work backwards: ' + V + ' ÷ ' + (L * W) + ' = ' + h + '.'; },", replace:"' — exactly right! You can also work backwards: ' + V + ' ÷ ' + (L * W) + ' = ' + (h + 1) + '.'; }," },
    { file:"index", expect:"must say \"1 立方公分\"", find:"小方塊（一塊是 1\\u00a0立方公分）。", replace:"小方塊。" },
    { file:"index", expect:"does not judge the shown height", find:"        var bad = stackRefuse(Lx, Wd, hh, V);", replace:"        var bad = stackRefuse(Lx, Wd, STACK.h0, V);" },
    { file:"index", expect:"cubeRefuse(", find:"x = boxVol(b); return x === boxVol(want) ? null", replace:"x = boxVol(b); return true ? null" },
    { file:"index", expect:"the cube is the least", find:"[[3, 3, 3], [5, 3, 2], [2, 2, 6]],", replace:"[[3, 3, 3], [5, 3, 2], [2, 2, 7]]," },
    { file:"index", expect:"the tallest box must be unique and not the biggest", find:"[[4, 4, 4], [5, 3, 4], [4, 2, 6]],", replace:"[[4, 4, 4], [5, 3, 4], [4, 2, 9]]," },
    { file:"index", expect:"would not put the cube last", find:"[[3, 3, 3], [2, 2, 6], [4, 4, 2]]", replace:"[[3, 3, 3], [1, 1, 8], [4, 4, 2]]" },
    { file:"index", expect:"must say \"三個邊長\"", find:"(cube ? '這個正方體三個邊長都要乘：' : '這一箱：')", replace:"(cube ? '這個正方體：' : '這一箱：')" },
    { file:"index", expect:"gCubeBad en", find:"'\\u00a0cubic cm — ' + (less ? 'less' : 'more') + ' than the box", replace:"'\\u00a0cubic cm — ' + (less ? 'more' : 'less') + ' than the box" },
    { file:"index", expect:"too short for one line", find:"lblY:126, lblH:26,", replace:"lblY:126, lblH:18," },
    { file:"index", expect:"snap margin reaches the tray", find:"slotW:96, slotH:108, pad:10 }, CUBE_H", replace:"slotW:96, slotH:108, pad:20 }, CUBE_H" },
    { file:"index", expect:"accept zone is not its label plus its box", find:"var top = CUBE.lblY, bottom = CUBE.slotY + CUBE.slotH / 2;", replace:"var top = CUBE.slotY - CUBE.slotH / 2, bottom = CUBE.slotY + CUBE.slotH / 2;" },
    { file:"index", expect:"the readout does not show the same height", find:"        line.textContent = d.gStackNow(hh);\n      }", replace:"        line.textContent = d.gStackNow(hh + 1);\n      }" },
    { file:"index", expect:"startRound() can return early", find:"    var type = GAME_ORDER[gRound];\n    gSolved = false;", replace:"    var type = GAME_ORDER[gRound];\n    if (gScore === 0 && gRound > 0) return;\n    gSolved = false;" },
    { file:"index", expect:"GAME pin: RENDER.layer", find:"        var bad = layerRefuse(Lx, P.data.n);\n", replace:"        var bad = layerRefuse(Lx, P.data.n);\n        if (!bad && P.data.n === Lx && done === 1) bad = 'short';\n" },
    { file:"index", expect:"GAME pin: RENDER.layer", find:"        addRod(Lx, P.data.slot);   /* 托盤同一個位置再補一排 L 塊 */", replace:"        if (false) addRod(Lx, P.data.slot);   /* 托盤同一個位置再補一排 L 塊 */" },
    { file:"index", expect:"the labels are not length", find:"    return (keys || ['l', 'w', 'h']).map(function(k){ return all[k]; });", replace:"    return (keys || ['l', 'w']).map(function(k){ return all[k]; });" },
    { file:"index", expect:"the height label is not just left", find:"h:{ k:'h', v:h, x:-S.gap, y:-h * u / 2 + S.gap, a:'end' },", replace:"h:{ k:'h', v:h, x:-S.gap, y:-h * u + S.gap, a:'end' }," },
    { file:"index", expect:"the grid lines are not one per cm", find:"for (i = 1; i < w; i++){ out.push(['top', [0, h, i], [l, h, i]]);", replace:"for (i = 1; i < w; i++){ out.push(['top', [0, h, 1], [l, h, 1]]);" },
    { file:"index", expect:"boxPt() is not the oblique projection", find:"  function boxPt(o, u, x, y, z){ return { x:o.x + (x + z * OBL.dx) * u,", replace:"  function boxPt(o, u, x, y, z){ return { x:o.x + (x + z * OBL.dx) * u + (x === 0 && y > 0 && z === 0 ? 1 : 0)," },
    { file:"index", expect:"the height label is not just left", find:"TANKLBL = { font:12, cw:7.4, asc:9.5, desc:3, gap:4, below:13 };", replace:"TANKLBL = { font:12, cw:7.4, asc:9.5, desc:3, gap:0, below:13 };" },
    { file:"index", expect:"is 10 times off tank", find:"    [[[10, 10, 5], [10, 10, 10], [20, 10, 10]], [[500, 'mL'], [1000, 'L'], [2000, 'L'], [5000, 'L']]],", replace:"    [[[10, 10, 5], [10, 10, 10], [20, 10, 50]], [[500, 'mL'], [1000, 'L'], [10000, 'L'], [5000, 'L']]]," },
    { file:"index", expect:"too small to read", find:"[[[5, 4, 5], [15, 10, 10],", replace:"[[[10, 5, 2], [15, 10, 10]," },
    { file:"index", expect:"the same box turned", find:"[60, [[5, 3, 4], [5, 2, 6], [4, 4, 3],", replace:"[60, [[5, 3, 4], [5, 2, 6], [4, 3, 5]," },
    { file:"index", expect:"separated by a breakable space", find:"gTag: function(ml, unit){ return unit === 'L' ? (ml / 1000) + '\\u00a0L'", replace:"gTag: function(ml, unit){ return unit === 'L' ? (ml / 1000) + ' L'" },
    { file:"index", expect:"a decoy is accidentally right", find:"[48, [[4, 2, 6], [4, 4, 3], [4, 4, 4], [5, 2, 5], [5, 3, 3], [5, 2, 4]]]", replace:"[48, [[4, 2, 6], [4, 4, 3], [4, 4, 4], [5, 2, 5], [5, 3, 3], [4, 3, 4]]]" },
    { file:"index", expect:"touch top to bottom", find:"frameX:[52, 150, 248], frameY:[64, 192], frameW:94, frameH:124", replace:"frameX:[52, 150, 248], frameY:[64, 188], frameW:94, frameH:124" },
    { file:"index", expect:"does not fit its frame", find:"var CUBE = { u:9,", replace:"var CUBE = { u:12," },
    { file:"index", expect:"gCubeSlots should read", find:"gCubeSlots: ['least', 'middle', 'most'],", replace:"gCubeSlots: ['most', 'middle', 'least']," },
    { file:"index", expect:"does not judge with cubeRefuse", find:"var b = P.data.b, bad = cubeRefuse(e, b, s.i);", replace:"var b = P.data.b, bad = cubeRefuse(e, b, 1);" },
    { file:"index", expect:"literRefuse(", find:"function literRefuse(b, ml){ var x = boxVol(b); return x === ml ? null", replace:"function literRefuse(b, ml){ var x = boxVol(b); return x >= ml ? null" },
    { file:"index", expect:"is not any tank off by 10 times", find:"[2000, 'L'], [5000, 'L']]],", replace:"[2000, 'L'], [6000, 'L']]]," },
    { file:"index", expect:"gTag zh", find:"return unit === 'L' ? (ml / 1000) + '\\u00a0公升' : ml + '\\u00a0毫升'; },", replace:"return unit === 'L' ? (ml / 100) + '\\u00a0公升' : ml + '\\u00a0毫升'; }," },
    { file:"index", expect:"gLiterChain en", find:"'\\u00a0cubic cm = ' + x + '\\u00a0mL' + (x >= 1000 ? ' = ' + (x / 1000) + '\\u00a0L' : ''); },", replace:"'\\u00a0cubic cm = ' + x + '\\u00a0mL'; }," },
    { file:"index", expect:"does not fit its frame", find:"var LITER = { u:2,", replace:"var LITER = { u:3," },
    { file:"index", expect:"two tanks hold the same amount", find:"[[[20, 10, 5], [10, 5, 5], [20, 10, 15]]", replace:"[[[20, 10, 5], [10, 10, 10], [20, 10, 15]]" },
    { file:"index", expect:"must say \"不是\"", find:"return '這個水箱 ' + chain + '，不是 ' + tag + '。'; },", replace:"return '這個水箱 ' + chain + '，' + tag + '。'; }," },
    { file:"index", expect:"does not have exactly one label", find:"[[400, 'mL'], [2400, 'L'], [2000, 'L'], [4000, 'L']]", replace:"[[400, 'mL'], [2500, 'L'], [2000, 'L'], [4000, 'L']]" },
    { file:"index", expect:"the same label on the same wrong tank could be charged twice", find:"if (literRefuse(t.b, P.data.ml)){ missOnce(seen, P.data.ml + '@' + t.i, ", replace:"if (literRefuse(t.b, P.data.ml)){ missOnce(seen, P.data.ml + '@' + Math.random(), " },
    { file:"index", expect:"findPick():", find:"if (pt.x >= f.x && pt.x <= f.x + f.w && pt.y >= f.y && pt.y <= f.y + f.h) return i; }", replace:"if (pt.x >= f.x - 4 && pt.x <= f.x + f.w + 4 && pt.y >= f.y && pt.y <= f.y + f.h) return i; }" },
    { file:"index", expect:"right and", find:"[36, [[4, 3, 3], [3, 2, 6],", replace:"[36, [[4, 3, 3], [3, 2, 5]," },
    { file:"index", expect:"two boxes are the same box", find:"[48, [[4, 2, 6], [4, 4, 3], [4, 4, 4],", replace:"[48, [[4, 2, 6], [4, 4, 3], [4, 2, 6]," },
    { file:"index", expect:"tapping a found box again is judged", find:"        if (F.found) return;\n", replace:"" },
    { file:"index", expect:"gFindNo zh", find:"gFindNo: function(f, x, V){ return f + ' ＝ ' + x + '\\u00a0立方公分，不是 ' + V + '。'; },", replace:"gFindNo: function(f, x, V){ return f + ' ＝ ' + x + '\\u00a0立方公分，不是 ' + (V + 1) + '。'; }," },
    { file:"index", expect:"caption strip is too short", find:"frameW:94, frameH:124, capH:28 }", replace:"frameW:94, frameH:124, capH:16 }" },
    { file:"index", expect:"does not fit its frame", find:"var FIND = { u:9,", replace:"var FIND = { u:12," },
    { file:"index", expect:"a repeated wrong box could be charged twice", find:"          missOnce(seen, i, d.gFindNo(", replace:"          roundMiss(d.gFindNo(" },
    { file:"index", expect:"the hint's warning is never tested", find:"[30, [[5, 2, 3], [5, 1, 6], [3, 3, 3], [4, 2, 4], [2, 2, 6], [4, 1, 6]]]", replace:"[30, [[5, 2, 3], [5, 1, 6], [3, 3, 3], [4, 4, 5], [1, 1, 6], [4, 1, 4]]]" },
    { file:"index", expect:"the grid lines are not one per cm", find:"for (i = 1; i < w; i++){ out.push(['top', [0, h, i], [l, h, i]]);", replace:"for (i = 1; i <= w; i++){ out.push(['top', [0, h, i], [l, h, i]]);" },
    { file:"index", expect:"boxPt() is not the oblique projection", find:"y:o.y - (y + z * OBL.dy) * u }; }", replace:"y:o.y - (y + z * OBL.dx) * u }; }" },
    { file:"index", expect:"face is not the box", find:"side:[[l, 0, 0], [l, 0, w], [l, h, w], [l, h, 0]] };", replace:"side:[[l, 0, 0], [l, 0, w], [l, h, w], [l, h - 1, 0]] };" },
    { file:"index", expect:"is wrong", find:"why:'長 × 寬 × 高 = 4 × 3 × 2 = 24（立方公分）。' },", replace:"why:'長 × 寬 × 高 = 4 × 3 × 2 = 25（立方公分）。' }," },
    { file:"index", expect:"is wrong", find:"why:'Tank volume = 40 × 25 × 20 = 20000 (cubic cm); 1000 cubic cm = 1 liter, 20000 ÷ 1000 = 20, so it holds 20 liters.' },", replace:"why:'Tank volume = 40 × 25 × 20 = 20000 (cubic cm); 1000 cubic cm = 1 liter, 20000 ÷ 1000 = 2, so it holds 20 liters.' }," },
    { file:"index", expect:"is wrong", find:"cap2h: '1 cubic cm = 1 milliliter',", replace:"cap2h: '1 cubic cm = 10 milliliters'," },
    { file:"index", expect:"towerLine1(", find:"area + ' × ' + h + ' = <b>' + total + ' 塊</b><br>體積", replace:"area + ' × ' + h + ' = <b>' + (total + 1) + ' 塊</b><br>體積" },
    { file:"index", expect:"markup fallback", find:"<p class=\"lead\" data-i18n=\"s5lead\">鋪一層、", replace:"<p class=\"lead\" data-i18n=\"s5lead\">舖一層、" },
    { file:"index", expect:"gHints.liter zh", find:"1\\u00a0毫升，1000\\u00a0立方公分 ＝ 1\\u00a0公升。',\n        find: '提示", replace:"1\\u00a0毫升，1000\\u00a0立方公分 ＝ 10\\u00a0公升。',\n        find: '提示" },
    { file:"index", expect:"the game name changed", find:"      s5h2: 'The Moving Company',", replace:"      s5h2: 'The Movers'," },
    { file:"review", expect:"option count 3", find:"        var m = mixOpts(v, [e * 3, e * e, e * 4, e * e * (e - 1), e * e * (e + 1)], [e]);", replace:"        var m = mixOpts(v, [e * 3, e * e, e * 4, e * e * (e - 1)], [e]);" },
    { file:"review", expect:"misconception distractors e × e", find:"        var m = mixOpts(v, [e * 3, e * e, e * 4, e * e * (e - 1), e * e * (e + 1)], [e]);", replace:"        var m = mixOpts(v, [e * 4, e * e * (e - 1), e * e * (e + 1), e * 3, e * e], [e]);" },
    { file:"review", expect:"is a number from the stem", find:"        var m = mixOpts(h, [h + 1, h - 1, l * w, h + 2, h + 3], [l, w]);", replace:"        var m = mixOpts(h, [h + 1, h - 1, l * w, h + 2, h + 3]);" },
    { file:"review", expect:"layer-count distractor", find:"        var m = mixOpts(h, [h + 1, h - 1, l * w, h + 2, h + 3], [l, w]);", replace:"        var m = mixOpts(h, [h + 1, h - 1, h + 2, h + 3], [l, w]);" },
    { file:"review", expect:"tankLiters", find:"[p.liters * 10, Math.floor(p.liters / 10), p.liters + 2, p.liters + 1, p.liters + 3, p.liters + 4], [p.l, p.w, p.h]);", replace:"[p.liters * 10, Math.max(1, Math.floor(p.liters / 10)), p.liters + 2]);" },
    { file:"review", expect:"rectArea", find:"        var m = mixOpts(a, [l + w, a + l, (l + 1) * w, 2 * (l + w), a + 1], [l, w]);", replace:"        var m = mixOpts(a, [l + w, a + l, (l + 1) * w], [l, w]);" },
    { file:"review", expect:"boxVolume: v", find:"        var l = p[0], w = p[1], h = p[2], v = l * w * h;\n        var m = mixOpts(v, [l + w + h,", replace:"        var l = p[0], w = p[1], h = p[2], v = l * w * h + 1;\n        var m = mixOpts(v, [l + w + h," },
    { file:"review", expect:"litersToCm3", find:"        var v = k * 1000;", replace:"        var v = k * 100;" },
    { file:"review", expect:"the why is wrong", find:"? '一層有幾塊 × 疊幾層 = ' + d.perLayer + ' × ' + d.layers + ' = ' + d.total + '（塊）。'", replace:"? '一層有幾塊 × 疊幾層 = ' + d.perLayer + ' × ' + d.layers + ' = ' + (d.total + d.layers) + '（塊）。'" },
    { file:"review", expect:"triArea", find:"        var base = p[0], height = p[1], a = base * height / 2;", replace:"        var base = p[0], height = p[1], a = base * height;" },
    { file:"review", expect:"cubeVolume", find:"        var v = e * e * e;", replace:"        var v = e * e * 3;" },
    { file:"review", expect:"the why is wrong", find:"'1 liter = 1000 cubic cm, so ' + d.k + ' × 1000 = ' + d.v + ' cubic cm.'", replace:"'1 liter = 1000 cubic cm, so ' + d.k + ' × 100 = ' + d.v + ' cubic cm.'" }
  ],

  sim: {
    INVARIANTS: {
      boxVolume: d => { if (d.v !== d.l * d.w * d.h) return 'boxVolume: v ' + d.v + ' != l × w × h'; },
      cubeVolume: d => { if (d.v !== d.e * d.e * d.e) return 'cubeVolume: v ' + d.v + ' != e³'; },
      findMissingEdge: d => { if (d.v !== d.l * d.w * d.h) return 'findMissingEdge: v != l × w × h'; },
      tankLiters: d => { if (d.cm3 !== d.l * d.w * d.h || d.liters * 1000 !== d.cm3) return 'tankLiters: ' + d.l + ' × ' + d.w + ' × ' + d.h + ' = ' + d.cm3 + ' is not ' + d.liters + ' L'; },
      layerCount: d => { if (d.total !== d.perLayer * d.layers) return 'layerCount: total != perLayer × layers'; },
      litersToCm3: d => { if (d.v !== d.k * 1000) return 'litersToCm3: v != k × 1000'; },
      rectArea: d => { if (d.a !== d.l * d.w) return 'rectArea: a != l × w'; },
      triArea: d => { if (d.a !== d.base * d.height / 2 || !isInt(d.a)) return 'triArea: a != base × height ÷ 2 (or not whole)'; }
    },
    expectedCorrect: function(d, genId, lang){
      const U = { vol:lang === 'zh' ? ' 立方公分' : ' cubic cm', len:lang === 'zh' ? ' 公分' : ' cm', lit:lang === 'zh' ? ' 公升' : ' liters', cubes:lang === 'zh' ? ' 塊' : ' cubes', area:lang === 'zh' ? ' 平方公分' : ' square cm' };
      switch (genId){
        case 'boxVolume': return d.l * d.w * d.h + U.vol;
        case 'cubeVolume': return d.e * d.e * d.e + U.vol;
        case 'findMissingEdge': return d.v / (d.l * d.w) + U.len;
        case 'tankLiters': return d.l * d.w * d.h / 1000 + U.lit;
        case 'layerCount': return d.perLayer * d.layers + U.cubes;
        case 'litersToCm3': return d.k * 1000 + U.vol;
        case 'rectArea': return d.l * d.w + U.area;
        case 'triArea': return d.base * d.height / 2 + U.area;
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      const unit = { boxVolume:'vol', cubeVolume:'vol', litersToCm3:'vol', findMissingEdge:'len', tankLiters:'lit', layerCount:'cubes', rectArea:'area', triArea:'area' }[genId];
      const RE = { vol:lang === 'zh' ? /^(\d+) 立方公分$/ : /^(\d+) cubic cm$/, len:lang === 'zh' ? /^(\d+) 公分$/ : /^(\d+) cm$/, lit:lang === 'zh' ? /^(\d+) 公升$/ : /^(\d+) liters$/,
        cubes:lang === 'zh' ? /^(\d+) 塊$/ : /^(\d+) cubes$/, area:lang === 'zh' ? /^(\d+) 平方公分$/ : /^(\d+) square cm$/ }[unit];
      if (!RE) return 'unknown generator ' + genId;
      const m = String(s).match(RE);
      if (!m) return 'option "' + s + '" is not a whole number with the right unit';
      const n = +m[1];
      /* 範圍從各產生器自己的題庫推出來：最大的正解 × 一個合理的倍數（誘答是「多乘一層」「少乘一次」「差 10 倍」這一類） */
      const MAX = { boxVolume:2 * 48, cubeVolume:8 * 8 * 8, findMissingEdge:5 * 4, tankLiters:10 * 10, layerCount:24 * 5 + 24, litersToCm3:9 * 10000, rectArea:2 * 40, triArea:2 * 30 }[genId];
      if (n < 1 || n > MAX) return 'option ' + n + ' outside 1~' + MAX;
    },
    /* simgen 的「誘答抄題幹」比的是整個選項字串（「3 公分」），永遠對不到題幹裡的「3」—— 這裡比數值（§六之三第 4 點）。
       正解本身剛好等於題幹的某個數不算（那是題目）。 */
    renderCheck: function(d, q, lang, genId){
      const stem = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number);
      const vals = q.opts.map(o => +String(o).match(/\d+(?:\.\d+)?/)[0]);
      for (let i = 0; i < vals.length; i++) if (i !== q.ans && stem.indexOf(vals[i]) >= 0) return genId + ': distractor ' + vals[i] + ' is a number from the stem';
      if (new Set(vals).size !== vals.length) return genId + ': two options have the same value';
      /* 解釋裡的每一條算式都要算對（規則式「長 × 寬 × 高 ＝」左邊是字，換成冒號；公升先換成毫升） */
      const pr = arithGame(ruleFix(literNorm(q.why))).problems;
      if (pr.length) return genId + ': the why is wrong — ' + pr[0];
      /* 已知體積求高：「把一層的塊數當成高」（長 × 寬）是刻意的迷思誘答，一定要在選項裡 */
      if (genId === 'findMissingEdge' && vals.indexOf(d.l * d.w) < 0) return genId + ': the layer-count distractor ' + d.l * d.w + ' (length × width) is not offered';
      /* 正方體：只乘兩個邊長（e × e）與邊長 × 3 是這一課點名的兩個迷思 —— 兩個都要在選項裡（e ＝ 3 時兩個都是 9） */
      if (genId === 'cubeVolume' && (vals.indexOf(d.e * d.e) < 0 || vals.indexOf(d.e * 3) < 0)) return genId + ': the misconception distractors e × e = ' + d.e * d.e + ' and e × 3 = ' + d.e * 3 + ' are not both offered';
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「搬家公司」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GW, GPICK, shuffle, unsorted, OBL, boxVol, boxFormula, isCube, boxPt, boxSize, boxFaces, boxGrid, BOXLBL, TANKLBL, boxLabels, boxExtent, boxFit, LAYER, GAME_LAYER, layerX0, layerTrayY, layerH, layerRow, layerTray, layerRefuse, STACK, STACK_H, GAME_STACK, stackSize, stackOx, stackRulerX, stackGripX, stackY, stackH, stackRefuse, CUBE, CUBE_H, GAME_CUBE, cubeHit, cubeOrder, cubeInOrder, cubeTray, cubeRefuse, LITER, LITER_H, GAME_LITER, literFrame, literDraw, literTray, literRefuse, FIND, FIND_H, GAME_FIND, findFrame, findDraw, findPick, findBoxes, findCount}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], EPS = 1e-9;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        /* 「長 × 寬 ＝ 4 × 3 ＝ 12」「一層 ＝ 12 塊」：等號左邊是字（規則、名稱）的不是宣稱 —— 換成冒號，只驗數的那一段 */
        const r = arithGame(ruleFix(literNorm(s)));
        r.problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        /* 數字和單位之間用不斷行空白（375px 上「5 / L」被折成兩行，驗證者抓到的） */
        if (!/^towerLine/.test(where) && /\d[ \t](?:cubic cm|cm\b|mL\b|L\b|liters?\b|立方公分|公分|毫升|公升)/.test(s)) fail(where + ' ' + L + ': a number and its unit are separated by a breakable space in "' + s + '"');
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        return r.verified;
      };
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 等號掃描器自己先證明會響（正反例） --- */
      [['4 × 3 × 2 = 24', 1, 0], ['4 × 3 × 2 = 25', 1, 1], ['長 × 寬 × 高 = 4 × 3 × 2 = 24（立方公分）', 1, 0], ['20000 ÷ 1000 = 20', 1, 0], ['20000 ÷ 1000 = 2', 1, 1],
       ['1000 立方公分 = 1 公升', 1, 0], ['1000 立方公分 = 2 公升', 1, 1], ['1 立方公分 = 1 毫升', 1, 0], ['1 cubic cm = 1 milliliter', 1, 0], ['1 cubic cm = 10 milliliters', 1, 1], ['1000 cubic cm = 1 liter', 1, 0], ['2.5 × 1000 = 2500', 1, 0], ['長 × 寬 = 面積', 0, 0], ['64 &gt; 60', 0, 0]]
        .forEach(([t, n, bad]) => {
          const r = chainClaims(t);
          if (r.claims.length !== n || r.claims.filter(c => c.bad).length !== bad) fail('chainClaims() self-test: "' + t + '" should give ' + n + ' claims, ' + bad + ' wrong — got ' + JSON.stringify(r.claims));
        });
      /* 遊戲句子的算式檢查也先證明會響：換單位的等號要換對、算錯要響 */
      [['20 × 10 × 5 ＝ 1000 立方公分 ＝ 1000 毫升 ＝ 1 公升', 0], ['20 × 10 × 5 ＝ 1000 立方公分 ＝ 1000 毫升 ＝ 10 公升', 1], ['15 × 10 × 10 = 1500 cubic cm = 1500 mL = 1.5 L', 0],
       ['15 × 10 × 10 = 1500 cubic cm = 1500 mL = 15 L', 1], ['一層 4 × 3 ＝ 12 塊，疊 2 層是 12 × 2 ＝ 24 塊', 0], ['12 × 2 ＝ 26 塊', 1]].forEach(([t, bad]) => {
        if ((arithGame(literNorm(t)).problems.length > 0) !== (bad > 0)) fail('game arithmetic self-test: "' + t + '" should be ' + (bad ? 'wrong' : 'right'));
      });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的等號逐個重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      /* 題庫的選項只驗正解那一個（「10 立方公分 ＝ 1 毫升」是刻意寫錯的誘答） */
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        const m = where.match(/^(\w+)\.(qs|qsAdv|qsBoost)\[(\d+)\]\.opts\[(\d+)\]$/);
        if (m && I18N[L][m[2]][+m[3]].ans !== +m[4]) return;
        chainClaims(s).claims.forEach(c => { checkedEq++; if (c.bad) fail(where + ': "' + c.text + '" is wrong (' + c.bad + ')'); });
      }));
      if (checkedEq < 30) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
      /* 範例 1、2 的兩句說明：每一種可以選的長寬高都算一次（chips：長 2～5、寬 2～4、高 1～4；邊長 2～5） */
      LANGS.forEach(L => {
        for (let l = 2; l <= 5; l++) for (let w = 2; w <= 4; w++) for (let h = 1; h <= 4; h++)
          say('towerLine1(' + [l, w, h] + ')', L, I18N[L].towerLine1(l, w, h), [l, w, l * w, h, l * w, h, l * w * h, l, w, h, l * w * h]);
        for (let e = 2; e <= 5; e++) say('towerLine2(' + e + ')', L, I18N[L].towerLine2(e), [e, e, e * e, e, e * e, e, e * e * e, e, e, e, e * e * e]);
      });

      /* --- 1b. 遊戲的開場白：說的那件事五關都成立；頁面上的備用字和中文字典是同一句 --- */
      {
        const LEAD = { zh:'五關都從同一件事出發：<strong>一層有 長 × 寬 塊，疊 高 層</strong>', en:'every round starts from the same idea: <strong>one layer holds length × width cubes, and there are height layers</strong>' };
        LANGS.forEach(L => { if ((I18N[L].s5lead || '').indexOf(LEAD[L]) < 0) fail('GAME s5lead ' + L + ' does not say "' + LEAD[L] + '"'); });
        const m = src.match(/<p class="lead" data-i18n="s5lead">([\s\S]*?)<\/p>/);
        if (!m || m[1] !== I18N.zh.s5lead) fail('GAME s5lead: the markup fallback is not the same sentence as the zh dictionary');
        if (I18N.zh.s5h2 !== '搬家公司' || I18N.en.s5h2 !== 'The Moving Company') fail('GAME: the game name changed — parents.html still calls it 搬家公司 / The Moving Company');
      }

      /* ================= 2. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：搬家公司');
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
      tooSmall('GPICK', D.GPICK);

      /* --- 五關的順序、RENDER、題目與提示 --- */
      const TYPES = ['layer', 'stack', 'cube', 'liter', 'find'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 1 backwards, 2, 3, 1+2), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        layer: { has:{ zh:['一排', '鋪滿就是一層'], en:['row', 'the layer is full'] } },
        stack: { has:{ zh:['長 × 寬', '× 層數'], en:['length × width', '× number of layers'] } },
        cube: { has:{ zh:['長 × 寬 × 高', '邊 × 邊 × 邊', '三個邊長', '最高的不一定最多'], en:['length × width × height', 'edge × edge × edge', 'all three edges', 'tallest box is not always the biggest'] } },
        liter: { has:{ zh:['1\u00a0立方公分 ＝ 1\u00a0毫升', '1000\u00a0立方公分 ＝ 1\u00a0公升'], en:['1\u00a0cubic cm = 1\u00a0mL', '1000\u00a0cubic cm = 1\u00a0L'] } },
        find: { has:{ zh:['長 × 寬 × 高', '加起來一樣，體積不一定一樣'], en:['length × width × height', 'does not mean the same volume'] } }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
          if (t === 'stack' || t === 'find'){ if (typeof a !== 'function') fail('GAME: gAsks.' + t + ' must be a function of the target (' + L + ')'); }
          else if (typeof a !== 'string' || !a) fail('GAME: gAsks.' + t + ' missing in ' + L); else say('gAsks.' + t, L, a, t === 'liter' ? [] : []);
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h, t === 'liter' ? [1, 1, 1000, 1] : []); has('gHints.' + t, L, h, HINT_SEM[t].has); }
        });
      });
      LANGS.forEach(L => {
        [24, 30, 60].forEach(V => { say('gAsks.stack', L, I18N[L].gAsks.stack(V), [V, 1]); say('gAsks.find', L, I18N[L].gAsks.find(V), [V]); });
        has('gAsks.stack', L, I18N[L].gAsks.stack(24), { zh:['1\u00a0立方公分'], en:['1\u00a0cubic cm'] });
        has('gAsks.liter', L, I18N[L].gAsks.liter, { zh:['裡面', '有一張標籤用不到'], en:['inside', 'one label is left over'] });
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
      need(null, /if \(o\.axis === 'y'\) P\.place\(orig\.x, o\.snapY\(orig\.y \+ dy\)\);/, 'the handle does not snap to a layer while it is dragged');
      need(null, /elHint\.textContent = '';   \/\* 過關了/, 'solving a round does not clear the hint');
      need(null, /querySelectorAll\('\.sel, \.gglow'\)/, 'solving a round does not clear the hint glow');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      { const g = extractFunction(gsrc, 'gSvg'); if (!g || /viewBox/.test(g.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME: the board SVG gets a viewBox — the drawing would no longer match the hit zones'); }
      if (/viewBox/.test((extractFunction(gsrc, 'boxCardSvg') || 'viewBox').replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME: a picture card SVG gets a viewBox (or boxCardSvg is missing)');
      ['layer', 'cube', 'liter'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      need('layer', /var row = nearestOpen\(rows, pt, LAYER\.pad\);/, 'the layer round does not pick the nearest open row');
      need('layer', /var bad = layerRefuse\(Lx, P\.data\.n\);/, 'the layer round does not judge the dropped row with layerRefuse');
      need('layer', /addRod\(Lx, P\.data\.slot\);/, 'the tray is not refilled with a row of L after a row is laid');
      need('stack', /var bad = stackRefuse\(Lx, Wd, hh, V\);/, '"Packed" does not judge the shown height with stackRefuse');
      need('stack', /if \(gSolved \|\| grip\.busy\(\)\) return;/, '"Packed" judges while the handle is still held');
      need('stack', /snapY:function\(y\)\{ return stackY\(stackH\(y\)\); \}/, 'the handle does not snap to a whole layer');
      need('cube', /var s = nearestOpen\(slots, pt, CUBE\.pad\);/, 'the order round does not pick the nearest open slot');
      need('cube', /bad = cubeRefuse\(e, b, s\.i\);/, 'the order round does not judge with cubeRefuse');
      need('liter', /var t = nearestOpen\(tanks, pt, LITER\.pad\);/, 'the liter round does not pick the nearest open tank');
      need('liter', /if \(literRefuse\(t\.b, P\.data\.ml\)\)\{ missOnce\(/, 'the liter round does not judge with literRefuse');
      need('find', /var i = findPick\(pt\);/, 'the find round does not use findPick');
      need('find', /if \(F\.found\) return;/, 'tapping a found box again is judged');
      need('find', /if \(x !== V\)\{/, 'the find round does not compare the box volume with V');
      TYPES.forEach(t => { if (t !== 'find' && t !== 'stack' && !/missOnce\(seen, /.test(RB[t])) fail('GAME ' + t + ': a mistake is not charged through missOnce() — a repeated identical mistake could be charged twice'); });
      need('stack', /missOnce\(seen, hh, /, 'a repeated wrong height could be charged twice');
      need('find', /missOnce\(seen, i, /, 'a repeated wrong box could be charged twice');
      need('cube', /missOnce\(seen, boxFormula\(b\) \+ '@' \+ s\.i, /, 'the same card in the same wrong slot could be charged twice');
      need('liter', /missOnce\(seen, P\.data\.ml \+ '@' \+ t\.i, /, 'the same label on the same wrong tank could be charged twice');
      need('layer', /missOnce\(seen, P\.data\.n, /, 'the same wrong row could be charged twice');

      need('stack', /function draw\(\)\{\n {8}host\.textContent = '';\n {8}drawBox\(host, o, U, \[Lx, Wd, hh\], \{ grid:true \}\);/, 'the box is not redrawn at the current height hh (all three edges labelled)');
      need('stack', /\n {8}line\.textContent = d\.gStackNow\(hh\);\n {6}\}/, 'the readout does not show the same height hh that "Packed" judges');
      { const sr = extractFunction(gsrc, 'startRound') || 'return';
        if (/\breturn\b/.test(sr.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME startRound() can return early — the game must never stop (no game over at 0 points)'); }
      { const nx = (gsrc.match(/gNext\.addEventListener\('click', function\(\)\{([\s\S]*?)\n {2}\}\);/) || [])[1] || '';
        if (!/if \(gRound < GAME_ORDER\.length - 1\)\{ gRound\+\+; startRound\(\); \}/.test(nx) || /gScore/.test(nx)) fail('GAME: "Next round" does not always go on to the next round (whatever the score)'); }
      /* 判斷與拖拉的程式碼釘住（sha1）：RENDER 的每一關和拖拉引擎的函式，任何改動都要先重跑 teaching-workspace/game-harness/g5-volume 的 e2e
         （它真的拖、真的點，驗「收不收」與計分），再把這裡的 sha1 換成新的。上面的 need() 說明每一段守的是什麼；這裡擋的是「多插一行」。 */
      {
        const sha = t => crypto.createHash('sha1').update(t).digest('hex').slice(0, 12);
        const PINS = { 'RENDER.layer':'918b31baca3a', 'RENDER.stack':'ddf5d69f7f8c', 'RENDER.cube':'ef8b025c5da5', 'RENDER.liter':'130f20bad694', 'RENDER.find':'cdc49570f536', 'addPiece':'2139daab2f38', 'useTapSelect':'bab2d6af337c', 'makeBoard':'59e9a1067ac1', 'nearestOpen':'811050d7b598', 'roundSolved':'52e7ba85251c', 'roundMiss':'f98f520e7645', 'missOnce':'03d854665648', 'startRound':'b07f95485bf0', 'drawBox':'3847d68c6db3' };
        Object.keys(PINS).forEach(k => {
          const t = k.indexOf('RENDER.') === 0 ? RB[k.slice(7)] : extractFunction(gsrc, k);
          const h = t ? sha(t) : 'missing';
          if (h !== PINS[k]) fail('GAME pin: ' + k + ' changed since the e2e verified it (sha1 ' + h + ', pinned ' + PINS[k] + ') — re-run the e2e, then update PINS');
        });
      }

      /* --- 切出來真的跑：nearestOpen、roundMiss、missOnce --- */
      let nearestOpen = null;
      try { nearestOpen = new Function(extractFunction(gsrc, 'nearestOpen') + '; return nearestOpen;')(); } catch (e){ fail('GAME: cannot run nearestOpen() from index.html: ' + e.message); }
      const nearestRef = (list, pt, pad) => {
        let best = null, bd = Infinity, bc = Infinity;
        list.forEach(b => {
          const dx = pt.x - b.cx, dy = pt.y - b.cy;
          if (Math.abs(dx) > b.hw + pad || Math.abs(dy) > b.hh + pad) return;
          const ex = Math.max(0, Math.abs(dx) - b.hw), ey = Math.max(0, Math.abs(dy) - b.hh), dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;
          if (dd < bd - 1e-9 || (Math.abs(dd - bd) <= 1e-9 && dc < bc)){ bd = dd; bc = dc; best = b; }
        });
        return best && !best.done ? best : null;
      };
      /* 大小不一樣的兩個目標：點在大的那一個裡面、靠近小的那一個 —— 量「到方框」是 0（大的），量「到中心」會挑小的 */
      if (nearestOpen){
        const big = { i:0, cx:100, cy:50, hw:60, hh:30 }, small = { i:1, cx:175, cy:50, hw:15, hh:15 };
        [[155, 50, 0], [159.5, 50, 0], [161, 50, 1], [100, 50, 0], [175, 50, 1]].forEach(([x, y, want]) => {
          const r = nearestOpen([small, big], { x, y }, 10);
          if (!r || r.i !== want) fail('GAME nearestOpen() disagrees with the nearest box for unequal targets at ' + x + ',' + y + ': got ' + (r && r.i) + ', want ' + want + ' (it must measure to the box, not to the centre)');
        });
      }
      /* 一排相鄰目標：整片放寬範圍每 0.5px 和自己的「最近的方框」比；每一個目標都輪流當「已經放好」一次 */
      const sweep = (what, list, pad, H) => {
        if (!nearestOpen) return;
        let n = 0, bad = 0, first = null;
        for (let k = -1; k < list.length; k++){
          const L2 = list.map((b, i) => Object.assign({}, b, { done:i === k }));
          for (let x = 0; x <= W; x += 0.5) for (let y = 0; y <= H; y += 0.5){
            const a = nearestOpen(L2, { x, y }, pad), b = nearestRef(L2, { x, y }, pad); n++;
            if ((a && a.i) !== (b && b.i) || (!a) !== (!b)){ bad++; if (!first) first = [x, y, a && a.i, b && b.i, k]; }
          }
        }
        if (bad) fail('GAME ' + what + ': nearestOpen() disagrees with the nearest box at ' + bad + ' of ' + n + ' points, first ' + JSON.stringify(first));
        /* 相鄰的兩個目標放寬之後要真的重疊 —— 不重疊的話「最近的那一個」從來不會被考到 */
        let overlap = 0;
        for (let i = 0; i + 1 < list.length; i++){ const a = list[i], b = list[i + 1]; const gx = Math.abs(a.cx - b.cx) - a.hw - b.hw, gy = Math.abs(a.cy - b.cy) - a.hh - b.hh; if (Math.max(gx, gy) < 2 * pad) overlap++; }
        if (overlap < list.length - 1) fail('GAME ' + what + ': neighbouring targets do not overlap in their snap margins (' + overlap + '/' + (list.length - 1) + ')');
      };
      {
        const rm = extractFunction(gsrc, 'roundMiss');
        if (!rm) fail('GAME: cannot cut roundMiss() out of index.html');
        else [0, 5, 20].forEach(s0 => {
          let r;
          try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = { textContent:"" }, gMsg = { innerHTML:"" }; function L(){ return { gMinus:"MINUS" }; }' + rm + '; roundMiss("why"); return { s:gScore, m:gMsg.innerHTML, k:gMistake, e:elScore.textContent };')(); }
          catch (e){ fail('GAME: roundMiss() could not run: ' + e.message); return; }
          const want = Math.max(0, s0 - 5);
          if (r.s !== want || String(r.e) !== String(want) || !r.k || (s0 >= 5) !== /MINUS/.test(r.m) || !/why/.test(r.m)) fail('GAME roundMiss() at ' + s0 + ' points: score ' + r.s + ' (want ' + want + '), "−5" shown ' + /MINUS/.test(r.m) + ' (want ' + (s0 >= 5) + '), mistake recorded ' + r.k);
        });
        const mo = extractFunction(gsrc, 'missOnce');
        if (!mo) fail('GAME: cannot cut missOnce() out of index.html');
        else {
          let log;
          try { log = new Function('var log = []; function roundMiss(t){ log.push("miss:" + t); } function roundAgain(t){ log.push("again:" + t); }' + mo +
            '; var seen = { keys:{}, last:null }; ["A", "B", "A", "A", "B", "B"].forEach(function(k){ log.push("@" + k); missOnce(seen, k, k); }); return log.join(" ");')(); }
          catch (e){ fail('GAME: missOnce() could not run: ' + e.message); }
          if (log !== undefined && log !== '@A miss:A @B miss:B @A again:A @A @B again:B @B') fail('GAME missOnce(): wrong A, B, A, A, B, B should be charged twice and repeat each reason once — got "' + log + '"');
        }
        /* 計分：沒犯錯 +20、犯過錯 +10（切出來真的跑兩次） */
        const rs = extractFunction(gsrc, 'roundSolved');
        if (!rs) fail('GAME: cannot cut roundSolved() out of index.html');
        else [false, true].forEach(mk => {
          let r;
          try { r = new Function('var gSolved = false, gMistake = ' + mk + ', gScore = 30, gRound = 1, GAME_ORDER = [1, 2, 3, 4, 5], elScore = {}, gMsg = {}, gHintBtn = {}, elHint = {}, gNext = {},' +
            ' gameStage = { querySelectorAll:function(){ return []; } }; function L(){ return { gPts:function(p){ return "+" + p; }, gClear:"", gWin:function(){ return ""; } }; }' + rs + '; roundSolved("ok"); roundSolved("again"); return gScore;')(); }
          catch (e){ fail('GAME: roundSolved() could not run: ' + e.message); return; }
          if (r !== 30 + (mk ? 10 : 20)) fail('GAME scoring: a round should give ' + (mk ? '+10 after a mistake' : '+20 with no mistakes') + ' (once), got ' + (r - 30));
        });
        const ra = extractFunction(gsrc, 'roundAgain');
        if (!ra || /gScore|gMistake/.test(ra)) fail('GAME roundAgain() must only show the reason again — it touches the score or the mistake flag');
      }
      /* shuffle()：每一個位置都會出現每一個值（不是固定的排法） */
      {
        const seen = {};
        for (let i = 0; i < 3000; i++){ const t = D.shuffle([0, 1, 2, 3]); seen[t.join('')] = 1; if (t.slice().sort().join() !== '0,1,2,3') { fail('GAME shuffle(): lost or duplicated an item'); break; } }
        if (Object.keys(seen).length < 24) fail('GAME shuffle(): only ' + Object.keys(seen).length + ' of the 24 orders of four items appeared in 3000 runs');
      }

      /* --- 立體圖：頁面的 boxFaces／boxGrid／boxPt 和自己的斜二測一樣；標籤放得進框 --- */
      if (D.OBL.dx !== OB.dx || D.OBL.dy !== OB.dy) fail('GAME: the oblique projection changed (' + JSON.stringify(D.OBL) + ') — every to-scale check below assumes depth 0.4 right, 0.3 up');
      const boxOk = (what, b, o, u, S) => {
        const F = D.boxFaces(b), l = b[0], w = b[1], h = b[2];
        const want = { front:[[0, 0, 0], [l, 0, 0], [l, h, 0], [0, h, 0]], top:[[0, h, 0], [l, h, 0], [l, h, w], [0, h, w]], side:[[l, 0, 0], [l, 0, w], [l, h, w], [l, h, 0]] };
        Object.keys(want).forEach(k => { if (JSON.stringify(F[k]) !== JSON.stringify(want[k])) fail('GAME ' + what + ': the ' + k + ' face is not the box ' + b.join('×')); });
        /* 格線：自己列一次「每一公分一條、只畫在面裡」的完整集合，和頁面的逐條比（不只比數量） */
        const G = D.boxGrid(b), cnt = f => G.filter(g => g[0] === f).length, segKey = g => g[0] + ':' + [g[1].join(','), g[2].join(',')].sort().join('|');
        const want2 = [];
        for (let i = 1; i < l; i++){ want2.push(['front', [i, 0, 0], [i, h, 0]]); want2.push(['top', [i, h, 0], [i, h, w]]); }
        for (let i = 1; i < h; i++){ want2.push(['front', [0, i, 0], [l, i, 0]]); want2.push(['side', [l, i, 0], [l, i, w]]); }
        for (let i = 1; i < w; i++){ want2.push(['top', [0, h, i], [l, h, i]]); want2.push(['side', [l, 0, i], [l, h, i]]); }
        const gk = G.map(segKey).sort(), wk = want2.map(segKey).sort();
        if (gk.join(' ') !== wk.join(' ') || new Set(gk).size !== gk.length) fail('GAME ' + what + ': the grid lines are not one per cm on each face of ' + b.join('×') + ' (front ' + cnt('front') + ', top ' + cnt('top') + ', side ' + cnt('side') + ')');
        /* boxPt：每一個面的每一個頂點、每一條格線的兩端都和自己的斜二測一樣 */
        const allPts = [].concat(F.front, F.top, F.side, ...G.map(g => [g[1], g[2]]));
        for (const p of allPts){ const a = D.boxPt(o, u, p[0], p[1], p[2]), r = projRef(o, u, p); if (Math.abs(a.x - r.x) > EPS || Math.abs(a.y - r.y) > EPS){ fail('GAME ' + what + ': boxPt() is not the oblique projection at ' + p); break; } }
        /* 標籤：三個邊都標、數字就是那個邊長、而且就在那一條邊旁邊（長：前面下緣的中點正下方；高：前面左緣中點的左邊；寬：右下那一條斜邊中點的右下方） */
        S = S || D.BOXLBL;   /* 水箱用 TANKLBL（codex 第二輪：箭頭函式的 arguments 是外層 check() 的，從來拿不到它） */
        const lab = D.boxLabels(b, u, null, S), byK = {};
        lab.forEach(t => { byK[t.k] = t; });
        if (lab.length !== 3 || !byK.l || !byK.w || !byK.h || byK.l.v !== l || byK.w.v !== w || byK.h.v !== h) fail('GAME ' + what + ': the labels are not length ' + l + ', width ' + w + ', height ' + h + ' — got ' + JSON.stringify(lab.map(t => t.k + '=' + t.v)));
        else {
          const at = t => ({ x:o.x + t.x, y:o.y + t.y }), mid = (p, q) => { const a = projRef(o, u, p), c = projRef(o, u, q); return { x:(a.x + c.x) / 2, y:(a.y + c.y) / 2 }; };
          const ml = mid([0, 0, 0], [l, 0, 0]), mh = mid([0, 0, 0], [0, h, 0]), mw = mid([l, 0, 0], [l, 0, w]), Ll = at(byK.l), Lh = at(byK.h), Lw = at(byK.w);
          if (byK.l.a !== 'middle' || Math.abs(Ll.x - ml.x) > EPS || !(Ll.y - S.asc >= ml.y - EPS && Ll.y - S.asc <= ml.y + 4)) fail('GAME ' + what + ': the length label is not just under the middle of the front bottom edge');
          if (byK.h.a !== 'end' || !(Lh.x <= mh.x - 2 && Lh.x >= mh.x - 8) || Math.abs(Lh.y - S.asc / 2 - mh.y) > 6) fail('GAME ' + what + ': the height label is not just left of the middle of the front left edge');
          if (byK.w.a !== 'start' || !(Lw.x >= mw.x + 2 && Lw.x <= mw.x + 8) || !(Lw.y - S.asc >= mw.y - EPS && Lw.y - S.asc <= mw.y + 6)) fail('GAME ' + what + ': the width label is not just right of / under the middle of the bottom-right depth edge');
        }
      };
      /* 標籤（估計字寬，e2e 量真的）連同圖在框 fr 裡面、每邊至少 m px */
      const fitsIn = (what, b, u, fr, keys, S, m) => {
        const o = D.boxFit(b, u, fr, keys, S), e = D.boxExtent(b, u, keys, S);
        const L0 = o.x + e.left, R0 = o.x + e.right, T0 = o.y + e.top, B0 = o.y + e.bottom;
        if (L0 < fr.x + m - EPS || R0 > fr.x + fr.w - m + EPS || T0 < fr.y + m - EPS || B0 > fr.y + fr.h - m + EPS) fail('GAME ' + what + ': the ' + b.join('×') + ' picture with its labels does not fit its frame with ' + m + 'px to spare (' + [L0 - fr.x, fr.x + fr.w - R0, T0 - fr.y, fr.y + fr.h - B0].map(v => v.toFixed(1)).join('/') + ')');
        /* 標籤的估計字寬不可以比真的窄（14px 粗體的數字約 8.4px、12px 約 7.2px） */
        if ((S || D.BOXLBL).cw < 0.6 * (S || D.BOXLBL).font) fail('GAME ' + what + ': the label width estimate is too small');
        boxOk(what, b, o, u, S);
        return o;
      };

      /* ---------------- 第 1 關：鋪一层 ---------------- */
      {
        const LY = D.LAYER, U = LY.U;
        tooSmall('layer rod height', LY.rodH);
        if (!Array.isArray(D.GAME_LAYER) || D.GAME_LAYER.length < 6) fail('GAME_LAYER needs at least 6 floors');
        D.GAME_LAYER.forEach((e, ei) => {
          const L = e[0], Wd = e[1], tag = 'layer ' + e.join('×');
          if (!(isInt(L) && isInt(Wd) && L - 1 >= 2 && Wd >= 2 && Wd <= 4 && L <= 5)) fail('GAME ' + tag + ': L must be 3..5 (so L − 1 ≥ 2) and W 2..4');
          const H = D.layerH(Wd), x0 = D.layerX0(L);
          if (Math.abs(x0 - (W - L * U) / 2) > EPS) fail('GAME ' + tag + ': the floor is not centred');
          inside({ x:x0, y:LY.gy, w:L * U, h:Wd * U }, tag + ' floor', H);
          if (LY.gy - 14 - 12 < 0) fail('GAME ' + tag + ': the length label above the floor is cut off');
          if (x0 - 8 - 6 * 9 < 0) fail('GAME ' + tag + ': the width label left of the floor does not fit (' + x0 + 'px)');
          /* 每一排空格：L 格寬、1 格高、上下相鄰、合起來剛好是整個底 */
          const rows = []; for (let j = 0; j < Wd; j++){ const r = D.layerRow(L, j); r.i = j; rows.push(r); if (Math.abs(r.hw * 2 - L * U) > EPS || Math.abs(r.hh * 2 - U) > EPS || Math.abs(r.cy - (LY.gy + (j + 0.5) * U)) > EPS || Math.abs(r.cx - (x0 + L * U / 2)) > EPS) fail('GAME ' + tag + ': row ' + j + ' is not the j-th strip of the floor'); }
          if (ei < 3) sweep(tag + ' rows', rows, LY.pad, H);
          /* 托盤：三種長度、每一排的左端和底的左邊對齊、照比例（一塊 ＝ 一格）、彼此不重疊、不碰到底、在畫板裡、≥ 44 */
          const lens = D.layerTray(L).slice().sort((a, b) => a - b);
          if (lens.join() !== [L - 1, L, L + 1].join()) fail('GAME ' + tag + ': the tray should hold rows of L − 1, L, L + 1 cubes, got ' + lens);
          const rodBoxes = [0, 1, 2].map(k => ({ x:x0, y:D.layerTrayY(Wd, k) - LY.rodH / 2, w:(L + 1) * U, h:LY.rodH }));
          rodBoxes.forEach((r, k) => inside(r, tag + ' tray slot ' + k + ' (with the longest row)', H));
          noHits(rodBoxes.concat([{ x:x0 - 2, y:LY.gy, w:L * U + 4, h:Wd * U + LY.pad }]), tag + ' tray slots / floor');
          tooSmall(tag + ' shortest row', (L - 1) * U);
          /* 規則：每一種長度 × 每一排 —— 只有 L 塊的收；太長／太短的說法要對 */
          [L - 1, L, L + 1].forEach(n => {
            const r = D.layerRefuse(L, n);
            if ((r === null) !== (n === L) || (n > L && r !== 'long') || (n < L && r !== 'short')) fail('GAME ' + tag + ': layerRefuse(' + n + ') = ' + r);
          });
          /* 照規則玩一遍：每一次拿托盤上任何一排、放進任何一個空排；只收 L 的話剛好 W 次鋪滿、L × W 塊 */
          let cells = 0, laid = 0;
          for (let step = 0; step < 50 && laid < Wd; step++){ const n = [L - 1, L, L + 1][step % 3]; if (D.layerRefuse(L, n) === null){ laid++; cells += n; } }
          if (laid !== Wd || cells !== L * Wd) fail('GAME ' + tag + ': playing by the rules lays ' + laid + ' rows / ' + cells + ' cubes, not ' + Wd + ' / ' + L * Wd);
          LANGS.forEach(Lg => {
            const d = I18N[Lg];
            say(tag + ' gLayerLong', Lg, d.gLayerLong(L + 1, L), [L + 1, L]); has(tag + ' gLayerLong', Lg, d.gLayerLong(L + 1, L), { zh:['只放得下', '放不進去'], en:['only fits', 'won’t go in'] });
            say(tag + ' gLayerShort', Lg, d.gLayerShort(L - 1, L), [L - 1, L]); has(tag + ' gLayerShort', Lg, d.gLayerShort(L - 1, L), { zh:['只有', '空一格'], en:['only', 'gap'] });
            say(tag + ' gLayerDone', Lg, d.gLayerDone(L, Wd), [Wd, L, Wd, L, L * Wd, L, Wd, L * Wd]);
            has(tag + ' gLayerDone', Lg, d.gLayerDone(L, Wd), { zh:['長 × 寬'], en:['length × width'] });
            say(tag + ' gLayerDoneNow', Lg, d.gLayerDoneNow(L * Wd), [L * Wd]);
            for (let k = 0; k <= Wd; k++) say(tag + ' gLayerNow', Lg, d.gLayerNow(k, Wd), [k, Wd]);
            for (let k = 1; k < Wd; k++){ say(tag + ' gLayerOk', Lg, d.gLayerOk(Wd - k), [Wd - k]); say(tag + ' gLayer2', Lg, d.gLayer2(L, Wd - k + 1), [L, L, Wd - k + 1]); }
            say(tag + ' gCm', Lg, d.gCm(L), [L]);
          });
        });
      }

      /* ---------------- 第 2 關：疊幾層 ---------------- */
      {
        const ST = D.STACK, U = ST.U;
        if (ST.hMin !== 1 || ST.h0 !== 1) fail('GAME stack: the box should start (and stop) at 1 layer');
        if (!Array.isArray(D.GAME_STACK) || D.GAME_STACK.length < 6) fail('GAME_STACK needs at least 6 boxes');
        for (let y = -20; y <= D.STACK_H + 20; y += 0.25){
          const want = Math.max(ST.hMin, Math.min(ST.hMax, Math.round((ST.oy - y) / U)));
          if (D.stackH(y) !== want){ fail('GAME stackH(' + y + ') = ' + D.stackH(y) + ', the nearest layer is ' + want); break; }
        }
        for (let h = 0; h <= ST.hMax; h++) if (Math.abs(D.stackY(h) - (ST.oy - h * U)) > EPS || D.stackH(D.stackY(h)) !== Math.max(1, h)) fail('GAME stackY(' + h + ') is not the top of layer ' + h);
        tooSmall('stack handle', D.GPICK);
        D.GAME_STACK.forEach(e => {
          const L = e[0], Wd = e[1], V = e[2], A = L * Wd, want = V / A, tag = 'stack ' + e.join('/');
          if (!(isInt(want) && want >= 2 && want <= ST.hMax - 1)) fail('GAME ' + tag + ': ' + V + ' ÷ ' + A + ' is not a whole number of layers in 2..' + (ST.hMax - 1));
          if (want === ST.h0) fail('GAME ' + tag + ': the box starts already at the answer');
          if (!(L <= 5 && Wd <= 4 && L >= 2 && Wd >= 2)) fail('GAME ' + tag + ': base out of 2..5 × 2..4');
          /* 版面：最高 hMax 層的箱子、尺、把手都在畫板裡，尺在箱子右邊、把手在尺右邊 */
          const sz = D.stackSize(L, Wd), ox = D.stackOx(L, Wd), rx = D.stackRulerX(L, Wd), gx = D.stackGripX(L, Wd);
          if (Math.abs(sz.w - (L + Wd * OB.dx) * U) > EPS || Math.abs(sz.h - (ST.hMax + Wd * OB.dy) * U) > EPS) fail('GAME ' + tag + ': stackSize() is not the oblique size of the tallest box');
          inside({ x:ox, y:ST.oy - sz.h, w:sz.w, h:sz.h }, tag + ' tallest box', D.STACK_H);
          inside(box(gx, D.stackY(ST.hMax), D.GPICK, D.GPICK), tag + ' handle at the top', D.STACK_H);
          inside(box(gx, D.stackY(1), D.GPICK, D.GPICK), tag + ' handle at 1 layer', D.STACK_H);
          if (ST.hMax > 9 || !(rx - 10 - 9 > ox + sz.w + 2)) fail('GAME ' + tag + ': the ruler numbers touch the box');
          if (!(gx - D.GPICK / 2 > rx + 6)) fail('GAME ' + tag + ': the handle covers the ruler');
          const o = { x:ox, y:ST.oy };
          /* 每一個高度的箱子（三個邊都標，高的標籤跟著變）放在左下前角 o：連同標籤在畫板裡、不碰到尺的數字 */
          for (let h = 1; h <= ST.hMax; h++){
            const e2 = D.boxExtent([L, Wd, h], U, null), S = D.BOXLBL;
            if (o.x + e2.left < 2 || o.y + e2.top < 2 || o.y + e2.bottom > D.STACK_H - 2) fail('GAME ' + tag + ': the ' + h + '-layer box with its labels leaves the board');
            if (o.x + D.boxSize([L, Wd, h], U).w > rx - 10 - 9 - 2) fail('GAME ' + tag + ': the ' + h + '-layer box touches the ruler numbers');
            /* 邊長的標籤（估計字寬）不可以疊到尺上的數字（數字在尺的左邊，靠右對齊在 rx − 10） */
            D.boxLabels([L, Wd, h], U, null).forEach(t => {
              const tw = String(t.v).length * S.cw, x0 = o.x + t.x - (t.a === 'end' ? tw : (t.a === 'middle' ? tw / 2 : 0)), lb = { x:x0, y:o.y + t.y - S.asc, w:tw, h:S.asc + S.desc };
              for (let k = 1; k <= ST.hMax; k++) if (hit(lb, { x:rx - 10 - 9, y:D.stackY(k) - 6, w:9, h:12 })) fail('GAME ' + tag + ': at ' + h + ' layers the ' + t.k + ' label covers ruler mark ' + k);
            });
          }
          boxOk(tag, [L, Wd, 3], o, U);
          /* 每一個高度按一次「裝好了」 */
          for (let h = ST.hMin; h <= ST.hMax; h++){
            const r = D.stackRefuse(L, Wd, h, V), x = A * h;
            if ((r === null) !== (x === V)) fail('GAME ' + tag + ': stackRefuse at ' + h + ' layers = ' + JSON.stringify(r));
            if (r && (r.x !== x || r.less !== (x < V))) fail('GAME ' + tag + ': stackRefuse at ' + h + ' says ' + JSON.stringify(r) + ', want ' + x + (x < V ? ' (less)' : ' (more)'));
            LANGS.forEach(Lg => {
              const d = I18N[Lg];
              say(tag + ' gStackNow', Lg, d.gStackNow(h), [h]);
              if (r){
                const t = d.gStackBad(L, Wd, h, r.x, V, r.less);
                say(tag + ' gStackBad ' + h, Lg, t, [L, Wd, A, h, A, h, x, V]);
                has(tag + ' gStackBad ' + h, Lg, t, x < V ? { zh:['少'], en:['fewer'] } : { zh:['多'], en:['more'] });
                hasNot(tag + ' gStackBad ' + h, Lg, t, x < V ? { zh:['多'], en:['more'] } : { zh:['少'], en:['fewer'] });
              }
            });
          }
          LANGS.forEach(Lg => {
            const d = I18N[Lg];
            say(tag + ' gStackDone', Lg, d.gStackDone(L, Wd, want, V), [L, Wd, A, want, A, want, V, V, A, want]);
            has(tag + ' gStackDone', Lg, d.gStackDone(L, Wd, want, V), { zh:['剛好', '倒過來'], en:['exactly right', 'backwards'] });
            say(tag + ' gStack2', Lg, d.gStack2(L, Wd, V), [L, Wd, A, A, V]);
            say(tag + ' gAsks.stack', Lg, d.gAsks.stack(V), [V, 1]);
          });
        });
        LANGS.forEach(Lg => ['gStackBtn', 'gStackUp', 'gStackDown'].forEach(k => { if (typeof I18N[Lg][k] !== 'string' || !I18N[Lg][k]) fail('GAME: ' + k + ' missing in ' + Lg); }));
      }

      /* ---------------- 第 3 關：排大小 ---------------- */
      {
        const C = D.CUBE;
        tooSmall('cube card', Math.min(C.cardW, C.cardH));
        if (!Array.isArray(D.GAME_CUBE) || D.GAME_CUBE.length < 5) fail('GAME_CUBE needs at least 5 sets');
        const cardBoxes = C.trayX.map(x => box(x, C.trayY, C.cardW, C.cardH)), slotBoxes = C.slotX.map(x => box(x, C.slotY, C.slotW, C.slotH)), lblBoxes = C.slotX.map(x => ({ x:x - C.slotW / 2, y:C.lblY, w:C.slotW, h:C.lblH }));
        cardBoxes.concat(slotBoxes, lblBoxes).forEach((b, i) => inside(b, 'cube box ' + i, D.CUBE_H));
        noHits(cardBoxes, 'cube tray cards'); noHits(slotBoxes, 'cube slots'); noHits(cardBoxes.concat(lblBoxes), 'cube cards / slot labels'); noHits(lblBoxes.concat(slotBoxes), 'cube slot labels / slots');
        if (!(C.cardW < C.slotW && C.cardH < C.slotH)) fail('GAME cube: a placed card does not fit inside its slot');
        if (C.lblH < 15 * 1.2 + 4 + 2) fail('GAME cube: the slot labels are too short for one line of 15px text with 2px to spare');
        /* 卡片放寬之後，空白處（托盤和標籤之間）不屬於任何一格 */
        /* 收的範圍 ＝ 孩子看到的標籤＋格子（自然動作：放在「最少」兩個字上也算放進那一格） */
        C.slotX.forEach((x, i) => { const h = D.cubeHit(i), top = C.lblY, bot = C.slotY + C.slotH / 2;
          if (Math.abs(h.cx - x) > EPS || Math.abs(h.hw - C.slotW / 2) > EPS || Math.abs(h.cy - h.hh - top) > EPS || Math.abs(h.cy + h.hh - bot) > EPS) fail('GAME cube: slot ' + i + '\'s accept zone is not its label plus its box (' + JSON.stringify(h) + ')'); });
        if (!(C.lblY - C.pad > C.trayY + C.cardH / 2 + 6)) fail('GAME cube: the slots\' snap margin reaches the tray (no empty strip left between the tray and the labels)');
        sweep('cube slots', C.slotX.map((x, i) => Object.assign({ i }, D.cubeHit(i))), C.pad, D.CUBE_H);
        D.GAME_CUBE.forEach(e => {
          const tag = 'cube ' + e.map(b => b.join('×')).join(' / ');
          const vs = e.map(vol), cubes = e.filter(b => b[0] === b[1] && b[1] === b[2]);
          if (cubes.length !== 1) fail('GAME ' + tag + ': exactly one card should be a cube');
          if (new Set(vs).size !== 3) fail('GAME ' + tag + ': the three volumes are not all different');
          e.forEach(b => { if (D.isCube(b) !== (b[0] === b[1] && b[1] === b[2]) || D.boxVol(b) !== vol(b) || D.boxFormula(b) !== b.join(' × ')) fail('GAME ' + tag + ': isCube/boxVol/boxFormula wrong for ' + b); });
          const sorted = e.slice().sort((a, b) => vol(a) - vol(b));
          if (D.cubeOrder(e).map(vol).join() !== sorted.map(vol).join()) fail('GAME ' + tag + ': cubeOrder() is not least → most');
          if (cubes.length === 1){
            const c = cubes[0], k = c[0], others = e.filter(b => b !== c);
            /* 正方體只乘兩次（邊 × 邊）或乘 3（邊 × 3、邊 ＋ 邊 ＋ 邊）都會把它排到最少 —— 可是它不是最少的 */
            if (!others.every(b => k * k < vol(b) && k * 3 < vol(b))) fail('GAME ' + tag + ': edge × edge or edge × 3 would not put the cube last — the misconception is not tested');
            if (sorted.indexOf(c) === 0) fail('GAME ' + tag + ': the cube is the least — then the misconception gives the right answer');
          }
          /* 最高的那一箱不是最多的（「高的就大」的迷思會排錯） */
          const byH = e.slice().sort((a, b) => b[2] - a[2]);
          if (!(byH[0][2] > byH[1][2]) || sorted.indexOf(byH[0]) === 2) fail('GAME ' + tag + ': the tallest box must be unique and not the biggest');
          /* 每一張卡 × 每一格 */
          e.forEach(b => [0, 1, 2].forEach(i => {
            const r = D.cubeRefuse(e, b, i), right = sorted.indexOf(b) === i;
            if ((r === null) !== right) fail('GAME ' + tag + ': cubeRefuse(' + b + ', slot ' + i + ') = ' + JSON.stringify(r));
            if (r && (r.x !== vol(b) || r.less !== (vol(b) < vol(sorted[i])))) fail('GAME ' + tag + ': cubeRefuse(' + b + ', ' + i + ') says ' + JSON.stringify(r));
            if (r) LANGS.forEach(Lg => {
              const d = I18N[Lg], t = d.gCubeBad(D.isCube(b), D.boxFormula(b), r.x, d.gCubeSlots[i], r.less);
              say(tag + ' gCubeBad', Lg, t, [b[0], b[1], b[2], vol(b)]);
              if (t.indexOf(d.gCubeSlots[i]) < 0) fail('GAME ' + tag + ' gCubeBad ' + Lg + ': does not name the slot');
              has(tag + ' gCubeBad', Lg, t, r.less ? { zh:['要放的少'], en:['less than'] } : { zh:['要放的多'], en:['more than'] });
              hasNot(tag + ' gCubeBad', Lg, t, r.less ? { zh:['要放的多'], en:['more than'] } : { zh:['要放的少'], en:['less than'] });
              (D.isCube(b) ? has : hasNot)(tag + ' gCubeBad', Lg, t, { zh:['三個邊長'], en:['all three edges'] });
            });
          }));
          /* 托盤：3000 次不會已經排好，五種不是答案的順序都出現 */
          const seen = {};
          for (let k = 0; k < 3000; k++){ const t = D.cubeTray(e); if (t.slice().sort().join() !== e.slice().sort().join()){ fail('GAME ' + tag + ': cubeTray lost a card'); break; } if (vol(t[0]) < vol(t[1]) && vol(t[1]) < vol(t[2])){ fail('GAME ' + tag + ': cubeTray() started in the answer order'); break; } seen[t.map(vol).join()] = 1; }
          if (Object.keys(seen).length !== 5) fail('GAME ' + tag + ': cubeTray() produced ' + Object.keys(seen).length + ' of the 5 non-answer orders');
          if (D.cubeInOrder(sorted) !== true || D.cubeInOrder(sorted.slice().reverse()) !== false) fail('GAME ' + tag + ': cubeInOrder() is wrong');
          /* 每一張卡的圖（含三個標籤）放得進卡片的框裡 */
          e.forEach(b => fitsIn(tag + ' card', b, C.u, { x:3, y:3, w:C.cardW - 6, h:C.cardH - 6 }, null, null, 2));
          LANGS.forEach(Lg => {
            const d = I18N[Lg];
            say(tag + ' gCubeDone', Lg, d.gCubeDone(vol(sorted[0]), vol(sorted[1]), vol(sorted[2])), sorted.map(vol));
            e.forEach(b => { say(tag + ' gCubeOk', Lg, d.gCubeOk(D.boxFormula(b), vol(b)), [b[0], b[1], b[2], vol(b)]); say(tag + ' gCube2', Lg, d.gCube2(D.boxFormula(b), vol(b)), [b[0], b[1], b[2], vol(b)]); });
          });
        });
        LANGS.forEach(Lg => { const sl = I18N[Lg].gCubeSlots; if (!Array.isArray(sl) || sl.length !== 3) fail('GAME gCubeSlots ' + Lg); for (let k = 0; k <= 3; k++) say('gCubeNow', Lg, I18N[Lg].gCubeNow(k), [k, 3]); });
        if (I18N.zh.gCubeSlots.join() !== '最少,中間,最多' || I18N.en.gCubeSlots.join() !== 'least,middle,most') fail('GAME gCubeSlots should read least → most, left to right');
      }

      /* ---------------- 第 4 關：換成公升 ---------------- */
      {
        const T = D.LITER;
        tooSmall('liter label', Math.min(T.tagW, T.tagH));
        if (!Array.isArray(D.GAME_LITER) || D.GAME_LITER.length < 5) fail('GAME_LITER needs at least 5 sets');
        const frames = [0, 1, 2].map(i => D.literFrame(i)), tags = [0, 1, 2, 3].map(j => box(T.tagX[j % 2], T.tagY[Math.floor(j / 2)], T.tagW, T.tagH));
        frames.concat(tags).forEach((b, i) => inside(b, 'liter box ' + i, D.LITER_H));
        noHits(frames, 'liter tanks'); noHits(tags, 'liter labels'); noHits(frames.map(f => ({ x:f.x, y:f.y, w:f.w, h:f.h + T.pad })).concat(tags), 'liter tanks (with snap margin) / labels');
        frames.forEach((f, i) => { const dr = D.literDraw(i); if (dr.x < f.x + 3 - EPS || dr.x + dr.w > f.x + f.w - 3 + EPS || dr.y < f.y + 3 - EPS || dr.y + dr.h > f.y + T.frameH - T.chipH - 4 - 2 + EPS) fail('GAME liter: the drawing area ' + i + ' is not inside the frame above the label strip'); });
        if (T.chipH < 15 * 1.2 + 4 + 4 || T.chipW > T.frameW - 6) fail('GAME liter: the placed-label strip is too small for 15px text');
        sweep('liter tanks', [0, 1, 2].map(i => ({ i, cx:T.frameX[i], cy:frames[i].y + frames[i].h / 2, hw:T.frameW / 2, hh:T.frameH / 2 })), T.pad, D.LITER_H);
        D.GAME_LITER.forEach(e => {
          const tanks = e[0], tg = e[1], tag = 'liter ' + tanks.map(b => b.join('×')).join(' / ');
          if (tanks.length !== 3 || tg.length !== 4) fail('GAME ' + tag + ': three tanks and four labels');
          if (new Set(tanks.map(vol)).size !== 3) fail('GAME ' + tag + ': two tanks hold the same amount');
          if (new Set(tg.map(t => t[0])).size !== 4) fail('GAME ' + tag + ': two labels say the same amount');
          tanks.forEach(b => { if (tg.filter(t => t[0] === vol(b)).length !== 1) fail('GAME ' + tag + ': tank ' + b.join('×') + ' (' + vol(b) + ' mL) does not have exactly one label'); });
          const extra = tg.filter(t => tanks.every(b => vol(b) !== t[0]));
          if (extra.length !== 1) fail('GAME ' + tag + ': there should be exactly one left-over label');
          else if (!tanks.some(b => extra[0][0] === vol(b) * 10 || extra[0][0] * 10 === vol(b))) fail('GAME ' + tag + ': the left-over label ' + extra[0][0] + ' mL is not any tank off by 10 times (the 1 cm³ = 10 mL / ÷ 100 misconception)');
          tg.forEach(t => {
            if (['mL', 'L'].indexOf(t[1]) < 0) fail('GAME ' + tag + ': label unit ' + t[1]);
            if (t[1] === 'L' && (t[0] < 1000 || !isInt(t[0] * 10 / 1000))) fail('GAME ' + tag + ': ' + t[0] + ' mL is shown in liters but is not a whole or one-decimal number of liters');
            LANGS.forEach(Lg => {
              const s = I18N[Lg].gTag(t[0], t[1]), want = t[1] === 'L' ? (t[0] / 1000) + (Lg === 'zh' ? '\u00a0公升' : '\u00a0L') : t[0] + (Lg === 'zh' ? '\u00a0毫升' : '\u00a0mL');
              if (s !== want) fail('GAME ' + tag + ' gTag ' + Lg + ': "' + s + '", want "' + want + '"');
              if (s.length * 12 > T.tagW - 12) fail('GAME ' + tag + ': the label "' + s + '" may not fit its card');
            });
          });
          if (!tg.some(t => t[1] === 'mL') || !tg.some(t => t[1] === 'L')) fail('GAME ' + tag + ': the labels should mix mL and L');
          /* 「差 10 倍」的只能是多的那一張：真的標籤不可以剛好是別的水箱的 10 倍或十分之一（不然那個水箱在迷思下有兩張說得通的標籤） */
          tanks.forEach(b => tanks.forEach(c => { if (b !== c && (vol(c) === vol(b) * 10 || vol(c) * 10 === vol(b))) fail('GAME ' + tag + ': the real label ' + vol(c) + ' mL is 10 times off tank ' + b.join('×') + ' (' + vol(b) + ' mL) — only the spare may be'); }));
          /* 照比例也要看得清楚：每一個水箱畫出來的長、高都 ≥ 10px */
          tanks.forEach(b => { if (b[0] * T.u < 10 || b[2] * T.u < 10) fail('GAME ' + tag + ': tank ' + b.join('×') + ' is drawn only ' + (b[0] * T.u) + ' × ' + (b[2] * T.u) + 'px — too small to read'); });
          /* 照比例：同一個 u；每一個水箱（含標籤）放得進框裡標籤條的上面 */
          tanks.forEach((b, i) => { if (b[0] > 20 || b[1] > 10 || b[2] > 20) fail('GAME ' + tag + ': tank ' + b + ' larger than 20 × 10 × 20'); fitsIn(tag + ' tank ' + (i + 1), b, T.u, D.literDraw(i), null, D.TANKLBL, 2); });
          /* 每一張標籤 × 每一個水箱 */
          tg.forEach(t => tanks.forEach(b => {
            const r = D.literRefuse(b, t[0]);
            if ((r === null) !== (vol(b) === t[0]) || (r && r.x !== vol(b))) fail('GAME ' + tag + ': literRefuse(' + b + ', ' + t[0] + ') = ' + JSON.stringify(r));
            if (r) LANGS.forEach(Lg => {
              const d = I18N[Lg], chain = d.gLiterChain(b), x = vol(b);
              say(tag + ' gLiterChain', Lg, chain, [b[0], b[1], b[2], x, x].concat(x >= 1000 ? [x / 1000] : []));
              const s = d.gLiterBad(chain, d.gTag(t[0], t[1]));
              say(tag + ' gLiterBad', Lg, s, nums(chain).concat(nums(d.gTag(t[0], t[1]))));
              has(tag + ' gLiterBad', Lg, s, { zh:['不是'], en:['not'] });
            });
          }));
          LANGS.forEach(Lg => {
            const d = I18N[Lg];
            tanks.forEach(b => { say(tag + ' gLiterOk', Lg, d.gLiterOk(d.gLiterChain(b)), nums(d.gLiterChain(b))); say(tag + ' gLiter2', Lg, d.gLiter2(d.gLiterChain(b)), nums(d.gLiterChain(b))); });
            if (extra.length === 1){ const s = d.gLiterDone(d.gTag(extra[0][0], extra[0][1])); say(tag + ' gLiterDone', Lg, s, [1, 1, 1000, 1].concat(nums(d.gTag(extra[0][0], extra[0][1])))); }
          });
        });
        LANGS.forEach(Lg => { for (let k = 0; k <= 3; k++) say('gLiterNow', Lg, I18N[Lg].gLiterNow(k), [k, 3]); });
      }

      /* ---------------- 第 5 關：找一樣大 ---------------- */
      {
        const F = D.FIND;
        if (!Array.isArray(D.GAME_FIND) || D.GAME_FIND.length < 5) fail('GAME_FIND needs at least 5 sets');
        const frames = [0, 1, 2, 3, 4, 5].map(i => D.findFrame(i));
        frames.forEach((f, i) => { inside(f, 'find frame ' + i, D.FIND_H); tooSmall('find frame ' + i, Math.min(f.w, f.h)); });
        noHits(frames, 'find frames');
        if (F.capH < 15 * 1.2 + 4 + 4) fail('GAME find: the caption strip is too short for 15px text');
        frames.forEach((f, i) => { const dr = D.findDraw(i); if (dr.x < f.x + 3 - EPS || dr.x + dr.w > f.x + f.w - 3 + EPS || dr.y < f.y + 3 - EPS || dr.y + dr.h > f.y + f.h - F.capH - 4 + EPS) fail('GAME find: drawing area ' + i + ' is not inside the frame above the caption'); });
        /* findPick：整片畫板每 0.5px —— 點在框裡（含邊）就是那一框，框和框之間的縫是 null */
        let badPick = 0, first = null;
        for (let x = -5; x <= W + 5; x += 0.5) for (let y = -5; y <= D.FIND_H + 5; y += 0.5){
          const want = frames.findIndex(f => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h), got = D.findPick({ x, y });
          if ((want < 0 ? null : want) !== got){ badPick++; if (!first) first = [x, y, got, want]; }
        }
        if (badPick) fail('GAME findPick(): ' + badPick + ' points disagree with the drawn frames, first ' + JSON.stringify(first));
        /* 框和框之間要真的有縫（點縫什麼都不做）：同一排左右相鄰、上下兩排，間隔都 ≥ 2px */
        [[0, 1], [1, 2], [3, 4], [4, 5]].forEach(([a, c]) => { if (!(frames[c].x - (frames[a].x + frames[a].w) >= 2)) fail('GAME find: frames ' + a + ' and ' + c + ' touch side by side — no gap that taps nothing'); });
        [[0, 3], [1, 4], [2, 5]].forEach(([a, c]) => { if (!(frames[c].y - (frames[a].y + frames[a].h) >= 2)) fail('GAME find: frames ' + a + ' and ' + c + ' touch top to bottom — no gap that taps nothing'); });
        D.GAME_FIND.forEach(e => {
          const V = e[0], bs = e[1], tag = 'find ' + V;
          if (bs.length !== 6) fail('GAME ' + tag + ': six boxes');
          const good = bs.filter(b => vol(b) === V), bad = bs.filter(b => vol(b) !== V);
          if (good.length < 2 || good.length > 3 || bad.length < 3) fail('GAME ' + tag + ': ' + good.length + ' right and ' + bad.length + ' wrong boxes (want 2–3 right, ≥ 3 wrong)');
          if (D.findCount(e) !== good.length) fail('GAME ' + tag + ': findCount() = ' + D.findCount(e));
          if (new Set(bs.map(b => b.join())).size !== 6) fail('GAME ' + tag + ': two boxes are the same box');
          /* 過關說「形狀不一樣」：對的箱子彼此不可以是同一個箱子轉個方向（三個邊長排序後一樣） */
          { const k = good.map(b => b.slice().sort((x, y) => x - y).join()); if (new Set(k).size !== k.length) fail('GAME ' + tag + ': two right boxes are the same box turned (' + k.join(' / ') + ') — "different shapes" would be false'); }
          /* 幾箱是對的，這裡自己寫一份（codex 第五輪：「沒有一箱誘答是 V」照定義永遠成立 —— 要和獨立寫下的答案數比，多一箱碰巧是 V 的「誘答」才抓得到） */
          const ANSWERS = { 24:3, 36:2, 48:2, 30:2, 60:2 };
          if (ANSWERS[V] !== good.length) fail('GAME ' + tag + ': ' + good.length + ' boxes have volume ' + V + ', the set was designed with ' + ANSWERS[V] + ' — a decoy is accidentally right (or an answer was lost)');
          /* 「長、寬、高加起來一樣，體積不一定一樣」—— 每一組都真的有這樣一箱 */
          if (!bad.some(b => good.some(g => g[0] + g[1] + g[2] === b[0] + b[1] + b[2]))) fail('GAME ' + tag + ': no wrong box has the same length + width + height as a right one — the hint\'s warning is never tested');
          bs.forEach(b => { if (b[0] > 5 || b[1] > 4 || b[2] > 6) fail('GAME ' + tag + ': box ' + b + ' larger than 5 × 4 × 6'); });
          [0, 1, 2, 3, 4, 5].forEach(i => bs.forEach(b => fitsIn(tag + ' frame ' + i, b, F.u, D.findDraw(i), null, null, 2)));
          LANGS.forEach(Lg => {
            const d = I18N[Lg];
            say(tag + ' gAsks.find', Lg, d.gAsks.find(V), [V]);
            bad.forEach(b => { const s = d.gFindNo(D.boxFormula(b), vol(b), V); say(tag + ' gFindNo', Lg, s, [b[0], b[1], b[2], vol(b), V]); has(tag + ' gFindNo', Lg, s, { zh:['不是'], en:['not'] }); if (d.gFindCap(vol(b)) !== (Lg === 'zh' ? '＝ ' : '= ') + vol(b)) fail('GAME ' + tag + ' gFindCap ' + Lg + ': "' + d.gFindCap(vol(b)) + '"'); });
            good.forEach(b => { say(tag + ' gFindYes', Lg, d.gFindYes(D.boxFormula(b), V), [b[0], b[1], b[2], V]); say(tag + ' gFind2', Lg, d.gFind2(D.boxFormula(b), V), [b[0], b[1], b[2], V]); });
            say(tag + ' gFindDone', Lg, d.gFindDone(good.length, V), [good.length, V]);
            for (let k = 0; k <= good.length; k++) say(tag + ' gFindNow', Lg, d.gFindNow(k, good.length), [k, good.length]);
          });
        });
      }

      /* --- 共用的句子 --- */
      LANGS.forEach(Lg => {
        const d = I18N[Lg];
        [10, 20].forEach(p => say('gPts', Lg, d.gPts(p), [p]));
        say('gMinus', Lg, d.gMinus, [5]);
        say('gWin', Lg, d.gWin(100), [100]);
        ['gClear', 'gHintBtn', 'gNextBtn', 'gRestartBtn'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME: ' + k + ' missing in ' + Lg); });
      });
    }
  }
};
