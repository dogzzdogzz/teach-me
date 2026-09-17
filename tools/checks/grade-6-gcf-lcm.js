/* grade-6/math/gcf-lcm —— 短除法魔法梯（質因數分解法與短除法求最大公因數／最小公倍數、互質、應用題該找哪一個）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作，都不呼叫課程頁的函式：
 *
 * 1) 「最大公因數」本身。課程頁用短除法（每次除以能同時整除的最小質數）；這裡用**輾轉相除**（gcdRef），
 *    最小公倍數用 a × b ÷ 最大公因數（lcmRef）。兩條路對 1~100 的每一對數都要同意。
 * 2) 「共同的原子」。課程頁用多重集合的交集（atomsSplit）；這裡對每一個質數各數兩邊的次方再取小的（splitRef），
 *    質因數分解本身每次除以**最大**的質因數再排序（factorizeRef），和課程頁的最小優先是不同的演算法。
 * 3) 課程明講的三句話這裡是**列舉證明**，不是文案：
 *    - 「左邊那一排相乘是最大公因數、左邊乘底下是最小公倍數」→ 對 1~100 的每一對數跑 ladderRows，左邊每一個
 *      質數都要真的同時整除當時的兩個數、而且是最小的那一個；底下兩個商互質；左邊相乘 ＝ gcdRef，L 形 ＝ lcmRef。
 *    - 「最大公因數 × 最小公倍數 ＝ 兩數相乘」→ 同一個迴圈裡逐對驗。
 *    - 「互質的兩個數最小公倍數等於相乘」「相鄰的兩個整數一定互質」→ 逐對驗（後者對 1~99 每一對相鄰整數）。
 * 4) ⚠️ **從畫出來的圖量回來**：原子重疊圖（vennPlan）把每一顆小圓的座標拿去和兩個大圓的圓心量距離，
 *    判斷它落在「只有左邊」「兩邊都有」「只有右邊」哪一區，再和 splitRef 的三堆逐一比多重集合；小圓兩兩不相疊、
 *    含描邊都在畫布內；印成 SVG 字串餵 lib/canvas.js 驗四個邊。梯子是 HTML 表格，沒有畫布，只驗資料。
 *
 * ⚠️ 小遊戲**沒有**接 lib/gameshuffle.js：五關的選項順序寫死在 ROUNDS 裡（設定檔驗的和孩子看到的是同一份），
 *    正解由 roundAnswerIndex() 算出來；「正解不可以固定在同一顆」由 step 5 直接對 ROUNDS 的 ans 分布驗。
 * ⚠️ 選項是**算式字串**的那一支（interFactorize，上一課的交錯題）問的是「哪一個是質因數分解」——
 *    「還沒拆完」的誘答值和正解一樣，那正是它錯的地方（framework §六之二 的合法例外），所以那一支比字串。
 * ⚠️ 兩個上限：兩個數都在 100 以內（LIMIT_REF），最小公倍數與「最小公倍數那一類」的選項在 600 以內（LCM_LIMIT_REF）。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canvasProblems } = require('./lib/canvas.js');
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['公分', '袋', '顆', '分鐘', '排', '個', '段', '種', '題', '關', '分'],
  unitsEn: ['cm', 'bags?', 'sweets?', 'chocolates?', 'minutes?', 'pieces?', 'atoms?', 'primes?', 'factors?', 'numbers?', 'rows?', 'ropes?', 'times', 'points?', 'questions?']
});

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const LIMIT_REF = 100, LCM_LIMIT_REF = 600;
const FIG_W_REF = 460, VENN_H_REF = 260;
const VENN_R_REF = 110, VENN_CY_REF = 130, VENN_AX_REF = 160, VENN_BX_REF = 300;
const BUB_R_REF = 14, BUB_GAP_REF = 4, BUB_FS_REF = 15;
const COL_A_X_REF = 115, COL_S_X_REF = 230, COL_B_X_REF = 345;
const MAX_SIDE_REF = 5, MAX_SHARED_REF = 4;
const S1_CASES_REF = [[12, 18], [8, 20], [8, 15], [30, 45]];
const S2_CASES_REF = [[24, 36], [18, 30], [16, 40], [45, 75]];
const S3_CASES_REF = [[24, 36], [20, 30], [14, 35], [36, 60]];
const S4_CASES_REF = [[8, 15], [7, 9], [9, 10], [6, 9], [12, 18], [13, 26]];
const SCENARIOS_REF = [['ribbon', 'gcf', 36, 48], ['bags', 'gcf', 24, 36], ['reduce', 'gcf', 18, 24], ['bus', 'lcm', 12, 18], ['tile', 'lcm', 8, 12], ['denom', 'lcm', 6, 8]];
const GAME_ROUNDS_REF = 5;

/* ---------- 1) 數論：篩法找質數、輾轉相除求最大公因數、最大質因數優先的分解 ---------- */
function sievePrimesRef(N){
  const flags = new Array(N + 1).fill(true);
  flags[0] = false; if (N >= 1) flags[1] = false;
  for (let p = 2; p * p <= N; p++){ if (!flags[p]) continue; for (let m = p * p; m <= N; m += p) flags[m] = false; }
  const out = []; for (let i = 2; i <= N; i++) if (flags[i]) out.push(i);
  return out;
}
const PRIMES_200 = sievePrimesRef(200);
const PRIME_SET = new Set(PRIMES_200);
function isPrimeRef(n){ return Number.isInteger(n) && n >= 2 && n <= 200 && PRIME_SET.has(n); }
function gcdRef(a, b){ a = Math.abs(a); b = Math.abs(b); while (b){ const t = a % b; a = b; b = t; } return a; }
function lcmRef(a, b){ return a * b / gcdRef(a, b); }
function factorizeRef(n){
  if (!Number.isInteger(n) || n < 2) return [];
  const out = []; let v = n;
  while (v > 1){
    let big = null;
    for (let i = PRIMES_200.length - 1; i >= 0; i--) if (v % PRIMES_200[i] === 0){ big = PRIMES_200[i]; break; }
    if (big === null) return null;
    out.push(big); v /= big;
  }
  return out.sort((x, y) => x - y);
}
function spfRef(n){ for (const p of PRIMES_200) if (n % p === 0) return p; return null; }
function productRef(list){ let p = 1; list.forEach(x => { p *= x; }); return p; }
function sameList(a, b){ return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]); }
function commonFactorsRef(a, b){ const out = []; for (let f = 1; f <= Math.min(a, b); f++) if (a % f === 0 && b % f === 0) out.push(f); return out; }
/* 三堆原子：對每一個質數各數兩邊有幾個，取小的那個數量是「兩邊都有」。 */
function splitRef(a, b){
  const fa = factorizeRef(a), fb = factorizeRef(b);
  const cnt = list => { const m = {}; list.forEach(p => { m[p] = (m[p] || 0) + 1; }); return m; };
  const ca = cnt(fa), cb = cnt(fb), shared = [], onlyA = [], onlyB = [];
  const primes = [...new Set(fa.concat(fb))].sort((x, y) => x - y);
  primes.forEach(p => {
    const k = Math.min(ca[p] || 0, cb[p] || 0);
    for (let i = 0; i < k; i++) shared.push(p);
    for (let i = 0; i < (ca[p] || 0) - k; i++) onlyA.push(p);
    for (let i = 0; i < (cb[p] || 0) - k; i++) onlyB.push(p);
  });
  return { onlyA, shared, onlyB };
}
/* 短除法的參考規則：左邊每一列必須是「能同時整除當時兩個數的最小質數」。 */
function smallestCommonPrimeRef(a, b){ for (const p of PRIMES_200){ if (p > Math.min(a, b)) break; if (a % p === 0 && b % p === 0) return p; } return null; }

/* ---------- 2) 選項的解析 ---------- */
function parseIntOpt(s){
  const m = /^(\d+)(?: (?:公分|袋|分鐘|cm|bags?|minutes?))?$/.exec(String(s).trim());
  return m ? Number(m[1]) : null;
}
function parseProduct(s){
  const t = String(s).trim();
  if (!/^\d+( × \d+)+$/.test(t)) return null;
  return t.split(' × ').map(Number);
}
function optKeyRef(s){
  const v = parseIntOpt(s);
  if (v !== null) return 'n:' + v;
  return 'raw:' + String(s).replace(/\s+/g, '');
}

/* ---------- 3) 真值表：小遊戲第 5 關（4 句）與複習頁的句庫（12 句），兩種語言的原文 ---------- */
const GAME_TRUTH_REF = { coprimeBothPrime:false, consecutiveCoprime:true, oddEvenCoprime:false, compositeNever:false };
const GAME_STATEMENT_TEXT_REF = {
  zh:{ coprimeBothPrime:'互質的兩個數一定都是質數', consecutiveCoprime:'相鄰的兩個整數一定互質', oddEvenCoprime:'一個奇數和一個偶數一定互質', compositeNever:'兩個合數一定不互質' },
  en:{ coprimeBothPrime:'Two coprime numbers are always both prime', consecutiveCoprime:'Two neighbouring whole numbers are always coprime', oddEvenCoprime:'An odd number and an even number are always coprime', compositeNever:'Two composite numbers are never coprime' }
};
const TRUE_STATEMENTS_REF = {
  coprimeMeansOne:   { zh:'互質就是兩個數的最大公因數是 1', en:'Coprime means the GCF of the two numbers is 1' },
  coprimeLcmProduct: { zh:'互質的兩個數，最小公倍數等於兩數相乘', en:'For two coprime numbers the LCM equals their product' },
  twoPrimesCoprime:  { zh:'兩個不同的質數一定互質', en:'Two different primes are always coprime' },
  consecutiveCoprime:{ zh:'相鄰的兩個整數一定互質', en:'Two neighbouring whole numbers are always coprime' },
  leftIsGcf:         { zh:'短除法左邊那一排相乘是最大公因數（一個都沒有就是 1）', en:'The left column of short division multiplied is the GCF (none at all means 1)' },
  productRule:       { zh:'最大公因數乘最小公倍數等於兩數相乘', en:'GCF times LCM equals the two numbers multiplied' }
};
const FALSE_STATEMENTS_REF = {
  coprimeBothPrime:  { zh:'互質的兩個數一定都是質數', en:'Two coprime numbers are always both prime' },
  oddEvenCoprime:    { zh:'一個奇數和一個偶數一定互質', en:'An odd number and an even number are always coprime' },
  twoOddCoprime:     { zh:'兩個奇數一定互質', en:'Two odd numbers are always coprime' },
  compositeNever:    { zh:'兩個合數一定不互質', en:'Two composite numbers are never coprime' },
  lcmIsProduct:      { zh:'最小公倍數一定等於兩數相乘', en:'The LCM always equals the two numbers multiplied' },
  leftIsLcm:         { zh:'短除法左邊那一排相乘是最小公倍數', en:'The left column of short division multiplied is the LCM' }
};
const FALSE_KEYS_REF = Object.keys(FALSE_STATEMENTS_REF);
function statementTruthOfText(text, lang){
  for (const k of Object.keys(TRUE_STATEMENTS_REF)) if (TRUE_STATEMENTS_REF[k][lang] === text) return true;
  for (const k of FALSE_KEYS_REF) if (FALSE_STATEMENTS_REF[k][lang] === text) return false;
  return null;
}
/* 「該找哪一個」的四個結論與「互質嗎」的結論文字 */
const FIND_TEXT_REF = {
  zh:{ gcf:'找最大公因數', lcm:'找最小公倍數', product:'把兩個數相乘', sum:'把兩個數相加' },
  en:{ gcf:'find the GCF', lcm:'find the LCM', product:'multiply the two numbers', sum:'add the two numbers' }
};
const SCEN_KIND_REF = { ribbon:'gcf', bags:'gcf', reduce:'gcf', bus:'lcm', tile:'lcm', denom:'lcm' };
/* 六個情境的題幹**整句重建**（第二套實作）：多一個字少一個字都對不上。 */
function scenStemRef(id, a, b, lang){
  const Z = {
    ribbon:'兩條繩子分別長 <strong>' + a + '</strong> 公分和 <strong>' + b + '</strong> 公分，要剪成<strong>一樣長</strong>的小段，剪完不能有剩。每一段<strong>最長</strong>幾公分？',
    bags:'有 <strong>' + a + '</strong> 顆糖和 <strong>' + b + '</strong> 顆巧克力，平均分裝成幾袋，每一袋的糖一樣多、巧克力也一樣多，剛好分完。<strong>最多</strong>可以分成幾袋？',
    reduce:'把 <strong>' + a + '/' + b + '</strong> 約成最簡分數，<strong>一次</strong>就約到底，分子和分母要同除以幾？',
    bus:'兩路公車一路每 <strong>' + a + '</strong> 分鐘一班、另一路每 <strong>' + b + '</strong> 分鐘一班，剛才<strong>同時</strong>發車。<strong>最快</strong>再過幾分鐘會再一次同時發車？',
    tile:'長 <strong>' + b + '</strong> 公分、寬 <strong>' + a + '</strong> 公分的長方形磁磚，全部朝同一個方向、不切割，拼成一個<strong>最小</strong>的正方形。正方形的邊長是幾公分？',
    denom:'<strong>1/' + a + '</strong> ＋ <strong>1/' + b + '</strong> 要通分，<strong>最小</strong>的公分母是幾？'
  };
  const E = {
    ribbon:'Two ropes are <strong>' + a + '</strong> cm and <strong>' + b + '</strong> cm long. They are cut into pieces of <strong>equal length</strong> with nothing left over. What is the <strong>longest</strong> each piece can be, in cm?',
    bags:'There are <strong>' + a + '</strong> sweets and <strong>' + b + '</strong> chocolates, shared equally into bags, every bag with the same number of sweets and the same number of chocolates, nothing left over. What is the <strong>greatest</strong> number of bags?',
    reduce:'Simplify <strong>' + a + '/' + b + '</strong> to its simplest form in <strong>one</strong> step. What do you divide the numerator and denominator by?',
    bus:'One bus leaves every <strong>' + a + '</strong> minutes and another every <strong>' + b + '</strong> minutes; they have just left <strong>together</strong>. What is the <strong>soonest</strong> number of minutes until they leave together again?',
    tile:'Rectangular tiles <strong>' + b + '</strong> cm long and <strong>' + a + '</strong> cm wide, all facing the same way and not cut, are laid to make the <strong>smallest</strong> possible square. What is the side of the square, in cm?',
    denom:'To add <strong>1/' + a + '</strong> + <strong>1/' + b + '</strong> you need a common denominator. What is the <strong>smallest</strong> one?'
  };
  return (lang === 'zh' ? Z : E)[id];
}
/* wordProblem 的選項帶單位：每一個情境、每一種語言各一份。 */
function withUnitRef(id, n, lang){
  if (lang === 'zh') return n + ({ ribbon:' 公分', bags:' 袋', reduce:'', bus:' 分鐘', tile:' 公分', denom:'' })[id];
  if (id === 'bags') return n === 1 ? '1 bag' : n + ' bags';
  if (id === 'bus') return n === 1 ? '1 minute' : n + ' minutes';
  return n + ({ ribbon:' cm', reduce:'', tile:' cm', denom:'' })[id];
}

/* ---------- 4) 跨頁用詞釘樁：min 一律寫成**當下真實的出現次數**（拿掉註解之後、讀者看得到的文字） ---------- */
const SIBLING_RULES = [
  { file:'index',     text:'左邊那一排相乘', min:10, why:'is how this lesson says where the GCF is read on the ladder' },
  { file:'reference', text:'左邊那一排相乘', min:7,  why:'is how this lesson says where the GCF is read on the ladder' },
  { file:'parents',   text:'左邊那一排相乘', min:6,  why:'is how this lesson says where the GCF is read on the ladder' },
  { file:'index',     text:'L 形', min:11, why:'is the name this lesson gives the LCM shape on the ladder' },
  { file:'reference', text:'L 形', min:9,  why:'is the name this lesson gives the LCM shape on the ladder' },
  { file:'parents',   text:'L 形', min:10, why:'is the name this lesson gives the LCM shape on the ladder' },
  { file:'index',     text:'最大公因數是 1', min:11, why:'is the definition of coprime this lesson uses everywhere' },
  { file:'reference', text:'最大公因數是 1', min:10, why:'is the definition of coprime this lesson uses everywhere' },
  { file:'review',    text:'最大公因數是 1', min:4,  why:'is the definition of coprime this lesson uses everywhere' },
  { file:'parents',   text:'最大公因數是 1', min:8,  why:'is the definition of coprime this lesson uses everywhere' },
  { file:'index',     text:'left column multiplied', min:5, why:'is the English rule for where the GCF is read' },
  { file:'reference', text:'left column multiplied', min:6, why:'is the English rule for where the GCF is read' },
  { file:'parents',   text:'left column multiplied', min:3, why:'is the English rule for where the GCF is read' },
  { file:'index',     text:'GCF is 1', min:8, why:'is the English definition of coprime' },
  { file:'parents',   text:'GCF is 1', min:5, why:'is the English definition of coprime' }
];
/* 一個字都不可以出現：次方寫法；把迷思當事實寫出來。 */
const FORBIDDEN = [
  { file:'index',     text:'²', why:'writes a power — this lesson writes 2 × 2, never 2²' },
  { file:'reference', text:'²', why:'writes a power — this lesson writes 2 × 2, never 2²' },
  { file:'review',    text:'²', why:'writes a power — this lesson writes 2 × 2, never 2²' },
  { file:'parents',   text:'²', why:'writes a power — this lesson writes 2 × 2, never 2²' },
  { file:'index',     text:'³', why:'writes a power' },
  { file:'reference', text:'³', why:'writes a power' },
  { file:'index',     text:'互質就是都是質數', why:'states the misconception as a fact' },
  { file:'reference', text:'互質就是都是質數', why:'states the misconception as a fact' },
  { file:'index',     text:'最小公倍數就是兩數相乘。', why:'states the misconception as a fact (only true for coprime numbers)' },
  { file:'reference', text:'最小公倍數就是兩數相乘。', why:'states the misconception as a fact (only true for coprime numbers)' },
  { file:'parents',   text:'最小公倍數就是兩數相乘。', why:'states the misconception as a fact (only true for coprime numbers)' }
];
/* 交給別課的詞，出現時同一個子句裡要說出它屬於哪一課。 */
const HANDOFF = [
  { word:'列舉', near:['五年級'], files:['index', 'reference', 'parents'] },
  { word:'分數加減', near:['五年級'], files:['index', 'reference', 'parents'] },
  { word:'分數的加減', near:['五年級'], files:['index', 'reference', 'parents'] },
  { word:'三個數', near:['不在這一課', 'not part of this lesson'], files:['parents'] },
  { word:'質數原子實驗室', near:['上一課'], files:['index', 'reference', 'parents'] },
  { word:'listing', near:['grade 5', 'grade-5'], files:['index', 'reference', 'parents'] }
];

/* ---------- 5) 題庫神諭：整句題幹（zh／en）＋ 四個選項原文 ＋ 正解原文 ---------- */
const BANK = {
  qs:[
    { zh:'用短除法求 <strong>24</strong> 和 <strong>36</strong> 的最大公因數，梯子左邊那一排是 2、2、3。最大公因數是多少？', en:'Short division on <strong>24</strong> and <strong>36</strong>: the left column of the ladder is 2, 2, 3. What is the GCF?', optsZh:['6', '12', '72', '2'], optsEn:['6', '12', '72', '2'], ansZh:'12', ansEn:'12' },
    { zh:'同一張梯子：<strong>24</strong> 和 <strong>36</strong> 除到底下剩 2 和 3，左邊是 2、2、3。最小公倍數是多少？', en:'The same ladder: <strong>24</strong> and <strong>36</strong> divide down to 2 and 3 at the bottom, with 2, 2, 3 on the left. What is the LCM?', optsZh:['6', '12', '72', '144'], optsEn:['6', '12', '72', '144'], ansZh:'72', ansEn:'72' },
    { zh:'關於 <strong>8</strong> 和 <strong>15</strong> 是否互質，下面哪一句話的<strong>結論和理由都對</strong>？', en:'About whether <strong>8</strong> and <strong>15</strong> are coprime, which sentence has <strong>both the right conclusion and the right reason</strong>?', optsZh:['互質，因為它們的最大公因數是 1', '不互質，因為它們都是合數', '互質，因為它們都是質數', '不互質，因為 8 是偶數、15 是奇數'], optsEn:['Coprime, because their GCF is 1', 'Not coprime, because both are composite', 'Coprime, because both are prime', 'Not coprime, because 8 is even and 15 is odd'], ansZh:'互質，因為它們的最大公因數是 1', ansEn:'Coprime, because their GCF is 1' },
    { zh:'求 <strong>18</strong> 和 <strong>30</strong> 的最大公因數，下面哪一個數<strong>能同時整除</strong> 18 和 30、可以寫在梯子左邊？', en:'To find the GCF of <strong>18</strong> and <strong>30</strong>, which of these numbers <strong>divides both</strong> 18 and 30 and can go on the left of the ladder?', optsZh:['2', '5', '9', '4'], optsEn:['2', '5', '9', '4'], ansZh:'2', ansEn:'2' },
    { zh:'<strong>7</strong> 和 <strong>9</strong> 互質。它們的最小公倍數是多少？', en:'<strong>7</strong> and <strong>9</strong> are coprime. What is their LCM?', optsZh:['1', '16', '63', '21'], optsEn:['1', '16', '63', '21'], ansZh:'63', ansEn:'63' },
    { zh:'兩條繩子分別長 <strong>36</strong> 公分和 <strong>48</strong> 公分，要剪成一樣長的小段，剪完不能有剩。每一段<strong>最長</strong>幾公分？', en:'Two ropes are <strong>36</strong> cm and <strong>48</strong> cm long. They are cut into pieces of equal length with nothing left over. What is the <strong>longest</strong> each piece can be?', optsZh:['6 公分', '12 公分', '144 公分', '84 公分'], optsEn:['6 cm', '12 cm', '144 cm', '84 cm'], ansZh:'12 公分', ansEn:'12 cm' }
  ],
  qsAdv:[
    { zh:'<strong>12</strong> ＝ 2 × 2 × 3，<strong>18</strong> ＝ 2 × 3 × 3。它們的最小公倍數是多少？', en:'<strong>12</strong> = 2 × 2 × 3 and <strong>18</strong> = 2 × 3 × 3. What is their LCM?', optsZh:['6', '216', '72', '36'], optsEn:['6', '216', '72', '36'], ansZh:'36', ansEn:'36' },
    { zh:'兩路公車一路每 <strong>12</strong> 分鐘一班、另一路每 <strong>18</strong> 分鐘一班，早上 <strong>8 時 00 分</strong>同時發車。<strong>下一次</strong>同時發車是幾點幾分？', en:'One bus leaves every <strong>12</strong> minutes and another every <strong>18</strong> minutes; at <strong>8:00 a.m.</strong> they leave together. When do they <strong>next</strong> leave together?', optsZh:['8 時 06 分', '8 時 30 分', '8 時 36 分', '9 時 12 分'], optsEn:['8:06 a.m.', '8:30 a.m.', '8:36 a.m.', '9:12 a.m.'], ansZh:'8 時 36 分', ansEn:'8:36 a.m.' },
    { zh:'把 <strong>42/56</strong> 約成最簡分數，<strong>一次</strong>就約到底，分子和分母要同除以幾？', en:'Simplify <strong>42/56</strong> to its simplest form in <strong>one</strong> step. What do you divide the numerator and denominator by?', optsZh:['2', '7', '14', '28'], optsEn:['2', '7', '14', '28'], ansZh:'14', ansEn:'14' },
    { zh:'兩個數的最大公因數是 <strong>6</strong>、最小公倍數是 <strong>36</strong>，其中一個數是 <strong>12</strong>。另一個數是多少？', en:'Two numbers have GCF <strong>6</strong> and LCM <strong>36</strong>. One of them is <strong>12</strong>. What is the other?', optsZh:['6', '18', '24', '36'], optsEn:['6', '18', '24', '36'], ansZh:'18', ansEn:'18' }
  ],
  qsBoost:[
    { zh:'小明說：「<strong>8 和 15 都是合數，所以它們不互質</strong>。」他哪裡想錯了？', en:'Ben says: “<strong>8 and 15 are both composite, so they are not coprime</strong>.” What has he got wrong?', optsZh:['他沒有錯，互質的兩個數一定都是質數', '互質看的是最大公因數是不是 1：8 和 15 沒有共同的質因數，最大公因數是 1，所以互質', '8 是偶數，偶數和任何數都不互質', '15 的因數有 3 和 5，所以 8 和 15 的最大公因數是 3'], optsEn:['Nothing; coprime numbers are always both prime', 'Coprime is about whether the GCF is 1: 8 and 15 share no prime factor, their GCF is 1, so they are coprime', '8 is even, and an even number is never coprime with anything', '15 has the factors 3 and 5, so the GCF of 8 and 15 is 3'], ansZh:'互質看的是最大公因數是不是 1：8 和 15 沒有共同的質因數，最大公因數是 1，所以互質', ansEn:'Coprime is about whether the GCF is 1: 8 and 15 share no prime factor, their GCF is 1, so they are coprime' },
    { zh:'小美用短除法算 <strong>24</strong> 和 <strong>36</strong>：左邊 2、2、3，底下剩 2、3。她說「最小公倍數是 2 × 2 × 3 ＝ 12」。她哪裡想錯了？', en:'Chloe does short division on <strong>24</strong> and <strong>36</strong>: 2, 2, 3 on the left, 2 and 3 at the bottom. She says “the LCM is 2 × 2 × 3 = 12”. What has she got wrong?', optsZh:['她沒有錯，最小公倍數就是 12', '左邊那一排相乘是最大公因數；最小公倍數要再乘底下的 2 和 3，是 12 × 2 × 3 ＝ 72', '最小公倍數應該是 24 × 36', '應該只乘底下的 2 × 3 ＝ 6'], optsEn:['Nothing; the LCM is 12', 'The left column multiplied is the GCF; the LCM also needs the 2 and 3 at the bottom: 12 × 2 × 3 = 72', 'The LCM should be 24 × 36', 'Only the bottom should be multiplied: 2 × 3 = 6'], ansZh:'左邊那一排相乘是最大公因數；最小公倍數要再乘底下的 2 和 3，是 12 × 2 × 3 ＝ 72', ansEn:'The left column multiplied is the GCF; the LCM also needs the 2 and 3 at the bottom: 12 × 2 × 3 = 72' }
  ]
};
/* 靜態題裡的數字事實，各自獨立算一次（輾轉相除／最大質因數法）。 */
const BANK_FACTS = [
  { pair:[24, 36], gcf:12, lcm:72, left:[2, 2, 3], bottom:[2, 3] }, { pair:[8, 15], gcf:1 }, { pair:[18, 30], gcf:6, left:[2, 3] },
  { pair:[7, 9], gcf:1, lcm:63 }, { pair:[36, 48], gcf:12, lcm:144 }, { pair:[12, 18], gcf:6, lcm:36 },
  { pair:[42, 56], gcf:14 }, { pair:[6, 9], gcf:3 }, { pair:[9, 15], gcf:3 }, { pair:[9, 10], gcf:1 },
  { n:8, atoms:[2, 2, 2] }, { n:15, atoms:[3, 5] }, { n:36, atoms:[2, 2, 3, 3] }, { n:48, atoms:[2, 2, 2, 2, 3] }, { n:42, atoms:[2, 3, 7] }, { n:56, atoms:[2, 2, 2, 7] }
];

const BANK_WHY_FINGERPRINT_REF = 'b534d4a96681';

const GEN_IDS = ['gcfLadder', 'lcmLadder', 'commonPrime', 'ladderBottom', 'whichCoprime', 'coprimeVerdict',
                 'lcmCoprime', 'atomsToGcf', 'whichToFind', 'wordProblem', 'trueStatement', 'interFactorize'];

/* plan → DOM 的接線。⚠️ 這是字面掃描，不是資料流分析：它只證明「畫圖那一行還在讀 plan」，證明不了 plan 之外沒有別的座標被畫上去；
   「剛好一次」也擋不住把畫布先存進別名再畫（`var t = s1fig; drawVenn(t, …)`）。真的要證明得在 DOM 裡跑一次，這裡沒有。 */
const RENDER_PINS = [
  { file:'index', text:'drawVenn(s1fig, pl);', min:1 },
  /* 每一個目標畫布只准畫一次：留著釘住的那一行、在後面再蓋一次別的 plan，字面釘樁看不到 —— 所以另外釘「呼叫次數剛好一次」。 */
  { file:'index', text:'drawVenn(s1fig,', min:1, max:1 },
  { file:'index', text:'drawLadder(s2grid,', min:1, max:1 },
  { file:'index', text:'drawLadder(s3grid,', min:1, max:1 },
  { file:'index', text:'drawLadder(s4grid,', min:1, max:1 },
  { file:'index', text:'drawLadder(s5grid,', min:1, max:1 },
  { file:'index', text:'drawLadder(gLadder,', min:1, max:1 },
  { file:'index', text:'svg.appendChild(svgEl(\'circle\', { cx:bb.x, cy:bb.y, r:bb.r, fill:fill }));', min:1 },
  { file:'index', text:'drawLadder(s2grid, Ld, s2step, s2step === total ? \'g\' : null);', min:1 },
  { file:'index', text:'drawLadder(s3grid, Ld, s3step, s3step === total ? \'l\' : null);', min:1 },
  { file:'index', text:'drawLadder(s4grid, Ld, Ld.rows.length, \'g\');', min:1 },
  { file:'index', text:'drawLadder(s5grid, Ld, Ld.rows.length, sc.kind === \'gcf\' ? \'g\' : \'l\');', min:1 },
  { file:'index', text:'var ansAt = roundAnswerIndex(round);', min:1 },
  { file:'index', text:'var fig = roundLadder(round);', min:1 }
];
/* review.html 的抽樣池要逐字釘住：產生器自己的拒絕取樣會把改壞測試吸收掉。 */
const REVIEW_PINS = [
  'var POOL_NONCOP = PAIRS_ALL.filter(function(pr){ return pr[0] >= 4 && gcfOf(pr[0], pr[1]) > 1; });',
  'var POOL_LADDER2 = POOL_NONCOP.filter(function(pr){ return ladderRows(pr[0], pr[1]).rows.length >= 2; });',
  'var POOL_COP = PAIRS_ALL.filter(function(pr){ return pr[0] >= 4 && gcfOf(pr[0], pr[1]) === 1 && pr[0] * pr[1] <= LCM_LIMIT; });',
  'var POOL_BUS = POOL_NONCOP.filter(function(pr){ return pr[1] <= 60; });',
  'var POOL_SNEAKY = POOL_NONCOP.filter(function(pr){ return !(pr[0] % 2 === 0 && pr[1] % 2 === 0) && pr[1] % pr[0] !== 0 && pr[1] <= 60; });',
  'if (L.lcm <= LCM_LIMIT) PAIRS_ALL.push([a, b]);',
  '(avoid || []).forEach(function(a){ seen[String(a)] = 1; });',
  'if (c < 1 || c > lim || seen[String(c)]) return;'
];

/* ---------- 5b) 拿掉 JS 的兩種註解（換成換行）；`://` 不算行註解 ---------- */
function stripJsComments(code){
  return String(code).replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1\n');
}
/* ---------- 6) 讀者看得到的文字：拿掉註解（換成換行，不是空字串）、拿掉 <style> ---------- */
function readerText(html){
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1\n')            /* JS 行註解也拿掉（`://` 與緊貼引號的 `//` 不算；`"a//b"` 這種字串裡的 `//` 會被誤判 —— 它只會讓計數變少而失敗，不會放行） */
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/&#(\d+);?/g, (m, n) => String.fromCodePoint(Number(n)))   /* `&#178;` 也是 ²：先解碼再掃 */
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)));
}
function stringProblems(s, lang, where){
  const out = [];
  const t = String(s);
  if (/undefined|NaN|\[object/.test(t)) out.push(where + ' leaks an internal value');
  const shown = t.replace(/<[^>]+>/g, '');
  if (lang === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:[一-鿿]\d|\d[一-鿿]).{0,6}/) || [''])[0]);
  if (lang === 'en' && /\b1 (primes|factors|rows|atoms|numbers|pieces|bags|minutes|ropes|tiles|sweets|chocolates|points|steps)\b/.test(shown)) out.push(where + ' has a singular/plural slip: ' + shown.match(/\b1 [a-z]+s\b/)[0]);
  if (lang === 'en' && /\p{Script=Han}/u.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  return out;
}

/* ---------- 6b) 算式逐條驗算 ----------
   lib/arith.js 不認得餘數式（`18 ÷ 5 ＝ 3 餘 3`），也會把「數字緊接著括號裡的算式」讀成斷掉的鏈，
   而且不認得分數（`1/6`、`42/56`）—— 這一課的分數只出現在「約分／通分」的題幹裡，沒有等號，先拿掉。
   三種形狀各自先抓出來自己驗（餘數式驗 A ＝ B × Q ＋ R 且 R < B；括號裡的算式單獨交給 lib/arith.js），
   從文字裡拿掉（換成空白）之後剩下的才交給共用驗算器。回傳 { problems, verified }。 */
const REM_RE = /(\d+)\s*[÷/]\s*(\d+)\s*[＝=]\s*(\d+)\s*(?:餘|remainder)\s*(\d+)/g;
const REM_ONLY_RE = /(\d+)\s*[÷/]\s*(\d+)\s*(?:餘|leaves remainder)\s*(\d+)/g;
const PAREN_EQ_RE = /[（(]([^（）()]*[＝=][^（）()]*)[）)]/g;
const FRAC_RE = /(?<![\d×*])\b(\d+)\/(\d+)\b(?![\d])/g;
/* 分數等式的整條鏈：`1/2 ＝ 2/4 ＝ 9/10` 每一節都要驗；前面緊接運算符號（`2 × 1/2 ＝ 1`）的不是分數等式，交給 lib/arith.js。 */
const FRAC_CHAIN_RE = /(?<![\d×*÷/+\-＋－＝=]\s*)\b(\d+)\/(\d+)((?:\s*[＝=]\s*\d+(?:\/\d+)?)+)\b(?![\d\/]|\s*[＝=×*÷/+\-＋－])/g;
function arithAll(text){
  const problems = [];
  let verified = 0;
  let t = String(text).replace(/<[^>]+>/g, ' ');
  t = t.replace(REM_RE, (m, a, b, q, r) => {
    a = Number(a); b = Number(b); q = Number(q); r = Number(r);
    verified++;
    if (!(b > 0) || r >= b || a !== b * q + r) problems.push('remainder claim is wrong: "' + m + '"');
    return ' ';
  });
  t = t.replace(REM_ONLY_RE, (m, a, b, r) => {
    a = Number(a); b = Number(b); r = Number(r);
    verified++;
    if (!(b > 0) || r >= b || a % b !== r) problems.push('remainder claim is wrong: "' + m + '"');
    return ' ';
  });
  /* 分數的等式先用交叉相乘驗過（`42/56 ＝ 3/4`、`36/6 ＝ 6`），再把剩下只當名詞的分數拿掉；分母是 0 要響。 */
  t = t.replace(FRAC_CHAIN_RE, (m, a, b, tail) => {
    const links = tail.split(/[＝=]/).slice(1).map(x => x.trim());
    let pn = Number(a), pd = Number(b);
    if (!(pd > 0)) problems.push('fraction with zero denominator: "' + m + '"');
    links.forEach(link => {
      const mm = /^(\d+)(?:\/(\d+))?$/.exec(link);
      const cn = Number(mm[1]), cd = mm[2] === undefined ? 1 : Number(mm[2]);
      verified++;
      if (!(cd > 0) || pn * cd !== cn * pd) problems.push('fraction claim is wrong: "' + m + '"');
      pn = cn; pd = cd;
    });
    return ' ';
  });
  t = t.replace(FRAC_RE, (m, n, d) => { if (Number(d) === 0) problems.push('fraction with zero denominator: "' + m + '"'); return ' F '; });
  t = t.replace(PAREN_EQ_RE, (m, inner) => {
    const r = arithProblems(inner);
    r.problems.forEach(p => problems.push(p));
    verified += r.verified;
    return ' ';
  });
  const rest = arithProblems(t);
  rest.problems.forEach(p => problems.push(p));
  verified += rest.verified;
  return { problems, verified };
}
/* 驗算器自己的 PROBE：前面幾筆必須零誤報，後面幾筆一定要抓到。 */
const CLAIM_PROBES = [
  { text:'18 ÷ 5 ＝ 3 餘 3，所以 5 只整除 30。', bad:false },
  { text:'左邊 2、2、3 相乘（2 × 2 × 3 ＝ 12）', bad:false },
  { text:'30 ÷ 9 = 3 remainder 3, so 9 divides only 18', bad:false },
  { text:'把 42/56 約成最簡分數，同除以 14，得 3/4', bad:false },
  { text:'12 × 72 ＝ 864，24 × 36 ＝ 864，一樣。', bad:false },
  { text:'1/6 ＋ 1/8 要通分，最小的公分母是 24', bad:false },
  { text:'42/56 ＝ 3/4，分子分母互質', bad:false },
  { text:'36/6 = 6 so the pieces fit', bad:false },
  { text:'42/56 ＝ 4/5', bad:true },
  /* 分數的四則不在這一課的範圍（五年級的事）：碰到 `2 × 1/2 ＝ 1` 這種鏈，驗算器**拒收**而不是假裝驗過 —— fail-closed，所以這一筆要響。 */
  { text:'2 × 1/2 ＝ 1', bad:true },
  { text:'2 ×      1/2 ＝ 1', bad:true },
  { text:'1/2 ＝ 2/4 ＝ 4/8', bad:false },
  { text:'1/2 ＝ 2/4 ＝ 9/10', bad:true },
  { text:'21/28 = 3/5, still simplifiable', bad:true },
  { text:'24 ÷ 2 ＝ 12，36 ÷ 2 ＝ 18', bad:false },
  { text:'18 ÷ 5 ＝ 3 餘 4', bad:true },
  { text:'30 ÷ 9 leaves remainder 4', bad:true },
  { text:'（2 × 2 × 3 ＝ 13）', bad:true },
  { text:'12 × 72 ＝ 846', bad:true },
  { text:'6 × 36 ＝ 216，216 ÷ 12 ＝ 19', bad:true }
];

/* ---------- 7) 從畫出來的圖量回來：原子重疊圖 ---------- */
function svgOfVenn(pl){
  const circles = pl.circles.map(c => '<circle cx="' + c.cx + '" cy="' + c.cy + '" r="' + c.r + '" stroke-width="3"/>').join('');
  const bubbles = pl.bubbles.map(bb => '<circle cx="' + bb.x + '" cy="' + bb.y + '" r="' + bb.r + '"/>' +
    '<text x="' + bb.x + '" y="' + (bb.y + 5) + '" font-size="' + BUB_FS_REF + '" text-anchor="middle">' + bb.text + '</text>').join('');
  return '<svg viewBox="0 0 ' + pl.w + ' ' + pl.h + '" width="' + pl.w + '" height="' + pl.h + '">' + circles + bubbles + '</svg>';
}
function dist(x1, y1, x2, y2){ return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2)); }
/* 一顆小圓落在哪一區，用它和兩個大圓圓心的距離量出來（含小圓自己的半徑，整顆都要在裡面／外面）。 */
function regionOfRef(bb){
  const inA = dist(bb.x, bb.y, VENN_AX_REF, VENN_CY_REF) + bb.r <= VENN_R_REF;
  const inB = dist(bb.x, bb.y, VENN_BX_REF, VENN_CY_REF) + bb.r <= VENN_R_REF;
  const outA = dist(bb.x, bb.y, VENN_AX_REF, VENN_CY_REF) - bb.r >= VENN_R_REF;
  const outB = dist(bb.x, bb.y, VENN_BX_REF, VENN_CY_REF) - bb.r >= VENN_R_REF;
  if (inA && inB) return 's';
  if (inA && outB) return 'a';
  if (inB && outA) return 'b';
  return null;     /* 壓在圓邊上、或掉在兩個圓外面 */
}
function vennProblems(tag, pl, a, b){
  const out = [];
  if (!pl || !Array.isArray(pl.bubbles) || !Array.isArray(pl.circles)){ out.push(tag + ': vennPlan is not shaped like a plan'); return out; }
  if (pl.w !== FIG_W_REF || pl.h !== VENN_H_REF) out.push(tag + ': canvas is ' + pl.w + 'x' + pl.h + ', expected ' + FIG_W_REF + 'x' + VENN_H_REF);
  if (pl.circles.length !== 2) out.push(tag + ': ' + pl.circles.length + ' big circles');
  else {
    const c0 = pl.circles[0], c1 = pl.circles[1];
    if (c0.cx !== VENN_AX_REF || c1.cx !== VENN_BX_REF || c0.cy !== VENN_CY_REF || c1.cy !== VENN_CY_REF || c0.r !== VENN_R_REF || c1.r !== VENN_R_REF) out.push(tag + ': the big circles are not at the reference positions');
    if (c0.cx - c0.r < 0 || c1.cx + c1.r > FIG_W_REF || c0.cy - c0.r < 0 || c0.cy + c0.r > VENN_H_REF) out.push(tag + ': a big circle leaves the canvas');
    if (c1.cx - c0.cx >= 2 * VENN_R_REF) out.push(tag + ': the two circles do not overlap, so there is no middle region');
  }
  const sp = splitRef(a, b);
  const tooMany = sp.onlyA.length > MAX_SIDE_REF || sp.onlyB.length > MAX_SIDE_REF || sp.shared.length > MAX_SHARED_REF;
  if (pl.a !== a || pl.b !== b) out.push(tag + ': plan says it is for ' + pl.a + ',' + pl.b);
  if (pl.gcf !== gcdRef(a, b)) out.push(tag + ': plan gcf is ' + pl.gcf + ', Euclid says ' + gcdRef(a, b));
  if (pl.lcm !== lcmRef(a, b)) out.push(tag + ': plan lcm is ' + pl.lcm + ', a × b ÷ gcf says ' + lcmRef(a, b));
  if (pl.tooMany !== tooMany) out.push(tag + ': tooMany flag is ' + pl.tooMany + ', the reference says ' + tooMany);
  if (tooMany){ if (pl.bubbles.length !== 0) out.push(tag + ': tooMany but ' + pl.bubbles.length + ' bubbles were still planned'); return out; }
  const got = { a:[], s:[], b:[] };
  for (let i = 0; i < pl.bubbles.length; i++){
    const bb = pl.bubbles[i];
    if (!bb || !Number.isFinite(bb.x) || !Number.isFinite(bb.y) || !Number.isFinite(bb.r)){ out.push(tag + ': bubble ' + i + ' has a non-numeric coordinate'); continue; }
    if (bb.r !== BUB_R_REF) out.push(tag + ': bubble ' + i + ' has radius ' + bb.r);
    if (String(bb.text) !== String(bb.v)) out.push(tag + ': bubble ' + i + ' is labelled "' + bb.text + '" for atom ' + bb.v);
    if (!isPrimeRef(bb.v)) out.push(tag + ': bubble ' + i + ' holds ' + bb.v + ', which is not prime');
    if ([...String(bb.text)].length > 2) out.push(tag + ': label "' + bb.text + '" would spill out of a small circle');
    const reg = regionOfRef(bb);
    if (reg === null) out.push(tag + ': bubble ' + bb.v + ' at (' + bb.x + ',' + bb.y + ') sits on a circle edge or outside both circles');
    else {
      if (reg !== bb.region) out.push(tag + ': bubble ' + bb.v + ' is tagged region "' + bb.region + '" but is drawn in region "' + reg + '"');
      got[reg].push(bb.v);
    }
    if (bb.x - bb.r < 0 || bb.x + bb.r > FIG_W_REF || bb.y - bb.r < 0 || bb.y + bb.r > VENN_H_REF) out.push(tag + ': bubble ' + bb.v + ' leaves the canvas');
    for (let j = i + 1; j < pl.bubbles.length; j++){
      const o = pl.bubbles[j];
      if (dist(bb.x, bb.y, o.x, o.y) < bb.r + o.r + BUB_GAP_REF - 1e-9) out.push(tag + ': bubbles ' + bb.v + ' and ' + o.v + ' overlap or touch');
    }
  }
  const srt = l => l.slice().sort((x, y) => x - y);
  if (!sameList(srt(got.a), srt(sp.onlyA))) out.push(tag + ': the left-only region shows [' + srt(got.a) + '], expected [' + srt(sp.onlyA) + ']');
  if (!sameList(srt(got.s), srt(sp.shared))) out.push(tag + ': the middle shows [' + srt(got.s) + '], expected [' + srt(sp.shared) + ']');
  if (!sameList(srt(got.b), srt(sp.onlyB))) out.push(tag + ': the right-only region shows [' + srt(got.b) + '], expected [' + srt(sp.onlyB) + ']');
  if (pl.bubbles.length !== sp.onlyA.length + sp.shared.length + sp.onlyB.length) out.push(tag + ': ' + pl.bubbles.length + ' bubbles for ' + (sp.onlyA.length + sp.shared.length + sp.onlyB.length) + ' atoms');
  canvasProblems(svgOfVenn(pl)).forEach(m => out.push(tag + ' canvas: ' + m));
  return out;
}
/* 梯子：每一列的質數同時整除當時的兩個數、是最小的那一個；底下互質；左邊相乘 ＝ 最大公因數；L 形 ＝ 最小公倍數。 */
function ladderProblems(tag, L, a, b){
  const out = [];
  if (!L || !Array.isArray(L.rows) || !Array.isArray(L.left) || !Array.isArray(L.bottom)){ out.push(tag + ': ladderRows is not shaped like a ladder'); return out; }
  if (L.a !== a || L.b !== b) out.push(tag + ': ladder is for ' + L.a + ',' + L.b);
  let x = a, y = b;
  L.rows.forEach((row, i) => {
    if (!isPrimeRef(row.p)) out.push(tag + ': row ' + i + ' divides by ' + row.p + ', which is not prime');
    if (row.a !== x || row.b !== y) out.push(tag + ': row ' + i + ' shows ' + row.a + ',' + row.b + ', expected ' + x + ',' + y);
    if (x % row.p !== 0 || y % row.p !== 0) out.push(tag + ': row ' + i + ' divides by ' + row.p + ', which does not divide both ' + x + ' and ' + y);
    if (row.p !== smallestCommonPrimeRef(x, y)) out.push(tag + ': row ' + i + ' divides by ' + row.p + ', the smallest shared prime is ' + smallestCommonPrimeRef(x, y));
    if (row.qa !== x / row.p || row.qb !== y / row.p) out.push(tag + ': row ' + i + ' quotients are wrong');
    x = x / row.p; y = y / row.p;
  });
  if (L.bottom[0] !== x || L.bottom[1] !== y) out.push(tag + ': bottom is ' + L.bottom + ', expected ' + x + ',' + y);
  if (gcdRef(x, y) !== 1) out.push(tag + ': stopped at ' + x + ',' + y + ' which still share ' + gcdRef(x, y));
  if (!sameList(L.left, L.rows.map(r => r.p))) out.push(tag + ': left column differs from the rows');
  if (L.gcf !== gcdRef(a, b)) out.push(tag + ': gcf is ' + L.gcf + ', Euclid says ' + gcdRef(a, b));
  if (L.lcm !== lcmRef(a, b)) out.push(tag + ': lcm is ' + L.lcm + ', a × b ÷ gcf says ' + lcmRef(a, b));
  if (L.gcf * L.lcm !== a * b) out.push(tag + ': gcf × lcm is not a × b');
  if (L.coprime !== (gcdRef(a, b) === 1)) out.push(tag + ': coprime flag is wrong');
  return out;
}

/* ---------- 8) 產生器：不變條件的共用檢查 ---------- */
function intOptsProblems(id, d, lo, hi, avoid){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return id + ': options are not four';
  if (!(d.ans >= 0 && d.ans < 4)) return id + ': ans index out of range';
  const vals = d.opts.map(Number);
  if (vals.some(v => !Number.isInteger(v))) return id + ': an option is not an integer: ' + d.opts;
  if (new Set(vals).size !== 4) return id + ': options repeat a value: ' + d.opts;
  if (vals.some(v => v < lo || v > hi)) return id + ': an option is outside ' + lo + '..' + hi + ': ' + d.opts;
  const echo = vals.filter((v, i) => i !== d.ans && (avoid || []).indexOf(v) >= 0);
  if (echo.length) return id + ': distractor ' + echo[0] + ' copies a number the stem prints';
  return null;
}
function pairProblems(id, a, b){
  if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 2 && b >= 2 && a <= LIMIT_REF && b <= LIMIT_REF)) return id + ': (' + a + ',' + b + ') is not two whole numbers in 2..100';
  if (a >= b) return id + ': (' + a + ',' + b + ') is not written smaller first';
  if (lcmRef(a, b) > LCM_LIMIT_REF) return id + ': lcm(' + a + ',' + b + ')=' + lcmRef(a, b) + ' exceeds this lesson\'s 600';
  return null;
}
/* 整句題幹重建：每一支產生器、每一種語言各一份。多一個字少一個字都對不上。 */
function stemRef(genId, d, lang){
  const zh = lang === 'zh';
  switch (genId){
    case 'gcfLadder': return zh ? '用短除法求 <strong>' + d.a + '</strong> 和 <strong>' + d.b + '</strong> 的<strong>最大公因數</strong>。' : 'Use short division to find the <strong>GCF</strong> of <strong>' + d.a + '</strong> and <strong>' + d.b + '</strong>.';
    case 'lcmLadder': return zh ? '用短除法求 <strong>' + d.a + '</strong> 和 <strong>' + d.b + '</strong> 的<strong>最小公倍數</strong>。' : 'Use short division to find the <strong>LCM</strong> of <strong>' + d.a + '</strong> and <strong>' + d.b + '</strong>.';
    case 'commonPrime': return zh ? '求 <strong>' + d.a + '</strong> 和 <strong>' + d.b + '</strong> 的最大公因數，下面哪一個是<strong>能同時整除</strong>兩個數的<strong>質數</strong>、可以寫在梯子左邊？' : 'To find the GCF of <strong>' + d.a + '</strong> and <strong>' + d.b + '</strong>, which of these is a <strong>prime</strong> that <strong>divides both</strong> numbers and can go on the left of the ladder?';
    case 'ladderBottom': return zh ? '用短除法把 <strong>' + d.a + '</strong> 和 <strong>' + d.b + '</strong> <strong>除到底</strong>（底下兩個數互質才停），最後底下剩下哪兩個數？' : 'Divide <strong>' + d.a + '</strong> and <strong>' + d.b + '</strong> <strong>all the way down</strong> by short division (stop only when the bottom pair is coprime). Which two numbers are left at the bottom?';
    case 'whichCoprime': return zh ? '下面四組數裡，<strong>只有一組互質</strong>。是哪一組？' : 'Of these four pairs, <strong>exactly one is coprime</strong>. Which?';
    case 'coprimeVerdict': return zh ? '<strong>' + d.a + '</strong> 和 <strong>' + d.b + '</strong> 互質嗎？' : 'Are <strong>' + d.a + '</strong> and <strong>' + d.b + '</strong> coprime?';
    case 'lcmCoprime': return zh ? '<strong>' + d.a + '</strong> 和 <strong>' + d.b + '</strong> 互質。它們的<strong>最小公倍數</strong>是多少？' : '<strong>' + d.a + '</strong> and <strong>' + d.b + '</strong> are coprime. What is their <strong>LCM</strong>?';
    case 'atomsToGcf': return zh ? '<strong>' + d.a + '</strong> ＝ ' + factorizeRef(d.a).join(' × ') + '，<strong>' + d.b + '</strong> ＝ ' + factorizeRef(d.b).join(' × ') + '。它們的<strong>最大公因數</strong>是多少？' : '<strong>' + d.a + '</strong> = ' + factorizeRef(d.a).join(' × ') + ' and <strong>' + d.b + '</strong> = ' + factorizeRef(d.b).join(' × ') + '. What is their <strong>GCF</strong>?';
    case 'whichToFind': return (zh ? '這一題該怎麼做？' : 'What should you do for this problem?') + '<br>' + scenStemRef(d.id, d.a, d.b, lang);
    case 'wordProblem': return scenStemRef(d.id, d.a, d.b, lang);
    case 'trueStatement': return zh ? '下面四句話，<strong>只有一句是對的</strong>。是哪一句？' : 'Of these four sentences, <strong>exactly one is true</strong>. Which?';
    case 'interFactorize': return zh ? '（上一課）哪一個是 <strong>' + d.n + '</strong> 的<strong>質因數分解</strong>？' : '(Last lesson) Which is the <strong>prime factorisation</strong> of <strong>' + d.n + '</strong>?';
    default: return null;
  }
}
const KEY_PAIR_RE = /^(\d+)-(\d+)$/;
function pairOfKey(k){ const m = KEY_PAIR_RE.exec(String(k)); return m ? [Number(m[1]), Number(m[2])] : null; }
function pairTextRef(pr, lang){ return lang === 'zh' ? pr[0] + ' 和 ' + pr[1] : pr[0] + ' and ' + pr[1]; }

module.exports = {
  /* ================= 產生器模擬（tools/simgen.js） ================= */
  sim: {
    INVARIANTS: {
      gcfLadder: d => {
        const bad = pairProblems('gcfLadder', d.a, d.b); if (bad) return bad;
        if (factorizeRef(gcdRef(d.a, d.b)).length < 2) return 'gcfLadder: gcf(' + d.a + ',' + d.b + ')=' + gcdRef(d.a, d.b) + ' gives a one-row ladder, the pool promises at least two rows';
        const o = intOptsProblems('gcfLadder', d, 1, LIMIT_REF, [d.a, d.b]); if (o) return o;
        if (d.opts[d.ans] !== gcdRef(d.a, d.b)) return 'gcfLadder: opts[ans]=' + d.opts[d.ans] + ' is not the gcf ' + gcdRef(d.a, d.b);
        const lp = ladderProblems('gcfLadder', d.L, d.a, d.b); if (lp.length) return lp[0];
      },
      lcmLadder: d => {
        const bad = pairProblems('lcmLadder', d.a, d.b); if (bad) return bad;
        if (gcdRef(d.a, d.b) === 1) return 'lcmLadder: (' + d.a + ',' + d.b + ') are coprime, so a × b would be a correct route to the answer';
        const o = intOptsProblems('lcmLadder', d, 1, LCM_LIMIT_REF, [d.a, d.b]); if (o) return o;
        if (d.opts[d.ans] !== lcmRef(d.a, d.b)) return 'lcmLadder: opts[ans]=' + d.opts[d.ans] + ' is not the lcm ' + lcmRef(d.a, d.b);
        if (d.a * d.b <= LCM_LIMIT_REF && d.opts.indexOf(d.a * d.b) < 0) return 'lcmLadder: the "just multiply" distractor ' + (d.a * d.b) + ' fits the range but is missing';
        const lp = ladderProblems('lcmLadder', d.L, d.a, d.b); if (lp.length) return lp[0];
      },
      commonPrime: d => {
        const bad = pairProblems('commonPrime', d.a, d.b); if (bad) return bad;
        if (gcdRef(d.a, d.b) === 1) return 'commonPrime: (' + d.a + ',' + d.b + ') share no prime, so no option can be correct';
        if (d.p !== smallestCommonPrimeRef(d.a, d.b)) return 'commonPrime: p=' + d.p + ' is not the smallest shared prime ' + smallestCommonPrimeRef(d.a, d.b);
        const o = intOptsProblems('commonPrime', d, 2, LIMIT_REF, [d.a, d.b]); if (o) return o;
        const good = d.opts.filter(v => isPrimeRef(v) && d.a % v === 0 && d.b % v === 0);
        if (good.length !== 1) return 'commonPrime: ' + good.length + ' options are primes dividing both ' + d.a + ' and ' + d.b + ' — the stem promises exactly one';
        if (d.opts[d.ans] !== good[0]) return 'commonPrime: opts[ans]=' + d.opts[d.ans] + ' is not the shared prime';
      },
      ladderBottom: d => {
        const bad = pairProblems('ladderBottom', d.a, d.b); if (bad) return bad;
        const L = d.L; const lp = ladderProblems('ladderBottom', L, d.a, d.b); if (lp.length) return lp[0];
        if (L.rows.length < 2) return 'ladderBottom: the ladder has ' + L.rows.length + ' row(s), the pool promises at least two';
        if (!Array.isArray(d.opts) || d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'ladderBottom: options are not four distinct';
        const g = gcdRef(d.a, d.b);
        const want = (d.a / g) + '-' + (d.b / g);
        if (d.opts[d.ans] !== want) return 'ladderBottom: opts[ans]=' + d.opts[d.ans] + ', the coprime bottom is ' + want;
        for (let i = 0; i < 4; i++){
          const pr = pairOfKey(d.opts[i]);
          if (!pr) return 'ladderBottom: option "' + d.opts[i] + '" is not a pair';
          if (i === d.ans) continue;
          /* 誘答不可以也是「底下互質而且乘回去是原來的數對」—— 那會是第二個正解 */
          if (gcdRef(pr[0], pr[1]) === 1 && pr[0] * g === d.a && pr[1] * g === d.b) return 'ladderBottom: distractor "' + d.opts[i] + '" is also a correct bottom';
          if (pr.some(v => v < 1 || v > LIMIT_REF)) return 'ladderBottom: distractor "' + d.opts[i] + '" is outside 1..100';
          if (pr.indexOf(d.a) >= 0 || pr.indexOf(d.b) >= 0) return 'ladderBottom: distractor "' + d.opts[i] + '" copies a number the stem prints';
        }
      },
      whichCoprime: d => {
        if (!Array.isArray(d.opts) || d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'whichCoprime: options are not four distinct pairs';
        const prs = d.opts.map(pairOfKey);
        if (prs.some(p => !p)) return 'whichCoprime: an option is not a pair';
        for (const p of prs){ const bad = pairProblems('whichCoprime', p[0], p[1]); if (bad) return bad; }
        const cops = prs.filter(p => gcdRef(p[0], p[1]) === 1);
        if (cops.length !== 1) return 'whichCoprime: ' + cops.length + ' of the four pairs are coprime, the stem promises exactly one';
        if (d.opts[d.ans] !== cops[0][0] + '-' + cops[0][1]) return 'whichCoprime: opts[ans] is not the coprime pair';
        if (!sameList(d.cop, cops[0])) return 'whichCoprime: d.cop does not match the coprime option';
        const lazy = prs.filter(p => gcdRef(p[0], p[1]) !== 1 && ((p[0] % 2 === 0 && p[1] % 2 === 0) || p[1] % p[0] === 0));
        if (lazy.length) return 'whichCoprime: distractor (' + lazy[0] + ') can be ruled out at a glance (two evens or a multiple)';
      },
      coprimeVerdict: d => {
        const bad = pairProblems('coprimeVerdict', d.a, d.b); if (bad) return bad;
        const g = gcdRef(d.a, d.b);
        if (d.g !== g) return 'coprimeVerdict: g=' + d.g + ', Euclid says ' + g;
        if (d.cop !== (g === 1)) return 'coprimeVerdict: cop flag is ' + d.cop + ' for gcf ' + g;
        if (!Array.isArray(d.opts) || d.opts.length !== 4 || new Set(d.opts.map(String)).size !== 4) return 'coprimeVerdict: options are not four distinct';
        const want = g === 1 ? 'cop' : g;
        if (d.opts[d.ans] !== want) return 'coprimeVerdict: opts[ans]=' + d.opts[d.ans] + ', expected ' + want;
        if (d.opts.filter(o => o === 'cop').length !== 1) return 'coprimeVerdict: the "coprime" conclusion must be offered exactly once';
        for (const o of d.opts){
          if (o === 'cop') continue;
          if (!(Number.isInteger(o) && o >= 2 && o <= LIMIT_REF)) return 'coprimeVerdict: a GCF option is not a whole number in 2..100: ' + o;
          if (o !== g && (o === d.a || o === d.b)) return 'coprimeVerdict: distractor copies the stem number ' + o;
        }
        if (g !== 1 && d.opts.filter(o => o === g).length !== 1) return 'coprimeVerdict: the true gcf must be offered exactly once';
      },
      lcmCoprime: d => {
        const bad = pairProblems('lcmCoprime', d.a, d.b); if (bad) return bad;
        if (gcdRef(d.a, d.b) !== 1) return 'lcmCoprime: (' + d.a + ',' + d.b + ') are not coprime, the stem says they are';
        const o = intOptsProblems('lcmCoprime', d, 1, LCM_LIMIT_REF, [d.a, d.b]); if (o) return o;
        if (d.opts[d.ans] !== d.a * d.b) return 'lcmCoprime: opts[ans]=' + d.opts[d.ans] + ' is not a × b';
        if (d.opts.indexOf(d.a + d.b) < 0) return 'lcmCoprime: the "add instead of multiply" distractor is missing';
      },
      atomsToGcf: d => {
        const bad = pairProblems('atomsToGcf', d.a, d.b); if (bad) return bad;
        const g = gcdRef(d.a, d.b);
        if (factorizeRef(g).length < 2) return 'atomsToGcf: gcf ' + g + ' has fewer than two atoms, the pool promises a composite gcf';
        const o = intOptsProblems('atomsToGcf', d, 1, LIMIT_REF, [d.a, d.b].concat(factorizeRef(d.a), factorizeRef(d.b))); if (o) return o;
        if (d.opts[d.ans] !== g) return 'atomsToGcf: opts[ans]=' + d.opts[d.ans] + ' is not the gcf ' + g;
      },
      whichToFind: d => {
        if (!SCEN_KIND_REF[d.id]) return 'whichToFind: unknown scenario ' + d.id;
        const bad = pairProblems('whichToFind', d.a, d.b); if (bad) return bad;
        if (gcdRef(d.a, d.b) === 1) return 'whichToFind: (' + d.a + ',' + d.b + ') are coprime, so "multiply" would also be a correct route';
        if (d.id === 'bus' && d.b > 60) return 'whichToFind: a bus every ' + d.b + ' minutes is outside the hour';
        if (d.kind !== SCEN_KIND_REF[d.id]) return 'whichToFind: scenario ' + d.id + ' asks for ' + SCEN_KIND_REF[d.id] + ', data says ' + d.kind;
        if (!Array.isArray(d.opts) || d.opts.slice().sort().join() !== ['gcf', 'lcm', 'product', 'sum'].join()) return 'whichToFind: the four conclusions are not each offered once';
        if (d.opts[d.ans] !== d.kind) return 'whichToFind: opts[ans] is ' + d.opts[d.ans];
      },
      wordProblem: d => {
        if (!SCEN_KIND_REF[d.id]) return 'wordProblem: unknown scenario ' + d.id;
        const bad = pairProblems('wordProblem', d.a, d.b); if (bad) return bad;
        if (gcdRef(d.a, d.b) === 1) return 'wordProblem: (' + d.a + ',' + d.b + ') are coprime — the reduce scenario would have nothing to simplify and "multiply" would be a correct route for the lcm ones';
        if (d.id === 'bus' && d.b > 60) return 'wordProblem: a bus every ' + d.b + ' minutes is outside the hour';
        if (d.kind !== SCEN_KIND_REF[d.id]) return 'wordProblem: scenario ' + d.id + ' asks for ' + SCEN_KIND_REF[d.id] + ', data says ' + d.kind;
        const want = d.kind === 'gcf' ? gcdRef(d.a, d.b) : lcmRef(d.a, d.b);
        const avoid = [d.a, d.b].concat(d.id === 'denom' ? [1] : []);
        const o = intOptsProblems('wordProblem', d, 1, d.kind === 'gcf' ? LIMIT_REF : LCM_LIMIT_REF, avoid); if (o) return o;
        if (d.opts[d.ans] !== want) return 'wordProblem: opts[ans]=' + d.opts[d.ans] + ', the ' + d.kind + ' is ' + want;
        const lp = ladderProblems('wordProblem', d.L, d.a, d.b); if (lp.length) return lp[0];
      },
      trueStatement: d => {
        if (!TRUE_STATEMENTS_REF[d.t]) return 'trueStatement: "' + d.t + '" is not a true statement';
        if (!Array.isArray(d.opts) || d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'trueStatement: options are not four distinct keys';
        const trues = d.opts.filter(k => TRUE_STATEMENTS_REF[k]);
        if (trues.length !== 1) return 'trueStatement: ' + trues.length + ' true sentences offered, the stem promises exactly one';
        if (d.opts.some(k => !TRUE_STATEMENTS_REF[k] && FALSE_KEYS_REF.indexOf(k) < 0)) return 'trueStatement: an option key is unknown to the truth table: ' + d.opts;
        if (d.opts[d.ans] !== d.t) return 'trueStatement: opts[ans] is ' + d.opts[d.ans];
      },
      interFactorize: d => {
        if (!(Number.isInteger(d.n) && d.n >= 4 && d.n <= LIMIT_REF) || isPrimeRef(d.n)) return 'interFactorize: n=' + d.n + ' is not a composite up to 100';
        const atoms = factorizeRef(d.n);
        if (atoms.length < 3) return 'interFactorize: n=' + d.n + ' has only ' + atoms.length + ' prime factors';
        if (!sameList(d.atoms, atoms)) return 'interFactorize: atoms [' + d.atoms + '] should be [' + atoms + ']';
        if (!Array.isArray(d.opts) || d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'interFactorize: options are not four distinct strings';
        if (d.opts[d.ans] !== atoms.join(' × ')) return 'interFactorize: opts[ans] is ' + d.opts[d.ans];
        for (let i = 0; i < 4; i++){
          if (i === d.ans) continue;
          const parts = parseProduct(d.opts[i]);
          if (!parts) return 'interFactorize: option "' + d.opts[i] + '" is not a product';
          if (parts.every(isPrimeRef) && productRef(parts) === d.n) return 'interFactorize: distractor "' + d.opts[i] + '" is also a correct prime factorisation';
          if (parts.some(x => x < 2 || x > LIMIT_REF) || productRef(parts) > LIMIT_REF) return 'interFactorize: distractor "' + d.opts[i] + '" leaves 2..100';
        }
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'gcfLadder': return String(gcdRef(d.a, d.b));
        case 'lcmLadder': return String(lcmRef(d.a, d.b));
        case 'commonPrime': return String(smallestCommonPrimeRef(d.a, d.b));
        case 'ladderBottom': { const g = gcdRef(d.a, d.b); return pairTextRef([d.a / g, d.b / g], lang); }
        case 'whichCoprime': { const cops = (d.opts || []).map(pairOfKey).filter(p => p && gcdRef(p[0], p[1]) === 1); return cops.length === 1 ? pairTextRef(cops[0], lang) : null; }
        case 'coprimeVerdict': { const g = gcdRef(d.a, d.b); if (g === 1) return lang === 'zh' ? '互質（最大公因數是 1）' : 'coprime (GCF 1)'; return lang === 'zh' ? '不互質，最大公因數是 ' + g : 'not coprime, GCF ' + g; }
        case 'lcmCoprime': return String(d.a * d.b);
        case 'atomsToGcf': return String(gcdRef(d.a, d.b));
        case 'whichToFind': return FIND_TEXT_REF[lang][SCEN_KIND_REF[d.id]];
        case 'wordProblem': { const v = SCEN_KIND_REF[d.id] === 'gcf' ? gcdRef(d.a, d.b) : lcmRef(d.a, d.b); return withUnitRef(d.id, v, lang); }
        case 'trueStatement': return TRUE_STATEMENTS_REF[d.t] ? TRUE_STATEMENTS_REF[d.t][lang] : null;
        case 'interFactorize': return factorizeRef(d.n).join(' × ');
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣：整數（可帶單位）、「a 和 b」的數對、質數相乘的算式、或固定的整句話。 */
    optionOk: function(s, genId, lang, isCorrect){
      const t = String(s).trim();
      if (!t) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
      if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
      if (lang === 'en' && /\p{Script=Han}/u.test(t)) return 'English option contains Chinese: ' + t;
      if (genId === 'trueStatement') return t.length >= 6 && t.length <= 80 && statementTruthOfText(t, lang) !== null ? null : 'trueStatement option is not one of the pinned sentences: ' + t;
      if (genId === 'whichToFind') return Object.keys(FIND_TEXT_REF[lang]).some(k => FIND_TEXT_REF[lang][k] === t) ? null : 'whichToFind option is not one of the four conclusions: ' + t;
      if (genId === 'coprimeVerdict'){
        if (t === (lang === 'zh' ? '互質（最大公因數是 1）' : 'coprime (GCF 1)')) return null;
        const m = lang === 'zh' ? /^不互質，最大公因數是 (\d+)$/.exec(t) : /^not coprime, GCF (\d+)$/.exec(t);
        if (!m) return 'coprimeVerdict option is not one of the conclusion shapes: ' + t;
        const v = Number(m[1]);
        return v >= 2 && v <= LIMIT_REF ? null : 'coprimeVerdict option names a GCF outside 2..100: ' + t;
      }
      if (genId === 'whichCoprime' || genId === 'ladderBottom'){
        const m = lang === 'zh' ? /^(\d+) 和 (\d+)$/.exec(t) : /^(\d+) and (\d+)$/.exec(t);
        if (!m) return genId + ' option is not a pair: ' + t;
        if (Number(m[1]) < 1 || Number(m[2]) < 1 || Number(m[1]) > LIMIT_REF || Number(m[2]) > LIMIT_REF) return genId + ' option leaves 1..100: ' + t;
        return null;
      }
      if (genId === 'interFactorize'){
        const parts = parseProduct(t);
        if (!parts) return 'interFactorize option is not written as a × b × c: ' + t;
        if (parts.length < 2 || parts.some(x => x < 2 || x > LIMIT_REF)) return 'interFactorize option has a factor outside 2..100: ' + t;
        if (isCorrect && parts.some(x => !isPrimeRef(x))) return 'the correct option ' + t + ' contains a composite';
        return null;
      }
      if (genId === 'wordProblem'){
        const m = /^(\d+)(?: (公分|袋|分鐘|cm|bags?|minutes?))?$/.exec(t);
        if (!m) return 'wordProblem option is not a number with an optional unit: ' + t;
        const v = Number(m[1]);
        return v >= 1 && v <= LCM_LIMIT_REF ? null : 'wordProblem option ' + t + ' is outside 1..600';
      }
      if (!/^\d+$/.test(t)) return 'option is not a whole number: ' + t;
      const v = Number(t);
      const hi = (genId === 'lcmLadder' || genId === 'lcmCoprime') ? LCM_LIMIT_REF : LIMIT_REF;
      if (v < 1 || v > hi) return genId + ' option ' + t + ' is outside 1..' + hi;
      if (genId === 'commonPrime' && isCorrect && !isPrimeRef(v)) return 'the correct commonPrime option ' + t + ' is not prime';
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次：整句題幹重建、值去重、算式算對、字串乾淨、以及每一支自己的語意。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length !== 4) out.push('there are ' + q.opts.length + ' options, not four');
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');
      const want = stemRef(genId, d, lang);
      if (want === null) out.push('no stem reference for ' + genId);
      else if (q.stem !== want) out.push('the rendered stem is not the rebuilt sentence: "' + q.stem.replace(/<[^>]+>/g, '') + '"');
      const keys = q.opts.map(optKeyRef);
      for (let i = 0; i < keys.length; i++)
        for (let j = i + 1; j < keys.length; j++)
          if (keys[i] === keys[j]) out.push('two options are the same: ' + q.opts[i] + ' / ' + q.opts[j]);
      const ar = arithAll(q.stem + ' ' + q.why);
      ar.problems.forEach(m => out.push(m));
      if (['gcfLadder', 'lcmLadder', 'commonPrime', 'ladderBottom', 'whichCoprime', 'coprimeVerdict', 'lcmCoprime', 'atomsToGcf', 'wordProblem', 'interFactorize'].indexOf(genId) >= 0 && ar.verified < 1)
        out.push('the explanation should contain an equation to verify, but none was read');
      stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
      stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
      FALSE_KEYS_REF.forEach(k => { if (q.why.indexOf(FALSE_STATEMENTS_REF[k][lang]) >= 0) out.push('the explanation states the misconception "' + FALSE_STATEMENTS_REF[k][lang] + '"'); });
      q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
      /* 每一支自己的語意，從**印出來的**選項讀回來（題幹已經整句釘住）。 */
      if (genId === 'whichCoprime'){
        const prs = q.opts.map(o => (lang === 'zh' ? /^(\d+) 和 (\d+)$/ : /^(\d+) and (\d+)$/).exec(o)).map(m => m ? [Number(m[1]), Number(m[2])] : null);
        if (prs.some(p => !p)) out.push('a rendered option is not a pair');
        else {
          const cops = prs.filter(p => gcdRef(p[0], p[1]) === 1);
          if (cops.length !== 1) out.push('the rendered options contain ' + cops.length + ' coprime pairs');
          else if (gcdRef(prs[q.ans][0], prs[q.ans][1]) !== 1) out.push('the marked option is not the coprime pair');
        }
      }
      if (genId === 'ladderBottom'){
        const m = (lang === 'zh' ? /^(\d+) 和 (\d+)$/ : /^(\d+) and (\d+)$/).exec(q.opts[q.ans]);
        const g = gcdRef(d.a, d.b);
        if (!m || Number(m[1]) !== d.a / g || Number(m[2]) !== d.b / g) out.push('the marked bottom pair is not ' + (d.a / g) + ' and ' + (d.b / g));
      }
      if (genId === 'trueStatement'){
        let trues = 0;
        q.opts.forEach(o => { const tv = statementTruthOfText(o, lang); if (tv === null) out.push('option "' + o + '" is not one of the pinned statement texts'); else if (tv) trues++; });
        if (trues !== 1) out.push('the rendered options contain ' + trues + ' true sentences');
      }
      if (genId === 'wordProblem'){
        const v = SCEN_KIND_REF[d.id] === 'gcf' ? gcdRef(d.a, d.b) : lcmRef(d.a, d.b);
        q.opts.forEach((o, i) => {
          const m = /^(\d+)(?: (.+))?$/.exec(o);
          const wantUnit = (withUnitRef(d.id, Number(m ? m[1] : 0), lang).match(/^\d+(?: (.+))?$/) || [])[1];
          if (!m || (m[2] || undefined) !== wantUnit) out.push('option "' + o + '" does not carry the unit of the ' + d.id + ' scenario');
        });
        if (q.opts[q.ans] !== withUnitRef(d.id, v, lang)) out.push('the marked option is not "' + withUnitRef(d.id, v, lang) + '"');
      }
      if (genId === 'coprimeVerdict'){
        const g = gcdRef(d.a, d.b);
        const cue = g === 1 ? (lang === 'zh' ? '互質' : 'coprime') : (lang === 'zh' ? '不互質' : 'not coprime');
        if (q.why.indexOf(cue) < 0) out.push('the explanation never concludes "' + cue + '"');
      }
      return out.length ? out.join('; ') : null;
    },

    /* 刻意的迷思誘答：這一課的產生器都用 avoid 把題幹數字擋掉，沒有任何一個值需要放行。 */
    stemEchoOk: {}
  },

  /* ================= index.html 靜態資料檢查（tools/verify_lesson_data.js） ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{LIMIT, LCM_LIMIT, isPrime, smallestPrimeFactor, factorize, productText, productOf, commonPrime, ladderRows, gcfOf, lcmOf, isCoprime, atomsSplit, ' +
                'FIG_W, VENN_H, VENN_R, VENN_CY, VENN_AX, VENN_BX, BUB_R, BUB_GAP, BUB_FS, COL_A_X, COL_S_X, COL_B_X, MAX_SIDE, MAX_SHARED, columnYs, vennPlan, ' +
                'S1_CASES, S2_CASES, S3_CASES, S4_CASES, SCENARIOS, scenarioAnswer, ROUNDS, STATEMENT_TRUTH, pairOf, roundAnswer, roundAnswerIndex, roundLadder, plEn, listText}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器自己先過 PROBE ---- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = arithAll(pr.text).problems.length > 0;
        if (caught !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"');
      });
      const lessonDir = path.dirname(process.argv[2]);      /* ⚠️ 不可以用 __dirname：breaktest 把四頁複製到暫存目錄 */
      const RAW = {}, TEXT = {};
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        try { RAW[pg] = fs.readFileSync(path.join(lessonDir, pg + '.html'), 'utf8'); TEXT[pg] = readerText(RAW[pg]); }
        catch (e){ fail('cannot read ' + pg + '.html next to index.html (' + e.code + ')'); }
      });

      /* ---- 1. 版面常數 ＝ 獨立寫死的第二份；畫布的 viewBox 與 CSS 高度 ---- */
      const CONSTS = { LIMIT:LIMIT_REF, LCM_LIMIT:LCM_LIMIT_REF, FIG_W:FIG_W_REF, VENN_H:VENN_H_REF, VENN_R:VENN_R_REF, VENN_CY:VENN_CY_REF, VENN_AX:VENN_AX_REF, VENN_BX:VENN_BX_REF,
                       BUB_R:BUB_R_REF, BUB_GAP:BUB_GAP_REF, BUB_FS:BUB_FS_REF, COL_A_X:COL_A_X_REF, COL_S_X:COL_S_X_REF, COL_B_X:COL_B_X_REF, MAX_SIDE:MAX_SIDE_REF, MAX_SHARED:MAX_SHARED_REF };
      Object.keys(CONSTS).forEach(k => { if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ' but the reference says ' + CONSTS[k]); });
      const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const svgs = liveSrc.match(/<svg[^>]*>/g) || [];
      if (svgs.length !== 1) fail('index.html has ' + svgs.length + ' canvases, expected 1 (the atom overlap picture; ladders are HTML)');
      svgs.forEach(tag => {
        const cls = (/class="([^"]+)"/.exec(tag) || [])[1];
        const nums = ((/viewBox="([^"]+)"/.exec(tag) || ['', ''])[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (cls !== 'vennfig') fail('a canvas has class "' + cls + '", which this config does not know');
        else if (nums.length !== 4 || nums[0] !== 0 || nums[1] !== 0 || nums[2] !== FIG_W_REF || nums[3] !== VENN_H_REF) fail('the canvas viewBox is ' + tag + ', expected 0 0 ' + FIG_W_REF + ' ' + VENN_H_REF);
      });
      const rules = liveSrc.match(/\.vennfig\s*\{[^}]*\}/g) || [];
      if (rules.length !== 1) fail('index.html declares the .vennfig rule ' + rules.length + ' time(s), expected exactly 1');
      else {
        const hs = rules[0].match(/[{;]\s*height:\s*(\d+)px/g) || [];
        if (hs.length !== 1) fail('the .vennfig rule declares a plain height ' + hs.length + ' time(s)');
        else if (Number(/height:\s*(\d+)px/.exec(hs[0])[1]) !== VENN_H_REF) fail('.vennfig is ' + hs[0].trim() + ' in CSS but the viewBox is ' + VENN_H_REF + ' tall — the drawing would be letterboxed');
      }
      /* 小圓的一直行真的放得進圓裡：用參考常數自己算一次（不是相信 MAX_SIDE／MAX_SHARED 的註解） */
      const step = 2 * BUB_R_REF + BUB_GAP_REF;
      const colFits = (n, x, needBoth) => {
        for (let i = 0; i < n; i++){
          const y = VENN_CY_REF - (n - 1) * step / 2 + i * step;
          const inA = dist(x, y, VENN_AX_REF, VENN_CY_REF) + BUB_R_REF <= VENN_R_REF, inB = dist(x, y, VENN_BX_REF, VENN_CY_REF) + BUB_R_REF <= VENN_R_REF;
          const outA = dist(x, y, VENN_AX_REF, VENN_CY_REF) - BUB_R_REF >= VENN_R_REF, outB = dist(x, y, VENN_BX_REF, VENN_CY_REF) - BUB_R_REF >= VENN_R_REF;
          if (needBoth ? !(inA && inB) : !((inA && outB) || (inB && outA))) return false;
        }
        return true;
      };
      if (!colFits(MAX_SIDE_REF, COL_A_X_REF, false) || !colFits(MAX_SIDE_REF, COL_B_X_REF, false)) fail('a side column of ' + MAX_SIDE_REF + ' bubbles does not fit inside one circle only');
      if (!colFits(MAX_SHARED_REF, COL_S_X_REF, true)) fail('a middle column of ' + MAX_SHARED_REF + ' bubbles does not fit inside the overlap');

      /* ---- 2. 數論函式 vs 篩法／輾轉相除／最大質因數法 ---- */
      for (let n = 1; n <= 200; n++){
        if (data.isPrime(n) !== isPrimeRef(n)) fail('isPrime(' + n + ')=' + data.isPrime(n) + ', the sieve says ' + isPrimeRef(n));
        if (!sameList(data.factorize(n), factorizeRef(n))) fail('factorize(' + n + ')=[' + data.factorize(n) + '], dividing by the largest prime gives [' + factorizeRef(n) + ']');
        if (n >= 2 && data.smallestPrimeFactor(n) !== spfRef(n)) fail('smallestPrimeFactor(' + n + ')=' + data.smallestPrimeFactor(n));
      }
      if (data.isPrime(0) || data.isPrime(-3) || data.isPrime(2.5) || data.isPrime(Infinity)) fail('isPrime accepts 0, a negative, a fraction or Infinity');
      if (data.smallestPrimeFactor(1) !== null || data.smallestPrimeFactor(Infinity) !== null) fail('smallestPrimeFactor does not fail closed on 1 / Infinity');
      if (data.ladderRows(0, 5) !== null || data.ladderRows(2.5, 5) !== null || data.ladderRows(Infinity, 5) !== null) fail('ladderRows does not fail closed on bad input');
      if (data.commonPrime(6, 10) !== 2 || data.commonPrime(9, 15) !== 3 || data.commonPrime(8, 15) !== null) fail('commonPrime is wrong on a spot check');
      let pairs = 0, coprimePairs = 0, ladders3 = 0;
      for (let a = 1; a <= LIMIT_REF; a++) for (let b = 1; b <= LIMIT_REF; b++){
        pairs++;
        const L = data.ladderRows(a, b);
        ladderProblems('ladderRows(' + a + ',' + b + ')', L, a, b).forEach(fail);
        if (L && L.rows.length >= 3) ladders3++;
        if (data.gcfOf(a, b) !== gcdRef(a, b)) fail('gcfOf(' + a + ',' + b + ')=' + data.gcfOf(a, b));
        if (data.lcmOf(a, b) !== lcmRef(a, b)) fail('lcmOf(' + a + ',' + b + ')=' + data.lcmOf(a, b));
        if (data.isCoprime(a, b) !== (gcdRef(a, b) === 1)) fail('isCoprime(' + a + ',' + b + ') is wrong');
        if (gcdRef(a, b) === 1){ coprimePairs++; if (data.lcmOf(a, b) !== a * b) fail('coprime pair (' + a + ',' + b + ') should have lcm a × b'); }
        const sp = data.atomsSplit(a, b), ref = splitRef(a, b);
        if (!sameList(sp.shared, ref.shared) || !sameList(sp.onlyA, ref.onlyA) || !sameList(sp.onlyB, ref.onlyB)) fail('atomsSplit(' + a + ',' + b + ') differs from the exponent count: ' + JSON.stringify(sp) + ' vs ' + JSON.stringify(ref));
        if (productRef(sp.shared) !== gcdRef(a, b)) fail('atomsSplit(' + a + ',' + b + ').shared does not multiply to the gcf');
      }
      if (pairs !== LIMIT_REF * LIMIT_REF) fail('only ' + pairs + ' pairs were checked');
      if (!ladders3) fail('no pair up to 100 gives a three-row ladder — the domain looks broken');
      /* 課程明講的兩句話：相鄰的整數一定互質；兩個不同的質數一定互質 */
      for (let n = 1; n < LIMIT_REF; n++) if (data.gcfOf(n, n + 1) !== 1) fail('neighbours ' + n + ' and ' + (n + 1) + ' are not coprime');
      PRIMES_200.filter(p => p <= LIMIT_REF).forEach(p => PRIMES_200.filter(q => q <= LIMIT_REF && q !== p).forEach(q => { if (data.gcfOf(p, q) !== 1) fail('primes ' + p + ' and ' + q + ' are not coprime'); }));
      if (data.productText([2, 2, 3]) !== '2 × 2 × 3') fail('productText does not write " × " between the atoms');
      if (data.productOf([2, 3, 5]) !== 30) fail('productOf([2,3,5]) is ' + data.productOf([2, 3, 5]));
      if (data.plEn(1, 'bag') !== '1 bag' || data.plEn(2, 'bag') !== '2 bags') fail('plEn is wrong');
      if (data.listText([2, 3], 'zh') !== '2、3' || data.listText([2, 3], 'en') !== '2, 3') fail('listText is wrong');

      /* ---- 3. 原子重疊圖：每一對 a < b ≤ 100 都畫一次量回來 ---- */
      let drawn = 0, capped = 0;
      for (let a = 2; a <= LIMIT_REF; a++) for (let b = a + 1; b <= LIMIT_REF; b++){
        const pl = data.vennPlan(a, b);
        vennProblems('vennPlan(' + a + ',' + b + ')', pl, a, b).forEach(fail);
        if (pl && pl.tooMany) capped++; else drawn++;
      }
      if (!drawn || !capped) fail('vennPlan domain: ' + drawn + ' drawable and ' + capped + ' capped pairs — both kinds must occur');
      if (!sameList(data.S1_CASES.map(p => p.join('-')), S1_CASES_REF.map(p => p.join('-')))) fail('S1_CASES is [' + data.S1_CASES.map(p => p.join(',')) + ']');
      let s1cop = 0, s1two = 0;
      S1_CASES_REF.forEach(pr => {
        const pl = data.vennPlan(pr[0], pr[1]);
        if (pl.tooMany) fail('S1 case ' + pr + ' does not fit the picture');
        if (gcdRef(pr[0], pr[1]) === 1) s1cop++;
        if (splitRef(pr[0], pr[1]).shared.length >= 2) s1two++;
      });
      if (!s1cop || !s1two) fail('S1_CASES must include a coprime pair (empty middle) and a pair with at least two shared atoms');
      const ys = data.columnYs(3);
      if (ys.length !== 3 || ys[1] !== VENN_CY_REF || ys[2] - ys[1] !== 2 * BUB_R_REF + BUB_GAP_REF) fail('columnYs(3) is [' + ys + ']');

      /* ---- 4. 範例 2～5 的案例 ---- */
      const pinPairs = (name, got, want) => { if (!sameList(got.map(p => p.join('-')), want.map(p => p.join('-')))) fail(name + ' is [' + got.map(p => p.join(',')) + '], the reference says [' + want.map(p => p.join(',')) + ']'); };
      pinPairs('S2_CASES', data.S2_CASES, S2_CASES_REF); pinPairs('S3_CASES', data.S3_CASES, S3_CASES_REF); pinPairs('S4_CASES', data.S4_CASES, S4_CASES_REF);
      S2_CASES_REF.forEach(pr => { if (data.ladderRows(pr[0], pr[1]).rows.length < 2) fail('S2 ladder case ' + pr + ' has fewer than two rows, so the method is not shown'); });
      if (!S2_CASES_REF.some(pr => data.ladderRows(pr[0], pr[1]).rows.length >= 3)) fail('S2 needs at least one three-row ladder');
      if (!S3_CASES_REF.some(pr => data.ladderRows(pr[0], pr[1]).rows.length === 1)) fail('S3 needs a one-row ladder so the L is seen in its simplest form');
      const s4 = { cop:0, non:0, bothCompositeCop:0, oddEvenNon:0, primeTimes:0 };
      S4_CASES_REF.forEach(pr => {
        const g = gcdRef(pr[0], pr[1]);
        if (g === 1){ s4.cop++; if (!isPrimeRef(pr[0]) && !isPrimeRef(pr[1])) s4.bothCompositeCop++; }
        else { s4.non++; if ((pr[0] + pr[1]) % 2 === 1) s4.oddEvenNon++; if (isPrimeRef(pr[0]) && pr[1] % pr[0] === 0) s4.primeTimes++; }
      });
      if (!s4.cop || !s4.non || !s4.bothCompositeCop || !s4.oddEvenNon) fail('S4_CASES must show coprime, non-coprime, a both-composite coprime pair and an odd-even non-coprime pair — got ' + JSON.stringify(s4));
      const scen = data.SCENARIOS.map(s => [s.id, s.kind, s.a, s.b].join('-'));
      if (!sameList(scen, SCENARIOS_REF.map(s => s.join('-')))) fail('SCENARIOS is [' + scen + ']');
      data.SCENARIOS.forEach(sc => {
        if (SCEN_KIND_REF[sc.id] !== sc.kind) fail('scenario ' + sc.id + ' is tagged ' + sc.kind);
        const want = sc.kind === 'gcf' ? gcdRef(sc.a, sc.b) : lcmRef(sc.a, sc.b);
        if (data.scenarioAnswer(sc) !== want) fail('scenarioAnswer(' + sc.id + ')=' + data.scenarioAnswer(sc) + ', expected ' + want);
        if (gcdRef(sc.a, sc.b) === 1) fail('scenario ' + sc.id + ' uses a coprime pair, so "multiply" would be a correct route');
        if (sc.id === 'bus' && sc.b > 60) fail('bus scenario period ' + sc.b + ' is outside the hour');
        if (sc.id === 'reduce' && sc.a >= sc.b) fail('reduce scenario is not a proper fraction');
      });
      if (data.SCENARIOS.filter(s => s.kind === 'gcf').length !== 3) fail('SCENARIOS should hold three gcf and three lcm problems');

      /* ---- 5. 小遊戲 ---- */
      if (!Array.isArray(data.ROUNDS) || data.ROUNDS.length !== GAME_ROUNDS_REF) fail('ROUNDS has ' + (data.ROUNDS || []).length + ' rounds');
      const kinds = data.ROUNDS.map(r => r.kind);
      if (kinds.slice().sort().join() !== ['firstPrime', 'gcfLadder', 'lcmLadder', 'statement', 'whichCoprime'].join()) fail('the five rounds are not one of each kind: ' + kinds);
      if (new Set(data.ROUNDS.map(r => r.ans)).size < 3) fail('the game answers sit in fewer than three different positions, so a child can learn the slot');
      Object.keys(GAME_TRUTH_REF).forEach(k => { if (data.STATEMENT_TRUTH[k] !== GAME_TRUTH_REF[k]) fail('STATEMENT_TRUTH.' + k + ' is ' + data.STATEMENT_TRUTH[k]); });
      if (Object.keys(data.STATEMENT_TRUTH).length !== Object.keys(GAME_TRUTH_REF).length) fail('STATEMENT_TRUTH has extra keys');
      if (!sameList(data.pairOf('10-21'), [10, 21])) fail('pairOf is wrong');
      data.ROUNDS.forEach((r, i) => {
        const tag = 'round ' + (i + 1) + ' (' + r.kind + ')';
        if (!Array.isArray(r.opts) || r.opts.length !== 4 || new Set(r.opts.map(String)).size !== 4) fail(tag + ': options are not four distinct');
        const idx = data.roundAnswerIndex(r);
        if (idx !== r.ans) fail(tag + ': roundAnswerIndex()=' + idx + ' but ans=' + r.ans);
        if (data.roundAnswer(r) === null) fail(tag + ': roundAnswer() is null');
        if (r.kind === 'firstPrime'){
          const good = r.opts.filter(v => isPrimeRef(v) && r.a % v === 0 && r.b % v === 0);
          if (good.length !== 1) fail(tag + ': ' + good.length + ' options are primes dividing both');
          if (r.opts[r.ans] !== good[0]) fail(tag + ': the marked option is not the shared prime');
          const fig = data.roundLadder(r);
          if (!fig || fig.step !== 0) fail(tag + ': the ladder should be shown before any division');
          else ladderProblems(tag + ' ladder', fig.ladder, r.a, r.b).forEach(fail);
        }
        if (r.kind === 'gcfLadder' || r.kind === 'lcmLadder'){
          const want = r.kind === 'gcfLadder' ? gcdRef(r.a, r.b) : lcmRef(r.a, r.b);
          if (r.opts[r.ans] !== want) fail(tag + ': the marked option is not ' + want);
          if (r.opts.some(v => !Number.isInteger(v) || v < 1 || v > LCM_LIMIT_REF)) fail(tag + ': an option leaves 1..600');
          const fig = data.roundLadder(r);
          if (!fig || !fig.ladder || fig.step !== fig.ladder.rows.length) fail(tag + ': the finished ladder should be shown');
          else ladderProblems(tag + ' ladder', fig.ladder, r.a, r.b).forEach(fail);
          if (fig && fig.ladder && fig.ladder.rows.length < 2) fail(tag + ': the game ladder should have at least two rows');
        }
        if (r.kind === 'whichCoprime'){
          const prs = r.opts.map(pairOfKey);
          if (prs.some(p => !p)) fail(tag + ': an option is not a pair key');
          else {
            const cops = prs.filter(p => gcdRef(p[0], p[1]) === 1);
            if (cops.length !== 1) fail(tag + ': ' + cops.length + ' coprime pairs offered');
            if (!sameList(r.pairs.map(p => p.join('-')), r.opts)) fail(tag + ': pairs and opts disagree');
            if (r.opts[r.ans] !== cops[0].join('-')) fail(tag + ': the marked option is not the coprime pair');
          }
          if (data.roundLadder(r) !== null) fail(tag + ': only the first three rounds have a ladder');
        }
        if (r.kind === 'statement'){
          const trues = r.opts.filter(k => GAME_TRUTH_REF[k]);
          if (trues.length !== 1) fail(tag + ': ' + trues.length + ' true statements offered');
          if (r.opts.some(k => !(k in GAME_TRUTH_REF))) fail(tag + ': an option key is not in the truth table');
          if (r.opts[r.ans] !== trues[0]) fail(tag + ': the marked option is not the true statement');
          if (data.roundLadder(r) !== null) fail(tag + ': only the first three rounds have a ladder');
        }
      });

      /* ---- 6. 字典函式真的跑起來：每一句旁白都渲染一次再掃 ---- */
      const strings = [];
      function add(text, lang, where){ strings.push({ text:String(text), lang, where }); }
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang];
        if (!d){ fail('I18N.' + lang + ' missing'); return; }
        S1_CASES_REF.forEach(pr => {
          const pl = data.vennPlan(pr[0], pr[1]);
          add(d.s1cap(pl), lang, 's1cap'); add(d.s1narr(pl), lang, 's1narr'); add(d.s1calc(pl), lang, 's1calc'); add(d.s1result(pl), lang, 's1result');
          add(d.s1lgA(pl), lang, 's1lgA'); add(d.s1lgS(pl), lang, 's1lgS'); add(d.s1lgB(pl), lang, 's1lgB'); add(d.s1chip(pr), lang, 's1chip');
          const g = gcdRef(pr[0], pr[1]), l = lcmRef(pr[0], pr[1]);
          if (!new RegExp('(^|\\D)' + g + '(\\D|$)').test(d.s1result(pl).replace(/<[^>]+>/g, '')) || !new RegExp('(^|\\D)' + l + '(\\D|$)').test(d.s1result(pl))) fail('s1result(' + pr + ') does not print both ' + g + ' and ' + l);
          if (g === 1 && d.s1narr(pl).indexOf(lang === 'zh' ? '互質' : 'coprime') < 0) fail('s1narr(' + pr + ') never says the pair is coprime');
        });
        add(d.s1cap({ tooMany:true, a:1, b:1 }), lang, 's1cap-tooMany');
        S2_CASES_REF.forEach(pr => {
          const L = data.ladderRows(pr[0], pr[1]);
          for (let step = 0; step <= L.rows.length; step++){
            add(d.s2narr(L, step), lang, 's2narr'); add(d.s2calc(L, step), lang, 's2calc'); add(d.s2result(L, step), lang, 's2result');
            add(d.ladderPair(L, step), lang, 'ladderPair'); add(d.ladderStep(step, L.rows.length), lang, 'ladderStep');
          }
          add(d.s2chip(pr), lang, 's2chip');
          const fin = d.s2result(L, L.rows.length);
          if (!new RegExp('(^|\\D)' + L.gcf + '(\\D|$)').test(fin)) fail('s2result(' + pr + ') final does not print the gcf ' + L.gcf);
          if (d.s2result(L, 0) !== (lang === 'zh' ? '？' : '?')) fail('s2result(' + pr + ', 0) already shows a result');
        });
        S3_CASES_REF.forEach(pr => {
          const L = data.ladderRows(pr[0], pr[1]);
          for (let step = 0; step <= L.rows.length; step++){ add(d.s3narr(L, step), lang, 's3narr'); add(d.s3calc(L, step), lang, 's3calc'); add(d.s3result(L, step), lang, 's3result'); }
          add(d.s3chip(pr), lang, 's3chip');
          const fin = d.s3result(L, L.rows.length);
          if (!new RegExp('(^|\\D)' + L.lcm + '(\\D|$)').test(fin)) fail('s3result(' + pr + ') final does not print the lcm ' + L.lcm);
          if (d.s3narr(L, L.rows.length).indexOf(String(L.gcf * L.lcm)) < 0) fail('s3narr(' + pr + ') final does not show the gcf × lcm check');
        });
        S4_CASES_REF.forEach(pr => {
          const L = data.ladderRows(pr[0], pr[1]);
          add(d.s4narr(L), lang, 's4narr'); add(d.s4calc(L), lang, 's4calc'); add(d.s4result(L), lang, 's4result'); add(d.s4chip(pr), lang, 's4chip');
          const cop = gcdRef(pr[0], pr[1]) === 1;
          const yes = lang === 'zh' ? ' 互質' : ' are coprime', no = lang === 'zh' ? '不互質' : 'not coprime';
          if (cop && (d.s4result(L).indexOf(no) >= 0 || d.s4result(L).indexOf(yes) < 0)) fail('s4result(' + pr + ') does not say coprime');
          if (!cop && d.s4result(L).indexOf(no) < 0) fail('s4result(' + pr + ') does not say not coprime');
        });
        data.SCENARIOS.forEach(sc => {
          const L = data.ladderRows(sc.a, sc.b);
          add(d.s5stem(sc), lang, 's5stem'); add(d.s5narr(sc, L), lang, 's5narr'); add(d.s5calc(sc, L), lang, 's5calc'); add(d.s5result(sc, L), lang, 's5result'); add(d.s5chip(sc), lang, 's5chip');
          const v = data.scenarioAnswer(sc);
          if (!new RegExp('(^|\\D)' + v + '(\\D|$)').test(d.s5result(sc, L))) fail('s5result(' + sc.id + ') does not print the answer ' + v);
          const cue = sc.kind === 'gcf' ? (lang === 'zh' ? '最大公因數' : 'GCF') : (lang === 'zh' ? '最小公倍數' : 'LCM');
          if (d.s5calc(sc, L).indexOf(cue) < 0) fail('s5calc(' + sc.id + ') does not name the ' + cue);
          /* 題幹不可以把答案印出來（圖說替孩子把題目做完那一類） */
          if (new RegExp('(^|\\D)' + v + '(\\D|$)').test(d.s5stem(sc).replace(/<[^>]+>/g, '')) && v !== sc.a && v !== sc.b) fail('s5stem(' + sc.id + ') prints the answer ' + v);
        });
        data.ROUNDS.forEach(r => {
          add(d.gPrompt[r.kind](r), lang, 'gPrompt'); add(d.gHint1[r.kind], lang, 'gHint1'); add(d.gHint2[r.kind](r), lang, 'gHint2'); add(d.gCap[r.kind], lang, 'gCap');
          r.opts.forEach((o, i) => add(d.gOptText(r, i), lang, 'gOptText'));
          /* 數值關的第一層提示不可以把正解印出來 */
          if (r.kind !== 'statement' && r.kind !== 'whichCoprime'){
            const p = String(data.roundAnswer(r));
            if (new RegExp('(^|\\D)' + p + '(\\D|$)').test(d.gHint1[r.kind])) fail(lang + ' gHint1 for ' + r.kind + ' prints the answer ' + p);
          }
        });
        add(d.gWrong(5), lang, 'gWrong'); add(d.gWrong(0), lang, 'gWrong'); add(d.gWin(90), lang, 'gWin');
        ['intro', 'scopeNote', 's1note', 's2note', 's3note', 's4note', 's5note', 'footer', 'next3', 's1lead', 's2lead', 's3lead', 's4lead', 's5lead'].forEach(k => add(d[k], lang, k));
      });
      strings.forEach(s => {
        if (!s.text.trim()) { if (s.where !== 'gCap') fail(s.where + ' rendered an empty string'); return; }
        stringProblems(s.text, s.lang, s.where).forEach(fail);
        arithAll(s.text).problems.forEach(m => fail(s.where + ': ' + m));
      });
      const NARRATED_COUNT_REF = 522;
      if (strings.length !== NARRATED_COUNT_REF) fail('rendered ' + strings.length + ' dictionary strings, the reference pins ' + NARRATED_COUNT_REF);
      const fp = crypto.createHash('sha1').update(strings.map(s => s.where + '|' + s.lang + '|' + s.text).join('\n')).digest('hex').slice(0, 12);
      /* 每一句渲染出來的字串（連同它是哪一個函式、哪一種語言、第幾筆）的指紋：只釘條數擋不住「拿掉一句、再補一句」，
         排序過的多重集合擋不住「兩個範例的旁白互換」。改了任何旁白就重讀一次再重釘（PRINT_FP=1 印出來）。 */
      const NARRATED_FINGERPRINT_REF = '95a21d82394d';
      if (process.env.PRINT_FP) console.log('FINGERPRINT ' + fp);
      if (fp !== NARRATED_FINGERPRINT_REF) fail('the rendered dictionary strings changed (fingerprint ' + fp + ', pinned ' + NARRATED_FINGERPRINT_REF + ') — re-read them, then re-pin');

      /* ---- 7. 題庫神諭：題數、整句題幹、四個選項、正解原文、事實 ---- */
      Object.keys(BANK).forEach(bank => {
        ['zh', 'en'].forEach(lang => {
          const qs = I18N[lang][bank] || [];
          if (qs.length !== BANK[bank].length){ fail(bank + ' (' + lang + ') has ' + qs.length + ' questions, expected ' + BANK[bank].length); return; }
          qs.forEach((q, i) => {
            const ref = BANK[bank][i];
            if (q.stem !== ref[lang]) fail(bank + '[' + i + '] ' + lang + ' stem is not the pinned sentence: ' + q.stem);
            const want = lang === 'zh' ? ref.ansZh : ref.ansEn;
            if (q.opts[q.ans] !== want) fail(bank + '[' + i + '] ' + lang + ' marked option "' + q.opts[q.ans] + '" is not the oracle\'s "' + want + '"');
            if (q.opts.length !== 4 || new Set(q.opts).size !== 4) fail(bank + '[' + i + '] ' + lang + ' options are not four distinct');
            const pinned = lang === 'zh' ? ref.optsZh : ref.optsEn;
            if (!sameList(q.opts, pinned)) fail(bank + '[' + i + '] ' + lang + ' options are not the pinned four: [' + q.opts.join(' | ') + ']');
            const ar = arithAll(q.stem + ' ' + q.why + ' ' + q.opts.join(' '));
            ar.problems.forEach(m => fail(bank + '[' + i + '] ' + lang + ': ' + m));
            if (ar.verified < 1) fail(bank + '[' + i + '] ' + lang + ': the explanation should contain an equation to verify, but none was read');
            stringProblems(q.stem, lang, bank + '[' + i + '] stem').forEach(fail);
            stringProblems(q.why, lang, bank + '[' + i + '] why').forEach(fail);
            q.opts.forEach(o => stringProblems(o, lang, bank + '[' + i + '] option').forEach(fail));
          });
        });
      });
      BANK_FACTS.forEach(f => {
        if (f.pair){
          const g = gcdRef(f.pair[0], f.pair[1]);
          if ('gcf' in f && g !== f.gcf) fail('bank fact: gcf(' + f.pair + ') is ' + g);
          if ('lcm' in f && lcmRef(f.pair[0], f.pair[1]) !== f.lcm) fail('bank fact: lcm(' + f.pair + ') is ' + lcmRef(f.pair[0], f.pair[1]));
          if (f.left){ const L = data.ladderRows(f.pair[0], f.pair[1]); if (!sameList(L.left, f.left)) fail('bank fact: ladder left for ' + f.pair + ' is [' + L.left + ']'); if (f.bottom && !sameList(L.bottom, f.bottom)) fail('bank fact: ladder bottom for ' + f.pair + ' is [' + L.bottom + ']'); }
        }
        if (f.n && !sameList(factorizeRef(f.n), f.atoms)) fail('bank fact: ' + f.n + ' factorises as [' + factorizeRef(f.n) + ']');
      });
      /* 解釋（why）也釘一個指紋：題幹與選項逐字釘住之後，解釋是唯一還能改字的地方 —— 改了就重讀一次再重釘（PRINT_FP=1）。 */
      const whyFp = crypto.createHash('sha1').update(['zh', 'en'].map(lang => Object.keys(BANK).map(bank => (I18N[lang][bank] || []).map(q => q.why).join('\n')).join('\n')).join('\n')).digest('hex').slice(0, 12);
      if (process.env.PRINT_FP) console.log('BANK_WHY_FINGERPRINT ' + whyFp);
      if (whyFp !== BANK_WHY_FINGERPRINT_REF) fail('the quiz explanations changed (fingerprint ' + whyFp + ', pinned ' + BANK_WHY_FINGERPRINT_REF + ') — re-read them, then re-pin');
      const spread = new Set();
      Object.keys(BANK).forEach(bank => (I18N.zh[bank] || []).forEach(q => spread.add(q.ans)));
      if (spread.size < 3) fail('quiz answers use only ' + spread.size + ' positions');

      /* ---- 8. 跨頁釘樁 ---- */
      const renderedAll = strings.map(x => x.text).join('\n');
      const renderedDictCache = {}, dictStrings = {};
      function renderedDictText(file){
        if (renderedDictCache[file] !== undefined) return renderedDictCache[file];
        const raw = RAW[file];
        let text = '';
        try {
          const i0 = raw.indexOf('var I18N = {'), i1 = raw.indexOf("var lang = 'zh';", i0);
          const dict = new Function(raw.slice(i0, i1) + '; return I18N;')();
          const markupLive = raw.slice(0, i0).replace(/<!--[\s\S]*?-->/g, '\n');
          const keys = [...new Set((markupLive.match(/data-i18n(?:-aria)?="([^"]+)"/g) || []).map(m => /"([^"]+)"/.exec(m)[1]))];
          dictStrings[file] = [];
          ['zh', 'en'].forEach(lang => {
            keys.forEach(k => { if (typeof dict[lang][k] === 'string'){ text += dict[lang][k] + '\n'; dictStrings[file].push({ text:dict[lang][k], lang, table:false }); stringProblems(dict[lang][k], lang, file + '.' + lang + '.' + k).forEach(fail); } });
            Object.keys(dict[lang]).forEach(k => { if (Array.isArray(dict[lang][k])) dict[lang][k].forEach((row, ri) => { const cell = Array.isArray(row) ? row.join(' ') : String(row); text += cell + '\n'; dictStrings[file].push({ text:cell, lang, table:true, cells:Array.isArray(row) ? row.map(String) : [String(row)] }); stringProblems(cell, lang, file + '.' + lang + '.' + k + '[' + ri + ']').forEach(fail); }); });
          });
        } catch (e){ fail(file + '.html: cannot execute its I18N dictionary to check what a reader sees: ' + e.message); text = ''; }
        renderedDictCache[file] = text;
        return text;
      }
      ['reference', 'parents'].forEach(f => { if (RAW[f] !== undefined) renderedDictText(f); });
      SIBLING_RULES.forEach(rule => {
        const text = TEXT[rule.file];
        if (text === undefined) return;
        let count = 0, at = -1;
        while ((at = text.indexOf(rule.text, at + 1)) >= 0) count++;
        if (count !== rule.min) fail(rule.file + '.html says "' + rule.text + '" ' + count + ' time(s), the oracle pins ' + rule.min + ' — it ' + rule.why);
        const raw = RAW[rule.file];
        const split = raw.indexOf('var I18N = {');
        const markupPart = readerText(split > 0 ? raw.slice(0, split) : raw);
        const dictPart = readerText(split > 0 ? raw.slice(split) : '');
        const inMarkup = markupPart.indexOf(rule.text) >= 0;
        let live;
        if (rule.file === 'index') live = inMarkup || renderedAll.indexOf(rule.text) >= 0;
        else if (rule.file === 'review') live = inMarkup || dictPart.indexOf(rule.text) >= 0;
        else live = inMarkup || renderedDictText(rule.file).indexOf(rule.text) >= 0;
        if (!live) fail(rule.file + '.html has "' + rule.text + '" in its source but not anywhere a reader would see it');
      });
      FORBIDDEN.forEach(rule => {
        const text = TEXT[rule.file];
        if (text !== undefined && text.indexOf(rule.text) >= 0) fail(rule.file + '.html says "' + rule.text + '", which ' + rule.why);
      });
      /* 六句「假的」規則只能出現在句庫／遊戲第 5 關的選項裡（review 的 STATEMENTS、index 的 gOptText），不可以出現在任何一頁的散文裡。
         這擋的是「多加一句錯的話」—— 釘「必須出現」的規則擋不住它。 */
      /* 合法的引用只有三種：句庫／遊戲第 5 關的選項、試題的錯誤選項、速查卡「這句話 對不對」表裡標成錯的那一列。
         其餘任何地方（markup 的散文、渲染出來的旁白、字典裡的段落）出現，都是把迷思寫成了事實。 */
      /* 「必定／總是／永遠」折成「一定」再掃 —— 這仍然是字面比對，換一種說法（「沒有不互質的」）看不到；寫在這裡，不要當成全覆蓋。 */
      const normRule = x => String(x).replace(/必定|總是|永遠|一律/g, '一定').replace(/\b(invariably|without exception)\b/gi, 'always');
      const idxMarkup = normRule(readerText(src.slice(0, src.indexOf('var I18N = {'))));
      FALSE_KEYS_REF.forEach(k => {
        ['zh', 'en'].forEach(lang => {
          const sentence = FALSE_STATEMENTS_REF[k][lang];
          if (idxMarkup.indexOf(sentence) >= 0) fail('index.html markup states the misconception "' + sentence + '" as prose');
          /* gOptText 放行是安全的：第 5 關哪一句是對的由 STATEMENT_TRUTH 決定，而它逐鍵釘在 GAME_TRUTH_REF 上（step 5），假句不可能被標成正解 */
          strings.forEach(x => { if (x.where !== 'gOptText' && normRule(x.text).indexOf(sentence) >= 0) fail(x.where + ' (' + x.lang + ') states the misconception "' + sentence + '"'); });
          ['reference', 'parents'].forEach(f => {
            if (RAW[f] === undefined) return;
            const markup = normRule(readerText(RAW[f].slice(0, RAW[f].indexOf('var I18N = {'))));
            if (markup.indexOf(sentence) >= 0) fail(f + '.html markup states the misconception "' + sentence + '" as prose');
            (dictStrings[f] || []).forEach(x => {
              if (normRule(x.text).indexOf(sentence) < 0) return;
              /* 只准出現在「這句話｜對不對｜例子」表的第一格，而且第二格標成錯；出現在別的格子（例子欄、說明欄）一樣是散文 */
              const okCell = x.cells && normRule(x.cells[0]).indexOf(sentence) >= 0 && /<strong>(錯|False)<\/strong>/.test(x.cells[1] || '') &&
                             x.cells.slice(1).every(c => normRule(c).indexOf(sentence) < 0);
              if (!okCell) fail(f + '.html states the misconception "' + sentence + '" outside the statement cell of a row marked wrong');
            });
          });
        });
      });
      HANDOFF.forEach(rule => {
        rule.files.forEach(f => {
          if (TEXT[f] === undefined) return;
          const text = TEXT[f].replace(/\s+/g, ' ');     /* 原始碼裡的換行在畫面上只是空白，不是句子的邊界 */
          let at = -1;
          while ((at = text.indexOf(rule.word, at + 1)) >= 0){
            /* 同一個句子（上一個句號到下一個句號之間），不是「前面 60 個字裡剛好有」 */
            /* 英文句號也是邊界（後面接空白或結尾的 `.`，`8:36 a.m. 6 is` 這種會多切一刀 —— 多切只會讓檢查更嚴，不會放行） */
            const BOUND = /[；。;!?]|\.["'”’」』)\]）】]*(?=\s|$)/g;      /* 句號後面可以接引號／括號再空白（中英文的都算） */
            let start = 0, bm;
            const head = text.slice(0, at);
            while ((bm = BOUND.exec(head)) !== null) start = bm.index + 1;     /* 最後一個邊界；小數點（`2.5 cm`）不是邊界也不會讓搜尋失敗 */
            const endM = text.slice(at).search(/[；。;!?]|\.["'”’」』)\]）】]*(?=\s|$)/);
            const end = endM < 0 ? text.length : at + endM;
            const sentence = text.slice(start, end);
            if (!rule.near.some(n => sentence.indexOf(n) >= 0))
              fail(f + '.html mentions "' + rule.word + '" without saying where it belongs (expected one of ' + rule.near.join('/') + ' in the same sentence)');
          }
        });
      });
      RENDER_PINS.forEach(pin => {
        const code = RAW[pin.file] === undefined ? undefined : stripJsComments(RAW[pin.file]);
        if (code === undefined) return;
        let count = 0, at = -1;
        while ((at = code.indexOf(pin.text, at + 1)) >= 0) count++;
        if (count < pin.min) fail(pin.file + '.html no longer wires the drawing to the plan the checker measures: "' + pin.text.slice(0, 56) + '…" appears ' + count + ' time(s)');
        if (pin.max !== undefined && count > pin.max) fail(pin.file + '.html draws into the same target more than once: "' + pin.text + '" appears ' + count + ' time(s), so the checker may be measuring a plan the child never sees');
      });
      if (!/teachme-last[\s\S]{0,80}grade-6\/math\/gcf-lcm\//.test(src)) fail('index.html does not record teachme-last for grade-6/math/gcf-lcm/');

      /* ---- 9. 產生器清單：把 review.html 的 GENS 真的跑起來比 id；抽樣池逐字釘住；句庫真值表一致 ---- */
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
            GENS.forEach(g => { if (typeof g.make !== 'function') fail('generator ' + g.id + ' has no make()'); if (typeof g.fmt !== 'function') fail('generator ' + g.id + ' has no fmt()'); });
          }
        }
        const rvLive = stripJsComments(rv);
        REVIEW_PINS.forEach(p => { if (rvLive.indexOf(p) < 0) fail('review.html no longer contains the sampling line "' + p.slice(0, 60) + '…"'); });
        Object.keys(TRUE_STATEMENTS_REF).forEach(k => { if (!new RegExp(k + ':\\s*\\{\\s*truth:true').test(rvLive)) fail('review.html does not mark "' + k + '" as true'); });
        FALSE_KEYS_REF.forEach(k => { if (!new RegExp(k + ':\\s*\\{\\s*truth:false').test(rvLive)) fail('review.html does not mark "' + k + '" as false'); });
        /* 六個情境的題幹在 review 裡也要和這裡的重建一致（跑起來比，不比原始碼） */
        try {
          const SC = new Function(rv.slice(i0, i1) + '\n; return SCEN;')();
          Object.keys(SCEN_KIND_REF).forEach(id => {
            if (!SC[id]) { fail('review.html has no scenario "' + id + '"'); return; }
            if (SC[id].kind !== SCEN_KIND_REF[id]) fail('review.html scenario ' + id + ' asks for ' + SC[id].kind);
            ['zh', 'en'].forEach(lang => { if (SC[id].stem(12, 18, lang) !== scenStemRef(id, 12, 18, lang)) fail('review.html scenario ' + id + ' (' + lang + ') stem differs from the rebuilt sentence'); });
          });
          if (Object.keys(SC).length !== Object.keys(SCEN_KIND_REF).length) fail('review.html has ' + Object.keys(SC).length + ' scenarios, expected ' + Object.keys(SCEN_KIND_REF).length);
        } catch (e){ fail('cannot read SCEN out of review.html: ' + e.message); }
      }
    }
  },

  breaks: [
    /* --- 版面常數與畫布 --- */
    { file:'index', via:'index', expect:'layout constant VENN_AX',
      find:'var VENN_R = 110, VENN_CY = 130, VENN_AX = 160, VENN_BX = 300;',
      replace:'var VENN_R = 110, VENN_CY = 130, VENN_AX = 120, VENN_BX = 300;',
      why:'the left circle would be drawn off its reference position and clip the canvas' },
    { file:'index', via:'index', expect:'the canvas viewBox is',
      find:'<svg class="vennfig" id="s1fig" viewBox="0 0 460 260"',
      replace:'<svg class="vennfig" id="s1fig" viewBox="0 0 460 200"',
      why:'the circles would be drawn in a shorter coordinate system than they use' },
    { file:'index', via:'index', expect:'in CSS but the viewBox is',
      find:'.vennfig{width:100%;max-width:460px;height:260px;display:block;margin:0 auto}',
      replace:'.vennfig{width:100%;max-width:460px;height:320px;display:block;margin:0 auto}',
      why:'the picture would be letterboxed inside a taller box' },

    /* --- 數論函式：兩套實作要一致 --- */
    { file:'index', via:'index', expect:'isPrime(4)=true',
      find:'for (var p = 2; p * p <= n; p++) if (n % p === 0) return false;',
      replace:'for (var p = 2; p * p < n; p++) if (n % p === 0) return false;',
      why:'squares of primes would be called prime, so a 4 could be written on the left of a ladder' },
    { file:'index', via:'index', expect:'commonPrime is wrong on a spot check',
      find:'for (var p = 2; p <= m; p++) if (isPrime(p) && a % p === 0 && b % p === 0) return p;',
      replace:'for (var p = 3; p <= m; p++) if (isPrime(p) && a % p === 0 && b % p === 0) return p;',
      why:'2 would never be found as a shared prime, so every even pair would be called coprime' },
    { file:'index', via:'index', expect:': lcm is',
      find:'return { a:a, b:b, rows:rows, left:left, bottom:[x, y], gcf:gcf, lcm:gcf * x * y, coprime: gcf === 1 };',
      replace:'return { a:a, b:b, rows:rows, left:left, bottom:[x, y], gcf:gcf, lcm:gcf * x, coprime: gcf === 1 };',
      why:'the L shape would miss one bottom number and every LCM on the page would be wrong' },
    { file:'index', via:'index', expect:'differs from the exponent count',
      find:'if (i >= 0){ shared.push(x); fb.splice(i, 1); } else onlyA.push(x);',
      replace:'if (i >= 0){ shared.push(x); } else onlyA.push(x);',
      why:'a shared atom would also stay in the right-only pile, so the LCM picture would count it twice' },
    { file:'index', via:'index', expect:'plEn is wrong',
      find:"    if (n === 1) return n + ' ' + w;\n    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');",
      replace:"    if (n === 0) return n + ' ' + w;\n    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');",
      why:'"1 bags" would be printed' },

    /* --- 圖：從畫出來的東西量回來 --- */
    { file:'index', via:'index', expect:'tooMany flag is false',
      find:'var tooMany = sp.onlyA.length > MAX_SIDE || sp.onlyB.length > MAX_SIDE || sp.shared.length > MAX_SHARED;',
      replace:'var tooMany = false;',
      why:'pairs with too many atoms would be drawn with bubbles spilling out of the circles' },
    { file:'index', via:'index', expect:'overlap or touch',
      find:'var step = 2 * BUB_R + BUB_GAP, ys = [];',
      replace:'var step = 2 * BUB_R, ys = [];',
      why:'bubbles in a column would touch each other' },
    { file:'index', via:'index', expect:'is tagged region',
      find:"[['a', sp.onlyA, COL_A_X], ['s', sp.shared, COL_S_X], ['b', sp.onlyB, COL_B_X]].forEach(function(grp){",
      replace:"[['a', sp.onlyA, COL_A_X], ['s', sp.shared, COL_A_X], ['b', sp.onlyB, COL_B_X]].forEach(function(grp){",
      why:'the shared atoms would be drawn in the left-only crescent while the legend calls them shared' },
    { file:'index', via:'index', expect:'S1_CASES is',
      find:'var S1_CASES = [[12, 18], [8, 20], [8, 15], [30, 45]];',
      replace:'var S1_CASES = [[12, 18], [8, 20], [9, 20], [30, 45]];',
      why:'the coprime example (empty middle) would silently disappear from the picture' },
    { file:'index', via:'index', expect:'S2_CASES is',
      find:'var S2_CASES = [[24, 36], [18, 30], [16, 40], [45, 75]];',
      replace:'var S2_CASES = [[24, 36], [18, 30], [14, 35], [45, 75]];',
      why:'a one-row ladder would replace the three-row one that shows the method' },
    { file:'index', via:'index', expect:'SCENARIOS is',
      find:"{ id:'bus',    kind:'lcm', a:12, b:18 },",
      replace:"{ id:'bus',    kind:'lcm', a:12, b:16 },",
      why:'the bus example would change numbers while the narration in the parents page still quotes 36 minutes' },

    /* --- 小遊戲 --- */
    { file:'index', via:'index', expect:'roundAnswerIndex()=1 but ans=0',
      find:"{ kind:'gcfLadder', a:36, b:60, opts:[6, 12, 180, 15], ans:1 },",
      replace:"{ kind:'gcfLadder', a:36, b:60, opts:[6, 12, 180, 15], ans:0 },",
      why:'the declared answer slot would disagree with the computed GCF' },
    { file:'index', via:'index', expect:'STATEMENT_TRUTH.oddEvenCoprime is true',
      find:'var STATEMENT_TRUTH = { coprimeBothPrime:false, consecutiveCoprime:true, oddEvenCoprime:false, compositeNever:false };',
      replace:'var STATEMENT_TRUTH = { coprimeBothPrime:false, consecutiveCoprime:true, oddEvenCoprime:true, compositeNever:false };',
      why:'the game would accept "an odd and an even number are always coprime"' },
    { file:'index', via:'index', expect:'roundAnswerIndex()=-1',
      find:"{ kind:'whichCoprime', pairs:[[9, 15], [14, 21], [10, 21], [8, 12]], opts:['9-15', '14-21', '10-21', '8-12'], ans:2 },",
      replace:"{ kind:'whichCoprime', pairs:[[9, 15], [14, 25], [10, 21], [8, 12]], opts:['9-15', '14-25', '10-21', '8-12'], ans:2 },",
      why:'two of the four pairs would be coprime while the slip promises exactly one' },
    { file:'index', via:'index', expect:'gHint1 for gcfLadder prints the answer 12',
      find:"gcfLadder:'最大公因數只看左邊那一排，全部相乘。',",
      replace:"gcfLadder:'最大公因數只看左邊那一排，全部相乘，答案是 12。',",
      why:'the first-level hint would give the answer away' },

    /* --- 題庫神諭 --- */
    { file:'index', via:'index', expect:'qs[0] zh marked option "6"',
      find:"opts:['6', '12', '72', '2'], ans:1,\n          why:'左邊那一排相乘：2 × 2 × 3 ＝ 12",
      replace:"opts:['6', '12', '72', '2'], ans:0,\n          why:'左邊那一排相乘：2 × 2 × 3 ＝ 12",
      why:'the answer key would point at a wrong option' },
    { file:'index', via:'index', expect:'qs[4] zh stem is not the pinned sentence',
      find:"stem:'<strong>7</strong> 和 <strong>9</strong> 互質。它們的最小公倍數是多少？',",
      replace:"stem:'<strong>5</strong> 和 <strong>9</strong> 互質。它們的最小公倍數是多少？',",
      why:'the question would ask about a different pair while keeping the old answer' },
    { file:'index', via:'index', expect:'arithmetic is wrong',
      find:"why:'互質的兩個數沒有共同的原子，最小公倍數就是兩數相乘：7 × 9 ＝ 63。",
      replace:"why:'互質的兩個數沒有共同的原子，最小公倍數就是兩數相乘：7 × 9 ＝ 64。",
      why:'an explanation would teach a wrong product' },

    /* --- 渲染出來的字串 --- */
    { file:'index', via:'index', expect:'glues Chinese to a digit',
      find:"return '第 ' + step + ' 步：' + row.a + ' ÷ ' + row.p + ' ＝ ' + row.qa + '，' + row.b + ' ÷ ' + row.p + ' ＝ ' + row.qb + '。';",
      replace:"return '第' + step + ' 步：' + row.a + ' ÷ ' + row.p + ' ＝ ' + row.qa + '，' + row.b + ' ÷ ' + row.p + ' ＝ ' + row.qb + '。';",
      why:'Chinese and a digit would run together on screen' },
    { file:'index', via:'index', expect:'the rendered dictionary strings changed',
      find:"s1lgS:function(pl){ return '兩邊都有的原子（中間）'; },",
      replace:"s1lgS:function(pl){ return '兩邊都有的原子（中間那一區）'; },",
      why:'a legend label could be reworded without anyone re-reading it (count unchanged, fingerprint changed)' },
    { file:'index', via:'index', expect:'the quiz explanations changed',
      find:"why:'左邊那一排相乘：2 × 2 × 3 ＝ 12，就是最大公因數。6 少乘了一個 2；",
      replace:"why:'左邊那一排相乘：2 × 2 × 3 ＝ 12，就是最大公因數。6 少乘了一個 3；",
      why:'an explanation could be reworded (here into a false remark) without anyone re-reading it' },
    { file:'index', via:'index', expect:'states the misconception',
      find:'<p class="lead" data-i18n="s4lead">兩個數<strong>沒有共同的質因數</strong>，',
      replace:'<p class="lead" data-i18n="s4lead">兩個奇數一定互質。兩個數<strong>沒有共同的質因數</strong>，',
      why:'a false rule would be stated as prose in the lesson' },
    { file:'reference', via:'index', expect:'outside the statement cell of a row marked wrong',
      find:"['兩個奇數一定互質', '<strong>錯</strong>', '9 和 15 的最大公因數是 3'],",
      replace:"['兩個奇數一定互質', '<strong>對</strong>', '9 和 15 的最大公因數是 3'],",
      why:'the cheat sheet would mark a misconception as true' },
    { file:'index', via:'index', expect:'draws into the same target more than once',
      find:'    drawVenn(s1fig, pl);',
      replace:'    drawVenn(s1fig, pl); drawVenn(s1fig, vennPlan(12, 18));',
      why:'the pinned call would survive while a second call painted a different plan over it' },
    { file:'index', via:'index', expect:'does not record teachme-last',
      find:"{p:'grade-6/math/gcf-lcm/', zh:",
      replace:"{p:'grade-6/math/gcf-lcms/', zh:",
      why:'the home page would resume into a dead link' },

    /* --- 跨頁釘樁 --- */
    { file:'index', via:'index', expect:'says "最大公因數是 1" 10 time(s)',
      find:'<h2 data-i18n="s4h2">互質：最大公因數是 1 的兩個數</h2>',
      replace:'<h2 data-i18n="s4h2">互質：最大公因數只有 1 的兩個數</h2>',
      why:'the definition of coprime would drift in one heading' },
    { file:'index', via:'index', expect:'writes a power',
      find:'互質的兩數相乘就是最小公倍數；答案要同時整除兩個數、問最大的就找最大公因數；答案要同時是兩個數的倍數、問最小的就找最小公倍數。\n  </footer>',
      replace:'互質的兩數相乘就是最小公倍數（8 × 15 ＝ 120 ＝ 2³ × 3 × 5）；答案要同時整除兩個數、問最大的就找最大公因數；答案要同時是兩個數的倍數、問最小的就找最小公倍數。\n  </footer>',
      why:'a power would sneak into the footer' },
    { file:'parents', via:'index', expect:'mentions "三個數" without saying where it belongs',
      find:'兩個數都在 100 以內；三個數的最大公因數與最小公倍數不在這一課。</p>',
      replace:'兩個數都在 100 以內；三個數的最大公因數與最小公倍數留給以後。</p>',
      why:'three-number problems would be mentioned without handing them off' },
    { file:'reference', via:'index', expect:'reference.html says "左邊那一排相乘" 6 time(s)',
      find:'<li><span class="sn">3</span><span data-i18n="d3"><strong>左邊那一排相乘</strong> ＝ 最大公因數；',
      replace:'<li><span class="sn">3</span><span data-i18n="d3"><strong>左邊那排相乘</strong> ＝ 最大公因數；',
      why:'the cheat sheet would stop using the lesson\'s wording for the GCF rule' },
    { file:'index', via:'index', expect:'no longer wires the drawing',
      find:'    drawVenn(s1fig, pl);',
      replace:'    drawVenn(s1fig, vennPlan(12, 18));',
      why:'the figure would ignore the chips while the text followed them' },
    { file:'index', via:'index', expect:'no longer wires the drawing',
      find:'    drawVenn(s1fig, pl);',
      replace:'    /* drawVenn(s1fig, pl); */',
      why:'the pinned line would survive inside a comment while the figure went blank' },

    /* --- review.html：設定檔從 index 那一側看的 --- */
    { file:'review', via:'index', expect:'no longer declares the generator "wordProblem"',
      find:"{ id:'wordProblem', cat:'apply',",
      replace:"{ id:'wordProblem2', cat:'apply',",
      why:'a generator could be renamed or dropped and its invariants would silently stop running' },
    { file:'review', via:'index', expect:'no longer contains the sampling line',
      find:'if (c < 1 || c > lim || seen[String(c)]) return;',
      replace:'if (c < 1 || seen[String(c)]) return;',
      why:'distractors could leave the lesson\'s range again' },
    { file:'review', via:'index', expect:'does not mark "lcmIsProduct" as false',
      find:'lcmIsProduct:      { truth:false,',
      replace:'lcmIsProduct:      { truth:true,',
      why:'"the LCM always equals the product" would become an accepted answer' },
    { file:'review', via:'index', expect:'scenario bus (zh) stem differs from the rebuilt sentence',
      find:'剛才<strong>同時</strong>發車。<strong>最快</strong>再過幾分鐘會再一次同時發車？',
      replace:'剛才<strong>同時</strong>發車。<strong>最慢</strong>再過幾分鐘會再一次同時發車？',
      why:'the bus question could quietly ask something the LCM does not answer' },

    /* --- review.html：simgen 那一側 --- */
    { file:'review', via:'review', expect:'ruled out at a glance',
      find:'var sneaky = shuffle(POOL_SNEAKY).slice(0, 3);',
      replace:'var sneaky = shuffle(POOL_NONCOP).slice(0, 3);',
      why:'two-even distractors would give the coprime pair away from the last digit' },
    { file:'review', via:'review', expect:'the "just multiply" distractor',
      find:'var o = numOpts(L.lcm, [a * b, L.bottom[0] * L.bottom[1], L.gcf, L.lcm * 2], [a, b], LCM_LIMIT);',
      replace:'var o = numOpts(L.lcm, [L.bottom[0] * L.bottom[1], L.gcf, L.lcm * 2], [a, b], LCM_LIMIT);',
      why:'the lesson\'s main misconception would vanish from the LCM questions' },
    { file:'review', via:'review', expect:'are primes dividing both',
      find:'[2, 3, 5, 7, 11, 13].forEach(function(q){ if (!(a % q === 0 && b % q === 0)) pool.push(q); });',
      replace:'[2, 3, 5, 7, 11, 13].forEach(function(q){ pool.push(q); });',
      why:'a second shared prime could appear as a distractor and a child who picks it would be marked wrong' },
    { file:'review', via:'review', expect:'options are not four distinct',
      find:"cands.forEach(function(v){ if (typeof v === 'number' && v > 1 && v <= LIMIT && v !== g && vals.indexOf(v) < 0 && v !== a && v !== b) vals.push(v); });",
      replace:"cands.forEach(function(v){ if (typeof v === 'number' && v > 1 && v <= LIMIT && vals.indexOf(v) < 0 && v !== a && v !== b) vals.push(v); });",
      why:'the true GCF could be offered twice as two identical-looking conclusions' },
    { file:'review', via:'review', expect:'does not carry the unit',
      find:"if (lang === 'en' && d.id === 'bags') return n === 1 ? '1 bag' : n + ' bags';",
      replace:"if (lang === 'en' && d.id === 'bags') return n + ' bag';",
      why:'"12 bag" would be printed' },
    { file:'review', via:'review', expect:'the rendered stem is not the rebuilt sentence',
      find:"'用短除法求 <strong>' + d.a + '</strong> 和 <strong>' + d.b + '</strong> 的<strong>最小公倍數</strong>。'",
      replace:"'用短除法求 <strong>' + d.a + '</strong> 和 <strong>' + d.b + '</strong> 的<strong>最小公倍數</strong>是多少？'",
      why:'a stem could be reworded (or ask a different thing) without the oracle noticing' },
    { file:'review', via:'review', expect:"exceeds this lesson's 600",
      find:'var LCM_LIMIT = 600;',
      replace:'var LCM_LIMIT = 6000;',
      why:'pairs with four-digit LCMs would enter the pools' },
    { file:'review', via:'review', expect:'copies the stem number',
      find:"var wrongs = (cop ? vals.slice(0, 3) : ['cop'].concat(vals.slice(0, 2)));",
      replace:"var wrongs = (cop ? [b].concat(vals.slice(0, 2)) : ['cop'].concat(vals.slice(0, 2)));",
      why:'a "GCF is b" conclusion would copy the number printed in the stem' },
    { file:'review', via:'review', expect:'states the misconception',
      find:"coprimeBothPrime:'8 和 15 都是合數卻互質。', oddEvenCoprime:'6 和 9 一奇一偶，最大公因數卻是 3。',",
      replace:"coprimeBothPrime:'8 和 15 都是合數卻互質。', oddEvenCoprime:'一個奇數和一個偶數一定互質，6 和 9 除外。',",
      why:'a generated explanation could restate the misconception it is meant to refute' },
    { file:'review', via:'review', expect:'is not one of the pinned statement texts',
      find:"twoOddCoprime:     { truth:false, zh:'兩個奇數一定互質', en:'Two odd numbers are always coprime' },",
      replace:"twoOddCoprime:     { truth:false, zh:'兩個奇數不一定互質', en:'Two odd numbers are always coprime' },",
      why:'a "false" sentence could be reworded into a true one and the child would see two correct options' }
  ],

  SIBLING_RULES, FORBIDDEN, HANDOFF, GEN_IDS, RENDER_PINS, REVIEW_PINS, BANK, BANK_FACTS,
  gcdRef, lcmRef, factorizeRef, splitRef, vennProblems, ladderProblems, arithAll, CLAIM_PROBES, stemRef, scenStemRef
};
