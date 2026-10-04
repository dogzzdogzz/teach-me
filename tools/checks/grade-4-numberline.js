/* grade-4/math/numberline —— 數線探險隊（把一格平分成幾份、在數線上標出／讀出分數與小數）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作：
 *
 * 1) 一個點的「值」。課程頁用整數 (k, d) 與 Math.floor／%；這裡用**重複相減**算商與餘數
 *    （divmodRef），並且把每一種印出來的寫法（真分數／假分數／帶分數／小數）各自
 *    重寫一份（fracRef／mixedRef／tenthRef），再和課程頁的字串逐一比對。
 * 2) 一個點的「位置」。課程頁是 X0 + k × (SPAN / (M × d))；這裡**一段一段累加**過去
 *    （pxRef），所以把乘法寫錯（或把 X0 弄丟）會被抓到。允許的 (M, d) 讓一小段的寬度
 *    永遠是整數像素，所以兩條路必須**完全相等**，不需要容差。
 * 3) ⚠️ **從畫出來的圖把 (M, d, k) 量回來**（measurePlanRef）：整數標籤落在哪幾根刻度上
 *    → 一格幾段（d）與有幾格（M）；點落在第幾根刻度上 → k。這是這份設定最重要的一條 ——
 *    只驗「spec 說什麼」的話，畫圖那一段整個壞掉也是綠的。
 * 4) 算式逐條驗算（claimProblems）。⚠️ **這一課不能用 tools/checks/lib/arith.js**：
 *    那一份只認整數的算式，而這一課的核心宣稱是 `分子 ÷ 分母 ＝ 商 餘 餘數`、
 *    `7/4 ＝ 1 又 3/4`、`3/10 ＝ 0.3` —— 實測 lib/arith.js 會把 `9 ÷ 4 ＝ 2 餘 1`
 *    讀成 `9 / 4 = 2` 而**誤報**，也會把小數整條擋掉。所以這一課自己用**精確有理數**
 *    寫一份，並且**逐個等號記帳**：任何一個等號沒有被辨認出來的宣稱吃掉，就報錯
 *    （fail-closed，不可以靜靜跳過）。驗算器自己有 PROBE（零誤報 ＋ 一定要抓到）。
 *
 * ⚠️ 這一課教的規則有前提，設定檔要分開驗：
 *    - 「數的是段，不是格線」：格線 ＝ 段 ＋ 1。四頁的措辭由 SIBLING_RULES 釘住。
 *    - 「畫在同一條線上的分數，分母就是那一格被平分成的份數」—— 所以**不做約分**：
 *      要孩子讀出來的每一個點，餘數和分母必須互質（不然 2/4 和 1/2 都對）。
 *    - 「同一條數線上右邊的比較大」只在**同一條線**上成立；異分母的比大小是五年級。
 *    - 小數只在 d ＝ 10 的時候出現（一小段就是 0.1）。
 * ⚠️ 圖上只有 line／circle／text，而且每一個 text 都是**單一個字**
 *    （整數 0~3、甲／乙、A／B），所以碰不到「長標籤被畫布裁掉」那一類缺陷；
 *    設定檔另外擋住任何人把多字的 <text> 加回圖裡。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const FIG_W_REF = 460, FIG_H_REF = 70;
const SPAN_REF = 360, X0_REF = 50, LINE_Y_REF = 30;
const END_OVER_REF = 14, TICK_BIG_REF = 11, TICK_SMALL_REF = 6;
const LBL_FS_REF = 19, LBL_DY_REF = 28, MARK_FS_REF = 15, MARK_DY_REF = 14;
const DOT_R_REF = 6, LINE_W_REF = 3, TICK_W_REF = 2, HILITE_W_REF = 7;
const CSS_H_REF = 70;                 /* .nlfig 的 CSS 高度，要和 viewBox 一致 */
const DENS_REF = [2, 3, 4, 5, 6, 10]; /* 畫得出來的份數（d ＝ 1 是「還沒平分」） */
const MAX_M_REF = 3, MAX_SEGS_REF = 24, MIN_SEG_PX_REF = 12;
const S1_DENS_REF = [2, 3, 4, 5, 10];
const S5_M_REF = 2, S5_D_REF = 10, S5_KS_REF = [3, 7, 10, 14];

/* ---------- 1) 精確有理數：印出來的每一種寫法都解析回 (分子, 分母) ---------- */
function gcdRef(a, b){ a = Math.abs(a); b = Math.abs(b); while (b){ const t = a % b; a = b; b = t; } return a; }
function ratRef(s){
  const t = String(s).replace(/\s+/g, ' ').trim();
  let m = /^(\d+) 又 (\d+)\/(\d+)$/.exec(t) || /^(\d+) (\d+)\/(\d+)$/.exec(t);
  if (m){
    const w = Number(m[1]), n = Number(m[2]), d = Number(m[3]);
    if (!d) return null;
    return { n:w * d + n, d:d };
  }
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m){ const d = Number(m[2]); if (!d) return null; return { n:Number(m[1]), d:d }; }
  m = /^(\d+)\.(\d+)$/.exec(t);
  if (m){ const pow = Math.pow(10, m[2].length); return { n:Number(m[1]) * pow + Number(m[2]), d:pow }; }
  m = /^(\d+)$/.exec(t);
  if (m) return { n:Number(m[1]), d:1 };
  return null;
}
function ratKey(v){
  if (!v) return null;
  const g = gcdRef(v.n, v.d) || 1;
  return (v.n / g) + '/' + (v.d / g);
}
function ratEq(a, b){ return a && b && a.n * b.d === b.n * a.d; }
/* 選項的去重鍵：解析得出來就比值，解析不出來（整句話）就比字串。 */
function optKeyRef(s){
  const v = ratRef(String(s).replace(/[段份格條]|parts?|steps?|marks?/g, '').trim());
  return v ? ('v:' + ratKey(v)) : ('raw:' + String(s).replace(/\s+/g, ''));
}

/* ---------- 2) 商與餘數：重複相減（不用 Math.floor 也不用 %） ---------- */
function divmodRef(a, b){
  if (!(b > 0) || a < 0 || a !== Math.round(a) || b !== Math.round(b)) return null;
  let q = 0, r = a;
  while (r >= b){ r -= b; q++; if (q > 10000) return null; }
  return { q:q, r:r };
}

/* ---------- 3) 印出來的寫法：獨立第二份 ---------- */
function fracRef(k, d){ return k + '/' + d; }
function mixedRef(k, d, lang){
  const qr = divmodRef(k, d);
  if (!qr) return null;
  if (qr.r === 0) return String(qr.q);
  if (qr.q === 0) return qr.r + '/' + d;
  return lang === 'zh' ? (qr.q + ' 又 ' + qr.r + '/' + d) : (qr.q + ' ' + qr.r + '/' + d);
}
function tenthRef(k){
  const qr = divmodRef(k, 10);
  if (!qr) return null;
  return qr.r === 0 ? String(qr.q) : (qr.q + '.' + qr.r);
}

/* ---------- 4) 位置：一段一段累加，不是一次乘完 ---------- */
function segPxRef(M, d){
  if (!(M > 0) || !(d > 0)) return null;
  const n = M * d;
  if (SPAN_REF % n !== 0) return null;     /* 不整除就不是這一課畫得出來的 (M, d) */
  return SPAN_REF / n;
}
function pxRef(M, d, k){
  const sp = segPxRef(M, d);
  if (sp === null) return null;
  let x = X0_REF;
  for (let i = 0; i < k; i++) x += sp;
  return x;
}

/* ---------- 5) 從畫出來的圖把 (M, d, k) 量回來 ---------- */
function measurePlanRef(plan){
  const out = { problems:[], M:null, d:null, ks:[] };
  if (!plan || !Array.isArray(plan.ticks) || !Array.isArray(plan.labels) || !Array.isArray(plan.dots)){
    out.problems.push('the plan is not shaped like a drawing (ticks/labels/dots)');
    return out;
  }
  const ticks = plan.ticks.slice().sort((a, b) => a.x - b.x);
  const labels = plan.labels.slice().sort((a, b) => a.x - b.x);
  if (ticks.length < 2){ out.problems.push('the drawing has fewer than two ticks'); return out; }
  if (labels.length < 2){ out.problems.push('the drawing has fewer than two whole-number labels'); return out; }
  const idx = labels.map(l => {
    for (let i = 0; i < ticks.length; i++) if (ticks[i].x === l.x) return i;
    return -1;
  });
  if (idx.some(i => i < 0)){
    out.problems.push('a whole-number label does not sit on a tick, so the picture cannot be read');
    return out;
  }
  /* ⚠️ 只數刻度的**索引**的話，間距不等的圖也會量出 d ＝ 4：x ＝ 50、80、250、300、410
     的四段完全不等寬，可是第 4 根刻度上的點照樣被讀成 3/4（codex 第一輪）。
     所以每一段的**寬度**都要一樣。 */
  /* ⚠️ 這裡用**完全相等**而不是容差，是因為這一課的 (M, d) 保證一小段的寬度是
     **整數像素**（SPAN 是 360，M × d 一定整除它 —— segPxRef 不整除就直接回 null，
     planProblems 會先報出來）。所以「四捨五入出來的 33.333」在這一課根本畫不出來；
     哪一天有人放寬 (M, d)，這一條就會先響，那正是它該做的事（codex 第二輪）。 */
  const gaps = [];
  for (let i = 1; i < ticks.length; i++) gaps.push(ticks[i].x - ticks[i - 1].x);
  if (gaps.some(g => !(g > 0))) { out.problems.push('two ticks sit at the same x, or the ticks are not in order'); return out; }
  if (gaps.some(g => g !== gaps[0])){
    out.problems.push('the parts are not equally wide (gaps ' + [...new Set(gaps)].join(',') + '), so the picture cannot be read as equal parts');
    return out;
  }
  /* ⚠️ 標籤的**字**也要驗：只比 x 座標的話，兩端標成 0 和 2 的線會被量成「一格」，
     而那條線的一格已經不代表 1 了（codex 第一輪）。 */
  for (let i = 0; i < labels.length; i++){
    if (labels[i].text !== String(i)){
      out.problems.push('the whole-number labels read [' + labels.map(l => l.text).join(',') + '], expected 0..' + (labels.length - 1));
      return out;
    }
  }
  const d = idx[1] - idx[0];
  for (let i = 1; i < idx.length; i++){
    if (idx[i] - idx[i - 1] !== d){
      out.problems.push('the steps are not cut into the same number of parts (' + idx.join(',') + ')');
      return out;
    }
  }
  if (idx[0] !== 0){ out.problems.push('the leftmost label is not on the leftmost tick'); return out; }
  if (idx[idx.length - 1] !== ticks.length - 1){
    out.problems.push('there are ticks beyond the last whole-number label');
    return out;
  }
  out.M = labels.length - 1;
  out.d = d;
  out.ks = plan.dots.map(p => {
    for (let i = 0; i < ticks.length; i++) if (ticks[i].x === p.x) return i;
    out.problems.push('a marked point at x=' + p.x + ' does not sit on any tick');
    return -1;
  });
  return out;
}

/* ---------- 6) 把 plan 畫成 SVG 字串，交給全站共用的畫布檢查（四個邊都驗） ---------- */
function svgOfRef(plan){
  let s = '<svg width="' + plan.w + '" height="' + plan.h + '" viewBox="0 0 ' + plan.w + ' ' + plan.h + '">';
  if (plan.hilite){
    s += '<line x1="' + plan.hilite.x1 + '" y1="' + plan.hilite.y + '" x2="' + plan.hilite.x2 +
         '" y2="' + plan.hilite.y + '" stroke-width="' + HILITE_W_REF + '"/>';
  }
  s += '<line x1="' + plan.axis.x1 + '" y1="' + plan.axis.y + '" x2="' + plan.axis.x2 +
       '" y2="' + plan.axis.y + '" stroke-width="' + LINE_W_REF + '"/>';
  plan.ticks.forEach(t => {
    s += '<line x1="' + t.x + '" y1="' + t.y1 + '" x2="' + t.x + '" y2="' + t.y2 +
         '" stroke-width="' + TICK_W_REF + '"/>';
  });
  plan.dots.forEach(p => { s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + p.r + '"/>'; });
  plan.labels.forEach(l => {
    s += '<text x="' + l.x + '" y="' + l.y + '" font-size="' + l.fs + '" text-anchor="middle">' + l.text + '</text>';
  });
  (plan.letters || []).forEach(l => {
    s += '<text x="' + l.x + '" y="' + l.y + '" font-size="' + l.fs + '" text-anchor="middle">' + l.text + '</text>';
  });
  return s + '</svg>';
}

/* ---------- 7) 算式逐條驗算（這一課自己的，精確有理數） ----------
   ⚠️ 三種宣稱：
     ① `A ÷ B ＝ Q 餘 R`  → 驗 A ＝ B × Q ＋ R 而且 0 ≤ R < B（不是等式，不可以直接算）
     ② `左邊 ＝ 右邊`     → 兩邊都用有理數算，必須相等（左邊允許 a × b、a ÷ b）
     ③ `左邊 > 右邊`      → 有理數比較
   ⚠️ 記帳：每一個等號、每一個大於小於號都要**被某一條宣稱吃掉**，
      吃不掉就報「讀不懂的宣稱」—— 靜靜跳過等於替它背書。 */
const CLAIM_UNITS_ZH = ['段', '份', '格', '條', '題', '公分', '分'];
const CLAIM_UNITS_EN = ['equal parts', 'equal part', 'small parts', 'small part',
                        'whole steps', 'whole step', 'parts', 'part', 'steps', 'step',
                        'marks', 'mark', 'lines', 'line', 'points', 'point'];
function normClaim(s){
  /* ⚠️ 同一個理由：`<[^>]+>` 會把 `2/5 < 4/5 and 4/5 > 1/5` 從第一個 `<` 吃到
     後面的 `>`，兩個比較都靜靜消失（codex 第一輪）。只剝真的標籤。 */
  let t = String(s)
    .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30))
    .replace(/＝/g, '=')
    .replace(/÷/g, '/')
    .replace(/×/g, '*')
    .replace(/＋/g, '+')
    .replace(/[－−–—]/g, '-')
    .replace(/[　 ]/g, ' ');
  t = t.replace(new RegExp('(\\d)\\s*(?:' + CLAIM_UNITS_ZH.join('|') + ')', 'g'), '$1 ');
  t = t.replace(new RegExp('(\\d)\\s*(?:' + CLAIM_UNITS_EN.join('|') + ')\\b', 'gi'), '$1 ');
  return t.replace(/\s+/g, ' ');
}
const VAL_SRC = '(?:\\d+ 又 \\d+\\/\\d+|\\d+ \\d+\\/\\d+|\\d+\\/\\d+|\\d+\\.\\d+|\\d+)';
const REM_RE = new RegExp('(\\d+)\\s*\\/\\s*(\\d+)\\s*=\\s*(\\d+)\\s*(?:餘|remainder)\\s*(\\d+)', 'g');
const EQ_RE = new RegExp('(' + VAL_SRC + '(?:\\s*[*/+]\\s*' + VAL_SRC + ')*)\\s*=\\s*(' + VAL_SRC + ')', 'g');
const CMP_RE = new RegExp('(' + VAL_SRC + ')\\s*(>|<)\\s*(' + VAL_SRC + ')', 'g');
function ratMul(a, b){ return { n:a.n * b.n, d:a.d * b.d }; }
function ratDiv(a, b){ return b.n === 0 ? null : { n:a.n * b.d, d:a.d * b.n }; }
function ratAdd(a, b){ return { n:a.n * b.d + b.n * a.d, d:a.d * b.d }; }
/* 只有 * / + 三種，從左往右（這一課印出來的算式沒有需要優先序的形狀）。 */
function evalClaim(src){
  /* ⚠️ 先試「整個左邊就是一個值」—— 帶分數 `1 又 2/5` 與分數 `7/4` 裡面都有 `/`，
     直接切運算符號會把它們切成兩半（第一版就是這樣把 `1 又 2/5 ＝ 7/5` 誤報的）。 */
  const whole = ratRef(src);
  if (whole) return whole;
  const parts = String(src).split(/\s*([*/+])\s*/);
  let acc = ratRef(parts[0]);
  if (!acc) return null;
  for (let i = 1; i < parts.length; i += 2){
    const op = parts[i], rhs = ratRef(parts[i + 1]);
    if (!rhs) return null;
    if (op === '*') acc = ratMul(acc, rhs);
    else if (op === '/') acc = ratDiv(acc, rhs);
    else acc = ratAdd(acc, rhs);
    if (!acc) return null;
  }
  return acc;
}
function claimProblems(text){
  const out = [], verified = [];
  const t = normClaim(text);
  const spans = [];
  let m;
  /* 一條被辨認出來的宣稱，左右不可以緊貼**另一個運算元或運算符號** —— 不然
     `1 - 3/10 = 0.3`／`1 + 3/10 < 0.8` 會被裡面那一段真的子字串蓋過去而過關
     （那個等號／大於號落在 span 裡，記帳也就以為驗過了）。
     ⚠️ 要跳過空白（匹配從 `3/10` 開始，左邊緊貼的是空白）。
     ⚠️ 小數點只有**兩邊都是數字**時才算「數字還沒結束」：
     `First result is 0. 3/10 = 0.3.` 裡面那一個是句號，不是小數點。
     （三輪各抓一次：邊界、句末句點、只有等式有邊界。） */
  const runsInto = (start, end) => {
    let li = start - 1;
    while (li >= 0 && t[li] === ' ') li--;
    let prev = li >= 0 ? t[li] : ' ';
    /* ⚠️ 兩種句點要分開：`First result is 0. 3/10 = 0.3.` 的是句號（放它過），
       `1.3/10 = 0.3` 的是小數點（那表示左邊那個數還沒結束，要報）。
       第一版把「確認是小數點」的那一個也放掉了，因為最後那個字元集裡沒有 `.`
       —— 於是 `1.3/10 = 0.3` 又溜過去了（codex 第四輪）。用旗標，不要靠字元集。 */
    let prevIsDecimalPoint = false;
    if (prev === '.'){
      const before = li > 0 ? t[li - 1] : ' ';
      const after = (li + 1 < t.length) ? t[li + 1] : ' ';
      prevIsDecimalPoint = /[0-9]/.test(before) && /[0-9]/.test(after);
      if (!prevIsDecimalPoint) prev = ' ';
    }
    let ri = end;
    while (ri < t.length && t[ri] === ' ') ri++;
    const next = ri < t.length ? t[ri] : ' ';
    const nextNext = (ri + 1 < t.length) ? t[ri + 1] : ' ';
    const nextBad = /[0-9(]/.test(next) || /[-+*/]/.test(next) ||
                    (next === '.' && /[0-9]/.test(nextNext));
    return prevIsDecimalPoint || /[0-9)]/.test(prev) || /[-+*/]/.test(prev) || nextBad;
  };
  REM_RE.lastIndex = 0;
  while ((m = REM_RE.exec(t)) !== null){
    const A = Number(m[1]), B = Number(m[2]), Q = Number(m[3]), R = Number(m[4]);
    const qr = divmodRef(A, B);
    /* ⚠️ 「餘數要比除數小」必須排在「和參考實作一致」**前面** —— divmodRef 回來的餘數
       本來就小於除數，排在後面那一條永遠不會響（codex 第三輪）。 */
    if (runsInto(m.index, m.index + m[0].length))
      out.push('a quotient/remainder claim runs into something this checker cannot read: "' + m[0].trim() + '"');
    else if (!(R < B)) out.push('the remainder is not smaller than the divisor: "' + m[0].trim() + '"');
    else if (!qr) out.push('cannot work out ' + m[0]);
    else if (qr.q !== Q || qr.r !== R)
      out.push('the quotient/remainder claim is wrong: "' + m[0].trim() + '" (' + A + ' ÷ ' + B +
               ' is ' + qr.q + ' remainder ' + qr.r + ')');
    else verified.push('rem:' + A + '/' + B + '=' + Q + 'r' + R);
    spans.push([m.index, m.index + m[0].length]);
  }
  EQ_RE.lastIndex = 0;
  while ((m = EQ_RE.exec(t)) !== null){
    const inRem = spans.some(sp => m.index >= sp[0] && m.index < sp[1]);
    if (inRem) continue;                       /* 已經被「餘數」那一條吃掉了 */
    if (runsInto(m.index, m.index + m[0].length)){
      out.push('an arithmetic claim runs into something this checker cannot read: "' +
               t.slice(Math.max(0, m.index - 6), m.index + m[0].length + 6).trim() + '"');
      spans.push([m.index, m.index + m[0].length]);
      continue;
    }
    const lhs = evalClaim(m[1]), rhs = ratRef(m[2]);
    if (!lhs || !rhs) out.push('cannot read the claim "' + m[0].trim() + '"');
    else if (!ratEq(lhs, rhs))
      out.push('arithmetic is wrong: "' + m[0].trim() + '" (' + m[1].trim() + ' is ' +
               ratKey(lhs) + ', not ' + ratKey(rhs) + ')');
    else verified.push('eq:' + m[1].trim().replace(/\s+/g, '') + '=' + m[2].trim().replace(/\s+/g, ''));
    spans.push([m.index, m.index + m[0].length]);
  }
  CMP_RE.lastIndex = 0;
  while ((m = CMP_RE.exec(t)) !== null){
    const a = ratRef(m[1]), b = ratRef(m[3]);
    if (runsInto(m.index, m.index + m[0].length))
      out.push('a comparison runs into something this checker cannot read: "' + m[0].trim() + '"');
    else if (!a || !b) out.push('cannot read the comparison "' + m[0].trim() + '"');
    else {
      const left = a.n * b.d, rightv = b.n * a.d;
      const ok = (m[2] === '>') ? (left > rightv) : (left < rightv);
      if (!ok) out.push('the comparison is wrong: "' + m[0].trim() + '"');
      else verified.push('cmp:' + m[1] + m[2] + m[3]);
    }
    spans.push([m.index, m.index + m[0].length]);
  }
  /* 記帳：每一個 = 與 > 都要落在某一條被辨認出來的宣稱裡面。 */
  for (let i = 0; i < t.length; i++){
    const ch = t[i];
    if (ch !== '=' && ch !== '>' && ch !== '<') continue;
    if (!spans.some(sp => i >= sp[0] && i < sp[1])){
      out.push('an unrecognised claim contains "' + ch + '": …' +
               t.slice(Math.max(0, i - 24), i + 24) + '…');
    }
  }
  return { problems:out, verified:verified };
}
/* 驗算器自己的 PROBE：前六筆必須零誤報，後五筆必須抓到。 */
const CLAIM_PROBES = [
  { text:'9 ÷ 4 ＝ 2 餘 1：走完 2 整格，再往右 1 段。', bad:false },
  { text:'7/4 ＝ 1 又 3/4', bad:false },
  { text:'3/10 ＝ 0.3', bad:false },
  { text:'2 × 5 ＝ 10 段', bad:false },
  { text:'5 段 > 2 段 → 5/6 > 2/6', bad:false },
  { text:'9 ÷ 5 = 1 remainder 4, and 9/5 = 1 4/5', bad:false },
  { text:'9 ÷ 4 ＝ 3 餘 1', bad:true },
  { text:'7/4 ＝ 1 又 1/4', bad:true },
  { text:'3/10 ＝ 0.4', bad:true },
  { text:'2 × 5 ＝ 11 段', bad:true },
  { text:'一小段 ＝ 1/5', bad:true },
  /* 這兩筆是修過的兩個真缺陷的永久證據：
     ① 帶分數的左邊不可以被切成運算符號（`1 又 2/5` 裡面有 `/`）—— 必須零誤報；
     ② 一條宣稱不可以被裡面的真子字串蓋過去（`1 - 3/10 = 0.3`）—— 必須抓到。 */
  { text:'1 又 2/5 ＝ 7/5', bad:false },
  { text:'1 - 3/10 ＝ 0.3', bad:true },
  { text:'1 + 3/10 < 0.8', bad:true },
  { text:'First result is 0. 3/10 ＝ 0.3.', bad:false },
  { text:'9 ÷ 4 ＝ 2 餘 5', bad:true }
];

/* ---------- 8) 跨頁措辭釘樁 ---------- */
function stripComments(src){
  return src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '\n');
}
/* ⚠️ 剝標籤只能用在「數讀者看到的詞」上，絕對不可以拿來掃程式結構
   （`<[^>]+>` 碰到 JS 的 `i < 4 … >` 會把中間整段吃掉）。 */
/* ⚠️ 只剝**真的 HTML 標籤**（`<` 後面緊接字母或 `/`，而且中間不再有角括號）。
   用 `<[^>]+>` 的話，JS 裡的 `i < 4; i++){ … > 0` 會把中間整段吃掉 ——
   一條「必須出現」的規則可以被藏進被吃掉的那一段裡而躲過計數（codex 第一輪）。
   ⚠️ 殘留的限制要說清楚：這裡拿到的還是「原始碼裡的字」，不是瀏覽器算出來的
   reader-visible text —— 一段**死掉的 JS 字串**仍然可以充數。真正釘住畫面的是
   markup 與字典各自都要達到次數（min 是兩邊加起來的實測值）。 */
function readerText(src){
  return stripComments(src)
    .replace(/<\/?[a-zA-Z][^<>]*>/g, '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}
/* min 是**剝掉註解之後**實際出現的次數：少於它就表示有一頁被改鬆了或整段被刪掉。
   ⚠️ 中文字串在這些頁面上通常有兩份（markup 的 fallback ＋ 字典）。 */
const SIBLING_RULES = [
  { file:'index',     text:'數的是段',   min:8, why:'is the whole point of this lesson: parts, not marks' },
  { file:'reference', text:'數的是段',   min:5, why:'is the whole point of this lesson: parts, not marks' },
  { file:'review',    text:'數的是段',   min:1, why:'is the whole point of this lesson: parts, not marks' },
  { file:'parents',   text:'數的是段',   min:2, why:'is the whole point of this lesson: parts, not marks' },
  { file:'index',     text:'格線',       min:36, why:'is the thing children must NOT count' },
  { file:'reference', text:'格線',       min:17, why:'is the thing children must NOT count' },
  { file:'review',    text:'格線',       min:8,  why:'is the thing children must NOT count' },
  { file:'parents',   text:'格線',       min:20, why:'is the thing children must NOT count' },
  { file:'index',     text:'一格代表 1', min:8, why:'is the premise every line on this page rests on' },
  { file:'reference', text:'一格代表 1', min:4, why:'is the premise every line on this card rests on' },
  { file:'parents',   text:'一格代表 1', min:2, why:'is the premise the parents page has to state too' },
  { file:'index',     text:'右邊的點比較大', min:4, why:'is how this lesson compares two numbers' },
  { file:'reference', text:'右邊的點比較大', min:3, why:'is how this lesson compares two numbers' },
  { file:'index',     text:'不用約分',   min:2, why:'states that the denominator is fixed by the line, so nothing is cancelled down' },
  { file:'reference', text:'不用約分',   min:2, why:'states that the denominator is fixed by the line, so nothing is cancelled down' },
  { file:'parents',   text:'不做約分',   min:2, why:'is the misconception the parents page has to defuse' },
  { file:'index',     text:'分母就是那一格被平分成的份數', min:2, why:'is why this lesson never needs a common denominator' },
  { file:'reference', text:'分母就是那一格被平分成的份數', min:2, why:'is why this lesson never needs a common denominator' },
  { file:'index',     text:'分子 ÷ 分母', min:7, why:'is the rule that turns a fraction into a place on the line' },
  { file:'reference', text:'分子 ÷ 分母', min:8, why:'is the rule that turns a fraction into a place on the line' },
  { file:'parents',   text:'分子 ÷ 分母', min:2, why:'is the rule the parents page asks the child to say out loud' },
  /* ⚠️ 只釘中文等於只釘了一半：把英文那一句改成相反的規則，中文的計數、題庫的
     逐字比對、渲染字串的條數**全部不變**（codex 第二輪指出第一輪根本沒改到這一條）。
     英文的每一條核心規則也要有自己的次數。
     ⚠️ 極限說清楚：這是**字面**釘樁，擋不住「把整句話否定掉」（"It is false that one step
     stands for 1" 一樣滿足次數，codex 第三輪）。下面的 FORBIDDEN 只擋得住已知的反面說法；
     真正讀得懂句子的檢查這裡做不到，別讓下一個人以為有。 */
  { file:'index',     text:'one step stands for 1', min:3, why:'is the premise every English line rests on too' },
  { file:'reference', text:'one step stands for 1', min:3, why:'is the premise every English line rests on too' },
  { file:'parents',   text:'one step stands for 1', min:1, why:'is the premise the English parents page has to state too' },
  { file:'index',     text:'further right is the bigger one', min:4, why:'is how the English pages compare two numbers' },
  { file:'reference', text:'further right is the bigger one', min:1, why:'is how the English pages compare two numbers' },
  { file:'review',    text:'further right is the bigger one', min:1, why:'is how the English pages compare two numbers' },
  { file:'parents',   text:'further right is the bigger one', min:1, why:'is how the English pages compare two numbers' },
  { file:'index',     text:'count parts, not marks', min:4, why:'is the whole point of the lesson, in English' },
  { file:'parents',   text:'count parts, not marks', min:1, why:'is the whole point of the lesson, in English' },
  { file:'reference', text:'count the steps or parts you walk', min:1, why:'is how the English cheat sheet states it' },
  { file:'index',     text:'one more mark than', min:3, why:'is the marks-versus-parts rule in English' },
  { file:'reference', text:'one more mark than', min:1, why:'is the marks-versus-parts rule in English' },
  { file:'parents',   text:'one more mark than', min:3, why:'is the marks-versus-parts rule in English' },
  { file:'index',     text:'nothing here needs a common denominator', min:1, why:'is the English scope statement that keeps grade-5 work out' },
  { file:'reference', text:'nothing here needs a common denominator', min:1, why:'is the English scope statement that keeps grade-5 work out' }
];
/* 成對：一句必須出現，一句一個字都不可以出現。只有下界擋不住「多加一句錯的」。 */
const FORBIDDEN = [
  { file:'index',     text:'格線比段少', why:'is the reverse of the truth (marks are always one MORE)' },
  { file:'reference', text:'格線比段少', why:'is the reverse of the truth (marks are always one MORE)' },
  { file:'index',     text:'左邊的比較大', why:'is the reverse of the number-line rule' },
  { file:'reference', text:'左邊的比較大', why:'is the reverse of the number-line rule' },
  { file:'index',     text:'分母是格線的條數', why:'is exactly the misconception this lesson exists to kill' },
  { file:'reference', text:'分母是格線的條數', why:'is exactly the misconception this lesson exists to kill' },
  /* 英文的反面也要成對擋住 —— 只有下界擋不住「把英文改成相反的那一句」。 */
  { file:'index',     text:'further left is the bigger one', why:'is the reverse of the number-line rule' },
  { file:'reference', text:'further left is the bigger one', why:'is the reverse of the number-line rule' },
  { file:'review',    text:'further left is the bigger one', why:'is the reverse of the number-line rule' },
  { file:'parents',   text:'further left is the bigger one', why:'is the reverse of the number-line rule' },
  { file:'index',     text:'count marks, not parts', why:'is exactly backwards' },
  { file:'reference', text:'count marks, not parts', why:'is exactly backwards' },
  { file:'parents',   text:'count marks, not parts', why:'is exactly backwards' },
  { file:'index',     text:'one fewer mark than', why:'is the reverse of the truth (marks are always one MORE)' },
  { file:'reference', text:'one fewer mark than', why:'is the reverse of the truth (marks are always one MORE)' }
];
/* 交給別課的名詞：每一次出現都要在指定的年級旁邊（窗口貼著那個詞）。 */
const HANDOFF = [
  /* 「通分」「擴分」在這一課只有兩種合法的出現方式：交給五年級，或明講這一課
     **不用**它（那是範圍聲明）。第三種出現方式就是把它教進來了。 */
  { word:'通分', near:['五年級', 'grade-5', 'grade 5', '不用', 'never needs', 'nothing here needs'] },
  { word:'擴分', near:['五年級', 'grade-5', 'grade 5', '不用', 'never needs', 'nothing here needs'] },
  { word:'負數', near:['不用', '沒有', 'no negative', 'not', '國中'] }
];
/* ⚠️ 每一支產生器都要走同一套**定義域**守衛：分母在清單裡、M ≤ 3、一張圖最多 24 段、
   點不可以掉到線外面。少了它，`compareOnLine` 抽到 d ＝ 11、或 `tenthsDecimal` 抽到
   M ＝ 5 都會通過它自己那一組斷言（codex 第三輪）。 */
function domainProblems(d, id){
  if (!d) return id + ': make() returned nothing';
  if (typeof d.d === 'number' && DENS_REF.indexOf(d.d) < 0)
    return id + ': d=' + d.d + ' is not one of the denominators this lesson uses (' + DENS_REF.join(',') + ')';
  if (typeof d.M === 'number'){
    if (!(d.M >= 1 && d.M <= MAX_M_REF)) return id + ': M=' + d.M + ' is outside 1..' + MAX_M_REF;
    if (typeof d.d === 'number' && d.M * d.d > MAX_SEGS_REF)
      return id + ': the line would hold ' + (d.M * d.d) + ' parts, above the ' + MAX_SEGS_REF + ' this lesson draws';
    if (typeof d.k === 'number' && typeof d.d === 'number' && !(d.k >= 0 && d.k <= d.M * d.d))
      return id + ': the point at part ' + d.k + ' is off a line that only has ' + (d.M * d.d) + ' parts';
  }
  /* ⚠️ 只驗 `k` 是不夠的：`compareOnLine` 的兩個點叫 a 和 b，`partsToMark` 叫 n ——
     它們一樣不可以跑出這一課的整數範圍（0 到 3）。沒有畫出來的線也一樣要守，
     不然題幹說「同一條數線上」而那兩個數其實畫不到同一張圖上（codex 第四輪）。 */
  if (typeof d.d === 'number'){
    for (const field of ['k', 'a', 'b', 'n', 'segs']){
      const v = d[field];
      if (typeof v !== 'number') continue;
      if (!(v >= 0)) return id + ': ' + field + '=' + v + ' is not a count of parts';
      if (v / d.d > MAX_M_REF)
        return id + ': ' + field + '=' + v + ' over ' + d.d + ' is ' + (v / d.d) +
               ', past the ' + MAX_M_REF + ' whole numbers this lesson uses';
    }
  }
  return null;
}

/* ⚠️⚠️ 這份設定量的是 **linePlan() 這個純資料物件**（外加它自己畫出來的 SVG 字串）。
   真正把 plan 變成畫面的 `drawLine()` 住在碰 DOM 的那一段，simgen／verify 跑不到它 ——
   把 `cx:p.x` 改成 `cx:50`、或整段 `plan.dots.forEach` 拿掉，上面每一條斷言都還是綠的，
   而孩子看到的圖已經錯了（codex 第三輪，和 grade-4-triangle 第三輪那個 critical 同一個形狀）。
   目前的對策有兩層，兩層都要說清楚它的極限：
     ① 下面這張表把「plan 的欄位 → SVG 屬性」那幾行**逐字釘住**（字面掃描，不是資料流分析）——
        改了就必須連這裡一起改，改的人因此會看到這段註解；
     ② 收工前在**真瀏覽器**上量一次（getBoundingClientRect：圖的尺寸、長寬比、
        每一個 <text> 有沒有被裁掉或互相疊住）。那一步不在版控裡，是人工的。
   真正的第三層（把 drawLine 跑起來比對）要等有人把渲染那一段搬進純資料區才做得到。 */
const RENDER_PINS = [
  { file:'index', text:"svg.appendChild(svgEl('circle', { cx:p.x, cy:p.y, r:p.r, fill:TONE[p.tone] }));", min:1 },
  { file:'index', text:"x1:t.x, y1:t.y1, x2:t.x, y2:t.y2,", min:1 },
  { file:'index', text:"x1:plan.axis.x1, y1:plan.axis.y, x2:plan.axis.x2, y2:plan.axis.y,", min:1 },
  { file:'index', text:"x1:plan.hilite.x1, y1:plan.hilite.y, x2:plan.hilite.x2, y2:plan.hilite.y,", min:1 },
  { file:'index', text:"var t = svgEl('text', { x:lb.x, y:lb.y, 'font-size':lb.fs, 'text-anchor':'middle', fill:C_AXIS });", min:1 },
  { file:'index', text:"t.textContent = lb.text;", min:1 },
  { file:'index', text:"var t = svgEl('text', { x:lt.x, y:lt.y, 'font-size':lt.fs, 'text-anchor':'middle',", min:1 },
  { file:'index', text:"t.textContent = lt.text;", min:1 },
  { file:'review', text:"svg.appendChild(svgEl('circle', { cx:p.x, cy:p.y, r:p.r, fill:C_DOT }));", min:1 },
  { file:'review', text:"x1:plan.axis.x1, y1:plan.axis.y, x2:plan.axis.x2, y2:plan.axis.y,", min:1 },
  { file:'review', text:"x1:t.x, y1:t.y1, x2:t.x, y2:t.y2,", min:1 },
  { file:'review', text:"var t = svgEl('text', { x:lb.x, y:lb.y, 'font-size':lb.fs, 'text-anchor':'middle', fill:C_AXIS });", min:1 },
  { file:'review', text:"t.textContent = lb.text;", min:1 }
];

const GEN_IDS = ['unitPart', 'countParts', 'readProper', 'readMixed', 'betweenWhich', 'partsToMark',
                 'compareOnLine', 'wholeOnLine', 'marksVsParts', 'tenthsDecimal', 'totalParts', 'interDecMax'];

/* ---------- 9) 題庫神諭：十二題的題幹**逐字**釘死（中英文各一份）＋ 正解字串 ----------
   ⚠️ 只釘中文等於只釘了一半：把英文題幹改成問別的、選項與 ans 不動，
      所有數值檢查照樣全綠（chain-divide 那一輪的實證）。 */
const BANK = {
  qs: [
    { ans:0, expect:{ zh:"1/5", en:"1/5" },
      optsExact:{ zh:["1/5","5","1/4","5/5"],
                  en:["1/5","5","1/4","5/5"] },
      stemExact:{ zh:"一條數線的一格被<strong>平分成 5 份</strong>。<strong>一小段</strong>是多少？",
                  en:"One step of a number line is cut into <strong>5 equal parts</strong>. How big is <strong>one small part</strong>?" } },
    { ans:1, expect:{ zh:"3/4", en:"3/4" },
      optsExact:{ zh:["4/3","3/4","3/5","1/4"],
                  en:["4/3","3/4","3/5","1/4"] },
      stemExact:{ zh:"一條數線的一格被<strong>平分成 4 份</strong>。從 0 往右<strong>數 3 段</strong>的那個點是多少？",
                  en:"One step of a number line is cut into <strong>4 equal parts</strong>. Which point do you reach by <strong>counting 3 parts</strong> to the right of 0?" } },
    { ans:1, expect:{ zh:"1 和 2 之間", en:"between 1 and 2" },
      optsExact:{ zh:["0 和 1 之間","1 和 2 之間","2 和 3 之間","剛好在 4"],
                  en:["between 0 and 1","between 1 and 2","between 2 and 3","exactly on 4"] },
      stemExact:{ zh:"數線上的 <strong>7/4</strong> 這個點在哪裡？",
                  en:"Where does the point <strong>7/4</strong> sit on a number line?" } },
    { ans:2, expect:{ zh:"1", en:"1" },
      optsExact:{ zh:["6","1/6","1","2"],
                  en:["6","1/6","1","2"] },
      stemExact:{ zh:"一條數線的一格被<strong>平分成 6 份</strong>。從 0 往右<strong>數了 6 段</strong>，走到哪裡？",
                  en:"One step of a number line is cut into <strong>6 equal parts</strong>. You <strong>count 6 parts</strong> to the right of 0. Where do you land?" } },
    { ans:2, expect:{ zh:"4/5", en:"4/5" },
      optsExact:{ zh:["2/5","一樣大","4/5","要先換成小數才知道"],
                  en:["2/5","they are the same","4/5","you have to turn them into decimals first"] },
      stemExact:{ zh:"同一條數線上（一格都平分成 5 份），<strong>2/5</strong> 和 <strong>4/5</strong> 哪一個比較大？",
                  en:"On one number line (every step cut into 5 parts), which is bigger, <strong>2/5</strong> or <strong>4/5</strong>?" } },
    { ans:3, expect:{ zh:"0.7", en:"0.7" },
      optsExact:{ zh:["7.0","0.8","0.1","0.7"],
                  en:["7.0","0.8","0.1","0.7"] },
      stemExact:{ zh:"一條數線的一格被<strong>平分成 10 份</strong>。從 0 往右<strong>數 7 段</strong>，用<strong>小數</strong>寫是多少？",
                  en:"One step of a number line is cut into <strong>10 equal parts</strong>. You count <strong>7 parts</strong> to the right of 0. What is that <strong>as a decimal</strong>?" } },
  ],
  qsAdv: [
    { ans:0, expect:{ zh:"1 又 3/4", en:"1 3/4" },
      optsExact:{ zh:["1 又 3/4","3/4","1 又 1/4","2 又 3/4"],
                  en:["1 3/4","3/4","1 1/4","2 3/4"] },
      stemExact:{ zh:"一條數線的一格被<strong>平分成 4 份</strong>。有一個點在 <strong>1 和 2 之間</strong>，從 <strong>1</strong> 往右<strong>數 3 段</strong>。這個點是多少？（用<strong>帶分數</strong>寫）",
                  en:"One step of a number line is cut into <strong>4 equal parts</strong>. A point sits <strong>between 1 and 2</strong>, <strong>3 parts</strong> to the right of <strong>1</strong>. What is that point? (write it as a <strong>mixed number</strong>)" } },
    { ans:2, expect:{ zh:"10 段", en:"10 parts" },
      optsExact:{ zh:["5 段","7 段","10 段","11 段"],
                  en:["5 parts","7 parts","10 parts","11 parts"] },
      stemExact:{ zh:"一條數線從 <strong>0 畫到 2</strong>，每一格都<strong>平分成 5 份</strong>。這條數線上一共有幾<strong>小段</strong>？",
                  en:"A number line runs from <strong>0 to 2</strong> and every step is cut into <strong>5 equal parts</strong>. How many <strong>small parts</strong> are there on the whole line?" } },
    { ans:1, expect:{ zh:"5 份", en:"5 parts" },
      optsExact:{ zh:["4 份","5 份","3 份","8 份"],
                  en:["4 parts","5 parts","3 parts","8 parts"] },
      stemExact:{ zh:"一條數線的 <strong>0 和 1 之間</strong>畫了 <strong>4 條格線</strong>把它分開（0 和 1 那兩條不算）。一格被平分成幾份？",
                  en:"A number line has <strong>4 marks</strong> drawn <strong>between 0 and 1</strong> to divide it up (not counting the marks at 0 and 1). Into how many equal parts is one step cut?" } },
    { ans:0, expect:{ zh:"走完 1 格，再數 4 段", en:"1 whole step, then 4 parts" },
      optsExact:{ zh:["走完 1 格，再數 4 段","走完 9 格，再數 5 段","走完 4 格，再數 1 段","走完 2 格，再數 1 段"],
                  en:["1 whole step, then 4 parts","9 whole steps, then 5 parts","4 whole steps, then 1 part","2 whole steps, then 1 part"] },
      stemExact:{ zh:"小美要在數線上標出 <strong>9/5</strong>。她要先走完幾<strong>整格</strong>，再往右<strong>數幾段</strong>？",
                  en:"Amy wants to mark <strong>9/5</strong> on a number line. How many <strong>whole steps</strong> should she walk first, and then how many <strong>parts</strong>?" } },
  ],
  qsBoost: [
    { ans:0, expect:{ zh:"要數的是<strong>段</strong>，不是格線 —— 0 那一條線一段都還沒走，第 3 條線只走了 2 段，是 2/5", en:"You count <strong>parts</strong>, not marks — the mark on 0 is no parts walked, so the third mark is only 2 parts along, which is 2/5" },
      optsExact:{ zh:["要數的是<strong>段</strong>，不是格線 —— 0 那一條線一段都還沒走，第 3 條線只走了 2 段，是 2/5","他沒有錯，第 3 條線就是 3/5","一格平分成 5 份的話，格線只有 4 條","分母要改成格線的條數 6"],
                  en:["You count <strong>parts</strong>, not marks — the mark on 0 is no parts walked, so the third mark is only 2 parts along, which is 2/5","Nothing is wrong; the third mark is 3/5","A step cut into 5 parts only has 4 marks","The denominator should be 6, the number of marks"] },
      stemExact:{ zh:"小明說：「一格平分成 <strong>5 份</strong>的數線上，我從 <strong>0 那一條線</strong>開始數格線，數到<strong>第 3 條線</strong>，那個點就是 3/5。」他哪裡想錯了？",
                  en:"Ben says: “On a line whose step is cut into <strong>5 parts</strong>, I start counting marks at <strong>the mark on 0</strong>, and <strong>the third mark</strong> is 3/5.” What has he got wrong?" } },
    { ans:3, expect:{ zh:"假分數也在數線上 —— 往右繼續數，數到第 7 段就會超過 1，落在 1 和 2 之間", en:"Improper fractions are on the line too — keep counting to the right, and part number 7 is past 1, between 1 and 2" },
      optsExact:{ zh:["他沒有錯，數線只放得下 0 和 1 之間的分數","數線上只能標真分數，假分數要用別的圖","7/4 要先寫成 4/7 才畫得出來","假分數也在數線上 —— 往右繼續數，數到第 7 段就會超過 1，落在 1 和 2 之間"],
                  en:["Nothing is wrong; a number line only has room for fractions between 0 and 1","A number line can only take proper fractions; improper ones need a different picture","7/4 has to be written as 4/7 before it can be drawn","Improper fractions are on the line too — keep counting to the right, and part number 7 is past 1, between 1 and 2"] },
      stemExact:{ zh:"小華說：「<strong>7/4</strong> 的分子比分母大，所以它畫不到數線上。」他哪裡想錯了？",
                  en:"Chloe says: “The numerator of <strong>7/4</strong> is bigger than its denominator, so it cannot be drawn on a number line.” What has she got wrong?" } },
  ],
};

/* 渲染出來的字串要掃的東西：英文的 1（只有它會錯）、undefined、重複標點、
   中文黏數字。 */
/* ⚠️ 只收「1 parts」這種緊貼的形狀擋不住 `1 equal parts`、`1 whole steps`，
   也擋不住大寫的 `1 Parts`（codex 第一輪）。允許中間夾**一個**修飾詞，並且不分大小寫。 */
/* ⚠️ 中間那一個字改成「**排除**已知的動詞與介系詞」，不是「只認白名單的形容詞」——
   白名單本身就是一個逃生門（`1 tiny parts` 溜過去了，codex 第二、三輪都指出來）。
   排除法的預設是「報出來」，所以沒想到的形容詞不會靜靜通過；代價是停用詞表要維護，
   而它擋掉的是「0 and 1 are marks too」這種完全正確的句子。 */
const EN_STOPWORDS = ['are', 'is', 'was', 'were', 'and', 'or', 'of', 'on', 'in', 'to', 'at', 'by',
                      'the', 'a', 'an', 'from', 'than', 'plus', 'minus', 'with', 'for', 'as',
                      'that', 'this', 'these', 'those', 'has', 'have', 'had', 'means', 'gives'];
const EN_ONE_RE = /\b1\s+((?:[a-z]+\s+){0,2})?(?:parts|steps|marks|lines|points|halves|numbers|boxes)\b/ig;
/* 同一套排除法。`1 on the line are` 的 on 是停用詞，不算修飾詞（codex 第二輪的誤報）。 */
const EN_ARE_ONE_RE = /\b1\s+((?:[a-z]+\s+){0,2})?(?:part|step|mark|line|point|number|box)\s+are\b/ig;
/* ⚠️ 要掃**每一個**匹配，不是第一個：一句話裡先出現一個無害的匹配（`1 on the line are`）
   就 return 的話，後面真的錯的那一個（`1 tiny parts`）會被整句放掉（codex 第四輪）。
   ⚠️ 中間允許 0~2 個修飾詞；只要**每一個**中間詞都是停用詞才放行。 */
function enAgreementHit(re, s){
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(s)) !== null){
    const mods = (m[1] || '').trim().split(/\s+/).filter(Boolean);
    const allStop = mods.length > 0 && mods.every(w => EN_STOPWORDS.indexOf(w.toLowerCase()) >= 0);
    if (!allStop) return m[0];
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return null;
}
function stringProblems(s, lang, tag){
  const out = [];
  const shown = String(s).replace(/<[^>]+>/g, '');
  if (/undefined|NaN|\[object/.test(shown)) out.push(tag + ' leaks an internal value: ' + shown.slice(0, 60));
  const dbl = shown.match(/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/);
  if (dbl) out.push(tag + ' has doubled punctuation "' + dbl[0] + '": ' + shown.slice(0, 60));
  if (lang === 'zh'){
    const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) out.push(tag + ' is missing a space between Chinese and a digit: ' + [...new Set(glued)].join(' '));
  } else {
    if (/[㐀-鿿]/.test(shown)) out.push(tag + ' (en) contains Chinese: ' + shown.slice(0, 60));
    const oneHit = enAgreementHit(EN_ONE_RE, shown);
    if (oneHit) out.push(tag + ' (en) says "' + oneHit + '" — 1 takes the singular');
    const areHit = enAgreementHit(EN_ARE_ONE_RE, shown);
    if (areHit) out.push(tag + ' (en) says "' + areHit + '" — 1 takes "is"');
  }
  return out;
}

/* ---------- 10) 每一張圖的檢查（版面 ＋ 從圖量回 (M, d, k)） ---------- */
function planProblems(tag, data, plan, want){
  const out = [];
  const say = m => out.push(tag + ': ' + m);
  if (!plan){ say('linePlan() returned nothing'); return out; }
  if (plan.w !== FIG_W_REF || plan.h !== FIG_H_REF) say('canvas is ' + plan.w + 'x' + plan.h + ', the reference says ' + FIG_W_REF + 'x' + FIG_H_REF);
  if (plan.M !== want.M) say('reports M=' + plan.M + ', the case says ' + want.M);
  if (plan.d !== want.d) say('reports d=' + plan.d + ', the case says ' + want.d);
  const M = want.M, d = want.d;
  if (!(M >= 1 && M <= MAX_M_REF)) say('M=' + M + ' is outside 1..' + MAX_M_REF);
  if (d !== 1 && DENS_REF.indexOf(d) < 0) say('d=' + d + ' is not one of the denominators this lesson draws (' + DENS_REF.join(',') + ')');
  if (M * d > MAX_SEGS_REF) say('the line would hold ' + (M * d) + ' parts, above the ' + MAX_SEGS_REF + ' this lesson allows');
  const sp = segPxRef(M, d);
  if (sp === null){ say('a step of ' + SPAN_REF + 'px cannot be cut into ' + (M * d) + ' whole pixels'); return out; }
  if (plan.segPx !== sp) say('segPx is ' + plan.segPx + ', accumulating one part at a time gives ' + sp);
  if (sp < MIN_SEG_PX_REF) say('one part is only ' + sp + 'px wide, below the ' + MIN_SEG_PX_REF + 'px this lesson needs');
  if (plan.unitPx !== sp * d) say('unitPx is ' + plan.unitPx + ', expected ' + (sp * d));
  /* 主線 */
  if (!plan.axis || plan.axis.y !== LINE_Y_REF) say('the axis is not drawn at y=' + LINE_Y_REF);
  else {
    if (plan.axis.x1 !== X0_REF - END_OVER_REF) say('the axis starts at x=' + plan.axis.x1 + ', expected ' + (X0_REF - END_OVER_REF));
    if (plan.axis.x2 !== X0_REF + SPAN_REF + END_OVER_REF) say('the axis ends at x=' + plan.axis.x2 + ', expected ' + (X0_REF + SPAN_REF + END_OVER_REF));
  }
  /* 刻度：一根一根比累加出來的位置，長短由 j % d 決定 */
  if (plan.ticks.length !== M * d + 1) say('has ' + plan.ticks.length + ' ticks, expected ' + (M * d + 1) + ' (parts plus one)');
  for (let j = 0; j < plan.ticks.length; j++){
    const t = plan.ticks[j], x = pxRef(M, d, j);
    if (!t){ say('tick ' + j + ' is missing'); continue; }
    if (t.x !== x) say('tick ' + j + ' is at x=' + t.x + ', accumulating gives ' + x);
    const big = (j % d === 0);
    if (t.big !== big) say('tick ' + j + ' is marked ' + (t.big ? 'long' : 'short') + ' but ' + (big ? 'sits on a whole number' : 'does not'));
    const half = big ? TICK_BIG_REF : TICK_SMALL_REF;
    if (t.y1 !== LINE_Y_REF - half || t.y2 !== LINE_Y_REF + half)
      say('tick ' + j + ' runs from y=' + t.y1 + ' to ' + t.y2 + ', expected ' + (LINE_Y_REF - half) + '..' + (LINE_Y_REF + half));
  }
  /* 整數標籤 */
  if (plan.labels.length !== M + 1) say('has ' + plan.labels.length + ' whole-number labels, expected ' + (M + 1));
  /* ⚠️ 要按**畫出來的 x 順序**比，不是按陣列順序：一張畫得完全正確的圖，只要
     <text> 的產生順序反過來就會被誤報（codex 第二輪）。 */
  const labelsByX = plan.labels.slice().sort((a, b) => a.x - b.x);
  for (let i = 0; i < labelsByX.length; i++){
    const l = labelsByX[i];
    if (!l){ say('label ' + i + ' is missing'); continue; }
    if (l.text !== String(i)) say('label ' + i + ' reads "' + l.text + '"');
    if (l.x !== pxRef(M, d, i * d)) say('label ' + i + ' is at x=' + l.x + ', expected ' + pxRef(M, d, i * d));
    if (l.y !== LINE_Y_REF + LBL_DY_REF) say('label ' + i + ' has baseline y=' + l.y);
    if (l.fs !== LBL_FS_REF) say('label ' + i + ' is ' + l.fs + 'px, expected ' + LBL_FS_REF);
  }
  /* 點 */
  if (plan.dots.length !== want.ks.length) say('draws ' + plan.dots.length + ' points, the case marks ' + want.ks.length);
  for (let i = 0; i < Math.min(plan.dots.length, want.ks.length); i++){
    const p = plan.dots[i], k = want.ks[i];
    if (p.x !== pxRef(M, d, k)) say('point ' + i + ' is at x=' + p.x + ', part ' + k + ' is at ' + pxRef(M, d, k));
    if (p.y !== LINE_Y_REF) say('point ' + i + ' is not on the line (y=' + p.y + ')');
    if (p.r !== DOT_R_REF) say('point ' + i + ' has radius ' + p.r);
    if (p.k !== k) say('point ' + i + ' reports k=' + p.k + ', the case says ' + k);
  }
  /* 甲／乙 的字：只在比較圖上，而且要貼著自己的點 */
  const letters = plan.letters || [];
  if (letters.length !== (want.letters || 0)) say('draws ' + letters.length + ' point letters, expected ' + (want.letters || 0));
  /* ⚠️ 只驗數量、位置、字級和「只有一個字」的話，**兩個點都標「甲」**或
     把 甲／乙 標反都是綠的，而題幹講的是「甲在…乙在…」（codex 第一輪）。
     字本身也要按點的順序逐一比對。 */
  if (want.letters === 2){
    /* 甲／乙（A／B）要跟著**它自己的點**，所以按點的 x 排序之後再比 ——
       陣列順序反過來但畫得對的圖不該被誤報（codex 第二輪）。 */
    const wantText = (want.lang === 'en') ? ['A', 'B'] : ['甲', '乙'];
    const pairs = letters.map(l => ({ l:l, x:l.x })).sort((a, b) => a.x - b.x);
    const dotXs = plan.dots.map(p => p.x).slice().sort((a, b) => a - b);
    pairs.forEach((pr, i) => {
      const wantAt = plan.dots.findIndex(p => p.x === pr.x);
      const wantIdx = wantAt >= 0 ? want.ks.indexOf(plan.dots[wantAt].k) : -1;
      const expect = wantIdx >= 0 ? wantText[wantIdx] : null;
      if (expect === null) say('a point letter is not above any marked point');
      else if (pr.l.text !== expect)
        say('the letter above the point at x=' + pr.x + ' reads "' + pr.l.text + '", expected "' + expect + '"');
      if (dotXs.indexOf(pr.x) < 0) say('point letter "' + pr.l.text + '" is not above any point');
    });
  }
  /* ⚠️ 這裡**不可以**再按陣列順序配一次點：畫得完全正確、只是 <text> 產生順序反過來的圖
     會被誤報（codex 第三輪指出第二輪的修正被後面這一段抵銷掉了）。位置只由上面那一段
     （按 x 配對）負責，這裡只驗每一個字自己的屬性。 */
  letters.forEach((l, i) => {
    if (plan.dots.every(p => p.x !== l.x)) say('letter "' + l.text + '" is not above any point');
    if (l.y !== LINE_Y_REF - MARK_DY_REF) say('letter ' + i + ' has baseline y=' + l.y);
    if (l.fs !== MARK_FS_REF) say('letter ' + i + ' is ' + l.fs + 'px');
    if ([...String(l.text)].length !== 1) say('letter ' + i + ' is "' + l.text + '" — labels in these figures must be a single character');
  });
  /* 走過的那一段 */
  if (want.hi > 0){
    if (!plan.hilite) say('the walked parts are not highlighted');
    else {
      if (plan.hilite.x1 !== X0_REF) say('the highlight starts at x=' + plan.hilite.x1 + ', not at 0');
      if (plan.hilite.x2 !== pxRef(M, d, want.hi)) say('the highlight ends at x=' + plan.hilite.x2 + ', part ' + want.hi + ' is at ' + pxRef(M, d, want.hi));
      if (plan.hilite.y !== LINE_Y_REF) say('the highlight is not on the line');
    }
  } else if (plan.hilite) say('nothing has been walked yet, but a highlight is drawn');
  /* ⚠️ 從畫出來的圖把 (M, d, k) 量回來 —— 只驗「spec 說什麼」的話，畫圖那一段壞掉也是綠的 */
  const meas = measurePlanRef(plan);
  meas.problems.forEach(m => say('measured back from the drawing: ' + m));
  if (!meas.problems.length){
    if (meas.M !== M) say('the drawing shows ' + meas.M + ' steps, the case says ' + M);
    if (meas.d !== d) say('the drawing cuts a step into ' + meas.d + ' parts, the case says ' + d);
    if (meas.ks.join(',') !== want.ks.join(',')) say('the drawing marks part(s) [' + meas.ks + '], the case says [' + want.ks + ']');
  }
  /* 畫布容不容得下（全站共用那一份，四個邊都驗） */
  canvasProblems(svgOfRef(plan)).forEach(m => say('canvas: ' + m));
  return out;
}

/* 這一課會畫出來的每一張圖（涵蓋所有 chip × step × 兩種語言 × 五個關卡）。 */
function allSpecs(data){
  const out = [];
  for (let s = 0; s <= 3; s++)
    out.push({ tag:'warm/step' + s, spec:data.warmSpec(s), want:{ M:data.W1_M, d:1, ks:s > 0 ? [s] : [], hi:s, letters:0 } });
  data.S1_DENS.forEach(d =>
    out.push({ tag:'split/' + d, spec:data.splitSpec(d), want:{ M:1, d:d, ks:[1], hi:1, letters:0 } }));
  data.S2_CASES.forEach(cs => {
    for (let s = 0; s <= 2; s++)
      out.push({ tag:'mark/' + cs.id + '/step' + s, spec:data.markSpec(cs, s),
                 want:{ M:data.spanFor(cs.n, cs.d), d:cs.d, ks:s >= 1 ? [cs.n] : [], hi:s >= 1 ? cs.n : 0, letters:0 } });
  });
  data.S3_CASES.forEach(cs =>
    out.push({ tag:'read/' + cs.id, spec:data.readSpec(cs), want:{ M:cs.M, d:cs.d, ks:[cs.k], hi:0, letters:0 } }));
  data.S4_CASES.forEach(cs => ['zh', 'en'].forEach(lang =>
    out.push({ tag:'cmp/' + cs.id + '/' + lang, spec:data.cmpSpec(cs, lang),
               want:{ M:cs.M, d:cs.d, ks:[cs.a, cs.b], hi:0, letters:2, lang:lang } })));
  data.S5_KS.forEach(k =>
    out.push({ tag:'dec/' + k, spec:data.decSpec(k), want:{ M:data.S5_M, d:data.S5_D, ks:[k], hi:k, letters:0 } }));
  return out;
}

/* 這一課渲染出來的每一個字串（旁白／算式／結果／題庫／遊戲）。 */
function narratedStrings(data, I18N){
  const out = [];
  const add = (tag, lang, text) => out.push({ tag:tag, lang:lang, text:text });
  ['zh', 'en'].forEach(lang => {
    const D = I18N[lang];
    for (let s = 0; s <= 3; s++){
      add('w1step' + s, lang, D.w1step(s)); add('w1cap' + s, lang, D.w1cap(s));
      add('w1narr' + s, lang, D.w1narr(s)); add('w1result' + s, lang, D.w1result(s));
    }
    data.S1_DENS.forEach(d => {
      add('s1chip' + d, lang, D.s1chip(d)); add('s1cap' + d, lang, D.s1cap(d));
      add('s1narr' + d, lang, D.s1narr(d)); add('s1calc' + d, lang, D.s1calc(d));
      add('s1result' + d, lang, D.s1result(d));
    });
    [0, 1, 2].forEach(i => { add('s2step' + i, lang, D.s2step(i)); add('s3step' + i, lang, D.s3step(i)); });
    data.S2_CASES.forEach(cs => {
      add('s2chip' + cs.id, lang, D.s2chip(cs));
      [0, 1, 2].forEach(s => {
        add('s2cap' + cs.id + s, lang, D.s2cap(cs, s)); add('s2narr' + cs.id + s, lang, D.s2narr(cs, s));
        add('s2calc' + cs.id + s, lang, D.s2calc(cs, s)); add('s2result' + cs.id + s, lang, D.s2result(cs, s));
      });
    });
    data.S3_CASES.forEach((cs, ix) => {
      add('s3chip' + cs.id, lang, D.s3chip(cs, ix));
      [0, 1, 2].forEach(s => {
        add('s3narr' + cs.id + s, lang, D.s3narr(cs, s)); add('s3calc' + cs.id + s, lang, D.s3calc(cs, s));
        add('s3result' + cs.id + s, lang, D.s3result(cs, s));
      });
    });
    add('s3cap', lang, D.s3cap); add('s4cap', lang, D.s4cap);
    data.S4_CASES.forEach((cs, ix) => {
      add('s4chip' + cs.id, lang, D.s4chip(cs, ix)); add('s4narr' + cs.id, lang, D.s4narr(cs));
      add('s4calc' + cs.id, lang, D.s4calc(cs)); add('s4result' + cs.id, lang, D.s4result(cs));
    });
    data.S5_KS.forEach(k => {
      add('s5chip' + k, lang, D.s5chip(k)); add('s5cap' + k, lang, D.s5cap(k));
      add('s5narr' + k, lang, D.s5narr(k)); add('s5calc' + k, lang, D.s5calc(k));
      add('s5result' + k, lang, D.s5result(k));
    });
    gameStrings(data, D, lang, (tag, text) => add(tag, lang, text));
    ['qs', 'qsAdv', 'qsBoost'].forEach(bank => D[bank].forEach((q, ix) => {
      add(bank + ix + '.stem', lang, q.stem); add(bank + ix + '.why', lang, q.why);
      q.opts.forEach((o, oi) => add(bank + ix + '.opt' + oi, lang, o));
    }));
    ['intro', 'scopeNote', 'footer', 'w1note', 's1note', 's2note', 's3note', 's4note', 's5note',
     'gClear', 'cAll', 'cGood', 'cTry'].forEach(k => add(k, lang, D[k]));
    add('gWin', lang, D.gWin(100));
  });
  return out;
}

/* ===================== 小遊戲「數線尋寶」的檢查（index.html，§六之五） =====================
   五關：tile（鋪滿一格）、pin（插旗子）、read（寫出點的名字）、sort（由小到大排隊）、name（一個點兩個名字）。
   每一關照遊戲的規則把題庫的每一題玩一遍（每一種放法都試：只有對的收），正解一律用這份設定自己的讀法
   （cardKRef：卡片上的寫法 → 從 0 數幾段；divmodRef：商與餘數）重算，不讀頁面的答案。
   375px 手機上卡片內寬約 289px：300 寬的畫板縮成 0.963 倍 —— 拿得起來的東西要 ≥ 44 / 0.963 ≈ 45.7 個邏輯 px
   （實際量測在端對端測試裡，這裡驗設計值）。 */
const { extractFunction } = require('./lib/gameshuffle.js');
function gnums(text){ return (String(text).match(/\d+/g) || []).map(Number); }
function subseqRef(got, want){ let i = 0; got.forEach(v => { if (i < want.length && v === want[i]) i++; }); return i === want.length; }
const PHONE_K = Math.min(1.5, 289 / 300);
const GAME_DENS_REF = [2, 3, 4, 5, 6, 10];
const TILE_DENS_REF = [2, 3, 4, 5];
/* 這份設定自己讀卡片：一條切成 d 份的線上，這個寫法是從 0 數幾段。分母和線不一樣、或小數不在 d ＝ 10 的線上 → NaN。 */
function cardKRef(t, d){
  t = String(t).replace(/\s+/g, ' ').trim();
  let m;
  if ((m = /^(\d+) (?:又 )?(\d+)\/(\d+)$/.exec(t))) return +m[3] === d ? +m[1] * d + +m[2] : NaN;
  if ((m = /^(\d+)\/(\d+)$/.exec(t))) return +m[2] === d ? +m[1] : NaN;
  if ((m = /^(\d+)\.(\d)$/.exec(t))) return d === 10 && +m[2] !== 0 ? +m[1] * 10 + +m[2] : NaN;
  if ((m = /^(\d+)$/.exec(t))) return +m[1] * d;
  return NaN;
}
/* 一種寫法能不能用在這個點上（帶分數要過了 1 又不是整數；整數要剛好整除；小數只在 d ＝ 10） */
function formOkRef(k, d, form){
  const qr = divmodRef(k, d);
  if (form === 'mixed') return qr.q >= 1 && qr.r !== 0;
  if (form === 'whole') return qr.r === 0;
  if (form === 'dec') return d === 10 && qr.r !== 0;
  return form === 'frac';
}

/* 遊戲渲染出來的每一句話（每一個題庫、每一種放錯），給第 7 段的宣稱驗算與字串檢查用。
   放錯的理由**照遊戲自己的分支**（頁面上的 why() 由 gameChecks 用原始碼形狀釘住）挑函式。 */
function gameStrings(data, D, lang, add){
  const T = (k, d, f) => data.gameText(k, d, f, lang);
  data.GAME_TILE.forEach((pair, pi) => {
    pair.forEach(want => {
      for (let n = 0; n < want; n++){ add('gTileRow' + want + '_' + n, D.gTileRow(want, n)); add('gTile2_' + pi + '_' + want + '_' + n, D.gTile2(1, want, n)); }
      add('gTileFull' + want, D.gTileFull(want)); add('gTileOk' + want, D.gTileOk(want));
      TILE_DENS_REF.filter(p => p !== want).forEach(p => add('gTileWrong' + p + '_' + want, D.gTileWrong(p, want)));
    });
    add('gTileDone' + pi, D.gTileDone(pair[0], pair[1]));
  });
  [0, 1, 2].forEach(a => add('gTileNow' + a, D.gTileNow(a, 2)));
  data.GAME_PIN.forEach((e, ei) => {
    e.pins.forEach(([kt, form], pi) => {
      const txt = T(kt, e.d, form), qr = divmodRef(kt, e.d);
      add('gPinOk' + ei + '_' + pi, D.gPinOk(txt, kt, data.fracText(kt, e.d)));
      add('gPin2' + ei + '_' + pi, D.gPin2(txt, kt, qr.q, qr.r));
      for (let j = 1; j <= e.M * e.d; j++) if (j !== kt) add('gPinWrong' + ei + '_' + pi + '_' + j, pinWhyRef(D, e.d, kt, form, txt, j, data.fracText(j, e.d)));
    });
  });
  [0, 1, 2, 3].forEach(a => add('gPinNow' + a, D.gPinNow(a, 3)));
  add('gPinDone', D.gPinDone);
  data.GAME_READ.forEach((e, ei) => {
    const w = data.readWant(e);
    Object.keys(w).forEach(part => { for (let v = 0; v <= 9; v++) if (v !== w[part]) add('gReadWrong' + ei + part + v, readWhyRef(D, e, part, v)); });
    const qr = divmodRef(e.k, e.d);
    add('gRead2' + ei, D.gRead2(qr.q, e.d));
    add('gReadDone' + ei, D.gReadDone(data.fracText(e.k, e.d), data.mixedText(e.k, e.d, lang)));
  });
  for (let a = 0; a <= 5; a++) add('gReadNow' + a, D.gReadNow(a));
  ['gReadImp', 'gReadMix', 'gSortMin', 'gSortMax', 'gPinOne'].forEach(k => add(k, D[k]));
  data.GAME_SORT.forEach((e, ei) => {
    const order = e.cards.map(c => c[0]).sort((a, b) => a - b), txt = {};
    e.cards.forEach(c => { txt[c[0]] = T(c[0], e.d, c[1]); });
    order.forEach((k, i) => { add('gSortWrong' + ei + '_' + i, D.gSortWrong(txt[k], k, i + 1)); add('gSortOk' + ei + '_' + i, D.gSortOk(txt[k], i + 1)); });
    add('gSort2' + ei, D.gSort2(order.map(k => [txt[k], k])));
    add('gSortDone' + ei, D.gSortDone(order.map(k => txt[k])));
  });
  for (let a = 0; a <= 4; a++) add('gSortNow' + a, D.gSortNow(a, 4));
  data.GAME_NAME.forEach((e, ei) => {
    e.cards.forEach(([pt, form], ci) => {
      const k = e.ks[pt], txt = T(k, e.d, form);
      add('gName2' + ei + '_' + ci, D.gName2(txt, k));
      [0, 1, 2].forEach(j => {
        add('gNameOk' + ei + '_' + ci + '_' + j, D.gNameOk(txt, D.gLetters[j]));
        [0, 1, 2].filter(o => o !== pt).forEach(o => add('gNameWrong' + ei + '_' + ci + '_' + j + o, D.gNameWrong(txt, k, D.gLetters[j], D.gLetters[(j + 1) % 3], e.ks[o])));
      });
    });
    add('gNameDone' + ei, D.gNameDone(e.ks.map((k, i) => e.cards.filter(c => c[0] === i).map(c => T(k, e.d, c[1])))));
  });
  for (let a = 0; a <= 6; a++) add('gNameNow' + a, D.gNameNow(a, 6));
  ['tile', 'pin', 'read', 'sort', 'name'].forEach(t => { add('gAsks.' + t, D.gAsks[t]); add('gHints.' + t, D.gHints[t]); });
  add('gPts10', D.gPts(10)); add('gPts20', D.gPts(20)); add('gMinus', D.gMinus);
}
/* 頁面 RENDER.pin 的 why()：整數放在「整數那麼多小段」、帶分數忘了整格、差一段（數成格線）、其他。 */
function pinWhyRef(D, d, kt, form, txt, j, here){
  const qr = divmodRef(kt, d);
  if (form === 'whole' && j === qr.q) return D.gPinWhole(txt, here);
  if (form === 'mixed' && j === qr.r) return D.gPinMixed(txt, qr.q, qr.r, here);
  return (Math.abs(j - kt) === 1 ? D.gPinOne + ' ' : '') + D.gPinWhy(form, txt, here, j, kt, qr.q, qr.r);
}
/* 頁面 RENDER.read 的 why() */
function readWhyRef(D, e, part, v){
  const qr = divmodRef(e.k, e.d), q = qr.q, r = qr.r;
  if (part === 'aDen' || part === 'bDen') return v === e.d + 1 ? D.gReadLines(v) : D.gReadDen(v);
  if (part === 'aNum') return v === r ? D.gReadAnumRem(v, q) : (Math.abs(v - e.k) === 1 ? D.gReadOne(v) : D.gReadAnum(v));
  if (part === 'bWhole') return v === q + 1 ? D.gReadWholeUp(v) : D.gReadWhole(v);
  return v === e.k ? D.gReadBnumAll(v, q) : (Math.abs(v - r) === 1 ? D.gReadOne(v) : D.gReadBnum(v, q));
}

function gameChecks(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = D.GAME_W;
  const TYPES = ['tile', 'pin', 'read', 'sort', 'name'];
  if (W !== 300) fail('GAME_W is ' + W + ', the boards are designed for 300');
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== TYPES.join())
    fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of the examples), got ' + D.GAME_ORDER);
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (!subseqRef(gnums(text), want)) fail(where + ': numbers should read ' + want.join(',') + ' (in this order), got ' + gnums(text).join(',') + ' — ' + text);
  };
  const touch = (what, sz) => { if (!(sz * PHONE_K >= 44)) fail(what + ' is ' + (sz * PHONE_K).toFixed(1) + 'px on a 375px phone — under 44'); };
  const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
  const grow = (o, p) => ({ x:o.x - p, y:o.y - p, w:o.w + 2 * p, h:o.h + 2 * p });
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  const lineBox = (y, x0, x1) => ({ x:x0 - 14, y:y - D.GL.tickBig / 2, w:x1 - x0 + 28, h:13 + 20 + D.GL.tickBig / 2 });   /* 主線＋刻度＋下面的整數 */
  ['GAME_TILE', 'GAME_PIN', 'GAME_READ', 'GAME_SORT', 'GAME_NAME'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 5) fail(k + ' should be a pool of at least 5 entries');
    else for (let i = 0; i < D[k].length; i++) if (!Object.prototype.hasOwnProperty.call(D[k], i)) fail(k + '[' + i + '] is a hole in the array');
  });
  /* 寫法：每一種寫法用這份設定自己的讀法讀回來，要剛好是 k（兩種語言） */
  const textOk = (where, k, d, form) => LANGS.forEach(L => {
    const t = D.gameText(k, d, form, L), back = cardKRef(t, d);
    if (back !== k) fail(where + ' (' + L + '): "' + t + '" reads back as ' + back + ' parts on a line cut into ' + d + ', expected ' + k);
  });
  /* 遊戲的數線：GL 兩端、刻度位置用這份設定自己累加 */
  if (!(D.GL.X0 >= 32 + 2 && W - D.GL.X1 >= 32 + 2)) fail('the game line ends ' + D.GL.X0 + '..' + D.GL.X1 + ' leave no room for a flag (half 32) at either end');
  for (let M = 1; M <= 3; M++) for (const d of GAME_DENS_REF){
    if (M * d > 30) continue;
    let x = D.GL.X0; const seg = (D.GL.X1 - D.GL.X0) / (M * d);
    for (let k = 0; k <= M * d; k++){ if (Math.abs(D.glX(M, d, k) - x) > 1e-9) fail('glX(' + M + ',' + d + ',' + k + ')=' + D.glX(M, d, k) + ', accumulating gives ' + x); x += seg; }
  }

  /* ---------- 共用：shuffle() 真的跑：是排列、不改輸入、而且**永遠不會由小到大**（托盤一開始不可以已經排好） ---------- */
  {
    const fsrc = extractFunction(src, 'shuffle');
    let shuffle = null;
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else { try { shuffle = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated on its own: ' + e.message); } }
    if (shuffle){
      [[0, 1, 2], [3, 5, 7, 8], [0, 1, 2, 3, 4, 5]].forEach(input => {
        const orders = new Set(), before = input.join();
        for (let i = 0; i < 3000; i++){
          const out = shuffle(input);
          if (input.join() !== before) return fail('shuffle() mutates its input');
          if (out.slice().sort((a, b) => a - b).join() !== input.slice().sort((a, b) => a - b).join()) return fail('shuffle() changed the set: ' + out);
          let up = true; for (let k = 1; k < out.length; k++) if (!(out[k - 1] < out[k])) up = false;
          if (up) return fail('shuffle() returned ' + out.join(',') + ' — already in increasing order');
          orders.add(out.join());
        }
        if (orders.size < 3) fail('shuffle() of ' + input.join(',') + ' produced only ' + orders.size + ' orders in 3000 runs');
      });
    }
    need('pin', /shuffle\(e\.pins\.map\(function\(p, i\)\{ return i; \}\)\)\.forEach\(/, 'the flags are not shuffled into rows');
    need('sort', /shuffle\(order\)\.forEach\(/, 'the sort tray is not shuffled (it would start in the answer order)');
    need('name', /perm = shuffle\(\[0, 1, 2\]\)/, 'the point letters are not shuffled');
    need('name', /shuffle\(e\.cards\.map\(function\(c, i\)\{ return i; \}\)\)\.forEach\(/, 'the name cards are not shuffled into the tray');
  }

  /* ---------- 共用：nearestOpen() 真的跑 ---------- */
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    let nearestOpen = null;
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
    if (nearestOpen){
      /* 排隊的四格：放寬 6 之後和隔壁重疊；格子裡每一點判給那一格，兩格中間的縫裡比較靠後面那一格的點判給後面那一格 */
      const G = D.SORT_G, list = [0, 1, 2, 3].map(i => ({ id:i, cx:D.sortX(i), cy:G.slotY + G.slotH / 2, hw:G.slotW / 2, hh:G.slotH / 2, done:false }));
      let bad = 0;
      list.forEach(b => { for (let x = b.cx - b.hw + 0.25; x < b.cx + b.hw; x += 0.5){ const g = nearestOpen(list, { x, y:b.cy }, 6); if (!g || g.id !== b.id) bad++; } });
      if (bad) fail('nearestOpen(): ' + bad + ' points inside a sort box are given to another box (or none)');
      for (let i = 0; i < 3; i++){
        const gapL = list[i].cx + list[i].hw, gapR = list[i + 1].cx - list[i + 1].hw;
        if (!(gapR > gapL && gapR - gapL < 12)) fail('sort boxes ' + i + '/' + (i + 1) + ': the gap is ' + (gapR - gapL) + ' — it must exist and be inside both drop pads so the overlap is real');
        for (let x = gapL + 0.25; x < gapR; x += 0.25){
          const g = nearestOpen(list, { x, y:list[i].cy }, 6), want = (x - gapL < gapR - x) ? i : (x - gapL > gapR - x ? i + 1 : null);
          if (want !== null && (!g || g.id !== want)) { fail('nearestOpen(): x=' + x + ' in the gap between sort boxes ' + i + ' and ' + (i + 1) + ' goes to ' + (g ? g.id : 'none') + ', the nearer is ' + want); break; }
        }
      }
      const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
      const r0 = nearestOpen(two, { x:140, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
      const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
      if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished box skips it and lands in the next box');
      if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every box is accepted');
      /* 第 5 關：點的收的範圍互相重疊時（點靠得近），線上每一點判給最近的那個點 */
      const NG = D.NAME_G;
      D.GAME_NAME.forEach((e, ei) => {
        const spots = e.ks.map((k, i) => ({ id:i, cx:D.glX(e.M, e.d, k), cy:NG.lineY, hw:NG.dotHW, hh:NG.dotHH, done:false }));
        for (let x = spots[0].cx; x <= spots[2].cx; x += 0.25){
          const g = nearestOpen(spots, { x, y:NG.lineY }, 6);
          const ds = spots.map(s => Math.abs(s.cx - x)), m = Math.min(...ds), near = ds.filter(v => v === m).length === 1 ? ds.indexOf(m) : null;
          const inAny = ds.some(v => v <= NG.dotHW + 6);
          if (inAny && near !== null && (!g || g.id !== near)) { fail('name set ' + ei + ': a drop on the line at x=' + x + ' goes to point ' + (g ? g.id : 'none') + ', the nearest is ' + near); break; }
        }
      });
    }
  }

  /* ---------- 共用：計分（中年級 §三：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0）---------- */
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
  /* 換畫板之後，還拿在手上的舊積木放開時不可以動到新的那一關（二年級 length 的 codex 第一輪） */
  if (!/if \(gen !== gGen\) return;/.test(src) || !/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src))
    fail('the drag engine has no board-generation guard: a piece held across Restart could act on the new board');
  if (!/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(src)) fail('startRound() does not bump gGen');
  /* 拖拉引擎的保險：只跟著第一根手指、三條放開的路、放好的不擋點擊、每一關都接上「拖」和「先點再點」 */
  if ((src.match(/if \(!start \|\| e\.pointerId !== pid\) return;/g) || []).length !== 2) fail('the drag engine does not follow only the first finger (move and end must both check pointerId)');
  if (!/document\.addEventListener\('pointerup', onDocEnd\);\n\s*document\.addEventListener\('pointercancel', onDocEnd\);/.test(src)) fail('the drag engine has no document-level release while dragging');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on lostpointercapture');
  if (!/el\.addEventListener\('pointercancel', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on pointercancel');
  if (!/\.gpiece\.locked\{cursor:default;pointer-events:none\}/.test(src)) fail('placed pieces still take pointer events');
  if (!/\.gpiece\{[^}]*touch-action:none/.test(src)) fail('pieces do not set touch-action:none');
  if (!/if \(P\.busy\(\)\) return;/.test(src)) fail('a tap-then-tap destination is taken while another finger still drags that piece');
  TYPES.forEach(t => { if ((B[t].match(/useTapSelect\(B, function\(P, pt\)\{/g) || []).length !== 1) fail(t + ': the round does not install its drop / tap-then-tap handler (useTapSelect)'); });
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/gameStage\.textContent = '';/.test(src)) fail('startRound() does not clear the stage before rendering');
  LANGS.forEach(L => {
    seq('gPts ' + L, I18N[L].gPts(20), [20]);
    seq('gMinus ' + L, I18N[L].gMinus, [5]);
    if (gnums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score');
  });

  /* ================= 第 1 關：鋪滿一格 ================= */
  {
    const G = D.TILE_G;
    if (D.TILE_DENS.join() !== TILE_DENS_REF.join()) fail('the tile tray is [' + D.TILE_DENS + '], expected [' + TILE_DENS_REF + ']');
    TILE_DENS_REF.forEach(p => { if (D.tileLen(p) !== G.SPAN / p) fail('tileLen(' + p + ') is ' + D.tileLen(p) + ', a 1/' + p + ' piece of a ' + G.SPAN + ' step is ' + G.SPAN / p); });
    touch('the shortest tile piece (1/5: ' + D.tileLen(5) + '×' + G.pieceH + ')', Math.min(D.tileLen(5), G.pieceH));
    if (!(G.X0 >= 14 && G.X0 + G.SPAN + 14 <= W)) fail('the tile step ' + G.X0 + '..' + (G.X0 + G.SPAN) + ' leaves no room for the 0 / 1 labels');
    const tray = TILE_DENS_REF.map((p, i) => { const t = D.tileTray(i); return box(t.x, t.y, D.tileLen(p), G.pieceH); });
    tray.forEach((t, i) => inside(t, 'tile tray piece ' + i, G.H));
    noHits(tray, 'tile tray pieces');
    /* 收的範圍 ＝ 畫出來的那一個白框（同一個 target 就是那個框），框裡要裝得下孩子看到的整格：題目、小段、數線、0 和 1；
       兩個框放寬 10 之後也不可以重疊，而且中間要有看得到的空白（驗證者：舊版第 2 格題目的上半落在第 1 格的範圍裡、被算成第 1 格放錯） */
    need('tile', /var R = target\(B, G\.X0 - G\.padX, top, G\.SPAN \+ 2 \* G\.padX, G\.rowH, 'gtrack', /, 'the drop zone is not the drawn row box');
    const zones = G.rowTop.map(top => ({ x:G.X0 - G.padX, y:top, w:G.SPAN + 2 * G.padX, h:G.rowH }));
    zones.forEach((z, r) => {
      inside(z, 'tile row ' + r + ' box', G.H);
      const top = G.rowTop[r];
      const content = [
        { x:G.X0, y:top + G.lblY, w:G.SPAN, h:G.lblH, what:'its prompt' },
        { x:G.X0, y:top + G.stripY, w:G.SPAN, h:G.stripH, what:'the laid pieces' },
        { x:G.X0 - 14, y:top + G.axisDY - D.GL.tickBig / 2, w:G.SPAN + 28, h:D.GL.tickBig / 2 + 13 + 20, what:'the line, its ticks and the 0 / 1 labels' }
      ];
      content.forEach(c => { if (!(c.x >= z.x && c.y >= z.y && c.x + c.w <= z.x + z.w && c.y + c.h <= z.y + z.h)) fail('tile row ' + r + ': the drop zone does not cover ' + c.what + ' ' + JSON.stringify(c)); });
      tray.forEach((t, i) => { if (hit(grow(z, 10), t)) fail('tile row ' + r + ': the drop pad touches tray piece ' + i); });
    });
    if (hit(grow(zones[0], 10), grow(zones[1], 10))) fail('the two tile rows\' drop pads overlap — a drop on one row could be judged for the other');
    if (zones[1].y - (zones[0].y + zones[0].h) < 12) fail('the two tile rows are only ' + (zones[1].y - (zones[0].y + zones[0].h)) + 'px apart — no visible separation');
    need('tile', /var R = nearestOpen\(rows, pt, 10\);\n\s*if \(!R\) return false;/, 'a drop on empty space / a full step is not sent back silently');
    need('tile', /if \(p !== R\.want\)\{ roundMiss\(d\.gTileWrong\(p, R\.want\)\); return false; \}/, 'a piece of the wrong size is not refused with its reason');
    need('tile', /addZone\(B, G\.X0 \+ R\.n \* tileLen\(p\),/, 'pieces are not laid one after another from 0');
    D.GAME_TILE.forEach((pair, pi) => {
      const w = 'tile ' + pi + ' (' + pair + ')';
      if (pair.length !== 2 || pair[0] === pair[1] || pair.some(p => TILE_DENS_REF.indexOf(p) < 0)) fail(w + ': two different targets from the tray, got ' + pair);
      /* 照規則玩：每一格、托盤的每一種，只有 1/want 收；鋪 want 段剛好到 1 */
      pair.forEach(want => {
        const accepted = TILE_DENS_REF.filter(p => p === want);
        if (accepted.length !== 1) fail(w + ': the tray has no 1/' + want + ' piece, the step can never be filled');
        let x = G.X0; for (let n = 0; n < want; n++) x += G.SPAN / want;
        if (Math.abs(x - (G.X0 + G.SPAN)) > 1e-9) fail(w + ': ' + want + ' pieces of 1/' + want + ' end at ' + x + ', not at 1');
        LANGS.forEach(L => {
          const T = I18N[L];
          TILE_DENS_REF.filter(p => p !== want).forEach(p => seq(w + ' ' + L + ' wrong 1/' + p, T.gTileWrong(p, want), [1, p, p, p, want]));
          seq(w + ' ' + L + ' full', T.gTileFull(want), [want, 1, want]);
          seq(w + ' ' + L + ' ok', T.gTileOk(want), [want, 1, want]);
          seq(w + ' ' + L + ' hint2', T.gTile2(1, want, 0), [1, want, 1, want, want, 0]);
        });
      });
      LANGS.forEach(L => {
        const t = I18N[L].gTileDone(pair[0], pair[1]);
        seq(w + ' ' + L + ' done', t, L === 'zh' ? [1, pair[0], pair[0], 1, pair[1], pair[1], 1] : [pair[0], 1, pair[0], pair[1], 1, pair[1], 1]);
      });
    });
    if (!TILE_DENS_REF.every(p => D.GAME_TILE.some(pr => pr.indexOf(p) >= 0))) fail('some tile piece is never the answer, so its size is only ever a distractor');
  }

  /* ================= 第 2 關：插旗子 ================= */
  {
    const G = D.PIN_G;
    touch('a flag (' + G.pinW + '×' + G.pinH + ')', Math.min(G.pinW, G.pinH));
    G.rowY.forEach((y, r) => inside(box(D.GL.X0, y, G.pinW, G.pinH), 'flag row ' + r + ' at 0', G.H));
    G.rowY.forEach((y, r) => inside(box(D.GL.X1, y, G.pinW, G.pinH), 'flag row ' + r + ' at the right end', G.H));
    for (let r = 1; r < G.rowY.length; r++) if (G.rowY[r] - G.rowY[r - 1] < G.pinH + 8 + 2) fail('flag rows ' + (r - 1) + '/' + r + ' are ' + (G.rowY[r] - G.rowY[r - 1]) + ' apart — a flag and its 8px pointer need ' + (G.pinH + 10));
    const lastBottom = G.rowY[G.rowY.length - 1] + G.pinH / 2 + 8;
    if (!(G.axisY - D.GL.tickBig / 2 > lastBottom)) fail('the last flag\'s pointer reaches the number line');
    if (!(G.axisY - G.tapBand > G.rowY[G.rowY.length - 1] + G.pinH / 2)) fail('the line\'s tap band reaches the last flag\'s track');
    inside(lineBox(G.axisY, D.GL.X0, D.GL.X1), 'the flag round\'s number line', G.H);
    need('pin', /if \(k === null \|\| k === 0\) return false;/, 'a flag stopped between marks or left at 0 is not sent back silently');
    need('pin', /if \(k !== P\.data\.k\)\{ roundMiss\(pinWhy\(d, dd, P\.data\.k, P\.data\.form, P\.data\.txt, k\)\); return false; \}/, 'a flag at the wrong mark is not refused with its reason (pinWhy)');
    need('pin', /if \(!onAxis && !onRail\) return false;/, 'a tap on another flag\'s track is taken');
    need('pin', /axis:'x', minX:GL\.X0, maxX:GL\.X1,/, 'the flags are not held on their tracks between 0 and the right end');
    D.GAME_PIN.forEach((e, ei) => {
      const w = 'pin ' + ei, n = e.M * e.d, seg = (D.GL.X1 - D.GL.X0) / n;
      if (GAME_DENS_REF.indexOf(e.d) < 0 || e.M < 1 || e.M > 3) fail(w + ': M=' + e.M + ' d=' + e.d + ' is outside this lesson\'s lines');
      if (seg < 14) fail(w + ': one part is ' + seg.toFixed(1) + 'px — too thin to plant a flag on');
      if (e.pins.length !== G.rowY.length) fail(w + ': ' + e.pins.length + ' flags for ' + G.rowY.length + ' tracks');
      const ks = e.pins.map(p => p[0]);
      if (new Set(ks).size !== ks.length) fail(w + ': two flags name the same point');
      if (!ks.some(k => k >= e.d)) fail(w + ': no flag reaches 1, so every flag is a proper fraction');
      e.pins.forEach(([kt, form], pi) => {
        const ww = w + ' flag ' + pi;
        if (!(kt >= 1 && kt <= n)) fail(ww + ': ' + kt + ' parts is not on the line 0..' + e.M);
        if (!formOkRef(kt, e.d, form)) fail(ww + ': ' + kt + '/' + e.d + ' cannot be written as ' + form);
        textOk(ww, kt, e.d, form);
        /* 照規則玩：每一個刻度都插插看，只有它自己的那一個收；0 和兩個刻度中間靜靜回去 */
        for (let j = 0; j <= n; j++){
          const x = D.glX(e.M, e.d, j), got = D.pinDock(e.M, e.d, x);
          if (got !== j) fail(ww + ': a flag right on mark ' + j + ' docks at ' + got);
        }
        LANGS.forEach(L => {
          const T = I18N[L], txt = D.gameText(kt, e.d, form, L), qr = divmodRef(kt, e.d);
          for (let j = 1; j <= n; j++){
            if (j === kt) continue;
            const m = pinWhyRef(T, e.d, kt, form, txt, j, D.fracText(j, e.d));
            const wj = ww + ' ' + L + ' at ' + j;
            const pg = D.pinWhy(T, e.d, kt, form, txt, j);
            if (pg !== m) fail(wj + ': the page gives the reason "' + pg + '", the reference branch gives "' + m + '"');
            if (form === 'whole' && j === qr.q) seq(wj, m, [qr.q, qr.q, qr.q, j, e.d]);
            else if (form === 'mixed' && j === qr.r) seq(wj, m, [qr.q, qr.r, e.d, qr.q, qr.r, j, e.d]);
            else {
              seq(wj, m, form === 'mixed' ? [j, e.d, j, qr.q, qr.r, e.d, qr.q, qr.r] : form === 'whole' ? [j, e.d, j, qr.q, qr.q] : [j, e.d, j, kt, kt]);
              if (Math.abs(j - kt) === 1 && !/格線|marks/.test(m)) fail(wj + ': one part off but the reason does not say count parts, not marks');
            }
          }
          const okm = T.gPinOk(txt, kt, D.fracText(kt, e.d));
          if (!subseqRef(gnums(okm), [kt]) || (txt !== D.fracText(kt, e.d) && !subseqRef(gnums(okm), [kt, kt, e.d]))) fail(ww + ' ' + L + ': the "planted" message does not say ' + kt + ' parts (' + okm + ')');
          seq(ww + ' ' + L + ' hint2', T.gPin2(txt, kt, qr.q, qr.r), [kt].concat(qr.q && qr.r ? [qr.q, qr.r] : []));
        });
      });
      /* pinDock 掃整條軌道：要嘛不收，要嘛收最近的刻度，而且離刻度 ≤ dock 與半段 */
      for (let x = D.GL.X0 - 5; x <= D.GL.X1 + 5; x += 0.25){
        const k = D.pinDock(e.M, e.d, x), kr = Math.round((x - D.GL.X0) / seg);
        const lim = Math.min(G.dock, seg / 2), off = Math.abs(x - (D.GL.X0 + kr * seg));
        const want = (kr >= 0 && kr <= n && off <= lim) ? kr : null;
        if (k !== want && !(Math.abs(off - lim) < 1e-6)) { fail(w + ': pinDock at x=' + x + ' gives ' + k + ', expected ' + want); break; }
      }
    });
    if (!D.GAME_PIN.some(e => e.pins.some(p => p[1] === 'mixed'))) fail('no flag is written as a mixed number');
    if (!D.GAME_PIN.some(e => e.pins.some(p => p[1] === 'whole'))) fail('no flag is a whole number, so "an improper fraction can land right on a whole number" is never planted');
    if (!D.GAME_PIN.some(e => e.pins.some(p => p[1] === 'dec'))) fail('no flag is a decimal');
  }

  /* ================= 第 3 關：寫出點的名字 ================= */
  {
    const G = D.READ_G;
    touch('a number card (' + G.card + ')', G.card);
    const slots = [[G.numX, 0], [G.denX, 0], [G.wholeX, 1], [G.numX, 1], [G.denX, 1]].map(s => box(s[0], G.rowY[s[1]], G.slot, G.slot));
    slots.forEach((s, i) => inside(s, 'read box ' + i, G.H));
    noHits(slots.map(s => grow(s, 6)), 'read boxes (with their 6px drop pads)');
    const keys = []; for (let c = 0; c <= 9; c++) keys.push(box(W / 2 + ((c % 5) - 2) * G.trayStep, G.trayY[Math.floor(c / 5)], G.card, G.card));
    keys.forEach((k, i) => inside(k, 'read card ' + i, G.H));
    noHits(keys, 'read cards');
    keys.forEach((k, i) => slots.forEach((s, j) => { if (hit(k, grow(s, 6))) fail('read card ' + i + ' touches box ' + j + '\'s drop pad'); }));
    [0, 1].forEach(r => inside({ x:G.lblX, y:G.rowY[r] - G.slot / 2, w:G.lblW, h:G.slot }, 'read row label ' + r, G.H));
    if (G.lblX + G.lblW > G.wholeX - G.slot / 2) fail('the read row labels run into the boxes');
    inside(lineBox(G.lineY, D.GL.X0, D.GL.X1), 'the read round\'s number line', G.H);
    if (!(G.lineY + 13 + 20 + 4 <= G.rowY[0] - G.slot / 2 - 6)) fail('the read line\'s numbers touch the top boxes');
    need('read', /var s = nearestOpen\(slots, pt, 6\);\n\s*if \(!s\) return false;/, 'a drop on empty space / a written box is not sent back silently');
    need('read', /if \(v !== want\[s\.part\]\)\{ roundMiss\(readWhy\(d, e, s\.part, v\)\); return false; \}/, 'a card in the wrong box is not refused with its reason (readWhy)');
    D.GAME_READ.forEach((e, ei) => {
      const w = 'read ' + ei + ' (' + e.k + '/' + e.d + ')', qr = divmodRef(e.k, e.d);
      if (GAME_DENS_REF.indexOf(e.d) < 0 || e.M < 1 || e.M > 3 || e.M * e.d > 15) fail(w + ': M=' + e.M + ' d=' + e.d + ' is outside this round\'s lines');
      if (!(e.k > e.d && e.k <= e.M * e.d)) fail(w + ': the point must be past 1 and on the line');
      if (e.k > 9) fail(w + ': the numerator needs two cards');
      if (qr.r === 0) fail(w + ': the point is a whole number, so there is no mixed number to write');
      else if (gcdRef(qr.r, e.d) !== 1) fail(w + ': ' + qr.r + '/' + e.d + ' cancels down — this lesson does not cancel, so the reading must be unique');
      const want = D.readWant(e), ref = { aNum:e.k, aDen:e.d, bWhole:qr.q, bNum:qr.r, bDen:e.d };
      Object.keys(ref).forEach(p => { if (want[p] !== ref[p]) fail(w + ': box ' + p + ' wants ' + want[p] + ', repeated subtraction gives ' + ref[p]); });
      if (Object.keys(want).length !== 5) fail(w + ': readWant has ' + Object.keys(want).length + ' boxes, the board has 5');
      /* 照規則玩：每一格、0～9 每一張，只有對的收；錯的理由要說到放下去的那張 */
      LANGS.forEach(L => {
        const T = I18N[L];
        Object.keys(ref).forEach(p => {
          for (let v = 0; v <= 9; v++){
            if (v === ref[p]) continue;
            const m = readWhyRef(T, e, p, v), pg = D.readWhy(T, e, p, v);
            if (pg !== m) fail(w + ' ' + L + ': for ' + v + ' in ' + p + ' the page says "' + pg + '", the reference branch says "' + m + '"');
            if (gnums(m).indexOf(v) < 0) fail(w + ' ' + L + ': the reason for ' + v + ' in ' + p + ' does not mention ' + v + ': ' + m);
            if ((p === 'aDen' || p === 'bDen') && v === e.d + 1 && !/格線|marks/.test(m)) fail(w + ' ' + L + ': ' + v + ' as the denominator (counted the marks) is not told so');
          }
        });
        seq(w + ' ' + L + ' done', T.gReadDone(D.fracText(e.k, e.d), D.mixedText(e.k, e.d, L)), [e.k, e.d, qr.q, qr.r, e.d]);
        seq(w + ' ' + L + ' hint2', T.gRead2(qr.q, e.d), [qr.q, qr.q + 1, e.d]);
      });
    });
    if (!D.GAME_READ.some(e => divmodRef(e.k, e.d).q >= 2)) fail('no read point is past 2');
    if (!D.GAME_READ.some(e => e.M * e.d > e.k + e.d)) fail('no read line runs a whole step past its point, so "the number on its left" is never tested against a longer line');
  }

  /* ================= 第 4 關：由小到大排隊 ================= */
  {
    const G = D.SORT_G;
    touch('a value card (' + G.cardW + '×' + G.cardH + ')', Math.min(G.cardW, G.cardH));
    const slots = [0, 1, 2, 3].map(i => ({ x:D.sortX(i) - G.slotW / 2, y:G.slotY, w:G.slotW, h:G.slotH }));
    const cards = [0, 1, 2, 3].map(i => box(D.sortX(i), G.trayY, G.cardW, G.cardH));
    slots.forEach((s, i) => inside(s, 'sort box ' + i, G.H));
    noHits(slots, 'sort boxes');
    cards.forEach((c, i) => inside(c, 'sort card ' + i, G.H));
    noHits(cards, 'sort cards');
    cards.forEach((c, i) => slots.forEach((s, j) => { if (hit(c, grow(s, 6))) fail('sort card ' + i + ' touches box ' + j + '\'s drop pad'); }));
    inside(lineBox(G.lineY, D.GL.X0, D.GL.X1), 'the sort round\'s number line', G.H);
    if (!(G.lineY + 13 + 20 <= G.slotY - 6)) fail('the sort line\'s numbers touch the boxes\' drop pad');
    if (!(G.lblY >= G.slotY + G.slotH + 2 && G.lblY + 20 <= G.trayY - G.cardH / 2)) fail('the smallest / biggest labels sit on the boxes or the cards');
    need('sort', /var s = nearestOpen\(slots, pt, 6\);\n\s*if \(!s\) return false;/, 'a drop on empty space / a filled box is not sent back silently');
    need('sort', /if \(k !== s\.want\)\{ roundMiss\(d\.gSortWrong\(P\.data\.txt, k, order\.indexOf\(k\) \+ 1\)\); return false; \}/, 'a card in the wrong box is not refused with its reason');
    need('sort', /var order = e\.cards\.map\(function\(c\)\{ return c\[0\]; \}\)\.sort\(function\(a, b\)\{ return a - b; \}\);/, 'the boxes do not want the cards smallest first');
    D.GAME_SORT.forEach((e, ei) => {
      const w = 'sort ' + ei, n = e.M * e.d;
      if (GAME_DENS_REF.indexOf(e.d) < 0 || e.M < 1 || e.M > 3 || n > 24) fail(w + ': M=' + e.M + ' d=' + e.d + ' is outside this lesson\'s lines');
      if (e.cards.length !== 4) fail(w + ': ' + e.cards.length + ' cards for 4 boxes');
      const ks = e.cards.map(c => c[0]);
      if (new Set(ks).size !== 4) fail(w + ': two cards are the same number, so the order is not unique');
      if (new Set(e.cards.map(c => c[1])).size < 2) fail(w + ': every card is written the same way, so comparing two spellings is never needed');
      e.cards.forEach(([k, form], ci) => {
        if (!(k >= 1 && k <= n)) fail(w + ' card ' + ci + ': ' + k + ' is not on the line');
        if (!formOkRef(k, e.d, form)) fail(w + ' card ' + ci + ': ' + k + '/' + e.d + ' cannot be written as ' + form);
        textOk(w + ' card ' + ci, k, e.d, form);
      });
      /* 照規則玩：每一格、每一張，只有排第 i 小的收 */
      const ref = ks.slice().sort((a, b) => a - b);
      LANGS.forEach(L => {
        const T = I18N[L];
        ref.forEach((k, i) => {
          const c = e.cards.find(x => x[0] === k), txt = D.gameText(k, e.d, c[1], L);
          seq(w + ' ' + L + ' wrong ' + txt, T.gSortWrong(txt, k, i + 1), gnums(txt).concat([k, i + 1, i + 1]));
        });
        const txts = ref.map(k => D.gameText(k, e.d, e.cards.find(x => x[0] === k)[1], L));
        seq(w + ' ' + L + ' done', T.gSortDone(txts), [].concat(...txts.map(gnums)));
      });
    });
    /* 迷思：寫出來的數字大，不代表比較大 —— 題庫要有「後面那張的數字比較小」的一對 */
    if (!D.GAME_SORT.some(e => { const o = e.cards.slice().sort((a, b) => a[0] - b[0]); return o.some((c, i) => i > 0 && Math.max(...gnums(D.gameText(c[0], e.d, c[1], 'zh'))) < Math.max(...gnums(D.gameText(o[i - 1][0], e.d, o[i - 1][1], 'zh')))); }))
      fail('no sort set has a bigger number written with smaller digits, so "the bigger-looking digits win" is never caught');
  }

  /* ================= 第 5 關：一個點兩個名字 ================= */
  {
    const G = D.NAME_G;
    touch('a name card (' + G.cardW + '×' + G.cardH + ')', Math.min(G.cardW, G.cardH));
    const bins = G.binX.map(x => ({ x:x, y:G.binY, w:G.binW, h:G.binH }));
    bins.forEach((b, i) => inside(b, 'name box ' + i, G.H));
    noHits(bins, 'name boxes');
    if (G.lbl + 4 + 2 * (G.cardH + 4) > G.binH) fail('a name box cannot hold its two cards under the letter');
    if (G.cardW > G.binW - 4) fail('a name card is wider than its box');
    const cards = []; for (let i = 0; i < 6; i++) cards.push(box(G.trayX[i % 3], G.trayY[Math.floor(i / 3)], G.cardW, G.cardH));
    cards.forEach((c, i) => inside(c, 'name card ' + i, G.H));
    noHits(cards, 'name cards');
    cards.forEach((c, i) => bins.forEach((b, j) => { if (hit(c, grow(b, 6))) fail('name card ' + i + ' touches box ' + j + '\'s drop pad'); }));
    inside(lineBox(G.lineY, D.GL.X0, D.GL.X1), 'the name round\'s number line', G.H);
    if (!(G.lineY + G.dotHH + 6 < G.binY - 6)) fail('a point\'s drop zone reaches the boxes\' drop pads');
    /* 點的收的範圍要蓋住點上面的字（甲乙丙）—— 字也是孩子看到的那個點 */
    need('name', /return target\(B, x - G\.dotHW, G\.lineY - G\.letterDY - 10, G\.dotHW \* 2, G\.letterDY \+ 10 \+ G\.dotHH, 'gspot', /, 'a point\'s drop zone does not reach up over its letter');
    { const zt = G.lineY - G.letterDY - 10, lt = G.lineY - G.letterDY - 10, lb = lt + 20;
      if (!(zt <= lt && G.lineY + G.dotHH >= lb && G.dotHW >= 12)) fail('a point\'s letter is not inside its drop zone');
      if (zt < 0) fail('a point\'s drop zone runs off the top of the board'); }
    if (!/var fp = B\.toBoard\(e\);\n\s*if \(!\(B\.onDrop && B\.onDrop\(P, \{ x:P\.cx, y:P\.cy, fx:fp\.x, fy:fp\.y \}\)\)\) P\.home\(\);/.test(src)) fail('the drag engine does not pass the release point (fx, fy) to the round');
    need('name', /var t = nameTarget\(pt\.fx !== undefined \? nearestOpen\(spots, \{ x:pt\.fx, y:pt\.fy \}, 6\) : null, nearestOpen\(spots\.concat\(bins\), pt, 6\), D\.j\);/, 'a card released with the finger on its drawn point is not taken by that point (natural-action rule)');
    /* nameTarget()：手指或中心任一個指到自己的點就收；兩個都錯才算錯；都沒指到才靜靜回去 */
    {
      const T = j => ({ j:j }), cases = [[null, null, 0, null], [T(0), null, 0, 0], [null, T(0), 0, 0], [T(1), T(0), 0, 0], [T(0), T(1), 0, 0],
                                         [T(1), T(2), 0, 2], [T(1), null, 0, 1], [null, T(2), 0, 2]];
      cases.forEach(([tf, tc, j, want], i) => {
        const got = D.nameTarget(tf, tc, j), gj = got ? got.j : null;
        if (gj !== want) fail('nameTarget case ' + i + ': finger ' + (tf && tf.j) + ', centre ' + (tc && tc.j) + ', card ' + j + ' gives ' + gj + ', expected ' + want + ' — a drop where the finger OR the card centre is on the card\'s own point must count');
      });
    }
    if (!(G.lineY - G.letterDY - 10 >= 0)) fail('the point letters are above the board');
    need('name', /nearestOpen\(spots\.concat\(bins\), pt, 6\), D\.j\);\n\s*if \(!t\) return false;/, 'a card is not taken by its point AND its box (the point is what the child sees as the target)');
    need('name', /if \(D\.j !== t\.j\)\{ roundMiss\(d\.gNameWrong\(D\.txt, D\.k, letters\[D\.j\], letters\[t\.j\], kOf\(t\.j\)\)\); return false; \}/, 'a card on the wrong point / box is not refused with its reason');
    D.GAME_NAME.forEach((e, ei) => {
      const w = 'name ' + ei, n = e.M * e.d;
      if (GAME_DENS_REF.indexOf(e.d) < 0 || e.M < 1 || e.M > 3 || n > 20) fail(w + ': M=' + e.M + ' d=' + e.d + ' is outside this round\'s lines');
      if (e.ks.length !== 3 || new Set(e.ks).size !== 3 || e.ks.some(k => !(k >= 1 && k <= n))) fail(w + ': three different points on the line, got ' + e.ks);
      for (let i = 1; i < 3; i++){
        const gap = D.glX(e.M, e.d, e.ks[i]) - D.glX(e.M, e.d, e.ks[i - 1]);
        if (!(gap >= 24)) fail(w + ': points ' + (i - 1) + ' and ' + i + ' are ' + gap.toFixed(1) + 'px apart — their letters would touch');
      }
      if (e.cards.length !== 6) fail(w + ': ' + e.cards.length + ' cards, expected 6');
      [0, 1, 2].forEach(p => { if (e.cards.filter(c => c[0] === p).length !== 2) fail(w + ': point ' + p + ' does not have exactly two names'); });
      e.cards.forEach(([p, form], ci) => {
        const k = e.ks[p];
        if (!formOkRef(k, e.d, form)) fail(w + ' card ' + ci + ': ' + k + '/' + e.d + ' cannot be written as ' + form);
        textOk(w + ' card ' + ci, k, e.d, form);
        /* 每一張卡片讀回來，只落在一個點上（就是它自己的點）：照規則，放到別的點／箱子都不收 */
        LANGS.forEach(L => {
          const t = D.gameText(k, e.d, form, L), hits = e.ks.filter(kk => cardKRef(t, e.d) === kk);
          if (hits.length !== 1 || hits[0] !== k) fail(w + ' card ' + ci + ' (' + L + '): "' + t + '" names ' + hits.length + ' of the drawn points');
          [0, 1, 2].filter(o => o !== p).forEach(o => seq(w + ' ' + L + ' wrong ' + t, I18N[L].gNameWrong(t, k, 'X', 'Y', e.ks[o]), gnums(t).concat([k, e.ks[o]])));
        });
      });
      LANGS.forEach(L => {
        const texts = e.cards.map(c => D.gameText(e.ks[c[0]], e.d, c[1], L));
        if (new Set(texts).size !== 6) fail(w + ' (' + L + '): two cards look the same');
      });
    });
    if (!D.GAME_NAME.some(e => e.d === 10)) fail('no name set is on a tenths line, so "a fraction and a decimal are the same point" is never played');
    if (!D.GAME_NAME.some(e => e.cards.some(c => c[1] === 'whole'))) fail('no name set has a whole number, so "an improper fraction can be a whole number" is never played');
    LANGS.forEach(L => { if (!Array.isArray(I18N[L].gLetters) || I18N[L].gLetters.length !== 3 || new Set(I18N[L].gLetters).size !== 3) fail('gLetters (' + L + ') should be three different letters'); });
  }
}

/* 驗算器在 data.check 跑完之後應該驗過的宣稱條數與指紋（裝上去的時候用實測值填）。
   ⚠️ 只釘條數擋不住「拿掉一條、再補一條」—— 指紋是排序後的整串宣稱取 sha1。 */
const NARRATED_COUNT_REF = 3292;
const CLAIMS_VERIFIED_REF = 62;
const CLAIMS_FP_REF = '9953c885c42c51fac803e233a137f92eb02aca8c';

module.exports = {
  /* ================= 刻意改壞測試 =================
     ⚠️ `via` 跟著「斷言住在哪一支腳本」走，不是跟著「改哪個檔案」走：
        斷言在 data.check 裡的話，即使改的是 review.html／reference.html，via 也要寫 index。
     ⚠️ 驗算器自己的 PROBE（claimProblems 的零誤報／必抓）沒有辦法用改壞測試證明 ——
        改壞測試只動得了頁面，動不了這份設定。真正釘住它的是 data.check 第 0 段，
        每一次執行都會把 11 筆 PROBE 跑一遍。 */
  breaks: [
    /* --- 版面常數：改一個就要響 --- */
    { file:'index', via:'index', expect:'layout constant LINE_Y',
      find:'var LINE_Y = 30;                      /* 主線的 y */',
      replace:'var LINE_Y = 34;                      /* 主線的 y */',
      why:'the axis would move but nothing else would' },
    { file:'index', via:'index', expect:'layout constant FIG_H',
      find:'var FIG_W = 460, FIG_H = 70;',
      replace:'var FIG_W = 460, FIG_H = 84;',
      why:'the canvas would grow without the viewBox following' },
    { file:'index', via:'index', expect:'layout constant X0',
      find:'var X0 = (FIG_W - SPAN) / 2;          /* 50 —— 左右各留 50，圖在畫布正中間 */',
      replace:'var X0 = 30;          /* 50 —— 左右各留 50，圖在畫布正中間 */',
      why:'the line would stop being centred' },
    { file:'index', via:'index', expect:'layout constant DOT_R',
      find:'var DOT_R = 6;                        /* 點的半徑 */',
      replace:'var DOT_R = 9;                        /* 點的半徑 */',
      why:'a fatter point could straddle two ticks' },
    { file:'index', via:'index', expect:'layout constant LBL_DY',
      find:'var LBL_FS = 19, LBL_DY = 28;         /* 整數標籤：字級與基線離主線多遠（往下） */',
      replace:'var LBL_FS = 19, LBL_DY = 44;         /* 整數標籤：字級與基線離主線多遠（往下） */',
      why:'the whole-number labels would fall off the bottom of the canvas' },
    { file:'index', via:'index', expect:'layout constant TICK_SMALL',
      find:'var TICK_BIG = 11, TICK_SMALL = 6;    /* 整數刻度／小刻度的半長 */',
      replace:'var TICK_BIG = 11, TICK_SMALL = 11;    /* 整數刻度／小刻度的半長 */',
      why:'short and long ticks would look identical, so a child could not see the whole numbers' },
    { file:'index', via:'index', expect:'layout constant MARK_DY',
      find:'var MARK_FS = 15, MARK_DY = 14;       /* 甲／乙 的字級與基線離主線多遠（往上） */',
      replace:'var MARK_FS = 15, MARK_DY = 2;       /* 甲／乙 的字級與基線離主線多遠（往上） */',
      why:'the point letters would sit on top of the ticks' },
    { file:'index', via:'index', expect:'a canvas viewBox is',
      find:'<svg class="nlfig" id="s3fig" viewBox="0 0 460 70"',
      replace:'<svg class="nlfig" id="s3fig" viewBox="0 0 460 60"',
      why:'one figure would be drawn in a shorter coordinate system than it uses' },
    { file:'index', via:'index', expect:'tall in CSS but the viewBox is',
      find:'.nlfig{width:100%;max-width:460px;height:70px;display:block;margin:0 auto}',
      replace:'.nlfig{width:100%;max-width:460px;height:120px;display:block;margin:0 auto}',
      why:'the drawing would be letterboxed inside a taller box' },

    /* --- 位置與寫法：兩套實作要一致 --- */
    { file:'index', via:'index', expect:'accumulating gives',
      find:'function segPx(M, d){ return SPAN / (M * d); }',
      replace:'function segPx(M, d){ return SPAN / M; }',
      why:'every small part would be a whole step wide' },
    { file:'index', via:'index', expect:'accumulating gives',
      find:'function xAt(M, d, k){ return X0 + k * segPx(M, d); }',
      replace:'function xAt(M, d, k){ return k * segPx(M, d); }',
      why:'the whole line would slide left by X0' },
    { file:'index', via:'index', expect:'wholeOf(',
      find:'function wholeOf(k, d){ return Math.floor(k / d); }',
      replace:'function wholeOf(k, d){ return Math.round(k / d); }',
      why:'the whole number on the left would round up past the point' },
    { file:'index', via:'index', expect:'remOf(',
      find:'function remOf(k, d){ return k % d; }',
      replace:'function remOf(k, d){ return d % k; }',
      why:'the parts still to count would be worked out the wrong way round' },
    { file:'index', via:'index', expect:'mixedText(',
      find:"    if (r === 0) return String(w);\n    if (w === 0) return r + '/' + d;\n    return lang === 'zh' ? (w + ' 又 ' + r + '/' + d) : (w + ' ' + r + '/' + d);",
      replace:"    if (r === 0) return String(w) + ' 又 0/' + d;\n    if (w === 0) return r + '/' + d;\n    return lang === 'zh' ? (w + ' 又 ' + r + '/' + d) : (w + ' ' + r + '/' + d);",
      why:'a point on a whole number would be printed as "2 又 0/4"' },
    { file:'index', via:'index', expect:'mixedText(',
      find:"    return lang === 'zh' ? (w + ' 又 ' + r + '/' + d) : (w + ' ' + r + '/' + d);\n  }\n  /* 小數的寫法",
      replace:"    return (w + ' 又 ' + r + '/' + d);\n  }\n  /* 小數的寫法",
      why:'the English mixed number would print the Chinese 又' },
    { file:'index', via:'index', expect:'tenthText(',
      find:"    return r === 0 ? String(w) : (w + '.' + r);",
      replace:"    return (w + '.' + r);",
      why:'a point on a whole number would be printed as "1.0"' },
    { file:'index', via:'index', expect:'spanFor(',
      find:'    return (n % d === 0) ? Math.max(1, w) : w + 1;',
      replace:'    return w + 1;',
      why:'a point that lands exactly on a whole number would get an extra empty step' },

    /* --- 圖：刻度、標籤、點、走過的那一段 --- */
    { file:'index', via:'index', expect:'whole-number labels, expected',
      find:'    for (i = 0; i <= M; i++){\n      labels.push({',
      replace:'    for (i = 0; i < M; i++){\n      labels.push({',
      why:'the last whole number would lose its label' },
    { file:'index', via:'index', expect:'ticks, expected',
      find:'    for (j = 0; j <= M * d; j++){',
      replace:'    for (j = 0; j < M * d; j++){',
      why:'the rightmost tick would be missing, so the last part has no end' },
    { file:'index', via:'index', expect:'is marked',
      find:'      var big = (j % d === 0);',
      replace:'      var big = (j % 2 === 0);',
      why:'long ticks would fall on every other part instead of on the whole numbers' },
    { file:'index', via:'index', expect:'the highlight starts at',
      find:'    if (spec.hilite > 0) hi = { x1:X0, x2:xAt(M, d, spec.hilite), y:LINE_Y };',
      replace:'    if (spec.hilite > 0) hi = { x1:X0 + 20, x2:xAt(M, d, spec.hilite), y:LINE_Y };',
      why:'the walked parts would not start at 0' },
    { file:'index', via:'index', expect:'a highlight is drawn',
      find:'    if (spec.hilite > 0) hi',
      replace:'    if (spec.hilite >= 0) hi',
      why:'a zero-length highlight would be drawn before anything is walked' },
    { file:'index', via:'index', expect:'is not on the line',
      find:'      dots.push({ x:xAt(M, d, m.k), y:LINE_Y, r:DOT_R, tone:m.tone, k:m.k });',
      replace:'      dots.push({ x:xAt(M, d, m.k), y:LINE_Y + 8, r:DOT_R, tone:m.tone, k:m.k });',
      why:'the point would float below the line' },
    { file:'index', via:'index', expect:'is not above any marked point',
      find:"      if (m.letter) letters.push({ x:xAt(M, d, m.k), y:LINE_Y - MARK_DY, text:m.letter, fs:MARK_FS });",
      replace:"      if (m.letter) letters.push({ x:xAt(M, d, m.k) + 24, y:LINE_Y - MARK_DY, text:m.letter, fs:MARK_FS });",
      why:'the letter would label the wrong point' },

    /* --- 範例的教學內容 --- */
    { file:'index', via:'index', expect:'cancels down',
      find:"    { id:'r34', M:1, d:4, k:3 },   /* 3/4 */",
      replace:"    { id:'r34', M:1, d:4, k:2 },   /* 3/4 */",
      why:'2/4 also reads as 1/2, and this lesson does not cancel down' },
    { file:'index', via:'index', expect:'lands on a whole number',
      find:"    { id:'r56', M:1, d:6, k:5 },   /* 5/6 */",
      replace:"    { id:'r56', M:1, d:6, k:6 },   /* 5/6 */",
      why:'the point would be a whole number, so "how many parts along" has no answer' },
    { file:'index', via:'index', expect:'won by the same side',
      find:"    { id:'c5', M:1, d:5, a:4, b:1 },   /* 4/5 vs 1/5 → 甲 */",
      replace:"    { id:'c5', M:1, d:5, a:1, b:4 },   /* 4/5 vs 1/5 → 甲 */",
      why:'every comparison would be won by B, so a child could score by always picking one letter' },
    { file:'index', via:'index', expect:'cmpWinner says',
      find:"  function cmpWinner(cs){ return cs.a > cs.b ? 'a' : (cs.b > cs.a ? 'b' : 'same'); }",
      replace:"  function cmpWinner(cs){ return cs.a > cs.b ? 'b' : (cs.b > cs.a ? 'a' : 'same'); }",
      why:'the narration would name the point on the left as the bigger one' },
    { file:'index', via:'index', expect:'whole numbers live on this line too',
      find:'  var S5_KS = [3, 7, 10, 14];',
      replace:'  var S5_KS = [3, 7, 11, 14];',
      why:'the tenths line would never land on a whole number' },
    { file:'index', via:'index', expect:'past 1 with a fraction part',
      find:'  var S5_KS = [3, 7, 10, 14];',
      replace:'  var S5_KS = [3, 7, 10, 20];',
      why:'1.4-style decimals would never appear' },
    { file:'index', via:'index', expect:'never cuts a step into 10',
      find:'  var S1_DENS = [2, 3, 4, 5, 10];',
      replace:'  var S1_DENS = [2, 3, 4, 5, 6];',
      why:'example 5 would arrive with no groundwork for tenths' },

    /* --- 小遊戲「數線尋寶」（§六之五）：每一筆把一條規則改壞，設定檔要響 --- */
    { file:'index', via:'index', expect:'already in increasing order',
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"    a.sort(function(x, y){ return x < y ? -1 : 1; });\n",
      why:'the sort tray would start in the answer order' },
    { file:'index', via:'index', expect:'the sort tray is not shuffled',
      find:"      shuffle(order).forEach(function(k, i){",
      replace:"      order.forEach(function(k, i){",
      why:'the sort tray would always start smallest first' },
    { file:'index', via:'index', expect:'the point letters are not shuffled',
      find:"perm = shuffle([0, 1, 2]);",
      replace:"perm = [0, 1, 2];",
      why:'甲 would always be the leftmost point' },
    { file:'index', via:'index', expect:'in the gap between sort boxes',
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"if (!best){ bd = dd; bc = dc; best = b; }",
      why:'a drop between two boxes would go to the first box in the array, not the nearer one' },
    { file:'index', via:'index', expect:'measure to the box, not the centre',
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"if (dc < bc){ bd = dd; bc = dc; best = b; }",
      why:'a big target would lose drops inside it to a small neighbour' },
    { file:'index', via:'index', expect:'a drop nearest to a finished box skips it',
      find:"    return best && !best.done ? best : null;",
      replace:"    if (best && best.done){ var alt = list.filter(function(b){ return !b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad; })[0]; return alt || null; }\n    return best;",
      why:'a card dropped on a written box would jump into its neighbour' },
    { file:'index', via:'index', expect:'a mistake does not cost 5',
      find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;",
      replace:"    gScore = Math.max(0, gScore - 0); elScore.textContent = gScore;",
      why:'a mistake would be free' },
    { file:'index', via:'index', expect:'board-generation guard',
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
      replace:"",
      why:'a piece held across Restart could act on the new board' },
    { file:'index', via:'index', expect:'lostpointercapture',
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"",
      why:'a piece would freeze when the browser drops the capture' },
    { file:'index', via:'index', expect:'follow only the first finger',
      find:"    el.addEventListener('pointermove', function(e){\n      if (!start || e.pointerId !== pid) return;",
      replace:"    el.addEventListener('pointermove', function(e){\n      if (!start) return;",
      why:'a second finger would drag the piece' },
    { file:'index', via:'index', expect:'placed pieces still take pointer events',
      find:"  .gpiece.locked{cursor:default;pointer-events:none}",
      replace:"  .gpiece.locked{cursor:default}",
      why:'a placed piece would block taps on what is under it' },
    { file:'index', via:'index', expect:'ahead mode does not show hint level 1',
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"    if (mode === 'ahead'){ hintLevel = 0; }",
      why:'ahead mode would get no automatic hint' },
    { file:'index', via:'index', expect:'a piece of the wrong size is not refused',
      find:"        if (p !== R.want){ roundMiss(d.gTileWrong(p, R.want)); return false; }",
      replace:"        if (false){ roundMiss(d.gTileWrong(p, R.want)); return false; }",
      why:'any piece size would tile the step — unequal parts' },
    { file:'index', via:'index', expect:'under 44',
      find:"                 pieceH:48, trayY:[270, 328],",
      replace:"                 pieceH:40, trayY:[270, 328],",
      why:'the tile pieces would be too thin to pick up on a phone' },
    { file:'index', via:'index', expect:'a flag at the wrong mark is not refused',
      find:"        if (k !== P.data.k){ roundMiss(pinWhy(d, dd, P.data.k, P.data.form, P.data.txt, k)); return false; }",
      replace:"        if (Math.abs(k - P.data.k) > 1){ roundMiss(pinWhy(d, dd, P.data.k, P.data.form, P.data.txt, k)); return false; }",
      why:'a flag one part off (counted the marks) would be accepted' },
    { file:'index', via:'index', expect:'docks at',
      find:"    return Math.abs(x - glX(M, d, k)) <= Math.min(PIN_G.dock, seg / 2) ? k : null;",
      replace:"    return Math.abs(x - glX(M, d, k)) <= Math.min(PIN_G.dock, seg / 2) ? Math.max(0, k - 1) : null;",
      why:'a flag right on a mark would be read as the mark before it' },
    { file:'index', via:'index', expect:'reads back as',
      find:"    if (form === 'mixed') return mixedText(k, d, lang);\n    if (form === 'whole')",
      replace:"    if (form === 'mixed') return fracText(k % d, d);\n    if (form === 'whole')",
      why:'a mixed-number flag/card would lose its whole part' },
    { file:'index', via:'index', expect:'cannot be written as',
      find:"    { M:2, d:5,  pins:[[3, 'frac'], [7, 'mixed'], [10, 'whole']] },",
      replace:"    { M:2, d:5,  pins:[[3, 'frac'], [7, 'mixed'], [9, 'whole']] },",
      why:'a whole-number flag that is not a whole number' },
    { file:'index', via:'index', expect:'too thin to plant a flag on',
      find:"    { M:3, d:5,  pins:[[4, 'frac'], [11, 'mixed'], [10, 'frac']] },",
      replace:"    { M:3, d:6,  pins:[[4, 'frac'], [11, 'mixed'], [10, 'frac']] },",
      why:'18 parts of 12px — a flag could not be planted reliably' },
    { file:'index', via:'index', expect:'a tap on another flag\'s track is taken',
      find:"          if (!onAxis && !onRail) return false;",
      replace:"          if (false) return false;",
      why:'tapping anywhere would plant the selected flag' },
    { file:'index', via:'index', expect:'cancels down',
      find:"{ M:2, d:4, k:5 },",
      replace:"{ M:2, d:4, k:6 },",
      why:'6/4 = 1 2/4 also reads as 1 1/2 — two right answers' },
    { file:'index', via:'index', expect:'the numerator needs two cards',
      find:"{ M:3, d:4, k:9 },",
      replace:"{ M:3, d:4, k:11 },",
      why:'11 needs two digit cards in one box' },
    { file:'index', via:'index', expect:'repeated subtraction gives',
      find:"    return { aNum:e.k, aDen:e.d, bWhole:wholeOf(e.k, e.d), bNum:remOf(e.k, e.d), bDen:e.d };",
      replace:"    return { aNum:e.k, aDen:e.d, bWhole:wholeOf(e.k, e.d) + 1, bNum:remOf(e.k, e.d), bDen:e.d };",
      why:'the whole part would be the number on the right' },
    { file:'index', via:'index', expect:'a card in the wrong box is not refused',
      find:"        if (v !== want[s.part]){ roundMiss(readWhy(d, e, s.part, v)); return false; }",
      replace:"        if (v !== want[s.part] && s.part !== 'aDen'){ roundMiss(readWhy(d, e, s.part, v)); return false; }",
      why:'any denominator would be written' },
    { file:'index', via:'index', expect:'the page says',
      find:"    if (part === 'aDen' || part === 'bDen') return v === dd + 1 ? D.gReadLines(v) : D.gReadDen(v);",
      replace:"    if (part === 'aDen' || part === 'bDen') return D.gReadDen(v);",
      why:'counting the marks would not be named as the mistake' },
    { file:'index', via:'index', expect:'the boxes do not want the cards smallest first',
      find:"var order = e.cards.map(function(c){ return c[0]; }).sort(function(a, b){ return a - b; });",
      replace:"var order = e.cards.map(function(c){ return c[0]; }).sort(function(a, b){ return b - a; });",
      why:'the sort round would want biggest first' },
    { file:'index', via:'index', expect:'two cards are the same number',
      find:"    { M:3, d:4,  cards:[[3, 'frac'], [5, 'mixed'], [7, 'frac'], [8, 'whole']] },",
      replace:"    { M:3, d:4,  cards:[[3, 'frac'], [7, 'mixed'], [7, 'frac'], [8, 'whole']] },",
      why:'7/4 and 1 3/4 are the same point, so two orders are right' },
    { file:'index', via:'index', expect:'the gap is',
      find:"  var SORT_G = { lineY:40, slotW:70, slotH:56, pitch:74,",
      replace:"  var SORT_G = { lineY:40, slotW:70, slotH:56, pitch:90,",
      why:'the boxes\' pads would no longer overlap, so nearest-slot snapping goes untested' },
    { file:'index', via:'index', expect:'a card is not taken by its point AND its box',
      find:"        var t = nameTarget(pt.fx !== undefined ? nearestOpen(spots, { x:pt.fx, y:pt.fy }, 6) : null, nearestOpen(spots.concat(bins), pt, 6), D.j);",
      replace:"        var t = nameTarget(null, nearestOpen(bins, pt, 6), D.j);",
      why:'dropping a card on the drawn point would be silently refused (natural-action rule)' },
    { file:'index', via:'index', expect:'does not have exactly two names',
      find:"    { M:2, d:5,  ks:[5, 7, 10],  cards:[[0, 'whole'], [0, 'frac'], [1, 'frac'], [1, 'mixed'], [2, 'whole'], [2, 'frac']] },",
      replace:"    { M:2, d:5,  ks:[5, 7, 10],  cards:[[0, 'whole'], [0, 'frac'], [1, 'frac'], [1, 'mixed'], [1, 'mixed'], [2, 'frac']] },",
      why:'one point would get three names and another one' },
    { file:'index', via:'index', expect:'their letters would touch',
      find:"    { M:3, d:2,  ks:[3, 4, 5],",
      replace:"    { M:3, d:10, ks:[3, 4, 5],",
      why:'three points 7px apart — their letters would overlap' },
    { file:'index', via:'index', expect:'numbers should read',
      find:"      gNameWrong:function(txt, k, Lc, Lj, kj){ return txt + ' 是從 0 數 ' + k + ' 段的點，那是' + Lc + '；' + Lj + '是從 0 數 ' + kj + ' 段。'; },",
      replace:"      gNameWrong:function(txt, k, Lc, Lj, kj){ return txt + ' 是從 0 數 ' + kj + ' 段的點，那是' + Lc + '；' + Lj + '是從 0 數 ' + k + ' 段。'; },",
      why:'the reason would swap the two points\' part counts' },
    { file:'index', via:'index', expect:'numbers should read',
      find:"      gTileWrong:function(p, want){ return '這一段是 1/' + p + '：' + p + ' 段就鋪滿一格 —— 那是平分成 ' + p + ' 份，這一格要平分成 ' + want + ' 份。'; },",
      replace:"      gTileWrong:function(p, want){ return '這一段是 1/' + p + '：' + want + ' 段就鋪滿一格 —— 那是平分成 ' + p + ' 份，這一格要平分成 ' + want + ' 份。'; },",
      why:'the reason would claim the wrong number of pieces fills a step' },

    { file:'index', via:'index', expect:'the reference branch gives',
      find:"    if (form === 'mixed' && k === r) return D.gPinMixed(txt, q, r, here);\n",
      replace:"",
      why:'a mixed-number flag planted without its whole part would get the generic reason' },
    { file:'index', via:'index', expect:'is not taken by that point',
      find:"        var t = nameTarget(pt.fx !== undefined ? nearestOpen(spots, { x:pt.fx, y:pt.fy }, 6) : null, nearestOpen(spots.concat(bins), pt, 6), D.j);",
      replace:"        var t = nearestOpen(spots.concat(bins), pt, 6);",
      why:'a card held by its edge and released with the finger on its point would go by the card centre instead' },
    { file:'index', via:'index', expect:'must count',
      find:"    return tc || tf || null;     /* 中心指到的優先：中心在自己的點上就收在這裡 */",
      replace:"    return tf || tc || null;",
      why:'a card centred on its own point but with the finger over the neighbour would be called wrong (codex round 2)' },

    { file:'index', via:'index', expect:'drop pads overlap',
      find:"rowTop:[6, 132], rowH:104,",
      replace:"rowTop:[6, 104], rowH:104,",
      why:'the second row would overlap the first: a drop on row 2\'s prompt would be judged for row 1 (verifier finding)' },
    { file:'index', via:'index', expect:'the drop zone is not the drawn row box',
      find:"        var R = target(B, G.X0 - G.padX, top, G.SPAN + 2 * G.padX, G.rowH, 'gtrack', ",
      replace:"        var R = target(B, G.X0, top + 22, G.SPAN, 76, 'gtrack', ",
      why:'the accept zone would leave out the prompt and the 0 / 1 labels' },
    { file:'index', via:'index', expect:'does not cover its prompt',
      find:"rowH:104, lblY:4, lblH:22,",
      replace:"rowH:104, lblY:-20, lblH:22,",
      why:'the prompt would sit outside its own row box' },
    { file:'index', via:'index', expect:'does not reach up over its letter',
      find:"        return target(B, x - G.dotHW, G.lineY - G.letterDY - 10, G.dotHW * 2, G.letterDY + 10 + G.dotHH, 'gspot', { j:perm[i] });",
      replace:"        return target(B, x - G.dotHW, G.lineY - G.dotHH, G.dotHW * 2, G.dotHH * 2, 'gspot', { j:perm[i] });",
      why:'a card dropped on the point\'s letter would be silently refused (verifier finding)' },

    /* --- 題庫 --- */
    { file:'index', via:'index', expect:'stem does not match the oracle',
      find:'從 0 往右<strong>數 3 段</strong>的那個點是多少？',
      replace:'從 0 往右<strong>數 2 段</strong>的那個點是多少？',
      why:'the stem would ask about a different point while the answer stayed 3/4' },
    { file:'index', via:'index', expect:'the oracle says 1',
      find:"          opts:['0 和 1 之間', '1 和 2 之間', '2 和 3 之間', '剛好在 4'], ans:1,",
      replace:"          opts:['0 和 1 之間', '1 和 2 之間', '2 和 3 之間', '剛好在 4'], ans:2,",
      why:'7/4 would be marked as sitting between 2 and 3' },
    { file:'index', via:'index', expect:'two options are the same answer',
      find:"用<strong>小數</strong>寫是多少？',\n          opts:['7.0', '0.8', '0.1', '0.7'], ans:3,",
      replace:"用<strong>小數</strong>寫是多少？',\n          opts:['7.0', '0.8', '7/10', '0.7'], ans:3,",
      why:'7/10 and 0.7 are the same number' },
    { file:'index', via:'index', expect:'stem does not match the oracle',
      find:'which is bigger, <strong>2/5</strong> or <strong>4/5</strong>?',
      replace:'which is smaller, <strong>2/5</strong> or <strong>4/5</strong>?',
      why:'only the English stem would ask the opposite question, and the answer would stay 4/5' },
    { file:'index', via:'index', expect:'quotient/remainder claim is wrong',
      find:'why:\'7 ÷ 4 ＝ 1 餘 3：走完 1 整格，再往右 3 段',
      replace:'why:\'7 ÷ 4 ＝ 1 餘 2：走完 1 整格，再往右 3 段',
      why:'the explanation would state a remainder that is not the remainder' },

    /* --- 旁白裡的宣稱 --- */
    { file:'index', via:'index', expect:'arithmetic is wrong',
      find:"      s5calc:function(k){ return '數 ' + k + ' 段 → ' + fracText(k, 10) + ' ＝ ' + tenthText(k); },",
      replace:"      s5calc:function(k){ return '數 ' + k + ' 段 → ' + fracText(k, 10) + ' ＝ ' + tenthText(k + 1); },",
      why:'the fraction and the decimal on the same line would be different numbers' },
    { file:'index', via:'index', expect:'quotient/remainder claim is wrong',
      find:"        return '<strong>' + cs.n + ' ÷ ' + cs.d + ' ＝ ' + w + ' 餘 ' + r + '</strong>：走完 <strong>' + w + ' 整格</strong>",
      replace:"        return '<strong>' + cs.n + ' ÷ ' + cs.d + ' ＝ ' + (w + 1) + ' 餘 ' + r + '</strong>：走完 <strong>' + w + ' 整格</strong>",
      why:'the quotient in the narration would be one too many' },
    { file:'index', via:'index', expect:'the set of arithmetic claims on the page changed',
      find:"        return hi + ' 段 > ' + lo + ' 段 → ' + fracText(hi, cs.d) + ' > ' + fracText(lo, cs.d);",
      replace:"        return lo + ' 段 < ' + hi + ' 段 → ' + fracText(lo, cs.d) + ' < ' + fracText(hi, cs.d);",
      why:'the claims would still all be true, but they would be different claims — only the fingerprint catches that' },
    { file:'index', via:'index', expect:'1 takes the singular',
      find:"        return plEn(hi, 'part') + ' > ' + plEn(lo, 'part') + ' → ' + fracText(hi, cs.d) + ' > ' + fracText(lo, cs.d);",
      replace:"        return hi + ' parts > ' + lo + ' parts → ' + fracText(hi, cs.d) + ' > ' + fracText(lo, cs.d);",
      why:'a comparison against one part would print "1 parts"' },
    { file:'index', via:'index', expect:'missing a space between Chinese and a digit',
      find:"      s5calc:function(k){ return '數 ' + k + ' 段 → '",
      replace:"      s5calc:function(k){ return '數' + k + ' 段 → '",
      why:'Chinese and a digit would be glued together on screen' },

    /* --- 四頁的措辭 --- */
    { file:'reference', via:'index', expect:'says "數的是段"',
      find:"      d2:'<strong>看分子</strong>：它說要從 0 往右<strong>數幾段</strong>。⚠️ 數的是<strong>段</strong>，不是格線。',",
      replace:"      d2:'<strong>看分子</strong>：它說要從 0 往右<strong>數幾段</strong>。⚠️ 數的是<strong>線</strong>，不是格線。',",
      why:'the cheat sheet would tell the child to count the very thing this lesson says not to count' },
    { file:'index', via:'index', expect:'左邊的比較大',
      find:"      s4note:'💬 <strong>同一條數線上，右邊的點比較大</strong>",
      replace:"      s4note:'💬 左邊的比較大。<strong>同一條數線上，右邊的點比較大</strong>",
      why:'the page would state the rule and its opposite in the same sentence' },
    { file:'reference', via:'index', expect:'without saying where it belongs',
      find:"的比大小在<strong>五年級「通分加減」</strong>；把 1/4 這種分數<strong>換寫成小數</strong>在<strong>五年級「小數商店」</strong>。這張卡上<strong>畫出來的</strong>整數只到 3、分母只用 2 到 10，不用負數（「幾段」「幾份」這種<strong>數量</strong>可以比 3 大）。',",
      replace:"的比大小在<strong>「通分加減」</strong>；把 1/4 這種分數<strong>換寫成小數</strong>在<strong>五年級「小數商店」</strong>。這張卡上<strong>畫出來的</strong>整數只到 3、分母只用 2 到 10，不用負數（「幾段」「幾份」這種<strong>數量</strong>可以比 3 大）。',",
      why:'the cheat sheet would name a grade-5 topic without saying it is grade 5' },

    /* --- review.html 的產生器 --- */
    { file:'review', via:'index', expect:'no longer declares the generator "totalParts"',
      find:"    { id:'totalParts', cat:'unit',",
      replace:"    { id:'totalPartsX', cat:'unit',",
      why:'a renamed generator would silently lose its invariants' },
    { file:'review', via:'index', expect:'no longer uses the same 460x70 canvas',
      find:'  var FIG_W = 460, FIG_H = 70;',
      replace:'  var FIG_W = 460, FIG_H = 90;',
      why:'the review figures would use a different canvas from the lesson page' },
    { file:'review', via:'index', expect:'no longer takes the figure viewBox from the plan',
      find:"        var svg = svgEl('svg', { 'class':'nlfig', viewBox:'0 0 ' + q.fig.w + ' ' + q.fig.h });",
      replace:"        var svg = svgEl('svg', { 'class':'nlfig', viewBox:'0 0 460 70' });",
      why:'the viewBox would stop following the plan it draws' },
    { file:'review', via:'review', expect:'cancels down',
      find:"          if (gcd(k, d) !== 1) return null;\n          var right = fracText(k, d);\n          var opts = strOpts(right, [fracText(d, k), fracText(k, d + 1), fracText(k + 1, d), fracText(k - 1, d)]);",
      replace:"          var right = fracText(k, d);\n          var opts = strOpts(right, [fracText(d, k), fracText(k, d + 1), fracText(k + 1, d), fracText(k - 1, d)]);",
      why:'readProper would draw points with two correct readings' },
    { file:'review', via:'review', expect:'cancels down',
      find:"          if (gcd(r, d) !== 1) return null;\n          var k = w * d + r;",
      replace:"          var k = w * d + r;",
      why:'readMixed would draw points with two correct readings' },
    { file:'review', via:'review', expect:'the two points are the same',
      find:"          if (a === b) return null;\n          var hi = Math.max(a, b), lo = Math.min(a, b);",
      replace:"          var hi = Math.max(a, b), lo = Math.min(a, b);",
      why:'compareOnLine would ask which of two identical points is bigger' },
    { file:'review', via:'review', expect:'the answer equals the denominator',
      find:"          if (n === d) return null;                    /* 正解會等於「分母」那個誘答 */",
      replace:"          /* 正解會等於「分母」那個誘答 */",
      why:'partsToMark would offer the answer twice' },
    /* ⚠️ interDecMax 的「最大的只有一個」與「四個值互不相同」這兩條不變條件
       **沒有獨立的改壞測試**：那一支的抽樣空間（一個非 10 倍數 ＋ 三個相鄰的 10 倍數）
       在數學上就產生不出違反它們的資料，任何一種改壞都會被 make() 的重抽吸收掉。
       它們留在 INVARIANTS 裡是為了「以後有人改抽樣方式」，而不是現在有人在守 ——
       這一點寫在這裡，不要讓下一個人以為那兩條被證明過。 */
    { file:'review', via:'review', expect:'the drawing shows',
      find:"          return { M:1, d:d, k:k, opts:opts, ans:opts.indexOf(right), fig:linePlan(1, d, k) };",
      replace:"          return { M:1, d:d, k:k, opts:opts, ans:opts.indexOf(right), fig:linePlan(1, d, k + 1) };",
      why:'the picture would mark a different point from the one the options answer' },
    { file:'review', via:'review', expect:'would land on a whole number',
      find:"          var r = pick(rangeList(1, 9));\n          var k = w * 10 + r;",
      replace:"          var r = pick(rangeList(0, 9));\n          var k = w * 10 + r;",
      why:'the tenths round could land on a whole number, where the decimal is not the point' },
    { file:'review', via:'review', expect:'must say',
      find:"            ? '圖上這個點是多少？<strong>用帶分數寫</strong>。（一格被平分成 <strong>' + d.d + ' 份</strong>）'",
      replace:"            ? '圖上這個點是多少？（一格被平分成 <strong>' + d.d + ' 份</strong>）'",
      why:'without "write it as a mixed number" the improper fraction is equally correct' },
    { file:'review', via:'review', expect:'outside this lesson',
      find:"          var opts = strOpts(right, [k + '.0', w + '.0' + r, tenthText(w * 10 + wrongR), '0.1']);",
      replace:"          var opts = strOpts(right, [(k + 100) + '.0', w + '.0' + r, tenthText(w * 10 + wrongR), '0.1']);",
      why:'a distractor would be a number far outside the line the child is looking at' },
    { file:'review', via:'review', expect:'the "count the marks" distractor is missing',
      find:"          var opts = numOpts(segs, [segs + 1, (M + 1) * d, segs - 1, segs + d]);",
      replace:"          var opts = numOpts(segs, [(M + 1) * d, segs - 1, segs + d, segs + 2]);",
      why:'the misconception this question exists to test would stop being offered' },
    /* --- 第四輪補上的三筆：死字串充數、每一個點都要在範圍內、review 的主線接線 --- */
    /* ⚠️ 這一筆是**平衡**的改壞：把畫面上那一句換掉，同時在旁邊放一個沒有人會渲染的
       死字串把次數補回來 —— 次數那一關因此完全沒有反應，只有「讀者看得到嗎」那一關會響。
       （單獨拿掉或單獨新增都會先撞到次數那一關，所以這一筆必須兩件事一起做。） */
    { file:'index', via:'index', expect:'not anywhere a reader would see it',
      find:"— so nothing here needs a common denominator or cancelling down.",
      replace:"— so nothing here requires a common denominator or cancelling down.', deadPin:'nothing here needs a common denominator",
      why:'the English scope sentence would stop saying it on screen while a dead JS string kept the count up' },
    { file:'review', via:'review', expect:'past the 3 whole numbers',
      find:"          var a = pick(rangeList(1, 2 * d - 1));\n          var b = pick(rangeList(1, 2 * d - 1));",
      replace:"          var a = pick(rangeList(1, 4 * d - 1));\n          var b = pick(rangeList(1, 4 * d - 1));",
      why:'compareOnLine would compare points past 3, which no line in this lesson can show' },
    { file:'review', via:'index', expect:'no longer wires the drawing to the plan',
      find:"      x1:plan.axis.x1, y1:plan.axis.y, x2:plan.axis.x2, y2:plan.axis.y,\n      stroke:C_AXIS, 'stroke-width':LINE_W",
      replace:"      x1:0, y1:plan.axis.y, x2:460, y2:plan.axis.y,\n      stroke:C_AXIS, 'stroke-width':LINE_W",
      why:'the review figures would draw the axis edge to edge instead of where the plan puts it' },
    /* --- 第三輪補上的四筆：plan → DOM 的接線、共用定義域守衛、圖上幾個點、四個選項 --- */
    { file:'index', via:'index', expect:'no longer wires the drawing to the plan',
      find:"      svg.appendChild(svgEl('circle', { cx:p.x, cy:p.y, r:p.r, fill:TONE[p.tone] }));",
      replace:"      svg.appendChild(svgEl('circle', { cx:50, cy:p.y, r:p.r, fill:TONE[p.tone] }));",
      why:'every point would be drawn on 0 while the plan the checker measures stayed correct' },
    { file:'index', via:'index', expect:'options are [',
      find:"<strong>一小段</strong>是多少？',\n          opts:['1/5', '5', '1/4', '5/5'], ans:0,",
      replace:"<strong>一小段</strong>是多少？',\n          opts:['1/5', '5', '1/3', '5/5'], ans:0,",
      why:'a distractor could be swapped for another plausible one without the oracle noticing' },
    { file:'review', via:'review', expect:'not one of the denominators',
      find:"          var d = pickUnused(DENS, used);\n          var a = pick(rangeList(1, 2 * d - 1));",
      replace:"          var d = pickUnused(DENS.concat([11]), used);\n          var a = pick(rangeList(1, 2 * d - 1));",
      why:'compareOnLine would leave the denominators this lesson draws' },
    { file:'review', via:'review', expect:'the figure marks 0 points',
      find:"          return { M:1, d:d, k:k, opts:opts, ans:opts.indexOf(right), fig:linePlan(1, d, k) };",
      replace:"          return { M:1, d:d, k:k, opts:opts, ans:opts.indexOf(right), fig:linePlan(1, d) };",
      why:'the picture would have no marked point, and the answer check only covers the one-point case' },
    /* --- 第二輪補上的四筆：英文那一邊的規則、甲乙的字、CSS 的屬性邊界 --- */
    { file:'index', via:'index', expect:'further left is the bigger one',
      find:"      s4note:'💬 <strong>On the same number line the point further right is the bigger one</strong>",
      replace:"      s4note:'💬 <strong>On the same number line the point further left is the bigger one</strong>",
      why:'the English rule would say the opposite of the Chinese one, and before this round nothing was watching the English wording' },
    { file:'index', via:'index', expect:'says "one step stands for 1"',
      find:'stays on the <strong>number line</strong>: one step stands for 1, cutting a step into',
      replace:'stays on the <strong>number line</strong>: one step means 1, cutting a step into',
      why:'the English premise would quietly stop being stated' },
    { file:'index', via:'index', expect:'expected "甲"',
      find:"    var t = (lang === 'zh') ? ['甲', '乙'] : ['A', 'B'];",
      replace:"    var t = (lang === 'zh') ? ['乙', '甲'] : ['A', 'B'];",
      why:'the two point letters would be swapped, so the prompt would name the wrong point' },
    { file:'index', via:'index', expect:'declares a plain height',
      find:'.nlfig{width:100%;max-width:460px;height:70px;display:block;margin:0 auto}',
      replace:'.nlfig{width:100%;max-width:460px;min-height:70px;display:block;margin:0 auto}',
      why:'a min-height is not a height, so the drawing would have no fixed box and the check must not accept it' },
    { file:'review', via:'review', expect:'the "read the denominator instead" distractor is missing',
      find:"          var opts = numOpts(n, [d, n + d, n + 1, n - 1]);",
      replace:"          var opts = numOpts(n, [n + d, n + 1, n - 1, n + 2]);",
      why:'the "count the denominator" misconception would stop being offered' }
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      unitPart: d => {
        const dom = domainProblems(d, 'unitPart');
        if (dom) return dom;
        if (DENS_REF.indexOf(d.d) < 0) return 'unitPart: d=' + d.d + ' is not a denominator this lesson uses';
        if (d.opts.length !== 4) return 'unitPart: options are not four';
        if (d.opts[d.ans] !== '1/' + d.d) return 'unitPart: opts[ans] is ' + d.opts[d.ans] + ', one part of ' + d.d + ' is 1/' + d.d;
      },
      countParts: d => {
        const dom = domainProblems(d, 'countParts');
        if (dom) return dom;
        if (DENS_REF.indexOf(d.d) < 0) return 'countParts: d=' + d.d + ' is not a denominator this lesson uses';
        if (!(d.k >= 2 && d.k <= d.d - 1)) return 'countParts: k=' + d.k + ' is not strictly inside one step (2..' + (d.d - 1) + ')';
        if (gcdRef(d.k, d.d) !== 1) return 'countParts: ' + d.k + '/' + d.d + ' cancels down, so the cancelled form would also be right';
        if (d.opts[d.ans] !== fracRef(d.k, d.d)) return 'countParts: opts[ans] is ' + d.opts[d.ans] + ', expected ' + fracRef(d.k, d.d);
      },
      readProper: d => {
        const dom = domainProblems(d, 'readProper');
        if (dom) return dom;
        if (d.M !== 1) return 'readProper: this generator always draws one step, got M=' + d.M;
        if (!(d.k >= 2 && d.k <= d.d - 1)) return 'readProper: k=' + d.k + ' is not strictly inside the step';
        if (gcdRef(d.k, d.d) !== 1) return 'readProper: ' + d.k + '/' + d.d + ' cancels down, so the answer is not unique';
        if (d.opts[d.ans] !== fracRef(d.k, d.d)) return 'readProper: opts[ans] is ' + d.opts[d.ans];
        const meas = measurePlanRef(d.fig);
        if (meas.problems.length) return 'readProper: ' + meas.problems[0];
        if (meas.d !== d.d || meas.M !== 1 || meas.ks.join() !== String(d.k))
          return 'readProper: the drawing shows M=' + meas.M + ' d=' + meas.d + ' k=[' + meas.ks + '] but the data says M=1 d=' + d.d + ' k=' + d.k;
      },
      readMixed: d => {
        const dom = domainProblems(d, 'readMixed');
        if (dom) return dom;
        if (!(d.M >= 2 && d.M <= MAX_M_REF)) return 'readMixed: M=' + d.M + ' should be 2 or 3';
        if (!(d.w >= 1 && d.w <= d.M - 1)) return 'readMixed: the whole part ' + d.w + ' leaves no room to the right of the point';
        if (!(d.r >= 1 && d.r <= d.d - 2)) return 'readMixed: the remainder ' + d.r + ' must leave room for the "one part more" distractor';
        if (gcdRef(d.r, d.d) !== 1) return 'readMixed: ' + d.r + '/' + d.d + ' cancels down, so the answer is not unique';
        if (d.k !== d.w * d.d + d.r) return 'readMixed: k=' + d.k + ' does not match ' + d.w + ' whole steps plus ' + d.r + ' parts';
        if (d.opts[d.ans] !== mixedRef(d.k, d.d, 'zh')) return 'readMixed: opts[ans] is ' + d.opts[d.ans] + ', expected ' + mixedRef(d.k, d.d, 'zh');
        const meas = measurePlanRef(d.fig);
        if (meas.problems.length) return 'readMixed: ' + meas.problems[0];
        if (meas.d !== d.d || meas.M !== d.M || meas.ks.join() !== String(d.k))
          return 'readMixed: the drawing shows M=' + meas.M + ' d=' + meas.d + ' k=[' + meas.ks + ']';
      },
      betweenWhich: d => {
        const dom = domainProblems(d, 'betweenWhich');
        if (dom) return dom;
        const qr = divmodRef(d.k, d.d);
        if (!qr) return 'betweenWhich: cannot work out ' + d.k + ' ÷ ' + d.d;
        if (qr.q !== d.w || qr.r !== d.r) return 'betweenWhich: says ' + d.k + ' ÷ ' + d.d + ' is ' + d.w + ' remainder ' + d.r + ', repeated subtraction gives ' + qr.q + ' remainder ' + qr.r;
        if (qr.r === 0) return 'betweenWhich: the point lands exactly on a whole number, so "between" has no answer';
        if (!(d.w >= 0 && d.w <= 2)) return 'betweenWhich: the whole part ' + d.w + ' is not one of the three offered ranges';
        if (d.opts[d.ans] !== 'b' + d.w + (d.w + 1)) return 'betweenWhich: opts[ans] is ' + d.opts[d.ans];
        if (new Set(d.opts).size !== 4) return 'betweenWhich: duplicate option keys';
      },
      partsToMark: d => {
        const dom = domainProblems(d, 'partsToMark');
        if (dom) return dom;
        if (d.n === d.d) return 'partsToMark: the answer equals the denominator, so the misconception distractor IS the answer';
        if (!(d.n >= 2 && d.n <= 2 * d.d - 1)) return 'partsToMark: n=' + d.n + ' is outside this lesson (2..' + (2 * d.d - 1) + ')';
        if (d.opts[d.ans] !== d.n) return 'partsToMark: opts[ans] is ' + d.opts[d.ans] + ', expected ' + d.n;
        if (d.opts.indexOf(d.d) < 0) return 'partsToMark: the "read the denominator instead" distractor is missing';
      },
      compareOnLine: d => {
        const dom = domainProblems(d, 'compareOnLine');
        if (dom) return dom;
        if (d.a === d.b) return 'compareOnLine: the two points are the same, so neither is bigger';
        if (d.hi !== Math.max(d.a, d.b) || d.lo !== Math.min(d.a, d.b)) return 'compareOnLine: hi/lo do not match a and b';
        if (d.opts[d.ans] !== fracRef(d.hi, d.d)) return 'compareOnLine: opts[ans] is ' + d.opts[d.ans] + ', the further-right point is ' + fracRef(d.hi, d.d);
        if (d.opts.indexOf('same') < 0) return 'compareOnLine: the "they are the same" distractor is missing';
      },
      wholeOnLine: d => {
        const dom = domainProblems(d, 'wholeOnLine');
        if (dom) return dom;
        if (DENS_REF.indexOf(d.d) < 0) return 'wholeOnLine: d=' + d.d + ' is not a denominator this lesson uses';
        if (d.segs !== d.m * d.d) return 'wholeOnLine: segs=' + d.segs + ' is not ' + d.m + ' × ' + d.d;
        if (d.segs > MAX_SEGS_REF) return 'wholeOnLine: ' + d.segs + ' parts is more than this lesson draws';
        if (d.opts[d.ans] !== d.m) return 'wholeOnLine: opts[ans] is ' + d.opts[d.ans] + ', expected ' + d.m;
        if (d.opts.indexOf(d.segs) < 0) return 'wholeOnLine: the "answer with the number of parts" distractor is missing';
      },
      marksVsParts: d => {
        const dom = domainProblems(d, 'marksVsParts');
        if (dom) return dom;
        if (d.g !== d.d - 1) return 'marksVsParts: ' + d.g + ' marks in the middle do not cut a step into ' + d.d + ' parts';
        if (d.opts[d.ans] !== d.d) return 'marksVsParts: opts[ans] is ' + d.opts[d.ans] + ', expected ' + d.d;
        if (d.opts.indexOf(d.g) < 0) return 'marksVsParts: the "answer with the number of marks" distractor is missing';
      },
      tenthsDecimal: d => {
        const dom = domainProblems(d, 'tenthsDecimal');
        if (dom) return dom;
        if (d.d !== 10) return 'tenthsDecimal: this lesson only writes a decimal when a step is cut into 10, got ' + d.d;
        if (!(d.r >= 1 && d.r <= 9)) return 'tenthsDecimal: r=' + d.r + ' would land on a whole number, and then the decimal is not the point';
        if (d.k !== d.w * 10 + d.r) return 'tenthsDecimal: k=' + d.k + ' does not match ' + d.w + ' whole steps plus ' + d.r + ' tenths';
        if (!(d.w >= 0 && d.w <= d.M - 1)) return 'tenthsDecimal: the point is outside the drawn line';
        if (d.opts[d.ans] !== tenthRef(d.k)) return 'tenthsDecimal: opts[ans] is ' + d.opts[d.ans] + ', expected ' + tenthRef(d.k);
        const meas = measurePlanRef(d.fig);
        if (meas.problems.length) return 'tenthsDecimal: ' + meas.problems[0];
        if (meas.d !== 10 || meas.ks.join() !== String(d.k))
          return 'tenthsDecimal: the drawing shows d=' + meas.d + ' k=[' + meas.ks + ']';
      },
      totalParts: d => {
        const dom = domainProblems(d, 'totalParts');
        if (dom) return dom;
        if (!(d.M >= 2 && d.M <= MAX_M_REF)) return 'totalParts: M=' + d.M + ' should be 2 or 3';
        if (d.segs !== d.M * d.d) return 'totalParts: segs=' + d.segs + ' is not ' + d.M + ' × ' + d.d;
        if (d.opts[d.ans] !== d.segs) return 'totalParts: opts[ans] is ' + d.opts[d.ans] + ', expected ' + d.segs;
        if (d.opts.indexOf(d.segs + 1) < 0) return 'totalParts: the "count the marks" distractor is missing';
      },
      interDecMax: d => {
        const dom = domainProblems(d, 'interDecMax');
        if (dom) return dom;
        if (d.cents.length !== 4) return 'interDecMax: there are not four decimals';
        if (Math.max.apply(null, d.cents) !== d.big) return 'interDecMax: big=' + d.big + ' is not the largest of [' + d.cents + ']';
        if (d.cents.filter(v => v === d.big).length !== 1) return 'interDecMax: two of the four are equally big, so "the biggest" has no single answer';
        if (!d.cents.some(v => v % 10 !== 0)) return 'interDecMax: every value is a one-place decimal, so padding with zeros is never needed';
        if (!d.cents.some(v => v % 10 === 0)) return 'interDecMax: no one-place decimal, so the different-length comparison is never exercised';
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算，
       完全不呼叫 review.html 的格式化函式。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'unitPart':      return '1/' + d.d;
        case 'countParts':    return fracRef(d.k, d.d);
        case 'readProper':    return fracRef(d.k, d.d);
        case 'readMixed':     return mixedRef(d.k, d.d, lang);
        case 'betweenWhich': {
          const qr = divmodRef(d.k, d.d);
          const T = (lang === 'zh')
            ? { 0:'0 和 1 之間', 1:'1 和 2 之間', 2:'2 和 3 之間' }
            : { 0:'between 0 and 1', 1:'between 1 and 2', 2:'between 2 and 3' };
          return qr ? T[qr.q] : null;
        }
        case 'partsToMark':   return lang === 'zh' ? (d.n + ' 段') : (d.n === 1 ? '1 part' : d.n + ' parts');
        case 'compareOnLine': return fracRef(Math.max(d.a, d.b), d.d);
        case 'wholeOnLine':   return String(d.m);
        case 'marksVsParts':  return lang === 'zh' ? (d.d + ' 份') : (d.d === 1 ? '1 part' : d.d + ' parts');
        case 'tenthsDecimal': return tenthRef(d.k);
        case 'totalParts':    return lang === 'zh' ? (d.segs + ' 段') : (d.segs === 1 ? '1 part' : d.segs + ' parts');
        case 'interDecMax': {
          const w = Math.floor(d.big / 100), rest = d.big % 100;
          if (rest === 0) return String(w);
          if (rest % 10 === 0) return w + '.' + (rest / 10);
          return w + '.' + (rest < 10 ? '0' + rest : String(rest));
        }
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣：分數／帶分數／小數／整數＋單位／固定的整句話。 */
    optionOk: function(s, genId, lang, isCorrect){
      const t = String(s).trim();
      if (!t) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
      if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
      if (lang === 'en' && /[㐀-鿿]/.test(t)) return 'English option contains Chinese: ' + t;
      const PHRASES = {
        zh:['0 和 1 之間', '1 和 2 之間', '2 和 3 之間', '剛好在 1', '一樣大', '要先換成小數才知道'],
        en:['between 0 and 1', 'between 1 and 2', 'between 2 and 3', 'exactly on 1',
            'they are the same', 'you have to turn them into decimals first']
      };
      if (PHRASES[lang].indexOf(t) >= 0) return null;
      const bare = t.replace(/ (?:段|份)$/, '').replace(/ (?:parts?)$/, '');
      const v = ratRef(bare);
      if (!v) return 'option is not a number this lesson prints: ' + t;
      if (!(v.n >= 0 && v.n <= 400 && v.d >= 1 && v.d <= 1000)) return 'option is outside this lesson (' + t + ')';
      if (v.d !== 1 && v.n / v.d > 20) return 'option ' + t + ' is far outside the 0..3 range this lesson draws';
      if (/^\d+\.\d\d\d/.test(bare)) return 'option ' + t + ' has more than two decimal places';
      /* 帶單位的選項一定是整數（段數／份數），不可以是分數。 */
      if (/(?: 段| 份| parts?)$/.test(t) && v.d !== 1) return 'a count of parts must be a whole number: ' + t;
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次：值去重、圖與答案一致、宣稱都算對。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length !== 4) out.push('there are ' + q.opts.length + ' options, not four');
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');
      /* ⚠️ 值去重：3/4 和 1 又 3/4、7/10 和 0.7 字串不同、值一樣。 */
      const keys = q.opts.map(optKeyRef);
      for (let i = 0; i < keys.length; i++)
        for (let j = i + 1; j < keys.length; j++)
          if (keys[i] === keys[j]) out.push('two options are the same number: ' + q.opts[i] + ' / ' + q.opts[j]);
      /* 題幹與解釋裡的每一條宣稱都要算對。 */
      const cl = claimProblems(q.stem + ' ' + q.why);
      cl.problems.forEach(m => out.push(m));
      /* 渲染出來的字串本身 */
      stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
      stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
      q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
      /* 有圖的題目：圖必須畫得下，而且量回來的 (M, d, k) 要和答案一致。 */
      if (q.fig){
        canvasProblems(svgOfRef(q.fig)).forEach(m => out.push('canvas: ' + m));
        const meas = measurePlanRef(q.fig);
        meas.problems.forEach(m => out.push('figure: ' + m));
        /* ⚠️ 下面「圖上標的點要等於正解」那一條只處理**一個點**的圖。所以這裡先擋住
           「圖上有 0 個或 2 個點」—— 不然哪一天有人加一張兩個點的圖，答案的比對會被
           整條跳過而沒有人響（codex 第三輪）。 */
        if (meas.ks.length !== 1)
          out.push('the figure marks ' + meas.ks.length + ' points; every review figure in this lesson marks exactly one, and the answer check only covers that case');
        if (!meas.problems.length && meas.ks.length === 1){
          const shown = ratRef(fracRef(meas.ks[0], meas.d));
          const marked = ratRef(String(q.opts[q.ans]).replace(/ 又 /, ' '));
          if (genId !== 'betweenWhich' && marked && !ratEq(shown, marked))
            out.push('the drawing marks ' + fracRef(meas.ks[0], meas.d) + ' but the correct option says ' + q.opts[q.ans]);
        }
        if (/<text/.test(svgOfRef(q.fig))){
          const long = (svgOfRef(q.fig).match(/<text[^>]*>([^<]*)<\/text>/g) || [])
            .map(m => /<text[^>]*>([^<]*)<\/text>/.exec(m)[1])
            .filter(x => [...x].length !== 1);
          if (long.length) out.push('a label in the figure is more than one character ("' + long[0] + '") — this lesson keeps every figure label to a single character so nothing can be clipped');
        }
      } else if (['readProper', 'readMixed', 'tenthsDecimal'].indexOf(genId) >= 0){
        out.push('this generator asks the child to read a point off a picture, but no figure was produced');
      }
      /* 用帶分數作答的題目一定要在題幹裡說清楚，不然假分數也是對的。 */
      if (genId === 'readMixed'){
        const cue = (lang === 'zh') ? '用帶分數寫' : 'as a mixed number';
        if (q.stem.indexOf(cue) < 0)
          out.push('a "read the point" question answered with a mixed number must say "' + cue + '" in the stem, or the improper fraction is equally correct');
      }
      if (genId === 'tenthsDecimal'){
        const cue = (lang === 'zh') ? '小數' : 'as a decimal';
        if (q.stem.indexOf(cue) < 0) out.push('the stem must ask for the answer "' + cue + '"');
      }
      return out.length ? out.join('; ') : null;
    },

    /* 刻意的迷思誘答：把題幹裡的那一個數字放進選項。⚠️ 這是**每一支產生器、每一個值**
       各自放行的謂詞，不是整支產生器全開 —— 不小心抄回別的數字還是要被抓到。
       ⚠️ 只有選項是**裸數字**的兩支需要放行：`partsToMark` 與 `marksVsParts` 的選項
       都帶單位（「5 段」／「5 份」），永遠不會被當成題幹裡的那個數字，所以不列在這裡。 */
    stemEchoOk: {
      /* 「一小段是多少」把**份數**當長度是這一課的頭號迷思。 */
      unitPart: function(d, opt){ return Number(opt) === d.d; },
      /* 「數了 12 段走到哪個整數」答出**段數**、或答出**一格幾份**，兩個都是要練的迷思。 */
      wholeOnLine: function(d, opt){ return Number(opt) === d.segs || Number(opt) === d.d; }
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{FIG_W, FIG_H, SPAN, X0, LINE_Y, END_OVER, TICK_BIG, TICK_SMALL, LBL_FS, LBL_DY, ' +
                'MARK_FS, MARK_DY, DOT_R, LINE_W, TICK_W, HILITE_W, unitPx, segPx, xAt, ' +
                'wholeOf, remOf, fracText, mixedText, tenthText, linePlan, ' +
                'W1_M, W1_STEPS, warmSpec, S1_DENS, splitSpec, S2_CASES, S2_STEPS, spanFor, markSpec, ' +
                'S3_CASES, S3_STEPS, readSpec, S4_CASES, cmpSpec, cmpWinner, S5_M, S5_D, S5_KS, decSpec, ' +
                'plEn, GAME_ORDER, GAME_W, shuffle, pick, GL, glX, gameText, GAME_TILE, TILE_DENS, TILE_G, tileLen, tileTray, ' +
                'GAME_PIN, PIN_G, pinDock, pinWhy, GAME_READ, READ_G, readWant, readWhy, GAME_SORT, SORT_G, sortX, GAME_NAME, NAME_G, nameTarget}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器自己先過 PROBE（零誤報 ＋ 一定要抓到） ---- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = claimProblems(pr.text).problems.length > 0;
        if (caught !== pr.bad)
          fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"');
      });

      /* ---- 1. 版面常數必須等於這份設定獨立寫死的第二份 ---- */
      const CONSTS = { FIG_W:FIG_W_REF, FIG_H:FIG_H_REF, SPAN:SPAN_REF, X0:X0_REF, LINE_Y:LINE_Y_REF,
                       END_OVER:END_OVER_REF, TICK_BIG:TICK_BIG_REF, TICK_SMALL:TICK_SMALL_REF,
                       LBL_FS:LBL_FS_REF, LBL_DY:LBL_DY_REF, MARK_FS:MARK_FS_REF, MARK_DY:MARK_DY_REF,
                       DOT_R:DOT_R_REF, LINE_W:LINE_W_REF, TICK_W:TICK_W_REF, HILITE_W:HILITE_W_REF };
      Object.keys(CONSTS).forEach(k => {
        if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ' but the reference says ' + CONSTS[k]);
      });
      /* ⚠️ 掃之前要先把註解拿掉：把期望的字串貼進一段註解就能滿足「有幾個」，
         而畫面上那一個其實已經被改掉了（chain-divide 的 `.packfig` 同一個坑）。 */
      /* ⚠️ 也要拿掉 `//` 行註解（把期望的 viewBox 字串貼進一行 `//` 註解就能充數，
         codex 第二輪）。`://` 不算註解，不然網址會被吃掉。 */
      const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n')
                         .replace(/\/\*[\s\S]*?\*\//g, '\n')
                         .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const vbs = liveSrc.match(/viewBox\s*=\s*['\"][^'\"]*['\"]/g) || [];
      if (vbs.length !== 6) fail('index.html has ' + vbs.length + ' number-line canvases, expected 6 (the game draws on its own board)');
      vbs.forEach(v => {
        /* 比的是**四個數的值**，不是字面：空白、逗號、單／雙引號、`180.0` 都算同一件事
           （codex 第三、四輪各推一次）。 */
        const nums = (v.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (nums.length !== 4 || nums[0] !== 0 || nums[1] !== 0 || nums[2] !== FIG_W_REF || nums[3] !== FIG_H_REF)
          fail('a canvas viewBox is ' + v + ', expected 0 0 ' + FIG_W_REF + ' ' + FIG_H_REF);
      });
      /* ⚠️ CSS 要讀**最後生效**的那一條：只讀第一條規則的話，後面再宣告一次
         `.nlfig{height:120px}` 就會蓋掉它而檢查毫無反應。剛好一條規則、
         規則裡剛好一個 height。 */
      const nlRules = liveSrc.match(/\.nlfig\s*\{[^}]*\}/g) || [];
      if (nlRules.length !== 1)
        fail('index.html declares the .nlfig rule ' + nlRules.length + ' time(s); with more than one the last one wins and this check would read the wrong height');
      else {
        /* ⚠️ 屬性要有邊界：`min-height:148px` 不是 `height`（codew 第二輪）。
           宣告的開頭只能是 `{` 或 `;`。 */
        const hs = nlRules[0].match(/[{;]\s*height:\s*(\d+)px/g) || [];
        if (hs.length !== 1) fail('the .nlfig rule declares a plain height ' + hs.length + ' time(s), expected exactly 1');
        else {
          const h = Number(/height:\s*(\d+)px/.exec(hs[0])[1]);
          if (h !== CSS_H_REF) fail('.nlfig is ' + h + 'px tall in CSS but the viewBox is ' + FIG_H_REF + ' — the drawing would be letterboxed');
        }
      }

      /* ---- 2. 兩套「寫法」的實作要完全相同（窮舉整個定義域） ---- */
      let pairs = 0;
      for (let M = 1; M <= MAX_M_REF; M++){
        for (const d of [1].concat(DENS_REF)){
          if (M * d > MAX_SEGS_REF) continue;
          for (let k = 0; k <= M * d; k++){
            pairs++;
            const qr = divmodRef(k, d);
            if (data.wholeOf(k, d) !== qr.q) fail('wholeOf(' + k + ',' + d + ')=' + data.wholeOf(k, d) + ', repeated subtraction gives ' + qr.q);
            if (data.remOf(k, d) !== qr.r) fail('remOf(' + k + ',' + d + ')=' + data.remOf(k, d) + ', repeated subtraction gives ' + qr.r);
            if (data.fracText(k, d) !== fracRef(k, d)) fail('fracText(' + k + ',' + d + ')=' + data.fracText(k, d));
            for (const lang of ['zh', 'en'])
              if (data.mixedText(k, d, lang) !== mixedRef(k, d, lang))
                fail('mixedText(' + k + ',' + d + ',' + lang + ')=' + data.mixedText(k, d, lang) + ', expected ' + mixedRef(k, d, lang));
            if (d === 10 && data.tenthText(k) !== tenthRef(k)) fail('tenthText(' + k + ')=' + data.tenthText(k) + ', expected ' + tenthRef(k));
            if (data.xAt(M, d, k) !== pxRef(M, d, k)) fail('xAt(' + M + ',' + d + ',' + k + ')=' + data.xAt(M, d, k) + ', accumulating gives ' + pxRef(M, d, k));
          }
          if (data.segPx(M, d) !== segPxRef(M, d)) fail('segPx(' + M + ',' + d + ')=' + data.segPx(M, d));
          if (data.unitPx(M) !== SPAN_REF / M) fail('unitPx(' + M + ')=' + data.unitPx(M));
        }
      }
      if (pairs !== 176) fail('only ' + pairs + ' (M, d, k) triples were compared, the domain has 176 — the sweep is not covering it');
      /* spanFor：整除時就是商，除不盡時要多留一格才看得到點右邊的那個整數。 */
      for (let d = 2; d <= 10; d++){
        for (let n = 1; n <= 30; n++){
          const qr = divmodRef(n, d);
          const want = (qr.r === 0) ? Math.max(1, qr.q) : qr.q + 1;
          if (data.spanFor(n, d) !== want) fail('spanFor(' + n + ',' + d + ')=' + data.spanFor(n, d) + ', expected ' + want);
        }
      }

      /* ---- 3. 每一張圖 ---- */
      allSpecs(data).forEach(s => planProblems(s.tag, data, data.linePlan(s.spec), s.want).forEach(fail));

      /* ---- 4. 範例的教學內容 ---- */
      if (data.W1_M !== 3) fail('the warm-up line should run 0..3, got M=' + data.W1_M);
      if (data.W1_STEPS !== 4) fail('the warm-up should offer 4 steps (0..3), got ' + data.W1_STEPS);
      if (data.S1_DENS.join(',') !== S1_DENS_REF.join(',')) fail('the "cut a step" chips are [' + data.S1_DENS + '], the reference says [' + S1_DENS_REF + ']');
      if (data.S1_DENS.indexOf(10) < 0) fail('example 1 never cuts a step into 10, so example 5 arrives with no groundwork');
      /* 標出一個分數：真分數與假分數都要有，而且點要落在畫出來的線上 */
      let proper = 0, improper = 0;
      data.S2_CASES.forEach(cs => {
        const M = data.spanFor(cs.n, cs.d);
        if (cs.n > M * cs.d) fail('S2 ' + cs.id + ': the point ' + cs.n + '/' + cs.d + ' is off the right end of its own line');
        if (DENS_REF.indexOf(cs.d) < 0) fail('S2 ' + cs.id + ': d=' + cs.d + ' is not a denominator this lesson draws');
        if (cs.n < cs.d) proper++; else improper++;
      });
      if (!proper) fail('S2 has no proper fraction, so "not one whole step yet" is never shown');
      if (!improper) fail('S2 has no improper fraction, so "past 1" is never shown');
      /* 讀出一個點：答案必須唯一 —— 餘數不可以是 0（那是整數），也不可以和分母有公因數 */
      let readProper = 0, readMixed = 0;
      data.S3_CASES.forEach(cs => {
        const qr = divmodRef(cs.k, cs.d);
        if (cs.k > cs.M * cs.d) fail('S3 ' + cs.id + ': the point is off the right end of its line');
        if (qr.r === 0) fail('S3 ' + cs.id + ': the point lands on a whole number, so "how many parts from the left whole number" has no answer');
        else if (gcdRef(qr.r, cs.d) !== 1)
          fail('S3 ' + cs.id + ': ' + qr.r + '/' + cs.d + ' cancels down, so the cancelled form would also be a correct reading and this lesson does not cancel down');
        if (qr.q === 0) readProper++; else readMixed++;
      });
      if (!readProper) fail('S3 never asks the child to read a point between 0 and 1');
      if (!readMixed) fail('S3 never asks the child to read a point past 1');
      /* 誰比較大：正解不可以每一次都同一邊 */
      let winA = 0, winB = 0;
      data.S4_CASES.forEach(cs => {
        if (cs.a === cs.b) fail('S4 ' + cs.id + ': the two points are the same, so neither is bigger');
        const want = cs.a > cs.b ? 'a' : (cs.b > cs.a ? 'b' : 'same');
        if (data.cmpWinner(cs) !== want) fail('S4 ' + cs.id + ': cmpWinner says ' + data.cmpWinner(cs) + ', the parts say ' + want);
        if (cs.a > cs.M * cs.d || cs.b > cs.M * cs.d) fail('S4 ' + cs.id + ': a point is off the right end of its line');
        if (want === 'a') winA++; else winB++;
      });
      if (!winA || !winB) fail('every S4 pair is won by the same side (' + winA + ' vs ' + winB + '), so a child can score by always picking one letter');
      /* 一格切成 10 份 */
      if (data.S5_M !== S5_M_REF || data.S5_D !== S5_D_REF) fail('the tenths line is M=' + data.S5_M + ' d=' + data.S5_D + ', the reference says M=' + S5_M_REF + ' d=' + S5_D_REF);
      if (data.S5_KS.join(',') !== S5_KS_REF.join(',')) fail('the tenths chips are [' + data.S5_KS + '], the reference says [' + S5_KS_REF + ']');
      if (!data.S5_KS.some(k => k % 10 === 0)) fail('no tenths case lands on a whole number, so "whole numbers live on this line too" is never shown');
      if (!data.S5_KS.some(k => k < 10)) fail('no tenths case sits between 0 and 1');
      if (!data.S5_KS.some(k => k > 10 && k % 10 !== 0)) fail('no tenths case is past 1 with a fraction part, so 1.4 style decimals are never shown');

      /* ---- 5. 遊戲的五關（§六之五：五種玩法；見 gameChecks） ---- */
      gameChecks(data, I18N, fail, src);

      /* ---- 6. 題庫：題幹逐字釘死，正解由這份設定的表決定 ---- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const ref = BANK[bank];
        if (!ref){ fail('no oracle for ' + bank); return; }
        ['zh', 'en'].forEach(lang => {
          const list = I18N[lang][bank];
          if (!list){ fail(bank + ' is missing in ' + lang); return; }
          if (list.length !== ref.length) fail(bank + ' (' + lang + ') has ' + list.length + ' questions, the oracle has ' + ref.length);
        });
        ref.forEach((r, i) => {
          ['zh', 'en'].forEach(lang => {
            const q = (I18N[lang][bank] || [])[i];
            if (!q){ fail(bank + '[' + i + '] is missing in ' + lang); return; }
            if (q.stem !== r.stemExact[lang]) fail(bank + '[' + i + '] (' + lang + ') stem does not match the oracle word for word');
            if (q.ans !== r.ans) fail(bank + '[' + i + '] (' + lang + ') ans is ' + q.ans + ', the oracle says ' + r.ans);
            if (q.opts.length !== 4) fail(bank + '[' + i + '] (' + lang + ') has ' + q.opts.length + ' options');
            if (q.opts[q.ans] !== r.expect[lang]) fail(bank + '[' + i + '] (' + lang + ') marks "' + q.opts[q.ans] + '" correct, the oracle says "' + r.expect[lang] + '"');
            /* ⚠️ 四個選項也要逐字比：只釘正解的話，把一個誘答換成**另一句也對的話**
               （例如把「剛好在 4」換成「大於 1 且小於 2」）字串不同、值也比不出來，
               可是那一題就有兩個講得通的答案了（codex 第三輪）。
               ⚠️ 這一欄本來是「宣告了卻沒有人讀」的死資料 —— 加欄位要順手接上去。 */
            if (q.opts.join(' | ') !== r.optsExact[lang].join(' | '))
              fail(bank + '[' + i + '] (' + lang + ') options are [' + q.opts.join(' | ') +
                   '], the oracle pins [' + r.optsExact[lang].join(' | ') + ']');
            const keys = q.opts.map(optKeyRef);
            for (let x = 0; x < keys.length; x++)
              for (let y = x + 1; y < keys.length; y++)
                if (keys[x] === keys[y]) fail(bank + '[' + i + '] (' + lang + ') two options are the same answer: ' + q.opts[x] + ' / ' + q.opts[y]);
            if (!q.why || !q.why.trim()) fail(bank + '[' + i + '] (' + lang + ') has no explanation');
          });
        });
      });
      const spread = {};
      ['qs', 'qsAdv', 'qsBoost'].forEach(b => (I18N.zh[b] || []).forEach(q => { spread[q.ans] = (spread[q.ans] || 0) + 1; }));
      if (Object.keys(spread).length < 3) fail('the correct answer sits in fewer than three different option slots');

      /* ---- 7. 渲染出來的每一個字串：宣稱都算對、字串本身乾淨 ---- */
      const strings = narratedStrings(data, I18N);
      /* ⚠️ 「至少幾條」數的是**呼叫次數**，不是「畫面上真的有字」：一句旁白回空字串
         也照樣算一條（codex 第一輪）。所以條數要釘死，而且每一條都要非空。 */
      if (strings.length !== NARRATED_COUNT_REF)
        fail('the page renders ' + strings.length + ' strings, the oracle pins ' + NARRATED_COUNT_REF +
             ' — add or remove a narration and this number must be re-pinned');
      strings.forEach(s => {
        if (typeof s.text !== 'string' || !s.text.trim())
          fail(s.tag + ' (' + s.lang + ') rendered nothing — an empty narration looks identical to a passing one');
      });
      const claims = [];
      strings.forEach(s => {
        if (typeof s.text !== 'string'){ return; }   /* 上面已經報過了 */
        stringProblems(s.text, s.lang, s.tag + ' (' + s.lang + ')').forEach(fail);
        const cl = claimProblems(s.text);
        cl.problems.forEach(m => fail(s.tag + ' (' + s.lang + '): ' + m));
        cl.verified.forEach(v => claims.push(v));
      });
      const uniqClaims = [...new Set(claims)].sort();
      const fp = crypto.createHash('sha1').update(uniqClaims.join(' | ')).digest('hex');
      if (CLAIMS_VERIFIED_REF === null || CLAIMS_FP_REF === null){
        fail('the claim oracle is not pinned yet: verified=' + uniqClaims.length + ' fingerprint=' + fp);
      } else {
        if (uniqClaims.length !== CLAIMS_VERIFIED_REF)
          fail('the page states ' + uniqClaims.length + ' distinct arithmetic claims, the oracle pins ' + CLAIMS_VERIFIED_REF);
        if (fp !== CLAIMS_FP_REF)
          fail('the set of arithmetic claims on the page changed (fingerprint ' + fp + ' vs ' + CLAIMS_FP_REF + ')');
      }

      /* ---- 8. 四頁的措辭 ----
         ⚠️ 路徑要從 process.argv[2] 推：用 __dirname 會讀到**真的 repo**，
         改壞測試複製出去的那一份永遠不會被看到，斷言就變成永遠是綠的。 */
      const dir = path.dirname(process.argv[2]);
      const SRC = {}, TEXT = {}, RAW = {};
      ['index', 'reference', 'review', 'parents'].forEach(f => {
        const fp2 = path.join(dir, f + '.html');
        if (!fs.existsSync(fp2)){ fail(f + '.html is missing, so its wording was never checked'); return; }
        const raw = fs.readFileSync(fp2, 'utf8');
        RAW[f] = raw;                      /* 切程式區塊要用原始碼：剝掉註解連標記本身都會不見 */
        SRC[f] = stripComments(raw);       /* 結構掃描用 */
        TEXT[f] = readerText(raw);         /* 詞語比對用 */
      });
      /* plan → DOM 的接線（見 RENDER_PINS 上面那一段註解：這是字面掃描）。 */
      RENDER_PINS.forEach(pin => {
        const code = SRC[pin.file];
        if (code === undefined) return;
        let count = 0, at = -1;
        while ((at = code.indexOf(pin.text, at + 1)) >= 0) count++;
        if (count < pin.min)
          fail(pin.file + '.html no longer wires the drawing to the plan the checker measures: "' +
               pin.text.slice(0, 56) + '…" appears ' + count + ' time(s), expected at least ' + pin.min);
      });
      /* ⚠️ 光數「原始碼裡出現幾次」擋不住「把畫面上那一句刪掉、在別處放一個死的 JS 字串」
         （codex 第一、四輪都指出來）。所以除了次數，再要求它**真的在讀者看得到的地方**：
         - index.html：出現在 markup 區（`var I18N = {` 之前），或出現在**渲染出來的字串**裡
           （`narratedStrings()` 是真的把字典函式跑出來的結果 —— 那就是畫面上的字）；
         - 其餘三頁：markup 區或字典區各自都要有（那兩區的邊界是 `var I18N = {`）。
         ⚠️ 殘留的極限：字典區**裡面**一個沒有人引用的鍵仍然可以充數。要完全關掉這個洞，
         得把那三頁的字典也跑起來 —— 這一輪沒有做，寫在這裡不要讓下一個人以為做了。 */
      const renderedAll = strings.map(x => String(x.text)).join('\n');
      SIBLING_RULES.forEach(rule => {
        const text = TEXT[rule.file];
        if (text === undefined) return;
        let count = 0, at = -1;
        while ((at = text.indexOf(rule.text, at + 1)) >= 0) count++;
        if (count !== rule.min)
          fail(rule.file + '.html says "' + rule.text + '" ' + count + ' time(s), the oracle pins ' + rule.min + ' — it ' + rule.why);
        const raw = RAW[rule.file];
        if (raw === undefined) return;
        const split = raw.indexOf('var I18N = {');
        const markupPart = readerText(split > 0 ? raw.slice(0, split) : raw);
        const dictPart = readerText(split > 0 ? raw.slice(split) : '');
        const inMarkup = markupPart.indexOf(rule.text) >= 0;
        const live = (rule.file === 'index')
          ? (inMarkup || renderedAll.indexOf(rule.text) >= 0)
          : (inMarkup || dictPart.indexOf(rule.text) >= 0);
        if (!live)
          fail(rule.file + '.html has "' + rule.text + '" in its source but not anywhere a reader would see it — a dead string cannot stand in for the rule');
      });
      FORBIDDEN.forEach(rule => {
        const text = TEXT[rule.file];
        if (text === undefined) return;
        if (text.indexOf(rule.text) >= 0)
          fail(rule.file + '.html says "' + rule.text + '", which ' + rule.why);
      });
      HANDOFF.forEach(rule => {
        ['index', 'reference', 'review', 'parents'].forEach(f => {
          const text = TEXT[f];
          if (text === undefined) return;
          let at = -1;
          while ((at = text.indexOf(rule.word, at + 1)) >= 0){
            /* ⚠️ 固定寬度的窗口會被**別的句子**裡的年級字樣滿足（第一版就是這樣：
               把「五年級「通分加減」」的年級拿掉之後，後面另一句的「五年級」
               替它背書）。所以窗口要**貼著子句**：那個詞所在子句剩下的部分，
               外加它前面十幾個字（讓「五年級「通分加減」」這種前置寫法也算）。 */
            const clause = text.slice(at, at + 160).split(/[；。;!?]/)[0];
            const before = text.slice(Math.max(0, at - 14), at);
            if (!rule.near.some(n => clause.indexOf(n) >= 0 || before.indexOf(n) >= 0))
              fail(f + '.html mentions "' + rule.word + '" without saying where it belongs (expected one of ' + rule.near.join('/') + ' in the same clause)');
          }
        });
      });

      /* ---- 9. 產生器清單：把 review.html 的 GENS **真的跑起來**比 id ---- */
      const rv = RAW['review'];
      if (rv !== undefined){
        const i0 = rv.indexOf('/* ---------- 工具 ---------- */');
        const i1 = rv.indexOf('/* ---------- 出一批');
        if (i0 < 0 || i1 < 0 || i0 > i1) fail('cannot slice the generator block out of review.html');
        else {
          let GENS = null;
          try { GENS = new Function(rv.slice(i0, i1) + '\n; return GENS;')(); }
          catch (e){ fail('review.html generator block does not run on its own: ' + e.message); }
          if (GENS){
            const ids = GENS.map(g => g.id);
            GEN_IDS.forEach(id => { if (ids.indexOf(id) < 0) fail('review.html no longer declares the generator "' + id + '"'); });
            ids.forEach(id => { if (GEN_IDS.indexOf(id) < 0) fail('review.html declares an extra generator "' + id + '" that this config does not describe'); });
            if (ids.length !== GEN_IDS.length) fail('review.html has ' + ids.length + ' generators, expected ' + GEN_IDS.length);
            GENS.forEach(g => {
              if (typeof g.make !== 'function') fail('generator ' + g.id + ' has no make()');
              if (typeof g.fmt !== 'function') fail('generator ' + g.id + ' has no fmt()');
            });
          }
        }
        /* review 頁也要一格代表 1、也要說「數的是段」的那一套版面常數 */
        if (!/var FIG_W = 460, FIG_H = 70;/.test(rv)) fail('review.html no longer uses the same 460x70 canvas as the lesson page');
        const rvb = rv.match(/viewBox:'0 0 ' \+ q\.fig\.w \+ ' ' \+ q\.fig\.h/);
        if (!rvb) fail('review.html no longer takes the figure viewBox from the plan it drew');
      }
    }
  },

  SIBLING_RULES: SIBLING_RULES,
  FORBIDDEN: FORBIDDEN,
  HANDOFF: HANDOFF,
  GEN_IDS: GEN_IDS,
  RENDER_PINS: RENDER_PINS,
  BANK: BANK,
  CLAIM_PROBES: CLAIM_PROBES,
  claimProblems: claimProblems,
  ratRef: ratRef,
  optKeyRef: optKeyRef,
  measurePlanRef: measurePlanRef,
  svgOfRef: svgOfRef,
  pxRef: pxRef,
  mixedRef: mixedRef,
  tenthRef: tenthRef,
  divmodRef: divmodRef
};
