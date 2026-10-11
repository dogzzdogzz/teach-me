/* grade-5/math/solid 的檢查設定（展開圖工作坊：長方體與正方體的面、稜、頂點，對面，正方體展開圖，表面積）。
   2026-10-11 新增 —— 和小遊戲「摺紙檢查員」改成五關五種玩法（§六之五）同一次寫成；這一課以前沒有設定檔
   （simgen／verify_lesson_data／breaktest 對這一課都跑不起來）。

   sim（review.html 的十個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算，不呼叫頁面的 fmt）、
   選項的形狀與範圍（範圍從各產生器自己的題庫推出來）、解釋裡的算式逐條重算、誘答不抄題幹的數（比數值）。
   netFold 的六種排法用這裡自己的摺紙（三維旋轉面的法向量，不是頁面的「滾骰子」）重新判斷能不能摺。

   data（index.html）：
   - 所有 I18N 靜態字串（含三層題庫）的等號逐個重算；範例 5 的四組長寬高逐條重算，而且算式的顏色和展開圖上那一對面的顏色一樣。
   - 範例 3、4 與速查卡的展開圖：11 種摺得成（兩兩不是同一個形狀轉一轉）、摺不成的都摺不成；三句「為什麼摺不成」各自對得上；
     範例 4 的「規則驗證」說的號碼，在每一張圖上用自己的摺紙算一次。
   - 小遊戲：題庫、版面常數、「收不收、為什麼」的純函式都在 i18n 前面的資料區（從「幾何資料」開始，因為展開圖、摺紙也在那裡）。
     每一關照遊戲自己的規則把題庫的每一題玩一遍，答案用這裡自己的算法重算：
       找稜 —— 自己畫一次 12 條稜（哪三條是虛線），畫板每 0.5px 一點，edgeHit() 和自己的分類（稜／角／交叉／面／空白）一模一樣；
              每一條稜在中心與 ±35% 的地方一定點得到那一條；每一種稜剛好 4 條；所有的說明逐個比數字。
       對面配對 —— 每一張卡（兩個方向）× 每一格，只有和對面全等的收；面積一樣的那一張哪裡都不收，而且說的「面積一樣」真的一樣。
       摺得成嗎 —— 全部 35 種六連方塊自己列出來：11 種摺得成、FOLD_BAD 剛好是另外沒有 2 × 2 的 16 種；每一張在 8 個方向上，
              netOverlap() 塗橘色的兩格自己摺一次真的在同一面；托盤 3000 次：兩張摺得成、兩張摺不成、前兩張不一樣、沒有兩張同形。
       做骰子 —— 六張一直排 4 格的展開圖 × 8 個方向：dieOpp() 和自己的摺紙一樣；提示的口訣在每一張上都成立；
              出題 3000 次：每一對對面剛好畫一個點數、卡片剛好是它們的另一半；每一張卡 × 每一格，只有對面加起來是 7 的收。
       紙板要多大 —— 自己畫一次六個面與標籤；surfJudge() 在 0～2 × 表面積之間每一個整數和自己的分類一樣，每一種錯的數彼此不同。
     nearestOpen()、roundMiss()、missOnce()、roundSolved() 從原始碼切出來真的跑；版面、不出界、不重疊、375px 觸控 ≥ 44px 從資料區讀；
     RENDER 五關與拖拉引擎的函式用 sha1 釘住（多插一行騙得過只掃字面的 need()）。

   已知極限：RENDER 函式本體的規則靠 need() 字面掃描加 sha1 釘住，執行由端對端測試驗；拖拉、點選、兩根手指、capture 遺失、
   真正的字寬、375px 的實際尺寸由 teaching-workspace/game-harness/g5-solid 的端對端測試驗（合成 PointerEvent，從畫出來的圖讀數）。 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(Number); }
const arith = makeArith({ units:['平方公分', '公分', '條', '個', '格', '分', '張', '面', '組'], unitsEn:['cm²', 'square cm', 'cm', 'edges?', 'faces?', 'squares?', 'points', 'pairs?'] });
/* 等號左邊是字（規則、名稱：「表面積 ＝」「總長 ÷ 4 ＝」）的不是宣稱 —— 換成冒號，只驗數的那一段 */
const ruleFix = s => String(s).replace(/([A-Za-z一-鿿])\s*÷\s*\d+\s*[=＝]/g, '$1：').replace(/([^\d\s)])\s*[=＝]/g, '$1：');

/* ---------- 自己的摺紙：每一格帶著一個三維的方向（3 × 3 旋轉），面的法向量 ＝ 第三欄；和頁面的「滾骰子」各寫各的 ---------- */
const mul = (A, B) => A.map(r => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const ROT = { '1,0':[[0, 0, 1], [0, 1, 0], [-1, 0, 0]], '-1,0':[[0, 0, -1], [0, 1, 0], [1, 0, 0]], '0,1':[[1, 0, 0], [0, 0, -1], [0, 1, 0]], '0,-1':[[1, 0, 0], [0, 0, 1], [0, -1, 0]] };
function normals(cells){
  const k = c => c[0] + ',' + c[1], set = new Set(cells.map(k)), Rm = new Map([[k(cells[0]), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]]]), q = [cells[0]];
  while (q.length){
    const c = q.shift();
    for (const d of Object.keys(ROT)){ const [dx, dy] = d.split(',').map(Number), n = [c[0] + dx, c[1] + dy];
      if (!set.has(k(n)) || Rm.has(k(n))) continue; Rm.set(k(n), mul(Rm.get(k(c)), ROT[d])); q.push(n); }
  }
  return cells.map(c => { const m = Rm.get(k(c)); return [m[0][2], m[1][2], m[2][2]].map(v => v + 0).join(','); });
}
const has2x2 = cells => { const s = new Set(cells.map(c => c + '')); return cells.some(c => s.has([c[0] + 1, c[1]] + '') && s.has([c[0], c[1] + 1] + '') && s.has([c[0] + 1, c[1] + 1] + '')); };
const folds = cells => !has2x2(cells) && new Set(normals(cells)).size === 6;
const neg = v => v.split(',').map(x => String(-x + 0)).join(',');
const oppRef = cells => { const n = normals(cells); return n.map(v => n.indexOf(neg(v))); };
const T8 = [c => [c[0], c[1]], c => [-c[1], c[0]], c => [-c[0], -c[1]], c => [c[1], -c[0]], c => [-c[0], c[1]], c => [c[1], c[0]], c => [c[0], -c[1]], c => [-c[1], -c[0]]];
const normCells = cs => { const mx = Math.min(...cs.map(c => c[0])), my = Math.min(...cs.map(c => c[1])); return cs.map(c => [c[0] - mx, c[1] - my]); };
const canon = cs => T8.map(t => normCells(cs.map(t)).map(c => c + '').sort().join(';')).sort()[0];
const connected = cs => { const s = new Set(cs.map(c => c + '')), seen = new Set([cs[0] + '']), q = [cs[0]];
  while (q.length){ const c = q.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => { const n = [c[0] + d[0], c[1] + d[1]] + ''; if (s.has(n) && !seen.has(n)){ seen.add(n); q.push(n.split(',').map(Number)); } }); }
  return seen.size === cs.length; };
/* 全部的六連方塊（轉一轉、翻面算同一種） */
function hexominoes(){
  let cur = new Map([['0,0', [[0, 0]]]]);
  for (let n = 1; n < 6; n++){
    const nx = new Map();
    for (const cs of cur.values()) { const s = new Set(cs.map(c => c + ''));
      cs.forEach(c => [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(d => { const q = [c[0] + d[0], c[1] + d[1]]; if (s.has(q + '')) return; const nc = cs.concat([q]), key = canon(nc); if (!nx.has(key)) nx.set(key, normCells(nc)); })); }
    cur = nx;
  }
  return [...cur.values()];
}
/* 一直排 4 格（自己找）：照排列順序的四個索引 */
const run4 = cells => { for (let i = 0; i < cells.length; i++) for (const d of [[1, 0], [0, 1]]){ const r = [i];
  for (let s = 1; s < 4; s++){ const j = cells.findIndex(c => c[0] === cells[i][0] + d[0] * s && c[1] === cells[i][1] + d[1] * s); if (j < 0) break; r.push(j); }
  if (r.length === 4) return r; } return null; };

/* ---------- 靜態字串的等號：每一個「數的算式 ＝ 數的算式」逐個重算 ---------- */
function chainClaims(text){
  const t = String(text).replace(/<[^>]+>/g, ' ').replace(/(\d)²/g, '($1*$1)').replace(/(\d)\s*(?:平方公分|cm²|公分|cm)/g, '$1')
    .replace(/＋/g, '+').replace(/[－−–]/g, '-').replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/＝/g, '=');
  const out = { claims:[], rules:0 };
  t.split(/[，。；;,\n]|(?:\s—\s)|——|（|）/).forEach(cl => {
    const seg = cl.split('=');
    for (let i = 0; i + 1 < seg.length; i++){
      const L = seg[i].match(/([\d\s+\-*/().]*\d[\d\s+\-*/().]*)$/), R = seg[i + 1].match(/^([\d\s+\-*/().]*\d[\d\s+\-*/().]*)/);
      if (!L || !R) continue;
      let le = L[1].trim(), re = R[1].trim();
      const before = seg[i].slice(0, seg[i].length - L[1].length).trim();
      if (/^[+\-*/]/.test(le) || /[+\-*/]$/.test(before)) { out.rules++; continue; }
      const bal = s => (s.match(/\(/g) || []).length - (s.match(/\)/g) || []).length;
      while (bal(le) < 0) le = le.replace(/^\s*\)/, '').trim();
      while (bal(le) > 0) le = le.replace(/^[^(]*\(/, '').trim();
      while (bal(re) > 0) re = re.replace(/\([^()]*$/, '').trim();
      while (bal(re) < 0) re = re.replace(/\)\s*$/, '').trim();
      if (!le || !re || !/\d/.test(re) || !/\d/.test(le)) continue;
      let a, b;
      try { a = Function('return (' + le + ')')(); b = Function('return (' + re + ')')(); } catch (e){ out.claims.push({ text:le + ' = ' + re, bad:'cannot evaluate' }); continue; }
      out.claims.push({ text:le + ' = ' + re, bad:Math.abs(a - b) > 1e-9 ? 'left is ' + a + ', right is ' + b : null });
    }
  });
  return out;
}

/* review.html netFold 的六種排法，照文字自己畫出來（不讀頁面） */
const REVIEW_NETS = [
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]],          /* 一直排 6 個 */
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],          /* 2 排 3 列 */
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]],          /* 一直排 4 個，最左邊上面一個、最右邊下面一個 */
  [[1, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]],          /* 一直排 4 個，中間偏左上面一個、中間偏右下面一個 */
  [[0, 0], [1, 0], [2, 0], [2, 1], [3, 1], [4, 1]],          /* 兩排各 3 個、只有一格相接的階梯 */
  [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2]]           /* ㄩ 字形（三邊有格子、中間缺一塊） */
];

module.exports = {
  breaks: [
    {"file": "index", "expect": "GAME_ORDER should be", "find": "var GAME_ORDER = ['edge', 'pair', 'fold', 'die', 'surf'];", "replace": "var GAME_ORDER = ['pair', 'edge', 'fold', 'die', 'surf'];"},
    {"file": "index", "expect": "under 44", "find": "  var GPICK = 48;", "replace": "  var GPICK = 40;"},
    {"file": "index", "expect": "shuffle(): only", "find": "      var k = Math.floor(Math.random() * (j + 1));   /* 自足", "replace": "      var k = j;   /* 自足"},
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
    {"file": "index", "expect": "a slide on the board counts as a tap", "find": "if (t.far || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) return;", "replace": "if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 40) return;"},
    {"file": "index", "expect": "placed pieces still catch taps", "find": ".gpiece.locked{cursor:default;pointer-events:none}", "replace": ".gpiece.locked{cursor:default}"},
    {"file": "index", "expect": "the board drawing catches taps", "find": ".gsvg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}", "replace": ".gsvg{position:absolute;left:0;top:0;overflow:visible}"},
    {"file": "index", "expect": "gets a viewBox", "find": "var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, 'aria-hidden':'true' });", "replace": "var s = svgEl('svg', { 'class':'gsvg', width:B.W, height:B.H, viewBox:'0 0 ' + B.W + ' ' + B.H, 'aria-hidden':'true' });"},
    {"file": "index", "expect": "ahead mode no longer", "find": "    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", "replace": "    if (mode === 'ahead'){ hintLevel = 1; }"},
    {"file": "index", "expect": "not disabled after the second level", "find": "    if (hintLevel >= 2) gHintBtn.disabled = true;", "replace": ""},
    {"file": "index", "expect": "missOnce(): wrong A, B", "find": "    if (seen.keys[key]){ seen.last = key; roundAgain(text); return; }", "replace": "    if (seen.keys[key] && seen.last === key) return;"},
    {"file": "index", "expect": "missOnce(): wrong A, B", "find": "    if (seen.keys[key]){ seen.last = key; roundAgain(text); return; }", "replace": "    if (seen.keys[key]){ if (seen.last !== key){ seen.last = key; roundAgain(text); } return; }"},
    {"file": "index", "expect": "roundAgain() must only", "find": "  function roundAgain(text){ gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }", "replace": "  function roundAgain(text){ gMistake = true; gMsg.innerHTML = '<span class=\"no\">' + text + '</span>'; }"},
    {"file": "index", "expect": "roundNote() (a reminder)", "find": "  function roundNote(text){ gMsg.textContent = text; }", "replace": "  function roundNote(text){ gMistake = true; gMsg.textContent = text; }"},
    {"file": "index", "expect": "startRound() can return early", "find": "    var type = GAME_ORDER[gRound];\n    gSolved = false;", "replace": "    var type = GAME_ORDER[gRound];\n    if (gScore === 0 && gRound > 0) return;\n    gSolved = false;"},
    {"file": "index", "expect": "\"Next round\" does not always", "find": "    if (gRound < GAME_ORDER.length - 1){ gRound++; startRound(); }\n  });", "replace": "    if (gRound < GAME_ORDER.length - 1 && gScore > 0){ gRound++; startRound(); }\n  });"},
    {"file": "index", "expect": "GAME pin: RENDER.edge", "find": "        found[e.i] = true;\n", "replace": "        found[e.i] = true;\n        if (cnt(g) === 2 && ph === 1) found[e.i] = false;\n"},
    {"file": "index", "expect": "GAME pin: drawCuboid", "find": "      if (e.hid) ln.setAttribute('stroke-dasharray', '7 5');", "replace": "      if (e.hid && e.g !== 'h') ln.setAttribute('stroke-dasharray', '7 5');"},
    {"file": "index", "expect": "GAME pin: rectCardSvg", "find": "gText(s, g.left.x, g.left.y, g.left.v,", "replace": "gText(s, g.left.x, g.left.y, g.top.v,"},
    {"file": "index", "expect": "tap tolerances look wrong", "find": "var EDGE = { u:24, x0:46, top:16, tol:11,", "replace": "var EDGE = { u:24, x0:46, top:16, tol:6,"},
    {"file": "index", "expect": "edgeHit() disagrees", "find": "      for (var v = 0; v < G.verts.length; v++) if (Math.hypot(pt.x - G.verts[v].x, pt.y - G.verts[v].y) <= EDGE.vr) return { kind:'vertex' };\n", "replace": ""},
    {"file": "index", "expect": "edgeHit() disagrees", "find": "      if (d2 - d1 < EDGE.amb) return { kind:'cross' };\n", "replace": ""},
    {"file": "index", "expect": "edgeHit() disagrees", "find": "    for (var k in G.faces) if (inPoly(pt, G.faces[k])) return { kind:'face' };", "replace": "    for (var k in G.faces) if (k !== 'side' && inPoly(pt, G.faces[k])) return { kind:'face' };"},
    {"file": "index", "expect": "the 12 edges (kind, dashed)", "find": "return q[0] === 0 && q[1] === 0 && q[2] === w; }); });", "replace": "return q[0] === 0 && q[1] === 0 && q[2] === 0; }); });"},
    {"file": "index", "expect": "all different", "find": "var GAME_EDGE = [[6, 4, 3],", "replace": "var GAME_EDGE = [[6, 6, 3],"},
    {"file": "index", "expect": "label w says", "find": "      { k:'w', v:w, x:o.x + (l + w * OBL.dx / 2) * u + EDGE.gap,", "replace": "      { k:'w', v:h, x:o.x + (l + w * OBL.dx / 2) * u + EDGE.gap,"},
    {"file": "index", "expect": "px from an edge", "find": "var EDGE = { u:24, x0:46, top:16, tol:11, vr:6, amb:3, below:20, gap:7,", "replace": "var EDGE = { u:24, x0:46, top:16, tol:11, vr:6, amb:3, below:20, gap:1,"},
    {"file": "index", "expect": "sits nearest a", "find": "      { k:'h', v:h, x:o.x - EDGE.gap, y:o.y - h * u / 2 + 5, a:'end' },", "replace": "      { k:'h', v:h, x:o.x - EDGE.gap, y:o.y + EDGE.below + 6, a:'end' },"},
    {"file": "index", "expect": "the kinds should be found in the order", "find": "  var EDGE_PHASES = ['l', 'w', 'h'];", "replace": "  var EDGE_PHASES = ['l', 'h', 'w'];"},
    {"file": "index", "expect": "edgeMissing(", "find": "    return { n:left.length, hid:left.some(function(e){ return e.hid; }) };", "replace": "    return { n:left.length, hid:false };"},
    {"file": "index", "expect": "gEdgeWrong zh", "find": "return '這一條是' + got + '（' + dir + '的，' + v + ' 公分），不是' + want + '。'; },", "replace": "return '這一條是' + want + '（' + dir + '的，' + v + ' 公分），不是' + got + '。'; },"},
    {"file": "index", "expect": "gEdgeMore en", "find": "'Not yet: some ' + want + ' edges are still untapped' + (hid ? ' — the hidden dashed one counts too.' : '.'); },", "replace": "'Not yet: some ' + want + ' edges are still untapped — the hidden dashed one counts too.'; },"},
    {"file": "index", "expect": "gEdgeDone", "find": "') ＝ ' + (4 * (l + w + h)) + ' 公分。'; },", "replace": "') ＝ ' + (2 * (l + w + h)) + ' 公分。'; },"},
    {"file": "index", "expect": "gDir zh", "find": "gDir:{ l:'左右方向', w:'往後斜', h:'上下方向' },", "replace": "gDir:{ l:'上下方向', w:'往後斜', h:'左右方向' },"},
    {"file": "index", "expect": "an edge of another kind is not refused", "find": "if (e.g !== g){ missOnce(seen, 'e' + e.i, d.gEdgeWrong(", "replace": "if (e.g !== g){ missOnce(seen, 'g' + e.g, d.gEdgeWrong("},
    {"file": "index", "expect": "is not just a reminder", "find": "        if (hit.kind === 'vertex'){ roundNote(d.gEdgeVertex); return; }", "replace": "        if (hit.kind === 'vertex'){ roundMiss(d.gEdgeVertex); return; }"},
    {"file": "index", "expect": "with fewer than 4 is not refused", "find": "        if (n < 4){ var m = edgeMissing(G, g, found);", "replace": "        if (n < 3){ var m = edgeMissing(G, g, found);"},
    {"file": "index", "expect": "tapping a found edge again is judged", "find": "        if (found[e.i]) return;   /* 已經找到的：不動 */\n", "replace": ""},
    {"file": "index", "expect": "gEdge2 zh", "find": "return '還有 ' + n + ' 條' + g + '沒找到' + (hid ? '，其中一條是虛線' : '')", "replace": "return '還有 ' + n + ' 條' + g + '沒找到' + (hid || n > 2 ? '，其中一條是虛線' : '')"},
    {"file": "index", "expect": "the left-over card must have", "find": "var GAME_PAIR = [[6, 3, 4, 6, 2],", "replace": "var GAME_PAIR = [[6, 3, 4, 4, 6],"},
    {"file": "index", "expect": "pairRefuse", "find": "    if (sameRect(want, r)) return null;\n    return { want:want, same:", "replace": "    if (want[0] * want[1] === r[0] * r[1]) return null;\n    return { want:want, same:"},
    {"file": "index", "expect": "pairRefuse reason", "find": "    return { want:want, same:want[0] * want[1] === r[0] * r[1] };", "replace": "    return { want:want, same:want[0] === r[0] || want[1] === r[1] };"},
    {"file": "index", "expect": "the slots should be", "find": "var PAIR_SLOTS = [{ face:'back', opp:'front' }, { face:'bottom', opp:'top' }, { face:'left', opp:'side' }];", "replace": "var PAIR_SLOTS = [{ face:'back', opp:'top' }, { face:'bottom', opp:'front' }, { face:'left', opp:'side' }];"},
    {"file": "index", "expect": "the accept zone is not its label plus its box", "find": "  function pairSlot(s){ return { cx:PAIR.slotX[s], cy:(PAIR.lblY + PAIR.slotY + PAIR.slotH / 2) / 2, hw:PAIR.slotW / 2, hh:(PAIR.slotY + PAIR.slotH / 2 - PAIR.lblY) / 2 }; }", "replace": "  function pairSlot(s){ return { cx:PAIR.slotX[s], cy:PAIR.slotY, hw:PAIR.slotW / 2, hh:PAIR.slotH / 2 }; }"},
    {"file": "index", "expect": "pairCards gave", "find": "    list.push({ r:[e[3], e[4]], face:null });", "replace": "    list.push({ r:pairFace(b, 'top'), face:'top' });"},
    {"file": "index", "expect": "name front", "find": "{ f:'front', x:o.x + (l + w * OBL.dx) * u / 2, y:o.y - (h + w * OBL.dy) * u / 2 + 5, a:'middle' },", "replace": "{ f:'front', x:o.x + l * u / 2, y:o.y - h * u / 2 + 5, a:'middle' },"},
    {"file": "index", "expect": "px from an edge", "find": "      { k:'h', v:h, x:o.x - 9, y:o.y - h * u / 2 + 5, a:'end' },", "replace": "      { k:'h', v:h, x:o.x - 2, y:o.y - h * u / 2 + 5, a:'end' },"},
    {"file": "index", "expect": "a label touches the rectangle", "find": "top:{ v:r[0], x:x + w / 2, y:y - 8 }, left:{ v:r[1], x:x - 8, y:y + h / 2 + 5 } };", "replace": "top:{ v:r[0], x:x + w / 2, y:y - 8 }, left:{ v:r[1], x:x - 1, y:y + h / 2 + 5 } };"},
    {"file": "index", "expect": "within the snap margin of slot", "find": "trayX:[100, 200], trayY:[381, 477], pad:8, font:14,", "replace": "trayX:[100, 200], trayY:[366, 477], pad:8, font:14,"},
    {"file": "index", "expect": "gPairBad zh", "find": "(same ? ' —— 面積一樣是 ' + (got[0] * got[1]) + ' 平方公分也不行，長和寬都要一樣。' : '。'); },", "replace": "(true ? ' —— 面積一樣是 ' + (got[0] * got[1]) + ' 平方公分也不行，長和寬都要一樣。' : '。'); },"},
    {"file": "index", "expect": "gPairBad en", "find": "'. This card is ' + got[0] + ' × ' + got[1] + (same", "replace": "'. This card is ' + got[1] + ' × ' + got[1] + (same"},
    {"file": "index", "expect": "always matches the area of the same face", "find": "[[6, 3, 4, 6, 2], [6, 2, 4, 3, 4], [4, 3, 6, 6, 2], [5, 4, 3, 6, 2], [4, 2, 3, 6, 2]]", "replace": "[[6, 3, 4, 6, 2], [6, 2, 4, 3, 4], [4, 3, 6, 6, 2], [5, 4, 3, 6, 2], [6, 2, 4, 3, 4]]"},
    {"file": "index", "expect": "the same card in the same wrong slot", "find": "missOnce(seen, 'c' + P.data.j + '@' + s.i, d.gPairBad(", "replace": "missOnce(seen, 'c' + P.data.j, d.gPairBad("},
    {"file": "index", "expect": "does not judge the dropped card with pairRefuse", "find": "        var bad = pairRefuse(b, s.i, P.data.r);", "replace": "        var bad = pairRefuse(b, 0, P.data.r);"},
    {"file": "index", "expect": "FOLD_BAD should be exactly", "find": "[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5]]\n  ];", "replace": "[[0,0],[0,1],[1,1],[1,2],[2,2],[2,3]]\n  ];"},
    {"file": "index", "expect": "FOLD_BAD should be exactly", "find": "    [[0,0],[0,1],[0,2],[1,2],[1,3],[2,3]], [[0,0],[0,1],[1,1],[1,2],[0,3],[1,3]],", "replace": "    [[0,0],[0,1],[0,2],[1,2],[1,3],[2,3]], [[0,0],[0,1],[0,2],[1,2],[1,3],[2,3]],"},
    {"file": "index", "expect": "netOrient(", "find": "function(c){ return [-c[1], c[0]]; }, function(c){ return [-c[0], -c[1]]; },", "replace": "function(c){ return [c[1], c[0]]; }, function(c){ return [-c[0], -c[1]]; },"},
    {"file": "index", "expect": "netOverlap", "find": "      if (seen[id] !== undefined) return [seen[id], i];", "replace": "      if (seen[id] !== undefined) return [0, i];"},
    {"file": "index", "expect": "netWide gave", "find": "return s.w >= s.h; });\n    return netOrient(cells, pick(ks));", "replace": "return true; });\n    return netOrient(cells, pick(ks));"},
    {"file": "index", "expect": "the tray layout is not uniform", "find": "    return shuffle(good.map(function(c){ return { cells:netWide(c), ok:true }; }).concat(bad.map(function(c){ return { cells:netWide(c), ok:false }; })));", "replace": "    var t = shuffle(good.map(function(c){ return { cells:netWide(c), ok:true }; }).concat(bad.map(function(c){ return { cells:netWide(c), ok:false }; })));\n    if (t[0].ok === t[1].ok){ var x = t[1]; t[1] = t[2]; t[2] = x; }\n    return t;"},
    {"file": "index", "expect": "card style", "find": "cls:'gcard gnet', node:netCardSvg(c.cells),", "replace": "cls:'gcard gnet' + (c.ok ? ' gshape' : ''), node:netCardSvg(c.cells),"},
    {"file": "index", "expect": "card style", "find": "          label:d.gNetAria(j + 1), data:{ j:j, c:c } });", "replace": "          label:d.gBins[c.ok ? 0 : 1], data:{ j:j, c:c } });"},
    {"file": "index", "expect": "card style", "find": "      gNetAria:function(k){ return '第 ' + k + ' 張展開圖'; },", "replace": "      gNetAria:function(k){ return '第 ' + k + ' 張摺得成的展開圖'; },"},
    {"file": "index", "expect": "foldTray gave", "find": "var good = shuffle(VALID_NETS).slice(0, 2), bad = shuffle(FOLD_BAD).slice(0, 2);", "replace": "var good = shuffle(VALID_NETS).slice(0, 3), bad = shuffle(FOLD_BAD).slice(0, 1);"},
    {"file": "index", "expect": "foldAccept(", "find": "  function foldAccept(card, k){ return (k === 0) === card.ok; }", "replace": "  function foldAccept(card, k){ return k === 0 || !card.ok; }"},
    {"file": "index", "expect": "does not fit its card", "find": "var FOLD = { c:14, cardW:96,", "replace": "var FOLD = { c:16, cardW:96,"},
    {"file": "index", "expect": "does not fit inside the bin below its label", "find": "binY:8, binLblH:48, spotY:[96, 168],", "replace": "binY:8, binLblH:48, spotY:[86, 168],"},
    {"file": "index", "expect": "within the snap margin of bin", "find": "trayX:[76, 224], trayY:[254, 326], pad:8 };", "replace": "trayX:[76, 224], trayY:[244, 326], pad:8 };"},
    {"file": "index", "expect": "the bins should have a gap", "find": "binX:[76, 224], binW:140,", "replace": "binX:[76, 224], binW:148,"},
    {"file": "index", "expect": "gFoldBadNo zh", "find": "gFoldBadNo:'這一張摺不成：塗橘色的兩格摺起來會疊在同一個面上，", "replace": "gFoldBadNo:'這一張摺不成：塗橘色的兩格摺起來會疊在一起，"},
    {"file": "index", "expect": "gFoldBadNo en", "find": "so at least one face of the cube is left uncovered.',", "replace": "so one face of the cube is left uncovered.',"},
    {"file": "index", "expect": "GAME edge: the pool has", "find": "var GAME_EDGE = [[6, 4, 3], [5, 4, 3], [7, 4, 3], [6, 4, 5], [7, 5, 4], [7, 4, 5], [6, 5, 4], [7, 6, 5]];", "replace": "var GAME_EDGE = [[6, 4, 3]];"},
    {"file": "index", "expect": "never turns some card", "find": "    return shuffle(list).map(function(c){ return { r:Math.random() < 0.5 ? c.r.slice() : [c.r[1], c.r[0]], face:c.face }; });", "replace": "    return shuffle(list).map(function(c){ return { r:c.r.slice(), face:c.face }; });"},
    {"file": "index", "expect": "wide turns of", "find": "    return netOrient(cells, pick(ks));", "replace": "    return netOrient(cells, ks[0]);"},
    {"file": "index", "expect": "of the 27 nets", "find": "var good = shuffle(VALID_NETS).slice(0, 2), bad = shuffle(FOLD_BAD).slice(0, 2);", "replace": "var good = shuffle(VALID_NETS.slice(0, 6)).slice(0, 2), bad = shuffle(FOLD_BAD).slice(0, 2);"},
    {"file": "index", "expect": "the drawn dots do not vary enough", "find": "      var side = Math.random() < 0.5 ? p : [p[1], p[0]];", "replace": "      var side = p;"},
    {"file": "index", "expect": "every length must be a whole number", "find": "[4, 2, 5], [5, 5, 5]];", "replace": "[4, 2, 5], [5, 5, 5], [4.5, 3, 2]];"},
    {"file": "index", "expect": "the reason must match the shape", "find": "    { cells:INVALID_NETS[1], ok:false, reasonKey:'foldReasonBlock' },", "replace": "    { cells:INVALID_NETS[1], ok:false, reasonKey:'foldReasonU' },"},
    {"file": "reference", "expect": "INVALID_NETS should be 3", "find": "    [[0,0],[2,0],[0,1],[1,1],[2,1],[0,2]]\n  ];", "replace": "    [[0,0],[2,0],[0,1],[1,1],[2,1]]\n  ];"},
    {"file": "index", "expect": "gFold2 en", "find": "'The glowing net folds into a cube.' : 'The glowing net does not fold", "replace": "'The glowing net folds into a cube: the orange squares fit.' : 'The glowing net does not fold"},
    {"file": "index", "expect": "is not marked with its overlapping squares", "find": "          if (!c.ok) markOverlap(P);\n", "replace": ""},
    {"file": "index", "expect": "the same net in the same wrong bin", "find": "missOnce(seen, 'c' + P.data.j + '@' + bn.i, c.ok", "replace": "roundMiss(c.ok"},
    {"file": "index", "expect": "DIE_NETS should be exactly", "find": "  var DIE_NETS = [5, 6, 7, 8, 9, 10];", "replace": "  var DIE_NETS = [4, 6, 7, 8, 9, 10];"},
    {"file": "index", "expect": "dieOpp", "find": "var id = f[keyOf(c)], want = id % 2 === 0 ? id + 1 : id - 1;", "replace": "var id = f[keyOf(c)], want = id % 2 === 0 ? id + 1 : id + 1;"},
    {"file": "index", "expect": "dieSetup gave", "find": "      pip[side[0]] = n[0];\n      cards.push(n[1]);", "replace": "      pip[side[0]] = n[0];\n      if (k === 2) pip[side[1]] = n[1];\n      cards.push(n[1]);"},
    {"file": "index", "expect": "dieSetup gave", "find": "    var nums = shuffle([[1, 6], [2, 5], [3, 4]]);", "replace": "    var nums = shuffle([[1, 6], [2, 5], [3, 3]]);"},
    {"file": "index", "expect": "dieRefuse(", "find": "var v = S.pip[S.opp[i]]; return v + n === 7 ? null : { v:v }; }", "replace": "var v = S.pip[S.opp[i]]; return v + n >= 7 ? null : { v:v }; }"},
    {"file": "index", "expect": "diePips(", "find": "5:[[a, a], [z, a], [m, m], [a, z], [z, z]],", "replace": "5:[[a, a], [z, a], [a, z], [z, z]],"},
    {"file": "index", "expect": "within the snap margin of a net square", "find": "var DIE = { c:48, top:10, trayY:194,", "replace": "var DIE = { c:48, top:10, trayY:184,"},
    {"file": "index", "expect": "run-of-4 rule", "find": "for (var s = 1; s < 4; s++){ var j = at(cells[i][0] + (k ? 0 : s), cells[i][1] + (k ? s : 0)); if (j < 0) break; run.push(j); }", "replace": "for (var s = 1; s < 4; s++){ var j = at(cells[i][0] + (k ? 0 : s), cells[i][1] + (k ? 2 * s : 0)); if (j < 0) break; run.push(j); }"},
    {"file": "index", "expect": "gDieBad zh", "find": "+ v + ' ＋ ' + n + ' ＝ ' + (v + n) + '，不是 7。' + n + ' 要放在 ' + (7 - n) + ' 的對面。'; },", "replace": "+ v + ' ＋ ' + n + ' ＝ ' + (v + n) + '，不是 7。' + n + ' 要放在 ' + v + ' 的對面。'; },"},
    {"file": "index", "expect": "the same card on the same wrong square", "find": "missOnce(seen, P.data.n + '@' + t.i, d.gDieBad(", "replace": "missOnce(seen, 'n' + P.data.n, d.gDieBad("},
    {"file": "index", "expect": "does not judge with dieRefuse", "find": "        var bad = dieRefuse(S, t.i, P.data.n);", "replace": "        var bad = dieRefuse(S, 0, P.data.n);"},
    {"file": "index", "expect": "two kinds of wrong answer give the same number", "find": "var GAME_SURF = [[5, 3, 2],", "replace": "var GAME_SURF = [[6, 3, 4],"},
    {"file": "index", "expect": "surfJudge(", "find": "    if (v === lw + lh + wh) return { kind:'half' };", "replace": "    if (v === lw + lh) return { kind:'half' };"},
    {"file": "index", "expect": "names the wrong missing pair", "find": "var miss = [['lw', lw], ['lh', lh], ['wh', wh]].filter(", "replace": "var miss = [['lh', lw], ['lw', lh], ['wh', wh]].filter("},
    {"file": "index", "expect": "the six faces are not the ones I draw myself", "find": "{ f:'right', p:'wh', x:o.x + l, y:o.y, w:w, h:h },", "replace": "{ f:'right', p:'wh', x:o.x + l, y:o.y, w:l, h:h },"},
    {"file": "index", "expect": "coloured as the wrong pair", "find": "{ f:'left', p:'wh', x:o.x + 2 * l + w,", "replace": "{ f:'left', p:'lh', x:o.x + 2 * l + w,"},
    {"file": "index", "expect": "px from a face edge", "find": "var SURF = { u:12, top:26, gap:9, pad:10 };", "replace": "var SURF = { u:12, top:26, gap:3, pad:10 };"},
    {"file": "index", "expect": "labels", "find": "      { k:'h', v:b[2], x:o.x - g, y:o.y + h / 2 + 5, a:'end' },", "replace": "      { k:'h', v:b[1], x:o.x - g, y:o.y + h / 2 + 5, a:'end' },"},
    {"file": "index", "expect": "has no cube", "find": "[4, 2, 5], [5, 5, 5]];", "replace": "[4, 2, 5], [5, 5, 4]];"},
    {"file": "index", "expect": "gSurfHalf zh", "find": "return '這只加了 3 個面：' + lw + ' ＋ ' + lh + ' ＋ ' + wh + ' ＝ ' + s3 +", "replace": "return '這只加了 3 個面：' + lw + ' ＋ ' + lh + ' ＋ ' + wh + ' ＝ ' + (s3 + 1) +"},
    {"file": "index", "expect": "gSurfDone en", "find": "'Right! The 6 face areas added together: ' + (b[0] === b[1] && b[1] === b[2] ? '6 × ' + b[0] + ' × ' + b[0] + ' = ' + S", "replace": "'Right! The 6 face areas added together: ' + (b[0] === b[1] && b[1] === b[2] ? '4 × ' + b[0] + ' × ' + b[0] + ' = ' + S"},
    {"file": "index", "expect": "a badly written number is not just a reminder", "find": "        if (!/^(0|[1-9]\\d*)$/.test(t)){ roundNote(d.gSurfEmpty); return; }", "replace": "        if (!/\\d/.test(t)){ roundNote(d.gSurfEmpty); return; }"},
    {"file": "index", "expect": "the same wrong number could be charged twice", "find": "        missOnce(seen, 'v' + v, text);", "replace": "        roundMiss(text);"},
    {"file": "index", "expect": "sumLine zh: the colours", "find": "return '2×(<span class=\"f2\">' + d.l + '×' + d.w + '</span> + <span class=\"f1\">' + d.l + '×' + d.h + '</span> + <span class=\"f3\">' + d.w + '×' + d.h + '</span>)　＝　2×(", "replace": "return '2×(<span class=\"f1\">' + d.l + '×' + d.w + '</span> + <span class=\"f2\">' + d.l + '×' + d.h + '</span> + <span class=\"f3\">' + d.w + '×' + d.h + '</span>)　＝　2×("},
    {"file": "index", "expect": "example 5: the net paints", "find": "surfaceNetHolder.querySelectorAll('.f2').forEach(function(el){ el.style.fill = '#E8871E'; });", "replace": "surfaceNetHolder.querySelectorAll('.f2').forEach(function(el){ el.style.fill = '#3B7DD8'; });"},
    {"file": "index", "expect": "foldReasonLine zh: must say", "find": "foldReasonLine:'一直排 6 個繞一圈之後，第 5、6 格會疊到第 1、2 格上（同一面摺兩次），兩頭卻空著。'", "replace": "foldReasonLine:'一直排 6 個會疊在一起（同一面摺兩次），中間留空。'"},
    {"file": "index", "expect": "example 3: the reason is a string", "find": "var why = item.ok ? d.foldWhyYes : d.foldWhyNo(d[item.reasonKey]);", "replace": "var why = item.ok ? d.foldWhyYes : d.foldWhyNo(d[item.reasonKey]());"},
    {"file": "index", "expect": "example 3: VALID_NETS[0] is marked", "find": "    { cells:VALID_NETS[0], ok:true },", "replace": "    { cells:VALID_NETS[0], ok:false, reasonKey:'foldReasonU' },"},
    {"file": "index", "expect": "pairRuleLine(", "find": "' 號和 ' + p[1][1] + ' 號</strong>；沒有排進那一直排的", "replace": "' 號和 ' + p[2][1] + ' 號</strong>；沒有排進那一直排的"},
    {"file": "index", "expect": "example 4 VALID_NETS", "find": "return [[run[0] + 1, run[2] + 1], [run[1] + 1, run[3] + 1],", "replace": "return [[run[0] + 1, run[1] + 1], [run[2] + 1, run[3] + 1],"},
    {"file": "index", "expect": "VALID_NETS: should be 11", "find": "    [[0,0],[0,1],[1,1],[2,1],[3,1],[3,2]]\n  ];", "replace": "    [[0,0],[0,1],[1,1],[2,1],[3,1],[0,2]]\n  ];"},
    {"file": "index", "expect": "GAME s7lead: the markup fallback", "find": "<p class=\"lead\" data-i18n=\"s7lead\">找稜、", "replace": "<p class=\"lead\" data-i18n=\"s7lead\">找邊、"},
    {"file": "index", "expect": "the game name changed", "find": "s7h2:'The Fold Inspector',", "replace": "s7h2:'The Net Inspector',"},
    {"file": "index", "expect": "is wrong (left is", "find": "= 2×(12+8+6) = 2×26 = 52 平方公分。（24 是體積", "replace": "= 2×(12+8+6) = 2×26 = 54 平方公分。（24 是體積"},
    {"file": "index", "expect": "the \"exactly 11\" claim is gone", "find": "摺不成正方體。恰好能摺成正方體的排法只有 11 種。'", "replace": "摺不成正方體。恰好能摺成正方體的排法只有 12 種。'"},
    {"file": "reference", "expect": "the cheat sheet must say so", "find": "st1:'先找出展開圖裡「一直排（或一直列）4 個」的那一長條 —— 那是繞著正方體一圈的 4 個面。（11 種裡有 5 種排不出 4 個一長條", "replace": "st1:'先找出展開圖裡「一直排（或一直列）4 個」的那一長條 —— 那是繞著正方體一圈的 4 個面。（少數展開圖排不出 4 個一長條"},
    {"file": "reference", "expect": "reference.html: VALID_NETS", "find": "    [[0,0],[0,1],[1,1],[2,1],[3,1],[3,2]]\n  ];", "replace": "    [[0,0],[0,1],[1,1],[2,1],[3,1],[2,1]]\n  ];"},
    {"file": "reference", "expect": "simplified character", "find": "st4:'檢查：", "replace": "st4:'检查："},
    {"file": "review", "expect": "copied straight out of the stem", "find": "    (avoid || []).forEach(function(v){ seen[String(v)] = true; });\n", "replace": ""},
    {"file": "review", "expect": "copied straight out of the stem", "find": "var m = mixOpts(h, [total/4, total/4 - l, total/4 - w], [l, w, total, 12]);", "replace": "var m = mixOpts(h, [total/4, l+w, h+2], [total, 12]);"},
    {"file": "review", "expect": "the why is wrong", "find": "' + d.l + '×' + d.w + ' + ' + d.l + '×' + d.h + ' + ' + d.w + '×' + d.h + ') = 2×(' + d.lw + '+' + d.lh + '+' + d.wh + ') = 2×' + (d.lw+d.lh+d.wh) + ' = ' + d.ans + ' 平方公分。'", "replace": "' + d.l + '×' + d.w + ' + ' + d.l + '×' + d.h + ' + ' + d.w + '×' + d.h + ') = 2×(' + d.lw + '+' + d.lh + '+' + d.wh + ') = 2×' + (d.lw+d.lh+d.wh+1) + ' = ' + d.ans + ' 平方公分。'"},
    {"file": "review", "expect": "opts[ans] != correct", "find": "{ desc:'一直排 4 個，最左邊那格上面接 1 個、最右邊那格下面接 1 個', ok:true,", "replace": "{ desc:'一直排 4 個，最左邊那格上面接 1 個、最右邊那格下面接 1 個', ok:false,"},
    {"file": "review", "expect": "countFact", "find": "var val = { face:6, edge:12, vertex:8 }[kind];", "replace": "var val = { face:6, edge:8, vertex:8 }[kind];"},
    {"file": "review", "expect": "totalEdge: ans", "find": "var sum3 = l+w+h, ans = 4*sum3;", "replace": "var sum3 = l+w+h, ans = 3*sum3;"},
    {"file": "review", "expect": "compareCube", "find": "var a2 = a1 + 1 + rand(3);", "replace": "var a2 = a1 + rand(3);"},
    {"file": "review", "expect": "is not offered", "find": "var m = mixOpts(ans, [l*w*h, lw+lh+wh, ans - 2*Math.min(lw,lh,wh)], [l, w, h]);", "replace": "var m = mixOpts(ans, [ans + 2, lw+lh+wh, ans - 2*Math.min(lw,lh,wh)], [l, w, h]);"},
    {"file": "review", "expect": "is not offered", "find": "var m = mixOpts(ans, [sum3, 2*sum3, ans + 4, ans - 4], [l, w, h, 12]);", "replace": "var m = mixOpts(ans, [2*sum3, ans + 4, ans - 4], [l, w, h, 12]);"},
    {"file": "review", "expect": "outside 1~", "find": "var m = mixOpts(ans, [2*(l+w), l+w, ans + w], [l, w]);", "replace": "var m = mixOpts(ans, [2*(l+w), l+w, ans * 2], [l, w]);"}
  ],

  sim: {
    optCount: { netFold:2, '*':4 },
    INVARIANTS: {
      countFact: d => { if (d.val !== { face:6, edge:12, vertex:8 }[d.kind]) return 'countFact: ' + d.kind + ' should be ' + { face:6, edge:12, vertex:8 }[d.kind]; },
      surfaceCuboid: d => { if (d.ans !== 2 * (d.l * d.w + d.l * d.h + d.w * d.h) || d.lw !== d.l * d.w || d.lh !== d.l * d.h || d.wh !== d.w * d.h) return 'surfaceCuboid: ans != 2(lw + lh + wh)'; },
      surfaceCube: d => { if (d.ans !== 6 * d.a * d.a) return 'surfaceCube: ans != 6a²'; },
      totalEdge: d => { if (d.sum3 !== d.l + d.w + d.h || d.ans !== 4 * d.sum3) return 'totalEdge: ans != 4(l + w + h)'; },
      compareCube: d => { if (!(d.a2 > d.a1) || d.s1 !== 6 * d.a1 * d.a1 || d.s2 !== 6 * d.a2 * d.a2 || d.diff !== d.s2 - d.s1) return 'compareCube: diff != 6a2² − 6a1²'; },
      missingDim: d => { if (d.total !== 4 * (d.l + d.w + d.h)) return 'missingDim: total != 4(l + w + h)'; },
      netFold: d => { if (!(d.idx >= 0 && d.idx < REVIEW_NETS.length)) return 'netFold: idx out of range'; },
      volume: d => { if (d.ans !== d.l * d.w * d.h) return 'volume: ans != l × w × h'; },
      area: d => { if (d.ans !== d.l * d.w) return 'area: ans != l × w'; },
      symmetry: d => { if (d.val !== [4, 2, 3, 5, 6][d.idx]) return 'symmetry: count ' + d.val + ' for shape ' + d.idx; }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'countFact': return String({ face:6, edge:12, vertex:8 }[d.kind]);
        case 'surfaceCuboid': return String(2 * (d.l * d.w + d.l * d.h + d.w * d.h));
        case 'surfaceCube': return String(6 * d.a * d.a);
        case 'totalEdge': return String(4 * (d.l + d.w + d.h));
        case 'compareCube': return String(6 * (d.a2 * d.a2 - d.a1 * d.a1));
        case 'missingDim': return String(d.total / 4 - d.l - d.w);
        case 'netFold': return folds(REVIEW_NETS[d.idx]) ? (lang === 'zh' ? '可以摺成正方體' : 'Folds into a cube') : (lang === 'zh' ? '不能摺成正方體' : 'Does not fold into a cube');
        case 'volume': return String(d.l * d.w * d.h);
        case 'area': return String(d.l * d.w);
        case 'symmetry': return String({ 0:4, 1:2, 2:3, 3:5, 4:6 }[d.idx]);
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (genId === 'netFold') return ['可以摺成正方體', '不能摺成正方體', 'Folds into a cube', 'Does not fold into a cube'].indexOf(s) >= 0 ? undefined : 'option "' + s + '" is not yes/no';
      if (!/^\d+$/.test(s)) return 'option "' + s + '" is not a whole number';
      /* 範圍從各產生器自己的題庫推出來（誘答是體積、少乘一個 2、多一圈……這一類） */
      const MAX = { countFact:14, surfaceCuboid:9 * 8 * 8, surfaceCube:9 * 9 * 9, totalEdge:4 * 25 + 4, compareCube:9 * 9 * 9, missingDim:8 + 7 + 7, volume:8 * 7 * 7 + 8, area:10 * 9 + 9, symmetry:8 }[genId];
      if (!MAX) return 'unknown generator ' + genId;
      const n = +s;
      if (n < 1 || n > MAX) return 'option ' + n + ' outside 1~' + MAX;
    },
    renderCheck: function(d, q, lang, genId){
      if (genId === 'netFold'){
        const ok = folds(REVIEW_NETS[d.idx]);
        if (/摺不成|does not fold/i.test(q.why) === ok && !/就摺不成|does NOT fold/.test(q.why)) return genId + ': the why says the opposite of my own folding for arrangement ' + d.idx;
        return;
      }
      const vals = q.opts.map(Number);
      if (new Set(vals).size !== vals.length) return genId + ': two options have the same value';
      const pr = arith(ruleFix(q.why)).problems;
      if (pr.length) return genId + ': the why is wrong — ' + pr[0];
      /* 這一課點名的迷思誘答一定要在選項裡（除非剛好等於正解或題幹的數 —— 那時才讓位） */
      const stem = (q.stem.match(/\d+/g) || []).map(Number), want = (v, why) => (vals.indexOf(v) >= 0 || v === vals[q.ans] || stem.indexOf(v) >= 0) ? null : genId + ': the misconception distractor ' + v + ' (' + why + ') is not offered';
      if (genId === 'surfaceCuboid') return want(d.l * d.w * d.h, 'the volume') || want(d.lw + d.lh + d.wh, 'only 3 faces');
      if (genId === 'surfaceCube') return want(d.a * d.a * d.a, 'the volume') || want(4 * d.a * d.a, 'only 4 faces');
      if (genId === 'totalEdge') return want(d.sum3, 'l + w + h, forgot × 4');
      if (genId === 'missingDim') return want(d.total / 4, 'forgot to take away length and width');
      if (genId === 'volume') return want(2 * (d.l * d.w + d.l * d.h + d.w * d.h), 'the surface area');
    }
  },

  data: {
    dataStart: '  /* ================= 幾何資料（語言無關） ================= */',
    dataEnd: '  /* ================= 語言字典 ================= */',
    dataReturn: '{VALID_NETS, INVALID_NETS, netSize, foldFaces, keyOf, GAME_ORDER, GW, GPICK, shuffle, pick, OBL, boxPt, boxEdges, boxFaces, segDist, inPoly, ' +
      'EDGE, GAME_EDGE, EDGE_PHASES, edgeOrigin, edgeH, edgeGeo, edgeHit, edgeLabels, edgeMissing, ' +
      'PAIR, PAIR_H, GAME_PAIR, PAIR_SLOTS, pairFace, sameRect, pairOrigin, pairCards, pairRefuse, pairSlot, pairNames, pairLabels, pairCardGeo, ' +
      'FOLD_BAD, NET_T, netOrient, netWide, netOverlap, netRun4, FOLD, FOLD_H, foldTray, foldAccept, foldBin, foldCellXY, ' +
      'DIE_NETS, DIE, DIE_H, dieOpp, dieSetup, dieOrigin, dieCell, dieRefuse, diePips, SURF, GAME_SURF, surfArea, surfOrigin, surfH, surfFaces, surfLabels, surfJudge}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], EPS = 1e-9, W = 300;
      const say = (where, L, text, want) => {
        const s = String(text);
        if (/undefined|NaN|\[object/.test(s)) fail(where + ' ' + L + ': undefined/NaN in "' + s + '"');
        const r = arith(ruleFix(s));
        r.problems.forEach(p => fail(where + ' ' + L + ': ' + p + ' — "' + s + '"'));
        if (L === 'en' && /[一-鿿]/.test(s)) fail(where + ' en: Chinese characters in "' + s + '"');
        if (/\d[ \t](?:cm\b|cm²|公分|平方公分)/.test(s)) fail(where + ' ' + L + ': a number and its unit are separated by a breakable space in "' + s + '"');
        if (L === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(s.replace(/<[^>]+>/g, ''))) fail(where + ' zh: a Chinese character touches a digit in "' + s + '"');
        if (want && nums(s).join() !== want.join()) fail(where + ' ' + L + ': numbers ' + nums(s).join() + ', expected ' + want.join() + ' — "' + s + '"');
        return r.verified;
      };
      const has = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (!(w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0)) fail(where + ' ' + L + ': must say "' + w + '": ' + s); }); };
      const hasNot = (where, L, text, words) => { const s = String(text); (words[L] || []).forEach(w => { if (w instanceof RegExp ? w.test(s) : s.indexOf(w) >= 0) fail(where + ' ' + L + ': must not say "' + w + '": ' + s); }); };
      /* 字的外框（估計）：中文一個字一個字寬，數字與英文 0.62 字寬；上 0.95、下 0.3（量過：14px 的字，畫出來的行框約 17.5px 高） */
      const textBox = (t, size, s) => {
        const w = [...String(s)].reduce((a, ch) => a + (/[一-鿿]/.test(ch) ? size : size * 0.62), 0);
        const x0 = t.a === 'end' ? t.x - w : (t.a === 'middle' ? t.x - w / 2 : t.x);
        return { x0:x0, x1:x0 + w, y0:t.y - size * 0.95, y1:t.y + size * 0.3 };
      };
      const ptSeg = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy, t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2)) : 0; return Math.hypot(p.x - a.x - t * vx, p.y - a.y - t * vy); };
      const crossT = (a, b, c, d) => { const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x); if (Math.abs(den) < 1e-12) return null;
        const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den, u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
        return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { t, x:a.x + t * (b.x - a.x), y:a.y + t * (b.y - a.y) } : null; };
      const segBox = (a, b, B) => {
        const C = [{ x:B.x0, y:B.y0 }, { x:B.x1, y:B.y0 }, { x:B.x1, y:B.y1 }, { x:B.x0, y:B.y1 }], inB = p => p.x >= B.x0 && p.x <= B.x1 && p.y >= B.y0 && p.y <= B.y1;
        if (inB(a) || inB(b)) return 0;
        for (let i = 0; i < 4; i++) if (crossT(a, b, C[i], C[(i + 1) % 4])) return 0;
        return Math.min(...C.map(c => ptSeg(c, a, b)), ...[a, b].map(p => Math.min(...[0, 1, 2, 3].map(i => ptSeg(p, C[i], C[(i + 1) % 4])))));
      };
      const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const hitR = (a, b, m) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > -(m || 0) + EPS && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > -(m || 0) + EPS;
      const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
      const insideB = (o, what, H, m) => { m = m || 0; if (!(o.x >= m - EPS && o.y >= m - EPS && o.x + o.w <= W - m + EPS && o.y + o.h <= H - m + EPS)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board (margin ' + m + '): ' + JSON.stringify(o)); };

      /* --- 0. 等號掃描器自己先證明會響（正反例） --- */
      [['2×(4×3 + 4×2 + 3×2) = 2×(12+8+6) = 2×26 = 52 平方公分', 3, 0], ['2×(4×3 + 4×2 + 3×2) = 2×(12+8+6) = 2×26 = 50', 3, 1], ['6 × 3² = 6 × 9 = 54', 2, 0], ['6 × 3² = 6 × 9 = 56', 2, 1],
       ['4×(6+4+3) = 4×13 = 52 公分', 2, 0], ['96−54=42', 1, 0], ['96−54=24', 1, 1], ['6 ÷ 2 = 3 組', 1, 0], ['表面積 = 2×(長×寬 + 長×高 + 寬×高)', 0, 0]].forEach(([t, n, bad]) => {
        const r = chainClaims(t);
        if (r.claims.length !== n || r.claims.filter(c => c.bad).length !== bad) fail('chainClaims() self-test: "' + t + '" should give ' + n + ' claims, ' + bad + ' wrong — got ' + JSON.stringify(r.claims));
      });
      [['4 × (6 ＋ 4 ＋ 3) ＝ 52 公分', 0], ['4 × (6 ＋ 4 ＋ 3) ＝ 50 公分', 1], ['這只加了 3 個面：15 ＋ 10 ＋ 6 ＝ 31。', 0], ['這只加了 3 個面：15 ＋ 10 ＋ 6 ＝ 30。', 1], ['3 ＋ 5 ＝ 8，不是 7', 0], ['3 + 5 = 9, not 7', 1]].forEach(([t, bad]) => {
        if ((arith(ruleFix(t)).problems.length > 0) !== (bad > 0)) fail('game arithmetic self-test: "' + t + '" should be ' + (bad ? 'wrong' : 'right'));
      });
      /* 自己的摺紙先證明會響：35 種六連方塊、11 種摺得成 */
      const HEX = hexominoes(), HEXV = HEX.filter(folds), HEXT = HEX.filter(c => !has2x2(c) && !folds(c));
      if (HEX.length !== 35 || HEXV.length !== 11 || HEXT.length !== 16 || !HEX.every(connected)) fail('my own folding self-test: ' + HEX.length + ' hexominoes, ' + HEXV.length + ' fold, ' + HEXT.length + ' tree-shaped that do not (want 35 / 11 / 16)');

      /* --- 1. 每一條 I18N 靜態字串（含題庫的題幹與解釋）裡的等號逐個重算 --- */
      const walk = (v, where, out) => {
        if (typeof v === 'string') out.push([where, v]);
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
        else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
        return out;
      };
      let checkedEq = 0;
      LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
        const m = where.match(/^(\w+)\.(qs|qsAdv|qsBoost)\[(\d+)\]\.opts\[(\d+)\]$/);
        if (m && I18N[L][m[2]][+m[3]].ans !== +m[4]) return;
        chainClaims(s).claims.forEach(c => { checkedEq++; if (c.bad) fail(where + ': "' + c.text + '" is wrong (' + c.bad + ')'); });
      }));
      /* 數量釘住（14 條 × 兩種語言）：讀不到會變少，多寫一條也要有人看過 */
      if (checkedEq !== 28) fail(checkedEq + ' equations found in the I18N strings, pinned 28 — the arithmetic scan is not reading them, or a claim was added/removed');
      LANGS.forEach(L => { if (!/11 種|11 arrangements|11 that fold/.test(JSON.stringify(I18N[L].qsBoost))) fail('qsBoost ' + L + ': the "exactly 11" claim is gone'); });

      /* --- 1a. 範例 5：每一組長寬高的算式重算；算式的顏色 ＝ 展開圖上那一對面的顏色 --- */
      {
        let dsn = null;
        try { dsn = new Function(extractFunction(src, 'drawSurfaceNet') + '; return drawSurfaceNet;')(); } catch (e){ fail('cannot run drawSurfaceNet(): ' + e.message); }
        LANGS.forEach(L => I18N[L].dims.forEach(d => {
          const s = I18N[L].sumLine(d), lw = d.l * d.w, lh = d.l * d.h, wh = d.w * d.h, tot = 2 * (lw + lh + wh);
          if (nums(s).join() !== [2, d.l, d.w, d.l, d.h, d.w, d.h, 2, lw, lh, wh, tot].join()) fail('sumLine ' + L + ' ' + JSON.stringify(d) + ': numbers ' + nums(s).join());
          chainClaims(s).claims.forEach(c => { if (c.bad) fail('sumLine ' + L + ': "' + c.text + '" is wrong'); });
          const cls = (s.match(/class="(f\d)"/g) || []).map(x => x.slice(7, 9));
          if (!dsn) return;
          const rects = [...dsn(d).matchAll(/<rect [^>]*class="(f\d)"/g)].map(m => m[1]);   /* 順序：前、右、後、左、上、下 */
          const want = [rects[4], rects[0], rects[1]];   /* 長 × 寬 ＝ 上面、長 × 高 ＝ 前面、寬 × 高 ＝ 右面 */
          if (rects[0] !== rects[2] || rects[1] !== rects[3] || rects[4] !== rects[5] || new Set([rects[0], rects[1], rects[4]]).size !== 3) fail('drawSurfaceNet: opposite faces are not one colour each (' + rects.join() + ')');
          if (cls.join() !== want.join()) fail('sumLine ' + L + ': the colours of l×w, l×h, w×h are ' + cls.join() + ' but the net paints them ' + want.join());
        }));
        const fill = k => (src.match(new RegExp("querySelectorAll\\('\\." + k + "'\\)\\.forEach\\(function\\(el\\)\\{ el\\.style\\.fill = '(#[0-9A-F]+)'")) || [])[1];
        const ink = k => (src.match(new RegExp('\\.sumline \\.' + k + '\\{color:(#[0-9A-F]+)\\}')) || [])[1];
        ['f1', 'f2', 'f3'].forEach(k => { if (!fill(k) || fill(k) !== ink(k)) fail('example 5: the net paints .' + k + ' ' + fill(k) + ' but the sum line writes it ' + ink(k)); });
      }

      /* --- 1b. 範例 3 與速查卡的展開圖、三句「為什麼摺不成」 --- */
      {
        const VC = D.VALID_NETS.map(canon);
        if (D.VALID_NETS.length !== 11 || new Set(VC).size !== 11 || !D.VALID_NETS.every(folds)) fail('VALID_NETS: should be 11 different nets that all fold (my own folding)');
        if (!D.INVALID_NETS.every(c => !folds(c) && c.length === 6 && connected(c))) fail('INVALID_NETS: every one must be 6 joined squares that do not fold');
        const items = [...src.matchAll(/\{ cells:(VALID|INVALID)_NETS\[(\d+)\], ok:(true|false)(?:, reasonKey:'(\w+)')? \}/g)];
        if (items.length < 6) fail('example 3: cannot read FOLD_ITEMS');
        items.forEach(m => {
          const cells = D[m[1] + '_NETS'][+m[2]], ok = m[3] === 'true';
          if (folds(cells) !== ok) fail('example 3: ' + m[1] + '_NETS[' + m[2] + '] is marked ok:' + ok + ' — my own folding says ' + folds(cells));
          if (!ok) LANGS.forEach(L => { if (typeof I18N[L][m[4]] !== 'string') fail('example 3: reason ' + m[4] + ' missing in ' + L); });
          const wantKey = m[1] === 'INVALID' ? ['foldReasonLine', 'foldReasonBlock', 'foldReasonU'][+m[2]] : undefined;
          if (!ok && m[4] !== wantKey) fail('example 3: ' + m[1] + '_NETS[' + m[2] + '] is explained by ' + m[4] + ', want ' + wantKey + ' (the reason must match the shape)');
        });
        if (!/d\.foldWhyNo\(d\[item\.reasonKey\]\)/.test(src) || /d\[item\.reasonKey\]\(\)/.test(src)) fail('example 3: the reason is a string — it must not be called as a function (the verdict would throw)');
        /* 一直排 6 個：第 5、6 格疊到第 1、2 格上，空著的兩面是一對（兩頭） */
        const n0 = normals(D.INVALID_NETS[0]), axes = ['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1'], miss0 = axes.filter(a => n0.indexOf(a) < 0);
        if (n0[4] !== n0[0] || n0[5] !== n0[1] || new Set(n0).size !== 4 || miss0.length !== 2 || neg(miss0[0]) !== miss0[1]) fail('foldReasonLine: a line of 6 does not put squares 5, 6 on 1, 2 with the two ends open (my own folding)');
        if (!has2x2(D.INVALID_NETS[1])) fail('foldReasonBlock: INVALID_NETS[1] has no 2×2 block');
        if (new Set(normals(D.INVALID_NETS[2])).size >= 6) fail('foldReasonU: INVALID_NETS[2] has no two squares on the same face');
        has('foldReasonLine', 'zh', I18N.zh.foldReasonLine, { zh:['第 5、6 格', '第 1、2 格', '兩頭'] }); has('foldReasonLine', 'en', I18N.en.foldReasonLine, { en:['squares 5 and 6', 'squares 1 and 2', 'both ends'] });
        has('foldReasonBlock', 'zh', I18N.zh.foldReasonBlock, { zh:['2×2', '3 個面'] }); has('foldReasonBlock', 'en', I18N.en.foldReasonBlock, { en:['2×2', 'only 3 faces'] });
        /* 速查卡：同樣的 11 ＋ 3 張；「11 種裡有 5 種排不出 4 個一長條」；一直排 4 格的口訣在每一張有 4 格一長條的圖上都成立 */
        /* 跟著被檢查的那一課走（breaktest 會在暫存目錄裡改壞 reference.html） */
        const refPath = path.join(path.dirname(path.resolve(process.argv[2] || '.')), 'reference.html');
        const ref = fs.existsSync(refPath) ? fs.readFileSync(refPath, 'utf8') : '';
        if (!ref) fail('reference.html is missing next to ' + process.argv[2]);
        const arr = name => { const m = ref.match(new RegExp('var ' + name + ' = (\\[[\\s\\S]*?\\]);\\n')); try { return m ? Function('return ' + m[1].replace(/\/\*[\s\S]*?\*\//g, ''))() : null; } catch (e){ return null; } };
        const RV = arr('VALID_NETS'), RI = arr('INVALID_NETS');
        if (!RV || RV.length !== 11 || new Set(RV.map(canon)).size !== 11 || !RV.every(folds) || RV.map(canon).sort().join('|') !== VC.slice().sort().join('|')) fail('reference.html: VALID_NETS is not the same 11 nets that fold');
        if (!RI || RI.length !== 3 || !RI.every(c => c.length === 6 && connected(c) && !folds(c))) fail('reference.html: INVALID_NETS should be 3 joined 6-square nets that do not fold');
        const no4 = HEXV.filter(c => !run4(c)).length;
        if (no4 !== 5 || ref.split('11 種裡有 5 種排不出 4 個一長條').length !== 3 || ref.indexOf('5 of the 11 nets have no run of 4') < 0 || /少數展開圖|A few nets/.test(ref)) fail('reference.html: ' + no4 + ' of the 11 nets have no run of 4 — the cheat sheet must say so');
        HEXV.filter(run4).forEach(c => { const r = run4(c), o = oppRef(c), fl = [0, 1, 2, 3, 4, 5].filter(i => r.indexOf(i) < 0);
          if (o[r[0]] !== r[2] || o[r[1]] !== r[3] || o[fl[0]] !== fl[1]) fail('the run-of-4 rule fails on net ' + JSON.stringify(c)); });
        if (/检/.test(ref)) fail('reference.html: simplified character 检');
      }

      /* --- 1c. 範例 4 的「規則驗證」：說的號碼在每一張圖上都真的是對面 --- */
      {
        const pool = (src.match(/var PAIR_NET_POOL = (\[[^;\n]*\]);/) || [''])[0].match(/VALID_NETS\[(\d+)\]/g) || [];
        let nrp = null;
        try { nrp = new Function('netRun4', extractFunction(src, 'netRulePairs') + '; return netRulePairs;')(D.netRun4); } catch (e){ fail('cannot run netRulePairs(): ' + e.message); }
        if (pool.length !== 4) fail('example 4: cannot read PAIR_NET_POOL');
        if (!/d\.pairRuleLine\(netRulePairs\(s\.cells\)\)/.test(src)) fail('example 4: the rule line is not built from this net\'s own numbers');
        if (nrp) pool.forEach(p => {
          const cells = D.VALID_NETS[+p.match(/\d+/)[0]], pr = nrp(cells), o = oppRef(cells);
          if (!run4(cells)) fail('example 4: ' + p + ' has no straight run of 4 — the rule does not apply');
          pr.forEach(q => { if (o[q[0] - 1] !== q[1] - 1) fail('example 4 ' + p + ': squares ' + q.join(' & ') + ' are not opposite (my own folding)'); });
          if (new Set([].concat(...pr)).size !== 6) fail('example 4 ' + p + ': the three pairs do not cover all six squares');
          LANGS.forEach(L => say('pairRuleLine(' + p + ')', L, I18N[L].pairRuleLine(pr), [4].concat(pr[0], pr[1], [2], pr[2])));
        });
      }

      /* --- 1d. 遊戲的開場白：頁面上的備用字和中文字典是同一句；名字不變（parents.html 用它當精熟標準） --- */
      {
        const m = src.match(/<p class="lead" data-i18n="s7lead">([\s\S]*?)<\/p>/);
        if (!m || m[1] !== I18N.zh.s7lead) fail('GAME s7lead: the markup fallback is not the same sentence as the zh dictionary');
        if (I18N.zh.s7h2 !== '摺紙檢查員' || I18N.en.s7h2 !== 'The Fold Inspector') fail('GAME: the game name changed — parents.html still calls it 摺紙檢查員 / The Fold Inspector');
        LANGS.forEach(L => has('s7lead', L, I18N[L].s7lead, { zh:['6 個面、12 條稜、8 個頂點'], en:['6 faces, 12 edges, 8 vertices'] }));
      }

      /* ================= 2. 小遊戲 ================= */
      const gs = src.indexOf('  /* ===================== 小遊戲：摺紙檢查員');
      const ge = src.indexOf('  /* ================= 語言切換', gs);
      if (gs < 0 || ge < 0){ fail('GAME: cannot find the game section in index.html'); return; }
      const gsrc = src.slice(gs, ge);
      if (D.GW !== W) fail('GAME: the board width GW should be ' + W);
      tooSmall('GPICK', D.GPICK);
      const TYPES = ['edge', 'pair', 'fold', 'die', 'surf'];
      if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, 5), got ' + D.GAME_ORDER);
      const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const RB = {};
      const HINT_SEM = {
        edge: { zh:['左右方向', '往後斜', '上下方向', '虛線'], en:['left–right', 'slant backwards', 'up–down', 'dashed'] },
        pair: { zh:['全等', '後面和前面', '下面和上面', '左面和右面', '面積一樣還不夠'], en:['congruent', 'back and front', 'bottom and top', 'left and right', 'the same area is not enough'] },
        fold: { zh:['一直排', '中間隔一格的兩格是對面', '摺到同一個面'], en:['straight run', 'one square between them end up opposite', 'same face'] },
        die: { zh:['一直排 4 格', '中間隔一格的兩格是對面', '不在那一直排的兩格也是一對', '加起來是 7'], en:['straight run of 4', 'one square between them are opposite', 'outside that run are a pair too', 'add up to 7'] },
        surf: { zh:['6 個面', '2 × (長 × 寬 ＋ 長 × 高 ＋ 寬 × 高)'], en:['six face areas', '2 × (length × width + length × height + width × height)'] }
      };
      TYPES.forEach(t => {
        RB[t] = body(t);
        if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
        LANGS.forEach(L => {
          const a = I18N[L].gAsks && I18N[L].gAsks[t], h = I18N[L].gHints && I18N[L].gHints[t];
          if (typeof a !== 'string' || !a) fail('GAME: gAsks.' + t + ' missing in ' + L); else say('gAsks.' + t, L, a);
          if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
          else { say('gHints.' + t, L, h); has('gHints.' + t, L, h, { [L]:HINT_SEM[t][L] }); }
        });
      });
      LANGS.forEach(L => {
        has('gAsks.edge', L, I18N[L].gAsks.edge, { zh:['兩個面交界', '虛線', '公分'], en:['two faces meet', 'dashed', 'cm'] });
        has('gAsks.pair', L, I18N[L].gAsks.pair, { zh:['一模一樣', '公分', '有一張用不到'], en:['exactly like', 'cm', 'one card is left over'] });
        has('gAsks.die', L, I18N[L].gAsks.die, { zh:['加起來是 7'], en:['add up to 7'] });
        has('gAsks.surf', L, I18N[L].gAsks.surf, { zh:['平方公分', '表面積', '公分'], en:['cm²', 'surface area', 'cm'] });
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
      need(null, /if \(t\.far \|\| Math\.hypot\(e\.clientX - t\.x, e\.clientY - t\.y\) > 10\) return;/, 'a slide on the board counts as a tap');
      need(null, /elHint\.textContent = '';   \/\* 過關了/, 'solving a round does not clear the hint');
      need(null, /querySelectorAll\('\.sel, \.gglow'\)/, 'solving a round does not clear the hint glow');
      if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(src)) fail('GAME: placed pieces still catch taps (pointer-events)');
      if (!/\.gsvg\{[^}]*pointer-events:none/.test(src)) fail('GAME: the board drawing catches taps (pointer-events)');
      { const g = extractFunction(gsrc, 'gSvg'); if (!g || /viewBox/.test(g.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME: the board SVG gets a viewBox — the drawing would no longer match the hit zones'); }
      ['pair', 'fold', 'die'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
      /* 不可以從外觀猜答案：拿得起來的東西，樣式只能看畫的是什麼（邊長、格子、點數），不能看收不收（BRIEF「No visual give-away」） */
      need('pair', /cls:'gcard gshape', node:rectCardSvg\(c\.r\),\n {10}label:c\.r\[0\] \+ ' × ' \+ c\.r\[1\], data:/, 'card style: a pair card\'s class / drawing / label depends on more than its sides');
      need('fold', /cls:'gcard gnet', node:netCardSvg\(c\.cells\),\n {10}label:d\.gNetAria\(j \+ 1\), data:/, 'card style: a net card\'s class / drawing / aria-label depends on more than its squares (aria must not say whether it folds)');
      need('die', /cls:'gdie', node:pipSvg\(n\), label:String\(n\), data:/, 'card style: a dot card\'s class / drawing / label depends on more than its number');
      [['rectCardSvg', 'r'], ['netCardSvg', 'cells'], ['pipSvg', 'n']].forEach(([fn, arg]) => { const s = extractFunction(gsrc, fn) || '';
        if (!new RegExp('^function ' + fn + '\\(' + arg + '\\)\\{').test(s) || /\bok\b|face|opp|data\./.test(s)) fail('GAME card style: ' + fn + ' must draw from (' + arg + ') only'); });
      LANGS.forEach(L => { for (let k = 1; k <= 4; k++){ const a = I18N[L].gNetAria(k); if (/✅|❌|fold|摺/.test(a) || nums(a).join() !== String(k)) fail('GAME card style: the net aria-label says more than its number: ' + a); } });
      need('edge', /var hit = edgeHit\(G, pt\), g = EDGE_PHASES\[ph\];/, 'the edge round does not classify the tap with edgeHit');
      need('edge', /if \(hit\.kind === 'vertex'\)\{ roundNote\(d\.gEdgeVertex\); return; \}\n {8}if \(hit\.kind === 'cross'\)\{ roundNote\(d\.gEdgeCross\); return; \}\n {8}if \(hit\.kind === 'face'\)\{ roundNote\(d\.gEdgeFace\); return; \}/, 'a corner / crossing / face tap is not just a reminder');
      need('edge', /if \(found\[e\.i\]\) return;/, 'tapping a found edge again is judged');
      need('edge', /if \(e\.g !== g\)\{ missOnce\(seen, 'e' \+ e\.i, d\.gEdgeWrong\(d\.gGroup\[e\.g\], d\.gDir\[e\.g\], dimOf\(e\.g\), d\.gGroup\[g\]\)\); return; \}/, 'an edge of another kind is not refused with its own kind and length');
      need('edge', /if \(n < 4\)\{ var m = edgeMissing\(G, g, found\); missOnce\(seen, 'more' \+ g \+ n, d\.gEdgeMore\(d\.gGroup\[g\], m\.hid\)\); return; \}/, '"found them all" with fewer than 4 is not refused (once per count)');
      need('pair', /var s = nearestOpen\(slots, pt, PAIR\.pad\);/, 'the pair round does not pick the nearest open slot');
      need('pair', /var bad = pairRefuse\(b, s\.i, P\.data\.r\);/, 'the pair round does not judge the dropped card with pairRefuse');
      need('pair', /missOnce\(seen, 'c' \+ P\.data\.j \+ '@' \+ s\.i, /, 'the same card in the same wrong slot could be charged twice');
      need('fold', /var bn = nearestOpen\(bins, pt, FOLD\.pad\);/, 'the fold round does not pick the nearest bin');
      need('fold', /if \(!foldAccept\(c, bn\.i\)\)\{/, 'the fold round does not judge with foldAccept');
      need('fold', /missOnce\(seen, 'c' \+ P\.data\.j \+ '@' \+ bn\.i, /, 'the same net in the same wrong bin could be charged twice');
      need('fold', /if \(!c\.ok\) markOverlap\(P\);/, 'a net that does not fold is not marked with its overlapping squares');
      need('die', /var t = nearestOpen\(cells, pt, DIE\.pad\);/, 'the die round does not pick the nearest open square');
      need('die', /var bad = dieRefuse\(S, t\.i, P\.data\.n\);/, 'the die round does not judge with dieRefuse');
      need('die', /missOnce\(seen, P\.data\.n \+ '@' \+ t\.i, /, 'the same card on the same wrong square could be charged twice');
      need('surf', /if \(!\/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(t\)\)\{ roundNote\(d\.gSurfEmpty\); return; \}/, 'a badly written number is not just a reminder');
      need('surf', /var v = \+t, j = surfJudge\(b, v\);/, 'the surface round does not judge the typed number with surfJudge');
      need('surf', /missOnce\(seen, 'v' \+ v, text\);/, 'the same wrong number could be charged twice');
      { const sr = extractFunction(gsrc, 'startRound') || 'return';
        if (/\breturn\b/.test(sr.replace(/\/\*[\s\S]*?\*\//g, ''))) fail('GAME startRound() can return early — the game must never stop (no game over at 0 points)'); }
      { const nx = (gsrc.match(/gNext\.addEventListener\('click', function\(\)\{([\s\S]*?)\n {2}\}\);/) || [])[1] || '';
        if (!/if \(gRound < GAME_ORDER\.length - 1\)\{ gRound\+\+; startRound\(\); \}/.test(nx) || /gScore/.test(nx)) fail('GAME: "Next round" does not always go on to the next round (whatever the score)'); }
      /* 判斷與拖拉的程式碼釘住（sha1）：任何改動都要先重跑 teaching-workspace/game-harness/g5-solid 的 e2e，再把這裡的 sha1 換成新的（setpins.py）。 */
      {
        const sha = t => crypto.createHash('sha1').update(t).digest('hex').slice(0, 12);
        const PINS = { 'RENDER.edge':'9949b2cad494', 'RENDER.pair':'db131b4f59d4', 'RENDER.fold':'46586fbdfee7', 'RENDER.die':'9f9a3a65f214', 'RENDER.surf':'6a0a77a22745', 'addPiece':'2139daab2f38', 'useTapSelect':'bab2d6af337c', 'makeBoard':'59e9a1067ac1', 'nearestOpen':'811050d7b598', 'roundSolved':'52e7ba85251c', 'roundMiss':'f98f520e7645', 'missOnce':'8cbc9e420dca', 'roundNote':'34a9fdcd9aa5', 'startRound':'ea4f212201a1', 'showHint':'f6099d6d682d', 'drawCuboid':'1b52e49dc696', 'rectCardSvg':'c1c5f3a2fd29', 'netCardSvg':'c085d45de282', 'pipSvg':'e9064f3a93df' };
        Object.keys(PINS).forEach(k => {
          const t = k.indexOf('RENDER.') === 0 ? RB[k.slice(7)] : extractFunction(gsrc, k);
          const h = t ? sha(t) : 'missing';
          if (h !== PINS[k]) fail('GAME pin: ' + k + ' changed since the e2e verified it (sha1 ' + h + ', pinned ' + PINS[k] + ') — re-run the e2e, then update PINS');
        });
        if (Object.keys(PINS).length < 16) fail('GAME pin: only ' + Object.keys(PINS).length + ' functions pinned');
      }

      /* --- 切出來真的跑：nearestOpen、roundMiss、missOnce、roundSolved、roundAgain、shuffle --- */
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
      const sweep = (what, list, pad, H, step) => {
        if (!nearestOpen) return;
        let n = 0, bad = 0, first = null;
        for (let k = -1; k < list.length; k++){
          const L2 = list.map((b, i) => Object.assign({}, b, { i:i, done:i === k || !!b.done }));
          for (let x = 0; x <= W; x += step || 0.5) for (let y = 0; y <= H; y += step || 0.5){
            const a = nearestOpen(L2, { x, y }, pad), b = nearestRef(L2, { x, y }, pad); n++;
            if ((a && a.i) !== (b && b.i) || (!a) !== (!b)){ bad++; if (!first) first = [x, y, a && a.i, b && b.i, k]; }
          }
        }
        if (bad) fail('GAME ' + what + ': nearestOpen() disagrees with the nearest box at ' + bad + ' of ' + n + ' points, first ' + JSON.stringify(first));
        let overlap = 0, pairs = 0;
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++){ const a = list[i], b = list[j], gx = Math.abs(a.cx - b.cx) - a.hw - b.hw, gy = Math.abs(a.cy - b.cy) - a.hh - b.hh;
          if (gx < 1e-9 && gy < 1e-9 && Math.max(gx, gy) > -1e-9){ pairs++; } if (Math.max(gx, gy) < 2 * pad && Math.max(gx, gy) >= -1e-9) overlap++; }
        if (!overlap) fail('GAME ' + what + ': no two neighbouring targets overlap in their snap margins — the nearest-target rule is never tested');
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
          if (log !== undefined && log !== '@A miss:A @B miss:B @A again:A @A again:A @B again:B @B again:B') fail('GAME missOnce(): wrong A, B, A, A, B, B should be charged twice and show the reason again every time — got "' + log + '"');
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
        const ra = extractFunction(gsrc, 'roundAgain');
        if (!ra || /gScore|gMistake/.test(ra)) fail('GAME roundAgain() must only show the reason again — it touches the score or the mistake flag');
        const rn = extractFunction(gsrc, 'roundNote');
        if (!rn || /gScore|gMistake|class="no"/.test(rn)) fail('GAME roundNote() (a reminder) must not touch the score, the mistake flag, or look like a mistake');
      }
      {
        const seen = {};
        for (let i = 0; i < 3000; i++){ const t = D.shuffle([0, 1, 2, 3]); seen[t.join('')] = 1; if (t.slice().sort().join() !== '0,1,2,3') { fail('GAME shuffle(): lost or duplicated an item'); break; } }
        if (Object.keys(seen).length < 24) fail('GAME shuffle(): only ' + Object.keys(seen).length + ' of the 24 orders of four items appeared in 3000 runs');
      }
      if (D.OBL.dx !== 0.4 || D.OBL.dy !== 0.3) fail('GAME: the oblique projection changed (' + JSON.stringify(D.OBL) + ')');

      /* ================= 第 1 關：找稜 ================= */
      {
        const E = D.EDGE, u = E.u, seenE = new Set();
        if (!Array.isArray(D.GAME_EDGE) || D.GAME_EDGE.length < 6) fail('GAME edge: the pool has ' + (D.GAME_EDGE || []).length + ' boxes (want at least 6)');
        if (!(E.vr < E.tol && E.amb > 0 && E.tol >= 8)) fail('GAME edge: tap tolerances look wrong ' + JSON.stringify(E));
        D.GAME_EDGE.forEach(b => {
          const tag = 'edge ' + b.join('×'), [l, w, h] = b, H = D.edgeH(b);
          if (seenE.has(b + '')) fail('GAME ' + tag + ': duplicated in the pool'); seenE.add(b + '');
          if (!(l !== w && w !== h && l !== h) || !b.every(v => isInt(v) && v >= 3 && v <= 8)) fail('GAME ' + tag + ': length, width and height must be whole, 3–8 and all different (the three kinds of edge must differ)');
          /* 自己畫：原點在左下前角；往後的方向是右上；看不到的是「左下後」那一個頂點 */
          const o = { x:E.x0, y:E.top + (h + w * 0.3) * u }, P = (x, y, z) => ({ x:o.x + (x + 0.4 * z) * u, y:o.y - (y + 0.3 * z) * u });
          const mine = [];
          [[0, 0], [0, h], [w, 0], [w, h]].forEach(p => mine.push({ g:'l', a:P(0, p[1], p[0]), b:P(l, p[1], p[0]), hid:p[0] === w && p[1] === 0 }));
          [[0, 0], [0, h], [l, 0], [l, h]].forEach(p => mine.push({ g:'w', a:P(p[0], p[1], 0), b:P(p[0], p[1], w), hid:p[0] === 0 && p[1] === 0 }));
          [[0, 0], [0, w], [l, 0], [l, w]].forEach(p => mine.push({ g:'h', a:P(p[0], 0, p[1]), b:P(p[0], h, p[1]), hid:p[0] === 0 && p[1] === w }));
          const G = D.edgeGeo(b), key = e => [e.a || e.p, e.b || e.q].map(q => q.x.toFixed(3) + ',' + q.y.toFixed(3)).sort().join('|');
          const mk = new Map(mine.map(e => [key(e), e]));
          if (G.edges.length !== 12 || !G.edges.every(e => { const m = mk.get(key(e)); return m && m.g === e.g && m.hid === e.hid; })) fail('GAME ' + tag + ': the 12 edges (kind, dashed) are not the ones I draw myself');
          if (mine.filter(e => e.hid).length !== 3 || ['l', 'w', 'h'].some(g => mine.filter(e => e.g === g && e.hid).length !== 1)) fail('GAME ' + tag + ': there should be one hidden edge of each kind');
          /* 方向的字是真的：長是左右、高是上下、寬往右上斜 */
          mine.forEach(e => { const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y; if (e.g === 'l' ? !(Math.abs(dy) < EPS && dx > 0) : e.g === 'h' ? !(Math.abs(dx) < EPS && dy < 0) : !(dx > 0 && dy < 0)) fail('GAME ' + tag + ': a ' + e.g + ' edge does not run the way gDir says'); });
          const verts = []; [0, l].forEach(x => [0, h].forEach(y => [0, w].forEach(z => verts.push(P(x, y, z)))));
          verts.forEach(v => { if (v.x < E.tol || v.y < E.tol || v.x > W - E.tol || v.y > H - E.tol) fail('GAME ' + tag + ': a corner is closer than the tap tolerance to the board edge'); });
          /* 標籤：數字是那一個邊長，離每一條稜 ≥ 2px（線寬 3），在畫板裡，而且最靠近自己那一種的稜 */
          D.edgeLabels(b).forEach(t => {
            if (t.v !== { l:l, w:w, h:h }[t.k]) fail('GAME ' + tag + ': label ' + t.k + ' says ' + t.v);
            const bx = textBox(t, E.font, String(t.v));
            if (bx.x0 < 2 || bx.y0 < 2 || bx.x1 > W - 2 || bx.y1 > H - 2) fail('GAME ' + tag + ': label ' + t.k + ' is not inside the board');
            const ds = mine.map(e => segBox(e.a, e.b, bx) - 1.5);
            if (Math.min(...ds) < 2) fail('GAME ' + tag + ': label ' + t.k + ' is ' + Math.min(...ds).toFixed(1) + 'px from an edge');
            if (mine[ds.indexOf(Math.min(...ds))].g !== t.k) fail('GAME ' + tag + ': label ' + t.k + ' sits nearest a ' + mine[ds.indexOf(Math.min(...ds))].g + ' edge, not its own');
          });
          /* edgeHit() 和自己的分類，整片每 0.5px */
          const faces = { front:[P(0, 0, 0), P(l, 0, 0), P(l, h, 0), P(0, h, 0)], top:[P(0, h, 0), P(l, h, 0), P(l, h, w), P(0, h, w)], side:[P(l, 0, 0), P(l, 0, w), P(l, h, w), P(l, h, 0)] };
          const inP = (p, q) => { let c = false; for (let i = 0, j = q.length - 1; i < q.length; j = i++) if ((q[i].y > p.y) !== (q[j].y > p.y) && p.x < (q[j].x - q[i].x) * (p.y - q[i].y) / (q[j].y - q[i].y) + q[i].x) c = !c; return c; };
          const idx = new Map(G.edges.map(e => [key(e), e.i])), mineIdx = mine.map(e => idx.get(key(e)));
          const ref = p => {
            let a1 = Infinity, a2 = Infinity, ai = -1;
            for (let i = 0; i < mine.length; i++){ const dd = ptSeg(p, mine[i].a, mine[i].b); if (dd < a1){ a2 = a1; a1 = dd; ai = i; } else if (dd < a2) a2 = dd; }
            if (a1 <= E.tol){
              if (verts.some(v => Math.hypot(p.x - v.x, p.y - v.y) <= E.vr)) return 'vertex';
              if (a2 - a1 < E.amb) return 'cross';
              return 'edge' + mineIdx[ai];
            }
            return Object.keys(faces).some(k => inP(p, faces[k])) ? 'face' : 'blank';
          };
          /* 剛好落在門檻上（差不到 1e-6）的點，兩種浮點算法可能各說各的 —— 不算 */
          const onBoundary = p => { const ds = mine.map(e => ptSeg(p, e.a, e.b)).sort((a, c) => a - c), near = x => Math.abs(x) < 1e-6;
            return near(ds[0] - E.tol) || near(ds[1] - ds[0] - E.amb) || verts.some(v => near(Math.hypot(p.x - v.x, p.y - v.y) - E.vr)) || Object.values(faces).some(q => q.some((a, i) => near(ptSeg(p, a, q[(i + 1) % q.length])))); };
          let bad = 0, first = null; const kinds = {};
          for (let x = 0; x <= W; x += 0.5) for (let y = 0; y <= H; y += 0.5){
            const p = { x, y }, r = D.edgeHit(G, p), a = r.kind === 'edge' ? 'edge' + r.i : r.kind, c = ref(p);
            kinds[c] = (kinds[c] || 0) + 1;
            if (a !== c && !onBoundary(p)){ bad++; if (!first) first = [x, y, a, c]; }
          }
          if (bad) fail('GAME ' + tag + ': edgeHit() disagrees with my own classification at ' + bad + ' points, first ' + JSON.stringify(first));
          if (!kinds.vertex || !kinds.cross || !kinds.face || !kinds.blank || G.edges.some(e => !kinds['edge' + e.i])) fail('GAME ' + tag + ': some kind of tap never happens on the board ' + JSON.stringify(Object.keys(kinds).length));
          /* 自然的點法：每一條稜的中心與 ±35%，連往旁邊 6px，都點到那一條 */
          G.edges.forEach(e => { [0.15, 0.5, 0.85].forEach(t => { const p = { x:e.p.x + t * (e.q.x - e.p.x), y:e.p.y + t * (e.q.y - e.p.y) }, len = Math.hypot(e.q.x - e.p.x, e.q.y - e.p.y), nx = -(e.q.y - e.p.y) / len, ny = (e.q.x - e.p.x) / len;
            (t === 0.5 ? [0, 6, -6] : [0]).forEach(s => { const q = { x:p.x + nx * s, y:p.y + ny * s }, r = D.edgeHit(G, q); if (s === 0 ? !(r.kind === 'edge' && r.i === e.i) : (r.kind === 'edge' && r.i !== e.i)) fail('GAME ' + tag + ': a tap at ' + t + ' of edge ' + e.i + (s ? ' (' + s + 'px aside)' : '') + ' gives ' + JSON.stringify(r)); }); }); });
          /* 虛線和實線交叉的地方：只提醒 */
          let crosses = 0;
          mine.filter(e => e.hid).forEach(dh => mine.filter(e => !e.hid).forEach(s => { const c = crossT(dh.a, dh.b, s.a, s.b); if (c && c.t > 0.01 && c.t < 0.99){ crosses++; if (D.edgeHit(G, c).kind !== 'cross') fail('GAME ' + tag + ': the crossing at ' + c.x.toFixed(1) + ',' + c.y.toFixed(1) + ' is not "cross"'); } }));
          if (crosses < 1) fail('GAME ' + tag + ': no dashed edge crosses a solid one — the crossing reminder is never tested');
          /* 一種一種找：還差幾條、有沒有虛線 */
          D.EDGE_PHASES.forEach(g => {
            const list = G.edges.filter(e => e.g === g), found = {};
            if (list.length !== 4) fail('GAME ' + tag + ': ' + list.length + ' edges of kind ' + g);
            list.sort((a, c) => a.hid - c.hid).forEach((e, k) => { const m = D.edgeMissing(G, g, found); if (m.n !== 4 - k || m.hid !== list.slice(k).some(q => q.hid)) fail('GAME ' + tag + ' edgeMissing(' + g + ') after ' + k + ': ' + JSON.stringify(m)); found[e.i] = true; });
            if (D.edgeMissing(G, g, found).n !== 0) fail('GAME ' + tag + ': all 4 found but edgeMissing still counts some');
          });
          if (D.EDGE_PHASES.join() !== 'l,w,h') fail('GAME edge: the kinds should be found in the order length, width, height');
          LANGS.forEach(L => {
            const d = I18N[L], dims = { l:l, w:w, h:h };
            ['l', 'w', 'h'].forEach(g => {
              for (let k = 0; k <= 4; k++) say(tag + ' gEdgeNow', L, d.gEdgeNow(d.gGroup[g], dims[g], k), [dims[g], k]);
              ['l', 'w', 'h'].filter(g2 => g2 !== g).forEach(g2 => { const s = d.gEdgeWrong(d.gGroup[g2], d.gDir[g2], dims[g2], d.gGroup[g]); say(tag + ' gEdgeWrong', L, s, [dims[g2]]); if ((L === 'zh' ? s.indexOf('這一條是' + d.gGroup[g2]) < 0 || s.indexOf('不是' + d.gGroup[g]) < 0 : s.indexOf('is a ' + d.gGroup[g2] + ' edge') < 0 || s.indexOf('not a ' + d.gGroup[g] + ' edge') < 0) || s.indexOf(d.gDir[g2]) < 0) fail('GAME ' + tag + ' gEdgeWrong ' + L + ': does not name both kinds and the direction: ' + s); });
            });
            say(tag + ' gEdgeDone', L, d.gEdgeDone(l, w, h), [4, 4, 4, 12, 12, 4, l, w, h, 4 * (l + w + h)]);
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          ['l', 'w', 'h'].forEach(g => {
            [true, false].forEach(hid => { const s = d.gEdgeMore(d.gGroup[g], hid); say('gEdgeMore', L, s, []); if (hid !== /虛線|dashed/.test(s)) fail('GAME gEdgeMore ' + L + ': the dashed edge is ' + (hid ? 'not ' : '') + 'mentioned: ' + s); });
            for (let n = 1; n <= 4; n++) [true, false].forEach(hid => { const s = d.gEdge2(d.gGroup[g], n, hid); say('gEdge2', L, s, [n]); if (hid !== /虛線|dashed/.test(s)) fail('GAME gEdge2 ' + L + ': dashed mention wrong: ' + s); });
            say('gEdgeReady', L, d.gEdgeReady(d.gGroup[g]), [4]);
            ['l', 'w', 'h'].filter(g2 => g2 !== g).forEach(g2 => say('gEdgePhase', L, d.gEdgePhase(d.gGroup[g], d.gGroup[g2]), [4]));
          });
          const DIR = { zh:{ l:'左右方向', w:'往後斜', h:'上下方向' }, en:{ l:'left–right', w:'slanting back', h:'up–down' } }[L];
          if (['l', 'w', 'h'].some(g => d.gDir[g] !== DIR[g]) || d.gGroup.l === d.gGroup.w) fail('GAME gDir ' + L + ': the direction words do not match how the edges are drawn (length left–right, width slanting back, height up–down): ' + JSON.stringify(d.gDir));
          ['gEdgeVertex', 'gEdgeCross', 'gEdgeFace', 'gEdgeAll', 'gEdgeBtn'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME: ' + k + ' missing in ' + L); else say(k, L, d[k]); });
          if (L === 'en' && /\b(\d+) length edge \b/.test(d.gEdge2('length', 2, false))) fail('GAME gEdge2 en: plural');
          if (d.gEdge2(d.gGroup.l, 1, false) === d.gEdge2(d.gGroup.l, 2, false)) fail('GAME gEdge2: does not change with n');
        });
      }

      /* ================= 第 2 關：對面配對 ================= */
      {
        const Pp = D.PAIR, u = Pp.u, H = D.PAIR_H, area = r => r[0] * r[1], cong = (p, q) => (p[0] === q[0] && p[1] === q[1]) || (p[0] === q[1] && p[1] === q[0]);
        if (D.PAIR_SLOTS.map(s => s.face + '/' + s.opp).join() !== 'back/front,bottom/top,left/side') fail('GAME pair: the slots should be back/front, bottom/top, left/right');
        const slotZ = [0, 1, 2].map(i => D.pairSlot(i));
        slotZ.forEach((z, i) => { insideB(box(z.cx, z.cy, 2 * z.hw, 2 * z.hh), 'pair slot ' + i, H, 2);
          if (Math.abs(z.cy - z.hh - Pp.lblY) > EPS || Math.abs(z.cy + z.hh - (Pp.slotY + Pp.slotH / 2)) > EPS || z.hw !== Pp.slotW / 2) fail('GAME pair slot ' + i + ': the accept zone is not its label plus its box'); });
        for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (hitR(box(slotZ[i].cx, slotZ[i].cy, 2 * slotZ[i].hw, 2 * slotZ[i].hh), box(slotZ[j].cx, slotZ[j].cy, 2 * slotZ[j].hw, 2 * slotZ[j].hh))) fail('GAME pair: slots ' + i + ' and ' + j + ' overlap');
        if (Pp.slotH < Pp.cardH + 2 || Pp.slotW < Pp.cardW + 2) fail('GAME pair: a card does not fit in its slot');
        const trayB = [0, 1, 2, 3].map(j => box(Pp.trayX[j % 2], Pp.trayY[Math.floor(j / 2)], Pp.cardW, Pp.cardH));
        trayB.forEach((tb, j) => { insideB(tb, 'pair tray card ' + j, H, 2); slotZ.forEach((z, i) => { if (hitR(tb, box(z.cx, z.cy, 2 * z.hw, 2 * z.hh), Pp.pad + 2)) fail('GAME pair: tray card ' + j + ' is within the snap margin of slot ' + i); }); });
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (hitR(trayB[i], trayB[j])) fail('GAME pair: tray cards ' + i + ' and ' + j + ' overlap');
        tooSmall('pair card', Math.min(Pp.cardW, Pp.cardH));
        sweep('pair slots', slotZ, Pp.pad, H);
        if (D.GAME_PAIR.length < 5) fail('GAME pair: pool too small');
        const decoyFor = new Set();
        D.GAME_PAIR.forEach(e => {
          const b = e.slice(0, 3), [l, w, h] = b, tag = 'pair ' + e.join(','), dec = [e[3], e[4]];
          const face = { front:[l, h], top:[l, w], side:[w, h] }, F = ['front', 'top', 'side'];
          if (!(l !== w && w !== h && l !== h) || !b.concat(dec).every(v => isInt(v) && v >= 2 && v <= 6)) fail('GAME ' + tag + ': all lengths whole 2–6 and the box\'s three different');
          if (F.some(f => cong(face[f], dec)) || F.filter(f => area(face[f]) === area(dec)).length !== 1) fail('GAME ' + tag + ': the left-over card must have the area of exactly one face and the shape of none');
          F.forEach(f => decoyFor.add(F.filter(g => area(face[g]) === area(dec))[0]));
          F.forEach(f => { if (!cong(D.pairFace(b, f), face[f])) fail('GAME ' + tag + ': pairFace(' + f + ') is ' + D.pairFace(b, f)); });
          for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (cong(face[F[i]], face[F[j]])) fail('GAME ' + tag + ': two faces are congruent — a card would fit two slots');
          /* 每一張卡（兩個方向）× 每一格 */
          const cards = F.map(f => face[f]).concat([dec]);
          cards.forEach(c => [c, [c[1], c[0]]].forEach(r => D.PAIR_SLOTS.forEach((s, i) => {
            const want = face[s.opp], x = D.pairRefuse(b, i, r), ok = cong(r, want);
            if (ok !== (x === null)) fail('GAME ' + tag + ': card ' + r.join('×') + ' in slot ' + s.face + ' — pairRefuse ' + JSON.stringify(x) + ', want ' + (ok ? 'accept' : 'refuse'));
            if (x){
              if (!cong(x.want, want) || x.same !== (area(r) === area(want))) fail('GAME ' + tag + ': pairRefuse reason ' + JSON.stringify(x));
              LANGS.forEach(L => { const d = I18N[L], t = d.gPairBad(d.gFaceName[s.face], d.gFaceName[s.opp], x.want, r, x.same);
                say(tag + ' gPairBad', L, t, x.want.concat(r, x.same ? [area(r)] : []));
                if (x.same !== /面積一樣|same area/.test(t)) fail('GAME ' + tag + ' gPairBad ' + L + ': "same area" said wrongly: ' + t);
                if (t.indexOf(d.gFaceName[s.face]) < 0 || t.indexOf(d.gFaceName[s.opp]) < 0) fail('GAME ' + tag + ' gPairBad ' + L + ': does not name both faces: ' + t); });
            }
          })));
          LANGS.forEach(L => { const d = I18N[L];
            D.PAIR_SLOTS.forEach(s => { say(tag + ' gPairOk', L, d.gPairOk(d.gFaceName[s.face], d.gFaceName[s.opp], face[s.opp]), face[s.opp]); say(tag + ' gPair2', L, d.gPair2(d.gFaceName[s.face], d.gFaceName[s.opp], face[s.opp]), face[s.opp]); });
            say(tag + ' gPairDone', L, d.gPairDone(dec), dec); });
          /* pairCards：四張，三張是三面、一張是誘答，每一張可能轉 90° */
          const turned = new Set();
          for (let k = 0; k < 300; k++){ const cs = D.pairCards(e); cs.forEach(c => turned.add(c.r.join('x'))); const ms = cs.map(c => c.r.slice().sort((a, c2) => a - c2).join('x')).sort().join(); if (cs.length !== 4 || ms !== cards.map(c => c.slice().sort((a, c2) => a - c2).join('x')).sort().join() || cs.some(c => c.face !== null && !cong(c.r, face[c.face]))) { fail('GAME ' + tag + ': pairCards gave ' + JSON.stringify(cs)); break; } }
          if (cards.some(c => !turned.has(c.join('x')) || !turned.has(c[1] + 'x' + c[0]))) fail('GAME ' + tag + ': pairCards never turns some card 90° (' + [...turned].join() + ')');
          /* 立體圖：自己的原點、12 條稜；標籤與面的名字離每一條稜 ≥ 2px、在畫板裡、在格子的名字上面；「前面」在前面那一面裡 */
          const o = { x:(W - (l + w * 0.4) * u) / 2, y:Pp.top + (h + w * 0.3) * u }, P = (x, y, z) => ({ x:o.x + (x + 0.4 * z) * u, y:o.y - (y + 0.3 * z) * u });
          const po = D.pairOrigin(b); if (Math.abs(po.x - o.x) > EPS || Math.abs(po.y - o.y) > EPS) fail('GAME ' + tag + ': pairOrigin is not centred');
          const segs = D.boxEdges(b).map(q => ({ a:P(...q.a), b:P(...q.b) }));
          const front = [P(0, 0, 0), P(l, 0, 0), P(l, h, 0), P(0, h, 0)];
          const texts = D.pairLabels(b).map(t => ({ t, s:String(t.v), size:Pp.font, what:'label ' + t.k })).concat(...LANGS.map(L => D.pairNames(b).map(t => ({ t, s:I18N[L].gFaceName[t.f], size:Pp.font, what:L + ' name ' + t.f }))));
          D.pairLabels(b).forEach(t => { if (t.v !== { l, w, h }[t.k]) fail('GAME ' + tag + ': label ' + t.k + ' says ' + t.v); });
          texts.forEach(x => {
            const bx = textBox(x.t, x.size, x.s);
            if (bx.x0 < 2 || bx.y0 < 2 || bx.x1 > W - 2 || bx.y1 > Pp.lblY - 2) fail('GAME ' + tag + ': ' + x.what + ' is outside the drawing area');
            const dmin = Math.min(...segs.map(sg => segBox(sg.a, sg.b, bx) - 1.5));
            if (dmin < 2) fail('GAME ' + tag + ': ' + x.what + ' "' + x.s + '" is ' + dmin.toFixed(1) + 'px from an edge');
            if (x.t.f === 'front' && !(bx.x0 > front[0].x && bx.x1 < front[1].x && bx.y0 > front[2].y && bx.y1 < front[0].y)) fail('GAME ' + tag + ': ' + x.what + ' is not inside the front face');
            if (x.t.f === 'top' && !(bx.y1 < P(0, h, w).y)) fail('GAME ' + tag + ': ' + x.what + ' is not above the top face');
            if (x.t.f === 'side' && !(bx.x0 > P(l, 0, w).x)) fail('GAME ' + tag + ': ' + x.what + ' is not right of the side face');
          });
        });
        if (decoyFor.size < 3) fail('GAME pair: the left-over card always matches the area of the same face (' + [...decoyFor].join() + ') — vary it');
        /* 卡片：照比例、標籤在框裡、離長方形 ≥ 2px（估計；e2e 量真的） */
        for (let a = 2; a <= 6; a++) for (let c = 2; c <= 6; c++){
          const g = D.pairCardGeo([a, c]), bw = 3;
          if (g.w !== a * Pp.s || g.h !== c * Pp.s || g.top.v !== a || g.left.v !== c) fail('GAME pair card ' + a + '×' + c + ': not drawn to scale or labelled wrong');
          if (g.x < bw + 2 || g.y < bw + 2 || g.x + g.w > Pp.cardW - bw - 2 || g.y + g.h > Pp.cardH - bw - 2) fail('GAME pair card ' + a + '×' + c + ': the rectangle touches the card border');
          [[g.top, 'middle'], [g.left, 'end']].forEach(([t, an]) => { const bx = textBox({ x:t.x, y:t.y, a:an }, Pp.font, String(t.v));
            if (bx.x0 < bw + 2 || bx.y0 < bw + 2 || bx.x1 > Pp.cardW - bw - 2 || bx.y1 > Pp.cardH - bw - 2) fail('GAME pair card ' + a + '×' + c + ': a label leaves the card');
            if (bx.x1 > g.x - 2 && bx.y1 > g.y - 2) fail('GAME pair card ' + a + '×' + c + ': a label touches the rectangle'); });
        }
      }

      /* ================= 第 3 關：摺得成嗎 ================= */
      {
        const Fd = D.FOLD, H = D.FOLD_H;
        const BC = D.FOLD_BAD.map(canon);
        if (D.FOLD_BAD.length !== 16 || new Set(BC).size !== 16 || BC.slice().sort().join('|') !== HEXT.map(canon).sort().join('|')) fail('GAME fold: FOLD_BAD should be exactly the 16 tree-shaped hexominoes that do not fold (my own enumeration)');
        if (D.FOLD_BAD.some(has2x2) || D.FOLD_BAD.some(folds)) fail('GAME fold: a FOLD_BAD net folds or has a 2×2 block');
        if (D.VALID_NETS.map(canon).sort().join('|') !== HEXV.map(canon).sort().join('|')) fail('GAME fold: VALID_NETS is not the 11 that fold');
        const all = D.VALID_NETS.map(c => [c, true]).concat(D.FOLD_BAD.map(c => [c, false]));
        all.forEach(([c, ok]) => {
          for (let k = 0; k < 8; k++){
            const oc = D.netOrient(c, k), mine = normCells(c.map(T8[k]));
            if (oc.map(x => x + '').join(';') !== mine.map(x => x + '').join(';')) fail('GAME fold: netOrient(' + k + ') of ' + JSON.stringify(c) + ' is not the ' + k + '-th turn/flip');
            const ov = D.netOverlap(oc), nr = normals(oc);
            if (ok ? ov !== null : !(ov && ov[0] !== ov[1] && nr[ov[0]] === nr[ov[1]])) fail('GAME fold: netOverlap ' + JSON.stringify(oc) + ' = ' + JSON.stringify(ov) + ' — my own folding disagrees');
            if (!ok && new Set(nr).size >= 6) fail('GAME fold: "one face is left uncovered" is not true for ' + JSON.stringify(oc));
            const s = D.netSize(oc);
            if (s.w >= s.h){
              if (s.w * Fd.c > Fd.cardW - 10 || s.h * Fd.c > Fd.cardH - 10) fail('GAME fold: net ' + JSON.stringify(oc) + ' does not fit its card with 2px inside the border');
              oc.forEach((q, i) => { const p = D.foldCellXY(oc, i); if (Math.abs(p.x - ((Fd.cardW - s.w * Fd.c) / 2 + q[0] * Fd.c)) > EPS || Math.abs(p.y - ((Fd.cardH - s.h * Fd.c) / 2 + q[1] * Fd.c)) > EPS) fail('GAME fold: foldCellXY is not centred'); });
            }
          }
          const wide = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(k => normCells(c.map(T8[k]))).filter(m => { const s = D.netSize(m); return s.w >= s.h; }).map(m => m.map(x => x + '').join(';'))), got = new Set();
          for (let k = 0; k < 200; k++){ const nw = D.netWide(c), s = D.netSize(nw); got.add(nw.map(x => x + '').join(';')); if (s.w < s.h || canon(nw) !== canon(c)) { fail('GAME fold: netWide gave ' + JSON.stringify(nw)); break; } }
          if (got.size !== wide.size) fail('GAME fold: netWide shows ' + got.size + ' of the ' + wide.size + ' wide turns of ' + JSON.stringify(c));
        });
        tooSmall('fold card', Math.min(Fd.cardW, Fd.cardH));
        const trayCov = new Set();
        for (let k = 0; k < 3000; k++){
          const t = D.foldTray(), cs = t.map(x => canon(x.cells)); cs.forEach(x => trayCov.add(x));
          const bad = t.length !== 4 || t.filter(x => x.ok).length !== 2 || t.some(x => folds(x.cells) !== x.ok) || new Set(cs).size !== 4 || t.some(x => { const s = D.netSize(x.cells); return s.w < s.h; });
          if (bad){ fail('GAME fold: foldTray gave ' + JSON.stringify(t.map(x => [x.ok, canon(x.cells)]))); break; }
        }
        /* 位置不能洩漏答案：20000 盤裡六種「哪兩格摺得成」的排法各約 1/6；只看位置猜的人（最常見的那一種）不比亂猜好；
           第一張的類別也不能透露第二張（同類的機率約 1/3）。誤報的機率：每一格的容許差 0.015 ≈ 5.7 個標準差 */
        { const lay = {}, N = 20000; let same = 0;
          for (let k = 0; k < N; k++){ const t = D.foldTray(), key = t.map(x => x.ok ? 'Y' : 'N').join(''); lay[key] = (lay[key] || 0) + 1; if (t[0].ok === t[1].ok) same++; }
          const keys = Object.keys(lay), fr = keys.map(k => lay[k] / N);
          if (keys.length !== 6 || fr.some(f => Math.abs(f - 1 / 6) > 0.015)) fail('GAME fold: the tray layout is not uniform — a position-only player could guess better than chance ' + JSON.stringify(lay));
          if (Math.abs(same / N - 1 / 3) > 0.02) fail('GAME fold: the tray layout is not uniform — the first net\'s kind tells the second (same kind ' + (same / N).toFixed(3) + ', want 1/3)'); }
        if (trayCov.size !== 27) fail('GAME fold: only ' + trayCov.size + ' of the 27 nets (11 + 16) appeared in 3000 trays');
        [true, false].forEach(ok => [0, 1].forEach(k => { if (D.foldAccept({ ok }, k) !== (ok === (k === 0))) fail('GAME fold: foldAccept(' + ok + ', ' + k + ')'); }));
        const binZ = [0, 1].map(k => D.foldBin(k));
        binZ.forEach((z, k) => { const zb = box(z.cx, z.cy, 2 * z.hw, 2 * z.hh); insideB(zb, 'fold bin ' + k, H, 2);
          if (z.hw !== Fd.binW / 2 || Math.abs(z.cy - z.hh - Fd.binY) > EPS || z.hh !== Fd.binH / 2) fail('GAME fold bin ' + k + ': the accept zone is not the whole bin (label included)');
          Fd.spotY.forEach(y => { const cb = box(Fd.binX[k], y, Fd.cardW, Fd.cardH); if (cb.x < zb.x + 3 || cb.x + cb.w > zb.x + zb.w - 3 || cb.y < Fd.binY + Fd.binLblH + 1 || cb.y + cb.h > zb.y + zb.h - 3) fail('GAME fold bin ' + k + ': a placed card at y ' + y + ' does not fit inside the bin below its label'); });
          if (hitR(box(Fd.binX[k], Fd.spotY[0], Fd.cardW, Fd.cardH), box(Fd.binX[k], Fd.spotY[1], Fd.cardW, Fd.cardH))) fail('GAME fold bin ' + k + ': the two placed cards overlap'); });
        const trayF = [0, 1, 2, 3].map(j => box(Fd.trayX[j % 2], Fd.trayY[Math.floor(j / 2)], Fd.cardW, Fd.cardH));
        trayF.forEach((tb, j) => { insideB(tb, 'fold tray card ' + j, H, 2); binZ.forEach((z, k) => { if (hitR(tb, box(z.cx, z.cy, 2 * z.hw, 2 * z.hh), Fd.pad + 2)) fail('GAME fold: tray card ' + j + ' is within the snap margin of bin ' + k); }); });
        for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (hitR(trayF[i], trayF[j])) fail('GAME fold: tray cards ' + i + ' and ' + j + ' overlap');
        const gap = (Fd.binX[1] - Fd.binW / 2) - (Fd.binX[0] + Fd.binW / 2);
        if (!(gap > 0 && gap < 2 * Fd.pad)) fail('GAME fold: the bins should have a gap smaller than both snap margins (' + gap + ')');
        sweep('fold bins', binZ, Fd.pad, H);
        LANGS.forEach(L => { const d = I18N[L];
          if (!/✅/.test(d.gBins[0]) || !/❌/.test(d.gBins[1])) fail('GAME fold: bin labels ' + L + ' ' + d.gBins.join());
          say('gFoldBadNo', L, d.gFoldBadNo, []); has('gFoldBadNo', L, d.gFoldBadNo, { zh:['塗橘色的兩格', '同一個面', '至少有一個面沒有蓋到'], en:['two orange squares', 'same face', 'at least one face'] });
          say('gFoldBadYes', L, d.gFoldBadYes, [6]); has('gFoldBadYes', L, d.gFoldBadYes, { zh:['摺得成'], en:['does fold'] });
          [true, false].forEach(ok => { say('gFoldOk', L, d.gFoldOk(ok), []); say('gFold2', L, d.gFold2(ok), []); if (/橘色|orange/.test(d.gFold2(ok)) === ok) fail('GAME gFold2 ' + L + ': orange squares mentioned for a net that ' + (ok ? 'folds' : 'does not')); });
          say('gFoldDone', L, d.gFoldDone, L === 'zh' ? [6, 6] : [6]);
          for (let k = 0; k <= 4; k++) say('gFoldNow', L, d.gFoldNow(k), [k, 4]);
        });
      }

      /* ================= 第 4 關：做骰子 ================= */
      {
        const Di = D.DIE, H = D.DIE_H;
        if (D.DIE_NETS.map(i => canon(D.VALID_NETS[i])).sort().join('|') !== HEXV.filter(run4).map(canon).sort().join('|')) fail('GAME die: DIE_NETS should be exactly the 6 nets with a straight run of 4');
        D.DIE_NETS.forEach(i => {
          const c0 = D.VALID_NETS[i];
          for (let k = 0; k < 8; k++){
            const c = D.netOrient(c0, k), o = oppRef(c), po = D.dieOpp(c), r = D.netRun4(c), fl = [0, 1, 2, 3, 4, 5].filter(j => !r || r.indexOf(j) < 0);
            if (po.join() !== o.join()) fail('GAME die: dieOpp ' + JSON.stringify(c) + ' = ' + po + ', my own folding ' + o);
            if (!r || !r.every((j, s) => s === 0 || (Math.abs(c[j][0] - c[r[s - 1]][0]) + Math.abs(c[j][1] - c[r[s - 1]][1]) === 1 && (c[j][0] === c[r[0]][0] || c[j][1] === c[r[0]][1]))) || o[r[0]] !== r[2] || o[r[1]] !== r[3] || o[fl[0]] !== fl[1]) fail('GAME die: the hint\'s run-of-4 rule does not hold on ' + JSON.stringify(c));
            const s = D.netSize(c);
            if (s.w >= s.h){
              const zs = c.map((q, j) => D.dieCell(c, j));
              zs.forEach((z, j) => { insideB(box(z.cx, z.cy, 2 * z.hw, 2 * z.hh), 'die cell', H, 2); if (z.hw !== Di.c / 2) fail('GAME die: a cell is not ' + Di.c + ' wide'); });
              Di.trayX.forEach(x => { const tb = box(x, Di.trayY, Di.c, Di.c); insideB(tb, 'die card', H, 2); zs.forEach(z => { if (hitR(tb, box(z.cx, z.cy, 2 * z.hw, 2 * z.hh), Di.pad + 2)) fail('GAME die: a tray card is within the snap margin of a net square'); }); });
              if (k === 0) sweep('die cells ' + i + '/' + k, zs.map((z, j) => Object.assign({ i:j }, z)), Di.pad, H, 1);
            }
          }
        });
        for (let a = 0; a < 3; a++) for (let b2 = a + 1; b2 < 3; b2++) if (hitR(box(Di.trayX[a], Di.trayY, Di.c, Di.c), box(Di.trayX[b2], Di.trayY, Di.c, Di.c))) fail('GAME die: tray cards overlap');
        tooSmall('die card', Di.c);
        const dieCov = new Set(), dieForms = new Set(), dieSides = new Set();
        for (let k = 0; k < 3000; k++){
          const S = D.dieSetup(), c = S.cells, o = oppRef(c), s = D.netSize(c), pre = S.pip.filter(v => v);
          dieCov.add(canon(c)); dieForms.add(c.map(x => x + '').join(';')); S.pip.forEach((v, j) => { if (v) dieSides.add(canon(c) + '|' + j + '|' + v); });
          const bad = !D.DIE_NETS.some(i => canon(D.VALID_NETS[i]) === canon(c)) || s.w < s.h || S.opp.join() !== o.join() || pre.length !== 3 || S.pip.some((v, j) => v && S.pip[o[j]]) ||
            pre.concat(S.cards).sort().join() !== '1,2,3,4,5,6' || S.cards.some(n => pre.indexOf(7 - n) < 0);
          if (bad){ fail('GAME die: dieSetup gave ' + JSON.stringify(S)); break; }
          if (k < 200) S.cards.forEach(n => S.pip.forEach((v, j) => { if (v) return; const x = D.dieRefuse(S, j, n), ok = S.pip[o[j]] + n === 7;
            if (ok !== (x === null) || (x && x.v !== S.pip[o[j]])) fail('GAME die: dieRefuse(' + n + ' on square ' + j + ') = ' + JSON.stringify(x));
            if (x) LANGS.forEach(L => say('gDieBad', L, I18N[L].gDieBad(n, x.v), [x.v, x.v, n, x.v + n, 7, n, 7 - n])); }));
        }
        const wideForms = new Set([].concat(...D.DIE_NETS.map(i => [0, 1, 2, 3, 4, 5, 6, 7].map(k => normCells(D.VALID_NETS[i].map(T8[k]))).filter(m => { const s = D.netSize(m); return s.w >= s.h; }).map(m => m.map(x => x + '').join(';')))));
        if (dieCov.size !== 6 || dieForms.size !== wideForms.size) fail('GAME die: in 3000 boards only ' + dieCov.size + ' of the 6 nets and ' + dieForms.size + ' of the ' + wideForms.size + ' wide turns appeared');
        /* every net × every square × every number 1–6 (each has probability 1/72 per board: 3000 boards miss one with probability ≈ 1e-16) */
        if (dieSides.size !== 6 * 6 * 6) fail('GAME die: the drawn dots do not vary enough (' + dieSides.size + ' of the 216 net/square/number combinations seen)');
        for (let n = 1; n <= 6; n++){ const ps = D.diePips(n, Di.c);
          if (ps.length !== n || new Set(ps.map(p => p + '')).size !== n || ps.some(p => p[0] < Di.c * 0.15 || p[1] < Di.c * 0.15 || p[0] > Di.c * 0.85 || p[1] > Di.c * 0.85)) fail('GAME die: diePips(' + n + ') is not ' + n + ' dots inside the face'); }
        LANGS.forEach(L => { const d = I18N[L];
          for (let n = 1; n <= 6; n++){ say('gDieOk', L, d.gDieOk(n), [n, 7 - n, 7]); say('gDie2', L, d.gDie2(n), [n, 7 - n]); }
          say('gDieDone', L, d.gDieDone, [1, 6, 2, 5, 3, 4, 7]);
          for (let k = 0; k <= 3; k++) say('gDieNow', L, d.gDieNow(k), [k, 3]);
        });
      }

      /* ================= 第 5 關：紙板要多大 ================= */
      {
        const Su = D.SURF, u = Su.u;
        if (!D.GAME_SURF.some(b => b[0] === b[1] && b[1] === b[2])) fail('GAME surf: the pool has no cube');
        if (D.GAME_SURF.length < 5) fail('GAME surf: the pool has only ' + D.GAME_SURF.length + ' boxes');
        D.GAME_SURF.forEach(b => {
          const [l, w, h] = b, tag = 'surf ' + b.join('×'), H = D.surfH(b), S = 2 * (l * w + l * h + w * h), V = l * w * h, S3 = l * w + l * h + w * h;
          if (!b.every(v => isInt(v) && v >= 2 && v <= 7)) fail('GAME ' + tag + ': every length must be a whole number 2–7 (the answer is typed as a whole number)');
          if (D.surfJudge(b, S) !== null) fail('GAME ' + tag + ': the right answer ' + S + ' is not accepted');
          if (D.surfArea(b) !== S) fail('GAME ' + tag + ': surfArea ' + D.surfArea(b));
          const ox = (W - 2 * (l + w) * u) / 2, oy = Su.top + w * u;
          const mine = [['front', ox, oy, l, h], ['right', ox + l * u, oy, w, h], ['back', ox + (l + w) * u, oy, l, h], ['left', ox + (2 * l + w) * u, oy, w, h], ['top', ox, oy - w * u, l, w], ['bottom', ox, oy + h * u, l, w]].map(f => ({ f:f[0], x:f[1], y:f[2], w:f[3] * u, h:f[4] * u }));
          const pf = D.surfFaces(b);
          if (pf.length !== 6 || pf.some((f, i) => f.f !== mine[i].f || Math.abs(f.x - mine[i].x) > EPS || Math.abs(f.y - mine[i].y) > EPS || Math.abs(f.w - mine[i].w) > EPS || Math.abs(f.h - mine[i].h) > EPS)) fail('GAME ' + tag + ': the six faces are not the ones I draw myself');
          if (pf.reduce((a, f) => a + f.w * f.h, 0) / (u * u) !== S) fail('GAME ' + tag + ': the drawn faces do not add up to the surface area');
          if (['front', 'back'].some(k => pf.find(f => f.f === k).p !== 'lh') || ['right', 'left'].some(k => pf.find(f => f.f === k).p !== 'wh') || ['top', 'bottom'].some(k => pf.find(f => f.f === k).p !== 'lw')) fail('GAME ' + tag + ': a face is coloured as the wrong pair');
          mine.forEach(f => insideB(f, tag + ' face ' + f.f, H, 2));
          const segs = []; mine.forEach(f => { const c = [{ x:f.x, y:f.y }, { x:f.x + f.w, y:f.y }, { x:f.x + f.w, y:f.y + f.h }, { x:f.x, y:f.y + f.h }]; for (let i = 0; i < 4; i++) segs.push({ a:c[i], b:c[(i + 1) % 4], len:(i % 2 ? f.h : f.w) / u }); });
          const labs = D.surfLabels(b);
          if (labs.map(t => t.v).sort().join() !== [l, w, h, w, l, w].sort().join()) fail('GAME ' + tag + ': labels ' + labs.map(t => t.v));
          labs.forEach(t => { const bx = textBox(t, 14, String(t.v)), ds = segs.map(s => segBox(s.a, s.b, bx) - 0.75), m = Math.min(...ds);
            if (m < 2) fail('GAME ' + tag + ': label ' + t.v + ' is ' + m.toFixed(1) + 'px from a face edge');
            if (bx.x0 < 2 || bx.y0 < 2 || bx.x1 > W - 2) fail('GAME ' + tag + ': label ' + t.v + ' is outside the board');
            if (segs[ds.indexOf(m)].len !== t.v) fail('GAME ' + tag + ': label ' + t.v + ' sits nearest an edge ' + segs[ds.indexOf(m)].len + ' cm long'); });
          /* surfJudge 在 0～2S 每一個整數 */
          const pairs = { lw:l * w, lh:l * h, wh:w * h }, diag = [V, S3].concat(Object.keys(pairs).map(k => S - 2 * pairs[k]));
          if (new Set([S].concat(V, S3, ...new Set(Object.keys(pairs).map(k => S - 2 * pairs[k])))).size !== 3 + new Set(Object.keys(pairs).map(k => S - 2 * pairs[k])).size) fail('GAME ' + tag + ': two kinds of wrong answer give the same number — one of them would get the other\'s reason');
          for (let v = 0; v <= 2 * S; v++){
            const j = D.surfJudge(b, v), miss = Object.keys(pairs).filter(k => v === S - 2 * pairs[k]);
            const want = v === S ? null : v === V ? 'vol' : v === S3 ? 'half' : miss.length ? 'pair' : 'other';
            if ((j && j.kind) !== (want || undefined) && !(j === null && want === null)) fail('GAME ' + tag + ': surfJudge(' + v + ') = ' + JSON.stringify(j) + ', want ' + want);
            if (j && j.kind === 'pair' && miss.indexOf(j.p) < 0) fail('GAME ' + tag + ': surfJudge(' + v + ') names the wrong missing pair ' + j.p);
          }
          LANGS.forEach(L => { const d = I18N[L];
            say(tag + ' gSurfVol', L, d.gSurfVol(l, w, h, V), [l, w, h, V, 6, 6]);
            say(tag + ' gSurfHalf', L, d.gSurfHalf(l * w, l * h, w * h, S3), [3, l * w, l * h, w * h, S3, 2]);
            Object.keys(pairs).forEach(k => { const a = b[{ lw:0, lh:0, wh:1 }[k]], c = b[{ lw:1, lh:2, wh:2 }[k]]; if (a * c !== pairs[k]) fail('GAME surf: the pair ' + k + ' is named ' + a + ' × ' + c); say(tag + ' gSurfPair', L, d.gSurfPair(a, c), [a, c]); });
            say(tag + ' gSurf2', L, d.gSurf2(b), [l, w, l * w, l, h, l * h, w, h, w * h, 2]);
            say(tag + ' gSurfDone', L, d.gSurfDone(b), l === w && w === h ? [6, 6, l, l, S] : [6, 2, l * w, l * h, w * h, 2, S3, S]);
            say(tag + ' gSurfOther', L, d.gSurfOther(S + 3), [S + 3, 6, 3]);
          });
          if (2 * (l + w) * u > W - 40 || H > 260) fail('GAME ' + tag + ': the net is too big for the board');
          if (Math.min(l, w, h) * u < 20) fail('GAME ' + tag + ': a face is thinner than 20px');
        });
        LANGS.forEach(L => { const d = I18N[L]; ['gSurfBtn', 'gSurfAria', 'gSurfUnit', 'gSurfEmpty'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME: ' + k + ' missing in ' + L); }); });
      }

      /* --- 共用的句子 --- */
      LANGS.forEach(L => {
        const d = I18N[L];
        [10, 20].forEach(p => say('gPts', L, d.gPts(p), [p]));
        say('gMinus', L, d.gMinus, [5]);
        say('gWin', L, d.gWin(100), L === 'en' ? [5, 100] : [100]);
        ['gClear', 'gHintBtn', 'gNextBtn', 'gRestartBtn'].forEach(k => { if (typeof d[k] !== 'string' || !d[k]) fail('GAME: ' + k + ' missing in ' + L); });
      });
    }
  }
};
