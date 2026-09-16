/* grade-6/math/prime —— 質數原子實驗室（質數／合數／1 三種數、100 以內試除法、因數樹與短除法做質因數分解）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作，都不呼叫課程頁的函式：
 *
 * 1) 「質數」本身。課程頁用試除（p × p ≤ n）；這裡用**埃拉托斯特尼篩**（sievePrimesRef）
 *    把 1~200 的質數整張篩出來，再逐一比對 isPrime／kindOf。
 * 2) 「質因數分解」。課程頁每次除以**最小**的質因數（短除法的順序）；這裡每次除以**最大**的
 *    質因數再排序（factorizeRef），兩條路必須得到同一個多重集合。
 *    因數的個數用「配對數到平方根」（factorCountRef）算，不是 1~n 逐一試。
 * 3) 課程明講的兩句話這裡是**列舉證明**，不是文案：
 *    - 「100 以內判斷質數只要試 2、3、5、7」→ 每一個 ≤ 100 的合數，trialRows 抓到它的那個
 *      質數必須就是它最小的質因數，而且落在 {2,3,5,7} 裡（step 3）。
 *    - 「不管第一刀怎麼拆，原子都一樣」→ 每一個畫得出來的合數 × 每一種第一刀（138 組），
 *      因數樹的葉子排序後都要等於 factorizeRef（step 5）。
 * 4) ⚠️ **從畫出來的圖量回來**：點陣圖（arrayPlan）把 SVG 字串餵給 lib/canvas.js 驗四個邊，
 *    再數點、數紅點、量相鄰的間距；因數樹（treePlan）驗每一個內部節點 ＝ 兩個孩子的乘積、
 *    葉子全是質數、同一層的圓至少隔 2R ＋ 8、每一顆圓（含描邊）都在畫布內、每一條邊真的
 *    接在兩顆圓的圓心；篩子板（sieveState）逐格對照自己算的狀態。
 *
 * ⚠️ 小遊戲**沒有**接 lib/gameshuffle.js：五關的選項順序寫死在 ROUNDS 裡（設定檔驗的和孩子
 *    看到的是同一份），正解由 roundAnswerIndex() 算出來；「畫出來的正解不可以固定在同一顆」
 *    由 step 8 直接對 ROUNDS 的 ans 分布驗（至少落在 3 個不同的位置）。
 * ⚠️ 選項是**算式字串**的那一支（primeFactorization）問的是「哪一個是質因數分解」——
 *    「還沒拆完」的誘答（4 × 9）**值**和正解一樣，那正是它錯的地方（framework §六之二 的
 *    合法例外：題幹問的是寫法）。所以那一支的去重比**字串**，並另外要求每一個誘答要嘛含合數、
 *    要嘛乘起來不是 n；全是質數而且乘起來剛好是 n 的誘答不可能存在（唯一性），也照樣擋。
 * ⚠️ 樹的深度上限：葉子最多 5 片（64、96 有 6 個質因數，treeOK 把它們排除），畫布 330 高。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canvasProblems } = require('./lib/canvas.js');
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['個', '排', '片', '輪'],
  unitsEn: ['primes?', 'factors?', 'rows?', 'dots?', 'atoms?', 'numbers?']
});

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const LIMIT_REF = 100;
const TRIAL_REF = [2, 3, 5, 7];
const FIG_W_REF = 460;
const DOT_FIG_H_REF = 160, DOT_R_REF = 7, DOT_GAP_REF = 22, ROW_GAP_REF = 24, DOT_Y0_REF = 22;
const TREE_H_REF = 330, NODE_R_REF = 20, TREE_Y0_REF = 30, TREE_DY_REF = 64, NODE_FS_REF = 17;
const NODE_STROKE_REF = 2.5;
const S1_NUMS_REF = [1, 2, 7, 9, 12, 13, 15], S1_ROWS_REF = [1, 2, 3, 4, 5];
const S2_CASES_REF = [51, 53, 77, 91, 97];
const S3_CASES_REF = [12, 30, 36, 60];
const S4_CASES_REF = [24, 45, 84, 100];
const SIEVE_N_REF = 50, SIEVE_PRIMES_REF = [2, 3, 5, 7];
const TREE_COMBOS_REF = 138;          /* treeOK 的合數 × 每一種第一刀，2026-09-16 數出來 */
const MAX_LEAVES_REF = 5;
const GAME_ROUNDS_REF = 5;

/* ---------- 1) 質數：篩法（和課程頁的試除是不同的演算法） ---------- */
function sievePrimesRef(N){
  const flags = new Array(N + 1).fill(true);
  flags[0] = false; if (N >= 1) flags[1] = false;
  for (let p = 2; p * p <= N; p++){
    if (!flags[p]) continue;
    for (let m = p * p; m <= N; m += p) flags[m] = false;
  }
  const out = [];
  for (let i = 2; i <= N; i++) if (flags[i]) out.push(i);
  return out;
}
const PRIMES_200 = sievePrimesRef(200);
const PRIME_SET = new Set(PRIMES_200);
function isPrimeRef(n){ return Number.isInteger(n) && n >= 2 && n <= 200 && PRIME_SET.has(n); }
function kindRef(n){ return n === 1 ? 'one' : (isPrimeRef(n) ? 'prime' : 'composite'); }
/* 因數個數：配對數到平方根。 */
function factorsRef(n){
  const lo = [], hi = [];
  for (let i = 1; i * i <= n; i++){
    if (n % i !== 0) continue;
    lo.push(i);
    if (i * i !== n) hi.unshift(n / i);
  }
  return lo.concat(hi);
}
function factorCountRef(n){ return factorsRef(n).length; }
/* 質因數分解：每次除以**最大**的質因數，再排序。 */
function factorizeRef(n){
  if (!Number.isInteger(n) || n < 2) return [];
  const out = []; let v = n;
  while (v > 1){
    let big = null;
    for (let i = PRIMES_200.length - 1; i >= 0; i--) if (v % PRIMES_200[i] === 0){ big = PRIMES_200[i]; break; }
    if (big === null) return null;
    out.push(big); v /= big;
  }
  return out.sort((a, b) => a - b);
}
function spfRef(n){ for (const p of PRIMES_200) if (n % p === 0) return p; return null; }
function gcdRef(a, b){
  /* 列舉公因數再取最大 —— 和課程頁的輾轉相除不同 */
  const fa = factorsRef(a), fb = new Set(factorsRef(b));
  let g = 1; fa.forEach(f => { if (fb.has(f) && f > g) g = f; });
  return g;
}
function digitSumRef(n){ let s = 0; String(n).split('').forEach(c => { s += Number(c); }); return s; }
function productRef(list){ let p = 1; list.forEach(x => { p *= x; }); return p; }
function sameList(a, b){ return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]); }

/* ---------- 2) 選項的解析 ---------- */
/* 整數、「k 個」、算式 a × b × c、或整句話。 */
function parseIntOpt(s){
  const m = /^(\d+)(?: 個)?$/.exec(String(s).trim());
  return m ? Number(m[1]) : null;
}
function parseProduct(s){
  const t = String(s).trim();
  if (!/^\d+( × \d+)+$/.test(t)) return null;
  return t.split(' × ').map(Number);
}
/* 去重鍵：整數比值（連「k 個」一起），算式比字串，整句話比字串。 */
function optKeyRef(s){
  const v = parseIntOpt(s);
  if (v !== null) return 'n:' + v;
  return 'raw:' + String(s).replace(/\s+/g, '');
}

/* ---------- 3) 「哪一句話是對的」：獨立的真值表 ＋ 兩種語言的原文 ---------- */
const TRUE_STATEMENTS_REF = {
  twoEvenPrime:   { zh:'2 是唯一的偶數質數', en:'2 is the only even prime number' },
  oneNeither:     { zh:'1 既不是質數也不是合數', en:'1 is neither prime nor composite' },
  primeTwoFactors:{ zh:'質數剛好有 2 個因數', en:'A prime number has exactly 2 factors' },
  compThreePlus:  { zh:'合數至少有 3 個因數', en:'A composite number has at least 3 factors' },
  everyBig:       { zh:'比 1 大的整數，不是質數就是合數', en:'Every whole number bigger than 1 is either prime or composite' }
};
const FALSE_STATEMENTS_REF = {
  allOddPrime:    { zh:'所有的質數都是奇數', en:'Every prime number is odd' },
  oneIsPrime:     { zh:'1 是最小的質數', en:'1 is the smallest prime number' },
  allOddArePrime: { zh:'所有的奇數都是質數', en:'Every odd number is prime' },
  primeTimesPrime:{ zh:'兩個質數相乘還是質數', en:'Two primes multiplied together give a prime' },
  nineIsPrime:    { zh:'9 是質數', en:'9 is a prime number' },
  compFactorsComp:{ zh:'合數的因數都是合數', en:'Every factor of a composite number is composite' }
};
const FALSE_KEYS_REF = Object.keys(FALSE_STATEMENTS_REF);
/* 渲染出來的每一句都必須是這兩張表裡的原文之一 —— 一句改了字（變成真的、或變成別的話）就會響。 */
function statementTruthOfText(text, lang){
  for (const k of Object.keys(TRUE_STATEMENTS_REF)) if (TRUE_STATEMENTS_REF[k][lang] === text) return true;
  for (const k of FALSE_KEYS_REF) if (FALSE_STATEMENTS_REF[k][lang] === text) return false;
  return null;
}
/* 小遊戲第 5 關用到的四句（頁面另有一張 STATEMENT_TRUTH，要和這一張逐鍵相等）。 */
const GAME_TRUTH_REF = { allOddPrime:false, oneIsPrime:false, primeTimesPrime:false, twoEvenPrime:true };
const KIND_TEXT_REF = {
  zh:{ prime:'質數', composite:'合數', neither:'既不是質數也不是合數', both:'既是質數也是合數' },
  en:{ prime:'prime', composite:'composite', neither:'neither prime nor composite', both:'both prime and composite' }
};
const GCF_PAIRS_REF = [[12, 18], [8, 12], [24, 36], [16, 24], [18, 27], [20, 30], [12, 20], [18, 30], [12, 30], [28, 42], [30, 45], [8, 20]];

/* ---------- 4) 跨頁用詞釘樁 ----------
   同一條規則在四頁必須用同一句話講。⚠️ min 一律寫成**當下真實的出現次數**（拿掉註解之後、
   讀者看得到的文字），不是「至少 2」。「必須出現」只有下界，所以另有 FORBIDDEN。 */
const SIBLING_RULES = [
  { file:'index',     text:'既不是質數也不是合數', min:7, why:'is how this lesson names the number 1 everywhere' },
  { file:'reference', text:'既不是質數也不是合數', min:2, why:'is how this lesson names the number 1 everywhere' },
  { file:'review',    text:'既不是質數也不是合數', min:3, why:'is how this lesson names the number 1 everywhere' },
  { file:'index',     text:'試 2、3、5、7', min:7, why:'is the trial-division rule this lesson teaches for numbers up to 100' },
  { file:'reference', text:'試 2、3、5、7', min:7, why:'is the trial-division rule this lesson teaches for numbers up to 100' },
  { file:'parents',   text:'試 2、3、5、7', min:4, why:'is the trial-division rule this lesson teaches for numbers up to 100' },
  { file:'index',     text:'從小到大', min:6, why:'is the only spelling this lesson allows for a prime factorisation' },
  { file:'reference', text:'從小到大', min:4, why:'is the only spelling this lesson allows for a prime factorisation' },
  { file:'parents',   text:'從小到大', min:4, why:'is the only spelling this lesson allows for a prime factorisation' },
  { file:'index',     text:'neither prime nor composite', min:7, why:'is how this lesson names the number 1 in English' },
  { file:'reference', text:'neither prime nor composite', min:2, why:'is how this lesson names the number 1 in English' },
  { file:'review',    text:'neither prime nor composite', min:3, why:'is how this lesson names the number 1 in English' },
  { file:'index',     text:'2, 3, 5 and 7', min:10, why:'is the English trial-division rule' },
  { file:'reference', text:'2, 3, 5 and 7', min:4, why:'is the English trial-division rule' },
  { file:'index',     text:'from smallest to largest', min:3, why:'is the English spelling rule for a prime factorisation' },
  { file:'reference', text:'from smallest to largest', min:2, why:'is the English spelling rule for a prime factorisation' },
  { file:'parents',   text:'from smallest to largest', min:2, why:'is the English spelling rule for a prime factorisation' }
];
/* 一個字都不可以出現：次方寫法、「1 是質數」當成事實、把試除說成要試到一半。 */
const FORBIDDEN = [
  { file:'index',     text:'²', why:'writes a power — this lesson writes 2 × 2, never 2²' },
  { file:'reference', text:'²', why:'writes a power — this lesson writes 2 × 2, never 2²' },
  { file:'review',    text:'²', why:'writes a power — this lesson writes 2 × 2, never 2²' },
  { file:'parents',   text:'²', why:'writes a power — this lesson writes 2 × 2, never 2²' },
  { file:'index',     text:'³', why:'writes a power' },
  { file:'reference', text:'³', why:'writes a power' },
  { file:'index',     text:'所有質數都是奇數。', why:'states the misconception as a fact (it must only ever appear inside a quoted claim)' },
  { file:'index',     text:'1 是質數。', why:'states that 1 is prime' },
  { file:'reference', text:'1 是質數。', why:'states that 1 is prime' },
  { file:'index',     text:'試到一半', why:'teaches the wrong stopping rule' },
  { file:'reference', text:'試到一半', why:'teaches the wrong stopping rule' }
];
/* 交給別課的詞，出現時同一個子句裡要說出它屬於哪一課。 */
/* ⚠️ review.html 刻意不列在前兩條：交錯題 interGCF 本來就是五年級「好朋友車站」的題型
   （intro 與結尾的連結都把它交還給那一課），而 'GCF' 會咬到產生器的 id。 */
const HANDOFF = [
  { word:'最大公因數', near:['五年級', '下一課'], files:['index', 'reference', 'parents'] },
  { word:'最小公倍數', near:['五年級', '下一課'], files:['index', 'reference', 'parents'] },
  { word:'互質', near:['下一課'], files:['index', 'reference', 'review', 'parents'] },
  { word:'GCF', near:['grade-5', 'next'], files:['index', 'reference', 'parents'] },
  { word:'coprime', near:['next'], files:['index', 'reference', 'review', 'parents'] },
  { word:'找好找滿', near:['五年級'], files:['index', 'reference', 'parents'] }
];

/* ---------- 5) 題庫神諭：整句題幹（zh／en）＋ 正解的原文 ----------
   位置式神諭擋不住「把題幹的 24 改成 25」，所以題幹逐字釘住；正解另外用獨立寫的原文比。 */
const BANK = {
  qs:[
    { zh:'下面哪一個數是<strong>質數</strong>？', en:'Which of these numbers is <strong>prime</strong>?', optsZh:['21', '27', '29', '33'], optsEn:['21', '27', '29', '33'], ansZh:'29', ansEn:'29' },
    { zh:'<strong>17</strong> 的因數有哪些？它是哪一種數？', en:'What are the factors of <strong>17</strong>, and which kind of number is it?', optsZh:['因數是 1、17，剛好 2 個 —— 質數', '因數是 1、7、17 —— 合數', '因數只有 17 —— 質數', '因數是 1、17 —— 合數'], optsEn:['1 and 17, exactly two — prime', '1, 7 and 17 — composite', 'only 17 — prime', '1 and 17 — composite'], ansZh:'因數是 1、17，剛好 2 個 —— 質數', ansEn:'1 and 17, exactly two — prime' },
    { zh:'<strong>1</strong> 是質數嗎？', en:'Is <strong>1</strong> a prime number?', optsZh:['是，因為它只能寫成 1 × 1', '不是 —— 它只有 1 個因數，既不是質數也不是合數', '不是，它是合數', '是，因為所有奇數都是質數'], optsEn:['Yes, because it can only be written 1 × 1', 'No — it has only one factor, so it is neither prime nor composite', 'No, it is composite', 'Yes, because every odd number is prime'], ansZh:'不是 —— 它只有 1 個因數，既不是質數也不是合數', ansEn:'No — it has only one factor, so it is neither prime nor composite' },
    { zh:'要判斷 <strong>91</strong> 是不是質數，小明試了 2、3、5 都不整除。接下來該怎麼做？', en:'To test whether <strong>91</strong> is prime, Ben tried 2, 3 and 5 and none divided it. What should he do next?', optsZh:['可以停了，91 是質數', '再試 4', '再試 9', '再試 7：91 ÷ 7 ＝ 13，整除，所以 91 是合數'], optsEn:['Stop — 91 is prime', 'Try 4', 'Try 9', 'Try 7: 91 ÷ 7 = 13 exactly, so 91 is composite'], ansZh:'再試 7：91 ÷ 7 ＝ 13，整除，所以 91 是合數', ansEn:'Try 7: 91 ÷ 7 = 13 exactly, so 91 is composite' },
    { zh:'<strong>24</strong> 的質因數分解是哪一個？', en:'Which is the prime factorisation of <strong>24</strong>?', optsZh:['2 × 12', '2 × 2 × 2 × 3', '4 × 6', '2 × 3 × 4'], optsEn:['2 × 12', '2 × 2 × 2 × 3', '4 × 6', '2 × 3 × 4'], ansZh:'2 × 2 × 2 × 3', ansEn:'2 × 2 × 2 × 3' },
    { zh:'<strong>2 × 3 × 5</strong> 是哪一個數的質因數分解？', en:'<strong>2 × 3 × 5</strong> is the prime factorisation of which number?', optsZh:['10', '15', '60', '30'], optsEn:['10', '15', '60', '30'], ansZh:'30', ansEn:'30' }
  ],
  qsAdv:[
    { zh:'用短除法分解 <strong>84</strong>：先除以 2 得 42，再除以 2 得 21，再除以 3 得 7。84 的質因數分解是？', en:'Short division on <strong>84</strong>: divide by 2 to get 42, by 2 to get 21, by 3 to get 7. What is the prime factorisation of 84?', optsZh:['2 × 2 × 3 × 7', '2 × 2 × 21', '2 × 42', '2 × 3 × 7'], optsEn:['2 × 2 × 3 × 7', '2 × 2 × 21', '2 × 42', '2 × 3 × 7'], ansZh:'2 × 2 × 3 × 7', ansEn:'2 × 2 × 3 × 7' },
    { zh:'一個數的質因數分解是 <strong>2 × 2 × 5 × 5</strong>。這個數是多少？', en:'A number has the prime factorisation <strong>2 × 2 × 5 × 5</strong>. What is the number?', optsZh:['20', '14', '100', '50'], optsEn:['20', '14', '100', '50'], ansZh:'100', ansEn:'100' },
    { zh:'<strong>20 到 30 之間</strong>（不含 20 和 30）有幾個質數？', en:'How many primes are there <strong>between 20 and 30</strong> (not counting 20 and 30)?', optsZh:['2 個', '3 個', '4 個', '5 個'], optsEn:['2', '3', '4', '5'], ansZh:'2 個', ansEn:'2' },
    { zh:'小華用因數樹拆 <strong>60</strong>，第一刀拆成 6 × 10；同學第一刀拆成 4 × 15。拆到底之後，誰拿到的質數比較多？', en:'Amy splits <strong>60</strong> with a factor tree, first split 6 × 10; her classmate starts with 4 × 15. When both trees are finished, who has more primes?', optsZh:['小華比較多', '一樣多：兩個人都拿到 2、2、3、5', '同學比較多', '要看誰先拆完'], optsEn:['Amy has more', 'The same: both end with 2, 2, 3, 5', 'The classmate has more', 'It depends who finishes first'], ansZh:'一樣多：兩個人都拿到 2、2、3、5', ansEn:'The same: both end with 2, 2, 3, 5' }
  ],
  qsBoost:[
    { zh:'小明說：「<strong>所有的質數都是奇數</strong>。」他哪裡想錯了？', en:'Ben says: “<strong>Every prime number is odd</strong>.” What has he got wrong?', optsZh:['2 是質數，可是它是偶數 —— 2 是唯一的偶數質數', '他沒有錯，質數一定是奇數', '9 是奇數也是質數，所以他說得還不夠', '1 是奇數，所以 1 是質數'], optsEn:['2 is prime, and it is even — 2 is the only even prime', 'Nothing; primes are always odd', '9 is odd and prime, so he has not said enough', '1 is odd, so 1 is prime'], ansZh:'2 是質數，可是它是偶數 —— 2 是唯一的偶數質數', ansEn:'2 is prime, and it is even — 2 is the only even prime' },
    { zh:'小美把 <strong>36</strong> 拆成 <strong>4 × 9</strong> 就停了，說這是 36 的質因數分解。她哪裡想錯了？', en:'Chloe splits <strong>36</strong> into <strong>4 × 9</strong>, stops, and says that is the prime factorisation of 36. What has she got wrong?', optsZh:['她沒有錯，4 × 9 ＝ 36', '應該拆成 6 × 6 才對', '36 是質數，不能拆', '4 和 9 都不是質數，還要繼續拆：4 ＝ 2 × 2、9 ＝ 3 × 3，所以是 2 × 2 × 3 × 3'], optsEn:['Nothing; 4 × 9 = 36', 'She should have split it into 6 × 6', '36 is prime and cannot be split', '4 and 9 are not prime, so keep splitting: 4 = 2 × 2 and 9 = 3 × 3, giving 2 × 2 × 3 × 3'], ansZh:'4 和 9 都不是質數，還要繼續拆：4 ＝ 2 × 2、9 ＝ 3 × 3，所以是 2 × 2 × 3 × 3', ansEn:'4 and 9 are not prime, so keep splitting: 4 = 2 × 2 and 9 = 3 × 3, giving 2 × 2 × 3 × 3' }
  ]
};
/* 靜態題裡凡是算式，都要真的算對：這幾題的題幹／正解／解釋含有這些「數字事實」，各自獨立算一次。 */
const BANK_FACTS = [
  { n:29, prime:true }, { n:21, prime:false }, { n:27, prime:false }, { n:33, prime:false },
  { n:17, prime:true }, { n:91, prime:false, spf:7 }, { n:24, atoms:[2, 2, 2, 3] }, { n:30, atoms:[2, 3, 5] },
  { n:84, atoms:[2, 2, 3, 7] }, { n:100, atoms:[2, 2, 5, 5] }, { n:60, atoms:[2, 2, 3, 5] }, { n:36, atoms:[2, 2, 3, 3] },
  { between:[20, 30], count:2 }
];

const GEN_IDS = ['whichPrime', 'whichComposite', 'classifyKind', 'primeFactorization', 'productOfPrimes',
                 'smallestPrimeFactor', 'missingAtom', 'countPrimesBetween', 'divisibleByWhich', 'trueStatement',
                 'interFactorCount', 'interGCF'];

/* plan → DOM 的接線。⚠️ 這是字面掃描，不是資料流分析：它只證明「畫圖那一行還在讀 plan」，
   證明不了 plan 之外沒有別的座標被畫上去。 */
const RENDER_PINS = [
  { file:'index', text:'drawDots(s1fig, pl);', min:1 },
  { file:'index', text:'drawTree(s3fig, t);', min:1 },
  { file:'index', text:'drawTree(gFig, fig);', min:1 },
  { file:'index', text:'svg.appendChild(svgEl(\'circle\', { cx:p.x, cy:p.y, r:p.r, fill:p.left ? C_LEFT : C_DOT }));', min:1 },
  { file:'index', text:'svg.appendChild(svgEl(\'circle\', { cx:nd.x, cy:nd.y, r:NODE_R, fill:fill, stroke:stroke, \'stroke-width\':2.5 }));', min:1 },
  { file:'index', text:'x1:e[0].x, y1:e[0].y, x2:e[1].x, y2:e[1].y', min:1 },
  { file:'index', text:'st = sieveState(s5stage);', min:1 },
  { file:'index', text:'var ansAt = roundAnswerIndex(round);', min:1 },
  { file:'index', text:'var fig = roundFig(round);', min:1 }
];
/* review.html 的抽樣池要逐字釘住：產生器自己的拒絕取樣會把改壞測試吸收掉。 */
const REVIEW_PINS = [
  'var SNEAKY = COMPOSITES.filter(function(n){ return n % 2 === 1 && n % 5 !== 0; });',
  'var PRIMES = rangeList(2, LIMIT).filter(isPrime);',
  'return !isPrime(n) && TRIAL_PRIMES.filter(function(p){ return n % p === 0; }).length === 1;',
  'var GCF_PAIRS = [[12, 18], [8, 12], [24, 36], [16, 24], [18, 27], [20, 30], [12, 20], [18, 30], [12, 30], [28, 42], [30, 45], [8, 20]];',
  '(avoid || []).forEach(function(a){ seen[String(a)] = 1; });',
  'if (c < 1 || c > lim || seen[String(c)]) return;'
];

/* ---------- 5b) 拿掉 JS 的兩種註解（換成換行）；`://` 不算行註解，不然網址會被吃掉 ----------
   ⚠️ 這是字面剝除，不認字串／正規式裡的 `//` 或 `/*`（`'x//y'` 會被截掉）。它只用在 RENDER_PINS 的
   接線掃描上（那幾行都是純程式碼，不含這種字串）；不要拿去處理一般文字。 */
function stripJsComments(code){
  return String(code).replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1\n');
}

/* ---------- 6) 讀者看得到的文字：拿掉註解（換成換行，不是空字串）、拿掉 <style> ---------- */
function readerText(html){
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/\sclass="[^"]*"/g, '');
}
function stringProblems(s, lang, where){
  const out = [];
  const t = String(s);
  if (/undefined|NaN|\[object/.test(t)) out.push(where + ' leaks an internal value');
  const shown = t.replace(/<[^>]+>/g, '');
  if (lang === 'zh' && /[一-鿿]\d|\d[一-鿿]/.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:[一-鿿]\d|\d[一-鿿]).{0,6}/) || [''])[0]);
  if (lang === 'en' && /\b1 (primes|factors|rows|dots|atoms|numbers|leaves|pieces)\b/.test(shown)) out.push(where + ' has a singular/plural slip: ' + shown.match(/\b1 [a-z]+s\b/)[0]);
  if (lang === 'en' && /[一-鿿]/.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  return out;
}

/* ---------- 6b) 算式逐條驗算 ----------
   lib/arith.js 不認得餘數式（`13 ÷ 2 ＝ 6 餘 1` 會被讀成 13 / 2 = 6 而誤報），也會把
   「數字緊接著括號裡的算式」（`15 的因數（15 ＝ 3 × 5）`）讀成一條斷掉的鏈。所以這裡先把
   兩種形狀各自抓出來自己驗（餘數式驗 A ＝ B × Q ＋ R 且 R < B；括號裡的算式交給 lib/arith.js
   單獨驗），從文字裡拿掉之後，剩下的才交給 lib/arith.js。⚠️ 拿掉要換成空白，不可以換成空字串。
   回傳 { problems, verified }：verified 是三路加起來的條數，一條都沒驗到的解釋要響。 */
const REM_RE = /(\d+)\s*[÷/]\s*(\d+)\s*[＝=]\s*(\d+)\s*(?:餘|remainder)\s*(\d+)/g;
/* 沒有商的餘數式：`51 ÷ 2 餘 1`、`51 ÷ 2 leaves remainder 1`（divisibleByWhich 的解釋就是這個形狀）。 */
const REM_ONLY_RE = /(\d+)\s*[÷/]\s*(\d+)\s*(?:餘|leaves remainder)\s*(\d+)/g;
const PAREN_EQ_RE = /[（(]([^（）()]*[＝=][^（）()]*)[）)]/g;
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
  { text:'13 ÷ 2 ＝ 6 餘 1，所以 2 不是 13 的因數。', bad:false },
  { text:'15 的因數（15 ＝ 3 × 5）', bad:false },
  { text:'17 ÷ 7 = 2 remainder 3, so 7 is not a factor', bad:false },
  { text:'91 ÷ 7 ＝ 13 整除（91 ＝ 7 × 13）', bad:false },
  { text:'2 × 3 ＝ 6，6 × 5 ＝ 30，所以是 30。', bad:false },
  { text:'51 ÷ 2 餘 1、51 ÷ 5 餘 1、51 ÷ 7 餘 2，都不整除。', bad:false },
  { text:'51 ÷ 2 leaves remainder 1, 51 ÷ 7 leaves remainder 2', bad:false },
  { text:'13 ÷ 2 ＝ 6 餘 2', bad:true },
  { text:'51 ÷ 2 餘 0', bad:true },
  { text:'51 ÷ 7 leaves remainder 3', bad:true },
  { text:'13 ÷ 2 ＝ 5 餘 3', bad:true },
  { text:'15 的因數（15 ＝ 3 × 6）', bad:true },
  { text:'(91 = 7 × 14)', bad:true },
  { text:'2 × 3 ＝ 7', bad:true }
];

/* ---------- 7) 把 plan 畫成 SVG 字串，交給 lib/canvas.js 驗四個邊 ---------- */
function svgOfDots(pl){
  const body = pl.dots.map(p => '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + p.r + '"/>').join('');
  return '<svg viewBox="0 0 ' + pl.w + ' ' + pl.h + '" width="' + pl.w + '" height="' + pl.h + '">' + body + '</svg>';
}
function svgOfTree(t){
  const edges = t.edges.map(e => '<line x1="' + e[0].x + '" y1="' + e[0].y + '" x2="' + e[1].x + '" y2="' + e[1].y + '" stroke-width="2"/>').join('');
  const nodes = t.nodes.map(nd => '<circle cx="' + nd.x + '" cy="' + nd.y + '" r="' + NODE_R_REF + '" stroke-width="' + NODE_STROKE_REF + '"/>' +
    '<text x="' + nd.x + '" y="' + (nd.y + 6) + '" font-size="' + NODE_FS_REF + '" text-anchor="middle">' + nd.text + '</text>').join('');
  return '<svg viewBox="0 0 ' + t.w + ' ' + t.h + '" width="' + t.w + '" height="' + t.h + '">' + edges + nodes + '</svg>';
}

/* ---------- 8) 從畫出來的圖量回來 ---------- */
/* 點陣圖：n 個點、n % r 個紅點、每一排 floor(n / r) 個，相鄰的點剛好隔 DOT_GAP，全部在畫布裡。 */
function dotsProblems(tag, pl, n, r){
  const out = [];
  if (!pl || !Array.isArray(pl.dots)){ out.push(tag + ': arrayPlan returned no dots'); return out; }
  if (pl.w !== FIG_W_REF || pl.h !== DOT_FIG_H_REF) out.push(tag + ': canvas is ' + pl.w + 'x' + pl.h + ', expected ' + FIG_W_REF + 'x' + DOT_FIG_H_REF);
  if (pl.dots.length !== n) out.push(tag + ': draws ' + pl.dots.length + ' dots for n=' + n);
  const left = pl.dots.filter(d => d.left).length;
  if (left !== n % r) out.push(tag + ': ' + left + ' red dots, but ' + n + ' into ' + r + ' rows leaves ' + (n % r));
  if (pl.exact !== (n % r === 0 && n >= r)) out.push(tag + ': exact flag is ' + pl.exact + ' for n=' + n + ', r=' + r);
  const full = Math.floor(n / r);
  /* 每一顆點的 y 都要從 DOT_Y0 算出來：第 row 排在 DOT_Y0 ＋ row × ROW_GAP；紅點只能在第 r 排（最下面那一排），
     滿排的點只能在第 0 ~ r－1 排 —— 不可以用「不是紅的就算滿排」倒過來定義。 */
  pl.dots.forEach(d => {
    if (!Number.isInteger(d.row) || d.row < 0 || d.row > r) out.push(tag + ': a dot has row ' + d.row);
    if (d.y !== DOT_Y0_REF + d.row * ROW_GAP_REF) out.push(tag + ': a dot on row ' + d.row + ' sits at y=' + d.y + ', expected ' + (DOT_Y0_REF + d.row * ROW_GAP_REF));
    if (d.left && d.row !== r) out.push(tag + ': a red (leftover) dot is drawn on row ' + d.row + ', it belongs on row ' + r);
    if (!d.left && d.row >= r) out.push(tag + ': a full-row dot is drawn on row ' + d.row + ', full rows are 0..' + (r - 1));
  });
  const rows = {};
  pl.dots.forEach(d => { (rows[d.row] = rows[d.row] || []).push(d); });
  for (let i = 0; i < r; i++){
    const cnt = (rows[i] || []).length;
    if (cnt !== full) out.push(tag + ': row ' + i + ' holds ' + cnt + ' dots, expected ' + full);
  }
  const ys = Object.keys(rows).map(k => DOT_Y0_REF + Number(k) * ROW_GAP_REF).sort((a, b) => a - b);
  Object.keys(rows).forEach(k => {
    const xs = rows[k].map(d => d.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] !== DOT_GAP_REF) out.push(tag + ': dots are ' + (xs[i] - xs[i - 1]) + 'px apart, expected ' + DOT_GAP_REF);
  });
  pl.dots.forEach(d => {
    if (!(d.r === DOT_R_REF)) out.push(tag + ': a dot has radius ' + d.r);
    if (d.x - d.r < 0 || d.x + d.r > FIG_W_REF || d.y - d.r < 0 || d.y + d.r > DOT_FIG_H_REF) out.push(tag + ': a dot at (' + d.x + ',' + d.y + ') leaves the canvas');
  });
  if (DOT_GAP_REF < 2 * DOT_R_REF + 2) out.push(tag + ': dots would touch (gap ' + DOT_GAP_REF + ', diameter ' + 2 * DOT_R_REF + ')');
  canvasProblems(svgOfDots(pl)).forEach(m => out.push(tag + ' canvas: ' + m));
  return out;
}
/* 因數樹：葉子全是質數、乘起來是 n、每個內部節點 ＝ 兩個孩子相乘、同一層不相疊、都在畫布內。 */
function treeProblems(tag, t, n, expectedHidden){
  const out = [];
  const wantHidden = expectedHidden || 0;
  if (!t || !Array.isArray(t.nodes) || !Array.isArray(t.leaves) || !Array.isArray(t.edges)){ out.push(tag + ': treePlan is not shaped like a tree'); return out; }
  if (t.w !== FIG_W_REF || t.h !== TREE_H_REF) out.push(tag + ': canvas is ' + t.w + 'x' + t.h);
  const root = t.nodes[0];
  if (!root || root.v !== n || root.depth !== 0) out.push(tag + ': the root is not ' + n);
  const leafVals = t.leaves.map(l => l.v);
  leafVals.forEach(v => { if (!isPrimeRef(v)) out.push(tag + ': leaf ' + v + ' is not prime, so the tree stopped too early'); });
  if (productRef(leafVals) !== n) out.push(tag + ': the leaves multiply to ' + productRef(leafVals) + ', not ' + n);
  const sorted = leafVals.slice().sort((a, b) => a - b);
  if (!sameList(sorted, factorizeRef(n))) out.push(tag + ': leaves [' + sorted + '] differ from the prime factorisation [' + factorizeRef(n) + ']');
  if (!sameList(t.atoms, sorted)) out.push(tag + ': atoms [' + t.atoms + '] are not the sorted leaves');
  if (t.leaves.length > MAX_LEAVES_REF) out.push(tag + ': ' + t.leaves.length + ' leaves do not fit the canvas');
  const hiddenNodes = t.nodes.filter(nd => nd.hidden);
  if (hiddenNodes.length !== wantHidden) out.push(tag + ': ' + hiddenNodes.length + ' hidden node(s), expected ' + wantHidden);
  hiddenNodes.forEach(nd => { if (!nd.leaf) out.push(tag + ': the hidden node ' + nd.v + ' is not a leaf'); });
  t.nodes.forEach(nd => {
    if (nd.leaf !== isPrimeRef(nd.v)) out.push(tag + ': node ' + nd.v + ' leaf flag is ' + nd.leaf);
    if (!nd.leaf){
      if (!nd.children || nd.children.length !== 2) out.push(tag + ': node ' + nd.v + ' does not split into two');
      else {
        if (nd.children[0].v * nd.children[1].v !== nd.v) out.push(tag + ': node ' + nd.v + ' splits into ' + nd.children[0].v + ' × ' + nd.children[1].v);
        nd.children.forEach(c => {
          if (c.depth !== nd.depth + 1) out.push(tag + ': child ' + c.v + ' is not one level below ' + nd.v);
          if (!(c.y - nd.y === TREE_DY_REF)) out.push(tag + ': child ' + c.v + ' is ' + (c.y - nd.y) + 'px below its parent, expected ' + TREE_DY_REF);
          if (!t.edges.some(e => e[0] === nd && e[1] === c)) out.push(tag + ': no edge from ' + nd.v + ' to ' + c.v);
        });
      }
    }
    if (nd.depth === 0 && nd.y !== TREE_Y0_REF) out.push(tag + ': root y is ' + nd.y);
    if (nd.x - NODE_R_REF - NODE_STROKE_REF < 0 || nd.x + NODE_R_REF + NODE_STROKE_REF > FIG_W_REF) out.push(tag + ': node ' + nd.v + ' at x=' + nd.x + ' leaves the canvas sideways');
    if (nd.y - NODE_R_REF - NODE_STROKE_REF < 0 || nd.y + NODE_R_REF + NODE_STROKE_REF > TREE_H_REF) out.push(tag + ': node ' + nd.v + ' at y=' + nd.y + ' leaves the canvas vertically');
    if ([...String(nd.text)].length > 3) out.push(tag + ': label "' + nd.text + '" is longer than three characters and would spill out of its circle');
    if (!nd.hidden && String(nd.text) !== String(nd.v)) out.push(tag + ': node ' + nd.v + ' is labelled "' + nd.text + '"');
    if (nd.hidden && String(nd.text) !== '?') out.push(tag + ': the hidden leaf is labelled "' + nd.text + '", expected ?');
  });
  if (t.edges.length !== t.nodes.length - 1) out.push(tag + ': ' + t.edges.length + ' edges for ' + t.nodes.length + ' nodes');
  t.edges.forEach(e => {
    if (t.nodes.indexOf(e[0]) < 0 || t.nodes.indexOf(e[1]) < 0) out.push(tag + ': an edge points at a node that is not drawn');
  });
  const byDepth = {};
  t.nodes.forEach(nd => { (byDepth[nd.depth] = byDepth[nd.depth] || []).push(nd.x); });
  Object.keys(byDepth).forEach(dp => {
    const xs = byDepth[dp].slice().sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++)
      if (xs[i] - xs[i - 1] < 2 * NODE_R_REF + 8) out.push(tag + ': two circles on level ' + dp + ' are only ' + (xs[i] - xs[i - 1]) + 'px apart');
  });
  const leafXs = t.leaves.map(l => l.x);
  for (let i = 1; i < leafXs.length; i++) if (!(leafXs[i] > leafXs[i - 1])) out.push(tag + ': leaves are not laid out left to right');
  canvasProblems(svgOfTree(t), { allow:[] }).forEach(m => out.push(tag + ' canvas: ' + m));
  return out;
}
/* 篩子板：逐格對照自己算的狀態。 */
function sieveRef(stage){
  const used = SIEVE_PRIMES_REF.slice(0, stage), cells = [];
  for (let n = 1; n <= SIEVE_N_REF; n++){
    let state = 'plain', by = null;
    if (n === 1) state = 'one';
    else {
      const hit = used.find(p => n % p === 0);
      if (hit !== undefined){ if (hit === n) state = 'prime'; else { state = 'cross'; by = hit; } }
      else if (stage >= SIEVE_PRIMES_REF.length) state = 'prime';
    }
    cells.push({ n, state, by });
  }
  return cells;
}

/* ---------- 9) 產生器：不變條件的共用檢查 ---------- */
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

module.exports = {
  /* ================= 產生器模擬（tools/simgen.js） ================= */
  sim: {
    INVARIANTS: {
      whichPrime: d => {
        const bad = intOptsProblems('whichPrime', d, 2, LIMIT_REF, []);
        if (bad) return bad;
        const primes = d.opts.filter(isPrimeRef);
        if (primes.length !== 1) return 'whichPrime: ' + primes.length + ' of the four options are prime, the stem promises exactly one';
        if (primes[0] !== d.p || d.opts[d.ans] !== d.p) return 'whichPrime: p=' + d.p + ' is not the prime option';
        if (d.p < 11) return 'whichPrime: p=' + d.p + ' is too small to need testing';
        if (!Array.isArray(d.comps) || d.comps.length !== 3 || d.comps.some(c => isPrimeRef(c) || c % 2 === 0 || c % 5 === 0 || c < 9)) return 'whichPrime: distractors [' + d.comps + '] are not odd composites that look prime';
      },
      whichComposite: d => {
        const bad = intOptsProblems('whichComposite', d, 2, LIMIT_REF, []);
        if (bad) return bad;
        const comps = d.opts.filter(v => !isPrimeRef(v));
        if (comps.length !== 1) return 'whichComposite: ' + comps.length + ' of the four options are composite, the stem promises exactly one';
        if (comps[0] !== d.c || d.opts[d.ans] !== d.c) return 'whichComposite: c=' + d.c + ' is not the composite option';
        if (d.c % 2 === 0 || d.c % 5 === 0 || d.c < 21) return 'whichComposite: c=' + d.c + ' would be spotted from its last digit';
        if (!Array.isArray(d.primes) || d.primes.length !== 3 || d.primes.some(p => !isPrimeRef(p) || p < 11)) return 'whichComposite: primes [' + d.primes + '] are wrong';
      },
      classifyKind: d => {
        if (!(Number.isInteger(d.n) && d.n >= 1 && d.n <= 30)) return 'classifyKind: n=' + d.n + ' is outside 1..30';
        const want = kindRef(d.n) === 'one' ? 'neither' : kindRef(d.n);
        if (d.kind !== want) return 'classifyKind: ' + d.n + ' is ' + want + ', data says ' + d.kind;
        if (!Array.isArray(d.opts) || d.opts.slice().sort().join() !== ['both', 'composite', 'neither', 'prime'].join()) return 'classifyKind: the four conclusions are not each offered once';
        if (d.opts[d.ans] !== want) return 'classifyKind: opts[ans] is ' + d.opts[d.ans];
      },
      primeFactorization: d => {
        if (!(Number.isInteger(d.n) && d.n >= 4 && d.n <= LIMIT_REF) || isPrimeRef(d.n)) return 'primeFactorization: n=' + d.n + ' is not a composite up to 100';
        const atoms = factorizeRef(d.n);
        if (atoms.length < 3) return 'primeFactorization: n=' + d.n + ' has only ' + atoms.length + ' prime factors, so the "not finished" distractors cannot be built';
        if (!sameList(d.atoms, atoms)) return 'primeFactorization: atoms [' + d.atoms + '] should be [' + atoms + ']';
        if (!Array.isArray(d.opts) || d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'primeFactorization: options are not four distinct strings';
        if (d.opts[d.ans] !== atoms.join(' × ')) return 'primeFactorization: opts[ans] is ' + d.opts[d.ans];
        for (let i = 0; i < 4; i++){
          if (i === d.ans) continue;
          const parts = parseProduct(d.opts[i]);
          if (!parts) return 'primeFactorization: option "' + d.opts[i] + '" is not a product';
          if (parts.every(isPrimeRef) && productRef(parts) === d.n) return 'primeFactorization: distractor "' + d.opts[i] + '" is also a correct prime factorisation';
          if (parts.some(x => x < 2 || x > LIMIT_REF)) return 'primeFactorization: distractor "' + d.opts[i] + '" uses a factor outside 2..100';
          if (productRef(parts) > LIMIT_REF) return 'primeFactorization: distractor "' + d.opts[i] + '" multiplies to ' + productRef(parts) + ', beyond this lesson\'s 100';
        }
      },
      productOfPrimes: d => {
        if (!Array.isArray(d.atoms) || d.atoms.length < 2 || d.atoms.length > 3) return 'productOfPrimes: atoms [' + d.atoms + '] must be two or three primes';
        if (d.atoms.some(a => !isPrimeRef(a))) return 'productOfPrimes: atoms [' + d.atoms + '] are not all prime';
        for (let i = 1; i < d.atoms.length; i++) if (d.atoms[i] < d.atoms[i - 1]) return 'productOfPrimes: atoms are not written from smallest to largest';
        if (productRef(d.atoms) !== d.n || d.n > LIMIT_REF) return 'productOfPrimes: n=' + d.n + ' is not the product of [' + d.atoms + '] within 100';
        const bad = intOptsProblems('productOfPrimes', d, 1, LIMIT_REF, d.atoms);
        if (bad) return bad;
        if (d.opts[d.ans] !== d.n) return 'productOfPrimes: opts[ans] is ' + d.opts[d.ans];
      },
      smallestPrimeFactor: d => {
        if (!(Number.isInteger(d.n) && d.n >= 10 && d.n <= LIMIT_REF) || isPrimeRef(d.n)) return 'smallestPrimeFactor: n=' + d.n + ' is not a composite in 10..100';
        if (d.p !== spfRef(d.n)) return 'smallestPrimeFactor: p=' + d.p + ', the smallest prime factor of ' + d.n + ' is ' + spfRef(d.n);
        if (!sameList(d.atoms, factorizeRef(d.n))) return 'smallestPrimeFactor: atoms are wrong';
        const bad = intOptsProblems('smallestPrimeFactor', d, 1, LIMIT_REF, [d.n]);
        if (bad) return bad;
        if (d.opts[d.ans] !== d.p) return 'smallestPrimeFactor: opts[ans] is ' + d.opts[d.ans];
      },
      missingAtom: d => {
        if (!(Number.isInteger(d.n) && d.n >= 10 && d.n <= LIMIT_REF) || isPrimeRef(d.n)) return 'missingAtom: n=' + d.n + ' is not a composite in 10..100';
        const atoms = factorizeRef(d.n);
        if (!sameList(d.atoms, atoms)) return 'missingAtom: atoms are wrong';
        if (!Array.isArray(d.shown) || d.shown.length !== atoms.length - 1) return 'missingAtom: shown atoms are not all but one';
        if (!isPrimeRef(d.hidden) || productRef(d.shown) * d.hidden !== d.n) return 'missingAtom: ' + productRef(d.shown) + ' × ' + d.hidden + ' is not ' + d.n;
        const bad = intOptsProblems('missingAtom', d, 1, LIMIT_REF, [d.n].concat(d.shown));
        if (bad) return bad;
        if (d.opts[d.ans] !== d.hidden) return 'missingAtom: opts[ans] is ' + d.opts[d.ans];
      },
      countPrimesBetween: d => {
        if (!(Number.isInteger(d.a) && d.a % 10 === 0 && d.a >= 10 && d.a <= 90) || d.b !== d.a + 10) return 'countPrimesBetween: range ' + d.a + '..' + d.b + ' is not a decade';
        const ps = PRIMES_200.filter(p => p > d.a && p < d.b);
        if (!sameList(d.primes, ps) || d.k !== ps.length) return 'countPrimesBetween: primes between ' + d.a + ' and ' + d.b + ' are [' + ps + '], data says [' + d.primes + '] k=' + d.k;
        const bad = intOptsProblems('countPrimesBetween', d, 1, 9, [d.a, d.b]);
        if (bad) return bad;
        if (d.opts[d.ans] !== d.k) return 'countPrimesBetween: opts[ans] is ' + d.opts[d.ans];
        if (d.opts.indexOf(5) < 0 && d.k !== 5) return 'countPrimesBetween: the "count the odd numbers" distractor 5 is missing';
      },
      divisibleByWhich: d => {
        if (!(Number.isInteger(d.n) && d.n >= 10 && d.n <= LIMIT_REF) || isPrimeRef(d.n)) return 'divisibleByWhich: n=' + d.n + ' is not a composite in 10..100';
        const hits = TRIAL_REF.filter(p => d.n % p === 0);
        if (hits.length !== 1) return 'divisibleByWhich: ' + d.n + ' is divisible by ' + hits.length + ' of 2,3,5,7 — the stem needs exactly one';
        if (d.p !== hits[0]) return 'divisibleByWhich: p=' + d.p + ', but ' + hits[0] + ' is the one that divides ' + d.n;
        if (!Array.isArray(d.opts) || d.opts.slice().sort((a, b) => a - b).join() !== TRIAL_REF.join()) return 'divisibleByWhich: options are not 2, 3, 5, 7';
        if (d.opts[d.ans] !== d.p) return 'divisibleByWhich: opts[ans] is ' + d.opts[d.ans];
      },
      trueStatement: d => {
        if (!TRUE_STATEMENTS_REF[d.t]) return 'trueStatement: "' + d.t + '" is not a true statement';
        if (!Array.isArray(d.opts) || d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'trueStatement: options are not four distinct keys';
        const trues = d.opts.filter(k => TRUE_STATEMENTS_REF[k]);
        if (trues.length !== 1) return 'trueStatement: ' + trues.length + ' true sentences offered, the stem promises exactly one';
        if (d.opts.some(k => !TRUE_STATEMENTS_REF[k] && FALSE_KEYS_REF.indexOf(k) < 0)) return 'trueStatement: an option key is unknown to the truth table: ' + d.opts;
        if (d.opts[d.ans] !== d.t) return 'trueStatement: opts[ans] is ' + d.opts[d.ans];
      },
      interFactorCount: d => {
        if (!(Number.isInteger(d.n) && d.n >= 6 && d.n <= 40)) return 'interFactorCount: n=' + d.n + ' is outside 6..40';
        if (d.k !== factorCountRef(d.n)) return 'interFactorCount: ' + d.n + ' has ' + factorCountRef(d.n) + ' factors, data says ' + d.k;
        const bad = intOptsProblems('interFactorCount', d, 1, 12, [d.n]);
        if (bad) return bad;
        if (d.opts[d.ans] !== d.k) return 'interFactorCount: opts[ans] is ' + d.opts[d.ans];
      },
      interGCF: d => {
        if (!GCF_PAIRS_REF.some(p => p[0] === d.a && p[1] === d.b)) return 'interGCF: (' + d.a + ', ' + d.b + ') is not one of the listed pairs';
        if (d.g !== gcdRef(d.a, d.b)) return 'interGCF: gcf(' + d.a + ',' + d.b + ')=' + gcdRef(d.a, d.b) + ', data says ' + d.g;
        const common = factorsRef(d.a).filter(f => d.b % f === 0);
        if (!sameList(d.common, common)) return 'interGCF: common factors are wrong';
        const lcm = d.a * d.b / gcdRef(d.a, d.b);
        if (d.l !== lcm) return 'interGCF: l=' + d.l + ' is not the LCM ' + lcm;
        if (lcm > LIMIT_REF || lcm === d.a || lcm === d.b) return 'interGCF: the LCM distractor ' + lcm + ' is outside 1..100 or copies the stem, so the pair (' + d.a + ',' + d.b + ') cannot be used';
        if (d.opts.indexOf(lcm) < 0) return 'interGCF: the "confused GCF with LCM" distractor ' + lcm + ' is missing';
        if (isPrimeRef(d.g)) return 'interGCF: gcf ' + d.g + ' is prime, so the second-largest common factor is 1 and collides with the distractor 1';
        if (d.opts.indexOf(1) < 0 || d.opts.indexOf(common[common.length - 2]) < 0) return 'interGCF: the distractors 1 and the second-largest common factor ' + common[common.length - 2] + ' must both be offered';
        const bad = intOptsProblems('interGCF', d, 1, LIMIT_REF, [d.a, d.b]);
        if (bad) return bad;
        if (d.opts[d.ans] !== d.g) return 'interGCF: opts[ans] is ' + d.opts[d.ans];
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'whichPrime': { const ps = (d.opts || []).filter(isPrimeRef); return ps.length === 1 ? String(ps[0]) : null; }
        case 'whichComposite': { const cs = (d.opts || []).filter(v => !isPrimeRef(v)); return cs.length === 1 ? String(cs[0]) : null; }
        case 'classifyKind': { const k = kindRef(d.n); return KIND_TEXT_REF[lang][k === 'one' ? 'neither' : k]; }
        case 'primeFactorization': return factorizeRef(d.n).join(' × ');
        case 'productOfPrimes': return String(productRef(d.atoms));
        case 'smallestPrimeFactor': return String(spfRef(d.n));
        case 'missingAtom': return String(d.n / productRef(d.shown));
        case 'countPrimesBetween': { const k = PRIMES_200.filter(p => p > d.a && p < d.b).length; return lang === 'zh' ? (k + ' 個') : String(k); }
        case 'divisibleByWhich': { const hits = TRIAL_REF.filter(p => d.n % p === 0); return hits.length === 1 ? String(hits[0]) : null; }
        case 'trueStatement': return TRUE_STATEMENTS_REF[d.t] ? TRUE_STATEMENTS_REF[d.t][lang] : null;
        case 'interFactorCount': { const k = factorCountRef(d.n); return lang === 'zh' ? (k + ' 個') : String(k); }
        case 'interGCF': return String(gcdRef(d.a, d.b));
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣：整數、「k 個」、質數相乘的算式、或固定的整句話。 */
    optionOk: function(s, genId, lang, isCorrect){
      const t = String(s).trim();
      if (!t) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
      if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
      if (lang === 'en' && /[一-鿿]/.test(t)) return 'English option contains Chinese: ' + t;
      if (genId === 'classifyKind'){
        return Object.keys(KIND_TEXT_REF[lang]).some(k => KIND_TEXT_REF[lang][k] === t) ? null : 'classifyKind option is not one of the four conclusions: ' + t;
      }
      if (genId === 'trueStatement'){
        return t.length >= 4 && t.length <= 70 && !/\d{3}/.test(t) ? null : 'trueStatement option does not look like a sentence: ' + t;
      }
      if (genId === 'primeFactorization'){
        const parts = parseProduct(t);
        if (!parts) return 'primeFactorization option is not written as a × b × c: ' + t;
        if (parts.length < 2 || parts.some(x => x < 2 || x > LIMIT_REF)) return 'primeFactorization option has a factor outside 2..100: ' + t;
        if (isCorrect && parts.some(x => !isPrimeRef(x))) return 'the correct option ' + t + ' contains a composite';
        return null;
      }
      if (genId === 'countPrimesBetween' || genId === 'interFactorCount'){
        const m = lang === 'zh' ? /^(\d+) 個$/.exec(t) : /^(\d+)$/.exec(t);
        if (!m) return genId + ' option is not a count' + (lang === 'zh' ? ' with 個' : '') + ': ' + t;
        const v = Number(m[1]);
        if (v < 1 || v > (genId === 'countPrimesBetween' ? 9 : 12)) return genId + ' count ' + v + ' is out of range';
        return null;
      }
      if (!/^\d+$/.test(t)) return 'option is not a whole number: ' + t;
      const v = Number(t);
      if (v < 1 || v > LIMIT_REF) return 'option ' + t + ' is outside 1..100';
      if (genId === 'divisibleByWhich' && TRIAL_REF.indexOf(v) < 0) return 'divisibleByWhich option ' + t + ' is not one of 2, 3, 5, 7';
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次：值去重、算式算對、字串乾淨、以及每一支自己的語意。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length !== 4) out.push('there are ' + q.opts.length + ' options, not four');
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');
      const keys = q.opts.map(optKeyRef);
      for (let i = 0; i < keys.length; i++)
        for (let j = i + 1; j < keys.length; j++)
          if (keys[i] === keys[j]) out.push('two options are the same: ' + q.opts[i] + ' / ' + q.opts[j]);
      const ar = arithAll(q.stem + ' ' + q.why);
      ar.problems.forEach(m => out.push(m));
      /* 這幾支的解釋一定寫了至少一條算式；一條都沒驗到就是驗算器沒讀到（fail-closed）。 */
      if (['whichPrime', 'whichComposite', 'primeFactorization', 'productOfPrimes', 'smallestPrimeFactor', 'missingAtom', 'divisibleByWhich', 'countPrimesBetween'].indexOf(genId) >= 0 && ar.verified < 1)
        out.push('the explanation should contain an equation to verify, but none was read');
      stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
      stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
      q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
      /* 每一支自己的語意，從**印出來的**題幹與選項讀回來。 */
      const stemNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
      if (genId === 'whichPrime' || genId === 'whichComposite'){
        const vals = q.opts.map(Number);
        const primes = vals.filter(isPrimeRef).length;
        if (genId === 'whichPrime' && primes !== 1) out.push('the rendered options contain ' + primes + ' primes');
        if (genId === 'whichComposite' && primes !== 3) out.push('the rendered options contain ' + (4 - primes) + ' composites');
        const cue = lang === 'zh' ? (genId === 'whichPrime' ? '只有一個是質數' : '只有一個是合數') : (genId === 'whichPrime' ? 'exactly one is prime' : 'exactly one is composite');
        if (q.stem.indexOf(cue) < 0) out.push('the stem must promise "' + cue + '"');
      }
      if (genId === 'primeFactorization'){
        if (stemNums.length !== 1 || stemNums[0] !== d.n) out.push('the stem should print exactly the number ' + d.n);
        const parts = parseProduct(q.opts[q.ans]);
        if (!parts || productRef(parts) !== d.n || !parts.every(isPrimeRef)) out.push('the rendered correct option is not a prime factorisation of ' + d.n);
      }
      if (genId === 'missingAtom'){
        const m = /^<strong>(\d+) [＝=] ([\d × ]+) × [？?]<\/strong>/.exec(q.stem);
        if (!m) out.push('the stem does not read "n = shown × ?"');
        else {
          const shown = m[2].split(' × ').map(Number);
          if (Number(m[1]) !== d.n) out.push('the stem prints ' + m[1] + ' instead of ' + d.n);
          if (!sameList(shown, d.shown)) out.push('the stem shows [' + shown + '] but the data says the shown atoms are [' + d.shown + ']');
          if (productRef(shown) * Number(q.opts[q.ans]) !== d.n) out.push('shown atoms × the marked answer is not ' + d.n);
        }
      }
      if (genId === 'countPrimesBetween'){
        if (stemNums.indexOf(d.a) < 0 || stemNums.indexOf(d.b) < 0) out.push('the stem does not print both ends of the range');
        const cue = lang === 'zh' ? '不含 ' + d.a + ' 和 ' + d.b : 'not counting ' + d.a + ' and ' + d.b;
        if (q.stem.indexOf(cue) < 0) out.push('the stem must say the ends are excluded ("' + cue + '")');
      }
      if (genId === 'divisibleByWhich'){
        const cue = lang === 'zh' ? '整除' : 'divides it exactly';
        if (q.stem.indexOf(cue) < 0) out.push('the stem must ask which prime "' + cue + '"');
        if (stemNums.length !== 1 || stemNums[0] !== d.n) out.push('the stem should print exactly the number ' + d.n);
      }
      if (genId === 'interGCF'){
        const cue = lang === 'zh' ? '最大公因數' : 'greatest common factor';
        if (q.stem.indexOf(cue) < 0) out.push('the stem must ask for the "' + cue + '"');
        if (stemNums.length !== 2 || stemNums[0] !== d.a || stemNums[1] !== d.b) out.push('the stem should print exactly ' + d.a + ' and ' + d.b);
      }
      if (genId === 'interFactorCount'){
        const cue = lang === 'zh' ? '因數</strong>一共有幾個' : 'factors</strong> does';
        if (q.stem.indexOf(cue) < 0) out.push('the stem must ask how many factors');
        if (stemNums.length !== 1 || stemNums[0] !== d.n) out.push('the stem should print exactly the number ' + d.n);
      }
      /* 每一支的題幹印的數字都要就是 make() 抽到的那幾個 —— 不然改壞 fmt 印出別的數字，答案照舊，全綠。 */
      if (genId === 'classifyKind' || genId === 'smallestPrimeFactor'){
        if (stemNums.length !== 1 || stemNums[0] !== d.n) out.push('the stem should print exactly the number ' + d.n);
      }
      if (genId === 'productOfPrimes'){
        if (!sameList(stemNums, d.atoms)) out.push('the stem should print the atoms [' + d.atoms + '] in order, it prints [' + stemNums + ']');
      }
      if (genId === 'whichPrime' || genId === 'whichComposite' || genId === 'trueStatement'){
        if (stemNums.length !== 0) out.push('the stem should print no numbers (the numbers are the options)');
      }
      if (genId === 'classifyKind'){
        const cue = lang === 'zh' ? '是哪一種數' : 'What kind of number';
        if (q.stem.indexOf(cue) < 0) out.push('the stem must ask which kind of number');
      }
      if (genId === 'smallestPrimeFactor'){
        const cue = lang === 'zh' ? '最小的<strong>質因數</strong>' : 'smallest <strong>prime factor</strong>';
        if (q.stem.indexOf(cue) < 0) out.push('the stem must ask for the smallest prime factor');
      }
      if (genId === 'productOfPrimes'){
        const cue = lang === 'zh' ? '是哪一個數的質因數分解' : 'is the prime factorisation of which number';
        if (q.stem.indexOf(cue) < 0) out.push('the stem must ask which number the product factorises');
      }
      if (genId === 'countPrimesBetween'){
        const uniq = [...new Set(stemNums)];
        if (uniq.length !== 2 || uniq[0] !== d.a || uniq[1] !== d.b) out.push('the stem prints numbers other than ' + d.a + ' and ' + d.b);
      }
      if (genId === 'trueStatement'){
        let trues = 0;
        q.opts.forEach(o => {
          const tv = statementTruthOfText(o, lang);
          if (tv === null) out.push('option "' + o + '" is not one of the pinned statement texts');
          else if (tv) trues++;
        });
        if (trues !== 1) out.push('the rendered options contain ' + trues + ' true sentences');
      }
      return out.length ? out.join('; ') : null;
    },

    /* 刻意的迷思誘答：這一課的產生器都用 avoid 把題幹數字擋掉，沒有任何一個值需要放行。
       （countPrimesBetween 的「5 個」是奇數的個數，不是題幹上的數字，不會被 simgen 當成抄題。） */
    stemEchoOk: {}
  },

  /* ================= index.html 靜態資料檢查（tools/verify_lesson_data.js） ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{LIMIT, TRIAL_PRIMES, isPrime, kindOf, factorsOf, smallestPrimeFactor, factorize, productText, productOf, digitSum, trialRows, ' +
                'FIG_W, DOT_FIG_H, DOT_R, DOT_GAP, ROW_GAP, DOT_Y0, TREE_H, NODE_R, TREE_Y0, TREE_DY, NODE_FS, ' +
                'S1_NUMS, S1_ROWS, arrayPlan, S2_CASES, S2_STEPS, pairsOf, omega, treeOK, S3_CASES, treePlan, S4_CASES, shortDivRows, ' +
                'SIEVE_N, SIEVE_PRIMES, S5_STEPS, sieveState, ROUNDS, STATEMENT_TRUTH, roundFig, roundAnswer, roundAnswerIndex, plEn, listText}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器自己先過 PROBE（零誤報 ＋ 一定要抓到） ---- */
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

      /* ---- 1. 版面常數 ＝ 獨立寫死的第二份；三張畫布的 viewBox 與 CSS 高度 ---- */
      const CONSTS = { LIMIT:LIMIT_REF, FIG_W:FIG_W_REF, DOT_FIG_H:DOT_FIG_H_REF, DOT_R:DOT_R_REF, DOT_GAP:DOT_GAP_REF, ROW_GAP:ROW_GAP_REF, DOT_Y0:DOT_Y0_REF,
                       TREE_H:TREE_H_REF, NODE_R:NODE_R_REF, TREE_Y0:TREE_Y0_REF, TREE_DY:TREE_DY_REF, NODE_FS:NODE_FS_REF, SIEVE_N:SIEVE_N_REF };
      Object.keys(CONSTS).forEach(k => { if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ' but the reference says ' + CONSTS[k]); });
      if (!sameList(data.TRIAL_PRIMES, TRIAL_REF)) fail('TRIAL_PRIMES is [' + data.TRIAL_PRIMES + '], expected [2,3,5,7]');
      if (!sameList(data.SIEVE_PRIMES, SIEVE_PRIMES_REF)) fail('SIEVE_PRIMES is [' + data.SIEVE_PRIMES + ']');
      const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const svgs = liveSrc.match(/<svg[^>]*>/g) || [];
      if (svgs.length !== 3) fail('index.html has ' + svgs.length + ' canvases, expected 3 (dots, tree, game tree)');
      svgs.forEach(tag => {
        const cls = (/class="([^"]+)"/.exec(tag) || [])[1];
        const nums = ((/viewBox="([^"]+)"/.exec(tag) || ['', ''])[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        const wantH = cls === 'dotfig' ? DOT_FIG_H_REF : (cls === 'treefig' ? TREE_H_REF : null);
        if (wantH === null) fail('a canvas has class "' + cls + '", which this config does not know');
        else if (nums.length !== 4 || nums[0] !== 0 || nums[1] !== 0 || nums[2] !== FIG_W_REF || nums[3] !== wantH) fail('a canvas viewBox is ' + tag + ', expected 0 0 ' + FIG_W_REF + ' ' + wantH);
      });
      [['dotfig', DOT_FIG_H_REF], ['treefig', TREE_H_REF]].forEach(pair => {
        const rules = liveSrc.match(new RegExp('\\.' + pair[0] + '\\s*\\{[^}]*\\}', 'g')) || [];
        if (rules.length !== 1){ fail('index.html declares the .' + pair[0] + ' rule ' + rules.length + ' time(s), expected exactly 1'); return; }
        const hs = rules[0].match(/[{;]\s*height:\s*(\d+)px/g) || [];
        if (hs.length !== 1) fail('the .' + pair[0] + ' rule declares a plain height ' + hs.length + ' time(s)');
        else if (Number(/height:\s*(\d+)px/.exec(hs[0])[1]) !== pair[1]) fail('.' + pair[0] + ' is ' + hs[0].trim() + ' in CSS but the viewBox is ' + pair[1] + ' tall — the drawing would be letterboxed');
      });

      /* ---- 2. 數論函式 vs 篩法／最大質因數法／配對法，1 ~ 200 全部比 ---- */
      let compared = 0;
      for (let n = 1; n <= 200; n++){
        compared++;
        if (data.isPrime(n) !== isPrimeRef(n)) fail('isPrime(' + n + ')=' + data.isPrime(n) + ', the sieve says ' + isPrimeRef(n));
        if (data.kindOf(n) !== kindRef(n)) fail('kindOf(' + n + ')=' + data.kindOf(n) + ', expected ' + kindRef(n));
        if (!sameList(data.factorsOf(n), factorsRef(n))) fail('factorsOf(' + n + ')=[' + data.factorsOf(n) + '], pairing gives [' + factorsRef(n) + ']');
        if (!sameList(data.factorize(n), factorizeRef(n))) fail('factorize(' + n + ')=[' + data.factorize(n) + '], dividing by the largest prime gives [' + factorizeRef(n) + ']');
        if (n >= 2 && data.smallestPrimeFactor(n) !== spfRef(n)) fail('smallestPrimeFactor(' + n + ')=' + data.smallestPrimeFactor(n));
        if (data.omega(n) !== factorizeRef(n).length) fail('omega(' + n + ')=' + data.omega(n));
        if (data.digitSum(n) !== digitSumRef(n)) fail('digitSum(' + n + ')=' + data.digitSum(n));
        const pairs = data.pairsOf(n);
        const wantPairs = factorsRef(n).filter(a => a >= 2 && a * a <= n).map(a => [a, n / a]);
        if (pairs.length !== wantPairs.length || pairs.some((p, i) => p[0] !== wantPairs[i][0] || p[1] !== wantPairs[i][1])) fail('pairsOf(' + n + ') is not every a × b with 2 ≤ a ≤ b');
        if (n <= LIMIT_REF && data.treeOK(n) !== (kindRef(n) === 'composite' && factorizeRef(n).length <= MAX_LEAVES_REF)) fail('treeOK(' + n + ')=' + data.treeOK(n));
      }
      if (compared !== 200) fail('only ' + compared + ' numbers were compared');
      if (data.isPrime(0) || data.isPrime(-3) || data.isPrime(2.5)) fail('isPrime accepts 0, a negative or a fraction');
      if (data.productText([2, 2, 3]) !== '2 × 2 × 3') fail('productText does not write " × " between the atoms');
      if (data.productOf([2, 3, 5]) !== 30) fail('productOf([2,3,5]) is ' + data.productOf([2, 3, 5]));
      if (data.plEn(1, 'factor') !== '1 factor' || data.plEn(2, 'factor') !== '2 factors') fail('plEn is wrong');
      if (data.listText([1, 2, 4], 'zh') !== '1、2、4' || data.listText([1, 2, 4], 'en') !== '1, 2, 4') fail('listText is wrong');

      /* ---- 3. 試除法：對每一個 2 ~ 100 逐一驗 —— 這是「試到 7 就夠」的列舉證明 ---- */
      for (let n = 2; n <= LIMIT_REF; n++){
        const tr = data.trialRows(n);
        const want = isPrimeRef(n) ? 'prime' : 'composite';
        if (tr.verdict !== want) fail('trialRows(' + n + ') says ' + tr.verdict + ', the sieve says ' + want);
        if (want === 'composite'){
          if (tr.by !== spfRef(n)) fail('trialRows(' + n + ') is caught by ' + tr.by + ', its smallest prime factor is ' + spfRef(n));
          if (TRIAL_REF.indexOf(tr.by) < 0) fail('trialRows(' + n + ') needs a prime outside 2,3,5,7 — the lesson\'s "7 is enough" claim fails at ' + n);
        } else if (tr.by !== null) fail('trialRows(' + n + ') is prime but records by=' + tr.by);
        if (!Array.isArray(tr.rows) || tr.rows.length !== 4) fail('trialRows(' + n + ') has ' + (tr.rows || []).length + ' rows');
        else {
          let decided = false;
          tr.rows.forEach((row, i) => {
            if (row.p !== TRIAL_REF[i]) fail('trialRows(' + n + ') row ' + i + ' tries ' + row.p);
            if (row.after !== decided) fail('trialRows(' + n + ') row ' + row.p + ' after flag is ' + row.after);
            if (row.self !== (n === row.p)) fail('trialRows(' + n + ') row ' + row.p + ' self flag is wrong');
            if (row.div !== (n % row.p === 0 && n !== row.p)) fail('trialRows(' + n + ') row ' + row.p + ' div flag is wrong');
            if (row.q !== Math.floor(n / row.p) || row.r !== n % row.p) fail('trialRows(' + n + ') row ' + row.p + ' quotient/remainder is wrong');
            if (row.dsum !== digitSumRef(n)) fail('trialRows(' + n + ') digit sum is ' + row.dsum);
            if (row.how !== (row.p === 3 ? 'dsum' : (row.p === 7 ? 'divide' : 'last'))) fail('trialRows(' + n + ') row ' + row.p + ' how=' + row.how);
            if (!decided && (row.self || row.div)) decided = true;
          });
        }
      }
      if (!sameList(data.S2_CASES, S2_CASES_REF)) fail('S2_CASES is [' + data.S2_CASES + '], the reference says [' + S2_CASES_REF + ']');
      if (data.S2_STEPS !== 5) fail('S2_STEPS is ' + data.S2_STEPS);
      const s2kinds = { prime:0, byThree:0, bySeven:0 };
      S2_CASES_REF.forEach(n => { const tr = data.trialRows(n); if (tr.verdict === 'prime') s2kinds.prime++; if (tr.by === 3) s2kinds.byThree++; if (tr.by === 7) s2kinds.bySeven++; });
      if (!s2kinds.prime || !s2kinds.byThree || !s2kinds.bySeven) fail('S2_CASES must include a prime, a number caught by 3 and one caught by 7 — got ' + JSON.stringify(s2kinds));

      /* ---- 4. 點陣圖：S1 的每一個 n × 每一種排法 ---- */
      if (!sameList(data.S1_NUMS, S1_NUMS_REF)) fail('S1_NUMS is [' + data.S1_NUMS + ']');
      if (!sameList(data.S1_ROWS, S1_ROWS_REF)) fail('S1_ROWS is [' + data.S1_ROWS + ']');
      const s1kinds = { one:0, prime:0, composite:0 };
      S1_NUMS_REF.forEach(n => { s1kinds[kindRef(n)]++; S1_ROWS_REF.forEach(r => dotsProblems('arrayPlan(' + n + ',' + r + ')', data.arrayPlan(n, r), n, r).forEach(fail)); });
      if (!s1kinds.one || !s1kinds.prime || !s1kinds.composite) fail('S1_NUMS must show all three kinds of number');
      S1_NUMS_REF.filter(n => kindRef(n) === 'composite').forEach(n => {
        if (!S1_ROWS_REF.some(r => r >= 2 && n % r === 0)) fail('composite ' + n + ' in S1 cannot be laid out in two or more of the offered rows, so the child never sees it split');
      });

      /* ---- 5. 因數樹：每一個畫得出來的合數 × 每一種第一刀 ---- */
      let combos = 0;
      for (let n = 4; n <= LIMIT_REF; n++){
        if (!data.treeOK(n)) continue;
        data.pairsOf(n).forEach(pair => { combos++; treeProblems('treePlan(' + n + ',' + pair.join('×') + ')', data.treePlan(n, pair), n).forEach(fail); });
      }
      if (combos !== TREE_COMBOS_REF) fail('only ' + combos + ' (n, first split) trees were checked, the domain has ' + TREE_COMBOS_REF);
      if (!sameList(data.S3_CASES, S3_CASES_REF)) fail('S3_CASES is [' + data.S3_CASES + ']');
      S3_CASES_REF.forEach(n => {
        if (!data.treeOK(n)) fail('S3 case ' + n + ' cannot be drawn');
        if (data.pairsOf(n).length < 2) fail('S3 case ' + n + ' offers only one first split, so "try another first split" has nothing to try');
      });
      /* 缺一片的樹：藏起來的那一片要算得回來，而且是質數 */
      const gameTree = data.treePlan(70, [7, 10], 2);
      const hidden = gameTree.leaves.filter(l => l.hidden);
      if (hidden.length !== 1) fail('treePlan(70,[7,10],2) hides ' + hidden.length + ' leaves');
      else if (70 / productRef(gameTree.leaves.filter(l => !l.hidden).map(l => l.v)) !== hidden[0].v) fail('the hidden leaf does not equal root ÷ the shown leaves');
      treeProblems('treePlan(70,[7,10],hide 2)', gameTree, 70, 1).forEach(fail);

      /* ---- 6. 短除法 ---- */
      for (let n = 2; n <= LIMIT_REF; n++){
        const sd = data.shortDivRows(n);
        if (isPrimeRef(n)){ if (sd.rows.length !== 0 || sd.last !== n) fail('shortDivRows(' + n + ') divides a prime'); continue; }
        let v = n;
        sd.rows.forEach((row, i) => {
          if (row.v !== v) fail('shortDivRows(' + n + ') row ' + i + ' shows ' + row.v + ', expected ' + v);
          if (row.p !== spfRef(v)) fail('shortDivRows(' + n + ') row ' + i + ' divides by ' + row.p + ', the smallest prime factor of ' + v + ' is ' + spfRef(v));
          if (row.q !== v / row.p) fail('shortDivRows(' + n + ') row ' + i + ' quotient is wrong');
          v = v / row.p;
        });
        if (!isPrimeRef(sd.last) || sd.last !== v) fail('shortDivRows(' + n + ') stops at ' + sd.last + ', which is not the final prime quotient');
        if (!sameList(sd.atoms, factorizeRef(n))) fail('shortDivRows(' + n + ') atoms [' + sd.atoms + '] differ from [' + factorizeRef(n) + ']');
      }
      if (!sameList(data.S4_CASES, S4_CASES_REF)) fail('S4_CASES is [' + data.S4_CASES + ']');
      S4_CASES_REF.forEach(n => { if (data.shortDivRows(n).rows.length < 2) fail('S4 case ' + n + ' needs at least two divisions to show the method'); });

      /* ---- 7. 篩子板 ---- */
      if (data.S5_STEPS !== SIEVE_PRIMES_REF.length + 1) fail('S5_STEPS is ' + data.S5_STEPS);
      for (let stage = 0; stage <= SIEVE_PRIMES_REF.length; stage++){
        const st = data.sieveState(stage), ref = sieveRef(stage);
        if (st.cells.length !== SIEVE_N_REF) fail('sieveState(' + stage + ') has ' + st.cells.length + ' cells');
        st.cells.forEach((c, i) => {
          if (c.n !== ref[i].n || c.state !== ref[i].state || c.by !== ref[i].by) fail('sieveState(' + stage + ') cell ' + ref[i].n + ' is ' + c.state + '/' + c.by + ', expected ' + ref[i].state + '/' + ref[i].by);
        });
        const wantNow = stage > 0 ? SIEVE_PRIMES_REF[stage - 1] : null;
        if (st.now !== wantNow) fail('sieveState(' + stage + ').now is ' + st.now);
        if (st.primesLeft !== ref.filter(c => c.state === 'prime').length) fail('sieveState(' + stage + ').primesLeft is ' + st.primesLeft);
        if (st.crossedNow !== ref.filter(c => c.state === 'cross' && c.by === wantNow).length) fail('sieveState(' + stage + ').crossedNow is ' + st.crossedNow);
      }
      const finalPrimes = data.sieveState(SIEVE_PRIMES_REF.length).cells.filter(c => c.state === 'prime').map(c => c.n);
      if (!sameList(finalPrimes, sievePrimesRef(SIEVE_N_REF))) fail('after the last round the board shows [' + finalPrimes + '] as primes');

      /* ---- 8. 小遊戲 ---- */
      if (!Array.isArray(data.ROUNDS) || data.ROUNDS.length !== GAME_ROUNDS_REF) fail('ROUNDS has ' + (data.ROUNDS || []).length + ' rounds');
      const kinds = data.ROUNDS.map(r => r.kind);
      if (kinds.slice().sort().join() !== ['classify', 'factorization', 'missingLeaf', 'statement', 'whichPrime'].join()) fail('the five rounds are not one of each kind: ' + kinds);
      if (new Set(data.ROUNDS.map(r => r.ans)).size < 3) fail('the game answers sit in fewer than three different positions, so a child can learn the slot');
      Object.keys(GAME_TRUTH_REF).forEach(k => { if (data.STATEMENT_TRUTH[k] !== GAME_TRUTH_REF[k]) fail('STATEMENT_TRUTH.' + k + ' is ' + data.STATEMENT_TRUTH[k]); });
      if (Object.keys(data.STATEMENT_TRUTH).length !== Object.keys(GAME_TRUTH_REF).length) fail('STATEMENT_TRUTH has extra keys');
      data.ROUNDS.forEach((r, i) => {
        const tag = 'round ' + (i + 1) + ' (' + r.kind + ')';
        if (!Array.isArray(r.opts) || r.opts.length !== 4 || new Set(r.opts.map(String)).size !== 4) fail(tag + ': options are not four distinct');
        const idx = data.roundAnswerIndex(r);
        if (idx !== r.ans) fail(tag + ': roundAnswerIndex()=' + idx + ' but ans=' + r.ans);
        if (data.roundAnswer(r) === null) fail(tag + ': roundAnswer() is null');
        if (r.kind === 'whichPrime'){
          if (r.nums.filter(isPrimeRef).length !== 1) fail(tag + ': nums [' + r.nums + '] do not hold exactly one prime');
          if (!sameList(r.opts, r.nums)) fail(tag + ': opts differ from nums');
          if (r.opts[r.ans] !== r.nums.filter(isPrimeRef)[0]) fail(tag + ': the marked option is not the prime');
        }
        if (r.kind === 'classify'){
          if (r.n !== 1) fail(tag + ': this round is meant to test the number 1');
          if (r.opts[r.ans] !== 'neither') fail(tag + ': 1 must be "neither"');
        }
        if (r.kind === 'factorization'){
          if (r.opts[r.ans] !== factorizeRef(r.n).join(' × ')) fail(tag + ': the marked option is not the prime factorisation of ' + r.n);
          r.opts.forEach((o, oi) => {
            const parts = parseProduct(o);
            if (!parts) fail(tag + ': option "' + o + '" is not a product');
            else if (oi !== r.ans && parts.every(isPrimeRef) && productRef(parts) === r.n) fail(tag + ': distractor "' + o + '" is also correct');
          });
        }
        if (r.kind === 'missingLeaf'){
          const t = data.treePlan(r.n, r.pair, r.hide);
          const h = t.leaves.filter(l => l.hidden);
          if (h.length !== 1) fail(tag + ': hide=' + r.hide + ' hides ' + h.length + ' leaves');
          else if (r.opts[r.ans] !== r.n / productRef(t.leaves.filter(l => !l.hidden).map(l => l.v))) fail(tag + ': the marked option is not root ÷ shown leaves');
          if (r.pair[0] * r.pair[1] !== r.n) fail(tag + ': the first split does not multiply to ' + r.n);
          const fig = data.roundFig(r);
          if (!fig) fail(tag + ': roundFig() draws nothing');
          else treeProblems(tag + ' figure', fig, r.n, 1).forEach(fail);
        } else if (data.roundFig(r) !== null) fail(tag + ': only the missing-leaf round has a figure');
        if (r.kind === 'statement'){
          const trues = r.opts.filter(k => GAME_TRUTH_REF[k]);
          if (trues.length !== 1) fail(tag + ': ' + trues.length + ' true statements offered');
          if (r.opts.some(k => !(k in GAME_TRUTH_REF))) fail(tag + ': an option key is not in the truth table');
          if (r.opts[r.ans] !== trues[0]) fail(tag + ': the marked option is not the true statement');
        }
      });

      /* ---- 9. 字典函式真的跑起來：每一句旁白都渲染一次再掃 ---- */
      const strings = [];
      function add(text, lang, where){ strings.push({ text:String(text), lang, where }); }
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang];
        if (!d){ fail('I18N.' + lang + ' missing'); return; }
        S1_NUMS_REF.forEach(n => S1_ROWS_REF.forEach(r => {
          const pl = data.arrayPlan(n, r);
          add(d.s1cap(pl), lang, 's1cap'); add(d.s1narr(pl), lang, 's1narr'); add(d.s1calc(pl), lang, 's1calc'); add(d.s1result(pl), lang, 's1result');
          const k = kindRef(n);
          const want = lang === 'zh' ? (k === 'one' ? '既不是質數也不是合數' : (k === 'prime' ? '質數' : '合數')) : (k === 'one' ? 'neither prime nor composite' : k);
          if (d.s1result(pl).indexOf(want) < 0) fail('s1result(' + n + ') does not name ' + n + ' as ' + want + ': ' + d.s1result(pl));
          if (d.s1narr(pl).indexOf(want) < 0) fail('s1narr(' + n + ') never says ' + want);
          add(d.s1row(r), lang, 's1row');
        }));
        S2_CASES_REF.forEach(n => {
          const tr = data.trialRows(n);
          for (let step = 0; step <= 4; step++){
            add(d.s2narr(tr, step), lang, 's2narr'); add(d.s2calc(tr, step), lang, 's2calc'); add(d.s2result(tr, step), lang, 's2result');
            add(d.s2step(step), lang, 's2step');
          }
          tr.rows.forEach(row => { add(d.t2how(row, n), lang, 't2how'); add(d.t2yes(row), lang, 't2yes'); });
          const verdictText = d.s2result(tr, 4);
          const want = lang === 'zh' ? (tr.verdict === 'prime' ? '是質數' : '是合數') : ('is ' + tr.verdict);
          if (verdictText.indexOf(want) < 0) fail('s2result(' + n + ', 4) does not conclude "' + want + '": ' + verdictText);
        });
        S3_CASES_REF.forEach(n => data.pairsOf(n).forEach(pair => {
          const t = data.treePlan(n, pair);
          add(d.s3cap(t), lang, 's3cap'); add(d.s3narr(t), lang, 's3narr'); add(d.s3calc(t), lang, 's3calc'); add(d.s3result(t), lang, 's3result'); add(d.s3split(pair), lang, 's3split');
          if (d.s3result(t).indexOf(factorizeRef(n).join(' × ')) < 0) fail('s3result(' + n + ') does not print the prime factorisation');
        }));
        S4_CASES_REF.forEach(n => {
          const sd = data.shortDivRows(n);
          for (let step = 0; step <= sd.rows.length; step++){
            add(d.s4narr(sd, step), lang, 's4narr'); add(d.s4calc(sd, step), lang, 's4calc'); add(d.s4result(sd, step), lang, 's4result'); add(d.s4step(step, sd.rows.length), lang, 's4step');
          }
          if (d.s4result(sd, sd.rows.length).indexOf(factorizeRef(n).join(' × ')) < 0) fail('s4result(' + n + ') does not print the prime factorisation');
        });
        for (let stage = 0; stage <= SIEVE_PRIMES_REF.length; stage++){
          const st = data.sieveState(stage);
          add(d.s5narr(st), lang, 's5narr'); add(d.s5calc(st), lang, 's5calc'); add(d.s5result(st), lang, 's5result'); add(d.s5step(stage), lang, 's5step');
        }
        if (d.s5result(data.sieveState(4)).indexOf('15') < 0) fail('s5result never says there are 15 primes up to 50');
        data.ROUNDS.forEach(r => {
          add(d.gPrompt[r.kind](r), lang, 'gPrompt'); add(d.gHint1[r.kind], lang, 'gHint1'); add(d.gHint2[r.kind](r), lang, 'gHint2'); add(d.gCap[r.kind], lang, 'gCap');
          r.opts.forEach((o, i) => add(d.gOptText(r, i), lang, 'gOptText'));
        });
        add(d.gWrong(5), lang, 'gWrong'); add(d.gWrong(0), lang, 'gWrong'); add(d.gWin(90), lang, 'gWin');
        ['intro', 'scopeNote', 's1note', 's2note', 's3note', 's4note', 's5note', 'footer', 'next3'].forEach(k => add(d[k], lang, k));
      });
      strings.forEach(s => {
        if (!s.text.trim()) { if (s.where !== 'gCap') fail(s.where + ' rendered an empty string'); return; }
        stringProblems(s.text, s.lang, s.where).forEach(fail);
        arithAll(s.text).problems.forEach(m => fail(s.where + ': ' + m));
      });
      const NARRATED_COUNT_REF = 1034;
      if (strings.length !== NARRATED_COUNT_REF) fail('rendered ' + strings.length + ' dictionary strings, the reference pins ' + NARRATED_COUNT_REF);
      /* 遊戲第 1 關的兩層提示不可以把正解印出來（第一層是策略、第二層是接近答案）。 */
      ['zh', 'en'].forEach(lang => {
        const r1 = data.ROUNDS[0], d = I18N[lang];
        const p = String(data.roundAnswer(r1));
        if (new RegExp('(^|\\D)' + p + '(\\D|$)').test(d.gHint1[r1.kind])) fail(lang + ' gHint1 for round 1 prints the answer ' + p);
      });

      /* ---- 10. 題庫神諭：題數、整句題幹、正解原文、事實 ---- */
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
            stringProblems(q.stem, lang, bank + '[' + i + '] stem').forEach(fail);
            stringProblems(q.why, lang, bank + '[' + i + '] why').forEach(fail);
            q.opts.forEach(o => stringProblems(o, lang, bank + '[' + i + '] option').forEach(fail));
          });
        });
      });
      BANK_FACTS.forEach(f => {
        if ('prime' in f && isPrimeRef(f.n) !== f.prime) fail('bank fact: ' + f.n + ' prime=' + f.prime + ' is false');
        if (f.spf && spfRef(f.n) !== f.spf) fail('bank fact: smallest prime factor of ' + f.n + ' is ' + spfRef(f.n));
        if (f.atoms && !sameList(factorizeRef(f.n), f.atoms)) fail('bank fact: ' + f.n + ' factorises as [' + factorizeRef(f.n) + ']');
        if (f.between && PRIMES_200.filter(p => p > f.between[0] && p < f.between[1]).length !== f.count) fail('bank fact: primes between ' + f.between + ' are not ' + f.count);
      });
      /* 正解不可以全押同一格（verify_lesson_data 另有一條，這裡釘得更緊：三個題庫合起來要用到 ≥ 3 個位置） */
      const spread = new Set();
      Object.keys(BANK).forEach(bank => (I18N.zh[bank] || []).forEach(q => spread.add(q.ans)));
      if (spread.size < 3) fail('quiz answers use only ' + spread.size + ' positions');

      /* ---- 11. 跨頁釘樁 ---- */
      const renderedAll = strings.map(x => x.text).join('\n');
      const renderedDictCache = {};
      function renderedDictText(file){
        if (renderedDictCache[file] !== undefined) return renderedDictCache[file];
        const raw = RAW[file];
        let text = '';
        try {
          const i0 = raw.indexOf('var I18N = {'), i1 = raw.indexOf("var lang = 'zh';", i0);
          const dict = new Function(raw.slice(i0, i1) + '; return I18N;')();
          /* 先拿掉 HTML 註解：被註解掉的元素不是讀者看得到的綁定 */
          const markupLive = raw.slice(0, i0).replace(/<!--[\s\S]*?-->/g, '\n');
          const keys = [...new Set((markupLive.match(/data-i18n(?:-aria)?="([^"]+)"/g) || []).map(m => /"([^"]+)"/.exec(m)[1]))];
          ['zh', 'en'].forEach(lang => {
            keys.forEach(k => { if (typeof dict[lang][k] === 'string') text += dict[lang][k] + '\n'; });
            /* 表格列（krows／mrows／qrows／xrows）由 fillTable 渲染，全部算進來 */
            Object.keys(dict[lang]).forEach(k => { if (Array.isArray(dict[lang][k])) dict[lang][k].forEach(row => { text += (Array.isArray(row) ? row.join(' ') : String(row)) + '\n'; }); });
          });
        } catch (e){ fail(file + '.html: cannot execute its I18N dictionary to check what a reader sees: ' + e.message); text = ''; }
        renderedDictCache[file] = text;
        return text;
      }
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
        /* reference／parents：把字典**真的跑起來**，只算 markup 用 data-i18n 綁到的鍵（＋ fillTable 用的陣列）；
           一個沒有人引用的字典鍵不可以充數。review 的句子住在產生器裡，simgen 的 renderCheck 另外驗，
           這裡只能看原始碼（寫在這裡，不要讓下一個人以為 review 也是渲染過的）。 */
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
      HANDOFF.forEach(rule => {
        rule.files.forEach(f => {
          const text = TEXT[f];
          if (text === undefined) return;
          let at = -1;
          while ((at = text.indexOf(rule.word, at + 1)) >= 0){
            const clause = text.slice(at, at + 160).split(/[；。;!?]/)[0];
            const before = text.slice(Math.max(0, at - 40), at);
            if (!rule.near.some(n => clause.indexOf(n) >= 0 || before.indexOf(n) >= 0))
              fail(f + '.html mentions "' + rule.word + '" without saying where it belongs (expected one of ' + rule.near.join('/') + ' in the same clause)');
          }
        });
      });
      /* ⚠️ 要掃**拿掉註解之後**的程式碼：把 `drawDots(s1fig, pl);` 整行註解掉，字面還在、圖沒了。
         （這仍然是字面掃描：它擋不住「在那一行後面再蓋一次」，寫在 RENDER_PINS 的註解裡。） */
      RENDER_PINS.forEach(pin => {
        const code = RAW[pin.file] === undefined ? undefined : stripJsComments(RAW[pin.file]);
        if (code === undefined) return;
        let count = 0, at = -1;
        while ((at = code.indexOf(pin.text, at + 1)) >= 0) count++;
        if (count < pin.min) fail(pin.file + '.html no longer wires the drawing to the plan the checker measures: "' + pin.text.slice(0, 56) + '…" appears ' + count + ' time(s)');
      });
      /* 記錄最後上的課 */
      if (!/teachme-last[\s\S]{0,80}grade-6\/math\/prime\//.test(src)) fail('index.html does not record teachme-last for grade-6/math/prime/');

      /* ---- 12. 產生器清單：把 review.html 的 GENS 真的跑起來比 id；抽樣池逐字釘住 ---- */
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
        const rvLive = rv.replace(/\/\*[\s\S]*?\*\//g, '\n');
        REVIEW_PINS.forEach(p => { if (rvLive.indexOf(p) < 0) fail('review.html no longer contains the sampling line "' + p.slice(0, 60) + '…"'); });
        /* review 的 STATEMENTS 真值表要和這裡的一致 */
        Object.keys(TRUE_STATEMENTS_REF).forEach(k => {
          if (rvLive.indexOf(k + ':') < 0 || !new RegExp(k + ':\\s*\\{\\s*truth:true').test(rvLive)) fail('review.html does not mark "' + k + '" as true');
        });
        FALSE_KEYS_REF.forEach(k => { if (!new RegExp(k + ':\\s*\\{\\s*truth:false').test(rvLive)) fail('review.html does not mark "' + k + '" as false'); });
      }
    }
  },

  /* ================= 刻意改壞測試（tools/breaktest.js） =================
     ⚠️ `via` 跟著「斷言住在哪一支腳本」走：斷言在 data.check 裡的話，即使改的是 review.html／
        reference.html／parents.html，via 也要寫 index。
     ⚠️ 每一筆的 expect 都要是**第一個會響**的那一條訊息（或至少是同一次執行會印出的一條）。 */
  breaks: [
    /* --- 版面常數與畫布 --- */
    { file:'index', via:'index', expect:'layout constant DOT_Y0',
      find:'var DOT_FIG_H = 160, DOT_R = 7, DOT_GAP = 22, ROW_GAP = 24, DOT_Y0 = 22;',
      replace:'var DOT_FIG_H = 160, DOT_R = 7, DOT_GAP = 22, ROW_GAP = 24, DOT_Y0 = 2;',
      why:'the first row of dots would be cut off at the top' },
    { file:'index', via:'index', expect:'layout constant TREE_DY',
      find:'var TREE_H = 330, NODE_R = 20, TREE_Y0 = 30, TREE_DY = 64, NODE_FS = 17;',
      replace:'var TREE_H = 330, NODE_R = 20, TREE_Y0 = 30, TREE_DY = 80, NODE_FS = 17;',
      why:'a five-leaf tree would run off the bottom of the canvas' },
    { file:'index', via:'index', expect:'a canvas viewBox is',
      find:'<svg class="dotfig" id="s1fig" viewBox="0 0 460 160"',
      replace:'<svg class="dotfig" id="s1fig" viewBox="0 0 460 120"',
      why:'the dot figure would be drawn in a shorter coordinate system than it uses' },
    { file:'index', via:'index', expect:'in CSS but the viewBox is',
      find:'.treefig{width:100%;max-width:460px;height:330px;display:block;margin:0 auto}',
      replace:'.treefig{width:100%;max-width:460px;height:400px;display:block;margin:0 auto}',
      why:'the tree would be letterboxed inside a taller box' },

    /* --- 數論函式：兩套實作要一致 --- */
    { file:'index', via:'index', expect:'isPrime(4)=true',
      find:'for (var p = 2; p * p <= n; p++) if (n % p === 0) return false;',
      replace:'for (var p = 2; p * p < n; p++) if (n % p === 0) return false;',
      why:'perfect squares of primes (4, 9, 25, 49) would be called prime' },
    { file:'index', via:'index', expect:'kindOf(1)=composite',
      find:"function kindOf(n){ return n === 1 ? 'one' : (isPrime(n) ? 'prime' : 'composite'); }",
      replace:"function kindOf(n){ return n === 0 ? 'one' : (isPrime(n) ? 'prime' : 'composite'); }",
      why:'1 would be called composite' },
    { file:'index', via:'index', expect:'factorize(2)=',
      find:'for (var p = 2; p <= n; p++) if (n % p === 0) return p;',
      replace:'for (var p = 3; p <= n; p++) if (n % p === 0) return p;',
      why:'2 would never be found as a prime factor' },
    { file:'index', via:'index', expect:'treeOK(48)=false',
      find:"function treeOK(n){ return kindOf(n) === 'composite' && omega(n) <= 5; }",
      replace:"function treeOK(n){ return kindOf(n) === 'composite' && omega(n) <= 4; }",
      why:'the five-leaf trees would silently disappear from the domain' },
    { file:'index', via:'index', expect:'plEn is wrong',
      find:"    if (n === 1) return n + ' ' + w;\n    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');",
      replace:"    if (n === 0) return n + ' ' + w;\n    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');",
      why:'"1 factors" would be printed' },

    /* --- 試除法：「試到 7 就夠」是列舉出來的 --- */
    { file:'index', via:'index', expect:'trialRows(49) says prime',
      find:'self: n === p, div: n % p === 0 && n !== p, q: Math.floor(n / p), r: n % p,',
      replace:'self: n === p, div: n % p === 0 && n !== p && p !== 7, q: Math.floor(n / p), r: n % p,',
      why:'49, 77 and 91 would be called prime' },

    /* --- 圖：從畫出來的東西量回來 --- */
    { file:'index', via:'index', expect:'draws 0 dots for n=1',
      find:'var full = Math.floor(n / r), rem = n - full * r;',
      replace:'var full = Math.floor(n / r), rem = 0;',
      why:'the leftover dots would vanish, so 7 into 2 rows would look exact' },
    { file:'index', via:'index', expect:'leaves the canvas sideways',
      find:'var L = leaves.length, slotW = FIG_W / L;',
      replace:'var L = leaves.length, slotW = FIG_W / (L * 3);',
      why:'the tree would be squeezed into the left third and circles would overlap' },
    { file:'index', via:'index', expect:'is not prime, so the tree stopped too early',
      find:'var node = { v:v, depth:depth, leaf:isPrime(v), text:String(v) };',
      replace:'var node = { v:v, depth:depth, leaf:isPrime(v) || v === 4, text:String(v) };',
      why:'a 4 would be shown as an atom' },
    { file:'index', via:'index', expect:'shortDivRows(9) stops at 9',
      find:'while (!isPrime(v) && v > 1){ var p = smallestPrimeFactor(v); if (!p) break; rows.push({ p:p, v:v, q:v / p }); v = v / p; }',
      replace:'while (v % 2 === 0 && v > 1){ var p = smallestPrimeFactor(v); if (!p) break; rows.push({ p:p, v:v, q:v / p }); v = v / p; }',
      why:'short division would stop at the first odd quotient, prime or not' },
    { file:'index', via:'index', expect:'sieveState(2) cell 5 is prime',
      find:"if (c.state === 'plain' && stage >= SIEVE_PRIMES.length) c.state = 'prime';",
      replace:"if (c.state === 'plain' && stage >= 2) c.state = 'prime';",
      why:'undecided cells would light up green two rounds early' },

    /* --- 小遊戲 --- */
    { file:'index', via:'index', expect:'roundAnswerIndex()=1 but ans=0',
      find:"{ kind:'whichPrime', nums:[51, 53, 57, 63], opts:[51, 53, 57, 63], ans:1 },",
      replace:"{ kind:'whichPrime', nums:[51, 53, 57, 63], opts:[51, 53, 57, 63], ans:0 },",
      why:'the declared answer slot would disagree with the computed prime' },
    { file:'index', via:'index', expect:'STATEMENT_TRUTH.oneIsPrime is true',
      find:'var STATEMENT_TRUTH = { allOddPrime:false, oneIsPrime:false, primeTimesPrime:false, twoEvenPrime:true };',
      replace:'var STATEMENT_TRUTH = { allOddPrime:false, oneIsPrime:true, primeTimesPrime:false, twoEvenPrime:true };',
      why:'the game would accept "1 is the smallest prime"' },
    { file:'index', via:'index', expect:'gHint1 for round 1 prints the answer 53',
      find:"whichPrime:'質數只有 1 和自己兩個因數。先用 3 的規則（各位數字相加）掃一遍。',",
      replace:"whichPrime:'質數只有 1 和自己兩個因數。先用 3 的規則（各位數字相加）掃一遍。答案是 53。',",
      why:'the first-level hint would give the answer away' },

    /* --- 題庫神諭 --- */
    { file:'index', via:'index', expect:'qsAdv[1] zh marked option "20"',
      find:"opts:['20', '14', '100', '50'], ans:2,\n          why:'2 × 2 ＝ 4，5 × 5 ＝ 25，4 × 25 ＝ 100。",
      replace:"opts:['20', '14', '100', '50'], ans:0,\n          why:'2 × 2 ＝ 4，5 × 5 ＝ 25，4 × 25 ＝ 100。",
      why:'the answer key would point at a wrong option' },
    { file:'index', via:'index', expect:'qs[4] zh stem is not the pinned sentence',
      find:"stem:'<strong>24</strong> 的質因數分解是哪一個？',",
      replace:"stem:'<strong>25</strong> 的質因數分解是哪一個？',",
      why:'the question would ask about a different number while keeping the old answer' },
    { file:'index', via:'index', expect:'arithmetic is wrong',
      find:"why:'把原子乘回去：2 × 3 ＝ 6，6 × 5 ＝ 30。",
      replace:"why:'把原子乘回去：2 × 3 ＝ 6，6 × 5 ＝ 35。",
      why:'an explanation would teach a wrong product' },

    /* --- 渲染出來的字串 --- */
    { file:'index', via:'index', expect:'glues Chinese to a digit',
      find:"return '這一輪劃掉 ' + st.crossedNow + ' 個；目前確定的質數 ' + st.primesLeft + ' 個';",
      replace:"return '這一輪劃掉' + st.crossedNow + ' 個；目前確定的質數 ' + st.primesLeft + ' 個';",
      why:'Chinese and a digit would run together on screen' },
    { file:'index', via:'index', expect:'singular/plural slip',
      find:"s1row:function(r){ return plEn(r, 'row'); },",
      replace:"s1row:function(r){ return r + ' rows'; },",
      why:'"1 rows" would be printed on the chips' },
    { file:'index', via:'index', expect:'does not record teachme-last',
      find:"{p:'grade-6/math/prime/', zh:",
      replace:"{p:'grade-6/math/primes/', zh:",
      why:'the home page would resume into a dead link' },

    /* --- 跨頁釘樁 --- */
    { file:'index', via:'index', expect:'says "既不是質數也不是合數" 6 time(s)',
      find:'<strong>既不是質數也不是合數</strong> —— 它是唯一的例外。</p>',
      replace:'<strong>不是質數</strong> —— 它是唯一的例外。</p>',
      why:'the lesson would stop saying that 1 is not composite either' },
    { file:'index', via:'index', expect:'writes a power',
      find:'<strong>從小到大寫成連乘</strong>（2 × 2 × 3），不用次方。</p>',
      replace:'<strong>從小到大寫成連乘</strong>（2² × 3），不用次方。</p>',
      why:'a power would sneak into the scope note' },
    { file:'parents', via:'index', expect:'mentions "最大公因數" without saying where it belongs',
      find:'data-i18n="s1why">💡 為什麼值得花時間：質因數分解是<strong>下一課</strong>（用短除法',
      replace:'data-i18n="s1why">💡 為什麼值得花時間：質因數分解是（用短除法',
      why:'the GCF would be mentioned without handing it to the next lesson' },
    { file:'reference', via:'index', expect:'reference.html says "試 2、3、5、7" 6 time(s)',
      find:'<h2 data-i18n="s2h2">判斷質數：試除法，100 以內試 2、3、5、7</h2>',
      replace:'<h2 data-i18n="s2h2">判斷質數：試除法，100 以內試四個質數</h2>',
      why:'the cheat sheet would stop naming the four primes in its heading' },
    { file:'index', via:'index', expect:'no longer wires the drawing',
      find:'drawDots(s1fig, pl);',
      replace:'drawDots(s1fig, arrayPlan(n, 1));',
      why:'the figure would ignore the row chips while the text followed them' },

    /* --- review.html：設定檔從 index 那一側看的 --- */
    { file:'review', via:'index', expect:'no longer declares the generator "interGCF"',
      find:"{ id:'interGCF', cat:'inter',",
      replace:"{ id:'interGCF2', cat:'inter',",
      why:'a generator could be renamed or dropped and its invariants would silently stop running' },
    { file:'review', via:'index', expect:'no longer contains the sampling line',
      find:'(avoid || []).forEach(function(a){ seen[String(a)] = 1; });',
      replace:'(avoid || []).forEach(function(a){ });',
      why:'distractors could copy numbers straight out of the stem again' },
    { file:'review', via:'index', expect:'review.html says "neither prime nor composite" 2 time(s)',
      find:"en:'1 is neither prime nor composite' },",
      replace:"en:'1 is not prime and not composite' },",
      why:'the English wording of the rule about 1 would drift' },
    { file:'review', via:'index', expect:'does not mark "oneIsPrime" as false',
      find:'oneIsPrime:     { truth:false,',
      replace:'oneIsPrime:     { truth:true,',
      why:'"1 is the smallest prime" would become an accepted answer' },

    /* --- codex 第一輪審設定檔抓到的三個洞，各補一筆 --- */
    { file:'index', via:'index', expect:'options are not the pinned four',
      find:"opts:['21', '27', '29', '33'], ans:2,\n          why:'29 試除",
      replace:"opts:['31', '27', '29', '33'], ans:2,\n          why:'29 試除",
      why:'a distractor could quietly become a second correct answer (31 is prime)' },
    { file:'index', via:'index', expect:'no longer wires the drawing',
      find:'    drawDots(s1fig, pl);',
      replace:'    /* drawDots(s1fig, pl); */',
      why:'the pinned line would survive inside a comment while the figure went blank' },
    { file:'review', via:'review', expect:'is not one of the pinned statement texts',
      find:"allOddPrime:    { truth:false, zh:'所有的質數都是奇數', en:'Every prime number is odd' },",
      replace:"allOddPrime:    { truth:false, zh:'所有的質數都是奇數', en:'Every prime number is greater than 1' },",
      why:'a "false" sentence could be reworded into a true one and the child would see two correct options' },

    /* --- review.html：simgen 那一側 --- */
    { file:'review', via:'review', expect:'not odd composites',
      find:'var cands = shuffle(SNEAKY.filter(function(x){ return x >= 9; })).slice(0, 3);',
      replace:'var cands = shuffle(COMPOSITES).slice(0, 3);',
      why:'even distractors would give the prime away from the last digit' },
    { file:'review', via:'review', expect:'opts[ans] != correct',
      find:'opts: d.opts.slice(), ans:d.ans,',
      replace:'opts: d.opts.slice().reverse(), ans:d.ans,',
      why:'the rendered options would no longer match the answer index' },
    { file:'review', via:'review', expect:'outside 1..100',
      find:'var MAX_OPT = 100;',
      replace:'var MAX_OPT = 1000;',
      why:'a distractor such as 2 × the product could exceed the lesson\'s range' },
    { file:'review', via:'review', expect:'is out of range',
      find:'var o = numOpts(ps.length, [5, ps.length + 1, ps.length - 1, ps.length + 2], [a, b], 9);',
      replace:'var o = numOpts(ps.length, [5, ps.length + 1, ps.length - 1, ps.length + 12], [a, b], 20);',
      why:'a "how many primes" count could exceed the decade' }
  ],

  SIBLING_RULES: SIBLING_RULES,
  FORBIDDEN: FORBIDDEN,
  HANDOFF: HANDOFF,
  GEN_IDS: GEN_IDS,
  RENDER_PINS: RENDER_PINS,
  REVIEW_PINS: REVIEW_PINS,
  BANK: BANK,
  BANK_FACTS: BANK_FACTS,
  sievePrimesRef: sievePrimesRef,
  factorizeRef: factorizeRef,
  factorsRef: factorsRef,
  gcdRef: gcdRef,
  treeProblems: treeProblems,
  dotsProblems: dotsProblems,
  sieveRef: sieveRef,
  arithAll: arithAll,
  CLAIM_PROBES: CLAIM_PROBES
};
