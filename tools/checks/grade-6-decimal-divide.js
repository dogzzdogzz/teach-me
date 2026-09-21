/* grade-6/math/decimal-divide —— 小數除法放大鏡（除數是小數的除法）
 *
 * 這一課的正確性有五塊，所以這份設定裡有五套**獨立重寫**的實作，都不呼叫課程頁的函式：
 *
 * 1) 「商」。課程頁全程用百分之一的整數算（aH × 100 / bH）；這裡**改走印出來的字**：
 *    把 dTextRef(a) 與 dTextRef(b) 解析成精確有理數再相除，最後換回百分之一。
 *    走的是完全不同的路，所以 dText 印錯、商算錯都會被抓到。
 * 2) 「小數怎麼印出來」。課程頁自己拆整數位與百分位；這裡用 toFixed(2) 再砍尾端的 0（dTextRef）。
 *    對 1 ~ 200000 的每一個百分之一值都要同意。
 * 3) 「小數位數」與「要放大幾倍」。課程頁用取餘數（h % 100、h % 10）；這裡**數印出來的小數點後面有幾個字**。
 * 4) 課程明講的三條規則這裡是**列舉證明**，不是文案：
 *    - 「兩個數同時乘以同一個數，商不變」→ 對每一組 (a, b) 與 k ∈ {10, 100} 驗 quotRef(a, b) ＝ quotRef(a × k, b × k)。
 *    - 「除數有幾位小數，就放大 10 的幾次方，放大完除數一定是整數」→ 對每一個除數列舉驗證。
 *    - 「除數比 1 小，商比被除數大；比 1 大，商比被除數小」→ 對每一組直接比出來。
 * 5) ⚠️ **從畫出來的圖量回來**：五種圖（小格、梯子、小數點搬家、數線、雙數線）的每一個圖元座標
 *    都在這裡**重算一次**再逐一比對；印成 SVG 字串（帶最長的標籤）餵 lib/canvas.js 驗四個邊。
 *    超出各自的範圍要 tooBig 而且一個圖元都不畫（fail-closed）。
 *    ⚠️ 「小數點搬家」那張圖還要驗一條**它自己的不變式**：
 *       下排的小數點欄 － 上排的小數點欄 ＝ 放大的位數。畫得下、字沒疊到都不等於畫的是那件事。
 *
 * ⚠️ **這一課不能用 lib/arith.js**（那一份看到小數就直接判失敗），用的是全站共用的
 *    `lib/decarith.js`（2026-09-21 從 grade-6-circle.js 抽出來的那一份）。
 * ⚠️ **算式裡不可以夾單位**（`45 元 ÷ 0.6` 會被中文切成兩半，剩下的半截會被當成另一條宣稱）。
 *    下面 UNIT_IN_EQ 這一條專門擋它。
 * ⚠️ 選項的「值」是**百分之一的整數 ＋ 單位**（`9` 和 `9 段` 是兩個不同的值）。
 */

const fs = require('fs');
const path = require('path');
const { canvasProblems } = require('./lib/canvas.js');
const { decArith, seen: DEC_SEEN } = require('./lib/decarith.js')();

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const A_MIN_REF = 10, A_MAX_REF = 9990;
const B_MIN_REF = 5,  B_MAX_REF = 990;
const Q_MIN_REF = 100, Q_MAX_REF = 10000;
const FIG_W_REF = 460, FIG_H_REF = 200;
const LABEL_X_REF = 16, LABEL_A_Y_REF = 20, LABEL_B_Y_REF = 192, LABEL_FS_REF = 14, LABEL_MAX_REF = 26;
const CELL_W_REF = 7, CELL_H_REF = 34, CELL_X0_REF = 40, CELL_Y_REF = 92;
const CELL_MAX_REF = 54, PER_MIN_REF = 3, PER_MAX_REF = 9, GROUP_MAX_REF = 14, CELL_NUM_FS_REF = 13;
const LAD_ROW_Y_REF = [48, 100, 152], LAD_BOX_H_REF = 34, LAD_FS_REF = 19;
const LAD_DV_X_REF = 52, LAD_DV_W_REF = 84, LAD_SYM_X_REF = 150, LAD_DS_X_REF = 164, LAD_DS_W_REF = 76;
const LAD_EQ_X_REF = 254, LAD_Q_X_REF = 268, LAD_Q_W_REF = 80;
const LAD_ARROW_X_REF = 372, LAD_ARROW_TX_REF = 390, LAD_ARROW_FS_REF = 13;
const SH_CH_W_REF = 15, SH_FS_REF = 22, SH_DV_X0_REF = 40, SH_DS_X0_REF = 280, SH_SYM_X_REF = 252;
const SH_TOP_Y_REF = 62, SH_BOT_Y_REF = 154, SH_DOT_DY_REF = -3, SH_DOT_R_REF = 4;
const SH_ARROW_Y1_REF = 82, SH_ARROW_Y2_REF = 128, SH_COL_MAX_REF = 6;
const CMP_X0_REF = 44, CMP_X1_REF = 420, CMP_Y_REF = 150, CMP_FS_REF = 16;
const CMP_A_TOP_REF = 108, CMP_Q_TOP_REF = 66, CMP_ZERO_Y_REF = 168, CMP_DOT_R_REF = 4, CMP_HEAD_REF = 1.15;
const UNI_X0_REF = 56, UNI_X1_REF = 410, UNI_TOP_Y_REF = 76, UNI_BOT_Y_REF = 150, UNI_FS_REF = 16;
const UNI_VAL_Y_REF = 60, UNI_AMT_Y_REF = 168, UNI_DOT_R_REF = 4, UNI_HEAD_REF = 1.25;
const C_LINE_REF = '#2B2A33', C_MUTED_REF = '#6B6875', C_BLUE_REF = '#3B7DD8';
const C_CELL_A_REF = '#BBD5F4', C_CELL_B_REF = '#FFFFFF', C_CELL_EDGE_REF = '#9CC0EA';
const C_ORANGE_REF = '#E8871E', C_ORANGE_SOFT_REF = '#FDF0E0';
const C_GREEN_REF = '#2F9E69', C_GREEN_SOFT_REF = '#E3F4EB', C_WHITE_REF = '#FFFFFF';

/* 每一個範例的案例，寫成第二份 */
const S1_CASES_REF = [[360, 40], [250, 50], [480, 60], [360, 30]];
const S2_CASES_REF = [[360, 40], [480, 120], [750, 25], [900, 75]];
const S3_CASES_REF = [[360, 40], [600, 40], [750, 25], [450, 150]];
const S4_CASES_REF = [[360, 40], [480, 160], [250, 50], [900, 150]];
const S5_CASES_REF = [['cut', 'rope', 540, 60], ['cut', 'juice', 360, 40], ['unit', 'sugar', 60, 4500], ['unit', 'ribbon', 250, 2000]];
const GAME_ROUNDS_REF = 5;
const GEN_IDS = ['divTenth', 'divHundredth', 'divWhole', 'divBigDivisor', 'placesAsk', 'sameQuotient',
                 'compareQuot', 'wordCut', 'wordUnit', 'decQuotient', 'interDecInt', 'interRatio'];

/* ---------- 1) 第二套實作：走「印出來的字 → 有理數」這條路，不重用課程頁的整數算法 ---------- */
function isPosIntRef(n){ return typeof n === 'number' && Number.isInteger(n) && n >= 1; }
/* 小數怎麼印：toFixed(2) 再砍尾端的 0 與孤單的小數點（課程頁是拆整數位與百分位）。 */
function dTextRef(h){
  if (!(typeof h === 'number' && Number.isInteger(h) && h >= 0)) return '?';
  let s = (h / 100).toFixed(2);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
/* 小數位數：**數印出來的小數點後面有幾個字**（課程頁是取餘數）。 */
function dpRef(h){
  if (!isPosIntRef(h)) return -1;
  const s = dTextRef(h), i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}
function scaleRef(h){ const p = dpRef(h); return p < 0 ? null : Math.pow(10, p); }
/* 把印出來的字解析成精確有理數。 */
function ratOf(s){
  const m = /^(\d+)(?:\.(\d+))?$/.exec(String(s));
  if (!m) return null;
  const f = m[2] || '', scale = Math.pow(10, f.length);
  return { n: Number(m[1]) * scale + (f === '' ? 0 : Number(f)), d: scale };
}
function ratEq(a, b){ return !!(a && b) && a.n * b.d === b.n * a.d; }
/* 商：從**印出來的兩個字**算起，除完再換回百分之一。除不盡或超出範圍一律 null。 */
function quotRef(aH, bH){
  if (!isPosIntRef(aH) || !isPosIntRef(bH)) return null;
  if (aH < A_MIN_REF || aH > A_MAX_REF || bH < B_MIN_REF || bH > B_MAX_REF) return null;
  const ra = ratOf(dTextRef(aH)), rb = ratOf(dTextRef(bH));
  if (!ra || !rb || rb.n === 0) return null;
  const n = ra.n * rb.d, d = ra.d * rb.n;          /* 商 ＝ n / d */
  if ((n * 100) % d !== 0) return null;
  const qH = n * 100 / d;
  if (!isPosIntRef(qH) || qH % 10 !== 0 || qH < Q_MIN_REF || qH > Q_MAX_REF) return null;
  return qH;
}
/* 商和被除數比：拿**印出來的除數**和 1 比，不看 100 這個內部數字。 */
function sideRef(bH){
  const rb = ratOf(dTextRef(bH)), one = { n:1, d:1 };
  if (!rb) return null;
  if (rb.n * one.d < one.n * rb.d) return 'bigger';
  if (rb.n * one.d > one.n * rb.d) return 'smaller';
  return 'same';
}
function plEnRef(n, w){
  if (String(n) === '1') return n + ' ' + w;
  return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');
}
const UNIT_WORD_REF = {
  zh:{ n:'', x:'倍', seg:'段', bot:'瓶', bag:'袋', yuan:'元', pl:'位' },
  en:{ n:'', x:'time', seg:'piece', bot:'bottle', bag:'bag', yuan:'dollar', pl:'place' }
};
function withUnitRef(lang, kind, t){
  if (kind === 'none' || kind === 'n') return String(t);
  if (!UNIT_WORD_REF[lang] || UNIT_WORD_REF[lang][kind] === undefined) return '?';
  return lang === 'zh' ? t + ' ' + UNIT_WORD_REF.zh[kind] : plEnRef(String(t), UNIT_WORD_REF.en[kind]);
}

/* ---------- 2) 選項的解析：一個數 ＋ 一個單位。回傳百分之一的值與單位代號。 ---------- */
/* ⚠️ 長的單位名要先比，不然短的會先咬走一半。英文的複數也要認得。 */
const UNIT_PARSE = {
  zh:[['平方公分', 'sq'], ['公分', 'cm'], ['倍', 'x'], ['段', 'seg'], ['瓶', 'bot'], ['袋', 'bag'], ['元', 'yuan'], ['位', 'pl']],
  en:[['square centimetres', 'sq'], ['square centimetre', 'sq'], ['centimetres', 'cm'], ['centimetre', 'cm'],
      ['times', 'x'], ['time', 'x'], ['pieces', 'seg'], ['piece', 'seg'], ['bottles', 'bot'], ['bottle', 'bot'],
      ['bags', 'bag'], ['bag', 'bag'], ['dollars', 'yuan'], ['dollar', 'yuan'], ['places', 'pl'], ['place', 'pl']]
};
function parseOptRef(s, lang){
  let t = String(s).trim(), unit = 'n';
  for (const [word, code] of UNIT_PARSE[lang]){
    if (t.length > word.length && t.slice(-word.length) === word){
      unit = code; t = t.slice(0, -word.length).trim(); break;
    }
  }
  const m = /^(\d+)(?:\.(\d+))?$/.exec(t);
  if (!m) return null;
  const f = m[2] || '';
  if (f.length > 2) return null;
  const h = Number(m[1]) * 100 + (f === '' ? 0 : Number((f + '00').slice(0, 2)));
  if (f.length > 0 && /0$/.test(f)) return null;          /* 9.50 這種寫法不可以出現 */
  return { h:h, u:unit };
}
function optKeyRef(s, lang){
  const p = parseOptRef(s, lang);
  return p ? (p.h + '|' + p.u) : ('TEXT:' + String(s).trim());
}

/* ---------- 3) 複習頁那兩個句庫的第二份（獨立寫死，不從頁面讀） ---------- */
const SIDES_REF = {
  bigger:  { zh:'商比被除數大', en:'The quotient is bigger than the dividend' },
  smaller: { zh:'商比被除數小', en:'The quotient is smaller than the dividend' },
  same:    { zh:'商和被除數一樣大', en:'The quotient equals the dividend' },
  depends: { zh:'不算出來就不知道', en:'There is no way to tell without dividing' }
};
const SIDE_KEYS_REF = ['bigger', 'smaller', 'same', 'depends'];
function sideKeyOfText(text, lang){
  for (const k of SIDE_KEYS_REF) if (SIDES_REF[k][lang] === String(text).trim()) return k;
  return null;
}
/* 複習頁的應用題情境（第二份）。cut 的答案是個數，unit 的答案是錢。 */
const CUT_IDS_REF = ['rope', 'juice', 'rice'];
const CUT_UNIT_REF = { rope:'seg', juice:'bot', rice:'bag' };
const CUT_WORD_REF = {
  zh:{ rope:['繩子', '公尺', '段', '剪一段', '可以剪成幾段'], juice:['果汁', '公升', '瓶', '裝一瓶', '可以裝幾瓶'], rice:['米', '公斤', '袋', '裝一袋', '可以裝幾袋'] },
  en:{ rope:['rope', 'metre', 'piece', 'cut into pieces of'], juice:['juice', 'litre', 'bottle', 'poured into bottles of'], rice:['rice', 'kilogram', 'bag', 'packed into bags of'] }
};
const UNIT_IDS_REF = ['sugar', 'ribbon', 'oil'];
const UNIT_WORDS_REF = { zh:{ sugar:['糖', '公斤'], ribbon:['緞帶', '公尺'], oil:['油', '公升'] },
                         en:{ sugar:['sugar', 'kilogram'], ribbon:['ribbon', 'metre'], oil:['oil', 'litre'] } };

/* ---------- 4) 跨頁用詞釘樁：min 一律寫成**當下真實的出現次數**（拿掉註解之後、讀者看得到的文字） ---------- */
/* 這一課的四頁必須把同一條規則講成同一句話。數字是量出來的，不是猜的；
   改文案的時候這裡會響，逼你回頭確認四頁還是一致的。 */
/* min 是 2026-09-21 逐頁**量出來的真實出現次數**（visibleText 之後），不是寬鬆的估計 ——
   少掉一句就會響，逼你回頭確認四頁還是同一套說法。 */
const PINS = [
  { key:'bothTogether', pages:['index', 'reference', 'review', 'parents'], min:{ index:31, reference:18, review:5, parents:12 },
    re:/同時乘以|一起往右移|兩個數一起|兩個數都乘以|兩個數，一起移/g,
    why:'the rule that both numbers move together' },
  { key:'quotientHolds', pages:['index', 'reference', 'parents'], min:{ index:11, reference:10, parents:8 },
    re:/商不變|商不會變|商從頭到尾|商沒有變/g,
    why:'the phrase that names the invariant' },
  { key:'divisorDecides', pages:['index', 'reference', 'parents'], min:{ index:13, reference:14, parents:2 },
    re:/除數有幾位小數|看除數|只看除數|除數的小數位數|哪一個.{0,6}決定|移幾位是/g,
    why:'the rule that the divisor decides how far to slide' },
  { key:'padZero', pages:['index', 'reference', 'parents'], min:{ index:4, reference:7, parents:10 },
    re:/補 0|補一個 0|補了 0|補上去/g,
    why:'the padding-zero special case' },
  { key:'sideOfOne', pages:['index', 'reference', 'review', 'parents'], min:{ index:20, reference:9, review:5, parents:12 },
    re:/比 1 小|比 1 大|和 1 比|除數和 1|剛好是 1/g,
    why:'the rule that the divisor next to 1 decides which way the quotient goes' },
  { key:'onlyDivisorWhole', pages:['index', 'reference', 'parents'], min:{ index:4, reference:2, parents:4 },
    re:/只要除數變成整數|只有除數|只要<strong>除數<\/strong>|除數變成整數就/g,
    why:'the clarification that only the divisor has to become whole' }
];
/* 一個字都不可以出現：這一課明講不做的東西，寫出來就是超出範圍；
   還有兩句「寫太滿」的規則（除法一定變小、兩個數都要變成整數）。 */
const FORBIDDEN = [
  { re:/四捨五入到小數第/, why:'rounding a quotient to a decimal place is left to a later lesson' },
  { re:/循環小數/, why:'recurring decimals are far outside this lesson' },
  { re:/\d\s*公分\s*[×÷]|\d\s*公尺\s*[×÷]|\d\s*公斤\s*[×÷]|\d\s*元\s*[×÷]|\d\s*公升\s*[×÷]/, why:'a unit inside an equation splits the equation in half (UNIT_IN_EQ)' }
];
/* 交給別課的詞：出現的時候，**同一個位置附近**要說出它屬於哪一課或不在這一課。
   ⚠️ 要逐一出現的位置檢查（窗口 ±160 字），整頁檢查會被同一頁別處那一句蓋掉。 */
/* ⚠️ 這兩句是這一課**刻意引述再打掉**的迷思，所以不可以整句禁止 —— 要求的是
   「同一個位置附近一定有反駁」。窗口 ±200 字，逐一出現檢查（整頁檢查會被別處那一句蓋掉）。 */
const MISCONCEPTIONS = [
  { term:'一定會變小', ok:/不對|錯|其實|只有|想錯|比 1 小|只在/, why:'“dividing always makes things smaller” must be refuted where it is quoted' },
  { term:'一定變小', ok:/不對|錯|其實|只有|想錯|比 1 小|只在/, why:'“dividing always makes things smaller” must be refuted where it is quoted' },
  { term:'兩個數都要變成整數', ok:/其實|不對|錯|以為|只要除數/, why:'“both numbers must become whole” must be refuted where it is quoted' }
];
const HANDOFF = [
  { term:'四則混合', ok:/不在這一課|留給後面|後面的課/ },
  { term:'餘數', ok:/不在這一課|留給後面|後面的課/ },
  { term:'概數', ok:/不在這一課|留給後面|後面的課/ },
  { term:'速率', ok:/不在這一課|留給後面|後面的課/ }
];

/* ---------- 5) 題庫神諭：每一題要問什麼、正解是什麼，各自獨立算一次 ---------- */
/* ⚠️ 只釘「這一題在問什麼」與「正解的字」，其餘（選項值互不相同、算式對不對、
   解釋有沒有引用題幹沒有的字）由下面的 decArith 與字串檢查逐題掃。 */
const QBANK_REF = {
  qs: [
    { kind:'div', a:360, b:40 },
    { kind:'places', a:750, b:25 },
    { kind:'div', a:480, b:120 },
    { kind:'div', a:600, b:40 },
    { kind:'expr', a:350, b:70 },
    { kind:'side', a:240, b:80 }
  ],
  qsAdv: [
    { kind:'unit', amt:60, val:4500 },
    { kind:'cut', a:540, b:60, unit:'seg' },
    { kind:'div', a:245, b:70 },
    { kind:'sentence', ans:2 }
  ],
  qsBoost: [
    { kind:'sentence', ans:1 },
    { kind:'sentence', ans:3 }
  ]
};
/* 一題的正解應該印成什麼字。sentence 型不算值，只驗 ans 的位置。 */
function bankAnswerRef(q, lang){
  if (q.kind === 'div'){ const v = quotRef(q.a, q.b); return v === null ? null : dTextRef(v); }
  if (q.kind === 'places') return withUnitRef(lang, 'pl', String(dpRef(q.b)));
  if (q.kind === 'expr'){ const k = scaleRef(q.b); return dTextRef(q.a * k) + ' ÷ ' + dTextRef(q.b * k); }
  if (q.kind === 'side'){
    const s = sideRef(q.b);
    if (s !== 'bigger' && s !== 'smaller') return null;
    return lang === 'zh' ? '比 ' + dTextRef(q.a) + (s === 'bigger' ? ' 大' : ' 小')
                         : (s === 'bigger' ? 'Bigger than ' : 'Smaller than ') + dTextRef(q.a);
  }
  if (q.kind === 'unit'){ const v = quotRef(q.val, q.amt); return v === null ? null : withUnitRef(lang, 'yuan', dTextRef(v)); }
  if (q.kind === 'cut'){ const v = quotRef(q.a, q.b); return v === null ? null : withUnitRef(lang, q.unit, dTextRef(v)); }
  return null;
}
/* 一題的題幹上一定要印出來的數（不印就是題目和答案對不上）。 */
function bankStemNumsRef(q){
  if (q.kind === 'div' || q.kind === 'places' || q.kind === 'expr' || q.kind === 'side' || q.kind === 'cut')
    return [dTextRef(q.a), dTextRef(q.b)];
  if (q.kind === 'unit') return [dTextRef(q.amt), dTextRef(q.val)];
  return [];
}

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
   `商<strong>一定</strong>會變小` 在畫面上就是那一句迷思，字面掃描不可以被標籤擋住。 */
function visibleText(html){
  return readerText(html)
    .replace(/<\/?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|table|section|header|footer|nav)\b[^>]*>/gi, ' ')
    .replace(/<\/?span\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
/* 把一頁的 I18N 字典求值出來（字串才是讀者看得到的字；函式的輸出由題庫與產生器那兩段驗）。 */
function i18nOf(raw){
  /* ⚠️ 不可以用「下一行是 var lang」當結束點：review.html 的 var lang 在 I18N **前面**，
     那樣會找不到而整頁的字靜靜不檢查。改成數大括號。 */
  const src = String(raw), i = src.indexOf('var I18N = {');
  if (i < 0) return null;
  let depth = 0, end = -1, inStr = null;
  for (let k = src.indexOf('{', i); k < src.length; k++){
    const ch = src[k];
    if (inStr){
      if (ch === '\\') k++;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"'){ inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}'){ depth--; if (depth === 0){ end = k + 1; break; } }
  }
  if (end < 0) return null;
  try { return new Function('return ' + src.slice(src.indexOf('{', i), end) + ';')(); } catch (e){ return null; }
}
/* ⚠️ `btn` 是語言切換鈕上的字：英文字典裡本來就是「中」（全站慣例，check_i18n 也把它當合法例外）。 */
const I18N_SKIP_KEYS = ['btn'];
function i18nStrings(obj, out, key){
  if (I18N_SKIP_KEYS.indexOf(key) >= 0) return out;
  if (typeof obj === 'string'){ out.push(obj); return out; }
  if (Array.isArray(obj)){ obj.forEach(v => i18nStrings(v, out)); return out; }
  if (obj && typeof obj === 'object'){ Object.keys(obj).forEach(k => i18nStrings(obj[k], out, k)); return out; }
  return out;
}
/* ⚠️ 算式裡夾單位會讓求值器把算式切成兩半，剩下的半截被當成另一條宣稱。 */
const UNIT_IN_EQ = /(?:公分|公尺|公斤|公升|平方公分|元|段|瓶|袋|倍|位|centimetres?|metres?|kilograms?|litres?|dollars?|pieces?|bottles?|bags?)\s*[×÷＝=]|[×÷]\s*(?:公分|公尺|公斤|公升|平方公分|元|段|瓶|袋|倍|位|centimetres?|metres?|kilograms?|litres?|dollars?|pieces?|bottles?|bags?)/;
function stringProblems(s, lang, where){
  const out = [];
  const t = String(s);
  if (/undefined|NaN|\[object/.test(t)) out.push(where + ' leaks an internal value');
  /* ⚠️ 會換行的標籤要換成一個空白再拆，不然兩行的字會黏在一起被誤報。 */
  const shown = t.replace(/<(?:br|p|div|li|span class="cond")[^>]*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (lang === 'zh' && /\p{Script=Han}\d|\d\p{Script=Han}/u.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:\p{Script=Han}\d|\d\p{Script=Han}).{0,6}/u) || [''])[0]);
  /* ⚠️ 前面不可以是數字或小數點：`0.1 metres` 的那個 1 不是「一」。 */
  if (lang === 'en' && /(?<![\d.])1 (?:pieces|bottles|bags|dollars|places|times|metres|litres|kilograms|zeros|decimals)\b/.test(shown)) out.push(where + ' has a singular/plural slip: ' + shown.match(/(?<![\d.])1 [a-z]+s\b/)[0]);
  if (lang === 'en' && /\p{Script=Han}/u.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  if (UNIT_IN_EQ.test(shown)) out.push(where + ' puts a unit inside an equation: ' + (shown.match(/.{0,16}[×÷＝=].{0,16}/) || [''])[0]);
  return out;
}

/* ---------- 6b) 驗算器自己的 PROBE：bad:false 必須零誤報，bad:true 一定要抓到 ---------- */
const CLAIM_PROBES = [
  { text:'3.6 ÷ 0.4 ＝ 36 ÷ 4 ＝ 9', bad:false },
  { text:'7.5 ÷ 0.25 ＝ 750 ÷ 25 ＝ 30', bad:false },
  { text:'6 ÷ 0.4 ＝ 60 ÷ 4 ＝ 15', bad:false },
  { text:'2.45 ÷ 0.7 ＝ 24.5 ÷ 7 ＝ 3.5', bad:false },
  { text:'4.8 ÷ 1.2 ＝ 48 ÷ 12 ＝ 4', bad:false },
  { text:'45 ÷ 0.6 ＝ 450 ÷ 6 ＝ 75', bad:false },
  { text:'36 ÷ 4 ＝ 9', bad:false },
  { text:'2.8 × 3 ＝ 8.4', bad:false },
  { text:'The answer is 5.4 ÷ 0.6 = 54 ÷ 6 = 9 pieces.', bad:false },
  { text:'□ × 0.4 ＝ 3.6', bad:false },
  { text:'(2 × 3) ÷ 0.5 ＝ 12', bad:false },
  { text:'(3 + 6) ＝ 9', bad:false },
  { text:'(3 + 6) ＝ 10', bad:true },
  { text:'（3.6 ÷ 0.4 ＝ 9）', bad:false },
  { text:'連結最後檢查：2026-09-21', bad:false },
  { text:'被除數和除數同時乘以同一個不是 0 的數，商不變', bad:false },
  { text:'比值 ＝ 前項 ÷ 後項', bad:false },
  { text:'除數 0.25 有 2 位小數', bad:false },
  { text:'3.6 ÷ 0.4 ＝ 36 ÷ 4 ＝ 8', bad:true },
  { text:'7.5 ÷ 0.25 ＝ 75 ÷ 25 ＝ 30', bad:true },
  { text:'6 ÷ 0.4 ＝ 6 ÷ 4 ＝ 15', bad:true },
  { text:'2.45 ÷ 0.7 ＝ 24.5 ÷ 7 ＝ 3.6', bad:true },
  { text:'45 ÷ 0.6 ＝ 450 ÷ 6 ＝ 70', bad:true },
  { text:'The answer is 5.4 ÷ 0.6 = 54 ÷ 6 = 8 pieces.', bad:true },
  { text:'2.8 × 3 ＝ 8.5', bad:true },
  { text:'5 ÷ 0 ＝ 5', bad:true },
  /* 這五筆釘住 grade-6/circle 兩輪 codex 抓到的漏洞（同一份求值器，同一批洞）： */
  { text:'□ × 0.4 ＝ 3.6 ＝ 99', bad:true },
  { text:'商 ＝ 9', bad:true },
  { text:'商 ＝ (9)', bad:true },
  { text:'商 ＝ 36 ÷ 4', bad:true },
  /* 全形數字也要讀得到：對的要放行、錯的要抓到（以前整條看不見）。 */
  { text:'３.６ ÷ ０.４ ＝ ９', bad:false },
  { text:'３.６ ÷ ０.４ ＝ ８', bad:true },
  { text:'36 ÷ ÷ 4 ＝ 9', bad:true },
  { text:'36 ÷ ＋ 4 ＝ 9', bad:true },
  { text:'（3.6 ÷ 0.4 ＝ 8）', bad:true }
];

/* ---------- 7) 從畫出來的圖量回來：五種圖的座標各重算一次 ---------- */
function r1Ref(v){ return Math.round(v * 10) / 10; }
function normPrim(p){
  const n = v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
  if (p.k === 'rect') return ['rect', n(p.x), n(p.y), n(p.w), n(p.h), p.fill, p.stroke, n(p.sw)].join(' ');
  if (p.k === 'line') return ['line', n(p.x1), n(p.y1), n(p.x2), n(p.y2), p.stroke, n(p.sw)].join(' ');
  if (p.k === 'circle') return ['circle', n(p.cx), n(p.cy), n(p.r), p.fill, p.stroke, n(p.sw)].join(' ');
  if (p.k === 'text') return ['text', n(p.x), n(p.y), p.t, n(p.fs), p.anchor, p.fill].join(' ');
  return 'unknown ' + JSON.stringify(p);
}
function refRect(x, y, w, h, fill, stroke, sw){ return { k:'rect', x, y, w, h, fill, stroke:stroke || 'none', sw:sw || 0 }; }
function refLine(x1, y1, x2, y2, stroke, sw){ return { k:'line', x1, y1, x2, y2, stroke, sw }; }
function refCircle(cx, cy, r, fill){ return { k:'circle', cx, cy, r, fill, stroke:'none', sw:0 }; }
function refText(x, y, t, fs, anchor, fill){ return { k:'text', x, y, t:String(t), fs, anchor:anchor || 'middle', fill }; }
function refArrow(out, x1, y1, x2, y2, col, sw){
  out.push(refLine(x1, y1, x2, y2, col, sw));
  const ang = Math.atan2(y2 - y1, x2 - x1), L = 9, s = 0.45;
  out.push(refLine(r1Ref(x2 - L * Math.cos(ang - s)), r1Ref(y2 - L * Math.sin(ang - s)), x2, y2, col, sw));
  out.push(refLine(r1Ref(x2 - L * Math.cos(ang + s)), r1Ref(y2 - L * Math.sin(ang + s)), x2, y2, col, sw));
}

function refCellPrims(aH, bH){
  const cells = aH / 10, per = bH / 10, groups = cells / per, out = [];
  for (let i = 0; i < cells; i++)
    out.push(refRect(CELL_X0_REF + i * CELL_W_REF, CELL_Y_REF, CELL_W_REF, CELL_H_REF,
                     Math.floor(i / per) % 2 === 0 ? C_CELL_A_REF : C_CELL_B_REF, C_CELL_EDGE_REF, 1));
  out.push(refRect(CELL_X0_REF, CELL_Y_REF, cells * CELL_W_REF, CELL_H_REF, 'none', C_LINE_REF, 2));
  for (let g = 1; g < groups; g++)
    out.push(refLine(CELL_X0_REF + g * per * CELL_W_REF, CELL_Y_REF - 6, CELL_X0_REF + g * per * CELL_W_REF, CELL_Y_REF + CELL_H_REF + 6, C_LINE_REF, 2));
  out.push(refRect(CELL_X0_REF, CELL_Y_REF, per * CELL_W_REF, CELL_H_REF, 'none', C_ORANGE_REF, 3));
  for (let g = 0; g < groups; g++)
    out.push(refText(r1Ref(CELL_X0_REF + (g + 0.5) * per * CELL_W_REF), CELL_Y_REF + CELL_H_REF + 22, String(g + 1), CELL_NUM_FS_REF, 'middle', C_MUTED_REF));
  return out;
}
function refLadderPrims(aH, bH){
  const q = quotRef(aH, bH), ready = dpRef(bH), out = [];
  for (let i = 0; i < 3; i++){
    const y = LAD_ROW_Y_REF[i], hot = (i === ready), k = Math.pow(10, i);
    out.push(refRect(LAD_DV_X_REF, y - LAD_BOX_H_REF / 2, LAD_DV_W_REF, LAD_BOX_H_REF, C_WHITE_REF, C_LINE_REF, 2));
    out.push(refText(LAD_DV_X_REF + LAD_DV_W_REF / 2, y + 6, dTextRef(aH * k), LAD_FS_REF, 'middle', C_LINE_REF));
    out.push(refText(LAD_SYM_X_REF, y + 6, '÷', LAD_FS_REF, 'middle', C_MUTED_REF));
    out.push(refRect(LAD_DS_X_REF, y - LAD_BOX_H_REF / 2, LAD_DS_W_REF, LAD_BOX_H_REF, hot ? C_ORANGE_SOFT_REF : C_WHITE_REF, hot ? C_ORANGE_REF : C_LINE_REF, hot ? 3 : 2));
    out.push(refText(LAD_DS_X_REF + LAD_DS_W_REF / 2, y + 6, dTextRef(bH * k), LAD_FS_REF, 'middle', hot ? C_ORANGE_REF : C_LINE_REF));
    out.push(refText(LAD_EQ_X_REF, y + 6, '＝', LAD_FS_REF, 'middle', C_MUTED_REF));
    out.push(refRect(LAD_Q_X_REF, y - LAD_BOX_H_REF / 2, LAD_Q_W_REF, LAD_BOX_H_REF, C_GREEN_SOFT_REF, C_GREEN_REF, 2));
    out.push(refText(LAD_Q_X_REF + LAD_Q_W_REF / 2, y + 6, dTextRef(q), LAD_FS_REF, 'middle', C_GREEN_REF));
  }
  for (let i = 0; i < 2; i++){
    refArrow(out, LAD_ARROW_X_REF, LAD_ROW_Y_REF[i] + LAD_BOX_H_REF / 2 - 2, LAD_ARROW_X_REF, LAD_ROW_Y_REF[i + 1] - LAD_BOX_H_REF / 2 + 2, C_BLUE_REF, 2);
    out.push(refText(LAD_ARROW_TX_REF, r1Ref((LAD_ROW_Y_REF[i] + LAD_ROW_Y_REF[i + 1]) / 2 + 4), '×10', LAD_ARROW_FS_REF, 'start', C_BLUE_REF));
  }
  return out;
}
/* 小數點搬家：一個數字一欄。這裡把「上下兩排怎麼對齊」整套重算一次。 */
function refShiftRow(h, k){
  const top = dTextRef(h), bot = dTextRef(h * k);
  const cut = s => ({ ds:s.replace('.', ''), p:s.indexOf('.') < 0 ? s.length : s.indexOf('.') });
  const t = cut(top), b = cut(bot);
  const shift = k === 100 ? 2 : (k === 10 ? 1 : 0);
  const pad = Math.max(0, shift - dpRef(h));
  return { top:t, bot:b, pad:pad, startCol:t.ds.length + pad - b.ds.length, shift:shift };
}
function refShiftPrims(aH, bH){
  const k = scaleRef(bH), rowA = refShiftRow(aH, k), rowB = refShiftRow(bH, k), out = [];
  const drawRow = (x0, row) => {
    for (let i = 0; i < row.top.ds.length; i++)
      out.push(refText(x0 + i * SH_CH_W_REF + SH_CH_W_REF / 2, SH_TOP_Y_REF, row.top.ds.charAt(i), SH_FS_REF, 'middle', C_LINE_REF));
    for (let i = 0; i < row.bot.ds.length; i++)
      out.push(refText(x0 + (row.startCol + i) * SH_CH_W_REF + SH_CH_W_REF / 2, SH_BOT_Y_REF, row.bot.ds.charAt(i), SH_FS_REF, 'middle',
                       i >= row.bot.ds.length - row.pad ? C_ORANGE_REF : C_LINE_REF));
    const xTop = x0 + row.top.p * SH_CH_W_REF, xBot = x0 + (row.startCol + row.bot.p) * SH_CH_W_REF;
    out.push(refCircle(xTop, SH_TOP_Y_REF + SH_DOT_DY_REF, SH_DOT_R_REF, C_ORANGE_REF));
    out.push(refCircle(xBot, SH_BOT_Y_REF + SH_DOT_DY_REF, SH_DOT_R_REF, C_ORANGE_REF));
    refArrow(out, xTop, SH_ARROW_Y1_REF, xBot, SH_ARROW_Y2_REF, C_ORANGE_REF, 2);
  };
  drawRow(SH_DV_X0_REF, rowA);
  out.push(refText(SH_SYM_X_REF, SH_TOP_Y_REF, '÷', SH_FS_REF, 'middle', C_MUTED_REF));
  out.push(refText(SH_SYM_X_REF, SH_BOT_Y_REF, '÷', SH_FS_REF, 'middle', C_MUTED_REF));
  drawRow(SH_DS_X0_REF, rowB);
  return { prims:out, rowA:rowA, rowB:rowB };
}
function refComparePrims(aH, bH){
  const q = quotRef(aH, bH), maxV = Math.round(Math.max(aH, q) * CMP_HEAD_REF), out = [];
  const xOf = v => r1Ref(CMP_X0_REF + v / maxV * (CMP_X1_REF - CMP_X0_REF));
  const xa = xOf(aH), xq = xOf(q);
  out.push(refLine(CMP_X0_REF, CMP_Y_REF, CMP_X1_REF, CMP_Y_REF, C_LINE_REF, 2));
  refArrow(out, CMP_X1_REF - 12, CMP_Y_REF, CMP_X1_REF, CMP_Y_REF, C_LINE_REF, 2);
  out.push(refLine(CMP_X0_REF, CMP_Y_REF - 6, CMP_X0_REF, CMP_Y_REF + 6, C_LINE_REF, 2));
  out.push(refText(CMP_X0_REF, CMP_ZERO_Y_REF, '0', CELL_NUM_FS_REF, 'middle', C_MUTED_REF));
  out.push(refLine(xa, CMP_Y_REF, xa, CMP_A_TOP_REF, C_BLUE_REF, 2));
  out.push(refCircle(xa, CMP_Y_REF, CMP_DOT_R_REF, C_BLUE_REF));
  out.push(refText(xa, CMP_A_TOP_REF - 8, dTextRef(aH), CMP_FS_REF, 'middle', C_BLUE_REF));
  out.push(refLine(xq, CMP_Y_REF, xq, CMP_Q_TOP_REF, C_ORANGE_REF, 2));
  out.push(refCircle(xq, CMP_Y_REF, CMP_DOT_R_REF, C_ORANGE_REF));
  out.push(refText(xq, CMP_Q_TOP_REF - 8, dTextRef(q), CMP_FS_REF, 'middle', C_ORANGE_REF));
  return { prims:out, xa:xa, xq:xq, maxV:maxV };
}
function refUnitPrims(amtH, valH){
  const maxA = Math.round(Math.max(100, amtH) * UNI_HEAD_REF), out = [];
  const xOf = v => r1Ref(UNI_X0_REF + v / maxA * (UNI_X1_REF - UNI_X0_REF));
  const xg = xOf(amtH), xo = xOf(100);
  [UNI_TOP_Y_REF, UNI_BOT_Y_REF].forEach(y => {
    out.push(refLine(UNI_X0_REF, y, UNI_X1_REF, y, C_LINE_REF, 2));
    refArrow(out, UNI_X1_REF - 12, y, UNI_X1_REF, y, C_LINE_REF, 2);
    out.push(refLine(UNI_X0_REF, y - 6, UNI_X0_REF, y + 6, C_LINE_REF, 2));
  });
  out.push(refText(UNI_X0_REF, UNI_VAL_Y_REF, '0', CELL_NUM_FS_REF, 'middle', C_MUTED_REF));
  out.push(refText(UNI_X0_REF, UNI_AMT_Y_REF, '0', CELL_NUM_FS_REF, 'middle', C_MUTED_REF));
  out.push(refLine(xg, UNI_TOP_Y_REF, xg, UNI_BOT_Y_REF, C_BLUE_REF, 2));
  out.push(refCircle(xg, UNI_TOP_Y_REF, UNI_DOT_R_REF, C_BLUE_REF));
  out.push(refCircle(xg, UNI_BOT_Y_REF, UNI_DOT_R_REF, C_BLUE_REF));
  out.push(refText(xg, UNI_VAL_Y_REF, dTextRef(valH), UNI_FS_REF, 'middle', C_BLUE_REF));
  out.push(refText(xg, UNI_AMT_Y_REF, dTextRef(amtH), UNI_FS_REF, 'middle', C_BLUE_REF));
  out.push(refLine(xo, UNI_TOP_Y_REF, xo, UNI_BOT_Y_REF, C_ORANGE_REF, 2));
  out.push(refCircle(xo, UNI_TOP_Y_REF, UNI_DOT_R_REF, C_ORANGE_REF));
  out.push(refCircle(xo, UNI_BOT_Y_REF, UNI_DOT_R_REF, C_ORANGE_REF));
  out.push(refText(xo, UNI_VAL_Y_REF, '?', UNI_FS_REF, 'middle', C_ORANGE_REF));
  out.push(refText(xo, UNI_AMT_Y_REF, '1', UNI_FS_REF, 'middle', C_ORANGE_REF));
  return { prims:out, xg:xg, xo:xo, maxA:maxA };
}

/* 把 plan 印成 SVG（帶最長的標籤）餵 lib/canvas.js 驗四個邊。 */
function svgOfPlan(pl, labelA, labelB){
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = pl.prims.map(p => {
    if (p.k === 'rect') return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'line') return '<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'circle') return '<circle cx="' + p.cx + '" cy="' + p.cy + '" r="' + p.r + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    return '<text x="' + p.x + '" y="' + p.y + '" font-size="' + p.fs + '" text-anchor="' + p.anchor + '" fill="' + p.fill + '">' + esc(p.t) + '</text>';
  }).join('');
  const labels = pl.labels.map(lb =>
    '<text x="' + lb.x + '" y="' + lb.y + '" font-size="' + LABEL_FS_REF + '" text-anchor="start" fill="' + C_LINE_REF + '">' +
    esc(lb.slot === 'a' ? labelA : labelB) + '</text>').join('');
  return '<svg width="' + FIG_W_REF + '" height="' + FIG_H_REF + '" viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '">' + body + labels + '</svg>';
}
/* 一張圖的共同檢查：畫布尺寸、兩個標籤的位置、圖元逐一比對、四個邊。 */
function planProblems(tag, pl, wantPrims, longLabel){
  const out = [];
  if (!pl || pl.tooBig){ out.push(tag + ': the figure refused to draw (tooBig) although its numbers are inside this lesson’s range'); return out; }
  if (pl.w !== FIG_W_REF || pl.h !== FIG_H_REF) out.push(tag + ': the canvas is ' + pl.w + '×' + pl.h + ', not ' + FIG_W_REF + '×' + FIG_H_REF);
  if (!Array.isArray(pl.labels) || pl.labels.length !== 2) out.push(tag + ': there are not exactly two label slots');
  else {
    const a = pl.labels[0], b = pl.labels[1];
    if (!(a.slot === 'a' && a.x === LABEL_X_REF && a.y === LABEL_A_Y_REF)) out.push(tag + ': the labels are not at y=' + LABEL_A_Y_REF + ' and x=' + LABEL_X_REF);
    if (!(b.slot === 'b' && b.x === LABEL_X_REF && b.y === LABEL_B_Y_REF)) out.push(tag + ': the labels are not at y=' + LABEL_B_Y_REF + ' and x=' + LABEL_X_REF);
  }
  const got = pl.prims.map(normPrim), want = wantPrims.map(normPrim);
  if (got.length !== want.length) out.push(tag + ': the figure has ' + got.length + ' pieces, the rebuilt one has ' + want.length);
  else for (let i = 0; i < got.length; i++)
    if (got[i] !== want[i]){ out.push(tag + ': piece ' + i + ' is "' + got[i] + '", the rebuilt one is "' + want[i] + '"'); break; }
  canvasProblems(svgOfPlan(pl, longLabel, longLabel)).forEach(m => out.push(tag + ': ' + m));
  return out;
}

/* ---------- 8) 整句題幹重建：每一支產生器、每一種語言各一份。多一個字少一個字都對不上。 ---------- */
function stemRef(genId, d, lang){
  const A = () => dTextRef(d.a), B = () => dTextRef(d.b);
  const plain = () => '<strong>' + A() + ' ÷ ' + B() + '</strong> ＝ ?';
  switch (genId){
    case 'divTenth': case 'divHundredth': case 'divWhole': case 'divBigDivisor': case 'decQuotient':
      return plain();
    case 'placesAsk':
      return lang === 'zh'
        ? '算 <strong>' + A() + ' ÷ ' + B() + '</strong> 的時候，兩個數的小數點<strong>最少</strong>要一起往右移幾位，除數才會變成整數？'
        : 'To work out <strong>' + A() + ' ÷ ' + B() + '</strong>, what is the <strong>smallest</strong> number of places both points must slide right before the divisor is whole?';
    case 'sameQuotient':
      return lang === 'zh'
        ? '下面哪一個算式的<strong>商</strong>和 <strong>' + A() + ' ÷ ' + B() + '</strong> 一樣？'
        : 'Which of these has the <strong>same quotient</strong> as <strong>' + A() + ' ÷ ' + B() + '</strong>?';
    case 'compareQuot':
      return lang === 'zh'
        ? '<strong>' + A() + ' ÷ ' + B() + '</strong> 的商，和被除數 ' + A() + ' 比起來會怎樣？'
        : 'Next to the dividend ' + A() + ', how does the quotient of <strong>' + A() + ' ÷ ' + B() + '</strong> come out?';
    case 'wordCut': {
      const w = CUT_WORD_REF[lang][d.id];
      return lang === 'zh'
        ? '<strong>' + A() + ' ' + w[1] + '</strong>的' + w[0] + '，每 <strong>' + B() + ' ' + w[1] + '</strong>' + w[3] + '，' + w[4] + '？'
        : '<strong>' + plEnRef(A(), w[1]) + '</strong> of ' + w[0] + ' is ' + w[3] + ' <strong>' + plEnRef(B(), w[1]) + '</strong>. How many ' + w[2] + 's are there?';
    }
    case 'wordUnit': {
      const w = UNIT_WORDS_REF[lang][d.id];
      return lang === 'zh'
        ? '<strong>' + B() + ' ' + w[1] + '</strong>的' + w[0] + '要 <strong>' + A() + ' 元</strong>，<strong>1 ' + w[1] + '</strong>要多少元？'
        : '<strong>' + plEnRef(B(), w[1]) + '</strong> of ' + w[0] + ' costs <strong>' + plEnRef(A(), 'dollar') + '</strong>. What does <strong>1 ' + w[1] + '</strong> cost?';
    }
    case 'interDecInt':
      return lang === 'zh'
        ? '（五年級）<strong>' + dTextRef(d.a) + ' ÷ ' + d.n + '</strong> ＝ ?'
        : 'Grade five: <strong>' + dTextRef(d.a) + ' ÷ ' + d.n + '</strong> ＝ ?';
    case 'interRatio':
      return lang === 'zh'
        ? '（六年級）<strong>' + (d.b * d.k) + ' : ' + d.b + '</strong> 的<strong>比值</strong>是多少？'
        : 'Grade six: what is the <strong>ratio value</strong> of <strong>' + (d.b * d.k) + ' : ' + d.b + '</strong>?';
    default: return null;
  }
}

/* ---------- 9) 產生器：不變條件的共用檢查 ---------- */
function fourDistinct(id, d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return id + ': there are ' + (d.opts || []).length + ' options, not four';
  if (new Set(d.opts.map(String)).size !== 4) return id + ': two options are the same token: ' + d.opts.join(' | ');
  if (!(d.ans >= 0 && d.ans < 4)) return id + ': the answer index ' + d.ans + ' is out of range';
  return null;
}
/* 產生器內部的編碼 `百分之一|單位`：值與單位都要合法、兩兩不同 */
function tokProblems(id, opts){
  const seen = new Set();
  for (const o of opts){
    const parts = String(o).split('|');
    if (parts.length !== 2) return id + ': option "' + o + '" is not encoded as value|unit';
    const v = Number(parts[0]);
    /* 上限 50000（＝ 500）是**推出來的**，不是隨手給的大數：誘答最大的是「只放大被除數」＝ 商 × 10，
       而商的上限是 50。以前寫 200000（＝ 2000）比這一課說的範圍鬆了 4 倍。 */
    if (!Number.isInteger(v) || v < 1 || v > 50000) return id + ': option "' + o + '" carries the value ' + parts[0] + ', which leaves this lesson’s range';
    if (UNIT_WORD_REF.zh[parts[1]] === undefined) return id + ': option "' + o + '" carries the unknown unit "' + parts[1] + '"';
    if (v % 10 !== 0 && v % 100 !== v % 10) { /* 兩位小數是合法的（2.45），不需要額外限制 */ }
    if (seen.has(String(o))) return id + ': two options share the token ' + o;
    seen.add(String(o));
  }
  return null;
}
/* 抄題幹：誘答（不含正解）的**數值**不可以等於題幹印出來的任何一個數 */
function echoProblems(id, d, stemNums){
  for (let i = 0; i < d.opts.length; i++){
    if (i === d.ans) continue;
    const v = Number(String(d.opts[i]).split('|')[0]);
    if (stemNums.indexOf(v) >= 0) return id + ': the distractor ' + d.opts[i] + ' copies a number the stem prints';
  }
  return null;
}
/* 一組（被除數、除數、商）在這一課的範圍裡嗎，而且真的除得盡嗎 */
function pairProblems(id, a, b, q){
  if (quotRef(a, b) === null) return id + ': ' + dTextRef(a) + ' ÷ ' + dTextRef(b) + ' does not divide exactly inside this lesson’s range';
  if (quotRef(a, b) !== q) return id + ': the quotient recorded (' + dTextRef(q) + ') is not ' + dTextRef(quotRef(a, b));
  if (dTextRef(a).replace('.', '').length > 3) return id + ': the dividend ' + dTextRef(a) + ' has more than three digits — this lesson teaches the method, not long division';
  /* 商不變：兩個數同時乘以 10 或 100，商必須完全一樣。這是這一課的核心規則，逐題驗。 */
  for (const k of [10, 100]){
    const big = quotRef(a * k, b * k);
    if (big !== null && big !== q) return id + ': magnifying both numbers by ' + k + ' changed the quotient from ' + dTextRef(q) + ' to ' + dTextRef(big);
  }
  /* 放大完除數一定是整數 */
  const kk = scaleRef(b);
  if (dpRef(b * kk) !== 0) return id + ': multiplying the divisor ' + dTextRef(b) + ' by ' + kk + ' does not make it whole';
  return null;
}

module.exports = {
  /* ================= 產生器模擬（tools/simgen.js） ================= */
  sim: {
    INVARIANTS: {
      divTenth: d => {
        if (dpRef(d.b) !== 1) return 'divTenth: the divisor ' + dTextRef(d.b) + ' does not have exactly one decimal place';
        if (sideRef(d.b) !== 'bigger') return 'divTenth: the divisor ' + dTextRef(d.b) + ' is not below 1';
        if (dpRef(d.a) < 1) return 'divTenth: the dividend ' + dTextRef(d.a) + ' is a whole number, which is divWhole’s job';
        const p = pairProblems('divTenth', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('divTenth', d); if (f) return f;
        const t = tokProblems('divTenth', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.q + '|n') return 'divTenth: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.q + '|n';
        const e = echoProblems('divTenth', d, [d.a, d.b]); if (e) return e;
        /* 這一課最重要的兩個誘答：只放大除數（十分之一）、只放大被除數（10 倍） */
        if (d.opts.indexOf(d.q / 10 + '|n') < 0) return 'divTenth: the "magnified the divisor only" distractor is missing';
        if (d.opts.indexOf(d.q * 10 + '|n') < 0) return 'divTenth: the "magnified the dividend only" distractor is missing';
      },
      divHundredth: d => {
        if (dpRef(d.b) !== 2) return 'divHundredth: the divisor ' + dTextRef(d.b) + ' does not have exactly two decimal places';
        if (scaleRef(d.b) !== 100) return 'divHundredth: the divisor ' + dTextRef(d.b) + ' would not be magnified by 100';
        const p = pairProblems('divHundredth', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('divHundredth', d); if (f) return f;
        const t = tokProblems('divHundredth', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.q + '|n') return 'divHundredth: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.q + '|n';
        const e = echoProblems('divHundredth', d, [d.a, d.b]); if (e) return e;
        if (d.opts.indexOf(d.q / 10 + '|n') < 0) return 'divHundredth: the "magnified the divisor only" distractor is missing';
        if (d.opts.indexOf(d.q * 10 + '|n') < 0) return 'divHundredth: the "magnified the dividend only" distractor is missing';
      },
      divWhole: d => {
        if (dpRef(d.a) !== 0) return 'divWhole: the dividend ' + dTextRef(d.a) + ' is not a whole number, so no 0 has to be added';
        if (dpRef(d.b) < 1) return 'divWhole: the divisor ' + dTextRef(d.b) + ' is not a decimal';
        /* 這一支的教學點就是補 0：放大之後被除數一定多出位數 */
        const k = scaleRef(d.b);
        if (dTextRef(d.a * k).length <= dTextRef(d.a).length) return 'divWhole: magnifying ' + dTextRef(d.a) + ' by ' + k + ' added no zero, so this question does not teach padding';
        const p = pairProblems('divWhole', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('divWhole', d); if (f) return f;
        const t = tokProblems('divWhole', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.q + '|n') return 'divWhole: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.q + '|n';
        const e = echoProblems('divWhole', d, [d.a, d.b]); if (e) return e;
        if (d.opts.indexOf(d.q / 10 + '|n') < 0) return 'divWhole: the "forgot the padding zero" distractor is missing';
      },
      divBigDivisor: d => {
        if (sideRef(d.b) !== 'smaller') return 'divBigDivisor: the divisor ' + dTextRef(d.b) + ' is not above 1';
        if (d.q >= d.a) return 'divBigDivisor: the divisor is above 1 but the quotient ' + dTextRef(d.q) + ' is not below the dividend ' + dTextRef(d.a);
        const p = pairProblems('divBigDivisor', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('divBigDivisor', d); if (f) return f;
        const t = tokProblems('divBigDivisor', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.q + '|n') return 'divBigDivisor: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.q + '|n';
        const e = echoProblems('divBigDivisor', d, [d.a, d.b]); if (e) return e;
      },
      placesAsk: d => {
        const p = pairProblems('placesAsk', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('placesAsk', d); if (f) return f;
        const t = tokProblems('placesAsk', d.opts); if (t) return t;
        const want = dpRef(d.b) * 100 + '|pl';
        if (String(d.opts[d.ans]) !== want) return 'placesAsk: opts[ans]=' + d.opts[d.ans] + ' is not ' + want;
        /* 四個選項固定是 1 ~ 4 位，一個都不能少 —— 少一個就等於把答案縮到三選一 */
        for (const v of [100, 200, 300, 400])
          if (d.opts.indexOf(v + '|pl') < 0) return 'placesAsk: the option "' + (v / 100) + ' places" is missing';
        /* ⚠️ 選項是 1 ~ 4，所以被除數不可以剛好是 1 ~ 4（那會變成誘答抄題幹）。 */
        if ([100, 200, 300, 400].indexOf(d.a) >= 0) return 'placesAsk: the dividend ' + dTextRef(d.a) + ' collides with the fixed 1..4 options';
        if (dpRef(d.b) < 1 || dpRef(d.b) > 2) return 'placesAsk: the divisor ' + dTextRef(d.b) + ' needs 1 or 2 places, not ' + dpRef(d.b);
      },
      sameQuotient: d => {
        const p = pairProblems('sameQuotient', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('sameQuotient', d); if (f) return f;
        if (d.k !== scaleRef(d.b)) return 'sameQuotient: k=' + d.k + ' is not the magnification the divisor needs (' + scaleRef(d.b) + ')';
        const want = dTextRef(d.a * d.k) + ' ÷ ' + dTextRef(d.b * d.k);
        if (String(d.opts[d.ans]) !== want) return 'sameQuotient: opts[ans]=' + d.opts[d.ans] + ' is not ' + want;
        /* ⚠️ §六之二：沒有一個錯誤選項可以由正確推理到達 —— 每一個誘答的商都要**真的不等於**正解。 */
        for (let i = 0; i < d.opts.length; i++){
          if (i === d.ans) continue;
          const m = /^(\d+(?:\.\d+)?) ÷ (\d+(?:\.\d+)?)$/.exec(String(d.opts[i]));
          if (!m) return 'sameQuotient: the option "' + d.opts[i] + '" is not an expression of the form "number ÷ number"';
          const ra = ratOf(m[1]), rb = ratOf(m[2]);
          if (!ra || !rb || rb.n === 0) return 'sameQuotient: the option "' + d.opts[i] + '" cannot be evaluated';
          /* 誘答的商 ＝ (ra/rb)，正解的商 ＝ q/100 */
          if (ra.n * rb.d * 100 === rb.n * ra.d * d.q) return 'sameQuotient: the distractor "' + d.opts[i] + '" has the same quotient as the answer';
        }
      },
      compareQuot: d => {
        const p = pairProblems('compareQuot', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('compareQuot', d); if (f) return f;
        const want = sideRef(d.b);
        if (String(d.opts[d.ans]) !== want) return 'compareQuot: opts[ans]=' + d.opts[d.ans] + ' is not ' + want;
        for (const k of d.opts) if (SIDE_KEYS_REF.indexOf(String(k)) < 0) return 'compareQuot: the option key "' + k + '" is unknown to the reference table';
        /* 宣稱和事實要對得上：說商比較大，商就真的要比較大 */
        if (want === 'bigger' && !(d.q > d.a)) return 'compareQuot: the divisor is below 1 but the quotient is not bigger than the dividend';
        if (want === 'smaller' && !(d.q < d.a)) return 'compareQuot: the divisor is above 1 but the quotient is not smaller than the dividend';
        if (want === 'same' && d.q !== d.a) return 'compareQuot: the divisor is exactly 1 but the quotient differs from the dividend';
      },
      wordCut: d => {
        if (CUT_IDS_REF.indexOf(d.id) < 0) return 'wordCut: the scenario "' + d.id + '" is not one of this lesson’s';
        const p = pairProblems('wordCut', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('wordCut', d); if (f) return f;
        const t = tokProblems('wordCut', d.opts); if (t) return t;
        /* ⚠️ 答案是**個數**，一定要是整數 */
        if (d.q % 100 !== 0) return 'wordCut: the answer ' + dTextRef(d.q) + ' is not a whole count of pieces';
        const u = CUT_UNIT_REF[d.id];
        if (String(d.opts[d.ans]) !== d.q + '|' + u) return 'wordCut: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.q + '|' + u;
        for (const o of d.opts) if (String(o).split('|')[1] !== u) return 'wordCut: the option ' + o + ' carries a different unit from the answer';
        const e = echoProblems('wordCut', d, [d.a, d.b]); if (e) return e;
      },
      wordUnit: d => {
        if (UNIT_IDS_REF.indexOf(d.id) < 0) return 'wordUnit: the scenario "' + d.id + '" is not one of this lesson’s';
        const p = pairProblems('wordUnit', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('wordUnit', d); if (f) return f;
        const t = tokProblems('wordUnit', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.q + '|yuan') return 'wordUnit: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.q + '|yuan';
        for (const o of d.opts) if (String(o).split('|')[1] !== 'yuan') return 'wordUnit: the option ' + o + ' is not a price';
        /* ⚠️ 題幹一定印出「1 個單位」的那個 1，所以 1 元不可以當誘答 */
        const e = echoProblems('wordUnit', d, [d.a, d.b, 100]); if (e) return e;
        /* 數量比 1 小 → 1 個單位比較貴；比 1 大 → 比較便宜。解釋就是這樣寫的。 */
        if (sideRef(d.b) === 'bigger' && !(d.q > d.a)) return 'wordUnit: the amount is below 1 unit but 1 unit does not cost more than the amount given';
        if (sideRef(d.b) === 'smaller' && !(d.q < d.a)) return 'wordUnit: the amount is above 1 unit but 1 unit does not cost less than the amount given';
      },
      decQuotient: d => {
        const p = pairProblems('decQuotient', d.a, d.b, d.q); if (p) return p;
        const f = fourDistinct('decQuotient', d); if (f) return f;
        const t = tokProblems('decQuotient', d.opts); if (t) return t;
        /* 這一支存在的理由就是「商可以是小數」—— 整數商在這裡是缺陷 */
        if (d.q % 100 === 0) return 'decQuotient: the quotient ' + dTextRef(d.q) + ' is a whole number, so this question does not make its point';
        if (String(d.opts[d.ans]) !== d.q + '|n') return 'decQuotient: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.q + '|n';
        const e = echoProblems('decQuotient', d, [d.a, d.b]); if (e) return e;
      },
      interDecInt: d => {
        if (!(Number.isInteger(d.n) && d.n >= 2 && d.n <= 9)) return 'interDecInt: the divisor ' + d.n + ' is not a whole number in 2..9';
        if (dpRef(d.a) < 1) return 'interDecInt: the dividend ' + dTextRef(d.a) + ' is not a decimal, so it is not the grade-five question type';
        if (d.a !== d.n * d.q) return 'interDecInt: ' + dTextRef(d.a) + ' ÷ ' + d.n + ' is not ' + dTextRef(d.q);
        const f = fourDistinct('interDecInt', d); if (f) return f;
        const t = tokProblems('interDecInt', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.q + '|n') return 'interDecInt: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.q + '|n';
        const e = echoProblems('interDecInt', d, [d.a, d.n * 100]); if (e) return e;
      },
      interRatio: d => {
        if (!(Number.isInteger(d.b) && d.b >= 2 && d.b <= 9)) return 'interRatio: the second term ' + d.b + ' is outside 2..9';
        if (!(Number.isInteger(d.k) && d.k >= 2 && d.k <= 9)) return 'interRatio: the ratio value ' + d.k + ' is outside 2..9';
        if (d.b * d.k > 30) return 'interRatio: the first term ' + (d.b * d.k) + ' leaves the grade-six ratio lesson’s range of 30';
        const f = fourDistinct('interRatio', d); if (f) return f;
        const t = tokProblems('interRatio', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.k * 100 + '|n') return 'interRatio: opts[ans]=' + d.opts[d.ans] + ' is not ' + (d.k * 100) + '|n';
        const e = echoProblems('interRatio', d, [d.b * 100, d.b * d.k * 100]); if (e) return e;
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'divTenth': case 'divHundredth': case 'divWhole': case 'divBigDivisor': case 'decQuotient':
          return dTextRef(quotRef(d.a, d.b));
        case 'placesAsk': return withUnitRef(lang, 'pl', String(dpRef(d.b)));
        case 'sameQuotient': { const k = scaleRef(d.b); return dTextRef(d.a * k) + ' ÷ ' + dTextRef(d.b * k); }
        case 'compareQuot': { const s = sideRef(d.b); return s === null ? null : SIDES_REF[s][lang]; }
        case 'wordCut': return withUnitRef(lang, CUT_UNIT_REF[d.id], dTextRef(quotRef(d.a, d.b)));
        case 'wordUnit': return withUnitRef(lang, 'yuan', dTextRef(quotRef(d.a, d.b)));
        case 'interDecInt': return dTextRef(d.a / d.n);
        case 'interRatio': return String(d.k);
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣：一個數（可帶單位）、一句釘住的話、或一條「數 ÷ 數」的算式。 */
    optionOk: function(s, genId, lang, isCorrect){
      const t = String(s).trim();
      if (!t) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
      if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
      if (lang === 'en' && /\p{Script=Han}/u.test(t)) return 'English option contains Chinese: ' + t;
      if (genId === 'compareQuot')
        return sideKeyOfText(t, lang) !== null ? null : 'compareQuot option is not one of the pinned sentences: ' + t;
      if (genId === 'sameQuotient')
        return /^\d+(?:\.\d+)? ÷ \d+(?:\.\d+)?$/.test(t)
          ? null : 'sameQuotient option is not an expression of the form "number ÷ number": ' + t;
      const p = parseOptRef(t, lang);
      if (!p) return genId + ' option is not "<number> <unit>" in this lesson’s writing: ' + t;
      if (p.h < 1 || p.h > 50000) return genId + ' option ' + t + ' leaves the lesson range';
      const wantUnit = genId === 'placesAsk' ? 'pl'
                     : genId === 'wordUnit' ? 'yuan'
                     : genId === 'wordCut' ? null            /* 段／瓶／袋 隨情境，由不變條件釘住 */
                     : 'n';
      if (wantUnit !== null && p.u !== wantUnit) return genId + ' option "' + t + '" carries the unit "' + p.u + '", expected "' + wantUnit + '"';
      if (genId === 'wordCut' && ['seg', 'bot', 'bag'].indexOf(p.u) < 0) return 'wordCut option "' + t + '" does not carry a count unit';
      if (genId === 'placesAsk' && (p.h < 100 || p.h > 400 || p.h % 100 !== 0)) return 'placesAsk option "' + t + '" is not a whole number of places in 1..4';
      if (isCorrect && genId === 'wordCut' && p.h % 100 !== 0) return 'wordCut marked option "' + t + '" is not a whole count';
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次：整句題幹重建、值去重、算式算對、字串乾淨。 */
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
      const keys = q.opts.map(o => optKeyRef(o, lang));
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
        if (keys[i] === keys[j]) out.push('two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
      /* ⚠️ 從**印出來的**題幹讀回數字再和誘答的值比對。simgen 內建的那一條比的是整串字，
         而這一課的選項常常帶單位，所以它比不到 —— 真正的比對在這裡。
         sameQuotient 的選項本來就是用題幹的數組出來的，不算抄題。 */
      if (genId !== 'compareQuot' && genId !== 'sameQuotient'){
        const stemNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(v => Math.round(Number(v) * 100));
        q.opts.forEach((o, oi) => {
          if (oi === q.ans) return;
          const p = parseOptRef(o, lang);
          if (p && stemNums.indexOf(p.h) >= 0) out.push('the distractor "' + o + '" copies a number the stem prints');
        });
      }
      const ar = decArith(q.stem + ' ' + q.why);
      ar.problems.forEach(m => out.push(m));
      if (genId !== 'compareQuot' && ar.verified < 1)
        out.push('the explanation should contain an equation to verify, but none was read');
      stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
      stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
      q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
      const wantText = module.exports.sim.expectedCorrect(d, genId, lang);
      if (wantText !== null && q.opts[q.ans] !== wantText) out.push('the marked option is not "' + wantText + '"');
      if (genId === 'compareQuot'){
        const keysSeen = q.opts.map(o => sideKeyOfText(o, lang));
        if (keysSeen.some(k => k === null)) out.push('an option is not one of the pinned comparison sentences: ' + q.opts.join(' | '));
        if (new Set(keysSeen).size !== 4) out.push('the four comparison sentences are not all different');
      }
      /* 這一課明講不做的東西，一個字都不可以從產生器漏出來 */
      FORBIDDEN.forEach(f => { if (f.re.test(q.stem + ' ' + q.why)) out.push('the question says something out of scope: ' + f.why); });
      return out.length ? out.join('; ') : null;
    },

    /* 這一課的選項常常帶單位，所以 simgen 內建的「誘答抄題幹」比的是整串字，永遠比不到；
       真正的比對在上面 renderCheck 裡（比**值**）。這裡一律不放行。 */
    stemEchoOk: (function(){
      /* ⚠️ simgen 內建的抄題檢查用 /\d+/ 切題幹，所以 `0.4` 會被切成 `0` 和 `4` ——
         選項「4」就被當成抄題。這個謂詞**只放行那一種切錯**：把題幹的數字用完整的小數
         正規式重讀一次，選項的值真的不在裡面才放行。真正的抄題照樣會響
         （renderCheck 那邊還會再用**值**比一次，兩邊各自獨立說話）。 */
      const allow = {};
      GEN_IDS.forEach(genId => {
        allow[genId] = function(d, opt, lang){
          const stem = stemRef(genId, d, lang);
          if (stem === null) return false;
          const nums = String(stem).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || [];
          return nums.indexOf(String(opt)) < 0;
        };
      });
      return allow;
    })()
  },

  /* ================= index.html 靜態資料檢查（tools/verify_lesson_data.js） ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{A_MIN_H, A_MAX_H, B_MIN_H, B_MAX_H, Q_MIN_H, Q_MAX_H, isPosInt, okA, okB, okQ, dpOf, scaleOf, dText, quotH, bigPair, sideOf, ' +
                'FIG_W, FIG_H, LABEL_X, LABEL_A_Y, LABEL_B_Y, LABEL_FS, LABEL_MAX, ' +
                'CELL_W, CELL_H, CELL_X0, CELL_Y, CELL_MAX, PER_MIN, PER_MAX, GROUP_MAX, CELL_NUM_FS, ' +
                'LAD_ROW_Y, LAD_BOX_H, LAD_FS, LAD_DV_X, LAD_DV_W, LAD_SYM_X, LAD_DS_X, LAD_DS_W, LAD_EQ_X, LAD_Q_X, LAD_Q_W, LAD_ARROW_X, LAD_ARROW_TX, LAD_ARROW_FS, ' +
                'SH_CH_W, SH_FS, SH_DV_X0, SH_DS_X0, SH_SYM_X, SH_TOP_Y, SH_BOT_Y, SH_DOT_DY, SH_DOT_R, SH_ARROW_Y1, SH_ARROW_Y2, SH_COL_MAX, ' +
                'CMP_X0, CMP_X1, CMP_Y, CMP_FS, CMP_A_TOP, CMP_Q_TOP, CMP_ZERO_Y, CMP_DOT_R, CMP_HEAD, ' +
                'UNI_X0, UNI_X1, UNI_TOP_Y, UNI_BOT_Y, UNI_FS, UNI_VAL_Y, UNI_AMT_Y, UNI_DOT_R, UNI_HEAD, ' +
                'digitCols, shiftRow, planCells, planLadder, planShift, planCompare, planUnit, ' +
                'S1_CASES, S2_CASES, S3_CASES, S4_CASES, S5_CASES, caseAnswerH, caseFigure, ' +
                'ROUNDS, roundAnswer, roundAnswerIndex, roundFigure, roundUnit, plEn, withUnit, UNIT_WORD}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器自己先過 PROBE ---- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = decArith(pr.text).problems.length > 0;
        if (caught !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"' + (caught ? ': ' + decArith(pr.text).problems[0] : ''));
      });
      /* ⚠️ PROBE 也會把算式推進 DEC_SEEN，所以覆蓋率要從這裡歸零重數。 */
      DEC_SEEN.length = 0;

      const lessonDir = path.dirname(process.argv[2]);   /* ⚠️ 不可以用 __dirname：breaktest 把四頁複製到暫存目錄 */
      const RAW = {}, TEXT = {}, DICT = {};
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        const f = path.join(lessonDir, pg + '.html');
        RAW[pg] = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
        if (!RAW[pg]) fail('the page ' + pg + '.html is missing');
        TEXT[pg] = visibleText(RAW[pg]);
        DICT[pg] = i18nOf(RAW[pg]);
        if (DICT[pg] === null) fail('the I18N dictionary of ' + pg + '.html could not be read — nothing on that page is being checked');
      });

      /* ---- 1. 常數對得上（設定檔的第二份 vs 課程頁） ---- */
      const CONSTS = [
        ['A_MIN_H', A_MIN_REF], ['A_MAX_H', A_MAX_REF], ['B_MIN_H', B_MIN_REF], ['B_MAX_H', B_MAX_REF],
        ['Q_MIN_H', Q_MIN_REF], ['Q_MAX_H', Q_MAX_REF],
        ['FIG_W', FIG_W_REF], ['FIG_H', FIG_H_REF], ['LABEL_X', LABEL_X_REF], ['LABEL_A_Y', LABEL_A_Y_REF],
        ['LABEL_B_Y', LABEL_B_Y_REF], ['LABEL_FS', LABEL_FS_REF], ['LABEL_MAX', LABEL_MAX_REF],
        ['CELL_W', CELL_W_REF], ['CELL_H', CELL_H_REF], ['CELL_X0', CELL_X0_REF], ['CELL_Y', CELL_Y_REF],
        ['CELL_MAX', CELL_MAX_REF], ['PER_MIN', PER_MIN_REF], ['PER_MAX', PER_MAX_REF], ['GROUP_MAX', GROUP_MAX_REF],
        ['CELL_NUM_FS', CELL_NUM_FS_REF], ['LAD_BOX_H', LAD_BOX_H_REF], ['LAD_FS', LAD_FS_REF],
        ['LAD_DV_X', LAD_DV_X_REF], ['LAD_DV_W', LAD_DV_W_REF], ['LAD_SYM_X', LAD_SYM_X_REF],
        ['LAD_DS_X', LAD_DS_X_REF], ['LAD_DS_W', LAD_DS_W_REF], ['LAD_EQ_X', LAD_EQ_X_REF],
        ['LAD_Q_X', LAD_Q_X_REF], ['LAD_Q_W', LAD_Q_W_REF], ['LAD_ARROW_X', LAD_ARROW_X_REF],
        ['LAD_ARROW_TX', LAD_ARROW_TX_REF], ['LAD_ARROW_FS', LAD_ARROW_FS_REF],
        ['SH_CH_W', SH_CH_W_REF], ['SH_FS', SH_FS_REF], ['SH_DV_X0', SH_DV_X0_REF], ['SH_DS_X0', SH_DS_X0_REF],
        ['SH_SYM_X', SH_SYM_X_REF], ['SH_TOP_Y', SH_TOP_Y_REF], ['SH_BOT_Y', SH_BOT_Y_REF],
        ['SH_DOT_DY', SH_DOT_DY_REF], ['SH_DOT_R', SH_DOT_R_REF], ['SH_ARROW_Y1', SH_ARROW_Y1_REF],
        ['SH_ARROW_Y2', SH_ARROW_Y2_REF], ['SH_COL_MAX', SH_COL_MAX_REF],
        ['CMP_X0', CMP_X0_REF], ['CMP_X1', CMP_X1_REF], ['CMP_Y', CMP_Y_REF], ['CMP_FS', CMP_FS_REF],
        ['CMP_A_TOP', CMP_A_TOP_REF], ['CMP_Q_TOP', CMP_Q_TOP_REF], ['CMP_ZERO_Y', CMP_ZERO_Y_REF],
        ['CMP_DOT_R', CMP_DOT_R_REF], ['CMP_HEAD', CMP_HEAD_REF],
        ['UNI_X0', UNI_X0_REF], ['UNI_X1', UNI_X1_REF], ['UNI_TOP_Y', UNI_TOP_Y_REF], ['UNI_BOT_Y', UNI_BOT_Y_REF],
        ['UNI_FS', UNI_FS_REF], ['UNI_VAL_Y', UNI_VAL_Y_REF], ['UNI_AMT_Y', UNI_AMT_Y_REF],
        ['UNI_DOT_R', UNI_DOT_R_REF], ['UNI_HEAD', UNI_HEAD_REF]
      ];
      CONSTS.forEach(([name, want]) => { if (data[name] !== want) fail('layout constant ' + name + ' is ' + data[name] + ', the checker expects ' + want); });
      if (String(data.LAD_ROW_Y) !== String(LAD_ROW_Y_REF)) fail('LAD_ROW_Y is ' + data.LAD_ROW_Y + ', the checker expects ' + LAD_ROW_Y_REF);

      /* ---- 1b. 畫布的 markup：六張圖的 viewBox 與 CSS 的框必須和座標系一致 ----
         ⚠️ planProblems 印的是**設定檔自己組的** SVG，所以它看不到頁面上的 viewBox；
            viewBox 被改小的話圖會整張縮起來，要在這裡讀 markup 才抓得到。 */
      const svgTags = RAW.index.match(/<svg class="decfig"[^>]*>/g) || [];
      if (svgTags.length !== 6) fail('index.html has ' + svgTags.length + ' figure canvases, the checker expects 6');
      svgTags.forEach((t, i) => {
        if (t.indexOf('viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '"') < 0)
          fail('a canvas viewBox is not "0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '": ' + t);
      });
      const cssRule = RAW.index.match(/\.decfig\{[^}]*\}/);
      if (!cssRule) fail('the .decfig CSS rule is gone, so the figures have no box');
      else {
        const cw = /max-width:(\d+)px/.exec(cssRule[0]), ch = /height:(\d+)px/.exec(cssRule[0]);
        if (!cw || !ch) fail('the .decfig rule no longer states both a max-width and a height: ' + cssRule[0]);
        else if (Number(cw[1]) !== FIG_W_REF || Number(ch[1]) !== FIG_H_REF)
          fail('the figures are ' + cw[1] + '×' + ch[1] + ' in CSS but the viewBox is ' + FIG_W_REF + '×' + FIG_H_REF + ' — the browser would shrink every drawing');
      }

      /* ---- 2. 小數怎麼印：兩套實作對 1 ~ 200000 的每一個值都要同意 ---- */
      for (let h = 1; h <= 200000; h++)
        if (data.dText(h) !== dTextRef(h)){ fail('dText(' + h + ') is "' + data.dText(h) + '", the second implementation says "' + dTextRef(h) + '"'); break; }
      if (data.dText(-1) !== '?' || data.dText(1.5) !== '?') fail('dText does not fail closed on a broken value');

      /* ---- 3. 小數位數與放大倍數：兩套實作（取餘數 vs 數印出來的位數）要同意 ---- */
      for (let h = 1; h <= 20000; h++){
        if (data.dpOf(h) !== dpRef(h)){ fail('dpOf(' + h + ') is ' + data.dpOf(h) + ', counting the printed digits gives ' + dpRef(h)); break; }
        if (data.scaleOf(h) !== scaleRef(h)){ fail('scaleOf(' + h + ') is ' + data.scaleOf(h) + ', the second implementation says ' + scaleRef(h)); break; }
      }
      if (data.dpOf(0) !== -1 || data.scaleOf(0) !== null) fail('dpOf/scaleOf do not fail closed on 0');

      /* ---- 4. 商：兩套實作（整數算 vs 走印出來的字）要同意，範圍外一律 null ---- */
      let quotChecked = 0;
      for (let b = B_MIN_REF; b <= 400; b++){
        for (let q = Q_MIN_REF; q <= 3000; q += 10){
          const a = b * q / 100;
          if (!Number.isInteger(a) || a < A_MIN_REF || a > A_MAX_REF) continue;
          quotChecked++;
          if (data.quotH(a, b) !== quotRef(a, b)){ fail('quotH(' + a + ', ' + b + ') is ' + data.quotH(a, b) + ', the second implementation says ' + quotRef(a, b)); b = 1e9; break; }
        }
      }
      if (quotChecked < 5000) fail('the quotient cross-check only ran ' + quotChecked + ' times — it may have stopped early');
      if (data.quotH(360, 0) !== null || data.quotH(0, 40) !== null || data.quotH(100, 30) !== null)
        fail('quotH does not fail closed on a bad pair or a division that does not come out exactly');
      if (data.quotH(9990, 5) !== null) fail('quotH does not refuse a quotient outside 1..100');
      /* ⚠️ 兩位小數的商也要拒絕（這一課說商最多一位小數）。上面的交叉比對用 10 的倍數掃商，
         永遠碰不到這一種，所以要單獨探一次。 */
      if (data.quotH(126, 40) !== null) fail('quotH accepts 1.26 ÷ 0.4, whose quotient 3.15 has two decimal places');
      if (data.quotH(105, 40) !== null) fail('quotH accepts a quotient with two decimal places');

      /* ---- 5. 這一課明講的三條規則，列舉證明 ---- */
      let ruleRows = 0;
      for (let b = B_MIN_REF; b <= 400; b++){
        if (dpRef(b) === 0) continue;
        const k = scaleRef(b);
        if (dpRef(b * k) !== 0) fail('multiplying the divisor ' + dTextRef(b) + ' by ' + k + ' does not make it whole');
        for (let q = Q_MIN_REF; q <= 2000; q += 10){
          const a = b * q / 100;
          if (!Number.isInteger(a) || a < A_MIN_REF || a > A_MAX_REF) continue;
          ruleRows++;
          /* 規則一：兩個數同時放大，商不變 */
          for (const kk of [10, 100]){
            const big = data.quotH(a * kk, b * kk);
            if (big !== null && big !== q){ fail('magnifying ' + dTextRef(a) + ' ÷ ' + dTextRef(b) + ' by ' + kk + ' changed the quotient'); b = 1e9; q = 1e9; break; }
          }
          /* 規則二：除數比 1 小 → 商比被除數大；比 1 大 → 商比被除數小 */
          const side = sideRef(b);
          if (side === 'bigger' && !(q > a)){ fail('the divisor ' + dTextRef(b) + ' is below 1 but ' + dTextRef(a) + ' ÷ ' + dTextRef(b) + ' is not bigger than the dividend'); b = 1e9; break; }
          if (side === 'smaller' && !(q < a)){ fail('the divisor ' + dTextRef(b) + ' is above 1 but ' + dTextRef(a) + ' ÷ ' + dTextRef(b) + ' is not smaller than the dividend'); b = 1e9; break; }
          if (data.sideOf(b) !== side){ fail('sideOf(' + b + ') is ' + data.sideOf(b) + ', the second implementation says ' + side); b = 1e9; break; }
        }
      }
      if (ruleRows < 3000) fail('the rule enumeration only ran ' + ruleRows + ' rows — it may have stopped early');
      if (data.sideOf(100) !== 'same') fail('sideOf does not report "same" for a divisor of exactly 1');

      /* ---- 6. bigPair：放大之後的那一對 ---- */
      S3_CASES_REF.forEach(([a, b]) => {
        const p = data.bigPair(a, b), k = scaleRef(b);
        if (!p) return fail('bigPair(' + a + ', ' + b + ') returned nothing');
        if (p.k !== k || p.a !== a * k || p.b !== b * k) fail('bigPair(' + a + ', ' + b + ') is ' + JSON.stringify(p) + ', the checker expects k=' + k);
        if (dpRef(p.b) !== 0) fail('bigPair left the divisor a decimal for ' + dTextRef(b));
      });
      if (data.bigPair(360, 100) !== null) fail('bigPair does not refuse a divisor that is already whole');

      /* ---- 7. 五段範例的案例表與圖 ---- */
      const eq = (got, want, what) => { if (String(got) !== String(want)) fail(what + ': the page has ' + JSON.stringify(got) + ', the checker expects ' + JSON.stringify(want)); };
      eq(data.S1_CASES.map(s => [s.a, s.b]), S1_CASES_REF, 'S1_CASES');
      eq(data.S2_CASES.map(s => [s.a, s.b]), S2_CASES_REF, 'S2_CASES');
      eq(data.S3_CASES.map(s => [s.a, s.b]), S3_CASES_REF, 'S3_CASES');
      eq(data.S4_CASES.map(s => [s.a, s.b]), S4_CASES_REF, 'S4_CASES');
      eq(data.S5_CASES.map(s => s.kind === 'cut' ? [s.kind, s.id, s.a, s.b] : [s.kind, s.id, s.amt, s.val]), S5_CASES_REF, 'S5_CASES');

      const LONG = 'x'.repeat(LABEL_MAX_REF);
      S1_CASES_REF.forEach(([a, b]) => planProblems('cells ' + dTextRef(a) + '/' + dTextRef(b), data.planCells(a, b), refCellPrims(a, b), LONG).forEach(fail));
      S2_CASES_REF.forEach(([a, b]) => planProblems('ladder ' + dTextRef(a) + '/' + dTextRef(b), data.planLadder(a, b), refLadderPrims(a, b), LONG).forEach(fail));
      S3_CASES_REF.forEach(([a, b]) => planProblems('shift ' + dTextRef(a) + '/' + dTextRef(b), data.planShift(a, b), refShiftPrims(a, b).prims, LONG).forEach(fail));
      S4_CASES_REF.forEach(([a, b]) => planProblems('compare ' + dTextRef(a) + '/' + dTextRef(b), data.planCompare(a, b), refComparePrims(a, b).prims, LONG).forEach(fail));
      S5_CASES_REF.forEach(([kind, id, x, y]) => {
        const sc = data.S5_CASES.filter(s => s.id === id)[0];
        const pl = data.caseFigure(sc);
        if (kind === 'cut') planProblems('s5 ' + id, pl, refCellPrims(x, y), LONG).forEach(fail);
        else planProblems('s5 ' + id, pl, refUnitPrims(x, y).prims, LONG).forEach(fail);
        const want = kind === 'cut' ? quotRef(x, y) : quotRef(y, x);
        /* ⚠️ 先擋 null：兩邊都算不出來的時候 null === null 會靜靜通過。
           （同上，這一條也沒有改壞測試：上面的案例表比對會先響。） */
        if (want === null) fail('s5 ' + id + ': the checker cannot work out this example’s answer — the numbers do not divide exactly inside this lesson’s range');
        else if (data.caseAnswerH(sc) !== want) fail('s5 ' + id + ': the answer is ' + data.caseAnswerH(sc) + ', the checker expects ' + want);
      });

      /* ⚠️ 「小數點搬家」那張圖的不變式：下排的小數點欄 － 上排的小數點欄 ＝ 放大的位數。
         這一條和「畫得下嗎」無關 —— 它問的是**畫出來的是不是那件事**。 */
      let shiftRows = 0;
      for (let b = B_MIN_REF; b <= 400; b++){
        if (dpRef(b) === 0) continue;
        const k = scaleRef(b);
        for (let q = Q_MIN_REF; q <= 1000; q += 10){
          const a = b * q / 100;
          if (!Number.isInteger(a) || a < A_MIN_REF || a > A_MAX_REF) continue;
          for (const h of [a, b]){
            const got = data.shiftRow(h, k), wantRow = refShiftRow(h, k);
            shiftRows++;
            if (got.startCol !== wantRow.startCol || got.pad !== wantRow.pad || got.top.p !== wantRow.top.p || got.bot.p !== wantRow.bot.p){
              fail('shiftRow(' + h + ', ' + k + ') is ' + JSON.stringify(got) + ', the checker rebuilt ' + JSON.stringify(wantRow)); b = 1e9; q = 1e9; break;
            }
            if (got.startCol < 0){ fail('shiftRow(' + h + ', ' + k + ') starts at a negative column'); b = 1e9; q = 1e9; break; }
            if (got.startCol + got.bot.p - got.top.p !== got.shift){
              fail('the decimal point of ' + dTextRef(h) + ' moves ' + (got.startCol + got.bot.p - got.top.p) + ' columns, but the magnification is ' + got.shift + ' places');
              b = 1e9; q = 1e9; break;
            }
          }
        }
      }
      if (shiftRows < 3000) fail('the decimal-point invariant only ran ' + shiftRows + ' times — it may have stopped early');

      /* 範圍外的圖一律 tooBig 而且一個圖元都不畫（fail closed） */
      const OUT = [
        ['planCells too many cells', data.planCells(600, 40)],
        ['planCells group too small', data.planCells(360, 20)],
        ['planCells not tenths', data.planCells(245, 70)],
        ['planLadder whole divisor', data.planLadder(360, 100)],
        ['planShift whole divisor', data.planShift(360, 100)],
        ['planCompare does not divide', data.planCompare(100, 30)],
        ['planUnit does not divide', data.planUnit(30, 100)]
      ];
      OUT.forEach(([what, pl]) => {
        if (!pl || !pl.tooBig) fail(what + ': the figure drew something although it is outside its range');
        else if (pl.prims.length !== 0) fail(what + ': tooBig but ' + pl.prims.length + ' pieces were still drawn');
      });

      /* ---- 8. 小遊戲的五關 ---- */
      if (data.ROUNDS.length !== GAME_ROUNDS_REF) fail('the game has ' + data.ROUNDS.length + ' rounds, not ' + GAME_ROUNDS_REF);
      const ROUND_UNIT_REF = { factor:'x', sameDiv:'none', quot:'none', compare:'none', word:'seg' };
      data.ROUNDS.forEach((r, i) => {
        const tag = 'game round ' + (i + 1);
        if (data.roundUnit(r) !== ROUND_UNIT_REF[r.kind]) fail(tag + ': the unit is ' + data.roundUnit(r) + ', the checker expects ' + ROUND_UNIT_REF[r.kind]);
        if (new Set(r.opts.map(String)).size !== 4) fail(tag + ': the four options are not all different');
        const at = data.roundAnswerIndex(r);
        if (at < 0) fail(tag + ': no option matches the computed answer');
        if (at !== r.ans) fail(tag + ': the computed answer sits at ' + at + ' but the data declares ' + r.ans);
        let want = null;
        if (r.kind === 'factor') want = String(scaleRef(r.b));
        else if (r.kind === 'sameDiv') want = dTextRef(r.a * scaleRef(r.b)) + ' ÷ ' + dTextRef(r.b * scaleRef(r.b));
        else if (r.kind === 'quot' || r.kind === 'word') want = dTextRef(quotRef(r.a, r.b));
        else if (r.kind === 'compare') want = sideRef(r.b);
        if (String(data.roundAnswer(r)) !== String(want)) fail(tag + ': roundAnswer is "' + data.roundAnswer(r) + '", the checker computes "' + want + '"');
        /* 每一關的圖都要和重建的一模一樣 */
        const pl = data.roundFigure(r);
        if (r.kind === 'factor') planProblems(tag, pl, refShiftPrims(r.a, r.b).prims, LONG).forEach(fail);
        else if (r.kind === 'sameDiv') planProblems(tag, pl, refLadderPrims(r.a, r.b), LONG).forEach(fail);
        else if (r.kind === 'quot' || r.kind === 'word') planProblems(tag, pl, refCellPrims(r.a, r.b), LONG).forEach(fail);
        else if (r.kind === 'compare') planProblems(tag, pl, refComparePrims(r.a, r.b).prims, LONG).forEach(fail);
        /* 「哪一個是錯的」也要真的錯：每一個誘答都不可以等於正解 */
        r.opts.forEach((o, oi) => { if (oi !== at && String(o) === String(want)) fail(tag + ': the distractor "' + o + '" equals the answer'); });
      });
      if (data.roundAnswer({ kind:'nope' }) !== null) fail('roundAnswer does not fail closed on an unknown round kind');
      if (data.withUnit('zh', 'nope', '9') !== '?') fail('withUnit does not fail closed on an unknown unit');
      if (data.plEn(1, 'piece') !== '1 piece' || data.plEn(2, 'piece') !== '2 pieces') fail('plEn gets the English plural wrong');

      /* ---- 9. 題庫：每一題在問什麼、正解印成什麼字，都各自算一次 ---- */
      ['zh', 'en'].forEach(lang => {
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          const list = I18N[lang][bank], ref = QBANK_REF[bank];
          if (!Array.isArray(list) || list.length !== ref.length) return fail(lang + ' ' + bank + ' has ' + (list || []).length + ' questions, the checker expects ' + ref.length);
          list.forEach((q, qi) => {
            const tag = lang + ' ' + bank + '[' + qi + ']';
            const r = ref[qi];
            if (q.opts.length !== 4) fail(tag + ': there are ' + q.opts.length + ' options, not four');
            if (!(q.ans >= 0 && q.ans < q.opts.length)) fail(tag + ': the answer index is out of range');
            if (q.ans !== I18N.zh[bank][qi].ans) fail(tag + ': the answer index differs from the Chinese bank');
            /* 值去重（帶單位的也比單位；句子型比整句） */
            const keys = q.opts.map(o => optKeyRef(String(o).replace(/<[^>]+>/g, ''), lang));
            for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
              if (keys[i] === keys[j]) fail(tag + ': two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
            /* 正解的字 */
            const want = bankAnswerRef(r, lang);
            if (want !== null){
              const got = String(q.opts[q.ans]).replace(/<[^>]+>/g, '').trim();
              /* ⚠️ 比大小那一題以前用 indexOf：一句「不是比 2.4 大」也會通過。改成整句相等。 */
              if (got !== want) fail(tag + ': the marked option is "' + got + '", the checker computes "' + want + '"');
            } else if (r.kind === 'sentence'){
              if (q.ans !== r.ans) fail(tag + ': the marked option sits at ' + q.ans + ', the checker pinned ' + r.ans);
            } else {
              /* ⚠️ 算不出正解就是**這一題出了問題**（除不盡、超出範圍），不是「沒什麼好比的」。
                 以前這裡直接落地，整題一個字都沒驗（2026-09-21 codex 指出的 null fail-open）。
                 ⚠️ 這一條**沒有改壞測試**：要觸發它只能把上面 QBANK_REF 的數字改成除不盡的一組，
                 而 breaktest 只改得動四個頁面、改不動這個檔案。它擋的是「以後有人改這份設定」。 */
              fail(tag + ': the checker cannot work out an answer for a "' + r.kind + '" question — the numbers do not divide exactly inside this lesson’s range');
            }
            /* 題幹要真的印出這一題用到的數 */
            /* ⚠️ 不可以用 indexOf：要 `6` 的話 `0.6` 和 `60` 都會過，題幹就可以換成另一題而不響。
               要把題幹的數字**整個切出來**再比（2026-09-21 codex 抓到）。 */
            const printed = String(q.stem).replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || [];
            bankStemNumsRef(r).forEach(n => {
              if (printed.indexOf(n) < 0) fail(tag + ': the stem never prints ' + n + ' (it prints ' + printed.join(', ') + ')');
            });
            /* 算式逐條驗算 ＋ 字串乾淨 ＋ 沒有超出範圍的用詞 */
            const ar = decArith(q.stem + ' ' + q.why);
            ar.problems.forEach(m => fail(tag + ': ' + m));
            if (r.kind !== 'sentence' && r.kind !== 'side' && ar.verified < 1) fail(tag + ': the explanation contains no equation to verify');
            stringProblems(q.stem, lang, tag + ' stem').forEach(fail);
            stringProblems(q.why, lang, tag + ' why').forEach(fail);
            q.opts.forEach((o, oi) => stringProblems(o, lang, tag + ' option ' + oi).forEach(fail));
            FORBIDDEN.forEach(f => { if (lang === 'zh' && f.re.test(visibleText(q.stem + ' ' + q.why))) fail(tag + ': ' + f.why); });
          });
        });
        /* 正解位置不可以全押同一格 */
        const all = I18N[lang].qs.concat(I18N[lang].qsAdv, I18N[lang].qsBoost).map(q => q.ans);
        if (new Set(all).size < 3) fail(lang + ': the correct option sits in only ' + new Set(all).size + ' distinct positions across the whole bank');
      });

      /* ---- 10. 範例的旁白、算式與結果：拿字典求值出來的字逐條驗算 ---- */
      let exampleEqs = 0;
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang];
        const runs = [];
        data.S1_CASES.forEach(sc => runs.push(['s1', sc, [d.s1cap(sc), d.s1narr(sc), d.s1calc(sc), d.s1result(sc), d.s1labelA(sc), d.s1labelB(sc), d.s1chip(sc)]]));
        data.S2_CASES.forEach(sc => runs.push(['s2', sc, [d.s2cap, d.s2narr(sc), d.s2calc(sc), d.s2result(sc), d.s2labelA, d.s2labelB, d.s2chip(sc)]]));
        data.S3_CASES.forEach(sc => runs.push(['s3', sc, [d.s3cap(sc), d.s3narr(sc), d.s3calc(sc), d.s3result(sc), d.s3labelA(sc), d.s3labelB(sc), d.s3chip(sc)]]));
        data.S4_CASES.forEach(sc => runs.push(['s4', sc, [d.s4cap, d.s4narr(sc), d.s4calc(sc), d.s4result(sc), d.s4labelA(sc), d.s4labelB(sc), d.s4chip(sc)]]));
        data.S5_CASES.forEach(sc => runs.push(['s5', sc, [d.s5cap(sc), d.s5narr(sc), d.s5calc(sc), d.s5result(sc), d.s5labelA(sc), d.s5labelB(sc), d.s5chip(sc), d.s5stem(sc)]]));
        data.ROUNDS.forEach(r => runs.push(['game', r, [d.gCap[r.kind], d.gPrompt[r.kind](r), d.gLabelA(r), d.gLabelB(r), d.gHint1[r.kind], d.gHint2[r.kind](r)]
          .concat(r.opts.map((o, oi) => d.gOptText(r, oi)))]));
        runs.forEach(([tag, sc, texts]) => {
          texts.forEach((t, ti) => {
            const where = lang + ' ' + tag + '[' + ti + ']';
            if (typeof t !== 'string' || !t.trim()) return fail(where + ' is empty');
            if (String(t).length > 0 && ti >= 4 && ti <= 5 && tag !== 'game' && [...String(t)].length > LABEL_MAX_REF)
              fail(where + ': the label is ' + [...String(t)].length + ' characters, over the ' + LABEL_MAX_REF + ' the canvas was measured for');
            const ar = decArith(t);
            ar.problems.forEach(m => fail(where + ': ' + m));
            exampleEqs += ar.verified;
            stringProblems(t, lang, where).forEach(fail);
          });
        });
      });
      /* 76 是這一輪量出來的真實條數（不是寬鬆的估計）：掉下來就表示有一段旁白不再被驗算。 */
      if (exampleEqs < 76) fail('the example narration only produced ' + exampleEqs + ' verified equations — the checker may have stopped reading them');

      /* ---- 11. 四頁的用詞：釘樁、禁語、交給別課的詞 ---- */
      PINS.forEach(pin => {
        pin.pages.forEach(pg => {
          const n = (TEXT[pg].match(pin.re) || []).length;
          if (n < pin.min[pg]) fail('the ' + pg + ' page says ' + pin.why + ' only ' + n + ' time(s); it said it ' + pin.min[pg] + ' time(s) when this was pinned');
        });
      });
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        FORBIDDEN.forEach(f => {
          const m = TEXT[pg].match(f.re);
          if (m) fail(pg + '.html: ' + f.why + ' — "' + m[0].trim() + '"');
        });
        /* ⚠️ 交給別課的詞要**逐一出現**檢查（窗口 ±160 字）：整頁檢查會被同一頁別處那一句蓋掉。 */
        HANDOFF.forEach(h => {
          let at = 0;
          for (;;){
            const i = TEXT[pg].indexOf(h.term, at);
            if (i < 0) break;
            const win = TEXT[pg].slice(Math.max(0, i - 160), i + h.term.length + 160);
            if (!h.ok.test(win)) fail(pg + '.html: "' + h.term + '" is mentioned without saying it is left to another lesson');
            at = i + h.term.length;
          }
        });
        /* ⚠️ 引述迷思的地方，附近一定要有反駁 —— 不然讀者讀到的就是一句被背書的錯話。 */
        MISCONCEPTIONS.forEach(m => {
          let at = 0;
          for (;;){
            const i = TEXT[pg].indexOf(m.term, at);
            if (i < 0) break;
            const win = TEXT[pg].slice(Math.max(0, i - 200), i + m.term.length + 200);
            if (!m.ok.test(win)) fail(pg + '.html: ' + m.why + ' — near "' + TEXT[pg].slice(Math.max(0, i - 20), i + m.term.length + 20).trim() + '"');
            at = i + m.term.length;
          }
        });
      });
      /* 每一頁的字典字串也要過同一套字串檢查（畫面上的字有一半是字典組出來的） */
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        ['zh', 'en'].forEach(lang => {
          const strs = i18nStrings((DICT[pg] || {})[lang], []);
          /* 每一頁的字串數量釘成**當下真實的數字**：讀不到字典（或字典被砍掉一半）時會響。
             review.html 的字典本來就小，內容住在 GENS 裡。 */
          const DICT_MIN = { index:163, reference:86, review:18, parents:49 };
          if (strs.length < DICT_MIN[pg]) fail(pg + '.html ' + lang + ': only ' + strs.length + ' dictionary strings were read, it had ' + DICT_MIN[pg] + ' when this was pinned — the dictionary may not have been parsed');
          strs.forEach((t, i) => {
            stringProblems(t, lang, pg + ' dict ' + lang + '[' + i + ']').forEach(fail);
            decArith(t).problems.forEach(m => fail(pg + ' dict ' + lang + '[' + i + ']: ' + m));
          });
        });
        /* ⚠️ 頁面層的算式檢查不可以掃原始碼（字典是 JS 字串拼出來的，看起來像斷掉的算式）——
           掃的是拿掉 <script> 之後的 markup。 */
        const markup = readerText(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n');
        decArith(markup).problems.forEach(m => fail(pg + '.html markup: ' + m));
      });

      /* ---- 11b. markup 裡的中文 fallback 和字典的 zh 值必須一模一樣 ----
         ⚠️ 這兩份是同一句話的兩個副本：applyStatic 會用字典蓋掉 markup，所以字典被截斷的時候
            畫面上的字會**少半句**，而 markup 還是完整的 —— check_i18n 只看 key 在不在，
            版面掃描只看有沒有 JS 錯誤，兩邊都不會響。這一條是唯一會響的地方。 */
      let pairsChecked = 0;
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        const norm = t => String(t).replace(/\s+/g, ' ').trim();
        const re = /<(\w+)[^>]*\sdata-i18n="([A-Za-z0-9_]+)"[^>]*>([\s\S]*?)<\/\1>/g;
        let m;
        while ((m = re.exec(RAW[pg])) !== null){
          const key = m[2], markupText = norm(m[3]);
          if (!markupText) continue;
          const dictText = (DICT[pg] || {}).zh ? DICT[pg].zh[key] : undefined;
          /* ⚠️ 字典裡沒有這個 key 的時候 applyStatic 會整個跳過，畫面上留下寫死的中文 ——
             那正是 framework §五之一 說的那種洞，所以要報出來，不是 continue。
             （函式型的值由題庫與產生器那兩段驗，不在這裡比。） */
          if (typeof dictText !== 'string'){
            if (dictText === undefined) fail(pg + '.html: the key "' + key + '" is used in the markup but has no Chinese dictionary string');
            continue;
          }
          pairsChecked++;
          if (norm(dictText) !== markupText)
            fail(pg + '.html: the Chinese in the markup and the dictionary disagree for "' + key + '" — the dictionary has ' +
                 norm(dictText).length + ' characters, the markup has ' + markupText.length);
        }
      });
      /* 163 是 2026-09-21 量出來的真實對數：少一對就表示有一段文字不再被比對。 */
      if (pairsChecked < 163) fail('only ' + pairsChecked + ' markup/dictionary pairs were compared, there were 163 when this was pinned — the comparison may have stopped early');

      /* ---- 12. 課程頁與複習頁的產生器／案例表沒有被偷偷改掉 ---- */
      const REVIEW = stripJsComments(RAW.review);
      GEN_IDS.forEach(id => { if (REVIEW.indexOf("id:'" + id + "'") < 0) fail('the review page no longer has the generator ' + id); });
      const genCount = (REVIEW.match(/\bid:'[a-zA-Z]+',\s*cat:'/g) || []).length;
      if (genCount !== GEN_IDS.length) fail('the review page has ' + genCount + ' generators, the checker expects ' + GEN_IDS.length);
      if (REVIEW.indexOf('function distractorsClean') < 0) fail('the review page no longer filters the pools for clean distractors');
      if (REVIEW.indexOf('digitCount(a) <= 3') < 0) fail('the review page no longer caps the dividend at three printed digits');
      /* ⚠️ 這是字面掃描，不是資料流分析：它只證明「畫圖那一行還在讀 plan」。 */
      const INDEX = stripJsComments(RAW.index);
      ['planCells', 'planLadder', 'planShift', 'planCompare', 'planUnit'].forEach(fn => {
        if (INDEX.indexOf('function ' + fn + '(') < 0) fail('index.html no longer defines ' + fn);
      });
      if (INDEX.indexOf('plan.prims.forEach') < 0) fail('index.html no longer draws from the plan’s piece list');
      if (INDEX.indexOf('roundAnswerIndex(round)') < 0) fail('the game no longer computes which option is correct; it may be reading the declared ans');

      /* ---- 13. 覆蓋率：驗算器這一次到底讀到幾條算式 ---- */
      /* 204 是這一輪量出來的真實條數。⚠️ 這是**下限**，不是指紋：它擋的是「求值器整個不讀了」，
         擋不住「拿掉一條、再補一條不相干的」。每一條算式本身由上面逐題的 decArith 驗過，
         所以這裡刻意不釘 sha1 —— 釘了的話每改一句文案都要重釘，反而沒人看。 */
      if (DEC_SEEN.length < 204) fail('the arithmetic checker only read ' + DEC_SEEN.length + ' equations in total — it may have stopped reading them');
    }
  },

  /* 刻意改壞的清單：證明上面每一條斷言真的會響（node tools/breaktest.js grade-6/math/decimal-divide）。 */
  breaks: [
    { file:"index", via:"index", expect:"layout constant CELL_W",
      find:"  var CELL_W = 7, CELL_H = 34, CELL_X0 = 40, CELL_Y = 92;",
      replace:"  var CELL_W = 9, CELL_H = 34, CELL_X0 = 40, CELL_Y = 92;",
      why:"every cell would be drawn wider than the checker measures, and the longest strip would leave the canvas" },
    { file:"index", via:"index", expect:"a canvas viewBox is",
      find:"<svg class=\"decfig\" id=\"s1fig\" viewBox=\"0 0 460 200\"",
      replace:"<svg class=\"decfig\" id=\"s1fig\" viewBox=\"0 0 460 180\"",
      why:"the cell strip would be drawn in a shorter coordinate system than it uses" },
    { file:"index", via:"index", expect:"in CSS but the viewBox is",
      find:".decfig{width:100%;max-width:460px;height:200px;display:block;margin:0 auto}",
      replace:".decfig{width:100%;max-width:460px;height:240px;display:block;margin:0 auto}",
      why:"every figure would be letterboxed inside a taller box and silently shrink" },
    { file:"index", via:"index", expect:"labels are not at y=",
      find:"  var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 192, LABEL_FS = 14;",
      replace:"  var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 150, LABEL_FS = 14;",
      why:"the lower caption would be written on top of the number line instead of below it" },
    { file:"index", via:"index", expect:"LAD_ROW_Y is",
      find:"  var LAD_ROW_Y = [48, 100, 152], LAD_BOX_H = 34, LAD_FS = 19;",
      replace:"  var LAD_ROW_Y = [48, 100, 150], LAD_BOX_H = 34, LAD_FS = 19;",
      why:"the three ladder rows would not be evenly spaced any more" },
    { file:"index", via:"index", expect:"dText(10) is",
      find:"    if (f % 10 === 0) return w + '.' + (f / 10);",
      replace:"    if (f % 10 === 0) return w + '.' + f;",
      why:"3.5 would be printed as 3.50, so every answer string would stop matching" },
    { file:"index", via:"index", expect:"dText does not fail closed",
      find:"    if (!(typeof h === 'number' && isFinite(h) && h === Math.floor(h) && h >= 0)) return '?';",
      replace:"    if (false) return '?';",
      why:"a broken value would be printed as NaN instead of a visible ?" },
    { file:"index", via:"index", expect:"dpOf(",
      find:"    if (h % 10 === 0) return 1;\n    return 2;",
      replace:"    if (h % 10 === 0) return 2;\n    return 2;",
      why:"every one-place divisor would be treated as a two-place one, so the points would slide too far" },
    { file:"index", via:"index", expect:"scaleOf(",
      find:"    return p < 0 ? null : (p === 0 ? 1 : (p === 1 ? 10 : 100));",
      replace:"    return p < 0 ? null : (p === 0 ? 1 : (p === 1 ? 100 : 10));",
      why:"a one-place divisor would be magnified 100 times and a two-place one only 10" },
    { file:"index", via:"index", expect:"dpOf/scaleOf do not fail closed",
      find:"  function dpOf(h){\n    if (!isPosInt(h)) return -1;",
      replace:"  function dpOf(h){\n    if (!isPosInt(h)) return 0;",
      why:"a broken value would silently be reported as a whole number" },
    { file:"index", via:"index", expect:"quotH does not fail closed",
      find:"    if ((aH * 100) % bH !== 0) return null;",
      replace:"    if ((aH * 100) % bH !== 0) return Math.round(aH * 100 / bH / 10) * 10;",
      why:"a division that does not come out exactly would be answered with a rounded-off quotient" },
    { file:"index", via:"index", expect:"quotH does not refuse a quotient outside",
      find:"    return okQ(q) ? q : null;",
      replace:"    return q;",
      why:"quotients far outside the range this lesson states would be printed" },
    { file:"index", via:"index", expect:"two decimal places",
      find:"  function okQ(h){ return isPosInt(h) && h % 10 === 0 && h >= Q_MIN_H && h <= Q_MAX_H; }",
      replace:"  function okQ(h){ return isPosInt(h) && h >= Q_MIN_H && h <= Q_MAX_H; }",
      why:"a two-decimal-place quotient would be accepted although the lesson says at most one" },
    { file:"index", via:"index", expect:"sideOf does not report",
      find:"    if (bH < 100) return 'bigger';\n    if (bH > 100) return 'smaller';",
      replace:"    if (bH <= 100) return 'bigger';\n    if (bH > 100) return 'smaller';",
      why:"dividing by exactly 1 would be reported as making the quotient bigger" },
    { file:"index", via:"index", expect:"bigPair(",
      find:"    var a2 = aH * k, b2 = bH * k;",
      replace:"    var a2 = aH, b2 = bH * k;",
      why:"only the divisor would be magnified — the exact mistake this lesson is about" },
    { file:"index", via:"index", expect:"bigPair does not refuse a divisor that is already whole",
      find:"    if (k === null || !okA(aH) || !okB(bH) || k === 1) return null;",
      replace:"    if (k === null || !okA(aH) || !okB(bH)) return null;",
      why:"a whole divisor would be offered as if it still needed magnifying" },
    { file:"index", via:"index", expect:"piece 0 is",
      find:"                        Math.floor(i / per) % 2 === 0 ? C_CELL_A : C_CELL_B, C_CELL_EDGE, 1));",
      replace:"                        Math.floor(i / per) % 2 === 1 ? C_CELL_A : C_CELL_B, C_CELL_EDGE, 1));",
      why:"the colour blocks would start on the wrong group, so the first group would not be the highlighted one" },
    { file:"index", via:"index", expect:"cells 3.6/0.4: piece",
      find:"    prims.push(prRect(CELL_X0, CELL_Y, per * CELL_W, CELL_H, 'none', C_ORANGE, 3));",
      replace:"    prims.push(prRect(CELL_X0, CELL_Y, CELL_W, CELL_H, 'none', C_ORANGE, 3));",
      why:"the orange frame would ring one cell instead of one whole group, so it would no longer show the divisor" },
    { file:"index", via:"index", expect:"cells 3.6/0.4: piece",
      find:"      prims.push(prText(r1(CELL_X0 + (g + 0.5) * per * CELL_W), CELL_Y + CELL_H + 22, String(g + 1), CELL_NUM_FS, 'middle', C_MUTED));",
      replace:"      prims.push(prText(r1(CELL_X0 + (g + 0.5) * per * CELL_W), CELL_Y + CELL_H + 22, String(g), CELL_NUM_FS, 'middle', C_MUTED));",
      why:"the groups would be numbered from 0, so counting them would give one less than the answer" },
    { file:"index", via:"index", expect:"the figure refused to draw",
      find:"    if (!isPosInt(groups) || groups < 2 || groups > GROUP_MAX) return emptyPlan();",
      replace:"    if (!isPosInt(groups) || groups < 2 || groups > 4) return emptyPlan();",
      why:"the strip would refuse to draw for perfectly ordinary questions in this lesson" },
    { file:"index", via:"index", expect:"ladder 7.5/0.25: piece",
      find:"    var ready = dpOf(bH);                      /* 除數在第幾列變成整數（1 或 2） */",
      replace:"    var ready = 1;                      /* 除數在第幾列變成整數（1 或 2） */",
      why:"the orange row would always be row 2, so a two-place divisor would be marked ready before it is whole" },
    { file:"index", via:"index", expect:"ladder 3.6/0.4: piece",
      find:"      prims.push(prText(LAD_Q_X + LAD_Q_W / 2, y + 6, dText(q), LAD_FS, 'middle', C_GREEN));",
      replace:"      prims.push(prText(LAD_Q_X + LAD_Q_W / 2, y + 6, dText(rows[i].a), LAD_FS, 'middle', C_GREEN));",
      why:"the right-hand box would change down the rows — the picture would say the opposite of what the lesson teaches" },
    { file:"index", via:"index", expect:"ladder 3.6/0.4: piece",
      find:"      prims.push(prText(LAD_ARROW_TX, r1((LAD_ROW_Y[i] + LAD_ROW_Y[i + 1]) / 2 + 4), '×10', LAD_ARROW_FS, 'start', C_BLUE));",
      replace:"      prims.push(prText(LAD_ARROW_TX, r1((LAD_ROW_Y[i] + LAD_ROW_Y[i + 1]) / 2 + 4), '×100', LAD_ARROW_FS, 'start', C_BLUE));",
      why:"each step down would be labelled ×100 although the numbers only grow ten times" },
    { file:"index", via:"index", expect:"ladder 3.6/0.4: piece",
      find:"    for (i = 0; i < 3; i++) rows.push({ a:aH * Math.pow(10, i), b:bH * Math.pow(10, i) });",
      replace:"    for (i = 0; i < 3; i++) rows.push({ a:aH * Math.pow(10, i), b:bH });",
      why:"the divisor would stay put down the ladder while the dividend grew — the quotient would no longer hold" },
    { file:"index", via:"index", expect:"shift 3.6/0.4: the figure refused to draw",
      find:"    var startCol = top.ds.length + pad - bot.ds.length;",
      replace:"    var startCol = 0;",
      why:"the two rows would be left-aligned, so the point would appear to jump the wrong number of columns" },
    { file:"index", via:"index", expect:"shiftRow(",
      find:"    var pad = Math.max(0, shift - dpOf(h));",
      replace:"    var pad = 0;",
      why:"the padding zeros would never be counted, so the orange zeros would be coloured as ordinary digits" },
    { file:"index", via:"index", expect:"shift 6/0.4: piece",
      find:"                          i >= row.bot.ds.length - row.pad ? C_ORANGE : C_LINE));",
      replace:"                          i < row.pad ? C_ORANGE : C_LINE));",
      why:"the wrong digits would be coloured orange — the leading digits instead of the zeros that were added" },
    { file:"index", via:"index", expect:"shift 3.6/0.4: piece",
      find:"      var xTop = x0 + row.top.p * SH_CH_W, xBot = x0 + (row.startCol + row.bot.p) * SH_CH_W;",
      replace:"      var xTop = x0 + row.top.p * SH_CH_W, xBot = x0 + row.bot.p * SH_CH_W;",
      why:"the lower decimal point would be drawn in the wrong column, so the arrow would show the wrong jump" },
    { file:"index", via:"index", expect:"compare 3.6/0.4: piece",
      find:"    var xa = xOf(aH), xq = xOf(q), prims = [];",
      replace:"    var xa = xOf(aH), xq = xOf(aH), prims = [];",
      why:"the quotient marker would sit on top of the dividend, so the picture would never show which way it went" },
    { file:"index", via:"index", expect:"compare 3.6/0.4: piece",
      find:"    var maxV = Math.round(Math.max(aH, q) * CMP_HEAD);",
      replace:"    var maxV = Math.round(Math.max(aH, q));",
      why:"the larger marker would sit exactly on the arrowhead with its label hanging off the end" },
    { file:"index", via:"index", expect:"s5 sugar: the figure refused to draw",
      find:"    var xg = xOf(amtH), xo = xOf(100), prims = [];",
      replace:"    var xg = xOf(amtH), xo = xOf(amtH), prims = [];",
      why:"the “1 unit” line would be drawn on top of the known amount, so the question would have no picture" },
    { file:"index", via:"index", expect:"s5 sugar: piece",
      find:"    prims.push(prText(xo, UNI_AMT_Y, '1', UNI_FS, 'middle', C_ORANGE));",
      replace:"    prims.push(prText(xo, UNI_AMT_Y, '?', UNI_FS, 'middle', C_ORANGE));",
      why:"both ends of the orange line would read ? and the picture would stop saying what is known" },
    { file:"index", via:"index", expect:"S3_CASES",
      find:"  var S3_CASES = [{ a:360, b:40 }, { a:600, b:40 }, { a:750, b:25 }, { a:450, b:150 }];",
      replace:"  var S3_CASES = [{ a:360, b:40 }, { a:480, b:60 }, { a:750, b:25 }, { a:450, b:150 }];",
      why:"the padding-zero example would disappear, so nothing on the page would show the 6 becoming 60" },
    { file:"index", via:"index", expect:"S5_CASES",
      find:"    { kind:'unit', id:'sugar',  amt:60,  val:4500 },  /* 0.6 公斤 45 元 → 1 公斤 75 元 */",
      replace:"    { kind:'unit', id:'sugar',  amt:60,  val:4000 },  /* 0.6 公斤 45 元 → 1 公斤 75 元 */",
      why:"the sugar example would no longer come out exactly, so the page would print a rounded answer" },
    { file:"index", via:"index", expect:"the computed answer sits at",
      find:"    { kind:'quot', a:480, b:60, opts:['0.8', '2.88', '8', '80'], ans:2 },",
      replace:"    { kind:'quot', a:480, b:60, opts:['0.8', '2.88', '8', '80'], ans:1 },",
      why:"the declared answer would point at a distractor while the page marks a different button right" },
    { file:"index", via:"index", expect:"the four options are not all different",
      find:"    { kind:'factor', a:750, b:25, opts:['10', '100', '1000', '2'], ans:1 },",
      replace:"    { kind:'factor', a:750, b:25, opts:['10', '100', '1000', '10'], ans:1 },",
      why:"a child would see three options, not four" },
    { file:"index", via:"index", expect:"roundAnswer is",
      find:"    if (r.kind === 'factor'){ var k = scaleOf(r.b); return k === null || k === 1 ? null : String(k); }",
      replace:"    if (r.kind === 'factor'){ var k = dpOf(r.b); return k === null || k === 1 ? null : String(k); }",
      why:"the magnify-by question would be marked right on the number of places instead of the factor" },
    { file:"index", via:"index", expect:"the unit is",
      find:"    if (r.kind === 'word') return 'seg';",
      replace:"    if (r.kind === 'word') return 'none';",
      why:"the rope answers would lose the unit, so 9 and 9 pieces would read as the same thing" },
    { file:"index", via:"index", expect:"roundAnswer does not fail closed",
      find:"  function roundAnswer(r){\n    if (r.kind === 'factor')",
      replace:"  function roundAnswer(r){\n    if (true) return '0';\n    if (r.kind === 'factor')",
      why:"an unknown round would silently be given an answer instead of refusing" },
    { file:"index", via:"index", expect:"no option matches the computed answer",
      find:"    for (i = 0; i < r.opts.length; i++) if (String(r.opts[i]) === String(want)) return i;",
      replace:"    for (i = 0; i < r.opts.length; i++) if (String(r.opts[i]) === String(want) + 'x') return i;",
      why:"no button would ever be the right one and the game could not be finished" },
    { file:"index", via:"index", expect:"withUnit does not fail closed",
      find:"    if (!UNIT_WORD[lang] || !UNIT_WORD[lang][kind]) return '?';",
      replace:"    if (false) return '?';",
      why:"an unknown unit would print “9 undefineds” on a button" },
    { file:"index", via:"index", expect:"plEn gets the English plural wrong",
      find:"    if (String(n) === '1') return n + ' ' + w;\n    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');",
      replace:"    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');",
      why:"the English would say “1 pieces”" },
    { file:"index", via:"index", expect:"the marked option is",
      find:"          opts:['0.9', '9', '90', '1.44'], ans:1,\n          why:'除數 0.4",
      replace:"          opts:['0.9', '9', '90', '1.44'], ans:0,\n          why:'除數 0.4",
      why:"the first question would mark the “moved one side only” mistake as the right answer" },
    { file:"index", via:"index", expect:"the answer index differs from the Chinese bank",
      find:"          opts:['0.4', '5.76', '4', '40'], ans:2,\n          why:'The divisor 1.2 has one decimal place",
      replace:"          opts:['0.4', '5.76', '4', '40'], ans:3,\n          why:'The divisor 1.2 has one decimal place",
      why:"the English bank would mark a different button from the Chinese one" },
    { file:"index", via:"index", expect:"this claim is wrong",
      find:"          why:'除數 0.4 有一位小數，兩個數都乘以 10：3.6 ÷ 0.4 ＝ 36 ÷ 4 ＝ 9。",
      replace:"          why:'除數 0.4 有一位小數，兩個數都乘以 10：3.6 ÷ 0.4 ＝ 36 ÷ 4 ＝ 8。",
      why:"the explanation would work the question out wrongly while the marked option stayed right" },
    { file:"index", via:"index", expect:"the marked option is",
      find:"          opts:['27 元', '75 元', '7.5 元', '750 元'], ans:1,\n          why:'要問 1 個單位",
      replace:"          opts:['27 元', '76 元', '7.5 元', '750 元'], ans:1,\n          why:'要問 1 個單位",
      why:"the unit-price answer would be one dollar out" },
    { file:"index", via:"index", expect:"the stem never prints",
      find:"        { stem:'<strong>4.8 ÷ 1.2</strong> ＝ ?',\n          opts:['0.4', '5.76', '4', '40'], ans:2,\n          why:'除數 1.2",
      replace:"        { stem:'<strong>4.8 ÷ 1.5</strong> ＝ ?',\n          opts:['0.4', '5.76', '4', '40'], ans:2,\n          why:'除數 1.2",
      why:"the stem would ask a different question from the one the options answer" },
    { file:"index", via:"index", expect:"two options are the same value",
      find:"          opts:['150', '1.5', '2.4', '15'], ans:3,\n          why:'除數 0.4",
      replace:"          opts:['15', '1.5', '2.4', '15'], ans:3,\n          why:'除數 0.4",
      why:"a child would see three options, not four" },
    { file:"review", via:"review", expect:"puts a unit inside an equation",
      find:"            ? '問裡面有幾個那麼多，是包含除：' + dText(d.a) + ' ÷ ' + dText(d.b) + ' ＝ '",
      replace:"            ? '問裡面有幾個那麼多，是包含除：' + dText(d.a) + ' 公尺 ÷ ' + dText(d.b) + ' ＝ '",
      why:"an equation with a unit inside it would be cut in half and half of it would go unverified" },
    { file:"index", via:"index", expect:"rounding a quotient",
      find:"  <p class=\"notebox\" data-i18n=\"s1note\">💬 兩個數都換成「幾個 0.1」之後",
      replace:"  <p class=\"notebox\" data-i18n=\"s1note\">💬 除不盡的時候四捨五入到小數第一位就好。兩個數都換成「幾個 0.1」之後",
      why:"the page would quietly start teaching a topic it says it leaves to a later lesson" },
    { file:"index", via:"index", expect:"must be refuted where it is quoted",
      find:"  <footer data-i18n=\"footer\">\n    把整頁縮成一句：",
      replace:"  <footer data-i18n=\"footer\">\n    除法一定會變小。把整頁縮成一句：",
      why:"the misconception would be printed in the footer with nothing around it to knock it down" },
    { file:"reference", via:"index", expect:"the reference page says the padding-zero special case",
      find:"<span data-i18n=\"d2\"><strong>兩個數的小數點一起往右移</strong>同樣多位。位數不夠的時候在數字後面<strong>補 0</strong>（6 移 1 位變成 60）。</span>",
      replace:"<span data-i18n=\"d2\"><strong>兩個數的小數點一起往右移</strong>同樣多位。</span>",
      why:"the cheat sheet would drop the padding-zero step that the lesson spends an example on" },
    { file:"review", via:"review", expect:"the \"magnified the divisor only\" distractor is missing",
      find:"        var cands = [tok(p.q / 10, 'n'), tok(p.q * 10, 'n'), tok(p.a * p.b / 100, 'n')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(p.q, 'n'), [tok(p.a, 'n'), tok(p.b, 'n')]);\n        var o = optsOf(correct, wrongs);\n        return { a:p.a, b:p.b, q:p.q, opts:o.opts, ans:o.ans };\n      },\n      fmt:function(d, lang){\n        var k = scaleOf(d.b);\n        return {\n          stem: lang === 'zh' ? '<strong>' + dText(d.a) + ' ÷ ' + dText(d.b) + '</strong> ＝ ?'",
      replace:"        var cands = [tok(p.q * 10, 'n'), tok(p.a * p.b / 100, 'n')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(p.q, 'n'), [tok(p.a, 'n'), tok(p.b, 'n')]);\n        var o = optsOf(correct, wrongs);\n        return { a:p.a, b:p.b, q:p.q, opts:o.opts, ans:o.ans };\n      },\n      fmt:function(d, lang){\n        var k = scaleOf(d.b);\n        return {\n          stem: lang === 'zh' ? '<strong>' + dText(d.a) + ' ÷ ' + dText(d.b) + '</strong> ＝ ?'",
      why:"the commonest mistake in this lesson would stop being offered as a distractor" },
    { file:"review", via:"review", expect:"does not have exactly two decimal places",
      find:"        var p = pickUnused(P_HUND, used);",
      replace:"        var p = pickUnused(P_TENTH, used);",
      why:"the two-place question would quietly become a one-place one, so nothing would drill the ×100 case" },
    { file:"review", via:"review", expect:"is not a whole number, so no 0 has to be added",
      find:"        var p = pickUnused(P_WHOLE, used);",
      replace:"        var p = pickUnused(P_TENTH, used);",
      why:"the padding-zero question would stop having anything to pad" },
    { file:"review", via:"review", expect:"is not above 1",
      find:"        var p = pickUnused(P_BIG, used);",
      replace:"        var p = pickUnused(P_TENTH, used);",
      why:"the “quotient gets smaller” question would be handed a divisor below 1" },
    { file:"review", via:"review", expect:"opts[ans]=",
      find:"        var correct = tok(dpOf(p.b) * 100, 'pl');",
      replace:"        var correct = tok(dpOf(p.a) * 100, 'pl');",
      why:"the number of places would be counted on the dividend instead of the divisor" },
    { file:"review", via:"review", expect:"is not the magnification the divisor needs",
      find:"        var p = pickUnused(P_TENTH.concat(P_HUND), used), k = scaleOf(p.b);",
      replace:"        var p = pickUnused(P_TENTH.concat(P_HUND), used), k = 10;",
      why:"a two-place divisor would be magnified only ten times, so the “same quotient” option would not be one" },
    { file:"review", via:"review", expect:"the distractor",
      find:"        var wrongs = [dText(p.a * k) + ' ÷ ' + dText(p.b), dText(p.a) + ' ÷ ' + dText(p.b * k), dText(p.a * k * 10) + ' ÷ ' + dText(p.b * k)];",
      replace:"        var wrongs = [dText(p.a * k) + ' ÷ ' + dText(p.b), dText(p.a) + ' ÷ ' + dText(p.b * k), dText(p.a * k * 100) + ' ÷ ' + dText(p.b * k * 100)];",
      why:"one “wrong” option would have exactly the same quotient as the answer, so a correct reading would be marked wrong" },
    { file:"review", via:"review", expect:"opts[ans]=",
      find:"        var correct = sideOf(p.b);",
      replace:"        var correct = 'bigger';",
      why:"the comparison would always be marked “bigger”, so half the questions would mark the wrong sentence" },
    { file:"review", via:"review", expect:"is not a whole count of pieces",
      find:"        var p = pickUnused(P_CUT, used), id = pick(CUT_IDS), u = CUT_UNITTOK[id];",
      replace:"        var p = pickUnused(P_DEC, used), id = pick(CUT_IDS), u = CUT_UNITTOK[id];",
      why:"a “how many pieces” question could answer 8.5 pieces" },
    { file:"review", via:"review", expect:"the option",
      find:"        var cands = [tok(p.q / 10, u), tok(p.q * 10, u), tok(p.a * p.b / 100, u)];",
      replace:"        var cands = [tok(p.q / 10, u), tok(p.q * 10, 'n'), tok(p.a * p.b / 100, u)];",
      why:"one option would lose its unit, so 90 and 90 pieces would sit side by side" },
    { file:"review", via:"review", expect:"opts[ans]=",
      find:"        var correct = tok(p.q, 'yuan');\n        var cands = [tok(p.q / 10, 'yuan'), tok(p.q * 10, 'yuan'), tok(p.a * p.b / 100, 'yuan')];",
      replace:"        var correct = tok(Math.round(p.a * p.b / 100), 'yuan');\n        var cands = [tok(p.q / 10, 'yuan'), tok(p.q * 10, 'yuan'), tok(p.q, 'yuan')];",
      why:"the unit price would be worked out by multiplying instead of dividing" },
    { file:"review", via:"review", expect:"is a whole number, so this question does not make its point",
      find:"        var p = pickUnused(P_DEC, used);\n        var correct = tok(p.q, 'n');\n        var cands = [tok(p.q / 10, 'n'), tok(p.q * 10, 'n'), tok(p.a * p.b / 100, 'n')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(p.q, 'n'), [tok(p.a, 'n'), tok(p.b, 'n')]);\n        var o = optsOf(correct, wrongs);\n        return { a:p.a, b:p.b, q:p.q, opts:o.opts, ans:o.ans };\n      },\n      fmt:function(d, lang){\n        var k = scaleOf(d.b);\n        return {\n          stem: '<strong>' + dText(d.a) + ' ÷ ' + dText(d.b) + '</strong> ＝ ?',\n          opts: d.opts.map(function(t){ return tokText(t, lang); }), ans:d.ans,\n          why: lang === 'zh'\n            ? dText(d.a)",
      replace:"        var p = pickUnused(P_CUT, used);\n        var correct = tok(p.q, 'n');\n        var cands = [tok(p.q / 10, 'n'), tok(p.q * 10, 'n'), tok(p.a * p.b / 100, 'n')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(p.q, 'n'), [tok(p.a, 'n'), tok(p.b, 'n')]);\n        var o = optsOf(correct, wrongs);\n        return { a:p.a, b:p.b, q:p.q, opts:o.opts, ans:o.ans };\n      },\n      fmt:function(d, lang){\n        var k = scaleOf(d.b);\n        return {\n          stem: '<strong>' + dText(d.a) + ' ÷ ' + dText(d.b) + '</strong> ＝ ?',\n          opts: d.opts.map(function(t){ return tokText(t, lang); }), ans:d.ans,\n          why: lang === 'zh'\n            ? dText(d.a)",
      why:"the “a quotient may be a decimal” question would only ever show whole quotients" },
    { file:"review", via:"review", expect:"is not",
      find:"      if (a < 100 || a > 5000 || dpOf(a) < 1 || digitCount(a) > 3) continue;",
      replace:"      if (a < 100 || a > 5000 || digitCount(a) > 3) continue;",
      why:"the grade-five interleave would start asking whole ÷ whole, which is not that lesson’s question type" },
    { file:"review", via:"review", expect:"opts[ans]=",
      find:"        var correct = tok(p.k * 100, 'n');",
      replace:"        var correct = tok(p.b * 100, 'n');",
      why:"the ratio value would be answered with the second term instead of the quotient" },
    { file:"review", via:"review", expect:"distractor is missing",
      find:"  var P_TENTH = buildPairs(B_TENTH, function(a, b, q){ return dpOf(a) >= 1 && digitCount(a) <= 3 && distractorsClean(a, b, q); });",
      replace:"  var P_TENTH = buildPairs(B_TENTH, function(a, b, q){ return dpOf(a) >= 1 && digitCount(a) <= 3 && !distractorsClean(a, b, q); });",
      why:"distractorsClean only guards about 9 of the 6000 pool entries, so a 400-batch run almost never reaches one; inverting the filter makes every draw a colliding pair, where the deliberate misconception distractor is dropped by avoid and the question is left a distractor short" },
    { file:"review", via:"review", expect:"has more than three digits",
      find:"  var P_BIG   = buildPairs(B_BIG, function(a, b, q){ return digitCount(a) <= 3 && distractorsClean(a, b, q); });",
      replace:"  var P_BIG   = buildPairs(B_BIG, function(a, b, q){ return distractorsClean(a, b, q); });",
      why:"the questions would drift into four-digit long division, which is not what this lesson teaches" },
    { file:"review", via:"review", expect:"glues Chinese to a digit",
      find:"    if (u === 'n') return v;\n    return lang === 'zh' ? v + ' ' + UNIT_WORD.zh[u] : plEn(v, UNIT_WORD.en[u]);",
      replace:"    if (u === 'n') return v;\n    return lang === 'zh' ? v + UNIT_WORD.zh[u] : plEn(v, UNIT_WORD.en[u]);",
      why:"the space between the number and the Chinese unit would disappear" }
,
    { file:"index", via:"index", expect:"markup and the dictionary disagree",
      find:"      s3h2:'動手：兩個小數點一起往右移',",
      replace:"      s3h2:'動手：兩個小數點',",
      why:"the dictionary value would be truncated, so the heading on screen would lose half its words while the markup fallback still looked right" },
    { file:"reference", via:"index", expect:"markup/dictionary pairs were compared",
      find:"    <h2 data-i18n=\"s2h2\">商不變：同一個商，很多種寫法</h2>",
      replace:"    <h2>商不變：同一個商，很多種寫法</h2>",
      why:"one heading would stop being translated at all, and the pair count pins that the comparison still covers every key" }
,
    { file:"index", via:"index", expect:"the stem never prints",
      find:"        { stem:'<strong>6 ÷ 0.4</strong> ＝ ?',\n          opts:['150', '1.5', '2.4', '15'], ans:3,\n          why:'除數 0.4",
      replace:"        { stem:'<strong>60 ÷ 0.4</strong> ＝ ?',\n          opts:['150', '1.5', '2.4', '15'], ans:3,\n          why:'除數 0.4",
      why:"the stem would ask a ten-times-bigger question while the options still answered the old one; a substring test would have let 6 pass inside 60" },
    { file:"reference", via:"index", expect:"has no Chinese dictionary string",
      find:"      n4:'💬 <strong>算之前先猜一次</strong>",
      replace:"      n4x:'💬 <strong>算之前先猜一次</strong>",
      why:"the notebox would fall back to the hard-coded Chinese in the markup and never switch to English — the hole framework section 5.1 is about" }

  ]
};
