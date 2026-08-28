/* grade-4/math/triangle —— 三角形家族（依角分類、依邊分類）
 *
 * 這一課的正確性有兩塊：**分類**和**畫圖**，所以這份設定裡有兩套獨立重寫的實作。
 *
 * 1) 分類。頁面用「三個邊長的平方」當標準寫法，全整數，所以判定完全精確：
 *      哪幾邊一樣長 ⟺ 平方相等；
 *      最大的角是銳角／直角／鈍角 ⟺ 兩個小的平方和 － 最大的平方 的正負號。
 *    ⚠️ 拿同一條公式再寫一次等於自己比自己，所以這裡的第二套實作走**完全不同的路**：
 *    把三角形真的排到平面上，用 atan2 把三個角量回來，比最大的那一個和 90 度。
 *    兩套實作在整數平方三元組上逐一比對（ANGLE_SWEEP）。
 *
 * 2) 畫圖。triLayout 是純資料函式，設定檔把它**跑起來**，對七個形狀 ×
 *    每 5 度一個角度全掃：每個頂點都要在畫布內、量回來的邊長比例要對得上、
 *    最大角一定要在 pts[2]（畫弧和直角方框都靠這個約定）、最短的邊不可以短到看不見。
 *
 * ⚠️ 座標不能當標準寫法：正三角形放不進整數座標，等腰直角三角形的斜邊也帶根號二 ——
 *    這兩個形狀正好是這一課的主角，所以「整數座標」那一套（上一課四邊形用的）在這裡行不通。
 */

const fs = require('fs');
const path = require('path');

/* ---------- 獨立參考實作（不從頁面 import 任何判定） ---------- */
function sortSqRef(t){ return t.slice().sort((a, b) => a - b); }
/* 16 × 面積² ＝ 2(pq＋qr＋rp) － (p²＋q²＋r²)。大於 0 才是一個有面積的三角形。 */
function triValidRef(t){
  if (!Array.isArray(t) || t.length !== 3) return false;
  for (const v of t) if (!Number.isFinite(v) || v <= 0) return false;
  const [p, q, r] = t;
  return 2 * (p * q + q * r + r * p) - (p * p + q * q + r * r) > 0;
}
function sideClassRef(t){
  const s = sortSqRef(t);
  if (s[0] === s[1] && s[1] === s[2]) return 'equi';
  if (s[0] === s[1] || s[1] === s[2]) return 'iso';
  return 'scalene';
}
function angleClassRef(t){
  const s = sortSqRef(t), d = s[0] + s[1] - s[2];
  return d > 0 ? 'acute' : (d === 0 ? 'right' : 'obtuse');
}
function equalSidesRef(t){
  const s = sortSqRef(t);
  if (s[0] === s[1] && s[1] === s[2]) return 3;
  if (s[0] === s[1] || s[1] === s[2]) return 2;
  return 0;
}
function acuteCountRef(t){ return angleClassRef(t) === 'acute' ? 3 : 2; }
const SIDE_PARENTS_REF = { equi:['iso'], iso:[], scalene:[] };
function sideAlsoRef(k){ return (SIDE_PARENTS_REF[k] || []).slice(); }

/* --- 第二套「依角分類」：完全不碰上面那條整數公式。
       把三角形排到平面上，用 atan2 量三個角，比最大的那一個和 90 度。
       它同時也是「最大角在 pts[2]」這個約定的獨立見證。 --- */
function placeRef(sq){
  const s = sortSqRef(sq), [p, q, r] = s;
  const c = Math.sqrt(r);
  const x = (q + r - p) / (2 * c);
  /* y 取負號：頂點朝上，和頁面同一套（角度不受影響，長度也不受影響）。 */
  const y = Math.sqrt(Math.max(q - x * x, 0));
  return [[0, 0], [c, 0], [x, -y]];
}
function anglesDegRef(pts){
  const out = [];
  for (let i = 0; i < 3; i++){
    const v = pts[i], a = pts[(i + 1) % 3], b = pts[(i + 2) % 3];
    const u1 = [a[0] - v[0], a[1] - v[1]], u2 = [b[0] - v[0], b[1] - v[1]];
    const dot = u1[0] * u2[0] + u1[1] * u2[1];
    const crs = u1[0] * u2[1] - u1[1] * u2[0];
    out.push(Math.abs(Math.atan2(crs, dot)) * 180 / Math.PI);
  }
  return out;
}
const ANGLE_EPS = 1e-7;            // 度。精確構造出來的直角誤差在 1e-11 以下
function angleClassByGeometry(sq){
  const degs = anglesDegRef(placeRef(sq));
  const mx = Math.max(...degs);
  if (Math.abs(mx - 90) < ANGLE_EPS) return 'right';
  return mx < 90 ? 'acute' : 'obtuse';
}

/* --- 版面：獨立寫死一份規格。只跟頁面自己的 viewBox 與 CSS 互相一致是不夠的
       （三個一起改成別的數字，檢查還是綠的）。 --- */
const FIG_W_REF = 520, FIG_H_REF = 220, FIG_PAD_REF = 26;
const FIG_MIN_SIDE_REF = 60;       // 畫出來最短的一條邊至少這麼長，不然看不出形狀
const REV_W_REF = 360, REV_H_REF = 170, REV_PAD_REF = 20;
const REV_ARC_REF = 24, REV_TICK_REF = 8;   // review.html 的弧半徑與短撇長度
/* 「最小的高」＝ 2×面積 ÷ 最長邊，也就是三角形最扁的那個方向有多厚。
   門檻不是隨手挑的：弧要畫在角裡面（半徑 R），短撇要畫在邊上（長 T），
   兩個都塞得進去，圖才看得懂 —— 所以最小的高至少要 R + T。
   （5,5,9 的鈍角三角形在複習頁只有 31px 高，弧 24 ＋ 短撇 8 ＝ 32 就塞不下，
   畫出來是一條看不出是什麼的細片。） */
function minAltitude(pts){
  const a = pts[0], b = pts[1], c = pts[2];
  const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  let longest = 0;
  for (let i = 0; i < 3; i++){
    const p = pts[i], q = pts[(i + 1) % 3];
    longest = Math.max(longest, Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  return longest === 0 ? 0 : 2 * area / longest;
}

/* --- 獨立重寫的排版。和頁面的 triLayout 是同一個規格、不同的程式碼。 --- */
function layoutRef(sq, rot, W, H, pad){
  let pts = placeRef(sq);
  const gx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
  const gy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
  const a = (rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  pts = pts.map(v => {
    const dx = v[0] - gx, dy = v[1] - gy;
    return [dx * ca - dy * sa, dx * sa + dy * ca];
  });
  let xs = pts.map(v => v[0]), ys = pts.map(v => v[1]);
  const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys);
  const k = Math.min((W - 2 * pad) / bw, (H - 2 * pad) / bh);
  pts = pts.map(v => [v[0] * k, v[1] * k]);
  xs = pts.map(v => v[0]); ys = pts.map(v => v[1]);
  const ox = (W - (Math.max(...xs) - Math.min(...xs))) / 2 - Math.min(...xs);
  const oy = (H - (Math.max(...ys) - Math.min(...ys))) / 2 - Math.min(...ys);
  return pts.map(v => [v[0] + ox, v[1] + oy]);
}
/* 從畫出來的座標把三條邊的平方量回來，順序照 triLayout 的邊約定：
   邊 0 ＝ pts0→pts1（最長）、邊 1 ＝ pts1→pts2（最短）、邊 2 ＝ pts2→pts0（中間）。 */
function drawnEdgeSq(pts){
  const out = [];
  for (let i = 0; i < 3; i++){
    const a = pts[i], b = pts[(i + 1) % 3];
    out.push((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
  }
  return out;
}
/* 每一條邊要畫幾撇（獨立重寫）。 */
function tickPlanRef(sq){
  const s = sortSqRef(sq);
  const edgeSq = [s[2], s[0], s[1]];
  const groups = [];
  edgeSq.forEach(v => { if (groups.indexOf(v) < 0) groups.push(v); });
  groups.sort((a, b) => a - b);
  const out = [0, 0, 0];
  groups.forEach((v, gi) => {
    if (edgeSq.filter(e => e === v).length < 2) return;
    edgeSq.forEach((e, ei) => { if (e === v) out[ei] = gi + 1; });
  });
  return out;
}

/* --- 九宮格：哪些「依角 × 依邊」組合存在。
       null 的那兩格不是宣告出來的，是**證明**出來的（見 data.check 的窮舉掃描）。 --- */
const ANGLE_KEYS_REF = ['acute', 'right', 'obtuse'];
const SIDE_KEYS_REF = ['scalene', 'iso', 'equi'];
function cellPossibleRef(ak, sk){ return !(sk === 'equi' && ak !== 'acute'); }

/* ---------- 選項文字（刻意重抄一份，用來獨立算出「正解應該長什麼樣」） ---------- */
const ANG_TXT = {
  zh:{ acute:'銳角三角形', right:'直角三角形', obtuse:'鈍角三角形' },
  en:{ acute:'an acute triangle', right:'a right triangle', obtuse:'an obtuse triangle' }
};
const SIDE_TXT = {
  zh:{ equi:'正三角形', iso:'等腰三角形', scalene:'不等邊三角形' },
  en:{ equi:'an equilateral triangle', iso:'an isosceles triangle', scalene:'a scalene triangle' }
};
const MAYBE_TXT = { zh:'不一定', en:'Not necessarily' };
const STILL_TXT = {
  zh:k => '還是' + ANG_TXT.zh[k],
  en:k => 'Yes, still ' + ANG_TXT.en[k]
};
const PAIR_TXT = {
  zh:(a, s) => '依角是' + ANG_TXT.zh[a] + '，依邊是' + SIDE_TXT.zh[s],
  en:(a, s) => 'by angles ' + ANG_TXT.en[a] + ', by sides ' + SIDE_TXT.en[s]
};
const CELL_TXT = {
  zh:(a, s) => ANG_TXT.zh[a].replace('三角形', '') + '的' + SIDE_TXT.zh[s],
  en:(a, s) => ANG_TXT.en[a].replace(/^an? /, '') + ' and ' + SIDE_TXT.en[s].replace(/^an? /, '')
};
const ALSO_TXT = {
  zh:{ equiIso:'它也是等腰三角形', isoMaybe:'它不一定是正三角形' },
  en:{ equiIso:'It is an isosceles triangle too', isoMaybe:'It need not be an equilateral triangle' }
};
function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

/* 每一支產生器「題幹一定要問到／一定不可以問到」的字。
   只驗數字和選項的話，把 figAngle 的題幹改成問邊、正解還是依角，全部都是綠的。 */
const ASK = {
  byDegrees:   { zh:{ must:['依角'], never:['依邊'] }, en:{ must:['By angles'], never:['By sides'] } },
  biggestOnly: { zh:{ must:['依角', '最大的角'], never:['依邊'] }, en:{ must:['By angles', 'biggest angle'], never:['By sides'] } },
  sidesName:   { zh:{ must:['依邊', '最精確'], never:['依角'] }, en:{ must:['By sides', 'most specific'], never:['By angles'] } },
  figAngle:    { zh:{ must:['依角'], never:['依邊'] }, en:{ must:['By angles'], never:['By sides'] } },
  figSide:     { zh:{ must:['依邊', '最精確'], never:['依角'] }, en:{ must:['By sides', 'most specific'], never:['By angles'] } },
  impossible:  { zh:{ must:['畫不出來'], never:[] }, en:{ must:['cannot be drawn'], never:[] } },
  equiAngle:   { zh:{ must:['依角', '正三角形'], never:['依邊'] }, en:{ must:['By angles', 'equilateral'], never:['By sides'] } },
  alsoIs:      { zh:{ must:['哪一句話是對的'], never:[] }, en:{ must:['Which sentence'], never:[] } },
  notAlways:   { zh:{ must:['一定'], never:[] }, en:{ must:['always'], never:[] } },
  countAcute:  { zh:{ must:['幾個', '銳角'], never:['依邊'] }, en:{ must:['How many', 'acute angles'], never:['By sides'] } },
  turned:      { zh:{ must:['整個轉'], never:[] }, en:{ must:['as a whole'], never:[] } },
  bothNames:   { zh:{ must:['兩種分法'], never:[] }, en:{ must:['both sortings'], never:[] } }
};

/* 題庫神諭。每一題各記一列，**一列都不可以少** —— 只比對「有的題目」的話，
   刪掉一題不會有人發現。
   ang／side：題幹**推得出來**的依角／依邊分類，推不出來就寫 null
   （推不出來的名字不算「正確推理走得到」，所以它是合法誘答）。
   expect：正解那一格應該逐字長什麼樣，兩種語言各一份。
   mostSpecific：正解的上層（正三角形的上層是等腰三角形）可以當誘答，
   但題幹一定要問「最精確」，不然兩個都對。
   noNames：選項是整句話或數字，不是那六個名字，名字檢查跳過。 */
const BANK_TRI = {
  qs: [
    { ang:'acute',  side:'scalene', expect:{ zh:'銳角三角形', en:'An acute triangle' } },
    { ang:'right',  side:null,      expect:{ zh:'直角三角形', en:'A right triangle' } },
    /* noNames ＝ 選項不是那六個名字，所以跳過「名字成不成立」那一段檢查；
       ⚠️ 但**正解是什麼**還是要有神諭，不然兩種語言一起改錯就沒有人看得到。 */
    { noNames:true, expect:{ zh:'2 個', en:'2' } },
    { ang:'acute',  side:'iso',     expect:{ zh:'等腰三角形', en:'An isosceles triangle' }, mostSpecific:true },
    { noNames:true, expect:{ zh:'它是正三角形，也是等腰三角形',
                             en:'It is equilateral, and it is isosceles too' } },
    { noNames:true, expect:{ zh:'還是直角三角形，三個角本身的大小沒變',
                             en:'Yes, still a right triangle: the three angles themselves did not change' } }
  ],
  qsAdv: [
    { ang:'obtuse', side:'scalene', expect:{ zh:'鈍角三角形', en:'An obtuse triangle' } },
    { ang:'right',  side:'iso',     expect:{ zh:'等腰直角三角形', en:'An isosceles right triangle' } },
    { noNames:true, expect:{ zh:'它一定是銳角三角形', en:'It must be an acute triangle' } },
    { ang:'acute',  side:'equi',    expect:{ zh:'正三角形', en:'An equilateral triangle' }, mostSpecific:true }
  ],
  qsBoost: [
    { noNames:true, expect:{ zh:'每一個三角形都至少有兩個銳角，所以那不能當理由 —— 要三個角都是銳角才算',
                             en:'Every triangle has at least two acute angles, so that is no reason at all — all three have to be acute' } },
    { noNames:true, expect:{ zh:'等腰是依邊、直角是依角，兩種分法各分各的，可以同時成立',
                             en:'Isosceles is a side name and right is an angle name; the two sortings run separately and can both hold' } }
  ]
};

/* 產生器清單：改名或刪掉一整支，它那一組不變式、expectedCorrect 與
   renderCheck 會一起靜靜消失，什麼都不會噴。 */
const GEN_IDS = ['byDegrees', 'biggestOnly', 'sidesName', 'figAngle', 'figSide',
                 'impossible', 'equiAngle', 'alsoIs', 'notAlways', 'countAcute',
                 'turned', 'bothNames'];

/* 四頁必須用同一句話講同一條規則。min 是**剝掉註解之後**實際出現的次數 ——
   少於它就表示有一頁被改鬆了或整段被刪掉。
   ⚠️ 中文字串在這些頁面上一定有兩份（markup 的 fallback ＋ 字典），
   所以比的是「出現幾次」，不是「有沒有出現」。 */
const SIBLING_RULES = [
  { file:'index',     text:'最大的那一個角', min:9, why:'is the whole rule for sorting by angles' },
  { file:'reference', text:'最大的那一個角', min:6, why:'is the whole rule for sorting by angles' },
  { file:'review',    text:'最大的那一個角', min:3, why:'is the whole rule for sorting by angles' },
  { file:'parents',   text:'最大的那一個角', min:4, why:'is the whole rule for sorting by angles' },
  { file:'index',     text:'三個角都是',     min:6, why:'is what stops "it has an acute angle" from counting' },
  { file:'reference', text:'三個角都是',     min:3, why:'is what stops "it has an acute angle" from counting' },
  { file:'review',    text:'三個角都是',     min:2, why:'is what stops "it has an acute angle" from counting' },
  { file:'parents',   text:'三個角都是',     min:4, why:'is what stops "it has an acute angle" from counting' },
  { file:'index',     text:'至少兩條',       min:7, why:'is why an equilateral triangle is also isosceles' },
  { file:'reference', text:'至少兩條',       min:6, why:'is why an equilateral triangle is also isosceles' },
  { file:'review',    text:'至少兩條',       min:2, why:'is why an equilateral triangle is also isosceles' },
  { file:'parents',   text:'至少兩條',       min:2, why:'is why an equilateral triangle is also isosceles' },
  { file:'index',     text:'最多只有一個',   min:9, why:'is the reason the biggest angle has exactly one identity' },
  { file:'reference', text:'最多只有一個',   min:2, why:'is the reason the biggest angle has exactly one identity' },
  { file:'review',    text:'最多只有一個',   min:3, why:'is the reason the biggest angle has exactly one identity' },
  { file:'index',     text:'至少有兩個銳角', min:4, why:'is the counter to the "it has an acute angle" misconception' },
  { file:'reference', text:'至少有兩個銳角', min:5, why:'is the counter to the "it has an acute angle" misconception' },
  { file:'parents',   text:'至少有兩個銳角', min:4, why:'is the counter to the "it has an acute angle" misconception' },
  { file:'index',     text:'正三角形也是等腰三角形', min:2, why:'is the side-name family relation this lesson teaches' },
  { file:'reference', text:'正三角形也是等腰三角形', min:6, why:'is the side-name family relation this lesson teaches' },
  { file:'parents',   text:'正三角形也是等腰三角形', min:4, why:'is the side-name family relation this lesson teaches' },
  { file:'index',     text:'一定是銳角三角形', min:6, why:'is why two squares of the nine-square grid are empty' },
  { file:'reference', text:'一定是銳角三角形', min:6, why:'is why two squares of the nine-square grid are empty' },
  { file:'review',    text:'一定是銳角三角形', min:4, why:'is why two squares of the nine-square grid are empty' },
  /* 範圍切分：五年級的三課不可以被寫進這一課，可是一定要被指名。 */
  { file:'index',     text:'內角和', min:6, why:'names the grade-5 lesson this one deliberately stops short of' },
  { file:'reference', text:'內角和', min:4, why:'names the grade-5 lesson this one deliberately stops short of' },
  { file:'parents',   text:'內角和', min:8, why:'names the grade-5 lesson this one deliberately stops short of' }
];

/* 要比對的是**讀者看得到的字**，所以三種東西都要先剝掉。 */
function stripComments(src){
  return src.replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/\/\*[\s\S]*?\*\//g, ' ');
}
/* ⚠️ 剝標籤只能用在「數讀者看到的詞」上，**絕對不可以**拿來掃程式結構：
   `<[^>]+>` 碰到 JS 裡的 `i < 3; i++){ … >` 會把中間整段吃掉。 */
function readerText(src){
  return stripComments(src)
            .replace(/<[^>]+>/g, '')
            .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}
function countOf(text, needle){
  let n = 0, at = -1;
  while ((at = text.indexOf(needle, at + 1)) >= 0) n++;
  return n;
}
/* 關聯比較之前先確認是數字 —— undefined < x 是 false，會讓整條斷言靜靜通過。 */
function num(v){ return typeof v === 'number' && Number.isFinite(v); }
function int(v){ return num(v) && Number.isInteger(v); }

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 分類核心 --- */
    { file:'index', via:'index', expect:'disagrees with the reference',
      find:"    var s = sortSq(t), d = s[0] + s[1] - s[2];\n    return d > 0 ? 'acute' : (d === 0 ? 'right' : 'obtuse');",
      replace:"    var s = sortSq(t), d = s[0] + s[1] - s[2];\n    return d >= 0 ? 'acute' : 'obtuse';",
      why:'a right triangle would be reported as acute' },
    { file:'index', via:'index', expect:'disagrees with the reference',
      find:"    if (s[0] === s[1] || s[1] === s[2]) return 'iso';\n    return 'scalene';",
      replace:"    return 'scalene';",
      why:'every isosceles triangle would be called scalene' },
    { file:'index', via:'index', expect:'no longer says an equilateral triangle is also isosceles',
      find:"  var SIDE_PARENTS = { equi:['iso'], iso:[], scalene:[] };",
      replace:"  var SIDE_PARENTS = { equi:[], iso:[], scalene:[] };",
      why:'an equilateral triangle would stop counting as isosceles' },
    { file:'index', via:'index', expect:'but the reference gives',
      find:"  function acuteCount(t){ return angleClass(t) === 'acute' ? 3 : 2; }",
      replace:"  function acuteCount(t){ return angleClass(t) === 'acute' ? 3 : 1; }",
      why:'a right triangle would be said to contain only one acute angle' },
    { file:'index', via:'index', expect:'triValid accepts',
      find:"    return 2 * (p * q + q * r + r * p) - (p * p + q * q + r * r) > 0;",
      replace:"    return 2 * (p * q + q * r + r * p) - (p * p + q * q + r * r) >= 0;",
      why:'a degenerate (flat) triangle would be accepted as valid' },
    /* --- 目錄的資料 --- */
    { file:'index', via:'index', expect:'by angles, not right',
      find:"    rightIso:      { sq:[16, 16, 32], rot:0,  cm:null },",
      replace:"    rightIso:      { sq:[16, 16, 33], rot:0,  cm:null },",
      why:'the isosceles right triangle would silently stop being right-angled' },
    { file:'index', via:'index', expect:'the drawn edge order needs',
      find:"    obtuseScalene: { sq:[16, 25, 64], rot:0,  cm:[8, 4, 5] },",
      replace:"    obtuseScalene: { sq:[16, 25, 64], rot:0,  cm:[4, 5, 8] },",
      why:'the printed side lengths would no longer line up with the drawn edges' },
    { file:'index', via:'index', expect:'the reference says it is impossible',
      find:"    'right-scalene':'rightScalene',  'right-iso':'rightIso',  'right-equi':null,",
      replace:"    'right-scalene':'rightScalene',  'right-iso':'rightIso',  'right-equi':'rightIso',",
      why:'the grid would claim a right equilateral triangle exists' },
    { file:'index', via:'index', expect:'the reference says it is possible',
      find:"    'acute-scalene':'acuteScalene',  'acute-iso':'acuteIso',  'acute-equi':'acuteEqui',",
      replace:"    'acute-scalene':'acuteScalene',  'acute-iso':'acuteIso',  'acute-equi':null,",
      why:'the grid would claim an acute equilateral triangle is impossible' },
    /* --- 畫圖 --- */
    { file:'index', via:'index', expect:'outside the canvas',
      find:"    var k = Math.min((FIG_W - 2 * FIG_PAD) / bw, (FIG_H - 2 * FIG_PAD) / bh);",
      replace:"    var k = Math.min((FIG_W - 2 * FIG_PAD) / bw, (FIG_H - 2 * FIG_PAD) / bh) * 1.25;",
      why:'the triangle would overflow the canvas at some rotations' },
    { file:'index', via:'index', expect:'biggest angle is not at pts[2]',
      find:"    var pts = [[0, 0], [c, 0], [x, -y]];",
      replace:"    var pts = [[0, 0], [x, -y], [c, 0]];",
      why:'the arc and the right-angle box would be drawn on the wrong vertex' },
    { file:'index', via:'index', expect:'the drawn side lengths are wrong',
      find:"    var x = (q + r - p) / (2 * c);",
      replace:"    var x = (q + r - p) / (2.2 * c);",
      why:'the drawn triangle would no longer have the side lengths it claims' },
    { file:'index', via:'index', expect:'not centred',
      find:"    var ox = (FIG_W - (Math.max.apply(null, xs) - Math.min.apply(null, xs))) / 2 - Math.min.apply(null, xs);",
      replace:"    var ox = (FIG_W - (Math.max.apply(null, xs) - Math.min.apply(null, xs))) / 2 - Math.min.apply(null, xs) + 0.5;",
      why:'the figure would sit half a pixel off centre — inside the canvas, so only the centring assertion can see it' },
    { file:'index', via:'index', expect:'to fit inside it',
      find:"  var FIG_ARC_R = 30;          // 標最大角的弧半徑",
      replace:"  var FIG_ARC_R = 45;          // 標最大角的弧半徑",
      why:'the arc would be too big to fit inside the flattest triangle in the catalogue' },
    { file:'review', via:'review', expect:'thick at its flattest',
      find:"    'obtuse-iso':     [25, 25, 64]",
      replace:"    'obtuse-iso':     [25, 25, 81]",
      why:'the 5-5-9 isosceles renders as an unreadable sliver in the smaller review canvas' },
    { file:'review', via:'index', expect:'figure constants are',
      find:"  var FW = 360, FH = 170, FPAD = 20, MK = 11, TK = 8, ARC = 24, T_TICK = 0.5;",
      replace:"  var FW = 360, FH = 170, FPAD = 20, MK = 11, TK = 8, ARC = 40, T_TICK = 0.5;",
      why:'the config would still be computing its legibility threshold from the old arc radius' },
    { file:'index', via:'index', expect:'ticks 3 sides of a scalene',
      find:"      if (n < 2) return;                    // 只有一條的邊不畫短撇",
      replace:"      if (n < 1) return;                    // 只有一條的邊不畫短撇",
      why:'a scalene triangle would get tick marks on every side, claiming they are equal' },
    { file:'index', via:'index', expect:'but the reference gives',
      find:"    var edgeSq = [s[2], s[0], s[1]];        // 和 triLayout 的邊順序一致",
      replace:"    var edgeSq = [s[0], s[1], s[2]];        // 和 triLayout 的邊順序一致",
      why:'ticks would be drawn on the wrong edges of an isosceles triangle' },
    /* --- 範例 2：兩條邊碰不碰得到 --- */
    { file:'index', via:'index', expect:'says the other angles are strictly smaller',
      find:"'另外兩個角<strong>不會比它大</strong>，所以也都是銳角 —— <strong>三個角都是</strong>銳角。'",
      replace:"'另外兩個角比它小，所以也都是銳角 —— <strong>三個角都是</strong>銳角。'",
      why:'"strictly smaller" is false for an equilateral triangle, whose three angles are equal' },
    { file:'index', via:'index', expect:'does not use the "at most one right or obtuse angle" reason',
      find:"           : cls === 'acute'\n             ? '另外兩個角<strong>不會比它大</strong>",
      replace:"           : true\n             ? '另外兩個角<strong>不會比它大</strong>",
      why:'the narration would stop branching and give the acute reason for obtuse triangles too' },
    { file:'reference', via:'index', expect:'two equal angles are not necessarily the biggest',
      find:"      d1p:'只看<strong>最大的那一個角</strong>：比直角小 → <strong>銳角三角形</strong>；剛好直角 → <strong>直角三角形</strong>；比直角大 → <strong>鈍角三角形</strong>。（<strong>最大的角有時候不只一個</strong>，例如正三角形的三個角一樣大；挑其中哪一個比都一樣。）'",
      replace:"      d1p:'只看<strong>最大的那一個角</strong>：比直角小 → <strong>銳角三角形</strong>；剛好直角 → <strong>直角三角形</strong>；比直角大 → <strong>鈍角三角形</strong>。（有兩三個角一樣大時，它們就一起是最大的，挑哪一個比都一樣。）'",
      why:'in a 30/30/120 triangle the two equal angles are the smallest, not the biggest' },
    { file:'index', via:'index', expect:'should appear twice',
      find:"      s2lead:'從一條底邊的兩端各畫一條邊出去，看它們碰不碰得到。碰得到才圍得成三角形。點下面五種畫法試試看。',",
      replace:"      s2lead:'從一條底邊的兩端各畫一條邊出去，看它們碰不碰得到。碰得到才圍得成三角形。點下面 5 種畫法試試看。',",
      why:'the dictionary copy would drift from the markup fallback and the old check only read the first one' },
    { file:'index', via:'index', expect:'attempts to tap, but RAY_CASES has',
      find:"    { a:40, b:40,  why:'ok'    }    // 兩個底角都是銳角，圍出來的卻是鈍角三角形",
      replace:"    { a:40, b:40,  why:'ok'    },   // 兩個底角都是銳角，圍出來的卻是鈍角三角形\n    { a:35, b:35,  why:'ok'    }    // 多一筆，課文的「五種」就對不上了",
      why:'a sixth attempt would be added without updating the "five attempts" the lead promises' },
    { file:'index', via:'index', expect:'so they cannot meet',
      find:"    if (c.a + c.b >= 180) return null;",
      replace:"    if (c.a + c.b > 180) return null;",
      why:'two right angles would be reported as closing into a triangle' },
    { file:'index', via:'index', expect:'the narration would be false',
      find:"    { a:90, b:90,  why:'para'  },   // 兩條邊都垂直於底邊 → 互相平行 → 永遠不相交",
      replace:"    { a:85, b:95,  why:'para'  },   // 兩條邊都垂直於底邊 → 互相平行 → 永遠不相交",
      why:'the "both perpendicular, therefore parallel" case would not actually have two right angles' },
    { file:'index', via:'index', expect:'is off the canvas',
      find:"  var RAY_BASE = { x0:135, x1:385, y:180 };",
      replace:"  var RAY_BASE = { x0:60, x1:460, y:180 };",
      why:'the apex of the closing cases would be pushed off the top of the canvas' },
    { file:'index', via:'index', expect:'rayClass says',
      find:"    var third = 180 - c.a - c.b;\n    var mx = Math.max(c.a, c.b, third);",
      replace:"    var third = 180 - c.a - c.b;\n    var mx = Math.max(c.a, c.b);",
      why:'a triangle whose biggest angle is the apex would be named after a base angle' },
    /* --- 遊戲關卡 --- */
    { file:'index', via:'index', expect:'computed answer is',
      find:"    { kind:'side',   tri:'acuteEqui',     rot:22, opts:['equi', 'iso', 'scalene', 'rightName'],          ans:0 },",
      replace:"    { kind:'side',   tri:'acuteEqui',     rot:22, opts:['equi', 'iso', 'scalene', 'rightName'],          ans:1 },",
      why:'a game round would mark the wrong option correct' },
    { file:'index', via:'index', expect:'reachable by correct reasoning',
      find:"    { kind:'also',   side:'equi',         opts:['iso', 'scalene', 'rightName', 'none'],                  ans:0 }",
      replace:"    { kind:'also',   side:'equi',         opts:['iso', 'scalene', 'acute', 'none'],                     ans:0 }",
      why:'"an acute triangle" is genuinely also true of an equilateral triangle, so it cannot be a distractor' },
    { file:'index', via:'index', expect:'exactly one impossible combination',
      find:"    { kind:'cannot', opts:['right-equi', 'right-iso', 'acute-equi', 'obtuse-iso'],                       ans:0 },",
      replace:"    { kind:'cannot', opts:['right-equi', 'obtuse-equi', 'acute-equi', 'obtuse-iso'],                    ans:0 },",
      why:'two of the four options would be impossible, so two answers would be correct' },
    /* --- 題庫 --- */
    { file:'index', via:'index', expect:'duplicate options',
      find:"          opts:['直角三角形','銳角三角形','鈍角三角形','正三角形'], ans:1,",
      replace:"          opts:['直角三角形','銳角三角形','鈍角三角形','銳角三角形'], ans:1,",
      why:'two identical options in the quiz' },
    { file:'index', via:'index', expect:'answer index differs',
      find:"          opts:['正三角形','等腰三角形','不等邊三角形','直角三角形'], ans:1,",
      replace:"          opts:['正三角形','等腰三角形','不等邊三角形','直角三角形'], ans:2,",
      why:'zh and en would disagree about which option is correct' },
    /* --- 跨頁措辭 --- */
    { file:'reference', via:'index', expect:'expected at least',
      find:"d2p:'數有幾條邊一樣長：三條都一樣 → <strong>正三角形</strong>；<strong>至少兩條</strong>一樣 → <strong>等腰三角形</strong>；一條都沒有一樣 → <strong>不等邊三角形</strong>。'",
      replace:"d2p:'數有幾條邊一樣長：三條都一樣 → <strong>正三角形</strong>；<strong>剛好兩條</strong>一樣 → <strong>等腰三角形</strong>；一條都沒有一樣 → <strong>不等邊三角形</strong>。'",
      why:'the cheat sheet would tighten "at least two" into "exactly two", which excludes equilateral' },
    { file:'parents', via:'index', expect:'expected at least',
      find:"s1p2:'<strong>大人最容易誤解</strong>的是把這一課當成「認六個名字」。真正在練的是<strong>用定義判斷、而且判斷兩次</strong>。孩子最典型的錯是「它有銳角，所以是銳角三角形」—— 可是<strong>每一個三角形都至少有兩個銳角</strong>",
      replace:"s1p2:'<strong>大人最容易誤解</strong>的是把這一課當成「認六個名字」。真正在練的是<strong>用定義判斷、而且判斷兩次</strong>。孩子最典型的錯是「它有銳角，所以是銳角三角形」—— 可是<strong>每一個三角形都有銳角</strong>",
      why:'the parents page would drop the "at least two" that makes the argument work' },
    /* --- review 的產生器 --- */
    { file:'review', via:'review', expect:'must not be a right triangle',
      find:"      if (angleClass(sq) === 'right') continue;   // 誘答「直角三角形」必須是錯的",
      replace:"      if (kind === 'scalene') return [3, 4, 5];   // 誘答「直角三角形」必須是錯的",
      why:'sidesName could draw a right triangle, making its "right triangle" distractor correct' },
    { file:'review', via:'review', expect:'must not be a right triangle',
      find:"        var ok = CELLS_OK.filter(function(c){ return angleClass(FIG_SQ[c]) !== 'right'; });",
      replace:"        var ok = CELLS_OK.slice();",
      why:'figSide could draw a right triangle, making its "right triangle" distractor correct' },
    { file:'review', via:'review', expect:'is possible, so it cannot be',
      find:"        var bad = pick(CELLS_NO);",
      replace:"        var bad = pick(CELLS_OK);",
      why:'impossible would mark a perfectly drawable combination as the impossible one' },
    { file:'review', via:'review', expect:'is impossible too',
      find:"        var good = shuffle(CELLS_OK).slice(0, 3);",
      replace:"        var good = shuffle(CELLS_OK.concat(CELLS_NO)).slice(0, 3);",
      why:'a second impossible combination could appear among the distractors' },
    { file:'review', via:'review', expect:'so it is not a counter-example',
      find:"          { from:'iso',     to:'acute',  yes:'acute-iso',      no:'obtuse-iso'     },",
      replace:"          { from:'iso',     to:'acute',  yes:'acute-iso',      no:'acute-iso'      },",
      why:'the "counter-example" would itself satisfy the property, so it proves nothing' },
    { file:'review', via:'review', expect:'but the biggest angle',
      find:"        return { degs:degs, key:kind, opts:order, ans:order.indexOf(kind) };",
      replace:"        return { degs:degs, key:'acute', opts:order, ans:order.indexOf(kind) };",
      why:'byDegrees would label every triangle acute regardless of its angles' },
    { file:'review', via:'review', expect:'the stem must ask about',
      find:"            ? '一個三角形的三條邊是 ' + t.cmList(d.cm) + '。<strong>依邊</strong>分類，<strong>最精確</strong>的名字是什麼？'",
      replace:"            ? '一個三角形的三條邊是 ' + t.cmList(d.cm) + '。它叫什麼名字？'",
      why:'sidesName would ask a question with more than one correct answer' },
    { file:'review', via:'review', expect:'how many sides are equal',
      find:"        var n = equalSides(sqOf(d.cm));",
      replace:"        var n = 7;",
      why:'the explanation would report a fixed number of equal sides regardless of the actual sides' },
    { file:'review', via:'review', expect:'article was mangled',
      find:"  function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }",
      replace:"  function cap(s){ return s.replace(/^an? /, 'A '); }",
      why:'"an acute triangle" would render as "A acute triangle"' },
    { file:'review', via:'review', expect:'the answer must be that the name does not change',
      find:"        var order = shuffle(['still', 'changed', 'dependsTurn', 'onlyRight']);\n        return { key:kind, deg:deg, opts:order, ans:order.indexOf('still') };",
      replace:"        var order = shuffle(['still', 'changed', 'dependsTurn', 'onlyRight']);\n        return { key:kind, deg:deg, opts:order, ans:0 };",
      why:'turned would point at whatever option landed first instead of the computed answer' },
    { file:'review', via:'review', expect:'but the reference layout gives',
      find:"    var k = Math.min((FW - 2 * FPAD) / bw, (FH - 2 * FPAD) / bh);",
      replace:"    var k = Math.min((FW - 2 * FPAD) / bw, (FH - 2 * FPAD) / bh) * 0.8;",
      why:'the review page would draw the triangle at the wrong scale, and only comparing the PAGE-computed points can see it' },
    { file:'review', via:'review', expect:'the page ticks edges',
      find:"      if (edgeSq.filter(function(e){ return e === v; }).length < 2) return;",
      replace:"      if (edgeSq.filter(function(e){ return e === v; }).length < 1) return;",
      why:'the review page would tick every side of a scalene triangle' },
    { file:'review', via:'index', expect:'it is hard-coded',
      find:"        var cell = pick(CELLS_OK);\n        var sq = FIG_SQ[cell];\n        if (!sq) return null;\n        var kind = angleClass(sq);\n        var order = shuffle(['acute', 'right', 'obtuse', 'noIdea']);\n        return { cell:cell, sq:sq, rot:pick(ROTS), key:kind, opts:order, ans:order.indexOf(kind) };",
      replace:"        var cell = 'acute-scalene';\n        var sq = FIG_SQ[cell];\n        if (!sq) return null;\n        var kind = angleClass(sq);\n        var order = ['acute', 'right', 'obtuse', 'noIdea'];\n        return { cell:cell, sq:sq, rot:0, key:kind, opts:order, ans:order.indexOf(kind) };",
      why:'figAngle would stop sampling and always draw the same triangle, while every invariant stayed green' },
    { file:'index', via:'index', expect:'the page roundAnswer() says',
      find:"    if (r.kind === 'acutes') return String(acuteCount(TRI[r.tri].sq));",
      replace:"    if (r.kind === 'acutes') return String(acuteCount(TRI[r.tri].sq) + 1);",
      why:'the page would score the "how many acute angles" round from its own broken recomputation' },
    { file:'index', via:'index', expect:'the oracle expects',
      find:"          opts:['0 個','1 個','2 個','3 個'], ans:2,",
      replace:"          opts:['0 個','1 個','2 個','3 個'], ans:1,",
      why:'a sentence/count question could have ans flipped in both languages with nothing to catch it' },
    { file:'index', via:'index', expect:'has viewBox',
      find:'<svg class="shapefig" id="s3fig" viewBox="0 0 520 220"',
      replace:'<svg class="shapefig" id="s3fig" viewBox="0 0 520 260"',
      why:'a figure other than the first would be stretched, and only the first one used to be checked' },
    { file:'parents', via:'index', expect:'outside the sentence that names it as out of scope',
      find:"      s5note:'⚠️ 這一課刻意<strong>不教</strong>：三角形的<strong>內角和 180 度</strong>、<strong>面積公式</strong>、<strong>對稱軸</strong>（都在五年級）、以及<strong>兩邊和大於第三邊</strong>（也在五年級）。這一課只做分類。",
      replace:"      s5note:'⚠️ 這一課刻意<strong>不教</strong>：三角形的<strong>內角和 180 度</strong>、<strong>面積公式</strong>、<strong>對稱軸</strong>（都在五年級）、以及<strong>兩邊和大於第三邊</strong>（也在五年級）。五年級會再說明，兩邊和大於第三邊很有用。這一課只做分類。",
      why:'the old proximity rule let a grade-5 rule be taught as long as the words "grade 5" appeared nearby' },
    { file:'review', via:'review', expect:'is reachable by correct reasoning',
      find:"          if (p0[0] === q0[0] && sideAlso(q0[1]).indexOf(p0[1]) >= 0) return false;",
      replace:"          if (false) return false;",
      why:'bothNames would offer "acute + isosceles" alongside "acute + equilateral", and both are true' },
    { file:'review', via:'review', expect:'not four distinct pairs',
      find:"          if (c === cell) return false;",
      replace:"          if (false) return false;",
      why:'bothNames could offer the correct pair twice' }
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      byDegrees: d => {
        if (!Array.isArray(d.degs) || d.degs.length !== 3) return 'byDegrees: degs is not three angles';
        for (const v of d.degs) if (!int(v) || v <= 0 || v >= 180) return 'byDegrees: ' + v + ' is not a usable whole-degree angle';
        const sum = d.degs[0] + d.degs[1] + d.degs[2];
        if (sum !== 180) return 'byDegrees: the three angles add to ' + sum + ', so they are not one triangle';
        const mx = Math.max(...d.degs);
        const want = mx > 90 ? 'obtuse' : (mx === 90 ? 'right' : 'acute');
        if (d.key !== want) return 'byDegrees: marked ' + d.key + ' but the biggest angle ' + mx + ' gives ' + want;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'byDegrees: options are not four distinct choices';
        if (d.opts.indexOf('noIdea') < 0) return 'byDegrees: the "cannot tell" distractor is missing';
        if (d.opts[d.ans] !== d.key) return 'byDegrees: opts[ans] is not the computed angle class';
      },
      biggestOnly: d => {
        if (!int(d.deg) || d.deg < 60 || d.deg >= 180) return 'biggestOnly: ' + d.deg + ' is out of the range this lesson uses';
        const want = d.deg > 90 ? 'obtuse' : (d.deg === 90 ? 'right' : 'acute');
        if (d.key !== want) return 'biggestOnly: marked ' + d.key + ' but ' + d.deg + ' degrees gives ' + want;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'biggestOnly: options are not four distinct choices';
        if (d.opts[d.ans] !== d.key) return 'biggestOnly: opts[ans] is not the computed angle class';
      },
      sidesName: d => {
        if (!Array.isArray(d.cm) || d.cm.length !== 3) return 'sidesName: cm is not three lengths';
        for (const v of d.cm) if (!int(v) || v <= 0 || v > 20) return 'sidesName: ' + v + ' cm is not a usable whole-centimetre side';
        const sq = d.cm.map(v => v * v);
        if (!triValidRef(sq)) return 'sidesName: ' + d.cm.join('/') + ' cannot close into a triangle';
        if (sideClassRef(sq) !== d.key) return 'sidesName: marked ' + d.key + ' but the sides give ' + sideClassRef(sq);
        if (d.opts.indexOf('rightName') < 0) return 'sidesName: the angle-name distractor is missing';
        if (angleClassRef(sq) === 'right')
          return 'sidesName: ' + d.cm.join('/') + ' IS right-angled — the drawn triangle must not be a right triangle, or the distractor becomes correct';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'sidesName: options are not four distinct choices';
        if (d.opts[d.ans] !== d.key) return 'sidesName: opts[ans] is not the computed side class';
      },
      figAngle: d => {
        if (!triValidRef(d.sq)) return 'figAngle: the figure is not a valid triangle';
        const p = d.cell.split('-');
        if (!cellPossibleRef(p[0], p[1])) return 'figAngle: ' + d.cell + ' is impossible, it must never be drawn';
        if (angleClassRef(d.sq) !== p[0]) return 'figAngle: the figure is not the angle class its cell claims';
        if (d.key !== angleClassRef(d.sq)) return 'figAngle: marked ' + d.key + ' but the figure is ' + angleClassRef(d.sq);
        if (angleClassByGeometry(d.sq) !== d.key) return 'figAngle: the drawn geometry disagrees with the integer rule';
        if (!num(d.rot)) return 'figAngle: rot is not a number';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'figAngle: options are not four distinct choices';
        if (d.opts[d.ans] !== d.key) return 'figAngle: opts[ans] is not the drawn angle class';
      },
      figSide: d => {
        if (!triValidRef(d.sq)) return 'figSide: the figure is not a valid triangle';
        const p = d.cell.split('-');
        if (!cellPossibleRef(p[0], p[1])) return 'figSide: ' + d.cell + ' is impossible, it must never be drawn';
        if (sideClassRef(d.sq) !== d.key) return 'figSide: marked ' + d.key + ' but the figure is ' + sideClassRef(d.sq);
        if (d.opts.indexOf('rightName') < 0) return 'figSide: the angle-name distractor is missing';
        if (angleClassRef(d.sq) === 'right')
          return 'figSide: the drawn triangle IS right-angled — a figSide figure must not be a right triangle, or the distractor becomes correct';
        if (!num(d.rot)) return 'figSide: rot is not a number';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'figSide: options are not four distinct choices';
        if (d.opts[d.ans] !== d.key) return 'figSide: opts[ans] is not the drawn side class';
      },
      impossible: d => {
        const bp = d.bad.split('-');
        if (cellPossibleRef(bp[0], bp[1])) return 'impossible: the answer ' + d.bad + ' is possible, so it cannot be the odd one out';
        if (d.good.length !== 3 || new Set(d.good).size !== 3) return 'impossible: the three distractors are not three distinct cells';
        for (const c of d.good){
          const p = c.split('-');
          if (!cellPossibleRef(p[0], p[1])) return 'impossible: distractor ' + c + ' is impossible too — two options would be correct';
          if (c === d.bad) return 'impossible: the answer appears among the distractors';
        }
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'impossible: options are not four distinct cells';
        const imps = d.opts.filter(c => !cellPossibleRef(c.split('-')[0], c.split('-')[1]));
        if (imps.length !== 1) return 'impossible: exactly one impossible combination is required, found ' + imps.length;
        if (d.opts[d.ans] !== d.bad) return 'impossible: opts[ans] is not the impossible cell';
      },
      equiAngle: d => {
        if (angleClassRef([36, 36, 36]) !== 'acute') return 'equiAngle: the reference says an equilateral triangle is not acute';
        if (d.key !== 'acute') return 'equiAngle: the answer must be the acute class';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'equiAngle: options are not four distinct choices';
        if (d.opts.indexOf('noIdea') < 0) return 'equiAngle: the "cannot tell" distractor is missing';
        if (d.opts[d.ans] !== 'acute') return 'equiAngle: opts[ans] is not the acute class';
      },
      alsoIs: d => {
        if (d.kind !== 'equi' && d.kind !== 'iso') return 'alsoIs: unexpected shape ' + d.kind;
        const want = d.kind === 'equi' ? 'equiIso' : 'isoMaybe';
        if (d.right !== want) return 'alsoIs: the marked correct key is ' + d.right + ', expected ' + want;
        if (d.kind === 'equi' && sideAlsoRef('equi').indexOf('iso') < 0)
          return 'alsoIs: the reference no longer says an equilateral triangle is isosceles';
        if (d.kind === 'iso' && sideAlsoRef('iso').length)
          return 'alsoIs: the reference gives isosceles a looser name, so "need not be equilateral" is the wrong shape of answer';
        /* ⚠️ 對正三角形來說「它也是銳角三角形」是真的，不可以當誘答。 */
        for (const k of d.opts) if (/acute/i.test(k)) return 'alsoIs: an "acute" option is genuinely true of an equilateral triangle and must not be a distractor';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'alsoIs: options are not four distinct sentences';
        if (d.opts[d.ans] !== d.right) return 'alsoIs: opts[ans] is not the correct sentence';
      },
      notAlways: d => {
        const names = ANGLE_KEYS_REF.concat(SIDE_KEYS_REF);
        if (names.indexOf(d.from) < 0 || names.indexOf(d.to) < 0) return 'notAlways: unknown class in ' + d.from + '->' + d.to;
        if (d.from === d.to) return 'notAlways: asking whether a class is always itself';
        const yes = d.yes.split('-'), no = d.no.split('-');
        if (!cellPossibleRef(yes[0], yes[1])) return 'notAlways: the supporting example ' + d.yes + ' cannot be drawn';
        if (!cellPossibleRef(no[0], no[1])) return 'notAlways: the counter-example ' + d.no + ' cannot be drawn';
        /* 一個格子「是不是」某一類：依角看前半、依邊看後半，
           而且正三角形也算等腰（家族關係）。 */
        const isA = (cell, k) => {
          const [a, s] = cell.split('-');
          if (ANGLE_KEYS_REF.indexOf(k) >= 0) return a === k;
          return s === k || sideAlsoRef(s).indexOf(k) >= 0;
        };
        if (!isA(d.yes, d.from)) return 'notAlways: the supporting example ' + d.yes + ' is not ' + d.from;
        if (!isA(d.yes, d.to)) return 'notAlways: the supporting example ' + d.yes + ' is not ' + d.to;
        if (!isA(d.no, d.from)) return 'notAlways: the counter-example ' + d.no + ' is not ' + d.from + ', so it proves nothing';
        if (isA(d.no, d.to)) return 'notAlways: the counter-example ' + d.no + ' IS ' + d.to + ', so it is not a counter-example';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'notAlways: options are not four distinct choices';
        if (d.opts[d.ans] !== 'maybe') return 'notAlways: the answer must be "not necessarily"';
      },
      countAcute: d => {
        if (!triValidRef(d.sq)) return 'countAcute: the sample triangle is not valid';
        if (angleClassRef(d.sq) !== d.key) return 'countAcute: the sample is ' + angleClassRef(d.sq) + ' but the stem says ' + d.key;
        if (d.n !== acuteCountRef(d.sq)) return 'countAcute: says ' + d.n + ' acute angles but the reference gives ' + acuteCountRef(d.sq);
        if (d.n < 2 || d.n > 3) return 'countAcute: every triangle has 2 or 3 acute angles, not ' + d.n;
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'countAcute: options are not four distinct counts';
        if (d.opts.indexOf(3) < 0 || d.opts.indexOf(2) < 0) return 'countAcute: both 2 and 3 must be offered, or the misconception is never tested';
        if (d.opts[d.ans] !== d.n) return 'countAcute: opts[ans] is not the computed count';
      },
      turned: d => {
        if (ANGLE_KEYS_REF.indexOf(d.key) < 0) return 'turned: unknown angle class ' + d.key;
        if (!int(d.deg) || d.deg <= 0 || d.deg >= 90) return 'turned: ' + d.deg + ' should be a visible turn under a right angle';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'turned: options are not four distinct choices';
        if (d.opts[d.ans] !== 'still') return 'turned: the answer must be that the name does not change';
      },
      bothNames: d => {
        if (!triValidRef(d.sq)) return 'bothNames: the figure is not a valid triangle';
        const p = d.cell.split('-');
        if (!cellPossibleRef(p[0], p[1])) return 'bothNames: ' + d.cell + ' is impossible, it must never be drawn';
        if (angleClassRef(d.sq) !== p[0]) return 'bothNames: the figure is ' + angleClassRef(d.sq) + ' but the cell says ' + p[0];
        if (sideClassRef(d.sq) !== p[1]) return 'bothNames: the figure is ' + sideClassRef(d.sq) + ' but the cell says ' + p[1];
        if (!num(d.rot)) return 'bothNames: rot is not a number';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'bothNames: options are not four distinct pairs';
        for (const c of d.opts){
          const q = c.split('-');
          if (!cellPossibleRef(q[0], q[1])) return 'bothNames: option ' + c + ' is a combination that cannot exist';
        }
        if (d.opts[d.ans] !== d.cell) return 'bothNames: opts[ans] is not the drawn triangle';
        const matches = d.opts.filter(c => c === d.cell);
        if (matches.length !== 1) return 'bothNames: the correct pair is offered ' + matches.length + ' times';
        /* ⚠️ 依角一樣、依邊換成比較鬆的上層，那一格**也是對的**
           （正三角形也是等腰三角形），所以它不可以出現在誘答裡。 */
        for (const c of d.opts){
          if (c === d.cell) continue;
          const o = c.split('-');
          if (o[0] === p[0] && sideAlsoRef(p[1]).indexOf(o[1]) >= 0)
            return 'bothNames: option ' + c + ' is reachable by correct reasoning — a ' + p[1] +
                   ' triangle is also ' + o[1] + ', so that pair is true as well';
        }
      }
    },

    /* 正解的文字由這裡**獨立算一次**，不看 d.ans 指到哪個選項，
       也不呼叫 review.html 的任何格式化函式。 */
    expectedCorrect: function(d, genId, lang){
      const A = ANG_TXT[lang], S = SIDE_TXT[lang];
      switch (genId){
        case 'byDegrees': {
          const mx = Math.max(...d.degs);
          return cap(A[mx > 90 ? 'obtuse' : (mx === 90 ? 'right' : 'acute')]);
        }
        case 'biggestOnly':
          return cap(A[d.deg > 90 ? 'obtuse' : (d.deg === 90 ? 'right' : 'acute')]);
        case 'sidesName':  return cap(S[sideClassRef(d.cm.map(v => v * v))]);
        case 'figAngle':   return cap(A[angleClassRef(d.sq)]);
        case 'figSide':    return cap(S[sideClassRef(d.sq)]);
        case 'impossible': { const p = d.bad.split('-'); return CELL_TXT[lang](p[0], p[1]); }
        case 'equiAngle':  return cap(A[angleClassRef([36, 36, 36])]);
        case 'alsoIs':     return ALSO_TXT[lang][d.kind === 'equi' ? 'equiIso' : 'isoMaybe'];
        case 'notAlways':  return MAYBE_TXT[lang];
        case 'countAcute': return lang === 'zh' ? acuteCountRef(d.sq) + ' 個' : String(acuteCountRef(d.sq));
        case 'turned':     return STILL_TXT[lang](d.key);
        case 'bothNames':  { const p = d.cell.split('-'); return PAIR_TXT[lang](p[0], p[1]); }
        default: return null;
      }
    },

    /* 選項字串本身的健康檢查。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (!s || !s.trim()) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(s)) return 'option leaks an internal value: ' + s;
      if (/[·#]/.test(s)) return 'option looks like a fallback string: ' + s;
      if (/<[a-z]/i.test(s)) return 'option contains markup: ' + s;
      if (lang === 'en' && /[㐀-鿿]/.test(s)) return 'English option contains Chinese: ' + s;
      if (lang === 'en' && /\bA (?=[aeiou])/.test(s)) return 'English option has "A" before a vowel: ' + s;
      return null;
    },

    /* 渲染後再驗一次：INVARIANTS 只看得到資料，看不到題幹與解釋，
       可是題幹是拼出來的。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length !== 4) out.push('a question must offer exactly four options');
      if (new Set(q.opts).size !== q.opts.length) out.push('two options render to the same text: ' + q.opts.join(' | '));
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');
      if (lang === 'en' && /[㐀-鿿]/.test(q.stem + q.why)) out.push('English question contains Chinese');

      /* 題幹「問的是什麼」要單獨驗一次 —— 只驗數字的話，把 figSide 的題幹
         改成問角、正解卻還是邊，所有數字檢查都還是綠的。 */
      const ask = ASK[genId] && ASK[genId][lang];
      if (ask){
        /* 英文的句首大小寫會變（'Sorted by angles' vs '<strong>By angles</strong>'），
           所以英文比對前先統一成小寫；中文沒有這個問題。 */
        const raw = q.stem.replace(/<[^>]+>/g, '');
        const plain = lang === 'en' ? raw.toLowerCase() : raw;
        const norm = t => (lang === 'en' ? t.toLowerCase() : t);
        for (const m of ask.must) if (plain.indexOf(norm(m)) < 0) out.push('the stem must ask about "' + m + '" but does not: ' + raw.slice(0, 70));
        for (const nn of ask.never) if (plain.indexOf(norm(nn)) >= 0) out.push('the stem must not mention "' + nn + '": ' + raw.slice(0, 70));
      }

      /* 圖：畫出來的三角形必須就是說明裡講的那一個。 */
      if (q.fig){
        if (!triValidRef(q.fig.sq)) out.push('the figure is not a valid triangle');
        else if (!Array.isArray(q.fig.pts) || q.fig.pts.length !== 3)
          out.push('the figure does not carry the three points the page actually draws');
        else if (!Array.isArray(q.fig.ticks) || q.fig.ticks.length !== 3)
          out.push('the figure does not carry the tick plan the page actually draws');
        else {
          /* ⚠️ 驗的是**頁面算出來的**座標（q.fig.pts），不是這裡再畫一次 ——
             再畫一次的話，頁面的排版壞掉這裡完全看不到。 */
          const pts = q.fig.pts;
          const ref = layoutRef(q.fig.sq, q.fig.rot, REV_W_REF, REV_H_REF, REV_PAD_REF);
          for (let i = 0; i < 3; i++){
            if (!num(pts[i] && pts[i][0]) || !num(pts[i] && pts[i][1])){
              out.push('a drawn vertex is not a number'); break;
            }
            if (Math.abs(pts[i][0] - ref[i][0]) > 1e-6 || Math.abs(pts[i][1] - ref[i][1]) > 1e-6)
              out.push('the page drew vertex ' + i + ' at (' + pts[i][0].toFixed(2) + ',' + pts[i][1].toFixed(2) +
                       ') but the reference layout gives (' + ref[i][0].toFixed(2) + ',' + ref[i][1].toFixed(2) + ')');
          }
          const wantTicks = tickPlanRef(q.fig.sq);
          if (q.fig.ticks.join(',') !== wantTicks.join(','))
            out.push('the page ticks edges [' + q.fig.ticks + '] but the reference gives [' + wantTicks + ']');
          let bad = false;
          for (const p of pts){
            if (!num(p[0]) || !num(p[1])){ out.push('a drawn vertex is not a number'); bad = true; break; }
            if (p[0] < REV_PAD_REF - 0.01 || p[0] > REV_W_REF - REV_PAD_REF + 0.01 ||
                p[1] < REV_PAD_REF - 0.01 || p[1] > REV_H_REF - REV_PAD_REF + 0.01){
              out.push('a drawn vertex (' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ') is outside the canvas');
              bad = true; break;
            }
          }
          if (!bad){
            const degs = anglesDegRef(pts);
            if (Math.abs(Math.max(...degs) - degs[2]) > 1e-6)
              out.push('the biggest angle is not at pts[2], so the arc would be drawn on the wrong vertex');
            const needAlt = REV_ARC_REF + REV_TICK_REF;
            const alt = minAltitude(pts);
            if (alt < needAlt)
              out.push('the drawn triangle is only ' + alt.toFixed(1) + 'px thick at its flattest, but the arc (' +
                       REV_ARC_REF + 'px) plus a tick mark (' + REV_TICK_REF + 'px) need ' + needAlt + 'px to fit inside it');
            const nm = ANG_TXT[lang][angleClassRef(q.fig.sq)];
            if (genId === 'figAngle' && q.why.indexOf(nm) < 0)
              out.push('the explanation never names the angle class that is actually drawn');
          }
        }
      } else if (genId === 'figAngle' || genId === 'figSide' || genId === 'bothNames'){
        out.push(genId + ' asks about "the figure" but returns no figure');
      }

      /* 解釋要引用真正的數字，不可以只是提一提。 */
      if (genId === 'byDegrees'){
        const mx = String(Math.max(...d.degs));
        if (q.why.indexOf(mx) < 0) out.push('the explanation never quotes the biggest angle ' + mx);
        for (const v of d.degs) if (q.stem.indexOf(String(v)) < 0) out.push('the stem does not print the angle ' + v);
      }
      if (genId === 'sidesName'){
        for (const v of d.cm) if (q.stem.indexOf(String(v)) < 0) out.push('the stem does not print the side ' + v);
        const nEq = equalSidesRef(d.cm.map(v => v * v));
        if (q.why.indexOf(String(nEq)) < 0) out.push('the explanation never states how many sides are equal (' + nEq + ')');
      }
      if (genId === 'countAcute'){
        if (q.why.indexOf(String(acuteCountRef(d.sq))) < 0)
          out.push('the explanation never states the count ' + acuteCountRef(d.sq));
      }

      /* 英文冠詞：句首大寫不可以把 "an acute" 變成 "A acute"。 */
      if (lang === 'en' && /\bA (?=[aeiou])/.test(q.why + ' ' + q.stem + ' ' + q.opts.join(' ')))
        out.push('English text has "A" before a vowel — the article was mangled by capitalisation');
      /* 英文的 1：只有這個數字會出錯（1 degrees / 1 sides / 1 angles）。 */
      if (lang === 'en' && /\b1 (degree|angle|side|triangle)s\b/.test(q.why + ' ' + q.stem + ' ' + q.opts.join(' ')))
        out.push('English text says "1 <plural>"');
      /* 中文不可以出現「銳角三角形三角形」這種名字疊名字。 */
      if (lang === 'zh' && /三角形三角形/.test(q.why + q.stem + q.opts.join('')))
        out.push('a name was concatenated onto itself');

      /* ⚠️ 一定要回字串或 null：空陣列 [] 在 JS 裡是 truthy，
         simgen 的 `if (r) fail(...)` 會把「沒問題」當成「有問題」。 */
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{TRI, BIG_CASES, RAY_CASES, RAY_BASE, SIDE_CASES, NAME_CASES, GRID, ROUNDS, ' +
                'ANGLE_KEYS, SIDE_KEYS, sortSq, triValid, sideClass, angleClass, sideAlso, acuteCount, ' +
                'triLayout, tickPlan, rayApex, rayDirs, rayClass, roundAnswer, ' +
                'FIG_W, FIG_H, FIG_PAD, FIG_ARC_R, FIG_MARK, FIG_TICK, FIG_LABEL_R, T_TICK}',

    check: function(data, I18N, fail, src){
      const { TRI, BIG_CASES, RAY_CASES, RAY_BASE, SIDE_CASES, NAME_CASES, GRID, ROUNDS } = data;

      /* ---------- 0. 兩套「依角分類」必須逐一同意 ---------- */
      let sweep = 0, mism = 0;
      for (let p = 1; p <= 40 && mism < 4; p++){
        for (let q = p; q <= 40 && mism < 4; q++){
          for (let r = q; r <= 40 && mism < 4; r++){
            const t = [p, q, r];
            if (!triValidRef(t)) continue;
            sweep++;
            if (angleClassRef(t) !== angleClassByGeometry(t)){
              fail('ANGLE_SWEEP: the integer rule and the measured geometry disagree on [' + t + ']: ' +
                   angleClassRef(t) + ' vs ' + angleClassByGeometry(t));
              mism++;
            }
            if (data.angleClass(t) !== angleClassRef(t)){
              fail('angleClass([' + t + ']) = ' + data.angleClass(t) + ' but the reference gives ' + angleClassRef(t) +
                   ' — the page disagrees with the reference implementation');
              mism++;
            }
            if (data.sideClass(t) !== sideClassRef(t)){
              fail('sideClass([' + t + ']) = ' + data.sideClass(t) + ' but the reference gives ' + sideClassRef(t) +
                   ' — the page disagrees with the reference implementation');
              mism++;
            }
          }
        }
      }
      if (sweep < 3000) fail('the classification sweep only covered ' + sweep + ' triples — it is not actually running');

      /* 範例 1 的旁白要「看情況給理由」：最大的角是銳角時，理由是「其他兩個更小」；
         是直角或鈍角時，那個理由不成立（比鈍角小的角可以是 95 度），
         必須改用「直角和鈍角最多只有一個」。純文字沒有別的檢查盯得到，
         所以在原始碼層釘住它真的有分支、而且分支條件是算出來的分類。 */
      if (!/s1narr\(d\.angWord\[cls\], d\.angName\[cls\], !!c\.turned, cls\)/.test(src))
        fail('renderS1 no longer passes the computed angle class into the narration, so the reason cannot depend on it');
      for (const L of ['zh', 'en']){
        const fn = I18N[L].s1narr;
        if (typeof fn !== 'function'){ fail('I18N.' + L + '.s1narr is not a function'); continue; }
        /* ⚠️ 把它**跑起來**，不要掃原始碼字串：掃字串的話把兩段解釋對調也照樣過關。 */
        const say = {};
        for (const k of data.ANGLE_KEYS) say[k] = String(fn(I18N[L].angWord[k], I18N[L].angName[k], false, k));
        if (say.acute === say.obtuse || say.acute === say.right)
          fail('I18N.' + L + '.s1narr gives the acute case the same reason as the right/obtuse case — ' +
               '"the other two are smaller" does not prove they are acute when the biggest angle is obtuse');
        for (const k of ['right', 'obtuse']){
          if (!/最多只有一個|at most one/.test(say[k]))
            fail('I18N.' + L + '.s1narr (' + k + ') does not use the "at most one right or obtuse angle" reason, which is the only one that holds there');
        }
        /* 「比它小」對正三角形（三個角一樣大）是假的 —— 任何一支都不可以用它當理由。 */
        for (const k of data.ANGLE_KEYS){
          if (/比它(還)?小|smaller than it|smaller still/.test(say[k]))
            fail('I18N.' + L + '.s1narr (' + k + ') says the other angles are strictly smaller, which is false for an equilateral triangle (60/60/60) and for 70/70/40');
        }
      }
      /* 「最大的角」有平手的情形，四頁都不可以講成「兩三個角一樣大就是最大的」——
         30/30/120 裡一樣大的那兩個角是最小的。 */
      const TIE_BAD = ['它們就一起是最大的', 'they are jointly the biggest', '一樣大時，它們一起是最大的'];

      /* 依邊的家族關係：正三角形也是等腰三角形，反過來不成立。
         這是課程頁明講的一條規則，之前沒有任何一條斷言直接在盯它。 */
      if (data.sideAlso('equi').indexOf('iso') < 0)
        fail('sideAlso(equi) = [' + data.sideAlso('equi') + '] — the page no longer says an equilateral triangle is also isosceles');
      if (data.sideAlso('iso').length)
        fail('sideAlso(iso) = [' + data.sideAlso('iso') + '] — isosceles must have no looser name, or the family runs the wrong way');
      if (data.sideAlso('scalene').length)
        fail('sideAlso(scalene) = [' + data.sideAlso('scalene') + '] — a scalene triangle has no looser name');
      /* 每一個三角形至少有兩個銳角 —— 這一課的核心事實，逐一驗過。 */
      for (const k of Object.keys(TRI)){
        const c = data.acuteCount(TRI[k].sq);
        if (c !== acuteCountRef(TRI[k].sq))
          fail('acuteCount(' + k + ') = ' + c + ' but the reference gives ' + acuteCountRef(TRI[k].sq));
        if (c < 2) fail('acuteCount(' + k + ') = ' + c + ' — every triangle has at least two acute angles');
      }

      /* 退化三角形一定要被擋下來。 */
      if (data.triValid([1, 1, 4])) fail('triValid accepts [1,1,4] (sides 1,1,2), which is a flat line, not a triangle');
      if (data.triValid([4, 9, 25])) fail('triValid accepts [4,9,25] (sides 2,3,5) — that is a flat line');
      if (!data.triValid([9, 16, 25])) fail('triValid rejects the 3-4-5 triangle');
      for (const bad of [[0, 1, 1], [-1, 4, 4], [1, 2], [1, 2, 3, 4]]){
        if (data.triValid(bad)) fail('triValid accepts the malformed input [' + bad + ']');
      }

      /* ---------- 1. 目錄裡每一個三角形都必須是它名字說的那一種 ---------- */
      const KEY_OF = {
        acuteScalene:['acute', 'scalene'], acuteIso:['acute', 'iso'], acuteEqui:['acute', 'equi'],
        rightScalene:['right', 'scalene'], rightIso:['right', 'iso'],
        obtuseScalene:['obtuse', 'scalene'], obtuseIso:['obtuse', 'iso']
      };
      for (const k of Object.keys(KEY_OF)){
        if (!TRI[k]){ fail('TRI.' + k + ' is missing — the catalogue no longer covers every drawable combination'); continue; }
        const sq = TRI[k].sq;
        if (!triValidRef(sq)){ fail('TRI.' + k + ': [' + sq + '] is not a valid triangle'); continue; }
        for (const v of sq) if (!int(v)) fail('TRI.' + k + ': squared side ' + v + ' is not a whole number');
        if (angleClassRef(sq) !== KEY_OF[k][0]) fail('TRI.' + k + ' is ' + angleClassRef(sq) + ' by angles, not ' + KEY_OF[k][0]);
        if (sideClassRef(sq) !== KEY_OF[k][1]) fail('TRI.' + k + ' is ' + sideClassRef(sq) + ' by sides, not ' + KEY_OF[k][1]);
        if (angleClassByGeometry(sq) !== KEY_OF[k][0])
          fail('TRI.' + k + ': the drawn geometry measures ' + angleClassByGeometry(sq) + ' by angles, not ' + KEY_OF[k][0]);
      }
      for (const k of Object.keys(TRI)) if (!KEY_OF[k]) fail('TRI has an extra entry "' + k + '" this config does not describe');

      /* 1a. cm 是**和畫出來的邊順序對齊**的第二個陣列。順序錯了，
             孩子看到的邊長就會標在別條邊上。 */
      for (const k of Object.keys(TRI)){
        const t = TRI[k];
        if (t.cm === null){
          const allSquare = t.sq.every(v => Number.isInteger(Math.sqrt(v)));
          if (allSquare) fail('TRI.' + k + '.cm is null but every squared side is a perfect square, so the lengths could be shown');
          continue;
        }
        if (!Array.isArray(t.cm) || t.cm.length !== 3){ fail('TRI.' + k + '.cm is not three lengths'); continue; }
        for (const v of t.cm) if (!int(v) || v <= 0) fail('TRI.' + k + '.cm has a non-positive-integer length ' + v);
        const s = sortSqRef(t.sq);
        const wantOrder = [s[2], s[0], s[1]];                 // triLayout 的邊順序
        const gotOrder = t.cm.map(v => v * v);
        if (gotOrder.join(',') !== wantOrder.join(','))
          fail('TRI.' + k + '.cm = [' + t.cm + '] squares to [' + gotOrder + '] but the drawn edge order needs [' +
               wantOrder + '] — the printed side lengths would not line up with the drawn edges');
      }

      /* ---------- 2. 九宮格：null 的兩格必須是**證明出來**的，不是宣告的 ---------- */
      let cells = 0;
      for (const ak of data.ANGLE_KEYS){
        for (const sk of data.SIDE_KEYS){
          const cell = ak + '-' + sk;
          cells++;
          if (!(cell in GRID)){ fail('GRID is missing the cell ' + cell); continue; }
          const key = GRID[cell];
          if (key === null){
            if (cellPossibleRef(ak, sk)) fail('GRID.' + cell + ' is null but the reference says it is possible');
            continue;
          }
          if (!cellPossibleRef(ak, sk)) fail('GRID.' + cell + ' points at ' + key + ' but the reference says it is impossible');
          if (!TRI[key]){ fail('GRID.' + cell + ' points at the missing shape ' + key); continue; }
          if (angleClassRef(TRI[key].sq) !== ak || sideClassRef(TRI[key].sq) !== sk)
            fail('GRID.' + cell + ' holds ' + key + ', which is actually ' +
                 angleClassRef(TRI[key].sq) + '-' + sideClassRef(TRI[key].sq));
        }
      }
      if (cells !== 9) fail('the grid has ' + cells + ' cells, expected 9');
      for (const c of Object.keys(GRID)){
        const p = c.split('-');
        if (data.ANGLE_KEYS.indexOf(p[0]) < 0 || data.SIDE_KEYS.indexOf(p[1]) < 0)
          fail('GRID has an unexpected cell "' + c + '"');
      }
      /* 窮舉：把整數平方三元組掃過一遍，證明「正三角形一定是銳角三角形」——
         也就是 right-equi 和 obtuse-equi 兩格真的空著，而且其餘七格都找得到樣本。 */
      const seen = {};
      let nn = 0;
      for (let p = 1; p <= 60; p++){
        for (let q = p; q <= 60; q++){
          for (let r = q; r <= 60; r++){
            const t = [p, q, r];
            if (!triValidRef(t)) continue;
            nn++;
            seen[angleClassRef(t) + '-' + sideClassRef(t)] = true;
          }
        }
      }
      if (nn < 5000) fail('the exhaustive grid sweep only saw ' + nn + ' triangles — it is not running');
      for (const ak of data.ANGLE_KEYS){
        for (const sk of data.SIDE_KEYS){
          const cell = ak + '-' + sk;
          const found = !!seen[cell];
          if (found && GRID[cell] === null) fail('GRID says ' + cell + ' is impossible, but the sweep found one');
          if (!found && GRID[cell] !== null) fail('GRID offers a shape for ' + cell + ', but the sweep never found such a triangle');
          if (!found && !cellPossibleRef(ak, sk) && sk !== 'equi')
            fail(cell + ' is declared impossible for a reason this lesson never states');
        }
      }
      /* 等腰直角三角形放不進整數座標，可是放得進整數平方 —— 掃描一定要找得到它。 */
      if (!seen['right-iso']) fail('the sweep never found a right isosceles triangle, so that cell is unproven');
      if (seen['right-equi'] || seen['obtuse-equi'])
        fail('the sweep found an equilateral triangle that is not acute, which contradicts the whole lesson');

      /* ---------- 3. 畫圖：七個形狀 × 每 5 度全掃 ---------- */
      let drawn = 0;
      for (const k of Object.keys(TRI)){
        const sq = TRI[k].sq;
        if (!triValidRef(sq)) continue;
        for (let rot = 0; rot < 360; rot += 5){
          const pts = data.triLayout(sq, rot);
          drawn++;
          if (!Array.isArray(pts) || pts.length !== 3){ fail('triLayout(' + k + ',' + rot + ') did not return three points'); break; }
          let bad = false;
          for (const pt of pts){
            if (!Array.isArray(pt) || !num(pt[0]) || !num(pt[1])){ fail('triLayout(' + k + ',' + rot + ') returned a non-numeric vertex'); bad = true; break; }
            /* 留 1px 緩衝，是為了讓下面「置中」那條斷言證得起來 ——
               完全不留的話，任何偏移都會先撞到這一條，置中那條就永遠沒被證明過。 */
            if (pt[0] < data.FIG_PAD - 1.01 || pt[0] > data.FIG_W - data.FIG_PAD + 1.01 ||
                pt[1] < data.FIG_PAD - 1.01 || pt[1] > data.FIG_H - data.FIG_PAD + 1.01){
              fail('triLayout(' + k + ',' + rot + '): vertex (' + pt[0].toFixed(1) + ',' + pt[1].toFixed(1) +
                   ') is outside the canvas keep-clear area');
              bad = true; break;
            }
          }
          if (bad) break;
          /* 最大角一定要在 pts[2]：畫弧和直角方框都靠這個約定。
             ⚠️ 這一條要排在邊長比例之前 —— 排在後面的話，任何把頂點換位置的改法
             都會先撞上邊長那一條，這一條就從來沒有被證明過。 */
          const degs = anglesDegRef(pts);
          if (Math.abs(Math.max(...degs) - degs[2]) > 1e-6){
            fail('triLayout(' + k + ',' + rot + '): the biggest angle is not at pts[2] (' +
                 degs.map(x => x.toFixed(1)).join('/') + ')');
            break;
          }
          /* 量回來的三條邊，比例必須和 sq 一致（縮放允許，形狀不可以變）。 */
          const got = drawnEdgeSq(pts);
          const want = sortSqRef(sq);
          const wantOrder = [want[2], want[0], want[1]];
          const f = got[0] / wantOrder[0];
          for (let i = 0; i < 3; i++){
            if (Math.abs(got[i] / f - wantOrder[i]) > 1e-6 * wantOrder[i]){
              fail('triLayout(' + k + ',' + rot + '): edge ' + i + ' has squared length ratio ' +
                   (got[i] / f).toFixed(4) + ', expected ' + wantOrder[i] + ' — the drawn side lengths are wrong');
              bad = true; break;
            }
          }
          if (bad) break;
          /* 量回來的最大角，分類必須和資料一致 —— 圖和名字不可以講兩件事。 */
          const mx = Math.max(...degs);
          const drawnClass = Math.abs(mx - 90) < 1e-6 ? 'right' : (mx < 90 ? 'acute' : 'obtuse');
          if (drawnClass !== angleClassRef(sq)){
            fail('triLayout(' + k + ',' + rot + '): the drawn biggest angle is ' + mx.toFixed(2) +
                 ' degrees (' + drawnClass + ') but the data says ' + angleClassRef(sq));
            break;
          }
          /* 太細的三角形看不出形狀。 */
          const shortest = Math.sqrt(Math.min(...got));
          if (shortest < FIG_MIN_SIDE_REF){
            fail('triLayout(' + k + ',' + rot + '): the shortest drawn side is only ' + shortest.toFixed(1) +
                 'px, under the ' + FIG_MIN_SIDE_REF + 'px minimum');
            break;
          }
          /* 扁到弧和短撇塞不進去的三角形，孩子看不出它是什麼。 */
          const needAlt = data.FIG_ARC_R + data.FIG_TICK;
          const alt = minAltitude(pts);
          if (alt < needAlt){
            fail('triLayout(' + k + ',' + rot + '): the triangle is only ' + alt.toFixed(1) +
                 'px thick at its flattest, but the arc (' + data.FIG_ARC_R + 'px) plus a tick mark (' +
                 data.FIG_TICK + 'px) need ' + needAlt + 'px to fit inside it');
            break;
          }
          /* 置中：左右留白與上下留白各自要對稱。 */
          const xs = pts.map(v => v[0]), ys = pts.map(v => v[1]);
          if (Math.abs(Math.min(...xs) - (data.FIG_W - Math.max(...xs))) > 0.01 ||
              Math.abs(Math.min(...ys) - (data.FIG_H - Math.max(...ys))) > 0.01){
            fail('triLayout(' + k + ',' + rot + '): the figure is not centred in the canvas');
            break;
          }
          /* 和獨立重寫的排版比對。 */
          const ref = layoutRef(sq, rot, FIG_W_REF, FIG_H_REF, FIG_PAD_REF);
          for (let i = 0; i < 3; i++){
            if (Math.abs(pts[i][0] - ref[i][0]) > 1e-6 || Math.abs(pts[i][1] - ref[i][1]) > 1e-6){
              fail('triLayout(' + k + ',' + rot + ') disagrees with the reference layout at vertex ' + i);
              bad = true; break;
            }
          }
          if (bad) break;
        }
      }
      if (drawn < 7 * 72) fail('the layout sweep only ran ' + drawn + ' times, expected ' + (7 * 72));

      /* 3a. 版面常數要對得上獨立寫死的規格，也要對得上 viewBox 與 CSS。 */
      if (data.FIG_W !== FIG_W_REF || data.FIG_H !== FIG_H_REF)
        fail('FIG_W/FIG_H are ' + data.FIG_W + 'x' + data.FIG_H + ', expected ' + FIG_W_REF + 'x' + FIG_H_REF);
      if (data.FIG_PAD !== FIG_PAD_REF) fail('FIG_PAD is ' + data.FIG_PAD + ', expected ' + FIG_PAD_REF);
      if (!(data.FIG_ARC_R > 0) || !(data.FIG_MARK > 0) || !(data.FIG_TICK > 0) || !(data.FIG_LABEL_R > 0))
        fail('a figure mark constant is not positive');
      if (!(data.FIG_LABEL_R > data.FIG_ARC_R))
        fail('the angle label sits inside the arc it labels (FIG_LABEL_R ' + data.FIG_LABEL_R + ' <= FIG_ARC_R ' + data.FIG_ARC_R + ')');
      if (!(data.T_TICK > 0 && data.T_TICK < 1)) fail('T_TICK must be a fraction strictly inside the edge');
      /* ⚠️ 只驗第一張圖等於沒驗其他五張：座標全部照 520x220 算，
         某一張的 viewBox 改掉就會被拉扁或裁切，而檢查是綠的。 */
      const vbs = src.match(/<svg class="shapefig"[^>]*viewBox="0 0 (\d+) (\d+)"/g) || [];
      if (vbs.length !== 6)
        fail('expected 6 .shapefig canvases on the lesson page (five examples + the game), found ' + vbs.length);
      vbs.forEach(tag => {
        const m = /viewBox="0 0 (\d+) (\d+)"/.exec(tag);
        const id = (/id="([a-zA-Z0-9]+)"/.exec(tag) || [])[1] || '?';
        if (Number(m[1]) !== FIG_W_REF || Number(m[2]) !== FIG_H_REF)
          fail('figure ' + id + ' has viewBox ' + m[1] + 'x' + m[2] + ' but the layout uses ' + FIG_W_REF + 'x' + FIG_H_REF);
      });
      const cssHs = src.match(/\.shapefig\{[^}]*height:(\d+)px/g) || [];
      if (cssHs.length !== 1)
        fail('.shapefig declares its height ' + cssHs.length + ' times — a later rule could override the one this config reads');
      else if (Number(/height:(\d+)px/.exec(cssHs[0])[1]) !== FIG_H_REF)
        fail('the CSS height of .shapefig is ' + /height:(\d+)px/.exec(cssHs[0])[1] + 'px but the layout uses ' + FIG_H_REF);

      /* ---------- 4. 短撇 ---------- */
      for (const k of Object.keys(TRI)){
        const sq = TRI[k].sq;
        const got = data.tickPlan(sq), want = tickPlanRef(sq);
        if (got.join(',') !== want.join(','))
          fail('tickPlan(' + k + ') = [' + got + '] but the reference gives [' + want + ']');
        const cls = sideClassRef(sq);
        const marked = got.filter(g => g > 0).length;
        if (cls === 'scalene' && marked)
          fail('tickPlan(' + k + ') ticks ' + marked + ' sides of a scalene triangle — the figure would claim sides are equal that are not');
        if (cls === 'iso' && marked !== 2) fail('tickPlan(' + k + ') ticks ' + marked + ' sides of an isosceles triangle, expected exactly 2');
        if (cls === 'equi' && marked !== 3) fail('tickPlan(' + k + ') ticks ' + marked + ' sides of an equilateral triangle, expected 3');
        /* 標了短撇的邊，長度必須真的相等。 */
        const s = sortSqRef(sq), edgeSq = [s[2], s[0], s[1]];
        const groups = {};
        got.forEach((g, i) => { if (g){ (groups[g] = groups[g] || []).push(edgeSq[i]); } });
        for (const g of Object.keys(groups)){
          const lens = groups[g];
          if (lens.length < 2) fail('tickPlan(' + k + '): tick group ' + g + ' marks only one edge');
          if (new Set(lens).size !== 1) fail('tickPlan(' + k + '): tick group ' + g + ' marks edges of different lengths [' + lens + ']');
        }
      }

      /* ---------- 5. 範例 2：兩條邊碰不碰得到 ---------- */
      let anyClose = 0, anyOpen = 0, anyPara = 0;
      RAY_CASES.forEach((c, i) => {
        if (!int(c.a) || !int(c.b) || c.a <= 0 || c.b <= 0 || c.a >= 180 || c.b >= 180)
          return fail('RAY_CASES[' + i + ']: (' + c.a + ',' + c.b + ') are not usable base angles');
        const apex = data.rayApex(c);
        const shouldClose = (c.a + c.b < 180);
        if (shouldClose !== !!apex)
          return fail('RAY_CASES[' + i + '] (' + c.a + ',' + c.b + '): rayApex says ' +
                      (apex ? 'they meet' : 'they never meet') + ' but a+b=' + (c.a + c.b) +
                      (shouldClose ? ' is under 180, so they must meet' : ' is 180 or more, so they cannot meet'));
        if (apex){
          anyClose++;
          if (!num(apex[0]) || !num(apex[1])) return fail('RAY_CASES[' + i + ']: the apex is not a pair of numbers');
          if (apex[1] < FIG_PAD_REF || apex[1] > RAY_BASE.y)
            fail('RAY_CASES[' + i + ']: the apex y=' + apex[1].toFixed(1) + ' is off the canvas (it must sit between ' +
                 FIG_PAD_REF + ' and the base at ' + RAY_BASE.y + ')');
          if (apex[0] < FIG_PAD_REF || apex[0] > FIG_W_REF - FIG_PAD_REF)
            fail('RAY_CASES[' + i + ']: the apex x=' + apex[0].toFixed(1) + ' is off the canvas');
          const third = 180 - c.a - c.b;
          const mx = Math.max(c.a, c.b, third);
          const want = mx > 90 ? 'obtuse' : (mx === 90 ? 'right' : 'acute');
          if (data.rayClass(c) !== want)
            fail('RAY_CASES[' + i + ']: rayClass says ' + data.rayClass(c) + ' but the three angles ' +
                 [c.a, c.b, third] + ' give ' + want);
          if (c.why !== 'ok') fail('RAY_CASES[' + i + '] closes into a triangle but is labelled "' + c.why + '"');
        } else {
          anyOpen++;
          if (c.why === 'ok') fail('RAY_CASES[' + i + '] does not close but is labelled "ok"');
          if (c.why === 'para'){
            anyPara++;
            /* 「兩條邊都垂直於底邊，所以互相平行」只有在兩個都是直角時才成立。 */
            if (c.a !== 90 || c.b !== 90)
              fail('RAY_CASES[' + i + '] claims the two sides are parallel because both are perpendicular, ' +
                   'but the angles are ' + c.a + ' and ' + c.b + ' — the narration would be false');
          }
          if (c.why === 'wider' && !(c.a + c.b > 180))
            fail('RAY_CASES[' + i + '] claims to open wider than two right angles, but a+b=' + (c.a + c.b));
        }
        /* 兩條邊的方向要真的和底邊夾 a、b 度。 */
        const dirs = data.rayDirs(c);
        const da = Math.atan2(-dirs[0][1], dirs[0][0]) * 180 / Math.PI;
        const db = Math.atan2(-dirs[1][1], -dirs[1][0]) * 180 / Math.PI;
        if (Math.abs(da - c.a) > 1e-6) fail('RAY_CASES[' + i + ']: the left side leaves at ' + da.toFixed(2) + ' degrees, not ' + c.a);
        if (Math.abs(db - c.b) > 1e-6) fail('RAY_CASES[' + i + ']: the right side leaves at ' + db.toFixed(2) + ' degrees, not ' + c.b);
      });
      /* 課文說「點下面 N 種畫法」，N 必須真的等於 RAY_CASES 的長度。
         加一筆卻忘了改課文，讀者會數不到那一個（codex 2026-08-29 抓到的就是這個）。 */
      const CN_NUM = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6, '七':7, '八':8, '九':9 };
      /* ⚠️ 中文那一句在頁面上有兩份（markup 的 fallback ＋ 字典），
         用 exec 只會看到第一份 —— 字典改成別的數字就靜靜通過了。要每一份都比。 */
      const saidZh = src.match(/點下面([一二三四五六七八九])種畫法/g) || [];
      if (saidZh.length < 2) fail('the Chinese lead should appear twice (markup fallback + dictionary), found ' + saidZh.length);
      for (const one of saidZh){
        const n1 = CN_NUM[/([一二三四五六七八九])/.exec(one)[1]];
        if (n1 !== RAY_CASES.length)
          fail('the lesson says there are ' + n1 + ' attempts to tap, but RAY_CASES has ' + RAY_CASES.length);
      }
      const EN_NUM = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9 };
      const saidEn = /Tap the (one|two|three|four|five|six|seven|eight|nine) attempts/.exec(src);
      if (!saidEn) fail('the English lead no longer tells the reader how many attempts there are');
      else if (EN_NUM[saidEn[1]] !== RAY_CASES.length)
        fail('the English lead says ' + EN_NUM[saidEn[1]] + ' attempts, but RAY_CASES has ' + RAY_CASES.length);

      if (!anyClose) fail('no RAY_CASES entry closes into a triangle, so the positive case is never shown');
      if (!anyOpen) fail('no RAY_CASES entry fails to close, so "two right angles do not work" is never shown');
      if (!anyPara) fail('RAY_CASES has no two-right-angles case, so the parallel argument is never demonstrated');
      /* 兩個底角的度數標在底邊下方，所以底邊不可以貼著畫布下緣。 */
      if (!(RAY_BASE.y + 22 <= FIG_H_REF - 4))
        fail('the base line sits at y=' + RAY_BASE.y + ', so the angle labels 22px below it would be cut off');
      if (RAY_BASE.x0 < FIG_PAD_REF || RAY_BASE.x1 > FIG_W_REF - FIG_PAD_REF)
        fail('the base line runs outside the canvas keep-clear area');
      const closedKinds = new Set(RAY_CASES.filter(c => data.rayApex(c)).map(c => data.rayClass(c)));
      if (closedKinds.size < 2) fail('every closing RAY_CASES entry makes the same kind of triangle');

      /* ---------- 6. 範例 1／3／5 的樣本 ---------- */
      BIG_CASES.forEach((c, i) => {
        if (!TRI[c.key]) return fail('BIG_CASES[' + i + '] points at the missing shape ' + c.key);
        if (!int(c.rot) || c.rot < 0 || c.rot >= 360) fail('BIG_CASES[' + i + '].rot = ' + c.rot + ' is not a usable angle');
        if (!!c.turned !== (c.rot !== 0))
          fail('BIG_CASES[' + i + '] is marked turned=' + !!c.turned + ' but rot=' + c.rot +
               ' — the narration would say the wrong thing');
      });
      const bigClasses = new Set(BIG_CASES.map(c => angleClassRef(TRI[c.key].sq)));
      for (const ak of data.ANGLE_KEYS) if (!bigClasses.has(ak)) fail('BIG_CASES never shows an ' + ak + ' triangle');
      if (!BIG_CASES.some(c => c.turned)) fail('BIG_CASES has no turned case — the "a right triangle must sit flat" misconception is never challenged');
      const sideClasses = new Set(SIDE_CASES.map(k => sideClassRef(TRI[k].sq)));
      for (const sk of data.SIDE_KEYS) if (!sideClasses.has(sk)) fail('SIDE_CASES never shows a ' + sk + ' triangle');
      if (new Set(SIDE_CASES).size !== SIDE_CASES.length) fail('SIDE_CASES repeats a shape');
      if (new Set(NAME_CASES).size !== NAME_CASES.length) fail('NAME_CASES repeats a shape');
      for (const k of SIDE_CASES.concat(NAME_CASES)) if (!TRI[k]) fail('a case list points at the missing shape ' + k);
      const alsoCounts = NAME_CASES.map(k => sideAlsoRef(sideClassRef(TRI[k].sq)).length);
      if (!alsoCounts.some(x => x > 0)) fail('NAME_CASES has no shape with a looser side name, so the "also counts as" column is always empty');
      if (!alsoCounts.some(x => x === 0)) fail('NAME_CASES has no shape without a looser side name, so the "nothing looser" case is never shown');
      if (!NAME_CASES.some(k => angleClassRef(TRI[k].sq) === 'right' && sideClassRef(TRI[k].sq) === 'iso'))
        fail('NAME_CASES never shows an isosceles right triangle, which is the whole point of combining the two names');

      /* ---------- 7. 遊戲關卡 ---------- */
      /* ⚠️ 正解由**這份設定自己算**。呼叫 data.roundAnswer() 等於拿頁面的函式當自己的神諭：
         把 ans 和 roundAnswer 一起改掉，兩邊還是會同意（codex 2026-08-29 抓到的）。 */
      function roundAnswerRef(r){
        if (r.kind === 'angle')  return angleClassRef(TRI[r.tri].sq);
        if (r.kind === 'side')   return sideClassRef(TRI[r.tri].sq);
        if (r.kind === 'acutes') return String(acuteCountRef(TRI[r.tri].sq));
        if (r.kind === 'cannot') return r.opts.filter(c => !cellPossibleRef(c.split('-')[0], c.split('-')[1]))[0];
        if (r.kind === 'also')   return sideAlsoRef(r.side).length ? sideAlsoRef(r.side)[0] : 'none';
        return undefined;
      }
      ROUNDS.forEach((r, i) => {
        const want = roundAnswerRef(r);
        if (want === undefined) return fail('round ' + (i + 1) + ': this config does not know how to score kind "' + r.kind + '"');
        if (data.roundAnswer(r) !== want)
          fail('round ' + (i + 1) + ': the page roundAnswer() says ' + data.roundAnswer(r) +
               ' but the reference gives ' + want);
        if (r.opts[r.ans] !== want) fail('round ' + (i + 1) + ': ans points at ' + r.opts[r.ans] + ', computed answer is ' + want);
        if (new Set(r.opts).size !== r.opts.length) fail('round ' + (i + 1) + ': duplicate option keys');
        if (r.opts.length < 4) fail('round ' + (i + 1) + ': fewer than four options');
        if (r.tri && !TRI[r.tri]) fail('round ' + (i + 1) + ' points at the missing shape ' + r.tri);
        if (r.tri && (!int(r.rot) || r.rot < 0 || r.rot >= 360)) fail('round ' + (i + 1) + ': rot = ' + r.rot + ' is not a usable angle');
        /* §六之二：沒有一個誘答可以由正確推理到達。 */
        if (r.kind === 'side' || r.kind === 'also'){
          const sq = r.tri ? TRI[r.tri].sq : [36, 36, 36];
          const trueAngle = angleClassRef(sq), trueSide = sideClassRef(sq);
          /* 問「最精確的名字」時，上層（正三角形的上層是等腰三角形）是合法誘答 ——
             可是題幹一定要真的問了，兩種語言都要問。沒問的話兩個答案都對。 */
          const asksSpecific = r.kind === 'side' &&
            /最精確/.test(String(I18N.zh.gPrompt && I18N.zh.gPrompt.side)) &&
            /most specific/.test(String(I18N.en.gPrompt && I18N.en.gPrompt.side));
          if (r.kind === 'side' && !asksSpecific && sideAlsoRef(trueSide).length)
            fail('round ' + (i + 1) + ': the shape has a looser side name, so the prompt must ask for the most specific one in BOTH languages');
          for (const k of r.opts){
            if (k === want) continue;
            if (k === trueAngle)
              fail('round ' + (i + 1) + ': "' + k + '" is reachable by correct reasoning — it really is the angle class of this triangle');
            if (k === trueSide)
              fail('round ' + (i + 1) + ': "' + k + '" is reachable by correct reasoning — it really is the side class of this triangle');
            if (!asksSpecific && sideAlsoRef(trueSide).indexOf(k) >= 0)
              fail('round ' + (i + 1) + ': "' + k + '" is a looser but still correct name, and the prompt never asks for the most specific one');
          }
        }
        if (r.kind === 'cannot'){
          const imp = r.opts.filter(c => !cellPossibleRef(c.split('-')[0], c.split('-')[1]));
          if (imp.length !== 1) fail('round ' + (i + 1) + ': exactly one impossible combination is required, found ' + imp.length);
          for (const c of r.opts){
            const p = c.split('-');
            if (data.ANGLE_KEYS.indexOf(p[0]) < 0 || data.SIDE_KEYS.indexOf(p[1]) < 0)
              fail('round ' + (i + 1) + ': "' + c + '" is not a grid cell');
          }
        }
        if (r.kind === 'acutes'){
          const nOpts = r.opts.map(Number);
          if (nOpts.indexOf(2) < 0 || nOpts.indexOf(3) < 0)
            fail('round ' + (i + 1) + ': both 2 and 3 must be offered, or the "count the acute angles" misconception is untested');
        }
      });
      const kinds = new Set(ROUNDS.map(r => r.kind));
      for (const k of ['angle', 'side', 'acutes', 'cannot', 'also']) if (!kinds.has(k)) fail('the game never plays the "' + k + '" round');

      /* ---------- 8. 靜態題庫 ---------- */
      for (const bank of ['qs', 'qsAdv', 'qsBoost']){
        if (!I18N.zh[bank] || !I18N.en[bank]){ fail(bank + ' is missing from one of the dictionaries'); continue; }
        if (I18N.zh[bank].length !== I18N.en[bank].length){ fail(bank + ' length differs between zh and en'); continue; }
        I18N.zh[bank].forEach((q, i) => {
          const e = I18N.en[bank][i];
          if (q.ans !== e.ans) fail(bank + '[' + i + '] answer index differs: zh=' + q.ans + ' en=' + e.ans);
          if (q.opts.length !== e.opts.length) fail(bank + '[' + i + '] option count differs');
          for (const pair of [['zh', q], ['en', e]]){
            const tag = pair[0], x = pair[1];
            if (x.opts.length !== 4) fail(bank + '[' + i + '] ' + tag + ': expected four options');
            if (new Set(x.opts).size !== x.opts.length) fail(bank + '[' + i + '] ' + tag + ': duplicate options');
            if (!(x.ans >= 0 && x.ans < x.opts.length)) fail(bank + '[' + i + '] ' + tag + ': answer index out of range');
            if (!x.why || !x.why.trim()) fail(bank + '[' + i + '] ' + tag + ': no explanation');
          }
          if (/[㐀-鿿]/.test(e.stem + e.opts.join('') + e.why)) fail(bank + '[' + i + '] en contains Chinese');
          if (/\bA (?=[aeiou])/.test(e.stem + ' ' + e.why + ' ' + e.opts.join(' ')))
            fail(bank + '[' + i + '] en has "A" before a vowel — a mangled article');
          if (/\b1 (degree|angle|side|triangle)s\b/.test(e.stem + ' ' + e.why + ' ' + e.opts.join(' ')))
            fail(bank + '[' + i + '] en says "1 <plural>"');
        });
      }
      const answers = ['qs', 'qsAdv', 'qsBoost'].reduce((acc, b) => acc.concat((I18N.zh[b] || []).map(q => q.ans)), []);
      if (new Set(answers).size < 3) fail('the quiz answers only ever land in ' + new Set(answers).size + ' distinct positions');
      /* §六之二 的題庫神諭。逐題比對，而且**每一題都要有一列** ——
         只比對「有的題目」的話，刪掉一題不會有人發現。 */
      const NAME_OF = { zh:{}, en:{} };
      for (const L of ['zh', 'en']){
        for (const k of ANGLE_KEYS_REF) NAME_OF[L][cap(ANG_TXT[L][k])] = { fam:'ang', k:k };
        for (const k of SIDE_KEYS_REF)  NAME_OF[L][cap(SIDE_TXT[L][k])] = { fam:'side', k:k };
      }
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const spec = BANK_TRI[bank];
        const zhBank = I18N.zh[bank] || [];
        if (!spec){ fail('BANK_TRI has no entry for the bank ' + bank); return; }
        if (spec.length !== zhBank.length)
          return fail('BANK_TRI.' + bank + ' describes ' + spec.length + ' questions but the bank has ' +
                      zhBank.length + ' — a question was added or removed without an oracle row');
        zhBank.forEach((q, i) => {
          const t = spec[i];
          if (!t) return fail('BANK_TRI.' + bank + '[' + i + '] is missing');
          if (!t.expect) fail('BANK_TRI.' + bank + '[' + i + '] has no expected answer — flipping ans in both languages would go unnoticed');
          for (const L of ['zh', 'en']){
            const x = I18N[L][bank][i];
            if (t.expect){
              if (!t.expect[L]) return fail('BANK_TRI.' + bank + '[' + i + '].expect has no ' + L + ' string');
              if (x.opts[x.ans] !== t.expect[L])
                fail(bank + '[' + i + '] ' + L + ': the correct option renders as "' + x.opts[x.ans] +
                     '" but the oracle expects "' + t.expect[L] + '"');
            }
            if (t.noNames) continue;
            /* 每一個「是那六個名字之一」的選項，都要問一次：它對這個三角形成不成立？ */
            x.opts.forEach((o, oi) => {
              const nm = NAME_OF[L][o];
              if (!nm) return;
              const known = nm.fam === 'ang' ? t.ang : t.side;
              if (known === null || known === undefined) return;   // 題幹推不出來 → 不算走得到
              const isTrue = nm.fam === 'ang'
                ? (known === nm.k)
                : (known === nm.k || sideAlsoRef(known).indexOf(nm.k) >= 0);
              if (oi === x.ans && !isTrue)
                fail(bank + '[' + i + '] ' + L + ': the marked answer "' + o + '" is not actually true of the triangle the stem describes');
              if (oi !== x.ans && isTrue){
                const strictAncestor = nm.fam === 'side' && known !== nm.k && sideAlsoRef(known).indexOf(nm.k) >= 0;
                if (!(strictAncestor && t.mostSpecific))
                  fail(bank + '[' + i + '] ' + L + ': the distractor "' + o +
                       '" is reachable by correct reasoning — it is genuinely true of the triangle the stem describes');
              }
            });
          }
          /* 允許上層當誘答的那幾題，題幹一定要真的問「最精確」，兩種語言都要問。 */
          if (t.mostSpecific){
            if (!/最精確|更精確/.test(q.stem))
              fail(bank + '[' + i + '] zh: a looser name may be offered only when the stem asks for the most specific one');
            if (!/most specific|more specific/.test(I18N.en[bank][i].stem))
              fail(bank + '[' + i + '] en: a looser name may be offered only when the stem asks for the most specific one');
          }
        });
      });
      for (const b of Object.keys(BANK_TRI)) if (!I18N.zh[b]) fail('BANK_TRI describes a bank "' + b + '" the lesson does not have');

      /* ---------- 9. zh/en 頂層鍵一一對應，字典的名字要和真值表逐字相同 ---------- */
      const zk = Object.keys(I18N.zh).sort().join(','), ek = Object.keys(I18N.en).sort().join(',');
      if (zk !== ek) fail('zh and en have different key sets');
      for (const L of ['zh', 'en']){
        for (const d0 of ['angName', 'sideName', 'angWord']){
          if (!I18N[L][d0]) { fail('I18N.' + L + '.' + d0 + ' is missing'); continue; }
          const want = d0 === 'sideName' ? data.SIDE_KEYS : data.ANGLE_KEYS;
          for (const k of want) if (!I18N[L][d0][k]) fail('I18N.' + L + '.' + d0 + ' has no entry for ' + k);
        }
        if (!I18N[L].angName || !I18N[L].sideName) continue;
        for (const k of data.ANGLE_KEYS)
          if (I18N[L].angName[k] !== ANG_TXT[L][k])
            fail('I18N.' + L + '.angName.' + k + ' is "' + I18N[L].angName[k] + '", this config expects "' + ANG_TXT[L][k] + '"');
        for (const k of data.SIDE_KEYS)
          if (I18N[L].sideName[k] !== SIDE_TXT[L][k])
            fail('I18N.' + L + '.sideName.' + k + ' is "' + I18N[L].sideName[k] + '", this config expects "' + SIDE_TXT[L][k] + '"');
      }

      /* ---------- 10. 四頁的措辭 ----------
         ⚠️ 路徑要從 process.argv[2] 推：用 __dirname 會讀到**真的 repo**，
         改壞測試複製出去的那一份永遠不會被看到，斷言就變成永遠是綠的。 */
      const dir = path.dirname(process.argv[2]);
      const SRC = {}, TEXT = {};
      for (const f of ['index', 'reference', 'parents', 'review']){
        const fp = path.join(dir, f + '.html');
        if (!fs.existsSync(fp)){ fail(f + '.html is missing, so its wording was never checked'); continue; }
        const raw = fs.readFileSync(fp, 'utf8');
        SRC[f] = stripComments(raw);
        TEXT[f] = readerText(raw);
      }
      SIBLING_RULES.forEach(rule => {
        const text = TEXT[rule.file];
        if (text === undefined) return;
        const c = countOf(text, rule.text);
        if (c < rule.min)
          fail(rule.file + '.html says "' + rule.text + '" ' + c + ' time(s), expected at least ' +
               rule.min + ' — it ' + rule.why);
      });
      /* 反面：鬆掉的說法一個都不可以出現。沒有這一半，
         「把規則寫得越來越滿」會安靜地開始教錯的東西。 */
      /* ⚠️ unlessNear：五年級的主題**可以**被指名（範圍切分本來就要講「那一課在五年級」），
         不可以的是把它當成這一課的內容教。所以每一次出現都看一下前後文。 */
      const FORBIDDEN = [
        { text:'剛好兩條邊一樣長就是等腰', why:'excludes equilateral triangles from the isosceles family' },
        { text:'有一個銳角就是銳角三角形', why:'is exactly the misconception this lesson exists to kill' },
        { text:'三角形的內角和是 180', why:'is grade-5 material this lesson must not teach' },
        /* 五年級的主題**可以**被指名（範圍切分本來就要講），可是只能出現在
           下面這幾句「這一課不教」的句子裡。⚠️ 原本寫成「70 字內有『五年級』就放行」，
           那太鬆了：「五年級會再說明。三角形的內角和是 180，所以……」照樣過關。 */
        { text:'兩邊和大於第三邊', why:'is grade-5 material this lesson must not teach',
          allowedIn:['以及<strong>兩邊和大於第三邊</strong>（也在五年級）',
                     '以及兩邊和大於第三邊（也在五年級）'] }
      ];
      for (const f of ['index', 'reference', 'review', 'parents']){
        const text = TEXT[f];
        if (text === undefined) continue;
        for (const t of TIE_BAD){
          if (countOf(text, t))
            fail(f + '.html says "' + t + '" — two equal angles are not necessarily the biggest ones (30/30/120)');
        }
        for (const bad of FORBIDDEN){
          /* 允許的整句話先從文字裡拿掉，剩下的每一次出現都是違規。 */
          let rest = text;
          for (const ok of (bad.allowedIn || [])) rest = rest.split(readerText(ok)).join(' ');
          if (countOf(rest, bad.text))
            fail(f + '.html contains "' + bad.text + '" outside the sentence that names it as out of scope, which ' + bad.why);
        }
      }

      /* ---------- 11. 產生器一支都不能少 ---------- */
      const rv = SRC['review'];
      if (rv !== undefined){
        const found = [];
        rv.split('\n').forEach(line => {
          const m = /^\s*\{ id:'([A-Za-z0-9_]+)',/.exec(line);
          if (m) found.push(m[1]);
        });
        GEN_IDS.forEach(id => {
          if (found.indexOf(id) < 0) fail('review.html no longer declares the generator "' + id + '"');
        });
        found.forEach(id => {
          if (GEN_IDS.indexOf(id) < 0) fail('review.html declares an extra generator "' + id + '" that this config does not describe');
        });
        const makes = (rv.match(/\n\s*make:function\(/g) || []).length;
        const fmts = (rv.match(/\n\s*fmt:function\(/g) || []).length;
        if (makes !== GEN_IDS.length) fail('review.html has ' + makes + ' make() functions, expected ' + GEN_IDS.length);
        if (fmts !== GEN_IDS.length) fail('review.html has ' + fmts + ' fmt() functions, expected ' + GEN_IDS.length);
        /* 每一支都要真的在抽樣 —— 寫死一組合法參數的話，所有斷言還是綠的，
           定義域卻整片消失。 */
        /* ⚠️ 全部加起來 ≥ 12 是假的保護：把某一支寫死成一組合法參數，
           別支的呼叫次數就把總數撐過去了。要一支一支看自己的區塊。 */
        const blocks = rv.split(/\n    \{ id:'/).slice(1);
        if (blocks.length !== GEN_IDS.length)
          fail('could not split review.html into ' + GEN_IDS.length + ' generator blocks (got ' + blocks.length + ')');
        blocks.forEach(b => {
          const id = (/^([A-Za-z0-9_]+)'/.exec(b) || [])[1] || '?';
          if (!/pick\(|pickUnused\(|shuffle\(/.test(b))
            fail('generator "' + id + '" never calls pick()/pickUnused()/shuffle() — it is hard-coded, so its whole domain has vanished while every assertion stays green');
        });
        /* ⚠️ 這一條的極限講清楚：它抓得到「整支寫死」，抓不到「兩個抽樣裡少了一個」
           （區塊裡還有另一個 pick() 就過了）。要抓後者得統計整批模擬的實際取值分布，
           而 simgen 沒有「跑完一批之後」的掛勾點。 */
        if (!/var QCOUNT = 12;/.test(rv)) fail('review.html no longer asks for 12 questions a round');
        /* 複習頁的畫布與記號尺寸是這份設定寫死的，要真的對得上 ——
           不然「弧塞不塞得下」那條門檻是照別的數字算出來的。 */
        const rc = /var FW = (\d+), FH = (\d+), FPAD = (\d+), MK = \d+, TK = (\d+), ARC = (\d+)/.exec(rv);
        if (!rc) fail('could not read review.html figure constants (FW/FH/FPAD/TK/ARC)');
        else {
          const got = [Number(rc[1]), Number(rc[2]), Number(rc[3]), Number(rc[4]), Number(rc[5])];
          const want = [REV_W_REF, REV_H_REF, REV_PAD_REF, REV_TICK_REF, REV_ARC_REF];
          if (got.join(',') !== want.join(','))
            fail('review.html figure constants are [' + got + '] but this config assumes [' + want + ']');
        }
      }
    }
  },

  /* ================= 跨頁用詞釘樁 =================
     實際的比對在 data.check 裡（SIBLING_RULES 只是資料，
     沒有人跑它就等於沒釘 —— 那是 2026-08-28 的教訓）。 */
  SIBLING_RULES: SIBLING_RULES,
  GEN_IDS: GEN_IDS,
  ASK: ASK
};
