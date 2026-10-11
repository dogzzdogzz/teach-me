/* grade-5/math/angle-sum 的檢查設定（角度偵探：三角形內角和 180°、四邊形內角和 360°、求未知角、正三角形／等腰／直角三角形）。
   2026-10-11 新增 —— 和小遊戲「神祕角獵人」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的八個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，不呼叫頁面的 fmt）、
   選項的形狀與範圍、解釋裡的算式逐條驗算、選項的「值」不可以把題幹的數字抄回來（simgen 的通用檢查只比字串，
   「70°」和題幹的「70」它比不到，所以這裡用 renderCheck 比值）；刻意的迷思誘答只放行那一個值（ECHO_OK）。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫的題幹與解釋）裡「數 ＝ 數」的每一個等號逐個重算（「°」先拿掉，不然 180° × 2 會被切斷而不驗）。
   - 範例 3 的三角形：把頁面的 triShape() 切出來真的跑，從畫出來的三個點量角，要等於它標的三個度數。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲自己的規則把題庫的每一題玩一遍，答案與幾何用這裡自己的算法重算（atan2 量角、自己解兩條線的交點）：
       撕角拼直線 —— 每一個角的扇形就是那個角；三個角照任何順序排上直線，都是一塊接一塊、從 180° 剛好排到 0°；別的三角形的角不收；
       切一刀 —— 四邊形照比例畫（量到的角 ＝ 標的度數），六種點法（同一個角、四條邊、兩條對角線）各判對；切開之後的兩個「180°」各在自己的三角形裡；
       轉一轉 —— 每一題的每一個 B 角：C 是兩條邊的交點（自己解）、量到的三個角 ＝ 標的、C ＝ 180 − A − B；
                 只有一個 B 收、說 B 要轉大還是轉小的那一句真的是對的方向；
       分一分 —— 每一張卡 × 每一個箱子，跟自己的分類比；每一句「不是正三角形／沒有兩個一樣大／沒有 90°」對那張卡都成立；
       打出來 —— 每一題的每一個 0～400 的數；寫法不正常的字串只提醒。
     每一句說明兩種語言逐個比數字、句子裡的算式逐條重算（lib/arith.js）；
     cutPick、turnSnap 整片畫板逐點和這裡自己的「最近」比；shuffle()、unsorted()、nearestOpen()、roundMiss()、roundAgain() 從原始碼切出來真的跑；
     「同一個錯不重複扣分」把每一關的那一段切出來照 A、B、A、A、B 跑；
     圖上每一個字（A～F、四邊形的度數、轉一轉的度數與「?」、切開後的「180°」）用自己的字框與線段距離量 ≥ 2px，而且離自己的頂點最近；
     版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；RENDER 裡的關鍵規則用原始碼形狀守住（need()）。

   刻意的 44px 例外：第 3 關「點軌道上的一格」每一格只隔 5°（半徑 56 時約 4.9px），比 44px 窄 ——
   那是拖圈圈之外的替代做法（另外還有 −5°／＋5° 兩個 48px 的按鈕）；每一格自己一格（最近的那一格），由這裡逐點掃、e2e 點中間與 ±35%。
   第 2 關的「點一個角」是點的範圍半徑 QUAD.pick（24，直徑 48）＋ 它的度數字框，不是例外。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、文字放不放得進框、375px 的實際尺寸、畫出來的 SVG 量角由 teaching-workspace/game-harness/g5-angle-sum 的端對端測試驗。 */

const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const arithGame = makeArith({ units:['°', '份', '條'], unitsEn:['parts?'] });
/* 「? ＝ 180 − 40 − 70 ＝ 70」：前面的「? ＝」是題目，後面那一條是宣稱 —— 拿掉「? ＝」再驗，不然整條被當成題目而不驗 */
const claimOf = s => String(s).replace(/\?\s*[＝=]\s*/g, '').replace(/——|\s—\s/g, '，');   /* 破折號不是減號：arith 會把「——」當成「--」接到算式上 */

/* 靜態字串的等號：每一個「數的算式 ＝ 數的算式」逐個重算。左邊緊貼著運算子的是規則式，不是宣稱，另外數。 */
function chainClaims(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/°/g, '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/＋/g, '+').replace(/[－−–]/g, '-').replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/＝/g, '=');
  const out = { claims:[], rules:0 };
  t.split(/[，。；;,\n：:（）]|\.(?=\s|$)|(?:\s—\s)|——/).forEach(cl => {
    const seg = cl.split('=');
    for (let i = 0; i + 1 < seg.length; i++){
      const L = seg[i].match(/([\d\s+\-*/().]*\d[\d\s+\-*/().]*)$/), R = seg[i + 1].match(/^([\d\s+\-*/().]*\d[\d\s+\-*/().]*)/);
      if (!L || !R) continue;
      let le = L[1].trim(), re = R[1].trim();
      const before = seg[i].slice(0, seg[i].length - L[1].length).trim();
      if (/^[+\-*/]/.test(le) || /[+\-*/]$/.test(before)) { out.rules++; continue; }
      const bal = s => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
      if (bal(le) < 0){ out.rules++; continue; }
      /* 右邊多出來的括號切掉；切不動（括號夾在中間）就不算宣稱 —— 一定要會停（第一版在這裡無限迴圈） */
      for (let g = 0; bal(re) > 0 && g < 20; g++){ const nx = re.replace(/\([^()]*$/, '').trim(); if (nx === re) break; re = nx; }
      for (let g = 0; bal(re) < 0 && g < 20; g++){ const nx = re.replace(/\)\s*$/, '').trim(); if (nx === re) break; re = nx; }
      if (bal(re) !== 0){ out.rules++; continue; }
      re = re.replace(/[+\-*/\s]+$/, '');
      if (!re || !/\d/.test(re)) continue;
      let a, b;
      try { a = Function('return (' + le + ')')(); b = Function('return (' + re + ')')(); } catch (e){ out.claims.push({ text:le + ' = ' + re, bad:'cannot evaluate' }); continue; }
      out.claims.push({ text:le + ' = ' + re, bad:Math.abs(a - b) > 1e-9 ? 'left is ' + a + ', right is ' + b : null });
    }
  });
  return out;
}

/* ---- 自己的幾何（不呼叫頁面的函式） ---- */
const R2D = 180 / Math.PI;
const angAt = (P, Q, R) => { let d = Math.abs(Math.atan2(P.y - Q.y, P.x - Q.x) - Math.atan2(R.y - Q.y, R.x - Q.x)) * R2D; return d > 180 ? 360 - d : d; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segD = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy); };
const inside = (p, Q) => { let c = false; for (let a = 0, b = Q.length - 1; a < Q.length; b = a++){ if ((Q[a].y > p.y) !== (Q[b].y > p.y) && p.x < (Q[b].x - Q[a].x) * (p.y - Q[a].y) / (Q[b].y - Q[a].y) + Q[a].x) c = !c; } return c; };
/* 兩條直線（點 + 方向）的交點 */
const meet = (P, u, Q, v) => { const det = u.x * (-v.y) - (-v.x) * u.y; const t = ((Q.x - P.x) * (-v.y) - (-v.x) * (Q.y - P.y)) / det; return { x:P.x + t * u.x, y:P.y + t * u.y }; };
/* 字框到線段的距離（碰到或穿過就是 0） */
function rsd(r, a, b){
  const pr = p => Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h));
  if (pr(a) === 0 || pr(b) === 0) return 0;
  const C = [{ x:r.x, y:r.y }, { x:r.x + r.w, y:r.y }, { x:r.x + r.w, y:r.y + r.h }, { x:r.x, y:r.y + r.h }];
  const cr = (p, q, u, v) => { const d = (q.x - p.x) * (v.y - u.y) - (q.y - p.y) * (v.x - u.x); if (!d) return false; const t = ((u.x - p.x) * (v.y - u.y) - (u.y - p.y) * (v.x - u.x)) / d, w = ((u.x - p.x) * (q.y - p.y) - (u.y - p.y) * (q.x - p.x)) / d; return t >= 0 && t <= 1 && w >= 0 && w <= 1; };
  for (let i = 0; i < 4; i++) if (cr(a, b, C[i], C[(i + 1) % 4])) return 0;
  return Math.min(pr(a), pr(b), ...C.map(c => segD(c, a, b)));
}
/* 自己的字框（和頁面同一個估計：字數 × 0.62 × 字級 ＋ 2、1.45 × 字級 —— 估計本身由 e2e 量真的字框驗） */
const box = (L) => { const w = String(L.v).length * 0.62 * L.fs + 2, h = 1.45 * L.fs; return { x:L.at.x - w / 2, y:L.at.y - h / 2, w, h }; };
/* 一個角的小弧，取樣成 24 段 */
function arcSegs(V, U, W, r, w){
  const a = Math.atan2(U.y - V.y, U.x - V.x); let d = Math.atan2(W.y - V.y, W.x - V.x) - a;
  while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  const out = [];
  for (let i = 0; i < 24; i++){ const t0 = a + d * i / 24, t1 = a + d * (i + 1) / 24; out.push({ a:{ x:V.x + r * Math.cos(t0), y:V.y + r * Math.sin(t0) }, b:{ x:V.x + r * Math.cos(t1), y:V.y + r * Math.sin(t1) }, w }); }
  return out;
}
const edgesOf = (P, w) => P.map((p, i) => ({ a:p, b:P[(i + 1) % P.length], w }));
/* SVG path「M x,y L x,y A r,r 0 0,s x,y Z」（扇形）／「M x,y A r,r 0 0,s x,y」（弧）讀回來 */
function readPath(d){
  const n = (String(d).match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  /* M Vx,Vy L px,py A r,r rot large,sweep qx,qy Z  ／  M px,py A r,r rot large,sweep qx,qy */
  if (/L/.test(d)) return { V:{ x:n[0], y:n[1] }, p:{ x:n[2], y:n[3] }, r:n[4], large:n[7], sweep:n[8], q:{ x:n[9], y:n[10] }, wedge:true, closed:/Z\s*$/.test(d), count:n.length };
  return { p:{ x:n[0], y:n[1] }, r:n[2], large:n[5], sweep:n[6], q:{ x:n[7], y:n[8] }, wedge:false, count:n.length };
}
/* 數學方向（y 往上）的角度，給直線上的扇形用：左邊那一半是 180、右邊是 0 */
const upDeg = (V, E) => { let a = Math.atan2(-(E.y - V.y), E.x - V.x) * R2D; a = (a + 360) % 360; return a > 270 ? a - 360 : a; };

/* review.html：題幹印出來的數字（當成值比，不是字串比） */
const ECHO_OK = {
  /* 頂角 90° 時，「忘了除以 2」的 180 − 90 ＝ 90 剛好就是題幹的頂角：刻意的迷思誘答，只放行這一個值 */
  isoTop2Base: (d, v) => v === 180 - d.apex,
  /* 「以為頂角和底角一樣大」：刻意把題幹的底角放進選項 */
  isoBase2Top: (d, v) => v === d.base
};

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲「神祕角獵人」的引擎與計分 ---- */
    { file:'index', expect:"GAME_ORDER should be", find:"var GAME_ORDER = ['tear', 'cut', 'turn', 'sort', 'input'];", replace:"var GAME_ORDER = ['cut', 'tear', 'turn', 'sort', 'input'];" },
    { file:'index', expect:"under 44", find:"  var GPICK = 48;", replace:"  var GPICK = 40;" },
    { file:'index', expect:"shuffle(): only", find:"      var k = Math.floor(Math.random() * (j + 1));   /* 自足", replace:"      var k = j;   /* 自足" },
    { file:'index', expect:"still start in the answer order", find:"      if (!inOrder(u)) t = u;\n", replace:"" },
    { file:'index', expect:"scoring: a round should give", find:"    var pts = gMistake ? 10 : 20;", replace:"    var pts = 20;" },
    { file:'index', expect:"a mistake does not cost 5", find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;", replace:"    elScore.textContent = gScore;" },
    { file:'index', expect:"shown although nothing was taken", find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:"does not clear the hint", find:"    elHint.textContent = '';   /* 過關了", replace:"    /* 過關了" },
    { file:'index', expect:"nearestOpen(): a point inside", find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"nearestOpen(): a drop nearest to a finished slot", find:"    return best && !best.done ? best : null;\n  }\n\n  function roundSolved", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n\n  function roundSolved" },
    { file:'index', expect:"board generation", find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n", replace:"" },
    { file:'index', expect:"second finger", find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;", replace:"if (P.locked || gSolved || start || gen !== gGen) return;" },
    { file:'index', expect:"second finger can start a board tap", find:"      if (!e.isPrimary) return;   /* 第二根手指", replace:"      if (false) return;   /* 第二根手指" },
    { file:'index', expect:"losing pointer capture", find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n", replace:"" },
    { file:'index', expect:"placed pieces still catch taps", find:"  .gpiece.locked{cursor:default;pointer-events:none}", replace:"  .gpiece.locked{cursor:default}" },
    { file:'index', expect:"does not snap to a tick while it is dragged", find:"      if (o.snap){ var q = o.snap({ x:orig.x + dx, y:orig.y + dy }); P.place(q.x, q.y); }", replace:"      if (o.snap){ P.place(orig.x + dx, orig.y + dy); }" },
    { file:'index', expect:"ahead mode", find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式", replace:"    if (mode === 'school'){ hintLevel = 1; showHint(); }   /* 超前模式" },
    { file:'index', expect:"gets a viewBox", find:"    var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, 'aria-hidden':'true' });", replace:"    var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, viewBox:'0 0 ' + B.W + ' ' + B.H, 'aria-hidden':'true' });" },
    { file:'index', expect:"roundInfo() (a message that is not a mistake)", find:"  function roundInfo(text){ gMsg.innerHTML = '<span class=\"yes\">' + text + '</span>'; }", replace:"  function roundInfo(text){ gMistake = true; gMsg.innerHTML = '<span class=\"yes\">' + text + '</span>'; }" },
    { file:'index', expect:"roundNote() should show the reminder", find:"  function roundNote(text){ gMsg.innerHTML = '<span class=\"gnote\">' + text + '</span>'; }", replace:"  function roundNote(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }" },
    { file:'index', expect:"roundAgain() charges again", find:"  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", replace:"  function roundAgain(text){ gMistake = true; gScore = Math.max(0, gScore - 5); gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }" },
    { file:'index', expect:"a tap on a piece does not pass where", find:"      if (!moved){ if (B.onTap) B.onTap(P, B.toBoard(e)); return; }", replace:"      if (!moved){ if (B.onTap) B.onTap(P); return; }" },
    { file:'index', expect:"tear (wrong A, B, A, A, B should be charged twice)", find:"          if (badSeen[key]){ if (lastBad !== key){ lastBad = key; roundAgain(d.gTearBad(name, t)); } return false; }", replace:"          if (lastBad === key) return false;" },
    { file:'index', expect:"cut: wrong A, B, A, A, B should be charged twice", find:"          if (badSeen[key]){ if (lastBad !== key){ lastBad = key; roundAgain(d.gCutSide); } return; }", replace:"          if (badSeen[key]){ if (lastBad !== key){ lastBad = key; roundMiss(d.gCutSide); } return; }" },
    { file:'index', expect:"turn (wrong A, B, A, A, B should be charged twice)", find:"          badSeen[b] = true; lastBad = b;\n", replace:"          lastBad = b;\n" },
    { file:'index', expect:"sort: wrong A, B, A, A, B should be charged twice", find:"          if (badSeen[key]){ if (lastBad !== key){ lastBad = key; roundAgain(d.gSortBad(c[0], c[1], sortThird(c), bin.k)); } return false; }", replace:"          if (badSeen[key]){ return false; }" },
    { file:'index', expect:"input: wrong A, B, A, A, B should be charged twice", find:"          badSeen[v] = true; lastBad = v;\n          roundMiss(d.gInBad(inKnown(q), v, bad.s, bad.more));", replace:"          badSeen = {}; badSeen[v] = true; lastBad = v;\n          roundMiss(d.gInBad(inKnown(q), v, bad.s, bad.more));" },
    /* 第 1 關：撕角拼直線 */
    { file:'index', expect:"have the same angles", find:"[[60, 60, 60], [30, 35, 115]]", replace:"[[60, 60, 60], [60, 60, 60]]" },
    { file:'index', expect:"three whole angles of 25~120 adding to 180", find:"[[50, 60, 70], [30, 40, 110]]", replace:"[[50, 60, 70], [20, 50, 110]]" },
    { file:'index', expect:"three whole angles of 25~120 adding to 180", find:"[[45, 75, 60], [100, 45, 35]]", replace:"[[45, 75, 60], [100, 45, 45]]" },
    { file:'index', expect:"is drawn as", find:"    var AC = Math.sin(rad(ang[1])) / Math.sin(rad(ang[2]));", replace:"    var AC = Math.sin(rad(ang[0])) / Math.sin(rad(ang[2]));" },
    { file:'index', expect:"is drawn as", find:"    return pts.map(function(p){ return { x:ox + (p.x - x0) * k, y:oy + (p.y - y0) * k }; });", replace:"    return pts.map(function(p){ return { x:ox + (p.x - x0) * k, y:oy + (p.y - y0) * k * 0.9 }; });" },
    { file:'index', expect:"drawn below the line", find:"' A' + r + ',' + r + ' 0 0,' + (cross > 0 ? 1 : 0) + ' '", replace:"' A' + r + ',' + r + ' 0 0,' + (cross > 0 ? 0 : 1) + ' '" },
    { file:'index', expect:"does not sit right next to the last one", find:"a1 = rad(180 - from - deg);", replace:"a1 = rad(180 - deg);" },
    { file:'index', expect:"takes the other triangle", find:"  function tearRefuse(tri, line){ return tri === line ? null : 'other'; }", replace:"  function tearRefuse(tri, line){ return null; }" },
    { file:'index', expect:"does not cover its line", find:"var TEAR = { R:24, ly:196, ox:[75, 225], half:62, zw:72,", replace:"var TEAR = { R:24, ly:196, ox:[75, 225], half:62, zw:50," },
    { file:'index', expect:"do not overlap", find:"zh:34, zcy:178, pad:8, lblD:4,", replace:"zh:34, zcy:178, pad:1, lblD:4," },
    { file:'index', expect:"tearInOrder(): does not see", find:"  function tearInOrder(list){ return list[0].t === list[1].t && list[1].t === list[2].t; }", replace:"  function tearInOrder(list){ return list[0].t === 0 && list[1].t === 0 && list[2].t === 0; }" },
    { file:'index', expect:"would overlap", find:"var TEAR = { R:24, ly:196,", replace:"var TEAR = { R:34, ly:196," },
    { file:'index', expect:"tear tiles", find:"trayY:[262, 334] }, TEAR_H", replace:"trayY:[262, 310] }, TEAR_H" },
    { file:'index', expect:"come within 2px of the line or the tray", find:"lblD:4, lblY:214, box:", replace:"lblD:4, lblY:222, box:" },
    { file:'index', expect:"the line judged is not the nearest", find:"        var z = nearestOpen(zones, pt, TEAR.pad);", replace:"        var z = nearestOpen(zones, { x:pt.x, y:pt.y }, TEAR.pad * 3);" },
    { file:'index', expect:"solved exactly when all six", find:"        if (done === 6) roundSolved(d.gTearDone);", replace:"        if (done >= 5) roundSolved(d.gTearDone);" },
    { file:'index', expect:"must name the corner, its triangle and the other line", find:"return n + ' 角是 ' + me + ' 撕下來的 —— '", replace:"return '這個角是 ' + me + ' 撕下來的 —— '" },
    { file:'index', expect:"must not say \"only the three corners of one triangle\"", find:"we want to see what the three corners of ONE triangle make together.'; },", replace:"only the three corners of one triangle make a straight line — we want to see what the three corners of ONE triangle make together.'; }," },
    { file:'index', expect:"gTearNow zh", find:"      gTearNow: function(n0, n1){ return '△ABC ' + n0 + ' / 3　　△DEF ' + n1 + ' / 3'; },\n      gTearLine: function(i){ return ['△ABC', '△DEF'][i]; },\n      gTearLineDone: function(i){ return ['△ABC', '△DEF'][i] + ' ＝ 180°'; },", replace:"      gTearNow: function(n0, n1){ return '△ABC ' + n1 + ' / 3　　△DEF ' + n0 + ' / 3'; },\n      gTearLine: function(i){ return ['△ABC', '△DEF'][i]; },\n      gTearLineDone: function(i){ return ['△ABC', '△DEF'][i] + ' ＝ 180°'; }," },
    { file:'index', expect:"tile A: label", find:"start:{ x:m.x - o.x * 8, y:m.y - o.y * 8 }, dirs:fanDirs({ x:-o.x, y:-o.y }) }], strokes, { x0:4, y0:4, x1:TEAR.pw - 4, y1:TEAR.pw - 4 })[0];", replace:"start:{ x:m.x - o.x * 8, y:m.y - o.y * 8 }, dirs:fanDirs({ x:-o.x, y:-o.y }) }], [], { x0:4, y0:4, x1:TEAR.pw - 4, y1:TEAR.pw - 4 })[0];" },
    /* 第 2 關：切一刀 */
    { file:'index', expect:"adding to 360", find:"var GAME_CUT = [[75, 110, 95, 80, 0.9],", replace:"var GAME_CUT = [[75, 110, 95, 85, 0.9]," },
    { file:'index', expect:"is drawn as", find:"    var th = rad(360 - q[1] - q[2]), u =", replace:"    var th = rad(360 - q[1] - q[3]), u =" },
    { file:'index', expect:"touch", find:"var QUAD = { box:{ x:58, y:40, w:184, h:136 }, dot:7, arc:16, pick:24,", replace:"var QUAD = { box:{ x:58, y:40, w:184, h:136 }, dot:7, arc:16, pick:40," },
    { file:'index', expect:"picks corner", find:"      if (L.at) d = Math.min(d, ptRectDist(pt, lblBox(L.v, L.fs, L.at.x, L.at.y)));\n", replace:"" },
    { file:'index', expect:"cutRefuse(", find:"return k === 0 ? 'same' : (k === 2 ? null : 'side'); }", replace:"return k === 0 ? 'same' : (k !== 0 ? null : 'side'); }" },
    { file:'index', expect:"the halves are not the two triangles", find:"  function cutHalves(i){ i = i % 2; return [[i, i + 1, i + 2], [i + 2, (i + 3) % 4, i]]; }", replace:"  function cutHalves(i){ i = i % 2; return [[i, i + 1, i + 2], [i + 1, (i + 3) % 4, i]]; }" },
    { file:'index', expect:"sticks out of its own triangle", find:"start:centroid(T), dirs:ALL, poly:T }; }), strokes, BOARD_IN(CUT_H));", replace:"start:T[0], dirs:ALL }; }), strokes, BOARD_IN(CUT_H));" },
    { file:'index', expect:"is inside the quadrilateral", find:"      var o = bisector(V, P[(j + 1) % 4], P[(j + 3) % 4]), d = { x:-o.x, y:-o.y };", replace:"      var o = bisector(V, P[(j + 1) % 4], P[(j + 3) % 4]), d = { x:o.x, y:o.y };" },
    { file:'index', expect:"the cut is not judged from the first", find:"        var bad = cutRefuse(first, j), i = first;", replace:"        var bad = cutRefuse(0, j), i = first;" },
    { file:'index', expect:"gCutDone zh", find:"' ＋ ' + q[3] + ' ＝ 360，對得上 ✓'; },", replace:"' ＋ ' + q[2] + ' ＝ 360，對得上 ✓'; }," },
    { file:'index', expect:"gCutSide en: must say", find:"gCutSide: 'Those two corners are next to each other —", replace:"gCutSide: 'Those two corners touch —" },
    /* 第 3 關：轉一轉 */
    { file:'index', expect:"must be a tick in range and not the answer", find:"[40, 60, 55, 95, 60]", replace:"[40, 60, 55, 95, 80]" },
    { file:'index', expect:"is not a tick between", find:"[50, 70, 45, 80, 75]", replace:"[50, 70, 65, 80, 75]" },
    { file:'index', expect:"too thin to see", find:"[35, 70, 65, 110, 100]", replace:"[35, 70, 65, 125, 100]" },
    { file:'index', expect:"turnApex() is not where the two sides meet", find:"var AC = TURN.L * Math.sin(rad(b)) / Math.sin(rad(a + b));", replace:"var AC = TURN.L * Math.sin(rad(b)) / Math.sin(rad(a + b + 5));" },
    { file:'index', expect:"the ring is not on side CB", find:"return { x:B.x + TURN.rh * Math.cos(rad(b)), y:B.y + TURN.rh * Math.sin(rad(b)) }; }", replace:"return { x:B.x - TURN.rh * Math.cos(rad(b)), y:B.y - TURN.rh * Math.sin(rad(b)) }; }" },
    { file:'index', expect:"snaps to", find:"Math.round(turnDeg(pt) / TURN.step) * TURN.step)); }", replace:"Math.floor(turnDeg(pt) / TURN.step) * TURN.step)); }" },
    { file:'index', expect:"is taken as a track tap", find:" <= TURN.track && b >= e[2] - TURN.step / 2 && b <= e[3] + TURN.step / 2;", replace:" <= TURN.track;" },
    { file:'index', expect:"turnRefuse() reports", find:"return c === t ? null : { s:a + b, c:c, more:c > t }; }", replace:"return c === t ? null : { s:a + b, c:c, more:c < t }; }" },
    { file:'index', expect:"turns B the wrong way", find:"'° —— B 角要轉' + (more ? '大' : '小') + '一點。'; },", replace:"'° —— B 角要轉' + (more ? '小' : '大') + '一點。'; }," },
    { file:'index', expect:"gTurnBad en", find:"', 180 − ' + (a + b) + ' = ' + c + ': C is ' + c + '°, not '", replace:"', 180 − ' + (a + b) + ' = ' + (c + 5) + ': C is ' + c + '°, not '" },
    { file:'index', expect:"gTurn2 zh", find:"A ＋ B 就要是 180 − ' + t + ' ＝ ' + (180 - t) + '；", replace:"A ＋ B 就要是 180 − ' + t + ' ＝ ' + (180 + t) + '；" },
    { file:'index', expect:"“That’s it” judges while the ring is still held", find:"        if (gSolved || grip.busy()) return;   /* 把手正被拖著", replace:"        if (gSolved) return;   /* 把手正被拖著" },
    { file:'index', expect:"a tap on a tick under the ring", find:"      B.onTap = function(P, pt){ if (turnOnTrack(e, pt)) setB(turnSnap(e, pt)); };", replace:"      B.onTap = function(P, pt){};" },
    { file:'index', expect:"solving does not write C", find:"        draw(t + '°');\n", replace:"" },
    { file:'index', expect:"the B judged is not the one on screen", find:"        var bad = turnRefuse(a, b, t);", replace:"        var bad = turnRefuse(a, e[4], t);" },
    /* 第 4 關：分一分 */
    { file:'index', expect:"right isosceles triangle", find:"[[60, 60], [40, 70], [35, 55], [50, 50]]", replace:"[[60, 60], [40, 70], [35, 55], [45, 45]]" },
    { file:'index', expect:"no isosceles card that needs ? to be worked out", find:"[[60, 60], [30, 75], [25, 65], [70, 70]]", replace:"[[60, 60], [50, 50], [25, 65], [70, 70]]" },
    { file:'index', expect:"no right-triangle card that needs ? to be worked out", find:"[[60, 60], [80, 20], [30, 60], [90, 25]]", replace:"[[60, 60], [80, 20], [90, 30], [90, 25]]" },
    { file:'index', expect:"sortKind(", find:"    if (t[0] === t[1] || t[0] === t[2] || t[1] === t[2]) return 'iso';", replace:"    if (t[0] === t[1]) return 'iso';" },
    { file:'index', expect:"sortRefuse(", find:"return k === bin ? null : (k === 'eq' && bin === 'iso' ? 'alsoIso' : k); }", replace:"return k === bin || (k === 'eq' && bin === 'iso') ? null : k; }" },
    { file:'index', expect:"gSortBad iso", find:"(bin === 'iso' ? '，沒有兩個一樣大 —— 不是等腰三角形。' : '，沒有 90° —— 不是直角三角形。'));", replace:"(bin === 'iso' ? '，沒有 90° —— 不是直角三角形。' : '，沒有兩個一樣大 —— 不是等腰三角形。'));" },
    { file:'index', expect:"covers the label", find:"chipW:88, chipH:30, chipY:[214, 252],", replace:"chipW:88, chipH:30, chipY:[190, 252]," },
    { file:'index', expect:"never exercised", find:"chipY:[214, 252], pad:8 }, SORT_H", replace:"chipY:[214, 252], pad:1 }, SORT_H" },
    { file:'index', expect:"sortInOrder(): does not see", find:"    for (var i = 1; i < list.length; i++) if (SORT_KINDS.indexOf(sortKind(list[i - 1])) > SORT_KINDS.indexOf(sortKind(list[i]))) return false;\n    return true;", replace:"    return false;" },
    { file:'index', expect:"charged (or accepted) instead of a free note", find:"        if (why === 'alsoIso'){ roundNote(d.gSortAlso); return false; }", replace:"        if (why === 'alsoIso'){ roundMiss(d.gSortAlso); return false; }" },
    { file:'index', expect:"gSortAlso en: must say", find:"put it in the most exact box, “Equilateral”.',", replace:"put it in the “Equilateral” box.'," },
    { file:'index', expect:"the box judged is not the nearest", find:"        var bin = nearestOpen(bins, pt, SORT.pad);", replace:"        var bin = nearestOpen(bins, pt, SORT.pad * 4);" },
    /* 第 5 關：打出來 */
    { file:'index', expect:"adding to 360", find:"var GAME_INPUT = [[75, 110, 95, 80, 0.9, 3],", replace:"var GAME_INPUT = [[75, 110, 95, 90, 0.9, 3]," },
    { file:'index', expect:"must be 0~3", find:"[105, 85, 70, 100, 0.9, 1]];", replace:"[105, 85, 70, 100, 0.9, 4]];" },
    { file:'index', expect:"inParse(\"080\")", find:"String(text).match(/^\\s*(0|[1-9]\\d{0,2})\\s*$/);", replace:"String(text).match(/^\\s*(\\d{1,3})\\s*$/);" },
    { file:'index', expect:"inRefuse(", find:"return s === 360 ? null : { s:s, more:s > 360 }; }", replace:"return s === 360 ? null : { s:s, more:s >= 350 }; }" },
    { file:'index', expect:"is called too", find:"，' + v + '° 太' + (more ? '大' : '小') + '了。'; },", replace:"，' + v + '° 太' + (more ? '小' : '大') + '了。'; }," },
    { file:'index', expect:"gInDone en", find:"' − ' + k[2] + ' = ' + v + ' — ? is ' + v + '°!'; },", replace:"' − ' + k[2] + ' = ' + (v + 10) + ' — ? is ' + v + '°!'; }," },
    { file:'index', expect:"an oddly written number is charged", find:"        if (v === null){ roundNote(d.gInRemind); return; }", replace:"        if (v === null){ roundMiss(d.gInRemind); return; }" },
    { file:'index', expect:"Enter does not check", find:"      inp.addEventListener('keydown', function(ev){ if (ev.key === 'Enter') check(); });\n", replace:"" },
    /* 範例 3 與靜態字串 */
    { file:'index', expect:"EXAMPLE 3", find:"    { a: 50, b: 60, ans: 70 },", replace:"    { a: 50, b: 60, ans: 80 }," },
    { file:'index', expect:"EXAMPLE 3", find:"      var put = function(P){ return { x: P.x * k + offX, y: P.y * k + offY }; };", replace:"      var put = function(P){ return { x: P.x * k * 1.3 + offX, y: P.y * k + offY }; };" },
    { file:'index', expect:"is wrong", find:"          why: '180 − 50 − 60 = 70°（三角形的三個角加起來永遠是 180°）。' },", replace:"          why: '180 − 50 − 60 = 80°（三角形的三個角加起來永遠是 180°）。' }," },
    { file:'index', expect:"is wrong", find:"quadCap: 'Each triangle has an angle sum of 180°. Together: 180° × 2 = <strong>360°</strong>.", replace:"quadCap: 'Each triangle has an angle sum of 180°. Together: 180° × 2 = <strong>380°</strong>." },
    { file:'index', expect:"the markup fallback is not the same sentence", find:"<p class=\"lead\" data-i18n=\"s6lead\">撕角拼直線、切一刀", replace:"<p class=\"lead\" data-i18n=\"s6lead\">撕角拼直線，切一刀" },
    { file:'index', expect:"s6lead zh does not say", find:"每一關都靠同一件事：<strong>三角形的內角和是 180°，四邊形是 360°</strong>。放錯會扣 5 分，同一個錯不會扣兩次 —— 慢慢想比手快重要。',", replace:"每一關都靠同一件事：<strong>三角形的內角和是 180°</strong>。放錯會扣 5 分，同一個錯不會扣兩次 —— 慢慢想比手快重要。'," },
    { file:'index', expect:"gHints.turn zh: must say", find:"turn: '提示 1：三個角加起來是 180°：B 角轉大，C 角就變小；B 角轉小，C 角就變大。',", replace:"turn: '提示 1：三個角加起來是 180°：B 角轉大，C 角也變大。'," },
    { file:'index', expect:"gHints.tear en: must not say", find:"line — see what shape the three of them make.',", replace:"line — they make a straight line, 180°.'," },
    /* ---- review.html 的產生器 ---- */
    { file:'review', expect:"is a number printed in the stem", find:"        var wrongs = safeWrongs(ans, [rem, ans + 10, ans - 10], [a, b]);", replace:"        var wrongs = safeWrongs(ans, [rem, ans + 10, ans - 10], []);" },
    { file:'review', expect:"is a number printed in the stem", find:"        var wrongs = safeWrongs(other, [180 - a, other + 10, other - 10], [a]);", replace:"        var wrongs = safeWrongs(other, [180 - a, other + 10, other - 10], []);" },
    { file:'review', expect:"outside 1~179", find:"    var used = [ans].concat(avoid || []), out = [], hi = top || 175;", replace:"    var used = [ans].concat(avoid || []), out = [], hi = top || 999;" },
    { file:'review', expect:"triMissing: a + b + ans != 180", find:"        var b = rem - a;", replace:"        var b = rem - a + 5;" },
    { file:'review', expect:"why numbers", find:"? '直角三角形已經用掉 90°，90 − ' + d.a + ' = ' + d.other + '°（不是 180 − '", replace:"? '直角三角形已經用掉 90°，90 − ' + d.a + ' = ' + d.other + '°（不是 160 − '" },
    { file:'review', expect:"why: arithmetic is wrong", find:"+ ' = ' + d.r.reduce(function(a,b){return a+b;},0) + ' 份，每份 '", replace:"+ ' = ' + (d.r.reduce(function(a,b){return a+b;},0) + 1) + ' 份，每份 '" },
    { file:'review', expect:"exactly one combination must add to 180", find:"        var w3 = [a + 5, b + 5, c];", replace:"        var w3 = [a + 5, b - 5, c];" },
    { file:'review', expect:"symmetryAxes: 正五邊形 should have 5", find:"{ zh:'正五邊形', en:'regular pentagon', count:5, wrongs:[3,4,6] },", replace:"{ zh:'正五邊形', en:'regular pentagon', count:4, wrongs:[3,5,6] }," },
    { file:'review', expect:"why: arithmetic is wrong", find:"? '360 − ' + d.a + ' − ' + d.b + ' − ' + d.c + ' = ' + d.ans + '°（四邊形", replace:"? '360 − ' + d.a + ' − ' + d.b + ' − ' + d.c + ' = ' + (d.ans + 10) + '°（四邊形" },
    /* codex 第一輪補上的檢查 */
    { file:'index', expect:"B is judged in exactly one place", find:"        var bad = turnRefuse(a, b, t);", replace:"        var bad = turnRefuse(a, e[4], t); if (false){ bad = turnRefuse(a, b, t); }" },
    { file:'index', expect:"switched-off branch", find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板", replace:"      if (gen !== gGen && false) return;   /* 這一塊屬於已經拿掉的畫板" },
    { file:'index', expect:"is not the drawn box", find:"return { k:k, i:i, n:0, cx:SORT.binX[i] + SORT.binW / 2,", replace:"return { k:k, i:i, n:0, cx:SORT.binX[i] + SORT.binW / 2 + 6," },
    { file:'index', expect:"gInBad zh", find:"' ＋ ' + v + ' ＝ ' + s + '，不是 360 —— ", replace:"' ＋ ' + v + ' ＝ ' + (v > 400 ? s + 1 : s) + '，不是 360 —— " },
    { file:'index', expect:"gSortBad reason right en", find:"' — none of them is 90°, so it is not a right triangle.'", replace:"' — one of them is 90°, so it is not a right triangle.'" },
    { file:'index', expect:"is not halfway", find:"Math.round(turnDeg(pt) / TURN.step) * TURN.step)); }", replace:"Math.round((turnDeg(pt) + 0.04) / TURN.step) * TURN.step)); }" },
    { file:'index', expect:"gTearOk zh", find:"['△ABC', '△DEF'][t] + '：' + k + ' / 3）'; },", replace:"['△ABC', '△DEF'][t] + '：' + (n === 'C' ? 2 : k) + ' / 3）'; }," },
    { file:'index', expect:"the readout does not follow the drawing", find:"        line.textContent = d.gTurnNow(a, b, cText);", replace:"        line.textContent = d.gTurnNow(a, b);" },
    { file:'review', expect:"why numbers", find:"' parts, ' + (180 / d.r.reduce(function(a,b){return a+b;},0)) + '° each; the largest angle is ' + Math.max.apply(null, d.r)", replace:"' parts, ' + (180 / d.r.reduce(function(a,b){return a+b;},0)) + '° each; the largest angle is ' + Math.min.apply(null, d.r)" },
    { file:'review', expect:"why numbers", find:"? '三角形三個角一定要加起來是 180°：' + correct[0] + ' + ' + correct[1] + ' + ' + correct[2]", replace:"? '三角形三個角一定要加起來是 180°：' + correct[1] + ' + ' + correct[0] + ' + ' + correct[2]" },
    /* codex 第二輪 */
    { file:'index', expect:"switched-off branch", find:"        var bad = turnRefuse(a, b, t);", replace:"        var bad = false ? turnRefuse(a, b, t) : turnRefuse(a, e[4], t);" },
    { file:'index', expect:"switched-off branch", find:"        if (bad === 'same'){ line.textContent = d.gCutNow0; refreshHint(); return; }", replace:"        if (true){ if (bad === 'same'){ line.textContent = d.gCutNow0; refreshHint(); return; } } else { bad = null; }" },
    /* codex 第四輪 */
    { file:'index', expect:"cannot scan", find:"        var v = inParse(inp.value);", replace:"        var v = /^x/.test(inp.value) ? null : inParse(inp.value);" },
    /* verifier 2026-10-11 */
    { file:'index', expect:"does not reach the drawn ends of a tick", find:"rh:56, step:5, track:20,", replace:"rh:56, step:5, track:3," },
    { file:'index', expect:"a release elsewhere on the page", find:"    function onDocEnd(e){ end(e, true); }", replace:"    function onDocEnd(e){}" },
  ],

  sim: {
    INVARIANTS: {
      triMissing: d => {
        if (!(d.a > 0 && d.b > 0 && d.ans > 0) || d.a + d.b + d.ans !== 180) return 'triMissing: a + b + ans != 180 (or not positive)';
        if (d.a % 5 || d.b % 5) return 'triMissing: a, b should be multiples of 5';
      },
      quadMissing: d => {
        if (d.a + d.b + d.c + d.ans !== 360) return 'quadMissing: a + b + c + ans != 360';
        if ([d.a, d.b, d.c, d.ans].some(v => !(v > 0 && v < 180))) return 'quadMissing: an angle outside 0~180 (not a convex quadrilateral): ' + [d.a, d.b, d.c, d.ans];
      },
      isoTop2Base: d => { if (2 * d.base + d.apex !== 180 || !isInt(d.base) || d.base <= 0) return 'isoTop2Base: 2 × base + apex != 180 (or base not whole)'; },
      isoBase2Top: d => { if (2 * d.base + d.top !== 180 || d.top <= 0) return 'isoBase2Top: 2 × base + top != 180 (or top not positive)'; },
      rightTriComplement: d => { if (d.a + d.other !== 90 || d.other <= 0 || d.a <= 0) return 'rightTriComplement: a + other != 90'; },
      ratioTriangle: d => {
        const s = d.r.reduce((x, y) => x + y, 0);
        if (d.angles.reduce((x, y) => x + y, 0) !== 180 || d.angles.some((x, i) => x !== d.r[i] * 180 / s || !isInt(x))) return 'ratioTriangle: the angles are not r × (180 ÷ sum)';
        if (d.largest !== Math.max(...d.angles)) return 'ratioTriangle: largest is not the largest angle';
      },
      canFormTriangle: d => {
        const ok = d.combos.filter(t => t[0] + t[1] + t[2] === 180 && t.every(v => v > 0));
        if (ok.length !== 1 || d.combos[d.ans] !== ok[0]) return 'canFormTriangle: exactly one combination must add to 180 and it must be the answer — ' + JSON.stringify(d.combos);
        if (d.combos.some(t => t.some(v => !(v > 0)))) return 'canFormTriangle: a combination has a non-positive angle';
      },
      symmetryAxes: d => {
        const AX = { '正方形':4, '正三角形':3, '長方形（非正方形）':2, '等腰三角形（非正三角形）':1, '正五邊形':5, '正六邊形':6, '一般四邊形（不規則）':0 };
        if (!(d.zh in AX) || AX[d.zh] !== d.count) return 'symmetryAxes: ' + d.zh + ' should have ' + AX[d.zh] + ' lines, data says ' + d.count;
      }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'triMissing': return (180 - d.a - d.b) + '°';
        case 'quadMissing': return (360 - d.a - d.b - d.c) + '°';
        case 'isoTop2Base': return (180 - d.apex) / 2 + '°';
        case 'isoBase2Top': return (180 - 2 * d.base) + '°';
        case 'rightTriComplement': return (90 - d.a) + '°';
        case 'ratioTriangle': { const s = d.r.reduce((x, y) => x + y, 0); return Math.max(...d.r) * 180 / s + '°'; }
        case 'canFormTriangle': { const t = d.combos.filter(c => c[0] + c[1] + c[2] === 180)[0] || [0, 0, 0]; return lang === 'zh' ? t[0] + '°、' + t[1] + '°、' + t[2] + '°' : t[0] + '°, ' + t[1] + '°, ' + t[2] + '°'; }
        case 'symmetryAxes': { const AX = { '正方形':4, '正三角形':3, '長方形（非正方形）':2, '等腰三角形（非正三角形）':1, '正五邊形':5, '正六邊形':6, '一般四邊形（不規則）':0 }; return AX[d.zh] + (lang === 'zh' ? ' 條' : ''); }
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'canFormTriangle'){
        const m = lang === 'zh' ? s.match(/^(\d+)°、(\d+)°、(\d+)°$/) : s.match(/^(\d+)°, (\d+)°, (\d+)°$/);
        if (!m) return 'option "' + s + '" is not three angles';
        if ([m[1], m[2], m[3]].map(Number).some(v => v < 5 || v > 170)) return 'option "' + s + '" has an angle outside 5~170';
        return;
      }
      if (genId === 'symmetryAxes'){ if (!(lang === 'zh' ? /^\d 條$/ : /^\d$/).test(s)) return 'option "' + s + '" is not a count of lines'; return; }
      const m = s.match(/^(\d+)°$/);
      if (!m) return 'option "' + s + '" is not a whole number of degrees';
      const n = +m[1];
      /* 範圍：都是三角形或（凸）四邊形的一個角 —— 0° 和 180° 都不是 */
      if (n < 1 || n > 179) return 'option ' + n + '° outside 1~179';
    },
    /* 渲染出來的那一題：選項的「值」不可以是題幹印出來的數字（simgen 的通用檢查比字串，「70°」比不到「70」）；
       解釋裡的算式逐條驗算；解釋的數字就是那一題的數字 */
    renderCheck: function(d, q, lang, genId){
      if (genId !== 'canFormTriangle' && genId !== 'symmetryAxes'){
        const stem = nums(q.stem), allow = ECHO_OK[genId];
        for (let i = 0; i < q.opts.length; i++){
          if (i === q.ans) continue;
          const v = nums(q.opts[i])[0];
          if (stem.indexOf(v) >= 0 && !(allow && allow(d, v))) return 'distractor ' + q.opts[i] + ' is a number printed in the stem (' + stem.join(', ') + ')';
        }
        /* 正解等於題幹的一個角是正常的（等腰三角形：30°、120°、? → 30°），不擋 */
      }
      const r = arithGame(q.why);
      if (r.problems.length) return 'why: ' + r.problems.join('; ');
      if (genId !== 'symmetryAxes' && r.verified < 1) return 'why: no equation was verified in "' + q.why.slice(0, 80) + '"';
      const want = {
        triMissing: [180, d.a, d.b, d.ans, 180],
        quadMissing: [360, d.a, d.b, d.c, d.ans, 360, 180, 2, 360],
        isoTop2Base: [180, d.apex, 180 - d.apex, 180 - d.apex, 2, d.base, 2],
        isoBase2Top: [d.base, d.base, 2 * d.base, 180, 2 * d.base, d.top],
        rightTriComplement: [90, 90, d.a, d.other, 180, d.a],
        ratioTriangle: genId === 'ratioTriangle' ? (() => { const s = d.r.reduce((x, y) => x + y, 0); return [180].concat(d.r, [s, 180 / s, Math.max(...d.r), Math.max(...d.r) * 180 / s]); })() : null,
        canFormTriangle: genId === 'canFormTriangle' ? (() => { const t = d.combos.filter(c => c[0] + c[1] + c[2] === 180)[0] || []; return [180].concat(t, [180, 180]); })() : null
      }[genId];
      if (want && nums(q.why).join() !== want.join()) return 'why numbers ' + nums(q.why).join() + ', expected ' + want.join();
    }
  },

  data: {
    dataStart: '  /* ============ 小遊戲「神祕角獵人」',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{GAME_ORDER, GW, GPICK, shuffle, unsorted, angleAt, fitPts, triPts, quadPts, wedgePath, arcPath, bisector, LBL_CLEAR, LBL_FS, lblBox, lblBaseline, lblAttrs, placeLabels, BOARD_IN, TEAR, TEAR_H, GAME_TEAR, TEAR_NAMES, tearTri, tearCorner, tearZones, tearRefuse, tearSlot, tearScene, tearPiece, tearInOrder, tearTray, QUAD, CUT_H, GAME_CUT, quadScene, quadTexts, cutPick, cutRefuse, cutHalves, cutScene, TURN, TURN_H, GAME_TURN, turnA, turnB, turnApex, turnHandle, turnDeg, turnSnap, turnOnTrack, turnRefuse, turnTrack, turnScene, SORT, SORT_H, SORT_KINDS, GAME_SORT, sortThird, sortKind, sortRefuse, sortInOrder, sortTray, sortBins, sortCardText, sortChipText, IN_H, GAME_INPUT, inParse, inKnown, inRefuse}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], EPS = 1e-9, W = 300;
      const say = (where, L, text, want, opts) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        const r = arithGame(claimOf(s));
        r.problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (opts && opts.verify && r.verified < opts.verify) fail(where + ' ' + L + ': only ' + r.verified + ' equation(s) verified, expected ' + opts.verify + ' — "' + s + '"');
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        return r.verified;
      };
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };

      /* --- 0. 等號掃描器自己先證明會響（正反例） --- */
      [['50 + 60 + 70 = 180', 1, 0], ['50 + 60 + 70 = 190', 1, 1], ['180° × 2 = 360°', 1, 0], ['180° × 2 = 380°', 1, 1],
       ['180 − 40 − 70 = 70°', 1, 0], ['(180−40) ÷ 2 = 70°', 1, 0], ['(180−40) ÷ 2 = 75°', 1, 1], ['90° + 90° = 180°，180 − 90 = 90°', 2, 0],
       ['底角 ＝ (180 − 頂角) ÷ 2', 0, 0], ['把 180° 分成 1+2+3=6 份，每份 30°', 1, 0], ['1+2+3=7', 1, 1]]
        .forEach(([t, n, bad]) => {
          const r = chainClaims(t);
          if (r.claims.length !== n || r.claims.filter(c => c.bad).length !== bad) fail('chainClaims() self-test: "' + t + '" should give ' + n + ' claims, ' + bad + ' wrong — got ' + JSON.stringify(r.claims));
        });

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的等號逐個重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        chainClaims(s).claims.forEach(c => { checkedEq++; if (c.bad) fail(where + ': "' + c.text + '" is wrong (' + c.bad + ')'); });
      }));
      if (checkedEq < 30) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');

      /* --- 1b. 範例 3：triShape() 畫出來的三角形，三個角量起來就是它標的三個數 --- */
      {
        const ts = extractFunction(src, 'triShape'), mm = src.match(/var MYSTERIES = \[([\s\S]*?)\];/);
        if (!ts || !mm) fail('EXAMPLE 3: cannot find triShape() or MYSTERIES');
        else {
          const triShape = new Function(ts + '\nreturn triShape;')();
          const list = [...mm[1].matchAll(/\{\s*a:\s*(\d+),\s*b:\s*(\d+),\s*ans:\s*(\d+)\s*\}/g)].map(m => m.slice(1).map(Number));
          if (list.length !== 3) fail('EXAMPLE 3: expected 3 mysteries, read ' + list.length);
          list.forEach(([a, b, c]) => {
            if (a + b + c !== 180) fail('EXAMPLE 3: ' + a + ' + ' + b + ' + ' + c + ' != 180');
            const svg = triShape(a + '°', b + '°', c + '°', 'x', a, b), p = svg.match(/<polygon points="([^"]+)"/)[1].split(/[\s,]+/).map(Number);
            const P = [{ x:p[0], y:p[1] }, { x:p[2], y:p[3] }, { x:p[4], y:p[5] }];
            const m = [angAt(P[1], P[0], P[2]), angAt(P[0], P[1], P[2]), angAt(P[0], P[2], P[1])];
            if (Math.abs(m[0] - a) > 0.6 || Math.abs(m[1] - b) > 0.6 || Math.abs(m[2] - c) > 0.6) fail('EXAMPLE 3: the ' + [a, b, c] + ' triangle is drawn as ' + m.map(x => x.toFixed(1)));
          });
        }
      }

      /* --- 1c. 遊戲的開場白：說的那件事五關都成立；頁面上的備用字和中文字典是同一句 --- */
      {
        const LEAD = { zh:'<strong>三角形的內角和是 180°，四邊形是 360°</strong>', en:'<strong>a triangle’s angles add up to 180°, a quadrilateral’s to 360°</strong>' };
        LANGS.forEach(L => {
          const t = I18N[L].s6lead || '';
          if (t.indexOf(LEAD[L]) < 0) fail('GAME s6lead ' + L + ' does not say "' + LEAD[L] + '"');
          hasNot('s6lead', L, t, { zh:['點卡片', '第一次就答對'], en:['Tap a card', 'first-try'] });
        });
        const m = src.match(/<p class="lead" data-i18n="s6lead">([\s\S]*?)<\/p>/);
        if (!m || m[1] !== I18N.zh.s6lead) fail('GAME s6lead: the markup fallback is not the same sentence as the zh dictionary');
      }

      /* ================= 2. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：神祕角獵人');
      const ge = src.indexOf('  /* ---------- 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const fin = v => typeof v === 'number' && isFinite(v);
      const insideBoard = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= -EPS && o.y >= -EPS && o.x + o.w <= W + EPS && o.y + o.h <= H + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
      const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPS;
      const rect = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); return; } };
      if (D.GW !== W) fail('GAME: the board width GW should be ' + W);
      tooSmall('GPICK (smallest thing you can pick up)', D.GPICK);

      /* --- 五關的順序、RENDER、題目與提示 --- */
      const TYPES = ['tear', 'cut', 'turn', 'sort', 'input'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, then 2 and 3 together), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        tear: { has:{ zh:['同一個三角形', '直線'], en:['one triangle', 'line'] }, not:{ zh:['180'], en:['180'] } },
        cut: { has:{ zh:['不相鄰', '對角線', '兩個三角形'], en:['NOT next to each other', 'diagonal', 'two triangles'] }, not:{} },
        turn: { has:{ zh:['180°', 'B 角轉大，C 角就變小'], en:['180°', 'Turn angle B bigger and angle C gets smaller'] }, not:{} },
        sort: { has:{ zh:['? ＝ 180 − 兩個角', '60°', '90°', '兩個一樣大'], en:['? = 180 − the two angles', '60°', '90°', 'two equal angles'] }, not:{} },
        input: { has:{ zh:['兩個三角形', '360°'], en:['two triangles', '360°'] }, not:{} }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
          if (t === 'turn'){ if (typeof a !== 'function') fail('GAME: gAsks.turn must be a function of the target angle (' + L + ')'); else say('gAsks.turn', L, a(65), [5, 5, 65]); }
          else if (typeof a !== 'string' || !a) fail('GAME: gAsks.' + t + ' missing in ' + L); else say('gAsks.' + t, L, a, []);
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h); has('gHints.' + t, L, h, HINT_SEM[t].has); hasNot('gHints.' + t, L, h, HINT_SEM[t].not); }
        });
      });
      const need = (k, re, what) => { if (!re.test(k ? (RB[k] || '') : gsrc)) fail('GAME ' + (k || 'engine') + ': ' + what); };
      /* 數「可以執行的」那一次：註解先拿掉（codex 第二輪：註解裡的同一段字會被數進去） */
      /* 註解拿掉（字串裡的 // 和 /* 不算註解 —— 一個字一個字走，codex 第三輪）；blank：字串內容也換成空字串（給 deadScan 用） */
      const stripComments = (code, blank) => { let o = '', i = 0; while (i < code.length){ const c = code[i], d = code[i + 1];
          if (c === '/' && d === '/'){ while (i < code.length && code[i] !== '\n') i++; continue; }
          if (c === '/' && d === '*'){ const j = code.indexOf('*/', i + 2); i = j < 0 ? code.length : j + 2; continue; }
          if (c === '"' || c === "'" || c === '`'){ let j = i + 1; while (j < code.length && code[j] !== c){ if (code[j] === '\\') j++; j++; } o += blank ? c + c : code.slice(i, j + 1); i = j + 1; continue; }
          o += c; i++; } return o; };
      [['a("http://x"); f(1);', 'a("http://x"); f(1);'], ["s = '/* x */'; g();", "s = '/* x */'; g();"], ['a(); // f(2)\nb();', 'a(); \nb();'], ['a(); /* f(3) */ b();', 'a();  b();']].forEach(([c, w]) => { if (stripComments(c) !== w) fail('stripComments() self-test: "' + c + '" became "' + stripComments(c) + '"'); });
      /* stripComments() is not a full JS lexer: a template literal (${…} is code) or a regex literal (a quote or // inside it) would be
         misread — so code containing either is refused, not scanned (fail closed; codex 第四輪). The game code has neither. */
      const unscannable = code => /`/.test(code) || /(^|[(,=:\[!&|?{};]|\breturn)\s*\/(?![\/*])/.test(code);
      [['a = b / c;', false], ['x(); // note', false], ['/* c */ y();', false], ['var r = /["]/;', true], ['if (/[//]/.test(s)) f();', true], ['return /x/;', true], ['var t = `${a}`;', true]].forEach(([c, w]) => { if (unscannable(c) !== w) fail('unscannable() self-test: "' + c + '" should ' + (w ? '' : 'not ') + 'be refused'); });
      const needOnce = (k, str, what) => { const raw = k ? (RB[k] || '') : gsrc; if (unscannable(raw)){ fail('GAME ' + (k || 'engine') + ': ' + what + ' — the code has a template or regex literal, cannot count it'); return; } const s = stripComments(raw), n = s.split(str).length - 1; if (n !== 1) fail('GAME ' + (k || 'engine') + ': ' + what + ' (found ' + n + ' times)'); };
      /* 原始碼形狀的守門擋不住「正確的那一行留在死碼裡、活的那一行改掉」（codex 第一輪）：
         ① 判斷的那幾行每一關只能出現一次（見各關的 needOnce）；② RENDER 與引擎裡不可以有關掉的分支（字串先遮掉再掃）；
         ③ 行為本身由 e2e 驗 —— broken-Bdead.html 就是「死碼留著正確的一行、活的改壞」：設定檔（needOnce／deadScan）與 e2e 都抓到。原始碼掃描本身證明不了那一行被執行。 */
      const DEAD_RE = /if\((false|0|null|undefined|!1|!true|\d+===\d+[^)]*|""|'')\)|if\((true|1|!0|!false)\)|&&(false|0|!1)\b|\b(true|1|!0)\|\||(?<![=!<>])(?:[(=,:?]|⟨R⟩|=>)(true|false|0|1|!0|!1)\?|while\(false\)/;
      const deadScan = code => { if (unscannable(code)) return 'a template or regex literal (cannot scan)'; const t = stripComments(code, true).replace(/\breturn\b/g, '⟨R⟩').replace(/\s+/g, ''), m = t.match(DEAD_RE); return m ? m[0] : null; };
      [['if (false) return;', true], ['if(0){ x(); }', true], ['a && false', true], ['true || b', true], ['if (true) { a(); } else { b(); }', true], ['if (!0) x();', true], ['var v = false ? good() : bad();', true], ['var v = ok ? a : b;', false], ['c = k === 0 ? x : y;', false], ['return false ? good() : bad();', true], ['var f = () => false ? a() : b();', true], ['x(); // if (true) y();', false], ['x(); // false ? a : b', false], ['myreturnfalse ? a() : b();', false], ['var r = /["]/; if (false) x();', true], ["s = 'if (false)';", false], ['if (gSolved) return;', false], ['return;\n  }', false], ['x || y', false]].forEach(([c, want]) => { if (!!deadScan(c) !== want) fail('deadScan() self-test: "' + c + '" should ' + (want ? '' : 'not ') + 'be flagged'); });
      TYPES.forEach(t => { const h = deadScan(RB[t] || ''); if (h) fail('GAME ' + t + ': RENDER.' + t + ' contains a switched-off branch (' + h + ') — a guarded line could live in dead code'); });
      ['addPiece', 'makeBoard', 'useTapSelect', 'nearestOpen', 'roundSolved', 'roundMiss', 'startRound'].forEach(f => { const h = deadScan(extractFunction(gsrc, f) || ''); if (h) fail('GAME engine: ' + f + '() contains a switched-off branch (' + h + ')'); });

      /* --- 拖拉引擎與計分的保護（原始碼形狀） --- */
      need(null, /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode no longer shows hint level 1 automatically');
      need(null, /if \(hintLevel >= 2\) gHintBtn\.disabled = true;/, 'the hint button is not disabled after the second level');
      need(null, /gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+; BOARD_TAP = null; PIECE_PTR = \{\};/, 'startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
      need(null, /if \(gen !== gGen\) return;   \/\* 這一塊屬於已經拿掉的畫板/, 'a released piece does not check its board generation — a piece held across a restart could act on the new round');
      need(null, /if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
      need(null, /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'losing pointer capture no longer puts the piece back');
      need(null, /function onDocEnd\(e\)\{ end\(e, true\); \}/, 'a release elsewhere on the page (document listener) no longer puts the piece back');
      need(null, /if \(!e\.isPrimary\) return;   \/\* 第二根手指/, 'a second finger can start a board tap');
      need(null, /if \(o\.snap\)\{ var q = o\.snap\(\{ x:orig\.x \+ dx, y:orig\.y \+ dy \}\); P\.place\(q\.x, q\.y\); \}/, 'the ring of round 3 does not snap to a tick while it is dragged');
      need(null, /if \(!moved\)\{ if \(B\.onTap\) B\.onTap\(P, B\.toBoard\(e\)\); return; \}/, 'a tap on a piece does not pass where it was tapped (round 3: tapping a tick under the ring)');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      { const g = extractFunction(gsrc, 'gSvg'); if (!g || /viewBox/.test(g.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME: the board SVG gets a viewBox — a page-wide label fitter could rescale it and the drawing would no longer match the hit zones'); }
      ['tear', 'sort'].forEach(t => need(t, /useTapSelect\(B, function\((P|Q), pt\)\{/, 'the round has no tap-then-tap alternative'));
      {
        const rs = extractFunction(gsrc, 'roundSolved');
        if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint');
      }
      need(null, /var pts = gMistake \? 10 : 20;/, 'scoring: a round should give +20 with no mistakes and +10 after mistakes');
      {
        const fsrc = extractFunction(gsrc, 'roundMiss');
        if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
        else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
          let r;
          try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ return fail('GAME scoring: roundMiss() could not run: ' + e.message); }
          if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
          if (typeof r.html !== 'string') return fail('GAME scoring: roundMiss() does not show the reason (no message written)');
          if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
          if (r.html.indexOf('why') < 0 || !r.m) fail('GAME scoring: roundMiss() does not show the reason or record the mistake');
        });
      }
      ['roundInfo', 'roundNote'].forEach(fn => { const ri = extractFunction(gsrc, fn); if (!ri || /gMistake|gScore/.test(ri)) fail('GAME: ' + fn + '() (a message that is not a mistake) changes the score or records a mistake (or is missing)'); });
      {
        const rn = extractFunction(gsrc, 'roundNote');
        if (rn){ let h = null; try { h = new Function('var gMsg = {};\n' + rn + '\nroundNote("x"); return gMsg.innerHTML;')(); } catch (e){} if (typeof h !== 'string' || /class="no"/.test(h) || h.indexOf('x') < 0) fail('GAME: roundNote() should show the reminder without the mistake style'); }
        const ra = extractFunction(gsrc, 'roundAgain');
        if (!ra) fail('GAME: cannot find roundAgain() (repeat an explained mistake without charging it)');
        else {
          let r;
          try { r = new Function('var gMistake = false, gScore = 20, elScore = { textContent:"20" }, gMsg = {};\n' + ra + '\nroundAgain("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
          catch (e){ r = null; fail('GAME: roundAgain() could not run: ' + e.message); }
          if (r && (r.s !== 20 || r.shown !== '20' || r.m || typeof r.html !== 'string' || r.html.indexOf('why') < 0 || !/class="no"/.test(r.html))) fail('GAME: roundAgain() charges again (score ' + r.s + ', mistake ' + r.m + ') or does not show the reason');
        }
      }
      /* 「同一個錯不重複扣分」真的跑一次：把每一關從 badSeen 判斷到 roundMiss 那一段切出來，換上假的 roundMiss／roundAgain，
         照 A、B、A、A、B 的順序判：只能扣兩次（A、B 各一次），A 第二次（前面是 B）要再說一次，連著的同一個什麼都不做 */
      const repeatRun = (round, k) => {
        const bd = RB[round] || '';
        const i = bd.indexOf('if (badSeen[' + k + '])'), j0 = bd.indexOf('badSeen[' + k + '] = true;', i), j1 = j0 < 0 ? -1 : bd.indexOf('\n', j0), j = j1 < 0 ? -1 : bd.indexOf('\n', j1 + 1);
        if (i < 0 || j < 0 || bd.slice(j1, j).indexOf('roundMiss(') < 0){ fail('GAME ' + round + ': cannot cut the repeat-mistake branch out of RENDER.' + round + ' (wrong A, B, A, A, B should be charged twice)'); return; }
        const snip = bd.slice(i, j);
        let log;
        try {
          log = new Function('var log = [], badSeen = {}, lastBad = null, bad = { c:1, more:true, s:1 }, a = 1, t = 1, name = "N", c = [1, 2], q = [1, 2, 3, 4], bin = { k:"eq" };' +
            'var d = new Proxy({}, { get: function(){ return function(){ return "why"; }; } });' +
            'function roundMiss(x){ log.push("miss"); } function roundAgain(x){ log.push("again"); } function sortThird(){ return 1; } function inKnown(){ return [1, 2, 3]; }' +
            'function judge(' + k + '){ ' + snip + ' }' +
            '["A", "B", "A", "A", "B"].forEach(function(v){ log.push("@" + v); judge(v); }); return log.join(" ");')();
        } catch (e){ fail('GAME ' + round + ': the repeat-mistake branch could not run (wrong A, B, A, A, B should be charged twice): ' + e.message); return; }
        if (log !== '@A miss @B miss @A again @A @B again') fail('GAME ' + round + ': wrong A, B, A, A, B should be charged twice (and repeat A, then B) — got "' + log + '"');
      };
      repeatRun('tear', 'key'); repeatRun('cut', 'key'); repeatRun('turn', 'b'); repeatRun('sort', 'key'); repeatRun('input', 'v');
      LANGS.forEach(L => {
        const d = I18N[L];
        if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
        if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
        say('gWin', L, d.gWin(85), L === 'zh' ? [85] : [5, 85]);
        say('gClear', L, d.gClear, []);
      });

      /* 托盤「已經是答案的排法」自己判斷（不用頁面的 tearInOrder／sortInOrder —— 那兩個寫壞了，用它們來驗就驗不出來）：
         撕角：前三塊是同一個三角形的；分一分：照箱子由左到右（正三角形、等腰、直角）排好了 */
      const myTearInOrder = l => l[0].t === l[1].t && l[1].t === l[2].t;
      const myKind = c => { const t = [c[0], c[1], 180 - c[0] - c[1]]; if (t.every(x => x === 60)) return 0; if (t.indexOf(90) >= 0) return 2; return 1; };
      const mySortInOrder = l => l.every((c, i) => i === 0 || myKind(l[i - 1]) <= myKind(c));
      [0, 1].forEach(t => { const l = [0, 1, 2].map(j => ({ t, j })).concat([0, 1, 2].map(j => ({ t:1 - t, j }))); if (!D.tearInOrder(l)) fail('GAME tearInOrder(): does not see ' + (t ? '△DEF' : '△ABC') + '’s three corners in a row as the answer order'); });
      D.GAME_SORT.forEach((g, n) => { const l = g.slice().sort((x, y) => myKind(x) - myKind(y)); if (!D.sortInOrder(l)) fail('GAME sortInOrder(): does not see group ' + n + ' sorted by box as the answer order'); });
      /* --- shuffle()、unsorted()、nearestOpen()：切出來真的跑 --- */
      let nearestOpen = null;
      {
        const fsrc = extractFunction(src, 'shuffle');
        let shuffleFn = null;
        if (!fsrc) fail('GAME: cannot find shuffle() in index.html');
        else { try { shuffleFn = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('GAME: shuffle() could not be evaluated: ' + e.message); } }
        if (shuffleFn){
          const seen = new Set();
          for (let i = 0; i < 400; i++){
            const a = [1, 2, 3, 4], r = shuffleFn(a);
            if (r.slice().sort().join() !== '1,2,3,4' || a.join() !== '1,2,3,4'){ fail('GAME shuffle(): not a permutation of its input (or it changed the input)'); break; }
            seen.add(r.join());
          }
          if (seen.size < 20) fail('GAME shuffle(): only ' + seen.size + ' of 24 orders seen in 400 shuffles');
        }
        /* unsorted(): whatever order shuffle() hands it, the result is never in answer order (every permutation of every pool) */
        const us = extractFunction(src, 'unsorted');
        if (!us) fail('GAME: cannot find unsorted() in index.html');
        else {
          const perms = a => a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map(p => [x].concat(p)));
          const run = (list, inOrder, what) => {
            let bad = 0;
            perms(list).forEach(p => { const fn = new Function('function shuffle(){ return ' + JSON.stringify(p) + '; }\n' + us + '\nreturn unsorted;')(); const r = fn(list, inOrder); if (inOrder(r) || r.slice().map(JSON.stringify).sort().join() !== list.slice().map(JSON.stringify).sort().join()) bad++; });
            if (bad) fail('GAME unsorted(): ' + bad + ' tray orders of ' + what + ' still start in the answer order (or lose a card)');
          };
          const tl = []; [0, 1].forEach(t => [0, 1, 2].forEach(j => tl.push({ t, j })));
          run(tl, myTearInOrder, 'tear');
          D.GAME_SORT.forEach((g, n) => run(g, mySortInOrder, 'sort group ' + n));
        }
        const nsrc = extractFunction(gsrc, 'nearestOpen');
        if (!nsrc) fail('GAME: cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(nsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const big = { cx:100, cy:100, hw:60, hh:40 }, small = { cx:175, cy:100, hw:12, hh:12 };
          if (nearestOpen([small, big], { x:158, y:100 }, 10) !== big) fail('GAME nearestOpen(): a point inside the big box near the small one is not given to the big box (measures to the centre?)');
          const a1 = { cx:50, cy:50, hw:20, hh:20, done:true }, a2 = { cx:96, cy:50, hw:20, hh:20 };
          if (nearestOpen([a1, a2], { x:72, y:50 }, 8) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot slides into the neighbour');
          if (nearestOpen([a1, a2], { x:200, y:200 }, 8) !== null) fail('GAME nearestOpen(): a drop far away is caught');
        }
      }
      /* 圖上的字：離每一條線 ≥ 2px（線寬的一半另外算），而且離自己的頂點比離別的頂點近 */
      let nLbl = 0;
      const clearOf = (where, L, strokes) => {
        if (!L.at){ fail(where + ': label ' + L.v + ' has nowhere to go'); return; }
        nLbl++;
        const r = box(L);
        strokes.forEach(st => { const d = rsd(r, st.a, st.b) - st.w / 2; if (d < 2) fail(where + ': label "' + L.v + '" is ' + d.toFixed(1) + 'px from a stroke — labels must keep ≥ 2px'); });
        return r;
      };
      const nearestIs = (where, L, V, others) => { if (!L.at) return; const d = dist(L.at, V); if (others.some(o => dist(L.at, o) < d)) fail(where + ': label "' + L.v + '" is nearer another corner than its own'); };
      if (!(D.LBL_CLEAR >= 3)) fail('GAME labels: LBL_CLEAR ' + D.LBL_CLEAR + ' leaves less than 2px (plus rounding) between a label and a stroke');

      /* ================= 第 1 關：撕角拼直線 ================= */
      {
        const T = D.TEAR, R = T.R;
        if (!(D.GAME_TEAR.length >= 5)) fail('GAME tear: only ' + D.GAME_TEAR.length + ' pairs of triangles');
        if (D.TEAR_NAMES.join() !== 'A,B,C,D,E,F') fail('GAME tear: corners should be named A, B, C and D, E, F');
        D.GAME_TEAR.forEach((e, n) => {
          const where = 'GAME tear [' + JSON.stringify(e) + ']';
          e.forEach(a => { if (a.length !== 3 || a[0] + a[1] + a[2] !== 180 || a.some(x => !isInt(x) || x < 25 || x > 120)) fail(where + ': each triangle needs three whole angles of 25~120 adding to 180'); });
          if (e[0].slice().sort().join() === e[1].slice().sort().join()) fail(where + ': the two triangles have the same angles (same shape) — the round shows that DIFFERENT triangles both make 180');
          const tris = [0, 1].map(i => D.tearTri(i, e[i]));
          tris.forEach((P, i) => {
            const bx = T.box[i];
            P.forEach(p => { if (p.x < bx.x - EPS || p.x > bx.x + bx.w + EPS || p.y < bx.y - EPS || p.y > bx.y + bx.h + EPS) fail(where + ': triangle ' + i + ' leaves its box'); });
            for (let j = 0; j < 3; j++){
              const V = P[j], U = P[(j + 1) % 3], Wp = P[(j + 2) % 3], m = angAt(U, V, Wp);
              if (Math.abs(m - e[i][j]) > 0.01) fail(where + ': corner ' + D.TEAR_NAMES[i][j] + ' is drawn as ' + m.toFixed(2) + '°, not ' + e[i][j] + '°');
              if (dist(V, U) < 2 * R + 6) fail(where + ': side ' + D.TEAR_NAMES[i][j] + D.TEAR_NAMES[i][(j + 1) % 3] + ' is ' + dist(V, U).toFixed(1) + 'px — the two torn corners (radius ' + R + ') would overlap');
              const c = D.tearCorner(P, j);
              if (c.V !== V) fail(where + ': tearCorner() is not the corner at its own vertex');
              const w = readPath(D.wedgePath(c.V, c.U, c.W, R));
              if (!w.wedge || !w.closed || w.large !== 0 || Math.abs(dist(w.V, V)) > 0.08 || Math.abs(dist(w.p, V) - R) > 0.1 || Math.abs(dist(w.q, V) - R) > 0.1 || Math.abs(angAt(w.p, w.V, w.q) - e[i][j]) > 0.6) fail(where + ': the torn corner wedge at ' + D.TEAR_NAMES[i][j] + ' is not that corner (' + angAt(w.p, w.V, w.q).toFixed(1) + '°)');
              /* the wedge sweeps INTO the triangle: its middle point is inside */
              const mid = { x:V.x + R * 0.6 * D.bisector(V, U, Wp).x, y:V.y + R * 0.6 * D.bisector(V, U, Wp).y };
              if (!inside(mid, P)) fail(where + ': the bisector of ' + D.TEAR_NAMES[i][j] + ' does not point into the triangle');
              /* the tile in the tray: the same angle, the letter inside the tile and clear of the wedge */
              const tp = D.tearPiece(P, j);
              const pw = readPath(D.wedgePath(tp.V, tp.U, tp.W, R));
              if (Math.abs(angAt(pw.p, pw.V, pw.q) - e[i][j]) > 0.6 || dist(tp.V, { x:T.pw / 2, y:T.pw / 2 }) > EPS) fail(where + ': the tile of ' + D.TEAR_NAMES[i][j] + ' is not the same corner (or not centred on its vertex)');
              const tilesStrokes = [{ a:tp.V, b:pw.p, w:2 }, { a:tp.V, b:pw.q, w:2 }].concat(arcSegs(tp.V, tp.U, tp.W, R, 2));
              if (!tp.lbl) fail(where + ': the letter on tile ' + D.TEAR_NAMES[i][j] + ' has nowhere to go');
              else {
                const r = clearOf(where + ' tile ' + D.TEAR_NAMES[i][j], { v:'X', fs:15, at:tp.lbl }, tilesStrokes);
                if (r && (r.x < 4 - EPS || r.y < 4 - EPS || r.x + r.w > T.pw - 4 + EPS || r.y + r.h > T.pw - 4 + EPS)) fail(where + ': the letter on tile ' + D.TEAR_NAMES[i][j] + ' sticks out of the tile');
                [pw.p, pw.q].forEach(q => { if (q.x < 2 || q.y < 2 || q.x > T.pw - 2 || q.y > T.pw - 2) fail(where + ': the wedge on tile ' + D.TEAR_NAMES[i][j] + ' sticks out of the tile'); });
              }
            }
          });
          /* the letters A~F: near their own vertex (nearer than any other vertex), clear of every stroke of both triangles */
          const sc = D.tearScene(e);
          const strokes = [];
          tris.forEach(P => { edgesOf(P, 3).forEach(s => strokes.push(s)); P.forEach((V, j) => arcSegs(V, P[(j + 1) % 3], P[(j + 2) % 3], R, 2).forEach(s => strokes.push(s))); P.forEach((V, j) => { const u = D.tearCorner(P, j); [u.U, u.W].forEach(Q => { const L = dist(V, Q); strokes.push({ a:V, b:{ x:V.x + (Q.x - V.x) * R / L, y:V.y + (Q.y - V.y) * R / L }, w:2 }); }); }); });
          const boxes = [];
          sc.labels.forEach(L => {
            const i = D.TEAR_NAMES[0].indexOf(L.v) >= 0 ? 0 : 1, j = D.TEAR_NAMES[i].indexOf(L.v);
            if (j < 0 || L.k !== L.v){ fail(where + ': a corner label is not one of A~F'); return; }
            const r = clearOf(where, L, strokes);
            nearestIs(where, L, tris[i][j], tris[0].concat(tris[1]).filter(p => p !== tris[i][j]));
            if (r){ boxes.push(r); if (r.y + r.h > T.zcy - T.zh - T.pad) fail(where + ': letter ' + L.v + ' reaches into the drop zone of the lines'); if (r.x < 2 || r.y < 2 || r.x + r.w > W - 2) fail(where + ': letter ' + L.v + ' sticks out of the board'); }
          });
          if (sc.labels.length !== 6) fail(where + ': ' + sc.labels.length + ' corner letters, expected 6');
          noHits(boxes, where + ': corner letters');
          /* every order of placing the three corners fills the line from 180° to 0° with no gap and no overlap */
          [0, 1].forEach(i => {
            [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].forEach(ord => {
              let used = 0, last = 180;
              ord.forEach(j => {
                const s = D.tearSlot(i, used, e[i][j]), w = readPath(D.wedgePath(s.V, s.U, s.W, R));
                const a0 = upDeg(w.V, w.p), a1 = upDeg(w.V, w.q), hiA = Math.max(a0, a1), loA = Math.min(a0, a1);
                if (Math.abs(w.V.x - T.ox[i]) > 0.08 || Math.abs(w.V.y - T.ly) > 0.08) fail(where + ': a corner on line ' + i + ' is not on the dot');
                /* path coordinates are rounded to 0.1px: at radius 24 that is up to ~0.25° per edge */
                if (Math.abs(hiA - last) > 0.3 || Math.abs(hiA - loA - e[i][j]) > 0.3) fail(where + ': corner ' + D.TEAR_NAMES[i][j] + ' (order ' + ord + ') does not sit right next to the last one (' + hiA.toFixed(2) + '..' + loA.toFixed(2) + ', expected from ' + last + ')');
                last = loA; used += e[i][j];
                /* the wedge on the line is drawn above the line (it sweeps the upper half) */
                const mid = (hiA + loA) / 2 * Math.PI / 180, sweepUp = w.sweep === 1;
                if (!sweepUp) fail(where + ': a placed corner is drawn below the line');
                if (Math.sin(mid) < -EPS) fail(where + ': a placed corner points below the line');
              });
              if (Math.abs(last) > 0.3) fail(where + ': the three corners of triangle ' + i + ' (order ' + ord + ') stop at ' + last.toFixed(2) + '°, not at the right half of the line (0°)');
            });
          });
        });
        /* lines, zones, tray */
        if (T.ox.length !== 2) fail('GAME tear: two lines expected');
        const Z = D.tearZones();
        if (Z.length !== 2 || Z.some(z => z.done)) fail('GAME tear: two zones expected (not done)');
        T.ox.forEach((x, i) => {
          const z = Z[i];
          if (z.cx !== x) fail('GAME tear: zone ' + i + ' is not centred on its line');
          if (!(z.cx - z.hw <= x - T.half + EPS && z.cx + z.hw >= x + T.half - EPS && z.cy - z.hh <= T.ly - R - EPS && z.cy + z.hh >= T.ly + EPS)) fail('GAME tear: zone ' + i + ' does not cover its line and the half circle above it (what the child sees as the target)');
          insideBoard({ x:x - T.half - 2, y:T.ly - R - 2, w:2 * T.half + 4, h:R + 4 }, 'tear line ' + i, D.TEAR_H);
        });
        /* every point of the board: nearestOpen picks the zone nearest by distance to the box — scan the overlap */
        if (nearestOpen){
          const ov = Z[0].cx + Z[0].hw + T.pad - (Z[1].cx - Z[1].hw - T.pad);
          if (!(ov > 0)) fail('GAME tear: the two line zones do not overlap — the nearest-zone rule is never exercised (widen them, or change this check)');
          const txs = []; for (let x = 0; x <= W; x += 0.5) txs.push(x);
          Z.forEach(z => [z.cx - z.hw, z.cx + z.hw].forEach(e => [-T.pad - 0.01, -T.pad + 0.01, -0.01, 0.01, T.pad - 0.01, T.pad + 0.01].forEach(dx => txs.push(e + dx))));
          [-0.01, 0, 0.01].forEach(dx => txs.push((Z[0].cx + Z[0].hw + Z[1].cx - Z[1].hw) / 2 + dx));
          const tys = []; for (let y = T.zcy - T.zh - T.pad - 2; y <= T.zcy + T.zh + T.pad + 2; y += 1) tys.push(y);
          [T.zcy - T.zh - T.pad, T.zcy + T.zh + T.pad].forEach(e => [-0.01, 0.01].forEach(dy => tys.push(e + dy)));
          for (const x of txs) for (const y of tys){
            const got = nearestOpen(Z, { x, y }, T.pad), dz = Z.map(z => Math.abs(x - z.cx) <= z.hw + T.pad && Math.abs(y - z.cy) <= z.hh + T.pad ? Math.hypot(Math.max(0, Math.abs(x - z.cx) - z.hw), Math.max(0, Math.abs(y - z.cy) - z.hh)) : Infinity);
            const want = dz[0] === Infinity && dz[1] === Infinity ? null : (dz[1] < dz[0] ? Z[1] : (dz[0] < dz[1] ? Z[0] : (Math.abs(x - Z[0].cx) <= Math.abs(x - Z[1].cx) ? Z[0] : Z[1])));
            if (got !== want){ fail('GAME tear: a drop at (' + x + ', ' + y + ') goes to line ' + (got ? got.i : '-') + ', the nearest is ' + (want ? want.i : '-')); break; }
          }
        }
        [0, 1].forEach(t => [0, 1].forEach(l => { if ((D.tearRefuse(t, l) === null) !== (t === l)) fail('GAME tearRefuse(' + t + ', ' + l + '): ' + (t === l ? 'refuses its own line' : 'takes the other triangle’s corner')); }));
        const tiles = [];
        T.trayX.forEach(x => T.trayY.forEach(y => tiles.push(rect(x, y, T.pw, T.pw))));
        tiles.forEach((r, k) => insideBoard(r, 'tear tile ' + k, D.TEAR_H));
        noHits(tiles, 'tear tiles');
        tooSmall('tear tile', T.pw);
        Z.forEach((z, i) => tiles.forEach((r, k) => { if (hit(r, rect(z.cx, z.cy, 2 * (z.hw + T.pad), 2 * (z.hh + T.pad)))) fail('GAME tear: tile ' + k + ' sits inside the drop zone of line ' + i); }));
        T.box.forEach((bx, i) => Z.forEach(z => { if (hit(bx, rect(z.cx, z.cy, 2 * (z.hw + T.pad), 2 * (z.hh + T.pad)))) fail('GAME tear: triangle box ' + i + ' overlaps a drop zone'); }));
        { const hh = 1.45 * 15 / 2; if (T.lblY - hh < T.ly + 1.5 + 2 || T.lblY + hh > T.trayY[0] - T.pw / 2 - 2) fail('GAME tear: the line labels (centre ' + T.lblY + ') come within 2px of the line or the tray'); }
        for (let k = 0; k < 400; k++){ const t = D.tearTray(); if (t.length !== 6 || myTearInOrder(t)){ fail('GAME tear: the tray starts with one triangle’s three corners in a row: ' + JSON.stringify(t)); break; } }
        /* the round's rules in RENDER */
        needOnce('tear', 'tearRefuse(', 'the corner is judged in exactly one place');
        needOnce('tear', "svg.appendChild(svgEl('path', { d:wedgePath(slot.V, slot.U, slot.W, TEAR.R),", 'the placed corner is drawn from tearSlot() in exactly one place (its geometry on screen is measured by the e2e)');
        need('tear', /var z = nearestOpen\(zones, pt, TEAR\.pad\);/, 'the line judged is not the nearest one to where it was dropped');
        need('tear', /if \(tearRefuse\(t, z\.i\)\)\{/, 'the corner is not judged against the line it was dropped on');
        need('tear', /var slot = tearSlot\(t, used\[t\], e\[t\]\[j\]\);/, 'a placed corner is not drawn next to the corners already on that line');
        need('tear', /used\[t\] \+= e\[t\]\[j\]; filled\[t\]\+\+; done\+\+;/, 'the line does not remember how much is already placed');
        need('tear', /if \(done === 6\) roundSolved\(d\.gTearDone\);/, 'the round is not solved exactly when all six corners are placed');
        LANGS.forEach(L => {
          const d = I18N[L];
          D.TEAR_NAMES.forEach((names, t) => names.forEach(n => {
            const s = d.gTearBad(n, t);
            say('gTearBad', L, s, []);
            /* 「A 角」／「Corner A」—— 只找字母不夠：△ABC 裡面就有 A */
            if (s.indexOf(L === 'zh' ? n + ' 角' : 'Corner ' + n) < 0 || s.indexOf(['△ABC', '△DEF'][t]) < 0 || s.indexOf(['△ABC', '△DEF'][1 - t]) < 0) fail('GAME gTearBad ' + L + ': must name the corner, its triangle and the other line: ' + s);
            has('gTearBad', L, s, { zh:['同一個三角形'], en:['ONE triangle'] });
            hasNot('gTearBad', L, s, { zh:['只有同一個三角形的三個角，才'], en:['only the three corners of one triangle'] });
            [1, 2].forEach(k => { say('gTearOk', L, d.gTearOk(n, t, k), [k, 3]); if (d.gTearOk(n, t, k).indexOf(['△ABC', '△DEF'][t]) < 0 || d.gTearOk(n, t, k).indexOf(L === 'zh' ? n + ' 角' : 'Corner ' + n) < 0) fail('GAME gTearOk ' + L + ' must name the corner and its triangle'); });
            say('gTear2', L, d.gTear2(n, t), [2]);
            if (d.gTear2(n, t).indexOf(L === 'zh' ? n + ' 角' : 'corner ' + n) < 0 || d.gTear2(n, t).indexOf(['△ABC', '△DEF'][t]) < 0) fail('GAME gTear2 ' + L + ' must name the corner and its line');
            if (d.gTearLine(t) !== ['△ABC', '△DEF'][t] || nums(d.gTearLineDone(t)).join() !== '180' || d.gTearLineDone(t).indexOf(['△ABC', '△DEF'][t]) !== 0) fail('GAME gTearLine/gTearLineDone ' + L + ' wrong');
          }));
          for (let a = 0; a <= 3; a++) for (let b = 0; b <= 3; b++) say('gTearNow', L, d.gTearNow(a, b), [a, 3, b, 3]);
          say('gTearNow', L, d.gTearNow(1, 2), [1, 3, 2, 3]);
          say('gTearDone', L, d.gTearDone, [180]);
          has('gTearDone', L, d.gTearDone, { zh:['直線', '180°'], en:['straight line', '180°'] });
        });
      }

      /* ================= 第 2 關：切一刀 ================= */
      const quadChecks = (where, q, P, texts, H) => {
        if (!P){ fail(where + ': quadPts() cannot draw it'); return null; }
        if (q.slice(0, 4).reduce((x, y) => x + y, 0) !== 360 || q.slice(0, 4).some(a => !isInt(a) || a < 55 || a > 125)) fail(where + ': four whole angles of 55~125 adding to 360 expected');
        P.forEach((V, j) => { const m = angAt(P[(j + 3) % 4], V, P[(j + 1) % 4]); if (Math.abs(m - q[j]) > 0.01) fail(where + ': corner ' + j + ' is drawn as ' + m.toFixed(2) + '°, not ' + q[j] + '°'); });
        /* convex, counter-clockwise on screen order A (bottom-left), B (bottom-right), C (top-right), D (top-left) */
        const cr = P.map((V, j) => { const a = P[(j + 1) % 4], b = P[(j + 2) % 4]; return (a.x - V.x) * (b.y - a.y) - (a.y - V.y) * (b.x - a.x); });
        if (!(cr.every(c => c < 0) || cr.every(c => c > 0))) fail(where + ': not convex');
        if (!(P[0].y > P[3].y && P[1].y > P[2].y && P[0].x < P[1].x)) fail(where + ': the corners are not A bottom-left, B bottom-right, C top-right, D top-left');
        const bx = D.QUAD.box;
        P.forEach(p => { if (p.x < bx.x - EPS || p.x > bx.x + bx.w + EPS || p.y < bx.y - EPS || p.y > bx.y + bx.h + EPS) fail(where + ': a corner leaves the drawing box'); });
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (dist(P[i], P[j]) < 2 * D.QUAD.pick + 8) fail(where + ': corners ' + i + ' and ' + j + ' are only ' + dist(P[i], P[j]).toFixed(0) + 'px apart — their tap zones (' + D.QUAD.pick + ') touch');
        const sc = D.quadScene(q, bx, H, texts);
        const strokes = edgesOf(P, 3);
        P.forEach((V, j) => { arcSegs(V, P[(j + 1) % 4], P[(j + 3) % 4], D.QUAD.arc, 2).forEach(s => strokes.push(s)); strokes.push({ a:V, b:V, w:2 * D.QUAD.dot + 2 }); });
        const boxes = [];
        sc.labels.forEach((L, j) => {
          if (L.k !== j || L.v !== texts[j]) fail(where + ': label ' + j + ' reads ' + L.v + ', expected ' + texts[j]);
          const r = clearOf(where, L, strokes);
          nearestIs(where, L, P[j], P.filter((p, i) => i !== j));
          if (r){ boxes.push(r); if (r.x < 2 || r.y < 2 || r.x + r.w > W - 2 || r.y + r.h > H - 2) fail(where + ': label ' + L.v + ' sticks out of the board'); if (inside(L.at, P)) fail(where + ': label ' + L.v + ' is inside the quadrilateral (labels go outside the corner)'); }
        });
        noHits(boxes, where + ': labels');
        return { P, sc, strokes, boxes };
      };
      {
        if (!(D.GAME_CUT.length >= 5)) fail('GAME cut: only ' + D.GAME_CUT.length + ' quadrilaterals');
        D.GAME_CUT.forEach(q => {
          const where = 'GAME cut [' + q + ']';
          const P = D.quadPts(q, D.QUAD.box), Q = quadChecks(where, q, P, q.slice(0, 4).map(a => a + '°'), D.CUT_H);
          if (!Q) return;
          /* tap zones: every point of the board → the corner nearest by (dot, its label box), within PICK; else nothing */
          const lb = Q.sc.labels.map(L => L.at ? box(L) : null);
          for (let x = 0; x <= W; x += 1.5) for (let y = 0; y <= D.CUT_H; y += 1.5){
            const ds = P.map((V, j) => { let dd = dist({ x, y }, V); if (lb[j]) dd = Math.min(dd, Math.hypot(Math.max(lb[j].x - x, 0, x - lb[j].x - lb[j].w), Math.max(lb[j].y - y, 0, y - lb[j].y - lb[j].h))); return dd; });
            const m = Math.min(...ds), want = m <= D.QUAD.pick ? ds.indexOf(m) : null, got = D.cutPick(Q.sc, { x, y });
            if (got !== want){ fail(where + ': a tap at (' + x + ', ' + y + ') picks corner ' + got + ', the nearest (dot or its number) is ' + want); x = W + 1; break; }
          }
          /* both diagonals: two triangles, each labelled 180° inside itself, clear of every stroke (incl. the diagonal and the corner labels) */
          [0, 1].forEach(i => {
            const cs = D.cutScene(q, i), hv = D.cutHalves(i);
            const keyOf = h => h.slice().sort().join();
            const wantH = [[i, i + 1, i + 2], [i + 2, (i + 3) % 4, i]].map(keyOf).sort().join('|');
            if (hv.map(keyOf).sort().join('|') !== wantH || cs.halves.map(keyOf).sort().join('|') !== wantH) fail(where + ' diagonal ' + i + ': the halves are not the two triangles on each side of corners ' + i + '–' + (i + 2));
            const st = Q.strokes.concat([{ a:P[i], b:P[i + 2], w:3 }]).concat(Q.boxes.flatMap(r => edgesOf([{ x:r.x, y:r.y }, { x:r.x + r.w, y:r.y }, { x:r.x + r.w, y:r.y + r.h }, { x:r.x, y:r.y + r.h }], 0)));
            const hb = [];
            cs.halfLabels.forEach((L, n) => {
              if (L.v !== '180°') fail(where + ' diagonal ' + i + ': half label reads ' + L.v);
              const r = clearOf(where + ' diagonal ' + i, L, st);
              const T3 = cs.halves[n].map(j => P[j]);
              if (r){ hb.push(r); [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].forEach(c => { if (!inside({ x:c[0], y:c[1] }, T3)) fail(where + ' diagonal ' + i + ': a "180°" sticks out of its own triangle'); }); }
              let s = 0; T3.forEach((V, j) => { s += angAt(T3[(j + 1) % 3], V, T3[(j + 2) % 3]); });
              if (Math.abs(s - 180) > 0.01) fail(where + ' diagonal ' + i + ': a half is not a triangle of 180°');
            });
            noHits(hb, where + ' diagonal ' + i + ': the two 180° labels');
          });
        });
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++){
          const k = (j - i + 4) % 4, want = k === 0 ? 'same' : (k === 2 ? null : 'side'), got = D.cutRefuse(i, j);
          if (got !== want) fail('GAME cutRefuse(' + i + ', ' + j + ') is ' + got + ', expected ' + want);
        }
        needOnce('cut', 'cutRefuse(', 'the cut is judged in exactly one place'); needOnce('cut', 'cutPick(', 'the corner is picked in exactly one place');
        need('cut', /var j = cutPick\(sc, pt\);/, 'the corner judged is not the one tapped');
        need('cut', /var bad = cutRefuse\(first, j\), i = first;/, 'the cut is not judged from the first and second corner tapped');
        need('cut', /var cs = cutScene\(q, i\);/, 'the cut drawn is not along the corners tapped');
        need('cut', /roundSolved\(d\.gCutDone\(q\)\);/, 'the round is not solved by the diagonal cut');
        LANGS.forEach(L => {
          const d = I18N[L];
          D.GAME_CUT.forEach(q => say('gCutDone', L, d.gCutDone(q), [180, 2, 360, q[0], q[1], q[2], q[3], 360], { verify:2 }));
          say('gCutSide', L, d.gCutSide, []); has('gCutSide', L, d.gCutSide, { zh:['相鄰', '本來就有的邊'], en:['next to each other', 'side'] });
          say('gCut2', L, d.gCut2, [2]); has('gCut2', L, d.gCut2, { zh:['不相鄰'], en:['not next to each other'] });
          say('gCutNowDone', L, d.gCutNowDone, [180, 180, 360], { verify:1 });
          say('gCutNow0', L, d.gCutNow0, []); say('gCutNow1', L, d.gCutNow1, []);
        });
      }

      /* ================= 第 3 關：轉一轉 ================= */
      {
        const T = D.TURN, A = { x:T.ax, y:T.by }, Bp = { x:T.ax + T.L, y:T.by };
        if (D.turnA().x !== A.x || D.turnA().y !== A.y || D.turnB().x !== Bp.x || D.turnB().y !== Bp.y) fail('GAME turn: A and B are not the ends of the base');
        if (T.step !== 5) fail('GAME turn: B turns in 5° steps');
        /* a tick is drawn from rh − 6 to rh + 6 (butt caps): both drawn ends must be inside the track tap band, with a 2px margin for finger slop (verifier 2026-10-11) */
        if (!(T.track >= 6 + 2)) fail('GAME turn: the track tap band (±' + T.track + 'px) does not reach the drawn ends of a tick (±6px)');
        if (!(D.GAME_TURN.length >= 5)) fail('GAME turn: only ' + D.GAME_TURN.length + ' targets');
        tooSmall('turn ring', D.GPICK);
        D.GAME_TURN.forEach(e => {
          const [a, t, lo, hi, b0] = e, bs = 180 - a - t, where = 'GAME turn [' + e + ']';
          if (!(bs % 5 === 0 && bs >= lo && bs <= hi)) fail(where + ': the answer B = 180 − ' + a + ' − ' + t + ' = ' + bs + ' is not a tick between ' + lo + ' and ' + hi);
          if (!(b0 % 5 === 0 && b0 >= lo && b0 <= hi && b0 !== bs)) fail(where + ': the start ' + b0 + ' must be a tick in range and not the answer');
          if (lo % 5 || hi % 5 || !(lo >= 15) || !(hi <= 150)) fail(where + ': the range must be ticks within 15~150');
          if (180 - a - hi < 25) fail(where + ': at B = ' + hi + ' angle C is only ' + (180 - a - hi) + '° — too thin to see');
          for (let b = lo; b <= hi; b += 5){
            /* my own C: where the line from A at a° meets the line from B at (180 − b)° */
            const C = meet(A, { x:Math.cos(a * Math.PI / 180), y:-Math.sin(a * Math.PI / 180) }, Bp, { x:-Math.cos(b * Math.PI / 180), y:-Math.sin(b * Math.PI / 180) });
            const pc = D.turnApex(a, b);
            if (dist(C, pc) > 0.01) fail(where + ' B ' + b + ': turnApex() is not where the two sides meet');
            const ma = angAt(Bp, A, pc), mb = angAt(A, Bp, pc), mc = angAt(A, pc, Bp);
            if (Math.abs(ma - a) > 0.01 || Math.abs(mb - b) > 0.01 || Math.abs(mc - (180 - a - b)) > 0.01) fail(where + ' B ' + b + ': drawn as ' + [ma, mb, mc].map(x => x.toFixed(2)) + ', labelled ' + [a, b, 180 - a - b]);
            const H = D.turnHandle(b);
            if (Math.abs(dist(H, Bp) - T.rh) > 0.01 || angAt(pc, Bp, H) < 179.99) fail(where + ' B ' + b + ': the ring is not on side CB carried on through B');
            insideBoard(rect(H.x, H.y, D.GPICK + 4, D.GPICK + 4), where + ' ring at B ' + b, D.TURN_H);
            if (pc.y < 4 || pc.x < 4 || pc.x > W - 4) fail(where + ' B ' + b + ': the top corner C runs off the board');
            if (D.turnSnap(e, H) !== b || D.turnDeg(H) - b > 0.01) fail(where + ' B ' + b + ': the ring at B ' + b + ' does not read back as ' + b);
            /* labels: A's and B's numbers and C's "?" (and the answer once solved) inside the triangle, nearest their own corner, clear of every stroke */
            [['?', null], [t + '°', t]].forEach(([ct]) => {
              const sc = D.turnScene(e, b, ct === '?' ? undefined : ct), Tr = [A, Bp, pc];
              const st = edgesOf(Tr, 3).concat(arcSegs(A, Bp, pc, T.arc, 2), arcSegs(Bp, pc, A, T.arc, 2), arcSegs(pc, A, Bp, T.arc, 2), [{ a:Bp, b:H, w:2 }, { a:H, b:H, w:D.GPICK + 4 }]);
              const tr = [];
              for (let k = lo; k <= hi; k += 5){ const at = (r) => ({ x:Bp.x + r * Math.cos(k * Math.PI / 180), y:Bp.y + r * Math.sin(k * Math.PI / 180) }); st.push({ a:at(T.rh - 6), b:at(T.rh + 6), w:2 }); if (k > lo){ const k0 = k - 5; st.push({ a:{ x:Bp.x + T.rh * Math.cos(k0 * Math.PI / 180), y:Bp.y + T.rh * Math.sin(k0 * Math.PI / 180) }, b:at(T.rh), w:2 }); } }
              const want = { a:a + '°', b:b + '°', c:ct }, V = { a:A, b:Bp, c:pc }, bx = [];
              if (sc.labels.length !== 3) fail(where + ' B ' + b + ': ' + sc.labels.length + ' labels, expected 3');
              sc.labels.forEach(L => {
                if (L.v !== want[L.k]) fail(where + ' B ' + b + ': label ' + L.k + ' reads ' + L.v + ', expected ' + want[L.k]);
                const r = clearOf(where + ' B ' + b, L, st);
                if (!L.at) return;
                if (!inside(L.at, Tr)) fail(where + ' B ' + b + ': label ' + L.v + ' is outside the triangle');
                nearestIs(where + ' B ' + b, L, V[L.k], ['a', 'b', 'c'].filter(k => k !== L.k).map(k => V[k]));
                if (r){ bx.push(r); if (r.x < 2 || r.y < 2 || r.x + r.w > W - 2 || r.y + r.h > D.TURN_H - 2) fail(where + ' B ' + b + ': label ' + L.v + ' sticks out of the board'); }
              });
              noHits(bx, where + ' B ' + b + ': labels');
            });
            /* the judge and its sentences */
            const r = D.turnRefuse(a, b, t), c = 180 - a - b;
            if ((r === null) !== (c === t)) fail(where + ' B ' + b + ': turnRefuse() ' + (r ? 'refuses the answer' : 'takes a wrong B'));
            if (r && (r.c !== c || r.s !== a + b || r.more !== (c > t))) fail(where + ' B ' + b + ': turnRefuse() reports ' + JSON.stringify(r));
            LANGS.forEach(L => {
              const d = I18N[L];
              if (r){
                const s = d.gTurnBad(a, b, r.c, t, r.more);
                say('gTurnBad', L, s, [a, b, a + b, 180, a + b, c, c, t], { verify:2 });
                /* the direction it names must really move C toward t: turning B bigger makes C smaller */
                const big = L === 'zh' ? /轉大/.test(s) : /bigger/.test(s), small = L === 'zh' ? /轉小/.test(s) : /smaller/.test(s);
                if (big === small || big !== (c > t)) fail('GAME gTurnBad ' + L + ': at B ' + b + ' (C ' + c + ', target ' + t + ') the sentence turns B the wrong way: ' + s);
              }
            });
          }
          /* snap: points on the track around every tick (±2.4°) and on the ring's line beyond → that tick; off the track → not a track tap */
          for (let b = lo; b <= hi; b += 5) [-2.49, -2.4, 0, 2.4, 2.49].forEach(dd => [T.rh - T.track + 1, T.rh, T.rh + T.track - 1].forEach(rr => {
            const p = { x:Bp.x + rr * Math.cos((b + dd) * Math.PI / 180), y:Bp.y + rr * Math.sin((b + dd) * Math.PI / 180) };
            if (D.turnSnap(e, p) !== b) fail(where + ': a point ' + dd + '° from the ' + b + '° tick snaps to ' + D.turnSnap(e, p));
            if (!D.turnOnTrack(e, p)) fail(where + ': a tap ' + dd + '° from the ' + b + '° tick (radius ' + rr + ') is not taken as a track tap');
          }));
          /* the boundary between two ticks is halfway (±0.01°; the exact midpoint is not representable after cos/sin, so it is not asserted) */
          for (let b = lo; b < hi; b += 5){ const at = dd => ({ x:Bp.x + T.rh * Math.cos((b + dd) * Math.PI / 180), y:Bp.y + T.rh * Math.sin((b + dd) * Math.PI / 180) });
            if (D.turnSnap(e, at(2.51)) !== b + 5 || D.turnSnap(e, at(2.49)) !== b) fail(where + ': the boundary between the ' + b + '° and ' + (b + 5) + '° ticks is not halfway'); }
          [{ x:Bp.x + (T.rh + T.track + 3) * Math.cos(Math.PI * (lo + 5) / 180), y:Bp.y + (T.rh + T.track + 3) * Math.sin(Math.PI * (lo + 5) / 180) },
           { x:Bp.x + (T.rh - T.track - 3) * Math.cos(Math.PI * (lo + 5) / 180), y:Bp.y + (T.rh - T.track - 3) * Math.sin(Math.PI * (lo + 5) / 180) },
           { x:Bp.x + T.rh * Math.cos(Math.PI * (lo - 6) / 180), y:Bp.y + T.rh * Math.sin(Math.PI * (lo - 6) / 180) },
           { x:Bp.x + T.rh * Math.cos(Math.PI * (hi + 6) / 180), y:Bp.y + T.rh * Math.sin(Math.PI * (hi + 6) / 180) }, { x:A.x, y:A.y - 30 }]
            .forEach(p => { if (D.turnOnTrack(e, p)) fail(where + ': a tap off the track (' + p.x.toFixed(0) + ', ' + p.y.toFixed(0) + ') is taken as a track tap'); });
          if (D.turnSnap(e, { x:Bp.x + 50, y:Bp.y - 80 }) !== lo || D.turnSnap(e, { x:Bp.x - 80, y:Bp.y - 10 }) !== hi) fail(where + ': dragging past the ends of the track does not stop at ' + lo + ' / ' + hi);
          const tk = D.turnTrack(e).ticks.map(k => k.b);
          if (tk.join() !== Array.from({ length:(hi - lo) / 5 + 1 }, (_, i) => lo + 5 * i).join()) fail(where + ': the ticks are not every 5° from ' + lo + ' to ' + hi);
          LANGS.forEach(L => {
            const d = I18N[L];
            say('gTurnDone', L, d.gTurnDone(a, bs, t), [a, bs, a + bs, 180, a + bs, t, t], { verify:2 });
            say('gTurn2', L, d.gTurn2(a, t), [2, t, 180, t, 180 - t, a], { verify:1 });
            say('gTurnNow', L, d.gTurnNow(a, b0), [a, b0]); say('gTurnNow solved', L, d.gTurnNow(a, bs, t + '°'), [a, bs, t]);
            if (!/C \?$/.test(d.gTurnNow(a, b0))) fail('GAME gTurnNow ' + L + ' should end "C ?" while unsolved');
            say('gAsks.turn', L, d.gAsks.turn(t), [5, 5, t]);
          });
        });
        needOnce('turn', 'turnRefuse(', 'B is judged in exactly one place'); needOnce('turn', 'roundSolved(', 'the round is solved in exactly one place');
        need('turn', /snap:function\(p\)\{ return turnHandle\(turnSnap\(e, p\)\); \},/, 'the ring does not snap to the nearest tick while dragged');
        need('turn', /onPlace:function\(P\)\{ var nb = turnSnap\(e, \{ x:P\.cx, y:P\.cy \}\); if \(nb !== b\)\{ b = nb; draw\(\); refreshHint\(\); \} \}/, 'turning the ring does not redraw the triangle and its numbers');
        need('turn', /if \(gSolved \|\| grip\.busy\(\)\) return;   \/\* 把手正被拖著/, '“That’s it” judges while the ring is still held');
        need('turn', /var bad = turnRefuse\(a, b, t\);/, 'the B judged is not the one on screen');
        need('turn', /B\.onBoardTap = function\(pt\)\{ if \(turnOnTrack\(e, pt\)\) setB\(turnSnap\(e, pt\)\); \};/, 'a tap on the track does not set B to that tick');
        need('turn', /B\.onTap = function\(P, pt\)\{ if \(turnOnTrack\(e, pt\)\) setB\(turnSnap\(e, pt\)\); \};/, 'a tap on a tick under the ring does not set B to that tick');
        need('turn', /less\.addEventListener\('click', function\(\)\{ if \(!grip\.busy\(\)\) setB\(b - TURN\.step\); \}\);/, '−5° does not turn B 5° smaller');
        need('turn', /more\.addEventListener\('click', function\(\)\{ if \(!grip\.busy\(\)\) setB\(b \+ TURN\.step\); \}\);/, '+5° does not turn B 5° bigger');
        need('turn', /draw\(t \+ '°'\);\n\s*roundSolved\(d\.gTurnDone\(a, b, t\)\);/, 'solving does not write C’s angle in place of the ?');
        need('turn', /line\.textContent = d\.gTurnNow\(a, b, cText\);/, 'the readout does not follow the drawing (B, and C once solved)');
      }

      /* ================= 第 4 關：分一分 ================= */
      {
        const S = D.SORT, mine = c => { const t = [c[0], c[1], 180 - c[0] - c[1]]; if (t.every(x => x === 60)) return 'eq'; if (t.indexOf(90) >= 0) return 'right'; if (t[0] === t[1] || t[0] === t[2] || t[1] === t[2]) return 'iso'; return 'none'; };
        if (D.SORT_KINDS.join() !== 'eq,iso,right') fail('GAME sort: the boxes should be equilateral, isosceles, right (left to right)');
        if (!(D.GAME_SORT.length >= 5)) fail('GAME sort: only ' + D.GAME_SORT.length + ' groups');
        D.GAME_SORT.forEach((g, n) => {
          const where = 'GAME sort group ' + n + ' ' + JSON.stringify(g);
          if (g.length !== 4) fail(where + ': 4 cards expected');
          const kinds = g.map(mine);
          g.forEach((c, i) => {
            const third = 180 - c[0] - c[1];
            if (!(third > 0) || c.some(x => !isInt(x) || x <= 0)) fail(where + ': card ' + c + ' is not a triangle');
            if (D.sortThird(c) !== third) fail(where + ': sortThird(' + c + ') is not 180 − ' + c[0] + ' − ' + c[1]);
            if (kinds[i] === 'none') fail(where + ': card ' + c + ' (? = ' + third + ') fits none of the boxes');
            const t3 = [c[0], c[1], third];
            if (t3.indexOf(90) >= 0 && (t3[0] === t3[1] || t3[0] === t3[2] || t3[1] === t3[2])) fail(where + ': card ' + c + ' is a right isosceles triangle — it fits two boxes');
            if (D.sortKind(c) !== (kinds[i] === 'none' ? null : kinds[i])) fail(where + ': sortKind(' + c + ') is ' + D.sortKind(c) + ', expected ' + kinds[i]);
            D.SORT_KINDS.forEach(bin => {
              const want = kinds[i] === bin ? null : (kinds[i] === 'eq' && bin === 'iso' ? 'alsoIso' : kinds[i]);
              if (D.sortRefuse(c, bin) !== want) fail(where + ': sortRefuse(' + c + ', ' + bin + ') is ' + D.sortRefuse(c, bin) + ', expected ' + want);
              if (want && want !== 'alsoIso') LANGS.forEach(L => {
                const s = I18N[L].gSortBad(c[0], c[1], third, bin);
                say('gSortBad', L, s, [180, c[0], c[1], third, c[0], c[1], third].concat(bin === 'eq' ? [60] : (bin === 'right' ? [90] : [])), { verify:1 });
                /* the reason must be TRUE for this card */
                if (bin === 'eq' && t3.every(x => x === 60)) fail('GAME gSortBad: says "not all 60°" for ' + t3);
                if (bin === 'iso' && (t3[0] === t3[1] || t3[0] === t3[2] || t3[1] === t3[2])) fail('GAME gSortBad: says "no two are equal" for ' + t3);
                if (bin === 'right' && t3.indexOf(90) >= 0) fail('GAME gSortBad: says "none is 90°" for ' + t3);
                has('gSortBad ' + bin, L, s, { zh:[{ eq:'不是正三角形', iso:'不是等腰三角形', right:'不是直角三角形' }[bin]], en:[{ eq:'not equilateral', iso:'not isosceles', right:'not a right triangle' }[bin]] });
                /* the reason clause itself, with its polarity (codex 第一輪: only the end phrase was checked) */
                has('gSortBad reason ' + bin, L, s, { zh:[{ eq:'不是三個都是 60°', iso:'沒有兩個一樣大', right:'沒有 90°' }[bin]], en:[{ eq:'they are not all 60°', iso:'no two of them are equal', right:'none of them is 90°' }[bin]] });
                hasNot('gSortBad reason ' + bin, L, s, { zh:[/(?<!不是)三個都是 60°/, /(?<!沒)有兩個一樣大/, /(?<!沒)有 90°/], en:[/\bthey are all 60°/, /(?<!no )two of them are equal/, /\bone of them is 90°/] });
              });
            });
            LANGS.forEach(L => { say('gSortOk', L, I18N[L].gSortOk(c[0], c[1], third, I18N[L].gKinds[kinds[i]]), [180, c[0], c[1], third], { verify:1 }); say('gSort2', L, I18N[L].gSort2(c[0], c[1], third), [2, c[0], c[1], 180, c[0], c[1], third], { verify:1 }); });
            if (D.sortCardText(c) !== c[0] + '°　' + c[1] + '°　?' || D.sortChipText(c) !== '? ＝ ' + third + '°') fail(where + ': the card / chip text of ' + c + ' is wrong');
          });
          ['eq', 'iso', 'right'].forEach(k => { if (kinds.indexOf(k) < 0) fail(where + ': no ' + k + ' card'); });
          /* the computing has to matter: one isosceles card whose two GIVEN angles differ (only ? shows the pair), one right card with no 90 given */
          if (!g.some((c, i) => kinds[i] === 'iso' && c[0] !== c[1])) fail(where + ': no isosceles card that needs ? to be worked out');
          if (!g.some((c, i) => kinds[i] === 'right' && c[0] !== 90 && c[1] !== 90)) fail(where + ': no right-triangle card that needs ? to be worked out');
          if (D.GAME_SORT[n].map(String).length !== new Set(g.map(String)).size) fail(where + ': two cards are the same');
          const per = {}; kinds.forEach(k => { per[k] = (per[k] || 0) + 1; });
          if (Object.keys(per).some(k => per[k] > S.chipY.length)) fail(where + ': a box gets more cards than it has chip rows');
          for (let k = 0; k < 400; k++){ const tr = D.sortTray(g); if (mySortInOrder(tr)){ fail(where + ': the tray starts in the boxes’ order'); break; } }
        });
        /* layout */
        const cards = [];
        S.trayX.forEach(x => S.trayY.forEach(y => cards.push(rect(x, y, S.cardW, S.cardH))));
        cards.forEach((r, k) => insideBoard(r, 'sort card ' + k, D.SORT_H));
        noHits(cards, 'sort cards');
        tooSmall('sort card', Math.min(S.cardW, S.cardH));
        const bins = S.binX.map(x => ({ x, y:S.binY, w:S.binW, h:S.binH }));
        bins.forEach((r, k) => { insideBoard(r, 'sort box ' + k, D.SORT_H); cards.forEach(c => { if (hit(c, r)) fail('GAME sort: a card starts on box ' + k); }); });
        noHits(bins, 'sort boxes');
        bins.forEach((r, k) => {
          const lbl = { x:r.x + 4, y:r.y + 4, w:r.w - 8, h:S.lblH };
          S.chipY.forEach(cy => { const c = rect(r.x + r.w / 2, cy, S.chipW, S.chipH); if (!(c.x >= r.x + 3 && c.x + c.w <= r.x + r.w - 3 && c.y + c.h <= r.y + r.h - 3)) fail('GAME sort: a chip sticks out of box ' + k); if (hit(c, lbl)) fail('GAME sort: a chip covers the label of box ' + k); });
          noHits(S.chipY.map(cy => rect(0, cy, 10, S.chipH)), 'sort chip rows');
        });
        if (!(S.binX[1] - (S.binX[0] + S.binW) < 2 * S.pad)) fail('GAME sort: neighbouring boxes do not overlap once widened — the nearest-box rule is never exercised');
        /* the drop zones are the DRAWN boxes: every point of the board goes to the box nearest by distance to the drawn box, within pad (codex 第一輪) */
        if (nearestOpen){
          const sb = D.sortBins();
          if (sb.length !== 3 || sb.map(b => b.k).join() !== 'eq,iso,right') fail('GAME sortBins(): three boxes eq, iso, right expected');
          sb.forEach((b, i) => { const r = bins[i]; if (Math.abs(b.cx - (r.x + r.w / 2)) > EPS || Math.abs(b.cy - (r.y + r.h / 2)) > EPS || Math.abs(b.hw - r.w / 2) > EPS || Math.abs(b.hh - r.h / 2) > EPS || b.done) fail('GAME sortBins(): box ' + i + ' is not the drawn box'); });
          const xs = []; for (let x = 0; x <= W; x += 0.5) xs.push(x);
          bins.forEach(r => { [r.x, r.x + r.w].forEach(e => [-S.pad - 0.01, -S.pad + 0.01, -0.01, 0.01, S.pad - 0.01, S.pad + 0.01].forEach(dx => xs.push(e + dx))); });
          for (let i = 0; i + 1 < bins.length; i++){ const m = (bins[i].x + bins[i].w + bins[i + 1].x) / 2; [-0.01, 0, 0.01].forEach(dx => xs.push(m + dx)); }
          const ys = []; for (let y = S.binY - S.pad - 3; y <= S.binY + S.binH + S.pad + 3; y += 0.5) ys.push(y);
          [S.binY, S.binY + S.binH].forEach(e => [-S.pad - 0.01, -S.pad + 0.01, -0.01, 0.01, S.pad - 0.01, S.pad + 0.01].forEach(dy => ys.push(e + dy)));
          let bad = null;
          xs.forEach(x => { if (bad) return; for (const y of ys){
            const ds = bins.map(r => (x >= r.x - S.pad && x <= r.x + r.w + S.pad && y >= r.y - S.pad && y <= r.y + r.h + S.pad) ? Math.hypot(Math.max(0, r.x - x, x - r.x - r.w), Math.max(0, r.y - y, y - r.y - r.h)) : Infinity);
            const m = Math.min(...ds), cand = ds.map((v, i) => v === m ? i : -1).filter(i => i >= 0);
            const want = m === Infinity ? null : (cand.length === 1 ? cand[0] : cand.sort((a, b) => Math.abs(x - bins[a].x - bins[a].w / 2) - Math.abs(x - bins[b].x - bins[b].w / 2))[0]);
            const got = nearestOpen(sb, { x, y }, S.pad);
            if ((got ? got.i : null) !== want){ bad = '(' + x + ', ' + y + ') goes to box ' + (got ? got.i : '-') + ', the nearest drawn box is ' + want; return; }
          } });
          if (bad) fail('GAME sort: a drop at ' + bad);
        }
        needOnce('sort', 'sortRefuse(', 'the card is judged in exactly one place'); needOnce('sort', 'nearestOpen(', 'the box is found in exactly one place');
        need('sort', /var bins = sortBins\(\);/, 'the boxes the cards are dropped into are not sortBins() (the drawn boxes)');
        need('sort', /var bin = nearestOpen\(bins, pt, SORT\.pad\);/, 'the box judged is not the nearest one to where it was dropped');
        need('sort', /var c = P\.data\.c, why = sortRefuse\(c, bin\.k\),/, 'the card is not judged against the box it was dropped in');
        need('sort', /if \(why === 'alsoIso'\)\{ roundNote\(d\.gSortAlso\); return false; \}/, 'the equilateral card in Isosceles is charged (or accepted) instead of a free note');
        need('sort', /if \(done === cards\.length\) roundSolved\(d\.gSortDone\);/, 'the round is not solved exactly when all four cards are in');
        LANGS.forEach(L => {
          const d = I18N[L];
          if (!d.gKinds || ['eq', 'iso', 'right'].some(k => typeof d.gKinds[k] !== 'string' || !d.gKinds[k])) fail('GAME gKinds ' + L + ' missing a box name');
          say('gSortAlso', L, d.gSortAlso, [60]); has('gSortAlso', L, d.gSortAlso, { zh:['正三角形', '等腰三角形', '最精確'], en:['equilateral', 'isosceles', 'most exact'] });
          say('gSortNow', L, d.gSortNow(2, 4), [2, 4]); say('gSortDone', L, d.gSortDone, [180]);
        });
      }

      /* ================= 第 5 關：打出來 ================= */
      {
        if (!(D.GAME_INPUT.length >= 5)) fail('GAME input: only ' + D.GAME_INPUT.length + ' quadrilaterals');
        D.GAME_INPUT.forEach(q => {
          const where = 'GAME input [' + q + ']', k = q[5];
          if (!(k >= 0 && k <= 3 && isInt(k))) fail(where + ': the ? corner must be 0~3');
          const P = D.quadPts(q, D.QUAD.box), Q = quadChecks(where, q, P, D.quadTexts(q, k), D.IN_H);
          if (Q) quadChecks(where + ' (solved)', q, P, D.quadTexts(q, -1), D.IN_H);
          const known = [0, 1, 2, 3].filter(j => j !== k).map(j => q[j]), ans = 360 - known[0] - known[1] - known[2];
          if (D.inKnown(q).join() !== known.join()) fail(where + ': inKnown() should be ' + known);
          if (ans !== q[k]) fail(where + ': the ? angle ' + q[k] + ' is not 360 − ' + known.join(' − '));
          if (known.indexOf(ans) >= 0 && known.filter(x => x === ans).length === 3) fail(where + ': the answer is the same as all three given angles');
          for (let v = 0; v <= 999; v++){
            const r = D.inRefuse(q, v), s = known[0] + known[1] + known[2] + v;
            if ((r === null) !== (v === ans)) { fail(where + ': inRefuse(' + v + ') ' + (r ? 'refuses the answer' : 'takes a wrong number')); break; }
            if (r && (r.s !== s || r.more !== (s > 360))) { fail(where + ': inRefuse(' + v + ') reports ' + JSON.stringify(r)); break; }
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            for (let v = 0; v <= 999; v++){ if (v === ans) continue;
              const s = known[0] + known[1] + known[2] + v, t = d.gInBad(known, v, s, s > 360);
              say('gInBad', L, t, known.concat([v, s, 360, 360, v]), { verify:1 });
              const big = L === 'zh' ? /太大/.test(t) : /too big/.test(t);
              if (big !== (v > ans)) fail('GAME gInBad ' + L + ': ' + v + ' (answer ' + ans + ') is called too ' + (big ? 'big' : 'small'));
            }
            say('gInDone', L, d.gInDone(known, ans), [360].concat(known, [ans, ans]), { verify:1 });
            say('gIn2', L, d.gIn2(known), [2, 360].concat(known));
            say('gInNow', L, d.gInNow(D.quadTexts(q, k)), D.quadTexts(q, k).filter(x => x !== '?').map(x => +x.replace('°', '')));
          });
        });
        /* the input only takes a normally written whole number; everything else is a reminder */
        const OK = { '80':80, ' 80 ':80, '0':0, '125':125, '999':999 }, BAD = ['', ' ', '080', '8 0', '8.5', '80°', '-5', '1e2', 'abc', '1000', '８０', '0x50'];
        Object.keys(OK).forEach(s => { if (D.inParse(s) !== OK[s]) fail('GAME inParse("' + s + '") should be ' + OK[s] + ', got ' + D.inParse(s)); });
        BAD.forEach(s => { if (D.inParse(s) !== null) fail('GAME inParse("' + s + '") should be only a reminder (null), got ' + D.inParse(s)); });
        needOnce('input', 'inRefuse(', 'the number is judged in exactly one place'); needOnce('input', 'inParse(', 'the box is read in exactly one place');
        need('input', /if \(v === null\)\{ roundNote\(d\.gInRemind\); return; \}/, 'an oddly written number is charged instead of a free reminder');
        need('input', /var bad = inRefuse\(q, v\);/, 'the number judged is not the one typed');
        need('input', /inp\.addEventListener\('keydown', function\(ev\)\{ if \(ev\.key === 'Enter'\) check\(\); \}\);/, 'Enter does not check');
        need('input', /inp\.setAttribute\('inputmode', 'numeric'\);/, 'the box does not ask a phone for the number keyboard');
        LANGS.forEach(L => { const d = I18N[L]; say('gInRemind', L, d.gInRemind, [0]); has('gInRemind', L, d.gInRemind, { zh:['整數'], en:['whole number'] }); });
      }
      if (nLbl < 300) fail('GAME labels: only ' + nLbl + ' labels were measured — the label checks are not reaching the drawings');
    }
  }
};
