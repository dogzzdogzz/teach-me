/* grade-6/math/ratio —— 比與比值調色盤（比的寫法、比值、相等的比與最簡整數比、照比例配、按比分配）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作，都不呼叫課程頁的函式：
 *
 * 1) 「最大公因數」與「最簡整數比」。課程頁用輾轉相除（gcd）；這裡把兩個數各拆成質因數、每一個質數取小的次方相乘（gcdRef），
 *    比值 ＝ 前項/後項 約到最簡（valueRef）。兩條路對 1~30 的每一對數都要同意。
 * 2) 「兩個比相等」。課程頁用交叉相乘（a × d ＝ b × c）；這裡比**兩個最簡整數比是不是同一對**（sameRatioRef）。
 *    對 1~30 的每一組 (a, b, c, d) 都要同意（810000 組）。
 * 3) 課程明講的四句話這裡是**列舉證明**，不是文案：
 *    - 「前項和後項同乘或同除以同一個數，比值不變」→ 對每一對 (a, b) 與每一個 k ≤ 5 驗 valueRef(ka, kb) ＝ valueRef(a, b)。
 *    - 「同加一個數比值會變」→ 對每一對 a ≠ b 與每一個 m ≤ 5 驗 valueRef(a ＋ m, b ＋ m) ≠ valueRef(a, b)（a ＝ b 的時候例外，比值都是 1 —— 課程只在 a ≠ b 的例子上講這句話）。
 *    - 「化簡的階梯每一步除以能同時整除的最小質數，除到互質就停，左邊相乘是最大公因數」→ 對每一對跑 reduceSteps 逐列驗。
 *    - 「按比分配：一份 ＝ 總量 ÷ (前項 ＋ 後項)，兩邊加起來是總量，兩邊的比化簡回原來的比」→ 對範例與遊戲逐一驗。
 * 4) ⚠️ **從畫出來的圖量回來**：格子長條（barPlan）把每一格的 x、y、w、h 讀回來 —— 上面一列剛好 a 格、下面一列剛好 b 格、
 *    格子一樣大、等距、不重疊、含標籤都在畫布內；印成 SVG 字串（帶兩種語言裡最長的標籤）餵 lib/canvas.js 驗四個邊。
 *    對 1~30 × 1~30 的每一對都畫一次；放不下（任一邊 > 18）要 tooMany 而且一格都不畫（fail-closed）。化簡的階梯是 HTML，只驗資料。
 *
 * ⚠️ 小遊戲**沒有**接 lib/gameshuffle.js：五關的選項順序寫死在 ROUNDS 裡（設定檔驗的和孩子看到的是同一份），
 *    正解由 roundAnswerIndex() 算出來；「正解不可以固定在同一顆」由 step 5 直接對 ROUNDS 的 ans 分布驗。
 * ⚠️ 選項的「值」有三種形狀：比 `a : b`（值是 a/b，交叉相乘比）、分數 `n/d`、整數（可帶單位）。同一題裡四個選項的值要互不相同 ——
 *    唯一的例外是反向題 whichNotEqual（三個相等的比 ＋ 一個不相等，相等正是題目的設計，framework §六之二 的合法例外）。
 * ⚠️ 兩個上限：前項與後項都在 30 以內（LIMIT_REF），總量與配出來的量在 100 以內（TOTAL_LIMIT_REF）。
 * ⚠️ lib/arith.js 不認得比（`2 : 3 ＝ 6 : 9` 會被讀成 `3 = 6`）、分數（`3/2`）、字左邊的等號（`比值 ＝ 前項 ÷ 後項`）、
 *    也不認得數字之間以外的 ÷。這一課在 arithAll() 裡先自己驗這幾種（比的等式交叉相乘、分數與除法的鏈用有理數逐節比），
 *    從文字裡拿掉之後剩下的整數算式才交給共用驗算器。CLAIM_PROBES 每一次 verify_lesson_data 都重跑。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canvasProblems } = require('./lib/canvas.js');
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['杯', '人', '塊', '顆', '元', '公分', '份', '枝', '格', '倍', '題', '關', '分', '步', '個', '排', '種'],
  unitsEn: ['cups?', 'boys?', 'girls?', 'cookies?', 'sweets?', 'dollars?', 'cm', 'parts?', 'pens?', 'people', 'person', 'squares?', 'times', 'points?', 'questions?', 'steps?', 'pieces?', 'rows?', 'more']
});

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const LIMIT_REF = 30, TOTAL_LIMIT_REF = 100, MAX_UNITS_REF = 18;
const FIG_W_REF = 460, BAR_H_REF = 130;
const U_REF = 21, UGAP_REF = 3, BAR_X0_REF = 20, ROW_A_Y_REF = 30, ROW_B_Y_REF = 90, LABEL_DY_REF = -8, LABEL_FS_REF = 14;
const S1_CASES_REF = [['paint', 2, 3], ['juice', 1, 4], ['team', 5, 2], ['snack', 4, 6]];
const S2_CASES_REF = [[6, 4], [3, 5], [8, 2], [5, 5]];
const S3_CASES_REF = [[12, 18], [8, 12], [15, 10], [9, 6]];
const S4_CASES_REF = [['paint', 2, 3, 3], ['juice', 1, 4, 3], ['recipe', 5, 2, 3], ['team', 3, 4, 4]];
const S5_CASES_REF = [['sweets', 3, 2, 20], ['money', 4, 3, 35], ['people', 5, 3, 24], ['ribbon', 2, 1, 30]];
const GAME_ROUNDS_REF = 5;

/* ---------- 1) 數論：篩法找質數、質因數的次方取小 → 最大公因數、最簡整數比、比值 ---------- */
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
function factorCountsRef(n){
  const m = {}; let v = n;
  for (const p of PRIMES_200){ while (v % p === 0){ m[p] = (m[p] || 0) + 1; v /= p; } if (v === 1) break; }
  if (v !== 1) return null;
  return m;
}
/* 最大公因數：每一個質數各取兩邊次方的小值，相乘。 */
function gcdRef(a, b){
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < 1) return null;
  const ca = factorCountsRef(a), cb = factorCountsRef(b);
  if (!ca || !cb) return null;
  let g = 1;
  Object.keys(ca).forEach(p => { const k = Math.min(ca[p], cb[p] || 0); for (let i = 0; i < k; i++) g *= Number(p); });
  return g;
}
function simplestRef(a, b){ const g = gcdRef(a, b); return g === null ? null : [a / g, b / g]; }
function valueRef(a, b){ const s = simplestRef(a, b); return s === null ? null : { n:s[0], d:s[1] }; }
function valueTextRef(a, b){ const v = valueRef(a, b); return v === null ? null : (v.d === 1 ? String(v.n) : v.n + '/' + v.d); }
function ratioTextRef(a, b){ return a + ' : ' + b; }
/* 兩個比相等 ⇔ 最簡整數比是同一對（不是交叉相乘）。 */
function sameRatioRef(a, b, c, d){
  const s = simplestRef(a, b), t = simplestRef(c, d);
  return !!(s && t && s[0] === t[0] && s[1] === t[1]);
}
function smallestCommonPrimeRef(a, b){ for (const p of PRIMES_200){ if (p > Math.min(a, b)) break; if (a % p === 0 && b % p === 0) return p; } return null; }
function sameList(a, b){ return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]); }
function plEnRef(n, w){ if (n === 1) return n + ' ' + w; return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's'); }

/* ---------- 2) 選項的解析：比 `a : b`、分數／整數（可帶單位） ---------- */
const UNIT_RE_SRC = '(?: (杯|顆|元|人|公分|cups?|sweets?|dollars?|people|person|cm|boys?|girls?|cookies?))?';
function parseRatioOpt(s){ const m = /^(\d+) : (\d+)$/.exec(String(s).trim()); return m ? [Number(m[1]), Number(m[2])] : null; }
function parseNumOpt(s){
  const m = new RegExp('^(\\d+)(?:\\/(\\d+))?' + UNIT_RE_SRC + '$').exec(String(s).trim());
  return m ? { n:Number(m[1]), d:m[2] === undefined ? 1 : Number(m[2]), unit:m[3] || '' } : null;
}
function fracKeyRef(n, d){ const g = gcdRef(n, d); return g ? (n / g) + '/' + (d / g) : n + '/' + d; }
/* 值的鍵：比 → 交叉相乘比；數 → 最簡分數 ＋ 單位。 */
function optKeyRef(s){
  const r = parseRatioOpt(s); if (r) return 'r:' + fracKeyRef(r[0], r[1]);
  const f = parseNumOpt(s); if (f && f.d > 0) return 'v:' + fracKeyRef(f.n, f.d) + '|' + f.unit.replace(/s$/, '');
  return 'raw:' + String(s).replace(/\s+/g, '');
}

/* ---------- 3) 真值表：複習頁的句庫（12 句），兩種語言的原文 ---------- */
const TRUE_STATEMENTS_REF = {
  valueIsDivision:  { zh:'比值是前項除以後項', en:'The value of a ratio is the first term divided by the second' },
  sameMultiply:     { zh:'前項和後項同乘一個不是 0 的數，比值不變', en:'Multiplying both terms by the same non-zero number keeps the value' },
  simplestCoprime:  { zh:'最簡整數比的前項和後項互質', en:'In the simplest whole-number ratio the two terms are coprime' },
  valueOneEqual:    { zh:'比值是 1 表示前項和後項一樣多', en:'A value of 1 means the two terms are equal' },
  orderMatters:     { zh:'前項和後項不一樣時，把它們交換就變成另一個比', en:'When the two terms are different, swapping them gives a different ratio' },
  divideByGcf:      { zh:'前項和後項同除以最大公因數，就得到最簡整數比', en:'Dividing both terms by their GCF gives the simplest whole-number ratio' }
};
const FALSE_STATEMENTS_REF = {
  sameAdd:          { zh:'前項和後項同加一個數，比值不變', en:'Adding the same number to both terms keeps the value' },
  swapSame:         { zh:'把前項和後項交換，還是同一個比', en:'Swapping the two terms gives the same ratio' },
  valueBelowOne:    { zh:'比值一定比 1 小', en:'A ratio value is always less than 1' },
  valueIsPartWhole: { zh:'比值就是前項占全部的幾分之幾', en:'The value is the fraction of the whole that the first term makes' },
  smallOverBig:     { zh:'比值是小的數除以大的數', en:'The value is the smaller number divided by the bigger' },
  partsAreAmounts:  { zh:'按比分配時，比裡的數字就是每個人拿到的數量', en:'When sharing in a ratio, the numbers in the ratio are the amounts each person gets' }
};
const FALSE_KEYS_REF = Object.keys(FALSE_STATEMENTS_REF);
function statementTruthOfText(text, lang){
  for (const k of Object.keys(TRUE_STATEMENTS_REF)) if (TRUE_STATEMENTS_REF[k][lang] === text) return true;
  for (const k of FALSE_KEYS_REF) if (FALSE_STATEMENTS_REF[k][lang] === text) return false;
  return null;
}

/* ---------- 3b) 情境的名字（複習頁的第二份） ---------- */
const ITEMS_REF = {
  zh: {
    paint:  { a:'藍色顏料', b:'白色顏料', ua:'杯', ub:'杯', sa:'藍色', sb:'白色' },
    juice:  { a:'果汁', b:'水', ua:'杯', ub:'杯', sa:'果汁', sb:'水' },
    team:   { a:'男生', b:'女生', ua:'人', ub:'人', sa:'男生', sb:'女生' },
    snack:  { a:'餅乾', b:'糖果', ua:'塊', ub:'顆', sa:'餅乾', sb:'糖果' },
    recipe: { a:'麵粉', b:'糖', ua:'杯', ub:'杯', sa:'麵粉', sb:'糖' }
  },
  en: {
    paint:  { a:'blue paint', b:'white paint', ua:'cup', ub:'cup', sa:'blue', sb:'white' },
    juice:  { a:'juice', b:'water', ua:'cup', ub:'cup', sa:'juice', sb:'water' },
    team:   { a:'boys', b:'girls', ua:'', ub:'', sa:'boys', sb:'girls' },
    snack:  { a:'cookies', b:'sweets', ua:'', ub:'', sa:'cookies', sb:'sweets' },
    recipe: { a:'flour', b:'sugar', ua:'cup', ub:'cup', sa:'flour', sb:'sugar' }
  }
};
function qtyRef(lang, id, side, n){
  const it = ITEMS_REF[lang][id], unit = side === 'a' ? it.ua : it.ub, name = side === 'a' ? it.a : it.b;
  if (lang === 'zh') return n + ' ' + unit;
  if (unit) return plEnRef(n, unit);
  const SINGULAR = { boys:'boy', girls:'girl', cookies:'cookie', sweets:'sweet' };
  return n === 1 ? '1 ' + (SINGULAR[name] || name) : n + ' ' + name;
}
function nounEnRef(id, side, n){ const it = ITEMS_REF.en[id], name = side === 'a' ? it.a : it.b, unit = side === 'a' ? it.ua : it.ub; const SINGULAR = { boys:'boy', girls:'girl', cookies:'cookie', sweets:'sweet' }; return (!unit && n === 1) ? (SINGULAR[name] || name) : name; }
const SHARE_NAMES_REF = {
  zh:{ sweets:['顆糖', '哥哥', '弟弟', ' 顆'], money:['元', '小美', '小明', ' 元'], people:['個人', '紅隊', '藍隊', ' 人'] },
  en:{ sweets:['sweets', 'the big brother', 'the little brother', 'sweet'], money:['dollars', 'Mia', 'Ben', 'dollar'], people:['people', 'the red team', 'the blue team', 'person'] }
};
function shareUnitTextRef(id, n, lang){
  const N = SHARE_NAMES_REF[lang][id];
  return lang === 'zh' ? n + N[3] : (id === 'people' ? (n === 1 ? '1 person' : n + ' people') : plEnRef(n, N[3]));
}
/* 整句題幹重建：每一支產生器、每一種語言各一份。多一個字少一個字都對不上。 */
function stemRef(genId, d, lang){
  const zh = lang === 'zh';
  switch (genId){
    case 'readRatio': {
      const it = ITEMS_REF[lang][d.id], first = d.rev ? it.sb : it.sa, second = d.rev ? it.sa : it.sb;
      return zh
        ? it.a + ' <strong>' + qtyRef('zh', d.id, 'a', d.a) + '</strong>、' + it.b + ' <strong>' + qtyRef('zh', d.id, 'b', d.b) + '</strong>。<strong>' + first + '和' + second + '</strong>的比是多少？'
        : '<strong>' + qtyRef('en', d.id, 'a', d.a) + '</strong>' + (it.ua ? ' of ' + it.a : '') + ' and <strong>' + qtyRef('en', d.id, 'b', d.b) + '</strong>' + (it.ub ? ' of ' + it.b : '') + '. What is the ratio of <strong>' + first + ' to ' + second + '</strong>?';
    }
    case 'ratioValue': return zh ? '<strong>' + ratioTextRef(d.a, d.b) + '</strong> 的比值是多少？' : 'What is the value of <strong>' + ratioTextRef(d.a, d.b) + '</strong>?';
    case 'simplestRatio': return zh ? '<strong>' + ratioTextRef(d.a, d.b) + '</strong> 的<strong>最簡整數比</strong>是多少？' : 'What is <strong>' + ratioTextRef(d.a, d.b) + '</strong> in its <strong>simplest whole-number form</strong>?';
    case 'equalRatio': return zh ? '下面哪一個比和 <strong>' + ratioTextRef(d.c, d.d) + '</strong> 是<strong>相等的比</strong>？' : 'Which of these ratios is <strong>equal to</strong> <strong>' + ratioTextRef(d.c, d.d) + '</strong>?';
    case 'scaleUp': {
      const it = ITEMS_REF[lang][d.id], A = d.c * d.k;
      return zh
        ? it.a + '和' + it.b + '的比是 <strong>' + ratioTextRef(d.c, d.d) + '</strong>。' + it.a + '用了 <strong>' + qtyRef('zh', d.id, 'a', A) + '</strong>，' + it.b + '要用幾' + it.ub + '？'
        : 'The ratio of ' + it.a + ' to ' + it.b + ' is <strong>' + ratioTextRef(d.c, d.d) + '</strong>. <strong>' + qtyRef('en', d.id, 'a', A) + '</strong>' + (it.ua ? ' of ' + it.a : '') + ' are used. ' + (it.ub ? 'How much ' + it.b + ' is needed?' : 'How many ' + it.b + ' are needed?');
    }
    case 'shareTotal': {
      const N = SHARE_NAMES_REF[lang][d.id];
      return zh
        ? '<strong>' + d.total + '</strong> ' + N[0] + '照 <strong>' + ratioTextRef(d.c, d.d) + '</strong> 分給' + N[1] + '和' + N[2] + '。' + N[1] + '得到多少？'
        : '<strong>' + d.total + '</strong> ' + N[0] + ' are shared between ' + N[1] + ' and ' + N[2] + ' in the ratio <strong>' + ratioTextRef(d.c, d.d) + '</strong>. ' + (d.id === 'money' ? 'How much money does ' : (d.id === 'people' ? 'How many people does ' : 'How many sweets does ')) + N[1] + ' get?';
    }
    case 'fractionOfWhole': {
      const it = ITEMS_REF[lang][d.id];
      return zh
        ? '（五年級）' + it.a + ' <strong>' + qtyRef('zh', d.id, 'a', d.a) + '</strong>、' + it.b + ' <strong>' + qtyRef('zh', d.id, 'b', d.b) + '</strong>。' + it.sa + '<strong>占全部的幾分之幾</strong>？'
        : '(Grade five) <strong>' + qtyRef('en', d.id, 'a', d.a) + '</strong>' + (it.ua ? ' of ' + it.a : '') + ' and <strong>' + qtyRef('en', d.id, 'b', d.b) + '</strong>' + (it.ub ? ' of ' + it.b : '') + '. <strong>What fraction of the whole</strong> ' + ((it.ua || d.a === 1) ? 'is the ' : 'are the ') + nounEnRef(d.id, 'a', d.a) + '?';
    }
    case 'ratioFromValue': return zh ? '下面哪一個比的<strong>比值是 ' + valueTextRef(d.n, d.d) + '</strong>？' : 'Which of these ratios has <strong>value ' + valueTextRef(d.n, d.d) + '</strong>?';
    case 'trueStatement': return zh ? '下面四句話，<strong>只有一句是對的</strong>。是哪一句？' : 'Of these four sentences, <strong>exactly one is true</strong>. Which?';
    case 'interGcf': return zh ? '（上一課）把 <strong>' + ratioTextRef(d.a, d.b) + '</strong> <strong>一次</strong>化成最簡整數比，前項和後項要同除以幾？' : '(Last lesson) To turn <strong>' + ratioTextRef(d.a, d.b) + '</strong> into its simplest form in <strong>one</strong> step, what do you divide both terms by?';
    case 'unitRate': return zh
      ? '<strong>' + d.a + '</strong> 枝筆一共 <strong>' + d.T + '</strong> 元。錢和筆數的比是 ' + ratioTextRef(d.T, d.a) + '，它的<strong>比值</strong>是多少？（也就是一枝筆幾元）'
      : '<strong>' + d.a + '</strong> pens cost <strong>' + d.T + '</strong> dollars in all. The ratio of dollars to pens is ' + ratioTextRef(d.T, d.a) + '. What is its <strong>value</strong>? (That is the price of one pen.)';
    case 'whichNotEqual': return zh ? '下面四個比裡，<strong>只有一個</strong>和 <strong>' + ratioTextRef(d.c, d.d) + '</strong> <strong>不相等</strong>。是哪一個？' : 'Of these four ratios, <strong>exactly one</strong> is <strong>not equal</strong> to <strong>' + ratioTextRef(d.c, d.d) + '</strong>. Which?';
    default: return null;
  }
}

/* ---------- 4) 跨頁用詞釘樁：min 一律寫成**當下真實的出現次數**（拿掉註解之後、讀者看得到的文字） ---------- */
const SIBLING_RULES = [
  { file:'index',     text:'前項 ÷ 後項', min:17, why:'is the definition of the ratio value this lesson uses everywhere' },
  { file:'reference', text:'前項 ÷ 後項', min:11, why:'is the definition of the ratio value this lesson uses everywhere' },
  { file:'review',    text:'前項 ÷ 後項', min:5,  why:'is the definition of the ratio value this lesson uses everywhere' },
  { file:'parents',   text:'前項 ÷ 後項', min:6,  why:'is the definition of the ratio value this lesson uses everywhere' },
  { file:'index',     text:'同乘或同除以同一個數', min:9, why:'is the rule for equal ratios this lesson teaches' },
  { file:'reference', text:'同乘或同除以同一個數', min:6, why:'is the rule for equal ratios this lesson teaches' },
  { file:'parents',   text:'同乘或同除以同一個數', min:2, why:'is the rule for equal ratios this lesson teaches' },
  { file:'index',     text:'順序不能換', min:7, why:'is how this lesson says a ratio has an order' },
  { file:'reference', text:'順序不能換', min:5, why:'is how this lesson says a ratio has an order' },
  { file:'parents',   text:'順序不能換', min:2, why:'is how this lesson says a ratio has an order' },
  { file:'index',     text:'first term ÷ second term', min:11, why:'is the English definition of the ratio value' },
  { file:'reference', text:'first term ÷ second term', min:6,  why:'is the English definition of the ratio value' },
  { file:'review',    text:'first term ÷ second term', min:4,  why:'is the English definition of the ratio value' },
  { file:'parents',   text:'first term ÷ second term', min:3,  why:'is the English definition of the ratio value' },
  { file:'index',     text:'multiply or divide both terms by the same number', min:3, why:'is the English rule for equal ratios' },
  { file:'reference', text:'multiply or divide both terms by the same number', min:3, why:'is the English rule for equal ratios' },
  { file:'parents',   text:'multiply or divide both terms by the same number', min:1, why:'is the English rule for equal ratios' }
];
/* 一個字都不可以出現：次方寫法；帶分數（這一課的比值一律寫假分數）；小數；把迷思當事實寫出來。 */
const FORBIDDEN = [
  { file:'index',     text:'²', why:'writes a power — this lesson never does' },
  { file:'reference', text:'²', why:'writes a power — this lesson never does' },
  { file:'review',    text:'²', why:'writes a power — this lesson never does' },
  { file:'parents',   text:'²', why:'writes a power — this lesson never does' },
  { file:'index',     text:' 又 ', why:'writes a mixed number — this lesson writes ratio values as improper fractions (3/2), never 1 又 1/2' },
  { file:'reference', text:' 又 ', why:'writes a mixed number — this lesson writes ratio values as improper fractions' },
  { file:'review',    text:' 又 ', why:'writes a mixed number — this lesson writes ratio values as improper fractions' },
  { file:'index',     text:'比值就是小的除以大的', why:'states the misconception as a fact' },
  { file:'reference', text:'比值就是小的除以大的', why:'states the misconception as a fact' },
  { file:'index',     text:'同加一個數，比不變', why:'states the misconception as a fact' },
  { file:'reference', text:'同加一個數，比不變', why:'states the misconception as a fact' },
  { file:'parents',   text:'同加一個數，比不變', why:'states the misconception as a fact' },
];
/* 小數（`0.5`、`1.5`）一個都不可以出現在讀者看得到的文字裡：小數的比交給後面的課。 */
const DECIMAL_RE = /\d\.\d/;
/* 交給別課的詞，出現時同一個子句裡要說出它屬於哪一課。 */
const HANDOFF = [
  { word:'百分率', near:['五年級'], files:['index', 'reference', 'parents'] },
  { word:'percent', near:['grade-5', 'grade 5'], files:['index', 'reference', 'parents'] },
  { word:'成正比', near:['不在這一課'], files:['index', 'reference', 'parents'] },
  { word:'direct proportion', near:['not in this lesson', 'not part of this lesson', 'later in grade 6'], files:['index', 'reference', 'parents'] },
  { word:'速率', near:['不在這一課', '起點'], files:['index', 'reference', 'parents'] },
  { word:'短除法魔法梯', near:['上一課', '六年級'], files:['index', 'reference', 'parents', 'review'] }
];

/* ---------- 5) 題庫神諭：整句題幹（zh／en）＋ 四個選項原文 ＋ 正解原文 ---------- */
const BANK = {
  qs:[
    { zh:'藍色顏料 <strong>3</strong> 杯、白色顏料 <strong>5</strong> 杯。藍色和白色的比是多少？', en:'<strong>3</strong> cups of blue paint and <strong>5</strong> cups of white paint. What is the ratio of blue to white?', optsZh:['3 : 5', '5 : 3', '3 : 8', '5 : 8'], optsEn:['3 : 5', '5 : 3', '3 : 8', '5 : 8'], ansZh:'3 : 5', ansEn:'3 : 5' },
    { zh:'<strong>4 : 6</strong> 的比值是多少？', en:'What is the value of <strong>4 : 6</strong>?', optsZh:['3/2', '2/3', '2', '10'], optsEn:['3/2', '2/3', '2', '10'], ansZh:'2/3', ansEn:'2/3' },
    { zh:'下面哪一個比和 <strong>2 : 5</strong> 是相等的比？', en:'Which of these ratios is equal to <strong>2 : 5</strong>?', optsZh:['4 : 7', '6 : 15', '5 : 2', '3 : 6'], optsEn:['4 : 7', '6 : 15', '5 : 2', '3 : 6'], ansZh:'6 : 15', ansEn:'6 : 15' },
    { zh:'<strong>12 : 18</strong> 的最簡整數比是多少？', en:'What is <strong>12 : 18</strong> in its simplest whole-number form?', optsZh:['3 : 2', '6 : 12', '2 : 3', '2 : 6'], optsEn:['3 : 2', '6 : 12', '2 : 3', '2 : 6'], ansZh:'2 : 3', ansEn:'2 : 3' },
    { zh:'藍色和白色顏料的比是 <strong>2 : 3</strong>。藍色用了 <strong>8</strong> 杯，白色要用幾杯？', en:'The ratio of blue paint to white paint is <strong>2 : 3</strong>. <strong>8</strong> cups of blue are used. How many cups of white are needed?', optsZh:['9 杯', '12 杯', '10 杯', '16 杯'], optsEn:['9 cups', '12 cups', '10 cups', '16 cups'], ansZh:'12 杯', ansEn:'12 cups' },
    { zh:'<strong>20</strong> 顆糖照 <strong>3 : 2</strong> 分給哥哥和弟弟。哥哥得幾顆？', en:'<strong>20</strong> sweets are shared between a big brother and a little brother in the ratio <strong>3 : 2</strong>. How many does the big brother get?', optsZh:['10 顆', '15 顆', '12 顆', '8 顆'], optsEn:['10 sweets', '15 sweets', '12 sweets', '8 sweets'], ansZh:'12 顆', ansEn:'12 sweets' }
  ],
  qsAdv:[
    { zh:'果汁和水的比是 <strong>1 : 4</strong>。要調出 <strong>15</strong> 杯飲料（果汁加水一共 15 杯），果汁要幾杯？', en:'The ratio of juice to water is <strong>1 : 4</strong>. To make <strong>15</strong> cups of drink (juice and water together), how many cups of juice are needed?', optsZh:['9 杯', '5 杯', '12 杯', '3 杯'], optsEn:['9 cups', '5 cups', '12 cups', '3 cups'], ansZh:'3 杯', ansEn:'3 cups' },
    { zh:'一個比的比值是 <strong>3/4</strong>，前項是 <strong>9</strong>。後項是多少？', en:'A ratio has value <strong>3/4</strong> and its first term is <strong>9</strong>. What is the second term?', optsZh:['12', '10', '6', '27'], optsEn:['12', '10', '6', '27'], ansZh:'12', ansEn:'12' },
    { zh:'小美說：「<strong>5 : 3</strong> 和 <strong>3 : 5</strong> 是一樣的比，因為用的數字一樣。」下面哪一句話的<strong>結論和理由都對</strong>？', en:'Mia says: “<strong>5 : 3</strong> and <strong>3 : 5</strong> are the same ratio, because they use the same numbers.” Which sentence has <strong>both the right conclusion and the right reason</strong>?', optsZh:['不對，5 : 3 的比值是 5/3，3 : 5 的比值是 3/5，比值不同就不是同一個比', '對，兩個比用的都是 5 和 3', '對，因為 5 ＋ 3 和 3 ＋ 5 一樣多', '不對，比的前項一定要比後項小'], optsEn:['No: 5 : 3 has value 5/3 and 3 : 5 has value 3/5; different values mean different ratios', 'Yes: both ratios use 5 and 3', 'Yes: 5 + 3 and 3 + 5 are the same', 'No: the first term must always be smaller than the second'], ansZh:'不對，5 : 3 的比值是 5/3，3 : 5 的比值是 3/5，比值不同就不是同一個比', ansEn:'No: 5 : 3 has value 5/3 and 3 : 5 has value 3/5; different values mean different ratios' },
    { zh:'班上男生 <strong>12</strong> 人、女生 <strong>16</strong> 人。男生和女生的<strong>最簡整數比</strong>是多少？', en:'A class has <strong>12</strong> boys and <strong>16</strong> girls. What is the ratio of boys to girls in <strong>simplest whole-number form</strong>?', optsZh:['4 : 3', '3 : 4', '3 : 7', '12 : 4'], optsEn:['4 : 3', '3 : 4', '3 : 7', '12 : 4'], ansZh:'3 : 4', ansEn:'3 : 4' }
  ],
  qsBoost:[
    { zh:'小明把 <strong>2 : 3</strong> 的前項和後項<strong>都加 2</strong>，說「4 : 5 和 2 : 3 是相等的比」。他哪裡想錯了？', en:'Ben <strong>adds 2</strong> to both terms of <strong>2 : 3</strong> and says “4 : 5 and 2 : 3 are equal ratios”. What has he got wrong?', optsZh:['他沒有錯，前項和後項一起加同一個數，比不會變', '相等的比要前項和後項同乘或同除以同一個數（0 除外）；2 : 3 的比值是 2/3，4 : 5 的比值是 4/5，不一樣，所以不相等', '應該只加前項，變成 4 : 3 才對', '4 : 5 已經是最簡整數比，所以他是對的'], optsEn:['Nothing; adding the same number to both terms keeps the ratio', 'Equal ratios come from multiplying or dividing both terms by the same number (never 0); 2 : 3 has value 2/3 and 4 : 5 has value 4/5, so they are not equal', 'He should add only to the first term, giving 4 : 3', '4 : 5 is already in simplest form, so he is right'], ansZh:'相等的比要前項和後項同乘或同除以同一個數（0 除外）；2 : 3 的比值是 2/3，4 : 5 的比值是 4/5，不一樣，所以不相等', ansEn:'Equal ratios come from multiplying or dividing both terms by the same number (never 0); 2 : 3 has value 2/3 and 4 : 5 has value 4/5, so they are not equal' },
    { zh:'小華算 <strong>6 : 4</strong> 的比值，寫成「4 ÷ 6 ＝ 2/3」。他哪裡想錯了？', en:'Chloe works out the value of <strong>6 : 4</strong> as “4 ÷ 6 = 2/3”. What has she got wrong?', optsZh:['他沒有錯，比值就是小的數除以大的數', '比值是前項 ÷ 後項：6 ÷ 4 ＝ 3/2，不是後項 ÷ 前項', '比值應該用相減：6 － 4 ＝ 2', '比值應該先化成 3 : 2，再把 3 和 2 相加'], optsEn:['Nothing; the value is the smaller number divided by the bigger', 'The value is first term ÷ second term: 6 ÷ 4 = 3/2, not second ÷ first', 'The value should be a difference: 6 − 4 = 2', 'She should simplify to 3 : 2 first and then add 3 and 2'], ansZh:'比值是前項 ÷ 後項：6 ÷ 4 ＝ 3/2，不是後項 ÷ 前項', ansEn:'The value is first term ÷ second term: 6 ÷ 4 = 3/2, not second ÷ first' }
  ]
};
/* 靜態題裡的數字事實，各自獨立算一次。 */
const BANK_FACTS = [
  { pair:[4, 6], value:'2/3' }, { pair:[6, 4], value:'3/2' }, { pair:[12, 18], simplest:[2, 3], gcf:6 }, { pair:[12, 16], simplest:[3, 4], gcf:4 },
  { pair:[5, 3], value:'5/3' }, { pair:[3, 5], value:'3/5' }, { equal:[2, 5, 6, 15] }, { notEqual:[2, 5, 4, 7] }, { notEqual:[2, 5, 3, 6] }, { notEqual:[2, 3, 4, 5] },
  { scale:[2, 3, 8, 12] }, { share:[20, 3, 2, 12, 8] }, { share:[15, 1, 4, 3, 12] }, { value:[3, 4], first:9, second:12 }
];

const BANK_WHY_FINGERPRINT_REF = '4f8574778f6c';

const GEN_IDS = ['readRatio', 'ratioValue', 'simplestRatio', 'equalRatio', 'scaleUp', 'shareTotal',
                 'fractionOfWhole', 'ratioFromValue', 'trueStatement', 'interGcf', 'unitRate', 'whichNotEqual'];

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
  { file:'index', text:'drawSteps(s3grid, R, s3step);', min:1, max:1 },
  { file:'index', text:"svg.appendChild(svgEl('rect', { x:c.x, y:c.y, width:c.w, height:c.h, rx:4, fill:c.row === 'a' ? C_A : C_B }));", min:1 },
  { file:'index', text:'var ansAt = roundAnswerIndex(round);', min:1 },
  { file:'index', text:'var fig = roundFigure(round);', min:1 },
  { file:'index', text:"var cur = s3step === 0 ? [R.a, R.b] : [R.rows[s3step - 1].qa, R.rows[s3step - 1].qb];", min:1 },
  /* 每一張畫布的識別字在程式碼裡出現的次數釘死（markup 的 id、getElementById 那一行的兩次、drawBars 那一次）：
     繞過 drawBars 直接往畫布 appendChild 的那一行會多出一次。⚠️ 仍然是字面掃描，改用別名（var t = s1fig）就看不到 */
  { file:'index', text:'s1fig', min:4, max:4 },
  { file:'index', text:'s2fig', min:4, max:4 },
  { file:'index', text:'s3fig', min:4, max:4 },
  { file:'index', text:'s4fig', min:4, max:4 },
  { file:'index', text:'s5fig', min:4, max:4 },
  { file:'index', text:'gFig', min:10, max:10 }
];
/* review.html 的抽樣池與去重要逐字釘住：產生器自己的過濾會把改壞測試吸收掉。 */
const REVIEW_PINS = [
  'var POOL_SMALL = PAIRS_DISTINCT.filter(function(pr){ return pr[0] <= 12 && pr[1] <= 12; });',
  'var POOL_NONSIMPLE = PAIRS_DISTINCT.filter(function(pr){ return gcd(pr[0], pr[1]) > 1 && pr[0] >= 2 && pr[1] >= 2; });',
  'var POOL_BASE = PAIRS_DISTINCT.filter(function(pr){ return gcd(pr[0], pr[1]) === 1 && pr[0] <= 9 && pr[1] <= 9; });',
  'var POOL_BASE7 = POOL_BASE.filter(function(pr){ return pr[0] <= 7 && pr[1] <= 7; });',
  'var POOL_VALUE = PAIRS_DISTINCT.filter(function(pr){ return pr[0] >= 2 && pr[1] >= 2; });',
  'if (a !== b) PAIRS_DISTINCT.push([a, b]);',
  "var r = parseRatio(s); if (r) return 'r:' + fracKey(r[0], r[1]);",
  '(avoidKeys || []).forEach(function(k){ seen[k] = 1; });',
  'if (c < 1 || c > max || seen[String(c)]) return;'
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
   `比值<strong>一定</strong>比 1 小` 在畫面上就是那一句迷思，字面掃描不可以被標籤擋住。 */
function visibleText(html){
  /* class 還在的時候先分類：條件說明（.cond）與步驟圓章（.sn／.bignum）在畫面上是分開的，補空白；其他 span 直接拿掉、不補空白 ——
     `比值<span>一定</span>比 1 小` 拆掉之後仍然是那一句迷思，`共<span>5</span>份` 仍然黏著 */
  return readerText(String(html).replace(/<span class="(?:sn|bignum|badge)"[^>]*>(\d*)<\/span>/g, ' $1 ').replace(/<span class="cond"[^>]*>([\s\S]*?)<\/span>/g, ' $1 '))
    .replace(/<\/?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|table|section|header|footer|nav)\b[^>]*>/gi, ' ')
    /* readerText 已經把 class 拿掉了，所以這裡認不出 .cond／.sn；<span> 在這個站上不是拿來包一句話中間的字（那是 <strong>／<b>），
       而是換行的條件說明、步驟號碼的圓章、data-i18n 的整段 —— 邊界補空白只會讓黏字檢查更寬鬆一點，不會放行 <strong> 裡真正黏著的數字 */
    .replace(/<\/?span\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '');
}
function stringProblems(s, lang, where){
  const out = [];
  const t = String(s);
  if (/undefined|NaN|\[object/.test(t)) out.push(where + ' leaks an internal value');
  /* `<span class="cond">` 在畫面上是另起一行（display:block），先換成空白再拆標籤；其餘行內標籤直接拿掉（`共<strong>5</strong>個` 畫面上是黏著的） */
  const shown = t.replace(/<span class="cond">/g, ' ').replace(/<[^>]+>/g, '');
  if (lang === 'zh' && /\p{Script=Han}\d|\d\p{Script=Han}/u.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:\p{Script=Han}\d|\d\p{Script=Han}).{0,6}/u) || [''])[0]);
  if (lang === 'en' && /\b1 (cups|sweets|dollars|boys|girls|cookies|parts|pens|people|squares|times|pieces|steps|points)\b/.test(shown)) out.push(where + ' has a singular/plural slip: ' + shown.match(/\b1 [a-z]+s\b/)[0]);
  if (lang === 'en' && /\b1 [a-z]+ (are|were|have)\b/.test(shown)) out.push(where + ' has a singular subject with a plural verb: ' + shown.match(/\b1 [a-z]+ (?:are|were|have)\b/)[0]);
  if (lang === 'en' && /\p{Script=Han}/u.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  /* 比一律寫成「a : b」（半形冒號、兩邊空白）：`2:3`、`2：3` 都不是這一課的寫法 */
  if (/\d:\d|\d：\d/.test(shown)) out.push(where + ' writes a ratio without spaces around the colon: ' + shown.match(/\d+[:：]\d+/)[0]);
  return out;
}

/* ---------- 6b) 算式逐條驗算 ----------
   lib/arith.js 不認得比、分數、字左邊的等號、數字之間以外的 ÷。這一課先自己處理：
   ① 比的等式鏈 `a : b ＝ c : d (＝ e : f)`：每一節交叉相乘；剩下單獨的 `a : b` 只是名詞，拿掉。
   ② 分數／除法的鏈 `6 ÷ 4 ＝ 6/4 ＝ 3/2`、`3/15 ＝ 1/5`、`20 ÷ 5 ＝ 4`：每一節用有理數比；分母 0 要響。
      鏈的開頭不可以緊接在運算符號後面（`3 × 4 ＝ 12` 的 `4 ＝ 12` 不是分數鏈），結尾不可以緊接運算符號。
   ③ 剩下單獨的分數 `n/d` 與 `a ÷ b` 是名詞，拿掉；兩邊都不是數字的 ÷／＝（`前項 ÷ 後項`、`比值 ＝ 前項 ÷ 後項`）換成文字。
   之後剩下的整數算式才交給共用驗算器。回傳 { problems, verified }。 */
const RATIO_CHAIN_RE = /(\d+) : (\d+)((?:\s*[＝=]\s*\d+ : \d+)+)/g;
const RATIO_RE = /\d+ : \d+/g;
const TERM_SRC = '(?:\\d+ ÷ \\d+|\\d+\\/\\d+|\\d+)';
const NUM_CHAIN_RE = new RegExp('(?<![\\d×*+\\-＋－−–÷/]\\s*)(?<![\\d/]|\\d\\.)(' + TERM_SRC + ')((?:\\s*[＝=]\\s*' + TERM_SRC + ')+)(?!\\s*[×*+\\-＋－−–÷/]|[\\d/])', 'g');
function parseTermRef(t){
  let m = /^(\d+) ÷ (\d+)$/.exec(t); if (m) return [Number(m[1]), Number(m[2])];
  m = /^(\d+)\/(\d+)$/.exec(t); if (m) return [Number(m[1]), Number(m[2])];
  m = /^(\d+)$/.exec(t); if (m) return [Number(m[1]), 1];
  return null;
}
function arithAll(text){
  const problems = [];
  let verified = 0;
  let t = String(text).replace(/<[^>]+>/g, ' ');
  t = t.replace(RATIO_CHAIN_RE, (m, a, b, tail) => {
    const links = tail.split(/[＝=]/).slice(1).map(x => x.trim());
    let pa = Number(a), pb = Number(b);
    if (!(pb > 0) || !(pa > 0)) problems.push('ratio with a zero term: "' + m + '"');
    links.forEach(link => {
      const mm = /^(\d+) : (\d+)$/.exec(link);
      const c = Number(mm[1]), d = Number(mm[2]);
      verified++;
      if (!(c > 0 && d > 0) || pa * d !== pb * c) problems.push('ratio claim is wrong: "' + m + '"');
      pa = c; pb = d;
    });
    return ' R ';
  });
  /* 比只能和比相等：`＝ 2 : 3` 前面或 `2 : 3 ＝` 後面接的不是比（`8/13 ＝ 2 : 3`、`2 : 3 ＝ 4 : 6 ＝ 8/13` 的尾巴）就是沒驗過的宣稱 —— 要響，不可以靜靜拿掉 */
  if (/[＝=]\s*R\b|[＝=]\s*\d+ : \d+|\d+ : \d+\s*[＝=]|\bR\s*[＝=]/.test(t)) problems.push('a ratio is equated to something that is not a ratio (mixed chain) in "' + String(text).replace(/<[^>]+>/g, '').slice(0, 60) + '"');
  t = t.replace(RATIO_RE, ' R ');
  t = t.replace(NUM_CHAIN_RE, (m, head, tail) => {
    const links = [head].concat(tail.split(/[＝=]/).slice(1).map(x => x.trim()));
    const vals = links.map(parseTermRef);
    if (vals.some(v => !v)){ problems.push('cannot parse a number chain: "' + m + '"'); return ' '; }
    for (let i = 0; i < vals.length; i++) if (!(vals[i][1] > 0)) problems.push('division by zero in "' + m + '"');
    for (let i = 1; i < vals.length; i++){
      verified++;
      if (vals[i - 1][0] * vals[i][1] !== vals[i][0] * vals[i - 1][1]) problems.push('fraction/division claim is wrong: "' + m + '"');
    }
    return ' ';
  });
  t = t.replace(/(\d+) ÷ (\d+)(?!\s*[＝=])/g, (m, a, b) => { if (Number(b) === 0) problems.push('division by zero: "' + m + '"'); return ' Q '; });
  t = t.replace(/(?<![\d×*])\b(\d+)\/(\d+)\b(?![\d])/g, (m, n, d) => { if (Number(d) === 0) problems.push('fraction with zero denominator: "' + m + '"'); return ' F '; });
  /* 拿掉的分數／除法如果還接著運算符號或等號（`3/4 ＋ 1/4 ＝ 2`、`Q ＝ 3`），那是這一課不做的分數四則 —— fail-closed，要響 */
  if (/\b[FQ]\b\s*[×*+\-＋－−–÷/＝=]|[×*+\-＋－−–÷/＝=]\s*\b[FQ]\b/.test(t)) problems.push('fraction arithmetic is not verified by this lesson\'s checker (fail closed): "' + String(text).replace(/<[^>]+>/g, '').slice(0, 60) + '"');
  /* 兩邊都不是數字（也不是括號）的 ÷／＝ 是散文：`前項 ÷ 後項`、`比值 ＝ 前項 ÷ 後項` */
  t = t.replace(/÷(?!\s*[\d(（])/g, '／').replace(/(?<![\d)）]\s*)÷/g, '／');
  t = t.replace(/(?<![\d)）]\s*)[＝=]/g, '是').replace(/[＝=](?!\s*[\d(（])/g, '是');
  const rest = arithProblems(t);
  rest.problems.forEach(p => problems.push(p));
  verified += rest.verified;
  return { problems, verified };
}
/* 驗算器自己的 PROBE：bad:false 必須零誤報，bad:true 一定要抓到。 */
const CLAIM_PROBES = [
  { text:'2 : 3 ＝ 6 : 9（比值都是 2/3）', bad:false },
  { text:'比值：6 ÷ 4 ＝ 3/2', bad:false },
  { text:'比值 ＝ 前項 ÷ 後項', bad:false },
  { text:'The value is first term ÷ second term: 4 ÷ 6 = 2/3 in simplest form.', bad:false },
  { text:'3 ＋ 2 ＝ 5 份，20 ÷ 5 ＝ 4，一份 4 顆；哥哥 3 份：3 × 4 ＝ 12 顆。', bad:false },
  { text:'12 : 8 同除以 4 就是 3 : 2，比對了。', bad:false },
  { text:'12 ÷ 18 和 2 ÷ 3 都是 2/3。', bad:false },
  { text:'3/15 ＝ 1/5', bad:false },
  { text:'2 × 18 ＝ 36，3 × 12 ＝ 36，一樣就相等。', bad:false },
  { text:'5 ＋ 3 和 3 ＋ 5 一樣多', bad:false },
  { text:'9 ÷ 12 = 3/4. 3 and 6 are too small', bad:false },
  { text:'8 ÷ 2 ＝ 4，是 4 倍；3 × 4 ＝ 12 杯（2 : 3 ＝ 8 : 12）。', bad:false },
  { text:'2 : 3 ＝ 4 : 5', bad:true },
  { text:'2 : 3 ＝ 4 : 6 ＝ 6 : 8', bad:true },
  { text:'6 ÷ 4 ＝ 2/3', bad:true },
  { text:'4 ÷ 6 = 3/2', bad:true },
  { text:'3/15 ＝ 1/4', bad:true },
  { text:'20 ÷ 5 ＝ 5', bad:true },
  { text:'3 × 4 ＝ 13', bad:true },
  { text:'12 ＋ 8 ＝ 21', bad:true },
  { text:'5 ÷ 0 ＝ 5', bad:true },
  { text:'2 : 3 ＝ 4 : 6 ＝ 8/13', bad:true },
  { text:'8/13 ＝ 2 : 3', bad:true },
  { text:'3/4 ＋ 1/4 ＝ 2', bad:true },
  { text:'比值 ＝ 2/3 ＋ 1', bad:true },
  { text:'2 : 3 的比值是 2/3，前項是後項的 2/3 倍', bad:false },
  { text:'the value of 2 : 3 is 2/3 (2 ÷ 3)', bad:false }
];

/* ---------- 7) 從畫出來的圖量回來：格子長條 ---------- */
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
  if (rows.a.length !== a) out.push(tag + ': the top bar has ' + rows.a.length + ' squares for the first term ' + a);
  if (rows.b.length !== b) out.push(tag + ': the bottom bar has ' + rows.b.length + ' squares for the second term ' + b);
  [['a', rows.a, ROW_A_Y_REF], ['b', rows.b, ROW_B_Y_REF]].forEach(([row, cells, y]) => {
    cells.sort((p, q) => p.x - q.x);
    cells.forEach((c, i) => {
      if (c.y !== y) out.push(tag + ': a square of row ' + row + ' sits at y=' + c.y + ', the row is at ' + y);
      const wantX = BAR_X0_REF + i * (U_REF + UGAP_REF);
      if (c.x !== wantX) out.push(tag + ': square ' + i + ' of row ' + row + ' is at x=' + c.x + ', expected ' + wantX + ' (equal spacing from the left)');
      if (i > 0 && c.x < cells[i - 1].x + cells[i - 1].w + UGAP_REF - 1e-9) out.push(tag + ': squares ' + (i - 1) + ' and ' + i + ' of row ' + row + ' overlap or touch');
    });
  });
  if (rows.a.length && rows.b.length && Math.abs(ROW_B_Y_REF - ROW_A_Y_REF) < U_REF + 2 * Math.abs(LABEL_DY_REF)) out.push(tag + ': the two bars are too close for the lower label to fit between them');
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
  canvasProblems(svgOfBars(pl, labelA, labelB)).forEach(m => out.push(tag + ' canvas: ' + m));
  return out;
}
/* 化簡的階梯：每一列同除以能同時整除的最小質數，除到互質就停，左邊相乘是最大公因數。 */
function stepsProblems(tag, R, a, b){
  const out = [];
  if (!R || !Array.isArray(R.rows) || !Array.isArray(R.bottom)){ out.push(tag + ': reduceSteps is not shaped like a ladder'); return out; }
  if (R.a !== a || R.b !== b) out.push(tag + ': ladder is for ' + R.a + ',' + R.b);
  let x = a, y = b, g = 1;
  R.rows.forEach((row, i) => {
    if (!isPrimeRef(row.p)) out.push(tag + ': step ' + i + ' divides by ' + row.p + ', which is not prime');
    if (row.a !== x || row.b !== y) out.push(tag + ': step ' + i + ' shows ' + row.a + ',' + row.b + ', expected ' + x + ',' + y);
    if (x % row.p !== 0 || y % row.p !== 0) out.push(tag + ': step ' + i + ' divides by ' + row.p + ', which does not divide both');
    if (row.p !== smallestCommonPrimeRef(x, y)) out.push(tag + ': step ' + i + ' divides by ' + row.p + ', the smallest shared prime is ' + smallestCommonPrimeRef(x, y));
    if (row.qa !== x / row.p || row.qb !== y / row.p) out.push(tag + ': step ' + i + ' quotients are wrong');
    x = x / row.p; y = y / row.p; g *= row.p;
  });
  if (R.bottom[0] !== x || R.bottom[1] !== y) out.push(tag + ': bottom is ' + R.bottom + ', expected ' + x + ',' + y);
  if (gcdRef(x, y) !== 1) out.push(tag + ': stopped at ' + x + ',' + y + ' which still share ' + gcdRef(x, y));
  if (R.g !== g || R.g !== gcdRef(a, b)) out.push(tag + ': g is ' + R.g + ', the divisors multiply to ' + g + ' and the exponent method says ' + gcdRef(a, b));
  const s = simplestRef(a, b);
  if (!sameList(R.bottom, s)) out.push(tag + ': bottom ' + R.bottom + ' is not the simplest ratio ' + s);
  return out;
}

/* ---------- 8) 產生器：不變條件的共用檢查 ---------- */
/* 同一題的四個選項要同一種形狀：都是比、或都是數（分數／整數，可帶單位）、或都是整句話 —— 混在一起時「2 : 3」和「2/3」會被當成不同的值 */
function shapeOf(s){ if (parseRatioOpt(s)) return 'ratio'; if (parseNumOpt(s)) return 'number'; return 'text'; }
function mixedShapes(opts){ const shapes = new Set(opts.map(shapeOf)); return shapes.size > 1 ? 'options are not all the same shape: ' + opts.join(' | ') : null; }
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
function intOptsProblems(id, d, lo, hi, avoid){
  const bad = fourDistinct(id, d); if (bad) return bad;
  const vals = d.opts.map(Number);
  if (vals.some(v => !Number.isInteger(v))) return id + ': an option is not an integer: ' + d.opts;
  if (new Set(vals).size !== 4) return id + ': options repeat a value: ' + d.opts;
  if (vals.some(v => v < lo || v > hi)) return id + ': an option is outside ' + lo + '..' + hi + ': ' + d.opts;
  const echo = vals.filter((v, i) => i !== d.ans && (avoid || []).indexOf(v) >= 0);
  if (echo.length) return id + ': distractor ' + echo[0] + ' copies a number the stem prints';
  return null;
}
function termProblems(id, a, b){
  if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 1 && b >= 1 && a <= LIMIT_REF && b <= LIMIT_REF)) return id + ': (' + a + ',' + b + ') is not two whole numbers in 1..30';
  return null;
}
function ratioOptsProblems(id, d){
  const bad = fourDistinct(id, d); if (bad) return bad;
  const prs = d.opts.map(parseRatioOpt);
  if (prs.some(p => !p)) return id + ': an option is not written as a : b: ' + d.opts;
  for (const p of prs){ const t = termProblems(id, p[0], p[1]); if (t) return t; }
  return null;
}

module.exports = {
  /* ================= 產生器模擬（tools/simgen.js） ================= */
  sim: {
    INVARIANTS: {
      readRatio: d => {
        const bad = termProblems('readRatio', d.a, d.b); if (bad) return bad;
        if (d.a > 12 || d.b > 12) return 'readRatio: (' + d.a + ',' + d.b + ') leaves the 12-square pool';
        if (d.a === d.b) return 'readRatio: a = b, so the swapped distractor would equal the answer';
        if (!ITEMS_REF.zh[d.id] || d.id === 'recipe') return 'readRatio: unknown item ' + d.id;
        const r = ratioOptsProblems('readRatio', d); if (r) return r;
        const f = d.rev ? d.b : d.a, s = d.rev ? d.a : d.b;
        if (d.opts[d.ans] !== ratioTextRef(f, s)) return 'readRatio: opts[ans]=' + d.opts[d.ans] + ' is not ' + ratioTextRef(f, s);
        const eq = d.opts.map(parseRatioOpt).filter(p => sameRatioRef(f, s, p[0], p[1]));
        if (eq.length !== 1) return 'readRatio: ' + eq.length + ' options are equal to the answer ratio';
        const dv = distinctValues('readRatio', d.opts); if (dv) return dv;
        if (d.opts.indexOf(ratioTextRef(s, f)) < 0) return 'readRatio: the swapped-order distractor is missing';
      },
      ratioValue: d => {
        const bad = termProblems('ratioValue', d.a, d.b); if (bad) return bad;
        if (d.a === d.b || d.a < 2 || d.b < 2) return 'ratioValue: (' + d.a + ',' + d.b + ') leaves the pool (both ≥ 2, different)';
        const f = fourDistinct('ratioValue', d); if (f) return f;
        if (d.opts[d.ans] !== valueTextRef(d.a, d.b)) return 'ratioValue: opts[ans]=' + d.opts[d.ans] + ' is not ' + valueTextRef(d.a, d.b);
        for (const o of d.opts){ const p = parseNumOpt(o); if (!p || p.unit) return 'ratioValue: option "' + o + '" is not a bare fraction or whole number'; if (p.n < 1 || p.d < 1 || p.n > 60 || p.d > 60) return 'ratioValue: option "' + o + '" is out of range'; if (gcdRef(p.n, p.d) !== 1) return 'ratioValue: option "' + o + '" is not in simplest form'; }
        const dv = distinctValues('ratioValue', d.opts); if (dv) return dv;
        /* 倒過來的比值是這一課最重要的誘答 —— 除非它剛好等於題幹上的 a 或 b（那是抄題，不可以端出來） */
        const flip = valueTextRef(d.b, d.a);
        if (flip !== String(d.a) && flip !== String(d.b) && d.opts.indexOf(flip) < 0) return 'ratioValue: the upside-down distractor ' + flip + ' is missing';
        const echo = d.opts.filter((o, i) => i !== d.ans && (o === String(d.a) || o === String(d.b)));
        if (echo.length) return 'ratioValue: distractor ' + echo[0] + ' copies a stem number';
      },
      simplestRatio: d => {
        const bad = termProblems('simplestRatio', d.a, d.b); if (bad) return bad;
        const g = gcdRef(d.a, d.b);
        if (g === 1 || d.a === d.b || d.a < 2 || d.b < 2) return 'simplestRatio: (' + d.a + ',' + d.b + ') is already simplest or leaves the pool';
        if (d.g !== g) return 'simplestRatio: g=' + d.g + ', the exponent method says ' + g;
        const r = ratioOptsProblems('simplestRatio', d); if (r) return r;
        const s = simplestRef(d.a, d.b);
        if (d.opts[d.ans] !== ratioTextRef(s[0], s[1])) return 'simplestRatio: opts[ans]=' + d.opts[d.ans] + ' is not ' + ratioTextRef(s[0], s[1]);
        const eq = d.opts.map(parseRatioOpt).filter(p => sameRatioRef(d.a, d.b, p[0], p[1]));
        if (eq.length !== 1) return 'simplestRatio: ' + eq.length + ' options are equal to ' + ratioTextRef(d.a, d.b) + ' (an unsimplified copy would be reachable by correct reasoning)';
        const dv = distinctValues('simplestRatio', d.opts); if (dv) return dv;
        if (d.opts.indexOf(ratioTextRef(s[1], s[0])) < 0) return 'simplestRatio: the swapped distractor is missing';
      },
      equalRatio: d => {
        const bad = termProblems('equalRatio', d.c, d.d); if (bad) return bad;
        if (gcdRef(d.c, d.d) !== 1 || d.c > 7 || d.d > 7 || d.c === d.d) return 'equalRatio: base (' + d.c + ',' + d.d + ') is not a simplest ratio within 7';
        if (!(d.k >= 2 && d.k <= 4)) return 'equalRatio: k=' + d.k + ' is outside 2..4';
        const r = ratioOptsProblems('equalRatio', d); if (r) return r;
        if (d.opts[d.ans] !== ratioTextRef(d.c * d.k, d.d * d.k)) return 'equalRatio: opts[ans] is not the base times k';
        const eq = d.opts.map(parseRatioOpt).filter(p => sameRatioRef(d.c, d.d, p[0], p[1]));
        if (eq.length !== 1) return 'equalRatio: ' + eq.length + ' options equal the base ratio, the stem promises exactly one';
        const dv = distinctValues('equalRatio', d.opts); if (dv) return dv;
        if (d.opts.indexOf(ratioTextRef(d.c + 1, d.d + 1)) < 0) return 'equalRatio: the "add 1 to both" distractor is missing';
      },
      scaleUp: d => {
        const bad = termProblems('scaleUp', d.c, d.d); if (bad) return bad;
        if (gcdRef(d.c, d.d) !== 1 || d.c > 9 || d.d > 9 || d.c === d.d) return 'scaleUp: base (' + d.c + ',' + d.d + ') is not a simplest ratio within 9';
        if (!(d.k >= 2 && d.k <= 6)) return 'scaleUp: k=' + d.k + ' is outside 2..6';
        if (['paint', 'juice', 'recipe', 'team'].indexOf(d.id) < 0) return 'scaleUp: unknown item ' + d.id;
        const A = d.c * d.k, B = d.d * d.k;
        if (A > TOTAL_LIMIT_REF || B > TOTAL_LIMIT_REF) return 'scaleUp: amounts leave 100';
        const o = intOptsProblems('scaleUp', d, 1, TOTAL_LIMIT_REF, [A, d.c, d.d]); if (o) return o;
        if (d.opts[d.ans] !== B) return 'scaleUp: opts[ans]=' + d.opts[d.ans] + ' is not ' + B;
        const additive = A + d.d - d.c;
        if (additive >= 1 && additive !== B && [A, d.c, d.d].indexOf(additive) < 0 && d.opts.indexOf(additive) < 0) return 'scaleUp: the additive distractor ' + additive + ' fits but is missing';
      },
      shareTotal: d => {
        const bad = termProblems('shareTotal', d.c, d.d); if (bad) return bad;
        if (gcdRef(d.c, d.d) !== 1 || d.c > 9 || d.d > 9 || d.c === d.d) return 'shareTotal: base (' + d.c + ',' + d.d + ') is not a simplest ratio within 9';
        if (!SHARE_NAMES_REF.zh[d.id]) return 'shareTotal: unknown scenario ' + d.id;
        const parts = d.c + d.d;
        if (!(Number.isInteger(d.u) && d.u >= 2)) return 'shareTotal: one part u=' + d.u + ' is not a whole number ≥ 2';
        if (d.total !== parts * d.u) return 'shareTotal: total ' + d.total + ' is not (c + d) × u';
        if (d.total > TOTAL_LIMIT_REF) return 'shareTotal: total ' + d.total + ' exceeds 100';
        const A = d.c * d.u, B = d.d * d.u;
        if (A + B !== d.total) return 'shareTotal: the shares do not add up to the total';
        if (!sameRatioRef(A, B, d.c, d.d)) return 'shareTotal: the shares ' + A + ':' + B + ' do not simplify back to ' + d.c + ':' + d.d;
        const o = intOptsProblems('shareTotal', d, 1, TOTAL_LIMIT_REF, [d.total, d.c, d.d]); if (o) return o;
        if (d.opts[d.ans] !== A) return 'shareTotal: opts[ans]=' + d.opts[d.ans] + ' is not ' + A;
        if ([d.total, d.c, d.d].indexOf(B) < 0 && d.opts.indexOf(B) < 0) return 'shareTotal: the other share ' + B + ' is missing as a distractor';
      },
      fractionOfWhole: d => {
        const bad = termProblems('fractionOfWhole', d.a, d.b); if (bad) return bad;
        if (d.a > 12 || d.b > 12 || d.a === d.b) return 'fractionOfWhole: (' + d.a + ',' + d.b + ') leaves the pool';
        if (!ITEMS_REF.zh[d.id] || d.id === 'recipe') return 'fractionOfWhole: unknown item ' + d.id;
        const f = fourDistinct('fractionOfWhole', d); if (f) return f;
        if (d.opts[d.ans] !== valueTextRef(d.a, d.a + d.b)) return 'fractionOfWhole: opts[ans] is not ' + valueTextRef(d.a, d.a + d.b);
        for (const o of d.opts){ const p = parseNumOpt(o); if (!p || p.unit) return 'fractionOfWhole: option "' + o + '" is not a bare fraction'; if (gcdRef(p.n, p.d) !== 1) return 'fractionOfWhole: option "' + o + '" is not in simplest form'; }
        const dv = distinctValues('fractionOfWhole', d.opts); if (dv) return dv;
        const rv = valueTextRef(d.a, d.b);
        if (rv !== String(d.a) && rv !== String(d.b) && d.opts.indexOf(rv) < 0) return 'fractionOfWhole: the ratio-value distractor ' + rv + ' (the confusion this lesson warns about) is missing';
      },
      ratioFromValue: d => {
        const bad = termProblems('ratioFromValue', d.n, d.d); if (bad) return bad;
        if (gcdRef(d.n, d.d) !== 1 || d.n > 7 || d.d > 7 || d.n === d.d) return 'ratioFromValue: value (' + d.n + '/' + d.d + ') is not a simplest fraction within 7';
        if (!(d.k >= 1 && d.k <= 3)) return 'ratioFromValue: k=' + d.k;
        const r = ratioOptsProblems('ratioFromValue', d); if (r) return r;
        if (d.opts[d.ans] !== ratioTextRef(d.n * d.k, d.d * d.k)) return 'ratioFromValue: opts[ans] is not n : d times k';
        const eq = d.opts.map(parseRatioOpt).filter(p => sameRatioRef(d.n, d.d, p[0], p[1]));
        if (eq.length !== 1) return 'ratioFromValue: ' + eq.length + ' options have the asked value';
        const dv = distinctValues('ratioFromValue', d.opts); if (dv) return dv;
      },
      trueStatement: d => {
        if (!TRUE_STATEMENTS_REF[d.t]) return 'trueStatement: "' + d.t + '" is not a true statement';
        const f = fourDistinct('trueStatement', d); if (f) return f;
        const trues = d.opts.filter(k => TRUE_STATEMENTS_REF[k]);
        if (trues.length !== 1) return 'trueStatement: ' + trues.length + ' true sentences offered, the stem promises exactly one';
        if (d.opts.some(k => !TRUE_STATEMENTS_REF[k] && FALSE_KEYS_REF.indexOf(k) < 0)) return 'trueStatement: an option key is unknown to the truth table: ' + d.opts;
        if (d.opts[d.ans] !== d.t) return 'trueStatement: opts[ans] is ' + d.opts[d.ans];
      },
      interGcf: d => {
        const bad = termProblems('interGcf', d.a, d.b); if (bad) return bad;
        const g = gcdRef(d.a, d.b);
        if (d.g !== g) return 'interGcf: g=' + d.g + ', the exponent method says ' + g;
        if (g === 1 || isPrimeRef(g)) return 'interGcf: gcf ' + g + ' is 1 or prime, the pool promises a composite gcf (so a "not finished" distractor exists)';
        if (d.a === d.b) return 'interGcf: a = b';
        const o = intOptsProblems('interGcf', d, 1, LIMIT_REF, [d.a, d.b]); if (o) return o;
        if (d.opts[d.ans] !== g) return 'interGcf: opts[ans]=' + d.opts[d.ans] + ' is not the gcf ' + g;
        const p = smallestCommonPrimeRef(d.a, d.b);
        if (d.opts.indexOf(p) < 0 && p !== d.a && p !== d.b) return 'interGcf: the "smallest shared prime only" distractor ' + p + ' is missing';
      },
      unitRate: d => {
        if (!(Number.isInteger(d.a) && d.a >= 2 && d.a <= 9)) return 'unitRate: a=' + d.a + ' is outside 2..9';
        if (!(Number.isInteger(d.u) && d.u >= 3 && d.u <= 12)) return 'unitRate: u=' + d.u + ' is outside 3..12';
        if (d.T !== d.a * d.u) return 'unitRate: T=' + d.T + ' is not a × u';
        if (d.T > TOTAL_LIMIT_REF) return 'unitRate: total ' + d.T + ' exceeds 100';
        const o = intOptsProblems('unitRate', d, 1, TOTAL_LIMIT_REF, [d.a, d.T]); if (o) return o;
        if (d.opts[d.ans] !== d.u) return 'unitRate: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.u;
      },
      whichNotEqual: d => {
        const bad = termProblems('whichNotEqual', d.c, d.d); if (bad) return bad;
        if (gcdRef(d.c, d.d) !== 1 || d.c > 7 || d.d > 7 || d.c === d.d) return 'whichNotEqual: base (' + d.c + ',' + d.d + ') is not a simplest ratio within 7';
        const r = ratioOptsProblems('whichNotEqual', d); if (r) return r;
        const prs = d.opts.map(parseRatioOpt);
        const ne = prs.filter(p => !sameRatioRef(d.c, d.d, p[0], p[1]));
        if (ne.length !== 1) return 'whichNotEqual: ' + ne.length + ' options are not equal to the base, the stem promises exactly one';
        if (d.opts[d.ans] !== d.odd || d.odd !== ratioTextRef(ne[0][0], ne[0][1])) return 'whichNotEqual: the marked option is not the unequal one';
        if (!Array.isArray(d.ks) || d.ks.length !== 3 || new Set(d.ks).size !== 3 || d.ks.some(k => k < 2 || k > 4)) return 'whichNotEqual: ks is not three distinct multiples in 2..4';
        const eqOnes = d.opts.filter(o => o !== d.odd);
        if (!sameList(eqOnes.slice().sort(), d.ks.map(k => ratioTextRef(d.c * k, d.d * k)).sort())) return 'whichNotEqual: the equal options are not the base times ks';
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'readRatio': return ratioTextRef(d.rev ? d.b : d.a, d.rev ? d.a : d.b);
        case 'ratioValue': return valueTextRef(d.a, d.b);
        case 'simplestRatio': { const s = simplestRef(d.a, d.b); return ratioTextRef(s[0], s[1]); }
        case 'equalRatio': return ratioTextRef(d.c * d.k, d.d * d.k);
        case 'scaleUp': return qtyRef(lang, d.id, 'b', d.d * d.k);
        case 'shareTotal': return shareUnitTextRef(d.id, d.c * d.u, lang);
        case 'fractionOfWhole': return valueTextRef(d.a, d.a + d.b);
        case 'ratioFromValue': return ratioTextRef(d.n * d.k, d.d * d.k);
        case 'trueStatement': return TRUE_STATEMENTS_REF[d.t] ? TRUE_STATEMENTS_REF[d.t][lang] : null;
        case 'interGcf': return String(gcdRef(d.a, d.b));
        case 'unitRate': return lang === 'zh' ? d.u + ' 元' : plEnRef(d.u, 'dollar');
        case 'whichNotEqual': { const ne = (d.opts || []).filter(o => { const p = parseRatioOpt(o); return p && !sameRatioRef(d.c, d.d, p[0], p[1]); }); return ne.length === 1 ? ne[0] : null; }
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣：比 `a : b`、分數／整數（可帶單位）、或固定的整句話。 */
    optionOk: function(s, genId, lang, isCorrect){
      const t = String(s).trim();
      if (!t) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
      if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
      if (lang === 'en' && /\p{Script=Han}/u.test(t)) return 'English option contains Chinese: ' + t;
      if (genId === 'trueStatement') return t.length >= 6 && t.length <= 100 && statementTruthOfText(t, lang) !== null ? null : 'trueStatement option is not one of the pinned sentences: ' + t;
      if (['readRatio', 'simplestRatio', 'equalRatio', 'ratioFromValue', 'whichNotEqual'].indexOf(genId) >= 0){
        const p = parseRatioOpt(t);
        if (!p) return genId + ' option is not written as a : b: ' + t;
        if (p[0] < 1 || p[1] < 1 || p[0] > LIMIT_REF || p[1] > LIMIT_REF) return genId + ' option leaves 1..30: ' + t;
        if (isCorrect && genId === 'simplestRatio' && gcdRef(p[0], p[1]) !== 1) return 'the correct simplestRatio option ' + t + ' is not in simplest form';
        return null;
      }
      if (genId === 'ratioValue' || genId === 'fractionOfWhole'){
        const p = parseNumOpt(t);
        if (!p || p.unit) return genId + ' option is not a bare fraction or whole number: ' + t;
        if (p.d < 1 || p.n < 1 || p.n > 60 || p.d > 60) return genId + ' option is out of range: ' + t;
        if (gcdRef(p.n, p.d) !== 1) return genId + ' option ' + t + ' is not in simplest form';
        if (genId === 'fractionOfWhole' && isCorrect && p.n >= p.d) return 'a fraction of the whole must be below 1: ' + t;
        return null;
      }
      const p = parseNumOpt(t);
      if (!p || p.d !== 1) return genId + ' option is not a whole number with an optional unit: ' + t;
      const hi = genId === 'interGcf' ? LIMIT_REF : TOTAL_LIMIT_REF;
      if (p.n < 1 || p.n > hi) return genId + ' option ' + t + ' is outside 1..' + hi;
      if (genId === 'interGcf' && p.unit) return 'interGcf option carries a unit: ' + t;
      if (genId === 'unitRate' && !p.unit) return 'unitRate option has no unit: ' + t;
      if (genId === 'scaleUp' || genId === 'shareTotal'){
        /* team／people 沒有單位字，數字後面直接接名詞 */
        if (!p.unit && !/^\d+ (boys|girls|people|person)$/.test(t) && !/^\d+$/.test(t)) return genId + ' option has an unexpected shape: ' + t;
      }
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次：整句題幹重建、值去重、算式算對、字串乾淨、以及每一支自己的語意。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length !== 4) out.push('there are ' + q.opts.length + ' options, not four');
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');
      const mixed = mixedShapes(q.opts); if (mixed) out.push(mixed);
      const want = stemRef(genId, d, lang);
      if (want === null) out.push('no stem reference for ' + genId);
      else if (q.stem !== want) out.push('the rendered stem is not the rebuilt sentence: "' + q.stem.replace(/<[^>]+>/g, '') + '"');
      /* 值去重：反向題 whichNotEqual 例外（三個相等的比是設計） */
      if (genId !== 'whichNotEqual'){
        const keys = q.opts.map(optKeyRef);
        for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) if (keys[i] === keys[j]) out.push('two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
      } else {
        const prs = q.opts.map(parseRatioOpt);
        if (prs.some(p => !p)) out.push('a rendered option is not a ratio');
        else {
          const ne = prs.filter(p => !sameRatioRef(d.c, d.d, p[0], p[1]));
          if (ne.length !== 1) out.push('the rendered options contain ' + ne.length + ' ratios not equal to the base');
          else if (sameRatioRef(d.c, d.d, prs[q.ans][0], prs[q.ans][1])) out.push('the marked option is equal to the base');
          if (new Set(q.opts).size !== 4) out.push('two options are the same string');
        }
      }
      const ar = arithAll(q.stem + ' ' + q.why);
      ar.problems.forEach(m => out.push(m));
      if (['ratioValue', 'simplestRatio', 'equalRatio', 'scaleUp', 'shareTotal', 'fractionOfWhole', 'ratioFromValue', 'interGcf', 'unitRate'].indexOf(genId) >= 0 && ar.verified < 1)
        out.push('the explanation should contain an equation to verify, but none was read');
      stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
      stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
      FALSE_KEYS_REF.forEach(k => { if (q.why.indexOf(FALSE_STATEMENTS_REF[k][lang]) >= 0) out.push('the explanation states the misconception "' + FALSE_STATEMENTS_REF[k][lang] + '"'); });
      q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
      /* 每一支自己的語意，從**印出來的**選項讀回來 */
      if (genId === 'readRatio' || genId === 'equalRatio' || genId === 'ratioFromValue' || genId === 'simplestRatio'){
        const prs = q.opts.map(parseRatioOpt);
        if (prs.some(p => !p)) out.push('a rendered option is not a ratio');
        else {
          const base = genId === 'readRatio' ? [d.rev ? d.b : d.a, d.rev ? d.a : d.b] : genId === 'equalRatio' ? [d.c, d.d] : genId === 'ratioFromValue' ? [d.n, d.d] : [d.a, d.b];
          const eq = prs.filter(p => sameRatioRef(base[0], base[1], p[0], p[1]));
          if (eq.length !== 1) out.push('the rendered options contain ' + eq.length + ' ratios equal to ' + ratioTextRef(base[0], base[1]));
          else if (!sameRatioRef(base[0], base[1], prs[q.ans][0], prs[q.ans][1])) out.push('the marked option is not the equal ratio');
        }
      }
      if (genId === 'ratioValue' || genId === 'fractionOfWhole'){
        const wantV = genId === 'ratioValue' ? valueRef(d.a, d.b) : valueRef(d.a, d.a + d.b);
        const vals = q.opts.map(parseNumOpt);
        if (vals.some(v => !v)) out.push('a rendered option is not a number');
        else {
          const hit = vals.filter(v => v.n * wantV.d === wantV.n * v.d);
          if (hit.length !== 1) out.push('the rendered options contain ' + hit.length + ' options with the asked value');
        }
      }
      if (genId === 'scaleUp' || genId === 'shareTotal' || genId === 'unitRate'){
        const wantText = module.exports.sim.expectedCorrect(d, genId, lang);
        if (q.opts[q.ans] !== wantText) out.push('the marked option is not "' + wantText + '"');
        q.opts.forEach(o => { const p = parseNumOpt(o); if (!p) out.push('option "' + o + '" is not a number with a unit'); });
        /* 同一題的四個選項單位要一致（英文 1 要單數，所以比「去掉尾 s 之後」） */
        const units = new Set(q.opts.map(o => (parseNumOpt(o) || { unit:'' }).unit.replace(/s$/, '').replace(/^people$|^person$/, 'people')));
        if (units.size > 1) out.push('options carry different units: ' + q.opts.join(' | '));
      }
      if (genId === 'trueStatement'){
        let trues = 0;
        q.opts.forEach(o => { const tv = statementTruthOfText(o, lang); if (tv === null) out.push('option "' + o + '" is not one of the pinned statement texts'); else if (tv) trues++; });
        if (trues !== 1) out.push('the rendered options contain ' + trues + ' true sentences');
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
    dataReturn: '{LIMIT, TOTAL_LIMIT, MAX_UNITS, isPosInt, gcd, simplest, ratioValue, valueText, ratioText, sameRatio, isPrime, commonPrime, reduceSteps, ' +
                'FIG_W, BAR_H, U, UGAP, BAR_X0, ROW_A_Y, ROW_B_Y, LABEL_DY, LABEL_FS, barPlan, ' +
                'S1_CASES, S2_CASES, S3_CASES, S4_CASES, scaleGiven, scaleAnswer, S5_CASES, shareParts, shareUnit, shareA, shareB, ' +
                'ROUNDS, pairOf, parseRatio, roundAnswer, roundAnswerIndex, roundFigure, plEn, ITEMS, qty, barLabel}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器自己先過 PROBE ---- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = arithAll(pr.text).problems.length > 0;
        if (caught !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"' + (caught ? ': ' + arithAll(pr.text).problems[0] : ''));
      });
      const lessonDir = path.dirname(process.argv[2]);      /* ⚠️ 不可以用 __dirname：breaktest 把四頁複製到暫存目錄 */
      const RAW = {}, TEXT = {};
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        try { RAW[pg] = fs.readFileSync(path.join(lessonDir, pg + '.html'), 'utf8'); TEXT[pg] = visibleText(RAW[pg]); }
        catch (e){ fail('cannot read ' + pg + '.html next to index.html (' + e.code + ')'); }
      });

      /* ---- 1. 版面常數 ＝ 獨立寫死的第二份；六張畫布的 viewBox 與 CSS 高度 ---- */
      const CONSTS = { LIMIT:LIMIT_REF, TOTAL_LIMIT:TOTAL_LIMIT_REF, MAX_UNITS:MAX_UNITS_REF, FIG_W:FIG_W_REF, BAR_H:BAR_H_REF, U:U_REF, UGAP:UGAP_REF, BAR_X0:BAR_X0_REF, ROW_A_Y:ROW_A_Y_REF, ROW_B_Y:ROW_B_Y_REF, LABEL_DY:LABEL_DY_REF, LABEL_FS:LABEL_FS_REF };
      Object.keys(CONSTS).forEach(k => { if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ' but the reference says ' + CONSTS[k]); });
      /* 18 格真的放得進畫布：用參考常數自己算，不相信 MAX_UNITS 的註解 */
      if (BAR_X0_REF + MAX_UNITS_REF * (U_REF + UGAP_REF) - UGAP_REF > FIG_W_REF) fail('MAX_UNITS squares do not fit the canvas width');
      if (ROW_B_Y_REF + U_REF > BAR_H_REF) fail('the bottom bar leaves the canvas');
      const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const svgs = liveSrc.match(/<svg[^>]*>/g) || [];
      if (svgs.length !== 6) fail('index.html has ' + svgs.length + ' canvases, expected 6 (five examples and the game; the reducing ladder is HTML)');
      svgs.forEach(tag => {
        const cls = (/class="([^"]+)"/.exec(tag) || [])[1];
        const nums = ((/viewBox="([^"]+)"/.exec(tag) || ['', ''])[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (cls !== 'barfig') fail('a canvas has class "' + cls + '", which this config does not know');
        else if (nums.length !== 4 || nums[0] !== 0 || nums[1] !== 0 || nums[2] !== FIG_W_REF || nums[3] !== BAR_H_REF) fail('a canvas viewBox is ' + tag + ', expected 0 0 ' + FIG_W_REF + ' ' + BAR_H_REF);
      });
      const rules = liveSrc.match(/\.barfig\s*\{[^}]*\}/g) || [];
      if (rules.length !== 1) fail('index.html declares the .barfig rule ' + rules.length + ' time(s), expected exactly 1');
      else {
        const hs = rules[0].match(/[{;]\s*height:\s*(\d+)px/g) || [];
        if (hs.length !== 1) fail('the .barfig rule declares a plain height ' + hs.length + ' time(s)');
        else if (Number(/height:\s*(\d+)px/.exec(hs[0])[1]) !== BAR_H_REF) fail('.barfig is ' + hs[0].trim() + ' in CSS but the viewBox is ' + BAR_H_REF + ' tall — the drawing would be letterboxed');
      }

      /* ---- 2. 數論函式 vs 質因數次方法；相等的比 vs 最簡整數比同一對；課程明講的規則逐對驗 ---- */
      if (data.gcd(0, 5) !== null || data.gcd(2.5, 5) !== null || data.gcd(Infinity, 5) !== null || data.gcd(-4, 6) !== null) fail('gcd does not fail closed on bad input');
      if (data.ratioValue(3, 0) !== null || data.simplest(0, 0) !== null || data.reduceSteps(0, 3) !== null) fail('ratioValue / simplest / reduceSteps do not fail closed on a zero term');
      if (data.valueText(null) !== '?') fail('valueText(null) is ' + data.valueText(null));
      if (data.sameRatio(2, 3, 4, 0) !== false || data.sameRatio(2, 3, 2.5, 3) !== false) fail('sameRatio does not fail closed on bad input');
      let pairs = 0, steps2 = 0;
      for (let a = 1; a <= LIMIT_REF; a++) for (let b = 1; b <= LIMIT_REF; b++){
        pairs++;
        if (data.gcd(a, b) !== gcdRef(a, b)) fail('gcd(' + a + ',' + b + ')=' + data.gcd(a, b) + ', the exponent method says ' + gcdRef(a, b));
        if (!sameList(data.simplest(a, b), simplestRef(a, b))) fail('simplest(' + a + ',' + b + ') is [' + data.simplest(a, b) + ']');
        const v = data.ratioValue(a, b), vr = valueRef(a, b);
        if (!v || v.n !== vr.n || v.d !== vr.d) fail('ratioValue(' + a + ',' + b + ') is ' + JSON.stringify(v));
        if (data.valueText(v) !== valueTextRef(a, b)) fail('valueText(' + a + ',' + b + ') is ' + data.valueText(v));
        if (data.ratioText(a, b) !== a + ' : ' + b) fail('ratioText(' + a + ',' + b + ') is not "a : b"');
        const R = data.reduceSteps(a, b);
        stepsProblems('reduceSteps(' + a + ',' + b + ')', R, a, b).forEach(fail);
        if (R && R.rows.length >= 2) steps2++;
        /* 同乘不變、同加會變（a ≠ b） */
        for (let k = 2; k <= 5; k++){
          if (data.valueText(data.ratioValue(a * k, b * k)) !== valueTextRef(a, b)) fail('multiplying both terms of ' + a + ' : ' + b + ' by ' + k + ' changed the value');
          if (!data.sameRatio(a, b, a * k, b * k)) fail('sameRatio(' + a + ',' + b + ',' + a * k + ',' + b * k + ') is false');
          if (a !== b && data.valueText(data.ratioValue(a + k, b + k)) === valueTextRef(a, b)) fail('adding ' + k + ' to both terms of ' + a + ' : ' + b + ' kept the value — the lesson says it always changes');
          if (a !== b && data.sameRatio(a, b, a + k, b + k)) fail('sameRatio says ' + a + ' : ' + b + ' equals ' + (a + k) + ' : ' + (b + k));
        }
        if (a !== b && data.sameRatio(a, b, b, a)) fail('sameRatio says ' + a + ' : ' + b + ' equals its reverse');
      }
      if (pairs !== LIMIT_REF * LIMIT_REF) fail('only ' + pairs + ' pairs were checked');
      if (!steps2) fail('no pair up to 30 needs two reducing steps — the domain looks broken');
      let quads = 0, stopped = false;
      for (let a = 1; a <= LIMIT_REF && !stopped; a++) for (let b = 1; b <= LIMIT_REF && !stopped; b++) for (let c = 1; c <= LIMIT_REF && !stopped; c++) for (let d = 1; d <= LIMIT_REF && !stopped; d++){
        quads++;
        if (data.sameRatio(a, b, c, d) !== sameRatioRef(a, b, c, d)){ fail('sameRatio(' + [a, b, c, d] + ') disagrees with comparing simplest forms'); stopped = true; }
      }
      if (quads < LIMIT_REF * LIMIT_REF * LIMIT_REF * LIMIT_REF) fail('the sameRatio sweep stopped early after ' + quads + ' quadruples');
      for (let n = 0; n <= 200; n++) if (data.isPrime(n) !== isPrimeRef(n)) fail('isPrime(' + n + ') is wrong');
      if (data.commonPrime(6, 10) !== 2 || data.commonPrime(9, 15) !== 3 || data.commonPrime(8, 15) !== null) fail('commonPrime is wrong on a spot check');
      if (data.plEn(1, 'cup') !== '1 cup' || data.plEn(2, 'cup') !== '2 cups') fail('plEn is wrong');
      if (data.qty('en', 'snack', 'a', 1) !== '1 cookie' || data.qty('en', 'team', 'a', 1) !== '1 boy' || data.qty('en', 'team', 'b', 2) !== '2 girls' || data.qty('en', 'paint', 'a', 1) !== '1 cup') fail('qty(en) singular forms are wrong: ' + [data.qty('en', 'snack', 'a', 1), data.qty('en', 'team', 'a', 1)].join(', '));
      if (data.qty('zh', 'snack', 'b', 6) !== '6 顆') fail('qty(zh) is wrong');
      if (!sameList(data.pairOf('12-18'), [12, 18]) || !sameList(data.parseRatio('6 : 9'), [6, 9]) || data.parseRatio('6:9') !== null) fail('pairOf / parseRatio are wrong');

      /* ---- 3. 格子長條：每一對 a, b ≤ 30 都畫一次量回來（標籤用兩種語言裡最長的） ---- */
      const LONG_ZH = '白色顏料 18 杯', LONG_EN = 'little brother: 18 parts';   /* 兩種語言裡最長的標籤形狀 */
      let drawn = 0, capped = 0;
      for (let a = 1; a <= LIMIT_REF; a++) for (let b = 1; b <= LIMIT_REF; b++){
        const pl = data.barPlan(a, b);
        barProblems('barPlan(' + a + ',' + b + ')', pl, a, b, LONG_EN, LONG_ZH).forEach(fail);
        if (pl && pl.tooMany) capped++; else drawn++;
      }
      if (!drawn || !capped) fail('barPlan domain: ' + drawn + ' drawable and ' + capped + ' capped pairs — both kinds must occur');
      const bad = data.barPlan(0, 3); if (!bad.tooMany || bad.cells.length) fail('barPlan(0,3) is drawn instead of failing closed');

      /* ---- 4. 範例 1～5 的案例 ---- */
      const s1 = data.S1_CASES.map(c => [c.id, c.a, c.b].join('-'));
      if (!sameList(s1, S1_CASES_REF.map(c => c.join('-')))) fail('S1_CASES is [' + s1 + ']');
      if (!data.S1_CASES.some(c => c.a > c.b) || !data.S1_CASES.some(c => c.a < c.b)) fail('S1_CASES must show a first term bigger than the second and one smaller');
      if (!data.S1_CASES.some(c => gcdRef(c.a, c.b) > 1)) fail('S1_CASES must include a ratio that is not in simplest form (the snack pair feeds example 3)');
      data.S1_CASES.forEach(c => { if (data.barPlan(c.a, c.b).tooMany) fail('S1 case ' + c.id + ' does not fit the picture'); });
      const pinPairs = (name, got, want) => { if (!sameList(got.map(p => p.join('-')), want.map(p => p.join('-')))) fail(name + ' is [' + got.map(p => p.join(',')) + '], the reference says [' + want.map(p => p.join(',')) + ']'); };
      pinPairs('S2_CASES', data.S2_CASES, S2_CASES_REF); pinPairs('S3_CASES', data.S3_CASES, S3_CASES_REF);
      const s2v = { big:0, small:0, one:0, whole:0 };
      S2_CASES_REF.forEach(pr => { const v = valueRef(pr[0], pr[1]); if (pr[0] > pr[1]) s2v.big++; if (pr[0] < pr[1]) s2v.small++; if (pr[0] === pr[1]) s2v.one++; if (v.d === 1 && v.n > 1) s2v.whole++; if (data.barPlan(pr[0], pr[1]).tooMany) fail('S2 case ' + pr + ' does not fit the picture'); });
      if (!s2v.big || !s2v.small || !s2v.one || !s2v.whole) fail('S2_CASES must show a value above 1, below 1, exactly 1, and a whole-number value — got ' + JSON.stringify(s2v));
      S3_CASES_REF.forEach(pr => { if (gcdRef(pr[0], pr[1]) === 1) fail('S3 case ' + pr + ' is already simplest, nothing to reduce'); if (data.barPlan(pr[0], pr[1]).tooMany) fail('S3 case ' + pr + ' does not fit the picture at step 0'); });
      if (!S3_CASES_REF.some(pr => data.reduceSteps(pr[0], pr[1]).rows.length >= 2)) fail('S3 needs a case that takes two steps');
      if (!S3_CASES_REF.some(pr => data.reduceSteps(pr[0], pr[1]).rows.length === 1)) fail('S3 needs a one-step case');
      if (!S3_CASES_REF.some(pr => pr[0] > pr[1])) fail('S3 needs a case with the first term bigger');
      const s4 = data.S4_CASES.map(c => [c.id, c.a, c.b, c.k].join('-'));
      if (!sameList(s4, S4_CASES_REF.map(c => c.join('-')))) fail('S4_CASES is [' + s4 + ']');
      data.S4_CASES.forEach(c => {
        if (gcdRef(c.a, c.b) !== 1) fail('S4 case ' + c.id + ' base ratio is not simplest');
        if (data.scaleGiven(c) !== c.a * c.k || data.scaleAnswer(c) !== c.b * c.k) fail('S4 ' + c.id + ' given/answer are wrong');
        if (!data.sameRatio(c.a, c.b, data.scaleGiven(c), data.scaleAnswer(c))) fail('S4 ' + c.id + ' scaled pair is not an equal ratio');
        if (data.scaleAnswer(c) > TOTAL_LIMIT_REF) fail('S4 ' + c.id + ' answer exceeds 100');
        if (data.barPlan(data.scaleGiven(c), data.scaleAnswer(c)).tooMany) fail('S4 ' + c.id + ' scaled pair does not fit the picture');
        if (data.scaleAnswer(c) === data.scaleGiven(c) + c.b - c.a) fail('S4 ' + c.id + ': the additive misconception gives the right answer here, so the example cannot show the difference');
      });
      const s5 = data.S5_CASES.map(c => [c.id, c.a, c.b, c.total].join('-'));
      if (!sameList(s5, S5_CASES_REF.map(c => c.join('-')))) fail('S5_CASES is [' + s5 + ']');
      data.S5_CASES.forEach(c => {
        if (gcdRef(c.a, c.b) !== 1) fail('S5 case ' + c.id + ' ratio is not simplest');
        const u = data.shareUnit(c);
        if (u === null || c.total % (c.a + c.b) !== 0 || u !== c.total / (c.a + c.b)) fail('S5 ' + c.id + ' total does not split into whole parts');
        if (data.shareParts(c) !== c.a + c.b) fail('S5 ' + c.id + ' parts are wrong');
        if (data.shareA(c) + data.shareB(c) !== c.total) fail('S5 ' + c.id + ' shares do not add up to the total');
        if (!sameRatioRef(data.shareA(c), data.shareB(c), c.a, c.b)) fail('S5 ' + c.id + ' shares do not simplify back to the ratio');
        if (c.total > TOTAL_LIMIT_REF) fail('S5 ' + c.id + ' total exceeds 100');
        if (data.barPlan(c.a, c.b).tooMany) fail('S5 ' + c.id + ' parts do not fit the picture');
        if (c.a === c.b) fail('S5 ' + c.id + ' is 1 : 1, which is just sharing equally');
      });
      if (data.shareUnit({ a:3, b:2, total:21 }) !== null) fail('shareUnit does not return null when the total does not split');

      /* ---- 5. 小遊戲 ---- */
      if (!Array.isArray(data.ROUNDS) || data.ROUNDS.length !== GAME_ROUNDS_REF) fail('ROUNDS has ' + (data.ROUNDS || []).length + ' rounds');
      const kinds = data.ROUNDS.map(r => r.kind);
      if (kinds.slice().sort().join() !== ['equalRatio', 'ratioValue', 'readRatio', 'scaleUp', 'shareTotal'].join()) fail('the five rounds are not one of each kind: ' + kinds);
      if (new Set(data.ROUNDS.map(r => r.ans)).size < 3) fail('the game answers sit in fewer than three different positions, so a child can learn the slot');
      data.ROUNDS.forEach((r, i) => {
        const tag = 'round ' + (i + 1) + ' (' + r.kind + ')';
        if (!Array.isArray(r.opts) || r.opts.length !== 4 || new Set(r.opts.map(String)).size !== 4) fail(tag + ': options are not four distinct');
        const idx = data.roundAnswerIndex(r);
        if (idx !== r.ans) fail(tag + ': roundAnswerIndex()=' + idx + ' but ans=' + r.ans);
        if (data.roundAnswer(r) === null) fail(tag + ': roundAnswer() is null');
        const fig = data.roundFigure(r);
        if (r.kind === 'readRatio' || r.kind === 'ratioValue' || r.kind === 'equalRatio' || r.kind === 'scaleUp'){
          if (!fig) fail(tag + ': should have a picture'); else barProblems(tag + ' picture', fig, r.a, r.b, LONG_EN, LONG_ZH).forEach(fail);
          if (r.a === r.b) fail(tag + ': a = b');
          const t = termProblems(tag, r.a, r.b); if (t) fail(t);
        } else if (fig !== null) fail(tag + ': only the first four rounds have a picture');
        if (r.kind === 'readRatio' || r.kind === 'equalRatio'){
          const prs = r.opts.map(parseRatioOpt);
          if (prs.some(p => !p)) fail(tag + ': an option is not a ratio');
          else {
            const eq = prs.filter(p => sameRatioRef(r.a, r.b, p[0], p[1]));
            if (eq.length !== 1) fail(tag + ': ' + eq.length + ' options equal ' + r.a + ' : ' + r.b);
            if (!sameRatioRef(r.a, r.b, prs[r.ans][0], prs[r.ans][1])) fail(tag + ': the marked option is not the equal ratio');
            if (r.kind === 'readRatio' && r.opts[r.ans] !== ratioTextRef(r.a, r.b)) fail(tag + ': the marked option is not written as a : b');
            if (r.kind === 'readRatio' && r.opts.indexOf(ratioTextRef(r.b, r.a)) < 0) fail(tag + ': the swapped-order distractor is missing');
            if (r.kind === 'equalRatio' && gcdRef(r.a, r.b) !== 1) fail(tag + ': the base ratio is not simplest');
            const keys = r.opts.map(optKeyRef); if (new Set(keys).size !== 4) fail(tag + ': two options have the same value');
          }
        }
        if (r.kind === 'ratioValue'){
          const vals = r.opts.map(parseNumOpt);
          if (vals.some(v => !v || v.unit)) fail(tag + ': an option is not a bare fraction or whole number');
          else {
            const want = valueRef(r.a, r.b);
            const hit = vals.filter(v => v.n * want.d === want.n * v.d);
            if (hit.length !== 1) fail(tag + ': ' + hit.length + ' options have the value ' + valueTextRef(r.a, r.b));
            if (r.opts[r.ans] !== valueTextRef(r.a, r.b)) fail(tag + ': the marked option is not ' + valueTextRef(r.a, r.b));
            if (r.opts.indexOf(valueTextRef(r.b, r.a)) < 0) fail(tag + ': the upside-down distractor is missing');
            vals.forEach((v, vi) => { if (gcdRef(v.n, v.d) !== 1) fail(tag + ': option ' + r.opts[vi] + ' is not in simplest form'); });
            const keys = r.opts.map(optKeyRef); if (new Set(keys).size !== 4) fail(tag + ': two options have the same value');
          }
        }
        if (r.kind === 'scaleUp'){
          if (gcdRef(r.a, r.b) !== 1) fail(tag + ': the base ratio is not simplest');
          if (!(r.k >= 2 && r.k <= 6)) fail(tag + ': k=' + r.k + ' is outside 2..6');
          const A = r.a * r.k, B = r.b * r.k;
          if (A > TOTAL_LIMIT_REF || B > TOTAL_LIMIT_REF) fail(tag + ': the slip uses an amount above 100 (' + A + ' or ' + B + ')');
          if (r.opts.some(v => !Number.isInteger(v) || v < 1 || v > TOTAL_LIMIT_REF)) fail(tag + ': an option leaves 1..100');
          if (r.opts.filter(v => v === B).length !== 1 || r.opts[r.ans] !== B) fail(tag + ': the marked option is not ' + B);
          if (r.opts.some((v, vi) => vi !== r.ans && (v === A || v === r.a || v === r.b))) fail(tag + ': a distractor copies a number the slip prints');
          const additive = A + r.b - r.a;
          if (additive !== B && r.opts.indexOf(additive) < 0) fail(tag + ': the additive distractor ' + additive + ' is missing');
        }
        if (r.kind === 'shareTotal'){
          if (gcdRef(r.a, r.b) !== 1 || r.total > TOTAL_LIMIT_REF || r.total % (r.a + r.b) !== 0) fail(tag + ': total ' + r.total + ' does not split in the ratio ' + r.a + ' : ' + r.b + ' within 100');
          const u = r.total / (r.a + r.b), want = (r.a * u) + '-' + (r.b * u);
          if (r.opts[r.ans] !== want) fail(tag + ': the marked option is not ' + want);
          r.opts.forEach((o, oi) => {
            const pr = data.pairOf(o);
            if (pr.length !== 2 || pr.some(v => !Number.isInteger(v) || v < 1)) fail(tag + ': option "' + o + '" is not a pair');
            else if (oi !== r.ans && pr[0] + pr[1] === r.total && sameRatioRef(pr[0], pr[1], r.a, r.b)) fail(tag + ': distractor "' + o + '" is also a correct split');
          });
          if (r.opts.indexOf((r.b * u) + '-' + (r.a * u)) < 0) fail(tag + ': the swapped-shares distractor is missing');
        }
      });

      /* ---- 6. 字典函式真的跑起來：每一句旁白都渲染一次再掃 ---- */
      const strings = [];
      function add(text, lang, where){ strings.push({ text:String(text), lang, where }); }
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang];
        if (!d){ fail('I18N.' + lang + ' missing'); return; }
        data.S1_CASES.forEach(sc => {
          const pl = data.barPlan(sc.a, sc.b);
          add(d.s1chip(sc), lang, 's1chip'); add(d.barLabel(sc.id, 'a', sc.a), lang, 'barLabel'); add(d.barLabel(sc.id, 'b', sc.b), lang, 'barLabel');
          add(d.s1cap(sc, pl), lang, 's1cap'); add(d.s1narr(sc), lang, 's1narr'); add(d.s1calc(sc), lang, 's1calc'); add(d.s1result(sc), lang, 's1result');
          if (d.s1result(sc).indexOf(ratioTextRef(sc.a, sc.b)) < 0) fail(lang + ' s1result(' + sc.id + ') does not print ' + ratioTextRef(sc.a, sc.b));
          if (d.s1narr(sc).indexOf(ratioTextRef(sc.b, sc.a)) < 0) fail(lang + ' s1narr(' + sc.id + ') never shows the reversed ratio, so the order rule is not demonstrated');
          /* 標籤上的數量要和格數一致 */
          if (!new RegExp('(^|\\D)' + sc.a + '(\\D|$)').test(d.barLabel(sc.id, 'a', sc.a)) || !new RegExp('(^|\\D)' + sc.b + '(\\D|$)').test(d.barLabel(sc.id, 'b', sc.b))) fail(lang + ' barLabel(' + sc.id + ') does not print the counts');
          barProblems(lang + ' S1 picture ' + sc.id, pl, sc.a, sc.b, d.barLabel(sc.id, 'a', sc.a), d.barLabel(sc.id, 'b', sc.b)).forEach(fail);
        });
        add(d.s1cap({ id:'paint', a:1, b:1 }, { tooMany:true }), lang, 's1cap-tooMany');
        data.S2_CASES.forEach(pr => {
          add(d.s2chip(pr), lang, 's2chip'); add(d.s2label('a', pr[0]), lang, 's2label'); add(d.s2label('b', pr[1]), lang, 's2label');
          add(d.s2narr(pr), lang, 's2narr'); add(d.s2calc(pr), lang, 's2calc'); add(d.s2result(pr), lang, 's2result');
          const v = valueTextRef(pr[0], pr[1]);
          if (d.s2result(pr).indexOf(v) < 0) fail(lang + ' s2result(' + pr + ') does not print the value ' + v);
          if (d.s2calc(pr).indexOf(pr[0] + ' ÷ ' + pr[1]) < 0) fail(lang + ' s2calc(' + pr + ') does not show first ÷ second');
          barProblems(lang + ' S2 picture ' + pr, data.barPlan(pr[0], pr[1]), pr[0], pr[1], d.s2label('a', pr[0]), d.s2label('b', pr[1])).forEach(fail);
        });
        data.S3_CASES.forEach(pr => {
          const R = data.reduceSteps(pr[0], pr[1]);
          for (let step = 0; step <= R.rows.length; step++){
            add(d.s3step(step, R.rows.length), lang, 's3step'); add(d.s3pair(R, step), lang, 's3pair'); add(d.s3narr(R, step), lang, 's3narr'); add(d.s3calc(R, step), lang, 's3calc'); add(d.s3result(R, step), lang, 's3result');
            const cur = step === 0 ? [R.a, R.b] : [R.rows[step - 1].qa, R.rows[step - 1].qb];
            add(d.s3label('a', cur[0]), lang, 's3label'); add(d.s3label('b', cur[1]), lang, 's3label');
            barProblems(lang + ' S3 picture ' + pr + ' step ' + step, data.barPlan(cur[0], cur[1]), cur[0], cur[1], d.s3label('a', cur[0]), d.s3label('b', cur[1])).forEach(fail);
          }
          add(d.s3chip(pr), lang, 's3chip');
          const fin = d.s3result(R, R.rows.length), s = simplestRef(pr[0], pr[1]);
          if (fin.indexOf(ratioTextRef(s[0], s[1])) < 0) fail(lang + ' s3result(' + pr + ') final does not print ' + ratioTextRef(s[0], s[1]));
          if (d.s3result(R, 0) !== (lang === 'zh' ? '？' : '?')) fail(lang + ' s3result(' + pr + ', 0) already shows a result');
          if (!new RegExp('(^|\\D)' + R.g + '(\\D|$)').test(d.s3narr(R, R.rows.length).replace(/<[^>]+>/g, ''))) fail(lang + ' s3narr(' + pr + ') final never names the GCF ' + R.g);
        });
        data.S4_CASES.forEach(sc => {
          const A = data.scaleGiven(sc), B = data.scaleAnswer(sc);
          add(d.s4chip(sc), lang, 's4chip'); add(d.s4stem(sc), lang, 's4stem'); add(d.s4label(sc.id, 'a', A), lang, 's4label'); add(d.s4label(sc.id, 'b', B), lang, 's4label');
          add(d.s4narr(sc), lang, 's4narr'); add(d.s4calc(sc), lang, 's4calc'); add(d.s4result(sc), lang, 's4result');
          if (!new RegExp('(^|\\D)' + B + '(\\D|$)').test(d.s4result(sc))) fail(lang + ' s4result(' + sc.id + ') does not print the answer ' + B);
          if (new RegExp('(^|\\D)' + B + '(\\D|$)').test(d.s4stem(sc).replace(/<[^>]+>/g, ''))) fail(lang + ' s4stem(' + sc.id + ') prints the answer ' + B);
          if (d.s4narr(sc).indexOf(ratioTextRef(A, B)) < 0) fail(lang + ' s4narr(' + sc.id + ') never writes the equal ratio ' + ratioTextRef(A, B));
          barProblems(lang + ' S4 picture ' + sc.id, data.barPlan(A, B), A, B, d.s4label(sc.id, 'a', A), d.s4label(sc.id, 'b', B)).forEach(fail);
        });
        data.S5_CASES.forEach(sc => {
          const A = data.shareA(sc), B = data.shareB(sc);
          add(d.s5chip(sc), lang, 's5chip'); add(d.s5stem(sc), lang, 's5stem'); add(d.s5label(sc, 'a'), lang, 's5label'); add(d.s5label(sc, 'b'), lang, 's5label');
          add(d.s5narr(sc), lang, 's5narr'); add(d.s5calc(sc), lang, 's5calc'); add(d.s5result(sc), lang, 's5result');
          const res = d.s5result(sc);
          if (!new RegExp('(^|\\D)' + A + '(\\D|$)').test(res) || !new RegExp('(^|\\D)' + B + '(\\D|$)').test(res)) fail(lang + ' s5result(' + sc.id + ') does not print both shares ' + A + ' and ' + B);
          const stemPlain = d.s5stem(sc).replace(/<[^>]+>/g, '');
          [A, B].forEach(v => { if (v !== sc.total && v !== sc.a && v !== sc.b && new RegExp('(^|\\D)' + v + '(\\D|$)').test(stemPlain)) fail(lang + ' s5stem(' + sc.id + ') prints a share ' + v); });
          if (!new RegExp('(^|\\D)' + (sc.a + sc.b) + '(\\D|$)').test(d.s5narr(sc).replace(/<[^>]+>/g, ''))) fail(lang + ' s5narr(' + sc.id + ') never counts the parts ' + (sc.a + sc.b));
          barProblems(lang + ' S5 picture ' + sc.id, data.barPlan(sc.a, sc.b), sc.a, sc.b, d.s5label(sc, 'a'), d.s5label(sc, 'b')).forEach(fail);
        });
        data.ROUNDS.forEach(r => {
          add(d.gPrompt[r.kind](r), lang, 'gPrompt'); add(d.gHint1[r.kind], lang, 'gHint1'); add(d.gHint2[r.kind](r), lang, 'gHint2'); add(d.gCap[r.kind], lang, 'gCap');
          if (data.roundFigure(r)){ add(d.gLabel(r, 'a'), lang, 'gLabel'); add(d.gLabel(r, 'b'), lang, 'gLabel'); }
          r.opts.forEach((o, i) => add(d.gOptText(r, i), lang, 'gOptText'));
          const ans = String(data.roundAnswer(r));
          const ansShown = r.kind === 'shareTotal' ? d.gOptText(r, r.ans) : (r.kind === 'scaleUp' ? String(r.opts[r.ans]) : ans);
          if (d.gHint1[r.kind].indexOf(ansShown) >= 0 || (r.kind === 'scaleUp' && new RegExp('(^|\\D)' + r.opts[r.ans] + '(\\D|$)').test(d.gHint1[r.kind]))) fail(lang + ' gHint1 for ' + r.kind + ' prints the answer');
          const fig = data.roundFigure(r);
          if (fig) barProblems(lang + ' game picture ' + r.kind, fig, r.a, r.b, d.gLabel(r, 'a'), d.gLabel(r, 'b')).forEach(fail);
          /* 遊戲選項印出來之後：比與比值的選項值互不相同；照比例配的選項帶單位 */
          const shown = r.opts.map((o, i) => d.gOptText(r, i));
          if (r.kind !== 'shareTotal'){ const keys = shown.map(optKeyRef); if (new Set(keys).size !== 4) fail(lang + ' game ' + r.kind + ' shows two options with the same value'); }
          if (r.kind === 'scaleUp' && shown.some(s => !parseNumOpt(s) || !parseNumOpt(s).unit)) fail(lang + ' game scaleUp options lack a unit: ' + shown.join(' | '));
        });
        add(d.gWrong(5), lang, 'gWrong'); add(d.gWrong(0), lang, 'gWrong'); add(d.gWin(90), lang, 'gWin');
        ['intro', 'scopeNote', 's1note', 's2note', 's3note', 's4note', 's5note', 'footer', 'next3', 's1lead', 's2lead', 's3lead', 's4lead', 's5lead', 's7lead'].forEach(k => add(d[k], lang, k));
      });
      strings.forEach(s => {
        if (!s.text.trim()) { if (s.where !== 'gCap') fail(s.where + ' rendered an empty string'); return; }
        stringProblems(s.text, s.lang, s.where).forEach(fail);
        arithAll(s.text).problems.forEach(m => fail(s.where + ' (' + s.lang + '): ' + m + ' in "' + s.text.replace(/<[^>]+>/g, '').slice(0, 60) + '"'));
      });
      const NARRATED_COUNT_REF = 498;
      if (NARRATED_COUNT_REF && strings.length !== NARRATED_COUNT_REF) fail('rendered ' + strings.length + ' dictionary strings, the reference pins ' + NARRATED_COUNT_REF);
      const fp = crypto.createHash('sha1').update(strings.map(s => s.where + '|' + s.lang + '|' + s.text).join('\n')).digest('hex').slice(0, 12);
      const NARRATED_FINGERPRINT_REF = 'c77650d67661';
      if (process.env.PRINT_FP) console.log('FINGERPRINT ' + fp + ' COUNT ' + strings.length);
      if (NARRATED_FINGERPRINT_REF !== 'PENDING' && fp !== NARRATED_FINGERPRINT_REF) fail('the rendered dictionary strings changed (fingerprint ' + fp + ', pinned ' + NARRATED_FINGERPRINT_REF + ') — re-read them, then re-pin');

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
            /* 選項的值互不相同（比用交叉相乘比、數用最簡分數＋單位） */
            const keys = q.opts.map(optKeyRef);
            if (new Set(keys).size !== 4) fail(bank + '[' + i + '] ' + lang + ' two options have the same value: ' + q.opts.join(' | '));
            const mixed = mixedShapes(q.opts); if (mixed) fail(bank + '[' + i + '] ' + lang + ' ' + mixed);
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
          if (f.value && valueTextRef(f.pair[0], f.pair[1]) !== f.value) fail('bank fact: value of ' + f.pair + ' is ' + valueTextRef(f.pair[0], f.pair[1]));
          if (f.simplest && !sameList(simplestRef(f.pair[0], f.pair[1]), f.simplest)) fail('bank fact: simplest of ' + f.pair + ' is ' + simplestRef(f.pair[0], f.pair[1]));
          if (f.gcf && gcdRef(f.pair[0], f.pair[1]) !== f.gcf) fail('bank fact: gcf of ' + f.pair + ' is ' + gcdRef(f.pair[0], f.pair[1]));
        }
        if (f.equal && !sameRatioRef(f.equal[0], f.equal[1], f.equal[2], f.equal[3])) fail('bank fact: ' + f.equal + ' should be equal ratios');
        if (f.notEqual && sameRatioRef(f.notEqual[0], f.notEqual[1], f.notEqual[2], f.notEqual[3])) fail('bank fact: ' + f.notEqual + ' should not be equal ratios');
        if (f.scale){ const [c, d, A, B] = f.scale; if (A % c !== 0 || B !== d * (A / c)) fail('bank fact: scaling ' + f.scale + ' is wrong'); }
        if (f.share){ const [T, c, d, A, B] = f.share; const u = T / (c + d); if (!Number.isInteger(u) || A !== c * u || B !== d * u || A + B !== T) fail('bank fact: share ' + f.share + ' is wrong'); }
        if (f.value && f.first){ const [n, dd] = f.value; if (f.first % n !== 0 || f.second !== dd * (f.first / n)) fail('bank fact: value ' + f.value + ' with first ' + f.first + ' gives second ' + dd * (f.first / n)); }
      });
      /* 靜態題的比選項：問「相等」的題剛好一個相等；問「最簡整數比」的題正解互質而且其他選項的值都不同 */
      [['qs', 2, [2, 5]], ['qs', 3, [12, 18]], ['qsAdv', 3, [12, 16]]].forEach(([bank, i, base]) => {
        ['zh', 'en'].forEach(lang => {
          const q = (I18N[lang][bank] || [])[i]; if (!q) return;
          const prs = q.opts.map(parseRatioOpt);
          if (prs.some(p => !p)) { fail(bank + '[' + i + '] ' + lang + ': an option is not a ratio'); return; }
          const eq = prs.filter(p => sameRatioRef(base[0], base[1], p[0], p[1]));
          if (eq.length !== 1) fail(bank + '[' + i + '] ' + lang + ': ' + eq.length + ' options equal ' + base.join(' : '));
          if (!sameRatioRef(base[0], base[1], prs[q.ans][0], prs[q.ans][1])) fail(bank + '[' + i + '] ' + lang + ': the marked option is not equal to ' + base.join(' : '));
          if (i !== 2 && gcdRef(prs[q.ans][0], prs[q.ans][1]) !== 1) fail(bank + '[' + i + '] ' + lang + ': the marked simplest ratio is not simplest');
        });
      });
      /* 解釋（why）也釘一個指紋：題幹與選項逐字釘住之後，解釋是唯一還能改字的地方 —— 改了就重讀一次再重釘（PRINT_FP=1）。 */
      const whyFp = crypto.createHash('sha1').update(['zh', 'en'].map(lang => Object.keys(BANK).map(bank => (I18N[lang][bank] || []).map(q => q.why).join('\n')).join('\n')).join('\n')).digest('hex').slice(0, 12);
      if (process.env.PRINT_FP) console.log('BANK_WHY_FINGERPRINT ' + whyFp);
      if (BANK_WHY_FINGERPRINT_REF !== 'PENDING' && whyFp !== BANK_WHY_FINGERPRINT_REF) fail('the quiz explanations changed (fingerprint ' + whyFp + ', pinned ' + BANK_WHY_FINGERPRINT_REF + ') — re-read them, then re-pin');
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
            keys.forEach(k => { if (typeof dict[lang][k] === 'string'){ text += dict[lang][k] + '\n'; dictStrings[file].push({ text:dict[lang][k], lang, table:false }); stringProblems(dict[lang][k], lang, file + '.' + lang + '.' + k).forEach(fail); arithAll(dict[lang][k]).problems.forEach(m => fail(file + '.' + lang + '.' + k + ': ' + m)); } });
            Object.keys(dict[lang]).forEach(k => { if (Array.isArray(dict[lang][k])) dict[lang][k].forEach((row, ri) => { const cell = Array.isArray(row) ? row.join(' ') : String(row); text += cell + '\n'; dictStrings[file].push({ text:cell, lang, table:true, cells:Array.isArray(row) ? row.map(String) : [String(row)] }); stringProblems(cell, lang, file + '.' + lang + '.' + k + '[' + ri + ']').forEach(fail); (Array.isArray(row) ? row : [row]).forEach(c => arithAll(c).problems.forEach(m => fail(file + '.' + lang + '.' + k + '[' + ri + ']: ' + m))); }); });
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
        if (m) fail(f + '.html writes a decimal ("' + TEXT[f].slice(Math.max(0, m.index - 12), m.index + 12).replace(/\s+/g, ' ') + '") — ratios with decimals are handed to a later lesson');
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
      if (!/teachme-last[\s\S]{0,80}grade-6\/math\/ratio\//.test(src)) fail('index.html does not record teachme-last for grade-6/math/ratio/');

      /* ---- 8b. 四頁 markup（讀者一打開就看到的中文）的排版：中文黏數字、比的冒號、重複標點 ---- */
      ['index', 'reference', 'review', 'parents'].forEach(f => {
        if (RAW[f] === undefined) return;
        const cut = RAW[f].indexOf('<script'); const markup = visibleText(cut > 0 ? RAW[f].slice(0, cut) : RAW[f]).replace(/\s+/g, ' ');
        const glued = markup.match(/.{0,6}(?:\p{Script=Han}\d|\d\p{Script=Han}).{0,6}/u);
        if (glued) fail(f + '.html markup glues Chinese to a digit: "' + glued[0] + '"');
        const colon = markup.match(/\d+[:：]\d+/);
        if (colon) fail(f + '.html markup writes a ratio without spaces around the colon: ' + colon[0]);
        const dbl = markup.match(/。。|，，|！！|？？|；；|：：/);
        if (dbl) fail(f + '.html markup has doubled punctuation "' + dbl[0] + '"');
      });

      /* ---- 9. 產生器清單：把 review.html 的 GENS 真的跑起來比 id；抽樣池逐字釘住；句庫真值表一致 ---- */
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
      why:'the bars would start 20px to the right of where the checker measures them and 18 squares would clip the canvas' },
    { file:'index', via:'index', expect:'a canvas viewBox is',
      find:'<svg class="barfig" id="s1fig" viewBox="0 0 460 130"',
      replace:'<svg class="barfig" id="s1fig" viewBox="0 0 460 120"',
      why:'the bottom bar would be drawn in a shorter coordinate system than it uses' },
    { file:'index', via:'index', expect:'in CSS but the viewBox is',
      find:'.barfig{width:100%;max-width:460px;height:130px;display:block;margin:0 auto}',
      replace:'.barfig{width:100%;max-width:460px;height:160px;display:block;margin:0 auto}',
      why:'the picture would be letterboxed inside a taller box' },

    /* --- 數論函式：兩套實作要一致，壞輸入要 fail closed --- */
    { file:'index', via:'index', expect:'gcd does not fail closed',
      find:'function gcd(a, b){\n    if (!isPosInt(a) || !isPosInt(b)) return null;',
      replace:'function gcd(a, b){\n    if (!isPosInt(a) && !isPosInt(b)) return null;',
      why:'gcd(0, 5) would run the loop on a zero term instead of refusing' },
    { file:'index', via:'index', expect:'ratioValue(1,2) is',
      find:'function ratioValue(a, b){ var s = simplest(a, b); return s === null ? null : { n:s[0], d:s[1] }; }',
      replace:'function ratioValue(a, b){ var s = simplest(a, b); return s === null ? null : { n:s[1], d:s[0] }; }',
      why:'every ratio value on the page would be upside down (second ÷ first)' },
    { file:'index', via:'index', expect:'sameRatio(1,2,2,4) is false',
      find:'return a * d === b * c; }',
      replace:'return a * c === b * d; }',
      why:'the equal-ratio test would multiply the wrong pairs' },
    { file:'index', via:'index', expect:'commonPrime is wrong on a spot check',
      find:'for (var p = 2; p <= m; p++) if (isPrime(p) && a % p === 0 && b % p === 0) return p;',
      replace:'for (var p = 3; p <= m; p++) if (isPrime(p) && a % p === 0 && b % p === 0) return p;',
      why:'2 would never be found, so 12 : 18 would stop at 4 : 6 and call it simplest' },
    { file:'index', via:'index', expect:'the divisors multiply to',
      find:'rows.push({ p:p, a:x, b:y, qa:x / p, qb:y / p }); x = x / p; y = y / p; g = g * p; }',
      replace:'rows.push({ p:p, a:x, b:y, qa:x / p, qb:y / p }); x = x / p; y = y / p; g = g + p; }',
      why:'the "divide by the GCF in one step" sentence would name a wrong GCF' },

    /* --- 圖：從畫出來的東西量回來 --- */
    { file:'index', via:'index', expect:'tooMany flag is false',
      find:'var tooMany = !isPosInt(a) || !isPosInt(b) || a > MAX_UNITS || b > MAX_UNITS;',
      replace:'var tooMany = !isPosInt(a) || !isPosInt(b);',
      why:'a 30-square bar would be drawn straight off the right edge of the canvas' },
    { file:'index', via:'index', expect:'equal spacing from the left',
      find:"cells.push({ row:'a', x:BAR_X0 + i * (U + UGAP), y:ROW_A_Y, w:U, h:U });",
      replace:"cells.push({ row:'a', x:BAR_X0 + i * U, y:ROW_A_Y, w:U, h:U });",
      why:'the top bar squares would touch each other while the bottom bar keeps its gaps' },
    { file:'index', via:'index', expect:'S1_CASES is',
      find:"{ id:'snack', a:4, b:6 }     /* 餅乾",
      replace:"{ id:'snack', a:2, b:3 }     /* 餅乾",
      why:'the only not-yet-simplest example (which feeds example 3) would silently disappear' },
    { file:'index', via:'index', expect:'S4_CASES is',
      find:"{ id:'paint',  a:2, b:3, k:3 },   /* 藍 6 杯 → 白 9 杯 */",
      replace:"{ id:'paint',  a:2, b:3, k:2 },   /* 藍 6 杯 → 白 9 杯 */",
      why:'the worked example would change numbers while the note below it still says 6 cups and 9 cups' },
    { file:'index', via:'index', expect:'S5_CASES is',
      find:"{ id:'sweets', a:3, b:2, total:20 },",
      replace:"{ id:'sweets', a:3, b:2, total:21 },",
      why:'21 sweets do not split into 5 equal parts, and the pinned example would drift from the parents page' },

    /* --- 小遊戲 --- */
    { file:'index', via:'index', expect:'roundAnswerIndex()=1 but ans=0',
      find:"{ kind:'ratioValue', a:12, b:8, opts:['2/3', '3/2', '4', '20'], ans:1 },",
      replace:"{ kind:'ratioValue', a:12, b:8, opts:['2/3', '3/2', '4', '20'], ans:0 },",
      why:'the declared answer slot would disagree with the computed value' },
    { file:'index', via:'index', expect:'options equal 2 : 3',
      find:"opts:['3 : 4', '4 : 5', '6 : 9', '3 : 2'], ans:2 }",
      replace:"opts:['3 : 4', '4 : 6', '6 : 9', '3 : 2'], ans:2 }",
      why:'two options would equal the base ratio while the slip promises exactly one' },
    { file:'index', via:'index', expect:'gHint1 for scaleUp prints the answer',
      find:"scaleUp:'先算藍色變成幾倍（8 是 2 的幾倍），白色也乘同樣的倍數。',",
      replace:"scaleUp:'先算藍色變成幾倍（8 是 2 的幾倍），白色也乘同樣的倍數，答案是 12 杯。',",
      why:'the first-level hint would give the answer away' },

    /* --- 題庫神諭 --- */
    { file:'index', via:'index', expect:'qs[1] zh marked option "3/2"',
      find:"opts:['3/2', '2/3', '2', '10'], ans:1,\n          why:'比值是前項 ÷ 後項：4 ÷ 6 ＝ 2/3",
      replace:"opts:['3/2', '2/3', '2', '10'], ans:0,\n          why:'比值是前項 ÷ 後項：4 ÷ 6 ＝ 2/3",
      why:'the answer key would point at the upside-down value' },
    { file:'index', via:'index', expect:'qs[3] zh stem is not the pinned sentence',
      find:"stem:'<strong>12 : 18</strong> 的最簡整數比是多少？',",
      replace:"stem:'<strong>12 : 16</strong> 的最簡整數比是多少？',",
      why:'the question would ask about a different ratio while keeping the old answer' },
    { file:'index', via:'index', expect:'fraction/division claim is wrong',
      find:"why:'比值是前項 ÷ 後項：4 ÷ 6 ＝ 2/3（約成最簡分數）。",
      replace:"why:'比值是前項 ÷ 後項：4 ÷ 6 ＝ 3/2（約成最簡分數）。",
      why:'an explanation would teach a wrong value' },
    { file:'index', via:'index', expect:'ratio claim is wrong',
      find:"3 × 4 ＝ 12 杯（2 : 3 ＝ 8 : 12）。",
      replace:"3 × 4 ＝ 12 杯（2 : 3 ＝ 8 : 10）。",
      why:'an explanation would write a false equal-ratio' },
    { file:'index', via:'index', expect:'the quiz explanations changed',
      find:"why:'藍色先說、寫在前面，藍 : 白 就是 3 : 5。",
      replace:"why:'藍色先講、寫在前面，藍 : 白 就是 3 : 5。",
      why:'an explanation could be reworded without anyone re-reading it' },

    /* --- 渲染出來的字串 --- */
    { file:'index', via:'index', expect:'glues Chinese to a digit',
      find:"return '第 ' + step + ' 步：前項和後項同除以 ' + row.p + '，'",
      replace:"return '第' + step + ' 步：前項和後項同除以 ' + row.p + '，'",
      why:'Chinese and a digit would run together on screen' },
    { file:'index', via:'index', expect:'the rendered dictionary strings changed',
      find:"s2label:function(side, n){ return (side === 'a' ? '前項 ' : '後項 ') + n; },",
      replace:"s2label:function(side, n){ return (side === 'a' ? '前項是 ' : '後項是 ') + n; },",
      why:'a bar label could be reworded without anyone re-reading it (count unchanged, fingerprint changed)' },
    { file:'index', via:'index', expect:'states the misconception',
      find:'<p class="lead" data-i18n="s2lead">把一個比<strong>算成一個數</strong>',
      replace:'<p class="lead" data-i18n="s2lead">比值一定比 1 小。把一個比<strong>算成一個數</strong>',
      why:'a false rule would be stated as prose in the lesson' },
    { file:'index', via:'index', expect:'writes a mixed number',
      find:"表示前項是後項的 3/2 倍。選一個比看看。'",
      replace:"表示前項是後項的 3/2 倍（1 又 1/2 倍）。選一個比看看。'",
      why:'a mixed number would sneak in although the lesson writes values as improper fractions' },
    { file:'index', via:'index', expect:'writes a power',
      find:"按比分配先算<strong>一共幾份</strong>。\n  </footer>",
      replace:"按比分配先算<strong>一共幾份</strong>（2² ＝ 4）。\n  </footer>",
      why:'a power would sneak into the footer' },
    { file:'index', via:'index', expect:'writes a decimal',
      find:'5 : 5 has value 1 (the same).',
      replace:'5 : 5 has value 1.0 (the same).',
      why:'a decimal would appear although decimal ratios belong to a later lesson' },
    { file:'index', via:'index', expect:'mentions "成正比" without saying where it belongs',
      find:'<strong>成正比</strong>、<strong>速率</strong>不在這一課。這一課的前項和後項都是 <strong>1 到 30</strong> 的整數；同乘或同除的數也是整數，同除時兩項都要除得盡；總量在 <strong>100 以內</strong>而且剛好分得完。</p>',
      replace:'<strong>成正比</strong>、<strong>速率</strong>留給以後。這一課的前項和後項都是 <strong>1 到 30</strong> 的整數；同乘或同除的數也是整數，同除時兩項都要除得盡；總量在 <strong>100 以內</strong>而且剛好分得完。</p>',
      why:'direct proportion would be mentioned without handing it off' },
    { file:'index', via:'index', expect:'draws into the same target more than once',
      find:"    drawBars(s1fig, pl, d.barLabel(sc.id, 'a', sc.a), d.barLabel(sc.id, 'b', sc.b));",
      replace:"    drawBars(s1fig, pl, d.barLabel(sc.id, 'a', sc.a), d.barLabel(sc.id, 'b', sc.b)); drawBars(s1fig, barPlan(2, 3), '', '');",
      why:'the pinned call would survive while a second call painted a different plan over it' },
    { file:'index', via:'index', expect:'no longer wires the drawing',
      find:"    drawBars(s1fig, pl, d.barLabel(sc.id, 'a', sc.a), d.barLabel(sc.id, 'b', sc.b));",
      replace:"    /* drawBars(s1fig, pl, d.barLabel(sc.id, 'a', sc.a), d.barLabel(sc.id, 'b', sc.b)); */",
      why:'the pinned line would survive inside a comment while the figure went blank' },
    { file:'index', via:'index', expect:'does not record teachme-last',
      find:"{p:'grade-6/math/ratio/', zh:",
      replace:"{p:'grade-6/math/ratios/', zh:",
      why:'the home page would resume into a dead link' },
    { file:'index', via:'index', expect:'says "前項 ÷ 後項" 16 time(s)',
      find:'<h2 data-i18n="s2h2">比值：前項 ÷ 後項</h2>',
      replace:'<h2 data-i18n="s2h2">比值：前項除以後項</h2>',
      why:'the definition of the value would drift in one heading' },

    /* --- 第一輪 codex 審查之後補的守衛 --- */
    { file:'index', via:'index', expect:'states the misconception',
      find:'<p class="lead" data-i18n="s3lead">藍 2 杯配白 3 杯',
      replace:'<p class="lead" data-i18n="s3lead">比值<strong>一定</strong>比 1 小。藍 2 杯配白 3 杯',
      why:'a misconception split by an inline tag would slip past a source-literal scan' },
    { file:'index', via:'index', expect:'markup glues Chinese to a digit',
      find:'按比分配先算<strong>一共幾份</strong>。\n  </footer>',
      replace:'按比分配先算<strong>一共幾份</strong>（共5份）。\n  </footer>',
      why:'markup nobody re-reads could glue a digit to a character' },
    { file:'index', via:'index', expect:'options are not all the same shape',
      find:"opts:['3/2', '2/3', '2', '10'], ans:1,\n          why:'比值是前項 ÷ 後項：4 ÷ 6 ＝ 2/3（約成最簡分數）。",
      replace:"opts:['3/2', '2/3', '2', '10 : 1'], ans:1,\n          why:'比值是前項 ÷ 後項：4 ÷ 6 ＝ 2/3（約成最簡分數）。",
      why:'a ratio-shaped option among numbers would dodge the value-duplicate check' },
    { file:'index', via:'index', expect:'uses an amount above 100',
      find:"{ kind:'scaleUp', a:2, b:3, k:4, opts:[9, 10, 16, 12], ans:3 },",
      replace:"{ kind:'scaleUp', a:2, b:3, k:60, opts:[9, 10, 16, 12], ans:3 },",
      why:'the slip would print 120 cups, outside the lesson\'s 100' },
    { file:'index', via:'index', expect:'"s1fig" appears 5 time(s)',
      find:"    drawBars(s1fig, pl, d.barLabel(sc.id, 'a', sc.a), d.barLabel(sc.id, 'b', sc.b));",
      replace:"    drawBars(s1fig, pl, d.barLabel(sc.id, 'a', sc.a), d.barLabel(sc.id, 'b', sc.b)); s1fig.appendChild(svgEl('rect', { x:0, y:0, width:10, height:10 }));",
      why:'an extra square appended past the renderer would change the ratio the child sees while every measured plan stays valid' },
    { file:'review', via:'review', expect:'singular subject with a plural verb',
      find:"' has ' + d.c + ' part' + (d.c === 1 ? '' : 's') + ': ' + d.c + ' × ' + d.u + ' = ' + A + '. '",
      replace:"' has ' + d.c + ' part' + (d.c === 1 ? '' : 's') + ' are: ' + d.c + ' × ' + d.u + ' = ' + A + '. '",
      why:'"has 1 part are" would be printed whenever the first term is 1' },

    { file:'index', via:'index', expect:'qty(en) singular forms are wrong',
      find:"    var SINGULAR = { boys:'boy', girls:'girl', cookies:'cookie', sweets:'sweet' };\n    return n === 1 ? '1 ' + (SINGULAR[name] || name) : n + ' ' + name;",
      replace:"    return n === 1 ? '1 ' + name.replace(/s$/, '').replace(/ie$/, 'y') : n + ' ' + name;",
      why:'"1 cooky" would be printed (the first version had exactly this bug)' },
    { file:'index', via:'index', expect:'states the misconception',
      find:'<p class="lead" data-i18n="s4lead">知道比、也知道其中',
      replace:'<p class="lead" data-i18n="s4lead">比值<span>一定</span>比 1 小。知道比、也知道其中',
      why:'a misconception split by a bare span would slip past a scan that pads span boundaries' },

    /* --- 速查卡與家長頁 --- */
    { file:'reference', via:'index', expect:'outside the statement cell of a row marked wrong',
      find:"['比值一定比 1 小', '<strong>錯</strong>', '5 : 3 的比值是 5/3，比 1 大'],",
      replace:"['比值一定比 1 小', '<strong>對</strong>', '5 : 3 的比值是 5/3，比 1 大'],",
      why:'the cheat sheet would mark a misconception as true' },
    { file:'reference', via:'index', expect:'reference.html says "前項 ÷ 後項" 10 time(s)',
      find:'<li><span class="sn">2</span><span data-i18n="d2"><strong>比值 ＝ 前項 ÷ 後項</strong>',
      replace:'<li><span class="sn">2</span><span data-i18n="d2"><strong>比值 ＝ 前項除以後項</strong>',
      why:'the cheat sheet would stop using the lesson\'s wording for the value' },
    { file:'reference', via:'index', expect:'fraction/division claim is wrong',
      find:"['比值是前項除以後項', '<strong>對</strong>', '6 : 4 的比值是 6 ÷ 4 ＝ 3/2'],",
      replace:"['比值是前項除以後項', '<strong>對</strong>', '6 : 4 的比值是 6 ÷ 4 ＝ 2/3'],",
      why:'a table example would teach a wrong value' },
    { file:'parents', via:'index', expect:'mentions "百分率" without saying where it belongs',
      find:'是五年級百分率那一課的事。第二，大人常說「照比例就是一起加」：藍 2 白 3 變成藍 6，白就「也加 4」變成 7。比要不變只能<strong>乘</strong>：6 是 2 的 3 倍，白也要 3 倍，是 9。</p>',
      replace:'是百分率那一課的事。第二，大人常說「照比例就是一起加」：藍 2 白 3 變成藍 6，白就「也加 4」變成 7。比要不變只能<strong>乘</strong>：6 是 2 的 3 倍，白也要 3 倍，是 9。</p>',
      why:'percentages would be mentioned without handing them to grade 5' },
    { file:'parents', via:'index', expect:'parents.html markup states the misconception',
      find:'「所以是 6 ÷ 4 ＝ 3/2。比值比 1 大沒有關係，它的意思是前項是後項的 1 倍半。」</td>',
      replace:'「所以是 6 ÷ 4 ＝ 3/2。比值是小的數除以大的數，比值比 1 大沒有關係，它的意思是前項是後項的 1 倍半。」</td>',
      why:'a misconception would be stated as fact in the parents page' },

    /* --- review.html：設定檔從 index 那一側看的 --- */
    { file:'review', via:'index', expect:'no longer declares the generator "unitRate"',
      find:"{ id:'unitRate', cat:'value',",
      replace:"{ id:'unitRate2', cat:'value',",
      why:'a generator could be renamed or dropped and its invariants would silently stop running' },
    { file:'review', via:'index', expect:'no longer contains the sampling line',
      find:'var POOL_BASE7 = POOL_BASE.filter(function(pr){ return pr[0] <= 7 && pr[1] <= 7; });',
      replace:'var POOL_BASE7 = POOL_BASE.filter(function(pr){ return pr[0] <= 8 && pr[1] <= 8; });',
      why:'ratios multiplied by 4 could leave the 30 limit' },
    { file:'review', via:'index', expect:'is not the pinned false sentence',
      find:"sameAdd:          { truth:false, zh:'前項和後項同加一個數，比值不變',",
      replace:"sameAdd:          { truth:true, zh:'前項和後項同加一個數，比值不變',",
      why:'"adding the same number keeps the value" would become an accepted answer' },

    /* --- review.html：simgen 那一側 --- */
    { file:'review', via:'review', expect:'the rendered stem is not the rebuilt sentence',
      find:"stem: lang === 'zh' ? '<strong>' + ratioText(d.a, d.b) + '</strong> 的比值是多少？'",
      replace:"stem: lang === 'zh' ? '<strong>' + ratioText(d.a, d.b) + '</strong> 的比值是？'",
      why:'a stem could be reworded without the oracle noticing' },
    { file:'review', via:'review', expect:'options are not equal to the base',
      find:'var equalOnes = ks.map(function(k){ return ratioText(c * k, dd * k); });',
      replace:'var equalOnes = ks.map(function(k){ return ratioText(c * k, dd * k + 1); });',
      why:'the three "equal" options of the reverse question would all be unequal, so the slip would promise exactly one and offer four' },
    { file:'review', via:'review', expect:'copies a number the stem prints',
      find:'var o = intOpts(A, [B, T % 2 === 0 ? T / 2 : null, u, (c + 1) * u], [T, c, dd], TOTAL_LIMIT);',
      replace:'var o = intOpts(A, [B, T % 2 === 0 ? T / 2 : null, u, (c + 1) * u], [], TOTAL_LIMIT);',
      why:'a distractor could repeat the total or a term printed in the stem' },
    { file:'review', via:'review', expect:'exceeds 100',
      find:'uMax = Math.min(12, Math.floor(TOTAL_LIMIT / a)), u = 3 + rand(uMax - 2), T = a * u;',
      replace:'u = 3 + rand(10), T = a * u;',
      why:'9 pens at 12 dollars would print a total above the lesson\'s 100' },
    { file:'review', via:'review', expect:'is 1 or prime, the pool promises a composite gcf',
      find:'var pool = POOL_NONSIMPLE.filter(function(pr){ return !isPrime(gcd(pr[0], pr[1])); });',
      replace:'var pool = POOL_NONSIMPLE;',
      why:'the "not finished" distractor would vanish whenever the GCF is prime' },
    { file:'review', via:'review', expect:'the ratio-value distractor',
      find:'var wrongs = pickWrongs(right, [valueText(a, b), valueText(b, a + b), valueText(b, a)], fracFallbacks(s[0], s[1]),',
      replace:'var wrongs = pickWrongs(right, [valueText(b, a + b), valueText(b, a)], fracFallbacks(s[0], s[1]),',
      why:'the confusion this lesson warns about (value vs fraction of the whole) would vanish from the question' },
    { file:'review', via:'review', expect:'is not one of the pinned sentences',
      find:"valueBelowOne:    { truth:false, zh:'比值一定比 1 小',",
      replace:"valueBelowOne:    { truth:false, zh:'比值不一定比 1 小',",
      why:'a "false" sentence could be reworded into a true one and the child would see two correct options' },
    { file:'review', via:'review', expect:'opts[ans] != correct',
      find:"function unit(n){ return qty(lang, d.id, 'b', n); }",
      replace:"function unit(n){ return String(n); }",
      why:'the scaling answers would lose their units' },
    { file:'review', via:'review', expect:'the swapped-order distractor is missing',
      find:'var wrongs = pickWrongs(right, [ratioText(s, f), ratioText(f, f + s), ratioText(f + s, f)], ratioFallbacks(f, s), []);',
      replace:'var wrongs = pickWrongs(right, [ratioText(f, f + s), ratioText(f + s, f)], ratioFallbacks(f, s), []);',
      why:'the order misconception would vanish from the reading question' }
  ],

  SIBLING_RULES, FORBIDDEN, HANDOFF, GEN_IDS, RENDER_PINS, REVIEW_PINS, BANK, BANK_FACTS, visibleText, readerText,
  gcdRef, simplestRef, valueTextRef, sameRatioRef, barProblems, stepsProblems, arithAll, CLAIM_PROBES, stemRef
};
