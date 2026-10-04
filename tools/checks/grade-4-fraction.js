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
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');
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
    { file:'index', expect:'draws 2 bar figures', via:'index',
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
      replace:"      frac:function(n, d){ return (n < 10 ? '0' : '') + n + '/' + d; },\n      mixed:function(w, n, d){\n        if (w > 0 && n > 0) return w + ' 又 ' + n + '/' + d;" },
    /* ---------- index.html：小遊戲「變身工廠闖關」五關五種玩法（2026-10-04） ---------- */
    { file:'index', expect:"cardKind says", via:'index',
      find:"function cardKind(c){ return c[0] > 0 ? 'mixed' : (c[1] < c[2] ? 'proper' : 'improper'); }",
      replace:"function cardKind(c){ return c[0] > 0 ? 'mixed' : (c[1] <= c[2] ? 'proper' : 'improper'); }" },
    { file:'index', expect:"which is not the reason", via:'index',
      find:"return c[1] === c[2] ? d.gKindEq(fr, c[1]) : d.gKindBig(fr, c[1], c[2]);",
      replace:"return c[1] !== c[2] ? d.gKindEq(fr, c[1]) : d.gKindBig(fr, c[1], c[2]);" },
    { file:'index', expect:"has no card with numerator = denominator", via:'index',
      find:"    [[0, 3, 5], [0, 5, 5], [0, 7, 5], [1, 2, 5], [2, 1, 4]],",
      replace:"    [[0, 3, 5], [0, 4, 5], [0, 7, 5], [1, 2, 5], [2, 1, 4]]," },
    { file:'index', expect:"improper cards but a basket holds 2", via:'index',
      find:"    [[0, 3, 5], [0, 5, 5], [0, 7, 5], [1, 2, 5], [2, 1, 4]],",
      replace:"    [[0, 3, 5], [0, 5, 5], [0, 7, 5], [1, 2, 5], [0, 9, 4]]," },
    { file:'index', expect:"but a basket holds 1", via:'index',
      find:"KIND_CAP = 2;",
      replace:"KIND_CAP = 1;" },
    { file:'index', expect:"packTry(", via:'index',
      find:"function packTry(rem, d){ return rem >= d ? 'pack'",
      replace:"function packTry(rem, d){ return rem > d ? 'pack'" },
    { file:'index', expect:"bar places", via:'index',
      find:"{ n:19, d:8 }, { n:14, d:5 } ];",
      replace:"{ n:19, d:8 }, { n:21, d:5 } ];" },
    { file:'index', expect:"is not bigger than 1", via:'index',
      find:"  var GAME_PACK = [ { n:7, d:5 },",
      replace:"  var GAME_PACK = [ { n:3, d:5 }," },
    { file:'index', expect:"a row of d is already a whole bar", via:'index',
      find:"function packPer(d){ return Math.floor((PACK_PILE.w - 8 + PACK_PILE.gap) / (packCell(d) + PACK_PILE.gap)); }",
      replace:"function packPer(d){ return d; }" },
    { file:'index', expect:"a pile square is", via:'index',
      find:"function packCell(d){ return PACK_BAR.w / d; }",
      replace:"function packCell(d){ return 22; }" },
    { file:'index', expect:"the tray starts in the answer order", via:'index',
      find:"    if (t[2] === e.n){ var x = t[1]; t[1] = t[2]; t[2] = x; }\n",
      replace:"" },
    { file:'index', expect:"impSlotOk(add", via:'index',
      find:"function impSlotOk(e, slot, v){ return slot === 'add' ? v === e.n :",
      replace:"function impSlotOk(e, slot, v){ return slot === 'add' ? true :" },
    { file:'index', expect:"impAnswer is", via:'index',
      find:"function impAnswer(e){ return e.w * e.d + e.n; }",
      replace:"function impAnswer(e){ return e.w * e.n + e.d; }" },
    { file:'index', expect:"are not all different", via:'index',
      find:"{ w:2, n:1, d:3 }, { w:1, n:3, d:4 } ];",
      replace:"{ w:2, n:2, d:3 }, { w:1, n:3, d:4 } ];" },
    { file:'index', expect:"addCount(", via:'index',
      find:"    var N = e.a.n + (s.strip ? e.b.n : 0) - (s.carried ? e.d : 0);",
      replace:"    var N = e.a.n + (s.strip ? e.b.n : 0) - (s.carried ? e.d - 1 : 0);" },
    { file:'index', expect:"is {\"W\":1,\"N\":3}, independently {\"W\":3", via:'index',
      find:"    var W = e.a.w + (s.token ? e.b.w : 0) + (s.carried ? 1 : 0);",
      replace:"    var W = e.a.w + (s.carried ? 1 : 0);" },
    { file:'index', expect:"but the whole-bar zone holds", via:'index',
      find:"    { d:6, a:{ w:2, n:5 }, b:{ w:1, n:1 } },",
      replace:"    { d:6, a:{ w:3, n:5 }, b:{ w:1, n:1 } }," },
    { file:'index', expect:"fill exactly one bar", via:'index',
      find:"    { d:6, a:{ w:2, n:5 }, b:{ w:1, n:1 } },",
      replace:"    { d:6, a:{ w:2, n:4 }, b:{ w:1, n:1 } }," },
    { file:'index', expect:"carrying 1 is skipped", via:'index',
      find:"        if (c.N >= D){ roundMiss(d.gAddCarry(D)); return; }\n",
      replace:"" },
    { file:'index', expect:"loose squares dropped on the whole bars", via:'index',
      find:"          if (z === Z.wh){ roundMiss(d.gAddPartToWhole(e.b.n, D)); return false; }\n",
      replace:"" },
    { file:'index', expect:"subCanBorrow(", via:'index',
      find:"function subCanBorrow(e, s){ return !s.borrowed && !s.ate && e.a.n < e.b.n; }",
      replace:"function subCanBorrow(e, s){ return !s.borrowed && !s.ate; }" },
    { file:'index', expect:"subCount(", via:'index',
      find:"function subCells(e, s){ return e.a.n + (s.borrowed ? e.d : 0)",
      replace:"function subCells(e, s){ return e.a.n + (s.borrowed ? e.d - 1 : 0)" },
    { file:'index', expect:"has none without whole bars to eat", via:'index',
      find:"    { d:6, a:{ w:3, n:2 }, b:{ w:0, n:4 } }",
      replace:"    { d:6, a:{ w:3, n:2 }, b:{ w:1, n:4 } }" },
    { file:'index', expect:"the round finishes before everything is eaten", via:'index',
      find:"        if (s.ate && (!token || s.token)){",
      replace:"        if (s.ate){" },
    { file:'index', expect:"borrowing when it is not needed", via:'index',
      find:"            roundMiss(d.gSubNoNeed(subCells(e, s), e.b.n)); return false;",
      replace:"            return false;" },
    { file:'index', expect:"no board-generation guard", via:'index',
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
      replace:"" },
    { file:'index', expect:"shown although nothing was taken", via:'index',
      find:"    var lost = gScore >= 5 ? 5 : 0;",
      replace:"    var lost = 5;" },
    { file:'index', expect:"nearestOpen():", via:'index',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (dc < bc){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"go to the farther one", via:'index',
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }" },
    { file:'index', expect:"renders its options without shuffle", via:'index',
      find:"function layTray(items, mk){ shuffle(items).forEach(mk); }",
      replace:"function layTray(items, mk){ items.forEach(mk); }" },
    { file:'index', expect:"+20 with no mistakes and +10", via:'index',
      find:"    var pts = gMistake ? 10 : 20;",
      replace:"    var pts = 20;" },
    { file:'index', expect:"a fraction card (80×40)", via:'index',
      find:"var KIND_CARD = { w:80, h:60 }",
      replace:"var KIND_CARD = { w:80, h:40 }" },
    { file:'index', expect:"the full loose bar you carry", via:'index',
      find:"LOOSE = { ys:[211, 251], h:30, pick:48 };",
      replace:"LOOSE = { ys:[211, 251], h:30, pick:30 };" },
    { file:'index', expect:"gImpForgot en", via:'index',
      find:"gImpForgot: function(prod, n){ return prod + ' only counts",
      replace:"gImpForgot: function(prod, n){ return n + ' only counts" },
    { file:'index', expect:"does not say “exactly”", via:'index',
      find:"(rem === d ? '剛好' : '比')",
      replace:"'比'" },
    { file:'index', expect:"gSubShort zh", via:'index',
      find:"gSubShort: function(c, n){ return '零散的只有 ' + c + ' 格，不夠吃 ' + n + ' 格",
      replace:"gSubShort: function(c, n){ return '零散的只有 ' + n + ' 格，不夠吃 ' + c + ' 格" },
    { file:'index', expect:"kind: tray places", via:'index',
      find:"{ x:101, y:306 }, { x:199, y:306 } ];",
      replace:"{ x:101, y:306 }, { x:150, y:306 } ];" },
    { file:'index', expect:"is read as a number", via:'index',
      find:"function canon(s){ s = s.trim(); return /^(0|[1-9]\\d*)$/.test(s) ? +s : null; }",
      replace:"function canon(s){ s = s.replace(/\\s/g, ''); return /^\\d+$/.test(s) ? +s : null; }" },
    { file:'index', expect:"in proper en: numbers should read 5,5,5", via:'index',
      find:"gKindEq: function(fr, n){ return fr + ': the numerator and the denominator are both ' + n +",
      replace:"gKindEq: function(fr, n){ return fr + ': the numerator and the denominator are both ' + (n + 1) +" },
    { file:'index', expect:"without the plural s", via:'index',
      find:"gSubStrip: function(n){ return 'Eat ' + plEn(n, 'square'); },",
      replace:"gSubStrip: function(n){ return 'Eat ' + n + ' square'; }," },
    { file:'index', expect:"can become a mixed number, but it divides exactly", via:'index',
      find:"        return q !== null ? fr + ' 前面沒有整數 —— 它除得剛剛好，換出來是整數 ' + q + '，不是帶分數；寫成 ' + fr + ' 的時候叫假分數。'",
      replace:"        return false ? fr + ' 前面沒有整數 —— 它除得剛剛好，換出來是整數 ' + q + '，不是帶分數；寫成 ' + fr + ' 的時候叫假分數。'" },
    { file:'index', expect:"the bar changes size when it is carried", via:'index',
      find:"WROW = { dy:30, step:34, h:30 }",
      replace:"WROW = { dy:30, step:34, h:26 }" },
    { file:'index', expect:"the squares change size when they are packed", via:'index',
      find:"sqH:30, gap:4, pad:10 };",
      replace:"sqH:24, gap:4, pad:10 };" },
    { file:'index', expect:"the squares to add are not drawn as tall", via:'index',
      find:"strip.el.appendChild(barSVG(e.b.n * cw, LOOSE.h, e.b.n, fill(e.b.n, 'o')));",
      replace:"strip.el.appendChild(barSVG(e.b.n * cw, ADD_STRIP.h, e.b.n, fill(e.b.n, 'o')));" },
    { file:'index', expect:"label is not inside the basket", via:'index',
      find:"var KIND_BIN = { xs:[52, 150, 248], y:4, w:92, h:180, pad:8 }",
      replace:"var KIND_BIN = { xs:[52, 150, 248], y:34, w:92, h:150, pad:8 }" },
    { file:'index', expect:"the loose bar covers the “loose squares” label", via:'index',
      find:"ADD_PT = { x:10, y:178, w:280, h:110 }",
      replace:"ADD_PT = { x:10, y:204, w:280, h:84 }" },
    { file:'index', expect:"whole bars do not fit in the whole-bar zone", via:'index',
      find:"SUB_WH = { x:10, y:4, w:280, h:182 }",
      replace:"SUB_WH = { x:10, y:30, w:280, h:156 }" },
    { file:'index', expect:"the two zones’ drop pads overlap", via:'index',
      find:"ADD_PAD = 3, ZLBL",
      replace:"ADD_PAD = 4, ZLBL" },
    { file:'index', expect:"twoZones() does not draw the two labels inside", via:'index',
      find:"    addZone(B, PT.x + ZLBL.dx, PT.y + ZLBL.dy, PT.w - 2 * ZLBL.dx, ZLBL.h, 'glbl gleft', d.gPartLbl);",
      replace:"    addZone(B, PT.x, PT.y - 26, PT.w, 22, 'glbl gleft', d.gPartLbl);" },
    { file:'index', expect:"is not a plain selection switch", via:'index',
      find:"        if (token && B.selected === token && P.data.whole){ B.onPointTap(token, { x:P.cx, y:P.cy }); return; }",
      replace:"        if (B.selected && B.selected !== P && !B.selected.data.whole && P.data.whole){ B.onPointTap(B.selected, { x:P.cx, y:P.cy }); return; }" },
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
                'GPICK, GAME_ORDER, shuffle, ' +
                'ZLBL, KIND_H, KIND_BINS, KIND_BIN, KIND_LBL, KIND_CAP, KIND_CARD, KIND_SPOT, KIND_TRAY, GAME_KIND, cardKind, kindWhy, ' +
                'PACK_H, PACK_BAR, PACK_PILE, PACK_FRAME, GAME_PACK, packTry, packCell, packPer, ' +
                'IMP_H, IMP_BAR, IMP_SLOT, IMP_CARD, IMP_TRAY, GAME_IMP, impTray, impSlotOk, impAnswer, ' +
                'ADD_H, ADD_WH, ADD_PT, ADD_PAD, WROW, LOOSE, ADD_TOKEN, ADD_STRIP, GAME_ADD, addCount, ' +
                'SUB_H, SUB_WH, SUB_PT, SUB_ROWS, SUB_PAD, SUB_TOKEN, SUB_STRIP, SUB_WHOLE, GAME_SUB, subCanBorrow, subCells, subCount}',
    optionValueMax: 40,

    check: function(data, I18N, fail, src){
      checkCore(data, I18N, fail);
      checkFigure(data, I18N, fail);
      checkExamples(data, I18N, fail);
      checkGame(data, I18N, fail, src);
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
  if (figCount !== 3) fail(`index.html draws ${figCount} bar figures, independently 3 (examples 1, 2 and 3; the game draws its own bars)`);
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

/* ===================== 4. 小遊戲「變身工廠闖關」：五關五種玩法（§六之五） =====================
   題庫與版面常數在課程 i18n 前面的資料區，由 dataReturn 交給這裡。每一關：
   - 用**自己的算法**重算答案（不呼叫課程的 cardKind／impAnswer／addCount／subCount 來驗它們自己），
   - **照遊戲的規則把每一題的每一種做法都走一遍**（第 4、5 關是所有動作順序），證明一定做得完、做完一定是對的，
     而且每一個被擋下來的動作，擋下來的那一句理由在那個狀態下真的成立，
   - 每一句說明逐個比數字（兩種語言）、英文的 1 不可以是複數，
   - 版面與觸控尺寸從課程的常數讀（375px 手機上 ≥ 44px）。
   nearestOpen()、roundMiss() 從原始碼切出來真的跑；RENDER 裡切不出來的幾條關鍵規則用原始碼形狀守住（need()）。
   已知極限：RENDER 本體是字面掃描（證明那一行寫著，證明不了它被執行）；拖拉、點選、兩根手指、capture 遺失、
   重新開始時還拿在手上的積木、375px 的實際尺寸，由 teaching-workspace/game-harness/g4-fraction 的端對端測試驗。 */
const GAME_TYPES = ['kind', 'pack', 'imp', 'add', 'sub'];
const nums = t => (String(t).match(/\d+/g) || []).map(Number);
function mixD(w, n, d){ return w > 0 && n > 0 ? [w, n, d] : w > 0 ? [w] : n > 0 ? [n, d] : [0]; }
/* 句子裡每一條「a × b ＝ c」「a ＋ b ＝ c」「a − b ＝ c」逐條重算 */
function badEquations(text){
  const out = [], re = /(\d+)\s*([×+＋−－])\s*(\d+)\s*[=＝]\s*(\d+)(?!\s*\/|\d)/g;
  let m;
  while ((m = re.exec(String(text)))){
    const a = +m[1], b = +m[3], c = +m[4], op = m[2];
    const v = op === '×' ? a * b : (op === '+' || op === '＋') ? a + b : a - b;
    if (v !== c) out.push(m[0]);
  }
  return out;
}
const GAME_EN_NOUNS = ['loose square', 'whole bar', 'square', 'bar', 'card'];
function gamePlural(txt){
  for (const w of GAME_EN_NOUNS){
    if (new RegExp('\\b1 ' + w + 's\\b').test(txt)) return 'prints "1 ' + w + 's"';
    const m = new RegExp('(^|[^/\\d])(\\d+) ' + w + '\\b').exec(txt);
    if (m && +m[2] !== 1) return 'prints "' + m[2] + ' ' + w + '" without the plural s';
  }
  return null;
}

function checkGame(data, I18N, fail, src){
  const D = data, LANGS = ['zh', 'en'], W = 300;
  if (typeof src !== 'string' || !src) { fail('checkGame got no index.html source'); return; }
  /* --- 每一句說明：數字照順序逐個比，句子裡的整數算式都要算得對，英文的 1 不可以是複數 --- */
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
    badEquations(text).forEach(e => fail(where + ': "' + e + '" is wrong arithmetic'));
    const pp = gamePlural(text); if (pp && /[a-z]/.test(text)) fail(where + ': ' + pp + ' — ' + text);
  };
  const has = (where, text, re, what) => { if (!re.test(String(text))) fail(where + ': ' + what + ' — ' + text); };

  /* ---------- 0. 五關的順序、RENDER、題目與提示 ---------- */
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== GAME_TYPES.join())
    fail('GAME_ORDER should be ' + GAME_TYPES.join() + ' (the order of the five examples), got ' + (D.GAME_ORDER || []).join());
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  GAME_TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
      else badEquations(I18N[L].gHints[t]).forEach(e => fail('gHints.' + t + ' ' + L + ': "' + e + '" is wrong arithmetic'));
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const needSrc = (re, what) => { if (!re.test(src)) fail(what); };
  ['GAME_KIND', 'GAME_PACK', 'GAME_IMP', 'GAME_ADD', 'GAME_SUB'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 2) fail(k + ' should be a pool of at least 2 entries (pick() of an empty pool crashes the round)');
  });

  /* ---------- 1. 托盤一律洗牌；重建畫板時還拿在手上的舊積木不可以作用在新畫板；超前模式自動給第一層提示 ---------- */
  gameShuffleProblems(src, 1, { roundFn:'layTray' }).forEach(fail);
  need('kind', /layTray\(set, function\(c, i\)\{/, 'the cards are not laid out through layTray() (shuffled)');
  need('imp', /var tray = impTray\(e\)/, 'the number cards are not laid out through impTray()');
  needSrc(/if \(gen !== gGen\) return;   \/\* 這一塊屬於已經拿掉的畫板 \*\//, 'a piece released after the board was rebuilt still acts (no board-generation guard in addPiece end())');
  needSrc(/if \(P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/, 'a piece of an old board can still be picked up (no generation check on pointerdown)');
  needSrc(/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/, 'startRound() does not start a new board generation');
  needSrc(/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode does not show hint level 1 automatically');
  needSrc(/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'a lost pointer capture does not put the piece back');
  needSrc(/if \(!start \|\| e\.pointerId !== pid\) return;/, 'a second finger is not ignored');

  /* ---------- 2. 計分：+20 ／ +10，放錯 −5 最低 0（§三 中年級） ---------- */
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
    seq('gPts ' + L, I18N[L].gPts(20), [20]);
    seq('gMinus ' + L, I18N[L].gMinus, [5]);
    if (nums(I18N[L].gWin(85)).indexOf(85) < 0) fail('gWin ' + L + ' does not show the score: ' + I18N[L].gWin(85));
    if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
  });

  /* ---------- 3. nearestOpen()：從原始碼切出來真的跑 ---------- */
  let nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
  }
  const box = (id, cx, cy, w, h) => ({ id, cx, cy, hw:w / 2, hh:h / 2, done:false });
  if (nearestOpen){
    const K = D.KIND_BIN, S = D.IMP_SLOT;
    const bins = K.xs.map((x, i) => box(i, x, K.y + K.h / 2, K.w, K.h));
    const slots = S.xs.map((x, i) => box(i, x, S.y, S.size, S.size));
    [[bins, K.pad, 'basket'], [slots, S.pad, 'number box']].forEach(([list, pad, what]) => {
      let bad = 0;
      list.forEach(b => { for (let x = b.cx - b.hw + 0.5; x < b.cx + b.hw; x += 2) for (let y = b.cy - b.hh + 0.5; y < b.cy + b.hh; y += 3){ const g = nearestOpen(list, { x, y }, pad); if (!g || g.id !== b.id) bad++; } });
      if (bad) fail('nearestOpen(): ' + bad + ' points inside a ' + what + ' are given to another one (or none)');
      /* 兩格之間放寬之後重疊的地方：一律判給比較近的那一格（不可以是陣列裡的第一個、也不可以量到中心） */
      for (let i = 0; i + 1 < list.length; i++){
        const a = list[i], b = list[i + 1], gl = a.cx + a.hw, gr = b.cx - b.hw;
        if (gr - gl >= 2 * pad) continue;
        let wrong = 0, seen = 0;
        for (let x = gl + 0.25; x < gr; x += 0.5){
          const g = nearestOpen(list, { x, y:b.cy }, pad), want = (x - gl) < (gr - x) ? a : (x - gl) > (gr - x) ? b : null;
          if (!want) continue;
          seen++; if (!g || g.id !== want.id) wrong++;
        }
        if (!seen) fail('nearestOpen(): no probe between ' + what + 'es ' + i + ' and ' + (i + 1));
        if (wrong) fail('nearestOpen(): ' + wrong + ' points between ' + what + 'es ' + i + ' and ' + (i + 1) + ' go to the farther one');
      }
    });
    const two = [ box(0, 100, 100, 84, 84), box(1, 155, 100, 24, 24) ];
    const r0 = nearestOpen(two, { x:140, y:100 }, 6);
    if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
    const done = [ Object.assign(box(0, 100, 100, 44, 44), { done:true }), box(1, 148, 100, 44, 44) ];
    if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
    if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
  }

  /* ---------- 4. 版面與觸控（375px 手機：卡片內寬約 290px，300 寬的畫板縮成 0.967 倍） ---------- */
  const scale = Math.min(1.5, 290 / W);
  const tooSmall = (what, sz) => { if (!(num(sz) && sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board'); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const rc = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w, h });
  const grow = (o, p) => ({ x:o.x - p, y:o.y - p, w:o.w + 2 * p, h:o.h + 2 * p });
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) fail(what + ' ' + i + ' and ' + j + ' overlap'); };
  tooSmall('GPICK ' + D.GPICK, D.GPICK);
  tooSmall('a fraction card (' + D.KIND_CARD.w + '×' + D.KIND_CARD.h + ')', Math.min(D.KIND_CARD.w, D.KIND_CARD.h));
  tooSmall('the whole-bar frame', Math.min(D.PACK_FRAME.w, D.PACK_FRAME.h));
  tooSmall('a number card (' + D.IMP_CARD + ')', D.IMP_CARD);
  tooSmall('the “+ bars” token', Math.min(D.ADD_TOKEN.w, D.ADD_TOKEN.h));
  tooSmall('the strip of squares to add (height)', D.ADD_STRIP.h);
  tooSmall('the full loose bar you carry (pick height)', D.LOOSE.pick);
  tooSmall('the “eat bars” token', Math.min(D.SUB_TOKEN.w, D.SUB_TOKEN.h));
  tooSmall('the strip of squares to eat (height)', D.SUB_STRIP.h);
  tooSmall('a whole bar you borrow (height)', D.SUB_WHOLE.h);
  need('add', /var strip = addPiece\(B, \{ w:Math\.max\(GPICK, e\.b\.n \* cw\), h:ADD_STRIP\.h,/, 'the strip to add is not at least GPICK wide');
  need('sub', /var strip = addPiece\(B, \{ w:Math\.max\(GPICK, e\.b\.n \* cw\), h:SUB_STRIP\.h,/, 'the strip to eat is not at least GPICK wide');
  need('add', /full = addPiece\(B, \{ w:ADD_PT\.w, h:LOOSE\.pick,/, 'the full bar is not picked up by LOOSE.pick');
  need('kind', /addPiece\(B, \{ w:KIND_CARD\.w, h:KIND_CARD\.h, cx:KIND_TRAY\[i\]\.x, cy:KIND_TRAY\[i\]\.y,/, 'the fraction cards are not KIND_CARD at KIND_TRAY');
  need('imp', /addPiece\(B, \{ w:IMP_CARD, h:IMP_CARD, cx:x0 \+ k \* IMP_TRAY\.step, cy:IMP_TRAY\.y,/, 'the number cards are not IMP_CARD on IMP_TRAY');
  need('pack', /var frame = addPiece\(B, \{ w:PACK_FRAME\.w, h:PACK_FRAME\.h, cx:PACK_FRAME\.cx, cy:PACK_FRAME\.cy,/, 'the frame is not PACK_FRAME');

  /* ---------- 第 1 關：分類站（範例 1） ---------- */
  {
    const K = D.KIND_BIN, H = D.KIND_H;
    if (!Array.isArray(D.KIND_BINS) || D.KIND_BINS.join() !== 'proper,improper,mixed') fail('KIND_BINS should be proper, improper, mixed');
    const binR = K.xs.map(x => ({ x:x - K.w / 2, y:K.y, w:K.w, h:K.h }));
    binR.forEach((o, i) => inside(o, 'kind: basket ' + i, H));
    noHits(binR, 'kind: baskets');
    K.xs.forEach((x, i) => inside({ x:x - K.w / 2, y:D.KIND_LBL.y, w:K.w, h:D.KIND_LBL.h }, 'kind: label ' + i, H));
    /* 籃子的名字要畫在籃子裡面：放在名字上就是放進那個籃子（驗證者第一輪：名字在籃子外面，正確的卡放上去靜靜彈回） */
    const lblIn = (l, z) => l.x >= z.x && l.y >= z.y && l.x + l.w <= z.x + z.w && l.y + l.h <= z.y + z.h;
    K.xs.forEach((x, i) => { if (!lblIn({ x:x - K.w / 2 + 4, y:D.KIND_LBL.y, w:K.w - 8, h:D.KIND_LBL.h }, binR[i])) fail('kind: basket ' + i + "'s label is not inside the basket — a drop on the label bounces"); });
    if (Math.min(...D.KIND_SPOT) - D.KIND_CARD.h / 2 < D.KIND_LBL.y + D.KIND_LBL.h) fail('kind: a placed card covers the basket label');
    need('kind', /var t = target\(B, K\.xs\[i\] - K\.w \/ 2, K\.y, K\.w, K\.h, 'gbin', \{ kind:k, n:0 \}\);\s*addZone\(B, K\.xs\[i\] - K\.w \/ 2 \+ 4, KIND_LBL\.y, K\.w - 8, KIND_LBL\.h, 'glbl'/, 'the basket label is not drawn inside its basket (after it)');
    if (!Array.isArray(D.KIND_SPOT) || D.KIND_SPOT.length !== D.KIND_CAP) fail('kind: KIND_SPOT should have one place per card a basket holds (KIND_CAP ' + D.KIND_CAP + ')');
    const spots = (D.KIND_SPOT || []).map(y => rc(K.xs[0], y, D.KIND_CARD.w, D.KIND_CARD.h));
    spots.forEach((o, i) => { if (!(o.x >= binR[0].x && o.y >= binR[0].y && o.x + o.w <= binR[0].x + binR[0].w && o.y + o.h <= binR[0].y + binR[0].h)) fail('kind: place ' + i + ' in a basket sticks out of the basket'); });
    noHits(spots, 'kind: places in a basket —');
    if (!Array.isArray(D.KIND_TRAY) || D.KIND_TRAY.length < Math.max(...D.GAME_KIND.map(s => s.length))) fail('kind: KIND_TRAY has fewer places than a set has cards');
    const tray = D.KIND_TRAY.map(p => rc(p.x, p.y, D.KIND_CARD.w, D.KIND_CARD.h));
    tray.forEach((o, i) => inside(o, 'kind: tray place ' + i, H));
    noHits(tray, 'kind: tray places');
    tray.forEach((o, i) => binR.forEach((b, j) => { if (hit(o, grow(b, K.pad))) fail('kind: tray place ' + i + ' sits inside basket ' + j + "'s drop pad"); }));
    const ref = c => c[0] > 0 ? 'mixed' : (c[1] < c[2] ? 'proper' : 'improper');
    D.GAME_KIND.forEach((set, si) => {
      const w = 'GAME_KIND[' + si + ']', cnt = { proper:0, improper:0, mixed:0 }, keys = new Set();
      if (!Array.isArray(set) || set.length !== 5) return fail(w + ' should have 5 cards');
      set.forEach((c, ci) => {
        const cw = w + '[' + ci + ']';
        if (!(Array.isArray(c) && c.length === 3 && c.every(int))) return fail(cw + ' is not [whole, numerator, denominator]');
        if (!(c[2] >= DEN_MIN && c[2] <= DEN_MAX)) fail(cw + ' has denominator ' + c[2] + ", outside this lesson's " + DEN_MIN + '~' + DEN_MAX);
        if (!(c[1] >= 1)) fail(cw + ' has no numerator');
        if (c[0] < 0 || c[0] > MAX_WHOLE) fail(cw + ' has whole part ' + c[0] + ', outside 0~' + MAX_WHOLE);
        if (c[0] > 0 && !(c[1] < c[2])) fail(cw + ' is a mixed number whose fraction part ' + c[1] + '/' + c[2] + ' is not proper');
        if (D.cardKind(c) !== ref(c)) fail(cw + ': cardKind says ' + D.cardKind(c) + ', independently ' + ref(c));
        cnt[ref(c)]++;
        const key = c.join(); if (keys.has(key)) fail(cw + ' repeats a card'); keys.add(key);
        /* 放錯的每一個籃子：說的是這張卡自己是什麼，數字一個一個對，理由真的成立 */
        D.KIND_BINS.forEach(bin => {
          if (bin === ref(c)) return;
          LANGS.forEach(L => {
            const d = I18N[L], got = D.kindWhy(d, c, bin), fr = c[1] + '/' + c[2];
            let want, wd;
            if (c[0] > 0){ want = d.gKindMixed(mixedRef(L, c[0], c[1], c[2]), c[0], fr); wd = [c[0], c[1], c[2], c[0], c[1], c[2]]; }
            else if (c[1] < c[2]){ want = d.gKindProper(fr, c[1], c[2]); wd = [c[1], c[2], c[1], c[2]]; }
            else if (bin === 'mixed'){
              /* 除得剛剛好的（5/5、6/3）換不出帶分數 —— 理由要說它換出來是整數，不可以說「可以變身成帶分數」 */
              const q = c[1] % c[2] === 0 ? c[1] / c[2] : null;
              want = d.gKindImpNotMixed(fr, q); wd = q !== null ? [c[1], c[2], q, c[1], c[2]] : [c[1], c[2], c[1], c[2]];
              if (q !== null && (L === 'zh' ? /可以變身成帶分數/ : /made over into a mixed number/).test(got)) fail(cw + ' in mixed (' + L + ') says ' + fr + ' can become a mixed number, but it divides exactly');
            }
            else if (c[1] === c[2]){ want = d.gKindEq(fr, c[1]); wd = [c[1], c[2], c[1]]; }
            else { want = d.gKindBig(fr, c[1], c[2]); wd = [c[1], c[2], c[1], c[2]]; }
            if (got !== want) fail(cw + ' dropped in ' + bin + ' (' + L + ') says "' + got + '", which is not the reason for a ' + ref(c) + ' card');
            seq(cw + ' in ' + bin + ' ' + L, got, wd);
          });
        });
      });
      if (!cnt.proper || !cnt.improper || !cnt.mixed) fail(w + ' does not have all three kinds (' + JSON.stringify(cnt) + ')');
      ['proper', 'improper', 'mixed'].forEach(k => { if (cnt[k] > D.KIND_CAP) fail(w + ' has ' + cnt[k] + ' ' + k + ' cards but a basket holds ' + D.KIND_CAP + ' — the round cannot be finished'); });
      if (!set.some(c => c[0] === 0 && c[1] === c[2])) fail(w + ' has no card with numerator = denominator (5/5 is improper — the misconception this round is about)');
      if (!set.some(c => c[0] === 0 && c[1] > c[2])) fail(w + ' has no improper card bigger than 1');
      if (!D.GAME_KIND.some(s2 => s2.some(c => c[0] === 0 && c[1] > c[2] && c[1] % c[2] === 0)) && si === 0) fail('GAME_KIND has no improper card that divides exactly (6/3), so the “comes out a whole number” reason is never shown');
    });
    /* 理由的用字真的成立：比較小／一樣／比較大 */
    has('gKindProper zh', I18N.zh.gKindProper('3/5', 3, 5), /比分母 5 小/, 'the proper reason does not say smaller');
    has('gKindBig zh', I18N.zh.gKindBig('7/5', 7, 5), /比分母 5 大/, 'the improper reason does not say bigger');
    has('gKindEq zh', I18N.zh.gKindEq('5/5', 5), /一樣/, 'the n = d reason does not say equal');
    has('gKindProper en', I18N.en.gKindProper('3/5', 3, 5), /smaller than the denominator 5/, 'the proper reason does not say smaller');
    has('gKindBig en', I18N.en.gKindBig('7/5', 7, 5), /bigger than the denominator 5/, 'the improper reason does not say bigger');
    LANGS.forEach(L => {
      if (D.KIND_BINS.some(k => !(I18N[L].gKindBin && I18N[L].gKindBin[k]))) fail('gKindBin ' + L + ' is missing a basket name');
      seq('gKindNow ' + L, I18N[L].gKindNow(2, 5), [2, 5]);
      seq('gKind2 ' + L, I18N[L].gKind2(mixedRef(L, 1, 2, 5), I18N[L].gKindBin.mixed), [2, 1, 2, 5]);
      if (nums(I18N[L].gKindDone).length) fail('gKindDone ' + L + ' carries numbers that are not this set\'s: ' + I18N[L].gKindDone);
    });
    need('kind', /if \(b\.kind !== cardKind\(c\)\)\{ roundMiss\(kindWhy\(d, c, b\.kind\)\); return false; \}/, 'a card in the wrong basket is not bounced with kindWhy()');
    need('kind', /b\.n\+\+; if \(b\.n >= KIND_CAP\) b\.done = true;/, 'a basket does not fill up at KIND_CAP');
  }

  /* ---------- 第 2 關：裝整條（範例 2：分子 ÷ 分母，一次拿走一整條） ---------- */
  {
    const PB = D.PACK_BAR, PP = D.PACK_PILE, H = D.PACK_H;
    PB.xs.forEach((x, i) => inside({ x:x - PB.w / 2, y:PB.y, w:PB.w, h:PB.h }, 'pack: bar place ' + i, H));
    noHits(PB.xs.map(x => ({ x:x - PB.w / 2, y:PB.y, w:PB.w, h:PB.h })), 'pack: bar places');
    inside({ x:PP.x, y:PP.y, w:PP.w, h:PP.h }, 'pack: the pile', H);
    const fr = rc(D.PACK_FRAME.cx, D.PACK_FRAME.cy, D.PACK_FRAME.w, D.PACK_FRAME.h);
    inside(fr, 'pack: the frame', H);
    if (hit(fr, grow({ x:PP.x, y:PP.y, w:PP.w, h:PP.h }, PP.pad))) fail('pack: the frame at home is inside the pile’s drop pad');
    for (let rem = 0; rem <= 4 * DEN_MAX; rem++) for (let d = DEN_MIN; d <= DEN_MAX; d++){
      const want = rem >= d ? 'pack' : rem > 0 ? 'short' : 'empty';
      if (D.packTry(rem, d) !== want) fail('packTry(' + rem + ', ' + d + ') is ' + D.packTry(rem, d) + ', independently ' + want + ' — a frame packs a bar only while d squares are left');
    }
    let exact = 0, rest = 0;
    D.GAME_PACK.forEach((e, i) => {
      const w = 'GAME_PACK[' + i + ']';
      if (!(int(e.n) && int(e.d) && e.d >= DEN_MIN && e.d <= DEN_MAX)) return fail(w + ' is not a fraction with denominator ' + DEN_MIN + '~' + DEN_MAX);
      if (!(e.n > e.d)) fail(w + ': ' + e.n + '/' + e.d + ' is not bigger than 1 — there is nothing to pack into whole bars');
      const ref = toMixedRef(e.n, e.d);
      if (ref.w > PB.xs.length) fail(w + ': ' + e.n + '/' + e.d + ' packs ' + ref.w + ' bars but there are only ' + PB.xs.length + ' bar places');
      if (ref.n === 0) exact++; else rest++;
      /* 版面：堆裡的一格和整條的一格一樣寬，一排不是 d 格，排得下 */
      const cw = PB.w / e.d, per = D.packPer(e.d);
      if (Math.abs(D.packCell(e.d) - cw) > 1e-9) fail(w + ': a pile square is ' + D.packCell(e.d) + ' wide but a square of the bar is ' + cw);
      if (!(int(per) && per >= 2)) return fail(w + ': packPer is ' + per);
      if (per === e.d) fail(w + ': the pile is laid out ' + per + ' to a row — a row of d is already a whole bar');
      if (e.n > per && e.n % per === e.d) fail(w + ': the last row of the pile is exactly ' + e.d + ' long');
      const rows = Math.ceil(e.n / per);
      if (per * (cw + PP.gap) - PP.gap > PP.w - 8 + 1e-9) fail(w + ': a pile row is wider than the pile');
      if (rows * (PP.sqH + PP.gap) - PP.gap > PP.h) fail(w + ': ' + rows + ' rows of squares do not fit in the pile');
      /* 照規則玩一遍：每一次拿走 d 格，裝不滿就擋；「裝完了」只在剩不到 d 格時收 */
      let rem = e.n, bars = 0, guard = 0;
      while (guard++ < 20){
        if (rem >= e.d){ if (D.packTry(rem, e.d) !== 'pack') { fail(w + ': the rule refuses a frame with ' + rem + ' left'); break; } rem -= e.d; bars++; continue; }
        if (rem > 0 && D.packTry(rem, e.d) !== 'short') fail(w + ': ' + rem + ' left is not refused');
        break;
      }
      if (bars !== ref.w || rem !== ref.n) fail(w + ': packing ends with ' + bars + ' bars and ' + rem + ' left, independently ' + ref.w + ' and ' + ref.n);
      LANGS.forEach(L => {
        const d = I18N[L];
        seq(w + ' gPackNow ' + L, d.gPackNow(0, e.n, e.d), [0, e.n, 1, e.d]);
        for (let r = 1; r < e.d; r++) seq(w + ' gPackShort(' + r + ') ' + L, d.gPackShort(r, e.d), [r, e.d]);
        for (let r = e.d; r <= e.n; r++){
          seq(w + ' gPackMore(' + r + ') ' + L, d.gPackMore(r, e.d), [r, e.d]);
          if (r === e.d && !(L === 'zh' ? /剛好/ : /exactly/).test(d.gPackMore(r, e.d))) fail(w + ' gPackMore ' + L + ': with exactly ' + r + ' left it does not say “exactly”');
          if (r > e.d && (L === 'zh' ? /剛好/ : /exactly/).test(d.gPackMore(r, e.d))) fail(w + ' gPackMore ' + L + ': with ' + r + ' left it says “exactly” ' + e.d);
        }
        seq(w + ' gPackDone ' + L, d.gPackDone(e.n, e.d, ref.w, ref.n), ref.n ? [e.n, e.d, ref.w, ref.n, e.n, e.d, ref.w, ref.n, e.d] : [e.n, e.d, ref.w, e.n, e.d, ref.w]);
        has(w + ' gPackDone ' + L, d.gPackDone(e.n, e.d, ref.w, ref.n), new RegExp(e.n + '/' + e.d + ' [=＝] ' + mixedRef(L, ref.w, ref.n, e.d).replace(/\//g, '\\/') + '(?![\\d/])'), 'does not write ' + e.n + '/' + e.d + ' = ' + mixedRef(L, ref.w, ref.n, e.d));
        seq(w + ' gPack2 ' + L, d.gPack2(e.n, e.d), [2, e.n, e.d]);
        seq(w + ' gPack2 short ' + L, d.gPack2(ref.n, e.d), [2, ref.n, e.d]);
      });
    });
    if (!exact) fail('GAME_PACK has no fraction that divides exactly — “it comes out a whole number” is never shown');
    if (!rest) fail('GAME_PACK has no fraction with squares left over');
    need('pack', /var r = packTry\(rem, e\.d\);\s*if \(r === 'empty'\) return false;\s*if \(r === 'short'\)\{ roundMiss\(d\.gPackShort\(rem, e\.d\)\); return false; \}/, 'the frame is not ruled by packTry()');
    need('pack', /if \(rem >= e\.d\)\{ roundMiss\(d\.gPackMore\(rem, e\.d\)\); return; \}/, '“all packed” with a whole bar still loose is not bounced');
  }

  /* ---------- 第 3 關：拆整條（範例 3：整數 × 分母 ＋ 分子） ---------- */
  {
    const S = D.IMP_SLOT, I = D.IMP_BAR, H = D.IMP_H;
    const slotR = S.xs.map(x => rc(x, S.y, S.size, S.size));
    slotR.forEach((o, i) => inside(o, 'imp: box ' + i, H));
    noHits(slotR, 'imp: boxes');
    S.ops.forEach((x, i) => { if (!(x > S.xs[i] + S.size / 2 && x < S.xs[i + 1] - S.size / 2)) fail('imp: the ' + (i ? '+' : '×') + ' sign is not between its two boxes'); });
    if (!(S.eq - 22 >= S.xs[2] + S.size / 2 && S.eq + 22 <= W)) fail('imp: the “= ?” label touches the last box or leaves the board');
    tooSmall('imp: a number box with its pad', S.size + 2 * S.pad);
    const trayR = [0, 1, 2].map(k => rc((W - 2 * D.IMP_TRAY.step) / 2 + k * D.IMP_TRAY.step, D.IMP_TRAY.y, D.IMP_CARD, D.IMP_CARD));
    trayR.forEach((o, i) => inside(o, 'imp: tray place ' + i, H));
    noHits(trayR, 'imp: tray places');
    trayR.forEach((o, i) => slotR.forEach((b, j) => { if (hit(o, grow(b, S.pad))) fail('imp: tray place ' + i + ' is inside box ' + j + "'s drop pad"); }));
    let maxBars = 0;
    D.GAME_IMP.forEach((e, i) => {
      const w = 'GAME_IMP[' + i + ']';
      if (!(int(e.w) && int(e.n) && int(e.d))) return fail(w + ' is not whole numbers');
      if (!(e.d >= DEN_MIN && e.d <= DEN_MAX)) fail(w + ' has denominator ' + e.d);
      if (!(e.w >= 1 && e.w <= MAX_WHOLE)) fail(w + ' has whole part ' + e.w + ', outside 1~' + MAX_WHOLE);
      if (!(e.n >= 1 && e.n < e.d)) fail(w + ': ' + e.n + '/' + e.d + ' is not a proper fraction part');
      if (new Set([e.w, e.n, e.d]).size !== 3) fail(w + ': the three cards ' + [e.w, e.d, e.n].join(', ') + ' are not all different, so “which card is wrong” cannot be said');
      maxBars = Math.max(maxBars, e.w + 1);
      const t = toImproperRef(e.w, e.n, e.d);
      if (D.impAnswer(e) !== t) fail(w + ': impAnswer is ' + D.impAnswer(e) + ', independently ' + t);
      /* 每一格收哪一張：× 收 w、d，＋ 只收 n —— 每一種排法照規則走完，收下來的一定是 w × d ＋ n */
      ['mul', 'add'].forEach(slot => [e.w, e.d, e.n].forEach(v => {
        const want = slot === 'add' ? v === e.n : v !== e.n;
        if (D.impSlotOk(e, slot, v) !== want) fail(w + ': impSlotOk(' + slot + ', ' + v + ') is ' + D.impSlotOk(e, slot, v) + ', independently ' + want);
      }));
      const perms = [[e.w, e.d, e.n], [e.w, e.n, e.d], [e.d, e.w, e.n], [e.d, e.n, e.w], [e.n, e.w, e.d], [e.n, e.d, e.w]];
      let accepted = 0;
      perms.forEach(p => {
        if (D.impSlotOk(e, 'mul', p[0]) && D.impSlotOk(e, 'mul', p[1]) && D.impSlotOk(e, 'add', p[2])){
          accepted++;
          if (p[0] * p[1] + p[2] !== t) fail(w + ': the boxes accept ' + p.join(', ') + ', which is not ' + t);
        }
      });
      if (accepted !== 2) fail(w + ': ' + accepted + ' ways to fill the boxes are accepted, independently 2 (× in either order)');
      /* impTray：一定是 w、d、n 三張；n 永遠不在最後（「w d n」「d w n」就是答案的順序）；前兩格都會變 */
      const seenFirst = new Set();
      for (let k = 0; k < 400; k++){
        const tr = D.impTray(e);
        if (!Array.isArray(tr) || tr.slice().sort().join() !== [e.w, e.d, e.n].sort().join()){ fail(w + ': impTray gave ' + JSON.stringify(tr)); break; }
        if (tr[2] === e.n){ fail(w + ': impTray put ' + e.n + ' last — the tray starts in the answer order (' + tr.join(' ') + ')'); break; }
        seenFirst.add(tr[0]);
      }
      if (seenFirst.size < 3) fail(w + ': impTray always starts with one of only ' + seenFirst.size + ' cards — it is not shuffled');
      LANGS.forEach(L => {
        const d = I18N[L], mx = mixedRef(L, e.w, e.n, e.d);
        seq(w + ' gImpNow ' + L, d.gImpNow(e.w, e.n, e.d), [e.w, e.n, e.d, e.d]);
        seq(w + ' gImpLine ' + L, d.gImpLine(e.w, e.n, e.d, t), [e.w, e.n, e.d, t, e.d]);
        has(w + ' gImpLine ' + L, d.gImpLine(e.w, e.n, e.d, t), new RegExp('^' + mx + ' [=＝] ' + t + '/' + e.d + '$'), 'does not write ' + mx + ' = ' + t + '/' + e.d);
        seq(w + ' gImpNinMul ' + L, d.gImpNinMul(e.n), [e.n]);
        [e.w, e.d].forEach(v => seq(w + ' gImpAddWrong(' + v + ') ' + L, d.gImpAddWrong(v, e.n), [e.n, v]));
        seq(w + ' gImpForgot ' + L, d.gImpForgot(e.w * e.d, e.n), [e.w * e.d, e.n]);
        if (e.w * e.d === t) fail(w + ': “forgot to add” equals the answer');
        seq(w + ' gImpWrong ' + L, d.gImpWrong(e.w, e.d, e.n), [e.w, e.d, e.n]);
        seq(w + ' gImpDone ' + L, d.gImpDone(e.w, e.n, e.d, t), [e.w, e.d, e.w * e.d, e.n, t, e.w, e.n, e.d, t, e.d]);
        seq(w + ' gImp2a ' + L, d.gImp2a(e.w, e.d, e.n), [2, e.w, e.d, e.w, e.d, e.n]);
        seq(w + ' gImp2b ' + L, d.gImp2b(e.w, e.d, e.w * e.d, e.n), [2, e.w, e.d, e.w * e.d, e.n]);
      });
    });
    if (maxBars * I.w + (maxBars - 1) * I.gap + I.x0 > W) fail('imp: ' + maxBars + ' bars do not fit across the board');
    need('imp', /if \(!impSlotOk\(e, s\.kind, v\)\)\{ roundMiss\(s\.kind === 'add' \? d\.gImpAddWrong\(v, e\.n\) : d\.gImpNinMul\(e\.n\)\); return false; \}/, 'a card in the wrong box is not bounced by impSlotOk()');
    need('imp', /function canon\(s\)\{ s = s\.trim\(\); return \/\^\(0\|\[1-9\]\\d\*\)\$\/\.test\(s\) \? \+s : null; \}/, 'an answer like "03", "3.0" or "1 2" is read as a number');
    need('imp', /if \(v === null\)\{ gMsg\.textContent = d\.gImpEmpty; return; \}/, 'an empty or malformed answer is counted as a mistake');
    need('imp', /if \(v === t\)\{/, 'the typed total is not compared with impAnswer()');
  }

  /* ---------- 第 4、5 關共用：兩區的名字畫在自己那一區裡面，而且不在另一區（含 pad）裡 —— 放在名字上一定進那一區，不會被另一區接走 ---------- */
  function zoneLabels(r, WH, PT, pad){
    const L = D.ZLBL, lbl = z => ({ x:z.x + L.dx, y:z.y + L.dy, w:z.w - 2 * L.dx, h:L.h });
    const lin = (l, z) => l.x >= z.x && l.y >= z.y && l.x + l.w <= z.x + z.w && l.y + l.h <= z.y + z.h;
    [[WH, PT, 'whole bars'], [PT, WH, 'loose squares']].forEach(([z, o, nm]) => {
      if (!lin(lbl(z), z)) fail(r + ': the “' + nm + '” label is not inside its zone — a drop on it bounces');
      if (hit(lbl(z), grow(o, pad))) fail(r + ': the “' + nm + '” label is inside the other zone’s pad — a drop on it is taken by the wrong zone');
    });
    if (hit(WH, PT)) fail(r + ': the two zones overlap');
    need(r, /var Z = twoZones\(B, d, /, 'the zones are not drawn by twoZones()');
  }
  needSrc(/addZone\(B, WH\.x \+ ZLBL\.dx, WH\.y \+ ZLBL\.dy, WH\.w - 2 \* ZLBL\.dx, ZLBL\.h, 'glbl gleft', d\.gWholeLbl\);\s*addZone\(B, PT\.x \+ ZLBL\.dx, PT\.y \+ ZLBL\.dy, PT\.w - 2 \* ZLBL\.dx, ZLBL\.h, 'glbl gleft', d\.gPartLbl\);/, 'twoZones() does not draw the two labels inside their zones at ZLBL');

  /* ---------- 第 4、5 關共用：所有動作順序都走一遍的小工具 ---------- */
  function explore(start, moves, key, onState, limit){
    const seen = new Set(), stack = [start];
    let n = 0;
    while (stack.length && n++ < (limit || 5000)){
      const s = stack.pop(), k = key(s);
      if (seen.has(k)) continue; seen.add(k);
      onState(s);
      moves(s).forEach(x => stack.push(x));
    }
    return seen.size;
  }

  /* ---------- 第 4 關：湊整條（範例 4：整數加整數、分子加分子，滿一整條進 1） ---------- */
  {
    const H = D.ADD_H, WH = D.ADD_WH, PT = D.ADD_PT, Lo = D.LOOSE, WR = D.WROW;
    inside(WH, 'add: the whole-bar zone', H); inside(PT, 'add: the loose zone', H);
    /* nearestOpen() 的 pad 邊界是「含」的：兩個放寬的方框連碰到都不行（codex 第三輪） */
    if (WH.y + WH.h + D.ADD_PAD >= PT.y - D.ADD_PAD) fail('add: the two zones’ drop pads overlap');
    zoneLabels('add', WH, PT, D.ADD_PAD);
    if (D.WROW.dy < D.ZLBL.dy + D.ZLBL.h) fail('add: the first whole bar covers the “whole bars” label');
    if (D.LOOSE.ys[0] - (D.LOOSE.pick - D.LOOSE.h) / 2 < PT.y + D.ZLBL.dy + D.ZLBL.h) fail('add: the loose bar covers the “loose squares” label');
    Lo.ys.forEach((y, i) => { if (!(y >= PT.y && y + Lo.h <= PT.y + PT.h)) fail('add: loose bar ' + i + ' is outside the loose zone'); });
    if (Lo.ys[1] < Lo.ys[0] + Lo.h) fail('add: the overflow bar overlaps the loose bar');
    const tok = rc(D.ADD_TOKEN.cx, D.ADD_TOKEN.cy, D.ADD_TOKEN.w, D.ADD_TOKEN.h), strip = rc(W / 2, D.ADD_STRIP.cy, PT.w, D.ADD_STRIP.h);
    inside(tok, 'add: the token', H); inside(strip, 'add: the widest strip', H);
    if (hit(tok, strip)) fail('add: the token and the strip overlap');
    [tok, strip].forEach((o, i) => [WH, PT].forEach((z, j) => { if (hit(o, grow(z, D.ADD_PAD))) fail('add: piece ' + i + ' at home is inside zone ' + j + "'s drop pad"); }));
    const rowsFit = Math.floor((WH.h - WR.dy - WR.h) / WR.step) + 1;
    let carry = 0, noCarry = 0, exact = 0, zeroA = 0;
    D.GAME_ADD.forEach((e, i) => {
      const w = 'GAME_ADD[' + i + ']', d = e.d;
      if (!(int(d) && d >= DEN_MIN && d <= DEN_MAX)) return fail(w + ' has denominator ' + d);
      [['a', e.a], ['b', e.b]].forEach(([nm, x]) => {
        if (!(x && int(x.w) && int(x.n) && x.w >= 0 && x.w <= MAX_WHOLE)) fail(w + '.' + nm + ' has whole part ' + (x && x.w) + ', outside 0~' + MAX_WHOLE);
        if (!(x && x.n >= 1 && x.n < d)) fail(w + '.' + nm + ': ' + (x && x.n) + '/' + d + ' is not a proper fraction part of at least one square');
      });
      const ref = addRef({ w:e.a.w, n:e.a.n, d }, { w:e.b.w, n:e.b.n, d });
      if (ref.w > rowsFit) fail(w + ': the answer has ' + ref.w + ' whole bars but the whole-bar zone holds ' + rowsFit);
      if (e.a.n + e.b.n > d) carry++; else if (e.a.n + e.b.n === d) exact++; else noCarry++;
      if (e.a.w === 0) zeroA++;
      if (e.b.n * PT.w / d > PT.w) fail(w + ': the strip is wider than the loose bar');
      /* 所有動作順序：token（b 有整條才有）、strip、carry（strip 放好、而且滿了才有）、按「做好了」 */
      const ends = [];
      const cnt = s => ({ W:e.a.w + (s.token ? e.b.w : 0) + (s.carried ? 1 : 0), N:e.a.n + (s.strip ? e.b.n : 0) - (s.carried ? d : 0) });
      explore({ token:false, strip:false, carried:false },
        s => {
          const out = [];
          if (e.b.w > 0 && !s.token) out.push(Object.assign({}, s, { token:true }));
          if (!s.strip) out.push(Object.assign({}, s, { strip:true }));
          if (s.strip && !s.carried && e.a.n + e.b.n >= d) out.push(Object.assign({}, s, { carried:true }));
          return out;
        },
        s => JSON.stringify(s),
        s => {
          const c = D.addCount(e, s), r = cnt(s);
          if (c.W !== r.W || c.N !== r.N) fail(w + ': addCount(' + JSON.stringify(s) + ') is ' + JSON.stringify(c) + ', independently ' + JSON.stringify(r));
          const all = (e.b.w === 0 || s.token) && s.strip;
          if (all && r.N >= d){
            /* 「做好了」被擋下來：那一句說零散的已經滿 d 格 —— 真的滿了 */
            LANGS.forEach(L => seq(w + ' gAddCarry ' + L, I18N[L].gAddCarry(d), [d, 1]));
          }
          if (all && r.N < d) ends.push(r);
          LANGS.forEach(L => seq(w + ' gAddNow ' + JSON.stringify(s) + ' ' + L, I18N[L].gAddNow(mixedRef(L, r.W, r.N, d)), mixD(r.W, r.N, d)));
        });
      if (!ends.length) fail(w + ': no order of moves reaches “done” — the round cannot be finished');
      ends.forEach(r => { if (r.W !== ref.w || r.N !== ref.n) fail(w + ': the round can end at ' + r.W + ' + ' + r.N + '/' + d + ', independently ' + ref.w + ' + ' + ref.n + '/' + d); });
      LANGS.forEach(L => {
        const dd = I18N[L];
        seq(w + ' gAddPartToWhole ' + L, dd.gAddPartToWhole(e.b.n, d), [e.b.n, d]);
        if (e.b.n >= d) fail(w + ': gAddPartToWhole says ' + e.b.n + ' squares do not make a bar, but they do');
        seq(w + ' gAddDone ' + L, dd.gAddDone(mixedRef(L, e.a.w, e.a.n, d), mixedRef(L, e.b.w, e.b.n, d), mixedRef(L, ref.w, ref.n, d)),
            mixD(e.a.w, e.a.n, d).concat(mixD(e.b.w, e.b.n, d), mixD(ref.w, ref.n, d)));
        if (e.b.w) seq(w + ' gAddToken ' + L, dd.gAddToken(e.b.w), [e.b.w]);
        seq(w + ' gAddStrip ' + L, dd.gAddStrip(e.b.n), [e.b.n]);
        if (e.b.w) seq(w + ' gAdd2Token ' + L, dd.gAdd2Token(e.b.w), [2, e.b.w]);
        seq(w + ' gAdd2Strip ' + L, dd.gAdd2Strip(e.b.n), [2, e.b.n]);
        const N = e.a.n + e.b.n;
        if (N >= d) seq(w + ' gAdd2Carry ' + L, dd.gAdd2Carry(N, d), [2, N, d, 1]);
        seq(w + ' gAdd2Done ' + L, dd.gAdd2Done(ref.n, d), [2, ref.n, d]);
      });
    });
    if (!carry) fail('GAME_ADD has no sum that carries with squares left over');
    if (!noCarry) fail('GAME_ADD has no sum that does not carry');
    if (!exact) fail('GAME_ADD has no sum whose numerators fill exactly one bar (the answer is a whole number)');
    if (!zeroA) fail('GAME_ADD has no sum that starts from a proper fraction');
    LANGS.forEach(L => {
      if (nums(I18N[L].gAddWholeToPart).length) fail('gAddWholeToPart ' + L + ' carries numbers');
      if (nums(I18N[L].gAddNotYet).length) fail('gAddNotYet ' + L + ' carries numbers');
      seq('gAddCarried ' + L, I18N[L].gAddCarried, [1]);
    });
    need('add', /if \(\(token && !s\.token\) \|\| !s\.strip\)\{ gMsg\.textContent = d\.gAddNotYet; return; \}/, '“done” before everything is up is counted as a mistake (it should only remind)');
    need('add', /if \(c\.N >= D\)\{ roundMiss\(d\.gAddCarry\(D\)\); return; \}/, '“done” with a full loose bar is accepted — carrying 1 is skipped');
    need('add', /if \(z === Z\.pt\)\{ roundMiss\(d\.gAddWholeToPart\); return false; \}/, 'whole bars dropped on the loose bar are not bounced');
    need('add', /if \(z === Z\.wh\)\{ roundMiss\(d\.gAddPartToWhole\(e\.b\.n, D\)\); return false; \}/, 'loose squares dropped on the whole bars are not bounced');
    need('add', /if \(!s\.carried && tot >= D\)\{/, 'a full loose bar does not become something you can carry');
  }

  /* ---------- 第 5 關：借 1（範例 5：分子不夠減就向整數借 1，換成 d/d） ---------- */
  {
    const H = D.SUB_H, WH = D.SUB_WH, PT = D.SUB_PT, SW = D.SUB_WHOLE;
    inside(WH, 'sub: the whole-bar zone', H); inside(PT, 'sub: the loose zone', H);
    if (WH.y + WH.h + D.SUB_PAD >= PT.y - D.SUB_PAD) fail('sub: the two zones’ drop pads overlap');
    zoneLabels('sub', WH, PT, D.SUB_PAD);
    if (D.SUB_ROWS[0] < PT.y + D.ZLBL.dy + D.ZLBL.h) fail('sub: the loose rows cover the “loose squares” label');
    need('sub', /cy:SUB_WH\.y \+ 30 \+ SUB_WHOLE\.h \/ 2 \+ i \* SUB_WHOLE\.step,/, 'the whole bars do not start below the “whole bars” label (SUB_WH.y + 30)');
    if (30 < D.ZLBL.dy + D.ZLBL.h) fail('sub: the first whole bar covers the “whole bars” label');
    D.SUB_ROWS.forEach((y, i) => { if (!(y >= PT.y && y + D.LOOSE.h <= PT.y + PT.h)) fail('sub: loose row ' + i + ' is outside the loose zone'); });
    const rowsFit = Math.floor((WH.h - 30 - SW.h) / SW.step) + 1;
    if (SW.w > WH.w) fail('sub: a whole bar is wider than its zone');
    const tok = rc(D.SUB_TOKEN.cx, D.SUB_TOKEN.cy, D.SUB_TOKEN.w, D.SUB_TOKEN.h), strip = rc(W / 2, D.SUB_STRIP.cy, PT.w, D.SUB_STRIP.h);
    inside(tok, 'sub: the token', H); inside(strip, 'sub: the widest strip', H);
    if (hit(tok, strip)) fail('sub: the token and the strip overlap');
    [tok, strip].forEach((o, i) => [WH, PT].forEach((z, j) => { if (hit(o, grow(z, D.SUB_PAD))) fail('sub: piece ' + i + ' at home is inside zone ' + j + "'s drop pad"); }));
    if (Math.abs(SW.w - PT.w) > 1e-9) fail('sub: a whole bar (' + SW.w + ') is not as long as a loose bar (' + PT.w + ') — one whole bar is the same as a full loose bar');
    if (Math.abs(D.ADD_WH.w - D.ADD_PT.w) > 1e-9) fail('add: a whole bar is not as long as the loose bar');
    /* 一格在每一個地方都一樣大 —— 寬和高都要比（codex 第一輪：只比了寬，高度 24/30、36/26、30/36 在換的時候會變） */
    if (D.WROW.h !== D.LOOSE.h) fail('add: a whole bar is ' + D.WROW.h + ' tall but the loose bar is ' + D.LOOSE.h + ' — the bar changes size when it is carried');
    if (SW.barH !== D.LOOSE.h) fail('sub: a whole bar is ' + SW.barH + ' tall but a loose bar is ' + D.LOOSE.h + ' — the bar changes size when it is borrowed');
    if (D.PACK_PILE.sqH !== D.PACK_BAR.h) fail('pack: a pile square is ' + D.PACK_PILE.sqH + ' tall but a packed bar is ' + D.PACK_BAR.h + ' — the squares change size when they are packed');
    need('pack', /frame\.el\.appendChild\(barSVG\(PB\.w, PB\.h, e\.d, \[\]\)\);/, 'the frame does not draw a bar the size of a packed bar');
    need('add', /strip\.el\.appendChild\(barSVG\(e\.b\.n \* cw, LOOSE\.h,/, 'the squares to add are not drawn as tall as the loose bar');
    need('sub', /strip\.el\.appendChild\(barSVG\(e\.b\.n \* cw, LOOSE\.h,/, 'the squares to eat are not drawn as tall as the loose bar');
    let borrow = 0, noBorrow = 0, zeroW = 0, zeroN = 0, noTok = 0;
    D.GAME_SUB.forEach((e, i) => {
      const w = 'GAME_SUB[' + i + ']', d = e.d;
      if (!(int(d) && d >= DEN_MIN && d <= DEN_MAX)) return fail(w + ' has denominator ' + d);
      [['a', e.a], ['b', e.b]].forEach(([nm, x]) => {
        if (!(x && int(x.w) && int(x.n) && x.w >= 0 && x.w <= MAX_WHOLE)) fail(w + '.' + nm + ' has whole part ' + (x && x.w) + ', outside 0~' + MAX_WHOLE);
        if (!(x && x.n >= 1 && x.n < d)) fail(w + '.' + nm + ': ' + (x && x.n) + '/' + d + ' is not a proper fraction part of at least one square');
      });
      const A = toImproperRef(e.a.w, e.a.n, d), Bv = toImproperRef(e.b.w, e.b.n, d);
      if (!(A > Bv)) return fail(w + ': ' + A + '/' + d + ' − ' + Bv + '/' + d + ' — the first number has to be bigger');
      if (e.a.w > rowsFit) fail(w + ': ' + e.a.w + ' whole bars do not fit in the whole-bar zone (' + rowsFit + ')');
      const ref = subRef({ w:e.a.w, n:e.a.n, d }, { w:e.b.w, n:e.b.n, d }), need1 = e.a.n < e.b.n;
      if (need1) borrow++; else noBorrow++;
      if (ref.w === 0) zeroW++;
      if (ref.n === 0) zeroN++;
      if (e.b.w === 0) noTok++;
      /* 所有動作順序：借 1（拖一條整條下來）、吃格子、吃整條；每一個狀態照規則判斷收不收 */
      const ends = [];
      const cells = s => e.a.n + (s.borrowed ? d : 0) - (s.ate ? e.b.n : 0);
      explore({ borrowed:false, ate:false, token:false },
        s => {
          const out = [], wholesFree = e.a.w - (s.borrowed ? 1 : 0) - (s.token ? e.b.w : 0);
          const canBorrow = !s.borrowed && !s.ate && e.a.n < e.b.n;
          if (D.subCanBorrow(e, s) !== canBorrow) fail(w + ': subCanBorrow(' + JSON.stringify(s) + ') is ' + D.subCanBorrow(e, s) + ', independently ' + canBorrow);
          if (wholesFree > 0){
            if (canBorrow) out.push(Object.assign({}, s, { borrowed:true }));
            else if (!s.ate) LANGS.forEach(L => {
              /* 被擋下來的借 1：那一句說「夠吃」—— 真的夠 */
              const c = cells(s);
              if (c < e.b.n) fail(w + ': borrowing is refused with ' + c + ' loose squares, fewer than ' + e.b.n);
              seq(w + ' gSubNoNeed ' + L, I18N[L].gSubNoNeed(c, e.b.n), [c, e.b.n]);
            });
          }
          if (!s.ate){
            const c = cells(s);
            if (c >= e.b.n) out.push(Object.assign({}, s, { ate:true }));
            else LANGS.forEach(L => seq(w + ' gSubShort ' + L, I18N[L].gSubShort(c, e.b.n), [c, e.b.n, 1]));
          }
          if (e.b.w > 0 && !s.token){
            if (wholesFree < e.b.w) fail(w + ': at ' + JSON.stringify(s) + ' only ' + wholesFree + ' whole bars are left to eat ' + e.b.w);
            else out.push(Object.assign({}, s, { token:true }));
          }
          return out;
        },
        s => JSON.stringify(s),
        s => {
          const c = D.subCount(e, s), r = { W:e.a.w - (s.borrowed ? 1 : 0) - (s.token ? e.b.w : 0), N:cells(s) };
          if (D.subCells(e, s) !== r.N || c.W !== r.W || c.N !== r.N) fail(w + ': subCount(' + JSON.stringify(s) + ') is ' + JSON.stringify(c) + ', independently ' + JSON.stringify(r));
          if (r.W < 0 || r.N < 0) fail(w + ': the state ' + JSON.stringify(s) + ' has a negative count');
          if (s.ate && (e.b.w === 0 || s.token)) ends.push(r);
          LANGS.forEach(L => seq(w + ' gSubNow ' + JSON.stringify(s) + ' ' + L, I18N[L].gSubNow(mixedRef(L, r.W, r.N, d)), mixD(r.W, r.N, d)));
        });
      if (!ends.length) fail(w + ': no order of moves finishes the round');
      ends.forEach(r => { if (r.W !== ref.w || r.N !== ref.n) fail(w + ': the round can end at ' + r.W + ' + ' + r.N + '/' + d + ', independently ' + ref.w + ' + ' + ref.n + '/' + d); });
      LANGS.forEach(L => {
        const dd = I18N[L];
        seq(w + ' gSubDone ' + L, dd.gSubDone(mixedRef(L, e.a.w, e.a.n, d), mixedRef(L, e.b.w, e.b.n, d), mixedRef(L, ref.w, ref.n, d)),
            mixD(e.a.w, e.a.n, d).concat(mixD(e.b.w, e.b.n, d), mixD(ref.w, ref.n, d)));
        seq(w + ' gSubBorrowed ' + L, dd.gSubBorrowed(d), [1, d, d, 1]);
        seq(w + ' gSubStripWhole ' + L, dd.gSubStripWhole(e.b.n, d), [d, d, 1, e.b.n]);
        seq(w + ' gSubStripHere ' + L, dd.gSubStripHere(e.b.n), [e.b.n]);
        if (e.b.w) seq(w + ' gSubWholeToPart ' + L, dd.gSubWholeToPart(e.b.w), [e.b.w]);
        if (e.b.w) seq(w + ' gSubToken ' + L, dd.gSubToken(e.b.w), [e.b.w]);
        seq(w + ' gSubStrip ' + L, dd.gSubStrip(e.b.n), [e.b.n]);
        if (need1) seq(w + ' gSub2Borrow ' + L, dd.gSub2Borrow(e.a.n, e.b.n), [2, e.a.n, e.b.n, 1]);
        seq(w + ' gSub2Eat ' + L, dd.gSub2Eat(e.a.n + (need1 ? d : 0), e.b.n), [2, e.a.n + (need1 ? d : 0), e.b.n, e.b.n]);
        if (e.b.w) seq(w + ' gSub2Token ' + L, dd.gSub2Token(e.b.w), [2, e.b.w]);
      });
    });
    if (!borrow) fail('GAME_SUB has no subtraction that borrows');
    if (!noBorrow) fail('GAME_SUB has no subtraction that does not borrow');
    if (!zeroW) fail('GAME_SUB has none whose whole part becomes 0');
    if (!zeroN) fail('GAME_SUB has none whose numerators cancel (answer is a whole number)');
    if (!noTok) fail('GAME_SUB has none without whole bars to eat');
    need('sub', /if \(!subCanBorrow\(e, s\)\)\{\s*if \(s\.ate\) return false;\s*roundMiss\(d\.gSubNoNeed\(subCells\(e, s\), e\.b\.n\)\); return false;\s*\}/, 'borrowing when it is not needed is not bounced');
    need('sub', /if \(c < e\.b\.n\)\{ roundMiss\(d\.gSubShort\(c, e\.b\.n\)\); return false; \}/, 'eating more squares than there are is not bounced');
    need('sub', /if \(z === Z\.wh\)\{ roundMiss\(subCells\(e, s\) < e\.b\.n \? d\.gSubStripWhole\(e\.b\.n, D\) : d\.gSubStripHere\(e\.b\.n\)\); return false; \}/, 'squares eaten off the whole bars are not bounced');
    need('sub', /if \(z === Z\.pt\)\{ roundMiss\(d\.gSubWholeToPart\(e\.b\.w\)\); return false; \}/, 'whole bars eaten off the loose squares are not bounced');
    need('sub', /if \(s\.ate && \(!token \|\| s\.token\)\)\{/, 'the round finishes before everything is eaten');
    need('sub', /B\.onTap = function\(P\)\{\s*if \(token && B\.selected === token && P\.data\.whole\)\{ B\.onPointTap\(token, \{ x:P\.cx, y:P\.cy \}\); return; \}\s*baseTap\(P\);/, 'tapping a whole bar while something other than the “eat bars” token is selected is not a plain selection switch (it would drop the eat strip on the whole bars)');
  }
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
