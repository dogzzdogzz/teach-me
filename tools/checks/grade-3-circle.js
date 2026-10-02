/* grade-3/math/circle 的檢查設定（圓規畫圓趣：圓上每一點到圓心一樣遠、圓心／半徑／直徑、直徑 ＝ 半徑 × 2、
   圓規張開的是半徑、同心圓）。2026-10-01 新增 —— 和小遊戲「圓規挑戰」改成五關五種玩法（§六之五）同一次寫成。
   在這之前這一課沒有設定檔：verify_lesson_data／simgen／breaktest 一跑就是「no check config」。

   sim（review.html 的十一個產生器）：每個產生器一組不變條件、正解的第二套實作（只用 make() 的原始參數重算，
   文字選項自己拼）。renderCheck 從畫出來的 SVG 量回來：whichIsDiameter 的「直徑」那一條真的經過圓心、兩端在圓上，
   另一條真的沒經過圓心（而且看得出來）；equalRadii 兩條真的一樣長、都從圓心到圓周；rFindD／dFindR 標的數字就是題幹的數字。
   刻意的迷思誘答（把題幹的數字當答案）白名單只放行那一個值，見 stemEchoOk。
   跑起來抓到兩個舊缺陷：perimeterRect 會出「長方形長 4、寬 4」（那是正方形）；divideEqualShare 的誘答是題幹的總數。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡的算式逐條重算（自己的掃描器：a op b ＝ c ＝ d 的整條鏈，
     「直徑 ÷ 2 ＝ 10 ÷ 2 ＝ 5」這種前面接著文字的，從第一個數字開始算）。掃描器先跑正反例。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關用自己的幾何重算（點到圓心幾公分、卡片上那條線是半徑／直徑／都不是、棍子接起來多長、圓規張開多少、
     卡片的直徑對到哪一圈），並且照遊戲的規則把每一題從頭玩一次，證明解得完、而且只有對的做法收得進去；
     nearestOpen()、nearestRing()、roundMiss() 從原始碼切出來實際執行；RENDER 裡切不出來的關鍵規則用原始碼形狀守住（need()）。
     每一句說明逐個比數字（每一題、每一種放錯）。版面數字一律從 index.html 讀（棍子的條在哪裡也從 CSS 讀）。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸、字有沒有超出框由 teaching-workspace/game-harness/g3-circle 的
   端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
const hyp = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

/* 算式掃描：一整條「式 ＝ 式 ＝ 式」的鏈，每一段都要算出同一個數。式裡只有整數與 × ÷ ＋ −，× ÷ 先算。
   鏈前面緊接著運算符號（「直徑 ÷ 2 ＝ …」的「÷ 2」）的那一段不算 —— 從下一個完整的式開始。 */
function evalExpr(e){
  const toks = e.split(/ ?([×+\-÷]) ?/);
  const terms = []; let cur = +toks[0], sign = 1, bad = false;
  for (let i = 1; i < toks.length; i += 2){
    const op = toks[i], v = +toks[i + 1];
    if (op === '×') cur *= v;
    else if (op === '÷'){ if (v === 0 || cur % v !== 0) bad = true; cur = cur / v; }
    else { terms.push(sign * cur); sign = op === '+' ? 1 : -1; cur = v; }
  }
  terms.push(sign * cur);
  return bad ? NaN : terms.reduce((x, y) => x + y, 0);
}
/* 文字寫的公式（「直徑 ＝ 半徑 × 2」「半徑 ＝ 直徑 ÷ 2」）：數字掃描器從第一個數字才開始算，這一段它看不到，
   所以另外守 —— 直徑一定是半徑 × 2、半徑一定是直徑 ÷ 2，寫反了就是教錯。 */
function scanIdentities(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/\s+/g, ' ');
  const out = [];
  /* 兩種順序都認：「直徑 ＝ 半徑 × 2」與「直徑 ＝ 2 × 半徑」。⚠️ 已知極限：把錯的公式「引用出來說它錯」也會被判錯 ——
     這一課目前沒有那種句子；出現時要另外放行，不要放寬這條 regex。 */
  const W = '(直徑|半徑|[Dd]iameter|[Rr]adius)';
  const re = new RegExp(W + ' ?= ?(?:' + W + ' ?([×÷]) ?2(?!\\d)|2 ?([×÷]) ?' + W + ')', 'g');
  let m;
  while ((m = re.exec(t))){
    const word = m[2] || m[5], op = m[3] || m[4];
    const lhs = /直徑|iameter/.test(m[1]) ? 'd' : 'r', rhs = /直徑|iameter/.test(word) ? 'd' : 'r';
    const ok = (lhs === 'd' && rhs === 'r' && op === '×' && m[2] !== undefined) || (lhs === 'd' && rhs === 'r' && op === '×' && m[5] !== undefined) || (lhs === 'r' && rhs === 'd' && op === '÷' && m[2] !== undefined);
    out.push({ text:m[0], bad:ok ? null : 'the circle rule is diameter = radius × 2 / radius = diameter ÷ 2' });
  }
  return out;
}
function scanEquations(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–]/g, '-').replace(/\s+/g, ' ');
  const E = '\\d+(?: ?[×+\\-÷] ?\\d+)*';
  const re = new RegExp('(?<![\\d.])(?<![×+\\-÷] ?)(' + E + ')((?: ?= ?' + E + ')+)(?! ?[×+\\-÷\\d.])', 'g');
  const out = [];
  /* 這一課只有整公分：算式旁邊出現小數，掃描器會整條讀不到 —— 一律判失敗，不靜靜跳過 */
  const dec = t.match(/(?:\d*\.\d+|\d+\.(?![\d\s]|$)) ?[=×+\-÷]|[=×+\-÷] ?(?:\d*\.\d+|\d+\.\d)/);
  if (dec) out.push({ text:dec[0], bad:'a decimal in an equation (this lesson is whole centimetres only)' });
  scanIdentities(t).forEach(x => out.push(x));
  let m;
  while ((m = re.exec(t))){
    const parts = [m[1]].concat(m[2].split(/ ?= ?/).filter(Boolean));
    const vals = parts.map(evalExpr);
    const bad = vals.some(v => !(v === vals[0]) || !isFinite(v)) ? 'parts are ' + vals.join(' / ') : null;
    out.push({ text:m[0], bad });
  }
  return out;
}

/* 自己的幾何：卡片上的線是半徑、直徑、還是都不是（只看座標，不看 kind） */
function classifySeg(s, c, R){
  const p = { x:s.x1, y:s.y1 }, q = { x:s.x2, y:s.y2 };
  const on = z => Math.abs(hyp(z, c) - R) < 0.01, at = z => hyp(z, c) < 0.01;
  const vx = q.x - p.x, vy = q.y - p.y, t = Math.max(0, Math.min(1, ((c.x - p.x) * vx + (c.y - p.y) * vy) / (vx * vx + vy * vy)));
  const segC = hyp(c, { x:p.x + t * vx, y:p.y + t * vy });
  if ((at(p) && on(q)) || (at(q) && on(p))) return { bin:'r' };
  if (on(p) && on(q) && segC < 0.01) return { bin:'d' };
  /* 「都不是」要**看得出來**：有一端離圓周至少 6px，或者兩端都在圓上而線離圓心至少 8px */
  const off = Math.max(Math.abs(hyp(p, c) - R), Math.abs(hyp(q, c) - R));
  const clear = (on(p) && on(q)) ? segC >= 8 : off >= 6;
  return { bin:'n', clear, segC, off };
}

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 共用 ---- */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ var p = xy(i); mk(it, p.x, p.y); });",
      replace:"    items.forEach(function(it, i){ var p = xy(i); mk(it, p.x, p.y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['points', 'sort', 'join', 'compass', 'target'];", replace:"var GAME_ORDER = ['points', 'join', 'sort', 'compass', 'target'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48, GW = 300,', replace:'  var GPICK = 40, GW = 300,' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot',
      find:"    return best && !best.done ? best : null;\n  }\n  /* 同心圓",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 同心圓" },
    { file:'index', expect:'nearestRing(', find:"      if (gap <= band && gap < bd){ bd = gap; best = g; }", replace:"      if (gap <= band && !best){ bd = gap; best = g; }" },
    { file:'index', expect:'nearestRing(', find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤", replace:"    if (best && best.done) best = rings.filter(function(g){ return !g.done && Math.abs(dist - g.rp) <= band; })[0] || null;\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'hint 2 does not blink', find:"    if (hintLevel >= 2 && gCtx.blink) gCtx.blink();", replace:"" },

    /* 第 1 關：找點 */
    { file:'index', expect:'only 3 points on the circle', find:"    { r:5, on:[15, 75, 135, 195, 255, 315], inn:[45, 225],", replace:"    { r:5, on:[15, 135, 255], inn:[45, 225]," },
    { file:'index', expect:'tap targets', find:"{ r:5, on:[0, 60, 120, 180, 240, 300], inn:[90, 270], out:[30, 210], str:150 },", replace:"{ r:5, on:[0, 60, 120, 180, 240, 300], inn:[90, 270], out:[20, 210], str:150 }," },
    { file:'index', expect:'no point inside', find:"{ r:4, on:[0, 90, 180, 270], inn:[135, 315], out:[45, 225], str:112 }", replace:"{ r:4, on:[0, 90, 180, 270], inn:[], out:[45, 135, 225, 315], str:112 }" },
    { file:'index', expect:'the string starts on a point', find:"inn:[0, 180], out:[90, 270], str:22 },", replace:"inn:[0, 180], out:[90, 270], str:45 }," },
    { file:'index', expect:'ptXY(', find:"return { x:PT_O.x + rc * PT_PX * Math.cos(rad), y:PT_O.y - rc * PT_PX * Math.sin(rad) };", replace:"return { x:PT_O.x + rc * PT_PX * Math.cos(rad), y:PT_O.y + rc * PT_PX * Math.sin(rad) };" },
    { file:'index', expect:'1 cm apart on the board', find:"PT_PX = 20, PT_TAP = 46,", replace:"PT_PX = 12, PT_TAP = 46," },
    { file:'index', expect:'outside the', find:"var PT_H = 330, PT_O = { x:150, y:180 },", replace:"var PT_H = 300, PT_O = { x:150, y:180 }," },
    { file:'index', expect:'covers the string label', find:"PT_LBL = { x:8, y:6, w:120, h:28 };", replace:"PT_LBL = { x:8, y:6, w:150, h:40 };" },
    { file:'index', expect:'an off-circle point is accepted', find:"[['on', 0], ['inn', -1], ['out', 1]]", replace:"[['on', 0], ['inn', 0], ['out', 1]]" },
    { file:'index', expect:'inside or outside', find:"roundMiss(p.rc < e.r ? d.gPtIn(p.rc, e.r) : d.gPtOut(p.rc, e.r));", replace:"roundMiss(p.rc > e.r ? d.gPtIn(p.rc, e.r) : d.gPtOut(p.rc, e.r));" },
    { file:'index', expect:'a marked point costs again', find:"          if (p.bad) return;   /*", replace:"          if (p.bad && false) return;   /*" },
    { file:'index', expect:'gPtIn zh', find:"return '這個點離圓心 ' + c + ' 公分，比繩子（' + r + ' 公分）短", replace:"return '這個點離圓心 ' + r + ' 公分，比繩子（' + r + ' 公分）短" },
    { file:'index', expect:'gPtOut en', find:"'This point is ' + c + ' cm from the center — longer than", replace:"'This point is ' + (c + 1) + ' cm from the center — longer than" },
    { file:'index', expect:'gPtDone zh', find:"return '這 ' + n + ' 個點到圓心都是 ' + r + ' 公分", replace:"return '這 ' + n + ' 個點到圓心都是 ' + (r * 2) + ' 公分" },

    /* 第 2 關：分一分 */
    { file:'index', expect:'is drawn as', find:"    if (kind === 'rad'){ p = at(0, a); q = at(R, a); }", replace:"    if (kind === 'rad'){ p = at(0, a); q = at(R * 0.9, a); }" },
    { file:'index', expect:'is drawn as', find:"    else if (kind === 'dia'){ p = at(R, a + 180); q = at(R, a); }", replace:"    else if (kind === 'dia'){ p = at(R, a + 170); q = at(R, a); }" },
    { file:'index', expect:'not visibly', find:"SORT_GAP = [80, 100], SORT_SHORT = 0.55;", replace:"SORT_GAP = [80, 100], SORT_SHORT = 0.9;" },
    { file:'index', expect:'not visibly', find:"SORT_GAP = [80, 100],", replace:"SORT_GAP = [80, 170]," },
    { file:'index', expect:'should go in', find:"var SORT_BIN_OF = { rad:'r', dia:'d', chord:'n', half:'n', thru:'n' };", replace:"var SORT_BIN_OF = { rad:'r', dia:'d', chord:'n', half:'r', thru:'n' };" },
    { file:'index', expect:'boxes 0 and 1 overlap', find:"SORT_BIN = { y:6, w:92, h:168, gap:12,", replace:"SORT_BIN = { y:6, w:92, h:168, gap:-4," },
    { file:'index', expect:'sticks out of its box', find:"SORT_BIN = { y:6, w:92, h:168, gap:12, top:28, step:70 }", replace:"SORT_BIN = { y:6, w:92, h:150, gap:12, top:28, step:70 }" },
    { file:'index', expect:'tray reaches the boxes', find:"SORT_TRAY = { y:220, dx:84, dy:76 };", replace:"SORT_TRAY = { y:196, dx:84, dy:76 };" },
    { file:'index', expect:'sort: tray cards', find:"SORT_TRAY = { y:220, dx:84, dy:76 };", replace:"SORT_TRAY = { y:220, dx:60, dy:76 };" },
    { file:'index', expect:'two radius, two diameter', find:"var kinds = ['rad', 'rad', 'dia', 'dia'].concat(shuffle(SORT_NONE).slice(0, 2))", replace:"var kinds = ['rad', 'dia', 'dia', 'dia'].concat(shuffle(SORT_NONE).slice(0, 2))" },
    { file:'index', expect:'a card is accepted in the wrong box', find:"        if (bin.key !== want){ roundMiss(d.gSortNo[P.data.kind][bin.key]); return false; }", replace:"        if (bin.key !== want && bin.key === 'r'){ roundMiss(d.gSortNo[P.data.kind][bin.key]); return false; }" },
    { file:'index', expect:'gSortNo.half.d missing in en', find:"half:{ r:'It starts at the center, but its other end does not reach the circle — a radius goes all the way to the circle.', d:", replace:"half:{ r:'It starts at the center, but its other end does not reach the circle — a radius goes all the way to the circle.', x:" },

    /* 第 3 關：拼直徑 */
    { file:'index', expect:'should be r, r, r − 1, r + 1', find:"function joinSticks(r){ return [r, r, r - 1, r + 1]; }", replace:"function joinSticks(r){ return [r, r, r - 1, r * 2]; }" },
    { file:'index', expect:'a stick of 1 cm', find:"var GAME_JOIN = [3, 4, 5, 6];", replace:"var GAME_JOIN = [2, 4, 5, 6];" },
    { file:'index', expect:'the circle and its label', find:"var GAME_JOIN = [3, 4, 5, 6];", replace:"var GAME_JOIN = [3, 4, 5, 7];" },
    { file:'index', expect:'joinSlots(', find:"    return [ { side:'L', cx:JOIN_O.x - h, cy:JOIN_O.y, hw:h,", replace:"    return [ { side:'L', cx:JOIN_O.x - h - 4, cy:JOIN_O.y, hw:h," },
    { file:'index', expect:'JOIN_BAR_DY', find:"JOIN_STICK_H = 48, JOIN_BAR_DY = 5;", replace:"JOIN_STICK_H = 48, JOIN_BAR_DY = 0;" },
    { file:'index', expect:'join: sticks', find:"var JOIN_TRAY = { y:268, dy:58, x:[80, 220] }", replace:"var JOIN_TRAY = { y:268, dy:58, x:[100, 200] }" },
    { file:'index', expect:'reaches the circle', find:"var JOIN_TRAY = { y:268, dy:58, x:[80, 220] }", replace:"var JOIN_TRAY = { y:226, dy:58, x:[80, 220] }" },
    { file:'index', expect:'narrower than its bar', find:"function joinStickW(L){ return Math.max(GPICK, L * JOIN_PX + 8); }", replace:"function joinStickW(L){ return Math.max(GPICK, L * JOIN_PX - 8); }" },
    { file:'index', expect:'a short stick is accepted', find:"        if (Lc < r){ roundMiss(d.gJoinShort(Lc, r)); return false; }", replace:"        if (Lc < r - 1){ roundMiss(d.gJoinShort(Lc, r)); return false; }" },
    { file:'index', expect:'a long stick is accepted', find:"        if (Lc > r){ roundMiss(d.gJoinLong(Lc, r)); return false; }", replace:"" },
    { file:'index', expect:'gJoinDone zh', find:"return '直徑 ＝ ' + r + ' ＋ ' + r + ' ＝ ' + r + ' × 2 ＝ ' + (r * 2) + ' 公分：", replace:"return '直徑 ＝ ' + r + ' ＋ ' + r + ' ＝ ' + r + ' × 2 ＝ ' + (r * 2 + 1) + ' 公分：" },
    { file:'index', expect:'gJoinShort en', find:"return 'This stick is ' + n + ' cm, shorter than the radius (' + r + ' cm)", replace:"return 'This stick is ' + n + ' cm, longer than the radius (' + r + ' cm)" },

    /* 第 4 關：張圓規 */
    { file:'index', expect:'cannot reach the diameter', find:"CMP_PX = 16, CMP_MAX = 12,", replace:"CMP_PX = 16, CMP_MAX = 8," },
    { file:'index', expect:'is odd', find:"var GAME_COMPASS = [6, 8, 10];", replace:"var GAME_COMPASS = [6, 8, 9];" },
    { file:'index', expect:'the compass starts at the answer', find:"var GAME_COMPASS = [6, 8, 10];", replace:"var GAME_COMPASS = [2, 8, 10];" },
    { file:'index', expect:'runs off the board', find:"var CMP_H = 268, CMP_O = { x:84, y:156 },", replace:"var CMP_H = 268, CMP_O = { x:70, y:156 }," },
    { file:'index', expect:'a tap on the ruler is ignored', find:"CMP_PEN_DY = -26, CMP_TAPY = 50,", replace:"CMP_PEN_DY = -26, CMP_TAPY = 20," },
    { file:'index', expect:'the goal label overlaps', find:"CMP_GOAL = { x:6, y:4, w:210, h:30 };", replace:"CMP_GOAL = { x:6, y:4, w:210, h:110 };" },
    { file:'index', expect:'a wrong opening is accepted', find:"        if (k === r){\n          drawCircle(k, true);", replace:"        if (k === r || k === D){\n          drawCircle(k, true);" },
    { file:'index', expect:'"draw" before moving counts', find:"        if (!moved){ gMsg.textContent = d.gCmpFirst; return; }", replace:"        if (!moved){ roundMiss(d.gCmpFirst); return; }" },
    { file:'index', expect:'does not snap to a whole cm', find:"        var nk = Math.round((pt.x - O.x) / CMP_PX);", replace:"        var nk = (pt.x - O.x) / CMP_PX;" },
    { file:'index', expect:'free to move up and down', find:"label:d.gCmpPen, axis:'x', onPlace:legs });", replace:"label:d.gCmpPen, onPlace:legs });" },
    { file:'index', expect:'should say', find:"(k * 2 > D ? '大' : '小') + '。'; },", replace:"(k * 2 < D ? '大' : '小') + '。'; }," },
    { file:'index', expect:'gCmpIsD en', find:"' cm uses the diameter. A compass opens to the radius — this circle’s diameter is ' + D + ' × 2 = ' + (D * 2)", replace:"' cm uses the diameter. A compass opens to the radius — this circle’s diameter is ' + D + ' × 2 = ' + (D + 2)" },
    { file:'index', expect:'gCmp2 zh', find:"return '提示 2：半徑 ＝ ' + D + ' ÷ 2 ＝ ' + r + ' 公分，把筆尖拖到尺上的 ' + r + '。'; }", replace:"return '提示 2：半徑 ＝ ' + D + ' ÷ 2 ＝ ' + r + ' 公分，把筆尖拖到尺上的 ' + D + '。'; }" },

    /* 第 5 關：疊標靶 */
    { file:'index', expect:'fits a ring', find:"{ rs:[1, 4, 6], decoy:4 },", replace:"{ rs:[1, 4, 6], decoy:8 }," },
    { file:'index', expect:'not a whole number', find:"{ rs:[1, 3, 6], decoy:4 },", replace:"{ rs:[1, 3, 6], decoy:7 }," },
    { file:'index', expect:'closer than 2 cm', find:"{ rs:[1, 3, 6], decoy:4 },", replace:"{ rs:[1, 2, 6], decoy:4 }," },
    { file:'index', expect:'no card whose number is another ring', find:"{ rs:[1, 3, 6], decoy:4 },", replace:"{ rs:[1, 3, 5], decoy:4 }," },
    { file:'index', expect:'past the ruler', find:"TGT_PX = 14, TGT_BAND = 23, TGT_RULER = 7;", replace:"TGT_PX = 14, TGT_BAND = 23, TGT_RULER = 5;" },
    { file:'index', expect:'under 44', find:"TGT_PX = 14, TGT_BAND = 23,", replace:"TGT_PX = 14, TGT_BAND = 12," },
    { file:'index', expect:'reaches the rings', find:"TGT_TRAY = { y:256, step:74 };", replace:"TGT_TRAY = { y:240, step:74 };" },
    { file:'index', expect:'target: cards', find:"TGT_TRAY = { y:256, step:74 };", replace:"TGT_TRAY = { y:256, step:66 };" },
    { file:'index', expect:'a card is accepted on the wrong ring', find:"        if (P.data.d !== g.R * 2){ roundMiss(d.gTgtNo(P.data.d, g.R)); return false; }", replace:"        if (P.data.d !== g.R * 2 && P.data.d !== g.R){ roundMiss(d.gTgtNo(P.data.d, g.R)); return false; }" },
    { file:'index', expect:'the decoy is not in the tray', find:"renderTray(B, e.rs.map(function(R){ return R * 2; }).concat([e.decoy]),", replace:"renderTray(B, e.rs.map(function(R){ return R * 2; }),"},
    { file:'index', expect:'gTgtNo en', find:"has radius ' + dd + ' ÷ 2 = ' + (dd / 2) + ' cm, not '", replace:"has radius ' + dd + ' ÷ 2 = ' + dd + ' cm, not '" },
    { file:'index', expect:'gTgt2 zh', find:"'提示 2：尺上 ' + R + ' 的那一圈，要找直徑 ' + R + ' × 2 ＝ ' + (R * 2)", replace:"'提示 2：尺上 ' + R + ' 的那一圈，要找直徑 ' + R + ' × 2 ＝ ' + R" },

    /* ---- index.html：題庫與範例字串 ---- */
    { file:'index', expect:'parts are', find:"why:'直徑 ＝ 半徑 × 2 ＝ 4 × 2 ＝ 8 公分。' },", replace:"why:'直徑 ＝ 半徑 × 2 ＝ 4 × 2 ＝ 6 公分。' }," },
    { file:'index', expect:'parts are', find:"why:'Original diameter = 6 × 2 = 12 cm. The new diameter should be double that: 12 × 2 = 24 cm", replace:"why:'Original diameter = 6 × 2 = 12 cm. The new diameter should be double that: 12 × 2 = 26 cm" },
    { file:'index', expect:'misconceptionB', find:"          opts:['兩條都不是','紅色的那條','藍色的那條','兩條都是'], ans:0,", replace:"          opts:['兩條都不是','紅色的那條','藍色的那條','兩條都是'], ans:2," },
    { file:'index', expect:'misconceptionB', find:"      return circleFig({ circles: [{ r: 6, color: '#E8871E', width: 2 }],\n        segs: [\n          { a1: 0, a2: 180, r: q.shortR,", replace:"      return circleFig({ circles: [{ r: 6, color: '#E8871E', width: 2 }],\n        segs: [\n          { a1: 0, a2: 180, r: 6," },

    { file:'index', expect:'the circle rule is', find:"join:'提示 1：直徑是兩條方向相反的半徑", replace:"join:'提示 1：半徑 ＝ 直徑 × 2。直徑是兩條方向相反的半徑" },
    { file:'index', expect:'a decimal in an equation', find:"why:'直徑 ＝ 半徑 × 2 ＝ 4 × 2 ＝ 8 公分。' },", replace:"why:'直徑 ＝ 半徑 × 2 ＝ 4 × 2 ＝ 8.0 公分。' }," },
    { file:'index', expect:'one axis only', find:"var p = B.toBoard(e), dx = p.x - start.x, dy = p.y - start.y;", replace:"var p = B.toBoard(e), dx = p.x - start.x, dy = o.axis === 'x' ? 0 : p.y - start.y;" },
    { file:'index', expect:'leaves the tapped one selected', find:"        if (B.selected && B.selected !== P){ B.selected.el.classList.remove('sel'); B.selected = null; }\n", replace:"" },
    { file:'index', expect:'hit-test radius', find:"g.el = sv(svg, 'circle', { cx:O.x, cy:O.y, r:g.rp,", replace:"g.el = sv(svg, 'circle', { cx:O.x, cy:O.y, r:g.rp + 6," },
    { file:'index', expect:'not a number', find:"out:[105, 285], str:165 },", replace:"out:[105, 285], str:NaN }," },
    { file:'review', expect:'radius ratio', find:"pic: circleFig({ circles:[{ r:d.r1, color:'#3B7DD8' }, { r:d.r2, color:'#E8871E' }], showCenter:true }),", replace:"pic: circleFig({ circles:[{ r:d.r1, color:'#3B7DD8' }, { r:d.r1 + 1, color:'#E8871E' }], showCenter:true })," },
    { file:'review', expect:'cannot match the A label', find:"{ a1:segAangles[0], a2:segAangles[1], r:d.r, color:'#3B7DD8', width:4, label:'A' },", replace:"{ a1:segAangles[0], a2:segAangles[1], r:d.r, color:'#3B7DD8', width:4, label:'B' }," },
    /* ---- review.html ---- */
    { file:'review', expect:'is a square', find:"        var w = pick([2,3,4,5,6].filter(function(x){ return x < l; }));", replace:"        var w = pick([2,3,4,5,6]);" },
    { file:'review', expect:'is copied straight out of the stem', find:"        var m = mixOpts(per, [per - 1, per + 1, n]);", replace:"        var m = mixOpts(per, [per - 1, per + 1, total]);" },
    { file:'review', expect:'opts[ans] != correct', find:"        var r = d / 2;\n        var m = mixOpts(r, [d, d * 2, r + 2]);", replace:"        var r = d / 2;\n        var m = mixOpts(d, [r, d * 2, r + 2]);" },
    { file:'review', expect:'does not pass through the centre', find:"        var a2 = a1 + 180;", replace:"        var a2 = a1 + 170;" },
    { file:'review', expect:'is a diameter too', find:"        var gap = 60 + rand(91); // 60..150, never 180 -> never a diameter", replace:"        var gap = 180;" },
    { file:'review', expect:'but the marked answer is', find:"          opts: opts, ans: d.diamIsFirst ? 0 : 1,", replace:"          opts: opts, ans: 0," },
    { file:'review', expect:'same direction', find:"        var a2 = (a1 + 90 + rand(180)) % 360;", replace:"        var a2 = (a1 + rand(360)) % 360;" },
    { file:'review', expect:'the picture is labelled', find:"label:UNIT[lang](d.d), dy:-8 }], showCenter:true }),\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh' ? '半徑", replace:"label:UNIT[lang](d.r), dy:-8 }], showCenter:true }),\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh' ? '半徑" },
    { file:'review', expect:'r2 − r1', find:"        var r2 = r1 + pick([3,4,5,6]);", replace:"        var r2 = r1 + 2;" }
  ],

  sim: {
    blockStart: '  /* ---------- 幾何繪圖工具',
    INVARIANTS: {
      rFindD: d => { if (d.d !== d.r * 2) return 'd != 2r'; if (d.r < 2 || d.r > 12) return 'r outside 2~12'; },
      dFindR: d => { if (d.r * 2 !== d.d || !isInt(d.r)) return 'r != d/2'; },
      compassOpening: d => { if (d.r * 2 !== d.d || !isInt(d.r)) return 'r != d/2'; },
      whichIsDiameter: d => {
        if (d.a2 - d.a1 !== 180) return 'the diameter does not pass through the centre (a2 - a1 = ' + (d.a2 - d.a1) + ')';
        const gap = ((d.b2 - d.b1) % 360 + 360) % 360;
        if (gap < 60 || gap > 150) return 'the chord spans ' + gap + '° — at 180 it is a diameter too, under 60 it is a stub';
        if (typeof d.diamIsFirst !== 'boolean') return 'diamIsFirst missing';
      },
      equalRadii: d => {
        const g = ((d.a2 - d.a1) % 360 + 360) % 360;
        if (g < 90 || g > 270) return 'the two radii are only ' + g + '° apart — same direction, not "different directions"';
      },
      concentricSameCenter: d => { if (!(d.r2 - d.r1 >= 3)) return 'r2 − r1 = ' + (d.r2 - d.r1) + ' — the two circles are not clearly different'; },
      compareRvsD: d => { if (d.rSmall * 2 !== d.n) return 'rSmall != n/2'; },
      doubleDiameterNewRadius: d => {
        if (d.d0 !== d.r0 * 2 || d.newD !== d.d0 * 2 || d.newR * 2 !== d.newD) return 'the chain r0 → d0 → newD → newR is off';
      },
      perimeterRect: d => {
        if (d.P !== (d.l + d.w) * 2) return 'P != (l + w) × 2';
        if (!(d.l > d.w)) return 'length ' + d.l + ' and width ' + d.w + ' — l = w is a square, not the stem\'s rectangle';
      },
      multiplyTwoByOne: d => { if (d.p !== d.a * d.k) return 'p != a × k'; },
      divideEqualShare: d => { if (d.total !== d.n * d.per) return 'total != n × per'; }
    },
    expectedCorrect: function(d, genId, lang){
      const zh = lang === 'zh';
      switch (genId){
        case 'rFindD': return String(d.r * 2);
        case 'dFindR': return String(d.d / 2);
        case 'compassOpening': return String(d.d / 2);
        case 'whichIsDiameter': return (zh ? '線段 ' : 'Segment ') + (d.diamIsFirst ? 'A' : 'B');
        case 'equalRadii': return zh ? '兩條一樣長' : 'They are the same length';
        case 'concentricSameCenter': return zh ? '圓心一樣' : 'Same center';
        case 'compareRvsD': return zh ? '半徑 ' + d.n + ' 公分的圓' : 'The one with radius ' + d.n + ' cm';
        case 'doubleDiameterNewRadius': return String(d.r0 * 2 * 2 / 2);
        case 'perimeterRect': return String(2 * d.l + 2 * d.w);
        case 'multiplyTwoByOne': return String(d.a * d.k);
        case 'divideEqualShare': return String(d.total / d.n);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      const TEXT = {
        whichIsDiameter: { zh:['線段 A','線段 B','兩條都是','兩條都不是'], en:['Segment A','Segment B','Both','Neither'] },
        equalRadii: { zh:['A 比較長','B 比較長','兩條一樣長','沒辦法比較'], en:['A is longer','B is longer','They are the same length','It can’t be compared'] },
        concentricSameCenter: { zh:['半徑一樣','直徑一樣','圓心一樣','面積一樣'], en:['Same radius','Same diameter','Same center','Same area'] }
      };
      if (TEXT[genId]){ if (TEXT[genId][lang].indexOf(s) < 0) return 'option "' + s + '" is not one of the ' + genId + ' choices'; return; }
      if (genId === 'compareRvsD'){
        const ok = lang === 'zh' ? /^(半徑|直徑) \d+ 公分的圓$|^兩個圓一樣大$|^沒辦法比較$/ : /^The one with (radius|diameter) \d+ cm$|^They are the same size$|^It can’t be compared$/;
        if (!ok.test(s)) return 'option "' + s + '" is not a compareRvsD choice';
        return;
      }
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const n = Number(s);
      if (n < 1 || n > 200) return 'option ' + n + ' outside 1~200';
    },
    /* 刻意的迷思誘答：把半徑當直徑（rFindD 的 r）、把直徑當半徑或當圓規張開的距離（dFindR／compassOpening 的 d）、
       「直徑變 2 倍，半徑不變」（doubleDiameterNewRadius 的 r0）、把人數當每人幾顆（divideEqualShare 的 n）。只放行那一個值。 */
    stemEchoOk: {
      rFindD: (d, opt) => String(opt) === String(d.r),
      dFindR: (d, opt) => String(opt) === String(d.d),
      compassOpening: (d, opt) => String(opt) === String(d.d),
      doubleDiameterNewRadius: (d, opt) => String(opt) === String(d.r0),
      divideEqualShare: (d, opt) => String(opt) === String(d.n)
    },
    /* 從畫出來的那張圖量回來（不讀 make() 的角度） */
    renderCheck: function(d, q, lang, genId){
      if (!q.pic) return ['rFindD', 'dFindR', 'whichIsDiameter', 'equalRadii', 'concentricSameCenter', 'compareRvsD'].indexOf(genId) >= 0 ? 'has no picture' : undefined;
      const vb = (q.pic.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || []).slice(1).map(Number);
      if (vb.length !== 2) return 'cannot read the viewBox';
      const C = { x:vb[0] / 2, y:vb[1] / 2 };
      const circles = [...q.pic.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(m => ({ x:+m[1], y:+m[2], r:+m[3] }));
      const lines = [...q.pic.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)].map(m => ({ p:{ x:+m[1], y:+m[2] }, q:{ x:+m[3], y:+m[4] } }));
      const texts = [...q.pic.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => m[1]);
      const ring = circles.filter(c => c.r > 6)[0];
      if (!ring || Math.abs(ring.x - C.x) > 0.11 || Math.abs(ring.y - C.y) > 0.11) return 'the circle is not centred in its picture';
      const onRing = z => Math.abs(hyp(z, C) - ring.r) < 0.2, atC = z => hyp(z, C) < 0.2;
      const lineC = L => { const vx = L.q.x - L.p.x, vy = L.q.y - L.p.y, t = Math.max(0, Math.min(1, ((C.x - L.p.x) * vx + (C.y - L.p.y) * vy) / (vx * vx + vy * vy))); return hyp(C, { x:L.p.x + t * vx, y:L.p.y + t * vy }); };
      if (genId === 'whichIsDiameter'){
        if (lines.length !== 2) return 'expected two segments, drew ' + lines.length;
        const through = lines.map(L => onRing(L.p) && onRing(L.q) && lineC(L) < 0.2);
        if (through.filter(Boolean).length !== 1) return 'exactly one segment should be a diameter, got ' + through.filter(Boolean).length;
        const other = lines[through.indexOf(false)];
        if (!(onRing(other.p) && onRing(other.q))) return 'the other segment is not a chord';
        if (lineC(other) < 6) return 'the chord passes only ' + lineC(other).toFixed(1) + 'px from the centre — it looks like a diameter';
        /* 哪一條是 A：字母和它那一條線同一個顏色（小圓上字常常擠在兩條線之間，顏色才是孩子對得上的線索）—— 不靠畫的順序 */
        const strokes = [...q.pic.matchAll(/<line [^>]*stroke="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1]);
        const labA = (q.pic.match(/<text [^>]*fill="(#[0-9A-Fa-f]{6})"[^>]*>A<\/text>/) || [])[1];
        if (!labA || strokes.length !== 2 || strokes[0] === strokes[1]) return 'cannot match the A label to a segment by colour';
        const aIdx = strokes.indexOf(labA);
        if (aIdx < 0) return 'the A label has no segment of its colour';
        const letter = through[aIdx] ? 'A' : 'B';
        if (q.opts[q.ans] !== (lang === 'zh' ? '線段 ' : 'Segment ') + letter) return 'the diameter is drawn as ' + letter + ' but the marked answer is ' + q.opts[q.ans];
        if (texts.indexOf('A') < 0 || texts.indexOf('B') < 0) return 'segments are not labelled A and B';
      }
      if (genId === 'equalRadii'){
        if (lines.length !== 2) return 'expected two radii';
        for (const L of lines) if (!(atC(L.q) && onRing(L.p))) return 'a "radius" does not run from the centre to the circle';
        const ang = L => Math.atan2(C.y - L.p.y, L.p.x - C.x) * 180 / Math.PI;
        const g = Math.abs(((ang(lines[0]) - ang(lines[1])) % 360 + 540) % 360 - 180);
        if (g < 30) return 'the two radii point the same way (' + g.toFixed(0) + '° apart)';
      }
      if (genId === 'rFindD' || genId === 'dFindR'){
        const want = genId === 'rFindD' ? d.r : d.d;
        if (nums(texts.join(' ')).join() !== String(want)) return 'the picture is labelled ' + texts.join() + ', the stem says ' + want;
        if (lines.length !== 1) return 'expected one segment';
        const L = lines[0];
        if (genId === 'rFindD' && !(atC(L.q) && onRing(L.p))) return 'the labelled segment is not a radius';
        if (genId === 'dFindR' && !(onRing(L.p) && onRing(L.q) && lineC(L) < 0.2)) return 'the labelled segment is not a diameter';
      }
      if (genId === 'concentricSameCenter' || genId === 'compareRvsD'){
        const two = circles.filter(c => c.r > 6);
        if (two.length !== 2 || two.some(c => hyp(c, C) > 0.11)) return 'the two circles do not share the centre';
        const ratio = Math.max(two[0].r, two[1].r) / Math.min(two[0].r, two[1].r);
        if (genId === 'concentricSameCenter' && Math.abs(ratio - d.r2 / d.r1) > 0.01) return 'the circles are drawn with radius ratio ' + ratio.toFixed(2) + ', should be ' + d.r2 + ' : ' + d.r1;
        if (genId === 'compareRvsD' && Math.abs(ratio - 2) > 0.01) return 'the radius-n circle should be twice the diameter-n one (ratio ' + ratio.toFixed(2) + ')';
      }
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「圓規挑戰」',
    dataEnd: '  /* ================= i18n ================= */',
    dataReturn: '{GPICK, GW, PT_H, PT_O, PT_PX, PT_TAP, PT_LBL, GAME_POINTS, ptXY, SORT_H, SORT_CARD, SORT_R, SORT_PAD, SORT_BIN, SORT_TRAY, SORT_BINS, SORT_BIN_OF, SORT_NONE, SORT_ANG, SORT_GAP, SORT_SHORT, sortBinX, sortSlotXY, sortTrayXY, sortSeg, JOIN_H, JOIN_O, JOIN_PX, JOIN_SLOT_H, JOIN_PAD, JOIN_TRAY, JOIN_BAR, JOIN_STICK_H, JOIN_BAR_DY, GAME_JOIN, joinSticks, joinSlots, joinTrayXY, joinStickW, CMP_H, CMP_O, CMP_PX, CMP_MAX, CMP_HINGE, CMP_START, CMP_RULER, CMP_PEN_DY, CMP_TAPY, CMP_GOAL, GAME_COMPASS, cmpTipX, TGT_H, TGT_O, TGT_PX, TGT_BAND, TGT_RULER, TGT_CARD, TGT_TRAY, GAME_TARGET, tgtTrayXY}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = D.GW;
      if (W !== 300) fail('GW should be 300 (the board width every layout below is checked against), got ' + W);

      /* --- 0. 算式掃描器自己先證明會響 --- */
      [['4 × 2 ＝ 8', true], ['4 × 2 ＝ 6', false], ['直徑 ＝ 5 ＋ 5 ＝ 5 × 2 ＝ 10 公分', true], ['5 ＋ 5 ＝ 5 × 2 ＝ 11', false], ['5 + 5 = 10 = 5 × 3', false],
       ['半徑 ＝ 直徑 ÷ 2 ＝ 10 ÷ 2 ＝ 5 公分', true], ['半徑 ＝ 直徑 ÷ 2 ＝ 10 ÷ 2 ＝ 4 公分', false], ['24 ÷ 2 = 12', true], ['24 ÷ 2 = 13', false], ['12 × 2 ＝ 24', true], ['4 × 2 ＝ 8.1', false], ['半徑 ＝ 直徑 × 2 ＝ 8', false], ['半徑 ＝ 2 × 直徑', false], ['直徑 ＝ 2 × 半徑', true], ['.5 × 2 ＝ 1', false], ['8 ÷ 2 ＝ 4。下一題', true]]
        .forEach(([t, good]) => {
          const r = scanEquations(t);
          if (r.length < 1 || r.every(x => x.bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
        });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的算式逐條重算 --- */
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
      if (checkedEq < 20) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');

      /* 題庫：誤解檢查第二題（舊版把「通過圓心、兩端沒碰到圓」的線當成直徑）—— 畫出來的藍線兩端在圓裡面，正解只能是「兩條都不是」 */
      LANGS.forEach(L => {
        const q = (I18N[L].qsBoost || []).filter(x => x.kind === 'misconceptionB')[0];
        if (!q) return fail('qsBoost misconceptionB missing in ' + L);
        if (!(q.shortR > 0 && q.shortR < 6)) fail('misconceptionB ' + L + ': the blue segment (radius ' + q.shortR + ') must stop inside the radius-6 circle');
        if (q.opts[q.ans] !== (L === 'zh' ? '兩條都不是' : 'Neither')) fail('misconceptionB ' + L + ': neither segment is a diameter, but the marked answer is "' + q.opts[q.ans] + '"');
      });
      if (!/segs: \[\n\s*\{ a1: 0, a2: 180, r: q\.shortR, color: '#3B7DD8'/.test(src)) fail('misconceptionB: the blue segment is not drawn with radius q.shortR');
      LANGS.forEach(L => { const q = (I18N[L].qsBoost || []).filter(x => x.kind === 'misconceptionA')[0]; if (q && /\d/.test(q.aria)) fail('misconceptionA ' + L + ': the aria label mentions a number the picture does not show: ' + q.aria); });

      /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['points', 'sort', 'join', 'compass', 'target'];
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
      const says = (where, text, word) => { if (String(text).indexOf(word) < 0) fail(where + ': should say "' + word + '": ' + text); };
      const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board'); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
      const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      const near = (a, b) => Math.abs(a - b) < 1e-6;
      ['GAME_POINTS', 'GAME_JOIN', 'GAME_COMPASS', 'GAME_TARGET'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡） */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('a point you tap (' + D.PT_TAP + ')', D.PT_TAP);
      tooSmall('a sort card (' + D.SORT_CARD + ')', D.SORT_CARD);
      tooSmall('a stick (height ' + D.JOIN_STICK_H + ')', D.JOIN_STICK_H);
      tooSmall('a target card (' + D.TGT_CARD.w + '×' + D.TGT_CARD.h + ')', Math.min(D.TGT_CARD.w, D.TGT_CARD.h));
      tooSmall('a half of the diameter with its pad (height)', D.JOIN_SLOT_H + 2 * D.JOIN_PAD);
      tooSmall('a ring with its band', 2 * D.TGT_BAND);
      [D.SORT_CARD, D.JOIN_STICK_H, D.TGT_CARD.w, D.TGT_CARD.h].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('compass', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:cmpTipX\(k\), cy:O\.y \+ CMP_PEN_DY,/, 'the pencil is not GPICK × GPICK at cmpTipX(k)');
      need('sort', /addPiece\(B, \{ w:SORT_CARD, h:SORT_CARD, cx:x, cy:y,/, 'the cards are not SORT_CARD × SORT_CARD');
      need('join', /addPiece\(B, \{ w:joinStickW\(Lc\), h:JOIN_STICK_H, cx:x, cy:y,/, 'the sticks are not joinStickW(L) × JOIN_STICK_H');
      need('target', /addPiece\(B, \{ w:TGT_CARD\.w, h:TGT_CARD\.h, cx:x, cy:y,/, 'the cards are not TGT_CARD');
      need('points', /p\.el = addZone\(B, c\.x - PT_TAP \/ 2, c\.y - PT_TAP \/ 2, PT_TAP, PT_TAP, 'gpt'\);/, 'the points are not PT_TAP × PT_TAP at ptXY()');

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
      /* 兩層提示：第二層才讓下一個目標閃 */
      if (!/if \(hintLevel >= 2 && gCtx\.blink\) gCtx\.blink\(\);/.test(src)) fail('hint 2 does not blink the next target');
      if (!/var p = B\.toBoard\(e\), dx = p\.x - start\.x, dy = p\.y - start\.y;/.test(src)) fail('engine: a drag is detected from one axis only (an axis-locked piece swiped vertically counts as a tap)');
      if (!/if \(B\.selected && B\.selected !== P\)\{ B\.selected\.el\.classList\.remove\('sel'\); B\.selected = null; \}/.test(src)) fail('engine: dragging another piece leaves the tapped one selected');
      if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint 1 automatically');

      /* --- nearestOpen() / nearestRing()：從原始碼切出來真的跑 --- */
      let nearestOpen = null, nearestRing = null;
      {
        const f1 = extractFunction(src, 'nearestOpen'), f2 = extractFunction(src, 'nearestRing');
        if (!f1) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(f1 + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (!f2) fail('cannot find nearestRing() in index.html');
        else { try { nearestRing = new Function(f2 + '\nreturn nearestRing;')(); } catch (e){ fail('nearestRing() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：找點（範例 1） --- */
      {
        const O = D.PT_O, PX = D.PT_PX, T = D.PT_TAP;
        if (PX < 16) fail('points: 1 cm is ' + PX + 'px — points 1 cm apart on the board must be told apart by eye (≥ 16px)');
        const myPt = (rc, a) => ({ x:O.x + rc * PX * Math.cos(a * Math.PI / 180), y:O.y - rc * PX * Math.sin(a * Math.PI / 180) });
        const lbl = D.PT_LBL;
        inside(lbl, 'points: the string label', W, D.PT_H);
        D.GAME_POINTS.forEach((e, i) => {
          const w = 'GAME_POINTS[' + i + ']';
          if (!isInt(e.r) || e.r < 3 || e.r > 6) return fail(w + ': r ' + e.r + ' — should be 3~6');
          if (e.on.length < 4) fail(w + ': only ' + e.on.length + ' points on the circle');
          if (!e.inn.length) fail(w + ': no point inside the circle (r − 1)');
          if (!e.out.length) fail(w + ': no point outside the circle (r + 1)');
          const all = [];
          [['on', 0], ['inn', -1], ['out', 1]].forEach(([k, dr]) => e[k].forEach(a => all.push({ k, a, rc:e.r + dr })));
          all.forEach(p => {
            const P = D.ptXY(p.rc, p.a), M = myPt(p.rc, p.a);
            if (!near(P.x, M.x) || !near(P.y, M.y)) fail(w + ': ptXY(' + p.rc + ', ' + p.a + ') is ' + JSON.stringify(P) + ', should be ' + JSON.stringify(M));
            p.c = M;
            const cm = hyp(M, O) / PX;
            if (Math.abs(cm - (p.k === 'on' ? e.r : (p.k === 'inn' ? e.r - 1 : e.r + 1))) > 1e-9) fail(w + ': a ' + p.k + ' point is ' + cm.toFixed(2) + ' cm from O');
            inside(sq(M.x, M.y, T), w + ' point ' + p.k + ' ' + p.a + '°', W, D.PT_H);
            if (hyp(M, O) - T / 2 < 10) fail(w + ': the point at ' + p.a + '° covers O');
            /* 圓的拿取範圍 vs 方框標籤：圓心到方框的最近距離要大於半徑 */
            const ex = Math.max(lbl.x - M.x, 0, M.x - (lbl.x + lbl.w)), ey = Math.max(lbl.y - M.y, 0, M.y - (lbl.y + lbl.h));
            if (Math.sqrt(ex * ex + ey * ey) < T / 2) fail(w + ': the point at ' + p.a + '° covers the string label');
          });
          for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++){
            const g = hyp(all[a].c, all[b].c);
            if (g < T + 2) fail(w + ': tap targets at ' + all[a].a + '° and ' + all[b].a + '° are ' + g.toFixed(1) + 'px apart — under ' + (T + 2));
          }
          const angs = all.map(p => ((p.a % 360) + 360) % 360);
          if (new Set(angs).size !== angs.length) fail(w + ': two points share an angle');
          if (!Number.isFinite(e.str)) fail(w + ': the string\'s start angle ' + e.str + ' is not a number');
          /* 繩子一開始不可以就指著一個圓上的點（等於直接給答案） */
          e.on.forEach(a => { const g = Math.abs((((e.str - a) % 360) + 540) % 360 - 180); if (g < 15) fail(w + ': the string starts on a point of the circle (' + g + '° away)'); });
          /* 繩子轉一圈也在畫板裡；找齊之後畫出來的圓也在畫板裡 */
          if (O.x - e.r * PX < 0 || O.x + e.r * PX > W || O.y - e.r * PX < 0 || O.y + e.r * PX > D.PT_H) fail(w + ': the circle runs off the board');
          /* 照遊戲的規則：點圓上的點才收，點完圓上的點就過關；點不在圓上的點一定說它在裡面或外面 */
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let f = 0; f <= e.on.length; f++) seq(w + ' gPtNow ' + L, d.gPtNow(f, e.on.length), [f, e.on.length]);
            seq(w + ' gPtDone ' + L, d.gPtDone(e.on.length, e.r), [e.on.length, e.r, e.r]);
            seq(w + ' gPtString ' + L, d.gPtString(e.r), [e.r]);
            for (let left = 1; left <= e.on.length; left++) seq(w + ' gPt2 ' + L, d.gPt2(left), [2, left]);
            e.inn.forEach(() => { const t = d.gPtIn(e.r - 1, e.r); seq(w + ' gPtIn ' + L, t, [e.r - 1, e.r]); says(w + ' gPtIn ' + L, t, L === 'zh' ? '裡面' : 'inside'); });
            e.out.forEach(() => { const t = d.gPtOut(e.r + 1, e.r); seq(w + ' gPtOut ' + L, t, [e.r + 1, e.r]); says(w + ' gPtOut ' + L, t, L === 'zh' ? '外面' : 'outside'); });
          });
        });
        if (!D.GAME_POINTS.some(e => e.r !== D.GAME_POINTS[0].r)) fail('GAME_POINTS: every entry has the same radius');
        need('points', /\[\['on', 0\], \['inn', -1\], \['out', 1\]\]\.forEach/, 'an off-circle point is accepted (the points are not built as on r, inn r − 1, out r + 1)');
        need('points', /var c = ptXY\(p\.rc, p\.a\);/, 'the points are not drawn at ptXY()');
        need('points', /if \(p\.on\)\{\s*p\.found = true; found\+\+;/, 'an on-circle point is not counted');
        need('points', /if \(found === n\)\{ ring\.setAttribute\('opacity', 1\); roundSolved\(d\.gPtDone\(n, e\.r\)\); \}/, 'the round is not solved exactly when every on-circle point is found');
        need('points', /roundMiss\(p\.rc < e\.r \? d\.gPtIn\(p\.rc, e\.r\) : d\.gPtOut\(p\.rc, e\.r\)\);/, 'an off-circle point does not say whether it is inside or outside');
        need('points', /if \(p\.bad\) return;/, 'a marked point costs again');
        need('points', /var e = pick\(GAME_POINTS\), O = PT_O, n = e\.on\.length, found = 0, rp = e\.r \* PT_PX;/, 'the string is not r × PT_PX long');
        need('points', /var ring = sv\(svg, 'circle', \{ cx:O\.x, cy:O\.y, r:rp, fill:'none', stroke:'#2F9E69', 'stroke-width':3, opacity:0 \}\);/, 'the circle is drawn before the points are found');
      }

      /* --- 第 2 關：分一分（範例 2＋3） --- */
      {
        const SB = D.SORT_BIN, c = { x:(D.SORT_CARD - 6) / 2, y:(D.SORT_CARD - 6) / 2 };
        if (D.SORT_BINS.join() !== 'r,d,n') fail('SORT_BINS should be r,d,n, got ' + D.SORT_BINS.join());
        const bins = D.SORT_BINS.map((k, i) => {
          const cx = W / 2 + (i - 1) * (SB.w + SB.gap);
          if (!near(D.sortBinX(i), cx)) fail('sortBinX(' + i + ') should be ' + cx);
          return { x:cx - SB.w / 2, y:SB.y, w:SB.w, h:SB.h };
        });
        bins.forEach((b, i) => inside(b, 'sort: box ' + i, W, D.SORT_H)); noHits(bins, 'sort: boxes');
        if (!(SB.gap > 0 && SB.gap < 2 * D.SORT_PAD)) fail('sort: the boxes should be apart but within each other\'s pad (gap ' + SB.gap + ', pad ' + D.SORT_PAD + ') — the nearest-box rule is what decides');
        /* 每一個箱子最多兩張（半徑 2、直徑 2、都不是 2）：兩格都在箱子裡、在標籤下面、互不重疊 */
        bins.forEach((b, i) => {
          const slots = [0, 1].map(j => {
            const s = D.sortSlotXY(i, j), m = { x:W / 2 + (i - 1) * (SB.w + SB.gap), y:SB.y + SB.top + D.SORT_CARD / 2 + j * SB.step };
            if (!near(s.x, m.x) || !near(s.y, m.y)) fail('sortSlotXY(' + i + ', ' + j + ') should be ' + JSON.stringify(m));
            const o = sq(m.x, m.y, D.SORT_CARD);
            if (!(o.x >= b.x && o.y >= b.y + SB.top - 2 && o.x + o.w <= b.x + b.w && o.y + o.h <= b.y + b.h)) fail('sort: card slot ' + j + ' sticks out of its box ' + i);
            return o;
          });
          noHits(slots, 'sort: slots in box ' + i);
        });
        const tray = [0, 1, 2, 3, 4, 5].map(i => {
          const t = D.sortTrayXY(i), m = { x:W / 2 + ((i % 3) - 1) * D.SORT_TRAY.dx, y:D.SORT_TRAY.y + Math.floor(i / 3) * D.SORT_TRAY.dy };
          if (!near(t.x, m.x) || !near(t.y, m.y)) fail('sortTrayXY(' + i + ') should be ' + JSON.stringify(m));
          return sq(m.x, m.y, D.SORT_CARD);
        });
        tray.forEach((o, i) => inside(o, 'sort: tray card ' + i, W, D.SORT_H)); noHits(tray, 'sort: tray cards');
        if (Math.min(...tray.map(o => o.y)) < SB.y + SB.h + D.SORT_PAD + 4) fail('sort: the card tray reaches the boxes\' drop pads');
        /* 每一種卡、每一個角度、每一個弦的角距：畫出來的那條線，用自己的幾何分類，必須就是它該去的箱子 */
        const kinds = Object.keys(D.SORT_BIN_OF);
        if (kinds.sort().join() !== 'chord,dia,half,rad,thru') fail('SORT_BIN_OF should cover rad, dia, chord, half, thru');
        if (D.SORT_NONE.some(k => D.SORT_BIN_OF[k] !== 'n') || D.SORT_NONE.length !== 3 || new Set(D.SORT_NONE).size !== 3) fail('SORT_NONE should be the three "neither" kinds');
        if (new Set(D.SORT_ANG).size < 6) fail('SORT_ANG has fewer than 6 different angles (six cards each need their own)');
        let classified = 0;
        kinds.forEach(k => D.SORT_ANG.forEach(a => D.SORT_GAP.forEach(gp => {
          const s = D.sortSeg(k, a, gp);
          [s.x1, s.y1, s.x2, s.y2].forEach(v => { if (!(v >= 0 && v <= D.SORT_CARD - 6)) fail('sort: a ' + k + ' line at ' + a + '° leaves the card'); });
          const got = classifySeg(s, c, D.SORT_R);
          classified++;
          if (got.bin !== D.SORT_BIN_OF[k]) fail('sort: a ' + k + ' card at ' + a + '° (gap ' + gp + ') is drawn as ' + got.bin + ' — should go in ' + D.SORT_BIN_OF[k]);
          else if (got.bin === 'n' && !got.clear) fail('sort: a ' + k + ' card at ' + a + '° is not visibly "neither" (end ' + got.off.toFixed(1) + 'px off the circle, line ' + got.segC.toFixed(1) + 'px from the centre)');
        })));
        if (classified < 5 * 8) fail('sort: only ' + classified + ' cards classified');
        if (D.SORT_R + 2 > (D.SORT_CARD - 6) / 2) fail('sort: the little circle does not fit its card');
        LANGS.forEach(L => {
          const d = I18N[L];
          D.SORT_BINS.forEach(b => { if (typeof d.gSortBins[b] !== 'string' || !d.gSortBins[b]) fail('gSortBins.' + b + ' missing in ' + L); });
          kinds.forEach(k => D.SORT_BINS.forEach(b => {
            const has = d.gSortNo[k] && typeof d.gSortNo[k][b] === 'string' && d.gSortNo[k][b].length > 0;
            if (b === D.SORT_BIN_OF[k]){ if (d.gSortNo[k] && d.gSortNo[k][b] !== undefined) fail('gSortNo.' + k + '.' + b + ' exists in ' + L + ' but ' + b + ' is the right box'); }
            else if (!has) fail('gSortNo.' + k + '.' + b + ' missing in ' + L);
          }));
          for (let s = 0; s <= 6; s++) seq('gSortNow ' + L, d.gSortNow(s, 6), [s, 6]);
          D.SORT_BINS.forEach(b => { const t = d.gSort2(d.gSortBins[b]); seq('gSort2 ' + L, t, [2]); says('gSort2 ' + L, t, d.gSortBins[b]); });
        });
        need('sort', /var kinds = \['rad', 'rad', 'dia', 'dia'\]\.concat\(shuffle\(SORT_NONE\)\.slice\(0, 2\)\), angs = shuffle\(SORT_ANG\);/, 'a round is not two radius, two diameter and two different "neither" cards at different angles');
        need('sort', /var bin = nearestOpen\(bins, pt, SORT_PAD\);/, 'a card is not put in the nearest box');
        need('sort', /if \(bin\.key !== want\)\{ roundMiss\(d\.gSortNo\[P\.data\.kind\]\[bin\.key\]\); return false; \}/, 'a card is accepted in the wrong box');
        need('sort', /var want = SORT_BIN_OF\[P\.data\.kind\];/, 'the right box is not SORT_BIN_OF[kind]');
        need('sort', /var s = sortSlotXY\(bin\.i, bin\.n\);/, 'a sorted card is not laid at sortSlotXY()');
        need('sort', /if \(sorted === n\) roundSolved\(d\.gSortDone\);/, 'the round is not solved exactly when every card is sorted');
        need('sort', /var s = sortSeg\(it\.kind, it\.ang, it\.gap\)/, 'the card is not drawn with sortSeg()');
        need('sort', /\}, sortTrayXY\);/, 'the cards are not laid at sortTrayXY()');
      }

      /* --- 第 3 關：拼直徑（範例 3） --- */
      {
        const O = D.JOIN_O, PX = D.JOIN_PX;
        /* 棍子的條在哪裡：從 CSS 讀（padding-top、字的高度、條的 margin-top 與高度），不要相信 JOIN_BAR_DY 這個數字 */
        const css = (src.match(/\.gstick\{[^}]*padding-top:(\d+)px[^}]*\}[\s\S]*?\.gstick span\{[^}]*height:(\d+)px[^}]*\}[\s\S]*?\.gstick i\{[^}]*height:(\d+)px;margin-top:(\d+)px/) || []).slice(1).map(Number);
        if (css.length !== 4) fail('join: cannot read the .gstick CSS (padding-top / span height / bar height / bar margin)');
        else {
          const [pt, sh, bh, bm] = css, barC = pt + sh + bm + bh / 2 - D.JOIN_STICK_H / 2;
          if (bh !== D.JOIN_BAR) fail('join: the CSS bar is ' + bh + 'px, JOIN_BAR says ' + D.JOIN_BAR);
          if (!near(barC, D.JOIN_BAR_DY)) fail('join: the bar sits ' + barC + 'px below the stick\'s centre, JOIN_BAR_DY says ' + D.JOIN_BAR_DY + ' — a placed stick would not lie on the dashed line');
          if (pt + sh + bm + bh > D.JOIN_STICK_H) fail('join: the bar sticks out of the bottom of the stick');
        }
        need('join', /P\.lock\(s\.cx, O\.y - JOIN_BAR_DY\);/, 'a placed stick is not laid with its bar on the dashed line');
        D.GAME_JOIN.forEach((r, i) => {
          const w = 'GAME_JOIN[' + i + ']';
          if (!isInt(r) || r - 1 < 2) return fail(w + ': r ' + r + ' — the short stick would be ' + (r - 1) + ' cm (a stick of 1 cm or less)');
          const rp = r * PX;
          if (O.x - rp < 4 || O.x + rp > W - 4 || O.y + rp > D.JOIN_H) fail(w + ': the circle runs off the board');
          if (O.y - rp - 8 - 15 < 0) fail(w + ': the circle and its label run off the top of the board');
          const st = D.joinSticks(r);
          if (st.slice().sort((a, b) => a - b).join() !== [r - 1, r, r, r + 1].join()) fail(w + ': joinSticks(' + r + ') is ' + st.join() + ', should be r, r, r − 1, r + 1');
          if (st.indexOf(2 * r) >= 0) fail(w + ': a 2r stick is offered — one stick of 2r also makes a diameter, which the round would reject');
          /* 照遊戲的規則：半邊只收 L === r；兩根 r 都放好就是直徑 r ＋ r */
          const fits = st.filter(L => L === r);
          if (fits.length !== 2) fail(w + ': the round needs exactly two ' + r + ' cm sticks, has ' + fits.length);
          const halves = D.joinSlots(r);
          if (halves.length !== 2 || !near(halves[0].cx - halves[0].hw, O.x - rp) || !near(halves[0].cx + halves[0].hw, O.x) || !near(halves[1].cx - halves[1].hw, O.x) || !near(halves[1].cx + halves[1].hw, O.x + rp) || halves.some(h => !near(h.cy, O.y)))
            fail(w + ': joinSlots(' + r + ') should be [circle → O] and [O → circle] on the dashed line, got ' + JSON.stringify(halves));
          /* 兩個半邊在圓心碰在一起：圓心附近的點落在兩邊的 pad 裡，要給最近的那一邊 */
          if (nearestOpen){
            const list = halves.map((h, k) => Object.assign({ id:k, done:false }, h));
            let bad = 0;
            for (let x = O.x - rp + 0.5; x < O.x + rp; x += 1){ const g = nearestOpen(list, { x, y:O.y + 3 }, D.JOIN_PAD); if (!g || g.id !== (x < O.x ? 0 : 1)) bad++; }
            if (bad) fail(w + ': nearestOpen(): ' + bad + ' points along the diameter are given to the other half (or none)');
          }
          /* 托盤：每一種排法（洗牌）裡，任兩根都不碰到、不出界，條也放得下 */
          const pos = [0, 1, 2, 3].map(k => D.joinTrayXY(k));
          pos.forEach((p, k) => { const m = { x:D.JOIN_TRAY.x[k % 2], y:D.JOIN_TRAY.y + Math.floor(k / 2) * D.JOIN_TRAY.dy }; if (!near(p.x, m.x) || !near(p.y, m.y)) fail('joinTrayXY(' + k + ') should be ' + JSON.stringify(m)); });
          const perms = [[0, 1, 2, 3]];
          (function permute(a, l){ if (l === a.length){ perms.push(a.slice()); return; } for (let k = l; k < a.length; k++){ [a[l], a[k]] = [a[k], a[l]]; permute(a, l + 1); [a[l], a[k]] = [a[k], a[l]]; } })([0, 1, 2, 3], 0);
          for (const pm of perms){
            const boxes = pm.map((s, k) => sq(pos[k].x, pos[k].y, D.joinStickW(st[s]), D.JOIN_STICK_H));
            let bad = false;
            boxes.forEach((o, k) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= D.JOIN_H)) bad = true; });
            for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) if (hit(boxes[a], boxes[b])) bad = true;
            if (bad){ fail(w + ': join: sticks overlap or leave the board in tray order ' + pm.map(s => st[s]).join()); break; }
          }
          st.forEach(L => { if (D.joinStickW(L) < L * PX + 4) fail(w + ': a ' + L + ' cm stick is narrower than its bar'); });
          if (Math.min(...pos.map(p => p.y)) - D.JOIN_STICK_H / 2 < O.y + rp + 10) fail(w + ': the stick tray reaches the circle');
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gJoinNow 0 ' + L, d.gJoinNow(0, r), []);
            seq(w + ' gJoinNow 1 ' + L, d.gJoinNow(1, r), [r]);
            seq(w + ' gJoinNow 2 ' + L, d.gJoinNow(2, r), [r, r, 2 * r]);
            seq(w + ' gJoinDone ' + L, d.gJoinDone(r), [r, r, r, 2, 2 * r]);
            seq(w + ' gJoin2 ' + L, d.gJoin2(r), [2, r]);
            seq(w + ' gJoinR ' + L, d.gJoinR(r), [r]);
            st.forEach(Lc => seq(w + ' gJoinStick ' + L, d.gJoinStick(Lc), [Lc]));
            const sh = d.gJoinShort(r - 1, r), lg = d.gJoinLong(r + 1, r);
            seq(w + ' gJoinShort ' + L, sh, [r - 1, r]); says(w + ' gJoinShort ' + L, sh, L === 'zh' ? '短' : 'shorter');
            seq(w + ' gJoinLong ' + L, lg, [r + 1, r]); says(w + ' gJoinLong ' + L, lg, L === 'zh' ? '長' : 'longer');
          });
        });
        need('join', /var s = nearestOpen\(slots, pt, JOIN_PAD\);/, 'a stick is not put on the nearest half');
        need('join', /if \(Lc < r\)\{ roundMiss\(d\.gJoinShort\(Lc, r\)\); return false; \}/, 'a short stick is accepted');
        need('join', /if \(Lc > r\)\{ roundMiss\(d\.gJoinLong\(Lc, r\)\); return false; \}/, 'a long stick is accepted');
        need('join', /if \(placed === 2\)\{/, 'the round is not solved exactly when both halves are filled');
        need('join', /renderTray\(B, joinSticks\(r\), function\(Lc, x, y\)\{/, 'the sticks are not joinSticks(r)');
        need('join', /\}, joinTrayXY\);/, 'the sticks are not laid at joinTrayXY()');
        need('join', /'<span>' \+ d\.gJoinStick\(Lc\) \+ '<\/span><i style="width:' \+ \(Lc \* JOIN_PX\) \+ 'px"><\/i>'/, 'a stick\'s bar is not drawn L × JOIN_PX long');
        need('join', /var r = pick\(GAME_JOIN\), O = JOIN_O, rp = r \* JOIN_PX, placed = 0;/, 'the circle is not r × JOIN_PX');
      }

      /* --- 第 4 關：張圓規（範例 4） --- */
      {
        const O = D.CMP_O, PX = D.CMP_PX, RU = D.CMP_RULER;
        const pen = k => sq(D.cmpTipX(k), O.y + D.CMP_PEN_DY, D.GPICK);
        for (let k = 0; k <= D.CMP_MAX; k++) if (!near(D.cmpTipX(k), O.x + k * PX)) fail('cmpTipX(' + k + ') should be ' + (O.x + k * PX));
        for (let k = 1; k <= D.CMP_MAX; k++){ inside(pen(k), 'compass: the pencil at ' + k + ' cm', W, D.CMP_H); if (hit(pen(k), D.CMP_GOAL)) fail('compass: the goal label overlaps the pencil at ' + k + ' cm'); }
        inside(D.CMP_GOAL, 'compass: the goal label', W, D.CMP_H);
        if (O.y - D.CMP_HINGE < D.CMP_GOAL.y + D.CMP_GOAL.h + 6) fail('compass: the goal label overlaps the compass hinge');
        inside({ x:O.x - 8, y:RU.y, w:D.CMP_MAX * PX + 16, h:RU.h + 16 }, 'compass: the ruler', W, D.CMP_H);
        if (!(RU.y >= O.y && RU.y + RU.h - O.y <= D.CMP_TAPY)) fail('compass: a tap on the ruler is ignored (the ruler reaches ' + (RU.y + RU.h - O.y) + 'px below O, CMP_TAPY is ' + D.CMP_TAPY + ')');
        if (pen(1).y + pen(1).h > RU.y + 2) fail('compass: the pencil covers the ruler numbers');
        if (PX < 14) fail('compass: 1 cm is ' + PX + 'px on the ruler — too tight to read');
        D.GAME_COMPASS.forEach((Dm, i) => {
          const w = 'GAME_COMPASS[' + i + ']';
          if (!isInt(Dm) || Dm % 2) return fail(w + ': the diameter ' + Dm + ' is odd — the radius would not be a whole cm');
          const r = Dm / 2;
          if (r < 3) fail(w + ': radius ' + r + ' — the compass starts at the answer or one off it');
          if (Dm > D.CMP_MAX) fail(w + ': the ruler (' + D.CMP_MAX + ' cm) cannot reach the diameter ' + Dm + ' — the commonest mistake could not even be tried');
          if (D.CMP_START === r || D.CMP_START === Dm) fail(w + ': the compass starts at ' + D.CMP_START + ' cm');
          if (O.x - r * PX < 2 || O.x + r * PX > W - 2 || O.y - r * PX < 0 || O.y + r * PX > D.CMP_H) fail(w + ': the right circle (radius ' + r + ' cm) runs off the board');
          /* 照遊戲的規則：每一種張法按「畫圓」—— 只有 k === r 過關；k === D 說「那是直徑」，其他說畫出來的直徑是 2k、比 D 大或小 */
          LANGS.forEach(L => {
            const d = I18N[L];
            seq(w + ' gCmpGoal ' + L, d.gCmpGoal(Dm), [Dm]);
            seq(w + ' gCmpDone ' + L, d.gCmpDone(r, Dm), [r, r, 2, Dm]);
            seq(w + ' gCmp2 ' + L, d.gCmp2(Dm, r), [2, Dm, 2, r, r]);
            seq(w + ' gCmpIsD ' + L, d.gCmpIsD(Dm), [Dm, Dm, 2, 2 * Dm]);
            for (let k = 1; k <= D.CMP_MAX; k++){
              seq(w + ' gCmpNow ' + L, d.gCmpNow(k), [k]);
              if (k === r || k === Dm) continue;
              const t = d.gCmpWrong(k, Dm);
              seq(w + ' gCmpWrong ' + k + ' ' + L, t, [k, k, 2, 2 * k, Dm]);
              const big = 2 * k > Dm, word = L === 'zh' ? (big ? '大' : '小') : (big ? 'bigger' : 'smaller');
              says(w + ' gCmpWrong ' + k + ' ' + L, t, word);
            }
          });
        });
        need('compass', /if \(k === r\)\{\s*drawCircle\(k, true\);/, 'a wrong opening is accepted (only k === r draws the right circle)');
        need('compass', /roundMiss\(k === D \? d\.gCmpIsD\(D\) : d\.gCmpWrong\(k, D\)\);/, 'a wrong opening has no reason of its own');
        need('compass', /if \(!moved\)\{ gMsg\.textContent = d\.gCmpFirst; return; \}/, '"draw" before moving counts as a mistake (it should only remind)');
        need('compass', /var nk = Math\.round\(\(pt\.x - O\.x\) \/ CMP_PX\);/, 'the opening does not snap to a whole cm');
        need('compass', /if \(nk < 1 \|\| nk > CMP_MAX\) return false;/, 'the opening can go past the ruler');
        need('compass', /label:d\.gCmpPen, axis:'x', onPlace:legs \}\);/, 'the pencil is free to move up and down (it should slide along the ruler)');
        need('compass', /if \(gSolved \|\| pen\.busy\(\)\) return;/, '"draw" works while another finger still holds the pencil');
        need('compass', /if \(pt\.tap && Math\.abs\(pt\.y - O\.y\) > CMP_TAPY\) return false;/, 'a tap anywhere moves the pencil');
        need('compass', /var D = pick\(GAME_COMPASS\), r = D \/ 2, k = CMP_START, moved = false, O = CMP_O;/, 'the compass does not start at CMP_START');
      }

      /* --- 第 5 關：疊標靶（範例 5＋3） --- */
      {
        const O = D.TGT_O, PX = D.TGT_PX;
        let overlapSeen = false;
        const pos = [0, 1, 2, 3].map(k => { const p = D.tgtTrayXY(k), m = { x:W / 2 + (k - 1.5) * D.TGT_TRAY.step, y:D.TGT_TRAY.y }; if (!near(p.x, m.x) || !near(p.y, m.y)) fail('tgtTrayXY(' + k + ') should be ' + JSON.stringify(m)); return sq(m.x, m.y, D.TGT_CARD.w, D.TGT_CARD.h); });
        pos.forEach((o, k) => inside(o, 'target: card ' + k, W, D.TGT_H)); noHits(pos, 'target: cards');
        D.GAME_TARGET.forEach((e, i) => {
          const w = 'GAME_TARGET[' + i + ']', rs = e.rs;
          if (rs.length !== 3 || rs.some(R => !isInt(R) || R < 1)) return fail(w + ': rs should be three whole radii');
          for (let k = 1; k < 3; k++) if (rs[k] - rs[k - 1] < 2) fail(w + ': rings ' + rs[k - 1] + ' and ' + rs[k] + ' are closer than 2 cm');
          if (rs[2] > D.TGT_RULER) fail(w + ': the outer ring (' + rs[2] + ' cm) lies past the ruler (' + D.TGT_RULER + ' cm)');
          const Rmax = rs[2] * PX;
          if (O.x - Rmax < 2 || O.x + D.TGT_RULER * PX + 30 > W || O.y - Rmax < 2) fail(w + ': the rings or the ruler run off the board');
          if (D.TGT_TRAY.y - D.TGT_CARD.h / 2 < O.y + Rmax + D.TGT_BAND + 4) fail(w + ': the card tray reaches the rings\' drop band');
          if (!isInt(e.decoy) || e.decoy % 2) fail(w + ': the extra card ' + e.decoy + ' is odd — its radius is not a whole number');
          if (rs.indexOf(e.decoy / 2) >= 0) fail(w + ': the extra card (diameter ' + e.decoy + ') fits a ring');
          const cards = rs.map(R => 2 * R).concat([e.decoy]);
          if (new Set(cards).size !== 4) fail(w + ': two cards say the same diameter');
          /* 照遊戲的規則：卡片只收進 R × 2 ＝ d 的那一圈；每一圈剛好一張卡，多的那一張哪一圈都不收 → 一定放得完 */
          rs.forEach(R => { const fit = cards.filter(dd => dd === 2 * R); if (fit.length !== 1) fail(w + ': ring ' + R + ' has ' + fit.length + ' cards that fit'); });
          /* 相鄰兩圈的放置帶重疊：放下去的地方要給最近的那一圈（切出來的 nearestRing 和自己的最近比） */
          for (let k = 1; k < 3; k++) if ((rs[k] - rs[k - 1]) * PX < 2 * D.TGT_BAND) overlapSeen = true;
          if (nearestRing){
            const rings = rs.map((R, k) => ({ id:k, R, rp:R * PX, done:false }));
            let bad = 0;
            for (let dd = 0.25; dd <= Rmax + D.TGT_BAND + 6; dd += 0.5){   /* 0.25 起跳：正中間一樣近的點，浮點誤差會讓兩邊各判一次 */
              let mine = null, best = Infinity;
              rings.forEach(g => { const gap = Math.abs(dd - g.rp); if (gap <= D.TGT_BAND && gap < best){ best = gap; mine = g; } });
              const got = nearestRing(rings, O, { x:O.x + dd * Math.cos(2.4), y:O.y - dd * Math.sin(2.4) }, D.TGT_BAND);
              if ((got && got.id) !== (mine && mine.id)) bad++;
            }
            if (bad) fail(w + ': nearestRing(): ' + bad + ' distances are given to the wrong ring (or none)');
            rings[1].done = true;
            /* 中間那一圈放好了；落在它和外圈之間、比較靠近它（也在外圈的帶子裡）的點不可以改給外圈 */
            const off = (rings[2].rp - rings[1].rp) / 2 - 2;
            if (rings[2].rp - rings[1].rp - off > D.TGT_BAND) fail(w + ': the done-ring test point is not inside the outer ring\'s band — it proves nothing');
            if (nearestRing(rings, O, { x:O.x + rings[1].rp + off, y:O.y }, D.TGT_BAND) !== null) fail(w + ': nearestRing(): a drop nearest to a finished ring skips it and lands on the next one');
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let p = 0; p <= 3; p++) seq(w + ' gTgtNow ' + L, d.gTgtNow(p, 3), [p, 3]);
            seq(w + ' gTgtDone ' + L, d.gTgtDone(rs), rs);
            rs.forEach(R => seq(w + ' gTgt2 ' + L, d.gTgt2(R), [2, R, R, 2, 2 * R]));
            cards.forEach(dd => {
              seq(w + ' gTgtCardNum ' + L, d.gTgtCardNum(dd), [dd]);
              rs.forEach(R => { if (dd !== 2 * R) seq(w + ' gTgtNo ' + L, d.gTgtNo(dd, R), [dd, dd, 2, dd / 2, R]); });
            });
          });
        });
        if (!overlapSeen) fail('target: no two rings are close enough for their drop bands to overlap — the nearest-ring rule is never needed (the e2e cannot test it)');
        if (!D.GAME_TARGET.some(e => e.rs.indexOf(e.decoy) >= 0)) fail('target: no entry has the classic mix-up on the extra card (its diameter equals a ring\'s radius)');
        /* 每一題都要碰得到「卡片的數字 ＝ 某一圈的半徑」這個混淆（e2e 的改壞頁「d ＝ R 也收」才抓得到） */
        D.GAME_TARGET.forEach((e, i) => { const cards = e.rs.map(R => 2 * R).concat([e.decoy]); if (!cards.some(dd => e.rs.indexOf(dd) >= 0)) fail('GAME_TARGET[' + i + ']: no card whose number is another ring\'s radius — the commonest mix-up never comes up'); });
        need('target', /var g = nearestRing\(rings, O, pt, TGT_BAND\);/, 'a card is not put on the nearest ring');
        need('target', /if \(P\.data\.d !== g\.R \* 2\)\{ roundMiss\(d\.gTgtNo\(P\.data\.d, g\.R\)\); return false; \}/, 'a card is accepted on the wrong ring');
        need('target', /renderTray\(B, e\.rs\.map\(function\(R\)\{ return R \* 2; \}\)\.concat\(\[e\.decoy\]\), function\(dd, x, y\)\{/, 'the decoy is not in the tray (the cards are not 2R for every ring plus the decoy)');
        need('target', /\}, tgtTrayXY\);/, 'the cards are not laid at tgtTrayXY()');
        need('target', /if \(placed === rings\.length\) roundSolved\(d\.gTgtDone\(e\.rs\)\);/, 'the round is not solved exactly when every ring is filled');
        need('target', /g\.el = sv\(svg, 'circle', \{ cx:O\.x, cy:O\.y, r:g\.rp,/, 'the drawn ring is not at the hit-test radius g.rp');
        need('target', /var tx = O\.x \+ t \* TGT_PX;/, 'the ruler ticks are not every TGT_PX from O');
        need('compass', /x1:cmpTipX\(t\), y1:RU\.y, x2:cmpTipX\(t\)/, 'the ruler ticks are not at cmpTipX(t)');
        need('target', /var rings = e\.rs\.map\(function\(R\)\{ return \{ R:R, rp:R \* TGT_PX, done:false \}; \}\);/, 'the rings are not R × TGT_PX');
      }
    }
  }
};
module.exports._test = { scanEquations, classifySeg };
