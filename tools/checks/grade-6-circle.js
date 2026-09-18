/* grade-6/math/circle —— 圓周率工作坊（圓周率、圓周長、圓面積、周長還是面積）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作，都不呼叫課程頁的函式：
 *
 * 1) 「圓周長」與「圓面積」。課程頁用乘法（2 × r × 314、r × r × 314）；這裡用**重複相加**
 *    （circRef 把 314 加 2r 次、areaRef 把 314 加 r × r 次）。乘號打錯、係數寫反都會被抓到。
 * 2) 「小數怎麼印出來」。課程頁自己拆整數位與百分位；這裡用 toFixed(2) 再砍尾端的 0（hTextRef）。
 *    對 0 ~ 200000 的每一個百分之一值都要同意。
 * 3) 課程明講的四句話這裡是**列舉證明**，不是文案：
 *    - 「圓周長 ÷ 直徑 不管圓多大都一樣」→ 對每一個 r 算出 circRef(r) / (2r)，所有 r 必須完全相同。
 *    - 「圓周長 ＝ 直徑 × 3.14」→ 對每一個 r 驗 circRef(r) ＝ (2r) × PI_H。
 *    - 「圓面積 ＝ 半徑 × 半徑 × 3.14」→ 對每一個 r 驗 areaRef(r) ＝ （圓周長的一半）×（半徑），
 *      也就是範例教學 3 那張圖在講的事。
 *    - 「半徑變 k 倍，周長變 k 倍、面積變 k × k 倍」→ 對每一對 (r, k) 直接算出來比。
 * 4) ⚠️ **從畫出來的圖量回來**：三種圖（滾一圈、一個圓加標記、切開重排）的每一個圖元座標
 *    都在這裡**重算一次**再逐一比對；印成 SVG 字串（帶最長的標籤）餵 lib/canvas.js 驗四個邊。
 *    超出各自的範圍要 tooBig 而且一個圖元都不畫（fail-closed）。
 *
 * ⚠️ **這一課不能用 lib/arith.js**：那一份看到小數就直接判失敗（它是給整數課用的），
 *    而這一課每一句旁白都是小數算式（`10 × 3.14 ＝ 31.4`）。所以這裡自己寫了一份
 *    **精確有理數**的求值器（decArith）：先切出「算式鏈」，每一節用遞迴下降解析
 *    （× ÷ 先於 ＋ －，左結合），值用分子分母整數比較（3.14 ＝ 314/100）。
 *    ⚠️ 它**逐個等號記帳**：任何一個 `＝` 左邊貼著數字卻沒有被某一條鏈吃掉，就報錯 ——
 *    靜靜跳過等於替它背書。CLAIM_PROBES 每一次 verify_lesson_data 都重跑。
 *    已知的 fail-open 只有一個：**左邊不是數字的等號**（`圓周長 ＝ 直徑 × 3.14` 這種規則表寫法）
 *    當散文放行，所以四頁一律把結果寫成「圓周長是 31.4 公分」而不是「圓周長 ＝ 31.4」。
 * ⚠️ **算式裡不可以夾單位**（`10 公分 × 3.14` 會被中文切成兩半，剩下的半截會被當成另一條宣稱）。
 *    下面 UNIT_IN_EQ 這一條專門擋它。
 * ⚠️ 選項的「值」是**百分之一的整數 ＋ 單位**（`31.4 公分` 和 `31.4 平方公分` 是兩個不同的值）。
 */

const fs = require('fs');
const path = require('path');
const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const PI_H_REF = 314, R_MAX_REF = 12;
const FIG_W_REF = 460, FIG_H_REF = 200, SC_REF = 6;
const CX_REF = 110, CY_REF = 100, DOT_R_REF = 3, STROKE_REF = 3, RING_STROKE_REF = 7;
const LABEL_X_REF = 16, LABEL_A_Y_REF = 20, LABEL_B_Y_REF = 192, LABEL_FS_REF = 14, LABEL_MAX_REF = 26;
const U_CY_REF = 78, U_BAR_Y_REF = 132, U_BAR_H_REF = 24, U_BAR_X0_REF = 20, U_D_MAX_REF = 10;
const W_CX_REF = 70, W_CY_REF = 100, W_RECT_X0_REF = 150, W_PARTS_REF = 12, W_R_MIN_REF = 3, W_R_MAX_REF = 8;
const C_LINE_REF = '#2B2A33', C_CIRC_REF = '#3B7DD8', C_FILL_REF = '#BBD5F4';
const C_SQ_REF = '#E8871E', C_SQF_REF = '#FDF0E0', C_BAR_REF = '#3B7DD8', C_TAIL_REF = '#E8871E';
const C_WEDGE_REF = '#E8F0FB';
const MARKS_REF = ['radius', 'diameter', 'square', 'ring', 'fill'];

/* 每一個範例的案例，寫成第二份 */
const S1_CASES_REF = [4, 6, 8, 10];
const S2_CASES_REF = [['r', 3], ['r', 7], ['d', 12], ['c', 8]];
const S3_CASES_REF = [4, 5, 6, 8];
const S4_CASES_REF = [['r', 3], ['r', 6], ['d', 10], ['d', 14]];
const S5_CASES_REF = [['ribbon', 'circ', 6], ['mat', 'area', 5], ['clock', 'circ', 12], ['cookie', 'area', 4]];
const GAME_ROUNDS_REF = 5;

/* ---------- 1) 第二套實作：重複相加，不用乘法 ---------- */
function isPosIntRef(n){ return typeof n === 'number' && Number.isInteger(n) && n >= 1; }
function okRRef(r){ return isPosIntRef(r) && r <= R_MAX_REF; }
function okDRef(d){ return isPosIntRef(d) && d % 2 === 0 && okRRef(d / 2); }
/* 圓周長：把 PI_H 加 2r 次（課程頁是 2 × r × PI_H）。 */
function circRef(r){
  if (!okRRef(r)) return null;
  let sum = 0;
  for (let i = 0; i < 2 * r; i++) sum += PI_H_REF;
  return sum;
}
/* 圓面積：把 PI_H 加 r × r 次（課程頁是 r × r × PI_H）。 */
function areaRef(r){
  if (!okRRef(r)) return null;
  let sum = 0;
  for (let a = 0; a < r; a++) for (let b = 0; b < r; b++) sum += PI_H_REF;
  return sum;
}
/* 百分之一 → 字：先 toFixed(2)，再砍掉尾端的 0 與孤單的小數點（課程頁是拆整數位與百分位）。 */
function hTextRef(h){
  if (!(typeof h === 'number' && Number.isInteger(h) && h >= 0)) return '?';
  let s = (h / 100).toFixed(2);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
/* 倒過來：已知圓周長求直徑。除不盡就 null。 */
function diamFromCircRef(cH){
  if (!isPosIntRef(cH) || cH % PI_H_REF !== 0) return null;
  const d = cH / PI_H_REF;
  return okDRef(d) ? d : null;
}
function plEnRef(n, w){
  if (String(n) === '1') return n + ' ' + w;
  return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');
}
const UNIT_WORD_REF = { zh:{ cm:'公分', sq:'平方公分', x:'倍' }, en:{ cm:'centimetre', sq:'square centimetre', x:'time' } };
function withUnitRef(lang, kind, t){
  if (kind === 'none') return String(t);
  if (lang === 'zh') return t + ' ' + UNIT_WORD_REF.zh[kind];
  return plEnRef(String(t), UNIT_WORD_REF.en[kind]);
}

/* ---------- 2) 選項的解析：一個數 ＋ 一個單位。回傳百分之一的值與單位代號。 ---------- */
/* ⚠️ 長的單位名要先比：`平方公分` 不先比的話會被 `公分` 咬掉，兩個不同的量就會被當成同一個值。 */
const UNIT_PATTERNS = [
  { u:'sq', zh:'平方公分', en:/^square centimetres?$/ },
  { u:'cm', zh:'公分',     en:/^centimetres?$/ },
  { u:'x',  zh:'倍',       en:/^times?$/ }
];
function parseOptRef(s, lang){
  const t = String(s).trim();
  const m = /^(\d+(?:\.\d+)?)\s+(.+)$/.exec(t);
  if (!m) return null;
  /* 前導零與多餘的小數位（`04`、`31.40`）是同一個值的另一種寫法：一律拒收，
     不然去重與抄題幹的檢查都可以被繞過。 */
  const num = m[1];
  const h = Math.round(Number(num) * 100);
  if (!Number.isInteger(h) || h < 0) return null;
  if (hTextRef(h) !== num) return null;
  const word = m[2].trim();
  for (const p of UNIT_PATTERNS){
    if (lang === 'zh' ? word === p.zh : p.en.test(word)) return { h:h, u:p.u };
  }
  return null;
}
/* 值的鍵：百分之一的值 ＋ 單位。 */
function optKeyRef(s, lang){
  const p = parseOptRef(s, lang);
  return p ? 'v:' + p.h + '|' + p.u : 'raw:' + String(s).replace(/\s+/g, '');
}

/* ---------- 3) 真值表與句庫：複習頁那兩個句庫的第二份 ---------- */
const TRUE_STATEMENTS_REF = {
  circFormula:  { zh:'圓周長 ＝ 直徑 × 3.14', en:'Circumference ＝ diameter × 3.14' },
  areaFormula:  { zh:'圓面積 ＝ 半徑 × 半徑 × 3.14', en:'Area ＝ radius × radius × 3.14' },
  piFixed:      { zh:'不管圓多大，圓周長 ÷ 直徑 都是同一個數', en:'Circumference ÷ diameter is the same number for every circle' },
  areaUnit:     { zh:'面積的單位是平方公分，周長的單位是公分', en:'An area is in square centimetres and a perimeter is in centimetres' },
  halfDiameter: { zh:'算面積的時候，給的是直徑要先除以 2', en:'To work out an area from a diameter, halve the diameter first' },
  doubleArea:   { zh:'半徑變成 2 倍，面積會變成 4 倍', en:'Doubling the radius makes the area 4 times as big' }
};
const FALSE_STATEMENTS_REF = {
  piGrows:       { zh:'圓愈大，圓周率就愈大', en:'The bigger the circle, the bigger pi gets' },
  radiusTimesPi: { zh:'圓周長 ＝ 半徑 × 3.14', en:'Circumference ＝ radius × 3.14' },
  diameterArea:  { zh:'圓面積 ＝ 直徑 × 直徑 × 3.14', en:'Area ＝ diameter × diameter × 3.14' },
  sameUnit:      { zh:'圓面積的單位也是公分', en:'An area is measured in centimetres too' },
  doubleBoth:    { zh:'半徑變成 2 倍，面積也只變成 2 倍', en:'Doubling the radius only doubles the area' },
  piExact:       { zh:'圓周率剛剛好等於 3.14，沒有多也沒有少', en:'Pi is exactly 3.14, no more and no less' }
};
const FALSE_KEYS_REF = Object.keys(FALSE_STATEMENTS_REF);
function statementTruthOfText(text, lang){
  for (const k of Object.keys(TRUE_STATEMENTS_REF)) if (TRUE_STATEMENTS_REF[k][lang] === text) return true;
  for (const k of FALSE_KEYS_REF) if (FALSE_STATEMENTS_REF[k][lang] === text) return false;
  return null;
}
const ASKS_REF = {
  circ: {
    fence:  { zh:'圓形花圃要圍一圈籬笆，籬笆要多長', en:'How long a fence is needed right round a round flower bed' },
    edge:   { zh:'圓形桌子的邊緣要貼一圈防撞條，防撞條要多長', en:'How long an edging strip is needed right round a round table' },
    lap:    { zh:'沿著圓形水池走一圈，走了多遠', en:'How far it is to walk right round a round pond' },
    wheel:  { zh:'車輪滾一圈，前進了多遠', en:'How far a wheel moves forward in one turn' }
  },
  area: {
    cloth:  { zh:'圓形桌子要鋪滿一張桌巾，桌巾要多大', en:'How large a cloth is needed to cover a round table' },
    paint:  { zh:'圓形招牌整面要塗油漆，要塗多大一片', en:'How large a patch of paint covers the whole face of a round sign' },
    lawn:   { zh:'圓形草地要鋪滿草皮，草皮要多大', en:'How much turf is needed to cover a round lawn' },
    glass:  { zh:'圓形桌面要蓋一塊玻璃，玻璃要多大', en:'How large a sheet of glass is needed to cover a round tabletop' }
  }
};
function askKindOfText(text, lang){
  for (const k of Object.keys(ASKS_REF.circ)) if (ASKS_REF.circ[k][lang] === text) return 'circ';
  for (const k of Object.keys(ASKS_REF.area)) if (ASKS_REF.area[k][lang] === text) return 'area';
  return null;
}
/* 複習頁的應用題情境（第二份） */
const SCEN_REF = {
  zh: {
    lid:   { what:'餅乾盒蓋', ask:'要沿著蓋子的<strong>邊緣</strong>貼一圈緞帶，緞帶至少要多長？' },
    track: { what:'圓形跑道', ask:'沿著跑道的<strong>邊緣</strong>跑一圈，跑了多遠？' },
    pot:   { what:'圓形花盆口', ask:'要沿著盆口的<strong>邊緣</strong>繞一圈鐵絲，鐵絲至少要多長？' },
    mat:   { what:'圓形杯墊', ask:'<strong>整片</strong>都要用布鋪滿，需要多少布？' },
    pizza: { what:'圓形披薩', ask:'<strong>整個表面</strong>都要鋪滿起司，要鋪多大一片？' },
    sign:  { what:'圓形招牌', ask:'<strong>整面</strong>都要塗上油漆，要塗多大一片？' }
  },
  en: {
    lid:   { what:'the lid of a biscuit tin', ask:'A ribbon is glued right round the <strong>rim of the lid</strong>. How long does the ribbon have to be?' },
    track: { what:'a circular track', ask:'Running right round the <strong>edge</strong> of the track, how far is that?' },
    pot:   { what:'the mouth of a round flowerpot', ask:'A wire is wound right round the <strong>rim</strong>. How long does the wire have to be?' },
    mat:   { what:'a round coaster', ask:'It is to be covered <strong>all over</strong> with cloth. How much cloth is needed?' },
    pizza: { what:'a round pizza', ask:'The <strong>whole top</strong> is to be covered with cheese. How large a patch is that?' },
    sign:  { what:'a round sign', ask:'The <strong>whole face</strong> is to be painted. How large a patch is that?' }
  }
};
const CIRC_IDS_REF = ['lid', 'track', 'pot'];
const AREA_IDS_REF = ['mat', 'pizza', 'sign'];

/* ---------- 4) 跨頁用詞釘樁：min 一律寫成**當下真實的出現次數**（拿掉註解之後、讀者看得到的文字） ---------- */
const SIBLING_RULES = [
  { file:'index',     text:'直徑 × 3.14', min:8, why:'is the circumference rule this lesson teaches' },
  { file:'reference', text:'直徑 × 3.14', min:9, why:'is the circumference rule this lesson teaches' },
  { file:'review',    text:'直徑 × 3.14', min:2, why:'is the circumference rule this lesson teaches' },
  { file:'parents',   text:'直徑 × 3.14', min:2, why:'is the circumference rule this lesson teaches' },
  { file:'index',     text:'半徑 × 半徑 × 3.14', min:16, why:'is the area rule this lesson teaches' },
  { file:'reference', text:'半徑 × 半徑 × 3.14', min:10, why:'is the area rule this lesson teaches' },
  { file:'review',    text:'半徑 × 半徑 × 3.14', min:1, why:'is the area rule this lesson teaches' },
  { file:'parents',   text:'半徑 × 半徑 × 3.14', min:2, why:'is the area rule this lesson teaches' },
  { file:'index',     text:'先除以 2', min:7, why:'is what a diameter needs before an area can be worked out' },
  { file:'reference', text:'先除以 2', min:4, why:'is what a diameter needs before an area can be worked out' },
  { file:'review',    text:'先除以 2', min:2, why:'is what a diameter needs before an area can be worked out' },
  { file:'parents',   text:'先除以 2', min:6, why:'is what a diameter needs before an area can be worked out' },
  { file:'index',     text:'沿著邊走', min:8, why:'is how this lesson decides perimeter versus area' },
  { file:'reference', text:'沿著邊走', min:4, why:'is how this lesson decides perimeter versus area' },
  { file:'review',    text:'沿著邊走', min:2, why:'is how this lesson decides perimeter versus area' },
  { file:'parents',   text:'沿著邊走', min:4, why:'is how this lesson decides perimeter versus area' },
  { file:'index',     text:'平方公分', min:43, why:'is the unit an area takes' },
  { file:'reference', text:'平方公分', min:13, why:'is the unit an area takes' },
  { file:'review',    text:'平方公分', min:10, why:'is the unit an area takes' },
  { file:'parents',   text:'平方公分', min:10, why:'is the unit an area takes' },
  { file:'index',     text:'圓周率', min:24, why:'is the name of the fixed multiplier' },
  { file:'reference', text:'圓周率', min:13, why:'is the name of the fixed multiplier' },
  { file:'review',    text:'圓周率', min:11, why:'is the name of the fixed multiplier' },
  { file:'parents',   text:'圓周率', min:20, why:'is the name of the fixed multiplier' },
  { file:'index',     text:'diameter × 3.14', min:5, why:'is the English circumference rule' },
  { file:'reference', text:'diameter × 3.14', min:6, why:'is the English circumference rule' },
  { file:'review',    text:'diameter × 3.14', min:2, why:'is the English circumference rule' },
  { file:'parents',   text:'diameter × 3.14', min:1, why:'is the English circumference rule' },
  { file:'index',     text:'radius × radius × 3.14', min:10, why:'is the English area rule' },
  { file:'reference', text:'radius × radius × 3.14', min:6, why:'is the English area rule' },
  { file:'review',    text:'radius × radius × 3.14', min:1, why:'is the English area rule' },
  { file:'parents',   text:'radius × radius × 3.14', min:1, why:'is the English area rule' },
  { file:'index',     text:'square centimetre', min:33, why:'is the English unit an area takes' },
  { file:'reference', text:'square centimetre', min:7, why:'is the English unit an area takes' },
  { file:'review',    text:'square centimetre', min:10, why:'is the English unit an area takes' },
  { file:'parents',   text:'square centimetre', min:5, why:'is the English unit an area takes' }
];
/* 一個字都不可以出現：次方寫法；另一種圓周率近似值；把迷思當事實寫出來的短句。 */
const FORBIDDEN = [
  { file:'index',     text:'²', why:'writes a power — this lesson spells out “radius × radius”' },
  { file:'reference', text:'²', why:'writes a power — this lesson spells out “radius × radius”' },
  { file:'review',    text:'²', why:'writes a power — this lesson spells out “radius × radius”' },
  { file:'parents',   text:'²', why:'writes a power — this lesson spells out “radius × radius”' },
  { file:'index',     text:'22/7', why:'uses a second approximation of pi — this lesson only uses 3.14' },
  { file:'reference', text:'22/7', why:'uses a second approximation of pi — this lesson only uses 3.14' },
  { file:'review',    text:'22/7', why:'uses a second approximation of pi — this lesson only uses 3.14' },
  { file:'parents',   text:'22/7', why:'uses a second approximation of pi — this lesson only uses 3.14' },
  { file:'index',     text:'半徑 × 3.14 就是圓周長', why:'states the misconception as a fact' },
  { file:'review',    text:'半徑 × 3.14 就是圓周長', why:'states the misconception as a fact' },
  { file:'parents',   text:'半徑 × 3.14 就是圓周長', why:'states the misconception as a fact' }
];
/* 交給別課的詞，出現時同一頁要說出它屬於哪一課或不在這一課。 */
const HANDOFF = [
  { word:'扇形', near:['不在這一課', '五年級'], files:['index', 'reference', 'parents'] },
  { word:'半圓', near:['不在這一課'], files:['index', 'reference', 'parents'] },
  { word:'圓柱', near:['不在這一課'], files:['index', 'reference', 'parents'] },
  { word:'圓規畫圓趣', near:['三年級'], files:['index', 'reference', 'parents'] },
  { word:'繞一圈量量看', near:['三年級'], files:['index', 'reference', 'parents'] },
  { word:'面積魔術師', near:['五年級'], files:['index', 'reference', 'parents'] }
];
/* ⚠️ 算式裡夾單位會讓求值器把算式切成兩半，剩下的半截被當成另一條宣稱。
   `10 公分 × 3.14`、`5 cm × 2` 這種寫法一個都不可以有。 */
const UNIT_WORDS_SRC = '公分|平方公分|倍|cm|square centimetres?|centimetres?|times?';
const UNIT_IN_EQ = new RegExp('(?:' + UNIT_WORDS_SRC + ')\\s*[×÷]|[×÷]\\s*(?:' + UNIT_WORDS_SRC + ')\\b');

/* ---------- 5) 題庫神諭：整句題幹（zh／en）＋ 四個選項原文 ＋ 正解原文 ---------- */
const BANK = {
  qs:[
    { zh:'一個圓的<strong>直徑</strong>是 <strong>10 公分</strong>，圓周長是多少？',
      en:'A circle has a <strong>diameter</strong> of <strong>10 centimetres</strong>. What is its circumference?',
      optsZh:['15.7 公分', '20 公分', '78.5 平方公分', '31.4 公分'],
      optsEn:['15.7 centimetres', '20 centimetres', '78.5 square centimetres', '31.4 centimetres'],
      ansZh:'31.4 公分', ansEn:'31.4 centimetres' },
    { zh:'一個圓的<strong>半徑</strong>是 <strong>4 公分</strong>，圓周長是多少？',
      en:'A circle has a <strong>radius</strong> of <strong>4 centimetres</strong>. What is its circumference?',
      optsZh:['12.56 公分', '25.12 公分', '50.24 平方公分', '8 公分'],
      optsEn:['12.56 centimetres', '25.12 centimetres', '50.24 square centimetres', '8 centimetres'],
      ansZh:'25.12 公分', ansEn:'25.12 centimetres' },
    { zh:'不管圓是大是小，<strong>圓周長 ÷ 直徑</strong> 都是多少？',
      en:'However big or small a circle is, what is <strong>circumference ÷ diameter</strong>?',
      optsZh:['3.14', '6.28', '1.57', '要看圓有多大'],
      optsEn:['3.14', '6.28', '1.57', 'it depends on how big the circle is'],
      ansZh:'3.14', ansEn:'3.14' },
    { zh:'一個圓的<strong>半徑</strong>是 <strong>6 公分</strong>，面積是多少？',
      en:'A circle has a <strong>radius</strong> of <strong>6 centimetres</strong>. What is its area?',
      optsZh:['37.68 公分', '18.84 平方公分', '452.16 平方公分', '113.04 平方公分'],
      optsEn:['37.68 centimetres', '18.84 square centimetres', '452.16 square centimetres', '113.04 square centimetres'],
      ansZh:'113.04 平方公分', ansEn:'113.04 square centimetres' },
    { zh:'一個圓的<strong>直徑</strong>是 <strong>8 公分</strong>，面積是多少？',
      en:'A circle has a <strong>diameter</strong> of <strong>8 centimetres</strong>. What is its area?',
      optsZh:['200.96 平方公分', '25.12 公分', '50.24 平方公分', '12.56 平方公分'],
      optsEn:['200.96 square centimetres', '25.12 centimetres', '50.24 square centimetres', '12.56 square centimetres'],
      ansZh:'50.24 平方公分', ansEn:'50.24 square centimetres' },
    { zh:'一個圓形杯墊的<strong>半徑</strong>是 <strong>5 公分</strong>。要沿著<strong>邊緣</strong>縫一圈緞帶，緞帶至少要多長？',
      en:'A round coaster has a <strong>radius</strong> of <strong>5 centimetres</strong>. A ribbon is sewn right round its <strong>rim</strong>. How long does the ribbon have to be?',
      optsZh:['78.5 平方公分', '31.4 公分', '15.7 公分', '10 公分'],
      optsEn:['78.5 square centimetres', '31.4 centimetres', '15.7 centimetres', '10 centimetres'],
      ansZh:'31.4 公分', ansEn:'31.4 centimetres' }
  ],
  qsAdv:[
    { zh:'一個圓的<strong>圓周長</strong>是 <strong>43.96 公分</strong>，它的<strong>直徑</strong>是多少？',
      en:'A circle has a <strong>circumference</strong> of <strong>43.96 centimetres</strong>. What is its <strong>diameter</strong>?',
      optsZh:['21.98 公分', '7 公分', '14 公分', '87.92 公分'],
      optsEn:['21.98 centimetres', '7 centimetres', '14 centimetres', '87.92 centimetres'],
      ansZh:'14 公分', ansEn:'14 centimetres' },
    { zh:'小圓的半徑是 <strong>3 公分</strong>，大圓的半徑是 <strong>6 公分</strong>。大圓的<strong>面積</strong>是小圓的幾倍？',
      en:'A small circle has a radius of <strong>3 centimetres</strong> and a large one a radius of <strong>6 centimetres</strong>. The large circle’s <strong>area</strong> is how many times the small one’s?',
      optsZh:['2 倍', '4 倍', '3.14 倍', '6 倍'],
      optsEn:['2 times', '4 times', '3.14 times', '6 times'],
      ansZh:'4 倍', ansEn:'4 times' },
    { zh:'一個圓形時鐘的<strong>直徑</strong>是 <strong>24 公分</strong>。整個鐘面要貼一張圓形的紙，這張紙要多大？',
      en:'A round clock has a <strong>diameter</strong> of <strong>24 centimetres</strong>. A round sheet of paper is to cover the whole face. How big is that sheet?',
      optsZh:['75.36 公分', '452.16 平方公分', '1808.64 平方公分', '226.08 平方公分'],
      optsEn:['75.36 centimetres', '452.16 square centimetres', '1808.64 square centimetres', '226.08 square centimetres'],
      ansZh:'452.16 平方公分', ansEn:'452.16 square centimetres' },
    { zh:'小安說：「圓周長 ÷ 直徑 算出來是 3.14，所以圓愈大，這個數就愈大。」下面哪一句話的<strong>結論和理由都對</strong>？',
      en:'Ann says: “Circumference ÷ diameter works out as 3.14, so the bigger the circle, the bigger that number gets.” Which sentence has <strong>both the right conclusion and the right reason</strong>?',
      optsZh:['不對，不管圓多大，圓周長 ÷ 直徑 都是 3.14，因為圓變大的時候圓周長和直徑是一起變大的', '對，因為圓愈大，圓周長就愈長', '對，因為圓周率會隨著半徑一起變大', '不對，圓愈大這個數反而愈小'],
      optsEn:['No: circumference ÷ diameter is 3.14 for every circle, because as a circle grows its circumference and its diameter grow together', 'Yes: the bigger the circle, the longer the circumference', 'Yes: pi grows along with the radius', 'No: the bigger the circle, the smaller that number gets'],
      ansZh:'不對，不管圓多大，圓周長 ÷ 直徑 都是 3.14，因為圓變大的時候圓周長和直徑是一起變大的',
      ansEn:'No: circumference ÷ diameter is 3.14 for every circle, because as a circle grows its circumference and its diameter grow together' }
  ],
  qsBoost:[
    { zh:'小華算「<strong>半徑 6 公分</strong>的圓面積」，寫成「6 × 3.14 ＝ 18.84」。他哪裡想錯了？',
      en:'Ben works out the area of a circle with a <strong>radius of 6 centimetres</strong> as “6 × 3.14 ＝ 18.84”. What has he got wrong?',
      optsZh:['他沒有錯，圓面積就是半徑乘以圓周率', '面積要用到半徑<strong>兩次</strong>：6 × 6 × 3.14 ＝ 113.04', '應該用直徑：12 × 3.14 ＝ 37.68', '應該再除以 2：6 × 3.14 ÷ 2 ＝ 9.42'],
      optsEn:['Nothing; an area is the radius times pi', 'An area uses the radius <strong>twice</strong>: 6 × 6 × 3.14 ＝ 113.04', 'He should use the diameter: 12 × 3.14 ＝ 37.68', 'He should halve it as well: 6 × 3.14 ÷ 2 ＝ 9.42'],
      ansZh:'面積要用到半徑<strong>兩次</strong>：6 × 6 × 3.14 ＝ 113.04',
      ansEn:'An area uses the radius <strong>twice</strong>: 6 × 6 × 3.14 ＝ 113.04' },
    { zh:'小美說：「<strong>直徑 10 公分</strong>的圓，面積是 10 × 10 × 3.14 ＝ 314 平方公分。」她哪裡想錯了？',
      en:'Mia says: “A circle with a <strong>diameter of 10 centimetres</strong> has an area of 10 × 10 × 3.14 ＝ 314 square centimetres.” What has she got wrong?',
      optsZh:['她沒有錯，直徑相乘再乘 3.14 就是面積', '公式裡要的是<strong>半徑</strong>：10 ÷ 2 ＝ 5，5 × 5 × 3.14 ＝ 78.5', '面積要用圓周長來算：10 × 3.14 ＝ 31.4', '公式是直徑 × 直徑 ÷ 3.14'],
      optsEn:['Nothing; multiply the diameter by itself and then by pi', 'The formula wants the <strong>radius</strong>: 10 ÷ 2 ＝ 5, and 5 × 5 × 3.14 ＝ 78.5', 'An area is worked out from the circumference: 10 × 3.14 ＝ 31.4', 'The formula is diameter × diameter ÷ 3.14'],
      ansZh:'公式裡要的是<strong>半徑</strong>：10 ÷ 2 ＝ 5，5 × 5 × 3.14 ＝ 78.5',
      ansEn:'The formula wants the <strong>radius</strong>: 10 ÷ 2 ＝ 5, and 5 × 5 × 3.14 ＝ 78.5' }
  ]
};
/* 題庫裡的數字事實，各自獨立算一次。 */
const BANK_FACTS = [
  { circOfD:10, want:'31.4' }, { circOfR:4, want:'25.12' }, { areaOfR:6, want:'113.04' },
  { areaOfD:8, want:'50.24' }, { circOfR:5, want:'31.4' }, { areaOfR:5, want:'78.5' },
  { circOfD:14, want:'43.96' }, { areaOfR:3, want:'28.26' }, { areaOfD:24, want:'452.16' },
  { circOfD:24, want:'75.36' }, { areaOfD:10, want:'78.5' }, { circOfR:6, want:'37.68' }
];

const GEN_IDS = ['circFromR', 'circFromD', 'dFromCirc', 'areaFromR', 'areaFromD', 'wordCirc',
                 'wordArea', 'scaleArea', 'whichQuestion', 'trueStatement', 'interRadius', 'interStraight'];

/* plan → DOM 的接線。⚠️ 這是字面掃描，不是資料流分析：它只證明「畫圖那一行還在讀 plan」，
   證明不了 plan 之外沒有別的座標被畫上去。真的要證明得在 DOM 裡跑一次，這裡沒有。 */
const RENDER_PINS = [
  { file:'index', text:'drawPlan(s1fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s2fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s3fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s4fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s5fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(gFig, fig,', min:1, max:1 },
  { file:'index', text:'drawPlan(s1fig,', min:1, max:1 },
  { file:'index', text:'drawPlan(s2fig,', min:1, max:1 },
  { file:'index', text:'drawPlan(s3fig,', min:1, max:1 },
  { file:'index', text:'drawPlan(s4fig,', min:1, max:1 },
  { file:'index', text:'drawPlan(s5fig,', min:1, max:1 },
  { file:'index', text:'drawPlan(gFig,', min:1, max:1 },
  { file:'index', text:'var fig = roundFigure(round);', min:1 },
  { file:'index', text:'var ansAt = roundAnswerIndex(round);', min:1 },
  { file:'index', text:"if (p.k === 'circle') svg.appendChild(svgEl('circle', { cx:p.cx, cy:p.cy, r:p.r, fill:p.fill, stroke:p.stroke, 'stroke-width':p.sw }));", min:1 },
  /* 每一張畫布的識別字在程式碼裡出現的次數釘死（markup 的 id、getElementById 那一行的兩次、drawPlan 那一次）：
     繞過 drawPlan 直接往畫布 appendChild 的那一行會多出一次。⚠️ 仍然是字面掃描，改用別名就看不到。 */
  { file:'index', text:'s1fig', min:4, max:4 },
  { file:'index', text:'s2fig', min:4, max:4 },
  { file:'index', text:'s3fig', min:4, max:4 },
  { file:'index', text:'s4fig', min:4, max:4 },
  { file:'index', text:'s5fig', min:4, max:4 },
  { file:'index', text:'gFig', min:4, max:4 }
];
/* review.html 的抽樣池與去重要逐字釘住：產生器自己的過濾會把改壞測試吸收掉。 */
const REVIEW_PINS = [
  "(function(){ for (var r = 3; r <= R_MAX; r++) POOL_R.push(r); })();",
  "(function(){ for (var d = 6; d <= 2 * R_MAX; d += 2) POOL_D.push(d); })();",
  "var POOL_K = [2, 3];",
  "if (!isFinite(v) || v < 1 || v > VAL_MAX || v !== Math.floor(v)) return;",
  "(avoid || []).forEach(function(k){ seen[k] = 1; });",
  "var r = pick(POOL_R.filter(function(v){ return v * k <= R_MAX && v !== k && v !== k * k; }));",
  "var a = 4 + 2 * rand(7);",
  "var CIRC_IDS = ['lid', 'track', 'pot'];",
  "var AREA_IDS = ['mat', 'pizza', 'sign'];"
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
   `圓面積<strong>一定</strong>是直徑相乘` 在畫面上就是那一句迷思，字面掃描不可以被標籤擋住。 */
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
/* ⚠️ `btn` 是語言切換鈕上的字：英文字典裡本來就是「中」（全站慣例，check_i18n 也把它當合法例外），
   所以字串檢查要跳過它，不然每一頁都會誤報一次。 */
const I18N_SKIP_KEYS = ['btn'];
function i18nStrings(obj, out, key){
  if (I18N_SKIP_KEYS.indexOf(key) >= 0) return out;
  if (typeof obj === 'string'){ out.push(obj); return out; }
  if (Array.isArray(obj)){ obj.forEach(v => i18nStrings(v, out)); return out; }
  if (obj && typeof obj === 'object'){ Object.keys(obj).forEach(k => i18nStrings(obj[k], out, k)); return out; }
  return out;
}
function stringProblems(s, lang, where){
  const out = [];
  const t = String(s);
  if (/undefined|NaN|\[object/.test(t)) out.push(where + ' leaks an internal value');
  /* ⚠️ 會換行的標籤要換成一個空白再拆：`… × 3.14<span class="cond">例：…` 在畫面上是兩行，
     直接拆標籤的話 `3.14` 和 `例` 會黏在一起，被「中文和數字之間要有空格」誤報。 */
  const shown = t.replace(/<(?:br|p|div|li|span class="cond")[^>]*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (lang === 'zh' && /\p{Script=Han}\d|\d\p{Script=Han}/u.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:\p{Script=Han}\d|\d\p{Script=Han}).{0,6}/u) || [''])[0]);
  if (lang === 'en' && /\b1 (centimetres|square centimetres|times|circles|squares|wedges)\b/.test(shown)) out.push(where + ' has a singular/plural slip: ' + shown.match(/\b1 [a-z ]+s\b/)[0]);
  if (lang === 'en' && /\p{Script=Han}/u.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  if (UNIT_IN_EQ.test(shown)) out.push(where + ' puts a unit inside an equation: ' + (shown.match(/.{0,14}(?:公分|平方公分|倍|cm)\s*[×÷].{0,10}|.{0,10}[×÷]\s*(?:公分|平方公分|倍|cm).{0,14}/) || [''])[0]);
  return out;
}

/* ---------- 6b) 算式逐條驗算：這一課自己的精確有理數（小數）求值器 ---------- */
function rNorm(x){
  if (!x || !Number.isFinite(x.n) || !Number.isFinite(x.d) || x.d === 0) return null;
  const s = x.d < 0 ? -1 : 1;
  const n = x.n * s, d = x.d * s;
  const g = (function e(a, b){ a = Math.abs(a); while (b){ const t = a % b; a = b; b = t; } return a || 1; })(n, d);
  return { n:n / g, d:d / g };
}
function rAdd(a, b){ return (a && b) ? rNorm({ n:a.n * b.d + b.n * a.d, d:a.d * b.d }) : null; }
function rSub(a, b){ return (a && b) ? rNorm({ n:a.n * b.d - b.n * a.d, d:a.d * b.d }) : null; }
function rMul(a, b){ return (a && b) ? rNorm({ n:a.n * b.n, d:a.d * b.d }) : null; }
function rDivR(a, b){ return (a && b && b.n !== 0) ? rNorm({ n:a.n * b.d, d:a.d * b.n }) : null; }
function rEq(a, b){ return !!(a && b) && a.n * b.d === b.n * a.d; }

const TERM_SRC = '(?:\\d+(?:\\.\\d+)?|[?？□])';
const OP_SRC = '[×*÷+＋\\-－−–]';
const ATOM_SRC = '(?:[()]\\s*)*' + TERM_SRC + '(?:\\s*[()])*';
/* ⚠️ 收尾的 lookahead 只可以擋「數字還沒讀完」，不可以擋句末的句點：
   `62.8 ÷ 20 ＝ 3.14.` 用 (?![\\d.]) 的話，最後一節讀不完就會回溯成 `62.8 ÷ 20`，
   那個等號整條被丟掉 —— 靜靜不驗。 */
const CHAIN_RE = new RegExp('(?<!\\d)(?<!\\d\\.)' + ATOM_SRC + '(?:\\s*(?:' + OP_SRC + '|[＝=])\\s*' + ATOM_SRC + ')*(?!\\.?\\d)', 'g');

function tokensOf(span){
  const toks = [];
  const re = /(\d+(?:\.\d+)?|[?？□]|[×*]|÷|[+＋]|[\-－−–]|[＝=]|[()])/g;
  let m, last = 0;
  while ((m = re.exec(span)) !== null){
    if (span.slice(last, m.index).trim() !== '') return null;
    toks.push(m[0]); last = m.index + m[0].length;
  }
  return span.slice(last).trim() === '' ? toks : null;
}
function valueOfTok(t){
  let m = /^(\d+)\.(\d+)$/.exec(t);
  if (m){
    const scale = Math.pow(10, m[2].length);
    return rNorm({ n:Number(m[1]) * scale + Number(m[2]), d:scale });
  }
  m = /^(\d+)$/.exec(t);
  if (m) return { n:Number(m[1]), d:1 };
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
const DEC_SEEN = [];
function decArith(text){
  const problems = [];
  let verified = 0, questions = 0;
  const plain = String(text).replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const consumed = [];
  const rest = plain.replace(CHAIN_RE, (whole, ...rx) => {
    const at = rx[rx.length - 2], full = rx[rx.length - 1];
    if (!/[＝=]/.test(whole)) return whole;                    /* 沒有等號 → 只是名詞，不是宣稱 */
    let span = whole;
    /* 散文的括號會被一起吃進來：先把**邊緣不成對**的括號剝掉，剝完才是真正的算式。 */
    for (let guard = 0; guard < 8; guard++){
      const opens = (span.match(/\(/g) || []).length, closes = (span.match(/\)/g) || []).length;
      if (opens === closes) break;
      const before = String(full).slice(0, at);
      const proseOpen = (before.match(/\(/g) || []).length > (before.match(/\)/g) || []).length;
      if (closes > opens && proseOpen && /\)\s*$/.test(span)) span = span.replace(/\s*\)\s*$/, '');
      else break;
    }
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
    consumed.push(span.replace(/\s+/g, ' ').trim());
    const sides = span.split(/[＝=]/).map(s => s.trim());
    /* ⚠️ 未知數只讓**貼著它的那一段**變成題目，不是整條鏈：`□ × 3.14 ＝ 31.4 ＝ 99` 裡的
       `31.4 ＝ 99` 是一條實實在在的宣稱，整條跳過等於替它背書（codex 抓到）。 */
    const isQ = sides.map(x => /[?？□]/.test(x));
    const vals = sides.map((x, k) => {
      if (isQ[k]) return { v:null, err:null };
      const tk = tokensOf(x);
      return tk === null ? { v:null, err:'cannot tokenise "' + x + '"' } : parseSide(tk);
    });
    vals.forEach(r => { if (r.err) problems.push(r.err + ' in "' + span + '"'); });
    for (let k = 1; k < vals.length; k++){
      if (isQ[k - 1] || isQ[k]){ questions++; continue; }
      verified++;
      if (!rEq(vals[k - 1].v, vals[k].v)) problems.push('this claim is wrong: "' + span + '"');
    }
    return ' Q ';
  });
  /* 沒有被任何一條鏈吃掉、而且**兩邊都貼著數字**的等號：fail closed。
     ⚠️ 只有一邊是數字的等號當散文放行 —— 規則表就是那樣寫的
        （`圓周長 ＝ 直徑 × 3.14`、`直徑 ＝ 圓周長 ÷ 3.14`）。這是這支驗算器**唯一**的 fail-open，
        四頁因此一律把「算出來的結果」寫成「圓周長是 31.4 公分」而不是「圓周長 ＝ 31.4」。 */
  const leftover = rest.match(/[\d)）]\s*[＝=]\s*[\d(（]/g);
  if (leftover) problems.push('an equals sign with a number on its left was not verified: "' + leftover[0].trim() + '"');
  /* ⚠️ 上面那條只抓「兩邊都是數字」。剩下兩種讀不到的形狀要**直接禁止**，不是跳過：
     ① `圓周長 ＝ 31.5`：左邊是字、右邊是一個光禿禿的數 —— 驗算器算不出左邊是多少，
        所以四頁一律寫成「圓周長是 31.5 公分」。規則表的 `圓周長 ＝ 直徑 × 3.14` 右邊不是光禿禿的數，不受影響。
     ② `10 × × 3.14 ＝ 3.14`：兩個運算子連在一起，鏈會在壞掉的地方斷開，只驗到後面那半截。 */
  /* ⚠️ 括號要一起擋：`圓周長 ＝ (31.4)` 不擋的話一樣繞過去（codex 第二輪抓到）。 */
  const wordEq = plain.match(/[^\s\d(（＝=][ 　]*[＝=][ 　]*[(（]?\d+(?:\.\d+)?(?![ 　]*[×÷+＋\-－−–\d.])/);
  if (wordEq) problems.push('a result is written as "word ＝ number", which cannot be verified: "' + wordEq[0].trim() + '" — write it as 「… 是 …」 instead');
  /* ⚠️ 連兩個運算子要把 ＋ － 也算進去：只擋 × ÷ 的話 `10 × ＋ 3.14 ＝ 3.14` 照樣溜過去，
     後半截還會被當成驗過（codex 第二輪抓到）。 */
  const OPS = '×÷+＋\\-－−–';
  const badOps = plain.match(new RegExp('[' + OPS + '][ 　]*[' + OPS + '＝=]|[＝=][ 　]*[' + OPS + ']'));
  if (badOps) problems.push('a malformed equation: two operators in a row near "' + badOps[0].trim() + '"');
  consumed.forEach(c => DEC_SEEN.push(c));
  return { problems, verified, questions, consumed };
}
/* 驗算器自己的 PROBE：bad:false 必須零誤報，bad:true 一定要抓到。 */
const CLAIM_PROBES = [
  { text:'10 × 3.14 ＝ 31.4', bad:false },
  { text:'5 × 2 × 3.14 ＝ 31.4', bad:false },
  { text:'5 × 5 × 3.14 ＝ 78.5', bad:false },
  { text:'8 ÷ 2 ＝ 4，再 4 × 4 × 3.14 ＝ 50.24', bad:false },
  { text:'43.96 ÷ 3.14 ＝ 14', bad:false },
  { text:'12 × 12 × 3.14 ＝ 452.16', bad:false },
  { text:'5 × 2 × 3.14 ÷ 2 ＝ 15.7', bad:false },
  { text:'15.7 × 5 ＝ 78.5', bad:false },
  { text:'The area is 6 × 6 × 3.14 = 113.04 square centimetres.', bad:false },
  { text:'圓周長 ＝ 直徑 × 3.14', bad:false },
  { text:'圓面積 ＝ 半徑 × 半徑 × 3.14', bad:false },
  { text:'那一小段是直徑的 0.14 倍', bad:false },
  { text:'圓周率是 3.14159… 這個除不盡的小數', bad:false },
  { text:'□ × 3.14 ＝ 31.4', bad:false },
  { text:'(2 × 3) × 3.14 ＝ 18.84', bad:false },
  { text:'（10 × 3.14 ＝ 31.4）', bad:false },
  { text:'連結最後檢查：2026-09-18', bad:false },
  { text:'圓周長 ＝ 直徑 × 3.14 ＝ 半徑 × 2 × 3.14', bad:false },
  { text:'直徑 ＝ 圓周長 ÷ 3.14', bad:false },
  { text:'一共 3 × 3 ＝ 10 個', bad:true },
  /* 這六筆釘住兩輪 codex 抓到的漏洞：未知數只免除貼著它的那一對；
     「字 ＝ 光禿禿的數」（含括號）與連兩個運算子一律禁止。 */
  { text:'□ × 3.14 ＝ 31.4 ＝ 99', bad:true },
  { text:'圓周長 ＝ 31.5', bad:true },
  { text:'圓周長 ＝ (31.4)', bad:true },
  { text:'10 × × 3.14 ＝ 3.14', bad:true },
  { text:'10 × ＋ 3.14 ＝ 3.14', bad:true },
  { text:'半徑 ＝ 直徑 ÷ 2', bad:false },
  { text:'10 × 3.14 ＝ 31.5', bad:true },
  { text:'5 × 2 × 3.14 ＝ 15.7', bad:true },
  { text:'5 × 5 × 3.14 ＝ 78.6', bad:true },
  { text:'8 ÷ 2 ＝ 5', bad:true },
  { text:'43.96 ÷ 3.14 ＝ 15', bad:true },
  { text:'12 × 12 × 3.14 ＝ 452.61', bad:true },
  { text:'The area is 6 × 6 × 3.14 = 113.4 square centimetres.', bad:true },
  { text:'5 ÷ 0 ＝ 5', bad:true },
  { text:'（10 × 3.14 ＝ 31.5）', bad:true },
  { text:'(2 × 3) × 3.14 ＝ 18.85', bad:true },
  { text:'24 ÷ 2 ＝ 12，12 × 12 × 3.14 ＝ 452.16，所以 3 × 3 ＝ 10', bad:true }
];

/* ---------- 7) 從畫出來的圖量回來：三種圖的座標各重算一次 ---------- */
function px2(h){ return h / 100; }
function r1(v){ return Math.round(v * 10) / 10; }
function normPrim(p){
  if (!p || typeof p !== 'object') return 'BAD';
  if (p.k === 'circle') return ['circle', p.cx, p.cy, p.r, p.fill, p.stroke, p.sw].join(' ');
  if (p.k === 'rect') return ['rect', p.x, p.y, p.w, p.h, p.fill, p.stroke, p.sw].join(' ');
  if (p.k === 'line') return ['line', p.x1, p.y1, p.x2, p.y2, p.stroke, p.sw].join(' ');
  return 'BAD:' + p.k;
}
function refUnrollPrims(d){
  if (!isPosIntRef(d) || d < 2 || d > U_D_MAX_REF) return null;
  const rp = d * SC_REF / 2, unit = d * SC_REF, ucx = U_BAR_X0_REF + rp, out = [];
  out.push(['circle', ucx, U_CY_REF, rp, 'none', C_CIRC_REF, STROKE_REF].join(' '));
  out.push(['line', ucx - rp, U_CY_REF, ucx + rp, U_CY_REF, C_LINE_REF, STROKE_REF].join(' '));
  out.push(['circle', ucx, U_CY_REF, DOT_R_REF, C_LINE_REF, 'none', 0].join(' '));
  for (let i = 0; i < 3; i++) out.push(['rect', U_BAR_X0_REF + i * unit, U_BAR_Y_REF, unit, U_BAR_H_REF, C_BAR_REF, '#FFFFFF', 2].join(' '));
  out.push(['rect', U_BAR_X0_REF + 3 * unit, U_BAR_Y_REF, px2(unit * (PI_H_REF - 300)), U_BAR_H_REF, C_TAIL_REF, '#FFFFFF', 2].join(' '));
  return out;
}
function refCirclePrims(r, mark){
  if (!okRRef(r) || MARKS_REF.indexOf(mark) < 0) return null;
  const rp = r * SC_REF, out = [];
  if (mark === 'ring') out.push(['circle', CX_REF, CY_REF, rp, 'none', C_CIRC_REF, RING_STROKE_REF].join(' '));
  else if (mark === 'fill') out.push(['circle', CX_REF, CY_REF, rp, C_FILL_REF, C_CIRC_REF, STROKE_REF].join(' '));
  else out.push(['circle', CX_REF, CY_REF, rp, 'none', C_CIRC_REF, STROKE_REF].join(' '));
  if (mark === 'square'){
    out.push(['rect', CX_REF, CY_REF - rp, rp, rp, C_SQF_REF, C_SQ_REF, STROKE_REF].join(' '));
    out.push(['line', CX_REF, CY_REF, CX_REF + rp, CY_REF, C_SQ_REF, STROKE_REF].join(' '));
  }
  if (mark === 'radius') out.push(['line', CX_REF, CY_REF, CX_REF + rp, CY_REF, C_LINE_REF, STROKE_REF].join(' '));
  if (mark === 'diameter') out.push(['line', CX_REF - rp, CY_REF, CX_REF + rp, CY_REF, C_LINE_REF, STROKE_REF].join(' '));
  out.push(['circle', CX_REF, CY_REF, DOT_R_REF, C_LINE_REF, 'none', 0].join(' '));
  return out;
}
function refRearrangePrims(r){
  if (!okRRef(r) || r < W_R_MIN_REF || r > W_R_MAX_REF) return null;
  const rp = r * SC_REF, rectW = px2(rp * PI_H_REF), rectH = rp, out = [];
  out.push(['circle', W_CX_REF, W_CY_REF, rp, 'none', C_CIRC_REF, STROKE_REF].join(' '));
  for (let i = 0; i < W_PARTS_REF; i++){
    const ang = i * 2 * Math.PI / W_PARTS_REF;
    out.push(['line', W_CX_REF, W_CY_REF, r1(W_CX_REF + rp * Math.cos(ang)), r1(W_CY_REF - rp * Math.sin(ang)), C_CIRC_REF, 1].join(' '));
  }
  out.push(['circle', W_CX_REF, W_CY_REF, DOT_R_REF, C_LINE_REF, 'none', 0].join(' '));
  out.push(['rect', W_RECT_X0_REF, W_CY_REF - rectH / 2, rectW, rectH, C_WEDGE_REF, C_CIRC_REF, STROKE_REF].join(' '));
  /* 每一片小扇形的兩條邊都是半徑 → 排起來的分隔線是一上一下的斜線，不是垂直線。 */
  for (let i = 0; i < W_PARTS_REF; i++){
    const xa = px2(W_RECT_X0_REF * 100 + i * rp * PI_H_REF / W_PARTS_REF);
    const xb = px2(W_RECT_X0_REF * 100 + (i + 1) * rp * PI_H_REF / W_PARTS_REF);
    const top = W_CY_REF - rectH / 2, bot = W_CY_REF + rectH / 2;
    out.push(['line', xa, i % 2 === 0 ? top : bot, xb, i % 2 === 0 ? bot : top, C_CIRC_REF, 1].join(' '));
  }
  return out;
}
/* 把 plan 印成 SVG（帶最長的標籤）餵 lib/canvas.js 驗四個邊。 */
function svgOfPlan(pl, labelA, labelB){
  const parts = pl.prims.map(p => {
    if (p.k === 'circle') return '<circle cx="' + p.cx + '" cy="' + p.cy + '" r="' + p.r + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'rect') return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    return '<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
  });
  pl.labels.forEach(l => parts.push('<text x="' + l.x + '" y="' + l.y + '" font-size="' + LABEL_FS_REF + '" text-anchor="start">' + (l.slot === 'a' ? labelA : labelB) + '</text>'));
  return '<svg viewBox="0 0 ' + pl.w + ' ' + pl.h + '" width="' + pl.w + '" height="' + pl.h + '">' + parts.join('') + '</svg>';
}
/* 一張圖的共同檢查：畫布尺寸、兩個標籤的位置、圖元逐一比對、四個邊。 */
function planProblems(tag, pl, wantPrims, longLabel){
  const out = [];
  if (!pl || typeof pl !== 'object'){ out.push(tag + ': the plan is not an object'); return out; }
  if (pl.w !== FIG_W_REF || pl.h !== FIG_H_REF) out.push(tag + ': canvas is ' + pl.w + 'x' + pl.h + ', expected ' + FIG_W_REF + 'x' + FIG_H_REF);
  if (!Array.isArray(pl.labels) || pl.labels.length !== 2) out.push(tag + ': ' + (pl.labels || []).length + ' label slots, expected 2');
  else {
    const la = pl.labels.find(l => l.slot === 'a'), lb = pl.labels.find(l => l.slot === 'b');
    if (!la || !lb) out.push(tag + ': label slots are not one a and one b');
    else {
      if (la.x !== LABEL_X_REF || lb.x !== LABEL_X_REF) out.push(tag + ': labels are not left-aligned at x=' + LABEL_X_REF);
      if (la.y !== LABEL_A_Y_REF || lb.y !== LABEL_B_Y_REF) out.push(tag + ': labels are not at y=' + LABEL_A_Y_REF + ' and y=' + LABEL_B_Y_REF);
    }
  }
  if (wantPrims === null){
    if (!pl.tooBig) out.push(tag + ': should be tooBig (outside the drawable range) but is not');
    if (Array.isArray(pl.prims) && pl.prims.length) out.push(tag + ': tooBig but ' + pl.prims.length + ' shapes were still planned');
    return out;
  }
  if (pl.tooBig){ out.push(tag + ': flagged tooBig although it is inside the drawable range'); return out; }
  const got = (pl.prims || []).map(normPrim);
  if (got.length !== wantPrims.length) out.push(tag + ': ' + got.length + ' shapes, the reference draws ' + wantPrims.length);
  for (let i = 0; i < Math.min(got.length, wantPrims.length); i++){
    if (got[i] !== wantPrims[i]) out.push(tag + ': shape ' + i + ' is "' + got[i] + '", the reference says "' + wantPrims[i] + '"');
  }
  canvasProblems(svgOfPlan(pl, longLabel, longLabel)).forEach(m => out.push(tag + ' canvas: ' + m));
  return out;
}

/* ---------- 8) 整句題幹重建：每一支產生器、每一種語言各一份。多一個字少一個字都對不上。 ---------- */
function stemRef(genId, d, lang){
  const zh = lang === 'zh';
  switch (genId){
    case 'circFromR':
      return zh ? '一個圓的<strong>半徑</strong>是 <strong>' + d.r + ' 公分</strong>，<strong>圓周長</strong>是多少？'
                : 'A circle has a <strong>radius</strong> of <strong>' + plEnRef(d.r, 'centimetre') + '</strong>. What is its <strong>circumference</strong>?';
    case 'circFromD':
      return zh ? '一個圓的<strong>直徑</strong>是 <strong>' + d.d + ' 公分</strong>，<strong>圓周長</strong>是多少？'
                : 'A circle has a <strong>diameter</strong> of <strong>' + plEnRef(d.d, 'centimetre') + '</strong>. What is its <strong>circumference</strong>?';
    case 'dFromCirc': {
      const c = hTextRef(d.d * PI_H_REF);
      return zh ? '一個圓的<strong>圓周長</strong>是 <strong>' + c + ' 公分</strong>，<strong>直徑</strong>是多少？'
                : 'A circle has a <strong>circumference</strong> of <strong>' + plEnRef(c, 'centimetre') + '</strong>. What is its <strong>diameter</strong>?';
    }
    case 'areaFromR':
      return zh ? '一個圓的<strong>半徑</strong>是 <strong>' + d.r + ' 公分</strong>，<strong>面積</strong>是多少？'
                : 'A circle has a <strong>radius</strong> of <strong>' + plEnRef(d.r, 'centimetre') + '</strong>. What is its <strong>area</strong>?';
    case 'areaFromD':
      return zh ? '一個圓的<strong>直徑</strong>是 <strong>' + d.d + ' 公分</strong>，<strong>面積</strong>是多少？'
                : 'A circle has a <strong>diameter</strong> of <strong>' + plEnRef(d.d, 'centimetre') + '</strong>. What is its <strong>area</strong>?';
    case 'wordCirc':
    case 'wordArea': {
      const s = SCEN_REF[lang][d.id];
      if (!s) return null;
      return zh ? '一個' + s.what + '的半徑是 <strong>' + d.r + ' 公分</strong>。' + s.ask
                : 'There is ' + s.what + ' with a radius of <strong>' + plEnRef(d.r, 'centimetre') + '</strong>. ' + s.ask;
    }
    case 'scaleArea': {
      const big = d.k * d.r;
      return zh ? '小圓的半徑是 <strong>' + d.r + ' 公分</strong>，大圓的半徑是 <strong>' + big + ' 公分</strong>。大圓的<strong>面積</strong>是小圓的幾倍？'
                : 'A small circle has a radius of <strong>' + plEnRef(d.r, 'centimetre') + '</strong> and a large one <strong>' + plEnRef(big, 'centimetre') + '</strong>. The large circle’s <strong>area</strong> is how many times the small one’s?';
    }
    case 'whichQuestion':
      return zh ? '下面四個問題，<strong>只有一個要算面積</strong>。是哪一個？' : 'Of these four questions, <strong>exactly one wants an area</strong>. Which?';
    case 'trueStatement':
      return zh ? '下面四句話，<strong>只有一句是對的</strong>。是哪一句？' : 'Of these four sentences, <strong>exactly one is true</strong>. Which?';
    case 'interRadius':
      if (d.toR) return zh ? '（三年級）一個圓的<strong>直徑</strong>是 <strong>' + d.d + ' 公分</strong>，<strong>半徑</strong>是多少？'
                           : '(Grade three) A circle has a <strong>diameter</strong> of <strong>' + plEnRef(d.d, 'centimetre') + '</strong>. What is its <strong>radius</strong>?';
      return zh ? '（三年級）一個圓的<strong>半徑</strong>是 <strong>' + d.d + ' 公分</strong>，<strong>直徑</strong>是多少？'
                : '(Grade three) A circle has a <strong>radius</strong> of <strong>' + plEnRef(d.d, 'centimetre') + '</strong>. What is its <strong>diameter</strong>?';
    case 'interStraight':
      if (d.kind === 'rect') return zh ? '（五年級）一個長方形的長是 <strong>' + d.a + ' 公分</strong>、寬是 <strong>' + d.b + ' 公分</strong>，面積是多少？'
                                       : '(Grade five) A rectangle is <strong>' + plEnRef(d.a, 'centimetre') + '</strong> long and <strong>' + plEnRef(d.b, 'centimetre') + '</strong> wide. What is its area?';
      return zh ? '（五年級）一個三角形的底是 <strong>' + d.a + ' 公分</strong>、高是 <strong>' + d.b + ' 公分</strong>，面積是多少？'
                : '(Grade five) A triangle has a base of <strong>' + plEnRef(d.a, 'centimetre') + '</strong> and a height of <strong>' + plEnRef(d.b, 'centimetre') + '</strong>. What is its area?';
    default: return null;
  }
}

/* ---------- 9) 產生器：不變條件的共用檢查 ---------- */
function fourDistinct(id, d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return id + ': options are not four';
  if (!(d.ans >= 0 && d.ans < 4)) return id + ': ans index out of range';
  if (new Set(d.opts.map(String)).size !== 4) return id + ': options repeat a string: ' + d.opts;
  return null;
}
/* 產生器內部的編碼 `百分之一|單位`：值與單位都要合法、兩兩不同 */
function tokProblems(id, opts){
  const seen = new Set();
  for (const o of opts){
    const m = /^(\d+)\|(cm|sq|x)$/.exec(String(o));
    if (!m) return id + ': option token "' + o + '" is not <hundredths>|<cm|sq|x>';
    const h = Number(m[1]);
    if (!(h >= 1 && h <= 200000)) return id + ': option token "' + o + '" leaves 1..200000';
    if (seen.has(String(o))) return id + ': two option tokens are the same value: ' + o;
    seen.add(String(o));
  }
  return null;
}
/* 抄題幹：誘答（不含正解）的**數值**不可以等於題幹印出來的任何一個數 */
function echoProblems(id, d, stemNums){
  const want = stemNums.map(v => Math.round(v * 100));
  const bad = d.opts.filter((o, i) => {
    if (i === d.ans) return false;
    const m = /^(\d+)\|/.exec(String(o));
    return m && want.indexOf(Number(m[1])) >= 0;
  });
  return bad.length ? id + ': distractor "' + bad[0] + '" copies a number the stem prints' : null;
}

module.exports = {
  /* ================= 產生器模擬（tools/simgen.js） ================= */
  sim: {
    INVARIANTS: {
      circFromR: d => {
        if (!(Number.isInteger(d.r) && d.r >= 3 && d.r <= R_MAX_REF)) return 'circFromR: r=' + d.r + ' is outside 3..' + R_MAX_REF;
        const f = fourDistinct('circFromR', d); if (f) return f;
        const t = tokProblems('circFromR', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== circRef(d.r) + '|cm') return 'circFromR: opts[ans]=' + d.opts[d.ans] + ' is not ' + circRef(d.r) + '|cm';
        const e = echoProblems('circFromR', d, [d.r]); if (e) return e;
        /* 這一課最重要的誘答：半徑只乘一次（答案的一半） */
        if (d.opts.indexOf(d.r * PI_H_REF + '|cm') < 0) return 'circFromR: the "radius × 3.14" distractor is missing';
      },
      circFromD: d => {
        if (!okDRef(d.d) || d.d < 6) return 'circFromD: d=' + d.d + ' is not an even diameter in 6..' + (2 * R_MAX_REF);
        const f = fourDistinct('circFromD', d); if (f) return f;
        const t = tokProblems('circFromD', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.d * PI_H_REF + '|cm') return 'circFromD: opts[ans]=' + d.opts[d.ans] + ' is not ' + (d.d * PI_H_REF) + '|cm';
        if (d.d * PI_H_REF !== circRef(d.d / 2)) return 'circFromD: the two circumference implementations disagree for d=' + d.d;
        const e = echoProblems('circFromD', d, [d.d]); if (e) return e;
        if (d.opts.indexOf((d.d / 2) * PI_H_REF + '|cm') < 0) return 'circFromD: the "used the radius" distractor is missing';
      },
      dFromCirc: d => {
        if (!okDRef(d.d) || d.d < 6) return 'dFromCirc: d=' + d.d + ' is not an even diameter in 6..' + (2 * R_MAX_REF);
        const f = fourDistinct('dFromCirc', d); if (f) return f;
        const t = tokProblems('dFromCirc', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.d * 100 + '|cm') return 'dFromCirc: opts[ans]=' + d.opts[d.ans] + ' is not ' + (d.d * 100) + '|cm';
        if (diamFromCircRef(d.d * PI_H_REF) !== d.d) return 'dFromCirc: the circumference does not divide back to the diameter for d=' + d.d;
        const e = echoProblems('dFromCirc', d, [d.d * PI_H_REF / 100]); if (e) return e;
        if (d.opts.indexOf(d.d * 50 + '|cm') < 0) return 'dFromCirc: the "answered the radius" distractor is missing';
      },
      areaFromR: d => {
        if (!(Number.isInteger(d.r) && d.r >= 3 && d.r <= R_MAX_REF)) return 'areaFromR: r=' + d.r + ' is outside 3..' + R_MAX_REF;
        const f = fourDistinct('areaFromR', d); if (f) return f;
        const t = tokProblems('areaFromR', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== areaRef(d.r) + '|sq') return 'areaFromR: opts[ans]=' + d.opts[d.ans] + ' is not ' + areaRef(d.r) + '|sq';
        const e = echoProblems('areaFromR', d, [d.r]); if (e) return e;
        /* 周長被端出來當誘答（單位不同）是這一課的主要迷思 */
        if (d.opts.indexOf(circRef(d.r) + '|cm') < 0) return 'areaFromR: the "answered the circumference" distractor is missing';
      },
      areaFromD: d => {
        if (!okDRef(d.d) || d.d < 6) return 'areaFromD: d=' + d.d + ' is not an even diameter in 6..' + (2 * R_MAX_REF);
        const f = fourDistinct('areaFromD', d); if (f) return f;
        const t = tokProblems('areaFromD', d.opts); if (t) return t;
        const r = d.d / 2;
        if (String(d.opts[d.ans]) !== areaRef(r) + '|sq') return 'areaFromD: opts[ans]=' + d.opts[d.ans] + ' is not ' + areaRef(r) + '|sq';
        const e = echoProblems('areaFromD', d, [d.d]); if (e) return e;
        /* 拿直徑當半徑：剛好是正確答案的 4 倍 */
        if (d.opts.indexOf(d.d * d.d * PI_H_REF + '|sq') < 0) return 'areaFromD: the "used the diameter as the radius" distractor is missing';
        if (d.d * d.d * PI_H_REF !== 4 * areaRef(r)) return 'areaFromD: the diameter-as-radius value is not 4 times the answer';
      },
      wordCirc: d => {
        if (!(Number.isInteger(d.r) && d.r >= 3 && d.r <= R_MAX_REF)) return 'wordCirc: r=' + d.r + ' is outside 3..' + R_MAX_REF;
        if (CIRC_IDS_REF.indexOf(d.id) < 0) return 'wordCirc: scenario "' + d.id + '" is not one that travels along the edge';
        const f = fourDistinct('wordCirc', d); if (f) return f;
        const t = tokProblems('wordCirc', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== circRef(d.r) + '|cm') return 'wordCirc: opts[ans]=' + d.opts[d.ans] + ' is not ' + circRef(d.r) + '|cm';
        const e = echoProblems('wordCirc', d, [d.r]); if (e) return e;
        if (d.opts.indexOf(areaRef(d.r) + '|sq') < 0) return 'wordCirc: the "answered the area" distractor is missing';
      },
      wordArea: d => {
        if (!(Number.isInteger(d.r) && d.r >= 3 && d.r <= R_MAX_REF)) return 'wordArea: r=' + d.r + ' is outside 3..' + R_MAX_REF;
        if (AREA_IDS_REF.indexOf(d.id) < 0) return 'wordArea: scenario "' + d.id + '" is not one that fills the inside';
        const f = fourDistinct('wordArea', d); if (f) return f;
        const t = tokProblems('wordArea', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== areaRef(d.r) + '|sq') return 'wordArea: opts[ans]=' + d.opts[d.ans] + ' is not ' + areaRef(d.r) + '|sq';
        const e = echoProblems('wordArea', d, [d.r]); if (e) return e;
        if (d.opts.indexOf(circRef(d.r) + '|cm') < 0) return 'wordArea: the "answered the perimeter" distractor is missing';
      },
      scaleArea: d => {
        if (!(d.k === 2 || d.k === 3)) return 'scaleArea: k=' + d.k + ' is not 2 or 3';
        if (!(Number.isInteger(d.r) && d.r >= 3 && d.r <= R_MAX_REF)) return 'scaleArea: r=' + d.r + ' is outside 3..' + R_MAX_REF;
        if (d.k * d.r > R_MAX_REF) return 'scaleArea: the large radius ' + (d.k * d.r) + ' leaves the lesson range of 1..' + R_MAX_REF;
        if (d.r === d.k || d.r === d.k * d.k) return 'scaleArea: the radius collides with the answer or the multiplier';
        const f = fourDistinct('scaleArea', d); if (f) return f;
        const t = tokProblems('scaleArea', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.k * d.k * 100 + '|x') return 'scaleArea: opts[ans]=' + d.opts[d.ans] + ' is not ' + (d.k * d.k * 100) + '|x';
        /* 周長才是 k 倍 —— 那一個是刻意的迷思誘答 */
        if (d.opts.indexOf(d.k * 100 + '|x') < 0) return 'scaleArea: the "perimeter factor" distractor is missing';
        const e = echoProblems('scaleArea', d, [d.r, d.k * d.r]); if (e) return e;
      },
      whichQuestion: d => {
        if (!ASKS_REF.area[d.a]) return 'whichQuestion: "' + d.a + '" is not an area question';
        const f = fourDistinct('whichQuestion', d); if (f) return f;
        const areas = d.opts.filter(k => String(k).slice(0, 5) === 'area:');
        if (areas.length !== 1) return 'whichQuestion: ' + areas.length + ' area questions offered, the stem promises exactly one';
        if (String(d.opts[d.ans]) !== 'area:' + d.a) return 'whichQuestion: opts[ans] is ' + d.opts[d.ans];
        for (const k of d.opts){
          const p = String(k).split(':');
          if (!ASKS_REF[p[0]] || !ASKS_REF[p[0]][p[1]]) return 'whichQuestion: option key "' + k + '" is unknown to the reference pool';
        }
      },
      trueStatement: d => {
        if (!TRUE_STATEMENTS_REF[d.t]) return 'trueStatement: "' + d.t + '" is not a true statement';
        const f = fourDistinct('trueStatement', d); if (f) return f;
        const trues = d.opts.filter(k => TRUE_STATEMENTS_REF[k]);
        if (trues.length !== 1) return 'trueStatement: ' + trues.length + ' true sentences offered, the stem promises exactly one';
        if (d.opts.some(k => !TRUE_STATEMENTS_REF[k] && FALSE_KEYS_REF.indexOf(k) < 0)) return 'trueStatement: an option key is unknown to the truth table: ' + d.opts;
        if (String(d.opts[d.ans]) !== String(d.t)) return 'trueStatement: opts[ans] is ' + d.opts[d.ans];
      },
      interRadius: d => {
        if (typeof d.toR !== 'boolean') return 'interRadius: toR is not a boolean';
        /* ⚠️ 給的是哪一個量，範圍就不一樣：給直徑要是 6 ~ 24 的偶數，給半徑要在 3 ~ 12 裡。 */
        if (d.toR){
          if (!okDRef(d.d) || d.d < 6) return 'interRadius: the given diameter ' + d.d + ' is not an even value in 6..' + (2 * R_MAX_REF);
        } else if (!(Number.isInteger(d.d) && d.d >= 3 && d.d <= R_MAX_REF)){
          return 'interRadius: the given radius ' + d.d + ' is outside 3..' + R_MAX_REF;
        }
        const f = fourDistinct('interRadius', d); if (f) return f;
        const t = tokProblems('interRadius', d.opts); if (t) return t;
        const want = (d.toR ? d.d * 50 : 2 * d.d * 100) + '|cm';
        if (String(d.opts[d.ans]) !== want) return 'interRadius: opts[ans]=' + d.opts[d.ans] + ' is not ' + want;
        const e = echoProblems('interRadius', d, [d.d]); if (e) return e;
      },
      interStraight: d => {
        if (d.kind !== 'rect' && d.kind !== 'tri') return 'interStraight: kind "' + d.kind + '" is unknown';
        if (!(Number.isInteger(d.a) && d.a >= 4 && d.a <= 16 && d.a % 2 === 0)) return 'interStraight: a=' + d.a + ' is not an even value in 4..16';
        if (!(Number.isInteger(d.b) && d.b >= 3 && d.b <= 12)) return 'interStraight: b=' + d.b + ' is outside 3..12';
        const f = fourDistinct('interStraight', d); if (f) return f;
        const t = tokProblems('interStraight', d.opts); if (t) return t;
        const area = d.kind === 'rect' ? d.a * d.b : d.a * d.b / 2;
        if (!Number.isInteger(area)) return 'interStraight: the area ' + area + ' is not a whole number of square centimetres';
        if (String(d.opts[d.ans]) !== area * 100 + '|sq') return 'interStraight: opts[ans]=' + d.opts[d.ans] + ' is not ' + (area * 100) + '|sq';
        const e = echoProblems('interStraight', d, [d.a, d.b]); if (e) return e;
        /* 這是交錯題：直線圖形的答案都是整數平方公分，不可以出現圓周率留下的小數 */
        if (d.opts.some(o => Number(String(o).split('|')[0]) % 100 !== 0)) return 'interStraight: a straight-sided shape produced an option that is not a whole number';
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'circFromR': return withUnitRef(lang, 'cm', hTextRef(circRef(d.r)));
        case 'circFromD': return withUnitRef(lang, 'cm', hTextRef(d.d * PI_H_REF));
        case 'dFromCirc': return withUnitRef(lang, 'cm', hTextRef(d.d * 100));
        case 'areaFromR': return withUnitRef(lang, 'sq', hTextRef(areaRef(d.r)));
        case 'areaFromD': return withUnitRef(lang, 'sq', hTextRef(areaRef(d.d / 2)));
        case 'wordCirc': return withUnitRef(lang, 'cm', hTextRef(circRef(d.r)));
        case 'wordArea': return withUnitRef(lang, 'sq', hTextRef(areaRef(d.r)));
        case 'scaleArea': return withUnitRef(lang, 'x', hTextRef(d.k * d.k * 100));
        case 'whichQuestion': return ASKS_REF.area[d.a] ? ASKS_REF.area[d.a][lang] : null;
        case 'trueStatement': return TRUE_STATEMENTS_REF[d.t] ? TRUE_STATEMENTS_REF[d.t][lang] : null;
        case 'interRadius': return withUnitRef(lang, 'cm', hTextRef(d.toR ? d.d * 50 : 2 * d.d * 100));
        case 'interStraight': return withUnitRef(lang, 'sq', hTextRef((d.kind === 'rect' ? d.a * d.b : d.a * d.b / 2) * 100));
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣：一個數 ＋ 公分／平方公分／倍，或一句釘住的句子。 */
    optionOk: function(s, genId, lang, isCorrect){
      const t = String(s).trim();
      if (!t) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
      if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
      if (lang === 'en' && /\p{Script=Han}/u.test(t)) return 'English option contains Chinese: ' + t;
      if (genId === 'trueStatement')
        return statementTruthOfText(t, lang) !== null ? null : 'trueStatement option is not one of the pinned sentences: ' + t;
      if (genId === 'whichQuestion')
        return askKindOfText(t, lang) !== null ? null : 'whichQuestion option is not one of the pinned question sentences: ' + t;
      const p = parseOptRef(t, lang);
      if (!p) return genId + ' option is not "<number> <unit>" in this lesson’s writing: ' + t;
      if (p.h < 1 || p.h > 200000) return genId + ' option ' + t + ' leaves the lesson range';
      const wantUnit = (genId === 'areaFromR' || genId === 'areaFromD' || genId === 'wordArea' || genId === 'interStraight') ? 'sq'
                     : (genId === 'scaleArea' ? 'x' : 'cm');
      if (isCorrect && p.u !== wantUnit) return genId + ' marked option carries the unit "' + p.u + '", expected "' + wantUnit + '"';
      if (genId === 'scaleArea' && p.u !== 'x') return 'scaleArea option is not a multiplier: ' + t;
      if (genId !== 'scaleArea' && p.u === 'x') return genId + ' option is a multiplier but this question asks for a length or an area: ' + t;
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
      const keys = q.opts.map(o => optKeyRef(o, lang));
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
        if (keys[i] === keys[j]) out.push('two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
      /* ⚠️ 從**印出來的**題幹讀回數字再和誘答的值比對。simgen 內建的那一條比的是整串字，
         而這一課的選項一律帶單位，所以它永遠比不到 —— 真正的比對在這裡。 */
      if (genId !== 'trueStatement' && genId !== 'whichQuestion'){
        const stemNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(v => Math.round(Number(v) * 100));
        q.opts.forEach((o, oi) => {
          if (oi === q.ans) return;
          const p = parseOptRef(o, lang);
          if (p && stemNums.indexOf(p.h) >= 0) out.push('the distractor "' + o + '" copies a number the stem prints');
        });
      }
      const ar = decArith(q.stem + ' ' + q.why);
      ar.problems.forEach(m => out.push(m));
      if (genId !== 'trueStatement' && genId !== 'whichQuestion' && ar.verified < 1)
        out.push('the explanation should contain an equation to verify, but none was read');
      stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
      stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
      FALSE_KEYS_REF.forEach(k => {
        if (genId !== 'trueStatement' && q.why.indexOf(FALSE_STATEMENTS_REF[k][lang]) >= 0)
          out.push('the explanation states the misconception "' + FALSE_STATEMENTS_REF[k][lang] + '"');
      });
      q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
      const wantText = module.exports.sim.expectedCorrect(d, genId, lang);
      if (wantText !== null && q.opts[q.ans] !== wantText) out.push('the marked option is not "' + wantText + '"');
      if (genId === 'trueStatement'){
        let trues = 0;
        q.opts.forEach(o => { const tv = statementTruthOfText(o, lang); if (tv === null) out.push('option "' + o + '" is not one of the pinned statement texts'); else if (tv) trues++; });
        if (trues !== 1) out.push('the rendered options contain ' + trues + ' true sentences');
      }
      if (genId === 'whichQuestion'){
        let areas = 0;
        q.opts.forEach(o => { const k = askKindOfText(o, lang); if (k === null) out.push('option "' + o + '" is not one of the pinned question sentences'); else if (k === 'area') areas++; });
        if (areas !== 1) out.push('the rendered options contain ' + areas + ' area questions');
      }
      if (genId === 'scaleArea'){
        const units = new Set(q.opts.map(o => (parseOptRef(o, lang) || { u:'?' }).u));
        if (units.size !== 1 || !units.has('x')) out.push('a multiplier question offered a unit other than the multiplier: ' + q.opts.join(' | '));
      }
      return out.length ? out.join('; ') : null;
    },

    /* 這一課的選項一律帶單位，所以 simgen 內建的「誘答抄題幹」比的是整串字，永遠比不到；
       真正的比對在上面 renderCheck 裡（比**值**）。這裡一律不放行。 */
    stemEchoOk: (function(){
      const allow = {};
      GEN_IDS.forEach(genId => { allow[genId] = false; });
      return allow;
    })()
  },

  /* ================= index.html 靜態資料檢查（tools/verify_lesson_data.js） ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{PI_H, R_MAX, isPosInt, isNonNegInt, okR, okD, hText, circH, areaH, diamFromCirc, ' +
                'FIG_W, FIG_H, SC, CX, CY, DOT_R, STROKE, RING_STROKE, LABEL_X, LABEL_A_Y, LABEL_B_Y, LABEL_FS, LABEL_MAX, ' +
                'U_CY, U_BAR_Y, U_BAR_H, U_BAR_X0, U_D_MAX, W_CX, W_CY, W_RECT_X0, W_PARTS, W_R_MIN, W_R_MAX, ' +
                'MARKS, planUnroll, planCircle, planRearrange, ' +
                'S1_CASES, S2_CASES, S3_CASES, S4_CASES, S5_CASES, caseValueH, radiusOf, diameterOf, ' +
                'ROUNDS, roundAnswer, roundAnswerIndex, roundFigure, roundUnit, plEn, withUnit, UNIT_WORD}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器自己先過 PROBE ---- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = decArith(pr.text).problems.length > 0;
        if (caught !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"' + (caught ? ': ' + decArith(pr.text).problems[0] : ''));
      });
      /* ⚠️ PROBE 也會把算式推進 DEC_SEEN，所以覆蓋率要從這裡歸零重數 —— 不然「這一次真的讀到幾條」
         會被上面那 30 筆 PROBE（或同一個行程裡的前一次執行）墊高（codex 抓到）。 */
      DEC_SEEN.length = 0;
      const lessonDir = path.dirname(process.argv[2]);      /* ⚠️ 不可以用 __dirname：breaktest 把四頁複製到暫存目錄 */
      const RAW = {}, TEXT = {};
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        try { RAW[pg] = fs.readFileSync(path.join(lessonDir, pg + '.html'), 'utf8'); TEXT[pg] = visibleText(RAW[pg]); }
        catch (e){ fail('cannot read ' + pg + '.html next to index.html (' + e.code + ')'); }
      });

      /* ---- 1. 版面常數 ＝ 獨立寫死的第二份；六張畫布的 viewBox 與 CSS 高度 ---- */
      const CONSTS = { PI_H:PI_H_REF, R_MAX:R_MAX_REF, FIG_W:FIG_W_REF, FIG_H:FIG_H_REF, SC:SC_REF,
                       CX:CX_REF, CY:CY_REF, DOT_R:DOT_R_REF, STROKE:STROKE_REF, RING_STROKE:RING_STROKE_REF,
                       LABEL_X:LABEL_X_REF, LABEL_A_Y:LABEL_A_Y_REF, LABEL_B_Y:LABEL_B_Y_REF, LABEL_FS:LABEL_FS_REF, LABEL_MAX:LABEL_MAX_REF,
                       U_CY:U_CY_REF, U_BAR_Y:U_BAR_Y_REF, U_BAR_H:U_BAR_H_REF, U_BAR_X0:U_BAR_X0_REF, U_D_MAX:U_D_MAX_REF,
                       W_CX:W_CX_REF, W_CY:W_CY_REF, W_RECT_X0:W_RECT_X0_REF, W_PARTS:W_PARTS_REF, W_R_MIN:W_R_MIN_REF, W_R_MAX:W_R_MAX_REF };
      Object.keys(CONSTS).forEach(k => { if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ' but the reference says ' + CONSTS[k]); });
      if (String(data.MARKS) !== String(MARKS_REF)) fail('the mark list is ' + data.MARKS + ', the reference says ' + MARKS_REF);
      /* 最長的標籤真的放得進畫布：用參考常數自己算，不相信 LABEL_MAX 的註解 */
      if (LABEL_X_REF + Math.ceil(LABEL_MAX_REF * LABEL_FS_REF * 1.2) + 2 > FIG_W_REF) fail('a LABEL_MAX-long label does not fit the canvas width');
      if (LABEL_B_Y_REF + LABEL_FS_REF * 0.25 + 2 > FIG_H_REF) fail('the lower label would fall off the bottom of the canvas');
      const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const svgs = liveSrc.match(/<svg[^>]*>/g) || [];
      if (svgs.length !== 6) fail('index.html has ' + svgs.length + ' canvases, expected 6 (five examples and the game)');
      svgs.forEach(tag => {
        const cls = (/class="([^"]+)"/.exec(tag) || [])[1];
        const nums = ((/viewBox="([^"]+)"/.exec(tag) || ['', ''])[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (cls !== 'circfig') fail('a canvas has class "' + cls + '", which this config does not know');
        else if (nums.length !== 4 || nums[0] !== 0 || nums[1] !== 0 || nums[2] !== FIG_W_REF || nums[3] !== FIG_H_REF) fail('a canvas viewBox is ' + tag + ', expected 0 0 ' + FIG_W_REF + ' ' + FIG_H_REF);
      });
      /* 把圖藏起來的 CSS：plan 的幾何全對、每一條釘樁也全過，畫面上卻什麼都看不到。 */
      const styleBlocks = (liveSrc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
      (styleBlocks.match(/[^{}]*\{[^{}]*\}/g) || []).forEach(rule => {
        const sel = rule.slice(0, rule.indexOf('{'));
        if (!/circfig/i.test(sel)) return;
        const body = rule.slice(rule.indexOf('{'));
        if (/display\s*:\s*none|visibility\s*:\s*(hidden|collapse)|opacity\s*:\s*0(?:\.0+)?\s*[;}]|fill\s*:\s*(none|transparent)|transform\s*:[^;}]*scale\(\s*0(?:\.0+)?\s*[,)]|clip-path\s*:|(?:width|height)\s*:\s*0(?:\.0+)?\s*(?:px|%)?\s*[;}]/i.test(body))
          fail('a CSS rule hides the figure: "' + rule.replace(/\s+/g, ' ').trim().slice(0, 80) + '"');
      });
      const rules = liveSrc.match(/\.circfig\s*\{[^}]*\}/g) || [];
      if (rules.length !== 1) fail('index.html declares the .circfig rule ' + rules.length + ' time(s), expected exactly 1');
      else {
        const hs = rules[0].match(/[{;]\s*height:\s*(\d+)px/g) || [];
        if (hs.length !== 1) fail('the .circfig rule declares a plain height ' + hs.length + ' time(s)');
        else if (Number(/height:\s*(\d+)px/.exec(hs[0])[1]) !== FIG_H_REF) fail('.circfig is ' + hs[0].trim() + ' in CSS but the viewBox is ' + FIG_H_REF + ' tall — the drawing would be letterboxed');
      }

      /* ---- 2. 小數的印法與兩條公式：全域逐一對獨立實作 ---- */
      for (let h = 0; h <= 200000; h++){
        if (data.hText(h) !== hTextRef(h)){ fail('hText(' + h + ') is "' + data.hText(h) + '", the reference says "' + hTextRef(h) + '"'); break; }
      }
      if (data.hText(-1) !== '?' || data.hText(1.5) !== '?' || data.hText('7') !== '?') fail('hText does not fail closed on a bad value');
      if (data.circH(0) !== null || data.circH(R_MAX_REF + 1) !== null || data.circH(2.5) !== null) fail('circH does not fail closed outside 1..' + R_MAX_REF);
      if (data.areaH(0) !== null || data.areaH(R_MAX_REF + 1) !== null) fail('areaH does not fail closed outside 1..' + R_MAX_REF);
      let ratioSeen = null, radii = 0;
      for (let r = 1; r <= R_MAX_REF; r++){
        const c = data.circH(r), a = data.areaH(r);
        radii++;
        if (c !== circRef(r)) fail('circH(' + r + ') is ' + c + ', repeated addition says ' + circRef(r));
        if (a !== areaRef(r)) fail('areaH(' + r + ') is ' + a + ', repeated addition says ' + areaRef(r));
        /* 「圓周長 ＝ 直徑 × 3.14」 */
        if (c !== 2 * r * PI_H_REF) fail('circH(' + r + ') is not the diameter times pi');
        /* 「圓周長 ÷ 直徑 不管圓多大都一樣」—— 用整數比值比，不用浮點 */
        const ratio = c / (2 * r);
        if (ratioSeen === null) ratioSeen = ratio;
        else if (ratio !== ratioSeen) fail('circumference ÷ diameter is not the same for every circle (r=' + r + ')');
        /* 「圓面積 ＝ 圓周長的一半 × 半徑」—— 範例教學 3 那張圖在講的事 */
        if (a !== (c / 2) * r) fail('areaH(' + r + ') is not half the circumference times the radius');
        /* 半徑變 k 倍：周長 k 倍、面積 k × k 倍 */
        for (let k = 2; k <= 3; k++){
          if (2 * (k * r) * PI_H_REF !== k * c) fail('the perimeter does not scale by ' + k + ' at r=' + r);
          if ((k * r) * (k * r) * PI_H_REF !== k * k * a) fail('the area does not scale by ' + k + ' × ' + k + ' at r=' + r);
        }
        /* 倒過來求直徑 */
        if (data.diamFromCirc(c) !== 2 * r) fail('diamFromCirc does not return the diameter for r=' + r);
      }
      if (radii !== R_MAX_REF) fail('only ' + radii + ' radii were checked');
      if (ratioSeen !== PI_H_REF) fail('circumference ÷ diameter came out ' + ratioSeen + ', the reference says ' + PI_H_REF);
      if (data.diamFromCirc(PI_H_REF * 3) !== null) fail('diamFromCirc accepts an odd diameter');
      if (data.diamFromCirc(PI_H_REF * (2 * R_MAX_REF + 2)) !== null) fail('diamFromCirc accepts a diameter outside the lesson range');
      if (data.diamFromCirc(100) !== null) fail('diamFromCirc accepts a circumference that does not divide by pi');
      if (data.okD(5) || data.okD(0) || !data.okD(6) || data.okD(2 * R_MAX_REF + 2))
        fail('okD does not accept exactly the even diameters whose half is a usable radius');
      if (data.plEn(1, 'centimetre') !== '1 centimetre' || data.plEn(2, 'centimetre') !== '2 centimetres') fail('plEn is wrong');
      if (data.withUnit('zh', 'sq', '78.5') !== '78.5 平方公分' || data.withUnit('en', 'sq', '1') !== '1 square centimetre' ||
          data.withUnit('en', 'cm', '31.4') !== '31.4 centimetres' || data.withUnit('en', 'oops', '4') !== '?') fail('withUnit is wrong');

      /* ---- 3. 三種圖：每一個圖元的座標都重算一次再比對，四個邊餵給 lib/canvas.js ---- */
      const LONG = 'x'.repeat(LABEL_MAX_REF);
      let drawn = 0, capped = 0;
      for (let d = 0; d <= U_D_MAX_REF + 2; d++){
        const pl = data.planUnroll(d);
        planProblems('planUnroll(' + d + ')', pl, refUnrollPrims(d), LONG).forEach(fail);
        if (refUnrollPrims(d) === null) capped++; else drawn++;
      }
      if (!drawn || !capped) fail('planUnroll domain: ' + drawn + ' drawable and ' + capped + ' capped — both kinds must occur');
      let cDrawn = 0, cCapped = 0;
      for (let r = 0; r <= R_MAX_REF + 2; r++){
        for (const mark of MARKS_REF.concat(['nonsense'])){
          const pl = data.planCircle(r, mark);
          planProblems('planCircle(' + r + ',' + mark + ')', pl, refCirclePrims(r, mark), LONG).forEach(fail);
          if (refCirclePrims(r, mark) === null) cCapped++; else cDrawn++;
        }
      }
      if (!cDrawn || !cCapped) fail('planCircle domain: ' + cDrawn + ' drawable and ' + cCapped + ' capped — both kinds must occur');
      let wDrawn = 0, wCapped = 0;
      for (let r = 0; r <= R_MAX_REF + 2; r++){
        const pl = data.planRearrange(r);
        planProblems('planRearrange(' + r + ')', pl, refRearrangePrims(r), LONG).forEach(fail);
        if (refRearrangePrims(r) === null) wCapped++; else wDrawn++;
      }
      if (!wDrawn || !wCapped) fail('planRearrange domain: ' + wDrawn + ' drawable and ' + wCapped + ' capped — both kinds must occur');
      /* 切開重排那張圖必須**兩邊等面積**：圓的面積 ＝ 長方形的長 × 寬（都在 px 的座標系裡） */
      for (let r = W_R_MIN_REF; r <= W_R_MAX_REF; r++){
        const pl = data.planRearrange(r), rp = r * SC_REF;
        if (Math.abs(pl.rectW * pl.rectH - (areaRef(r) / 100) * SC_REF * SC_REF) > 1e-9)
          fail('planRearrange(' + r + '): the rectangle area ' + (pl.rectW * pl.rectH) + ' is not the circle area in the same scale');
        if (pl.rectH !== rp) fail('planRearrange(' + r + '): the rectangle is ' + pl.rectH + ' tall, the radius is ' + rp);
        if (Math.abs(pl.rectW - (circRef(r) / 2 / 100) * SC_REF) > 1e-9)
          fail('planRearrange(' + r + '): the rectangle is ' + pl.rectW + ' long, half a circumference is ' + ((circRef(r) / 2 / 100) * SC_REF));
      }

      /* ---- 4. 範例 1～5 的案例 ---- */
      const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => String(v) === String(b[i]));
      if (!sameList(data.S1_CASES, S1_CASES_REF)) fail('S1_CASES is [' + data.S1_CASES + '], the reference says [' + S1_CASES_REF + ']');
      data.S1_CASES.forEach((d, i) => {
        if (!okDRef(d)) fail('S1 case ' + i + ': ' + d + ' is not an even diameter');
        if (data.planUnroll(d).tooBig) fail('S1 case ' + i + ' does not fit the rolling picture');
      });
      if (!sameList(data.S2_CASES.map(c => c.kind + '-' + c.v), S2_CASES_REF.map(c => c[0] + '-' + c[1])))
        fail('S2_CASES is [' + data.S2_CASES.map(c => c.kind + '-' + c.v) + ']');
      const s2kinds = new Set(data.S2_CASES.map(c => c.kind));
      if (!(s2kinds.has('r') && s2kinds.has('d') && s2kinds.has('c'))) fail('S2_CASES must show a radius, a diameter and a backwards case');
      data.S2_CASES.forEach((c, i) => {
        const r = data.radiusOf(c);
        if (!okRRef(r)) fail('S2 case ' + i + ' has no usable radius');
        else if (data.diameterOf(c) !== 2 * r) fail('S2 case ' + i + ': the diameter is not twice the radius');
      });
      if (!sameList(data.S3_CASES, S3_CASES_REF)) fail('S3_CASES is [' + data.S3_CASES + ']');
      data.S3_CASES.forEach((r, i) => { if (data.planRearrange(r).tooBig) fail('S3 case ' + i + ' does not fit the rearranging picture'); });
      if (!sameList(data.S4_CASES.map(c => c.kind + '-' + c.v), S4_CASES_REF.map(c => c[0] + '-' + c[1])))
        fail('S4_CASES is [' + data.S4_CASES.map(c => c.kind + '-' + c.v) + ']');
      if (!data.S4_CASES.some(c => c.kind === 'd')) fail('S4_CASES must include a diameter case (the halve-it-first trap)');
      data.S4_CASES.forEach((c, i) => {
        const r = data.radiusOf(c);
        if (!okRRef(r)) fail('S4 case ' + i + ' has no usable radius');
        else if (data.planCircle(r, 'square').tooBig) fail('S4 case ' + i + ' does not fit the radius-square picture');
      });
      if (!sameList(data.S5_CASES.map(c => c.id + '-' + c.want + '-' + c.r), S5_CASES_REF.map(c => c.join('-'))))
        fail('S5_CASES is [' + data.S5_CASES.map(c => c.id + '-' + c.want + '-' + c.r) + ']');
      let s5circ = 0, s5area = 0;
      data.S5_CASES.forEach((c, i) => {
        if (c.want === 'circ') s5circ++; else if (c.want === 'area') s5area++; else fail('S5 case ' + i + ': unknown want "' + c.want + '"');
        const wantH = c.want === 'circ' ? circRef(c.r) : areaRef(c.r);
        if (data.caseValueH(c) !== wantH) fail('S5 case ' + i + ': the value is ' + data.caseValueH(c) + ', the reference says ' + wantH);
      });
      if (!s5circ || !s5area) fail('S5_CASES must show both a perimeter question and an area question');

      /* ---- 5. 遊戲的五關：正解算得出來、選項不重複、誘答是設計好的那幾個 ---- */
      if (data.ROUNDS.length !== GAME_ROUNDS_REF) fail('the game has ' + data.ROUNDS.length + ' rounds, expected ' + GAME_ROUNDS_REF);
      const kinds = data.ROUNDS.map(r => r.kind);
      if (String(kinds) !== String(['pi', 'circR', 'areaR', 'areaD', 'which'])) fail('the game rounds are ' + kinds);
      data.ROUNDS.forEach((r, i) => {
        if (new Set(r.opts.map(String)).size !== 4) fail('round ' + i + ' repeats an option');
        const at = data.roundAnswerIndex(r);
        if (at < 0) fail('round ' + i + ': the computed answer is not among the options');
        else if (at !== r.ans) fail('round ' + i + ': the declared ans is ' + r.ans + ' but the recomputed answer sits at ' + at);
        const want = r.kind === 'pi' ? '3.14'
                   : r.kind === 'circR' ? hTextRef(circRef(r.r))
                   : r.kind === 'areaR' ? hTextRef(areaRef(r.r))
                   : r.kind === 'areaD' ? hTextRef(areaRef(r.d / 2))
                   : hTextRef(r.want === 'circ' ? circRef(r.r) : areaRef(r.r));
        if (data.roundAnswer(r) !== want) fail('round ' + i + ': roundAnswer is ' + data.roundAnswer(r) + ', the reference says ' + want);
        const fig = data.roundFigure(r);
        if (!fig || fig.tooBig) fail('round ' + i + ': the figure does not fit');
        const unit = data.roundUnit(r);
        const wantUnit = r.kind === 'pi' ? 'none' : (r.kind === 'circR' || (r.kind === 'which' && r.want === 'circ')) ? 'cm' : 'sq';
        if (unit !== wantUnit) fail('round ' + i + ': the unit is "' + unit + '", expected "' + wantUnit + '"');
      });
      /* 第 3、4 關的誘答要包含「周長」與「把直徑當半徑」這兩個典型錯誤 */
      const r3 = data.ROUNDS[2], r4 = data.ROUNDS[3];
      if (r3.opts.indexOf(hTextRef(circRef(r3.r))) < 0) fail('round 2 (area from a radius) is missing the "answered the perimeter" distractor');
      if (r4.opts.indexOf(hTextRef(r4.d * r4.d * PI_H_REF)) < 0) fail('round 3 (area from a diameter) is missing the "used the diameter" distractor');

      /* ---- 6. 題庫：整句題幹、四個選項、正解，全部對神諭；每一句解釋逐條驗算 ---- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const want = BANK[bank];
        ['zh', 'en'].forEach(lang => {
          const got = I18N[lang][bank];
          if (!Array.isArray(got) || got.length !== want.length){ fail(bank + ' ' + lang + ': ' + (got || []).length + ' questions, the oracle has ' + want.length); return; }
          got.forEach((q, i) => {
            const w = want[i];
            if (q.stem !== w[lang]) fail(bank + '[' + i + '] ' + lang + ': the stem is not the pinned sentence: "' + q.stem.replace(/<[^>]+>/g, '') + '"');
            const wOpts = lang === 'zh' ? w.optsZh : w.optsEn;
            if (String(q.opts) !== String(wOpts)) fail(bank + '[' + i + '] ' + lang + ': the options are [' + q.opts + '], the oracle says [' + wOpts + ']');
            const wAns = lang === 'zh' ? w.ansZh : w.ansEn;
            if (q.opts[q.ans] !== wAns) fail(bank + '[' + i + '] ' + lang + ': the marked option is "' + q.opts[q.ans] + '", the oracle says "' + wAns + '"');
            const ar = decArith(q.stem + ' ' + q.why + ' ' + q.opts.join(' '));
            ar.problems.forEach(m => fail(bank + '[' + i + '] ' + lang + ': ' + m));
            if (ar.verified < 1) fail(bank + '[' + i + '] ' + lang + ': the explanation has no equation that could be verified');
            stringProblems(q.stem, lang, bank + '[' + i + '] stem').forEach(fail);
            stringProblems(q.why, lang, bank + '[' + i + '] why').forEach(fail);
            q.opts.forEach((o, oi) => stringProblems(o, lang, bank + '[' + i + '] option ' + oi).forEach(fail));
            /* 值去重（帶單位的也比單位）—— 純文字的選項（「要看圓有多大」）由 raw: 鍵自己區分 */
            const keys = q.opts.map(o => optKeyRef(String(o).replace(/<[^>]+>/g, ''), lang));
            for (let x = 0; x < keys.length; x++) for (let y = x + 1; y < keys.length; y++)
              if (keys[x] === keys[y]) fail(bank + '[' + i + '] ' + lang + ': two options are the same value: ' + q.opts[x] + ' / ' + q.opts[y]);
          });
        });
      });
      /* 題庫裡的每一個數字事實，各自獨立算一次 */
      BANK_FACTS.forEach((f, i) => {
        let got = null;
        if (f.circOfD !== undefined) got = hTextRef(f.circOfD * PI_H_REF);
        else if (f.circOfR !== undefined) got = hTextRef(circRef(f.circOfR));
        else if (f.areaOfR !== undefined) got = hTextRef(areaRef(f.areaOfR));
        else if (f.areaOfD !== undefined) got = hTextRef(areaRef(f.areaOfD / 2));
        if (got !== f.want) fail('bank fact ' + i + ': recomputed ' + got + ', the oracle says ' + f.want);
      });

      /* ---- 7. 跨頁用詞、禁用詞、交給別課的詞、算式裡的單位 ---- */
      SIBLING_RULES.forEach(rule => {
        const t = TEXT[rule.file];
        if (t === undefined) return;
        const n = t.split(rule.text).length - 1;
        if (n < rule.min) fail(rule.file + '.html says "' + rule.text + '" ' + n + ' time(s), expected at least ' + rule.min + ' — it ' + rule.why);
      });
      FORBIDDEN.forEach(rule => {
        const t = TEXT[rule.file];
        if (t === undefined) return;
        if (t.indexOf(rule.text) >= 0) fail(rule.file + '.html contains "' + rule.text + '", which ' + rule.why);
      });
      /* ⚠️ 逐一**出現的位置**檢查，不是整頁檢查：整頁檢查的話，同一頁別的地方寫過一次
         「不在這一課」，後來新增的那一句漏寫也照樣綠燈。窗口取前後 160 個字。 */
      HANDOFF.forEach(rule => {
        rule.files.forEach(pg => {
          const t = TEXT[pg];
          if (t === undefined) return;
          let at = t.indexOf(rule.word);
          while (at >= 0){
            const win = t.slice(Math.max(0, at - 160), at + rule.word.length + 160);
            if (!rule.near.some(n => win.indexOf(n) >= 0))
              fail(pg + '.html mentions "' + rule.word + '" without saying which lesson it belongs to (expected one of: ' + rule.near.join(' / ') + ')');
            at = t.indexOf(rule.word, at + 1);
          }
        });
      });
      /* ⚠️ 頁面層的算式檢查**不可以掃原始碼**：字典是 JS 字串拼出來的，
         `' × 3.14 ＝ ' + hText(c)` 在原始碼裡長得像一條斷掉的算式，而 `indexOf(v) < 0` 的 `<`
         會被當成標籤開頭把後面一段吃掉 —— 兩種都是假警報。
         正確的作法是掃**兩種真的會被讀到的字**：① markup 裡寫死的那一份（先拿掉 <script>）；
         ② 每一頁 I18N 字典裡**求值之後**的字串（函式跳過，它們的輸出由題庫與產生器那兩段驗）。 */
      /* review.html 的字典裡**沒有**算式（每一條都是 fmt() 當場拼出來的，由 simgen 的 renderCheck 逐批驗），
         所以它沒有下限 —— 訂一個 0 的下限只是一條永遠不會響的斷言。它字典裡真的寫死算式的話，
         下面那一輪照樣會驗、算錯照樣會報。 */
      const MIN_EQ = { index:40, reference:10, parents:2 };
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        if (RAW[pg] === undefined) return;
        const chunks = [visibleText(String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n'))];
        const dict = pg === 'index' ? I18N : i18nOf(RAW[pg]);
        if (!dict) fail(pg + '.html: cannot read its I18N dictionary, so its wording went unchecked');
        else ['zh', 'en'].forEach(lang => {
          /* ⚠️ 字典的字串以前只驗算式，沒有跑過字串檢查（英文裡的中文、單複數、連兩個標點、
             算式裡夾單位）—— 那幾條只在題庫與產生器那兩段跑（codex 抓到）。 */
          const one = i18nStrings(dict[lang] || {}, []);
          one.forEach((t, i) => stringProblems(t, lang, pg + '.html ' + lang + ' string ' + i).forEach(fail));
          one.forEach(t => chunks.push(t));
        });
        let verified = 0;
        chunks.forEach(t => {
          if (UNIT_IN_EQ.test(t)) fail(pg + '.html puts a unit inside an equation: "' + (t.match(/.{0,16}(?:公分|平方公分|倍|cm)\s*[×÷].{0,12}|.{0,12}[×÷]\s*(?:公分|平方公分|倍|cm).{0,16}/) || [''])[0].trim() + '"');
          const ar = decArith(t);
          ar.problems.forEach(m => fail(pg + '.html: ' + m));
          verified += ar.verified;
        });
        if (MIN_EQ[pg] !== undefined && verified < MIN_EQ[pg]) fail(pg + '.html only offered ' + verified + ' verifiable equations, expected at least ' + MIN_EQ[pg] + ' — the checker may have stopped reading them');
      });

      /* ---- 8. plan → DOM 的接線與複習頁的抽樣池 ---- */
      const liveOf = { index:stripJsComments(src) };
      ['reference', 'review', 'parents'].forEach(pg => { if (RAW[pg] !== undefined) liveOf[pg] = stripJsComments(RAW[pg]); });
      RENDER_PINS.forEach(pin => {
        const code = liveOf[pin.file];
        if (code === undefined) return;
        const n = code.split(pin.text).length - 1;
        if (pin.min !== undefined && n < pin.min) fail(pin.file + '.html has "' + pin.text.slice(0, 48) + '" ' + n + ' time(s), expected at least ' + pin.min);
        if (pin.max !== undefined && n > pin.max) fail(pin.file + '.html has "' + pin.text.slice(0, 48) + '" ' + n + ' time(s), expected at most ' + pin.max);
      });
      if (RAW.review !== undefined){
        const rv = RAW.review;
        try {
          const i2 = rv.indexOf('/* ---------- 工具 ---------- */'), i3 = rv.indexOf('/* ---------- 出一批');
          const box = new Function(rv.slice(i2, i3) + '\n; return {GENS:GENS, STATEMENTS:STATEMENTS, ASKS:ASKS, POOL_R:POOL_R, POOL_D:POOL_D, POOL_K:POOL_K, SCEN:SCEN, CIRC_IDS:CIRC_IDS, AREA_IDS:AREA_IDS};')();
          const ids = box.GENS.map(g => g.id);
          GEN_IDS.forEach(id => { if (ids.indexOf(id) < 0) fail('review.html has no generator called ' + id); });
          if (ids.length !== GEN_IDS.length) fail('review.html has ' + ids.length + ' generators, expected ' + GEN_IDS.length);
          box.GENS.forEach(g => { if (typeof g.make !== 'function' || typeof g.fmt !== 'function') fail('generator ' + g.id + ' is missing make() or fmt()'); });
          Object.keys(TRUE_STATEMENTS_REF).forEach(k => {
            if (!box.STATEMENTS[k] || box.STATEMENTS[k].truth !== true || box.STATEMENTS[k].zh !== TRUE_STATEMENTS_REF[k].zh || box.STATEMENTS[k].en !== TRUE_STATEMENTS_REF[k].en)
              fail('review.html statement "' + k + '" is not the pinned true sentence');
          });
          FALSE_KEYS_REF.forEach(k => {
            if (!box.STATEMENTS[k] || box.STATEMENTS[k].truth !== false || box.STATEMENTS[k].zh !== FALSE_STATEMENTS_REF[k].zh || box.STATEMENTS[k].en !== FALSE_STATEMENTS_REF[k].en)
              fail('review.html statement "' + k + '" is not the pinned false sentence');
          });
          if (Object.keys(box.STATEMENTS).length !== Object.keys(TRUE_STATEMENTS_REF).length + FALSE_KEYS_REF.length)
            fail('review.html has ' + Object.keys(box.STATEMENTS).length + ' statements, the truth table has ' + (Object.keys(TRUE_STATEMENTS_REF).length + FALSE_KEYS_REF.length));
          /* 「哪一個要算面積」的句庫：兩邊都要夠多，而且每一句的歸類要和參考表一致 */
          ['circ', 'area'].forEach(side => {
            const keys = Object.keys(box.ASKS[side] || {});
            if (keys.length < 4) fail('review.html has only ' + keys.length + ' "' + side + '" question sentences; at least 4 are needed to fill three distractors');
            keys.forEach(k => {
              const ref = ASKS_REF[side][k];
              if (!ref || ref.zh !== box.ASKS[side][k].zh || ref.en !== box.ASKS[side][k].en)
                fail('review.html question sentence "' + side + '/' + k + '" is not the pinned one');
            });
          });
          /* ⚠️ 抽樣池要**確定性**地證明，不能靠抽幾千次碰運氣：把池子讀出來逐一看。 */
          if (!Array.isArray(box.POOL_R) || box.POOL_R.length < 4) fail('review.html no longer exposes a radius pool');
          else {
            if (box.POOL_R.some(v => !Number.isInteger(v) || v < 3 || v > R_MAX_REF)) fail('the radius pool leaves 3..' + R_MAX_REF + ': ' + box.POOL_R);
            if (box.POOL_R.indexOf(2) >= 0) fail('the radius pool still contains 2, where a circumference and an area print the same number');
          }
          if (!Array.isArray(box.POOL_D) || box.POOL_D.some(v => !okDRef(v) || v < 6)) fail('the diameter pool is not even values in 6..' + (2 * R_MAX_REF) + ': ' + box.POOL_D);
          if (String(box.POOL_K) !== '2,3') fail('the scaling pool is ' + box.POOL_K + ', expected 2,3');
          /* 應用題的情境要分成「沿著邊走」與「把裡面填滿」兩組，而且和參考表一致 */
          if (String(box.CIRC_IDS) !== String(CIRC_IDS_REF)) fail('the along-the-edge scenarios are ' + box.CIRC_IDS);
          if (String(box.AREA_IDS) !== String(AREA_IDS_REF)) fail('the fill-the-inside scenarios are ' + box.AREA_IDS);
          ['zh', 'en'].forEach(lang => {
            Object.keys(SCEN_REF[lang]).forEach(id => {
              const got = box.SCEN[lang][id];
              if (!got || got.what !== SCEN_REF[lang][id].what || got.ask !== SCEN_REF[lang][id].ask)
                fail('review.html scenario "' + id + '" (' + lang + ') is not the pinned wording');
            });
          });
        } catch (e){ fail('cannot read review.html generators and pools: ' + e.message); }
        const rvLive = stripJsComments(rv);
        REVIEW_PINS.forEach(p => { if (rvLive.indexOf(p) < 0) fail('review.html no longer contains the sampling line "' + p.slice(0, 60) + '…"'); });
      }

      /* ---- 9. 驗算器的覆蓋率：讀過的算式太少就表示它停止讀了 ---- */
      if (DEC_SEEN.length < 120) fail('the arithmetic checker only read ' + DEC_SEEN.length + ' equations in total — it may have stopped reading them');
    }
  },

  breaks: [
    /* --- 版面常數與畫布 --- */
    { file:'index', via:'index', expect:'layout constant SC',
      find:'  var SC = 6;                                  /* 1 公分畫成 6 px（所有圖同一個比例尺） */',
      replace:'  var SC = 8;                                  /* 1 公分畫成 6 px（所有圖同一個比例尺） */',
      why:'every figure would be drawn at a different scale from the one the checker measures, and the biggest circle would leave the canvas' },
    { file:'index', via:'index', expect:'a canvas viewBox is',
      find:'<svg class="circfig" id="s1fig" viewBox="0 0 460 200"',
      replace:'<svg class="circfig" id="s1fig" viewBox="0 0 460 180"',
      why:'the rolling picture would be drawn in a shorter coordinate system than it uses' },
    { file:'index', via:'index', expect:'in CSS but the viewBox is',
      find:'.circfig{width:100%;max-width:460px;height:200px;display:block;margin:0 auto}',
      replace:'.circfig{width:100%;max-width:460px;height:240px;display:block;margin:0 auto}',
      why:'the drawing would be letterboxed inside a taller box' },
    { file:'index', via:'index', expect:'labels are not at y=',
      find:'  var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 192, LABEL_FS = 14;',
      replace:'  var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 150, LABEL_FS = 14;',
      why:'the lower label would be written on top of the rolling strip instead of below it' },

    /* --- 小數的印法 --- */
    { file:'index', via:'index', expect:'hText(10) is "0.10"',
      find:"    if (f % 10 === 0) return w + '.' + (f / 10);",
      replace:"    if (f % 10 === 0) return w + '.' + f;",
      why:'78.5 would be printed as 78.50, so every answer string would stop matching' },
    { file:'index', via:'index', expect:'hText does not fail closed',
      find:"    if (!isNonNegInt(h)) return '?';",
      replace:"    if (false) return '?';",
      why:'a broken value would be printed as NaN instead of a visible ?' },

    /* --- 兩條公式 --- */
    { file:'index', via:'index', expect:'repeated addition says',
      find:'  function circH(r){ return okR(r) ? 2 * r * PI_H : null; }',
      replace:'  function circH(r){ return okR(r) ? r * PI_H : null; }',
      why:'every circumference on the page would be half its real size — the commonest mistake this lesson is about' },
    { file:'index', via:'index', expect:'repeated addition says',
      find:'  function areaH(r){ return okR(r) ? r * r * PI_H : null; }',
      replace:'  function areaH(r){ return okR(r) ? r * PI_H : null; }',
      why:'every area would use the radius only once — the other misconception this lesson is about' },
    { file:'index', via:'index', expect:'circH does not fail closed',
      find:'  function okR(r){ return isPosInt(r) && r <= R_MAX; }',
      replace:'  function okR(r){ return isPosInt(r) || r <= R_MAX; }',
      why:'a radius outside the lesson range would be accepted and drawn off the canvas' },
    { file:'index', via:'index', expect:'okD does not accept exactly the even diameters',
      find:'  function okD(d){ return isPosInt(d) && d % 2 === 0 && okR(d / 2); }',
      replace:'  function okD(d){ return isPosInt(d) && d % 2 === 0; }',
      why:'a diameter of 26 would be accepted although its radius, 13, leaves the range this lesson draws' },
    { file:'index', via:'index', expect:'diamFromCirc does not return the diameter',
      find:'    return okD(d) ? d : null;',
      replace:'    return okD(d) ? d / 2 : null;',
      why:'going backwards from a circumference would hand back the radius while the page calls it the diameter' },
    { file:'index', via:'index', expect:'layout constant PI_H',
      find:'  var PI_H = 314;        /* 圓周率 3.14，存成百分之一 */',
      replace:'  var PI_H = 316;        /* 圓周率 3.14，存成百分之一 */',
      why:'every number on the page would be worked out with the wrong value of pi' },

    /* --- 圖 A：滾一圈 --- */
    { file:'index', via:'index', expect:'planUnroll(',
      find:"    for (i = 0; i < 3; i++) prims.push(prRect(U_BAR_X0 + i * unit, U_BAR_Y, unit, U_BAR_H, C_BAR, '#FFFFFF', 2));",
      replace:"    for (i = 0; i < 2; i++) prims.push(prRect(U_BAR_X0 + i * unit, U_BAR_Y, unit, U_BAR_H, C_BAR, '#FFFFFF', 2));",
      why:'the strip would show only 2 diameters, so the picture would no longer say 3.14' },
    { file:'index', via:'index', expect:'planUnroll(',
      find:"    prims.push(prRect(U_BAR_X0 + 3 * unit, U_BAR_Y, px(unit * (PI_H - 300)), U_BAR_H, C_TAIL, '#FFFFFF', 2));",
      replace:"    prims.push(prRect(U_BAR_X0 + 3 * unit, U_BAR_Y, px(unit * (PI_H - 200)), U_BAR_H, C_TAIL, '#FFFFFF', 2));",
      why:'the leftover piece would be 1.14 diameters instead of 0.14, so the picture would contradict the number' },
    { file:'index', via:'index', expect:'should be tooBig',
      find:'    if (!isPosInt(d) || d < 2 || d > U_D_MAX) return emptyPlan();',
      replace:'    if (!isPosInt(d) || d < 2) return emptyPlan();',
      why:'a diameter too big for the strip would be drawn straight off the right edge' },

    /* --- 圖 B：一個圓加一個標記 --- */
    { file:'index', via:'index', expect:'planCircle(',
      find:'      prims.push(prRect(CX, CY - rp, rp, rp, C_SQF, C_SQ, STROKE));',
      replace:'      prims.push(prRect(CX, CY - rp, rp, 2 * rp, C_SQF, C_SQ, STROKE));',
      why:'the “radius square” would not be a square, so the picture would stop showing radius × radius' },
    { file:'index', via:'index', expect:'planCircle(',
      find:"    if (mark === 'diameter') prims.push(prLine(CX - rp, CY, CX + rp, CY, C_LINE, STROKE));",
      replace:"    if (mark === 'diameter') prims.push(prLine(CX, CY, CX + rp, CY, C_LINE, STROKE));",
      why:'the line labelled as the diameter would only be a radius long' },
    { file:'index', via:'index', expect:'should be tooBig',
      find:'    if (!okR(r) || MARKS.indexOf(mark) < 0) return emptyPlan();',
      replace:'    if (!okR(r)) return emptyPlan();',
      why:'an unknown mark would silently draw a plain circle instead of refusing' },

    /* --- 圖 C：切開重排 --- */
    { file:'index', via:'index', expect:'the rectangle area',
      find:'    var i, ang, rectW = px(rp * PI_H), rectH = rp;      /* 長方形的長與寬（px） */',
      replace:'    var i, ang, rectW = px(rp * PI_H * 2), rectH = rp;      /* 長方形的長與寬（px） */',
      why:'the rearranged rectangle would be a whole circumference long instead of half, so the two areas would stop matching' },
    { file:'index', via:'index', expect:'planRearrange(',
      find:'      prims.push(prLine(W_CX, W_CY, r1(W_CX + rp * Math.cos(ang)), r1(W_CY - rp * Math.sin(ang)), C_CIRC, 1));',
      replace:'      prims.push(prLine(W_CX, W_CY, r1(W_CX + rp * Math.sin(ang)), r1(W_CY - rp * Math.cos(ang)), C_CIRC, 1));',
      why:'the 12 cuts would be drawn at the wrong angles' },
    { file:'index', via:'index', expect:'layout constant W_PARTS',
      find:'  var W_CX = 70, W_CY = 100, W_RECT_X0 = 150, W_PARTS = 12, W_R_MIN = 3, W_R_MAX = 8;',
      replace:'  var W_CX = 70, W_CY = 100, W_RECT_X0 = 150, W_PARTS = 8, W_R_MIN = 3, W_R_MAX = 8;',
      why:'the picture would be cut into 8 wedges while every caption says 12' },

    /* --- 範例的案例資料 --- */
    { file:'index', via:'index', expect:'S1_CASES is',
      find:'  var S1_CASES = [4, 6, 8, 10];                     /* 直徑（公分） */',
      replace:'  var S1_CASES = [4, 6, 8, 12];                     /* 直徑（公分） */',
      why:'the last rolling case would no longer fit the strip' },
    { file:'index', via:'index', expect:'S2_CASES must show a radius, a diameter and a backwards case',
      find:"    { kind:'c', v:8 }     /* 圓周長 25.12 → 直徑 8（v 記的是直徑，圓周長由它算出來） */",
      replace:"    { kind:'d', v:8 }     /* 圓周長 25.12 → 直徑 8（v 記的是直徑，圓周長由它算出來） */",
      why:'example 2 would lose the backwards case, the only place a circumference is divided by 3.14' },
    { file:'index', via:'index', expect:'S4_CASES must include a diameter case',
      find:"    { kind:'d', v:10 },   /* 直徑 10 → 半徑 5 → 面積 78.5 */\n    { kind:'d', v:14 }    /* 直徑 14 → 半徑 7 → 面積 153.86 */",
      replace:"    { kind:'r', v:5 },   /* 直徑 10 → 半徑 5 → 面積 78.5 */\n    { kind:'r', v:7 }    /* 直徑 14 → 半徑 7 → 面積 153.86 */",
      why:'example 4 would never show the halve-the-diameter-first step, which is the trap it exists for' },
    { file:'index', via:'index', expect:'S5_CASES is',
      find:"    { id:'mat',    want:'area', r:5 },   /* 做一個圓形杯墊要多少布 → 面積 78.5 平方公分 */",
      replace:"    { id:'mat',    want:'circ', r:5 },   /* 做一個圓形杯墊要多少布 → 面積 78.5 平方公分 */",
      why:'a “cover it all over with cloth” question would be answered with a perimeter' },
    { file:'index', via:'index', expect:'the value is',
      find:"  function caseValueH(sc){ return sc.want === 'circ' ? circH(sc.r) : areaH(sc.r); }",
      replace:"  function caseValueH(sc){ return sc.want === 'circ' ? areaH(sc.r) : circH(sc.r); }",
      why:'example 5 would answer every perimeter question with an area and the other way round' },
    { file:'index', via:'index', expect:'has no usable radius',
      find:"    if (sc.kind === 'd' || sc.kind === 'c') return okD(sc.v) ? sc.v / 2 : null;",
      replace:"    if (sc.kind === 'd' || sc.kind === 'c') return okD(sc.v) ? sc.v : null;",
      why:'a diameter would be used as if it were the radius, which is exactly what the lesson warns about' },

    /* --- 遊戲的五關 --- */
    { file:'index', via:'index', expect:'the declared ans is',
      find:"    { kind:'circR', r:4, opts:['12.56', '25.12', '50.24', '8'], ans:1 },",
      replace:"    { kind:'circR', r:4, opts:['12.56', '25.12', '50.24', '8'], ans:0 },",
      why:'the declared answer would point at the half-sized distractor' },
    { file:'index', via:'index', expect:'roundAnswer is',
      find:"    if (r.kind === 'areaD') return okD(r.d) ? hText(areaH(r.d / 2)) : null;",
      replace:"    if (r.kind === 'areaD') return okD(r.d) ? hText(circH(r.d / 2)) : null;",
      why:'the diameter round would be scored against a circumference instead of an area' },
    { file:'index', via:'index', expect:'the unit is',
      find:"    if (r.kind === 'areaR' || r.kind === 'areaD') return 'sq';",
      replace:"    if (r.kind === 'areaR' || r.kind === 'areaD') return 'cm';",
      why:'the two area rounds would offer their answers in centimetres' },
    { file:'index', via:'index', expect:'round 2 (area from a radius) is missing',
      find:"    { kind:'areaR', r:5, opts:['31.4', '15.7', '78.5', '314'], ans:2 },",
      replace:"    { kind:'areaR', r:5, opts:['30.4', '15.7', '78.5', '314'], ans:2 },",
      why:'the round would lose the “answered the perimeter” distractor that makes it worth asking' },
    { file:'index', via:'index', expect:'the figure does not fit',
      find:"    { kind:'pi', d:8, opts:['3.14', '6.28', '1.57', 'depends'], ans:0 },",
      replace:"    { kind:'pi', d:14, opts:['3.14', '6.28', '1.57', 'depends'], ans:0 },",
      why:'the rolling strip for that round would run off the right edge of the canvas' },

    /* --- 題庫 --- */
    { file:'index', via:'index', expect:'the marked option is',
      find:"          opts:['15.7 公分', '20 公分', '78.5 平方公分', '31.4 公分'], ans:3,",
      replace:"          opts:['15.7 公分', '20 公分', '78.5 平方公分', '31.4 公分'], ans:0,",
      why:'the first question would be marked with the half-sized answer' },
    { file:'index', via:'index', expect:'the options are',
      find:"          opts:['200.96 平方公分', '25.12 公分', '50.24 平方公分', '12.56 平方公分'], ans:2,",
      replace:"          opts:['200.96 平方公分', '25.12 公分', '50.24 平方公分', '12.57 平方公分'], ans:2,",
      why:'a distractor would drift away from the value the oracle pins' },
    { file:'index', via:'index', expect:'this claim is wrong',
      find:"          why:'面積是 半徑 × 半徑 × 3.14，也就是 6 × 6 × 3.14 ＝ 113.04，單位是平方公分。",
      replace:"          why:'面積是 半徑 × 半徑 × 3.14，也就是 6 × 6 × 3.14 ＝ 113.05，單位是平方公分。",
      why:'the explanation would state a wrong product while the option list stayed correct' },
    { file:'index', via:'index', expect:'the stem is not the pinned sentence',
      find:"        { stem:'一個圓的<strong>直徑</strong>是 <strong>8 公分</strong>，面積是多少？',",
      replace:"        { stem:'一個圓的<strong>半徑</strong>是 <strong>8 公分</strong>，面積是多少？',",
      why:'the stem would say radius while the options and the explanation still answer for a diameter' },

    /* --- 跨頁用詞與交給別課的詞 --- */
    { file:'reference', via:'index', expect:'expected at least',
      find:"      f2:'圓面積 ＝ 半徑 × 半徑 × 3.14<span class=\"cond\">例：半徑 5 公分 → 5 × 5 × 3.14 ＝ 78.5，答案 78.5 平方公分</span>',",
      replace:"      f2:'圓面積的公式<span class=\"cond\">例：半徑 5 公分 → 5 × 5 × 3.14 ＝ 78.5，答案 78.5 平方公分</span>',",
      why:'the cheat sheet would stop printing the area rule the other three pages teach' },
    { file:'parents', via:'index', expect:'without saying which lesson it belongs to',
      find:'<strong>扇形的弧長與面積</strong>、<strong>半圓等複合圖形</strong>、<strong>圓柱的表面積與體積</strong>都<strong>不在這一課</strong>，留給後面的課。這一課的圓周率一律用 <strong>3.14</strong>，半徑是 1 到 12 的整數公分，給直徑的時候一定是偶數，長度用<strong>公分</strong>、面積用<strong>平方公分</strong>。\',',
      replace:'<strong>扇形的弧長與面積</strong>、<strong>半圓等複合圖形</strong>、<strong>圓柱的表面積與體積</strong>也會在這裡順便講一下。這一課的圓周率一律用 <strong>3.14</strong>，半徑是 1 到 12 的整數公分，給直徑的時候一定是偶數，長度用<strong>公分</strong>、面積用<strong>平方公分</strong>。\',',
      why:'the parents page would claim the lesson also covers sectors, half circles and cylinders' },
    { file:'reference', via:'index', expect:'puts a unit inside an equation',
      find:"      n1:'💬 倒過來也算得出來：<strong>直徑 ＝ 圓周長 ÷ 3.14</strong>。例：圓周長 31.4 公分 → 31.4 ÷ 3.14 ＝ 10，直徑 10 公分。',",
      replace:"      n1:'💬 倒過來也算得出來：<strong>直徑 ＝ 圓周長 ÷ 3.14</strong>。例：圓周長 31.4 公分 ÷ 3.14 ＝ 10，直徑 10 公分。',",
      why:'an equation with a unit inside it would be cut in half by the checker and half of it would go unverified' },

    /* --- 複習頁的產生器 --- */
    { file:'review', via:'review', expect:'is not 1884|cm',
      find:"        var correct = tok(circH(r), 'cm');\n        var cands = [tok(r * PI_H, 'cm'), tok(areaH(r), 'sq'), tok(2 * r * 100, 'cm')];",
      replace:"        var correct = tok(r * PI_H, 'cm');\n        var cands = [tok(circH(r), 'cm'), tok(areaH(r), 'sq'), tok(2 * r * 100, 'cm')];",
      why:'the circumference generator would mark the half-sized value as the answer' },
    { file:'review', via:'review', expect:'the rendered stem is not the rebuilt sentence',
      find:"          stem: lang === 'zh' ? '一個圓的<strong>直徑</strong>是 <strong>' + d.d + ' 公分</strong>，<strong>面積</strong>是多少？'",
      replace:"          stem: lang === 'zh' ? '一個圓的<strong>半徑</strong>是 <strong>' + d.d + ' 公分</strong>，<strong>面積</strong>是多少？'",
      why:'the stem would say radius while the answer is still worked out from a diameter' },
    { file:'review', via:'review', expect:'this claim is wrong',
      find:"            ? '公式裡要的是半徑，所以先除以 2：' + d.d + ' ÷ 2 ＝ ' + r + '，再 ' + r + ' × ' + r + ' × 3.14 ＝ ' + hText(areaH(r)) + '，單位是平方公分。直接拿直徑相乘是 ' + d.d + ' × ' + d.d + ' × 3.14 ＝ ' + hText(d.d * d.d * PI_H) + '，剛好是正確答案的 4 倍。'",
      replace:"            ? '公式裡要的是半徑，所以先除以 2：' + d.d + ' ÷ 2 ＝ ' + r + '，再 ' + r + ' × ' + r + ' × 3.14 ＝ ' + hText(areaH(r)) + '，單位是平方公分。直接拿直徑相乘是 ' + d.d + ' × ' + d.d + ' × 3.14 ＝ ' + hText(d.d * d.d * PI_H + 100) + '，剛好是正確答案的 4 倍。'",
      why:'the explanation would print a wrong product for the distractor it is explaining' },
    { file:'review', via:'review', expect:'the "answered the perimeter" distractor is missing',
      find:"        var cands = [tok(circH(r), 'cm'), tok(r * PI_H, 'sq'), tok(4 * r * r * PI_H, 'sq')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(areaH(r), 'sq'), [tok(r * 100, 'sq')]);\n        var o = optsOf(correct, wrongs);\n        return { r:r, id:id, opts:o.opts, ans:o.ans };",
      replace:"        var cands = [tok(r * PI_H, 'sq'), tok(4 * r * r * PI_H, 'sq'), tok(9 * r * r * PI_H, 'sq')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(areaH(r), 'sq'), [tok(r * 100, 'sq')]);\n        var o = optsOf(correct, wrongs);\n        return { r:r, id:id, opts:o.opts, ans:o.ans };",
      why:'the “cover it all over” word problem would lose the perimeter distractor, which is the whole point of asking it' },
    { file:'review', via:'review', expect:'is not 400|x',
      find:"        var correct = tok(k * k * 100, 'x');",
      replace:"        var correct = tok(k * 100, 'x');",
      why:'the scaling question would answer with the perimeter factor instead of the area factor' },
    { file:'review', via:'review', expect:'options repeat a string',
      find:"      if (seen[c]) return;",
      replace:"      if (false) return;",
      why:'the same value could be offered twice, so a child would really see only three options' },
    { file:'review', via:'review', expect:'r=2 is outside 3..12',
      find:"  (function(){ for (var r = 3; r <= R_MAX; r++) POOL_R.push(r); })();",
      replace:"  (function(){ for (var r = 2; r <= R_MAX; r++) POOL_R.push(r); })();",
      why:'radius 2 makes the circumference and the area print the same number, so two options would differ only by their unit' },
    { file:'review', via:'review', expect:'is not an even diameter',
      find:"  (function(){ for (var d = 6; d <= 2 * R_MAX; d += 2) POOL_D.push(d); })();",
      replace:"  (function(){ for (var d = 6; d <= 2 * R_MAX; d += 1) POOL_D.push(d); })();",
      why:'an odd diameter would give a fractional radius, which this lesson never prints' },
    { file:'review', via:'review', expect:'is not a true statement',
      find:"    radiusTimesPi: { truth:false, zh:'圓周長 ＝ 半徑 × 3.14', en:'Circumference ＝ radius × 3.14' },",
      replace:"    radiusTimesPi: { truth:true, zh:'圓周長 ＝ 半徑 × 3.14', en:'Circumference ＝ radius × 3.14' },",
      why:'the truth table would call the lesson’s headline misconception true' },
    { file:'review', via:'review', expect:'whichQuestion: opts[ans] is',
      find:"        return { a:a, opts:opts, ans:opts.indexOf('area:' + a) };",
      replace:"        return { a:a, opts:opts, ans:0 };",
      why:'the marked option would be whichever question happened to be shuffled first, not the area one' },
    { file:'review', via:'review', expect:'is not one that fills the inside',
      find:"        var r = pickUnused(POOL_R.slice(), used), id = pick(AREA_IDS);",
      replace:"        var r = pickUnused(POOL_R.slice(), used), id = pick(CIRC_IDS);",
      why:'a “cover it all over” answer would be attached to a “right round the edge” scenario' },
    { file:'review', via:'review', expect:'is not one that travels along the edge',
      find:"  var CIRC_IDS = ['lid', 'track', 'pot'];",
      replace:"  var CIRC_IDS = ['lid', 'track', 'mat'];",
      why:'a fill-the-inside scenario would be offered as an along-the-edge one' },
    { file:'review', via:'review', expect:'puts a unit inside an equation',
      find:"            ? '沿著邊走一圈就是<strong>周長</strong>：' + d.r + ' × 2 × 3.14 ＝ ' + hText(circH(d.r)) + '，單位是公分。'",
      replace:"            ? '沿著邊走一圈就是<strong>周長</strong>：' + d.r + ' 公分 × 2 × 3.14 ＝ ' + hText(circH(d.r)) + '，單位是公分。'",
      why:'an equation with a unit inside it would be cut in half and half of it would go unverified' },
    { file:'review', via:'review', expect:'copies a number the stem prints',
      find:"        var wrongs = pickWrongs(correct, cands, nearFallbacks(circH(r), 'cm'), [tok(r * 100, 'cm')]);\n        var o = optsOf(correct, wrongs);\n        return { r:r, opts:o.opts, ans:o.ans };",
      replace:"        var wrongs = pickWrongs(correct, [tok(r * 100, 'cm')].concat(cands), nearFallbacks(circH(r), 'cm'), []);\n        var o = optsOf(correct, wrongs);\n        return { r:r, opts:o.opts, ans:o.ans };",
      why:'the radius printed in the stem would be offered back as a distractor' }
  ]
};
