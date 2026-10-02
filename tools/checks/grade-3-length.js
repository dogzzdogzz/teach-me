/* grade-3/math/length 的檢查設定（長度單位家族：毫米、公分、公尺、公里 —— 選單位、讀尺、單位階梯、化聚、先統一單位再加減比較）。
   2026-10-01 新增 —— 和小遊戲「量出正確長度」改成五關五種玩法（§六之五）同一次寫成；在那之前這一課沒有設定檔，
   simgen／verify_lesson_data／breaktest 三支都跑不起來（沒有設定的課不算驗過）。

   sim（review.html 的十一個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，
   複合單位的字串自己拼）。刻意的迷思誘答（單位換了、數字沒換；把總毫米數當成公分）白名單只放行那一個值，見 stemEchoOk。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的算式逐條重算（a × b ＝ c、a ＋ b ＝ c、連在一起的 a × b ＋ c ＝ d），
     以及「長度 ＝ 長度」逐條換成毫米比（2 公尺 5 公分 ＝ 205 公分、1 公分 ＝ 10 毫米）。兩個掃描器自己先跑正反例。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關用自己的知識重算答案：選單位用**自己的一張「真實長度範圍」表**（硬幣厚 1～3 毫米、門高 1.8～2.5 公尺……）證明
     每一張卡片剛好只有一個單位說得通、而且就是頁面標的那一個；讀尺把 rulerBoardSVG() 畫出來的 SVG **量回來**
     （蠟筆的右端落在第幾條刻度、前面有幾個公分刻度）；接 0 用自己的倍數表；拼長度照遊戲的規則從頭玩一遍
     （每一步只有一種棒子收得進去，證明一定拼得完、拼完就是 T ÷ 100 的商與餘數、跑道放得下）；
     排長短用自己的換算、而且要求「看錯成 450」的那張真的存在、真的會把順序弄錯。
     nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。
     每一句說明逐個比數字（每一題、每一種放錯）。版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-length 的端對端測試驗（合成 PointerEvent），
   不在這裡。「真實長度範圍」表是常識，不是量測資料 —— 它只保證每一張卡片和其他三個單位差十倍以上。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }

/* 自己的單位表（毫米為基準）—— 不讀頁面 */
const MM = { mm:1, cm:10, m:1000, km:1000000 };
const RANK = ['mm', 'cm', 'm', 'km'];
const UNAME = { '毫米':'mm', '公分':'cm', '公尺':'m', '公里':'km', mm:'mm', cm:'cm', m:'m', km:'km' };
const ZH = { mm:'毫米', cm:'公分', m:'公尺', km:'公里' };
const NEXT_DOWN = { km:'m', m:'cm', cm:'mm' };

/* 算式掃描：把一段文字裡所有「數 op 數 … ＝ 結果」找出來重算（× 先算，再由左到右 ＋ −） */
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const re = /(?<![\d.\/])(?<![×+\-÷] ?)(\d+(?: ?[×+\-] ?\d+)+) ?= ?(\d+)(?![\d.\/])/g;
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const toks = m[1].split(/ ?([×+\-]) ?/), got = +m[2];
    const terms = [];
    let cur = +toks[0], sign = 1;
    for (let i = 1; i < toks.length; i += 2){
      const op = toks[i], v = +toks[i + 1];
      if (op === '×') cur *= v;
      else { terms.push(sign * cur); sign = op === '+' ? 1 : -1; cur = v; }
    }
    terms.push(sign * cur);
    const want = terms.reduce((x, y) => x + y, 0);
    out.push({ text:m[0], bad:want !== got ? 'should be ' + want : null });
    re.lastIndex = m.index + 1;
  }
  return out;
}
/* 長度等式掃描：「2 公尺 5 公分 ＝ 205 公分」「1 公分 ＝ 10 毫米」—— 兩邊都換成毫米比 */
const LEN = '(\\d+) ?(公里|公尺|公分|毫米|km|mm|cm|m)(?![a-z])(?: ?(\\d+) ?(公里|公尺|公分|毫米|km|mm|cm|m)(?![a-z]))?';
function scanLengths(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/\s+/g, ' ');
  /* 不可以從「2 公尺 5 公分」的中間（5 公分）開始配：前面緊接著一個「數 單位」就不是起點 */
  const re = new RegExp('(?<![\\d×+\\-÷.])(?<!(?:公里|公尺|公分|毫米|km|mm|cm|m) ?)' + LEN + ' ?= ?' + LEN, 'g');
  const out = [];
  let m;
  while ((m = re.exec(t))){
    const side = (a, ua, b, ub) => +a * MM[UNAME[ua]] + (b === undefined ? 0 : +b * MM[UNAME[ub]]);
    const l = side(m[1], m[2], m[3], m[4]), r = side(m[5], m[6], m[7], m[8]);
    out.push({ text:m[0], bad:l !== r ? 'the two sides are ' + l + ' mm and ' + r + ' mm' : null });
    re.lastIndex = m.index + 1;
  }
  return out;
}

/* 選單位：自己的「真實長度範圍」表（毫米）。每一張卡片 v × 單位 只能有一個落在範圍裡。 */
const REAL = {
  coin:[1, 3], phone:[6, 12], rice:[4, 8],
  pencil:[140, 200], book:[180, 320], chop:[180, 300],
  door:[1800, 2600], pool:[10000, 60000], room:[5000, 15000],
  walk:[700000, 1600000], train:[30000000, 150000000], marathon:[42000000, 43000000]
};

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['unit', 'ruler', 'zero', 'build', 'rank'];", replace:"var GAME_ORDER = ['unit', 'zero', 'ruler', 'build', 'rank'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot',
      find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'the unit cards are not shuffled', find:'      var cards = shuffle(set).map(function(it, c){', replace:'      var cards = set.map(function(it, c){' },
    { file:'index', expect:'the rank cards are not shuffled', find:'      var cards = shuffle(S.items).map(function(x, c){', replace:'      var cards = S.items.map(function(x, c){' },
    { file:'index', expect:'the zero rows are not shuffled', find:'      var steps = shuffle(ZERO_STEPS), Z = ZERO_ROW, rows = [];', replace:'      var steps = ZERO_STEPS.slice(), Z = ZERO_ROW, rows = [];' },

    /* 選單位 */
    { file:'index', expect:'makes sense in', find:"{ id:'door', icon:'🚪', v:2, u:'m' }", replace:"{ id:'door', icon:'🚪', v:20, u:'m' }" },
    { file:'index', expect:'makes sense in', find:"{ id:'rice', icon:'🍚', v:6, u:'mm' }", replace:"{ id:'rice', icon:'🍚', v:6, u:'cm' }" },
    { file:'index', expect:'fewer than 2 cards for', find:"{ id:'walk', icon:'🚶', v:1, u:'km' }, { id:'train', icon:'🚆', v:80, u:'km' }, { id:'marathon', icon:'🏃', v:42, u:'km' }", replace:"{ id:'walk', icon:'🚶', v:1, u:'km' }" },
    { file:'index', expect:'unitPickSet(', find:'    out.push(pick(pool.filter(function(x){ return out.indexOf(x) < 0; })));', replace:'    out.push(pick(pool));' },
    { file:'index', expect:'unitPickSet(', find:"    var out = GAME_UNITS.map(function(u){ return pick(pool.filter(function(x){ return x.u === u; })); });", replace:"    var out = ['mm', 'cm', 'm', 'm'].map(function(u){ return pick(pool.filter(function(x){ return x.u === u; })); });" },
    { file:'index', expect:'bins 0 and 1 overlap', find:'var UNIT_H = 360, UNIT_BIN = { y:62, w:66, h:112, gap:6,', replace:'var UNIT_H = 360, UNIT_BIN = { y:62, w:66, h:112, gap:-4,' },
    { file:'index', expect:'a second card in a box sticks out', find:'chipTop:32, chipStep:36,', replace:'chipTop:32, chipStep:50,' },
    { file:'index', expect:'unit: cards', find:'var UNIT_CARD = { w:136, h:54, x:[76, 224], y0:194, step:64 };', replace:'var UNIT_CARD = { w:136, h:54, x:[76, 224], y0:194, step:50 };' },
    { file:'index', expect:'reach the unit boxes', find:'var UNIT_CARD = { w:136, h:54, x:[76, 224], y0:194, step:64 };', replace:'var UNIT_CARD = { w:136, h:54, x:[76, 224], y0:150, step:64 };' },
    { file:'index', expect:'unitCardXY(', find:'    return { x:inRow === 1 ? 150 : UNIT_CARD.x[c % 2], y:UNIT_CARD.y0 + row * UNIT_CARD.step };', replace:'    return { x:UNIT_CARD.x[c % 2], y:UNIT_CARD.y0 + row * UNIT_CARD.step };' },
    { file:'index', expect:'a wrong unit is accepted', find:"        if (bn.u !== it.u){ roundMiss(", replace:"        if (bn.u === '?'){ roundMiss(" },
    { file:'index', expect:'too big or too small', find:'it.v, bn.u, bn.i > GAME_UNITS.indexOf(it.u))); return false; }', replace:'it.v, bn.u, bn.i < GAME_UNITS.indexOf(it.u))); return false; }' },
    { file:'index', expect:'gUnitWrong zh', find:"var B = { mm:'尺上的一小格', cm:'尺上的一大格',", replace:"var B = { mm:'尺上的一大格', cm:'尺上的一大格'," },
    { file:'index', expect:'en gUnitWrong', find:"'? Far too ' + (bigger ? 'big' : 'small')", replace:"'? Far too ' + (bigger ? 'small' : 'big')" },

    /* 讀尺 */
    { file:'index', expect:'the cm and mm parts are the same', find:'var GAME_RULER = [23, 35, 41, 17,', replace:'var GAME_RULER = [22, 35, 41, 17,' },
    { file:'index', expect:'has no mm part', find:'var GAME_RULER = [23, 35, 41, 17,', replace:'var GAME_RULER = [20, 35, 41, 17,' },
    { file:'index', expect:'does not fit the 5 cm ruler', find:'var GAME_RULER = [23, 35, 41, 17,', replace:'var GAME_RULER = [53, 35, 41, 17,' },
    { file:'index', expect:'crayon', find:"s += '<rect x=\"' + G.x0 + '\" y=\"' + G.bar.y + '\" width=\"' + (L * G.px) + '\"", replace:"s += '<rect x=\"' + G.x0 + '\" y=\"' + G.bar.y + '\" width=\"' + ((L + 1) * G.px) + '\"" },
    { file:'index', expect:'cm ticks', find:"var x = rulerX(mm), len = mm % 10 === 0 ? 20 : (mm % 5 === 0 ? 14 : 8);", replace:"var x = rulerX(mm), len = mm % 10 === 1 ? 20 : (mm % 5 === 0 ? 14 : 8);" },
    { file:'index', expect:'mm apart on a 375px phone', find:'RULER_G = { x0:15, px:5.4,', replace:'RULER_G = { x0:15, px:3.4,' },
    { file:'index', expect:'the ruler sticks out', find:'RULER_G = { x0:15, px:5.4,', replace:'RULER_G = { x0:25, px:5.4,' },
    { file:'index', expect:'ruler: the sentence', find:"lbls:[{ x:80, w:40 }, { x:172, w:40 },", replace:"lbls:[{ x:70, w:40 }, { x:172, w:40 }," },
    { file:'index', expect:'the card tray reaches the sentence', find:'var RULER_CARD = { y:236, size:52, step:66 };', replace:'var RULER_CARD = { y:196, size:52, step:66 };' },
    { file:'index', expect:'ruler: cards', find:'var RULER_CARD = { y:236, size:52, step:66 };', replace:'var RULER_CARD = { y:236, size:52, step:50 };' },
    { file:'index', expect:'the ruler cards should be', find:'      renderTray(B, [c, m, t, c + m], RULER_CARD.y,', replace:'      renderTray(B, [c, m, t, c + 1], RULER_CARD.y,' },
    { file:'index', expect:'the boxes should want', find:'      var want = [c, m, t], kinds', replace:'      var want = [c, m, c + m], kinds' },
    { file:'index', expect:'a wrong card is accepted in a box', find:'        if (v !== s.want){\n          if (s.kind', replace:'        if (v === -1){\n          if (s.kind' },
    { file:'index', expect:'zh gRulerTot', find:"return '一大格是 10 小格：' + c + ' × 10 ＋ ' + m + ' ＝ ' + t + '，一共 '", replace:"return '一大格是 10 小格：' + c + ' × 10 ＋ ' + m + ' ＝ ' + (t + 1) + '，一共 '" },
    { file:'index', expect:'en gRulerCm', find:"'For cm, count the big marks: there are ' + c + ' big marks", replace:"'For cm, count the big marks: there are ' + (c + 1) + ' big marks" },
    { file:'index', expect:'zh gRulerDone', find:"'蠟筆長 ' + c + ' 公分 ' + m + ' 毫米：'", replace:"'蠟筆長 ' + m + ' 公分 ' + c + ' 毫米：'" },

    /* 接 0 */
    { file:'index', expect:'ZERO_STEPS', find:"{ from:'m', to:'cm', f:100 }", replace:"{ from:'m', to:'cm', f:10 }" },
    { file:'index', expect:'ZERO_STEPS', find:"{ from:'km', to:'m', f:1000 }", replace:"{ from:'km', to:'cm', f:1000 }" },
    { file:'index', expect:'zeroNeed(', find:'  function zeroNeed(f){ return String(f).length - 1; }', replace:'  function zeroNeed(f){ return String(f).length - 2; }' },
    { file:'index', expect:'above 10000', find:'var GAME_ZERO = { km:[2, 3, 4, 5, 6, 7, 8, 9], m:', replace:'var GAME_ZERO = { km:[2, 3, 4, 5, 6, 7, 8, 12], m:' },
    { file:'index', expect:'ZERO_MAX', find:'var ZERO_H = 330, ZERO_LAD = { y:8, h:36 }, ZERO_MAX = 4;', replace:'var ZERO_H = 330, ZERO_LAD = { y:8, h:36 }, ZERO_MAX = 3;' },
    { file:'index', expect:'the ladder', find:"gZeroLadder:'公里 ×1000→ 公尺 ×100→ 公分 ×10→ 毫米',", replace:"gZeroLadder:'公里 ×1000→ 公尺 ×10→ 公分 ×100→ 毫米'," },
    { file:'index', expect:'zero: rows', find:'var ZERO_ROW = { y0:86, step:66,', replace:'var ZERO_ROW = { y0:86, step:50,' },
    { file:'index', expect:'does not fit', find:'cell:{ cx:155, w:110, h:48 }', replace:'cell:{ cx:155, w:80, h:48 }' },
    { file:'index', expect:'the ⌫ button', find:'undo:{ cx:276, size:48 }', replace:'undo:{ cx:276, size:40 }' },
    { file:'index', expect:'the 0 card reaches', find:'var ZERO_CARD = { x:150, y:286, size:56 };', replace:'var ZERO_CARD = { x:150, y:250, size:56 };' },
    { file:'index', expect:'an empty row is counted as a mistake', find:"        if (open.some(function(r){ return r.z === 0; })){ gMsg.textContent = d.gZeroEmpty; return; }", replace:"        if (open.some(function(r){ return r.z === 0; })){ roundMiss(d.gZeroEmpty); return; }" },
    { file:'index', expect:'a wrong number of zeros is accepted', find:'        var wrong = open.filter(function(r){ return r.z !== r.need; });', replace:'        var wrong = open.filter(function(r){ return r.z < r.need; });' },
    { file:'index', expect:'more than ZERO_MAX', find:'        if (!r || r.z >= ZERO_MAX) return false;', replace:'        if (!r) return false;' },
    { file:'index', expect:'en gZeroFix', find:"' = ' + f + ' ' + UNIT_LABEL.en[to] + ', and ' +", replace:"' = ' + (f * 10) + ' ' + UNIT_LABEL.en[to] + ', and ' +" },
    { file:'index', expect:'zh gZeroFix', find:"a + ' × ' + f + ' ＝ ' + (a * f) + '：後面要接 '", replace:"a + ' × ' + f + ' ＝ ' + (a * f * 10) + '：後面要接 '" },

    /* 拼長度 */
    { file:'index', expect:'no entry with no 10 cm stick', find:'var GAME_BUILD = [345, 208, 163, 305, 270, 127, 352, 216];', replace:'var GAME_BUILD = [345, 218, 163, 315, 270, 127, 352, 216];' },
    { file:'index', expect:'no entry with no 1 cm cube', find:'var GAME_BUILD = [345, 208, 163, 305, 270, 127, 352, 216];', replace:'var GAME_BUILD = [345, 208, 163, 305, 271, 127, 352, 216];' },
    { file:'index', expect:'should be 101~399', find:'var GAME_BUILD = [345,', replace:'var GAME_BUILD = [445,' },
    { file:'index', expect:'BUILD_VALS', find:'BUILD_VALS = [100, 10, 1];', replace:'BUILD_VALS = [100, 5, 1];' },
    { file:'index', expect:'lane', find:'x0:[104, 78, 78], step:[76, 25, 22]', replace:'x0:[104, 78, 78], step:[76, 25, 28]' },
    { file:'index', expect:'lane', find:'x0:[104, 78, 78], step:[76, 25, 22]', replace:'x0:[104, 58, 78], step:[76, 25, 22]' },
    { file:'index', expect:'the tray reaches the build area', find:'var BUILD_TRAY = { y:240,', replace:'var BUILD_TRAY = { y:200,' },
    { file:'index', expect:'build: tray', find:'var BUILD_TRAY = { y:240, x:[76, 182, 256],', replace:'var BUILD_TRAY = { y:240, x:[76, 160, 256],' },
    { file:'index', expect:'a piece that goes over is accepted', find:'        if (v > left){ roundMiss(d.gBuildOver(T, total, k)); return false; }\n', replace:'' },
    { file:'index', expect:'a smaller piece is accepted while a bigger one fits', find:'        for (var b = 0; b < k; b++) if (BUILD_VALS[b] <= left){ roundMiss(d.gBuildBig(T, total, b)); return false; }\n', replace:'' },
    { file:'index', expect:'the round is not solved exactly', find:'        if (total === T){\n          pieces.forEach', replace:'        if (total >= T - 1){\n          pieces.forEach' },
    { file:'index', expect:'zh gBuildDone', find:"(T + ' 公分 ＝ ' + M + ' 公尺 ' + S + ' 公分：' + M + ' × 100 ＋ ' + S + ' ＝ ' + T + '！')", replace:"(T + ' 公分 ＝ ' + M + ' 公尺 ' + (S * 10) + ' 公分：' + M + ' × 100 ＋ ' + S + ' ＝ ' + T + '！')" },
    { file:'index', expect:'en gBuildBig', find:"'Big ones first: ' + T + ' − ' + total + ' = ' + (T - total)", replace:"'Big ones first: ' + T + ' − ' + total + ' = ' + (T - total + 1)" },
    { file:'index', expect:'zh gBuildOver', find:"'就是 ' + total + ' ＋ ' + v + ' ＝ ' + (total + v) + ' 公分，比 '", replace:"'就是 ' + total + ' ＋ ' + v + ' ＝ ' + (total + 2 * v) + ' 公分，比 '" },

    /* 排長短 */
    { file:'index', expect:'two lengths are equal', find:"{ u:'cm', big:350 } ] },", replace:"{ u:'cm', big:300 } ] }," },
    { file:'index', expect:'no short small-unit trap', find:"{ u:'m', big:1, small:60 }, { u:'cm', big:150 }, { u:'m', big:1, small:5 }, { u:'cm', big:120 }", replace:"{ u:'m', big:1, small:60 }, { u:'cm', big:150 }, { u:'m', big:1, small:15 }, { u:'cm', big:120 }" },
    { file:'index', expect:'misreading', find:"{ u:'m', big:4, small:5 }, { u:'cm', big:450 }, { u:'cm', big:398 }, { u:'m', big:4, small:20 }", replace:"{ u:'m', big:4, small:5 }, { u:'cm', big:470 }, { u:'cm', big:398 }, { u:'m', big:4, small:20 }" },
    { file:'index', expect:'all in one unit', find:"{ base:'cm', items:[ { u:'m', big:3, small:8 }, { u:'cm', big:380 }, { u:'m', big:3 }, { u:'cm', big:350 } ] },", replace:"{ base:'cm', items:[ { u:'cm', big:308 }, { u:'cm', big:380 }, { u:'cm', big:300 }, { u:'cm', big:350 } ] }," },
    { file:'index', expect:'lenIn(', find:"  function lenIn(side, base){ return side.u === base ? side.big : side.big * UNIT_MULT[side.u] + (side.small || 0); }", replace:"  function lenIn(side, base){ return side.u === base ? side.big : side.big * UNIT_MULT[side.u] + (side.small || 0) * 10; }" },
    { file:'index', expect:'lenLabel(', find:"side.small ? (side.big + sp + u[side.u] + ' ' + side.small + sp + u[SMALL_OF[side.u]])", replace:"side.small ? (side.big + sp + u[side.u] + ' ' + side.small + sp + u[side.u])" },
    { file:'index', expect:'rank: slots', find:'var RANK_H = 372, RANK_SLOT = { cx:194, w:176, h:46, y0:34, step:54 }', replace:'var RANK_H = 372, RANK_SLOT = { cx:194, w:176, h:46, y0:34, step:44 }' },
    { file:'index', expect:'rank: the cards reach the slots', find:'var RANK_CARD = { w:136, h:48, x:[76, 224], y0:282, step:60 };', replace:'var RANK_CARD = { w:136, h:48, x:[76, 224], y0:240, step:60 };' },
    { file:'index', expect:'does not fit the 100 wide card', find:'var RANK_CARD = { w:136, h:48,', replace:'var RANK_CARD = { w:100, h:48,' },
    { file:'index', expect:'a card is accepted in the wrong place', find:'        if (v !== sl.want){\n          var shorter', replace:'        if (v === -1){\n          var shorter' },
    { file:'index', expect:'the slots do not want', find:"        return { r:r, want:sorted[r], el:z,", replace:"        return { r:r, want:vals[r], el:z," },
    { file:'index', expect:'zh gRankWrong', find:"'：比它短的有 ' + shorter + ' 張，所以它是第 ' + (shorter + 1) + ' 短的", replace:"'：比它短的有 ' + shorter + ' 張，所以它是第 ' + shorter + ' 短的" },
    { file:'index', expect:'en gRankDone', find:"return vals.join(' < ') + ' (' + UNIT_LABEL.en[base]", replace:"return vals.slice().reverse().join(' < ') + ' (' + UNIT_LABEL.en[base]" },

    { file:'index', expect:'ruler wording en cm changed', find:"'For cm, count the big marks: there are '", replace:"'For mm, count the small marks: there are '" },
    { file:'index', expect:'ruler wording zh mm changed', find:"多出來的小格：有 ' + m + ' 小格，不是 ' + v + ' 小格。'; },", replace:"多出來的大格：有 ' + m + ' 大格，不是 ' + v + ' 大格。'; }," },
    { file:'index', expect:'ruler wording zh mm changed', find:"多出來的小格：有 ' + m + ' 小格，不是 ' + v + ' 小格。'; },", replace:"多出來的小格：有 ' + m + ' 大格，不是 ' + v + ' 大格。'; }," },
    { file:'index', expect:'ruler wording zh c2 changed', find:"if (kind === 'c') return '從 0 開始數大格：", replace:"if (kind === 'c') return '從 0 開始數小格：" },
    { file:'index', expect:'the example has no longer side', find:"{ a:{unit:'cm', big:150}, b:{unit:'m', big:1, small:60} }", replace:"{ a:{unit:'cm', big:160}, b:{unit:'m', big:1, small:60} }" },
    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'should be 345', find:"why:'3 公尺 ＝ 300 公分，300 ＋ 45 ＝ 345，所以是 345 公分。' },", replace:"why:'3 公尺 ＝ 300 公分，300 ＋ 45 ＝ 354，所以是 345 公分。' }," },
    { file:'index', expect:'the two sides are', find:"why:'1 公分 ＝ 10 毫米，18 × 10 ＝ 180，所以是 180 毫米。' },", replace:"why:'1 公分 ＝ 100 毫米，18 × 10 ＝ 180，所以是 180 毫米。' }," },

    /* ---- review.html ---- */
    { file:'review', expect:'mm != cm*10', find:'        var mm = cm * 10;', replace:'        var mm = cm * 100;' },
    { file:'review', expect:'is copied straight out of the stem', find:'        var m = mixOpts(total, [big + small, big * 100, big * 1000 + small]);', replace:'        var m = mixOpts(total, [small, big * 100, big * 1000 + small]);' },
    { file:'review', expect:'rulerRead options should be exactly', find:"{ t:d.mm + ' 公分', v:vConfuse }", replace:"{ t:d.mm + ' 毫米', v:vConfuse }" },
    { file:'review', expect:'cmPart == mmPart', find:'          if (cmPart !== mmPart) break;', replace:'          if (cmPart !== mmPart || true) break;' },
    { file:'review', expect:'the right (q, r) appears 2 times', find:'          { q:q - 1, r:r + k },', replace:'          { q:q - 1, r:r + k }, { q:q, r:r },' }
  ],

  sim: {
    INVARIANTS: {
      cmToMm: d => { if (d.mm !== d.cm * 10) return 'mm != cm*10'; },
      mToCm: d => { if (d.cm !== d.m * 100) return 'cm != m*100'; },
      kmToM: d => { if (d.mt !== d.km * 1000) return 'm != km*1000'; },
      compoundToSmall: d => {
        if (d.total !== d.big * 100 + d.small) return 'total != big*100 + small';
        if (!(d.small >= 1 && d.small <= 99)) return 'small ' + d.small + ' is not 1..99';
      },
      smallToCompound: d => {
        if (d.total !== d.bigBack * 100 + d.smallBack) return 'total != bigBack*100 + smallBack';
        if (!(d.smallBack >= 1 && d.smallBack <= 99)) return 'no cm part';
        if (d.bigBack === d.smallBack) return 'bigBack == smallBack (the swapped option equals the answer)';
      },
      kmMCompound: d => {
        if (d.total !== d.bigBack * 1000 + d.smallBack) return 'total != bigBack*1000 + smallBack';
        if (!(d.smallBack >= 1 && d.smallBack <= 999)) return 'no m part';
        if (d.bigBack === d.smallBack) return 'bigBack == smallBack';
      },
      mixedSum: d => {
        if (d.aTotal !== d.aBig * 100 + d.aSmall || d.bTotal !== d.bBig * 100 + d.bSmall) return 'a part is not big*100 + small';
        if (d.total !== d.aTotal + d.bTotal) return 'total != aTotal + bTotal';
      },
      rulerRead: d => {
        if (d.mm !== d.cmPart * 10 + d.mmPart) return 'mm != cmPart*10 + mmPart';
        if (d.cmPart === d.mmPart) return 'cmPart == mmPart (the swapped option equals the answer)';
        if (!(d.mmPart >= 1)) return 'no mm part';
      },
      perimRect: d => { if (d.P !== (d.l + d.w) * 2) return 'P != (l + w) * 2'; },
      multiplyTwoByOne: d => { if (d.p !== d.a * d.dd) return 'p != a * dd'; },
      divideRemainder: d => {
        if (d.dividend !== d.k * d.q + d.r) return 'dividend != k*q + r';
        if (!(d.r >= 1 && d.r < d.k)) return 'remainder ' + d.r + ' is not 1..k-1';
        const right = d.tuples.filter(t => t.q === d.q && t.r === d.r);
        if (right.length !== 1) return 'the right (q, r) appears ' + right.length + ' times';
        if (d.tuples[d.ans].q !== d.q || d.tuples[d.ans].r !== d.r) return 'ans does not point at the right (q, r)';
        for (const t of d.tuples){ if (t === d.tuples[d.ans]) continue; if (d.k * t.q + t.r === d.dividend && t.r < d.k) return 'distractor ' + t.q + ' r ' + t.r + ' is also correct'; if (t.q < 0 || t.r < 0) return 'negative distractor'; }
      }
    },
    /* 正解的第二套實作：只用 make() 留下的原始參數重算，自己拼字串 */
    expectedCorrect: function(d, genId, lang){
      const zh = lang === 'zh';
      switch (genId){
        case 'cmToMm': return String(d.cm * 10);
        case 'mToCm': return String(d.m * 100);
        case 'kmToM': return String(d.km * 1000);
        case 'compoundToSmall': return String(d.big * 100 + d.small);
        case 'smallToCompound': { const B = Math.floor(d.total / 100), S = d.total % 100; return zh ? B + ' 公尺 ' + S + ' 公分' : B + ' m ' + S + ' cm'; }
        case 'kmMCompound': { const B = Math.floor(d.total / 1000), S = d.total % 1000; return zh ? B + ' 公里 ' + S + ' 公尺' : B + ' km ' + S + ' m'; }
        case 'mixedSum': return String(d.aBig * 100 + d.aSmall + d.bBig * 100 + d.bSmall);
        case 'rulerRead': { const C = Math.floor(d.mm / 10), M = d.mm % 10; return zh ? C + ' 公分 ' + M + ' 毫米' : C + ' cm ' + M + ' mm'; }
        case 'perimRect': return String(2 * d.l + 2 * d.w);
        case 'multiplyTwoByOne': return String(d.a * d.dd);
        case 'divideRemainder': { const q = Math.floor(d.dividend / d.k), r = d.dividend % d.k; return zh ? '商 ' + q + ' 餘 ' + r : q + ' r ' + r; }
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      const zh = lang === 'zh';
      const compound = (re, bigMax, smallMax) => {
        const m = s.match(re);
        if (!m) return 'option "' + s + '" is not a length in ' + lang;
        if (+m[1] < 1 || +m[1] > bigMax) return 'option "' + s + '" big part outside 1~' + bigMax;
        if (m[2] !== undefined && (+m[2] < 1 || +m[2] > smallMax)) return 'option "' + s + '" small part outside 1~' + smallMax;
      };
      if (genId === 'smallToCompound') return compound(zh ? /^(\d+) 公尺(?: (\d+) 公分)?$/ : /^(\d+) m(?: (\d+) cm)?$/, 99, 99);
      if (genId === 'kmMCompound') return compound(zh ? /^(\d+) 公里(?: (\d+) 公尺)?$/ : /^(\d+) km(?: (\d+) m)?$/, 999, 999);
      if (genId === 'rulerRead'){
        const m = s.match(zh ? /^(\d+) 公分(?: (\d+) 毫米)?$/ : /^(\d+) cm(?: (\d+) mm)?$/);
        if (!m) return 'option "' + s + '" is not a ruler reading in ' + lang;
        if (+m[1] < 1 || +m[1] > 99 || (m[2] !== undefined && (+m[2] < 1 || +m[2] > 9))) return 'option "' + s + '" is outside the ruler';
        return;
      }
      if (genId === 'divideRemainder'){
        if (!(zh ? /^商 \d+ 餘 \d+$/ : /^\d+ r \d+$/).test(s)) return 'option "' + s + '" is not a quotient-and-remainder in ' + lang;
        return;
      }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const n = Number(s);
      if (n < 1 || n > 10000) return 'option ' + n + ' outside 1~10000 (grade 3)';
    },
    /* 刻意的迷思誘答，只放行那一個值（review.html 那一側在候選清單旁各自寫著同一件事）：
       單位換了、數字沒換（18 公分 → 18 毫米）；把總毫米數讀成公分（指標在 35 毫米 → 35 公分）。 */
    stemEchoOk: {
      cmToMm: (d, opt) => String(opt) === String(d.cm),
      mToCm: (d, opt) => String(opt) === String(d.m),
      kmToM: (d, opt) => String(opt) === String(d.km)
    },
    /* rulerRead 的選項帶單位（「35 公分」），simgen 的抄題檢查只比整個選項等於題幹數字的情況，stemEchoOk 在那裡永遠不會被呼叫
       （codex 第一輪抓到）。所以直接從渲染出來的那一題要求：四個選項剛好是自己算的這四個 —— 抄回題幹數字的只有「mm 公分」那一個。 */
    renderCheck: function(d, q, lang, genId){
      if (genId !== 'rulerRead') return;
      const C = Math.floor(d.mm / 10), M = d.mm % 10, zh = lang === 'zh';
      const f = (a, ua, b, ub) => a + ' ' + ua + (b === undefined ? '' : ' ' + b + ' ' + ub);
      const cm = zh ? '公分' : 'cm', mm = zh ? '毫米' : 'mm';
      const want = [f(C, cm, M, mm), f(M, cm, C, mm), f(C + M, cm), f(d.mm, cm)].sort().join(' | ');
      const got = q.opts.slice().sort().join(' | ');
      if (got !== want) return 'rulerRead options should be exactly ' + want + ' (only "' + f(d.mm, cm) + '" repeats the stem number), got ' + got;
      if (q.opts.filter(o => nums(o).indexOf(d.mm) >= 0).length !== 1) return 'rulerRead: more than one option repeats the stem number ' + d.mm;
    }
  },

  data: {
    dataStart: '  /* ================= 語言無關的長度資料',
    dataEnd: '  /* ================= i18n ================= */',
    dataReturn: '{UNIT_LABEL, formatLength, sideCM, sideLabel, OBJS, RULER_MMS, LADDER_KM, LEVEL_KEYS, LEVEL_FACTOR, COMPOUNDS, ADD_SETS, CMP_SETS, GPICK, GAME_UNITS, UNIT_H, UNIT_BIN, UNIT_CARD, GAME_UNIT, unitBinX, unitCardXY, unitPickSet, RULER_H, RULER_G, RULER_EQ, RULER_CARD, GAME_RULER, rulerX, rulerBoardSVG, ZERO_H, ZERO_LAD, ZERO_MAX, ZERO_ROW, ZERO_CARD, ZERO_STEPS, GAME_ZERO, zeroNeed, BUILD_H, BUILD_AREA, BUILD_VALS, BUILD_LANE, BUILD_TRAY, GAME_BUILD, buildChipX, RANK_H, RANK_SLOT, RANK_LBL, RANK_CARD, SMALL_OF, UNIT_MULT, GAME_RANK, lenIn, lenLabel, rankCardXY}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 兩個掃描器自己先證明會響（positive / negative control） --- */
      [['18 × 10 ＝ 180', true], ['18 × 10 ＝ 181', false], ['300 ＋ 45 ＝ 345', true], ['300 ＋ 45 ＝ 354', false], ['2×100＋5 ＝ 205', true], ['2×100＋5 ＝ 250', false],
       ['300 − 25 ＝ 275', true], ['300 − 25 ＝ 285', false], ['3 × 10 ＋ 5 ＝ 35', true]]
        .forEach(([t, good]) => {
          const r = scanEquations(t);
          if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
        });
      [['2 公尺 5 公分 ＝ 205 公分', true], ['2 公尺 5 公分 ＝ 250 公分', false], ['1 公分 ＝ 10 毫米', true], ['1 公分 ＝ 100 毫米', false], ['1 km = 1000 m', true], ['1 km 300 m = 1300 m', true],
       ['3 m = 30 cm', false], ['405 cm = 4 m 5 cm', true], ['1 公里 ＝ 100 公尺', false]]
        .forEach(([t, good]) => {
          const r = scanLengths(t);
          if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanLengths() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
        });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的算式與長度等式逐條重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0, checkedLen = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        scanEquations(s).forEach(e => { checkedEq++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
        scanLengths(s).forEach(e => { checkedLen++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
      }));
      if (checkedEq < 15) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
      if (checkedLen < 20) fail('only ' + checkedLen + ' length equalities found in the I18N strings — the length scan is not reading them');

      /* 範例 5 的比較：每一組一定分得出長短（範例才示範得到「先統一單位」），sideCM 和自己的換算一致 */
      D.CMP_SETS.forEach((s, i) => {
        const mine = x => x.unit === 'm' ? x.big * 100 + (x.small || 0) : x.big;
        if (D.sideCM(s.a) !== mine(s.a) || D.sideCM(s.b) !== mine(s.b)) fail('CMP_SETS[' + i + ']: sideCM() disagrees with 1 m = 100 cm');
        if (mine(s.a) === mine(s.b)) fail('CMP_SETS[' + i + ']: both sides are ' + mine(s.a) + ' cm — the example has no longer side');
      });

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['unit', 'ruler', 'zero', 'build', 'rank'];
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
      /* 每一句說明：數字照順序逐個比，句子裡的每一條算式都要算得對；長度等式除了刻意寫錯的那幾條（wrongLen）都要相等 */
      const seq = (where, text, want, wrongLen) => {
        if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
        const got = nums(text).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        scanEquations(text).filter(e => e.bad).forEach(e => fail(where + ': "' + e.text + '" ' + e.bad));
        const lb = scanLengths(text).filter(e => e.bad);
        if (lb.length !== (wrongLen || 0)) fail(where + ': ' + lb.length + ' false length equalities (expected ' + (wrongLen || 0) + ') — ' + text);
      };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const grow = (o, p) => ({ x:o.x - p, y:o.y - p, w:o.w + 2 * p, h:o.h + 2 * p });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_UNIT', 'GAME_RULER', 'GAME_BUILD', 'GAME_RANK'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });
      /* 中文字寬（估計）：CJK 一個字一個 font-size，數字與英文約 0.58 */
      /* 符號（─ → ×）與中文一律算全形，寧可估寬 */
      const textW = (t, fs) => [...String(t)].reduce((a, ch) => a + (/[ -鿿＀-￯]/.test(ch) ? fs : ch === ' ' ? fs * 0.3 : fs * 0.6), 0);
      const cssFs = (sel, what) => {
        const m = src.match(new RegExp(sel.replace(/\./g, '\\.') + '\\{[^}]*?font-size:(\\d+)px'));
        const v = m ? +m[1] : 0;
        if (!(v >= 12)) fail(what + ': cannot read the ' + sel + ' font-size from the CSS');
        return v;
      };

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。
         點目的地的格子也要點得到：格子加上兩邊的 pad 至少 44。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('a unit card (' + D.UNIT_CARD.h + ' high)', D.UNIT_CARD.h);
      tooSmall('a ruler card (' + D.RULER_CARD.size + ')', D.RULER_CARD.size);
      tooSmall('the 0 card (' + D.ZERO_CARD.size + ')', D.ZERO_CARD.size);
      tooSmall('the ⌫ button (' + D.ZERO_ROW.undo.size + ')', D.ZERO_ROW.undo.size);
      D.BUILD_TRAY.w.forEach((w, k) => tooSmall('build tray piece ' + k + ' (' + w + '×' + D.BUILD_TRAY.h + ')', Math.min(w, D.BUILD_TRAY.h)));
      tooSmall('a rank card (' + D.RANK_CARD.h + ' high)', D.RANK_CARD.h);
      tooSmall('a ruler box with its pad', D.RULER_EQ.slot + 2 * 4);
      tooSmall('a rank box with its pad', D.RANK_SLOT.h + 2 * 4);
      [D.UNIT_CARD.h, D.RULER_CARD.size, D.ZERO_CARD.size, D.BUILD_TRAY.h, D.RANK_CARD.h].concat(D.BUILD_TRAY.w).forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });

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

      /* --- nearestOpen()：從原始碼切出來真的跑 ---
         ① 點在格子裡的，一定判給那一格 ② 最近的那格已經放好了就不收 ③ 離每一格都遠 → 不收
         ④ 大小不一樣的兩塊：大塊裡、靠近小塊邊上的點判給大塊 */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const sets = [
            ['ruler boxes', D.RULER_EQ.slots.map((x, i) => ({ id:i, cx:x, cy:D.RULER_EQ.y, hw:D.RULER_EQ.slot / 2, hh:D.RULER_EQ.slot / 2, done:false })), 4],
            ['rank boxes', [0, 1, 2, 3].map(r => ({ id:r, cx:D.RANK_SLOT.cx, cy:D.RANK_SLOT.y0 + r * D.RANK_SLOT.step, hw:D.RANK_SLOT.w / 2, hh:D.RANK_SLOT.h / 2, done:false })), 4],
            ['zero rows', [0, 1, 2].map(r => ({ id:r, cx:D.ZERO_ROW.cell.cx, cy:D.ZERO_ROW.y0 + r * D.ZERO_ROW.step, hw:D.ZERO_ROW.cell.w / 2, hh:D.ZERO_ROW.cell.h / 2, done:false })), 6],
            ['unit boxes', [0, 1, 2, 3].map(i => ({ id:i, cx:D.unitBinX(i), cy:D.UNIT_BIN.y, hw:D.UNIT_BIN.w / 2, hh:D.UNIT_BIN.h / 2, done:false })), 6]
          ];
          sets.forEach(([what, list, pad]) => {
            let bad = 0;
            list.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 2){ const g = nearestOpen(list, { x, y }, pad); if (!g || g.id !== b.id) bad++; } });
            if (bad) fail('nearestOpen(): ' + bad + ' points inside one of the ' + what + ' are given to another box (or none)');
          });
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：選單位（範例 1） --- */
      {
        if (D.GAME_UNITS.join() !== RANK.join()) fail('GAME_UNITS should be ' + RANK.join() + ' (small to big), got ' + D.GAME_UNITS.join());
        const UB = D.UNIT_BIN, UC = D.UNIT_CARD;
        const cardFs = +((src.match(/\.gucard\{[^}]*?font-size:(\d+)px/) || [])[1] || 0);
        if (!(cardFs >= 13)) fail('unit: cannot read the .gucard font-size from the CSS (got ' + cardFs + ')');
        RANK.forEach(u => { const n = D.GAME_UNIT.filter(x => x.u === u).length; if (n < 2) fail('GAME_UNIT: fewer than 2 cards for ' + u + ' (' + n + ') — the round would show the same card every time'); });
        const ids = new Set();
        D.GAME_UNIT.forEach((it, i) => {
          const w = 'GAME_UNIT[' + i + '] ' + it.id;
          if (ids.has(it.id)) fail(w + ': duplicate id'); ids.add(it.id);
          if (!isInt(it.v) || it.v < 1) return fail(w + ': value is not a positive whole number');
          const real = REAL[it.id];
          if (!real) return fail(w + ': no real-size range for this card in the config — add one');
          const fits = RANK.filter(u => it.v * MM[u] >= real[0] && it.v * MM[u] <= real[1]);
          if (fits.length !== 1 || fits[0] !== it.u) fail(w + ': ' + it.v + ' makes sense in ' + (fits.join('/') || 'no unit') + ', the page says ' + it.u);
          /* 其他三個單位至少差十倍（不是邊界上的模糊地帶） */
          RANK.filter(u => u !== it.u).forEach(u => { const x = it.v * MM[u]; if (x >= real[0] / 5 && x <= real[1] * 5) fail(w + ': ' + it.v + ' ' + u + ' is too close to the real size to be clearly wrong'); });
          LANGS.forEach(L => {
            const d = I18N[L], name = d.gUnitNames && d.gUnitNames[it.id];
            if (typeof name !== 'string' || !name) return fail(w + ': gUnitNames missing in ' + L);
            const card = d.gUnitCard(name, it.v);
            if (!Array.isArray(card) || card.length !== 2) return fail(w + ': gUnitCard should give two lines in ' + L);
            seq(w + ' ' + L + ' card', card.join(' '), nums(name).concat([it.v]));
            if (textW(card[0], cardFs) > UC.w - 10) fail(w + ': "' + card[0] + '" does not fit a ' + UC.w + ' wide card in ' + L);
            /* 每一個放錯的單位：太大還是太小用自己的大小判斷；身體尺那一句的數字 */
            RANK.forEach(u => {
              if (u === it.u) return;
              const bigger = MM[u] > MM[it.u], txt = d.gUnitWrong(name, it.v, u, bigger);
              const benchNums = u === 'km' ? [15] : [];
              seq(w + ' ' + L + ' gUnitWrong ' + u, txt, nums(name).concat([it.v, 1], benchNums));
              const says = L === 'zh' ? (/太大/.test(txt) ? 'big' : /太小/.test(txt) ? 'small' : '?') : (/too big/.test(txt) ? 'big' : /too small/.test(txt) ? 'small' : '?');
              if (says !== (bigger ? 'big' : 'small')) fail(w + ' ' + L + ' gUnitWrong ' + u + ': says too ' + says + ', should be too ' + (bigger ? 'big' : 'small') + ' — ' + txt);
              if (txt.indexOf(L === 'zh' ? ZH[u] : ' ' + u) < 0) fail(w + ' ' + L + ' gUnitWrong ' + u + ': does not name the unit it was put in');
            });
            seq(w + ' ' + L + ' gUnit2', d.gUnit2(name, it.v, it.u), nums(name).concat([it.v, it.v]));
            if (d.gUnit2(name, it.v, it.u).indexOf(L === 'zh' ? ZH[it.u] : it.u) < 0) fail(w + ' gUnit2 ' + L + ' does not name the right unit');
          });
          if (it.icon.length > 4 || /\w/.test(it.icon)) fail(w + ': icon should be one emoji');
        });
        /* 身體尺本身：每一種單位的那一句是真的（用自己的表：1 毫米＝尺上的一小格、1 公分＝一大格、1 公尺≈一大步、1 公里≈走 15 分鐘） */
        LANGS.forEach(L => {
          const t = u => I18N[L].gUnitWrong('X', 1, u, true);
          const want = L === 'zh' ? { mm:'一小格', cm:'一大格', m:'一大步', km:'15 分鐘' } : { mm:'one small mark', cm:'one big mark', m:'big step', km:'15-minute walk' };
          RANK.forEach(u => { if (t(u).indexOf(want[u]) < 0) fail('gUnitWrong ' + L + ': the size of 1 ' + u + ' should be "' + want[u] + '" — ' + t(u)); });
          seq('gUnitNow ' + L, I18N[L].gUnitNow(2, 5), [2, 5]);
          if (typeof I18N[L].gUnitDone !== 'string') fail('gUnitDone missing in ' + L);
        });
        /* unitPickSet() 真的跑：每一次 5 張、四種單位都有、一格最多兩張、不重複 */
        let bad = null;
        const seen = new Set();
        for (let n = 0; n < 3000 && !bad; n++){
          const set = D.unitPickSet(D.GAME_UNIT);
          const per = {}; set.forEach(x => { per[x.u] = (per[x.u] || 0) + 1; seen.add(x.id); });
          if (set.length !== 5) bad = set.length + ' cards';
          else if (new Set(set).size !== 5) bad = 'a card twice';
          else if (!RANK.every(u => per[u] >= 1)) bad = 'a unit has no card: ' + JSON.stringify(per);
          else if (Object.values(per).some(c => c > 2)) bad = 'a unit gets 3 cards';
        }
        if (bad) fail('unitPickSet(): ' + bad);
        if (seen.size !== D.GAME_UNIT.length) fail('unitPickSet(): only ' + seen.size + ' of ' + D.GAME_UNIT.length + ' cards ever come up in 3000 rounds');
        /* 版面：四個格子在畫板裡、互不重疊；一格放得下兩張小卡；五張卡片互不重疊、離格子夠遠 */
        const bins = [0, 1, 2, 3].map(i => { if (!near(D.unitBinX(i), 150 + (i - 1.5) * (UB.w + UB.gap))) fail('unitBinX(' + i + ') is off'); return sq(D.unitBinX(i), UB.y, UB.w, UB.h); });
        bins.forEach((o, i) => inside(o, 'unit bin ' + i, W, D.UNIT_H)); noHits(bins, 'unit: bins');
        if (UB.chipTop < 26) fail('unit: the first card in a box covers the unit name');
        if (UB.chipTop + UB.chipStep + UB.chipH > UB.h - 4) fail('unit: a second card in a box sticks out of the box');
        if (UB.chipW > UB.w - 6) fail('unit: a card in a box is wider than the box');
        const cards = [0, 1, 2, 3, 4].map(c => {
          const p = D.unitCardXY(c, 5), row = Math.floor(c / 2), mine = { x:(row === 2 ? 150 : UC.x[c % 2]), y:UC.y0 + row * UC.step };
          if (!near(p.x, mine.x) || !near(p.y, mine.y)) fail('unitCardXY(' + c + ', 5) is ' + JSON.stringify(p) + ', should be ' + JSON.stringify(mine));
          return sq(p.x, p.y, UC.w, UC.h);
        });
        cards.forEach((o, i) => inside(o, 'unit card ' + i, W, D.UNIT_H)); noHits(cards, 'unit: cards');
        cards.forEach((o, i) => bins.forEach((b, j) => { if (hit(o, grow(b, 6 + 8))) fail('unit: card ' + i + ' at home is within reach the unit boxes (' + j + ')'); }));
        need('unit', /var bins = GAME_UNITS\.map\(function\(u, i\)\{\s*var cx = unitBinX\(i\)/, 'the boxes are not drawn in GAME_UNITS order at unitBinX()');
        need('unit', /var cards = shuffle\(set\)\.map\(function\(it, c\)\{\s*var p = unitCardXY\(c, set\.length\)/, 'the unit cards are not shuffled');
        need('unit', /var set = unitPickSet\(GAME_UNIT\)/, 'the cards do not come from unitPickSet()');
        need('unit', /var bn = nearestOpen\(bins, pt, 6\);/, 'a card is not dropped into the nearest box');
        need('unit', /if \(bn\.u !== it\.u\)\{ roundMiss\(d\.gUnitWrong\(d\.gUnitNames\[it\.id\], it\.v, bn\.u, bn\.i > GAME_UNITS\.indexOf\(it\.u\)\)\); return false; \}/, 'a wrong unit is accepted, or the reason does not say too big or too small');
        need('unit', /if \(placed === set\.length\) roundSolved\(/, 'the round is not solved when every card is sorted');
      }

      /* --- 第 2 關：讀尺（範例 2） —— 把 rulerBoardSVG() 畫出來的東西量回來 --- */
      {
        const G = D.RULER_G, EQ = D.RULER_EQ, RC = D.RULER_CARD;
        if (G.cm !== 5) fail('ruler: the ruler should be 5 cm long, got ' + G.cm);
        if (!(G.px * scale >= 5)) fail('ruler: millimetre marks are ' + (G.px * scale).toFixed(1) + 'px apart on a 375px phone — mm apart on a 375px phone must be at least 5px to count');
        if (G.x0 - 9 < 0 || G.x0 + G.cm * 10 * G.px + 9 > W) fail('ruler: the ruler sticks out of the 300 board');
        const attrs = tag => { const o = {}; tag.replace(/(\w[\w-]*)="([^"]*)"/g, (_, k, v) => { o[k] = v; }); return o; };
        D.GAME_RULER.forEach((L0, i) => {
          const w = 'GAME_RULER[' + i + '] ' + L0;
          if (!isInt(L0)) return fail(w + ': not a whole number');
          const c = Math.floor(L0 / 10), m = L0 % 10;
          if (L0 >= G.cm * 10 || L0 < 11) fail(w + ': does not fit the 5 cm ruler (11~49 mm)');
          if (m === 0) fail(w + ': has no mm part — the reading would be just centimetres');
          if (c === m) fail(w + ': the cm and mm parts are the same — swapping them would still be right');
          const cardsV = [c, m, L0, c + m];
          if (new Set(cardsV).size !== 4) fail(w + ': two cards have the same number ' + cardsV.join());
          /* SVG 量回來 */
          const svg = D.rulerBoardSVG(L0);
          const lines = (svg.match(/<line [^>]*\/>/g) || []).map(attrs), rects = (svg.match(/<rect [^>]*\/>/g) || []).map(attrs);
          const texts = (svg.match(/<text [^>]*>[^<]*<\/text>/g) || []).map(t => ({ a:attrs(t), s:t.replace(/<[^>]+>/g, '') }));
          const ticks = lines.filter(l => !l['stroke-dasharray']);
          if (ticks.length !== G.cm * 10 + 1) fail(w + ': ' + ticks.length + ' ticks drawn, should be ' + (G.cm * 10 + 1));
          const cmT = ticks.filter(l => l['stroke-width'] === '2').map(l => +l.x1);
          const mine = k => G.x0 + k * G.px;
          if (cmT.length !== G.cm + 1 || cmT.some((x, k) => !near(x, mine(10 * k)))) fail(w + ': the cm ticks are not at every 10 mm: ' + cmT.join());
          ticks.forEach((l, k) => { if (!near(+l.x1, mine(k))) fail(w + ': tick ' + k + ' is at ' + l.x1 + ', should be ' + mine(k)); const len = +l.y2 - +l.y1, wantLen = k % 10 === 0 ? 20 : k % 5 === 0 ? 14 : 8; if (len !== wantLen) fail(w + ': tick ' + k + ' is ' + len + ' long, should be ' + wantLen + ' (cm ticks the longest, then the 5 mm mark)'); });
          const lab = texts.map(t => [+t.a.x, t.s]);
          if (lab.length !== G.cm + 1 || lab.some(([x, s], k) => !near(x, mine(10 * k)) || s !== String(k))) fail(w + ': the numbers under the cm ticks are wrong: ' + JSON.stringify(lab));
          const bar = rects.filter(r => r.fill === '#E8871E')[0];
          if (!bar) fail(w + ': no crayon drawn');
          else {
            const end = +bar.x + +bar.width;
            if (!near(+bar.x, mine(0))) fail(w + ': the crayon does not start at 0');
            if (!near(end, mine(L0))) fail(w + ': the crayon ends at x ' + end + ', not at the ' + L0 + ' mm tick');
            /* 從圖讀：尾巴前面有幾個公分刻度（不算 0）、最後一個公分刻度後面有幾個毫米刻度 */
            const cmBefore = cmT.filter(x => x > mine(0) + 0.1 && x <= end + 1e-6).length;
            const lastCm = Math.max(...cmT.filter(x => x <= end + 1e-6));
            const mmAfter = ticks.filter(l => +l.x1 > lastCm + 1e-6 && +l.x1 <= end + 1e-6).length;
            if (cmBefore !== c || mmAfter !== m) fail(w + ': the picture reads ' + cmBefore + ' cm ' + mmAfter + ' mm, the answer is ' + c + ' cm ' + m + ' mm');
          }
          const dash = lines.filter(l => l['stroke-dasharray'])[0];
          if (!dash || !near(+dash.x1, mine(L0))) fail(w + ': the red end line is not at the end of the crayon');
          LANGS.forEach(L => {
            const d = I18N[L];
            [m, L0, c + m].forEach(v => seq(w + ' ' + L + ' gRulerCm ' + v, d.gRulerCm(c, v), [c, v]));
            [c, L0, c + m].forEach(v => seq(w + ' ' + L + ' gRulerMm ' + v, d.gRulerMm(c, m, v), [c, m, v]));
            [c, m, c + m].forEach(v => seq(w + ' ' + L + ' gRulerTot ' + v, d.gRulerTot(c, m, L0, v), [10, c, 10, m, L0, L0, v]));
            seq(w + ' ' + L + ' gRuler2 c', d.gRuler2('c', c, m), [0, c]);
            seq(w + ' ' + L + ' gRuler2 m', d.gRuler2('m', c, m), [c, m]);
            seq(w + ' ' + L + ' gRuler2 t', d.gRuler2('t', c, m), [c, c, 10, m]);
            if (nums(d.gRuler2('t', c, m)).indexOf(L0) >= 0) fail(w + ' gRuler2 t ' + L + ': the hint gives away the answer ' + L0);
            seq(w + ' ' + L + ' gRulerDone', d.gRulerDone(c, m, L0), [c, m, c, 10, m, L0, L0]);
            seq(w + ' ' + L + ' gRulerNow', d.gRulerNow(c, m, L0), [c, m, L0]);
          });
        });
        /* 說明用的詞：公分數大格、毫米數小格（數字對、詞說反了，一樣是教錯）—— codex 第一輪抓到「沒驗詞」，第二輪抓到「只驗有沒有出現那個詞」
           還是會漏（一句裡留一個「小格」、其他換成「大格」照樣過）。所以整句釘死：用 7、8、9 代進去，必須一字不差是下面這幾句。
           改措辭的時候連這裡一起改 —— 這是故意的，教「數什麼」的句子不可以在沒有人看過的情況下變。 */
        const PIN = {
          zh:{ cm:'公分要數大格：蠟筆的尾巴前面有 7 個大格，不是 9 個。', mm:'毫米要數第 7 個大格後面多出來的小格：有 8 小格，不是 9 小格。',
               tot:'一大格是 10 小格：7 × 10 ＋ 8 ＝ 78，一共 78 毫米，不是 9 毫米。', c2:'從 0 開始數大格：蠟筆的尾巴前面有 7 個大格。', m2:'第 7 個大格後面，再數到蠟筆的尾巴：有 8 小格。' },
          en:{ cm:'For cm, count the big marks: there are 7 big marks before the end of the crayon, not 9.', mm:'For mm, count the small marks after big mark 7: there are 8, not 9.',
               tot:'One big mark is 10 small marks: 7 × 10 + 8 = 78, so 78 mm in all, not 9 mm.', c2:'Count the big marks from 0: there are 7 before the end of the crayon.', m2:'After big mark 7, count on to the end of the crayon: 8 small marks.' }
        };
        LANGS.forEach(L => {
          const d = I18N[L], got = { cm:d.gRulerCm(7, 9), mm:d.gRulerMm(7, 8, 9), tot:d.gRulerTot(7, 8, 78, 9), c2:d.gRuler2('c', 7, 8), m2:d.gRuler2('m', 7, 8) };
          Object.keys(PIN[L]).forEach(k => { if (got[k] !== PIN[L][k]) fail('ruler wording ' + L + ' ' + k + ' changed — what is counted (big marks = cm, small marks = mm) must read exactly "' + PIN[L][k] + '", got "' + got[k] + '"'); });
        });
        LANGS.forEach(L => { if (nums(I18N[L].gRulerNow(null, null, null)).length) fail('gRulerNow ' + L + ' shows numbers before anything is placed'); if (!Array.isArray(I18N[L].gRulerLbls) || I18N[L].gRulerLbls.length !== 4) fail('gRulerLbls ' + L + ' should be 4 labels'); });
        LANGS.forEach(L => { const lb = I18N[L].gRulerLbls; if (UNAME[lb[0]] !== 'cm' || UNAME[lb[1]] !== 'mm' || UNAME[lb[3]] !== 'mm') fail('ruler: the sentence labels should read cm, mm, =, mm in ' + L + ': ' + lb.join()); });
        /* 版面：尺、算式、托盤互不重疊、都在畫板裡 */
        const rulerBox = { x:0, y:0, w:W, h:G.y + G.h + 4 };
        const parts = EQ.slots.map(x => sq(x, EQ.y, EQ.slot)).concat(EQ.lbls.map(l => sq(l.x, EQ.y, l.w, EQ.slot)));
        parts.forEach((o, k) => inside(o, 'ruler: sentence part ' + k, W, D.RULER_H));
        noHits(parts, 'ruler: the sentence parts');
        [[EQ.slots[0], EQ.lbls[0]], [EQ.slots[1], EQ.lbls[1]], [EQ.slots[2], EQ.lbls[3]]].forEach(([sx, lb], k) => { if (!(lb.x > sx)) fail('ruler: the unit label ' + k + ' is not right after its box'); });
        LANGS.forEach(L => I18N[L].gRulerLbls.forEach((t, k) => { if (textW(t, 18) > EQ.lbls[k].w + 2) fail('ruler: label "' + t + '" does not fit ' + EQ.lbls[k].w + 'px in ' + L); }));
        if (hit(rulerBox, grow(sq(EQ.slots[0], EQ.y, EQ.slot), 4))) fail('ruler: the sentence overlaps the ruler');
        const tray = [0, 1, 2, 3].map(k => sq((W - 3 * RC.step) / 2 + k * RC.step, RC.y, RC.size));
        tray.forEach((o, k) => inside(o, 'ruler: card ' + k, W, D.RULER_H)); noHits(tray, 'ruler: cards');
        tray.forEach(o => { if (hit(o, grow(sq(EQ.slots[0], EQ.y, 300, EQ.slot), 4 + 4))) fail('ruler: the card tray reaches the sentence boxes'); });
        need('ruler', /var L0 = pick\(GAME_RULER\), c = Math\.floor\(L0 \/ 10\), m = L0 % 10, t = L0,/, 'the reading is not worked out from L0 = c cm m mm');
        need('ruler', /rz\.innerHTML = rulerBoardSVG\(L0\);/, 'the ruler is not drawn by rulerBoardSVG(L0)');
        need('ruler', /var want = \[c, m, t\], kinds = \['c', 'm', 't'\];/, 'the boxes should want c, m, t in that order');
        need('ruler', /renderTray\(B, \[c, m, t, c \+ m\], RULER_CARD\.y,/, 'the ruler cards should be c, m, the total and the c + m mistake');
        need('ruler', /var s = nearestOpen\(slots, pt, 4\);/, 'a card is not dropped into the nearest box');
        need('ruler', /\n {8}if \(v !== s\.want\)\{\n/, 'a wrong card is accepted in a box');
        need('ruler', /if \(s\.kind === 'c'\) roundMiss\(d\.gRulerCm\(c, v\)\);\s*else if \(s\.kind === 'm'\) roundMiss\(d\.gRulerMm\(c, m, v\)\);\s*else roundMiss\(d\.gRulerTot\(c, m, t, v\)\);/, 'a wrong card has no reason of its own');
        need('ruler', /if \(filled === 3\)\{/, 'the round is not solved exactly when all three boxes are filled');
      }

      /* --- 第 3 關：接 0（範例 3：×10、×100、×1000） --- */
      {
        const MINE = [['km', 'm', 1000], ['m', 'cm', 100], ['cm', 'mm', 10]];
        const zeroFs = +((src.match(/\.gzcell\{[^}]*?font-size:(\d+)px/) || [])[1] || 0);
        if (!(zeroFs >= 20)) fail('zero: cannot read the .gzcell font-size from the CSS (got ' + zeroFs + ')');
        if (/\.gzcell\{[^}]*letter-spacing/.test(src)) fail('zero: .gzcell has letter-spacing — the width estimate does not cover it');
        if (JSON.stringify(D.ZERO_STEPS.map(s => [s.from, s.to, s.f])) !== JSON.stringify(MINE)) fail('ZERO_STEPS should be ' + JSON.stringify(MINE) + ', got ' + JSON.stringify(D.ZERO_STEPS));
        D.ZERO_STEPS.forEach(s => {
          if (MM[s.from] / MM[s.to] !== s.f) fail('ZERO_STEPS: 1 ' + s.from + ' is ' + MM[s.from] / MM[s.to] + ' ' + s.to + ', not ' + s.f);
          const z = Math.round(Math.log10(s.f));
          if (D.zeroNeed(s.f) !== z) fail('zeroNeed(' + s.f + ') is ' + D.zeroNeed(s.f) + ', should be ' + z);
        });
        if (!(D.ZERO_MAX > 3 && D.ZERO_MAX <= 5)) fail('ZERO_MAX should be 4~5 (one more than the most a row needs, so "too many" is possible and the count is not given away), got ' + D.ZERO_MAX);
        Object.keys(D.GAME_ZERO).forEach(from => {
          const st = D.ZERO_STEPS.filter(s => s.from === from)[0];
          if (!st) return fail('GAME_ZERO.' + from + ' has no step');
          if (D.GAME_ZERO[from].length < 3) fail('GAME_ZERO.' + from + ' should have at least 3 numbers');
          D.GAME_ZERO[from].forEach(a => {
            const w = 'GAME_ZERO.' + from + ' ' + a;
            if (!isInt(a) || a < 2) return fail(w + ': should be a whole number ≥ 2');
            if (a * st.f > 10000) fail(w + ': ' + a + ' × ' + st.f + ' = ' + a * st.f + ' is above 10000 (grade 3 range)');
            const need0 = Math.round(Math.log10(st.f));
            if (+(String(a) + '0'.repeat(need0)) !== a * st.f) fail(w + ': sticking ' + need0 + ' zeros on ' + a + ' is not ' + a * st.f);
            if ((String(a).length + D.ZERO_MAX) * zeroFs * 0.6 + 12 + 6 > D.ZERO_ROW.cell.w) fail(w + ': ' + a + ' with ' + D.ZERO_MAX + ' zeros does not fit the ' + D.ZERO_ROW.cell.w + ' wide box');
            LANGS.forEach(L => {
              const d = I18N[L], f = st.f;
              for (let z = 1; z <= D.ZERO_MAX; z++){
                if (z === need0) continue;
                const got = a * Math.pow(10, z);
                seq(w + ' ' + L + ' gZeroFix ' + z + ' zeros', d.gZeroFix(a, from, st.to, got, f), [a, got, 1, f, a, f, a * f, need0].concat(L === 'zh' ? [0] : []), 1);
              }
              seq(w + ' ' + L + ' gZero2', d.gZero2(a, from, st.to, f), [a, f, need0].concat(L === 'zh' ? [0] : []));
              seq(w + ' ' + L + ' gZeroRow', d.gZeroRow(a, from), [a]);
              const row = d.gZeroRow(a, from);
              if (row.indexOf(L === 'zh' ? ZH[from] : ' ' + from) < 0) fail(w + ' gZeroRow ' + L + ' does not name ' + from);
              if (textW(row, 18) > D.ZERO_ROW.lbl.w) fail(w + ' gZeroRow ' + L + ': "' + row + '" does not fit ' + D.ZERO_ROW.lbl.w + 'px');
            });
          });
        });
        LANGS.forEach(L => {
          const lad = I18N[L].gZeroLadder;
          const units = (lad.match(/公里|公尺|公分|毫米|km|mm|cm|\bm\b/g) || []).map(u => UNAME[u]), fs = (lad.match(/×\s?(\d+)/g) || []).map(x => +x.replace(/\D/g, ''));
          if (units.join() !== 'km,m,cm,mm' || fs.join() !== '1000,100,10') fail('gZeroLadder ' + L + ': the ladder should read km ×1000 m ×100 cm ×10 mm — ' + lad);
          if (textW(lad, cssFs('.glbl.gladder', 'zero')) > W - 8) fail('gZeroLadder ' + L + ' does not fit the board');
          seq('gZeroNow ' + L, I18N[L].gZeroNow(2), [2, 3]);
          seq('gZeroDone ' + L, I18N[L].gZeroDone, L === 'zh' ? [10, 1, 0, 100, 2, 0, 1000, 3, 0] : [10, 0, 100, 1000]);
          if (typeof I18N[L].gZeroEmpty !== 'string' || nums(I18N[L].gZeroEmpty).some(n => n !== 0)) fail('gZeroEmpty ' + L + ' should be a reminder without numbers');
        });
        /* 版面 */
        const Z = D.ZERO_ROW, rowsY = [0, 1, 2].map(i => Z.y0 + i * Z.step);
        const all = [];
        rowsY.forEach((y, i) => {
          const parts = [{ x:Z.lbl.x, y:y - 22, w:Z.lbl.w, h:44 }, sq(Z.cell.cx, y, Z.cell.w, Z.cell.h), { x:Z.unit.x, y:y - 22, w:Z.unit.w, h:44 }, sq(Z.undo.cx, y, Z.undo.size)];
          parts.forEach((o, k) => inside(o, 'zero: row ' + i + ' part ' + k, W, D.ZERO_H));
          noHits(parts, 'zero: row ' + i + ' parts');
          all.push(grow(sq(Z.cell.cx, y, Z.cell.w, Z.cell.h), 6));
        });
        noHits(all, 'zero: rows (with their drop pads)');
        if (hit({ x:0, y:D.ZERO_LAD.y, w:W, h:D.ZERO_LAD.h }, all[0])) fail('zero: the ladder overlaps the first row');
        const card = sq(D.ZERO_CARD.x, D.ZERO_CARD.y, D.ZERO_CARD.size);
        inside(card, 'zero: the 0 card', W, D.ZERO_H);
        all.forEach((o, i) => { if (hit(card, grow(o, 4))) fail('zero: the 0 card reaches row ' + i); });
        need('zero', /var steps = shuffle\(ZERO_STEPS\), Z = ZERO_ROW, rows = \[\];/, 'the zero rows are not shuffled (the row position would give away the count)');
        need('zero', /var a = pick\(GAME_ZERO\[st\.from\]\), y = Z\.y0 \+ i \* Z\.step;/, 'a row does not take its number from GAME_ZERO');
        need('zero', /need:zeroNeed\(st\.f\)/, 'a row does not need zeroNeed(f) zeros');
        need('zero', /if \(open\.some\(function\(r\)\{ return r\.z === 0; \}\)\)\{ gMsg\.textContent = d\.gZeroEmpty; return; \}/, 'an empty row is counted as a mistake (it should only be a reminder)');
        need('zero', /var wrong = open\.filter\(function\(r\)\{ return r\.z !== r\.need; \}\);/, 'a wrong number of zeros is accepted');
        need('zero', /roundMiss\(d\.gZeroFix\(w\.a, w\.st\.from, w\.st\.to, \+\(String\(w\.a\) \+ new Array\(w\.z \+ 1\)\.join\('0'\)\), w\.st\.f\)\);/, 'the reason does not show what the row reads now');
        need('zero', /if \(!r \|\| r\.z >= ZERO_MAX\) return false;/, 'a row takes more than ZERO_MAX zeros');
        need('zero', /r\.z--; r\.el\.classList\.remove\('bad'\); show\(r\); refreshHint\(\);/, 'the ⌫ button does more than take one 0 off');
        if (/roundMiss/.test((B.zero.match(/u\.addEventListener\('click', function\(\)\{[\s\S]*?\}\);/) || [''])[0])) fail('zero: the ⌫ button counts as a mistake');
        need('zero', /zero\.lock\(zero\.homeX, zero\.homeY\);\s*done\.disabled = true;\s*roundSolved\(d\.gZeroDone\);/, 'the round is not solved when every row is right');
      }

      /* --- 第 4 關：拼長度（範例 4 的「合起來」）—— 照遊戲的規則從頭玩一遍 --- */
      {
        if (D.BUILD_VALS.join() !== '100,10,1') fail('BUILD_VALS should be 100,10,1 (1 m = 100 cm), got ' + D.BUILD_VALS.join());
        const LN = D.BUILD_LANE, TR = D.BUILD_TRAY, A = D.BUILD_AREA;
        let noTen = false, noOne = false, both = false;
        D.GAME_BUILD.forEach((T, i) => {
          const w = 'GAME_BUILD[' + i + '] ' + T;
          if (!isInt(T) || T < 101 || T > 399) return fail(w + ': should be 101~399 (the meter lane holds 3)');
          const M = Math.floor(T / 100), Tn = Math.floor(T % 100 / 10), O = T % 10;
          if (T % 100 === 0) fail(w + ': whole metres only — nothing to regroup');
          if (Tn === 0 && O > 0) noTen = true; if (O === 0 && Tn > 0) noOne = true; if (Tn > 0 && O > 0) both = true;
          /* 遊戲的規則：v 放得下、而且沒有比它大、也放得下的那一種，才收 */
          let total = 0;
          const cnt = [0, 0, 0];
          for (let step = 0; step < 40 && total < T; step++){
            const left = T - total;
            const ok = [0, 1, 2].filter(k => D.BUILD_VALS[k] <= left && ![0, 1, 2].some(b => b < k && D.BUILD_VALS[b] <= left));
            if (ok.length !== 1){ fail(w + ': at ' + total + ' cm, ' + ok.length + ' kinds of piece are accepted (should be exactly one)'); break; }
            LANGS.forEach(L => {
              const d = I18N[L];
              [0, 1, 2].forEach(k => {
                const v = D.BUILD_VALS[k];
                if (v > left){
                  seq(w + ' ' + L + ' gBuildOver ' + k + ' at ' + total, d.gBuildOver(T, total, k), nums(d.gBuildNames[k]).concat([total, v, total + v, T]));
                  if (!(total + v > T)) fail(w + ': gBuildOver says too long but ' + (total + v) + ' ≤ ' + T);
                } else if (k !== ok[0]){
                  const b = [0, 1, 2].filter(x => x < k && D.BUILD_VALS[x] <= left)[0];
                  const txt = d.gBuildBig(T, total, b);
                  seq(w + ' ' + L + ' gBuildBig ' + b + ' at ' + total, txt, [T, total, left].concat(nums(['', '10'][b] ? d.gBuildNames[1] : '')).concat(b === 0 ? [100] : []));
                }
              });
              seq(w + ' ' + L + ' gBuild2 at ' + total, d.gBuild2(T, total, ok[0]), [left].concat(nums(d.gBuildNames[ok[0]])));
              seq(w + ' ' + L + ' gBuildNow', d.gBuildNow(T, total), [T, total]);
            });
            cnt[ok[0]]++; total += D.BUILD_VALS[ok[0]];
          }
          if (total !== T) fail(w + ': the building never reaches ' + T + ' (stops at ' + total + ')');
          if (cnt[0] !== M || cnt[1] !== Tn || cnt[2] !== O) fail(w + ': built ' + cnt.join('/') + ', should be ' + M + '/' + Tn + '/' + O + ' (T ÷ 100 and the rest)');
          if (cnt[0] > 3 || cnt[1] > 9 || cnt[2] > 9) fail(w + ': a lane gets more pieces than it holds');
          LANGS.forEach(L => {
            const S = T - M * 100;
            seq(w + ' ' + L + ' gBuildDone', I18N[L].gBuildDone(T, M, S), S ? [T, M, S, M, 100, S, T] : [T, M, M, 100, T]);
          });
        });
        if (!noTen) fail('GAME_BUILD: no entry with no 10 cm stick (like 305 = 3 m 5 cm — the 405 ≠ 450 trap)');
        if (!noOne) fail('GAME_BUILD: no entry with no 1 cm cube (like 270)');
        if (!both) fail('GAME_BUILD: no entry with both tens and ones');
        LANGS.forEach(L => {
          const d = I18N[L];
          if (!Array.isArray(d.gBuildNames) || d.gBuildNames.length !== 3 || !Array.isArray(d.gBuildTok) || d.gBuildTok.length !== 3 || !Array.isArray(d.gBuildLanes) || d.gBuildLanes.length !== 3) return fail('gBuildNames / gBuildTok / gBuildLanes ' + L + ' should be 3 each');
          [[100], [10], [1]].forEach((v, k) => { const tn = nums(d.gBuildTok[k].replace(/<[^>]+>/g, ' ')); if (Math.max(...tn) !== v[0]) fail('gBuildTok ' + L + ' piece ' + k + ' does not say ' + v[0] + ' cm: ' + d.gBuildTok[k]); });
          if (scanLengths(d.gBuildTok[0].replace(/<[^>]+>/g, ' ')).filter(e => !e.bad).length !== 1) fail('gBuildTok ' + L + ': the meter stick should say 1 m = 100 cm');
          d.gBuildLanes.forEach((t, k) => { if (textW(t, cssFs('.glbl.glane', 'build')) > LN.lblW) fail('build: lane label "' + t + '" does not fit ' + LN.lblW + 'px in ' + L); });
        });
        /* 版面：每一條跑道放滿（3／9／9）也不出界、不碰標籤、互不重疊；托盤三塊在跑道區外面 */
        const area = { x:A.x, y:A.y, w:A.w, h:A.h };
        inside(area, 'build: the build area', W, D.BUILD_H);
        const capN = [3, 9, 9], allChips = [];
        [0, 1, 2].forEach(k => {
          const lbl = { x:LN.lblX, y:LN.y[k] - 17, w:LN.lblW, h:34 };
          const chips = [];
          for (let j = 0; j < capN[k]; j++){
            const x = LN.x0[k] + j * LN.step[k];
            if (!near(D.buildChipX(k, j), x)) fail('buildChipX(' + k + ', ' + j + ') should be ' + x);
            chips.push(sq(x, LN.y[k], LN.w[k], LN.h[k]));
          }
          chips.forEach((o, j) => { if (!(o.x >= area.x && o.x + o.w <= area.x + area.w && o.y >= area.y && o.y + o.h <= area.y + area.h)) fail('build: lane ' + k + ' piece ' + j + ' sticks out of the build area'); if (hit(o, lbl)) fail('build: lane ' + k + ' piece ' + j + ' covers the lane label'); });
          noHits(chips, 'build: lane ' + k + ' pieces');
          allChips.push(...chips);
        });
        noHits(allChips, 'build: lane pieces');
        const tray = [0, 1, 2].map(k => sq(TR.x[k], TR.y, TR.w[k], TR.h));
        tray.forEach((o, k) => inside(o, 'build: tray piece ' + k, W, D.BUILD_H)); noHits(tray, 'build: tray pieces');
        tray.forEach((o, k) => { if (hit(o, grow(area, 4))) fail('build: the tray reaches the build area (piece ' + k + ')'); });
        LANGS.forEach(L => { if (textW(I18N[L].gBuildTok[0].replace(/<[^>]+>/g, ' '), 14) > TR.w[0] * 2 - 12) fail('build: the meter stick text does not fit in ' + L); });
        need('build', /var T = pick\(GAME_BUILD\), total = 0,/, 'T does not come from GAME_BUILD');
        need('build', /if \(!nearestOpen\(\[zone\], pt, 4\)\) return false;/, 'a drop outside the build area is not a silent bounce');
        need('build', /if \(v > left\)\{ roundMiss\(d\.gBuildOver\(T, total, k\)\); return false; \}/, 'a piece that goes over is accepted');
        need('build', /for \(var b = 0; b < k; b\+\+\) if \(BUILD_VALS\[b\] <= left\)\{ roundMiss\(d\.gBuildBig\(T, total, b\)\); return false; \}/, 'a smaller piece is accepted while a bigger one fits');
        need('build', /addZone\(B, buildChipX\(k, cnt\[k\]\) - LN\.w\[k\] \/ 2, LN\.y\[k\] - LN\.h\[k\] \/ 2,/, 'a placed piece is not drawn in its lane at buildChipX()');
        need('build', /\n {8}if \(total === T\)\{\n {10}pieces\.forEach/, 'the round is not solved exactly when the length is reached');
        need('build', /roundSolved\(d\.gBuildDone\(T, cnt\[0\], T - cnt\[0\] \* 100\)\);/, 'the result does not use the meter sticks actually placed');
      }

      /* --- 第 5 關：排長短（範例 5 的比較） --- */
      {
        const mineVal = (s, base) => s.u === base ? s.big : s.big * (MM[s.u] / MM[base]) + (s.small || 0);
        const RS = D.RANK_SLOT, RC = D.RANK_CARD;
        const rankFs = +((src.match(/\.grcard\{[^}]*?font-size:(\d+)px/) || [])[1] || 0), rkFs = +((src.match(/\.glbl\.grk\{[^}]*?font-size:(\d+)px/) || [])[1] || 0);
        if (!(rankFs >= 14) || !(rkFs >= 13)) fail('rank: cannot read the .grcard / .glbl.grk font-size from the CSS');
        D.GAME_RANK.forEach((S, i) => {
          const w = 'GAME_RANK[' + i + ']';
          if (!(S.base === 'cm' || S.base === 'm')) return fail(w + ': base should be cm or m');
          if (!Array.isArray(S.items) || S.items.length !== 4) return fail(w + ': should have 4 lengths');
          const vals = S.items.map(s => mineVal(s, S.base));
          S.items.forEach((s, k) => {
            if (s.u !== S.base && NEXT_DOWN[s.u] !== S.base) fail(w + ' item ' + k + ': unit ' + s.u + ' does not convert to ' + S.base + ' in one step');
            if (s.small !== undefined && (s.u === S.base || !(s.small >= 1 && s.small < MM[s.u] / MM[S.base]))) fail(w + ' item ' + k + ': the small part ' + s.small + ' is not a proper ' + S.base + ' part');
            if (D.lenIn(s, S.base) !== vals[k]) fail(w + ' item ' + k + ': lenIn() is ' + D.lenIn(s, S.base) + ', should be ' + vals[k]);
            LANGS.forEach(L => {
              const lab = D.lenLabel(s, L), want = s.small ? s.big + ' ' + (L === 'zh' ? ZH[s.u] : s.u) + ' ' + s.small + ' ' + (L === 'zh' ? ZH[S.base] : S.base) : s.big + ' ' + (L === 'zh' ? ZH[s.u] : s.u);
              if (lab !== want) fail(w + ' item ' + k + ': lenLabel() ' + L + ' is "' + lab + '", should be "' + want + '"');
              if (textW(lab, rankFs) > RC.w - 12) fail(w + ' item ' + k + ': "' + lab + '" does not fit the ' + RC.w + ' wide card in ' + L);
            });
          });
          if (new Set(vals).size !== 4) fail(w + ': two lengths are equal (' + vals.join() + ')');
          if (S.items.every(s => s.u === S.items[0].u)) fail(w + ': all in one unit — nothing to unify');
          if (!S.items.some(s => s.u === S.base) || !S.items.some(s => s.u !== S.base)) fail(w + ': should mix the base unit and the bigger unit');
          /* 陷阱：小單位那一段位數不夠（4 公尺 5 公分）；看錯成 450 的那張真的存在，而且看錯會把順序弄錯 */
          const f = s => MM[s.u] / MM[S.base];
          const traps = S.items.filter(s => s.small !== undefined && String(s.small).length < String(f(s)).length - 1);
          if (!traps.length) fail(w + ': no short small-unit trap (like 4 m 5 cm = 405, not 450)');
          traps.forEach(s => {
            const misread = s.big * f(s) + s.small * Math.pow(10, String(f(s)).length - 1 - String(s.small).length);
            if (vals.indexOf(misread) < 0) fail(w + ': nobody would be fooled — misreading ' + JSON.stringify(s) + ' as ' + misread + ' needs a card that is ' + misread);
            const rankOf = (arr, v) => arr.filter(x => x < v).length;
            const vv = vals.map(x => x === mineVal(s, S.base) ? misread + 0.5 : x);
            if (rankOf(vals, mineVal(s, S.base)) === rankOf(vv, misread + 0.5)) fail(w + ': misreading ' + JSON.stringify(s) + ' does not change its place — the trap teaches nothing');
          });
          const sorted = vals.slice().sort((a, b) => a - b);
          LANGS.forEach(L => {
            const d = I18N[L];
            S.items.forEach((s, k) => {
              const v = vals[k], shorter = vals.filter(x => x < v).length, lab = D.lenLabel(s, L), isBase = s.u === S.base;
              for (let r = 0; r < 4; r++){
                if (r === shorter) continue;
                seq(w + ' ' + L + ' gRankWrong item ' + k + ' into ' + r, d.gRankWrong(lab, isBase, v, S.base, shorter, r), nums(lab).concat(isBase ? [] : [v], [shorter, shorter + 1, r + 1]));
              }
            });
            sorted.forEach((v, r) => seq(w + ' ' + L + ' gRank2 ' + r, d.gRank2(r, v, S.base), [r + 1, v]));
            seq(w + ' ' + L + ' gRankDone', d.gRankDone(sorted, S.base), sorted);
            if (d.gRankDone(sorted, S.base).indexOf(L === 'zh' ? ZH[S.base] : S.base) < 0) fail(w + ' gRankDone ' + L + ' does not name the unit');
          });
        });
        LANGS.forEach(L => { seq('gRankNow ' + L, I18N[L].gRankNow(1), [1, 4]); if (!Array.isArray(I18N[L].gRankLbl) || I18N[L].gRankLbl.length !== 4 || I18N[L].gRankLbl.some((t, r) => nums(t)[0] !== r + 1)) fail('gRankLbl ' + L + ' should be 1..4'); I18N[L].gRankLbl.forEach(t => { if (textW(t, rkFs) > D.RANK_LBL.w) fail('rank: the label "' + t + '" does not fit ' + D.RANK_LBL.w + 'px in ' + L); }); });
        const slots = [0, 1, 2, 3].map(r => sq(RS.cx, RS.y0 + r * RS.step, RS.w, RS.h));
        slots.forEach((o, r) => inside(o, 'rank: slot ' + r, W, D.RANK_H));
        noHits(slots.map(o => grow(o, 4)), 'rank: slots (with their drop pads)');
        slots.forEach((o, r) => { if (hit(o, { x:D.RANK_LBL.x, y:RS.y0 + r * RS.step - 20, w:D.RANK_LBL.w, h:40 })) fail('rank: the label covers slot ' + r); });
        if (RC.w > RS.w - 4) fail('rank: a card is wider than its slot');
        const cards = [0, 1, 2, 3].map(c => { const p = D.rankCardXY(c), mine = { x:RC.x[c % 2], y:RC.y0 + Math.floor(c / 2) * RC.step }; if (!near(p.x, mine.x) || !near(p.y, mine.y)) fail('rankCardXY(' + c + ') is off'); return sq(p.x, p.y, RC.w, RC.h); });
        cards.forEach((o, c) => inside(o, 'rank: card ' + c, W, D.RANK_H)); noHits(cards, 'rank: cards');
        cards.forEach((o, c) => slots.forEach(s => { if (hit(o, grow(s, 4 + 8))) fail('rank: the cards reach the slots (card ' + c + ')'); }));
        need('rank', /var S = pick\(GAME_RANK\), base = S\.base,/, 'the set does not come from GAME_RANK');
        need('rank', /var vals = S\.items\.map\(function\(x\)\{ return lenIn\(x, base\); \}\);\s*var sorted = vals\.slice\(\)\.sort\(function\(a, b\)\{ return a - b; \}\);/, 'the order is not worked out by lenIn() in the base unit, numerically');
        need('rank', /return \{ r:r, want:sorted\[r\], el:z,/, 'the slots do not want the r-th shortest');
        need('rank', /var cards = shuffle\(S\.items\)\.map\(function\(x, c\)\{/, 'the rank cards are not shuffled');
        need('rank', /text:t, cls:'gcard grcard', label:t, data:\{ s:x, v:lenIn\(x, base\) \}/, 'a card does not show lenLabel() and carry lenIn()');
        need('rank', /var sl = nearestOpen\(slots, pt, 4\);/, 'a card is not dropped into the nearest slot');
        need('rank', /\n {8}if \(v !== sl\.want\)\{\n/, 'a card is accepted in the wrong place');
        need('rank', /var shorter = vals\.filter\(function\(x\)\{ return x < v; \}\)\.length;/, 'the reason does not count the shorter cards');
        need('rank', /if \(placed === 4\) roundSolved\(d\.gRankDone\(sorted, base\)\);/, 'the round is not solved when all four are in place');
      }
    }
  }
};
module.exports._test = { scanEquations, scanLengths };
