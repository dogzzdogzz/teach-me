/* grade-4/math/decimal —— 小數放大鏡（百分位、千分位、補零比大小、二位小數的直式加減）
 *
 * 這一課的每一個判斷都是「小數的相等與大小」，所以課程頁與複習頁的標準寫法是
 * **「有幾個千分之一」的整數**（milli）—— 浮點數不能用（0.1 + 0.2 !== 0.3）。
 *
 * 這份設定檔的第二套實作**故意走另一條路**：不做整數運算，而是把每一個數攤成
 * **五格的數字陣列**（十位、個位、十分位、百分位、千分位），加減用一格一格的
 * 進位／退位做，比大小用逐格字典序比較，印出來也自己組字串（完全不呼叫
 * 頁面的 fmtPad／fmtNat／colPlan）。兩條路必須逐題同意。
 *   ⚠️ 拿頁面自己的函式當標準答案等於自己比自己 —— 格式化寫錯（把 0.50 印成 0.5、
 *   或反過來）時不變條件、形狀檢查、相等檢查會一起錯過。
 *
 * 另外三件這一課特有的守門條件：
 *   ① 「哪一位」的題目，被問的那個數字必須在整個數裡**只出現一次**，
 *      不然兩個選項都對（§六之二）。設定檔逐題驗，而且順手驗整數部分是一位數
 *      —— 十位一旦有值，唯一性的掃描範圍就不對了。
 *   ② 選項要**解析回來再印回去逐字相同**。這一條一次抓住「0.50 被印成 0.5」、
 *      多餘空白、'00.5' 這種前導零 —— 而 sameValue 那一支的正解就是 0.50，
 *      所以不能只用「最自然的寫法」當標準。
 *   ③ 英文的 1：`1 lots of 0.1`、`1 places right of the point`、`there are 1 of them`
 *      都是真的會上線的錯，而所有數值檢查都不會響。掃每一個渲染出來的字串。
 */

const fs = require('fs');
const path = require('path');
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');
const { decArith } = require('./lib/decarith.js')();

/* ================= 第二套實作：五格數字陣列 ================= */
/* 索引固定是 [十位, 個位, 十分位, 百分位, 千分位]。 */
const DIG_N = 5;
const MIL_MAX_REF = 100000;

function milDigitsRef(m){
  if (!(typeof m === 'number' && isFinite(m) && m === Math.round(m) && m >= 0 && m < MIL_MAX_REF)) return null;
  const out = [];
  let rem = m;
  for (const u of [10000, 1000, 100, 10, 1]){ out.push(Math.floor(rem / u)); rem = rem % u; }
  return out;
}
/* 自己組字串：整數部分只在十位是 0 的時候省略十位；
   小數部分從第三位往回砍掉結尾的 0，但至少留 minFrac 位。 */
function digitsToStrRef(dg, minFrac){
  if (!Array.isArray(dg) || dg.length !== DIG_N) return null;
  for (const d of dg) if (!(Number.isInteger(d) && d >= 0 && d <= 9)) return null;
  const mf = Math.max(0, Math.min(3, minFrac | 0));
  let n = 3;
  while (n > mf && dg[1 + n] === 0) n--;
  const intPart = (dg[0] === 0) ? String(dg[1]) : String(dg[0]) + String(dg[1]);
  return n === 0 ? intPart : intPart + '.' + dg.slice(2, 2 + n).join('');
}
/* 自然位數：最後一個不是 0 的小數位。 */
function fracLenRef(dg){
  let n = 3;
  while (n > 0 && dg[1 + n] === 0) n--;
  return n;
}
function addDigitsRef(A, B){
  const R = new Array(DIG_N).fill(0);
  let c = 0;
  for (let i = DIG_N - 1; i >= 0; i--){
    const s = A[i] + B[i] + c;
    R[i] = s % 10;
    c = s >= 10 ? 1 : 0;
  }
  return { digits:R, over:c };
}
function subDigitsRef(A, B){
  const R = new Array(DIG_N).fill(0);
  let c = 0;
  for (let i = DIG_N - 1; i >= 0; i--){
    let t = A[i] - B[i] - c;
    if (t < 0){ t += 10; c = 1; } else { c = 0; }
    R[i] = t;
  }
  return { digits:R, over:c };
}
/* 逐格字典序 —— 五格都已經對齊了位，所以這就是課程教的
   「補零到一樣長，再從最左邊一位一位比」。 */
function cmpDigitsRef(A, B){
  for (let i = 0; i < DIG_N; i++){
    if (A[i] !== B[i]) return A[i] > B[i] ? 1 : -1;
  }
  return 0;
}
/* 分出大小的位（whole ＝ 整數部分，1~3 ＝ 十分／百分／千分位）。 */
function decidedByRef(A, B){
  if (A[0] !== B[0] || A[1] !== B[1]) return { kind:'whole' };
  for (let k = 1; k <= 3; k++) if (A[1 + k] !== B[1 + k]) return { kind:'place', k:k };
  return { kind:'same' };
}
/* 解析一個小數字串回五格陣列 ＋ 它寫了幾位小數。
   不合法的寫法（多餘空白、'00.5'、'.5'、'1.'、四位小數）一律回 null。 */
function parseDecRef(s){
  if (typeof s !== 'string') return null;
  const m = /^(\d{1,2})(?:\.(\d{1,3}))?$/.exec(s);
  if (!m) return null;
  const int = m[1], frac = m[2] || '';
  if (int.length === 2 && int[0] === '0') return null;
  const dg = new Array(DIG_N).fill(0);
  if (int.length === 2){ dg[0] = +int[0]; dg[1] = +int[1]; } else { dg[1] = +int; }
  for (let i = 0; i < frac.length; i++) dg[2 + i] = +frac[i];
  return { dg:dg, shown:frac.length };
}
/* 「解析出來再印回去必須逐字相同」—— 一條抵四條。 */
function reprintOk(s){
  const p = parseDecRef(s);
  if (!p) return false;
  return digitsToStrRef(p.dg, p.shown) === s;
}
function milOf(dg){
  return dg[0] * 10000 + dg[1] * 1000 + dg[2] * 100 + dg[3] * 10 + dg[4];
}
/* 這一對數字真的會進位／退位嗎（用五格陣列自己跑一次，而且進位要真的往左傳）。
   ⚠️ 不可以「看到一欄超過 10 就 return true」然後把 c 歸零 —— 那樣連鎖進位會漏掉。 */
function carriesRef(a, b){
  const A = milDigitsRef(a), B = milDigitsRef(b);
  let c = 0, any = false;
  for (let i = DIG_N - 1; i >= 0; i--){
    const s = A[i] + B[i] + c;
    c = s >= 10 ? 1 : 0;
    if (c) any = true;
  }
  return any;
}
function borrowsRef(a, b){
  const A = milDigitsRef(a), B = milDigitsRef(b);
  let c = 0, any = false;
  for (let i = DIG_N - 1; i >= 0; i--){
    const t = A[i] - B[i] - c;
    if (t < 0){ c = 1; any = true; } else { c = 0; }
  }
  return any;
}
/* 「每一位各自算、完全不進位／不退位」算出來的那個值 —— 加減四支唯一允許的
   stem-echo 誘答。自己用五格陣列算一次，不看 review.html 怎麼算。 */
function noCarryEcho(d, op, opt){
  const A = milDigitsRef(d.a), B = milDigitsRef(d.b);
  if (!A || !B || (op !== '+' && op !== '-')) return false;
  let v = 0;
  for (let i = 0; i < DIG_N; i++){
    const x = (op === '+') ? (A[i] + B[i]) % 10 : ((A[i] - B[i]) + 10) % 10;
    v += x * Math.pow(10, DIG_N - 1 - i);
  }
  if (!(v > 0 && v < MIL_MAX_REF)) return false;
  return String(opt) === digitsToStrRef(milDigitsRef(v), 0);
}

/* 加減三支共用的不變條件。 */
function addSubInv(d, op){
  if (!d) return 'make() returned nothing';
  if (!milDigitsRef(d.a) || !milDigitsRef(d.b)) return 'a or b is not a valid milli value';
  if (op !== '+' && op !== '-') return 'bad operator: ' + op;
  const A = milDigitsRef(d.a), B = milDigitsRef(d.b);
  const r = (op === '+') ? addDigitsRef(A, B) : subDigitsRef(A, B);
  if (r.over !== 0) return 'the calculation leaves the lesson range (a leftover carry or borrow on the left)';
  if (op === '-' && cmpDigitsRef(A, B) < 0) return 'the subtraction would go negative';
  return null;
}

/* ================= 兩本字典的文字（刻意重抄一份） ================= */
/* 拿頁面自己的字典比對等於自己比字典；這裡逐字重抄，
   任何一邊改了措辭都會被抓到。 */
const PLACE_TXT = {
  zh:{ ones:'個位', tenth:'十分位', hundredth:'百分位', thousandth:'千分位' },
  en:{ ones:'the ones place', tenth:'the tenths place',
       hundredth:'the hundredths place', thousandth:'the thousandths place' }
};
const PHRASE = {
  zh:{ same:'一樣大', cannotTell:'沒辦法比較', allSame:'都一樣大' },
  en:{ same:'They are the same', cannotTell:'There is no way to tell', allSame:'They are all the same' }
};
const KEYS = ['ones', 'tenth', 'hundredth', 'thousandth'];

/* 英文的單複數只在「1」上壞掉，而且沒有任何數值檢查看得到。
   ⚠️ 名詞清單要寬，而且要 case-insensitive —— 'There are 1 squares' 也是錯的。 */
const PLURAL_RE = /\b1 (lots|places|steps|squares|litres|liters|metres|meters|kilometres|kilometers|kilograms|grams|tenths|hundredths|thousandths|digits|parts|strips|units|rows|columns|times)\b/i;
const THERE_ARE_RE = /\bthere are 1\b/i;

/* 產生器清單。刪掉或改名一整支，它那一組不變式、expectedCorrect 與 renderCheck
   會一起靜靜消失 —— data.check 會去讀 review.html 比對這張表。 */
const GEN_IDS = ['placeName', 'placeValue', 'countUnits', 'buildFromParts',
                 'compareTwo', 'sameValue', 'orderThree',
                 'addTwo', 'subTwo', 'padAddSub', 'wholeMinus', 'numberLine'];

/* 題幹「問的是什麼」。只驗數字的話，把 compareTwo 的題幹改成問哪一個比較小、
   正解還是比較大的那一個，所有數值檢查都還是綠的。 */
const ASK = {
  placeName:      { zh:{ must:['在哪一位'], never:['表示多少', '比較大'] },
                    en:{ must:['which place'], never:['what is that', 'bigger'] } },
  placeValue:     { zh:{ must:['表示多少'], never:['在哪一位'] },
                    en:{ must:['worth'], never:['which place'] } },
  countUnits:     { zh:{ must:['是幾個'], never:['在哪一位', '比較大'] },
                    en:{ must:['How many lots of'], never:['which place', 'bigger'] } },
  buildFromParts: { zh:{ must:['合起來是多少'], never:['在哪一位'] },
                    en:{ must:['what do they make altogether'], never:['which place'] } },
  compareTwo:     { zh:{ must:['哪一個比較大'], never:['比較小', '合起來'] },
                    en:{ must:['Which is bigger'], never:['smaller', 'altogether'] } },
  sameValue:      { zh:{ must:['一樣大'], never:['比較大', '比較小'] },
                    en:{ must:['the same size as'], never:['bigger', 'smaller'] } },
  orderThree:     { zh:{ must:['三個數裡面'], never:['合起來'] },
                    en:{ must:['Which of'], never:['altogether'] } },
  addTwo:         { zh:{ must:['＋'], never:['－', '哪一個'] },
                    en:{ must:[' + '], never:[' - ', 'Which'] } },
  subTwo:         { zh:{ must:['－'], never:['＋', '哪一個'] },
                    en:{ must:[' - '], never:[' + ', 'Which'] } },
  padAddSub:      { zh:{ must:['＝ ？'], never:['哪一個'] },
                    en:{ must:['= ?'], never:['Which'] } },
  wholeMinus:     { zh:{ must:['－'], never:['＋', '哪一個'] },
                    en:{ must:[' - '], never:[' + ', 'Which'] } },
  numberLine:     { zh:{ must:['數線上的箭頭'], never:['合起來', '比較大'] },
                    en:{ must:['arrow pointing at'], never:['altogether', 'bigger'] } }
};

/* 解釋一定要出現的關鍵句 —— 只驗數字有沒有出現的話，
   把「補零」改成「去掉零」每一個數字都還在。 */
const WHY_MUST = {
  placeName:      { zh:['從小數點往右數'], en:['Count right from the decimal point'] },
  placeValue:     { zh:['數字告訴你幾個'], en:['The digit says how many'] },
  countUnits:     { zh:['平分成'], en:['is cut into'] },
  buildFromParts: { zh:['一個位放一個數字'], en:['One digit per place'] },
  compareTwo:     { zh:['先補零補到一樣長', '位數多少不能用來判斷大小'],
                    en:['Pad them to the same length first', 'cannot be used to judge size'] },
  sameValue:      { zh:['最後面'], en:['on the end'] },
  orderThree:     { zh:['位數多少不能用來判斷大小'], en:['cannot be used to judge size'] },
  addTwo:         { zh:['對齊的是小數點，不是最右邊的數字'],
                    en:['line up is the decimal point, not the right-hand edge'] },
  subTwo:         { zh:['對齊的是小數點，不是最右邊的數字'],
                    en:['line up is the decimal point, not the right-hand edge'] },
  padAddSub:      { zh:['對齊的是小數點，不是最右邊的數字'],
                    en:['line up is the decimal point, not the right-hand edge'] },
  wholeMinus:     { zh:['對齊的是小數點，不是最右邊的數字'],
                    en:['line up is the decimal point, not the right-hand edge'] },
  numberLine:     { zh:['平分成 10 格'], en:['cut into 10 equal steps'] }
};

/* 四頁必須用同一句話講同一條規則。min 是剝掉註解之後實際出現的次數 ——
   中文字串在有字典的頁面上一定有兩份（markup 的 fallback ＋ 字典），
   所以比的是「出現幾次」，只改其中一份也要被抓到。 */
const SIBLING_RULES = [
  { file:'index',     text:'對齊小數點',               min:6, why:'is the whole rule for column addition and subtraction' },
  { file:'reference', text:'對齊小數點',               min:4, why:'is the whole rule for column addition and subtraction' },
  { file:'review',    text:'對齊小數點',               min:2, why:'is the whole rule for column addition and subtraction' },
  { file:'parents',   text:'對齊小數點',               min:2, why:'is the whole rule for column addition and subtraction' },

  { file:'index',     text:'位數多少不能用來判斷大小', min:2, why:'kills the "more places means bigger" misconception' },
  { file:'reference', text:'位數多少不能用來判斷大小', min:2, why:'kills the "more places means bigger" misconception' },
  { file:'review',    text:'位數多少不能用來判斷大小', min:2, why:'kills the "more places means bigger" misconception' },
  { file:'parents',   text:'位數多少不能用來判斷大小', min:2, why:'kills the "more places means bigger" misconception' },

  { file:'index',     text:'最後面',                   min:8, why:'is the only safe half of the trailing-zero rule' },
  { file:'reference', text:'最後面',                   min:5, why:'is the only safe half of the trailing-zero rule' },
  { file:'review',    text:'最後面',                   min:3, why:'is the only safe half of the trailing-zero rule' },
  { file:'parents',   text:'最後面',                   min:6, why:'is the only safe half of the trailing-zero rule' },

  { file:'index',     text:'第一位是十分位',           min:2, why:'pins the place names to the decimal point' },
  { file:'review',    text:'第一位是十分位',           min:1, why:'pins the place names to the decimal point' },

  { file:'index',     text:'加減只做二位小數',         min:2, why:'is the scope boundary against the grade-5 lesson' },
  { file:'reference', text:'加減只做二位小數',         min:2, why:'is the scope boundary against the grade-5 lesson' },
  { file:'index',     text:'不乘、不除、不做四捨五入', min:2, why:'is the scope boundary against the grade-5 lesson' },
  { file:'reference', text:'不乘、不除、不做四捨五入', min:2, why:'is the scope boundary against the grade-5 lesson' },
  { file:'parents',   text:'只做到二位小數',           min:2, why:'is how the parents page states the same boundary' },

  { file:'index',     text:'一個一個唸',               min:2, why:'is the reading rule for decimals' },
  { file:'reference', text:'一個一個唸',               min:2, why:'is the reading rule for decimals' },
  { file:'parents',   text:'一個一個唸',               min:4, why:'is the reading rule for decimals' }
];

/* 題庫的神諭。每一列記下「題幹裡一定要出現的數字」與「正解應該是什麼」，
   而且正解是從**題幹的那些數字**重算出來的，不是拿設定檔自己的常數算 ——
   後者在題幹被改掉的時候不會響。 */
const BANK_EXPECTED = {
  qs: [
    { nums:['0.468', '6'], ans:1, expect:{ zh:'百分位', en:'The hundredths place' },
      ask:{ zh:{ must:['在哪一位'], never:['表示多少'] }, en:{ must:['which place'], never:['worth'] } } },
    { nums:['3', '0.01'],  ans:3, units:['3', '0.01'], expect:{ zh:'0.03', en:'0.03' },
      ask:{ zh:{ must:['合起來是多少'] }, en:{ must:['make altogether'] } } },
    { nums:['0.5', '0.48'], ans:0, cmp:['0.5', '0.48'], expect:{ zh:'0.5', en:'0.5' },
      ask:{ zh:{ must:['哪一個比較大'], never:['比較小'] }, en:{ must:['Which is bigger'], never:['smaller'] } } },
    { nums:['0.7', '0.25'], ans:2, add:['0.7', '0.25'], expect:{ zh:'0.95', en:'0.95' },
      ask:{ zh:{ must:['＋'], never:['－'] }, en:{ must:[' + '], never:[' - '] } } },
    { nums:['1.2', '0.85'], ans:3, sub:['1.2', '0.85'], expect:{ zh:'0.35', en:'0.35' },
      ask:{ zh:{ must:['－'], never:['＋'] }, en:{ must:[' - '], never:[' + '] } } },
    { nums:['0.6'], ans:0, sameAs:'0.6', expect:{ zh:'0.60', en:'0.60' },
      ask:{ zh:{ must:['一樣大'], never:['比較大'] }, en:{ must:['the same size as'], never:['bigger'] } } }
  ],
  qsAdv: [
    { nums:['0.85', '1.4'], ans:2, add:['0.85', '1.4'], expect:{ zh:'2.25', en:'2.25' },
      ask:{ zh:{ must:['一共'], never:['還剩'] }, en:{ must:['altogether'], never:['left'] } } },
    { nums:['5', '2.34'],   ans:1, sub:['5', '2.34'],   expect:{ zh:'2.66', en:'2.66' },
      ask:{ zh:{ must:['還剩'], never:['一共'] }, en:{ must:['is left'], never:['altogether'] } } },
    { nums:['1.4', '1.38', '1.405'], ans:3, maxOf:['1.4', '1.38', '1.405'], expect:{ zh:'1.405', en:'1.405' },
      ask:{ zh:{ must:['最好'], never:['最差'] }, en:{ must:['the best'], never:['worst'] } } },
    { nums:['2.5', '0.75', '0.4'],   ans:0, twoStep:['2.5', '0.75', '0.4'], expect:{ zh:'2.15', en:'2.15' },
      ask:{ zh:{ must:['現在'] }, en:{ must:['now'] } } }
  ],
  qsBoost: [
    /* ⚠️ 選項是整句話，所以沒有算術神諭可用。用「正解一定要出現這句關鍵字，
       而且其他三個選項一定不可以出現」來釘住它 —— 少了這一條，把正解換成
       任何一個乾淨的小數（例如 9.9）而 ans 不動，所有檢查都還是綠的。 */
    { nums:['0.48', '0.5'], ans:1,
      ask:{ zh:{ must:['哪裡不對'] }, en:{ must:['What is wrong'] } },
      onlyAnswer:{ zh:'位數多少不能用來判斷大小', en:'cannot be used to judge size' } },
    { nums:['0.5', '0.05'], ans:2,
      ask:{ zh:{ must:['哪裡不對'] }, en:{ must:['What is wrong'] } },
      onlyAnswer:{ zh:'補在最後面的 0 才不影響大小', en:'added on the end is the harmless one' } }
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

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 核心：格式化不可以截斷 --- */
    { file:'index', via:'index', expect:'fmtPad truncates',
      find:'    var pp = Math.max(p | 0, places(m));',
      replace:'    var pp = p | 0;',
      why:'dropping the Math.max lets fmtPad silently truncate, which changes the value' },
    { file:'index', via:'index', expect:'PLACES',
      find:'    if (m % 10 !== 0) return 3;\n    if (m % 100 !== 0) return 2;\n    if (m % MIL !== 0) return 1;\n    return 0;',
      replace:'    if (m % 10 !== 0) return 3;\n    if (m % 100 !== 0) return 2;\n    return 1;',
      why:'a whole number would claim to need one decimal place' },
    { file:'index', via:'index', expect:'DIGIT',
      find:'  function digitAt(m, k){ return Math.floor(m / placeUnit(k)) % 10; }',
      replace:'  function digitAt(m, k){ return Math.floor(m / placeUnit(k)) % 100; }',
      why:'digitAt would return two digits at once' },
    { file:'index', via:'index', expect:'FMT',
      find:'  function placeUnit(k){ return Math.pow(10, 3 - k); }',
      replace:'  function placeUnit(k){ return Math.pow(10, 2 - k); }',
      why:'every place would be worth one tenth of what it should be' },

    /* --- 比大小：規則的每一半都要顧到 --- */
    { file:'index', via:'index', expect:'CMP',
      find:"    var steps = [{ kind:'whole', a:wa, b:wb, cmp: wa === wb ? 0 : (wa > wb ? 1 : -1) }];",
      replace:"    var steps = [{ kind:'whole', a:wa, b:wb, cmp: 0 }];",
      why:'the whole-number step would never settle anything, so 1.2 vs 0.98 falls through to the tenths' },
    { file:'index', via:'index', expect:'CMP',
      find:'    for (var k = 1; k <= pad && steps[steps.length - 1].cmp === 0; k++){',
      replace:'    for (var k = 1; k <= pad && k <= 2 && steps[steps.length - 1].cmp === 0; k++){',
      why:'the comparison would stop at the hundredths, so 0.457 vs 0.46 is called equal' },
    { file:'index', via:'index', expect:'does not carry the verdict',
      find:'    var pad = Math.max(places(a), places(b), pa | 0, pb | 0);',
      replace:'    var pad = Math.min(places(a), places(b), 2);',
      why:'padding to the SHORTER length stops the walk before the place that settles it (0.462 vs 0.46)' },

    /* --- 直式：一欄一欄的進位／退位 --- */
    { file:'index', via:'index', expect:'COL',
      find:'        R[i] = s % 10;\n        c = s >= 10 ? 1 : 0;\n        carry[i] = c;            // 這一欄往左邊進的 1',
      replace:'        R[i] = s % 10;\n        c = 0;\n        carry[i] = c;            // 這一欄往左邊進的 1',
      why:'addition would never carry' },
    { file:'index', via:'index', expect:'COL',
      find:'        if (t < 0){ t += 10; c = 1; } else { c = 0; }\n        R[i] = t;\n        borrow[i] = c;           // 這一欄向左邊借的 1',
      replace:'        if (t < 0){ t = -t; c = 0; } else { c = 0; }\n        R[i] = t;\n        borrow[i] = c;           // 這一欄向左邊借的 1',
      why:'subtraction would take the absolute value instead of borrowing' },
    { file:'index', via:'index', expect:'COL',
      find:'      for (i = VF_POS.length - 1; i >= 0; i--){\n        var s = A[i] + B[i] + c;',
      replace:'      for (i = 0; i < VF_POS.length; i++){\n        var s = A[i] + B[i] + c;',
      why:'adding left-to-right carries in the wrong direction' },
    { file:'index', via:'index', expect:'padA',
      find:'      padA: VF_POS.map(function(k){ return k >= 1 && places(a) < k; }),',
      replace:'      padA: VF_POS.map(function(k){ return false; }),',
      why:'the padded 0s would stop being marked, so nothing shows the child what was padded' },

    /* --- 數線：兩個點都必須落在線上 --- */
    { file:'index', via:'index', expect:'does not fit inside',
      find:'    while (d > 7 * st && st <= MIL_MAX) st *= 10;',
      replace:'    while (d > 7 * st && st < MIL) st *= 10;',
      why:'this is the real bug that was caught: two values more than 7 apart push a point off the line' },
    { file:'index', via:'index', expect:'not at least one step inside',
      find:'    var lo = st * Math.floor(lo0 / st) - st;',
      replace:'    var lo = st * Math.floor(lo0 / st);',
      why:'without the one-step margin the smaller value sits exactly on the left end' },
    { file:'index', via:'index', expect:'NL',
      find:'    return { lo:lo, hi:lo + 10 * st, st:st, n:10 };',
      replace:'    return { lo:lo, hi:lo + 8 * st, st:st, n:10 };',
      why:'the span would stop matching the 10 ticks that actually get drawn' },

    /* --- 版面常數：上下左右都要驗 --- */
    { file:'index', via:'index', expect:'below the canvas',
      find:'  var G_CAP_DY = 26;',
      replace:'  var G_CAP_DY = 40;',
      why:'the caption would be pushed off the bottom of the grid canvas' },
    { file:'index', via:'index', expect:'above the canvas',
      find:'  var G_TITLE_DY = -14;                       // 標題在正方形上緣往上多遠（基線）',
      replace:'  var G_TITLE_DY = -44;                       // 標題在正方形上緣往上多遠（基線）',
      why:'the title would be pushed off the top' },
    { file:'index', via:'index', expect:'TRIO',
      find:'  var T_CAP_DY = 24;               // 格數在下緣往下多遠（基線）',
      replace:'  var T_CAP_DY = 44;               // 格數在下緣往下多遠（基線）',
      why:'the three captions would be clipped by the bottom of the canvas' },
    { file:'index', via:'index', expect:'TRIO',
      find:'  var T_XS = [28, 196, 364];       // 三張圖的左緣',
      replace:'  var T_XS = [28, 196, 420];       // 三張圖的左緣',
      why:'the third grid would stick out past the right edge' },
    { file:'index', via:'index', expect:'NLTEXT',
      find:'  var NL_BOT_DY = 56;       // B 的標籤：線的下面第二排',
      replace:'  var NL_BOT_DY = 30;       // B 的標籤：線的下面第二排',
      why:'B would land on the same row as the two end labels and overlap them' },
    { file:'index', via:'index', expect:'NLTEXT',
      find:'  var NL_TOP_DY = -22;      // A 的標籤：線的上面',
      replace:'  var NL_TOP_DY = 30;      // A 的標籤：線的上面',
      why:'A would drop onto the end-label row too' },

    /* --- 格子圖：塗的格數必須等於那個數 --- */
    { file:'index', via:'index', expect:'TRIO_CASES',
      find:'    { mil:50,  p:2, cells:5 }',
      replace:'    { mil:50,  p:2, cells:50 }',
      why:'0.05 would be drawn shading 50 squares, exactly the misconception the example exists to kill' },
    { file:'index', via:'index', expect:'TRIO_CASES',
      find:'    { mil:500, p:1, cells:50 },',
      replace:'    { mil:400, p:1, cells:40 },',
      why:'the first two panels would no longer be the same value written two ways' },
    { file:'index', via:'index', expect:'ZOOM',
      find:'      shade.push({ x:G_X, y:G_Y, w:cell, h:G_SIDE });                  // 最左邊那一條',
      replace:'      shade.push({ x:G_X, y:G_Y, w:cell, h:cell });                  // 最左邊那一條',
      why:'the tenths panel would shade one square instead of one whole strip' },
    { file:'index', via:'index', expect:'ZOOM',
      find:"      var srcH = (key === 'hundredth') ? G_SIDE : cell;",
      replace:'      var srcH = cell;',
      why:'the hundredths zoom would claim to magnify one square, not one strip' },
    { file:'index', via:'index', expect:'ZOOM',
      find:"    { key:'hundredth',  mil:10,  cut:100 },",
      replace:"    { key:'hundredth',  mil:10,  cut:10 },",
      why:'the case would say one hundredth is one part in ten' },

    /* --- 位值表的樣本 --- */
    { file:'index', via:'index', expect:'PV_CASES',
      find:'    { mil:3050, p:2 },   // 3.05   十分位是 0',
      replace:'    { mil:13050, p:2 },   // 3.05   十分位是 0',
      why:'a two-digit integer part breaks the read-aloud, which only handles one digit' },
    { file:'index', via:'index', expect:'PV_CASES',
      find:'    { mil:2007, p:3 },   // 2.007  十分位、百分位都是 0',
      replace:'    { mil:2007, p:2 },   // 2.007  十分位、百分位都是 0',
      why:'printing 2.007 with two places would truncate it on screen' },
    { file:'index', via:'index', expect:'PV: the samples',
      find:'    { mil:900,  p:2 }    // 0.90   末尾的 0',
      replace:'    { mil:900,  p:1 }    // 0.90   末尾的 0',
      why:'no sample would show a trailing zero any more, and deleting that case must be noticed' },

    /* --- 小遊戲（2026-10-04 改成五關五種玩法，§六之五）—— 每一條新的不變量一筆 --- */
    { file:'index', via:'index', expect:"GAME_ORDER should be",
      find:"  var GAME_ORDER = ['read', 'bead', 'sort', 'col', 'zero'];",
      replace:"  var GAME_ORDER = ['read', 'sort', 'bead', 'col', 'zero'];",
      why:"the rounds would no longer follow examples 1~5" },
    { file:'index', via:'index', expect:"under 44",
      find:"  var GPICK = 48;",
      replace:"  var GPICK = 40;",
      why:"pieces would be under 44px on a phone" },
    { file:'index', via:'index', expect:"scoring: a round should give",
      find:"    var pts = gMistake ? 10 : 20;",
      replace:"    var pts = 20;",
      why:"a round after mistakes would still give +20" },
    { file:'index', via:'index', expect:"a mistake does not cost 5",
      find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;",
      replace:"    elScore.textContent = gScore;",
      why:"mistakes would cost nothing" },
    { file:'index', via:'index', expect:"shown although nothing was taken",
      find:"(lost ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');",
      replace:"(true ? ' <span class=\"gminus\">' + L().gMinus + '</span>' : '');",
      why:"the −5 note would show at 0 points" },
    { file:'index', via:'index', expect:"measure to the box",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }",
      why:"nearestOpen would measure to the centre (the ones box loses to the narrow point box)" },
    { file:'index', via:'index', expect:"not the nearer column",
      find:"      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;\n      if (dd < bd",
      replace:"      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;\n      if (best) return;\n      if (dd < bd",
      why:"nearestOpen would take the first match in array order" },
    { file:'index', via:'index', expect:"skips it and lands in the next slot",
      find:"    return best && !best.done ? best : null;",
      replace:"    if (best && best.done){ best = null; list.forEach(function(b){ if (!b.done && Math.abs(pt.x - b.cx) <= b.hw + pad && Math.abs(pt.y - b.cy) <= b.hh + pad) best = b; }); }\n    return best;",
      why:"a drop on a finished slot would slide into the next one" },
    { file:'index', via:'index', expect:"already in order",
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"",
      why:"the sort tray could start in the answer order" },
    { file:'index', via:'index', expect:"without shuffle(...)",
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });",
      why:"trays would never be shuffled" },
    { file:'index', via:'index', expect:"no gen !== gGen guard",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n",
      replace:"",
      why:"a piece held across Restart could solve the new round" },
    { file:'index', via:'index', expect:"board generation is not bumped",
      find:"    gSolved = false; gMistake = false; gCtx = {}; gGen++;",
      replace:"    gSolved = false; gMistake = false; gCtx = {};",
      why:"the generation guard would never trip" },
    { file:'index', via:'index', expect:"stays selected",
      find:"      if (moved && B.selected === P){ el.classList.remove('sel'); B.selected = null; }\n",
      replace:"",
      why:"a tap-selected piece that is then dragged would stay selected" },
    { file:'index', via:'index', expect:"does not stop after level 2",
      find:"    if (hintLevel >= 2) gHintBtn.disabled = true;",
      replace:"    if (hintLevel >= 9) gHintBtn.disabled = true;",
      why:"the hint button would never stop" },
    { file:'index', via:'index', expect:"ahead mode does not give hint 1",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"    if (mode === 'ahedd'){ hintLevel = 1; showHint(); }",
      why:"ahead mode would lose its automatic hint" },
    { file:'index', via:'index', expect:"but the picture is",
      find:"    if (v === T) return { kind:'ok', v:v };",
      replace:"    if (Math.abs(v - T) <= 10) return { kind:'ok', v:v };",
      why:"reading 0.38 for 0.37 would be accepted" },
    { file:'index', via:'index', expect:"tenths written as strips",
      find:"    if (e.t === 0 && v === e.w * MIL + e.h * 100) return { kind:'tenth', v:v };",
      replace:"    if (v === e.w * MIL + e.h * 100) return { kind:'tenth', v:v };",
      why:"a reading would be called \"tenths written as strips\" when the picture has strips" },
    { file:'index', via:'index', expect:"should only get the format reminder",
      find:"    var m = /^(0|[1-9]\\d*)(?:\\.(\\d{1,3}))?$/.exec(s);",
      replace:"    var m = /^(\\d+)(?:\\.(\\d{1,3}))?$/.exec(s);",
      why:"01.3 would be judged instead of reminded" },
    { file:'index', via:'index', expect:"a badly written number counts as a mistake",
      find:"        if (r.kind === 'fmt'){ gMsg.textContent = d.gReadFmt; return; }",
      replace:"        if (r.kind === 'fmt'){ roundMiss(d.gReadFmt); return; }",
      why:"a typing slip would cost points" },
    { file:'index', via:'index', expect:"paired with its own reason",
      find:"r.kind === 'tenth' ? d.gReadTenth(e.h) : r.kind === 'whole'",
      replace:"r.kind === 'swap' ? d.gReadTenth(e.h) : r.kind === 'whole'",
      why:"a reading mistake would get another mistake's reason" },
    { file:'index', via:'index', expect:"not strip by strip",
      find:"  function sqCellXY(n, cell){ return { x:Math.floor(n / 10) * cell, y:(n % 10) * cell }; }",
      replace:"  function sqCellXY(n, cell){ return { x:(n % 10) * cell, y:Math.floor(n / 10) * cell }; }",
      why:"the squares would be shaded row by row, so a strip no longer shows 0.1" },
    { file:'index', via:'index', expect:"readMil() gives",
      find:"  function readMil(e){ return e.w * MIL + e.t * 100 + e.h * 10; }",
      replace:"  function readMil(e){ return e.w * MIL + e.t * 100 + e.h; }",
      why:"the read answer would be printed in thousandths" },
    { file:'index', via:'index', expect:"gReadDone",
      find:"(w ? '1 個 1、' : '') + t + ' 個 0.1、' + h + ' 個 0.01！'",
      replace:"(w ? '1 個 1、' : '') + h + ' 個 0.1、' + t + ' 個 0.01！'",
      why:"the solved message would swap tenths and hundredths" },
    { file:'index', via:'index', expect:"beadRule(column",
      find:"    return have >= want ? 'full' : '';",
      replace:"    return have > want ? 'full' : '';",
      why:"a column could take one bead more than its digit" },
    { file:'index', via:'index', expect:"should be \"zero\"",
      find:"    if (want === 0) return 'zero';\n",
      replace:"",
      why:"a bead on the 0 place would get the \"full\" reason" },
    { file:'index', via:'index', expect:"the thousandths digit is 0",
      find:"  var GAME_BEAD = [1304, 2031, 3105, 1042, 2403, 4012];",
      replace:"  var GAME_BEAD = [1340, 2031, 3105, 1042, 2403, 4012];",
      why:"a pool number would end in a trailing 0" },
    { file:'index', via:'index', expect:"the round is not solved exactly",
      find:"        if (have.join() === want.join()){",
      replace:"        if (have[0] === want[0]){",
      why:"the bead round would end after the ones" },
    { file:'index', via:'index', expect:"outside the space between",
      find:"  var BEAD = { size:16, gap:4, perRow:3, top:48 }",
      replace:"  var BEAD = { size:16, gap:4, perRow:4, top:48 }",
      why:"beads would stick out of their column" },
    { file:'index', via:'index', expect:"gBead2",
      find:"else if (have[k] < want[k]) parts.push(heads[k] + '還差 ' + (want[k] - have[k]) + ' 顆');",
      replace:"else if (have[k] < want[k]) parts.push(heads[k] + '還差 ' + want[k] + ' 顆');",
      why:"hint 2 would ignore the beads already placed" },
    { file:'index', via:'index', expect:"bead: columns",
      find:"BEAD_COL = { y:4, h:186, w:66, xs:[3, 81, 155, 229] }",
      replace:"BEAD_COL = { y:4, h:186, w:66, xs:[3, 60, 155, 229] }",
      why:"the ones and tenths columns would overlap" },
    { file:'index', via:'index', expect:"two cards are the same size",
      find:"{ v:2031, p:3 }, { v:2350, p:2 } ],",
      replace:"{ v:2031, p:3 }, { v:2300, p:2 } ],",
      why:"two sort cards would be equal" },
    { file:'index', via:'index', expect:"a card is accepted in a slot that is not its place",
      find:"        if (v !== c){\n          var plan = cmpPlan(",
      replace:"        if (v === -1){\n          var plan = cmpPlan(",
      why:"any card would fit any slot" },
    { file:'index', via:'index', expect:"the wrong way",
      find:"(big ? ' 大，要排在它後面。' : ' 小，要排在它前面。')",
      replace:"(big ? ' 大，要排在它前面。' : ' 小，要排在它後面。')",
      why:"the sort reason would send the card the wrong way" },
    { file:'index', via:'index', expect:"which is not what happened",
      find:"    if (N.borrow && N.t0 >= 0 && val === N.y - N.t0) return 'flip';\n",
      replace:"",
      why:"turning a subtraction round would get the generic reason" },
    { file:'index', via:'index', expect:"cin is",
      find:"        S.push({ k:key, v:P.R[i], x:P.A[i], y:P.B[i], cin:st.carryIn, s:st.sum });",
      replace:"        S.push({ k:key, v:P.R[i], x:P.A[i], y:P.B[i], cin:false, s:st.sum });",
      why:"colSteps would lose the carried-in 1" },
    { file:'index', via:'index', expect:"lent is",
      find:"lent:sb.lent, t0:sb.t0",
      replace:"lent:false, t0:sb.t0",
      why:"colSteps would forget that a place lent 1" },
    { file:'index', via:'index', expect:"a negative number in the reason",
      find:"        if (lent && t0 < 0) return '這一位是 0，",
      replace:"        if (false) return '這一位是 0，",
      why:"the 5 − 2.34 tenths reason would say \"0 剩 -1\"" },
    { file:'index', via:'index', expect:"a box can be filled out of order",
      find:"          if (s.i !== next){ roundMiss(d.gColOrder(d.gColKinds[N.k])); return false; }",
      replace:"          if (s.i < next){ roundMiss(d.gColOrder(d.gColKinds[N.k])); return false; }",
      why:"a later box could be filled first" },
    { file:'index', via:'index', expect:"a digit is accepted in the point box",
      find:"          if (!P.data.dot){ roundMiss(d.gColDotNeed); return false; }",
      replace:"          if (false){ roundMiss(d.gColDotNeed); return false; }",
      why:"a digit would fill the point box" },
    { file:'index', via:'index', expect:"the point is accepted in a digit box",
      find:"          if (P.data.dot){ roundMiss(d.gColDotNot); return false; }",
      replace:"          if (P.data.dot && false){ roundMiss(d.gColDotNot); return false; }",
      why:"the point card would fill a digit box" },
    { file:'index', via:'index', expect:"a 0 that lends",
      find:"{ a:5000, b:2340, op:'-' }, { a:3420",
      replace:"{ a:5300, b:2340, op:'-' }, { a:3420",
      why:"no problem would make a 0 lend" },
    { file:'index', via:'index', expect:"the addition never carries",
      find:"{ a:2370, b:1250, op:'+' }",
      replace:"{ a:2310, b:1250, op:'+' }",
      why:"an addition would need no carrying" },
    { file:'index', via:'index', expect:"does not state",
      find:"這一格寫 ' + v + '，不是 1。'; },",
      replace:"這一格寫 ' + (v + 1) % 10 + '，不是 1。'; },",
      why:"the \"do not write the 1\" reason would name the wrong digit" },
    { file:'index', via:'index', expect:"forgets a borrow",
      find:"(borrow ? t0 + ' 不夠減 ' + y + '，向左邊借 1 變成 ' + top",
      replace:"(borrow ? t0 + ' 不夠減 ' + y + '，變成 ' + top",
      why:"the subtraction reason would hide the borrow" },
    { file:'index', via:'index', expect:"zeroRule(",
      find:"  function zeroRule(m, g){ return m === g ? '' : (m > g ? 'big' : 'small'); }",
      replace:"  function zeroRule(m, g){ return m >= g ? '' : 'small'; }",
      why:"a 0.0d card would be accepted under the d-strip picture" },
    { file:'index', via:'index', expect:"five different cards",
      find:"{ m:10 * d, p:2 }, { m:10 * d, p:3 } ];",
      replace:"{ m:10 * d, p:2 }, { m:10 * d, p:2 } ];",
      why:"two zero cards would be identical" },
    { file:'index', via:'index', expect:"the reasons are swapped",
      find:"roundMiss(r === 'big' ? d.gZeroBig(P.data.t, dd) : d.gZeroSmall(P.data.t, dd));",
      replace:"roundMiss(r === 'small' ? d.gZeroBig(P.data.t, dd) : d.gZeroSmall(P.data.t, dd));",
      why:"the zero reasons would describe the other card" },
    { file:'index', via:'index', expect:"exactly its value in hundredths",
      find:"squareInto(B, x - G.side / 2, G.y, G.side, gv[b] / 10);",
      replace:"squareInto(B, x - G.side / 2, G.y, G.side, gv[b] / 100);",
      why:"the zero pictures would shade the wrong number of squares" },
    { file:'index', via:'index', expect:"placed cards of bin",
      find:"ZERO_CARD = { w:56, h:48, dx:30, y0:178, dy:52 }",
      replace:"ZERO_CARD = { w:56, h:48, dx:30, y0:178, dy:30 }",
      why:"placed cards would pile on top of each other" },
    { file:'index', via:'index', expect:"smaller than GPICK",
      find:"ZERO_CARD = { w:56, h:48,",
      replace:"ZERO_CARD = { w:56, h:42,",
      why:"the zero cards would be smaller than GPICK" },
    { file:'index', via:'index', expect:"out of range",
      find:"  var GAME_ZERO = [3, 4, 5, 6, 7, 8];",
      replace:"  var GAME_ZERO = [0, 4, 5, 6, 7, 8];",
      why:"d = 0 would make every card 0" },

    { file:'index', via:'index', expect:"two squares exactly when there is a whole square",
      find:"xs = e.w ? READ_XS.two : READ_XS.one;",
      replace:"xs = e.w ? READ_XS.one : READ_XS.two;",
      why:"the whole square would be drawn on top of the partial one (codex r1)" },
    { file:'index', via:'index', expect:"draw exactly one bead and count exactly one",
      find:"        have[c.k]++; c.num.textContent = have[c.k];",
      replace:"        have[c.k] += 2; c.num.textContent = have[c.k];",
      why:"one bead would count twice and the round could never finish (codex r1)" },
    { file:'index', via:'index', expect:"does not count exactly one (or the round ends",
      find:"        left.splice(left.indexOf(v), 1); placed++;",
      replace:"        left.splice(left.indexOf(v), 1); placed += 2;",
      why:"the sort round would end with two cards left (codex r1)" },
    { file:'index', via:'index', expect:"with the point still to place",
      find:"steps = CS.steps, next = 0, dotDone = false,",
      replace:"steps = CS.steps, next = 0, dotDone = true,",
      why:"the column round would end without the decimal point (codex r1)" },
    { file:'index', via:'index', expect:"zero: a placed card does not count exactly one",
      find:"        bn.n++;\n        P.lock(q.x, q.y); P.el.classList.add('placed');\n        placed++;",
      replace:"        bn.n++;\n        P.lock(q.x, q.y); P.el.classList.add('placed');\n        placed += 5;",
      why:"the zero round would end after one card (codex r1)" },
    { file:'index', via:'index', expect:"left to right, small to big",
      find:"  function sortSlotX(i){ return 150 + (i - 1.5) * SORT_SLOT.step; }",
      replace:"  function sortSlotX(i){ return 150 - (i - 1.5) * SORT_SLOT.step; }",
      why:"the slots would run big to small (codex r1)" },

    { file:'index', via:'index', expect:"does not name its operation",
      find:"return 'Work out the column ' + (op === '+' ? 'addition' : 'subtraction')",
      replace:"return 'Work out the column ' + (op === '+' ? 'addition' : 'addition')",
      why:"a subtraction would be called an addition (verifier finding)" },
    { file:'index', via:'index', expect:"does not follow this problem's operation",
      find:"      if (ask) ask.textContent = d.gColAsk(e.op);",
      replace:"      if (ask) ask.textContent = d.gColAsk('+');",
      why:"every column problem would be announced as an addition" },
    { file:'index', via:'index', expect:"names one operation, but the round can be either",
      find:"line up the decimal points and start from the right, with the hundredths.',\n        zero:",
      replace:"line up the decimal points and start from the right, with the hundredths (a column sum).',\n        zero:",
      why:"the static fallback prompt would name one operation" },

    /* --- 題庫 --- */
    { file:'index', via:'index', expect:'BANK',
      find:"        { stem:'0.7 ＋ 0.25 ＝ ？',\n          opts:['0.32', '0.9', '0.95', '1.95'], ans:2,",
      replace:"        { stem:'0.7 ＋ 0.25 ＝ ？',\n          opts:['0.32', '0.9', '0.95', '1.95'], ans:0,",
      why:'zh and en would disagree about which option is correct' },
    { file:'index', via:'index', expect:'BANK',
      find:"        { stem:'1.2 － 0.85 ＝ ？',",
      replace:"        { stem:'1.3 － 0.85 ＝ ？',",
      why:'changing the stem number leaves the marked answer wrong' },
    { file:'index', via:'index', expect:'BANK',
      find:"        { stem:'下面哪一個和 0.6 一樣大？',\n          opts:['0.60', '0.06', '0.66', '6.0'], ans:0,",
      replace:"        { stem:'下面哪一個和 0.6 一樣大？',\n          opts:['0.06', '0.60', '0.66', '6.0'], ans:0,",
      why:'"the same size as 0.6" would be answered with 0.06' },
    { file:'index', via:'index', expect:'BANK',
      find:"        { stem:'文字題：小安早上跑了 0.85 公里，下午跑了 1.4 公里。這一天一共跑了多少公里？',\n          opts:['0.99', '1.25', '2.25', '2.2'], ans:2,",
      replace:"        { stem:'文字題：小安早上跑了 0.85 公里，下午跑了 1.4 公里。這一天一共跑了多少公里？',\n          opts:['0.99', '1.25', '2.35', '2.2'], ans:2,",
      why:'0.85 + 1.4 would be marked as 2.35' },
    { file:'index', via:'index', expect:'BANK',
      find:"        { stem:'文字題：一瓶果汁有 5 公升，倒出 2.34 公升，還剩多少公升？',",
      replace:"        { stem:'文字題：一瓶果汁有 6 公升，倒出 2.34 公升，還剩多少公升？',",
      why:'the stem number would no longer produce the marked answer' },

    /* --- 速查卡與家長頁的措辭（SIBLING_RULES） --- */
    { file:'reference', via:'index', expect:'reference.html',
      find:"s4h2:'直式加減：對齊小數點',",
      replace:"s4h2:'直式加減：把數字對好',",
      why:'the cheat sheet would stop naming the decimal point as the thing you line up' },
    { file:'parents', via:'index', expect:'parents.html',
      find:'，再補一句：「<strong>位數多少不能用來判斷大小</strong>，這一點和整數不一樣。」\'',
      replace:'，再補一句：「<strong>位數多的通常比較小</strong>，這一點和整數不一樣。」\'',
      why:'the parents page would hand the adult a brand-new wrong rule' },
    { file:'review', via:'index', expect:'review.html',
      find:"          ? '對齊小數點之後，從最右邊那一位開始加' +",
      replace:"          ? '從最右邊那一位開始加' +",
      why:'the review page would stop telling the child to line up the decimal point' },

    /* --- review 的產生器 --- */
    { file:'review', via:'review', expect:'appears more than once',
      find:'          if (digs.filter(function(x){ return x === dig; }).length !== 1) continue;',
      replace:'          if (false) continue;',
      why:'"which place is the 6 in" would have two correct answers when the number holds two 6s' },
    { file:'review', via:'review', expect:'different numbers of places',
      find:'          if (pa === pb) continue;                       // 位數不同才是這一課的重點',
      replace:'          if (false) continue;                       // 位數不同才是這一課的重點',
      why:'compareTwo would stop exercising the padding rule it exists to teach' },
    { file:'review', via:'review', expect:'opts[ans] != correct',
      find:"          ans: order.indexOf(d.a > d.b ? 'a' : 'b'),",
      replace:"          ans: order.indexOf(d.a > d.b ? 'b' : 'a'),",
      why:'compareTwo would mark the smaller number as the bigger one' },
    { file:'review', via:'review', expect:'must guarantee a carry',
      find:"          if (!hasCarry(a, b)) continue;\n          return { a:a, b:b, op:'+' };",
      replace:"          return { a:a, b:b, op:'+' };",
      why:'addTwo says a column reaches 10, so the data must really carry' },
    { file:'review', via:'review', expect:'must guarantee a borrow',
      find:"          var a = randMil(2, 2), b = randMil(2, 2);\n          if (a <= b) continue;\n          if (!hasBorrow(a, b)) continue;",
      replace:"          var a = randMil(2, 2), b = randMil(2, 2);\n          if (a <= b) continue;",
      why:'subTwo says a column will not go, so the data must really borrow' },
    { file:'review', via:'review', expect:'duplicate option value',
      find:'    seen[milKey(correct)] = 1;',
      replace:'    seen[milKey(-1)] = 1;',
      why:'without the correct value in the seen set, a distractor can BE the answer and the child really sees three options' },
    { file:'review', via:'review', expect:'three distinct values',
      /* ⚠️ 光把 ps 改成 [1, 1, 3] 不夠 —— 產生器自己那一行「三個值都不同」的
         防護還在，會把撞到的抽樣丟掉。要同時拿掉它，才碰得到設定檔的斷言。
         （順帶證明了一件事：ps ＝ [1, 2, 3] 的時候三個值的位數各不相同，
         所以永遠不可能相等，那一行防護在現況下其實碰不到。） */
      find:'          var ps = [1, 2, 3];\n          var ms = ps.map(function(p){ return w * MIL + (randMil(0, p) % MIL); });\n          var sorted = ms.slice().sort(function(x, y){ return x - y; });\n          if (sorted[0] === sorted[1] || sorted[1] === sorted[2]) continue;   // 三個值都不同',
      replace:'          var ps = [1, 1, 3];\n          var ms = ps.map(function(p){ return w * MIL + (randMil(0, p) % MIL); });',
      why:'two same-length numbers can collide, and then "the biggest" is not unique' },
    { file:'review', via:'review', expect:'strictly between the two ends',
      find:'          var j = 1 + rnd(9);                             // 箭頭不放在兩端',
      replace:'          var j = rnd(11);                             // 箭頭不放在兩端',
      why:'the arrow could land on an end tick, where the answer is already printed on the picture' },
    { file:'review', via:'review', expect:'is outside the line',
      find:'    return LF_X0 + (m - lo) / (hi - lo) * (LF_X1 - LF_X0);',
      replace:'    return LF_X0 + (m - lo) / (hi - lo) * (LF_X1 - LF_X0) + 12;',
      why:'every tick and the arrow would slide right, off the end of the line' },
    { file:'review', via:'review', expect:'reads back as',
      find:'    var mx = lfX(lo + st * j, lo, hi);',
      replace:'    var mx = lfX(lo + st * (j + 1), lo, hi);',
      why:'the arrow alone would point one tick further right than the answer it is asking about' },
    { file:'review', via:'review', expect:'same row as the end labels',
      find:"        { x:mx,    y:LF_Y + LF_MARK_DY - LF_ARROW, text:'?', kind:'mark' }",
      replace:"        { x:mx,    y:LF_Y + LF_END_DY, text:'?', kind:'mark' }",
      why:'the question mark would drop onto the end-label row and could overlap it' },
    { file:'review', via:'review', expect:'singular/plural',
      find:"  function lotsEn(n, unit){ return n + (n === 1 ? ' lot of ' : ' lots of ') + unit; }",
      replace:"  function lotsEn(n, unit){ return n + ' lots of ' + unit; }",
      why:'"1 lots of 0.1" is real broken English that no numeric check would ever see' },
    { file:'review', via:'review', expect:'singular/plural',
      find:"  function placesEn(n){ return n + (n === 1 ? ' place' : ' places'); }",
      replace:"  function placesEn(n){ return n + ' places'; }",
      why:'"1 places right of the point" is the same trap in the other generator' },
    { file:'review', via:'review', expect:'must ask for',
      find:"            ? xa + ' 和 ' + xb + '，哪一個比較大？'",
      replace:"            ? xa + ' 和 ' + xb + '，哪一個最大？'",
      why:'the stem would stop asking the question the marked answer answers' },
    { file:'review', via:'review', expect:'why must contain',
      find:"          '。<strong>對齊的是小數點，不是最右邊的數字。</strong>'",
      replace:"          '。<strong>對齊的是最右邊的數字。</strong>'",
      why:'the explanation would teach the exact error the question exists to correct' },
    { file:'review', via:'review', expect:'count out of the lesson range',
      find:'          if (!(n >= 2 && n <= 9999 && n === Math.round(n))) continue;',
      replace:'          if (!(n >= 1 && n <= 9999 && n === Math.round(n))) continue;',
      why:'countUnits could ask "how many 0.1s make 0.1", a question with nothing in it' },
    { file:'review', via:'review', expect:'NO INVARIANT DEFINED',
      find:"    { id:'sameValue', cat:'compare',",
      replace:"    { id:'sameValueX', cat:'compare',",
      why:'simgen must refuse a generator that has no invariant, rather than skipping it' },
    { file:'review', via:'index', expect:'GEN_IDS',
      find:"    { id:'orderThree', cat:'compare',",
      replace:"    { id:'orderThreeX', cat:'compare',",
      why:'renaming a generator would silently drop its whole set of assertions' },
    /* ===== codex 審查（2026-08-30）修正之後補上的守門條件，每一條配一筆改壞 ===== */
    { file:'index', via:'index', expect:'would SHORTEN one of the numbers',
      find:'    var pad = Math.max(places(a), places(b), pa | 0, pb | 0);',
      replace:'    var pad = Math.max(places(a), places(b));',
      why:'the real bug codex found: 0.5 vs 0.500 was padded to "0.5 and 0.5", shortening 0.500' },
    { file:'index', via:'index', expect:'would subtract from',
      find:'    var top = (plan.borrow[i] === 1) ? t0 + 10 : t0;',
      replace:'    var top = (t0 < 0) ? t0 : ((plan.borrow[i] === 1) ? t0 + 10 : t0);',
      why:'this is the original bug: the tenths of 5.00 - 2.34 would narrate "leaving -1"' },
    { file:'index', via:'index', expect:'is not the digit the column form shows',
      find:'    var lent = (i < VF_POS.length - 1) && plan.borrow[i + 1] === 1;',
      replace:'    var lent = false;',
      why:'ignoring the borrow taken by the right makes the narration disagree with the column digits' },
    { file:'index', via:'index', expect:'no case leaves a trailing zero',
      find:"    { a:650,  b:450,  op:'+' },   // 0.65 + 0.45  百分位進位，十分位也進位",
      replace:"    { a:650,  b:460,  op:'+' },   // 0.65 + 0.45  百分位進位，十分位也進位",
      why:'the "column form gives 1.10 but we write 1.1" explanation would never appear again' },
    { file:'index', via:'index', expect:'the magnified panel must shade a full-width strip',
      find:'        shade:{ x:G_ZX, y:G_ZY, w:G_ZSIDE, h:G_ZSIDE / 10 },',
      replace:'        shade:{ x:G_ZX, y:G_ZY, w:0, h:G_ZSIDE / 10 },',
      why:'a zero-width shade paints nothing on screen while every height check stays green' },
    { file:'review', via:'review', expect:'is not a finite number',
      find:'      w:LF_W, h:LF_H, x0:LF_X0, x1:LF_X1, y:LF_Y,',
      replace:'      w:LF_W, h:LF_H, x0:LF_X0, x1:undefined, y:LF_Y,',
      why:'an undefined coordinate used to slip through every NaN comparison silently' },
    { file:'index', via:'index', expect:'does not match this config',
      find:"  var PLACE_KEYS = ['ones', 'tenth', 'hundredth', 'thousandth'];   // 索引就是 k（0~3）",
      replace:"  var PLACE_KEYS = ['ones', 'hundredth', 'tenth', 'thousandth'];   // 索引就是 k（0~3）",
      why:'a consistent swap in the page used to stay green because the check read the page\'s own array' },
    { file:'index', via:'index', expect:'stem must ask for',
      find:"        { stem:'0.5 和 0.48，哪一個比較大？',",
      replace:"        { stem:'0.5 和 0.48，哪一個比較小？',",
      why:'the stem would ask for the smaller one while the marked answer is still the bigger' },
    { file:'index', via:'index', expect:'key phrase',
      find:"                '位數多少不能用來判斷大小 —— 要從整數部分開始一位一位比：十分位 5 比 4 大，所以 0.5 比較大',",
      replace:"                '9.9',",
      why:'a misconception question has no arithmetic oracle, so swapping its prose answer used to pass' },
    { file:'index', via:'index', expect:'column addition starting from the whole-number part',
      find:'比大小和算加減之前，都先在最後面補 0 補成一樣長 —— 然後<strong>比大小</strong>從整數部分往右比，<strong>直式加減</strong>從最右邊那一位往左算。</strong>\'',
      replace:'比大小和算加減之前，先在最後面補 0 補成一樣長，再從整數部分開始一位一位對齊處理。</strong>\'',
      why:'the original footer applied the comparison walk to column arithmetic too' },
    { file:'parents', via:'index', expect:'carrying/borrowing WILL happen in the hundredths',
      find:'③ 直式加減要<strong>對齊小數點</strong>，進位與退位現在也可能發生在百分位。\'',
      replace:'③ 直式加減要<strong>對齊小數點</strong>，進位與退位現在會發生在百分位。\'',
      why:'1.60 + 2.70 carries only in the tenths, so the stronger claim is false' },

    { file:'index', via:'index', expect:'glues Chinese to a digit',
      find:"'所以要<strong>再向左邊借 1</strong>。借來的一個 ' + leftUnit + ' 換成 10 個這一位的，' +",
      replace:"'所以要<strong>再向左邊借 1</strong>。借來的一個' + leftUnit + '換成 10 個這一位的，' +",
      why:'this is the real spacing bug the montage exposed — only visible after the strings are joined' },
    { file:'index', via:'index', expect:'leaks undefined/NaN',
      find:"      s1result: function(one, cut){ return '一份是 ' + one + '，也就是 ' + cut + ' 份之一'; },",
      replace:"      s1result: function(one, cut){ return '一份是 ' + one + '，也就是 ' + cut.nope + ' 份之一'; },",
      why:'a narration that leaks undefined must be caught, not printed to a child' },
    { file:'index', via:'index', expect:'does not end in the column digit',
      find:'    return { carryIn:carryIn, sum:plan.A[i] + plan.B[i] + (carryIn ? 1 : 0) };',
      replace:'    return { carryIn:carryIn, sum:plan.A[i] + plan.B[i] };',
      why:'dropping the carried 1 from the narrated sum would contradict the column form' },

    /* ===== 第二輪 codex 審查（審「修正本身」）之後補上的守門條件 ===== */
    { file:'index', via:'index', expect:'isTrailingZero',
      find:'  function isTrailingZero(m, k){ return m % placeUnit(k - 1) === 0; }',
      replace:'  function isTrailingZero(m, k){ return true; }',
      why:'the interior 0 of 2.007 would be narrated as droppable, and the checker used to recompute the predicate itself' },
    { file:'index', via:'index', expect:'the narrated sum is',
      find:'    return { carryIn:carryIn, sum:plan.A[i] + plan.B[i] + (carryIn ? 1 : 0) };',
      replace:'    return { carryIn:carryIn, sum:plan.A[i] + plan.B[i] + (carryIn ? 1 : 0) + 10 };',
      why:'only the last digit was checked, so 5 + 4 could be narrated as = 19' },
    { file:'index', via:'index', expect:'needsDropZero says',
      find:'  function needsDropZero(res){ return fmtPad(res, 2) !== fmtNat(res); }',
      replace:'  function needsDropZero(res){ return fmtPad(res, 2) === fmtNat(res); }',
      why:'the explanation would appear on exactly the questions that do not need it' },
    { file:'index', via:'index', expect:'has no s4dropZero',
      find:"      s4dropZero: function(padded, natural){ return '直式算出來是 <strong>' + padded + '</strong>。末尾的 0 可以不寫（大小一樣），所以答案寫成 <strong>' + natural + '</strong>。'; },",
      replace:'',
      why:'deleting the function used to pass, because the check was guarded by typeof' },

    /* ===== 第三輪 codex 審查（只審檢查工具）之後補上的守門條件 ===== */
    { file:'index', via:'index', expect:'must spell out',
      find:"        var head = place + '：' + a + ' ＋ ' + b + (carryIn ? ' ＋ 進位的 1' : '') + ' ＝ ' + sum;",
      replace:"        var head = place + '：從右往左算';",
      why:'the addition narration had NO prose assertion at all — it could say anything' },
    { file:'index', via:'index', expect:'must spell out',
      find:"          : head + '，' + top + ' － ' + b + ' ＝ <strong>' + digit + '</strong>。';",
      replace:"          : head + '，' + top + ' － ' + (b + 1) + ' ＝ <strong>' + digit + '</strong>。';",
      why:'only "top and the answer appear somewhere" was required, so 10 - 5 = 6 used to pass' },
    { file:'index', via:'index', expect:'talks about carrying',
      find:"          ? '，滿 10 了，這一位寫 <strong>' + digit + '</strong>，向左邊進 <strong>1</strong>。'",
      replace:"          ? '，滿 10 了，這一位寫 <strong>' + digit + '</strong>。'",
      why:'the narration would stop telling the child to carry, on exactly the columns that carry' },
    { file:'index', via:'index', expect:'non-finite',
      find:'      shade.push({ x:G_X, y:G_Y, w:cell, h:cell });                    // 左上角那一格',
      replace:'      shade.push({ x:undefined, y:G_Y, w:cell, h:cell });                    // 左上角那一格',
      why:'an undefined coordinate rendered x="undefined" while every bound check stayed false' },

    { file:'review', via:'review', expect:'empty place is the whole point',
      find:'          if (d1 > 0 && d2 > 0 && d3 > 0) continue;          // 一定要有一個位是 0（那才是重點）',
      replace:'          if (false) continue;          // 一定要有一個位是 0（那才是重點）',
      why:'buildFromParts would stop producing the "empty place still needs its 0" case' }
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      placeName: d => {
        if (!d) return 'placeName: make() returned nothing';
        const dg = milDigitsRef(d.m);
        if (!dg) return 'placeName: m is not a valid milli value: ' + d.m;
        if (dg[0] !== 0) return 'placeName: the integer part must be a single digit (the uniqueness scan only covers the ones place onwards), got ' + d.m;
        if (fracLenRef(dg) !== d.p) return 'placeName: p says ' + d.p + ' places but ' + d.m + ' needs ' + fracLenRef(dg);
        if (!(Number.isInteger(d.k) && d.k >= 0 && d.k <= d.p)) return 'placeName: k out of range: ' + d.k;
        if (dg[1 + d.k] !== d.dig) return 'placeName: the digit at place ' + d.k + ' is ' + dg[1 + d.k] + ', not ' + d.dig;
        let hits = 0;
        for (let k = 0; k <= d.p; k++) if (dg[1 + k] === d.dig) hits++;
        if (hits !== 1) return 'placeName: the digit ' + d.dig + ' appears more than once in ' + d.m + ', so the question has two correct answers';
        return null;
      },
      placeValue: d => {
        if (!d) return 'placeValue: make() returned nothing';
        const dg = milDigitsRef(d.m);
        if (!dg) return 'placeValue: m is not a valid milli value: ' + d.m;
        if (fracLenRef(dg) !== d.p) return 'placeValue: p says ' + d.p + ' places but ' + d.m + ' needs ' + fracLenRef(dg);
        if (!(Number.isInteger(d.k) && d.k >= 1 && d.k <= d.p)) return 'placeValue: k out of range: ' + d.k;
        if (dg[1 + d.k] !== d.dig) return 'placeValue: digit mismatch at place ' + d.k;
        if (!(d.dig >= 1 && d.dig <= 9)) return 'placeValue: the digit must be 1..9, got ' + d.dig;
        return null;
      },
      countUnits: d => {
        if (!d) return 'countUnits: make() returned nothing';
        const dg = milDigitsRef(d.m);
        if (!dg) return 'countUnits: m is not a valid milli value: ' + d.m;
        if (!(Number.isInteger(d.k) && d.k >= 1 && d.k <= 3)) return 'countUnits: k out of range: ' + d.k;
        for (let x = d.k + 1; x <= 3; x++){
          if (dg[1 + x] !== 0) return 'countUnits: ' + d.m + ' is not a whole number of place-' + d.k + ' units';
        }
        /* ⚠️ 要從**十位**開始切，不是從個位：slice(1, …) 會把 12.3 的 1 丟掉，
           算出 23 個 0.1 而不是 123 個。整數部分現在只到 2，可是這個洞
           在有人把範圍放寬的那一天才會咬人。 */
        const n = Number(dg.slice(0, 2 + d.k).join(''));
        if (n !== d.n) return 'countUnits: it should be exactly one count of ' + n + ', got ' + d.n;
        if (!(n >= 2 && n <= 9999)) return 'countUnits: count out of the lesson range (n must be at least 2, or the question asks how many 0.1s make 0.1): ' + n;
        return null;
      },
      buildFromParts: d => {
        if (!d) return 'buildFromParts: make() returned nothing';
        const dg = milDigitsRef(d.m);
        if (!dg) return 'buildFromParts: m is not a valid milli value: ' + d.m;
        if (dg[0] !== 0) return 'buildFromParts: integer part must be a single digit';
        if (dg[1] !== d.w) return 'buildFromParts: whole part mismatch';
        for (let k = 1; k <= 3; k++){
          if (dg[1 + k] !== d.d[k - 1]) return 'buildFromParts: digit mismatch at place ' + k;
        }
        if (d.d[2] === 0) return 'buildFromParts: the thousandths digit must be non-zero so the number really has three places';
        if (d.d.filter(x => x === 0).length === 0)
          return 'buildFromParts: at least one decimal place must be 0 — that empty place is the whole point of the question';
        if (d.d.filter(x => x > 0).length < 2) return 'buildFromParts: fewer than two non-zero decimal places';
        return null;
      },
      compareTwo: d => {
        if (!d) return 'compareTwo: make() returned nothing';
        const A = milDigitsRef(d.a), B = milDigitsRef(d.b);
        if (!A || !B) return 'compareTwo: a or b is not a valid milli value';
        if (fracLenRef(A) !== d.pa || fracLenRef(B) !== d.pb) return 'compareTwo: pa/pb do not match the natural place counts';
        if (d.pa === d.pb) return 'compareTwo: the two numbers must have different numbers of places';
        if (cmpDigitsRef(A, B) === 0) return 'compareTwo: the two numbers are equal, so neither option is the answer';
        const dec = decidedByRef(A, B);
        if (dec.kind !== d.dec.kind) return 'compareTwo: dec.kind says ' + d.dec.kind + ' but the digits say ' + dec.kind;
        if (dec.kind === 'place' && dec.k !== d.dec.k) return 'compareTwo: dec.k says ' + d.dec.k + ' but the digits say ' + dec.k;
        return null;
      },
      sameValue: d => {
        if (!d) return 'sameValue: make() returned nothing';
        const dg = milDigitsRef(d.m);
        if (!dg) return 'sameValue: m is not a valid milli value';
        if (fracLenRef(dg) !== d.p) return 'sameValue: p does not match the natural place count';
        if (!(d.extra >= 1 && d.p + d.extra <= 3)) return 'sameValue: padding would go past the thousandths';
        if (Math.floor(d.m / 10) <= 0) return 'sameValue: shifting right would collapse the number to 0, so the distractor is unusable';
        return null;
      },
      orderThree: d => {
        if (!d) return 'orderThree: make() returned nothing';
        if (!Array.isArray(d.ms) || d.ms.length !== 3) return 'orderThree: needs three numbers';
        const dgs = d.ms.map(milDigitsRef);
        if (dgs.some(x => !x)) return 'orderThree: one of the numbers is not a valid milli value';
        for (let i = 0; i < 3; i++){
          if (fracLenRef(dgs[i]) !== d.ps[i]) return 'orderThree: ps[' + i + '] does not match the natural place count';
        }
        for (let i = 0; i < 3; i++){
          for (let j = i + 1; j < 3; j++){
            if (cmpDigitsRef(dgs[i], dgs[j]) === 0) return 'orderThree: needs three distinct values, but two are equal';
          }
        }
        if (typeof d.wantBig !== 'boolean') return 'orderThree: wantBig is not a boolean';
        return null;
      },
      addTwo: d => {
        const bad = addSubInv(d, '+');
        if (bad) return 'addTwo: ' + bad;
        if (fracLenRef(milDigitsRef(d.a)) !== 2 || fracLenRef(milDigitsRef(d.b)) !== 2)
          return 'addTwo: both operands must have exactly two decimal places';
        if (!carriesRef(d.a, d.b)) return 'addTwo: the explanation says a column reaches 10, so this pair must guarantee a carry';
        return null;
      },
      subTwo: d => {
        const bad = addSubInv(d, '-');
        if (bad) return 'subTwo: ' + bad;
        if (fracLenRef(milDigitsRef(d.a)) !== 2 || fracLenRef(milDigitsRef(d.b)) !== 2)
          return 'subTwo: both operands must have exactly two decimal places';
        if (!borrowsRef(d.a, d.b)) return 'subTwo: the explanation says a column will not go, so this pair must guarantee a borrow';
        return null;
      },
      padAddSub: d => {
        const bad = addSubInv(d, d && d.op);
        if (bad) return 'padAddSub: ' + bad;
        const pa = fracLenRef(milDigitsRef(d.a)), pb = fracLenRef(milDigitsRef(d.b));
        if (pa === pb) return 'padAddSub: the two operands must have different numbers of places — padding is the whole point';
        if (pa > 2 || pb > 2) return 'padAddSub: this lesson only adds and subtracts to two decimal places';
        return null;
      },
      wholeMinus: d => {
        const bad = addSubInv(d, '-');
        if (bad) return 'wholeMinus: ' + bad;
        if (fracLenRef(milDigitsRef(d.a)) !== 0) return 'wholeMinus: the first number must be a whole number';
        if (d.a === 0) return 'wholeMinus: the whole number must be at least 1';
        if (fracLenRef(milDigitsRef(d.b)) !== 2) return 'wholeMinus: the second number must have two decimal places';
        if (!borrowsRef(d.a, d.b)) return 'wholeMinus: subtracting from a whole number must really borrow';
        return null;
      },
      numberLine: d => {
        if (!d) return 'numberLine: make() returned nothing';
        if (d.st !== 10 && d.st !== 100) return 'numberLine: st must be 10 or 100, got ' + d.st;
        if (!(Number.isInteger(d.j) && d.j >= 1 && d.j <= 9))
          return 'numberLine: the arrow must sit strictly between the two ends, got j=' + d.j;
        if (d.lo % (d.st * 10) !== 0) return 'numberLine: the left end must be a round multiple of the whole span';
        if (d.lo + d.st * d.j !== d.v) return 'numberLine: v does not match lo + st * j';
        if (!milDigitsRef(d.v)) return 'numberLine: v is out of the lesson range';
        const f = d.fig;
        if (!f) return 'numberLine: make() did not attach the figure';
        /* ⚠️ 每一個要拿去比較的座標都要先確認是有限的數字。
           undefined < 0 和 undefined > w 都是 false，所以少一個欄位的話
           下面每一條邊界斷言都會靜靜通過（grade-4/fraction 的 NaN 教訓）。 */
        const numOk = v => typeof v === 'number' && isFinite(v);
        for (const key of ['w', 'h', 'x0', 'x1', 'y', 'lo', 'hi', 'st']){
          if (!numOk(f[key])) return 'numberLine: fig.' + key + ' is not a finite number: ' + f[key];
        }
        if (!f.mark || !numOk(f.mark.x)) return 'numberLine: fig.mark.x is not a finite number';
        if (!Array.isArray(f.ticks) || f.ticks.length !== 11) return 'numberLine: expected 11 ticks, got ' + (f.ticks || []).length;
        for (let i = 0; i < 11; i++){
          if (!f.ticks[i] || !numOk(f.ticks[i].x)) return 'numberLine: tick ' + i + ' has no finite x';
          if (!(f.ticks[i].x >= f.x0 - 0.01 && f.ticks[i].x <= f.x1 + 0.01)) return 'numberLine: tick ' + i + ' is outside the line';
          if (i > 0 && !(f.ticks[i].x > f.ticks[i - 1].x)) return 'numberLine: ticks are not in increasing order';
        }
        if (!(f.ticks[0].big && f.ticks[10].big)) return 'numberLine: the two end ticks must be the tall ones';
        /* 從畫出來的箭頭座標把值量回來 —— 這是第二條路：不看 v，看圖。 */
        const back = f.lo + (f.mark.x - f.x0) / (f.x1 - f.x0) * (f.hi - f.lo);
        if (Math.abs(back - d.v) > 0.5)
          return 'numberLine: the arrow is drawn where the scale reads back as ' + Math.round(back) + ', not ' + d.v;
        if (f.labels.length !== 3) return 'numberLine: expected exactly 3 labels';
        const ends = f.labels.filter(l => l.kind === 'end');
        const marks = f.labels.filter(l => l.kind === 'mark');
        if (ends.length !== 2 || marks.length !== 1) return 'numberLine: labels must be two ends plus one mark';
        if (ends[0].text !== digitsToStrRef(milDigitsRef(f.lo), 0)) return 'numberLine: the left label is not the left value';
        if (ends[1].text !== digitsToStrRef(milDigitsRef(f.hi), 0)) return 'numberLine: the right label is not the right value';
        if (marks[0].text !== '?') return 'numberLine: the arrow label must be a question mark, not the answer';
        if (!numOk(marks[0].y) || !numOk(ends[0].y) || Math.abs(marks[0].y - ends[0].y) < 16)
          return 'numberLine: the question mark sits on the same row as the end labels, so they can overlap';
        for (const l of f.labels){
          if (typeof l.text !== 'string' || !l.text.length) return 'numberLine: a label has no text';
          if (!numOk(l.x) || !numOk(l.y)) return 'numberLine: label "' + l.text + '" has a non-finite coordinate';
          const w = estTextW(l.text, 13);
          if (l.x - w / 2 < 0 || l.x + w / 2 > f.w) return 'numberLine: label "' + l.text + '" runs off the canvas';
          if (l.y < 12 || l.y > f.h - 4) return 'numberLine: label "' + l.text + '" is outside the canvas vertically';
        }
        return null;
      }
    },

    /* 正解的字串由這裡獨立算一次 —— 全部走「五格數字陣列」那條路，
       完全不呼叫 review.html 的 fmtPad／fmtNat／colPlan。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'placeName':
          return PLACE_TXT[lang][KEYS[d.k]];
        case 'placeValue': {
          const dg = new Array(DIG_N).fill(0);
          dg[1 + d.k] = d.dig;
          return digitsToStrRef(dg, 0);
        }
        case 'countUnits': {
          const n = Number(milDigitsRef(d.m).slice(0, 2 + d.k).join(''));
          return lang === 'zh' ? (n + ' 個') : String(n);
        }
        case 'buildFromParts':
          return digitsToStrRef([0, d.w, d.d[0], d.d[1], d.d[2]], 3);
        case 'compareTwo': {
          const A = milDigitsRef(d.a), B = milDigitsRef(d.b);
          return (cmpDigitsRef(A, B) > 0) ? digitsToStrRef(A, d.pa) : digitsToStrRef(B, d.pb);
        }
        case 'sameValue':
          return digitsToStrRef(milDigitsRef(d.m), d.p + d.extra);
        case 'orderThree': {
          const dgs = d.ms.map(milDigitsRef);
          let best = 0;
          for (let i = 1; i < 3; i++){
            const c = cmpDigitsRef(dgs[i], dgs[best]);
            if (d.wantBig ? c > 0 : c < 0) best = i;
          }
          return digitsToStrRef(dgs[best], d.ps[best]);
        }
        case 'addTwo': case 'padAddSub': case 'subTwo': case 'wholeMinus': {
          const op = (genId === 'addTwo') ? '+' : (genId === 'padAddSub' ? d.op : '-');
          const A = milDigitsRef(d.a), B = milDigitsRef(d.b);
          const r = (op === '+') ? addDigitsRef(A, B) : subDigitsRef(A, B);
          if (r.over !== 0) return 'OUT-OF-RANGE';
          return digitsToStrRef(r.digits, 0);
        }
        case 'numberLine': {
          /* 從圖上的箭頭座標量回值，再自己印一次 —— 不看 d.v。 */
          const f = d.fig;
          const back = Math.round(f.lo + (f.mark.x - f.x0) / (f.x1 - f.x0) * (f.hi - f.lo));
          return digitsToStrRef(milDigitsRef(back), 0);
        }
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

      if (genId === 'placeName'){
        const ok = KEYS.map(k => PLACE_TXT[lang][k]);
        if (ok.indexOf(s) < 0) return 'placeName option is not one of the four place names: ' + s;
        return null;
      }
      if (genId === 'countUnits'){
        const m = (lang === 'zh') ? /^(\d{1,6}) 個$/.exec(s) : /^(\d{1,6})$/.exec(s);
        if (!m) return 'countUnits option is not a plain count: ' + s;
        const n = Number(m[1]);
        if (!(n >= 1 && n <= 999999)) return 'countUnits option out of range: ' + s;
        return null;
      }
      const phrases = [PHRASE[lang].same, PHRASE[lang].cannotTell, PHRASE[lang].allSame];
      if (phrases.indexOf(s) >= 0){
        if (genId !== 'compareTwo' && genId !== 'orderThree')
          return 'a fixed-phrase option turned up in ' + genId + ', where every option should be a decimal: ' + s;
        if (isCorrect) return 'a fixed phrase must never be the correct answer in ' + genId + ': ' + s;
        return null;
      }
      const p = parseDecRef(s);
      if (!p) return 'option is not a well-formed decimal (0~99, at most 3 places): "' + s + '"';
      /* 解析出來再印回去要逐字相同 —— 一次抓住補零錯、前導零、末尾多的 0。 */
      if (!reprintOk(s)) return 'option does not survive parse-and-reprint: "' + s + '"';
      const v = milOf(p.dg);
      if (!(v >= 0 && v < MIL_MAX_REF)) return 'option out of the lesson range: ' + s;
      return null;
    },

    /* 拿渲染出來的那一題再驗一次：題幹問對了嗎、解釋講對了嗎、英文的 1 對嗎。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      const plain = String(q.stem).replace(/<[^>]+>/g, '');
      const whyPlain = String(q.why);

      if (!q.stem || !plain.trim()) out.push('empty stem');
      if (!q.why || !whyPlain.trim()) out.push('empty explanation');
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');

      const ask = ASK[genId];
      if (!ask) out.push('no ASK entry for generator ' + genId + ' — the stem is unguarded');
      else {
        (ask[lang].must || []).forEach(w => {
          if (plain.indexOf(w) < 0) out.push('the stem must ask for "' + w + '" but says: ' + plain.slice(0, 80));
        });
        (ask[lang].never || []).forEach(w => {
          if (plain.indexOf(w) >= 0) out.push('the stem must not contain "' + w + '": ' + plain.slice(0, 80));
        });
      }

      const wm = WHY_MUST[genId];
      if (!wm) out.push('no WHY_MUST entry for generator ' + genId + ' — the explanation is unguarded');
      else {
        (wm[lang] || []).forEach(w => {
          if (whyPlain.indexOf(w) < 0)
            out.push('why must contain "' + w + '" but says: ' + whyPlain.replace(/<[^>]+>/g, '').slice(0, 90));
        });
      }

      /* 加減四支：解釋裡一定要有整條算式，而且答案要對得上獨立算出來的值。 */
      if (['addTwo', 'subTwo', 'padAddSub', 'wholeMinus'].indexOf(genId) >= 0){
        const op = (genId === 'addTwo') ? '+' : (genId === 'padAddSub' ? d.op : '-');
        const A = milDigitsRef(d.a), B = milDigitsRef(d.b);
        const r = (op === '+') ? addDigitsRef(A, B) : subDigitsRef(A, B);
        const xa = digitsToStrRef(A, 0), xb = digitsToStrRef(B, 0), res = digitsToStrRef(r.digits, 0);
        const sign = (op === '+') ? (lang === 'zh' ? '＋' : '+') : (lang === 'zh' ? '－' : '-');
        const eq = xa + ' ' + sign + ' ' + xb + ' ' + (lang === 'zh' ? '＝' : '=') + ' ' + res;
        if (whyPlain.indexOf(eq) < 0) out.push('why must spell out the whole calculation "' + eq + '"');
      }

      /* 英文的 1：只有這個值會錯，而且沒有任何數值檢查看得到。 */
      if (lang === 'en'){
        const all = plain + ' ' + whyPlain + ' ' + q.opts.join(' ');
        const bad = all.match(PLURAL_RE) || all.match(THERE_ARE_RE);
        if (bad) out.push('English singular/plural is wrong near "' + bad[0] + '"');
      }

      /* 選項兩兩不同「意思」。simgen 內建的 vkey 只正規化第一個數字，
         「一樣大」這種說法它比不出來，所以這裡再比一次。 */
      const keys = q.opts.map(o => {
        const p = parseDecRef(String(o));
        return p ? ('v' + milOf(p.dg)) : ('s' + String(o));
      });
      for (let x = 0; x < keys.length; x++){
        for (let y = x + 1; y < keys.length; y++){
          if (keys[x] === keys[y]) out.push('two options mean the same thing: ' + q.opts[x] + ' / ' + q.opts[y]);
        }
      }

      /* 有圖的題目：圖必須真的在，而且答案不可以印在圖上。 */
      if (q.fig){
        if (genId !== 'numberLine') out.push('only numberLine should carry a figure, but ' + genId + ' does');
        const answerText = q.opts[q.ans];
        q.fig.labels.forEach(l => {
          if (l.text === answerText) out.push('the answer ' + answerText + ' is printed on the picture');
        });
      } else if (genId === 'numberLine'){
        out.push('numberLine rendered without its figure');
      }

      return out.length ? out.join(' | ') : null;
    },

    /* 刻意的迷思誘答：三支產生器的「位值錯位」誘答剛好是題幹裡的那個數字。
       ⚠️ 白名單是「這一個值」的謂詞，不是整個產生器全開 ——
       整支開掉的話，不小心把題幹別的數字抄回來也會被一起蓋掉。 */
    stemEchoOk: {
      /* 「完全忽略位」：0.85 的百分位 5 被讀成 5。這是這一課最典型的錯。 */
      placeValue: function(d, opt, lang, idx){
        return String(opt) === digitsToStrRef(milDigitsRef(d.dig * 1000), 0);
      },
      /* 「小數點不算」：0.2 被當成 2。 */
      sameValue: function(d, opt, lang, idx){
        return d.m * 10 < MIL_MAX_REF && String(opt) === digitsToStrRef(milDigitsRef(d.m * 10), 0);
      },
      /* 化聚時把位數算錯一位：27 個 0.1 被答成 2 個（或 270、2700）。
         英文的選項是純數字，所以只有英文會撞到題幹的數字。 */
      countUnits: function(d, opt, lang, idx){
        const n = Number(milDigitsRef(d.m).slice(0, 2 + d.k).join(''));
        const txt = v => (lang === 'zh' ? (v + ' 個') : String(v));
        const allowed = [Math.floor(n / 10), n * 10, n * 100].filter(v => v > 0);
        return allowed.some(v => String(opt) === txt(v));
      },
      /* 加減四支：唯一允許的是「每一位各自算、完全不進位／不退位」那個誘答
         （1.46 ＋ 0.64 被算成 1）。它剛好會等於題幹的第一個數字時才撞上。 */
      addTwo:     (d, opt) => noCarryEcho(d, '+', opt),
      subTwo:     (d, opt) => noCarryEcho(d, '-', opt),
      padAddSub:  (d, opt) => noCarryEcho(d, d.op, opt),
      wholeMinus: (d, opt) => noCarryEcho(d, '-', opt)
    }
  },

  /* ================= index.html 的範例、遊戲與題庫 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{MIL, MIL_MAX, isMil, placeUnit, digitAt, places, fmtPad, fmtNat, placeValue, ' +
                'PLACE_KEYS, cmpPlan, VF_POS, colPlan, addStep, subStep, isTrailingZero, needsDropZero, ' +
                'zoomPlan, nlPlan, nlX, trioPlan, ' +
                'ZOOM_CASES, PV_CASES, CMP_CASES, VF_CASES, TRIO_CASES, ' +
                'GPICK, shuffle, pick, READ_H, READ_CAP, READ_GRID, READ_XS, GAME_READ, readMil, sqCellXY, readRule, ' +
                'BEAD_H, BEAD_COL, BEAD_DOT, BEAD_PAD, BEAD, BEAD_SRC, GAME_BEAD, beadXY, beadRule, ' +
                'SORT_H, SORT_LBL, SORT_SLOT, SORT_CARD, SORT_PAD, GAME_SORT, sortSlotX, ' +
                'COL_H, COL_X, COL_Y, COL_SLOT, COL_PSLOT, COL_CSLOT, COL_PAD, COL_KEYS, GAME_COL, colKeyXY, COL_KEY_OF, colSteps, colRule, ' +
                'ZERO_H, ZERO_GRID, ZERO_XS, ZERO_BIN, ZERO_PAD, ZERO_CARD, ZERO_TRAY, GAME_ZERO, zeroCards, zeroPlacedXY, zeroRule, ' +
                'G_W, G_H, G_X, G_Y, G_SIDE, G_ZX, G_ZY, G_ZSIDE, G_CAP_DY, G_TITLE_DY, G_FONT, ' +
                'NL_W, NL_H, NL_X0, NL_X1, NL_Y, NL_TICK, NL_BIGTICK, NL_FONT, ' +
                'NL_TOP_DY, NL_END_DY, NL_BOT_DY, NL_DOT, ' +
                'T_W, T_H, T_Y, T_SIDE, T_XS, T_TITLE_DY, T_CAP_DY, T_FONT}',
    optionValueMax: 99,

    check: function(data, I18N, fail, src){
      const {
        MIL, MIL_MAX, isMil, placeUnit, digitAt, places, fmtPad, fmtNat, placeValue,
        PLACE_KEYS, cmpPlan, VF_POS, colPlan, addStep, subStep, isTrailingZero, needsDropZero,
        zoomPlan, nlPlan, nlX, trioPlan,
        ZOOM_CASES, PV_CASES, CMP_CASES, VF_CASES, TRIO_CASES,
        G_W, G_H, G_X, G_Y, G_SIDE, G_ZX, G_ZY, G_ZSIDE, G_CAP_DY, G_TITLE_DY, G_FONT,
        NL_W, NL_H, NL_X0, NL_X1, NL_Y, NL_FONT, NL_TOP_DY, NL_END_DY, NL_BOT_DY,
        T_W, T_H, T_Y, T_SIDE, T_XS, T_TITLE_DY, T_CAP_DY, T_FONT
      } = data;

      const int = x => Number.isInteger(x);
      /* ⚠️ 每一個要拿去比較的座標都要先確認是有限的數字。
         undefined < 0 和 undefined > W 都是 false，所以少一個欄位的話
         下面每一條邊界斷言都會靜靜通過，畫面卻印出 x="undefined"。
         R8 一開始只補了複習頁的數線，格子圖與三張小圖還開著（codex 第三輪抓到）。 */
      const fin = v => typeof v === 'number' && isFinite(v);
      const finBox = (bx, where) => {
        ['x', 'y', 'w', 'h'].forEach(k => {
          if (!fin(bx[k])) fail('GEOM: ' + where + ' has a non-finite ' + k + ': ' + bx[k]);
        });
        return fin(bx.x) && fin(bx.y) && fin(bx.w) && fin(bx.h);
      };

      /* ---------- 位名的鍵順序 ----------
         ⚠️ 頁面的 PLACE_KEYS 必須和這份設定檔的 KEYS 逐字相同。少了這一條，
         「第 k 位叫什麼」的每一條斷言都是拿頁面自己的陣列當標準答案 ——
         頁面把十分位和百分位一起換掉，檢查照樣全綠（codex 抓到的）。 */
      if (PLACE_KEYS.join(',') !== KEYS.join(','))
        fail('KEYS: the page place-key order [' + PLACE_KEYS.join(',') + '] does not match this config [' + KEYS.join(',') + ']');

      /* ---------- 0. 兩套實作要在整個定義域上同意 ---------- */
      /* ⚠️ 這一課的定義域只有 100000 個值，所以**整個走完**，不要抽樣。
         「前綴 ＋ 步長」聽起來像窮舉，其實不是：步長 7 從 3000 起跳的話
         m ＝ 4000 永遠走不到（3000 ＋ 7n ＝ 4000 沒有整數解），
         而 4.000 剛好是「整數 ＋ 末尾全是 0」那個邊界（codex 第三輪抓到）。 */
      /* places() 先驗 —— 它排在 fmtPad 前面是刻意的：fmtPad 內部用 places()，
         所以 places 壞掉會先被 FMT 那一段抓到，PLACES 這一條就永遠沒被證明過
         （codex 第三輪抓到的 break-masking）。 */
      let mism = 0;
      for (let m = 0; m < MIL_MAX && mism < 4; m++){
        if (places(m) !== fracLenRef(milDigitsRef(m))){
          fail('PLACES: places(' + m + ') = ' + places(m) + ' but the digits say ' + fracLenRef(milDigitsRef(m)));
          mism++;
        }
      }
      mism = 0;
      for (let m = 0; m < MIL_MAX && mism < 4; m++){
        for (let p = 0; p <= 3 && mism < 4; p++){
          const s = fmtPad(m, p);
          const parsed = parseDecRef(s);
          if (!parsed){ fail('FMT: fmtPad(' + m + ', ' + p + ') is not a well-formed decimal: "' + s + '"'); mism++; continue; }
          if (milOf(parsed.dg) !== m){ fail('FMT: fmtPad truncates — fmtPad(' + m + ', ' + p + ') = "' + s + '" reads back as ' + milOf(parsed.dg)); mism++; continue; }
          const want = digitsToStrRef(milDigitsRef(m), p);
          if (s !== want){ fail('FMT: fmtPad(' + m + ', ' + p + ') = "' + s + '" but the digit route says "' + want + '"'); mism++; }
        }
      }
      mism = 0;
      for (let m = 0; m < MIL_MAX && mism < 4; m++){
        const dg = milDigitsRef(m);
        for (let k = -1; k <= 3 && mism < 4; k++){
          if (digitAt(m, k) !== dg[1 + k]){ fail('DIGIT: digitAt(' + m + ', ' + k + ') = ' + digitAt(m, k) + ', the digits say ' + dg[1 + k]); mism++; }
        }
        for (let k = 0; k <= 3 && mism < 4; k++){
          const pv = new Array(DIG_N).fill(0);
          pv[1 + k] = dg[1 + k];
          if (placeValue(m, k) !== milOf(pv)){ fail('FMT: placeValue(' + m + ', ' + k + ') disagrees with the digit route'); mism++; }
        }
      }
      /* cmpPlan：課程教的規則（先整數部分，再一位一位）必須等於逐格比較，
         而且步驟本身要自洽 —— 分出大小之後不可以繼續比。 */
      mism = 0;
      for (let i = 0; i < 60000 && mism < 4; i++){
        /* ⚠️ 兩條同餘式湊不出 a === b，所以「相等」那一支永遠沒被測到。
           每 7 筆插一組相等的，另外前 400 筆走小值。 */
        const a = (i < 400) ? i : (i * 1741) % MIL_MAX;
        const b = (i % 7 === 0) ? a : ((i < 400) ? (i + 1) % MIL_MAX : (i * 9007 + 313) % MIL_MAX);
        const plan = cmpPlan(a, b);
        const want = cmpDigitsRef(milDigitsRef(a), milDigitsRef(b));
        if (plan.cmp !== want){ fail('CMP: cmpPlan(' + a + ', ' + b + ').cmp = ' + plan.cmp + ', the digit route says ' + want); mism++; continue; }
        const last = plan.steps[plan.steps.length - 1];
        if (want !== 0 && last.cmp !== want){ fail('CMP: the last step of cmpPlan(' + a + ', ' + b + ') does not carry the verdict'); mism++; continue; }
        if (want === 0 && plan.steps.some(s => s.cmp !== 0)){ fail('CMP: equal values but a step claims a difference (' + a + ')'); mism++; continue; }
        let broke = false;
        for (let k = 0; k < plan.steps.length - 1; k++){
          if (plan.steps[k].cmp !== 0){ fail('CMP: cmpPlan kept comparing after the verdict was settled (' + a + ', ' + b + ')'); mism++; broke = true; break; }
        }
        if (broke) continue;
        if (want === 0 && plan.steps.length !== plan.pad + 1){ fail('CMP: equal values should walk every padded place (' + a + ')'); mism++; continue; }
        const decRef = decidedByRef(milDigitsRef(a), milDigitsRef(b));
        const decPage = (last.kind === 'whole') ? { kind:'whole' } : { kind:'place', k:last.k };
        if (want !== 0){
          if (decRef.kind !== decPage.kind){ fail('CMP: the deciding step disagrees for ' + a + ' vs ' + b); mism++; }
          else if (decRef.kind === 'place' && decRef.k !== decPage.k){ fail('CMP: the deciding place disagrees for ' + a + ' vs ' + b); mism++; }
        }
      }
      /* colPlan：一欄一欄的加減，和五格數字陣列那條路必須逐一同意。 */
      mism = 0;
      for (let i = 0; i < 40000 && mism < 4; i++){
        /* 同上：每 5 筆插一組 a === b（12.30 － 12.30 這種原本測不到）。 */
        const a = ((i < 400) ? i : (i * 731) % 10000) * 10;
        const b = (i % 5 === 0) ? a : (((i * 4177 + 77) % 10000) * 10);
        if (a + b < MIL_MAX){
          const p = colPlan(a, b, '+');
          const r = addDigitsRef(milDigitsRef(a), milDigitsRef(b));
          if (p.over !== 0){ fail('COL: colPlan(' + a + ', ' + b + ", '+') reports a leftover carry"); mism++; }
          if (p.res !== a + b){ fail('COL: colPlan res is wrong for ' + a + ' + ' + b); mism++; }
          const got = p.R[0] * 10000 + p.R[1] * MIL + p.R[2] * 100 + p.R[3] * 10;
          if (got !== milOf(r.digits)){ fail('COL: the column digits for ' + a + ' + ' + b + ' disagree with the digit route'); mism++; }
        }
        if (a >= b){
          const q = colPlan(a, b, '-');
          const r2 = subDigitsRef(milDigitsRef(a), milDigitsRef(b));
          if (q.over !== 0){ fail('COL: colPlan(' + a + ', ' + b + ", '-') reports a leftover borrow"); mism++; }
          if (q.res !== a - b){ fail('COL: colPlan res is wrong for ' + a + ' - ' + b); mism++; }
          const got2 = q.R[0] * 10000 + q.R[1] * MIL + q.R[2] * 100 + q.R[3] * 10;
          if (got2 !== milOf(r2.digits)){ fail('COL: the column digits for ' + a + ' - ' + b + ' disagree with the digit route'); mism++; }
        }
      }

      /* ---------- 1. nlPlan：窮舉，不抽樣 ----------
         參數空間有界，所以整段掃過去。教訓來自 grade-3/perimeter：
         「連抽 40 批都乾淨」不等於沒問題。 */
      mism = 0;
      const NL_STEPS = [1, 10, 100, 1000];
      /* ⚠️ 上一版是「每 37 個 st 跳一次 ＋ 七個手挑的間距」，所以 st ＝ 10 的時候
         a ＝ 20、b ＝ 40 這一組從來沒被走到過。現在把間距從 0 走到 12 個 st
         （跨過 7 * st 那個門檻的兩邊都掃到），左端則走遍「st 的倍數」與
         「不是 st 的倍數」、最小值與接近上界的值。 */
      /* ⚠️ 0 也在定義域裡，而上一版每一個左端都至少是 st —— 只在 0 壞掉的缺陷過得去。 */
      const NL_LOS = st => [0, st, 2 * st, 3 * st, st + 1, 7 * st, 37 * st,
                            500 * st, Math.max(st, MIL_MAX - 13 * st - 1)];
      const NL_GAPS = st => {
        const g = [];
        for (let k = 0; k <= 12; k++) g.push(k * st);
        [40, 400, 4000].forEach(k => g.push(k * st));   // 逼 st 升級
        return g;
      };
      NL_STEPS.forEach(st => {
        NL_LOS(st).forEach(lo0 => {
          NL_GAPS(st).forEach(dd => {
            if (mism >= 4) return;
            const a = lo0, b = lo0 + dd;
            if (!(a >= 0 && a < MIL_MAX) || b >= MIL_MAX) return;
            const plan = nlPlan(a, b);
            if (plan.hi - plan.lo !== 10 * plan.st){ fail('NL: the span is not 10 steps for ' + a + '/' + b); mism++; return; }
            if (plan.lo % plan.st !== 0 || plan.lo < 0){ fail('NL: the left end is not a clean multiple for ' + a + '/' + b); mism++; return; }
            if (plan.st <= 0 || Math.pow(10, Math.round(Math.log10(plan.st))) !== plan.st){ fail('NL: the step is not a power of ten: ' + plan.st); mism++; return; }
            if (Math.min(a, b) < plan.lo || Math.max(a, b) > plan.hi){
              fail('NL: ' + a + '/' + b + ' does not fit inside [' + plan.lo + ', ' + plan.hi + '] — a point is drawn off the line');
              mism++; return;
            }
            [a, b].forEach(v => {
              const x = nlX(v, plan);
              if (!(x >= NL_X0 - 0.01 && x <= NL_X1 + 0.01)){ fail('NL: nlX(' + v + ') = ' + x + ' is outside [' + NL_X0 + ', ' + NL_X1 + ']'); mism++; }
            });
          });
        });
      });

      /* ---------- 2. 範例 1：放大鏡的每一塊都要在畫布裡 ---------- */
      if (ZOOM_CASES.length !== 3) fail('ZOOM: expected three zoom cases, got ' + ZOOM_CASES.length);
      const zoomKeys = ZOOM_CASES.map(c => c.key).join(',');
      if (zoomKeys !== 'tenth,hundredth,thousandth')
        fail('ZOOM: the three cases must be tenth, hundredth, thousandth in that order, got ' + zoomKeys);
      const cell = G_SIDE / 10;
      ZOOM_CASES.forEach(c => {
        if (c.mil * c.cut !== MIL)
          fail('ZOOM: case ' + c.key + ' says one part is ' + c.mil + ' and there are ' + c.cut + ' parts, which does not make 1');
        const want = { tenth:100, hundredth:10, thousandth:1 }[c.key];
        if (c.mil !== want) fail('ZOOM: case ' + c.key + ' should be worth ' + want + ' milli, not ' + c.mil);

        const plan = zoomPlan(c.key);
        if (!plan || !plan.main){ fail('ZOOM: zoomPlan(' + c.key + ') returned nothing usable'); return; }
        if (plan.main.x !== G_X || plan.main.y !== G_Y || plan.main.side !== G_SIDE)
          fail('ZOOM: the main square does not use the exported layout constants');
        if (plan.main.cols !== 10) fail('ZOOM: the main square must always be cut into 10 columns');
        if (plan.main.rows !== (c.key === 'tenth' ? 1 : 10))
          fail('ZOOM: case ' + c.key + ' draws ' + plan.main.rows + ' rows');
        if (plan.shade.length !== 1){ fail('ZOOM: expected exactly one shaded block in ' + c.key); return; }
        const sh = plan.shade[0];
        const wantH = (c.key === 'tenth') ? G_SIDE : cell;
        if (Math.abs(sh.w - cell) > 1e-9 || Math.abs(sh.h - wantH) > 1e-9)
          fail('ZOOM: case ' + c.key + ' shades ' + sh.w + ' x ' + sh.h + ', expected ' + cell + ' x ' + wantH);
        /* 「這一課教的那一份是多大」必須真的畫得出來。
           ⚠️ 沒有放大鏡的時候（tenth），那一份就是主圖塗的那一塊；
           有放大鏡的時候，那一份是**放大鏡裡塗的那一條**，也就是
           「被放大的那一小塊」再平分成 10 份的一份 —— 主圖塗的那一格
           是「被拿去切的東西」，不是這一課要教的那一份。
           第一版把兩者混為一談，於是千分位那一格被判成 0.01。 */
        const mainFrac = (sh.w * sh.h) / (G_SIDE * G_SIDE);
        if (!plan.zoom){
          if (Math.abs(mainFrac - c.mil / MIL) > 1e-9)
            fail('ZOOM: case ' + c.key + ' shades ' + mainFrac + ' of the square but the value is ' + (c.mil / MIL));
        } else {
          const srcFrac = (plan.zoom.src.w * plan.zoom.src.h) / (G_SIDE * G_SIDE);
          /* ⚠️ 放大鏡裡塗的那一條必須是**整條寬**、而且面積不可以是 0。
             只驗高度的話，把寬度設成 0 會讓畫面什麼都沒塗，檢查照樣綠。 */
          if (!fin(plan.zoom.shade.w) || !fin(plan.zoom.shade.h) || !fin(plan.zoom.side))
            fail('ZOOM: the magnified panel has a non-finite size in ' + c.key);
          if (!(plan.zoom.shade.w > 0 && plan.zoom.shade.h > 0))
            fail('ZOOM: the magnified panel shades a zero-area rectangle in ' + c.key);
          if (Math.abs(plan.zoom.shade.w - plan.zoom.side) > 1e-9)
            fail('ZOOM: the magnified panel must shade a full-width strip, got width ' + plan.zoom.shade.w);
          const shareInSquare = srcFrac * (plan.zoom.shade.h / plan.zoom.side);
          if (Math.abs(shareInSquare - c.mil / MIL) > 1e-9)
            fail('ZOOM: case ' + c.key + ' magnifies ' + srcFrac + ' of the square and shades one tenth of it, ' +
                 'which is ' + shareInSquare + ' — but the value being taught is ' + (c.mil / MIL));
          /* 被放大的那一小塊自己也要對：百分位放大一條（十分之一），千分位放大一格（百分之一）。 */
          const srcWantFrac = (c.key === 'hundredth') ? 0.1 : 0.01;
          if (Math.abs(srcFrac - srcWantFrac) > 1e-9)
            fail('ZOOM: case ' + c.key + ' magnifies ' + srcFrac + ' of the square, expected ' + srcWantFrac);
        }

        const boxes = [{ x:plan.main.x, y:plan.main.y, w:G_SIDE, h:G_SIDE }, { x:sh.x, y:sh.y, w:sh.w, h:sh.h }];
        if (plan.zoom){
          boxes.push({ x:plan.zoom.x, y:plan.zoom.y, w:plan.zoom.side, h:plan.zoom.side });
          boxes.push({ x:plan.zoom.shade.x, y:plan.zoom.shade.y, w:plan.zoom.shade.w, h:plan.zoom.shade.h });
          boxes.push({ x:plan.zoom.src.x, y:plan.zoom.src.y, w:plan.zoom.src.w, h:plan.zoom.src.h });
          if (plan.zoom.rows !== 10) fail('ZOOM: the magnified panel must be cut into 10, got ' + plan.zoom.rows);
          if (Math.abs(plan.zoom.shade.h - plan.zoom.side / 10) > 1e-9)
            fail('ZOOM: the magnified panel shades ' + plan.zoom.shade.h + ', expected one tenth of the panel');
          const srcWant = (c.key === 'hundredth') ? G_SIDE : cell;
          if (Math.abs(plan.zoom.src.h - srcWant) > 1e-9)
            fail('ZOOM: case ' + c.key + ' magnifies a source of height ' + plan.zoom.src.h + ', expected ' + srcWant);
          if (plan.links.length !== 2) fail('ZOOM: expected two connector lines, got ' + plan.links.length);
          plan.links.forEach(l => {
            [[l.x1, l.y1], [l.x2, l.y2]].forEach(pt => {
              if (!fin(pt[0]) || !fin(pt[1])){ fail('ZOOM: a connector endpoint is non-finite in ' + c.key); return; }
              if (pt[0] < 0 || pt[0] > G_W || pt[1] < 0 || pt[1] > G_H)
                fail('ZOOM: a connector line leaves the canvas at ' + pt.join(','));
            });
          });
        } else if (c.key !== 'tenth'){
          fail('ZOOM: case ' + c.key + ' should have a magnified panel');
        }
        boxes.forEach((bx, bi) => {
          if (!finBox(bx, 'ZOOM block ' + bi + ' in ' + c.key)) return;
          if (bx.x < 0) fail('ZOOM: a block starts left of the canvas in ' + c.key);
          if (bx.y < 0) fail('ZOOM: a block starts above the canvas in ' + c.key);
          if (bx.x + bx.w > G_W) fail('ZOOM: a block runs past the right edge in ' + c.key + ' (' + (bx.x + bx.w) + ' > ' + G_W + ')');
          if (bx.y + bx.h > G_H) fail('ZOOM: a block runs past the bottom edge in ' + c.key + ' (' + (bx.y + bx.h) + ' > ' + G_H + ')');
        });
      });

      /* ---------- 3. SVG 標籤：四個方向 ＋ 不可以互相疊到 ----------
         「元素在畫布裡」和「人看得懂」是兩件事，可是至少要先在畫布裡。
         教訓來自 grade-3/perimeter（標籤畫在圖外面，畫布卻只留固定留白）。 */
      ['zh', 'en'].forEach(lang => {
        const dict = I18N[lang];
        if (!dict){ fail('SVGTEXT: missing dictionary for ' + lang); return; }

        ZOOM_CASES.forEach(c => {
          const plan = zoomPlan(c.key);
          const items = [
            { text:dict.s1title.main, cx:G_X + G_SIDE / 2, y:G_Y + G_TITLE_DY, font:G_FONT, tag:'s1title.main/' + c.key },
            { text:dict.s1cap[c.key], cx:G_X + G_SIDE / 2, y:G_Y + G_SIDE + G_CAP_DY, font:G_FONT, tag:'s1cap/' + c.key }
          ];
          if (plan.zoom){
            items.push({ text:(c.key === 'hundredth' ? dict.s1title.zoomH : dict.s1title.zoomT),
                         cx:G_ZX + G_ZSIDE / 2, y:G_ZY + G_TITLE_DY, font:G_FONT, tag:'s1title.zoom/' + c.key });
            items.push({ text:dict.s1zoomCap[c.key], cx:G_ZX + G_ZSIDE / 2, y:G_ZY + G_ZSIDE + G_CAP_DY,
                         font:G_FONT, tag:'s1zoomCap/' + c.key });
          }
          items.forEach(it => {
            if (typeof it.text !== 'string' || !it.text.trim()){ fail('SVGTEXT: ' + it.tag + ' (' + lang + ') is empty'); return; }
            const w = estTextW(it.text, it.font);
            if (it.cx - w / 2 < 0) fail('SVGTEXT: ' + it.tag + ' (' + lang + ') runs off the left of the canvas');
            if (it.cx + w / 2 > G_W) fail('SVGTEXT: ' + it.tag + ' (' + lang + ') runs off the right of the canvas (' + Math.round(it.cx + w / 2) + ' > ' + G_W + ')');
            if (it.y - it.font * 0.85 < 0) fail('SVGTEXT: ' + it.tag + ' (' + lang + ') is above the canvas');
            if (it.y + it.font * 0.3 > G_H) fail('SVGTEXT: ' + it.tag + ' (' + lang + ') is below the canvas (' + Math.round(it.y + it.font * 0.3) + ' > ' + G_H + ')');
          });
          for (let i = 0; i < items.length; i++){
            for (let j = i + 1; j < items.length; j++){
              const a = items[i], b = items[j];
              const wa = estTextW(a.text, a.font), wb = estTextW(b.text, b.font);
              const ox = Math.min(a.cx + wa / 2, b.cx + wb / 2) - Math.max(a.cx - wa / 2, b.cx - wb / 2);
              const oy = Math.min(a.y + a.font * 0.3, b.y + b.font * 0.3) - Math.max(a.y - a.font * 0.85, b.y - b.font * 0.85);
              if (ox > 2 && oy > 2) fail('SVGTEXT: ' + a.tag + ' and ' + b.tag + ' (' + lang + ') overlap on the grid canvas');
            }
          }
        });

        /* 範例 5 的三張小圖 */
        const tplans = trioPlan(TRIO_CASES);
        if (tplans.length !== 3) fail('TRIO: expected three panels, got ' + tplans.length);
        const tItems = [];
        tplans.forEach((p, i) => {
          if (p.x !== T_XS[i] || p.y !== T_Y || p.side !== T_SIDE)
            fail('TRIO: panel ' + i + ' does not use the exported layout constants');
          if (p.x < 0 || p.x + p.side > T_W) fail('TRIO: panel ' + i + ' runs off the canvas horizontally (' + (p.x + p.side) + ' > ' + T_W + ')');
          if (p.y < 0 || p.y + p.side > T_H) fail('TRIO: panel ' + i + ' runs off the canvas vertically');
          if (p.rects.length !== p.cells) fail('TRIO: panel ' + i + ' says ' + p.cells + ' shaded squares but draws ' + p.rects.length);
          if (p.cells * 10 !== p.mil) fail('TRIO: panel ' + i + ' shades ' + p.cells + ' squares for the value ' + p.mil + ' (one square is 0.01)');
          if (!fin(p.x) || !fin(p.y) || !fin(p.side) || !fin(p.cell))
            fail('TRIO: panel ' + i + ' has a non-finite coordinate');
          p.rects.forEach(r => {
            if (!finBox({ x:r.x, y:r.y, w:r.w, h:r.h }, 'TRIO panel ' + i + ' rect')) return;
            if (r.x < p.x - 1e-9 || r.x + r.w > p.x + p.side + 1e-9 || r.y < p.y - 1e-9 || r.y + r.h > p.y + p.side + 1e-9)
              fail('TRIO: a shaded square in panel ' + i + ' escapes its own grid');
          });
          tItems.push({ text:fmtPad(p.mil, p.p), cx:p.x + p.side / 2, y:p.y + T_TITLE_DY, font:20, tag:'trio title ' + i });
          tItems.push({ text:dict.s5cap(p.cells), cx:p.x + p.side / 2, y:p.y + p.side + T_CAP_DY, font:T_FONT, tag:'trio cap ' + i });
        });
        tItems.forEach(it => {
          const w = estTextW(it.text, it.font);
          if (it.cx - w / 2 < 0) fail('TRIO: ' + it.tag + ' (' + lang + ') runs off the left of the trio canvas');
          if (it.cx + w / 2 > T_W) fail('TRIO: ' + it.tag + ' (' + lang + ') runs off the right of the trio canvas');
          if (it.y - it.font * 0.85 < 0) fail('TRIO: ' + it.tag + ' (' + lang + ') is above the trio canvas');
          if (it.y + it.font * 0.3 > T_H) fail('TRIO: ' + it.tag + ' (' + lang + ') is below the trio canvas (' + Math.round(it.y + it.font * 0.3) + ' > ' + T_H + ')');
        });
        for (let i = 0; i < tItems.length; i++){
          for (let j = i + 1; j < tItems.length; j++){
            const a = tItems[i], b = tItems[j];
            const wa = estTextW(a.text, a.font), wb = estTextW(b.text, b.font);
            const ox = Math.min(a.cx + wa / 2, b.cx + wb / 2) - Math.max(a.cx - wa / 2, b.cx - wb / 2);
            const oy = Math.min(a.y + a.font * 0.3, b.y + b.font * 0.3) - Math.max(a.y - a.font * 0.85, b.y - b.font * 0.85);
            if (ox > 2 && oy > 2) fail('TRIO: ' + a.tag + ' and ' + b.tag + ' (' + lang + ') overlap');
          }
        }

        /* 範例 3 的數線標籤：三排、四個方向 */
        const yA = NL_Y + NL_TOP_DY, yE = NL_Y + NL_END_DY, yB = NL_Y + NL_BOT_DY;
        if (!(yA + NL_FONT * 0.3 < yE - NL_FONT * 0.85))
          fail('NLTEXT: the A label row and the end-label row can overlap (A at ' + yA + ', ends at ' + yE + ')');
        if (!(yE + NL_FONT * 0.3 < yB - NL_FONT * 0.85))
          fail('NLTEXT: the end-label row and the B label row can overlap (ends at ' + yE + ', B at ' + yB + ')');
        if (!(yA < NL_Y && yB > NL_Y)) fail('NLTEXT: A must sit above the line and B below it');
        CMP_CASES.forEach((c, ci) => {
          const plan = nlPlan(c.a, c.b);
          const items = [
            { text:fmtNat(plan.lo), cx:NL_X0, y:yE, tag:'nl lo/' + ci },
            { text:fmtNat(plan.hi), cx:NL_X1, y:yE, tag:'nl hi/' + ci },
            { text:fmtPad(c.a, c.pa), cx:nlX(c.a, plan), y:yA, tag:'nl A/' + ci },
            { text:fmtPad(c.b, c.pb), cx:nlX(c.b, plan), y:yB, tag:'nl B/' + ci }
          ];
          items.forEach(it => {
            if (!fin(it.cx) || !fin(it.y)){ fail('NLTEXT: ' + it.tag + ' (' + lang + ') has a non-finite coordinate'); return; }
            const w = estTextW(it.text, NL_FONT);
            if (it.cx - w / 2 < 0) fail('NLTEXT: ' + it.tag + ' (' + lang + ') runs off the left');
            if (it.cx + w / 2 > NL_W) fail('NLTEXT: ' + it.tag + ' (' + lang + ') runs off the right');
            if (it.y - NL_FONT * 0.85 < 0) fail('NLTEXT: ' + it.tag + ' (' + lang + ') is above the number line canvas');
            if (it.y + NL_FONT * 0.3 > NL_H) fail('NLTEXT: ' + it.tag + ' (' + lang + ') is below the number line canvas');
          });
        });
      });

      /* ---------- 4. 範例 2：位值表的樣本 ---------- */
      if (PV_CASES.length !== 4) fail('PV_CASES: expected four place-value samples, got ' + PV_CASES.length);
      PV_CASES.forEach((c, i) => {
        if (!isMil(c.mil)) fail('PV_CASES[' + i + ']: not a valid milli value');
        const dg = milDigitsRef(c.mil);
        if (!dg){ fail('PV_CASES[' + i + ']: out of range'); return; }
        if (dg[0] !== 0) fail('PV_CASES[' + i + ']: the integer part must be a single digit (the read-aloud only handles one), got ' + c.mil);
        if (!(int(c.p) && c.p >= 1 && c.p <= 3)) fail('PV_CASES[' + i + ']: p must be 1..3');
        if (c.p < places(c.mil)) fail('PV_CASES[' + i + ']: printing ' + c.mil + ' with ' + c.p + ' places would truncate it');
        if (fmtPad(c.mil, c.p) !== digitsToStrRef(dg, c.p)) fail('PV_CASES[' + i + ']: the printed form disagrees with the digit route');
      });
      const pvShapes = {
        threePlaces:  PV_CASES.some(c => c.p === 3 && places(c.mil) === 3),
        zeroTenths:   PV_CASES.some(c => digitAt(c.mil, 1) === 0 && c.p >= 2),
        twoZeros:     PV_CASES.some(c => digitAt(c.mil, 1) === 0 && digitAt(c.mil, 2) === 0 && c.p === 3),
        trailingZero: PV_CASES.some(c => c.p > places(c.mil))
      };
      Object.keys(pvShapes).forEach(k => {
        if (!pvShapes[k]) fail('PV: the samples no longer cover the "' + k + '" case this example exists to teach');
      });

      /* ---------- 5. 範例 3：比大小的案例要涵蓋每一種「分出大小的位」 ---------- */
      if (CMP_CASES.length !== 5) fail('CMP_CASES: expected five cases, got ' + CMP_CASES.length);
      const cmpShapes = { whole:false, tenth:false, hundredth:false, thousandth:false, same:false };
      CMP_CASES.forEach((c, i) => {
        if (!isMil(c.a) || !isMil(c.b)){ fail('CMP_CASES[' + i + ']: not valid milli values'); return; }
        if (c.pa < places(c.a) || c.pb < places(c.b)) fail('CMP_CASES[' + i + ']: printing would truncate');
        const dec = decidedByRef(milDigitsRef(c.a), milDigitsRef(c.b));
        if (dec.kind === 'whole') cmpShapes.whole = true;
        else if (dec.kind === 'same') cmpShapes.same = true;
        else cmpShapes[['', 'tenth', 'hundredth', 'thousandth'][dec.k]] = true;
        const plan = cmpPlan(c.a, c.b, c.pa, c.pb);
        const want = cmpDigitsRef(milDigitsRef(c.a), milDigitsRef(c.b));
        if (plan.cmp !== want) fail('CMP_CASES[' + i + ']: cmpPlan disagrees with the digit route');
        /* ⚠️ 補零只能把短的補長，絕不可以把長的縮短。0.5 和 0.500 這一組
           如果只看 places()，pad 會算成 1，畫面就印出「補到一樣長：0.5 和 0.5」
           —— 那是把 0.500 砍掉，正好和這一組要教的事情相反。 */
        if (plan.pad < Math.max(c.pa, c.pb))
          fail('CMP_CASES[' + i + ']: padding to ' + plan.pad + ' places would SHORTEN one of the numbers as written (' +
               c.pa + ' and ' + c.pb + ' places on screen)');
        /* 相等的那一組要走完每一個顯示出來的位，不可以比到一半就宣布相等。 */
        if (want === 0 && plan.steps.length !== Math.max(c.pa, c.pb) + 1)
          fail('CMP_CASES[' + i + ']: the equal pair walks ' + plan.steps.length +
               ' steps but ' + (Math.max(c.pa, c.pb) + 1) + ' places are shown');
        const nl = nlPlan(c.a, c.b);
        const lo = Math.min(c.a, c.b), hi = Math.max(c.a, c.b);
        if (!(nl.lo + nl.st <= lo && hi <= nl.hi - nl.st))
          fail('CMP_CASES[' + i + ']: the two points are not at least one step inside the number line');
        if (hi - lo > 7 * MIL) fail('CMP_CASES[' + i + ']: the two values are too far apart for a readable number line');
      });
      Object.keys(cmpShapes).forEach(k => {
        if (!cmpShapes[k]) fail('CMP_CASES: no case is settled by "' + k + '" any more — that branch of the rule is untaught and untested');
      });

      /* ---------- 6. 範例 4：直式的四題 ---------- */
      if (VF_CASES.length !== 4) fail('VF_CASES: expected four column-form cases, got ' + VF_CASES.length);
      const vfShapes = { add:false, sub:false, pad:false, carry:false, borrow:false, wholeOperand:false, chainBorrow:false };
      VF_CASES.forEach((c, i) => {
        if (!isMil(c.a) || !isMil(c.b)){ fail('VF_CASES[' + i + ']: not valid milli values'); return; }
        if (places(c.a) > 2 || places(c.b) > 2) fail('VF_CASES[' + i + ']: this lesson only adds and subtracts to two decimal places');
        if (c.op !== '+' && c.op !== '-') fail('VF_CASES[' + i + ']: bad operator');
        if (c.op === '+' && c.a + c.b >= MIL_MAX) fail('VF_CASES[' + i + ']: the sum leaves the lesson range');
        if (c.op === '-' && c.a < c.b) fail('VF_CASES[' + i + ']: the subtraction would go negative');
        const plan = colPlan(c.a, c.b, c.op);
        if (plan.over !== 0) fail('VF_CASES[' + i + ']: the leftmost column still has a carry/borrow, which the layout cannot show');
        const A = milDigitsRef(c.a), B = milDigitsRef(c.b);
        const r = (c.op === '+') ? addDigitsRef(A, B) : subDigitsRef(A, B);
        const got = plan.R[0] * 10000 + plan.R[1] * MIL + plan.R[2] * 100 + plan.R[3] * 10;
        if (got !== milOf(r.digits)) fail('VF_CASES[' + i + ']: the column digits disagree with the digit route');
        if (plan.res !== (c.op === '+' ? c.a + c.b : c.a - c.b)) fail('VF_CASES[' + i + ']: res is wrong');
        VF_POS.forEach((k, idx) => {
          const wantA = k >= 1 && places(c.a) < k;
          const wantB = k >= 1 && places(c.b) < k;
          if (plan.padA[idx] !== wantA) fail('VF_CASES[' + i + ']: padA is wrong at place ' + k);
          if (plan.padB[idx] !== wantB) fail('VF_CASES[' + i + ']: padB is wrong at place ' + k);
        });
        if (c.op === '+'){ vfShapes.add = true; if (plan.carry.indexOf(1) >= 0) vfShapes.carry = true; }
        else { vfShapes.sub = true; if (plan.borrow.indexOf(1) >= 0) vfShapes.borrow = true; }
        if (places(c.a) !== places(c.b)) vfShapes.pad = true;
        if (places(c.a) === 0 || places(c.b) === 0) vfShapes.wholeOperand = true;
        for (let x = 1; x < VF_POS.length; x++){
          if (plan.borrow[x] === 1 && plan.borrow[x - 1] === 1) vfShapes.chainBorrow = true;
        }
      });
      Object.keys(vfShapes).forEach(k => {
        if (!vfShapes[k]) fail('VF_CASES: the four cases no longer cover "' + k + '" — that is one of the things this example exists to show');
      });
      /* ⚠️ 至少要有一題的直式結果末尾是 0（0.65 ＋ 0.45 → 1.10），
         因為畫面上直式寫 1.10、答案寫 1.1，那一句解釋只有這種題目會出現。
         這是把圖排成接觸表截圖才看到的缺陷，沒有任何幾何檢查會響。 */
      if (!VF_CASES.some(c => {
        const r = colPlan(c.a, c.b, c.op);
        return fmtPad(r.res, 2) !== fmtNat(r.res);
      })) fail('VF_CASES: no case leaves a trailing zero in the column result any more, so the "1.10 is written 1.1" explanation never appears');

      /* ---------- 6b. 直式減法的旁白必須自洽 ----------
         ⚠️ 原本的寫法在 5.00 － 2.34 的十分位印出「剩下 -1」：那一位是 0，
         已經被右邊借走 1，程式卻直接印 a － 1。旁白裡出現負數就是壞了。
         這裡把旁白**真的叫起來**，逐欄比對它講的算式，而不是只看資料。 */
      /* 每一句渲染出來的旁白都收集起來，最後一起掃「中文和數字黏在一起」。
         ⚠️ 這種缺陷只有在**字串拼起來之後**才看得到（'一個' ＋ '0.1' → 「一個0.1」），
         靜態掃原始碼永遠掃不到，而 simgen 的那一條只管 review.html。 */
      const narrated = [];
      VF_CASES.forEach((c, ci) => {
        if (c.op !== '-') return;
        const plan = colPlan(c.a, c.b, c.op);
        ['zh', 'en'].forEach(lang => {
          const dict = I18N[lang];
          if (!dict || typeof dict.s4stepSub !== 'function'){ fail('VFNARR: ' + lang + ' has no s4stepSub'); return; }
          for (let i2 = VF_POS.length - 1; i2 >= 0; i2--){
            const k = VF_POS[i2];
            if (k === -1 && plan.A[0] === 0 && plan.B[0] === 0 && plan.R[0] === 0) continue;
            /* ⚠️ 叫**頁面自己的** subStep，不是在這裡重算一次 ——
               重算的話這一整段只在驗設定檔自己，頁面壞掉照樣綠。 */
            const st4 = subStep(plan, i2);
            const lent = st4.lent, t0 = st4.t0, top = st4.top;
            /* 真正拿來減的那個數必須是 0~19，而且減出來要等於直式那一格。 */
            if (!(Number.isInteger(top) && top >= 0 && top <= 19))
              fail('VFNARR: VF_CASES[' + ci + '] place ' + k + ' would subtract from ' + top);
            if (top - plan.B[i2] !== plan.R[i2])
              fail('VFNARR: VF_CASES[' + ci + '] place ' + k + ': ' + top + ' - ' + plan.B[i2] +
                   ' is not the digit the column form shows (' + plan.R[i2] + ')');
            const place = (k === -1) ? dict.tensName : dict.placeName[KEYS[k]];
            const leftUnit = (k === 2) ? dict.s4leftUnit.hundredth
                           : (k === 1) ? dict.s4leftUnit.tenth : dict.s4leftUnit.ones;
            const txt = String(dict.s4stepSub(place, plan.B[i2], lent, t0, top,
              plan.borrow[i2] === 1, plan.R[i2], leftUnit, plan.A[i2])).replace(/<[^>]+>/g, '');
            /* ⚠️ 只要求「top 和答案數字有出現在某處」是不夠的：
               10 － 4 ＝ 6 可以被寫成 10 － 5 ＝ 6 而照樣過關（codex 第三輪抓到）。
               整條算式要逐字對上。 */
            const eqSub = (lang === 'zh')
              ? (top + ' － ' + plan.B[i2] + ' ＝ ' + plan.R[i2])
              : (top + ' - ' + plan.B[i2] + ' = ' + plan.R[i2]);
            if (txt.indexOf(eqSub) < 0)
              fail('VFNARR: VF_CASES[' + ci + '] (' + lang + ') place ' + k +
                   ' must spell out "' + eqSub + '" but says: ' + txt.slice(0, 100));
            /* 「向左邊借」這句話出現與否，要和直式真的有沒有借位一致。 */
            const saysBorrow = (lang === 'zh')
              ? txt.indexOf('向左邊借') >= 0
              : txt.indexOf('borrow 1 from the left') >= 0;
            if (saysBorrow !== (plan.borrow[i2] === 1))
              fail('VFNARR: VF_CASES[' + ci + '] (' + lang + ') place ' + k +
                   ' talks about borrowing = ' + saysBorrow + ' but the column form says ' + (plan.borrow[i2] === 1));
            if (/[-－]\d/.test(txt))
              fail('VFNARR: VF_CASES[' + ci + '] (' + lang + ') narration prints a negative number: ' + txt.slice(0, 90));
            /* 講出來的那個「拿來減的數」和「減出來的數」都要真的在句子裡。 */
            if (txt.indexOf(String(top)) < 0)
              fail('VFNARR: VF_CASES[' + ci + '] (' + lang + ') narration never states the number being subtracted from (' + top + ')');
            if (txt.indexOf(String(plan.R[i2])) < 0)
              fail('VFNARR: VF_CASES[' + ci + '] (' + lang + ') narration never states the resulting digit (' + plan.R[i2] + ')');
            narrated.push({ tag:'VF_CASES[' + ci + '] place ' + k, lang:lang, txt:txt });
          }
        });
      });

      /* isTrailingZero 本身要對：末尾的 0 ⟺ 從那一位往右全是 0。
         用五格數字陣列獨立判一次，整個定義域掃過去。 */
      mism = 0;
      for (let m = 0; m < MIL_MAX && mism < 4; m++){
        const dg = milDigitsRef(m);
        for (let k = 1; k <= 3 && mism < 4; k++){
          let allZero = true;
          for (let x = k; x <= 3; x++) if (dg[1 + x] !== 0) allZero = false;
          if (isTrailingZero(m, k) !== allZero){
            fail('TRAILING: isTrailingZero(' + m + ', ' + k + ') = ' + isTrailingZero(m, k) +
                 ' but the digits from place ' + k + ' rightwards are ' + (allZero ? 'all zero' : 'not all zero'));
            mism++;
          }
        }
      }

      /* 加法那幾題的旁白也要收（s4stepAdd），還有比大小的每一步。 */
      VF_CASES.forEach((c, ci) => {
        if (c.op !== '+') return;
        const plan = colPlan(c.a, c.b, c.op);
        ['zh', 'en'].forEach(lang => {
          const dict = I18N[lang];
          if (!dict || typeof dict.s4stepAdd !== 'function'){ fail('VFNARR: ' + lang + ' has no s4stepAdd'); return; }
          for (let i2 = VF_POS.length - 1; i2 >= 0; i2--){
            const k = VF_POS[i2];
            if (k === -1 && plan.A[0] === 0 && plan.B[0] === 0 && plan.R[0] === 0) continue;
            /* ⚠️ 叫頁面自己的 addStep，不是在這裡重算。 */
            const at4 = addStep(plan, i2);
            const carryIn = at4.carryIn, sum = at4.sum;
            /* ⚠️ 只比最後一位是不夠的：sum ＋ 10 也會通過 % 10，於是
               5 ＋ 4 可以被講成「＝ 19」。整個 sum 要獨立算一次。 */
            const wantCarryIn = (i2 < VF_POS.length - 1) && plan.carry[i2 + 1] === 1;
            if (carryIn !== wantCarryIn)
              fail('VFNARR: VF_CASES[' + ci + '] place ' + k + ': carryIn says ' + carryIn + ', the column form says ' + wantCarryIn);
            const wantSum = plan.A[i2] + plan.B[i2] + (wantCarryIn ? 1 : 0);
            if (sum !== wantSum)
              fail('VFNARR: VF_CASES[' + ci + '] place ' + k + ': the narrated sum is ' + sum + ', but ' +
                   plan.A[i2] + ' + ' + plan.B[i2] + (wantCarryIn ? ' + 1' : '') + ' = ' + wantSum);
            if (!(sum >= 0 && sum <= 19))
              fail('VFNARR: VF_CASES[' + ci + '] place ' + k + ': a column sum of ' + sum + ' is impossible');
            if ((sum >= 10) !== (plan.carry[i2] === 1))
              fail('VFNARR: VF_CASES[' + ci + '] place ' + k + ': the narrated sum ' + sum +
                   ' disagrees with whether the column carries');
            if (sum % 10 !== plan.R[i2])
              fail('VFNARR: VF_CASES[' + ci + '] place ' + k + ': ' + sum + ' does not end in the column digit ' + plan.R[i2]);
            const place = (k === -1) ? dict.tensName : dict.placeName[KEYS[k]];
            const txtA = String(dict.s4stepAdd(place, plan.A[i2], plan.B[i2], carryIn, sum, plan.R[i2],
              plan.carry[i2] === 1)).replace(/<[^>]+>/g, '');
            /* ⚠️ 加法原本一個字都沒驗 —— 這一句可以回「從右往左算」而所有斷言全綠。
               整條算式與「這一位寫幾」都要逐字對上。 */
            const eqAdd = (lang === 'zh')
              ? (plan.A[i2] + ' ＋ ' + plan.B[i2] + (carryIn ? ' ＋ 進位的 1' : '') + ' ＝ ' + sum)
              : (plan.A[i2] + ' + ' + plan.B[i2] + (carryIn ? ' + the 1 carried in' : '') + ' = ' + sum);
            if (txtA.indexOf(eqAdd) < 0)
              fail('VFNARR: VF_CASES[' + ci + '] (' + lang + ') place ' + k +
                   ' must spell out "' + eqAdd + '" but says: ' + txtA.slice(0, 100));
            const wroteDigit = (lang === 'zh')
              ? ('這一位寫 ' + plan.R[i2]) : ('write ' + plan.R[i2] + ' here');
            if (txtA.indexOf(wroteDigit) < 0)
              fail('VFNARR: VF_CASES[' + ci + '] (' + lang + ') place ' + k +
                   ' never says which digit goes in this column ("' + wroteDigit + '")');
            const saysCarry = (lang === 'zh')
              ? txtA.indexOf('向左邊進') >= 0 : txtA.indexOf('carry') >= 0;
            if (saysCarry !== (plan.carry[i2] === 1))
              fail('VFNARR: VF_CASES[' + ci + '] (' + lang + ') place ' + k +
                   ' talks about carrying = ' + saysCarry + ' but the column form says ' + (plan.carry[i2] === 1));
            narrated.push({ tag:'VF_CASES[' + ci + '] add place ' + k, lang:lang, txt:txtA });
          }
          /* ⚠️ 不可以寫成 `if (typeof … === 'function')` —— 那樣把函式刪掉就靜靜過關。
             而且要照**頁面自己的條件**（needsDropZero）決定該不該出現，
             不是每一題都叫一次。 */
          if (typeof dict.s4dropZero !== 'function'){
            fail('VFNARR: ' + lang + ' has no s4dropZero, so the "1.10 is written 1.1" step cannot render');
          } else {
            const shows = needsDropZero(plan.res);
            const wantShows = fmtPad(plan.res, 2) !== fmtNat(plan.res);
            if (shows !== wantShows)
              fail('VFNARR: VF_CASES[' + ci + '] needsDropZero says ' + shows + ' but the padded form ' +
                   fmtPad(plan.res, 2) + ' vs the natural form ' + fmtNat(plan.res) + ' says ' + wantShows);
            if (shows)
              narrated.push({ tag:'VF_CASES[' + ci + '] dropZero', lang:lang,
                txt:String(dict.s4dropZero(fmtPad(plan.res, 2), fmtNat(plan.res))).replace(/<[^>]+>/g, '') });
          }
        });
      });
      /* 比大小的每一步、位值的每一句、放大鏡的結語 —— 全部渲染一次再掃。 */
      ['zh', 'en'].forEach(lang => {
        const dict = I18N[lang];
        if (!dict) return;
        CMP_CASES.forEach((c, ci) => {
          const plan = cmpPlan(c.a, c.b, c.pa, c.pb);
          narrated.push({ tag:'s3pad[' + ci + ']', lang:lang, txt:String(dict.s3pad(
            fmtPad(c.a, c.pa), fmtPad(c.b, c.pb), fmtPad(c.a, plan.pad), fmtPad(c.b, plan.pad))).replace(/<[^>]+>/g, '') });
          plan.steps.forEach(st => {
            narrated.push({ tag:'s3step[' + ci + ']', lang:lang,
              txt:String(st.kind === 'whole' ? dict.s3whole(st.a, st.b, st.cmp)
                : dict.s3place(dict.placeName[KEYS[st.k]], st.a, st.b, st.cmp)).replace(/<[^>]+>/g, '') });
          });
        });
        PV_CASES.forEach((c, ci) => {
          for (let k = 0; k <= c.p; k++){
            const dg = digitAt(c.mil, k);
            /* ⚠️ 叫頁面自己的判斷，不是重算一次 —— 重算的話把頁面的
               predicate 改成 true，這一段照樣構造出「正確」的旁白。 */
            const trailing = isTrailingZero(c.mil, k);
            narrated.push({ tag:'s2narr[' + ci + '] place ' + k, lang:lang,
              txt:String(k === 0 ? dict.s2narrOnes(dg)
                : dg === 0 ? dict.s2narrZero(dict.placeName[KEYS[k]], trailing, fmtNat(c.mil), fmtPad(c.mil, c.p))
                : dict.s2narr(dg, dict.placeName[KEYS[k]], fmtNat(placeUnit(k)), fmtNat(placeValue(c.mil, k)))).replace(/<[^>]+>/g, '') });
          }
        });
        ZOOM_CASES.forEach((c, ci) => {
          narrated.push({ tag:'s1result[' + ci + ']', lang:lang,
            txt:String(dict.s1result(fmtNat(c.mil), c.cut)).replace(/<[^>]+>/g, '') });
        });
        TRIO_CASES.forEach((c, ci) => {
          narrated.push({ tag:'s5cap[' + ci + ']', lang:lang, txt:String(dict.s5cap(c.cells)) });
        });
      });
      /* 中文和數字之間要有空格（全站慣例），而且英文的 1 要用單數。 */
      narrated.forEach(n => {
        if (n.lang === 'zh'){
          const glued = n.txt.match(/[一-鿿]\d|\d[一-鿿]/g);
          if (glued)
            fail('NARR: ' + n.tag + ' (zh) glues Chinese to a digit: ' + [...new Set(glued)].join(' ') +
                 ' in "' + n.txt.slice(0, 70) + '"');
        } else {
          const bad = n.txt.match(PLURAL_RE) || n.txt.match(THERE_ARE_RE);
          if (bad) fail('NARR: ' + n.tag + ' (en) singular/plural is wrong near "' + bad[0] + '"');
          if (/[一-鿿]/.test(n.txt)) fail('NARR: ' + n.tag + ' (en) contains Chinese');
        }
        if (/undefined|NaN/.test(n.txt)) fail('NARR: ' + n.tag + ' (' + n.lang + ') leaks undefined/NaN: ' + n.txt.slice(0, 70));
        const dbl = n.txt.match(/(?<!\.)\.\.(?!\.)|。。|，，|！！|？？/);
        if (dbl) fail('NARR: ' + n.tag + ' (' + n.lang + ') has doubled punctuation "' + dbl[0] + '"');
      });

      /* ---------- 7. 範例 5：三張圖 ---------- */
      if (TRIO_CASES.length !== 3) fail('TRIO_CASES: expected three, got ' + TRIO_CASES.length);
      if (TRIO_CASES[0].mil !== TRIO_CASES[1].mil)
        fail('TRIO_CASES: the first two panels must be the SAME value written two ways — that is the whole point of the example');
      if (TRIO_CASES[0].p === TRIO_CASES[1].p)
        fail('TRIO_CASES: the first two panels must be written with different numbers of places');
      if (TRIO_CASES[2].mil * 10 !== TRIO_CASES[0].mil)
        fail('TRIO_CASES: the third panel must be the first one with a 0 pushed in after the point (one tenth of it)');
      TRIO_CASES.forEach((c, i) => {
        if (c.mil % 10 !== 0) fail('TRIO_CASES[' + i + ']: the value must be a whole number of 0.01s to be drawn on a 100-square grid');
        if (c.cells !== c.mil / 10) fail('TRIO_CASES[' + i + ']: cells must be mil / 10');
        if (!(c.cells >= 1 && c.cells <= 100)) fail('TRIO_CASES[' + i + ']: cells out of the 100-square grid');
        if (c.p < places(c.mil)) fail('TRIO_CASES[' + i + ']: printing would truncate');
      });

      /* ---------- 8. 小遊戲「小數放大鏡挑戰」（2026-10-04 改成五關五種玩法，§六之五） ----------
         讀格子、撥珠子、排排站、直式、一樣大配對。每一關：題庫的每一題都用**這份設定檔的五格數字陣列**重算，
         再**照頁面自己的規則函式**（readRule／beadRule／cmpPlan／colSteps＋colRule／zeroRule）把每一題從頭玩一遍，
         證明每一題都解得完、解完一定是對的、每一種放錯的理由是真的；每一句說明都真的叫起來，
         逐個驗數字並用 lib/decarith.js 驗它的算式。nearestOpen()、roundMiss()、shuffle() 從原始碼切出來真的跑；
         只在 RENDER 裡、切不出來的幾條關鍵規則用原始碼形狀守住（need()）。版面數字一律從 index.html 讀。 */
      try {
        const D = data, W = 300, LANGS = ['zh', 'en'];
        const toks = text => (String(text).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []);
        /* 說明句：數照順序逐個比（小數算一個），句子裡的每一條算式都要算得對 */
        const seq = (where, text, want) => {
          if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail('GAME: ' + where + ': text has undefined/NaN/null: ' + text);
          const got = toks(text).join(' ');
          if (got !== want.map(String).join(' ')) fail('GAME: ' + where + ': numbers should read ' + want.join(' ') + ', got ' + got + ' — ' + text);
          decArith(text).problems.forEach(p => fail('GAME: ' + where + ': ' + p));
          if (/[一-鿿]\d|\d[一-鿿]/.test(text)) fail('GAME: ' + where + ': Chinese glued to a digit — ' + text);
          if (/\ben\b/.test(where) && /[一-鿿]/.test(text)) fail('GAME: ' + where + ': en text contains Chinese — ' + text);
          const bad = /\ben\b/.test(where) && (text.match(PLURAL_RE) || text.match(THERE_ARE_RE) || text.match(/\b1 (beads|strips|small squares|full strips|ones|tenths|hundredths|thousandths|more beads)\b/));
          if (bad) fail('GAME: ' + where + ': singular/plural is wrong near "' + bad[0] + '"');
        };
        const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail('GAME: ' + what + ' is outside the ' + W + '×' + H + ' board'); };
        const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
        const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - (h === undefined ? w : h) / 2, w:w, h:h === undefined ? w : h });
        const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail('GAME: ' + what + ' ' + i + ' and ' + j + ' overlap'); };
        /* 自己的格式化：milli → 最自然的寫法／至少 p 位（走五格陣列，不呼叫頁面的 fmtNat／fmtPad） */
        const natR = m => digitsToStrRef(milDigitsRef(m), 0);
        const padR = (m, p) => digitsToStrRef(milDigitsRef(m), p);
        const dig = (m, k) => milDigitsRef(m)[1 + k];        /* k ＝ 0 個位 … 3 千分位 */
        const PLACE_ZH = ['個位', '十分位', '百分位', '千分位'], PLACE_EN = ['the ones place', 'the tenths place', 'the hundredths place', 'the thousandths place'];
        const placeTxt = (L, k) => (L === 'zh' ? PLACE_ZH : PLACE_EN)[k];
        const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

        ['GAME_READ', 'GAME_BEAD', 'GAME_SORT', 'GAME_COL', 'GAME_ZERO'].forEach(k => {
          if (!Array.isArray(D[k]) || D[k].length < 2) fail('GAME: ' + k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
        });

        /* --- 五關的順序、每一關的題目與兩層提示 --- */
        gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(m => fail('GAME: ' + m));
        const TYPES = ['read', 'bead', 'sort', 'col', 'zero'];
        const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
        if (order === undefined) fail('GAME: cannot find GAME_ORDER in index.html');
        else {
          const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
          if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (the order of examples 1~5), got ' + types.join());
        }
        const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
        const B = {};
        TYPES.forEach(t => {
          B[t] = body(t);
          if (!B[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
          LANGS.forEach(L => {
            if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('GAME: gAsks.' + t + ' missing in ' + L);
            if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && /^(提示 1：|Hint 1: )/.test(I18N[L].gHints[t]))) fail('GAME: gHints.' + t + ' missing (or not a level-1 hint) in ' + L);
          });
        });
        const need = (k, re, what) => { if (!re.test(B[k] || '')) fail('GAME: ' + k + ': ' + what); };
        {
          const sr = extractFunction(src, 'startRound');
          if (!sr) fail('GAME: cannot find startRound() in index.html');
          else {
            if (!/var type = GAME_ORDER\[gRound\];/.test(sr)) fail('GAME: startRound(): the round type is not GAME_ORDER[gRound]');
            if (!/RENDER\[type\]\(d\);/.test(sr)) fail('GAME: startRound(): it does not draw RENDER[type]');
            if (!/ask\.textContent = d\.gAsks\[type\];/.test(sr)) fail('GAME: startRound(): the question is not gAsks[type]');
            if (!/gameStage\.textContent = '';/.test(sr)) fail('GAME: startRound(): the stage is not cleared before drawing');
            if (!/gGen\+\+;/.test(sr)) fail('GAME: startRound(): the board generation is not bumped, so a piece held across Restart can act on the new board');
            if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(sr)) fail('GAME: startRound(): ahead mode does not give hint 1 automatically');
          }
          if (!/gNext\.addEventListener\('click', function\(\)\{\s*if \(gRound < GAME_ORDER\.length - 1\)\{ gRound\+\+; startRound\(\); \}/.test(src)) fail('GAME: "Next" does not advance one round at a time (and stop at the last)');
          const sh = extractFunction(src, 'showHint');
          if (!sh || !/d\.gHints\[type\] \+ \(hintLevel >= 2 && gCtx\.hint2 \? ' ' \+ gCtx\.hint2\(\) : ''\)/.test(sh) || !/type = GAME_ORDER\[gRound\]/.test(sh)) fail('GAME: showHint(): the two-level hint is not gHints[type] + hint2()');
          if (!/hintLevel\+\+;\s*showHint\(\);\s*if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('GAME: the hint button does not stop after level 2');
          /* 舊的畫板上還拿著的積木：放開時什麼都不做（grade-2 length 的 codex 第一輪） */
          const ap = extractFunction(src, 'addPiece') || '';
          if (!/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(ap) || !/if \(gen !== gGen\) return;\s*\/\*[^*]*\*\//.test(ap))
            fail('GAME: addPiece(): a piece from a board that Restart / the language switch already removed can still act on the new board (no gen !== gGen guard)');
          if (!/if \(moved && B\.selected === P\)\{ el\.classList\.remove\('sel'\); B\.selected = null; \}/.test(ap)) fail('GAME: addPiece(): a piece that was tap-selected and then dragged stays selected');
          if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(ap) || !/if \(!start \|\| e\.pointerId !== pid\) return;/.test(ap)) fail('GAME: addPiece(): no release safety (lost capture) or it does not follow only the first finger');
        }

        /* --- 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0（§三 中年級） --- */
        if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('GAME: scoring: a round should give +20 with no mistakes and +10 after mistakes');
        {
          const fsrc = extractFunction(src, 'roundMiss');
          if (!fsrc) fail('GAME: scoring: cannot find roundMiss() in index.html');
          else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
            let r;
            try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
            catch (e){ return fail('GAME: scoring: roundMiss() could not run: ' + e.message); }
            if (r.s !== want || String(r.shown) !== String(want)) fail('GAME: scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
            if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME: scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
            if (r.html.indexOf('why') < 0 || !r.m) fail('GAME: scoring: roundMiss() does not show the reason or record the mistake');
          });
        }
        LANGS.forEach(L => {
          seq('gPts ' + L, I18N[L].gPts(20), [20]);
          seq('gMinus ' + L, I18N[L].gMinus, [5]);
          if (toks(I18N[L].gWin(85)).indexOf('85') < 0) fail('GAME: gWin ' + L + ' does not show the score');
          if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('GAME: gClear missing in ' + L);
        });

        /* --- shuffle()：切出來跑 2000 次 —— 一定打亂、從小到大的托盤一開始不可以是答案 --- */
        {
          const fsrc = extractFunction(src, 'shuffle');
          let shuffle = null;
          if (!fsrc) fail('GAME: cannot find shuffle() in index.html');
          else { try { shuffle = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('GAME: shuffle() could not be evaluated: ' + e.message); } }
          if (shuffle){
            const seen = new Set();
            let sortedStart = 0, lost = 0;
            for (let i = 0; i < 2000; i++){
              const a = [405, 450, 480, 500], s = shuffle(a);
              if (s.slice().sort((x, y) => x - y).join() !== a.join()) lost++;
              if (s.join() === a.join()) sortedStart++;
              seen.add(s.join());
            }
            if (lost) fail('GAME: shuffle() loses or duplicates cards');
            if (sortedStart) fail('GAME: shuffle() left the sort tray already in order ' + sortedStart + ' times out of 2000 — the tray must never start in the answer order');
            /* 決定性：讓 Math.random 一直回 0.9999，Fisher–Yates 會洗出「完全沒動」—— 收尾那一步一定要把它換掉 */
            let det = null;
            try { det = new Function('Math', fsrc + '\nreturn shuffle;')(Object.assign(Object.create(Math), { random:() => 0.9999 }))([405, 450, 480, 500]); } catch (e){ fail('GAME: shuffle() could not run with a fixed random: ' + e.message); }
            if (det && det.join() === '405,450,480,500') fail('GAME: shuffle() left the sort tray already in order when the random draw keeps every card in place');
            if (seen.size < 20) fail('GAME: shuffle() only produced ' + seen.size + ' of the 23 non-sorted orders');
          }
          need('sort', /renderTray\(B, vals, SORT_CARD\.y,/, 'the sort cards are not laid out through renderTray() (shuffled)');
          need('zero', /renderTray\(B, \[0, 1, 2, 3, 4\], ZERO_TRAY\.y,/, 'the zero cards are not laid out through renderTray() (shuffled)');
        }

        /* --- nearestOpen()：從原始碼切出來真的跑 --- */
        {
          const fsrc = extractFunction(src, 'nearestOpen');
          let nearestOpen = null;
          if (!fsrc) fail('GAME: cannot find nearestOpen() in index.html');
          else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
          if (nearestOpen){
            /* ① 直式答案那一排：個位、小數點格（窄）、十分位、百分位 —— 格子裡每一點都判給那一格 */
            const X = D.COL_X, Y = D.COL_Y, h = D.COL_SLOT / 2, ph = D.COL_PSLOT / 2;
            const row = [ { id:'o', cx:X.o, cy:Y.s, hw:h, hh:h, done:false }, { id:'p', cx:X.p, cy:Y.s, hw:ph, hh:h, done:false },
                          { id:'t', cx:X.t, cy:Y.s, hw:h, hh:h, done:false }, { id:'h', cx:X.h, cy:Y.s, hw:h, hh:h, done:false } ];
            let bad = 0;
            row.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 1) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 2){ const g = nearestOpen(row, { x, y }, D.COL_PAD); if (!g || g.id !== b.id) bad++; } });
            if (bad) fail('GAME: nearestOpen(): ' + bad + ' points inside a column box are given to another box (or none)');
            const r0 = nearestOpen(row, { x:X.o + h - 1, y:Y.s }, D.COL_PAD);
            if (!r0 || r0.id !== 'o') fail('GAME: nearestOpen(): a point inside the ones box near the point box is given to the point box (measure to the box, not the centre)');
            /* ② 撥珠子的四欄：兩欄中間的重疊區，挑「近的」那一欄，不是陣列裡第一個 */
            const C = D.BEAD_COL, cols = [0, 1, 2, 3].map(k => ({ id:k, cx:C.xs[k] + C.w / 2, cy:C.y + C.h / 2, hw:C.w / 2, hh:C.h / 2, done:false }));
            for (let k = 1; k < 3; k++){
              const gap = C.xs[k + 1] - (C.xs[k] + C.w);
              if (!(gap > 0 && gap / 2 < D.BEAD_PAD)) fail('GAME: bead: columns ' + k + ' and ' + (k + 1) + ' should have a gap whose middle is inside both snap pads (gap ' + gap + ', pad ' + D.BEAD_PAD + ')');
              const x = C.xs[k] + C.w + gap / 2 + 0.5, g = nearestOpen(cols, { x, y:C.y + 30 }, D.BEAD_PAD);
              if (!g || g.id !== k + 1) fail('GAME: nearestOpen(): in the overlap between bead columns ' + k + ' and ' + (k + 1) + ' the drop goes to ' + (g ? g.id : 'none') + ', not the nearer column ' + (k + 1));
            }
            const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
            if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('GAME: nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
            if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('GAME: nearestOpen(): a drop far from every slot is accepted');
          }
        }

        /* --- 手機上至少 44px：375px 手機上卡片內寬約 290px，300 寬的畫板縮成 0.967 倍 --- */
        const scale = Math.min(1.5, 290 / W);
        const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME: ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
        tooSmall('GPICK ' + D.GPICK, D.GPICK);
        [['the bead', D.BEAD_SRC.size], ['a sort card', Math.min(D.SORT_SLOT.w, D.SORT_SLOT.h)], ['a digit card', D.COL_KEYS.size],
         ['a zero card', Math.min(D.ZERO_CARD.w, D.ZERO_CARD.h)]].forEach(p => { tooSmall(p[0] + ' (' + p[1] + ')', p[1]); if (p[1] < D.GPICK) fail('GAME: ' + p[0] + ' (' + p[1] + ') is smaller than GPICK ' + D.GPICK); });
        need('bead', /addPiece\(B, \{ w:S\.size, h:S\.size, cx:S\.x, cy:S\.y,/, 'the bead is not BEAD_SRC-sized');
        need('sort', /addPiece\(B, \{ w:S\.w, h:S\.h, cx:cx, cy:cy, text:show\(v\)/, 'the sort cards are not SORT_SLOT-sized with the card value on them');
        need('col', /addPiece\(B, \{ w:COL_KEYS\.size, h:COL_KEYS\.size, cx:kp\.x, cy:kp\.y,/, 'the digit cards are not COL_KEYS.size at colKeyXY()');
        need('zero', /addPiece\(B, \{ w:ZERO_CARD\.w, h:ZERO_CARD\.h, cx:cx, cy:cy, text:t,/, 'the zero cards are not ZERO_CARD-sized');

        /* ===== 第 1 關：讀格子（範例 1） ===== */
        {
          const G = D.READ_GRID, cell = G.side / 10;
          /* sqCellXY：一條一條（直的）塗 —— 第 n 小格在第 floor(n/10) 條、第 n%10 格 */
          for (let n = 0; n < 100; n++){
            const p = D.sqCellXY(n, cell);
            if (!(Math.abs(p.x - Math.floor(n / 10) * cell) < 1e-9 && Math.abs(p.y - (n % 10) * cell) < 1e-9)) { fail('GAME: sqCellXY(' + n + ') is not strip by strip (column-major)'); break; }
          }
          [D.READ_XS.one, D.READ_XS.two].forEach((xs, i) => {
            const boxes = xs.map(x => ({ x:x - G.side / 2, y:G.y, w:G.side, h:G.side }));
            boxes.forEach(b => inside(b, 'read: a 100-square (' + (i + 1) + ' square layout)', D.READ_H));
            noHits(boxes, 'read: the two 100-squares');
            boxes.forEach(b => { if (hit(b, { x:0, y:D.READ_CAP.y, w:W, h:D.READ_CAP.h })) fail('GAME: read: the "1 big square = 1" caption overlaps a square'); });
          });
          if (D.READ_XS.one.length !== 1 || D.READ_XS.two.length !== 2) fail('GAME: read: READ_XS should give one and two square positions');
          need('read', /if \(e\.w\) squareInto\(B, xs\[0\] - G\.side \/ 2, G\.y, G\.side, 100\);\s*squareInto\(B, xs\[xs\.length - 1\] - G\.side \/ 2, G\.y, G\.side, e\.t \* 10 \+ e\.h\);/,
               'the picture is not one full square (when w = 1) plus t strips and h small squares');
          need('read', /var e = pick\(GAME_READ\), G = READ_GRID, xs = e\.w \? READ_XS\.two : READ_XS\.one;/, 'the picture does not draw two squares exactly when there is a whole square (w = 1)');
          need('read', /var s = inp\.value\.trim\(\), r = readRule\(e, s\);\s*if \(r\.kind === 'fmt'\)\{ gMsg\.textContent = d\.gReadFmt; return; \}\s*if \(r\.kind === 'ok'\)\{/, 'the typed answer is not judged by readRule(), or a badly written number counts as a mistake');
          need('read', /roundMiss\(r\.kind === 'noPoint' \? d\.gReadNoPoint\(s\) : r\.kind === 'tenth' \? d\.gReadTenth\(e\.h\) : r\.kind === 'whole' \? d\.gReadWhole\s*: r\.kind === 'swap' \? d\.gReadSwap\(s\) : d\.gReadWrong\(s\)\);/, 'each kind of wrong reading is not paired with its own reason');
          need('read', /roundSolved\(d\.gReadDone\(e\.w, e\.t, e\.h, fmtNat\(readMil\(e\)\)\)\)/, 'the solved message is not built from the picture');
          let anyW = false, anyT0 = false, anyH0 = false, anySwap = false;
          const seenR = new Set();
          D.GAME_READ.forEach((e, i) => {
            const w0 = 'GAME_READ[' + i + ']';
            if (!([0, 1].indexOf(e.w) >= 0 && Number.isInteger(e.t) && Number.isInteger(e.h) && e.t >= 0 && e.t <= 9 && e.h >= 0 && e.h <= 9 && e.t * 10 + e.h >= 1)) return fail('GAME: ' + w0 + ' is out of range');
            /* 自己的正解：五格陣列，[0, w, t, h, 0] */
            const T = milOf([0, e.w, e.t, e.h, 0]);
            if (D.readMil(e) !== T) fail('GAME: ' + w0 + ': readMil() gives ' + D.readMil(e) + ', the picture is ' + T);
            if (seenR.has(T)) fail('GAME: ' + w0 + ' repeats a value'); seenR.add(T);
            if (e.w) anyW = true; if (e.t === 0) anyT0 = true; if (e.h === 0) anyH0 = true; if (e.t && e.h && e.t !== e.h) anySwap = true;
            const ans = natR(T);
            /* 照頁面的 readRule 走：每一個 0.00～9.99 的寫法，只有正解收；正解多寫最後面的 0、全形數字也收 */
            for (let v = 0; v < 10000; v += 10){
              const r = D.readRule(e, natR(v));
              if ((r.kind === 'ok') !== (v === T)) { fail('GAME: ' + w0 + ': readRule("' + natR(v) + '") is ' + r.kind + ' but the picture is ' + ans); break; }
            }
            [padR(T, 2), padR(T, 3), ans.replace(/\d/g, c => String.fromCharCode(0xFF10 + +c)), ' ' + ans + ' '].forEach(s => {
              if (D.readRule(e, s).kind !== 'ok') fail('GAME: ' + w0 + ': the same number written "' + s + '" is not accepted');
            });
            ['1 3', '01.3', '.5', '0.1234', '', 'abc', '3.', '0.3.4', '-0.3'].forEach(s => {
              if (D.readRule(e, s).kind !== 'fmt') fail('GAME: ' + w0 + ': "' + s + '" should only get the format reminder, not be judged');
            });
            /* 每一種錯法：頁面說的種類是真的那一種 */
            const cells = e.w * 100 + e.t * 10 + e.h;
            const want = [[String(cells), 'noPoint']];
            if (e.t === 0) want.push([natR(e.w * 1000 + e.h * 100), 'tenth']);
            if (e.w === 1) want.push([natR(T - 1000), 'whole']);
            if (e.t && e.h && e.t !== e.h) want.push([natR(e.w * 1000 + e.h * 100 + e.t * 10), 'swap']);
            want.push(['9.9', 'wrong']);
            want.forEach(([s, k]) => { const r = D.readRule(e, s); if (r.kind !== k) fail('GAME: ' + w0 + ': "' + s + '" should be judged ' + k + ', got ' + r.kind); });
            for (let v = 0; v < 10000; v += 10){
              const r = D.readRule(e, natR(v));
              if (r.kind === 'tenth' && !(e.t === 0 && v === e.w * 1000 + e.h * 100)) fail('GAME: ' + w0 + ': ' + natR(v) + ' is called "tenths written as strips" but it is not');
              if (r.kind === 'whole' && !(e.w === 1 && v === T - 1000)) fail('GAME: ' + w0 + ': ' + natR(v) + ' is called "forgot the whole square" but it is not');
              if (r.kind === 'swap' && !(dig(v, 1) === e.h && dig(v, 2) === e.t && dig(v, 0) === e.w && dig(v, 3) === 0)) fail('GAME: ' + w0 + ': ' + natR(v) + ' is called "swapped" but it is not');
            }
            LANGS.forEach(L => {
              const d = I18N[L], wl = w0 + ' ' + L;
              seq(wl + ' gReadDone', d.gReadDone(e.w, e.t, e.h, ans), (L === 'zh'
                ? [ans].concat(e.w ? [1] : []).concat([e.t, e.h]).concat(e.w ? [1, 1] : []).concat([e.t, '0.1', e.h, '0.01']).concat(e.h === 0 ? [ans + '0', 0] : [])
                : [ans].concat(e.w ? [1] : []).concat([e.t, e.h]).concat(e.w ? [1] : []).concat([e.t, e.h]).concat(e.h === 0 ? [ans + '0', 0] : [])));
              seq(wl + ' gRead2', d.gRead2(e.w, e.t, e.h), (L === 'zh' ? [2, e.t, e.h] : [2, e.t, e.h]).concat(e.w ? [1] : []));
              seq(wl + ' gReadNoPoint', d.gReadNoPoint(String(cells)), L === 'zh' ? [cells, cells, '0.01'] : [cells, cells, '0.01']);
              if (e.t === 0) seq(wl + ' gReadTenth', d.gReadTenth(e.h), L === 'zh' ? [e.h, e.h, e.h, '0.1', e.h, 0, e.h] : [e.h, e.h, e.h, '0.1', e.h, 0, e.h]);
            });
          });
          if (!anyW || !anyT0 || !anyH0 || !anySwap) fail('GAME: GAME_READ must include a whole square, a tenths digit of 0, a hundredths digit of 0 and a swappable reading');
          LANGS.forEach(L => { seq('gReadCap ' + L, I18N[L].gReadCap, [1]); if (/[＝=]/.test(I18N[L].gReadCap)) fail('GAME: gReadCap ' + L + ' must say “is”, not “=”'); seq('gReadWhole ' + L, I18N[L].gReadWhole, [1]); seq('gReadFmt ' + L, I18N[L].gReadFmt, ['0.25', 0]); });
        }

        /* ===== 第 2 關：撥珠子（範例 2：每一位只放一個數字） ===== */
        {
          const C = D.BEAD_COL, BD = D.BEAD, S = D.BEAD_SRC;
          const colBox = k => ({ x:C.xs[k], y:C.y, w:C.w, h:C.h });
          const colBoxes = [0, 1, 2, 3].map(colBox);
          colBoxes.forEach((b, k) => inside(b, 'bead: column ' + k, D.BEAD_H));
          noHits(colBoxes, 'bead: columns');
          for (let k = 0; k < 3; k++) if (!(C.xs[k] < C.xs[k + 1])) fail('GAME: bead: the columns are not ones → thousandths from left to right');
          /* 小數點在個位和十分位中間，碰不到任何一欄 */
          const dotBox = { x:D.BEAD_DOT.x - 6, y:D.BEAD_DOT.y - 20, w:12, h:40 };
          inside(dotBox, 'bead: the decimal point', D.BEAD_H);
          if (!(dotBox.x >= C.xs[0] + C.w && dotBox.x + dotBox.w <= C.xs[1])) fail('GAME: bead: the decimal point is not between the ones and the tenths');
          const srcBox = sq(S.x, S.y, S.size);
          inside(srcBox, 'bead: the bead source', D.BEAD_H);
          colBoxes.forEach((b, k) => { if (hit(srcBox, { x:b.x - D.BEAD_PAD, y:b.y - D.BEAD_PAD, w:b.w + 2 * D.BEAD_PAD, h:b.h + 2 * D.BEAD_PAD })) fail('GAME: bead: the bead at home is already inside column ' + k + "'s snap zone"); });
          /* beadXY：九顆（三排三顆）都在那一欄裡面、彼此不重疊、在欄名與單位（上面 40px）和下面的數字（下面 40px）之間 */
          for (let k = 0; k < 4; k++){
            const bs = [];
            for (let i = 0; i < 9; i++){
              const p = D.beadXY(k, i), b = sq(p.x, p.y, BD.size);
              bs.push(b);
              if (!(b.x >= C.xs[k] + 3 && b.x + b.w <= C.xs[k] + C.w - 3 && b.y >= C.y + 40 && b.y + b.h <= C.y + C.h - 40)) { fail('GAME: bead: bead ' + i + ' of column ' + k + ' is outside the space between the heading and the digit'); break; }
            }
            noHits(bs, 'bead: beads of column ' + k);
          }
          need('bead', /var c = nearestOpen\(cols, pt, BEAD_PAD\);\s*if \(!c\) return false;/, 'a drop away from the columns is not silent (or ignores BEAD_PAD)');
          need('bead', /var why = beadRule\(c\.k, have\[c\.k\], m\);\s*if \(why\)\{\s*roundMiss\(why === 'zero' \? d\.gBeadZero\(num, placeOf\(d, c\.k\)\) : d\.gBeadFull\(num, placeOf\(d, c\.k\), want\[c\.k\]\)\);\s*return false;/, 'a bead is not judged by beadRule(), or a reason is paired with the wrong rule');
          need('bead', /var q = beadXY\(c\.k, have\[c\.k\]\);\s*addZone\(B, q\.x - BEAD\.size \/ 2, q\.y - BEAD\.size \/ 2, BEAD\.size, BEAD\.size, 'gbead'\);\s*have\[c\.k\]\+\+; c\.num\.textContent = have\[c\.k\];/, 'an accepted bead does not draw exactly one bead and count exactly one');
          need('bead', /if \(have\.join\(\) === want\.join\(\)\)\{/, 'the round is not solved exactly when every column holds its digit');
          need('bead', /var m = pick\(GAME_BEAD\), want = \[0, 1, 2, 3\]\.map\(function\(k\)\{ return digitAt\(m, k\); \}\)/, 'the target digits are not read from the number');
          need('bead', /u\.textContent = fmtNat\(placeUnit\(k\)\);/, 'the column headings do not show what one bead is worth');
          if ([0, 1, 2, 3].map(k => natR([1000, 100, 10, 1][k])).join() !== '1,0.1,0.01,0.001') fail('GAME: bead: internal');
          D.GAME_BEAD.forEach((m, i) => {
            const w0 = 'GAME_BEAD[' + i + ']', g = milDigitsRef(m);
            if (!g || g[0] !== 0 || g[1] < 1) return fail('GAME: ' + w0 + ' must be a one-digit whole number with three decimal places');
            const dd = g.slice(1);   /* 個位、十分位、百分位、千分位 */
            if (dd[3] === 0) fail('GAME: ' + w0 + ': the thousandths digit is 0, so that 0 is a trailing 0 and the number does not need three places');
            if ((dd[1] === 0) + (dd[2] === 0) !== 1) fail('GAME: ' + w0 + ': exactly one of the tenths / hundredths must be 0 (the 0 that holds a place)');
            /* 一欄最多 9 顆：上面的 beadXY 檢查已經驗過 9 顆都放得下、彼此不重疊，所以任何一位數字都畫得下 */
            /* 照頁面的 beadRule 走：每一欄一顆一顆放，放到第 digit 顆都收、再多一顆不收；是 0 的那一欄一顆都不收 */
            const have = [0, 0, 0, 0];
            for (let k = 0; k < 4; k++){
              for (let n = 0; n <= 9; n++){
                const r = D.beadRule(k, n, m), want = dd[k] === 0 ? 'zero' : (n < dd[k] ? '' : 'full');
                if (r !== want) { fail('GAME: ' + w0 + ': beadRule(column ' + k + ', ' + n + ' beads) is "' + r + '", should be "' + want + '"'); break; }
              }
              while (D.beadRule(k, have[k], m) === '' && have[k] < 20) have[k]++;
            }
            if (milOf([0].concat(have)) !== m) fail('GAME: ' + w0 + ': playing by beadRule() ends with ' + have.join() + ', which is not ' + natR(m));
            const num = padR(m, 3);
            LANGS.forEach(L => {
              const d = I18N[L], wl = w0 + ' ' + L;
              seq(wl + ' gBeadDone', d.gBeadDone(num, dd), L === 'zh' ? [num, dd[0], 1, dd[1], '0.1', dd[2], '0.01', dd[3], '0.001'] : [num].concat(dd));
              for (let k = 0; k < 4; k++){
                if (dd[k] === 0){
                  const t = d.gBeadZero(num, placeTxt(L, k));
                  seq(wl + ' gBeadZero', t, [num, 0, 0]);
                  if (t.indexOf(L === 'zh' ? placeTxt(L, k) : cap(placeTxt(L, k))) < 0) fail('GAME: ' + wl + ': gBeadZero does not name ' + placeTxt(L, k));
                } else {
                  const t = d.gBeadFull(num, placeTxt(L, k), dd[k]);
                  seq(wl + ' gBeadFull', t, [num, dd[k], dd[k]]);
                }
              }
              /* 第二層提示：每一欄還差幾顆（從空的開始、和放了一半各算一次） */
              [[0, 0, 0, 0], [Math.min(1, dd[0]), 0, 0, 0]].forEach(hv => {
                const want = [2];
                for (let k = 0; k < 4; k++) if (dd[k] > 0 && hv[k] < dd[k]) want.push(dd[k] - hv[k]);
                want.push(0);   /* 「…是 0，不放」 */
                seq(wl + ' gBead2', d.gBead2(dd, hv, d.gBeadHead), want);
                const zk = dd[1] === 0 ? 1 : 2;
                if (d.gBead2(dd, hv, d.gBeadHead).indexOf(d.gBeadHead[zk]) < 0) fail('GAME: ' + wl + ': hint 2 does not say which place is 0');
              });
            });
          });
          LANGS.forEach(L => { if (!(Array.isArray(I18N[L].gBeadHead) && I18N[L].gBeadHead.length === 4)) fail('GAME: gBeadHead needs four headings in ' + L); });
          if (I18N.zh.gBeadHead.join() !== PLACE_ZH.join()) fail('GAME: bead: the zh column headings are not 個位、十分位、百分位、千分位 in that order');
          /* 欄名放得下：最長的英文欄名（12px 粗體）不可以比欄寬還寬 */
          /* 欄名放不放得下由端對端測試量渲染出來的字寬（這裡的 estTextW 是上界，對 11px 的 thousandths 太悲觀） */
        }

        /* ===== 第 3 關：排排站（範例 3：先補零，再從整數部分一位一位比） ===== */
        {
          const S = D.SORT_SLOT;
          const slots = [0, 1, 2, 3].map(i => sq(D.sortSlotX(i), S.y, S.w, S.h));
          slots.forEach((b, i) => inside(b, 'sort: slot ' + i, D.SORT_H));
          noHits(slots, 'sort: slots');
          const tray = [0, 1, 2, 3].map(i => sq((W - 3 * S.step) / 2 + i * S.step, D.SORT_CARD.y, S.w, S.h));
          tray.forEach((b, i) => inside(b, 'sort: tray card ' + i, D.SORT_H));
          noHits(tray, 'sort: tray cards');
          tray.forEach(t => slots.forEach(s => { if (hit(t, s)) fail('GAME: sort: a tray card overlaps a slot'); }));
          if (!(D.SORT_LBL.y + D.SORT_LBL.h <= S.y - S.h / 2)) fail('GAME: sort: the small / big labels overlap the slots');
          need('sort', /var v = P\.data\.v, c = sorted\[s\.i\];\s*if \(v !== c\)\{\s*var plan = cmpPlan\(v, c, byV\[v\]\.p, byV\[c\]\.p\), st = plan\.steps\[plan\.steps\.length - 1\];\s*roundMiss\(d\.gSortWrong\(show\(v\), show\(c\), fmtPad\(v, plan\.pad\), fmtPad\(c, plan\.pad\), st, st\.kind === 'whole' \? '' : placeOf\(d, st\.k\), plan\.cmp > 0\)\);\s*return false;/,
               'a card is accepted in a slot that is not its place, or the reason is not built from cmpPlan()');
          need('sort', /s\.done = true; s\.el\.classList\.add\('filled'\);\s*P\.lock\(s\.cx, s\.cy\); P\.el\.classList\.add\('placed'\);\s*left\.splice\(left\.indexOf\(v\), 1\); placed\+\+;[\s\S]*?if \(placed === 4\) roundSolved/, 'a placed card does not count exactly one (or the round ends before all four are placed)');
          for (let i = 0; i < 4; i++) if (D.sortSlotX(i) !== W / 2 + (i - 1.5) * S.step) fail('GAME: sort: slot ' + i + ' is at x = ' + D.sortSlotX(i) + ', expected ' + (W / 2 + (i - 1.5) * S.step) + ' (left to right, small to big)');
          need('sort', /sorted = vals\.slice\(\)\.sort\(function\(a, b\)\{ return a - b; \}\)/, 'the answer order is not small → big by value');
          D.GAME_SORT.forEach((set, i) => {
            const w0 = 'GAME_SORT[' + i + ']';
            if (!Array.isArray(set) || set.length !== 4) return fail('GAME: ' + w0 + ' needs four cards');
            const shown = set.map(o => padR(o.v, o.p));
            set.forEach((o, j) => {
              if (!milDigitsRef(o.v) || milDigitsRef(o.v)[0] !== 0) fail('GAME: ' + w0 + '[' + j + ']: the whole part must be one digit');
              if (!(o.p >= fracLenRef(milDigitsRef(o.v)) && o.p <= 3)) fail('GAME: ' + w0 + '[' + j + ']: p = ' + o.p + ' would truncate (or go past the thousandths)');
              if (!reprintOk(shown[j]) || D.fmtPad(o.v, o.p) !== shown[j]) fail('GAME: ' + w0 + '[' + j + ']: the card prints as "' + D.fmtPad(o.v, o.p) + '", expected "' + shown[j] + '"');
            });
            if (new Set(set.map(o => o.v)).size !== 4) fail('GAME: ' + w0 + ': two cards are the same size, so the order is not unique');
            if (new Set(set.map(o => o.p)).size < 2) fail('GAME: ' + w0 + ': all cards have the same number of places — the round is about different lengths');
            let trap = false, near = false;
            set.forEach(a => set.forEach(b => {
              const A = milDigitsRef(a.v), Bd = milDigitsRef(b.v);
              if (a.p > b.p && cmpDigitsRef(A, Bd) < 0) trap = true;   /* 位數多、卻比較小 */
              const db = decidedByRef(A, Bd);
              if (db.kind === 'place' && db.k >= 2) near = true;         /* 要比到百分位以後 */
            }));
            if (!trap) fail('GAME: ' + w0 + ': no card with more places is smaller — the "more places means bigger" trap is missing');
            if (!near) fail('GAME: ' + w0 + ': no pair needs comparing past the tenths');
            /* 照頁面的規則走：一格只收排在那裡的那一張 —— 每一張放進每一格都試一次；說明逐句驗 */
            const sorted = set.map(o => o.v).sort((x, y) => cmpDigitsRef(milDigitsRef(x), milDigitsRef(y)));
            const byV = {}; set.forEach(o => { byV[o.v] = o; });
            sorted.forEach(c => set.forEach(o => {
              const v = o.v;
              if (v === c) return;
              const plan = D.cmpPlan(v, c, byV[v].p, byV[c].p), st = plan.steps[plan.steps.length - 1];
              const A = milDigitsRef(v), Cc = milDigitsRef(c), want = cmpDigitsRef(A, Cc), db = decidedByRef(A, Cc);
              if (plan.cmp !== want) fail('GAME: ' + w0 + ': cmpPlan(' + natR(v) + ', ' + natR(c) + ') says ' + plan.cmp + ', the digit route says ' + want);
              if (db.kind === 'whole' ? st.kind !== 'whole' : !(st.kind === 'place' && st.k === db.k)) fail('GAME: ' + w0 + ': cmpPlan settles ' + natR(v) + ' vs ' + natR(c) + ' at the wrong place');
              const pad = Math.max(fracLenRef(A), fracLenRef(Cc), byV[v].p, byV[c].p);
              const pv = padR(v, pad), pc = padR(c, pad);
              if (D.fmtPad(v, plan.pad) !== pv || D.fmtPad(c, plan.pad) !== pc) fail('GAME: ' + w0 + ': padding ' + natR(v) + ' and ' + natR(c) + ' gives ' + D.fmtPad(v, plan.pad) + ' / ' + D.fmtPad(c, plan.pad) + ', expected ' + pv + ' / ' + pc);
              LANGS.forEach(L => {
                const t = I18N[L].gSortWrong(shown[set.indexOf(o)], padR(c, byV[c].p), pv, pc, st, st.kind === 'whole' ? '' : placeTxt(L, st.k), want > 0);
                const sv = shown[set.indexOf(o)], sc = padR(c, byV[c].p), padded = pv !== sv || pc !== sc;
                const nums = db.kind === 'whole' ? [A[1], Cc[1], sv, sc]
                  : (padded ? [pv, pc] : []).concat([A[1 + db.k], Cc[1 + db.k], sv, sc]);
                seq(w0 + ' ' + sv + '→' + sc + ' gSortWrong ' + L, t, nums);
                const after = L === 'zh' ? '要排在它後面' : 'goes after it', before = L === 'zh' ? '要排在它前面' : 'goes before it';
                if (t.indexOf(want > 0 ? after : before) < 0 || t.indexOf(want > 0 ? before : after) >= 0) fail('GAME: ' + w0 + ' ' + L + ': the reason sends ' + sv + ' the wrong way: ' + t);
                if (db.kind === 'place' && t.indexOf(placeTxt(L, db.k)) < 0) fail('GAME: ' + w0 + ' ' + L + ': the reason does not name ' + placeTxt(L, db.k) + ': ' + t);
                const big = L === 'zh' ? ' 大' : 'bigger', small = L === 'zh' ? ' 小' : 'smaller';
                if (t.indexOf(want > 0 ? big : small) < 0) fail('GAME: ' + w0 + ' ' + L + ': the reason says the wrong size: ' + t);
              });
            }));
            LANGS.forEach(L => {
              seq(w0 + ' gSortDone ' + L, I18N[L].gSortDone(sorted.map(v => padR(v, byV[v].p))), sorted.map(v => padR(v, byV[v].p)));
              seq(w0 + ' gSort2 ' + L, I18N[L].gSort2(padR(sorted[0], byV[sorted[0]].p)), [2, padR(sorted[0], byV[sorted[0]].p)]);
            });
            /* 卡片放得下：最長的那一張（20px 粗體）比卡片內寬窄 */
            shown.forEach(s => { if (estTextW(s, 19) > S.w - 6) fail('GAME: ' + w0 + ': the card "' + s + '" is too wide for a ' + S.w + 'px card'); });
          });
          LANGS.forEach(L => { seq('gSortNow ' + L, I18N[L].gSortNow(3), [3, 4]); });
        }

        /* ===== 第 4 關：直式（範例 4：二位小數，小數點對齊，從百分位算起） ===== */
        {
          const X = D.COL_X, Y = D.COL_Y, h = D.COL_SLOT / 2, CK = D.COL_KEYS;
          const ansRow = [sq(X.o, Y.s, D.COL_SLOT), sq(X.p, Y.s, D.COL_PSLOT, D.COL_SLOT), sq(X.t, Y.s, D.COL_SLOT), sq(X.h, Y.s, D.COL_SLOT)];
          ansRow.forEach((b, i) => inside(b, 'col: answer box ' + i, D.COL_H));
          noHits(ansRow, 'col: answer boxes');
          if (!(X.op < X.o && X.o < X.p && X.p < X.t && X.t < X.h)) fail('GAME: col: the columns are not op, ones, point, tenths, hundredths from left to right');
          [Y.a, Y.b].forEach(y => { const r = [sq(X.o, y, D.COL_SLOT), sq(X.t, y, D.COL_SLOT), sq(X.h, y, D.COL_SLOT)]; r.forEach(b => inside(b, 'col: a number cell', D.COL_H)); noHits(r, 'col: number cells'); });
          const carries = [sq(X.t, Y.c, D.COL_CSLOT), sq(X.o, Y.c, D.COL_CSLOT)];
          carries.forEach(b => inside(b, 'col: a carry box', D.COL_H));
          if (hit(carries[0], sq(X.t, Y.a, D.COL_SLOT)) || hit(carries[1], sq(X.o, Y.a, D.COL_SLOT))) fail('GAME: col: a carry box overlaps the first number');
          const keys = [];
          for (let v = 0; v <= 10; v++){ const p = D.colKeyXY(v); keys.push(sq(p.x, p.y, CK.size)); }
          keys.forEach((b, i) => inside(b, 'col: card ' + i, D.COL_H));
          noHits(keys, 'col: number cards');
          keys.forEach(k => ansRow.forEach(a => { if (hit(k, { x:a.x - D.COL_PAD, y:a.y - D.COL_PAD, w:a.w + 2 * D.COL_PAD, h:a.h + 2 * D.COL_PAD })) fail('GAME: col: a number card sits inside an answer box snap zone'); }));
          if (D.COL_KEY_OF.join() !== ',o,t,h' || D.VF_POS.join() !== '-1,0,1,2') fail('GAME: col: COL_KEY_OF must name VF_POS columns 1~3 as ones, tenths, hundredths');
          need('col', /var ask = gameStage\.querySelector\('\.gask'\);\s*if \(ask\) ask\.textContent = d\.gColAsk\(e\.op\);/, 'the prompt does not follow this problem\'s operation');
          need('col', /var s = nearestOpen\(slots\.concat\(\[pslot\]\), pt, COL_PAD\);\s*if \(!s\) return false;/, 'a drop away from the boxes is not silent');
          need('col', /if \(!P\.data\.dot\)\{ roundMiss\(d\.gColDotNeed\); return false; \}/, 'a digit is accepted in the point box');
          need('col', /if \(P\.data\.dot\)\{ roundMiss\(d\.gColDotNot\); return false; \}/, 'the point is accepted in a digit box');
          need('col', /if \(s\.i !== next\)\{ roundMiss\(d\.gColOrder\(d\.gColKinds\[N\.k\]\)\); return false; \}/, 'a box can be filled out of order');
          need('col', /var r = colRule\(N, val, e\.op\);\s*if \(r\)\{/, 'a digit is not judged by colRule()');
          need('col', /roundMiss\(r === 'c' \? d\.gColC\(placeOf\(d, COL_K\[N\.from\]\), N\.s, val\)\s*: r === 'forgot' \? d\.gColForgot\(place, N\.x, N\.y, N\.s, N\.v\)\s*: r === 'tc' \? d\.gColTc\(place, sum\(N\), d\.gColUnit\[N\.k\], d\.gColUp\[N\.k\], N\.v\)\s*: r === 'flip' \? d\.gColFlip\(place, N\.t0, N\.y, N\.top, N\.v\)\s*: r === 'lent' \? d\.gColLent\(place, why\(N\), val\)\s*: e\.op === '\+' \? d\.gColGAdd\(place, sum\(N\), N\.v, val\) : d\.gColGSub\(place, why\(N\), N\.v, val\)\);/,
               'a colRule() reason is paired with the wrong sentence');
          need('col', /var e = pick\(GAME_COL\), CS = colSteps\(e\.a, e\.b, e\.op\), steps = CS\.steps, next = 0, dotDone = false,/, 'the round does not start with the point still to place');
          if ((B.col.match(/dotDone = true/g) || []).length !== 1 || !/if \(!P\.data\.dot\)\{ roundMiss\(d\.gColDotNeed\); return false; \}\s*s\.done = true; dotDone = true;/.test(B.col)) fail('GAME: col: the point is marked done anywhere but in a successful "." drop');
          need('col', /if \(next === steps\.length && dotDone\)\{/, 'the round is solved before every box and the point are filled');
          need('col', /var pd = places\(r\[0\]\);[\s\S]*?'gcell' \+ \(pd < 1 \? ' gpad' : ''\)[\s\S]*?'gcell' \+ \(pd < 2 \? ' gpad' : ''\)/, 'the padding 0s are not drawn in orange');
          if (!(X.o + h <= X.p - D.COL_PSLOT / 2 + 0.001)) fail('GAME: col: the ones box overlaps the point box');
          const COLK = { o:0, t:1, h:2 }, ZHN = { o:'個位', t:'十分位', h:'百分位' };
          let carryH = false, carryT = false, borrowChain = false, zeroLent = false, noBorrow = 0, padded = 0, dropZero = false;
          D.GAME_COL.forEach((c, i) => {
            const w0 = 'GAME_COL[' + i + '] ' + natR(c.a) + ' ' + c.op + ' ' + natR(c.b);
            const A = milDigitsRef(c.a), Bd = milDigitsRef(c.b);
            if (!A || !Bd || A[0] || Bd[0]) return fail('GAME: ' + w0 + ': both numbers must be under 10');
            if (A[4] || Bd[4]) fail('GAME: ' + w0 + ': the column game only goes to the hundredths');
            if (fracLenRef(A) !== fracLenRef(Bd)) padded++;
            const r = c.op === '+' ? addDigitsRef(A, Bd) : subDigitsRef(A, Bd);
            if (r.over || r.digits[0]) return fail('GAME: ' + w0 + ': the answer leaves the ones (or goes negative)');
            if (c.op === '+' && !carriesRef(c.a, c.b)) fail('GAME: ' + w0 + ': the addition never carries');
            if (c.op === '-' && !borrowsRef(c.a, c.b)) noBorrow++;
            if (milOf(r.digits) !== D.colSteps(c.a, c.b, c.op).res) fail('GAME: ' + w0 + ': colSteps().res disagrees with the digit route');
            if (r.digits[4] === 0 && r.digits[3] === 0 && r.digits[2] !== 0) dropZero = true;
            /* 自己的直式：一欄一欄，從百分位往左 */
            const mine = [];
            if (c.op === '+'){
              let cin = 0;
              for (const k of ['h', 't', 'o']){
                const j = 1 + COLK[k], s = A[j] + Bd[j] + cin;
                mine.push({ k:k, v:s % 10, x:A[j], y:Bd[j], cin:!!cin, s:s });
                if (s >= 10 && k !== 'o'){ mine.push({ k:'c' + (k === 'h' ? 't' : 'o'), v:1, s:s, from:k }); if (k === 'h') carryH = true; else carryT = true; }
                cin = s >= 10 ? 1 : 0;
              }
            } else {
              let lent = 0, chain = 0;
              for (const k of ['h', 't', 'o']){
                const j = 1 + COLK[k], t0 = A[j] - lent, bor = t0 < Bd[j] ? 1 : 0;
                if (lent && t0 < 0) zeroLent = true;
                mine.push({ k:k, v:t0 + 10 * bor - Bd[j], x:A[j], y:Bd[j], lent:!!lent, t0:t0, top:t0 + 10 * bor, borrow:!!bor });
                chain += bor; lent = bor;
              }
              if (chain >= 2) borrowChain = true;
            }
            const steps = D.colSteps(c.a, c.b, c.op).steps;
            if (steps.length !== mine.length) return fail('GAME: ' + w0 + ': colSteps() has ' + steps.length + ' steps, my column has ' + mine.length);
            steps.forEach((N, n) => {
              const M = mine[n], keys2 = Object.keys(M);
              let same = true;
              keys2.forEach(kk => { if (N[kk] !== M[kk]){ same = false; fail('GAME: ' + w0 + ' step ' + n + ': ' + kk + ' is ' + N[kk] + ', the digit route says ' + M[kk]); } });
              if (!same) return;   /* 頁面的這一步已經錯了：下面拿它走規則只會疊出一串跟著錯的訊息 */
              /* 照頁面的 colRule 走：每一張數字卡，只有正解收；說「為什麼」的種類要是真的 */
              for (let val = 0; val <= 9; val++){
                const why = D.colRule(N, val, c.op);
                if ((why === '') !== (val === M.v)) { fail('GAME: ' + w0 + ' step ' + n + ': colRule(' + val + ') is "' + why + '" but the box takes ' + M.v); continue; }
                if (!why) continue;
                const carryStep = M.k === 'ct' || M.k === 'co';
                const truth = { c:carryStep, forgot:!carryStep && c.op === '+' && M.cin && val === (M.x + M.y) % 10, tc:!carryStep && c.op === '+' && M.s >= 10 && val === 1,
                                flip:c.op === '-' && M.borrow && M.t0 >= 0 && val === M.y - M.t0, lent:c.op === '-' && M.lent && val === M.v + 1 };
                /* 'g'（一般的錯）只有在上面每一種都不是的時候才對 —— 不然有一種專門的理由被吞掉了 */
                truth.g = !carryStep && !truth.forgot && !truth.tc && !truth.flip && !truth.lent;
                if (!truth[why]) fail('GAME: ' + w0 + ' step ' + n + ': card ' + val + ' is called "' + why + '", which is not what happened');
                LANGS.forEach(L => {
                  const d = I18N[L], pl = carryStep ? '' : placeTxt(L, COLK[M.k]), wl = w0 + ' step ' + n + ' card ' + val + ' ' + L;
                  const sum = carryStep ? '' : (c.op === '+' ? d.gColAdd(M.x, M.y, M.cin, M.s) : '');
                  const sw = c.op === '-' && !carryStep ? d.gColSubWhy(M.x, M.y, M.lent, M.t0, M.top, M.borrow) : '';
                  let t;
                  if (why === 'c') t = d.gColC(placeTxt(L, COLK[M.from]), M.s, val);
                  else if (why === 'forgot') t = d.gColForgot(pl, M.x, M.y, M.s, M.v);
                  else if (why === 'tc') t = d.gColTc(pl, sum, d.gColUnit[M.k], d.gColUp[M.k], M.v);
                  else if (why === 'flip') t = d.gColFlip(pl, M.t0, M.y, M.top, M.v);
                  else if (why === 'lent') t = d.gColLent(pl, sw, val);
                  else t = c.op === '+' ? d.gColGAdd(pl, sum, M.v, val) : d.gColGSub(pl, sw, M.v, val);
                  if (typeof t !== 'string' || /undefined|NaN|null/.test(t)) return fail('GAME: ' + wl + ': ' + t);
                  decArith(t).problems.forEach(p => fail('GAME: ' + wl + ': ' + p));
                  if (/-\d/.test(t)) fail('GAME: ' + wl + ': a negative number in the reason — ' + t);
                  const tk = toks(t);
                  if (why === 'c' && !(tk.indexOf(String(M.s)) >= 0 && tk[tk.length - 1] === String(val))) fail('GAME: ' + wl + ': the carry reason does not state ' + M.s + ' and the rejected ' + val + ': ' + t);
                  if (why !== 'c' && tk[tk.length - 1] !== String(why === 'forgot' || why === 'tc' || why === 'flip' ? (why === 'tc' ? 1 : M.v) : val))
                    fail('GAME: ' + wl + ': the reason does not end with the right number: ' + t);
                  if (why === 'tc' && !(tk.indexOf(String(M.v)) >= 0 && tk.indexOf(String(M.s)) >= 0)) fail('GAME: ' + wl + ': the "write the 1" reason does not state ' + M.s + ' and ' + M.v + ': ' + t);
                  if (why === 'flip' && !(M.t0 < M.y)) fail('GAME: ' + wl + ': says "will not go" but ' + M.t0 + ' ≥ ' + M.y);
                  if (!carryStep && L === 'zh' && t.indexOf(ZHN[M.k]) < 0 && why !== 'forgot') fail('GAME: ' + wl + ': the reason does not name the place: ' + t);
                  if (c.op === '-' && !carryStep && (why === 'g' || why === 'lent')){
                    /* 減法的說明：講的「被借走」「不夠減」都要是真的，最後一條算式的答案是這一格 */
                    if (M.lent !== /被右邊借走|lent 1 to the right/.test(t)) fail('GAME: ' + wl + ': the reason ' + (M.lent ? 'forgets' : 'invents') + ' that this place lent 1: ' + t);
                    if (M.borrow !== /向左邊借 1|borrow(s)? 1 from the left/.test(t)) fail('GAME: ' + wl + ': the reason ' + (M.borrow ? 'forgets' : 'invents') + ' a borrow: ' + t);
                    if (toks(sw).slice(-1)[0] !== String(M.v)) fail('GAME: ' + wl + ': the working ends with ' + toks(sw).slice(-1)[0] + ', the box is ' + M.v);
                  }
                });
              }
              /* 第二層提示：叫頁面的 hint2 那一條路（gCol2 ＋ gColAdd／gColSubWhy／gCol2Carry），數字要對 */
              LANGS.forEach(L => {
                const d = I18N[L], kind = d.gColKinds[M.k];
                if (!kind) return fail('GAME: gColKinds.' + M.k + ' missing in ' + L);
                const carryStep = M.k === 'ct' || M.k === 'co';
                const how = carryStep ? d.gCol2Carry(placeTxt(L, COLK[M.from]), M.s) : (c.op === '+' ? d.gColAdd(M.x, M.y, M.cin, M.s) : d.gColSubWhy(M.x, M.y, M.lent, M.t0, M.top, M.borrow)) + d.gCol2Write(M.v);
                const t = d.gCol2(kind, how);
                decArith(t).problems.forEach(p => fail('GAME: ' + w0 + ' hint 2 ' + L + ': ' + p));
                if (toks(t).slice(-1)[0] !== String(M.v) || /undefined|NaN|-\d/.test(t)) fail('GAME: ' + w0 + ' step ' + n + ' hint 2 ' + L + ' does not end with ' + M.v + ': ' + t);
              });
            });
            const res = milOf(r.digits);
            LANGS.forEach(L => {
              const col = padR(res, 2), nat = natR(res);
              seq(w0 + ' gColDone ' + L, I18N[L].gColDone(natR(c.a), natR(c.b), c.op, col, nat), [natR(c.a), natR(c.b), col].concat(col !== nat ? (L === 'zh' ? [0, nat] : [0, nat]) : []));
              seq(w0 + ' gColLine ' + L, I18N[L].gColLine(natR(c.a), natR(c.b), c.op, nat), [natR(c.a), natR(c.b), nat]);
              if (D.fmtPad(res, 2) !== col) fail('GAME: ' + w0 + ': the answer row would read ' + D.fmtPad(res, 2) + ', expected ' + col);
            });
          });
          if (!carryH || !carryT) fail('GAME: GAME_COL: the additions must carry in the hundredths in one problem and in the tenths in another');
          if (!borrowChain || !zeroLent) fail('GAME: GAME_COL: the subtractions must include a chain of borrows and a 0 that lends (5 − 2.34)');
          if (noBorrow > 1) fail('GAME: GAME_COL: ' + noBorrow + ' subtractions never borrow — at most one');
          if (padded < 4) fail('GAME: GAME_COL: only ' + padded + ' problems need padding with 0 — pad is half the lesson');
          if (!dropZero) fail('GAME: GAME_COL: no answer ends in 0 (1.10), so "the 0 on the end can be dropped" is never shown');
          LANGS.forEach(L => {
            ['h', 'ct', 't', 'co', 'o'].forEach(k => { if (!I18N[L].gColKinds[k]) fail('GAME: gColKinds.' + k + ' missing in ' + L); });
            /* 題目的運算名要跟著這一題走：加法題不可以說減法，反過來也一樣（verifier 抓到 en 減法題寫著 column sum） */
            [['+', L === 'zh' ? '加法' : 'addition', L === 'zh' ? '減法' : 'subtraction'], ['-', L === 'zh' ? '減法' : 'subtraction', L === 'zh' ? '加法' : 'addition']].forEach(([op, yes, no]) => {
              const t = typeof I18N[L].gColAsk === 'function' ? I18N[L].gColAsk(op) : '';
              if (t.indexOf(yes) < 0 || t.indexOf(no) >= 0 || /\bsum\b/.test(t)) fail('GAME: gColAsk ' + L + ': the prompt for ' + op + ' does not name its operation: ' + t);
            });
            if (/\bsum\b|加法|減法/.test(I18N[L].gAsks.col) || /\bsum\b/.test(I18N[L].gColOrder('x'))) fail('GAME: gAsks.col / gColOrder ' + L + ' names one operation, but the round can be either');
            if (!/百分位|hundredths/.test(I18N[L].gColOrder(I18N[L].gColKinds.h))) fail('GAME: gColOrder ' + L + ' does not say the column starts from the hundredths');
          });
        }

        /* ===== 第 5 關：一樣大配對（範例 5：0 放在最後面 vs 放在小數點右邊） ===== */
        {
          const G = D.ZERO_GRID, Z = D.ZERO_BIN, CD = D.ZERO_CARD;
          const bins = D.ZERO_XS.map(x => ({ x:x - Z.w / 2, y:Z.y, w:Z.w, h:Z.h }));
          bins.forEach((b, i) => inside(b, 'zero: bin ' + i, D.ZERO_H));
          noHits(bins, 'zero: bins');
          D.ZERO_XS.forEach((x, b) => {
            const grid = { x:x - G.side / 2, y:G.y, w:G.side, h:G.side };
            if (!(grid.x >= bins[b].x && grid.x + grid.w <= bins[b].x + bins[b].w && grid.y >= bins[b].y)) fail('GAME: zero: grid ' + b + ' is not inside its bin');
            const placed = [0, 1, 2].map(i => { const p = D.zeroPlacedXY(b, i); return sq(p.x, p.y, CD.w, CD.h); });
            placed.forEach((p, i) => { if (!(p.x >= bins[b].x && p.x + p.w <= bins[b].x + bins[b].w && p.y + p.h <= bins[b].y + bins[b].h)) fail('GAME: zero: placed card ' + i + ' of bin ' + b + ' sticks out of the bin'); if (hit(p, grid)) fail('GAME: zero: placed card ' + i + ' covers the grid'); });
            noHits(placed, 'zero: placed cards of bin ' + b);
          });
          const tray = [0, 1, 2, 3, 4].map(i => sq((W - 4 * D.ZERO_TRAY.step) / 2 + i * D.ZERO_TRAY.step, D.ZERO_TRAY.y, CD.w, CD.h));
          tray.forEach((b, i) => inside(b, 'zero: tray card ' + i, D.ZERO_H));
          noHits(tray, 'zero: tray cards');
          tray.forEach(t => bins.forEach(b => { if (hit(t, { x:b.x - D.ZERO_PAD, y:b.y - D.ZERO_PAD, w:b.w + 2 * D.ZERO_PAD, h:b.h + 2 * D.ZERO_PAD })) fail('GAME: zero: a tray card at home is inside a bin snap zone'); }));
          need('zero', /var r = zeroRule\(P\.data\.m, bn\.g\);\s*if \(r\)\{ roundMiss\(r === 'big' \? d\.gZeroBig\(P\.data\.t, dd\) : d\.gZeroSmall\(P\.data\.t, dd\)\); return false; \}/, 'a card is not judged by zeroRule(), or the reasons are swapped');
          need('zero', /squareInto\(B, x - G\.side \/ 2, G\.y, G\.side, gv\[b\] \/ 10\);/, 'a grid is not shaded with exactly its value in hundredths');
          need('zero', /var gv = Math\.random\(\) < 0\.5 \? \[100 \* dd, 10 \* dd\] : \[10 \* dd, 100 \* dd\];/, 'the two grids are not d tenths and d hundredths in a random order');
          need('zero', /var q = zeroPlacedXY\(bn\.b, bn\.n\);\s*bn\.n\+\+;\s*P\.lock\(q\.x, q\.y\); P\.el\.classList\.add\('placed'\);\s*placed\+\+;/, 'a placed card does not count exactly one');
          need('zero', /if \(placed === cards\.length\)\{/, 'the round is solved before every card is placed');
          D.GAME_ZERO.forEach((dd, i) => {
            const w0 = 'GAME_ZERO[' + i + '] d = ' + dd;
            if (!(Number.isInteger(dd) && dd >= 1 && dd <= 9)) return fail('GAME: ' + w0 + ' out of range');
            const cards = D.zeroCards(dd), texts = cards.map(c => D.fmtPad(c.m, c.p));
            if (cards.length !== 5 || new Set(texts).size !== 5) fail('GAME: ' + w0 + ': five different cards expected, got ' + texts.join(' '));
            const big = 100 * dd, small = 10 * dd;
            let nBig = 0, nSmall = 0;
            cards.forEach((c, j) => {
              const p = parseDecRef(texts[j]);
              if (!p || !reprintOk(texts[j]) || milOf(p.dg) !== c.m) fail('GAME: ' + w0 + ': the card "' + texts[j] + '" is not worth ' + natR(c.m));
              if (c.m === big) nBig++; else if (c.m === small) nSmall++; else fail('GAME: ' + w0 + ': the card "' + texts[j] + '" matches neither grid');
              [big, small].forEach(g => {
                const r = D.zeroRule(c.m, g), want = c.m === g ? '' : (c.m > g ? 'big' : 'small');
                if (r !== want) fail('GAME: ' + w0 + ': zeroRule(' + texts[j] + ', grid ' + natR(g) + ') is "' + r + '", should be "' + want + '"');
              });
              LANGS.forEach(L => {
                const t = c.m === big ? I18N[L].gZeroBig(texts[j], dd) : I18N[L].gZeroSmall(texts[j], dd);
                /* 說的位數字要是真的：大的那一種十分位是 d；小的那一種十分位是 0、百分位是 d */
                const dg = p ? p.dg : [0, 0, 0, 0, 0];
                if (c.m === big){ if (dg[2] !== dd) fail('GAME: ' + w0 + ': ' + texts[j] + ' does not have ' + dd + ' tenths'); seq(w0 + ' ' + texts[j] + ' gZeroBig ' + L, t, [texts[j], dd, dd, '0.1', dd, 0, dd]); }
                else { if (dg[2] !== 0 || dg[3] !== dd) fail('GAME: ' + w0 + ': ' + texts[j] + ' is not 0 tenths and ' + dd + ' hundredths'); seq(w0 + ' ' + texts[j] + ' gZeroSmall ' + L, t, (L === 'zh' ? [texts[j], 0, dd, dd, '0.01', dd, 0, dd, dd] : [texts[j], 0, dd, dd, '0.01', dd, 0, dd, dd])); }
              });
            });
            if (nBig !== 3 || nSmall !== 2) fail('GAME: ' + w0 + ': expected three cards worth ' + natR(big) + ' (0s on the end) and two worth ' + natR(small) + ' (a 0 after the point)');
            if (!texts.some(t => /0$/.test(t) && parseDecRef(t) && milOf(parseDecRef(t).dg) === big) || !texts.some(t => /^0\.0/.test(t))) fail('GAME: ' + w0 + ': both kinds of 0 must appear');
            LANGS.forEach(L => {
              const bigT = cards.filter(c => c.m === big).map(c => D.fmtPad(c.m, c.p)), smallT = cards.filter(c => c.m === small).map(c => D.fmtPad(c.m, c.p));
              seq(w0 + ' gZeroDone ' + L, I18N[L].gZeroDone(bigT, smallT, dd), bigT.concat([dd, 0]).concat(smallT).concat([dd, 0]));
              seq(w0 + ' gZero2 ' + L, I18N[L].gZero2(dd), [2, dd, dd, 0, dd]);
            });
          });
          LANGS.forEach(L => { seq('gZeroNow ' + L, I18N[L].gZeroNow(2), [2, 5]); });
        }
      } catch (e){
        /* 一筆壞資料讓這一段丟例外時，要變成一行 FAIL，不可以把前面收集到的問題一起帶走 */
        fail('GAME: the game checks threw: ' + e.message);
      }

      /* ---------- 9. 題庫的神諭 ---------- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const table = BANK_EXPECTED[bank];
        const zh = I18N.zh[bank], en = I18N.en[bank];
        if (!zh || !en){ fail('BANK: ' + bank + ' missing'); return; }
        if (zh.length !== table.length)
          fail('BANK: ' + bank + ' has ' + zh.length + ' questions but the oracle describes ' + table.length + ' — deleting a question must be noticed');
        table.forEach((row, i) => {
          const q = zh[i], e = en[i];
          if (!q || !e){ fail('BANK: ' + bank + '[' + i + '] missing in one language'); return; }
          if (q.ans !== row.ans) fail('BANK: ' + bank + '[' + i + '] zh ans is ' + q.ans + ', the oracle says ' + row.ans);
          if (e.ans !== row.ans) fail('BANK: ' + bank + '[' + i + '] en ans is ' + e.ans + ', the oracle says ' + row.ans);
          [['zh', q], ['en', e]].forEach(pair => {
            const L = pair[0], item = pair[1];
            const stem = String(item.stem).replace(/<[^>]+>/g, '');
            row.nums.forEach(n => {
              /* 邊界比對，不然 0.5 會在 0.55 裡面被認到。
                 ⚠️ replace('.', …) 只換第一個小數點，所以用 split/join。 */
              const re = new RegExp('(^|[^0-9.])' + n.split('.').join('\\.') + '($|[^0-9])');
              if (!re.test(stem)) fail('BANK: ' + bank + '[' + i + '] ' + L + ' stem no longer states ' + n);
            });
            /* 題幹「問的是什麼」—— 只驗數字的話，把「哪一個比較大」改成
               「哪一個比較小」而正解不動，所有數值檢查都還是綠的。 */
            if (!row.ask) fail('BANK: ' + bank + '[' + i + '] has no ask table, so its stem is unguarded');
            else {
              const a2 = row.ask[L] || {};
              (a2.must || []).forEach(w => {
                if (stem.indexOf(w) < 0)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' stem must ask for "' + w + '" but says: ' + stem.slice(0, 70));
              });
              (a2.never || []).forEach(w => {
                if (stem.indexOf(w) >= 0)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' stem must not contain "' + w + '": ' + stem.slice(0, 70));
              });
            }
            /* 選項是整句話的題目（迷思檢查）沒有算術神諭，所以用
               「這句關鍵字只能出現在正解上」把它釘住。 */
            if (row.onlyAnswer){
              const phrase = row.onlyAnswer[L];
              if (!phrase) fail('BANK: ' + bank + '[' + i + '] onlyAnswer has no ' + L + ' phrase');
              else {
                const hits = item.opts.map((o, oi) => String(o).indexOf(phrase) >= 0 ? oi : -1).filter(x => x >= 0);
                if (hits.length !== 1)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' the key phrase "' + phrase + '" identifies ' +
                       hits.length + ' options, expected exactly 1');
                else if (hits[0] !== row.ans)
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' the key phrase "' + phrase + '" is on option ' +
                       hits[0] + ', but the marked answer is ' + row.ans);
              }
            }
          });
          /* 正解從題幹的數字重算一次。 */
          let want = null;
          if (row.add){
            const r = addDigitsRef(parseDecRef(row.add[0]).dg, parseDecRef(row.add[1]).dg);
            if (r.over !== 0) fail('BANK: ' + bank + '[' + i + '] the sum leaves the lesson range');
            want = digitsToStrRef(r.digits, 0);
          } else if (row.sub){
            const r = subDigitsRef(parseDecRef(row.sub[0]).dg, parseDecRef(row.sub[1]).dg);
            if (r.over !== 0) fail('BANK: ' + bank + '[' + i + '] the subtraction goes negative');
            want = digitsToStrRef(r.digits, 0);
          } else if (row.cmp){
            const A = parseDecRef(row.cmp[0]), B = parseDecRef(row.cmp[1]);
            want = cmpDigitsRef(A.dg, B.dg) > 0 ? row.cmp[0] : row.cmp[1];
          } else if (row.maxOf){
            let best = row.maxOf[0];
            row.maxOf.forEach(s => { if (cmpDigitsRef(parseDecRef(s).dg, parseDecRef(best).dg) > 0) best = s; });
            want = best;
          } else if (row.twoStep){
            const step1 = subDigitsRef(parseDecRef(row.twoStep[0]).dg, parseDecRef(row.twoStep[1]).dg);
            if (step1.over !== 0) fail('BANK: ' + bank + '[' + i + '] the first step goes negative');
            const step2 = addDigitsRef(step1.digits, parseDecRef(row.twoStep[2]).dg);
            if (step2.over !== 0) fail('BANK: ' + bank + '[' + i + '] the second step leaves the lesson range');
            want = digitsToStrRef(step2.digits, 0);
          } else if (row.sameAs){
            const p = parseDecRef(row.sameAs);
            want = digitsToStrRef(p.dg, p.shown + 1);
          } else if (row.units){
            /* 「n 個 0.0…1 是多少」：自己組一個只有那一位有值的數。 */
            const u = parseDecRef(row.units[1]);
            const n = Number(row.units[0]);
            let k = 1;
            while (k <= 3 && u.dg[1 + k] !== 1) k++;
            const dg = new Array(DIG_N).fill(0);
            const total = n * Math.pow(10, 3 - k);
            want = digitsToStrRef(milDigitsRef(total), 0);
            if (k > 3) fail('BANK: ' + bank + '[' + i + '] the unit in the oracle is not a single 1 in one place');
          }
          if (want !== null && row.expect && want !== row.expect.zh)
            fail('BANK: ' + bank + '[' + i + '] recomputing from the stem gives "' + want + '" but the oracle expects "' + row.expect.zh + '"');
          if (row.expect){
            if (String(q.opts[row.ans]).trim() !== row.expect.zh)
              fail('BANK: ' + bank + '[' + i + '] zh marked answer is "' + q.opts[row.ans] + '", expected "' + row.expect.zh + '"');
            if (String(e.opts[row.ans]).trim().toLowerCase() !== row.expect.en.toLowerCase())
              fail('BANK: ' + bank + '[' + i + '] en marked answer is "' + e.opts[row.ans] + '", expected "' + row.expect.en + '"');
          }
          /* 每一個純小數選項都要是合法寫法，而且兩兩不同值。 */
          [['zh', q], ['en', e]].forEach(pair => {
            const L = pair[0], item = pair[1];
            const keys = item.opts.map(o => {
              const p = parseDecRef(String(o).trim());
              return p ? ('v' + milOf(p.dg)) : ('s' + String(o).trim());
            });
            for (let x = 0; x < keys.length; x++){
              for (let y = x + 1; y < keys.length; y++){
                if (keys[x] === keys[y])
                  fail('BANK: ' + bank + '[' + i + '] ' + L + ' has two options with the same value: ' + item.opts[x] + ' / ' + item.opts[y]);
              }
            }
            item.opts.forEach(o => {
              const t = String(o).trim();
              if (/^\d/.test(t) && !reprintOk(t))
                fail('BANK: ' + bank + '[' + i + '] ' + L + ' option "' + t + '" is not a well-formed decimal');
            });
            if (!String(item.why).trim()) fail('BANK: ' + bank + '[' + i + '] ' + L + ' has no explanation');
            if (L === 'en'){
              const all = String(item.stem) + ' ' + String(item.why) + ' ' + item.opts.join(' ');
              if (/[一-鿿]/.test(all)) fail('BANK: ' + bank + '[' + i + '] en contains Chinese');
              const bad = all.match(PLURAL_RE) || all.match(THERE_ARE_RE);
              if (bad) fail('BANK: ' + bank + '[' + i + '] en singular/plural is wrong near "' + bad[0] + '"');
            }
          });
        });
      });

      /* ---------- 10. review.html 的產生器清單 ----------
         ⚠️ 跨頁讀檔一律用 process.argv[2]，不可以用 __dirname ——
         breaktest.js 是把四頁複製到暫存目錄再跑的，__dirname 會讀到真的 repo，
         針對 review／reference／parents 的斷言就永遠是綠的。 */
      const dir = path.dirname(path.resolve(process.argv[2] || '.'));
      const SRC = { index: src };
      ['review', 'reference', 'parents'].forEach(name => {
        const f = path.join(dir, name + '.html');
        if (!fs.existsSync(f)){ fail('SETUP: cannot find ' + name + '.html next to the lesson page'); return; }
        SRC[name] = fs.readFileSync(f, 'utf8');
      });

      if (SRC.review){
        const clean = stripComments(SRC.review);
        const found = [];
        const re = /^\s*\{\s*id:'([A-Za-z0-9_]+)'/gm;
        let m;
        while ((m = re.exec(clean))) found.push(m[1]);
        GEN_IDS.forEach(id => {
          if (found.indexOf(id) < 0)
            fail('GEN_IDS: review.html no longer declares the generator "' + id + '", so its whole set of assertions is gone');
        });
        found.forEach(id => {
          if (GEN_IDS.indexOf(id) < 0)
            fail('GEN_IDS: review.html declares an extra generator "' + id + '" that this config does not describe');
        });
        if (found.length !== GEN_IDS.length) fail('GEN_IDS: review.html has ' + found.length + ' generators, expected ' + GEN_IDS.length);
        const makes = (clean.match(/\bmake\s*:\s*function/g) || []).length;
        const fmts = (clean.match(/\bfmt\s*:\s*function/g) || []).length;
        if (makes !== GEN_IDS.length) fail('GEN_IDS: review.html has ' + makes + ' make() functions, expected ' + GEN_IDS.length);
        if (fmts !== GEN_IDS.length) fail('GEN_IDS: review.html has ' + fmts + ' fmt() functions, expected ' + GEN_IDS.length);
        const pickCalls = (clean.match(/\b(pick|pickUnused|rnd|randMil)\s*\(/g) || []).length;
        if (pickCalls < GEN_IDS.length) fail('GEN_IDS: review.html only makes ' + pickCalls + ' sampling calls, so some generator is hard-coded');
      }

      /* ---------- 11. 四頁的措辭（SIBLING_RULES） ---------- */
      SIBLING_RULES.forEach(r => {
        const s = SRC[r.file];
        if (!s){ fail('SIBLING: ' + r.file + '.html is missing'); return; }
        const n = countOf(s, r.text);
        if (n < r.min)
          fail('SIBLING: ' + r.file + '.html says "' + r.text + '" ' + n + ' time(s), expected at least ' + r.min + ' — it ' + r.why);
      });
      /* 四頁都不可以把反過來的說法當成規則寫出來。 */
      ['index', 'reference', 'review', 'parents'].forEach(name => {
        const s = SRC[name];
        if (!s) return;
        const clean = stripComments(s);
        if (clean.indexOf('所以位數多的比較大') >= 0)
          fail('RULE: ' + name + '.html states "所以位數多的比較大" as if it were a rule');
        if (clean.indexOf('對齊最右邊的數字就對了') >= 0)
          fail('RULE: ' + name + '.html tells the child to line the numbers up on the right');
        /* ⚠️ 直式加減是從**最右邊**開始算，不是從整數部分。這一句在總結裡
           把比大小的走法套到加減上（codex 抓到的）。 */
        if (clean.indexOf('再從整數部分開始一位一位對齊處理') >= 0)
          fail('RULE: ' + name + '.html tells the child to do column addition starting from the whole-number part');
        if (clean.indexOf('then work place by place starting from the whole-number part') >= 0)
          fail('RULE: ' + name + '.html (en) tells the child to do column addition starting from the whole-number part');
        /* ⚠️ 進位／退位不一定會落在百分位（1.60 ＋ 2.70 只在十分位進位），
           所以不可以寫成「會發生在百分位」。 */
        if (clean.indexOf('進位與退位會發生在百分位') >= 0 || clean.indexOf('進位與退位現在會發生在百分位') >= 0)
          fail('RULE: ' + name + '.html claims carrying/borrowing WILL happen in the hundredths, which is false for 1.60 + 2.70');
        if (/carrying and borrowing now happen in the hundredths(?! too)/.test(clean))
          fail('RULE: ' + name + '.html (en) claims carrying/borrowing now happen in the hundredths, which is false for 1.60 + 2.70');
      });
    }
  },

  GEN_IDS: GEN_IDS
};
