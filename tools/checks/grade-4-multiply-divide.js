/* grade-4/math/multiply-divide —— 乘除升級站
 * （三位數 × 二位數的直式；除數是二位數的直式除法：試商與調商）
 *
 * 這一課全部是整數運算，所以「數值精確」不是風險。真正的風險是
 * **演算法的中間狀態**：試了哪些商、為什麼被判太大／太小、哪一位帶下來、
 * 商的那一位有沒有寫 0 —— 那些正是畫面上要講的話。
 *
 * 這份設定檔的第二套實作**故意走另外一條路**：
 *   - 乘法：不做「兩排再相加」，而是把兩個數的數字陣列做**卷積**
 *     （每一對數字相乘落在 i+j 那一格），最後再一次進位正規化。
 *   - 除法：不試商也不調商，而是**一直減到不能再減**（重複減法計數）。
 *   - 四捨五入到十位：不算 (n + 5) / 10，而是**看個位那個數字**。
 * 三條路都和頁面用的算法不一樣，所以拿它們對答案不是「自己比自己」。
 *
 * 這一課特有的守門條件（都是前幾輪的教訓）：
 *   ① **'big'（乘不下去）那一步的餘數是負的，一律不可以出現在畫面上。**
 *      grade-4/decimal 真的印出過「剩下 -1」。設定檔把每一句旁白**渲染出來**
 *      再掃一次負號、`undefined`、中文緊貼數字、英文的 1。
 *   ② **「調商可能要調不只一次」是課程明講的規則**，所以要證明它在定義域裡
 *      真的會發生（往上調、往下調、調兩次以上、猜出來超過 9、商那一位是 0
 *      各至少一個實例），不然那幾句話只是文案。
 *   ③ **題幹要驗「問的是什麼」**：mulRow2 只問「第二排是多少」的話，
 *      「寫下來的那個數」也是正解，兩個選項都對（§六之二）。ASK 表釘住
 *      「代表的值」「第一次」「裝滿」「至少」這幾個決定唯一性的字。
 */

const fs = require('fs');
const path = require('path');

/* ================= 第二套實作 ================= */

function digitsRef(n){
  if (!(Number.isInteger(n) && n >= 0)) return null;
  return String(n).split('').map(Number);
}

/* 四捨五入到十位 —— 看個位那個數字，不做 (n + 5) / 10。 */
function roundTenRef(n){
  const ds = digitsRef(n);
  if (!ds) return null;
  const ones = ds[ds.length - 1];
  const tensPart = n - ones;
  return ones >= 5 ? tensPart + 10 : tensPart;
}

/* 乘法：數字陣列的卷積 ＋ 一次進位正規化。
   和頁面的「兩排再相加」是兩條不同的路。 */
function mulRef(a, b){
  const A = digitsRef(a), B = digitsRef(b);
  if (!A || !B) return null;
  const acc = new Array(A.length + B.length).fill(0);
  for (let i = 0; i < A.length; i++){
    for (let j = 0; j < B.length; j++){
      acc[i + j + 1] += A[i] * B[j];
    }
  }
  for (let k = acc.length - 1; k > 0; k--){
    acc[k - 1] += Math.floor(acc[k] / 10);
    acc[k] = acc[k] % 10;
  }
  return Number(acc.join('').replace(/^0+(?=\d)/, ''));
}

/* 一位的商：一直減到不能再減（重複減法），完全不試商。
   ⚠️ 回傳 null 表示商會超過 9 —— 那是呼叫端的參數錯了，要大聲壞掉。 */
function quotDigitRef(cur, d){
  if (!(Number.isInteger(cur) && Number.isInteger(d) && d > 0 && cur >= 0)) return null;
  let left = cur, q = 0;
  while (left >= d){ left -= d; q++; if (q > 20) return null; }
  if (q > 9) return null;
  return { q:q, rem:left, prod:cur - left };
}

/* 商從哪一位開始寫：從最左邊一位一位加進來，第一次 ≥ 除數就停。 */
function startRef(N, d){
  const ds = digitsRef(N);
  if (!ds) return null;
  let cur = 0;
  for (let i = 0; i < ds.length; i++){
    cur = cur * 10 + ds[i];
    if (cur >= d) return { startCol:i, qLen:ds.length - i, cur:cur, take:i + 1 };
  }
  return { startCol:-1, qLen:0, cur:cur, take:ds.length };
}

/* 整個直式除法，每一輪都用重複減法算商。 */
function ldRef(N, d){
  const ds = digitsRef(N);
  if (!ds) return null;
  const qDigits = [], rounds = [];
  let cur = 0, started = false;
  for (let i = 0; i < ds.length; i++){
    cur = cur * 10 + ds[i];
    if (!started && cur < d) continue;
    started = true;
    const r = quotDigitRef(cur, d);
    if (!r) return null;
    rounds.push({ col:i, cur:cur, q:r.q, prod:r.prod, rem:r.rem });
    qDigits.push(r.q);
    cur = r.rem;
  }
  if (!qDigits.length) return null;
  return { q:Number(qDigits.join('')), rem:cur, qDigits:qDigits, rounds:rounds };
}

/* ---------- INVARIANTS 共用的參數守門 ---------- */
function mulInv(d, who){
  if (!d) return who + ': make() returned nothing';
  if (!Number.isInteger(d.a) || !Number.isInteger(d.b)) return who + ': a or b is not an integer';
  if (!(d.a >= 100 && d.a <= 999)) return who + ': the multiplicand must be a three-digit number, got ' + d.a;
  if (!(d.b >= 10 && d.b <= 99)) return who + ': the multiplier must be a two-digit number, got ' + d.b;
  if (d.b % 10 === 0) return who + ': the multiplier ends in 0, which all four pages promise never happens';
  if (mulRef(d.a, d.b) >= 100000) return who + ': the product leaves the lesson range';
  return null;
}
function divInv(d, who){
  if (!d) return who + ': make() returned nothing';
  if (!Number.isInteger(d.N) || !Number.isInteger(d.d)) return who + ': N or d is not an integer';
  if (!(d.N >= 100 && d.N <= 999)) return who + ': the dividend must be a three-digit number, got ' + d.N;
  if (!(d.d >= 11 && d.d <= 99)) return who + ': the divisor must be a two-digit number above 10, got ' + d.d;
  const r = ldRef(d.N, d.d);
  if (!r) return who + ': the division does not resolve';
  if (!(r.rem >= 0 && r.rem < d.d)) return who + ': the remainder is not smaller than the divisor';
  if (r.qDigits[0] === 0) return who + ': the leading quotient digit is 0';
  return null;
}
function roundInv(d, who){
  if (!d) return who + ': make() returned nothing';
  if (!Number.isInteger(d.cur) || !Number.isInteger(d.d)) return who + ': cur or d is not an integer';
  if (!(d.d >= 11 && d.d <= 99)) return who + ': the divisor must be a two-digit number above 10, got ' + d.d;
  /* ⚠️ 這一條是整堂課的前提：cur < 10 × d 才保證商是一位數。 */
  if (!(d.cur >= d.d && d.cur < 10 * d.d))
    return who + ': the number being shared out (' + d.cur + ') must sit between the divisor and ten times it, or the quotient digit could exceed 9';
  return null;
}

/* ================= 兩本字典的文字（刻意重抄一份） ================= */
/* 拿頁面自己的字典比對等於自己比字典；這裡逐字重抄，
   任何一邊改了措辭都會被抓到。 */
const PHRASE = {
  zh:{ big:'太大，要減 1', small:'太小，要加 1', ok:'剛好',
       cannotTell:'沒辦法判斷', unknown:'沒辦法知道' },
  en:{ big:'Too big — take 1 off', small:'Too small — add 1', ok:'Just right',
       cannotTell:'There is no way to judge it', unknown:'There is no way to tell' }
};

/* 英文的單複數只在「1」上壞掉，而且沒有任何數值檢查看得到。
   ⚠️ 名詞清單要寬，而且要 case-insensitive。 */
const PLURAL_RE = /\b1 (lots|digits|times|shares|adjustments|boxes|bottles|sweets|stickers|eggs|bags|packets|coaches|boats|cable cars)\b/i;
const SINGULAR_RE = /\b([2-9]|\d\d+) (lot|digit|time|share|adjustment|box|bottle|sweet|sticker|egg|bag|packet|coach|boat|cable car)\b/;

/* 產生器清單。刪掉或改名一整支，它那一組不變式、expectedCorrect 與 renderCheck
   會一起靜靜消失 —— data.check 會去讀 review.html 比對這張表。 */
const GEN_IDS = ['mulProduct', 'mulRow1', 'mulRow2', 'mulWord',
                 'qLen', 'tryFirst', 'tryVerdict', 'quotDigit',
                 'divFull', 'divWord', 'needOneMore', 'verifyBack'];

/* 題幹「問的是什麼」。只驗數字的話，把 mulRow2 的題幹改成問「第二排是多少」，
   正解不動，所有數值檢查都還是綠的 —— 可是那時候「324」也是一條正確答案。 */
const ASK = {
  mulProduct:  { zh:{ must:['×', '＝ ？'], never:['第二排', '第一排', '÷'] },
                 en:{ must:['×', '= ?'], never:['second row', 'first row', '÷'] } },
  mulRow1:     { zh:{ must:['第一排'], never:['第二排代表的值'] },
                 en:{ must:['first row'], never:['what value'] } },
  mulRow2:     { zh:{ must:['第二排代表的值'], never:['第一排'] },
                 en:{ must:['value', 'second row'], never:['first row'] } },
  mulWord:     { zh:{ must:['找回'], never:['÷'] },
                 en:{ must:['change'], never:['÷'] } },
  qLen:        { zh:{ must:['商是幾位數'], never:['試哪一個', '餘'] },
                 en:{ must:['How many digits'], never:['try', 'remainder'] } },
  tryFirst:    { zh:{ must:['第一次', '哪一個數字'], never:['商是幾位數'] },
                 en:{ must:['first', 'which digit'], never:['How many digits'] } },
  tryVerdict:  { zh:{ must:['這個商怎麼樣'], never:['商是幾位數'] },
                 en:{ must:['What about that digit'], never:['How many digits'] } },
  quotDigit:   { zh:{ must:['可以分出幾份'], never:['商是幾位數'] },
                 en:{ must:['How many shares'], never:['How many digits'] } },
  divFull:     { zh:{ must:['÷', '＝ ？'], never:['×', '幾位數'] },
                 en:{ must:['÷', '= ?'], never:['×', 'How many digits'] } },
  divWord:     { zh:{ must:['裝滿'], never:['至少'] },
                 en:{ must:['filled'], never:['at least'] } },
  needOneMore: { zh:{ must:['至少'], never:['裝滿'] },
                 en:{ must:['at least'], never:['filled'] } },
  verifyBack:  { zh:{ must:['被除數是多少'], never:['餘數是多少'] },
                 en:{ must:['What was the dividend'], never:['what is the remainder'] } }
};

/* 解釋一定要出現的關鍵句 —— 只驗數字有沒有出現的話，
   把「往左移一格」改成「不用移」，每一個數字都還在。 */
const WHY_MUST = {
  mulProduct:  { zh:['第二排一定要往左移一格'], en:['must shift one column left'] },
  mulRow1:     { zh:['個位'], en:['ones'] },
  mulRow2:     { zh:['往左移一格', '大十倍'], en:['shift it one column left', 'ten times as much'] },
  mulWord:     { zh:['問的是找回多少，不是總價'], en:['asks for the change, not the total'] },
  qLen:        { zh:['商從第一次夠除的那一位開始寫'], en:['starts at the first place where it will go'] },
  tryFirst:    { zh:['四捨五入到十位', '調商之後'], en:['rounded to the nearest ten', 'after adjusting'] },
  tryVerdict:  { zh:['檢查', '兩件事'], en:['Check', 'two things'] },
  quotDigit:   { zh:['小'], en:['smaller than'] },
  divFull:     { zh:['驗算', '餘數一定比除數小'], en:['Check', 'remainder is always smaller than the divisor'] },
  divWord:     { zh:['餘數不算一'], en:['the remainder does not count as one'] },
  /* ⚠️ 餘數是 1 的時候句子是 "still needs a seat"（單數動詞），
     所以關鍵字只能釘到 'still need'，兩種寫法都涵蓋得到。 */
  needOneMore: { zh:['也要搭車', '商 ＋ 1'], en:['still need', 'quotient + 1'] },
  verifyBack:  { zh:['被除數 ＝ 除數 × 商 ＋ 餘數', '別忘了加餘數'],
                 en:['dividend = divisor × quotient + remainder', 'Do not forget to add the remainder'] }
};

/* 四頁必須用同一句話講同一條規則。min 是剝掉註解之後實際出現的次數 ——
   中文字串在有字典的頁面上一定有兩份（markup 的 fallback ＋ 字典），
   所以比的是「出現幾次」，只改其中一份也要被抓到。 */
const SIBLING_RULES = [
  { file:'index', text:'往左移一格', min:18, why:'is the whole rule for the second row' },
  { file:'reference', text:'往左移一格', min:12, why:'is the whole rule for the second row' },
  { file:'review', text:'往左移一格', min:5, why:'is the whole rule for the second row' },
  { file:'parents', text:'往左移一格', min:6, why:'is the whole rule for the second row' },

  { file:'index', text:'四捨五入到十位', min:13, why:'is how the trial quotient is produced' },
  { file:'reference', text:'四捨五入到十位', min:7, why:'is how the trial quotient is produced' },
  { file:'review', text:'四捨五入到十位', min:4, why:'is how the trial quotient is produced' },
  { file:'parents', text:'四捨五入到十位', min:4, why:'is how the trial quotient is produced' },

  { file:'index', text:'餘數要比除數小', min:2, why:'is half of the two-part check' },
  { file:'reference', text:'餘數要比除數小', min:2, why:'is half of the two-part check' },
  { file:'parents', text:'餘數要比除數小', min:2, why:'is half of the two-part check' },

  { file:'index', text:'調不只一次', min:2, why:'stops a child reading one wrong guess as failure' },
  { file:'reference', text:'調不只一次', min:2, why:'stops a child reading one wrong guess as failure' },

  { file:'index', text:'商那一位要寫 0', min:2, why:'is the zero-in-the-quotient rule' },
  { file:'reference', text:'商那一位要寫 0', min:2, why:'is the zero-in-the-quotient rule' },
  { file:'parents', text:'商那一位要寫 0', min:2, why:'is the zero-in-the-quotient rule' },

  { file:'index', text:'被除數 ＝ 除數 × 商 ＋ 餘數', min:2, why:'is the check inherited from grade 3' },
  { file:'reference', text:'被除數 ＝ 除數 × 商 ＋ 餘數', min:2, why:'is the check inherited from grade 3' },

  { file:'index', text:'個位不是 0', min:2, why:'is the scope boundary the lesson promises' },
  { file:'reference', text:'個位不是 0', min:2, why:'is the scope boundary the lesson promises' },
  { file:'parents', text:'個位不是 0', min:2, why:'is the scope boundary the lesson promises' },

  { file:'index', text:'不把兩個步驟併成一個算式', min:2, why:'is the scope boundary against mixed operations' },
  { file:'reference', text:'不把兩個步驟併成一個算式', min:2, why:'is the scope boundary against mixed operations' },
  { file:'parents', text:'不把兩個步驟併成一個算式', min:2, why:'is the scope boundary against mixed operations' },
];

/* 題庫的神諭。每一列記下「題幹裡一定要出現的數字」與「正解應該是什麼」，
   而且正解是從**題幹的那些數字**用第二套實作重算出來的，不是拿設定檔自己的
   常數算 —— 後者在題幹被改掉的時候不會響。 */
const BANK_EXPECTED = {
  qs: [
    { nums:['324', '13'], ans:1, mulRow2:['324', '13'], expect:{ zh:'3240', en:'3240' },
      stemExact:{"zh": "324 × 13 的直式裡，第二排（用乘數的十位去乘）代表的值是多少？", "en": "In the column form for 324 × 13, what value does the second row (multiplying by the tens digit) stand for?"},
      numsAll:['324', '13'],
      whyMust:{ zh:['324 × 10 ＝ 3240'], en:['324 × 10 = 3240'] },
      ask:{ zh:{ must:['第二排', '代表的值'], never:['第一排'] },
            en:{ must:['second row', 'value'], never:['first row'] } } },
    /* 這一題問的是「為什麼」，題幹裡沒有任何數字 —— 所以沒有 nums 可以釘。
       改用 onlyAnswer 釘住：那句理由只能落在正解上。 */
    { nums:[], ans:1, numsAll:[],
      stemExact:{"zh": "二位數乘的時候，第二排為什麼要往左移一格？", "en": "Why does the second row shift one column left when the multiplier has two digits?"},
      whyMust:{ zh:['324 × 10 ＝ 3240'], en:['324 × 10 = 3240'] },
      ask:{ zh:{ must:['第二排為什麼要往左移一格'] }, en:{ must:['Why does the second row shift'] } },
      onlyAnswer:{ zh:'代表「幾十個」', en:'means “lots of ten”' } },
    { nums:['213', '24'], ans:3, mulTotal:['213', '24'], expect:{ zh:'5112', en:'5112' },
      numsAll:['213', '24'],
      /* 純算式的題目：整句話逐字釘死，連多一個「＋ 1」都不行。 */
      stemExact:{ zh:'213 × 24 ＝ ？', en:'213 × 24 = ?' },
      whyMust:{ zh:['852 ＋ 4260 ＝ 5112'], en:['852 + 4260 = 5112'] },
      ask:{ zh:{ must:['＝ ？'], never:['第二排'] }, en:{ must:['= ?'], never:['second row'] } } },
    { nums:['725', '25'], ans:1, qLen:['725', '25'], expect:{ zh:'2 位', en:'2' },
      stemExact:{"zh": "725 ÷ 25 的商是幾位數？（先不要算出商）", "en": "How many digits does the quotient of 725 ÷ 25 have? (Do not work out the quotient yet.)"},
      numsAll:['725', '25'],
      whyMust:{ zh:['商有 2 位'], en:['quotient has 2 digits'] },
      ask:{ zh:{ must:['商是幾位數'], never:['餘'] }, en:{ must:['How many digits'], never:['remainder'] } } },
    { nums:['152', '19'], ans:0, firstTry:['152', '19'], expect:{ zh:'7', en:'7' },
      stemExact:{"zh": "算 152 ÷ 19 的時候，把除數四捨五入到十位來試商，第一次會試哪一個數字？", "en": "Working out 152 ÷ 19 by rounding the divisor to the nearest ten, which digit do you try first?"},
      numsAll:['152', '19'],
      whyMust:{ zh:['152 ÷ 20 猜出來是 7'], en:['152 ÷ 20 guesses 7'] },
      ask:{ zh:{ must:['第一次'] }, en:{ must:['first'] } } },
    /* 選項是整句話，所以沒有算術神諭可用。用「正解一定要出現這句關鍵字，
       而且其他三個選項一定不可以出現」來釘住它 —— 少了這一條，把正解換成
       任何一句乾淨的話而 ans 不動，所有檢查都還是綠的（grade-4/decimal 的 critical）。 */
    { nums:['152', '19', '133'], ans:2, numsAll:['152', '19', '133', '7'],
      stemExact:{"zh": "152 ÷ 19，試商試 7：7 × 19 ＝ 133，152 － 133 ＝ 19。這個 7 對不對？", "en": "For 152 ÷ 19 you try 7: 7 × 19 = 133 and 152 - 133 = 19. Is 7 right?"},
      whyMust:{ zh:['8 × 19 ＝ 152'], en:['8 × 19 = 152'] },
      ask:{ zh:{ must:['這個 7 對不對'] }, en:{ must:['Is 7 right'] } },
      onlyAnswer:{ zh:'太小', en:'too small' } }
  ],
  qsAdv: [
    { nums:['125', '32', '5000'], ans:0, change:['125', '32', '5000'], expect:{ zh:'1000', en:'1000' },
      stemExact:{"zh": "文字題：一盒餅乾 125 元，媽媽買了 32 盒，付了 5000 元。可以找回多少錢？", "en": "Word problem: a box of biscuits costs 125 dollars. Mum buys 32 boxes and hands over 5000 dollars. How much change does she get?"},
      numsAll:['125', '32', '5000'],
      whyMust:{ zh:['250 ＋ 3750 ＝ 4000', '5000 － 4000 ＝ 1000'],
                en:['250 + 3750 = 4000', '5000 - 4000 = 1000'] },
      ask:{ zh:{ must:['找回'] }, en:{ must:['change'] } } },
    { nums:['840', '35', '6'], ans:1, expect:{ zh:'4', en:'4' }, twoStepDiv:['840', '35', '6'],
      stemExact:{"zh": "文字題：840 顆糖果，每袋裝 35 顆，剛好裝完。裝好之後每 6 袋放進一箱，可以放滿幾箱？", "en": "Word problem: 840 sweets are packed 35 to a bag with none left over. The bags then go into boxes, 6 bags per box. How many boxes are filled?"},
      numsAll:['840', '35', '6'],
      whyMust:{ zh:['24 ÷ 6 ＝ 4'], en:['24 ÷ 6 = 4'] },
      ask:{ zh:{ must:['幾箱'] }, en:{ must:['boxes'] } } },
    { nums:['500', '48'], ans:2, qrPair:['500', '48'], numsAll:['500', '48'],
      stemExact:{"zh": "文字題：小安有 500 元，一本筆記本 48 元。最多可以買幾本，還剩多少錢？", "en": "Word problem: Ann has 500 dollars and a notebook costs 48 dollars. What is the most she can buy, and how much is left?"},
      whyMust:{ zh:['商是 10，餘 20'], en:['the quotient 10 with 20 left'] },
      expect:{ zh:'10 本，剩 20 元', en:'10, with 20 dollars left' },
      ask:{ zh:{ must:['最多可以買幾本'] }, en:{ must:['most she can buy'] } } },
    { nums:['700', '32'], ans:3, needMore:['700', '32'], expect:{ zh:'22', en:'22' },
      stemExact:{"zh": "文字題：700 個學生要坐車，一輛車最多坐 32 人。至少要幾輛車？", "en": "Word problem: 700 students need coaches and one coach seats 32. How many coaches are needed at least?"},
      numsAll:['700', '32'],
      whyMust:{ zh:['700 ÷ 32 ＝ 21 餘 28', '商 ＋ 1 ＝ 22'],
                en:['700 ÷ 32 = 21 remainder 28', 'quotient + 1 = 22'] },
      ask:{ zh:{ must:['至少'] }, en:{ must:['at least'] } } }
  ],
  qsBoost: [
    { nums:['324', '13', '972', '1296'], ans:1, numsAll:['324', '13', '972', '1296'],
      stemExact:{"zh": "迷思檢查：小安算 324 × 13，第一排寫 972、第二排寫 324，可是沒有往左移一格就直接相加，得到 1296。哪裡不對？", "en": "Misconception check: for 324 × 13, Ann writes 972 in the first row and 324 in the second, but adds them without shifting the second row and gets 1296. What is wrong with that?"},
      whyMust:{ zh:['972 ＋ 3240 ＝ 4212'], en:['972 + 3240 = 4212'] },
      ask:{ zh:{ must:['哪裡不對'] }, en:{ must:['What is wrong'] } },
      onlyAnswer:{ zh:'代表 3240 不是 324', en:'stands for 3240 and not 324' } },
    { nums:['725', '25', '22'], ans:2, numsAll:['725', '25', '22', '2', '50', '72'],
      stemExact:{"zh": "迷思檢查：小華算 725 ÷ 25，試商試 2：2 × 25 ＝ 50，72 － 50 ＝ 22，然後說「22 比 25 小，所以商是 2、餘數 22」就停了。哪裡不對？", "en": "Misconception check: for 725 ÷ 25, Hua tries 2: 2 × 25 = 50 and 72 - 50 = 22, then says “22 is smaller than 25, so the quotient is 2 with remainder 22” and stops. What is wrong with that?"},
      whyMust:{ zh:['9 × 25 ＝ 225'], en:['9 × 25 = 225'] },
      ask:{ zh:{ must:['哪裡不對'] }, en:{ must:['What is wrong'] } },
      onlyAnswer:{ zh:'還沒有帶下來', en:'has not been brought down' } }
  ]
};

/* ---------- 讀者看得到的字（給 SIBLING_RULES 用） ---------- */
function stripComments(src){
  return src.replace(/<!--[\s\S]*?-->/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ');
}
function countOf(src, needle){
  const clean = stripComments(src);
  let n = 0, i = 0;
  for (;;){
    const j = clean.indexOf(needle, i);
    if (j < 0) break;
    n++; i = j + 1;
  }
  return n;
}

/* 一個字大概多寬（上界）。中文與全形標點算一個字寬，數字與英文字母算 0.62，
   其餘半形算 0.5。故意高估 —— 畫布邊界的斷言只有高估才安全。 */
function estTextW(s, font){
  let em = 0;
  for (const ch of String(s)){
    if (/[　-〿＀-￯一-鿿]/.test(ch)) em += 1.0;
    else if (/[0-9A-Za-z]/.test(ch)) em += 0.62;
    else em += 0.5;
  }
  return em * font;
}

/* 解釋裡的算式驗算器：把每一條**完整的**算式鏈抓出來，逐段算一次。
   ⚠️ 一定要抓「最長的一條鏈」—— 只抓兩個運算元的話，
   `24 × 18 ＋ 9 ＝ 441` 會被切成 `18 ＋ 9 ＝ 441` 而誤判（第一版就是這樣壞的）。 */
function arithProblems(text){
  const out = [];
  const NUM = '\\d+';
  /* ⚠️ 減號有三種寫法：全形 －(U+FF0D)、半形 -、以及 −(U+2212)。
     別的檢查把 − 當負號，這裡如果不把它當運算符號，`3 − 1 ＝ 1` 就會
     只被驗到 `1 ＝ 1` 那一段而漏掉整條錯式（codex 第三輪）。三種都要收。 */
  const OP = '[×＋－−÷+\\-]';
  const TERM = NUM + '(?:\\s*' + OP + '\\s*' + NUM + ')*';
  const CHAIN = new RegExp(TERM + '(?:\\s*[＝=]\\s*' + TERM + ')+(?:\\s*(?:餘|remainder)\\s*' + NUM + ')?', 'g');
  let m;
  while ((m = CHAIN.exec(text))){
    const whole = m[0];
    /* 左邊界：往前跳過空白，前一個「有意義的字」不可以是數字、運算符號或等號 ——
       否則這一條鏈是從更長的算式裡被切出來的。
       ⚠️ 只看緊鄰的那一個字元不夠：「商 ＋ 1 ＝ 22」的 1 前面是空白，
       真正的前一個字是 ＋，那一段並不是一條獨立的算式。 */
    let k = m.index - 1;
    while (k >= 0 && /\s/.test(text.charAt(k))) k--;
    if (k >= 0 && /[\d×＋－−÷+\-＝=]/.test(text.charAt(k))) continue;
    const remM = /(?:餘|remainder)\s*(\d+)\s*$/.exec(whole);
    const rem = remM ? Number(remM[1]) : null;
    const core = remM ? whole.slice(0, remM.index) : whole;
    const parts = core.split(/[＝=]/).map(s => s.trim()).filter(s => s.length);
    const evalTerm = t => {
      const toks = t.split(/\s*([×＋－−÷+\-])\s*/).filter(s => s !== '');
      let v = Number(toks[0]);
      for (let i = 1; i < toks.length; i += 2){
        const op = toks[i], b = Number(toks[i + 1]);
        if (op === '×') v = v * b;
        else if (op === '＋' || op === '+') v = v + b;
        else if (op === '－' || op === '−' || op === '-') v = v - b;
        else if (op === '÷'){ if (b === 0 || v % b !== 0) return null; v = v / b; }
        else return null;
      }
      return v;
    };
    if (rem !== null){
      /* 「A ÷ B ＝ Q 餘 R」：不是等式，要用 A ＝ B × Q ＋ R 驗。 */
      const dm = /^(\d+)\s*÷\s*(\d+)$/.exec(parts[0]);
      const q = Number(parts[parts.length - 1]);
      if (!dm || !Number.isInteger(q)){ out.push(whole); continue; }
      const A = Number(dm[1]), B = Number(dm[2]);
      if (!(A === B * q + rem && rem >= 0 && rem < B)) out.push(whole);
      continue;
    }
    const vals = parts.map(evalTerm);
    /* ⚠️ 算不出來就跳過，等於替它背書：`5 ÷ 2 ＝ 2` 的左邊除不盡，
       evalTerm 回 null，這一條就靜靜通過了（codex 第三輪）。
       這一課的解釋只會寫「整除」或「A ÷ B ＝ Q 餘 R」，所以除不盡
       又沒有寫餘數的算式本身就是錯的 —— 要報出來。 */
    if (vals.some(v => v === null)){ out.push(whole); continue; }
    if (!vals.every(v => v === vals[0])) out.push(whole);
  }
  return out;
}

const PLACE_ORDER = ['ones', 'tens', 'hundreds', 'thousands', 'tenThousands'];

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    { file:"index", via:"index", expect:"ROUNDTEN",
      find:"  function roundTen(n){ return Math.floor((n + 5) / 10) * 10; }",
      replace:"  function roundTen(n){ return Math.floor(n / 10) * 10; }",
      why:"rounding down instead of to the nearest ten makes every guess for 15..19, 25..29 too small" },
    { file:"index", via:"index", expect:"PAD",
      find:"    if (ds.length + shift > width) return null;",
      replace:"    if (ds.length + shift > width) ds = ds.slice(ds.length + shift - width);",
      why:"padCells would silently truncate a number that does not fit instead of failing loudly" },
    { file:"index", via:"index", expect:"MULWIDTH",
      find:"                         String(r1).length, String(r2).length + 1, String(total).length);",
      replace:"                         String(r1).length, String(r2).length);",
      why:"this is the real trap: forgetting that the shifted second row needs one more column" },
    { file:"index", via:"index", expect:"MUL",
      find:"      r1:r1, r2:r2, r2value:r2 * 10, total:total, width:width",
      replace:"      r1:r1, r2:r2, r2value:r2, total:total, width:width",
      why:"the second row would stand for its written digits instead of ten times them" },
    { file:"index", via:"index", expect:"MULCOL",
      find:"      carry = Math.floor(prod / 10);\n    }\n    if (carry > 0){",
      replace:"      carry = 0;\n    }\n    if (carry > 0){",
      why:"multiplication would never carry between columns" },
    { file:"index", via:"index", expect:"MULCOL",
      find:"    if (carry > 0){\n      /* 最左邊剩下的進位在最左邊，但它是**最後**才講的一步。 */\n      out.push({",
      replace:"    if (false){\n      /* 最左邊剩下的進位在最左邊，但它是**最後**才講的一步。 */\n      out.push({",
      why:"the leading carry would be dropped, so 487 x 6 loses its thousands digit" },
    { file:"index", via:"index", expect:"SPLIT",
      find:"    cols.push(b % 10);\n    cols.push(Math.floor(b / 10) * 10);",
      replace:"    cols.push(b % 10);\n    cols.push(Math.floor(b / 10));",
      why:"the tens part would be a bare digit, so the column no longer adds up to the second row" },
    { file:"index", via:"index", expect:"START",
      find:"      ok = cur >= d;",
      replace:"      ok = cur > d;",
      why:"a prefix exactly equal to the divisor would be called \"will not go\" (250 / 25)" },
    { file:"index", via:"index", expect:"START",
      find:"        cmp: (cur === d) ? 0 : (cur > d ? 1 : -1)",
      replace:"        cmp: (cur > d ? 1 : -1)",
      why:"the \"exactly equal\" case would be narrated as \"bigger than\", which is false" },
    { file:"index", via:"index", expect:"TRY",
      find:"    var guess = Math.min(Q_MAX, guessRaw);",
      replace:"    var guess = guessRaw;",
      why:"a guess above 9 would be tried as-is, but the lesson promises you try 9 first" },
    { file:"index", via:"index", expect:"TRY",
      find:"        tries.push({ q:t, prod:prod, rem:null, verdict:'big' });",
      replace:"        tries.push({ q:t, prod:prod, rem:cur - prod, verdict:'big' });",
      why:"the negative remainder would be carried in the data, which is how a negative reached the screen in grade-4/decimal" },
    { file:"index", via:"index", expect:"TRY",
      find:"      if (rem >= d){\n        tries.push({ q:t, prod:prod, rem:rem, verdict:'small' });",
      replace:"      if (rem > d){\n        tries.push({ q:t, prod:prod, rem:rem, verdict:'small' });",
      why:"a remainder exactly equal to the divisor would be accepted, the boundary \"not smaller than\" exists for" },
    { file:"index", via:"index", expect:"DIV",
      find:"      qDigits.push(tp.q);\n      cur = tp.rem;",
      replace:"      qDigits.push(tp.q);\n      cur = tp.rem + 1;",
      why:"the running remainder would be wrong, so every multi-round division breaks" },
    { file:"index", via:"index", expect:"DIV",
      find:"      if (!started && cur < d) continue;      /* 還不夠除，往右多帶一位 */",
      replace:"      if (cur < d) continue;      /* 還不夠除，往右多帶一位 */",
      why:"a later round that will not go would be skipped instead of writing 0 in the quotient" },
    { file:"index", via:"index", expect:"LDROWS",
      find:"      if (st.q === 0) continue;",
      replace:"      if (st.q === -1) continue;",
      why:"a zero round would draw a pointless multiply-by-0 and subtract-0 pair of rows" },
    { file:"index", via:"index", expect:"LDROWS",
      find:"      if (rows[i].kind === 'diff'){ rows[i].last = true; break; }",
      replace:"      if (rows[i].kind === 'prod'){ rows[i].last = true; break; }",
      why:"no row would be marked as carrying the remainder, so the child cannot see the answer" },
    { file:"index", via:"index", expect:"LDROWS",
      find:"      qCells[plan.steps[k].col] = String(plan.steps[k].q);",
      replace:"      qCells[plan.steps[k].col] = String(plan.steps[k].q + 1);",
      why:"the quotient written above the dividend would not be the quotient" },
    { file:"index", via:"index", expect:"GEOM",
      find:"  var CH_REM_DY = 58;",
      replace:"  var CH_REM_DY = 33;",
      why:"the remainder label would share a row with the other label and could overlap it" },
    { file:"index", via:"index", expect:"GEOM",
      find:"  var CH_TITLE_DY = -18;",
      replace:"  var CH_TITLE_DY = -50;",
      why:"the title would be drawn above the top edge of the canvas" },
    { file:"index", via:"index", expect:"GEOM",
      find:"  var CH_W = 520, CH_H = 170;",
      replace:"  var CH_W = 520, CH_H = 150;",
      why:"the canvas would shrink without the viewBox and CSS following, clipping the remainder label" },
    { file:"index", via:"index", expect:"GEOM",
      find:"    var edge = CH_X0 + unit * d * q;",
      replace:"    var edge = CH_X0 + unit * d * (q + 1);",
      why:"the shares would run past the right end of the bar" },
    { file:"index", via:"index", expect:"GEOM",
      find:"  var CH_IDX_DY = 26;",
      replace:"  var CH_IDX_DY = 60;",
      why:"the share numbers would be drawn below the bar instead of inside it" },
    { file:"index", via:"index", expect:"MUL_CASES",
      find:"    { a:487, b:56 }    /* 進位最兇的一題（7 × 6 ＝ 42，進位 4） */",
      replace:"    { a:487, b:50 }    /* 進位最兇的一題（7 × 6 ＝ 42，進位 4） */",
      why:"a multiplier ending in 0 contradicts what all four pages promise the child" },
    { file:"index", via:"index", expect:"MUL_CASES",
      find:"    { a:305, b:13 },   /* 被乘數中間有 0 */",
      replace:"    { a:315, b:13 },   /* 被乘數中間有 0 */",
      why:"no sample would have a 0 inside the multiplicand, so that column is never demonstrated" },
    { file:"index", via:"index", expect:"LD_CASES",
      find:"    { N:812, d:40 }    /* 20 餘 12；商的個位是 0 */",
      replace:"    { N:852, d:40 }    /* 20 餘 12；商的個位是 0 */",
      why:"no worked example would have a 0 in the quotient, so that rule has no demonstration" },
    { file:"index", via:"index", expect:"LD_CASES",
      find:"    { N:583, d:12 },   /* 48 餘 7；兩輪都要往下調 */",
      replace:"    { N:567, d:12 },   /* 48 餘 7；兩輪都要往下調 */",
      why:"no worked example would ever guess above 9, so the try-9-first rule has no demonstration" },
    { file:"index", via:"index", expect:"TRY_CASES",
      find:"    { cur:103, d:12 },   /* 12 → 10，猜 10（超過 9）→ 先試 9，太大 */",
      replace:"    { cur:88, d:12 },   /* 12 → 10，猜 10（超過 9）→ 先試 9，太大 */",
      why:"no sample would guess above 9" },
    { file:"index", via:"index", expect:"TRY_CASES",
      find:"    { cur:72,  d:25 },   /* 25 → 30，猜 2，剛好 */\n    { cur:225, d:25 },   /* 25 → 30，猜 7，太小，要調兩次 */\n    { cur:103, d:12 },   /* 12 → 10，猜 10（超過 9）→ 先試 9，太大 */\n    { cur:152, d:19 }    /* 19 → 20，猜 7，餘數剛好等於除數 → 還是太小 */",
      replace:"    { cur:72,  d:25 },   /* 25 → 30，猜 2，剛好 */\n    { cur:140, d:25 },   /* 25 → 30，猜 7，太小，要調兩次 */\n    { cur:103, d:12 },   /* 12 → 10，猜 10（超過 9）→ 先試 9，太大 */\n    { cur:151, d:19 }    /* 19 → 20，猜 7，餘數剛好等於除數 → 還是太小 */",
      why:"no sample would have a remainder exactly equal to the divisor" },
    { file:"index", via:"index", expect:"ADJ_CASES",
      find:"    { cur:149, d:15 },   /* 正解 9（猜 7，要往上調兩次） */",
      replace:"    { cur:140, d:25 },   /* 正解 9（猜 7，要往上調兩次） */",
      why:"no sample would need two upward adjustments" },
    { file:"index", via:"index", expect:"START_CASES",
      find:"    { N:152, d:19 },   /* 15 ＜ 19 → 商一位 */\n    { N:486, d:54 }    /* 48 ＜ 54 → 商一位 */",
      replace:"    { N:652, d:19 },   /* 15 ＜ 19 → 商一位 */\n    { N:686, d:54 }    /* 48 ＜ 54 → 商一位 */",
      why:"no sample would give a one-digit quotient" },
    { file:"index", via:"index", expect:"ROUNDS",
      find:"    { kind:'mulTotal', a:213,  b:24, opts:['1278', '5112', '852', '4260'], ans:1 },",
      replace:"    { kind:'mulTotal', a:213,  b:24, opts:['1278', '5112', '852', '4260'], ans:0 },",
      why:"the game would mark the wrong option correct" },
    { file:"index", via:"index", expect:"ROUNDS",
      find:"    if (r.kind === 'mulRow2')  return String(mulPlan(r.a, r.b).r2value);",
      replace:"    if (r.kind === 'mulRow2')  return String(mulPlan(r.a, r.b).r2);",
      why:"the game answer would be the written row instead of the value it stands for" },
    { file:"index", via:"index", expect:"BANK",
      find:"        { stem:'213 × 24 ＝ ？',",
      replace:"        { stem:'213 × 26 ＝ ？',",
      why:"changing a number in the stem must break the answer recomputed from that stem" },
    { file:"index", via:"index", expect:"BANK",
      find:"          opts:['1278', '852', '4260', '5112'], ans:3,\n          why:'第一排 213 × 4 ＝ 852",
      replace:"          opts:['1278', '852', '4260', '5112'], ans:2,\n          why:'第一排 213 × 4 ＝ 852",
      why:"moving the answer index without moving the option must be caught" },
    { file:"index", via:"index", expect:"BANK",
      find:"                '因為第二排是用乘數的<strong>十位</strong>乘出來的，代表「幾十個」—— 寫下來的那個數要往左移一格，才是它真正的值',",
      replace:"                '因為第二排是用乘數的<strong>十位</strong>乘出來的，寫下來的那個數要往左移一格，才是它真正的值',",
      why:"the reason that makes the correct option correct would disappear from it" },
    { file:"index", via:"index", expect:"BANK",
      find:"                '因為第二排的數字比較大',",
      replace:"                '因為第二排代表「幾十個」，數字比較大',",
      why:"a wrong option would also carry the key phrase, so two options become defensible" },
    { file:"index", via:"index", expect:"NARR",
      find:"      s4rem: function(rem){ return '餘 ' + rem; },",
      replace:"      s4rem: function(rem){ return '餘' + rem; },",
      why:"a digit glued to a Chinese character is a real rendering defect that no numeric check sees" },
    { file:"index", via:"index", expect:"NARR",
      find:"      s4lab: function(q, d){ return lotsEn(q, String(d)); },",
      replace:"      s4lab: function(q, d){ return q + ' lots of ' + d; },",
      why:"this prints \"1 lots of 25\" - the singular/plural bug that only the value 1 exposes" },
    { file:"index", via:"index", expect:"NARR",
      find:"      s3result: function(qLen){ return 'The quotient has ' + digitsEn(qLen); },",
      replace:"      s3result: function(qLen){ return 'The quotient has ' + qLen + ' digits'; },",
      why:"this prints \"1 digits\" for a one-digit quotient" },
    { file:"reference", via:"index", expect:"SIBLING",
      find:"a1:'<strong>試商</strong>：把<strong>除數四捨五入到十位</strong>（19 → 20、14 → 10、97 → 100）",
      replace:"a1:'<strong>試商</strong>：把<strong>除數看成整十</strong>（19 → 20、14 → 10、97 → 100）",
      why:"the cheat sheet would stop using the same wording as the lesson for how the guess is made" },
    { file:"parents", via:"index", expect:"SIBLING",
      find:"乘數的<strong>個位不是 0</strong>。被除數再多一位（四位數）做法完全一樣，只是「商、乘、減、帶下來」多做一輪。',",
      replace:"乘數不是整十。被除數再多一位（四位數）做法完全一樣，只是「商、乘、減、帶下來」多做一輪。',",
      why:"the parents page would stop stating the scope boundary in the same words" },
    { file:"index", via:"index", expect:"SIBLING",
      find:"<strong>可能要調不只一次</strong>—— 一直調到兩件事都成立。</p>",
      replace:"一直調到兩件事都成立。</p>",
      why:"removing one of the two copies of the rule must be caught (markup and dictionary each hold one)" },
    { file:"review", via:"index", expect:"GENS",
      find:"    { id:'verifyBack', cat:'div',",
      replace:"    { id:'verifyBackX', cat:'div',",
      why:"renaming a generator would silently drop its invariants, expectedCorrect and renderCheck" },
    { file:"review", via:"review", expect:"opts[ans]",
      find:"        var mix = mixAll(mp.total, mulWrongs(mp, mp.total, [d.a, d.b]));",
      replace:"        var mix = mixAll(mp.r1, mulWrongs(mp, mp.total, [d.a, d.b]));",
      why:"the marked answer would be the first row instead of the product" },
    { file:"review", via:"review", expect:"opts[ans]",
      find:"        var correct = mp.r2value;",
      replace:"        var correct = mp.r2;",
      why:"the second-row question would mark the written digits correct instead of the value they stand for" },
    { file:"review", via:"review", expect:"why must spell out",
      find:"            ? rounds.join('；') + '。所以 ' + d.N + ' ÷ ' + d.d + ' ＝ ' + p.q + ' 餘 ' + p.rem +",
      replace:"            ? rounds.join('；') + '。所以商是 ' + p.q + '、餘 ' + p.rem +",
      why:"the explanation would stop stating the whole result the child is marked against" },
    { file:"review", via:"review", expect:"must never be the correct answer",
      find:"          ans: order.indexOf(d.want),",
      replace:"          ans: order.indexOf('cannot'),",
      why:"the \"no way to judge it\" option would be marked correct, but the two checks always decide" },
    { file:"review", via:"review", expect:"copied straight out of the stem",
      find:"        var stemNums = [d.a, d.b, d.paid];\n        var okDis = function(v){\n          return inRange(v) && v <= d.paid && v !== correct && stemNums.indexOf(v) < 0;\n        };\n        /* 誘答：把總價當答案（最典型）、忘記移一格算出來的「找回」、付的錢 */\n        /* ⚠️ 不可以把 d.paid 當誘答：那個數字題幹剛印過（看起來像把題幹抄回來），\n           而且「付了多少」不是任何一種真實的算錯。留下的兩個都是真的會犯的錯：\n           把總價當成找回的錢、以及忘記把第二排往左移之後再找錢。 */\n        var cands = [mp.total, d.paid - (mp.r1 + mp.r2)].filter(okDis);",
      replace:"        var okDis = function(v){\n          return inRange(v) && v <= d.paid && v !== correct;\n        };\n        var cands = [d.a, mp.total, d.paid - (mp.r1 + mp.r2)].filter(okDis);",
      why:"the change question would offer the price, the quantity or the amount paid back as a distractor" },
    { file:"review", via:"review", expect:"printed on the picture",
      find:"        { x:BF_X0 + (edge - BF_X0) / 2, y:BF_Y + BF_BARH + BF_LAB_DY, text:'?', kind:'mark' }",
      replace:"        { x:BF_X0 + (edge - BF_X0) / 2, y:BF_Y + BF_BARH + BF_LAB_DY, text:String(q), kind:'mark' }",
      why:"the answer would be printed on the picture the question asks about" },
    { file:"review", via:"review", expect:"the stem must ask for",
      find:"            ? d.a + ' × ' + d.b + ' 的直式，<strong>第二排代表的值</strong>是多少？'",
      replace:"            ? d.a + ' × ' + d.b + ' 的直式，<strong>第二排</strong>是多少？'",
      why:"without \"the value it stands for\" the written row is also correct, so two options are defensible" },
    { file:"review", via:"review", expect:"the guess already equals the correct digit",
      find:"          if (tp.guess === tp.q) continue;",
      replace:"          if (tp.guess === 99) continue;",
      why:"the question would sometimes ask which digit to try first when the first try is already right" },
    { file:"review", via:"review", expect:"singular/plural",
      find:"      len: function(n){ return digitsEn(n); },",
      replace:"      len: function(n){ return n + ' digits'; },",
      why:"this prints \"1 digits\" - the singular/plural bug that only the value 1 exposes" },
    { file:"review", via:"review", expect:"must not come out exact",
      find:"          if (p.rem === 0) continue;               /* 有餘數才問得出「還剩多少」 */",
      replace:"          if (p.rem === 99999) continue;               /* 有餘數才問得出「還剩多少」 */",
      why:"an exact division would make the answered-the-remainder distractor equal 0" },
    { file:"review", via:"review", expect:"cut lines",
      find:"    for (i = 1; i <= q; i++) cuts.push(BF_X0 + unit * d * i);",
      replace:"    for (i = 1; i < q; i++) cuts.push(BF_X0 + unit * d * i);",
      why:"the picture would draw one fewer division line than the number of shares it claims" },
    { file:"review", via:"review", expect:"but the numbers say",
      find:"    if (rem >= d) return { q:t, prod:prod, rem:rem, verdict:'small' };",
      replace:"    if (rem > d) return { q:t, prod:prod, rem:rem, verdict:'small' };",
      why:"a remainder exactly equal to the divisor would be judged just right" },
    { file:"index", via:"index", expect:"unexpected number",
      find:"        { stem:'213 × 24 ＝ ？',",
      replace:"        { stem:'213 × 24 ＋ 1 ＝ ？',",
      why:"a stem could gain an extra operand while every required number is still present" },
    { file:"index", via:"index", expect:"expected exactly",
      find:"        { stem:'213 × 24 ＝ ？',\n          opts:['1278', '852', '4260', '5112'], ans:3,",
      replace:"        { stem:'213 × 24 ＝ ?',\n          opts:['1278', '852', '4260', '5112'], ans:3,",
      why:"the pure-arithmetic stem must match word for word, punctuation included" },
    { file:"index", via:"index", expect:"why must contain",
      find:"852 ＋ 4260 ＝ <strong>5112</strong>。（1278 是忘記往左移",
      replace:"852 ＋ 4260 ＝ <strong>5113</strong>。（1278 是忘記往左移",
      why:"the explanation could state wrong arithmetic while the stem, options and answer stay correct" },
    { file:"index", via:"index", expect:"ends in 0",
      find:"    { kind:'mulRow2',  a:324,  b:13, opts:['324', '972', '3240', '4212'],  ans:2 },",
      replace:"    { kind:'mulRow2',  a:324,  b:30, opts:['324', '972', '9720', '4212'],  ans:2 },",
      why:"a game round could use a multiplier ending in 0 with perfectly consistent arithmetic" },
    { file:"index", via:"index", expect:"clipped by the canvas edge",
      find:"      s4rem: function(rem){ return '餘 ' + rem; },",
      replace:"      s4rem: function(rem){ return '剩下沒有分完的還有這麼多而這句話刻意寫得非常長用來測試畫布的左邊界 ' + rem + ' 個'; },",
      why:"a long right-anchored label runs off the left of the canvas even though its anchor point is inside" },
    { file:"index", via:"index", expect:"teaching order",
      find:"      out.push({\n        pos: ds.length - 1 - i, digit: ds[i], m: m, carryIn: carry,",
      replace:"      out.unshift({\n        pos: ds.length - 1 - i, digit: ds[i], m: m, carryIn: carry,",
      why:"reversing the column steps makes the narration walk left-to-right while the table fills right-to-left" },
    { file:"index", via:"index", expect:"expected exactly",
      find:"        { stem:'324 × 13 的直式裡，第二排（用乘數的十位去乘）<strong>代表的值</strong>是多少？',",
      replace:"        { stem:'324 × 13 的直式裡，第二排（用乘數的十位去乘）<strong>代表的值</strong>是多少？再加 13 呢？',",
      why:"a stem can reuse a number it already contains, which a set-membership whitelist cannot see" },
    { file:"index", via:"index", expect:"false calculation",
      find:"852 ＋ 4260 ＝ <strong>5112</strong>。（1278 是忘記往左移",
      replace:"852 ＋ 4260 ＝ <strong>5112</strong>。順帶一提 1 ＋ 1 ＝ 3。（1278 是忘記往左移",
      why:"an explanation can keep the required correct line and still add a false one" },
    { file:"review", via:"review", expect:"false calculation",
      find:"' × ' + d.d + ' ＝ ' + st.prod + '，剩 ' + st.rem + '）')",
      replace:"' × ' + d.d + ' ＝ ' + (st.prod + 1) + '，剩 ' + st.rem + '）')",
      why:"a generated explanation can state a product that is one off while every other check stays green" },
    { file:"index", via:"index", expect:"false calculation",
      find:"商從第 2 位開始，所以商有 <strong>2 位</strong>。' }",
      replace:"商從第 2 位開始，所以商有 <strong>2 位</strong>。（順帶一提 5 ÷ 2 ＝ 2。）' }",
      why:"a non-integral division with no remainder clause used to be skipped rather than reported" },
    { file:"index", via:"index", expect:"false calculation",
      find:"被除數有 3 位，商從第 2 位開始",
      replace:"被除數有 3 位（3 − 1 ＝ 1），商從第 2 位開始",
      why:"a minus written as U+2212 used to fall outside the operator grammar" },
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      mulProduct: d => mulInv(d, 'mulProduct'),
      mulRow1: d => {
        const bad = mulInv(d, 'mulRow1');
        if (bad) return bad;
        /* 第一排和第二排代表的值不可以相同，不然兩個選項會撞在一起。 */
        if (mulRef(d.a, d.b % 10) === mulRef(d.a, Math.floor(d.b / 10)) * 10)
          return 'mulRow1: the first row and the second row have the same value, so two options collide';
        return null;
      },
      mulRow2: d => mulInv(d, 'mulRow2'),
      mulWord: d => {
        const bad = mulInv(d, 'mulWord');
        if (bad) return bad;
        if (!Number.isInteger(d.paid) || !Number.isInteger(d.change))
          return 'mulWord: paid/change are not integers';
        const total = mulRef(d.a, d.b);
        if (d.paid - total !== d.change) return 'mulWord: change does not equal paid minus total';
        if (!(d.change > 0)) return 'mulWord: the change must be positive';
        if (d.change === total) return 'mulWord: the change equals the total, so two options collide';
        if (d.paid % 1000 !== 0) return 'mulWord: the amount handed over should be a round number of thousands';
        if (!(d.s >= 0 && d.s <= 2)) return 'mulWord: scenario index out of range';
        return null;
      },
      qLen: d => {
        const bad = divInv(d, 'qLen');
        if (bad) return bad;
        const n = startRef(d.N, d.d).qLen;
        if (!(n === 1 || n === 2))
          return 'qLen: a 3-digit dividend over a 2-digit divisor can only give 1 or 2 quotient digits, got ' + n;
        return null;
      },
      tryFirst: d => {
        const bad = roundInv(d, 'tryFirst');
        if (bad) return bad;
        const guess = Math.min(9, Math.floor(d.cur / roundTenRef(d.d)));
        /* 猜的和正解一樣的話，「第一次試哪一個」和「正確的商」是同一個數 ——
           那一題就問不出「試商只是第一個猜測」這件事了。 */
        if (guess === quotDigitRef(d.cur, d.d).q)
          return 'tryFirst: the guess already equals the correct digit, so the question teaches nothing about adjusting';
        return null;
      },
      tryVerdict: d => {
        const bad = roundInv(d, 'tryVerdict');
        if (bad) return bad;
        if (!(Number.isInteger(d.cand) && d.cand >= 0 && d.cand <= 9))
          return 'tryVerdict: candidate digit out of range: ' + d.cand;
        if (['big', 'small', 'ok'].indexOf(d.want) < 0) return 'tryVerdict: unknown verdict ' + d.want;
        /* 用第二套實作重新判一次這個候選商。 */
        const prod = d.cand * d.d;
        const want = (prod > d.cur) ? 'big' : ((d.cur - prod >= d.d) ? 'small' : 'ok');
        if (want !== d.want) return 'tryVerdict: verdict says ' + d.want + ' but the numbers say ' + want;
        return null;
      },
      quotDigit: d => {
        const bad = roundInv(d, 'quotDigit');
        if (bad) return bad;
        const r = quotDigitRef(d.cur, d.d);
        if (r.q < 1) return 'quotDigit: the picture needs at least one share, got ' + r.q;
        const f = d.fig;
        if (!f) return 'quotDigit: make() did not attach the figure';
        /* ⚠️ 每一個要拿去比較的座標都要先確認是有限的數字。
           undefined < 0 和 undefined > w 都是 false，所以少一個欄位的話
           下面每一條邊界斷言都會靜靜通過，畫面卻印出 x="undefined"
           （grade-4/fraction 的 NaN 教訓）。 */
        const num = v => typeof v === 'number' && isFinite(v);
        for (const k of ['w', 'h', 'x0', 'x1', 'y', 'barh', 'cur', 'd', 'q', 'rem', 'edge', 'remW']){
          if (!num(f[k])) return 'quotDigit: fig.' + k + ' is not a finite number: ' + f[k];
        }
        if (f.q !== r.q) return 'quotDigit: fig.q says ' + f.q + ' but repeated subtraction says ' + r.q;
        if (f.rem !== r.rem) return 'quotDigit: fig.rem says ' + f.rem + ' but repeated subtraction says ' + r.rem;
        if (!Array.isArray(f.cuts) || f.cuts.length !== r.q)
          return 'quotDigit: expected ' + r.q + ' cut lines, got ' + (f.cuts || []).length;
        const span = f.x1 - f.x0;
        for (let i = 0; i < f.cuts.length; i++){
          if (!num(f.cuts[i])) return 'quotDigit: cut ' + i + ' is not finite';
          if (f.cuts[i] < f.x0 - 0.01 || f.cuts[i] > f.x1 + 0.01)
            return 'quotDigit: cut ' + i + ' is outside the bar';
          if (i > 0 && !(f.cuts[i] > f.cuts[i - 1]))
            return 'quotDigit: the cut lines are not in increasing order';
        }
        /* cur < 10d 保證每一份至少佔長條的十分之一 —— 分界線才看得清楚。 */
        const cellW = span * d.d / d.cur;
        if (!(cellW >= span / 10 - 0.01))
          return 'quotDigit: one share is only ' + cellW.toFixed(1) + 'px wide, thinner than a tenth of the bar';
        if (!(f.edge <= f.x1 + 0.01)) return 'quotDigit: the shares run past the right end of the bar';
        if (r.rem === 0 && Math.abs(f.edge - f.x1) > 0.01)
          return 'quotDigit: nothing is left over, so the shares must reach the right end';
        if (r.rem > 0 && !(f.remW > 0)) return 'quotDigit: something is left over but the remainder segment has no width';
        /* 從畫出來的座標把份數量回來 —— 第二條路：不看 q，看圖。 */
        const backQ = Math.round((f.edge - f.x0) / cellW);
        if (backQ !== r.q) return 'quotDigit: the picture is drawn as ' + backQ + ' shares, not ' + r.q;
        if (!Array.isArray(f.labels) || f.labels.length !== 2)
          return 'quotDigit: expected exactly 2 labels (a title and the question mark)';
        const marks = f.labels.filter(l => l.kind === 'mark');
        if (marks.length !== 1) return 'quotDigit: expected exactly one question-mark label';
        if (marks[0].text !== '?') return 'quotDigit: the label over the shares must be a question mark, not the answer';
        for (const l of f.labels){
          if (!num(l.x) || !num(l.y)) return 'quotDigit: a label has a non-finite coordinate';
          if (l.y < 12 || l.y > f.h - 4) return 'quotDigit: a label is outside the canvas vertically';
          if (l.x < 0 || l.x > f.w) return 'quotDigit: a label is outside the canvas horizontally';
        }
        return null;
      },
      divFull: d => divInv(d, 'divFull'),
      divWord: d => {
        const bad = divInv(d, 'divWord');
        if (bad) return bad;
        const r = ldRef(d.N, d.d);
        if (r.rem === 0) return 'divWord: the story asks what is left over, so the division must not come out exact';
        if (r.rem === r.q) return 'divWord: the remainder equals the quotient, so the "answered the remainder" distractor collides with the answer';
        if (!(d.s >= 0 && d.s <= 2)) return 'divWord: scenario index out of range';
        return null;
      },
      needOneMore: d => {
        const bad = divInv(d, 'needOneMore');
        if (bad) return bad;
        const r = ldRef(d.N, d.d);
        if (r.rem === 0) return 'needOneMore: with nothing left over the answer would not be quotient + 1 at all';
        if (r.rem === r.q + 1) return 'needOneMore: the remainder equals the answer, so a distractor collides with it';
        if (!(d.s >= 0 && d.s <= 2)) return 'needOneMore: scenario index out of range';
        return null;
      },
      verifyBack: d => {
        const bad = divInv(d, 'verifyBack');
        if (bad) return bad;
        const r = ldRef(d.N, d.d);
        if (r.rem === 0) return 'verifyBack: with no remainder the "forgot to add the remainder" distractor equals the answer';
        if (d.q !== r.q) return 'verifyBack: q does not match the division';
        if (d.rem !== r.rem) return 'verifyBack: rem does not match the division';
        if (d.d * d.q + d.rem !== d.N) return 'verifyBack: divisor × quotient + remainder does not rebuild the dividend';
        return null;
      }
    },

    /* 正解的字串由這裡獨立算一次 —— 全部走「卷積 ＋ 重複減法」那條路，
       完全不呼叫 review.html 的 mulPlan／tryPlan／ldPlan。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'mulProduct': return String(mulRef(d.a, d.b));
        case 'mulRow1':    return String(mulRef(d.a, d.b % 10));
        case 'mulRow2':    return String(mulRef(d.a, Math.floor(d.b / 10)) * 10);
        case 'mulWord':    return String(d.paid - mulRef(d.a, d.b));
        case 'qLen': {
          const n = startRef(d.N, d.d).qLen;
          return lang === 'zh' ? (n + ' 位') : (n + (n === 1 ? ' digit' : ' digits'));
        }
        case 'tryFirst':   return String(Math.min(9, Math.floor(d.cur / roundTenRef(d.d))));
        case 'tryVerdict': return PHRASE[lang][d.want];
        case 'quotDigit':  return String(quotDigitRef(d.cur, d.d).q);
        case 'divFull': {
          const r = ldRef(d.N, d.d);
          return lang === 'zh' ? ('商 ' + r.q + '，餘 ' + r.rem) : (r.q + ' remainder ' + r.rem);
        }
        case 'divWord':     return String(ldRef(d.N, d.d).q);
        case 'needOneMore': return String(ldRef(d.N, d.d).q + 1);
        case 'verifyBack':  return String(d.d * d.q + d.rem);
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣。正解與誘答分開驗。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (typeof s !== 'string' || !s.trim()) return 'empty option';
      if (s !== s.trim()) return 'option has stray whitespace: "' + s + '"';
      if (/undefined|NaN|\[object|null/.test(s)) return 'option leaks an internal value: ' + s;
      if (/<[a-z]/i.test(s)) return 'option contains markup: ' + s;
      if (lang === 'en' && /[一-鿿]/.test(s)) return 'English option contains Chinese: ' + s;
      if (/[-−]\d/.test(s)) return 'option contains a negative number: ' + s;

      /* 判斷句的四個選項是固定的一組話。 */
      if (genId === 'tryVerdict'){
        const ok = [PHRASE[lang].big, PHRASE[lang].small, PHRASE[lang].ok, PHRASE[lang].cannotTell];
        if (ok.indexOf(s) < 0) return 'tryVerdict option is not one of the four fixed phrases: ' + s;
        if (isCorrect && s === PHRASE[lang].cannotTell)
          return 'tryVerdict: "no way to judge" must never be the correct answer — the two checks always decide';
        return null;
      }
      /* 「商有幾位」：三個位數說法 ＋ 一句「沒辦法知道」。 */
      if (genId === 'qLen'){
        const nums = [1, 2, 3].map(n => lang === 'zh' ? (n + ' 位') : (n + (n === 1 ? ' digit' : ' digits')));
        if (nums.indexOf(s) < 0 && s !== PHRASE[lang].unknown)
          return 'qLen option is not a digit count or the "cannot tell" phrase: ' + s;
        if (isCorrect && s === PHRASE[lang].unknown)
          return 'qLen: "no way to tell" must never be the correct answer — the rule always decides';
        if (isCorrect && s === nums[2])
          return 'qLen: a 3-digit dividend over a 2-digit divisor can never give a 3-digit quotient';
        return null;
      }
      /* 「商 q，餘 r」的複合選項。 */
      if (genId === 'divFull'){
        const m = (lang === 'zh') ? /^商 (\d{1,3})，餘 (\d{1,3})$/.exec(s)
                                  : /^(\d{1,3}) remainder (\d{1,3})$/.exec(s);
        if (!m) return 'divFull option is not a quotient-and-remainder pair: ' + s;
        if (!(Number(m[1]) >= 1 && Number(m[1]) <= 999)) return 'divFull option quotient out of range: ' + s;
        if (!(Number(m[2]) >= 0 && Number(m[2]) <= 999)) return 'divFull option remainder out of range: ' + s;
        return null;
      }
      /* 商的一位數（0~9）。 */
      if (genId === 'tryFirst' || genId === 'quotDigit'){
        if (!/^[0-9]$/.test(s)) return genId + ' option is not a single digit: ' + s;
        return null;
      }
      /* 其餘都是純正整數。 */
      if (!/^[1-9]\d{0,4}$/.test(s)) return 'option is not a plain positive integer without leading zeros: "' + s + '"';
      const v = Number(s);
      if (!(v > 0 && v < 100000)) return 'option out of the lesson range: ' + s;
      return null;
    },

    /* 拿渲染出來的那一題再驗一次：題幹問對了嗎、解釋講對了嗎、英文的 1 對嗎、
       'big' 那一步有沒有把負餘數印出來。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      const plain = String(q.stem).replace(/<[^>]+>/g, '');
      const whyPlain = String(q.why).replace(/<[^>]+>/g, '');
      const all = plain + ' ' + whyPlain + ' ' + q.opts.join(' ');

      if (!q.stem || !plain.trim()) out.push('empty stem');
      if (!q.why || !whyPlain.trim()) out.push('empty explanation');
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');

      const ask = ASK[genId];
      if (!ask) out.push('no ASK entry for generator ' + genId + ' — the stem is unguarded');
      else {
        (ask[lang].must || []).forEach(w => {
          if (plain.indexOf(w) < 0) out.push('the stem must ask for "' + w + '" but says: ' + plain.slice(0, 90));
        });
        (ask[lang].never || []).forEach(w => {
          if (plain.indexOf(w) >= 0) out.push('the stem must not contain "' + w + '": ' + plain.slice(0, 90));
        });
      }

      const wm = WHY_MUST[genId];
      if (!wm) out.push('no WHY_MUST entry for generator ' + genId + ' — the explanation is unguarded');
      else {
        (wm[lang] || []).forEach(w => {
          if (whyPlain.indexOf(w) < 0)
            out.push('why must contain "' + w + '" but says: ' + whyPlain.slice(0, 100));
        });
      }

      /* ⚠️ 沒有任何一句話可以出現負數。'big'（乘不下去）那一步的餘數是負的，
         旁白只要把它算出來印一次就會現形（grade-4/decimal 的「剩下 -1」）。 */
      if (/[-−]\d/.test(all)) out.push('a negative number reached the screen: ' + all.slice(0, 120));

      /* 乘法：解釋裡一定要有「兩排加起來」那一條算式（從第二套實作算出來的）。 */
      if (genId === 'mulProduct' || genId === 'mulWord'){
        const r1 = mulRef(d.a, d.b % 10), r2v = mulRef(d.a, Math.floor(d.b / 10)) * 10;
        const total = mulRef(d.a, d.b);
        const plus = lang === 'zh' ? ' ＋ ' : ' + ';
        const eq = lang === 'zh' ? '＝' : '=';
        const line = r1 + plus + r2v + ' ' + eq + ' ' + total;
        if (whyPlain.indexOf(line) < 0)
          out.push('why must spell out the two rows adding up: "' + line + '"');
      }
      /* 除法：解釋一定要印出「商 q 餘 r」那一組數字（從第二套實作算出來的）。 */
      if (['divFull', 'divWord', 'needOneMore'].indexOf(genId) >= 0){
        const r = ldRef(d.N, d.d);
        const eq = lang === 'zh' ? '＝' : '=';
        const rem = lang === 'zh' ? ' 餘 ' : ' remainder ';
        const line = d.N + ' ÷ ' + d.d + ' ' + eq + ' ' + r.q + rem + r.rem;
        if (whyPlain.indexOf(line) < 0) out.push('why must spell out "' + line + '"');
      }

      /* 解釋裡的每一條算式都要算對（和題庫同一條規則）。 */
      arithProblems(whyPlain).forEach(bad2 => {
        out.push('the explanation states a false calculation: "' + bad2 + '"');
      });

      /* 英文的 1：只有這個值會錯，而且沒有任何數值檢查看得到。 */
      if (lang === 'en'){
        const badP = all.match(PLURAL_RE) || all.match(SINGULAR_RE);
        if (badP) out.push('English singular/plural is wrong near "' + badP[0] + '"');
        if (/[一-鿿]/.test(all)) out.push('Chinese leaked into the English rendering');
      }

      /* 選項兩兩不同「意思」。simgen 內建的 vkey 只正規化第一個數字，
         「商 10，餘 20」這種複合說法它比不出來，所以這裡再比一次。 */
      const keys = q.opts.map(o => {
        const s = String(o);
        const m = /^商 (\d+)，餘 (\d+)$/.exec(s) || /^(\d+) remainder (\d+)$/.exec(s);
        if (m) return 'q' + Number(m[1]) + 'r' + Number(m[2]);
        return /^\d+$/.test(s) ? ('v' + Number(s)) : ('s' + s);
      });
      for (let x = 0; x < keys.length; x++){
        for (let y = x + 1; y < keys.length; y++){
          if (keys[x] === keys[y]) out.push('two options mean the same thing: ' + q.opts[x] + ' / ' + q.opts[y]);
        }
      }

      /* 有圖的題目：圖必須真的在，而且答案不可以印在圖上。 */
      if (q.fig){
        if (genId !== 'quotDigit') out.push('only quotDigit should carry a figure, but ' + genId + ' does');
        const answerText = q.opts[q.ans];
        q.fig.labels.forEach(l => {
          if (l.text !== undefined && String(l.text) === answerText)
            out.push('the answer ' + answerText + ' is printed on the picture');
        });
        /* 份數編號畫上去的話，孩子用數的就好，題目就白出了。 */
        if (q.fig.labels.some(l => l.kind === 'index'))
          out.push('the figure numbers the shares, which gives the answer away');
      } else if (genId === 'quotDigit'){
        out.push('quotDigit rendered without its figure');
      }

      return out.length ? out.join(' | ') : null;
    },

    /* 刻意的迷思誘答：幾支產生器的誘答剛好是題幹裡的那個數字。
       ⚠️ 白名單是「這一個值」的謂詞，不是整個產生器全開 ——
       整支開掉的話，不小心把題幹別的數字抄回來也會被一起蓋掉。 */
    stemEchoOk: {
      /* 「只寫了一排」：第一排或第二排剛好等於題幹印出來的數字。 */
      mulRow1: function(d, opt){
        return String(opt) === String(mulRef(d.a, Math.floor(d.b / 10))) ||
               String(opt) === String(mulRef(d.a, d.b));
      },
      mulRow2: function(d, opt){
        return String(opt) === String(mulRef(d.a, Math.floor(d.b / 10))) ||
               String(opt) === String(mulRef(d.a, d.b % 10));
      },
      /* 「把餘數當答案」是這一課明講的迷思（divWord 問的是裝滿幾包）。 */
      divWord: function(d, opt){
        return String(opt) === String(ldRef(d.N, d.d).rem);
      },
      needOneMore: function(d, opt){
        const r = ldRef(d.N, d.d);
        return String(opt) === String(r.rem) || String(opt) === String(r.q);
      },
      /* 「忘記加餘數」＝ 除數 × 商，會撞到題幹的數字時放行。 */
      verifyBack: function(d, opt){
        return String(opt) === String(d.d * d.q);
      }
    }
  },

  /* ================= index.html 的範例、遊戲與題庫 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{isInt, digitsOf, roundTen, padCells, mulPlan, mulColSteps, splitPlan, ' +
                'startPlan, tryPlan, ldPlan, ldRows, chunkPlan, lotsEn, digitsEn, ' +
                'MUL_CASES, START_CASES, TRY_CASES, ADJ_CASES, LD_CASES, ROUNDS, roundAnswer, ' +
                'MUL_A_MIN, MUL_A_MAX, MUL_B_MIN, MUL_B_MAX, DIV_N_MIN, DIV_N_MAX, ' +
                'DIV_D_MIN, DIV_D_MAX, Q_MAX, ' +
                'CH_W, CH_H, CH_X0, CH_X1, CH_Y, CH_BARH, CH_FONT, CH_IDX_FONT, ' +
                'CH_TITLE_DY, CH_IDX_DY, CH_LAB_DY, CH_REM_DY, CH_EDGE_PAD}',
    optionValueMax: 98901,          /* 999 × 99 —— 這一課算得出來的最大值 */

    check: function(data, I18N, fail, src){
      const {
        isInt, digitsOf, roundTen, padCells, mulPlan, mulColSteps, splitPlan,
        startPlan, tryPlan, ldPlan, ldRows, chunkPlan,
        MUL_CASES, START_CASES, TRY_CASES, ADJ_CASES, LD_CASES, ROUNDS, roundAnswer,
        MUL_A_MIN, MUL_A_MAX, MUL_B_MIN, MUL_B_MAX, DIV_N_MIN, DIV_N_MAX,
        DIV_D_MIN, DIV_D_MAX, Q_MAX,
        CH_W, CH_H, CH_X0, CH_X1, CH_Y, CH_BARH, CH_FONT, CH_IDX_FONT,
        CH_TITLE_DY, CH_IDX_DY, CH_LAB_DY, CH_REM_DY, CH_EDGE_PAD
      } = data;

      const int = x => Number.isInteger(x);
      /* ⚠️ 每一個要拿去比較的座標都要先確認是有限的數字。
         undefined < 0 和 undefined > W 都是 false，所以少一個欄位的話
         下面每一條邊界斷言都會靜靜通過，畫面卻印出 x="undefined"。 */
      const fin = v => typeof v === 'number' && isFinite(v);

      /* ---------- 0. 範圍常數本身 ---------- */
      if (MUL_A_MIN !== 100 || MUL_A_MAX !== 999) fail('RANGE: the multiplicand is meant to be a three-digit number');
      if (MUL_B_MIN !== 10 || MUL_B_MAX !== 99) fail('RANGE: the multiplier is meant to be a two-digit number');
      if (DIV_N_MIN !== 100 || DIV_N_MAX !== 999) fail('RANGE: the dividend is meant to be a three-digit number');
      if (DIV_D_MIN < 11 || DIV_D_MAX !== 99) fail('RANGE: the divisor is meant to be a two-digit number above 10');
      if (Q_MAX !== 9) fail('RANGE: one quotient digit can never be more than 9');

      /* ---------- 1. 四捨五入到十位：對每一個二位數都比一次 ---------- */
      for (let n = 10; n <= 99; n++){
        if (roundTen(n) !== roundTenRef(n))
          fail('ROUNDTEN: roundTen(' + n + ') is ' + roundTen(n) + ', but looking at the ones digit gives ' + roundTenRef(n));
      }
      if (roundTen(15) !== 20) fail('ROUNDTEN: exactly halfway must round up (15 to 20), matching grade-4/rounding');
      if (roundTen(14) !== 10) fail('ROUNDTEN: 14 must round down to 10');
      if (roundTen(95) !== 100) fail('ROUNDTEN: 95 rounds to 100, which the lesson says is still an easy number to guess with');

      /* ---------- 2. padCells：放不下就要大聲壞掉，不可以截斷 ---------- */
      if (padCells(123, 4, 0) === null) fail('PAD: padCells refused a value that fits');
      if (padCells(1234, 3, 0) !== null) fail('PAD: padCells must return null when the number does not fit, not truncate it');
      if (padCells(123, 4, 2) !== null) fail('PAD: padCells must count the shift when deciding whether it fits');
      {
        const c = padCells(45, 4, 1);
        if (!c || c.join('|') !== '|4|5|') fail('PAD: padCells put the digits in the wrong columns: ' + (c ? c.join('|') : 'null'));
      }

      /* ---------- 3. 乘法：對整個定義域窮舉（900 × 90 ＝ 81000 組） ---------- */
      let mulChecked = 0, mulBad = false;
      for (let a = MUL_A_MIN; a <= MUL_A_MAX && !mulBad; a++){
        for (let b = MUL_B_MIN; b <= MUL_B_MAX; b++){
          const mp = mulPlan(a, b);
          if (mp.total !== mulRef(a, b)){
            fail('MUL: ' + a + ' × ' + b + ' is ' + mp.total + ' but the digit convolution gives ' + mulRef(a, b));
            mulBad = true; break;
          }
          if (mp.r1 !== mulRef(a, b % 10)){ fail('MUL: the first row of ' + a + ' × ' + b + ' is wrong'); mulBad = true; break; }
          if (mp.r2value !== mulRef(a, Math.floor(b / 10)) * 10){ fail('MUL: the second row value of ' + a + ' × ' + b + ' is wrong'); mulBad = true; break; }
          if (mp.r1 + mp.r2value !== mp.total){ fail('MUL: the two rows do not add up to the product for ' + a + ' × ' + b); mulBad = true; break; }
          /* 版面：三列都要放得進 width，第二排還要多空一格。 */
          if (padCells(mp.r1, mp.width, 0) === null){ fail('MULWIDTH: the first row does not fit for ' + a + ' × ' + b); mulBad = true; break; }
          if (padCells(mp.r2, mp.width, 1) === null){ fail('MULWIDTH: the shifted second row does not fit for ' + a + ' × ' + b + ' — the shift was not counted'); mulBad = true; break; }
          if (padCells(mp.total, mp.width, 0) === null){ fail('MULWIDTH: the product does not fit for ' + a + ' × ' + b); mulBad = true; break; }
          mulChecked++;
        }
      }
      if (!mulBad && mulChecked !== 900 * 90) fail('MUL: the sweep did not cover the whole domain, only ' + mulChecked + ' pairs');

      /* 逐欄的乘法步驟：把**頁面自己的** mulColSteps 跑起來，重組回乘積。
         ⚠️ 不可以在這裡重寫一份 —— 那樣改壞頁面的算法不會響。 */
      let colBad = false;
      for (let a = MUL_A_MIN; a <= MUL_A_MAX && !colBad; a += 7){
        for (let m = 0; m <= 9; m++){
          const steps = mulColSteps(a, m);
          if (!Array.isArray(steps) || !steps.length){ fail('MULCOL: no steps for ' + a + ' × ' + m); colBad = true; break; }
          /* ⚠️ steps 現在是**教學順序**（個位 → 十位 → 百位 → 剩下的進位），
             所以要倒著讀才是這個數字本身。順手把順序也釘住：pos 必須遞增。 */
          let rebuilt = '';
          for (let si = 0; si < steps.length; si++){
            if (si > 0 && !(steps[si].pos > steps[si - 1].pos)){
              fail('MULCOL: the steps are not in teaching order (ones first, then leftwards) for ' + a + ' × ' + m);
              colBad = true; break;
            }
          }
          if (colBad) break;
          for (const st of steps.slice().reverse()){
            if (!int(st.write) || st.write < 0 || st.write > 9){ fail('MULCOL: a column wrote a non-digit for ' + a + ' × ' + m); colBad = true; break; }
            if (!int(st.carryOut) || st.carryOut < 0 || st.carryOut > 8){
              fail('MULCOL: the carry out of a column is ' + st.carryOut + ' for ' + a + ' × ' + m + ' — a multiplication carry is 0..8');
              colBad = true; break;
            }
            if (!st.final && st.prod !== st.digit * st.m + st.carryIn){
              fail('MULCOL: the narrated product is not digit × multiplier + carry for ' + a + ' × ' + m);
              colBad = true; break;
            }
            rebuilt += String(st.write);
          }
          if (colBad) break;
          if (Number(rebuilt) !== mulRef(a, m)){
            fail('MULCOL: walking the columns of ' + a + ' × ' + m + ' rebuilds ' + Number(rebuilt) + ', not ' + mulRef(a, m));
            colBad = true; break;
          }
          /* final 那一筆是最左邊的進位，而且必須是**最後**一步；
             它帶進來的數要等於它右邊那一欄送出去的進位。 */
          const last = steps[steps.length - 1];
          if (steps.some((x, xi) => x.final && xi !== steps.length - 1)){
            fail('MULCOL: the leading carry is not the last step for ' + a + ' × ' + m);
            colBad = true; break;
          }
          if (last.final && steps.length > 1 && last.carryIn !== steps[steps.length - 2].carryOut){
            fail('MULCOL: the leading carry does not match the carry out of the column to its right');
            colBad = true; break;
          }
        }
      }

      /* 拆成六格：兩欄的和必須剛好是直式的兩排。 */
      let spBad = false;
      for (let a = MUL_A_MIN; a <= MUL_A_MAX && !spBad; a += 11){
        for (let b = MUL_B_MIN; b <= MUL_B_MAX; b += 3){
          const sp = splitPlan(a, b), mp = mulPlan(a, b);
          if (sp.rows.length !== 3){ fail('SPLIT: a three-digit multiplicand must split into three parts'); spBad = true; break; }
          if (sp.cols.length !== 2){ fail('SPLIT: a two-digit multiplier must split into two parts'); spBad = true; break; }
          if (sp.rows.reduce((x, y) => x + y, 0) !== a){ fail('SPLIT: the three parts do not add back to ' + a); spBad = true; break; }
          if (sp.cols[0] + sp.cols[1] !== b){ fail('SPLIT: the two parts do not add back to ' + b); spBad = true; break; }
          if (sp.colSums[0] !== mp.r1){ fail('SPLIT: the ones column does not add up to the first row for ' + a + ' × ' + b); spBad = true; break; }
          if (sp.colSums[1] !== mp.r2value){ fail('SPLIT: the tens column does not add up to the second row value for ' + a + ' × ' + b); spBad = true; break; }
          if (sp.total !== sp.colSums[0] + sp.colSums[1]){ fail('SPLIT: the six boxes do not add up to the total'); spBad = true; break; }
          if (sp.total !== mulRef(a, b)){ fail('SPLIT: the total is wrong for ' + a + ' × ' + b); spBad = true; break; }
        }
      }

      /* ---------- 4. 除法：對整個定義域窮舉（89 × 900 ＝ 80100 組） ---------- */
      /* 順便統計：課程說「調商可能要調不只一次」「兩個方向都要會調」
         「猜出來可能超過 9」「商那一位可能是 0」—— 那四句話都要真的發生過，
         不然它們只是文案。 */
      let sawUp = 0, sawDown = 0, sawMulti = 0, sawClamp = 0, sawZeroDigit = 0;
      let divChecked = 0, divBad = false;
      for (let d = DIV_D_MIN; d <= DIV_D_MAX && !divBad; d++){
        for (let N = DIV_N_MIN; N <= DIV_N_MAX; N++){
          const p = ldPlan(N, d), r = ldRef(N, d);
          if (p.q !== r.q){ fail('DIV: ' + N + ' ÷ ' + d + ' gives ' + p.q + ' but repeated subtraction gives ' + r.q); divBad = true; break; }
          if (p.rem !== r.rem){ fail('DIV: the remainder of ' + N + ' ÷ ' + d + ' is ' + p.rem + ' but repeated subtraction gives ' + r.rem); divBad = true; break; }
          if (!(p.rem >= 0 && p.rem < d)){ fail('DIV: the remainder of ' + N + ' ÷ ' + d + ' is not smaller than the divisor'); divBad = true; break; }
          if (p.backCheck !== N){ fail('DIV: divisor × quotient + remainder does not rebuild ' + N); divBad = true; break; }
          const sp = startPlan(N, d), sr = startRef(N, d);
          if (sp.startCol !== sr.startCol){ fail('START: ' + N + ' ÷ ' + d + ' starts at column ' + sp.startCol + ' but the prefix scan says ' + sr.startCol); divBad = true; break; }
          if (sp.qLen !== sr.qLen){ fail('START: the quotient length of ' + N + ' ÷ ' + d + ' is wrong'); divBad = true; break; }
          if (sp.qLen !== p.steps.length){ fail('START: the quotient length does not match the number of rounds for ' + N + ' ÷ ' + d); divBad = true; break; }
          if (String(p.q).length !== sp.qLen){ fail('START: the quotient ' + p.q + ' does not have ' + sp.qLen + ' digits'); divBad = true; break; }
          /* 除數有兩位，所以被除數的第一位一定不夠除 —— 課程對讀者這樣講。 */
          if (sp.rows[0].ok){ fail('START: the first digit of ' + N + ' was enough for divisor ' + d + ', which the lesson says is impossible'); divBad = true; break; }
          if (sp.rows.length < 2){ fail('START: the scan stopped before looking at two digits'); divBad = true; break; }
          for (const row of sp.rows){
            const wantCmp = row.cur === d ? 0 : (row.cur > d ? 1 : -1);
            if (row.cmp !== wantCmp){ fail('START: the comparison flag is wrong for ' + row.cur + ' against ' + d); divBad = true; break; }
            if (row.ok !== (row.cur >= d)){ fail('START: "will go" disagrees with the numbers for ' + row.cur + ' against ' + d); divBad = true; break; }
          }
          if (divBad) break;
          for (let k = 0; k < p.steps.length; k++){
            const st = p.steps[k];
            if (!(st.cur < 10 * d)){ fail('DIV: the number being shared out (' + st.cur + ') is not below ten times the divisor, so the quotient digit could exceed 9'); divBad = true; break; }
            if (!(st.q >= 0 && st.q <= Q_MAX)){ fail('DIV: quotient digit out of range for ' + N + ' ÷ ' + d); divBad = true; break; }
            if (k === 0 && st.q === 0){ fail('DIV: the leading quotient digit must never be 0 for ' + N + ' ÷ ' + d); divBad = true; break; }
            if (st.q !== r.rounds[k].q){ fail('DIV: round ' + (k + 1) + ' of ' + N + ' ÷ ' + d + ' disagrees with repeated subtraction'); divBad = true; break; }
            if (st.q === 0) sawZeroDigit++;
            const tp = st.tp;
            if (!tp){ fail('DIV: the round did not keep its trial-quotient trail'); divBad = true; break; }
            if (tp.rt !== roundTenRef(d)){ fail('TRY: the divisor was not rounded to the nearest ten'); divBad = true; break; }
            if (tp.guess !== Math.min(Q_MAX, Math.floor(st.cur / tp.rt))){ fail('TRY: the first guess is not the rounded divisor divided into the number'); divBad = true; break; }
            if (tp.clamped !== (tp.guessRaw > Q_MAX)){ fail('TRY: the "guess above 9" flag disagrees with the guess'); divBad = true; break; }
            if (!tp.tries.length){ fail('TRY: no trial trail recorded'); divBad = true; break; }
            const last = tp.tries[tp.tries.length - 1];
            if (last.verdict !== 'ok'){ fail('TRY: the trial trail does not end on a correct digit for ' + st.cur + ' ÷ ' + d); divBad = true; break; }
            if (last.q !== st.q){ fail('TRY: the last trial does not equal the quotient digit'); divBad = true; break; }
            for (let i = 0; i < tp.tries.length; i++){
              const t = tp.tries[i];
              if (t.verdict === 'big'){
                /* ⚠️ 這一步的餘數是負的 —— 資料層必須是 null，旁白才不可能印出它。 */
                if (t.rem !== null){ fail('TRY: a "will not go" trial carries a remainder (' + t.rem + '), which is negative and must never reach the screen'); divBad = true; break; }
                if (!(t.prod > st.cur)){ fail('TRY: a trial is marked "too big" but the product does not go over'); divBad = true; break; }
              } else if (t.verdict === 'small'){
                if (!(t.rem >= d)){ fail('TRY: a trial is marked "too small" but the remainder is already below the divisor'); divBad = true; break; }
                if (t.prod > st.cur){ fail('TRY: a trial is marked "too small" but the product goes over'); divBad = true; break; }
              } else if (t.verdict === 'ok'){
                if (t.prod > st.cur || !(t.rem >= 0 && t.rem < d)){ fail('TRY: a trial is marked correct but fails one of the two checks'); divBad = true; break; }
                if (i !== tp.tries.length - 1){ fail('TRY: a correct trial is not the last one'); divBad = true; break; }
              } else { fail('TRY: unknown verdict ' + t.verdict); divBad = true; break; }
              if (!(t.q >= 0 && t.q <= 9)){ fail('TRY: a trial digit is outside 0..9'); divBad = true; break; }
            }
            if (divBad) break;
            if (tp.adjust > 0) sawUp++;
            if (tp.adjust < 0) sawDown++;
            if (tp.tries.length > 2) sawMulti++;
            if (tp.clamped) sawClamp++;
          }
          if (divBad) break;
          divChecked++;
        }
      }
      if (!divBad && divChecked !== (DIV_D_MAX - DIV_D_MIN + 1) * 900)
        fail('DIV: the sweep did not cover the whole domain, only ' + divChecked + ' pairs');
      /* 課程明講的五句話都要有實例撐著。 */
      if (!sawUp) fail('CLAIM: the lesson says a guess can come out too small, but no case in the whole domain adjusts upwards');
      if (!sawDown) fail('CLAIM: the lesson says a guess can come out too big, but no case in the whole domain adjusts downwards');
      if (!sawMulti) fail('CLAIM: the lesson says it may take more than one adjustment, but no case in the whole domain needs two');
      if (!sawClamp) fail('CLAIM: the lesson says the guess can come out above 9, but that never happens in the whole domain');
      if (!sawZeroDigit) fail('CLAIM: the lesson says a quotient place can be 0, but that never happens in the whole domain');

      /* ---------- 5. 直式除法的排版列 ---------- */
      for (let d = DIV_D_MIN; d <= DIV_D_MAX; d += 3){
        for (let N = DIV_N_MIN; N <= DIV_N_MAX; N += 7){
          const p = ldPlan(N, d), rows = ldRows(p), w = p.ds.length;
          let diffs = 0, prods = 0, nullRow = false;
          rows.forEach(r2 => {
            if (r2.cells === null){ nullRow = true; return; }
            if (r2.cells.length !== w) fail('LDROWS: a row has ' + r2.cells.length + ' columns, expected ' + w);
            if (r2.kind === 'prod') prods++;
            if (r2.kind === 'diff') diffs++;
            if (r2.kind === 'rule' && !(r2.from >= 0 && r2.to < w && r2.from <= r2.to))
              fail('LDROWS: the subtraction line spans columns ' + r2.from + '..' + r2.to + ', outside the table');
          });
          if (nullRow){ fail('LDROWS: a row could not be laid out for ' + N + ' ÷ ' + d + ' (padCells returned null)'); continue; }
          /* 商是 0 的那一輪不畫乘與減。 */
          const nonZero = p.steps.filter(s => s.q > 0).length;
          if (prods !== nonZero) fail('LDROWS: ' + prods + ' product rows for ' + nonZero + ' non-zero quotient digits in ' + N + ' ÷ ' + d);
          if (diffs !== nonZero) fail('LDROWS: ' + diffs + ' difference rows for ' + nonZero + ' non-zero quotient digits in ' + N + ' ÷ ' + d);
          const quot = rows.filter(r2 => r2.kind === 'quot');
          if (quot.length !== 1) fail('LDROWS: expected exactly one quotient row');
          else {
            p.steps.forEach(st => {
              if (quot[0].cells[st.col] !== String(st.q))
                fail('LDROWS: the quotient digit for column ' + st.col + ' is not written above it in ' + N + ' ÷ ' + d);
            });
            const written = quot[0].cells.join('');
            if (written !== String(p.q))
              fail('LDROWS: the quotient row reads "' + written + '" but the quotient is ' + p.q);
          }
          const lastDiff = rows.filter(r2 => r2.kind === 'diff').pop();
          if (!lastDiff || !lastDiff.last) fail('LDROWS: no row is marked as carrying the remainder for ' + N + ' ÷ ' + d);
          else if (lastDiff.value !== p.rem)
            fail('LDROWS: the last difference is ' + lastDiff.value + ' but the remainder is ' + p.rem + ' for ' + N + ' ÷ ' + d);
        }
      }

      /* ---------- 6. 長條圖：四個方向都驗 ---------- */
      if (!(CH_W === 520 && CH_H === 170)) fail('GEOM: the chunk canvas is not the size the CSS and viewBox declare');
      if (!(CH_X0 > 0 && CH_X1 < CH_W)) fail('GEOM: the bar runs off the canvas horizontally');
      if (!(CH_Y + CH_TITLE_DY - CH_FONT > 0)) fail('GEOM: the title is drawn above the canvas');
      if (!(CH_Y + CH_BARH + CH_REM_DY + 4 < CH_H)) fail('GEOM: the remainder label falls below the canvas');
      if (!(CH_REM_DY - CH_LAB_DY >= 16)) fail('GEOM: the "q lots of d" label and the remainder label share a row, so they can overlap');
      if (!(CH_IDX_DY > 0 && CH_IDX_DY < CH_BARH)) fail('GEOM: the share numbers are not inside the bar');
      if (!(CH_EDGE_PAD > 0)) fail('GEOM: the labels are allowed to touch the canvas edge');

      /* 對每一組合法的 (cur, d) 窮舉一次 —— 參數空間有界，不抽樣。 */
      let barChecked = 0, minCell = Infinity, barBad = false;
      for (let d = DIV_D_MIN; d <= DIV_D_MAX && !barBad; d++){
        for (let cur = d; cur < 10 * d; cur++){
          const tp = tryPlan(cur, d);
          const cp = chunkPlan(cur, d, tp.q, tp.rem);
          let nf = null;
          ['x0', 'x1', 'y', 'h', 'edge', 'remW', 'labX', 'labY', 'remX', 'remY', 'idxY', 'titleX', 'titleY']
            .forEach(k => { if (!fin(cp[k]) && nf === null) nf = k; });
          if (nf !== null){ fail('GEOM: chunkPlan.' + nf + ' is not a finite number: ' + cp[nf]); barBad = true; break; }
          if (cp.chunks.length !== tp.q){ fail('GEOM: ' + cp.chunks.length + ' shares drawn for a quotient digit of ' + tp.q); barBad = true; break; }
          for (let i = 0; i < cp.chunks.length; i++){
            const ck = cp.chunks[i];
            if (!(fin(ck.x) && fin(ck.w) && fin(ck.cx))){ fail('GEOM: a share has a non-finite coordinate'); barBad = true; break; }
            if (ck.x < CH_X0 - 0.01){ fail('GEOM: a share starts left of the bar'); barBad = true; break; }
            if (ck.x + ck.w > CH_X1 + 0.01){ fail('GEOM: a share runs past the right end of the bar for ' + cur + ' ÷ ' + d); barBad = true; break; }
            if (i > 0 && !(ck.x > cp.chunks[i - 1].x)){ fail('GEOM: the shares are not in left-to-right order'); barBad = true; break; }
            minCell = Math.min(minCell, ck.w);
            /* 編號要放得進那一份裡面。 */
            if (ck.w < estTextW(String(ck.i), CH_IDX_FONT)){ fail('GEOM: share ' + ck.i + ' is narrower than the number printed inside it'); barBad = true; break; }
          }
          if (barBad) break;
          if (cp.edge > CH_X1 + 0.01){ fail('GEOM: the shares end past the right of the bar'); barBad = true; break; }
          if (tp.rem === 0 && Math.abs(cp.edge - CH_X1) > 0.01){ fail('GEOM: nothing is left over, so the shares must reach the right end (' + cur + ' ÷ ' + d + ')'); barBad = true; break; }
          if (tp.rem > 0 && !(cp.remW > 0)){ fail('GEOM: something is left over but the remainder segment has no width'); barBad = true; break; }
          if (cp.remW < 0){ fail('GEOM: the remainder segment has a negative width'); barBad = true; break; }
          if (cp.labX < CH_X0 || cp.labX > CH_X1){ fail('GEOM: the "q lots of d" label sits outside the bar'); barBad = true; break; }
          if (cp.remX > CH_W || cp.remX < 0){ fail('GEOM: the remainder label sits outside the canvas'); barBad = true; break; }
          /* ⚠️ 只驗錨點等於沒驗：靠右對齊的 "remainder 98" 錨在 x=519 也「在畫布內」，
             可是整串字都被切掉了。要把**字真正佔多寬**和 text-anchor 一起算進去
             （codex 第一輪）。兩種語言各算一次。 */
          for (const LG of ['zh', 'en']){
            const dd = I18N[LG];
            const labTxt = dd.s4lab(tp.q, d);
            const labW = estTextW(labTxt, CH_FONT);
            if (cp.labX - labW / 2 < 0 || cp.labX + labW / 2 > CH_W){
              fail('GEOM: the ' + LG + ' label "' + labTxt + '" is clipped by the canvas edge');
              barBad = true; break;
            }
            const remTxt = (tp.rem === 0) ? dd.s4exact : dd.s4rem(tp.rem);
            const remW = estTextW(remTxt, CH_FONT);
            /* 餘數的標籤是 text-anchor="end"，所以它往**左**長出去。 */
            if (cp.remX - remW < 0 || cp.remX > CH_W){
              fail('GEOM: the ' + LG + ' remainder label "' + remTxt + '" is clipped by the canvas edge');
              barBad = true; break;
            }
          }
          if (barBad) break;
          if (cp.titleY < CH_FONT){ fail('GEOM: the title is clipped at the top'); barBad = true; break; }
          if (cp.remY > CH_H - 4){ fail('GEOM: the remainder label is clipped at the bottom'); barBad = true; break; }
          barChecked++;
        }
      }
      if (!barBad){
        if (!(minCell >= (CH_X1 - CH_X0) / 10 - 0.01))
          fail('GEOM: the narrowest share is ' + minCell.toFixed(2) + 'px, thinner than a tenth of the bar');
        if (barChecked < 89 * 9) fail('GEOM: the chunk sweep did not cover the whole domain, only ' + barChecked + ' cases');
      }

      /* SVG 的 viewBox 與 CSS 高度要跟著版面常數走。 */
      if (src.indexOf('viewBox="0 0 ' + CH_W + ' ' + CH_H + '"') < 0)
        fail('GEOM: no SVG declares the viewBox the layout constants describe (0 0 ' + CH_W + ' ' + CH_H + ')');
      if (src.indexOf('.scene.chunkfig{height:' + CH_H + 'px}') < 0)
        fail('GEOM: the CSS height of .scene.chunkfig does not match CH_H (' + CH_H + ')');

      /* ---------- 7. 範例的樣本要真的涵蓋它們宣稱的情形 ---------- */
      if (MUL_CASES.length !== 4) fail('MUL_CASES: expected 4 worked multiplications');
      MUL_CASES.forEach((c, i) => {
        if (!(c.a >= MUL_A_MIN && c.a <= MUL_A_MAX)) fail('MUL_CASES[' + i + ']: the multiplicand is not a three-digit number');
        if (!(c.b >= MUL_B_MIN && c.b <= MUL_B_MAX)) fail('MUL_CASES[' + i + ']: the multiplier is not a two-digit number');
        if (c.b % 10 === 0) fail('MUL_CASES[' + i + ']: the multiplier ends in 0, which all four pages promise never happens');
      });
      if (!MUL_CASES.some(c => String(c.a).indexOf('0') >= 0))
        fail('MUL_CASES: no sample has a 0 inside the multiplicand, so the "0 × m plus the carry" column is never shown');
      if (!MUL_CASES.some(c => mulColSteps(c.a, c.b % 10).some(s => s.carryOut > 1)))
        fail('MUL_CASES: no sample ever carries more than 1, so the "a multiplication carry is not always 1" note has no example');

      if (START_CASES.length !== 4) fail('START_CASES: expected 4 samples');
      {
        const lens = START_CASES.map(c => startRef(c.N, c.d).qLen);
        if (lens.indexOf(1) < 0) fail('START_CASES: no sample gives a one-digit quotient');
        if (lens.indexOf(2) < 0) fail('START_CASES: no sample gives a two-digit quotient');
        START_CASES.forEach((c, i) => {
          if (!(c.N >= DIV_N_MIN && c.N <= DIV_N_MAX)) fail('START_CASES[' + i + ']: the dividend is not a three-digit number');
          if (!(c.d >= DIV_D_MIN && c.d <= DIV_D_MAX)) fail('START_CASES[' + i + ']: the divisor is out of range');
        });
      }

      if (TRY_CASES.length !== 4) fail('TRY_CASES: expected 4 samples');
      {
        const plans = TRY_CASES.map(c => tryPlan(c.cur, c.d));
        TRY_CASES.forEach((c, i) => {
          if (!(c.cur >= c.d && c.cur < 10 * c.d))
            fail('TRY_CASES[' + i + ']: the number being shared out must sit between the divisor and ten times it');
        });
        if (!plans.some(p => p.adjust === 0)) fail('TRY_CASES: no sample guesses right first time');
        if (!plans.some(p => p.adjust > 0)) fail('TRY_CASES: no sample has to adjust upwards');
        if (!plans.some(p => p.adjust < 0)) fail('TRY_CASES: no sample has to adjust downwards');
        if (!plans.some(p => p.clamped)) fail('TRY_CASES: no sample guesses above 9, so the "try 9 first" rule has no example');
        /* 餘數剛好等於除數，正是「不小於」那個措辭存在的理由。 */
        if (!plans.some(p => p.tries.some(t => t.verdict === 'small' && t.rem === p.d)))
          fail('TRY_CASES: no sample has a remainder exactly equal to the divisor, which is the boundary the "not smaller than" wording exists for');
      }

      if (ADJ_CASES.length !== 4) fail('ADJ_CASES: expected 4 samples');
      {
        const plans = ADJ_CASES.map(c => tryPlan(c.cur, c.d));
        ADJ_CASES.forEach((c, i) => {
          if (!(c.cur >= c.d && c.cur < 10 * c.d))
            fail('ADJ_CASES[' + i + ']: the number being shared out must sit between the divisor and ten times it');
        });
        if (!plans.some(p => p.adjust >= 2)) fail('ADJ_CASES: no sample needs two upward adjustments, so "it may take more than one" has no example');
        if (!plans.some(p => p.adjust <= -2)) fail('ADJ_CASES: no sample needs two downward adjustments');
        if (!plans.some(p => p.rem === 0)) fail('ADJ_CASES: no sample comes out exact');
      }

      if (LD_CASES.length !== 4) fail('LD_CASES: expected 4 worked divisions');
      {
        const plans = LD_CASES.map(c => ldPlan(c.N, c.d));
        LD_CASES.forEach((c, i) => {
          if (!(c.N >= DIV_N_MIN && c.N <= DIV_N_MAX)) fail('LD_CASES[' + i + ']: the dividend is not a three-digit number');
          if (!(c.d >= DIV_D_MIN && c.d <= DIV_D_MAX)) fail('LD_CASES[' + i + ']: the divisor is out of range');
        });
        if (!plans.some(p => p.qDigits.length === 1)) fail('LD_CASES: no sample has a one-digit quotient');
        if (!plans.some(p => p.qDigits.length === 2)) fail('LD_CASES: no sample has a two-digit quotient');
        if (!plans.some(p => p.qDigits.indexOf(0) >= 0))
          fail('LD_CASES: no sample has a 0 in the quotient, so the "that place gets a 0" rule has no worked example');
        if (!plans.some(p => p.rem === 0)) fail('LD_CASES: no sample divides exactly');
        if (!plans.some(p => p.rem > 0)) fail('LD_CASES: no sample leaves a remainder');
        if (!plans.some(p => p.steps.some(s => s.tp.tries.length > 2)))
          fail('LD_CASES: no worked example ever needs two adjustments');
        if (!plans.some(p => p.steps.some(s => s.tp.clamped)))
          fail('LD_CASES: no worked example ever guesses above 9');
      }

      /* ---------- 8. 遊戲關卡 ---------- */
      if (ROUNDS.length !== 5) fail('ROUNDS: expected 5 rounds');
      {
        const kinds = ROUNDS.map(r => r.kind);
        ['mulTotal', 'mulRow2', 'qLen', 'tryDigit', 'full'].forEach(k => {
          if (kinds.indexOf(k) < 0) fail('ROUNDS: no round of kind ' + k);
        });
        const answers = [];
        ROUNDS.forEach((r, i) => {
          if (r.opts.length !== 4) fail('ROUNDS[' + i + ']: expected 4 options');
          if (new Set(r.opts).size !== r.opts.length) fail('ROUNDS[' + i + ']: duplicate options');
          if (!(r.ans >= 0 && r.ans < r.opts.length)) fail('ROUNDS[' + i + ']: answer index out of range');
          const got = roundAnswer(r);
          if (r.opts[r.ans] !== got)
            fail('ROUNDS[' + i + ']: opts[ans] is "' + r.opts[r.ans] + '" but roundAnswer() says "' + got + '"');
          /* 第二套實作再算一次同一個答案。 */
          let want = null;
          if (r.kind === 'mulTotal') want = String(mulRef(r.a, r.b));
          else if (r.kind === 'mulRow2') want = String(mulRef(r.a, Math.floor(r.b / 10)) * 10);
          else if (r.kind === 'qLen') want = String(startRef(r.N, r.d).qLen);
          else if (r.kind === 'tryDigit') want = String(quotDigitRef(r.cur, r.d).q);
          else if (r.kind === 'full'){ const x = ldRef(r.N, r.d); want = x.q + 'r' + x.rem; }
          if (want !== null && got !== want)
            fail('ROUNDS[' + i + ']: roundAnswer() gives "' + got + '" but the second implementation gives "' + want + '"');
          /* ⚠️ 只驗算術的話，把一關整組換成 213 × 20 每一條都還是綠的 ——
             可是這一課明講乘數的個位不是 0。每一關都要套範圍。 */
          if (r.kind === 'mulTotal' || r.kind === 'mulRow2'){
            const bad = mulInv({ a:r.a, b:r.b }, 'ROUNDS[' + i + ']');
            if (bad) fail('ROUNDS: ' + bad);
          }
          if (r.kind === 'qLen' || r.kind === 'full'){
            const bad = divInv({ N:r.N, d:r.d }, 'ROUNDS[' + i + ']');
            if (bad) fail('ROUNDS: ' + bad);
          }
          if (r.kind === 'tryDigit'){
            const bad = roundInv({ cur:r.cur, d:r.d }, 'ROUNDS[' + i + ']');
            if (bad) fail('ROUNDS: ' + bad);
          }
          answers.push(r.ans);
        });
        if (new Set(answers).size < 2) fail('ROUNDS: every round has its answer in the same slot');
      }

      /* ---------- 9. 題庫的神諭 ---------- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const exp = BANK_EXPECTED[bank];
        const zh = I18N.zh[bank], en = I18N.en[bank];
        if (!exp){ fail('BANK: no oracle for ' + bank); return; }
        if (zh.length !== exp.length) fail('BANK: ' + bank + ' has ' + zh.length + ' questions but the oracle lists ' + exp.length);
        exp.forEach((e, i) => {
          [['zh', zh[i]], ['en', en[i]]].forEach(pair => {
            const L = pair[0], q = pair[1];
            if (!q){ fail('BANK: ' + bank + '[' + i + '] missing in ' + L); return; }
            if (q.ans !== e.ans) fail('BANK: ' + bank + '[' + i + '] ' + L + ' answer index is ' + q.ans + ', expected ' + e.ans);
            const stemPlain = String(q.stem).replace(/<[^>]+>/g, '');
            /* 題幹裡一定要出現的數字（改掉題幹的數字，下面重算的正解就會對不上）。 */
            (e.nums || []).forEach(n => {
              if (stemPlain.indexOf(n) < 0)
                fail('BANK: ' + bank + '[' + i + '] ' + L + ' stem no longer contains the number ' + n);
            });
            /* ⚠️ 「有出現」擋不住**多出來**的東西：把題幹改成
               `213 × 24 ＋ 1 ＝ ？` 的話每一個要求的數字都還在，正解卻變了
               （而且那個題幹違反這一課「不併式」的範圍）。所以題幹裡
               **允許出現的數字是一張白名單**，多一個就報錯。 */
            if (e.numsAll){
              const seen = (stemPlain.match(/\d+/g) || []);
              seen.forEach(x => {
                if (e.numsAll.indexOf(x) < 0)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' stem contains an unexpected number ' + x +
                       ' — the answer is recomputed from the stem, so a new number changes the question');
              });
            } else {
              fail('BANK: ' + bank + '[' + i + '] has no numsAll whitelist — extra numbers in the stem would go unnoticed');
            }
            /* 純算式的題目：整句話要逐字對得上，連運算符號都不可以多。 */
            if (e.stemExact && e.stemExact[L] && stemPlain.trim() !== e.stemExact[L])
              fail('BANK: ' + bank + '[' + i + '] ' + L + ' stem is "' + stemPlain.trim() +
                   '", expected exactly "' + e.stemExact[L] + '"');
            /* 題幹問的是什麼。 */
            const ask = e.ask && e.ask[L];
            if (!ask) fail('BANK: ' + bank + '[' + i + '] ' + L + ' has no ASK entry — the stem is unguarded');
            else {
              (ask.must || []).forEach(w => {
                if (stemPlain.toLowerCase().indexOf(String(w).toLowerCase()) < 0)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' stem must ask for "' + w + '"');
              });
              (ask.never || []).forEach(w => {
                if (stemPlain.toLowerCase().indexOf(String(w).toLowerCase()) >= 0)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' stem must not contain "' + w + '"');
              });
            }
            /* 正解的字串。 */
            if (e.expect && e.expect[L]){
              const got = String(q.opts[q.ans]).replace(/<[^>]+>/g, '');
              if (got !== e.expect[L])
                fail('BANK: ' + bank + '[' + i + '] ' + L + ' correct option is "' + got + '", expected "' + e.expect[L] + '"');
            }
            /* ⚠️ 解釋從來沒被驗過：`why` 可以寫「213 × 20 ＝ 426」而題幹、選項、
               答案索引全都不動，所有檢查照樣綠燈（codex 第一輪）。
               每一列都要有 whyMust，而且重算出來的答案一定要出現在解釋裡。 */
            const whyPlain = String(q.why).replace(/<[^>]+>/g, '');
            if (!e.whyMust || !e.whyMust[L])
              fail('BANK: ' + bank + '[' + i + '] ' + L + ' has no whyMust — the explanation is unguarded');
            else e.whyMust[L].forEach(w => {
              if (whyPlain.indexOf(w) < 0)
                fail('BANK: ' + bank + '[' + i + '] ' + L + ' why must contain "' + w + '" but says: ' +
                     whyPlain.slice(0, 100));
            });
            if (/[-−]\d/.test(whyPlain))
              fail('BANK: ' + bank + '[' + i + '] ' + L + ' a negative number reached the explanation');
            /* ⚠️ 「解釋裡有出現那一句正確的話」擋不住**多加一句錯的**：
               留著「852 ＋ 4260 ＝ 5112」再補一句「1 ＋ 1 ＝ 3」照樣過關（codex 第二輪）。
               所以解釋裡的**每一條算式**都要真的算對。 */
            arithProblems(whyPlain).forEach(bad2 => {
              fail('BANK: ' + bank + '[' + i + '] ' + L + ' the explanation states a false calculation: "' + bad2 + '"');
            });

            /* 選項是整句話的題目：關鍵字只能落在正解上。
               ⚠️ 少了這一條，把正解換成任何一句乾淨的話而 ans 不動，
               所有檢查都還是綠的（grade-4/decimal 的 critical）。 */
            if (e.onlyAnswer && e.onlyAnswer[L]){
              const key = e.onlyAnswer[L];
              q.opts.forEach((o, oi) => {
                const has = String(o).replace(/<[^>]+>/g, '').indexOf(key) >= 0;
                if (oi === e.ans && !has)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' the correct option no longer says "' + key + '"');
                if (oi !== e.ans && has)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' a wrong option also says "' + key + '", so two options are defensible');
              });
            }
          });
          /* 從題幹的數字重算一次答案（第二套實作）。 */
          const zq = zh[i];
          const check = (want, label) => {
            const got = String(zq.opts[zq.ans]).replace(/<[^>]+>/g, '');
            if (got.indexOf(String(want)) < 0)
              fail('BANK: ' + bank + '[' + i + '] ' + label + ' recomputes to ' + want + ' but the correct option is "' + got + '"');
          };
          if (e.mulTotal) check(mulRef(Number(e.mulTotal[0]), Number(e.mulTotal[1])), 'the product');
          if (e.mulRow2) check(mulRef(Number(e.mulRow2[0]), Math.floor(Number(e.mulRow2[1]) / 10)) * 10, 'the second row');
          if (e.qLen) check(startRef(Number(e.qLen[0]), Number(e.qLen[1])).qLen, 'the quotient length');
          if (e.firstTry) check(Math.min(9, Math.floor(Number(e.firstTry[0]) / roundTenRef(Number(e.firstTry[1])))), 'the first guess');
          if (e.change) check(Number(e.change[2]) - mulRef(Number(e.change[0]), Number(e.change[1])), 'the change');
          if (e.needMore) check(ldRef(Number(e.needMore[0]), Number(e.needMore[1])).q + 1, 'the quotient plus one');
          if (e.twoStepDiv){
            const first = ldRef(Number(e.twoStepDiv[0]), Number(e.twoStepDiv[1]));
            if (first.rem !== 0) fail('BANK: ' + bank + '[' + i + '] the first step of the two-step story does not come out exact');
            check(Math.floor(first.q / Number(e.twoStepDiv[2])), 'the second step');
          }
          if (e.qrPair){
            const r = ldRef(Number(e.qrPair[0]), Number(e.qrPair[1]));
            check(r.q, 'the quotient');
            check(r.rem, 'the remainder');
          }
        });
      });

      /* ---------- 10. 把每一句旁白真的渲染出來再掃 ---------- */
      /* 「跑起來再掃」才抓得到拼接出來的缺陷：中文緊貼數字、英文的 1、
         負號、`undefined`、重複標點。這一課最怕的是負餘數溜進旁白。 */
      ['zh', 'en'].forEach(L => {
        const d0 = I18N[L];
        const narrated = [];
        const push = s => { if (typeof s === 'string') narrated.push(s); };

        MUL_CASES.forEach(c => {
          const mp = mulPlan(c.a, c.b), sp = splitPlan(c.a, c.b);
          push(d0.s1chip(c.a, c.b));
          push(d0.s1result(c.a, c.b, mp.r1, mp.r2value, mp.total));
          push(d0.spCorner(c.a, c.b));
          push(d0.spColHead(sp.cols[0]));
          push(d0.spColHead(sp.cols[1]));
          push(d0.spRowHead(sp.rows[0]));
          push(d0.spRow1(sp.colSums[0]));
          push(d0.spRow2(sp.colSums[1]));
          push(d0.s2chip(c.a, c.b));
          push(d0.s2start(mp.ones, mp.tens));
          push(d0.s2shift(mp.r2, mp.r2value));
          push(d0.s2add(mp.r1, mp.r2value, mp.total));
          push(d0.s2result(c.a, c.b, mp.total));
          [[mp.ones, d0.s2tagRow1], [mp.tens, d0.s2tagRow2]].forEach(pair => {
            mulColSteps(c.a, pair[0]).forEach(st => {
              const place = d0.placeName[PLACE_ORDER[Math.min(st.pos, PLACE_ORDER.length - 1)]];
              push(st.final
                ? d0.s2colFinal(pair[1], st.carryIn)
                : d0.s2col(pair[1], place, st.digit, st.m, st.carryIn, st.prod, st.write, st.carryOut));
            });
          });
        });
        START_CASES.forEach(c => {
          const sp = startPlan(c.N, c.d);
          push(d0.s3chip(c.N, c.d));
          push(d0.s3result(sp.qLen));
          sp.rows.forEach(r2 => push(d0.s3row(r2.take, r2.cur, c.d, r2.cmp)));
        });
        TRY_CASES.concat(ADJ_CASES).forEach(c => {
          const tp = tryPlan(c.cur, c.d);
          push(d0.s4chip(c.cur, c.d));
          push(d0.s4title(c.cur, c.d));
          push(d0.s4lab(tp.q, c.d));
          /* ⚠️ s4lab 是純函式，可是樣本的商剛好都不是 1 —— 只渲染樣本的話，
             英文的「1 lots of 25」永遠掃不到。份數 0~9 全部渲染一次。 */
          for (var qq = 0; qq <= Q_MAX; qq++) push(d0.s4lab(qq, c.d));
          push(tp.rem === 0 ? d0.s4exact : d0.s4rem(tp.rem));
          push(d0.s4narr(c.d, tp.rt, tp.guessRaw, tp.guess, tp.clamped));
          push(d0.s4result(c.cur, c.d, tp.q, tp.rem));
          push(d0.s5chip(c.cur, c.d));
          push(d0.s5prompt(c.cur, c.d, tp.rt));
          push(d0.s5done(tp.q));
          push(d0.s4tag.big); push(d0.s4tag.small); push(d0.s4tag.ok);
          /* ⚠️ 每一個候選數字都可能被孩子點到 —— 十句話全部渲染一次。
             'big' 那一支的餘數是負的，只要有人把它算進句子就會被下面的掃描抓到。 */
          for (let t = 0; t <= 9; t++){
            const prod = t * c.d;
            if (prod > c.cur) push(d0.tryBig(t, c.d, prod, c.cur));
            else if (c.cur - prod >= c.d) push(d0.trySmall(t, c.d, prod, c.cur, c.cur - prod));
            else push(d0.tryOk(t, c.d, prod, c.cur, c.cur - prod));
          }
        });
        LD_CASES.forEach(c => {
          const p = ldPlan(c.N, c.d), sp = startPlan(c.N, c.d);
          push(d0.s6chip(c.N, c.d));
          push(d0.s6start(p.N, p.d, sp.rows.length, sp.qLen));
          p.steps.forEach((st, k) => {
            push(st.q === 0 ? d0.s6zero(k + 1, st.cur, p.d)
                            : d0.s6round(k + 1, st.cur, st.q, p.d, st.prod, st.rem));
            if (st.bring !== null) push(d0.s6bring(st.rem, st.bring, st.next));
          });
          push(d0.s6end(p.rem, p.d));
          push(d0.s6verify(p.d, p.q, p.rem, p.backCheck));
          push(d0.s6result(p.N, p.d, p.q, p.rem));
        });
        ROUNDS.forEach(r => {
          if (r.kind === 'mulTotal'){
            const mp = mulPlan(r.a, r.b);
            push(d0.gPrompt.mulTotal(r.a, r.b));
            push(d0.gHint2.mulTotal(mp.r1, mp.r2value));
          }
          if (r.kind === 'mulRow2'){
            const mp = mulPlan(r.a, r.b);
            push(d0.gPrompt.mulRow2(r.a, r.b));
            push(d0.gHint2.mulRow2(r.a, mp.tens, mp.tens * 10));
          }
          if (r.kind === 'qLen'){
            const sp = startPlan(r.N, r.d), last = sp.rows[sp.rows.length - 1];
            push(d0.gPrompt.qLen(r.N, r.d));
            push(d0.gHint2.qLen(last.take, last.cur));
            push(d0.gOptLen(sp.qLen));
          }
          if (r.kind === 'tryDigit'){
            const tp = tryPlan(r.cur, r.d);
            push(d0.gPrompt.tryDigit(r.cur, r.d));
            push(d0.gHint2.tryDigit(tp.rt, tp.guessRaw));
          }
          if (r.kind === 'full'){
            const p = ldPlan(r.N, r.d);
            push(d0.gPrompt.full(r.N, r.d));
            push(d0.gOptFull(p.q, p.rem));
            push(d0.gHint2.full(startPlan(r.N, r.d).qLen));
          }
        });

        if (narrated.length < 200)
          fail('NARR: only ' + narrated.length + ' ' + L + ' strings were rendered — the sweep is not covering the page');
        narrated.forEach(s => {
          const t = s.replace(/<[^>]+>/g, '');
          if (/undefined|NaN|\[object/.test(t)) fail('NARR(' + L + '): a rendered string leaks an internal value: ' + t.slice(0, 100));
          /* ⚠️ 這一課最危險的一句：'big' 那一步的餘數是負的。
             只要有人把它算進旁白，這一條就會響。 */
          if (/[-−]\d/.test(t)) fail('NARR(' + L + '): a negative number reached a narration string: ' + t.slice(0, 100));
          if (/[。，、；！？]{2,}|[.,;!?]{2,}/.test(t)) fail('NARR(' + L + '): doubled punctuation: ' + t.slice(0, 100));
          if (L === 'zh' && /[一-鿿][0-9]/.test(t)) fail('NARR(zh): a digit is glued to a Chinese character: ' + t.slice(0, 100));
          if (L === 'en'){
            const bad = t.match(PLURAL_RE) || t.match(SINGULAR_RE);
            if (bad) fail('NARR(en): singular/plural is wrong near "' + bad[0] + '" in: ' + t.slice(0, 100));
            if (/[一-鿿]/.test(t)) fail('NARR(en): Chinese leaked into an English string: ' + t.slice(0, 100));
          }
        });
      });

      /* ---------- 11. 四頁的措辭 ---------- */
      /* ⚠️ 一定要用 process.argv[2] 推出資料夾，不可以用 __dirname ——
         breaktest.js 是把四頁複製到暫存目錄再跑的，__dirname 會讀到真的 repo，
         針對 reference／parents／review 的斷言就永遠是綠的。 */
      const dir = path.dirname(path.resolve(process.argv[2] || ''));
      const SRC = { index: src };
      ['reference', 'review', 'parents'].forEach(f => {
        const p = path.join(dir, f + '.html');
        if (!fs.existsSync(p)){ fail('[SETUP-FAIL] ' + f + '.html is missing from ' + dir); return; }
        SRC[f] = fs.readFileSync(p, 'utf8');
      });
      SIBLING_RULES.forEach(r => {
        const s = SRC[r.file];
        if (s === undefined){ fail('[SETUP-FAIL] unknown page in SIBLING_RULES: ' + r.file); return; }
        const n = countOf(s, r.text);
        if (n < r.min)
          fail('SIBLING: ' + r.file + '.html says "' + r.text + '" ' + n + ' times, expected at least ' +
               r.min + ' — that wording ' + r.why);
      });

      /* 產生器清單：刪掉一整支，它那一組斷言會靜靜消失。 */
      {
        const rv = stripComments(SRC.review || '');
        const ids = [];
        const re = /\{\s*id:'([a-zA-Z0-9_]+)'/g;
        let m;
        while ((m = re.exec(rv))) ids.push(m[1]);
        GEN_IDS.forEach(id => {
          if (ids.indexOf(id) < 0) fail('GENS: review.html no longer defines the generator "' + id + '"');
        });
        ids.forEach(id => {
          if (GEN_IDS.indexOf(id) < 0) fail('GENS: review.html defines an unregistered generator "' + id + '"');
        });
        if (ids.length !== GEN_IDS.length)
          fail('GENS: review.html defines ' + ids.length + ' generators, the config lists ' + GEN_IDS.length);
        /* 光有一行 `{ id:'…',` 的字面文字湊不出一支產生器 —— make/fmt 也要數得對。 */
        const makes = (rv.match(/\bmake\s*:\s*function/g) || []).length;
        const fmts = (rv.match(/\bfmt\s*:\s*function/g) || []).length;
        if (makes !== GEN_IDS.length) fail('GENS: review.html has ' + makes + ' make() functions for ' + GEN_IDS.length + ' generators');
        if (fmts !== GEN_IDS.length) fail('GENS: review.html has ' + fmts + ' fmt() functions for ' + GEN_IDS.length + ' generators');
      }
    }
  }
};
