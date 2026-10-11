/* grade-5/math/prisms 的檢查設定（柱體錐體俱樂部：角柱、角錐、圓柱、圓錐、球；面稜頂點的規律；展開圖；分類）。
   2026-10-11 新增 —— 和小遊戲「立體點名」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的十二個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，不呼叫頁面的 fmt）、
   選項的形狀與範圍；渲染出來的那一題：解釋的算式逐條驗算、附的圖畫的就是題幹說的那一個立體、反推題不附圖（畫了就數得出答案）。

   data（index.html）：
   - 立體圖引擎：index／reference／review 三頁的引擎一字不差。每一個會被畫出來的立體（範例、試題、遊戲、複習）
     用這裡自己的 3D 模型與投影重算一次點的位置；哪一條稜看得到用**另一種方法**重判（從稜的中點往看的人射一條線，
     有沒有被別的面擋住），和頁面的實線／虛線逐條比；投影的凸包每一條邊都要是實線；平行的稜畫出來還是平行；
     面、稜、頂點的個數合 n ＋ 2／3n／2n（角錐 n ＋ 1／2n／n ＋ 1）與尤拉公式；拉成折線之後一條不多、一條不少。
   - 展開圖做摺紙測試：角柱的兩個底面是正 n 邊形、邊長等於長方形的寬、分別貼著某一個長方形的上邊與下邊、彼此不重疊；
     角錐的三角形全等、等腰、高比底面的內切圓半徑長（才收得到一點）；圓柱長方形的長 ＝ 圓周長、圓貼著長邊；
     圓錐扇形的弧長 ＝ 底面圓周長、圓貼著弧的正中間。
   - 範例 1、2 的讀數、範例 4 的說明、三層題庫的答案用自己的規律重算；I18N 靜態字串裡的算式逐條驗算。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍、每一句說明在每一種狀態都重算數字：
       數稜 —— 每一條稜的中點與 ±35% 點下去都點到它自己；整片畫板每 1px 和自己的「最近的稜」比；
       做角柱 —— 每一個題目只有一個邊數對；每一個邊數按「做好了」的說明算給他看的數都對；
       分家族 —— 自己的家族表；躺著／倒過來的那一句只在真的躺著／倒過來時出現；每一張圖卡**看得出**是哪一家（柱體看得到一個底面、另一個底面也畫出來；錐體畫出尖點）；
       拼展開圖 —— 每一種「哪一塊 × 接在哪一邊 × 已經接好的在哪一邊」都和自己的摺紙規則一致；
       填規律表 —— 卡片裡剛好有三個答案、兩個常見錯，每一張 × 每一格的收不收與說明。
     nearestOpen()、roundMiss()、missOnce()、roundSolved() 從原始碼切出來真的跑；托盤 3000 次不出現答案的排法；
     版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；RENDER 的規則與拖拉引擎的保護用原始碼形狀守住（need()）並以 sha1 釘住。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   真正的字寬、375px 的實際尺寸由 teaching-workspace/game-harness/g5-prisms 的端對端測試驗（合成 PointerEvent，從畫出來的圖讀數）。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { makeArith } = require('./lib/arith.js');

const arith = makeArith({ units:['個', '條', '分'], unitsEn:['faces?', 'edges?', 'vertices', 'vertex', 'sides?', 'rectangles?', 'triangles?', 'bases?', 'points'] });
/* 等號左邊是字（規則、名稱：「稜 ＝ 3 × 5」「faces = n + 2」）的不是宣稱 —— 換成冒號，只驗數的那一段 */
const ruleFix = s => String(s).replace(/([^\d\s)])\s*[=＝]/g, '$1：');
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }

/* ---------- 自己的規律（第二套實作：從「長什麼樣子」數，不用頁面的公式） ---------- */
/* 角柱：上下兩個 n 邊形 ＋ n 個側面；稜 ＝ 上一圈 ＋ 下一圈 ＋ 直的；頂點 ＝ 上 ＋ 下。角錐：一個底面 ＋ n 個三角形；稜 ＝ 底一圈 ＋ 斜的；頂點 ＝ 底 ＋ 尖點。 */
const own = (fam, n) => fam === 'prism' ? { f:2 + n, e:n + n + n, v:n + n } : { f:1 + n, e:n + n, v:n + 1 };
const ORD_ZH = { 3:'三角', 4:'四角', 5:'五角', 6:'六角', 7:'七角', 8:'八角', 9:'九角', 10:'十角' };
const ORD_EN = { 3:'triangular', 4:'quadrangular', 5:'pentagonal', 6:'hexagonal', 7:'heptagonal', 8:'octagonal', 9:'nonagonal', 10:'decagonal' };
const SHAPE_ZH = { 3:'三角形', 4:'四邊形', 5:'五邊形', 6:'六邊形', 7:'七邊形', 8:'八邊形', 9:'九邊形', 10:'十邊形' };
const SHAPE_EN = { 3:'triangle', 4:'quadrilateral', 5:'pentagon', 6:'hexagon', 7:'heptagon', 8:'octagon', 9:'nonagon', 10:'decagon' };
const solidName = (fam, n, L) => L === 'zh' ? ORD_ZH[n] + (fam === 'prism' ? '柱' : '錐') : ORD_EN[n] + (fam === 'prism' ? ' prism' : ' pyramid');

/* ---------- 自己的 3D：模型、姿勢、投影，與「被擋住了嗎」的射線測試 ---------- */
const deg = d => d * Math.PI / 180;
function refModel(kind, n, phase, shape, seg){
  const S = shape[kind], curved = kind === 'cylinder' || kind === 'cone', m = curved ? seg : n, V = [], F = [];
  const ring = y => Array.from({ length:m }, (_, k) => { const t = deg(phase + k * 360 / m); V.push([S.r * Math.cos(t), y, S.r * Math.sin(t)]); return V.length - 1; });
  const bot = ring(0);
  if (kind === 'prism' || kind === 'cylinder'){
    const top = ring(S.h);
    F.push({ v:bot, base:true }, { v:top, base:true });
    for (let i = 0; i < m; i++) F.push({ v:[bot[i], bot[(i + 1) % m], top[(i + 1) % m], top[i]], curved });
    return { V, F, apex:-1, m };
  }
  V.push([0, S.h, 0]);
  const apex = V.length - 1;
  F.push({ v:bot, base:true });
  for (let i = 0; i < m; i++) F.push({ v:[bot[i], bot[(i + 1) % m], apex], curved });
  return { V, F, apex, m };
}
function refPose(V, pose){
  pose = pose || {};
  const c = [0, 1, 2].map(k => V.reduce((s, p) => s + p[k], 0) / V.length);
  const r = deg(pose.roll || 0), y = deg(pose.yaw || 0);
  return V.map(p => {
    let x = p[0] - c[0], yy = p[1] - c[1], z = p[2] - c[2];
    [x, yy] = [x * Math.cos(r) - yy * Math.sin(r), x * Math.sin(r) + yy * Math.cos(r)];
    if (pose.flip){ yy = -yy; z = -z; }
    [x, z] = [x * Math.cos(y) + z * Math.sin(y), -x * Math.sin(y) + z * Math.cos(y)];
    return [x, yy, z];
  });
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/* 從點 M 往看的人（eye 方向）射一條線，有沒有打到 skip 以外的面（打到的點要在面的「裡面」，邊界不算） */
function occluded(M, V, F, skip, eye){
  for (let fi = 0; fi < F.length; fi++){
    if (skip.indexOf(fi) >= 0) continue;
    const f = F[fi].v, P0 = V[f[0]];
    let nrm = cross(sub(V[f[1]], P0), sub(V[f[2]], P0));
    const den = dot(nrm, eye);
    if (Math.abs(den) < 1e-12) continue;
    const t = dot(nrm, sub(P0, M)) / den;
    if (t <= 1e-7) continue;
    const H = [M[0] + t * eye[0], M[1] + t * eye[1], M[2] + t * eye[2]];
    let sign = 0, inside = true;
    for (let i = 0; i < f.length; i++){
      const a = V[f[i]], b = V[f[(i + 1) % f.length]], s = dot(cross(sub(b, a), sub(H, a)), nrm);
      const len = Math.sqrt(dot(sub(b, a), sub(b, a)) * dot(nrm, nrm));
      if (Math.abs(s) < 1e-7 * len){ inside = false; break; }   /* 剛好在邊上：不算擋住 */
      if (!sign) sign = Math.sign(s); else if (Math.sign(s) !== sign){ inside = false; break; }
    }
    if (inside) return true;
  }
  return false;
}
function hull(P){
  const idx = P.map((p, i) => i).sort((a, b) => P[a][0] - P[b][0] || P[a][1] - P[b][1]);
  const cr = (o, a, b) => (P[a][0] - P[o][0]) * (P[b][1] - P[o][1]) - (P[a][1] - P[o][1]) * (P[b][0] - P[o][0]);
  const lo = [], up = [];
  for (const i of idx){ while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], i) <= 1e-12) lo.pop(); lo.push(i); }
  for (const i of idx.slice().reverse()){ while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], i) <= 1e-12) up.pop(); up.push(i); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const segD = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
/* 兩個凸多邊形的內部有沒有重疊（分離軸；只碰到邊不算） */
function polysOverlap(A, B){
  for (const P of [A, B]) for (let i = 0; i < P.length; i++){
    const a = P[i], b = P[(i + 1) % P.length], ax = -(b[1] - a[1]), ay = b[0] - a[0];
    const pr = Q => Q.map(q => q[0] * ax + q[1] * ay);
    const pa = pr(A), pb = pr(B);
    if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
  }
  return true;
}
const polyArea = P => Math.abs(P.reduce((s, p, i) => s + p[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * p[1], 0)) / 2;
/* 一個多邊形是不是正 k 邊形、邊長 a（邊都一樣長、每一個內角都是 (k − 2) × 180 ÷ k） */
function regularOk(P, k, a){
  if (P.length !== k) return 'has ' + P.length + ' corners, not ' + k;
  for (let i = 0; i < k; i++){
    const p = P[i], q = P[(i + 1) % k], r = P[(i + 2) % k];
    if (Math.abs(Math.hypot(q[0] - p[0], q[1] - p[1]) - a) > 0.05) return 'side ' + i + ' is ' + Math.hypot(q[0] - p[0], q[1] - p[1]).toFixed(2) + ', not ' + a;
    const u = [p[0] - q[0], p[1] - q[1]], v = [r[0] - q[0], r[1] - q[1]];
    const ang = Math.acos((u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v))) * 180 / Math.PI;
    if (Math.abs(ang - (k - 2) * 180 / k) > 0.05) return 'angle ' + i + ' is ' + ang.toFixed(2);
  }
  return null;
}
/* 線段 AB 和 CD 是同一條（不分方向） */
const sameSeg = (A, B, C, D, tol) => (Math.hypot(A[0] - C[0], A[1] - C[1]) < tol && Math.hypot(B[0] - D[0], B[1] - D[1]) < tol) || (Math.hypot(A[0] - D[0], A[1] - D[1]) < tol && Math.hypot(B[0] - C[0], B[1] - C[1]) < tol);

const W = 300;

module.exports = {
  breaks: [
    {"file": "index", "expect": "GAME_ORDER should be", "find": "var GAME_ORDER = ['edges', 'build', 'sort', 'net', 'table'];", "replace": "var GAME_ORDER = ['build', 'edges', 'sort', 'net', 'table'];"},
    {"file": "index", "expect": "under 44", "find": "  var GPICK = 48;", "replace": "  var GPICK = 40;"},
    {"file": "index", "expect": "shuffle(): only", "find": "      var k = Math.floor(Math.random() * (j + 1));   /* 自足", "replace": "      var k = j;   /* 自足"},
    {"file": "index", "expect": "the tray started already sorted", "find": "    if (inOrder(t)) t.push(t.shift());\n", "replace": ""},
    {"file": "index", "expect": "scoring: a round should give", "find": "    var pts = gMistake ? 10 : 20;", "replace": "    var pts = 20;"},
    {"file": "index", "expect": "roundMiss() at", "find": "    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", "replace": "    elScore.textContent = gScore;"},
    {"file": "index", "expect": "roundMiss() at", "find": "'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", "replace": "'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');"},
    {"file": "index", "expect": "does not clear the hint", "find": "    elHint.textContent = '';   /* 過關了", "replace": "    /* 過關了"},
    {"file": "index", "expect": "does not clear the hint glow", "find": "gameStage.querySelectorAll('.sel, .gglow'), function(x){ x.classList.remove('sel'); x.classList.remove('gglow'); });", "replace": "gameStage.querySelectorAll('.sel'), function(x){ x.classList.remove('sel'); });"},
    {"file": "index", "expect": "nearestOpen() disagrees", "find": "      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", "replace": "      if (dc < bc){ bd = dd; bc = dc; best = b; }"},
    {"file": "index", "expect": "nearestOpen() disagrees", "find": "    return best && !best.done ? best : null;\n  }\n\n  function roundSolved", "replace": "    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  function roundSolved"},
    {"file": "index", "expect": "does not start a new board generation", "find": "gSolved = false; gMistake = false; gCtx = {}; gGen++; BOARD_TAP = null; PIECE_PTR = {};", "replace": "gSolved = false; gMistake = false; gCtx = {}; BOARD_TAP = null; PIECE_PTR = {};"},
    {"file": "index", "expect": "does not check its board generation", "find": "      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板", "replace": "      /* 這一塊屬於已經拿掉的畫板"},
    {"file": "index", "expect": "can be picked up by a second finger", "find": "if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", "replace": "if (P.locked || gSolved || start || gen !== gGen) return;"},
    {"file": "index", "expect": "losing pointer capture no longer", "find": "    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", "replace": ""},
    {"file": "index", "expect": "can start a board tap", "find": "      if (!e.isPrimary) return;   /* 第二根手指", "replace": "      /* 第二根手指"},
    {"file": "index", "expect": "a slide is taken as a tap", "find": "      if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;", "replace": "      if (false) return;"},
    {"file": "index", "expect": "a finger that went down on a piece", "find": "      if (PIECE_PTR[e.pointerId]) return;   /* 這根手指", "replace": "      /* 這根手指"},
    {"file": "index", "expect": "tap-then-tap can drop a piece that another finger", "find": "      if (P.busy()) return;   /* 這一塊正被另一根手指拖著", "replace": "      /* 這一塊正被另一根手指拖著"},
    {"file": "index", "expect": "placed pieces still catch taps", "find": ".gpiece.locked{cursor:default;pointer-events:none}", "replace": ".gpiece.locked{cursor:default}"},
    {"file": "index", "expect": "missing touch-action", "find": "  .gpiece{left:0;top:0;display:flex;align-items:center;justify-content:center;\n    touch-action:none;", "replace": "  .gpiece{left:0;top:0;display:flex;align-items:center;justify-content:center;\n    "},
    {"file": "index", "expect": "gets a viewBox", "find": "var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, 'aria-hidden':'true' });", "replace": "var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, viewBox:'0 0 ' + B.W + ' ' + B.H, 'aria-hidden':'true' });"},
    {"file": "index", "expect": "ahead mode no longer", "find": "    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", "replace": "    if (mode === 'ahead'){ hintLevel = 1; }"},
    {"file": "index", "expect": "not disabled after the second level", "find": "    if (hintLevel >= 2) gHintBtn.disabled = true;", "replace": ""},
    {"file": "index", "expect": "missOnce(): wrong A, B", "find": "    if (seen.keys[key]){ if (seen.last !== key){ seen.last = key; roundAgain(text); } return; }", "replace": "    if (seen.keys[key] && seen.last === key) return;"},
    {"file": "index", "expect": "roundAgain() must only", "find": "  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", "replace": "  function roundAgain(text){ gMistake = true; gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }"},
    {"file": "index", "expect": "roundNote()", "find": "  function roundNote(text){ gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }", "replace": "  function roundNote(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }"},
    {"file": "index", "expect": "never removed", "find": "    function stopGesture(){\n      if (!start) return;\n      start = null; pid = null;\n      document.removeEventListener('pointerup', onDocEnd);", "replace": "    function stopGesture(){\n      if (!start) return;\n      start = null; pid = null;\n      document.removeEventListener('pointercancel', onDocEnd);"},
    {"file": "index", "expect": "can return early", "find": "    var type = GAME_ORDER[gRound];\n    gSolved = false;", "replace": "    var type = GAME_ORDER[gRound];\n    if (gScore === 0 && gRound > 0) return;\n    gSolved = false;"},
    {"file": "index", "expect": "drawn solid/dashed the wrong way", "find": "vis:(nx * eye[0] + ny * eye[1] + nz * eye[2]) / len > 1e-6 };", "replace": "vis:(nx * eye[0] + ny * eye[1] + nz * eye[2]) / len > 0.3 };"},
    {"file": "index", "expect": "seam of the curved surface", "find": "      if (f1.curved && f2.curved){ if (f1.vis !== f2.vis) lines.push(", "replace": "      if (f1.curved && f2.curved){ if (f1.vis || f2.vis) lines.push("},
    {"file": "index", "expect": "two edges are drawn on top of each other", "find": "  function solidPhase(n){ var s = 360 / n; return 90 + s / 2 + (n % 2 === 0 ? s / 4 : 0); }", "replace": "  function solidPhase(n){ var s = 360 / n; return 90 + s / 2; }"},
    {"file": "index", "expect": "lines do not match the plan", "find": "          else if (a === ch[0]){ ch.unshift(b); used[t] = true; grew = true; }", "replace": "          else if (a === ch[0]){ ch.unshift(b); grew = true; }"},
    {"file": "index", "expect": "too flat or too steep", "find": "  var SOLID_EL = 22, SOLID_SEG = 48;", "replace": "  var SOLID_EL = 60, SOLID_SEG = 48;"},
    {"file": "index", "expect": "are not joined to the top edge and the bottom edge", "find": "    var bot = ngonOnEdge([x0 + (k + 1) * a, y0 + H], [x0 + k * a, y0 + H], n);", "replace": "    var bot = ngonOnEdge([x0 + (k + 1) * a, y0 + H + 4], [x0 + k * a, y0 + H + 4], n);"},
    {"file": "index", "expect": "could not meet at a tip", "find": "    var cx = 150, cy = 110, R = 40, slant = 55, base = [];", "replace": "    var cx = 150, cy = 110, R = 40, slant = 25, base = [];"},
    {"file": "index", "expect": "the circle’s circumference is", "find": "    var r = 24, H = 70, L = 2 * 3.14 * r, x0 = 14, y0 = 14 + 2 * r;", "replace": "    var r = 24, H = 70, L = 2 * 3 * r * 0.9, x0 = 14, y0 = 14 + 2 * r;"},
    {"file": "index", "expect": "it would not close up", "find": "    var r = 26, s = 78, ang = 360 * r / s,", "replace": "    var r = 26, s = 78, ang = 400 * r / s,"},
    {"file": "index", "expect": "does not touch the middle of the arc", "find": "circle:[apex[0], apex[1] + s + r] };", "replace": "circle:[apex[0], apex[1] + s + r + 8] };"},
    {"file": "index", "expect": "does not carry the same drawing engine", "find": "  var SOLID_EL = 22, SOLID_SEG = 48;", "replace": "  var SOLID_EL = 22, SOLID_SEG = 48;  "},
    {"file": "index", "expect": "sphere drawing", "find": "'\"></circle>' + arc(false) + arc(true) + '</svg>';", "replace": "'\"></circle>' + arc(false) + arc(true) + '<line class=\"edgeSolid\" x1=\"150\" y1=\"32\" x2=\"150\" y2=\"188\"></line></svg>';"},
    {"file": "index", "expect": "the keyed answer", "find": "{ stem:'六角柱有幾個面？', opts:['6','12','18','8'], ans:3,", "replace": "{ stem:'六角柱有幾個面？', opts:['6','12','18','8'], ans:0,"},
    {"file": "index", "expect": "prismLine(", "find": "      prismLine:function(name, c){ return name + '：面 <b>' + c.f + '</b>　稜 <b>' + c.e", "replace": "      prismLine:function(name, c){ return name + '：面 <b>' + c.v + '</b>　稜 <b>' + c.e"},
    {"file": "index", "expect": "example 4: the net captions", "find": "      else if (netSel.kind === 'prism') netCaption.innerHTML = d.netCaptionPrism(netSel.n);", "replace": "      else if (netSel.kind === 'prism') netCaption.innerHTML = d.netCaptionPrism(name);"},
    {"file": "index", "expect": "must not say \"柱\"", "find": "'展開圖：<strong>2 個' + polyShapeName(n, 'zh') + '＋'", "replace": "'展開圖：<strong>2 個' + polyShapeName(n, 'zh') + '柱＋'"},
    {"file": "index", "expect": "markup fallback", "find": "<h2 data-i18n=\"s7h2\">立體點名</h2>\n    <p class=\"lead\" data-i18n=\"s7lead\">數稜、", "replace": "<h2 data-i18n=\"s7h2\">立體點名</h2>\n    <p class=\"lead\" data-i18n=\"s7lead\">數一數稜、"},
    {"file": "index", "expect": "must say \"五關全破\"", "find": "'五關全破！總分 '", "replace": "'全部過關！總分 '"},
    {"file": "index", "expect": "gHints.edges zh: must say \"虛線\"", "find": "被擋住的稜畫成虛線，也要數。',\n        build: '角柱的規律", "replace": "被擋住的稜也要數。',\n        build: '角柱的規律"},
    {"file": "index", "expect": "edgePick() does not pick the nearest edge", "find": "    lines.forEach(function(L){ var d = segDist(pt, L.a, L.b); if (d < bd){ bd = d; best = L; } });", "replace": "    lines.forEach(function(L){ var d = segDist(pt, L.a, L.b); if (!best && d <= EDGE.tap){ bd = d; best = L; } });"},
    {"file": "index", "expect": "the tap band", "find": "var EDGE = { box:{ x:30, y:16, w:240, h:218 }, tap:24 }", "replace": "var EDGE = { box:{ x:30, y:16, w:240, h:218 }, tap:18 }"},
    {"file": "index", "expect": "should have 3 to 5 base sides", "find": "var GAME_EDGES = [[3, 77], [4, 9], [5, 54]];", "replace": "var GAME_EDGES = [[3, 77], [4, 9], [5, 54], [6, 0]];"},
    {"file": "index", "expect": "edges too close to tap apart", "find": "var GAME_EDGES = [[3, 77], [4, 9], [5, 54]];", "replace": "var GAME_EDGES = [[3, 77], [4, 45], [5, 54]];"},
    {"file": "index", "expect": "tapping an edge again is counted again", "find": "        if (marked[L.i]){ roundNote(d.gEdgeAgain); return; }", "replace": "        if (marked[L.i]){ roundMiss(d.gEdgeAgain); return; }"},
    {"file": "index", "expect": "not judged once per count", "find": "missOnce(seen, 'early' + (cnt.base + cnt.side), d.gEdgeEarly(hid));", "replace": "roundMiss(d.gEdgeEarly(hid));"},
    {"file": "index", "expect": "computed from the edges still missing", "find": "          var hid = left.some(function(L){ return L.k === 'hidden'; });", "replace": "          var hid = true;"},
    {"file": "index", "expect": "does not draw the same pyramid it judges", "find": "      drawSolidOnBoard(svg, 'pyramid', n, { phase:e[1] }, EDGE.box);", "replace": "      drawSolidOnBoard(svg, 'pyramid', n, null, EDGE.box);"},
    {"file": "index", "expect": "gEdgeEarly(false) zh: must not say", "find": "'。看看實線裡還有哪一條沒有變色。'", "replace": "' —— 虛線也要數。'"},
    {"file": "index", "expect": "gEdgeDone(", "find": "' 條，2 × ' + n + ' ＝ ' + (2 * n) + ' 條稜。'", "replace": "' 條，2 × ' + n + ' ＝ ' + (2 * n + 1) + ' 條稜。'"},
    {"file": "index", "expect": "coloured as", "find": "return { i:i, a:Q[L.a], b:Q[L.b], k:L.k, base:L.a !== p.apex && L.b !== p.apex };", "replace": "return { i:i, a:Q[L.a], b:Q[L.b], k:L.k, base:L.a !== p.apex };"},
    {"file": "index", "expect": "buildRefuse(", "find": "  function buildRefuse(attr, n, T){ var x = buildCount(attr, n); return x === T ? null : { x:x }; }", "replace": "  function buildRefuse(attr, n, T){ var x = buildCount(attr, n); return x >= T ? null : { x:x }; }"},
    {"file": "index", "expect": "buildCount(", "find": "  function buildCount(attr, n){ return prismCounts(n)[attr]; }", "replace": "  function buildCount(attr, n){ return pyramidCounts(n)[attr]; }"},
    {"file": "index", "expect": "must be reachable and not the starting prism", "find": "var GAME_BUILD = [['e', 6],", "replace": "var GAME_BUILD = [['e', 3],"},
    {"file": "index", "expect": "does not judge the shown prism", "find": "        var bad = buildRefuse(attr, nn, T);", "replace": "        var bad = buildRefuse(attr, BUILD.n0, T);"},
    {"file": "index", "expect": "gBuildBad(", "find": "' ＝ ' + x + ' ' + G_UNIT_ZH[attr] + '，不是 '", "replace": "' ＝ ' + (x + 1) + ' ' + G_UNIT_ZH[attr] + '，不是 '"},
    {"file": "index", "expect": "gBuildDone zh", "find": "'。每多一條底邊，就多 1 個面、3 條稜、2 個頂點。'", "replace": "'。每多一條底邊，就多 1 個面、2 條稜、2 個頂點。'"},
    {"file": "index", "expect": "go up to at least 8", "find": "var BUILD = { nMin:3, nMax:10,", "replace": "var BUILD = { nMin:3, nMax:7,"},
    {"file": "index", "expect": "a repeated wrong prism could be charged twice", "find": "missOnce(seen, nn, d.gBuildBad(attr, nn, bad.x, T));", "replace": "roundMiss(d.gBuildBad(attr, nn, bad.x, T));"},
    {"file": "index", "expect": "catch a mixed-up rule", "find": "var GAME_BUILD = [['e', 6], ['v', 5], ['f', 7], ['e', 4], ['v', 6], ['f', 6], ['e', 5], ['v', 7]];", "replace": "var GAME_BUILD = [['e', 7], ['v', 9], ['f', 7], ['e', 10], ['v', 10], ['f', 10], ['e', 9], ['v', 7]];"},
    {"file": "index", "expect": "a cylinder is in the prism family", "find": "return (k === 'prism' || k === 'cylinder') ? 'prism'", "replace": "return (k === 'prism') ? 'prism'"},
    {"file": "index", "expect": "sortRefuse(", "find": "  function sortRefuse(id, bin){ return sortFam(id) === SORT_BINS[bin] ? null : sortFam(id); }", "replace": "  function sortRefuse(id, bin){ return null; }"},
    {"file": "index", "expect": "says lying", "find": "    tent:{ kind:'prism', n:3, pose:{ phase:0, roll:90, yaw:55 }, lying:true },", "replace": "    tent:{ kind:'prism', n:3, pose:{ phase:0, roll:90, yaw:55 } },"},
    {"file": "index", "expect": "\"lying down\" is said", "find": "(it.lying ? '，躺著也一樣' : '')", "replace": "'，躺著也一樣'"},
    {"file": "index", "expect": "the same solid appears twice", "find": "['tent', 'can', 'prism6', 'pyr4', 'icecream', 'ball'],", "replace": "['tent', 'can', 'log', 'pyr4', 'icecream', 'ball'],"},
    {"file": "index", "expect": "accept zone is not its label plus its box", "find": "function sortBin(b){ var top = SORT.lblY,", "replace": "function sortBin(b){ var top = SORT.bodyY,"},
    {"file": "index", "expect": "needs two lines", "find": "lblY:180, lblH:46, bodyY:228", "replace": "lblY:180, lblH:30, bodyY:228"},
    {"file": "index", "expect": "the snap margin of bin", "find": "bodyY:228, bodyH:98, thumb:40, pad:8 }", "replace": "bodyY:228, bodyH:98, thumb:40, pad:14 }"},
    {"file": "index", "expect": "small pictures of bin", "find": "y:SORT.bodyY + 6 + SORT.thumb / 2 + Math.floor(k / 2) * (SORT.thumb + 6) }; }", "replace": "y:SORT.bodyY + 6 + SORT.thumb / 2 + Math.floor(k / 2) * (SORT.thumb - 6) }; }"},
    {"file": "index", "expect": "does not show its two bases", "find": "    log:{ kind:'cylinder', n:0, pose:{ roll:90, yaw:30 }, lying:true },", "replace": "    log:{ kind:'cylinder', n:0, pose:{ roll:90, yaw:0 }, lying:true },"},
    {"file": "index", "expect": "does not judge with sortRefuse", "find": "var id = P.data.id, bad = sortRefuse(id, bin.b);", "replace": "var id = P.data.id, bad = sortRefuse(id, 0);"},
    {"file": "index", "expect": "not shuffled out of the bin order", "find": "      var cards = sortTray(set).map(", "replace": "      var cards = set.map("},
    {"file": "index", "expect": "the same card in the same wrong bin could be charged twice", "find": "missOnce(seen, id + '@' + bin.b, d.gSortBad(bad, SORT_ITEMS[id]));", "replace": "roundMiss(d.gSortBad(bad, SORT_ITEMS[id]));"},
    {"file": "index", "expect": "netRefuse(", "find": "    if (baseSide && side === baseSide) return 'same';\n", "replace": ""},
    {"file": "index", "expect": "netRefuse(", "find": "    if (k !== n) return 'decoy';\n", "replace": ""},
    {"file": "index", "expect": "the decoy has", "find": "  function netDecoy(n){ return n === 3 ? 4 : n - 1; }", "replace": "  function netDecoy(n){ return n === 3 ? 3 : n - 1; }"},
    {"file": "index", "expect": "is not the box the base covers", "find": "cy:y0 - up / 2, hw:a / 2, hh:up / 2, edge:", "replace": "cy:y0 - up / 2, hw:a / 2, hh:up, edge:"},
    {"file": "index", "expect": "a placed base is not snapped onto its rectangle edge", "find": "        P.lock(s.cx, s.cy);   /* 多邊形", "replace": "        P.lock(s.cx, s.cy - 4);   /* 多邊形"},
    {"file": "index", "expect": "the first base’s side is not remembered", "find": "        baseSide = s.side;\n", "replace": ""},
    {"file": "index", "expect": "a 4-sided prism is a box", "find": "  var GAME_NET = [3, 5, 6];", "replace": "  var GAME_NET = [3, 4, 5, 6];"},
    {"file": "index", "expect": "leave less than 20px", "find": "var NETG = { RH:56, top:12, trayGap:18, trayX:[54, 150, 246], pad:10,", "replace": "var NETG = { RH:56, top:12, trayGap:18, trayX:[54, 150, 246], pad:20,"},
    {"file": "index", "expect": "gNetSame zh", "find": "'兩個底面都接在' + (top ? '上面' : '下面')", "replace": "'兩個底面都接在' + (top ? '下面' : '上面')"},
    {"file": "index", "expect": "gNetDecoy zh", "find": "'這一塊是 ' + k + ' 邊形。側面有 ' + n + ' 個長方形", "replace": "'這一塊是 ' + n + ' 邊形。側面有 ' + n + ' 個長方形"},
    {"file": "index", "expect": "the wrong polygon could be charged twice", "find": "missOnce(seen, 'decoy', d.gNetDecoy(P.data.k, n))", "replace": "roundMiss(d.gNetDecoy(P.data.k, n))"},
    {"file": "index", "expect": "the tray should be two", "find": "  function netTray(n){ return shuffle([n, n, netDecoy(n)]); }", "replace": "  function netTray(n){ return shuffle([n, netDecoy(n), netDecoy(n)]); }"},
    {"file": "index", "expect": "should be the misconceptions", "find": "return fam === 'prism' ? [c.f, c.e, c.v, n, n + 1] : [c.f, c.e, c.v, 3 * n, n]; }", "replace": "return fam === 'prism' ? [c.f, c.e, c.v, n, 4 * n] : [c.f, c.e, c.v, 3 * n, n]; }"},
    {"file": "index", "expect": "tableRefuse(", "find": "return want === val ? null : { want:want }; }", "replace": "return null; }"},
    {"file": "index", "expect": "the slots should be faces, edges, vertices", "find": "  var TABLE_ATTR = ['f', 'e', 'v'];", "replace": "  var TABLE_ATTR = ['f', 'v', 'e'];"},
    {"file": "index", "expect": "the base should have 9 to 20 sides", "find": "var GAME_TABLE = [['prism', 12],", "replace": "var GAME_TABLE = [['prism', 6],"},
    {"file": "index", "expect": "slot 0 accept zone is not its label plus its box", "find": "  function tableHit(s){ var top = TABLE.lblY,", "replace": "  function tableHit(s){ var top = TABLE.slotY,"},
    {"file": "index", "expect": "the snap margin of slot", "find": "trayY:[140, 140, 140, 200, 200], pad:8 }", "replace": "trayY:[140, 140, 140, 200, 200], pad:40 }"},
    {"file": "index", "expect": "gTableBad(", "find": "(attr === 'e' ? '上底 ' + n + ' 條、下底 ' + n + ' 條、連接上下的 ' + n + ' 條' :", "replace": "(attr === 'e' ? '上底 ' + n + ' 條、下底 ' + n + ' 條' :"},
    {"file": "index", "expect": "GAME table cards", "find": "trayX:[52, 150, 248, 101, 199], trayY:[140, 140, 140, 200, 200]", "replace": "trayX:[52, 150, 248, 101, 150], trayY:[140, 140, 140, 200, 170]"},
    {"file": "index", "expect": "both prisms and pyramids", "find": "var GAME_TABLE = [['prism', 12], ['pyramid', 10], ['prism', 9], ['pyramid', 15], ['prism', 20], ['pyramid', 12]];", "replace": "var GAME_TABLE = [['prism', 12], ['prism', 10], ['prism', 9], ['prism', 15], ['prism', 20], ['prism', 11]];"},
    {"file": "index", "expect": "the same card in the same wrong slot could be charged twice", "find": "missOnce(seen, P.data.v + '@' + s.s, ", "replace": "missOnce(seen, P.data.v + '@' + Math.random(), "},
    {"file": "index", "expect": "the table tray is not shuffled", "find": "      var cards = tableTray(fam, n).map(", "replace": "      var cards = tableCards(fam, n).map("},
    {"file": "reference", "expect": "reference.html does not carry the same drawing engine", "find": "  var SOLID_EL = 22, SOLID_SEG = 48;", "replace": "  var SOLID_EL = 24, SOLID_SEG = 48;"},
    {"file": "review", "expect": "review.html does not carry the same drawing engine", "find": "  var SOLID_EL = 22, SOLID_SEG = 48;", "replace": "  var SOLID_EL = 22, SOLID_SEG = 40;", "via": "index"},
    {"file": "review", "expect": "opts[ans] != correct", "find": "        var ans = d.ks.indexOf(d.n);", "replace": "        var ans = 1;"},
    {"file": "review", "expect": "a picture of the answer is attached", "find": "          opts: names, ans: ans,   /* 不放圖", "replace": "          pic: drawPrismSVG(d.n), opts: names, ans: ans,   /* 不放圖"},
    {"file": "review", "expect": "copied straight out of the stem", "find": "        var m = mixOpts(vol, [l * w, w * h, l * h], [l, w, h]);", "replace": "        var m = mixOpts(vol, [l * w, w * h, l * h]);"},
    {"file": "review", "expect": "is not a named polygon", "find": "var POLY_SHAPE_ZH = {3:'三角形',4:'四邊形',5:'五邊形',6:'六邊形',7:'七邊形',8:'八邊形',9:'九邊形',10:'十邊形'};", "replace": "var POLY_SHAPE_ZH = {3:'三角形',4:'四邊形',5:'五邊形',6:'六邊形',7:'七邊形',8:'八邊形'};"},
    {"file": "review", "expect": "prismFaces: the why", "find": "            ? 'n 角柱的面 = n+2，' + d.n + '+2 = ' + d.c.f + '。'", "replace": "            ? 'n 角柱的面 = n+2，n+2 = ' + d.c.f + '。'"},
    {"file": "review", "expect": "reverseCount: options", "find": "        var lo = Math.max(3, n - 1), ks = shuffle([lo, lo + 1, lo + 2, lo + 3]);", "replace": "        var lo = n - 1, ks = shuffle([lo, lo + 1, lo + 2, lo + 3]);"},
    {"file": "review", "expect": "the picture has", "find": "          stem: (lang === 'zh' ? prismName(d.n,'zh') + '有幾條稜？' : 'How many edges does a ' + prismName(d.n,'en') + ' have?'),\n          pic: drawPrismSVG(d.n),", "replace": "          stem: (lang === 'zh' ? prismName(d.n,'zh') + '有幾條稜？' : 'How many edges does a ' + prismName(d.n,'en') + ' have?'),\n          pic: drawPyramidSVG(d.n),"},
    {"file": "review", "expect": "a cone’s tip is a vertex", "find": "        var attr = shape === 'cone' ? 'e' : pick(['e', 'v']);", "replace": "        var attr = pick(['e', 'v']);"},
    {"file": "review", "expect": "solidFact: a cuboid", "find": "        var VALUES = { face:6, edge:12, vertex:8 };", "replace": "        var VALUES = { face:6, edge:12, vertex:6 };"},
    {"file": "index", "expect": "the net pieces are not all one style", "find": "cls:'gngonp', node:ngonSvg(k, a, w, h, false),", "replace": "cls:'gngonp' + (k === n ? '' : ' godd'), node:ngonSvg(k, a, w, h, false),"},
    {"file": "index", "expect": "extra CSS rules for the pieces", "find": "  .gngon{fill:var(--green-soft);", "replace": "  .godd .gngon{fill:#FDF0E0}\n  .gngon{fill:var(--green-soft);"},
    {"file": "index", "expect": "ngonSvg() paints a polygon", "find": "s.appendChild(svgEl('polygon', { 'class':'gngon', 'data-k':k,", "replace": "s.appendChild(svgEl('polygon', { 'class':'gngon', fill:k % 2 ? '#E3F4EB' : '#FDF0E0', 'data-k':k,"},
    {"file": "index", "expect": "the number cards are not all one style", "find": "cls:'gcard gnum', text:String(v),", "replace": "cls:'gcard gnum' + (v > 2 * n ? ' gbig' : ''), text:String(v),"},
    {"file": "index", "expect": "the sort cards are not all one style", "find": "cls:'gcard gshape', node:node,", "replace": "cls:'gcard gshape' + (sortFam(id) === 'sphere' ? ' gball' : ''), node:node,"},
    {"file": "index", "expect": "attribute or :has() selectors", "find": "  .gngonp{background:transparent}", "replace": "  .gngonp{background:transparent}\n  .gngonp[aria-label=\"4\"] .gngon{fill:#FDF0E0}"},
    {"file": "index", "expect": "the page CSS changed since the e2e", "find": "  .gnote{color:var(--muted);font-weight:700}", "replace": "  .gnote{color:var(--muted);font-weight:700}\n  .gshape:nth-child(odd){border-color:#ccc}"},
    {"file": "index", "expect": "the page script changed since the e2e", "find": "  renderAll();\n  try { localStorage.setItem('teachme-last'", "replace": "  renderAll();\n  setInterval(function(){ Array.prototype.forEach.call(document.querySelectorAll('.gnum'), function(e){ if (+e.textContent % 2) e.style.color = 'red'; }); }, 200);\n  try { localStorage.setItem('teachme-last'"},
    {"file": "index", "expect": "the page script changed since the e2e", "find": "      gTableNow: function(k){ return '填好了 ' + k + ' / 3 格'; },", "replace": "      gTableNow: function(k){ setTimeout(function(){ Array.prototype.forEach.call(document.querySelectorAll('.gnum'), function(e){ e.style.color = 'red'; }); }, 0); return '填好了 ' + k + ' / 3 格'; },"},
    {"file": "index", "expect": "exactly one <script>", "find": "</body>\n</html>", "replace": "<script>document.querySelectorAll('.gnum').forEach(function(e){ e.style.color = 'red'; });</script>\n</body>\n</html>"},
    {"file": "index", "expect": "no inline on", "find": "  <!-- 學完之後 -->", "replace": "  <svg/onload=\"document.body.style.color='red'\"></svg>\n  <!-- 學完之後 -->"},
    {"file": "index", "expect": "a tap far from every edge would still mark one", "find": "var EDGE = { box:{ x:30, y:16, w:240, h:218 }, tap:24 }", "replace": "var EDGE = { box:{ x:30, y:16, w:240, h:218 }, tap:200 }"},
    {"file": "index", "expect": "nearly square", "find": "  function netSide(n){ return n === 3 ? 48 : (n === 5 ? 46 : 40); }", "replace": "  function netSide(n){ return n === 3 ? 56 : (n === 5 ? 46 : 40); }"},
    {"file": "review", "expect": "is declared or reassigned outside the shared engine block in review.html", "find": "  applyStatic();\n  buildQuiz();\n})();", "replace": "  applyStatic();\n  solidSVG = function(){ return ''; };\n  buildQuiz();\n})();", "via": "index"},
    {"file": "review", "expect": "sphereFact: the why for statement", "find": "whyZh:'頂點是稜與稜交會的角；球沒有稜，也沒有頂點。'", "replace": "whyZh:'頂點是稜與稜交會的角；球沒有稜，也沒有頂點；可是球有一個頂點。'"},
    {"file": "review", "expect": "sphereFact: the why for statement", "find": "whyEn:'A vertex is a corner where edges meet; a sphere has no edges, so it has no vertex either.' },", "replace": "whyEn:'A vertex is a corner where edges meet; a sphere has no edges, so it has no vertex either — but it has a vertex on top.' },"},
    {"file": "index", "expect": "roundInfo() (a correct placement)", "find": "  function roundInfo(text){ gMsg.innerHTML = '<span class=\"yes\">' + text + '</span>'; }", "replace": "  function roundInfo(text){ roundMiss(text); }"},
    {"file": "index", "expect": "is declared or reassigned outside the shared engine block", "find": "  langBtn.addEventListener('click', function(){", "replace": "  solidSVG = function(){ return '<svg viewBox=\"0 0 300 220\"></svg>'; };\n  langBtn.addEventListener('click', function(){"},
    {"file": "index", "expect": "curved sides are 48 facets", "find": "  var SOLID_EL = 22, SOLID_SEG = 48;", "replace": "  var SOLID_EL = 22, SOLID_SEG = 24;"},
    {"file": "index", "expect": "but it faces", "find": "    var lines = [];\n    list.forEach(function(E){", "replace": "    var lines = [];\n    faces.forEach(function(f){ if (f.base) f.vis = true; });\n    list.forEach(function(E){"},
    {"file": "index", "expect": "prism net 3: the drawn SVG is not the checked net", "find": "    if (kind === 'prism') return drawPrismNetSVG(n);\n    if (kind === 'pyramid') return drawPyramidNetSVG(n);\n    if (kind === 'cylinder') return drawCylinderNetSVG();\n    return drawConeNetSVG();", "replace": "    if (kind === 'prism') return drawPyramidNetSVG(n);\n    if (kind === 'pyramid') return drawPyramidNetSVG(n);\n    if (kind === 'cylinder') return drawCylinderNetSVG();\n    return drawConeNetSVG();"},
    {"file": "index", "expect": "qs.0 zh: the stem does not name", "find": "{ stem:'六角柱有幾個面？',", "replace": "{ stem:'七角錐有幾個面？',"},
    {"file": "index", "expect": "examples 1–2: the reading does not use the same n", "find": "        var c = cfg.counts(n);\n        lineEl.innerHTML", "replace": "        var c = cfg.counts(n + 1);\n        lineEl.innerHTML"},
    {"file": "index", "expect": "the pool should be the 3-, 4- and 5-sided pyramids", "find": "var GAME_EDGES = [[3, 77], [4, 9], [5, 54]];", "replace": "var GAME_EDGES = [[3, 77]];"},
    {"file": "index", "expect": "the pool should be the 3-, 5- and 6-sided prisms", "find": "  var GAME_NET = [3, 5, 6];", "replace": "  var GAME_NET = [3];"},
    {"file": "index", "expect": "GAME edge message en is empty", "find": "      gEdge2: function(hid){ return 'One edge you have not tapped is flashing' + (hid ? ' (it is a hidden, dashed one).' : '.'); },", "replace": "      gEdge2: function(hid){ return hid ? 'One edge you have not tapped is flashing (it is a hidden, dashed one).' : ''; },"},
    {"file": "index", "expect": "does not name the bin it was put in", "find": "      gSortOk: function(bin){ return '放對了 —— ' + bin + '。'; },", "replace": "      gSortOk: function(bin){ return '放對了 —— 球。'; },"},
    {"file": "index", "expect": "unexpected SVG content", "find": "    if (plan.apex >= 0) svg += '<circle class=\"apexDot\"", "replace": "    svg += '<rect x=\"0\" y=\"0\" width=\"300\" height=\"220\" fill=\"#fff\"></rect>';\n    if (plan.apex >= 0) svg += '<circle class=\"apexDot\""},
    {"file": "index", "expect": "GAME pin: RENDER.edges", "find": "      var line = trailLine(d.gEdgeNow(0, 0));", "replace": "      if (n === 4) return;\n      var line = trailLine(d.gEdgeNow(0, 0));"},
    {"file": "review", "expect": "polygonName: the why does not name", "find": "            ? d.n + ' 條邊的多邊形叫做' + polyShapeName(d.n, 'zh') + '。'", "replace": "            ? d.n + ' 條邊的多邊形叫做' + polyShapeName(d.n === 8 ? 7 : d.n + 1, 'zh') + '。'"},
    {"file": "review", "expect": "cylinderConeFact: says a cone has no corner", "find": "，不是直直的稜，所以稜是 0。", "replace": "，也沒有角，所以稜是 0。"},
    {"file": "review", "expect": "reverseCount: wrong classifier", "find": "'有 ' + d.given + ' ' + (d.attr === 'e' ? '條' : '個') + kindLabel", "replace": "'有 ' + d.given + ' 個' + kindLabel"}
  ],

  sim: {
    blockStart: '/* ---------- 幾何工具（與 index.html 相同邏輯） ---------- */',
    optCount: { sphereFact:2, '*':4 },
    INVARIANTS: {
      prismFaces: d => { if (d.c.f !== own('prism', d.n).f) return 'prismFaces: f ' + d.c.f + ' for n ' + d.n; },
      prismEdges: d => { if (d.c.e !== own('prism', d.n).e) return 'prismEdges: e ' + d.c.e + ' for n ' + d.n; },
      prismVerts: d => { if (d.c.v !== own('prism', d.n).v) return 'prismVerts: v ' + d.c.v + ' for n ' + d.n; },
      pyramidFaces: d => { if (d.c.f !== own('pyramid', d.n).f) return 'pyramidFaces: f ' + d.c.f + ' for n ' + d.n; },
      pyramidEdges: d => { if (d.c.e !== own('pyramid', d.n).e) return 'pyramidEdges: e ' + d.c.e + ' for n ' + d.n; },
      pyramidVerts: d => { if (d.c.v !== own('pyramid', d.n).v) return 'pyramidVerts: v ' + d.c.v + ' for n ' + d.n; },
      cylinderConeFact: d => { if (['cylinder', 'cone'].indexOf(d.shape) < 0 || (d.shape === 'cone' && d.attr !== 'e') || ['e', 'v'].indexOf(d.attr) < 0) return 'cylinderConeFact: asks ' + d.attr + ' of a ' + d.shape + ' (a cone’s tip is a vertex — only ask its edges)'; },
      sphereFact: d => { const T = [false, true, false, true]; if (!(d.idx >= 0 && d.idx < 4) || d.s.truth !== T[d.idx]) return 'sphereFact: statement ' + d.idx + ' has the wrong truth value'; },
      reverseCount: d => {
        if (d.given !== own(d.shape, d.n)[d.attr]) return 'reverseCount: given ' + d.given + ' is not the ' + d.attr + ' of the ' + d.n + '-gonal ' + d.shape;
        if (!Array.isArray(d.ks) || d.ks.length !== 4 || new Set(d.ks).size !== 4 || d.ks.indexOf(d.n) < 0 || d.ks.some(k => !(k >= 3 && k <= 11))) return 'reverseCount: options ' + d.ks + ' must be 4 different base sizes ≥ 3 including ' + d.n;
        /* 角錐的面和頂點規則一樣（n ＋ 1）—— 那不影響答案唯一：每一種規則對 n 都是一對一 */
        if (d.ks.filter(k => own(d.shape, k)[d.attr] === d.given).length !== 1) return 'reverseCount: more than one option has ' + d.given + ' ' + d.attr;
      },
      solidFact: d => { const T = { face:6, edge:12, vertex:8 }; if (d.correct !== T[d.attr]) return 'solidFact: a cuboid’s ' + d.attr + ' is ' + T[d.attr] + ', not ' + d.correct; },
      volumeFact: d => { if (d.vol !== d.l * d.w * d.h) return 'volumeFact: vol != l × w × h'; },
      polygonName: d => { if (!Array.isArray(d.ks) || d.ks.length !== 4 || new Set(d.ks).size !== 4 || d.ks.indexOf(d.n) < 0 || d.ks.some(k => !SHAPE_ZH[k])) return 'polygonName: options ' + d.ks + ' must be 4 different named polygons including ' + d.n; }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'prismFaces': return String(own('prism', d.n).f);
        case 'prismEdges': return String(own('prism', d.n).e);
        case 'prismVerts': return String(own('prism', d.n).v);
        case 'pyramidFaces': return String(own('pyramid', d.n).f);
        case 'pyramidEdges': return String(own('pyramid', d.n).e);
        case 'pyramidVerts': return String(own('pyramid', d.n).v);
        case 'cylinderConeFact': return '0';
        case 'sphereFact': { const T = [false, true, false, true][d.idx]; return lang === 'zh' ? (T ? '對' : '不對') : (T ? 'True' : 'False'); }
        case 'reverseCount': return solidName(d.shape, d.n, lang);
        case 'solidFact': return String({ face:6, edge:12, vertex:8 }[d.attr]);
        case 'volumeFact': return String(d.l * d.w * d.h);
        case 'polygonName': return lang === 'zh' ? SHAPE_ZH[d.n] : SHAPE_EN[d.n];
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang, isCorrect){
      if (genId === 'sphereFact') return (lang === 'zh' ? ['對', '不對'] : ['True', 'False']).indexOf(s) >= 0 ? null : 'option "' + s + '" is not true/false';
      if (genId === 'reverseCount'){
        const names = [];
        for (let k = 3; k <= 11; k++) ['prism', 'pyramid'].forEach(f => { if (ORD_ZH[k]) names.push(solidName(f, k, lang)); });
        return names.indexOf(s) >= 0 ? null : 'option "' + s + '" is not a properly named prism/pyramid (3 to 10 sides)';
      }
      if (genId === 'polygonName') return Object.values(lang === 'zh' ? SHAPE_ZH : SHAPE_EN).indexOf(s) >= 0 ? null : 'option "' + s + '" is not a named polygon';
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      const v = +s;
      /* 範圍從各產生器自己的題庫推出來：角柱、角錐 n ＝ 3～8，最大的數是 3 × 8 ＝ 24（誘答 ±1 再多一點） */
      const MAX = { prismFaces:26, prismEdges:26, prismVerts:26, pyramidFaces:26, pyramidEdges:26, pyramidVerts:26, cylinderConeFact:3, solidFact:14, volumeFact:9 * 6 * 6 + 3 }[genId];
      if (MAX === undefined) return 'unknown generator ' + genId;
      if (v > MAX || (v < 1 && genId !== 'cylinderConeFact')) return 'option ' + v + ' outside the range for ' + genId;
    },
    renderCheck: function(d, q, lang, genId){
      const pr = arith(ruleFix(q.why)).problems;
      if (pr.length) return genId + ': the why is wrong — ' + pr[0];
      /* 解釋要用題目自己的 n（「6+2 = 8」的 6 就是六角柱的 6） */
      if (/^(prism|pyramid)(Faces|Edges|Verts)$/.test(genId)){
        const fam = genId.indexOf('prism') === 0 ? 'prism' : 'pyramid', attr = { Faces:'f', Edges:'e', Verts:'v' }[genId.replace(/^(prism|pyramid)/, '')];
        if (nums(q.why).indexOf(d.n) < 0 || nums(q.why).slice(-1)[0] !== own(fam, d.n)[attr]) return genId + ': the why does not work it out from n = ' + d.n + ' — "' + q.why + '"';
        if (q.stem.indexOf(solidName(fam, d.n, lang)) < 0) return genId + ': the stem does not name the ' + solidName(fam, d.n, lang);
        /* 附的圖：畫的就是那一個立體（從畫出來的折線數稜：角柱 3n、角錐 2n） */
        const segs = (q.pic.match(/<polyline[^>]*points="([^"]+)"/g) || []).reduce((s, pl) => s + pl.match(/points="([^"]+)"/)[1].trim().split(/\s+/).length - 1, 0);
        if (segs !== own(fam, d.n).e) return genId + ': the picture has ' + segs + ' edges, not the ' + own(fam, d.n).e + ' of a ' + solidName(fam, d.n, 'en');
      }
      if (genId === 'reverseCount'){
        if (q.pic) return 'reverseCount: a picture of the answer is attached — counting its base sides gives the answer without any reasoning';
        if (nums(q.stem).join() !== String(d.given)) return 'reverseCount: the stem should give just ' + d.given;
      }
      if (genId === 'cylinderConeFact' && d.shape === 'cone' && /頂點|vert/.test(q.stem)) return 'cylinderConeFact: asks a cone’s vertices';
      if (genId === 'cylinderConeFact'){
        const nm = { cylinder:{ zh:'圓柱', en:'cylinder' }, cone:{ zh:'圓錐', en:'cone' } }[d.shape][lang];
        if (q.stem.indexOf(nm) < 0 || (d.attr === 'e' ? !/彎|curved/.test(q.why) : !/沒有稜|no edges/.test(q.why))) return 'cylinderConeFact: the stem/why do not explain the ' + d.attr + ' of a ' + d.shape + ' — "' + q.why + '"';
        if (d.shape === 'cone' && /沒有角|no corner/.test(q.why)) return 'cylinderConeFact: says a cone has no corner (its tip is one)';
        if (lang === 'zh' && q.stem.indexOf(d.attr === 'e' ? '幾條稜' : '幾個頂點') < 0) return 'cylinderConeFact: wrong classifier in "' + q.stem + '"';
      }
      if (genId === 'polygonName' && q.why.indexOf(lang === 'zh' ? SHAPE_ZH[d.n] : SHAPE_EN[d.n]) < 0) return 'polygonName: the why does not name the ' + d.n + '-sided polygon';
      if (genId === 'reverseCount' && lang === 'zh' && q.stem.indexOf(d.given + ' ' + (d.attr === 'e' ? '條稜' : (d.attr === 'f' ? '個面' : '個頂點'))) < 0) return 'reverseCount: wrong classifier in "' + q.stem + '"';
      if (genId === 'reverseCount' && q.why.indexOf(solidName(d.shape, d.n, lang)) < 0) return 'reverseCount: the why does not name the answer';
      if (genId === 'sphereFact' && (lang === 'zh' ? q.stem.indexOf(d.s.zh) : q.stem.indexOf(d.s.en)) < 0) return 'sphereFact: the stem is not the statement';
      if (genId === 'sphereFact'){
        /* 四句的理由是固定的文字：逐句整句釘住（自己抄一份，不讀頁面的資料）—— 用規則去猜「有沒有說錯」永遠猜不完 */
        const WHY = [
          { zh:'球整個是曲面，沒有平面可以攤平，所以沒有展開圖。', en:'A sphere is curved everywhere with no flat part, so it has no net.' },
          { zh:'球從裡到外都是曲面，確實沒有一塊是平的。', en:'A sphere is curved from every angle — there really is no flat part.' },
          { zh:'頂點是稜與稜交會的角；球沒有稜，也沒有頂點。', en:'A vertex is a corner where edges meet; a sphere has no edges, so it has no vertex either.' },
          { zh:'這是球最特別的地方：不管轉到哪一面，看起來都一樣圓。', en:'That’s what makes a sphere special: no matter how you turn it, it looks the same round shape.' }][d.idx];
        if (!WHY || q.why !== WHY[lang]) return 'sphereFact: the why for statement ' + d.idx + ' is not the checked sentence — "' + q.why + '"';
      }
    }
  },

  data: {
    dataStart: '  /* ================= 幾何工具（語言無關） ================= */',
    dataEnd: '  /* ================= 語言字典 ================= */',
    dataReturn: '{prismName, pyramidName, polyShapeName, prismCounts, pyramidCounts, SOLID_EL, SOLID_SEG, SOLID_SHAPE, solidPhase, solidModel, solidPose, solidPlan, solidFit, solidChains, solidSVG, drawSphereSVG, drawSolidByKind, ngonOnEdge, prismNetPlan, pyramidNetPlan, cylinderNetPlan, coneNetPlan, drawNetByShape, GAME_ORDER, GW, GPICK, shuffle, pick, unsorted, segDist, EDGE, EDGE_H, GAME_EDGES, edgePlan, edgePick, BUILD, BUILD_H, GAME_BUILD, buildCount, buildRefuse, SORT, SORT_H, SORT_BINS, SORT_ITEMS, GAME_SORT, sortFam, sortInOrder, sortTray, sortRefuse, sortBin, sortThumbXY, NETG, GAME_NET, netSide, netDecoy, ngonUp, ngonWide, netLayout, netTray, netRefuse, TABLE, TABLE_H, TABLE_ATTR, GAME_TABLE, famCounts, tableCards, tableInOrder, tableTray, tableRefuse, tableHit, G_WORD, G_UNIT_ZH, gRule, gRuleSentence}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], EPS = 1e-9;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        const r = arith(ruleFix(s));
        r.problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (want && want.length && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        return r.verified;
      };
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 驗算器自己先證明會響 --- */
      [['3 × 6 ＝ 18', 0], ['3 × 6 ＝ 19', 1], ['稜 ＝ 3 × 5 ＝ 15 條', 0], ['稜 ＝ 3 × 5 ＝ 16 條', 1], ['edges = 2 × 6 = 12 edges', 0], ['edges = 2 × 6 = 13', 1], ['5 ＋ 2 ＝ 7 個', 0], ['18 ÷ 3 = 7', 1]].forEach(([t, bad]) => {
        if ((arith(ruleFix(t)).problems.length > 0) !== (bad > 0)) fail('arithmetic self-test: "' + t + '" should be ' + (bad ? 'wrong' : 'right'));
      });
      /* --- 1. I18N 靜態字串的算式逐條驗算（題庫的選項只驗正解那一個） --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let verified = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        const m = where.match(/^(\w+)\.(qs|qsAdv|qsBoost)\[(\d+)\]\.opts\[(\d+)\]$/);
        if (m && I18N[L][m[2]][+m[3]].ans !== +m[4]) return;
        verified += say(where, '', s);
      }));
      if (verified < 16) fail('only ' + verified + ' equations verified in the I18N strings — the arithmetic scan is not reading them');

      /* --- 2. 三層題庫：正解用自己的規律重算（題幹說的是哪一個立體、問哪一種，逐題寫出來） --- */
      const QKEY = { 'qs.0':['prism', 6, 'f'], 'qs.1':['pyramid', 4, 'e'], 'qs.2':['prism', 3, 'v'], 'qs.4':['pyramid', 5, 'f'], 'qsAdv.3':['prism', 7, 'e'], 'qsBoost.0':['pyramid', 4, 'e'] };
      LANGS.forEach(L => Object.keys(QKEY).forEach(k => {
        const [bank, i] = k.split('.'), q = I18N[L][bank][+i], [fam, n, attr] = QKEY[k], want = own(fam, n)[attr];
        if (nums(q.opts[q.ans]).indexOf(want) < 0) fail(k + ' ' + L + ': the keyed answer "' + q.opts[q.ans] + '" is not ' + want);
        q.opts.forEach((o, oi) => { if (oi !== q.ans && nums(o)[0] === want) fail(k + ' ' + L + ': a wrong option also says ' + want); });
        if (bank !== 'qsAdv' && (!q.draw || q.draw.shape !== fam || q.draw.n !== n)) fail(k + ' ' + L + ': the picture is a ' + JSON.stringify(q.draw) + ', the stem asks about the ' + n + '-gonal ' + fam);
        if (bank !== 'qsAdv' && q.stem.toLowerCase().indexOf(solidName(fam, n, L)) < 0) fail(k + ' ' + L + ': the stem does not name the ' + solidName(fam, n, L));
        const AW = { zh:{ f:'面', e:'稜', v:'頂點' }, en:{ f:'faces', e:'edges', v:'vertices' } }[L][attr];
        if (q.stem.indexOf(AW) < 0 || Object.keys({ f:1, e:1, v:1 }).some(o => o !== attr && bank !== 'qsAdv' && q.stem.indexOf({ zh:{ f:'幾個面', e:'幾條稜', v:'幾個頂點' }, en:{ f:'faces', e:'edges', v:'vertices' } }[L][o]) >= 0)) fail(k + ' ' + L + ': the stem does not ask about ' + AW);
      }));
      LANGS.forEach(L => {
        const A = I18N[L].qsAdv;
        if (A[0].opts[A[0].ans].toLowerCase() !== solidName('prism', 5, L) || own('prism', 5).e !== 15) fail('qsAdv[0] ' + L + ': 15 edges is the pentagonal prism');
        if (A[1].opts[A[1].ans].toLowerCase() !== solidName('pyramid', 6, L) || own('pyramid', 6).v !== 7) fail('qsAdv[1] ' + L + ': 7 vertices is the hexagonal pyramid');
        const b1 = I18N[L].qsBoost[1]; if (!/^0\D+0\D/.test(b1.opts[b1.ans])) fail('qsBoost[1] ' + L + ': a cylinder has 0 edges and 0 vertices');
        const a2 = A[2]; if (!(L === 'zh' ? /頂點一定是底面邊數的 2 倍/ : /vertex count is always double/).test(a2.opts[a2.ans])) fail('qsAdv[2] ' + L + ': the true statement should be "a prism’s vertices are double the base sides" (2n)');
        if ((L === 'zh' ? /圓柱/ : /Cylinder/).test(I18N[L].qs[3].opts[I18N[L].qs[3].ans]) !== true) fail('qs[3] ' + L + ': the prism-family answer should be the cylinder');
        const s5 = I18N[L].qs[5]; if (!(L === 'zh' ? /不行/ : /^No/).test(s5.opts[s5.ans]) || !(L === 'zh' ? /曲面/ : /curved/).test(s5.opts[s5.ans])) fail('qs[5] ' + L + ': a sphere has no net because it is curved');
      });

      /* --- 3. 立體圖引擎：三頁一字不差 --- */
      const ENG_A = '  /* ---------- 立體圖引擎', ENG_B = '  function drawNetByShape(kind, n){';
      const engOf = s => { const i = s.indexOf(ENG_A), j = s.indexOf(ENG_B, i); if (i < 0 || j < 0) return null; const k = s.indexOf('\n  }\n', j); return s.slice(i, k + 4); };
      const engIdx = engOf(src);
      if (!engIdx) fail('ENGINE: cannot find the drawing engine block in index.html');
      ['reference.html', 'review.html'].forEach(f => {
        let t = '';
        try { t = fs.readFileSync(path.join(path.dirname(path.resolve(process.argv[2] || '.')), f), 'utf8'); } catch (e){ fail('ENGINE: cannot read ' + f + ' next to index.html'); return; }
        if (engOf(t) !== engIdx) fail('ENGINE: ' + f + ' does not carry the same drawing engine as index.html (the three pages must draw the same solids the same way)');
      });

      {
        const pages = { 'index.html':src };
        ['reference.html', 'review.html'].forEach(f => { try { pages[f] = fs.readFileSync(path.join(path.dirname(path.resolve(process.argv[2] || '.')), f), 'utf8'); } catch (e){ fail('ENGINE: cannot read ' + f); } });
        const NAMES = ['solidModel', 'solidPose', 'solidPlan', 'solidFit', 'solidChains', 'solidSVG', 'drawPrismSVG', 'drawPyramidSVG', 'drawCylinderSVG', 'drawConeSVG', 'drawSphereSVG', 'drawSolidByKind', 'ngonOnEdge', 'polygonEl', 'prismNetPlan', 'drawPrismNetSVG', 'pyramidNetPlan', 'drawPyramidNetSVG', 'cylinderNetPlan', 'drawCylinderNetSVG', 'coneNetPlan', 'drawConeNetSVG', 'drawNetByShape', 'solidPhase', 'SOLID_EL', 'SOLID_SEG', 'SOLID_SHAPE'];
        Object.keys(pages).forEach(f => {
          const t = pages[f], i = t.indexOf(ENG_A), blk = engOf(t) || '';
          const outside = i < 0 ? t : t.slice(0, i) + t.slice(i + blk.length);
          NAMES.forEach(nm => { if (new RegExp('(function\\s+' + nm + '\\s*\\(|\\b' + nm + '\\s*=[^=]|\\bvar\\s+' + nm + '\\b|' + nm + '\\s*\\.\\s*\\w+\\s*=)').test(outside)) fail('ENGINE: ' + nm + ' is declared or reassigned outside the shared engine block in ' + f); });
        });
      }
      /* --- 4. 每一個會被畫出來的立體：自己重算 3D、另一種方法判斷看不看得到 --- */
      const e = deg(D.SOLID_EL), EYE = [0, Math.sin(e), Math.cos(e)];
      if (D.SOLID_EL !== 22) fail('ENGINE: SOLID_EL ' + D.SOLID_EL + ' — too flat or too steep; every picture and the edge-tap clearances were checked at 22°');
      const SEG = 48;   /* 曲面用 48 片拼：這裡自己的常數，不讀頁面的 */
      if (D.SOLID_SEG !== SEG) fail('ENGINE: SOLID_SEG ' + D.SOLID_SEG + ' — curved sides are 48 facets');
      const checkSolid = (what, kind, n, pose) => {
        const fam = (kind === 'prism' || kind === 'cylinder') ? 'prism' : 'pyramid', curved = kind === 'cylinder' || kind === 'cone';
        const plan = D.solidPlan(kind, n, pose);
        const M = refModel(kind, n, (pose && pose.phase != null) ? pose.phase : D.solidPhase(curved ? SEG : n), D.SOLID_SHAPE, SEG);
        const V = refPose(M.V, pose), P = V.map(p => [p[0], -(p[1] * Math.cos(e) - p[2] * Math.sin(e))]);
        if (plan.P.length !== P.length || plan.P.some((p, i) => Math.hypot(p[0] - P[i][0], p[1] - P[i][1]) > 1e-9)){ fail(what + ': the projected points are not this solid seen from ' + D.SOLID_EL + '° above'); return; }
        /* 面、稜、頂點的個數（角柱 n ＋ 2／3n／2n，角錐 n ＋ 1／2n／n ＋ 1）與尤拉公式 */
        if (!curved){
          const nE = plan.lines.length, c = own(fam, n);
          if (plan.faces.length !== c.f || nE !== c.e || P.length !== c.v || P.length - nE + plan.faces.length !== 2) fail(what + ': faces/edges/vertices ' + plan.faces.length + '/' + nE + '/' + P.length + ', want ' + c.f + '/' + c.e + '/' + c.v);
        }
        const faceOf = {}; M.F.forEach((f, fi) => f.v.forEach((a, i) => { const b = f.v[(i + 1) % f.v.length], k = Math.min(a, b) + '-' + Math.max(a, b); (faceOf[k] = faceOf[k] || []).push(fi); }));
        /* 實線／虛線：從稜的中點往看的人射線，被別的面擋住 → 虛線；沒被擋住 → 實線 */
        let bad = 0, first = '';
        plan.lines.forEach(L => {
          const k = L.a + '-' + L.b, Mid = V[L.a].map((x, j) => (x + V[L.b][j]) / 2);
          if (L.seam) return;
          const want = occluded(Mid, V, M.F, faceOf[k] || [], EYE) ? 'hidden' : 'solid';
          if (want !== L.k){ bad++; if (!first) first = k + ' drawn ' + L.k + ', the ray says ' + want; }
        });
        if (bad) fail(what + ': ' + bad + ' edge(s) drawn solid/dashed the wrong way — first ' + first);
        /* 面看不看得到：自己的外法向量（叉積，朝離開立體中心的方向）和看的方向 */
        const Cc = [0, 1, 2].map(k => V.reduce((t, p) => t + p[k], 0) / V.length);
        M.F.forEach((f, fi) => {
          const a = V[f.v[0]], bb = V[f.v[1]], c = V[f.v[2]];
          let nn = cross(sub(bb, a), sub(c, a));
          const fc = [0, 1, 2].map(k => f.v.reduce((t, i) => t + V[i][k], 0) / f.v.length);
          if (dot(nn, sub(fc, Cc)) < 0) nn = nn.map(x => -x);
          const front = dot(nn, EYE) / Math.sqrt(dot(nn, nn)) > 1e-6;
          if (!plan.faces[fi] || plan.faces[fi].vis !== front) fail(what + ': face ' + fi + ' is marked ' + (plan.faces[fi] && plan.faces[fi].vis ? 'visible' : 'hidden') + ', but it faces ' + (front ? 'us' : 'away'));
        });
        /* 輪廓：投影的凸包，每一條邊都要畫成實線（曲面的輪廓線也是） */
        const H = hull(P), drawn = {};
        plan.lines.forEach(L => { drawn[L.a + '-' + L.b] = L.k; });
        for (let i = 0; i < H.length; i++){
          const a = H[i], b = H[(i + 1) % H.length], k = Math.min(a, b) + '-' + Math.max(a, b);
          if (drawn[k] !== 'solid'){ fail(what + ': the outline from point ' + a + ' to ' + b + ' is not drawn as a solid line (' + drawn[k] + ')'); break; }
        }
        /* 曲面的接縫：只有輪廓畫出來，而且一定是實線 */
        plan.lines.filter(L => L.seam).forEach(L => { const i = H.indexOf(L.a), j = H.indexOf(L.b); if (L.k !== 'solid' || i < 0 || j < 0 || (Math.abs(i - j) !== 1 && Math.abs(i - j) !== H.length - 1)) fail(what + ': a seam of the curved surface is drawn but it is not on the outline'); });
        if (curved && plan.lines.filter(L => L.seam).length !== 2) fail(what + ': a curved side should show exactly 2 outline lines, got ' + plan.lines.filter(L => L.seam).length);
        /* 平行的稜畫出來還是平行（正投影）：角柱的側稜全部平行 */
        if (kind === 'prism'){
          const lat = plan.lines.filter(L => Math.abs(L.b - L.a) === n).map(L => [P[L.b][0] - P[L.a][0], P[L.b][1] - P[L.a][1]]);
          if (lat.length !== n || lat.some(v => Math.abs(v[0] * lat[0][1] - v[1] * lat[0][0]) > 1e-9)) fail(what + ': the ' + n + ' side edges are not drawn parallel');
        }
        /* 兩條稜不可以畫在同一條線上（重疊了就數不出來、也點不到） */
        for (let i = 0; i < plan.lines.length; i++) for (let j = i + 1; j < plan.lines.length; j++){
          const A = plan.lines[i], B = plan.lines[j], a1 = P[A.a], a2 = P[A.b], b1 = P[B.a], b2 = P[B.b];
          const col = Math.abs((a2[0] - a1[0]) * (b1[1] - a1[1]) - (a2[1] - a1[1]) * (b1[0] - a1[0])) < 1e-6 && Math.abs((a2[0] - a1[0]) * (b2[1] - a1[1]) - (a2[1] - a1[1]) * (b2[0] - a1[0])) < 1e-6;
          if (!col) continue;
          const ux = a2[0] - a1[0], uy = a2[1] - a1[1], L2 = ux * ux + uy * uy, t1 = ((b1[0] - a1[0]) * ux + (b1[1] - a1[1]) * uy) / L2, t2 = ((b2[0] - a1[0]) * ux + (b2[1] - a1[1]) * uy) / L2;
          if (Math.min(1, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2)) > 1e-6){ fail(what + ': two edges are drawn on top of each other'); i = plan.lines.length; break; }
        }
        /* 畫成 SVG：折線拆回一段一段，剛好就是每一條實線／虛線各一次（不多、不少、不跳點） */
        const svg = kind === 'sphere' ? '' : D.solidSVG(kind, n, pose);
        const Q = D.solidFit(plan, { x:14, y:14, w:300 - 28, h:220 - 28 });
        ['solid', 'hidden'].forEach(k => {
          const want = plan.lines.filter(L => L.k === k).map(L => [Q[L.a], Q[L.b]]), got = [];
          (svg.match(new RegExp('<polyline class="' + (k === 'solid' ? 'edgeSolid' : 'edgeHidden') + '" points="([^"]+)"', 'g')) || []).forEach(pl => {
            const pts = pl.match(/points="([^"]+)"/)[1].trim().split(/\s+/).map(s => s.split(',').map(Number));
            for (let i = 0; i + 1 < pts.length; i++) got.push([pts[i], pts[i + 1]]);
          });
          const used = got.map(() => false);
          const miss = want.filter(w => { const i = got.findIndex((g, gi) => !used[gi] && sameSeg(w[0], w[1], g[0], g[1], 0.08)); if (i >= 0) used[i] = true; return i < 0; });
          if (miss.length || used.some(u => !u)) fail(what + ': the SVG ' + k + ' lines do not match the plan (' + miss.length + ' missing, ' + used.filter(u => !u).length + ' extra)');
        });
        if (!/viewBox="0 0 300 220"/.test(svg)) fail(what + ': the SVG viewBox is not 0 0 300 220');
        /* 除了底面的色塊、稜的折線、尖點，SVG 裡不可以有別的東西（蓋住整張圖的方塊也會被抓到） */
        const rest = svg.replace(/^<svg viewBox="0 0 300 220" class="solidSvg" role="img">/, '').replace(/<\/svg>$/, '')
          .replace(/<polygon class="faceTop" points="[\d., -]+"><\/polygon>/g, '').replace(/<polyline class="edge(Solid|Hidden)" points="[\d., -]+"><\/polyline>/g, '')
          .replace(/<circle class="apexDot" cx="[\d.-]+" cy="[\d.-]+" r="4"><\/circle>/, '');
        if (rest) fail(what + ': unexpected SVG content "' + rest.slice(0, 60) + '"');
        const tops = (svg.match(/<polygon class="faceTop"/g) || []).length, visBases = plan.faces.filter(f => f.base && f.vis).length;
        if (tops !== visBases) fail(what + ': ' + tops + ' base patches are filled, but ' + visBases + ' bases face us');
        Q.forEach(q => { if (q[0] < 14 - 1e-6 || q[0] > 286 + 1e-6 || q[1] < 14 - 1e-6 || q[1] > 206 + 1e-6) fail(what + ': a point is drawn outside the 14px margin'); });
        if (kind === 'pyramid' || kind === 'cone'){ if (!/class="apexDot"/.test(svg)) fail(what + ': the tip is not marked'); }
        return { plan, P, V, M };
      };
      for (let n = 3; n <= 10; n++){ checkSolid('prism ' + n, 'prism', n); checkSolid('pyramid ' + n, 'pyramid', n); }
      checkSolid('cylinder', 'cylinder', 0); checkSolid('cone', 'cone', 0);
      Object.keys(D.SORT_ITEMS).forEach(id => { const it = D.SORT_ITEMS[id]; if (it.kind !== 'sphere') checkSolid('sort card ' + id, it.kind, it.n, it.pose); });
      /* 球：一個圓 ＋ 赤道（前面實線、後面虛線），沒有任何稜 */
      ['', 'aria-hidden="true"'].forEach(x => {
        const s = D.drawSphereSVG(x);
        if (!/<circle class="faceTop"/.test(s) || (s.match(/class="edgeSolid"/g) || []).length !== 1 || (s.match(/class="edgeHidden"/g) || []).length !== 1 || /<polyline|<line/.test(s)) fail('sphere drawing: should be one outline circle and an equator (front solid, back dashed)');
      });

      /* --- 5. 展開圖：摺紙測試 --- */
      for (let n = 3; n <= 8; n++){
        const p = D.prismNetPlan(n), a = p.a;
        if (p.rects.length !== n) fail('prism net ' + n + ': ' + p.rects.length + ' rectangles');
        p.rects.forEach((r, i) => { const w = r[1][0] - r[0][0], h = r[2][1] - r[1][1]; if (Math.abs(w - a) > 1e-9 || Math.abs(h - p.h) > 1e-9 || (i && Math.abs(r[0][0] - p.rects[i - 1][1][0]) > 1e-9)) fail('prism net ' + n + ': rectangle ' + i + ' is not ' + a + ' × ' + p.h + ' next to the previous one'); });
        const top = p.bases[0], bot = p.bases[1];
        [top, bot].forEach((B, bi) => { const r = regularOk(B, n, a); if (r) fail('prism net ' + n + ': base ' + bi + ' ' + r); });
        const onTop = p.rects.some(r => sameSeg(top[0], top[1], r[0], r[1], 1e-6)), onBot = p.rects.some(r => sameSeg(bot[0], bot[1], r[2], r[3], 1e-6));
        if (!onTop || !onBot) fail('prism net ' + n + ': the two bases are not joined to the top edge and the bottom edge of a rectangle (top ' + onTop + ', bottom ' + onBot + ')');
        const pieces = p.rects.concat([top, bot]);
        for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) if (polysOverlap(pieces[i], pieces[j])) fail('prism net ' + n + ': pieces ' + i + ' and ' + j + ' overlap');
        pieces.forEach(P => P.forEach(q => { if (q[0] < 2 || q[1] < 2 || q[0] > p.W - 2 || q[1] > p.H - 2) fail('prism net ' + n + ': a corner is outside the picture'); }));
      }
      for (let n = 3; n <= 8; n++){
        const p = D.pyramidNetPlan(n), side = Math.hypot(p.base[1][0] - p.base[0][0], p.base[1][1] - p.base[0][1]);
        const r = regularOk(p.base, n, side); if (r) fail('pyramid net ' + n + ': base ' + r);
        if (p.tris.length !== n) fail('pyramid net ' + n + ': ' + p.tris.length + ' triangles');
        p.tris.forEach((t, i) => {
          const s1 = Math.hypot(t[2][0] - t[0][0], t[2][1] - t[0][1]), s2 = Math.hypot(t[2][0] - t[1][0], t[2][1] - t[1][1]);
          if (!sameSeg(t[0], t[1], p.base[i], p.base[(i + 1) % n], 1e-9)) fail('pyramid net ' + n + ': triangle ' + i + ' is not on base edge ' + i);
          if (Math.abs(s1 - s2) > 1e-6 || Math.abs(s1 - Math.hypot(p.tris[0][2][0] - p.tris[0][0][0], p.tris[0][2][1] - p.tris[0][0][1])) > 1e-6) fail('pyramid net ' + n + ': triangle ' + i + ' is not the same isosceles triangle');
        });
        const height = 2 * polyArea(p.tris[0]) / side, inr = side / (2 * Math.tan(Math.PI / n));
        if (!(height > inr + 1)) fail('pyramid net ' + n + ': triangle height ' + height.toFixed(1) + ' is not more than the base inradius ' + inr.toFixed(1) + ' — the triangles could not meet at a tip');
        const all = p.tris.concat([p.base]);
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (polysOverlap(all[i], all[j])) fail('pyramid net ' + n + ': pieces overlap');
        all.forEach(P => P.forEach(q => { if (q[0] < 2 || q[1] < 2 || q[0] > p.W - 2 || q[1] > p.H - 2) fail('pyramid net ' + n + ': a corner is outside the picture'); }));
      }
      {
        const c = D.cylinderNetPlan(), R = c.rect;
        if (Math.abs(R.w - 2 * Math.PI * c.r) > 0.01 * R.w) fail('cylinder net: the rectangle is ' + R.w.toFixed(1) + ' long, but the circle’s circumference is ' + (2 * Math.PI * c.r).toFixed(1));
        if (c.circles.length !== 2 || Math.abs(c.circles[0][1] + c.r - R.y) > 1e-9 || Math.abs(c.circles[1][1] - c.r - (R.y + R.h)) > 1e-9 || c.circles.some(q => q[0] < R.x || q[0] > R.x + R.w)) fail('cylinder net: the two circles do not touch the two long sides of the rectangle');
        if (R.x < 2 || R.x + R.w > c.W - 2 || c.circles[0][1] - c.r < 2 || c.circles[1][1] + c.r > c.H - 2) fail('cylinder net: outside the picture');
        const k = D.coneNetPlan(), arc = k.s * deg(k.ang);
        if (Math.abs(arc - 2 * Math.PI * k.r) > 1e-6) fail('cone net: the arc is ' + arc.toFixed(1) + ' long, the base circle ' + (2 * Math.PI * k.r).toFixed(1) + ' around — it would not close up');
        if (!(k.ang < 180)) fail('cone net: the sector is drawn as a small arc (large-arc flag 0) but its angle is ' + k.ang);
        [k.p1, k.p2].forEach(q => { if (Math.abs(Math.hypot(q[0] - k.apex[0], q[1] - k.apex[1]) - k.s) > 1e-9) fail('cone net: a sector corner is not on the arc'); });
        if (Math.abs(Math.hypot(k.circle[0] - k.apex[0], k.circle[1] - k.apex[1]) - (k.s + k.r)) > 1e-9 || Math.abs(k.circle[0] - k.apex[0]) > 1e-9) fail('cone net: the base circle does not touch the middle of the arc');
        if (k.apex[0] - k.s * Math.sin(deg(k.ang / 2)) < 2 || k.apex[0] + k.s * Math.sin(deg(k.ang / 2)) > k.W - 2 || k.circle[1] + k.r > k.H - 2) fail('cone net: outside the picture');
        const svg = D.drawNetByShape('cone'); if (!/ A 78 78 0 0 0 /.test(svg)) fail('cone net: the arc is not drawn as the small arc through the bottom');
        /* 畫出來的 SVG 就是上面驗過的那一份（不只驗資料） */
        const f1 = v => v.toFixed(1);
        const polyStr = (P, cls) => '<polygon class="' + cls + '" points="' + P.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ') + '"></polygon>';
        for (let n = 3; n <= 8; n++){
          const p = D.prismNetPlan(n), want = '<svg viewBox="0 0 ' + f1(p.W) + ' ' + f1(p.H) + '" class="netSvg" role="img">' + p.rects.map(r => polyStr(r, 'faceRect')).join('') + p.bases.map(b => polyStr(b, 'faceBase')).join('') + '</svg>';
          if (D.drawNetByShape('prism', n) !== want) fail('prism net ' + n + ': the drawn SVG is not the checked net');
          const q = D.pyramidNetPlan(n), want2 = '<svg viewBox="0 0 300 220" class="netSvg" role="img">' + q.tris.map(t => polyStr(t, 'faceRect')).join('') + polyStr(q.base, 'faceBase') + '</svg>';
          if (D.drawNetByShape('pyramid', n) !== want2) fail('pyramid net ' + n + ': the drawn SVG is not the checked net');
        }
        { const cy = D.cylinderNetPlan(), w = '<svg viewBox="0 0 ' + f1(cy.W) + ' ' + f1(cy.H) + '" class="netSvg" role="img"><rect class="faceRect" x="' + f1(cy.rect.x) + '" y="' + f1(cy.rect.y) + '" width="' + f1(cy.rect.w) + '" height="' + f1(cy.rect.h) + '"></rect>' + cy.circles.map(q => '<circle class="faceBase" cx="' + f1(q[0]) + '" cy="' + f1(q[1]) + '" r="' + cy.r + '"></circle>').join('') + '</svg>';
          if (D.drawNetByShape('cylinder') !== w) fail('cylinder net: the drawn SVG is not the checked net'); }
        { const w = '<svg viewBox="0 0 ' + f1(k.W) + ' ' + f1(k.H) + '" class="netSvg" role="img"><path class="faceRect" d="M ' + f1(k.apex[0]) + ' ' + f1(k.apex[1]) + ' L ' + f1(k.p1[0]) + ' ' + f1(k.p1[1]) + ' A ' + k.s + ' ' + k.s + ' 0 0 0 ' + f1(k.p2[0]) + ' ' + f1(k.p2[1]) + ' Z"></path><circle class="faceBase" cx="' + f1(k.circle[0]) + '" cy="' + f1(k.circle[1]) + '" r="' + k.r + '"></circle></svg>';
          if (svg !== w) fail('cone net: the drawn SVG is not the checked net'); }
        /* 範例 4 的五張卡：畫的就是那一個立體的展開圖 */
        if (!/var NET_ITEMS = \[\n {4}\{ id:'cyl', kind:'cylinder', n:0 \},\n {4}\{ id:'cone', kind:'cone', n:0 \},\n {4}\{ id:'prism3', kind:'prism', n:3 \},\n {4}\{ id:'prism4', kind:'prism', n:4 \},\n {4}\{ id:'pyr4', kind:'pyramid', n:4 \}\n {2}\];/.test(src)) fail('example 4: NET_ITEMS changed');
        if (!/netWrap\.innerHTML = drawNetByShape\(netSel\.kind, netSel\.n\);/.test(src) || !/netWrap\.innerHTML = drawSolidByKind\(netSel\.kind, netSel\.n\);/.test(src)) fail('example 4 does not draw the chosen solid / its net');
      }

      /* --- 6. 範例 1、2 的讀數、範例 4 的說明 --- */
      if (!/var n = state\.sel\.n;\n {8}if \(state\.tried\.indexOf\(n\) < 0\) state\.tried\.push\(n\);\n {8}var c = cfg\.counts\(n\);\n {8}lineEl\.innerHTML = d\.prismLine\(cfg\.name\(n, lang\), c\);/.test(src)) fail('examples 1–2: the reading does not use the same n for the name and the counts');
      if (!/var c = cfg\.counts\(n\);\n {8}var tr = document\.createElement\('tr'\);\n {8}tr\.innerHTML = '<td>' \+ cfg\.name\(n, lang\) \+ '<\/td><td>' \+ c\.f \+ '<\/td><td>' \+ c\.e \+ '<\/td><td>' \+ c\.v \+ '<\/td>';/.test(src)) fail('examples 1–2: the table row does not use the same n for the name and the counts');
      if (!/counts: prismCounts, name: prismName,\n {4}draw: function\(sel\)\{ return sel\.type === 'n' \? drawPrismSVG\(sel\.n\) : drawCylinderSVG\(\); \},/.test(src) || !/counts: pyramidCounts, name: pyramidName,\n {4}draw: function\(sel\)\{ return sel\.type === 'n' \? drawPyramidSVG\(sel\.n\) : drawConeSVG\(\); \},/.test(src)) fail('examples 1–2: the counts, names and pictures are not wired to the same family');
      for (let n = 3; n <= 10; n++){ ['prism', 'pyramid'].forEach(f => { const c = (f === 'prism' ? D.prismCounts : D.pyramidCounts)(n), o = own(f, n); if (c.f !== o.f || c.e !== o.e || c.v !== o.v) fail(f + 'Counts(' + n + ') is wrong'); if ((f === 'prism' ? D.prismName : D.pyramidName)(n, 'zh') !== solidName(f, n, 'zh') || (f === 'prism' ? D.prismName : D.pyramidName)(n, 'en') !== solidName(f, n, 'en')) fail(f + 'Name(' + n + ') is wrong'); }); }
      LANGS.forEach(L => {
        for (let n = 3; n <= 8; n++){
          ['prism', 'pyramid'].forEach(f => { const c = own(f, n); say('prismLine(' + f + n + ')', L, I18N[L].prismLine(solidName(f, n, L), c), [c.f, c.e, c.v]); });
          say('netCaptionPrism(' + n + ')', L, I18N[L].netCaptionPrism(n), [2, n]);
          say('netCaptionPyr(' + n + ')', L, I18N[L].netCaptionPyr(n), [1, n]);
          has('netCaptionPrism(' + n + ')', L, I18N[L].netCaptionPrism(n), { zh:[SHAPE_ZH[n]], en:[SHAPE_EN[n]] });
          hasNot('netCaptionPrism(' + n + ')', L, I18N[L].netCaptionPrism(n), { zh:['柱'], en:['prism'] });
        }
        has('netCaptionCyl', L, I18N[L].netCaptionCyl, { zh:['圓周長'], en:['circumference'] });
      });
      if (!/netCaption\.innerHTML = d\.netCaptionPrism\(netSel\.n\);/.test(src) || !/netCaption\.innerHTML = d\.netCaptionPyr\(netSel\.n\);/.test(src)) fail('example 4: the net captions are not given the number of base sides');

      /* ================= 7. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：立體點名');
      const ge = src.indexOf('  /* ================= 語言切換', gs);
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

      /* --- 五關的順序、題目與提示 --- */
      const TYPES = ['edges', 'build', 'sort', 'net', 'table'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 2, 1 backwards, 3+5, 4, the rules of 1+2), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        edges: { zh:['兩個面交界', '虛線', '也要數'], en:['two faces meet', 'dashed', 'count too'] },
        build: { zh:['面 ＝ n ＋ 2', '稜 ＝ 3 × n', '頂點 ＝ 2 × n'], en:['faces = n + 2', 'edges = 3 × n', 'vertices = 2 × n'] },
        sort: { zh:['兩個一樣大、互相平行的底面', '收成一個尖點', '躺著、倒過來'], en:['two equal, parallel bases', 'rising to a point', 'Lying down or upside down'] },
        net: { zh:['每一條邊都要接一個長方形', '相對的兩頭'], en:['every side of a base needs its own rectangle', 'opposite ends'] },
        table: { zh:['面 ＝ n ＋ 2', '稜 ＝ 3 × n', '頂點 ＝ 2 × n', '面 ＝ n ＋ 1', '稜 ＝ 2 × n', '頂點 ＝ n ＋ 1'], en:['faces = n + 2', 'edges = 3 × n', 'vertices = 2 × n', 'faces = n + 1', 'edges = 2 × n', 'vertices = n + 1'] }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const h = I18N[L].gHints && I18N[L].gHints[t];
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h); has('gHints.' + t, L, h, HINT_SEM[t]); }
        });
      });
      LANGS.forEach(L => {
        const A = I18N[L].gAsks;
        if (typeof A.sort !== 'string') fail('GAME gAsks.sort should be a string (' + L + ')');
        else has('gAsks.sort', L, A.sort, { zh:['躺著', '倒過來', '看底面'], en:['lying down', 'upside down', 'look at the bases'] });
        D.GAME_EDGES.forEach(([n]) => { say('gAsks.edges', L, A.edges(n), []); has('gAsks.edges', L, A.edges(n), { zh:[solidName('pyramid', n, 'zh'), '虛線'], en:[solidName('pyramid', n, 'en'), 'dashed'] }); });
        D.GAME_NET.forEach(n => say('gAsks.net', L, A.net(n), [n]));
        D.GAME_TABLE.forEach(([f, n]) => { say('gAsks.table', L, A.table(f, n), [n]); has('gAsks.table', L, A.table(f, n), { zh:[f === 'prism' ? '角柱' : '角錐', '兩張卡用不到'], en:[f === 'prism' ? 'prism' : 'pyramid', 'Two cards are left over'] }); });
        ['f', 'e', 'v'].forEach(attr => [8, 18, 12].forEach(T => { say('gAsks.build', L, A.build(attr, T), [T]); has('gAsks.build', L, A.build(attr, T), { zh:[{ f:'個面', e:'條稜', v:'個頂點' }[attr]], en:[{ f:' faces', e:' edges', v:' vertices' }[attr]] }); }));
        say('s7lead', L, I18N[L].s7lead);
        has('s7lead', L, I18N[L].s7lead, { zh:['兩個一樣大、互相平行的底面', '收成一個尖點'], en:['two equal, parallel bases', 'one base rising to a single point'] });
        has('gWin', L, I18N[L].gWin(85), { zh:['五關全破', '85'], en:['All 5 rounds cleared', '85'] });   /* parents.html 的精熟標準寫「五關全破」 */
      });
      {
        const m = src.match(/<p class="lead" data-i18n="s7lead">([\s\S]*?)<\/p>/);
        if (!m || m[1] !== I18N.zh.s7lead) fail('GAME s7lead: the markup fallback is not the same sentence as the zh dictionary');
        if (I18N.zh.s7h2 !== '立體點名' || I18N.en.s7h2 !== 'Solid Roll Call') fail('GAME: the game name changed — keep 立體點名 / Solid Roll Call');
      }
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };

      /* --- 拖拉引擎與計分的保護（原始碼形狀） --- */
      need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
      need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
      need(null, /gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+; BOARD_TAP = null; PIECE_PTR = \{\};/, 'startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
      need(null, /if \(gen !== gGen\) return;   \/\* 這一塊屬於已經拿掉的畫板/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
      need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
      need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      need(null, /if \(t\.far \|\| Math\.hypot\(e\.clientX - t\.x, e\.clientY - t\.y\) > 10\) return;/, 'a slide is taken as a tap on the board');
      need(null, /if \(PIECE_PTR\[e\.pointerId\]\) return;/, 'a finger that went down on a piece can tap the board when it is released');
      need(null, /if \(P\.busy\(\)\) return;   \/\* 這一塊正被另一根手指拖著/, 'tap-then-tap can drop a piece that another finger is still dragging');
      need(null, /elHint\.textContent = '';   \/\* 過關了/, 'solving a round does not clear the hint');
      need(null, /querySelectorAll\('\.sel, \.gglow'\)/, 'solving a round does not clear the hint glow');
      ['stopGesture', 'end'].forEach(f => { const t = extractFunction(gsrc, f) || ''; if (!/document\.removeEventListener\('pointerup', onDocEnd\);/.test(t) || !/document\.removeEventListener\('pointercancel', onDocEnd\);/.test(t)) fail('GAME engine: ' + f + '() — the document release listener is never removed (it would pile up)'); });
      if (!/\.gpiece\.locked\{cursor:default;pointer-events:none\}/.test(src)) fail('GAME: placed pieces still catch taps (.gpiece.locked needs pointer-events:none)');
      if (!/\.gpiece\{left:0;top:0;display:flex;align-items:center;justify-content:center;\s*touch-action:none;/.test(src)) fail('GAME: pieces are missing touch-action:none');
      { const g = extractFunction(gsrc, 'gSvg'); if (!g || /viewBox/.test(g.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME: the board SVG gets a viewBox — the drawing would no longer match the hit zones'); }
      ['sort', 'net', 'table'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      need('edges', /var L = edgePick\(plan\.lines, pt\);/, 'the edge round does not pick the nearest edge with edgePick');
      need('edges', /if \(marked\[L\.i\]\)\{ roundNote\(d\.gEdgeAgain\); return; \}/, 'tapping an edge again is counted again (or charged)');
      need('edges', /missOnce\(seen, 'early' \+ \(cnt\.base \+ cnt\.side\), d\.gEdgeEarly\(hid\)\);/, '"Done counting" too early is not judged once per count');
      need('edges', /var hid = left\.some\(function\(L\)\{ return L\.k === 'hidden'; \}\);/, 'the "dashed ones count too" reason is not computed from the edges still missing');
      need('edges', /drawSolidOnBoard\(svg, 'pyramid', n, \{ phase:e\[1\] \}, EDGE\.box\);/, 'the edge round does not draw the same pyramid it judges');
      need('build', /var bad = buildRefuse\(attr, nn, T\);/, '"Done" does not judge the shown prism with buildRefuse');
      need('build', /missOnce\(seen, nn, d\.gBuildBad\(attr, nn, bad\.x, T\)\);/, 'a repeated wrong prism could be charged twice');
      need('build', /drawSolidOnBoard\(host, 'prism', nn, null, BUILD\.box\);\n {8}line\.textContent = d\.gBuildNow\(nn\);/, 'the drawing / readout do not show the same prism that "Done" judges');
      need('sort', /var bin = nearestOpen\(bins, pt, SORT\.pad\);/, 'the sort round does not pick the nearest bin');
      need('sort', /bad = sortRefuse\(id, bin\.b\);/, 'the sort round does not judge with sortRefuse');
      need('sort', /missOnce\(seen, id \+ '@' \+ bin\.b, /, 'the same card in the same wrong bin could be charged twice');
      need('sort', /var cards = sortTray\(set\)\.map/, 'the sort tray is not shuffled out of the bin order');
      need('net', /var s = nearestOpen\(slots, pt, NETG\.pad\);/, 'the net round does not pick the nearest edge slot');
      need('net', /var bad = netRefuse\(n, P\.data\.k, s\.side, baseSide\);/, 'the net round does not judge with netRefuse');
      need('net', /missOnce\(seen, 'decoy', d\.gNetDecoy\(P\.data\.k, n\)\)/, 'the wrong polygon could be charged twice');
      need('net', /missOnce\(seen, 'same', d\.gNetSame\(s\.side === 'top'\)\)/, 'the same-side base could be charged twice');
      need('net', /P\.lock\(s\.cx, s\.cy\);/, 'a placed base is not snapped onto its rectangle edge');
      need('net', /baseSide = s\.side;/, 'the first base’s side is not remembered');
      need('table', /var s = nearestOpen\(slots, pt, TABLE\.pad\);/, 'the table round does not pick the nearest slot');
      need('table', /var bad = tableRefuse\(fam, n, s\.s, P\.data\.v\);/, 'the table round does not judge with tableRefuse');
      need('table', /missOnce\(seen, P\.data\.v \+ '@' \+ s\.s, /, 'the same card in the same wrong slot could be charged twice');
      need('table', /var cards = tableTray\(fam, n\)\.map/, 'the table tray is not shuffled out of the answer order');
      /* 不可以從外觀看出答案（§六之五 增補、g5-polygon）：每一關拿得起來的東西用同一個樣式，不看資料決定外觀 */
      need('sort', /addPiece\(B, \{ w:SORT\.cardW, h:SORT\.cardH, cx:SORT\.trayX\[j % 3\], cy:SORT\.trayY\[Math\.floor\(j \/ 3\)\], cls:'gcard gshape', node:node, data:\{ id:id \} \}\)/, 'the sort cards are not all one style (cls must be the literal "gcard gshape")');
      need('net', /cls:'gngonp', node:ngonSvg\(k, a, w, h, false\), label:String\(k\), data:\{ k:k \} \}\)/, 'the net pieces are not all one style (cls must be the literal "gngonp")');
      need('table', /cls:'gcard gnum', text:String\(v\), data:\{ v:v \} \}\)/, 'the number cards are not all one style (cls must be the literal "gcard gnum")');
      { const ng = (extractFunction(gsrc, 'ngonSvg') || 'fill').replace(/\/\*[\s\S]*?\*\//g, ''); if (/fill|stroke|style|===|!==/.test(ng)) fail('GAME: ngonSvg() paints a polygon depending on its data — every piece must look the same'); }
      if ((src.match(/\.gngon\b[^{]*\{[^}]*\}/g) || []).length !== 1 || (src.match(/\.gnum\b[^{]*\{[^}]*\}/g) || []).length !== 1) fail('GAME: extra CSS rules for the pieces (.gngon / .gnum) — a piece could be styled by its answer');
      /* 整份 CSS 釘住（sha1）：任何 CSS 的改動都要先重跑 e2e（它量每一關托盤上每一塊的實際樣式是否一樣），再換這個值；也不准用屬性／:has 選擇器（可以從資料決定樣式） */
      {
        const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
        if (/\[data-|\[aria-(?!pressed="true"\])|:has\(/.test(css)) fail('GAME: the CSS uses attribute or :has() selectors — a piece could be styled by its answer');
        const h = crypto.createHash('sha1').update(css).digest('hex').slice(0, 12), CSS_PIN = 'd9cd6261c0a7';
        if (process.env.PRISMS_PINS) console.log('CSSPIN ' + h);
        if (h !== CSS_PIN) fail('GAME pin: the page CSS changed since the e2e verified every piece looks the same (sha1 ' + h + ', pinned ' + CSS_PIN + ') — re-run the e2e, then update CSS_PIN');
        /* 整份 script（連字典一起 —— 字典的值有函式，也能執行程式）也釘住：任何程式都不可以偷偷改一塊的樣式（codex 第七、八輪）—— 改了就重跑 e2e 再換值 */
        const code = (src.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
        if ((src.match(/<script\b/gi) || []).length !== 1 || /[\s\/]on[a-z]+\s*=/i.test(src.replace(/<script>[\s\S]*?<\/script>/, ''))) fail('GAME pin: the page must have exactly one <script> and no inline on…= handlers — anything else could change the game unpinned');
        const h2 = crypto.createHash('sha1').update(code).digest('hex').slice(0, 12), SCRIPT_PIN = '81f131b2d605';
        if (process.env.PRISMS_PINS) console.log('SCRIPTPIN ' + h2);
        if (h2 !== SCRIPT_PIN) fail('GAME pin: the page script changed since the e2e verified it (sha1 ' + h2 + ', pinned ' + SCRIPT_PIN + ') — re-run the e2e, then update SCRIPT_PIN');
      }
      { const sr = extractFunction(gsrc, 'startRound') || 'return';
        if (/\breturn\b/.test(sr.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME startRound() can return early — the game must never stop (no game over at 0 points)'); }
      { const nx = (gsrc.match(/gNext\.addEventListener\('click', function\(\)\{([\s\S]*?)\n {2}\}\);/) || [])[1] || '';
        if (!/if \(gRound < GAME_ORDER\.length - 1\)\{ gRound\+\+; startRound\(\); \}/.test(nx) || /gScore/.test(nx)) fail('GAME: "Next round" does not always go on to the next round (whatever the score)'); }
      /* 判斷與拖拉的程式碼釘住（sha1）：RENDER 的每一關和拖拉引擎的函式，任何改動都要先重跑 teaching-workspace/game-harness/g5-prisms 的 e2e
         （它真的拖、真的點，驗「收不收」與計分），再把這裡的 sha1 換成新的。上面的 need() 說明每一段守的是什麼；這裡擋的是「多插一行」。 */
      {
        const sha = t => crypto.createHash('sha1').update(t).digest('hex').slice(0, 12);
        const PIN_KEYS = ['RENDER.edges', 'RENDER.build', 'RENDER.sort', 'RENDER.net', 'RENDER.table', 'addPiece', 'useTapSelect', 'makeBoard', 'nearestOpen', 'roundSolved', 'roundMiss', 'roundInfo', 'roundNote', 'roundAgain', 'missOnce', 'glow', 'refreshHint', 'showHint', 'startRound', 'restartGame', 'drawSolidOnBoard', 'ngonSvg'];
        const PINS = {"RENDER.edges": "6f8a34e52503", "RENDER.build": "0000cb834c29", "RENDER.sort": "7f07ba563d77", "RENDER.net": "05143db42f8c", "RENDER.table": "97f445f15951", "addPiece": "2882f4e5d727", "useTapSelect": "bab2d6af337c", "makeBoard": "59e9a1067ac1", "nearestOpen": "811050d7b598", "roundSolved": "52e7ba85251c", "roundMiss": "f98f520e7645", "roundInfo": "f9e0e361c262", "roundNote": "cea80ecaf4fd", "roundAgain": "1f56d4548fae", "missOnce": "03d854665648", "glow": "507f195ea42d", "refreshHint": "4a03eb41edbd", "showHint": "f6099d6d682d", "startRound": "b07f95485bf0", "restartGame": "36d6dd5e4b57", "drawSolidOnBoard": "ced4c981ddbe", "ngonSvg": "f4902ad352fa"};
        if (Object.keys(PINS).sort().join() !== PIN_KEYS.slice().sort().join()) fail('GAME pin: the pinned functions are not exactly ' + PIN_KEYS.join(', '));
        PIN_KEYS.forEach(k => {
          const t = k.indexOf('RENDER.') === 0 ? RB[k.slice(7)] : extractFunction(gsrc, k);
          const h = t ? sha(t) : 'missing';
          if (h !== PINS[k]) fail('GAME pin: ' + k + ' changed since the e2e verified it (sha1 ' + h + ', pinned ' + PINS[k] + ') — re-run the e2e, then update PINS');
        });
        if (process.env.PRISMS_PINS) console.log('PINS ' + JSON.stringify(PIN_KEYS.reduce((o, k) => { const t = k.indexOf('RENDER.') === 0 ? RB[k.slice(7)] : extractFunction(gsrc, k); o[k] = t ? sha(t) : 'missing'; return o; }, {})));
      }

      /* --- 切出來真的跑：nearestOpen、roundMiss、missOnce、roundSolved --- */
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
      if (nearestOpen){
        const big = { i:0, cx:100, cy:50, hw:60, hh:30 }, small = { i:1, cx:175, cy:50, hw:15, hh:15 };
        [[155, 50, 0], [159.5, 50, 0], [161, 50, 1], [100, 50, 0], [175, 50, 1]].forEach(([x, y, want]) => {
          const r = nearestOpen([small, big], { x, y }, 10);
          if (!r || r.i !== want) fail('GAME nearestOpen() disagrees with the nearest box for unequal targets at ' + x + ',' + y + ': got ' + (r && r.i) + ', want ' + want + ' (it must measure to the box, not to the centre)');
        });
      }
      const sweep = (what, list, pad, H, needOverlap) => {
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
        if (needOverlap){
          let overlap = 0;
          for (let i = 0; i + 1 < list.length; i++){ const a = list[i], b = list[i + 1]; const gx = Math.abs(a.cx - b.cx) - a.hw - b.hw, gy = Math.abs(a.cy - b.cy) - a.hh - b.hh; if (Math.max(gx, gy) < 2 * pad) overlap++; }
          if (overlap < list.length - 1) fail('GAME ' + what + ': neighbouring targets do not overlap in their snap margins (' + overlap + '/' + (list.length - 1) + ')');
        }
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
        const rs = extractFunction(gsrc, 'roundSolved');
        if (!rs) fail('GAME: cannot cut roundSolved() out of index.html');
        else [false, true].forEach(mk => {
          let r;
          try { r = new Function('var gSolved = false, gMistake = ' + mk + ', gScore = 30, gRound = 1, GAME_ORDER = [1, 2, 3, 4, 5], elScore = {}, gMsg = {}, gHintBtn = {}, elHint = {}, gNext = {},' +
            ' gameStage = { querySelectorAll:function(){ return []; } }; function L(){ return { gPts:function(p){ return "+" + p; }, gClear:"", gWin:function(){ return ""; } }; }' + rs + '; roundSolved("ok"); roundSolved("again"); return gScore;')(); }
          catch (e){ fail('GAME: roundSolved() could not run: ' + e.message); return; }
          if (r !== 30 + (mk ? 10 : 20)) fail('GAME scoring: a round should give ' + (mk ? '+10 after a mistake' : '+20 with no mistakes') + ' (once), got ' + (r - 30));
        });
        const ri = extractFunction(gsrc, 'roundInfo');
        if (!ri) fail('GAME: cannot cut roundInfo() out of index.html');
        else { let r; try { r = new Function('var gMistake = false, gScore = 20, elScore = { textContent:"20" }, gMsg = { innerHTML:"" }; function roundMiss(){ gMistake = true; gScore -= 5; } function L(){ return { gMinus:"MINUS" }; }' + ri + '; roundInfo("fine"); return { s:gScore, k:gMistake, m:gMsg.innerHTML };')(); } catch (e){ fail('GAME: roundInfo() could not run: ' + e.message); }
          if (r && (r.s !== 20 || r.k || !/class="yes"/.test(r.m) || !/fine/.test(r.m))) fail('GAME roundInfo() (a correct placement) changes the score / records a mistake / does not show the good message'); }
        const ra = extractFunction(gsrc, 'roundAgain'), rn = extractFunction(gsrc, 'roundNote');
        if (!ra || /gScore|gMistake/.test(ra)) fail('GAME roundAgain() must only show the reason again — it touches the score or the mistake flag');
        if (!rn || /gScore|gMistake|class="no"/.test(rn)) fail('GAME roundNote() (tapping a counted edge again) must not touch the score, the mistake flag, or look like a mistake');
      }
      {
        const seen = {};
        for (let i = 0; i < 3000; i++){ const t = D.shuffle([0, 1, 2, 3]); seen[t.join('')] = 1; if (t.slice().sort().join() !== '0,1,2,3') { fail('GAME shuffle(): lost or duplicated an item'); break; } }
        if (Object.keys(seen).length < 24) fail('GAME shuffle(): only ' + Object.keys(seen).length + ' of the 24 orders of four items appeared in 3000 runs');
      }

      /* ---------------- 第 1 關：數稜 ---------------- */
      {
        if (JSON.stringify((D.GAME_EDGES || []).map(e => e[0])) !== '[3,4,5]') fail('GAME edges: the pool should be the 3-, 4- and 5-sided pyramids, got ' + JSON.stringify(D.GAME_EDGES));
        if (!Array.isArray(D.GAME_EDGES) || !D.GAME_EDGES.length || D.GAME_EDGES.some(e => !Array.isArray(e) || !(e[0] >= 3 && e[0] <= 5))) fail('GAME edges: the pyramids should have 3 to 5 base sides (more and the slanted edges crowd the tip), got ' + JSON.stringify(D.GAME_EDGES));
        const bx = D.EDGE.box;
        inside(bx, 'edges: the drawing box', D.EDGE_H);
        if (!(D.EDGE.tap <= 26)) fail('GAME edges: the tap band reaches ' + D.EDGE.tap + 'px from an edge — a tap far from every edge would still mark one (keep it ≤ 26)');
        if (!(D.EDGE.tap * scale >= 22)) fail('GAME edges: the tap band is ' + (2 * D.EDGE.tap * scale).toFixed(1) + 'px wide on a 375px phone — under 44');
        D.GAME_EDGES.forEach(([n, ph]) => {
          const ep = D.edgePlan(n, ph), ref = checkSolid('edges pyramid ' + n, 'pyramid', n, { phase:ph }), Q = D.solidFit(ref.plan, bx);
          if (ep.lines.length !== 2 * n || ep.lines.filter(L => L.base).length !== n) fail('GAME edges ' + n + ': ' + ep.lines.length + ' edges with ' + ep.lines.filter(L => L.base).length + ' around the base — want ' + 2 * n + ' and ' + n);
          let midClear = Infinity, q35Clear = Infinity;
          ep.lines.forEach((L, i) => {
            const R = ref.plan.lines[i];
            if (!sameSeg(L.a, L.b, Q[R.a], Q[R.b], 1e-9) || L.k !== R.k) fail('GAME edges ' + n + ': edge ' + i + ' is not the drawn pyramid’s edge');
            if (L.base !== (R.a !== ref.plan.apex && R.b !== ref.plan.apex)) fail('GAME edges ' + n + ': edge ' + i + ' is coloured as ' + (L.base ? 'a base edge' : 'a slanted edge') + ' wrongly');
            /* 自然的點法：中點與 ±35%（沿著稜）點下去，要點到它自己；而且離別的稜夠遠（中點 ≥ 8px；±35% 在尖點附近以外 ≥ 6px），手指點得開 */
            [0.15, 0.5, 0.85].forEach(t => {
              const p = { x:L.a[0] + t * (L.b[0] - L.a[0]), y:L.a[1] + t * (L.b[1] - L.a[1]) }, got = D.edgePick(ep.lines, p);
              if (!got || got.i !== i) fail('GAME edges ' + n + ': tapping edge ' + i + ' at ' + Math.round(t * 100) + '% picks ' + (got ? 'edge ' + got.i : 'nothing'));
              const nearApex = (t === 0.15 && R.a === ref.plan.apex) || (t === 0.85 && R.b === ref.plan.apex);
              ep.lines.forEach((O, j) => { if (j === i) return; const dd = segD([p.x, p.y], O.a, O.b); if (t === 0.5) midClear = Math.min(midClear, dd); else if (!nearApex) q35Clear = Math.min(q35Clear, dd); });
            });
          });
          if (!(midClear >= 8) || !(q35Clear >= 6)) fail('GAME edges ' + n + ': edges too close to tap apart — middle of an edge ' + midClear.toFixed(1) + 'px from another (want ≥ 8), ±35% ' + q35Clear.toFixed(1) + 'px (want ≥ 6)');
          /* 整片畫板：edgePick 點到的，一定是最近的稜（一樣近的哪一條都算）；EDGE.tap 以外不點 */
          let bad = 0, first = null;
          for (let x = 0; x <= W; x += 1) for (let y = 0; y <= D.EDGE_H; y += 1){
            let bd = Infinity;
            ep.lines.forEach(L => { bd = Math.min(bd, segD([x, y], L.a, L.b)); });
            const got = D.edgePick(ep.lines, { x, y }), gd = got ? segD([x, y], got.a, got.b) : null;
            if (Math.abs(bd - D.EDGE.tap) < 1e-6) continue;
            if (bd > D.EDGE.tap ? !!got : (!got || gd > bd + 1e-9)){ bad++; if (!first) first = [x, y, got && got.i, bd.toFixed(2)]; }
          }
          if (bad) fail('GAME edges ' + n + ': edgePick() does not pick the nearest edge (within ' + D.EDGE.tap + 'px) at ' + bad + ' points, first ' + JSON.stringify(first));
          const hidCount = ep.lines.filter(L => L.k === 'hidden').length;
          if (hidCount < 1) fail('GAME edges ' + n + ': no hidden edge — the round would not teach "dashed ones count too"');
          LANGS.forEach(L => {
            say('gEdgeDone(' + n + ')', L, I18N[L].gEdgeDone(n), [n, n, 2, n, 2 * n]);
            has('gEdgeDone(' + n + ')', L, I18N[L].gEdgeDone(n), { zh:[solidName('pyramid', n, 'zh')], en:[solidName('pyramid', n, 'en')] });
          });
        });
        LANGS.forEach(L => {
          for (let b = 0; b <= 6; b++) for (let s = 0; s <= 6; s++) say('gEdgeNow', L, I18N[L].gEdgeNow(b, s), [b, s]);
          has('gEdgeEarly(true)', L, I18N[L].gEdgeEarly(true), { zh:['虛線'], en:['dashed'] });
          hasNot('gEdgeEarly(false)', L, I18N[L].gEdgeEarly(false), { zh:['虛線'], en:['dashed'] });
          has('gEdge2(true)', L, I18N[L].gEdge2(true), { zh:['虛線'], en:['dashed'] });
          hasNot('gEdge2(false)', L, I18N[L].gEdge2(false), { zh:['虛線'], en:['dashed'] });
          [I18N[L].gEdgeEarly(true), I18N[L].gEdgeEarly(false), I18N[L].gEdgeAgain, I18N[L].gEdge2(true), I18N[L].gEdge2(false), I18N[L].gEdge2none].forEach(s => { if (typeof s !== 'string' || s.length < 8) fail('GAME edge message ' + L + ' is empty: ' + s); say('gEdge messages', L, s, []); });
        });
      }

      /* ---------------- 第 2 關：做角柱 ---------------- */
      {
        const Bd = D.BUILD;
        if (Bd.nMin !== 3 || !(Bd.nMax >= 8) || Bd.n0 !== Bd.nMin) fail('GAME build: the prism should start as a triangular prism and go up to at least 8 sides');
        inside(Bd.box, 'build: the drawing box', D.BUILD_H);
        for (let n = Bd.nMin; n <= Bd.nMax; n++){
          checkSolid('build prism ' + n, 'prism', n, null);
          const c = own('prism', n);
          ['f', 'e', 'v'].forEach(a => { if (D.buildCount(a, n) !== c[a]) fail('GAME build: buildCount(' + a + ', ' + n + ') is ' + D.buildCount(a, n) + ', a ' + n + '-gonal prism has ' + c[a]); });
          if (n < Bd.nMax){ const c2 = own('prism', n + 1); if (c2.f - c.f !== 1 || c2.e - c.e !== 3 || c2.v - c.v !== 2) fail('GAME build: "each extra base side adds 1 face, 3 edges, 2 vertices" is false at n = ' + n); }
          LANGS.forEach(L => { say('gBuildNow(' + n + ')', L, I18N[L].gBuildNow(n), [n]); has('gBuildNow(' + n + ')', L, I18N[L].gBuildNow(n), { zh:[solidName('prism', n, 'zh')], en:[solidName('prism', n, 'en')] }); });
        }
        if (D.GAME_BUILD.length !== 8) fail('GAME build: there should be 8 targets, got ' + D.GAME_BUILD.length);
        const kinds = {};
        D.GAME_BUILD.forEach(([attr, n]) => {
          kinds[attr] = 1;
          const T = own('prism', n)[attr];
          if (!(n > Bd.n0 && n <= Bd.nMax)) fail('GAME build: target n ' + n + ' must be reachable and not the starting prism');
          /* 每一個題目只有一個邊數對：按遍 3～nMax 的每一個「做好了」 */
          let okN = [];
          for (let k = Bd.nMin; k <= Bd.nMax; k++){
            const r = D.buildRefuse(attr, k, T), x = own('prism', k)[attr];
            if ((r === null) !== (x === T)) fail('GAME build: buildRefuse(' + attr + ', ' + k + ', ' + T + ') is wrong');
            if (r === null) okN.push(k);
            else {
              if (r.x !== x) fail('GAME build: the refusal for n = ' + k + ' says ' + r.x + ', the ' + k + '-gonal prism has ' + x);
              LANGS.forEach(L => {
                const s = I18N[L].gBuildBad(attr, k, r.x, T), rule = { f:[k, 2], e:[3, k], v:[2, k] }[attr];
                say('gBuildBad(' + attr + ',' + k + ',' + T + ')', L, s, rule.concat([x, T]));
                has('gBuildBad', L, s, { zh:[solidName('prism', k, 'zh')], en:[solidName('prism', k, 'en')] });
              });
            }
          }
          if (okN.join() !== String(n)) fail('GAME build: ' + T + ' ' + attr + ' should be made by exactly one prism (n = ' + n + '), got ' + okN.join());
          LANGS.forEach(L => {
            const rule = { f:[n, 2], e:[3, n], v:[2, n] }[attr];
            say('gBuildDone', L, I18N[L].gBuildDone(attr, n, T), rule.concat([T, 1, 3, 2]));
            say('gBuild2', L, I18N[L].gBuild2(attr, T, n), [T, { f:2, e:3, v:2 }[attr], n]);
            say('gAsks.build', L, I18N[L].gAsks.build(attr, T), [T]);
          });
        });
        if (Object.keys(kinds).length !== 3) fail('GAME build: the targets should ask faces, edges and vertices');
        /* 迷思陷阱：用錯規律會做出別的角柱（例如 12 個頂點用 3 × n 會做成四角柱）—— 題庫裡至少一半的題目，錯的規律會落在 3～nMax 之間 */
        const traps = D.GAME_BUILD.filter(([attr, n]) => { const T = own('prism', n)[attr]; return ['f', 'e', 'v'].some(o => o !== attr && [3, 4, 5, 6, 7, 8, 9, 10].some(k => k !== n && own('prism', k)[o] === T)); }).length;
        if (traps * 2 < D.GAME_BUILD.length) fail('GAME build: only ' + traps + ' targets catch a mixed-up rule');
      }

      /* ---------------- 第 3 關：分家族 ---------------- */
      {
        const S = D.SORT, H = D.SORT_H;
        if (D.SORT_BINS.join() !== 'prism,pyramid,sphere') fail('GAME sort: the bins should be prism, pyramid, sphere');
        const FAM = { prism:'prism', cylinder:'prism', pyramid:'pyramid', cone:'pyramid', sphere:'sphere' };
        Object.keys(D.SORT_ITEMS).forEach(id => {
          const it = D.SORT_ITEMS[id], fam = FAM[it.kind], p = it.pose || {};
          if (D.sortFam(id) !== fam) fail('GAME sort: ' + id + ' is put in ' + D.sortFam(id) + ', a ' + it.kind + ' is in the ' + fam + ' family');
          if (!!it.lying !== (p.roll === 90)) fail('GAME sort: ' + id + ' says lying ' + !!it.lying + ' but its pose roll is ' + p.roll);
          if (!!it.flipped !== !!p.flip) fail('GAME sort: ' + id + ' says upside down ' + !!it.flipped + ' but its pose flip is ' + p.flip);
          [0, 1, 2].forEach(b => { const r = D.sortRefuse(id, b); if ((r === null) !== (D.SORT_BINS[b] === fam) || (r !== null && r !== fam)) fail('GAME sort: sortRefuse(' + id + ', ' + b + ') is wrong'); });
          /* 這張卡看得出是哪一家嗎？柱體：一個底面看得到、另一個底面的邊也畫出來；錐體：尖點畫出來、底面的邊也畫出來 */
          if (it.kind !== 'sphere'){
            const plan = D.solidPlan(it.kind, it.n, it.pose), drawn = {};
            plan.lines.forEach(L => { drawn[L.a + '-' + L.b] = 1; });
            const baseDrawn = f => f.v.every((a, i) => { const b = f.v[(i + 1) % f.v.length]; return drawn[Math.min(a, b) + '-' + Math.max(a, b)]; });
            const bases = plan.faces.filter(f => f.base);
            if (fam === 'prism' && (bases.length !== 2 || !bases.some(f => f.vis) || !bases.every(baseDrawn))) fail('GAME sort: the ' + id + ' card does not show its two bases (one seen, the other outlined)');
            if (fam === 'pyramid' && (bases.length !== 1 || plan.apex < 0 || !baseDrawn(bases[0]))) fail('GAME sort: the ' + id + ' card does not show its one base and its tip');
            const svg = D.solidSVG(it.kind, it.n, it.pose, 100, 90, 'aria-hidden="true"');
            if (!/^<svg viewBox="0 0 100 90" aria-hidden="true">/.test(svg)) fail('GAME sort: the ' + id + ' card picture is not a 100 × 90 drawing');
          }
          LANGS.forEach(L => {
            const s = I18N[L].gSortBad(fam, it), round = it.kind === 'cylinder' || it.kind === 'cone';
            say('gSortBad(' + id + ')', L, s, []);
            const W0 = { prism:{ zh:'兩個一樣大、互相平行的底面', en:'two equal, parallel bases' }, pyramid:{ zh:'只有一個底面', en:'just one base' }, sphere:{ zh:'曲面', en:'curved all over' } }[fam];
            if (s.indexOf(W0[L]) < 0) fail('GAME gSortBad(' + id + ') ' + L + ' does not give the ' + fam + ' reason: ' + s);
            if (/躺著|lying/.test(s) !== !!it.lying) fail('GAME gSortBad(' + id + ') ' + L + ': "lying down" is said ' + /躺著|lying/.test(s) + ' but the card is lying ' + !!it.lying);
            if (/倒過來|upside/.test(s) !== !!it.flipped) fail('GAME gSortBad(' + id + ') ' + L + ': "upside down" is said ' + /倒過來|upside/.test(s) + ' but the card is upside down ' + !!it.flipped);
            if (/圓形|round/.test(s) !== round) fail('GAME gSortBad(' + id + ') ' + L + ': "round base" is said ' + /圓形|round/.test(s) + ' for a ' + it.kind);
            const h2 = I18N[L].gSort2(fam, it);
            say('gSort2(' + id + ')', L, h2, []);
            if (h2.indexOf(I18N[L].gSortBins[D.SORT_BINS.indexOf(fam)]) < 0) fail('GAME gSort2(' + id + ') ' + L + ' does not name the right bin: ' + h2);
          });
        });
        if (D.GAME_SORT.length !== 4) fail('GAME sort: there should be 4 card sets, got ' + D.GAME_SORT.length);
        D.GAME_SORT.forEach((set, si) => {
          if (set.length !== 6 || new Set(set).size !== 6) fail('GAME sort set ' + si + ': should be 6 different cards');
          const cnt = { prism:0, pyramid:0, sphere:0 };
          set.forEach(id => { if (!D.SORT_ITEMS[id]) fail('GAME sort set ' + si + ': unknown card ' + id); else cnt[FAM[D.SORT_ITEMS[id].kind]]++; });
          if (cnt.sphere !== 1 || cnt.prism < 2 || cnt.pyramid < 2 || cnt.prism > 3 || cnt.pyramid > 3) fail('GAME sort set ' + si + ': ' + JSON.stringify(cnt) + ' — want 1 sphere, 2–3 of each other family (a bin holds 4 small pictures)');
          const solids = set.map(id => D.SORT_ITEMS[id] && D.SORT_ITEMS[id].kind + D.SORT_ITEMS[id].n);
          if (new Set(solids).size !== 6) fail('GAME sort set ' + si + ': the same solid appears twice (turned) — every card should be a different solid');
          if (!set.some(id => D.SORT_ITEMS[id] && (D.SORT_ITEMS[id].lying || D.SORT_ITEMS[id].flipped))) fail('GAME sort set ' + si + ': nothing lying down or upside down');
          if (!set.some(id => D.SORT_ITEMS[id] && ['cylinder', 'cone'].indexOf(D.SORT_ITEMS[id].kind) >= 0)) fail('GAME sort set ' + si + ': no round-based solid');
          let inOrder = 0;
          for (let k = 0; k < 3000; k++){ const t = D.sortTray(set); if (t.slice().sort().join() !== set.slice().sort().join()){ fail('GAME sort: sortTray() lost a card'); break; } if (D.sortInOrder(t)) inOrder++; }
          if (inOrder) fail('GAME sort set ' + si + ': the tray started already sorted into the bin order ' + inOrder + ' times in 3000');
        });
        /* sortInOrder() 自己會響 */
        if (!D.sortInOrder(['tent', 'can', 'pyr4', 'cone', 'ball']) || D.sortInOrder(['pyr4', 'tent', 'ball'])) fail('GAME sort: sortInOrder() does not recognise the bin order');
        /* 版面：圖卡、框、標籤 */
        tooSmall('sort card', Math.min(S.cardW, S.cardH));
        const cardsB = [];
        for (let j = 0; j < 6; j++){ const c = box(S.trayX[j % 3], S.trayY[Math.floor(j / 3)], S.cardW, S.cardH); inside(c, 'sort card ' + j, H); cardsB.push(c); }
        noHits(cardsB, 'sort cards');
        const bins = [0, 1, 2].map(b => D.sortBin(b));
        bins.forEach((h, b) => {
          if (h.cx !== S.binX[b] || Math.abs(h.cy - h.hh - S.lblY) > EPS || Math.abs(h.cy + h.hh - (S.bodyY + S.bodyH)) > EPS || h.hw !== S.binW / 2) fail('GAME sort: bin ' + b + ' accept zone is not its label plus its box');
          inside(box(h.cx, h.cy, 2 * h.hw, 2 * h.hh), 'sort bin ' + b, H);
          cardsB.forEach((c, j) => { if (hit(c, box(h.cx, h.cy, 2 * (h.hw + S.pad), 2 * (h.hh + S.pad)))) fail('GAME sort: the snap margin of bin ' + b + ' reaches tray card ' + j); });
          const lbl = { x:S.binX[b] - S.binW / 2, y:S.lblY, w:S.binW, h:S.lblH }, bod = { x:S.binX[b] - S.binW / 2, y:S.bodyY, w:S.binW, h:S.bodyH };
          if (hit(lbl, bod)) fail('GAME sort: bin ' + b + ' label overlaps its box');
          const th = [0, 1, 2, 3].map(k => { const p = D.sortThumbXY(b, k); return box(p.x, p.y, S.thumb, S.thumb); });
          th.forEach((t, k) => { if (t.x < bod.x + 3 || t.x + t.w > bod.x + bod.w - 3 || t.y < bod.y + 3 || t.y + t.h > bod.y + bod.h - 3) fail('GAME sort: small picture ' + k + ' of bin ' + b + ' is not inside the box (3px border)'); if (hit(t, lbl)) fail('GAME sort: a small picture covers the bin label'); });
          noHits(th, 'sort small pictures of bin ' + b);
        });
        if (!(S.lblH >= 36)) fail('GAME sort: the bin label is ' + S.lblH + 'px tall — "Pyramid family" needs two lines');
        sweep('sort bins', bins.map((h, i) => Object.assign({ i }, h)), S.pad, H, true);
        LANGS.forEach(L => { [0, 1, 2].forEach(b => { const o = I18N[L].gSortOk(I18N[L].gSortBins[b]); say('gSortOk', L, o, []); if (typeof o !== 'string' || o.indexOf(I18N[L].gSortBins[b]) < 0 || I18N[L].gSortBins.some((x, j) => j !== b && o.indexOf(x) >= 0 && I18N[L].gSortBins[b].indexOf(x) < 0)) fail('GAME gSortOk ' + L + ' does not name the bin it was put in: ' + o); }); });
        LANGS.forEach(L => { if (!Array.isArray(I18N[L].gSortBins) || I18N[L].gSortBins.length !== 3) fail('GAME gSortBins ' + L); for (let k = 0; k <= 6; k++) say('gSortNow', L, I18N[L].gSortNow(k), [k, 6]); say('gSortDone', L, I18N[L].gSortDone, []); has('gSortDone', L, I18N[L].gSortDone, { zh:['躺著、倒過來'], en:['Lying down or upside down'] }); });
      }

      /* ---------------- 第 4 關：拼展開圖 ---------------- */
      {
        const NG = D.NETG;
        if (JSON.stringify(D.GAME_NET) !== '[3,5,6]') fail('GAME net: the pool should be the 3-, 5- and 6-sided prisms, got ' + JSON.stringify(D.GAME_NET));
        if (!D.GAME_NET.length || D.GAME_NET.some(n => n < 3 || n === 4)) fail('GAME net: the prisms should have 3, 5, 6… sides (a 4-sided prism is a box — the solid lesson’s cube nets), got ' + D.GAME_NET);
        D.GAME_NET.forEach(n => {
          const Lt = D.netLayout(n), a = Lt.a, H = Lt.H, dk = D.netDecoy(n);
          if (a !== D.netSide(n)) fail('GAME net ' + n + ': side length');
          if (dk === n || dk < 3) fail('GAME net ' + n + ': the decoy has ' + dk + ' sides');
          /* 側面要是長方形（不是正方形），而且誘答和任何一塊都不一樣：不是 n 邊形、也不是和側面一樣的那個四邊形 */
          if (!(NG.RH - a >= 6)) fail('GAME net ' + n + ': the side faces are ' + a + ' × ' + NG.RH + ' — nearly square, but the round calls them rectangles (and a square decoy would look like one)');
          if (dk === 4 && Math.abs(a - NG.RH) < 6) fail('GAME net ' + n + ': the square decoy is the same as a side face');
          [n, dk].forEach(k => { if (k === 4 && Math.abs(a - NG.RH) < 6) fail('GAME net ' + n + ': a ' + k + '-gon piece is congruent to a side face'); });
          const tray = D.netTray(n);
          if (tray.slice().sort().join() !== [n, n, dk].sort().join()) fail('GAME net ' + n + ': the tray should be two ' + n + '-gons and one ' + dk + '-gon, got ' + tray);
          /* 托盤：每一塊（拿取範圍 ≥ GPICK）在畫板裡、不重疊；邊長都是 a（只差在邊數 —— 誘答只在考的那一件事上不一樣） */
          const pcs = [n, n, dk].map((k, j) => box(NG.trayX[j], Lt.trayY, Math.max(D.GPICK, D.ngonWide(k, a)), Math.max(D.GPICK, D.ngonUp(k, a))));
          pcs.forEach((p, j) => inside(p, 'net ' + n + ' piece ' + j, H));
          noHits(pcs, 'net ' + n + ' pieces');
          [n, dk].forEach(k => {
            const P = D.ngonOnEdge([0, 0], [a, 0], k), r = regularOk(P, k, a);
            if (r) fail('GAME net: the ' + k + '-gon piece ' + r);
            const ys = P.map(p => p[1]), xs = P.map(p => p[0]);
            if (Math.abs(-Math.min(...ys) - D.ngonUp(k, a)) > 1e-9 || Math.abs(Math.max(...xs) - Math.min(...xs) - D.ngonWide(k, a)) > 1e-9) fail('GAME net: ngonUp/ngonWide of the ' + k + '-gon are not its size');
          });
          /* 長方形：n 個、寬 a、排在中間；每一個邊位（上、下）的範圍是底面貼上去之後佔的那一塊 */
          const rects = [];
          for (let i = 0; i < n; i++){ const r = { x:Lt.x0 + i * a, y:Lt.y0, w:a, h:NG.RH }; inside(r, 'net ' + n + ' rectangle ' + i, H); rects.push(r); }
          if (Math.abs(Lt.x0 * 2 + n * a - W) > 1e-9) fail('GAME net ' + n + ': the strip is not centred');
          if (Lt.slots.length !== 2 * n) fail('GAME net ' + n + ': ' + Lt.slots.length + ' edge slots, want ' + 2 * n);
          Lt.slots.forEach(s => {
            const base = D.ngonOnEdge(s.edge[0], s.edge[1], n), r = rects[s.i];
            const onEdge = s.side === 'top' ? sameSeg(s.edge[0], s.edge[1], [r.x, r.y], [r.x + a, r.y], 1e-9) : sameSeg(s.edge[0], s.edge[1], [r.x, r.y + r.h], [r.x + a, r.y + r.h], 1e-9);
            if (!onEdge) fail('GAME net ' + n + ': slot ' + s.side + s.i + ' is not the ' + s.side + ' edge of rectangle ' + s.i);
            const rp = [[r.x, r.y], [r.x + a, r.y], [r.x + a, r.y + r.h], [r.x, r.y + r.h]];
            if (rects.some(q => polysOverlap(base, [[q.x, q.y], [q.x + a, q.y], [q.x + a, q.y + q.h], [q.x, q.y + q.h]]))) fail('GAME net ' + n + ': a base on ' + s.side + s.i + ' would overlap the rectangles');
            const xs = base.map(p => p[0]), ys = base.map(p => p[1]), bb = { x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs) - Math.min(...xs), h:Math.max(...ys) - Math.min(...ys) };
            inside(bb, 'net ' + n + ' base on ' + s.side + s.i, H);
            if (Math.abs(bb.x + bb.w / 2 - s.cx) > 1e-6 || Math.abs(bb.y + bb.h / 2 - s.cy) > 1e-6 || Math.abs(bb.h / 2 - s.hh) > 1e-6 || Math.abs(s.hw - a / 2) > 1e-9) fail('GAME net ' + n + ': slot ' + s.side + s.i + ' is not the box the base covers when joined there');
            if (bb.y + bb.h > Lt.trayY - Lt.pieceH / 2 - 8 && s.side === 'bottom') fail('GAME net ' + n + ': a bottom base would reach the tray');
            void rp;
          });
          /* 每一種「哪一塊 × 哪一個邊位 × 第一個底面在哪」：只有「n 邊形、而且和第一個不同邊」才收 —— 摺起來兩個底面才在相對的兩頭 */
          [n, dk].forEach(k => ['top', 'bottom'].forEach(side => [null, 'top', 'bottom'].forEach(bs => {
            const r = D.netRefuse(n, k, side, bs), want = k !== n ? 'decoy' : (bs && bs === side ? 'same' : null);
            if (r !== want) fail('GAME net ' + n + ': netRefuse(' + k + '-gon, ' + side + ', first on ' + bs + ') is ' + r + ', want ' + want);
          })));
          sweep('net ' + n + ' top slots', Lt.slots.filter(s => s.side === 'top').map(s => Object.assign({}, s, { i:s.i })), NG.pad, H, true);
          sweep('net ' + n + ' bottom slots', Lt.slots.filter(s => s.side === 'bottom').map(s => Object.assign({}, s, { i:s.i })), NG.pad, H, true);
          /* 放在長方形的中間：上下兩排的放寬範圍都碰不到 —— 不知道要放哪一邊，就不判斷 */
          if (2 * NG.pad >= NG.RH - 20) fail('GAME net: the snap margins of the top and bottom rows leave less than 20px in the middle of the rectangles');
          LANGS.forEach(L => {
            say('gNetDecoy', L, I18N[L].gNetDecoy(dk, n), [dk, n, n]);
            say('gNetDone', L, I18N[L].gNetDone(n), L === 'zh' ? [n, n, n, 2, n + 2] : [n, n, n, 2, n + 2]);
            has('gNetDone', L, I18N[L].gNetDone(n), { zh:[solidName('prism', n, 'zh')], en:[solidName('prism', n, 'en')] });
            [null, 'top', 'bottom'].forEach(bs => { const h = I18N[L].gNet2(n, bs); say('gNet2', L, h, [n, n]); if (bs && h.indexOf(L === 'zh' ? (bs === 'top' ? '下面' : '上面') : (bs === 'top' ? 'bottom' : 'top')) < 0) fail('GAME gNet2 ' + L + ' does not send the second base to the other side'); });
          });
        });
        LANGS.forEach(L => {
          [true, false].forEach(t => {
            const s = I18N[L].gNetSame(t), o = I18N[L].gNetOk1(t);
            say('gNetSame', L, s, []); say('gNetOk1', L, o, []);
            has('gNetSame', L, s, { zh:[t ? '上面' : '下面', '相對的兩頭'], en:[t ? 'top' : 'bottom', 'opposite ends'] });
            has('gNetOk1', L, o, { zh:[t ? '下面' : '上面'], en:[t ? 'bottom' : 'top'] });
          });
          for (let k = 0; k <= 2; k++) say('gNetNow', L, I18N[L].gNetNow(k), [k, 2]);
        });
      }

      /* ---------------- 第 5 關：填規律表 ---------------- */
      {
        const T = D.TABLE, H = D.TABLE_H;
        if (D.TABLE_ATTR.join() !== 'f,e,v') fail('GAME table: the slots should be faces, edges, vertices');
        const fams = {};
        D.GAME_TABLE.forEach(([fam, n]) => {
          fams[fam] = 1;
          if (!(n >= 9 && n <= 20)) fail('GAME table: n ' + n + ' — the base should have 9 to 20 sides (too many to draw and count, so the rule is the tool)');
          const c = own(fam, n), cards = D.tableCards(fam, n);
          if (JSON.stringify(D.famCounts(fam, n)) !== JSON.stringify(c)) fail('GAME table: famCounts(' + fam + ', ' + n + ') is wrong');
          if (cards.length !== 5) fail('GAME table: 5 cards');
          const rest = cards.slice(); [c.f, c.e, c.v].forEach(v => { const i = rest.indexOf(v); if (i < 0) fail('GAME table ' + fam + n + ': the cards do not hold the answer ' + v); else rest.splice(i, 1); });
          /* 多的兩張：不等於任何一個答案（不然放錯格也說不清），而且是點名的常見錯 */
          rest.forEach(v => { if ([c.f, c.e, c.v].indexOf(v) >= 0) fail('GAME table ' + fam + n + ': the extra card ' + v + ' equals an answer'); });
          const want = fam === 'prism' ? [n, n + 1] : [3 * n, n];
          if (rest.slice().sort((x, y) => x - y).join() !== want.slice().sort((x, y) => x - y).join()) fail('GAME table ' + fam + n + ': the extra cards ' + rest + ' should be the misconceptions ' + want);
          let inOrder = 0;
          for (let k = 0; k < 3000; k++){ const t = D.tableTray(fam, n); if (t.slice().sort().join() !== cards.slice().sort().join()){ fail('GAME table: tableTray() lost a card'); break; } if (t[0] === c.f && t[1] === c.e && t[2] === c.v) inOrder++; }
          if (inOrder) fail('GAME table ' + fam + n + ': the first three cards started in the faces/edges/vertices order ' + inOrder + ' times in 3000');
          /* 每一張卡 × 每一格 */
          new Set(cards).forEach(v => [0, 1, 2].forEach(s => {
            const r = D.tableRefuse(fam, n, s, v), w = c[['f', 'e', 'v'][s]];
            if ((r === null) !== (v === w) || (r && r.want !== w)) fail('GAME table ' + fam + n + ': tableRefuse(card ' + v + ', slot ' + s + ') is wrong');
            if (r) LANGS.forEach(L => {
              const msg = I18N[L].gTableBad(fam, n, s, v);
              const rule = { prism:{ f:[n, 2, n, 2, w], e:[n, n, n, 3, n, w], v:[n, n, 2, n, w] }, pyramid:{ f:[n, 1, n, 1, w], e:[n, n, 2, n, w], v:[n, 1, n, 1, w] } }[fam][['f', 'e', 'v'][s]];
              say('gTableBad(' + fam + n + ',' + s + ',' + v + ')', L, msg, rule.concat([v]));
            });
          }));
          LANGS.forEach(L => {
            [0, 1, 2].forEach(s => { say('gTableOk', L, I18N[L].gTableOk(fam, n, s), []); say('gTable2', L, I18N[L].gTable2(fam, n, s), []); });
            say('gTableDone', L, I18N[L].gTableDone(fam, n), fam === 'prism' ? [n, n, 2, c.f, 3, n, c.e, 2, n, c.v] : [n, n, 1, c.f, 2, n, c.e, n, 1, c.v]);
          });
        });
        if (D.GAME_TABLE.length !== 6) fail('GAME table: there should be 6 entries');
        if (!fams.prism || !fams.pyramid) fail('GAME table: the pool should have both prisms and pyramids');
        /* 規律句子：兩種家族 × 三格 × 兩種語言，說的就是那一格 */
        LANGS.forEach(L => ['prism', 'pyramid'].forEach(fam => ['f', 'e', 'v'].forEach(attr => {
          const s = D.gRuleSentence(fam, 11, attr, L);
          if (nums(s).slice(-1)[0] !== own(fam, 11)[attr]) fail('GAME gRuleSentence(' + fam + ', 11, ' + attr + ') ' + L + ' does not end with ' + own(fam, 11)[attr]);
          if (s.indexOf(D.G_WORD[L][attr]) < 0) fail('GAME gRuleSentence ' + L + ' does not name ' + D.G_WORD[L][attr]);
        })));
        tooSmall('table card', Math.min(T.cardW, T.cardH));
        const cardsB = T.trayX.map((x, j) => box(x, T.trayY[j], T.cardW, T.cardH));
        cardsB.forEach((c, j) => inside(c, 'table card ' + j, H));
        noHits(cardsB, 'table cards');
        const slots = [0, 1, 2].map(s => Object.assign({ i:s }, D.tableHit(s)));
        slots.forEach((h, s) => {
          if (h.cx !== T.slotX[s] || Math.abs(h.cy - h.hh - T.lblY) > EPS || Math.abs(h.cy + h.hh - (T.slotY + T.slotH)) > EPS) fail('GAME table: slot ' + s + ' accept zone is not its label plus its box');
          cardsB.forEach((c, j) => { if (hit(c, box(h.cx, h.cy, 2 * (h.hw + T.pad), 2 * (h.hh + T.pad)))) fail('GAME table: the snap margin of slot ' + s + ' reaches tray card ' + j); });
          /* 放好的卡片在格子裡、不蓋住標籤 */
          const placed = box(T.slotX[s], T.slotY + T.slotH / 2, T.cardW, T.cardH), sl = { x:T.slotX[s] - T.slotW / 2, y:T.slotY, w:T.slotW, h:T.slotH };
          if (placed.x < sl.x || placed.x + placed.w > sl.x + sl.w || placed.y < sl.y || placed.y + placed.h > sl.y + sl.h) fail('GAME table: a placed card does not fit slot ' + s);
          if (hit(placed, { x:sl.x, y:T.lblY, w:T.slotW, h:T.lblH })) fail('GAME table: a placed card covers the label of slot ' + s);
        });
        sweep('table slots', slots, T.pad, H, true);
        LANGS.forEach(L => { for (let k = 0; k <= 3; k++) say('gTableNow', L, I18N[L].gTableNow(k), [k, 3]); });
      }
      LANGS.forEach(L => { [0, 5, 85].forEach(s => say('gWin', L, I18N[L].gWin(s), L === 'zh' ? [s] : [5, s])); [10, 20].forEach(p => say('gPts', L, I18N[L].gPts(p), [p])); say('gMinus', L, I18N[L].gMinus, [5]); });
    }
  }
};
