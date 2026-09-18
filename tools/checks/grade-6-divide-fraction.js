/* grade-6/math/divide-fraction —— 倒數翻轉機（包含除、倒數、除以分數＝乘以倒數、商的大小、兩種應用題）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作，都不呼叫課程頁的函式：
 *
 * 1) 「最大公因數」與「最簡分數」。課程頁用輾轉相除（gcd）；這裡把兩個數各拆成質因數、每一個質數取小的次方相乘（gcdRef）。
 *    對 1 ~ 144 的每一對數都要同意。
 * 2) 「除以分數 ＝ 乘以倒數」。課程頁是 recip() 之後 mul()；這裡**直接交叉相乘**（divRef：a/b ÷ c/d ＝ ad/bc），
 *    而且對分子分母都在 1 ~ 12 的**每一對分數**（20736 組）比對兩條路的答案。
 * 3) 課程明講的四句話這裡是**列舉證明**，不是文案：
 *    - 「除以一個不是 0 的分數，等於乘以它的倒數」→ 對每一對 (x, y) 驗 divRef(x, y) ＝ mulRef(x, recipRef(y))。
 *    - 「被除數比 0 大時，除數比 1 小 → 商比被除數大；＝ 1 → 一樣；比 1 大 → 商比被除數小」→ 對每一對驗
 *      cmpRef(q, x) 的正負號剛好是 cmpRef(y, ONE) 的相反（這是把規則直接算出來，不是相信頁面的 quotientSide）。
 *    - 「兩個分數通分成同一個分母之後，分子相除就是商」→ 對每一對驗 (N/D) ÷ (C/D) ＝ N/C ＝ divRef(x, y)。
 *    - 「兩個數相乘等於 1 就互為倒數」→ 對每一個 x 驗 mulRef(x, recipRef(x)) ＝ 1。
 * 4) ⚠️ **從畫出來的圖量回來**：小格尺（barPlan）把每一格的 x、y、w、h 讀回來 —— 上面一列剛好 N 格、下面一列剛好 C 格、
 *    格子一樣大、等距、不重疊、含標籤都在畫布內；印成 SVG 字串（帶兩種語言裡最長的標籤）餵 lib/canvas.js 驗四個邊。
 *    對 1 ~ 18 × 1 ~ 18 的每一對都畫一次；放不下（任一邊 > 18）要 tooMany 而且一格都不畫（fail-closed）。
 *    翻轉的步驟表是 HTML，只驗資料。
 *
 * ⚠️ **這一課不能用 lib/arith.js**：那一份只認整數的算式，而這一課的每一句旁白都是分數算式
 *    （`3/4 ÷ 2/5 ＝ 3/4 × 5/2 ＝ 15/8`、`2/7 × 7/2 ＝ 14/14 ＝ 1`）。實測 lib/arith.js 會把 `3/4 ÷ 2/5` 讀成
 *    斷掉的鏈而誤報。所以這裡自己寫了一份**精確有理數**的求值器（fracArith）：先切出「算式鏈」，每一節用
 *    遞迴下降解析（* ÷ 先於 + －，左結合），再用分子分母整數比較。⚠️ 它**逐個等號記帳**：任何一個 `＝` 旁邊有數字
 *    卻沒有被某一條鏈吃掉，就報錯 —— 靜靜跳過等於替它背書。CLAIM_PROBES 每一次 verify_lesson_data 都重跑。
 * ⚠️ 選項的「值」一律化成最簡分數當鍵（`10/12` 和 `5/6` 是同一個值），數字後面可以帶單位（`4 段`／`4 pieces`）。
 * ⚠️ 兩個上限：分子分母都在 12 以內（LIMIT_REF），選項裡的分子分母在 144 以內（OPT_LIMIT_REF ＝ 12 × 12）。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const LIMIT_REF = 12, OPT_LIMIT_REF = 144, MAX_UNITS_REF = 18;
const FIG_W_REF = 460, BAR_H_REF = 130;
const U_REF = 21, UGAP_REF = 3, BAR_X0_REF = 20, ROW_A_Y_REF = 30, ROW_B_Y_REF = 90, LABEL_DY_REF = -8, LABEL_FS_REF = 14;
/* 每一個範例的案例，寫成 [分子, 分母, 分子, 分母] 的第二份 */
const S1_CASES_REF = [[3, 1, 1, 4], [2, 1, 1, 3], [3, 4, 1, 4], [2, 3, 1, 6]];
const S2_CASES_REF = [[2, 3], [5, 1], [1, 4], [8, 5]];
const S3_CASES_REF = [[3, 4, 2, 5], [1, 2, 3, 4], [5, 6, 2, 3], [4, 3, 2, 3]];
const S4_DIVIDEND_REF = [3, 4];
const S4_CASES_REF = [[1, 2], [2, 3], [1, 1], [3, 2]];
const S5_CASES_REF = [['ribbon', 'count', 3, 1, 3, 4], ['juice', 'count', 2, 1, 2, 5], ['paint', 'unit', 3, 1, 1, 2], ['sugar', 'unit', 4, 1, 2, 3]];
const GAME_ROUNDS_REF = 5;

/* ---------- 1) 數論：篩法找質數、質因數的次方取小 → 最大公因數 ---------- */
function sievePrimesRef(N){
  const flags = new Array(N + 1).fill(true);
  flags[0] = false; if (N >= 1) flags[1] = false;
  for (let p = 2; p * p <= N; p++){ if (!flags[p]) continue; for (let m = p * p; m <= N; m += p) flags[m] = false; }
  const out = []; for (let i = 2; i <= N; i++) if (flags[i]) out.push(i);
  return out;
}
const PRIMES = sievePrimesRef(2000);
function factorCountsRef(n){
  const m = {}; let v = n;
  for (const p of PRIMES){ while (v % p === 0){ m[p] = (m[p] || 0) + 1; v /= p; } if (v === 1) break; }
  if (v !== 1) return null;
  return m;
}
/* 最大公因數：每一個質數各取兩邊次方的小值，相乘（頁面用輾轉相除）。 */
function gcdRef(a, b){
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) return null;
  const ca = factorCountsRef(a), cb = factorCountsRef(b);
  if (!ca || !cb) return null;
  let g = 1;
  Object.keys(ca).forEach(p => { const k = Math.min(ca[p], cb[p] || 0); for (let i = 0; i < k; i++) g *= Number(p); });
  return g;
}
function isFracRef(x){ return !!x && Number.isInteger(x.n) && Number.isInteger(x.d) && x.n >= 1 && x.d >= 1; }
function simplifyRef(x){ if (!isFracRef(x)) return null; const g = gcdRef(x.n, x.d); return g === null ? null : { n:x.n / g, d:x.d / g }; }
function rawTextRef(x){ return !isFracRef(x) ? null : (x.d === 1 ? String(x.n) : x.n + '/' + x.d); }
function fracTextRef(x){ const s = simplifyRef(x); return s === null ? null : rawTextRef(s); }
function recipRef(x){ return !isFracRef(x) ? null : { n:x.d, d:x.n }; }
function mulRef(x, y){ return (!isFracRef(x) || !isFracRef(y)) ? null : simplifyRef({ n:x.n * y.n, d:x.d * y.d }); }
/* 除法**直接交叉相乘**，不走「先取倒數再相乘」那條路。 */
function divRef(x, y){ return (!isFracRef(x) || !isFracRef(y)) ? null : simplifyRef({ n:x.n * y.d, d:x.d * y.n }); }
/* 比大小：通分成同一個分母再比分子（頁面是交叉相乘）。 */
function cmpRef(x, y){
  if (!isFracRef(x) || !isFracRef(y)) return null;
  const D = x.d * y.d, a = x.n * y.d, b = y.n * x.d;
  if (!(D > 0)) return null;
  return a === b ? 0 : (a > b ? 1 : -1);
}
const ONE_REF = { n:1, d:1 };
function sameFrac(x, y){ const a = simplifyRef(x), b = simplifyRef(y); return !!(a && b && a.n === b.n && a.d === b.d); }
function sameList(a, b){ return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]); }
function plEnRef(n, w){ if (n === 1) return n + ' ' + w; return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's'); }

/* ---------- 2) 選項的解析：分數／整數，後面可以帶一個單位 ---------- */
const UNIT_RE_SRC = '(?: (段|瓶|條|公尺|公升|平方公尺|公斤|元|公里|小時|pieces?|bottles?|lengths?|metres?|litres?|square metres?|kilograms?|dollars?|kilometres?|hours?))?';
function parseOptRef(s){
  const m = new RegExp('^(\\d+)(?:\\/(\\d+))?' + UNIT_RE_SRC + '$').exec(String(s).trim());
  if (!m) return null;
  /* 前導零（`04`、`1/04`）是同一個值的另一種寫法：一律拒收，不然去重與抄題幹的檢查都可以被繞過。 */
  if (m[1] !== String(Number(m[1])) || (m[2] !== undefined && m[2] !== String(Number(m[2])))) return null;
  const n = Number(m[1]), d = m[2] === undefined ? 1 : Number(m[2]);
  if (!(n >= 1 && d >= 1)) return null;
  return { n:n, d:d, unit:(m[3] || '').replace(/s$/, '') };
}
/* 值的鍵：最簡分數 ＋ 單位。`10/12 段` 和 `5/6 段` 是同一個值。 */
function optKeyRef(s){
  const f = parseOptRef(s);
  if (f) return 'v:' + fracTextRef({ n:f.n, d:f.d }) + '|' + f.unit;
  return 'raw:' + String(s).replace(/\s+/g, '');
}

/* ---------- 3) 真值表：複習頁的句庫（12 句），兩種語言的原文 ---------- */
const TRUE_STATEMENTS_REF = {
  flipDivisor:      { zh:'除以一個不是 0 的分數，等於乘以它的倒數', en:'Dividing by a non-zero fraction is multiplying by its reciprocal' },
  recipProductOne:  { zh:'兩個數相乘等於 1，它們就互為倒數', en:'Two numbers whose product is 1 are reciprocals of each other' },
  divisorBelowOne:  { zh:'被除數比 0 大時，除數比 1 小，商就比被除數大', en:'With a dividend above 0, a divisor below 1 makes the quotient bigger than the dividend' },
  divisorOne:       { zh:'除以 1，商和被除數一樣', en:'Dividing by 1 leaves the quotient equal to the dividend' },
  sameDenNumerator: { zh:'兩個分數通分成同一個分母之後，分子相除就是商', en:'Once two fractions share a denominator, dividing the numerators gives the quotient' },
  wholeOverOne:     { zh:'整數 n 可以寫成 n/1，倒數是 1/n（n 不是 0）', en:'A whole number n can be written as n/1, with reciprocal 1/n (n not 0)' }
};
const FALSE_STATEMENTS_REF = {
  quotientSmaller:  { zh:'除法算出來的商一定比被除數小', en:'A quotient is always smaller than the dividend' },
  recipBigger:      { zh:'一個分數的倒數一定比它大', en:'The reciprocal of a fraction is always bigger than the fraction' },
  flipDividend:     { zh:'除以分數要把被除數翻過來再相乘', en:'To divide by a fraction you flip the dividend and multiply' },
  flipBoth:         { zh:'除以分數要把兩個分數都翻過來再相乘', en:'To divide by a fraction you flip both fractions and multiply' },
  zeroRecip:        { zh:'0 的倒數是 0', en:'The reciprocal of 0 is 0' },
  needCommonDen:    { zh:'分數除法一定要先通分才算得出來', en:'Fraction division only works if you find a common denominator first' }
};
const FALSE_KEYS_REF = Object.keys(FALSE_STATEMENTS_REF);
function statementTruthOfText(text, lang){
  for (const k of Object.keys(TRUE_STATEMENTS_REF)) if (TRUE_STATEMENTS_REF[k][lang] === text) return true;
  for (const k of FALSE_KEYS_REF) if (FALSE_STATEMENTS_REF[k][lang] === text) return false;
  return null;
}

/* ---------- 3b) 情境的名字（複習頁的第二份） ---------- */
const SCEN_REF = {
  zh: {
    ribbon: { tu:'公尺', pu:'公尺', ans:'段' }, juice: { tu:'公升', pu:'公升', ans:'瓶' }, rope: { tu:'公尺', pu:'公尺', ans:'條' },
    paint: { tu:'平方公尺', pu:'公升', ans:'平方公尺' }, sugar: { tu:'元', pu:'公斤', ans:'元' }, walk: { tu:'公里', pu:'小時', ans:'公里' }
  },
  en: {
    ribbon: { tu:'metre', pu:'metre', ans:'piece' }, juice: { tu:'litre', pu:'litre', ans:'bottle' }, rope: { tu:'metre', pu:'metre', ans:'length' },
    paint: { tu:'square metre', pu:'litre', ans:'square metre' }, sugar: { tu:'dollar', pu:'kilogram', ans:'dollar' }, walk: { tu:'kilometre', pu:'hour', ans:'kilometre' }
  }
};
const COUNT_IDS_REF = ['ribbon', 'juice', 'rope'];
const UNIT_IDS_REF = ['paint', 'sugar', 'walk'];
function ansTextRef(lang, id, t){
  const u = SCEN_REF[lang][id].ans;
  if (lang === 'zh') return t + ' ' + u;
  return t === '1' ? '1 ' + u : t + ' ' + u + (/(s|x|z|ch|sh)$/.test(u) ? 'es' : 's');
}
function amtTextRef(lang, unit, x){
  const t = rawTextRef(x);
  if (lang === 'zh') return t + ' ' + unit;
  return t === '1' ? '1 ' + unit : t + ' ' + unit + (/(s|x|z|ch|sh)$/.test(unit) ? 'es' : 's');
}

/* ---------- 4) 跨頁用詞釘樁：min 一律寫成**當下真實的出現次數**（拿掉註解之後、讀者看得到的文字） ---------- */
const SIBLING_RULES = [
  { file:'index',     text:'乘以它的倒數', min:7, why:'is the rule this lesson teaches' },
  { file:'reference', text:'乘以它的倒數', min:5, why:'is the rule this lesson teaches' },
  { file:'review',    text:'乘以它的倒數', min:2, why:'is the rule this lesson teaches' },
  { file:'parents',   text:'乘以它的倒數', min:2, why:'is the rule this lesson teaches' },
  { file:'index',     text:'分子和分母對調', min:5, why:'is how this lesson says a reciprocal is formed' },
  { file:'reference', text:'分子分母對調', min:4, why:'is how this lesson says a reciprocal is formed' },
  { file:'review',    text:'分子和分母對調', min:1, why:'is how this lesson says a reciprocal is formed' },
  { file:'index',     text:'裡面有幾個', min:22, why:'is how this lesson reads a division' },
  { file:'reference', text:'裡面有幾個', min:2, why:'is how this lesson reads a division' },
  { file:'parents',   text:'裡面有幾個', min:8, why:'is how this lesson reads a division' },
  { file:'index',     text:'除數比 1 小', min:4, why:'is the condition under which the quotient grows' },
  { file:'reference', text:'比 1 小', min:8, why:'is the condition under which the quotient grows' },
  { file:'parents',   text:'除數比 1 小', min:2, why:'is the condition under which the quotient grows' },
  { file:'index',     text:'multiplying by its reciprocal', min:4, why:'is the English rule this lesson teaches' },
  { file:'reference', text:'multiplying by its reciprocal', min:3, why:'is the English rule this lesson teaches' },
  { file:'review',    text:'multiplying by its reciprocal', min:2, why:'is the English rule this lesson teaches' },
  { file:'parents',   text:'multiplying by its reciprocal', min:1, why:'is the English rule this lesson teaches' },
  { file:'index',     text:'how many fit inside', min:5, why:'is the English reading of a division' },
  { file:'reference', text:'how many fit inside', min:1, why:'is the English reading of a division' },
  { file:'parents',   text:'how many fit inside', min:1, why:'is the English reading of a division' }
];
/* 一個字都不可以出現：次方寫法；帶分數（這一課一律寫假分數）；把迷思當事實寫出來的短句。 */
const FORBIDDEN = [
  { file:'index',     text:'²', why:'writes a power — this lesson never does' },
  { file:'reference', text:'²', why:'writes a power — this lesson never does' },
  { file:'review',    text:'²', why:'writes a power — this lesson never does' },
  { file:'parents',   text:'²', why:'writes a power — this lesson never does' },
  { file:'index',     text:' 又 ', why:'writes a mixed number — this lesson writes answers as improper fractions (3/2), never 1 又 1/2' },
  { file:'reference', text:' 又 ', why:'writes a mixed number — this lesson writes answers as improper fractions' },
  { file:'review',    text:' 又 ', why:'writes a mixed number — this lesson writes answers as improper fractions' },
  { file:'parents',   text:' 又 ', why:'writes a mixed number — this lesson writes answers as improper fractions' },
  { file:'index',     text:'除法一定會變小', why:'states the misconception as a fact' },
  { file:'reference', text:'除法一定會變小', why:'states the misconception as a fact' },
  { file:'parents',   text:'除法一定會變小', why:'states the misconception as a fact' },
];
/* 小數（`0.5`、`1.5`）一個都不可以出現在讀者看得到的文字裡：小數除法交給後面的課。 */
const DECIMAL_RE = /\d\.\d/;
/* 交給別課的詞，出現時同一個子句裡要說出它屬於哪一課。 */
const HANDOFF = [
  { word:'分數乘法', near:['五年級'], files:['index', 'reference', 'parents', 'review'] },
  { word:'分數大平分', near:['五年級'], files:['index', 'reference', 'parents'] },
  { word:'小數除法', near:['不在這一課'], files:['index', 'reference', 'parents'] },
  { word:'帶分數', near:['不在這一課', '不寫帶分數', '從來沒有'], files:['index', 'reference', 'parents'] },
  { word:'decimal division', near:['not in this lesson', 'not part of this lesson'], files:['index', 'reference', 'parents'] }
];

/* ---------- 5) 題庫神諭：整句題幹（zh／en）＋ 四個選項原文 ＋ 正解原文 ---------- */
const BANK = {
  qs:[
    { zh:'<strong>4</strong> 裡面有幾個 <strong>1/5</strong>？', en:'How many groups of <strong>1/5</strong> are there inside <strong>4</strong>?',
      opts:['4/5', '20', '9', '1/20'], ans:'20' },
    { zh:'<strong>2/7</strong> 的倒數是多少？', en:'What is the reciprocal of <strong>2/7</strong>?',
      opts:['2/7', '7/2', '1/2', '1/7'], ans:'7/2' },
    { zh:'<strong>3/4 ÷ 2/3</strong> 是多少？', en:'What is <strong>3/4 ÷ 2/3</strong>?',
      opts:['1/2', '9/8', '8/9', '2'], ans:'9/8' },
    { zh:'下面哪一個算式和 <strong>5/6 ÷ 2/3</strong> 相等？', en:'Which calculation is equal to <strong>5/6 ÷ 2/3</strong>?',
      opts:['5/6 × 2/3', '6/5 × 2/3', '5/6 × 3/2', '6/5 × 3/2'], ans:'5/6 × 3/2' },
    { zh:'<strong>5/8 ÷ 3/4</strong> 的商，和 <strong>5/8</strong> 比起來會怎樣？', en:'How does the quotient of <strong>5/8 ÷ 3/4</strong> compare with <strong>5/8</strong>?',
      optsZh:['商比 5/8 小', '商比 5/8 大', '商和 5/8 一樣大', '商剛好是 5/8 的一半'],
      optsEn:['smaller than 5/8', 'bigger than 5/8', 'equal to 5/8', 'exactly half of 5/8'],
      ansZh:'商比 5/8 大', ansEn:'bigger than 5/8' },
    { zh:'一條 <strong>2 公尺</strong>的緞帶，每 <strong>2/5 公尺</strong>剪一段，可以剪成幾段？', en:'A ribbon <strong>2 metres</strong> long is cut into pieces of <strong>2/5 of a metre</strong>. How many pieces are there?',
      optsZh:['4/5 段', '5 段', '10 段', '1/5 段'], optsEn:['4/5 pieces', '5 pieces', '10 pieces', '1/5 pieces'],
      ansZh:'5 段', ansEn:'5 pieces' }
  ],
  qsAdv:[
    { zh:'□ × <strong>3/4</strong> ＝ <strong>5/8</strong>，□ 是多少？', en:'□ × <strong>3/4</strong> = <strong>5/8</strong>. What is □?',
      opts:['15/32', '6/5', '5/6', '32/15'], ans:'5/6' },
    { zh:'<strong>2/3 公斤</strong>的糖賣 <strong>4 元</strong>。1 公斤的糖賣幾元？', en:'<strong>2/3 of a kilogram</strong> of sugar costs <strong>4 dollars</strong>. How much does 1 kilogram cost?',
      optsZh:['8/3 元', '6 元', '12 元', '1/6 元'], optsEn:['8/3 dollars', '6 dollars', '12 dollars', '1/6 dollars'],
      ansZh:'6 元', ansEn:'6 dollars' },
    { zh:'小明說：「除以分數，商一定比被除數大。」下面哪一句話的<strong>結論和理由都對</strong>？', en:'Ben says: “Dividing by a fraction always gives a quotient bigger than the dividend.” Which sentence has <strong>both the right conclusion and the right reason</strong>?',
      optsZh:['不對，除數比 1 大的時候商會比被除數小，例如 6/7 ÷ 3/2 ＝ 4/7，比 6/7 小', '對，因為除法就是把東西分開，分數又比 1 小', '對，因為除以分數要乘以倒數，倒數一定比 1 大', '不對，因為除以分數的時候商和被除數一定一樣大'],
      optsEn:['No: when the divisor is above 1 the quotient is smaller, for example 6/7 ÷ 3/2 = 4/7, which is below 6/7', 'Yes: dividing splits things up, and a fraction is below 1', 'Yes: dividing by a fraction means multiplying by a reciprocal, and a reciprocal is always above 1', 'No: when you divide by a fraction the quotient always equals the dividend'],
      ansZh:'不對，除數比 1 大的時候商會比被除數小，例如 6/7 ÷ 3/2 ＝ 4/7，比 6/7 小',
      ansEn:'No: when the divisor is above 1 the quotient is smaller, for example 6/7 ÷ 3/2 = 4/7, which is below 6/7' },
    { zh:'<strong>9/4 ÷ 3/8</strong> 是多少？', en:'What is <strong>9/4 ÷ 3/8</strong>?',
      opts:['27/32', '1/6', '6', '32/27'], ans:'6' }
  ],
  qsBoost:[
    { zh:'小華算 <strong>3/5 ÷ 1/2</strong>，寫成「3/5 × 1/2 ＝ 3/10」。他哪裡想錯了？', en:'Chloe works out <strong>3/5 ÷ 1/2</strong> as “3/5 × 1/2 = 3/10”. What has she got wrong?',
      optsZh:['他沒有錯，除以分數就是把兩個分數相乘', '要乘的是除數的倒數：1/2 的倒數是 2，3/5 × 2 ＝ 6/5', '應該把被除數翻過來：5/3 × 1/2 ＝ 5/6', '兩個分數都要翻過來：5/3 × 2 ＝ 10/3'],
      optsEn:['Nothing; dividing by a fraction means multiplying the two fractions', 'What gets multiplied is the reciprocal of the divisor: the reciprocal of 1/2 is 2, so 3/5 × 2 = 6/5', 'She should flip the dividend instead: 5/3 × 1/2 = 5/6', 'Both fractions should be flipped: 5/3 × 2 = 10/3'],
      ansZh:'要乘的是除數的倒數：1/2 的倒數是 2，3/5 × 2 ＝ 6/5',
      ansEn:'What gets multiplied is the reciprocal of the divisor: the reciprocal of 1/2 is 2, so 3/5 × 2 = 6/5' },
    { zh:'小美說：「3/4 ÷ 2 ＝ 3/8 變小了，所以 3/4 ÷ 1/2 也一定比 3/4 小。」她哪裡想錯了？', en:'Mia says: “3/4 ÷ 2 = 3/8 got smaller, so 3/4 ÷ 1/2 must be smaller than 3/4 too.” What has she got wrong?',
      optsZh:['她沒有錯，除法本來就會讓數變小', '除數 2 比 1 大才會變小；1/2 比 1 小，3/4 ÷ 1/2 ＝ 3/2，比 3/4 大', '3/4 ÷ 1/2 也是 3/8，和 3/4 ÷ 2 一樣', '除以分數的時候商和被除數一定一樣大'],
      optsEn:['Nothing; division always makes a number smaller', 'A divisor of 2 is above 1, which is why it shrinks; 1/2 is below 1, and 3/4 ÷ 1/2 = 3/2, bigger than 3/4', '3/4 ÷ 1/2 is also 3/8, the same as 3/4 ÷ 2', 'When you divide by a fraction the quotient always equals the dividend'],
      ansZh:'除數 2 比 1 大才會變小；1/2 比 1 小，3/4 ÷ 1/2 ＝ 3/2，比 3/4 大',
      ansEn:'A divisor of 2 is above 1, which is why it shrinks; 1/2 is below 1, and 3/4 ÷ 1/2 = 3/2, bigger than 3/4' }
  ]
};
/* 題庫裡的數字事實，各自獨立算一次。 */
const BANK_FACTS = [
  { div:[4, 1, 1, 5], q:'20' }, { recip:[2, 7], r:'7/2' }, { div:[3, 4, 2, 3], q:'9/8' },
  { div:[5, 8, 3, 4], q:'5/6' }, { div:[2, 1, 2, 5], q:'5' }, { div:[5, 8, 3, 4], side:1 },
  { div:[5, 6, 2, 3], q:'5/4' }, { div:[4, 1, 2, 3], q:'6' }, { div:[9, 4, 3, 8], q:'6' },
  { div:[6, 7, 3, 2], q:'4/7' }, { div:[6, 7, 3, 2], side:-1 }, { div:[3, 5, 1, 2], q:'6/5' },
  { div:[3, 4, 2, 1], q:'3/8' }, { div:[3, 4, 1, 2], q:'3/2' }, { mul:[3, 5, 1, 2], p:'3/10' }
];
const BANK_WHY_FINGERPRINT_REF = 'a254444267a7';

const GEN_IDS = ['containsUnit', 'reciprocal', 'divFrac', 'divWhole', 'compareSide', 'sameExpr',
                 'wordCount', 'wordUnit', 'missingFactor', 'trueStatement', 'interFracMul', 'interDivInt'];

/* plan → DOM 的接線。⚠️ 這是字面掃描，不是資料流分析：它只證明「畫圖那一行還在讀 plan」，證明不了 plan 之外沒有別的座標被畫上去；
   「剛好一次」也擋不住把畫布先存進別名再畫。真的要證明得在 DOM 裡跑一次，這裡沒有。 */
const RENDER_PINS = [
  { file:'index', text:'drawBars(s1fig, pl,', min:1, max:1 },
  { file:'index', text:'drawBars(s2fig, pl,', min:1, max:1 },
  { file:'index', text:'drawBars(s3fig, pl,', min:1, max:1 },
  { file:'index', text:'drawBars(s4fig, pl,', min:1, max:1 },
  { file:'index', text:'drawBars(s5fig, pl,', min:1, max:1 },
  { file:'index', text:'drawBars(gFig, fig,', min:1, max:1 },
  /* 每一個目標畫布只准畫一次 —— 不管畫的是哪一個 plan（把 plan 先存進別名再畫，上面那一組看不到，這一組看得到） */
  { file:'index', text:'drawBars(s1fig,', min:1, max:1 },
  { file:'index', text:'drawBars(s2fig,', min:1, max:1 },
  { file:'index', text:'drawBars(s3fig,', min:1, max:1 },
  { file:'index', text:'drawBars(s4fig,', min:1, max:1 },
  { file:'index', text:'drawBars(s5fig,', min:1, max:1 },
  { file:'index', text:'drawBars(gFig,', min:1, max:1 },
  { file:'index', text:'drawSteps(s3grid, F, s3step);', min:1, max:1 },
  { file:'index', text:"svg.appendChild(svgEl('rect', { x:c.x, y:c.y, width:c.w, height:c.h, rx:4, fill:c.row === 'a' ? C_A : C_B }));", min:1 },
  { file:'index', text:'var ansAt = roundAnswerIndex(round);', min:1 },
  { file:'index', text:'var fig = roundFigure(round);', min:1 },
  { file:'index', text:'var pl = s3step === 0 ? null : planFigure(sc.x, sc.y);', min:1 },
  /* 每一張畫布的識別字在程式碼裡出現的次數釘死（markup 的 id、getElementById 那一行的兩次、drawBars 那一次）：
     繞過 drawBars 直接往畫布 appendChild 的那一行會多出一次。⚠️ 仍然是字面掃描，改用別名（var t = s1fig）就看不到 */
  { file:'index', text:'s1fig', min:4, max:4 },
  { file:'index', text:'s2fig', min:4, max:4 },
  { file:'index', text:'s3fig', min:5, max:5 },
  { file:'index', text:'s4fig', min:4, max:4 },
  { file:'index', text:'s5fig', min:5, max:5 },
  { file:'index', text:"if (sc.kind === 'count'){ s5FigWrap.style.display = ''; drawBars(s5fig, pl, d.s5labelA(pl.a), d.s5labelB(pl.b)); }", min:1, max:1 },
  { file:'index', text:'gFig', min:10, max:10 }
];
/* review.html 的抽樣池與去重要逐字釘住：產生器自己的過濾會把改壞測試吸收掉。 */
const REVIEW_PINS = [
  'for (var n = 1; n <= LIMIT; n++) for (var d = 2; d <= LIMIT; d++) if (n !== d && gcd(n, d) === 1) FRACS.push(n + \'/\' + d);',
  "var POOL_SMALL = FRACS.filter(function(s){ var f = fracOf(s); return f.n <= 6 && f.d <= 6; });",
  "var POOL_PROPER = FRACS.filter(function(s){ var f = fracOf(s); return f.n < f.d && f.d <= 9; });",
  "var POOL_ANY = FRACS.filter(function(s){ var f = fracOf(s); return f.n <= 9 && f.d <= 9; });",
  'for (var k = 2; k <= 8; k++) POOL_UNIT.push(\'1/\' + k);',
  "if (!f || f.d < 1 || f.n < 1 || f.n > OPT_LIMIT || f.d > OPT_LIMIT) return;",
  '(avoidKeys || []).forEach(function(k){ seen[k] = 1; });',
  'var POOL_COUNT = POOL_PROPER.filter(function(s){ return fracOf(s).n <= 6; });',
  'var POOL_UNITQ = POOL_PROPER.filter(function(s){ return fracOf(s).n <= 9; });',
  "var m = pick([2, 3, 4, 5, 6].filter(function(v){ return v % y.n === 0; }));",
  "var POOL_DIVISOR = POOL_ANY.concat(['1/1']);",
  'var x = fracOf(pickUnused(POOL_ANY.slice(), used)), y = fracOf(pick(POOL_DIVISOR));',
  "var y = fracOf(pick(POOL_SMALL.filter(function(t){ var f = fracOf(t); return !(f.n === x.n && f.d === x.d); })));",
  'var m = pick([2, 3, 4, 5, 6, 7, 8, 9].filter(function(v){ return v % y.n === 0; }));'
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
    .replace(/(^|[^:'"])\/\/[^\n]*/g, '$1\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/&#(\d+);?/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);?/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)));
}
/* 讀者看得到的**文字**：readerText 之後再把標籤拆掉（會換行的補空白、行內的直接拿掉）——
   `商<strong>一定</strong>比被除數小` 在畫面上就是那一句迷思，字面掃描不可以被標籤擋住。 */
function visibleText(html){
  /* class 還在的時候先分類：條件說明（.cond）與步驟圓章（.sn／.bignum）在畫面上是分開的，補空白；其他 span 直接拿掉、不補空白 */
  return readerText(String(html).replace(/<span class="(?:sn|bignum|badge)"[^>]*>(\d*)<\/span>/g, ' $1 ').replace(/<span class="cond"[^>]*>([\s\S]*?)<\/span>/g, ' $1 '))
    .replace(/<\/?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|table|section|header|footer|nav)\b[^>]*>/gi, ' ')
    .replace(/<\/?span\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function stringProblems(s, lang, where){
  const out = [];
  const t = String(s);
  if (/undefined|NaN|\[object/.test(t)) out.push(where + ' leaks an internal value');
  const shown = t.replace(/<span class="cond">/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (lang === 'zh' && /\p{Script=Han}\d|\d\p{Script=Han}/u.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:\p{Script=Han}\d|\d\p{Script=Han}).{0,6}/u) || [''])[0]);
  if (lang === 'en' && /\b1 (cells|pieces|bottles|lengths|metres|litres|kilograms|dollars|kilometres|hours|cups|parts|times|points|fractions|numbers)\b/.test(shown)) out.push(where + ' has a singular/plural slip: ' + shown.match(/\b1 [a-z]+s\b/)[0]);
  if (lang === 'en' && /\b1 [a-z]+ (are|were|have)\b/.test(shown)) out.push(where + ' has a singular subject with a plural verb: ' + shown.match(/\b1 [a-z]+ (?:are|were|have)\b/)[0]);
  if (lang === 'en' && /\p{Script=Han}/u.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  /* 分數一律寫成 `n/d`（沒有空白）：`3 / 4` 不是這一課的寫法 */
  if (/\d\s{2,}\/|\/\s{2,}\d/.test(shown)) out.push(where + ' writes a fraction with stray spaces around the slash: ' + shown.match(/\d\s*\/\s*\d/)[0]);
  return out;
}

/* ---------- 6b) 算式逐條驗算：這一課自己的精確有理數求值器 ----------
   ⚠️ lib/arith.js 只認整數算式，這一課每一句旁白都是分數算式，所以不能用它（見檔頭）。
   做法：① 用一個「只由數／分數／運算子／等號／空白組成」的最長片段當**算式鏈**；
        ② 每一節用遞迴下降解析（× ÷ 先於 ＋ －，左結合），值用精確有理數；
        ③ 逐節比較，每一個等號記一次 verified；
        ④ 鏈裡有未知數（□／？）就算「題目式」，記在 questions，不當宣稱；
        ⑤ **沒有被任何一條鏈吃掉、而且兩邊都貼著數字的等號要報錯**（靜靜跳過等於替它背書）。
   ⚠️ 已知的極限（和 grade-6-ratio 同一條）：左邊不是數字的等號（`除數 ＝ 1`、`商 ＝ 15/8`）當成散文放行 ——
      前者是必要的（規則表就是這樣寫），後者因此驗不到，所以四頁一律寫成「商是 15/8」。 */
function rNorm(x){
  if (!x || !Number.isFinite(x.n) || !Number.isFinite(x.d) || x.d === 0) return null;
  let s = x.d < 0 ? -1 : 1, n = x.n * s, d = x.d * s;
  const g = (function e(a, b){ a = Math.abs(a); while (b){ const t = a % b; a = b; b = t; } return a || 1; })(n, d);
  return { n:n / g, d:d / g };
}
function rAdd(a, b){ return (a && b) ? rNorm({ n:a.n * b.d + b.n * a.d, d:a.d * b.d }) : null; }
function rSub(a, b){ return (a && b) ? rNorm({ n:a.n * b.d - b.n * a.d, d:a.d * b.d }) : null; }
function rMul(a, b){ return (a && b) ? rNorm({ n:a.n * b.n, d:a.d * b.d }) : null; }
function rDivR(a, b){ return (a && b && b.n !== 0) ? rNorm({ n:a.n * b.d, d:a.d * b.n }) : null; }
function rEq(a, b){ return !!(a && b) && a.n * b.d === b.n * a.d; }

const TERM_SRC = '(?:\\d+\\/\\d+|\\d+|[?？□])';
const OP_SRC = '[×*÷+＋\\-－−–]';
/* 括號也要讀得懂：`3/4 ÷ (2/5) ＝ 15/9` 沒有括號支援的話既不會被解析、也不會被回報（fail open）。 */
const ATOM_SRC = '(?:[()]\\s*)*' + TERM_SRC + '(?:\\s*[()])*';
const CHAIN_RE = new RegExp('(?<![\\d/.])' + ATOM_SRC + '(?:\\s*(?:' + OP_SRC + '|[＝=])\\s*' + ATOM_SRC + ')*(?![\\d/])', 'g');

function tokensOf(span){
  const toks = [];
  const re = /(\d+\/\d+|\d+|[?？□]|[×*]|÷|[+＋]|[\-－−–]|[＝=]|[()])/g;
  let m, last = 0;
  while ((m = re.exec(span)) !== null){
    if (span.slice(last, m.index).trim() !== '') return null;
    toks.push(m[0]); last = m.index + m[0].length;
  }
  return span.slice(last).trim() === '' ? toks : null;
}
function valueOfTok(t){
  let m = /^(\d+)\/(\d+)$/.exec(t); if (m) return rNorm({ n:Number(m[1]), d:Number(m[2]) });
  m = /^(\d+)$/.exec(t); if (m) return { n:Number(m[1]), d:1 };
  return null;
}
/* 遞迴下降：expr := term (('+'|'-') term)* ；term := factor (('×'|'÷') factor)* */
function parseSide(toks){
  let i = 0, err = null;
  function factor(){
    const t = toks[i];
    if (t === undefined){ err = err || 'an operand is missing'; return null; }
    if (t === '('){
      i++;
      const v = expr();
      if (toks[i] !== ')'){ err = err || 'an unclosed bracket'; return null; }
      i++;
      return v;
    }
    i++;
    const v = valueOfTok(t);
    if (v === null) err = err || ('cannot read the operand "' + t + '"');
    return v;
  }
  function term(){
    let v = factor();
    while (i < toks.length && /^[×*÷]$/.test(toks[i])){
      const op = toks[i++]; const r = factor();
      if (op === '÷'){ const q = rDivR(v, r); if (q === null && r && r.n === 0) err = err || 'division by zero'; v = q; }
      else v = rMul(v, r);
    }
    return v;
  }
  function expr(){
    let v = term();
    while (i < toks.length && /^[+＋\-－−–]$/.test(toks[i])){
      const op = toks[i++]; const r = term();
      v = /^[+＋]$/.test(op) ? rAdd(v, r) : rSub(v, r);
    }
    return v;
  }
  const v = expr();
  if (i !== toks.length) err = err || 'the expression did not parse to the end';
  return { v:v, err:err };
}
function fracArith(text){
  const problems = [];
  let verified = 0, questions = 0;
  const plain = String(text).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  let rest = plain;
  const consumed = [];
  rest = rest.replace(CHAIN_RE, (whole, ...rx) => {
    const at = rx[rx.length - 2], full = rx[rx.length - 1];
    if (!/[＝=]/.test(whole)) return whole;                    /* 沒有等號 → 只是名詞，不是宣稱 */
    /* ⚠️ 散文的括號會被一起吃進來（`（3/4 × 2/3 ＝ 1/2）` 的收尾括號）：
       先把**邊緣不成對**的括號剝掉，剝完才是真正的算式；剝不掉就照樣往下解析並回報。 */
    let span = whole;
    for (let guard = 0; guard < 8; guard++){
      const opens = (span.match(/\(/g) || []).length, closes = (span.match(/\)/g) || []).length;
      if (opens === closes) break;
      /* ⚠️ 只剝**結尾**多出來的 `)`，而且要**前面的散文真的開過一個括號**才剝
         （`(你要看到 3/8 × 8/3 = 1)` 剝；`3/4 × 2/3 ＝ 1/2)` 不剝，那是寫壞了，要讓 parseSide 報出來）。
         開頭多出來的 `(` 一律不剝。 */
      const before = String(full).slice(0, at);
      const proseOpen = (before.match(/\(/g) || []).length > (before.match(/\)/g) || []).length;
      if (closes > opens && proseOpen && /\)\s*$/.test(span)) span = span.replace(/\s*\)\s*$/, '');
      else break;
    }
    /* 整條鏈被一對括號包起來（散文的 `（3/4 × 2/3 ＝ 1/2）`）：那一對也要剝掉，
       不然切等號之後兩邊各剩半個括號。只有在那一對真的**互相配對**的時候才剝。 */
    for (let guard = 0; guard < 8; guard++){
      const t = span.trim();
      if (!(t.startsWith('(') && t.endsWith(')'))) break;
      let depth = 0, matches = true;
      for (let k = 0; k < t.length; k++){
        if (t[k] === '(') depth++;
        else if (t[k] === ')'){ depth--; if (depth === 0 && k !== t.length - 1){ matches = false; break; } }
      }
      if (!matches || depth !== 0) break;
      span = t.slice(1, -1);
    }
    if (!/[＝=]/.test(span)) return whole;
    consumed.push(span);
    const sides = span.split(/[＝=]/).map(s => s.trim());
    if (sides.some(s => /[?？□]/.test(s))){ questions++; return ' Q '; }
    const vals = sides.map(s => { const tk = tokensOf(s); return tk === null ? { v:null, err:'cannot tokenise "' + s + '"' } : parseSide(tk); });
    vals.forEach(r => { if (r.err) problems.push(r.err + ' in "' + span + '"'); });
    for (let k = 1; k < vals.length; k++){
      verified++;
      if (!rEq(vals[k - 1].v, vals[k].v)) problems.push('this claim is wrong: "' + span + '"');
    }
    return ' Q ';
  });
  /* 沒有被任何一條鏈吃掉、而且**左邊收在數字或右括號**的等號：fail closed。
     ⚠️ 左邊不是數字的等號（`除數 ＝ 1`、`商 ＝ 15/8`）當散文放行 —— 規則表就是那樣寫的。
        這是這支驗算器**唯一**的 fail-open，四頁因此一律把結果寫成「商是 …」而不是「商 ＝ …」。 */
  const leftover = rest.match(/[\d)）]\s*[＝=]\s*[\d(（]?/g);
  if (leftover) problems.push('an equals sign with a number on its left was not verified: "' + leftover[0].trim() + '"');
  return { problems, verified, questions, consumed };
}
/* 驗算器自己的 PROBE：bad:false 必須零誤報，bad:true 一定要抓到。 */
const CLAIM_PROBES = [
  { text:'3 ÷ 1/4 ＝ 12', bad:false },
  { text:'2/7 × 7/2 ＝ 14/14 ＝ 1', bad:false },
  { text:'3/4 ÷ 2/5 ＝ 3/4 × 5/2 ＝ 15/8', bad:false },
  { text:'5/8 ÷ 3/4 ＝ 5/8 × 4/3 ＝ 20/24 ＝ 5/6', bad:false },
  { text:'4 ÷ 2/3 ＝ 4 × 3/2 ＝ 12/2 ＝ 6 元', bad:false },
  { text:'The reciprocal of 3/8 is 8/3, and 9/4 × 8/3 = 72/12 = 6.', bad:false },
  { text:'用 4 × 5 ＝ 20 當共同的分母', bad:false },
  { text:'分子 15 ＝ 3 × 5，分母 8 ＝ 2 × 4', bad:false },
  { text:'一格是 1/20。上面 15 格是 3/4，下面 8 格是 2/5。', bad:false },
  { text:'除數 ＝ 1 → 不變', bad:false },
  { text:'整數 n 可以寫成 n/1，倒數是 1/n', bad:false },
  { text:'3/4 ÷ 1/2 也是 3/8，和 3/4 ÷ 2 一樣', bad:false },
  { text:'6/7 ÷ 3/2 ＝ 6/7 × 2/3 ＝ 12/21 ＝ 4/7', bad:false },
  { text:'a/b ÷ c/d ＝ a/b × d/c', bad:false },
  { text:'□ × 3/4 ＝ 5/8', bad:false },
  { text:'3 ÷ 1/4 ＝ 11', bad:true },
  { text:'2/7 × 7/2 ＝ 14/14 ＝ 2', bad:true },
  { text:'3/4 ÷ 2/5 ＝ 3/4 × 5/2 ＝ 15/9', bad:true },
  { text:'5/8 ÷ 3/4 ＝ 5/8 × 3/4', bad:true },
  { text:'4 × 3/2 ＝ 12/2 ＝ 7', bad:true },
  { text:'9/4 × 8/3 = 72/12 = 5', bad:true },
  { text:'4 × 5 ＝ 21', bad:true },
  { text:'3/5 × 2 ＝ 6/10', bad:true },
  { text:'12 ＝ 3 × 5', bad:true },
  { text:'5 ÷ 0 ＝ 5', bad:true },
  { text:'2 ÷ 2/5 ＝ 2 × 5/2 ＝ 10/2 ＝ 4', bad:true },
  { text:'3/4 × 3/2 ＝ 9/8', bad:false },
  { text:'3/4 ÷ (2/5) ＝ 15/8', bad:false },
  { text:'(1 ＋ 1) × 3 ＝ 6', bad:false },
  { text:'3/4 ÷ (2/5) ＝ 15/9', bad:true },
  { text:'1 ＝ 1；3/4 ÷ (2/5) ＝ 15/9', bad:true },
  { text:'商 ＝ 15/9', bad:false },
  { text:'(3/4 × 2/3 = 6/12 = 1/2)', bad:false },
  { text:'（3/4 × 2/3 ＝ 6/12 ＝ 1/3）', bad:true },
  { text:'(2 × 3) ÷ (3/2) ＝ 4', bad:false },
  { text:'(2 × 3) ÷ (3/2) ＝ 5', bad:true },
  { text:'(3/4 ÷ 2/5 ＝ 15/8', bad:true },
  { text:'(you want 3/8 × 8/3 = 1)', bad:false },
  { text:'3/8 × 8/3 = 1)', bad:true },
  { text:'3/4 × 2/3 = 1/2)', bad:true },
  { text:'6/5 × 1/2 ＝ 6/10 ＝ 3/5', bad:false }
];

/* ---------- 7) 從畫出來的圖量回來：小格尺 ---------- */
function svgOfBars(pl, labelA, labelB){
  const rects = pl.cells.map(c => '<rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '" rx="4"/>').join('');
  const texts = pl.labels.map(lb => '<text x="' + lb.x + '" y="' + lb.y + '" font-size="' + LABEL_FS_REF + '" text-anchor="start">' + (lb.row === 'a' ? labelA : labelB) + '</text>').join('');
  return '<svg viewBox="0 0 ' + pl.w + ' ' + pl.h + '" width="' + pl.w + '" height="' + pl.h + '">' + rects + texts + '</svg>';
}
function barProblems(tag, pl, a, b, labelA, labelB){
  const out = [];
  if (!pl || !Array.isArray(pl.cells) || !Array.isArray(pl.labels)){ out.push(tag + ': barPlan is not shaped like a plan'); return out; }
  if (pl.w !== FIG_W_REF || pl.h !== BAR_H_REF) out.push(tag + ': canvas is ' + pl.w + 'x' + pl.h + ', expected ' + FIG_W_REF + 'x' + BAR_H_REF);
  if (pl.a !== a || pl.b !== b) out.push(tag + ': plan says it is for ' + pl.a + ',' + pl.b);
  const tooMany = !(Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b >= 1 && a <= MAX_UNITS_REF && b <= MAX_UNITS_REF);
  if (pl.tooMany !== tooMany) out.push(tag + ': tooMany flag is ' + pl.tooMany + ', the reference says ' + tooMany);
  if (tooMany){ if (pl.cells.length !== 0) out.push(tag + ': tooMany but ' + pl.cells.length + ' cells were still planned'); return out; }
  const rows = { a:[], b:[] };
  pl.cells.forEach((c, i) => {
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.w) || !Number.isFinite(c.h)){ out.push(tag + ': cell ' + i + ' has a non-numeric coordinate'); return; }
    if (c.w !== U_REF || c.h !== U_REF) out.push(tag + ': cell ' + i + ' is ' + c.w + 'x' + c.h + ', not a ' + U_REF + ' square');
    if (c.row !== 'a' && c.row !== 'b') out.push(tag + ': cell ' + i + ' is in row "' + c.row + '"');
    else rows[c.row].push(c);
    if (c.x < 0 || c.x + c.w > FIG_W_REF || c.y < 0 || c.y + c.h > BAR_H_REF) out.push(tag + ': cell ' + i + ' leaves the canvas');
  });
  if (rows.a.length !== a) out.push(tag + ': the top bar has ' + rows.a.length + ' cells for the dividend ' + a);
  if (rows.b.length !== b) out.push(tag + ': the bottom bar has ' + rows.b.length + ' cells for the divisor ' + b);
  [['a', rows.a, ROW_A_Y_REF], ['b', rows.b, ROW_B_Y_REF]].forEach(([row, cells, y]) => {
    cells.sort((p, q) => p.x - q.x);
    cells.forEach((c, i) => {
      if (c.y !== y) out.push(tag + ': a cell of row ' + row + ' sits at y=' + c.y + ', the row is at ' + y);
      const wantX = BAR_X0_REF + i * (U_REF + UGAP_REF);
      if (c.x !== wantX) out.push(tag + ': cell ' + i + ' of row ' + row + ' is at x=' + c.x + ', expected ' + wantX + ' (equal spacing from the left)');
      if (i > 0 && c.x < cells[i - 1].x + cells[i - 1].w + UGAP_REF - 1e-9) out.push(tag + ': cells ' + (i - 1) + ' and ' + i + ' of row ' + row + ' overlap or touch');
    });
  });
  /* ⚠️ 用 plan 自己交出來的座標量，不是用參考常數互相比（那是恆等式）。
     這一條沒有獨立的改壞測試：任何把 y 座標改掉的改壞，都會先撞上上面的版面常數釘樁。 */
  if (rows.a.length && rows.b.length && pl.labels.length === 2){
    const lbB = pl.labels.find(l => l.row === 'b');
    const topBottom = Math.max.apply(null, rows.a.map(c => c.y + c.h));
    if (lbB && (lbB.y - LABEL_FS_REF) < topBottom)
      out.push(tag + ': the lower label would overlap the upper bar (label top ' + (lbB.y - LABEL_FS_REF) + ' vs bar bottom ' + topBottom + ')');
  }
  if (pl.labels.length !== 2) out.push(tag + ': ' + pl.labels.length + ' labels, expected 2');
  else {
    const la = pl.labels.find(l => l.row === 'a'), lb = pl.labels.find(l => l.row === 'b');
    if (!la || !lb) out.push(tag + ': labels are not one per row');
    else {
      if (la.x !== BAR_X0_REF || lb.x !== BAR_X0_REF) out.push(tag + ': labels are not left-aligned with the bars');
      if (la.y !== ROW_A_Y_REF + LABEL_DY_REF || lb.y !== ROW_B_Y_REF + LABEL_DY_REF) out.push(tag + ': labels are not just above their bars');
      if (la.y - LABEL_FS_REF < 0) out.push(tag + ': the top label would be cut off at the top of the canvas');
    }
  }
  /* ⚠️ 這裡餵給 lib/canvas.js 的是**從 plan 印出來的** SVG，不是 drawBars 真的畫出來的節點。
     它證明得了「這一份座標放得進畫布」，證明不了「畫面上真的有這些格子」——
     用 CSS 把 rect 藏起來、或在畫完之後用別名改 DOM，這裡都看不到。
     下面 data.check 的 CSS 掃描擋掉「把圖藏起來」那一種；別名改 DOM 仍然是已知的極限。 */
  canvasProblems(svgOfBars(pl, labelA, labelB)).forEach(m => out.push(tag + ' canvas: ' + m));
  return out;
}

/* ---------- 8) 整句題幹重建：每一支產生器、每一種語言各一份。多一個字少一個字都對不上。 ---------- */
function stemRef(genId, d, lang){
  const zh = lang === 'zh';
  switch (genId){
    case 'containsUnit': {
      const y = rawTextRef({ n:1, d:d.k });
      return zh ? '<strong>' + d.a + '</strong> 裡面有幾個 <strong>' + y + '</strong>？'
                : 'How many groups of <strong>' + y + '</strong> are there inside <strong>' + d.a + '</strong>?';
    }
    case 'reciprocal': {
      const x = rawTextRef({ n:d.n, d:d.d });
      return zh ? '<strong>' + x + '</strong> 的<strong>倒數</strong>是多少？' : 'What is the <strong>reciprocal</strong> of <strong>' + x + '</strong>?';
    }
    case 'divFrac': {
      const x = rawTextRef({ n:d.xn, d:d.xd }), y = rawTextRef({ n:d.yn, d:d.yd });
      return zh ? '<strong>' + x + ' ÷ ' + y + '</strong> 是多少？（寫成最簡分數）' : 'What is <strong>' + x + ' ÷ ' + y + '</strong>? (simplest form)';
    }
    case 'divWhole': {
      const y = rawTextRef({ n:d.yn, d:d.yd });
      return zh ? '<strong>' + d.m + ' ÷ ' + y + '</strong> 是多少？（寫成最簡分數）' : 'What is <strong>' + d.m + ' ÷ ' + y + '</strong>? (simplest form)';
    }
    case 'compareSide': {
      const x = rawTextRef({ n:d.xn, d:d.xd }), y = rawTextRef({ n:d.yn, d:d.yd });
      return zh ? '<strong>' + x + ' ÷ ' + y + '</strong> 的商，和被除數 <strong>' + x + '</strong> 比起來會怎樣？'
                : 'How does the quotient of <strong>' + x + ' ÷ ' + y + '</strong> compare with the dividend <strong>' + x + '</strong>?';
    }
    case 'sameExpr': {
      const x = rawTextRef({ n:d.xn, d:d.xd }), y = rawTextRef({ n:d.yn, d:d.yd });
      return zh ? '下面哪一個算式和 <strong>' + x + ' ÷ ' + y + '</strong> 相等？' : 'Which calculation is equal to <strong>' + x + ' ÷ ' + y + '</strong>?';
    }
    case 'wordCount': {
      const s = SCEN_REF[lang][d.id], x = { n:d.m, d:1 }, y = { n:d.yn, d:d.yd };
      const A = amtTextRef(lang, s.tu, x), B = amtTextRef(lang, s.pu, y);
      return {
        zh:{ ribbon:'一條 <strong>' + A + '</strong>的緞帶，每 <strong>' + B + '</strong>剪一段，可以剪成幾段？',
             juice:'<strong>' + A + '</strong>的果汁，每一瓶裝 <strong>' + B + '</strong>，可以裝成幾瓶？',
             rope:'一條 <strong>' + A + '</strong>的繩子，每 <strong>' + B + '</strong>綁成一條，可以綁成幾條？' },
        en:{ ribbon:'A ribbon <strong>' + A + '</strong> long is cut into pieces of <strong>' + B + '</strong>. How many pieces are there?',
             juice:'<strong>' + A + '</strong> of juice is poured into bottles holding <strong>' + B + '</strong> each. How many bottles are filled?',
             rope:'A rope <strong>' + A + '</strong> long is tied into lengths of <strong>' + B + '</strong>. How many lengths are there?' }
      }[lang][d.id];
    }
    case 'wordUnit': {
      const s = SCEN_REF[lang][d.id], x = { n:d.m, d:1 }, y = { n:d.yn, d:d.yd };
      const A = amtTextRef(lang, s.tu, x), B = amtTextRef(lang, s.pu, y);
      return {
        zh:{ paint:'<strong>' + B + '</strong>的油漆剛好漆完 <strong>' + A + '</strong>的牆。1 ' + s.pu + '的油漆可以漆幾' + s.tu + '？',
             sugar:'<strong>' + B + '</strong>的糖賣 <strong>' + A + '</strong>。1 ' + s.pu + '的糖賣幾' + s.tu + '？',
             walk:'走 <strong>' + B + '</strong>剛好走了 <strong>' + A + '</strong>。1 ' + s.pu + '走幾' + s.tu + '？' },
        en:{ paint:'<strong>' + B + '</strong> of paint covers exactly <strong>' + A + '</strong> of wall. How many square metres does 1 litre cover?',
             sugar:'<strong>' + B + '</strong> of sugar costs <strong>' + A + '</strong>. How much does 1 kilogram cost?',
             walk:'Walking for <strong>' + B + '</strong> covers exactly <strong>' + A + '</strong>. How far is walked in 1 hour?' }
      }[lang][d.id];
    }
    case 'missingFactor': {
      const y = rawTextRef({ n:d.yn, d:d.yd }), p = rawTextRef({ n:d.pn, d:d.pd });
      return zh ? '□ × <strong>' + y + '</strong> ＝ <strong>' + p + '</strong>，□ 是多少？' : '□ × <strong>' + y + '</strong> = <strong>' + p + '</strong>. What is □?';
    }
    case 'trueStatement':
      return zh ? '下面四句話，<strong>只有一句是對的</strong>。是哪一句？' : 'Of these four sentences, <strong>exactly one is true</strong>. Which?';
    case 'interFracMul': {
      const x = rawTextRef({ n:d.xn, d:d.xd }), y = rawTextRef({ n:d.yn, d:d.yd });
      return zh ? '（五年級）<strong>' + x + ' × ' + y + '</strong> 是多少？（寫成最簡分數）' : '(Grade five) What is <strong>' + x + ' × ' + y + '</strong>? (simplest form)';
    }
    case 'interDivInt': {
      const x = rawTextRef({ n:d.xn, d:d.xd });
      return zh ? '（五年級）<strong>' + x + ' ÷ ' + d.k + '</strong> 是多少？（寫成最簡分數）' : '(Grade five) What is <strong>' + x + ' ÷ ' + d.k + '</strong>? (simplest form)';
    }
    default: return null;
  }
}
/* 「商和被除數比」的四個結論，兩種語言的原文（頁面與設定檔各有一份）。 */
const SIDE_TEXT_REF = {
  zh:{ bigger:'商比被除數大', smaller:'商比被除數小', same:'商和被除數一樣大', cannot:'沒辦法比較' },
  en:{ bigger:'the quotient is bigger than the dividend', smaller:'the quotient is smaller than the dividend', same:'the quotient equals the dividend', cannot:'it is impossible to tell' }
};

/* ---------- 9) 產生器：不變條件的共用檢查 ---------- */
function fourDistinct(id, d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return id + ': options are not four';
  if (!(d.ans >= 0 && d.ans < 4)) return id + ': ans index out of range';
  if (new Set(d.opts.map(String)).size !== 4) return id + ': options repeat a string: ' + d.opts;
  return null;
}
function distinctValues(id, opts){
  const keys = opts.map(optKeyRef);
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
    if (keys[i] === keys[j]) return id + ': two options have the same value: ' + opts[i] + ' / ' + opts[j];
  return null;
}
/* 選項是「最簡分數／整數」：範圍、最簡、沒有單位 */
function bareFracProblems(id, opts){
  for (const o of opts){
    const p = parseOptRef(o);
    if (!p) return id + ': option "' + o + '" is not a bare fraction or whole number';
    if (p.unit) return id + ': option "' + o + '" carries a unit';
    if (p.n > OPT_LIMIT_REF || p.d > OPT_LIMIT_REF) return id + ': option "' + o + '" leaves 1..' + OPT_LIMIT_REF;
    if (gcdRef(p.n, p.d) !== 1) return id + ': option "' + o + '" is not in simplest form';
  }
  return null;
}
function termProblems(id, x){
  if (!(isFracRef(x) && x.n <= LIMIT_REF && x.d <= LIMIT_REF)) return id + ': (' + (x && x.n) + '/' + (x && x.d) + ') is not a fraction with both parts in 1..' + LIMIT_REF;
  return null;
}
/* 抄題幹：誘答不可以等於題幹印出來的數 */
function echoProblems(id, d, stemNums){
  const keys = stemNums.map(v => optKeyRef(typeof v === 'object' ? rawTextRef(v) : String(v)));
  const bad = d.opts.filter((o, i) => i !== d.ans && keys.indexOf(optKeyRef(o)) >= 0);
  return bad.length ? id + ': distractor "' + bad[0] + '" copies a number the stem prints' : null;
}

module.exports = {
  /* ================= 產生器模擬（tools/simgen.js） ================= */
  sim: {
    INVARIANTS: {
      containsUnit: d => {
        if (!(Number.isInteger(d.a) && d.a >= 2 && d.a <= 6)) return 'containsUnit: a=' + d.a + ' is outside 2..6';
        if (!(Number.isInteger(d.k) && d.k >= 2 && d.k <= 8)) return 'containsUnit: k=' + d.k + ' is outside 2..8';
        const f = fourDistinct('containsUnit', d); if (f) return f;
        const b = bareFracProblems('containsUnit', d.opts); if (b) return b;
        const q = divRef({ n:d.a, d:1 }, { n:1, d:d.k });
        if (d.opts[d.ans] !== fracTextRef(q)) return 'containsUnit: opts[ans]=' + d.opts[d.ans] + ' is not ' + fracTextRef(q);
        if (q.d !== 1) return 'containsUnit: the quotient ' + fracTextRef(q) + ' is not a whole number, so the picture cannot be counted';
        const dv = distinctValues('containsUnit', d.opts); if (dv) return dv;
        const e = echoProblems('containsUnit', d, [d.a, d.k]); if (e) return e;
        /* 這一課最重要的誘答：把兩個數相乘 */
        const prod = fracTextRef(mulRef({ n:d.a, d:1 }, { n:1, d:d.k }));
        if (prod !== String(d.a) && prod !== String(d.k) && d.opts.indexOf(prod) < 0) return 'containsUnit: the "just multiply" distractor ' + prod + ' is missing';
      },
      reciprocal: d => {
        const x = { n:d.n, d:d.d };
        const t = termProblems('reciprocal', x); if (t) return t;
        if (d.n === d.d) return 'reciprocal: n = d, so the not-flipped distractor would equal the answer';
        if (gcdRef(d.n, d.d) !== 1) return 'reciprocal: ' + rawTextRef(x) + ' is not in simplest form';
        if (d.d < 2) return 'reciprocal: the pool is fractions with a denominator of at least 2';
        const f = fourDistinct('reciprocal', d); if (f) return f;
        const b = bareFracProblems('reciprocal', d.opts); if (b) return b;
        if (d.opts[d.ans] !== rawTextRef(recipRef(x))) return 'reciprocal: opts[ans]=' + d.opts[d.ans] + ' is not ' + rawTextRef(recipRef(x));
        const dv = distinctValues('reciprocal', d.opts); if (dv) return dv;
        if (d.opts.indexOf(rawTextRef(x)) < 0) return 'reciprocal: the not-flipped distractor ' + rawTextRef(x) + ' is missing';
        if (!rEq(rNorm(mulRef(x, recipRef(x))), { n:1, d:1 })) return 'reciprocal: the product of the number and its reciprocal is not 1';
      },
      divFrac: d => {
        const x = { n:d.xn, d:d.xd }, y = { n:d.yn, d:d.yd };
        const t1 = termProblems('divFrac', x); if (t1) return t1;
        const t2 = termProblems('divFrac', y); if (t2) return t2;
        if (x.n > 6 || x.d > 6 || y.n > 6 || y.d > 6) return 'divFrac: a term leaves the 6-pool';
        if (gcdRef(x.n, x.d) !== 1 || gcdRef(y.n, y.d) !== 1) return 'divFrac: a term is not in simplest form';
        /* 除數等於被除數時商是 1，而「倒過來除」也是 1 —— 解釋那一句就會變成假的 */
        if (sameFrac(x, y)) return 'divFrac: the divisor equals the dividend, so "dividing the wrong way round" also gives the answer';
        const f = fourDistinct('divFrac', d); if (f) return f;
        const b = bareFracProblems('divFrac', d.opts); if (b) return b;
        const q = divRef(x, y);
        if (d.opts[d.ans] !== fracTextRef(q)) return 'divFrac: opts[ans]=' + d.opts[d.ans] + ' is not ' + fracTextRef(q);
        const dv = distinctValues('divFrac', d.opts); if (dv) return dv;
        const prod = fracTextRef(mulRef(x, y));
        if (prod !== fracTextRef(q) && d.opts.indexOf(prod) < 0) return 'divFrac: the "multiply without flipping" distractor ' + prod + ' is missing';
      },
      divWhole: d => {
        const y = { n:d.yn, d:d.yd };
        const t = termProblems('divWhole', y); if (t) return t;
        if (!(Number.isInteger(d.m) && d.m >= 2 && d.m <= 9)) return 'divWhole: m=' + d.m + ' is outside 2..9';
        if (!(y.n < y.d && y.d <= 9)) return 'divWhole: the divisor ' + rawTextRef(y) + ' is not a proper fraction within 9';
        if (gcdRef(y.n, y.d) !== 1) return 'divWhole: the divisor is not in simplest form';
        const f = fourDistinct('divWhole', d); if (f) return f;
        const b = bareFracProblems('divWhole', d.opts); if (b) return b;
        const q = divRef({ n:d.m, d:1 }, y);
        if (d.opts[d.ans] !== fracTextRef(q)) return 'divWhole: opts[ans]=' + d.opts[d.ans] + ' is not ' + fracTextRef(q);
        if (cmpRef(q, { n:d.m, d:1 }) !== 1) return 'divWhole: the divisor is below 1 but the quotient is not bigger than ' + d.m;
        const dv = distinctValues('divWhole', d.opts); if (dv) return dv;
        const e = echoProblems('divWhole', d, [d.m]); if (e) return e;
      },
      compareSide: d => {
        const x = { n:d.xn, d:d.xd }, y = { n:d.yn, d:d.yd };
        const t1 = termProblems('compareSide', x); if (t1) return t1;
        const t2 = termProblems('compareSide', y); if (t2) return t2;
        const f = fourDistinct('compareSide', d); if (f) return f;
        if (d.opts.slice().sort().join() !== ['bigger', 'cannot', 'same', 'smaller'].join()) return 'compareSide: the four options are not the four fixed conclusions: ' + d.opts;
        const q = divRef(x, y), side = cmpRef(q, x), want = side > 0 ? 'bigger' : (side < 0 ? 'smaller' : 'same');
        if (d.opts[d.ans] !== want) return 'compareSide: opts[ans]=' + d.opts[d.ans] + ', the recomputed quotient says ' + want;
        if (side !== -cmpRef(y, ONE_REF)) return 'compareSide: the rule (divisor vs 1) disagrees with the computed quotient for ' + rawTextRef(x) + ' ÷ ' + rawTextRef(y);
      },
      sameExpr: d => {
        const x = { n:d.xn, d:d.xd }, y = { n:d.yn, d:d.yd };
        const t1 = termProblems('sameExpr', x); if (t1) return t1;
        const t2 = termProblems('sameExpr', y); if (t2) return t2;
        if (x.n > 6 || x.d > 6 || y.n > 6 || y.d > 6) return 'sameExpr: a term leaves the 6-pool';
        const f = fourDistinct('sameExpr', d); if (f) return f;
        const want = rawTextRef(x) + ' × ' + rawTextRef(recipRef(y));
        if (d.opts[d.ans] !== want) return 'sameExpr: opts[ans]=' + d.opts[d.ans] + ' is not ' + want;
        /* 四個算式的**值**必須只有一個等於 x ÷ y，否則有第二條正確推理路線 */
        const q = divRef(x, y);
        const hit = d.opts.filter(o => {
          const m = /^(\d+(?:\/\d+)?) × (\d+(?:\/\d+)?)$/.exec(o);
          if (!m) return false;
          const a = parseOptRef(m[1]), b = parseOptRef(m[2]);
          return a && b && sameFrac(mulRef({ n:a.n, d:a.d }, { n:b.n, d:b.d }), q);
        });
        if (hit.length !== 1) return 'sameExpr: ' + hit.length + ' of the four expressions have the value of ' + rawTextRef(x) + ' ÷ ' + rawTextRef(y);
        if (new Set(d.opts).size !== 4) return 'sameExpr: two expressions are the same string';
        /* 四個算式的**值**也要兩兩不同：y ＝ 1/x 時「都不翻」和「兩個都翻」的值都是 1，字串卻不一樣 */
        const vals = d.opts.map(o => {
          const m = /^(\d+(?:\/\d+)?) × (\d+(?:\/\d+)?)$/.exec(o);
          if (!m) return null;
          const a = parseOptRef(m[1]), b = parseOptRef(m[2]);
          return (a && b) ? fracTextRef(mulRef({ n:a.n, d:a.d }, { n:b.n, d:b.d })) : null;
        });
        if (vals.some(v => v === null)) return 'sameExpr: an expression could not be evaluated: ' + d.opts.join(' | ');
        if (new Set(vals).size !== 4) return 'sameExpr: two of the four expressions have the same value: ' + d.opts.join(' | ');
        if (sameFrac({ n:x.n, d:x.d }, { n:y.n, d:y.d })) return 'sameExpr: the divisor equals the dividend, so flipping either one gives 1';
        if (sameFrac({ n:y.n, d:y.d }, recipRef(x))) return 'sameExpr: the divisor is the reciprocal of the dividend, so two distractors collide at 1';
      },
      wordCount: d => {
        const y = { n:d.yn, d:d.yd };
        const t = termProblems('wordCount', y); if (t) return t;
        if (!(Number.isInteger(d.m) && d.m >= 2 && d.m <= 6)) return 'wordCount: m=' + d.m + ' is outside 2..6';
        if (!(y.n < y.d && y.d <= 9 && y.n <= 6)) return 'wordCount: the divisor ' + rawTextRef(y) + ' is not a proper fraction within 9 with a numerator within 6';
        if (d.m % y.n !== 0) return 'wordCount: ' + d.m + ' is not a multiple of ' + y.n + ', so the count cannot be whole';
        if (COUNT_IDS_REF.indexOf(d.id) < 0) return 'wordCount: unknown scenario ' + d.id;
        const f = fourDistinct('wordCount', d); if (f) return f;
        const b = bareFracProblems('wordCount', d.opts); if (b) return b;
        const q = divRef({ n:d.m, d:1 }, y);
        /* 問「幾段／幾瓶」就是在數東西：商一定要是整數，不然答案回答不了題幹 */
        if (q.d !== 1) return 'wordCount: the answer ' + fracTextRef(q) + ' is not a whole count, but the stem asks how many parts there are';
        if (d.opts[d.ans] !== fracTextRef(q)) return 'wordCount: opts[ans]=' + d.opts[d.ans] + ' is not ' + fracTextRef(q);
        const dv = distinctValues('wordCount', d.opts); if (dv) return dv;
        const e = echoProblems('wordCount', d, [d.m]); if (e) return e;
        const prod = fracTextRef(mulRef({ n:d.m, d:1 }, y));
        if (prod !== fracTextRef(q) && d.opts.indexOf(prod) < 0) return 'wordCount: the "just multiply" distractor ' + prod + ' is missing';
      },
      wordUnit: d => {
        const y = { n:d.yn, d:d.yd };
        const t = termProblems('wordUnit', y); if (t) return t;
        if (!(Number.isInteger(d.m) && d.m >= 2 && d.m <= 9)) return 'wordUnit: m=' + d.m + ' is outside 2..9';
        if (!(y.n < y.d && y.d <= 9)) return 'wordUnit: the divisor ' + rawTextRef(y) + ' is not a proper fraction within 9';
        if (UNIT_IDS_REF.indexOf(d.id) < 0) return 'wordUnit: unknown scenario ' + d.id;
        const f = fourDistinct('wordUnit', d); if (f) return f;
        const b = bareFracProblems('wordUnit', d.opts); if (b) return b;
        const q = divRef({ n:d.m, d:1 }, y);
        /* 這是這一課**刻意**的抽樣決定（不是數學上的必然）：單位量的答案保持整數，
           「1 公斤賣 15/2 元」對六年級的文字題來說讀起來很怪。改抽樣的時候這一條要一起改。 */
        if (q.d !== 1) return 'wordUnit: the answer ' + fracTextRef(q) + ' is not whole, but this lesson samples unit-rate problems so the answer is a whole price or distance';
        if (d.opts[d.ans] !== fracTextRef(q)) return 'wordUnit: opts[ans]=' + d.opts[d.ans] + ' is not ' + fracTextRef(q);
        if (cmpRef(q, { n:d.m, d:1 }) !== 1) return 'wordUnit: one whole unit should be more than ' + d.m + ' because the known part is less than one unit';
        const dv = distinctValues('wordUnit', d.opts); if (dv) return dv;
        const e = echoProblems('wordUnit', d, [d.m]); if (e) return e;
      },
      missingFactor: d => {
        const y = { n:d.yn, d:d.yd }, p = { n:d.pn, d:d.pd };
        const t1 = termProblems('missingFactor', y); if (t1) return t1;
        const t2 = termProblems('missingFactor', p); if (t2) return t2;
        if (y.n > 6 || y.d > 6 || p.n > 6 || p.d > 6) return 'missingFactor: a term leaves the 6-pool';
        const f = fourDistinct('missingFactor', d); if (f) return f;
        const b = bareFracProblems('missingFactor', d.opts); if (b) return b;
        const q = divRef(p, y);
        if (d.opts[d.ans] !== fracTextRef(q)) return 'missingFactor: opts[ans]=' + d.opts[d.ans] + ' is not ' + fracTextRef(q);
        if (!sameFrac(mulRef(q, y), p)) return 'missingFactor: the answer multiplied by the divisor does not give the product back';
        const dv = distinctValues('missingFactor', d.opts); if (dv) return dv;
      },
      trueStatement: d => {
        if (!TRUE_STATEMENTS_REF[d.t]) return 'trueStatement: "' + d.t + '" is not a true statement';
        const f = fourDistinct('trueStatement', d); if (f) return f;
        const trues = d.opts.filter(k => TRUE_STATEMENTS_REF[k]);
        if (trues.length !== 1) return 'trueStatement: ' + trues.length + ' true sentences offered, the stem promises exactly one';
        if (d.opts.some(k => !TRUE_STATEMENTS_REF[k] && FALSE_KEYS_REF.indexOf(k) < 0)) return 'trueStatement: an option key is unknown to the truth table: ' + d.opts;
        if (d.opts[d.ans] !== d.t) return 'trueStatement: opts[ans] is ' + d.opts[d.ans];
      },
      interFracMul: d => {
        const x = { n:d.xn, d:d.xd }, y = { n:d.yn, d:d.yd };
        const t1 = termProblems('interFracMul', x); if (t1) return t1;
        const t2 = termProblems('interFracMul', y); if (t2) return t2;
        if (x.n > 6 || x.d > 6 || y.n > 6 || y.d > 6) return 'interFracMul: a term leaves the 6-pool';
        const f = fourDistinct('interFracMul', d); if (f) return f;
        const b = bareFracProblems('interFracMul', d.opts); if (b) return b;
        const q = mulRef(x, y);
        if (d.opts[d.ans] !== fracTextRef(q)) return 'interFracMul: opts[ans]=' + d.opts[d.ans] + ' is not ' + fracTextRef(q);
        const dv = distinctValues('interFracMul', d.opts); if (dv) return dv;
        /* 這一題是乘法，最有價值的誘答是「當成除法翻了除數」 */
        const flipped = fracTextRef(divRef(x, y));
        if (flipped !== fracTextRef(q) && d.opts.indexOf(flipped) < 0) return 'interFracMul: the "flipped it anyway" distractor ' + flipped + ' is missing';
      },
      interDivInt: d => {
        const x = { n:d.xn, d:d.xd };
        const t = termProblems('interDivInt', x); if (t) return t;
        if (!(x.n < x.d && x.d <= 9)) return 'interDivInt: ' + rawTextRef(x) + ' is not a proper fraction within 9';
        if (!(Number.isInteger(d.k) && d.k >= 2 && d.k <= 6)) return 'interDivInt: k=' + d.k + ' is outside 2..6';
        const f = fourDistinct('interDivInt', d); if (f) return f;
        const b = bareFracProblems('interDivInt', d.opts); if (b) return b;
        const q = divRef(x, { n:d.k, d:1 });
        if (d.opts[d.ans] !== fracTextRef(q)) return 'interDivInt: opts[ans]=' + d.opts[d.ans] + ' is not ' + fracTextRef(q);
        if (cmpRef(q, x) !== -1) return 'interDivInt: dividing by a whole number above 1 should make the quotient smaller';
        const dv = distinctValues('interDivInt', d.opts); if (dv) return dv;
        const e = echoProblems('interDivInt', d, [d.k]); if (e) return e;
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'containsUnit': return fracTextRef(divRef({ n:d.a, d:1 }, { n:1, d:d.k }));
        case 'reciprocal': return rawTextRef(recipRef({ n:d.n, d:d.d }));
        case 'divFrac': return fracTextRef(divRef({ n:d.xn, d:d.xd }, { n:d.yn, d:d.yd }));
        case 'divWhole': return fracTextRef(divRef({ n:d.m, d:1 }, { n:d.yn, d:d.yd }));
        case 'compareSide': {
          const side = cmpRef(divRef({ n:d.xn, d:d.xd }, { n:d.yn, d:d.yd }), { n:d.xn, d:d.xd });
          return SIDE_TEXT_REF[lang][side > 0 ? 'bigger' : (side < 0 ? 'smaller' : 'same')];
        }
        case 'sameExpr': return rawTextRef({ n:d.xn, d:d.xd }) + ' × ' + rawTextRef(recipRef({ n:d.yn, d:d.yd }));
        case 'wordCount': return ansTextRef(lang, d.id, fracTextRef(divRef({ n:d.m, d:1 }, { n:d.yn, d:d.yd })));
        case 'wordUnit': return ansTextRef(lang, d.id, fracTextRef(divRef({ n:d.m, d:1 }, { n:d.yn, d:d.yd })));
        case 'missingFactor': return fracTextRef(divRef({ n:d.pn, d:d.pd }, { n:d.yn, d:d.yd }));
        case 'trueStatement': return TRUE_STATEMENTS_REF[d.t] ? TRUE_STATEMENTS_REF[d.t][lang] : null;
        case 'interFracMul': return fracTextRef(mulRef({ n:d.xn, d:d.xd }, { n:d.yn, d:d.yd }));
        case 'interDivInt': return fracTextRef(divRef({ n:d.xn, d:d.xd }, { n:d.k, d:1 }));
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣：最簡分數／整數（可帶單位）、乘法算式、或四句固定的結論。 */
    optionOk: function(s, genId, lang, isCorrect){
      const t = String(s).trim();
      if (!t) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
      if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
      if (lang === 'en' && /\p{Script=Han}/u.test(t)) return 'English option contains Chinese: ' + t;
      if (genId === 'trueStatement') return t.length >= 6 && t.length <= 110 && statementTruthOfText(t, lang) !== null ? null : 'trueStatement option is not one of the pinned sentences: ' + t;
      if (genId === 'compareSide') return Object.keys(SIDE_TEXT_REF[lang]).some(k => SIDE_TEXT_REF[lang][k] === t) ? null : 'compareSide option is not one of the four pinned conclusions: ' + t;
      if (genId === 'sameExpr'){
        const m = /^(\d+(?:\/\d+)?) × (\d+(?:\/\d+)?)$/.exec(t);
        if (!m) return 'sameExpr option is not written as "a × b": ' + t;
        for (const part of [m[1], m[2]]){
          const p = parseOptRef(part);
          if (!p || p.n > LIMIT_REF || p.d > LIMIT_REF) return 'sameExpr option has a term outside 1..' + LIMIT_REF + ': ' + t;
        }
        return null;
      }
      const p = parseOptRef(t);
      if (!p) return genId + ' option is not a fraction or whole number (with an optional unit): ' + t;
      if (p.n > OPT_LIMIT_REF || p.d > OPT_LIMIT_REF) return genId + ' option ' + t + ' leaves 1..' + OPT_LIMIT_REF;
      if (gcdRef(p.n, p.d) !== 1) return genId + ' option ' + t + ' is not in simplest form';
      const needsUnit = (genId === 'wordCount' || genId === 'wordUnit');
      if (needsUnit && !p.unit) return genId + ' option has no unit: ' + t;
      if (!needsUnit && p.unit) return genId + ' option carries a unit it should not have: ' + t;
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
      if (want === null || want === undefined) out.push('no stem reference for ' + genId);
      else if (q.stem !== want) out.push('the rendered stem is not the rebuilt sentence: "' + q.stem.replace(/<[^>]+>/g, '') + '"');
      /* 值去重（帶單位的也比單位） */
      const keys = q.opts.map(optKeyRef);
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) if (keys[i] === keys[j]) out.push('two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
      const ar = fracArith(q.stem + ' ' + q.why);
      ar.problems.forEach(m => out.push(m));
      if (genId !== 'trueStatement' && genId !== 'compareSide' && genId !== 'sameExpr' && ar.verified < 1)
        out.push('the explanation should contain an equation to verify, but none was read');
      stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
      stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
      FALSE_KEYS_REF.forEach(k => { if (q.why.indexOf(FALSE_STATEMENTS_REF[k][lang]) >= 0) out.push('the explanation states the misconception "' + FALSE_STATEMENTS_REF[k][lang] + '"'); });
      q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
      /* 每一支自己的語意，從**印出來的**選項讀回來 */
      const wantText = module.exports.sim.expectedCorrect(d, genId, lang);
      if (wantText !== null && q.opts[q.ans] !== wantText) out.push('the marked option is not "' + wantText + '"');
      if (genId === 'wordCount' || genId === 'wordUnit'){
        const units = new Set(q.opts.map(o => (parseOptRef(o) || { unit:'' }).unit));
        if (units.size !== 1) out.push('options carry different units: ' + q.opts.join(' | '));
        const u = SCEN_REF[lang][d.id].ans.replace(/s$/, '');
        if (units.values().next().value !== u) out.push('the options do not use the scenario unit "' + u + '": ' + q.opts.join(' | '));
        /* ⚠️ 逐個選項和**用它自己的值重建的字**比：這樣「1 square metres」這種多字單位的單複數才擋得住
           （用一張名詞清單去掃，中間夾一個 square 就掃不到了）。 */
        q.opts.forEach(o => {
          const pr = parseOptRef(o);
          if (!pr) return;
          const want = ansTextRef(lang, d.id, fracTextRef({ n:pr.n, d:pr.d }));
          if (o !== want) out.push('the option "' + o + '" is not how this lesson writes that value ("' + want + '")');
        });
      }
      if (genId === 'trueStatement'){
        let trues = 0;
        q.opts.forEach(o => { const tv = statementTruthOfText(o, lang); if (tv === null) out.push('option "' + o + '" is not one of the pinned statement texts'); else if (tv) trues++; });
        if (trues !== 1) out.push('the rendered options contain ' + trues + ' true sentences');
      }
      if (genId === 'compareSide'){
        const seen = new Set(q.opts);
        if (seen.size !== 4) out.push('the four conclusions repeat');
        Object.keys(SIDE_TEXT_REF[lang]).forEach(k => { if (!seen.has(SIDE_TEXT_REF[lang][k])) out.push('the conclusion "' + SIDE_TEXT_REF[lang][k] + '" is missing'); });
      }
      return out.length ? out.join('; ') : null;
    },

    /* 刻意放行的「抄題幹」：只有**分數的零件**。
       simgen 的內建檢查把題幹裡每一段數字都當成「題幹印出來的數」，可是 `3/4` 裡的 3 和 4 不是題幹端出來的量，
       是分數的零件 —— 孩子看不到一個叫「4」的量。所以這裡逐個值判斷：**只有在這個數字從來沒有以獨立的數出現在題幹裡**
       的時候才放行（題幹自己重建一次來看，見 stemRef）。題幹真的印出 3 的時候（containsUnit 的被除數），一樣會響。 */
    stemEchoOk: (function(){
      const allow = {};
      GEN_IDS.forEach(genId => {
        allow[genId] = function(d, opt, lang, idx){
          const stem = String(stemRef(genId, d, lang) || '').replace(/<[^>]+>/g, ' ');
          const v = String(opt);
          if (!/^\d+$/.test(v)) return false;
          if (v !== String(Number(v))) return false;      /* 「04」和「4」是同一個值，不可以靠寫法繞過 */
          return !(new RegExp('(?<![\\d/])' + v + '(?![\\d/])').test(stem));
        };
      });
      return allow;
    })()
  },

  /* ================= index.html 靜態資料檢查（tools/verify_lesson_data.js） ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{LIMIT, MAX_UNITS, isPosInt, isFrac, gcd, simplify, fracText, rawText, recip, mul, div, cmp, ONE, quotientSide, ' +
                'divPlan, flipSteps, FIG_W, BAR_H, U, UGAP, BAR_X0, ROW_A_Y, ROW_B_Y, LABEL_DY, LABEL_FS, barPlan, planFigure, ' +
                'S1_CASES, S2_CASES, S3_CASES, S4_DIVIDEND, S4_CASES, S5_CASES, caseAnswer, ' +
                'ROUNDS, roundAnswer, roundAnswerIndex, roundFigure, plEn, SCEN, ansText, amtText}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器自己先過 PROBE ---- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = fracArith(pr.text).problems.length > 0;
        if (caught !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"' + (caught ? ': ' + fracArith(pr.text).problems[0] : ''));
      });
      const lessonDir = path.dirname(process.argv[2]);      /* ⚠️ 不可以用 __dirname：breaktest 把四頁複製到暫存目錄 */
      const RAW = {}, TEXT = {};
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        try { RAW[pg] = fs.readFileSync(path.join(lessonDir, pg + '.html'), 'utf8'); TEXT[pg] = visibleText(RAW[pg]); }
        catch (e){ fail('cannot read ' + pg + '.html next to index.html (' + e.code + ')'); }
      });

      /* ---- 1. 版面常數 ＝ 獨立寫死的第二份；六張畫布的 viewBox 與 CSS 高度 ---- */
      const CONSTS = { LIMIT:LIMIT_REF, MAX_UNITS:MAX_UNITS_REF, FIG_W:FIG_W_REF, BAR_H:BAR_H_REF, U:U_REF, UGAP:UGAP_REF, BAR_X0:BAR_X0_REF, ROW_A_Y:ROW_A_Y_REF, ROW_B_Y:ROW_B_Y_REF, LABEL_DY:LABEL_DY_REF, LABEL_FS:LABEL_FS_REF };
      Object.keys(CONSTS).forEach(k => { if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ' but the reference says ' + CONSTS[k]); });
      /* 18 格真的放得進畫布：用參考常數自己算，不相信 MAX_UNITS 的註解 */
      if (BAR_X0_REF + MAX_UNITS_REF * (U_REF + UGAP_REF) - UGAP_REF > FIG_W_REF) fail('MAX_UNITS cells do not fit the canvas width');
      if (ROW_B_Y_REF + U_REF > BAR_H_REF) fail('the bottom bar leaves the canvas');
      const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const svgs = liveSrc.match(/<svg[^>]*>/g) || [];
      if (svgs.length !== 6) fail('index.html has ' + svgs.length + ' canvases, expected 6 (five examples and the game; the flip table is HTML)');
      svgs.forEach(tag => {
        const cls = (/class="([^"]+)"/.exec(tag) || [])[1];
        const nums = ((/viewBox="([^"]+)"/.exec(tag) || ['', ''])[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (cls !== 'barfig') fail('a canvas has class "' + cls + '", which this config does not know');
        else if (nums.length !== 4 || nums[0] !== 0 || nums[1] !== 0 || nums[2] !== FIG_W_REF || nums[3] !== BAR_H_REF) fail('a canvas viewBox is ' + tag + ', expected 0 0 ' + FIG_W_REF + ' ' + BAR_H_REF);
      });
      /* 把圖藏起來的 CSS：plan 的幾何全對、每一條釘樁也全過，畫面上卻什麼都看不到。
         ⚠️ CSS 的屬性名與關鍵字**不分大小寫**，所以這裡一定要用 i；而且要掃**拿掉註解之後**的原始碼，
         不然被註解掉的規則會被誤判成生效中。這仍然只是屬性掃描，不是算 computed style —— 已知的極限。 */
      const styleBlocks = (liveSrc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
      (styleBlocks.match(/[^{}]*\{[^{}]*\}/g) || []).forEach(rule => {
        const sel = rule.slice(0, rule.indexOf('{'));
        if (!/barfig/i.test(sel)) return;
        const body = rule.slice(rule.indexOf('{'));
        if (/display\s*:\s*none|visibility\s*:\s*(hidden|collapse)|opacity\s*:\s*0(?:\.0+)?\s*[;}]|fill\s*:\s*(none|transparent)|transform\s*:[^;}]*scale\(\s*0(?:\.0+)?\s*[,)]|clip-path\s*:|(?:width|height)\s*:\s*0(?:\.0+)?\s*(?:px|%)?\s*[;}]/i.test(body))
          fail('a CSS rule hides the figure: "' + rule.replace(/\s+/g, ' ').trim().slice(0, 80) + '"');
      });
      const rules = liveSrc.match(/\.barfig\s*\{[^}]*\}/g) || [];
      if (rules.length !== 1) fail('index.html declares the .barfig rule ' + rules.length + ' time(s), expected exactly 1');
      else {
        const hs = rules[0].match(/[{;]\s*height:\s*(\d+)px/g) || [];
        if (hs.length !== 1) fail('the .barfig rule declares a plain height ' + hs.length + ' time(s)');
        else if (Number(/height:\s*(\d+)px/.exec(hs[0])[1]) !== BAR_H_REF) fail('.barfig is ' + hs[0].trim() + ' in CSS but the viewBox is ' + BAR_H_REF + ' tall — the drawing would be letterboxed');
      }

      /* ---- 2. 有理數函式 vs 獨立重寫的第二套；課程明講的四句話逐對驗 ---- */
      if (data.gcd(0, 5) !== null || data.gcd(2.5, 5) !== null || data.gcd(Infinity, 5) !== null || data.gcd(-4, 6) !== null) fail('gcd does not fail closed on bad input');
      if (data.simplify({ n:0, d:3 }) !== null || data.simplify({ n:3, d:0 }) !== null || data.recip({ n:0, d:3 }) !== null) fail('simplify / recip do not fail closed on a zero term');
      if (data.div({ n:1, d:2 }, { n:0, d:3 }) !== null) fail('div does not fail closed when the divisor has no reciprocal');
      if (data.cmp({ n:1, d:2 }, { n:1, d:0 }) !== null || data.cmp(null, ONE_REF) !== null) fail('cmp does not fail closed on bad input');
      if (data.fracText(null) !== '?' || data.rawText(null) !== '?') fail('fracText / rawText do not print ? for a broken value');
      if (data.divPlan({ n:1, d:2 }, { n:0, d:3 }) !== null) fail('divPlan does not fail closed on a zero numerator');
      let pairs = 0, ruleBig = 0, ruleSmall = 0, ruleSame = 0;
      for (let xn = 1; xn <= LIMIT_REF; xn++) for (let xd = 1; xd <= LIMIT_REF; xd++)
        for (let yn = 1; yn <= LIMIT_REF; yn++) for (let yd = 1; yd <= LIMIT_REF; yd++){
          const x = { n:xn, d:xd }, y = { n:yn, d:yd };
          pairs++;
          /* ⚠️ 乘法要**單獨**驗（排在除法前面）：除法是用乘法算的，所以先驗除法的話，
             一個壞掉的 mul 會先撞上除法那一條，乘法自己那一條就永遠沒被證明過（-39 那一類）。 */
          if (!sameFrac(data.mul(x, y), mulRef(x, y))){ fail('mul(' + rawTextRef(x) + ', ' + rawTextRef(y) + ') is ' + JSON.stringify(data.mul(x, y)) + ', the reference says ' + rawTextRef(mulRef(x, y))); return; }
          const q = data.div(x, y), qr = divRef(x, y);
          if (!q || !sameFrac(q, qr)){ fail('div(' + rawTextRef(x) + ', ' + rawTextRef(y) + ') is ' + JSON.stringify(q) + ', cross-multiplying says ' + rawTextRef(qr)); return; }
          /* ⚠️ 這裡**沒有**「div ＝ mul(x, recip(y))」那一條：頁面的 div 本來就是那樣寫的，
             比它等於拿定義比定義，永遠不會響。真正在守的是三條各自對獨立實作的比對：
             mul vs mulRef（上面）、div vs divRef（這裡）、recip vs recipRef（下面那個迴圈）。 */
          /* 「通分之後分子相除就是商」 */
          const p = data.divPlan(x, y);
          if (!p || p.D !== xd * yd || p.N !== xn * yd || p.C !== yn * xd){ fail('divPlan(' + rawTextRef(x) + ', ' + rawTextRef(y) + ') is ' + JSON.stringify(p)); return; }
          if (!sameFrac(p.q, qr) || !sameFrac({ n:p.N, d:p.C }, qr)){ fail('divPlan quotient disagrees for ' + rawTextRef(x) + ' ÷ ' + rawTextRef(y)); return; }
          if (!sameFrac(p.flip, recipRef(y)) || p.raw.n !== p.N || p.raw.d !== p.C){ fail('divPlan flip/raw are wrong for ' + rawTextRef(x) + ' ÷ ' + rawTextRef(y)); return; }
          if (p.tooMany !== (p.N > MAX_UNITS_REF || p.C > MAX_UNITS_REF)){ fail('divPlan tooMany is wrong for ' + rawTextRef(x) + ' ÷ ' + rawTextRef(y)); return; }
          /* 「被除數比 0 大時，除數和 1 比決定商和被除數的大小」——把商算出來比，不是相信 quotientSide */
          const side = cmpRef(qr, x), byRule = data.quotientSide(y);
          if (side !== byRule){ fail('the rule (divisor vs 1) says ' + byRule + ' but the computed quotient says ' + side + ' for ' + rawTextRef(x) + ' ÷ ' + rawTextRef(y)); return; }
          if (data.cmp(x, y) !== cmpRef(x, y)){ fail('cmp disagrees on ' + rawTextRef(x) + ' vs ' + rawTextRef(y)); return; }
          if (side > 0) ruleBig++; else if (side < 0) ruleSmall++; else ruleSame++;
        }
      if (pairs !== Math.pow(LIMIT_REF, 4)) fail('only ' + pairs + ' fraction pairs were checked');
      if (!ruleBig || !ruleSmall || !ruleSame) fail('the quotient-size rule never saw all three cases: ' + [ruleBig, ruleSmall, ruleSame]);
      /* 「兩個數相乘等於 1 就互為倒數」 */
      for (let n = 1; n <= LIMIT_REF; n++) for (let d = 1; d <= LIMIT_REF; d++){
        const x = { n:n, d:d }, r = data.recip(x);
        if (!r || r.n !== d || r.d !== n) fail('recip(' + rawTextRef(x) + ') is ' + JSON.stringify(r));
        else if (!sameFrac(data.mul(x, r), ONE_REF)) fail(rawTextRef(x) + ' times its reciprocal is not 1');
        if (data.fracText(x) !== fracTextRef(x)) fail('fracText(' + rawTextRef(x) + ') is ' + data.fracText(x));
        if (data.rawText(x) !== rawTextRef(x)) fail('rawText(' + rawTextRef(x) + ') is ' + data.rawText(x));
      }
      if (data.plEn(1, 'cell') !== '1 cell' || data.plEn(2, 'cell') !== '2 cells') fail('plEn is wrong');
      if (data.ansText('en', 'ribbon', '1') !== '1 piece' || data.ansText('en', 'ribbon', '4') !== '4 pieces' || data.ansText('zh', 'ribbon', '4') !== '4 段') fail('ansText is wrong');
      if (data.amtText('en', 'metre', { n:1, d:1 }) !== '1 metre' || data.amtText('en', 'metre', { n:3, d:1 }) !== '3 metres' || data.amtText('en', 'metre', { n:3, d:4 }) !== '3/4 metres') fail('amtText is wrong');

      /* ---- 3. 小格尺：每一對 a, b ≤ 18 ＋ 放不下的都畫一次量回來（標籤用兩種語言裡最長的） ---- */
      const LONG_ZH = '被除數 18 格', LONG_EN = 'denominator: 18 cells';
      let drawn = 0, capped = 0;
      for (let a = 1; a <= MAX_UNITS_REF + 2; a++) for (let b = 1; b <= MAX_UNITS_REF + 2; b++){
        const pl = data.barPlan(a, b);
        barProblems('barPlan(' + a + ',' + b + ')', pl, a, b, LONG_EN, LONG_ZH).forEach(fail);
        if (pl && pl.tooMany) capped++; else drawn++;
      }
      if (!drawn || !capped) fail('barPlan domain: ' + drawn + ' drawable and ' + capped + ' capped pairs — both kinds must occur');
      const badPlan = data.barPlan(0, 3); if (!badPlan.tooMany || badPlan.cells.length) fail('barPlan(0,3) is drawn instead of failing closed');
      if (data.planFigure({ n:1, d:2 }, { n:0, d:3 }) !== null) fail('planFigure does not fail closed on a zero divisor');

      /* ---- 4. 翻轉的步驟表：五列，每一列的算式都算得對 ---- */
      for (let xn = 1; xn <= 6; xn++) for (let xd = 1; xd <= 6; xd++) for (let yn = 1; yn <= 6; yn++) for (let yd = 1; yd <= 6; yd++){
        const x = { n:xn, d:xd }, y = { n:yn, d:yd }, F = data.flipSteps(x, y);
        if (!F || !Array.isArray(F.rows) || F.rows.length !== 5 || F.last !== 4){ fail('flipSteps(' + rawTextRef(x) + ', ' + rawTextRef(y) + ') is not a five-row table'); return; }
        const p = F.plan, keys = F.rows.map(r => r.key).join();
        if (keys !== 'start,common,cells,flip,final'){ fail('flipSteps rows are ' + keys); return; }
        const wantRows = [
          rawTextRef(x) + ' ÷ ' + rawTextRef(y),
          rawTextRef({ n:p.N, d:p.D }) + ' ÷ ' + rawTextRef({ n:p.C, d:p.D }),
          p.N + ' ÷ ' + p.C,
          rawTextRef(x) + ' × ' + rawTextRef(recipRef(y)) + ' ＝ ' + rawTextRef({ n:p.N, d:p.C }),
          fracTextRef(divRef(x, y))
        ];
        for (let i = 0; i < 5; i++) if (F.rows[i].expr !== wantRows[i]){ fail('flipSteps row ' + i + ' is "' + F.rows[i].expr + '", expected "' + wantRows[i] + '"'); return; }
        const ar = fracArith(F.rows[3].expr);
        if (ar.problems.length){ fail('the flip row does not check out: ' + ar.problems[0]); return; }
      }

      /* ---- 5. 範例 1～5 的案例 ---- */
      const pinCases = (name, got, want) => { if (!sameList(got, want)) fail(name + ' is [' + got.join(' | ') + '], the reference says [' + want.join(' | ') + ']'); };
      pinCases('S1_CASES', data.S1_CASES.map(c => [c.x.n, c.x.d, c.y.n, c.y.d].join('-')), S1_CASES_REF.map(c => c.join('-')));
      data.S1_CASES.forEach((c, i) => {
        const q = divRef(c.x, c.y);
        if (q.d !== 1) fail('S1 case ' + i + ' does not have a whole-number quotient, so the picture cannot be counted');
        if (c.y.n !== 1) fail('S1 case ' + i + ' divides by ' + rawTextRef(c.y) + ', which is not a unit fraction');
        if (cmpRef(q, c.x) !== 1) fail('S1 case ' + i + ' does not show a quotient bigger than the dividend');
        if (data.planFigure(c.x, c.y).tooMany) fail('S1 case ' + i + ' does not fit the picture');
        if (!sameFrac(data.caseAnswer(c), q)) fail('S1 case ' + i + ' caseAnswer disagrees with the reference');
      });
      if (!data.S1_CASES.some(c => c.x.d === 1) || !data.S1_CASES.some(c => c.x.d > 1)) fail('S1_CASES must show both a whole-number dividend and a fraction dividend');
      pinCases('S2_CASES', data.S2_CASES.map(x => [x.n, x.d].join('-')), S2_CASES_REF.map(c => c.join('-')));
      const s2kind = { big:0, small:0, whole:0, unit:0 };
      data.S2_CASES.forEach((x, i) => {
        const r = recipRef(x), c = cmpRef(r, x);
        if (c > 0) s2kind.big++; if (c < 0) s2kind.small++;
        if (x.d === 1) s2kind.whole++; if (x.n === 1) s2kind.unit++;
        if (gcdRef(x.n, x.d) !== 1) fail('S2 case ' + i + ' is not in simplest form');
        if (data.barPlan(x.n, x.d).tooMany) fail('S2 case ' + i + ' does not fit the picture');
      });
      if (!s2kind.big || !s2kind.small || !s2kind.whole || !s2kind.unit) fail('S2_CASES must include a reciprocal that grows, one that shrinks, a whole number and a unit fraction — got ' + JSON.stringify(s2kind));
      pinCases('S3_CASES', data.S3_CASES.map(c => [c.x.n, c.x.d, c.y.n, c.y.d].join('-')), S3_CASES_REF.map(c => c.join('-')));
      const s3kind = { needsSimplify:0, whole:0, below:0, above:0 };
      data.S3_CASES.forEach((c, i) => {
        const p = data.divPlan(c.x, c.y), q = divRef(c.x, c.y);
        if (p.tooMany) fail('S3 case ' + i + ' does not fit the picture');
        if (p.N !== q.n || p.C !== q.d) s3kind.needsSimplify++;
        if (q.d === 1) s3kind.whole++;
        if (cmpRef(q, ONE_REF) < 0) s3kind.below++; else s3kind.above++;
      });
      if (!s3kind.needsSimplify || !s3kind.whole || !s3kind.below || !s3kind.above) fail('S3_CASES must include one that needs simplifying, one whole-number answer, one below 1 and one above 1 — got ' + JSON.stringify(s3kind));
      if (data.S4_DIVIDEND.n !== S4_DIVIDEND_REF[0] || data.S4_DIVIDEND.d !== S4_DIVIDEND_REF[1]) fail('S4_DIVIDEND is ' + rawTextRef(data.S4_DIVIDEND));
      pinCases('S4_CASES', data.S4_CASES.map(y => [y.n, y.d].join('-')), S4_CASES_REF.map(c => c.join('-')));
      const s4sides = new Set();
      data.S4_CASES.forEach((y, i) => {
        const q = divRef(data.S4_DIVIDEND, y);
        s4sides.add(cmpRef(q, data.S4_DIVIDEND));
        if (data.planFigure(data.S4_DIVIDEND, y).tooMany) fail('S4 case ' + i + ' does not fit the picture');
        if (cmpRef(q, data.S4_DIVIDEND) !== data.quotientSide(y)) fail('S4 case ' + i + ' breaks the rule it is meant to show');
      });
      if (s4sides.size !== 3) fail('S4_CASES must cover all three cases (bigger, equal, smaller), it covers ' + s4sides.size);
      pinCases('S5_CASES', data.S5_CASES.map(c => [c.id, c.kind, c.x.n, c.x.d, c.y.n, c.y.d].join('-')), S5_CASES_REF.map(c => c.join('-')));
      const s5kind = {};
      data.S5_CASES.forEach((c, i) => {
        const q = divRef(c.x, c.y);
        s5kind[c.kind] = (s5kind[c.kind] || 0) + 1;
        if (q.d !== 1) fail('S5 case ' + c.id + ' does not have a whole-number answer');
        if (cmpRef(c.y, ONE_REF) >= 0) fail('S5 case ' + c.id + ' divides by something that is not below 1, so the "answer is bigger" surprise disappears');
        if (data.planFigure(c.x, c.y).tooMany) fail('S5 case ' + c.id + ' does not fit the picture');
        if (!SCEN_REF.zh[c.id] || !SCEN_REF.en[c.id]) fail('S5 case ' + c.id + ' has no scenario names');
      });
      if (s5kind.count !== 2 || s5kind.unit !== 2) fail('S5_CASES must have two of each kind, got ' + JSON.stringify(s5kind));

      /* ---- 6. 小遊戲 ---- */
      if (!Array.isArray(data.ROUNDS) || data.ROUNDS.length !== GAME_ROUNDS_REF) fail('ROUNDS has ' + (data.ROUNDS || []).length + ' rounds');
      const kinds = data.ROUNDS.map(r => r.kind);
      if (kinds.slice().sort().join() !== ['compare', 'contains', 'divide', 'reciprocal', 'word'].join()) fail('the five rounds are not one of each kind: ' + kinds);
      if (new Set(data.ROUNDS.map(r => r.ans)).size < 3) fail('the game answers sit in fewer than three different positions, so a child can learn the slot');
      data.ROUNDS.forEach((r, i) => {
        const tag = 'round ' + (i + 1) + ' (' + r.kind + ')';
        if (!Array.isArray(r.opts) || r.opts.length !== 4 || new Set(r.opts.map(String)).size !== 4) fail(tag + ': options are not four distinct');
        const idx = data.roundAnswerIndex(r);
        if (idx !== r.ans) fail(tag + ': roundAnswerIndex()=' + idx + ' but ans=' + r.ans);
        if (data.roundAnswer(r) === null) fail(tag + ': roundAnswer() is null');
        const t = termProblems(tag, r.x); if (t) fail(t);
        if (r.y){ const t2 = termProblems(tag, r.y); if (t2) fail(t2); }
        const fig = data.roundFigure(r);
        if (r.kind === 'compare'){
          if (fig !== null) fail(tag + ': the comparison round should not draw a picture');
          const q = divRef(r.x, r.y), want = cmpRef(q, r.x) > 0 ? 'bigger' : (cmpRef(q, r.x) < 0 ? 'smaller' : 'same');
          if (r.opts[r.ans] !== want) fail(tag + ': the marked conclusion is ' + r.opts[r.ans] + ', the computed quotient says ' + want);
          if (r.opts.slice().sort().join() !== ['bigger', 'cannot', 'same', 'smaller'].join()) fail(tag + ': the four conclusions are not the fixed set');
        } else {
          if (!fig) fail(tag + ': should have a picture');
          else {
            const want = r.kind === 'reciprocal' ? [r.x.n, r.x.d] : [data.divPlan(r.x, r.y).N, data.divPlan(r.x, r.y).C];
            barProblems(tag + ' picture', fig, want[0], want[1], LONG_EN, LONG_ZH).forEach(fail);
          }
          const wantAns = r.kind === 'reciprocal' ? fracTextRef(recipRef(r.x)) : fracTextRef(divRef(r.x, r.y));
          if (String(r.opts[r.ans]) !== wantAns) fail(tag + ': the marked option is ' + r.opts[r.ans] + ', the reference says ' + wantAns);
          const keys = r.opts.map(o => optKeyRef(String(o)));
          if (new Set(keys).size !== 4) fail(tag + ': two options have the same value');
          r.opts.forEach(o => {
            const p = parseOptRef(String(o));
            if (!p) fail(tag + ': option "' + o + '" is not a fraction or whole number');
            else if (gcdRef(p.n, p.d) !== 1) fail(tag + ': option "' + o + '" is not in simplest form');
            else if (p.n > OPT_LIMIT_REF || p.d > OPT_LIMIT_REF) fail(tag + ': option "' + o + '" leaves 1..' + OPT_LIMIT_REF);
          });
          /* 這一課最重要的誘答要在場：把兩個數相乘（除法那幾關）／沒有翻（倒數那一關） */
          if (r.kind === 'reciprocal'){
            if (r.opts.indexOf(rawTextRef(r.x)) < 0) fail(tag + ': the not-flipped distractor is missing');
          } else {
            const prod = fracTextRef(mulRef(r.x, r.y));
            if (prod !== wantAns && r.opts.indexOf(prod) < 0) fail(tag + ': the "just multiply" distractor ' + prod + ' is missing');
          }
        }
      });

      /* ---- 7. 字典函式真的跑起來：每一句旁白都渲染一次再掃 ---- */
      const strings = [];
      function add(text, lang, where){ strings.push({ text:String(text), lang, where }); }
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang];
        if (!d){ fail('I18N.' + lang + ' missing'); return; }
        data.S1_CASES.forEach(sc => {
          const pl = data.planFigure(sc.x, sc.y), p = data.divPlan(sc.x, sc.y);
          add(d.s1chip(sc), lang, 's1chip'); add(d.barLabelA(pl.a), lang, 'barLabelA'); add(d.barLabelB(pl.b), lang, 'barLabelB');
          add(d.s1cap(sc, pl), lang, 's1cap'); add(d.s1narr(sc), lang, 's1narr'); add(d.s1calc(sc), lang, 's1calc'); add(d.s1result(sc), lang, 's1result');
          if (d.s1calc(sc).indexOf(p.N + ' ÷ ' + p.C) < 0) fail(lang + ' s1calc does not show the cell division ' + p.N + ' ÷ ' + p.C);
          if (d.s1result(sc).indexOf(fracTextRef(divRef(sc.x, sc.y))) < 0) fail(lang + ' s1result does not print the answer');
          if (!new RegExp('(^|\\D)' + pl.a + '(\\D|$)').test(d.barLabelA(pl.a))) fail(lang + ' barLabelA does not print the cell count');
          barProblems(lang + ' S1 picture', pl, pl.a, pl.b, d.barLabelA(pl.a), d.barLabelB(pl.b)).forEach(fail);
        });
        add(d.s1cap(data.S1_CASES[0], { tooMany:true }), lang, 's1cap-tooMany');
        data.S2_CASES.forEach(x => {
          const pl = data.barPlan(x.n, x.d);
          add(d.s2chip(x), lang, 's2chip'); add(d.s2labelA(x.n), lang, 's2labelA'); add(d.s2labelB(x.d), lang, 's2labelB');
          add(d.s2cap(x, pl), lang, 's2cap'); add(d.s2narr(x), lang, 's2narr'); add(d.s2calc(x), lang, 's2calc'); add(d.s2result(x), lang, 's2result');
          if (d.s2result(x).indexOf(rawTextRef(recipRef(x))) < 0) fail(lang + ' s2result does not print the reciprocal');
          if (d.s2calc(x).indexOf(' 1') < 0 && !/= 1$|＝ 1$/.test(d.s2calc(x))) fail(lang + ' s2calc does not end at a product of 1: ' + d.s2calc(x));
          barProblems(lang + ' S2 picture', pl, x.n, x.d, d.s2labelA(x.n), d.s2labelB(x.d)).forEach(fail);
        });
        add(d.s2cap(data.S2_CASES[0], { tooMany:true }), lang, 's2cap-tooMany');
        Object.keys(d.s3rowLabel).forEach(k => add(d.s3rowLabel[k], lang, 's3rowLabel'));
        data.S3_CASES.forEach(sc => {
          const F = data.flipSteps(sc.x, sc.y), pl = data.planFigure(sc.x, sc.y);
          add(d.s3chip(sc), lang, 's3chip');
          for (let step = 0; step <= F.last; step++){
            add(d.s3step(step, F.last), lang, 's3step'); add(d.s3pair(F, step), lang, 's3pair'); add(d.s3narr(F, step), lang, 's3narr'); add(d.s3calc(F, step), lang, 's3calc'); add(d.s3result(F, step), lang, 's3result');
          }
          add(d.s3labelA(pl.a), lang, 's3labelA'); add(d.s3labelB(pl.b), lang, 's3labelB');
          if (d.s3result(F, 0) !== (lang === 'zh' ? '？' : '?')) fail(lang + ' s3result at step 0 already shows a result');
          if (d.s3result(F, F.last).indexOf(fracTextRef(divRef(sc.x, sc.y))) < 0) fail(lang + ' s3result final does not print the answer');
          barProblems(lang + ' S3 picture', pl, pl.a, pl.b, d.s3labelA(pl.a), d.s3labelB(pl.b)).forEach(fail);
        });
        data.S4_CASES.forEach(y => {
          const pl = data.planFigure(data.S4_DIVIDEND, y);
          add(d.s4chip(y), lang, 's4chip'); add(d.s4labelA(pl.a), lang, 's4labelA'); add(d.s4labelB(pl.b), lang, 's4labelB');
          add(d.s4cap(y, pl), lang, 's4cap'); add(d.s4narr(y), lang, 's4narr'); add(d.s4calc(y), lang, 's4calc'); add(d.s4result(y), lang, 's4result');
          if (d.s4result(y).indexOf(fracTextRef(divRef(data.S4_DIVIDEND, y))) < 0) fail(lang + ' s4result does not print the quotient');
          barProblems(lang + ' S4 picture', pl, pl.a, pl.b, d.s4labelA(pl.a), d.s4labelB(pl.b)).forEach(fail);
        });
        add(d.s4cap(data.S4_CASES[0], { tooMany:true }), lang, 's4cap-tooMany');
        data.S5_CASES.forEach(sc => {
          const pl = data.planFigure(sc.x, sc.y), q = fracTextRef(divRef(sc.x, sc.y));
          add(d.s5chip(sc), lang, 's5chip'); add(d.s5stem(sc), lang, 's5stem'); add(d.s5labelA(pl.a), lang, 's5labelA'); add(d.s5labelB(pl.b), lang, 's5labelB');
          /* ⚠️ 兩個量不同種的時候（1 個單位是多少）不畫圖 —— 同一種小格會騙人。 */
          if (sc.kind !== 'count' && d.s5cap(sc, pl).indexOf(lang === 'zh' ? '不同種' : 'different kinds') < 0) fail(lang + ' s5cap(' + sc.id + ') does not say why there is no picture');
          add(d.s5cap(sc, pl), lang, 's5cap'); add(d.s5narr(sc), lang, 's5narr'); add(d.s5calc(sc), lang, 's5calc'); add(d.s5result(sc), lang, 's5result');
          if (d.s5result(sc) !== data.ansText(lang, sc.id, q)) fail(lang + ' s5result(' + sc.id + ') is "' + d.s5result(sc) + '", expected "' + data.ansText(lang, sc.id, q) + '"');
          const stemPlain = d.s5stem(sc).replace(/<[^>]+>/g, '');
          /* ⚠️ 要排除「答案的數字剛好出現在印出來的分數裡」（3/4 裡面有 4）：兩邊都不可以貼著 / 或別的數字 */
        if (new RegExp('(?<![\\d/])' + q + '(?![\\d/])').test(stemPlain) && q !== rawTextRef(sc.x) && q !== rawTextRef(sc.y)) fail(lang + ' s5stem(' + sc.id + ') prints the answer ' + q);
          if (sc.kind === 'count') barProblems(lang + ' S5 picture', pl, pl.a, pl.b, d.s5labelA(pl.a), d.s5labelB(pl.b)).forEach(fail);
        });
        add(d.s5cap(data.S5_CASES[0], { tooMany:true }), lang, 's5cap-tooMany');
        data.ROUNDS.forEach(r => {
          add(d.gPrompt[r.kind](r), lang, 'gPrompt'); add(d.gHint1[r.kind], lang, 'gHint1'); add(d.gHint2[r.kind](r), lang, 'gHint2'); add(d.gCap[r.kind], lang, 'gCap');
          const fig = data.roundFigure(r);
          if (fig){ add(d.gLabelA(r, fig.a), lang, 'gLabelA'); add(d.gLabelB(r, fig.b), lang, 'gLabelB'); barProblems(lang + ' game picture ' + r.kind, fig, fig.a, fig.b, d.gLabelA(r, fig.a), d.gLabelB(r, fig.b)).forEach(fail); }
          r.opts.forEach((o, i) => add(d.gOptText(r, i), lang, 'gOptText'));
          const shown = r.opts.map((o, i) => d.gOptText(r, i));
          if (new Set(shown).size !== 4) fail(lang + ' game ' + r.kind + ' shows two identical options');
          if (r.kind !== 'compare'){
            const keys = shown.map(optKeyRef);
            if (new Set(keys).size !== 4) fail(lang + ' game ' + r.kind + ' shows two options with the same value');
            const ansShown = shown[r.ans];
            if (d.gHint1[r.kind].indexOf(ansShown) >= 0) fail(lang + ' gHint1 for ' + r.kind + ' prints the answer');
          }
          if (r.kind === 'word' && shown.some(s => !parseOptRef(s) || !parseOptRef(s).unit)) fail(lang + ' game word options lack a unit: ' + shown.join(' | '));
        });
        ['contains', 'reciprocal', 'divide', 'compare', 'word'].forEach(k => { add(d.gWrong(5, k), lang, 'gWrong'); add(d.gWrong(0, k), lang, 'gWrong'); });
        add(d.gWin(90), lang, 'gWin');
        ['intro', 'scopeNote', 's1note', 's2note', 's3note', 's4note', 's5note', 'footer', 'next3', 's1lead', 's2lead', 's3lead', 's4lead', 's5lead', 's7lead'].forEach(k => add(d[k], lang, k));
      });
      /* ⚠️ 這幾個字典鍵是用 textContent 寫進畫面的：裡面放標籤，孩子會看到 `<strong>` 這幾個字本身。 */
      const PLAIN_TEXT_KEYS = ['s1cap', 's2cap', 's4cap', 's5cap', 's1cap-tooMany', 's2cap-tooMany', 's4cap-tooMany', 's5cap-tooMany',
                               's1calc', 's2calc', 's3calc', 's4calc', 's5calc', 's1result', 's2result', 's3result', 's4result', 's5result',
                               's3pair', 's3step', 's3chip', 's1chip', 's2chip', 's4chip', 's5chip', 'gCap', 'gOptText',
                               'barLabelA', 'barLabelB', 's2labelA', 's2labelB', 's3labelA', 's3labelB', 's4labelA', 's4labelB', 's5labelA', 's5labelB', 'gLabelA', 'gLabelB'];
      strings.forEach(s => {
        if (PLAIN_TEXT_KEYS.indexOf(s.where) >= 0 && /<(?:[a-z/]|!|\?)/i.test(s.text))
          fail(s.where + ' (' + s.lang + ') contains markup but is written with textContent, so the tags would be shown to the child: "' + s.text.slice(0, 60) + '"');
        if (!s.text.trim()) { if (s.where !== 'gCap') fail(s.where + ' rendered an empty string'); return; }
        stringProblems(s.text, s.lang, s.where).forEach(fail);
        fracArith(s.text).problems.forEach(m => fail(s.where + ' (' + s.lang + '): ' + m + ' in "' + s.text.replace(/<[^>]+>/g, '').slice(0, 70) + '"'));
      });
      const NARRATED_COUNT_REF = 622;
      if (NARRATED_COUNT_REF && strings.length !== NARRATED_COUNT_REF) fail('rendered ' + strings.length + ' dictionary strings, the reference pins ' + NARRATED_COUNT_REF);
      const fp = crypto.createHash('sha1').update(strings.map(s => s.where + '|' + s.lang + '|' + s.text).join('\n')).digest('hex').slice(0, 12);
      const NARRATED_FINGERPRINT_REF = '7f6ffed4a92d';
      if (process.env.PRINT_FP) console.log('FINGERPRINT ' + fp + ' COUNT ' + strings.length);
      if (NARRATED_FINGERPRINT_REF !== 'PENDING' && fp !== NARRATED_FINGERPRINT_REF) fail('the rendered dictionary strings changed (fingerprint ' + fp + ', pinned ' + NARRATED_FINGERPRINT_REF + ') — re-read them, then re-pin');

      /* ---- 8. 題庫神諭：題數、整句題幹、四個選項、正解原文、事實 ---- */
      Object.keys(BANK).forEach(bank => {
        ['zh', 'en'].forEach(lang => {
          const qs = I18N[lang][bank] || [];
          if (qs.length !== BANK[bank].length){ fail(bank + ' (' + lang + ') has ' + qs.length + ' questions, expected ' + BANK[bank].length); return; }
          qs.forEach((q, i) => {
            const ref = BANK[bank][i];
            if (q.stem !== ref[lang]) fail(bank + '[' + i + '] ' + lang + ' stem is not the pinned sentence: ' + q.stem);
            const want = lang === 'zh' ? (ref.ansZh || ref.ans) : (ref.ansEn || ref.ans);
            if (q.opts[q.ans] !== want) fail(bank + '[' + i + '] ' + lang + ' marked option "' + q.opts[q.ans] + '" is not the oracle\'s "' + want + '"');
            if (q.opts.length !== 4 || new Set(q.opts).size !== 4) fail(bank + '[' + i + '] ' + lang + ' options are not four distinct');
            const pinned = lang === 'zh' ? (ref.optsZh || ref.opts) : (ref.optsEn || ref.opts);
            if (!sameList(q.opts, pinned)) fail(bank + '[' + i + '] ' + lang + ' options are not the pinned four: [' + q.opts.join(' | ') + ']');
            const keys = q.opts.map(optKeyRef);
            if (new Set(keys).size !== 4) fail(bank + '[' + i + '] ' + lang + ' two options have the same value: ' + q.opts.join(' | '));
            const ar = fracArith(q.stem + ' ' + q.why + ' ' + q.opts.join(' '));
            ar.problems.forEach(m => fail(bank + '[' + i + '] ' + lang + ': ' + m));
            if (ar.verified < 1) fail(bank + '[' + i + '] ' + lang + ': the explanation should contain an equation to verify, but none was read');
            stringProblems(q.stem, lang, bank + '[' + i + '] stem').forEach(fail);
            stringProblems(q.why, lang, bank + '[' + i + '] why').forEach(fail);
            q.opts.forEach(o => stringProblems(o, lang, bank + '[' + i + '] option').forEach(fail));
            FALSE_KEYS_REF.forEach(k => { if (q.why.indexOf(FALSE_STATEMENTS_REF[k][lang]) >= 0) fail(bank + '[' + i + '] ' + lang + ' why states the misconception "' + FALSE_STATEMENTS_REF[k][lang] + '"'); });
          });
        });
      });
      BANK_FACTS.forEach(f => {
        if (f.div){
          const x = { n:f.div[0], d:f.div[1] }, y = { n:f.div[2], d:f.div[3] }, q = divRef(x, y);
          if (f.q !== undefined && fracTextRef(q) !== f.q) fail('bank fact: ' + rawTextRef(x) + ' ÷ ' + rawTextRef(y) + ' is ' + fracTextRef(q) + ', the bank says ' + f.q);
          if (f.side !== undefined && cmpRef(q, x) !== f.side) fail('bank fact: the quotient side of ' + rawTextRef(x) + ' ÷ ' + rawTextRef(y) + ' is ' + cmpRef(q, x));
        }
        if (f.mul){ const x = { n:f.mul[0], d:f.mul[1] }, y = { n:f.mul[2], d:f.mul[3] }; if (fracTextRef(mulRef(x, y)) !== f.p) fail('bank fact: ' + rawTextRef(x) + ' × ' + rawTextRef(y) + ' is ' + fracTextRef(mulRef(x, y))); }
        if (f.recip){ const x = { n:f.recip[0], d:f.recip[1] }; if (rawTextRef(recipRef(x)) !== f.r) fail('bank fact: the reciprocal of ' + rawTextRef(x) + ' is ' + rawTextRef(recipRef(x))); }
      });
      const whyFp = crypto.createHash('sha1').update(['zh', 'en'].map(lang => Object.keys(BANK).map(bank => (I18N[lang][bank] || []).map(q => q.why).join('\n')).join('\n')).join('\n')).digest('hex').slice(0, 12);
      if (process.env.PRINT_FP) console.log('BANK_WHY_FINGERPRINT ' + whyFp);
      if (BANK_WHY_FINGERPRINT_REF !== 'PENDING' && whyFp !== BANK_WHY_FINGERPRINT_REF) fail('the quiz explanations changed (fingerprint ' + whyFp + ', pinned ' + BANK_WHY_FINGERPRINT_REF + ') — re-read them, then re-pin');
      const spread = new Set();
      Object.keys(BANK).forEach(bank => (I18N.zh[bank] || []).forEach(q => spread.add(q.ans)));
      if (spread.size < 3) fail('quiz answers use only ' + spread.size + ' positions');

      /* ---- 9. 跨頁釘樁 ---- */
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
            keys.forEach(k => { if (typeof dict[lang][k] === 'string'){ text += dict[lang][k] + '\n'; dictStrings[file].push({ text:dict[lang][k], lang, table:false }); stringProblems(dict[lang][k], lang, file + '.' + lang + '.' + k).forEach(fail); fracArith(dict[lang][k]).problems.forEach(m => fail(file + '.' + lang + '.' + k + ': ' + m)); } });
            Object.keys(dict[lang]).forEach(k => { if (Array.isArray(dict[lang][k])) dict[lang][k].forEach((row, ri) => { const cell = Array.isArray(row) ? row.join(' ') : String(row); text += cell + '\n'; dictStrings[file].push({ text:cell, lang, table:true, cells:Array.isArray(row) ? row.map(String) : [String(row)] }); stringProblems(cell, lang, file + '.' + lang + '.' + k + '[' + ri + ']').forEach(fail); (Array.isArray(row) ? row : [row]).forEach(c => fracArith(c).problems.forEach(m => fail(file + '.' + lang + '.' + k + '[' + ri + ']: ' + m))); }); });
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
        const markupPart = visibleText(split > 0 ? raw.slice(0, split) : raw);
        const dictPart = visibleText(split > 0 ? raw.slice(split) : '');
        const inMarkup = markupPart.indexOf(rule.text) >= 0;
        let live;
        if (rule.file === 'index') live = inMarkup || renderedAll.indexOf(rule.text) >= 0;
        else if (rule.file === 'review') live = inMarkup || dictPart.indexOf(rule.text) >= 0 || visibleText(raw).indexOf(rule.text) >= 0;
        else live = inMarkup || renderedDictText(rule.file).indexOf(rule.text) >= 0;
        if (!live) fail(rule.file + '.html has "' + rule.text + '" in its source but not anywhere a reader would see it');
      });
      FORBIDDEN.forEach(rule => {
        const text = TEXT[rule.file];
        if (text !== undefined && text.indexOf(rule.text) >= 0) fail(rule.file + '.html says "' + rule.text + '", which ' + rule.why);
      });
      ['index', 'reference', 'review', 'parents'].forEach(f => {
        if (TEXT[f] === undefined) return;
        const m = DECIMAL_RE.exec(TEXT[f]);
        if (m) fail(f + '.html writes a decimal ("' + TEXT[f].slice(Math.max(0, m.index - 12), m.index + 12).replace(/\s+/g, ' ') + '") — decimal division is handed to a later lesson');
      });
      /* 六句「假的」規則只能出現在句庫／試題選項／速查卡「這句話 對不對」表裡標成錯的那一列；散文裡出現就是把迷思寫成事實。 */
      const normRule = x => String(x).replace(/必定|總是|永遠|一律/g, '一定').replace(/\b(invariably|without exception)\b/gi, 'always');
      const idxMarkup = normRule(visibleText(src.slice(0, src.indexOf('var I18N = {'))));
      FALSE_KEYS_REF.forEach(k => {
        ['zh', 'en'].forEach(lang => {
          const sentence = FALSE_STATEMENTS_REF[k][lang];
          if (idxMarkup.indexOf(sentence) >= 0) fail('index.html markup states the misconception "' + sentence + '" as prose');
          strings.forEach(x => { if (x.where !== 'gOptText' && normRule(x.text).indexOf(sentence) >= 0) fail(x.where + ' (' + x.lang + ') states the misconception "' + sentence + '"'); });
          ['reference', 'parents'].forEach(f => {
            if (RAW[f] === undefined) return;
            const markup = normRule(visibleText(RAW[f].slice(0, RAW[f].indexOf('var I18N = {'))));
            if (markup.indexOf(sentence) >= 0) fail(f + '.html markup states the misconception "' + sentence + '" as prose');
            (dictStrings[f] || []).forEach(x => {
              if (normRule(x.text).indexOf(sentence) < 0) return;
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
          const text = TEXT[f].replace(/\s+/g, ' ');
          let at = -1;
          while ((at = text.indexOf(rule.word, at + 1)) >= 0){
            const BOUND = /[；。;!?]|\.["'”’」』)\]）】]*(?=\s|$)/g;
            let start = 0, bm;
            const head = text.slice(0, at);
            while ((bm = BOUND.exec(head)) !== null) start = bm.index + 1;
            const endM = text.slice(at).search(/[；。;!?]|\.["'”’」』)\]）】]*(?=\s|$)/);
            const end = endM < 0 ? text.length : at + endM;
            const sentence = text.slice(start, end);
            if (!rule.near.some(n => sentence.indexOf(n) >= 0))
              fail(f + '.html mentions "' + rule.word + '" without saying where it belongs (expected one of ' + rule.near.join('/') + ' in the same sentence): "' + sentence.slice(0, 80) + '"');
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
      if (!/teachme-last[\s\S]{0,90}grade-6\/math\/divide-fraction\//.test(src)) fail('index.html does not record teachme-last for grade-6/math/divide-fraction/');

      /* ---- 9b. 四頁 markup（讀者一打開就看到的中文）的排版 ---- */
      ['index', 'reference', 'review', 'parents'].forEach(f => {
        if (RAW[f] === undefined) return;
        const cut = RAW[f].indexOf('<script'); const markup = visibleText(cut > 0 ? RAW[f].slice(0, cut) : RAW[f]).replace(/\s+/g, ' ');
        const glued = markup.match(/.{0,6}(?:\p{Script=Han}\d|\d\p{Script=Han}).{0,6}/u);
        if (glued) fail(f + '.html markup glues Chinese to a digit: "' + glued[0] + '"');
        const dbl = markup.match(/。。|，，|！！|？？|；；|：：/);
        if (dbl) fail(f + '.html markup has doubled punctuation "' + dbl[0] + '"');
        fracArith(markup).problems.forEach(m => fail(f + '.html markup: ' + m));
      });

      /* ---- 10. 產生器清單：把 review.html 的 GENS 真的跑起來比 id；抽樣池逐字釘住；句庫真值表一致 ---- */
      const rv = RAW['review'];
      if (rv !== undefined){
        const i0 = rv.indexOf('/* ---------- 工具 ---------- */');
        const i1 = rv.indexOf('/* ---------- 出一批');
        if (i0 < 0 || i1 < 0 || i0 > i1) fail('cannot slice the generator block out of review.html');
        else {
          let GENS = null, STM = null;
          try { const got = new Function(rv.slice(i0, i1) + '\n; return {GENS, STATEMENTS};')(); GENS = got.GENS; STM = got.STATEMENTS; }
          catch (e){ fail('review.html generator block does not run on its own: ' + e.message); }
          if (GENS){
            const ids = GENS.map(g => g.id);
            GEN_IDS.forEach(id => { if (ids.indexOf(id) < 0) fail('review.html no longer declares the generator "' + id + '"'); });
            ids.forEach(id => { if (GEN_IDS.indexOf(id) < 0) fail('review.html declares an extra generator "' + id + '" that this config does not describe'); });
            if (ids.length !== GEN_IDS.length) fail('review.html has ' + ids.length + ' generators, expected ' + GEN_IDS.length);
            GENS.forEach(g => { if (typeof g.make !== 'function') fail('generator ' + g.id + ' has no make()'); if (typeof g.fmt !== 'function') fail('generator ' + g.id + ' has no fmt()'); });
          }
          if (STM){
            Object.keys(TRUE_STATEMENTS_REF).forEach(k => { if (!STM[k] || STM[k].truth !== true || STM[k].zh !== TRUE_STATEMENTS_REF[k].zh || STM[k].en !== TRUE_STATEMENTS_REF[k].en) fail('review.html statement "' + k + '" is not the pinned true sentence'); });
            FALSE_KEYS_REF.forEach(k => { if (!STM[k] || STM[k].truth !== false || STM[k].zh !== FALSE_STATEMENTS_REF[k].zh || STM[k].en !== FALSE_STATEMENTS_REF[k].en) fail('review.html statement "' + k + '" is not the pinned false sentence'); });
            if (Object.keys(STM).length !== Object.keys(TRUE_STATEMENTS_REF).length + FALSE_KEYS_REF.length) fail('review.html has ' + Object.keys(STM).length + ' statements, the truth table has ' + (Object.keys(TRUE_STATEMENTS_REF).length + FALSE_KEYS_REF.length));
          }
        }
        /* ⚠️ 「除數剛好是 1」的邊界要**確定性**地證明，不能靠抽幾千次碰運氣（機率低的分支會讓檢查時綠時紅，
           而且抽到了也只證明這一次抽到，不是結構上抽得到）。做法：把除數池讀出來逐一看，
           三種情形（比 1 小／剛好 1／比 1 大）都必須在池子裡；抽樣那一行本身由 REVIEW_PINS 釘住。 */
        try {
          const i2 = rv.indexOf('/* ---------- 工具 ---------- */'), i3 = rv.indexOf('/* ---------- 出一批');
          const POOL = new Function(rv.slice(i2, i3) + '\n; return POOL_DIVISOR;')();
          if (!Array.isArray(POOL) || !POOL.length) fail('review.html no longer exposes a compareSide divisor pool');
          else {
            const sides = { below:0, one:0, above:0 };
            POOL.forEach(k => {
              const pr = k.split('/'), y = { n:Number(pr[0]), d:Number(pr[1]) };
              const c = cmpRef(y, ONE_REF);
              if (c < 0) sides.below++; else if (c === 0) sides.one++; else sides.above++;
            });
            if (!sides.below || !sides.one || !sides.above)
              fail('the compareSide divisor pool cannot produce all three conclusions (below 1 / exactly 1 / above 1): ' + JSON.stringify(sides));
          }
        } catch (e){ fail('cannot read review.html compareSide divisor pool: ' + e.message); }
        const rvLive = stripJsComments(rv);
        REVIEW_PINS.forEach(p => { if (rvLive.indexOf(p) < 0) fail('review.html no longer contains the sampling line "' + p.slice(0, 60) + '…"'); });
      }
    }
  },

  breaks: [
    /* --- 版面常數與畫布 --- */
    { file:'index', via:'index', expect:'layout constant BAR_X0',
      find:'var U = 21, UGAP = 3, BAR_X0 = 20;',
      replace:'var U = 21, UGAP = 3, BAR_X0 = 40;',
      why:'the bars would start 20px right of where the checker measures them and 18 cells would clip the canvas' },
    { file:'index', via:'index', expect:'a canvas viewBox is',
      find:'<svg class="barfig" id="s1fig" viewBox="0 0 460 130"',
      replace:'<svg class="barfig" id="s1fig" viewBox="0 0 460 120"',
      why:'the bottom bar would be drawn in a shorter coordinate system than it uses' },
    { file:'index', via:'index', expect:'in CSS but the viewBox is',
      find:'.barfig{width:100%;max-width:460px;height:130px;display:block;margin:0 auto}',
      replace:'.barfig{width:100%;max-width:460px;height:160px;display:block;margin:0 auto}',
      why:'the picture would be letterboxed inside a taller box' },

    /* --- 有理數函式：兩套實作要一致，壞輸入要 fail closed --- */
    { file:'index', via:'index', expect:'gcd does not fail closed',
      find:'function gcd(a, b){\n    if (!isPosInt(a) || !isPosInt(b)) return null;',
      replace:'function gcd(a, b){\n    if (!isPosInt(a) && !isPosInt(b)) return null;',
      why:'gcd(0, 5) would run the loop on a zero term instead of refusing' },
    { file:'index', via:'index', expect:'simplify / recip do not fail closed',
      find:'function recip(x){ return !isFrac(x) ? null : { n:x.d, d:x.n }; }',
      replace:'function recip(x){ return { n:x.d, d:x.n }; }',
      why:'0 would be given a reciprocal, which the whole lesson says does not exist' },
    { file:'index', via:'index', expect:'cross-multiplying says',
      find:'  function div(x, y){ var r = recip(y); return r === null ? null : mul(x, r); }',
      replace:'  function div(x, y){ return (!isFrac(x) || !isFrac(y)) ? null : mul(x, y); }',
      why:'every division on the page would multiply instead of flipping the divisor first' },
    { file:'index', via:'index', expect:'but the computed quotient says',
      find:'    return l === r ? 0 : (l > r ? 1 : -1);',
      replace:'    return l === r ? 0 : (l < r ? 1 : -1);',
      why:'every size comparison would be the wrong way round' },
    { file:'index', via:'index', expect:'the rule (divisor vs 1) says',
      find:'  function quotientSide(y){ var c = cmp(y, ONE); return c === null ? null : -c; }',
      replace:'  function quotientSide(y){ var c = cmp(y, ONE); return c === null ? null : c; }',
      why:'the lesson would claim the quotient grows exactly when it actually shrinks' },
    { file:'index', via:'index', expect:'fracText / rawText do not print ?',
      find:"    return s === null ? '?' : (s.d === 1 ? String(s.n) : s.n + '/' + s.d);",
      replace:"    return s === null ? '' : (s.d === 1 ? String(s.n) : s.n + '/' + s.d);",
      why:'a broken value would render as an empty gap instead of a visible ?' },

    /* --- 通分的計畫（圖與「為什麼」共用的那一塊） --- */
    { file:'index', via:'index', expect:'divPlan(',
      find:'    var N = x.n * y.d;           /* 被除數有幾小格 */',
      replace:'    var N = x.n * y.n;           /* 被除數有幾小格 */',
      why:'the dividend would be converted to the common denominator wrongly, so the picture and the reason both lie' },
    { file:'index', via:'index', expect:'divPlan tooMany is wrong',
      find:'             tooMany:N > MAX_UNITS || C > MAX_UNITS };',
      replace:'             tooMany:N > 400 || C > 400 };',
      why:'a 30-cell bar would be reported as drawable and then run off the canvas' },
    { file:'index', via:'index', expect:'flipSteps row 3 is',
      find:"      { key:'flip',   expr:rawText(x) + ' × ' + rawText(p.flip) + ' ＝ ' + rawText(p.raw) },",
      replace:"      { key:'flip',   expr:rawText(x) + ' × ' + rawText(x) + ' ＝ ' + rawText(p.raw) },",
      why:'the step that shows WHY the flip works would multiply by the wrong fraction' },
    { file:'index', via:'index', expect:'flipSteps rows are',
      find:"      { key:'cells',  expr:p.N + ' ÷ ' + p.C },",
      replace:"      { key:'count',  expr:p.N + ' ÷ ' + p.C },",
      why:'a step could be renamed and the row labels would stop matching the table' },

    /* --- 圖：從畫出來的東西量回來 --- */
    { file:'index', via:'index', expect:'tooMany flag is false',
      find:'    var tooMany = !isPosInt(a) || !isPosInt(b) || a > MAX_UNITS || b > MAX_UNITS;',
      replace:'    var tooMany = !isPosInt(a) || !isPosInt(b);',
      why:'a 20-cell bar would be drawn straight off the right edge of the canvas' },
    { file:'index', via:'index', expect:'equal spacing from the left',
      find:"      for (var i = 0; i < a; i++) cells.push({ row:'a', x:BAR_X0 + i * (U + UGAP), y:ROW_A_Y, w:U, h:U });",
      replace:"      for (var i = 0; i < a; i++) cells.push({ row:'a', x:BAR_X0 + i * U, y:ROW_A_Y, w:U, h:U });",
      why:'the top bar cells would touch each other while the bottom bar keeps its gaps' },
    { file:'index', via:'index', expect:'cells for the dividend',
      find:'      for (var i = 0; i < a; i++) cells.push',
      replace:'      for (var i = 1; i < a; i++) cells.push',
      why:'the top bar would always be one cell short, so the child would count the wrong answer' },

    /* --- 範例的案例 --- */
    { file:'index', via:'index', expect:'S1_CASES is',
      find:'    { x:{ n:2, d:3 }, y:{ n:1, d:6 } }    /* 2/3 ÷ 1/6 ＝ 4 */',
      replace:'    { x:{ n:2, d:3 }, y:{ n:1, d:5 } }    /* 2/3 ÷ 1/6 ＝ 4 */',
      why:'the example would stop having a whole-number answer while the comment still claims 4' },
    { file:'index', via:'index', expect:'S2_CASES is',
      find:'  var S2_CASES = [{ n:2, d:3 }, { n:5, d:1 }, { n:1, d:4 }, { n:8, d:5 }];',
      replace:'  var S2_CASES = [{ n:2, d:3 }, { n:5, d:2 }, { n:1, d:4 }, { n:8, d:5 }];',
      why:'the whole-number example (5 = 5/1) would disappear, and with it the "write it over 1" step' },
    { file:'index', via:'index', expect:'S3_CASES is',
      find:'    { x:{ n:4, d:3 }, y:{ n:2, d:3 } }    /* 12 ÷ 6 ＝ 2（除得盡，寫整數） */',
      replace:'    { x:{ n:4, d:5 }, y:{ n:2, d:3 } }    /* 12 ÷ 6 ＝ 2（除得盡，寫整數） */',
      why:'the only example with a whole-number answer would vanish while the comment still says 2' },
    { file:'index', via:'index', expect:'S4_CASES is',
      find:'  var S4_CASES = [{ n:1, d:2 }, { n:2, d:3 }, { n:1, d:1 }, { n:3, d:2 }];',
      replace:'  var S4_CASES = [{ n:1, d:2 }, { n:2, d:3 }, { n:1, d:4 }, { n:3, d:2 }];',
      why:'the divisor of exactly 1 would disappear, so the "stays the same" case would never be shown' },
    { file:'index', via:'index', expect:'S5_CASES is',
      find:"    { id:'sugar',  kind:'unit',  x:{ n:4, d:1 }, y:{ n:2, d:3 } }    /* 2/3 公斤賣 4 元 → 1 公斤賣 6 元 */",
      replace:"    { id:'sugar',  kind:'count', x:{ n:4, d:1 }, y:{ n:2, d:3 } }    /* 2/3 公斤賣 4 元 → 1 公斤賣 6 元 */",
      why:'the second "how much is one unit" example would silently become a counting question' },

    /* --- 小遊戲 --- */
    { file:'index', via:'index', expect:'roundAnswerIndex()',
      find:"{ kind:'divide', x:{ n:2, d:3 }, y:{ n:4, d:5 }, opts:['8/15', '6/5', '5/6', '15/8'], ans:2 },",
      replace:"{ kind:'divide', x:{ n:2, d:3 }, y:{ n:4, d:5 }, opts:['8/15', '6/5', '5/6', '15/8'], ans:3 },",
      why:'the declared answer slot would disagree with the computed quotient' },
    { file:'index', via:'index', expect:'the marked conclusion is',
      find:"{ kind:'compare', x:{ n:5, d:8 }, y:{ n:3, d:4 }, opts:['smaller', 'same', 'cannot', 'bigger'], ans:3 },",
      replace:"{ kind:'compare', x:{ n:5, d:8 }, y:{ n:3, d:4 }, opts:['smaller', 'same', 'cannot', 'bigger'], ans:0 },",
      why:'the game would mark "smaller" correct although the divisor is below 1' },
    { file:'index', via:'index', expect:'two options have the same value',
      find:"{ kind:'divide', x:{ n:2, d:3 }, y:{ n:4, d:5 }, opts:['8/15', '6/5', '5/6', '15/8'], ans:2 },",
      replace:"{ kind:'divide', x:{ n:2, d:3 }, y:{ n:4, d:5 }, opts:['8/15', '6/5', '5/6', '10/12'], ans:2 },",
      why:'two options would be the same number written two ways, so the child really sees three' },
    { file:'index', via:'index', expect:'gHint1 for divide prints the answer',
      find:"        divide:'先把除數翻過來，再把除法改成乘法。',",
      replace:"        divide:'先把除數翻過來，再把除法改成乘法，答案是 5/6。',",
      why:'the first-level hint would give the answer away' },
    { file:'index', via:'index', expect:'the "just multiply" distractor',
      find:"    { kind:'contains', x:{ n:2, d:1 }, y:{ n:1, d:3 }, opts:['6', '1/6', '2/3', '3'], ans:0 },",
      replace:"    { kind:'contains', x:{ n:2, d:1 }, y:{ n:1, d:3 }, opts:['6', '1/6', '5/6', '3'], ans:0 },",
      why:'the misconception this round exists to catch (just multiply) would vanish from the options' },

    /* --- 題庫神諭 --- */
    { file:'index', via:'index', expect:'marked option',
      find:"        { stem:'<strong>3/4 ÷ 2/3</strong> 是多少？',\n          opts:['1/2', '9/8', '8/9', '2'], ans:1,",
      replace:"        { stem:'<strong>3/4 ÷ 2/3</strong> 是多少？',\n          opts:['1/2', '9/8', '8/9', '2'], ans:2,",
      why:'the answer key would point at the upside-down quotient' },
    { file:'index', via:'index', expect:'stem is not the pinned sentence',
      find:"        { stem:'<strong>9/4 ÷ 3/8</strong> 是多少？',",
      replace:"        { stem:'<strong>9/4 ÷ 3/5</strong> 是多少？',",
      why:'the question would ask about a different division while keeping the old answer' },
    { file:'index', via:'index', expect:'this claim is wrong',
      find:"          why:'3/8 的倒數是 8/3，9/4 × 8/3 ＝ 72/12 ＝ 6。",
      replace:"          why:'3/8 的倒數是 8/3，9/4 × 8/3 ＝ 72/12 ＝ 7。",
      why:'an explanation would teach a wrong value' },
    { file:'index', via:'index', expect:'options are not the pinned four',
      find:"          opts:['27/32', '1/6', '6', '32/27'], ans:2,\n          why:'3/8 的倒數是 8/3",
      replace:"          opts:['27/32', '1/7', '6', '32/27'], ans:2,\n          why:'3/8 的倒數是 8/3",
      why:'a distractor could be swapped for another without anyone re-reading the set' },
    { file:'index', via:'index', expect:'the quiz explanations changed',
      find:"          why:'倒數就是把分子和分母對調：2/7 的倒數是 7/2。",
      replace:"          why:'倒數就是把分子跟分母對調：2/7 的倒數是 7/2。",
      why:'an explanation could be reworded without anyone re-reading it' },

    /* --- 渲染出來的字串 --- */
    { file:'index', via:'index', expect:'glues Chinese to a digit',
      find:"        if (step === 2) return '第 2 步：格子一樣大，就數格子 —— ' + p.N + ' ÷ ' + p.C + '。';",
      replace:"        if (step === 2) return '第2 步：格子一樣大，就數格子 —— ' + p.N + ' ÷ ' + p.C + '。';",
      why:'Chinese and a digit would run together on screen' },
    { file:'index', via:'index', expect:'the rendered dictionary strings changed',
      find:"      s2labelA:function(n){ return '分子 ' + n + ' 格'; },",
      replace:"      s2labelA:function(n){ return '分子是 ' + n + ' 格'; },",
      why:'a bar label could be reworded without anyone re-reading it (count unchanged, fingerprint changed)' },
    { file:'index', via:'index', expect:'states the misconception',
      find:'<p class="lead" data-i18n="s2lead">兩個數<strong>相乘等於 1</strong>',
      replace:'<p class="lead" data-i18n="s2lead">一個分數的倒數一定比它大。兩個數<strong>相乘等於 1</strong>',
      why:'a false rule would be stated as prose in the lesson' },
    { file:'index', via:'index', expect:'states the misconception',
      find:'<p class="lead" data-i18n="s3lead">先把兩個分數<strong>通分</strong>',
      replace:'<p class="lead" data-i18n="s3lead">除法算出來的商<strong>一定</strong>比被除數小。先把兩個分數<strong>通分</strong>',
      why:'a misconception split by an inline tag would slip past a source-literal scan' },
    { file:'index', via:'index', expect:'writes a mixed number',
      find:"3/2 的倒數是 2/3（變小），1 的倒數還是 1（不變）。'",
      replace:"3/2 的倒數是 2/3（變小），1 的倒數還是 1（不變）。3/2 也可以寫成 1 又 1/2。'",
      why:'a mixed number would sneak in although this lesson writes answers as improper fractions' },
    { file:'index', via:'index', expect:'writes a power',
      find:'<strong>除數比 1 小，商就比被除數大</strong>。\n  </footer>',
      replace:'<strong>除數比 1 小，商就比被除數大</strong>（2² ＝ 4）。\n  </footer>',
      why:'a power would sneak into the footer' },
    { file:'index', via:'index', expect:'writes a decimal',
      find:'5 = 5/1, so its reciprocal is 1/5.',
      replace:'5 = 5/1, so its reciprocal is 0.2.',
      why:'a decimal would appear although decimal division belongs to a later lesson' },
    { file:'index', via:'index', expect:'mentions "分數乘法" without saying where it belongs',
      find:"      scopeNote:'這一課只做五件事：把<strong>除以分數</strong>",
      replace:"      scopeNote:'分數乘法以前教過。這一課只做五件事：把<strong>除以分數</strong>",
      why:'fraction multiplication would be mentioned without handing it to grade 5' },
    { file:'index', via:'index', expect:'singular/plural slip',
      find:"  function plEn(n, w){\n    if (n === 1) return n + ' ' + w;",
      replace:"  function plEn(n, w){\n    if (n === 0) return n + ' ' + w;",
      why:'"1 cells" would be printed on every single-cell bar' },
    { file:'index', via:'index', expect:'does not record teachme-last',
      find:"{p:'grade-6/math/divide-fraction/', zh:",
      replace:"{p:'grade-6/math/divide-fractions/', zh:",
      why:'the home page would resume into a dead link' },
    { file:'index', via:'index', expect:'says "乘以它的倒數"',
      find:'<h2 data-i18n="s3h2">為什麼除以分數，就是乘以倒數</h2>',
      replace:'<h2 data-i18n="s3h2">為什麼除以分數，就是乘以它的倒數</h2>',
      why:'the lesson wording would drift in one heading and the pinned count would change' },
    { file:'index', via:'index', expect:'no longer wires the drawing',
      find:"    drawBars(s1fig, pl, d.barLabelA(pl.a), d.barLabelB(pl.b));",
      replace:"    /* drawBars(s1fig, pl, d.barLabelA(pl.a), d.barLabelB(pl.b)); */",
      why:'the pinned line would survive inside a comment while the figure went blank' },
    { file:'index', via:'index', expect:'draws into the same target more than once',
      find:"    drawBars(s1fig, pl, d.barLabelA(pl.a), d.barLabelB(pl.b));",
      replace:"    drawBars(s1fig, pl, d.barLabelA(pl.a), d.barLabelB(pl.b)); drawBars(s1fig, barPlan(2, 3), '', '');",
      why:'the pinned call would survive while a second call painted a different plan over it' },
    { file:'index', via:'index', expect:'"s1fig" appears 5 time(s)',
      find:"    drawBars(s1fig, pl, d.barLabelA(pl.a), d.barLabelB(pl.b));",
      replace:"    drawBars(s1fig, pl, d.barLabelA(pl.a), d.barLabelB(pl.b)); s1fig.appendChild(svgEl('rect', { x:0, y:0, width:10, height:10 }));",
      why:'an extra cell appended past the renderer would change what the child counts while every measured plan stays valid' },

    /* --- 速查卡與家長頁 --- */
    { file:'reference', via:'index', expect:'outside the statement cell of a row marked wrong',
      find:"        ['除法算出來的商一定比被除數小', '<strong>錯</strong>', '3 ÷ 1/4 ＝ 12，比 3 大'],",
      replace:"        ['除法算出來的商一定比被除數小', '<strong>對</strong>', '3 ÷ 1/4 ＝ 12，比 3 大'],",
      why:'the cheat sheet would mark a misconception as true' },
    { file:'reference', via:'index', expect:'this claim is wrong',
      find:"        ['兩個數相乘等於 1，它們就互為倒數', '<strong>對</strong>', '2/3 × 3/2 ＝ 6/6 ＝ 1'],",
      replace:"        ['兩個數相乘等於 1，它們就互為倒數', '<strong>對</strong>', '2/3 × 3/2 ＝ 6/6 ＝ 2'],",
      why:'a table example would teach a wrong product' },
    { file:'reference', via:'index', expect:'reference.html says',
      find:"      d2:'<strong>把除數翻過來</strong>（分子分母對調），<strong>÷ 改成 ×</strong>。被除數<strong>不動</strong>。',",
      replace:"      d2:'<strong>把除數翻過來</strong>（分子與分母對調），<strong>÷ 改成 ×</strong>。被除數<strong>不動</strong>。',",
      why:'the cheat sheet would stop using the lesson wording for how a reciprocal is formed' },
    { file:'parents', via:'index', expect:'parents.html markup states the misconception',
      find:'「所以要看<strong>除數和 1 比</strong>：除數比 1 小，商就比被除數大。」</td>',
      replace:'「除法算出來的商一定比被除數小，所以要看<strong>除數和 1 比</strong>：除數比 1 小，商就比被除數大。」</td>',
      why:'a misconception would be stated as fact in the parents page' },
    { file:'parents', via:'index', expect:'mentions "小數除法" without saying where it belongs',
      find:"      s5note:'⚠️ 這一課刻意<strong>不重教</strong>",
      replace:"      s5note:'⚠️ 小數除法留給後面的課。這一課刻意<strong>不重教</strong>",
      why:'decimal division would be mentioned without being handed off' },

    /* --- review.html：設定檔從 index 那一側看的 --- */
    { file:'review', via:'index', expect:'no longer declares the generator "wordUnit"',
      find:"    { id:'wordUnit', cat:'word',",
      replace:"    { id:'wordUnit2', cat:'word',",
      why:'a generator could be renamed or dropped and its invariants would silently stop running' },
    { file:'review', via:'index', expect:'no longer contains the sampling line',
      find:'var POOL_PROPER = FRACS.filter(function(s){ var f = fracOf(s); return f.n < f.d && f.d <= 9; });',
      replace:'var POOL_PROPER = FRACS.filter(function(s){ var f = fracOf(s); return f.n < f.d && f.d <= 12; });',
      why:'the word problems could sample denominators the picture and the limits were never checked for' },
    { file:'review', via:'index', expect:'is not the pinned false sentence',
      find:"    quotientSmaller:  { truth:false, zh:'除法算出來的商一定比被除數小',",
      replace:"    quotientSmaller:  { truth:true, zh:'除法算出來的商一定比被除數小',",
      why:'"a quotient is always smaller" would become an accepted answer' },

    /* --- review.html：simgen 那一側 --- */
    { file:'review', via:'review', expect:'the rendered stem is not the rebuilt sentence',
      find:"          stem: lang === 'zh' ? '<strong>' + rawText(x) + ' ÷ ' + rawText(y) + '</strong> 是多少？（寫成最簡分數）' : 'What is <strong>' + rawText(x) + ' ÷ ' + rawText(y) + '</strong>? (simplest form)',\n          opts: d.opts.slice(), ans:d.ans,\n          why: lang === 'zh'\n            ? '除以分數要乘以除數的倒數：'",
      replace:"          stem: lang === 'zh' ? '<strong>' + rawText(x) + ' ÷ ' + rawText(y) + '</strong> 是多少？' : 'What is <strong>' + rawText(x) + ' ÷ ' + rawText(y) + '</strong>? (simplest form)',\n          opts: d.opts.slice(), ans:d.ans,\n          why: lang === 'zh'\n            ? '除以分數要乘以除數的倒數：'",
      why:'a stem could be reworded without the oracle noticing' },
    { file:'review', via:'review', expect:'copies a number the stem prints',
      find:"        var cands = [fracText(mul(x, y)), fracText(div(y, x)), fracText({ n:m * y.d, d:1 })];\n        var wrongs = pickWrongs(fracText(q), cands, fracFallbacks(q), avoidOf([m]));\n        var o = optsOf(fracText(q), wrongs);\n        return { m:m, yn:y.n, yd:y.d, opts:o.opts, ans:o.ans };",
      replace:"        var cands = [String(m), fracText(mul(x, y)), fracText(div(y, x))];\n        var wrongs = pickWrongs(fracText(q), cands, fracFallbacks(q), []);\n        var o = optsOf(fracText(q), wrongs);\n        return { m:m, yn:y.n, yd:y.d, opts:o.opts, ans:o.ans };",
      why:'a distractor would repeat the whole number the stem prints' },
    { file:'review', via:'review', expect:'two of the four expressions have the same value',
      find:'        var ys = POOL_SMALL.filter(function(s){ var f = fracOf(s); return !(f.n === x.n && f.d === x.d) && !(f.n === x.d && f.d === x.n); });',
      replace:'        var ys = POOL_SMALL;',
      why:'two of the four expressions would be correct whenever the divisor equals the dividend' },
    { file:'review', via:'review', expect:'the "just multiply" distractor',
      find:"        var cands = [fracText({ n:a, d:y.d }), fracText({ n:1, d:a * y.d }), String(a + y.d)];",
      replace:"        var cands = [fracText({ n:1, d:a * y.d }), String(a + y.d)];",
      why:'the misconception this question exists to catch would vanish from the options' },
    { file:'review', via:'review', expect:'option has no unit',
      find:"          opts: d.opts.map(function(t){ return ansText(lang, d.id, t); }), ans:d.ans,\n          why: lang === 'zh'\n            ? rawText(y) + ' 個單位對應 '",
      replace:"          opts: d.opts.slice(), ans:d.ans,\n          why: lang === 'zh'\n            ? rawText(y) + ' 個單位對應 '",
      why:'the unit-rate answers would lose their units' },
    { file:'review', via:'review', expect:'opts[ans]',
      find:"        var q = mul(x, y);\n        var cands = [fracText(div(x, y)), fracText({ n:x.n * y.n, d:x.d }), fracText({ n:x.n, d:x.d * y.d })];",
      replace:"        var q = div(x, y);\n        var cands = [fracText(mul(x, y)), fracText({ n:x.n * y.n, d:x.d }), fracText({ n:x.n, d:x.d * y.d })];",
      why:'the grade-5 multiplication question would silently become a division' },
    { file:'review', via:'review', expect:'is not in simplest form',
      find:'  function fracText(x){ return rawText(simplify(x)); }',
      replace:'  function fracText(x){ return rawText(x); }',
      why:'answers would be printed unsimplified (10/12 instead of 5/6)' },
    { file:'review', via:'review', expect:'interDivInt: opts[ans]',
      find:"        var q = div(x, { n:k, d:1 });\n        var cands = [fracText({ n:x.n * k, d:x.d }), fracText(mul(x, { n:k, d:1 })), fracText({ n:k, d:x.d })];",
      replace:"        var q = mul(x, { n:k, d:1 });\n        var cands = [fracText({ n:x.n * k, d:x.d }), fracText(div(x, { n:k, d:1 })), fracText({ n:k, d:x.d })];",
      why:'the grade-5 "fraction divided by a whole number" question would multiply instead' },

    /* --- 第一輪 codex 審查之後補的守衛 --- */
    { file:'index', via:'index', expect:'a CSS rule hides the figure',
      find:'  .figcap{margin-top:8px;font-size:14px;color:var(--muted);text-align:center}',
      replace:'  .figcap{margin-top:8px;font-size:14px;color:var(--muted);text-align:center}\n  .barfig rect{display:none}',
      why:'every cell could be hidden by CSS while the plan geometry, the call pins and the canvas counts all stayed green' },
    { file:'index', via:'index', expect:'the reference says',
      find:'  function mul(x, y){ return (!isFrac(x) || !isFrac(y)) ? null : simplify({ n:x.n * y.n, d:x.d * y.d }); }',
      replace:'  function mul(x, y){ return (!isFrac(x) || !isFrac(y)) ? null : simplify({ n:x.n * y.d, d:x.d * y.n }); }',
      why:'multiplication would be broken while division (computed through it) still looked right to a reference-only comparison' },
    { file:'index', via:'index', expect:'layout constant ROW_B_Y',
      find:'  var ROW_A_Y = 30, ROW_B_Y = 90;             /* 兩條小格尺的 y（格子的上緣） */',
      replace:'  var ROW_A_Y = 30, ROW_B_Y = 60;             /* 兩條小格尺的 y（格子的上緣） */',
      why:'the lower bar would move up until its label sat on top of the upper bar' },
    { file:'index', via:'index', expect:"s5cap(paint) does not say why there is no picture",
      find:"        if (sc.kind !== 'count') return '這一題的兩個量是不同種的（一邊是公斤或公升，一邊是元或平方公尺），沒辦法畫成同一種小格，所以這裡不畫圖 —— 直接用算式：總量 ÷ 單位數。';",
      replace:"        if (sc.kind !== 'count') return '這一題直接用算式：總量 ÷ 單位數。';",
      why:'the caption would stop explaining why a unit-rate problem has no shared-cell picture' },
    { file:'index', via:'index', expect:'no longer wires the drawing',
      find:"    if (sc.kind === 'count'){ s5FigWrap.style.display = ''; drawBars(s5fig, pl, d.s5labelA(pl.a), d.s5labelB(pl.b)); }\n    else { s5FigWrap.style.display = 'none'; s5fig.textContent = ''; }",
      replace:"    drawBars(s5fig, pl, d.s5labelA(pl.a), d.s5labelB(pl.b));",
      why:'the unit-rate problems would get a shared-cell picture again, which compares two different kinds of quantity' },
    { file:'review', via:'review', expect:'is not how this lesson writes that value',
      find:"  function ansText(lang, id, t){\n    var u = SCEN[lang][id].ans;\n    if (lang === 'zh') return t + ' ' + u;\n    return t === '1' ? '1 ' + u : t + ' ' + u + (/(s|x|z|ch|sh)$/.test(u) ? 'es' : 's');\n  }",
      replace:"  function ansText(lang, id, t){\n    var u = SCEN[lang][id].ans;\n    if (lang === 'zh') return t + ' ' + u;\n    return t + ' ' + u + (/(s|x|z|ch|sh)$/.test(u) ? 'es' : 's');\n  }",
      why:'"1 square metres" would be printed — a multiword unit that a flat noun list never catches' },
    { file:'review', via:'review', expect:'is not a multiple of',
      find:"        var m = pick([2, 3, 4, 5, 6].filter(function(v){ return v % y.n === 0; }));",
      replace:"        var m = pick([2, 3, 4, 5, 6]);",
      why:'"how many bottles are filled" would be answered with 8/3 bottles' },
    { file:'review', via:'review', expect:'the divisor equals the dividend, so "dividing the wrong way round" also gives the answer',
      find:"        var y = fracOf(pick(POOL_SMALL.filter(function(t){ var f = fracOf(t); return !(f.n === x.n && f.d === x.d); })));",
      replace:"        var y = fracOf(pick(POOL_SMALL));",
      why:'the explanation would claim "dividing the wrong way round gives something else" when both give 1' },
    { file:'review', via:'index', expect:'no longer contains the sampling line',
      find:"  var POOL_DIVISOR = POOL_ANY.concat(['1/1']);",
      replace:"  var POOL_DIVISOR = POOL_ANY;",
      why:'the divisor-exactly-1 boundary would never be generated, so "the quotient equals the dividend" would be a permanent distractor' },
    { file:'index', via:'index', expect:'option "04"',
      find:"      opts:['27/32', '1/6', '6', '32/27'], ans:2,\n          why:'3/8 的倒數是 8/3",
      replace:"      opts:['27/32', '1/6', '04', '32/27'], ans:2,\n          why:'3/8 的倒數是 8/3",
      why:'a leading-zero option would be a different string for the same value and could dodge the value checks' },

    /* --- 第二輪 codex 審查（審第一輪的修正）之後補的守衛 --- */
    { file:'index', via:'index', expect:'contains markup but is written with textContent',
      find:"        if (sc.kind !== 'count') return '這一題的兩個量是不同種的（一邊是公斤或公升，一邊是元或平方公尺），沒辦法畫成同一種小格，所以這裡不畫圖 —— 直接用算式：總量 ÷ 單位數。';",
      replace:"        if (sc.kind !== 'count') return '這一題的兩個量是<strong>不同種的</strong>，沒辦法畫成同一種小格，所以這裡不畫圖 —— 直接用算式：總量 ÷ 單位數。';",
      why:'the child would see the characters <strong> in the caption, because it is written with textContent' },
    { file:'review', via:'index', expect:'no longer contains the sampling line',
      find:'        var x = fracOf(pickUnused(POOL_ANY.slice(), used)), y = fracOf(pick(POOL_DIVISOR));',
      replace:'        var x = fracOf(pickUnused(POOL_ANY.slice(), used)), y = fracOf(pick(POOL_ANY));',
      why:'the pinned POOL_DIVISOR declaration would survive while the sampling line stopped using it, so the divisor-exactly-1 boundary would never be generated' },
    { file:'index', via:'index', expect:'a CSS rule hides the figure',
      find:'  .figcap{margin-top:8px;font-size:14px;color:var(--muted);text-align:center}',
      replace:'  .figcap{margin-top:8px;font-size:14px;color:var(--muted);text-align:center}\n  .barfig rect{TRANSFORM: SCALE(0)}',
      why:'an upper-case, transform-based hide would slip past a case-sensitive property scan' },

    /* --- 第三輪 codex 審查（審第二輪的修正）之後補的守衛 --- */
    { file:'index', via:'index', expect:'a CSS rule hides the figure',
      find:'  .figcap{margin-top:8px;font-size:14px;color:var(--muted);text-align:center}',
      replace:'  .figcap{margin-top:8px;font-size:14px;color:var(--muted);text-align:center}\n  .barfig{clip-path:circle(0)}',
      why:'a zero-area clip-path would hide the whole drawing while every geometry assertion stayed green' },
    { file:'review', via:'index', expect:'cannot produce all three conclusions',
      find:"  var POOL_DIVISOR = POOL_ANY.concat(['1/1']);",
      replace:"  var POOL_DIVISOR = POOL_ANY.concat([]);",
      why:'the divisor-exactly-1 boundary would leave the pool and "the quotient equals the dividend" would be a permanent distractor' }
  ],

  SIBLING_RULES, FORBIDDEN, HANDOFF, GEN_IDS, RENDER_PINS, REVIEW_PINS, BANK, BANK_FACTS, visibleText, readerText,
  gcdRef, simplifyRef, fracTextRef, rawTextRef, recipRef, mulRef, divRef, cmpRef, barProblems, fracArith, CLAIM_PROBES, stemRef
};
