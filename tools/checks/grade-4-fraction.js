/* grade-4/math/fraction（真分數／假分數／帶分數，以及同分母的加減）的檢查設定。

   範圍取自課程自己說的話（四頁都對讀者講了同一件事）：
   平分與同分母真分數的加減是三年級的「分數大發現」；擴分、約分、通分與異分母的
   加減是五年級的「通分加減」；分數的乘法（含 3 × 2/5 這種整數倍）與除法也是五年級。
   這一課只做同一個分母、只做正的分數，而且**不做約分**。

   這一課有六個守門重點：

   ① **「假分數」的定義要含分子等於分母那一格。**「分子比分母大」是寫太滿 ——
      5/5 也是假分數，而且剛好等於 1。設定檔對 d ＝ 2~8 的**每一個** n 逐格比對
      kindOf，並且把 n ＝ d 這一格單獨再釘一次。

   ② **假分數換帶分數「不一定」得到帶分數。** 整除的時候沒有分數部分，答案是整數。
      toMixed 對整個定義域驗，而且整除那一格要求印出來就是一個整數。

   ③ **選項要比「約到最簡之後的值」，不是比字串。** 這一課最危險的等值陷阱有三種：
      6/4 和 3/2（不同分母同值）、1 又 2/5 和 7/5（兩種寫法同值）、
      2 又 7/5 和 3 又 2/5（沒進位與進位同值）。三種都只能靠有理數比對抓到，
      所以每一個選項都解析回 (分子, 分母) 再兩兩交叉相乘比一次。

   ④ **選項的形狀本身就是斷言。** 解析出來之後**再印回去**，必須逐字相同 ——
      這樣英文帶分數的空白（1 2/5 不是 12/5）、中文「 又 」前後的空格都一起驗到了。
      而且**正解的寫法**要單獨釘一次（正解一定是整理過的寫法，誘答才可以是迷思寫法）。

   ⑤ **長條圖的四個方向都要驗。**（rounding 那一輪的教訓：只驗左右等於沒驗）
      版面常數由課程的資料區匯出，barPlan 跑遍整個定義域，每一條的右緣、下緣、
      每一格的寬度都比一次。

   ⑥ **英文的單複數要有一條全站掃描。** 1 是唯一會出錯的那一個值
      （「1 whole bars」「1 squares」）—— 這一輪它在課程頁抓到 7 處。 */

const fs = require('fs');
const path = require('path');

/* ---- 這一課自己的常數（第二套來源，不從課程讀） ---- */
const DEN_MIN = 2;        // index.html 宣告的分母下界
const DEN_MAX = 8;        // index.html 宣告的分母上界
const MAX_WHOLE = 3;      // index.html 宣告的帶分數整數部分上界
const FIG_MAX_BARS_REF = 4;
/* 版面規格的第二套來源。⚠️ 不可以只拿課程自己的常數互相比對 —— 把 FIG_W、viewBox
   和 CSS 一起改成別的數字，那樣的檢查還是綠的。 */
const FIG_W_REF = 520, FIG_H_REF = 132, FIG_MIN_CELL_REF = 6;

/* ⚠️ 關聯比較遇到 undefined／NaN 一律是 false，所以「少回傳一個欄位」會讓
   下面每一條幾何斷言**靜靜通過**。比較之前先確認它真的是一個有限的數。 */
function num(v){ return typeof v === 'number' && isFinite(v); }
/* 分子、分母、整數部分都是**整數**。只驗 num() 的話，分母 5.5 會整組通過。 */
function int(v){ return num(v) && Math.floor(v) === v; }

/* review.html 的參數池，逐行釘住（產生器有沒有在抽樣，也是要驗的） */
const R_DEN_MIN = 3, R_DEN_MAX = 8, R_WHOLE_MAX = 4;
function range(lo, hi){ const o = []; for (let v = lo; v <= hi; v++) o.push(v); return o; }
const DEN_POOL = range(R_DEN_MIN, R_DEN_MAX);
const WHOLE_POOL = range(1, 3);
const QUOT_POOL = range(2, 3);
const BIGW_POOL = range(2, R_WHOLE_MAX);

const GEN_IDS = ['nameOf', 'pickImproper', 'toMixed', 'toMixedWhole', 'toImproper',
                 'wholeToImproper', 'addProper', 'addMixedCarry', 'addMixedNoCarry',
                 'subMixedBorrow', 'subMixedNoBorrow', 'subToProper'];

/* ---- 三個名字。⚠️ 分子等於分母也是假分數，這一格單獨會被再釘一次。 ---- */
function kindRef(n, d){ return (n < d) ? 'proper' : 'improper'; }
function toMixedRef(n, d){ return { w:Math.floor(n / d), n:n % d, d:d }; }
function toImproperRef(w, n, d){ return w * d + n; }

/* ---- 有理數：一律約到最簡再比，6/4 和 3/2 必須算成同一個值 ---- */
function gcdRef(a, b){ return b ? gcdRef(b, a % b) : a; }
function ratKey(num, den){
  if (!den) return null;
  const k = gcdRef(Math.abs(num) || 1, Math.abs(den)) || 1;
  return (num / k) + '/' + (den / k);
}
/* a/b 和 c/e 比大小，交叉相乘（分母都是正的） */
function ratCmp(a, b, c, e){ return a * e - c * b; }

/* ---- 兩種語言的寫法。這是**第二套**格式化實作，不呼叫課程的任何函式。 ---- */
const KIND_WORDS = {
  zh:{ proper:'真分數', improper:'假分數', mixed:'帶分數', whole:'整數' },
  en:{ proper:'a proper fraction', improper:'an improper fraction',
       mixed:'a mixed number', whole:'a whole number' }
};
function fracRef(lang, n, d){ return n + '/' + d; }
function mixedRef(lang, w, n, d){
  if (w > 0 && n > 0) return w + (lang === 'zh' ? ' 又 ' : ' ') + n + '/' + d;
  if (w > 0) return String(w);
  if (n > 0) return n + '/' + d;
  return '0';
}

/* ---- 選項的解析與「印回去」 ----
   parseOpt 回傳**印出來的形狀**（whole／frac／mixed／name），
   reprint 必須把它逐字印回同一個字串 —— 一條抵掉英文帶分數的空白、
   中文「 又 」前後的空格、多餘空白三種寫法錯誤。 */
function parseOpt(s, lang){
  const t = String(s);
  for (const key of ['proper', 'improper', 'mixed', 'whole']){
    if (t === KIND_WORDS[lang][key]) return { kind:'name', key:key };
  }
  const mixRe = (lang === 'zh') ? /^(\d+) 又 (\d+)\/(\d+)$/ : /^(\d+) (\d+)\/(\d+)$/;
  let m = mixRe.exec(t);
  if (m) return { kind:'mixed', w:+m[1], n:+m[2], d:+m[3] };
  m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) return { kind:'frac', w:0, n:+m[1], d:+m[2] };
  m = /^(\d+)$/.exec(t);
  if (m) return { kind:'whole', w:+m[1], n:0, d:null };
  return null;
}
function reprint(p, lang){
  if (p.kind === 'name') return KIND_WORDS[lang][p.key];
  if (p.kind === 'whole') return String(p.w);
  if (p.kind === 'frac') return fracRef(lang, p.n, p.d);
  return p.w + (lang === 'zh' ? ' 又 ' : ' ') + p.n + '/' + p.d;
}
/* 選項的值：回傳 [分子, 分母]，name 沒有值。 */
function optValue(p){
  if (!p || p.kind === 'name') return null;
  if (p.kind === 'whole') return [p.w, 1];
  if (!p.d) return null;
  return [p.w * p.d + p.n, p.d];
}

/* ---- 每一支產生器的選項形狀與範圍 ----
   correct 是**正解一定要長成的樣子**（整理過的寫法）；allowed 是誘答可以出現的形狀
   （刻意的迷思寫法，例如「4 又 9/7」分數部分不是真分數，那是這一課在教的錯誤）。
   範圍從 review.html 自己宣告的池推出來，不是隨手給一個大數。 */
const OPT_SHAPE = {
  nameOf:          { correct:['name'],            allowed:['name'],                   lo:null, hi:null },
  pickImproper:    { correct:['frac'],            allowed:['frac'],                   lo:[1, R_DEN_MAX], hi:[2, 1] },
  toMixed:         { correct:['mixed'],           allowed:['mixed', 'whole', 'frac'], lo:[1, R_DEN_MAX], hi:[8, 1] },
  toMixedWhole:    { correct:['whole'],           allowed:['mixed', 'whole', 'frac'], lo:[1, R_DEN_MAX], hi:[4, 1] },
  toImproper:      { correct:['frac'],            allowed:['frac'],                   lo:[1, R_DEN_MAX], hi:[13, 1] },
  wholeToImproper: { correct:['frac'],            allowed:['frac'],                   lo:[1, R_DEN_MAX], hi:[5, 1] },
  addProper:       { correct:['mixed', 'whole'],  allowed:['mixed', 'whole', 'frac'], lo:[1, 2 * R_DEN_MAX], hi:[3, 1] },
  addMixedCarry:   { correct:['mixed', 'whole'],  allowed:['mixed', 'whole', 'frac'], lo:[1, 2 * R_DEN_MAX], hi:[10, 1] },
  addMixedNoCarry: { correct:['mixed'],           allowed:['mixed', 'whole', 'frac'], lo:[1, 2 * R_DEN_MAX], hi:[9, 1] },
  subMixedBorrow:  { correct:['mixed'],           allowed:['mixed', 'whole', 'frac'], lo:[1, R_DEN_MAX], hi:[9, 1] },
  subMixedNoBorrow:{ correct:['mixed'],           allowed:['mixed', 'whole', 'frac'], lo:[1, 2 * R_DEN_MAX], hi:[9, 1] },
  subToProper:     { correct:['frac'],            allowed:['mixed', 'whole', 'frac'], lo:[1, R_DEN_MAX], hi:[9, 1] }
};

/* ---- 題幹「問的是什麼」。只驗數字的話，把 toMixed 的題幹改成問假分數、
        正解卻還是帶分數，所有數字檢查都還是綠的。 ----
   ⚠️ 英文的 'improper fraction' 裡面含有 'proper fraction'，所以
   「不可以出現的字」不能挑會被包住的字串。 */
const ASK = {
  nameOf:          { zh:['這樣寫的分數，叫做什麼'], zhNot:['換成'],
                     en:['called'],                  enNot:['as a mixed number', 'how much'] },
  pickImproper:    { zh:['哪一個是假分數'],         zhNot:['帶分數'],
                     en:['Which one of these'],      enNot:['mixed number', 'how much'] },
  toMixed:         { zh:['換成帶分數'],             zhNot:['換成假分數'],
                     en:['as a mixed number'],       enNot:['as an improper fraction'] },
  toMixedWhole:    { zh:['換出來是多少', '除得剛剛好就寫整數'], zhNot:['換成帶分數是多少'],
                     en:['come out as', 'divides exactly'],     enNot:['as an improper fraction'] },
  toImproper:      { zh:['換成假分數'],             zhNot:['換成帶分數'],
                     en:['as an improper fraction'], enNot:['as a mixed number'] },
  wholeToImproper: { zh:['要寫成分母是', '的假分數'], zhNot:['換成帶分數'],
                     en:['with denominator'],        enNot:['as a mixed number'] },
  addProper:       { zh:['＋', '是多少'],           zhNot:['－'],
                     en:['+', 'is how much'],        enNot:['−'] },
  addMixedCarry:   { zh:['＋', '是多少'],           zhNot:['－'],
                     en:['+', 'is how much'],        enNot:['−'] },
  addMixedNoCarry: { zh:['＋', '是多少'],           zhNot:['－'],
                     en:['+', 'is how much'],        enNot:['−'] },
  subMixedBorrow:  { zh:['－', '是多少'],           zhNot:['＋'],
                     en:['−', 'is how much'],        enNot:['+'] },
  subMixedNoBorrow:{ zh:['－', '是多少'],           zhNot:['＋'],
                     en:['−', 'is how much'],        enNot:['+'] },
  subToProper:     { zh:['－', '是多少'],           zhNot:['＋'],
                     en:['−', 'is how much'],        enNot:['+'] }
};

/* 負號要**緊貼數字**才算負號，不然「3 － 1」這個減法算式會被誤判成負數。 */
const NEG = /(^|[^0-9])[-−]\d/;

function stripTags(html){
  return String(html)
    .replace(/<(br|p|div|li|tr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
/* 英文只有 1 會錯。掃每一個渲染出來的字串（題幹、解釋、選項）。 */
const EN_NOUNS = ['whole bar', 'square', 'bar', 'time', 'cup', 'scoop', 'piece', 'apple'];
function pluralProblem(txt, lang){
  if (lang !== 'en') return null;
  for (const w of EN_NOUNS){
    if (new RegExp('\\b1 ' + w + 's\\b').test(txt))
      return 'prints "1 ' + w + 's" — only the value 1 gets the plural wrong';
    /* 名詞改對了、動詞沒跟上一樣是錯的：「1 square are left over」。 */
    if (new RegExp('\\b1 ' + w + ' are\\b').test(txt))
      return 'prints "1 ' + w + ' are" — the verb has to agree with the value too';
    if (new RegExp('\\b(?!1 )\\d+ ' + w + 's is\\b').test(txt))
      return 'prints a plural "' + w + 's is" — the verb has to agree with the value too';
  }
  return null;
}
function numTokens(text){
  return (String(text).match(/\d+/g) || []).map(Number);
}
function printsNum(text, v){ return numTokens(text).indexOf(Number(v)) >= 0; }

/* ---- 相加／相減的第二套實作（完全不呼叫課程的 addSteps／subSteps） ---- */
function addRef(a, b){ return toMixedRef(toImproperRef(a.w, a.n, a.d) + toImproperRef(b.w, b.n, b.d), a.d); }
function subRef(a, b){ return toMixedRef(toImproperRef(a.w, a.n, a.d) - toImproperRef(b.w, b.n, b.d), a.d); }

module.exports = {
  breaks: [
    { file:'index', expect:'has a part that is not a whole number', via:'index',
      find:'    { a:{ w:1, n:2, d:5 }, b:{ w:2, n:1, d:5 } },   // 3 又 3/5（不用進位）',
      replace:'    { a:{ w:1, n:2, d:5.5 }, b:{ w:2, n:1, d:5.5 } },   // 3 又 3/5（不用進位）' },
    { file:'index', expect:'but it is a proper fraction', via:'index',
      find:"    { kind:'toMixed', n:17, d:6,",
      replace:"    { kind:'toMixed', n:1, d:6," },
    /* ---------- index.html：三個名字與兩個方向的變身 ---------- */
    /* ---------- 守門員自己的洞：NaN 會讓每一條關聯比較靜靜通過 ---------- */
    { file:'index', expect:'has no numeric labelX', via:'index',
      find:'                 labelX:barX(i) + FIG_BAR_W / 2,',
      replace:'                 labelXX:barX(i) + FIG_BAR_W / 2,' },
    { file:'index', expect:'figSumPoint() does not return numbers', via:'index',
      find:'    return { x:FIG_W / 2, y:FIG_Y + FIG_BAR_H + FIG_SUM_DY };',
      replace:'    return {};' },
    /* ---------- 每一個欄位都要從常數重算，不是拿 barPlan 自己回報的值互比 ---------- */
    { file:'index', expect:'wide, independently', via:'index',
      find:'      out.push({ i:i, x:barX(i), y:FIG_Y, w:FIG_BAR_W, h:FIG_BAR_H,',
      replace:'      out.push({ i:i, x:barX(i), y:FIG_Y, w:FIG_BAR_W - 2, h:FIG_BAR_H,' },
    { file:'index', expect:'sits at y=', via:'index',
      find:'      out.push({ i:i, x:barX(i), y:FIG_Y, w:FIG_BAR_W, h:FIG_BAR_H,\n                 d:d, fill:fill, full:(fill === d),',
      replace:'      out.push({ i:i, x:barX(i), y:FIG_Y + 1, w:FIG_BAR_W, h:FIG_BAR_H,\n                 d:d, fill:fill, full:(fill === d),' },
    { file:'index', expect:'the smallest readable cell', via:'index',
      find:'  var FIG_MIN_CELL = 6;',
      replace:'  var FIG_MIN_CELL = 3;' },
    { file:'index', expect:'the svg viewBox width is 540', via:'index',
      find:'<svg class="barfig" id="s1fig" viewBox="0 0 520 132"',
      replace:'<svg class="barfig" id="s1fig" viewBox="0 0 540 132"' },
    /* ---------- 遊戲關卡與範例資料的定義域 ---------- */
    { file:'index', expect:'outside this lesson\'s 2~8', via:'index',
      find:"    { kind:'toMixed', n:17, d:6,",
      replace:"    { kind:'toMixed', n:17, d:9," },
    { file:'index', expect:'this lesson only adds and subtracts with one denominator', via:'index',
      find:"    { kind:'add', a:{ w:1, n:4, d:7 }, b:{ w:2, n:5, d:7 },",
      replace:"    { kind:'add', a:{ w:1, n:4, d:7 }, b:{ w:2, n:5, d:6 }," },
    { file:'index', expect:'ADD_CASES[2] has denominator 9', via:'index',
      find:'    { a:{ w:0, n:3, d:4 }, b:{ w:0, n:3, d:4 } },   // 6/4 → 1 又 2/4',
      replace:'    { a:{ w:0, n:3, d:9 }, b:{ w:0, n:3, d:9 } },   // 6/4 → 1 又 2/4' },
    { file:'index', expect:'SUB_CASES[3] has whole part 20', via:'index',
      find:'    { a:{ w:4, n:3, d:8 }, b:{ w:2, n:3, d:8 } }    // 分子剛好減完 → 2',
      replace:'    { a:{ w:20, n:3, d:8 }, b:{ w:2, n:3, d:8 } }    // 分子剛好減完 → 2' },
    /* ---------- 題庫神諭：順序與英文題幹 ---------- */
    { file:'index', expect:'the numbers the stem prints, in order', via:'index',
      find:"        { stem:'3 又 1/5 － 1 又 3/5 ＝ ?', opts:['1 又 3/5','2 又 2/5','1 又 2/5','2 又 3/5'], ans:0,",
      replace:"        { stem:'1 又 3/5 － 3 又 1/5 ＝ ?', opts:['1 又 3/5','2 又 2/5','1 又 2/5','2 又 3/5'], ans:0," },
    { file:'index', expect:'en stem prints the numbers', via:'index',
      find:"        { stem:'What is 17/5 as a mixed number?',",
      replace:"        { stem:'What is 18/5 as a mixed number?'," },
    /* ---------- 「有沒有在抽樣」不可以被註解騙過 ---------- */
    { file:'review', expect:'must actually sample its parameters', via:'index',
      find:'          d = pickUnused(DEN_POOL, used);\n          w = pick(BIGW_POOL);',
      replace:'          d = 5; w = 4; /* pick(DEN_POOL) pickUnused(BIGW_POOL) */' },
    /* ---------- 選項的分母只能是這一題自己的分母 ---------- */
    { file:'review', expect:'but this question is about',
      find:'          fracOpt(s, 2 * d),                     // 分母也加起來',
      replace:'          fracOpt(s, d + 1),                     // 分母也加起來' },
    { file:'index', expect:'equal numerator and denominator is improper', via:'index',
      find:'  function isProper(n, d){ return n < d; }',
      replace:'  function isProper(n, d){ return n <= d; }' },
    { file:'index', expect:'kindOf', via:'index',
      find:"  function kindOf(n, d){ return isProper(n, d) ? 'proper' : 'improper'; }",
      replace:"  function kindOf(n, d){ return isProper(n, d) ? 'improper' : 'proper'; }" },
    { file:'index', expect:'the quotient counts the whole bars', via:'index',
      find:'    return { w:Math.floor(n / d), n:n % d, d:d };',
      replace:'    return { w:n % d, n:Math.floor(n / d), d:d };' },
    { file:'index', expect:'toMixed', via:'index',
      find:'  function toMixed(n, d){\n    return { w:Math.floor(n / d), n:n % d, d:d };',
      replace:'  function toMixed(n, d){\n    return { w:Math.floor(n / d), n:(n % d) + 1, d:d };' },
    { file:'index', expect:'whole number x denominator + numerator', via:'index',
      find:'  function toImproper(w, n, d){ return w * d + n; }',
      replace:'  function toImproper(w, n, d){ return w * n + d; }' },
    { file:'index', expect:'valueOf', via:'index',
      find:'  function valueOf(w, n, d){ return w * d + n; }',
      replace:'  function valueOf(w, n, d){ return w * d - n; }' },
    /* 相加：進位條件與扣掉一個分母 */
    { file:'index', expect:'it carries once the numerator reaches the denominator', via:'index',
      find:'    var carry = (nRaw >= d) ? 1 : 0;',
      replace:'    var carry = (nRaw > d) ? 1 : 0;' },
    { file:'index', expect:'addSteps', via:'index',
      find:'             w:wRaw + carry, n:nRaw - carry * d };',
      replace:'             w:wRaw + carry, n:nRaw - carry * (d - 1) };' },
    { file:'index', expect:'addSteps does not conserve the total', via:'index',
      find:'    return { d:d, wRaw:wRaw, nRaw:nRaw, carry:carry,\n             w:wRaw + carry, n:nRaw - carry * d };',
      replace:'    return { d:d, wRaw:wRaw, nRaw:nRaw, carry:carry,\n             w:wRaw, n:nRaw - carry * d };' },
    /* 相減：借位條件、借過來的 1 要換成 d/d、上一級要扣掉 */
    { file:'index', expect:'it borrows exactly when the numerator is too small', via:'index',
      find:'    var need = (a.n < b.n);',
      replace:'    var need = (a.n <= b.n);' },
    { file:'index', expect:'the borrowed 1 turns into d/d', via:'index',
      find:'    var nTop = need ? a.n + d : a.n;',
      replace:'    var nTop = need ? a.n + 10 : a.n;' },
    { file:'index', expect:'the whole number loses the 1 it lent', via:'index',
      find:'    var wTop = need ? a.w - 1 : a.w;',
      replace:'    var wTop = a.w;' },
    { file:'index', expect:'subSteps', via:'index',
      find:'             w:wTop - b.w, n:nTop - b.n };',
      replace:'             w:wTop - b.w, n:nTop + b.n };' },

    /* ---------- index.html：長條圖 ---------- */
    { file:'index', expect:'past the right edge', via:'index',
      find:'  var FIG_BAR_W = 110;        // 一整條（也就是 1）的寬',
      replace:'  var FIG_BAR_W = 150;        // 一整條（也就是 1）的寬' },
    { file:'index', expect:'past the bottom edge', via:'index',
      find:'  var FIG_BAR_H = 46;         // 長條的高',
      replace:'  var FIG_BAR_H = 110;        // 長條的高' },
    { file:'index', expect:'past the top edge', via:'index',
      find:'  var FIG_Y = 30;             // 長條的上緣',
      replace:'  var FIG_Y = -4;             // 長條的上緣' },
    { file:'index', expect:'off the left edge', via:'index',
      find:'  var FIG_X0 = 20;            // 第一條的左緣',
      replace:'  var FIG_X0 = -6;            // 第一條的左緣' },
    { file:'index', expect:'the summary line', via:'index',
      find:'  var FIG_SUM_DY = 44;        // 最底下那一行總結的基線',
      replace:'  var FIG_SUM_DY = 60;        // 最底下那一行總結的基線' },
    { file:'index', expect:'the per-bar label', via:'index',
      find:'  var FIG_LABEL_DY = 20;      // 每一條下面那個標籤的基線',
      replace:'  var FIG_LABEL_DY = 56;      // 每一條下面那個標籤的基線' },
    { file:'index', expect:'the canvas is 560 wide, independently 520', via:'index',
      find:'  var FIG_W = 520, FIG_H = 132;',
      replace:'  var FIG_W = 560, FIG_H = 132;' },
    { file:'index', expect:'the CSS height', via:'index',
      find:'  .barfig{width:100%;max-width:520px;height:132px;display:block;margin:0 auto}',
      replace:'  .barfig{width:100%;max-width:520px;height:150px;display:block;margin:0 auto}' },
    { file:'index', expect:'the bars overlap', via:'index',
      find:'  function barX(i){ return FIG_X0 + i * (FIG_BAR_W + FIG_GAP); }',
      replace:'  function barX(i){ return FIG_X0 + i * (FIG_BAR_W - FIG_GAP); }' },
    { file:'index', expect:'cell width', via:'index',
      find:'  function cellW(d){ return FIG_BAR_W / d; }',
      replace:'  function cellW(d){ return FIG_BAR_W / (d * 3); }' },
    { file:'index', expect:'the shaded squares add up to the numerator', via:'index',
      find:'      var fill = Math.min(d, left);',
      replace:'      var fill = Math.min(d, Math.max(0, left - 1));' },
    { file:'index', expect:'that is the number of bars', via:'index',
      find:'    var bars = Math.max(1, Math.ceil(n / d));',
      replace:'    var bars = Math.max(1, Math.floor(n / d));' },
    { file:'index', expect:'a bar is full exactly when every square is shaded', via:'index',
      find:'                 d:d, fill:fill, full:(fill === d),',
      replace:'                 d:d, fill:fill, full:(fill >= d - 1),' },
    { file:'index', expect:'not centred on its bar', via:'index',
      find:'                 labelX:barX(i) + FIG_BAR_W / 2,',
      replace:'                 labelX:barX(i) + FIG_BAR_W / 3,' },
    { file:'index', expect:'the summary line is centred', via:'index',
      find:'    return { x:FIG_W / 2, y:FIG_Y + FIG_BAR_H + FIG_SUM_DY };',
      replace:'    return { x:FIG_W / 3, y:FIG_Y + FIG_BAR_H + FIG_SUM_DY };' },
    { file:'index', expect:'draws 3 bar figures', via:'index',
      find:'      <div class="figwrap">\n        <svg class="barfig" id="s3fig" viewBox="0 0 520 132" xmlns="http://www.w3.org/2000/svg"></svg>\n      </div>\n',
      replace:'' },

    /* ---------- index.html：五組範例資料 ---------- */
    { file:'index', expect:'s1cmp uses the same wording for two different comparisons', via:'index',
      find:"      s1cmp:{ proper:'比較小', equal:'一樣大', bigger:'比較大' },",
      replace:"      s1cmp:{ proper:'比較小', equal:'比較大', bigger:'比較大' }," },
    { file:'index', expect:'the Chinese narration must not put a space', via:'index',
      find:"      s1cmp:{ proper:'比較小', equal:'一樣大', bigger:'比較大' },\n      narrJoin:'',",
      replace:"      s1cmp:{ proper:'比較小', equal:'一樣大', bigger:'比較大' },\n      narrJoin:' '," },
    { file:'index', expect:'no fraction whose numerator equals its denominator', via:'index',
      find:'    { n:5,  d:5 },   // 假分數，剛好等於 1',
      replace:'    { n:6,  d:5 },   // 假分數，剛好等於 1' },
    { file:'index', expect:'no improper fraction that divides exactly', via:'index',
      find:'    { n:6,  d:3 },   // 假分數，整除 → 2（沒有分數部分）',
      replace:'    { n:7,  d:3 },   // 假分數，整除 → 2（沒有分數部分）' },
    { file:'index', expect:'NAME_CASES has', via:'index',
      find:'    { n:2,  d:7 }    // 真分數',
      replace:'    { n:2,  d:7 },   // 真分數\n    { n:2,  d:9 }    // 真分數' },
    { file:'index', expect:'TOMIX_CASES needs one that divides exactly', via:'index',
      find:'    { n:9,  d:3 },   // 3 餘 0 → 3（整除，沒有分數部分）',
      replace:'    { n:10, d:3 },   // 3 餘 0 → 3（整除，沒有分數部分）' },
    { file:'index', expect:'is not an improper fraction', via:'index',
      find:'    { n:7,  d:5 },   // 7 ÷ 5 ＝ 1 餘 2 → 1 又 2/5',
      replace:'    { n:4,  d:5 },   // 7 ÷ 5 ＝ 1 餘 2 → 1 又 2/5' },
    { file:'index', expect:'the fraction part of a mixed number must be proper', via:'index',
      find:'    { w:1, n:2, d:5 },   // 1 × 5 ＋ 2 ＝ 7 → 7/5',
      replace:'    { w:1, n:7, d:5 },   // 1 × 5 ＋ 2 ＝ 7 → 7/5' },
    { file:'index', expect:'TOIMP_CASES[3] has whole part 0', via:'index',
      find:'    { w:2, n:5, d:8 }    // 21/8',
      replace:'    { w:0, n:5, d:8 }    // 21/8' },
    { file:'index', expect:'ADD_CASES needs one that does not carry', via:'index',
      find:'    { a:{ w:1, n:2, d:5 }, b:{ w:2, n:1, d:5 } },   // 3 又 3/5（不用進位）',
      replace:'    { a:{ w:1, n:4, d:5 }, b:{ w:2, n:4, d:5 } },   // 3 又 3/5（不用進位）' },
    /* 「至少一筆會進位」只有在**每一筆**都不進位時才失敗，而「分子剛好湊滿一整條」
       那一筆按定義就會進位 —— 所以這一筆改壞要一次改掉後面三筆。 */
    { file:'index', expect:'ADD_CASES needs one that carries', via:'index',
      find:'    { a:{ w:1, n:3, d:5 }, b:{ w:1, n:4, d:5 } },   // 7/5 → 進 1 → 3 又 2/5\n    { a:{ w:0, n:3, d:4 }, b:{ w:0, n:3, d:4 } },   // 6/4 → 1 又 2/4\n    { a:{ w:2, n:5, d:6 }, b:{ w:1, n:1, d:6 } }    // 6/6 剛好一整條 → 4',
      replace:'    { a:{ w:1, n:1, d:5 }, b:{ w:1, n:2, d:5 } },   // 7/5 → 進 1 → 3 又 2/5\n    { a:{ w:0, n:1, d:4 }, b:{ w:0, n:2, d:4 } },   // 6/4 → 1 又 2/4\n    { a:{ w:2, n:2, d:6 }, b:{ w:1, n:1, d:6 } }    // 6/6 剛好一整條 → 4' },
    { file:'index', expect:'ADD_CASES needs one whose numerators fill exactly one whole', via:'index',
      find:'    { a:{ w:2, n:5, d:6 }, b:{ w:1, n:1, d:6 } }    // 6/6 剛好一整條 → 4',
      replace:'    { a:{ w:2, n:5, d:6 }, b:{ w:1, n:2, d:6 } }    // 6/6 剛好一整條 → 4' },
    { file:'index', expect:'ADD_CASES needs one with no whole-number part', via:'index',
      find:'    { a:{ w:0, n:3, d:4 }, b:{ w:0, n:3, d:4 } },   // 6/4 → 1 又 2/4',
      replace:'    { a:{ w:1, n:3, d:4 }, b:{ w:1, n:3, d:4 } },   // 6/4 → 1 又 2/4' },
    /* 這兩條同樣只有在**每一筆**都同一邊時才失敗，所以改壞整個陣列。 */
    { file:'index', expect:'SUB_CASES needs one that does not borrow', via:'index',
      find:'    { a:{ w:3, n:4, d:5 }, b:{ w:1, n:2, d:5 } },   // 2 又 2/5（不用借）\n    { a:{ w:3, n:1, d:5 }, b:{ w:1, n:3, d:5 } },   // 借 1 → 1 又 3/5\n    { a:{ w:2, n:1, d:6 }, b:{ w:1, n:5, d:6 } },   // 借 1，整數變 0 → 2/6\n    { a:{ w:4, n:3, d:8 }, b:{ w:2, n:3, d:8 } }    // 分子剛好減完 → 2',
      replace:'    { a:{ w:3, n:1, d:5 }, b:{ w:1, n:2, d:5 } },   // 2 又 2/5（不用借）\n    { a:{ w:3, n:1, d:5 }, b:{ w:1, n:3, d:5 } },   // 借 1 → 1 又 3/5\n    { a:{ w:2, n:1, d:6 }, b:{ w:1, n:5, d:6 } },   // 借 1，整數變 0 → 2/6\n    { a:{ w:4, n:2, d:8 }, b:{ w:2, n:3, d:8 } }    // 分子剛好減完 → 2' },
    { file:'index', expect:'SUB_CASES needs one that borrows', via:'index',
      find:'    { a:{ w:3, n:4, d:5 }, b:{ w:1, n:2, d:5 } },   // 2 又 2/5（不用借）\n    { a:{ w:3, n:1, d:5 }, b:{ w:1, n:3, d:5 } },   // 借 1 → 1 又 3/5\n    { a:{ w:2, n:1, d:6 }, b:{ w:1, n:5, d:6 } },   // 借 1，整數變 0 → 2/6\n    { a:{ w:4, n:3, d:8 }, b:{ w:2, n:3, d:8 } }    // 分子剛好減完 → 2',
      replace:'    { a:{ w:3, n:4, d:5 }, b:{ w:1, n:2, d:5 } },   // 2 又 2/5（不用借）\n    { a:{ w:3, n:4, d:5 }, b:{ w:1, n:3, d:5 } },   // 借 1 → 1 又 3/5\n    { a:{ w:2, n:5, d:6 }, b:{ w:1, n:1, d:6 } },   // 借 1，整數變 0 → 2/6\n    { a:{ w:4, n:3, d:8 }, b:{ w:2, n:3, d:8 } }    // 分子剛好減完 → 2' },
    { file:'index', expect:'SUB_CASES needs one whose whole-number part becomes 0', via:'index',
      find:'    { a:{ w:2, n:1, d:6 }, b:{ w:1, n:5, d:6 } },   // 借 1，整數變 0 → 2/6',
      replace:'    { a:{ w:3, n:1, d:6 }, b:{ w:1, n:5, d:6 } },   // 借 1，整數變 0 → 2/6' },
    { file:'index', expect:'SUB_CASES needs one whose numerators cancel', via:'index',
      find:'    { a:{ w:4, n:3, d:8 }, b:{ w:2, n:3, d:8 } }    // 分子剛好減完 → 2',
      replace:'    { a:{ w:4, n:5, d:8 }, b:{ w:2, n:3, d:8 } }    // 分子剛好減完 → 2' },
    { file:'index', expect:'both addends share one denominator', via:'index',
      find:'    { a:{ w:1, n:2, d:5 }, b:{ w:2, n:1, d:5 } },',
      replace:'    { a:{ w:1, n:2, d:5 }, b:{ w:2, n:1, d:6 } },' },

    /* ---------- index.html：遊戲的五關 ---------- */
    { file:'index', expect:'round 1', via:'index',
      find:"      opts:['proper', 'improper', 'mixed', 'whole'], ans:1 },",
      replace:"      opts:['proper', 'improper', 'mixed', 'whole'], ans:0 }," },
    { file:'index', expect:'round 2', via:'index',
      find:'      opts:[{ w:5, n:2 }, { w:2, n:5 }, { w:3, n:5 }, { w:2, n:17 }], ans:1 },',
      replace:'      opts:[{ w:5, n:2 }, { w:2, n:5 }, { w:3, n:5 }, { w:2, n:17 }], ans:2 },' },
    { file:'index', expect:'round 3', via:'index',
      find:'      opts:[{ n:17 }, { n:11 }, { n:6 }, { n:32 }], ans:0 },',
      replace:'      opts:[{ n:17 }, { n:11 }, { n:6 }, { n:32 }], ans:3 },' },
    { file:'index', expect:'round 4', via:'index',
      find:'      opts:[{ w:3, n:2, d:7 }, { w:4, n:9, d:7 }, { w:3, n:9, d:14 }, { w:4, n:2, d:7 }], ans:3 },',
      replace:'      opts:[{ w:3, n:2, d:7 }, { w:4, n:9, d:7 }, { w:3, n:9, d:14 }, { w:4, n:2, d:7 }], ans:0 },' },
    { file:'index', expect:'round 5', via:'index',
      find:'      opts:[{ w:2, n:5, d:8 }, { w:1, n:3, d:8 }, { w:1, n:5, d:8 }, { w:2, n:3, d:8 }], ans:1 }',
      replace:'      opts:[{ w:2, n:5, d:8 }, { w:1, n:3, d:8 }, { w:1, n:5, d:8 }, { w:2, n:3, d:8 }], ans:0 }' },
    { file:'index', expect:'two options of the same value', via:'index',
      find:'      opts:[{ w:2, n:5, d:8 }, { w:1, n:3, d:8 }, { w:1, n:5, d:8 }, { w:2, n:3, d:8 }], ans:1 }',
      replace:'      opts:[{ w:0, n:11, d:8 }, { w:1, n:3, d:8 }, { w:1, n:5, d:8 }, { w:2, n:3, d:8 }], ans:1 }' },
    { file:'index', expect:'round 3 answer is', via:'index',
      find:"    if (r.kind === 'toImproper') return { n:toImproper(r.w, r.n, r.d), d:r.d };\n    if (r.kind === 'add') return addSteps(r.a, r.b);",
      replace:"    if (r.kind === 'toImproper') return { n:toImproper(r.w, r.n, r.d) + 1, d:r.d };\n    if (r.kind === 'add') return addSteps(r.a, r.b);" },
    { file:'index', expect:'the picture shows the first number of the question', via:'index',
      find:"    if (r.kind === 'toMixed') return { n:r.n, d:r.d };",
      replace:"    if (r.kind === 'toMixed') return { n:r.n + 1, d:r.d };" },
    { file:'index', expect:'the picture shows the first number of the question', via:'index',
      find:'    return { n:valueOf(r.a.w, r.a.n, r.a.d), d:r.a.d };',
      replace:'    return { n:valueOf(r.b.w, r.b.n, r.b.d), d:r.b.d };' },

    /* ---------- index.html：三層題庫 ---------- */
    { file:'index', expect:'qs[1] zh answer', via:'index',
      find:"        { stem:'5/5 這樣寫的分數，叫做什麼？', opts:['帶分數','真分數','假分數','不是分數'], ans:2,",
      replace:"        { stem:'5/5 這樣寫的分數，叫做什麼？', opts:['帶分數','真分數','假分數','不是分數'], ans:1," },
    { file:'index', expect:'qs[2] zh answer', via:'index',
      find:"        { stem:'17/5 換成帶分數是多少？', opts:['2 又 3/5','3 又 2/5','3 又 17/5','3'], ans:1,",
      replace:"        { stem:'17/5 換成帶分數是多少？', opts:['2 又 3/5','3 又 2/5','3 又 17/5','3'], ans:0," },
    { file:'index', expect:'qs[3] zh answer', via:'index',
      find:"        { stem:'2 又 3/4 換成假分數是多少？', opts:['5/4','6/4','11/4','23/4'], ans:2,",
      replace:"        { stem:'2 又 3/4 換成假分數是多少？', opts:['5/4','6/4','11/4','23/4'], ans:3," },
    { file:'index', expect:'qs[4] zh answer', via:'index',
      find:"        { stem:'1 又 2/7 ＋ 2 又 3/7 ＝ ?', opts:['3 又 5/7','3 又 5/14','2 又 5/7','3 又 6/7'], ans:0,",
      replace:"        { stem:'1 又 2/7 ＋ 2 又 3/7 ＝ ?', opts:['3 又 5/7','3 又 5/14','2 又 5/7','3 又 6/7'], ans:3," },
    { file:'index', expect:'qs[5] zh answer', via:'index',
      find:"        { stem:'3 又 1/5 － 1 又 3/5 ＝ ?', opts:['1 又 3/5','2 又 2/5','1 又 2/5','2 又 3/5'], ans:0,",
      replace:"        { stem:'3 又 1/5 － 1 又 3/5 ＝ ?', opts:['1 又 3/5','2 又 2/5','1 又 2/5','2 又 3/5'], ans:1," },
    { file:'index', expect:'the numbers the stem prints', via:'index',
      find:"        { stem:'17/5 換成帶分數是多少？',",
      replace:"        { stem:'18/5 換成帶分數是多少？'," },
    { file:'index', expect:'qsAdv[2] zh answer', via:'index',
      find:"          opts:['3 又 4/6 公升','2 又 4/6 公升','2 又 2/6 公升','3 又 2/6 公升'], ans:2,",
      replace:"          opts:['3 又 4/6 公升','2 又 4/6 公升','2 又 2/6 公升','3 又 2/6 公升'], ans:1," },
    { file:'index', expect:'qsAdv[3] zh answer', via:'index',
      find:"          opts:['2 又 4/8 個','4 個','3 個','3 又 1/8 個'], ans:2,",
      replace:"          opts:['2 又 4/8 個','4 個','3 個','3 又 1/8 個'], ans:1," },
    { file:'index', expect:'qsBoost[1] zh answer', via:'index',
      find:"2 又 3/5 換成假分數應該是多少？',\n          opts:['6/5','13/5','7/5','23/5'], ans:1,",
      replace:"2 又 3/5 換成假分數應該是多少？',\n          opts:['6/5','13/5','7/5','23/5'], ans:2," },
    { file:'index', expect:'disagree', via:'index',
      find:"        { stem:'What is 17/5 as a mixed number?', opts:['2 3/5','3 2/5','3 17/5','3'], ans:1,",
      replace:"        { stem:'What is 17/5 as a mixed number?', opts:['2 3/5','3 2/5','3 17/5','3'], ans:2," },
    { file:'index', expect:'why does not show', via:'index',
      find:"          why:'17 ÷ 5 ＝ 3 餘 2：商 3 寫在前面當整數",
      replace:"          why:'17 ÷ 5 是 3 餘 2：商 3 寫在前面當整數" },

    /* ---------- 課程教的規則：四頁的措辭 ---------- */
    { file:'index', expect:'says an improper fraction is 1 or more', via:'index',
      find:'<p class="notebox" data-i18n="s1note">⚠️ <strong>分子和分母一樣大也是假分數</strong>（5/5、7/7），而且它剛好等於 1。所以只能說假分數「<strong>等於 1 或比 1 大',
      replace:'<p class="notebox" data-i18n="s1note">⚠️ <strong>分子和分母一樣大也是假分數</strong>（5/5、7/7），而且它剛好等於 1。所以只能說假分數「<strong>所以假分數一定比 1 大。' },
    { file:'index', expect:'says this lesson does not simplify', via:'index',
      find:'<p class="notebox" data-i18n="scopeNote">這一課只做<strong>同一個分母</strong>的分數：三個名字（真分數、假分數、帶分數）、假分數與帶分數<strong>互換</strong>，以及<strong>同分母</strong>的加減。<strong>這一課不做約分',
      replace:'<p class="notebox" data-i18n="scopeNote">這一課只做<strong>同一個分母</strong>的分數：三個名字（真分數、假分數、帶分數）、假分數與帶分數<strong>互換</strong>，以及<strong>同分母</strong>的加減。<strong>答案記得約分成最簡分數。' },
    { file:'reference', expect:'says an improper fraction is 1 or more', via:'index',
      find:'<p class="bigrule" data-i18n="rule1"><b>分子比分母小是真分數；分子和分母一樣大、或是分子比分母大，是假分數。</b>假分數<b>等於 1 或比 1 大',
      replace:'<p class="bigrule" data-i18n="rule1"><b>分子比分母小是真分數；分子和分母一樣大、或是分子比分母大，是假分數。</b>假分數<b>假分數<b>一定比 1 大</b>' },
    { file:'reference', expect:'says the borrowed 1 becomes denominator over denominator', via:'index',
      find:'<li data-i18n="a3"><strong>相減</strong>：分子不夠減就<strong>向整數借 1</strong>（被減數一定比減數大，所以借得到），借過來的 1 換成<strong>分母分之分母',
      replace:'<li data-i18n="a3"><strong>相減</strong>：分子不夠減就<strong>向整數借 1</strong>（被減數一定比減數大，所以借得到），借過來的 1 換成<strong>借過來的 1 換成 <strong>10</strong>' },
    { file:'reference', expect:'says the denominator never moves', via:'index',
      find:'<li data-i18n="a1"><strong>先確認兩個分母一樣</strong>（這一課的題目都一樣）。分母從頭到尾<strong>都不動',
      replace:'<li data-i18n="a1"><strong>先確認兩個分母一樣</strong>（這一課的題目都一樣）。分母從頭到尾<strong>分母記得也要一起加' },
    { file:'reference', expect:'says dividing exactly gives a whole number', via:'index',
      find:'<td data-i18n="w3b">除得剛剛好（餘數 0）的時候，只寫商，後面不寫分數',
      replace:'<td data-i18n="w3b">除得剛剛好（餘數 0）的時候，只寫商，一律寫成帶分數。' },
    { file:'parents', expect:'tells parents an improper fraction is not an error', via:'index',
      find:'<p class="bigline" data-i18n="s1p2"><strong>大人最容易誤解的兩點：</strong>第一，很多大人把假分數當成「還沒算完」，看到 9/4 就說「要改成 2 又 1/4」。<strong>假分數不是錯誤，是正式的寫法',
      replace:'<p class="bigline" data-i18n="s1p2"><strong>大人最容易誤解的兩點：</strong>第一，很多大人把假分數當成「還沒算完」，看到 9/4 就說「要改成 2 又 1/4」。<strong><strong>假分數要改成帶分數才算算完</strong>' },
    { file:'parents', expect:'tells parents not to simplify ahead of grade 5', via:'index',
      find:'<p class="bigline" data-i18n="s1p2"><strong>大人最容易誤解的兩點：</strong>第一，很多大人把假分數當成「還沒算完」，看到 9/4 就說「要改成 2 又 1/4」。<strong>假分數不是錯誤，是正式的寫法</strong>；換成帶分數只是<strong>換一種寫法</strong>，兩個一樣大。孩子如果一直聽到「要改成…」，就會以為分子比分母大是犯規。<br>第二，<strong>大人會自動約分</strong>：孩子算出 2/6，大人順口說「那就是 1/3 啊」。可是<strong>約分是五年級才教的',
      replace:'<p class="bigline" data-i18n="s1p2"><strong>大人最容易誤解的兩點：</strong>第一，很多大人把假分數當成「還沒算完」，看到 9/4 就說「要改成 2 又 1/4」。<strong>假分數不是錯誤，是正式的寫法</strong>；換成帶分數只是<strong>換一種寫法</strong>，兩個一樣大。孩子如果一直聽到「要改成…」，就會以為分子比分母大是犯規。<br>第二，<strong>大人會自動約分</strong>：孩子算出 2/6，大人順口說「那就是 1/3 啊」。可是<strong>約分順便教一下也可以' },
    { file:'parents', expect:'names the game in the mastery standard', via:'index',
      find:'<div class="readybox" data-i18n="readyBox">精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「變身工廠闖關',
      replace:'<div class="readybox" data-i18n="readyBox">精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「小遊戲有通關' },
    { file:'parents', expect:'says which borrowing the child has already met', via:'index',
      find:'<p class="bigline" data-i18n="s1p2"><strong>大人最容易誤解的兩點：</strong>第一，很多大人把假分數當成「還沒算完」，看到 9/4 就說「要改成 2 又 1/4」。<strong>假分數不是錯誤，是正式的寫法</strong>；換成帶分數只是<strong>換一種寫法</strong>，兩個一樣大。孩子如果一直聽到「要改成…」，就會以為分子比分母大是犯規。<br>第二，<strong>大人會自動約分</strong>：孩子算出 2/6，大人順口說「那就是 1/3 啊」。可是<strong>約分是五年級才教的</strong>，這一課的答案只要還有分數部分，就保留原來的分母。突然冒出一個沒學過的步驟，孩子會以為自己算錯了。<br>另外一件值得先知道的事：這一課的<strong>借位</strong>和整數直式不一樣 —— 借過來的 1 不是 10，而是<strong>分母分之分母</strong>（分母是 5 就是 5/5）。孩子在<strong>四年級的「24 時調度中心」</strong>已經借過 60 分和 24 小時',
      replace:'<p class="bigline" data-i18n="s1p2"><strong>大人最容易誤解的兩點：</strong>第一，很多大人把假分數當成「還沒算完」，看到 9/4 就說「要改成 2 又 1/4」。<strong>假分數不是錯誤，是正式的寫法</strong>；換成帶分數只是<strong>換一種寫法</strong>，兩個一樣大。孩子如果一直聽到「要改成…」，就會以為分子比分母大是犯規。<br>第二，<strong>大人會自動約分</strong>：孩子算出 2/6，大人順口說「那就是 1/3 啊」。可是<strong>約分是五年級才教的</strong>，這一課的答案只要還有分數部分，就保留原來的分母。突然冒出一個沒學過的步驟，孩子會以為自己算錯了。<br>另外一件值得先知道的事：這一課的<strong>借位</strong>和整數直式不一樣 —— 借過來的 1 不是 10，而是<strong>分母分之分母</strong>（分母是 5 就是 5/5）。孩子在<strong>四年級的「24 時調度中心」</strong>從來沒有借過不是 10 的數' },

    /* ---------- review.html：產生器 ---------- */
    { file:'review', expect:'the verb has to agree with the value too',
      find:"  function isAreEn(v){ return (v === 1) ? ' is' : ' are'; }",
      replace:"  function isAreEn(v){ return ' are'; }" },
    { file:'review', expect:'so the swapped-quotient distractor is the correct answer and vanishes',
      find:'          ok = (q < d) && (q !== r);',
      replace:'          ok = (q < d);' },
    { file:'review', expect:'so two of its distractors are the same number and one vanishes',
      find:'          ok = (w + n !== w * n);',
      replace:'          ok = true;' },
    { file:'review', expect:'wholeToImproper drew w + d === total - d',
      find:'          ok = (w + d !== w * d - d);',
      replace:'          ok = true;' },
    { file:'review', expect:'addProper drew s === 2 x |n1 - n2|',
      find:'          ok = (n1 + n2 >= d) && (n1 + n2 !== 2 * Math.abs(n1 - n2));',
      replace:'          ok = (n1 + n2 >= d);' },
    { file:'review', expect:'addMixedNoCarry drew s === 2 x |n1 - n2|',
      find:'          ok = (n1 + n2 < d) && (n1 + n2 !== 2 * Math.abs(n1 - n2));',
      replace:'          ok = (n1 + n2 < d);' },
    { file:'review', expect:'subMixedBorrow drew 2 x (n2 - n1) === d',
      find:'          ok = (n1 < n2) && (w1 - 1 - w2 >= 1) && (2 * (n2 - n1) !== d);',
      replace:'          ok = (n1 < n2) && (w1 - 1 - w2 >= 1);' },
    { file:'review', expect:'subToProper drew 2 x (n2 - n1) === d',
      find:'          ok = (n1 < n2) && (2 * (n2 - n1) !== d);\n        }\n        if (!ok){ d = 6; w2 = 1; n1 = 1; n2 = 5; }',
      replace:'          ok = (n1 < n2);\n        }\n        if (!ok){ d = 6; w2 = 1; n1 = 1; n2 = 5; }' },
    { file:'review', expect:'toImproper does not offer the multiplied-the-numerator distractor',
      find:'          fracOpt(w * n, d),                            // 整數乘分子',
      replace:'          fracOpt(w * n + 100, d),                            // 整數乘分子' },
    { file:'review', expect:'toMixed',
      find:'        var correct = mixedOpt(q, r, d);',
      replace:'        var correct = mixedOpt(r, q, d);' },
    { file:'review', expect:'toMixedWhole',
      find:'        var correct = mixedOpt(q, 0, d);          // 印出來就是整數 q',
      replace:'        var correct = mixedOpt(q, 1, d);          // 印出來就是整數 q' },
    { file:'review', expect:'toMixedWhole: the numerator must divide exactly',
      find:'        var n = q * d;\n        var correct = mixedOpt(q, 0, d);',
      replace:'        var n = q * d + 1;\n        var correct = mixedOpt(q, 0, d);' },
    { file:'review', expect:'toImproper',
      find:'        var total = toImproper(w, n, d);\n        var correct = fracOpt(total, d);',
      replace:'        var total = toImproper(w, n, d);\n        var correct = fracOpt(total + 1, d);' },
    { file:'review', expect:'wholeToImproper',
      find:'        var total = w * d;\n        var correct = fracOpt(total, d);',
      replace:'        var total = w + d;\n        var correct = fracOpt(total, d);' },
    { file:'review', expect:'addProper: the numerators must reach the denominator',
      find:'          ok = (n1 + n2 >= d) && (n1 + n2 !== 2 * Math.abs(n1 - n2));\n        }\n        if (!ok){ d = 5; n1 = 3; n2 = 4; }',
      replace:'          ok = (n1 + n2 !== 2 * Math.abs(n1 - n2));\n        }\n        if (!ok){ d = 5; n1 = 3; n2 = 4; }' },
    { file:'review', expect:'addProper',
      find:'        var correct = mixedOpt(m.w, m.n, d);\n        var cands = [\n          fracOpt(s, 2 * d),',
      replace:'        var correct = mixedOpt(m.w + 1, m.n, d);\n        var cands = [\n          fracOpt(s, 2 * d),' },
    { file:'review', expect:'addMixedCarry: the numerators must reach the denominator',
      find:'          ok = (n1 + n2 >= d);\n        }\n        if (!ok){ d = 5; w1 = 1; w2 = 2; n1 = 3; n2 = 4; }',
      replace:'          ok = (n1 + n2 >= 2);\n        }\n        if (!ok){ d = 5; w1 = 1; w2 = 2; n1 = 3; n2 = 4; }' },
    /* ⚠️ 抽樣範圍本身就保證了條件（n2 從 1~d-1-n1 抽），所以拿掉 ok 什麼都證明不了 ——
       真正還活著的那條路徑是**保底**，所以改壞保底。 */
    { file:'review', expect:'addMixedNoCarry: the numerators must not reach the denominator',
      find:'        if (!ok){ d = 6; w1 = 1; w2 = 2; n1 = 2; n2 = 3; }',
      replace:'        if (true){ d = 6; w1 = 1; w2 = 2; n1 = 4; n2 = 3; }' },
    { file:'review', expect:'subMixedBorrow: the numerator must be too small',
      find:'        if (!ok){ d = 5; w1 = 3; w2 = 1; n1 = 1; n2 = 3; }',
      replace:'        if (true){ d = 5; w1 = 3; w2 = 1; n1 = 3; n2 = 1; }' },
    { file:'review', expect:'subMixedBorrow does not offer the borrowed-but-kept-the-whole distractor',
      find:'          mixedOpt(w1 - w2, n1 + d - n2, d),      // 借了卻沒把整數扣掉',
      replace:'          mixedOpt(w1 - 1 - w2, n1 + d - n2, d),      // 借了卻沒把整數扣掉' },
    { file:'review', expect:'subMixedNoBorrow: the numerator must be big enough',
      find:'        if (!ok){ d = 5; w1 = 3; w2 = 1; n1 = 4; n2 = 2; }',
      replace:'        if (true){ d = 5; w1 = 3; w2 = 1; n1 = 2; n2 = 4; }' },
    { file:'review', expect:'subToProper: the whole parts must differ by exactly 1',
      find:'        var w1 = w2 + 1;',
      replace:'        var w1 = w2 + 2;' },
    { file:'review', expect:'subToProper',
      find:'        var correct = mixedOpt(0, m.n, d);        // 整數是 0，只寫分數部分',
      replace:'        var correct = mixedOpt(1, m.n, d);        // 整數是 0，只寫分數部分' },
    /* 值的去重必須用**約到最簡**的鍵，不是字串 */
    { file:'review', expect:'are the same value',
      find:"    var g = gcd(Math.abs(num) || 1, o.d) || 1;\n    return 'v|' + (num / g) + '/' + (o.d / g);",
      replace:"    return 'v|' + num + '/' + o.d;" },
    { file:'review', expect:'are the same value',
      find:"  function optKey(o){\n    if (o.kind === 'name') return 'k|' + o.key;",
      replace:"  function optKey(o){\n    if (o.kind === 'name') return 'k|' + o.key;\n    if (o.kind === 'mixed') return 'm|' + o.w + '|' + o.n + '|' + o.d;" },
    /* 產生器清單：改名一支，它那一組斷言會靜靜消失 */
    { file:'review', expect:'this config describes 12 generators', via:'index',
      find:"    { id:'wholeToImproper', cat:'toImp',",
      replace:"    { id:'wholeToImproperX', cat:'toImp'," },
    /* 抽樣：把一支產生器寫死成一組合法參數，所有斷言還是綠的 */
    { file:'review', expect:'must actually sample its parameters', via:'index',
      find:'          d = pickUnused(DEN_POOL, used);\n          w = pick(BIGW_POOL);\n          /* 「相加而不是相乘」和「少算一整條」在 d ＝ 3、w ＝ 3 時是同一個數。 */',
      replace:'          d = 5;\n          w = 4;\n          /* 「相加而不是相乘」和「少算一整條」在 d ＝ 3、w ＝ 3 時是同一個數。 */' },
    { file:'review', expect:"this config's declared pools expect", via:'index',
      find:'  var QUOT_POOL  = rangeList(2, 3);               // 假分數換出來的商 2~3',
      replace:'  var QUOT_POOL  = rangeList(2, 4);               // 假分數換出來的商 2~3' },
    { file:'review', expect:"this config's declared pools expect", via:'index',
      find:'  var DEN_MIN = 3;      // 產生器用到的最小分母（2 太小，誘答很容易撞在一起）',
      replace:'  var DEN_MIN = 2;      // 產生器用到的最小分母（2 太小，誘答很容易撞在一起）' },
    /* 題幹問的是什麼 */
    { file:'review', expect:'stem no longer asks for what it answers',
      find:"            ? fracTxt + ' 換成帶分數是多少？'",
      replace:"            ? fracTxt + ' 是多少？'" },
    { file:'review', expect:'which is a different question from its answer',
      find:"            ? mixTxt + ' 換成假分數是多少？'",
      replace:"            ? mixTxt + ' 換成假分數是多少？換成帶分數是多少？'" },
    /* 解釋要把算式寫出來，不是只把答案印出來 */
    { file:'review', expect:'why does not show',
      find:"            ? d.n + ' ÷ ' + d.d + ' ＝ ' + d.q + ' 餘 ' + d.r + '：商 ' + d.q",
      replace:"            ? d.n + ' ÷ ' + d.d + ' 是 ' + d.q + ' 餘 ' + d.r + '：商 ' + d.q" },
    { file:'review', expect:'why does not show',
      find:"            ? '整數 × 分母 ＋ 分子：' + d.w + ' × ' + d.d + ' ＝ ' + prod + '，' + prod",
      replace:"            ? '整數 × 分母 ＋ 分子：' + d.w + ' ＋ ' + d.d + ' ＝ ' + prod + '，' + prod" },
    { file:'review', expect:'the borrowed 1 written as',
      find:"            ? '分子 ' + d.n1 + ' 減不掉 ' + d.n2 + '，向整數借 1，換成 ' + oneTxt + '：'\n              + d.n1 + ' ＋ ' + d.d + ' ＝ ' + top + '，' + top + ' － ' + d.n2 + ' ＝ ' + m.n\n              + '；整數被借走 1，所以 ' + d.w1 + ' － 1 － ' + d.w2 + ' ＝ ' + m.w",
      replace:"            ? '分子 ' + d.n1 + ' 減不掉 ' + d.n2 + '，向整數借 1：'\n              + d.n1 + ' ＋ ' + d.d + ' ＝ ' + top + '，' + top + ' － ' + d.n2 + ' ＝ ' + m.n\n              + '；整數被借走 1，所以 ' + d.w1 + ' － 1 － ' + d.w2 + ' ＝ ' + m.w" },
    /* 英文單複數：1 是唯一會錯的那個值 */
    { file:'review', expect:'only the value 1 gets the plural wrong',
      find:"  function plEn(v, name){ return v + ' ' + name + (v === 1 ? '' : 's'); }",
      replace:"  function plEn(v, name){ return v + ' ' + name + 's'; }" },
    { file:'index', expect:'only the value 1 gets the plural wrong', via:'index',
      find:"  function plEn(v, name){ return v + ' ' + name + (v === 1 ? '' : 's'); }",
      replace:"  function plEn(v, name){ return v + ' ' + name + 's'; }" },
    /* 中文與數字之間要有空格 */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"        if (w > 0 && n > 0) return w + ' 又 ' + n + '/' + d;\n        if (w > 0) return String(w);\n        if (n > 0) return n + '/' + d;\n        return '0';\n      },\n      fbRight:'<b>答對了。</b> ',",
      replace:"        if (w > 0 && n > 0) return w + '又' + n + '/' + d;\n        if (w > 0) return String(w);\n        if (n > 0) return n + '/' + d;\n        return '0';\n      },\n      fbRight:'<b>答對了。</b> '," },
    /* 英文帶分數的空白不見了：1 2/5 變成 12/5，是完全不同的數 */
    { file:'review', expect:'en opts[ans] != correct',
      find:"        if (w > 0 && n > 0) return w + ' ' + n + '/' + d;",
      replace:"        if (w > 0 && n > 0) return w + '' + n + '/' + d;" },
    /* 「印回去」那一條只證明得了**誘答**的寫法 —— 格式化壞掉時，正解會先被
       expectedCorrect 抓走。addProper 的正解是帶分數，兩個誘答才是分數，
       所以把分數補零只會動到誘答。 */
    { file:'review', expect:'is not spelled the way this lesson spells it',
      find:"      frac:function(n, d){ return n + '/' + d; },\n      mixed:function(w, n, d){\n        if (w > 0 && n > 0) return w + ' 又 ' + n + '/' + d;",
      replace:"      frac:function(n, d){ return (n < 10 ? '0' : '') + n + '/' + d; },\n      mixed:function(w, n, d){\n        if (w > 0 && n > 0) return w + ' 又 ' + n + '/' + d;" }
  ],

  sim: {
    /* fmt() 要印名字與分數，那些表宣告在「工具」那一段之前的 TXT 裡，
       所以把切片起點往前移到 TXT。那一段是純資料，不碰 DOM。 */
    blockStart: '  var TXT = {',

    INVARIANTS: {
      nameOf: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'nameOf: denominator ' + d.d + ' is outside the declared pool';
        if (!(d.n >= 1)) return 'nameOf: the numerator must be at least 1';
        if (d.n === d.d)
          return 'nameOf must not ask about a numerator equal to its denominator: ' + d.n + '/' + d.d +
                 ' also equals the whole number 1, so the "whole number" option would be defensible too';
        if (d.kind !== kindRef(d.n, d.d)) return 'nameOf: the marked kind is not the one the rule gives';
        if (d.opts.length !== 4) return 'nameOf: there must be four names to choose from';
        const keys = d.opts.map(o => o.key).sort().join(',');
        if (keys !== 'improper,mixed,proper,whole') return 'nameOf: the four names are not the four names';
        if (d.opts[d.ans].key !== d.kind) return 'nameOf: opts[ans] is not the marked kind';
      },
      pickImproper: d => {
        if (DEN_POOL.indexOf(d.d0) < 0) return 'pickImproper: denominator ' + d.d0 + ' is outside the declared pool';
        if (kindRef(d.n0, d.d0) !== 'improper') return 'pickImproper: the marked answer is not improper';
        if (d.n0 > 2 * d.d0 - 1) return 'pickImproper: the numerator is outside the declared pool';
        let improper = 0;
        for (const o of d.opts){
          if (o.kind !== 'frac') return 'pickImproper: every option must be a plain fraction';
          if (kindRef(o.n, o.d) === 'improper') improper++;
        }
        if (improper !== 1) return 'pickImproper offers ' + improper + ' improper fractions, so the answer is not unique';
        if (kindRef(d.opts[d.ans].n, d.opts[d.ans].d) !== 'improper')
          return 'pickImproper: opts[ans] is not the improper one';
      },
      toMixed: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'toMixed: denominator ' + d.d + ' is outside the declared pool';
        if (QUOT_POOL.indexOf(d.q) < 0) return 'toMixed: quotient ' + d.q + ' is outside the declared pool';
        if (!(d.r >= 1 && d.r <= d.d - 1)) return 'toMixed: the remainder must be between 1 and d minus 1';
        if (d.n !== d.q * d.d + d.r) return 'toMixed: n is not q x d + r';
        const m = toMixedRef(d.n, d.d);
        if (m.w !== d.q || m.n !== d.r) return 'toMixed: q and r are not n divided by d';
        if (m.n === 0) return 'toMixed must not divide exactly — that case belongs to toMixedWhole';
        if (!(d.q < d.d)) return 'toMixed: q must be smaller than d so the swapped distractor stays a legal shape';
        /* ⚠️ q === r 時「放反」就等於正解，去重會把它拿掉 —— 而「有沒有提供這個誘答」
           那一條會被**正解自己**滿足，所以要先把這種抽樣擋掉。 */
        if (d.q === d.r)
          return 'toMixed drew q === r, so the swapped-quotient distractor is the correct answer and vanishes';
        if (!d.opts.some(o => o.kind === 'mixed' && o.w === d.r && o.n === d.q && o.d === d.d))
          return 'toMixed does not offer the swapped-quotient-and-remainder distractor ' + d.r + ' + ' + d.q + '/' + d.d;
      },
      toMixedWhole: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'toMixedWhole: denominator ' + d.d + ' is outside the declared pool';
        if (QUOT_POOL.indexOf(d.q) < 0) return 'toMixedWhole: quotient ' + d.q + ' is outside the declared pool';
        if (d.n !== d.q * d.d) return 'toMixedWhole: the numerator must divide exactly — n is not q x d';
        if (d.n % d.d !== 0) return 'toMixedWhole: the numerator must divide exactly';
        /* 「硬寫成帶分數、把分母當餘數」那一個誘答一定要在選項裡。 */
        if (!d.opts.some(o => o.kind === 'mixed' && o.w === d.q && o.n === d.d && o.d === d.d))
          return 'toMixedWhole does not offer the forced-into-a-mixed-number distractor ' + d.q + ' + ' + d.d + '/' + d.d;
      },
      toImproper: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'toImproper: denominator ' + d.d + ' is outside the declared pool';
        if (WHOLE_POOL.indexOf(d.w) < 0) return 'toImproper: whole part ' + d.w + ' is outside the declared pool';
        if (!(d.n >= 1 && d.n <= d.d - 1)) return 'toImproper: the fraction part of a mixed number must be proper';
        if (d.total !== toImproperRef(d.w, d.n, d.d)) return 'toImproper: the total is not w x d + n';
        if (d.w + d.n === d.w * d.n)
          return 'toImproper drew w + n === w x n, so two of its distractors are the same number and one vanishes';
        if (!d.opts.some(o => o.kind === 'frac' && o.n === d.w + d.n && o.d === d.d))
          return 'toImproper does not offer the just-added-them-up distractor ' + (d.w + d.n) + '/' + d.d;
        if (!d.opts.some(o => o.kind === 'frac' && o.n === d.w * d.n && o.d === d.d))
          return 'toImproper does not offer the multiplied-the-numerator distractor ' + (d.w * d.n) + '/' + d.d;
      },
      wholeToImproper: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'wholeToImproper: denominator ' + d.d + ' is outside the declared pool';
        if (BIGW_POOL.indexOf(d.w) < 0) return 'wholeToImproper: whole number ' + d.w + ' is outside the declared pool';
        if (d.total !== d.w * d.d) return 'wholeToImproper: the total is not w x d';
        if (d.w + d.d === d.total - d.d)
          return 'wholeToImproper drew w + d === total - d, so two of its distractors are the same number and one vanishes';
      },
      addProper: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'addProper: denominator ' + d.d + ' is outside the declared pool';
        if (!(d.n1 >= 1 && d.n1 <= d.d - 1)) return 'addProper: the first addend is not a proper fraction';
        if (!(d.n2 >= 1 && d.n2 <= d.d - 1)) return 'addProper: the second addend is not a proper fraction';
        if (d.s !== d.n1 + d.n2) return 'addProper: s is not n1 + n2';
        if (d.s < d.d) return 'addProper: the numerators must reach the denominator, or nothing carries';
        if (d.s === 2 * Math.abs(d.n1 - d.n2))
          return 'addProper drew s === 2 x |n1 - n2|, so the added-the-denominators and the subtracted distractors are the same value';
      },
      addMixedCarry: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'addMixedCarry: denominator ' + d.d + ' is outside the declared pool';
        if (WHOLE_POOL.indexOf(d.w1) < 0 || WHOLE_POOL.indexOf(d.w2) < 0)
          return 'addMixedCarry: a whole part is outside the declared pool';
        if (!(d.n1 >= 1 && d.n1 <= d.d - 1) || !(d.n2 >= 1 && d.n2 <= d.d - 1))
          return 'addMixedCarry: a fraction part is not proper';
        if (d.s !== d.n1 + d.n2) return 'addMixedCarry: s is not n1 + n2';
        if (d.s < d.d) return 'addMixedCarry: the numerators must reach the denominator, or nothing carries';
        /* 「分子扣了分母，整數卻沒進位」那一個誘答一定要在選項裡。 */
        if (!d.opts.some(o => o.kind === 'mixed' && o.w === d.w1 + d.w2 && o.n === d.s - d.d && o.d === d.d))
          return 'addMixedCarry does not offer the forgot-to-carry distractor ' + (d.w1 + d.w2) + ' + ' + (d.s - d.d) + '/' + d.d;
      },
      addMixedNoCarry: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'addMixedNoCarry: denominator ' + d.d + ' is outside the declared pool';
        if (WHOLE_POOL.indexOf(d.w1) < 0 || WHOLE_POOL.indexOf(d.w2) < 0)
          return 'addMixedNoCarry: a whole part is outside the declared pool';
        if (!(d.n1 >= 1 && d.n1 <= d.d - 1) || !(d.n2 >= 1 && d.n2 <= d.d - 1))
          return 'addMixedNoCarry: a fraction part is not proper';
        if (d.s !== d.n1 + d.n2) return 'addMixedNoCarry: s is not n1 + n2';
        if (d.s >= d.d) return 'addMixedNoCarry: the numerators must not reach the denominator, or it would carry';
        if (d.s === 2 * Math.abs(d.n1 - d.n2))
          return 'addMixedNoCarry drew s === 2 x |n1 - n2|, so two of its distractors are the same value';
      },
      subMixedBorrow: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'subMixedBorrow: denominator ' + d.d + ' is outside the declared pool';
        if (!(d.w1 >= 3 && d.w1 <= R_WHOLE_MAX)) return 'subMixedBorrow: w1 is outside the declared pool';
        if (!(d.w2 >= 1 && d.w2 <= d.w1 - 2)) return 'subMixedBorrow: w2 is outside the declared pool';
        if (!(d.n1 >= 1 && d.n1 <= d.d - 1) || !(d.n2 >= 1 && d.n2 <= d.d - 1))
          return 'subMixedBorrow: a fraction part is not proper';
        if (!(d.n1 < d.n2)) return 'subMixedBorrow: the numerator must be too small, or nothing is borrowed';
        if (2 * (d.n2 - d.n1) === d.d)
          return 'subMixedBorrow drew 2 x (n2 - n1) === d, so the reversed-subtraction distractor is the same value as the borrowed-but-kept one';
        const m = subRef({ w:d.w1, n:d.n1, d:d.d }, { w:d.w2, n:d.n2, d:d.d });
        if (m.w < 1) return 'subMixedBorrow: after borrowing the whole part must still be at least 1';
        if (m.n === 0) return 'subMixedBorrow: the answer must keep a fraction part';
        /* 「借了卻沒把整數扣掉」那一個誘答一定要在選項裡 —— 它剛好比正解多 1。 */
        if (!d.opts.some(o => o.kind === 'mixed' && o.w === d.w1 - d.w2 && o.n === d.n1 + d.d - d.n2 && o.d === d.d))
          return 'subMixedBorrow does not offer the borrowed-but-kept-the-whole distractor ' +
                 (d.w1 - d.w2) + ' + ' + (d.n1 + d.d - d.n2) + '/' + d.d;
      },
      subMixedNoBorrow: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'subMixedNoBorrow: denominator ' + d.d + ' is outside the declared pool';
        if (!(d.w1 >= 3 && d.w1 <= R_WHOLE_MAX)) return 'subMixedNoBorrow: w1 is outside the declared pool';
        if (!(d.w2 >= 1 && d.w2 <= d.w1 - 1)) return 'subMixedNoBorrow: w2 is outside the declared pool';
        if (!(d.n1 >= 1 && d.n1 <= d.d - 1) || !(d.n2 >= 1 && d.n2 <= d.d - 1))
          return 'subMixedNoBorrow: a fraction part is not proper';
        if (!(d.n1 > d.n2)) return 'subMixedNoBorrow: the numerator must be big enough, or it would have to borrow';
        if (!(d.w1 > d.w2)) return 'subMixedNoBorrow: the whole part of the answer must stay at least 1';
      },
      subToProper: d => {
        if (DEN_POOL.indexOf(d.d) < 0) return 'subToProper: denominator ' + d.d + ' is outside the declared pool';
        if (d.w1 !== d.w2 + 1) return 'subToProper: the whole parts must differ by exactly 1';
        if (!(d.w2 >= 1 && d.w2 <= R_WHOLE_MAX - 1)) return 'subToProper: w2 is outside the declared pool';
        if (!(d.n1 < d.n2)) return 'subToProper: the numerator must be too small, or nothing is borrowed';
        if (2 * (d.n2 - d.n1) === d.d)
          return 'subToProper drew 2 x (n2 - n1) === d, so the reversed-subtraction distractor is the correct answer';
        const m = subRef({ w:d.w1, n:d.n1, d:d.d }, { w:d.w2, n:d.n2, d:d.d });
        if (m.w !== 0) return 'subToProper: the whole-number part must come out as 0, independently ' + m.w;
        if (m.n === 0) return 'subToProper: the answer must be a proper fraction, not 0';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不呼叫 review.html 的 mixed()／frac()／addPair()／subPair()。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'nameOf':          return KIND_WORDS[lang][kindRef(d.n, d.d)];
        case 'pickImproper':    return fracRef(lang, d.n0, d.d0);
        case 'toMixed': {
          const m = toMixedRef(d.q * d.d + d.r, d.d);
          return mixedRef(lang, m.w, m.n, d.d);
        }
        case 'toMixedWhole': {
          const m = toMixedRef(d.q * d.d, d.d);
          return mixedRef(lang, m.w, m.n, d.d);
        }
        case 'toImproper':      return fracRef(lang, toImproperRef(d.w, d.n, d.d), d.d);
        case 'wholeToImproper': return fracRef(lang, d.w * d.d, d.d);
        case 'addProper': {
          const m = toMixedRef(d.n1 + d.n2, d.d);
          return mixedRef(lang, m.w, m.n, d.d);
        }
        case 'addMixedCarry':
        case 'addMixedNoCarry': {
          const m = addRef({ w:d.w1, n:d.n1, d:d.d }, { w:d.w2, n:d.n2, d:d.d });
          return mixedRef(lang, m.w, m.n, d.d);
        }
        case 'subMixedBorrow':
        case 'subMixedNoBorrow':
        case 'subToProper': {
          const m = subRef({ w:d.w1, n:d.n1, d:d.d }, { w:d.w2, n:d.n2, d:d.d });
          return mixedRef(lang, m.w, m.n, d.d);
        }
        default: return null;
      }
    },

    /* 選項的形狀與範圍。正解與誘答分開驗：刻意的迷思寫法（4 又 9/7）是這一課在教的
       錯誤，可是**正解永遠是整理過的寫法**。 */
    optionOk: function(s, genId, lang, isCorrect){
      const str = String(s);
      if (/[·#]/.test(str)) return 'junk option ' + str;
      if (NEG.test(str)) return 'option "' + str + '" carries a negative number, but every fraction here is positive';
      const shape = OPT_SHAPE[genId];
      if (!shape) return 'no option shape declared for ' + genId;
      const p = parseOpt(str, lang);
      if (!p) return 'option "' + str + '" is not one of this lesson\'s shapes (a fraction, a mixed number, a whole number or a name)';
      const back = reprint(p, lang);
      if (back !== str)
        return 'option "' + str + '" is not spelled the way this lesson spells it (reprinted as "' + back + '")';

      const kinds = isCorrect ? shape.correct : shape.allowed;
      if (kinds.indexOf(p.kind) < 0)
        return 'option "' + str + '" is a ' + p.kind + ', but ' + genId +
               (isCorrect ? ' must answer with ' : ' never offers ') + kinds.join('/');
      if (p.kind === 'name') return null;

      if (p.d !== null && !(p.d >= DEN_MIN && p.d <= 2 * R_DEN_MAX))
        return 'option "' + str + '" has denominator ' + p.d + ', outside ' + DEN_MIN + '~' + (2 * R_DEN_MAX);
      if (p.n < 0 || p.w < 0) return 'option "' + str + '" has a negative part';
      /* 正解一定是整理過的寫法：帶分數的分數部分必須是真分數。 */
      if (isCorrect && p.kind === 'mixed' && p.n >= p.d)
        return 'the marked answer "' + str + '" leaves ' + p.n + '/' + p.d +
               ', which is not a proper fraction — another whole one can still be taken out';
      if (isCorrect && p.kind === 'mixed' && (p.w === 0 || p.n === 0))
        return 'the marked answer "' + str + '" writes a 0 part that this lesson leaves out';

      const v = optValue(p);
      if (!v) return 'option "' + str + '" cannot be turned into a value';
      if (shape.lo && ratCmp(v[0], v[1], shape.lo[0], shape.lo[1]) < 0)
        return 'option ' + str + ' is below this generator\'s range ' + shape.lo[0] + '/' + shape.lo[1];
      if (shape.hi && ratCmp(v[0], v[1], shape.hi[0], shape.hi[1]) > 0)
        return 'option ' + str + ' is above this generator\'s range ' + shape.hi[0] + '/' + shape.hi[1];
      return null;
    },

    /* 這一課每一個選項都是用題幹那幾個數字算出來的，所以 simgen 內建的
       「誘答整串等於題幹的某個數字」一定會命中 —— 但只有**整數形狀**的選項
       （把餘數丟掉、分子剛好減完）才可能整串就是一個數字。
       ⚠️ 這裡寫成謂詞、而且只放行 whole 那一種形狀：整個產生器全開的話，
       以後不小心把別的數字抄回選項也會被一起蓋掉。
       真正的守門在 renderCheck 裡：選項要**依值**兩兩相異。 */
    stemEchoOk: (function(){
      const onlyWhole = function(d, opt, lang){
        const p = parseOpt(String(opt), lang);
        return !!p && p.kind === 'whole';
      };
      const map = {};
      GEN_IDS.forEach(id => { map[id] = onlyWhole; });
      return map;
    })(),

    renderCheck: function(d, q, lang, genId){
      const stem = stripTags(q.stem);
      const why = stripTags(q.why);
      const shape = OPT_SHAPE[genId];
      if (!shape) return 'no option shape declared for ' + genId;

      if (/\d\.\d/.test(stem) || /\d\.\d/.test(q.opts.join(' ')))
        return genId + ' prints a decimal, but every number in this lesson is a whole number or a fraction';
      for (const t of [stem, why].concat(q.opts.map(String))){
        const pp = pluralProblem(t, lang);
        if (pp) return genId + ' ' + pp;
      }

      /* 題幹問的是什麼？只驗數字的話，把題幹換成問另一種寫法、正解不動，全部都是綠的。 */
      const ask = ASK[genId];
      if (!ask) return 'no "what does the stem ask" cues declared for ' + genId;
      for (const cue of ask[lang]){
        if (stem.indexOf(cue) < 0) return genId + ' stem no longer asks for what it answers (missing "' + cue + '")';
      }
      for (const cue of ask[lang + 'Not']){
        if (stem.indexOf(cue) >= 0) return genId + ' stem now says "' + cue + '", which is a different question from its answer';
      }

      /* 選項要**依值**兩兩相異。6/4 和 3/2、1 又 2/5 和 7/5、2 又 7/5 和 3 又 2/5
         字串都不同，值卻一樣 —— 孩子算對也會被判錯（§六之二）。 */
      const parsed = q.opts.map(o => parseOpt(String(o), lang));
      for (let i = 0; i < parsed.length; i++){
        if (!parsed[i]) return genId + ' option "' + q.opts[i] + '" cannot be parsed, so the duplicate check did not run';
      }
      for (let i = 0; i < parsed.length; i++){
        for (let j = i + 1; j < parsed.length; j++){
          const a = parsed[i], b = parsed[j];
          if (a.kind === 'name' || b.kind === 'name'){
            if (a.kind === 'name' && b.kind === 'name' && a.key === b.key)
              return genId + ' offers the name "' + q.opts[i] + '" twice';
            continue;
          }
          const va = optValue(a), vb = optValue(b);
          if (ratCmp(va[0], va[1], vb[0], vb[1]) === 0)
            return genId + ' options "' + q.opts[i] + '" and "' + q.opts[j] + '" are the same value (' +
                   ratKey(va[0], va[1]) + ')';
        }
      }

      /* 選項的分母只能是**這一題自己的分母**（或「連分母也加起來」那一個誘答的 2d）。
         全域的 3~16 太寬：一個和題目無關的分母 9 照樣過。 */
      if (genId !== 'nameOf' && genId !== 'pickImproper' && num(d.d)){
        for (let i = 0; i < parsed.length; i++){
          const pd = parsed[i].d;
          if (pd === null || pd === undefined) continue;   // 整數形狀沒有分母
          if (pd !== d.d && pd !== 2 * d.d)
            return genId + ' option "' + q.opts[i] + '" uses denominator ' + pd +
                   ', but this question is about ' + d.d + 'ths';
        }
      }

      /* 解釋要把**算式**寫出來，不是只把答案的數字印出來。 */
      const PLUS = (lang === 'zh') ? ' ＋ ' : ' + ';
      const MINUS = (lang === 'zh') ? ' － ' : ' − ';
      const EQ = (lang === 'zh') ? ' ＝ ' : ' = ';
      const TIMES = ' × ';
      const DIV = ' ÷ ';
      const REM = (lang === 'zh') ? ' 餘 ' : ' remainder ';
      const CARRY = (lang === 'zh') ? '進位的 1' : 'the 1 carried';
      let miss = null;
      function need(expr){ if (!miss && why.indexOf(expr) < 0) miss = expr; }

      if (genId === 'nameOf'){
        if (!printsNum(why, d.n) || !printsNum(why, d.d)) miss = 'the numerator ' + d.n + ' and denominator ' + d.d;
      } else if (genId === 'pickImproper'){
        if (!printsNum(why, d.n0) || !printsNum(why, d.d0)) miss = 'the numerator ' + d.n0 + ' and denominator ' + d.d0;
      } else if (genId === 'toMixed'){
        need(d.n + DIV + d.d + EQ + d.q + REM + d.r);
      } else if (genId === 'toMixedWhole'){
        need(d.n + DIV + d.d + EQ + d.q + REM + '0');
      } else if (genId === 'toImproper'){
        const prod = d.w * d.d;
        need(d.w + TIMES + d.d + EQ + prod);
        need(prod + PLUS + d.n + EQ + d.total);
      } else if (genId === 'wholeToImproper'){
        need(d.w + TIMES + d.d + EQ + d.total);
      } else if (genId === 'addProper'){
        const m = toMixedRef(d.s, d.d);
        need(d.n1 + PLUS + d.n2 + EQ + d.s);
        need(d.s + MINUS + d.d + EQ + m.n);
      } else if (genId === 'addMixedCarry'){
        const m = addRef({ w:d.w1, n:d.n1, d:d.d }, { w:d.w2, n:d.n2, d:d.d });
        need(d.n1 + PLUS + d.n2 + EQ + d.s);
        need(d.s + MINUS + d.d + EQ + m.n);
        need(d.w1 + PLUS + d.w2 + PLUS + CARRY + EQ + m.w);
      } else if (genId === 'addMixedNoCarry'){
        need(d.n1 + PLUS + d.n2 + EQ + d.s);
        need(d.w1 + PLUS + d.w2 + EQ + (d.w1 + d.w2));
      } else if (genId === 'subMixedBorrow' || genId === 'subToProper'){
        const m = subRef({ w:d.w1, n:d.n1, d:d.d }, { w:d.w2, n:d.n2, d:d.d });
        need(d.n1 + PLUS + d.d + EQ + (d.n1 + d.d));
        need((d.n1 + d.d) + MINUS + d.n2 + EQ + m.n);
        need(d.w1 + MINUS + '1' + MINUS + d.w2 + EQ + m.w);
        /* 借過來的 1 一定要說成「分母分之分母」，不是 10 */
        if (!miss && why.indexOf(d.d + '/' + d.d) < 0) miss = 'the borrowed 1 written as ' + d.d + '/' + d.d;
      } else if (genId === 'subMixedNoBorrow'){
        need(d.n1 + MINUS + d.n2 + EQ + (d.n1 - d.n2));
        need(d.w1 + MINUS + d.w2 + EQ + (d.w1 - d.w2));
      }
      if (miss) return genId + ' why does not show "' + miss + '", so the working is unchecked';

      /* 解釋一定要把答案原封不動地講出來，而且要是**完整的**那一個數：
         「13/5」含有「3/5」，子字串比對會把改壞的答案放過去。 */
      if (genId !== 'nameOf' && genId !== 'pickImproper'){
        /* ⚠️ 不可以讀 q.opts[q.ans] —— 那是產生器自己回報的答案，錯的答案會自己跟自己一致。
           用設定檔的第二套實作重算一次。 */
        const ansTxt = String(module.exports.sim.expectedCorrect(d, genId, lang));
        let at = -1, found = false;
        while ((at = why.indexOf(ansTxt, at + 1)) >= 0){
          const before = at > 0 ? why[at - 1] : ' ';
          const after = at + ansTxt.length < why.length ? why[at + ansTxt.length] : ' ';
          if (!/[0-9/]/.test(before) && !/[0-9/]/.test(after)){ found = true; break; }
        }
        if (!found) return genId + ' why never states the answer "' + ansTxt + '" as a whole value';
      }
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{DEN_MIN, DEN_MAX, MAX_WHOLE, isProper, isImproper, kindOf, toMixed, toImproper, ' +
                'valueOf, addSteps, subSteps, plEn, ' +
                'FIG_W, FIG_H, FIG_X0, FIG_Y, FIG_BAR_W, FIG_BAR_H, FIG_GAP, FIG_LABEL_DY, ' +
                'FIG_SUM_DY, FIG_FONT, FIG_FONT_SUM, FIG_MAX_BARS, FIG_MIN_CELL, ' +
                'barX, cellW, barPlan, figSumPoint, ' +
                'NAME_CASES, TOMIX_CASES, TOIMP_CASES, ADD_CASES, SUB_CASES, ' +
                'ROUNDS, roundAnswer, roundFig}',
    optionValueMax: 40,

    check: function(data, I18N, fail){
      checkCore(data, I18N, fail);
      checkFigure(data, I18N, fail);
      checkExamples(data, I18N, fail);
      checkRounds(data, I18N, fail);
      checkBankAndSiblings(data, I18N, fail);
    }
  }
};

/* ===================== 1. 三個名字、兩個方向的變身、加減 ===================== */
function checkCore(data, I18N, fail){
  if (data.DEN_MIN !== DEN_MIN) fail(`the lesson's smallest denominator is ${data.DEN_MIN}, independently ${DEN_MIN}`);
  if (data.DEN_MAX !== DEN_MAX) fail(`the lesson's largest denominator is ${data.DEN_MAX}, independently ${DEN_MAX}`);
  if (data.MAX_WHOLE !== MAX_WHOLE) fail(`the lesson's largest whole part is ${data.MAX_WHOLE}, independently ${MAX_WHOLE}`);

  /* ① 三個名字對**整個定義域**逐格比一次。分子等於分母那一格另外再釘一次 ——
        「分子比分母大」是規則寫太滿，5/5 也是假分數。 */
  for (let d = DEN_MIN; d <= DEN_MAX; d++){
    for (let n = 0; n <= (MAX_WHOLE + 1) * d; n++){
      const want = kindRef(n, d);
      if (data.kindOf(n, d) !== want)
        fail(`kindOf(${n}, ${d}) is "${data.kindOf(n, d)}", independently "${want}"`);
      if (data.isProper(n, d) !== (n < d)) fail(`isProper(${n}, ${d}) disagrees with "numerator smaller than denominator"`);
      if (data.isImproper(n, d) !== (n >= d)) fail(`isImproper(${n}, ${d}) disagrees with "numerator not smaller than denominator"`);
    }
    if (data.kindOf(d, d) !== 'improper')
      fail(`the lesson says ${d}/${d} is not improper — an equal numerator and denominator is improper, and it is exactly 1`);
    if (data.isProper(d, d))
      fail(`the lesson says ${d}/${d} is proper — an equal numerator and denominator is improper`);
  }

  /* ② 兩個方向的變身互為反函數，而且整除時沒有分數部分。 */
  for (let d = DEN_MIN; d <= DEN_MAX; d++){
    for (let n = 0; n <= (MAX_WHOLE + 1) * d; n++){
      const got = data.toMixed(n, d);
      const want = toMixedRef(n, d);
      if (got.w !== want.w || got.n !== want.n || got.d !== d)
        fail(`toMixed(${n}, ${d}) is ${got.w} + ${got.n}/${got.d}, independently ${want.w} + ${want.n}/${d} — the quotient counts the whole bars and the remainder is the numerator`);
      if (data.toImproper(got.w, got.n, d) !== n)
        fail(`toImproper(toMixed(${n}, ${d})) is ${data.toImproper(got.w, got.n, d)}, independently ${n} — whole number x denominator + numerator must undo the division`);
      if (n % d === 0 && want.n !== 0)
        fail(`${n}/${d} divides exactly, so it must come out with no fraction part`);
      if (data.valueOf(got.w, got.n, d) !== n)
        fail(`valueOf(${got.w}, ${got.n}, ${d}) is ${data.valueOf(got.w, got.n, d)}, independently ${n}`);
    }
    for (let w = 0; w <= MAX_WHOLE; w++){
      for (let n = 0; n <= d - 1; n++){
        if (data.toImproper(w, n, d) !== toImproperRef(w, n, d))
          fail(`toImproper(${w}, ${n}, ${d}) is ${data.toImproper(w, n, d)}, independently ${toImproperRef(w, n, d)} — whole number x denominator + numerator`);
      }
    }
  }

  /* ③ 相加：分母不動、到了分母才進位、總量守恆。 */
  for (let d = DEN_MIN; d <= DEN_MAX; d++){
    for (let w1 = 0; w1 <= MAX_WHOLE; w1++){
      for (let w2 = 0; w2 <= MAX_WHOLE; w2++){
        for (let n1 = 0; n1 <= d - 1; n1++){
          for (let n2 = 0; n2 <= d - 1; n2++){
            const a = { w:w1, n:n1, d:d }, b = { w:w2, n:n2, d:d };
            const r = data.addSteps(a, b);
            const want = addRef(a, b);
            if (r.d !== d) fail(`addSteps changed the denominator from ${d} to ${r.d} — the denominator never moves`);
            if (r.w !== want.w || r.n !== want.n)
              fail(`addSteps(${w1}+${n1}/${d}, ${w2}+${n2}/${d}) is ${r.w}+${r.n}/${d}, independently ${want.w}+${want.n}/${d}`);
            if (r.n < 0 || r.n >= d) fail(`addSteps left ${r.n}/${d}, which is not a proper fraction`);
            const carryWant = (n1 + n2 >= d) ? 1 : 0;
            if (r.carry !== carryWant)
              fail(`addSteps carries ${r.carry} when the numerators make ${n1 + n2} against denominator ${d} — it carries once the numerator reaches the denominator`);
            if (data.toImproper(r.w, r.n, d) !== toImproperRef(w1, n1, d) + toImproperRef(w2, n2, d))
              fail(`addSteps does not conserve the total for ${w1}+${n1}/${d} plus ${w2}+${n2}/${d}`);
          }
        }
      }
    }
  }

  /* ④ 相減：借位條件、借過來的 1 換成 d/d、上一級扣掉那 1、總量守恆。 */
  for (let d = DEN_MIN; d <= DEN_MAX; d++){
    for (let w1 = 0; w1 <= MAX_WHOLE + 1; w1++){
      for (let w2 = 0; w2 <= w1; w2++){
        for (let n1 = 0; n1 <= d - 1; n1++){
          for (let n2 = 0; n2 <= d - 1; n2++){
            if (toImproperRef(w1, n1, d) < toImproperRef(w2, n2, d)) continue;
            const a = { w:w1, n:n1, d:d }, b = { w:w2, n:n2, d:d };
            const r = data.subSteps(a, b);
            const want = subRef(a, b);
            if (r.d !== d) fail(`subSteps changed the denominator from ${d} to ${r.d} — the denominator never moves`);
            if (r.w !== want.w || r.n !== want.n)
              fail(`subSteps(${w1}+${n1}/${d} minus ${w2}+${n2}/${d}) is ${r.w}+${r.n}/${d}, independently ${want.w}+${want.n}/${d}`);
            if (r.n < 0 || r.n >= d) fail(`subSteps left ${r.n}/${d}, which is not a proper fraction`);
            const needWant = (n1 < n2) ? 1 : 0;
            if (r.borrowed !== needWant)
              fail(`subSteps borrows ${r.borrowed} when taking ${n2}/${d} from ${n1}/${d} — it borrows exactly when the numerator is too small`);
            if (needWant){
              if (r.nTop !== n1 + d)
                fail(`subSteps borrowed ${r.nTop - n1} instead of ${d} — the borrowed 1 turns into d/d, which is ${d} squares`);
              if (r.wTop !== w1 - 1)
                fail(`subSteps left the whole part at ${r.wTop} after borrowing from ${w1} — the whole number loses the 1 it lent`);
            } else if (r.nTop !== n1 || r.wTop !== w1){
              fail('subSteps changed the top row without borrowing');
            }
            if (data.toImproper(r.w, r.n, d) !== toImproperRef(w1, n1, d) - toImproperRef(w2, n2, d))
              fail(`subSteps does not conserve the total for ${w1}+${n1}/${d} minus ${w2}+${n2}/${d}`);
          }
        }
      }
    }
  }

  /* ⑤ 英文的單複數助手：只有 1 不加 s。 */
  if (typeof data.plEn !== 'function') fail('the lesson has no plEn() helper, so nothing guards the English singular');
  else {
    if (data.plEn(1, 'whole bar') !== '1 whole bar')
      fail(`plEn(1, 'whole bar') is "${data.plEn(1, 'whole bar')}" — only the value 1 gets the plural wrong, and it must have no s`);
    for (const v of [0, 2, 3, 11]){
      if (data.plEn(v, 'square') !== v + ' squares')
        fail(`plEn(${v}, 'square') is "${data.plEn(v, 'square')}", independently "${v} squares"`);
    }
  }
}

/* ===================== 2. 長條圖：把純資料函式跑起來量位置 ===================== */
/* 中文字大約一個字寬 ＝ 字級，英數大約 0.55 倍。用**字典裡真的會印出來的字串**估。 */
function textHalfWidth(str, font){
  let w = 0;
  for (const ch of String(str)) w += /[　-鿿＀-￯]/.test(ch) ? font : font * 0.55;
  return w / 2;
}

function checkFigure(data, I18N, fail){
  const W = data.FIG_W, H = data.FIG_H;
  if (!(W > 0 && H > 0)) fail('the figure canvas has a non-positive size');
  /* 畫布尺寸要對得上**獨立寫死的規格**，不是只跟自己的 viewBox 一致。 */
  if (W !== FIG_W_REF) fail(`the canvas is ${W} wide, independently ${FIG_W_REF}`);
  if (H !== FIG_H_REF) fail(`the canvas is ${H} tall, independently ${FIG_H_REF}`);
  if (data.FIG_MAX_BARS !== FIG_MAX_BARS_REF)
    fail(`the lesson allows ${data.FIG_MAX_BARS} bars, independently ${FIG_MAX_BARS_REF}`);
  if (data.FIG_MIN_CELL !== FIG_MIN_CELL_REF)
    fail(`the lesson calls ${data.FIG_MIN_CELL}px the smallest readable cell, independently ${FIG_MIN_CELL_REF}px`);
  for (const [k, v] of [['FIG_X0', data.FIG_X0], ['FIG_Y', data.FIG_Y], ['FIG_BAR_W', data.FIG_BAR_W],
                        ['FIG_BAR_H', data.FIG_BAR_H], ['FIG_GAP', data.FIG_GAP],
                        ['FIG_LABEL_DY', data.FIG_LABEL_DY], ['FIG_SUM_DY', data.FIG_SUM_DY],
                        ['FIG_FONT', data.FIG_FONT], ['FIG_FONT_SUM', data.FIG_FONT_SUM]]){
    if (!num(v)) fail(`the layout constant ${k} is not a number, so every geometry check below it silently passes`);
  }

  /* viewBox 與 CSS 高度要跟著版面常數走 —— 只改常數不改 viewBox 是最容易漏的一種。 */
  const dir = path.dirname(process.argv[2]);
  const idx = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const vbs = idx.match(/<svg class="barfig"[^>]*viewBox="0 0 (\d+) (\d+)"/g) || [];
  if (!vbs.length) fail('cannot find the viewBox of any bar figure');
  vbs.forEach(tag => {
    const m = /viewBox="0 0 (\d+) (\d+)"/.exec(tag);
    if (+m[1] !== W) fail(`the svg viewBox width is ${m[1]}, but the layout constant FIG_W is ${W}`);
    if (+m[2] !== H) fail(`the svg viewBox height is ${m[2]}, but the layout constant FIG_H is ${H}`);
  });
  const figCount = (idx.match(/class="barfig"/g) || []).length;
  if (figCount !== 4) fail(`index.html draws ${figCount} bar figures, independently 4 (examples 1, 2, 3 and the game)`);
  const css = /\.barfig\{[^}]*max-width:(\d+)px;height:(\d+)px/.exec(idx);
  if (!css) fail('cannot read the .barfig CSS size');
  else {
    if (+css[1] !== W) fail(`the CSS max-width is ${css[1]}px, but FIG_W is ${W}`);
    if (+css[2] !== H) fail(`the CSS height is ${css[2]}px, but FIG_H is ${H}`);
  }

  /* barPlan 跑遍整個定義域：四個方向、每一格的寬度、塗色的格數。 */
  for (let d = DEN_MIN; d <= DEN_MAX; d++){
    const maxN = (MAX_WHOLE + 1) * d - 1;
    for (let n = 0; n <= maxN; n++){
      const plan = data.barPlan(n, d);
      const wantBars = Math.max(1, Math.ceil(n / d));
      if (plan.length !== wantBars)
        fail(`barPlan(${n}, ${d}) draws ${plan.length} bars, independently ${wantBars} — that is the number of bars`);
      if (plan.length > FIG_MAX_BARS_REF)
        fail(`barPlan(${n}, ${d}) draws ${plan.length} bars, more than the ${FIG_MAX_BARS_REF} the canvas is sized for`);
      let filled = 0, prevRight = null;
      plan.forEach((bar, i) => {
        /* 先確認每一個欄位都是數字，再做任何關聯比較。 */
        for (const k of ['x', 'y', 'w', 'h', 'd', 'fill', 'cw', 'labelX', 'labelY']){
          if (!num(bar[k])){
            fail(`barPlan(${n}, ${d}) bar ${i} has no numeric ${k}, so the geometry checks below it silently pass`);
            return;
          }
        }
        /* 每一個欄位都從 n、d 和版面常數**重新算一次**，不是拿 barPlan 自己回報的值互比。 */
        if (bar.d !== d) fail(`barPlan(${n}, ${d}) bar ${i} says its denominator is ${bar.d}`);
        if (bar.w !== data.FIG_BAR_W) fail(`barPlan(${n}, ${d}) bar ${i} is ${bar.w} wide, independently ${data.FIG_BAR_W}`);
        if (bar.h !== data.FIG_BAR_H) fail(`barPlan(${n}, ${d}) bar ${i} is ${bar.h} tall, independently ${data.FIG_BAR_H}`);
        if (bar.y !== data.FIG_Y) fail(`barPlan(${n}, ${d}) bar ${i} sits at y=${bar.y}, independently ${data.FIG_Y}`);
        const wantX = data.FIG_X0 + i * (data.FIG_BAR_W + data.FIG_GAP);
        if (Math.abs(bar.x - wantX) > 1e-9)
          fail(`barPlan(${n}, ${d}) bar ${i} sits at x=${bar.x}, independently ${wantX}`);
        const wantFill = Math.min(d, Math.max(0, n - i * d));
        if (bar.fill !== wantFill)
          fail(`barPlan(${n}, ${d}) bar ${i} shades ${bar.fill}, independently ${wantFill}`);
        const wantLabelY = data.FIG_Y + data.FIG_BAR_H + data.FIG_LABEL_DY;
        if (Math.abs(bar.labelY - wantLabelY) > 1e-9)
          fail(`barPlan(${n}, ${d}) bar ${i} label baseline is ${bar.labelY}, independently ${wantLabelY}`);
        filled += bar.fill;
        if (bar.fill < 0 || bar.fill > bar.d) fail(`barPlan(${n}, ${d}) bar ${i} shades ${bar.fill} of ${bar.d} squares`);
        if (bar.full !== (bar.fill === bar.d))
          fail(`barPlan(${n}, ${d}) bar ${i} calls itself ${bar.full ? '' : 'not '}full with ${bar.fill}/${bar.d} — a bar is full exactly when every square is shaded`);
        if (bar.x < 0) fail(`barPlan(${n}, ${d}) bar ${i} starts at x=${bar.x}, off the left edge`);
        if (bar.x + bar.w > W) fail(`barPlan(${n}, ${d}) bar ${i} reaches x=${bar.x + bar.w}, past the right edge ${W}`);
        if (bar.y < 0) fail(`barPlan(${n}, ${d}) bar ${i} starts at y=${bar.y}, past the top edge`);
        if (bar.y + bar.h > H) fail(`barPlan(${n}, ${d}) bar ${i} reaches y=${bar.y + bar.h}, past the bottom edge ${H}`);
        if (Math.abs(bar.cw * bar.d - bar.w) > 1e-9)
          fail(`barPlan(${n}, ${d}) bar ${i}: ${bar.d} cells of ${bar.cw} do not fill a bar of ${bar.w}`);
        if (bar.cw < FIG_MIN_CELL_REF)
          fail(`barPlan(${n}, ${d}) bar ${i} has cells only ${bar.cw.toFixed(2)}px wide, below the ${FIG_MIN_CELL_REF}px a child can still see — cell width`);
        if (prevRight !== null && bar.x < prevRight)
          fail(`barPlan(${n}, ${d}) bar ${i} starts at ${bar.x} before bar ${i - 1} ends at ${prevRight} — the bars overlap`);
        prevRight = bar.x + bar.w;
        const wantLabelX = bar.x + bar.w / 2;
        if (Math.abs(bar.labelX - wantLabelX) > 1e-9)
          fail(`barPlan(${n}, ${d}) bar ${i} label sits at ${bar.labelX}, not centred on its bar (${wantLabelX})`);
        if (bar.labelY <= bar.y + bar.h)
          fail(`barPlan(${n}, ${d}) bar ${i} label overlaps the bar itself — the per-bar label`);
        if (bar.labelY + data.FIG_FONT * 0.3 > H)
          fail(`barPlan(${n}, ${d}) bar ${i} label baseline ${bar.labelY} is cut off by the bottom edge ${H} — the per-bar label`);
        const lbl = bar.full ? '1' : (bar.fill + '/' + bar.d);
        const half = textHalfWidth(lbl, data.FIG_FONT);
        if (bar.labelX - half < 0 || bar.labelX + half > W)
          fail(`barPlan(${n}, ${d}) bar ${i} label "${lbl}" runs off the canvas`);
      });
      if (filled !== n)
        fail(`barPlan(${n}, ${d}) shades ${filled} squares, independently ${n} — the shaded squares add up to the numerator`);
    }
  }

  /* 底下那一行總結：置中、上下都在畫布裡，而且**兩種語言真的印出來的字**都放得下。 */
  const pt = data.figSumPoint() || {};
  if (!num(pt.x) || !num(pt.y)){
    fail('figSumPoint() does not return numbers, so every summary-line check silently passes');
    return;
  }
  if (Math.abs(pt.x - W / 2) > 1e-9) fail(`the summary line sits at x=${pt.x}, not centred (${W / 2}) — the summary line is centred`);
  if (pt.y + data.FIG_FONT_SUM * 0.3 > H)
    fail(`the summary line baseline ${pt.y} is cut off by the bottom edge ${H} — the summary line`);
  const lastLabelY = data.FIG_Y + data.FIG_BAR_H + data.FIG_LABEL_DY;
  if (pt.y - data.FIG_FONT_SUM <= lastLabelY - data.FIG_FONT * 0.3)
    fail(`the summary line at ${pt.y} collides with the per-bar labels at ${lastLabelY} — the summary line`);
  for (const lang of ['zh', 'en']){
    for (const [bars, rest] of [[0, 1], [1, 0], [1, 3], [3, 7], [2, 5]]){
      const txt = I18N[lang].figSum(I18N[lang].frac(bars * 8 + rest, 8), bars, rest);
      const half = textHalfWidth(txt, data.FIG_FONT_SUM);
      if (pt.x - half < 0 || pt.x + half > W)
        fail(`the ${lang} summary "${txt}" is about ${(half * 2).toFixed(0)}px wide and runs off the ${W}px canvas — the summary line`);
      const pp = pluralProblem(txt, lang);
      if (pp) fail(`the ${lang} figure summary ${pp}`);
    }
  }
}

/* ===================== 3. 五組範例資料 ===================== */
function checkExamples(data, I18N, fail){
  const inRange = (n, d) => d >= DEN_MIN && d <= DEN_MAX && n >= 1;

  /* 敘述要講**這一個分數**的事實。三種比較各要有自己的說法，而且不可以把
     分類條件（「一樣大或比較大」）當成對某一個分數的描述 —— 孩子看到 11 和 4
     想的是「比較大」。這是截圖看出來的，沒有任何幾何斷言抓得到。 */
  for (const lang of ['zh', 'en']){
    const cmp = I18N[lang].s1cmp;
    for (const k of ['proper', 'equal', 'bigger']){
      if (typeof cmp[k] !== 'string' || !cmp[k])
        fail(`${lang}.s1cmp has no wording for the "${k}" comparison`);
    }
    if (cmp.proper === cmp.equal || cmp.equal === cmp.bigger || cmp.proper === cmp.bigger)
      fail(`${lang}.s1cmp uses the same wording for two different comparisons`);
    if (cmp.improper !== undefined)
      fail(`${lang}.s1cmp still carries the category wording "improper" — the narration must describe this one fraction`);
    if (typeof I18N[lang].narrJoin !== 'string')
      fail(`${lang} has no narrJoin, so the two sentences of the narration are glued with a hard-coded space`);
  }
  if (I18N.zh.narrJoin !== '') fail('the Chinese narration must not put a space between its two sentences');
  if (I18N.en.narrJoin !== ' ') fail('the English narration needs a space between its two sentences');

  /* 範例 1 必須湊齊四種情形，不然「規則寫太滿」那幾格就沒有例子。 */
  const nc = data.NAME_CASES;
  if (!Array.isArray(nc) || nc.length !== 6) fail(`NAME_CASES has ${nc && nc.length} entries, independently 6`);
  let hasProper = false, hasEqual = false, hasExact = false, hasPlain = false;
  nc.forEach((c, i) => {
    if (!Object.prototype.hasOwnProperty.call(nc, i)) { fail(`NAME_CASES has a hole at index ${i}`); return; }
    if (!inRange(c.n, c.d)) fail(`NAME_CASES[${i}] = ${c.n}/${c.d} is outside this lesson's range`);
    if (kindRef(c.n, c.d) === 'proper') hasProper = true;
    if (c.n === c.d) hasEqual = true;
    else if (c.n > c.d && c.n % c.d === 0) hasExact = true;
    else if (c.n > c.d) hasPlain = true;
    if (toMixedRef(c.n, c.d).w > MAX_WHOLE)
      fail(`NAME_CASES[${i}] = ${c.n}/${c.d} needs more bars than the picture draws`);
  });
  if (!hasProper) fail('NAME_CASES has no proper fraction');
  if (!hasEqual) fail('NAME_CASES has no fraction whose numerator equals its denominator — that is the boundary the rule is written around');
  if (!hasExact) fail('NAME_CASES has no improper fraction that divides exactly, so "it comes out a whole number" has no example');
  if (!hasPlain) fail('NAME_CASES has no ordinary improper fraction');

  /* 範例 2：至少一筆整除、至少一筆除不盡。 */
  const tm = data.TOMIX_CASES;
  if (!Array.isArray(tm) || tm.length !== 4) fail(`TOMIX_CASES has ${tm && tm.length} entries, independently 4`);
  let exact = 0, inexact = 0;
  tm.forEach((c, i) => {
    if (!Object.prototype.hasOwnProperty.call(tm, i)) { fail(`TOMIX_CASES has a hole at index ${i}`); return; }
    if (!inRange(c.n, c.d)) fail(`TOMIX_CASES[${i}] = ${c.n}/${c.d} is outside this lesson's range`);
    if (kindRef(c.n, c.d) !== 'improper') fail(`TOMIX_CASES[${i}] = ${c.n}/${c.d} is not an improper fraction`);
    if (c.n % c.d === 0) exact++; else inexact++;
    if (toMixedRef(c.n, c.d).w > MAX_WHOLE) fail(`TOMIX_CASES[${i}] needs more bars than the picture draws`);
  });
  if (exact < 1) fail('TOMIX_CASES needs one that divides exactly, or "the answer is a whole number" is never shown');
  if (inexact < 1) fail('TOMIX_CASES needs one that does not divide exactly');

  /* 範例 3：每一筆的分數部分都必須是真分數。 */
  const ti = data.TOIMP_CASES;
  if (!Array.isArray(ti) || ti.length !== 4) fail(`TOIMP_CASES has ${ti && ti.length} entries, independently 4`);
  ti.forEach((c, i) => {
    if (!Object.prototype.hasOwnProperty.call(ti, i)) { fail(`TOIMP_CASES has a hole at index ${i}`); return; }
    if (!(c.w >= 1 && c.w <= MAX_WHOLE)) fail(`TOIMP_CASES[${i}] has whole part ${c.w}, outside 1~${MAX_WHOLE}`);
    if (!(c.n >= 1 && c.n < c.d)) fail(`TOIMP_CASES[${i}] = ${c.w} + ${c.n}/${c.d}: the fraction part of a mixed number must be proper`);
    if (!(c.d >= DEN_MIN && c.d <= DEN_MAX)) fail(`TOIMP_CASES[${i}] has denominator ${c.d}, outside this lesson's range`);
  });

  /* 範例 4／5：四種形狀都要有，而且兩個數的分母一定一樣。 */
  const ac = data.ADD_CASES;
  if (!Array.isArray(ac) || ac.length !== 4) fail(`ADD_CASES has ${ac && ac.length} entries, independently 4`);
  let noCarry = 0, carry = 0, noWholeIn = 0, exactWhole = 0;
  ac.forEach((c, i) => {
    if (!Object.prototype.hasOwnProperty.call(ac, i)) { fail(`ADD_CASES has a hole at index ${i}`); return; }
    if (c.a.d !== c.b.d) fail(`ADD_CASES[${i}] mixes denominators ${c.a.d} and ${c.b.d} — both addends share one denominator`);
    [c.a, c.b].forEach(x => {
      if (!int(x.w) || !int(x.n) || !int(x.d)) { fail(`ADD_CASES[${i}] has a part that is not a whole number`); return; }
      if (!(x.d >= DEN_MIN && x.d <= DEN_MAX)) fail(`ADD_CASES[${i}] has denominator ${x.d}, outside this lesson's range`);
      if (!(x.n >= 0 && x.n < x.d)) fail(`ADD_CASES[${i}] has a fraction part ${x.n}/${x.d} that is not proper`);
      if (!(x.w >= 0 && x.w <= MAX_WHOLE)) fail(`ADD_CASES[${i}] has whole part ${x.w}, outside 0~${MAX_WHOLE}`);
    });
    if (c.a.n + c.b.n >= c.a.d) carry++; else noCarry++;
    if (c.a.w === 0 && c.b.w === 0) noWholeIn++;
    const r = addRef(c.a, c.b);
    if (r.n === 0) exactWhole++;
    if (r.w > MAX_WHOLE + 1) fail(`ADD_CASES[${i}] answers with ${r.w} wholes, beyond this lesson's range`);
  });
  if (!noCarry) fail('ADD_CASES needs one that does not carry');
  if (!carry) fail('ADD_CASES needs one that carries');
  if (!noWholeIn) fail('ADD_CASES needs one with no whole-number part, so proper plus proper is shown');
  if (!exactWhole) fail('ADD_CASES needs one whose numerators fill exactly one whole, so "no fraction part" is shown');

  const sc = data.SUB_CASES;
  if (!Array.isArray(sc) || sc.length !== 4) fail(`SUB_CASES has ${sc && sc.length} entries, independently 4`);
  let noBorrow = 0, borrow = 0, zeroWhole = 0, zeroFrac = 0;
  sc.forEach((c, i) => {
    if (!Object.prototype.hasOwnProperty.call(sc, i)) { fail(`SUB_CASES has a hole at index ${i}`); return; }
    if (c.a.d !== c.b.d) fail(`SUB_CASES[${i}] mixes denominators ${c.a.d} and ${c.b.d} — both addends share one denominator`);
    [c.a, c.b].forEach(x => {
      if (!int(x.w) || !int(x.n) || !int(x.d)) { fail(`SUB_CASES[${i}] has a part that is not a whole number`); return; }
      if (!(x.d >= DEN_MIN && x.d <= DEN_MAX)) fail(`SUB_CASES[${i}] has denominator ${x.d}, outside this lesson's range`);
      if (!(x.n >= 0 && x.n < x.d)) fail(`SUB_CASES[${i}] has a fraction part ${x.n}/${x.d} that is not proper`);
      if (!(x.w >= 0 && x.w <= MAX_WHOLE + 1)) fail(`SUB_CASES[${i}] has whole part ${x.w}, outside 0~${MAX_WHOLE + 1}`);
    });
    if (toImproperRef(c.a.w, c.a.n, c.a.d) <= toImproperRef(c.b.w, c.b.n, c.b.d))
      fail(`SUB_CASES[${i}] does not have a positive answer`);
    if (c.a.n < c.b.n) borrow++; else noBorrow++;
    const r = subRef(c.a, c.b);
    if (r.w === 0) zeroWhole++;
    if (r.n === 0) zeroFrac++;
  });
  if (!noBorrow) fail('SUB_CASES needs one that does not borrow');
  if (!borrow) fail('SUB_CASES needs one that borrows');
  if (!zeroWhole) fail('SUB_CASES needs one whose whole-number part becomes 0, so "then only the fraction is written" is shown');
  if (!zeroFrac) fail('SUB_CASES needs one whose numerators cancel, so "then only the whole number is written" is shown');
}

/* ===================== 4. 遊戲的五關 ===================== */
function roundValueRef(r, o){
  if (r.kind === 'name') return null;
  if (r.kind === 'toMixed') return [o.w * r.d + o.n, r.d];
  if (r.kind === 'toImproper') return [o.n, r.d];
  return [o.w * o.d + o.n, o.d];
}
function roundAnswerRef(r){
  if (r.kind === 'name') return kindRef(r.n, r.d);
  if (r.kind === 'toMixed'){ const m = toMixedRef(r.n, r.d); return { w:m.w, n:m.n, d:r.d }; }
  if (r.kind === 'toImproper') return { n:toImproperRef(r.w, r.n, r.d), d:r.d };
  if (r.kind === 'add') return addRef(r.a, r.b);
  return subRef(r.a, r.b);
}

function checkRounds(data, I18N, fail){
  const R = data.ROUNDS;
  if (!Array.isArray(R) || R.length !== 5) fail(`the game has ${R && R.length} rounds, independently 5`);
  const kinds = R.map(r => r.kind);
  for (const k of ['name', 'toMixed', 'toImproper', 'add', 'sub']){
    if (kinds.indexOf(k) < 0) fail(`the game never asks a "${k}" round, so that part of the lesson is not practised`);
  }
  const seenAns = {};
  R.forEach((r, i) => {
    if (!Object.prototype.hasOwnProperty.call(R, i)) { fail(`ROUNDS has a hole at index ${i}`); return; }
    if (!Array.isArray(r.opts) || r.opts.length !== 4) { fail(`round ${i + 1} does not offer four options`); return; }
    if (!(num(r.ans) && r.ans >= 0 && r.ans < r.opts.length)) { fail(`round ${i + 1} has ans ${r.ans}, outside its options`); return; }
    seenAns[r.ans] = true;

    /* 每一關的輸入也要落在這一課的定義域裡 —— 只驗「自己算得對」的話，
       一個分母 9、整數 20 的關卡照樣全綠。 */
    const dens = [];
    if (r.kind === 'add' || r.kind === 'sub'){
      [r.a, r.b].forEach((x, k) => {
        if (!x || !int(x.w) || !int(x.n) || !int(x.d)){ fail(`round ${i + 1} operand ${k + 1} is not a whole-number fraction`); return; }
        dens.push(x.d);
        if (!(x.w >= 0 && x.w <= MAX_WHOLE + 1)) fail(`round ${i + 1} operand ${k + 1} has whole part ${x.w}, outside this lesson's range`);
        if (!(x.n >= 0 && x.n < x.d)) fail(`round ${i + 1} operand ${k + 1} has a fraction part ${x.n}/${x.d} that is not proper`);
      });
      if (dens.length === 2 && dens[0] !== dens[1])
        fail(`round ${i + 1} mixes denominators ${dens[0]} and ${dens[1]} — this lesson only adds and subtracts with one denominator`);
    } else if (r.kind === 'toImproper'){
      dens.push(r.d);
      if (!(int(r.w) && r.w >= 1 && r.w <= MAX_WHOLE)) fail(`round ${i + 1} has whole part ${r.w}, outside 1~${MAX_WHOLE}`);
      if (!(int(r.n) && r.n >= 1 && r.n < r.d)) fail(`round ${i + 1} has a fraction part ${r.n}/${r.d} that is not proper`);
    } else {
      dens.push(r.d);
      if (!(int(r.n) && r.n >= 1)) fail(`round ${i + 1} has no whole-number numerator`);
      /* toMixed 那一關的分數一定要是**除不盡的假分數** —— 1/5 是真分數，
         根本換不出帶分數；24/8 整除，換出來是整數。兩種都不該出現在這一關。 */
      if (r.kind === 'toMixed'){
        if (r.n < r.d)
          fail(`round ${i + 1} asks to turn ${r.n}/${r.d} into a mixed number, but it is a proper fraction`);
        else if (r.n % r.d === 0)
          fail(`round ${i + 1} asks to turn ${r.n}/${r.d} into a mixed number, but it divides exactly and comes out a whole number`);
      }
    }
    dens.forEach(dd => {
      if (!(int(dd) && dd >= DEN_MIN && dd <= DEN_MAX))
        fail(`round ${i + 1} uses denominator ${dd}, outside this lesson's ${DEN_MIN}~${DEN_MAX}`);
    });

    /* 正解由設定檔自己算，不是讀 opts[ans]。 */
    const want = roundAnswerRef(r);
    const got = data.roundAnswer(r);
    if (r.kind === 'name'){
      if (got !== want) fail(`round ${i + 1} answer is "${got}", independently "${want}"`);
      if (r.opts[r.ans] !== want) fail(`round ${i + 1}: opts[ans] is "${r.opts[r.ans]}", independently "${want}"`);
      if (r.n === r.d)
        fail(`round ${i + 1} asks about ${r.n}/${r.d}, whose value is exactly the whole number 1 — the "whole number" option would also be defensible`);
      const keys = r.opts.slice().sort().join(',');
      if (keys !== 'improper,mixed,proper,whole') fail(`round ${i + 1} does not offer the four names`);
    } else if (r.kind === 'toImproper'){
      if (got.n !== want.n || got.d !== want.d)
        fail(`round ${i + 1} answer is ${got.n}/${got.d}, independently ${want.n}/${want.d}`);
      if (r.opts[r.ans].n !== want.n)
        fail(`round ${i + 1}: opts[ans] is ${r.opts[r.ans].n}/${r.d}, independently ${want.n}/${r.d}`);
    } else {
      if (got.w !== want.w || got.n !== want.n)
        fail(`round ${i + 1} answer is ${got.w}+${got.n}, independently ${want.w}+${want.n}`);
      const o = r.opts[r.ans];
      const od = (r.kind === 'toMixed') ? r.d : o.d;
      if (o.w !== want.w || o.n !== want.n || od !== want.d)
        fail(`round ${i + 1}: opts[ans] is ${o.w}+${o.n}/${od}, independently ${want.w}+${want.n}/${want.d}`);
      if (want.n >= want.d) fail(`round ${i + 1} answers with ${want.n}/${want.d}, which is not a proper fraction`);
    }

    /* 選項依值兩兩相異 —— 這一關最容易出事的地方（沒進位和進位可能一樣大）。 */
    if (r.kind !== 'name'){
      const vals = r.opts.map(o => roundValueRef(r, o));
      if (vals.some(v => !v || !num(v[0]) || !num(v[1]))){
        fail(`round ${i + 1} has an option that cannot be valued, so the duplicate-value check did not run`);
        return;
      }
      for (let x = 0; x < vals.length; x++){
        for (let y = x + 1; y < vals.length; y++){
          if (ratCmp(vals[x][0], vals[x][1], vals[y][0], vals[y][1]) === 0)
            fail(`round ${i + 1} offers two options of the same value (${ratKey(vals[x][0], vals[x][1])})`);
        }
      }
    }

    /* 圖畫的是題目給的那一個分數（加減兩關畫第一個數），而且畫得下。 */
    const fig = data.roundFig(r) || {};
    if (!num(fig.n) || !num(fig.d)){ fail(`round ${i + 1} draws a picture with no numeric fraction`); return; }
    let wantFig;
    if (r.kind === 'name' || r.kind === 'toMixed') wantFig = { n:r.n, d:r.d };
    else if (r.kind === 'toImproper') wantFig = { n:toImproperRef(r.w, r.n, r.d), d:r.d };
    else wantFig = { n:toImproperRef(r.a.w, r.a.n, r.a.d), d:r.a.d };
    if (fig.n !== wantFig.n || fig.d !== wantFig.d)
      fail(`round ${i + 1} draws ${fig.n}/${fig.d}, independently ${wantFig.n}/${wantFig.d} — the picture shows the first number of the question`);
    if (Math.ceil(fig.n / fig.d) > FIG_MAX_BARS_REF)
      fail(`round ${i + 1} draws ${fig.n}/${fig.d}, which needs more bars than the canvas holds`);
  });
  if (Object.keys(seenAns).length < 3)
    fail(`the five rounds put their answers in only ${Object.keys(seenAns).length} different positions — the game answers are spread across the options`);
}

/* ===================== 5. 三層題庫與四頁的措辭 ===================== */
/* 題庫神諭：從**題幹印出來的數字**重算，不是拿設定檔自己的常數算。 */
const BANK_EXPECTED = {
  qs: [
    { nums:[], ans:'3/8', enAns:'3/8',
      opts:['5/5', '3/8', '9/4', '4/3'], enOpts:['5/5', '3/8', '9/4', '4/3'] },
    { nums:[5, 5], ans:'假分數', enAns:'an improper fraction' },
    { nums:[17, 5], ans:'3 又 2/5', enAns:'3 2/5', why:['17 ÷ 5 ＝ 3 餘 2'] },
    { nums:[2, 3, 4], ans:'11/4', enAns:'11/4', why:['2 × 4 ＝ 8', '8 ＋ 3 ＝ 11'] },
    { nums:[1, 2, 7, 2, 3, 7], ans:'3 又 5/7', enAns:'3 5/7', why:['2 ＋ 3 ＝ 5'] },
    { nums:[3, 1, 5, 1, 3, 5], ans:'1 又 3/5', enAns:'1 3/5', why:['1 ＋ 5 ＝ 6', '6 － 3 ＝ 3'] }
  ],
  qsAdv: [
    { nums:[9, 4, 9, 4], ans:'2 又 1/4 公尺', enAns:'2 1/4 metres', why:['9 ÷ 4 ＝ 2 餘 1'] },
    { nums:[3, 8, 7, 8], ans:'1 又 2/8 公升', enAns:'1 2/8 litres', why:['3 ＋ 7 ＝ 10', '10 － 8 ＝ 2'] },
    { nums:[4, 1, 6, 1, 5, 6], ans:'2 又 2/6 公升', enAns:'2 2/6 litres', why:['1 ＋ 6 ＝ 7', '7 － 5 ＝ 2'] },
    { nums:[8, 24, 8], ans:'3 個', enAns:'3 cakes', why:['24 ÷ 8 ＝ 3 餘 0'] }
  ],
  qsBoost: [
    { nums:[], ans:null, enAns:null },
    { nums:[2, 3, 5, 2, 3, 5, 2, 3, 5], ans:'13/5', enAns:'13/5', why:['2 × 5 ＝ 10', '10 ＋ 3 ＝ 13'] }
  ]
};

/* 四頁一起講的規則。改一頁不改另一頁，就會有兩套說法。
   中文字串在 markup 與字典各有一份，所以比**出現次數**而不是「有沒有出現」。 */
const SIBLING_RULES = [
  { file:'index', text:'等於 1 或比 1 大', min:3, why:'says an improper fraction is 1 or more, never "always more than 1"' },
  { file:'reference', text:'等於 1 或比 1 大', min:4, why:'says an improper fraction is 1 or more, never "always more than 1"' },
  { file:'index', text:'這一課不做約分', min:2, why:'says this lesson does not simplify' },
  { file:'reference', text:'不做約分', min:4, why:'says this lesson does not simplify' },
  { file:'index', text:'分母分之分母', min:5, why:'says the borrowed 1 becomes denominator over denominator' },
  { file:'reference', text:'分母分之分母', min:2, why:'says the borrowed 1 becomes denominator over denominator' },
  { file:'parents', text:'5/5', min:12, why:'tells parents about the equal-numerator case' },
  { file:'index', text:'沒有分數部分', min:9, why:'says dividing exactly gives a whole number, not a mixed number' },
  { file:'reference', text:'後面不寫分數', min:4, why:'says dividing exactly gives a whole number' },
  { file:'reference', text:'都不動', min:2, why:'says the denominator never moves' },
  { file:'index', text:'分母完全不動', min:5, why:'says the denominator never moves' },
  { file:'parents', text:'假分數不是錯誤，是正式的寫法', min:2, why:'tells parents an improper fraction is not an error' },
  { file:'parents', text:'約分是五年級才教的', min:2, why:'tells parents not to simplify ahead of grade 5' },
  { file:'parents', text:'變身工廠闖關', min:2, why:'names the game in the mastery standard' },
  { file:'parents', text:'已經借過 60 分和 24 小時', min:2, why:'says which borrowing the child has already met (the grade-4 time lesson), instead of claiming this is the first' }
];

function stripComments(html){
  return String(html).replace(/<!--[\s\S]*?-->/g, '');
}

function checkBankAndSiblings(data, I18N, fail){
  /* 題庫：三層的張數、zh/en 的 ans 一致、答案不全押同一個位置、算術重算。 */
  for (const lang of ['zh', 'en']){
    const dict = I18N[lang];
    for (const [name, want] of [['qs', 6], ['qsAdv', 4], ['qsBoost', 2]]){
      if (!Array.isArray(dict[name]) || dict[name].length !== want)
        fail(`${lang}.${name} has ${dict[name] && dict[name].length} questions, independently ${want}`);
    }
  }
  for (const name of ['qs', 'qsAdv', 'qsBoost']){
    const zh = I18N.zh[name], en = I18N.en[name];
    const exp = BANK_EXPECTED[name];
    if (!Array.isArray(zh) || !Array.isArray(en)) continue;
    if (!exp || exp.length !== zh.length) { fail(`no oracle for every question of ${name}`); continue; }
    zh.forEach((q, i) => {
      if (!num(q.ans) || !num(en[i].ans))
        fail(`${name}[${i}] has no numeric answer index, so every answer check below it silently passes`);
      if (q.ans !== en[i].ans) fail(`${name}[${i}]: the Chinese answer index ${q.ans} and the English one ${en[i].ans} disagree`);
      if (q.opts.length !== 4 || en[i].opts.length !== 4) fail(`${name}[${i}] does not offer four options`);
      const e = exp[i];
      if (e.ans !== null && q.opts[q.ans] !== e.ans)
        fail(`${name}[${i}] zh answer is "${q.opts[q.ans]}", independently "${e.ans}"`);
      if (e.enAns !== null && en[i].opts[en[i].ans] !== e.enAns)
        fail(`${name}[${i}] en answer is "${en[i].opts[en[i].ans]}", independently "${e.enAns}"`);
      /* 「下面哪一個是…」這種題目的數字全在選項裡，所以整組選項要逐字比對。 */
      if (e.opts && q.opts.join('|') !== e.opts.join('|'))
        fail(`${name}[${i}] zh offers [${q.opts}], independently [${e.opts}] — the options this question offers`);
      if (e.enOpts && en[i].opts.join('|') !== e.enOpts.join('|'))
        fail(`${name}[${i}] en offers [${en[i].opts}], independently [${e.enOpts}] — the options this question offers`);
      /* 題幹印出來的數字要**剛好**是這一組，而且**順序**也要一樣 ——
         排序之後比對的話，把減法的兩個運算元對調照樣過關。
         中英文題幹都要比：只比中文的話，英文題幹改成 18/5 卻留著舊答案不會有人發現。 */
      if (e.nums.length){
        const gotZh = numTokens(stripTags(q.stem));
        if (gotZh.join(',') !== e.nums.join(','))
          fail(`${name}[${i}] zh stem prints the numbers [${gotZh}], independently [${e.nums}] — the numbers the stem prints, in order`);
        const gotEn = numTokens(stripTags(en[i].stem));
        if (gotEn.join(',') !== e.nums.join(','))
          fail(`${name}[${i}] en stem prints the numbers [${gotEn}], independently [${e.nums}] — the numbers the stem prints, in order`);
      }
      (e.why || []).forEach(expr => {
        if (stripTags(q.why).indexOf(expr) < 0)
          fail(`${name}[${i}] why does not show "${expr}", so the working is unchecked`);
      });
      for (const t of [stripTags(en[i].stem), stripTags(en[i].why)].concat(en[i].opts)){
        const pp = pluralProblem(t, 'en');
        if (pp) fail(`${name}[${i}] en ${pp}`);
      }
    });
    const spread = {};
    zh.forEach(q => { spread[q.ans] = true; });
    if (name === 'qs' && Object.keys(spread).length < 3)
      fail(`${name} puts its answers in only ${Object.keys(spread).length} different positions`);
  }

  /* 四頁的措辭。⚠️ 一定要用 process.argv[2] 推路徑：__dirname 會讀到真的 repo，
     改壞測試複製出來的那一份永遠不會被看到，斷言就變成永遠是綠的。 */
  const dir = path.dirname(process.argv[2]);
  const SRC = {};
  for (const f of ['index', 'reference', 'parents', 'review']){
    const p = path.join(dir, f + '.html');
    if (!fs.existsSync(p)) { fail(`${f}.html is missing, so its rules were never checked`); continue; }
    SRC[f] = stripComments(fs.readFileSync(p, 'utf8'));
  }
  SIBLING_RULES.forEach(rule => {
    const src = SRC[rule.file];
    if (src === undefined) return;
    let count = 0, at = -1;
    while ((at = src.indexOf(rule.text, at + 1)) >= 0) count++;
    if (count < rule.min)
      fail(`${rule.file}.html mentions "${rule.text}" ${count} time(s), independently at least ${rule.min} — it ${rule.why}`);
  });

  /* 產生器清單：改名（或刪掉）一整支，它那一組不變條件會靜靜消失。 */
  const rv = SRC['review'];
  if (rv !== undefined){
    const found = [];
    rv.split('\n').forEach(line => {
      const m = /^\s*\{ id:'([A-Za-z0-9_]+)',/.exec(line);
      if (m) found.push(m[1]);
    });
    GEN_IDS.forEach(id => {
      if (found.indexOf(id) < 0) fail(`review.html no longer declares the generator "${id}" — this config describes 12 generators`);
    });
    found.forEach(id => {
      if (GEN_IDS.indexOf(id) < 0) fail(`review.html declares an extra generator "${id}" — this config describes 12 generators`);
    });
    if (found.length !== GEN_IDS.length)
      fail(`review.html declares ${found.length} generators, but this config describes 12 generators`);
    const makes = (rv.match(/\n\s*make:function\(/g) || []).length;
    const fmts = (rv.match(/\n\s*fmt:function\(/g) || []).length;
    if (makes !== GEN_IDS.length) fail(`review.html has ${makes} make() functions, but this config describes 12 generators — an id on its own is not a generator`);
    if (fmts !== GEN_IDS.length) fail(`review.html has ${fmts} fmt() functions, but this config describes 12 generators`);
    /* 每一支 make() 都要真的抽樣：寫死一組合法參數，所有斷言還是綠的。 */
    const blocks = rv.split(/\n\s*\{ id:'/).slice(1);
    blocks.forEach(b => {
      const id = /^([A-Za-z0-9_]+)'/.exec(b);
      if (!id) return;
      /* ⚠️ 先把註解拿掉：`/* pick( *\/` 這種註解會讓這一條永遠是綠的。 */
      const body = b.split(/\n\s*fmt:function/)[0]
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
      if (!/pick\(|pickUnused\(/.test(body))
        fail(`the generator "${id[1]}" never calls pick()/pickUnused(), so it must actually sample its parameters`);
    });
    /* 參數池逐行釘住 —— 池變寬了，選項的範圍檢查就跟著失去意義。 */
    const POOLS = [
      ['  var DEN_POOL   = rangeList(DEN_MIN, DEN_MAX);', 'DEN_POOL'],
      ['  var WHOLE_POOL = rangeList(1, 3);', 'WHOLE_POOL'],
      ['  var QUOT_POOL  = rangeList(2, 3);', 'QUOT_POOL'],
      ['  var BIGW_POOL  = rangeList(2, WHOLE_MAX);', 'BIGW_POOL'],
      ['  var DEN_MIN = 3;', 'DEN_MIN'],
      ['  var DEN_MAX = 8;', 'DEN_MAX'],
      ['  var WHOLE_MAX = 4;', 'WHOLE_MAX']
    ];
    POOLS.forEach(([line, name]) => {
      if (rv.indexOf(line) < 0)
        fail(`review.html no longer declares ${name} the way this config's declared pools expect ("${line.trim()}")`);
    });
  }
}
