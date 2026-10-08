/* grade-4/math/cubes —— 方塊盤點站（體積初步：1 立方公分、數方塊、看不到的也要數、比體積）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作：
 *
 * 1) 一堆方塊有幾塊、每一格幾塊、每一層幾塊。課程頁從高度圖直接加；這裡把高度圖先展成
 *    一塊一塊的座標清單再分別數（用另一條路走到同一個數字）。
 * 2) 看得到幾塊。課程頁用「畫的順序 ＋ 取樣點蓋過去」（painter）；這裡用**射線**：每一個取樣點
 *    往螢幕裡面射一條線，第一塊碰到的方塊才看得到。兩個算法都是精確的（面的頂點都在 1/2 格點上，
 *    取樣點刻意避開所有的邊），所以每一堆的答案必須**完全一樣**。
 *    ⚠️ 取樣點的偏移在這裡是 (i ＋ 0.5)/8、(j ＋ 0.25)/8，和課程頁的 (i ＋ 0.5)/4、(j ＋ 0.25)/4 不一樣，
 *    才不會兩邊「剛好一起漏掉同一個角」。
 * 3) 投影。u ＝ c ＋ DEPTH·b、v ＝ h ＋ DEPTH·b；畫布 X ＝ X0 ＋ u·unit、Y ＝ Y0 － v·unit。
 *    每一張圖的每一個面的每一個頂點都要對得上，而且整堆要在畫布裡（四個邊）。
 * 4) 版面。兩堆並排時中間至少空一格；「哪一堆」的四堆各在自己的欄位裡。
 *
 * ⚠️ 這一課教的規則有前提，設定檔必須分開驗：
 *    - 「看不到的也要數」的前提是**方塊不會浮在空中**（高度圖本身就保證了這一點）；
 *      範例 2 的每一組都要真的至少藏一塊，不然那一段什麼都沒示範。
 *    - 「比體積就是比塊數」旁邊要有「高的不一定大」；範例 4 必須真的有一組「高的比較小」。
 *    - 「分層數」是**加**：每一層的塊數只會一樣或更少（layers 非遞增）。
 *    - 公式（長 × 寬 × 高）、容積、立方公尺、表面積每一次出現都要在指定的年級旁邊（HANDOFF）。
 * ⚠️ 圖上只有 path／line（＋一個 g 群組）—— **沒有任何文字**；高度圖用 HTML 畫。
 *    速查卡與家長頁沒有 SVG。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const FIG_W_REF = 460, FIG_H_REF = 300;
const U_REF = 30, DEPTH_REF = 0.5;
const MINI_U_REF = 14, MINI_W_REF = 80, MINI_H_REF = 84;
const WHICH_U_REF = 24, WHICH_CX_REF = [0.125, 0.375, 0.625, 0.875], WHICH_TONES_REF = ['c', 'd', 'e', 'a'];
const PAIR_CX_A_REF = 0.27, PAIR_CX_B_REF = 0.73;
const MAX_SIDE_REF = 4, MAX_HEIGHT_REF = 4, MAX_CUBES_REF = 40;
const MARGIN_REF = 8;             // 畫布四個邊至少留這麼多
const RASTER_REF = 8;             // 參考實作的取樣密度（和課程頁的 4 不一樣）
const LEN_MIN_REF = 3, LEN_MAX_REF = 9;
/* 方塊庫的第二份（高度圖，最後面那一排寫在最前面）。 */
const STACKS_REF = {
  one:    [[1]], row3:[[1, 1, 1]], tower3:[[3]], sq4:[[1, 1], [1, 1]], L4:[[2, 1], [1, 0]],
  box8:   [[2, 2], [2, 2]], hill7:[[3, 2], [1, 1]], ridge10:[[2, 3, 2], [1, 1, 1]], cube12:[[3, 3], [3, 3]],
  step8:  [[2, 1, 0], [2, 2, 1]], twist7:[[2, 3], [1, 1]], peak7:[[4, 2], [1, 0]],
  tower4: [[4]], flat6:[[1, 1, 1], [1, 1, 1]], block7:[[2, 2], [2, 1]], row4:[[1, 1, 1, 1]],
};
const S1_REF = ['one', 'row3', 'tower3', 'sq4', 'L4'];
const S2_REF = ['box8', 'hill7', 'ridge10', 'cube12'];
const S3_REF = ['hill7', 'step8', 'twist7', 'peak7'];
const S4_REF = [['tallSame', 'tower4', 'sq4'], ['tallLess', 'tower3', 'sq4'], ['wideLess', 'block7', 'flat6'], ['rearrange', 'L4', 'row4']];
const COMPARE_KEYS_REF = ['aBigger', 'bBigger', 'same', 'measure'];
const UNIT_KEYS_REF = ['cube1', 'square1', 'line1', 'cubeK'];
const SOLID_REF = { face:6, edge:12, vertex:8 };
/* 驗算器在 data.check 跑完之後應該驗過的算式條數與指紋（裝上去的時候用實測值填）。 */
const VERIFIED_REF = 64;
const FINGERPRINT_REF = '37fb2b7b8866245f733dc5d59593f16e088d281e';

/* ---------- 1) 參考實作：塊數、每格、每層 ---------- */
function intGrid(H){
  return Array.isArray(H) && H.length >= 1 && H.every(row => Array.isArray(row) && row.length === H[0].length && row.length >= 1 &&
    row.every(x => Number.isInteger(x) && x >= 0));
}
/* 展成一塊一塊：c ＝ 左起第幾格、h ＝ 第幾層（0 起）、b ＝ 往後第幾排（0 ＝ 最前排）。 */
function cubeListRef(H){
  const out = [], R = H.length;
  for (let r = 0; r < R; r++) for (let c = 0; c < H[r].length; c++) for (let h = 0; h < H[r][c]; h++) out.push({ c, h, b:R - 1 - r });
  return out;
}
function volumeRef(H){ return cubeListRef(H).length; }
function footprintRef(H){ return new Set(cubeListRef(H).map(k => k.c + ',' + k.b)).size; }
function cellsRef(H){ const out = []; H.forEach(row => row.forEach(x => { if (x > 0) out.push(x); })); return out; }
function layersRef(H){
  const cubes = cubeListRef(H), out = [];
  for (let L = 0; ; L++){ const n = cubes.filter(k => k.h === L).length; if (!n) break; out.push(n); }
  return out;
}
function maxHRef(H){ let m = 0; H.forEach(row => row.forEach(x => { if (x > m) m = x; })); return m; }
function extentRef(H){ return { w:H[0].length + DEPTH_REF * H.length, h:maxHRef(H) + DEPTH_REF * H.length }; }
function validRef(H){
  return intGrid(H) && H.length <= MAX_SIDE_REF && H[0].length <= MAX_SIDE_REF && maxHRef(H) <= MAX_HEIGHT_REF &&
         volumeRef(H) >= 1 && volumeRef(H) <= MAX_CUBES_REF;
}

/* ---------- 2) 參考實作：射線法算看得到幾塊 ----------
   取樣點 (u, v)。3D 點 (x, y, t) 投影到 u ＝ x ＋ DEPTH·t、v ＝ y ＋ DEPTH·t（t ＝ 往後第幾排，實數）。
   固定 (u, v)，t 從 －∞（觀察者這一邊）往裡面走，第一塊碰到的方塊看得到。 */
function visibleSetRef(H){
  const cubes = cubeListRef(H), ex = extentRef(H);
  const nu = Math.ceil(ex.w * RASTER_REF), nv = Math.ceil(ex.h * RASTER_REF);
  const seen = new Set();
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++){
    const u = (i + 0.5) / RASTER_REF, v = (j + 0.25) / RASTER_REF;
    let best = null, bestT = Infinity;
    cubes.forEach(k => {
      /* c ≤ u － DEPTH·t ≤ c ＋ 1  ⇔  (u － c － 1)/DEPTH ≤ t ≤ (u － c)/DEPTH，y 同理，t 又在 [b, b ＋ 1]。 */
      const lo = Math.max((u - k.c - 1) / DEPTH_REF, (v - k.h - 1) / DEPTH_REF, k.b);
      const hi = Math.min((u - k.c) / DEPTH_REF, (v - k.h) / DEPTH_REF, k.b + 1);
      if (lo < hi - 1e-12 && lo < bestT){ bestT = lo; best = k; }
    });
    if (best) seen.add(best.c + ',' + best.h + ',' + best.b);
  }
  return seen;
}
function visibleCountRef(H){ return visibleSetRef(H).size; }
function hiddenRef(H){ return volumeRef(H) - visibleCountRef(H); }
/* 每一格最上面那一塊都看得到：圖裡的每一堆都要滿足，不然一整格藏在後面，孩子從圖上數不出來。 */
function allTopsVisibleRef(H){
  const vis = visibleSetRef(H), R = H.length;
  for (let r = 0; r < R; r++) for (let c = 0; c < H[r].length; c++) if (H[r][c] > 0 && !vis.has(c + ',' + (H[r][c] - 1) + ',' + (R - 1 - r))) return false;
  return true;
}
/* 畫布座標。 */
function projRef(c, h, b, X0, Y0, unit){ return { x:X0 + (c + DEPTH_REF * b) * unit, y:Y0 - (h + DEPTH_REF * b) * unit }; }
function facesRef(k, X0, Y0, unit){
  const P = (x, y, t) => projRef(x, y, t, X0, Y0, unit), c = k.c, h = k.h, b = k.b;
  return {
    top:  [P(c, h + 1, b), P(c + 1, h + 1, b), P(c + 1, h + 1, b + 1), P(c, h + 1, b + 1)],
    front:[P(c, h, b), P(c + 1, h, b), P(c + 1, h + 1, b), P(c, h + 1, b)],
    right:[P(c + 1, h, b), P(c + 1, h, b + 1), P(c + 1, h + 1, b + 1), P(c + 1, h + 1, b)]
  };
}
function singleOriginRef(H, unit, W, Hh){ const e = extentRef(H); return { X0:(W - e.w * unit) / 2, Y0:(Hh + e.h * unit) / 2 }; }
function pairOriginsRef(HA, HB){
  const ea = extentRef(HA), eb = extentRef(HB), tall = Math.max(ea.h, eb.h), Y0 = (FIG_H_REF + tall * U_REF) / 2;
  return { A:{ X0:FIG_W_REF * PAIR_CX_A_REF - ea.w * U_REF / 2, Y0 }, B:{ X0:FIG_W_REF * PAIR_CX_B_REF - eb.w * U_REF / 2, Y0 } };
}
function whichOriginsRef(Hs){
  let tall = 0; Hs.forEach(H => { tall = Math.max(tall, extentRef(H).h); });
  const Y0 = (FIG_H_REF + tall * WHICH_U_REF) / 2;
  return Hs.map((H, i) => ({ X0:FIG_W_REF * WHICH_CX_REF[i] - extentRef(H).w * WHICH_U_REF / 2, Y0 }));
}
function samePt(p, q){ return Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9; }
function inCanvas(q, w, h, margin){ return Number.isFinite(q.x) && Number.isFinite(q.y) && q.x >= margin && q.y >= margin && q.x <= w - margin && q.y <= h - margin; }
function eqJ(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
/* 畫布上一堆的外框（用參考投影算）。 */
function boxRef(H, X0, Y0, unit){ const e = extentRef(H); return { x:X0, y:Y0 - e.h * unit, w:e.w * unit, h:e.h * unit }; }
/* 固定亂數（設定檔自己的，不吃 SIMGEN_SEED）：用來造幾百堆隨機的高度圖比對兩種可見性算法。 */
function lcg(seed){ let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
function randomStacksRef(n, seed){
  const rnd = lcg(seed), out = [];
  while (out.length < n){
    const R = 1 + Math.floor(rnd() * 4), C = 1 + Math.floor(rnd() * 4), H = [];
    for (let r = 0; r < R; r++){ H.push([]); for (let c = 0; c < C; c++) H[r].push(Math.floor(rnd() * 5)); }
    if (validRef(H)) out.push(H);
  }
  return out;
}
/* 所有 2 × 2、每格 0~3 的高度圖（256 － 1 堆）。 */
function all2x2Ref(){
  const out = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = 0; d < 4; d++){
    const H = [[a, b], [c, d]];
    if (validRef(H)) out.push(H);
  }
  return out;
}

/* ---------- 3) 算式逐條驗算（全站共用的那一份） ---------- */
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['塊', '立方公分', '平方公分', '公分', '層', '格', '個', '題', '排', '柱', '顆'],
  unitsEn: ['cubes?', 'cubic centimetres?', 'square centimetres?', 'cm', 'layers?', 'squares?', 'seen', 'hidden', 'faces', 'edges', 'vertices']
});

/* ---------- 4) 題庫的第二套答案 ---------- */
const BANK_EXPECTED = {
  qs: [
    { expect:{ zh:'一個東西占了多大的空間', en:'How much space something takes up' }, ask:{ zh:'體積</strong>是什麼', en:'What is <strong>volume' } },
    { expect:{ zh:'邊長 1 公分的正方體', en:'A cube with 1 cm edges' }, ask:{ zh:'1 立方公分</strong>是什麼的體積', en:'1 cubic centimetre</strong> is the volume of what' } },
    { expect:{ zh:'7 立方公分', en:'7 cubic centimetres' }, ask:{ zh:'體積是幾立方公分', en:'What is the volume of this pile' }, fig:'q3' },
    { expect:{ zh:'1 塊', en:'1 cube' }, ask:{ zh:'有幾塊看不到', en:'how many cubes cannot be seen' }, fig:'q4' },
    { expect:{ zh:'一樣大', en:'The same volume' }, ask:{ zh:'誰的體積比較大', en:'Which has the bigger volume' } },
    { expect:{ zh:'12 立方公分，沒有變', en:'12 cubic centimetres, unchanged' }, ask:{ zh:'搬完之後體積是多少', en:'What is the volume afterwards' } }
  ],
  qsAdv: [
    { expect:{ zh:'21 立方公分', en:'21 cubic centimetres' }, ask:{ zh:'現在的體積是多少', en:'What is the volume now' } },
    { expect:{ zh:'9 立方公分', en:'9 cubic centimetres' }, ask:{ zh:'這一堆的體積是多少', en:'What is the volume of the pile' } },
    { expect:{ zh:'乙，乙有 8 塊，甲只有 4 塊', en:'B: B has 8 cubes and A has only 4' }, ask:{ zh:'誰的體積比較大', en:'Which has the bigger volume' } },
    { expect:{ zh:'9 立方公分', en:'9 cubic centimetres' }, ask:{ zh:'這一堆的體積是多少', en:'What is its volume' } }
  ],
  qsBoost: [
    { expect:{ zh:'看不到的方塊也要數：上面有方塊的地方，下面每一層都有，一共是 9 塊', en:'Hidden cubes count too: wherever there is a cube on top, every layer below is filled, so there are 9 cubes' }, ask:{ zh:'他錯在哪裡', en:'What has she got wrong' } },
    { expect:{ zh:'比體積要比塊數，高的不一定塊數多', en:'Comparing volumes means comparing the number of cubes, and the taller pile does not necessarily have more' }, ask:{ zh:'他錯在哪裡', en:'What has he got wrong' } }
  ]
};

/* ---------- 5) 四頁一起釘的措辭 ----------
   ⚠️ min 要寫**當下真實的出現次數**，不是「至少 1」（裝上去時用實測值填）。 */
const SIBLING_RULES = [
  { text:'看不到的方塊也要數', files:{ index:8, reference:6, review:1 } },
  { text:'上面有方塊的地方，下面每一層都有', files:{ index:9, reference:5, review:1, parents:4 } },
  { text:'比體積就是比塊數', files:{ index:5, reference:8, review:2, parents:2 } },
  { text:'不會浮在空中', files:{ index:7, reference:3, parents:2 } },
  { text:'幾塊就是幾立方公分', files:{ index:4, reference:2, parents:2 } },
  { text:'邊長 1 公分的正方體', files:{ index:8, reference:9, review:2, parents:4 } },
  { text:'不一定比較大', files:{ index:6 } },
  { text:'高的不一定大', files:{ index:7, reference:5, review:3, parents:4 } }
];
const SIBLING_RULES_EN = [
  { text:'idden cubes count too', files:{ index:8, reference:5, review:1, parents:3 } },
  { text:'every layer below', files:{ index:6, reference:3, review:1, parents:3 } },
  { text:'omparing volumes means comparing', files:{ index:4, reference:4, review:2, parents:1 } },
  { text:'never float', files:{ index:5, reference:2, parents:1 } },
  { text:'cube with 1 cm edges', files:{ index:5, reference:5, review:2, parents:1 } },
  /* review.html 的英文用的是 'taller does not mean bigger'（釘在 renderCheck 裡：每一題該說的時候都要說），所以這裡它是 0。 */
  { text:'not always bigger', files:{ index:2, reference:2, parents:1 } }
];
/* 一個字都不可以出現的句子（都是假話，連當誘答都不可以）。 */
const FORBIDDEN = [
  '高的一定大', '高的一定比較大', '越高體積越大', '體積 ＝ 長 × 寬 × 高', '長 × 寬 × 高 ＝ 體積',
  '看得到幾塊就是幾立方公分', '一格代表 1 立方公分的正方形',
  'hidden cubes do not count', 'taller is always bigger', 'the taller pile is always bigger', 'volume = length × width × height', 'length × width × height = volume'
];
/* 交出去的詞每一頁出現幾次（裝上去時用實測值填）。 */
const HANDOFF_COUNTS = [
  { word:'公式', files:{ index:2, reference:2, parents:6 } }, { word:'容積', files:{ index:2, reference:2, parents:2 } }, { word:'立方公尺', files:{ index:2, reference:2, parents:2 } }, { word:'表面積', files:{ index:2, reference:2, parents:4 } },
  { word:'formula', files:{ index:1, reference:1, parents:3 } }, { word:'capacity', files:{ index:1, reference:1, parents:1 } }, { word:'cubic metre', files:{ index:1, reference:1, parents:1 } }, { word:'surface area', files:{ index:1, reference:1, parents:2 } }
];
/* 交給別的年級的詞：每一次出現都必須在指定的字眼附近。 */
const HANDOFF_RULES = [
  { word:'公式', near:['五年級'], span:70 },
  { word:'容積', near:['五年級'], span:60 },
  { word:'立方公尺', near:['五年級'], span:30 },
  { word:'表面積', near:['六年級'], span:30 },
  { word:'長 × 寬 × 高', near:['五年級'], span:70 },
  { word:'formula', near:['grade 5', 'grade-5'], span:110 },
  { word:'capacity', near:['grade 5', 'grade-5'], span:90 },
  { word:'cubic metre', near:['grade 5', 'grade-5'], span:50 },
  { word:'surface area', near:['grade 6', 'grade-6'], span:50 },
  { word:'length × width × height', near:['grade 5', 'grade-5'], span:110 }
];
/* 規則必須住在指定的字典鍵裡。 */
const KEY_RULES = [
  { file:'index', key:'s1note', must:['占了多大的空間', '有幾塊，體積就是幾立方公分', '塊數一樣，體積就一樣'] },
  { file:'index', key:'s2note', must:['不會浮在空中', '上面有方塊的地方，下面每一層都有方塊', '高度圖'] },
  { file:'index', key:'s3note', must:['同一堆方塊', '一樣或更少，不會更多'] },
  { file:'index', key:'s4note', must:['比體積就是比塊數', '不一定比較大', '沒有變'] },
  { file:'index', key:'scopeNote', must:['公式', '五年級', '立方公尺', '表面積', '六年級', '不會浮在空中'] },
  { file:'reference', key:'f0', must:['邊長 1 公分的正方體'] },
  { file:'reference', key:'f1', must:['看不到的方塊也要數', '不會浮在空中'] },
  { file:'reference', key:'f2', must:['每一格加起來 ＝ 每一層加起來', '不是「乘」'] },
  { file:'reference', key:'f3', must:['比體積 ＝ 比塊數'] },
  { file:'parents', key:'s1p2', must:['五年級', '公式', '正上方'] }
];
const KEY_RULES_EN = [
  { file:'index', key:'s1note', must:['how much space', 'as many cubes as there are, that many cubic centimetres'] },
  { file:'index', key:'s2note', must:['never float', 'every layer below it is filled', 'height map'] },
  { file:'index', key:'s3note', must:['the same pile', 'the same number or fewer, never more'] },
  { file:'index', key:'s4note', must:['omparing volumes means comparing', 'not necessarily bigger', 'does not change'] },
  { file:'index', key:'scopeNote', must:['formula', 'grade 5', 'cubic metre', 'surface area', 'grade 6', 'never floating'] },
  { file:'reference', key:'f0', must:['cube with 1 cm edges'] },
  { file:'reference', key:'f2', must:['squares added up = the layers added up', 'not “multiply”'] },
  { file:'parents', key:'s1p2', must:['grade 5', 'formula', 'directly on top'] }
];
/* 成對出現：左邊那句話只要出現，右邊那句話就必須在同一頁（同一本字典）出現。
   ⚠️ 這一課**沒有**對應的改壞測試：三頁的字典都把限定句寫了不只一次（標題、註記、頁尾），
   單一筆 find/replace 拿不掉全部，所以這條在這裡是 SIBLING 計數之外的第二道保險，不是獨立被證明過的守衛。
   真正釘住限定句的是上面 SIBLING_RULES 對「高的不一定大」與「not always bigger」逐頁釘死的出現次數（各配一筆改壞測試）。 */
const PAIRED_RULES = [
  { rule:'比體積就是比塊數', qualifier:'高的不一定大', pages:['index', 'reference', 'parents'] },
  { rule:'omparing volumes means comparing', qualifier:'not always bigger', pages:['index', 'reference', 'parents'] },
  { rule:'搬動重', qualifier:'沒變', pages:['index', 'reference'] }
];

function zhRegion(clean){
  const a = clean.indexOf('zh: {');
  const b = clean.indexOf('en: {', a < 0 ? 0 : a);
  if (a < 0 || b < 0 || b <= a) return null;
  return clean.slice(a, b);
}
function enRegion(clean){
  const e = clean.indexOf('en: {');
  if (e < 0) return null;
  const end = clean.indexOf('\n  };', e);
  return end < 0 ? null : clean.slice(e, end);
}
function keyValues(clean, key, lang){
  const region = lang === 'en' ? enRegion(clean) : zhRegion(clean);
  if (region === null) return null;
  const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|[\\s{,])' + safeKey + "\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'", 'g');
  const out = [];
  let m;
  while ((m = re.exec(region)) !== null) out.push(m[1]);
  return out;
}
/* 拿掉註解（逐字掃描，不是正規式；換成 '\n' 不是 ''）。 */
function stripJsComments(code){
  let out = '', i = 0;
  const n = code.length;
  while (i < n){
    const c = code[i], c2 = code[i + 1];
    if (c === '/' && c2 === '/'){ while (i < n && code[i] !== '\n') i++; out += '\n'; continue; }
    if (c === '/' && c2 === '*'){ i += 2; while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++; i += 2; out += '\n'; continue; }
    if (c === '"' || c === "'" || c === '`'){
      const q = c; out += c; i++;
      while (i < n){
        if (code[i] === '\\'){ out += code[i] + (code[i + 1] || ''); i += 2; continue; }
        out += code[i];
        if (code[i] === q){ i++; break; }
        i++;
      }
      continue;
    }
    out += c; i++;
  }
  return out;
}
function stripComments(s){
  const src = String(s === null || s === undefined ? '' : s).replace(/<!--[\s\S]*?-->/g, '\n');
  return src.replace(/<script\b[\s\S]*?<\/script>/gi, block => stripJsComments(block));
}
function scannerSafe(src){
  const out = [];
  const blocks = String(src).match(/<script\b[\s\S]*?<\/script>/gi) || [];
  blocks.forEach(function(block){
    const code = stripJsComments(block);
    if (/`/.test(code)) out.push('a template literal (the comment scanner cannot follow ${} interpolation)');
    if (/[=(,:[]\s*\/(?![*/])/.test(code)) out.push('what looks like a regex literal (the comment scanner cannot follow quotes inside one)');
  });
  return out;
}
/* 措辭規則只看**讀者看得到的字**：<style> 區塊與 class 屬性不算（CSS 有一個 .formula 類別）。 */
function proseOnly(clean){ return String(clean).replace(/<style\b[\s\S]*?<\/style>/gi, '\n').replace(/\sclass="[^"]*"/g, ''); }
function countOf(hay, needle){
  let n = 0, i = 0;
  for (;;){ const k = hay.indexOf(needle, i); if (k < 0) return n; n++; i = k + needle.length; }
}
function siblingSources(){
  const dir = path.dirname(process.argv[2] || '');
  const out = {};
  ['index', 'reference', 'review', 'parents'].forEach(function(name){
    const fp = path.join(dir, name + '.html');
    out[name] = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
  });
  return out;
}
function numbersIn(s){ return (String(s).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number); }

/* ---------- 6) 渲染出來的字串該長什麼樣 ---------- */
function textProblems(s, lang, label){
  const out = [];
  const shown = String(s).replace(/<\/?[A-Za-z][^>]*>/g, '');
  if (/undefined|NaN|\[object/.test(shown)) out.push(label + ': undefined/NaN in "' + shown.slice(0, 60) + '"');
  if (lang === 'zh'){
    const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) out.push(label + ': missing space between Chinese and a digit: ' + [...new Set(glued)].join(' '));
  } else {
    const bad = shown.match(/\b1 (?:cube|layer|square|centimetre|pile|block|face|edge|vertex|side|row|column|step)s\b|\b1 (?:cubic|square) centimetres\b|\b1 \w+ are\b|\b1 more are\b/g);
    if (bad) out.push(label + ': bad english singular: ' + [...new Set(bad)].join(' '));
    if (/[一-鿿]/.test(shown)) out.push(label + ': Chinese characters in English text: "' + shown.slice(0, 60) + '"');
  }
  const dbl = shown.match(/(?<!\.)\.\.(?!\.)|。。|，，|！！|？？/);
  if (dbl) out.push(label + ': doubled punctuation "' + dbl[0] + '"');
  return out;
}

/* ---------- 7) review.html 的文字真值表（第二份） ---------- */
const TXT_REF = {
  zh: {
    vol:n => n + ' 立方公分', cubes:n => n + ' 塊', sqcm:n => n + ' 平方公分',
    compareOpt:{ aBigger:'甲的體積比較大', bBigger:'乙的體積比較大', same:'一樣大', measure:'比不出來，要用尺量' },
    colorName:{ c:'綠色的', d:'紫色的', e:'紅色的', a:'橘色的' },
    unitOpt:{ cube1:'邊長 1 公分的正方體', square1:'邊長 1 公分的正方形', line1:'1 公分長的線段', cubeK:k => '邊長 ' + k + ' 公分的正方體' },
    solidPart:{ face:'面', edge:'邊', vertex:'頂點' },
    count:n => n + ' 個'
  },
  en: {
    vol:n => n + ' cubic ' + (n === 1 ? 'centimetre' : 'centimetres'), cubes:n => n + ' ' + (n === 1 ? 'cube' : 'cubes'),
    sqcm:n => n + ' square ' + (n === 1 ? 'centimetre' : 'centimetres'),
    compareOpt:{ aBigger:'A has the bigger volume', bBigger:'B has the bigger volume', same:'The same volume', measure:'Cannot tell without a ruler' },
    colorName:{ c:'the green one', d:'the purple one', e:'the red one', a:'the orange one' },
    unitOpt:{ cube1:'A cube with 1 cm edges', square1:'A square with 1 cm sides', line1:'A line 1 cm long', cubeK:k => 'A cube with ' + k + ' cm edges' },
    solidPart:{ face:'faces', edge:'edges', vertex:'vertices' },
    count:n => String(n)
  }
};
/* 十二題的題幹，**整句重建**（第二份）。子字串釘不死題幹，整句才釘得死。 */
const STEM_EXACT = {
  countStack:d => ({ zh:'這一堆方塊每一塊都是 1 立方公分。它的體積是幾立方公分？（看不到的方塊也要數）',
                     en:'Every cube in this pile is 1 cubic centimetre. What is the volume of the pile, in cubic centimetres? (Hidden cubes count too.)' }),
  hiddenCount:d => ({ zh:'這一堆方塊一共 ' + volumeRef(d.H) + ' 塊。從這個方向看，<strong>有幾塊看不到</strong>？',
                      en:'This pile has ' + volumeRef(d.H) + ' cubes in all. Looking from this side, <strong>how many cubes cannot be seen</strong>?' }),
  heightMap:d => ({ zh:'下面是一堆 1 立方公分方塊的<strong>高度圖</strong>（從上面看，每一格寫著疊幾塊，空格沒有方塊）。這一堆的體積是幾立方公分？',
                    en:'Below is the <strong>height map</strong> of a pile of 1 cubic centimetre cubes (seen from above, each square says how many cubes are stacked there; a blank square has none). What is the volume of the pile, in cubic centimetres?' }),
  compareTwo:d => ({ zh:'左邊橘色是甲、右邊藍色是乙，每一塊都是 1 立方公分。<strong>誰的體積比較大？</strong>',
                     en:'Orange on the left is A and blue on the right is B; every cube is 1 cubic centimetre. <strong>Which has the bigger volume?</strong>' }),
  towerFlat:d => ({ zh:'甲是 <strong>' + d.a + ' 塊</strong>疊成一柱，乙是 <strong>' + d.b + ' 塊</strong>平鋪成一層，方塊都一樣大。誰的體積比較大？',
                    en:'A is <strong>' + d.a + ' cubes</strong> stacked in a tower; B is <strong>' + d.b + ' cubes</strong> laid flat in one layer; all the cubes are the same size. Which has the bigger volume?' }),
  rearrange:d => ({ zh:'一堆 1 立方公分的方塊有 <strong>' + d.n + ' 塊</strong>，疊成 ' + d.a + ' 層。把它<strong>全部搬動重新排</strong>成 ' + d.b + ' 層（一塊都沒有多、沒有少）。搬完之後體積是幾立方公分？',
                    en:'A pile of <strong>' + d.n + ' cubes</strong>, each 1 cubic centimetre, is stacked ' + d.a + ' layers high. Every cube is <strong>moved into a new arrangement</strong> ' + d.b + ' layers high (not one cube added or taken away). What is the volume after the move, in cubic centimetres?' }),
  addRemove:d => ({ zh:'一堆 1 立方公分方塊的體積是 <strong>' + d.n + ' 立方公分</strong>。' + (d.add ? '再放上 <strong>' + d.k + ' 塊</strong>一樣的方塊' : '拿掉 <strong>' + d.k + ' 塊</strong>') + '，現在的體積是幾立方公分？',
                    en:'A pile of 1 cubic centimetre cubes has a volume of <strong>' + d.n + ' cubic centimetres</strong>. ' + (d.add ? '<strong>' + d.k + ' more</strong> identical cubes are put on' : '<strong>' + d.k + ' cubes</strong> are taken away') + '. What is the volume now, in cubic centimetres?' }),
  layersSum:d => ({ zh:'一堆 1 立方公分的方塊，' + d.layers.map((x, i) => '第 ' + (i + 1) + ' 層 <strong>' + x + ' 塊</strong>').join('、') + '。這一堆的體積是幾立方公分？',
                    en:'In a pile of 1 cubic centimetre cubes, ' + d.layers.map((x, i) => 'layer ' + (i + 1) + ' has <strong>' + x + ' ' + (x === 1 ? 'cube' : 'cubes') + '</strong>').join(', ') + '. What is the volume of the pile, in cubic centimetres?' }),
  unitCube:d => ({ zh:'<strong>1 立方公分</strong>是下面哪一個東西的體積？', en:'Which of these has a volume of <strong>1 cubic centimetre</strong>?' }),
  squareArea:d => ({ zh:'一張正方形的紙，邊長 <strong>' + d.a + ' 公分</strong>。它的面積是多少？', en:'A square sheet of paper has sides of <strong>' + d.a + ' cm</strong>. What is its area?' }),
  whichVolume:d => ({ zh:'下面四堆方塊，每一塊都是 1 立方公分。哪一堆的體積剛好是 <strong>' + d.target + ' 立方公分</strong>？',
                      en:'Every cube in the four piles below is 1 cubic centimetre. Which pile has a volume of exactly <strong>' + d.target + ' cubic centimetres</strong>?' }),
  solidParts:d => ({ zh:'一個 1 立方公分的小方塊是正方體。一個正方體有幾個<strong>' + TXT_REF.zh.solidPart[d.part] + '</strong>？',
                     en:'A 1 cubic centimetre cube is a cube. How many <strong>' + TXT_REF.en.solidPart[d.part] + '</strong> does a cube have?' })
};
const FIG_GENS = ['countStack', 'hiddenCount', 'compareTwo', 'whichVolume'];
const TABLE_GENS = ['heightMap'];
const GEN_IDS = ['countStack', 'hiddenCount', 'heightMap', 'compareTwo', 'towerFlat', 'rearrange', 'addRemove', 'layersSum', 'unitCube', 'squareArea', 'whichVolume', 'solidParts'];
/* 誘答可以抄題幹數字的情形（就是那一課明講的迷思）。 */
const STEM_ECHO_ALLOWED = {
  hiddenCount:(d, v) => v === volumeRef(d.H),          // 把「一共幾塊」當成答案
  rearrange:(d, v) => v === d.a || v === d.b,           // 把層數當成體積
  addRemove:(d, v) => v === d.n || v === d.k,           // 忘了加／忘了原來的
  layersSum:(d, v) => d.layers.indexOf(v) >= 0          // 只答其中一層
};

function isPerm(a, ref){ return Array.isArray(a) && a.length === ref.length && ref.every(k => a.indexOf(k) >= 0) && new Set(a).size === ref.length; }
function fourDistinctNums(opts){ return Array.isArray(opts) && opts.length === 4 && opts.every(v => Number.isInteger(v)) && new Set(opts).size === 4; }
/* 一堆畫出來的方塊對不對：每一塊的三個面的每一個頂點都要對上參考投影；塊數、看得到的旗標也要對。 */
function stackDrawProblems(stack, X0, Y0, unit, label){
  const out = [], H = stack.H, plan = stack.plan;
  if (!validRef(H)) return [label + ': height map is not a valid stack'];
  const cubes = cubeListRef(H), vis = visibleSetRef(H);
  if (!plan || !Array.isArray(plan.cubes)) return [label + ': no plan'];
  if (plan.cubes.length !== cubes.length) out.push(label + ': plan draws ' + plan.cubes.length + ' cubes but the height map has ' + cubes.length);
  if (plan.total !== cubes.length) out.push(label + ': plan.total is wrong');
  if (plan.visible !== vis.size) out.push(label + ': plan.visible ' + plan.visible + ' but the ray-cast reference sees ' + vis.size);
  if (plan.hidden !== cubes.length - vis.size) out.push(label + ': plan.hidden is wrong');
  const seenKeys = new Set();
  plan.cubes.forEach(function(k, i){
    const key = k.c + ',' + k.h + ',' + k.b;
    if (seenKeys.has(key)) out.push(label + ': cube ' + key + ' drawn twice');
    seenKeys.add(key);
    if (!cubes.some(q => q.c === k.c && q.h === k.h && q.b === k.b)) out.push(label + ': cube ' + key + ' is not in the height map');
    if (k.visible !== vis.has(key)) out.push(label + ': cube ' + key + ' visible flag disagrees with the ray-cast reference');
    const f = facesRef(k, X0, Y0, unit);
    ['top', 'front', 'right'].forEach(function(face){
      if (!Array.isArray(k[face]) || k[face].length !== 4){ out.push(label + ': cube ' + key + ' ' + face + ' face is not four points'); return; }
      k[face].forEach(function(p, j){
        if (!samePt(p, f[face][j])) out.push(label + ': cube ' + key + ' ' + face + ' vertex ' + j + ' is off the reference projection');
        if (!inCanvas(p, FIG_W_REF, FIG_H_REF, MARGIN_REF)) out.push(label + ': cube ' + key + ' ' + face + ' leaves the canvas');
      });
    });
    /* 畫的順序：後排先、低層先、左邊先。 */
    if (i > 0){
      const p = plan.cubes[i - 1];
      const ok = p.b > k.b || (p.b === k.b && (p.h < k.h || (p.h === k.h && p.c < k.c)));
      if (!ok) out.push(label + ': draw order broken between ' + (p.c + ',' + p.h + ',' + p.b) + ' and ' + key);
    }
  });
  const box = boxRef(H, X0, Y0, unit);
  if (!plan.box || Math.abs(plan.box.x - box.x) > 1e-9 || Math.abs(plan.box.y - box.y) > 1e-9 || Math.abs(plan.box.w - box.w) > 1e-9 || Math.abs(plan.box.h - box.h) > 1e-9) out.push(label + ': plan.box is not the reference bounding box');
  return out;
}
function figProblems(fig, label){
  const out = [];
  if (!fig) return [label + ': no figure'];
  if (fig.w !== FIG_W_REF || fig.h !== FIG_H_REF) return [label + ': figure canvas is ' + fig.w + '×' + fig.h];
  if (!Array.isArray(fig.stacks) || !fig.stacks.length) return [label + ': figure draws no stack'];
  const boxes = [];
  if (fig.kind === 'single'){
    if (fig.stacks.length !== 1) out.push(label + ': a single figure must draw one stack');
    const o = singleOriginRef(fig.stacks[0].H, U_REF, FIG_W_REF, FIG_H_REF);
    stackDrawProblems(fig.stacks[0], o.X0, o.Y0, U_REF, label).forEach(p => out.push(p));
    if (fig.stacks[0].tone !== 'a') out.push(label + ': the single stack must be orange (a)');
    boxes.push(boxRef(fig.stacks[0].H, o.X0, o.Y0, U_REF));
  } else if (fig.kind === 'pair'){
    if (fig.stacks.length !== 2) return [label + ': a pair figure must draw two stacks'];
    const o = pairOriginsRef(fig.stacks[0].H, fig.stacks[1].H);
    /* 安全性質先驗：兩堆畫出來要分開（用頁面自己回報的外框），再逐點比對投影。 */
    const pa = fig.stacks[0].plan && fig.stacks[0].plan.box, pb = fig.stacks[1].plan && fig.stacks[1].plan.box;
    if (pa && pb && pb.x - (pa.x + pa.w) < U_REF) out.push(label + ': the two stacks are less than one square apart');
    stackDrawProblems(fig.stacks[0], o.A.X0, o.A.Y0, U_REF, label + ' A').forEach(p => out.push(p));
    stackDrawProblems(fig.stacks[1], o.B.X0, o.B.Y0, U_REF, label + ' B').forEach(p => out.push(p));
    if (fig.stacks[0].tone !== 'a' || fig.stacks[1].tone !== 'b') out.push(label + ': pair tones must be a (left) and b (right)');
    boxes.push(boxRef(fig.stacks[0].H, o.A.X0, o.A.Y0, U_REF), boxRef(fig.stacks[1].H, o.B.X0, o.B.Y0, U_REF));
    if (boxes[1].x - (boxes[0].x + boxes[0].w) < U_REF) out.push(label + ': the reference layout itself puts the stacks less than one square apart');
  } else if (fig.kind === 'which'){
    if (fig.stacks.length !== 4) return [label + ': a which figure must draw four stacks'];
    const os = whichOriginsRef(fig.stacks.map(s => s.H));
    fig.stacks.forEach(function(s, i){
      stackDrawProblems(s, os[i].X0, os[i].Y0, WHICH_U_REF, label + ' stack ' + i).forEach(p => out.push(p));
      if (s.tone !== WHICH_TONES_REF[i]) out.push(label + ': stack ' + i + ' tone is ' + s.tone);
      const b = boxRef(s.H, os[i].X0, os[i].Y0, WHICH_U_REF);
      boxes.push(b);
      const lo = FIG_W_REF * (WHICH_CX_REF[i] - 0.125), hi = FIG_W_REF * (WHICH_CX_REF[i] + 0.125);
      if (b.x < lo || b.x + b.w > hi) out.push(label + ': stack ' + i + ' leaves its column');
    });
  } else return [label + ': unknown figure kind ' + fig.kind];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++){
    const a = boxes[i], b = boxes[j];
    if (!(a.x + a.w <= b.x || b.x + b.w <= a.x)) out.push(label + ': stacks ' + i + ' and ' + j + ' overlap horizontally');
  }
  const bottom = Math.max(...boxes.map(b => b.y + b.h));
  if (Math.abs(fig.floorY - (bottom + 0.5)) > 1e-9) out.push(label + ': the floor line is not just under the stacks');
  return out;
}

/* ---------- 8) 小遊戲「盤點站出任務」（2026-10-08 改成五關五種玩法，§六之五） ----------
   每一關用自己的算法（展成一塊一塊數、射線法看得到幾塊、自己的投影、自己的「最近的方框」）重算答案，
   並**照遊戲自己的規則把每一題從頭玩一次**，證明一定解得完、而且解完一定是對的；
   頁面的純函式（buildJudge／buildCells／pileOrigin／floorCells／matchDiff／matchZones／noIdentity／layerJudge／layerSlots／
   sortRank／sortTray／tapPick／tapSame）拿整個題庫去呼叫、再和自己的比；nearestOpen()、roundMiss()、roundSolved()、shuffle()
   從原始碼切出來真的跑；只在 RENDER 裡、切不出來的收／不收規則用原始碼形狀守住（need()）。每一句說明逐個比數字。
   ⚠️ 畫面要決定得了答案（LESSONS 2026-09-03）：遊戲裡畫的每一堆，除了「每一格最上面那一塊看得到」，
   還要**圖是唯一的** —— 同樣格數、每格 0～4 層的所有高度圖裡，沒有第二堆畫出一模一樣的圖（看得到的每一點是哪一個面）。
   拖拉、點選、兩根手指、capture 遺失、375px 的實際尺寸由 teaching-workspace/game-harness/g4-cubes 的端對端測試驗。 */
const { extractFunction } = require('./lib/gameshuffle.js');
const gameArith = require('./lib/arith.js').makeArith({ units:['塊', '立方公分', '層', '格'], unitsEn:['cubes?', 'cubic centimetres?', 'layers?', 'squares?'] });
/* 看得到的畫面：每一個取樣點（每格 8 × 8，偏離所有的邊）最後留在上面的是哪一個面（面的種類＋四個頂點）。
   畫的順序：後排先、低層先、左邊先；同一塊先上面、再前面、再右面 —— 後畫的蓋前畫的。 */
const IMAGE_CACHE = {};
function imageRef(H){
  const S = 8, R = H.length, C = H[0].length;
  const cubes = cubeListRef(H).sort((p, q) => (q.b - p.b) || (p.h - q.h) || (p.c - q.c));
  const W = Math.ceil((C + DEPTH_REF * R) * S) + 1, Hh = Math.ceil((MAX_HEIGHT_REF + DEPTH_REF * R) * S) + 1;
  const P = (c, h, b) => ({ u:c + DEPTH_REF * b, v:h + DEPTH_REF * b });
  const inside = (p, poly) => { let s = 0; for (let i = 0; i < 4; i++){ const a = poly[i], q = poly[(i + 1) % 4]; const cr = (q.u - a.u) * (p.v - a.v) - (q.v - a.v) * (p.u - a.u); if (cr === 0) return false; const g = cr > 0 ? 1 : -1; if (!s) s = g; else if (g !== s) return false; } return true; };
  const own = new Array(W * Hh).fill('');
  cubes.forEach(k => {
    const { c, h, b } = k;
    [['top', [P(c, h + 1, b), P(c + 1, h + 1, b), P(c + 1, h + 1, b + 1), P(c, h + 1, b + 1)]],
     ['front', [P(c, h, b), P(c + 1, h, b), P(c + 1, h + 1, b), P(c, h + 1, b)]],
     ['right', [P(c + 1, h, b), P(c + 1, h, b + 1), P(c + 1, h + 1, b + 1), P(c + 1, h + 1, b)]]].forEach(([t, poly]) => {
      const key = t + poly.map(q => q.u + ',' + q.v).join(';');
      const u0 = Math.min(...poly.map(q => q.u)), u1 = Math.max(...poly.map(q => q.u)), v0 = Math.min(...poly.map(q => q.v)), v1 = Math.max(...poly.map(q => q.v));
      for (let i = Math.floor(u0 * S); i < Math.ceil(u1 * S); i++) for (let j = Math.floor(v0 * S); j < Math.ceil(v1 * S); j++){
        if (inside({ u:(i + 0.37) / S, v:(j + 0.21) / S }, poly)) own[j * W + i] = key;
      }
    });
  });
  return own.join('|');
}
function allHRef(R, C, mx){
  const out = [], tot = Math.pow(mx + 1, R * C);
  for (let z = 0; z < tot; z++){ let y = z; const H = []; for (let r = 0; r < R; r++){ const row = []; for (let c = 0; c < C; c++){ row.push(y % (mx + 1)); y = Math.floor(y / (mx + 1)); } H.push(row); } out.push(H); }
  return out;
}
/* 這張圖在「同樣格數、每格 0～MAX_HEIGHT 層」的所有堆裡是不是唯一的 */
function uniqueImageRef(H){
  const key = H.length + 'x' + H[0].length;
  if (!IMAGE_CACHE[key]){ const m = new Map(); allHRef(H.length, H[0].length, MAX_HEIGHT_REF).forEach(G => { const im = imageRef(G); m.set(im, (m.get(im) || 0) + 1); }); IMAGE_CACHE[key] = m; }
  return IMAGE_CACHE[key].get(imageRef(H)) === 1;
}
function gameChecks(D, I18N, fail, rawSrc){
  const src = String(rawSrc).replace(/<!--[\s\S]*?-->/g, ' ');
  const LANGS = ['zh', 'en'], W = 300;
  const J = JSON.stringify;
  const fin = v => typeof v === 'number' && isFinite(v);
  const nums = t => (String(t).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null|\[object/.test(text)) return fail('GAME ' + where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail('GAME ' + where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
    gameArith(text).problems.forEach(b => fail('GAME ' + where + ': ' + b + ' in: ' + text));
    textProblems(text, where.indexOf('(en)') >= 0 ? 'en' : 'zh', 'GAME ' + where).forEach(fail);
  };
  const rect = (x, y, w, h) => ({ x, y, w, h });
  const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= 0 && o.y >= 0 && o.x + o.w <= W + 1e-9 && o.y + o.h <= H + 1e-9)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + J(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])) return fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); };
  const boxOf = z => rect(z.cx - z.hw, z.cy - z.hh, 2 * z.hw, 2 * z.hh);
  /* 375px 手機：卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
  const scale = Math.min(1.5, 289 / W);
  const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  /* 自己的投影：一堆畫在 box 裡置中，每一個面的每一個頂點都要在 box 裡（留 2px） */
  const originRef = (H, box, u, ext) => { const e = ext || extentRef(H); return { X0:box.x + (box.w - e.w * u) / 2, Y0:box.y + (box.h + e.h * u) / 2 }; };
  const pileFits = (H, box, u, what, ext) => {
    const o = originRef(H, box, u, ext), got = D.pileOrigin(H, box, u, ext);
    if (Math.abs(got.X0 - o.X0) > 1e-9 || Math.abs(got.Y0 - o.Y0) > 1e-9) fail('GAME ' + what + ': pileOrigin() is not the centred origin');
    cubeListRef(H).forEach(k => Object.values(facesRef(k, o.X0, o.Y0, u)).forEach(poly => poly.forEach(p => {
      if (!(p.x >= box.x + 2 && p.x <= box.x + box.w - 2 && p.y >= box.y + 2 && p.y <= box.y + box.h - 2)) fail('GAME ' + what + ': the pile ' + J(H) + ' is drawn outside its box');
    })));
  };
  /* 畫在遊戲裡的每一堆：合法、每一格最上面看得到、而且圖是唯一的 */
  const pictured = (H, what) => {
    if (!validRef(H)) return fail('GAME ' + what + ': ' + J(H) + ' is not a valid pile');
    if (!allTopsVisibleRef(H)) fail('GAME ' + what + ': ' + J(H) + ' hides a whole column behind the others, so it cannot be counted from the picture');
    if (!uniqueImageRef(H)) fail('GAME ' + what + ': ' + J(H) + ' draws the same picture as another pile of the same size — the picture does not determine the pile');
  };

  /* --- 五關的順序與 RENDER --- */
  const TYPES = ['build', 'match', 'layers', 'sort', 'tap'];
  const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
  if (order === undefined) fail('GAME: cannot find GAME_ORDER in index.html');
  else if (order.split(',').map(x => x.trim().replace(/^'|'$/g, '')).join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1–2, 3, 3, 4, 4)');
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const RB = {};
  TYPES.forEach(t => {
    RB[t] = stripJsComments(body(t));
    if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('GAME: gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('GAME: gHints.' + t + ' missing in ' + L);
    });
  });
  const need = (k, re, what) => { if (!re.test(RB[k] || '')) fail('GAME ' + k + ': ' + what); };
  ['GAME_BUILD', 'GAME_MATCH', 'GAME_LAYERS', 'GAME_SORT', 'GAME_TAP'].forEach(k => {
    if (!Array.isArray(D[k]) || D[k].length < 3) fail('GAME: ' + k + ' should be a pool of at least 3 entries');
  });
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('GAME: ahead mode no longer shows hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('GAME: the hint button is not disabled after the second level');
  if (!/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(src)) fail('GAME: startRound() does not start a new board generation (gGen++) — a piece held across a restart could solve the new round');
  if (!/if \(gen !== gGen\) return;/.test(src)) fail('GAME: a released piece does not check its board generation — a piece held across a restart could solve the new round');
  if (!/if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/.test(src)) fail('GAME: a second finger can pick up a piece (pointerdown must require isPrimary)');
  if (!/if \(!e\.isPrimary\) return;   \/\* 第二根手指/.test(src)) fail('GAME: a second finger can start a board tap (board pointerdown must require isPrimary)');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('GAME: lostpointercapture does not put the piece back');
  /* document 上的放開保險：只在拖拉開始時掛上、結束時（stopGesture() 與 end() 兩處）拿掉 —— 不然 capture 失敗時積木會卡死，或監聽越積越多 */
  {
    const ap = stripJsComments(extractFunction(src, 'addPiece') || '');
    if (!ap) fail('GAME: cannot find addPiece() in index.html');
    /* 三個地方各自切出來：pointerdown 的回呼裝一次，stopGesture() 與 end() 各拿掉一次（codex 第二輪：只數總數會放過搬錯地方的寫法） */
    const pd = (ap.match(/el\.addEventListener\('pointerdown', function\(e\)\{([\s\S]*?)\n    \}\);\n    el\.addEventListener\('pointermove'/) || [])[1] || '';
    const sg = extractFunction(ap, 'stopGesture') || '', en = extractFunction(ap, 'end') || '';
    if (!pd || !sg || !en) fail('GAME: cannot cut the pointerdown handler, stopGesture() or end() out of addPiece()');
    const cnt = (txt, re) => (txt.match(re) || []).length;
    /* 而且要在所有的 return 守衛之後、真的開始拖的那一行後面緊接著裝（codex 第三輪：裝在守衛前面，被拒絕的 pointerdown 也會留下監聽） */
    if (!/start = B\.toBoard\(e\); orig = \{ x:P\.cx, y:P\.cy \}; moved = false;\n\s*document\.addEventListener\('pointerup', onDocEnd\);\n\s*document\.addEventListener\('pointercancel', onDocEnd\);\s*$/.test(pd)) fail('GAME: the document-level release listeners must be installed right after the drag really starts (after every guard), as the last statements of pointerdown');
    ['pointerup', 'pointercancel'].forEach(ev => {
      const add = new RegExp("document\\.addEventListener\\('" + ev + "', onDocEnd\\);", 'g'), rm = new RegExp("document\\.removeEventListener\\('" + ev + "', onDocEnd\\);", 'g');
      if (cnt(pd, add) !== 1 || cnt(ap, add) !== 1) fail('GAME: the document-level ' + ev + ' fallback must be installed exactly once, inside the pointerdown handler');
      if (cnt(sg, rm) !== 1 || cnt(en, rm) !== 1 || cnt(ap, rm) !== 2) fail('GAME: the document-level ' + ev + ' listener must be removed once in stopGesture() and once in end()');
    });
  }

  /* --- 計分（§三 中年級）：roundMiss() 與 roundSolved() 切出來真的跑 --- */
  if (!/var pts = gMistake \? 10 : 20;/.test(src)) fail('GAME scoring: a round should give +20 with no mistakes and +10 after mistakes');
  {
    const fsrc = extractFunction(src, 'roundMiss');
    if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
    else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
      let r;
      try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
      catch (e){ return fail('GAME scoring: roundMiss() could not run: ' + e.message); }
      if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
      if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
      if (r.html.indexOf('why') < 0 || !r.m) fail('GAME scoring: roundMiss() does not show the reason or record the mistake');
    });
    const ssrc = extractFunction(src, 'roundSolved');
    if (!ssrc) fail('GAME scoring: cannot find roundSolved() in index.html');
    else [[false, 0, 20, 0], [true, 15, 25, 1], [false, 80, 100, 4]].forEach(([mis, s0, want, rd]) => {
      let r;
      try { r = new Function('var gSolved = false, gMistake = ' + mis + ', gScore = ' + s0 + ', gRound = ' + rd + ', GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gNext = { disabled:true }, gHintBtn = { disabled:false }, gameStage = { querySelectorAll:function(){ return []; } };\n' +
        'function L(){ return { gPts:function(p){ return "@" + p + "@"; }, gWin:function(s){ return "WIN" + s; }, gClear:"CLEAR" }; }\n' + ssrc + '\nroundSolved("ok"); roundSolved("again"); return { s:gScore, html:gMsg.innerHTML, next:gNext.disabled, hint:gHintBtn.disabled, solved:gSolved };')(); }
      catch (e){ return fail('GAME scoring: roundSolved() could not run: ' + e.message); }
      if (r.s !== want) fail('GAME scoring: roundSolved() with mistake=' + mis + ' from ' + s0 + ' gives ' + r.s + ', expected ' + want + ' (and only once)');
      if (!r.solved || !r.hint || r.html.indexOf('again') >= 0) fail('GAME scoring: roundSolved() must solve once and disable the hint');
      if ((rd === 4) !== /WIN/.test(r.html) || (rd === 4) !== r.next) fail('GAME scoring: the last round must show the win line and keep Next disabled; other rounds enable Next');
    });
  }
  LANGS.forEach(L => {
    const d = I18N[L];
    if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
    if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
    if (nums(d.gWin(85)).indexOf(85) < 0) fail('GAME gWin ' + L + ' does not show the score');
    if (typeof d.gClear !== 'string' || !d.gClear) fail('GAME gClear missing in ' + L);
  });

  /* --- shuffle()、nearestOpen()：切出來真的跑 --- */
  let shuffleFn = null, nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'shuffle');
    if (!fsrc) fail('GAME: cannot find shuffle() in index.html');
    else { try { shuffleFn = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('GAME: shuffle() could not be evaluated: ' + e.message); } }
    if (shuffleFn){
      const seen = new Set();
      for (let i = 0; i < 400; i++){
        const a = [1, 2, 3, 4], r = shuffleFn(a);
        if (r.slice().sort().join() !== '1,2,3,4' || a.join() !== '1,2,3,4'){ fail('GAME shuffle(): not a permutation of its input (or it changed the input)'); break; }
        seen.add(r.join());
      }
      if (seen.size < 20) fail('GAME shuffle(): only ' + seen.size + ' of 24 orders in 400 draws — it does not really shuffle');
    }
    const nsrc = extractFunction(src, 'nearestOpen');
    if (!nsrc) fail('GAME: cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(nsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
    if (nearestOpen){
      const two = [{ id:0, cx:100, cy:100, hw:60, hh:20 }, { id:1, cx:170, cy:100, hw:10, hh:10 }];
      const r0 = nearestOpen(two, { x:155, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('GAME nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
      const done = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:true }, { id:1, cx:142, cy:100, hw:20, hh:20 }];
      if (nearestOpen(done, { x:119, y:100 }, 6) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
      if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('GAME nearestOpen(): a drop far from every slot is accepted');
      const pair = [{ id:0, cx:100, cy:100, hw:20, hh:20 }, { id:1, cx:142, cy:100, hw:20, hh:20 }];
      const r1 = nearestOpen(pair, { x:123, y:100 }, 6);
      if (!r1 || r1.id !== 1) fail('GAME nearestOpen(): a drop in the overlap nearer the second box goes to the first');
      const edge = [{ id:0, cx:100, cy:100, hw:20, hh:20 }];
      if (!nearestOpen(edge, { x:125.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop inside the pad is refused');
      if (nearestOpen(edge, { x:126.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop outside the pad is accepted');
    }
  }
  /* 自己的「最近的方框」 */
  const nearestBox = (list, p, pad) => {
    let best = null, bd = Infinity, bc = Infinity;
    for (const b of list){
      const dx = Math.abs(p.x - b.cx), dy = Math.abs(p.y - b.cy);
      if (dx > b.hw + pad || dy > b.hh + pad) continue;
      const dd = Math.hypot(Math.max(0, dx - b.hw), Math.max(0, dy - b.hh)), dc = Math.hypot(dx, dy);
      if (dd < bd - 1e-9 || (Math.abs(dd - bd) < 1e-9 && dc < bc)){ bd = dd; bc = dc; best = b; }
    }
    return best;
  };
  /* 一排相鄰的格子：整塊畫板每 1px 和自己的最近方框比 */
  const sweepNearest = (zones, pad, H, what) => {
    if (!nearestOpen) return;
    let bad = 0;
    for (let x = 0; x <= W; x += 1) for (let y = 0; y <= H; y += 1){
      const a = nearestOpen(zones, { x, y }, pad), b = nearestBox(zones, { x, y }, pad);
      if (a !== b) bad++;
    }
    if (bad) fail('GAME ' + what + ': nearestOpen() disagrees with the nearest box at ' + bad + ' board points');
  };

  /* --- 觸控與畫板的大小（全部從資料區讀） --- */
  tooSmall('GPICK ' + D.GPICK, D.GPICK);
  tooSmall('a mat square', D.BUILD.cell);
  tooSmall('a digit card', D.LAYER_KEYS.size);
  tooSmall('a layer box', D.LAYERS.slot);
  tooSmall('a sort card', Math.min(D.SORT.cardW, D.SORT.cardH));
  tooSmall('a pile frame to tap', Math.min(D.TAP.frameW, D.TAP.frameH));
  need('build', /addPiece\(B, \{ w:GPICK \+ 8, h:GPICK \+ 8, cx:s0\.cx, cy:s0\.cy,/, 'the cube source is not GPICK + 8 square at buildSrc()');
  need('layers', /addPiece\(B, \{ w:LAYER_KEYS\.size, h:LAYER_KEYS\.size,/, 'the digit cards are not LAYER_KEYS.size square');
  need('sort', /addPiece\(B, \{ w:SORT\.cardW, h:SORT\.cardH, cx:slots\[k\]\.cx, cy:SORT\.trayY,/, 'the sort cards are not SORT.cardW × SORT.cardH in the tray');
  need('match', /addPiece\(B, \{ w:cd\.w, h:cd\.h, cx:cl3\[k\]\.x \+ cl3\[k\]\.w \/ 2, cy:MATCH\.trayY,/, 'the height-map cards are not matchCard() sized in the tray');
  if (D.MINI_W > D.SORT.cardW - 6 || D.MINI_H > D.SORT.cardH - 6) fail('GAME: the mini drawing (' + D.MINI_W + '×' + D.MINI_H + ') does not fit inside a sort card');
  if (src.indexOf('P.el.appendChild(miniSvg(set[pi]));') < 0 || !/var plan = miniPlan\(H\);[\s\S]{0,200}plan\.cubes\.forEach\(function\(k\)\{ drawCube\(s, k, 'a'\); \}\);/.test(src)) fail('GAME sort: the cards are not drawn with miniPlan()');

  /* ================= 第 1 關：照圖疊 ================= */
  {
    const BU = D.BUILD, boxes = D.buildBoxes();
    boxes.forEach((b, i) => inside(b, 'build panel ' + i, D.BUILD_H));
    noHits(boxes, 'build panels');
    D.GAME_BUILD.forEach((T, ti) => {
      const what = 'GAME_BUILD[' + ti + '] ' + J(T);
      pictured(T, what);
      const n = volumeRef(T), hid = hiddenRef(T), v = visibleCountRef(T);
      if (T.length !== 2 || T[0].length > 3 || maxHRef(T) > 3) fail('GAME ' + what + ': keep the copy pile to 2 rows, at most 3 squares wide and 3 high');
      if (n < 6 || n > 10) fail('GAME ' + what + ': ' + n + ' cubes — the copy pile should take 6 to 10 cubes');
      if (hid < 2) fail('GAME ' + what + ': only ' + hid + ' hidden — the copy round must make the child place at least 2 cubes that the picture does not show');
      if (T.some(row => row.every(x => x === 0)) || T[0].some((x, c) => T.every(row => row[c] === 0))) fail('GAME ' + what + ': an empty row or column would make the mat bigger than the pile');
      /* 兩邊畫在同一個 ext 下，各自在自己的框裡 */
      const ext = extentRef(T);
      boxes.forEach((b, i) => pileFits(T, b, BU.unit, what + ' panel ' + i, ext));
      boxes.forEach((b, i) => {
        const o = originRef(T, b, BU.unit, ext), fc = D.floorCells(T, o.X0, o.Y0, BU.unit);
        if (fc.length !== T.length * T[0].length) fail('GAME ' + what + ': floorCells() should give one square per mat square');
        fc.forEach(f => {
          const bb = T.length - 1 - f.r, want = [[f.c, bb], [f.c + 1, bb], [f.c + 1, bb + 1], [f.c, bb + 1]].map(([c, b2]) => projRef(c, 0, b2, o.X0, o.Y0, BU.unit));
          if (!want.every((p, k) => samePt(p, f.poly[k]))) fail('GAME ' + what + ': floor square ' + f.r + ',' + f.c + ' is not where the table square is');
          f.poly.forEach(p => { if (!(p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h)) fail('GAME ' + what + ': the floor grid leaves panel ' + i); });
        });
      });
      /* 方格：一格一個、相鄰、在畫板裡、不碰到方塊來源 */
      const cells = D.buildCells(T), C = T[0].length, R = T.length, s0 = D.buildSrc(T);
      if (cells.length !== R * C) fail('GAME ' + what + ': buildCells() should give ' + R * C + ' squares');
      cells.forEach((cl, i) => {
        if (cl.r !== Math.floor(i / C) || cl.c !== i % C) fail('GAME ' + what + ': buildCells() is not in reading order (back row first)');
        const want = { cx:BU.matCx - C * BU.cell / 2 + (cl.c + 0.5) * BU.cell, cy:BU.matTop + (cl.r + 0.5) * BU.cell };
        if (Math.abs(cl.cx - want.cx) > 1e-9 || Math.abs(cl.cy - want.cy) > 1e-9 || cl.hw !== BU.cell / 2 || cl.hh !== BU.cell / 2) fail('GAME ' + what + ': square ' + i + ' is not on the mat grid');
        inside(boxOf(cl), what + ' square ' + i, D.BUILD_H);
      });
      noHits(cells.map(boxOf), what + ' squares');
      const srcBox = rect(s0.cx - (D.GPICK + 8) / 2, s0.cy - (D.GPICK + 8) / 2, D.GPICK + 8, D.GPICK + 8);
      inside(srcBox, what + ' cube source', D.BUILD_H);
      cells.forEach((cl, i) => { const pb = boxOf(cl); if (hit(rect(pb.x - BU.pad, pb.y - BU.pad, pb.w + 2 * BU.pad, pb.h + 2 * BU.pad), srcBox)) fail('GAME ' + what + ': the cube source sits inside the drop zone of square ' + i); });
      boxes.forEach((b, i) => { if (hit(b, rect(BU.matCx - C * BU.cell / 2, BU.matTop - 24, C * BU.cell, R * BU.cell + 48))) fail('GAME ' + what + ': the mat runs into panel ' + i); });
      if (BU.matTop + R * BU.cell + 24 > D.BUILD_H) fail('GAME ' + what + ': the "front" label falls off the board');
      if (W > 0) sweepNearest(cells, BU.pad, D.BUILD_H, what + ' mat');
      /* buildJudge 和自己的規則比：每一種 built 狀態、每一格 */
      const want = (built, r, c) => T[r][c] === 0 ? 'empty' : built[r][c] >= T[r][c] ? 'full' : 'ok';
      const states = allHRef(R, C, 3).filter(G => G.every((row, r) => row.every((x, c) => x <= T[r][c])));
      states.forEach(G => cells.forEach(cl => { if (D.buildJudge(T, G, cl.r, cl.c) !== want(G, cl.r, cl.c)) fail('GAME ' + what + ': buildJudge(' + J(G) + ', ' + cl.r + ', ' + cl.c + ') disagrees'); }));
      /* 照遊戲的規則玩：任意的順序，每一步把「收」的那一塊放上去；剛好 n 塊時和圖一樣，之前都不一樣 */
      let rnd = lcg(1000 + ti);
      for (let g = 0; g < 60; g++){
        const built = D.emptyLike(T); let k = 0;
        while (true){
          const okCells = cells.filter(cl => D.buildJudge(T, built, cl.r, cl.c) === 'ok');
          if (!okCells.length) break;
          const cl = okCells[Math.floor(rnd() * okCells.length)];
          built[cl.r][cl.c]++; k++;
          if (D.sameStack(built, T) !== (k === n)) { fail('GAME ' + what + ': sameStack() says done at ' + k + ' of ' + n); break; }
        }
        if (k !== n || !eqJ(built, T)) { fail('GAME ' + what + ': playing by the rules stops at ' + k + ' cubes, not ' + n); break; }
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        seq('build done (' + L + ')', d.gBuildDone(n, v, hid), [n, n, v, hid]);
        if (v + hid !== n) fail('GAME ' + what + ': seen + hidden is not the total');
        T.forEach(row => row.forEach(x => { if (x) seq('build full (' + L + ')', d.gBuildFull(x), [x]); }));
        for (let k = 1; k <= 3; k++) seq('build hint 2 (' + L + ')', d.gBuild2(k), [k]);
        seq('build line (' + L + ')', d.gBuildNow(n), [n]);
        seq('build line 1 (' + L + ')', d.gBuildNow(1), [1]);
      });
    });
    LANGS.forEach(L => { if (nums(I18N[L].gBuildEmpty).length) fail('GAME gBuildEmpty (' + L + ') should not carry a number'); });
    need('build', /var j = buildJudge\(T, built, cl\.r, cl\.c\);\s*if \(j === 'empty'\)\{ roundMiss\(d\.gBuildEmpty\); return false; \}\s*if \(j === 'full'\)\{ roundMiss\(d\.gBuildFull\(T\[cl\.r\]\[cl\.c\]\)\); return false; \}\s*built\[cl\.r\]\[cl\.c\]\+\+;/, 'the drop handler no longer refuses an empty square / a full square before placing');
    need('build', /var cl = nearestOpen\(cells, pt, BUILD\.pad\);\s*if \(!cl\) return false;/, 'a drop away from the mat is not a silent bounce');
    need('build', /if \(sameStack\(built, T\)\)\{[\s\S]*?roundSolved\(d\.gBuildDone\(n, vis\.visible, vis\.hidden\)\);/, 'the round is not solved exactly when the pile equals the picture');
    need('build', /B\.onPointTap = function\(P, pt\)\{\s*if \(P\.busy\(\) \|\| gSolved\) return;\s*place\(P,/, 'tap-then-tap no longer places with the cube kept selected (or ignores a held cube)');
  }

  /* ================= 第 2 關：配高度圖 ================= */
  {
    const MA = D.MATCH, cl3 = D.matchCols();
    if (cl3.length !== 3) fail('GAME match: three columns');
    cl3.forEach((c, i) => inside(c.box, 'match pile box ' + i, D.MATCH_H));
    noHits(cl3.map(c => c.box), 'match pile boxes');
    D.GAME_MATCH.forEach((set, si) => {
      const what = 'GAME_MATCH[' + si + ']';
      if (!Array.isArray(set) || set.length !== 3) return fail('GAME ' + what + ': three piles');
      set.forEach((H, i) => { pictured(H, what + '[' + i + ']'); pileFits(H, cl3[i].box, MA.unit, what + '[' + i + ']'); });
      if (new Set(set.map(H => H.length + 'x' + H[0].length)).size !== 1) fail('GAME ' + what + ': the three piles must have the same grid size');
      if (new Set(set.map(volumeRef)).size !== 1) fail('GAME ' + what + ': the three piles must have the same number of cubes (otherwise the total gives the match away)');
      if (new Set(set.map(H => cellsRef(H).slice().sort().join())).size !== 1) fail('GAME ' + what + ': the three piles must use the same column heights in different places');
      if (new Set(set.map(J)).size !== 3) fail('GAME ' + what + ': two piles are the same');
      if (new Set(set.map(imageRef)).size !== 3) fail('GAME ' + what + ': two piles look the same');
      /* matchDiff 和自己的「第一個不一樣的格子」比 */
      set.forEach((A, a) => set.forEach((B, b) => {
        let want = null;
        for (let r = 0; r < A.length && !want; r++) for (let c = 0; c < A[0].length; c++) if (A[r][c] !== B[r][c]){ want = { r, c, a:A[r][c], b:B[r][c] }; break; }
        if (J(D.matchDiff(A, B)) !== J(want)) fail('GAME ' + what + ': matchDiff(' + a + ', ' + b + ') = ' + J(D.matchDiff(A, B)) + ', expected ' + J(want));
        if (want) LANGS.forEach(L => seq('match bad (' + L + ')', I18N[L].gMatchBad(want.a, want.b), [want.a, want.b]));
      }));
      const cd = D.matchCard(set[0]), zones = D.matchZones(set);
      if (cd.w !== set[0][0].length * MA.cellPx + 2 * MA.cardPad || cd.h !== set[0].length * MA.cellPx + 2 * MA.cardPad) fail('GAME ' + what + ': matchCard() size is wrong');
      tooSmall(what + ' a height-map card', Math.min(cd.w, cd.h));
      zones.forEach((z, i) => {
        const zb = boxOf(z), c = cl3[i].box;
        if (!(zb.x <= c.x && zb.y <= c.y && zb.x + zb.w >= c.x + c.w && zb.y + zb.h >= c.y + c.h)) fail('GAME ' + what + ': the drop zone of column ' + i + ' does not cover the drawn pile');
        if (!(z.slotCy - cd.h / 2 >= MA.slotY && z.slotCy + cd.h / 2 <= zb.y + zb.h)) fail('GAME ' + what + ': the frame under pile ' + i + ' is outside its drop zone');
        inside(zb, what + ' drop zone ' + i, D.MATCH_H);
      });
      noHits(zones.map(boxOf), what + ' drop zones');
      const tray = cl3.map(c => rect(c.x + c.w / 2 - cd.w / 2, MA.trayY - cd.h / 2, cd.w, cd.h));
      tray.forEach((t, k) => { inside(t, what + ' tray card ' + k, D.MATCH_H); zones.forEach(z => { const zb = boxOf(z); if (hit(t, rect(zb.x - MA.pad, zb.y - MA.pad, zb.w + 2 * MA.pad, zb.h + 2 * MA.pad))) fail('GAME ' + what + ': tray card ' + k + ' sits in a drop zone'); }); });
      noHits(tray, what + ' tray cards');
      sweepNearest(zones, MA.pad, D.MATCH_H, what + ' columns');
      /* 照規則玩：任一張卡只收進自己的那一欄 */
      set.forEach((A, a) => zones.forEach((z, b) => { if ((D.matchDiff(A, set[z.i]) === null) !== (a === b)) fail('GAME ' + what + ': card ' + a + ' would be accepted by column ' + b); }));
      LANGS.forEach(L => seq('match done (' + L + ')', I18N[L].gMatchDone(volumeRef(set[0])), [volumeRef(set[0])]));
    });
    const seen = new Set();
    for (let i = 0; i < 600; i++){
      const o = D.noIdentity(3);
      if (o.slice().sort().join() !== '0,1,2'){ fail('GAME noIdentity(): not a permutation'); break; }
      if (o.join() === '0,1,2'){ fail('GAME noIdentity(): the tray started in answer order'); break; }
      seen.add(o.join());
    }
    if (seen.size !== 5) fail('GAME noIdentity(): only ' + seen.size + ' of the 5 non-answer orders appear in 600 draws');
    need('match', /var diff = matchDiff\(set\[P\.data\.i\], set\[z\.i\]\);\s*if \(diff\)\{\s*P\.cellEls\[diff\.r \* C \+ diff\.c\]\.classList\.add\('bad'\);\s*roundMiss\(d\.gMatchBad\(diff\.a, diff\.b\)\);\s*return false;/, 'a card on the wrong pile is not refused with the red square and its reason');
    need('match', /var z = nearestOpen\(zones, pt, MATCH\.pad\);\s*if \(!z\) return false;/, 'a drop away from the columns is not a silent bounce');
    need('match', /noIdentity\(3\)\.map\(function\(pi, k\)/, 'the tray is not dealt with noIdentity()');
    need('match', /if \(!left\)\{ flashOnly\(\[\]\); roundSolved\(d\.gMatchDone\(volume\(set\[0\]\)\)\); \}/, 'the round is not solved once all three cards are placed');
  }

  /* ================= 第 3 關：分層數 ================= */
  {
    const LA = D.LAYERS, LK = D.LAYER_KEYS;
    inside(LA.box, 'layers pile box', D.LAYERS_H);
    const keys = [];
    for (let v = 0; v <= 9; v++) keys.push(rect(150 + ((v % 5) - 2) * LK.step - LK.size / 2, LK.y + Math.floor(v / 5) * LK.rowStep - LK.size / 2, LK.size, LK.size));
    keys.forEach((k, i) => inside(k, 'digit card ' + i, D.LAYERS_H));
    noHits(keys, 'digit cards');
    if (src.indexOf('cx:150 + ((v % 5) - 2) * LAYER_KEYS.step, cy:LAYER_KEYS.y + Math.floor(v / 5) * LAYER_KEYS.rowStep') < 0) fail('GAME layers: the digit cards are not laid out from LAYER_KEYS');
    D.GAME_LAYERS.forEach((H, hi) => {
      const what = 'GAME_LAYERS[' + hi + '] ' + J(H);
      pictured(H, what);
      pileFits(H, LA.box, LA.unit, what);
      const lc = layersRef(H), m = lc.length;
      if (J(D.layerCounts(H)) !== J(lc)) fail('GAME ' + what + ': layerCounts() disagrees');
      if (m < 3 || m > 3) fail('GAME ' + what + ': use piles exactly 3 layers high (three boxes fit the board)');
      if (lc.some(c => c > 9)) fail('GAME ' + what + ': a layer has more than 9 cubes — no single digit card for it');
      if (new Set(lc).size < 2) fail('GAME ' + what + ': every layer has the same count — counting the squares would always work');
      /* 第 1 層一定有看不到的方塊 —— 只數看得到的會少 */
      const vis = visibleSetRef(H), hidden1 = cubeListRef(H).filter(k => k.h === 0 && !vis.has(k.c + ',' + k.h + ',' + k.b)).length;
      if (hidden1 < 1) fail('GAME ' + what + ': layer 1 has no hidden cube, so counting only what you see would also work');
      const R = H.length, C = H[0].length;
      const hb = rect(LA.box.x + (LA.box.w - C * LA.hcell) / 2, LA.hmapY + 22, C * LA.hcell, R * LA.hcell);
      inside(hb, what + ' height map', D.LAYERS_H);
      const slots = D.layerSlots(H);
      if (slots.length !== m) fail('GAME ' + what + ': one box per layer');
      slots.forEach((S, i) => {
        if (S.L !== i + 1) fail('GAME ' + what + ': layerSlots() must list layer 1 first');
        if (Math.abs(S.cy - (LA.rowTop + (m - S.L) * LA.rowStep + LA.slot / 2)) > 1e-9) fail('GAME ' + what + ': layer ' + S.L + ' is not in its row (layer 1 at the bottom)');
        inside(boxOf(S), what + ' layer box ' + S.L, D.LAYERS_H);
        inside(rect(LA.slotX - LA.lblW - 2, S.cy - 11, LA.lblW, 22), what + ' layer label ' + S.L, D.LAYERS_H);
        inside(rect(LA.slotX + LA.slot + 4, S.cy - 11, LA.unitW, 22), what + ' unit label ' + S.L, D.LAYERS_H);
        if (hit(rect(LA.slotX - LA.lblW - 2, S.cy - 11, LA.lblW, 22), LA.box)) fail('GAME ' + what + ': the layer label runs into the picture');
        keys.forEach((k, j) => { const sb = boxOf(S); if (hit(k, rect(sb.x - LA.pad, sb.y - LA.pad, sb.w + 2 * LA.pad, sb.h + 2 * LA.pad))) fail('GAME ' + what + ': digit card ' + j + ' sits in the drop zone of layer ' + S.L); });
      });
      noHits(slots.map(boxOf), what + ' layer boxes');
      keys.forEach((k, j) => { if (hit(k, hb)) fail('GAME ' + what + ': digit card ' + j + ' covers the height map'); });
      sweepNearest(slots, LA.pad, D.LAYERS_H, what + ' layer boxes');
      for (let L = 1; L <= m; L++) for (let v = 0; v <= 9; v++){
        const want = v === lc[L - 1] ? 'ok' : v > lc[L - 1] ? 'more' : 'less';
        if (D.layerJudge(H, L, v) !== want) fail('GAME ' + what + ': layerJudge(' + L + ', ' + v + ') should be ' + want);
        const c = lc[L - 1];
        LANGS.forEach(lang => {
          const d = I18N[lang];
          if (want === 'more') seq('layer more (' + lang + ')', d.gLayerMore(L, v, c), lang === 'zh' ? [L, v, L, c] : [L, v, c, L]);
          if (want === 'less') seq('layer less (' + lang + ')', d.gLayerLess(L, v, c), lang === 'zh' ? [L, v, c, L] : [L, v, c, L]);
        });
      }
      LANGS.forEach(lang => {
        const d = I18N[lang], n = volumeRef(H);
        seq('layers done (' + lang + ')', d.gLayersDone(lc, n), lc.concat([n, n]));
        if (gameArith(d.gLayersDone(lc, n)).verified !== 1) fail('GAME layers done (' + lang + '): the sum should be one checked equation');
        lc.forEach((c, i) => { seq('layer ok (' + lang + ')', d.gLayerOk(i + 1, c), [i + 1, c]); seq('layer hint 2 (' + lang + ')', d.gLayer2(i + 1), [i + 1]); });
      });
    });
    LANGS.forEach(L => { [1, 2, 3].forEach(k => { if (nums(I18N[L].gLayerName(k)).join() !== String(k)) fail('GAME gLayerName(' + k + ') (' + L + ') should name the layer'); }); });
    /* 單複數：1 只有在誘答與正解貼得很近時才出現，題庫不一定走得到 —— 直接拿 1 去渲染 */
    LANGS.forEach(L => { const d = I18N[L]; [[1, 1, 0], [2, 1, 1], [3, 2, 1]].forEach(([l, v, c]) => { textProblems(d.gLayerMore(l, v, c), L, 'GAME layer more ' + l + ',' + v + ',' + c).forEach(fail); textProblems(d.gLayerLess(l, v, c), L, 'GAME layer less ' + l + ',' + v + ',' + c).forEach(fail); textProblems(d.gLayerOk(l, 1), L, 'GAME layer ok').forEach(fail); }); textProblems(d.gBuild2(1), L, 'GAME build hint 2').forEach(fail); textProblems(d.gBuildNow(1), L, 'GAME build line').forEach(fail); textProblems(d.gMatchBad(2, 1), L, 'GAME match bad').forEach(fail); });
    need('layers', /var v = P\.data\.v, c = lc\[S\.L - 1\], j = layerJudge\(H, S\.L, v\);\s*if \(j === 'more'\)\{ roundMiss\(d\.gLayerMore\(S\.L, v, c\)\); return false; \}\s*if \(j === 'less'\)\{ roundMiss\(d\.gLayerLess\(S\.L, v, c\)\); return false; \}/, 'a wrong count is not refused with its reason');
    need('layers', /var S = nearestOpen\(slots, pt, LAYERS\.pad\);\s*if \(!S\) return false;/, 'a drop away from the boxes is not a silent bounce');
    need('layers', /roundSolved\(d\.gLayersDone\(lc, volume\(H\)\)\);/, 'the round is not solved with the layer sum');
  }

  /* ================= 第 4 關：排大小 ================= */
  {
    const SO = D.SORT, slots = D.sortSlots();
    if (slots.length !== 3) fail('GAME sort: three boxes');
    slots.forEach((S, i) => {
      if (Math.abs(S.cx - (i * (SO.slotW + SO.gap) + SO.slotW / 2)) > 1e-9 || S.hw !== SO.slotW / 2 || S.hh !== SO.slotH / 2) fail('GAME sort: box ' + i + ' is not where it is drawn');
      inside(boxOf(S), 'sort box ' + i, D.SORT_H);
      inside(rect(S.x, SO.lblY, SO.slotW, SO.lblH), 'sort label ' + i, D.SORT_H);
      if (SO.cardW > SO.slotW || SO.cardH > SO.slotH) fail('GAME sort: a card does not fit in a box');
    });
    noHits(slots.map(boxOf), 'sort boxes');
    sweepNearest(slots, SO.pad, D.SORT_H, 'sort boxes');
    const tray = slots.map(S => rect(S.cx - SO.cardW / 2, SO.trayY - SO.cardH / 2, SO.cardW, SO.cardH));
    tray.forEach((t, k) => { inside(t, 'sort tray card ' + k, D.SORT_H); slots.forEach(S => { const sb = boxOf(S); if (hit(t, rect(sb.x - SO.pad, sb.y - SO.pad, sb.w + 2 * SO.pad, sb.h + 2 * SO.pad))) fail('GAME sort: tray card ' + k + ' sits in a drop zone'); }); });
    noHits(tray, 'sort tray cards');
    D.GAME_SORT.forEach((set, si) => {
      const what = 'GAME_SORT[' + si + ']';
      if (!Array.isArray(set) || set.length !== 3) return fail('GAME ' + what + ': three piles');
      const vols = set.map(volumeRef), hts = set.map(maxHRef);
      set.forEach((H, i) => {
        pictured(H, what + '[' + i + ']');
        const mp = D.miniPlan(H);
        if (!mp.fits) fail('GAME ' + what + '[' + i + ']: does not fit the card drawing');
        pileFits(H, rect(0, 0, D.MINI_W, D.MINI_H), D.MINI_U, what + '[' + i + '] card');
      });
      if (new Set(vols).size !== 3) fail('GAME ' + what + ': the three piles must have different numbers of cubes (' + vols.join(',') + ')');
      const tallest = hts.indexOf(Math.max(...hts));
      if (hts.filter(h => h === hts[tallest]).length !== 1) fail('GAME ' + what + ': there must be one tallest pile');
      if (vols[tallest] === Math.max(...vols)) fail('GAME ' + what + ': the tallest pile has the most cubes — "taller is not always bigger" is never tested');
      set.forEach((H, i) => { const want = vols.filter(v => v < vols[i]).length; if (D.sortRank(set, i) !== want) fail('GAME ' + what + ': sortRank(' + i + ') should be ' + want); });
      const seen = new Set();
      for (let g = 0; g < 600; g++){
        const o = D.sortTray(set);
        if (o.slice().sort().join() !== '0,1,2'){ fail('GAME ' + what + ': sortTray() is not a permutation'); break; }
        const ranks = o.map(i => vols.filter(v => v < vols[i]).length);
        if (ranks.join() === '0,1,2'){ fail('GAME ' + what + ': the tray started sorted (fewest to most from left to right)'); break; }
        seen.add(o.join());
      }
      if (seen.size !== 5) fail('GAME ' + what + ': sortTray() deals only ' + seen.size + ' of the 5 unsorted orders');
      const ranked = vols.slice().sort((a, b) => a - b);
      LANGS.forEach(L => {
        const d = I18N[L];
        seq('sort done (' + L + ')', d.gSortDone(ranked[0], ranked[1], ranked[2]), ranked);
        vols.forEach(a => {
          seq('sort more (' + L + ')', d.gSortMore(a), [a]); seq('sort less (' + L + ')', d.gSortLess(a), [a]); seq('sort ok (' + L + ')', d.gSortOk(a), [a]);
        });
      });
    });
    LANGS.forEach(L => {
      const d = I18N[L];
      if (!(L === 'zh' ? /多/.test(d.gSortMore(5)) && /少/.test(d.gSortLess(5)) && !/少/.test(d.gSortMore(5)) : /more/.test(d.gSortMore(5)) && /fewer/.test(d.gSortLess(5)) && !/fewer/.test(d.gSortMore(5)))) fail('GAME gSortMore/gSortLess (' + L + ') say more/fewer the wrong way round');
      if (!Array.isArray(d.gSortLbl) || d.gSortLbl.length !== 3) fail('GAME gSortLbl (' + L + ') needs three labels');
    });
    need('sort', /var a = volume\(set\[P\.data\.i\]\), want = volume\(set\[byRank\[S\.i\]\]\);\s*if \(sortRank\(set, P\.data\.i\) !== S\.i\)\{ roundMiss\(a > want \? d\.gSortMore\(a\) : d\.gSortLess\(a\)\); return false; \}/, 'a pile in the wrong box is not refused with more/fewer');
    need('sort', /var S = nearestOpen\(slots, pt, SORT\.pad\);\s*if \(!S\) return false;/, 'a drop away from the boxes is not a silent bounce');
    need('sort', /sortTray\(set\)\.map\(function\(pi, k\)/, 'the tray is not dealt with sortTray()');
    need('sort', /if \(placed === 3\)\{ flashOnly\(\[\]\); roundSolved\(d\.gSortDone\(/, 'the round is not solved once all three are placed');
  }

  /* ================= 第 5 關：找一樣大 ================= */
  {
    const TA = D.TAP, frames = D.tapFrames();
    inside(TA.baseBox, 'tap base box', D.TAP_H);
    frames.forEach((f, i) => inside(f, 'tap frame ' + i, D.TAP_H));
    noHits(frames.concat([TA.baseBox]), 'tap frames');
    /* tapPick 整塊畫板每 1px 和自己的「點在哪一個框裡」比 */
    let bad = 0;
    for (let x = -2; x <= W + 2; x++) for (let y = -2; y <= D.TAP_H + 2; y++){
      let want = -1;
      frames.forEach((f, i) => { if (x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) want = i; });
      if (D.tapPick({ x, y }) !== want) bad++;
    }
    if (bad) fail('GAME tap: tapPick() disagrees with the drawn frames at ' + bad + ' points');
    D.GAME_TAP.forEach((e, ei) => {
      const what = 'GAME_TAP[' + ei + ']', n = volumeRef(e.base);
      pictured(e.base, what + ' base'); pileFits(e.base, TA.baseBox, TA.baseUnit, what + ' base');
      if (!Array.isArray(e.cands) || e.cands.length !== 4) return fail('GAME ' + what + ': four piles');
      e.cands.forEach((H, i) => { pictured(H, what + '[' + i + ']'); pileFits(H, frames[i], TA.unit, what + '[' + i + ']'); if (D.tapSame(e.base, H) !== (volumeRef(H) === n)) fail('GAME ' + what + ': tapSame(' + i + ') is wrong'); });
      const same = e.cands.filter(H => volumeRef(H) === n), diff = e.cands.filter(H => volumeRef(H) !== n);
      if (same.length !== 2) fail('GAME ' + what + ': exactly two piles must match A (' + same.length + ')');
      same.forEach(H => { if (eqJ(H, e.base)) fail('GAME ' + what + ': a matching pile is A itself — nothing was rearranged'); });
      if (!same.some(H => maxHRef(H) !== maxHRef(e.base) || footprintRef(H) !== footprintRef(e.base))) fail('GAME ' + what + ': no matching pile is taller/flatter than A');
      if (!diff.some(H => maxHRef(H) === maxHRef(e.base) || footprintRef(H) === footprintRef(e.base))) fail('GAME ' + what + ': no different pile looks like A (same height or same base)');
      LANGS.forEach(L => {
        const d = I18N[L];
        seq('tap done (' + L + ')', d.gTapDone(n), [n, n]); seq('tap hint 2 (' + L + ')', d.gTap2(n), [n, n]); seq('tap ok (' + L + ')', d.gTapOk(n), [n]);
        diff.forEach(H => seq('tap bad (' + L + ')', d.gTapBad(volumeRef(H), n), [volumeRef(H), n]));
        seq('tap line (' + L + ')', d.gTapNow(1), [1, 2]);
      });
    });
    need('tap', /var i = tapPick\(pt\);\s*if \(i < 0 \|\| done\[i\]\) return;/, 'a tap in a gap or on a found pile is not ignored');
    need('tap', /if \(!tapSame\(e\.base, H\)\)\{ roundMiss\(d\.gTapBad\(volume\(H\), n\)\); return; \}/, 'a pile with a different count is not refused with its reason');
    need('tap', /if \(found === 2\) roundSolved\(d\.gTapDone\(n\)\);/, 'the round is not solved after both matching piles');
  }
}

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 課程頁：資料層 --- */
    { file:"index", via:"index", expect:"volume() disagrees",
      find:"    H.forEach(function(row){ row.forEach(function(x){ s += x; }); });\n    return s;\n  }\n  /* 高度圖上有方塊的格數",
      replace:"    H.forEach(function(row){ row.forEach(function(x){ s += x; }); });\n    return s + 1;\n  }\n  /* 高度圖上有方塊的格數",
      why:"every volume on the page would be one too many" },
    { file:"index", via:"index", expect:"layerCounts() disagrees",
      find:"      H.forEach(function(row){ row.forEach(function(x){ if (x >= L) n++; }); });",
      replace:"      H.forEach(function(row){ row.forEach(function(x){ if (x > L) n++; }); });",
      why:"layer by layer would miss the top layer of every column" },
    { file:"index", via:"index", expect:"cellList() disagrees",
      find:"    H.forEach(function(row){ row.forEach(function(x){ if (x > 0) out.push(x); }); });\n    return out;\n  }\n  /* 第 L 層有幾塊",
      replace:"    H.forEach(function(row){ row.forEach(function(x){ if (x > 1) out.push(x); }); });\n    return out;\n  }\n  /* 第 L 層有幾塊",
      why:"the height-map sum would skip every 1-high square" },
    { file:"index", via:"index", expect:"visibility() disagrees with the ray-cast reference",
      find:"      if (p.b !== q.b) return q.b - p.b;",
      replace:"      if (p.b !== q.b) return p.b - q.b;",
      why:"front rows would be painted first, so hidden cubes would be reported as visible" },
    { file:"index", via:"index", expect:"visibility() disagrees with the ray-cast reference",
      find:"            var p = { u:(i + 0.5) / RASTER, v:(j + 0.25) / RASTER };",
      replace:"            var p = { u:(i + 0.5) / RASTER, v:(j + 0.5) / RASTER };",
      why:"sample points would land exactly on face edges and be rejected, so slivers would be missed" },
    { file:"index", via:"index", expect:"visibility() disagrees with the ray-cast reference",
      find:"      top:   [unitPt(c, h + 1, b), unitPt(c + 1, h + 1, b), unitPt(c + 1, h + 1, b + 1), unitPt(c, h + 1, b + 1)],",
      replace:"      top:   [unitPt(c, h + 1, b), unitPt(c + 1, h + 1, b), unitPt(c + 1, h + 1, b), unitPt(c, h + 1, b)],",
      why:"the top face would collapse to a line, so cubes seen only from above would count as hidden" },
    { file:"index", via:"index", expect:"is off the reference projection",
      find:"  var DEPTH = 0.5;         // 往後一排在畫布上偏多少格（右上方向）",
      replace:"  var DEPTH = 0.6;         // 往後一排在畫布上偏多少格（右上方向）",
      why:"the drawing would use a different oblique angle from the one every checker assumes" },
    { file:"index", via:"index", expect:"leaves the canvas",
      find:"    var X0 = (FIG_W - ex.w * U) / 2, Y0 = (FIG_H + ex.h * U) / 2;\n    return stackPlan(H, X0, Y0, U);",
      replace:"    var X0 = (FIG_W - ex.w * U) / 2 + 200, Y0 = (FIG_H + ex.h * U) / 2;\n    return stackPlan(H, X0, Y0, U);",
      why:"a centred stack would be drawn off the right edge" },
    { file:"index", via:"index", expect:"less than one square apart",
      find:"    var A = stackPlan(HA, FIG_W * PAIR_CX_A - ea.w * U / 2, Y0, U);\n    var B = stackPlan(HB, FIG_W * PAIR_CX_B - eb.w * U / 2, Y0, U);",
      replace:"    var A = stackPlan(HA, FIG_W * 0.45 - ea.w * U / 2, Y0, U);\n    var B = stackPlan(HB, FIG_W * 0.55 - eb.w * U / 2, Y0, U);",
      why:"the two stacks would touch and read as one pile" },
    { file:"index", via:"index", expect:"validStack() accepts an empty pile",
      find:"    return volume(H) >= 1 && volume(H) <= MAX_CUBES;\n  }\n\n  /* --- 畫布座標。",
      replace:"    return volume(H) >= 0 && volume(H) <= MAX_CUBES;\n  }\n\n  /* --- 畫布座標。",
      why:"an empty height map would count as a valid pile" },
    { file:"index", via:"index", expect:"QUIZ_FIGS.q3 is described as 3, 2, 1, 1",
      find:"    hill7:  [[3, 2], [1, 1]],",
      replace:"    hill7:  [[3, 2], [1, 2]],",
      why:"the example the quiz describes as 3, 2, 1, 1 would silently become a different pile" },
    { file:"index", via:"index", expect:"hides nothing",
      find:"  var S2_CASES = ['box8', 'hill7', 'ridge10', 'cube12'];",
      replace:"  var S2_CASES = ['box8', 'row3', 'ridge10', 'cube12'];",
      why:"a hidden-cube example with nothing hidden would demonstrate nothing" },
    { file:"index", via:"index", expect:"must be a taller pile that is smaller",
      find:"    { id:'tallLess',  A:'tower3', B:'sq4' },",
      replace:"    { id:'tallLess',  A:'tower4', B:'sq4' },",
      why:"the 'taller but smaller' example would have equal volumes" },
    { file:"index", via:"index", expect:"comparePlan disagrees",
      find:"      volA:a, volB:b, who:a > b ? 'A' : b > a ? 'B' : 'same',",
      replace:"      volA:a, volB:b, who:a >= b ? 'A' : 'B',",
      why:"two equal piles would be reported as A bigger" },
    { file:"index", via:"index", expect:"tallerIsBigger is wrong",
      find:"      tallerIsBigger:(maxH(HA) !== maxH(HB)) && ((maxH(HA) > maxH(HB)) === (a > b)) && a !== b,",
      replace:"      tallerIsBigger:true,",
      why:"the narration would never say 'taller is not bigger'" },

    { file:"index", via:"index", expect:"allTopsVisible() disagrees",
      find:"    H.forEach(function(row, r){ row.forEach(function(x, c){ if (x > 0 && !byKey[c + ',' + (x - 1) + ',' + (R - 1 - r)]) ok = false; }); });",
      replace:"    H.forEach(function(row, r){ row.forEach(function(x, c){ if (x > 1 && !byKey[c + ',' + (x - 1) + ',' + (R - 1 - r)]) ok = false; }); });",
      why:"a 1-high column hidden behind the others would pass the tops-visible test" },
    { file:"index", via:"index", expect:"validStack() accepts a negative height",
      find:"        if (typeof x !== 'number' || x !== Math.floor(x) || x < 0 || x > MAX_HEIGHT) return false;",
      replace:"        if (typeof x !== 'number' || x !== Math.floor(x) || x > MAX_HEIGHT) return false;",
      why:"a negative column height would be accepted as a pile" },
    { file:"index", via:"index", expect:"must say a bigger base is not bigger",
      find:"        if (cp.footA !== cp.footB && !cp.widerIsBigger) s += '占的桌面比較大的那一堆<strong>沒有</strong>比較大 —— 地盤大不一定大。';",
      replace:"        if (cp.footA !== cp.footB && !cp.widerIsBigger) s += '';",
      why:"the wider-base counterexample would be shown without its conclusion" },
    { file:"index", via:"index", expect:"the page raster must sample 4 per unit",
      find:"  var RASTER = 4;          // 每一格取幾個取樣點（見上面的說明）",
      replace:"  var RASTER = 3;          // 每一格取幾個取樣點（見上面的說明）",
      why:"a coarser raster breaks the exactness argument even when the totals happen to agree" },
    { file:"index", via:"index", expect:"must draw every cube",
      find:"    var plan = stackPlan(H, X0, Y0, MINI_U);\n    plan.w = MINI_W; plan.h = MINI_H;",
      replace:"    var plan = stackPlan(H, X0, Y0, MINI_U);\n    plan.cubes = plan.cubes.slice(1);\n    plan.w = MINI_W; plan.h = MINI_H;",
      why:"a game candidate would be drawn with one cube missing" },
    { file:"review", via:"review", expect:"a whole column is hidden behind the others",
      find:"      if (!allTopsVisible(H)) return null;     // 一整格藏在後面的話，圖上數不出來",
      replace:"      // (removed)",
      why:"the generators could draw piles whose back column is completely hidden" },
    { file:"parents", via:"index", expect:"SIBLING: \"高的不一定大\"",
      find:"<strong>比體積就是比塊數</strong>，高的不一定大，搬動重排體積不變。課本上這些是拿真的積木疊、數、比；網站上用的是畫出來的方塊堆、「透視」按鈕和「高度圖」（從上面看，每一格疊幾塊）。',",
      replace:"<strong>比體積就是比塊數</strong>，搬動重排體積不變。課本上這些是拿真的積木疊、數、比；網站上用的是畫出來的方塊堆、「透視」按鈕和「高度圖」（從上面看，每一格疊幾塊）。',",
      why:"the parents page would drop the 'taller is not always bigger' qualifier from its dictionary" },
    { file:"index", via:"index", expect:"SIBLING: \"not always bigger\"",
      find:"<strong>comparing volumes means comparing the number of cubes</strong> — taller is not always bigger, and rearranging changes nothing.',",
      replace:"<strong>comparing volumes means comparing the number of cubes</strong>, and rearranging changes nothing.',",
      why:"the English footer would drop the 'not always bigger' qualifier" },
    /* --- 試題與遊戲 --- */
    { file:"index", via:"index", expect:"qs[2] zh: the marked answer is",
      find:"          opts:['4 立方公分','6 立方公分','7 立方公分','8 立方公分'], ans:2,",
      replace:"          opts:['4 立方公分','6 立方公分','7 立方公分','8 立方公分'], ans:1,",
      why:"the picture question would be keyed to the visible count" },
    { file:"index", via:"index", expect:"QUIZ_FIGS.q3 is described as 3, 2, 1, 1",
      find:"  var QUIZ_FIGS = { q3:'hill7', q4:'box8' };",
      replace:"  var QUIZ_FIGS = { q3:'block7', q4:'box8' };",
      why:"the picture would show a 7-cube pile that is not 3, 2, 1, 1 as the explanation says" },
    { file:"index", via:"index", expect:"QUIZ_FIGS.q4 is described as 8 cubes with 1 hidden",
      find:"  var QUIZ_FIGS = { q3:'hill7', q4:'box8' };",
      replace:"  var QUIZ_FIGS = { q3:'hill7', q4:'cube12' };",
      why:"the picture would have 2 hidden cubes while the key says 1" },
    { file:"index", via:"index", expect:"qsAdv[1] zh: the marked answer is",
      find:"          opts:['4 立方公分','9 立方公分','8 立方公分','16 立方公分'], ans:1,",
      replace:"          opts:['4 立方公分','9 立方公分','8 立方公分','16 立方公分'], ans:3,",
      why:"the height-map word problem would be keyed to 4 × 4" },
    { file:"index", via:"index", expect:"arithmetic is wrong",
      find:"          why:'高度圖每一格加起來：4 ＋ 2 ＋ 2 ＋ 1 ＝ <strong>9</strong>，體積 9 立方公分。",
      replace:"          why:'高度圖每一格加起來：4 ＋ 2 ＋ 2 ＋ 1 ＝ <strong>8</strong>，體積 9 立方公分。",
      why:"an explanation with a wrong sum" },

    /* --- 旁白 --- */
    { file:"index", via:"index", expect:"missing space between Chinese and a digit",
      find:"      s1calc:function(n){ return n + ' 塊，體積 ' + n + ' 立方公分'; },",
      replace:"      s1calc:function(n){ return n + '塊，體積 ' + n + ' 立方公分'; },",
      why:"Chinese glued to a digit is only visible once the sentence is rendered" },
    { file:"index", via:"index", expect:"bad english singular",
      find:"      s2calc:function(v, hid, n){ return 'seen + hidden: ' + v + ' + ' + hid + ' = ' + n + ' ' + plEn(n, 'cube'); },",
      replace:"      s2calc:function(v, hid, n){ return 'seen + hidden: ' + v + ' + ' + hid + ' = ' + n + ' cubes'; },",
      why:"'1 cubes' is only visible once rendered with n = 1" },
    { file:"index", via:"index", expect:"arithmetic is wrong",
      find:"      s2calc:function(v, hid, n){ return '看得到 ＋ 看不到：' + v + ' ＋ ' + hid + ' ＝ ' + n + ' 塊'; },",
      replace:"      s2calc:function(v, hid, n){ return '看得到 ＋ 看不到：' + v + ' ＋ ' + hid + ' ＝ ' + (n + 1) + ' 塊'; },",
      why:"the seen + hidden line would not add up" },
    { file:"index", via:"index", expect:"guess narration gives the total away",
      find:"      s2narrGuess:function(v){ return '從這個方向<strong>看得到 ' + v + ' 塊</strong>。全部有幾塊？先猜一猜，再按「透視」。'; },",
      replace:"      s2narrGuess:function(v){ return '從這個方向<strong>看得到 ' + v + ' 塊</strong>。全部有 ' + (v + 1) + ' 塊嗎？先猜一猜，再按「透視」。'; },",
      why:"the guessing prompt would print a second number and spoil the guess" },
    { file:"index", via:"index", expect:"example 3 calc",
      find:"      s3calc:function(cells, layers, n){ return '高度圖：' + cells.join(' ＋ ') + ' ＝ ' + n + '　·　分層：' + layers.join(' ＋ ') + ' ＝ ' + n; },",
      replace:"      s3calc:function(cells, layers, n){ return '高度圖：' + cells.join(' ＋ ') + ' ＝ ' + n + '　·　分層：' + layers.join(' × ') + ' ＝ ' + n; },",
      why:"layer by layer would be shown as a product — the exact misconception the note refutes" },
    { file:"index", via:"index", expect:"contradicts the computed comparison",
      find:"        if (cp.who === 'same') s += '<strong>一樣大</strong>。塊數一樣，體積就一樣，排法不一樣不算。';",
      replace:"        if (cp.who === 'same') s += '<strong>甲的體積比較大</strong>。塊數一樣，體積就一樣，排法不一樣不算。';",
      why:"equal piles would be narrated as A bigger" },
    { file:"index", via:"index", expect:"must say taller is not bigger",
      find:"        if (cp.tallA !== cp.tallB && !cp.tallerIsBigger) s += '比較高的那一堆<strong>沒有</strong>比較大 —— 高的不一定大。';",
      replace:"        if (cp.tallA !== cp.tallB && !cp.tallerIsBigger) s += '';",
      why:"the lesson's headline sentence would vanish from the example that demonstrates it" },

    /* --- 措辭與範圍 --- */
    { file:"index", via:"index", expect:"KEY: index.html s2note no longer says",
      find:"就算被擋住看不到。最保險的數法是看<strong>高度圖</strong>：從上面看，每一格寫著疊了幾塊，把每一格加起來就是全部。',",
      replace:"就算被擋住看不到。最保險的數法是看<strong>圖</strong>：從上面看，每一格寫著疊了幾塊，把每一格加起來就是全部。',",
      why:"the note would stop naming the height map, the lesson's safe counting method — pinned to that i18n key" },
    { file:"index", via:"index", expect:"SIBLING",
      find:"      s4note:'💬 <strong>比體積就是比塊數</strong>（方塊都一樣大的時候）。",
      replace:"      // 比體積就是比塊數\n      s4note:'💬 <strong>比體積就是比多少</strong>（方塊都一樣大的時候）。",
      why:"the rule is weakened and the old wording pasted into a comment — the scanner must strip it, so the pinned count still drops" },
    { file:"index", via:"index", expect:"HANDOFF",
      find:"長方體體積的<strong>公式</strong>與<strong>容積</strong>、毫升在五年級的「體積積木塔」；<strong>立方公尺</strong>在五年級的「大地測量隊」；<strong>表面積</strong>是六年級的內容。',",
      replace:"長方體體積的<strong>公式</strong>等一下這一課的後面就會補充說明，不用急，<strong>容積</strong>與毫升也一樣先放著不講；<strong>立方公尺</strong>在五年級的「大地測量隊」；<strong>表面積</strong>是六年級的內容。',",
      why:"the formula would be promised for this lesson instead of handed on to grade 5" },
    { file:"index", via:"index", expect:"SIBLING: \"不一定比較大\"",
      find:"      s4note:'💬 <strong>比體積就是比塊數</strong>（方塊都一樣大的時候）。<strong>比較高的不一定比較大</strong>，占的桌面比較大的也不一定比較大 —— 要數過才知道。",
      replace:"      s4note:'💬 <strong>比體積就是比塊數</strong>（方塊都一樣大的時候）。<strong>比較高的通常比較大</strong>，占的桌面比較大的也通常比較大 —— 要數過才知道。",
      why:"the rule would be stated with 'usually bigger' beside it — the pinned wording count drops" },
    { file:"reference", via:"index", expect:"FORBIDDEN",
      find:"      m2b:'❌ 甲比較高，所以甲的體積比較大。',",
      replace:"      m2b:'❌ 高的一定比較大。',",
      why:"a phrase this lesson must never print, even as the wrong side of a contrast" },
    { file:"parents", via:"index", expect:"KEY: parents.html s1p2 no longer says",
      find:"在這一課的約定裡不是：<strong>每一塊都放在桌上或另一塊的正上方</strong>，所以藏起來的方塊一定在那裡，一定要數。',",
      replace:"在這一課的約定裡不是：<strong>每一塊都放在桌上或另一塊的上面</strong>，所以藏起來的方塊一定在那裡，一定要數。',",
      why:"the parents page would drop the 'directly on top' premise that makes hidden cubes certain" },
    { file:"reference", via:"index", expect:"must not draw any SVG",
      find:"  <header>\n    <h1 data-i18n=\"h1\">🗂️ 速查卡：方塊盤點站</h1>",
      replace:"  <svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"></circle></svg>\n  <header>\n    <h1 data-i18n=\"h1\">🗂️ 速查卡：方塊盤點站</h1>",
      why:"the cheat sheet is deliberately text-only" },
    { file:"index", via:"index", expect:"creates an SVG <text>",
      find:"  function drawFloor(svg, y){\n    svg.appendChild(svgEl('line',",
      replace:"  function drawFloor(svg, y){\n    svg.appendChild(svgEl('text', { x:10, y:10 }));\n    svg.appendChild(svgEl('line',",
      why:"this lesson's figures carry no text at all; a <text> would bypass every geometry assertion" },
    { file:"index", via:"index", expect:"the comment scanner cannot be trusted on it",
      find:"  var C_HIDDEN_FILL = 'rgba(214,69,69,.10)', C_HIDDEN_EDGE = '#D64545';",
      replace:"  var C_TPL = `x`;\n  var C_HIDDEN_FILL = 'rgba(214,69,69,.10)', C_HIDDEN_EDGE = '#D64545';",
      why:"a template literal is exactly what the comment scanner cannot follow, so it must fail closed" },
    { file:"index", via:"index", expect:"teachme-last",
      find:"JSON.stringify({p:'grade-4/math/cubes/',",
      replace:"JSON.stringify({p:'grade-4/math/congruent/',",
      why:"the home page's 'continue' button would send the child to the wrong lesson" },
    { file:"index", via:"index", expect:"checked 0 equations",
      find:"      s3calc:function(cells, layers, n){ return '高度圖：' + cells.join(' ＋ ') + ' ＝ ' + n + '　·　分層：' + layers.join(' ＋ ') + ' ＝ ' + n; },",
      replace:"      s3calc:function(cells, layers, n){ return '高度圖：' + cells.join(' 加 ') + ' 是 ' + n + '　·　分層：' + layers.join(' 加 ') + ' 是 ' + n; },",
      why:"the equations would be written in words the verifier cannot read, so the pinned count of verified equations drops" },

    /* --- review.html 的產生器（走 simgen） --- */
    { file:"review", via:"review", expect:"countStack: hidden must be at least 1",
      find:"          var vis = visibility(H);\n          if (vis.hidden < 1) return null;\n          var opts = numOpts(vis.total, [vis.visible, footprint(H), vis.total + 1, vis.total - 1], [], inCubesPos);",
      replace:"          var vis = visibility(H);\n          var opts = numOpts(vis.total, [vis.visible, footprint(H), vis.total + 1, vis.total - 1], [], inCubesPos);",
      why:"a counting question with nothing hidden would lose its point (and its 'visible' distractor would equal the key)" },
    { file:"review", via:"review", expect:"opts[ans] != correct",
      find:"          return { H:H, total:vis.total, visible:vis.visible, hidden:vis.hidden, opts:opts, ans:opts.indexOf(vis.total) };\n        });\n      },\n      fmt:function(d, lang){\n        var t = TXT[lang];\n        return {\n          stem: lang === 'zh' ? '這一堆方塊每一塊都是 1 立方公分。",
      replace:"          return { H:H, total:vis.total, visible:vis.visible, hidden:vis.hidden, opts:opts, ans:opts.indexOf(vis.visible) };\n        });\n      },\n      fmt:function(d, lang){\n        var t = TXT[lang];\n        return {\n          stem: lang === 'zh' ? '這一堆方塊每一塊都是 1 立方公分。",
      why:"the counting question would be keyed to the visible count" },
    { file:"review", via:"review", expect:"hiddenCount: hidden is wrong",
      find:"          var opts = numOpts(vis.hidden, [0, vis.total, vis.visible, vis.hidden + 1], [], inCubes);\n          if (!opts) return null;\n          return { H:H, total:vis.total, visible:vis.visible, hidden:vis.hidden, opts:opts, ans:opts.indexOf(vis.hidden) };",
      replace:"          var opts = numOpts(vis.hidden, [0, vis.total, vis.visible, vis.hidden + 1], [], inCubes);\n          if (!opts) return null;\n          return { H:H, total:vis.total, visible:vis.visible, hidden:vis.hidden + 1, opts:opts, ans:opts.indexOf(vis.hidden) };",
      why:"the recorded hidden count would disagree with the picture" },
    { file:"review", via:"review", expect:"heightMap: total is wrong",
      find:"          var total = volume(H), cells = cellList(H);\n          var box = footprint(H) * maxH(H);",
      replace:"          var total = volume(H) + 1, cells = cellList(H);\n          var box = footprint(H) * maxH(H);",
      why:"the height-map total would be one too many" },
    { file:"review", via:"review", expect:"compareTwo: key",
      find:"          var key = whoBigger(volume(A), volume(B));\n          var keys = shuffle(COMPARE_KEYS);\n          return { A:A, B:B, volA:volume(A), volB:volume(B), tallA:maxH(A), tallB:maxH(B), key:key, keys:keys, ans:keys.indexOf(key) };",
      replace:"          var key = whoBigger(maxH(A), maxH(B));\n          var keys = shuffle(COMPARE_KEYS);\n          return { A:A, B:B, volA:volume(A), volB:volume(B), tallA:maxH(A), tallB:maxH(B), key:key, keys:keys, ans:keys.indexOf(key) };",
      why:"the comparison would be decided by height — the misconception itself" },
    { file:"review", via:"review", expect:"towerFlat: equal counts",
      find:"          var a = 3 + rand(3), b = 3 + rand(7);\n          if (a === b) return null;",
      replace:"          var a = 3 + rand(3), b = 3 + rand(7);",
      why:"equal counts would be keyed to 'A bigger' or 'B bigger'" },
    { file:"review", via:"review", expect:"stem is not the expected sentence",
      find:"          stem: lang === 'zh' ? '一堆 1 立方公分的方塊有 <strong>' + d.n + ' 塊</strong>，疊成 ' + d.a + ' 層。把它<strong>全部搬動重新排</strong>成 ' + d.b + ' 層（一塊都沒有多、沒有少）。搬完之後體積是幾立方公分？'",
      replace:"          stem: lang === 'zh' ? '一堆 1 立方公分的方塊有 <strong>' + d.n + ' 塊</strong>，疊成 ' + d.a + ' 層。把它<strong>全部搬動重新排</strong>成 ' + d.b + ' 層（一塊都沒有多、沒有少）。搬完之後體積是幾立方公分？疊了幾層？'",
      why:"a second question would be tacked onto the stem — only the exact-stem rebuild can see it" },
    { file:"review", via:"review", expect:"addRemove: result is wrong",
      find:"          var ans = add ? n + k : n - k;\n          if (ans < 1 || ans > MAX_CUBES) return null;",
      replace:"          var ans = add ? n + k : n - k + 1;\n          if (ans < 1 || ans > MAX_CUBES) return null;",
      why:"taking cubes away would be off by one" },
    { file:"review", via:"review", expect:"layersSum: layers must not grow upwards",
      find:"          for (var i = 0; i < L; i++){ layers.push(top); top = 1 + rand(top); }",
      replace:"          for (var i = 0; i < L; i++){ layers.push(top); top = 1 + rand(8); }",
      why:"a higher layer could hold more cubes than the one below it, which no real pile can" },
    { file:"review", via:"review", expect:"layersSum: multiplying layer 1 by the layer count equals the key",
      find:"          if (layers[0] * L === total) return null;   // 每一層都一樣多時「乘起來」剛好是正解，換一組",
      replace:"          // (removed)",
      why:"when every layer is equal, the 'multiply' distractor equals the key" },
    { file:"review", via:"review", expect:"unitCube: ans must point at the 1 cm cube",
      find:"          return { k:k, keys:keys, ans:keys.indexOf('cube1') };",
      replace:"          return { k:k, keys:keys, ans:keys.indexOf('square1') };",
      why:"a square would be keyed as 1 cubic centimetre" },
    { file:"review", via:"review", expect:"squareArea: side out of range",
      find:"          if (area === 2 * a) return null;    // 邊長 2 時「邊長 × 2」也是 4",
      replace:"          a = 2; area = 4; perim = 8;",
      why:"a 2 cm square makes 'double the side' equal the true area, so two options would collide" },
    { file:"review", via:"review", expect:"whichVolume: two candidates share a volume",
      find:"            if (vols[volume(H)]) return null;     // 四堆的體積要互不相同，答案才唯一",
      replace:"            // (removed)",
      why:"two piles could share the target volume, so a correct choice could be marked wrong" },
    { file:"review", via:"review", expect:"solidParts: count is wrong",
      find:"  var SOLID_PARTS = { face:6, edge:12, vertex:8 };",
      replace:"  var SOLID_PARTS = { face:6, edge:8, vertex:12 };",
      why:"edges and vertices would be swapped" },
    { file:"review", via:"review", expect:"is off the reference projection",
      find:"  var WHICH_U = 24;                                  // 「哪一堆」的四堆用小一點的格",
      replace:"  var WHICH_U = 20;                                  // 「哪一堆」的四堆用小一點的格",
      why:"the four small piles would be drawn at a size the checker does not expect" },
    { file:"review", via:"review", expect:"less than one square apart",
      find:"    var A = stackPlan(HA, FIG_W * PAIR_CX_A - ea.w * U / 2, Y0, U);\n    var B = stackPlan(HB, FIG_W * PAIR_CX_B - eb.w * U / 2, Y0, U);\n    return { kind:'pair'",
      replace:"    var A = stackPlan(HA, FIG_W * 0.45 - ea.w * U / 2, Y0, U);\n    var B = stackPlan(HB, FIG_W * 0.55 - eb.w * U / 2, Y0, U);\n    return { kind:'pair'",
      why:"the two piles would touch and read as one" },
    { file:"review", via:"review", expect:"figure caption contains a digit",
      find:"      capSingle:'📦 每一塊都是 1 立方公分；看不到的方塊也在',",
      replace:"      capSingle:'📦 每一塊都是 1 立方公分；看不到的方塊也在，一共 8 塊',",
      why:"the caption would print an answer" },
    { file:"review", via:"review", expect:"missing space between Chinese and a digit",
      find:"      vol:function(n){ return n + ' 立方公分'; },\n      cubes:function(n){ return n + ' 塊'; },",
      replace:"      vol:function(n){ return n + '立方公分'; },\n      cubes:function(n){ return n + ' 塊'; },",
      why:"Chinese glued to a digit is only visible once the option is rendered" },
    { file:"review", via:"review", expect:"floor line",
      find:"    return { kind:'single', w:FIG_W, h:FIG_H, floorY:plan.box.y + plan.box.h + 0.5, stacks:[{ H:H, tone:'a', plan:plan }] };",
      replace:"    return { kind:'single', w:FIG_W, h:FIG_H, floorY:plan.box.y + plan.box.h + 12, stacks:[{ H:H, tone:'a', plan:plan }] };",
      why:"the floor line would float below the pile" },
    /* --- 小遊戲：盤點站出任務（2026-10-08，五關五種玩法） --- */
    { file:"index", via:"index", expect:"installed right after the drag really starts",
      find:"      PIECE_PTR[e.pointerId] = true;\n      /* 只跟著第一根手指：第二根手指不能拿起任何一塊（第一根手指按在別處時也一樣；codex 第一輪） */\n      if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;\n      e.preventDefault();\n      pid = e.pointerId;\n      try { el.setPointerCapture(e.pointerId); } catch(err){}\n      start = B.toBoard(e); orig = { x:P.cx, y:P.cy }; moved = false;\n      document.addEventListener('pointerup', onDocEnd);\n      document.addEventListener('pointercancel', onDocEnd);\n    });",
      replace:"      PIECE_PTR[e.pointerId] = true;\n      document.addEventListener('pointercancel', onDocEnd);\n      /* 只跟著第一根手指：第二根手指不能拿起任何一塊（第一根手指按在別處時也一樣；codex 第一輪） */\n      if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;\n      e.preventDefault();\n      pid = e.pointerId;\n      try { el.setPointerCapture(e.pointerId); } catch(err){}\n      start = B.toBoard(e); orig = { x:P.cx, y:P.cy }; moved = false;\n      document.addEventListener('pointerup', onDocEnd);\n    });",
      why:"the pointercancel fallback would be installed before the guards, so a refused second finger leaves a listener behind" },
    { file:"index", via:"index", expect:"pointercancel fallback must be installed exactly once",
      find:"      document.addEventListener('pointerup', onDocEnd);\n      document.addEventListener('pointercancel', onDocEnd);\n    });",
      replace:"      document.addEventListener('pointerup', onDocEnd);\n    });\n    document.addEventListener('pointercancel', onDocEnd);",
      why:"the pointercancel fallback would be installed outside the drag, once per piece" },
    { file:"index", via:"index", expect:"listener must be removed once in stopGesture() and once in end()",
      find:"    function stopGesture(){\n      if (!start) return;\n      start = null; pid = null;\n      document.removeEventListener('pointerup', onDocEnd);\n      document.removeEventListener('pointercancel', onDocEnd);\n      el.classList.remove('dragging');\n    }\n    P.busy = function(){ return !!start; };\n    el.addEventListener('pointerdown', function(e){\n      PIECE_PTR[e.pointerId] = true;\n      /* 只跟著第一根手指：第二根手指不能拿起任何一塊（第一根手指按在別處時也一樣；codex 第一輪） */\n      if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;\n      e.preventDefault();\n      pid = e.pointerId;\n      try { el.setPointerCapture(e.pointerId); } catch(err){}\n      start = B.toBoard(e); orig = { x:P.cx, y:P.cy }; moved = false;\n      document.addEventListener('pointerup', onDocEnd);\n      document.addEventListener('pointercancel', onDocEnd);\n    });\n    el.addEventListener('pointermove', function(e){\n      if (!start || e.pointerId !== pid) return;\n      var p = B.toBoard(e), dx = p.x - start.x, dy = p.y - start.y;\n      if (!moved && dx * dx + dy * dy > 36){ moved = true; el.classList.add('dragging'); }\n      if (!moved) return;\n      P.place(orig.x + dx, orig.y + dy);\n    });\n    function end(e, cancelled){\n      if (!start || e.pointerId !== pid) return;\n      start = null; pid = null;\n      document.removeEventListener('pointerup', onDocEnd);\n      document.removeEventListener('pointercancel', onDocEnd);\n      el.classList.remove('dragging');\n",
      replace:"    function stopGesture(){\n      if (!start) return;\n      start = null; pid = null;\n      document.removeEventListener('pointerup', onDocEnd);\n      document.removeEventListener('pointercancel', onDocEnd);\n      document.removeEventListener('pointerup', onDocEnd);\n      document.removeEventListener('pointercancel', onDocEnd);\n      el.classList.remove('dragging');\n    }\n    P.busy = function(){ return !!start; };\n    el.addEventListener('pointerdown', function(e){\n      PIECE_PTR[e.pointerId] = true;\n      /* 只跟著第一根手指：第二根手指不能拿起任何一塊（第一根手指按在別處時也一樣；codex 第一輪） */\n      if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;\n      e.preventDefault();\n      pid = e.pointerId;\n      try { el.setPointerCapture(e.pointerId); } catch(err){}\n      start = B.toBoard(e); orig = { x:P.cx, y:P.cy }; moved = false;\n      document.addEventListener('pointerup', onDocEnd);\n      document.addEventListener('pointercancel', onDocEnd);\n    });\n    el.addEventListener('pointermove', function(e){\n      if (!start || e.pointerId !== pid) return;\n      var p = B.toBoard(e), dx = p.x - start.x, dy = p.y - start.y;\n      if (!moved && dx * dx + dy * dy > 36){ moved = true; el.classList.add('dragging'); }\n      if (!moved) return;\n      P.place(orig.x + dx, orig.y + dy);\n    });\n    function end(e, cancelled){\n      if (!start || e.pointerId !== pid) return;\n      start = null; pid = null;\n      el.classList.remove('dragging');\n",
      why:"(relocation) both removals moved into stopGesture(), none left in end(): totals unchanged" },
    { file:"index", via:"index", expect:"fallback must be installed exactly once, inside the pointerdown handler",
      find:"      start = B.toBoard(e); orig = { x:P.cx, y:P.cy }; moved = false;\n      document.addEventListener('pointerup', onDocEnd);\n",
      replace:"      start = B.toBoard(e); orig = { x:P.cx, y:P.cy }; moved = false;\n",
      why:"a released piece whose capture failed would stay stuck mid-drag" },
    { file:"index", via:"index", expect:"removed once in stopGesture() and once in end()",
      find:"      start = null; pid = null;\n      document.removeEventListener('pointerup', onDocEnd);\n      document.removeEventListener('pointercancel', onDocEnd);\n      el.classList.remove('dragging');\n    }\n",
      replace:"      start = null; pid = null;\n      el.classList.remove('dragging');\n    }\n",
      why:"document listeners would pile up whenever a held piece is locked" },
    { file:"index", via:"index", expect:"removed once in stopGesture() and once in end()",
      find:"      start = null; pid = null;\n      document.removeEventListener('pointerup', onDocEnd);\n      document.removeEventListener('pointercancel', onDocEnd);\n      el.classList.remove('dragging');\n      if (gen",
      replace:"      start = null; pid = null;\n      el.classList.remove('dragging');\n      if (gen",
      why:"document listeners would pile up after every drag" },
    { file:"index", via:"index", expect:"bad english singular",
      find:"' does not have ' + v + ' ' + plEn(v, 'cube') + ': only '",
      replace:"' does not have ' + v + ' cubes: only '",
      why:"'does not have 1 cubes' (only reachable if a layer count of 0 is ever pooled)" },
    { file:"index", via:"index", expect:"buildJudge(",
      find:"    if (target[r][c] === 0) return 'empty';",
      replace:"    if (false) return 'empty';",
      why:"a cube could go on a square the picture leaves empty" },
    { file:"index", via:"index", expect:"buildJudge(",
      find:"    if (built[r][c] >= target[r][c]) return 'full';",
      replace:"    if (built[r][c] > target[r][c]) return 'full';",
      why:"one cube too many would be accepted on every square" },
    { file:"index", via:"index", expect:"only 1 hidden",
      find:"    [[3, 3], [2, 0]],\n",
      replace:"    [[2, 2], [1, 1]],\n",
      why:"a copy pile with one hidden cube barely exercises 'hidden cubes count too'" },
    { file:"index", via:"index", expect:"hides a whole column behind the others",
      find:"    [[3, 3], [2, 0]],\n",
      replace:"    [[1, 0], [2, 2]],\n",
      why:"a copy pile whose back column is completely hidden cannot be read off the picture" },
    { file:"index", via:"index", expect:"draws the same picture as another pile",
      find:"    [[3, 3], [2, 0]],\n",
      replace:"    [[0, 3, 2], [2, 2, 0]],\n",
      why:"every top is visible, but the same picture also fits a pile with one more hidden cube" },
    { file:"index", via:"index", expect:"refuses an empty square",
      find:"        if (j === 'empty'){ roundMiss(d.gBuildEmpty); return false; }",
      replace:"        if (j === 'empty'){ return false; }",
      why:"a cube on an empty square would bounce without its reason or penalty" },
    { file:"index", via:"index", expect:"solved exactly when",
      find:"        if (sameStack(built, T)){",
      replace:"        if (n >= volume(T) - 1){",
      why:"the round would be cleared one cube early" },
    { file:"index", via:"index", expect:"not on the mat grid",
      find:"cy:BUILD.matTop + (r + 0.5) * BUILD.cell, hw:BUILD.cell / 2",
      replace:"cy:BUILD.matTop + (rows(H) - r - 0.5) * BUILD.cell, hw:BUILD.cell / 2",
      why:"the back row of the mat would be drawn at the front" },
    { file:"index", via:"index", expect:"under 44",
      find:"cell:58, matTop:200",
      replace:"cell:40, matTop:200",
      why:"mat squares too small for a finger on a phone" },
    { file:"index", via:"index", expect:"cube source sits inside the drop zone",
      find:"srcX:258, pad:6",
      replace:"srcX:214, pad:6",
      why:"picking up the cube would start inside a square's drop zone" },
    { file:"index", via:"index", expect:"drawn outside its box",
      find:"boxY:26, boxH:140, boxW:146",
      replace:"boxY:26, boxH:80, boxW:146",
      why:"the copy picture would spill out of its panel" },
    { file:"index", via:"index", expect:"tap-then-tap no longer places",
      find:"      B.onPointTap = function(P, pt){\n        if (P.busy() || gSolved) return;\n        place(P, { x:pt.x, y:pt.y, tap:true });",
      replace:"      B.onPointTap = function(P, pt){\n        place(P, { x:pt.x, y:pt.y, tap:true });",
      why:"a tap while another finger drags the cube would also place one" },
    { file:"index", via:"index", expect:"same number of cubes",
      find:"[[[3, 2], [1, 1]], [[2, 3], [1, 1]], [[3, 1], [2, 1]]],",
      replace:"[[[3, 2], [1, 1]], [[2, 3], [1, 1]], [[3, 1], [2, 2]]],",
      why:"the totals would give one match away" },
    { file:"index", via:"index", expect:"matchDiff(",
      find:"      if (card[r][c] !== pile[r][c]) return { r:r, c:c, a:card[r][c], b:pile[r][c] };",
      replace:"      if (card[r][c] !== pile[r][c]) return { r:r, c:c, a:pile[r][c], b:card[r][c] };",
      why:"the reason would say the card's number is the pile's" },
    { file:"index", via:"index", expect:"wrong pile is not refused",
      find:"        if (diff){\n          P.cellEls",
      replace:"        if (diff && false){\n          P.cellEls",
      why:"any card would be accepted on any pile" },
    { file:"index", via:"index", expect:"the tray started in answer order",
      find:"    if (o.every(function(v, i){ return v === i; })){ var t = o[0]; o[0] = o[1]; o[1] = t; }\n",
      replace:"",
      why:"the cards could start under their own piles" },
    { file:"index", via:"index", expect:"does not cover the drawn pile",
      find:"      var top = MATCH.boxY, bottom",
      replace:"      var top = MATCH.slotY, bottom",
      why:"dropping a card on the drawn pile itself would be ignored" },
    { file:"index", via:"index", expect:"two piles look the same",
      find:"[[[2, 2], [1, 1]], [[2, 1], [2, 1]], [[2, 1], [1, 2]]]",
      replace:"[[[2, 2], [1, 1]], [[2, 1], [2, 1]], [[2, 1], [2, 1]]]",
      why:"two of the three piles would be the same pile" },
    { file:"index", via:"index", expect:"layerJudge(",
      find:"    return v === n ? 'ok' : v > n ? 'more' : 'less';",
      replace:"    return v >= n ? 'ok' : 'less';",
      why:"a count that is too big would be accepted" },
    { file:"index", via:"index", expect:"a wrong count is not refused",
      find:"        if (j === 'less'){ roundMiss(d.gLayerLess(S.L, v, c)); return false; }",
      replace:"        if (j === 'less'){ return false; }",
      why:"too small a count would bounce with no reason" },
    { file:"index", via:"index", expect:"layer 1 has no hidden cube",
      find:"    [[3, 3, 1], [1, 1, 0]],\n    [[1, 3, 2], [1, 2, 0]],",
      replace:"    [[3, 2, 1], [0, 0, 0]],\n    [[1, 3, 2], [1, 2, 0]],",
      why:"a pile whose bottom layer can all be seen does not test hidden cubes" },
    { file:"index", via:"index", expect:"not in its row",
      find:"cy:LAYERS.rowTop + (m - L) * LAYERS.rowStep + LAYERS.slot / 2",
      replace:"cy:LAYERS.rowTop + (L - 1) * LAYERS.rowStep + LAYERS.slot / 2",
      why:"layer 1 would be drawn at the top" },
    { file:"index", via:"index", expect:"layer label runs into the picture",
      find:"pad:6, lblW:56, unitW:36",
      replace:"pad:6, lblW:70, unitW:36",
      why:"the layer label would sit on the picture" },
    { file:"index", via:"index", expect:"sortRank(",
      find:"    set.forEach(function(H){ if (volume(H) < v) k++; });",
      replace:"    set.forEach(function(H){ if (volume(H) <= v) k++; });",
      why:"every rank would be off by one" },
    { file:"index", via:"index", expect:"the tray started sorted",
      find:"    if (sortRank(set, o[0]) === 0 && sortRank(set, o[1]) === 1){ var t = o[0]; o[0] = o[1]; o[1] = t; }\n",
      replace:"",
      why:"the cards could start already sorted" },
    { file:"index", via:"index", expect:"tallest pile has the most",
      find:"    [[[4]], [[2, 1], [1, 1]], [[1, 1, 1], [1, 1, 1]]],",
      replace:"    [[[4, 3]], [[2, 1], [1, 1]], [[1, 1, 1], [1, 1, 1]]],",
      why:"'taller is not always bigger' would not be tested" },
    { file:"index", via:"index", expect:"wrong box is not refused",
      find:"        if (sortRank(set, P.data.i) !== S.i){",
      replace:"        if (false){",
      why:"any pile would be accepted in any box" },
    { file:"index", via:"index", expect:"say more/fewer the wrong way round",
      find:"比這一格要放的那一堆多。'; },",
      replace:"比這一格要放的那一堆少。'; },",
      why:"the reason would say 'fewer' for a pile that has more" },
    { file:"index", via:"index", expect:"exactly two piles must match A",
      find:"[[[3, 3]], [[2, 2], [2, 1]], [[1, 1, 1], [1, 1, 1]], [[3, 2]]] },",
      replace:"[[[3, 3]], [[2, 2], [2, 1]], [[1, 1, 1], [1, 1, 1]], [[3, 2, 1]]] },",
      why:"three piles would match A while the counter says 2" },
    { file:"index", via:"index", expect:"tapPick() disagrees",
      find:"    for (var i = 0; i < f.length; i++) if (pt.x >= f[i].x && pt.x <= f[i].x + f[i].w",
      replace:"    for (var i = 0; i < f.length; i++) if (pt.x >= f[i].x + 12 && pt.x <= f[i].x + f[i].w",
      why:"a tap on the left part of a drawn frame would be ignored" },
    { file:"index", via:"index", expect:"different count is not refused",
      find:"        if (!tapSame(e.base, H)){ roundMiss(d.gTapBad(volume(H), n)); return; }",
      replace:"        if (false){ roundMiss(d.gTapBad(volume(H), n)); return; }",
      why:"any pile would count as the same as A" },
    { file:"index", via:"index", expect:"no matching pile is taller/flatter",
      find:"    { base:[[2, 1], [1, 1]], cands:[[[2, 1], [2, 1]], [[3, 2]], [[3, 1]], [[1, 1, 1], [1, 1, 0]]] }",
      replace:"    { base:[[2, 1], [1, 1]], cands:[[[2, 1], [2, 1]], [[1, 2], [1, 1]], [[3, 1]], [[1, 1], [2, 1]]] }",
      why:"the matching piles would only be A turned around, not a real rearrangement" },
    { file:"index", via:"index", expect:"nearestOpen()",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }",
      why:"the first square in array order would win over the nearer one" },
    { file:"index", via:"index", expect:"nearestOpen()",
      find:"      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;",
      replace:"      var dd = dx * dx + dy * dy, dc = dd;",
      why:"nearest would be measured to the centre, not the box" },
    { file:"index", via:"index", expect:"board generation",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n",
      replace:"",
      why:"a cube held across a restart could act on the new board" },
    { file:"index", via:"index", expect:"second finger can pick up",
      find:"      if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;",
      replace:"      if (P.locked || gSolved || start || gen !== gGen) return;",
      why:"a second finger could drag a piece" },
    { file:"index", via:"index", expect:"lostpointercapture",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"",
      why:"a piece could get stuck when capture is lost" },
    { file:"index", via:"index", expect:"GAME scoring",
      find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;",
      replace:"    gScore = gScore - 5; elScore.textContent = gScore;",
      why:"the score could go below 0" },
    { file:"index", via:"index", expect:"+20 with no mistakes and +10",
      find:"    var pts = gMistake ? 10 : 20;",
      replace:"    var pts = 20;",
      why:"a round with mistakes would still give +20" },
    { file:"index", via:"index", expect:"does not really shuffle",
      find:"      var k = Math.floor(Math.random() * (j + 1));   /* 自足",
      replace:"      var k = j;   /* 自足",
      why:"shuffle() would return its input" },
    { file:"index", via:"index", expect:"ahead mode",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"    if (mode === 'aheadX'){ hintLevel = 1; showHint(); }",
      why:"ahead mode would lose its automatic hint" },
    { file:"index", via:"index", expect:"build done (en)",
      find:" cubic centimetres. The picture shows ' + v + ' cubes and ",
      replace:" cubic centimetres. The picture shows ' + n + ' cubes and ",
      why:"the English summary would say all the cubes can be seen" },
    { file:"index", via:"index", expect:"layer more (zh)",
      find:"高度圖裡疊到第 ' + L + ' 層的只有 ' + c + ' 格",
      replace:"高度圖裡疊到第 ' + L + ' 層的只有 ' + v + ' 格",
      why:"the reason would repeat the wrong count" },
    { file:"index", via:"index", expect:"match bad (zh)",
      find:"'紅框那一格：高度圖寫 ' + a + '，這一堆那一格疊 ' + b + ' 層。'",
      replace:"'紅框那一格：高度圖寫 ' + b + '，這一堆那一格疊 ' + a + ' 層。'",
      why:"the reason would swap the card's and the pile's numbers" },
    { file:"index", via:"index", expect:"tap bad (en)",
      find:"'This pile has ' + a + ' cubes and A has ' + n +",
      replace:"'This pile has ' + n + ' cubes and A has ' + n +",
      why:"the reason would give A's count for the wrong pile" },
    { file:"index", via:"index", expect:"layers done (zh)",
      find:"' ＝ ' + n + ' 塊。高度圖每一格",
      replace:"' ＝ ' + (n + 1) + ' 塊。高度圖每一格",
      why:"the layer sum would not add up" },
    { file:"index", via:"index", expect:"sort: the cards are not drawn with miniPlan()",
      find:"        P.el.appendChild(miniSvg(set[pi]));",
      replace:"        P.el.appendChild(pileSvg(set[pi], 60, 60, 14, 'a'));",
      why:"the cards would be drawn some other way, so the miniPlan() checks would not cover them" }
  ],

  /* ================= review.html 的產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      countStack: function(d){
        if (!d) return 'countStack: make() returned nothing';
        if (!validRef(d.H)) return 'countStack: not a valid height map';
        if (!allTopsVisibleRef(d.H)) return 'countStack: a whole column is hidden behind the others, so the picture cannot be counted';
        if (volumeRef(d.H) < 5 || volumeRef(d.H) > 20) return 'countStack: volume out of range';
        if (d.total !== volumeRef(d.H)) return 'countStack: total is wrong';
        if (d.visible !== visibleCountRef(d.H)) return 'countStack: visible count disagrees with the ray-cast reference';
        if (d.hidden !== d.total - d.visible) return 'countStack: hidden is wrong';
        if (d.hidden < 1) return 'countStack: hidden must be at least 1 or the question has no point';
        if (!fourDistinctNums(d.opts)) return 'countStack: options not four distinct whole numbers';
        if (d.opts.indexOf(d.visible) < 0) return 'countStack: does not offer the visible count as a distractor';
        if (d.opts[d.ans] !== d.total) return 'countStack: ans does not point at the total';
        return null;
      },
      hiddenCount: function(d){
        if (!d) return 'hiddenCount: make() returned nothing';
        if (!validRef(d.H)) return 'hiddenCount: not a valid height map';
        if (!allTopsVisibleRef(d.H)) return 'hiddenCount: a whole column is hidden behind the others, so the picture cannot be counted';
        if (d.total !== volumeRef(d.H)) return 'hiddenCount: total is wrong';
        if (d.visible !== visibleCountRef(d.H)) return 'hiddenCount: visible count disagrees with the ray-cast reference';
        if (d.hidden !== d.total - d.visible) return 'hiddenCount: hidden is wrong';
        if (d.hidden < 1) return 'hiddenCount: nothing is hidden';
        if (!fourDistinctNums(d.opts)) return 'hiddenCount: options not four distinct whole numbers';
        if (d.opts[d.ans] !== d.hidden) return 'hiddenCount: ans does not point at the hidden count';
        return null;
      },
      heightMap: function(d){
        if (!d) return 'heightMap: make() returned nothing';
        if (!validRef(d.H) || d.H.length !== 2) return 'heightMap: not a valid 2-row height map';
        if (d.total !== volumeRef(d.H)) return 'heightMap: total is wrong';
        if (!eqJ(d.cells, cellsRef(d.H))) return 'heightMap: cells are wrong';
        if (!fourDistinctNums(d.opts)) return 'heightMap: options not four distinct whole numbers';
        if (d.opts[d.ans] !== d.total) return 'heightMap: ans does not point at the total';
        return null;
      },
      compareTwo: function(d){
        if (!d) return 'compareTwo: make() returned nothing';
        if (!validRef(d.A) || !validRef(d.B)) return 'compareTwo: not valid height maps';
        if (eqJ(d.A, d.B)) return 'compareTwo: the two piles are identical';
        if (!allTopsVisibleRef(d.A) || !allTopsVisibleRef(d.B)) return 'compareTwo: a whole column is hidden behind the others, so the picture cannot be counted';
        if (d.volA !== volumeRef(d.A) || d.volB !== volumeRef(d.B)) return 'compareTwo: volumes are wrong';
        if (d.tallA !== maxHRef(d.A) || d.tallB !== maxHRef(d.B)) return 'compareTwo: heights are wrong';
        const keyRef = d.volA > d.volB ? 'aBigger' : d.volB > d.volA ? 'bBigger' : 'same';
        if (d.key !== keyRef) return 'compareTwo: key ' + d.key + ' but the reference says ' + keyRef;
        if (!isPerm(d.keys, COMPARE_KEYS_REF)) return 'compareTwo: options are not the four conclusions';
        if (d.keys[d.ans] !== d.key) return 'compareTwo: ans does not point at the key';
        return null;
      },
      towerFlat: function(d){
        if (!d) return 'towerFlat: make() returned nothing';
        if (!(d.a >= 3 && d.a <= 5 && d.b >= 3 && d.b <= 9)) return 'towerFlat: counts out of range';
        if (d.a === d.b) return 'towerFlat: equal counts would make the tower-vs-flat contrast pointless';
        const keyRef = d.a > d.b ? 'aBigger' : 'bBigger';
        if (d.key !== keyRef) return 'towerFlat: key ' + d.key + ' but the reference says ' + keyRef;
        if (!isPerm(d.keys, COMPARE_KEYS_REF)) return 'towerFlat: options are not the four conclusions';
        if (d.keys[d.ans] !== d.key) return 'towerFlat: ans does not point at the key';
        return null;
      },
      rearrange: function(d){
        if (!d) return 'rearrange: make() returned nothing';
        if (!(d.n >= 6 && d.n <= 24 && d.a >= 2 && d.a <= 4 && d.b >= 2 && d.b <= 4 && d.a !== d.b)) return 'rearrange: parameters out of range';
        if (!fourDistinctNums(d.opts)) return 'rearrange: options not four distinct whole numbers';
        if (d.opts[d.ans] !== d.n) return 'rearrange: ans does not point at n';
        return null;
      },
      addRemove: function(d){
        if (!d) return 'addRemove: make() returned nothing';
        if (!(d.n >= 6 && d.n <= 25 && d.k >= 2 && d.k <= 7)) return 'addRemove: parameters out of range';
        const res = d.add ? d.n + d.k : d.n - d.k;
        if (d.res !== res) return 'addRemove: result is wrong';
        if (res < 1 || res > MAX_CUBES_REF) return 'addRemove: result out of range';
        if (!fourDistinctNums(d.opts)) return 'addRemove: options not four distinct whole numbers';
        if (d.opts[d.ans] !== res) return 'addRemove: ans does not point at the result';
        return null;
      },
      layersSum: function(d){
        if (!d) return 'layersSum: make() returned nothing';
        if (!Array.isArray(d.layers) || d.layers.length < 2 || d.layers.length > 3) return 'layersSum: needs 2 or 3 layers';
        for (let i = 1; i < d.layers.length; i++) if (d.layers[i] > d.layers[i - 1]) return 'layersSum: layers must not grow upwards';
        if (d.layers.some(x => !Number.isInteger(x) || x < 1 || x > 7)) return 'layersSum: a layer count out of range';
        const total = d.layers.reduce((s, x) => s + x, 0);
        if (d.total !== total) return 'layersSum: total is wrong';
        if (d.layers[0] * d.layers.length === total) return 'layersSum: multiplying layer 1 by the layer count equals the key';
        if (!fourDistinctNums(d.opts)) return 'layersSum: options not four distinct whole numbers';
        if (d.opts[d.ans] !== total) return 'layersSum: ans does not point at the total';
        return null;
      },
      unitCube: function(d){
        if (!d) return 'unitCube: make() returned nothing';
        if (!(d.k >= 2 && d.k <= 10)) return 'unitCube: k out of range';
        if (!isPerm(d.keys, UNIT_KEYS_REF)) return 'unitCube: options are not the four descriptions';
        if (d.keys[d.ans] !== 'cube1') return 'unitCube: ans must point at the 1 cm cube';
        return null;
      },
      squareArea: function(d){
        if (!d) return 'squareArea: make() returned nothing';
        if (!(d.a >= LEN_MIN_REF && d.a <= LEN_MAX_REF)) return 'squareArea: side out of range';
        if (d.area !== d.a * d.a || d.perim !== 4 * d.a) return 'squareArea: area or perimeter is wrong';
        if (d.area === d.perim || d.area === 2 * d.a) return 'squareArea: a distractor equals the key';
        if (!isPerm(d.keys, ['area', 'areaCubic', 'perim', 'double'])) return 'squareArea: options are not the four kinds';
        if (d.keys[d.ans] !== 'area') return 'squareArea: ans does not point at the area';
        return null;
      },
      whichVolume: function(d){
        if (!d) return 'whichVolume: make() returned nothing';
        if (!Array.isArray(d.Hs) || d.Hs.length !== 4) return 'whichVolume: needs four piles';
        for (const H of d.Hs){
          if (!validRef(H)) return 'whichVolume: a pile is not valid';
          if (H.length > 2 || H[0].length > 2 || maxHRef(H) > 3) return 'whichVolume: a pile is too big for its column';
          if (!allTopsVisibleRef(H)) return 'whichVolume: a whole column is hidden behind the others, so the picture cannot be counted';
        }
        const vols = d.Hs.map(volumeRef);
        if (new Set(vols).size !== 4) return 'whichVolume: two candidates share a volume, so the answer is not unique';
        if (!eqJ(d.vols, vols)) return 'whichVolume: recorded volumes are wrong';
        if (vols[d.ans] !== d.target) return 'whichVolume: ans does not point at the target pile';
        if (d.tone !== WHICH_TONES_REF[d.ans]) return 'whichVolume: tone does not match the answer';
        return null;
      },
      solidParts: function(d){
        if (!d) return 'solidParts: make() returned nothing';
        if (!(d.part in SOLID_REF)) return 'solidParts: unknown part';
        if (d.n !== SOLID_REF[d.part]) return 'solidParts: count is wrong for ' + d.part;
        if (!fourDistinctNums(d.opts)) return 'solidParts: options not four distinct whole numbers';
        if (d.opts[d.ans] !== d.n) return 'solidParts: ans does not point at the count';
        return null;
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      const t = TXT_REF[lang];
      switch (genId){
        case 'countStack': return t.vol(volumeRef(d.H));
        case 'hiddenCount': return t.cubes(volumeRef(d.H) - visibleCountRef(d.H));
        case 'heightMap': return t.vol(volumeRef(d.H));
        case 'compareTwo': { const a = volumeRef(d.A), b = volumeRef(d.B); return t.compareOpt[a > b ? 'aBigger' : b > a ? 'bBigger' : 'same']; }
        case 'towerFlat': return t.compareOpt[d.a > d.b ? 'aBigger' : d.b > d.a ? 'bBigger' : 'same'];
        case 'rearrange': return t.vol(d.n);
        case 'addRemove': return t.vol(d.add ? d.n + d.k : d.n - d.k);
        case 'layersSum': return t.vol(d.layers.reduce((s, x) => s + x, 0));
        case 'unitCube': return t.unitOpt.cube1;
        case 'squareArea': return t.sqcm(d.a * d.a);
        case 'whichVolume': { const hits = d.Hs.map(volumeRef).map((v, i) => v === d.target ? i : -1).filter(i => i >= 0); return hits.length === 1 ? t.colorName[WHICH_TONES_REF[hits[0]]] : '(no unique pile)'; }
        case 'solidParts': return t.count(SOLID_REF[d.part]);
        default: return '(no expectedCorrect rule for ' + genId + ')';
      }
    },

    /* 這一課的選項長什麼樣、範圍多少。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (GEN_IDS.indexOf(genId) < 0) return 'no optionOk rule for generator ' + genId;
      const t = TXT_REF[lang];
      const inSet = (obj) => Object.keys(obj).some(k => typeof obj[k] === 'string' && obj[k] === s);
      let m;
      if (genId === 'compareTwo' || genId === 'towerFlat') return inSet(t.compareOpt) ? null : 'option "' + s + '" is not one of the four conclusions';
      if (genId === 'whichVolume') return inSet(t.colorName) ? null : 'option "' + s + '" is not a colour';
      if (genId === 'unitCube'){
        if (inSet(t.unitOpt)) return null;
        m = (lang === 'zh') ? /^邊長 (\d+) 公分的正方體$/.exec(s) : /^A cube with (\d+) cm edges$/.exec(s);
        if (!m) return 'option "' + s + '" is not one of the four descriptions';
        const k = Number(m[1]);
        return (k >= 2 && k <= 10) ? null : 'option "' + s + '" has an edge out of range';
      }
      if (genId === 'solidParts'){
        m = (lang === 'zh') ? /^(\d+) 個$/.exec(s) : /^(\d+)$/.exec(s);
        if (!m) return 'option "' + s + '" is not a count';
        const v = Number(m[1]);
        return (v >= 1 && v <= 12) ? null : 'option ' + s + ' is outside 1~12';
      }
      if (genId === 'hiddenCount'){
        m = (lang === 'zh') ? /^(\d+) 塊$/.exec(s) : /^(\d+) (cube|cubes)$/.exec(s);
        if (!m) return 'option "' + s + '" is not a number of cubes';
        const v = Number(m[1]);
        if (lang === 'en' && ((v === 1) !== (m[2] === 'cube'))) return 'option "' + s + '" has the wrong singular/plural';
        return (v >= 0 && v <= MAX_CUBES_REF) ? null : 'option ' + s + ' is outside 0~40';
      }
      if (genId === 'squareArea'){
        m = (lang === 'zh') ? /^(\d+) (平方公分|立方公分)$/.exec(s) : /^(\d+) (square|cubic) (centimetre|centimetres)$/.exec(s);
        if (!m) return 'option "' + s + '" is not an area-or-volume amount';
        const v = Number(m[1]);
        if (lang === 'en' && ((v === 1) !== (m[3] === 'centimetre'))) return 'option "' + s + '" has the wrong singular/plural';
        if (isCorrect && !(m[2] === '平方公分' || m[2] === 'square')) return 'the correct area must be in square centimetres';
        return (v >= 1 && v <= 100) ? null : 'option ' + s + ' is outside 1~100';
      }
      /* 其餘都是「n 立方公分」。 */
      m = (lang === 'zh') ? /^(\d+) 立方公分$/.exec(s) : /^(\d+) cubic (centimetre|centimetres)$/.exec(s);
      if (!m) return 'option "' + s + '" is not a volume in cubic centimetres';
      const v = Number(m[1]);
      if (lang === 'en' && ((v === 1) !== (m[2] === 'centimetre'))) return 'option "' + s + '" has the wrong singular/plural';
      return (v >= 1 && v <= MAX_CUBES_REF) ? null : 'option ' + s + ' is outside 1~40';
    },

    /* 拿渲染出來的那一題再驗一次：題幹整句重建、圖的幾何、字、算式、誘答抄題幹。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!d) return 'make() returned nothing';
      const want = STEM_EXACT[genId] ? STEM_EXACT[genId](d)[lang] : null;
      if (want === null) out.push('no exact stem for ' + genId);
      else if (q.stem !== want) out.push('stem is not the expected sentence: "' + q.stem.replace(/<\/?[A-Za-z][^>]*>/g, '') + '"');
      arithProblems(q.stem + ' ' + q.why).problems.forEach(p => out.push('why/stem: ' + p));
      ['stem', 'why'].forEach(k => textProblems(q[k], lang, k).forEach(p => out.push(p)));
      q.opts.forEach((o, i) => textProblems(o, lang, 'option ' + i).forEach(p => out.push(p)));
      /* 誘答抄題幹的數字：選項的字串不是純數字，所以 simgen 的通用檢查看不到，這裡自己做。 */
      const stemNums = numbersIn(q.stem);
      q.opts.forEach(function(o, i){
        if (i === q.ans) return;
        const m = /^(\d+)\b/.exec(String(o));
        if (!m) return;
        const v = Number(m[1]);
        /* 題幹裡「1 立方公分」的 1 是單位，不算題幹的數字。 */
        const stemNumsNoUnit = numbersIn(String(q.stem).replace(/1 立方公分|1 cubic centimetre/g, ' '));
        if (stemNumsNoUnit.indexOf(v) >= 0 && !(STEM_ECHO_ALLOWED[genId] && STEM_ECHO_ALLOWED[genId](d, v)))
          out.push('distractor ' + o + ' copies a number out of the stem');
      });
      const wantFig = FIG_GENS.indexOf(genId) >= 0, wantTable = TABLE_GENS.indexOf(genId) >= 0;
      if (wantFig && !q.fig) out.push('this generator must come with a figure');
      if (!wantFig && q.fig) out.push('this generator must not come with a figure');
      if (wantTable && !q.table) out.push('this generator must come with a height-map table');
      if (!wantTable && q.table) out.push('this generator must not come with a table');
      if (q.table && !eqJ(q.table, d.H)) out.push('the table drawn is not the height map');
      if (q.fig){
        if (!q.cap) out.push('a figure with no caption');
        if (/\d/.test(String(q.cap).replace(/1 立方公分|1 cubic centimetre/g, ''))) out.push('figure caption contains a digit: ' + q.cap);
        figProblems(q.fig, genId).forEach(p => out.push(p));
        const wantKind = genId === 'whichVolume' ? 'which' : genId === 'compareTwo' ? 'pair' : 'single';
        if (q.fig.kind !== wantKind) out.push('figure kind ' + q.fig.kind + ' but expected ' + wantKind);
        if (wantKind === 'single' && !eqJ(q.fig.stacks[0].H, d.H)) out.push('the pile drawn is not the pile in the data');
        if (wantKind === 'pair' && (!eqJ(q.fig.stacks[0].H, d.A) || !eqJ(q.fig.stacks[1].H, d.B))) out.push('the pair drawn is not A and B');
        if (wantKind === 'which' && !eqJ(q.fig.stacks.map(s => s.H), d.Hs)) out.push('the four piles drawn are not the candidates');
      }
      /* 解釋要真的講到正解那一件事。 */
      const whyNums = numbersIn(q.why);
      if (genId === 'countStack' && (whyNums.indexOf(d.visible) < 0 || whyNums.indexOf(d.hidden) < 0 || whyNums.indexOf(d.total) < 0)) out.push('why should state the visible, hidden and total counts');
      if (genId === 'hiddenCount' && q.why.indexOf(volumeRef(d.H) + ' − ' + d.visible + ' = ' + d.hidden) < 0 && q.why.indexOf(volumeRef(d.H) + ' － ' + d.visible + ' ＝ ' + d.hidden) < 0) out.push('why should show total − visible = hidden');
      if (genId === 'whichVolume' && q.why.indexOf(TXT_REF[lang].colorName[WHICH_TONES_REF[d.ans]]) < 0) out.push('why should name the correct colour');
      if (genId === 'compareTwo'){
        const tallerVol = d.tallA > d.tallB ? d.volA : d.volB, shorterVol = d.tallA > d.tallB ? d.volB : d.volA;
        const tallerLoses = d.tallA !== d.tallB && tallerVol <= shorterVol;
        const says = lang === 'zh' ? /高的不一定大/.test(q.why) : /taller does not mean bigger/.test(q.why);
        if (tallerLoses !== says) out.push('why must say "taller does not mean bigger" exactly when the taller pile is not the bigger one');
      }
      if (genId === 'layersSum' && (lang === 'zh' ? /×/.test(q.why.replace(/不可以用第 1 層乘層數/, '')) : /×/.test(q.why))) out.push('layer-by-layer explanation must not multiply');
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{FIG_W, FIG_H, U, DEPTH, MINI_U, MINI_W, MINI_H, RASTER, MAX_SIDE, MAX_HEIGHT, MAX_CUBES, PAIR_CX_A, PAIR_CX_B, ' +
                'rows, cols, maxH, volume, footprint, cellList, layerCounts, sum, cubesOf, drawOrder, unitPt, facesOf, inConvex, extent, visibility, validStack, ' +
                'toPx, stackPlan, singlePlan, pairPlan, miniPlan, allTopsVisible, STACKS, stack, S1_CASES, S2_CASES, S3_CASES, S4_CASES, comparePlan, QUIZ_FIGS, plEn, ' +
                'GPICK, shuffle, pick, sameStack, emptyLike, pileOrigin, floorCells, GAME_BUILD, BUILD, BUILD_H, buildBoxes, buildCells, buildSrc, buildJudge, ' +
                'GAME_MATCH, MATCH, MATCH_H, matchCols, matchCard, matchZones, matchDiff, noIdentity, GAME_LAYERS, LAYERS, LAYER_KEYS, LAYERS_H, layerSlots, layerJudge, ' +
                'GAME_SORT, SORT, SORT_H, sortSlots, sortRank, sortTray, GAME_TAP, TAP, TAP_H, tapFrames, tapPick, tapSame}',
    optionValueMax: MAX_CUBES_REF,

    check: function(data, I18N, fail, rawSrc){
      const src = stripComments(rawSrc);
      const sib = siblingSources();

      /* ---------- 1) 常數與畫布 ---------- */
      if (data.FIG_W !== FIG_W_REF || data.FIG_H !== FIG_H_REF) fail('the canvas is ' + FIG_W_REF + '×' + FIG_H_REF);
      if (data.U !== U_REF || data.DEPTH !== DEPTH_REF) fail('the unit is ' + U_REF + 'px and the depth shift ' + DEPTH_REF);
      if (data.MINI_U !== MINI_U_REF || data.MINI_W !== MINI_W_REF || data.MINI_H !== MINI_H_REF) fail('the mini canvas is ' + MINI_W_REF + '×' + MINI_H_REF + ' at ' + MINI_U_REF + 'px');
      if (data.MAX_SIDE !== MAX_SIDE_REF || data.MAX_HEIGHT !== MAX_HEIGHT_REF || data.MAX_CUBES !== MAX_CUBES_REF) fail('the pile limits are 4 × 4 × 4 and 40 cubes');
      if (data.PAIR_CX_A !== PAIR_CX_A_REF || data.PAIR_CX_B !== PAIR_CX_B_REF) fail('pair centres are ' + PAIR_CX_A_REF + ' and ' + PAIR_CX_B_REF);
      if (data.RASTER !== 4) fail('the page raster must sample 4 per unit (the exactness argument depends on it)');
      /* 看函式本體（Function.prototype.toString）去掉註解之後的字面：這是**字面掃描**，死字串裡的那一句它擋不住；
         取樣點對不對的真正證明是上面幾百堆和射線法**完全相等**，這一條只擋「順手改掉」。 */
      if (stripJsComments(String(data.visibility)).indexOf('u:(i + 0.5) / RASTER, v:(j + 0.25) / RASTER') < 0) fail('the sample offsets must be (i + 0.5)/RASTER and (j + 0.25)/RASTER so no sample lands on a face edge');
      if (countOf(src, 'viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '"') !== 4)
        fail('expected 4 figure canvases in the lesson markup (the four examples; the game draws on its own boards), found ' + countOf(src, 'viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '"'));
      if (src.indexOf('max-width:' + FIG_W_REF + 'px;height:' + FIG_H_REF + 'px') < 0) fail('the .cubefig CSS size must match the viewBox');

      /* ---------- 2) 塊數、每格、每層、看得到：和參考實作逐一比對 ---------- */
      const libIds = Object.keys(STACKS_REF);
      if (Object.keys(data.STACKS).sort().join() !== libIds.slice().sort().join()) fail('STACKS must be exactly the reference library');
      libIds.forEach(function(id){
        const H = data.STACKS[id];
        if (!H){ fail('STACKS.' + id + ' is missing or empty'); return; }
        if (!validRef(H)) fail('STACKS.' + id + ' is not a valid pile');
        if (!eqJ(H, STACKS_REF[id])) fail('STACKS.' + id + ' differs from the reference');
        if (!data.validStack(H)) fail('validStack() rejects the library pile ' + id);
        if (data.stack(id) !== H) fail('stack(' + id + ') does not return the library pile');
      });
      if (data.validStack([[0, 0]])) fail('validStack() accepts an empty pile');
      if (data.validStack([[5]])) fail('validStack() accepts a pile taller than ' + MAX_HEIGHT_REF);
      if (data.validStack([[1, 1, 1, 1, 1]])) fail('validStack() accepts a pile wider than ' + MAX_SIDE_REF);
      if (data.validStack([[1, 1], [1]])) fail('validStack() accepts a ragged height map');
      if (data.validStack([[-1, 3]])) fail('validStack() accepts a negative height');   // 總數仍 ≥ 1，只有負數這一條擋得住
      if (data.validStack([[1.5]])) fail('validStack() accepts a fractional height');
      if (data.validStack([])) fail('validStack() accepts no rows');
      if (data.validStack([[]])) fail('validStack() accepts an empty row');
      if (data.validStack([[1], [1], [1], [1], [1]])) fail('validStack() accepts five rows');
      if (data.validStack('x') || data.validStack(null)) fail('validStack() accepts a non-array');
      const probes = libIds.map(id => STACKS_REF[id]).concat(all2x2Ref(), randomStacksRef(200, 20260903));
      let checked = 0;
      probes.forEach(function(H){
        if (data.volume(H) !== volumeRef(H)) fail('volume() disagrees with the reference on ' + JSON.stringify(H));
        if (data.footprint(H) !== footprintRef(H)) fail('footprint() disagrees with the reference on ' + JSON.stringify(H));
        if (!eqJ(data.cellList(H), cellsRef(H))) fail('cellList() disagrees with the reference on ' + JSON.stringify(H));
        if (!eqJ(data.layerCounts(H), layersRef(H))) fail('layerCounts() disagrees with the reference on ' + JSON.stringify(H));
        const layers = layersRef(H);
        for (let i = 1; i < layers.length; i++) if (layers[i] > layers[i - 1]) fail('layers grow upwards on ' + JSON.stringify(H) + ' — impossible for a height map');
        if (layers.length && layers[0] !== footprintRef(H)) fail('layer 1 must equal the footprint on ' + JSON.stringify(H));
        const ex = data.extent(H), er = extentRef(H);
        if (Math.abs(ex.w - er.w) > 1e-9 || Math.abs(ex.h - er.h) > 1e-9) fail('extent() disagrees with the reference on ' + JSON.stringify(H));
        const vis = data.visibility(H), ref = visibleSetRef(H);
        if (vis.total !== volumeRef(H)) fail('visibility().total is wrong on ' + JSON.stringify(H));
        if (!Array.isArray(vis.cubes) || vis.cubes.length !== volumeRef(H) || new Set(vis.cubes.map(k => k.key)).size !== volumeRef(H)) fail('visibility().cubes must list every cube exactly once on ' + JSON.stringify(H));
        if (data.allTopsVisible(H) !== allTopsVisibleRef(H)) fail('allTopsVisible() disagrees with the reference on ' + JSON.stringify(H));
        if (vis.visible !== ref.size || vis.hidden !== volumeRef(H) - ref.size) fail('visibility() disagrees with the ray-cast reference on ' + JSON.stringify(H) + ' (' + vis.visible + ' vs ' + ref.size + ')');
        vis.cubes.forEach(function(k){ if (k.visible !== ref.has(k.c + ',' + k.h + ',' + k.b)) fail('visibility() flags cube ' + k.key + ' wrongly on ' + JSON.stringify(H)); });
        /* 畫的順序（後排先、低層先、左邊先）和 cubesOf 的完整性。 */
        const order = data.drawOrder(data.cubesOf(H));
        if (order.length !== volumeRef(H)) fail('cubesOf() does not list every cube on ' + JSON.stringify(H));
        for (let i = 1; i < order.length; i++){
          const p = order[i - 1], k = order[i];
          if (!(p.b > k.b || (p.b === k.b && (p.h < k.h || (p.h === k.h && p.c < k.c))))) fail('drawOrder() is not back-first, low-first, left-first on ' + JSON.stringify(H));
        }
        checked++;
      });
      if (checked < 400) fail('too few piles compared against the reference (' + checked + ')');
      /* 每一堆至少要有一個看得到的方塊；有些堆一定有藏起來的。 */
      if (data.visibility([[1]]).hidden !== 0) fail('a single cube must be fully visible');
      if (data.visibility([[2, 2], [2, 2]]).hidden !== 1) fail('the 2×2×2 block must hide exactly its back-left bottom cube');
      if (data.visibility([[3, 2, 1]]).hidden !== 0) fail('a single-row staircase hides nothing');
      /* inConvex：取樣點不會落在邊上；邊上的點一律算外面。 */
      const sq = [{ u:0, v:0 }, { u:1, v:0 }, { u:1, v:1 }, { u:0, v:1 }];
      if (!data.inConvex({ u:0.5, v:0.5 }, sq)) fail('inConvex() rejects the centre of a square');
      if (data.inConvex({ u:0.5, v:0 }, sq)) fail('inConvex() accepts a point on an edge');
      if (data.inConvex({ u:1.5, v:0.5 }, sq)) fail('inConvex() accepts a point outside');
      /* 投影。 */
      const up = data.unitPt(2, 1, 3);
      if (up.u !== 2 + DEPTH_REF * 3 || up.v !== 1 + DEPTH_REF * 3) fail('unitPt() is not u = c + DEPTH·b, v = h + DEPTH·b');
      const px = data.toPx({ u:1, v:2 }, 10, 100, U_REF);
      if (px.x !== 10 + U_REF || px.y !== 100 - 2 * U_REF) fail('toPx() is not X0 + u·unit, Y0 − v·unit');
      const f = data.facesOf({ c:1, h:0, b:2 });
      const D = DEPTH_REF, wantFaces = {
        top:  [[1 + 2 * D, 1 + 2 * D], [2 + 2 * D, 1 + 2 * D], [2 + 3 * D, 1 + 3 * D], [1 + 3 * D, 1 + 3 * D]],
        front:[[1 + 2 * D, 0 + 2 * D], [2 + 2 * D, 0 + 2 * D], [2 + 2 * D, 1 + 2 * D], [1 + 2 * D, 1 + 2 * D]],
        right:[[2 + 2 * D, 0 + 2 * D], [2 + 3 * D, 0 + 3 * D], [2 + 3 * D, 1 + 3 * D], [2 + 2 * D, 1 + 2 * D]]
      };
      ['top', 'front', 'right'].forEach(function(face){
        if (!f[face] || f[face].length !== 4){ fail('facesOf() ' + face + ' is not four points'); return; }
        f[face].forEach((p, j) => { if (Math.abs(p.u - wantFaces[face][j][0]) > 1e-9 || Math.abs(p.v - wantFaces[face][j][1]) > 1e-9) fail('facesOf() ' + face + ' vertex ' + j + ' is not where the projection puts it'); });
      });

      /* ---------- 3) 圖：每一個範例、每一關的畫面 ---------- */
      function checkSingle(H, label){
        const plan = data.singlePlan(H), o = singleOriginRef(H, U_REF, FIG_W_REF, FIG_H_REF);
        stackDrawProblems({ H, plan }, o.X0, o.Y0, U_REF, label).forEach(fail);
      }
      function checkPair(HA, HB, label){
        const pp = data.pairPlan(HA, HB), o = pairOriginsRef(HA, HB);
        /* 安全性質先驗（兩堆要分開），再逐點比對投影 —— 反過來的話「分開」那一條永遠不會是第一個響的。 */
        if (pp.A.box && pp.B.box && pp.B.box.x - (pp.A.box.x + pp.A.box.w) < U_REF) fail(label + ': the two stacks are less than one square apart');
        stackDrawProblems({ H:HA, plan:pp.A }, o.A.X0, o.A.Y0, U_REF, label + ' A').forEach(fail);
        stackDrawProblems({ H:HB, plan:pp.B }, o.B.X0, o.B.Y0, U_REF, label + ' B').forEach(fail);
        const bA = boxRef(HA, o.A.X0, o.A.Y0, U_REF), bB = boxRef(HB, o.B.X0, o.B.Y0, U_REF);
        if (bB.x - (bA.x + bA.w) < U_REF) fail(label + ': the reference layout itself puts the stacks less than one square apart');
        if (Math.abs(pp.gap - (bB.x - (bA.x + bA.w))) > 1e-9) fail(label + ': pairPlan.gap is not the real gap');
      }
      S1_REF.forEach(id => checkSingle(STACKS_REF[id], 'S1 ' + id));
      S2_REF.forEach(id => checkSingle(STACKS_REF[id], 'S2 ' + id));
      S3_REF.forEach(id => checkSingle(STACKS_REF[id], 'S3 ' + id));
      S4_REF.forEach(row => checkPair(STACKS_REF[row[1]], STACKS_REF[row[2]], 'S4 ' + row[0]));
      /* 小圖。 */
      [].concat(...(data.GAME_SORT || [])).forEach(function(H){
        const id = JSON.stringify(H), mp = data.miniPlan(H), e = extentRef(H);
        const X0 = (MINI_W_REF - e.w * MINI_U_REF) / 2, Y0 = (MINI_H_REF + e.h * MINI_U_REF) / 2;
        if (mp.w !== MINI_W_REF || mp.h !== MINI_H_REF) fail('miniPlan(' + id + ') canvas is wrong');
        if (mp.fits !== (e.w * MINI_U_REF <= MINI_W_REF && e.h * MINI_U_REF <= MINI_H_REF)) fail('miniPlan(' + id + ').fits is wrong');
        if (!Array.isArray(mp.cubes) || mp.cubes.length !== volumeRef(H)) fail('miniPlan(' + id + ') must draw every cube (' + (mp.cubes ? mp.cubes.length : 0) + ' of ' + volumeRef(H) + ')');
        /* 小圖的每一個面也逐點比對（stackDrawProblems 用大畫布的邊界，所以這裡另外驗小畫布）。 */
        stackDrawProblems({ H, plan:mp }, X0, Y0, MINI_U_REF, 'miniPlan(' + id + ')').filter(m => m.indexOf('leaves the canvas') < 0).forEach(fail);
        (mp.cubes || []).forEach(function(k){
          ['top', 'front', 'right'].forEach(face => (k[face] || []).forEach(p => {
            if (!inCanvas(p, MINI_W_REF, MINI_H_REF, 0)) fail('miniPlan(' + id + ') draws outside the mini canvas');
          }));
        });
      });

      /* ---------- 4) 範例 1 ---------- */
      const S1_VOL = { one:1, row3:3, tower3:3, sq4:4, L4:4 };
      S1_REF.forEach(function(id){ if (volumeRef(STACKS_REF[id]) !== S1_VOL[id]) fail('S1 ' + id + ' must have ' + S1_VOL[id] + ' cubes'); });
      /* 每一張圖裡的每一堆：每一格最上面那一塊都看得到（性質先驗，逐字比對放後面）。 */
      const pictured = new Set([].concat(data.S1_CASES || [], data.S2_CASES || [], data.S3_CASES || [], (data.S4_CASES || []).map(c => c.A), (data.S4_CASES || []).map(c => c.B), Object.values(data.QUIZ_FIGS || {})));
      pictured.forEach(function(id){
        const H = data.STACKS[id];
        if (!H){ fail('pictured pile ' + id + ' is not in STACKS'); return; }
        if (!allTopsVisibleRef(H)) fail('pile ' + id + ' hides a whole column behind the others, so it cannot be counted from the picture');
      });
      (data.S2_CASES || []).forEach(function(id){ if (data.STACKS[id] && hiddenRef(data.STACKS[id]) < 1) fail('S2 ' + id + ' hides nothing, so the example demonstrates nothing'); });
      (data.S4_CASES || []).forEach(function(c){
        const HA = data.STACKS[c.A], HB = data.STACKS[c.B];
        if (!HA || !HB) return;
        const a = volumeRef(HA), b = volumeRef(HB), who = a > b ? 'A' : b > a ? 'B' : 'same';
        if (c.id === 'tallLess' && !(who === 'B' && maxHRef(HA) > maxHRef(HB))) fail('S4 tallLess: must be a taller pile that is smaller');
        if (c.id === 'tallSame' && !(who === 'same' && maxHRef(HA) > maxHRef(HB))) fail('S4 tallSame: must be a taller pile with the same volume');
      });
      if (!eqJ(data.S1_CASES, S1_REF)) fail('S1_CASES must be ' + S1_REF.join('/'));
      if (volumeRef(STACKS_REF.row3) !== volumeRef(STACKS_REF.tower3)) fail('the row and the tower in example 1 must have the same volume');
      if (volumeRef(STACKS_REF.sq4) !== volumeRef(STACKS_REF.L4)) fail('the square and the L in example 1 must have the same volume');

      /* ---------- 5) 範例 2：每一組都藏了至少一塊 ---------- */
      if (!eqJ(data.S2_CASES, S2_REF)) fail('S2_CASES must be ' + S2_REF.join('/'));
      S2_REF.forEach(function(id){ if (hiddenRef(STACKS_REF[id]) < 1) fail('S2 ' + id + ' hides nothing, so the example demonstrates nothing'); });

      /* ---------- 6) 範例 3 ---------- */
      if (!eqJ(data.S3_CASES, S3_REF)) fail('S3_CASES must be ' + S3_REF.join('/'));
      S3_REF.forEach(function(id){
        const layers = layersRef(STACKS_REF[id]);
        if (layers.length < 2) fail('S3 ' + id + ' has a single layer, so layer-by-layer shows nothing');
        if (new Set(layers).size === 1) fail('S3 ' + id + ' has equal layers, which invites multiplying');
      });

      /* ---------- 7) 範例 4：比體積 ---------- */
      if (!eqJ(data.S4_CASES.map(c => [c.id, c.A, c.B]), S4_REF)) fail('S4_CASES must be the reference pairs');
      data.S4_CASES.forEach(function(c){
        const HA = STACKS_REF[c.A], HB = STACKS_REF[c.B], cp = data.comparePlan(HA, HB), label = 'S4 ' + c.id;
        const a = volumeRef(HA), b = volumeRef(HB), who = a > b ? 'A' : b > a ? 'B' : 'same';
        if (cp.volA !== a || cp.volB !== b || cp.who !== who) fail(label + ': comparePlan disagrees with the reference');
        if (cp.tallA !== maxHRef(HA) || cp.tallB !== maxHRef(HB) || cp.footA !== footprintRef(HA) || cp.footB !== footprintRef(HB)) fail(label + ': heights or footprints are wrong');
        const tallerIsBigger = a !== b && cp.tallA !== cp.tallB && ((cp.tallA > cp.tallB) === (a > b));
        const widerIsBigger = a !== b && cp.footA !== cp.footB && ((cp.footA > cp.footB) === (a > b));
        if (cp.tallerIsBigger !== tallerIsBigger) fail(label + ': tallerIsBigger is wrong');
        if (cp.widerIsBigger !== widerIsBigger) fail(label + ': widerIsBigger is wrong');
        if (c.id === 'tallSame' && !(who === 'same' && cp.tallA > cp.tallB)) fail(label + ': must be a taller pile with the same volume');
        if (c.id === 'tallLess' && !(who === 'B' && cp.tallA > cp.tallB)) fail(label + ': must be a taller pile that is smaller');
        if (c.id === 'wideLess' && !(who === 'A' && cp.footB > cp.footA)) fail(label + ': must be a wider base that is smaller');
        if (c.id === 'rearrange' && !(who === 'same' && !eqJ(HA, HB))) fail(label + ': must be the same count in a different arrangement');
      });

      /* ---------- 8) 試題裡的圖 ---------- */
      const q3 = data.STACKS[data.QUIZ_FIGS.q3], q4 = data.STACKS[data.QUIZ_FIGS.q4];
      if (!q3 || !eqJ(cellsRef(q3), [3, 2, 1, 1]) || visibleCountRef(q3) !== 6) fail('QUIZ_FIGS.q3 is described as 3, 2, 1, 1 with 6 visible — the pile must match');
      if (!q4 || volumeRef(q4) !== 8 || hiddenRef(q4) !== 1 || visibleCountRef(q4) !== 7) fail('QUIZ_FIGS.q4 is described as 8 cubes with 1 hidden — the pile must match');
      if (data.QUIZ_FIGS.q3 !== 'hill7' || data.QUIZ_FIGS.q4 !== 'box8') fail('QUIZ_FIGS.q3 must be hill7 and QUIZ_FIGS.q4 must be box8');
      ['zh', 'en'].forEach(function(lang){
        if (I18N[lang].qs[2].fig !== 'q3') fail('qs[2] (' + lang + ') must show QUIZ_FIGS.q3');
        if (I18N[lang].qs[3].fig !== 'q4') fail('qs[3] (' + lang + ') must show QUIZ_FIGS.q4');
        I18N[lang].qs.concat(I18N[lang].qsAdv, I18N[lang].qsBoost).forEach(function(q, i){
          if (q.fig && !data.QUIZ_FIGS[q.fig]) fail('question ' + i + ' references an unknown figure ' + q.fig);
        });
      });

      /* ---------- 9) 題庫 ---------- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(function(bank){
        const want = BANK_EXPECTED[bank];
        ['zh', 'en'].forEach(function(lang){
          const list = I18N[lang][bank];
          if (!list || list.length !== want.length){ fail(bank + ' ' + lang + ': expected ' + want.length + ' questions, found ' + (list ? list.length : 0)); return; }
          list.forEach(function(q, i){
            const label = bank + '[' + i + '] ' + lang;
            const got = String(q.opts[q.ans]);
            if (got !== want[i].expect[lang]) fail(label + ': the marked answer is "' + got + '", expected "' + want[i].expect[lang] + '"');
            if (q.stem.indexOf(want[i].ask[lang]) < 0) fail(label + ': the stem no longer asks "' + want[i].ask[lang] + '"');
            if ((q.fig || null) !== (want[i].fig || null)) fail(label + ': figure reference should be ' + (want[i].fig || 'none'));
            arithProblems(q.stem + ' ' + q.why).problems.forEach(p => fail(label + ': ' + p));
            textProblems(q.stem, lang, label + ' stem').forEach(fail);
            textProblems(q.why, lang, label + ' why').forEach(fail);
            q.opts.forEach((o, oi) => textProblems(o, lang, label + ' option ' + oi).forEach(fail));
            if (new Set(q.opts).size !== 4) fail(label + ': duplicate options');
          });
        });
      });

      /* ---------- 10) 遊戲：盤點站出任務（五關五種玩法；見上面的 gameChecks） ---------- */
      gameChecks(data, I18N, fail, rawSrc);

      /* ---------- 11) 旁白：真的渲染出來再掃 ---------- */
      const narrated = [];
      ['zh', 'en'].forEach(function(lang){
        const d = I18N[lang];
        data.S1_CASES.forEach(function(id){
          const n = volumeRef(STACKS_REF[id]);
          const narr = d.s1narr(n, id);
          narrated.push([lang, 's1narr', narr]); narrated.push([lang, 's1calc', d.s1calc(n)]);
          if (n > 1 && numbersIn(narr).indexOf(n) < 0) fail('example 1 narration (' + lang + ', ' + id + ') must state the count ' + n);
          if (n === 1 && !(lang === 'zh' ? /邊長 1 公分的正方體/.test(narr) : /cube with 1 cm edges/.test(narr))) fail('the unit cube narration must define 1 cubic centimetre');
          if (numbersIn(d.s1calc(n)).join() !== [n, n].join()) fail('example 1 calc must state the count and the volume only');
        });
        data.S2_CASES.forEach(function(id){
          const H = STACKS_REF[id], v = visibleCountRef(H), hid = hiddenRef(H), n = volumeRef(H);
          const guess = d.s2narrGuess(v), narr = d.s2narr(v, hid, n), calc = d.s2calc(v, hid, n);
          narrated.push([lang, 's2narrGuess', guess]); narrated.push([lang, 's2narr', narr]); narrated.push([lang, 's2calc', calc]); narrated.push([lang, 's2result', d.s2result(n)]);
          if (numbersIn(guess).join() !== String(v)) fail('example 2 guess narration gives the total away (' + lang + ', ' + id + ')');
          if (numbersIn(narr).indexOf(hid) < 0 || numbersIn(narr).indexOf(n) < 0) fail('example 2 narration must state the hidden and total counts (' + lang + ')');
          if (!(lang === 'zh' ? /每一層都有/.test(narr) : /every layer below/.test(narr))) fail('example 2 narration must give the reason hidden cubes exist (' + lang + ')');
          if (calc.indexOf(v + ' ＋ ' + hid + ' ＝ ' + n) < 0 && calc.indexOf(v + ' + ' + hid + ' = ' + n) < 0) fail('example 2 calc must read seen + hidden = total (' + lang + ')');
          if (arithProblems(calc).verified !== 1) fail('example 2 calc (' + lang + ', ' + id + ') must be one verifiable equation');
        });
        data.S3_CASES.forEach(function(id){
          const H = STACKS_REF[id], cells = cellsRef(H), layers = layersRef(H), n = volumeRef(H);
          const narr = d.s3narr(cells, layers, n), calc = d.s3calc(cells, layers, n);
          narrated.push([lang, 's3narr', narr]); narrated.push([lang, 's3calc', calc]); narrated.push([lang, 's3result', d.s3result(n)]);
          layers.forEach((x, i) => { if (narr.indexOf(d.layerText(i + 1, x)) < 0) fail('example 3 narration must list layer ' + (i + 1) + ' (' + lang + ')'); });
          if (/×|\*/.test(calc)) fail('example 3 calc must add, never multiply (' + lang + ')');
          if (arithProblems(calc).verified < 2) fail('example 3 calc (' + lang + ', ' + id + ') checked ' + arithProblems(calc).verified + ' equations, expected 2');
        });
        data.S4_CASES.forEach(function(c){
          const HA = STACKS_REF[c.A], HB = STACKS_REF[c.B], cp = data.comparePlan(HA, HB);
          const guess = d.s4narrGuess(cp), narr = d.s4narr(cp, c.id);
          narrated.push([lang, 's4narrGuess', guess]); narrated.push([lang, 's4narr', narr]); narrated.push([lang, 's4calc', d.s4calc(cp)]); narrated.push([lang, 's4result', d.s4result(cp)]); narrated.push([lang, 's4chip', d.s4chip[c.id]]);
          const saysSame = lang === 'zh' ? /一樣大/.test(narr) : /same volume/.test(narr);
          const saysA = lang === 'zh' ? /甲的體積比較大/.test(narr) : /A has the bigger/.test(narr);
          const saysB = lang === 'zh' ? /乙的體積比較大/.test(narr) : /B has the bigger/.test(narr);
          if ((cp.who === 'same') !== saysSame || (cp.who === 'A') !== saysA || (cp.who === 'B') !== saysB) fail('example 4 narration (' + lang + ', ' + c.id + ') contradicts the computed comparison');
          const tallerLoses = cp.tallA !== cp.tallB && !cp.tallerIsBigger;
          const saysTaller = lang === 'zh' ? /高的不一定大/.test(narr) : /taller does not mean bigger/.test(narr);
          if (tallerLoses !== saysTaller) fail('example 4 narration (' + lang + ', ' + c.id + ') must say taller is not bigger exactly when the taller pile is not the bigger one');
          if (c.id === 'rearrange' && !(lang === 'zh' ? /搬動/.test(narr) : /moved/.test(narr))) fail('the rearranged case must mention the move');
          const widerLoses = cp.footA !== cp.footB && !cp.widerIsBigger;
          const saysWider = lang === 'zh' ? /地盤大不一定大/.test(narr) : /bigger base does not mean bigger/.test(narr);
          if (widerLoses !== saysWider) fail('example 4 narration (' + lang + ', ' + c.id + ') must say a bigger base is not bigger exactly when the wider pile is not the bigger one');
          if (numbersIn(guess).slice().sort().join() !== [cp.tallA, cp.tallB, cp.footA, cp.footB].slice().sort().join()) fail('example 4 guess narration must print exactly the two heights and two footprints, nothing else (' + lang + ')');
          if (d.s4result(cp) !== (lang === 'zh' ? { A:'甲 ＞ 乙', B:'甲 ＜ 乙', same:'甲 ＝ 乙' }[cp.who] : { A:'A > B', B:'A < B', same:'A = B' }[cp.who])) fail('example 4 result line is wrong (' + lang + ')');
        });
        [0, 1, 4, 7].forEach(n => { narrated.push([lang, 'cubesText', d.cubesText(n)]); narrated.push([lang, 'volText', d.volText(n)]); });
        narrated.push([lang, 's2calc1', d.s2calc(1, 0, 1)]);   // 只有 1 會錯的英文單複數
        narrated.push([lang, 'gWin', d.gWin(100)]);
        narrated.push([lang, 'caseName', d.caseName(1)]); narrated.push([lang, 'layerText1', d.layerText(1, 1)]);
      });
      narrated.forEach(function(row){
        textProblems(row[2], row[0], row[1] + ' (' + row[0] + ')').forEach(fail);
        arithProblems(row[2]).problems.forEach(p => fail(row[1] + ' (' + row[0] + '): ' + p));
      });
      /* 驗算的覆蓋率要釘兩個東西：驗過幾條，以及驗過的算式本身的指紋。 */
      const eqList = arithProblems.verifiedAll();
      if (eqList.length !== VERIFIED_REF) fail('the arithmetic verifier checked ' + eqList.length + ' equations, expected ' + VERIFIED_REF);
      const fingerprint = crypto.createHash('sha1').update(eqList.join(' | ')).digest('hex');
      if (fingerprint !== FINGERPRINT_REF) fail('the set of verified equations changed (fingerprint ' + fingerprint + ')');
      if (arithProblems.unmatched().length) fail('wrongOnPurpose declared but never matched: ' + arithProblems.unmatched().join(' / '));

      /* ---------- 12) 四頁的措辭 ---------- */
      const clean = {}, prose = {};
      ['index', 'reference', 'review', 'parents'].forEach(function(name){
        if (sib[name] === null){ fail('cannot read ' + name + '.html'); return; }
        clean[name] = stripComments(sib[name]);
        prose[name] = proseOnly(clean[name]);
      });
      PAIRED_RULES.forEach(function(pair){
        const isZh = /[一-鿿]/.test(pair.rule);
        pair.pages.forEach(function(name){
          if (clean[name] === undefined) return;
          const region = isZh ? zhRegion(clean[name]) : enRegion(clean[name]);
          if (region === null){ fail('PAIRED: cannot find the dictionary in ' + name + '.html — unchecked, not passing'); return; }
          if (region.indexOf(pair.rule) >= 0 && region.indexOf(pair.qualifier) < 0) fail('PAIRED: ' + name + '.html states "' + pair.rule + '" without "' + pair.qualifier + '"');
        });
      });
      HANDOFF_RULES.forEach(function(h){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (prose[name] === undefined) return;
          const hay = prose[name], low = hay.toLowerCase();
          let i = 0;
          for (;;){
            const k = low.indexOf(h.word.toLowerCase(), i);
            if (k < 0) break;
            const win = hay.slice(Math.max(0, k - h.span), k + h.word.length + h.span).toLowerCase();
            if (!h.near.some(w => win.indexOf(w.toLowerCase()) >= 0))
              fail('HANDOFF: ' + name + '.html mentions "' + h.word + '" without "' + h.near.join('/') + '" nearby — this lesson only ever hands that topic on');
            i = k + h.word.length;
          }
        });
      });
      SIBLING_RULES.concat(SIBLING_RULES_EN).forEach(function(rule){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (prose[name] === undefined) return;
          const n = countOf(prose[name], rule.text), want = rule.files[name] || 0;
          if (n !== want) fail('SIBLING: "' + rule.text + '" appears ' + n + ' time(s) in ' + name + '.html, expected exactly ' + want);
        });
      });
      FORBIDDEN.forEach(function(bad){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (prose[name] === undefined) return;
          const plain = prose[name].replace(/<\/?[A-Za-z][^>]*>/g, '').replace(/&nbsp;/g, ' ').toLowerCase();
          if (prose[name].indexOf(bad) >= 0 || plain.indexOf(bad.toLowerCase()) >= 0) fail('FORBIDDEN: ' + name + '.html says "' + bad + '", which is not true');
        });
      });
      HANDOFF_COUNTS.forEach(function(rule){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (prose[name] === undefined) return;
          const n = countOf(prose[name].toLowerCase(), rule.word.toLowerCase()), want = rule.files[name] || 0;
          if (n !== want) fail('HANDOFF-COUNT: "' + rule.word + '" appears ' + n + ' time(s) in ' + name + '.html, expected exactly ' + want);
        });
      });
      KEY_RULES.map(r => Object.assign({ lang:'zh' }, r)).concat(KEY_RULES_EN.map(r => Object.assign({ lang:'en' }, r))).forEach(function(rule){
        if (clean[rule.file] === undefined) return;
        const vals = keyValues(clean[rule.file], rule.key, rule.lang);
        if (vals === null){ fail('KEY: cannot find the ' + rule.lang + ' dictionary in ' + rule.file + '.html — unchecked, not passing'); return; }
        if (vals.length !== 1){ fail('KEY: ' + rule.file + '.html has ' + vals.length + ' ' + rule.lang + ' values for ' + rule.key); return; }
        rule.must.forEach(function(phrase){
          if (vals[0].indexOf(phrase) < 0) fail('KEY: ' + rule.file + '.html ' + rule.key + ' no longer says "' + phrase + '"');
        });
      });
      ['reference', 'parents'].forEach(function(name){
        if (clean[name] === undefined) return;
        if (clean[name].indexOf('<svg') >= 0) fail(name + '.html must not draw any SVG — it is deliberately text-only');
      });
      ['index', 'review'].forEach(function(name){
        if (clean[name] === undefined) return;
        if (clean[name].indexOf('<text') >= 0) fail(name + '.html must not put a <text> in the markup — the figures carry no text');
        const tags = [...clean[name].matchAll(/svgEl\s*\(\s*['"]([a-zA-Z]+)['"]/g)].map(m => m[1].toLowerCase());
        const allowed = ['line', 'path', 'g', 'svg'];
        [...new Set(tags)].forEach(function(t){
          if (allowed.indexOf(t) < 0) fail(name + '.html creates an SVG <' + t + '>, which this lesson does not use');
        });
        if (!tags.length) fail(name + '.html draws nothing through svgEl()');
        const calls = (clean[name].match(/(?<!function\s)svgEl\s*\(/g) || []).length;
        if (calls !== tags.length) fail(name + '.html has ' + calls + ' svgEl() calls but only ' + tags.length + ' literal tag names');
        scannerSafe(sib[name]).forEach(w => fail(name + '.html contains ' + w + ' — the comment scanner cannot be trusted on it'));
        const direct = [...clean[name].matchAll(/createElementNS\s*\(\s*[^,]+,\s*['"]([a-zA-Z]+)['"]/g)].map(m => m[1].toLowerCase());
        [...new Set(direct)].forEach(function(t){ if (t !== 'svg') fail(name + '.html calls createElementNS for <' + t + '> directly, bypassing svgEl()'); });
        const rawSvg = clean[name].match(/<\/?(?:rect|polygon|polyline|ellipse|image|use|foreignobject|g|line|path|circle|text|tspan)(?=[\s>\/])/gi);
        if (rawSvg) fail(name + '.html contains raw SVG markup ' + [...new Set(rawSvg.map(t => t.toLowerCase()))].join(' ') + ', which bypasses the drawing functions');
        if (/\b(?:svg|\w*fig|\w*Fig)\s*\.\s*innerHTML\s*\+?=/i.test(clean[name]) || /innerHTML\s*\+?=\s*[^;]*<\s*(?:svg|path|line|circle|text|rect|polygon)\b/i.test(clean[name]))
          fail(name + '.html builds SVG through innerHTML');
        const mutation = clean[name].match(/insertAdjacentHTML|outerHTML|insertAdjacentText|createTextNode|nodeValue|replaceChildren|appendData|deleteData|insertData|replaceData|\.data\s*=[^=]|textContent\s*\+=|\.\s*append\s*\(|\.\s*prepend\s*\(|\.\s*after\s*\(|\.\s*before\s*\(/g);
        if (mutation) fail(name + '.html uses ' + [...new Set(mutation)].join(' ') + ', a text/markup mutation path the checker cannot follow');
        const nsCalls = (clean[name].match(/createElementNS\s*\(/g) || []).length;
        if (nsCalls !== direct.length + 1) fail(name + '.html has ' + nsCalls + ' createElementNS() calls but ' + (direct.length + 1) + ' literal tag names (one is inside svgEl)');
      });
      ['index', 'reference', 'review', 'parents'].forEach(function(name){
        if (clean[name] === undefined) return;
        ['nav1', 'nav2', 'nav3', 'nav4'].forEach(function(k){
          if (clean[name].indexOf('data-i18n="' + k + '"') < 0) fail(name + '.html is missing the ' + k + ' course-nav entry');
        });
      });
      if (src.indexOf("JSON.stringify({p:'grade-4/math/cubes/'") < 0) fail('teachme-last must record this lesson’s own path');
    }
  }
};
