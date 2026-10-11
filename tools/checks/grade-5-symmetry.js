/* grade-5/math/symmetry 的檢查設定（對摺魔鏡：線對稱圖形、對稱軸、對稱點與對稱邊）。
   2026-10-10 新增 —— 和小遊戲改成「對摺魔鏡闖關」五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的八個產生器）：每個產生器一組不變條件；正解的第二套實作只查這裡自己的表（對稱軸條數、哪些字線對稱、哪一句是真的），
   不呼叫頁面的 fmt；選項帶單位時 simgen 的通用「誘答抄題幹」比對不到（'3 公分' ≠ '3'），這裡的 renderCheck 另外比數值。

   data（index.html）：
   - 「對稱軸有幾條」的第二套實作 axesRef() 走另一條路：把多邊形寫成「邊長、轉角」交錯的一圈序列，對稱軸 ＝ 這一圈序列的「鏡子中心」
     （頂點或邊的中點，兩邊的序列倒過來一樣），一條軸剛好佔兩個中心。頁面的 symAxes() 是把頂點真的鏡射過去比座標 —— 兩種方法互相驗。
     轉半圈（halfTurnRef）一樣用序列：往後移半圈一模一樣。
   - 範例 2 的六張圖：畫出來的每一條橘色虛線真的是那個圖形的對稱軸（把頂點對那條線鏡射回來還是同一組點），條數和旁邊寫的字一樣；
     平行四邊形那一條紅色虛線**不是**對稱軸，而且那個圖形一條都沒有。範例 1 的愛心左右兩半互為鏡像。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫每一題玩一遍，答案用這裡自己的幾何重算；foldPick／mirPick／sidesPick／paintPick 整片畫板每 1px 和這裡
     自己的「每一個看得到的目標自己一格」比；shuffle()、nearestOpen()、roundMiss()、missOnce()、useTapSelect() 從原始碼切出來真的跑；
     托盤 3000 次不會一開始就分好；版面、不出界、不重疊、標籤離線 ≥ 2px、375px 觸控 ≥ 44px 從資料區讀；
     每一句說明兩種語言逐個比數字、比意思（必須說／不可以說，子字串比對）。
   刻意的 44px 例外：摺一摺的「點一條虛線」—— 線本身很細，點擊範圍是「離中心 rc 以外、垂直距離最近的那一條、tol 以內」，
   每一條線自己一塊扇形（離中心愈遠愈寬）；中心附近每一條線都經過，點下去什麼都不做（不算錯）。拿得起來的東西都 ≥ 44px。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、文字放不放得進框、
   375px 的實際尺寸由 teaching-workspace/game-harness/g5-symmetry 的端對端測試驗（合成 PointerEvent，從畫出來的圖讀數）。
   意思的清單是子字串比對：證明那幾個詞在，證明不了整句話的語氣。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const arith = makeArith({ units:['公分', '度', '格', '條'], unitsEn:['cm', 'squares?', 'axes', 'axis'] });
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const EPS = 1e-6;

/* ---------- 第二套幾何 ---------- */
const P2 = p => Array.isArray(p) ? { x:p[0], y:p[1] } : p;
/* 「邊長、轉角」交錯的一圈序列：位置 2i 是頂點 i 的轉角（有正負，凹進去的角是負的），位置 2i + 1 是頂點 i 到 i + 1 的邊長 */
function seqRef(pts){
  const P = pts.map(P2), n = P.length, out = [];
  for (let i = 0; i < n; i++){
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    const u = { x:b.x - a.x, y:b.y - a.y }, v = { x:c.x - b.x, y:c.y - b.y };
    out.push(Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y));
    out.push(Math.hypot(c.x - b.x, c.y - b.y));
  }
  return out;
}
/* 對稱軸的條數：序列以位置 c 為中心，往兩邊讀一模一樣 ＝ 一個鏡子中心；一條軸佔兩個中心 */
function axesRef(pts){
  const S = seqRef(pts), m = S.length;
  let centers = 0;
  for (let c = 0; c < m; c++){
    let ok = true;
    for (let k = 1; k <= m / 2 && ok; k++) if (Math.abs(S[(c + k) % m] - S[(c - k + m) % m]) > EPS) ok = false;
    if (ok) centers++;
  }
  return centers / 2;
}
/* 轉半圈：序列往後移半圈一模一樣 */
function halfTurnRef(pts){
  const S = seqRef(pts), m = S.length;
  if (m % 4) return false;
  return S.every((v, i) => Math.abs(v - S[(i + m / 2) % m]) < EPS);
}
/* 點對直線 ab 的鏡射（另一種寫法：投影向量） */
function mirrorRef(p, a, b){
  p = P2(p); a = P2(a); b = P2(b);
  const L = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
  const wx = p.x - a.x, wy = p.y - a.y, t = wx * ux + wy * uy;
  return { x:a.x + 2 * t * ux - wx, y:a.y + 2 * t * uy - wy };
}
function sameSetRef(P, Q, tol){
  P = P.map(P2); Q = Q.map(P2);
  if (P.length !== Q.length) return false;
  const used = Q.map(() => false);
  return P.every(p => { for (let j = 0; j < Q.length; j++) if (!used[j] && Math.hypot(p.x - Q[j].x, p.y - Q[j].y) <= tol){ used[j] = true; return true; } return false; });
}
const segDistRef = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const rectPtRef = (p, r) => Math.hypot(Math.max(r.x - p.x, 0, p.x - (r.x + r.w)), Math.max(r.y - p.y, 0, p.y - (r.y + r.h)));
/* 方框到線段的距離：在方框邊上與線段上各取很密的點（0.25px）比最短距離 —— 慢但和頁面的算法無關 */
function rectSegRef(r, a, b){
  const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(L / 0.25));
  let best = Infinity;
  for (let i = 0; i <= n; i++){ const p = { x:a.x + (b.x - a.x) * i / n, y:a.y + (b.y - a.y) * i / n }; best = Math.min(best, rectPtRef(p, r)); }
  return best;
}
const boxHit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 1e-9 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 1e-9;

/* ---------- review.html 的參考答案（這裡自己的表） ---------- */
const AXIS_REF = { iso:1, equi:3, square:4, rect:2, rhombus:2, isoTrap:1, pentagon:5, hexagon:6, circle:'inf', parallelo:0, scalene:0, generalTrap:0, generalQuad:0 };
const NAME_REF = {
  iso:['等腰三角形', 'Isosceles triangle'], equi:['正三角形', 'Equilateral triangle'], square:['正方形', 'Square'], rect:['長方形', 'Rectangle'],
  rhombus:['菱形', 'Rhombus'], isoTrap:['等腰梯形', 'Isosceles trapezoid'], pentagon:['正五邊形', 'Regular pentagon'], hexagon:['正六邊形', 'Regular hexagon'],
  circle:['圓', 'Circle'], parallelo:['一般平行四邊形', 'General parallelogram'], scalene:['不等邊三角形', 'Scalene triangle'],
  generalTrap:['一般梯形（不是等腰的）', 'General trapezoid (not isosceles)'], generalQuad:['一般四邊形（四邊不特別）', 'General (irregular) quadrilateral']
};
const SYM_REF = 'AHMOTUVWX王田中口日'.split(''), NOTSYM_REF = 'FGJLNPQRSZ'.split('');
const TRUE_REF = ['正方形有 4 條對稱軸。', '圓有無數條對稱軸。', '等腰三角形只有 1 條對稱軸。', '菱形的對稱軸就是它的兩條對角線。', '一般平行四邊形沒有對稱軸。'];
const FALSE_REF = ['長方形有 4 條對稱軸，跟正方形一樣。', '一般平行四邊形有 2 條對稱軸。', '長方形的對角線是對稱軸。', '所有四邊形都有對稱軸。', '正三角形只有 1 條對稱軸，跟等腰三角形一樣。', '圓只有 4 條對稱軸。'];
const countRef = (c, lang) => c === 'inf' ? (lang === 'zh' ? '無數條' : 'Infinitely many') : (lang === 'zh' ? c + ' 條' : String(c));
const keyOfName = (name, lang) => Object.keys(NAME_REF).filter(k => NAME_REF[k][lang === 'zh' ? 0 : 1] === name)[0];

module.exports = {
  breaks: [
    /* ---- 第二套幾何自己（axesRef／halfTurnRef 的探針在 data.check 開頭；這幾筆改頁面的幾何） ---- */
    { file:'index', expect:'symAxes() finds', find:"      [p, { x:(p.x + q.x) / 2, y:(p.y + q.y) / 2 }].forEach(function(m){", replace:"      [p].forEach(function(m){" },
    { file:'index', expect:'symAxes() finds', find:"    for (var s = 0; s < n; s++) for (var dir = -1; dir <= 1; dir += 2){", replace:"    for (var s = 0; s < n; s++) for (var dir = 1; dir <= 1; dir += 2){" },
    { file:'index', expect:'halfTurn() disagrees', find:"    return sameCycle(pts, pts.map(function(p){ p = P2(p); return { x:2 * c.x - p.x, y:2 * c.y - p.y }; }));", replace:"    return sameCycle(pts, pts.map(function(p){ p = P2(p); return { x:2 * c.x - p.x, y:p.y }; }));" },

    /* ---- 引擎與計分 ---- */
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['sort', 'fold', 'mirror', 'sides', 'paint'];", replace:"var GAME_ORDER = ['fold', 'sort', 'mirror', 'sides', 'paint'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'shuffle(): only', find:'      var k = Math.floor(Math.random() * (j + 1));   /* 自足', replace:'      var k = j;   /* 自足' },
    { file:'index', expect:'scoring: a round should give', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'at 0 points nothing is taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'missOnce(): wrong a, b, a, b, b', find:'    if (seen[key]){ roundAgain(text); return; }', replace:'    if (seen[key] && false){ roundAgain(text); return; }' },
    { file:'index', expect:'missOnce(): a repeated mistake should show its reason', find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){}" },
    { file:'index', expect:'the hint is not cleared', find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:'index', expect:'nearestOpen(): a point inside B', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'nearestOpen(): a point inside B', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'a drop nearest to a finished box', find:"    return best && !best.done ? best : null;\n  }\n\n  function roundSolved", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  function roundSolved" },
    { file:'index', expect:'board generation guard missing', find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:'' },
    { file:'index', expect:'second finger can pick up', find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:'index', expect:'a press that slides before letting go counts as a board tap', find:"      if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;", replace:"" },
    { file:'index', expect:'second finger can start a board tap', find:"      if (!e.isPrimary) return;   /* 第二根手指：不理 */", replace:"      if (false) return;   /* 第二根手指：不理 */" },
    { file:'index', expect:'losing pointer capture', find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:'' },
    { file:'index', expect:'placed pieces still catch taps', find:'  .gpiece.locked{cursor:default;pointer-events:none}', replace:'  .gpiece.locked{cursor:default}' },
    { file:'index', expect:'pieces need touch-action', find:'    touch-action:none;cursor:grab;user-select:none;', replace:'    cursor:grab;user-select:none;' },
    { file:'index', expect:'the board drawing must not catch taps', find:'  .gsvg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}', replace:'  .gsvg{position:absolute;left:0;top:0;overflow:visible}' },
    { file:'index', expect:'ahead mode', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"    if (mode === 'school'){ hintLevel = 1; showHint(); }" },
    { file:'index', expect:'re-tapping a kept card', find:"      if (B.selected === P && B.kept === P){ B.kept = null; return; }\n", replace:'' },
    { file:'index', expect:'board generation is not bumped', find:'    gSolved = false; gMistake = false; gCtx = {}; gGen++; BOARD_TAP = null; PIECE_PTR = {};', replace:'    gSolved = false; gMistake = false; gCtx = {}; BOARD_TAP = null; PIECE_PTR = {};' },
    { file:'index', expect:'the stage is not cleared', find:"    gameStage.textContent = '';\n    var ask", replace:"    var ask" },

    /* ---- 第 1 關：分一分 ---- */
    { file:'index', expect:'SORT_SYM / SORT_NOT are not what their names say', find:'    kiteD:[[0, 0], [3, 1], [5, 5], [1, 3]],', replace:'    kiteD:[[0, 0], [3, 1], [5, 5], [1, 4]],' },
    { file:'index', expect:'one tilt shape must have only slanted axes', find:"var SORT_SYM = ['house', 'isoTrap', 'tee', 'arrow', 'rhombus', 'cross', 'kite', 'kiteD'], SORT_TILT = ['arrow', 'kiteD'];", replace:"var SORT_SYM = ['house', 'isoTrap', 'tee', 'arrow', 'rhombus', 'cross', 'kite', 'kiteD'], SORT_TILT = ['arrow'];" },
    { file:'index', expect:'must be non-symmetric but come back after a half turn', find:"SORT_TRAP = ['parallelo', 'zee'];", replace:"SORT_TRAP = ['parallelo', 'ell'];" },
    { file:'index', expect:'sortRefuse(', find:"return s === (bin === 'yes') ? null : (s ? 'isSym' : 'notSym'); }", replace:"return s === (bin === 'yes') ? null : (s ? 'notSym' : 'isSym'); }" },
    { file:'index', expect:'the explained axis should be', find:"    var best = ax.filter(function(d){ return axisKind(d) === 'v'; })[0];", replace:"    var best;" },
    { file:'index', expect:'a deal lacks the tilted axis or the half-turn trap', find:'    var s = [pick(SORT_TILT)], n = [pick(SORT_TRAP)];', replace:'    var s = [], n = [];' },
    { file:'index', expect:'start with a row that is all one kind', find:'    if (sortInOrder(t)){ var x = t[2]; t[2] = t[3]; t[3] = x; }', replace:'    if (sortInOrder(t)){ var x = t[0]; t[0] = t[1]; t[1] = x; }' },
    { file:'index', expect:'sort tray cards', find:'trayX:[52, 150, 248], trayY:[50, 144],', replace:'trayX:[52, 150, 248], trayY:[50, 120],' },
    { file:'index', expect:'box label (15px', find:'binW:142, binH:110, lblH:42,', replace:'binW:142, binH:110, lblH:30,' },
    { file:'index', expect:'mini card', find:'return SORT.binX[i] + (SORT.binW - 3 * SORT.miniW - 12) / 2 + n * (SORT.miniW + 6) + SORT.miniW / 2; }', replace:'return SORT.binX[i] + (SORT.binW - 3 * SORT.miniW - 12) / 2 + n * (SORT.miniW + 16) + SORT.miniW / 2; }' },
    { file:'index', expect:'not drawn at', find:"    return pts.map(function(p){ return { x:ox + p.x * U, y:oy - p.y * U }; });", replace:"    return pts.map(function(p){ return { x:ox + p.x * U, y:oy - p.y * U * 0.9 }; });" },
    { file:'index', expect:'the axis drawn after a mistake is not an axis', find:"    var pts = sortCardPts(k, W, H, U), c = vcenter(pts), r = deg * Math.PI / 180;", replace:"    var pts = sortCardPts(k, W, H, U), c = vcenter(pts), r = (deg + 90) * Math.PI / 180;" },
    { file:'index', expect:'sort: the card judged', find:"        var k = P.data.k, why = sortRefuse(k, bin.v), name = d.gNames[k];", replace:"        var k = P.data.k, why = sortRefuse(k, 'yes'), name = d.gNames[k];" },
    { file:'index', expect:'not charged once per card and box', find:"missOnce(seen, k + '>' + bin.v, why === 'isSym'", replace:"missOnce(seen, k, why === 'isSym'" },
    { file:'index', expect:'the box is not chosen by nearestOpen()', find:"        var bin = nearestOpen(bins, pt, SORT.pad) || (pt.finger ? nearestOpen(bins, pt.finger, SORT.pad) : null);", replace:"        var bin = nearestOpen(bins, pt, SORT.pad);" },
    { file:'index', expect:'must not say "轉半圈"', find:"return name + '：不管沿著哪一條線對摺，兩邊都對不齊 —— 它沒有對稱軸。' + (half ? '轉半圈會和原來一樣，可是轉不是對摺。' : ''); },", replace:"return name + '：不管沿著哪一條線對摺，兩邊都對不齊 —— 它沒有對稱軸。' + '轉半圈會和原來一樣，可是轉不是對摺。'; }," },
    { file:'index', expect:'must say "turning is not folding"', find:"(half ? ' A half turn brings it back to itself, but turning is not folding.' : ''); },", replace:"''; }," },
    { file:'index', expect:'must say "斜的"', find:"'：沿著' + { v:'直的', h:'橫的', d:'斜的' }[kind] + '那一條線", replace:"'：沿著' + { v:'直的', h:'橫的', d:'直的' }[kind] + '那一條線" },
    { file:'index', expect:'put it in “Not line-symmetric”', find:"' never lines up, whichever way you fold it — put it in “Not line-symmetric”.'", replace:"' never lines up, whichever way you fold it — put it in “Line-symmetric”.'" },

    /* ---- 第 2 關：摺一摺 ---- */
    { file:'index', expect:'every axis must be offered', find:"    { k:'square', pts:[[-2, -2], [2, -2], [2, 2], [-2, 2]], dirs:[[1, 0], [0, 1], [1, 1], [1, -1]] },", replace:"    { k:'square', pts:[[-2, -2], [2, -2], [2, 2], [-2, 2]], dirs:[[1, 0], [0, 1], [1, 1], [2, 1]] }," },
    { file:'index', expect:'no shape in the pool with 6 axes', find:"    { k:'hexagon', pts:[[3, 0], [1.5, 1.5 * R3], [-1.5, 1.5 * R3], [-3, 0], [-1.5, -1.5 * R3], [1.5, -1.5 * R3]],\n      dirs:[[1, 0], [R3, 1], [1, R3], [0, 1], [-1, R3], [-R3, 1]] },\n", replace:'' },
    { file:'index', expect:'foldIsAxis(', find:"  function foldIsAxis(e, i){ return isAxis(e.pts, [0, 0], e.dirs[i]); }", replace:"  function foldIsAxis(e, i){ return isAxis(e.pts, [0, 0], e.dirs[i]) || i === 0; }" },
    { file:'index', expect:'foldGhost(', find:"var q = reflectPt(p, [0, 0], e.dirs[i]); return foldPt(q.x, q.y); }); }", replace:"var q = reflectPt(p, [0, 0], [0, 1]); return foldPt(q.x, q.y); }); }" },
    { file:'index', expect:'foldPick(', find:"      if (perp < bd){ bd = perp; best = i; }", replace:"      if (perp <= FOLD.tol && best === null){ bd = perp; best = i; }" },
    { file:'index', expect:'foldPick(', find:"    if (Math.hypot(dx, dy) < FOLD.rc) return null;\n", replace:'' },
    { file:'index', expect:'a tap on line', find:'tol:18, rc:22 }, FOLD_H = 300;', replace:'tol:5, rc:22 }, FOLD_H = 300;' },
    { file:'index', expect:'runs off the board', find:'var FOLD = { U:30, cx:150, cy:150, ext:16,', replace:'var FOLD = { U:30, cx:150, cy:150, ext:40,' },
    { file:'index', expect:'does not reach past the shape', find:'var FOLD = { U:30, cx:150, cy:150, ext:16,', replace:'var FOLD = { U:30, cx:150, cy:150, ext:4,' },
    { file:'index', expect:'foldDone(', find:"  function foldDone(e, found){ return found === foldAxes(e) ? null : 'more'; }", replace:"  function foldDone(e, found){ return found >= foldAxes(e) - 1 ? null : 'more'; }" },
    { file:'index', expect:'an axis already found can be counted again', find:"          if (state[i] === 1) return;\n", replace:'' },
    { file:'index', expect:'a wrong line is not charged once per line', find:"        missOnce(seen, 'line' + i, d.gFoldNo);", replace:"        roundMiss(d.gFoldNo);" },
    { file:'index', expect:'"That’s all" is not judged with foldDone()', find:"        if (foldDone(e, found)){ missOnce(seen, 'done' + found, d.gFoldMore(name, found)); return; }", replace:"        if (foldDone(e, found)){ roundMiss(d.gFoldMore(name, found)); return; }" },
    { file:'index', expect:'must say "不只 ', find:"name + '的對稱軸不只 ' + k + ' 條')", replace:"name + '的對稱軸不只 ' + (k + 1) + ' 條')" },
    { file:'index', expect:'gFoldDone', find:"name + '有 ' + n + ' 條對稱軸。'; },", replace:"name + '有 ' + (n + 1) + ' 條對稱軸。'; }," },
    { file:'index', expect:'gFold2', find:"name + '一共有 ' + n + ' 條對稱軸，你找到 ' + k + ' 條。'); },", replace:"name + '一共有 ' + k + ' 條對稱軸，你找到 ' + n + ' 條。'); }," },
    { file:'index', expect:'gFoldNow en: 1 axis (singular)', find:"gFoldNow: function(k){ return k + (k === 1 ? ' axis' : ' axes') + ' of symmetry found'; },", replace:"gFoldNow: function(k){ return k + ' axes of symmetry found'; }," },

    /* ---- 第 3 關：找對稱點 ---- */
    { file:'index', expect:'mirRefuse(', find:"    if (!same) return { why:'row', d:d, got:got };\n", replace:'' },
    { file:'index', expect:'mirRefuse(', find:"    if (got <= 0) return { why:'side', d:d, got:Math.abs(got) };", replace:"    if (got < 0) return { why:'side', d:d, got:Math.abs(got) };" },
    { file:'index', expect:'mirPick(', find:"var cx = Math.max(0, Math.min(R.x1 - R.x0, Math.round(fx))), cy", replace:"var cx = Math.max(0, Math.min(R.x1 - R.x0, Math.floor(fx))), cy" },
    { file:'index', expect:'mirPick(', find:"    if (fx < -0.5 || fx > R.x1 - R.x0 + 0.5 || fy < -0.5 || fy > R.y1 - R.y0 + 0.5) return null;\n", replace:'' },
    { file:'index', expect:'on one line', find:"{ ax:'v', pts:[[-3, 4], [-1, 2], [-2, 0]] },", replace:"{ ax:'v', pts:[[-3, 4], [-2, 3], [-1, 2]] }," },
    { file:'index', expect:'image of point', find:"{ ax:'h', pts:[[0, 3], [2, 1], [4, 2]] },", replace:"{ ax:'h', pts:[[0, 3], [2, 1], [5, 2]] }," },
    { file:'index', expect:'needs both a vertical and a horizontal fold line', find:"{ ax:'h', pts:[[0, 3], [2, 1], [4, 2]] }, { ax:'h', pts:[[1, 1], [4, 3], [0, 2]] }, { ax:'h', pts:[[3, 3], [0, 1], [4, 1]] }", replace:"{ ax:'v', pts:[[-1, 3], [-2, 1], [-3, 2]] }" },
    { file:'index', expect:'waits on the grid', find:'pinY:{ v:288, h:350 }', replace:'pinY:{ v:230, h:350 }' },
    { file:'index', expect:'under 44', find:'var MIR = { U:46, pinW:46,', replace:'var MIR = { U:42, pinW:46,' },
    { file:'index', expect:'under 2px from a side of the triangle', find:"        if (strokes.some(function(s){ return rectSegDist(r, s[0], s[1]) < 2 + LBL_CLEAR; })) continue;\n", replace:'' },
    { file:'index', expect:'an occupied dot is not refused silently', find:"        if (!c || taken(c)) return false;", replace:"        if (!c) return false;" },
    { file:'index', expect:'the pin does not snap', find:"var snap = function(cx, cy){ var c = mirPick(ax, { x:cx, y:cy }); return c ? mirPt(ax, c[0], c[1]) : null; };", replace:"var snap = function(cx, cy){ return null; };" },
    { file:'index', expect:'the pin judged is not the one dropped', find:"        var i = P.data.i, Lt = MIR_LETTERS[i], bad = mirRefuse(e, i, c);", replace:"        var i = P.data.i, Lt = MIR_LETTERS[i], bad = mirRefuse(e, 0, c);" },
    { file:'index', expect:'gMirDist', find:"Lt + '′ 也要離摺線 ' + dd + ' 格（這裡離摺線 ' + got + ' 格）。'; },", replace:"Lt + '′ 也要離摺線 ' + got + ' 格（這裡離摺線 ' + dd + ' 格）。'; }," },
    { file:'index', expect:'must say "same column"', find:"return Lt + '′ must be on the same ' + (ax === 'v' ? 'row' : 'column') + ' as ' + Lt", replace:"return Lt + '′ must be on the same ' + 'row' + ' as ' + Lt" },
    { file:'index', expect:'gMir* en: "1 squares"', find:"return 'Hint 2: ' + Lt + ' is ' + dd + (dd === 1 ? ' square' : ' squares') + ' from the fold → put '", replace:"return 'Hint 2: ' + Lt + ' is ' + dd + ' squares' + ' from the fold → put '" },

    /* ---- 第 4 關：對稱邊 ---- */
    { file:'index', expect:'sidesPartner(', find:"      if ((same(fa, c) && same(fb, d)) || (same(fa, d) && same(fb, c))) return j;", replace:"      if ((same(fa, c) && same(fb, d)) || (same(fa, d) && same(fb, c))) return j === i ? j : i;" },
    { file:'index', expect:'sidesRefuse(', find:"  function sidesRefuse(e, i, v){ var p = sidesPartner(e, i); return v === sidesLen(e, p) ? null : sidesLen(e, p); }", replace:"  function sidesRefuse(e, i, v){ var p = sidesPartner(e, i); return v >= sidesLen(e, p) ? null : sidesLen(e, p); }" },
    { file:'index', expect:'is not labelled', find:"{ ax:'v', pts:[[-3, 0], [3, 0], [3, 4], [0, 8], [-3, 4]], give:[0, 4, 2], ask:[1, 3], cards:[4, 5, 6] },", replace:"{ ax:'v', pts:[[-3, 0], [3, 0], [3, 4], [0, 8], [-3, 4]], give:[0, 4, 1], ask:[2, 3], cards:[4, 5, 6] }," },
    { file:'index', expect:'is a length that is not on the picture', find:"give:[0, 1, 3], ask:[4, 2], cards:[3, 5, 8] },", replace:"give:[0, 1, 3], ask:[4, 2], cards:[3, 5, 7] }," },
    { file:'index', expect:'is not symmetric about its axis', find:"{ ax:'v', pts:[[-6, 0], [0, 0], [6, 0], [3, 4], [0, 4], [-3, 4]],", replace:"{ ax:'v', pts:[[-6, 0], [0, 0], [6, 0], [3, 4], [0, 4], [-2, 4]]," },
    { file:'index', expect:'padded zone covers label', find:'slotW:46, slotH:40, gap:6, pad:10, tol:14,', replace:'slotW:46, slotH:40, gap:6, pad:40, tol:14,' },
    { file:'index', expect:'sidesPick(', find:"    return blocked ? null : best;", replace:"    return best;" },
    { file:'index', expect:'a natural drop on slot', find:'slotW:46, slotH:40, gap:6, pad:10, tol:14,', replace:'slotW:46, slotH:40, gap:6, pad:10, tol:-1,' },
    { file:'index', expect:'sits closer to another side', find:"    var sg = A2 > 0 ? 1 : -1;", replace:"    var sg = A2 > 0 ? -1 : 1;" },
    { file:'index', expect:'under 2px from the axis', find:"      if (Math.abs(d) >= need) return c;", replace:"      if (true) return c;" },
    { file:'index', expect:'under 2px from the axis', find:"        c = { x:c.x + Math.abs(ux) * sh, y:c.y + Math.abs(uy) * sh };", replace:"        c = { x:c.x, y:c.y };" },
    { file:'index', expect:'not drawn at', find:"    var px = function(p){ return { x:ox + p[0] * s, y:oy - p[1] * s }; };", replace:"    var px = function(p){ return { x:ox + p[0] * s, y:oy - p[1] * s * 1.1 }; };" },
    { file:'index', expect:'does not stay selected', find:"          if (pt.tap) keepSelected(B, P);", replace:"          void pt;" },
    { file:'index', expect:'charged once per slot and number', find:"          missOnce(seen, sl.i + '=' + v, d.gSidesBad(bad, v));", replace:"          missOnce(seen, sl.i, d.gSidesBad(bad, v));" },
    { file:'index', expect:'the card judged is not the one dropped', find:"        var sl = slots[j], v = P.data.v, bad = sidesRefuse(e, sl.i, v);", replace:"        var sl = slots[j], v = P.data.v, bad = sidesRefuse(e, slots[0].i, v);" },
    { file:'index', expect:'gSidesBad', find:"'這一邊對摺後會和標著 ' + p + ' 的那一邊（發亮的那一條）疊在一起 —— 對稱邊一樣長，所以不是 ' + v + '。'", replace:"'這一邊對摺後會和標著 ' + v + ' 的那一邊（發亮的那一條）疊在一起 —— 對稱邊一樣長，所以不是 ' + p + '。'" },
    { file:'index', expect:'hint 2 is not refreshed after a mistake', find:"          missOnce(seen, sl.i + '=' + v, d.gSidesBad(bad, v));\n          refreshHint();", replace:"          missOnce(seen, sl.i + '=' + v, d.gSidesBad(bad, v));" },
    { file:'index', expect:'hint 2 does not follow the box just tried', find:"          focus = sl;\n", replace:'' },
    { file:'index', expect:'must say "highlighted box"', find:"lands on the side next to the highlighted box.'; },", replace:"lands on the side next to the next empty box.'; }," },
    { file:'index', expect:'a filled slot is not refused silently', find:"        if (j === null || slots[j].done) return false;", replace:"        if (j === null) return false;" },

    /* ---- 第 5 關：剪紙展開 ---- */
    { file:'index', expect:'paintCheck: wrong first mismatch', find:"    for (var k = 0; k <= 4; k++) for (var d = 1; d <= 3; d++){\n      var key = paintKey([d, k])", replace:"    for (var k = 0; k <= 4; k++) for (var d = 3; d >= 1; d--){\n      var key = paintKey([d, k])" },
    { file:'index', expect:'paintCheck: extra cell accepted', find:"      if (b && !a) return { kind:'extra', d:d, k:k };\n", replace:'' },
    { file:'index', expect:'while dragging, the piece is not placed where snap() says', find:"      if (s) P.place(s.x, s.y); else P.place(nx, ny);", replace:"      P.place(nx, ny);" },
    { file:'index', expect:'release does not judge the shown (snapped) centre', find:"      if (!(B.onDrop && B.onDrop(P, { x:P.cx, y:P.cy, finger:{ x:f.x, y:f.y } }))) P.home();", replace:"      if (!(B.onDrop && B.onDrop(P, { x:f.x, y:f.y, finger:{ x:f.x, y:f.y } }))) P.home();" },
    { file:'index', expect:'every shape is in exactly one list', find:"var SORT_SYM = ['house', 'isoTrap', 'tee', 'arrow', 'rhombus', 'cross', 'kite', 'kiteD'],", replace:"var SORT_SYM = ['house', 'isoTrap', 'tee', 'arrow', 'rhombus', 'cross', 'house', 'kiteD']," },
    { file:'index', expect:'foldDone(', find:"  function foldDone(e, found){ return found === foldAxes(e) ? null : 'more'; }", replace:"  function foldDone(e, found){ return found === foldAxes(e) || found === 2 ? null : 'more'; }" },
    { file:'index', expect:'copying across (not flipping) is accepted', find:"{ ax:'v', cut:[[1, 0], [1, 1], [2, 1], [1, 2], [2, 2], [3, 2], [1, 3], [1, 4]] },", replace:"{ ax:'v', cut:[[2, 0], [1, 1], [3, 1], [2, 2], [1, 3], [3, 3], [2, 4]] }," },
    { file:'index', expect:'has nothing cut', find:"{ ax:'h', cut:[[3, 0], [2, 1], [1, 2], [2, 2], [3, 2], [1, 4], [2, 4], [2, 3]] }", replace:"{ ax:'h', cut:[[3, 0], [2, 1], [1, 2], [2, 2], [3, 2], [1, 4], [2, 4]] }" },
    { file:'index', expect:'paintPick(', find:"    if (ax === 'v'){ d = Math.floor((pt.x - PAINT.axis.v) / U) + 1; k = Math.floor((pt.y - 8) / U); }", replace:"    if (ax === 'v'){ d = Math.round((pt.x - PAINT.axis.v) / U) + 1; k = Math.floor((pt.y - 8) / U); }" },
    { file:'index', expect:'from the fold on each side', find:"    var y = side === 0 ? PAINT.axis.h - d * U : PAINT.axis.h + (d - 1) * U;", replace:"    var y = side === 0 ? PAINT.axis.h - d * U : PAINT.axis.h + d * U - U / 2;" },
    { file:'index', expect:'under 44', find:'  var PAINT = { U:46, axis:', replace:'  var PAINT = { U:44, axis:' },
    { file:'index', expect:'nothing painted is not a free reminder', find:"        if (!count){ roundNote(d.gPaintEmpty); return; }", replace:"        if (!count){ roundMiss(d.gPaintEmpty); return; }" },
    { file:'index', expect:'the same picture is not recognised as the same mistake', find:"          var stateKey = Object.keys(painted).sort().join(';');", replace:"          var stateKey = Object.keys(painted).join(';') + count;" },
    { file:'index', expect:'gPaintMiss', find:"? '第 ' + k + ' 橫列：左邊離摺線 ' + dd + ' 格的那一格剪掉了，右邊離摺線 ' + dd + ' 格的那一格也會被剪掉（紅框）。'", replace:"? '第 ' + k + ' 橫列：左邊離摺線 ' + dd + ' 格的那一格剪掉了，右邊離摺線 ' + (4 - dd) + ' 格的那一格也會被剪掉（紅框）。'" },
    { file:'index', expect:'must say "is not cut"', find:"' from the fold on top is not cut — unfolded, they would not match.'", replace:"' from the fold on top is cut — unfolded, they would not match.'" },
    { file:'index', expect:'gPaint2', find:"'剪了離摺線 ' + ds.join('、') + ' 格的格子，' + w[2] + '也只塗離摺線 ' + ds.join('、') + ' 格的格子。'", replace:"'剪了離摺線 ' + ds.join('、') + ' 格的格子，' + w[2] + '也只塗離摺線 ' + ds.map(function(x){ return 4 - x; }).join('、') + ' 格的格子。'" },

    /* ---- 開場白、備用字 ---- */
    { file:'index', expect:'the markup fallback is not the same', find:'<p class="lead" data-i18n="s5lead">分一分、摺一摺', replace:'<p class="lead" data-i18n="s5lead">分一分，摺一摺' },
    { file:'index', expect:'must say "五關五種玩法"', find:"      s5lead: '分一分、摺一摺、找對稱點、量對稱邊、剪紙展開 —— 五關五種玩法，", replace:"      s5lead: '分一分、摺一摺、找對稱點、量對稱邊、剪紙展開 —— 五關，" },

    /* ---- 範例 ---- */
    { file:'index', expect:'EXAMPLE 2 equi', find:"        shape = '<polygon points=\"100,28.364139 176,160 24,160\"", replace:"        shape = '<polygon points=\"100,25 176,160 24,160\"" },
    { file:'index', expect:'EXAMPLE 2 equi: the sides are', find:"        shape = '<polygon points=\"100,28.364139 176,160 24,160\"", replace:"        shape = '<polygon points=\"100,28.4 176,160 24,160\"" },
    { file:'index', expect:'EXAMPLE 2 rect', find:"                '<line x1=\"15\" y1=\"100\" x2=\"185\" y2=\"100\" stroke=\"' + AX + '\" stroke-width=\"3\" stroke-dasharray=\"6 5\"/>';", replace:"                '<line x1=\"15\" y1=\"100\" x2=\"185\" y2=\"100\" stroke=\"' + AX + '\" stroke-width=\"3\" stroke-dasharray=\"6 5\"/>' +\n                '<line x1=\"30\" y1=\"70\" x2=\"170\" y2=\"130\" stroke=\"' + AX + '\" stroke-width=\"3\" stroke-dasharray=\"6 5\"/>';" },
    { file:'index', expect:'EXAMPLE 2 parallelo', find:"      axisCounts: { iso:'1 條', equi:'3 條', square:'4 條', rect:'2 條', circle:'無數條', parallelo:'0 條' },", replace:"      axisCounts: { iso:'1 條', equi:'3 條', square:'4 條', rect:'2 條', circle:'無數條', parallelo:'2 條' }," },
    { file:'index', expect:'EXAMPLE 1', find:'<path d="M200,90 C230,45 280,45 310,90', replace:'<path d="M200,90 C230,45 280,45 314,90' },
    { file:'index', expect:'is wrong', find:"兩點合起來相距 3 + 3 = 6 公分。' },", replace:"兩點合起來相距 3 + 3 = 7 公分。' }," },

    /* ---- review.html ---- */
    { file:'review', expect:'axisCount: the explanation should say', find:"(entry.count === 'inf' ? 'infinitely many axes' : entry.count + (entry.count === 1 ? ' axis' : ' axes')) + ' of symmetry.'", replace:"countLabel(entry.count, 'en') + ' axes of symmetry.'" },
    { file:'review', expect:'axisCount: the explanation should say', find:"? entry.zh + '有' + (entry.count === 'inf' ? '無數條' : ' ' + entry.count + ' 條') + '對稱軸。'", replace:"? entry.zh + '有 ' + countLabel(entry.count, 'zh') + '對稱軸。'" },
    { file:'review', expect:'copies a number from the stem', find:"function(k){ return c + 20 + k * 5; }, [a, b]);", replace:"function(k){ return c + 20 + k * 5; });" },
    { file:'review', expect:'copies a number from the stem', find:"var wrongs = uniqWrongs(d4, [a + b + c, d4 + 10, d4 - 10 >= 5 ? d4 - 10 : null], function(k){ return d4 + 20 + k * 5; }, [a, b, c]);", replace:"var wrongs = uniqWrongs(d4, [a, d4 + 10, Math.max(1, d4 - 10)], function(k){ return d4 + 20 + k * 5; });" },
    { file:'review', expect:'missing space between Chinese', find:"        var unit = lang === 'zh' ? ' 度' : '°';\n        return {\n          stem: lang === 'zh'\n            ? '三角形", replace:"        var unit = lang === 'zh' ? '度' : '°';\n        return {\n          stem: lang === 'zh'\n            ? '三角形" },
    { file:'review', expect:'letterSymYes: a distractor is line-symmetric', find:"  var NOTSYM_CHARS = ['F','G','J','L','N','P','Q','R','S','Z'];", replace:"  var NOTSYM_CHARS = ['F','G','J','L','N','P','Q','R','S','Z','A'];" },
    { file:'review', expect:'axisCount: the keyed count', find:"{ key:'rect',        count:2,", replace:"{ key:'rect',        count:4," },
    { file:'review', expect:'statementJudge:', find:"    { zh:'圓只有 4 條對稱軸。', en:'A circle has only 4 axes of symmetry.' }", replace:"    { zh:'圓有無數條對稱軸。', en:'A circle has infinitely many axes of symmetry.' }" },
    { file:'review', expect:'pointDistance: the key is not 2 ×', find:"        var correct = dist * 2;", replace:"        var correct = dist * 2 + 2;" },
    { file:'review', expect:'shapeNoAxis: ', find:"        var zeroKeys = AXIS_POOL.filter(function(p){ return p.count === 0; })", replace:"        var zeroKeys = AXIS_POOL.filter(function(p){ return p.count === 0 || p.key === 'iso'; })" }
  ],

  sim: {
    INVARIANTS: {
      axisCount: d => {
        if (!(d.key in AXIS_REF)) return 'axisCount: unknown shape ' + d.key;
        if (d.opts[d.ans] !== AXIS_REF[d.key]) return 'axisCount: the keyed count ' + d.opts[d.ans] + ' is not ' + AXIS_REF[d.key] + ' for ' + d.key;
        if (new Set(d.opts.map(String)).size !== 4) return 'axisCount: two options are the same count';
        const valid = new Set(Object.values(AXIS_REF).map(String));
        if (d.opts.some(o => !valid.has(String(o)))) return 'axisCount: an option is not a count any shape here has';
      },
      shapeNoAxis: d => {
        const zero = d.opts.filter(k => AXIS_REF[k] === 0);
        if (zero.length !== 1) return 'shapeNoAxis: ' + zero.length + ' options have no axis (must be exactly one)';
        if (AXIS_REF[d.opts[d.ans]] !== 0) return 'shapeNoAxis: the keyed shape ' + d.opts[d.ans] + ' has an axis';
        if (new Set(d.opts).size !== 4) return 'shapeNoAxis: a shape is offered twice';
      },
      letterSymYes: d => {
        if (SYM_REF.indexOf(d.opts[d.ans]) < 0) return 'letterSymYes: the key ' + d.opts[d.ans] + ' is not line-symmetric';
        if (d.opts.some((o, i) => i !== d.ans && NOTSYM_REF.indexOf(o) < 0)) return 'letterSymYes: a distractor is line-symmetric (or unknown): ' + d.opts.join('');
        if (new Set(d.opts).size !== 4) return 'letterSymYes: repeated option';
      },
      letterSymNo: d => {
        if (NOTSYM_REF.indexOf(d.opts[d.ans]) < 0) return 'letterSymNo: the key ' + d.opts[d.ans] + ' is line-symmetric (or unknown)';
        if (d.opts.some((o, i) => i !== d.ans && SYM_REF.indexOf(o) < 0)) return 'letterSymNo: a distractor is not line-symmetric: ' + d.opts.join('');
        if (new Set(d.opts).size !== 4) return 'letterSymNo: repeated option';
      },
      pointDistance: d => {
        if (!(Number.isInteger(d.dist) && d.dist >= 2 && d.dist <= 9)) return 'pointDistance: distance ' + d.dist + ' outside 2~9';
        if (d.correct !== 2 * d.dist || d.opts[d.ans] !== 2 * d.dist) return 'pointDistance: the key is not 2 × ' + d.dist;
        if (new Set(d.opts).size !== 4) return 'pointDistance: repeated option';
      },
      statementJudge: d => {
        const t = d.items.filter(it => TRUE_REF.indexOf(it.zh) >= 0), f = d.items.filter(it => FALSE_REF.indexOf(it.zh) >= 0);
        if (t.length !== 1 || f.length !== 3) return 'statementJudge: ' + t.length + ' true and ' + f.length + ' false sentences (need 1 and 3)';
        if (d.items[d.ans] !== t[0]) return 'statementJudge: the key is not the true sentence';
      },
      angleTriangle: d => {
        if (d.c !== 180 - d.a - d.b || d.c < 10 || d.c > 140 || d.a < 20 || d.b < 20) return 'angleTriangle: ' + d.a + ' + ' + d.b + ' + ' + d.c + ' is not a valid triangle of this lesson';
        if (d.opts[d.ans] !== d.c) return 'angleTriangle: the key is not the third angle';
      },
      angleQuad: d => {
        if (d.d !== 360 - d.a - d.b - d.c || d.d < 10 || d.d > 170) return 'angleQuad: the fourth angle ' + d.d + ' is wrong or out of range';
        if (d.opts[d.ans] !== d.d) return 'angleQuad: the key is not the fourth angle';
      }
    },
    expectedCorrect: function(d, genId, lang){
      const zh = lang === 'zh';
      switch (genId){
        case 'axisCount': return countRef(AXIS_REF[d.key], lang);
        case 'shapeNoAxis': { const k0 = d.opts.filter(k => AXIS_REF[k] === 0)[0]; return k0 ? NAME_REF[k0][zh ? 0 : 1] : 'NO SHAPE WITHOUT AN AXIS'; }
        case 'letterSymYes': return d.opts.filter(o => SYM_REF.indexOf(o) >= 0)[0];
        case 'letterSymNo': return d.opts.filter(o => NOTSYM_REF.indexOf(o) >= 0)[0];
        case 'pointDistance': return 2 * d.dist + (zh ? ' 公分' : ' cm');
        case 'statementJudge': return d.items.filter(it => TRUE_REF.indexOf(it.zh) >= 0)[0][lang];
        case 'angleTriangle': return (180 - d.a - d.b) + (zh ? ' 度' : '°');
        case 'angleQuad': return (360 - d.a - d.b - d.c) + (zh ? ' 度' : '°');
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      const zh = lang === 'zh';
      switch (genId){
        case 'axisCount': if (!(zh ? /^(\d \條|無數條)$/ : /^(\d|Infinitely many)$/).test(s)) return 'axisCount option "' + s + '" is not a count'; return;
        case 'shapeNoAxis': if (!keyOfName(s, lang)) return 'shapeNoAxis option "' + s + '" is not a shape name'; return;
        case 'letterSymYes': case 'letterSymNo': if (SYM_REF.concat(NOTSYM_REF).indexOf(s) < 0) return 'letter option "' + s + '" unknown'; return;
        case 'statementJudge': { const all = TRUE_REF.concat(FALSE_REF); if (zh ? all.indexOf(s) < 0 : !/^[A-Z][^一-鿿]*\.$/.test(s)) return 'statement option "' + s + '" unknown'; return; }
        case 'pointDistance': { const m = s.match(zh ? /^(\d+) 公分$/ : /^(\d+) cm$/); if (!m) return 'pointDistance option "' + s + '" is not a whole number of cm'; if (+m[1] < 2 || +m[1] > 27) return 'pointDistance option ' + m[1] + ' outside 2~27'; return; }
        case 'angleTriangle': case 'angleQuad': {
          const m = s.match(zh ? /^(\d+) 度$/ : /^(\d+)°$/);
          if (!m) return genId + ' option "' + s + '" is not a whole number of degrees';
          const max = genId === 'angleTriangle' ? 179 : 355;
          if (+m[1] < 5 || +m[1] > max) return genId + ' option ' + m[1] + ' outside 5~' + max;
          return;
        }
      }
      return 'unknown generator ' + genId;
    },
    /* simgen 的通用比對只看「選項字串 === 題幹的數字」，帶單位的選項（'3 公分'、'70度'）永遠比不到 —— 那一條在這一課是瞎的 */
    stemEchoOk: { pointDistance: (d, o) => +String(o).match(/\d+/)[0] === d.dist },
    renderCheck: function(d, q, lang, genId){
      const stemNums = nums(q.stem);
      for (let i = 0; i < q.opts.length; i++){
        if (i === q.ans) continue;
        const m = String(q.opts[i]).match(/^\d+/);
        if (!m || stemNums.indexOf(+m[0]) < 0) continue;
        /* 唯一刻意的迷思誘答：對稱點的距離題，把「離軸的距離」當成「兩點的距離」 */
        if (genId === 'pointDistance' && +m[0] === d.dist) continue;
        return genId + ': distractor ' + q.opts[i] + ' copies a number from the stem (' + stemNums.join(', ') + ')';
      }
      const r = arith(q.why);
      if (r.problems.length) return genId + ': ' + r.problems[0] + ' — "' + q.why + '"';
      if ((genId === 'pointDistance' || genId === 'angleTriangle' || genId === 'angleQuad') && r.verified < 1) return genId + ': the explanation has no equation that could be checked — "' + q.why + '"';
      if (genId === 'axisCount'){
        const c = AXIS_REF[d.key], name = NAME_REF[d.key][lang === 'zh' ? 0 : 1];
        if ((lang === 'zh' ? q.stem : q.stem.toLowerCase()).indexOf(lang === 'zh' ? name : name.toLowerCase()) < 0) return 'axisCount: the stem does not name ' + name;
        const want = lang === 'zh' ? (c === 'inf' ? '有無數條對稱軸' : '有 ' + c + ' 條對稱軸') : (c === 'inf' ? 'has infinitely many axes of symmetry' : 'has ' + c + (c === 1 ? ' axis' : ' axes') + ' of symmetry');
        if (q.why.indexOf(want) < 0) return 'axisCount: the explanation should say "' + want + '": ' + q.why;
      }
      if (genId === 'letterSymYes' || genId === 'letterSymNo'){
        if (q.why.indexOf(q.opts[q.ans]) < 0) return genId + ': the explanation does not name the keyed character';
      }
      if (genId === 'shapeNoAxis' && q.why.indexOf(q.opts[q.ans]) !== 0) return 'shapeNoAxis: the explanation does not start with the keyed shape';
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「對摺魔鏡闖關」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GW, GPICK, shuffle, pick, P2, reflectPt, vcenter, sameCycle, isAxis, symAxes, halfTurn, axisKind, segDist, ptRectDist, rectSegDist, lblBox, lblBaseline, LBL_FS, LBL_CLEAR,' +
      ' SORT_SHAPES, SORT_SYM, SORT_TILT, SORT_NOT, SORT_TRAP, SORT, SORT_H, SORT_BINS, sortMiniX, sortSym, sortDeal, sortInOrder, sortTray, sortRefuse, sortAxis, sortCardPts, sortAxisSeg,' +
      ' FOLD, FOLD_H, GAME_FOLD, foldPt, foldSeg, foldIsAxis, foldAxes, foldGhost, foldPick, foldDone,' +
      ' MIR, MIR_H, GAME_MIRROR, MIR_LETTERS, mirRange, mirPt, mirOf, mirSide, mirPick, mirRefuse, mirLabels,' +
      ' GAME_SIDES, SIDES, SIDES_H, sidesLen, sidesPartner, sidesRefuse, sidesScene, sidesPick,' +
      ' PAINT, PAINT_H, GAME_PAINT, paintCell, paintPick, paintKey, paintCheck, paintRow, AXIS_TYPES, axisMarkup}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object|null/.test(s)) fail(where + ' ' + L + ': undefined/NaN/null in "' + s + '"');
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        arith(s).problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
      };

      /* --- 0. 第二套幾何自己先證明會分辨（正反例） --- */
      [[[[0, 0], [4, 0], [4, 4], [0, 4]], 4, true], [[[0, 0], [6, 0], [6, 3], [0, 3]], 2, true], [[[0, 0], [4, 0], [6, 3], [2, 3]], 0, true],
       [[[0, 0], [4, 0], [2, 3]], 1, false], [[[0, 0], [5, 0], [1, 4]], 0, false], [[[0, 4], [4, 4], [4, 2], [6, 2], [6, 0], [2, 0], [2, 2], [0, 2]], 0, true],
       [[[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]], 1, false]].forEach(([pts, n, half]) => {
        if (axesRef(pts) !== n) fail('axesRef() self-test: ' + JSON.stringify(pts) + ' should have ' + n + ' axes, got ' + axesRef(pts));
        if (halfTurnRef(pts) !== half) fail('halfTurnRef() self-test: ' + JSON.stringify(pts) + ' should be ' + half);
      });

      /* --- 1. 靜態字串（含題庫）的算式逐條驗算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let verified = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => { const r = arith(s); verified += r.verified; r.problems.forEach(p => fail(where + ': ' + p + ' — "' + s + '"')); }));
      if (verified < 2) fail('only ' + verified + ' equations verified in the I18N strings — the arithmetic scan is not reading them');

      /* --- 2. 範例 2：畫出來的每一條橘色虛線都是對稱軸；條數和旁邊的字一樣 --- */
      {
        const WANT = { iso:1, equi:3, square:4, rect:2, circle:'inf', parallelo:0 };
        if (JSON.stringify(D.AXIS_TYPES) !== JSON.stringify(Object.keys(WANT))) fail('EXAMPLE 2: the chip list should be ' + Object.keys(WANT).join(', '));
        D.AXIS_TYPES.forEach(t => {
          const m = D.axisMarkup(t);
          let pts = null, circ = null;
          const pg = m.match(/<polygon points="([^"]+)"/), rc = m.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/), cc = m.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
          if (pg) pts = pg[1].trim().split(/\s+/).map(s => s.split(',').map(Number));
          else if (rc){ const [x, y, w, h] = rc.slice(1).map(Number); pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
          else if (cc) circ = cc.slice(1).map(Number);
          else { fail('EXAMPLE 2 ' + t + ': cannot read the shape'); return; }
          const lines = [...m.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="([^"]+)"/g)].map(x => ({ a:{ x:+x[1], y:+x[2] }, b:{ x:+x[3], y:+x[4] }, col:x[5] }));
          const orange = lines.filter(l => l.col !== '#D64545'), red = lines.filter(l => l.col === '#D64545');
          if (circ){
            orange.forEach((l, i) => { const d = Math.abs((l.b.x - l.a.x) * (circ[1] - l.a.y) - (l.b.y - l.a.y) * (circ[0] - l.a.x)) / Math.hypot(l.b.x - l.a.x, l.b.y - l.a.y); if (d > 0.1) fail('EXAMPLE 2 circle: line ' + i + ' misses the centre by ' + d.toFixed(2) + 'px'); });
            if (orange.length < 4 || !/⋯/.test(m)) fail('EXAMPLE 2 circle: should draw several lines through the centre and "⋯"');
            if (I18N.zh.axisCounts.circle !== '無數條' || I18N.en.axisCounts.circle !== 'Infinitely many') fail('EXAMPLE 2 circle: the count should read infinitely many');
            return;
          }
          orange.forEach((l, i) => { if (!sameSetRef(pts, pts.map(p => mirrorRef(p, l.a, l.b)), 1e-4)) fail('EXAMPLE 2 ' + t + ': drawn axis ' + i + ' is not an axis of the drawn shape'); });
          red.forEach(l => { if (sameSetRef(pts, pts.map(p => mirrorRef(p, l.a, l.b)), 0.5)) fail('EXAMPLE 2 ' + t + ': the red "not an axis" line IS an axis'); });
          if (t === 'equi'){ const L = pts.map((p, i) => Math.hypot(pts[(i + 1) % 3][0] - p[0], pts[(i + 1) % 3][1] - p[1])); if (Math.max(...L) - Math.min(...L) > 1e-4) fail('EXAMPLE 2 equi: the sides are ' + L.map(v => v.toFixed(4)).join(', ') + ' — not equilateral'); }
          /* 畫出來的圖本身有幾條軸（容差 0.15px 的掃描：每 0.25° 一條通過頂點中心的線） */
          const c = { x:pts.reduce((s, p) => s + p[0], 0) / pts.length, y:pts.reduce((s, p) => s + p[1], 0) / pts.length };
          let found = [];
          for (let a = 0; a < 180; a += 0.25){
            const r = a * Math.PI / 180, b = { x:c.x + Math.cos(r), y:c.y + Math.sin(r) };
            if (sameSetRef(pts, pts.map(p => mirrorRef(p, c, b)), 1e-3) && !found.some(f => Math.abs(f - a) < 1)) found.push(a);
          }
          if (found.length !== WANT[t] || orange.length !== WANT[t]) fail('EXAMPLE 2 ' + t + ': the drawing has ' + found.length + ' axes and ' + orange.length + ' orange lines; the page says ' + WANT[t]);
          LANGS.forEach(L => { if (nums(I18N[L].axisCounts[t])[0] !== WANT[t]) fail('EXAMPLE 2 ' + t + ' ' + L + ': the count reads "' + I18N[L].axisCounts[t] + '"'); });
        });
        /* 範例 1：愛心的兩半互為鏡像（對 x = 200） */
        const halves = [...src.matchAll(/<g id="(leftHalf|rightHalf)"[^>]*>\s*<path d="([^"]+)"/g)].map(x => x[2].match(/[\d.]+/g).map(Number));
        if (halves.length !== 2 || halves[0].length !== halves[1].length || halves[0].some((v, i) => Math.abs((i % 2 ? v : 400 - v) - halves[1][i]) > 1e-9)) fail('EXAMPLE 1: the two halves of the heart are not mirror images about x = 200');
      }

      /* ================= 3. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：對摺魔鏡闖關');
      const ge = src.indexOf('  /* ---------- 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      const need = (re, what) => { if (!(re instanceof RegExp ? re.test(gsrc) : gsrc.indexOf(re) >= 0)) fail('GAME: ' + what); };
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const fin = v => typeof v === 'number' && isFinite(v);
      const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= -1e-9 && o.y >= -1e-9 && o.x + o.w <= W + 1e-9 && o.y + o.h <= H + 1e-9)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
      const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (boxHit(list[i], list[j])){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); return; } };
      if (D.GW !== W) fail('GAME: the board width GW should be ' + W);
      tooSmall('GPICK', D.GPICK);
      if (JSON.stringify(D.GAME_ORDER) !== JSON.stringify(['sort', 'fold', 'mirror', 'sides', 'paint'])) fail('GAME_ORDER should be sort, fold, mirror, sides, paint');
      ['sort', 'fold', 'mirror', 'sides', 'paint'].forEach(t => {
        if (!new RegExp('\\n    ' + t + ': function\\(d\\)').test(gsrc)) fail('GAME: RENDER.' + t + ' is missing');
        LANGS.forEach(L => {
          if (!I18N[L].gAsks || typeof I18N[L].gAsks[t] !== 'string' || I18N[L].gAsks[t].length < 20) fail('GAME gAsks.' + t + ' ' + L + ' is missing');
          const h = I18N[L].gHints && I18N[L].gHints[t];
          if (typeof h !== 'string' || !(L === 'zh' ? /^提示 1：/ : /^Hint 1: /).test(h)) fail('GAME gHints.' + t + ' ' + L + ' must be the level-1 hint');
        });
      });

      /* --- 3a. 從原始碼切出來真的跑：shuffle、nearestOpen、missOnce＋roundMiss、useTapSelect --- */
      {
        const fn = extractFunction(src, 'shuffle');
        const shuffle = fn && new Function(fn + '; return shuffle;')();
        if (!shuffle) fail('shuffle(): cannot extract it');
        else {
          const seen = {}, base = [0, 1, 2, 3, 4, 5];
          for (let i = 0; i < 6000; i++){ const t = shuffle(base); if (t.slice().sort().join() !== base.join()) { fail('shuffle(): not a permutation'); break; } if (t === base) { fail('shuffle(): changed the input array'); break; } seen[t.join('')] = 1; }
          if (Object.keys(seen).length < 600) fail('shuffle(): only ' + Object.keys(seen).length + ' orders out of 720 in 6000 runs');
        }
        const no = extractFunction(gsrc, 'nearestOpen');
        const nearestOpen = no && new Function(no + '; return nearestOpen;')();
        if (!nearestOpen) fail('nearestOpen(): cannot extract it');
        else {
          const A = { cx:75, cy:100, hw:71, hh:55, done:false }, B = { cx:223, cy:100, hw:71, hh:55, done:false };
          if (nearestOpen([A, B], { x:153, y:100 }, 10) !== B) fail('nearestOpen(): a point inside B (and inside A\'s padded zone) should go to B');
          if (nearestOpen([A, B], { x:147, y:100 }, 10) !== A) fail('nearestOpen(): a point inside A should go to A');
          if (nearestOpen([A, B], { x:149, y:300 }, 10) !== null) fail('nearestOpen(): a point far below should be nothing');
          /* 大小不一樣的兩個框：點在大框裡、離小框的中心比較近 —— 要量到方框的距離，不是到中心 */
          const Cs = { cx:60, cy:100, hw:10, hh:10, done:false }, Cb = { cx:140, cy:100, hw:70, hh:55, done:false };
          if (nearestOpen([Cs, Cb], { x:72, y:100 }, 10) !== Cb) fail('nearestOpen(): a point inside B (and inside A\'s padded zone) should go to B even when A\'s centre is nearer');
          A.done = true;
          if (nearestOpen([A, B], { x:146, y:100 }, 10) !== null) fail('nearestOpen(): a drop nearest to a finished box must not slide into the other one');
        }
        /* missOnce ＋ roundMiss：同一個 key 第二次只把說明再說一次、不扣分；0 分時不扣也不說「−5 分」 */
        const fns = ['roundMiss', 'roundAgain', 'missOnce'].map(n => extractFunction(gsrc, n));
        if (fns.some(f => !f)) fail('roundMiss()/roundAgain()/missOnce(): cannot extract them');
        else {
          const gMsg = { innerHTML:'' }, elScore = { textContent:'' };
          const run = (start) => {
            const ctx = new Function('gMsg', 'elScore', 'L', 'var gScore = ' + start + ', gMistake = false;\n' + fns.join('\n') + '\n; return { miss:missOnce, st:function(){ return { s:gScore, m:gMistake }; } };')(gMsg, elScore, () => ({ gMinus:'(−5)' }));
            return ctx;
          };
          let c = run(20), seen = {};
          c.miss(seen, 'a', 'A'); c.miss(seen, 'b', 'B'); c.miss(seen, 'a', 'A'); c.miss(seen, 'b', 'B'); c.miss(seen, 'b', 'B');
          if (c.st().s !== 10 || !c.st().m) fail('missOnce(): wrong a, b, a, b, b from 20 should cost 5 twice only (score ' + c.st().s + ')');
          if (gMsg.innerHTML.indexOf('B') < 0 || gMsg.innerHTML.indexOf('(−5)') >= 0) fail('missOnce(): a repeated mistake should show its reason without "−5"');
          c = run(0); seen = {};
          c.miss(seen, 'a', 'A');
          if (c.st().s !== 0 || gMsg.innerHTML.indexOf('(−5)') >= 0) fail('roundMiss(): at 0 points nothing is taken and no "−5" is shown');
          c = run(5); seen = {};
          c.miss(seen, 'a', 'A');
          if (c.st().s !== 0 || gMsg.innerHTML.indexOf('(−5)') < 0) fail('roundMiss(): from 5 points it should take 5 and say "−5"');
        }
        /* addPiece 真的跑（假的 DOM）：拖的時候放在 snap() 說的位置，放開時交給 onDrop 的就是畫出來的中心點 */
        {
          const ap = extractFunction(gsrc, 'addPiece');
          if (!ap) fail('addPiece(): cannot extract it');
          else {
            const mkEl = () => { const h = {}, cl = new Set(); return { h:h, style:{}, classList:{ add:c => cl.add(c), remove:c => cl.delete(c), contains:c => cl.has(c) }, setAttribute(){}, appendChild(){},
              addEventListener:(t, f) => { (h[t] = h[t] || []).push(f); }, removeEventListener:(t, f) => { h[t] = (h[t] || []).filter(g => g !== f); }, setPointerCapture(){}, fire:(t, e) => (h[t] || []).forEach(f => f(e)) }; };
            const doc = mkEl();
            const made = [];
            const A = new Function('document', 'gGen', 'gSolved', 'PIECE_PTR', 'mk', ap.replace("document.createElement('div')", 'mk()') + '; return addPiece;')(doc, 1, false, {}, () => { const e = mkEl(); made.push(e); return e; });
            const drops = [];
            const B = { el:mkEl(), selected:null, kept:null, toBoard:e => ({ x:e.clientX, y:e.clientY }), onDrop:(P, pt) => { drops.push({ cx:P.cx, cy:P.cy, pt:pt }); return true; } };
            const snap = (x, y) => ({ x:Math.round(x / 46) * 46, y:Math.round(y / 46) * 46 });
            const P = A(B, { w:46, h:46, cx:100, cy:300, snap:snap });
            const el = made[0], ev = (x, y) => ({ clientX:x, clientY:y, pointerId:7, isPrimary:true, preventDefault(){} });
            el.fire('pointerdown', ev(100, 300));
            el.fire('pointermove', ev(150, 250));
            el.fire('pointermove', ev(203, 191));
            const shown = { x:P.cx, y:P.cy }, want = snap(203, 191);
            if (shown.x !== want.x || shown.y !== want.y) fail('addPiece(): while dragging, the piece is not placed where snap() says (shown ' + JSON.stringify(shown) + ', snap ' + JSON.stringify(want) + ')');
            el.fire('pointerup', ev(203, 191));
            if (drops.length !== 1 || drops[0].pt.x !== shown.x || drops[0].pt.y !== shown.y) fail('addPiece(): release does not judge the shown (snapped) centre: ' + JSON.stringify(drops));
            if (!drops.length || drops[0].pt.finger.x !== 203 || drops[0].pt.finger.y !== 191) fail('addPiece(): the finger position is not handed to onDrop');
          }
        }
        /* useTapSelect：點一張、再點別張換選；放好之後「繼續選著」的那一張再點一下還是選著，第三下才取消 */
        const ut = extractFunction(gsrc, 'useTapSelect'), ks = extractFunction(gsrc, 'keepSelected');
        if (!ut || !ks) fail('useTapSelect()/keepSelected(): cannot extract them');
        else {
          const T = new Function('gSolved', ut + '\n' + ks + '; return { use:useTapSelect, keep:keepSelected };')(false);
          const piece = () => { const cl = new Set(); return { locked:false, busy:() => false, el:{ classList:{ add:c => cl.add(c), remove:c => cl.delete(c), has:c => cl.has(c) } } }; };
          const B = { selected:null, kept:null }, drops = [];
          T.use(B, (P, pt) => { drops.push([P, pt]); return true; });
          const p1 = piece(), p2 = piece();
          B.onTap(p1); if (B.selected !== p1) fail('useTapSelect(): a tap does not select');
          B.onTap(p2); if (B.selected !== p2 || p1.el.classList.has('sel')) fail('useTapSelect(): tapping another piece should move the selection');
          B.onTap(p2); if (B.selected !== null) fail('useTapSelect(): tapping the selected piece again should unselect it');
          B.onTap(p1); B.onPointTap(p1, { x:5, y:6 });
          if (drops.length !== 1 || drops[0][1].tap !== true || B.selected !== null) fail('useTapSelect(): tapping a destination should try the drop (pt.tap) and clear the selection');
          T.keep(B, p1);
          B.onTap(p1); if (B.selected !== p1) fail('useTapSelect(): re-tapping a kept card (as the instruction says) should leave it selected');
          B.onTap(p1); if (B.selected !== null) fail('useTapSelect(): tapping it once more should unselect it');
        }
      }

      /* --- 3b. 第 1 關：分一分 --- */
      {
        const keys = Object.keys(D.SORT_SHAPES);
        keys.forEach(k => {
          const pts = D.SORT_SHAPES[k], ref = axesRef(pts), page = D.symAxes(pts);
          if (page.length !== ref) fail('sort ' + k + ': symAxes() finds ' + page.length + ' axes, the edge/angle sequence says ' + ref);
          page.forEach(deg => { const r = deg * Math.PI / 180, c = D.vcenter(pts); if (!sameSetRef(pts, pts.map(p => mirrorRef(p, c, { x:c.x + Math.cos(r), y:c.y + Math.sin(r) })), 1e-6)) fail('sort ' + k + ': symAxes() reports ' + deg + '°, which is not an axis'); });
          if (D.halfTurn(pts) !== halfTurnRef(pts)) fail('sort ' + k + ': halfTurn() disagrees with the sequence test');
          ['yes', 'no'].forEach(bin => { const want = (ref > 0) === (bin === 'yes') ? null : (ref > 0 ? 'isSym' : 'notSym'); if (D.sortRefuse(k, bin) !== want) fail('sortRefuse(' + k + ', ' + bin + ') should be ' + want); });
          if (ref > 0){
            const deg = D.sortAxis(k);
            if (page.indexOf(deg) < 0) fail('sortAxis(' + k + ') is not one of its axes');
            const kinds = page.map(D.axisKind), want = kinds.indexOf('v') >= 0 ? 'v' : (kinds.indexOf('h') >= 0 ? 'h' : 'd');
            if (D.axisKind(deg) !== want) fail('sortAxis(' + k + '): the explained axis should be the ' + want + ' one');
          } else if (D.sortAxis(k) !== null) fail('sortAxis(' + k + ') should be null');
        });
        if (!D.SORT_SYM.every(k => axesRef(D.SORT_SHAPES[k]) > 0) || !D.SORT_NOT.every(k => axesRef(D.SORT_SHAPES[k]) === 0)) fail('sort: SORT_SYM / SORT_NOT are not what their names say');
        {
          const both = D.SORT_SYM.concat(D.SORT_NOT);
          if (new Set(both).size !== both.length || both.slice().sort().join() !== keys.slice().sort().join()) fail('sort: every shape is in exactly one list (no duplicates, none missing)');
        }
        D.SORT_TILT.forEach(k => { if (D.SORT_SYM.indexOf(k) < 0 || D.symAxes(D.SORT_SHAPES[k]).some(a => D.axisKind(a) === 'v')) fail('sort: tilt shape ' + k + ' must be symmetric with no vertical axis'); });
        if (!D.SORT_TILT.some(k => D.symAxes(D.SORT_SHAPES[k]).every(a => D.axisKind(a) === 'd'))) fail('sort: one tilt shape must have only slanted axes');
        D.SORT_TRAP.forEach(k => { if (D.SORT_NOT.indexOf(k) < 0 || !halfTurnRef(D.SORT_SHAPES[k])) fail('sort: trap ' + k + ' must be non-symmetric but come back after a half turn'); });
        D.SORT_NOT.forEach(k => { if (D.SORT_TRAP.indexOf(k) < 0 && halfTurnRef(D.SORT_SHAPES[k])) fail('sort: ' + k + ' comes back after a half turn but is not listed as a trap'); });
        /* 發牌與托盤 3000 次 */
        const rowsMixed = t => { const s = t.map(k => axesRef(D.SORT_SHAPES[k]) > 0); return [s.slice(0, 3), s.slice(3)].every(r => r.some(Boolean) && r.some(v => !v)); };
        let sawSorted = 0;
        for (let i = 0; i < 3000; i++){
          const deal = D.sortDeal(), t = D.sortTray(deal);
          if (deal.length !== 6 || new Set(deal).size !== 6) { fail('sortDeal(): not six different shapes'); break; }
          if (deal.filter(k => axesRef(D.SORT_SHAPES[k]) > 0).length !== 3) { fail('sortDeal(): not 3 symmetric + 3 not'); break; }
          if (!deal.some(k => D.SORT_TILT.indexOf(k) >= 0) || !deal.some(k => D.SORT_TRAP.indexOf(k) >= 0)) { fail('sortDeal(): a deal lacks the tilted axis or the half-turn trap'); break; }
          if (t.slice().sort().join() !== deal.slice().sort().join()) { fail('sortTray(): lost or added a card'); break; }
          if (!rowsMixed(t)){ sawSorted++; }
        }
        if (sawSorted) fail('sortTray(): ' + sawSorted + ' of 3000 trays start with a row that is all one kind (looks pre-sorted)');
        /* 版面：卡片、箱子、小圖 */
        const S = D.SORT, cards = [];
        S.trayY.forEach(y => S.trayX.forEach(x => { const b = box(x, y, S.cardW, S.cardH); cards.push(b); inside(b, 'sort card', D.SORT_H); }));
        noHits(cards, 'sort tray cards');
        tooSmall('sort card', Math.min(S.cardW, S.cardH));
        const bins = [0, 1].map(i => ({ x:S.binX[i], y:S.binY, w:S.binW, h:S.binH }));
        bins.forEach((b, i) => inside(b, 'sort box ' + i, D.SORT_H));
        noHits(bins, 'sort boxes');
        cards.forEach((c, i) => bins.forEach((b, j) => { if (boxHit(c, b)) fail('GAME sort: tray card ' + i + ' overlaps box ' + j); }));
        bins.forEach((b, i) => {
          const lbl = { x:b.x + 4, y:b.y + 4, w:b.w - 8, h:S.lblH };
          if (S.lblH < 2 * 15 * 1.2 + 4) fail('GAME sort: the box label (15px, two lines in English) needs ' + (2 * 15 * 1.2 + 4) + 'px, has ' + S.lblH);
          for (let n = 0; n < 3; n++){
            const m = box(D.sortMiniX(i, n), S.miniY, S.miniW, S.miniW);
            if (!(m.x >= b.x + 3 && m.x + m.w <= b.x + b.w - 3 && m.y + m.h <= b.y + b.h - 3)) fail('GAME sort: mini card ' + n + ' sticks out of box ' + i);
            if (boxHit(m, lbl)) fail('GAME sort: mini card ' + n + ' covers the label of box ' + i);
          }
        });
        if (Math.abs(S.binX[0] + S.binW - S.binX[1]) > 2 * S.pad) fail('GAME sort: the boxes are far apart; the overlap-zone test assumes the padded zones overlap');
        /* 卡片上的圖：同一個比例、在卡片裡、軸真的是軸 */
        keys.forEach(k => {
          const P = D.sortCardPts(k, S.cardW - 6, S.cardH - 6, S.U);
          if (P.some(p => p.x < 4 || p.y < 4 || p.x > S.cardW - 10 || p.y > S.cardH - 10)) fail('GAME sort card ' + k + ': the shape touches the card border');
          const raw = D.SORT_SHAPES[k].map(P2);
          for (let i = 1; i < P.length; i++) if (Math.abs(Math.hypot(P[i].x - P[0].x, P[i].y - P[0].y) - S.U * Math.hypot(raw[i].x - raw[0].x, raw[i].y - raw[0].y)) > 1e-9) { fail('GAME sort card ' + k + ': not drawn at ' + S.U + 'px per unit'); break; }
          const seg = D.sortAxisSeg(k, S.cardW - 6, S.cardH - 6, S.U);
          if (axesRef(D.SORT_SHAPES[k]) > 0){
            if (!seg || !sameSetRef(P, P.map(p => mirrorRef(p, seg.a, seg.b)), 1e-6)) fail('GAME sort card ' + k + ': the axis drawn after a mistake is not an axis of the card picture');
            else if ([seg.a, seg.b].some(p => p.x < 0 || p.y < 0 || p.x > S.cardW - 6 || p.y > S.cardH - 6)) fail('GAME sort card ' + k + ': the drawn axis sticks out of the card');
          } else if (seg) fail('GAME sort card ' + k + ': a non-symmetric shape should get no axis');
        });
        need("var bin = nearestOpen(bins, pt, SORT.pad) || (pt.finger ? nearestOpen(bins, pt.finger, SORT.pad) : null);", 'sort: the box is not chosen by nearestOpen() (card centre first, then finger)');
        need("var k = P.data.k, why = sortRefuse(k, bin.v), name = d.gNames[k];", 'sort: the card judged is not the one dropped, or not against the box it landed in');
        need("missOnce(seen, k + '>' + bin.v, why === 'isSym' ? d.gSortBadSym(name, axisKind(sortAxis(k))) : d.gSortBadNot(name, halfTurn(SORT_SHAPES[k])));", 'sort: a mistake is not charged once per card and box, or the reason is not built from the shape');
        need("var keys = sortTray(sortDeal())", 'sort: the tray is not dealt with sortDeal() and laid out with sortTray()');
        need("cx:SORT.trayX[j % 3], cy:SORT.trayY[Math.floor(j / 3)]", 'sort: the cards are not laid out in tray order (row 1 = first three)');
        need("if (done === cards.length) roundSolved(d.gSortDone);", 'sort: the round is not solved exactly when every card is in');
      }

      /* --- 3c. 第 2 關：摺一摺 --- */
      {
        const counts = new Set();
        D.GAME_FOLD.forEach((e, ei) => {
          const ref = axesRef(e.pts);
          counts.add(ref);
          if (D.foldAxes(e) !== ref) fail('fold ' + e.k + ': foldAxes() says ' + D.foldAxes(e) + ', the sequence test says ' + ref);
          const c = D.vcenter(e.pts);
          if (Math.hypot(c.x, c.y) > 1e-9) fail('fold ' + e.k + ': the shape is not centred on its vertex centre');
          let axisLines = 0;
          e.dirs.forEach((v, i) => {
            const isAx = sameSetRef(e.pts, e.pts.map(p => mirrorRef(p, [0, 0], v)), 1e-6);
            if (D.foldIsAxis(e, i) !== isAx) fail('fold ' + e.k + ': foldIsAxis(' + i + ') is ' + D.foldIsAxis(e, i) + ', reflecting says ' + isAx);
            if (isAx) axisLines++;
            const g = D.foldGhost(e, i), want = e.pts.map(p => { const q = mirrorRef(p, [0, 0], v); return D.foldPt(q.x, q.y); });
            if (!sameSetRef(g, want, 1e-6)) fail('fold ' + e.k + ': foldGhost(' + i + ') is not the shape folded over line ' + i);
            const s = D.foldSeg(e, i);
            [s.a, s.b].forEach(p => { if (p.x < 2 || p.y < 2 || p.x > W - 2 || p.y > D.FOLD_H - 2) fail('fold ' + e.k + ': line ' + i + ' runs off the board'); });
            /* 每一條線都要畫到圖形外面（不然看起來像一條邊） */
            const R = Math.max(...e.pts.map(p => Math.hypot(p[0], p[1]))) * D.FOLD.U;
            if (s.R < R + 10) fail('fold ' + e.k + ': line ' + i + ' does not reach past the shape');
          });
          if (axisLines !== ref) fail('fold ' + e.k + ': ' + axisLines + ' of the dashed lines are axes, but the shape has ' + ref + ' — every axis must be offered');
          if (new Set(e.dirs.map(v => ((Math.round(Math.atan2(v[1], v[0]) * 180 / Math.PI * 1e6) / 1e6) % 180 + 180) % 180)).size !== e.dirs.length) fail('fold ' + e.k + ': two dashed lines are the same line');
          e.pts.forEach(p => { const q = D.foldPt(p[0], p[1]); if (q.x < 10 || q.y < 10 || q.x > W - 10 || q.y > D.FOLD_H - 10) fail('fold ' + e.k + ': the shape runs off the board'); });
          for (let f = 0; f <= ref + 1; f++){ const want = f === ref ? null : 'more'; if (D.foldDone(e, f) !== want) fail('foldDone(' + e.k + ', ' + f + ') should be ' + want); }
          /* foldPick 整片畫板每 1px：這裡自己算「離中心 rc 以外、在那一條線畫出來的長度裡、垂直距離最近、tol 以內」 */
          const U = D.FOLD.U, segs = e.dirs.map((v, i) => D.foldSeg(e, i));
          let mism = 0, perLine = e.dirs.map(() => 0);
          for (let x = 0; x <= W; x++) for (let y = 0; y <= D.FOLD_H; y++){
            const p = { x:x, y:y }, dx = x - D.FOLD.cx, dy = y - D.FOLD.cy;
            let want = null, edge = Math.abs(Math.hypot(dx, dy) - D.FOLD.rc) < 1e-6;
            if (Math.hypot(dx, dy) >= D.FOLD.rc){
              let bd = Infinity, b2 = Infinity;
              segs.forEach((s, i) => {
                const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), t = ((x - s.a.x) * (s.b.x - s.a.x) + (y - s.a.y) * (s.b.y - s.a.y)) / L;
                if (Math.abs(t + 4) < 1e-6 || Math.abs(t - L - 4) < 1e-6) edge = true;
                if (t < -4 || t > L + 4) return;
                const d = Math.abs((s.b.x - s.a.x) * (y - s.a.y) - (s.b.y - s.a.y) * (x - s.a.x)) / L;
                if (d < bd){ b2 = bd; bd = d; want = i; } else if (d < b2) b2 = d;
              });
              if (Math.abs(bd - D.FOLD.tol) < 1e-6 || Math.abs(b2 - bd) < 1e-6) edge = true;
              if (bd > D.FOLD.tol) want = null;
            }
            const got = D.foldPick(e, p);
            if (got !== want && !edge) mism++;   /* 剛好落在邊界上（1e-6 以內）的點，兩種算法的浮點誤差可以不一樣 */
            if (got !== null) perLine[got]++;
          }
          if (mism) fail('foldPick(' + e.k + '): ' + mism + ' board points disagree with the nearest-line rule');
          /* 每一條線上 rc 以外、離線 6px 以內的點都要點得到那一條線 */
          segs.forEach((s, i) => {
            for (let f = 0.02; f <= 0.98; f += 0.02) for (const off of [-6, 0, 6]){
              const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), nx = -(s.b.y - s.a.y) / L, ny = (s.b.x - s.a.x) / L;
              const p = { x:s.a.x + f * (s.b.x - s.a.x) + nx * off, y:s.a.y + f * (s.b.y - s.a.y) + ny * off };
              if (Math.hypot(p.x - D.FOLD.cx, p.y - D.FOLD.cy) < D.FOLD.rc + 14) continue;
              if (D.foldPick(e, p) !== i){ fail('foldPick(' + e.k + '): a tap on line ' + i + ' at ' + f.toFixed(2) + ' (' + off + 'px off) goes to ' + D.foldPick(e, p)); return; }
            }
          });
          void ei; void U;
        });
        [0, 1, 2, 3, 4, 6].forEach(n => { if (!counts.has(n)) fail('fold: no shape in the pool with ' + n + ' axes'); });
        need("var i = foldPick(e, pt);", 'fold: the tapped point is not mapped with foldPick()');
        need("if (foldIsAxis(e, i)){", 'fold: the fold is not judged with foldIsAxis()');
        need("ghost.setAttribute('points', ptsAttr(foldGhost(e, i)));", 'fold: the orange copy is not foldGhost() of the tapped line');
        need("missOnce(seen, 'line' + i, d.gFoldNo);", 'fold: a wrong line is not charged once per line');
        need("if (foldDone(e, found)){ missOnce(seen, 'done' + found, d.gFoldMore(name, found)); return; }", 'fold: "That’s all" is not judged with foldDone() / charged once per count');
        need("if (state[i] === 1) return;", 'fold: an axis already found can be counted again');
        need("roundSolved(d.gFoldDone(name, found));", 'fold: the round is not solved by "That’s all"');
      }

      /* --- 3d. 第 3 關：找對稱點 --- */
      {
        let sawV = 0, sawH = 0;
        D.GAME_MIRROR.forEach((e, ei) => {
          const R = D.mirRange(e.ax);
          if (e.ax === 'v') sawV++; else sawH++;
          if (e.pts.length !== 3 || new Set(e.pts.map(String)).size !== 3) fail('mirror ' + ei + ': three different points');
          const [a, b, c] = e.pts;
          if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) === 0) fail('mirror ' + ei + ': the three points are on one line');
          e.pts.forEach((p, i) => {
            const d = e.ax === 'v' ? -p[0] : p[1];
            if (!(d >= 1 && d <= 3)) fail('mirror ' + ei + ': point ' + i + ' is not 1~3 cells on the A/B/C side');
            if (D.mirSide(e.ax, p) !== d) fail('mirSide(' + ei + ', ' + i + ') should be ' + d);
            const m = e.ax === 'v' ? [-p[0], p[1]] : [p[0], -p[1]];
            if (String(D.mirOf(e.ax, p)) !== String(m)) fail('mirOf(' + ei + ', ' + i + ') is wrong');
            if (m[0] < R.x0 || m[0] > R.x1 || m[1] < R.y0 || m[1] > R.y1) fail('mirror ' + ei + ': the image of point ' + i + ' is off the grid');
            /* 每一個 pin × 每一個點：這裡自己分類 */
            for (let x = R.x0; x <= R.x1; x++) for (let y = R.y0; y <= R.y1; y++){
              const q = [x, y], got = D.mirRefuse(e, i, q);
              const side = e.ax === 'v' ? x : -y, row = e.ax === 'v' ? y === p[1] : x === p[0];
              const want = side <= 0 ? 'side' : (!row ? 'row' : (side !== d ? 'dist' : null));
              if ((got && got.why) !== (want || undefined) && !(got === null && want === null)) fail('mirRefuse(' + ei + ', ' + i + ', ' + q + ') is ' + JSON.stringify(got) + ', should be ' + want);
              if (got && (got.d !== d || (want !== 'side' && got.got !== side))) fail('mirRefuse(' + ei + ', ' + i + ', ' + q + '): the distances ' + got.d + '/' + got.got + ' should be ' + d + '/' + side);
            }
          });
          /* 點陣：每一點在畫板裡；每 1px 吸到最近的那一點（自己一格），點陣外面 null */
          const dots = [];
          for (let x = R.x0; x <= R.x1; x++) for (let y = R.y0; y <= R.y1; y++) dots.push({ c:[x, y], p:D.mirPt(e.ax, x, y) });
          dots.forEach(d => { if (d.p.x < 8 || d.p.y < 8 || d.p.x > W - 8 || d.p.y > D.MIR_H[e.ax] - 8) fail('mirror ' + ei + ': dot ' + d.c + ' is too close to the board edge'); });
          const U = D.MIR.U;
          if (Math.abs(D.mirPt(e.ax, 1, 0).x - D.mirPt(e.ax, 0, 0).x - U) > 1e-9 || Math.abs(D.mirPt(e.ax, 0, 0).y - D.mirPt(e.ax, 0, 1).y - U) > 1e-9) fail('mirror: mirPt() is not one cell per MIR.U');
          tooSmall('mirror dot spacing (each dot\'s cell)', U);
          let mism = 0;
          const xs = dots.map(d => d.p.x), ys = dots.map(d => d.p.y), x0 = Math.min(...xs) - U / 2, x1 = Math.max(...xs) + U / 2, y0 = Math.min(...ys) - U / 2, y1 = Math.max(...ys) + U / 2;
          for (let x = 0; x <= W; x++) for (let y = 0; y <= D.MIR_H[e.ax]; y++){
            let want = null;
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1){ let bd = Infinity; dots.forEach(d => { const dd = Math.max(Math.abs(x - d.p.x), Math.abs(y - d.p.y)); if (dd < bd){ bd = dd; want = d.c; } }); }
            const got = D.mirPick(e.ax, { x:x, y:y });
            if (String(got) !== String(want) && !(got && want && Math.max(Math.abs(x - D.mirPt(e.ax, got[0], got[1]).x), Math.abs(y - D.mirPt(e.ax, got[0], got[1]).y)) === Math.max(Math.abs(x - D.mirPt(e.ax, want[0], want[1]).x), Math.abs(y - D.mirPt(e.ax, want[0], want[1]).y)))) mism++;
          }
          if (mism) fail('mirPick(' + ei + '): ' + mism + ' board points do not go to the nearest dot');
          /* 字母：找得到位置、在畫板裡、離三角形的邊、摺線、每一個點都夠遠 */
          const labels = D.mirLabels(e), P = e.pts.map(p => D.mirPt(e.ax, p[0], p[1]));
          const axA = e.ax === 'v' ? D.mirPt('v', 0, R.y0) : D.mirPt('h', R.x0, 0), axB = e.ax === 'v' ? D.mirPt('v', 0, R.y1) : D.mirPt('h', R.x1, 0);
          const axisSeg = e.ax === 'v' ? [{ x:axA.x, y:axA.y + U / 2 }, { x:axB.x, y:axB.y - U / 2 }] : [{ x:axA.x - U / 2, y:axA.y }, { x:axB.x + U / 2, y:axB.y }];
          labels.forEach((at, i) => {
            if (!at){ fail('mirror ' + ei + ': no room for the letter ' + D.MIR_LETTERS[i]); return; }
            const r = D.lblBox(D.MIR_LETTERS[i], D.LBL_FS, at.x, at.y);
            inside(r, 'mirror ' + ei + ' letter ' + D.MIR_LETTERS[i], D.MIR_H[e.ax]);
            [[P[0], P[1]], [P[1], P[2]], [P[2], P[0]]].forEach(s => { if (rectSegRef(r, s[0], s[1]) - 1.25 < 2) fail('mirror ' + ei + ': letter ' + D.MIR_LETTERS[i] + ' is under 2px from a side of the triangle'); });
            if (rectSegRef(r, axisSeg[0], axisSeg[1]) - 1.5 < 2) fail('mirror ' + ei + ': letter ' + D.MIR_LETTERS[i] + ' is under 2px from the fold line');
            dots.forEach(d => { const rad = P.some(q => q.x === d.p.x && q.y === d.p.y) ? 6 : 3.5; if (rectPtRef(d.p, r) - rad < 2) fail('mirror ' + ei + ': letter ' + D.MIR_LETTERS[i] + ' is under 2px from a dot'); });
            /* 字母要讀得出是哪一點的：最靠近它的那一個大點就是它自己 */
            const cen = { x:at.x, y:at.y }, near = P.map(q => Math.hypot(q.x - cen.x, q.y - cen.y));
            if (near.indexOf(Math.min(...near)) !== i) fail('mirror ' + ei + ': letter ' + D.MIR_LETTERS[i] + ' sits closer to another point');
          });
          /* 托盤 */
          const pins = D.MIR.pinX.map(x => box(x, D.MIR.pinY[e.ax], D.MIR.pinW, D.MIR.pinW));
          pins.forEach((p, i) => { inside(p, 'mirror pin ' + i, D.MIR_H[e.ax]); if (D.mirPick(e.ax, { x:p.x + p.w / 2, y:p.y + p.h / 2 })) fail('mirror ' + ei + ': pin ' + i + ' waits on the grid (it would snap)'); });
          noHits(pins, 'mirror pins');
          tooSmall('mirror pin', D.MIR.pinW);
        });
        if (!sawV || !sawH) fail('mirror: the pool needs both a vertical and a horizontal fold line');
        need("var c = mirPick(ax, pt);", 'mirror: the drop point is not mapped with mirPick()');
        need("if (!c && pt.finger) c = mirPick(ax, pt.finger);", 'mirror: a drop with the finger on a dot is not tried');
        need("if (!c || taken(c)) return false;", 'mirror: an occupied dot is not refused silently');
        need("var i = P.data.i, Lt = MIR_LETTERS[i], bad = mirRefuse(e, i, c);", 'mirror: the pin judged is not the one dropped');
        need("missOnce(seen, i + '@' + c[0] + ',' + c[1], msg);", 'mirror: a mistake is not charged once per pin and dot');
        need("var snap = function(cx, cy){ var c = mirPick(ax, { x:cx, y:cy }); return c ? mirPt(ax, c[0], c[1]) : null; };", 'mirror: the pin does not snap to the dot it will be judged on');
        need("if (done === 3){", 'mirror: the round is not solved after three pins');
      }

      /* --- 3e. 第 4 關：對稱邊 --- */
      {
        let sawH = 0;
        D.GAME_SIDES.forEach((e, ei) => {
          const n = e.pts.length;
          if (e.ax === 'h') sawH++;
          const fold = p => e.ax === 'v' ? [-p[0], p[1]] : [p[0], -p[1]];
          if (!sameSetRef(e.pts, e.pts.map(fold), 1e-9)) fail('sides ' + ei + ': the polygon is not symmetric about its axis');
          if (axesRef(e.pts) < 1) fail('sides ' + ei + ': the sequence test finds no axis');
          for (let i = 0; i < n; i++){
            const a = e.pts[i], b = e.pts[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (Math.abs(L - Math.round(L)) > 1e-9) fail('sides ' + ei + ': side ' + i + ' is ' + L + ' cm (not whole)');
            if (D.sidesLen(e, i) !== Math.round(L)) fail('sidesLen(' + ei + ', ' + i + ') should be ' + Math.round(L));
            const fa = fold(a), fb = fold(b);
            let want = -1;
            for (let j = 0; j < n; j++){ const c = e.pts[j], d = e.pts[(j + 1) % n]; if ((String(fa) === String(c) && String(fb) === String(d)) || (String(fa) === String(d) && String(fb) === String(c))) want = j; }
            if (D.sidesPartner(e, i) !== want) fail('sidesPartner(' + ei + ', ' + i + ') should be ' + want);
          }
          if (e.give.some(i => e.ask.indexOf(i) >= 0)) fail('sides ' + ei + ': a side is both labelled and asked');
          if (e.pts.some((q, i) => D.sidesPartner(e, i) < 0)){ fail('sides ' + ei + ': a side has no partner'); return; }
          e.ask.forEach(i => {
            const p = D.sidesPartner(e, i);
            if (p === i) fail('sides ' + ei + ': asked side ' + i + ' is its own partner');
            if (e.give.indexOf(p) < 0) fail('sides ' + ei + ': the partner of asked side ' + i + ' is not labelled — the picture cannot tell the answer');
            if (e.cards.indexOf(D.sidesLen(e, p)) < 0) fail('sides ' + ei + ': no card for side ' + i);
            e.cards.forEach(v => { const want = v === D.sidesLen(e, p) ? null : D.sidesLen(e, p); if (D.sidesRefuse(e, i, v) !== want) fail('sidesRefuse(' + ei + ', ' + i + ', ' + v + ') should be ' + want); });
          });
          if (new Set(e.cards).size !== e.cards.length || e.cards.length !== D.SIDES.cardX.length) fail('sides ' + ei + ': the cards should be ' + D.SIDES.cardX.length + ' different numbers');
          e.cards.forEach(v => { if (!e.give.some(i => D.sidesLen(e, i) === v)) fail('sides ' + ei + ': card ' + v + ' is a length that is not on the picture'); });
          /* 每一個空格要的數，彼此都不一樣以外，至少有一張卡是錯的（不然沒有東西可以練） */
          if (e.ask.every(i => e.cards.every(v => v === D.sidesLen(e, D.sidesPartner(e, i))))) fail('sides ' + ei + ': no wrong card');
          /* 版面 */
          const sc = D.sidesScene(e), s = sc.s, H = D.SIDES_H;
          for (let i = 0; i < n; i++){ const a = sc.P[i], b = sc.P[(i + 1) % n]; if (Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - s * D.sidesLen(e, i)) > 1e-6) fail('sides ' + ei + ': side ' + i + ' is not drawn at ' + s + 'px per cm'); }
          sc.P.forEach(p => { if (p.x < 0 || p.x > W || p.y < 0 || p.y > H) fail('sides ' + ei + ': the shape runs off the board'); });
          const edgesSeg = sc.P.map((a, i) => [a, sc.P[(i + 1) % n]]);
          /* 對稱軸畫在真的對稱軸上（兩端在形狀外面） */
          const ax = sc.axis;
          if (!sameSetRef(sc.P, sc.P.map(p => mirrorRef(p, ax.a, ax.b)), 1e-6)) fail('sides ' + ei + ': the drawn axis is not the axis of the drawn shape');
          const lblBoxes = sc.labels.map(L => D.lblBox(L.v, D.LBL_FS, L.at.x, L.at.y));
          const slotBoxes = sc.slots.map(sl => box(sl.cx, sl.cy, D.SIDES.slotW, D.SIDES.slotH));
          sc.labels.forEach((L, j) => {
            if (L.v !== D.sidesLen(e, L.i)) fail('sides ' + ei + ': label ' + j + ' reads ' + L.v + ' but its side is ' + D.sidesLen(e, L.i));
            const r = lblBoxes[j];
            inside(r, 'sides ' + ei + ' label ' + L.v, H);
            edgesSeg.forEach((sg, i) => { if (rectSegRef(r, sg[0], sg[1]) - 1.75 < 2) fail('sides ' + ei + ': label ' + L.v + ' is under 2px from side ' + i); });
            if (rectSegRef(r, ax.a, ax.b) - 1.25 < 2) fail('sides ' + ei + ': label ' + L.v + ' is under 2px from the axis');
            /* 讀得出是哪一條邊的：離它最近的邊就是它自己 */
            const c = { x:L.at.x, y:L.at.y }, dd = edgesSeg.map(sg => segDistRef(c, sg[0], sg[1]));
            if (dd.indexOf(Math.min(...dd)) !== L.i) fail('sides ' + ei + ': label ' + L.v + ' sits closer to another side');
          });
          sc.slots.forEach((sl, j) => {
            const r = slotBoxes[j];
            inside(r, 'sides ' + ei + ' slot ' + j, H);
            edgesSeg.forEach((sg, i) => { if (rectSegRef(r, sg[0], sg[1]) - 1.75 < 2) fail('sides ' + ei + ': slot ' + j + ' is under 2px from side ' + i); });
            if (rectSegRef(r, ax.a, ax.b) - 1.25 < 2) fail('sides ' + ei + ': slot ' + j + ' is under 2px from the axis');
            const c = { x:sl.cx, y:sl.cy }, dd = edgesSeg.map(sg => segDistRef(c, sg[0], sg[1]));
            if (dd.indexOf(Math.min(...dd)) !== sl.i) fail('sides ' + ei + ': slot ' + j + ' sits closer to another side than side ' + sl.i);
            /* 空格放寬之後的範圍不可以蓋到任何一個數字標籤 */
            const z = { x:r.x - D.SIDES.pad, y:r.y - D.SIDES.pad, w:r.w + 2 * D.SIDES.pad, h:r.h + 2 * D.SIDES.pad };
            lblBoxes.forEach((lb, k) => { if (boxHit(z, lb)) fail('sides ' + ei + ': slot ' + j + '\'s padded zone covers label ' + sc.labels[k].v); });
          });
          noHits(lblBoxes.concat(slotBoxes), 'sides ' + ei + ' labels and slots');
          const cardBoxes = D.SIDES.cardX.map(x => box(x, D.SIDES.cardY, D.SIDES.cardW, D.SIDES.cardH));
          cardBoxes.forEach((cb, i) => { inside(cb, 'sides card ' + i, H); lblBoxes.concat(slotBoxes).forEach(o => { if (boxHit(cb, o)) fail('sides ' + ei + ': card ' + i + ' overlaps a label or slot'); }); sc.P.forEach(p => { if (p.y >= cb.y - 6) fail('sides ' + ei + ': the shape reaches into the card row'); }); });
          noHits(cardBoxes, 'sides cards');
          tooSmall('sides card', Math.min(D.SIDES.cardW, D.SIDES.cardH));
          /* sidesPick 整片畫板每 1px：空格的方框 pad 以內或那一條邊 tol 以內，而且比任何一個數字標籤與有標籤的邊都近 */
          let mism = 0;
          for (let x = 0; x <= W; x++) for (let y = 0; y <= H; y++){
            const p = { x:x, y:y };
            let want = null, bd = Infinity, edge = false;
            sc.slots.forEach((sl, j) => {
              const dbx = rectPtRef(p, slotBoxes[j]), dse = segDistRef(p, sl.a, sl.b);
              if (Math.abs(dbx - D.SIDES.pad) < 1e-6 || Math.abs(dse - D.SIDES.tol) < 1e-6) edge = true;
              const d = Math.min(dbx <= D.SIDES.pad ? dbx : Infinity, dse <= D.SIDES.tol ? dse : Infinity);
              if (Math.abs(d - bd) < 1e-6 && d !== Infinity) edge = true;
              if (d < bd){ bd = d; want = j; }
            });
            if (want !== null && sc.labels.some((L, k) => { const dl = Math.min(rectPtRef(p, lblBoxes[k]), segDistRef(p, edgesSeg[L.i][0], edgesSeg[L.i][1])); if (Math.abs(dl - bd) < 1e-6) edge = true; return dl < bd; })) want = null;
            if (D.sidesPick(sc, p) !== want && !edge) mism++;
          }
          if (mism) fail('sidesPick(' + ei + '): ' + mism + ' board points disagree');
          /* 自然的做法：空格的中心與 ±35%、那一條邊的 15%～85% 都要收；數字標籤的中心不收 */
          sc.slots.forEach((sl, j) => {
            const r = slotBoxes[j], spots = [[0, 0], [-0.35, 0], [0.35, 0], [0, -0.35], [0, 0.35]].map(v => ({ x:sl.cx + v[0] * r.w, y:sl.cy + v[1] * r.h }));
            for (let f = 0.15; f <= 0.851; f += 0.05) spots.push({ x:sl.a.x + f * (sl.b.x - sl.a.x), y:sl.a.y + f * (sl.b.y - sl.a.y) });
            spots.forEach(p => { if (D.sidesPick(sc, p) !== j) fail('sides ' + ei + ': a natural drop on slot ' + j + ' at ' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' is refused'); });
          });
          sc.labels.forEach((L, k) => { if (D.sidesPick(sc, L.at) !== null) fail('sides ' + ei + ': a drop on label ' + L.v + ' goes into a slot'); });
        });
        if (!sawH) fail('sides: the pool needs a horizontal axis too');
        need("var j = sidesPick(sc, pt);", 'sides: the drop point is not mapped with sidesPick()');
        need("if (j === null || slots[j].done) return false;", 'sides: a filled slot is not refused silently');
        need("var sl = slots[j], v = P.data.v, bad = sidesRefuse(e, sl.i, v);", 'sides: the card judged is not the one dropped, or not against the slot it landed in');
        need("missOnce(seen, sl.i + '=' + v, d.gSidesBad(bad, v));", 'sides: a mistake is not charged once per slot and number');
        need("if (pt.tap) keepSelected(B, P);", 'sides: a card placed by tapping does not stay selected');
        need("          focus = sl;", 'sides: hint 2 does not follow the box just tried');
        need("          missOnce(seen, sl.i + '=' + v, d.gSidesBad(bad, v));\n          refreshHint();", 'sides: hint 2 is not refreshed after a mistake (its number can go stale)');
        need("slots.forEach(function(x){ x.z.classList.toggle('ghint', x === sl); });", 'sides: the box hint 2 talks about is not marked');
        need("if (done === slots.length){", 'sides: the round is not solved exactly when every slot is filled');
      }

      /* --- 3f. 第 5 關：剪紙展開 --- */
      {
        let sawV = 0, sawH = 0;
        const firstRef = (e, painted) => {
          const cut = new Set(e.cut.map(c => c[0] + ',' + c[1]));
          for (let k = 0; k <= 4; k++) for (let d = 1; d <= 3; d++){ const key = d + ',' + k, a = cut.has(key), b = !!painted[key]; if (a !== b) return { kind:a ? 'miss' : 'extra', d:d, k:k }; }
          return null;
        };
        D.GAME_PAINT.forEach((e, ei) => {
          if (e.ax === 'v') sawV++; else sawH++;
          if (!e.cut.length || new Set(e.cut.map(String)).size !== e.cut.length || e.cut.some(c => c[0] < 1 || c[0] > 3 || c[1] < 0 || c[1] > 4)) fail('paint ' + ei + ': cut cells must be distinct, 1~3 from the fold, rows 0~4');
          const copy = {}; e.cut.forEach(c => { copy[(4 - c[0]) + ',' + c[1]] = true; });
          const exact = {}; e.cut.forEach(c => { exact[c[0] + ',' + c[1]] = true; });
          if (D.paintCheck(e, exact) !== null) fail('paintCheck(' + ei + '): the exact mirror is refused');
          /* 一模一樣再多塗一格：一定要被抓到，而且說的是那一格 */
          for (let d = 1; d <= 3; d++) for (let k = 0; k <= 4; k++){
            if (exact[d + ',' + k]) continue;
            const more = Object.assign({}, exact); more[d + ',' + k] = true;
            const got = D.paintCheck(e, more);
            if (!got || got.kind !== 'extra' || got.d !== d || got.k !== k){ fail('paintCheck: extra cell accepted or misreported (' + ei + ', ' + d + ',' + k + '): ' + JSON.stringify(got)); d = 4; break; }
          }
          /* 一格漏掉（較前面）＋一格多塗（較後面）：回報的是前面那一格 */
          const c0 = e.cut[0], extra = [3, 4].map(k => [1, 2, 3].map(d => [d, k])).flat().filter(c => !exact[c[0] + ',' + c[1]] && (c[1] > c0[1]))[0];
          if (extra){
            const mix = Object.assign({}, exact); delete mix[c0[0] + ',' + c0[1]]; mix[extra[0] + ',' + extra[1]] = true;
            const firstK = Math.min(...e.cut.map(c => c[1]));
            const want = firstRef(e, mix), got = D.paintCheck(e, mix);
            if (JSON.stringify(got) !== JSON.stringify(want)) fail('paintCheck: wrong first mismatch (' + ei + '): ' + JSON.stringify(got) + ' should be ' + JSON.stringify(want));
            void firstK;
          }
          /* 同一列裡一格漏掉、另一格多塗：回報的是離摺線比較近的那一格（由靠摺線的那一格找起） */
          let probed = 0;
          for (let k = 0; k <= 4 && !probed; k++){
            const cut = e.cut.filter(c => c[1] === k), empty = [1, 2, 3].filter(d => !exact[d + ',' + k]);
            if (!cut.length || !empty.length) continue;
            const mix = Object.assign({}, exact); delete mix[cut[0][0] + ',' + k]; mix[empty[0] + ',' + k] = true;
            const want = { kind:cut[0][0] < empty[0] ? 'miss' : 'extra', d:Math.min(cut[0][0], empty[0]), k:k }, got = D.paintCheck(e, mix);
            if (JSON.stringify(got) !== JSON.stringify(want)) fail('paintCheck: wrong first mismatch in a row (' + ei + '): ' + JSON.stringify(got) + ' should be ' + JSON.stringify(want));
            probed++;
          }
          if (!probed) fail('paint ' + ei + ': no row has both a cut and an uncut square — the in-row order probe cannot run');
          if (D.paintCheck(e, copy) === null) fail('paint ' + ei + ': copying across (not flipping) is accepted — the pattern is its own flip');
          /* 每一列至少有一格，圖案才看得出是什麼（每一列都有東西要想） */
          for (let k = 0; k <= 4; k++) if (!e.cut.some(c => c[1] === k)) fail('paint ' + ei + ': row ' + k + ' has nothing cut');
          /* 2000 個亂塗的樣子，第一個不對的格子和這裡自己找的一樣 */
          for (let t = 0; t < 2000; t++){
            const pt = {};
            for (let d = 1; d <= 3; d++) for (let k = 0; k <= 4; k++) if (Math.random() < (t % 2 ? 0.5 : 0.15)) pt[d + ',' + k] = true;
            if (t % 3 === 0) Object.assign(pt, exact);
            const got = D.paintCheck(e, pt), want = firstRef(e, pt);
            if (JSON.stringify(got) !== JSON.stringify(want)){ fail('paintCheck(' + ei + '): ' + JSON.stringify(got) + ' should be ' + JSON.stringify(want)); break; }
          }
          for (let k = 0; k <= 4; k++){ const want = e.cut.filter(c => c[1] === k).map(c => c[0]).sort((a, b) => a - b); if (JSON.stringify(D.paintRow(e, k)) !== JSON.stringify(want)) fail('paintRow(' + ei + ', ' + k + ') should be ' + want); }
          /* 方格：一格 U，兩半貼著摺線，左右（上下）互為鏡像，都在畫板裡；每 1px 點到哪一格 */
          const U = D.PAINT.U, H = D.PAINT_H[e.ax];
          tooSmall('paint square', U);
          for (let d = 1; d <= 3; d++) for (let k = 0; k <= 4; k++){
            const a = D.paintCell(e.ax, 0, d, k), b = D.paintCell(e.ax, 1, d, k);
            [a, b].forEach(r => inside(r, 'paint ' + ei + ' square', H));
            if (a.w !== U || a.h !== U) fail('paint: a square is not U');
            const axisPos = e.ax === 'v' ? D.PAINT.axis.v : D.PAINT.axis.h;
            const ca = e.ax === 'v' ? a.x + U / 2 : a.y + U / 2, cb = e.ax === 'v' ? b.x + U / 2 : b.y + U / 2;
            if (Math.abs((axisPos - ca) - (d - 0.5) * U) > 1e-9 || Math.abs((cb - axisPos) - (d - 0.5) * U) > 1e-9) fail('paint: square ' + d + ',' + k + ' is not ' + d + ' from the fold on each side');
            if ((e.ax === 'v' ? a.y !== b.y : a.x !== b.x)) fail('paint: square ' + d + ',' + k + ' and its mirror are not on the same row/column');
          }
          let mism = 0;
          for (let x = 0; x <= W; x += 1) for (let y = 0; y <= H; y += 1){
            let want = null;
            for (let d = 1; d <= 3; d++) for (let k = 0; k <= 4; k++){ const r = D.paintCell(e.ax, 1, d, k); if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) want = [d, k]; }
            if (String(D.paintPick(e.ax, { x:x, y:y })) !== String(want)) mism++;
          }
          if (mism) fail('paintPick(' + ei + '): ' + mism + ' board points disagree with the squares');
        });
        if (!sawV || !sawH) fail('paint: the pool needs both a vertical and a horizontal fold');
        need("var c = paintPick(ax, pt);", 'paint: the tapped point is not mapped with paintPick()');
        need("if (!count){ roundNote(d.gPaintEmpty); return; }", 'paint: "Unfold" with nothing painted is not a free reminder');
        need("var bad = paintCheck(e, painted);", 'paint: "Unfold" is not judged with paintCheck()');
        need("var stateKey = Object.keys(painted).sort().join(';');", 'paint: the same picture is not recognised as the same mistake');
        need("missOnce(seen, stateKey, bad.kind === 'miss' ? d.gPaintMiss(ax, bad.k + 1, bad.d) : d.gPaintExtra(ax, bad.k + 1, bad.d));", 'paint: a mistake is not charged once per picture');
      }

      /* --- 3g. 引擎與計分（字面） --- */
      need("var pts = gMistake ? 10 : 20;", 'scoring: a round should give +20 clean, +10 after mistakes');
      need("gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", 'scoring: a mistake does not cost 5 (floored at 0)');
      need("if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板", 'drag: a piece held across a rebuild can act on the new board (board generation guard missing)');
      need("if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", 'drag: a second finger can pick up a piece');
      need("      if (!e.isPrimary) return;   /* 第二根手指：不理 */", 'tap: a second finger can start a board tap');
      need("      if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;", 'tap: a press that slides before letting go counts as a board tap');
      need("el.addEventListener('lostpointercapture', function(e){ end(e, true); });", 'drag: losing pointer capture is not handled');
      need("elHint.textContent = '';   /* 過關了", 'the hint is not cleared when a round is solved');
      need("if (mode === 'ahead'){ hintLevel = 1; showHint(); }", 'ahead mode does not show hint level 1 automatically');
      need("gGen++; BOARD_TAP = null; PIECE_PTR = {};", 'startRound(): the board generation is not bumped');
      need("gameStage.textContent = '';", 'startRound(): the stage is not cleared before drawing');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('CSS: placed pieces still catch taps (.gpiece.locked needs pointer-events:none)');
      if (!/\.gpiece\{[^}]*touch-action:none/.test(src)) fail('CSS: pieces need touch-action:none');
      if (!/\.gsvg\{[^}]*pointer-events:none/.test(src)) fail('CSS: the board drawing must not catch taps');
      const restartBody = extractFunction(src, 'renderAll') || '';
      if (restartBody.indexOf('restartGame();') < 0) fail('renderAll(): switching language does not rebuild the game');

      /* --- 3h. 說明：每一個函式在它的整個定義域上，兩種語言的數字與意思 --- */
      const names = Object.keys(D.SORT_SHAPES).concat(D.GAME_FOLD.map(e => e.k));
      LANGS.forEach(L => {
        const d = I18N[L], zh = L === 'zh';
        names.forEach(k => { if (typeof d.gNames[k] !== 'string' || !d.gNames[k]) fail('gNames.' + k + ' ' + L + ' is missing'); });
        Object.keys(D.SORT_SHAPES).forEach(k => {
          const nm = d.gNames[k], ax = D.sortAxis(k);
          if (ax !== null){
            const t = d.gSortBadSym(nm, D.axisKind(ax));
            say('gSortBadSym ' + k, L, t, []);
            has('gSortBadSym ' + k, L, t, { zh:[nm, { v:'直的', h:'橫的', d:'斜的' }[D.axisKind(ax)], '完全重合', '是線對稱'], en:[nm, { v:'vertical', h:'horizontal', d:'slanted' }[D.axisKind(ax)], 'overlap exactly', 'is line-symmetric'] });
            say('gSortYes ' + k, L, d.gSortYes(nm), []);
          } else {
            const half = halfTurnRef(D.SORT_SHAPES[k]), t = d.gSortBadNot(nm, half);
            say('gSortBadNot ' + k, L, t, []);
            has('gSortBadNot ' + k, L, t, { zh:[nm, '對不齊', '沒有對稱軸'].concat(half ? ['轉半圈', '轉不是對摺'] : []), en:[nm, 'never line up', 'no axis of symmetry'].concat(half ? ['half turn', 'turning is not folding'] : []) });
            if (!half) hasNot('gSortBadNot ' + k, L, t, { zh:['轉半圈'], en:['half turn'] });
            say('gSortNo ' + k, L, d.gSortNo(nm), []);
          }
          const h2 = d.gSort2(nm, ax !== null);
          has('gSort2 ' + k, L, h2, { zh:[ax !== null ? '放進「線對稱」' : '放進「不是線對稱」'], en:[ax !== null ? 'put it in “Line-symmetric”' : 'put it in “Not line-symmetric”'] });
        });
        for (let k = 0; k <= 6; k++) say('gSortNow', L, d.gSortNow(k, 6), [k, 6]);
        has('gBinYes', L, d.gBinYes, { zh:['✓', '線對稱'], en:['✓', 'Line-symmetric'] });
        has('gBinNo', L, d.gBinNo, { zh:['✗', '不是'], en:['✗', 'Not'] });
        D.GAME_FOLD.forEach(e => {
          const nm = d.gNames[e.k], n = axesRef(e.pts);
          for (let f = 0; f < n; f++){
            const t = d.gFoldMore(nm, f);
            say('gFoldMore ' + e.k + ' ' + f, L, t, f === 0 ? [] : [f]);
            has('gFoldMore ' + e.k, L, t, { zh:[nm, f === 0 ? '有對稱軸' : '不只 ' + f + ' 條'], en:[nm, f === 0 ? 'does have at least one axis' : 'more than ' + f + (f === 1 ? ' axis ' : ' axes ')] });
          }
          const t = d.gFoldDone(nm, n);
          say('gFoldDone ' + e.k, L, t, n === 0 ? [] : [n]);
          has('gFoldDone ' + e.k, L, t, { zh:[nm, n === 0 ? '一條對稱軸都沒有' : '有 ' + n + ' 條對稱軸'], en:[nm, n === 0 ? 'no axis of symmetry' : 'has ' + n + (n === 1 ? ' axis' : ' axes')] });
          for (let f = 0; f <= n; f++){
            const h = d.gFold2(nm, n, f);
            say('gFold2 ' + e.k, L, h, n === 0 ? [2] : [2, n, f]);
          }
        });
        for (let k = 0; k <= 6; k++) say('gFoldNow', L, d.gFoldNow(k), [k]);
        if (!zh && !/^1 axis /.test(d.gFoldNow(1))) fail('gFoldNow en: 1 axis (singular)');
        has('gFoldNo', L, d.gFoldNo, { zh:['不是對稱軸'], en:['not an axis'] });
        has('gFoldYes', L, d.gFoldYes, { zh:['是對稱軸'], en:['is an axis'] });
        ['v', 'h'].forEach(ax => D.MIR_LETTERS.forEach(Lt => {
          for (let dd = 1; dd <= 3; dd++){
            say('gMirOk', L, d.gMirOk(Lt, dd), [dd]);
            for (let got = 0; got <= 3; got++) if (got !== dd) say('gMirDist', L, d.gMirDist(Lt, dd, got), [dd, dd, got]);
            say('gMir2', L, d.gMir2(Lt, dd, ax), [2, dd, dd]);
            has('gMir2', L, d.gMir2(Lt, dd, ax), { zh:[ax === 'v' ? '同一條橫線上' : '同一條直線上', '另一邊'], en:[ax === 'v' ? 'same row' : 'same column', 'other side'] });
          }
          has('gMirSide', L, d.gMirSide(Lt, ax), { zh:[ax === 'v' ? '左邊' : '上面', '另一邊'], en:[ax === 'v' ? 'left of' : 'above', 'other side'] });
          has('gMirRow', L, d.gMirRow(Lt, ax), { zh:[ax === 'v' ? '同一條橫線上' : '同一條直線上', '垂直'], en:[ax === 'v' ? 'same row' : 'same column', 'perpendicular'] });
          say('gMirSide', L, d.gMirSide(Lt, ax), []); say('gMirRow', L, d.gMirRow(Lt, ax), []);
        }));
        if (!zh && /1 squares/.test(d.gMirDist('A', 1, 2) + d.gMirOk('A', 1) + d.gMir2('A', 1, 'v'))) fail('gMir* en: "1 squares"');
        for (let k = 0; k <= 3; k++) say('gMirNow', L, d.gMirNow(k), [k, 3]);
        D.GAME_SIDES.forEach((e, ei) => e.ask.forEach(i => {
          if (D.sidesPartner(e, i) < 0) return;   /* 沒有對稱邊的那一筆上面已經報過了 */
          const p = D.sidesLen(e, D.sidesPartner(e, i));
          e.cards.forEach(v => { if (v !== p){ const t = d.gSidesBad(p, v); say('gSidesBad ' + ei, L, t, [p, v]); has('gSidesBad', L, t, { zh:['對稱邊一樣長', '不是 ' + v], en:['same length', 'not ' + v] }); } });
          say('gSidesOk', L, d.gSidesOk(p), [p]);
          say('gSides2', L, d.gSides2(p), [2, p]);
          has('gSides2', L, d.gSides2(p), { zh:['框起來的那個空格'], en:['highlighted box'] });
        }));
        for (let k = 0; k <= 3; k++) say('gSidesNow', L, d.gSidesNow(k, 3), [k, 3]);
        ['v', 'h'].forEach(ax => {
          for (let k = 1; k <= 5; k++) for (let dd = 1; dd <= 3; dd++){
            const m = d.gPaintMiss(ax, k, dd), x = d.gPaintExtra(ax, k, dd);
            say('gPaintMiss', L, m, [k, dd, dd]); say('gPaintExtra', L, x, [k, dd, dd]);
            has('gPaintMiss', L, m, { zh:[ax === 'v' ? '橫列' : '直行', '紅框', '剪掉'], en:[ax === 'v' ? 'Row' : 'Column', 'red frame', 'cut out too'] });
            has('gPaintExtra', L, x, { zh:[ax === 'v' ? '橫列' : '直行', '紅框', '沒有剪'], en:[ax === 'v' ? 'Row' : 'Column', 'red frame', 'is not cut'] });
          }
          D.GAME_PAINT.forEach(e => { for (let k = 0; k <= 4; k++){ const ds = D.paintRow(e, k), t = d.gPaint2(ax, k + 1, ds); say('gPaint2', L, t, [2, k + 1].concat(ds).concat(ds)); } });
        });
        for (let k = 0; k <= 15; k++) say('gPaintNow', L, d.gPaintNow(k), [k]);
        if (!zh && !/^1 square /.test(d.gPaintNow(1))) fail('gPaintNow en: 1 square (singular)');
        say('gPaintEmpty', L, d.gPaintEmpty, []);
        [0, 5, 100].forEach(sc => say('gWin', L, d.gWin(sc), zh ? [sc] : [5, sc]));
        [10, 20].forEach(p => say('gPts', L, d.gPts(p), [p]));
        say('gMinus', L, d.gMinus, [5]);
        has('s5lead', L, d.s5lead, { zh:['五關五種玩法', '對摺之後，兩邊會不會完全重合'], en:['five rounds', 'after folding, do the two sides overlap exactly'] });
        if (d.s5h2 !== (zh ? '對摺魔鏡闖關' : 'Folding Mirror Challenge')) fail('s5h2 ' + L + ': the game name changed');
      });
      /* 頁面上的備用字和中文字典是同一句（兩份一樣的句子，被蓋掉的那一份最容易爛掉） */
      ['s5h2', 's5lead'].forEach(k => {
        const m = src.match(new RegExp('data-i18n="' + k + '">([\\s\\S]*?)</(?:h2|p)>'));
        if (!m || m[1] !== I18N.zh[k]) fail('GAME ' + k + ': the markup fallback is not the same as the zh dictionary');
      });
    }
  }
};
