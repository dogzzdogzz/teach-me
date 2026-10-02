/* grade-3/math/angle 的檢查設定（角度大搜查：角的頂點與邊、邊長和角的大小無關、用檢查角分直角／銳角／鈍角、直接比較兩個角）。
   2026-10-01 新增 —— 和小遊戲「角度偵探」改成五關五種玩法（§六之五）同一次寫成。這一課在這之前沒有設定檔。

   sim（review.html 的十一個產生器）：每個產生器一組不變條件、正解的第二套實作（只用原始參數重算），
   以及 renderCheck —— **從渲染出來的 SVG 把角量回來**（線的端點座標 → 角度、檢查角那一條是不是在第一條邊的 +90°、
   疊在一起的圖有沒有標 A／B、頂點那一點的字母是哪一個），再和正解比。答案由圖決定，不是由資料決定。
   跑起來抓到的舊缺陷（同一次修好）：vertexIdentify 的頂點永遠是 P、正解永遠是第一個選項；rotationTrueFalse 永遠是小華對、
   正解永遠是第二個，而且題幹說「兩個角都放上了檢查角」圖上卻沒有畫；lifeCompare 試 40 次找不到就拿下一個場景（可能一樣大卻標 B 比較大）；
   chordTrap 試 40 次找不到「端點比較遠」的陷阱就照樣出題，解釋卻說「不要看端點」。

   data（index.html）：
   - 三層題庫：每一題的正解由題目自己的圖形參數重算（比大小看 angleDeg、檢查角題看 angleDeg 和 90 的關係、
     三個角找鈍角、旋轉題兩個都是 90）；疊在一起的圖一定要標 A／B（qsAdv[2] 原本沒有標，圖決定不了答案）。
   - 小遊戲：題庫與版面常數放在 i18n 前面的資料區（dataStart ～ dataEnd），由 dataReturn 交給 check()。
     每一關照遊戲的規則重算答案：cornerHit() 在每一條折線的整張畫板上每 2px 和自己的分類比；openSnap()／openVerdict()／openChordStep()
     在每一格與一張格點上和自己的算法比；印章卡、疊一疊、排一排的角一律**把頁面自己畫出來的 SVG 量回來**；
     nearestOpen() 與 roundMiss() 從原始碼切出來實際執行；只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。
     每一句說明逐個驗它說的話是對的（哪一個在外面、比直角大還是小、端點的那一句說的是「比較短」還是「比較長」）。
     版面數字一律從 index.html 讀：每一格的把手、每一種轉法的 B、每一張卡都在畫板裡、互不重疊、≥ 44px。

   已知極限：RENDER 函式本體的規則是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、
   capture 遺失、畫板不跳動、重疊區挑最近的那一格、375px 的實際尺寸由 teaching-workspace/game-harness/g3-angle 的
   端對端測試驗（合成 PointerEvent），不在這裡。 */

const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');

const isInt = v => Number.isInteger(v);
const near = (a, b, t) => Math.abs(a - b) <= (t === undefined ? 1e-6 : t);
const DEG = Math.PI / 180;
function polar(cx, cy, dir, r){ return { x:cx + r * Math.cos(dir * DEG), y:cy - r * Math.sin(dir * DEG) }; }
/* 方向（數學慣例，0..360） */
function dirOf(x1, y1, x2, y2){ return ((Math.atan2(-(y2 - y1), x2 - x1) / DEG) % 360 + 360) % 360; }
function ccw(d0, d1){ return ((d1 - d0) % 360 + 360) % 360; }

/* ---------- 從 SVG 字串把線讀回來 ---------- */
function linesOf(svg){
  const out = [], re = /<line\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(svg))){
    const at = k => { const x = m[1].match(new RegExp('\\b' + k + '="([^"]*)"')); return x ? x[1] : null; };
    out.push({ cls:at('class'), x1:+at('x1'), y1:+at('y1'), x2:+at('x2'), y2:+at('y2'), stroke:at('stroke'), sw:+(at('stroke-width') || 1), dash:at('stroke-dasharray') });
  }
  return out;
}
/* 一個角：兩條從同一點出發的線（第一條、第二條），量出逆時針張開幾度 */
function measure(l0, l1){
  if (!l0 || !l1) return null;
  if (!near(l0.x1, l1.x1, 0.15) || !near(l0.y1, l1.y1, 0.15)) return { bad:'the two sides do not start from the same point' };
  return { a:ccw(dirOf(l0.x1, l0.y1, l0.x2, l0.y2), dirOf(l1.x1, l1.y1, l1.x2, l1.y2)), d0:dirOf(l0.x1, l0.y1, l0.x2, l0.y2),
           r0:Math.hypot(l0.x2 - l0.x1, l0.y2 - l0.y1), r1:Math.hypot(l1.x2 - l1.x1, l1.y2 - l1.y1), v:{ x:l0.x1, y:l0.y1 } };
}
/* 小於 180 的角：不管哪一條在前面，量兩條線之間的夾角 */
function between(l0, l1){ const a = ccw(dirOf(l0.x1, l0.y1, l0.x2, l0.y2), dirOf(l1.x1, l1.y1, l1.x2, l1.y2)); return a > 180 ? 360 - a : a; }
function svgBlocks(html){ return String(html).match(/<svg[\s\S]*?<\/svg>/g) || []; }
const INK = '#2B2A33', ORANGE = '#E8871E', GREEN = '#2F9E69', BLUE = '#3B7DD8';
function kindOf(a){ return Math.abs(a - 90) < 0.6 ? 'right' : a < 90 ? 'acute' : 'obtuse'; }

/* 線段 p–q 和矩形 r 有沒有相交（版面檢查用：字不可以壓在邊上） */
function segHitsRect(p, q, r){
  const inside = (x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  for (let t = 0; t <= 1; t += 1 / 80){ if (inside(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t)) return true; }
  return false;
}
const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });

/* ---------- review.html 的 renderCheck：把題目的圖量回來 ---------- */
/* 每一個 <text> 畫出來佔的方框：從字級、描邊、text-anchor、dominant-baseline 算（保守：一個字寬 0.8 × 字級，emoji 1 × 字級；
   高度 1.1 × 字級（central）、基線上 0.95 下 0.25 × 字級（alphabetic）；描邊的一半算在四邊外面 —— codex 第三輪）。
   codex 第二輪：只看錨點的話，錨點剛好在邊上、半個字被裁掉也算「在裡面」。 */
function textBoxes(svg){
  return [...String(svg).matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(m => {
    const at = k => { const x = m[1].match(new RegExp('\\b' + k + '="([^"]*)"')); return x ? x[1] : null; };
    const fs = +(at('font-size') || 16), sw = +(at('stroke-width') || 0), ch = m[2];
    const gw = [...ch].reduce((t, c) => t + (/\p{Extended_Pictographic}/u.test(c) ? 1 : 0.8) * fs, 0), wd = gw + sw;
    const x = +at('x'), y = +at('y'), anchor = at('text-anchor') || 'start', base = at('dominant-baseline') || 'alphabetic';
    const x0 = anchor === 'middle' ? x - wd / 2 : anchor === 'end' ? x - gw - sw / 2 : x - sw / 2;
    const central = base === 'central' || base === 'middle', ht = (central ? 1.1 : 1.2) * fs + sw;
    const y0 = central ? y - ht / 2 : y - 0.95 * fs - sw / 2;
    return { ch, x:x0, y:y0, w:wd, h:ht };
  });
}
/* 一張 SVG 裡的每一條線（含圓頭的半個線寬）、每一個字的方框都在它自己的 viewBox 裡
   （codex 第一輪：一條邊畫成 1000 長被裁掉，所有檢查照樣綠；第二輪：要算線寬與字的大小，不是只看端點與錨點） */
function outOfBox(svg){
  const vb = (svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || []);
  const w = +vb[1], h = +vb[2];
  if (!(w > 0 && h > 0)) return 'no viewBox';
  for (const l of linesOf(svg)) for (const [x, y] of [[l.x1, l.y1], [l.x2, l.y2]]) { const c = l.sw / 2; if (x - c < 0 || y - c < 0 || x + c > w || y + c > h) return 'a line runs outside its picture (' + x.toFixed(1) + ',' + y.toFixed(1) + ' in ' + w + '×' + h + ')'; }
  for (const b of textBoxes(svg)) if (b.x < 0 || b.y < 0 || b.x + b.w > w || b.y + b.h > h) return 'a letter sits outside its picture ("' + b.ch + '")';
}
/* 檢查角那一條（虛線）：從角的頂點出發、在第一條邊的 +90° */
function checkerOk(svg){
  const L = linesOf(svg), chk = L.filter(l => l.dash), arms = L.filter(l => !l.dash), A = measure(arms[0], arms[1]);
  if (!A || A.bad) return { bad:'cannot measure the angle' };
  if (chk.length !== 1) return { bad:'the checker corner is not drawn', A };
  if (!near(chk[0].x1, A.v.x, 0.15) || !near(chk[0].y1, A.v.y, 0.15)) return { bad:'the checker corner is not placed vertex on vertex', A };
  if (!near(ccw(A.d0, dirOf(chk[0].x1, chk[0].y1, chk[0].x2, chk[0].y2)), 90, 0.6)) return { bad:'the checker corner is not drawn at +90° from the first side', A };
  return { A };
}
/* 疊在一起的圖：三條線同一個頂點；A、B 兩個字母各自在自己那一條的延長線上、顏色和那一條一樣、彼此不重疊 */
function overlayRead(svg){
  const L = linesOf(svg);
  if (L.length !== 3) return { bad:'an overlay should have 3 lines, got ' + L.length };
  if (!L.every(l => near(l.x1, L[0].x1, 0.15) && near(l.y1, L[0].y1, 0.15))) return { bad:'the overlaid angles do not share the vertex' };
  const d0 = dirOf(L[0].x1, L[0].y1, L[0].x2, L[0].y2);
  const aA = ccw(d0, dirOf(L[1].x1, L[1].y1, L[1].x2, L[1].y2)), aB = ccw(d0, dirOf(L[2].x1, L[2].y1, L[2].x2, L[2].y2));
  const lab = ch => { const m = svg.match(new RegExp('<text x="([\\d.-]+)" y="([\\d.-]+)" fill="([^"]+)"[^>]*>' + ch + '</text>')); return m ? { x:+m[1], y:+m[2], c:m[3] } : null; };
  const la = lab('A'), lb = lab('B');
  if (!la || !lb) return { bad:'the overlay does not label A and B' };
  for (const [lt, line, ch] of [[la, L[1], 'A'], [lb, L[2], 'B']]){
    if (lt.c !== line.stroke) return { bad:'the letter ' + ch + ' is not the colour of its side' };
    const r = Math.hypot(line.x2 - line.x1, line.y2 - line.y1), rl = Math.hypot(lt.x - line.x1, lt.y - line.y1);
    if (!near(dirOf(line.x1, line.y1, lt.x, lt.y), dirOf(line.x1, line.y1, line.x2, line.y2), 0.6) || !(rl > r + 8 && rl < r + 30)) return { bad:'the letter ' + ch + ' is not just past the end of ' + ch + '’s side' };
  }
  const tb = textBoxes(svg), bA = tb.find(b => b.ch === 'A'), bB = tb.find(b => b.ch === 'B');
  if (!bA || !bB || hit(bA, bB)) return { bad:'the letters A and B sit on top of each other' };
  return { aA, aB };
}
function reviewRender(d, q, lang, genId){
  const t = lang === 'zh'
    ? { acute:'銳角', right:'直角', obtuse:'鈍角', A:'A 比較大', B:'B 比較大' }
    : { acute:'Acute', right:'Right', obtuse:'Obtuse', A:'A is bigger', B:'B is bigger' };
  const key = q.opts[q.ans];
  const svgs = svgBlocks(q.shape);
  for (const s of svgs){ const o = outOfBox(s); if (o) return o; }
  const twoOf = svg => { const L = linesOf(svg).filter(l => !l.dash); return measure(L[0], L[1]); };
  switch (genId){
    case 'classifyChecker': {
      const ck = checkerOk(svgs[0] || ''), A = ck.A;
      if (ck.bad) return ck.bad;
      if (!near(A.a, d.angleDeg, 0.6)) return 'drawn ' + A.a.toFixed(1) + '°, data says ' + d.angleDeg;
      if (key !== t[kindOf(A.a)]) return 'the picture shows a ' + kindOf(A.a) + ' angle, the key says ' + key;
      return;
    }
    case 'compareDeceptive': case 'chordTrap': {
      if (svgs.length !== 2) return 'two angles should be drawn, got ' + svgs.length;
      const A = twoOf(svgs[0]), B = twoOf(svgs[1]);
      if (!A || !B || A.bad || B.bad) return 'cannot measure the two angles';
      if (!near(A.r0, d.rA, 0.2) || !near(A.r1, d.rA, 0.2) || !near(B.r0, d.rB, 0.2) || !near(B.r1, d.rB, 0.2)) return 'the sides are drawn ' + [A.r0, A.r1, B.r0, B.r1].map(x => x.toFixed(1)).join('/') + ', data says ' + d.rA + '/' + d.rB;
      if (Math.abs(A.a - B.a) < 14.5) return 'the two angles differ by only ' + Math.abs(A.a - B.a).toFixed(1) + '° — the picture cannot decide';
      if (key !== (A.a > B.a ? t.A : t.B)) return 'the picture shows ' + (A.a > B.a ? 'A' : 'B') + ' bigger, the key says ' + key;
      /* 陷阱真的成立：比較大的那一個，邊畫得比較短（compareDeceptive）／端點離得比較近（chordTrap） */
      const big = A.a > B.a ? A : B, small = A.a > B.a ? B : A;
      if (genId === 'compareDeceptive' && !(big.r0 < small.r0)) return 'the bigger angle is not the one with the shorter sides — no trap';
      if (genId === 'chordTrap'){
        const ch = X => 2 * X.r0 * Math.sin(X.a * DEG / 2);
        if (!(ch(small) > ch(big))) return 'the smaller angle’s ends are not farther apart — the "don’t look at the ends" explanation is false';
      }
      return;
    }
    case 'compareOverlay': case 'lifeCompare': {
      const o = overlayRead(svgs[0] || '');
      if (o.bad) return o.bad;
      if (Math.abs(o.aA - o.aB) < 14.5) return 'A and B differ by only ' + Math.abs(o.aA - o.aB).toFixed(1) + '°';
      if (key !== (o.aA > o.aB ? t.A : t.B)) return 'the overlay shows ' + (o.aA > o.aB ? 'A' : 'B') + ' bigger, the key says ' + key;
      return;
    }
    case 'rotationTrueFalse': {
      if (svgs.length !== 2) return 'two angles should be drawn';
      for (const s of svgs){
        const ck = checkerOk(s);
        if (ck.bad) return ck.bad === 'the checker corner is not drawn' ? 'the stem says the checker corner is placed on both angles, but it is not drawn' : ck.bad;
        if (!near(ck.A.a, 90, 0.6)) return 'both angles should be right angles';
      }
      const right = d.miaRight ? (lang === 'zh' ? '小美對' : 'Mia is right') : (lang === 'zh' ? '小華對' : 'Jay is right');
      if (key !== right) return 'the key is ' + key + ', should be ' + right;
      const says = lang === 'zh' ? '「角轉個方向，角度不會變。」' : 'rotating an angle doesn’t change its size';
      const who = lang === 'zh' ? (d.miaRight ? '小美說：' : '小華說：') : (d.miaRight ? 'Mia says ' : 'Jay says ');
      if (q.stem.indexOf(who + says) < 0) return 'the person who is right is not the one who says rotating does not change it';
      return;
    }
    case 'vertexIdentify': {
      const L = linesOf(svgs[0] || ''), A = measure(L[0], L[1]);
      if (!A || A.bad) return 'cannot measure the angle';
      /* 字母寫在點的右上方 (+10, −8)：找寫在頂點那一點的字母 */
      const tx = [...(svgs[0] || '').matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"[^>]*>([PQRS])<\/text>/g)].map(m => ({ x:+m[1] - 10, y:+m[2] + 8, ch:m[3] }));
      const at = tx.filter(p => near(p.x, A.v.x, 0.2) && near(p.y, A.v.y, 0.2));
      if (tx.length !== 4 || at.length !== 1) return 'cannot find the letter on the vertex';
      if (key !== at[0].ch) return 'the vertex is labelled ' + at[0].ch + ', the key says ' + key;
      return;
    }
    case 'pickCategoryAmongThree': {
      if (svgs.length !== 3) return 'three angles should be drawn';
      for (const s of svgs){ const ck = checkerOk(s); if (ck.bad) return ck.bad; }
      const kinds = svgs.map(s => kindOf(checkerOk(s).A.a));
      const want = d.askAcute ? 'acute' : 'obtuse';
      const match = kinds.map((k, i) => k === want ? i : -1).filter(i => i >= 0);
      if (match.length !== 1) return kinds.join() + ': ' + match.length + ' angles are ' + want + ' — the answer is not unique';
      if (q.ans !== match[0]) return 'the ' + want + ' one is drawn ' + 'ABC'[match[0]] + ', the key says ' + key;
      return;
    }
  }
}

module.exports = {
  breaks: [
    /* ---- index.html：小遊戲（2026-10-01 改版）—— 每一條新的不變量一筆 ---- */
    { file:'index', expect:'without shuffle(...)', find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });", replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });" },
    { file:'index', expect:'GAME_ORDER should be', find:"var GAME_ORDER = ['corner', 'open', 'stamp', 'over', 'sort'];", replace:"var GAME_ORDER = ['corner', 'stamp', 'open', 'over', 'sort'];" },
    { file:'index', expect:'under 44', find:'  var GPICK = 48;', replace:'  var GPICK = 40;' },
    { file:'index', expect:'scoring', find:'    var pts = gMistake ? 10 : 20;', replace:'    var pts = 20;' },
    { file:'index', expect:'a mistake does not cost 5', find:'    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;', replace:'    elScore.textContent = gScore;' },
    { file:'index', expect:'shown although nothing was taken', find:"'</span>' + (lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');", replace:"'</span>' + (true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');" },
    { file:'index', expect:'nearestOpen(', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'skips it and lands in the next',
      find:"    return best && !best.done ? best : null;\n  }\n  /* 托盤",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;\n  }\n  /* 托盤" },
    { file:'index', expect:'is missing in en', find:"      choiceA: 'A is bigger', choiceB: 'B is bigger', sameWord: 'The same',", replace:"      sameWord: 'The same'," },
    { file:'index', expect:'overlaySVG() does not label', find:"    svg += '<text x=\"' + lA.x.toFixed(1) + '\" y=\"' + lA.y.toFixed(1) + '\" fill=\"#E8871E\" font-size=\"22\" font-weight=\"bold\" text-anchor=\"middle\" dominant-baseline=\"central\">A</text>';\n", replace:'' },

    /* 找角 */
    { file:'index', expect:'cornerHit(', find:"      if (dd <= CORNER_HIT * CORNER_HIT && dd < bd){", replace:"      if (dd <= 4 * CORNER_HIT * CORNER_HIT && dd < bd){" },
    { file:'index', expect:'cornerHit(', find:"      if (d <= CORNER_SIDE.hit && t * len >= CORNER_SIDE.keep && (1 - t) * len >= CORNER_SIDE.keep) return { kind:'side', i:i };", replace:"      if (d <= CORNER_SIDE.hit) return { kind:'side', i:i };" },
    { file:'index', expect:'cornerHit(', find:"kind:(i === 0 || i === pts.length - 1) ? 'end' : 'corner'", replace:"kind:(i === 0) ? 'end' : 'corner'" },
    { file:'index', expect:'is not a clear turn', find:'    [[30, 55], [150, 55], [80, 200], [265, 200]],', replace:'    [[30, 55], [150, 60], [265, 70], [265, 200]],' },
    { file:'index', expect:'are closer than', find:'    [[30, 150], [110, 40], [190, 210], [270, 105]]', replace:'    [[30, 150], [110, 40], [190, 210], [225, 180]]' },
    { file:'index', expect:'outside the', find:'    [[35, 224], [35, 135], [135, 135], [135, 45], [265, 45]],', replace:'    [[35, 240], [35, 135], [135, 135], [135, 45], [265, 45]],' },
    { file:'index', expect:'under 44', find:'  var CORNER_H = 250, CORNER_HIT = 26,', replace:'  var CORNER_H = 250, CORNER_HIT = 20,' },
    { file:'index', expect:'an end of the line is not a mistake', find:"        if (h.kind === 'end'){ roundMiss(d.gCornerEnd); return; }\n", replace:'' },
    { file:'index', expect:'a straight side is not a mistake', find:"        if (h.kind === 'side'){ roundMiss(d.gCornerSide); return; }\n", replace:'' },
    { file:'index', expect:'a found corner counts twice', find:'        if (found[h.i]) return;\n', replace:'' },
    { file:'index', expect:'cornerSVG(', find:"      s += svgArc(v, CORNER_MARK, d1, sw, GREEN) + svgDot(v, 7, GREEN);", replace:"      s += svgDot(v, 7, GREEN);" },

    /* 張一樣大 */
    { file:'index', expect:'openSnap(', find:'    var a = Math.round(ang / OPEN_STEP) * OPEN_STEP;', replace:'    var a = Math.floor(ang / OPEN_STEP) * OPEN_STEP;' },
    { file:'index', expect:'openSnap(', find:'    if (ang < -90) ang += 360;\n', replace:'' },
    { file:'index', expect:'openChordStep(', find:'var dd = Math.abs(openChord(a, e.ry) - want); if (dd < bd)', replace:'var dd = Math.abs(openChord(a, e.rs) - want); if (dd < bd)' },
    { file:'index', expect:'openVerdict(', find:"  function openVerdict(e, a){ return a === e.s ? 'ok' : a === openChordStep(e) ? 'chord' : a < e.s ? 'small' : 'big'; }", replace:"  function openVerdict(e, a){ return a === e.s ? 'ok' : a < e.s ? 'small' : 'big'; }" },
    { file:'index', expect:'the side lengths should differ', find:'    { s:60, rs:100, ry:62, start:90 },', replace:'    { s:60, rs:100, ry:90, start:90 },' },
    { file:'index', expect:'starts at the answer', find:'    { s:120, rs:55, ry:105, start:90 },', replace:'    { s:120, rs:55, ry:105, start:120 },' },
    { file:'index', expect:'starts on the "ends match" step', find:'    { s:45, rs:110, ry:60, start:135 },', replace:'    { s:45, rs:110, ry:60, start:90 },' },
    { file:'index', expect:'is not on a step', find:'    { s:75, rs:105, ry:70, start:30 },', replace:'    { s:80, rs:105, ry:70, start:30 },' },
    { file:'index', expect:'reaches the 🎯 side', find:'  function openLayout(e){ var sy = 14 + e.rs; return { sy:sy, vy:sy + e.ry + 40 }; }', replace:'  function openLayout(e){ var sy = 14 + e.rs; return { sy:sy, vy:sy + e.ry + 20 }; }' },
    { file:'index', expect:'outside the', find:'  var OPEN_H = 270, OPEN_X = 140,', replace:'  var OPEN_H = 240, OPEN_X = 140,' },
    { file:'index', expect:'label', find:'  var OPEN_LBL = { x:6, dy:28, size:24 };', replace:'  var OPEN_LBL = { x:6, dy:-8, size:24 };' },
    { file:'index', expect:'"done" is not judged by openVerdict', find:'        var v = openVerdict(e, cur);', replace:"        var v = cur === e.s ? 'ok' : 'small';" },
    { file:'index', expect:'"done" during a drag', find:'        hand.abort();   /* 另一根手指還在轉', replace:'        /* 另一根手指還在轉' },
    { file:'index', expect:'shorter or longer', find:'roundMiss(d.gOpenChord(e.ry < e.rs));', replace:'roundMiss(d.gOpenChord(e.ry > e.rs));' },
    { file:'index', expect:'gOpenChord zh', find:"        ? '你讓兩個端點離得和 🎯 差不多遠，可是 ✋ 的邊比較短，只好張得比較開", replace:"        ? '你讓兩個端點離得和 🎯 差不多遠，可是 ✋ 的邊比較長，只好張得比較開" },
    { file:'index', expect:'gOpenDone en', find:"'The same! Both orange sides point the same way — the ✋ sides are ' + (shorter ? 'shorter' : 'longer')", replace:"'The same! Both orange sides point the same way — the ✋ sides are ' + (shorter ? 'longer' : 'shorter')" },

    /* 蓋印章 */
    { file:'index', expect:'stampKind(', find:"  function stampKind(a){ return a === 90 ? 'right' : a < 90 ? 'acute' : 'obtuse'; }", replace:"  function stampKind(a){ return a === 90 ? 'right' : a < 90 ? 'obtuse' : 'acute'; }" },
    { file:'index', expect:'has no right angle', find:'    [ { a:70, d:110, r:48 }, { a:90, d:250, r:41 }, { a:90, d:5, r:34 }, { a:130, d:160, r:41 } ],', replace:'    [ { a:70, d:110, r:48 }, { a:60, d:250, r:41 }, { a:75, d:5, r:34 }, { a:130, d:160, r:41 } ],' },
    { file:'index', expect:'too close to a right angle', find:'{ a:75, d:300, r:48 } ],', replace:'{ a:85, d:300, r:48 } ],' },
    { file:'index', expect:'does not fit its card', find:'{ a:105, d:210, r:48 }', replace:'{ a:105, d:210, r:95 }' },
    { file:'index', expect:'stampCardSVG(', find:"      s += svgLine(v, polar(v.x, v.y, c.d + 90, c.r * STAMP_CHK), BLUE, 3, 'gchkline', '6,5');", replace:"      s += svgLine(v, polar(v.x, v.y, c.d - 90, c.r * STAMP_CHK), BLUE, 3, 'gchkline', '6,5');" },
    { file:'index', expect:'cards 0 and 1 overlap', find:'STAMP_CARD = { w:140, h:118, gap:8,', replace:'STAMP_CARD = { w:140, h:118, gap:-6,' },
    { file:'index', expect:'the stamps reach the cards', find:"  var STAMP_TRAY = { y:292,", replace:"  var STAMP_TRAY = { y:270," },
    { file:'index', expect:'stamp tray pieces', find:'xs:[42, 118, 194], chk:{ x:262, size:56 } };', replace:'xs:[42, 108, 194], chk:{ x:262, size:56 } };' },
    { file:'index', expect:'a wrong stamp is accepted', find:'        if (P.data.kind !== o.kind){ roundMiss(', replace:'        if (false){ roundMiss(' },
    { file:'index', expect:'gStampWrong zh', find:"        if (truth === 'acute') return '角 ' + name + ' 還沒張開到檢查角", replace:"        if (truth === 'acute') return '角 ' + name + ' 超出了檢查角" },
    { file:'index', expect:'gStampWrong en', find:"        if (truth === 'right') return 'Angle ' + name + '’s orange side lies exactly on the checker corner", replace:"        if (truth === 'right') return 'Angle ' + name + ' goes past the checker corner" },

    /* 疊一疊 */
    { file:'index', expect:'a true side-on-side overlay is rejected', find:'    { a:125, ra:60, b:85, rb:100, turn:6 },', replace:'    { a:125, ra:60, b:80, rb:100, turn:6 },' },
    { file:'index', expect:'not "about as far apart"', find:'    { s:75, rs:105, ry:70, start:30 },', replace:'    { s:75, rs:105, ry:40, start:30 },' },
    { file:'index', expect:'claims the ends are exactly', find:"'你讓兩個端點離得和 🎯 差不多遠，可是 ✋ 的邊比較短", replace:"'你讓兩個端點離得和 🎯 一樣遠，可是 ✋ 的邊比較短" },
    { file:'index', expect:'is a multiple of 45', find:'    { a:70, ra:100, b:110, rb:60, turn:3 },', replace:'    { a:70, ra:100, b:135, rb:60, turn:3 },' },
    { file:'index', expect:'already lies on A', find:'    { a:125, ra:60, b:85, rb:100, turn:6 },', replace:'    { a:125, ra:60, b:85, rb:100, turn:8 },' },
    { file:'index', expect:'the shorter sides always win', find:'    { a:50, ra:60, b:75, rb:100, turn:5 },\n    { a:140, ra:95, b:115, rb:60, turn:4 },', replace:'    { a:50, ra:100, b:75, rb:60, turn:5 },\n    { a:140, ra:60, b:115, rb:95, turn:4 },' },
    { file:'index', expect:'differ by only', find:'    { a:50, ra:60, b:75, rb:100, turn:5 },', replace:'    { a:65, ra:60, b:75, rb:100, turn:5 },' },
    { file:'index', expect:'should have A bigger, B bigger and the same', find:'    { a:100, ra:95, b:100, rb:60, turn:2 },\n    { a:50, ra:60, b:75, rb:100, turn:5 },\n    { a:140, ra:95, b:115, rb:60, turn:4 },\n    { a:65, ra:65, b:65, rb:100, turn:7 }', replace:'    { a:130, ra:95, b:100, rb:60, turn:2 },\n    { a:50, ra:60, b:75, rb:100, turn:5 },\n    { a:140, ra:95, b:115, rb:60, turn:4 },\n    { a:95, ra:65, b:65, rb:100, turn:7 }' },
    { file:'index', expect:'one long, one short', find:'    { a:65, ra:65, b:65, rb:100, turn:7 }', replace:'    { a:65, ra:90, b:65, rb:100, turn:7 }' },
    { file:'index', expect:'outside the', find:'  var OVER_H = 440, OVER_A = { x:110, y:150 }, OVER_B = { x:150, y:300 },', replace:'  var OVER_H = 400, OVER_A = { x:110, y:150 }, OVER_B = { x:150, y:300 },' },
    { file:'index', expect:'drop zones overlap', find:'OVER_GRIP = 60, OVER_PAD = 24,', replace:'OVER_GRIP = 60, OVER_PAD = 34,' },
    { file:'index', expect:'overAnswer(', find:"  function overAnswer(e){ return e.a === e.b ? 'same' : e.a > e.b ? 'A' : 'B'; }", replace:"  function overAnswer(e){ return e.a === e.b ? 'same' : e.ra < e.rb ? 'A' : 'B'; }" },
    { file:'index', expect:'overBSVG(', find:"var S = overBSize(e), v = { x:S / 2, y:S / 2 }, l = polar(v.x, v.y, dir + e.b, e.rb + OVER_LBL);", replace:"var S = overBSize(e), v = { x:S / 2, y:S / 2 }, l = polar(v.x, v.y, dir + e.b, e.rb + OVER_LBL); dir = -dir;" },
    { file:'index', expect:'B can be laid on A with the sides apart', find:"        if (bDir !== 0){ roundMiss(d.gOverSide); return false; }\n", replace:'' },
    { file:'index', expect:'the end of a side counts', find:"        if (t.k === 't'){ roundMiss(d.gOverVertex); return false; }\n", replace:'' },
    { file:'index', expect:'an answer before overlapping', find:"          if (!placed || gSolved) return;", replace:"          if (gSolved) return;" },
    { file:'index', expect:'gOverWrong zh', find:"        return '疊起來看：' + ans + ' 的另一條邊在 ' + small + ' 的外面", replace:"        return '疊起來看：' + small + ' 的另一條邊在 ' + ans + ' 的外面" },
    { file:'index', expect:'gOverDone en', find:"(shorter ? 'Even though ' + ans + '’s sides are drawn shorter.'", replace:"(shorter ? 'Even though ' + ans + '’s sides are drawn longer.'" },
    { file:'index', expect:'does not know whether the bigger one has the shorter sides', find:"roundSolved(d.gOverDone(ans, ans === 'A' ? e.ra < e.rb : e.rb < e.ra));", replace:"roundSolved(d.gOverDone(ans, true));" },
    { file:'index', expect:'gOver2Turn', find:"d.gOver2Turn(Math.min(bDir / 45, 8 - bDir / 45), bDir / 45 <= 4 ? d.gOverTurnR : d.gOverTurnL)", replace:"d.gOver2Turn(Math.min(bDir / 45, 8 - bDir / 45), bDir / 45 <= 4 ? d.gOverTurnL : d.gOverTurnR)" },

    /* 排一排 */
    { file:'index', expect:'apart — the picture cannot decide', find:"    [ { id:'scissors', a:35, r:40 }, { id:'clock', a:90, r:26 }, { id:'door', a:130, r:30 } ],", replace:"    [ { id:'scissors', a:35, r:40 }, { id:'clock', a:50, r:26 }, { id:'door', a:130, r:30 } ]," },
    { file:'index', expect:'the longest sides are on the biggest angle', find:"    [ { id:'scissors', a:30, r:34 }, { id:'book', a:60, r:40 }, { id:'door', a:105, r:24 } ],", replace:"    [ { id:'scissors', a:30, r:34 }, { id:'book', a:60, r:24 }, { id:'door', a:105, r:40 } ]," },
    { file:'index', expect:'the side lengths give the order', find:"    [ { id:'scissors', a:50, r:30 }, { id:'door', a:80, r:40 }, { id:'book', a:115, r:22 } ],", replace:"    [ { id:'scissors', a:50, r:40 }, { id:'door', a:80, r:30 }, { id:'book', a:115, r:22 } ]," },
    { file:'index', expect:'scissors that open', find:"    [ { id:'clock', a:120, r:30 }, { id:'door', a:45, r:26 }, { id:'scissors', a:80, r:40 } ]", replace:"    [ { id:'clock', a:80, r:30 }, { id:'door', a:45, r:26 }, { id:'scissors', a:120, r:40 } ]" },
    { file:'index', expect:'does not fit its card', find:"{ id:'door', a:140, r:26 } ],", replace:"{ id:'door', a:140, r:46 } ]," },
    { file:'index', expect:'sortOrder(', find:"return set[x].a - set[y].a; }); }", replace:"return set[y].r - set[x].r; }); }" },
    { file:'index', expect:'slots 0 and 1 overlap', find:'SORT_SLOT = { y:78, w:92, h:104, gap:8 }', replace:'SORT_SLOT = { y:78, w:92, h:104, gap:-4 }' },
    { file:'index', expect:'the cards reach the slots', find:'SORT_CARD = { w:88, h:100, y:212, band:26 }', replace:'SORT_CARD = { w:88, h:100, y:180, band:26 }' },
    { file:'index', expect:'a card is accepted in the wrong slot', find:'        if (P.data.i !== s.want){ roundMiss(', replace:'        if (false){ roundMiss(' },
    { file:'index', expect:'gSortWrong zh', find:"return mine + '的角比' + want + '的角' + (bigger ? '大' : '小') + '，這一格要放比較' + (bigger ? '小' : '大') + '的角。'; }", replace:"return mine + '的角比' + want + '的角' + (bigger ? '大' : '小') + '，這一格要放比較' + (bigger ? '大' : '小') + '的角。'; }" },
    { file:'index', expect:'gSortDone', find:"return '從小排到大：' + names.join(' → ')", replace:"return '從小排到大：' + names.slice().reverse().join(' → ')" },
    { file:'index', expect:'gLifeName', find:"      gLifeName: { scissors:'scissors', book:'book', door:'door', clock:'clock' },", replace:"      gLifeName: { scissors:'scissors', book:'book', door:'door' }," },

    /* ---- index.html：題庫 ---- */
    { file:'index', expect:'the key says', find:"          opts:['A','B','一樣大','看不出來'], ans:0,\n          why:'雖然 B 畫的邊比較長", replace:"          opts:['A','B','一樣大','看不出來'], ans:1,\n          why:'雖然 B 畫的邊比較長" },
    { file:'index', expect:'the stem describes', find:"        { kind:'checker', dir1:170, angleDeg:55,\n          stem:'檢查角", replace:"        { kind:'checker', dir1:170, angleDeg:105,\n          stem:'檢查角" },

    { file:'index', expect:'the vertex is labelled', find:"      [ ['P', v], ['Q', Q], ['R', R], ['S', S] ].forEach(function(item){", replace:"      [ ['Q', v], ['P', Q], ['R', R], ['S', S] ].forEach(function(item){" },
    { file:'index', expect:'the key says', find:"          opts:['小傑的剪刀','一樣大','小美的門','看不出來'], ans:2,", replace:"          opts:['小美的門','一樣大','小傑的剪刀','看不出來'], ans:2," },
    { file:'index', expect:'the letters are', find:'stroke="#FAF7F0" stroke-width="5" paint-order="stroke" font-size="22"', replace:'stroke="#FAF7F0" stroke-width="5" paint-order="stroke" font-size="80"' },
    { file:'index', expect:'the tie is not broken', find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }", replace:"      if (dd < bd){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:'the card label is not just the name', find:"html:'<span class=\"gsname\">' + nm(it) + '</span>' + sortCardSVG(it) }", replace:"html:'<span class=\"gsname\">🕒 ' + nm(it) + '</span>' + sortCardSVG(it) }" },
    { file:'index', expect:'carries a picture', find:"      gLifeName: { scissors:'剪刀', book:'書本', door:'門', clock:'時鐘' },", replace:"      gLifeName: { scissors:'剪刀', book:'書本', door:'門', clock:'🕒時鐘' }," },

    { file:'index', expect:'unknown kind', find:"        { kind:'checker', dir1:40, angleDeg:90,\n          stem:'檢查角（虛線）放上去後，兩邊剛好完全貼合", replace:"        { kind:'checkr', dir1:40, angleDeg:90,\n          stem:'檢查角（虛線）放上去後，兩邊剛好完全貼合" },
    { file:'index', expect:'a letter covers the vertex', find:"    var S = overBSize(e), v = { x:S / 2, y:S / 2 }, l = polar(v.x, v.y, dir + e.b, e.rb + OVER_LBL);", replace:"    var S = overBSize(e), v = { x:S / 2, y:S / 2 }, l = polar(v.x, v.y, dir + e.b, 6);" },

    /* ---- review.html ---- */
    { file:'review', expect:'not placed vertex on vertex', find:"    svg += '<line x1=\"' + cx + '\" y1=\"' + cy + '\" x2=\"' + chk.x.toFixed(1)", replace:"    svg += '<line x1=\"' + (cx + 20) + '\" y1=\"' + cy + '\" x2=\"' + (chk.x + 20).toFixed(1)" },
    { file:'review', expect:'outside its picture', find:"    var svgA = drawAngle(size, A.dir1, A.angleDeg, A.r, A.r, labelPrefix + 'A');", replace:"    var svgA = drawAngle(size, A.dir1, A.angleDeg, A.r, 1000, labelPrefix + 'A');" },
    { file:'review', expect:'the letter B', find:"    var lB = polar(cx, cy, dir1 + B.angleDeg, B.r + 18);", replace:"    var lB = { x:cx, y:cy };" },
    { file:'review', expect:'sits outside its picture', find:"    var lB = polar(cx, cy, dir1 + B.angleDeg, B.r + 18);", replace:"    var lB = polar(cx, cy, dir1 + B.angleDeg, B.r + 39);" },
    { file:'review', expect:'the key says P', find:"opts: ['P','Q','R','S'], ans: ['P','Q','R','S'].indexOf(Lt[0]),", replace:"opts: ['P','Q','R','S'], ans: 0," },
    { file:'review', expect:'is not drawn', find:"shape: threeCheckerSVG([ { dir1:d.dir1a, angleDeg:90, r:110, checkerR:62 }, { dir1:d.dir1b, angleDeg:90, r:110, checkerR:62 } ], 'gen-rot'),", replace:"shape: twoApartSVG({ dir1:d.dir1a, angleDeg:90, r:110 }, { dir1:d.dir1b, angleDeg:90, r:110 }, 'gen-rot')," },
    { file:'review', expect:'is not the one who says', find:"          ? (lang === 'zh' ? '「角轉個方向，角度不會變。」' : 'rotating an angle doesn’t change its size')\n          : (lang === 'zh' ? '「角轉個方向，角度就會變。」' : 'rotating an angle changes its size'); };", replace:"          ? (lang === 'zh' ? '「角轉個方向，角度就會變。」' : 'rotating an angle changes its size')\n          : (lang === 'zh' ? '「角轉個方向，角度不會變。」' : 'rotating an angle doesn’t change its size'); };" },
    { file:'review', expect:'the "don’t look at the ends" explanation is false', find:'        var rA = Math.max(170, Math.ceil(rB * sB / sA) + 5);', replace:'        var rA = 170;' },
    { file:'review', expect:'differ by only', find:"Math.abs(a.angleDeg - c.angleDeg) >= 20; }));", replace:"Math.abs(a.angleDeg - c.angleDeg) >= 0; }));" },
    { file:'review', expect:'the letters A and B would collide', find:"        var pair = randComparablePair(20, 150, 25);", replace:"        var pair = randComparablePair(20, 150, 15);" },
    { file:'review', expect:'does not label A and B', find:"    svg += '<text x=\"' + lA.x.toFixed(1) + '\" y=\"' + lA.y.toFixed(1) + '\" fill=\"#E8871E\" font-size=\"22\" font-weight=\"bold\" text-anchor=\"middle\" dominant-baseline=\"central\">A</text>';", replace:'' },
    { file:'review', expect:'checker corner is not drawn at +90', find:"    var chk = polar(cx, cy, dir1 + 90, checkerR);", replace:"    var chk = polar(cx, cy, dir1 + 80, checkerR);" },
    { file:'review', expect:'the bigger angle is not the one with the shorter sides', find:"        var rA = biggerIsA ? 55 + rand(30) : 130 + rand(50);", replace:"        var rA = biggerIsA ? 130 + rand(50) : 55 + rand(30);" },
    { file:'review', expect:'the answer is not unique', find:"        var otherRange = askAcute ? [105, 164] : [20, 74];", replace:"        var otherRange = [20, 164];" },
    { file:'review', expect:'opts[ans] != correct', find:"        var correctLabel = d.angleDeg === 90 ? t.rightWord : (d.angleDeg < 90 ? t.acuteWord : t.obtuseWord);", replace:"        var correctLabel = d.angleDeg === 90 ? t.rightWord : (d.angleDeg < 80 ? t.acuteWord : t.obtuseWord);" },
    { file:'review', expect:'is near 90', find:"    do { v = min + rand(max - min + 1); } while (Math.abs(v - 90) < 5);", replace:"    v = min + rand(max - min + 1);" },
    { file:'review', expect:'option count', find:"    var opts = shuffle([correct].concat(out.slice(0, 3)));", replace:"    var opts = shuffle([correct].concat(out.slice(0, 2)));" },
    { file:'review', expect:'remainder', find:"        var remainder = rand(divisor);", replace:"        var remainder = rand(divisor + 1);" }
  ],

  sim: {
    blockStart: '  /* ---------- 角的幾何工具',
    INVARIANTS: {
      classifyChecker: d => {
        if (!(d.angleDeg === 90 || (d.angleDeg >= 20 && d.angleDeg <= 165 && Math.abs(d.angleDeg - 90) >= 5))) return 'angle ' + d.angleDeg + ' is near 90 or out of range';
      },
      compareDeceptive: d => {
        if (Math.abs(d.angleA - d.angleB) < 15) return 'the angles differ by less than 15';
        if (d.bigger !== (d.angleA > d.angleB ? 'A' : 'B')) return 'bigger is wrong';
      },
      compareOverlay: d => {
        if (Math.abs(d.angleA - d.angleB) < 25) return 'the angles differ by less than 25 (the letters A and B would collide)';
        if (d.bigger !== (d.angleA > d.angleB ? 'A' : 'B')) return 'bigger is wrong';
      },
      rotationTrueFalse: d => {
        if (typeof d.miaRight !== 'boolean') return 'who is right is not decided';
        if (!Array.isArray(d.order) || d.order.slice().sort().join() !== '0,1,2,3') return 'options are not a permutation';
      },
      chordTrap: d => {
        if (!(d.angleA >= 15 && d.angleA <= 35 && d.angleB >= 85 && d.angleB <= 140)) return 'angles out of range';
        if (!(d.rA >= 170 && d.rA <= 210 && d.rB >= 25 && d.rB <= 45)) return 'side lengths out of range: ' + d.rA + ', ' + d.rB;
        if (!(2 * d.rA * Math.sin(d.angleA * DEG / 2) > 2 * d.rB * Math.sin(d.angleB * DEG / 2))) return 'no trap: A’s ends are not farther apart';
      },
      lifeCompare: d => {
        if (d.a.id === d.b.id) return 'the same scene twice';
        if (Math.abs(d.a.angleDeg - d.b.angleDeg) < 20) return 'the scenes differ by only ' + Math.abs(d.a.angleDeg - d.b.angleDeg);
        if (d.a.id === 'scissors' && d.a.angleDeg > 90 || d.b.id === 'scissors' && d.b.angleDeg > 90) return 'scissors opened past a right angle';
      },
      vertexIdentify: d => {
        if (!Array.isArray(d.letters) || d.letters.slice().sort().join('') !== 'PQRS') return 'letters are not P, Q, R, S';
        if (!(d.angleDeg >= 40 && d.angleDeg <= 129)) return 'angle out of range';
      },
      pickCategoryAmongThree: d => {
        const want = d.askAcute ? (a => a < 90) : (a => a > 90);
        if (d.angles.filter(want).length !== 1) return 'not exactly one angle of the asked kind';
        if (!want(d.angles[d.targetSlot])) return 'targetSlot is not the asked kind';
        if (d.angles.some(a => Math.abs(a - 90) < 15)) return 'an angle is within 15 of a right angle';
      },
      perimeterCalc: d => { if (d.P !== 2 * (d.l + d.w)) return 'P != 2(l+w)'; },
      multiplyCalc: d => { if (d.p !== d.a * d.b) return 'p != a*b'; },
      divideCalc: d => {
        if (d.dividend !== d.divisor * d.quotient + d.remainder) return 'dividend != divisor*quotient + remainder';
        if (!(d.remainder >= 0 && d.remainder < d.divisor)) return 'remainder ' + d.remainder + ' is not smaller than the divisor';
      }
    },
    expectedCorrect: function(d, genId, lang){
      const t = lang === 'zh'
        ? { acute:'銳角', right:'直角', obtuse:'鈍角', A:'A 比較大', B:'B 比較大' }
        : { acute:'Acute', right:'Right', obtuse:'Obtuse', A:'A is bigger', B:'B is bigger' };
      switch (genId){
        case 'classifyChecker': return t[d.angleDeg === 90 ? 'right' : d.angleDeg < 90 ? 'acute' : 'obtuse'];
        case 'compareDeceptive': case 'compareOverlay': case 'chordTrap': return t[d.angleA > d.angleB ? 'A' : 'B'];
        case 'lifeCompare': return t[d.a.angleDeg > d.b.angleDeg ? 'A' : 'B'];
        case 'rotationTrueFalse': return lang === 'zh' ? (d.miaRight ? '小美對' : '小華對') : (d.miaRight ? 'Mia is right' : 'Jay is right');
        case 'vertexIdentify': return d.letters[0];
        case 'pickCategoryAmongThree': {
          const i = d.angles.findIndex(a => d.askAcute ? a < 90 : a > 90);
          return (lang === 'zh' ? '角 ' : 'Angle ') + 'ABC'[i];
        }
        case 'perimeterCalc': return String(2 * (d.l + d.w));
        case 'multiplyCalc': return String(d.a * d.b);
        case 'divideCalc': { const q = Math.floor(d.dividend / d.divisor), r = d.dividend % d.divisor; return lang === 'zh' ? q + ' 餘 ' + r : q + ' r ' + r; }
      }
      return 'UNKNOWN GENERATOR ' + genId;
    },
    optionOk: function(s, genId, lang){
      if (['perimeterCalc', 'multiplyCalc'].indexOf(genId) >= 0){
        if (!/^[1-9]\d*$/.test(s)) return 'option "' + s + '" is not a positive whole number';
        /* 上限從產生器自己的參數推：周長題 l ≤ 12、w ≤ 9，最大的誘答是 l × w ＝ 108；乘法題 a ≤ 42、b ≤ 7，最大的誘答是 a × b ＋ b ＝ 301 */
        if (+s > (genId === 'perimeterCalc' ? 108 : 301)) return 'option ' + s + ' is out of range';
        return;
      }
      if (genId === 'divideCalc'){
        const m = lang === 'zh' ? s.match(/^(\d+) 餘 (\d+)$/) : s.match(/^(\d+) r (\d+)$/);
        if (!m) return 'option "' + s + '" is not a quotient-and-remainder';
        if (+m[1] < 1) return 'quotient 0';
        return;
      }
      if (/undefined|NaN|·|#/.test(s) || !s.trim()) return 'garbage option "' + s + '"';
    },
    renderCheck: reviewRender
  },

  data: {
    dataStart: '  /* ============ 小遊戲「角度偵探」',
    dataEnd: '  /* ================= i18n ================= */',
    dataReturn: '{GPICK, INK, ORANGE, GREEN, BLUE, polar, fitAngle, CORNER_H, CORNER_HIT, CORNER_SIDE, CORNER_MARK, GAME_CORNER, cornerHit, cornerSVG, OPEN_H, OPEN_X, OPEN_STEP, OPEN_MIN, OPEN_MAX, OPEN_HANDLE, OPEN_ARC, OPEN_LBL, GAME_OPEN, openLayout, openSnap, openChord, openChordStep, openVerdict, openSVG, STAMP_H, STAMP_CARD, STAMP_PAD, STAMP_CHK, STAMP_TRAY, GAME_STAMP, stampKind, stampCardXY, stampFit, stampCardSVG, OVER_H, OVER_A, OVER_B, OVER_GRIP, OVER_PAD, OVER_LBL, GAME_OVER, overAnswer, overASVG, overALabelSVG, overBSize, overBSVG, SORT_H, SORT_SLOT, SORT_CARD, SORT_PAD, GAME_SORT, sortSlotX, sortOrder, sortFit, sortCardSVG}',
    check: function(data, I18N, fail, src){
      const D = data, LANGS = ['zh', 'en'], W = 300;

      /* --- 0. 量角的工具自己先證明會響 --- */
      {
        const ok1 = measure({ x1:0, y1:0, x2:10, y2:0 }, { x1:0, y1:0, x2:0, y2:-10 });
        const ok2 = measure({ x1:0, y1:0, x2:10, y2:0 }, { x1:0, y1:0, x2:-10, y2:-10 });
        if (!ok1 || !near(ok1.a, 90) || !ok2 || !near(ok2.a, 135)) fail('measure() self-test: 90 and 135 measured as ' + (ok1 && ok1.a) + ', ' + (ok2 && ok2.a));
        if (!measure({ x1:0, y1:0, x2:10, y2:0 }, { x1:1, y1:0, x2:0, y2:-10 }).bad) fail('measure() self-test: sides that do not share a vertex are accepted');
        if (linesOf('<line class="q" x1="1" y1="2" x2="3" y2="4" stroke="#000"/>')[0].x2 !== 3) fail('linesOf() self-test');
      }

      /* --- 1. 三層題庫：正解由題目的圖形參數重算 --- */
      const qWord = L => L === 'zh'
        ? { A:['A', 'A 比較大'], B:['B', 'B 比較大'], same:['一樣大'], acute:['銳角'], right:['直角'], obtuse:['鈍角'] }
        : { A:['A', 'A is bigger'], B:['B', 'B is bigger'], same:['They are the same'], acute:['Acute'], right:['Right'], obtuse:['Obtuse'] };
      let staticChecked = 0;
      LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
        const w = bank + '[' + i + '] ' + L, key = q.opts[q.ans], Wd = qWord(L);
        const isBigger = /哪一個(?:角|角度)?比較大|Which angle is bigger|which one is bigger|Which of these two angles is bigger/i.test(q.stem);
        if (q.kind === 'twoApart' && isBigger){
          staticChecked++;
          const want = q.A.angleDeg === q.B.angleDeg ? 'same' : q.A.angleDeg > q.B.angleDeg ? 'A' : 'B';
          if (Wd[want].indexOf(key) < 0) fail(w + ': A ' + q.A.angleDeg + ' vs B ' + q.B.angleDeg + ' → ' + want + ', the key says ' + key);
        }
        if (q.kind === 'overlay' && isBigger){
          staticChecked++;
          /* 題幹把名字綁到 A、B：正解要是張得比較開的那一個的名字（codex 第一輪：原本只比對 ans 的位置，選項文字換掉也全綠） */
          const m = L === 'zh' ? q.stem.match(/^(.+?)打開的角度是 A，(.+?)打開的角度是 B/) : q.stem.match(/^(.+?) opens? to angle A, and (.+?) opens? to angle B/);
          const big = m ? (q.A.angleDeg > q.B.angleDeg ? m[1] : m[2]) : null;
          if (!m || key !== big) fail(w + ': A ' + q.A.angleDeg + ' vs B ' + q.B.angleDeg + ' → ' + big + ', the key says ' + key);
        }
        if (q.kind === 'checker'){
          staticChecked++;
          const kind = q.angleDeg === 90 ? 'right' : q.angleDeg < 90 ? 'acute' : 'obtuse';
          const says = /剛好完全貼合|兩邊完全貼合|line up exactly|lines up exactly/.test(q.stem) ? 'right' : /還沒張開到|hasn’t reached/.test(q.stem) ? 'acute' : /超出了|goes past/.test(q.stem) ? 'obtuse' : null;
          if (says && says !== kind) fail(w + ': the stem describes a ' + says + ' angle, the picture is ' + q.angleDeg + '°');
          if (Wd[kind].indexOf(key) < 0 && !(kind === 'right' && /直角|right angle/.test(key))) fail(w + ': a ' + q.angleDeg + '° angle is ' + kind + ', the key says ' + key);
        }
        if (q.kind === 'threeChecker'){
          staticChecked++;
          const askObtuse = /鈍角|obtuse/.test(q.stem);
          const idx = q.items.map((it, k) => (askObtuse ? it.angleDeg > 90 : it.angleDeg < 90) ? k : -1).filter(k => k >= 0);
          if (idx.length !== 1 || key.indexOf('ABC'[idx[0]]) < 0) fail(w + ': the ' + (askObtuse ? 'obtuse' : 'acute') + ' one is ' + idx.map(k => 'ABC'[k]).join() + ', the key says ' + key);
        }
        if (q.kind === 'vertex'){ staticChecked++; if (key !== 'P') fail(w + ': the vertex is drawn as P, the key says ' + key); }
      })));
      if (staticChecked < 18) fail('only ' + staticChecked + ' static questions were recomputed — the static answer check is not reading the banks');
      /* 再從**畫出來的圖**量一次：把 qShapeSVG() 和它用到的畫圖函式從原始碼切出來真的跑（codex 第一輪：把頂點的字母換成 Q，
         資料層的檢查全綠 —— 它只看資料，不看圖） */
      {
        const NAMES = ['polar', 'angleBetween', 'assertAngle', 'arcPath', 'svgOpen', 'drawAngle', 'drawChecker', 'drawCheckerFull', 'twoApartSVG', 'threeCheckerSVG', 'overlaySVG', 'qShapeSVG'];
        const parts = NAMES.map(n => extractFunction(src, n));
        let qShape = null;
        if (parts.some(x => !x)) fail('cannot cut ' + NAMES.filter((n, i) => !parts[i]).join(', ') + ' out of index.html');
        else { try { qShape = new Function('var ANGLE_FAIL = 0; var console = { error:function(){} };\n' + parts.join('\n') + '\nreturn qShapeSVG;')(); } catch (e){ fail('qShapeSVG() could not be evaluated: ' + e.message); } }
        /* 每一種題型要畫幾張圖；不認得的題型直接判錯（codex 第二輪：打錯字的 kind 畫不出圖，卻照樣被算成「量過了」） */
        const PICS = { vertex:1, checker:1, threeChecker:3, twoApart:2, overlay:1 };
        let drawn = 0, total = 0;
        if (qShape) LANGS.forEach(L => ['qs', 'qsAdv', 'qsBoost'].forEach(bank => (I18N[L][bank] || []).forEach((q, i) => {
          total++;
          const w = bank + '[' + i + '] ' + L + ' (drawn)', key = q.opts[q.ans], Wd = qWord(L), svgs = svgBlocks(qShape(q));
          if (!PICS.hasOwnProperty(q.kind)) return fail(w + ': unknown kind "' + q.kind + '" — nothing is drawn, so nothing can be measured');
          if (svgs.length !== PICS[q.kind]) return fail(w + ': ' + q.kind + ' should draw ' + PICS[q.kind] + ' picture(s), got ' + svgs.length);
          for (const sv of svgs){ const o = outOfBox(sv); if (o) return fail(w + ': ' + o); }
          const isBigger = /哪一個(?:角|角度)?比較大|Which angle is bigger|which one is bigger|Which of these two angles is bigger/i.test(q.stem);
          drawn++;
          if (q.kind === 'vertex'){
            const Ls = linesOf(svgs[0]), A = measure(Ls[0], Ls[1]);
            const tx = [...svgs[0].matchAll(/<text x="([\d.-]+)" y="([\d.-]+)"[^>]*>([PQRS])<\/text>/g)].map(m => ({ x:+m[1] - 10, y:+m[2] + 8, ch:m[3] }));
            const at = A && !A.bad ? tx.filter(p => near(p.x, A.v.x, 0.2) && near(p.y, A.v.y, 0.2)) : [];
            if (at.length !== 1) fail(w + ': cannot find the letter on the vertex');
            else if (at[0].ch !== key) fail(w + ': the vertex is labelled ' + at[0].ch + ', the key says ' + key);
          } else if (q.kind === 'checker'){
            const ck = checkerOk(svgs[0]);
            if (ck.bad) return fail(w + ': ' + ck.bad);
            const kind = kindOf(ck.A.a);
            if (Wd[kind].indexOf(key) < 0 && !(kind === 'right' && /直角|right angle/.test(key))) fail(w + ': the picture shows a ' + kind + ' angle, the key says ' + key);
          } else if (q.kind === 'threeChecker'){
            const ks = []; for (const sv of svgs){ const ck = checkerOk(sv); if (ck.bad) return fail(w + ': ' + ck.bad); ks.push(kindOf(ck.A.a)); }
            const want = /鈍角|obtuse/.test(q.stem) ? 'obtuse' : 'acute', idx = ks.map((k, j) => k === want ? j : -1).filter(j => j >= 0);
            if (idx.length !== 1 || key.indexOf('ABC'[idx[0]]) < 0) fail(w + ': the picture has ' + want + ' at ' + idx.map(j => 'ABC'[j]).join() + ', the key says ' + key);
          } else if (q.kind === 'twoApart'){
            const ms = svgs.map(sv => { const Ls = linesOf(sv); return measure(Ls[0], Ls[1]); });
            if (ms.length !== 2 || ms.some(m => !m || m.bad)) return fail(w + ': cannot measure the two angles');
            if (isBigger){
              const want = Math.abs(ms[0].a - ms[1].a) < 0.6 ? 'same' : ms[0].a > ms[1].a ? 'A' : 'B';
              if (Wd[want].indexOf(key) < 0) fail(w + ': the picture shows ' + want + ', the key says ' + key);
            } else {
              /* 旋轉題：兩個都是直角，說「不會改變」的那個人對 */
              if (!ms.every(m => near(m.a, 90, 0.6))) fail(w + ': the rotation question should show two right angles');
              const who = (q.stem.match(L === 'zh' ? /(\S{2})說：「角轉個方向，角度不會改變。」/ : /(\w+) says, "Rotating an angle doesn’t change its size\."/) || [])[1];
              if (!who || key.indexOf(who) !== 0) fail(w + ': the person who says rotating does not change it is ' + who + ', the key says ' + key);
            }
          } else if (q.kind === 'overlay'){
            const o = overlayRead(svgs[0]);
            if (o.bad) return fail(w + ': ' + o.bad);
            if (isBigger){
              /* 題幹把 A、B 各自綁到一個名字：正解必須是張得比較開的那一個的名字 */
              const m = L === 'zh' ? q.stem.match(/^(.+?)打開的角度是 A，(.+?)打開的角度是 B/) : q.stem.match(/^(.+?) opens? to angle A, and (.+?) opens? to angle B/);
              if (!m) return fail(w + ': cannot read which name is A and which is B from the stem');
              const big = o.aA > o.aB ? m[1] : m[2];
              if (key !== big) fail(w + ': the overlay shows ' + (o.aA > o.aB ? 'A (' + m[1] + ')' : 'B (' + m[2] + ')') + ' bigger, the key says ' + key);
            }
          }
        })));
        if (qShape && (drawn !== total || total < 24)) fail('only ' + drawn + ' of ' + total + ' static questions were measured from their drawings');
      }
      {
        const ov = extractFunction(src, 'overlaySVG') || '';
        if (!/>A<\/text>/.test(ov) || !/>B<\/text>/.test(ov)) fail('overlaySVG() does not label A and B — a question that asks "A or B" cannot be answered from the picture');
      }

      /* --- 2. 小遊戲：五關的順序、題目、提示、每一個用到的字串 --- */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
      const TYPES = ['corner', 'open', 'stamp', 'over', 'sort'];
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
      /* 遊戲程式碼裡每一個 d.xxx／L().xxx 都要在兩種語言的字典裡（舊版的 choiceA 被刪掉時，按鈕會是空白的 —— 截圖抓到的） */
      {
        const g0 = src.indexOf('/* ===================== 小遊戲：角度偵探'), g1 = src.indexOf('function renderAll', g0);
        const code = g0 >= 0 && g1 > g0 ? src.slice(g0, g1) : '';
        if (!code) fail('cannot cut the game engine out of index.html');
        const keys = new Set([...code.matchAll(/\b(?:d|L\(\))\.([A-Za-z]\w*)/g)].map(m => m[1]));
        if (keys.size < 40) fail('only ' + keys.size + ' dictionary keys found in the game code');
        keys.forEach(k => LANGS.forEach(L => { if (I18N[L][k] === undefined) fail('the game uses d.' + k + ', which is missing in ' + L); }));
        keys.forEach(k => { if (I18N.zh[k] !== undefined && typeof I18N.zh[k] !== typeof I18N.en[k]) fail('d.' + k + ' is a ' + typeof I18N.zh[k] + ' in zh but a ' + typeof I18N.en[k] + ' in en'); });
      }
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = {}; TYPES.forEach(k => { B[k] = body(k); if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
      const inside = (o, what, Wd, H, m) => { m = m || 0; if (!(o.x >= m && o.y >= m && o.x + o.w <= Wd - m && o.y + o.h <= H - m)) fail(what + ' is outside the ' + Wd + '×' + H + ' board (' + [o.x, o.y, o.w, o.h].map(v => v.toFixed(1)).join(',') + ')'); };
      const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
      ['GAME_CORNER', 'GAME_OPEN', 'GAME_STAMP', 'GAME_OVER', 'GAME_SORT'].forEach(k => {
        if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
      });

      /* 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍（實際量測在端對端測試裡）。 */
      const scale = Math.min(1.5, 290 / W);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      tooSmall('GPICK ' + D.GPICK, D.GPICK);
      tooSmall('a corner’s tap circle (2 × CORNER_HIT)', 2 * D.CORNER_HIT);
      tooSmall('the handle', D.OPEN_HANDLE);
      tooSmall('a stamp (height)', D.STAMP_TRAY.h); tooSmall('a stamp (width)', D.STAMP_TRAY.w);
      tooSmall('the checker corner', D.STAMP_TRAY.chk.size);
      tooSmall('B’s grip', D.OVER_GRIP);
      tooSmall('a life card (width)', D.SORT_CARD.w);
      [D.OPEN_HANDLE, D.STAMP_TRAY.h, D.STAMP_TRAY.chk.size, D.OVER_GRIP, D.SORT_CARD.w].forEach(s => { if (s < D.GPICK) fail('a piece of size ' + s + ' is smaller than GPICK ' + D.GPICK); });
      need('open', /addPiece\(B, \{ w:OPEN_HANDLE, h:OPEN_HANDLE, cx:t0\.x, cy:t0\.y,/, 'the handle is not OPEN_HANDLE × OPEN_HANDLE at the tip');
      need('stamp', /addPiece\(B, \{ w:T\.w, h:T\.h, cx:T\.xs\[j\], cy:T\.y,/, 'the stamps are not drawn at STAMP_TRAY');
      need('stamp', /addPiece\(B, \{ w:T\.chk\.size, h:T\.chk\.size, cx:T\.chk\.x, cy:T\.y,/, 'the checker corner is not drawn at STAMP_TRAY.chk');
      need('over', /addPiece\(B, \{ w:OVER_GRIP, h:OVER_GRIP, cx:OVER_B\.x, cy:OVER_B\.y,/, 'B’s grip is not OVER_GRIP at OVER_B');
      need('sort', /addPiece\(B, \{ w:C\.w, h:C\.h, cx:cx, cy:cy,/, 'the life cards are not SORT_CARD-sized');

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
        if (I18N[L].gPts(20).indexOf('20') < 0) fail('gPts ' + L);
        if (I18N[L].gMinus.indexOf('5') < 0) fail('gMinus ' + L);
        if (I18N[L].gWin(85).indexOf('85') < 0) fail('gWin ' + L + ' does not show the score');
      });

      /* --- nearestOpen()：從原始碼切出來真的跑（印章卡 2 × 2、排一排的三格：相鄰的放寬區會重疊） --- */
      {
        const fsrc = extractFunction(src, 'nearestOpen');
        let nearestOpen = null;
        if (!fsrc) fail('cannot find nearestOpen() in index.html');
        else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
        if (nearestOpen){
          const C = D.STAMP_CARD, cards = [0, 1, 2, 3].map(i => { const xy = D.stampCardXY(i); return { id:i, cx:xy.x, cy:xy.y, hw:C.w / 2, hh:C.h / 2, done:false }; });
          const S = D.SORT_SLOT, slots = [0, 1, 2].map(k => ({ id:k, cx:D.sortSlotX(k), cy:S.y, hw:S.w / 2, hh:S.h / 2, done:false }));
          [[cards, D.STAMP_PAD, 'stamp card'], [slots, D.SORT_PAD, 'sort slot']].forEach(([list, pad, what]) => {
            let bad = 0, inGap = 0;
            for (let x = 0; x <= W; x += 1) for (let y = 0; y <= 340; y += 1){
              const g = nearestOpen(list, { x, y }, pad);
              /* 自己的算法：到方框的距離最小的那一格（在 pad 以內） */
              /* 自己的算法：先比到方框的距離，一樣近再比到中心的距離（兩個都要最小） */
              let best = null, bd = Infinity, bc = Infinity;
              list.forEach(b => { const dx = x - b.cx, dy = y - b.cy, ex = Math.max(0, Math.abs(dx) - b.hw), ey = Math.max(0, Math.abs(dy) - b.hh); if (Math.abs(dx) > b.hw + pad || Math.abs(dy) > b.hh + pad) return; const dd = Math.hypot(ex, ey), dc = Math.hypot(dx, dy); if (dd < bd - 1e-9 || (Math.abs(dd - bd) <= 1e-9 && dc < bc)) { bd = dd; bc = dc; best = b; } });
              const inBox = list.some(b => Math.abs(x - b.cx) <= b.hw && Math.abs(y - b.cy) <= b.hh);
              if (!inBox && best && list.filter(b => Math.abs(x - b.cx) <= b.hw + pad && Math.abs(y - b.cy) <= b.hh + pad).length > 1) inGap++;
              if ((g ? g.id : null) !== (best ? best.id : null)) bad++;
            }
            if (bad) fail('nearestOpen(): ' + bad + ' points next to a ' + what + ' are given to a farther one (or none)');
            if (!inGap) fail('nearestOpen(): the ' + what + ' drop pads never overlap — the overlap-zone e2e test has nothing to test');
          });
          const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
          const r0 = nearestOpen(two, { x:140, y:100 }, 6);
          if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
          /* 到兩個方框一樣近（都是 5）：要判給中心比較近的那一個（後面那一個）（codex 第一輪：原本的神諭在平手時什麼都收） */
          const tie = [ { id:0, cx:100, cy:100, hw:20, hh:20, done:false }, { id:1, cx:135, cy:100, hw:5, hh:5, done:false } ];
          const r1 = nearestOpen(tie, { x:125, y:100 }, 8);
          if (!r1 || r1.id !== 1) fail('nearestOpen(): on a tie in distance to the box, the tie is not broken by the distance to the centre');
          const dn = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
          if (nearestOpen(dn, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
          if (nearestOpen(dn, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
        }
      }

      /* --- 第 1 關：找角 --- */
      {
        const H = D.CORNER_H, HIT = D.CORNER_HIT, SD = D.CORNER_SIDE;
        let anyRight = false, anyOther = false;
        D.GAME_CORNER.forEach((pts, pi) => {
          const w = 'GAME_CORNER[' + pi + ']';
          if (pts.length < 4 || pts.length > 6) fail(w + ': ' + (pts.length - 2) + ' corners — should be 2~4');
          pts.forEach((p, i) => { if (p[0] < HIT || p[1] < HIT || p[0] > W - HIT || p[1] > H - HIT) fail(w + ' point ' + i + ' is outside the ' + W + '×' + H + ' board (its tap circle runs off the edge)'); });
          for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < 2 * HIT + 4) fail(w + ': points ' + i + ' and ' + j + ' are closer than ' + (2 * HIT + 4) + ' (their tap circles touch)');
          for (let i = 0; i + 1 < pts.length; i++) if (Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) < 2 * SD.keep + 20) fail(w + ': side ' + i + ' is too short to have a straight middle');
          for (let i = 1; i + 1 < pts.length; i++){
            const a = pts[i - 1], p = pts[i], b = pts[i + 1];
            let t = Math.abs(Math.atan2(a[1] - p[1], a[0] - p[0]) - Math.atan2(b[1] - p[1], b[0] - p[0])) / DEG; if (t > 180) t = 360 - t;
            if (t < 35 || t > 150) fail(w + ': corner ' + i + ' turns ' + t.toFixed(0) + '° — it is not a clear turn (35~150)');
            if (Math.abs(t - 90) < 0.5) anyRight = true; else anyOther = true;
          }
          /* 不自己交叉（不相鄰的兩條邊不可以相碰） */
          const cross = (p1, p2, p3, p4) => { const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0; };
          for (let i = 0; i + 1 < pts.length; i++) for (let j = i + 2; j + 1 < pts.length; j++) if (cross(pts[i], pts[i + 1], pts[j], pts[j + 1])) fail(w + ': sides ' + i + ' and ' + j + ' cross');
          /* cornerHit() 在整張畫板上每 2px 和自己的分類比 */
          let bad = 0, sides = 0;
          for (let x = 0; x <= W; x += 2) for (let y = 0; y <= H; y += 2){
            let mine = null, bd = Infinity;
            pts.forEach((p, i) => { const dd = Math.hypot(x - p[0], y - p[1]); if (dd <= HIT && dd < bd){ bd = dd; mine = (i === 0 || i === pts.length - 1) ? 'end:' + i : 'corner:' + i; } });
            if (!mine) for (let i = 0; i + 1 < pts.length && !mine; i++){
              const ax = pts[i][0], ay = pts[i][1], vx = pts[i + 1][0] - ax, vy = pts[i + 1][1] - ay, len = Math.hypot(vx, vy);
              const tt = ((x - ax) * vx + (y - ay) * vy) / (len * len);
              if (tt < 0 || tt > 1) continue;
              const dist = Math.abs((x - ax) * vy - (y - ay) * vx) / len;
              if (dist <= SD.hit && tt * len >= SD.keep && (1 - tt) * len >= SD.keep){ mine = 'side:' + i; sides++; }
            }
            const g = D.cornerHit(pts, { x, y }), theirs = g ? g.kind + ':' + g.i : null;
            if (theirs !== mine) bad++;
          }
          if (bad) fail(w + ': cornerHit() disagrees with my own classification at ' + bad + ' points');
          if (!sides) fail(w + ': no point is ever a "straight side" tap');
          /* 畫出來的：折線就是這些點；全部找到時每一個轉彎都有一段弧 */
          const found = {}; for (let i = 1; i + 1 < pts.length; i++) found[i] = true;
          const svg = D.cornerSVG(pts, found), pl = (svg.match(/points="([^"]*)"/) || [])[1];
          if (pl !== pts.map(p => p.join(',')).join(' ')) fail(w + ': cornerSVG() draws ' + pl);
          if ((svg.match(/<path /g) || []).length !== pts.length - 2) fail(w + ': cornerSVG() marks ' + (svg.match(/<path /g) || []).length + ' corners, should be ' + (pts.length - 2));
          if ((D.cornerSVG(pts, {}).match(/<path /g) || []).length) fail(w + ': cornerSVG() marks a corner before it is found');
        });
        if (!anyRight || !anyOther) fail('GAME_CORNER: the pool should have both right-angle corners and other corners');
        LANGS.forEach(L => {
          const d = I18N[L];
          if (d.gCornerNow(2, 3).match(/\d+/g).join() !== '2,3') fail('gCornerNow ' + L);
          if (d.gCorner2(3).match(/\d+/g).join() !== '2,3') fail('gCorner2 ' + L + ' ("hint 2: 3 left")');
          if (d.gCornerDone(3).match(/\d+/g).join() !== '3') fail('gCornerDone ' + L);
          if (!(L === 'zh' ? /一條邊/ : /one side/).test(d.gCornerEnd)) fail('gCornerEnd ' + L + ' does not say there is only one side');
          if (!(L === 'zh' ? /直直/ : /straight/).test(d.gCornerSide)) fail('gCornerSide ' + L + ' does not say the side is straight');
        });
        need('corner', /var h = cornerHit\(pts, pt\);/, 'a tap is not judged by cornerHit()');
        need('corner', /if \(h\.kind === 'end'\)\{ roundMiss\(d\.gCornerEnd\); return; \}/, 'an end of the line is not a mistake');
        need('corner', /if \(h\.kind === 'side'\)\{ roundMiss\(d\.gCornerSide\); return; \}/, 'a straight side is not a mistake');
        need('corner', /if \(found\[h\.i\]\) return;/, 'a found corner counts twice');
        need('corner', /if \(nf === n\) roundSolved/, 'the round is not solved exactly when every corner is found');
      }

      /* --- 第 2 關：張一樣大 --- */
      {
        const H = D.OPEN_H, X = D.OPEN_X, ST = D.OPEN_STEP, hh = D.OPEN_HANDLE / 2;
        if (ST < 15) fail('OPEN_STEP ' + ST + ' — one step should be at least 15° so a wrong step is visible');
        const steps = []; for (let a = D.OPEN_MIN; a <= D.OPEN_MAX; a += ST) steps.push(a);
        const chord = (a, r) => 2 * r * Math.sin(a * DEG / 2);
        D.GAME_OPEN.forEach((e, i) => {
          const w = 'GAME_OPEN[' + i + ']';
          if (steps.indexOf(e.s) < 0) fail(w + ': 🎯 ' + e.s + ' is not on a step');
          if (steps.indexOf(e.start) < 0) fail(w + ': the start ' + e.start + ' is not on a step');
          if (e.start === e.s) fail(w + ': ✋ starts at the answer');
          if (Math.abs(e.rs - e.ry) < 20) fail(w + ': the side lengths should differ by at least 20 (' + e.rs + ' vs ' + e.ry + ') — the round is about a different length');
          /* 自己的「端點一樣遠」的那一格 */
          const mine = steps.reduce((b, a) => Math.abs(chord(a, e.ry) - chord(e.s, e.rs)) < Math.abs(chord(b, e.ry) - chord(e.s, e.rs)) ? a : b, steps[0]);
          if (D.openChordStep(e) !== mine) fail(w + ': openChordStep() is ' + D.openChordStep(e) + ', should be ' + mine);
          if (Math.abs(mine - e.s) < 2 * ST) fail(w + ': matching the ends gives ' + mine + ', too close to the answer ' + e.s + ' (the misconception has no step of its own)');
          if (e.start === mine) fail(w + ': ✋ starts on the "ends match" step');
          /* 那一句說「差不多遠」：那一格的端點距離和 🎯 差不到 15% */
          if (Math.abs(chord(mine, e.ry) - chord(e.s, e.rs)) > 0.15 * chord(e.s, e.rs)) fail(w + ': at the "ends match" step ' + mine + ' the ends are ' + chord(mine, e.ry).toFixed(1) + ' apart vs 🎯 ' + chord(e.s, e.rs).toFixed(1) + ' — not "about as far apart"');
          steps.forEach(a => {
            const want = a === e.s ? 'ok' : a === mine ? 'chord' : a < e.s ? 'small' : 'big';
            if (D.openVerdict(e, a) !== want) fail(w + ': openVerdict(' + a + ') is ' + D.openVerdict(e, a) + ', should be ' + want);
          });
          const Lo = D.openLayout(e);
          if (!near(Lo.sy, 14 + e.rs) && Lo.sy - e.rs < 8) fail(w + ': 🎯 runs off the top');
          /* 版面：每一格的把手在畫板裡、不碰到 🎯；🎯 ✋ 的字不碰任何一格的邊和把手 */
          const lbl = y => ({ x:D.OPEN_LBL.x - 2, y:y + D.OPEN_LBL.dy - D.OPEN_LBL.size, w:D.OPEN_LBL.size + 6, h:D.OPEN_LBL.size + 6 });
          const lS = lbl(Lo.sy), lY = lbl(Lo.vy);
          inside(lS, w + ': the 🎯 label', W, H); inside(lY, w + ': the ✋ label', W, H);
          const S0 = { x:X, y:Lo.sy }, Y0 = { x:X, y:Lo.vy };
          [[S0, 0, e.rs], [S0, e.s, e.rs]].forEach(([v, a, r]) => {
            const q = polar(v.x, v.y, a, r);
            inside(sq(q.x, q.y, 8), w + ': the 🎯 side at ' + a, W, H);
            [lS, lY].forEach(lb => { if (segHitsRect(v, q, lb)) fail(w + ': a 🎯 side runs through a label'); });
          });
          steps.forEach(a => {
            const t = polar(X, Lo.vy, a, e.ry), hb = sq(t.x, t.y, D.OPEN_HANDLE);
            inside(hb, w + ': the handle at ' + a, W, H);
            if (hb.y < Lo.sy + 4) fail(w + ': the handle at ' + a + ' reaches the 🎯 side (top ' + hb.y.toFixed(1) + ', 🎯 base ' + Lo.sy + ')');
            [lS, lY].forEach(lb => { if (hit(hb, lb) || segHitsRect(Y0, t, lb)) fail(w + ': the side or handle at ' + a + ' touches a label'); });
            /* openSVG 畫的就是這個角：兩條邊從同一點出發，第一條朝右，張開 a */
            const L = linesOf(D.openSVG(e, Lo, a));
            const S = measure(L.find(l => l.cls === 'gsarm0'), L.find(l => l.cls === 'gsarm1')), Yv = measure(L.find(l => l.cls === 'gyarm0'), L.find(l => l.cls === 'gyarm1'));
            if (!S || S.bad || !near(S.a, e.s, 0.3) || !near(S.r0, e.rs, 0.2) || !near(S.r1, e.rs, 0.2) || !near(S.d0, 0, 0.3)) fail(w + ': openSVG() does not draw 🎯 as ' + e.s + '° with sides ' + e.rs);
            if (!Yv || Yv.bad || !near(Yv.a, a, 0.3) || !near(Yv.r0, e.ry, 0.2) || !near(Yv.r1, e.ry, 0.2) || !near(Yv.d0, 0, 0.3) || !near(Yv.v.y, Lo.vy, 0.2)) fail(w + ': openSVG() does not draw ✋ as ' + a + '° with sides ' + e.ry);
          });
          /* openSnap()：指向每一個方向（含第一條邊下面），和自己的算法比 */
          let badSnap = 0;
          for (let x = 0; x <= W; x += 3) for (let y = 0; y <= H; y += 3){
            if (x === X && y === Lo.vy) continue;
            let ang = Math.atan2(Lo.vy - y, x - X) / DEG; if (ang < -90) ang += 360;
            const want = Math.max(D.OPEN_MIN, Math.min(D.OPEN_MAX, Math.round(ang / ST) * ST));
            if (D.openSnap(Lo, { x, y }) !== want) badSnap++;
          }
          if (badSnap) fail(w + ': openSnap() disagrees with my own snapping at ' + badSnap + ' points');
          if (D.openSnap(Lo, { x:X - 50, y:Lo.vy + 30 }) !== D.OPEN_MAX || D.openSnap(Lo, { x:X + 50, y:Lo.vy + 30 }) !== D.OPEN_MIN) fail(w + ': openSnap() below the first side does not stop at ' + D.OPEN_MIN + ' / ' + D.OPEN_MAX);
        });
        if (!D.GAME_OPEN.some(e => e.ry < e.rs) || !D.GAME_OPEN.some(e => e.ry > e.rs)) fail('GAME_OPEN: the pool should have ✋ sides both shorter and longer than 🎯');
        LANGS.forEach(L => {
          const d = I18N[L];
          if (!(L === 'zh' ? /差不多遠/ : /about as far apart/).test(d.gOpenChord(true) + d.gOpenChord(false)) || /一樣遠|ends as far apart/.test(d.gOpenChord(true) + d.gOpenChord(false))) fail('gOpenChord ' + L + ' claims the ends are exactly as far apart — the 15° step only makes them about as far');
          if (!(L === 'zh' ? /比較短/ : /shorter/).test(d.gOpenChord(true)) || !(L === 'zh' ? /比較長/ : /longer/).test(d.gOpenChord(false))) fail('gOpenChord ' + L + ': shorter or longer is the wrong way round');
          if (!(L === 'zh' ? /比較短/ : /shorter/).test(d.gOpenDone(true)) || !(L === 'zh' ? /比較長/ : /longer/).test(d.gOpenDone(false))) fail('gOpenDone ' + L + ': shorter or longer is the wrong way round');
          if (!(L === 'zh' ? /小/ : /smaller/).test(d.gOpenSmall) || !(L === 'zh' ? /大/ : /bigger/).test(d.gOpenBig)) fail('gOpenSmall/gOpenBig ' + L);
          if (!(L === 'zh' ? /再往外/ : /further out/).test(d.gOpen2('small')) || !(L === 'zh' ? /往回/ : /back/).test(d.gOpen2('big'))) fail('gOpen2 ' + L + ': the direction is the wrong way round');
        });
        need('open', /var v = openVerdict\(e, cur\);/, '"done" is not judged by openVerdict()');
        need('open', /hand\.abort\(\);[^\n]*\n\s*var v = openVerdict/, '"done" during a drag does not send the side back first');
        need('open', /roundMiss\(d\.gOpenChord\(e\.ry < e\.rs\)\);/, 'the "ends match" reason does not know whether ✋ is shorter or longer');
        need('open', /roundSolved\(d\.gOpenDone\(e\.ry < e\.rs\)\);/, 'the "done" message does not know whether ✋ is shorter or longer');
        need('open', /move: function\(p\)\{ set\(openSnap\(Lo, p\)\); \}/, 'dragging does not snap with openSnap()');
        need('open', /cancel: function\(\)\{ set\(base\); \}/, 'a lost capture does not put the side back');
      }

      /* --- 第 3 關：蓋印章 --- */
      {
        const C = D.STAMP_CARD, T = D.STAMP_TRAY, H = D.STAMP_H, area = { w:C.w, h:C.h - C.band };
        const cardBoxes = [0, 1, 2, 3].map(i => { const xy = D.stampCardXY(i); return sq(xy.x, xy.y, C.w, C.h); });
        cardBoxes.forEach((o, i) => inside(o, 'stamp card ' + i, W, H)); noHits(cardBoxes, 'stamp cards');
        const tray = T.xs.map(x => sq(x, T.y, T.w, T.h)).concat([sq(T.chk.x, T.y, T.chk.size)]);
        tray.forEach((o, i) => inside(o, 'stamp tray piece ' + i, W, H)); noHits(tray, 'stamp tray pieces');
        tray.forEach((o, i) => cardBoxes.forEach((c, j) => { if (hit(o, { x:c.x - D.STAMP_PAD, y:c.y - D.STAMP_PAD, w:c.w + 2 * D.STAMP_PAD, h:c.h + 2 * D.STAMP_PAD })) fail('stamp tray piece ' + i + ': the stamps reach the cards’ drop pads (card ' + j + ')'); }));
        let close = 0;
        D.GAME_STAMP.forEach((set, si) => {
          const w = 'GAME_STAMP[' + si + ']';
          if (set.length !== 4) fail(w + ': should have 4 angles');
          const kinds = set.map(c => D.stampKind(c.a));
          set.forEach((c, ci) => {
            const mine = c.a === 90 ? 'right' : c.a < 90 ? 'acute' : 'obtuse';
            if (kinds[ci] !== mine) fail(w + '[' + ci + ']: stampKind(' + c.a + ') is ' + kinds[ci] + ', should be ' + mine);
            if (c.a !== 90 && !((c.a >= 35 && c.a <= 75) || (c.a >= 105 && c.a <= 150))) fail(w + '[' + ci + ']: ' + c.a + '° is too close to a right angle (acute 35~75, obtuse 105~150)');
            if (c.a === 75 || c.a === 105) close++;
            if (c.r < 30) fail(w + '[' + ci + ']: sides of ' + c.r + ' are too short to see');
            /* 量回來：卡片上畫的角就是 c.a；檢查角在第一條邊的 +90°（和第二條邊同一邊）；全部在卡片的上半部裡面（扣掉 6px 與線寬） */
            [false, true].forEach(chk => {
              const L = linesOf(D.stampCardSVG(c, chk)), A = measure(L.find(l => l.cls === 'garm0'), L.find(l => l.cls === 'garm1'));
              if (!A || A.bad || !near(A.a, c.a, 0.3) || !near(A.d0, ((c.d % 360) + 360) % 360, 0.3)) return fail(w + '[' + ci + ']: stampCardSVG() draws ' + (A && A.a) + '°, should be ' + c.a + '°');
              const ck = L.filter(l => l.cls === 'gchkline');
              if (chk && (ck.length !== 1 || !near(ccw(A.d0, dirOf(ck[0].x1, ck[0].y1, ck[0].x2, ck[0].y2)), 90, 0.3) || !near(ck[0].x1, A.v.x, 0.15) || !near(ck[0].y1, A.v.y, 0.15))) fail(w + '[' + ci + ']: stampCardSVG() does not lay the checker corner at +90° from the black side, vertex on vertex');
              if (!chk && ck.length) fail(w + '[' + ci + ']: the checker corner is drawn before it is placed');
              L.forEach(l => [[l.x1, l.y1], [l.x2, l.y2]].forEach(([x, y]) => { if (x < 6 || y < 6 || x > area.w - 6 || y > area.h - 6) fail(w + '[' + ci + ']: the drawing does not fit its card (' + x.toFixed(1) + ',' + y.toFixed(1) + ')'); }));
            });
          });
          ['acute', 'right', 'obtuse'].forEach(k => { if (kinds.indexOf(k) < 0) fail(w + ' has no ' + k + ' angle'); });
          if (!set.some(c => c.a === 90 && c.d % 90 !== 0)) fail(w + ': no right angle is drawn tilted (the checker corner should be needed)');
        });
        if (close < 2) fail('GAME_STAMP: only ' + close + ' angles of 75° or 105° — without them the checker corner is never needed');
        LANGS.forEach(L => {
          const d = I18N[L];
          ['acute', 'right', 'obtuse'].forEach(k => { if (typeof d.gKindWord[k] !== 'string' || !d.gKindWord[k]) fail('gKindWord.' + k + ' missing in ' + L); });
          const says = { right:L === 'zh' ? /剛好貼著/ : /exactly on/, acute:L === 'zh' ? /還沒張開到/ : /hasn’t opened as far/, obtuse:L === 'zh' ? /超出了/ : /goes past/ };
          ['acute', 'right', 'obtuse'].forEach(truth => ['acute', 'right', 'obtuse'].forEach(stamp => {
            if (truth === stamp) return;
            const txt = d.gStampWrong('C', truth, stamp);
            if (!says[truth].test(txt)) fail('gStampWrong ' + L + ' (' + truth + ' stamped ' + stamp + ') does not say what the checker shows: ' + txt);
            Object.keys(says).forEach(o => { if (o !== truth && says[o].test(txt)) fail('gStampWrong ' + L + ' (' + truth + ') also says the ' + o + ' thing: ' + txt); });
            if (txt.indexOf('C') < 0) fail('gStampWrong ' + L + ' does not name the card');
          }));
          if (d.gStampNow(3, 4).match(/\d+/g).join() !== '3,4') fail('gStampNow ' + L);
        });
        need('stamp', /var o = nearestOpen\(cards, pt, STAMP_PAD\);/, 'a stamp is not dropped on the nearest open card');
        need('stamp', /if \(P\.data\.kind !== o\.kind\)\{ roundMiss\(d\.gStampWrong\(o\.name, o\.kind, P\.data\.kind\)\); giveChecker\(o\); return false; \}/, 'a wrong stamp is accepted (or the reason/checker is missing)');
        need('stamp', /var set = shuffle\(pick\(GAME_STAMP\)\)/, 'the cards are not shuffled');
        need('stamp', /gCtx\.onHint2 = function\(\)\{ cards\.forEach\(giveChecker\); \};/, 'hint 2 does not lay the checker on every card');
      }

      /* --- 第 4 關：疊一疊 --- */
      {
        const H = D.OVER_H, A = D.OVER_A, P = D.OVER_PAD;
        let anySame = false, anyA = false, anyB = false;
        const trapS = [], trapL = [];   /* 比較大的那一個邊比較短／比較長 —— 兩種都要有，「挑邊短的」「挑邊長的」都不能每一題都對 */
        D.GAME_OVER.forEach((e, i) => {
          const w = 'GAME_OVER[' + i + ']';
          const ans = e.a === e.b ? 'same' : e.a > e.b ? 'A' : 'B';
          if (D.overAnswer(e) !== ans) fail(w + ': overAnswer() is ' + D.overAnswer(e) + ', should be ' + ans);
          if (ans === 'same') anySame = true; else if (ans === 'A') anyA = true; else anyB = true;
          if (e.a !== e.b && Math.abs(e.a - e.b) < 20) fail(w + ': A and B differ by only ' + Math.abs(e.a - e.b) + '° — the picture cannot decide');
          if (e.b % 45 === 0) fail(w + ': b ' + e.b + ' is a multiple of 45 — B’s other side could be turned onto A’s first side');
          /* 被擋下來的每一種轉法（不是黑邊對黑邊），都不可以有一條 B 的邊剛好落在 A 的邊上 —— 不然「還沒有一邊對一邊」是假話（驗證者抓到 b:80） */
          for (let k = 1; k < 8; k++){
            const bs = [k * 45, k * 45 + e.b].map(x => ((x % 360) + 360) % 360), as = [0, e.a % 360];
            if (bs.some(x => as.some(y => near(x, y, 0.01)))) fail(w + ': turned to ' + (k * 45) + '° a side of B lies on a side of A — a true side-on-side overlay is rejected as "not side on side"');
          }
          if (!(isInt(e.turn) && e.turn >= 1 && e.turn <= 7)) fail(w + ': turn ' + e.turn + ' — B already lies on A or is not on a 45° step');
          /* 「就算邊畫得比較短」那一句必須是真的；一樣大的那幾題，邊要一長一短 */
          if (ans === 'A') (e.ra < e.rb ? trapS : trapL).push(i); else if (ans === 'B') (e.rb < e.ra ? trapS : trapL).push(i);
          if (ans === 'same' && Math.abs(e.ra - e.rb) < 20) fail(w + ': "the same" with sides of ' + e.ra + ' and ' + e.rb + ' — they should be one long, one short');
          if (Math.min(e.ra, e.rb) < 2 * P + 8) fail(w + ': a side of ' + Math.min(e.ra, e.rb) + ' — the vertex and tip drop zones overlap (pad ' + P + ')');
          /* A：量回來 */
          const LA = linesOf(D.overASVG(e)), MA = measure(LA.find(l => l.cls === 'gaarm0'), LA.find(l => l.cls === 'gaarm1'));
          if (!MA || MA.bad || !near(MA.a, e.a, 0.3) || !near(MA.d0, 0, 0.3) || !near(MA.v.x, A.x) || !near(MA.v.y, A.y)) fail(w + ': overASVG() does not draw A as ' + e.a + '° pointing right at OVER_A');
          LA.forEach(l => inside(sq(l.x2, l.y2, 8), w + ': A', W, H));
          const la = polar(A.x, A.y, e.a, e.ra + D.OVER_LBL);
          if (!new RegExp('<text x="' + la.x.toFixed(1) + '" y="' + la.y.toFixed(1) + '"[^>]*>A</text>').test(D.overALabelSVG(e))) fail(w + ': the letter A is not at the end of A’s other side');
          /* B：每一種轉法都量回來，而且在原位時整個（含字母）在畫板裡；疊上去之後也在畫板裡 */
          const S = D.overBSize(e);
          let bB0 = null;   /* B 的字母在第一條邊朝右（疊上去的那一種）時畫出來的方框，座標換到畫板上、頂點在 OVER_A */
          for (let k = 0; k < 8; k++){
            const dir = k * 45, svg = D.overBSVG(e, dir), LB = linesOf(svg), MB = measure(LB.find(l => l.cls === 'gbarm0'), LB.find(l => l.cls === 'gbarm1'));
            if (!MB || MB.bad || !near(MB.a, e.b, 0.3) || !near(MB.d0, dir % 360, 0.3) || !near(MB.v.x, S / 2) || !near(MB.v.y, S / 2)) { fail(w + ': overBSVG(' + dir + ') does not draw B as ' + e.b + '° with its first side at ' + dir + '°'); break; }
            const lb = svg.match(/<text x="([\d.-]+)" y="([\d.-]+)"[^>]*>B<\/text>/);
            const pts = LB.map(l => ({ x:l.x2, y:l.y2 })).concat(lb ? [{ x:+lb[1], y:+lb[2] }] : []);
            if (!lb) fail(w + ': B is not labelled');
            const fsB = +((svg.match(/<text[^>]*font-size="([\d.]+)"/) || [])[1]), swB = +((svg.match(/<text[^>]*stroke-width="([\d.]+)"/) || [])[1] || 0);
            if (dir === 0){ const tb = textBoxes(svg).find(b => b.ch === 'B'); if (tb) bB0 = { x:A.x - S / 2 + tb.x, y:A.y - S / 2 + tb.y, w:tb.w, h:tb.h }; }
            if (!(fsB > 0 && fsB <= 26)) fail(w + ': the letter B is ' + fsB + 'px');
            [[D.OVER_B, 'at home']].concat(dir === 0 ? [[A, 'laid on A']] : []).forEach(([at, where]) => {
              LB.forEach(l => inside(sq(at.x - S / 2 + l.x2, at.y - S / 2 + l.y2, 8), w + ': B’s side (' + dir + '°, ' + where + ')', W, H));
              if (lb) inside({ x:at.x - S / 2 + +lb[1] - (0.75 * fsB + swB) / 2, y:at.y - S / 2 + +lb[2] - (fsB + swB) / 2, w:0.75 * fsB + swB, h:fsB + swB }, w + ': the letter B (' + dir + '°, ' + where + ')', W, H);
            });
          }
          /* 放開的地方：頂點與兩個尾巴離得夠遠；B 原地放開不會碰到任何一個 */
          const tips = [polar(A.x, A.y, 0, e.ra), polar(A.x, A.y, e.a, e.ra)];
          tips.forEach(t => { if (Math.hypot(t.x - A.x, t.y - A.y) < 2 * P + 8) fail(w + ': the vertex and tip drop zones overlap'); });
          [A].concat(tips).forEach(t => { if (Math.abs(t.x - D.OVER_B.x) <= P && Math.abs(t.y - D.OVER_B.y) <= P) fail(w + ': B at home is already on a drop zone'); });
          /* 字母的方框從真正的字級與描邊算（codex 第一輪：字級改成 80 也全綠）：都在畫板裡、疊好之後 A 和 B 不重疊、不壓在頂點上 */
          const fsA = +((D.overALabelSVG(e).match(/font-size="([\d.]+)"/) || [])[1]), swA = +((D.overALabelSVG(e).match(/<text[^>]*stroke-width="([\d.]+)"/) || [])[1] || 0);
          const box = (p, fs, sw) => ({ x:p.x - (0.75 * fs + sw) / 2, y:p.y - (fs + sw) / 2, w:0.75 * fs + sw, h:fs + sw });
          if (!(fsA > 0 && fsA <= 26)) fail(w + ': the letters are ' + fsA + 'px — bigger than the 26px the layout allows');
          const tA = textBoxes(D.overALabelSVG(e)).find(b => b.ch === 'A'), bA = tA || box(la, fsA, swA), bB = bB0;
          if (!bB) return fail(w + ': cannot read the letter B as it is drawn once laid on A');
          inside(bA, w + ': the letter A', W, H);
          if (hit(bA, bB)) fail(w + ': once overlapped, the letters A and B sit on top of each other');
          [bA, bB].forEach(b => { if (hit(b, sq(A.x, A.y, 14))) fail(w + ': a letter covers the vertex'); });
        });
        if (!anySame || !anyA || !anyB) fail('GAME_OVER: the pool should have A bigger, B bigger and the same');
        if (!trapS.length) fail('GAME_OVER: the bigger angle never has the shorter sides — the side-length trap is never set');
        if (!trapL.length) fail('GAME_OVER: the shorter sides always win — "pick the one with shorter sides" solves every round without overlapping');
        LANGS.forEach(L => {
          const d = I18N[L];
          ['A', 'B', 'same'].forEach(ans => ['A', 'B', 'same'].forEach(said => {
            if (ans === said) return;
            const txt = d.gOverWrong(ans, said);
            if (ans === 'same'){ if (!(L === 'zh' ? /一樣大/ : /the same/).test(txt)) fail('gOverWrong ' + L + ' (same) does not say they are the same: ' + txt); return; }
            const small = ans === 'A' ? 'B' : 'A';
            const re = L === 'zh' ? new RegExp(ans + ' 的另一條邊在 ' + small + ' 的外面') : new RegExp(ans + '’s other side is outside ' + small + '’s');
            if (!re.test(txt)) fail('gOverWrong ' + L + ' (' + ans + ' bigger, said ' + said + ') does not say ' + ans + ' is outside: ' + txt);
          }));
          ['A', 'B'].forEach(ans => [true, false].forEach(sh => {
            const txt = d.gOverDone(ans, sh), says = (L === 'zh' ? /比較短/ : /shorter/).test(txt);
            if (!(L === 'zh' ? new RegExp('^' + ans + ' 比較大') : new RegExp('^' + ans + ' is bigger')).test(txt) || says !== sh) fail('gOverDone ' + L + ' (' + ans + ', shorter ' + sh + '): ' + txt);
          }));
          if (!(L === 'zh' ? /一樣大/ : /The same/).test(d.gOverDone('same'))) fail('gOverDone ' + L + ' (same)');
          const t3 = d.gOver2Turn(3, d.gOverTurnR);
          if (t3.indexOf('3') < 0 || t3.indexOf(d.gOverTurnR) < 0) fail('gOver2Turn ' + L + ' does not say how many presses of which button');
          if (!/↺/.test(d.gOverTurnL) || !/↻/.test(d.gOverTurnR)) fail('gOverTurnL/R ' + L);
        });
        need('over', /function turn\(step\)\{[^\n]*bDir = \(bDir \+ step \+ 360\) % 360;/, 'a turn does not move B by one 45° step');
        need('over', /actionBtn\(row, d\.gOverTurnL, function\(\)\{ turn\(45\); \}\)/, '↺ does not turn B counter-clockwise');
        need('over', /actionBtn\(row, d\.gOverTurnR, function\(\)\{ turn\(-45\); \}\)/, '↻ does not turn B clockwise');
        need('over', /bDir \/ 45 <= 4 \? d\.gOverTurnR : d\.gOverTurnL/, 'gOver2Turn names the wrong button');
        need('over', /var t = nearestOpen\(targets, pt, OVER_PAD\);/, 'B is not dropped on the nearest of A’s vertex and tips');
        need('over', /if \(t\.k === 't'\)\{ roundMiss\(d\.gOverVertex\); return false; \}/, 'the end of a side counts as "vertex on vertex"');
        need('over', /if \(bDir !== 0\)\{ roundMiss\(d\.gOverSide\); return false; \}/, 'B can be laid on A with the sides apart');
        need('over', /roundSolved\(d\.gOverDone\(ans, ans === 'A' \? e\.ra < e\.rb : e\.rb < e\.ra\)\);/, 'the done message does not know whether the bigger one has the shorter sides');
        need('over', /if \(!placed \|\| gSolved\) return;/, 'an answer before overlapping is taken');
        need('over', /b\.disabled = true;/, 'the answers are not disabled until the overlap');
        need('over', /, bDir = e\.turn \* 45,/, 'B does not start turned');
      }

      /* --- 第 5 關：排一排 --- */
      {
        const S = D.SORT_SLOT, C = D.SORT_CARD, H = D.SORT_H, step = S.w + S.gap, x0 = (W - 2 * step) / 2;
        const slots = [0, 1, 2].map(k => sq(D.sortSlotX(k), S.y, S.w, S.h));
        slots.forEach((o, k) => inside(o, 'sort slot ' + k, W, H)); noHits(slots, 'sort slots');
        const cards = [0, 1, 2].map(k => sq(x0 + k * step, C.y, C.w, C.h));
        cards.forEach((o, k) => inside(o, 'sort card ' + k, W, H)); noHits(cards, 'sort cards');
        cards.forEach((o, k) => slots.forEach((s, j) => { if (hit(o, { x:s.x - D.SORT_PAD, y:s.y - D.SORT_PAD, w:s.w + 2 * D.SORT_PAD, h:s.h + 2 * D.SORT_PAD })) fail('sort card ' + k + ': the cards reach the slots’ drop pads (slot ' + j + ')'); }));
        if (C.w > S.w || C.h > S.h) fail('a sort card is bigger than its slot');
        need('sort', /\}, S\.w \+ S\.gap\);/, 'the tray step is not S.w + S.gap');
        if (!(S.y - S.h / 2 >= 24)) fail('sort: the slots run into the "small → big" line');
        D.GAME_SORT.forEach((set, si) => {
          const w = 'GAME_SORT[' + si + ']';
          if (set.length !== 3 || new Set(set.map(it => it.id)).size !== 3) fail(w + ': three different things');
          const mine = set.map((it, i) => i).sort((x, y) => set[x].a - set[y].a);
          if (D.sortOrder(set).join() !== mine.join()) fail(w + ': sortOrder() is ' + D.sortOrder(set).join() + ', should be ' + mine.join());
          const sa = mine.map(i => set[i].a);
          if (sa[1] - sa[0] < 25 || sa[2] - sa[1] < 25) fail(w + ': ' + sa.join(' < ') + ' — neighbours should be at least 25° apart — the picture cannot decide');
          const byLen = set.map((it, i) => i).sort((x, y) => set[y].r - set[x].r);
          if (byLen[0] === mine[2]) fail(w + ': the longest sides are on the biggest angle — no trap');
          if (byLen.join() === mine.join() || byLen.slice().reverse().join() === mine.join()) fail(w + ': the side lengths give the order — sorting by side length (either way) solves it without looking at the opening');
          set.forEach(it => {
            LANGS.forEach(L => {
              const nmv = I18N[L].gLifeName && I18N[L].gLifeName[it.id];
              if (!nmv) return fail(w + ': gLifeName.' + it.id + ' is missing in ' + L);
              /* 名字裡不可以有圖示：🕒 自己就畫了一個直角，會和卡片上的角打架（codex 第一輪） */
              if (/\p{Extended_Pictographic}/u.test(nmv)) fail(w + ': gLifeName.' + it.id + ' (' + L + ') carries a picture that has an angle of its own');
              if (nmv.length > (L === 'zh' ? 4 : 9)) fail(w + ': gLifeName.' + it.id + ' (' + L + ') is too long for an ' + C.w + '-wide card');
            });
            if (it.id === 'scissors' && it.a > 90) fail(w + ': scissors that open ' + it.a + '° — scissors do not open past a right angle');
            if (it.a < 20 || it.a > 160) fail(w + ': ' + it.a + '° out of range');
            const L = linesOf(D.sortCardSVG(it)), A = measure(L.find(l => l.cls === 'garm0'), L.find(l => l.cls === 'garm1'));
            if (!A || A.bad || !near(A.a, it.a, 0.3) || !near(A.d0, 0, 0.3) || !near(A.r1, it.r, 0.2)) fail(w + ': sortCardSVG() draws ' + (A && A.a) + '°, should be ' + it.a);
            L.forEach(l => [[l.x1, l.y1], [l.x2, l.y2]].forEach(([x, y]) => { if (x < 6 || y < 6 || x > C.w - 6 || y > C.h - C.band - 6) fail(w + ': the ' + it.id + ' drawing does not fit its card'); }));
          });
        });
        LANGS.forEach(L => {
          const d = I18N[L];
          if (!Array.isArray(d.gSortSlot) || d.gSortSlot.length !== 3) fail('gSortSlot ' + L);
          const big = d.gSortWrong('門', '書', true), small = d.gSortWrong('門', '書', false);
          if (!(L === 'zh' ? /的角大，這一格要放比較小/ : /is bigger than .* needs a smaller/).test(big) || !(L === 'zh' ? /的角小，這一格要放比較大/ : /is smaller than .* needs a bigger/).test(small)) fail('gSortWrong ' + L + ': bigger and smaller are the wrong way round');
          const done = d.gSortDone(['x1', 'x2', 'x3']);
          if (done.indexOf('x1') > done.indexOf('x2') || done.indexOf('x2') > done.indexOf('x3') || done.indexOf('x1') < 0) fail('gSortDone ' + L + ' does not list them smallest first');
          if (d.gSortNow(2, 3).match(/\d+/g).join() !== '2,3') fail('gSortNow ' + L);
        });
        need('sort', /var s = nearestOpen\(slots, pt, SORT_PAD\);/, 'a card is not dropped in the nearest open slot');
        need('sort', /if \(P\.data\.i !== s\.want\)\{ roundMiss\(d\.gSortWrong\(nm\(mine\), nm\(want\), mine\.a > want\.a\)\); return false; \}/, 'a card is accepted in the wrong slot (or the reason compares the wrong way)');
        need('sort', /return \{ k:k, want:order\[k\],/, 'slot k does not want the k-th smallest');
        need('sort', /html:'<span class="gsname">' \+ nm\(it\) \+ '<\/span>' \+ sortCardSVG\(it\) \}/, 'the card label is not just the name (an icon would show an angle of its own)');
        need('sort', /roundSolved\(d\.gSortDone\(order\.map/, 'the done message does not list them in order');
      }
    }
  }
};
module.exports._test = { measure, linesOf, reviewRender };
