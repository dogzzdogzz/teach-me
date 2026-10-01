/* grade-3/math/perimeter 的檢查設定（繞一圈量量看：周界與周長、長方形 (長 ＋ 寬) × 2、正方形 邊長 × 4、反推缺的邊、周長一樣面積不一樣）。
   2026-10-01 新增 —— 和小遊戲「圍籬大挑戰」改成五關五種玩法（§六之五）同一次寫成。在這之前這一課沒有設定檔，
   simgen.js／verify_lesson_data.js／breaktest.js 對它一律直接報錯（沒有設定的課程不算驗過）。

   sim（review.html 的九個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算），
   以及 renderCheck —— 把題目畫出來的那張 SVG 量回來：每一條邊的長度（px ÷ PXCM）要等於資料裡的邊長（圖照比例畫），
   每一個數字標籤都要是某一條真的邊的長度；「?」的數量要剛好是題目要孩子求的那幾條。
   選項的範圍從這一課自己的數字推：正解是周長或邊長（≤ 60），誘答最大是面積誘答 l × w（只在有一邊是一位數時才出，≤ 14 × 9 ＝ 126）。

   data（index.html）：
   - 所有 I18N 字串（含三層題庫的題幹與解釋函式的回傳值）裡的算式逐條重算，認得括號與連等：
     (5 ＋ 3) × 2 ＝ 16、5 ＋ 5 ＋ 5 ＋ 5 ＝ 5 × 4 ＝ 20；掃描器自己先跑正反例。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關**照遊戲的規則把每一題從頭玩一遍**：繞一圈（任何順序點完六條邊都是同一個周長、虛線永遠不算）、
     圍籬笆（每一根只放得進一樣長的邊；四條邊剛好用掉 l、l、w、w，x 沒有地方放）、
     正方形（每一種打錯各自落在不同的值上，所以說得出是哪一種錯）、
     剪繩子（第一刀只有 h 收、第二刀只有 l 與 w 收，兩種剪法剩下的都是寬）、分一分（兩張是、兩張不是、至少一張「不是」和「是」一樣大）。
     頁面的純函式（traceSegs／traceLabel／traceNearest／fenceSlots／fenceTray／stickW／ropeX／ropeSnap／sameBinXY）
     一律拿整個題庫去呼叫，再和自己的算法比；nearestOpen()、roundMiss() 從原始碼切出來實際執行。
     只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。每一句說明逐個比數字。版面數字一律從 index.html 讀。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、375px 的實際尺寸由 teaching-workspace/game-harness/g3-perimeter 的端對端測試驗（合成 PointerEvent）。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
function nums(text){ return (String(text).match(/\d+/g) || []).map(Number); }

/* ---------- 算式掃描：認得括號、連等；× ÷ 先算 ---------- */
function evalExpr(s){
  const toks = s.replace(/\s+/g, '').match(/\d+|[+\-×÷()]|./g) || [];
  let i = 0;
  function num(){
    const t = toks[i];
    if (t === '('){ i++; const v = sum(); if (toks[i] !== ')') throw new Error('missing )'); i++; return v; }
    if (/^\d+$/.test(t || '')){ i++; return +t; }
    throw new Error('expected a number at "' + t + '"');
  }
  function prod(){
    let v = num();
    while (toks[i] === '×' || toks[i] === '÷'){
      const op = toks[i++], r = num();
      if (op === '×') v *= r;
      else { if (r === 0 || v % r !== 0) throw new Error('inexact division ' + v + ' ÷ ' + r); v /= r; }
    }
    return v;
  }
  function sum(){
    let v = prod();
    while (toks[i] === '+' || toks[i] === '-'){ const op = toks[i++], r = prod(); v = op === '+' ? v + r : v - r; }
    return v;
  }
  if (!toks.length) throw new Error('empty');
  const v = sum();
  if (i !== toks.length) throw new Error('trailing "' + toks.slice(i).join('') + '"');
  return v;
}
function normEq(text){
  return String(text).replace(/<[^>]+>/g, ' ').replace(/＝/g, '=').replace(/＋/g, '+').replace(/[−–－]/g, '-').replace(/[×✕＊]/g, '×').replace(/[÷／]/g, '÷')
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[（]/g, '(').replace(/[）]/g, ')').replace(/[　\s]+/g, ' ');
}
/* 回傳 [{ text, bad, question }]：bad 是 null 表示每一段都相等 */
function scanEquations(text){
  const t = normEq(text), out = [];
  const re = /(?<![\d.\/])(?<![×+\-÷] ?)[\d(][\d +\-×÷()]*(?:=[\d +\-×÷()]*)+/g;
  let m;
  while ((m = re.exec(t))){
    let parts = m[0].split('=').map(x => x.trim());
    /* 開頭的左括號如果沒有配對，是句子裡的括號（「…（4×6=24 是面積」那種），不是算式的一部分 */
    const strip = p => { let q = p.replace(/[\s(]+$/, '').replace(/^[\s)]+/, ''); while (/^\(/.test(q) && (q.match(/\(/g) || []).length > (q.match(/\)/g) || []).length) q = q.slice(1).trim(); while (/\)$/.test(q) && (q.match(/\)/g) || []).length > (q.match(/\(/g) || []).length) q = q.slice(0, -1).trim(); return q; };
    parts = parts.map(strip);
    /* 「a ＋ b ＝ ？」：最後一段是空的（問號不在字元集裡），是題目；但前面已經寫出來的等號仍然要對（5 + 5 = 11 = ? 不可以放過） */
    const question = parts[parts.length - 1] === '';
    if (question) parts = parts.slice(0, -1);
    if (question && parts.length < 2){ out.push({ text:m[0], bad:null, question:true }); continue; }
    /* 一段裡沒有運算子也沒有數字（例如句子裡的「-」）就不是算式 */
    if (parts.some(p => !/\d/.test(p))){ out.push({ text:m[0], bad:'a side of "=" has no number', question:false }); continue; }
    if (parts.length < 2 || !parts.some(p => /[+\-×÷]/.test(p))){ out.push({ text:m[0], bad:null, question:false, trivial:true }); continue; }
    let bad = null, vals;
    try { vals = parts.map(evalExpr); } catch (e){ bad = 'cannot read: ' + e.message; }
    if (!bad && !vals.every(v => v === vals[0])) bad = 'does not add up: ' + parts.map((p, k) => p + ' → ' + vals[k]).join(' / ');
    out.push({ text:m[0], bad, question:false });
  }
  return out;
}

/* ---------- review.html 的 SVG：把畫出來的圖量回來 ---------- */
function svgShapes(html){
  const out = [];
  const svgs = String(html).match(/<svg[\s\S]*?<\/svg>/g) || [];
  svgs.forEach(svg => {
    const d = (svg.match(/<path d="([^"]+)"/) || [])[1];
    if (!d) return out.push({ err:'no <path> in the shape' });
    const pts = [];
    const re = /([ML])([\d.-]+),([\d.-]+)/g;
    let m;
    while ((m = re.exec(d))) pts.push({ x:+m[2], y:+m[3] });
    const labels = [];
    const tr = /<text x="([\d.-]+)" y="([\d.-]+)" font-size="([\d.]+)"[^>]*text-anchor="(start|middle|end)">([^<]*)<\/text>/g;
    while ((m = tr.exec(svg))){
      /* 字的中心：照 text-anchor 從錨點往左／右推半個字寬（字寬照字數估，只拿來分辨「離哪一條邊最近」） */
      const fs = +m[3], w = [...m[5]].reduce((a, c) => a + (/[一-鿿]/.test(c) ? 1 : 0.6), 0) * fs;
      const cx = +m[1] + (m[4] === 'start' ? w / 2 : m[4] === 'end' ? -w / 2 : 0);
      labels.push({ x:cx, y:+m[2] - fs * 0.35, t:m[5] });
    }
    if (labels.length !== (svg.match(/<text\b/g) || []).length) return out.push({ err:'a <text> label could not be read' });
    /* 引線：label 離自己那條邊不夠近時，renderShape 會從字拉一條虛線到那條邊的中點 —— 那個字就屬於那條邊 */
    const leaders = [];
    const lr = /<line x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#6B6875" stroke-width="1" stroke-dasharray="3 2"\/>/g;
    while ((m = lr.exec(svg))) leaders.push({ x1:+m[1], y1:+m[2], x2:+m[3], y2:+m[4] });
    out.push({ pts, labels, leaders });
  });
  return out;
}
const PXCM_REVIEW = 16;
/* 「算成面積」的誘答 a × b 只有在三年級算得出來的時候才合理：其中一邊是一位數（二位數 × 一位數） */
function areaReach(opts, a, b){
  if (Math.min(a, b) >= 10 && (opts || []).map(Number).indexOf(a * b) >= 0) return 'the area distractor ' + a + ' × ' + b + ' = ' + (a * b) + ' needs 2-digit × 2-digit multiplication, which grade 3 does not do';
}
/* 每一條邊（照順序）有幾公分 */
function sideCm(pts){
  const s = [];
  for (let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s.push(Math.hypot(b.x - a.x, b.y - a.y) / PXCM_REVIEW);
  }
  return s;
}

/* ---------- index.html：題庫、範例字串與小遊戲 ---------- */
function dataCheck(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = 300;

  /* --- 0. 算式掃描器自己先證明會響（positive / negative control） --- */
  [['(5 + 3) × 2 = 16 公分', true], ['(5 + 3) × 2 = 15', false], ['5+3+5+3=16', true], ['6 ＋ 3 ＋ 2 ＝ 11', true], ['6 ＋ 3 ＋ 2 ＝ 12', false],
   ['5 + 5 + 5 + 5 = 5 × 4 = 20', true], ['5 + 5 + 5 + 5 = 5 × 4 = 25', false], ['24 ÷ 2 = 12 (length + width)', true], ['24 ÷ 2 ＝ 13（長 ＋ 寬）', false],
   ['12 − 7 ＝ 5', true], ['12 − 7 ＝ 6', false], ['7 + 4 + 7 + 4 = (7 + 4) × 2 = 22 cm', true], ['7 ＋ 4 ＋ 7 ＋ 4 ＝ (7 ＋ 4) × 2 ＝ 23', false],
   ['（4×6=24 是面積', true], ['（4×6=25 是面積', false], ['25 ÷ 2 ＝ 12', false],
   ['12 － 7 ＝ 5', true], ['12 － 7 ＝ 6', false], ['5 + 5 = 10 = ?', true], ['5 + 5 = 11 = ?', false], ['１２ － ７ ＝ ６', false],
   ['24 ÷ 2 ＝ 12（長 ＋ 寬），12 − 7 ＝ 5', null]]
    .forEach(([t, good]) => {
      const r = scanEquations(t).filter(e => !e.trivial && !e.question);
      if (good === null){ if (r.length !== 2 || r.some(e => e.bad)) fail('scanEquations() self-test: "' + t + '" should read two correct equations, got ' + JSON.stringify(r)); return; }
      if (r.length !== 1 || (r[0].bad === null) !== good) fail('scanEquations() self-test: "' + t + '" should be ' + (good ? 'accepted' : 'rejected') + ', got ' + JSON.stringify(r));
    });

  /* --- 0b. renderCheck 自己也先證明會響：7 × 4 的長方形，標籤放對的要過；長寬標反、字壓在角上、少了「?」都要擋 --- */
  {
    const rc = module.exports.sim.renderCheck;
    const T = (x, y, a, t) => '<text x="' + x + '" y="' + y + '" font-size="14" font-weight="700" text-anchor="' + a + '">' + t + '</text>';
    const svg = labels => '<svg class="scene" viewBox="0 0 200 150" role="img"><path d="M40.0,104.0 L152.0,104.0 L152.0,40.0 L40.0,40.0 Z" fill="#FDF0E0"/>' + labels.join('') + '</svg>';
    const good = svg([T(96, 124, 'middle', '長 7 公分'), T(26, 77, 'end', '寬 4 公分')]);
    [['good', good, 'rectPerimeter', { l:7, w:4 }, true],
     ['swapped', svg([T(96, 124, 'middle', '長 4 公分'), T(26, 77, 'end', '寬 7 公分')]), 'rectPerimeter', { l:7, w:4 }, false],
     ['on the corner', svg([T(96, 124, 'middle', '長 7 公分'), T(40, 109, 'middle', '4')]), 'rectPerimeter', { l:7, w:4 }, false],
     ['no "?"', good, 'reverseRectSide', { l:7, w:4 }, false],
     ['"?" on the length', svg([T(96, 124, 'middle', '長 ?'), T(26, 77, 'end', '寬 4 公分')]), 'reverseRectSide', { l:7, w:4 }, false],
     ['"?" on the width', svg([T(96, 124, 'middle', '長 7 公分'), T(26, 77, 'end', '寬 ?')]), 'reverseRectSide', { l:7, w:4 }, true],
     ['"??" on the width', svg([T(96, 124, 'middle', '長 7 公分'), T(26, 77, 'end', '寬 ??')]), 'reverseRectSide', { l:7, w:4 }, false]]
      .forEach(([name, shape, gen, d, ok]) => { const r = rc(d, { shape }, 'zh', gen); if (!r !== ok) fail('renderCheck() self-test "' + name + '": should ' + (ok ? 'pass' : 'fail') + ', got ' + (r || 'pass')); });
  }

  /* --- 1. 每一條 I18N 字串（含題庫 stem()/why() 的回傳值）裡的算式逐條重算 --- */
  const walk = (v, where, out) => {
    if (typeof v === 'string') out.push([where, v]);
    else if (typeof v === 'function' && v.length === 0) walk(v(), where + '()', out);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, where + '[' + i + ']', out));
    else if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], where + '.' + k, out));
    return out;
  };
  let checkedEq = 0;
  LANGS.forEach(L => walk(I18N[L], L, []).forEach(([where, s]) => {
    scanEquations(s).forEach(e => { if (e.question || e.trivial) return; checkedEq++; if (e.bad) fail(where + ': "' + e.text + '" ' + e.bad); });
  }));
  if (checkedEq < 30) fail('only ' + checkedEq + ' equations found in the I18N strings — the arithmetic scan is not reading them');
  /* 題庫：正解要等於自己算的周長／邊長 */
  LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
    let want = null;
    if (q.lshape){ const s = q.lshape; want = 2 * (s.W + s.H); }
    else if (q.kind === 'lshapeDeduce') want = 2 * (q.W + q.H);
    else if (q.kind === 'reverse') want = q.P / 2 - q.l;
    else if (q.kind === 'twoStep') want = 2 * (q.w * 2 + q.w);
    else if (q.s !== undefined) want = 4 * q.s;
    else if (q.l !== undefined) want = 2 * (q.l + q.w);
    const got = Number(q.opts[q.ans]);
    if (want === null) fail(bank + '[' + i + '] ' + L + ': cannot work out the answer');
    else if (got !== want || q.ans_v !== want) fail(bank + '[' + i + '] ' + L + ': answer should be ' + want + ', marked ' + got + ' (ans_v ' + q.ans_v + ')');
    if (q.kind === 'reverse' && q.w !== want) fail(bank + '[' + i + '] ' + L + ': w ' + q.w + ' does not match P and l');
  })));

  /* --- 2. 小遊戲：五關的順序、每一關的題目與提示（兩種語言） --- */
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  const TYPES = ['trace', 'fence', 'square', 'rope', 'same'];
  const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
  if (order === undefined) fail('cannot find GAME_ORDER in index.html');
  else {
    const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
    if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the examples), got ' + types.join());
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
  const inside = (o, what, Wd, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= Wd && o.y + o.h <= H)) fail(what + ' is outside the ' + Wd + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const near = (a, b, t) => Math.abs(a - b) < (t || 1e-6);
  const sumA = a => a.reduce((x, y) => x + y, 0);
  ['GAME_TRACE', 'GAME_FENCE', 'GAME_SQUARE', 'GAME_ROPE', 'GAME_SAME'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
  });

  /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡） */
  const scale = Math.min(1.5, 290 / W);
  const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  tooSmall('GPICK ' + D.GPICK, D.GPICK);
  tooSmall('a side you tap (band ' + 2 * D.TRACE.hit + ')', 2 * D.TRACE.hit);
  tooSmall('a fence piece (height ' + D.STICK.h + ')', D.STICK.h);
  tooSmall('the shortest fence piece', D.stickW(2));
  tooSmall('a fence side box with its pad', 2 * D.FENCE.half + 2 * D.FENCE.pad);
  tooSmall('a card (' + D.SAME_CARD.h + ')', Math.min(D.SAME_CARD.w, D.SAME_CARD.h));
  tooSmall('the rope band', 2 * D.ROPE.band);
  if (D.STICK.h < D.GPICK) fail('a fence piece is thinner than GPICK');
  need('rope', /var sc = addPiece\(B, \{ w:GPICK, h:GPICK, cx:ropeX\(P, a\), cy:R\.scY,/, 'the scissors are not GPICK × GPICK');
  need('fence', /addPiece\(B, \{ w:stickW\(len\), h:STICK\.h, cx:cx, cy:cy, cls:'gstick'/, 'the fence pieces are not stickW(len) × STICK.h');
  need('same', /addPiece\(B, \{ w:C\.w, h:C\.h, cx:cx, cy:cy, cls:'gcard'/, 'the cards are not SAME_CARD sized');

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
    for (let v = 1; v <= 30; v++) seq('gLen ' + L, I18N[L].gLen(v), [v]);
  });
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not give hint 1 automatically');
  if (!/gameStage\.textContent = '';/.test(extractFunction(src, 'startRound') || '')) fail('startRound() does not clear the stage before rendering');

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

  /* --- 第 1 關：繞一圈（範例 1、2） --- */
  {
    const T = D.TRACE;
    /* 自己的常數（不讀頁面的 TRACE）：點擊範圍 32px、虛線兩頭 18px 不算 —— 頁面改了就要先改這裡，說明為什麼 */
    const HIT = 32, GUARD = 18;
    if (T.hit !== HIT || T.guard !== GUARD) fail('TRACE.hit/guard are ' + T.hit + '/' + T.guard + ', the checker expects ' + HIT + '/' + GUARD + ' (a tap band of 64 board px, 18 px dead zone at the dashed line ends)');
    D.GAME_TRACE.forEach((e, i) => {
      const w = 'GAME_TRACE[' + i + ']';
      if (![e.W, e.H, e.p, e.q].every(isInt)) return fail(w + ' is not whole numbers');
      const lens = [e.W, e.H - e.q, e.p, e.q, e.W - e.p, e.H];
      if (lens.some(v => v < 3)) fail(w + ': a side is shorter than 3 cm (' + lens.join() + ') — too short to label');
      if (e.p < 4 || e.q < 4 || e.H - e.q < 4) fail(w + ': the notch sides and the dashed line must be at least 4 cm — their neighbours turn both ways, so a shorter line has no 44 × 44 spot of its own');
      if (e.W - e.p < 3) fail(w + ': the dashed line label does not fit inside the left part (W − p = ' + (e.W - e.p) + ')');
      if (e.q < 3) fail(w + ': the notch is ' + e.q + ' cm high — its two labels collide (needs 3)');
      if (e.H - e.q < 3) fail(w + ': the dashed line is ' + (e.H - e.q) + ' cm — its label ends up nearer the bottom side than the dashed line (needs 3)');
      /* 自己的幾何：(0,0) 在左下角、y 往上 */
      const P0 = (cx, cy) => ({ x:150 - e.W * T.px / 2 + cx * T.px, y:T.base - cy * T.px });
      const c = [[0, 0], [e.W, 0], [e.W, e.H - e.q], [e.W - e.p, e.H - e.q], [e.W - e.p, e.H], [0, e.H]];
      const mine = c.map((a, k) => ({ a:P0(a[0], a[1]), b:P0(c[(k + 1) % 6][0], c[(k + 1) % 6][1]), len:lens[k], inside:false }));
      mine.push({ a:P0(e.W - e.p, 0), b:P0(e.W - e.p, e.H - e.q), len:e.H - e.q, inside:true });
      const segs = D.traceSegs(e);
      if (segs.length !== 7) return fail(w + ': traceSegs() should give 6 sides and 1 dashed line');
      segs.forEach((s, k) => {
        const m = mine[k];
        if (!near(s.a.x, m.a.x) || !near(s.a.y, m.a.y) || !near(s.b.x, m.b.x) || !near(s.b.y, m.b.y) || s.len !== m.len || s.inside !== m.inside || s.i !== k)
          fail(w + ': traceSegs()[' + k + '] is ' + JSON.stringify(s) + ', should be ' + JSON.stringify(m));
        /* 照比例畫：每一條線的 px ÷ 標的公分 都一樣 */
        if (!near(Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y), s.len * T.px, 1e-6)) fail(w + ': line ' + k + ' is not drawn ' + s.len + ' cm long');
      });
      if (sumA(lens) !== 2 * (e.W + e.H)) fail(w + ': the six sides do not add up to the perimeter');
      /* 虛線真的在圖形裡面：兩端在邊上、中間的點在圖形內 */
      const inL = (x, y) => x > 0 && y > 0 && x < e.W && y < e.H && !(x > e.W - e.p && y > e.H - e.q);
      if (!inL(e.W - e.p, (e.H - e.q) / 2)) fail(w + ': the dashed line is not inside the shape');
      /* 版面：每一個標籤在畫板裡、互不重疊、不壓到任何一條線，而且離自己那條線最近 */
      const boxes = segs.map(s => D.traceLabel(e, s));
      boxes.forEach((b, k) => inside(b, w + ' label ' + k, W, D.TRACE_H));
      noHits(boxes, w + ': labels');
      const segHitsBox = (s, b) => { for (let t = 0; t <= 1.0001; t += 0.02){ const x = s.a.x + (s.b.x - s.a.x) * t, y = s.a.y + (s.b.y - s.a.y) * t; if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true; } return false; };
      boxes.forEach((b, k) => segs.forEach((s, j) => { if (segHitsBox(s, b)) fail(w + ': label ' + k + ' covers line ' + j); }));
      boxes.forEach((b, k) => {
        const ctr = { x:b.x + b.w / 2, y:b.y + b.h / 2 }, dOwn = D.segDistPt(ctr, segs[k].a, segs[k].b);
        segs.forEach((s, j) => { if (j !== k && D.segDistPt(ctr, s.a, s.b) < dOwn - 0.5) fail(w + ': label ' + k + ' is nearer line ' + j + ' than its own'); });
      });
      /* traceNearest()：和自己的「最近、而且不平手」逐點比（整塊畫板每 2px） */
      const myNearest = pt => {
        const ds = mine.map(m => {
          const dx = m.b.x - m.a.x, dy = m.b.y - m.a.y, L2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((pt.x - m.a.x) * dx + (pt.y - m.a.y) * dy) / L2));
          return Math.hypot(m.a.x + t * dx - pt.x, m.a.y + t * dy - pt.y);
        });
        const order = ds.map((d, k) => k).sort((a, b) => ds[a] - ds[b]);
        if (ds[order[0]] > HIT || ds[order[1]] - ds[order[0]] < 1) return null;
        const m = mine[order[0]];
        if (m.inside && Math.min(Math.hypot(pt.x - m.a.x, pt.y - m.a.y), Math.hypot(pt.x - m.b.x, pt.y - m.b.y)) < GUARD) return null;   /* 虛線兩頭：不算點到 */
        return order[0];
      };
      let bad = 0;
      for (let x = 0; x <= W; x += 2) for (let y = 0; y <= D.TRACE_H; y += 2){
        const g = D.traceNearest(segs, { x, y }, T.hit, T.guard), m = myNearest({ x, y });
        if ((g ? g.i : null) !== m) bad++;
      }
      if (bad) fail(w + ': traceNearest() disagrees with my nearest-line rule at ' + bad + ' points');
      /* 每一條線都要有一塊點得到它自己的範圍（至少 44 × 44 畫板 px）：在線上離別條線最遠的那一點附近，
         一個 44 × 44 的框裡每一點都點到它自己（不會被別條線搶走、也不會平手）。
         （正中間不一定行：底邊的正中間可能剛好是虛線的腳。） */
      bad = 0;
      segs.forEach((s, k) => {
        const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        let bestT = null, bestD = -1;
        for (let t = 0; t <= 1.0001; t += 0.01){
          const pt = { x:s.a.x + dx * t, y:s.a.y + dy * t };
          const dmin = Math.min(...segs.filter((o, j) => j !== k).map(o => D.segDistPt(pt, o.a, o.b)));
          if (dmin > bestD){ bestD = dmin; bestT = t; }
        }
        const c = { x:s.a.x + dx * bestT, y:s.a.y + dy * bestT };
        /* 44 × 44 的框可以跨在線上偏一點（凹進去的角那一邊比較窄）：試三種位置，有一種整塊都點到自己就算有 */
        const boxMiss = off => { let miss = 0; for (let along = -22; along <= 22; along += 4) for (let o = off - 22; o <= off + 22; o += 2){
          const pt = { x:c.x + ux * along + nx * o, y:c.y + uy * along + ny * o }, g = D.traceNearest(segs, pt, T.hit, T.guard);
          if (!g || g.i !== k) miss++; } return miss; };
        const misses = [0, -10, 10].map(boxMiss);
        if (Math.min(...misses) > 0){ bad++; fail(w + ': line ' + k + ' has no 44 × 44 spot where a tap is surely its own (' + misses.join('/') + ' points go elsewhere)'); }
      });
      /* 角落（兩條邊一樣近）點下去不算任何一條 */
      for (let k = 0; k < 6; k++) if (D.traceNearest(segs, segs[k].b, T.hit, T.guard) !== null) fail(w + ': the corner after side ' + k + ' is given to one side');
      if (D.traceNearest(segs, segs[6].a, T.hit, T.guard) !== null) fail(w + ': where the dashed line meets the bottom is given to one line');
      /* 手指瞄底邊、落在虛線的腳旁邊（12px 以內、底邊上方）：不可以被判成「點了虛線」（那是扣分的錯） */
      let footBad = 0;
      for (let dx = -12; dx <= 12; dx++) for (let dy = 0; dy <= 12; dy++){ const g = D.traceNearest(segs, { x:segs[6].a.x + dx, y:segs[6].a.y - dy }, T.hit, T.guard); if (g && g.inside) footBad++; }
      if (footBad) fail(w + ': ' + footBad + ' taps right beside the foot of the dashed line count as tapping the dashed line');
      /* 照遊戲的規則從頭玩：任何順序點完六條邊，加起來都是周長；虛線永遠不算 */
      [[0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0], [2, 0, 4, 1, 5, 3]].forEach(ord => {
        const arr = ord.map(k => lens[k]);
        LANGS.forEach(L => {
          const d = I18N[L];
          for (let n = 1; n <= 6; n++) seq(w + ' gTraceNow ' + L, d.gTraceNow(arr.slice(0, n)), n > 1 ? arr.slice(0, n).concat([sumA(arr.slice(0, n))]) : arr.slice(0, 1));
          seq(w + ' gTraceDone ' + L, d.gTraceDone(arr, sumA(arr)), arr.concat([2 * (e.W + e.H)]));
        });
      });
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gTraceNow(empty) ' + L, d.gTraceNow([]), []);
        seq(w + ' gTraceInside ' + L, d.gTraceInside(e.H - e.q), [e.H - e.q]);
        lens.forEach(v => seq(w + ' gTraceTwice ' + L, d.gTraceTwice(v), [v]));
        for (let n = 1; n <= 6; n++) seq(w + ' gTrace2 ' + L, d.gTrace2(n), [2, n]);
      });
    });
    need('trace', /var s = traceNearest\(segs, pt, TRACE\.hit, TRACE\.guard\);\s*if \(!s\) return;/, 'a tap is not resolved by traceNearest(), or a tap between lines is not silent');
    need('trace', /if \(s\.inside\)\{ roundMiss\(d\.gTraceInside\(s\.len\)\); return; \}/, 'tapping the dashed line inside is accepted');
    need('trace', /if \(lit\.indexOf\(s\.i\) >= 0\)\{ roundMiss\(d\.gTraceTwice\(s\.len\)\); return; \}/, 'a side can be counted twice');
    need('trace', /if \(lit\.length === 6\) roundSolved\(d\.gTraceDone\(order, sumOf\(order\)\)\);/, 'the round is not solved exactly when all six sides are measured');
    need('trace', /lit\.push\(s\.i\); order\.push\(s\.len\);/, 'a measured side is not recorded with its length');
  }

  /* --- 第 2 關：圍籬笆（範例 3） --- */
  {
    const F = D.FENCE, TR = D.FENCE_TRAY;
    D.GAME_FENCE.forEach((e, i) => {
      const w = 'GAME_FENCE[' + i + ']';
      if (![e.l, e.w, e.x].every(isInt)) return fail(w + ' is not whole numbers');
      if (!(e.l - e.w >= 2)) fail(w + ': the length ' + e.l + ' should be at least 2 cm longer than the width ' + e.w + ' (so the two kinds of piece look different)');
      if (e.w < 2 || e.l > 7 || e.w > 5) fail(w + ': sides should be 2~7 × 2~5 (the board holds a 7 × 5 rectangle)');
      if (e.x === e.l || e.x === e.w || e.x < 2 || e.x > 7) fail(w + ': the odd piece ' + e.x + ' should be 2~7 and differ from ' + e.l + ' and ' + e.w);
      const hl = e.l * F.px / 2, hw = e.w * F.px / 2;
      const mine = [
        { len:e.l, cx:150, cy:F.cy + hw, hw:hl, hh:F.half, vert:false }, { len:e.w, cx:150 + hl, cy:F.cy, hw:F.half, hh:hw, vert:true },
        { len:e.l, cx:150, cy:F.cy - hw, hw:hl, hh:F.half, vert:false }, { len:e.w, cx:150 - hl, cy:F.cy, hw:F.half, hh:hw, vert:true }];
      const slots = D.fenceSlots(e);
      if (JSON.stringify(slots.map(s => [s.len, s.cx, s.cy, s.hw, s.hh, s.vert])) !== JSON.stringify(mine.map(s => [s.len, s.cx, s.cy, s.hw, s.hh, s.vert]))) fail(w + ': fenceSlots() is not the four sides of an ' + e.l + ' × ' + e.w + ' rectangle');
      /* 放好的籬笆：在畫板裡、不壓到標籤 */
      const placed = mine.map(s => s.vert ? sq(s.cx, s.cy, D.STICK.h, D.stickW(s.len)) : sq(s.cx, s.cy, D.stickW(s.len), D.STICK.h));
      placed.forEach((o, k) => inside(o, w + ' placed piece ' + k, W, D.FENCE_H));
      const lblL = { x:150 - 60, y:F.cy + hw + F.lblGap - 10, w:120, h:20 }, lblW = { x:150 - hl - F.lblSide - 48, y:F.cy - 20, w:48, h:40 };
      inside(lblL, w + ' the length label', W, D.FENCE_H); inside(lblW, w + ' the width label', W, D.FENCE_H);
      placed.forEach((o, k) => { if (hit({ x:o.x, y:o.y + (D.STICK.h - D.STICK.bar) / 2, w:o.w, h:D.STICK.bar }, lblL) || hit({ x:o.x + (o.w > o.h ? 0 : (D.STICK.h - D.STICK.bar) / 2), y:o.y, w:o.w > o.h ? o.w : D.STICK.bar, h:o.h }, lblW)) fail(w + ': placed piece ' + k + ' covers a label'); });
      /* 托盤：每一種洗牌順序都排得下（不出界、不重疊、最多三排、在長方形下面） */
      const items = [e.l, e.l, e.w, e.w, e.x];
      const perms = []; (function per(a, r){ if (!a.length) return perms.push(r); a.forEach((v, k) => per(a.slice(0, k).concat(a.slice(k + 1)), r.concat([v]))); })(items, []);
      let worstRows = 0;
      perms.forEach(pm => {
        const pos = D.fenceTray(pm), boxes = pos.map((p, k) => sq(p.x, p.y, D.stickW(pm[k]), D.STICK.h));
        boxes.forEach((o, k) => inside(o, w + ' tray piece ' + k + ' (' + pm.join() + ')', W, D.FENCE_H));
        noHits(boxes, w + ' tray (' + pm.join() + '): pieces');
        const rows = new Set(pos.map(p => p.y)).size; worstRows = Math.max(worstRows, rows);
        boxes.forEach(o => { if (o.y < lblL.y + lblL.h + 4) fail(w + ': a tray piece reaches the length label'); });
      });
      if (worstRows > 3) fail(w + ': the tray needs ' + worstRows + ' rows');
      /* 放進哪一條邊：每一條邊的框裡（含 pad）的點都給自己；而且照遊戲的規則：只有一樣長的才收 */
      if (nearestOpen){
        const PAD = 8;   /* 自己的常數：放籬笆的框四邊各放寬 8px */
        if (F.pad !== PAD) fail('FENCE.pad is ' + F.pad + ', the checker expects ' + PAD);
        const list = mine.map((s, k) => Object.assign({ id:k, done:false }, s));
        let bad = 0;
        /* 自己的規則：離框最近（框裡是 0），一樣近才比中心 —— 不呼叫頁面的函式 */
        const mineNearest = pt => {
          let best = null, bd = Infinity, bc = Infinity;
          list.forEach(b => { const dx = pt.x - b.cx, dy = pt.y - b.cy; if (Math.abs(dx) > b.hw + PAD || Math.abs(dy) > b.hh + PAD) return;
            const ex = Math.max(0, Math.abs(dx) - b.hw), ey = Math.max(0, Math.abs(dy) - b.hh), dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;
            if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; } });
          return best;
        };
        let own = 0, total = 0;
        list.forEach(s => { for (let x = s.cx - s.hw - PAD; x <= s.cx + s.hw + PAD; x += 2) for (let y = s.cy - s.hh - PAD; y <= s.cy + s.hh + PAD; y += 2){
          const g = nearestOpen(list, { x, y }, F.pad), m = mineNearest({ x, y });
          if ((g ? g.id : null) !== (m ? m.id : null)) bad++;
          const inOther = list.some(o => o !== s && Math.abs(x - o.cx) <= o.hw + PAD && Math.abs(y - o.cy) <= o.hh + PAD);
          if (Math.abs(x - s.cx) <= s.hw && Math.abs(y - s.cy) <= s.hh && !inOther){ total++; if (g && g.id === s.id) own++; }
        } });
        /* 而且每一條邊的框裡、不在別的框（含 pad）範圍內的點，全部給它自己 */
        if (own !== total || total < 200) fail(w + ': only ' + own + ' of ' + total + ' points inside a fence side box (and in no other box) go to that side');
        if (bad) fail(w + ': ' + bad + ' points around the fence sides are given to a different side than the nearest-box rule says');
      }
      const fits = (v, s) => v === s.len;
      if (mine.filter(s => fits(e.l, s)).length !== 2 || mine.filter(s => fits(e.w, s)).length !== 2 || mine.some(s => fits(e.x, s))) fail(w + ': the pieces do not fill the four sides exactly (two l, two w, x fits nowhere)');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gFenceL ' + L, d.gFenceL(e.l), [e.l]);
        seq(w + ' gFenceW ' + L, d.gFenceW(e.w), [e.w]);
        mine.forEach(s => [e.l, e.w].forEach(v => { if (v !== s.len) seq(w + ' gFenceNot ' + L, d.gFenceNot(v, s.len), [v, s.len]); }));
        seq(w + ' gFenceOdd ' + L, d.gFenceOdd(e.x, e.l, e.w), [e.x, e.l, e.w]);
        mine.forEach(s => seq(w + ' gFence2 ' + L, d.gFence2(s.len), [2, s.len]));
        const run = [e.w, e.l, e.w, e.l];
        seq(w + ' gFenceNow(empty) ' + L, d.gFenceNow([]), []);
        for (let n = 1; n <= 4; n++) seq(w + ' gFenceNow ' + L, d.gFenceNow(run.slice(0, n)), n > 1 ? run.slice(0, n).concat([sumA(run.slice(0, n))]) : run.slice(0, 1));
        seq(w + ' gFenceDone ' + L, d.gFenceDone(e.l, e.w, (e.l + e.w) * 2), [e.l, e.w, e.l, e.w, e.l, e.w, 2, (e.l + e.w) * 2]);
      });
    });
    [2, 3, 5, 7].forEach(v => { const sw = D.stickW(v); if (sw !== Math.max(D.GPICK, v * F.px)) fail('stickW(' + v + ') is ' + sw + ', should be max(GPICK, ' + v + ' × ' + F.px + ')'); });
    if (TR.y - D.STICK.h / 2 < F.cy + 50 + F.half + F.pad) fail('fence: the tray reaches the bottom side of the biggest rectangle');
    need('fence', /var s = nearestOpen\(slots, pt, F\.pad\);\s*if \(!s\) return false;/, 'a drop away from every side is not silent');
    need('fence', /if \(v !== s\.len\)\{ roundMiss\(v !== e\.l && v !== e\.w \? d\.gFenceOdd\(v, e\.l, e\.w\) : d\.gFenceNot\(v, s\.len\)\); return false; \}/, 'a piece is accepted on a side of a different length, or the odd piece has no reason of its own');
    need('fence', /renderTray\(\[e\.l, e\.l, e\.w, e\.w, e\.x\], fenceTray,/, 'the tray is not l, l, w, w and the odd piece');
    need('fence', /if \(used\.length === 4\) roundSolved\(d\.gFenceDone\(e\.l, e\.w, \(e\.l \+ e\.w\) \* 2\)\);/, 'the round is not solved exactly when the four sides are fenced');
    need('fence', /if \(s\.vert\)\{ P\.size\(STICK\.h, stickW\(v\)\); P\.el\.classList\.add\('vert'\); \}/, 'a piece on a left/right side is not turned upright');
  }

  /* --- 第 3 關：正方形（範例 4） --- */
  {
    const Q = D.SQUARE;
    const maxLen = +((B.square.match(/inp\.maxLength = (\d+);/) || [])[1]);
    if (!maxLen) fail('square: cannot read the answer box maxLength');
    D.GAME_SQUARE.forEach((s, i) => {
      const w = 'GAME_SQUARE[' + i + ']';
      if (!isInt(s) || s < 2) return fail(w + ' is not a whole number ≥ 2');
      const P = 4 * s, wrongs = { area:s * s, two:2 * s, three:3 * s, plus:s + 4, one:s };
      const vals = Object.values(wrongs).concat([P]);
      if (new Set(vals).size !== vals.length) fail(w + ': side ' + s + ' makes two kinds of mistake land on the same number (' + JSON.stringify(wrongs) + ', answer ' + P + ') — the reason would be a guess');
      if (String(s * s).length > maxLen || String(P).length > maxLen) fail(w + ': the answer box (' + maxLen + ' digits) cannot hold ' + s * s);
      const side = s * Q.px;
      inside(sq(150, Q.cy, side), w + ' the square', W, D.SQUARE_H);
      inside({ x:80, y:Q.cy + side / 2 + 10, w:140, h:20 }, w + ' the label', W, D.SQUARE_H);
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gSqLbl ' + L, d.gSqLbl(s), [s]);
        seq(w + ' gSqNow ' + L, d.gSqNow(s, null), [s]);
        seq(w + ' gSqNow(P) ' + L, d.gSqNow(s, P), [s, 4, P]);
        seq(w + ' gSqArea ' + L, d.gSqArea(s, s * s), [s, s, s * s]);
        seq(w + ' gSqTwo ' + L, d.gSqTwo(s, 2 * s), [s, s, 2 * s]);
        seq(w + ' gSqThree ' + L, d.gSqThree(s, 3 * s), [s, 3, 3 * s]);
        seq(w + ' gSqPlus ' + L, d.gSqPlus(s, s + 4), [s, 4, s + 4, s, 4, 4]);
        seq(w + ' gSqOne ' + L, d.gSqOne(s), [s]);
        seq(w + ' gSqWrong ' + L, d.gSqWrong(s, P + 1), [P + 1, s]);
        seq(w + ' gSquare2 ' + L, d.gSquare2(s), [2, s, s, s, s, s, s, 4]);
        seq(w + ' gSqDone ' + L, d.gSqDone(s, P), [s, s, s, s, s, 4, P]);
      });
    });
    LANGS.forEach(L => { if (nums(I18N[L].gSqEmpty).join() !== '0') fail('gSqEmpty ' + L + ' should only mention the leading 0'); });
    need('square', /var s = pick\(GAME_SQUARE\), P = s \* 4,/, 'the answer is not side × 4');
    need('square', /var t = inp\.value\.trim\(\);\s*if \(!\/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(t\)\)\{ gMsg\.textContent = d\.gSqEmpty; return; \}/, 'an empty or malformed answer ("3 4", "034") is counted as a mistake or read as a number');
    need('square', /if \(v === P\)\{[\s\S]*?roundSolved\(d\.gSqDone\(s, P\)\);\s*\}\s*else if \(v === s \* s\) roundMiss\(d\.gSqArea\(s, v\)\);\s*else if \(v === s \* 2\) roundMiss\(d\.gSqTwo\(s, v\)\);\s*else if \(v === s \* 3\) roundMiss\(d\.gSqThree\(s, v\)\);\s*else if \(v === s \+ 4\) roundMiss\(d\.gSqPlus\(s, v\)\);\s*else if \(v === s\) roundMiss\(d\.gSqOne\(s\)\);\s*else roundMiss\(d\.gSqWrong\(s, v\)\);/, 'a wrong perimeter is accepted, or a misconception has no reason of its own');
    need('square', /svgEl\(svg, 'rect', \{ x:x0, y:y0, width:side, height:side,/, 'the square is not drawn side × side');
  }

  /* --- 第 4 關：剪繩子（範例 5） --- */
  {
    const R = D.ROPE;
    for (let k = 1; k < 3; k++) if (R.y2 - R.y1 < 2 * R.band) fail('rope: the two rope rows are closer than their tap bands');
    D.GAME_ROPE.forEach((e, i) => {
      const w = 'GAME_ROPE[' + i + ']';
      if (!isInt(e.l) || !isInt(e.w)) return fail(w + ' is not whole numbers');
      const P = 2 * (e.l + e.w), h = P / 2;
      if (!(e.l > e.w && e.w >= 2)) fail(w + ': should be a length longer than a width ≥ 2');
      if (P > 26) fail(w + ': a ' + P + ' cm rope does not fit the board at ' + R.px + ' px per cm');
      /* 繩子的位置：ropeX 和自己的算法逐格比；整條繩子在畫板裡 */
      for (let a = 0; a <= P; a++) if (!near(D.ropeX(P, a), 150 - P * R.px / 2 + a * R.px)) fail(w + ': ropeX(' + P + ', ' + a + ') is off');
      if (D.ropeX(P, 1) - D.GPICK / 2 < 0 || D.ropeX(P, P - 1) + D.GPICK / 2 > W || D.ropeX(P, 0) < 4 || D.ropeX(P, P) > W - 4) fail(w + ': the rope (or the scissors at 1 and ' + (P - 1) + ' cm) does not fit inside the board');
      /* ropeSnap：每一個 x 都吸到最近的整數公分，而且夾在範圍裡 */
      for (let x = -20; x <= W + 20; x += 0.5){
        const want = Math.max(1, Math.min(P - 1, Math.round((x - (150 - P * R.px / 2)) / R.px)));
        if (D.ropeSnap(P, x, 1, P - 1) !== want){ fail(w + ': ropeSnap(' + x + ') is ' + D.ropeSnap(P, x, 1, P - 1) + ', should be ' + want); break; }
      }
      /* 照遊戲的規則把每一刀都試一次：第一刀只有 h 收；第二刀只有 l 或 w 收，兩種剪法剩下的都是寬 */
      /* ropeCutOk()（頁面的函式）逐刀問一次，和自己的判斷比：第一刀只有「兩邊一樣長」收；第二刀只有「兩段剛好是長和寬」收 */
      for (let a = 1; a <= P - 1; a++){ const mine = (a === P - a); if (D.ropeCutOk(1, a, e) !== mine) fail(w + ': the first cut at ' + a + ' is ' + (mine ? 'rejected although both halves are ' + a : 'accepted although the halves are ' + a + ' and ' + (P - a))); }
      for (let a = 1; a <= h - 1; a++){ const pc = [a, h - a].sort((x, y) => x - y).join(), mine = pc === [e.w, e.l].join();
        if (D.ropeCutOk(2, a, e) !== mine) fail(w + ': the second cut at ' + a + ' is ' + (mine ? 'rejected although it leaves the length and the width' : 'accepted although it leaves ' + a + ' and ' + (h - a))); }
      if (2 !== h && e.l !== 2 && e.w !== 2 && 1 === e.w) fail(w + ': the scissors start on an answer');
      if (h === 2 || e.l === 1 || e.w === 1) fail(w + ': the scissors start on an answer (they start at 2, then at 1)');
      /* 小圖：照比例、標籤在畫板裡 */
      const pw = e.l * R.picPx, ph = e.w * R.picPx;
      inside(sq(150, R.picY, pw, ph), w + ' the picture', W, D.ROPE_H);
      inside({ x:150 - pw / 2 - 8 - 80, y:R.picY - 10, w:80, h:20 }, w + ' the width label', W, D.ROPE_H);
      if (R.picY + ph / 2 + 4 + 20 > R.lblY - 10) fail(w + ': the picture label reaches the rope label');
      /* 剪完之後兩段的標籤：兩種剪法 × 兩種語言，照字估寬（15px 粗體：中文 1 字寬、數字與英文 0.62、空白 0.3，再多 6%），
         兩個字的範圍不可以碰在一起（至少 4px），也不可以壓到下面那一段繩子或「另一半」的標籤（2026-10-02 驗證抓到：2 公分那一段的「寬 2 公分」和隔壁的「6 公分」黏成一串） */
      const textW = t => [...String(t).replace(/<[^>]+>/g, '')].reduce((a, c) => a + (/[一-鿿]/.test(c) ? 1 : c === ' ' ? 0.3 : 0.62), 0) * 15 * 1.06;
      [e.l, e.w].forEach(a => LANGS.forEach(L => {
        const lbs = D.ropePieceLabels(e, a);
        if (lbs.length !== 2 || lbs.map(x => x.v).sort((x, y) => x - y).join() !== [e.w, e.l].join() || lbs.filter(x => x.wid).length !== 1) return fail(w + ': ropePieceLabels(' + a + ') should label the two pieces ' + e.l + ' and ' + e.w + ' (one of them the width)');
        const rect = lb => { const t = lb.wid ? I18N[L].gRopeWid(lb.v) : I18N[L].gLen(lb.v), tw = textW(t); return { x:lb.x + lb.w / 2 - tw / 2, y:lb.y, w:tw, h:lb.h, t }; };
        const [r0, r1] = lbs.map(rect);
        const gapX = Math.max(r1.x - (r0.x + r0.w), r0.x - (r1.x + r1.w)), overY = Math.min(r0.y + r0.h, r1.y + r1.h) - Math.max(r0.y, r1.y);
        if (overY > 0 && gapX < 4) fail(w + ' ' + L + ': cut at ' + a + ' — the piece labels "' + r0.t + '" and "' + r1.t + '" are ' + gapX.toFixed(1) + 'px apart (need 4)');
        [r0, r1].forEach(r => { inside({ x:r.x, y:r.y, w:r.w, h:r.h }, w + ' ' + L + ' piece label "' + r.t + '"', W, D.ROPE_H); if (r.y + r.h > R.y2 - 6 - 2) fail(w + ' ' + L + ': piece label "' + r.t + '" reaches the other half of the rope'); });
      }));
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gRopeL ' + L, d.gRopeL(e.l), [e.l]);
        seq(w + ' gRopeW(null) ' + L, d.gRopeW(null), []);
        seq(w + ' gRopeW ' + L, d.gRopeW(e.w), [e.w]);
        seq(w + ' gRopeP ' + L, d.gRopeP(P), [P]);
        for (let a = 1; a < P; a++){ seq(w + ' gRopeNow ' + L, d.gRopeNow(a, P - a), [a, P - a]); if (a !== h) seq(w + ' gRopeHalf ' + L, d.gRopeHalf(a, P - a), [a, P - a]); }
        for (let a = 1; a < h; a++) if (a !== e.l && a !== e.w) seq(w + ' gRopeLen ' + L, d.gRopeLen(a, h - a, e.l), [a, h - a, e.l]);
        seq(w + ' gRopeHalfOk ' + L, d.gRopeHalfOk(h), [h]);
        seq(w + ' gRopeOther ' + L, d.gRopeOther(h), [h]);
        seq(w + ' gRopeWid ' + L, d.gRopeWid(e.w), [e.w]);
        seq(w + ' gRope2a ' + L, d.gRope2a(P), [2, P]);
        seq(w + ' gRope2b ' + L, d.gRope2b(h, e.l), [2, h, e.l]);
        seq(w + ' gRopeDone ' + L, d.gRopeDone(P, h, e.l, e.w), [P, 2, h, h, e.l, e.w, e.w]);
      });
    });
    if (R.scY + D.GPICK / 2 > R.y1 - R.band) fail('rope: the scissors sit on the rope tap band');
    if (R.lblY + 10 > R.scY - D.GPICK / 2) fail('rope: the rope label reaches the scissors');
    if (R.y2 + 12 > D.ROPE_H) fail('rope: the second rope row is outside the board');
    need('rope', /var e = pick\(GAME_ROPE\), P = \(e\.l \+ e\.w\) \* 2, h = P \/ 2, R = ROPE, step = 1, lo = 1, hi = P - 1, a = 2;/, 'the rope is not (l + w) × 2, or the scissors do not start at 2');
    need('rope', /if \(step === 1\)\{\s*if \(!ropeCutOk\(1, a, e\)\)\{ roundMiss\(d\.gRopeHalf\(a, P - a\)\); return; \}\s*step = 2; lo = 1; hi = h - 1;/, 'the first cut is not judged by ropeCutOk(1, …)');
    need('rope', /if \(!ropeCutOk\(2, a, e\)\)\{ roundMiss\(d\.gRopeLen\(a, b, e\.l\)\); return; \}/, 'the second cut is not judged by ropeCutOk(2, …)');
    need('rope', /roundSolved\(d\.gRopeDone\(P, h, e\.l, e\.w\)\);/, 'the result is not P ÷ 2 − l');
    need('rope', /if \(gSolved \|\| sc\.busy\(\)\) return;/, '✂️ works while the scissors are being dragged');
    need('rope', /ropePieceLabels\(e, a\)\.forEach\(function\(lb\)\{\s*pieces\.push\(addLabel\(B, \{ x:lb\.x, y:lb\.y, w:lb\.w, h:lb\.h,/, 'the piece labels are not placed by ropePieceLabels()');
    need('rope', /moveTo\(1\);/, 'the second cut does not start at 1');
    need('rope', /function moveTo\(na\)\{\s*a = Math\.max\(lo, Math\.min\(hi, na\)\);/, 'the scissors are not kept inside the rope');
  }

  /* --- 第 5 關：分一分（範例 6） --- */
  {
    const C = D.SAME_CARD, SB = D.SAME_BIN;
    D.GAME_SAME.forEach((e, i) => {
      const w = 'GAME_SAME[' + i + ']';
      const all = e.yes.concat(e.no);
      if (e.yes.length !== 2 || e.no.length !== 2) return fail(w + ': should be two cards that are ' + e.P + ' around and two that are not');
      if (!all.every(r => r.length === 2 && isInt(r[0]) && isInt(r[1]) && r[0] >= r[1] && r[1] >= 2)) fail(w + ': each card is [length, width] with length ≥ width ≥ 2');
      if (new Set(all.map(r => r.join('x'))).size !== 4) fail(w + ': two cards are the same rectangle');
      e.yes.forEach(r => { if (2 * (r[0] + r[1]) !== e.P) fail(w + ': ' + r.join(' × ') + ' is not ' + e.P + ' around'); });
      e.no.forEach(r => { if (2 * (r[0] + r[1]) === e.P) fail(w + ': ' + r.join(' × ') + ' IS ' + e.P + ' around'); });
      if (e.yes[0][0] * e.yes[0][1] === e.yes[1][0] * e.yes[1][1]) fail(w + ': the two ' + e.P + ' cards have the same area — "same perimeter, different area" is not shown');
      if (!e.no.some(r => e.yes.some(y => y[0] * y[1] === r[0] * r[1]))) fail(w + ': no card that is not ' + e.P + ' has the same area as one that is — sorting by size would never be wrong');
      all.forEach(r => { if (r[0] * C.px > C.w - 30 || r[1] * C.px > C.h - 36) fail(w + ': a ' + r.join(' × ') + ' card does not fit (with its labels)'); });
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gSameYes ' + L, d.gSameYes(e.P), [e.P]);
        seq(w + ' gSameNoBin ' + L, d.gSameNoBin(e.P), [e.P]);
        all.forEach(r => seq(w + ' gSameCard ' + L, d.gSameCard(r[0], r[1]), [r[0], r[1]]));
        e.no.forEach(r => {
          const X = 2 * (r[0] + r[1]), A = r[0] * r[1];
          seq(w + ' gSameNo ' + L, d.gSameNo(r[0], r[1], X, e.P), [r[0], r[1], 2, X, e.P]);
          if (e.yes.some(y => y[0] * y[1] === A)) seq(w + ' gSameNoArea ' + L, d.gSameNoArea(r[0], r[1], X, e.P, A), [A, r[0], r[1], 2, X, e.P]);
        });
        e.yes.forEach(r => seq(w + ' gSameIs ' + L, d.gSameIs(r[0], r[1], e.P), [r[0], r[1], 2, e.P, e.P]));
        all.forEach(r => seq(w + ' gSame2 ' + L, d.gSame2(r[0], r[1], 2 * (r[0] + r[1])), [2, r[0], r[1], 2, 2 * (r[0] + r[1])]));
        seq(w + ' gSameDone ' + L, d.gSameDone(e.P, e.yes[0][0] * e.yes[0][1], e.yes[1][0] * e.yes[1][1]), [e.P, e.yes[0][0] * e.yes[0][1], e.yes[1][0] * e.yes[1][1]]);
        for (let n = 0; n <= 4; n++) seq(w + ' gSameNow ' + L, d.gSameNow(n), [n, 4]);
      });
    });
    const cards = D.SAME_POS.map(p => sq(p[0], p[1], C.w, C.h)), bins = SB.x.map(x => sq(x, SB.y, SB.w, SB.h));
    if (D.SAME_POS.length !== 4) fail('same: SAME_POS should hold four places');
    cards.concat(bins).forEach((o, k) => inside(o, 'same: part ' + k, W, D.SAME_H));
    noHits(cards.concat(bins), 'same: cards and bins');
    if (nearestOpen){
      const list = SB.x.map((x, b) => ({ id:b, cx:x, cy:SB.y, hw:SB.w / 2, hh:SB.h / 2, done:false }));
      cards.forEach((c, k) => { if (nearestOpen(list, { x:c.x + c.w / 2, y:c.y + c.h / 2 }, 6)) fail('same: a card at home already counts as dropped in a bin'); });
    }
    [0, 1].forEach(b => {
      const at = [0, 1].map(k => D.sameBinXY(b, k)), small = at.map(p => sq(p.x, p.y, C.w * D.SAME_SMALL, C.h * D.SAME_SMALL));
      small.forEach((o, k) => { const bx = bins[b]; if (!(o.x >= bx.x + 2 && o.x + o.w <= bx.x + bx.w - 2 && o.y >= bx.y + SB.lblH && o.y + o.h <= bx.y + bx.h - 2)) fail('same: sorted card ' + k + ' sticks out of bin ' + b + ' (or covers its label)'); });
      noHits(small, 'same: sorted cards in bin ' + b);
    });
    need('same', /if \(bn\.b === 0 && !it\.yes\)\{[\s\S]*?roundMiss\(twin \? d\.gSameNoArea\(it\.a, it\.b, X, e\.P, it\.a \* it\.b\) : d\.gSameNo\(it\.a, it\.b, X, e\.P\)\);\s*return false;\s*\}/, 'a card that is not P is accepted in ✅');
    need('same', /if \(bn\.b === 1 && it\.yes\)\{ roundMiss\(d\.gSameIs\(it\.a, it\.b, e\.P\)\); return false; \}/, 'a card that is P is accepted in ❌');
    need('same', /var twin = e\.yes\.filter\(function\(r\)\{ return r\[0\] \* r\[1\] === it\.a \* it\.b; \}\)\[0\];/, 'the same-area reason is not tied to a card that really has the same area');
    need('same', /var items = e\.yes\.map\(function\(r\)\{ return \{ a:r\[0\], b:r\[1\], yes:true \}; \}\)\.concat\(e\.no\.map\(function\(r\)\{ return \{ a:r\[0\], b:r\[1\], yes:false \}; \}\)\);/, 'the cards are not the pool\'s yes and no rectangles');
    need('same', /if \(sorted === 4\)\{\s*roundSolved\(/, 'the round is not solved exactly when the four cards are sorted');
    need('same', /var at = sameBinXY\(bn\.b, inBin\[bn\.b\]\+\+\);/, 'a sorted card is not placed at sameBinXY()');
  }
}

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)', find:"    shuffle(items).forEach(function(it, i, arr){ if (!pos) pos = layout(arr); mk(it, pos[i].x, pos[i].y); });", replace:"    items.forEach(function(it, i, arr){ if (!pos) pos = layout(arr); mk(it, pos[i].x, pos[i].y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['trace', 'fence', 'square', 'rope', 'same'];", replace:"var GAME_ORDER = ['trace', 'square', 'fence', 'rope', 'same'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next slot', find:"    return best && !best.done ? best : null;\n  }", replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }" },
    { file:'index', expect:'ahead mode does not give hint 1', find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }", replace:"    if (false){ hintLevel = 1; showHint(); }" },
    { file:'index', expect:'does not clear the stage', find:"    elHint.textContent = '';\n    gameStage.textContent = '';", replace:"    elHint.textContent = '';" },

    /* 繞一圈 */
    { file:'index', expect:'a side you tap', find:'TRACE = { px:24, base:216, hit:32,', replace:'TRACE = { px:24, base:216, hit:20,' },
    { file:'index', expect:'the corner after side', find:'    if (!best || bd > hit || second - bd < 1) return null;', replace:'    if (!best || bd > hit) return null;' },
    { file:'index', expect:'beside the foot of the dashed line', find:'hit:32, guard:18,', replace:'hit:32, guard:0,' },
    { file:'index', expect:'traceSegs()[6]', find:"    segs.push({ i:6, len:e.H - e.q, inside:true,", replace:"    segs.push({ i:6, len:e.H - e.q, inside:false," },
    { file:'index', expect:'traceSegs()[4]', find:'    var lens = [e.W, e.H - e.q, e.p, e.q, e.W - e.p, e.H];', replace:'    var lens = [e.W, e.H - e.q, e.p, e.q, e.W - e.p + 1, e.H];' },
    { file:'index', expect:'at least 4 cm', find:'var GAME_TRACE = [ { W:7, H:8, p:4, q:4 },', replace:'var GAME_TRACE = [ { W:7, H:8, p:4, q:3 },' },
    { file:'index', expect:'outside the', find:'hit:32, guard:18, lw:46,', replace:'hit:32, guard:18, lw:60,' },
    { file:'index', expect:'is nearer line', find:"    if (s.inside) return { x:mx - T.gap - T.lw, y:my - T.lh / 2,", replace:"    if (s.inside) return { x:mx - T.gap - T.lw, y:s.a.y - T.lh - 2," },
    { file:'index', expect:'tapping the dashed line inside is accepted', find:"        if (s.inside){ roundMiss(d.gTraceInside(s.len)); return; }\n", replace:'' },
    { file:'index', expect:'a side can be counted twice', find:"        if (lit.indexOf(s.i) >= 0){ roundMiss(d.gTraceTwice(s.len)); return; }", replace:"        if (false){ roundMiss(d.gTraceTwice(s.len)); return; }" },
    { file:'index', expect:'gTraceDone zh', find:"' ＝ ' + sum + ' 公分，這就是周長！'", replace:"' ＝ ' + (sum + 1) + ' 公分，這就是周長！'" },
    { file:'index', expect:'gTraceNow en', find:"(arr.length > 1 ? ' = ' + arr.reduce(function(a, b){ return a + b; }, 0) : '') + ' cm' : 'Tap a side", replace:"(arr.length > 1 ? ' = ' + arr.reduce(function(a, b){ return a + b; }, 1) : '') + ' cm' : 'Tap a side" },

    /* 圍籬笆 */
    { file:'index', expect:'at least 2 cm longer', find:'var GAME_FENCE = [ { l:6, w:3, x:5 },', replace:'var GAME_FENCE = [ { l:6, w:5, x:3 },' },
    { file:'index', expect:'the odd piece', find:'{ l:7, w:4, x:5 },', replace:'{ l:7, w:4, x:4 },' },
    { file:'index', expect:'stickW(', find:'  function stickW(len){ return Math.max(GPICK, len * FENCE.px); }', replace:'  function stickW(len){ return len * FENCE.px; }' },
    { file:'index', expect:'fenceSlots()', find:"      { side:'r', len:e.w,", replace:"      { side:'r', len:e.l," },
    { file:'index', expect:'tray (', find:'FENCE_TRAY = { y:226, row:58, w:280, gap:12 }', replace:'FENCE_TRAY = { y:226, row:58, w:280, gap:-10 }' },
    { file:'index', expect:'reaches the length label', find:'FENCE_TRAY = { y:226,', replace:'FENCE_TRAY = { y:186,' },
    { file:'index', expect:'a piece is accepted on a side of a different length', find:'        if (v !== s.len){ roundMiss(', replace:'        if (v === -1){ roundMiss(' },
    { file:'index', expect:'turned upright', find:"        if (s.vert){ P.size(STICK.h, stickW(v)); P.el.classList.add('vert'); }\n", replace:'' },
    { file:'index', expect:'gFenceDone en', find:"' + ' + w + ') × 2 = ' + P + ' cm.'", replace:"' + ' + w + ') × 2 = ' + (P + 2) + ' cm.'" },
    { file:'index', expect:'gFenceNot zh', find:"'這根是 ' + v + ' 公分，這條邊是 ' + len + ' 公分，放不上去", replace:"'這根是 ' + len + ' 公分，這條邊是 ' + v + ' 公分，放不上去" },

    /* 正方形 */
    { file:'index', expect:'two kinds of mistake', find:'var GAME_SQUARE = [5, 6, 7, 8, 9];', replace:'var GAME_SQUARE = [4, 6, 7, 8, 9];' },
    { file:'index', expect:'a wrong perimeter is accepted', find:'        if (v === P){\n', replace:'        if (v === P || v === s * s){\n' },
    { file:'index', expect:'malformed', find:"        if (!/^(0|[1-9]\\d*)$/.test(t)){ gMsg.textContent = d.gSqEmpty; return; }", replace:"        if (!/^\\d+$/.test(t)){ gMsg.textContent = d.gSqEmpty; return; }" },
    { file:'index', expect:'cannot hold', find:'inp.maxLength = 3;', replace:'inp.maxLength = 1;' },
    { file:'index', expect:'gSqArea en', find:"return s + ' × ' + s + ' = ' + v + ' is the squares", replace:"return s + ' × ' + s + ' = ' + (v + 1) + ' is the squares" },
    { file:'index', expect:'gSquare2 zh', find:"'，也就是 ' + s + ' × 4。'", replace:"'，也就是 ' + s + ' × 3。'" },

    /* 剪繩子 */
    { file:'index', expect:'accepted although the halves are', find:'    if (step === 1) return a === h;', replace:'    if (step === 1) return a > 0;' },
    { file:'index', expect:'accepted although it leaves', find:'    return (a === e.l && h - a === e.w) || (a === e.w && h - a === e.l);', replace:'    return a > 0;' },
    { file:'index', expect:'rejected although it leaves the length and the width', find:'    return (a === e.l && h - a === e.w) || (a === e.w && h - a === e.l);', replace:'    return a === e.l;' },
    { file:'index', expect:'the first cut is not judged by ropeCutOk', find:'          if (!ropeCutOk(1, a, e)){ roundMiss(d.gRopeHalf(a, P - a)); return; }', replace:'          if (a < 1){ roundMiss(d.gRopeHalf(a, P - a)); return; }' },
    { file:'index', expect:'the rope band', find:'ROPE = { px:10, y1:196, y2:270, band:24,', replace:'ROPE = { px:10, y1:196, y2:270, band:20,' },
    { file:'index', expect:'ropeSnap(', find:'Math.round((x - ropeX(P, 0)) / ROPE.px)', replace:'Math.floor((x - ropeX(P, 0)) / ROPE.px)' },
    { file:'index', expect:'does not fit the board', find:'{ l:9, w:4 },', replace:'{ l:10, w:4 },' },
    { file:'index', expect:'do not start at 2', find:'lo = 1, hi = P - 1, a = 2;', replace:'lo = 1, hi = P - 1, a = 3;' },
    { file:'index', expect:'while the scissors are being dragged', find:'        if (gSolved || sc.busy()) return;', replace:'        if (gSolved) return;' },
    { file:'index', expect:'gRopeDone zh', find:"' − ' + l + ' ＝ ' + w + '：寬是 '", replace:"' − ' + l + ' ＝ ' + (w + 1) + '：寬是 '" },
    { file:'index', expect:'the scissors sit on the rope tap band', find:'band:24, scY:146,', replace:'band:24, scY:160,' },
    { file:'index', expect:'the piece labels', find:'lblY:110, lbl1:12, lbl2:34 };', replace:'lblY:110, lbl1:12, lbl2:12 };' },
    { file:'index', expect:'reaches the other half of the rope', find:'lblY:110, lbl1:12, lbl2:34 };', replace:'lblY:110, lbl1:12, lbl2:56 };' },
    { file:'index', expect:'gRopeHalf en', find:"return 'Left ' + a + ' cm, right ' + b + ' cm", replace:"return 'Left ' + a + ' cm, right ' + a + ' cm" },

    /* 分一分 */
    { file:'index', expect:'is not 20 around', find:'{ P:20, yes:[[8, 2], [6, 4]],', replace:'{ P:20, yes:[[8, 2], [7, 4]],' },
    { file:'index', expect:'sorting by size would never be wrong', find:'no:[[5, 4], [7, 6]] },', replace:'no:[[5, 3], [7, 6]] },' },
    { file:'index', expect:'card does not fit', find:'no:[[10, 2], [7, 3]] },', replace:'no:[[12, 2], [7, 3]] },' },
    { file:'index', expect:'is accepted in ✅', find:'        if (bn.b === 0 && !it.yes){', replace:'        if (bn.b === 0 && false){' },
    { file:'index', expect:'is accepted in ❌', find:'        if (bn.b === 1 && it.yes){', replace:'        if (false){' },
    { file:'index', expect:'sorted cards in bin', find:'(k === 0 ? -34 : 34)', replace:'(k === 0 ? -14 : 14)' },
    { file:'index', expect:'cards and bins', find:'SAME_POS = [[80, 62], [220, 62],', replace:'SAME_POS = [[80, 62], [150, 62],' },
    { file:'index', expect:'gSameNoArea zh', find:"'它和另一張一樣大（都是 ' + A + ' 格）", replace:"'它和另一張一樣大（都是 ' + (A + 1) + ' 格）" },
    { file:'index', expect:'same-area reason', find:'return r[0] * r[1] === it.a * it.b; })[0];', replace:'return r[0] === it.a; })[0];' },
    { file:'index', expect:'gSameDone en', find:"'Both cards go ' + P + ' cm around, yet one holds ' + A1", replace:"'Both cards go ' + P + ' cm around, yet one holds ' + A2" },

    /* ---- index.html：題庫與範例字串的算術 ---- */
    { file:'index', expect:'does not add up', find:"'(5 + 3) × 2 = 16 公分，也可以 5+3+5+3=16。'", replace:"'(5 + 3) × 2 = 16 公分，也可以 5+3+5+3=17。'" },
    { file:'index', expect:'answer should be 36', find:"opts:[18,36,27,81], ans:1,\n          why:function(){ return '邊長 × 4", replace:"opts:[18,36,27,81], ans:3,\n          why:function(){ return '邊長 × 4" },

    /* ---- review.html ---- */
    { file:'review', expect:'is copied straight out of the stem', find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });', replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    { file:'review', expect:'is drawn', find:"          shape: renderShape(squareShape(d.s, '?')),", replace:"          shape: renderShape(squareShape(6, '?'))," },
    { file:'review', expect:'needs 2-digit × 2-digit', find:'Math.min(l, w) <= 9 ? l * w : P + 4', replace:'l * w' },
    { file:'review', expect:'opts[ans] != correct', find:'        var m = mixOpts(w, [half, P - l, w - 1, w + 1], [P, l]);', replace:'        var m = mixOpts(half, [w, P - l, w - 1, w + 1], [P, l]);' },
    { file:'review', expect:'"?" sits on side', find:"        var labels = [String(d.W), '?', String(d.p), String(d.q), '?', String(d.H)];", replace:"        var labels = [String(d.W), String(d.H - d.q), String(d.p), String(d.q), '?', '?'];" },
    { file:'review', expect:'which is', find:"          shape: renderShape(rectShape2(d.l, d.w, L.labL + ' ' + L.unit(d.l), L.labW + ' ' + L.unit(d.w))),\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh' ? '(' + d.l", replace:"          shape: renderShape(rectShape2(d.l, d.w, L.labL + ' ' + L.unit(d.w), L.labW + ' ' + L.unit(d.l))),\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh' ? '(' + d.l" },
    { file:'review', expect:'which is', find:"        var labels = d.lens.map(String);", replace:"        var labels = [d.lens[0], d.lens[5], d.lens[2], d.lens[3], d.lens[4], d.lens[1]].map(String);" },
    { file:'review', expect:'"?" sits on side', find:"          shape: renderShape(rectShape2(d.l, d.w, L.labL + ' ' + L.unit(d.l), L.labW + ' ?')),", replace:"          shape: renderShape(rectShape2(d.l, d.w, L.labL + ' ?', L.labW + ' ' + L.unit(d.w)))," },
    { file:'index', expect:'FENCE.pad is', find:'FENCE = { px:20, cy:90, half:16, pad:8,', replace:'FENCE = { px:20, cy:90, half:16, pad:4,' },
    { file:'review', expect:'has no "?" label', find:"          shape: renderShape(rectShape2(d.l, d.w, L.labL + ' ' + L.unit(d.l), L.labW + ' ?')),", replace:"          shape: renderShape(rectShape2(d.l, d.w, L.labL + ' ' + L.unit(d.l), L.labW + ' ' + L.unit(d.w)))," },
    { file:'index', expect:'TRACE.hit/guard are', find:'hit:32, guard:18,', replace:'hit:32, guard:12,' },
    { file:'index', expect:'points around the fence sides', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dd < bd || (dd === bd && dc > bc)){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'does not add up', find:"why:function(){ return '26 ÷ 2 = 13，13 − 9 = 4 公分。'; }", replace:"why:function(){ return '26 ÷ 2 = 13，13 － 9 = 5 公分。'; }" },
    { file:'review', expect:'are not the six sides', find:'  function lSideLens(W, H, p, q){ return [W, H - q, p, q, W - p, H]; }', replace:'  function lSideLens(W, H, p, q){ return [W, H - q, p, q, W - p, H + 1]; }' },
    { file:'review', expect:'which is', find:"          shape: renderShape(rectShape2(d.l, d.w, L.labL + ' ' + L.unit(d.l), L.labW + ' ' + L.unit(d.w))),\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh' ? '(' + d.l", replace:"          shape: renderShape(rectShape2(d.l, d.w, L.labL + ' ' + L.unit(d.l), L.labW + ' ' + L.unit(d.w + 20))),\n          opts: d.opts.map(String), ans: d.ans,\n          why: lang === 'zh' ? '(' + d.l" },
    { file:'review', expect:'ans ', find:'        else if (P1 > P2){ optsArr = [\'A\',\'B\',\'same\',\'cannot\']; ans = 0; }', replace:'        else if (P1 > P2){ optsArr = [\'A\',\'B\',\'same\',\'cannot\']; ans = 1; }' }
  ],

  sim: {
    blockStart: '  /* ---------- 形狀繪圖工具',
    INVARIANTS: {
      rectPerimeter: d => {
        if (!(isInt(d.l) && isInt(d.w) && d.l >= 2 && d.w >= 2)) return 'sides must be whole numbers ≥ 2';
        if (d.P !== (d.l + d.w) * 2) return 'P != (l + w) × 2';
        return areaReach(d.opts, d.l, d.w);
      },
      squarePerimeter: d => { if (!(isInt(d.s) && d.s >= 2) || d.P !== d.s * 4) return 'P != s × 4'; return areaReach(d.opts, d.s, d.s); },
      reverseSquareSide: d => { if (!(isInt(d.s) && d.s >= 2) || d.P !== d.s * 4) return 'P != s × 4'; },
      reverseRectSide: d => {
        if (!(isInt(d.l) && isInt(d.w) && d.w >= 1)) return 'sides must be whole numbers';
        if (d.P !== (d.l + d.w) * 2 || d.half !== d.l + d.w) return 'P / half do not match l and w';
      },
      sumAllSidesIrregular: d => {
        const want = [d.W, d.H - d.q, d.p, d.q, d.W - d.p, d.H];
        if (want.join() !== d.lens.join()) return 'lens ' + d.lens.join() + ' are not the six sides ' + want.join();
        if (want.some(v => !(isInt(v) && v >= 1))) return 'a side is not a whole number ≥ 1: ' + want.join();
        if (d.total !== want.reduce((a, b) => a + b, 0) || d.total !== 2 * (d.W + d.H)) return 'total is not the sum of the six sides';
      },
      lShapeDeduce: d => {
        const want = [d.W, d.H - d.q, d.p, d.q, d.W - d.p, d.H];
        if (want.join() !== d.lens.join()) return 'lens are not the six sides';
        if (want.some(v => !(isInt(v) && v >= 1))) return 'a side is not a whole number ≥ 1: ' + want.join();
        if (d.total !== 2 * (d.W + d.H)) return 'total != 2 × (W + H)';
      },
      comparePerimeters: d => {
        if (![d.l1, d.w1, d.l2, d.w2].every(v => isInt(v) && v >= 1)) return 'a side is not a whole number ≥ 1';
        if (d.P1 !== 2 * (d.l1 + d.w1) || d.P2 !== 2 * (d.l2 + d.w2)) return 'P1 / P2 wrong';
        const want = d.P1 === d.P2 ? 2 : (d.P1 > d.P2 ? 0 : 1);
        if (d.ans !== want) return 'ans ' + d.ans + ' but the comparison says ' + want;
      },
      fenceWordProblem: d => { if (d.P !== (d.l + d.w) * 2) return 'P != (l + w) × 2'; return areaReach(d.opts, d.l, d.w); },
      squareWordProblem: d => { if (d.P !== d.s * 4) return 'P != s × 4'; return areaReach(d.opts, d.s, d.s); }
    },
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'rectPerimeter': case 'fenceWordProblem': return String((d.l + d.w) * 2);
        case 'squarePerimeter': case 'squareWordProblem': return String(d.s * 4);
        case 'reverseSquareSide': return String(d.P / 4);
        case 'reverseRectSide': return String(d.P / 2 - d.l);
        case 'sumAllSidesIrregular': case 'lShapeDeduce': return String(2 * (d.W + d.H));
        case 'comparePerimeters': {
          const a = 2 * (d.l1 + d.w1), b = 2 * (d.l2 + d.w2);
          const k = a === b ? 'same' : (a > b ? 'A' : 'B');
          return lang === 'zh' ? { A:'A 比較長', B:'B 比較長', same:'一樣長' }[k] : { A:'A is longer', B:'B is longer', same:'the same' }[k];
        }
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang, isCorrect){
      if (genId === 'comparePerimeters'){
        const ok = lang === 'zh' ? ['A 比較長', 'B 比較長', '一樣長', '不能比較'] : ['A is longer', 'B is longer', 'the same', 'cannot compare'];
        if (ok.indexOf(s) < 0) return 'option "' + s + '" is not one of the four comparison answers';
        return;
      }
      if (!/^[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a positive whole number';
      const n = +s;
      /* 正解的上限照 review.html 的參數池推：長方形 (14 ＋ 11) × 2 ＝ 50、正方形 13 × 4 ＝ 52、L 形 2 × (11 ＋ 7) ＝ 36、籬笆 (14 ＋ 8) × 2 ＝ 44 */
      if (isCorrect && n > 52) return 'answer ' + n + ' is bigger than any perimeter the generators can make (52)';
      if (n > 126) return 'option ' + n + ' outside 1~126 (the biggest distractor is the area l × w with one one-digit side: 14 × 9)';
    },
    renderCheck: function(d, q, lang, genId){
      const shapes = svgShapes(q.shape);
      const want = {
        rectPerimeter: [[d.l, d.w, d.l, d.w]], fenceWordProblem: [[d.l, d.w, d.l, d.w]], reverseRectSide: [[d.l, d.w, d.l, d.w]],
        squarePerimeter: [[d.s, d.s, d.s, d.s]], squareWordProblem: [[d.s, d.s, d.s, d.s]], reverseSquareSide: [[d.s, d.s, d.s, d.s]],
        sumAllSidesIrregular: [[d.W, d.H - d.q, d.p, d.q, d.W - d.p, d.H]], lShapeDeduce: [[d.W, d.H - d.q, d.p, d.q, d.W - d.p, d.H]],
        comparePerimeters: [[d.l1, d.w1, d.l1, d.w1], [d.l2, d.w2, d.l2, d.w2]]
      }[genId];
      /* 哪幾條邊（照畫的順序：底、右、上、左／L 形的六條）該標「?」—— 就是題目要孩子求的那幾條 */
      const qsides = { reverseRectSide:[3], reverseSquareSide:[0], lShapeDeduce:[1, 4] }[genId] || [];
      if (!want) return 'renderCheck: no expected shape for ' + genId;
      if (shapes.length !== want.length) return 'draws ' + shapes.length + ' shapes, expected ' + want.length;
      for (let k = 0; k < want.length; k++){
        const S = shapes[k];
        if (S.err) return S.err;
        const cm = sideCm(S.pts);
        if (cm.length !== want[k].length || cm.some((v, i) => Math.abs(v - want[k][i]) > 0.01))
          return 'shape ' + k + ' is drawn ' + cm.map(v => v.toFixed(2)).join('/') + ' cm, the data says ' + want[k].join('/');
        /* 每一個標籤屬於離它的錨點最近的那一條邊（renderShape 的排版保證「離自己那條邊最近」），
           那條邊的長度必須就是標籤上的數字；「?」必須剛好落在該求的那幾條邊上 */
        const P = S.pts, seen = {}, qseen = {}, seenClear = {};
        const segD = (x, y, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy))); return Math.hypot(a.x + t * dx - x, a.y + t * dy - y); };
        const leaderOf = lb => {
          let best = null, bd = Infinity;
          S.leaders.forEach(L => { const dd = Math.hypot(L.x1 - lb.x, L.y1 - lb.y); if (dd < bd){ bd = dd; best = L; } });
          if (!best || bd > 40) return null;
          /* 引線另一端是哪一條邊的中點 */
          const mids = P.map((a, i) => { const b = P[(i + 1) % P.length]; return Math.hypot((a.x + b.x) / 2 - best.x2, (a.y + b.y) / 2 - best.y2); });
          return Math.min(...mids) < 0.6 ? mids.indexOf(Math.min(...mids)) : null;
        };
        /* 照「最不會讀錯」的順序分配：引線指定的先、離最近那條邊比離第二近那條邊明顯近的先；
           一樣近的（缺角底的標籤放在角落外面，離兩條邊一樣遠）分給還沒有標籤的那一條 —— 孩子也是這樣讀的 */
        const cand = S.labels.map(lb => {
          const ds = P.map((a, i) => segD(lb.x, lb.y, a, P[(i + 1) % P.length]));
          const order = ds.map((d, i) => i).sort((x, y) => ds[x] - ds[y]);
          const viaLeader = leaderOf(lb);
          /* 「一樣近」只在字落在那個角的**外面**（兩條邊的兩端之外都超出 3px 以上）才算可以靠刪去法讀 ——
             review.html 的缺角底標籤就是這樣放的；字的中心正好壓在角上之類的情形一律不收 */
          const over = i => { const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), t = ((lb.x - a.x) * dx + (lb.y - a.y) * dy) / (L * L); return t < 0 ? -t * L : (t > 1 ? (t - 1) * L : 0); };
          const tie = viaLeader === null && ds[order[1]] - ds[order[0]] < 0.1;   /* 和頁面自己的 nearestIsOwn 一樣：只有「真的一樣近」（掉到角外面）才算平手 */
          if (tie && !(over(order[0]) > 3 && over(order[1]) > 3)) return { bad:'label "' + lb.t + '" is equally near sides ' + order[0] + ' and ' + order[1] };
          return { lb, order: viaLeader !== null ? [viaLeader] : order, margin: viaLeader !== null ? Infinity : ds[order[1]] - ds[order[0]], tie };
        });
        const amb = cand.filter(c => c.bad)[0];
        if (amb) return amb.bad;
        cand.sort((x, y) => y.margin - x.margin);
        for (const c of cand){
          const lb = c.lb;
          /* 刪去法只在另一條邊已經有一個「清楚」（明顯比較近）的標籤時才成立 */
          const free = c.order.slice(0, 2).filter(i => !seen[i]);
          const side = c.tie ? (free.length === 1 && seenClear[c.order.slice(0, 2).filter(i => seen[i])[0]] ? free[0] : undefined) : c.order[0];
          if (side === undefined || seen[side]) return 'two labels sit on side ' + c.order[0] + ' (or a tie that elimination cannot settle)';
          seen[side] = true; if (c.margin >= 1) seenClear[side] = true;
          if (/[?？]/.test(lb.t)){
            if ((lb.t.match(/[?？]/g) || []).length !== 1 || /\d/.test(lb.t)) return 'label "' + lb.t + '" should carry exactly one "?" and no number';
            if ((k === 0 ? qsides : []).indexOf(side) < 0) return '"?" sits on side ' + side + ' (' + want[k][side] + ' cm), expected on ' + JSON.stringify(k === 0 ? qsides : []);
            qseen[side] = true;
            continue;
          }
          const n = nums(lb.t);
          if (n.length !== 1) return 'label "' + lb.t + '" does not carry exactly one number';
          if (n[0] !== want[k][side]) return 'label "' + lb.t + '" sits on side ' + side + ', which is ' + want[k][side] + ' cm';
        }
        const qGot = S.labels.filter(lb => /[?？]/.test(lb.t)).length;
        for (const qs of (k === 0 ? qsides : [])) if (qseen[qs] !== true) return 'side ' + qs + ' (the one to find) has no "?" label';
        if (qGot !== (k === 0 ? qsides.length : 0)) return 'shape ' + k + ' has ' + qGot + ' "?" labels';
      }
    },
    stemEchoOk: {}
  },

  data: {
    dataStart: '  /* ============ 小遊戲「圍籬大挑戰」的題庫與版面',
    dataEnd: '  /* ================= i18n ================= */',
    dataReturn: '{GPICK, TRACE_H, TRACE, GAME_TRACE, tracePt, traceSegs, traceLabel, segDistPt, traceNearest, FENCE_H, FENCE, STICK, FENCE_TRAY, GAME_FENCE, stickW, fenceSlots, fenceTray, SQUARE_H, SQUARE, GAME_SQUARE, ROPE_H, ROPE, GAME_ROPE, ropeX, ropeSnap, ropeCutOk, ropePieceLabels, SAME_H, SAME_CARD, SAME_POS, SAME_BIN, SAME_SMALL, GAME_SAME, sameBinXY}',
    check: function(data, I18N, fail, src){ dataCheck(data, I18N, fail, src); }
  }
};
module.exports._test = { scanEquations, evalExpr, svgShapes };
