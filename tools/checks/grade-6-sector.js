/* grade-6/math/sector —— 扇形披薩工廠（占幾分之幾、弧長、扇形面積、扇形的周長）
 *
 * 這一課的正確性有五塊，所以這份設定裡有五套**獨立重寫**的實作，都不呼叫課程頁的函式：
 *
 * 1) 「圓周長」與「圓面積」。課程頁用乘法（2 × r × 314、r × r × 314）；這裡用**重複相加**
 *    （circRef 把 314 加 2r 次、areaRef 把 314 加 r × r 次）。
 * 2) 「弧長」「扇形面積」「扇形周長」。課程頁是 整圓的量 × n / 360；這裡改成
 *    **先約分再乘**（整圓的量 × p / q，p/q 是約分之後的分數），除不盡一律 null。
 *    兩條路都算得出同一個整數，才表示「先乘後除」和「先約分」是一致的。
 * 3) 「小數怎麼印出來」。課程頁自己拆整數位與百分位；這裡用 toFixed(2) 再砍尾端的 0。
 * 4) 「約分」。課程頁用輾轉相除；這裡用**輾轉相減**（gcdSubRef），兩者必須永遠同意。
 * 5) ⚠️ **從畫出來的圖量回來**：兩種圖（一片扇形、扇形＋分格長條）的每一個圖元座標都在這裡
 *    **重算一次**再逐一比對，而且另外**用幾何量驗一次**：兩條半徑的端點到圓心的距離要等於半徑、
 *    兩條半徑的夾角要等於圓心角、扇形路徑的 large-arc flag 要和「圓心角有沒有超過 180 度」一致
 *    （flag 反了的話瀏覽器畫出來是另一半，座標卻完全正確 —— 只比座標看不出來）。
 *    最後印成 SVG 字串（帶最長的標籤）餵 lib/canvas.js 驗四個邊。
 *
 * ⚠️ 這一課是全站第一個用 `<path>` 畫圖的課程頁，所以 2026-09-22 在 lib/canvas.js 補上了
 *    **絕對座標 M／L／A／Z 的外框計算**（含弧在中間凸出去的極值點）。那一段的行為由下面的
 *    PATH_PROBES 每一次 verify_lesson_data 都重跑一次：該乾淨的要乾淨、該抓到的要抓到。
 *
 * ⚠️ **這一課不能用 lib/arith.js**：那一份看到小數就直接判失敗（它是給整數課寫的），
 *    而這一課每一句旁白都是小數算式（`37.68 × 90 ÷ 360 ＝ 9.42`）。用的是全站共用的
 *    lib/decarith.js。它**逐個等號記帳**，已知的 fail-open 只有「左邊不是數字的等號」，
 *    所以四頁一律把算出來的結果寫成「弧長是 9.42 公分」而不是「弧長 ＝ 9.42」。
 * ⚠️ **算式裡不可以夾單位**（`6 公分 × 2` 會被中文切成兩半）。下面 UNIT_IN_EQ 專門擋它。
 * ⚠️ 選項的「值」是**百分之一的整數 ＋ 單位**（`9.42 公分`、`9.42 平方公分`、`60 度` 三個不同的值），
 *    分數選項（`1/4`）自成一類。
 */

const fs = require('fs');
const path = require('path');
const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const PI_H_REF = 314, R_MAX_REF = 12, FULL_DEG_REF = 360;
const ANGLES_REF = [30, 45, 60, 90, 120, 135, 180, 240, 270, 300];
const FIG_W_REF = 460, FIG_H_REF = 200, SC_REF = 6;
const CX_REF = 110, CY_REF = 100, DOT_R_REF = 3, STROKE_REF = 3, HI_STROKE_REF = 7;
const CX_SOLO_REF = 230;   /* 只有一片扇形的時候，圓心在畫布正中央 */
const LABEL_X_REF = 16, LABEL_A_Y_REF = 20, LABEL_B_Y_REF = 192, LABEL_FS_REF = 14, LABEL_MAX_REF = 26;
const BAR_X0_REF = 200, BAR_W_REF = 240, BAR_Y_REF = 88, BAR_H_REF = 24;
const BAR_QS_REF = [2, 3, 4, 6, 8, 12];
const C_LINE_REF = '#2B2A33', C_CIRC_REF = '#3B7DD8', C_WEDGE_REF = '#E8F0FB', C_FILL_REF = '#BBD5F4';
const C_HI_REF = '#E8871E', C_CELL_REF = '#FFFFFF';
const MARKS_REF = ['arc', 'perim', 'fill'];

/* 每一個範例的案例，寫成第二份 */
const S1_CASES_REF = [90, 60, 45, 270];
const S1_R_REF = 10;
const S2_CASES_REF = [['r', 6, 90], ['r', 9, 120], ['r', 10, 45], ['d', 16, 135]];
const S3_CASES_REF = [['r', 6, 90], ['r', 9, 120], ['r', 10, 45], ['d', 16, 135]];
const S4_CASES_REF = [['r', 6, 90], ['r', 10, 180], ['r', 9, 120], ['r', 12, 30]];
const S5_CASES_REF = [['fan', 'arc', 12, 120], ['lawn', 'area', 10, 45], ['flag', 'perim', 6, 90], ['pizza', 'area', 9, 120]];
const GAME_ROUNDS_REF = 5;

/* ---------- 1) 第二套實作 ---------- */
function isPosIntRef(n){ return typeof n === 'number' && Number.isInteger(n) && n >= 1; }
function okRRef(r){ return isPosIntRef(r) && r <= R_MAX_REF; }
function okDRef(d){ return isPosIntRef(d) && d % 2 === 0 && okRRef(d / 2); }
function okAngRef(n){ return isPosIntRef(n) && ANGLES_REF.indexOf(n) >= 0; }
/* 輾轉相減的最大公因數（課程頁用的是輾轉相除）。 */
function gcdSubRef(a, b){
  if (!isPosIntRef(a) || !isPosIntRef(b)) return null;
  while (a !== b){ if (a > b) a -= b; else b -= a; }
  return a;
}
/* 圓周長：把 PI_H 加 2r 次（課程頁是 2 × r × PI_H）。 */
function circRef(r){
  if (!okRRef(r)) return null;
  let s = 0;
  for (let i = 0; i < 2 * r; i++) s += PI_H_REF;
  return s;
}
/* 圓面積：把 PI_H 加 r × r 次（課程頁是 r × r × PI_H）。 */
function areaRef(r){
  if (!okRRef(r)) return null;
  let s = 0;
  for (let i = 0; i < r * r; i++) s += PI_H_REF;
  return s;
}
/* 約分之後的分數。 */
function fracRef(n){
  if (!okAngRef(n)) return null;
  const g = gcdSubRef(n, FULL_DEG_REF);
  return g === null ? null : { p:n / g, q:FULL_DEG_REF / g };
}
/* 弧長／扇形面積：**先約分再乘**（課程頁是先乘 n 再除以 360）。除不盡回 null。 */
function shareOfRef(whole, n){
  const f = fracRef(n);
  if (f === null || whole === null) return null;
  const v = whole * f.p;
  return v % f.q === 0 ? v / f.q : null;
}
function arcRef(r, n){ return shareOfRef(circRef(r), n); }
function secAreaRef(r, n){ return shareOfRef(areaRef(r), n); }
function perimRef(r, n){
  const a = arcRef(r, n);
  return a === null ? null : a + 2 * r * 100;
}
/* 百分之一 → 字：先 toFixed(2)，再砍掉尾端的 0 與孤單的小數點（課程頁是拆整數位與百分位）。 */
function hTextRef(h){
  if (!(typeof h === 'number' && Number.isInteger(h) && h >= 0)) return '?';
  let s = (h / 100).toFixed(2);
  if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}
function plEnRef(n, w){
  if (String(n) === '1') return n + ' ' + w;
  return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');
}
const UNIT_WORD_REF = { zh:{ cm:'公分', sq:'平方公分', deg:'度' }, en:{ cm:'centimetre', sq:'square centimetre', deg:'degree' } };
function withUnitRef(lang, kind, t){
  if (kind === 'none') return String(t);
  if (!UNIT_WORD_REF[lang] || !UNIT_WORD_REF[lang][kind]) return '?';
  if (lang === 'zh') return t + ' ' + UNIT_WORD_REF.zh[kind];
  return plEnRef(String(t), UNIT_WORD_REF.en[kind]);
}

/* ---------- 2) 選項的解析：一個數 ＋ 一個單位，或一個分數。 ---------- */
/* ⚠️ 長的單位名要先比：`平方公分` 不先比的話會被 `公分` 咬掉，兩個不同的量就會被當成同一個值。 */
const UNIT_PATTERNS = [
  { u:'sq', zh:/^([\d.]+)\s*平方公分$/, en:/^([\d.]+)\s*square centimetres?$/ },
  { u:'cm', zh:/^([\d.]+)\s*公分$/, en:/^([\d.]+)\s*centimetres?$/ },
  { u:'deg', zh:/^([\d.]+)\s*度$/, en:/^([\d.]+)\s*degrees?$/ }
];
function parseOptRef(s, lang){
  const t = String(s).trim();
  const fm = /^(\d+)\/(\d+)$/.exec(t);
  if (fm) return { u:'fr', p:Number(fm[1]), q:Number(fm[2]), h:null };
  for (const p of UNIT_PATTERNS){
    const m = (lang === 'zh' ? p.zh : p.en).exec(t);
    if (m){
      const v = Number(m[1]);
      if (!isFinite(v)) return null;
      const h = Math.round(v * 100);
      if (Math.abs(v * 100 - h) > 1e-9) return null;
      return { u:p.u, h:h };
    }
  }
  return null;
}
/* 值的鍵：百分之一的值 ＋ 單位（分數另外一種）。 */
function optKeyRef(s, lang){
  const p = parseOptRef(s, lang);
  if (!p) return 'raw:' + String(s).trim();
  if (p.u === 'fr'){
    const g = gcdSubRef(p.p, p.q);
    return 'fr:' + (g === null ? p.p + '/' + p.q : (p.p / g) + '/' + (p.q / g));
  }
  return p.u + ':' + p.h;
}

/* ---------- 3) 真值表與句庫：複習頁那兩個句庫的第二份 ---------- */
const TRUE_STATEMENTS_REF = {
  arcRule:   { zh:'弧長 ＝ 圓周長 × 圓心角 ÷ 360', en:'Arc length ＝ circumference × angle ÷ 360' },
  areaRule:  { zh:'扇形面積 ＝ 圓面積 × 圓心角 ÷ 360', en:'Sector area ＝ circle area × angle ÷ 360' },
  perimRule: { zh:'扇形的周長 ＝ 弧長 ＋ 半徑 × 2', en:'Perimeter of a sector ＝ arc length ＋ radius × 2' },
  shareRule: { zh:'圓心角占 360 度的幾分之幾，扇形就占整個圓的幾分之幾', en:'The share the angle takes of 360 degrees is the share the sector takes of the circle' },
  sameFrac:  { zh:'同一個扇形，算弧長和算面積用的是同一個分數', en:'For one sector, the arc and the area use the same fraction' },
  halfDisc:  { zh:'半圓的周長是那一段弧再加上直徑', en:'A half circle’s perimeter is its arc plus the diameter' }
};
const FALSE_STATEMENTS_REF = {
  perimIsArc: { zh:'扇形的周長 ＝ 弧長', en:'Perimeter of a sector ＝ arc length' },
  flipped:    { zh:'扇形占整個圓的幾分之幾，要用 360 除以圓心角', en:'The share a sector takes of the circle is 360 divided by the angle' },
  arcUnitSq:  { zh:'弧長的單位是平方公分', en:'An arc length is measured in square centimetres' },
  halfPerim:  { zh:'半圓的周長是圓周長的一半', en:'A half circle’s perimeter is half the circumference' },
  diameterIn: { zh:'算扇形面積的時候，可以把直徑當成半徑代進「半徑 × 半徑 × 3.14」', en:'For a sector’s area, the diameter can be used as the radius in “radius × radius × 3.14”' },
  angleTimes: { zh:'圓心角變成 2 倍，扇形面積會變成 4 倍', en:'Doubling the angle makes the sector’s area 4 times as big' }
};
const FALSE_KEYS_REF = Object.keys(FALSE_STATEMENTS_REF);
function statementTruthOfText(text, lang){
  for (const k of Object.keys(TRUE_STATEMENTS_REF)) if (TRUE_STATEMENTS_REF[k][lang] === text) return true;
  for (const k of FALSE_KEYS_REF) if (FALSE_STATEMENTS_REF[k][lang] === text) return false;
  return null;
}
const ASKS_REF = {
  len: {
    fence:  { zh:'扇形花圃要沿著整圈邊緣圍一圈籬笆，籬笆要多長', en:'How long a fence goes right round the edge of a sector flower bed' },
    trim:   { zh:'扇形旗子要沿著整圈邊緣縫一條滾邊，滾邊要多長', en:'How long a trim is sewn right round the edge of a sector flag' },
    crustQ: { zh:'扇形披薩彎的那一段餅皮邊有多長', en:'How long the curved crust of a slice of pizza is' },
    tape:   { zh:'扇形窗戶彎的那一段邊要貼多長的膠條', en:'How long a strip of tape covers the curved edge of a sector window' }
  },
  area: {
    turf:   { zh:'扇形草地整片要鋪多少草皮', en:'How much turf covers the whole of a sector lawn' },
    paint:  { zh:'扇形招牌整面要塗多大一片油漆', en:'How large a patch of paint covers the whole face of a sector sign' },
    cloth:  { zh:'扇形桌巾整片要用多少布', en:'How much cloth a whole sector tablecloth takes' },
    cheeseQ:{ zh:'扇形披薩整片表面要鋪多大一片起司', en:'How large a patch of cheese covers the whole top of a slice of pizza' }
  }
};
function askKindOfText(text, lang){
  for (const side of ['len', 'area'])
    for (const k of Object.keys(ASKS_REF[side])) if (ASKS_REF[side][k][lang] === text) return side;
  return null;
}
/* 複習頁的應用題情境（第二份） */
const SCEN_REF = {
  zh: {
    fan:   { what:'扇形的扇子', ask:'只在<strong>彎的那一段邊</strong>縫一條緞帶，緞帶至少要多長？' },
    crust: { what:'扇形的披薩', ask:'<strong>彎的那一段餅皮邊</strong>有多長？' },
    window:{ what:'扇形的窗戶', ask:'只在<strong>彎的那一段邊</strong>貼一條膠條，膠條至少要多長？' },
    lawn:  { what:'扇形的草地', ask:'<strong>整片</strong>都要鋪滿草皮，需要多少草皮？' },
    cheese:{ what:'扇形的披薩', ask:'<strong>整片表面</strong>都要鋪滿起司，要鋪多大一片？' },
    sign:  { what:'扇形的招牌', ask:'<strong>整面</strong>都要塗上油漆，要塗多大一片？' }
  },
  en: {
    fan:   { what:'a fan', ask:'A ribbon is sewn along the <strong>curved edge only</strong>. How long does the ribbon have to be?' },
    crust: { what:'a slice of pizza', ask:'How long is the <strong>curved crust</strong>?' },
    window:{ what:'a window', ask:'A strip of tape is stuck along the <strong>curved edge only</strong>. How long does the tape have to be?' },
    lawn:  { what:'a patch of lawn', ask:'The <strong>whole patch</strong> is to be covered with turf. How much turf is needed?' },
    cheese:{ what:'a slice of pizza', ask:'The <strong>whole top</strong> is to be covered with cheese. How large a patch is that?' },
    sign:  { what:'a sign', ask:'The <strong>whole face</strong> is to be painted. How large a patch is that?' }
  }
};
const ARC_IDS_REF = ['fan', 'crust', 'window'];
const AREA_IDS_REF = ['lawn', 'cheese', 'sign'];

/* ---------- 4) 跨頁用詞釘樁 ----------
   ⚠️ min 一律寫成**當下真實的出現次數**（讀者看得到的文字：markup 拿掉 <script> ＋ 字典求值之後的字串）。
   ⚠️ **複習頁不在這張表裡**：它讀者看到的每一句話都是 fmt() 當場拼出來的，字典裡幾乎沒有靜態字串，
      所以用詞釘樁對它是空的；那一頁的用字由 simgen 的 renderCheck（整句題幹重建）逐批驗。 */
const SIBLING_RULES = [
  { file:'index',     text:'圓心角 ÷ 360', min:12, why:'is how this lesson works out the share' },
  { file:'reference', text:'圓心角 ÷ 360', min:17, why:'is how this lesson works out the share' },
  { file:'parents',   text:'圓心角 ÷ 360', min:4, why:'is how this lesson works out the share' },
  { file:'index',     text:'弧長 ＋ 半徑 × 2', min:3, why:'is the perimeter rule this lesson teaches' },
  { file:'reference', text:'弧長 ＋ 半徑 × 2', min:6, why:'is the perimeter rule this lesson teaches' },
  { file:'parents',   text:'弧長 ＋ 半徑 × 2', min:2, why:'is the perimeter rule this lesson teaches' },
  { file:'index',     text:'兩條半徑', min:46, why:'is the piece of the perimeter this lesson keeps pointing at' },
  { file:'reference', text:'兩條半徑', min:21, why:'is the piece of the perimeter this lesson keeps pointing at' },
  { file:'parents',   text:'兩條半徑', min:12, why:'is the piece of the perimeter this lesson keeps pointing at' },
  { file:'index',     text:'圓心角', min:63, why:'is the angle every formula in this lesson starts from' },
  { file:'reference', text:'圓心角', min:45, why:'is the angle every formula in this lesson starts from' },
  { file:'parents',   text:'圓心角', min:24, why:'is the angle every formula in this lesson starts from' },
  { file:'index',     text:'平方公分', min:21, why:'is the unit an area takes' },
  { file:'reference', text:'平方公分', min:8, why:'is the unit an area takes' },
  { file:'parents',   text:'平方公分', min:4, why:'is the unit an area takes' },
  { file:'index',     text:'angle ÷ 360', min:7, why:'is the English rule for the share' },
  { file:'reference', text:'angle ÷ 360', min:10, why:'is the English rule for the share' },
  { file:'parents',   text:'angle ÷ 360', min:2, why:'is the English rule for the share' },
  { file:'index',     text:'two radiuses', min:27, why:'is the English name for the pieces everybody forgets' },
  { file:'reference', text:'two radiuses', min:9, why:'is the English name for the pieces everybody forgets' },
  { file:'parents',   text:'two radiuses', min:4, why:'is the English name for the pieces everybody forgets' },
  { file:'index',     text:'square centimetre', min:17, why:'is the English unit an area takes' },
  { file:'reference', text:'square centimetre', min:6, why:'is the English unit an area takes' },
  { file:'parents',   text:'square centimetre', min:2, why:'is the English unit an area takes' },
];
/* 一個字都不可以出現：次方寫法；另一種圓周率近似值；把迷思當事實寫出來的短句。
   ⚠️ 速查卡的「很容易這樣想」那一欄本來就要把迷思寫出來，所以它不在這份清單裡。 */
const FORBIDDEN = [
  { file:'index',     text:'²', why:'writes a power — this lesson spells out “radius × radius”' },
  { file:'reference', text:'²', why:'writes a power — this lesson spells out “radius × radius”' },
  { file:'review',    text:'²', why:'writes a power — this lesson spells out “radius × radius”' },
  { file:'parents',   text:'²', why:'writes a power — this lesson spells out “radius × radius”' },
  { file:'index',     text:'22/7', why:'uses a second approximation of pi — this lesson only uses 3.14' },
  { file:'reference', text:'22/7', why:'uses a second approximation of pi — this lesson only uses 3.14' },
  { file:'review',    text:'22/7', why:'uses a second approximation of pi — this lesson only uses 3.14' },
  { file:'parents',   text:'22/7', why:'uses a second approximation of pi — this lesson only uses 3.14' },
  { file:'index',     text:'扇形的周長就是弧長', why:'states the misconception as a fact' },
  { file:'review',    text:'扇形的周長就是弧長', why:'states the misconception as a fact' },
  { file:'parents',   text:'扇形的周長就是弧長', why:'states the misconception as a fact' }
];
/* 交給別課的詞，出現時同一頁要說出它屬於哪一課或不在這一課。 */
const HANDOFF = [
  { word:'弓形', near:['不在這一課'], files:['index', 'reference', 'parents'] },
  { word:'圓柱', near:['不在這一課'], files:['index', 'reference', 'parents'] },
  { word:'複合圖形', near:['不在這一課'], files:['index', 'reference', 'parents'] },
  { word:'多邊形轉轉盤', near:['五年級'], files:['index', 'reference', 'review', 'parents'] },
  { word:'圓周率工作坊', near:['六年級'], files:['index', 'reference', 'parents'] },
  { word:'圓規畫圓趣', near:['三年級'], files:['index', 'reference', 'parents'] },
  { word:'角度測量站', near:['四年級'], files:['index', 'reference', 'parents'] }
];
/* ⚠️ 算式裡夾單位會讓求值器把算式切成兩半，剩下的半截被當成另一條宣稱。 */
const UNIT_WORDS_SRC = '公分|平方公分|度|cm|square centimetres?|centimetres?|degrees?';
/* ⚠️ 中文單位後面**沒有** \b（分、度都不是 word 字元），所以收尾要自己寫：
   行尾、空白、標點都算結束。只寫 \b 的話「6 × 公分」會整條溜過去。 */
const UNIT_IN_EQ = new RegExp('(?:' + UNIT_WORDS_SRC + ')\\s*[×÷]|[×÷]\\s*(?:' + UNIT_WORDS_SRC + ')(?=$|[\\s，。；：、）)．.,;:!?])');

/* ---------- 5) 題庫神諭：整句題幹（zh／en）＋ 四個選項原文 ＋ 正解原文 ---------- */
const BANK = {
  qs:[
    { zh:'一個扇形的<strong>圓心角</strong>是 <strong>90 度</strong>，它是整個圓的幾分之幾？',
      en:'A sector has an <strong>angle of 90 degrees</strong> at the centre. What share of the whole circle is it?',
      optsZh:['1/2', '1/9', '4', '1/4'],
      optsEn:['1/2', '1/9', '4', '1/4'],
      ansZh:'1/4', ansEn:'1/4' },
    { zh:'一個扇形的半徑是 <strong>6 公分</strong>、圓心角是 <strong>60 度</strong>，它的<strong>弧長</strong>是多少？',
      en:'A sector has a radius of <strong>6 centimetres</strong> and an angle of <strong>60 degrees</strong>. How long is its <strong>arc</strong>?',
      optsZh:['37.68 公分', '6.28 公分', '18.84 平方公分', '12 公分'],
      optsEn:['37.68 centimetres', '6.28 centimetres', '18.84 square centimetres', '12 centimetres'],
      ansZh:'6.28 公分', ansEn:'6.28 centimetres' },
    { zh:'一個扇形的半徑是 <strong>10 公分</strong>、圓心角是 <strong>180 度</strong>（半圓），它的<strong>面積</strong>是多少？',
      en:'A sector has a radius of <strong>10 centimetres</strong> and an angle of <strong>180 degrees</strong> (a half circle). What is its <strong>area</strong>?',
      optsZh:['314 平方公分', '31.4 公分', '157 平方公分', '62.8 公分'],
      optsEn:['314 square centimetres', '31.4 centimetres', '157 square centimetres', '62.8 centimetres'],
      ansZh:'157 平方公分', ansEn:'157 square centimetres' },
    { zh:'一個扇形的半徑是 <strong>6 公分</strong>、圓心角是 <strong>90 度</strong>，它的<strong>周長</strong>是多少？',
      en:'A sector has a radius of <strong>6 centimetres</strong> and an angle of <strong>90 degrees</strong>. What is its <strong>perimeter</strong>?',
      optsZh:['9.42 公分', '21.42 公分', '28.26 平方公分', '37.68 公分'],
      optsEn:['9.42 centimetres', '21.42 centimetres', '28.26 square centimetres', '37.68 centimetres'],
      ansZh:'21.42 公分', ansEn:'21.42 centimetres' },
    { zh:'一個扇形是整個圓的 <strong>1/6</strong>，它的<strong>圓心角</strong>是幾度？',
      en:'A sector is <strong>1/6</strong> of a whole circle. What is its <strong>angle at the centre</strong>?',
      optsZh:['6 度', '300 度', '36 度', '60 度'],
      optsEn:['6 degrees', '300 degrees', '36 degrees', '60 degrees'],
      ansZh:'60 度', ansEn:'60 degrees' },
    { zh:'一片扇形披薩的半徑是 <strong>12 公分</strong>、圓心角是 <strong>45 度</strong>。<strong>彎的那一段餅皮邊</strong>有多長？',
      en:'A slice of pizza is a sector with a radius of <strong>12 centimetres</strong> and an angle of <strong>45 degrees</strong>. How long is the <strong>curved crust</strong>?',
      optsZh:['9.42 公分', '75.36 公分', '56.52 平方公分', '24 公分'],
      optsEn:['9.42 centimetres', '75.36 centimetres', '56.52 square centimetres', '24 centimetres'],
      ansZh:'9.42 公分', ansEn:'9.42 centimetres' }
  ],
  qsAdv:[
    { zh:'一個扇形的半徑是 <strong>9 公分</strong>、圓心角是 <strong>120 度</strong>，它的<strong>面積</strong>是多少？',
      en:'A sector has a radius of <strong>9 centimetres</strong> and an angle of <strong>120 degrees</strong>. What is its <strong>area</strong>?',
      optsZh:['254.34 平方公分', '18.84 公分', '28.26 平方公分', '84.78 平方公分'],
      optsEn:['254.34 square centimetres', '18.84 centimetres', '28.26 square centimetres', '84.78 square centimetres'],
      ansZh:'84.78 平方公分', ansEn:'84.78 square centimetres' },
    { zh:'一個扇形的<strong>弧長</strong>剛好是整個圓周長的 <strong>1/8</strong>，它的<strong>圓心角</strong>是幾度？',
      en:'A sector’s <strong>arc</strong> is exactly <strong>1/8</strong> of the whole circumference. What is its <strong>angle at the centre</strong>?',
      optsZh:['8 度', '45 度', '60 度', '315 度'],
      optsEn:['8 degrees', '45 degrees', '60 degrees', '315 degrees'],
      ansZh:'45 度', ansEn:'45 degrees' },
    { zh:'一個<strong>半圓</strong>的半徑是 <strong>10 公分</strong>，沿著它的<strong>邊緣走一圈</strong>有多長？',
      en:'A <strong>half circle</strong> has a radius of <strong>10 centimetres</strong>. How far is it <strong>right round its edge</strong>?',
      optsZh:['31.4 公分', '62.8 公分', '51.4 公分', '157 平方公分'],
      optsEn:['31.4 centimetres', '62.8 centimetres', '51.4 centimetres', '157 square centimetres'],
      ansZh:'51.4 公分', ansEn:'51.4 centimetres' },
    { zh:'小安說：「扇形的周長就是那一段弧的長度。」下面哪一句話的<strong>結論和理由都對</strong>？',
      en:'Ann says: “A sector’s perimeter is just the length of its arc.” Which sentence has <strong>both the right conclusion and the right reason</strong>?',
      optsZh:['不對，扇形的邊緣還有兩條半徑，所以周長是弧長再加上半徑 × 2', '對，因為弧是扇形唯一的邊', '對，因為兩條半徑在扇形的裡面，不算邊', '不對，扇形的周長一律是弧長再加上直徑，不管圓心角是幾度'],
      optsEn:['No: the edge also has two radiuses, so the perimeter is the arc plus radius × 2', 'Yes: the arc is a sector’s only edge', 'Yes: the two radiuses are inside the sector, so they are not edges', 'No: a sector’s perimeter is always the arc plus the diameter, whatever the angle'],
      ansZh:'不對，扇形的邊緣還有兩條半徑，所以周長是弧長再加上半徑 × 2',
      ansEn:'No: the edge also has two radiuses, so the perimeter is the arc plus radius × 2' }
  ],
  qsBoost:[
    { zh:'小華算「<strong>半徑 6 公分、圓心角 90 度</strong>的扇形<strong>周長</strong>」，寫成「37.68 × 90 ÷ 360 ＝ 9.42 公分」。他哪裡想錯了？',
      en:'Ben works out the <strong>perimeter</strong> of a sector with a <strong>radius of 6 centimetres and an angle of 90 degrees</strong> as “37.68 × 90 ÷ 360 ＝ 9.42 centimetres”. What has he got wrong?',
      optsZh:['他沒有錯，扇形的周長就是那一段弧的長度', '他算出來的 9.42 只是<strong>弧長</strong>，還要加兩條半徑：9.42 ＋ 6 × 2 ＝ 21.42', '應該用面積公式：6 × 6 × 3.14 × 90 ÷ 360 ＝ 28.26', '應該再乘以 2：9.42 × 2 ＝ 18.84'],
      optsEn:['Nothing; a sector’s perimeter is the length of its arc', 'His 9.42 is only the <strong>arc</strong>; the two radiuses still have to be added: 9.42 ＋ 6 × 2 ＝ 21.42', 'He should use the area instead: 6 × 6 × 3.14 × 90 ÷ 360 ＝ 28.26', 'He should double it: 9.42 × 2 ＝ 18.84'],
      ansZh:'他算出來的 9.42 只是<strong>弧長</strong>，還要加兩條半徑：9.42 ＋ 6 × 2 ＝ 21.42',
      ansEn:'His 9.42 is only the <strong>arc</strong>; the two radiuses still have to be added: 9.42 ＋ 6 × 2 ＝ 21.42' },
    { zh:'小美說：「圓心角 60 度的扇形，是整個圓的 360 ÷ 60 ＝ 6 倍。」她哪裡想錯了？',
      en:'Mia says: “A sector with an angle of 60 degrees is 360 ÷ 60 ＝ 6 times the whole circle.” What has she got wrong?',
      optsZh:['她沒有錯，6 倍就是答案', '分數要寫成<strong>圓心角 ÷ 360</strong>：60 ÷ 360 約分之後是 1/6', '應該算 360 － 60 ＝ 300，所以是 300 倍', '應該用 60 × 360 ＝ 21600'],
      optsEn:['Nothing; 6 times is the answer', 'The share is <strong>angle ÷ 360</strong>: 60 ÷ 360 cancels down to 1/6', 'She should work out 360 － 60 ＝ 300, so it is 300 times', 'She should work out 60 × 360 ＝ 21600'],
      ansZh:'分數要寫成<strong>圓心角 ÷ 360</strong>：60 ÷ 360 約分之後是 1/6',
      ansEn:'The share is <strong>angle ÷ 360</strong>: 60 ÷ 360 cancels down to 1/6' }
  ]
};
/* 題庫裡的數字事實，各自獨立算一次。 */
const BANK_FACTS = [
  { arcOf:[6, 60], want:'6.28' }, { secAreaOf:[10, 180], want:'157' },
  { perimOf:[6, 90], want:'21.42' }, { arcOf:[6, 90], want:'9.42' },
  { arcOf:[12, 45], want:'9.42' }, { secAreaOf:[9, 120], want:'84.78' },
  { secAreaOf:[6, 90], want:'28.26' }, { perimOf:[10, 180], want:'51.4' },
  { circOf:6, want:'37.68' }, { circOf:12, want:'75.36' }, { circOf:10, want:'62.8' },
  { areaOf:10, want:'314' }, { areaOf:9, want:'254.34' }, { areaOf:12, want:'452.16' },
  { arcOf:[10, 180], want:'31.4' }, { secAreaOf:[12, 45], want:'56.52' }
];

const GEN_IDS = ['fracOfCircle', 'angleFromFrac', 'arcFromR', 'arcFromD', 'areaFromR', 'perimFromR',
                 'wordArc', 'wordArea', 'whichQuestion', 'trueStatement', 'interCircle', 'interAngle'];

/* plan → DOM 的接線。⚠️ 這是字面掃描，不是資料流分析：它只證明「畫圖那一行還在讀 plan」，
   證明不了 plan 之外沒有別的座標被畫上去。真的要證明得在 DOM 裡跑一次，這裡沒有。 */
const RENDER_PINS = [
  { file:'index', text:'drawPlan(s1fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s2fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s3fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s4fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(s5fig, pl,', min:1, max:1 },
  { file:'index', text:'drawPlan(gFig, fig,', min:1, max:1 },
  { file:'index', text:'var fig = roundFigure(round);', min:1 },
  { file:'index', text:'var ansAt = roundAnswerIndex(round);', min:1 },
  { file:'index', text:"else if (p.k === 'path') svg.appendChild(svgEl('path', { d:p.d, fill:p.fill, stroke:p.stroke, 'stroke-width':p.sw }));", min:1 },
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
  "var POOL_ANG = [30, 45, 60, 90, 120, 135, 180, 240, 270, 300];",
  "      if (r === 2) continue;",
  "        if (shown[hText(v)]) return;",
  "(function(){ for (var r = 3; r <= R_MAX; r++) POOL_R_WHOLE.push(r); })();",
  "if (!isFinite(v) || v < 1 || v > VAL_MAX || v !== Math.floor(v)) return;",
  "if (tokUnit(c) === 'deg' && (v % 100 !== 0 || v > FULL_DEG * 100)) return;",
  "(avoid || []).forEach(function(k){ seen[k] = 1; });",
  "var ARC_IDS = ['fan', 'crust', 'window'];",
  "var AREA_IDS = ['lawn', 'cheese', 'sign'];"
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
function visibleText(html){
  return readerText(html)
    .replace(/<\/?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|table|section|header|footer|nav)\b[^>]*>/gi, ' ')
    .replace(/<\/?span\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
/* 把一頁的 I18N 字典求值出來（字串才是讀者看得到的字；函式的輸出由題庫與產生器那兩段驗）。 */
function i18nOf(raw){
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
/* ⚠️ `btn` 是語言切換鈕上的字：英文字典裡本來就是「中」（全站慣例）。 */
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
  const shown = t.replace(/<(?:br|p|div|li|span class="cond")[^>]*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (lang === 'zh' && /\p{Script=Han}\d|\d\p{Script=Han}/u.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:\p{Script=Han}\d|\d\p{Script=Han}).{0,6}/u) || [''])[0]);
  /* ⚠️ `\b1` 會咬到 `12.1 centimetres` 的那個 1（小數點也是詞界），那是假警報。
     前面是數字或小數點的一律不算。 */
  if (lang === 'en' && /(?<![\d.])1 (centimetres|square centimetres|degrees|radiuses|slices|parts)\b/.test(shown)) out.push(where + ' has a singular/plural slip: ' + shown.match(/(?<![\d.])1 [a-z ]+s\b/)[0]);
  if (lang === 'en' && /\p{Script=Han}/u.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  if (UNIT_IN_EQ.test(shown)) out.push(where + ' puts a unit inside an equation: ' + (shown.match(/.{0,14}(?:公分|平方公分|度|cm)\s*[×÷].{0,10}|.{0,10}[×÷]\s*(?:公分|平方公分|度|cm).{0,14}/) || [''])[0]);
  return out;
}

/* ---------- 6b) 算式逐條驗算：全站共用的小數求值器（lib/decarith.js） ---------- */
const { decArith, seen: DEC_SEEN } = require('./lib/decarith.js')();

/* 驗算器自己的 PROBE：bad:false 必須零誤報、bad:true 一定要抓到。 */
const CLAIM_PROBES = [
  { text:'6 × 2 × 3.14 ＝ 37.68', bad:false },
  { text:'37.68 × 90 ÷ 360 ＝ 9.42', bad:false },
  { text:'113.04 × 90 ÷ 360 ＝ 28.26', bad:false },
  { text:'9.42 ＋ 6 × 2 ＝ 21.42', bad:false },
  { text:'90 ÷ 90 ＝ 1，360 ÷ 90 ＝ 4', bad:false },
  { text:'360 ÷ 6 ＝ 60', bad:false },
  { text:'360 － 60 ＝ 300', bad:false },
  { text:'16 ÷ 2 ＝ 8', bad:false },
  { text:'The arc is 62.8 × 180 ÷ 360 = 31.4 centimetres.', bad:false },
  { text:'弧長 ＝ 圓周長 × 圓心角 ÷ 360', bad:false },
  { text:'扇形的周長 ＝ 弧長 ＋ 半徑 × 2', bad:false },
  { text:'扇形占整個圓的幾分之幾，要用 360 除以圓心角', bad:false },
  { text:'（37.68 × 90 ÷ 360 ＝ 9.42）', bad:false },
  { text:'連結最後檢查：2026-09-22', bad:false },
  { text:'(2 × 3) × 3.14 ＝ 18.84', bad:false },
  { text:'(3 + 6) ＝ 9', bad:false },
  { text:'□ × 3.14 ＝ 31.4', bad:false },
  { text:'半徑 ＝ 直徑 ÷ 2', bad:false },
  /* 這一課的算式一定要能被讀到，讀不到就是靜靜放行 */
  { text:'37.68 × 90 ÷ 360 ＝ 9.43', bad:true },
  { text:'113.04 × 90 ÷ 360 ＝ 28.25', bad:true },
  { text:'9.42 ＋ 6 × 2 ＝ 21.4', bad:true },
  { text:'6 × 2 × 3.14 ＝ 37.7', bad:true },
  { text:'360 ÷ 6 ＝ 50', bad:true },
  { text:'360 － 60 ＝ 310', bad:true },
  { text:'The arc is 62.8 × 180 ÷ 360 = 31.5 centimetres.', bad:true },
  { text:'弧長 ＝ 9.42', bad:true },
  { text:'弧長 ＝ (9.42)', bad:true },
  { text:'１２ × 2 × 3.14 ＝ 75.4', bad:true },
  { text:'37.68 × × 90 ＝ 9.42', bad:true },
  { text:'37.68 × ＋ 90 ＝ 9.42', bad:true },
  { text:'5 ÷ 0 ＝ 5', bad:true },
  { text:'□ × 3.14 ＝ 31.4 ＝ 99', bad:true },
  { text:'24 ÷ 2 ＝ 12，12 × 12 × 3.14 ＝ 452.16，所以 3 × 3 ＝ 10', bad:true }
];

/* ---------- 6c) lib/canvas.js 的 <path> 支援：這一課是第一個用到的，所以每一次都重驗 ----------
   ⚠️ 兩個方向都要釘：畫得下的要乾淨，畫出界（含**弧在中間凸出去**）的一定要抓到，
      讀不懂的形狀（相對座標、貝茲、橢圓弧）要回報而不是默默放行。 */
function probeWedgeD(cx, cy, r, fromDeg, toDeg){
  const rad = d => d * Math.PI / 180;
  const x1 = Math.round((cx + r * Math.cos(rad(fromDeg))) * 10) / 10, y1 = Math.round((cy - r * Math.sin(rad(fromDeg))) * 10) / 10;
  const x2 = Math.round((cx + r * Math.cos(rad(toDeg))) * 10) / 10, y2 = Math.round((cy - r * Math.sin(rad(toDeg))) * 10) / 10;
  return 'M ' + cx + ' ' + cy + ' L ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + ((toDeg - fromDeg) > 180 ? 1 : 0) + ' 0 ' + x2 + ' ' + y2 + ' Z';
}
function probeSvg(d, w, h, sw){
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"><path d="' + d + '" fill="#eee" stroke="#000" stroke-width="' + (sw || 0) + '"/></svg>';
}
const PATH_PROBES = [
  { name:'a quarter wedge inside the canvas', svg:probeSvg(probeWedgeD(110, 100, 72, 0, 90), 460, 200, 3), bad:false },
  { name:'a three-quarter wedge inside the canvas', svg:probeSvg(probeWedgeD(110, 100, 72, 0, 270), 460, 200, 3), bad:false },
  { name:'a quarter wedge on a canvas too narrow for it', svg:probeSvg(probeWedgeD(110, 100, 72, 0, 90), 180, 200, 3), bad:true },
  { name:'a three-quarter wedge whose southern bulge leaves a short canvas', svg:probeSvg(probeWedgeD(110, 100, 72, 0, 270), 460, 160, 3), bad:true },
  { name:'a half-circle wedge bulging past the top edge', svg:probeSvg(probeWedgeD(110, 30, 72, 0, 180), 460, 200, 3), bad:true },
  { name:'a path drawn with relative commands', svg:probeSvg('M 10 10 l 20 0 Z', 460, 200, 1), bad:true },
  { name:'a path drawn with a cubic curve', svg:probeSvg('M 10 10 C 20 20 30 30 40 40', 460, 200, 1), bad:true },
  { name:'an elliptical arc', svg:probeSvg('M 10 10 A 20 30 0 0 1 50 10', 460, 200, 1), bad:true },
  /* ⚠️ 半徑太小裝不下兩個端點時，SVG 規定**把半徑放大**，瀏覽器就是那樣畫的 ——
     所以照放大之後的弧去框：這一條會凸出上緣（要抓到），下一條放大之後還在畫布裡（要乾淨）。 */
  { name:'an arc whose too-small radius is enlarged per spec and then leaves the canvas', svg:probeSvg('M 10 10 A 5 5 0 0 1 200 10', 460, 200, 1), bad:true },
  { name:'an arc whose too-small radius is enlarged per spec and still fits', svg:probeSvg('M 100 100 A 10 10 0 0 1 200 100', 460, 200, 1), bad:false },
  { name:'an arc with a zero radius', svg:probeSvg('M 10 10 A 0 0 0 0 1 50 10', 460, 200, 1), bad:true },
  { name:'a path whose style= changes its geometry', svg:'<svg viewBox="0 0 460 200" width="460" height="200"><path d="M 10 10 L 20 20" style="stroke-width:40"/></svg>', bad:true },
  { name:'a path whose style= is presentation only', svg:'<svg viewBox="0 0 460 200" width="460" height="200"><path d="M 10 10 L 20 20" style="fill:red"/></svg>', bad:false },
  { name:'a path carrying class=', svg:'<svg viewBox="0 0 460 200" width="460" height="200"><path d="M 10 10 L 20 20" class="wedge"/></svg>', bad:true },
  { name:'a mitred join with a raised stroke-miterlimit', svg:'<svg viewBox="0 12 460 188" width="460" height="188"><path d="M 10 100 L 30 20 L 50 100" fill="none" stroke="#000" stroke-width="10" stroke-miterlimit="10"/></svg>', bad:true },
  { name:'a round join needs no miter padding', svg:'<svg viewBox="0 5 460 195" width="460" height="195"><path d="M 10 100 L 30 20 L 50 100" fill="none" stroke="#000" stroke-width="10" stroke-linejoin="round"/></svg>', bad:false },
  { name:'a path carrying a marker', svg:'<svg viewBox="0 0 460 200" width="460" height="200"><path d="M 10 10 L 20 20" marker-end="url(#m)"/></svg>', bad:true },
  /* ⚠️ 折點（miter）伸得比半個線寬遠：只墊 halfStroke 的話這一條會漏掉。 */
  { name:'a mitred join reaching past the top edge', svg:'<svg viewBox="0 5 460 195" width="460" height="195"><path d="M 10 100 L 30 20 L 50 100" fill="none" stroke="#000" stroke-width="10"/></svg>', bad:true },
  { name:'a path with no readable d', svg:'<svg viewBox="0 0 100 100" width="100" height="100"><path fill="#000"/></svg>', bad:true }
];

/* ---------- 7) 從畫出來的圖量回來：兩種圖的座標各重算一次 ---------- */
function r1Ref(v){ return Math.round(v * 10) / 10; }
function ptOnRef(cx, cy, rp, deg){
  const t = deg * Math.PI / 180;
  return { x:r1Ref(cx + rp * Math.cos(t)), y:r1Ref(cy - rp * Math.sin(t)) };
}
function wedgeDRef(cx, cy, rp, n){
  const a = ptOnRef(cx, cy, rp, 0), b = ptOnRef(cx, cy, rp, n);
  return 'M ' + cx + ' ' + cy + ' L ' + a.x + ' ' + a.y +
         ' A ' + rp + ' ' + rp + ' 0 ' + (n > 180 ? 1 : 0) + ' 0 ' + b.x + ' ' + b.y + ' Z';
}
function arcDRef(cx, cy, rp, n){
  const a = ptOnRef(cx, cy, rp, 0), b = ptOnRef(cx, cy, rp, n);
  return 'M ' + a.x + ' ' + a.y +
         ' A ' + rp + ' ' + rp + ' 0 ' + (n > 180 ? 1 : 0) + ' 0 ' + b.x + ' ' + b.y;
}
function normPrim(p){
  if (!p || typeof p !== 'object') return 'BAD';
  if (p.k === 'circle') return ['circle', p.cx, p.cy, p.r, p.fill, p.stroke, p.sw].join(' ');
  if (p.k === 'rect') return ['rect', p.x, p.y, p.w, p.h, p.fill, p.stroke, p.sw].join(' ');
  if (p.k === 'line') return ['line', p.x1, p.y1, p.x2, p.y2, p.stroke, p.sw].join(' ');
  if (p.k === 'path') return ['path', p.d, p.fill, p.stroke, p.sw].join(' ');
  return 'BAD:' + p.k;
}
function refSectorPrims(r, n, mark, cx){
  const cxx = (cx === undefined) ? CX_SOLO_REF : cx;
  if (!okRRef(r) || !okAngRef(n) || MARKS_REF.indexOf(mark) < 0) return null;
  if (cxx !== CX_SOLO_REF && cxx !== CX_REF) return null;
  const rp = r * SC_REF, out = [];
  const a = ptOnRef(cxx, CY_REF, rp, 0), b = ptOnRef(cxx, CY_REF, rp, n);
  const hot = (mark === 'perim');
  out.push(['path', wedgeDRef(cxx, CY_REF, rp, n), mark === 'fill' ? C_FILL_REF : C_WEDGE_REF, 'none', 0].join(' '));
  out.push(['circle', cxx, CY_REF, rp, 'none', C_CIRC_REF, STROKE_REF].join(' '));
  if (mark === 'arc' || mark === 'perim') out.push(['path', arcDRef(cxx, CY_REF, rp, n), 'none', C_HI_REF, HI_STROKE_REF].join(' '));
  out.push(['line', cxx, CY_REF, a.x, a.y, hot ? C_HI_REF : C_LINE_REF, hot ? HI_STROKE_REF : STROKE_REF].join(' '));
  out.push(['line', cxx, CY_REF, b.x, b.y, hot ? C_HI_REF : C_LINE_REF, hot ? HI_STROKE_REF : STROKE_REF].join(' '));
  out.push(['circle', cxx, CY_REF, DOT_R_REF, C_LINE_REF, 'none', 0].join(' '));
  return out;
}
function refFractionPrims(r, n){
  if (!okRRef(r) || !okAngRef(n)) return null;
  const f = fracRef(n);
  if (f === null || BAR_QS_REF.indexOf(f.q) < 0) return null;
  const base = refSectorPrims(r, n, 'fill', CX_REF);
  if (base === null) return null;
  const out = base.slice(), cell = BAR_W_REF / f.q;
  for (let i = 0; i < f.q; i++){
    out.push(['rect', BAR_X0_REF + i * cell, BAR_Y_REF, cell, BAR_H_REF, i < f.p ? C_FILL_REF : C_CELL_REF, C_CIRC_REF, 2].join(' '));
  }
  return out;
}
/* 把 plan 印成 SVG（帶最長的標籤）餵 lib/canvas.js 驗四個邊。 */
function svgOfPlan(pl, labelA, labelB){
  const parts = pl.prims.map(p => {
    if (p.k === 'circle') return '<circle cx="' + p.cx + '" cy="' + p.cy + '" r="' + p.r + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'rect') return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'path') return '<path d="' + p.d + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    return '<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
  });
  pl.labels.forEach(l => parts.push('<text x="' + l.x + '" y="' + l.y + '" font-size="' + LABEL_FS_REF + '" text-anchor="start">' + (l.slot === 'a' ? labelA : labelB) + '</text>'));
  return '<svg viewBox="0 0 ' + pl.w + ' ' + pl.h + '" width="' + pl.w + '" height="' + pl.h + '">' + parts.join('') + '</svg>';
}
/* ⚠️ 只比座標字串是不夠的：flag 寫反、半徑畫錯長度、夾角不是圓心角，都可能座標「照著公式算」卻畫錯。
   這一段用**幾何量**再驗一次：兩條半徑的長度、夾角、弧的兩個 flag。 */
function geometryProblems(tag, pl, r, n, cx){
  const out = [];
  const cxx = (cx === undefined) ? CX_SOLO_REF : cx;
  const rp = r * SC_REF;
  const lines = (pl.prims || []).filter(p => p.k === 'line');
  if (lines.length !== 2){ out.push(tag + ': ' + lines.length + ' straight edges drawn, a sector has exactly 2'); return out; }
  const angs = [];
  lines.forEach((ln, i) => {
    if (ln.x1 !== cxx || ln.y1 !== CY_REF) out.push(tag + ': radius ' + i + ' does not start at the centre');
    const dx = ln.x2 - cxx, dy = CY_REF - ln.y2;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(len - rp) > 0.15) out.push(tag + ': radius ' + i + ' is ' + len.toFixed(2) + 'px long, the radius is ' + rp);
    let a = Math.atan2(dy, dx) * 180 / Math.PI;
    if (a < -0.0001) a += 360;
    angs.push(a);
  });
  if (angs.length === 2){
    /* 真正的幾何宣稱：兩條半徑的**夾角**（從第一條逆時針量到第二條）就是圓心角。 */
    let span = angs[1] - angs[0];
    while (span < -0.0001) span += 360;
    while (span >= 359.9999) span -= 360;
    if (Math.abs(span - n) > 0.3) out.push(tag + ': the two radiuses are ' + span.toFixed(2) + '° apart, the angle at the centre is ' + n + '°');
    /* 版面釘樁（不是幾何宣稱）：這一課每一張圖都從正右方（0°）開始畫。 */
    if (Math.abs(angs[0]) > 0.3) out.push(tag + ': the first radius is at ' + angs[0].toFixed(2) + '°, but every figure in this lesson starts at 0°');
  }
  const paths = (pl.prims || []).filter(p => p.k === 'path');
  if (!paths.length) out.push(tag + ': no wedge path drawn');
  paths.forEach(p => {
    const m = /A\s+([\d.]+)\s+([\d.]+)\s+0\s+([01])\s+([01])\s/.exec(String(p.d));
    if (!m){ out.push(tag + ': a path has no readable arc: ' + p.d); return; }
    if (Number(m[1]) !== rp || Number(m[2]) !== rp) out.push(tag + ': an arc is drawn with radius ' + m[1] + '/' + m[2] + ', expected ' + rp);
    /* ⚠️ 剛好 180 度的時候兩個 flag 畫出來是同一段弧，所以那一個角度兩種都放行；
       其他角度 flag 反了就會畫成另外那一半（座標卻完全正確，只比座標看不出來）。 */
    const wantLarge = n > 180 ? 1 : 0;
    if (n !== 180 && Number(m[3]) !== wantLarge) out.push(tag + ': an arc has large-arc-flag ' + m[3] + ' but the angle ' + n + '° needs ' + wantLarge + ' — the browser would draw the other side');
    if (Number(m[4]) !== 0) out.push(tag + ': an arc has sweep-flag ' + m[4] + ', but this lesson draws anticlockwise (0)');
  });
  return out;
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
/* 分格長條自己的檢查：格數、每一格的寬、塗色的格數與位置。 */
function barProblems(tag, pl, n){
  const out = [];
  const f = fracRef(n);
  const rects = (pl.prims || []).filter(p => p.k === 'rect');
  if (f === null){ out.push(tag + ': the reference cannot work out the fraction'); return out; }
  if (rects.length !== f.q){ out.push(tag + ': the strip has ' + rects.length + ' cells, the fraction says ' + f.q); return out; }
  const cell = BAR_W_REF / f.q;
  let filled = 0;
  rects.forEach((rc, i) => {
    if (rc.w !== cell) out.push(tag + ': cell ' + i + ' is ' + rc.w + 'px wide, ' + BAR_W_REF + ' ÷ ' + f.q + ' is ' + cell);
    if (rc.x !== BAR_X0_REF + i * cell) out.push(tag + ': cell ' + i + ' starts at x=' + rc.x + ', the cells should sit side by side from ' + BAR_X0_REF);
    if (rc.h !== BAR_H_REF || rc.y !== BAR_Y_REF) out.push(tag + ': cell ' + i + ' is not at the strip height');
    if (rc.fill === C_FILL_REF) filled++;
    else if (rc.fill !== C_CELL_REF) out.push(tag + ': cell ' + i + ' has an unexpected fill ' + rc.fill);
    /* ⚠️ 塗色的必須是**最前面**那幾格，不然圖上看起來是兩塊分開的 */
    const wantFill = i < f.p ? C_FILL_REF : C_CELL_REF;
    if (rc.fill !== wantFill) out.push(tag + ': cell ' + i + ' should be ' + (i < f.p ? 'coloured' : 'blank'));
  });
  if (filled !== f.p) out.push(tag + ': ' + filled + ' cells are coloured, the fraction says ' + f.p);
  return out;
}

/* ---------- 8) 整句題幹重建：每一支產生器、每一種語言各一份。多一個字少一個字都對不上。 ---------- */
function stemRef(genId, d, lang){
  const zh = lang === 'zh';
  switch (genId){
    case 'fracOfCircle':
      return zh ? '一個扇形的<strong>圓心角</strong>是 <strong>' + d.n + ' 度</strong>，它是整個圓的幾分之幾？'
                : 'A sector has an <strong>angle of ' + d.n + ' degrees</strong> at the centre. What share of the whole circle is it?';
    case 'angleFromFrac':
      return zh ? '一個扇形是整個圓的 <strong>' + d.p + '/' + d.q + '</strong>，它的<strong>圓心角</strong>是幾度？'
                : 'A sector is <strong>' + d.p + '/' + d.q + '</strong> of a whole circle. What is its <strong>angle at the centre</strong>?';
    case 'arcFromR':
      return zh ? '一個扇形的半徑是 <strong>' + d.r + ' 公分</strong>、圓心角是 <strong>' + d.n + ' 度</strong>，它的<strong>弧長</strong>是多少？'
                : 'A sector has a radius of <strong>' + plEnRef(d.r, 'centimetre') + '</strong> and an angle of <strong>' + d.n + ' degrees</strong>. How long is its <strong>arc</strong>?';
    case 'arcFromD':
      return zh ? '一個扇形所在的圓，<strong>直徑</strong>是 <strong>' + (2 * d.r) + ' 公分</strong>；這個扇形的圓心角是 <strong>' + d.n + ' 度</strong>，它的<strong>弧長</strong>是多少？'
                : 'The circle a sector is cut from has a <strong>diameter</strong> of <strong>' + plEnRef(2 * d.r, 'centimetre') + '</strong>, and the sector’s angle at the centre is <strong>' + d.n + ' degrees</strong>. How long is its <strong>arc</strong>?';
    case 'areaFromR':
      return zh ? '一個扇形的半徑是 <strong>' + d.r + ' 公分</strong>、圓心角是 <strong>' + d.n + ' 度</strong>，它的<strong>面積</strong>是多少？'
                : 'A sector has a radius of <strong>' + plEnRef(d.r, 'centimetre') + '</strong> and an angle of <strong>' + d.n + ' degrees</strong>. What is its <strong>area</strong>?';
    case 'perimFromR':
      return zh ? '一個扇形的半徑是 <strong>' + d.r + ' 公分</strong>、圓心角是 <strong>' + d.n + ' 度</strong>，沿著它的<strong>整圈邊緣</strong>走一圈有多長？'
                : 'A sector has a radius of <strong>' + plEnRef(d.r, 'centimetre') + '</strong> and an angle of <strong>' + d.n + ' degrees</strong>. How far is it <strong>right round its edge</strong>?';
    case 'wordArc':
    case 'wordArea': {
      const s = SCEN_REF[lang][d.id];
      if (!s) return null;
      return zh ? '一個' + s.what + '，半徑是 <strong>' + d.r + ' 公分</strong>、圓心角是 <strong>' + d.n + ' 度</strong>。' + s.ask
                : 'There is ' + s.what + ' with a radius of <strong>' + plEnRef(d.r, 'centimetre') + '</strong> and an angle of <strong>' + d.n + ' degrees</strong> at the centre. ' + s.ask;
    }
    case 'whichQuestion':
      return zh ? '下面四個問題，<strong>只有一個要算面積</strong>。是哪一個？' : 'Of these four questions, <strong>exactly one wants an area</strong>. Which?';
    case 'trueStatement':
      return zh ? '下面四句話，<strong>只有一句是對的</strong>。是哪一句？' : 'Of these four sentences, <strong>exactly one is true</strong>. Which?';
    case 'interCircle':
      if (d.wantArea) return zh ? '（六年級）一個<strong>整圓</strong>的半徑是 <strong>' + d.r + ' 公分</strong>，它的<strong>面積</strong>是多少？'
                                : '(Grade six) A <strong>whole circle</strong> has a radius of <strong>' + plEnRef(d.r, 'centimetre') + '</strong>. What is its <strong>area</strong>?';
      return zh ? '（六年級）一個<strong>整圓</strong>的半徑是 <strong>' + d.r + ' 公分</strong>，它的<strong>圓周長</strong>是多少？'
                : '(Grade six) A <strong>whole circle</strong> has a radius of <strong>' + plEnRef(d.r, 'centimetre') + '</strong>. What is its <strong>circumference</strong>?';
    case 'interAngle':
      return zh ? '（四年級）一塊圓形蛋糕切走一片，切走的那一片<strong>圓心角</strong>是 <strong>' + d.n + ' 度</strong>。<strong>剩下</strong>的那一片圓心角是幾度？'
                : '(Grade four) One slice is cut from a round cake, and that slice’s <strong>angle at the centre</strong> is <strong>' + d.n + ' degrees</strong>. What is the angle of the piece <strong>left over</strong>?';
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
/* 產生器內部的編碼 `百分之一|單位` 或 `p/q|fr`：值與單位都要合法、兩兩不同 */
function tokProblems(id, opts){
  const seen = new Set();
  for (const o of opts){
    const s = String(o);
    const fm = /^(\d+)\/(\d+)\|fr$/.exec(s);
    if (fm){
      const p = Number(fm[1]), q = Number(fm[2]);
      if (!(p >= 1 && q >= 2 && p < q)) return id + ': fraction token "' + s + '" is not a proper fraction';
      if (gcdSubRef(p, q) !== 1) return id + ': fraction token "' + s + '" is not in its lowest terms';
      if (seen.has(s)) return id + ': two option tokens are the same value: ' + s;
      seen.add(s);
      continue;
    }
    const m = /^(\d+)\|(cm|sq|deg)$/.exec(s);
    if (!m) return id + ': option token "' + s + '" is not <hundredths>|<cm|sq|deg> nor <p/q>|fr';
    const h = Number(m[1]);
    if (!(h >= 1 && h <= 200000)) return id + ': option token "' + s + '" leaves 1..200000';
    if (m[2] === 'deg' && (h % 100 !== 0 || h > FULL_DEG_REF * 100)) return id + ': degree token "' + s + '" is not a whole number of degrees in 1..360';
    if (seen.has(s)) return id + ': two option tokens are the same value: ' + s;
    seen.add(s);
  }
  return null;
}
/* 抄題幹：誘答（不含正解）的**數值**不可以等於題幹印出來的任何一個數。
   allow 是刻意放行的那一個值（百分之一）。 */
function echoProblems(id, d, stemNums, allow){
  const want = stemNums.map(v => Math.round(v * 100));
  const bad = d.opts.filter((o, i) => {
    if (i === d.ans) return false;
    const m = /^(\d+)\|/.exec(String(o));
    if (!m) return false;
    const h = Number(m[1]);
    if (allow !== undefined && h === allow) return false;
    return want.indexOf(h) >= 0;
  });
  return bad.length ? id + ': distractor "' + bad[0] + '" copies a number the stem prints' : null;
}
/* (半徑, 圓心角) 這一對可不可以出題 */
function pairOk(id, d){
  if (!okRRef(d.r)) return id + ': r=' + d.r + ' is outside 1..' + R_MAX_REF;
  if (!okAngRef(d.n)) return id + ': the angle ' + d.n + ' is not one of this lesson’s ten';
  if (arcRef(d.r, d.n) === null) return id + ': the arc does not divide exactly for r=' + d.r + ', n=' + d.n;
  if (secAreaRef(d.r, d.n) === null) return id + ': the area does not divide exactly for r=' + d.r + ', n=' + d.n;
  return null;
}

module.exports = {
  /* ================= 產生器模擬（tools/simgen.js） ================= */
  sim: {
    INVARIANTS: {
      fracOfCircle: d => {
        if (!okAngRef(d.n)) return 'fracOfCircle: the angle ' + d.n + ' is not one of this lesson’s ten';
        const f = fourDistinct('fracOfCircle', d); if (f) return f;
        const t = tokProblems('fracOfCircle', d.opts); if (t) return t;
        const fr = fracRef(d.n);
        if (String(d.opts[d.ans]) !== fr.p + '/' + fr.q + '|fr') return 'fracOfCircle: opts[ans]=' + d.opts[d.ans] + ' is not ' + fr.p + '/' + fr.q + '|fr';
        /* 每一個誘答都要是**別的圓心角**的分數，不是隨手編的分數 */
        const known = ANGLES_REF.map(a => { const x = fracRef(a); return x.p + '/' + x.q + '|fr'; });
        for (const o of d.opts) if (known.indexOf(String(o)) < 0) return 'fracOfCircle: option ' + o + ' is not the share of any angle this lesson uses';
      },
      angleFromFrac: d => {
        if (!okAngRef(d.n)) return 'angleFromFrac: the angle ' + d.n + ' is not one of this lesson’s ten';
        const fr = fracRef(d.n);
        if (d.p !== fr.p || d.q !== fr.q) return 'angleFromFrac: the printed fraction ' + d.p + '/' + d.q + ' is not ' + fr.p + '/' + fr.q;
        const f = fourDistinct('angleFromFrac', d); if (f) return f;
        const t = tokProblems('angleFromFrac', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== d.n * 100 + '|deg') return 'angleFromFrac: opts[ans]=' + d.opts[d.ans] + ' is not ' + (d.n * 100) + '|deg';
        if (FULL_DEG_REF * fr.p / fr.q !== d.n) return 'angleFromFrac: 360 × ' + fr.p + ' ÷ ' + fr.q + ' is not ' + d.n;
        /* 分母當成角度是**刻意的**迷思誘答，所以它是唯一放行的「抄題幹」值 */
        if (d.opts.indexOf(d.q * 100 + '|deg') < 0) return 'angleFromFrac: the "read the bottom of the fraction as the angle" distractor is missing';
        const e = echoProblems('angleFromFrac', d, [d.p, d.q], d.q * 100); if (e) return e;
      },
      arcFromR: d => {
        const p = pairOk('arcFromR', d); if (p) return p;
        const f = fourDistinct('arcFromR', d); if (f) return f;
        const t = tokProblems('arcFromR', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== arcRef(d.r, d.n) + '|cm') return 'arcFromR: opts[ans]=' + d.opts[d.ans] + ' is not ' + arcRef(d.r, d.n) + '|cm';
        const e = echoProblems('arcFromR', d, [d.r, d.n]); if (e) return e;
        /* 這一課最重要的誘答：整圓的周長 */
        if (d.opts.indexOf(circRef(d.r) + '|cm') < 0) return 'arcFromR: the "whole circumference" distractor is missing';
      },
      arcFromD: d => {
        const p = pairOk('arcFromD', d); if (p) return p;
        const f = fourDistinct('arcFromD', d); if (f) return f;
        const t = tokProblems('arcFromD', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== arcRef(d.r, d.n) + '|cm') return 'arcFromD: opts[ans]=' + d.opts[d.ans] + ' is not ' + arcRef(d.r, d.n) + '|cm';
        if (!okDRef(2 * d.r)) return 'arcFromD: the printed diameter ' + (2 * d.r) + ' is not an even value whose half is a usable radius';
        const e = echoProblems('arcFromD', d, [2 * d.r, d.n]); if (e) return e;
        /* 把直徑當半徑：弧長剛好 2 倍 */
        if (d.opts.indexOf(2 * arcRef(d.r, d.n) + '|cm') < 0) return 'arcFromD: the "used the diameter as the radius" distractor is missing';
      },
      areaFromR: d => {
        const p = pairOk('areaFromR', d); if (p) return p;
        const f = fourDistinct('areaFromR', d); if (f) return f;
        const t = tokProblems('areaFromR', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== secAreaRef(d.r, d.n) + '|sq') return 'areaFromR: opts[ans]=' + d.opts[d.ans] + ' is not ' + secAreaRef(d.r, d.n) + '|sq';
        const e = echoProblems('areaFromR', d, [d.r, d.n]); if (e) return e;
        if (d.opts.indexOf(areaRef(d.r) + '|sq') < 0) return 'areaFromR: the "whole circle’s area" distractor is missing';
      },
      perimFromR: d => {
        const p = pairOk('perimFromR', d); if (p) return p;
        const f = fourDistinct('perimFromR', d); if (f) return f;
        const t = tokProblems('perimFromR', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== perimRef(d.r, d.n) + '|cm') return 'perimFromR: opts[ans]=' + d.opts[d.ans] + ' is not ' + perimRef(d.r, d.n) + '|cm';
        if (perimRef(d.r, d.n) !== arcRef(d.r, d.n) + 2 * d.r * 100) return 'perimFromR: the perimeter is not the arc plus two radiuses';
        const e = echoProblems('perimFromR', d, [d.r, d.n]); if (e) return e;
        /* 整課最重要的迷思誘答：只算弧長 */
        if (d.opts.indexOf(arcRef(d.r, d.n) + '|cm') < 0) return 'perimFromR: the "arc only, radiuses forgotten" distractor is missing';
      },
      wordArc: d => {
        const p = pairOk('wordArc', d); if (p) return p;
        if (ARC_IDS_REF.indexOf(d.id) < 0) return 'wordArc: scenario "' + d.id + '" is not one that travels the curved edge only';
        const f = fourDistinct('wordArc', d); if (f) return f;
        const t = tokProblems('wordArc', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== arcRef(d.r, d.n) + '|cm') return 'wordArc: opts[ans]=' + d.opts[d.ans] + ' is not ' + arcRef(d.r, d.n) + '|cm';
        const e = echoProblems('wordArc', d, [d.r, d.n]); if (e) return e;
        if (d.opts.indexOf(perimRef(d.r, d.n) + '|cm') < 0) return 'wordArc: the "counted the two radiuses as well" distractor is missing';
      },
      wordArea: d => {
        const p = pairOk('wordArea', d); if (p) return p;
        if (AREA_IDS_REF.indexOf(d.id) < 0) return 'wordArea: scenario "' + d.id + '" is not one that fills the slice';
        const f = fourDistinct('wordArea', d); if (f) return f;
        const t = tokProblems('wordArea', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== secAreaRef(d.r, d.n) + '|sq') return 'wordArea: opts[ans]=' + d.opts[d.ans] + ' is not ' + secAreaRef(d.r, d.n) + '|sq';
        const e = echoProblems('wordArea', d, [d.r, d.n]); if (e) return e;
        if (d.opts.indexOf(arcRef(d.r, d.n) + '|cm') < 0) return 'wordArea: the "answered the arc" distractor is missing';
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
      interCircle: d => {
        if (!(Number.isInteger(d.r) && d.r >= 3 && d.r <= R_MAX_REF)) return 'interCircle: r=' + d.r + ' is outside 3..' + R_MAX_REF;
        if (typeof d.wantArea !== 'boolean') return 'interCircle: wantArea is not a boolean';
        const f = fourDistinct('interCircle', d); if (f) return f;
        const t = tokProblems('interCircle', d.opts); if (t) return t;
        const want = d.wantArea ? areaRef(d.r) + '|sq' : circRef(d.r) + '|cm';
        if (String(d.opts[d.ans]) !== want) return 'interCircle: opts[ans]=' + d.opts[d.ans] + ' is not ' + want;
        const e = echoProblems('interCircle', d, [d.r]); if (e) return e;
        /* 這一題沒有圓心角，所以不可以出現角度選項 */
        if (d.opts.some(o => String(o).endsWith('|deg'))) return 'interCircle: a whole-circle question offered an angle as an option';
      },
      interAngle: d => {
        if (!okAngRef(d.n)) return 'interAngle: the angle ' + d.n + ' is not one of this lesson’s ten';
        const f = fourDistinct('interAngle', d); if (f) return f;
        const t = tokProblems('interAngle', d.opts); if (t) return t;
        if (String(d.opts[d.ans]) !== (FULL_DEG_REF - d.n) * 100 + '|deg') return 'interAngle: opts[ans]=' + d.opts[d.ans] + ' is not ' + ((FULL_DEG_REF - d.n) * 100) + '|deg';
        const e = echoProblems('interAngle', d, [d.n]); if (e) return e;
        if (d.opts.some(o => !String(o).endsWith('|deg'))) return 'interAngle: an angle question offered a length or an area as an option';
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'fracOfCircle': { const f = fracRef(d.n); return f === null ? null : f.p + '/' + f.q; }
        case 'angleFromFrac': return withUnitRef(lang, 'deg', String(d.n));
        case 'arcFromR': return withUnitRef(lang, 'cm', hTextRef(arcRef(d.r, d.n)));
        case 'arcFromD': return withUnitRef(lang, 'cm', hTextRef(arcRef(d.r, d.n)));
        case 'areaFromR': return withUnitRef(lang, 'sq', hTextRef(secAreaRef(d.r, d.n)));
        case 'perimFromR': return withUnitRef(lang, 'cm', hTextRef(perimRef(d.r, d.n)));
        case 'wordArc': return withUnitRef(lang, 'cm', hTextRef(arcRef(d.r, d.n)));
        case 'wordArea': return withUnitRef(lang, 'sq', hTextRef(secAreaRef(d.r, d.n)));
        case 'whichQuestion': return ASKS_REF.area[d.a] ? ASKS_REF.area[d.a][lang] : null;
        case 'trueStatement': return TRUE_STATEMENTS_REF[d.t] ? TRUE_STATEMENTS_REF[d.t][lang] : null;
        case 'interCircle': return d.wantArea ? withUnitRef(lang, 'sq', hTextRef(areaRef(d.r))) : withUnitRef(lang, 'cm', hTextRef(circRef(d.r)));
        case 'interAngle': return withUnitRef(lang, 'deg', String(FULL_DEG_REF - d.n));
        default: return null;
      }
    },

    /* 這一課的選項長什麼樣：一個數 ＋ 公分／平方公分／度，一個最簡分數，或一句釘住的句子。 */
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
      if (!p) return genId + ' option is not "<number> <unit>" or "<p>/<q>" in this lesson’s writing: ' + t;
      const wantUnit = genId === 'fracOfCircle' ? 'fr'
                     : (genId === 'angleFromFrac' || genId === 'interAngle') ? 'deg'
                     : (genId === 'areaFromR' || genId === 'wordArea') ? 'sq'
                     : (genId === 'interCircle') ? null       /* 圓周長是 cm、面積是 sq，由 expectedCorrect 決定 */
                     : 'cm';
      if (p.u === 'fr'){
        if (genId !== 'fracOfCircle') return genId + ' option is a fraction but this question asks for a length, an area or an angle: ' + t;
        if (!(p.p >= 1 && p.q >= 2 && p.p < p.q)) return 'fracOfCircle option is not a proper fraction: ' + t;
        if (gcdSubRef(p.p, p.q) !== 1) return 'fracOfCircle option is not in its lowest terms: ' + t;
        return null;
      }
      if (genId === 'fracOfCircle') return 'fracOfCircle option is not a fraction: ' + t;
      if (p.h < 1 || p.h > 200000) return genId + ' option ' + t + ' leaves the lesson range';
      if (p.u === 'deg' && (p.h % 100 !== 0 || p.h > FULL_DEG_REF * 100)) return genId + ' option ' + t + ' is not a whole number of degrees in 1..360';
      if (isCorrect && wantUnit !== null && p.u !== wantUnit) return genId + ' marked option carries the unit "' + p.u + '", expected "' + wantUnit + '"';
      if (p.u === 'deg' && genId !== 'angleFromFrac' && genId !== 'interAngle') return genId + ' option is an angle but this question asks for a length or an area: ' + t;
      if ((genId === 'angleFromFrac' || genId === 'interAngle') && p.u !== 'deg') return genId + ' option is not an angle: ' + t;
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
      /* 值去重（帶單位的也比單位，分數比約分之後的值） */
      const keys = q.opts.map(o => optKeyRef(o, lang));
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
        if (keys[i] === keys[j]) out.push('two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
      /* ⚠️ 連**印出來的數字**都不可以重複：`3.14 公分` 和 `3.14 平方公分` 是兩個不同的量，
         可是排在一起讀起來像在玩文字遊戲，孩子看到的其實只有三個數。 */
      const shownNums = q.opts.map(o => { const p = parseOptRef(o, lang); return p && p.u !== 'fr' ? hTextRef(p.h) : null; });
      for (let i = 0; i < shownNums.length; i++) for (let j = i + 1; j < shownNums.length; j++)
        if (shownNums[i] !== null && shownNums[i] === shownNums[j]) out.push('two options print the same number with different units: ' + q.opts[i] + ' / ' + q.opts[j]);
      /* ⚠️ 從**印出來的**題幹讀回數字再和誘答的值比對。simgen 內建的那一條比的是整串字，
         而這一課的選項一律帶單位或是分數，所以它永遠比不到 —— 真正的比對在這裡。
         `angleFromFrac` 的分母是**刻意**的迷思誘答，只放行那一個值。 */
      if (genId !== 'trueStatement' && genId !== 'whichQuestion' && genId !== 'fracOfCircle'){
        const stemNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+(?:\.\d+)?/g) || []).map(v => Math.round(Number(v) * 100));
        const allow = genId === 'angleFromFrac' ? Math.round(d.q * 100) : null;
        q.opts.forEach((o, oi) => {
          if (oi === q.ans) return;
          const p = parseOptRef(o, lang);
          if (!p || p.u === 'fr') return;
          if (allow !== null && p.h === allow) return;
          if (stemNums.indexOf(p.h) >= 0) out.push('the distractor "' + o + '" copies a number the stem prints');
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
      if (genId === 'fracOfCircle'){
        const units = new Set(q.opts.map(o => (parseOptRef(o, lang) || { u:'?' }).u));
        if (units.size !== 1 || !units.has('fr')) out.push('a share question offered something that is not a fraction: ' + q.opts.join(' | '));
      }
      return out.length ? out.join('; ') : null;
    },

    /* 這一課的選項一律帶單位或是分數，所以 simgen 內建的「誘答抄題幹」比的是整串字，永遠比不到；
       真正的比對在上面 renderCheck 裡（比**值**，而且只放行 angleFromFrac 那一個刻意的迷思）。 */
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
    dataReturn: '{PI_H, R_MAX, FULL_DEG, ANGLES, isPosInt, isNonNegInt, okR, okD, okAng, hText, gcdInt, fracOf, fracText, ' +
                'circH, areaH, arcH, secAreaH, perimH, angFromFrac, okPair, ' +
                'FIG_W, FIG_H, SC, CX, CY, DOT_R, STROKE, HI_STROKE, LABEL_X, LABEL_A_Y, LABEL_B_Y, LABEL_FS, LABEL_MAX, ' +
                'CX_SOLO, BAR_X0, BAR_W, BAR_Y, BAR_H, BAR_QS, MARKS, ptOn, wedgePath, arcPath, planSector, planFraction, ' +
                'S1_CASES, S1_R, S2_CASES, S3_CASES, S4_CASES, S5_CASES, caseValueH, caseMark, radiusOf, diameterOf, ' +
                'ROUNDS, roundAnswer, roundAnswerIndex, roundFigure, roundUnit, plEn, withUnit, UNIT_WORD}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器與 <path> 外框自己先過 PROBE ---- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = decArith(pr.text).problems.length > 0;
        if (caught !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"' + (caught ? ': ' + decArith(pr.text).problems[0] : ''));
      });
      PATH_PROBES.forEach(pr => {
        const problems = canvasProblems(pr.svg);
        const caught = problems.length > 0;
        if (caught !== pr.bad) fail('canvas path probe "' + pr.name + '" (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed' + (caught ? ': ' + problems[0] : ''));
      });
      /* ⚠️ PROBE 也會把算式推進 DEC_SEEN，所以覆蓋率要從這裡歸零重數。 */
      DEC_SEEN.length = 0;
      const lessonDir = path.dirname(process.argv[2]);      /* ⚠️ 不可以用 __dirname：breaktest 把四頁複製到暫存目錄 */
      const RAW = {}, TEXT = {};
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        try { RAW[pg] = fs.readFileSync(path.join(lessonDir, pg + '.html'), 'utf8'); }
        catch (e){ fail('cannot read ' + pg + '.html next to index.html (' + e.code + ')'); }
      });
      /* ⚠️ 「讀者看得到的文字」＝ markup（**先把 <script> 整段拿掉**）＋ 字典裡**求值之後**的字串。
         只拆標籤是不夠的：<script> 裡的原始碼會留下來，於是用詞釘樁可以靠「沒人看得到的程式碼」過關
         （codex 抓到）。字典的函式不展開，它們的輸出由題庫與產生器那兩段驗。 */
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        if (RAW[pg] === undefined) return;
        const markup = visibleText(String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n'));
        const dict = pg === 'index' ? I18N : i18nOf(RAW[pg]);
        const strings = [];
        if (dict) ['zh', 'en'].forEach(lang => { i18nStrings(dict[lang] || {}, []).forEach(t => strings.push(visibleText(t))); });
        TEXT[pg] = markup + '\n' + strings.join('\n');
      });

      /* ---- 1. 版面常數 ＝ 獨立寫死的第二份；六張畫布的 viewBox 與 CSS 高度 ---- */
      const CONSTS = { PI_H:PI_H_REF, R_MAX:R_MAX_REF, FULL_DEG:FULL_DEG_REF, FIG_W:FIG_W_REF, FIG_H:FIG_H_REF, SC:SC_REF,
                       CX:CX_REF, CX_SOLO:CX_SOLO_REF, CY:CY_REF, DOT_R:DOT_R_REF, STROKE:STROKE_REF, HI_STROKE:HI_STROKE_REF,
                       LABEL_X:LABEL_X_REF, LABEL_A_Y:LABEL_A_Y_REF, LABEL_B_Y:LABEL_B_Y_REF, LABEL_FS:LABEL_FS_REF, LABEL_MAX:LABEL_MAX_REF,
                       BAR_X0:BAR_X0_REF, BAR_W:BAR_W_REF, BAR_Y:BAR_Y_REF, BAR_H:BAR_H_REF, S1_R:S1_R_REF };
      Object.keys(CONSTS).forEach(k => { if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ' but the reference says ' + CONSTS[k]); });
      if (String(data.ANGLES) !== String(ANGLES_REF)) fail('the angle list is ' + data.ANGLES + ', the reference says ' + ANGLES_REF);
      if (String(data.MARKS) !== String(MARKS_REF)) fail('the mark list is ' + data.MARKS + ', the reference says ' + MARKS_REF);
      if (String(data.BAR_QS) !== String(BAR_QS_REF)) fail('the strip denominators are ' + data.BAR_QS + ', the reference says ' + BAR_QS_REF);
      /* 每一個可能的分母都要把長條的寬整除，不然格子會是小數寬。
         ⚠️ 要驗**頁面的** BAR_W：只驗參考常數的話，頁面改寬了這一條也不會響（codex 抓到）。 */
      BAR_QS_REF.forEach(q => {
        if (BAR_W_REF % q !== 0) fail('the reference strip width ' + BAR_W_REF + ' is not divisible by ' + q);
        if (data.BAR_W % q !== 0) fail('the page draws a ' + data.BAR_W + 'px strip, which the denominator ' + q + ' does not divide evenly');
      });
      /* 十個圓心角約分之後的分母，一個都不可以掉在 BAR_QS 之外 */
      ANGLES_REF.forEach(n => {
        const f = fracRef(n);
        if (BAR_QS_REF.indexOf(f.q) < 0) fail('the angle ' + n + ' cancels to ' + f.p + '/' + f.q + ', whose denominator the strip cannot draw');
      });
      /* 最長的標籤真的放得進畫布：用參考常數自己算，不相信 LABEL_MAX 的註解 */
      if (LABEL_X_REF + Math.ceil(LABEL_MAX_REF * LABEL_FS_REF * 1.2) + 2 > FIG_W_REF) fail('a LABEL_MAX-long label does not fit the canvas width');
      if (LABEL_B_Y_REF + LABEL_FS_REF * 0.25 + 2 > FIG_H_REF) fail('the lower label would fall off the bottom of the canvas');
      const liveSrc = src.replace(/<!--[\s\S]*?-->/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      const svgs = liveSrc.match(/<svg[^>]*>/g) || [];
      if (svgs.length !== 6) fail('index.html has ' + svgs.length + ' canvases, expected 6 (five examples and the game)');
      svgs.forEach(tag => {
        const cls = (/class="([^"]+)"/.exec(tag) || [])[1];
        const nums = ((/viewBox="([^"]+)"/.exec(tag) || ['', ''])[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
        if (cls !== 'secfig') fail('a canvas has class "' + cls + '", which this config does not know');
        else if (nums.length !== 4 || nums[0] !== 0 || nums[1] !== 0 || nums[2] !== FIG_W_REF || nums[3] !== FIG_H_REF) fail('a canvas viewBox is ' + tag + ', expected 0 0 ' + FIG_W_REF + ' ' + FIG_H_REF);
      });
      /* 把圖藏起來的 CSS：plan 的幾何全對、每一條釘樁也全過，畫面上卻什麼都看不到。 */
      const styleBlocks = (liveSrc.match(/<style[\s\S]*?<\/style>/gi) || []).join('\n');
      (styleBlocks.match(/[^{}]*\{[^{}]*\}/g) || []).forEach(rule => {
        const sel = rule.slice(0, rule.indexOf('{'));
        if (!/secfig/i.test(sel)) return;
        const body = rule.slice(rule.indexOf('{'));
        if (/display\s*:\s*none|visibility\s*:\s*(hidden|collapse)|opacity\s*:\s*0(?:\.0+)?\s*[;}]|fill\s*:\s*(none|transparent)|transform\s*:[^;}]*scale\(\s*0(?:\.0+)?\s*[,)]|clip-path\s*:|(?:width|height)\s*:\s*0(?:\.0+)?\s*(?:px|%)?\s*[;}]/i.test(body))
          fail('a CSS rule hides the figure: "' + rule.replace(/\s+/g, ' ').trim().slice(0, 80) + '"');
      });
      const rules = liveSrc.match(/\.secfig\s*\{[^}]*\}/g) || [];
      if (rules.length !== 1) fail('index.html declares the .secfig rule ' + rules.length + ' time(s), expected exactly 1');
      else {
        const hs = rules[0].match(/[{;]\s*height:\s*(\d+)px/g) || [];
        if (hs.length !== 1) fail('the .secfig rule declares a plain height ' + hs.length + ' time(s)');
        else if (Number(/height:\s*(\d+)px/.exec(hs[0])[1]) !== FIG_H_REF) fail('.secfig is ' + hs[0].trim() + ' in CSS but the viewBox is ' + FIG_H_REF + ' tall — the drawing would be letterboxed');
      }

      /* ---- 2. 小數的印法、約分、三條公式：全域逐一對獨立實作 ---- */
      for (let h = 0; h <= 200000; h++){
        if (data.hText(h) !== hTextRef(h)){ fail('hText(' + h + ') is "' + data.hText(h) + '", the reference says "' + hTextRef(h) + '"'); break; }
      }
      if (data.hText(-1) !== '?' || data.hText(1.5) !== '?' || data.hText('7') !== '?') fail('hText does not fail closed on a bad value');
      /* 約分：兩種最大公因數演算法必須永遠同意（1 ~ 360 全掃） */
      for (let a = 1; a <= FULL_DEG_REF; a++){
        if (data.gcdInt(a, FULL_DEG_REF) !== gcdSubRef(a, FULL_DEG_REF)){
          fail('gcdInt(' + a + ', 360) is ' + data.gcdInt(a, FULL_DEG_REF) + ', repeated subtraction says ' + gcdSubRef(a, FULL_DEG_REF)); break;
        }
      }
      /* ⚠️ 兩個參數都要試：只試第一個的話，第二個參數的守門拿掉了也沒人會響（改壞測試抓到）。 */
      if (data.gcdInt(0, 12) !== null || data.gcdInt(2.5, 10) !== null || data.gcdInt(12, 0) !== null || data.gcdInt(10, 2.5) !== null) fail('gcdInt does not fail closed on a bad value');
      if (data.circH(0) !== null || data.circH(R_MAX_REF + 1) !== null || data.circH(2.5) !== null) fail('circH does not fail closed outside 1..' + R_MAX_REF);
      if (data.areaH(0) !== null || data.areaH(R_MAX_REF + 1) !== null || data.areaH(2.5) !== null) fail('areaH does not fail closed outside 1..' + R_MAX_REF);
      /* 「剛好那十個」要逐一掃過（含 0、360 與小數），不能只抽三個值試（codex 抓到）。 */
      for (let n = -1; n <= 400; n++){
        if (data.okAng(n) !== (ANGLES_REF.indexOf(n) >= 0)){ fail('okAng(' + n + ') is ' + data.okAng(n) + ', the reference says ' + (ANGLES_REF.indexOf(n) >= 0)); break; }
      }
      /* ⚠️ 上面那個迴圈只走整數：小數要另外掃，而且要掃**每一個合法角度的左右**，
         不然「多接受 30.5」這種實作照樣會過（codex 第二輪抓到）。 */
      ANGLES_REF.concat([0, 15, 75, 200, 359]).forEach(n => {
        [n + 0.5, n - 0.5, n + 0.1].forEach(v => {
          if (data.okAng(v)) fail('okAng(' + v + ') is true, but this lesson only uses whole degrees from its list');
        });
      });
      if (data.okAng('90') || data.okAng(null) || data.okAng(undefined)) fail('okAng accepts something that is not a number of degrees');
      /* ⚠️ 探針的角度要挑**除得盡**的那一種（15 度就是）：50 度本來就除不盡，守門拿掉了也照樣回 null，那條斷言等於沒在看（改壞測試抓到）。 */
      if (data.arcH(6, 15) !== null || data.secAreaH(6, 15) !== null || data.perimH(6, 15) !== null) fail('the sector formulas do not fail closed on an angle outside the list');
      if (data.arcH(6, 50) !== null || data.secAreaH(6, 50) !== null) fail('the sector formulas do not fail closed on an angle that does not divide exactly');
      let pairsSeen = 0, pairsSkipped = 0;
      for (let r = 1; r <= R_MAX_REF; r++){
        const c = data.circH(r), a = data.areaH(r);
        if (c !== circRef(r)) fail('circH(' + r + ') is ' + c + ', repeated addition says ' + circRef(r));
        if (a !== areaRef(r)) fail('areaH(' + r + ') is ' + a + ', repeated addition says ' + areaRef(r));
        for (const n of ANGLES_REF){
          const arc = data.arcH(r, n), sec = data.secAreaH(r, n), per = data.perimH(r, n);
          const wantArc = arcRef(r, n), wantSec = secAreaRef(r, n), wantPer = perimRef(r, n);
          if (arc !== wantArc) fail('arcH(' + r + ',' + n + ') is ' + arc + ', cancelling first says ' + wantArc);
          if (sec !== wantSec) fail('secAreaH(' + r + ',' + n + ') is ' + sec + ', cancelling first says ' + wantSec);
          if (per !== wantPer) fail('perimH(' + r + ',' + n + ') is ' + per + ', the reference says ' + wantPer);
          if (wantArc === null || wantSec === null){ pairsSkipped++; continue; }
          pairsSeen++;
          /* 「弧長是圓周長的那個分數」「面積是圓面積的同一個分數」「周長是弧長再加兩條半徑」。
             ⚠️ 這三條一律拿**頁面算出來的** arc／sec／per 去比：寫成 wantArc 和 arcRef 相比的話
             那是參考跟自己比，頁面怎麼錯都不會響（codex 抓到）。 */
          const f = fracRef(n);
          if (arc * f.q !== circRef(r) * f.p) fail('the arc for r=' + r + ', n=' + n + ' is not ' + f.p + '/' + f.q + ' of the circumference');
          if (sec * f.q !== areaRef(r) * f.p) fail('the sector area for r=' + r + ', n=' + n + ' is not ' + f.p + '/' + f.q + ' of the circle’s area');
          if (per !== arc + 2 * r * 100) fail('the perimeter for r=' + r + ', n=' + n + ' is not the arc plus two radiuses');
          /* 半圓：弧長剛好是圓周長的一半（這一條和上面那條**不一樣**：它比的是 c 和 arc，
             不是把同一個等式再寫一次）。 */
          if (n === 180 && 2 * arc !== c) fail('the half-circle arc for r=' + r + ' is not half the circumference');
          /* 圓心角變 2 倍，扇形面積就是 2 倍（不是 4 倍）—— 複習頁那句假話的真值靠這裡撐著 */
          if (ANGLES_REF.indexOf(2 * n) >= 0 && secAreaRef(r, 2 * n) !== null && secAreaRef(r, 2 * n) !== 2 * wantSec)
            fail('doubling the angle at r=' + r + ', n=' + n + ' does not double the sector area');
          if (data.okPair(r, n) !== true) fail('okPair(' + r + ',' + n + ') should be true');
          /* 這一對除不盡的時候要是 false —— 只驗 true 的那一半，`okPair(){return true}` 也會過（codex 抓到）。 */
        }
      }
      if (!pairsSeen || !pairsSkipped) fail('the (radius, angle) domain gave ' + pairsSeen + ' usable and ' + pairsSkipped + ' skipped pairs — both kinds must occur');
      /* okPair：**兩個方向**都要驗（合法的要 true、除不盡或超出範圍的要 false）。 */
      let pairTrue = 0, pairFalse = 0;
      for (let r = 0; r <= R_MAX_REF + 1; r++){
        for (const n of ANGLES_REF.concat([0, 50, 360])){
          const want = arcRef(r, n) !== null && secAreaRef(r, n) !== null;
          if (data.okPair(r, n) !== want) fail('okPair(' + r + ',' + n + ') is ' + data.okPair(r, n) + ', the reference says ' + want);
          if (want) pairTrue++; else pairFalse++;
        }
      }
      if (!pairTrue || !pairFalse) fail('okPair was only exercised in one direction (' + pairTrue + ' true, ' + pairFalse + ' false)');
      /* 倒過來：知道分數求圓心角 */
      ANGLES_REF.forEach(n => {
        const f = fracRef(n);
        if (data.angFromFrac(f.p, f.q) !== n) fail('angFromFrac(' + f.p + ',' + f.q + ') is ' + data.angFromFrac(f.p, f.q) + ', expected ' + n);
        if (data.fracText(n) !== f.p + '/' + f.q) fail('fracText(' + n + ') is ' + data.fracText(n) + ', expected ' + f.p + '/' + f.q);
      });
      /* ⚠️ 1/5 剛好算得出整數的 72 度，可是 72 不在這一課的十個角裡 —— 這一筆才驗得到最後那道守門。 */
      if (data.angFromFrac(1, 5) !== null || data.angFromFrac(1, 7) !== null || data.angFromFrac(3, 3) !== null || data.angFromFrac(5, 4) !== null) fail('angFromFrac does not fail closed on a share that is not one of this lesson’s angles');
      if (data.fracText(50) !== '?') fail('fracText does not fail closed on an angle outside the list');
      if (data.okD(5) || data.okD(0) || !data.okD(6) || data.okD(2 * R_MAX_REF + 2))
        fail('okD does not accept exactly the even diameters whose half is a usable radius');
      if (data.plEn(1, 'centimetre') !== '1 centimetre' || data.plEn(2, 'centimetre') !== '2 centimetres') fail('plEn is wrong');
      if (data.withUnit('zh', 'sq', '28.26') !== '28.26 平方公分' || data.withUnit('en', 'deg', '1') !== '1 degree' ||
          data.withUnit('en', 'cm', '9.42') !== '9.42 centimetres' || data.withUnit('en', 'oops', '4') !== '?') fail('withUnit is wrong');

      /* ---- 3. 兩種圖：每一個圖元的座標都重算一次再比對，四個邊餵給 lib/canvas.js，再用幾何量驗一次 ---- */
      const LONG = 'x'.repeat(LABEL_MAX_REF);
      let drawn = 0, capped = 0;
      for (let r = 0; r <= R_MAX_REF + 2; r++){
        for (const n of ANGLES_REF.concat([50])){
          for (const mark of MARKS_REF.concat(['nonsense'])){
            /* 兩個合法的圓心都要掃：單獨一張圖放中央（預設），和長條並排時靠左。 */
            for (const cx of [undefined, CX_SOLO_REF, CX_REF]){
              const tag = 'planSector(' + r + ',' + n + ',' + mark + ',' + String(cx) + ')';
              const pl = data.planSector(r, n, mark, cx);
              const wantPrims = refSectorPrims(r, n, mark, cx);
              planProblems(tag, pl, wantPrims, LONG).forEach(fail);
              if (wantPrims === null) capped++;
              else { drawn++; geometryProblems(tag, pl, r, n, cx).forEach(fail); }
            }
          }
        }
      }
      /* ⚠️ 圓心只認那兩個位置：別的值一律不畫（不然圖會悄悄搬家，座標卻「照公式算」）。 */
      if (!data.planSector(6, 90, 'fill', 300).tooBig) fail('planSector accepts a centre this lesson never uses');
      if (!drawn || !capped) fail('planSector domain: ' + drawn + ' drawable and ' + capped + ' capped — both kinds must occur');
      let fDrawn = 0, fCapped = 0;
      for (let r = 0; r <= R_MAX_REF + 2; r++){
        for (const n of ANGLES_REF.concat([50])){
          const pl = data.planFraction(r, n);
          const wantPrims = refFractionPrims(r, n);
          planProblems('planFraction(' + r + ',' + n + ')', pl, wantPrims, LONG).forEach(fail);
          if (wantPrims === null) fCapped++;
          else {
            fDrawn++;
            geometryProblems('planFraction(' + r + ',' + n + ')', pl, r, n, CX_REF).forEach(fail);
            barProblems('planFraction(' + r + ',' + n + ')', pl, n).forEach(fail);
          }
        }
      }
      if (!fDrawn || !fCapped) fail('planFraction domain: ' + fDrawn + ' drawable and ' + fCapped + ' capped — both kinds must occur');

      /* ---- 4. 每一個標籤的字數：畫布放得下（26 個字是上限） ---- */
      /* ⚠️ 只驗長度的話，每一個標籤都寫「範例」也會過（codex 抓到）：每一條都用案例資料
         **重建**一次再逐字比對。給半徑就寫半徑、給直徑就寫「圓的直徑」—— 扇形自己沒有直徑。 */
      const givenRef = (sc, lang) => sc.kind === 'r'
        ? (lang === 'zh' ? '半徑 ' + sc.v : 'radius ' + sc.v)
        : (lang === 'zh' ? '圓的直徑 ' + sc.v : 'circle diam. ' + sc.v);
      const wantLabel = (lang, where, x) => {
        const zh = lang === 'zh';
        switch (where){
          case 's1a': return zh ? '圓心角 ' + x + ' 度' : 'angle ' + x + ' degrees';
          case 's1b': { const f = fracRef(x); return zh ? '整個圓的 ' + f.p + '/' + f.q : f.p + '/' + f.q + ' of the circle'; }
          case 's2a': case 's3a': return givenRef(x, lang) + (zh ? ' 公分，' + x.n + ' 度' : ' cm, ' + x.n + '°');
          case 's2b': { const r = x.kind === 'r' ? x.v : x.v / 2; return zh ? '弧長 ' + hTextRef(arcRef(r, x.n)) + ' 公分' : 'arc ' + hTextRef(arcRef(r, x.n)) + ' cm'; }
          case 's3b': { const r = x.kind === 'r' ? x.v : x.v / 2; return zh ? '面積 ' + hTextRef(secAreaRef(r, x.n)) + ' 平方公分' : 'area ' + hTextRef(secAreaRef(r, x.n)) + ' sq cm'; }
          case 's4a': return zh ? '半徑 ' + x.v + ' 公分，' + x.n + ' 度' : 'radius ' + x.v + ' cm, ' + x.n + '°';
          case 's4b': return zh ? '周長 ' + hTextRef(perimRef(x.v, x.n)) + ' 公分' : 'perimeter ' + hTextRef(perimRef(x.v, x.n)) + ' cm';
          case 's5a': return zh ? '半徑 ' + x.r + ' 公分，' + x.n + ' 度' : 'radius ' + x.r + ' cm, ' + x.n + '°';
          case 's5b': return zh ? ({ arc:'要算弧長', perim:'要算周長', area:'要算面積' })[x.want] : ({ arc:'wants the arc', perim:'wants the perimeter', area:'wants the area' })[x.want];
          case 'ga': return zh ? '半徑 ' + x.r + ' 公分，' + x.n + ' 度' : 'radius ' + x.r + ' cm, ' + x.n + '°';
          case 'gb': return zh ? ({ frac:'占整個圓的幾分之幾', arc:'要算弧長', area:'要算面積', perim:'要算周長', which:'要算周長' })[x.kind]
                               : ({ frac:'share of the circle', arc:'wants the arc', area:'wants the area', perim:'wants the perimeter', which:'wants the perimeter' })[x.kind];
          default: return null;
        }
      };
      const labelTexts = [];
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang];
        data.S1_CASES.forEach(n => { labelTexts.push([lang, 's1a', d.s1labelA(n), n]); labelTexts.push([lang, 's1b', d.s1labelB(n), n]); });
        data.S2_CASES.forEach(sc => { labelTexts.push([lang, 's2a', d.s2labelA(sc), sc]); labelTexts.push([lang, 's2b', d.s2labelB(sc), sc]); });
        data.S3_CASES.forEach(sc => { labelTexts.push([lang, 's3a', d.s3labelA(sc), sc]); labelTexts.push([lang, 's3b', d.s3labelB(sc), sc]); });
        data.S4_CASES.forEach(sc => { labelTexts.push([lang, 's4a', d.s4labelA(sc), sc]); labelTexts.push([lang, 's4b', d.s4labelB(sc), sc]); });
        data.S5_CASES.forEach(sc => { labelTexts.push([lang, 's5a', d.s5labelA(sc), sc]); labelTexts.push([lang, 's5b', d.s5labelB(sc), sc]); });
        data.ROUNDS.forEach(rd => { labelTexts.push([lang, 'ga', d.gLabelA(rd), rd]); labelTexts.push([lang, 'gb', d.gLabelB(rd), rd]); });
      });
      labelTexts.forEach(row => {
        const lang = row[0], where = row[1], t = row[2], x = row[3];
        if (typeof t !== 'string' || !t.trim()){ fail('label ' + where + ' (' + lang + ') is empty'); return; }
        if ([...t].length > LABEL_MAX_REF) fail('label ' + where + ' (' + lang + ') is ' + [...t].length + ' characters long, over the ' + LABEL_MAX_REF + ' the canvas fits: "' + t + '"');
        const want = wantLabel(lang, where, x);
        if (want === null || want === undefined) fail('no label reference for ' + where);
        else if (t !== want) fail('label ' + where + ' (' + lang + ') is "' + t + '", the reference rebuilds "' + want + '"');
      });
      if (labelTexts.length !== 2 * 2 * (S1_CASES_REF.length + S2_CASES_REF.length + S3_CASES_REF.length + S4_CASES_REF.length + S5_CASES_REF.length + GAME_ROUNDS_REF))
        fail('only ' + labelTexts.length + ' labels were measured');

      /* ---- 5. 範例 1～5 的案例 ---- */
      const sameList = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => String(v) === String(b[i]));
      if (!sameList(data.S1_CASES, S1_CASES_REF)) fail('S1_CASES is [' + data.S1_CASES + '], the reference says [' + S1_CASES_REF + ']');
      data.S1_CASES.forEach((n, i) => {
        if (!okAngRef(n)) fail('S1 case ' + i + ': ' + n + ' is not one of this lesson’s angles');
        if (data.planFraction(S1_R_REF, n).tooBig) fail('S1 case ' + i + ' does not fit the fraction picture');
      });
      if (!data.S1_CASES.some(n => n > 180)) fail('S1_CASES should include an angle bigger than a straight angle (the large-arc case)');
      [['S2', data.S2_CASES, S2_CASES_REF], ['S3', data.S3_CASES, S3_CASES_REF], ['S4', data.S4_CASES, S4_CASES_REF]].forEach(row => {
        const name = row[0], got = row[1], ref = row[2];
        if (!sameList(got.map(c => c.kind + '-' + c.v + '-' + c.n), ref.map(c => c[0] + '-' + c[1] + '-' + c[2])))
          fail(name + '_CASES is [' + got.map(c => c.kind + '-' + c.v + '-' + c.n) + ']');
        got.forEach((c, i) => {
          const r = data.radiusOf(c);
          if (!okRRef(r)) fail(name + ' case ' + i + ' has no usable radius');
          else {
            if (data.diameterOf(c) !== 2 * r) fail(name + ' case ' + i + ': the diameter is not twice the radius');
            if (arcRef(r, c.n) === null) fail(name + ' case ' + i + ': the arc does not divide exactly');
            if (secAreaRef(r, c.n) === null) fail(name + ' case ' + i + ': the sector area does not divide exactly');
          }
        });
      });
      if (!data.S2_CASES.some(c => c.kind === 'd')) fail('S2_CASES must include a diameter case (the halve-it-first trap)');
      if (!data.S4_CASES.some(c => c.n === 180)) fail('S4_CASES must include the half circle, where the two radiuses are the diameter');
      if (!sameList(data.S5_CASES.map(c => c.id + '-' + c.want + '-' + c.r + '-' + c.n), S5_CASES_REF.map(c => c.join('-'))))
        fail('S5_CASES is [' + data.S5_CASES.map(c => c.id + '-' + c.want + '-' + c.r + '-' + c.n) + ']');
      const wants = new Set();
      data.S5_CASES.forEach((c, i) => {
        wants.add(c.want);
        const wantH = c.want === 'arc' ? arcRef(c.r, c.n) : c.want === 'perim' ? perimRef(c.r, c.n) : secAreaRef(c.r, c.n);
        if (wantH === null) fail('S5 case ' + i + ': the reference cannot work the value out');
        else if (data.caseValueH(c) !== wantH) fail('S5 case ' + i + ': the value is ' + data.caseValueH(c) + ', the reference says ' + wantH);
        const wantMark = c.want === 'arc' ? 'arc' : c.want === 'perim' ? 'perim' : 'fill';
        if (data.caseMark(c) !== wantMark) fail('S5 case ' + i + ': the mark is ' + data.caseMark(c) + ', expected ' + wantMark);
      });
      if (!(wants.has('arc') && wants.has('perim') && wants.has('area'))) fail('S5_CASES must show all three: an arc, a perimeter and an area');

      /* ---- 6. 遊戲的五關：正解算得出來、選項不重複、誘答是設計好的那幾個 ---- */
      if (data.ROUNDS.length !== GAME_ROUNDS_REF) fail('the game has ' + data.ROUNDS.length + ' rounds, expected ' + GAME_ROUNDS_REF);
      const kinds = data.ROUNDS.map(r => r.kind);
      if (String(kinds) !== String(['frac', 'arc', 'area', 'perim', 'which'])) fail('the game rounds are ' + kinds);
      data.ROUNDS.forEach((rd, i) => {
        if (new Set(rd.opts.map(String)).size !== 4) fail('round ' + i + ' repeats an option');
        const at = data.roundAnswerIndex(rd);
        if (at < 0) fail('round ' + i + ': the computed answer is not among the options');
        else if (at !== rd.ans) fail('round ' + i + ': the declared ans is ' + rd.ans + ' but the recomputed answer sits at ' + at);
        const f = fracRef(rd.n);
        const want = rd.kind === 'frac' ? f.p + '/' + f.q
                   : rd.kind === 'arc' ? hTextRef(arcRef(rd.r, rd.n))
                   : rd.kind === 'area' ? hTextRef(secAreaRef(rd.r, rd.n))
                   : rd.kind === 'perim' ? hTextRef(perimRef(rd.r, rd.n))
                   : hTextRef(rd.want === 'area' ? secAreaRef(rd.r, rd.n) : rd.want === 'arc' ? arcRef(rd.r, rd.n) : perimRef(rd.r, rd.n));
        if (data.roundAnswer(rd) !== want) fail('round ' + i + ': roundAnswer is ' + data.roundAnswer(rd) + ', the reference says ' + want);
        /* ⚠️ 只驗「畫得下」的話，roundFigure 永遠回同一張 90 度的圖也會過（codex 抓到）：
           要用**這一關自己的**半徑、圓心角與標記重算一次再逐一比對。 */
        const fig = data.roundFigure(rd);
        if (!fig || fig.tooBig) fail('round ' + i + ': the figure does not fit');
        else if (rd.kind === 'frac'){
          planProblems('round ' + i + ' figure', fig, refFractionPrims(rd.r, rd.n), LONG).forEach(fail);
          geometryProblems('round ' + i + ' figure', fig, rd.r, rd.n, CX_REF).forEach(fail);
          barProblems('round ' + i + ' figure', fig, rd.n).forEach(fail);
        } else {
          const wantMark = rd.kind === 'arc' ? 'arc' : rd.kind === 'area' ? 'fill'
                         : rd.kind === 'perim' ? 'perim'
                         : (rd.want === 'area' ? 'fill' : rd.want === 'arc' ? 'arc' : 'perim');
          planProblems('round ' + i + ' figure', fig, refSectorPrims(rd.r, rd.n, wantMark), LONG).forEach(fail);
          geometryProblems('round ' + i + ' figure', fig, rd.r, rd.n).forEach(fail);
        }
        /* (14) 情境那一關的 want 打錯字會被當成周長靜靜放行，所以先卡住它。 */
        if (rd.kind === 'which' && ['arc', 'area', 'perim'].indexOf(rd.want) < 0) fail('round ' + i + ': want "' + rd.want + '" is not arc, area or perim');
        const unit = data.roundUnit(rd);
        const wantUnit = rd.kind === 'frac' ? 'none'
                       : rd.kind === 'area' ? 'sq'
                       : rd.kind === 'which' ? (rd.want === 'area' ? 'sq' : 'cm')
                       : 'cm';
        if (unit !== wantUnit) fail('round ' + i + ': the unit is "' + unit + '", expected "' + wantUnit + '"');
      });
      /* 第 4 關（周長）的誘答一定要有「只算弧長」，第 5 關（情境）也一樣 */
      const r4 = data.ROUNDS[3], r5 = data.ROUNDS[4];
      if (r4.opts.indexOf(hTextRef(arcRef(r4.r, r4.n))) < 0) fail('round 3 (a perimeter) is missing the "arc only" distractor');
      if (r5.opts.indexOf(hTextRef(arcRef(r5.r, r5.n))) < 0) fail('round 4 (the word problem) is missing the "arc only" distractor');

      /* ---- 7. 題庫：整句題幹、四個選項、正解，全部對神諭；每一句解釋逐條驗算 ---- */
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
            /* 值去重（帶單位的也比單位、分數比約分之後的值） */
            const keys = q.opts.map(o => optKeyRef(String(o).replace(/<[^>]+>/g, ''), lang));
            for (let x = 0; x < keys.length; x++) for (let y = x + 1; y < keys.length; y++)
              if (keys[x] === keys[y]) fail(bank + '[' + i + '] ' + lang + ': two options are the same value: ' + q.opts[x] + ' / ' + q.opts[y]);
          });
        });
      });
      /* 題庫裡的每一個數字事實，各自獨立算一次 */
      BANK_FACTS.forEach((f, i) => {
        let got = null;
        if (f.arcOf) got = hTextRef(arcRef(f.arcOf[0], f.arcOf[1]));
        else if (f.secAreaOf) got = hTextRef(secAreaRef(f.secAreaOf[0], f.secAreaOf[1]));
        else if (f.perimOf) got = hTextRef(perimRef(f.perimOf[0], f.perimOf[1]));
        else if (f.circOf !== undefined) got = hTextRef(circRef(f.circOf));
        else if (f.areaOf !== undefined) got = hTextRef(areaRef(f.areaOf));
        if (got !== f.want) fail('bank fact ' + i + ': recomputed ' + got + ', the oracle says ' + f.want);
      });

      /* ---- 8. 跨頁用詞、禁用詞、交給別課的詞、算式裡的單位 ---- */
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
      /* ⚠️ 逐一**出現的位置**檢查，不是整頁檢查。窗口取前後 160 個字。 */
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
      /* ⚠️ 頁面層的算式檢查**不可以掃原始碼**（字典是 JS 字串拼出來的）。掃兩種真的會被讀到的字：
         ① markup 裡寫死的那一份（先拿掉 <script>）；② 每一頁 I18N 字典裡**求值之後**的字串。 */
      const MIN_EQ = { index:20, reference:14, parents:6 };
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        if (RAW[pg] === undefined) return;
        const chunks = [visibleText(String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n'))];
        const dict = pg === 'index' ? I18N : i18nOf(RAW[pg]);
        if (!dict) fail(pg + '.html: cannot read its I18N dictionary, so its wording went unchecked');
        else ['zh', 'en'].forEach(lang => {
          const one = i18nStrings(dict[lang] || {}, []);
          one.forEach((t, i) => stringProblems(t, lang, pg + '.html ' + lang + ' string ' + i).forEach(fail));
          one.forEach(t => chunks.push(t));
        });
        let verified = 0;
        chunks.forEach(t => {
          if (UNIT_IN_EQ.test(t)) fail(pg + '.html puts a unit inside an equation: "' + (t.match(/.{0,16}(?:公分|平方公分|度|cm)\s*[×÷].{0,12}|.{0,12}[×÷]\s*(?:公分|平方公分|度|cm).{0,16}/) || [''])[0].trim() + '"');
          const ar = decArith(t);
          ar.problems.forEach(m => fail(pg + '.html: ' + m));
          verified += ar.verified;
        });
        if (MIN_EQ[pg] !== undefined && verified < MIN_EQ[pg]) fail(pg + '.html only offered ' + verified + ' verifiable equations, expected at least ' + MIN_EQ[pg] + ' — the checker may have stopped reading them');
      });

      /* ---- 9. plan → DOM 的接線與複習頁的抽樣池 ---- */
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
          const box = new Function(rv.slice(i2, i3) + '\n; return {GENS:GENS, STATEMENTS:STATEMENTS, ASKS:ASKS, POOL_ANG:POOL_ANG, PAIRS:PAIRS, POOL_R_WHOLE:POOL_R_WHOLE, SCEN:SCEN, ARC_IDS:ARC_IDS, AREA_IDS:AREA_IDS};')();
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
          ['len', 'area'].forEach(side => {
            const keys = Object.keys(box.ASKS[side] || {});
            if (keys.length < 4) fail('review.html has only ' + keys.length + ' "' + side + '" question sentences; at least 4 are needed to fill three distractors');
            keys.forEach(k => {
              const ref = ASKS_REF[side][k];
              if (!ref || ref.zh !== box.ASKS[side][k].zh || ref.en !== box.ASKS[side][k].en)
                fail('review.html question sentence "' + side + '/' + k + '" is not the pinned one');
            });
          });
          /* ⚠️ 抽樣池要**確定性**地證明，不能靠抽幾千次碰運氣：把池子讀出來逐一看。 */
          if (String(box.POOL_ANG) !== String(ANGLES_REF)) fail('the angle pool is ' + box.POOL_ANG + ', the reference says ' + ANGLES_REF);
          if (!Array.isArray(box.PAIRS) || !box.PAIRS.length) fail('review.html no longer exposes the (radius, angle) pool');
          else {
            const wantPairs = [];
            for (let r = 1; r <= R_MAX_REF; r++) for (const n of ANGLES_REF){
              /* 半徑 2：弧長和扇形面積永遠是同一個數字（2r ＝ r × r），所以整條排除。 */
              if (r === 2) continue;
              const a = arcRef(r, n);
              if (a === null || secAreaRef(r, n) === null) continue;
              wantPairs.push(r + '@' + n);
              /* ⚠️ 「弧長剛好等於兩條半徑」會讓「忘了加半徑」的誘答和正解撞在一起。
                 這一課的十個角一個都做不到（157 × r × n ÷ 90 ＝ 200r 解不出整數的 n），
                 所以這裡是**證明它不會發生**，不是過濾 —— 真的出現就要報出來。 */
              if (a === 2 * r * 100) fail('r=' + r + ', n=' + n + ': the arc is exactly the two radiuses, so the "forgot the radiuses" distractor collides with the answer');
            }
            const gotPairs = box.PAIRS.map(p => p.r + '@' + p.n);
            if (String(gotPairs.slice().sort()) !== String(wantPairs.slice().sort()))
              fail('the (radius, angle) pool has ' + gotPairs.length + ' pairs, the reference works out ' + wantPairs.length);
            box.PAIRS.forEach(p => {
              if (arcRef(p.r, p.n) === null || secAreaRef(p.r, p.n) === null) fail('the pool contains r=' + p.r + ', n=' + p.n + ', which does not divide exactly');
              if (p.r === 2) fail('the pool contains radius 2, where an arc and a sector area always print the same number');
            });
          }
          /* ⚠️ 只檢查「每一個都在範圍裡」的話，空池子或只剩一個半徑也會過（codex 抓到）：
             整個集合逐一比對。這一課的整圓交錯題刻意從半徑 3 起跳（1、2 的圓畫出來太小、
             而半徑 2 的圓周長和面積是同一個數）。 */
          {
            const wantWhole = [];
            for (let r = 3; r <= R_MAX_REF; r++) wantWhole.push(r);
            if (!Array.isArray(box.POOL_R_WHOLE) || String(box.POOL_R_WHOLE) !== String(wantWhole))
              fail('the whole-circle radius pool is [' + box.POOL_R_WHOLE + '], the reference says [' + wantWhole + ']');
          }
          if (String(box.ARC_IDS) !== String(ARC_IDS_REF)) fail('the curved-edge scenarios are ' + box.ARC_IDS);
          if (String(box.AREA_IDS) !== String(AREA_IDS_REF)) fail('the fill-the-slice scenarios are ' + box.AREA_IDS);
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

      /* ---- 10. 驗算器的覆蓋率：讀過的算式太少就表示它停止讀了 ---- */
      /* ⚠️ 這個總數是**後盾**，不是主力：真正逐頁盯著的是上面 MIN_EQ 那一輪（每一頁各自的下限），
         因為累加的總數不會因為某一頁停止被讀而掉下來（codex 提醒）。 */
      if (DEC_SEEN.length < 80) fail('the arithmetic checker only read ' + DEC_SEEN.length + ' equations in total — it may have stopped reading them');
    }
  },

  breaks: [
    /* --- 版面常數與畫布 --- */
    { file:'index', via:'index', expect:'layout constant SC',
      find:'  var SC = 6;                                  /* 1 公分畫成 6 px（所有圖同一個比例尺） */',
      replace:'  var SC = 8;                                  /* 1 公分畫成 6 px（所有圖同一個比例尺） */',
      why:'every figure would be drawn at a different scale from the one the checker measures, and the biggest sector would leave the canvas' },
    { file:'index', via:'index', expect:'a canvas viewBox is',
      find:'<svg class="secfig" id="s1fig" viewBox="0 0 460 200"',
      replace:'<svg class="secfig" id="s1fig" viewBox="0 0 460 180"',
      why:'the fraction picture would be drawn in a shorter coordinate system than it uses' },
    { file:'index', via:'index', expect:'in CSS but the viewBox is',
      find:'.secfig{width:100%;max-width:460px;height:200px;display:block;margin:0 auto}',
      replace:'.secfig{width:100%;max-width:460px;height:240px;display:block;margin:0 auto}',
      why:'the drawing would be letterboxed inside a taller box' },
    { file:'index', via:'index', expect:'labels are not at y=',
      find:'  var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 192, LABEL_FS = 14;',
      replace:'  var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 150, LABEL_FS = 14;',
      why:'the lower label would be written on top of the strip instead of below it' },
    { file:'index', via:'index', expect:'cell 0 is',
      find:'  var BAR_X0 = 200, BAR_W = 240, BAR_Y = 88, BAR_H = 24;',
      replace:'  var BAR_X0 = 200, BAR_W = 250, BAR_Y = 88, BAR_H = 24;',
      why:'250 is not divisible by 12, so a twelfth of the strip would be a fractional number of pixels wide' },
    { file:'index', via:'index', expect:'the strip denominators are',
      find:'  var BAR_QS = [2, 3, 4, 6, 8, 12];            /* 約分之後可能出現的分母 */',
      replace:'  var BAR_QS = [2, 3, 4, 6, 8];            /* 約分之後可能出現的分母 */',
      why:'the angle 30 cancels to 1/12, so dropping 12 would silently stop the fraction picture from being drawn for it' },

    /* --- 小數的印法與約分 --- */
    { file:'index', via:'index', expect:'hText(10) is "0.10"',
      find:"    if (f % 10 === 0) return w + '.' + (f / 10);",
      replace:"    if (f % 10 === 0) return w + '.' + f;",
      why:'31.4 would be printed as 31.40, so every answer string would stop matching' },
    { file:'index', via:'index', expect:'hText does not fail closed',
      find:"    if (!isNonNegInt(h)) return '?';",
      replace:"    if (false) return '?';",
      why:'a broken value would be printed as NaN instead of a visible ?' },
    { file:'index', via:'index', expect:'repeated subtraction says',
      find:'    while (b){ var t = a % b; a = b; b = t; }',
      replace:'    while (b > 1){ var t = a % b; a = b; b = t; }',
      why:'the greatest common divisor would come out wrong whenever the last remainder is 1, so shares would not be cancelled down' },
    { file:'index', via:'index', expect:'gcdInt does not fail closed',
      find:'    if (!isPosInt(a) || !isPosInt(b)) return null;',
      replace:'    if (!isPosInt(a)) return null;',
      why:'a zero or fractional second argument would spin the loop instead of being refused' },

    /* --- 三條公式 --- */
    { file:'index', via:'index', expect:'repeated addition says',
      find:'  function circH(r){ return okR(r) ? 2 * r * PI_H : null; }',
      replace:'  function circH(r){ return okR(r) ? r * PI_H : null; }',
      why:'every circumference, and so every arc, would be half its real size' },
    { file:'index', via:'index', expect:'repeated addition says',
      find:'  function areaH(r){ return okR(r) ? r * r * PI_H : null; }',
      replace:'  function areaH(r){ return okR(r) ? r * PI_H : null; }',
      why:'every area would use the radius only once' },
    { file:'index', via:'index', expect:'cancelling first says',
      find:'    var v = circH(r) * n;\n    return v % FULL_DEG === 0 ? v / FULL_DEG : null;',
      replace:'    var v = circH(r) * FULL_DEG;\n    return v % n === 0 ? v / n : null;',
      why:'the share would be turned upside down — 360 ÷ angle instead of angle ÷ 360, the very misconception this lesson is about' },
    { file:'index', via:'index', expect:'cancelling first says',
      find:'    var v = areaH(r) * n;\n    return v % FULL_DEG === 0 ? v / FULL_DEG : null;',
      replace:'    var v = areaH(r) * n;\n    return v % FULL_DEG === 0 ? v / FULL_DEG + 1 : null;',
      why:'every sector area would be one hundredth too big' },
    { file:'index', via:'index', expect:'perimH(1,90) is',
      find:'    return a === null ? null : a + 2 * r * 100;',
      replace:'    return a === null ? null : a + r * 100;',
      why:'the perimeter would count one radius instead of two — the mistake this whole lesson exists to prevent' },
    { file:'index', via:'index', expect:'the sector formulas do not fail closed',
      find:'    if (!okR(r) || !okAng(n)) return null;\n    var v = circH(r) * n;',
      replace:'    if (!okR(r)) return null;\n    var v = circH(r) * n;',
      why:'an angle outside this lesson’s ten would be accepted and printed with a rounded-off answer' },
    { file:'index', via:'index', expect:'okAng(1) is true',
      find:'  function okAng(n){ return isPosInt(n) && ANGLES.indexOf(n) >= 0; }',
      replace:'  function okAng(n){ return isPosInt(n) && n <= 360; }',
      why:'any whole angle would be accepted, including the ones whose arc does not divide exactly' },
    { file:'index', via:'index', expect:'okD does not accept exactly',
      find:'  function okD(d){ return isPosInt(d) && d % 2 === 0 && okR(d / 2); }',
      replace:'  function okD(d){ return isPosInt(d) && d % 2 === 0; }',
      why:'a diameter of 26 would be accepted although its radius, 13, leaves the range this lesson draws' },
    { file:'index', via:'index', expect:'angFromFrac does not fail closed',
      find:'    var n = v / q;\n    return okAng(n) ? n : null;',
      replace:'    var n = v / q;\n    return n;',
      why:'a share like 1/7 would come back as an angle this lesson never uses' },
    { file:'index', via:'index', expect:'fracText(30) is',
      find:'    var g = gcdInt(n, FULL_DEG);\n    return g === null ? null : { p:n / g, q:FULL_DEG / g };',
      replace:'    var g = gcdInt(n, FULL_DEG);\n    return g === null ? null : { p:n, q:FULL_DEG };',
      why:'the share would never be cancelled down, so 90 degrees would read as 90/360 instead of 1/4' },

    /* --- 兩種圖 --- */
    { file:'index', via:'index', expect:'the browser would draw the other side',
      find:"           ' A ' + rp + ' ' + rp + ' 0 ' + (n > 180 ? 1 : 0) + ' 0 ' + b.x + ' ' + b.y + ' Z';",
      replace:"           ' A ' + rp + ' ' + rp + ' 0 0 0 ' + b.x + ' ' + b.y + ' Z';",
      why:'a sector bigger than a straight angle would be drawn as the small piece instead — the coordinates stay correct, only the picture is wrong' },
    { file:'index', via:'index', expect:'this lesson draws anticlockwise',
      find:"    return 'M ' + a.x + ' ' + a.y +\n           ' A ' + rp + ' ' + rp + ' 0 ' + (n > 180 ? 1 : 0) + ' 0 ' + b.x + ' ' + b.y;",
      replace:"    return 'M ' + a.x + ' ' + a.y +\n           ' A ' + rp + ' ' + rp + ' 0 ' + (n > 180 ? 1 : 0) + ' 1 ' + b.x + ' ' + b.y;",
      why:'the highlighted arc would run the other way round the circle, away from the shaded slice' },
    { file:'index', via:'index', expect:'straight edges drawn, a sector has exactly 2',
      find:'    prims.push(prLine(cxx, CY, b.x, b.y, hot ? C_HI : C_LINE, hot ? HI_STROKE : STROKE));',
      replace:'    if (n !== 180) prims.push(prLine(cxx, CY, b.x, b.y, hot ? C_HI : C_LINE, hot ? HI_STROKE : STROKE));',
      why:'the half circle would lose one of its two radiuses, so the picture would stop showing what the perimeter counts' },
    { file:'index', via:'index', expect:'the reference says "path',
      find:"    if (mark === 'arc' || mark === 'perim') prims.push(prPath(arcPath(cxx, CY, rp, n), 'none', C_HI, HI_STROKE));",
      replace:"    if (mark === 'arc') prims.push(prPath(arcPath(cxx, CY, rp, n), 'none', C_HI, HI_STROKE));",
      why:'the perimeter picture would highlight the two radiuses but not the arc' },
    { file:'index', via:'index', expect:'radius 0 is',
      find:'    var a = ptOn(cxx, CY, rp, 0), b = ptOn(cxx, CY, rp, n);\n    var hot = (mark === ',
      replace:'    var a = ptOn(cxx, CY, rp - 2, 0), b = ptOn(cxx, CY, rp, n);\n    var hot = (mark === ',
      why:'one radius would be drawn short, so the drawn slice would not close on the circle' },
    { file:'index', via:'index', expect:'cells are coloured, the fraction says',
      find:'      prims.push(prRect(BAR_X0 + i * cell, BAR_Y, cell, BAR_H, i < f.p ? C_FILL : C_CELL, C_CIRC, 2));',
      replace:'      prims.push(prRect(BAR_X0 + i * cell, BAR_Y, cell, BAR_H, i < 1 ? C_FILL : C_CELL, C_CIRC, 2));',
      why:'a 3/8 sector would colour one cell out of eight, so the strip would disagree with the slice next to it' },
    { file:'index', via:'index', expect:'the strip has',
      find:'    var prims = base.prims.slice(), cell = BAR_W / f.q, i;\n    for (i = 0; i < f.q; i++){',
      replace:'    var prims = base.prims.slice(), cell = BAR_W / f.q, i;\n    for (i = 0; i < f.p; i++){',
      why:'the strip would only draw the coloured cells, so the whole circle it is supposed to stand for would disappear' },

    /* --- 標籤 --- */
    { file:'index', via:'index', expect:'characters long, over the 26',
      find:"      s4labelA:function(sc){ return '半徑 ' + radiusOf(sc) + ' 公分，' + sc.n + ' 度'; },",
      replace:"      s4labelA:function(sc){ return '半徑 ' + radiusOf(sc) + ' 公分，圓心角 ' + sc.n + ' 度（沿著整圈邊緣走一圈）'; },",
      why:'the label would run off the right-hand edge of the drawing' },

    /* --- 範例與遊戲 --- */
    { file:'index', via:'index', expect:'S1_CASES should include an angle bigger',
      find:'  var S1_CASES = [90, 60, 45, 270];',
      replace:'  var S1_CASES = [90, 60, 45, 30];',
      why:'no example would show a sector bigger than a half circle, the case whose picture needs the other arc flag' },
    { file:'index', via:'index', expect:'S4_CASES must include the half circle',
      find:"    { kind:'r', v:10, n:180 },   /* 半圓：31.4 ＋ 20 ＝ 51.4 */",
      replace:"    { kind:'r', v:10, n:90 },   /* 半圓：31.4 ＋ 20 ＝ 51.4 */",
      why:'the perimeter example would stop showing the half circle, where the two radiuses are the diameter' },
    { file:'index', via:'index', expect:'S2_CASES must include a diameter case',
      find:"    { kind:'d', v:16, n:135 }    /* 直徑 16 → 半徑 8、135 度 → 弧長 18.84 */",
      replace:"    { kind:'r', v:8, n:135 }    /* 直徑 16 → 半徑 8、135 度 → 弧長 18.84 */",
      why:'the arc examples would never show the halve-the-diameter-first step' },
    { file:'index', via:'index', expect:'S5_CASES must show all three',
      find:"    { id:'fan',   want:'arc',   r:12, n:120 },   /* 扇子的弧邊要縫緞帶 → 弧長 25.12 公分 */",
      replace:"    { id:'fan',   want:'area',   r:12, n:120 },   /* 扇子的弧邊要縫緞帶 → 弧長 25.12 公分 */",
      why:'the deciding example would stop offering an arc-length situation, so two of the three kinds would be missing' },
    { file:'index', via:'index', expect:'the declared ans is',
      find:"    { kind:'arc', r:6, n:90, opts:['37.68', '9.42', '28.26', '12'], ans:1 },",
      replace:"    { kind:'arc', r:6, n:90, opts:['37.68', '9.42', '28.26', '12'], ans:2 },",
      why:'the round would declare the wrong option as its answer' },
    { file:'index', via:'index', expect:'round 3 (a perimeter) is missing the "arc only" distractor',
      find:"    { kind:'perim', r:9, n:120, opts:['18.84', '84.78', '36.84', '56.52'], ans:2 },",
      replace:"    { kind:'perim', r:9, n:120, opts:['25.12', '84.78', '36.84', '56.52'], ans:2 },",
      why:'the perimeter round would lose the distractor that catches a child who stops at the arc' },
    { file:'index', via:'index', expect:'the unit is "cm", expected "sq"',
      find:"    if (rd.kind === 'area') return 'sq';",
      replace:"    if (rd.kind === 'nothing') return 'sq';",
      why:'the area round would label its options in centimetres' },
    { file:'index', via:'index', expect:'roundAnswer is',
      find:"    if (rd.kind === 'perim') return hText(perimH(rd.r, rd.n));",
      replace:"    if (rd.kind === 'perim') return hText(arcH(rd.r, rd.n));",
      why:'the perimeter round would mark the arc-only option as correct' },

    /* --- 題庫 --- */
    { file:'index', via:'index', expect:'the stem is not the pinned sentence',
      find:'一個扇形的半徑是 <strong>6 公分</strong>、圓心角是 <strong>60 度</strong>，它的<strong>弧長</strong>是多少？',
      replace:'一個扇形的半徑是 <strong>6 公分</strong>、圓心角是 <strong>60 度</strong>，它的<strong>周長</strong>是多少？',
      why:'the question would ask for a perimeter while the marked answer is still the arc' },
    { file:'index', via:'index', expect:'this claim is wrong',
      find:'先算整個圓的圓周長：6 × 2 × 3.14 ＝ 37.68。圓心角 60 度占 360 度的 1/6',
      replace:'先算整個圓的圓周長：6 × 2 × 3.14 ＝ 37.86。圓心角 60 度占 360 度的 1/6',
      why:'the explanation would state a circumference that is not what the numbers give' },
    { file:'index', via:'index', expect:'the marked option is',
      find:"          opts:['9.42 公分', '21.42 公分', '28.26 平方公分', '37.68 公分'], ans:1,",
      replace:"          opts:['9.42 公分', '21.42 公分', '28.26 平方公分', '37.68 公分'], ans:0,",
      why:'the perimeter question would mark the arc-only option as correct — the misconception itself' },
    { file:'index', via:'index', expect:'the options are',
      find:"          opts:['1/2', '1/9', '4', '1/4'], ans:3,\n          why:'整圈是 360 度",
      replace:"          opts:['1/2', '1/9', '3', '1/4'], ans:3,\n          why:'整圈是 360 度",
      why:'an option would stop matching the pinned oracle' },

    /* --- 跨頁用詞、禁用詞、交給別課的詞 --- */
    { file:'index', via:'index', expect:'which states the misconception as a fact',
      find:'data-i18n="s4note">💬 <strong>扇形的周長 ＝ 弧長 ＋ 半徑 × 2</strong>。⚠️ 半圓也一樣',
      replace:'data-i18n="s4note">💬 <strong>扇形的周長就是弧長</strong>。⚠️ 半圓也一樣',
      why:'the lesson page would state the misconception as if it were the rule' },
    { file:'index', via:'index', expect:'writes a power',
      find:'data-i18n="s3note">💬 寫成一條就是：<strong>扇形面積 ＝ 半徑 × 半徑 × 3.14 × 圓心角 ÷ 360</strong>。',
      replace:'data-i18n="s3note">💬 寫成一條就是：<strong>扇形面積 ＝ 半徑² × 3.14 × 圓心角 ÷ 360</strong>。',
      why:'a power would appear in a lesson that spells the multiplication out' },
    { file:'index', via:'index', expect:'without saying which lesson it belongs to',
      find:'data-i18n="scopeNote">這一課只做五件事：認得<strong>扇形</strong>',
      replace:'data-i18n="scopeNote">弓形、圓柱、複合圖形也很好玩。這一課只做五件事：認得<strong>扇形</strong>',
      why:'the page would mention topics it does not teach without saying they belong to a later lesson' },
    { file:'index', via:'index', expect:'says "圓心角 ÷ 360"',
      find:'data-i18n="s1note">💬 <strong>扇形有三個零件</strong>：頂點在圓心的<strong>圓心角</strong>、<strong>兩條半徑</strong>、還有半徑之間的那<strong>一段弧</strong>。⚠️ 同樣兩條半徑會切出<strong>兩片</strong>扇形（剛好 180 度的時候兩片一樣大，其他角度一大一小），所以<strong>圓心角要沿著你要的那一片量</strong>：大的那一片，圓心角就<strong>超過 180 度</strong>（像 270 度那一片）。⚠️ 算周長的時候只走<strong>邊</strong>：一段弧和兩條半徑 —— 圓心角是角度，不是長度。⚠️ 「幾分之幾」是<strong>圓心角 ÷ 360</strong>，',
      replace:'data-i18n="s1note">💬 <strong>扇形有三個零件</strong>：頂點在圓心的<strong>圓心角</strong>、<strong>兩條半徑</strong>、還有半徑之間的那<strong>一段弧</strong>。⚠️ 同樣兩條半徑會切出<strong>兩片</strong>扇形（剛好 180 度的時候兩片一樣大，其他角度一大一小），所以<strong>圓心角要沿著你要的那一片量</strong>：大的那一片，圓心角就<strong>超過 180 度</strong>（像 270 度那一片）。⚠️ 算周長的時候只走<strong>邊</strong>：一段弧和兩條半徑 —— 圓心角是角度，不是長度。⚠️ 「幾分之幾」是<strong>那個角除以整圈</strong>，',
      why:'the lesson would stop spelling out, in the words the other three pages use, the rule the whole lesson rests on' },

    /* --- plan → DOM 的接線 --- */
    { file:'index', via:'index', expect:'expected at least 1',
      find:"      else if (p.k === 'path') svg.appendChild(svgEl('path', { d:p.d, fill:p.fill, stroke:p.stroke, 'stroke-width':p.sw }));",
      replace:"      else if (p.k === 'nothing') svg.appendChild(svgEl('path', { d:p.d, fill:p.fill, stroke:p.stroke, 'stroke-width':p.sw }));",
      why:'every wedge and every highlighted arc would silently stop being drawn, leaving the circle outline alone' },
    { file:'index', via:'index', expect:'expected at most 1',
      find:'    drawPlan(s1fig, pl, d.s1labelA(n), d.s1labelB(n));',
      replace:'    drawPlan(s1fig, pl, d.s1labelA(n), d.s1labelB(n));\n    drawPlan(s1fig, pl, d.s1labelA(n), d.s1labelB(n));',
      why:'the first figure would be drawn twice, which is how a second uncontrolled drawing path would look' },

    /* --- 複習頁：抽樣池與產生器 --- */
    { file:'review', via:'index', expect:'the angle pool is',
      find:'  var POOL_ANG = [30, 45, 60, 90, 120, 135, 180, 240, 270, 300];',
      replace:'  var POOL_ANG = [30, 45, 60, 90, 120, 135, 180, 240, 270];',
      why:'one of this lesson’s ten angles would quietly stop being asked about' },
    /* ⚠️ 這一筆會先被**產生器的不變條件**擋下來（訊息就是下面那一句）；
       設定檔另外還有一條「池子必須是 3 ~ 12」的斷言，兩條看的是同一件事。 */
    { file:'review', via:'review', expect:'r=2 is outside 3..12',
      find:'  (function(){ for (var r = 3; r <= R_MAX; r++) POOL_R_WHOLE.push(r); })();',
      replace:'  (function(){ for (var r = 2; r <= R_MAX; r++) POOL_R_WHOLE.push(r); })();',
      why:'radius 2, where a circumference and an area print the same number, would come back into the interleaved question' },
    { file:'review', via:'review', expect:'is not a whole number of degrees',
      find:"        if (tokUnit(c) === 'deg' && (v % 100 !== 0 || v > FULL_DEG * 100)) return;",
      replace:"        if (tokUnit(c) === 'deg' && v > FULL_DEG * 100) return;",
      why:'half a degree could be offered as an angle in a lesson whose angles are all whole' },
    { file:'review', via:'review', expect:'the "whole circumference" distractor is missing',
      find:"        var cands = [tok(circH(r), 'cm'), tok(secAreaH(r, n), 'sq'), tok(2 * r * 100, 'cm')];",
      replace:"        var cands = [tok(perimH(r, n), 'cm'), tok(secAreaH(r, n), 'sq'), tok(2 * r * 100, 'cm')];",
      why:'the arc question would lose the distractor for a child who answers the whole circumference' },
    { file:'review', via:'review', expect:'the "arc only, radiuses forgotten" distractor is missing',
      find:"        var cands = [tok(arcH(r, n), 'cm'), tok(secAreaH(r, n), 'sq'), tok(circH(r), 'cm')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(perimH(r, n), 'cm')",
      replace:"        var cands = [tok(2 * arcH(r, n), 'cm'), tok(secAreaH(r, n), 'sq'), tok(circH(r), 'cm')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(perimH(r, n), 'cm')",
      why:'the perimeter question would lose the one distractor that catches the mistake this lesson is about' },
    { file:'review', via:'index', expect:'is not the pinned false sentence',
      find:"    angleTimes:  { truth:false, zh:'圓心角變成 2 倍，扇形面積會變成 4 倍', en:'Doubling the angle makes the sector’s area 4 times as big' }",
      replace:"    angleTimes:  { truth:true, zh:'圓心角變成 2 倍，扇形面積會變成 4 倍', en:'Doubling the angle makes the sector’s area 4 times as big' }",
      why:'a false sentence would be declared true, so the “only one is true” question would have two' },
    { file:'review', via:'index', expect:'is not the pinned wording',
      find:"      lawn:  { what:'扇形的草地', ask:'<strong>整片</strong>都要鋪滿草皮，需要多少草皮？' },",
      replace:"      lawn:  { what:'扇形的草地', ask:'<strong>邊緣</strong>都要鋪滿草皮，需要多少草皮？' },",
      why:'an area word problem would start describing an edge, so the answer would no longer follow from the question' },
    /* --- 第二輪 codex 之後補上的四條斷言，各自配一筆改壞測試 --- */
    { file:'index', via:'index', expect:'round 3 figure',
      find:"    if (rd.kind === 'perim') return planSector(rd.r, rd.n, 'perim');",
      replace:"    if (rd.kind === 'perim') return planSector(rd.r, rd.n, 'arc');",
      why:'the perimeter round would highlight only the arc, so the picture would show the very mistake the question is testing — and every drawing would still be valid' },
    { file:'index', via:'index', expect:'the reference rebuilds',
      find:"      s1labelB:function(n){ return '整個圓的 ' + fracText(n); },",
      replace:"      s1labelB:function(n){ return '整個圓的一部分'; },",
      why:'the label under the fraction picture would stop naming the share, while every coordinate check stayed green' },
    { file:'index', via:'index', expect:'the reference says false',
      find:'  function okPair(r, n){ return arcH(r, n) !== null && secAreaH(r, n) !== null; }',
      replace:'  function okPair(r, n){ return true; }',
      why:'a pair whose arc does not divide exactly would be declared usable' },
    { file:'review', via:'index', expect:'the whole-circle radius pool is',
      find:'  (function(){ for (var r = 3; r <= R_MAX; r++) POOL_R_WHOLE.push(r); })();',
      replace:'  (function(){ for (var r = 4; r <= R_MAX; r++) POOL_R_WHOLE.push(r); })();',
      why:'one radius would quietly drop out of the interleaved whole-circle question' },
    { file:'review', via:'index', expect:'the fill-the-slice scenarios are',
      find:"  var AREA_IDS = ['lawn', 'cheese', 'sign'];",
      replace:"  var AREA_IDS = ['lawn', 'cheese'];",
      why:'one of the area scenarios would drop out without anything saying so' },
    { file:'review', via:'review', expect:'the marked option is not',
      find:"        var correct = tok(perimH(r, n), 'cm');\n        var cands = [tok(arcH(r, n), 'cm')",
      replace:"        var correct = tok(circH(r), 'cm');\n        var cands = [tok(arcH(r, n), 'cm')",
      why:'the perimeter question would mark the whole circumference as its answer' },
    { file:'review', via:'review', expect:'copies a number the stem prints',
      find:"        var cands = [tok(circH(r), 'cm'), tok(secAreaH(r, n), 'sq'), tok(2 * r * 100, 'cm')];\n        var wrongs = pickWrongs(correct, cands, nearFallbacks(arcH(r, n), 'cm'), [tok(r * 100, 'cm'), tok(n * 100, 'cm')]);\n        var o = optsOf(correct, wrongs);\n        return { r:r, n:n, opts:o.opts, ans:o.ans };\n      },\n      fmt:function(d, lang){\n        var c = circH(d.r), a = arcH(d.r, d.n), f = fracOf(d.n);",
      replace:"        var cands = [tok(circH(r), 'cm'), tok(secAreaH(r, n), 'sq')];\n        var wrongs = pickWrongs(correct, cands, [tok(r * 100, 'cm')], []);\n        var o = optsOf(correct, wrongs);\n        return { r:r, n:n, opts:o.opts, ans:o.ans };\n      },\n      fmt:function(d, lang){\n        var c = circH(d.r), a = arcH(d.r, d.n), f = fracOf(d.n);",
      why:'the radius printed in the stem would be offered back as a distractor, so a child could rule it out without doing any work' },
    { file:'review', via:'review', expect:'the rendered stem is not the rebuilt sentence',
      find:"          stem: lang === 'zh' ? '一個扇形的<strong>圓心角</strong>是 <strong>' + d.n + ' 度</strong>，它是整個圓的幾分之幾？'",
      replace:"          stem: lang === 'zh' ? '一個扇形的<strong>圓心角</strong>是 <strong>' + d.n + ' 度</strong>，它是整個圓的幾倍？'",
      why:'the question would ask for a multiple while the answer is still a share' },
    { file:'review', via:'review', expect:'this claim is wrong',
      find:"            ? '整圈是 360 度，所以這一片占 ' + d.n + ' ÷ 360。上下同時除以 ' + g + '：' + d.n + ' ÷ ' + g + ' ＝ ' + f.p + '，360 ÷ ' + g + ' ＝ ' + f.q",
      replace:"            ? '整圈是 360 度，所以這一片占 ' + d.n + ' ÷ 360。上下同時除以 ' + g + '：' + d.n + ' ÷ ' + g + ' ＝ ' + f.p + '，360 ÷ ' + g + ' ＝ ' + (f.q + 1)",
      why:'the cancelling step in the explanation would state a denominator the division does not give' },
    { file:'review', via:'review', expect:'the "read the bottom of the fraction as the angle" distractor is missing',
      find:"        var cands = [tok(f.q * 100, 'deg'), tok((FULL_DEG - n) * 100, 'deg'), tok(2 * n * 100, 'deg')];",
      replace:"        var cands = [tok((FULL_DEG - n) * 100, 'deg'), tok(2 * n * 100, 'deg')];",
      why:'the reverse question would lose its deliberate misconception distractor, the one that reads the bottom of the fraction as an angle' },
    { file:'review', via:'review', expect:'a whole-circle question offered an angle',
      find:"        var cands = wantArea\n          ? [tok(circH(r), 'cm'), tok(r * PI_H, 'sq'), tok(4 * areaH(r), 'sq')]",
      replace:"        var cands = wantArea\n          ? [tok(9000, 'deg'), tok(r * PI_H, 'sq'), tok(4 * areaH(r), 'sq')]",
      why:'the whole-circle question, which has no angle at all, would offer one as an option' }
  ]
};
