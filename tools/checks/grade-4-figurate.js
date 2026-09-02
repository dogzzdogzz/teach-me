/* grade-4/math/figurate —— 圖形數實驗室（三角形數與正方形數）
 *
 * 這一課的正確性有三塊，所以這份設定裡有三套**獨立重寫**的實作：
 *
 * 1) 兩種圖形數本身。課程頁走**公式**（n × n、n × (n ＋ 1) ÷ 2、k ＋ k － 1）；
 *    這裡的參考實作一律走**幾何**：把點的座標一個一個列舉出來再數。
 *    正方形數 ＝ 數 n × n 個格子；三角形數 ＝ 一排一排累加；
 *    第 k 個 L 形 ＝ 數 max(row, col) ＋ 1 剛好等於 k 的格子。
 *    兩條路對 n ＝ 1~40 逐一比對 —— 拿課程自己的公式當標準答案等於自己比自己。
 *
 * 2) 分類（這一串是三角形數／正方形數／每次加一樣多／都不是）。
 *    課程頁走「先問第一個是第幾個，再往前生成整串比對」；參考實作走
 *    **fit-and-regenerate**：四種模型分別套上去、各自從**幾何**重新生成整串、
 *    逐項比對，並回報**有幾種模型套得上**——「剛好一種」本身就是一條斷言。
 *    ⚠️ 這一條不是宣告，是窮舉證明：長度 3 以上、值 ≤ 200 的連續圖形數串
 *    與等差串全部掃過一次，外加一組手挑的對抗樣本。
 *
 * 3) 版面。課程頁從**左上角**算（x0 ＝ (W － cols × step) / 2，再加 (col ＋ 0.5) × step）；
 *    參考實作從**中心往外**算（cx ＝ W / 2 ＋ step × (col － (cols － 1) / 2)）。
 *    兩條路對每一張圖逐一比對，再用全站共用的 lib/canvas.js 驗四個邊。
 *
 * ⚠️ 這一課教的規則有前提，設定檔必須分開驗：
 *    「兩個一樣的三角形拼成 n × (n ＋ 1) 的長方形」不是文案，是**幾何事實** ——
 *    參考實作要求 side:'a' 與 side:'b' 的格子各剛好是第 n 個三角形數，
 *    而且兩者合起來剛好蓋滿整個 n × (n ＋ 1) 的格子，一格不多一格不少。
 * ⚠️ 「差一直在長大」也要真的驗：兩種圖形數的差必須嚴格遞增，
 *    而且「規律偵探社」的公式套下去一定**小於**真值（課程明講「算出來會太小」）。
 * ⚠️ 這一課不用負數、不用小數：每一個選項、每一個答案都是 1 ~ 200 的整數。
 */

const fs = require('fs');
const path = require('path');

const OPT_MAX_REF = 200;
const N_MAX_REF = 12;
const N_FIG_REF = 6;
const EPS = 1e-9;
function inRangeRef(v){
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 1 && v <= OPT_MAX_REF;
}

/* ---------- 1) 圖形數：走幾何，不走公式 ---------- */
/* 正方形數 ＝ n × n 個格子，一格一格數出來。 */
function sqRef(n){
  let c = 0;
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) c++;
  return c;
}
/* 三角形數 ＝ 一排一排累加（第 row 排有 row ＋ 1 個）。 */
function triRef(n){
  let c = 0;
  for (let row = 0; row < n; row++) c += row + 1;
  return c;
}
/* 第 k 個 L 形 ＝ 在 k × k 的格子裡，max(row, col) ＋ 1 剛好是 k 的那些格。 */
function gnomonRef(k){
  let c = 0;
  for (let row = 0; row < k; row++) for (let col = 0; col < k; col++)
    if (Math.max(row, col) + 1 === k) c++;
  return c;
}
/* 兩個第 n 個三角形拼成的長方形 ＝ n 排 × (n ＋ 1) 欄的格子數。 */
function rectRef(n){
  let c = 0;
  for (let row = 0; row < n; row++) for (let col = 0; col <= n; col++) c++;
  return c;
}
function oddSumRef(n){
  let s = 0;
  for (let k = 1; k <= n; k++) s += gnomonRef(k);
  return s;
}
/* 真值表：反過來問「第幾個」時用查表，不用課程頁那條往上掃的迴圈。 */
const REF_N = 60;
const SQ_TABLE = [];
const TRI_TABLE = [];
for (let n = 1; n <= REF_N; n++){ SQ_TABLE.push(sqRef(n)); TRI_TABLE.push(triRef(n)); }
function whichSqRef(v){ const i = SQ_TABLE.indexOf(v); return i < 0 ? -1 : i + 1; }
function whichTriRef(v){ const i = TRI_TABLE.indexOf(v); return i < 0 ? -1 : i + 1; }

function gapsRef(vals){
  const out = [];
  for (let i = 0; i + 1 < vals.length; i++) out.push(vals[i + 1] - vals[i]);
  return out;
}
function allSameRef(list){ return list.length > 0 && list.every(x => x === list[0]); }

/* ---------- 2) 分類：fit-and-regenerate ----------
   四種模型分別套上去，各自**從頭生成整串**再逐項比對。
   回傳套得上的模型清單 —— 「剛好一種」本身就是一條斷言，
   課程頁的 kindOf() 是「照順序試、先中先贏」，那種寫法在兩種都成立時會靜靜偏袒前面那一個。 */
function kindFitsRef(vals){
  const fits = [];
  if (vals.length >= 3){
    for (const pair of [['tri', TRI_TABLE], ['sq', SQ_TABLE]]){
      const name = pair[0], table = pair[1];
      const start = table.indexOf(vals[0]);
      if (start >= 0 && start + vals.length <= table.length){
        let ok = true;
        for (let i = 0; i < vals.length; i++) if (table[start + i] !== vals[i]) ok = false;
        if (ok) fits.push(name);
      }
    }
    if (allSameRef(gapsRef(vals))) fits.push('arith');
  }
  return fits;
}
function kindRef(vals){
  if (vals.length < 3) return 'short';
  const fits = kindFitsRef(vals);
  if (fits.length === 0) return 'other';
  /* 這裡刻意保留和頁面一樣的優先順序，好讓「剛好一種」那一條斷言分開驗。 */
  if (fits.indexOf('tri') >= 0) return 'tri';
  if (fits.indexOf('sq') >= 0) return 'sq';
  return 'arith';
}

/* ---------- 3) 版面：從中心往外算的第二套排版 ---------- */
/* 課程頁 460×300／PAD 22／STEP 42；速查卡 380×230／PAD 18／STEP 34；
   複習頁 340×210／PAD 16／STEP 30。規格在這裡**獨立寫死一份** ——
   只跟頁面自己的常數互相一致是不夠的，三個一起改成別的數字檢查還是綠的。 */
const FIG_REF = {
  index:  { W:460, H:300, PAD:22, STEP:42, RATIO:0.30 },
  ref:    { W:380, H:230, PAD:18, STEP:34, RATIO:0.30 },
  review: { W:340, H:210, PAD:16, STEP:30, RATIO:0.30 }
};

/* 一張圖該有哪些格子（row, col, k, side），用和頁面不同的走訪順序列舉：
   逐「欄」而不是逐「排」。比對靠 row/col 的鍵，所以順序不同不影響，
   但漏掉或多出來的格子一定看得見。 */
function cellsRef(kind, n){
  const out = [];
  const cols = (kind === 'rect') ? n + 1 : n;
  for (let col = 0; col < cols; col++){
    for (let row = 0; row < n; row++){
      if (kind === 'tri' && col > row) continue;
      const k = (kind === 'sq') ? Math.max(row, col) + 1 : row + 1;
      const side = (kind === 'rect' && col > row) ? 'b' : 'a';
      out.push({ row:row, col:col, k:k, side:side });
    }
  }
  return out;
}
function stepRef(cols, rows, R){
  return Math.min(R.STEP, (R.W - 2 * R.PAD) / cols, (R.H - 2 * R.PAD) / rows);
}
/* 中心往外：cx ＝ W / 2 ＋ step × (col － (cols － 1) / 2)。
   和頁面的「左上角 ＋ (col ＋ 0.5) × step」代數上相等，但走的是另一條路。 */
function planRef(kind, n, R){
  const cols = (kind === 'rect') ? n + 1 : n;
  const step = stepRef(cols, n, R);
  const dots = cellsRef(kind, n).map(c => ({
    row:c.row, col:c.col, k:c.k, side:c.side,
    cx: R.W / 2 + step * (c.col - (cols - 1) / 2),
    cy: R.H / 2 + step * (c.row - (n - 1) / 2),
    r: step * R.RATIO
  }));
  return { kind:kind, n:n, cols:cols, rows:n, step:step, r:step * R.RATIO,
           x0:(R.W - cols * step) / 2, y0:(R.H - n * step) / 2,
           w:cols * step, h:n * step, dots:dots };
}

const canvasProblems = require('./lib/canvas.js').canvasProblems;

/* 把頁面算出來的那一張圖拿來驗。回傳問題字串陣列（空的表示過關）。 */
function checkPlan(plan, kind, n, R, tag){
  const out = [];
  const near = (a, b) => typeof a === 'number' && Number.isFinite(a) && Math.abs(a - b) < EPS;
  if (!plan || !plan.dots) return [tag + ': no plan was produced at all'];
  const ref = planRef(kind, n, R);

  if (plan.kind !== kind) out.push(tag + ': the plan says kind=' + plan.kind + ', the question needs ' + kind);
  if (plan.n !== n) out.push(tag + ': the plan says n=' + plan.n + ', the data says ' + n);
  if (plan.cols !== ref.cols) out.push(tag + ': ' + plan.cols + ' columns, the spec gives ' + ref.cols);
  if (plan.rows !== n) out.push(tag + ': ' + plan.rows + ' rows, the spec gives ' + n);
  if (!near(plan.step, ref.step)) out.push(tag + ': step is ' + plan.step + ', the spec gives ' + ref.step);
  if (!(plan.step > 0)) out.push(tag + ': step is not positive, so every dot would land on the same spot');
  if (!(plan.r > 0)) out.push(tag + ': the dot radius is not positive, so nothing would be visible');
  /* ⚠️ 順序：安全性質（點不可以黏在一起）要排在「半徑剛好等於規格」**前面**。
     反過來的話，任何把半徑改大的改壞都會先撞上等式，這一條就永遠輪不到，
     等於一條從來沒有被證明過的斷言。 */
  if (plan.r * 2 >= plan.step + EPS)
    out.push(tag + ': a dot is ' + (plan.r * 2) + ' wide but a cell is only ' + plan.step + ' — neighbouring dots would touch');
  if (!near(plan.r, ref.r)) out.push(tag + ': the dot radius is ' + plan.r + ', the spec gives ' + ref.r);
  if (!near(plan.x0, ref.x0) || !near(plan.y0, ref.y0))
    out.push(tag + ': the block is not centred (x0=' + plan.x0 + ', y0=' + plan.y0 +
             '; the spec gives ' + ref.x0 + ', ' + ref.y0 + ')');
  if (out.length) return out;

  /* ---- 點的集合：一格不多一格不少，而且每一格的座標都對得上 ---- */
  if (plan.dots.length !== ref.dots.length){
    out.push(tag + ': the picture has ' + plan.dots.length + ' dots, the geometry gives ' + ref.dots.length);
    return out;
  }
  /* ---- 這一課教的三件事，直接在圖上驗 ---- */
  if (kind === 'sq'){
    if (plan.dots.length !== sqRef(n))
      out.push(tag + ': a square of ' + n + ' rows should hold ' + sqRef(n) + ' dots, the picture holds ' + plan.dots.length);
    /* 第 k 圈的 L 形一定是 k ＋ k － 1 個點（奇數）。 */
    for (let k = 1; k <= n; k++){
      const got = plan.dots.filter(p => p.k === k).length;
      if (got !== gnomonRef(k))
        out.push(tag + ': L-shape number ' + k + ' holds ' + got + ' dots, the geometry gives ' + gnomonRef(k));
      if (gnomonRef(k) % 2 !== 1)
        out.push(tag + ': L-shape number ' + k + ' is not an odd number of dots, which the lesson promises it always is');
    }
  }
  if (kind === 'tri'){
    if (plan.dots.length !== triRef(n))
      out.push(tag + ': a triangle of ' + n + ' rows should hold ' + triRef(n) + ' dots, the picture holds ' + plan.dots.length);
    /* 一排比一排多 1 個。 */
    for (let row = 0; row < n; row++){
      const got = plan.dots.filter(p => p.row === row).length;
      if (got !== row + 1)
        out.push(tag + ': row ' + (row + 1) + ' holds ' + got + ' dots, but each row must hold one more than the row above');
    }
  }
  if (kind === 'rect'){
    if (plan.dots.length !== rectRef(n))
      out.push(tag + ': the rectangle should hold ' + rectRef(n) + ' dots, the picture holds ' + plan.dots.length);
    /* 這一課最重要的幾何事實：兩半各剛好是第 n 個三角形數，而且合起來蓋滿整個長方形。 */
    const a = plan.dots.filter(p => p.side === 'a').length;
    const b = plan.dots.filter(p => p.side === 'b').length;
    if (a !== triRef(n) || b !== triRef(n))
      out.push(tag + ': the two halves hold ' + a + ' and ' + b + ' dots, but each must be the triangular number ' + triRef(n) +
               ' — that is the whole reason the shortcut divides by 2');
    if (a + b !== rectRef(n))
      out.push(tag + ': the two halves add up to ' + (a + b) + ' but the rectangle holds ' + rectRef(n));
    /* 每一排的第一半是 row ＋ 1 個（階梯），第二半是剩下的。 */
    for (let row = 0; row < n; row++){
      const ga = plan.dots.filter(p => p.row === row && p.side === 'a').length;
      if (ga !== row + 1)
        out.push(tag + ': row ' + (row + 1) + ' gives ' + ga + ' dots to the first triangle, the staircase needs ' + (row + 1));
    }
  }

  const want = new Map();
  ref.dots.forEach(d => want.set(d.row + ',' + d.col, d));
  const seen = new Set();
  for (const p of plan.dots){
    const key = p.row + ',' + p.col;
    const w = want.get(key);
    if (!w){ out.push(tag + ': the picture draws a dot at row ' + p.row + ', column ' + p.col + ', which is not part of the shape'); return out; }
    if (seen.has(key)){ out.push(tag + ': the picture draws two dots at row ' + p.row + ', column ' + p.col); return out; }
    seen.add(key);
    if (!near(p.cx, w.cx) || !near(p.cy, w.cy)){
      out.push(tag + ': the dot at row ' + p.row + ', column ' + p.col + ' sits at (' + p.cx + ', ' + p.cy +
               '), the spec gives (' + w.cx + ', ' + w.cy + ')');
      return out;
    }
    if (!near(p.r, w.r)){ out.push(tag + ': the dot at row ' + p.row + ', column ' + p.col + ' has radius ' + p.r); return out; }
    if (p.k !== w.k){
      out.push(tag + ': the dot at row ' + p.row + ', column ' + p.col + ' is tagged as ring ' + p.k +
               ', the geometry puts it in ring ' + w.k);
      return out;
    }
    if (p.side !== w.side){
      out.push(tag + ': the dot at row ' + p.row + ', column ' + p.col + ' is tagged side ' + p.side +
               ', the geometry puts it on side ' + w.side);
      return out;
    }
  }

  /* ---- 畫布容不容得下：用全站共用的那一份，四個邊都驗 ---- */
  const svg = '<svg width="' + R.W + '" height="' + R.H + '" viewBox="0 0 ' + R.W + ' ' + R.H + '">' +
    plan.dots.map(p => '<circle cx="' + p.cx + '" cy="' + p.cy + '" r="' + p.r + '" fill="#3B7DD8"/>').join('') +
    '</svg>';
  canvasProblems(svg).forEach(p => out.push(tag + ' canvas: ' + p));
  return out;
}

/* ---------- 渲染出來的字串掃描 ---------- */
const EN_S_WORD_OK = ['is', 'has', 'was', 'its', 'less', 'plus', 'thus', 'this', 'does', 'yes', 'as',
  'gives', 'leaves', 'means', 'makes', 'needs', 'takes', 'lands', 'adds', 'comes', 'goes', 'says', 'holds', 'fills',
  'across'];
const EN_S_ADVERB_RE = /(wards|ways)$/;
const EN_S_SINGULAR_OK = ['class', 'bus', 'glass', 'cross', 'pass', 'gas', 'lens', 'series', 'analysis', 'species'];
const EN_IRREGULAR_PLURAL_RE = /\b1 (people|children|men|women|feet|teeth|mice|geese)\b/;
const EN_ONE_RE_G = /\b1 ([a-z]+s)\b/g;
const EN_ARE_ONE_RE = /\b1 [a-z]+ are\b/;
/* 英文序數只有 1st／2nd／3rd 特別，11~13 一律 th。拼錯只有這裡看得到。 */
/* ⚠️ 只收 st/nd/rd/th 的話，拼成「9zz」的序數整個看不到 —— 先把「數字接兩個字母」
   全部撈出來，再拿正確的字尾比對，錯的字尾和錯的搭配就一起抓得到。 */
/* ⚠️ 字尾要收「兩個字母以上」：`{2}` 漏掉 9zzz，而 `+` 會把英文的複數數字
   （「the two 5s」）誤判成壞掉的序數 —— 序數的字尾本來就都是兩個字母。
   掃之前整段已經 toLowerCase()，所以 9ZZ 也抓得到；`9-th` 這種中間插東西的不在範圍內。 */
const EN_UNIT_SUFFIX_OK = ['px', 'em', 'rem', 'cm', 'mm', 'km', 'kg', 'ml', 'am', 'pm'];
const EN_ORD_RE_G = /\b(\d+)([a-z]{2,})\b/g;
function ordSuffixRef(n){
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return (s[(v - 20) % 10] || s[v] || s[0]);
}
function textProblems(s, lang, tag){
  const out = [];
  const shown = String(s).replace(/<[^>]+>/g, '');
  if (/undefined|NaN|\[object/.test(shown)) out.push(tag + ' leaks an internal value: ' + shown.slice(0, 90));
  if (!shown.trim()) out.push(tag + ' renders empty');
  /* 這一課不用負數。減號前面（跳過空白之後）有運算元（數字或右括號）就是減法，
     沒有就是負號 —— 不要去列舉「前面可以是什麼」。 */
  const neg = /(?:^|[^0-9)）\s])\s*[-−－]\s*\d/.exec(shown);
  if (neg) out.push(tag + ' shows a negative number ("' + neg[0].trim() + '"), but this lesson never uses negatives');
  if (lang === 'zh'){
    const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) out.push(tag + ' has Chinese glued to a digit: ' + [...new Set(glued)].join(' '));
  } else {
    if (/[一-鿿]/.test(shown)) out.push(tag + ' (English) contains Chinese: ' + shown.slice(0, 60));
    const low = shown.toLowerCase();
    /* ⚠️ 用 exec() 只看得到**第一個**符合的字，要每一個都看。 */
    for (const one of low.matchAll(EN_ONE_RE_G)){
      if (EN_S_WORD_OK.indexOf(one[1]) < 0 && !EN_S_ADVERB_RE.test(one[1]) &&
          EN_S_SINGULAR_OK.indexOf(one[1]) < 0)
        out.push(tag + ' has an English plural after 1: "' + one[0] + '"');
    }
    const irr = EN_IRREGULAR_PLURAL_RE.exec(low);
    if (irr) out.push(tag + ' has an irregular English plural after 1: "' + irr[0] + '"');
    const are = EN_ARE_ONE_RE.exec(low);
    if (are) out.push(tag + ' has "are" after a singular 1: "' + are[0] + '"');
    for (const m of low.matchAll(EN_ORD_RE_G)){
      /* ⚠️ 「數字接單位」（10px、12rem）不是壞掉的序數，放行；
         其餘兩個字母以上的字尾一律拿正確的序數字尾比對。 */
      if (EN_UNIT_SUFFIX_OK.indexOf(m[2]) >= 0) continue;
      const want = ordSuffixRef(Number(m[1]));
      if (m[2] !== want) out.push(tag + ' has a malformed English ordinal: "' + m[0] + '" (it should be ' + m[1] + want + ')');
    }
  }
  const dbl = shown.match(/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/);
  if (dbl) out.push(tag + ' has doubled punctuation "' + dbl[0] + '"');
  return out;
}

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站共用的唯一一份）。
   量詞由各課自己給：共用清單漏掉某一課的量詞時，那一課會多出一個假的運算元。 */
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['個', '點', '排', '罐', '格', '項', '段', '種'],
  unitsEn: ['dots?', 'rows?', 'cans?', 'cells?', 'items?', 'numbers?', 'squares?', 'triangles?']
});

/* ---------- 跨頁用詞釘樁 ----------
   同一條規則在四頁必須用同一句話講。這一課最危險的三句是兩條捷徑和「差在長大」。
   ⚠️ `min` 一律寫成**當下真實的出現次數**，不是「至少 2」——
      實際有 3 份而只要求 2 份的話，拿掉其中一份還是綠的。
   ⚠️ 「必須出現」只有下界，擋不住「又多加了一句錯的」，所以規則類的釘樁要**成對**：
      一張必須出現的表 ＋ 一張 FORBIDDEN 一個字都不可以出現的表，中英各釘一次。 */
const SIBLING_RULES = [
  { file:'index', text:'第 n 個正方形數 ＝ n × n', min:6,
    why:'is one of the two shortcuts this whole lesson turns on' },
  { file:'index', text:'第 n 個三角形數 ＝ n × (n ＋ 1) ÷ 2', min:6,
    why:'is the other shortcut, and the ÷ 2 is exactly what children drop' },
  { file:'index', text:'差一直在長大', min:5,
    why:'is why the previous lesson’s two formulas are off limits here' },
  { file:'index', text:'規律偵探社', min:10,
    why:'names the grade-4 lesson this one splits the work with' },
  { file:'index', text:'符號偵探社', min:2,
    why:'is the grade-5 boundary for writing the nth one as an equation' },
  { file:'index', text:'運算律魔術師', min:2,
    why:'is the other grade-5 boundary (the operation laws are a different unit)' },
  { file:'index', text:'因數工廠', min:2,
    why:'is where square numbers come back in grade 5' },
  { file:'index', text:'轉角那一個被算了兩次', min:2,
    why:'is why an L-shape always takes an odd number of dots' },
  { file:'index', text:'the nth square number = n × n', min:3,
    why:'is the English half of the first shortcut — pinning only Chinese lets English drift' },
  { file:'index', text:'the nth triangular number = n × (n + 1) ÷ 2', min:3,
    why:'is the English half of the second shortcut' },
  { file:'reference', text:'第 n 個正方形數 ＝ n × n', min:2,
    why:'must match the lesson page word for word' },
  { file:'reference', text:'第 n 個三角形數 ＝ n × (n ＋ 1) ÷ 2', min:2,
    why:'must match the lesson page word for word' },
  { file:'reference', text:'忘了除以 2', min:2,
    why:'is the headline misconception of this lesson' },
  { file:'reference', text:'差一直在長大', min:4,
    why:'is the cheat sheet’s reason for not using the earlier formulas' },
  { file:'reference', text:'The nth square number = n × n', min:1,
    why:'is the English half of the first shortcut on the cheat sheet' },
  { file:'parents', text:'差一直在長大', min:2,
    why:'states for the adult why the earlier formulas are off limits' },
  { file:'parents', text:'圖形數實驗室接委託', min:2,
    why:'is the game name the mastery bar refers to' },
  { file:'parents', text:'兩個一樣的三角形拼起來才是那個長方形', min:2,
    why:'is the sentence the adult is meant to say out loud' },
  { file:'review', text:'一排比一排多 1 個', min:2,
    why:'is the rule every generated triangular caption must state' }
];
/* 這幾句話一個字都不可以出現 —— 它們是「規則被寫太滿」或「越界到五年級」的版本。 */
const FORBIDDEN = [
  { file:'index', text:'差在長大的規律都有捷徑',
    why:'only these two shape numbers get a shortcut; claiming it for every growing-gap pattern is false' },
  { file:'reference', text:'差在長大的規律都有捷徑',
    why:'the cheat sheet must not over-claim either' },
  { file:'index', text:'第 n 個三角形數 ＝ n × (n ＋ 1)　',
    why:'that is the rectangle, not the triangle — the ÷ 2 may never be dropped' },
  { file:'index', text:'用字母代表第幾個',
    why:'writing the position as a letter is grade 5’s “The Symbol Detectives”, not this lesson' },
  { file:'review', text:'立體',
    why:'solid shape numbers are out of scope and no generator may reach for them' },
  { file:'index', text:'每一個差都一樣，所以是圖形數',
    why:'equal gaps are exactly the case that is NOT a shape number here' }
];

/* 渲染出來的旁白裡，算式驗算器真的驗過幾條。⚠️ 這是**當下真實的條數**，不是下界 ——
   有一句帶算式的旁白被換成不帶等號的錯話時，這個數字會掉下來。 */
const NARRATED_EQUATIONS = 136;
/* 那些算式本身的指紋（排序後 sha1 的前 16 碼）。⚠️ 條數一樣但內容換掉的時候，
   只有這一條會響 —— 改動旁白的算式時，要看著新的指紋確認換掉的是你想換的那一條。 */
const NARRATED_FINGERPRINT = 'f73aee54af21bccb';

const GEN_IDS = ['sqNth', 'triNth', 'sqGrow', 'triGrow', 'oddSum', 'triRect',
                 'sqWhich', 'triWhich', 'whichKind', 'pickFigurate', 'stackWord', 'nextTerm'];

/* 分類的中英真值表。拿頁面的字典去比頁面的字典等於自己比自己。 */
const KIND_REF = {
  zh:{ tri:'三角形數', sq:'正方形數', arith:'每次加一樣多', other:'以上都不是' },
  en:{ tri:'triangular numbers', sq:'square numbers', arith:'the same gap every time', other:'none of these' }
};

function plEnRef(n, w){ return n === 1 ? w : w + 's'; }
function ordEnRef(n){ return n + ordSuffixRef(n); }

/* ---------- 題庫神諭 ----------
   `verify_lesson_data.js` 內建的算術重算只認得「a ＋ b ＝ ?」那種題幹，
   這一課 12 題一題都不符合 —— 沒有這一張表的話，把 ans 改掉完全不會響。
   `stemExact` 逐字釘死題幹：白名單（集合比對）擋不掉「重複使用既有數字」的偷加。 */
const BANK_EXPECTED = {
  qs: [
    { stemExact:'第 <strong>5</strong> 個正方形數是多少？',
      enStemExact:'What is the <strong>5th</strong> square number?',
      answer:'25' },
    { stemExact:'從第 <strong>6</strong> 個正方形數長到第 <strong>7</strong> 個，要補幾個點？',
      enStemExact:'Growing from the <strong>6th</strong> square number to the <strong>7th</strong>, how many dots get added?',
      answer:'13' },
    { stemExact:'第 <strong>6</strong> 個三角形數是多少？',
      enStemExact:'What is the <strong>6th</strong> triangular number?',
      answer:'21' },
    { stemExact:'<strong>1 ＋ 3 ＋ 5 ＋ 7 ＋ 9</strong> ＝ ？',
      enStemExact:'<strong>1 + 3 + 5 + 7 + 9</strong> = ?',
      answer:'25' },
    { stemExact:'兩個第 <strong>5</strong> 個三角形數拼成一個長方形。這個長方形一共有幾個點？',
      enStemExact:'Two <strong>5th</strong> triangular numbers are fitted together into a rectangle. How many dots does that rectangle hold?',
      answer:'30' },
    { stemExact:'<strong>28</strong> 是第幾個三角形數？',
      enStemExact:'Which position is <strong>28</strong> in the triangular numbers?',
      answer:'7' }
  ],
  qsAdv: [
    { stemExact:'文字題：罐頭疊成一個三角形，最下面一排 <strong>8</strong> 罐，每往上一排少 1 罐，最上面一排 1 罐。一共有幾罐？',
      enStemExact:'Word problem: cans are stacked in a triangle with <strong>8</strong> cans along the bottom row, one fewer in each row going up, and 1 can on top. How many cans are there?',
      answer:'36' },
    { stemExact:'文字題：一盒巧克力排成正方形，每排 <strong>9</strong> 個。老闆想改成每排 <strong>10</strong> 個的正方形，要再加幾個？',
      enStemExact:'Word problem: a box of chocolates is arranged in a square with <strong>9</strong> in each row. The shopkeeper wants a square with <strong>10</strong> in each row instead. How many more are needed?',
      answer:'19' },
    { stemExact:'文字題：一串圖形數是 <strong>3、6、10、15</strong>。下一個是多少？',
      enStemExact:'Word problem: a run of shape numbers goes <strong>3, 6, 10, 15</strong>. What comes next?',
      answer:'21' },
    { stemExact:'文字題：下面哪一個數<strong>同時</strong>是三角形數，也是正方形數？',
      enStemExact:'Word problem: which of these is <strong>both</strong> a triangular number and a square number?',
      answer:'36' }
  ],
  qsBoost: [
    { stemExact:'迷思檢查：小安說「三角形數是 1、3、6、10，每次加 3，所以第 5 個是 13」。他錯在哪裡？',
      enStemExact:'Misconception check: Ann says “triangular numbers go 1, 3, 6, 10, adding 3 each time, so the 5th one is 13.” What has she got wrong?',
      answer:'看得到的差是 2、3、4，不是每次都一樣，下一個差是 5，所以第 5 個是 15',
      enAnswer:'The gaps you can see are 2, 3, 4, not all the same, so the next gap is 5 and the 5th one is 15' },
    { stemExact:'迷思檢查：小宇說「第 6 個三角形數是 6 × 7 ＝ 42」。他錯在哪裡？',
      enStemExact:'Misconception check: Yu says “the 6th triangular number is 6 × 7 = 42.” What has he got wrong?',
      answer:'6 × 7 是兩個三角形拼成的長方形，一個要再除以 2，是 21',
      enAnswer:'6 × 7 is the rectangle two triangles make, so one of them needs halving, giving 21' }
  ]
};
/* 「問的是什麼」單獨驗一次：只驗數字的話，把題幹改成問別的、正解不動，全部都是綠的。 */
const BANK_ASK = {
  qs: [
    { must:['個正方形數是多少'], never:['三角形數'] },
    { must:['要補幾個點'], never:['一共'] },
    { must:['個三角形數是多少'], never:['正方形數'] },
    { must:['＝ ？'], never:['第幾個'] },
    { must:['長方形一共有幾個點'], never:['第幾個'] },
    { must:['是第幾個三角形數'], never:['正方形數'] }
  ],
  qsAdv: [
    { must:['一共有幾罐'], never:['第幾個'] },
    { must:['要再加幾個'], never:['一共有幾個'] },
    { must:['下一個是多少'], never:['第幾個'] },
    { must:['<strong>同時</strong>是三角形數，也是正方形數'], never:['第幾個'] }
  ],
  qsBoost: [
    { must:['他錯在哪裡'], never:['第幾個'] },
    { must:['他錯在哪裡'], never:['第幾個'] }
  ]
};
/* 英文題幹也要單獨釘一次：只釘中文的話，英文可以問別的運算而保留同一個答案。 */
const BANK_ASK_EN = {
  qs: [
    { must:['square number'], never:['triangular'] },
    { must:['how many dots get added'], never:['altogether'] },
    { must:['triangular number'], never:['square number'] },
    { must:['= ?'], never:['which'] },
    { must:['how many dots does that rectangle hold'], never:['which triangular'] },
    { must:['which position is'], never:['square number'] }
  ],
  qsAdv: [
    { must:['how many cans are there'], never:['which position'] },
    { must:['how many more are needed'], never:['altogether'] },
    { must:['what comes next'], never:['which position'] },
    { must:['<strong>both</strong> a triangular number and a square number'], never:['which position'] }
  ],
  qsBoost: [
    { must:['what has she got wrong'], never:['which position'] },
    { must:['what has he got wrong'], never:['which position'] }
  ]
};
/* 這幾題的答案要從**題幹裡的數字**重算，不是拿設定檔自己的常數算 ——
   後者在題幹被改掉時不會響。 */
const BANK_RECOMPUTE = [
  { bank:'qs', i:0, from:[5], calc:l => String(sqRef(l[0])) },
  { bank:'qs', i:1, from:[6, 7], calc:l => String(sqRef(l[1]) - sqRef(l[0])) },
  { bank:'qs', i:2, from:[6], calc:l => String(triRef(l[0])) },
  { bank:'qs', i:3, from:[1, 3, 5, 7, 9], calc:l => String(l.reduce((a, b) => a + b, 0)) },
  { bank:'qs', i:4, from:[5], calc:l => String(rectRef(l[0])) },
  { bank:'qs', i:5, from:[28], calc:l => String(whichTriRef(l[0])) },
  { bank:'qsAdv', i:0, from:[8, 1, 1], calc:l => String(triRef(l[0])) },
  { bank:'qsAdv', i:1, from:[9, 10], calc:l => String(sqRef(l[1]) - sqRef(l[0])) },
  { bank:'qsAdv', i:2, from:[3, 6, 10, 15], calc:l => String(TRI_TABLE[whichTriRef(l[3])]) }
];
/* 選項是整句話的那幾題要用「關鍵字只能落在正解上」當神諭。
   只比對「頁面的 ans 等於設定檔寫死的索引」的話，把正解換成別的句子而 ans 不動，
   所有檢查都還是綠的（別課踩過，codex 判 critical）。 */
const BANK_ONLY_ANSWER = [
  { bank:'qsBoost', i:0, zh:'看得到的差是 2、3、4', en:'gaps you can see are 2, 3, 4' },
  { bank:'qsBoost', i:1, zh:'一個要再除以 2', en:'needs halving' }
];

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 圖形數本身：公式改壞，走幾何的參考實作要抓到 --- */
    { file:"index", via:"index", expect:"counting the dots gives",
      find:"  function sqNum(n){ return n * n; }",
      replace:"  function sqNum(n){ return n + n; }",
      why:"a square number would become an addition, which is the lesson's headline misconception" },
    { file:"index", via:"index", expect:"adding the rows gives",
      find:"  function triNum(n){ return n * (n + 1) / 2; }",
      replace:"  function triNum(n){ return n * (n + 1); }",
      why:"dropping the ÷ 2 turns every triangular number into the rectangle" },
    { file:"index", via:"index", expect:"counting the L-shape gives",
      find:"  function gnomonSize(k){ return k + k - 1; }",
      replace:"  function gnomonSize(k){ return k + k; }",
      why:"the corner dot would be counted twice, so an L-shape would stop being odd" },
    { file:"index", via:"index", expect:"counting the rectangle gives",
      find:"  function rectDots(n){ return n * (n + 1); }",
      replace:"  function rectDots(n){ return n * n; }",
      why:"the rectangle would stop being one wider than it is tall" },
    { file:"index", via:"index", expect:"does not match the difference between consecutive square numbers",
      find:"  function sqGap(n){ return 2 * n + 1; }",
      replace:"  function sqGap(n){ return 2 * n - 1; }",
      why:"growing a square would take the previous L-shape, an off-by-one the whole lesson turns on" },
    { file:"index", via:"index", expect:"does not match the difference between consecutive triangular numbers",
      find:"  function triGap(n){ return n + 1; }",
      replace:"  function triGap(n){ return n; }",
      why:"the new bottom row would repeat the old one instead of holding one more" },
    { file:"index", via:"index", expect:"adding the L-shapes gives",
      find:"    for (var k = 1; k <= n; k++) s += gnomonSize(k);\n    return s;\n  }\n\n  /* --- 反過來問「第幾個」。",
      replace:"    for (var k = 1; k <= n; k++) s += gnomonSize(k) + 1;\n    return s;\n  }\n\n  /* --- 反過來問「第幾個」。",
      why:"the running total of the odd numbers would stop landing on a square number" },
    { file:"index", via:"index", expect:"the table gives",
      find:"      if (sqNum(n) === v) return n;",
      replace:"      if (sqNum(n) === v) return n + 1;",
      why:"going backwards would be off by one on every square number" },
    { file:"index", via:"index", expect:"the table gives",
      find:"      if (triNum(n) === v) return n;",
      replace:"      if (triNum(n) === v) return n + 1;",
      why:"going backwards would be off by one on every triangular number" },
    { file:"index", via:"index", expect:"disagrees with the table",
      find:"  function isSq(v){ return whichSq(v) > 0; }",
      replace:"  function isSq(v){ return true; }",
      why:"every number would count as a square number" },
    { file:"index", via:"index", expect:"disagrees with the table",
      find:"  function isTri(v){ return whichTri(v) > 0; }",
      replace:"  function isTri(v){ return v > 0; }",
      why:"every number would count as a triangular number" },
    { file:"index", via:"index", expect:"the table gives",
      find:"  var WHICH_MAX = 200;",
      replace:"  var WHICH_MAX = 5;",
      why:"going backwards would give up before reaching the numbers the lesson actually uses" },
    { file:"index", via:"index", expect:"but the earlier lesson’s formula gives",
      find:"    return vals[0] + (vals.length - 1) * gapsOf(vals)[0];",
      replace:"    return vals[vals.length - 1];",
      why:"example 5 would no longer show the earlier lesson's formula falling short" },

    /* --- 分類：剛好一種模型套得上 --- */
    { file:"index", via:"index", expect:"kindOf must refuse runs shorter than three numbers",
      find:"    if (vals.length < 3) return 'short';\n    if (isRunOf(vals, triNum, whichTri)) return 'tri';",
      replace:"    if (vals.length < 1) return 'short';\n    if (isRunOf(vals, triNum, whichTri)) return 'tri';",
      why:"1 on its own is both kinds at once, so a one-number run must never be classified" },
    { file:"index", via:"index", expect:"the reference says",
      find:"    for (var i = 0; i < vals.length; i++) if (f(n + i) !== vals[i]) return false;\n    return true;",
      replace:"    for (var i = 0; i < vals.length; i++) if (which(vals[i]) < 0) return false;\n    return true;",
      why:"a run of the right kind but the wrong positions would be accepted" },
    { file:"index", via:"index", expect:"allSame disagrees with the reference",
      find:"    for (var i = 1; i < list.length; i++) if (list[i] !== list[0]) return false;\n    return list.length > 0;",
      replace:"    for (var i = 2; i < list.length; i++) if (list[i] !== list[0]) return false;\n    return list.length > 0;",
      why:"the first gap would never be compared, so 1, 2, 4 would read as equal gaps" },

    /* --- 版面：兩套排版必須一致 --- */
    { file:"index", via:"index", expect:"step is",
      find:"    var step = Math.min(STEP_MAX, (FIG_W - 2 * FIG_PAD) / cols, (FIG_H - 2 * FIG_PAD) / rows);",
      replace:"    var step = Math.min(STEP_MAX * 2, (FIG_W - 2 * FIG_PAD) / cols, (FIG_H - 2 * FIG_PAD) / rows);",
      why:"a small picture would blow past the maximum cell size" },
    { file:"index", via:"index", expect:"the block is not centred",
      find:"             x0:(FIG_W - w) / 2, y0:(FIG_H - h) / 2, w:w, h:h };",
      replace:"             x0:FIG_PAD, y0:(FIG_H - h) / 2, w:w, h:h };",
      why:"the dots would sit against the left edge instead of in the middle" },
    { file:"index", via:"index", expect:"neighbouring dots would touch",
      find:"    return { cols:cols, rows:rows, step:step, r:step * DOT_RATIO,",
      replace:"    return { cols:cols, rows:rows, step:step, r:step * 0.6,",
      why:"the dots would grow until they merged into one solid block" },
    { file:"index", via:"index", expect:"the dot radius is",
      find:"  var DOT_RATIO = 0.3;     // 點的半徑佔一格的比例",
      replace:"  var DOT_RATIO = 0.2;     // 點的半徑佔一格的比例",
      why:"the dots would shrink away from the spec without ever touching, so only the equality catches it" },
    { file:"index", via:"index", expect:"dots, the geometry gives 1",
      find:"        out.push({ row:row, col:col, k:Math.max(row, col) + 1, side:'a' });",
      replace:"        out.push({ row:row, col:col, k:row + 1, side:'a' });",
      why:"the L-shapes would become plain rows, so example 2 would stop showing odd numbers" },
    { file:"index", via:"index", expect:"the geometry gives",
      find:"      for (var col = 0; col <= row; col++)\n        out.push({ row:row, col:col, k:row + 1, side:'a' });",
      replace:"      for (var col = 0; col < row; col++)\n        out.push({ row:row, col:col, k:row + 1, side:'a' });",
      why:"every row of the staircase would be one dot short" },
    { file:"index", via:"index", expect:"the two halves hold",
      find:"        out.push({ row:row, col:col, k:row + 1, side:(col <= row ? 'a' : 'b') });",
      replace:"        out.push({ row:row, col:col, k:row + 1, side:(col < row ? 'a' : 'b') });",
      why:"the rectangle would stop splitting into two equal triangles, which is the whole reason for the ÷ 2" },
    { file:"index", via:"index", expect:"sits at",
      find:"               cy:g.y0 + (c.row + 0.5) * g.step, r:g.r };",
      replace:"               cy:g.y0 + (c.row + 1) * g.step, r:g.r };",
      why:"every dot would drop half a cell, so the block would hang off the bottom" },
    { file:"index", via:"index", expect:"layout constant FIG_H",
      find:"  var FIG_W = 460, FIG_H = 300;",
      replace:"  var FIG_W = 460, FIG_H = 280;",
      why:"the canvas would shrink without the spec following" },
    { file:"index", via:"index", expect:"layout constant FIG_PAD",
      find:"  var FIG_PAD = 22;        // 畫布四周至少留這麼多",
      replace:"  var FIG_PAD = 2;         // 畫布四周至少留這麼多",
      why:"the dots would be allowed to run right up to the edge of the canvas" },
    { file:"index", via:"index", expect:"columns, the spec gives",
      find:"    var cols = (kind === 'rect') ? n + 1 : n;\n    var g = gridPlan(cols, n);",
      replace:"    var cols = n;\n    var g = gridPlan(cols, n);",
      why:"the rectangle would lose its extra column, so the two staircases would not fit" },

    /* --- 範例與遊戲 --- */
    { file:"index", via:"index", expect:"must not offer n=1",
      find:"  var S4_NS = [2, 3, 4, 5, 6];",
      replace:"  var S4_NS = [1, 2, 3, 4, 5];",
      why:"one dot beside one dot shows no staircase offset, so the shortcut is invisible" },
    { file:"index", via:"index", expect:"the reference classifies it as",
      find:"    { id:'arith', vals:[3, 7, 11, 15, 19] }",
      replace:"    { id:'arith', vals:[3, 7, 11, 15, 20] }",
      why:"the contrast run would stop having equal gaps, so example 5 would compare nothing" },
    { file:"index", via:"index", expect:"opts[ans] is",
      find:"    { kind:'sqNth',    n:5,  opts:['25', '10', '16', '20'], ans:0 },",
      replace:"    { kind:'sqNth',    n:5,  opts:['25', '10', '16', '20'], ans:1 },",
      why:"the first round would mark the adding-instead-of-multiplying mistake as correct" },
    { file:"index", via:"index", expect:"the checker computes",
      find:"    if (r.kind === 'sqNth') return String(sqNum(r.n));",
      replace:"    if (r.kind === 'sqNth') return String(sqNum(r.n) + 1);",
      why:"the game would score a different number from the one the lesson teaches" },
    { file:"index", via:"index", expect:"shows a picture for a",
      find:"    if (r.kind === 'sqGrow') return { kind:'sq', n:r.n + 1, hi:r.n + 1 };\n    return null;",
      replace:"    if (r.kind === 'sqGrow') return { kind:'sq', n:r.n + 1, hi:r.n + 1 };\n    return { kind:'tri', n:3, hi:0 };",
      why:"the backwards question would show the answer as a picture to count" },

    /* --- 題庫神諭 --- */
    { file:"index", via:"index", expect:"the answers of the zh bank say",
      find:"          opts:['25','10','16','20'], ans:0,\n          why:'正方形數是",
      replace:"          opts:['25','10','16','20'], ans:1,\n          why:'正方形數是",
      why:"the marked answer would be the misconception instead of the square number" },
    { file:"index", via:"index", expect:"stem does not match the pinned wording",
      find:"        { stem:'第 <strong>5</strong> 個正方形數是多少？',",
      replace:"        { stem:'第 <strong>6</strong> 個正方形數是多少？',",
      why:"the stem would ask about a different position while keeping the old answer" },
    { file:"index", via:"index", expect:"(en) stem does not match the pinned wording",
      find:"        { stem:'What is the <strong>5th</strong> square number?',",
      replace:"        { stem:'What is the <strong>5th</strong> triangular number?',",
      why:"the English half would ask about the other kind of shape number" },
    { file:"index", via:"index", expect:"the correct option never says",
      find:"          opts:['他應該乘 3，第 5 個是 30','三角形數要從 3 開始，第 5 個是 18','看得到的差是 2、3、4，不是每次都一樣，下一個差是 5，所以第 5 個是 15','他沒有錯，第 5 個就是 13'], ans:2,",
      replace:"          opts:['他應該乘 3，第 5 個是 30','三角形數要從 3 開始，第 5 個是 18','差不是每次都一樣，下一個差是 5，所以第 5 個是 15','他沒有錯，第 5 個就是 13'], ans:2,",
      why:"the misconception check would stop naming the gaps that make it wrong" },
    { file:"index", via:"index", expect:"recomputing from the stem",
      find:"        { stem:'文字題：罐頭疊成一個三角形，最下面一排 <strong>8</strong> 罐，每往上一排少 1 罐，最上面一排 1 罐。一共有幾罐？',",
      replace:"        { stem:'文字題：罐頭疊成一個三角形，最下面一排 <strong>9</strong> 罐，每往上一排少 1 罐，最上面一排 1 罐。一共有幾罐？',",
      why:"the word problem would change size while keeping the old total" },

    { file:"index", via:"index", expect:"changes what was proved",
      find:"      s1calc:function(n, v){ return n + ' × ' + n + ' ＝ ' + v; },",
      replace:"      s1calc:function(n, v){ return n + ' ＋ ' + n + ' ＝ ' + (n + n); },",
      why:"swapping one correct equation for another correct one keeps the count, so only the fingerprint catches it" },
    { file:"index", via:"index", expect:"is not a finite number",
      find:"    var step = Math.min(STEP_MAX, (FIG_W - 2 * FIG_PAD) / cols, (FIG_H - 2 * FIG_PAD) / rows);\n    var w = cols * step, h = rows * step;",
      replace:"    var step = Math.min(STEP_MAX, (FIG_W - 2 * FIG_PAD) / cols, (FIG_H - 2 * FIG_PAD) / rows);\n    if (cols === 8 && rows === 8) step = NaN;\n    var w = cols * step, h = rows * step;",
      why:"NaN makes every later comparison quietly false, so it has to be rejected before anything is compared" },
    { file:"index", via:"index", expect:"draws <text> inside an SVG",
      find:"  function svgEl(tag, attrs){\n    var el = document.createElementNS(NS, tag);",
      replace:"  function svgEl(tag, attrs){\n    if (tag === 'x') document.createElementNS(NS, \"text\");\n    var el = document.createElementNS(NS, tag);",
      why:"a label drawn into the SVG can be clipped by the canvas; this lesson keeps every label in HTML" },
    { file:"index", via:"index", expect:"the page draws into viewBox(es)",
      find:"        <svg class=\"dotfig\" id=\"s1fig\" viewBox=\"0 0 460 300\" xmlns=\"http://www.w3.org/2000/svg\"></svg>",
      replace:"        <svg class=\"dotfig\" id=\"s1fig\" viewBox='0 0 920 600' xmlns=\"http://www.w3.org/2000/svg\"></svg>",
      why:"a second viewBox written with different quoting would silently draw at another scale" },
    /* --- 跨頁 --- */
    { file:"review", via:"index", expect:"review.html declares generators",
      find:"    { id:'stackWord', cat:'word',",
      replace:"    { id:'stackWordX', cat:'word',",
      why:"a renamed generator would silently lose its invariants, oracle and render checks" },
    { file:"review", via:"index", expect:"review.html no longer uses the pinned layout constants",
      find:"  var FIG_W = 340, FIG_H = 210;",
      replace:"  var FIG_W = 320, FIG_H = 210;",
      why:"the review canvas would shrink without the geometry checks noticing" },
    { file:"reference", via:"index", expect:"reference.html no longer uses the pinned layout constants",
      find:"  var FIG_PAD = 18, STEP_MAX = 34, DOT_RATIO = 0.3;",
      replace:"  var FIG_PAD = 4, STEP_MAX = 34, DOT_RATIO = 0.3;",
      why:"the cheat sheet would let its dots run to the edge of the canvas" },
    { file:"index", via:"index", expect:"must appear at least",
      find:"      s1note:'💬 <strong>「第幾個」和「每排幾個」是同一個數</strong>，因為正方形的橫邊和直邊一樣長。所以<strong>第 n 個正方形數 ＝ n × n</strong>。正方形數也叫<strong>平方數</strong>。',",
      replace:"      s1note:'💬 <strong>「第幾個」和「每排幾個」是同一個數</strong>，因為正方形的橫邊和直邊一樣長。正方形數也叫<strong>平方數</strong>。',",
      why:"one of the two copies of the shortcut would go missing from the lesson page" },
    { file:"reference", via:"index", expect:"must appear at least",
      find:"      f3:'第 n 個三角形數 ＝ n × (n ＋ 1) ÷ 2<span class=\"cond\">n × (n ＋ 1) 是相鄰的兩個數相乘，一定是偶數，所以永遠除得盡</span>',",
      replace:"      f3:'三角形數的捷徑<span class=\"cond\">n × (n ＋ 1) 是相鄰的兩個數相乘，一定是偶數，所以永遠除得盡</span>',",
      why:"the cheat sheet would stop stating the shortcut in the same words as the lesson" },
    { file:"parents", via:"index", expect:"must appear at least",
      find:"      readyBox:'精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「圖形數實驗室接委託」有通關</strong>",
      replace:"      readyBox:'精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲有通關</strong>",
      why:"the mastery bar would stop naming the game a parent has to look for" },
    { file:"review", via:"index", expect:"must appear at least",
      find:"      capTri:function(n, v){ return '🔵 第 ' + n + ' 個三角形數：一排比一排多 1 個，一共 ' + v + ' 個點'; },",
      replace:"      capTri:function(n, v){ return '🔵 第 ' + n + ' 個三角形數：一共 ' + v + ' 個點'; },",
      why:"the generated captions would stop stating the rule that defines a triangular number" },
    { file:"index", via:"index", expect:"must never say",
      find:"      s5note:'⚠️ 差在長大的時候，",
      replace:"      s5note:'⚠️ 差在長大的規律都有捷徑。差在長大的時候，",
      why:"the lesson would over-claim: only these two shape numbers get a shortcut" },

    /* --- 產生器（simgen 跑 review.html） --- */
    { file:"review", expect:"added instead of multiplied",
      find:"          var opts = numOpts(v, [n + n, sqNum(n - 1), sqNum(n + 1), rectDots(n)], [n]);\n          if (!opts) return null;\n          if (opts.indexOf(n + n) < 0) return null;",
      replace:"          var opts = numOpts(v, [sqNum(n - 1), sqNum(n + 1), rectDots(n)], [n]);\n          if (!opts) return null;",
      why:"the headline square-number misconception would stop being offered" },
    { file:"review", expect:"forgot to divide by 2",
      find:"          var opts = numOpts(v, [rectDots(n), sqNum(n), triNum(n - 1), triNum(n + 1)], [n]);\n          if (!opts) return null;\n          if (opts.indexOf(rectDots(n)) < 0) return null;",
      replace:"          var opts = numOpts(v, [sqNum(n), triNum(n - 1), triNum(n + 1)], [n]);\n          if (!opts) return null;",
      why:"the headline triangular-number misconception would stop being offered" },
    { file:"review", expect:"but counting the two squares gives",
      find:"          var n = 3 + rand(N_FIG - 2);          // 3~6，圖上畫第 n 個\n          var v = sqGapOf(n);",
      replace:"          var n = 3 + rand(N_FIG - 2);          // 3~6，圖上畫第 n 個\n          var v = sqGapOf(n) + 2;",
      why:"the growth would be the L-shape after the right one" },
    { file:"review", expect:"but counting the two triangles gives",
      find:"          var n = 2 + rand(N_FIG - 1);          // 2~6，圖上畫第 n 個\n          var v = triGapOf(n);",
      replace:"          var n = 2 + rand(N_FIG - 1);          // 2~6，圖上畫第 n 個\n          var v = triGapOf(n) + 1;",
      why:"the new row would hold one dot too many" },
    { file:"review", expect:"but adding the L-shapes gives",
      find:"          var n = 3 + rand(7);                  // 3~9 個奇數\n          var v = oddSumOf(n);",
      replace:"          var n = 3 + rand(7);                  // 3~9 個奇數\n          var v = oddSumOf(n) + 1;",
      why:"the sum of the odd numbers would stop landing on a square number" },
    { file:"review", expect:"but counting the grid gives",
      find:"          var n = 2 + rand(N_FIG - 1);          // 2~6\n          var v = rectDots(n);",
      replace:"          var n = 2 + rand(N_FIG - 1);          // 2~6\n          var v = rectDots(n) + 1;",
      why:"the rectangle would stop being exactly two triangular numbers" },
    { file:"review", expect:"both neighbouring positions are required",
      find:"          var opts = numOpts(n, [n - 1, n + 1, n + 2, n - 2], [v]);\n          if (!opts) return null;\n          if (opts.indexOf(n - 1) < 0 || opts.indexOf(n + 1) < 0) return null;\n          return { n:n, v:v, opts:opts, ans:opts.indexOf(n) };\n        });\n      },\n      fmt:function(d, lang){\n        return {\n          stem: lang === 'zh'\n            ? '<strong>' + d.v + '</strong> 是第幾個正方形數？'",
      replace:"          var opts = numOpts(n, [n + 3, n + 4, n + 5, n + 6], [v]);\n          if (!opts) return null;\n          return { n:n, v:v, opts:opts, ans:opts.indexOf(n) };\n        });\n      },\n      fmt:function(d, lang){\n        return {\n          stem: lang === 'zh'\n            ? '<strong>' + d.v + '</strong> 是第幾個正方形數？'",
      why:"the off-by-one that going backwards is all about would stop being offered" },
    { file:"review", expect:"was meant to fit nothing but fits",
      find:"            vals = runOf('tri', 1 + rand(6), 4).map(function(x){ return x + 1; });\n          }\n          /* 這一條目前恆為假（設定檔的窮舉掃描證明過：這四種構造各自只會落在自己那一類）。\n             留著是防護網 —— 哪天上面的構造改了，它會擋下不符合的那一批。 */\n          if (kindOf(vals) !== want) return null;",
      replace:"            vals = runOf('tri', 1 + rand(6), 4).map(function(x){ return x; });\n          }\n          /* 這一條目前恆為假（設定檔的窮舉掃描證明過：這四種構造各自只會落在自己那一類）。\n             留著是防護網 —— 哪天上面的構造改了，它會擋下不符合的那一批。 */\n          if (want !== 'other' && kindOf(vals) !== want) return null;",
      why:"the “none of these” run would secretly be a triangular run" },
    { file:"review", expect:"is both kinds at once",
      find:"          if (other(v)) return null;",
      replace:"          if (false) return null;",
      why:"36 is both kinds, so the explanation could not say the other options are not" },
    { file:"review", expect:"is also the kind being asked about",
      find:"          var cross = (want === 'tri') ? sqNum(m) : triNum(m);\n          if (!inRange(cross) || cross === v || isWant(cross)) return null;\n          var pool = [cross, v + 1, v - 1, v + 2, v - 2, v + 3, v - 3, v + 4];\n          var out = [v], seen = {};\n          seen[String(v)] = 1;\n          for (var i = 0; i < pool.length && out.length < 4; i++){\n            var x = pool[i];\n            if (!inRange(x) || seen[String(x)] || isWant(x)) continue;",
      replace:"          var cross = (want === 'tri') ? triNum(m) : sqNum(m);\n          if (!inRange(cross) || cross === v) return null;\n          var pool = [cross, v + 1, v - 1, v + 2, v - 2, v + 3, v - 3, v + 4];\n          var out = [v], seen = {};\n          seen[String(v)] = 1;\n          for (var i = 0; i < pool.length && out.length < 4; i++){\n            var x = pool[i];\n            if (!inRange(x) || seen[String(x)]) continue;",
      why:"a second option would also be the kind being asked about, so two answers would be right" },
    { file:"review", expect:"is not shape number",
      find:"          var m = 3 + rand(8);\n          var cross = (want === 'tri') ? sqNum(m) : triNum(m);",
      replace:"          var m = 3 + rand(8);\n          var cross = (want === 'tri') ? sqNum(m + 1) : triNum(m + 1);",
      why:"the explanation names which one the cross-kind distractor is, so that bookkeeping has to be right" },
    { file:"review", expect:"the other-kind distractor is missing",
      find:"          var pool = [cross, v + 1, v - 1, v + 2, v - 2, v + 3, v - 3, v + 4];\n          var out = [v], seen = {};\n          seen[String(v)] = 1;\n          for (var i = 0; i < pool.length && out.length < 4; i++){\n            var x = pool[i];\n            if (!inRange(x) || seen[String(x)] || isWant(x)) continue;\n            seen[String(x)] = 1;\n            out.push(x);\n          }\n          if (out.length !== 4) return null;\n          if (out.indexOf(cross) < 0) return null;",
      replace:"          var pool = [v + 1, v - 1, v + 2, v - 2, cross, v + 3, v - 3, v + 4];\n          var out = [v], seen = {};\n          seen[String(v)] = 1;\n          for (var i = 0; i < pool.length && out.length < 4; i++){\n            var x = pool[i];\n            if (!inRange(x) || seen[String(x)] || isWant(x)) continue;\n            seen[String(x)] = 1;\n            out.push(x);\n          }\n          if (out.length !== 4) return null;",
      why:"the near misses would fill every slot first and the question would stop asking which kind it is" },
    { file:"review", expect:"printed in the stem is offered as an option",
      find:"          var opts = numOpts(v, [rectDots(n), sqNum(n), triNum(n - 1), triNum(n + 1)], [n, 1]);",
      replace:"          var opts = numOpts(v, [n, rectDots(n), sqNum(n), triNum(n - 1)], []);",
      why:"the bottom-row size would be offered back as the total" },
    { file:"review", expect:"was not worked out from the last gap",
      find:"          var flat = vals[3] + gaps[2];           // 以為每次加一樣多",
      replace:"          var flat = vals[3] + gaps[0];           // 以為每次加一樣多",
      why:"the “same gap every time” distractor would use the first gap, not the one a child would carry on with" },
    { file:"review", expect:"the reference gives",
      find:"          var v = (kind === 'tri') ? triNum(s + 4) : sqNum(s + 4);",
      replace:"          var v = (kind === 'tri') ? triNum(s + 5) : sqNum(s + 5);",
      why:"the next term would skip one position" },
    { file:"review", expect:"does not match the pinned wording word for word",
      find:"            ? '第 <strong>' + d.n + '</strong> 個正方形數是多少？'",
      replace:"            ? '第 <strong>' + d.n + '</strong> 個正方形數是多少呢？'",
      why:"a stem that drifts from the pinned wording can quietly start asking something else" },
    { file:"review", expect:"the caption does not match the pinned wording",
      find:"          cap: TXT[lang].capSq(d.n, sqNum(d.n)),",
      replace:"          cap: TXT[lang].capSq(d.n + 1, sqNum(d.n + 1)),",
      why:"the caption would describe a different picture from the one drawn" },
    { file:"review", expect:"which is the answer this question asks for",
      find:"          cap: TXT[lang].capRect(d.n),",
      replace:"          cap: TXT[lang].capRect(d.n) + '　' + d.v,",
      why:"a caption that finishes the multiplication turns this question into copying" },
    { file:"review", expect:"the plan says n=",
      find:"          fig: figOf('sq', d.n),",
      replace:"          fig: figOf('sq', d.n + 1),",
      why:"the picture would already show the grown square, giving the answer away" },
    { file:"review", expect:"the picture reports",
      find:"    plan.total = plan.dots.length;",
      replace:"    plan.total = plan.dots.length + 1;",
      why:"the picture would claim one more dot than it draws" },
    { file:"review", expect:"arithmetic is wrong",
      find:"' ＝ ' + sqNum(k) + ' － ' + sqNum(d.n) + ' ＝ ' + d.v + '。答 '",
      replace:"' ＝ ' + (sqNum(k) + 1) + ' － ' + sqNum(d.n) + ' ＝ ' + d.v + '。答 '",
      why:"the check inside the explanation would print a sum that does not add up" },
    { file:"review", expect:"shows a negative number",
      find:"'。（答 ' + sqNum(d.n - 1) + ' 是只加了 '",
      replace:"'。（答 －' + sqNum(d.n - 1) + ' 是只加了 '",
      why:"grade 4 has not met negative numbers, so none may reach the page" },
    { file:"review", expect:"malformed English ordinal",
      find:"      capSq:function(n, v){ return '🔵 The ' + ordEn(n) + ' square number: '",
      replace:"      capSq:function(n, v){ return '🔵 The ' + n + 'th square number: '",
      why:"3th and 1th would reach the page" },
    { file:"review", expect:"opts[ans] != correct",
      find:"          opts: d.opts.map(String), ans:d.ans,\n          why: lang === 'zh'\n            ? '正方形數是幾排乘上每排幾個",
      replace:"          opts: d.opts.map(function(x){ return x + '.0'; }), ans:d.ans,\n          why: lang === 'zh'\n            ? '正方形數是幾排乘上每排幾個",
      why:"this lesson has no decimals, and the second implementation of the answer must catch the format drifting" }
  ],

  /* ================= review.html 產生器 ================= */
  sim: {
    INVARIANTS: {
      sqNth: d => {
        if (!d) return 'sqNth: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.n >= 3 && d.n <= N_MAX_REF)) return 'sqNth: n=' + d.n + ' is outside the lesson range 3..' + N_MAX_REF;
        if (d.v !== sqRef(d.n)) return 'sqNth: v=' + d.v + ' but counting an ' + d.n + '×' + d.n + ' block of dots gives ' + sqRef(d.n);
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'sqNth: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.v) return 'sqNth: opts[ans] is not the square number being asked about';
        if (d.opts.indexOf(d.n + d.n) < 0)
          return 'sqNth: the "added instead of multiplied" distractor is missing, so the misconception is untested';
        if (d.opts.indexOf(d.n) >= 0) return 'sqNth: the position printed in the stem is offered as an option';
      },
      triNth: d => {
        if (!d) return 'triNth: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.n >= 3 && d.n <= N_MAX_REF)) return 'triNth: n=' + d.n + ' is outside the lesson range 3..' + N_MAX_REF;
        if (d.v !== triRef(d.n)) return 'triNth: v=' + d.v + ' but adding the rows gives ' + triRef(d.n);
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'triNth: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.v) return 'triNth: opts[ans] is not the triangular number being asked about';
        if (rectRef(d.n) === d.v) return 'triNth: the rectangle and the triangle came out equal, so the misconception cannot be told apart';
        if (d.opts.indexOf(rectRef(d.n)) < 0)
          return 'triNth: the "forgot to divide by 2" distractor is missing, so the headline misconception is untested';
      },
      sqGrow: d => {
        if (!d) return 'sqGrow: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.n >= 3 && d.n <= N_FIG_REF)) return 'sqGrow: n=' + d.n + ' is outside the drawable range 3..' + N_FIG_REF;
        if (d.v !== sqRef(d.n + 1) - sqRef(d.n))
          return 'sqGrow: the growth is ' + d.v + ' but counting the two squares gives ' + (sqRef(d.n + 1) - sqRef(d.n));
        /* 「這個成長就是下一個 L 形」「而且一定是奇數」兩件事，data.check 對 n=1~40
           已經逐一證明過；在這裡它們永遠輪不到第一個響，不留假的覆蓋率。 */
        if (d.opts.indexOf(gnomonRef(d.n)) < 0)
          return 'sqGrow: the previous L-shape distractor is missing, so the off-by-one is untested';
        if (d.opts[d.ans] !== d.v) return 'sqGrow: opts[ans] is not the number of dots added';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'sqGrow: options are not four distinct numbers';
      },
      triGrow: d => {
        if (!d) return 'triGrow: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.n >= 2 && d.n <= N_FIG_REF)) return 'triGrow: n=' + d.n + ' is outside the drawable range 2..' + N_FIG_REF;
        if (d.v !== triRef(d.n + 1) - triRef(d.n))
          return 'triGrow: the new row holds ' + d.v + ' but counting the two triangles gives ' + (triRef(d.n + 1) - triRef(d.n));
        if (d.opts.indexOf(2 * d.n + 1) < 0)
          return 'triGrow: the square-number L-shape distractor is missing, so mixing the two rules up is untested';
        if (d.opts[d.ans] !== d.v) return 'triGrow: opts[ans] is not the size of the new row';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'triGrow: options are not four distinct numbers';
      },
      oddSum: d => {
        if (!d) return 'oddSum: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.n >= 3 && d.n <= 9)) return 'oddSum: n=' + d.n + ' is outside the range 3..9';
        if (d.v !== oddSumRef(d.n)) return 'oddSum: the sum is ' + d.v + ' but adding the L-shapes gives ' + oddSumRef(d.n);
        if (d.opts.indexOf(sqRef(d.n - 1)) < 0)
          return 'oddSum: the "one odd number short" distractor is missing, so the off-by-one is untested';
        if (d.opts[d.ans] !== d.v) return 'oddSum: opts[ans] is not the sum';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'oddSum: options are not four distinct numbers';
      },
      triRect: d => {
        if (!d) return 'triRect: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.n >= 2 && d.n <= N_FIG_REF)) return 'triRect: n=' + d.n + ' is outside the drawable range 2..' + N_FIG_REF;
        if (d.v !== rectRef(d.n)) return 'triRect: the rectangle holds ' + d.v + ' but counting the grid gives ' + rectRef(d.n);
        if (d.opts.indexOf(triRef(d.n)) < 0)
          return 'triRect: the "only one triangle" distractor is missing, so the misconception is untested';
        if (d.opts[d.ans] !== d.v) return 'triRect: opts[ans] is not the size of the rectangle';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'triRect: options are not four distinct numbers';
      },
      sqWhich: d => {
        if (!d) return 'sqWhich: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (whichSqRef(d.v) !== d.n) return 'sqWhich: ' + d.v + ' is square number ' + whichSqRef(d.v) + ', not ' + d.n;
        if (!(d.n >= 3 && d.n <= N_MAX_REF)) return 'sqWhich: n=' + d.n + ' is outside the lesson range 3..' + N_MAX_REF;
        if (d.opts.indexOf(d.n - 1) < 0 || d.opts.indexOf(d.n + 1) < 0)
          return 'sqWhich: both neighbouring positions are required as distractors, or the off-by-one is untested';
        if (d.opts.indexOf(d.v) >= 0) return 'sqWhich: the value printed in the stem is offered as a position';
        if (d.opts[d.ans] !== d.n) return 'sqWhich: opts[ans] is not the position';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'sqWhich: options are not four distinct numbers';
      },
      triWhich: d => {
        if (!d) return 'triWhich: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (whichTriRef(d.v) !== d.n) return 'triWhich: ' + d.v + ' is triangular number ' + whichTriRef(d.v) + ', not ' + d.n;
        if (!(d.n >= 3 && d.n <= N_MAX_REF)) return 'triWhich: n=' + d.n + ' is outside the lesson range 3..' + N_MAX_REF;
        if (d.opts.indexOf(d.n - 1) < 0 || d.opts.indexOf(d.n + 1) < 0)
          return 'triWhich: both neighbouring positions are required as distractors, or the off-by-one is untested';
        if (d.opts.indexOf(d.v) >= 0) return 'triWhich: the value printed in the stem is offered as a position';
        if (d.opts[d.ans] !== d.n) return 'triWhich: opts[ans] is not the position';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'triWhich: options are not four distinct numbers';
      },
      whichKind: d => {
        if (!d) return 'whichKind: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.vals.length !== 4) return 'whichKind: a run of ' + d.vals.length + ' numbers is not what this question shows';
        for (const v of d.vals) if (!inRangeRef(v)) return 'whichKind: ' + v + ' is outside 1..' + OPT_MAX_REF;
        const fits = kindFitsRef(d.vals);
        if (d.want !== 'other' && fits.length !== 1)
          return 'whichKind: the run [' + d.vals + '] fits ' + fits.length + ' models (' + fits.join(', ') +
                 '), so the question has more than one defensible answer';
        if (d.want === 'other' && fits.length !== 0)
          return 'whichKind: the run [' + d.vals + '] was meant to fit nothing but fits ' + fits.join(', ');
        if (d.want !== kindRef(d.vals)) return 'whichKind: want=' + d.want + ' but the reference says ' + kindRef(d.vals);
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'whichKind: options are not the four kind labels';
        for (const k of ['tri', 'sq', 'arith', 'other']) if (d.opts.indexOf(k) < 0)
          return 'whichKind: label "' + k + '" is missing from the options';
        if (d.opts[d.ans] !== d.want) return 'whichKind: opts[ans] is not the kind the run actually is';
      },
      pickFigurate: d => {
        if (!d) return 'pickFigurate: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.want !== 'tri' && d.want !== 'sq') return 'pickFigurate: the kind asked about is ' + d.want;
        const isWant = d.want === 'tri' ? whichTriRef : whichSqRef;
        const isOther = d.want === 'tri' ? whichSqRef : whichTriRef;
        if (isWant(d.v) !== d.n) return 'pickFigurate: ' + d.v + ' is not shape number ' + d.n + ' of that kind';
        if (isOther(d.v) > 0)
          return 'pickFigurate: the answer ' + d.v + ' is both kinds at once, so the explanation cannot say the others are not';
        /* ⚠️ 這一題問的是「是哪一種」，所以選項裡一定要有一個**另一種**圖形數。
           少了它，四個選項就只剩「正解和它旁邊三個數」，考的變成算術而不是分類。 */
        /* ⚠️ 順序：「不可以是同一種」要排在「是另一種的第幾個」前面 ——
           反過來的話，任何把 cross 換成同一種的改壞都會先撞上記帳那一條，
           而真正的主張（兩個選項不可以都對）就從來沒有被證明過。 */
        if (isWant(d.cross) > 0) return 'pickFigurate: the cross-kind distractor ' + d.cross + ' is also the kind being asked about';
        if (isOther(d.cross) !== d.m) return 'pickFigurate: cross=' + d.cross + ' is not shape number ' + d.m + ' of the other kind';
        if (d.cross === d.v) return 'pickFigurate: the cross-kind distractor coincides with the answer';
        if (d.opts.indexOf(d.cross) < 0)
          return 'pickFigurate: the other-kind distractor is missing, so the question stops asking which kind it is';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'pickFigurate: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.v) return 'pickFigurate: opts[ans] is not the figurate number';
        for (const o of d.opts){
          if (!inRangeRef(o)) return 'pickFigurate: option ' + o + ' is outside 1..' + OPT_MAX_REF;
          if (o !== d.v && isWant(o) > 0)
            return 'pickFigurate: distractor ' + o + ' is also that kind of shape number, so two options are right';
        }
      },
      stackWord: d => {
        if (!d) return 'stackWord: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.n >= 4 && d.n <= N_MAX_REF)) return 'stackWord: n=' + d.n + ' is outside the range 4..' + N_MAX_REF;
        if (d.v !== triRef(d.n)) return 'stackWord: the stack holds ' + d.v + ' but adding the rows gives ' + triRef(d.n);
        if (d.opts.indexOf(rectRef(d.n)) < 0)
          return 'stackWord: the "forgot to divide by 2" distractor is missing, so the headline misconception is untested';
        if (d.opts[d.ans] !== d.v) return 'stackWord: opts[ans] is not the number of cans';
        if (d.opts.indexOf(d.n) >= 0) return 'stackWord: the bottom-row size printed in the stem is offered as an option';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'stackWord: options are not four distinct numbers';
      },
      nextTerm: d => {
        if (!d) return 'nextTerm: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.kind !== 'tri' && d.kind !== 'sq') return 'nextTerm: the run kind is ' + d.kind;
        const table = d.kind === 'tri' ? TRI_TABLE : SQ_TABLE;
        for (let i = 0; i < 4; i++) if (d.vals[i] !== table[d.s + i - 1])
          return 'nextTerm: the run [' + d.vals + '] is not four consecutive shape numbers from position ' + d.s;
        if (d.v !== table[d.s + 3]) return 'nextTerm: the next term is ' + d.v + ', the reference gives ' + table[d.s + 3];
        const g = gapsRef(d.vals);
        if (String(g) !== String(d.gaps)) return 'nextTerm: the gaps are [' + d.gaps + '], the reference gives [' + g + ']';
        for (let i = 1; i < g.length; i++) if (!(g[i] > g[i - 1]))
          return 'nextTerm: the gaps [' + g + '] are not strictly growing, which is the whole point of this question';
        if (d.flat !== d.vals[3] + g[g.length - 1])
          return 'nextTerm: the "same gap every time" distractor was not worked out from the last gap';
        if (d.flat === d.v) return 'nextTerm: the "same gap every time" distractor coincides with the answer';
        if (d.opts.indexOf(d.flat) < 0)
          return 'nextTerm: the "same gap every time" distractor is missing, so the misconception is untested';
        if (d.opts[d.ans] !== d.v) return 'nextTerm: opts[ans] is not the next term';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'nextTerm: options are not four distinct numbers';
        for (const o of d.opts) if (o !== d.v && d.vals.indexOf(o) >= 0)
          return 'nextTerm: distractor ' + o + ' is already printed in the stem';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不呼叫 review.html 的函式，分類的字典也用設定檔自己那一張。 */
    expectedCorrect: function(d, genId, lang){
      if (genId === 'sqNth') return String(sqRef(d.n));
      if (genId === 'triNth') return String(triRef(d.n));
      if (genId === 'sqGrow') return String(sqRef(d.n + 1) - sqRef(d.n));
      if (genId === 'triGrow') return String(triRef(d.n + 1) - triRef(d.n));
      if (genId === 'oddSum') return String(oddSumRef(d.n));
      if (genId === 'triRect') return String(rectRef(d.n));
      if (genId === 'sqWhich') return String(whichSqRef(d.v));
      if (genId === 'triWhich') return String(whichTriRef(d.v));
      if (genId === 'whichKind') return KIND_REF[lang][kindRef(d.vals)];
      if (genId === 'pickFigurate') return String(d.want === 'tri' ? triRef(d.n) : sqRef(d.n));
      if (genId === 'stackWord') return String(triRef(d.n));
      if (genId === 'nextTerm') return String((d.kind === 'tri' ? TRI_TABLE : SQ_TABLE)[d.s + 3]);
      return null;
    },

    /* 這一課的選項長什麼樣。正解與誘答分開驗。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (genId === 'whichKind'){
        const names = Object.keys(KIND_REF[lang]).map(k => KIND_REF[lang][k]);
        if (names.indexOf(s) < 0) return 'whichKind option "' + s + '" is not one of the four kind labels';
        return null;
      }
      if (GEN_IDS.indexOf(genId) < 0) return 'no optionOk rule for generator ' + genId;
      if (!/^\d+$/.test(s)) return genId + ' option "' + s + '" is not a whole number';
      const n = Number(s);
      if (!inRangeRef(n)) return genId + ' option ' + n + ' is outside 1..' + OPT_MAX_REF;
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次。INVARIANTS 只看得到資料，
       看不到題幹、解釋與圖 —— 而那三樣都是拼出來的。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!d) return 'make() returned nothing';
      const R = FIG_REF.review;

      /* 「問的是什麼」單獨驗一次：只驗數字的話，把題幹改成問別的、正解不動，全部都是綠的。 */
      const ASK = {
        zh:{
          sqNth:        { must:['個正方形數是多少'], never:['三角形'] },
          triNth:       { must:['個三角形數是多少'], never:['正方形'] },
          sqGrow:       { must:['要補幾個點'], never:['一共'] },
          triGrow:      { must:['要在下面加一排幾個點'], never:['一共'] },
          oddSum:       { must:['＝ ？'], never:['第幾個'] },
          triRect:      { must:['長方形一共有幾個點'], never:['第幾個'] },
          sqWhich:      { must:['是第幾個正方形數'], never:['三角形'] },
          triWhich:     { must:['是第幾個三角形數'], never:['正方形'] },
          whichKind:    { must:['這是哪一種'], never:['第幾個'] },
          pickFigurate: { must:['下面哪一個數是'], never:['第幾個'] },
          stackWord:    { must:['一共有幾罐'], never:['第幾個'] },
          nextTerm:     { must:['下一個是多少'], never:['第幾個'] }
        },
        en:{
          sqNth:        { must:['what is the', 'square number'], never:['triangular'] },
          triNth:       { must:['what is the', 'triangular number'], never:['square'] },
          sqGrow:       { must:['how many dots get added'], never:['altogether'] },
          triGrow:      { must:['how many dots go in the new bottom row'], never:['altogether'] },
          oddSum:       { must:['= ?'], never:['which'] },
          triRect:      { must:['how many dots does that rectangle hold'], never:['which'] },
          sqWhich:      { must:['which position is'], never:['triangular'] },
          triWhich:     { must:['which position is'], never:['square'] },
          whichKind:    { must:['what kind is it'], never:['which one'] },
          pickFigurate: { must:['which of these is a'], never:['which one is'] },
          stackWord:    { must:['how many cans are there'], never:['which'] },
          nextTerm:     { must:['what comes next'], never:['which one'] }
        }
      };
      const ask = ASK[lang][genId];
      if (!ask) out.push('no ASK entry for ' + genId + ' in ' + lang);
      else {
        const hay = lang === 'en' ? q.stem.toLowerCase() : q.stem;
        for (const m of ask.must) if (hay.indexOf(lang === 'en' ? m.toLowerCase() : m) < 0)
          out.push('stem never says "' + m + '"');
        for (const nv of ask.never) if (hay.indexOf(lang === 'en' ? nv.toLowerCase() : nv) >= 0)
          out.push('stem says "' + nv + '", which is a different question');
      }

      /* ⚠️ 子字串的釘樁永遠留得下空間：在合法的那一句後面再接一句問別的、
         或在前面加一句「不是在問…」，每一條子字串斷言都還是綠的。
         唯一釘得死的做法是**把整句題幹重建一次**（第二套實作）：多一個字少一個字都對不上。 */
      const list = a => a.join(lang === 'zh' ? '、' : ', ');
      const oddsRef = n => { const o = []; for (let k = 1; k <= n; k++) o.push(gnomonRef(k)); return o; };
      const STEM_EXACT = {
        zh:{
          sqNth:        () => '第 <strong>' + d.n + '</strong> 個正方形數是多少？',
          triNth:       () => '第 <strong>' + d.n + '</strong> 個三角形數是多少？',
          sqGrow:       () => '從第 <strong>' + d.n + '</strong> 個正方形數長到第 <strong>' + (d.n + 1) + '</strong> 個，要補幾個點？',
          triGrow:      () => '從第 <strong>' + d.n + '</strong> 個三角形數長到第 <strong>' + (d.n + 1) + '</strong> 個，要在下面加一排幾個點？',
          oddSum:       () => '<strong>' + oddsRef(d.n).join(' ＋ ') + '</strong> ＝ ？',
          triRect:      () => '兩個第 <strong>' + d.n + '</strong> 個三角形數拼成一個長方形。這個長方形一共有幾個點？',
          sqWhich:      () => '<strong>' + sqRef(d.n) + '</strong> 是第幾個正方形數？',
          triWhich:     () => '<strong>' + triRef(d.n) + '</strong> 是第幾個三角形數？',
          whichKind:    () => '一串數字是 <strong>' + list(d.vals.map(String)) + '</strong>。這是哪一種？',
          pickFigurate: () => '下面哪一個數是<strong>' + (d.want === 'tri' ? '三角形數' : '正方形數') + '</strong>？',
          stackWord:    () => '罐頭疊成一個三角形，最下面一排 <strong>' + d.n + '</strong> 罐，每往上一排少 1 罐，最上面一排 1 罐。一共有幾罐？',
          nextTerm:     () => '一串圖形數是 <strong>' + list(d.vals.map(String)) + '</strong>。下一個是多少？'
        },
        en:{
          sqNth:        () => 'What is the <strong>' + ordEnRef(d.n) + '</strong> square number?',
          triNth:       () => 'What is the <strong>' + ordEnRef(d.n) + '</strong> triangular number?',
          sqGrow:       () => 'Growing from the <strong>' + ordEnRef(d.n) + '</strong> square number to the <strong>' + ordEnRef(d.n + 1) + '</strong>, how many dots get added?',
          triGrow:      () => 'Growing from the <strong>' + ordEnRef(d.n) + '</strong> triangular number to the <strong>' + ordEnRef(d.n + 1) + '</strong>, how many dots go in the new bottom row?',
          oddSum:       () => '<strong>' + oddsRef(d.n).join(' + ') + '</strong> = ?',
          triRect:      () => 'Two <strong>' + ordEnRef(d.n) + '</strong> triangular numbers are fitted together into a rectangle. How many dots does that rectangle hold?',
          sqWhich:      () => 'Which position is <strong>' + sqRef(d.n) + '</strong> in the square numbers?',
          triWhich:     () => 'Which position is <strong>' + triRef(d.n) + '</strong> in the triangular numbers?',
          whichKind:    () => 'A run of numbers goes <strong>' + list(d.vals.map(String)) + '</strong>. What kind is it?',
          pickFigurate: () => 'Which of these is a <strong>' + (d.want === 'tri' ? 'triangular number' : 'square number') + '</strong>?',
          stackWord:    () => 'Cans are stacked in a triangle with <strong>' + d.n + '</strong> cans along the bottom row, one fewer in each row going up, and 1 can on top. How many cans are there?',
          nextTerm:     () => 'A run of shape numbers goes <strong>' + list(d.vals.map(String)) + '</strong>. What comes next?'
        }
      };
      if (!STEM_EXACT[lang][genId]) out.push('no STEM_EXACT entry for ' + genId + ' in ' + lang);
      else {
        const want = STEM_EXACT[lang][genId]();
        if (q.stem !== want)
          out.push('the rendered stem does not match the pinned wording word for word:\n    got  ' +
                   q.stem + '\n    want ' + want);
      }

      /* 解釋裡的每一條算式都要真的算對，而且至少要有一條
         （純敘述型的那一支除外 —— 它的解釋本來就沒有算式）。 */
      const ar = arithProblems(q.why);
      for (const p of ar.problems) out.push('why: ' + p);
      const NO_EQUATION_OK = ['whichKind'];
      if (ar.verified < 1 && NO_EQUATION_OK.indexOf(genId) < 0)
        out.push('the explanation contains no checkable equation at all');

      /* 畫面上看得到的字：中文黏數字、英文的 1 與序數、重複標點、負數。 */
      for (const t of textProblems(q.stem, lang, 'stem')) out.push(t);
      for (const t of textProblems(q.why, lang, 'why')) out.push(t);
      for (let i = 0; i < q.opts.length; i++)
        for (const t of textProblems(q.opts[i], lang, 'option ' + i)) out.push(t);
      if (q.cap) for (const t of textProblems(q.cap, lang, 'caption')) out.push(t);

      /* 圖：有圖的題目必須真的畫出來，而且畫的是被計分的那一個圖形。 */
      const FIG_OF = { sqGrow:'sq', triGrow:'tri', triRect:'rect' };
      const wantKind = FIG_OF[genId] || null;
      if (wantKind && !q.fig) out.push(genId + ' rendered without a figure, but the question is about a picture');
      if (!wantKind && q.fig) out.push(genId + ' rendered a figure it should not have');
      if (q.fig && wantKind){
        const bad = checkPlan(q.fig, wantKind, d.n, R, genId + ' fig');
        if (bad.length) out.push(bad[0]);
        if (q.fig.total !== q.fig.dots.length)
          out.push(genId + ' fig: the picture reports ' + q.fig.total + ' dots but draws ' + q.fig.dots.length);
        /* ⚠️ 圖說和題幹同一個道理：子字串釘不死它，要整句重建。 */
        /* ⚠️ 圖說只能說「這是什麼圖」。triRect 問的就是長方形有幾個點，
           圖說一旦把那個乘法算完，這一題就變成用抄的（codex 抓到的最嚴重一筆）。 */
        if (wantKind === 'rect' && String(q.cap).indexOf(String(rectRef(d.n))) >= 0)
          out.push('the caption prints ' + rectRef(d.n) + ', which is the answer this question asks for');
        if (!q.cap) out.push('the picture has no caption');
        else {
          const n = d.n;
          const wantCap = (lang === 'zh')
            ? (wantKind === 'sq'
               ? '🔵 第 ' + n + ' 個正方形數：' + n + ' 排，每排 ' + n + ' 個，' + n + ' × ' + n + ' ＝ ' + sqRef(n) + ' 個點'
               : wantKind === 'tri'
               ? '🔵 第 ' + n + ' 個三角形數：一排比一排多 1 個，一共 ' + triRef(n) + ' 個點'
               : '🔵 兩個一樣的第 ' + n + ' 個三角形拼成的長方形（藍色一個、綠色一個）')
            : (wantKind === 'sq'
               ? '🔵 The ' + ordEnRef(n) + ' square number: ' + n + ' ' + plEnRef(n, 'row') + ' of ' + n + ', ' + n + ' × ' + n + ' = ' + sqRef(n) + ' ' + plEnRef(sqRef(n), 'dot')
               : wantKind === 'tri'
               ? '🔵 The ' + ordEnRef(n) + ' triangular number: each row holds one more than the row above, ' + triRef(n) + ' ' + plEnRef(triRef(n), 'dot') + ' in all'
               : '🔵 Two identical ' + ordEnRef(n) + ' triangular numbers fitted together into a rectangle (one blue, one green)');
          if (q.cap !== wantCap)
            out.push('the caption does not match the pinned wording word for word:\n    got  ' +
                     q.cap + '\n    want ' + wantCap);
        }
      }

      /* ⚠️ 一定要回字串或 null：空陣列在 JS 裡是 truthy，
         simgen 的 `if (r) fail(...)` 會把「沒問題」當成「有問題」。 */
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{sqNum, triNum, sqGap, triGap, gnomonSize, rectDots, oddList, oddSum, ' +
                'whichSq, whichTri, isSq, isTri, gapsOf, allSame, isRunOf, kindOf, plEn, ordEn, ' +
                'FIG_W, FIG_H, FIG_PAD, STEP_MAX, DOT_RATIO, gridPlan, dotsSq, dotsTri, dotsRect, dotPlan, ' +
                'S1_NS, S2_N, S3_NS, S4_NS, S5_RUNS, patternGuess, ROUNDS, roundAnswer, roundFig}',
    optionValueMax: OPT_MAX_REF,

    check: function(data, I18N, fail, rawSrc){
      const R = FIG_REF.index;
      /* ⚠️ 掃原始碼之前一定要把註解拿掉 —— HTML 註解和 JS 的區塊註解都可以拿來洗白：
         把一條被刪掉的規則、一個被刪掉的產生器宣告原封不動貼進註解，
         只比對字串的檢查就會以為它還在。 */
      const stripComments = s => (s === null || s === undefined) ? s
        /* ⚠️ 換成 '\n' 而不是 ''：換成空字串的話，註解**前後**的字會直接接在一起，
           生出原始碼裡根本不存在的匹配（`前半/*…*\/後半` 會變成完整的一句）。
           換成換行擋得住的是**逐字比對**的那一類，也就是 SIBLING 與 FORBIDDEN 這兩張表
           （它們比的是完整字串，不含任何寬鬆比對）。
           ⚠️ 這份檔案裡別處確實有含 \s* 的正規式（例如 createElementNS\s*\(），
              那一類仍然跨得過插進去的換行 —— 這一條保證的範圍就到逐字比對為止。 */
        : s.replace(/<!--[\s\S]*?-->/g, '\n')
           .replace(/\/\*[\s\S]*?\*\//g, '\n')
           /* ⚠️ `//` 只拿掉**整行都是註解**的那一種。
              行尾註解不能碰：`//` 也可能出現在字串或網址裡，一律吃到行尾的話，
              同一行上真正該被看到的字會跟著不見 —— 那是把一個洗白漏洞換成一個 fail-open。
              「把刪掉的宣告或句子貼成一整行註解」才是實際的洗白形狀，這一條就夠。 */
           .replace(/^[ \t]*\/\/[^\n]*$/gm, '');   /* 整行註解，換成空行不會把字接起來 */
      const src = stripComments(rawSrc);

      /* ---- 1. 版面常數必須對得上獨立寫死的規格 ---- */
      const CONSTS = [['FIG_W', R.W], ['FIG_H', R.H], ['FIG_PAD', R.PAD],
                      ['STEP_MAX', R.STEP], ['DOT_RATIO', R.RATIO]];
      for (const pair of CONSTS)
        if (data[pair[0]] !== pair[1]) fail('layout constant ' + pair[0] + ' is ' + data[pair[0]] + ', the spec says ' + pair[1]);
      /* ⚠️ 只認 `viewBox="0 0 460 300"` 這一種寫法的話，單引號、多一個空白、
         或是用 setAttribute 設進去的那一種都看不到。三種形狀一起收，再要求**每一個**
         都是釘住的那一組。
         ⚠️ 邊界：值是**變數**的 setAttribute('viewBox', v) 它讀不到。這一課三頁的 viewBox
            全部是字面常數（複習頁那一行另外被逐字釘住），所以目前沒有讀不到的那一種；
            哪天真的要用變數，這條檢查就必須跟著改，不可以放著當成有人在守。 */
      const viewBoxValues = [];
      for (const m of src.matchAll(/viewBox\s*=\s*(["'])([^"']*)\1/gi)) viewBoxValues.push(m[2].trim().replace(/\s+/g, ' '));
      for (const m of src.matchAll(/setAttribute\(\s*(["'])viewBox\1\s*,\s*(["'])([^"']*)\2/gi)) viewBoxValues.push(m[3].trim().replace(/\s+/g, ' '));
      const wantViewBox = '0 0 ' + R.W + ' ' + R.H;
      const viewBoxes = [...new Set(viewBoxValues)];
      if (viewBoxes.length !== 1 || viewBoxes[0] !== wantViewBox)
        fail('the page draws into viewBox(es) [' + viewBoxes.join(' / ') + '], the layout constants give "' + wantViewBox + '"');
      if (src.indexOf('max-width:' + R.W + 'px;height:' + R.H + 'px') < 0)
        fail('the .dotfig CSS size no longer matches the layout constants (' + R.W + '×' + R.H + ')');
      /* 圖上一個字都不該有 —— 這一課的說明全部寫在 HTML 裡，
         所以永遠不會踩到「SVG 標籤被畫布裁掉」那一類缺陷。
         ⚠️ 三種寫法都要認（markup 的 <text>、createElementNS、頁面自己的 svgEl），
            只認其中一種的話，換個寫法就整個溜過去。
         ⚠️ 邊界說清楚：它掃的是**整份原始碼的字面**，所以
            ① 用變數組出 'te' + 'xt' 這種寫法它看不到（那是對抗性的，不是意外）；
            ② 反過來，頁面上如果真的出現「<text>」這幾個字（例如教學範例），
               它會**誤報**——那是 fail-closed，會大聲壞掉，不會靜靜放行。
            這一課四頁都沒有程式碼範例，所以②不會發生。 */
      const drawsSvgText = s => /<text[\s>\/]/i.test(s) || /createElementNS\s*\([^)]*['"]text['"]/i.test(s) || /svgEl\s*\(\s*['"]text['"]/i.test(s);
      if (drawsSvgText(src))
        fail('the lesson page draws <text> inside an SVG; this lesson keeps every label in HTML so nothing can be clipped');

      /* ---- 2. 兩種圖形數：公式 vs 幾何，逐一比對 ---- */
      let numChecks = 0;
      for (let n = 1; n <= 40; n++){
        if (data.sqNum(n) !== sqRef(n)){ fail('sqNum(' + n + ') is ' + data.sqNum(n) + ', counting the dots gives ' + sqRef(n)); return; }
        if (data.triNum(n) !== triRef(n)){ fail('triNum(' + n + ') is ' + data.triNum(n) + ', adding the rows gives ' + triRef(n)); return; }
        if (data.gnomonSize(n) !== gnomonRef(n)){ fail('gnomonSize(' + n + ') is ' + data.gnomonSize(n) + ', counting the L-shape gives ' + gnomonRef(n)); return; }
        if (data.rectDots(n) !== rectRef(n)){ fail('rectDots(' + n + ') is ' + data.rectDots(n) + ', counting the rectangle gives ' + rectRef(n)); return; }
        if (data.oddSum(n) !== oddSumRef(n)){ fail('oddSum(' + n + ') is ' + data.oddSum(n) + ', adding the L-shapes gives ' + oddSumRef(n)); return; }
        const wantOdds = [];
        for (let k = 1; k <= n; k++) wantOdds.push(gnomonRef(k));
        if (String(data.oddList(n)) !== String(wantOdds)){
          fail('oddList(' + n + ') is [' + data.oddList(n) + '], the L-shapes give [' + wantOdds + ']'); return;
        }
        /* 課程明講的四件事，在整個範圍上證明一次，不是宣告。 */
        if (data.gnomonSize(n) % 2 !== 1){ fail('L-shape number ' + n + ' is not odd, but the lesson says every one of them is'); return; }
        if (data.oddSum(n) !== data.sqNum(n)){ fail('adding ' + n + ' consecutive odd numbers gives ' + data.oddSum(n) + ', not square number ' + n); return; }
        if (data.rectDots(n) !== 2 * data.triNum(n)){ fail('the rectangle for n=' + n + ' is not exactly two triangular numbers'); return; }
        if (data.sqNum(n + 1) - data.sqNum(n) !== data.sqGap(n)){ fail('sqGap(' + n + ') does not match the difference between consecutive square numbers'); return; }
        if (data.triNum(n + 1) - data.triNum(n) !== data.triGap(n)){ fail('triGap(' + n + ') does not match the difference between consecutive triangular numbers'); return; }
        if (data.sqGap(n) !== data.gnomonSize(n + 1)){ fail('growing a square is not the same as adding the next L-shape at n=' + n); return; }
        /* 三角形數永遠除得盡 —— 那是「n × (n ＋ 1) 一定是偶數」的具體證據。 */
        if (!Number.isInteger(data.triNum(n))){ fail('triNum(' + n + ') is not a whole number, but the lesson promises the halving always works out'); return; }
        numChecks++;
      }
      if (numChecks < 40) fail('the shape-number sweep only covered ' + numChecks + ' positions');
      /* 「差一直在長大」要真的驗，而且上一課的公式一定算得**太小**（課程明講）。 */
      for (let n = 1; n <= 20; n++){
        if (!(data.sqGap(n + 1) > data.sqGap(n))) fail('the square-number gaps stop growing at n=' + n);
        if (!(data.triGap(n + 1) > data.triGap(n))) fail('the triangular-number gaps stop growing at n=' + n);
      }
      for (const kind of ['tri', 'sq']){
        for (let len = 3; len <= 6; len++){
          for (let s = 1; s <= 8; s++){
            const vals = [];
            for (let i = 0; i < len; i++) vals.push(kind === 'tri' ? triRef(s + i) : sqRef(s + i));
            const guess = data.patternGuess(vals);
            /* ⚠️ 只驗「算出來比較小」的話，把 patternGuess 寫成 `return 0;` 也照樣過關。
               先要求它**真的是**上一課那條公式，再問它是不是太小。 */
            const guessRef = vals[0] + (vals.length - 1) * gapsRef(vals)[0];
            if (guess !== guessRef){
              fail('patternGuess([' + vals + ']) is ' + guess + ', but the earlier lesson’s formula gives ' + guessRef);
              return;
            }
            /* 這一條是**證明課文那句話**，不是守程式：patternGuess 一旦被證實就是上一課
               那條公式，「圖形數套下去一定偏小」就是一個數學事實，所以沒有改壞測試指得到它。
               它的價值在於：課文敢寫那句話，是因為這裡對整個取樣範圍算過。 */
            if (!(guess < vals[len - 1]))
              fail('the earlier lesson’s formula gives ' + guess + ' for [' + vals + '] but the real last term is ' +
                   vals[len - 1] + ' — the page claims it always comes out too small');
          }
        }
      }
      /* 反過來問「第幾個」：對整個選項範圍窮舉，命中與落空都驗。 */
      for (let v = 1; v <= OPT_MAX_REF; v++){
        if (data.whichSq(v) !== whichSqRef(v)){ fail('whichSq(' + v + ') is ' + data.whichSq(v) + ', the table gives ' + whichSqRef(v)); return; }
        if (data.whichTri(v) !== whichTriRef(v)){ fail('whichTri(' + v + ') is ' + data.whichTri(v) + ', the table gives ' + whichTriRef(v)); return; }
        if (data.isSq(v) !== (whichSqRef(v) > 0)){ fail('isSq(' + v + ') disagrees with the table'); return; }
        if (data.isTri(v) !== (whichTriRef(v) > 0)){ fail('isTri(' + v + ') disagrees with the table'); return; }
      }
      /* 課程明講「有的數兩種都是」，所以那件事要真的成立，而且要真的只有那兩個。 */
      const both = [];
      for (let v = 1; v <= OPT_MAX_REF; v++) if (whichSqRef(v) > 0 && whichTriRef(v) > 0) both.push(v);
      if (String(both) !== '1,36')
        fail('the numbers that are both kinds up to ' + OPT_MAX_REF + ' are [' + both + '], but the lesson names exactly 1 and 36');

      /* ---- 3. 分類：窮舉證明「剛好一種模型套得上」 ---- */
      let kindChecks = 0, sawTri = 0, sawSq = 0, sawArith = 0, sawOther = 0;
      /* 掃的是這一課用得到的**三個家族**（不是「所有長度 3 以上的數列」——那是無窮的）：
         ① 連著的三角形數、② 連著的正方形數、③ 三角形數整串 ＋ 1（產生器的「都不是」），
         再加上④ 每一項都 ≤ 200 的**所有**等差串，最後加一組手挑的對抗樣本。
         ⚠️ 每一族的組數都另外算一次（arithExpected 用封閉公式，兩個圖形數族用查表）。
            它擋得住的是「構造迴圈被縮小」——「visited === built」單獨看只是同一個迴圈
            自己比自己。它**擋不住**兩邊共用同一個邊界誤解，那要靠下面的對抗樣本。 */
      const runs = [];
      let arithBuilt = 0, arithExpected = 0, triBuilt = 0, sqBuilt = 0, otherBuilt = 0;
      for (let len = 3; len <= 6; len++){
        for (let s = 1; s + len - 1 <= REF_N; s++){
          if (triRef(s + len - 1) <= OPT_MAX_REF){
            const a = [], c = [];
            for (let i = 0; i < len; i++){ a.push(triRef(s + i)); c.push(triRef(s + i) + 1); }
            runs.push(a); runs.push(c);
            triBuilt++; otherBuilt++;
          }
          if (sqRef(s + len - 1) <= OPT_MAX_REF){
            const b = [];
            for (let i = 0; i < len; i++) b.push(sqRef(s + i));
            runs.push(b);
            sqBuilt++;
          }
        }
        for (let a0 = 1; a0 <= OPT_MAX_REF; a0++){
          for (let step = 1; a0 + (len - 1) * step <= OPT_MAX_REF; step++){
            const r = [];
            for (let i = 0; i < len; i++) r.push(a0 + i * step);
            runs.push(r);
            arithBuilt++;
          }
        }
        /* 封閉公式：固定 len 時，(a0, step) 的合法組數 ＝ Σ_step (OPT_MAX － (len－1)×step)。 */
        for (let step = 1; (len - 1) * step < OPT_MAX_REF; step++)
          arithExpected += OPT_MAX_REF - (len - 1) * step;
      }
      if (arithBuilt !== arithExpected)
        fail('the equal-gap family built ' + arithBuilt + ' runs but the closed form gives ' + arithExpected +
             ' — the sweep is not covering every run whose terms stay inside 1..' + OPT_MAX_REF);
      /* 手挑的對抗樣本：掃描只掃「由模型生成的串」等於從來沒測過別的形狀。 */
      const ADVERSARIAL = [
        [1, 4, 9], [1, 3, 6], [1, 1, 1], [2, 4, 8], [1, 2, 6, 24],
        [6, 10, 15], [4, 9, 16], [3, 6, 10], [36, 45, 55], [1, 36, 100],
        [9, 16, 25, 36], [10, 15, 21, 28], [5, 5, 5, 5], [2, 3, 5, 8]
      ];
      for (const vals of runs.concat(ADVERSARIAL)){
        const fits = kindFitsRef(vals);
        if (fits.length > 1)
          fail('the run [' + vals + '] fits ' + fits.length + ' models (' + fits.join(', ') +
               '), so "which kind is this" would have more than one right answer');
        /* ⚠️ 順序：kindOf 是用 gapsOf／allSame 算出來的，所以那兩條要排在**前面**，
           否則它們的改壞永遠先撞上 kindOf，兩條就從來沒有被證明過。 */
        if (String(data.gapsOf(vals)) !== String(gapsRef(vals))){ fail('gapsOf disagrees with the reference on [' + vals + ']'); return; }
        if (data.allSame(gapsRef(vals)) !== allSameRef(gapsRef(vals))){ fail('allSame disagrees with the reference on [' + vals + ']'); return; }
        if (data.kindOf(vals) !== kindRef(vals)){
          fail('kindOf([' + vals + ']) says ' + data.kindOf(vals) + ', the reference says ' + kindRef(vals)); return;
        }
        const k = kindRef(vals);
        if (k === 'tri') sawTri++; else if (k === 'sq') sawSq++; else if (k === 'arith') sawArith++; else sawOther++;
        kindChecks++;
      }
      /* ⚠️ 這一條**只**證明「迴圈把每一組都走完了，沒有中途 return」——
         它證明不了「建了夠多組」，那件事由下面每一族各自的數量負責。 */
      if (kindChecks !== runs.length + ADVERSARIAL.length)
        fail('the classification sweep visited ' + kindChecks + ' runs but ' + (runs.length + ADVERSARIAL.length) + ' were built');
      /* 每一族分開數：只說「總數比等差族多」的話，三族裡少了兩族照樣過關。
         ⚠️ 這裡的期望值用**查表**算（走 TRI_TABLE／SQ_TABLE），和上面逐項呼叫 triRef／sqRef
            不是同一條路，所以擋得住「構造迴圈被縮小」；但兩邊共用同一個上界（≤ 200）
            與同一個長度條件，共用的邊界誤解它擋不住 —— 那要靠 ADVERSARIAL 那一組。
         （索引對應驗算過：TRI_TABLE 是 0-indexed，i ↔ s = i + 1，
           所以構造的 s + len － 1 就是過濾的 i + len，兩邊一致。） */
      let triExpected = 0, sqExpected = 0;
      for (let len = 3; len <= 6; len++){
        triExpected += TRI_TABLE.filter((v, i) => i + len <= REF_N && TRI_TABLE[i + len - 1] <= OPT_MAX_REF).length;
        sqExpected  += SQ_TABLE.filter((v, i) => i + len <= REF_N && SQ_TABLE[i + len - 1] <= OPT_MAX_REF).length;
      }
      if (triBuilt !== triExpected) fail('the consecutive-triangular family built ' + triBuilt + ' runs, the table gives ' + triExpected);
      if (sqBuilt !== sqExpected) fail('the consecutive-square family built ' + sqBuilt + ' runs, the table gives ' + sqExpected);
      if (otherBuilt !== triExpected) fail('the "neither kind" family built ' + otherBuilt + ' runs, it should mirror the triangular family (' + triExpected + ')');
      if (!(triExpected > 0 && sqExpected > 0)) fail('the shape-number families are empty, so the sweep proves nothing about them');
      if (!(sawTri > 0 && sawSq > 0 && sawArith > 0 && sawOther > 0))
        fail('the classification sweep never reached all four answers (tri ' + sawTri + ' / sq ' + sawSq +
             ' / arith ' + sawArith + ' / other ' + sawOther + ')');
      /* 長度 2 以下不可以被分類 —— [1] 同時是兩種圖形數的第 1 個。 */
      if (data.kindOf([1]) !== 'short' || data.kindOf([1, 3]) !== 'short')
        fail('kindOf must refuse runs shorter than three numbers; 1 on its own is both kinds at once');
      /* isRunOf 要真的要求「連著的」，不是「每一個都是」。 */
      if (data.isRunOf([1, 6, 15], data.triNum, data.whichTri))
        fail('isRunOf accepts a run of triangular numbers that are not consecutive ones');

      /* ---- 4. 圖：兩套排版逐一比對，四個邊都驗 ---- */
      let planChecks = 0;
      for (const kind of ['sq', 'tri', 'rect']){
        for (let n = 1; n <= N_FIG_REF + 1; n++){
          const bad = checkPlan(data.dotPlan(kind, n), kind, n, R, 'dotPlan ' + kind + ' n=' + n);
          if (bad.length){ fail(bad[0]); return; }
          planChecks++;
        }
      }
      if (planChecks < 21) fail('the layout sweep only compared ' + planChecks + ' pictures');
      /* 三個純資料的格子清單也各自比一次（dotPlan 走的是它們，但斷言要分開）。 */
      for (let n = 1; n <= N_FIG_REF + 1; n++){
        const trio = [['sq', data.dotsSq(n)], ['tri', data.dotsTri(n)], ['rect', data.dotsRect(n)]];
        for (const pair of trio){
          const kind = pair[0], got = pair[1], want = cellsRef(kind, n);
          if (got.length !== want.length){ fail('dots for ' + kind + '(' + n + ') list ' + got.length + ' cells, the geometry gives ' + want.length); return; }
          const key = c => c.row + ',' + c.col + ',' + c.k + ',' + c.side;
          const gotSet = new Set(got.map(key)), wantSet = new Set(want.map(key));
          if (gotSet.size !== got.length){ fail('dots for ' + kind + '(' + n + ') list the same cell twice'); return; }
          for (const w of wantSet) if (!gotSet.has(w)){ fail('dots for ' + kind + '(' + n + ') are missing the cell ' + w); return; }
        }
      }
      /* gridPlan 自己也要驗：格子邊長取三個上限裡最小的那一個，而且留白不可以吃掉。 */
      for (let cols = 1; cols <= 8; cols++){
        for (let rows = 1; rows <= 8; rows++){
          const g = data.gridPlan(cols, rows);
          const want = stepRef(cols, rows, R);
          /* ⚠️ NaN 讓下面每一條比較都靜靜通過（`Math.abs(NaN - x) > EPS` 是 false）。
             先確認三個數字都是有限的，再比。 */
          for (const k of ['step', 'x0', 'y0', 'r', 'w', 'h']){
            if (!Number.isFinite(g[k])){ fail('gridPlan(' + cols + ', ' + rows + ').' + k + ' is not a finite number (' + g[k] + ')'); return; }
          }
          if (Math.abs(g.step - want) > EPS){ fail('gridPlan(' + cols + ', ' + rows + ').step is ' + g.step + ', the spec gives ' + want); return; }
          if (g.x0 < R.PAD - EPS || g.y0 < R.PAD - EPS)
            fail('gridPlan(' + cols + ', ' + rows + ') leaves only ' + g.x0.toFixed(1) + '/' + g.y0.toFixed(1) +
                 'px of margin, the spec asks for at least ' + R.PAD);
        }
      }

      /* ---- 5. 範例用的資料 ---- */
      const S1_NS = data.S1_NS, S2_N = data.S2_N, S3_NS = data.S3_NS,
            S4_NS = data.S4_NS, S5_RUNS = data.S5_RUNS;
      const lists = [['S1_NS', S1_NS], ['S3_NS', S3_NS], ['S4_NS', S4_NS]];
      for (const pair of lists){
        const name = pair[0], listv = pair[1];
        if (listv.length < 5) fail(name + ' offers only ' + listv.length + ' pictures to click');
        for (let i = 1; i < listv.length; i++) if (!(listv[i] > listv[i - 1])) fail(name + ' is not increasing');
        for (const n of listv) if (!(n >= 1 && n <= N_FIG_REF)) fail(name + ' contains ' + n + ', which is outside the drawable range');
      }
      if (S4_NS.indexOf(1) >= 0) fail('example 4 must not offer n=1: one dot beside one dot shows no staircase offset');
      if (!(S2_N >= 4 && S2_N <= N_FIG_REF)) fail('S2_N=' + S2_N + ' is outside the drawable range');
      if (S5_RUNS.length !== 3) fail('example 5 needs exactly three runs, it has ' + S5_RUNS.length);
      const kinds5 = S5_RUNS.map(r => kindRef(r.vals));
      if (kinds5.filter(k => k === 'arith').length !== 1)
        fail('example 5 must contrast exactly one equal-gap run against the shape numbers, it has ' +
             kinds5.filter(k => k === 'arith').length);
      if (kinds5.indexOf('tri') < 0 || kinds5.indexOf('sq') < 0)
        fail('example 5 must show both shape numbers, it shows [' + kinds5 + ']');
      S5_RUNS.forEach((r, i) => {
        if (r.id !== kinds5[i]) fail('example 5 run ' + i + ' is labelled ' + r.id + ' but the reference classifies it as ' + kinds5[i]);
        if (r.vals.length !== 5) fail('example 5 run ' + r.id + ' has ' + r.vals.length + ' numbers, the table is built for 5');
        const guess = data.patternGuess(r.vals), real = r.vals[r.vals.length - 1];
        if (kinds5[i] === 'arith'){
          if (guess !== real) fail('example 5: the equal-gap run must be the one where the earlier formula does work, but it gives ' + guess + ' against ' + real);
        } else if (!(guess < real)){
          fail('example 5: the ' + r.id + ' run must show the earlier formula coming out too small, but it gives ' + guess + ' against ' + real);
        }
      });

      /* ---- 6. 遊戲關卡：答案由資料重算，位置要分散 ---- */
      const ROUNDS = data.ROUNDS;
      const spread = {};
      const kindsSeen = [];
      ROUNDS.forEach((r, i) => {
        const want = data.roundAnswer(r);
        if (want === null){ fail('round ' + i + ' (' + r.kind + ') has no computable answer'); return; }
        /* ⚠️ 順序：設定檔自己重算的那一條要**先**比。排在後面的話，任何把 roundAnswer
           改壞的改動都會先撞上「opts[ans] 對不上」，獨立神諭就從來沒有被證明過。 */
        const ref = r.kind === 'sqNth' ? String(sqRef(r.n))
                  : r.kind === 'triNth' ? String(triRef(r.n))
                  : r.kind === 'sqGrow' ? String(sqRef(r.n + 1) - sqRef(r.n))
                  : r.kind === 'triWhich' ? String(whichTriRef(r.v))
                  : r.kind === 'kind' ? kindRef(r.vals) : null;
        if (ref === null) fail('round ' + i + ': the checker has no independent answer for kind ' + r.kind);
        else if (ref !== String(want)) fail('round ' + i + ' (' + r.kind + '): the page answers "' + want + '", the checker computes "' + ref + '"');
        if (String(r.opts[r.ans]) !== String(want))
          fail('round ' + i + ' (' + r.kind + '): opts[ans] is "' + r.opts[r.ans] + '" but the data gives "' + want + '"');
        if (r.opts.length !== 4 || new Set(r.opts).size !== 4) fail('round ' + i + ': options are not four distinct entries');
        spread[r.ans] = (spread[r.ans] || 0) + 1;
        kindsSeen.push(r.kind);
        const fig = data.roundFig(r);
        if (fig){
          if (['sq', 'tri', 'rect'].indexOf(fig.kind) < 0) fail('round ' + i + ': the picture kind is ' + fig.kind);
          if (!(fig.n >= 1 && fig.n <= N_FIG_REF)) fail('round ' + i + ': the picture would draw n=' + fig.n + ', outside the drawable range');
          else {
            const bad = checkPlan(data.dotPlan(fig.kind, fig.n), fig.kind, fig.n, R, 'round ' + i + ' fig');
            if (bad.length) fail(bad[0]);
          }
        }
      });
      if (Object.keys(spread).length < 3)
        fail('the game answers are all bunched into ' + Object.keys(spread).length + ' slot(s); spread them across the options');
      for (const k of ['sqNth', 'triNth', 'sqGrow', 'triWhich', 'kind'])
        if (kindsSeen.indexOf(k) < 0) fail('the game no longer has a "' + k + '" round');
      /* 反過來問的那兩關刻意不給圖 —— 給了圖就變成數排數。 */
      ROUNDS.forEach((r, i) => {
        const fig = data.roundFig(r);
        if (r.kind === 'triWhich' && fig) fail('round ' + i + ' shows a picture for a "which one is it" question, which gives the answer away');
        if (r.kind === 'kind' && fig) fail('round ' + i + ' shows a picture for a "what kind is it" question, which gives the answer away');
        if ((r.kind === 'sqNth' || r.kind === 'triNth' || r.kind === 'sqGrow') && !fig)
          fail('round ' + i + ' (' + r.kind + ') lost its picture');
      });

      /* ---- 7. 字典：分類名稱逐字比對（拿字典比字典等於自己比自己） ---- */
      for (const lang of ['zh', 'en']){
        const d = I18N[lang];
        for (const k of ['tri', 'sq', 'arith', 'other']){
          if (d.kindName[k] !== KIND_REF[lang][k])
            fail('the kind dictionary (' + lang + ') says "' + d.kindName[k] + '" for ' + k + ', the checker pins "' + KIND_REF[lang][k] + '"');
        }
        if (Object.keys(d.kindName).length !== 4)
          fail('the kind dictionary (' + lang + ') has ' + Object.keys(d.kindName).length + ' entries, the lesson has 4');
      }
      /* 英文的序數助手要對整個範圍成立（11~13 一律 th）。 */
      for (let n = 1; n <= 40; n++)
        if (data.ordEn(n) !== ordEnRef(n)) fail('ordEn(' + n + ') is ' + data.ordEn(n) + ', the reference gives ' + ordEnRef(n));
      for (const w of ['dot', 'row', 'cell'])
        for (const n of [1, 2, 5])
          if (data.plEn(n, w) !== plEnRef(n, w)) fail('plEn(' + n + ', "' + w + '") is ' + data.plEn(n, w));

      /* ---- 8. 旁白真的渲染出來再掃 ----
         拼接出來的字（'第 ' + n + ' 個'）在原始碼裡看不出會不會黏在一起。 */
      const narrated = [];
      for (const lang of ['zh', 'en']){
        const d = I18N[lang];
        const push = (tag, s) => narrated.push([tag + ' (' + lang + ')', s, lang]);
        for (const n of S1_NS){
          push('capSq', d.capSq(n, data.sqNum(n)));
          push('s1narr', d.s1narr(n, data.sqNum(n)));
          push('s1calc', d.s1calc(n, data.sqNum(n)));
          push('s1result', d.s1result(n, data.sqNum(n)));
          push('s1chip', d.s1chip(n));
        }
        push('capGnomonNone', d.capGnomonNone);
        push('s2narrStart', d.s2narrStart);
        push('s2narrDone', d.s2narrDone(S2_N));
        push('s2result', d.s2result(S2_N, data.sqNum(S2_N)));
        for (let k = 1; k <= S2_N; k++){
          push('capGnomon', d.capGnomon(k, data.oddSum(k)));
          push('s2narrStep', d.s2narrStep(k, data.gnomonSize(k), data.oddSum(k)));
          push('s2calc', d.s2calc(data.oddList(k).map(String), data.oddSum(k)));
        }
        for (const n of S3_NS){
          const rows = [];
          for (let i = 1; i <= n; i++) rows.push(String(i));
          push('capTri', d.capTri(n, data.triNum(n)));
          push('s3narr', d.s3narr(n, data.triNum(n), data.triGap(n)));
          push('s3calc', d.s3calc(rows, data.triNum(n)));
          push('s3result', d.s3result(n, data.triNum(n)));
          push('s3chip', d.s3chip(n));
        }
        for (const n of S4_NS){
          push('capRect', d.capRect(n, data.rectDots(n)));
          push('s4narr', d.s4narr(n, data.rectDots(n), data.triNum(n)));
          push('s4calc', d.s4calc(n, data.rectDots(n), data.triNum(n)));
          push('s4result', d.s4result(n, data.triNum(n)));
          push('s4chip', d.s4chip(n));
        }
        S5_RUNS.forEach((r, i) => {
          const gaps = data.gapsOf(r.vals);
          const n = r.vals.length, real = r.vals[n - 1], guess = data.patternGuess(r.vals);
          push('s5chip', d.s5chip[r.id]);
          if (kinds5[i] === 'arith'){
            push('s5narrArith', d.s5narrArith(gaps));
            push('s5calcGood', d.s5calcGood(r.vals[0], n, gaps[0], guess));
            push('s5resultGood', d.s5resultGood(n, real));
          } else {
            push('s5narrGrow', d.s5narrGrow(d.kindName[kinds5[i]], gaps));
            push('s5calcBad', d.s5calcBad(r.vals[0], n, gaps[0], guess, real));
            push('s5resultBad', d.s5resultBad(d.kindName[kinds5[i]], n, real));
          }
        });
        push('s5thVals', d.s5thVals);
        push('s5thGaps', d.s5thGaps);
        push('s5thGaps2', d.s5thGaps2);
        /* 遊戲：每一關的題目、兩層提示、選項文字。 */
        ROUNDS.forEach(r => {
          const key = r.kind === 'kind' ? 'kindQ' : r.kind;
          if (r.kind === 'sqNth'){ push('gPrompt.sqNth', d.gPrompt.sqNth(r.n)); push('gHint2.sqNth', d.gHint2.sqNth(r.n)); }
          if (r.kind === 'triNth'){ push('gPrompt.triNth', d.gPrompt.triNth(r.n)); push('gHint2.triNth', d.gHint2.triNth(r.n)); }
          if (r.kind === 'sqGrow'){ push('gPrompt.sqGrow', d.gPrompt.sqGrow(r.n)); push('gHint2.sqGrow', d.gHint2.sqGrow(r.n)); }
          if (r.kind === 'triWhich'){ push('gPrompt.triWhich', d.gPrompt.triWhich(r.v)); push('gHint2.triWhich', d.gHint2.triWhich(r.v)); }
          if (r.kind === 'kind'){
            push('gPrompt.kindQ', d.gPrompt.kindQ(r.vals.join(lang === 'zh' ? '、' : ', ')));
            push('gHint2.kindQ', d.gHint2.kindQ(data.gapsOf(r.vals)));
          }
          push('gHint1', d.gHint1[key]);
          r.opts.forEach(o => push('gOpt', r.kind === 'kind' ? d.kindName[o] : String(o)));
        });
        for (const lost of [0, 5]) push('gWrong', d.gWrong(lost));
        push('gWin', d.gWin(100));
        push('gCorrectFirst', d.gCorrectFirst);
        push('gCorrectRetry', d.gCorrectRetry);
        /* 題庫 */
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          d[bank].forEach((q, i) => {
            push(bank + '[' + i + '].stem', q.stem);
            push(bank + '[' + i + '].why', q.why);
            q.opts.forEach((o, oi) => push(bank + '[' + i + '].opt' + oi, o));
          });
        });
      }
      let narratedVerified = 0;
      for (const row of narrated){
        for (const p of textProblems(row[1], row[2], row[0])) fail(p);
        const ar = arithProblems(row[1]);
        for (const p of ar.problems) fail(row[0] + ': ' + p);
        narratedVerified += ar.verified;
      }
      /* 旁白裡至少要有一批真的算式被驗過 —— 全部不含等號的話，
         上面那個迴圈等於什麼都沒驗。 */
      /* ⚠️ 只釘**條數**擋不住「拿掉一條、再補一條」——數字一樣，驗的卻是別的宣稱。
         所以連**驗過的算式本身**一起釘（tools/README.md §3d-2 的做法）：
         排序後取 sha1，多一條少一條、換一條都對不上。 */
      if (narratedVerified !== NARRATED_EQUATIONS)
        fail('the rendered narration contains ' + narratedVerified + ' checkable equations, the checker pins ' +
             NARRATED_EQUATIONS + ' — a narration line that lost its equation is not a pass');
      const seenEquations = arithProblems.verifiedAll();
      const fingerprint = require('crypto').createHash('sha1')
        .update(seenEquations.join('\n')).digest('hex').slice(0, 16);
      if (fingerprint !== NARRATED_FINGERPRINT)
        fail('the set of equations actually verified in the narration has fingerprint ' + fingerprint +
             ', the checker pins ' + NARRATED_FINGERPRINT +
             ' — swapping one equation for another keeps the count but changes what was proved');

      /* ---- 9. 題庫神諭 ---- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const want = BANK_EXPECTED[bank];
        if (I18N.zh[bank].length !== want.length)
          fail(bank + ' has ' + I18N.zh[bank].length + ' questions, the oracle pins ' + want.length);
        /* ⚠️ 英文那一半也要數 —— 只數中文的話，刪掉一題英文只會讓下面的
           `if (!qe) return` 靜靜跳過，整題沒有人驗。 */
        if (I18N.en[bank].length !== want.length)
          fail(bank + ' (en) has ' + I18N.en[bank].length + ' questions, the oracle pins ' + want.length);
        /* ⚠️ 用 forEach 走稀疏陣列會**跳過那個洞**，而長度不變 —— 整題沒有人驗，
           而且輸出上長得跟通過一模一樣。改成逐一索引，缺席就大聲壞掉。 */
        for (let i = 0; i < want.length; i++){
          const w = want[i];
          const qz = I18N.zh[bank][i], qe = I18N.en[bank][i];
          if (!qz || !qe){
            fail(bank + '[' + i + '] is missing in ' + (!qz ? 'zh' : 'en') + ' — a hole in the bank is not a pass');
            continue;
          }
          if (w.stemExact && qz.stem !== w.stemExact)
            fail(bank + '[' + i + '] stem does not match the pinned wording:\n  got  ' + qz.stem + '\n  want ' + w.stemExact);
          if (w.enStemExact && qe.stem !== w.enStemExact)
            fail(bank + '[' + i + '] (en) stem does not match the pinned wording:\n  got  ' + qe.stem + '\n  want ' + w.enStemExact);
          if (String(qz.opts[qz.ans]) !== String(w.answer))
            fail(bank + '[' + i + '] the answers of the zh bank say "' + qz.opts[qz.ans] + '", the oracle says "' + w.answer + '"');
          const wantEn = w.enAnswer || w.answer;
          if (String(qe.opts[qe.ans]) !== String(wantEn))
            fail(bank + '[' + i + '] the answers of the en bank say "' + qe.opts[qe.ans] + '", the oracle says "' + wantEn + '"');
          const ask = (BANK_ASK[bank] || [])[i];
          if (ask){
            for (const m of ask.must) if (qz.stem.indexOf(m) < 0) fail(bank + '[' + i + '] stem does not match: it never asks "' + m + '"');
            for (const nv of ask.never) if (qz.stem.indexOf(nv) >= 0) fail(bank + '[' + i + '] stem does not match: it asks "' + nv + '" instead');
          }
          const askEn = (BANK_ASK_EN[bank] || [])[i];
          if (askEn){
            const low = qe.stem.toLowerCase();
            for (const m of askEn.must) if (low.indexOf(m.toLowerCase()) < 0)
              fail(bank + '[' + i + '] (en) stem does not match: it never asks "' + m + '"');
            for (const nv of askEn.never) if (low.indexOf(nv.toLowerCase()) >= 0)
              fail(bank + '[' + i + '] (en) stem does not match: it asks "' + nv + '" instead');
          }
        }
      });
      for (const rc of BANK_RECOMPUTE){
        const q = I18N.zh[rc.bank][rc.i];
        if (!q){ fail(rc.bank + '[' + rc.i + '] is missing, so it cannot be recomputed from its stem'); continue; }
        const nums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
        const wantSet = rc.from.slice().sort((a, b) => a - b).join(',');
        const gotSet = nums.slice().sort((a, b) => a - b).join(',');
        if (wantSet !== gotSet){
          fail(rc.bank + '[' + rc.i + '] recomputing from the stem: it prints [' + gotSet + '] but the oracle expects [' + wantSet + ']');
          continue;
        }
        const want = rc.calc(rc.from);
        if (String(q.opts[q.ans]) !== want)
          fail(rc.bank + '[' + rc.i + '] recomputing from the stem gives "' + want + '" but the marked answer is "' + q.opts[q.ans] + '"');
      }
      /* 選項是整句話的題目要用「關鍵字只能落在正解上」當神諭。 */
      for (const oa of BANK_ONLY_ANSWER){
        for (const lang of ['zh', 'en']){
          const q = I18N[lang][oa.bank][oa.i];
          if (!q){ fail(oa.bank + '[' + oa.i + '] (' + lang + ') is missing, so its keyword oracle cannot run'); continue; }
          const key = oa[lang];
          q.opts.forEach((o, oi) => {
            const has = String(o).indexOf(key) >= 0;
            if (oi === q.ans && !has)
              fail(oa.bank + '[' + oa.i + '] (' + lang + '): the correct option never says "' + key + '"');
            if (oi !== q.ans && has)
              fail(oa.bank + '[' + oa.i + '] (' + lang + '): a distractor also says "' + key + '", so two options read as right');
          });
        }
      }

      /* ---- 10. 跨頁：產生器清單與另外兩頁的版面常數 ----
         ⚠️ 一定要用 process.argv[2] 推出資料夾，不可以用 __dirname ——
            breaktest.js 把四頁複製到暫存目錄再跑，__dirname 會讀到真的 repo，
            針對 reference／review／parents 的斷言就永遠是綠的。 */
      const dir = path.dirname(path.resolve(process.argv[2] || '.'));
      const readSib = name => {
        const p = path.join(dir, name);
        if (!fs.existsSync(p)) return null;
        return fs.readFileSync(p, 'utf8');
      };
      const reviewRaw = readSib('review.html');
      const refRaw = readSib('reference.html');
      if (reviewRaw === null) fail('[SETUP] review.html is missing next to index.html');
      else {
        const reviewSrc = stripComments(reviewRaw);
        const ids = (reviewSrc.match(/^\s*\{ id:'([a-zA-Z]+)', cat:'/gm) || [])
                      .map(s => s.replace(/^\s*\{ id:'/, '').replace(/', cat:'$/, ''));
        if (ids.join(',') !== GEN_IDS.join(','))
          fail('review.html declares generators [' + ids.join(', ') + '], the checker pins [' + GEN_IDS.join(', ') + ']');
        const RV = FIG_REF.review;
        const RV_LINES = [
          'var FIG_W = ' + RV.W + ', FIG_H = ' + RV.H + ';',
          'var FIG_PAD = ' + RV.PAD + ', STEP_MAX = ' + RV.STEP + ', DOT_RATIO = ' + RV.RATIO + ';'
        ];
        for (const line of RV_LINES)
          if (reviewSrc.indexOf(line) < 0)
            fail('review.html no longer uses the pinned layout constants — expected the line "' + line + '"');
        if (reviewSrc.indexOf("svg.setAttribute('viewBox', '0 0 " + RV.W + ' ' + RV.H + "')") < 0)
          fail('review.html draws into a viewBox that does not match its pinned canvas size');
        if (reviewSrc.indexOf('max-width:' + RV.W + 'px;height:' + RV.H + 'px') < 0)
          fail('the .dotfig CSS size in review.html no longer matches its pinned canvas size');
        if (drawsSvgText(reviewSrc))
          fail('review.html draws <text> inside an SVG; this lesson keeps every label in HTML');
      }
      if (refRaw === null) fail('[SETUP] reference.html is missing next to index.html');
      else {
        const refSrc = stripComments(refRaw);
        const RF = FIG_REF.ref;
        const RF_LINES = [
          'var FIG_W = ' + RF.W + ', FIG_H = ' + RF.H + ';',
          'var FIG_PAD = ' + RF.PAD + ', STEP_MAX = ' + RF.STEP + ', DOT_RATIO = ' + RF.RATIO + ';'
        ];
        for (const line of RF_LINES)
          if (refSrc.indexOf(line) < 0)
            fail('reference.html no longer uses the pinned layout constants — expected the line "' + line + '"');
        if (refSrc.indexOf('max-width:' + RF.W + 'px;height:' + RF.H + 'px') < 0)
          fail('the .dotfig CSS size in reference.html no longer matches its pinned canvas size');
        if (drawsSvgText(refSrc))
          fail('reference.html draws <text> inside an SVG; this lesson keeps every label in HTML');
      }

      /* ---- 11. 跨頁用詞釘樁（含 FORBIDDEN 的那一半） ----
         ⚠️ 先把 HTML 註解拿掉，不然把規則搬進註解就過關了。
         ⚠️ 比「出現幾次」而不是「有沒有出現」：中文字串在這些頁面上一定有兩份
            （markup 的 fallback ＋ 字典），只改其中一份必須要被抓到。 */
      /* ⚠️ HTML 註解和 JS 區塊註解都要拿掉：把一條被刪掉的規則原封不動貼進註解，
         只比對字串的檢查就會以為它還在。
         ⚠️ 說清楚剩下的邊界：**行尾**的 `//` 註解沒有被拿掉（拿掉要 string-aware，
         不然會吃掉同一行的網址或字串），所以「把整句話貼在一行程式後面」仍然騙得過
         SIBLING 的下界。realistic 的洗白形狀是整行註解，那一種擋住了。 */
      const SRC = { index:src, reference:stripComments(refRaw),
                    review:stripComments(reviewRaw), parents:stripComments(readSib('parents.html')) };
      for (const rule of SIBLING_RULES){
        const text = SRC[rule.file];
        if (text === null || text === undefined){ fail('[SETUP] ' + rule.file + '.html is missing, so "' + rule.text + '" cannot be checked'); continue; }
        const hits = text.split(rule.text).length - 1;
        if (hits < rule.min)
          fail(rule.file + '.html says "' + rule.text + '" ' + hits + ' time(s), but it ' + rule.why + ' and must appear at least ' + rule.min + ' time(s)');
      }
      /* ⚠️ FORBIDDEN 要看**沒去過註解**的原始碼。去註解只會讓字變少，所以
         SIBLING 那一半（下界）天生 fail-closed；可是「不可以出現」剛好相反 ——
         去註解只要誤刪一次，就會從「抓到」變成「靜靜通過」。
         而且一句寫太滿的規則就算被註解掉，寫在檔案裡也還是該被指出來。 */
      const RAW = { index:rawSrc, reference:refRaw, review:reviewRaw, parents:readSib('parents.html') };
      for (const rule of FORBIDDEN){
        const text = RAW[rule.file];
        if (text === null || text === undefined) continue;
        if (text.indexOf(rule.text) >= 0)
          fail(rule.file + '.html must never say "' + rule.text + '" — ' + rule.why);
      }
    }
  }
};
