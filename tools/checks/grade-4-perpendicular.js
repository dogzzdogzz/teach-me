/* grade-4/math/perpendicular —— 垂直平行製圖廠（畫垂線、畫平行線、點到直線的距離、平行線之間的距離）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作，而且每一套都刻意
 * 走和課程頁不一樣的路：
 *
 * 1) 垂不垂直、平不平行。課程頁走**整數向量代數**（方向都是整數，內積剛好 0）；
 *    這裡走**量畫出來的圖**：從渲染出來的畫布座標用 atan2 把每一條線的方向量回來，
 *    再要求兩條線的夾角剛好 90 度（或 0 度）。頁面把圖畫歪了、把記號畫錯邊，代數還是綠的，
 *    量出來的角就不是。
 * 2) 長度。課程頁在格座標上算 √(dx² ＋ dy²)；這裡量**畫布上的像素長度**再除以一格幾像素，
 *    而且要求每一個報出來的長度都是**整數公分**（這一課所有需要報長度的圖都用畢氏三數擺位）。
 * 3) 「垂直的那一條最短」。課程頁只畫三條線段；這裡**窮舉**直線上每一個格點當垂足，
 *    證明垂足那一點真的是唯一的最小值 —— 這是性質的證明，不是三筆資料的比對。
 * 4) 「平行線之間處處等寬」。課程頁只量兩處；這裡對兩條線之間**每一個格點位置**都量一次，
 *    要求全部相等，而且斜著量的一定嚴格比較長。
 *
 * ⚠️ 這一課教的規則有前提，設定檔必須分開驗：
 *    - 「垂直的那一條最短」的前提是**點在直線外面**（點在線上時距離是 0，沒有斜的可比）。
 *    - 「兩條都和同一條直線垂直就互相平行」的前提是**兩條不一樣的直線**。
 *    - 「畫平行線」的前提是**點在直線外面**（點在線上畫出來的是同一條線）。
 *    - 貼住直線的一定是**直角邊**，不是斜邊 —— 三角板畫成 45／45／90，兩條直角邊等長。
 * ⚠️ 圖上**一個字都沒有**（只有 line／polyline／polygon／circle／g）——
 *    長度與名字全部寫在圖下面的 HTML 裡，所以碰不到「SVG 標籤被畫布裁掉」那一類缺陷。
 *    設定檔擋住任何人把 <text>／<tspan> 加回去，也擋掉繞過 svgEl() 直接 createElementNS 的寫法。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { canvasProblems } = require('./lib/canvas.js');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const FIG_W_REF = 460, FIG_H_REF = 300;
const GW_REF = 20, GH_REF = 13, U_REF = 22, OX_REF = 10, OY_REF = 293;
const TOOL_L_REF = 4.5, TOOL_L3_REF = 4.2;
const RULER_LEN_REF = 6.6, RULER_W_REF = 1.3;
const MARK_S_REF = 0.55;
const DOT_R_REF = 6, DOT_R_S_REF = 5;
const MARGIN_REF = 2;             // 畫布四個邊至少留這麼多
/* 每一頁 createElementNS 的呼叫次數（裝上去時用實測值填）。 */
const NS_CALLS_REF = { index:1, review:2 };
const LEN_MAX_REF = 40, DEG_MAX_REF = 180;

/* 上課頁的五個範例、試題的圖、遊戲的三張圖 —— 全部獨立列一次。 */
const S1_A_REF = [2, 2], S1_D_REF = [2, 1], S1_VSTART_REF = [4, 3];
const S1_CASES_REF = [
  { id:'onLine',  pt:[10, 6], foot:[10, 6] },
  { id:'offLine', pt:[6, 9],  foot:[8, 5] }
];
const S1_STEPS_REF = 4;
const S2_CASES_REF = [
  { id:'near', axis:'h', at:3, pt:[10, 6], offs:[-4, 0, 4] },
  { id:'far',  axis:'h', at:2, pt:[4, 10], offs:[0, 6, 15] },
  { id:'vert', axis:'v', at:6, pt:[14, 7], offs:[-6, 0, 6] }
];
const S3_A_REF = [1, 2], S3_D_REF = [3, 1], S3_VSTART_REF = [7, 4], S3_PT_REF = [6, 7];
const S3_STEPS_REF = 5;
const S4_CASES_REF = [
  { id:'flat',  axis:'h', a:3, b:9,  perpAt:[4, 14], slant:[[4, 3], [12, 9]] },
  { id:'stand', axis:'v', a:3, b:11, perpAt:[2, 10], slant:[[3, 2], [11, 8]] }
];
const S5_A_REF = [2, 2], S5_D_REF = [2, 1];
const S5_CASES_REF = [
  { id:'both',  aAt:[4, 3], aDir:[-1, 2], bAt:[12, 7], bDir:[-1, 2] },
  { id:'onlyA', aAt:[4, 3], aDir:[-1, 2], bAt:[14, 8], bDir:[-1, 3] }
];
const QUIZ_DIST_REF = { axis:'h', at:3, pt:[10, 6], offs:[-4, 0, 4] };
const QUIZ_CROSS_REF = { aAt:[3, 2], aDir:[2, 1], bAt:[11, 6], bDir:[-1, 2] };
/* 驗算器在 data.check 跑完之後應該驗過的算式條數與指紋（裝上去時用實測值填）。 */
const VERIFIED_REF = 4;
const FINGERPRINT_REF = '4f2dee99750019c71a81660280629f8624f3926b';

/* ---------- 1) 參考實作：從**渲染出來的畫布座標**把幾何量回來 ---------- */
/* 畫布座標 → 格座標（第二套換算，方向和頁面的 P() 相反）。 */
function toGrid(q){ return [(q.x - OX_REF) / U_REF, (OY_REF - q.y) / U_REF]; }
function vecOf(ln){ return [ln.b.x - ln.a.x, ln.b.y - ln.a.y]; }
function len2(v){ return Math.hypot(v[0], v[1]); }
/* 兩條線的夾角（度，0~90）—— 用 atan2 量，不是拿內積判 0。 */
function angleBetween(u, v){
  const a = Math.atan2(u[1], u[0]), b = Math.atan2(v[1], v[0]);
  let d = Math.abs(a - b) * 180 / Math.PI;
  d = d % 180;
  return d > 90 ? 180 - d : d;
}
function isPerpDrawn(u, v){ return Math.abs(angleBetween(u, v) - 90) < 1e-6; }
function isParaDrawn(u, v){ return Math.abs(angleBetween(u, v)) < 1e-6; }
/* 畫布上的線段長度換算成公分（一格 1 公分）。 */
function cmOf(ln){ return len2(vecOf(ln)) / U_REF; }
function isWholeCm(x){ return Math.abs(x - Math.round(x)) < 1e-9; }
function samePt(p, q){ return Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6; }
/* ⚠️ 獨立的格座標 → 畫布座標換算。設定檔**不可以**呼叫頁面的 P()，
   那是拿頁面比頁面：兩邊一起錯的時候會一起同意。 */
function refP(g){ return { x:OX_REF + g[0] * U_REF, y:OY_REF - g[1] * U_REF }; }
/* ⚠️ NaN 會讓每一條關聯比較靜靜通過（NaN > x 和 NaN < x 都是 false），
   所以任何要拿去比較的數字都要先過這一關。 */
function num(v){ return typeof v === 'number' && Number.isFinite(v); }
/* 直角記號畫的是 X ＋ s·u → X ＋ s·u ＋ s·v → X ＋ s·v，
   所以被標記的那個頂點是 m[0] ＋ m[2] － m[1]（平行四邊形的第四點）。 */
function markVertex(m){ return { x:m[0].x + m[2].x - m[1].x, y:m[0].y + m[2].y - m[1].y }; }
/* 畫出來的直角記號和「該標的那些點」逐一配對（多重集合）：多一個、少一個、
   或兩個疊在同一點上都要報出來。 */
/* 甲、乙 對 丙 的垂直關係 —— 設定檔自己量角算一次（頁面用整數內積）。
   上課頁的 S5 把丙的方向放在模組常數裡（沒有 cs.cDir），所以方向要能傳進來。 */
function relData2(cs, cDirIn){
  const cDir = cDirIn || cs.cDir;
  if (!cs || !cs.aDir || !cs.bDir || !cDir) return { aPerp:false, bPerp:false, parallel:false, bad:true };
  const ang = (u, v) => angleBetween([u[0], -u[1]], [v[0], -v[1]]);
  return {
    aPerp: Math.abs(ang(cs.aDir, cDir) - 90) < 1e-9,
    bPerp: Math.abs(ang(cs.bDir, cDir) - 90) < 1e-9,
    parallel: Math.abs(ang(cs.aDir, cs.bDir)) < 1e-9
  };
}
/* 一張圖的形狀能不能安全走訪（線、記號、點、工具的每一個座標都是有限數）。 */
function planUsable(plan){
  if (!plan || !Array.isArray(plan.lines) || !Array.isArray(plan.marks) || !Array.isArray(plan.dots) || !Array.isArray(plan.polys)) return false;
  const okPt = q => q && num(q.x) && num(q.y);
  for (let i = 0; i < plan.lines.length; i++){ const l = plan.lines[i]; if (!l || !okPt(l.a) || !okPt(l.b)) return false; }
  for (let i = 0; i < plan.marks.length; i++){ const m = plan.marks[i]; if (!Array.isArray(m) || m.length !== 3) return false; for (let k = 0; k < 3; k++) if (!okPt(m[k])) return false; }
  for (let i = 0; i < plan.dots.length; i++){ const dt = plan.dots[i]; if (!dt || !okPt(dt.p)) return false; }
  for (let i = 0; i < plan.polys.length; i++){ const po = plan.polys[i]; if (!po || !Array.isArray(po.pts) || po.pts.length < 3) return false; for (let k = 0; k < po.pts.length; k++) if (!okPt(po.pts[k])) return false; }
  return true;
}
function markPlaceProblems(marks, want, label){
  const out = [], left = want.slice();
  (marks || []).forEach((m, i) => {
    if (!Array.isArray(m) || m.length !== 3) return;
    const X = markVertex(m);
    const j = left.findIndex(q => samePt(X, q));
    if (j < 0) out.push(label + ': right-angle mark ' + i + ' has its corner at (' + X.x.toFixed(1) + ', ' + X.y.toFixed(1) + '), which is not a corner it is supposed to mark (or that corner is already marked)');
    else left.splice(j, 1);
  });
  left.forEach(q => out.push(label + ': no right-angle mark was drawn at (' + q.x.toFixed(1) + ', ' + q.y.toFixed(1) + '), where the drawing claims a right angle'));
  return out;
}
/* 畫布上一個點到一條**無限延伸**直線的距離（用來量兩條平行線之間真正的寬）。 */
/* 兩條畫出來的平行線之間，沿著其中一條**取樣好幾個位置**量到另一條的垂直距離。
   widthEverywhereRef() 兩個端點都是自己造的，「處處相等」對它恆真 —— 那是恆等式不是檢查；
   真正證明「畫出來的兩條線處處等寬」的是這一支。 */
function renderedGapProblems(la, lb, wantCm, label){
  const out = [], v = vecOf(la);
  if (!num(len2(v)) || len2(v) < 1e-9) return [label + ': the first line has no length'];
  const vals = [];
  for (let k = 0; k <= 4; k++){
    const t = k / 4;
    const q = { x:la.a.x + t * v[0], y:la.a.y + t * v[1] };
    const dpx = pointToLine(q, lb);
    if (!num(dpx)) return [label + ': the gap between the drawn lines is not a number'];
    vals.push(dpx / U_REF);
  }
  if (!vals.every(x => Math.abs(x - vals[0]) < 1e-6))
    out.push(label + ': the drawn lines are not the same distance apart everywhere (' + vals.map(x => x.toFixed(3)).join(', ') + ')');
  if (Math.abs(vals[0] - wantCm) > 1e-6)
    out.push(label + ': the drawn lines are ' + vals[0].toFixed(3) + ' cm apart, expected ' + wantCm);
  return out;
}
/* 兩條畫出來的直線的交點（畫布座標）；平行時回 null。 */
function crossPointRef(la, lb){
  const u = vecOf(la), v = vecOf(lb);
  const den = u[0] * v[1] - u[1] * v[0];
  if (!num(den) || Math.abs(den) < 1e-12) return null;
  const t = ((lb.a.x - la.a.x) * v[1] - (lb.a.y - la.a.y) * v[0]) / den;
  return { x:la.a.x + t * u[0], y:la.a.y + t * u[1] };
}
function pointToLine(p, ln){
  const v = vecOf(ln), L = len2(v);
  if (!num(L) || L < 1e-9) return NaN;
  return Math.abs((ln.b.x - ln.a.x) * (ln.a.y - p.y) - (ln.a.x - p.x) * (ln.b.y - ln.a.y)) / L;
}
/* 一個畫布上的點到一條畫布上的線段的距離（用來驗「這條邊真的通過那個點」）。 */
function pointToSeg(p, ln){
  const vx = ln.b.x - ln.a.x, vy = ln.b.y - ln.a.y;
  const L2 = vx * vx + vy * vy;
  if (L2 < 1e-12) return Math.hypot(p.x - ln.a.x, p.y - ln.a.y);
  let t = ((p.x - ln.a.x) * vx + (p.y - ln.a.y) * vy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (ln.a.x + t * vx), p.y - (ln.a.y + t * vy));
}

/* ---------- 2) 參考實作：距離的性質（窮舉，不是比三筆資料） ---------- */
/* 一條橫的或直的直線上，**每一個格點**當垂足時的距離；證明垂足那一點是唯一的最小。 */
function badAxis(cs){ return !cs || (cs.axis !== 'h' && cs.axis !== 'v'); }
function shortestFootRef(cs){
  if (badAxis(cs)) return { min:NaN, at:null, ties:0 };
  const horiz = (cs.axis === 'h');
  const span = horiz ? GW_REF : GH_REF;
  let best = Infinity, bestT = null, ties = 0;
  for (let t = 0; t <= span; t++){
    const f = horiz ? [t, cs.at] : [cs.at, t];
    const L = Math.hypot(cs.pt[0] - f[0], cs.pt[1] - f[1]);
    if (L < best - 1e-12){ best = L; bestT = t; ties = 1; }
    else if (Math.abs(L - best) < 1e-12) ties++;
  }
  return { min:best, at:bestT, ties:ties };
}
/* 從點垂直落到直線上的那個格點（第二套算法：直接取同一個座標）。 */
function footRef(cs){ return badAxis(cs) ? null : ((cs.axis === 'h') ? [cs.pt[0], cs.at] : [cs.at, cs.pt[1]]); }
function distRef(cs){
  const f = footRef(cs);
  if (!f) return NaN;
  return Math.hypot(cs.pt[0] - f[0], cs.pt[1] - f[1]);
}
/* 兩條平行線之間，**每一個格點位置**垂直量一次，全部要相等。 */
function widthEverywhereRef(cs){
  if (badAxis(cs)) return [];
  const horiz = (cs.axis === 'h');
  const other = horiz ? GW_REF : GH_REF;
  const vals = [];
  for (let t = 0; t <= other; t++){
    const p1 = horiz ? [t, cs.a] : [cs.a, t];
    const p2 = horiz ? [t, cs.b] : [cs.b, t];
    vals.push(Math.hypot(p1[0] - p2[0], p1[1] - p2[1]));
  }
  return vals;
}

/* ---------- 3) 算式逐條驗算（全站共用的那一份） ---------- */
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['公分', '公尺', '度', '組', '條', '格', '段', '塊', '題'],
  unitsEn: ['cm', 'metres?', 'degrees?', 'pairs?', 'lines?', 'squares?', 'segments?']
});

/* ---------- 4) 題庫的第二套答案 ---------- */
const BANK_EXPECTED = {
  qs: [
    { expect:{ zh:'把三角板的一條直角邊貼住那條直線', en:'put one side of the right angle along the given line' },
      ask:{ zh:'第一步</strong>要做什麼', en:'what is the <strong>first step' } },
    { expect:{ zh:'只有 1 條', en:'exactly 1' },
      ask:{ zh:'可以畫出幾條', en:'How many lines can be drawn' } },
    { expect:{ zh:'和 L 垂直的那一條（也是最短的一條）', en:'the one perpendicular to L (which is also the shortest)' },
      ask:{ zh:'指的是哪一條線段的長', en:'Which one does' } },
    { expect:{ zh:'3 公分', en:'3 cm' },
      ask:{ zh:'距離</strong>是幾公分', en:'How many centimetres is the <strong>distance' }, fig:'qDist' },
    { expect:{ zh:'量和兩條線都垂直的那一段', en:'along a segment perpendicular to both lines' },
      ask:{ zh:'要怎麼量才對', en:'How should' } },
    { expect:{ zh:'互相平行', en:'parallel to each other' },
      ask:{ zh:'甲和乙是什麼關係', en:'How are A and B related' } }
  ],
  qsAdv: [
    { expect:{ zh:'長，因為垂直的那一條最短', en:'longer, because the perpendicular one is the shortest' },
      ask:{ zh:'長</strong>還是<strong>短', en:'<strong>longer</strong> or <strong>shorter' } },
    { expect:{ zh:'11 公分', en:'11 cm' },
      ask:{ zh:'乙和丙相距幾公分', en:'How far apart are B and C' } },
    { expect:{ zh:'互相垂直', en:'perpendicular to each other' },
      ask:{ zh:'這兩條直線是什麼關係', en:'How are these two lines' }, fig:'qCross' },
    { expect:{ zh:'因為滑動只是把那一條邊整個搬過去，方向完全沒有變', en:'because sliding only carries that edge across; its direction does not change at all' },
      ask:{ zh:'為什麼', en:'Why is' } }
  ],
  qsBoost: [
    { expect:{ zh:'垂直看的是交叉的地方是不是直角，整組轉過角度還是垂直', en:'being perpendicular is about whether they cross at a right angle; turn the whole pair and they are still perpendicular' },
      ask:{ zh:'他錯在哪裡', en:'What is wrong with that' } },
    { expect:{ zh:'距離要量和兩條線都垂直的那一段；斜著量本來就比較長，斜得不一樣就量到不一樣的數', en:'the distance has to be measured perpendicular to both lines; a slanted measurement is longer, and different slants give different numbers' },
      ask:{ zh:'他錯在哪裡', en:'What is wrong with that' } }
  ]
};
/* 題幹裡一定要出現的數字（從這些數字才算得出答案；位置式神諭擋不住「把 7 改成 8」）。 */
const BANK_NUMS = {
  qsAdv: { 0:[8], 1:[7, 4] }
};

/* ---------- 5) 四頁一起釘的措辭 ----------
   ⚠️ 次數要寫**當下真實的出現次數**，不是「至少 1」（裝上去時用實測值填）。 */
const SIBLING_RULES = [
  { text:'一條直角邊貼住', files:{ index:1, review:1, parents:2 } },
  { text:'垂直的那一條最短', files:{ index:12, reference:4 } },
  { text:'點到直線的距離', files:{ index:7, reference:7, parents:2 } },
  { text:'處處一樣寬', files:{ index:8, reference:2, review:1, parents:4 } },
  { text:'和兩條線都垂直', files:{ index:11, reference:4, review:2, parents:4 } },
  { text:'兩條不一樣的直線都和同一條直線垂直', files:{ index:4, reference:4, review:1, parents:2 } },
  { text:'不是斜邊', files:{ index:3, reference:2, parents:2 } }
];
const SIBLING_RULES_EN = [
  { text:'side of the right angle', files:{ index:15, reference:6, review:4, parents:4 } },
  { text:'perpendicular one is the shortest', files:{ index:5, reference:1 } },
  { text:'same width apart everywhere', files:{ index:2, reference:1, review:1, parents:1 } },
  { text:'perpendicular to both', files:{ index:11, reference:3, review:2, parents:2 } },
  { text:'perpendicular to the same line are parallel', files:{ index:3, reference:2, parents:1 } }
];
/* 一個字都不可以出現的句子（都是假話，連當誘答都不可以）。 */
/* ⚠️ 這裡只放「頁面自己主張就一定是假的」的句子。課程**刻意引用**的迷思
   （「平行線之間不一樣寬」那一句就是迷思檢查的題幹）不可以放進來，
   一刀切會誤傷 —— 那一句改由下面的 PAIRED_RULES 釘住：引用了就必須同一頁講出正確的量法。 */
const FORBIDDEN = [
  '斜邊貼住直線就可以', '斜著量也算距離',
  '垂直就是一橫一直', '把直尺滑過去就對了',
  'the slanted side works too', 'a slanted measurement is the distance',
  'perpendicular means level and upright'
];
/* 交給別的課的詞：每一次出現都必須在指定的字眼附近。 */
const HANDOFF_RULES = [
  { word:'量角器', near:['角度測量站'], span:60 },
  { word:'面積', near:['面積鋪磚廠', '五年級', '周長'], span:90 },
  { word:'protractor', near:['Angle Measuring Station'], span:100 },
  { word:'Area Tiling', near:['area', 'perimeter'], span:130 }
];
/* 規則必須住在指定的字典鍵裡。 */
const KEY_RULES = [
  { file:'index', key:'s1note', must:['一條直角邊', '滑', '另一條直角邊', '不是斜邊'] },
  { file:'index', key:'s2note', must:['線外一點', '和直線垂直的那一條最短', '點到直線的距離', '垂足'] },
  { file:'index', key:'s3note', must:['方向完全沒有變', '滑軌', '直線外面'] },
  { file:'index', key:'s4note', must:['處處一樣寬', '和兩條線都垂直'] },
  { file:'index', key:'s5note', must:['兩條不一樣的直線都和同一條直線垂直', '互相平行'] },
  { file:'index', key:'scopeNote', must:['四邊形家族', '角度測量站', '拼角工作坊', '面積鋪磚廠', '方格紙'] },
  { file:'reference', key:'f1', must:['直角邊貼住'] },
  { file:'reference', key:'f3', must:['垂直的那一段'] },
  { file:'reference', key:'p1', must:['只畫得出一條'] },
  { file:'reference', key:'p2', must:['直線外面', '同一條線'] },
  { file:'parents', key:'s1p2', must:['四邊形家族', '作圖', '距離'] }
];
const KEY_RULES_EN = [
  { file:'index', key:'s1note', must:['side of the right angle', 'slide', 'never the long slanted side'] },
  { file:'index', key:'s2note', must:['point off a line', 'perpendicular to the line is the shortest', 'distance from the point to the line', 'foot'] },
  { file:'index', key:'s3note', must:['direction does not change at all', 'rail', 'off the line'] },
  { file:'index', key:'s4note', must:['same width apart everywhere', 'perpendicular to both'] },
  { file:'index', key:'s5note', must:['perpendicular to the same line are parallel to each other'] },
  { file:'index', key:'scopeNote', must:['Quadrilateral Family', 'Angle Measuring Station', 'Angle Workshop', 'Area Tiling Works', 'squared paper'] },
  { file:'reference', key:'p1', must:['only one line'] },
  { file:'parents', key:'s1p2', must:['Quadrilateral Family', 'construction', 'distance'] }
];
/* 成對出現：左邊那句話只要出現，右邊那句限定句就必須在同一頁出現。 */
const PAIRED_RULES = [
  { rule:'垂直的那一條最短', qualifier:'線外一點', pages:['index', 'reference'] },
  { rule:'perpendicular one is the shortest', qualifier:'point off a line', pages:['index'] },
  { rule:'都和同一條直線垂直', qualifier:'不一樣的直線', pages:['index', 'reference', 'parents'] },
  { rule:'畫平行線', qualifier:'滑軌', pages:['index', 'reference'] },
  /* 引用迷思的那兩句：只要說出口，同一頁就必須講出正確的量法。 */
  { rule:'平行線之間不是處處一樣寬', qualifier:'和兩條線都垂直', pages:['index'] },
  { rule:'parallel lines are not the same width apart', qualifier:'perpendicular to both</strong> lines', pages:['index'] }
];

/* ---------- 6) review.html 的文字真值表（第二份） ---------- */
const TXT_REF = {
  zh: {
    cm:n => n + ' 公分',
    deg:n => n + ' 度',
    pairs:n => n + ' 組',
    countOpt:{ one:'只有 1 條', two:'剛好 2 條', many:'無限多條', none:'一條都畫不出來' },
    relOpt:{ parallel:'甲和乙互相平行', notParallel:'甲和乙不平行，延長下去會相交', perpToEachOther:'甲和乙互相垂直', sameLine:'甲和乙是同一條直線' },
    relOpt2:{ perpToEachOther:'互相垂直', parallel:'互相平行', neither:'既不垂直也不平行', sameLine:'是同一條直線' },
    stepText:{
      perpLeg:'把三角板的一條直角邊貼住那條直線',
      perpSlide:'三角板沿著直線滑，滑到另一條直角邊剛好通過那個點',
      perpDraw:'沿著另一條直角邊把線畫下去',
      paraEdge:'把三角板的一條邊貼住那條直線',
      paraRuler:'把直尺貼住三角板的另一條邊，當滑軌',
      paraSlide:'三角板沿著直尺滑，滑到第一條邊剛好通過那個點',
      paraDraw:'沿著第一條邊把線畫下去',
      trapHyp:'把三角板的斜邊貼住那條直線',
      trapMoveRuler:'按住三角板不動，把直尺滑到那個點',
      trapGuess:'先隨手畫一條，再擦掉慢慢調'
    },
    quadName:{ square:'正方形', rect:'長方形', rhombus:'菱形', parallelogram:'平行四邊形', trapezoid:'梯形' }
  },
  en: {
    cm:n => n + ' cm',
    deg:n => n + ' degrees',
    pairs:n => (n === 1 ? '1 pair' : n + ' pairs'),
    countOpt:{ one:'exactly 1', two:'exactly 2', many:'infinitely many', none:'none at all' },
    relOpt:{ parallel:'A and B are parallel', notParallel:'A and B are not parallel; extended, they cross', perpToEachOther:'A and B are perpendicular to each other', sameLine:'A and B are the same line' },
    relOpt2:{ perpToEachOther:'perpendicular to each other', parallel:'parallel to each other', neither:'neither perpendicular nor parallel', sameLine:'they are the same line' },
    stepText:{
      perpLeg:'put one side of the right angle of the set square along the line',
      perpSlide:'slide the set square along the line until the other side of the right angle passes through the point',
      perpDraw:'draw along that other side of the right angle',
      paraEdge:'put one edge of the set square along the line',
      paraRuler:'press the ruler against the other edge of the set square, as a rail',
      paraSlide:'slide the set square along the ruler until the first edge passes through the point',
      paraDraw:'draw along that first edge',
      trapHyp:'put the long slanted side of the set square along the line',
      trapMoveRuler:'hold the set square still and slide the ruler over to the point',
      trapGuess:'draw a line freehand first, then rub it out and adjust'
    },
    quadName:{ square:'square', rect:'rectangle', rhombus:'rhombus', parallelogram:'parallelogram', trapezoid:'trapezium' }
  }
};
const STEP_LISTS_REF = { perp:['perpLeg', 'perpSlide', 'perpDraw'], para:['paraEdge', 'paraRuler', 'paraSlide', 'paraDraw'] };
const QUAD_PAIRS_REF = { square:2, rect:2, rhombus:2, parallelogram:2, trapezoid:1 };

/* 十二題的題幹，**整句重建**（第二份）。子字串釘不死題幹，整句才釘得死。 */
const STEM_EXACT = {
  perpDist: d => ({ zh:'方格紙上一格是 1 公分。紅點到藍色直線的<strong>距離</strong>是幾公分？',
                    en:'One square on the grid is 1 cm. What is the <strong>distance</strong> from the red dot to the blue line, in centimetres?' }),
  slantLonger: d => ({ zh:'點 P 在直線 L 的外面，P 到 L 的<strong>距離</strong>是 ' + d.d + ' 公分。小安從 P 畫一條線段到 L 上<strong>另外一個點</strong>（不是垂足）。這一條線段可能是幾公分？',
                       en:'Point P lies off line L, and the <strong>distance</strong> from P to L is ' + d.d + ' cm. An draws a segment from P to <strong>some other point</strong> on L (not the foot). How long could that segment be, in centimetres?' }),
  paraWidth: d => ({ zh:'方格紙上一格是 1 公分。藍色的兩條直線互相平行，它們之間的<strong>距離</strong>是幾公分？',
                     en:'One square on the grid is 1 cm. The two blue lines are parallel. What is the <strong>distance</strong> between them, in centimetres?' }),
  sameEverywhere: d => ({ zh:'兩條直線互相平行。在左邊<strong>垂直</strong>量它們之間的寬，量到 ' + d.gap + ' 公分。換到<strong>右邊</strong>再<strong>垂直</strong>量一次，會量到幾公分？',
                          en:'Two lines are parallel. Measuring the width between them <strong>perpendicular</strong> to both on the left gives ' + d.gap + ' cm. Measuring again <strong>perpendicular</strong> to both over on the <strong>right</strong>, what comes out, in centimetres?' }),
  threeLines: d => ({ zh:'甲、乙、丙三條直線互相平行。甲和乙相距 ' + d.a + ' 公分。丙和甲相距 ' + d.b + ' 公分，而且' + (d.sameSide ? '丙在甲和乙的<strong>中間</strong>' : '甲在乙和丙的<strong>中間</strong>') + '。乙和丙相距幾公分？',
                      en:'Lines A, B and C are all parallel. A and B are ' + d.a + ' cm apart, and C is ' + d.b + ' cm from A, with ' + (d.sameSide ? 'C <strong>between</strong> A and B' : 'A <strong>between</strong> B and C') + '. How far apart are B and C, in centimetres?' }),
  drawStep: d => ({ zh:(d.tool === 'perp' ? '用三角板畫一條和已知直線垂直的線。' : '用三角板加直尺畫一條和已知直線平行的線。') + '已經做完的是：「' + TXT_REF.zh.stepText[d.doneKey] + '」。<strong>下一步</strong>要做什麼？',
                    en:(d.tool === 'perp' ? 'You are drawing a line perpendicular to a given line, with a set square.' : 'You are drawing a line parallel to a given line, with a set square and a ruler.') + ' The step just finished is: “' + TXT_REF.en.stepText[d.doneKey] + '”. What is the <strong>next step</strong>?' }),
  bothPerp: d => ({ zh:'藍色是直線丙，綠色是甲，紫色是乙。<strong>只有畫著小方框的地方才是直角。</strong>甲和乙是什麼關係？',
                    en:'Blue is line C, green is A and purple is B. <strong>Only the corners with a little box are right angles.</strong> How are A and B related?' }),
  howMany: d => ({
    zh:{ perpOn:'點 A 在直線 L <strong>上面</strong>。通過 A 而且和 L 垂直的直線，可以畫出幾條？',
         perpOff:'點 B 在直線 L <strong>外面</strong>。通過 B 而且和 L 垂直的直線，可以畫出幾條？',
         paraOff:'點 C 在直線 L <strong>外面</strong>。通過 C 而且和 L 平行的直線，可以畫出幾條？',
         perpAny:'和直線 L 垂直的直線<strong>一共</strong>有幾條（沒有規定要通過哪一個點）？' }[d.kind],
    en:{ perpOn:'Point A lies <strong>on</strong> line L. How many lines can be drawn through A perpendicular to L?',
         perpOff:'Point B lies <strong>off</strong> line L. How many lines can be drawn through B perpendicular to L?',
         paraOff:'Point C lies <strong>off</strong> line L. How many lines can be drawn through C parallel to L?',
         perpAny:'How many lines perpendicular to line L are there <strong>altogether</strong>, with no point they are required to pass through?' }[d.kind] }),
  gridRel: d => ({ zh:'方格紙上畫了兩條直線。它們是什麼關係？',
                   en:'Two lines are drawn on the squared paper. How are they related?' }),
  quadPara: d => ({ zh:'一個' + TXT_REF.zh.quadName[d.qid] + '，有<strong>幾組</strong>對邊互相平行？',
                    en:'How <strong>many pairs</strong> of opposite sides of a ' + TXT_REF.en.quadName[d.qid] + ' are parallel to each other?' }),
  splitRight: d => ({ zh:'兩條直線互相垂直，交叉的地方是一個<strong>直角</strong>。有一條線從交點出發，把這個直角切成<strong>兩塊</strong>，其中一塊量到 ' + d.a + ' 度。另一塊是幾度？',
                      en:'Two lines are perpendicular, so where they cross there is a <strong>right angle</strong>. A line from the crossing point cuts that right angle into <strong>two pieces</strong>, and one piece measures ' + d.a + ' degrees. How many degrees is the other piece?' }),
  turnPair: d => ({ zh:'一張紙上畫著兩條互相垂直的直線。把整張紙<strong>一起</strong>轉 ' + d.turn + ' 度（兩條線一起轉，沒有哪一條自己動）。現在這兩條線交叉的地方是幾度？',
                    en:'Two perpendicular lines are drawn on a sheet of paper. The whole sheet is turned by ' + d.turn + ' degrees, carrying <strong>both</strong> lines together (neither line moves on its own). What is the angle where they cross now?' })
};
const GEN_IDS = ['perpDist', 'slantLonger', 'paraWidth', 'sameEverywhere', 'threeLines', 'drawStep',
                 'bothPerp', 'howMany', 'gridRel', 'quadPara', 'splitRight', 'turnPair'];
const FIG_GENS = ['perpDist', 'paraWidth', 'bothPerp', 'gridRel'];
/* 誘答可以抄題幹數字的情形（就是那一課明講的迷思）。 */
const STEM_ECHO_ALLOWED = {
  slantLonger:(d, v) => v <= d.d,                     // 「和距離一樣長或更短」正是要擋掉的想法
  sameEverywhere:(d, v) => v === d.gap,               // 正解本來就等於題幹的那個數
  threeLines:(d, v) => v === d.a || v === d.b,        // 只抄其中一段
  splitRight:(d, v) => v === d.a,                     // 把量到的那一塊直接抄下來
  turnPair:(d, v) => v === d.turn                     // 把轉的角度當成交角
};

/* ⚠️ review.html 的取樣空間：產生器自己的拒絕取樣（retry）會把很多改壞**吸收掉** ——
   把 TRIPLES 改成非畢氏三數、或把「只有一條垂直」那一支拿掉，產生器只會多抽幾次然後
   若無其事地繼續，所有數值斷言都還是綠的，可是定義域整片消失了。這種事只有
   **逐字釘住原始碼**釘得住（和 grade-4-time 釘參數池是同一招）。
   ⚠️ 這一招的**極限**要講清楚：它比對的是字面文字，不是資料流。把真正在跑的那一行改掉、
   同時把原句抄進註解以外的死程式碼裡，計數還是 1，這條就繞得過去。它擋得住的是
   「順手把某一種情形拿掉」，擋不住蓄意的偽裝；真正逐題驗到的是 INVARIANTS 與 renderCheck。 */
const REVIEW_PINS = [
  { text:"  var TRIPLES_H = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10]];",
    why:'the Pythagorean tables are what make every length reported on a picture a whole number of centimetres' },
  { text:"  var TRIPLES_V = [[4, 3, 5], [8, 6, 10]];",
    why:'the vertical-line pictures need their own table, or they stop being whole numbers' },
  { text:"        var both = rand(2) === 0;",
    why:'both the "both perpendicular" and the "only one is perpendicular" cases must keep coming up' },
  { text:"  var SPLIT_POOL = (function(){ var out = [], v; for (v = 10; v <= 80; v++) if (v !== 45) out.push(v); return out; })();",
    why:'the right-angle-split question must keep sampling the whole 10~80 degree range apart from 45' },
  { text:"    for (a = 6; a <= 14; a++) for (b = 2; b < a; b++){",
    why:'the three-parallel-lines question must keep sampling the whole (a, b) space' },
  { text:"        return retry(function(){ return build(makeDistCase()); }, function(){ return build(fbDist()); });",
    why:'without the fallback, make() can return null and the simulation harness dereferences it and dies' },
  { text:"        return retry(function(){ return build(makeWidthCase()); }, function(){ return build(fbWidth()); });",
    why:'without the fallback, make() can return null and the simulation harness dereferences it and dies' },
  { text:"        return retry(function(){ return build(makeRelCase(both), both); }, function(){ return build(fbRel(both), both); });",
    why:'without the fallback, make() can return null and the simulation harness dereferences it and dies' },
  { text:"        return retry(function(){ return build(makeCrossCase(kind), kind); }, function(){ return build(fbCross(kind), kind); });",
    why:'without the fallback, make() can return null and the simulation harness dereferences it and dies' },
  { text:"    var bDir = both ? perp(cDir) : [aDir[0] - cDir[0], aDir[1] - cDir[1]];",
    why:'without the second branch every question becomes the "both perpendicular" case and the contrast is gone' },
  { text:"        var kind = pick(['perp', 'para', 'none']);",
    why:'the grid-relation question must keep asking about all three relations' },
  { text:"          var kind = pick(['perpOn', 'perpOff', 'paraOff', 'perpAny']);",
    why:'the "how many" question must keep the case whose answer is "infinitely many"' },
  { text:"          var tool = rand(2) === 0 ? 'perp' : 'para';",
    why:'the step question must keep asking about both constructions' },
  { text:"          var sameSide = rand(2) === 0;",
    why:'the three-parallel-lines question must keep both the adding and the subtracting arrangement' }
];

function isPerm(a, ref){ return Array.isArray(a) && a.length === ref.length && ref.every(k => a.indexOf(k) >= 0) && new Set(a).size === ref.length; }
function fourDistinctNums(opts){ return Array.isArray(opts) && opts.length === 4 && opts.every(v => Number.isInteger(v)) && new Set(opts).size === 4; }
function eqJ(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
function numbersIn(s){ return (String(s).match(/\d+/g) || []).map(Number); }
function stripComments(src){
  /* ⚠️ 換成 '\n' 不是 ''：換成空字串的話註解前後的字會接起來，
     生出原始碼裡根本沒有的匹配。 */
  return String(src).replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/<!--[\s\S]*?-->/g, '\n');
}
function plainText(s){ return String(s).replace(/<[^>]*>/g, ''); }
/* 措辭守衛只看散文：拿掉 <style> 與 class="…"，不然 CSS 的類別名會被咬到。 */
function proseOnly(src){
  return String(src).replace(/<style[\s\S]*?<\/style>/gi, '\n').replace(/class="[^"]*"/g, ' ');
}
function textProblems(s, lang, label){
  const out = [];
  const plain = plainText(s);
  if (/undefined|NaN|\[object/.test(plain)) out.push(label + ': renders "' + plain.slice(0, 60) + '"');
  if (lang === 'zh'){
    const m = /[一-鿿]\d|\d[一-鿿]/.exec(plain);
    if (m) out.push(label + ': Chinese and a digit with no space at "' + m[0] + '"');
  }
  const dbl = /[，。、；：？！,.;:?!]{2,}/.exec(plain);
  if (dbl) out.push(label + ': doubled punctuation "' + dbl[0] + '"');
  return out;
}

/* 讀同一課的另外三頁（改壞測試會把四頁複製到暫存目錄，所以一定要用 process.argv[2]
   推出資料夾，不可以用 __dirname —— 那會讀到真的 repo，斷言就永遠是綠的）。 */
function siblingSources(){
  const target = process.argv[2] || '';
  const dir = path.dirname(path.resolve(target));
  const out = {};
  ['index', 'reference', 'review', 'parents'].forEach(name => {
    const f = path.join(dir, name + '.html');
    out[name] = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  });
  return out;
}
/* 字典的某一段（只看字典，不看 markup 的 fallback 副本 —— 不然刪掉字典那一份，
   markup 那一份會替它背書）。 */
function langRegion(clean, lang){
  const a = clean.indexOf(lang === 'zh' ? 'zh: {' : 'en: {');
  if (a < 0) return null;
  if (lang === 'zh'){
    const b = clean.indexOf('en: {', a);
    return b > a ? clean.slice(a, b) : null;
  }
  /* 英文那一段要切到字典收尾，不可以一路吃到檔尾。 */
  const marks = ['/* ---------- 以下開始碰 DOM', "var lang = 'zh'"];
  const ends = marks.map(m => clean.indexOf(m, a)).filter(x => x > a);
  const end = ends.length ? Math.min.apply(null, ends) : -1;
  return end > a ? clean.slice(a, end) : null;
}
/* 一個字典鍵的值（key:'…'）。 */
function keyValue(region, key){
  const re = new RegExp('(?:^|[\\s{,])' + key + "\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'");
  const m = re.exec(region);
  return m ? m[1] : null;
}

/* 圖的幾何檢查（review.html 的四種圖）。 */
function figProblems(fig, genId, d){
  const out = [];
  if (!fig || !Array.isArray(fig.lines)) return ['figure has no lines'];
  if (fig.w !== FIG_W_REF || fig.h !== FIG_H_REF) out.push('figure canvas is not ' + FIG_W_REF + '×' + FIG_H_REF);
  const pts = [];
  fig.lines.forEach(l => { pts.push(l.a, l.b); });
  fig.marks.forEach(m => m.forEach(p => pts.push(p)));
  fig.dots.forEach(dt => pts.push(dt.p));
  pts.forEach(p => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) out.push('a coordinate is not a number');
    else if (p.x < MARGIN_REF || p.y < MARGIN_REF || p.x > FIG_W_REF - MARGIN_REF || p.y > FIG_H_REF - MARGIN_REF)
      out.push('a point falls outside the canvas at (' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ')');
  });
  fig.marks.forEach((m, i) => {
    if (!Array.isArray(m) || m.length !== 3){ out.push('right-angle mark ' + i + ' is not three points'); return; }
    const u = [m[1].x - m[0].x, m[1].y - m[0].y], v = [m[2].x - m[1].x, m[2].y - m[1].y];
    if (!isPerpDrawn(u, v)) out.push('right-angle mark ' + i + ' is not a right angle');
    if (Math.abs(len2(u) - MARK_S_REF * U_REF) > 1e-6) out.push('right-angle mark ' + i + ' is the wrong size');
  });
  /* ⚠️ 記號**畫在哪裡**要單獨驗（一個畫得完美的小方框搬到別的角落，上面那幾條全綠），
     而且要比**多重集合** —— 「是不是清單裡的某一點」會放行「全部疊在同一個允許的點上」。 */
  {
    const wantMark = [];
    const cs = d && d.c && d.c.cs;
    if (genId === 'perpDist' && cs){
      /* 垂足的兩側各一個，所以列兩次。 */
      wantMark.push(refP(footRef(cs)), refP(footRef(cs)));
    }
    if (genId === 'paraWidth' && cs){
      const horiz = cs.axis === 'h';
      cs.perpAt.forEach(t => {
        wantMark.push(refP(horiz ? [t, cs.a] : [cs.a, t]), refP(horiz ? [t, cs.b] : [cs.b, t]));
      });
    }
    if (genId === 'bothPerp' && cs){
      /* 只有真的是直角的交點才該有記號。 */
      const rd2 = relData2(cs);
      if (rd2.aPerp) wantMark.push(refP(cs.aAt));
      if (rd2.bPerp) wantMark.push(refP(cs.bAt));
    }
    if (['perpDist', 'paraWidth', 'bothPerp', 'gridRel'].indexOf(genId) >= 0)
      markPlaceProblems(fig.marks, wantMark, genId).forEach(x => out.push(x));
  }
  const base = fig.lines.filter(l => l.kind === 'base');
  const perpL = fig.lines.filter(l => l.kind === 'perp');
  const slantL = fig.lines.filter(l => l.kind === 'slant');
  const drawnL = fig.lines.filter(l => l.kind === 'drawn');

  if (genId === 'perpDist'){
    if (base.length !== 1) out.push('exactly one blue line');
    if (perpL.length !== 1) out.push('exactly one purple perpendicular segment');
    if (slantL.length !== 2) out.push('exactly two orange slanted segments');
    if (base.length && perpL.length){
      if (!isPerpDrawn(vecOf(perpL[0]), vecOf(base[0]))) out.push('the purple segment is not drawn at 90 degrees to the line');
      if (Math.abs(cmOf(perpL[0]) - d.d) > 1e-9) out.push('the purple segment is drawn ' + cmOf(perpL[0]).toFixed(3) + ' cm but the answer says ' + d.d);
      slantL.forEach((l, i) => {
        if (Math.abs(cmOf(l) - d.slant) > 1e-9) out.push('orange segment ' + i + ' is drawn ' + cmOf(l).toFixed(3) + ' cm but the explanation says ' + d.slant);
        if (!(cmOf(l) > cmOf(perpL[0]) + 1e-9)) out.push('orange segment ' + i + ' is not longer than the purple one');
      });
    }
    if (fig.marks.length !== 2) out.push('the foot needs a right-angle mark on both sides');
    if (fig.dots.filter(dt => dt.kind === 'point').length !== 1) out.push('exactly one red point');
  }
  if (genId === 'paraWidth'){
    if (base.length !== 2) out.push('exactly two blue parallel lines');
    if (perpL.length !== 2) out.push('exactly two purple perpendicular measurements');
    if (slantL.length !== 1) out.push('exactly one orange slanted measurement');
    if (base.length === 2){
      if (!isParaDrawn(vecOf(base[0]), vecOf(base[1]))) out.push('the two blue lines are not drawn parallel');
      /* 「處處一樣寬」量的是**畫出來的**兩條線，沿線取樣好幾個位置。 */
      renderedGapProblems(base[0], base[1], d.gap, 'paraWidth').forEach(x => out.push(x));
      perpL.forEach((l, i) => {
        if (!isPerpDrawn(vecOf(l), vecOf(base[0]))) out.push('purple measurement ' + i + ' is not perpendicular to the lines');
        if (Math.abs(cmOf(l) - d.gap) > 1e-9) out.push('purple measurement ' + i + ' is drawn ' + cmOf(l).toFixed(3) + ' cm but the answer says ' + d.gap);
      });
      slantL.forEach(l => {
        if (isPerpDrawn(vecOf(l), vecOf(base[0]))) out.push('the orange measurement is drawn perpendicular');
        if (Math.abs(cmOf(l) - d.slant) > 1e-9) out.push('the orange measurement is drawn ' + cmOf(l).toFixed(3) + ' cm but the explanation says ' + d.slant);
        if (!(cmOf(l) > d.gap + 1e-9)) out.push('the orange measurement is not longer than the width');
      });
    }
    if (fig.marks.length !== 4) out.push('both ends of both purple measurements need a right-angle mark');
  }
  if (genId === 'bothPerp'){
    if (base.length !== 1 || drawnL.length !== 1 || perpL.length !== 1) out.push('C, A and B must each be drawn exactly once');
    else {
      const aP = isPerpDrawn(vecOf(drawnL[0]), vecOf(base[0]));
      const bP = isPerpDrawn(vecOf(perpL[0]), vecOf(base[0]));
      const par = isParaDrawn(vecOf(drawnL[0]), vecOf(perpL[0]));
      if (!aP) out.push('A must always be drawn perpendicular to C in this generator');
      if (bP !== d.both) out.push('B is drawn ' + (bP ? '' : 'not ') + 'perpendicular to C, but the data says ' + (d.both ? 'it is' : 'it is not'));
      if (par !== d.both) out.push('A and B are drawn ' + (par ? '' : 'not ') + 'parallel, but the answer says ' + (d.both ? 'they are' : 'they are not'));
      if ((aP && bP) !== par) out.push('"both perpendicular to C" and "parallel to each other" disagree in the drawing');
      const wantMarks = (aP ? 1 : 0) + (bP ? 1 : 0);
      if (fig.marks.length !== wantMarks) out.push(fig.marks.length + ' right-angle marks drawn but only ' + wantMarks + ' corner(s) are right angles');
    }
  }
  if (genId === 'gridRel'){
    if (fig.lines.length !== 2) out.push('exactly two lines');
    else {
      const isP = isPerpDrawn(vecOf(fig.lines[0]), vecOf(fig.lines[1]));
      const isA = isParaDrawn(vecOf(fig.lines[0]), vecOf(fig.lines[1]));
      if (d.kind === 'perp' && !(isP && !isA)) out.push('the drawing is not a perpendicular pair, but the answer says it is');
      if (d.kind === 'para' && !(isA && !isP)) out.push('the drawing is not a parallel pair, but the answer says it is');
      if (d.kind === 'none' && (isP || isA)) out.push('the drawing is perpendicular or parallel, but the answer says neither');
      /* ⚠️ 會相交的那兩種，交點一定要落在方格紙**裡面**：交點在畫面外的話，
         「交叉的地方是不是直角」和解釋說的「它們會相交」孩子都看不出來。 */
      if (!isA){
        const X = crossPointRef(fig.lines[0], fig.lines[1]);
        if (!X) out.push('the two lines do cross somewhere, but the crossing point cannot be worked out');
        else if (X.x < OX_REF || X.x > OX_REF + GW_REF * U_REF || X.y < OY_REF - GH_REF * U_REF || X.y > OY_REF)
          out.push('the two lines do cross, but at (' + X.x.toFixed(0) + ', ' + X.y.toFixed(0) + '), off the squared paper, so nothing about the crossing can be seen');
      }
    }
    if (fig.marks.length !== 0) out.push('this figure must carry no right-angle mark, or it would give the answer away');
  }
  return out;
}

/* ================= 小遊戲「製圖廠接訂單」（§六之五：五關五種玩法） =================
   每一關照遊戲自己的規則（頁面資料區的純函式）把題庫的每一題玩一遍，正解一律用這份設定**自己的幾何**重算：
   整數方向的內積／外積、畫板座標的距離。畫板座標、收的範圍、觸控大小都從資料區讀，用這裡自己的距離公式掃過整個畫板驗。
   計分、洗牌從原始碼切出來真的跑；拖拉引擎與每一關 handler 的收／不收順序用字面釘住（行為由 e2e 與改壞頁證明）。 */
const { extractFunction } = require('./lib/gameshuffle.js');
/* 375px 手機上畫板的縮放：卡片內距後舞台約 286px 寬（e2e 在 375px 實際量到 48 × k ≈ 45.8）。取下界。 */
const PHONE_K = Math.min(1.5, 286 / 300);
const GAME_TYPES = ['slide', 'string', 'steps', 'width', 'rel'];
const STEP_KEYS_GAME = ['stick', 'rail', 'slide', 'draw'];
const DECOY_KEYS_GAME = ['moveRuler', 'turn'];

function gameChecks(D, I18N, fail, src){
  const LANGS = ['zh', 'en'], W = D.GAME_W;
  if (W !== 300) fail('GAME_W is ' + W + ', the boards are designed for 300');
  if (!Array.isArray(D.GAME_ORDER) || D.GAME_ORDER.join() !== GAME_TYPES.join())
    fail('GAME_ORDER should be ' + GAME_TYPES.join() + ' (the order of the five examples), got ' + D.GAME_ORDER);
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  GAME_TYPES.forEach(t => {
    B[t] = body(t);
    if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t].trim())) fail('gAsks.' + t + ' missing in ' + L);
      if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && /^💡 (提示 1|Hint 1)/.test(I18N[L].gHints[t]))) fail('gHints.' + t + ' missing in ' + L + ' (it must start with 💡 提示 1 / 💡 Hint 1)');
    });
  });
  const need = (k, re, what) => { if (!re.test(B[k] || '')) fail(k + ': ' + what); };
  const touch = (what, sz) => { if (!(sz * PHONE_K >= 44)) fail(what + ' is ' + (sz * PHONE_K).toFixed(1) + 'px on a 375px phone — under 44'); };
  const inside = (o, what, H) => { if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H)) fail(what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i][1], list[j][1])) return fail(what + ': ' + list[i][0] + ' and ' + list[j][0] + ' overlap'); };
  const box = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
  const boxDistRef = (x, y, b) => Math.hypot(Math.max(0, b.x - x, x - (b.x + b.w)), Math.max(0, b.y - y, y - (b.y + b.h)));
  const segDistRef = (p, a, b) => {
    const ux = b.x - a.x, uy = b.y - a.y, L2 = ux * ux + uy * uy;
    let t = ((p.x - a.x) * ux + (p.y - a.y) * uy) / L2; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - a.x - ux * t, p.y - a.y - uy * t);
  };
  const px = (G, g) => ({ x:G.ox + g[0] * G.u, y:G.oy - g[1] * G.u });
  const dotI = (u, v) => u[0] * v[0] + u[1] * v[1], crossI = (u, v) => u[0] * v[1] - u[1] * v[0];
  const textOk = (where, s) => { if (typeof s !== 'string' || !s.trim() || /undefined|NaN|null|\[object/.test(s)) fail(where + ': bad text: ' + s); };
  const has = (where, s, words) => words.forEach(w => { if (String(s).indexOf(w) < 0) fail(where + ' should say "' + w + '": ' + s); });
  const lacks = (where, s, words) => words.forEach(w => { if (String(s).indexOf(w) >= 0) fail(where + ' must not say "' + w + '": ' + s); });
  const numsIn = s => (String(s).replace(/<[^>]*>/g, ' ').match(/\d+/g) || []).map(Number);
  /* 自己的「直線被方格紙切出來的那一段」 */
  const clipRef = (cols, rows, A, Dv) => {
    let lo = -Infinity, hi = Infinity;
    for (let i = 0; i < 2; i++){
      const a = A[i], d = Dv[i], m = i ? rows : cols;
      if (d === 0){ if (a < 0 || a > m) return null; continue; }
      let t0 = -a / d, t1 = (m - a) / d; if (t0 > t1) [t0, t1] = [t1, t0];
      lo = Math.max(lo, t0); hi = Math.min(hi, t1);
    }
    return lo < hi ? [[A[0] + Dv[0] * lo, A[1] + Dv[1] * lo], [A[0] + Dv[0] * hi, A[1] + Dv[1] * hi]] : null;
  };

  /* ---------- 共用：shuffle() 真的跑：是排列、不改輸入、永遠不會由小到大，每一張到過每一個位置 ---------- */
  {
    const fsrc = extractFunction(src, 'shuffle');
    let shuffle = null;
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else { try { shuffle = new Function(fsrc + '\nreturn shuffle;')(); } catch (e){ fail('shuffle() could not be evaluated on its own: ' + e.message); } }
    /* 決定性的一層（codex 第一輪：4000 次亂數只是「幾乎一定」）：把 Math.random 換成一串指定的值，
       走遍 Fisher–Yates 每一種抽法 —— 每一種排列都要出得來，唯獨「由小到大」一定被換掉。 */
    if (fsrc) [4, 5].forEach(n => {
      const input = [...Array(n).keys()], outs = new Set();
      const total = [1, 1, 2, 6, 24, 120][n];
      for (let code = 0; code < total; code++){
        /* code 拆成每一步的選擇 k_j（j = n−1 … 1，k_j ∈ 0…j） */
        let rest = code; const ks = [];
        for (let j = n - 1; j > 0; j--){ ks.push(rest % (j + 1)); rest = Math.floor(rest / (j + 1)); }
        const queue = ks.map((k, i) => (k + 0.5) / (n - i));
        let sh;
        try { sh = new Function('Math', fsrc + '\nreturn shuffle;')({ floor:Math.floor, random:() => queue.shift() }); }
        catch (e){ return fail('shuffle() could not be evaluated with a scripted Math.random: ' + e.message); }
        const out = sh(input).join();
        if (out === input.join()) return fail('shuffle() of ' + n + ' with scripted draws ' + ks + ' returns the increasing order — the tray would start in the answer order');
        outs.add(out);
      }
      if (outs.size !== total - 1) fail('shuffle() of ' + n + ' items reaches ' + outs.size + ' orders over every scripted draw, expected ' + (total - 1));
    });
    if (shuffle){
      [[0, 1, 2, 3], [0, 1, 2, 3, 4]].forEach(input => {
        const seen = {}, before = input.join(), perms = new Set();
        for (let i = 0; i < 4000; i++){
          const out = shuffle(input);
          if (input.join() !== before) return fail('shuffle() mutates its input');
          if (out.slice().sort((a, b) => a - b).join() !== before) return fail('shuffle() changed the set: ' + out);
          if (out.join() === before) return fail('shuffle() returned ' + out.join(',') + ' — the tray would start in the answer order');
          out.forEach((v, p) => { seen[v + '@' + p] = true; });
          perms.add(out.join());
        }

      });
    }
    /* 排步驟：四張步驟卡洗牌，兩張陷阱再插進去 —— 四步的相對順序就是 shuffle 的結果，不會是答案的順序 */
    need('steps', /var cards = GAME_STEPS\.concat\(GAME_STEPS_DECOY\), order = shuffle\(\[0, 1, 2, 3\]\);/, 'the four step cards are not shuffled onto the tray');
    need('steps', /order\.forEach\(function\(ci, p\)\{/, 'the tray is not drawn in the shuffled order');
    need('width', /shuffle\(segs\.map\(function\(s, i\)\{ return i; \}\)\)\.forEach\(/, 'the length cards are not shuffled onto the tray');
  }
  /* ---------- 共用：計分（中年級 §三：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0）---------- */
  {
    const fsrc = extractFunction(src, 'roundSolved');
    if (!fsrc) fail('scoring: cannot find roundSolved() in index.html');
    else [[false, 0, 20], [true, 15, 25], [false, 40, 60]].forEach(([mis, s0, want]) => {
      let r;
      try { r = new Function('var gSolved = false, gMistake = ' + mis + ', gScore = ' + s0 + ', gRound = 1, GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gHintBtn = {}, gNext = { disabled:true },' +
        ' gameStage = { querySelectorAll:function(){ return []; } }; function L(){ return { gPts:function(p){ return "@" + p + "@"; }, gClear:"", gWin:function(){ return ""; } }; }\n' + fsrc +
        '\nroundSolved("done"); roundSolved("again"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, solved:gSolved, next:gNext.disabled };')(); }
      catch (e){ return fail('scoring: roundSolved() could not run: ' + e.message); }
      const pts = mis ? 10 : 20;
      if (r.s !== want || String(r.shown) !== String(want)) fail('scoring: a round ' + (mis ? 'with' : 'without') + ' mistakes from ' + s0 + ' ends at ' + r.s + ', expected +' + pts + ' = ' + want + ' (and only once)');
      if (r.html.indexOf('@' + pts + '@') < 0 || r.html.indexOf('done') < 0 || !r.solved || r.next) fail('scoring: roundSolved() does not show "+' + pts + '", mark the round solved or enable Next');
    });
  }
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
  /* ---------- 共用：整段遊戲程式的指紋（codex 第一輪：handler 裡多一行覆寫、畫圖和判斷用的座標分家、訊息被改寫、
     扣分呼叫兩次……這些都在純函式之外，資料檢查看不到）。這一層只負責「改了就響」：改了以後要重跑 e2e
     （harness: teaching-workspace/game-harness/g4-perpendicular/run.sh）與改壞頁，確認行為，再更新指紋。 ---------- */
  {
    const a = src.indexOf('  /* ===================== 小遊戲：製圖廠接訂單'), b = src.indexOf('  /* ---------- 語言切換');
    if (a < 0 || b < a) fail('cannot find the game code block in index.html');
    else {
      const code = src.slice(a, b);   /* 原樣，不正規化空白：JavaScript 的換行有意義（return 後面換行會插分號）—— codex 第二輪 */
      const fp = require('crypto').createHash('sha1').update(code).digest('hex');
      if (fp !== GAME_CODE_FP) fail('the game code changed (fingerprint ' + fp + ') — re-run the e2e harness and the broken pages, then update GAME_CODE_FP');
    }
  }
  /* ---------- 共用：拖拉引擎（字面釘樁；真正的行為由 e2e 和改壞頁證明） ---------- */
  if (!/if \(gen !== gGen\) return;/.test(src) || !/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src))
    fail('the drag engine has no board-generation guard: a piece held across Restart could act on the new board');
  if (!/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(src)) fail('startRound() does not bump gGen');
  if ((src.match(/if \(!start \|\| e\.pointerId !== pid\) return;/g) || []).length !== 2) fail('the drag engine does not follow only the first finger (move and end must both check pointerId)');
  if (!/document\.addEventListener\('pointerup', onDocEnd\);\n\s*document\.addEventListener\('pointercancel', onDocEnd\);/.test(src)) fail('the drag engine has no document-level release while dragging');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on lostpointercapture');
  if (!/el\.addEventListener\('pointercancel', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('the drag engine does not put a piece back on pointercancel');
  if (!/\.gpiece\.locked\{cursor:default;pointer-events:none\}/.test(src)) fail('placed pieces still take pointer events');
  if (!/\.gpiece\{[^}]*touch-action:none/.test(src)) fail('pieces do not set touch-action:none');
  if (!/if \(P\.busy\(\)\) return;/.test(src)) fail('a tap-then-tap destination is taken while another finger still drags that piece');
  if (!/if \(o\.follow\)\{ var f = o\.follow\(\{ x:orig\.x \+ dx, y:orig\.y \+ dy \}\); P\.place\(f\.x, f\.y\); \}/.test(src)) fail('the drag engine does not snap while dragging (o.follow)');
  if (!/if \(PIECE_PTR\[e\.pointerId\]\) return;/.test(src)) fail('a finger that went down on a piece can still "tap a destination" when it is released on the board');
  ['slide', 'string', 'steps', 'width'].forEach(t => { if ((B[t].match(/useTapSelect\(B, function\(P, pt\)\{/g) || []).length !== 1) fail(t + ': the round does not install its drop / tap-then-tap handler (useTapSelect)'); });
  need('rel', /B\.onBoardTap = function\(pt\)\{/, 'the tap round does not install its board tap handler');
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/gameStage\.textContent = '';/.test(src)) fail('startRound() does not clear the stage before rendering');
  LANGS.forEach(L => {
    if (!/20/.test(I18N[L].gPts(20))) fail('gPts ' + L + ' does not show the points');
    if (!/5/.test(I18N[L].gMinus)) fail('gMinus ' + L + ' does not say 5');
    if (String(I18N[L].gWin(85)).indexOf('85') < 0) fail('gWin ' + L + ' does not show the score');
  });

  /* ---------- 每一關的收／不收／靜靜回去，照順序寫在 handler 裡 ---------- */
  const order = (k, lines, what) => {
    let at = -1;
    for (const l of lines){ const i = (B[k] || '').indexOf(l, at + 1); if (i < 0){ fail(k + ': ' + what + ' — missing or out of order: ' + l); return; } at = i; }
  };
  order('slide', ["if (pt.tap && !slideOnLine(e, pt.x, pt.y)) return false;", "var i = pt.tap ? slideIdx(e, pt.x, pt.y) : slideIdxFromGrip(e, P.cx, P.cy);", "if (k === 'start') return false;",
    "if (k === 'below'){ roundMiss(d.gSlideWhy.below); return false; }", "if (k !== 'ok'){ roundMiss(d.gSlideWhy.other(slideDir(e, i))); return false; }", "P.lock(q.x, q.y);", "roundSolved(d.gSlideOk);"],
    'only the foot stop is accepted; straight-below and other stops are refused with a reason; the start is silent');
  order('string', ["if (pt.tap && !strOnLine(e, pt.x, pt.y)) return false;", "var s = pt.tap ? strIdx(e, pt.x, pt.y) : strIdx(e, P.cx, P.cy);", "if (k === 'start') return false;",
    "if (k !== 'ok'){ roundMiss(d.gStrWhy); return false; }", "P.lock(q.x, q.y);", "roundSolved(d.gStrOk(dist));"], 'only the foot is accepted; slanted pegs are refused; the start is silent');
  order('steps', ["var j = stepsNearest(pt.x, pt.y);", "if (j < 0 && pt.fx !== undefined) j = stepsNearest(pt.fx, pt.fy);", "if (j < 0 || filled[j]) return false;",
    "if (k === 'decoy'){ roundMiss(d.gStepsWhy[c]); return false; }", "if (k !== 'ok'){ roundMiss(d.gStepsWhy[c][k]); return false; }", "P.lock(", "filled[j] = true;", "if (n === total) roundSolved(d.gStepsDone);"],
    'a card goes only into its own slot (nearest slot, centre then finger); a filled slot or empty space is silent');
  order('width', ["var r = widthBin(lay, pt.x, pt.y, pt.fx, pt.fy);", "if (!r) return false;", "if (r !== want){ roundMiss(", "P.lock(q.x, q.y);", "if (left === 0) roundSolved(d.gWidthDone(e.g));"],
    'a card goes only into its own box; outside both boxes is silent');
  order('rel', ["if (gSolved) return;", "var id = relHit(e, pt.x, pt.y);", "if (!id || found[id]) return;", "if (k === 'given') return;", "if (k !== 'ok'){ roundMiss(d.gRelWhy[k]); return; }", "found[id] = true; nFound++;", "if (nFound === total) roundSolved(d.gRelDone);"],
    'only lines parallel to A count; A itself, found lines and empty paper are silent');
  /* 理由句子（兩種語言）用指紋釘住：改了任何一句，這裡就會響 —— 重新逐句確認那句話對每一種會叫到它的情況都是真的，再更新指紋。 */
  {
    const pickWhy = d => JSON.stringify([d.gSlideWhy.below, String(d.gSlideWhy.other), d.gStrWhy, d.gStepsWhy, String(d.gWidthWhy.perpNo), String(d.gWidthWhy.slantYes), d.gRelWhy]);
    const fp = require('crypto').createHash('sha1').update(pickWhy(I18N.zh) + pickWhy(I18N.en)).digest('hex');
    if (fp !== GAME_WHY_FP) fail('the game\'s mistake reasons changed (fingerprint ' + fp + ') — re-check every reason sentence against every case that calls it, then update GAME_WHY_FP');
  }
  /* 每一句理由的關鍵字（可讀的一層；指紋才是擋改寫的那一層） */
  const SAYS = {
    zh:{ below:['正下方', '沒有通過紅點', '直角'], other:['沒有通過紅點'], str:['斜的', '比垂直的那一條長'], moveRuler:['滑軌', '不動'], turn:['垂直', '不是平行'],
         perpNo:['都垂直', '就是距離'], slantYes:['斜著量', '不是距離'], skew:['沒有直角', '不平行'], cross:['甲', '垂直', '不是平行'], bing:['垂直', '不是平行'] },
    en:{ below:['straight below', 'misses the red dot', 'right angle'], other:['does not go through the red dot'], str:['slanted', 'longer than the perpendicular'], moveRuler:['rail', 'held still'], turn:['perpendicular', 'not parallel'],
         perpNo:['perpendicular to both lines', 'is the distance'], slantYes:['slanted', 'not the distance'], skew:['no right angle', 'not parallel'], cross:['A', 'perpendicular', 'not parallel'], bing:['perpendicular', 'not parallel'] }
  };
  LANGS.forEach(L => {
    const d = I18N[L], S = SAYS[L];
    has('gSlideWhy.below ' + L, d.gSlideWhy.below, S.below);
    ['right', 'left'].forEach(dir => { has('gSlideWhy.other ' + L, d.gSlideWhy.other(dir), S.other); has('gSlideWhy.other(' + dir + ') ' + L, d.gSlideWhy.other(dir), [L === 'zh' ? (dir === 'right' ? '右' : '左') : dir]); });
    lacks('gSlideWhy.other(right) ' + L, d.gSlideWhy.other('right'), [L === 'zh' ? '往<strong>左' : 'to the <strong>left']);
    has('gStrWhy ' + L, d.gStrWhy, S.str);
    has('gStepsWhy.moveRuler ' + L, d.gStepsWhy.moveRuler, S.moveRuler); has('gStepsWhy.turn ' + L, d.gStepsWhy.turn, S.turn);
    has('gWidthWhy.perpNo ' + L, d.gWidthWhy.perpNo(2, 4), S.perpNo.concat(['2', '4']));
    has('gWidthWhy.slantYes ' + L, d.gWidthWhy.slantYes(3, 5, 4), S.slantYes.concat(['3', '5', '4']));
    ['skew', 'cross', 'bing'].forEach(k => has('gRelWhy.' + k + ' ' + L, d.gRelWhy[k], S[k]));
    /* 排步驟：每一張卡、每一種放錯都有一句；只會太晚的（第一步）、只會太早的（最後一步）各一句 */
    STEP_KEYS_GAME.forEach((c, i) => {
      if (i > 0) textOk('gStepsWhy.' + c + '.early ' + L, d.gStepsWhy[c] && d.gStepsWhy[c].early);
      if (i < 3) textOk('gStepsWhy.' + c + '.late ' + L, d.gStepsWhy[c] && d.gStepsWhy[c].late);
      textOk('gStepsCard.' + c + ' ' + L, d.gStepsCard[c]);
    });
    DECOY_KEYS_GAME.forEach(c => { textOk('gStepsWhy.' + c + ' ' + L, d.gStepsWhy[c]); textOk('gStepsCard.' + c + ' ' + L, d.gStepsCard[c]); });
    if (new Set(STEP_KEYS_GAME.concat(DECOY_KEYS_GAME).map(c => d.gStepsCard[c])).size !== 6) fail('gStepsCard ' + L + ': two cards say the same thing');
    ['gSlideOk', 'gStepsOk', 'gStepsDone', 'gWidthOk', 'gRelOk', 'gRelDone', 'gSlide2now', 'gStr2now', 'gStrMeter'].forEach(k => textOk(k + ' ' + L, d[k]));
    textOk('gSlideNow ' + L, d.gSlideNow(true)); textOk('gSlideNow ' + L, d.gSlideNow(false));
    if (numsIn(d.gStrNow(7)).indexOf(7) < 0) fail('gStrNow ' + L + ' does not show the distance');
    if (numsIn(d.gStrOk(7)).filter(n => n === 7).length !== 2) fail('gStrOk ' + L + ' should say the distance twice (cm and squares): ' + d.gStrOk(7));
    if (numsIn(d.gWidthDone(3)).filter(n => n === 3).length !== 2) fail('gWidthDone ' + L + ' should say the gap twice: ' + d.gWidthDone(3));
    if (numsIn(d.gWidth2(4)).filter(n => n === 4).length !== 2) fail('gWidth2 ' + L + ' should say the gap twice: ' + d.gWidth2(4));
    if (numsIn(d.gWidthCard(2, 5)).join() !== '2,5') fail('gWidthCard ' + L + ' should show the number then the length: ' + d.gWidthCard(2, 5));
    if (numsIn(d.gSlide2('right', 3)).join() !== '3' || numsIn(d.gStr2('up', 2)).join() !== '2') fail('second-level hints ' + L + ' do not show the count');
    if (numsIn(d.gRel2(2)).join() !== '2') fail('gRel2 ' + L + ' does not show how many are left');
    if (numsIn(d.gSteps2(3, 'x')).join() !== '3') fail('gSteps2 ' + L + ' does not name the step number');
    has('gRelName ' + L, d.gRelName.jia + d.gRelName.bing, L === 'zh' ? ['甲', '丙'] : ['A', 'C']);
  });

  /* ================= 第 1 關：滑三角板 ================= */
  {
    const G = D.SLIDE_G;
    touch('the set square grip', G.knob);
    if (!(Array.isArray(D.GAME_SLIDE) && D.GAME_SLIDE.length >= 3)) fail('GAME_SLIDE should hold at least 3 cases');
    D.GAME_SLIDE.forEach((e, ci) => {
      const tag = 'slide case ' + ci;
      const stops = []; for (let i = 0; i < e.n; i++) stops.push([e.v0[0] + i * e.d[0], e.v0[1] + i * e.d[1]]);
      if (!(e.d[0] !== 0 && e.d[1] !== 0)) fail(tag + ': the blue line is not slanted');
      if (!(e.d[0] > 0)) fail(tag + ': d must point right (the "slide left / right" words depend on it)');
      /* 自己的垂足：紅點和停車點的連線和藍線垂直（整數內積 0） */
      const dot = D.slideDot(e);
      const own = stops.map(s => dotI([dot[0] - s[0], dot[1] - s[1]], e.d) === 0 ? 'ok' : (s[0] === dot[0] ? 'below' : 'other'));
      if (own.filter(k => k === 'ok').length !== 1 || own.indexOf('ok') !== e.foot) fail(tag + ': the foot of the perpendicular is not stop ' + e.foot + ' by own geometry (' + own + ')');
      if (own.filter(k => k === 'below').length !== 1) fail(tag + ': no stop straight below the red dot — the "perpendicular = straight down" misconception is never tested');
      if (dot[1] <= stops[own.indexOf('below') >= 0 ? own.indexOf('below') : 0][1]) fail(tag + ': the red dot is not above the "below" stop');
      if (own[e.start] !== 'other') fail(tag + ': the set square must start on a stop that is neither the answer nor straight below');
      if (dotI([dot[0] - stops[e.foot][0], dot[1] - stops[e.foot][1]], [-e.d[1], e.d[0]]) <= 0) fail(tag + ': the dot is not on the side the other edge points to');
      stops.forEach((s, i) => {
        const want = own[i] === 'ok' ? 'ok' : i === e.start ? 'start' : own[i];
        if (D.slideKind(e, i) !== want) fail(tag + ' stop ' + i + ': slideKind says ' + D.slideKind(e, i) + ', own geometry says ' + want);
        const dirWant = s[0] < stops[e.foot][0] ? 'right' : 'left';
        if (i !== e.foot && D.slideDir(e, i) !== dirWant) fail(tag + ' stop ' + i + ': slideDir says ' + D.slideDir(e, i) + ', the foot is to the ' + dirWant);
        /* 三角板：直角頂點在停車點、一條邊在藍線上、另一條和它垂直、長到穿過紅點、整塊在畫板裡、手柄在三角板裡 */
        const t = D.slideTri(e, i), V = t[0];
        if (V[0] !== s[0] || V[1] !== s[1]) fail(tag + ' stop ' + i + ': the set square corner is not on the stop');
        const e1 = [t[1][0] - V[0], t[1][1] - V[1]], e2 = [t[2][0] - V[0], t[2][1] - V[1]];
        if (Math.abs(crossI(e1, e.d)) > 1e-9) fail(tag + ' stop ' + i + ': one edge is not on the blue line');
        if (Math.abs(dotI(e1, e2)) > 1e-9 || Math.abs(Math.hypot(...e1) - Math.hypot(...e2)) > 1e-9) fail(tag + ' stop ' + i + ': the set square is not a 45-45-90 right triangle');
        if (Math.hypot(...e2) <= Math.hypot(dot[0] - stops[e.foot][0], dot[1] - stops[e.foot][1])) fail(tag + ': the other edge is too short to reach the red dot');
        t.forEach(g => { const p = px(G, g); if (p.x < 2 || p.x > W - 2 || p.y < 2 || p.y > G.H - 2) fail(tag + ' stop ' + i + ': the set square leaves the board'); });
        const gp = D.slideGrip(e, i), P = t.map(g => px(G, g));
        const sgn = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const s1 = sgn(P[0], P[1], gp), s2 = sgn(P[1], P[2], gp), s3 = sgn(P[2], P[0], gp);
        if (!((s1 > 0 && s2 > 0 && s3 > 0) || (s1 < 0 && s2 < 0 && s3 < 0))) fail(tag + ' stop ' + i + ': the grip is not inside the set square');
        inside(box(gp.x, gp.y, G.knob, G.knob), tag + ' stop ' + i + ' grip', G.H);
        if (D.slideIdxFromGrip(e, gp.x, gp.y) !== i) fail(tag + ' stop ' + i + ': the grip position does not map back to its own stop');
      });
      { const p = px(G, dot); if (p.x < 8 || p.x > W - 8 || p.y < 8 || p.y > G.H - 8) fail(tag + ': the red dot is off the board'); }
      const c = clipRef(G.cols, G.rows, e.v0, e.d);
      if (!c) fail(tag + ': the blue line is not on the paper');
      /* 每一個停車點自己一段：沿著藍線每 0.5px、離線 ±band 掃，和自己「最近的停車點」比 */
      const a = px(G, stops[0]), z = px(G, stops[e.n - 1]), Lp = Math.hypot(z.x - a.x, z.y - a.y), ux = (z.x - a.x) / Lp, uy = (z.y - a.y) / Lp, sp = Lp / (e.n - 1);
      for (let t = -0.45 * sp; t <= Lp + 0.45 * sp; t += 0.5) for (const off of [-G.band + 0.5, 0, G.band - 0.5]){
        const q = { x:a.x + ux * t - uy * off, y:a.y + uy * t + ux * off };
        let best = 0, bd = Infinity; stops.forEach((s, i) => { const p = px(G, s), dd = Math.abs((q.x - p.x) * ux + (q.y - p.y) * uy); if (dd < bd - 1e-9){ bd = dd; best = i; } });
        if (Math.abs(bd - sp / 2) < 0.6) continue;   /* 正好在兩個停車點中間：哪一邊都可以 */
        if (D.slideIdx(e, q.x, q.y) !== best) return fail(tag + ': a point ' + t.toFixed(1) + 'px along the line maps to stop ' + D.slideIdx(e, q.x, q.y) + ', nearest is ' + best);
        if (!D.slideOnLine(e, q.x, q.y)) return fail(tag + ': a point on the line (' + t.toFixed(1) + 'px, ' + off + 'px off) is not accepted as a tap on the line');
      }
      { const p = px(G, dot); if (D.slideOnLine(e, p.x, p.y)) fail(tag + ': tapping the red dot counts as tapping the line'); }
      if (D.slideOnLine(e, a.x - uy * (G.band + 3), a.y + ux * (G.band + 3))) fail(tag + ': a tap ' + (G.band + 3) + 'px off the line still counts');
    });
  }

  /* ================= 第 2 關：拉繩子 ================= */
  {
    const G = D.STR_G;
    touch('the string knob', G.knob);
    if (!(Array.isArray(D.GAME_STRING) && D.GAME_STRING.length >= 3)) fail('GAME_STRING should hold at least 3 cases');
    if (!D.GAME_STRING.some(e => e.axis === 'v') || !D.GAME_STRING.some(e => e.axis === 'h')) fail('GAME_STRING should have both across and upright lines (the perpendicular is not always "straight down")');
    D.GAME_STRING.forEach((e, ci) => {
      const tag = 'string case ' + ci, Dl = e.axis === 'h' ? [1, 0] : [0, 1];
      const pg = s => e.axis === 'h' ? [s, e.at] : [e.at, s];
      const lens = []; let foot = null;
      for (let s = e.lo; s <= e.hi; s++){
        const q = pg(s), v = [e.p[0] - q[0], e.p[1] - q[1]];
        if (dotI(v, Dl) === 0){ if (foot !== null) fail(tag + ': two feet'); foot = s; }
        lens.push([s, Math.hypot(v[0], v[1])]);
        if (Math.abs(D.strLen(e, s) - Math.hypot(v[0], v[1])) > 1e-9) fail(tag + ' peg ' + s + ': strLen disagrees with own length');
        const want = foot === s ? 'ok' : s === e.start ? 'start' : 'slant';
        if (D.strKind(e, s) !== want) fail(tag + ' peg ' + s + ': strKind says ' + D.strKind(e, s) + ', expected ' + want);
      }
      if (foot === null) return fail(tag + ': the foot of the perpendicular is not on a peg');
      if (foot !== D.strFoot(e)) fail(tag + ': strFoot is not the own foot ' + foot);
      if (e.start === foot) fail(tag + ': the string starts on the answer');
      const dist = Math.hypot(e.p[0] - pg(foot)[0], e.p[1] - pg(foot)[1]);
      if (dist !== Math.round(dist) || D.strDist(e) !== dist) fail(tag + ': the distance ' + dist + ' is not a whole number of cm or disagrees with strDist');
      if (!lens.every(([s, l]) => s === foot || l > dist + 1e-9)) fail(tag + ': the perpendicular one is not the unique shortest');
      if (Math.abs(foot - e.start) < 3) fail(tag + ': the start is too close to the foot to tell by eye');
      for (let s = e.lo; s <= e.hi; s++) if (s !== foot && D.strDir(e, s) !== (e.axis === 'h' ? (foot > s ? 'right' : 'left') : (foot > s ? 'up' : 'down'))) fail(tag + ' peg ' + s + ': strDir is wrong');
      [pg(e.lo), pg(e.hi), e.p].forEach(g => { if (g[0] < 0 || g[0] > G.cols || g[1] < 0 || g[1] > G.rows) fail(tag + ': ' + g + ' is off the paper'); });
      for (let s = e.lo; s <= e.hi; s++) inside(box(px(G, pg(s)).x, px(G, pg(s)).y, G.knob, G.knob), tag + ' knob at peg ' + s, G.H);
      /* 每一個格點自己一格：沿著 L 每 0.5px 掃 */
      const a = px(G, pg(e.lo)), z = px(G, pg(e.hi));
      for (let t = -0.45 * G.u; t <= Math.hypot(z.x - a.x, z.y - a.y) + 0.45 * G.u; t += 0.5) for (const off of [-G.band + 0.5, 0, G.band - 0.5]){
        const q = e.axis === 'h' ? { x:a.x + t, y:a.y + off } : { x:a.x + off, y:a.y - t };
        let best = null, bd = Infinity;
        for (let s = e.lo; s <= e.hi; s++){ const p = px(G, pg(s)), dd = e.axis === 'h' ? Math.abs(q.x - p.x) : Math.abs(q.y - p.y); if (dd < bd - 1e-9){ bd = dd; best = s; } }
        if (Math.abs(bd - G.u / 2) < 0.6) continue;
        if (D.strIdx(e, q.x, q.y) !== best) return fail(tag + ': a point ' + t + 'px along L maps to peg ' + D.strIdx(e, q.x, q.y) + ', nearest is ' + best);
        if (!D.strOnLine(e, q.x, q.y)) return fail(tag + ': a point on L (' + t + 'px, ' + off + 'px off) is not accepted as a tap on L');
      }
      { const p = px(G, e.p); if (D.strOnLine(e, p.x, p.y)) fail(tag + ': tapping P counts as tapping L'); }
      /* 名字牌 L 整塊都算點到 L（natural-action rule）；名字牌在畫板裡、不壓到 P */
      {
        const lb = D.strLabel(e), p = px(G, e.p);
        inside(lb, tag + ' the name L', G.H);
        for (let x = lb.x; x <= lb.x + lb.w; x += 1) for (let y = lb.y; y <= lb.y + lb.h; y += 1) if (!D.strOnLine(e, x, y)){ fail(tag + ': tapping the name L at (' + x + ', ' + y + ') does not count as tapping L'); x = Infinity; break; }
        if (boxDistRef(p.x, p.y, lb) < 20) fail(tag + ': the name L sits on P');
        for (let s = e.lo; s <= e.hi; s++){ const q = px(G, pg(s)); if (hit(box(q.x, q.y, G.knob, G.knob), lb)) fail(tag + ': the string knob at peg ' + s + ' covers the name L (a tap on the name would hit the knob)'); }
      }
    });
  }

  /* ================= 第 3 關：排步驟 ================= */
  {
    const G = D.STEPS_G;
    if (D.GAME_STEPS.join() !== STEP_KEYS_GAME.join()) fail('GAME_STEPS should be ' + STEP_KEYS_GAME + ' (example 3, in order)');
    if (D.GAME_STEPS_DECOY.join() !== DECOY_KEYS_GAME.join()) fail('GAME_STEPS_DECOY should be ' + DECOY_KEYS_GAME);
    STEP_KEYS_GAME.concat(DECOY_KEYS_GAME).forEach(c => [0, 1, 2, 3].forEach(j => {
      const k = STEP_KEYS_GAME.indexOf(c), want = k < 0 ? 'decoy' : k === j ? 'ok' : k > j ? 'early' : 'late';
      if (D.stepsKind(c, j) !== want) fail('stepsKind(' + c + ', ' + j + ') is ' + D.stepsKind(c, j) + ', expected ' + want);
    }));
    touch('a step card', Math.min(G.card.w, G.card.h));
    const slots = [0, 1, 2, 3].map(j => D.stepsSlot(j));
    slots.forEach((b, j) => inside(b, 'step slot ' + (j + 1), G.H));
    noHits(slots.map((b, j) => ['slot ' + (j + 1), b]), 'step slots');
    const cards = G.tray.map((t, i) => ['tray card ' + i, box(t[0], t[1], G.card.w, G.card.h)]);
    if (cards.length !== 6) fail('the steps tray should have 6 places');
    cards.forEach(c => inside(c[1], c[0], G.H));
    noHits(cards, 'step tray');
    const pad = G.slot.pad, zone = b => ({ x:b.x - pad, y:b.y - pad, w:b.w + 2 * pad, h:b.h + 2 * pad });
    cards.forEach(c => slots.forEach((b, j) => { if (hit(c[1], zone(b))) fail(c[0] + ' sits inside the snap zone of slot ' + (j + 1)); }));
    inside({ x:0, y:0, w:G.fig.w, h:G.fig.h }, 'the steps figure', G.H);
    if (G.fig.h > slots[0].y - pad) fail('the steps figure runs into slot 1');
    /* 最近的那一格：整個畫板每 1px 掃，和自己的「在吸附範圍裡、到方框最近」比；吸附範圍要真的重疊（不然 nearest 沒被考到） */
    let overlap = 0;
    for (let x = 0; x <= W; x += 1) for (let y = 0; y <= G.H; y += 1){
      let best = -1, bd = Infinity, inZ = 0;
      slots.forEach((b, j) => { if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad){ inZ++; const dd = boxDistRef(x, y, b); if (dd < bd){ bd = dd; best = j; } } });
      if (inZ > 1) overlap++;
      if (D.stepsNearest(x, y) !== best){ fail('stepsNearest(' + x + ', ' + y + ') is ' + D.stepsNearest(x, y) + ', the nearest slot is ' + best); x = W + 1; break; }
    }
    if (!overlap) fail('the slots\' snap zones never overlap, so "nearest slot" is never exercised');
    /* 上面那張圖：0 步只有直線和點；1～4 步是範例 3 的第 0～3 步（三角板、加直尺、滑過去、畫好） */
    const pl = [0, 1, 2, 3, 4].map(m => D.stepsPlan(m));
    if (pl[0].polys.length !== 0 || pl[0].lines.length !== 1 || pl[0].dots.length !== 1) fail('steps figure 0 should show only the line and the dot');
    if (pl[1].polys.length !== 1 || pl[2].polys.length !== 2 || pl[3].polys.length !== 2 || pl[4].polys.length !== 2) fail('steps figures 1–4 should add the set square, then the ruler');
    if (pl[4].lines.length !== 2 || pl[3].lines.length !== 1) fail('the parallel line should appear only in steps figure 4');
    else {
      const L0 = pl[4].lines[0], L1 = pl[4].lines[1], u = [L0.b.x - L0.a.x, L0.b.y - L0.a.y], v = [L1.b.x - L1.a.x, L1.b.y - L1.a.y];
      if (Math.abs(crossI(u, v)) / (Math.hypot(...u) * Math.hypot(...v)) > 1e-9) fail('steps figure 4: the drawn line is not parallel to the blue line');
      const pt = pl[4].dots[0].p, w = [pt.x - L1.a.x, pt.y - L1.a.y];
      if (Math.abs(crossI(v, w)) / Math.hypot(...v) > 1e-6) fail('steps figure 4: the drawn line does not go through the red dot');
    }
    /* 滑過去：第 3 張圖的三角板和第 2 張的一樣大、一樣方向（只是平移），直尺沒動 */
    {
      const t2 = pl[2].polys.filter(p => p.kind === 'tool')[0], t3 = pl[3].polys.filter(p => p.kind === 'tool')[0];
      const r2 = pl[2].polys.filter(p => p.kind === 'ruler')[0], r3 = pl[3].polys.filter(p => p.kind === 'ruler')[0];
      if (!t2 || !t3 || !r2 || !r3) fail('steps figures 2 and 3 should both show the set square and the ruler');
      else {
        const dx = t3.pts[0].x - t2.pts[0].x, dy = t3.pts[0].y - t2.pts[0].y;
        if (!t2.pts.every((p, i) => Math.abs(t3.pts[i].x - p.x - dx) < 1e-9 && Math.abs(t3.pts[i].y - p.y - dy) < 1e-9)) fail('steps: the set square turns between figure 2 and 3 — it must only slide');
        if (!r2.pts.every((p, i) => Math.abs(r3.pts[i].x - p.x) < 1e-9 && Math.abs(r3.pts[i].y - p.y) < 1e-9)) fail('steps: the ruler moves between figure 2 and 3 — the rail must stay still');
        const rl = [r2.pts[1].x - r2.pts[0].x, r2.pts[1].y - r2.pts[0].y];
        if (Math.abs(crossI(rl, [dx, dy])) / (Math.hypot(...rl) * Math.hypot(dx, dy)) > 1e-9) fail('steps: the set square does not slide along the ruler');
      }
    }
  }

  /* ================= 第 4 關：分一分 ================= */
  {
    const G = D.WIDTH_G;
    touch('a length card', Math.min(G.card.w, G.card.h));
    if (!(Array.isArray(D.GAME_WIDTH) && D.GAME_WIDTH.length >= 3)) fail('GAME_WIDTH should hold at least 3 cases');
    D.GAME_WIDTH.forEach((e, ci) => {
      const tag = 'width case ' + ci, lay = D.widthLayout(e), segs = D.widthSegs(e);
      if (segs.length !== 5) return fail(tag + ': five measurements expected');
      const own = segs.map(s => {
        const v = [s.b[0] - s.a[0], s.b[1] - s.a[1]];
        return { perp:dotI(v, [1, 0]) === 0, len:Math.hypot(v[0], v[1]), low:s.a[0] };
      });
      if (own.filter(o => o.perp).length !== 3) fail(tag + ': three perpendicular measurements expected');
      own.forEach((o, i) => {
        const s = segs[i];
        if (s.a[1] !== 1 || s.b[1] !== 1 + e.g) fail(tag + ' segment ' + s.no + ': does not run from one line to the other');
        if (o.len !== Math.round(o.len) || s.len !== o.len) fail(tag + ' segment ' + s.no + ': length ' + o.len + ' is not a whole cm or disagrees with the page (' + s.len + ')');
        if (o.perp !== s.isPerp) fail(tag + ' segment ' + s.no + ': isPerp disagrees with own geometry');
        if (o.perp ? o.len !== e.g : !(o.len > e.g)) fail(tag + ' segment ' + s.no + ': ' + (o.perp ? 'a perpendicular one does not measure the gap' : 'a slanted one is not longer than the gap'));
        if (D.widthWant(s) !== (o.perp ? 'yes' : 'no')) fail(tag + ' segment ' + s.no + ': widthWant is wrong');
        if (s.no !== i + 1 || (i && !(own[i - 1].low < o.low))) fail(tag + ': segments are not numbered left to right by their lower end');
        [s.a, s.b].forEach(g => { if (g[0] < 0 || g[0] > lay.cols || g[1] < 0 || g[1] > lay.rows) fail(tag + ' segment ' + s.no + ' leaves the paper'); });
      });
      const perpXs = own.filter(o => o.perp).map(o => o.low);
      if (Math.max(...perpXs) - Math.min(...perpXs) < 8) fail(tag + ': the perpendicular measurements are not spread out (they should be "in different places")');
      if (segs.filter(s => !s.isPerp).map(s => Math.sign(s.b[0] - s.a[0])).reduce((a, b) => a + b, 0) !== 0) fail(tag + ': the two slanted ones should lean opposite ways');
      /* 線段兩兩不相交（連端點都不碰） */
      for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++){
        const p = segs[i], q = segs[j], r = [p.b[0] - p.a[0], p.b[1] - p.a[1]], s = [q.b[0] - q.a[0], q.b[1] - q.a[1]], den = crossI(r, s);
        const w = [q.a[0] - p.a[0], q.a[1] - p.a[1]];
        if (den === 0){ if (crossI(w, r) === 0) fail(tag + ': segments ' + p.no + ' and ' + q.no + ' lie on one line'); continue; }
        const t = crossI(w, s) / den, u = crossI(w, r) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) fail(tag + ': segments ' + p.no + ' and ' + q.no + ' cross or touch');
      }
      /* 版面：編號牌、托盤、兩個箱子都在畫板裡、互不重疊；箱子裡的位置放得下 */
      const tags = segs.map(s => { const p = px(lay, s.a); return ['tag ' + s.no, { x:p.x - G.tag / 2, y:p.y + 6, w:G.tag, h:G.tag }]; });
      const tray = G.trayX.map((x, i) => ['tray card ' + i, box(x, lay.trayY, G.card.w, G.card.h)]);
      const all = tags.concat(tray, [['yes box', lay.yes], ['no box', lay.no]]);
      all.forEach(o => inside(o[1], tag + ' ' + o[0], lay.H));
      noHits(all, tag + ' layout');
      ['yes', 'no'].forEach(bin => {
        const n = bin === 'yes' ? 3 : 2, spots = [];
        for (let k = 0; k < n; k++){
          const q = D.widthSpot(lay, bin, k), c = box(q.x, q.y, G.card.w * G.placed, G.card.h * G.placed);
          if (!(c.x >= lay[bin].x && c.y >= lay[bin].y + 18 && c.x + c.w <= lay[bin].x + lay[bin].w && c.y + c.h <= lay[bin].y + lay[bin].h)) fail(tag + ': placed card ' + k + ' sticks out of the ' + bin + ' box');
          spots.push([bin + ' ' + k, c]);
        }
        noHits(spots, tag + ' ' + bin + ' box');
      });
      /* 哪一箱：中心優先，再看手指；兩箱外面是 null */
      for (let x = 0; x <= W; x += 2) for (let y = 0; y <= lay.H; y += 2){
        const inY = x >= lay.yes.x && x <= lay.yes.x + lay.yes.w && y >= lay.yes.y && y <= lay.yes.y + lay.yes.h;
        const inN = x >= lay.no.x && x <= lay.no.x + lay.no.w && y >= lay.no.y && y <= lay.no.y + lay.no.h;
        const want = inY ? 'yes' : inN ? 'no' : null;
        if (D.widthBin(lay, x, y) !== want){ fail(tag + ': widthBin(' + x + ', ' + y + ') is ' + D.widthBin(lay, x, y) + ', expected ' + want); x = W + 1; break; }
        if (!want && D.widthBin(lay, x, y, lay.yes.x + 5, lay.yes.y + 5) !== 'yes'){ fail(tag + ': a finger inside the yes box does not count when the card centre is outside'); x = W + 1; break; }
      }
    });
  }

  /* ================= 第 5 關：點出全部 ================= */
  {
    const G = D.REL_G;
    if (!(Array.isArray(D.GAME_REL) && D.GAME_REL.length >= 3)) fail('GAME_REL should hold at least 3 cases');
    D.GAME_REL.forEach((e, ci) => {
      const tag = 'rel case ' + ci, lines = D.relLines(e), n = [-e.d[1], e.d[0]];
      const byId = {}; lines.forEach(l => { byId[l.id] = l; });
      if (!(e.d[0] !== 0 && e.d[1] !== 0)) fail(tag + ': C is not slanted');
      const C = byId.bing, A = byId.jia;
      if (!C || !A || C.at.join() !== e.a.join() || dotI(A.dir, C.dir) !== 0) return fail(tag + ': A is not perpendicular to C');
      const same = (p, q) => crossI(p.dir, q.dir) === 0 && crossI([q.at[0] - p.at[0], q.at[1] - p.at[1]], p.dir) === 0;
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) if (same(lines[i], lines[j])) fail(tag + ': ' + lines[i].id + ' and ' + lines[j].id + ' are the same line');
      lines.forEach(l => {
        const want = l.id === 'jia' ? 'given' : l.id === 'bing' ? 'bing' : crossI(l.dir, A.dir) === 0 ? 'ok' : crossI(l.dir, C.dir) === 0 ? 'cross' : 'skew';
        if (D.relKind(l.id) !== want) fail(tag + ': relKind(' + l.id + ') is ' + D.relKind(l.id) + ', own geometry says ' + want);
        if (want === 'skew' && dotI(l.dir, C.dir) === 0) fail(tag + ': a decoy is perpendicular to C');
        const c = clipRef(G.cols, G.rows, l.at, l.dir);
        if (!c || Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]) < 3) fail(tag + ': line ' + l.id + ' shows less than 3 squares on the paper');
        /* 和丙的交點要在紙上（看得到那裡有沒有小方框）；cross 和甲的交點也要在紙上 */
        const other = want === 'cross' ? A : want === 'bing' ? null : C;
        if (other){
          const den = crossI(l.dir, other.dir), k = crossI([other.at[0] - l.at[0], other.at[1] - l.at[1]], other.dir) / den, X = [l.at[0] + k * l.dir[0], l.at[1] + k * l.dir[1]];
          if (X[0] < 0 || X[0] > G.cols || X[1] < 0 || X[1] > G.rows) fail(tag + ': where ' + l.id + ' crosses ' + (other === A ? 'A' : 'C') + ' is off the paper');
        }
      });
      const kinds = lines.map(l => D.relKind(l.id));
      if (kinds.filter(k => k === 'ok').length < 2 || kinds.filter(k => k === 'skew').length < 1 || kinds.filter(k => k === 'cross').length !== 1) fail(tag + ': needs ≥ 2 lines to find, ≥ 1 slanted decoy and the "box on A" decoy');
      /* 小方框：自己算所有在紙上的直角，和 relBoxes 一一對上 */
      const ownBoxes = [];
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++){
        const p = lines[i], q = lines[j];
        if (dotI(p.dir, q.dir) !== 0) continue;
        const den = crossI(p.dir, q.dir), k = crossI([q.at[0] - p.at[0], q.at[1] - p.at[1]], q.dir) / den, X = [p.at[0] + k * p.dir[0], p.at[1] + k * p.dir[1]];
        if (X[0] >= 0 && X[0] <= G.cols && X[1] >= 0 && X[1] <= G.rows) ownBoxes.push(X.map(v => v.toFixed(6)).join());
      }
      const pageBoxes = D.relBoxes(e).map(b => b.at.map(v => v.toFixed(6)).join());
      if (ownBoxes.slice().sort().join('|') !== pageBoxes.slice().sort().join('|')) fail(tag + ': the right-angle boxes (' + pageBoxes.length + ') are not exactly the right angles on the paper (' + ownBoxes.length + ')');
      /* 名字牌：在畫板裡、貼著自己的線 */
      const segPx = l => { const c = clipRef(G.cols, G.rows, l.at, l.dir); return [px(G, c[0]), px(G, c[1])]; };
      ['jia', 'bing'].forEach(id => {
        const q = D.relLabel(e, id), h = G.label / 2;
        inside({ x:q.x - h, y:q.y - h, w:G.label, h:G.label }, tag + ' name ' + id, G.H);
        const s = segPx(byId[id]);
        if (segDistRef(q, s[0], s[1]) > 20) fail(tag + ': the name of ' + id + ' is not next to its line');
      });
      /* 點哪裡算哪一條：整個畫板每 1px，和自己的「名字牌，否則 band 以內最近的線」比 */
      const segs = lines.map(l => [l.id, segPx(l)]);
      for (let x = 0; x <= W; x += 1) for (let y = 0; y <= G.H; y += 1){
        let want = null;
        for (const id of ['bing', 'jia']){ const q = D.relLabel(e, id); if (Math.abs(x - q.x) <= G.label / 2 && Math.abs(y - q.y) <= G.label / 2){ want = id; break; } }
        if (!want){
          let bd = Infinity;
          segs.forEach(([id, s]) => { const dd = segDistRef({ x:x, y:y }, s[0], s[1]); if (dd <= G.band && dd < bd - 1e-9){ bd = dd; want = id; } });
        }
        const got = D.relHit(e, x, y);
        if (got !== want){
          /* 正好一樣近（兩條線的交點附近）：誰都可以 */
          const dd = id => { const s = segs.filter(z => z[0] === id)[0]; return s ? segDistRef({ x:x, y:y }, s[1][0], s[1][1]) : Infinity; };
          if (got && want && Math.abs(dd(got) - dd(want)) < 1e-6) continue;
          fail(tag + ': relHit(' + x + ', ' + y + ') is ' + got + ', expected ' + want); x = W + 1; break;
        }
      }
      /* 交點上（一樣近）：算畫在最上面（最後畫）的那一條 —— 孩子點的是看得到的那一條（codex 第一輪） */
      for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++){
        const p = lines[i], q = lines[j], den = crossI(p.dir, q.dir);
        if (den === 0) continue;
        const k = crossI([q.at[0] - p.at[0], q.at[1] - p.at[1]], q.dir) / den, X = [p.at[0] + k * p.dir[0], p.at[1] + k * p.dir[1]];
        if (X[0] < 0 || X[0] > G.cols || X[1] < 0 || X[1] > G.rows) continue;
        const Xp = px(G, X);
        if (['bing', 'jia'].some(id => { const q2 = D.relLabel(e, id); return Math.abs(Xp.x - q2.x) <= G.label / 2 && Math.abs(Xp.y - q2.y) <= G.label / 2; })) continue;
        let top = null;
        segs.forEach(([id, s]) => { if (segDistRef(Xp, s[0], s[1]) < 1e-6) top = id; });
        if (D.relHit(e, Xp.x, Xp.y) !== top) fail(tag + ': at the crossing of ' + p.id + ' and ' + q.id + ' relHit picks ' + D.relHit(e, Xp.x, Xp.y) + ', the line drawn on top is ' + top);
      }
      /* 每一條要找的線，至少有一大段（≥ 2 格）點下去一定是它（不被別條線或名字牌搶走） */
      lines.filter(l => D.relKind(l.id) === 'ok').forEach(l => {
        const s = segPx(l); let run = 0, bestRun = 0;
        for (let f = 0; f <= 1; f += 0.01){
          const q = { x:s[0].x + (s[1].x - s[0].x) * f, y:s[0].y + (s[1].y - s[0].y) * f };
          if (D.relHit(e, q.x, q.y) === l.id){ run++; bestRun = Math.max(bestRun, run); } else run = 0;
        }
        if (bestRun * 0.01 * Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y) < 2 * G.u) fail(tag + ': line ' + l.id + ' has no clear stretch of 2 squares to tap');
      });
    });
  }
}

/* 理由句子的指紋（兩種語言）：改了任何一句就要重新逐句確認，再更新這裡 */
const GAME_WHY_FP = '5052f62ed5167b9963ed341fe099a3b518f33f5e';
/* 整段遊戲程式的指紋：改了就要重跑 e2e 與改壞頁 */
const GAME_CODE_FP = 'e634bf9a0e5f353a95c8df0000d7224ec7d12a6c';

const GAME_BREAKS = [
  { file:'index', via:'index', expect:"the game code changed",
    find:"        roundSolved(d.gSlideOk);\n        return true;",
    replace:"        roundSolved(d.gSlideOk);\n        return\n        true;",
    why:"codex r2: a whitespace-only edit that changes meaning (automatic semicolon insertion) must still be caught" },
  { file:'index', via:'index', expect:"the game code changed",
    find:"        var k = slideKind(e, i);\n",
    replace:"        var k = slideKind(e, i); if (k === 'below') k = 'ok';\n",
    why:"codex r1: the handler overrides the pure rule — straight-below accepted" },
  { file:'index', via:'index', expect:"the game code changed",
    find:"        var k = strKind(e, s);\n",
    replace:"        var k = strKind(e, s); if (k === 'slant') k = 'ok';\n",
    why:"codex r1: every slanted peg accepted inside the handler" },
  { file:'index', via:'index', expect:"the game code changed",
    find:"data:{ card:c } });",
    replace:"data:{ card:GAME_STEPS[0] } });",
    why:"codex r1: the visible card and the judged card differ" },
  { file:'index', via:'index', expect:"the game code changed",
    find:"addZone(B, lay.no.x, lay.no.y, lay.no.w, lay.no.h, 'gbin no',",
    replace:"addZone(B, lay.yes.x, lay.yes.y, lay.no.w, lay.no.h, 'gbin no',",
    why:"codex r1: the drawn boxes overlap while widthLayout() is untouched" },
  { file:'index', via:'index', expect:"the game code changed",
    find:"drawn[l.id] = gFullLine(svg, G, l.at, l.dir, color,",
    replace:"drawn[l.id] = gFullLine(svg, G, l.at, e.d, color,",
    why:"codex r1: the picture is drawn with different directions than the hit test" },
  { file:'index', via:'index', expect:"the game code changed",
    find:"  function roundMiss(text){\n",
    replace:"  function roundMiss(text){ text = String(text).replace('沒有通過紅點', '通過紅點');\n",
    why:"codex r1: the displayed reason is rewritten after the I18N fingerprint" },
  { file:'index', via:'index', expect:"the game code changed",
    find:"    function onDocEnd(e){ end(e, true); }",
    replace:"    function onDocEnd(e){ end({ pointerId:-1 }, true); }",
    why:"codex r1: the document-level release never reaches end()" },
  { file:'index', via:'index', expect:"the game code changed",
    find:"    var avail = gameStage.clientWidth || W;",
    replace:"    var avail = (gameStage.clientWidth || W) - 80;",
    why:"codex r1: the board shrinks, touch targets fall under 44px" },
  { file:'index', via:'index', expect:"the line drawn on top",
    find:"    for (var i = lines.length - 1; i >= 0; i--){\n      var l = lines[i], c = gClip(REL_G, l.at, l.dir);",
    replace:"    for (var i = 0; i < lines.length; i++){\n      var l = lines[i], c = gClip(REL_G, l.at, l.dir);",
    why:"codex r1: at a crossing the line under the visible one would win" },
  { file:'index', via:'index', expect:"does not count as tapping L",
    find:"    if (inBox(strLabel(e), x, y)) return true;\n",
    replace:"",
    why:"codex r1: tapping the name L would be silently ignored" },
  { file:'index', via:'index', expect:"slideKind says",
    find:"    if (slideStop(e, i)[0] === slideDot(e)[0]) return 'below';   /* 直角頂點在紅點正下方 */",
    replace:"    if (slideStop(e, i)[0] === slideDot(e)[0]) return 'ok';   /* 直角頂點在紅點正下方 */",
    why:"the stop straight below the dot would be accepted (perpendicular = straight down)" },
  { file:'index', via:'index', expect:"the foot of the perpendicular is not stop",
    find:"  function slideDot(e){ var f = slideStop(e, e.foot); return [f[0] - 2 * e.d[1], f[1] + 2 * e.d[0]]; }",
    replace:"  function slideDot(e){ var f = slideStop(e, e.foot); return [f[0] - 2 * e.d[1], f[1] + 3 * e.d[0]]; }",
    why:"the red dot would not be on the perpendicular through the keyed stop — no stop would draw a perpendicular through it" },
  { file:'index', via:'index', expect:"not slanted",
    find:"    { v0:[5, 3], d:[2, 1],  n:5, foot:3, side:-1, start:0 },",
    replace:"    { v0:[5, 3], d:[2, 0],  n:5, foot:3, side:-1, start:0 },",
    why:"an across blue line makes the perpendicular straight up — the misconception round would teach it" },
  { file:'index', via:'index', expect:"maps to stop",
    find:"    return Math.max(0, Math.min(e.n - 1, Math.round(t)));\n  }\n  /* 手柄的位置",
    replace:"    return Math.max(0, Math.min(e.n - 1, Math.floor(t)));\n  }\n  /* 手柄的位置",
    why:"a stop would not own the half-spacing on each side of it" },
  { file:'index', via:'index', expect:"tapping the red dot counts",
    find:"    return off <= SLIDE_G.band && t >= -0.5 && t <= e.n - 0.5;",
    replace:"    return t >= -0.5 && t <= e.n - 0.5;",
    why:"a tap anywhere (even on the red dot) would move the set square — tapping the dot would solve the round" },
  { file:'index', via:'index', expect:"missing or out of order",
    find:"        if (k === 'below'){ roundMiss(d.gSlideWhy.below); return false; }",
    replace:"        if (k === 'below') return false;",
    why:"straight-below would bounce silently instead of explaining the misconception" },
  { file:'index', via:'index', expect:"slideDir says",
    find:"  function slideDir(e, i){ return (e.foot - i) * e.d[0] > 0 ? 'right' : 'left'; }",
    replace:"  function slideDir(e, i){ return (e.foot - i) * e.d[0] > 0 ? 'left' : 'right'; }",
    why:"the reason would send the child the wrong way" },
  { file:'index', via:'index', expect:"under 44",
    find:"  var SLIDE_G = { H:250, u:20, ox:10, oy:240, cols:14, rows:11, leg:5, knob:48,",
    replace:"  var SLIDE_G = { H:250, u:20, ox:10, oy:240, cols:14, rows:11, leg:5, knob:40,",
    why:"the grip would be under 44px on a phone" },
  { file:'index', via:'index', expect:"maps to peg",
    find:"    return Math.max(e.lo, Math.min(e.hi, Math.round(s)));",
    replace:"    return Math.max(e.lo, Math.min(e.hi, Math.floor(s)));",
    why:"a peg would not own its own cell" },
  { file:'index', via:'index', expect:"tapping P counts",
    find:"    return segDist(x, y, a, b) <= STR_G.band + 0.5 * STR_G.u &&",
    replace:"    return true || segDist(x, y, a, b) <= STR_G.band + 0.5 * STR_G.u &&",
    why:"a tap anywhere would move the string end" },
  { file:'index', via:'index', expect:"starts on the answer",
    find:"    { axis:'h', at:1,  p:[6, 7],  lo:1, hi:13, start:12 },",
    replace:"    { axis:'h', at:1,  p:[6, 7],  lo:1, hi:13, start:6 },",
    why:"the string would start already solved" },
  { file:'index', via:'index', expect:"is not on a peg",
    find:"    { axis:'h', at:2,  p:[9, 10], lo:1, hi:13, start:2 },",
    replace:"    { axis:'h', at:2,  p:[19, 10], lo:1, hi:13, start:2 },",
    why:"the foot would be off the pegs, so no peg is the shortest" },
  { file:'index', via:'index', expect:"stepsNearest(",
    find:"      if (dd < bd){ bd = dd; best = j; }\n    }\n    return best;",
    replace:"      if (best < 0){ bd = dd; best = j; }\n    }\n    return best;",
    why:"the first slot in array order would win in an overlap" },
  { file:'index', via:'index', expect:"never overlap",
    find:"slot:{ x:6, w:288, h:46, y0:204, gap:54, pad:8 },",
    replace:"slot:{ x:6, w:288, h:46, y0:204, gap:54, pad:2 },",
    why:"with no overlap nearest-slot is never exercised" },
  { file:'index', via:'index', expect:"stepsKind(",
    find:"    if (GAME_STEPS_DECOY.indexOf(card) >= 0) return 'decoy';",
    replace:"    if (GAME_STEPS_DECOY.indexOf(card) >= 0) return 'ok';",
    why:"a decoy card (move the ruler / turn 90°) would be accepted" },
  { file:'index', via:'index', expect:"not shuffled",
    find:"order = shuffle([0, 1, 2, 3]);",
    replace:"order = [0, 1, 2, 3];",
    why:"the step cards would start in the answer order" },
  { file:'index', via:'index', expect:"missing or out of order",
    find:"        if (j < 0 || filled[j]) return false;",
    replace:"        if (j < 0) return false;",
    why:"a card dropped on a filled slot would be judged" },
  { file:'index', via:'index', expect:"steps figure",
    find:"    return paraPlan(m - 1);",
    replace:"    return paraPlan(m);",
    why:"the picture would run one step ahead of the cards" },
  { file:'index', via:'index', expect:"widthWant is wrong",
    find:"  function widthWant(seg){ return seg.isPerp ? 'yes' : 'no'; }",
    replace:"  function widthWant(seg){ return 'yes'; }",
    why:"slanted measurements would count as the distance" },
  { file:'index', via:'index', expect:"is not a whole cm",
    find:"    { g:4, perp:[1, 7, 13], slant:[[3, 3], [11, -3]] },",
    replace:"    { g:4, perp:[1, 7, 13], slant:[[3, 2], [11, -3]] },",
    why:"a slanted card would show a rounded length" },
  { file:'index', via:'index', expect:"a finger inside the yes box",
    find:"    if (fx !== undefined && inBox(lay.yes, fx, fy)) return 'yes';\n",
    replace:"",
    why:"a card picked up by its edge with the finger in the box would bounce" },
  { file:'index', via:'index', expect:"overlap",
    find:"bin:{ w:144, h:156, gap:4,",
    replace:"bin:{ w:144, h:156, gap:-20,",
    why:"the two boxes would overlap" },
  { file:'index', via:'index', expect:"right-angle boxes",
    find:"      if (p.dir[0] * q.dir[0] + p.dir[1] * q.dir[1] !== 0) continue;",
    replace:"      if (p.dir[0] * q.dir[0] + p.dir[1] * q.dir[1] !== 0 || (p.id !== 'bing' && q.id !== 'bing')) continue;",
    why:"right angles off C would have no box, so 'no box = no right angle' would be false" },
  { file:'index', via:'index', expect:"relKind(cross)",
    find:"    if (id === 'cross') return 'cross';",
    replace:"    if (id === 'cross') return 'ok';",
    why:"the line perpendicular to A would count as parallel to A" },
  { file:'index', via:'index', expect:"relHit(",
    find:"      if (dd <= REL_G.band && dd < bd - 1e-6){ bd = dd; best = l.id; }   /* 小於一百萬分之一像素的差距算一樣近 */",
    replace:"      if (dd <= REL_G.band && best === null){ bd = dd; best = l.id; }   /* 小於一百萬分之一像素的差距算一樣近 */",
    why:"near a crossing the first line in the list would win instead of the nearest" },
  { file:'index', via:'index', expect:"relHit(",
    find:"      if (Math.abs(x - q.x) <= h && Math.abs(y - q.y) <= h) return id;",
    replace:"      if (false) return id;",
    why:"tapping the name of a line would not count as that line" },
  { file:'index', via:'index', expect:"relKind(skew0)",
    find:"    { a:[0, 2], d:[2, 1],  jia:2, para:[4, 6],    skew:[[3, [-2, 3]], [1, [-1, 3]]], cross:2 },",
    replace:"    { a:[0, 2], d:[2, 1],  jia:2, para:[4, 6],    skew:[[3, [-1, 2]], [1, [-1, 3]]], cross:2 },",
    why:"a 'decoy' would really be parallel to A, so tapping it would be marked wrong" },
  { file:'index', via:'index', expect:"a mistake at 0",
    find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;",
    replace:"    gScore = gScore - 5; elScore.textContent = gScore;",
    why:"the score would go negative" },
  { file:'index', via:'index', expect:"scoring: a round with",
    find:"    var pts = gMistake ? 10 : 20;",
    replace:"    var pts = 20;",
    why:"a round with mistakes would still give +20" },
  { file:'index', via:'index', expect:"board-generation guard",
    find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
    replace:"",
    why:"a piece held across Restart would act on the new board" },
  { file:'index', via:'index', expect:"lostpointercapture",
    find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
    replace:"",
    why:"a piece could get stuck when capture is lost" },
  { file:'index', via:'index', expect:"tray would start",
    find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }",
    replace:"    if (false){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }",
    why:"a shuffle could leave the tray in the answer order" },
  { file:'index', via:'index', expect:"ahead mode",
    find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
    replace:"    if (false){ hintLevel = 1; showHint(); }",
    why:"ahead mode would not give the first hint" },
  { file:'index', via:'index', expect:"mistake reasons changed",
    find:"不是「直直往下」。',\n        other:function(dir){ return '另一條直角邊",
    replace:"就是「直直往下」。',\n        other:function(dir){ return '另一條直角邊",
    why:"a reason sentence silently changed (here: into a false one)" },
  { file:'index', via:'index', expect:"should say the distance twice",
    find:"（數一數，' + dist + ' 格）。'",
    replace:"（數一數格子）。'",
    why:"the success message would stop tying the distance to the counted squares" },
];

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 上課頁：資料層（第二套實作要抓得到） --- */
    { file:"index", via:"index", expect:"the page distance disagrees with the reference",
      find:"    var d = horiz ? Math.abs(cs.pt[1] - cs.at) : Math.abs(cs.pt[0] - cs.at);",
      replace:"    var d = horiz ? Math.abs(cs.pt[1] - cs.at) + 1 : Math.abs(cs.pt[0] - cs.at);",
      why:"every point-to-line distance on the page would be one centimetre too big" },
    { file:"index", via:"index", expect:"the page width disagrees with the reference",
      find:"    var gap = Math.abs(cs.b - cs.a);\n    var segs = cs.perpAt.map(function(t){",
      replace:"    var gap = Math.abs(cs.b - cs.a) - 1;\n    var segs = cs.perpAt.map(function(t){",
      why:"the width between the parallel lines would be reported one centimetre short" },
    { file:"index", via:"index", expect:"but the drawing says otherwise",
      find:"    var aPerp = dot(cs.aDir, S5_D) === 0;",
      replace:"    var aPerp = dot(cs.aDir, S5_D) !== 0;",
      why:"the page would claim A is not perpendicular to C while the picture shows a right angle" },

    /* --- 上課頁：畫垂線的幾何 --- */
    { file:"index", via:"index", expect:"is not at 90 degrees to the original",
      find:"      var dl = clipLine(cs.foot, perp(S1_D));",
      replace:"      var dl = clipLine(cs.foot, S1_D);",
      why:"the line drawn would lie along the original instead of crossing it at a right angle" },
    { file:"index", via:"index", expect:"the set square corner is not a right angle",
      find:"    var e = unit(S1_D), n = unit(perp(S1_D));\n    var out = { lines:[], marks:[], dots:[], polys:[] };",
      replace:"    var e = unit(S1_D), n = unit(add(perp(S1_D), S1_D));\n    var out = { lines:[], marks:[], dots:[], polys:[] };",
      why:"the two sides of the set square would no longer meet at 90 degrees" },
    { file:"index", via:"index", expect:"the right-angle corner is at",
      find:"      var V = (step === 0) ? S1_VSTART : cs.foot;",
      replace:"      var V = (step === 0) ? S1_VSTART : cs.pt;",
      why:"for the off-line case the set square corner would sit on the point instead of the foot" },
    { file:"index", via:"index", expect:"the two sides of the right angle are not equal",
      find:"  function toolPts(V, e, n, L){\n    return [P(V), P(add(V, scale(e, L))), P(add(V, scale(n, L)))];",
      replace:"  function toolPts(V, e, n, L){\n    return [P(V), P(add(V, scale(e, L))), P(add(V, scale(n, L * 0.7)))];",
      why:"the set square would stop being 45/45/90, so 'a side of the right angle' loses its meaning" },
    { file:"index", via:"index", expect:"right-angle mark 0 is the wrong size",
      find:"  var MARK_S = 0.55;             // 直角記號的邊長（格）",
      replace:"  var MARK_S = 0.75;            // 直角記號的邊長（格）",
      why:"the right-angle mark would be drawn at a size the reference does not expect" },
    { file:"index", via:"index", expect:"the perpendicular must appear from step 2 onwards",
      find:"    if (step >= 2){\n      var dl = clipLine(cs.foot, perp(S1_D));",
      replace:"    if (step >= 1){\n      var dl = clipLine(cs.foot, perp(S1_D));",
      why:"the answer would be drawn before the child has been shown how to get there" },

    /* --- 上課頁：畫平行線的幾何 --- */
    { file:"index", via:"index", expect:"is not parallel to the original",
      find:"      var dl = clipLine(S3_PT, S3_D);",
      replace:"      var dl = clipLine(S3_PT, perp(S3_D));",
      why:"the line drawn would cross the original instead of being parallel to it" },
    { file:"index", via:"index", expect:"the ruler edge is not perpendicular to the line",
      find:"      out.polys.push({ pts:rulerPts(add(S3_VSTART, scale(n, -1)), n, scale(e, -1), RULER_LEN, RULER_W), kind:'ruler' });",
      replace:"      out.polys.push({ pts:rulerPts(add(S3_VSTART, scale(n, -1)), e, scale(n, -1), RULER_LEN, RULER_W), kind:'ruler' });",
      why:"the rail would run along the line instead of across it, so the set square could not slide to the point" },
    { file:"index", via:"index", expect:"the ruler moved",
      find:"      out.polys.push({ pts:rulerPts(add(S3_VSTART, scale(n, -1)), n, scale(e, -1), RULER_LEN, RULER_W), kind:'ruler' });",
      replace:"      out.polys.push({ pts:rulerPts(add(S3_VSTART, scale(n, step - 1)), n, scale(e, -1), RULER_LEN, RULER_W), kind:'ruler' });",
      why:"the rail would drift as the set square slides, which is exactly the mistake the lesson warns about" },
    { file:"index", via:"index", expect:"the set square corner is at",
      find:"      var V = (step <= 1) ? S3_VSTART : S3_PT;",
      replace:"      var V = (step <= 2) ? S3_VSTART : S3_PT;",
      why:"the set square would not actually have slid to the point at step 3" },
    { file:"index", via:"index", expect:"the parallel must appear from step 3 onwards",
      find:"    if (step >= 3){\n      var dl = clipLine(S3_PT, S3_D);",
      replace:"    if (step >= 2){\n      var dl = clipLine(S3_PT, S3_D);",
      why:"the parallel would be drawn before the sliding step is shown" },

    /* --- 上課頁：平行線之間 --- */
    { file:"index", via:"index", expect:"is not perpendicular to the lines",
      find:"      var p2 = horiz ? [t, cs.b] : [cs.b, t];\n      return { a:p1, b:p2, len:segLen(p1, p2), isPerp:true };",
      replace:"      var p2 = horiz ? [t + 2, cs.b] : [cs.b, t + 2];\n      return { a:p1, b:p2, len:segLen(p1, p2), isPerp:true };",
      why:"the measurement drawn as the width would itself be slanted" },
    { file:"index", via:"index", expect:"the two lines are not drawn parallel",
      find:"    [cs.a, cs.b].forEach(function(t){\n      var A = wd.horiz ? [0, t] : [t, 0];\n      var seg = clipLine(A, D);",
      replace:"    [cs.a, cs.b].forEach(function(t, ti){\n      var A = wd.horiz ? [0, t] : [t, 0];\n      var seg = clipLine(A, ti ? [D[0] + 1, D[1] + 1] : D);",
      why:"the two lines the lesson calls parallel would not be parallel" },

    /* --- 上課頁：範例的組合必須撐得起規則 --- */
    { file:"index", via:"index", expect:"must include a vertical line",
      find:"    { id:'vert', axis:'v', at:6, pt:[14, 7], offs:[-6, 0, 6] }",
      replace:"    { id:'vert', axis:'h', at:6, pt:[14, 7], offs:[-6, 0, 6] }",
      why:"every distance picture would use a level line, teaching that perpendicular means straight down" },
    { file:"index", via:"index", expect:"example 4 case 1 does not match the reference",
      find:"    { id:'stand', axis:'v', a:3, b:11, perpAt:[2, 10], slant:[[3, 2], [11, 8]] }",
      replace:"    { id:'stand', axis:'v', a:3, b:11, perpAt:[2, 2], slant:[[3, 2], [11, 8]] }",
      why:"both width measurements would be taken in the same place, so 'the same everywhere' is never shown" },
    { file:"index", via:"index", expect:"example 5 case 1 does not match the reference",
      find:"    { id:'onlyA', aAt:[4, 3], aDir:[-1, 2], bAt:[14, 8], bDir:[-1, 3] }",
      replace:"    { id:'onlyA', aAt:[4, 3], aDir:[-1, 2], bAt:[14, 8], bDir:[-1, 2] }",
      why:"both cases would be the same, so the contrast the example is built on disappears" },
    { file:"index", via:"index", expect:"example 1 offLine: the point must not be on the line",
      find:"    { id:'offLine', pt:[6, 9],  foot:[8, 5] }",
      replace:"    { id:'offLine', pt:[8, 5],  foot:[8, 5] }",
      why:"the 'point off the line' case would secretly be the on-the-line case again" },

    /* --- 上課頁：遊戲（第 5 段 gameChecks 的改壞測試在 GAME_BREAKS） --- */
    ...GAME_BREAKS,

    /* --- 上課頁：題庫 --- */
    { file:"index", via:"index", expect:"the key is \"4 公分\", expected \"3 公分\"",
      find:"          opts:['4 公分','5 公分','3 公分','8 公分'], ans:2,",
      replace:"          opts:['4 公分','5 公分','3 公分','8 公分'], ans:0,",
      why:"the keyed answer would no longer be the distance the figure shows" },
    { file:"index", via:"index", expect:"the stem no longer gives the number 7",
      find:"甲和乙是兩條平行線，相距 <strong>7 公分</strong>",
      replace:"甲和乙是兩條平行線，相距 <strong>9 公分</strong>",
      why:"the stem numbers would no longer add up to the keyed answer" },
    { file:"index", via:"index", expect:"figure presence is wrong",
      find:"        { stem:'看下面的圖（一格 1 公分）。紅點 P 到藍色直線 L 的<strong>距離</strong>是幾公分？', fig:'qDist',",
      replace:"        { stem:'看下面的圖（一格 1 公分）。紅點 P 到藍色直線 L 的<strong>距離</strong>是幾公分？',",
      why:"the question would ask about a picture that is not drawn" },
    { file:"index", via:"index", expect:"the stem no longer asks",
      find:"        { stem:'量「兩條平行線之間的距離」，要怎麼量才對？',",
      replace:"        { stem:'量「兩條平行線之間的距離」，你覺得呢？',",
      why:"the stem would stop asking the question the key answers" },

    /* --- 四頁的措辭 --- */
    { file:"index", via:"index", expect:"SIBLING: \"不是斜邊\"",
      find:"⚠️ 貼住直線的一定是<strong>直角邊</strong>，不是斜邊。',",
      replace:"⚠️ 貼住直線的一定是<strong>直角邊</strong>。',",
      why:"the warning that the slanted side is the wrong one would quietly disappear from the dictionary" },
    { file:"reference", via:"index", expect:"SIBLING: \"點到直線的距離\"",
      find:"它的長叫做<strong>點到直線的距離</strong>。兩條平行線之間<strong>處處一樣寬</strong>，那個寬叫做<strong>平行線之間的距離</strong>，一樣要量<strong>和兩條線都垂直</strong>的那一段。',",
      replace:"它的長就是那一段的長度。兩條平行線之間<strong>處處一樣寬</strong>，那個寬叫做<strong>平行線之間的距離</strong>，一樣要量<strong>和兩條線都垂直</strong>的那一段。',",
      why:"the cheat sheet would stop naming the thing the lesson is about" },
    { file:"index", via:"index", expect:"FORBIDDEN: index.html says",
      find:"      s4note:'💬 兩條平行線之間<strong>處處一樣寬</strong>",
      replace:"      s4note:'💬 斜著量也算距離。兩條平行線之間<strong>處處一樣寬</strong>",
      why:"the page would state something the whole example disproves" },
    { file:"index", via:"index", expect:"HANDOFF: index.html mentions",
      find:"<strong>「角度測量站」</strong>；三角板拼出各種角度在<strong>「拼角工作坊」</strong>；周長與面積在<strong>「面積鋪磚廠」</strong>。這一課的圖都畫在<strong>方格紙</strong>上，一格代表 1 公分；除了直角 90 度以外不談角度，也不用小數。',",
      replace:"<strong>那一課</strong>；三角板拼出各種角度在<strong>「拼角工作坊」</strong>；周長與面積在<strong>「面積鋪磚廠」</strong>。這一課的圖都畫在<strong>方格紙</strong>上，一格代表 1 公分；除了直角 90 度以外不談角度，也不用小數。',",
      why:"the protractor would be mentioned without saying which lesson owns it" },
    { file:"index", via:"index", expect:"KEY: index.html zh.s2note no longer says",
      find:"      s2note:'💬 從<strong>線外一點</strong>畫到直線上的所有線段裡，<strong>和直線垂直的那一條最短</strong>；它的長就叫做<strong>點到直線的距離</strong>。垂直線段碰到直線的那一點叫<strong>垂足</strong>。",
      replace:"      s2note:'💬 從一個點畫到直線上的所有線段裡，<strong>和直線垂直的那一條最短</strong>；它的長就叫做<strong>點到直線的距離</strong>。垂直線段碰到直線的那一點叫<strong>垂足</strong>。",
      why:"the rule would drop the qualifier and become false for a point that is on the line" },
    { file:"parents", via:"index", expect:"KEY: parents.html zh.s1p2 no longer says",
      find:"      s1p2:'<strong>大人最容易誤解</strong>的有兩件事。第一，很多大人以為這一課就是「認識垂直和平行」——那一半在<strong>「四邊形家族」</strong>已經教過了，這一課是<strong>作圖</strong>與<strong>距離</strong>",
      replace:"      s1p2:'<strong>大人最容易誤解</strong>的有兩件事。第一，很多大人以為這一課就是「認識垂直和平行」——那一半以前教過了，這一課是<strong>作圖</strong>與<strong>距離</strong>",
      why:"the parents page would stop telling grown-ups which lesson already covered the other half" },

    /* --- 圖上不可以有文字 --- */
    { file:"index", via:"index", expect:"the tag name",
      find:"    plan.dots.forEach(function(dt){\n      var s = DOTS[dt.kind];",
      replace:"    if (window.never) svg.appendChild(svgEl('text', {}));\n    plan.dots.forEach(function(dt){\n      var s = DOTS[dt.kind];",
      why:"a label drawn inside the SVG can be clipped by its own canvas, which is the defect class this lesson avoids by construction" },
    { file:"reference", via:"index", expect:"reference.html must have no SVG at all",
      find:"  <button class=\"printbtn\" onclick=\"window.print()\" data-i18n=\"printBtn\">",
      replace:"  <svg width=\"10\" height=\"10\"></svg>\n  <button class=\"printbtn\" onclick=\"window.print()\" data-i18n=\"printBtn\">",
      why:"the printable page would gain a picture nothing checks" },

    /* --- 畫布 --- */
    { file:"index", via:"index", expect:"one square must be 22px",
      find:"  var U = 22;                    // 一格幾像素",
      replace:"  var U = 24;                    // 一格幾像素",
      why:"the grid would no longer fit the canvas the reference expects" },

    /* --- 驗算器的覆蓋率 --- */
    { file:"index", via:"index", expect:"the set of verified equations changed",
      find:"why:'乙和丙在甲的<strong>不同邊</strong>，所以兩段距離要<strong>加起來</strong>：7 ＋ 4 ＝ <strong>11</strong> 公分。（如果丙和乙在同一邊，才會是 7 － 4 ＝ 3 公分。）' },",
      replace:"why:'乙和丙在甲的<strong>不同邊</strong>，所以兩段距離要<strong>加起來</strong>：4 ＋ 7 ＝ <strong>11</strong> 公分。（如果丙和乙在同一邊，才會是 7 － 4 ＝ 3 公分。）' },",
      why:"swapping one correct equation for another correct one keeps the count identical, so only the fingerprint notices" },

    /* --- 複習挑戰的產生器 --- */
    { file:"review", expect:"ans does not point at the distance",
      find:"          return { c:c, d:c.d, slant:c.slant, off:c.off, opts:opts, ans:opts.indexOf(c.d) };",
      replace:"          return { c:c, d:c.d, slant:c.slant, off:c.off, opts:opts, ans:opts.indexOf(c.slant) };",
      why:"the slanted length would be keyed as the distance" },
    /* ⚠️ 把三數表改壞，產生器自己的拒絕取樣會**吸收掉**（多抽幾次就好），所有數值斷言照樣全綠 ——
       真正釘住它的是 REVIEW_PINS 逐字比對那一行。「斜的一定比垂直的長」則是這個模型本身
       保證的（垂足在直線上、點在線外），寫不出一筆真的破得掉它的改壞，這裡說清楚它靠什麼。 */
    { file:"review", via:"index", expect:"PIN: review.html has 0 copies",
      find:"  var TRIPLES_H = [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10]];   // 橫的直線：往旁邊挪 ≤ 9 格",
      replace:"  var TRIPLES_H = [[3, 5, 6], [4, 3, 5], [6, 8, 10], [8, 6, 10]];   // 橫的直線：往旁邊挪 ≤ 9 格",
      why:"a table that is not Pythagorean would silently shrink the sampling space instead of failing" },
    { file:"review", expect:"an option equals the distance",
      find:"          for (var v = 1; v < d; v++) lows.push(v);",
      replace:"          for (var v = 1; v <= d; v++) lows.push(v);",
      why:"a distractor equal to the distance is reachable by correct reasoning about the perpendicular segment" },
    { file:"review", expect:"ans does not point at the width",
      find:"          return { c:c, gap:c.gap, slant:c.slant, run:c.run, opts:opts, ans:opts.indexOf(c.gap) };",
      replace:"          return { c:c, gap:c.gap, slant:c.slant, run:c.run, opts:opts, ans:opts.indexOf(c.slant) };",
      why:"the slanted measurement would be keyed as the distance between the parallel lines" },
    { file:"review", expect:"correct is wrong for this arrangement",
      find:"          return { sameSide:sameSide, a:a, b:b, correct:correct, other:other, opts:opts, ans:opts.indexOf(correct) };",
      replace:"          return { sameSide:!sameSide, a:a, b:b, correct:correct, other:other, opts:opts, ans:opts.indexOf(correct) };",
      why:"the stem would describe one arrangement while the answer was worked out for the other" },
    { file:"review", expect:"is the step just done or a later one",
      find:"          var others = list.slice(0, k);          // 只有**更早**的步驟可以當誘答",
      replace:"          var others = list.filter(function(s){ return s !== correct; });          // 只有**更早**的步驟可以當誘答",
      why:"a later step would be offered as a distractor, and a later step is also something you do next" },
    { file:"review", via:"index", expect:"PIN: review.html has 0 copies",
      find:"    var bDir = both ? perp(cDir) : [aDir[0] - cDir[0], aDir[1] - cDir[1]];",
      replace:"    var bDir = perp(cDir);",
      why:"every question would become the 'both perpendicular' case; the generator absorbs it silently, so only the source pin notices" },
    { file:"review", expect:"correct is wrong for perpAny",
      find:"          var correct = (kind === 'perpAny') ? 'many' : 'one';",
      replace:"          var correct = 'one';",
      why:"'how many perpendiculars are there altogether' would be keyed as exactly one" },
    { file:"review", expect:"pairs is wrong for trapezoid",
      find:"    { id:'parallelogram', pairs:2 }, { id:'trapezoid', pairs:1 }",
      replace:"    { id:'parallelogram', pairs:2 }, { id:'trapezoid', pairs:2 }",
      why:"a trapezium would be said to have two pairs of parallel sides, which would make it a parallelogram" },
    { file:"review", expect:"the other piece is wrong",
      find:"          var correct = 90 - a;\n          var opts = numOpts(correct, [a, 180 - a, 90 + a], inDeg);",
      replace:"          var correct = 180 - a;\n          var opts = numOpts(correct, [a, 180 - a, 90 + a], inDeg);",
      why:"the two pieces of a right angle would be said to add up to 180 degrees" },
    { file:"review", expect:"turning the pair together cannot change the angle",
      find:"          var correct = 90;\n          var opts = numOpts(correct, [90 - turn, 90 + turn, turn], inDeg);",
      replace:"          var correct = 90 - turn;\n          var opts = numOpts(correct, [90, 90 + turn, turn], inDeg);",
      why:"turning both lines together would be said to change the angle between them" },
    { file:"review", expect:"stem is not the expected sentence",
      find:"          stem: lang === 'zh' ? '方格紙上一格是 1 公分。紅點到藍色直線的<strong>距離</strong>是幾公分？'",
      replace:"          stem: lang === 'zh' ? '方格紙上一格是 1 公分。紅點到藍色直線的<strong>距離</strong>大約是幾公分？'",
      why:"the stem would start asking for an estimate while the key stays exact" },
    { file:"review", expect:"figure caption contains a number",
      find:"      capDist:'📐 一格 1 公分；紫色那一條和藍色直線垂直（有直角記號），橘色的都是斜的',",
      replace:"      capDist:'📐 一格 1 公分；紫色那一條長 3 公分，和藍色直線垂直（有直角記號），橘色的都是斜的',",
      why:"the caption would do the counting for the child" },
    { file:"review", expect:"is not a length in centimetres",
      find:"      cm:function(n){ return n + ' 公分'; },\n      deg:function(n){ return n + ' 度'; },",
      replace:"      cm:function(n){ return n + ' 公尺'; },\n      deg:function(n){ return n + ' 度'; },",
      why:"the options would report a length in metres on a picture whose squares are centimetres" },
    { file:"review", expect:"the purple segment is not drawn at 90 degrees",
      find:"    dd.segs.forEach(function(s){\n      out.lines.push({ a:P(cs.pt), b:P(s.foot), kind:s.isPerp ? 'perp' : 'slant' });\n    });\n    var e = unit(dd.D);",
      replace:"    dd.segs.forEach(function(s, si){\n      out.lines.push({ a:P(cs.pt), b:P(si === dd.perpIdx ? cs.offs.map ? [s.foot[0] + 1, s.foot[1]] : s.foot : s.foot), kind:s.isPerp ? 'perp' : 'slant' });\n    });\n    var e = unit(dd.D);",
      why:"the segment coloured as the perpendicular would actually be drawn slanted" },
    { file:"review", expect:"right-angle mark 0 is not a right angle",
      find:"  function rightMark(X, u, v){\n    var a = add(X, scale(u, MARK_S));\n    return [P(a), P(add(a, scale(v, MARK_S))), P(add(X, scale(v, MARK_S)))];\n  }\n  function emptyPlan()",
      replace:"  function rightMark(X, u, v){\n    var a = add(X, scale(u, MARK_S));\n    return [P(a), P(add(a, scale(add(u, v), MARK_S))), P(add(X, scale(v, MARK_S)))];\n  }\n  function emptyPlan()",
      why:"the little box that tells the child 'this is a right angle' would not be a right angle" },
    { file:"review", expect:"does not offer the slanted length as a distractor",
      find:"          var opts = numOpts(c.d, [c.slant, c.off, c.d + c.off], inLen);",
      replace:"          var opts = numOpts(c.d, [c.off, c.d + c.off], inLen);",
      why:"the commonest mistake — reading the slanted segment instead of the perpendicular one — would stop being offered" },
    { file:"review", expect:"why should give both the perpendicular length and the slanted one",
      find:"            ? '距離要看<strong>紫色</strong>那一條（有直角記號的那一條）：數格子是 ' + d.d + ' 格，所以距離是 <strong>' + d.d + ' 公分</strong>。橘色那兩條是斜的，各 ' + d.slant + ' 公分，比較長 —— 它們不是距離。'",
      replace:"            ? '距離要看<strong>紫色</strong>那一條（有直角記號的那一條）：數格子是 ' + d.d + ' 格，所以距離是 <strong>' + d.d + ' 公分</strong>。橘色那兩條是斜的，比較長 —— 它們不是距離。'",
      why:"the explanation would stop showing the contrast it is built on" },
    /* --- 審查之後補上的守衛，每一條都要有自己的改壞測試 --- */
    { file:"index", via:"index", expect:"which is not a corner it is supposed to mark",
      find:"    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, e, n));\n    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, scale(e, -1), n));",
      replace:"    out.marks.push(rightMark(dd.segs[0].foot, e, n));\n    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, scale(e, -1), n));",
      why:"a perfectly square right-angle mark would be drawn at a slanted segment's foot, where there is no right angle" },
    { file:"index", via:"index", expect:"the drawn lines are not the same distance apart everywhere",
      find:"      var seg = clipLine(A, D);\n      out.lines.push({ a:P(seg[0]), b:P(seg[1]), kind:'base' });",
      replace:"      var seg = clipLine(A, t === cs.b ? [D[0] + 0.05, D[1]] : D);\n      out.lines.push({ a:P(seg[0]), b:P(seg[1]), kind:'base' });",
      why:"the two lines would fan apart very slightly — endpoint checks stay green, only measuring along them notices" },
    { file:"index", via:"index", expect:"the grid is wider than the canvas",
      find:"  var OX = 10, OY = 293;         // 方格紙左下角的畫布座標",
      replace:"  var OX = 60, OY = 293;         // 方格紙左下角的畫布座標",
      why:"the grid would run off the right-hand edge of the canvas" },
    { file:"index", via:"index", expect:"example 1 must use a slanted line",
      find:"  var S1_A = [2, 2], S1_D = [2, 1];",
      replace:"  var S1_A = [2, 2], S1_D = [1, 0];",
      why:"the drawing example would go back to a level line, teaching that perpendicular means straight down" },
    { file:"index", via:"index", expect:"example 3: the point is on the line",
      find:"  var S3_PT = [6, 7];                // 要通過的點；也是三角板滑到之後的直角頂點",
      replace:"  var S3_PT = [10, 5];                // 要通過的點；也是三角板滑到之後的直角頂點",
      why:"the point would be on the line, so the 'parallel' drawn through it is the very same line" },
    { file:"index", via:"index", expect:"the tag name",
      find:"  function svgEl(tag, attrs){\n    var el = document.createElementNS(NS, tag);",
      replace:"  function svgEl(tag, attrs){\n    if (tag === 0) return document.createElementNS(NS, 'text');\n    var el = document.createElementNS(NS, tag);",
      why:"a text element could be drawn into the figure, where its own canvas can clip it" },
    { file:"review", via:"index", expect:"PIN: review.html has 0 copies",
      find:"  var SPLIT_POOL = (function(){ var out = [], v; for (v = 10; v <= 80; v++) if (v !== 45) out.push(v); return out; })();",
      replace:"  var SPLIT_POOL = (function(){ var out = [], v; for (v = 30; v <= 40; v++) if (v !== 45) out.push(v); return out; })();",
      why:"the angle range would silently shrink to a tenth of what the lesson claims to cover" },
    { file:"review", via:"index", expect:"PIN: review.html has 0 copies",
      find:"        return retry(function(){ return build(makeDistCase()); }, function(){ return build(fbDist()); });",
      replace:"        return retry(function(){ return build(makeDistCase()); });",
      why:"make() could return null again, and the simulation harness dereferences null and dies rather than reporting" },
    { file:"review", expect:"which is not a corner it is supposed to mark",
      find:"    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, e, n));\n    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, scale(e, -1), n));",
      replace:"    out.marks.push(rightMark(dd.segs[0].foot, e, n));\n    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, scale(e, -1), n));",
      why:"the right-angle mark would sit at a slanted segment's endpoint, where there is no right angle" },
    { file:"review", expect:"off the squared paper",
      find:"      if (X[0] < 1 || X[0] > GW - 1 || X[1] < 1 || X[1] > GH - 1) return null;",
      replace:"      if (false) return null;",
      why:"the two lines could cross far off the picture while the explanation says they cross" },
    /* --- 第二輪審查之後補上的守衛 --- */
    { file:"index", via:"index", expect:"no right-angle mark was drawn at",
      find:"    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, e, n));\n    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, scale(e, -1), n));",
      replace:"    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, e, n));",
      why:"only one of the two right-angle marks would be drawn — a set-membership check would not notice, only matching the multiset does" },
    { file:"index", via:"index", expect:"no right-angle mark was drawn at",
      find:"    if (rd.aPerp) out.marks.push(rightMark(cs.aAt, e, unit(cs.aDir)));\n    if (rd.bPerp) out.marks.push(rightMark(cs.bAt, e, unit(cs.bDir)));",
      replace:"    if (rd.aPerp) out.marks.push(rightMark(cs.bAt, e, unit(cs.bDir)));\n    if (rd.bPerp) out.marks.push(rightMark(cs.bAt, e, unit(cs.bDir)));",
      why:"in the 'only A is perpendicular' case the single mark would be drawn on B, where there is no right angle" },
    { file:"index", via:"index", expect:"createElementNS is called",
      find:"  function svgEl(tag, attrs){\n    var el = document.createElementNS(NS, tag);",
      replace:"  function svgEl(tag, attrs){\n    if (window.never) document.createElementNS(NS, 'g');\n    var el = document.createElementNS(NS, tag);",
      why:"a second creation site is a second way to put something into the SVG that nothing checks" },
    { file:"review", expect:"no right-angle mark was drawn at",
      find:"    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, e, n));\n    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, scale(e, -1), n));",
      replace:"    out.marks.push(rightMark(dd.segs[dd.perpIdx].foot, e, n));",
      why:"only one of the two right-angle marks would be drawn on the generated figure" },
    { file:"review", expect:"which is not a corner it is supposed to mark",
      find:"    if (rd.aPerp) out.marks.push(rightMark(cs.aAt, e, unit(cs.aDir)));",
      replace:"    if (rd.aPerp) out.marks.push(rightMark(cs.bAt, e, unit(cs.aDir)));",
      why:"the mark for A would be drawn at B's intersection" },
    /* --- 第三輪審查之後補上的守衛 --- */
    { file:"index", via:"index", expect:"line 0 has no usable endpoints",
      find:"    out.lines.push({ a:P(base[0]), b:P(base[1]), kind:'base' });\n    if (step >= 2){",
      replace:"    out.lines.push({ a:null, b:P(base[1]), kind:'base' });\n    if (step >= 2){",
      why:"a malformed figure must be reported, not crash the checker with a TypeError (a crash is neither caught nor quietly correct)" },
    { file:"index", via:"index", expect:"no right-angle mark was drawn at",
      find:"    var e = unit(S5_D);\n    if (rd.aPerp) out.marks.push(rightMark(cs.aAt, e, unit(cs.aDir)));",
      replace:"    var e = unit(S5_D);\n    if (false) out.marks.push(rightMark(cs.aAt, e, unit(cs.aDir)));",
      why:"the mark on a genuine right angle would vanish; the expected set is built by the config's own angle measurement, so the page cannot vouch for itself" }
  ],

  /* ================= review.html 的產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      perpDist: function(d){
        if (!d) return 'perpDist: make() returned nothing';
        const cs = d.c && d.c.cs;
        if (!cs) return 'perpDist: no case';
        const dist = distRef(cs);
        if (!isWholeCm(dist)) return 'perpDist: the perpendicular distance is not a whole number of centimetres';
        if (Math.abs(dist - d.d) > 1e-9) return 'perpDist: d disagrees with the reference distance';
        /* 窮舉：直線上每一個格點都試一次，垂足必須是唯一的最小值。 */
        const sf = shortestFootRef(cs);
        if (sf.ties !== 1) return 'perpDist: the shortest segment is not unique';
        if (Math.abs(sf.min - dist) > 1e-9) return 'perpDist: the brute-force minimum is not the perpendicular distance';
        const foot = footRef(cs);
        const bestFoot = (cs.axis === 'h') ? [sf.at, cs.at] : [cs.at, sf.at];
        if (!eqJ(foot, bestFoot)) return 'perpDist: the shortest foot is not the perpendicular foot';
        const slants = cs.offs.filter(o => o !== 0).map(o => {
          const f = (cs.axis === 'h') ? [cs.pt[0] + o, cs.at] : [cs.at, cs.pt[1] + o];
          return Math.hypot(cs.pt[0] - f[0], cs.pt[1] - f[1]);
        });
        if (slants.length < 2) return 'perpDist: the picture has too few slanted segments to contrast with';
        if (!slants.every(isWholeCm)) return 'perpDist: a slanted segment is not a whole number of centimetres';
        if (!slants.every(L => L > dist + 1e-9)) return 'perpDist: a slanted segment is not longer than the perpendicular one';
        if (!slants.every(L => Math.abs(L - d.slant) < 1e-9)) return 'perpDist: slant disagrees with the drawn segments';
        if (!fourDistinctNums(d.opts)) return 'perpDist: options not four distinct whole numbers';
        if (d.opts.indexOf(d.slant) < 0) return 'perpDist: does not offer the slanted length as a distractor';
        if (d.opts[d.ans] !== d.d) return 'perpDist: ans does not point at the distance';
        return null;
      },
      slantLonger: function(d){
        if (!d) return 'slantLonger: make() returned nothing';
        if (!(d.d >= 4 && d.d <= 11)) return 'slantLonger: distance out of range';
        if (!fourDistinctNums(d.opts)) return 'slantLonger: options not four distinct whole numbers';
        /* 這一題的整條推理就是「斜的一定比距離長」，所以**恰好一個**選項可以大於 d。 */
        const bigger = d.opts.filter(v => v > d.d);
        if (bigger.length !== 1) return 'slantLonger: exactly one option must be longer than the distance';
        if (bigger[0] !== d.longer) return 'slantLonger: longer disagrees with the options';
        if (d.opts.indexOf(d.d) >= 0) return 'slantLonger: an option equals the distance, which only the perpendicular segment can be';
        if (d.opts[d.ans] !== d.longer) return 'slantLonger: ans does not point at the longer segment';
        return null;
      },
      paraWidth: function(d){
        if (!d) return 'paraWidth: make() returned nothing';
        const cs = d.c && d.c.cs;
        if (!cs) return 'paraWidth: no case';
        const vals = widthEverywhereRef(cs);
        if (!vals.length) return 'paraWidth: nothing to measure';
        if (!vals.every(v => Math.abs(v - vals[0]) < 1e-9)) return 'paraWidth: the width is not the same everywhere';
        if (Math.abs(vals[0] - d.gap) > 1e-9) return 'paraWidth: gap disagrees with the reference width';
        if (!isWholeCm(d.gap)) return 'paraWidth: the width is not a whole number of centimetres';
        const s = cs.slant;
        const slantLen = Math.hypot(s[0][0] - s[1][0], s[0][1] - s[1][1]);
        if (!isWholeCm(slantLen)) return 'paraWidth: the slanted measurement is not a whole number of centimetres';
        if (!(slantLen > d.gap + 1e-9)) return 'paraWidth: the slanted measurement is not longer than the width';
        if (Math.abs(slantLen - d.slant) > 1e-9) return 'paraWidth: slant disagrees with the drawn segment';
        /* 斜的那一段兩端一定要各落在一條線上，不然它量的不是「兩條線之間」。 */
        const onA = (cs.axis === 'h') ? s[0][1] === cs.a : s[0][0] === cs.a;
        const onB = (cs.axis === 'h') ? s[1][1] === cs.b : s[1][0] === cs.b;
        if (!onA || !onB) return 'paraWidth: the slanted segment does not run from one line to the other';
        if (cs.perpAt[0] === cs.perpAt[1]) return 'paraWidth: the two perpendicular measurements are in the same place';
        if (!fourDistinctNums(d.opts)) return 'paraWidth: options not four distinct whole numbers';
        if (d.opts.indexOf(d.slant) < 0) return 'paraWidth: does not offer the slanted length as a distractor';
        if (d.opts[d.ans] !== d.gap) return 'paraWidth: ans does not point at the width';
        return null;
      },
      sameEverywhere: function(d){
        if (!d) return 'sameEverywhere: make() returned nothing';
        if (!(d.gap >= 3 && d.gap <= 12)) return 'sameEverywhere: gap out of range';
        if (!fourDistinctNums(d.opts)) return 'sameEverywhere: options not four distinct whole numbers';
        if (d.opts[d.ans] !== d.gap) return 'sameEverywhere: ans does not point at the same width';
        return null;
      },
      threeLines: function(d){
        if (!d) return 'threeLines: make() returned nothing';
        if (!(d.a >= 6 && d.a <= 14) || !(d.b >= 2 && d.b < d.a)) return 'threeLines: parameters out of range';
        const correct = d.sameSide ? d.a - d.b : d.a + d.b;
        if (d.correct !== correct) return 'threeLines: correct is wrong for this arrangement';
        const other = d.sameSide ? d.a + d.b : d.a - d.b;
        if (d.other !== other) return 'threeLines: other is wrong';
        if (correct === other) return 'threeLines: the two arrangements give the same answer, so the stem is not load-bearing';
        if (correct === d.a || correct === d.b) return 'threeLines: the answer equals a number in the stem';
        if (!fourDistinctNums(d.opts)) return 'threeLines: options not four distinct whole numbers';
        if (d.opts.indexOf(other) < 0) return 'threeLines: does not offer the other arrangement as a distractor';
        if (d.opts[d.ans] !== correct) return 'threeLines: ans does not point at the answer';
        return null;
      },
      drawStep: function(d){
        if (!d) return 'drawStep: make() returned nothing';
        const list = STEP_LISTS_REF[d.tool];
        if (!list) return 'drawStep: unknown tool';
        if (!(d.k >= 0 && d.k < list.length - 1)) return 'drawStep: k out of range';
        if (d.doneKey !== list[d.k]) return 'drawStep: doneKey does not match k';
        if (d.correct !== list[d.k + 1]) return 'drawStep: correct is not the next step';
        if (!Array.isArray(d.opts) || d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'drawStep: options not four distinct keys';
        if (d.opts.indexOf(d.doneKey) >= 0) return 'drawStep: the step just finished is offered again';
        /* 每一個誘答要嘛是明確的錯誤做法，要嘛是這支工具更早的步驟 —— 不可以是**更後面**的
           步驟（那也是「等一下要做的事」，孩子答它不能算錯），也不可以是另一支工具的步驟。 */
        const traps = ['trapHyp', 'trapMoveRuler', 'trapGuess'];
        for (const k of d.opts){
          if (k === d.correct) continue;
          if (traps.indexOf(k) >= 0) continue;
          const i = list.indexOf(k);
          if (i < 0) return 'drawStep: distractor ' + k + ' belongs to the other tool, which the stem never mentions';
          if (i >= d.k) return 'drawStep: distractor ' + k + ' is the step just done or a later one, which is also something you do next';
        }
        if (d.opts[d.ans] !== d.correct) return 'drawStep: ans does not point at the next step';
        return null;
      },
      bothPerp: function(d){
        if (!d) return 'bothPerp: make() returned nothing';
        const cs = d.c && d.c.cs;
        if (!cs) return 'bothPerp: no case';
        if (typeof d.both !== 'boolean') return 'bothPerp: both is not a flag';
        /* 第二套判定：把方向當成向量**量角**（atan2），不是拿整數內積判 0。 */
        const ang = (u, v) => angleBetween([u[0], -u[1]], [v[0], -v[1]]);
        const aPerp = Math.abs(ang(cs.aDir, cs.cDir) - 90) < 1e-9;
        const bPerp = Math.abs(ang(cs.bDir, cs.cDir) - 90) < 1e-9;
        const para = Math.abs(ang(cs.aDir, cs.bDir)) < 1e-9;
        const abPerp = Math.abs(ang(cs.aDir, cs.bDir) - 90) < 1e-9;
        if (!aPerp) return 'bothPerp: A is not perpendicular to C, but this generator always draws it that way';
        if (bPerp !== d.both) return 'bothPerp: B perpendicular to C is ' + bPerp + ' but the data says ' + d.both;
        if (para !== d.both) return 'bothPerp: "both perpendicular to C" and "parallel to each other" disagree';
        if (abPerp) return 'bothPerp: A and B are perpendicular to each other, so that distractor would be true';
        /* 甲和乙的定位點都要真的落在丙上，不然圖上根本沒有那個交角。 */
        for (const at of [cs.aAt, cs.bAt]){
          const rel = [at[0] - cs.cAt[0], at[1] - cs.cAt[1]];
          if (rel[0] * cs.cDir[1] - rel[1] * cs.cDir[0] !== 0) return 'bothPerp: a line does not meet C where the right angle is marked';
        }
        if (eqJ(cs.aAt, cs.bAt)) return 'bothPerp: A and B meet C at the same point, so they would be the same line when parallel';
        const correct = d.both ? 'parallel' : 'notParallel';
        if (d.correct !== correct) return 'bothPerp: correct is wrong for this case';
        if (!isPerm(d.opts, ['parallel', 'notParallel', 'perpToEachOther', 'sameLine'])) return 'bothPerp: options are not the four conclusions';
        if (d.opts[d.ans] !== correct) return 'bothPerp: ans does not point at the conclusion';
        return null;
      },
      howMany: function(d){
        if (!d) return 'howMany: make() returned nothing';
        if (['perpOn', 'perpOff', 'paraOff', 'perpAny'].indexOf(d.kind) < 0) return 'howMany: unknown kind';
        const want = (d.kind === 'perpAny') ? 'many' : 'one';
        if (d.correct !== want) return 'howMany: correct is wrong for ' + d.kind;
        if (!isPerm(d.opts, ['one', 'two', 'many', 'none'])) return 'howMany: options are not the four counts';
        if (d.opts[d.ans] !== want) return 'howMany: ans does not point at the count';
        return null;
      },
      gridRel: function(d){
        if (!d) return 'gridRel: make() returned nothing';
        if (['perp', 'para', 'none'].indexOf(d.kind) < 0) return 'gridRel: unknown kind';
        const want = d.kind === 'perp' ? 'perpToEachOther' : d.kind === 'para' ? 'parallel' : 'neither';
        if (d.correct !== want) return 'gridRel: correct is wrong for ' + d.kind;
        if (!isPerm(d.opts, ['perpToEachOther', 'parallel', 'neither', 'sameLine'])) return 'gridRel: options are not the four relations';
        if (d.opts[d.ans] !== want) return 'gridRel: ans does not point at the relation';
        return null;
      },
      quadPara: function(d){
        if (!d) return 'quadPara: make() returned nothing';
        if (!(d.qid in QUAD_PAIRS_REF)) return 'quadPara: unknown quadrilateral';
        if (d.pairs !== QUAD_PAIRS_REF[d.qid]) return 'quadPara: pairs is wrong for ' + d.qid;
        if (!fourDistinctNums(d.opts)) return 'quadPara: options not four distinct whole numbers';
        if (d.opts.some(v => v < 0 || v > 4)) return 'quadPara: an option is outside 0~4';
        if (d.opts[d.ans] !== d.pairs) return 'quadPara: ans does not point at the number of pairs';
        return null;
      },
      splitRight: function(d){
        if (!d) return 'splitRight: make() returned nothing';
        if (!(d.a >= 10 && d.a <= 80)) return 'splitRight: the measured piece is out of range';
        if (d.a === 45) return 'splitRight: two equal pieces would make the key equal a distractor';
        if (d.correct !== 90 - d.a) return 'splitRight: the other piece is wrong (a right angle is 90 degrees)';
        if (d.correct <= 0) return 'splitRight: the other piece would not be a real angle';
        if (!fourDistinctNums(d.opts)) return 'splitRight: options not four distinct whole numbers';
        if (d.opts.indexOf(d.a) < 0) return 'splitRight: does not offer the measured piece as a distractor';
        if (d.opts.some(v => v < 1 || v > DEG_MAX_REF)) return 'splitRight: an option is outside 1~180 degrees';
        if (d.opts[d.ans] !== d.correct) return 'splitRight: ans does not point at the other piece';
        return null;
      },
      turnPair: function(d){
        if (!d) return 'turnPair: make() returned nothing';
        if (!(d.turn >= 10 && d.turn <= 80)) return 'turnPair: the turn is out of range';
        if (d.correct !== 90) return 'turnPair: turning the pair together cannot change the angle between them';
        if (!fourDistinctNums(d.opts)) return 'turnPair: options not four distinct whole numbers';
        if (d.opts.indexOf(d.turn) < 0) return 'turnPair: does not offer the turn itself as a distractor';
        if (d.opts[d.ans] !== 90) return 'turnPair: ans does not point at 90 degrees';
        return null;
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，不呼叫 review.html 的格式化函式。 */
    expectedCorrect: function(d, genId, lang){
      const t = TXT_REF[lang];
      switch (genId){
        case 'perpDist': return t.cm(Math.round(distRef(d.c.cs)));
        case 'slantLonger': return t.cm(d.longer);
        case 'paraWidth': return t.cm(Math.round(widthEverywhereRef(d.c.cs)[0]));
        case 'sameEverywhere': return t.cm(d.gap);
        case 'threeLines': return t.cm(d.sameSide ? d.a - d.b : d.a + d.b);
        case 'drawStep': return t.stepText[STEP_LISTS_REF[d.tool][d.k + 1]];
        case 'bothPerp': return t.relOpt[d.both ? 'parallel' : 'notParallel'];
        case 'howMany': return t.countOpt[d.kind === 'perpAny' ? 'many' : 'one'];
        case 'gridRel': return t.relOpt2[d.kind === 'perp' ? 'perpToEachOther' : d.kind === 'para' ? 'parallel' : 'neither'];
        case 'quadPara': return t.pairs(QUAD_PAIRS_REF[d.qid]);
        case 'splitRight': return t.deg(90 - d.a);
        case 'turnPair': return t.deg(90);
        default: return '(no expectedCorrect rule for ' + genId + ')';
      }
    },

    /* 這一課的選項長什麼樣、範圍多少。正解與誘答分開驗。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (GEN_IDS.indexOf(genId) < 0) return 'no optionOk rule for generator ' + genId;
      const t = TXT_REF[lang];
      const inSet = obj => Object.keys(obj).some(k => typeof obj[k] === 'string' && obj[k] === s);
      let m;
      if (genId === 'drawStep') return inSet(t.stepText) ? null : 'option "' + s + '" is not one of the known steps';
      if (genId === 'bothPerp') return inSet(t.relOpt) ? null : 'option "' + s + '" is not one of the four conclusions';
      if (genId === 'gridRel') return inSet(t.relOpt2) ? null : 'option "' + s + '" is not one of the four relations';
      if (genId === 'howMany') return inSet(t.countOpt) ? null : 'option "' + s + '" is not one of the four counts';
      if (genId === 'quadPara'){
        m = (lang === 'zh') ? /^(\d+) 組$/.exec(s) : /^(\d+) (pair|pairs)$/.exec(s);
        if (!m) return 'option "' + s + '" is not a number of pairs';
        const v = Number(m[1]);
        if (lang === 'en' && ((v === 1) !== (m[2] === 'pair'))) return 'option "' + s + '" has the wrong singular/plural';
        return (v >= 0 && v <= 4) ? null : 'option ' + s + ' is outside 0~4 pairs';
      }
      if (genId === 'splitRight' || genId === 'turnPair'){
        m = (lang === 'zh') ? /^(\d+) 度$/.exec(s) : /^(\d+) degrees$/.exec(s);
        if (!m) return 'option "' + s + '" is not an angle in degrees';
        const v = Number(m[1]);
        if (isCorrect && genId === 'turnPair' && v !== 90) return 'the correct answer for a pair turned together must be 90 degrees';
        return (v >= 1 && v <= DEG_MAX_REF) ? null : 'option ' + s + ' is outside 1~180 degrees';
      }
      /* 其餘都是「n 公分」。 */
      m = /^(\d+) (公分|cm)$/.exec(s);
      if (!m) return 'option "' + s + '" is not a length in centimetres';
      if ((lang === 'zh') !== (m[2] === '公分')) return 'option "' + s + '" uses the wrong language for the unit';
      const v = Number(m[1]);
      return (v >= 1 && v <= LEN_MAX_REF) ? null : 'option ' + s + ' is outside 1~40 cm';
    },

    /* 拿渲染出來的那一題再驗一次：題幹整句重建、圖的幾何、文字、算式、誘答抄題幹。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!d) return 'make() returned nothing';
      const want = STEM_EXACT[genId] ? STEM_EXACT[genId](d)[lang] : null;
      if (want === null || want === undefined) out.push('no exact stem for ' + genId);
      else if (q.stem !== want) out.push('stem is not the expected sentence: "' + plainText(q.stem).slice(0, 90) + '"');
      arithProblems(q.stem + ' ' + q.why).problems.forEach(p => out.push('why/stem: ' + p));
      ['stem', 'why'].forEach(k => textProblems(q[k], lang, k).forEach(p => out.push(p)));
      q.opts.forEach((o, i) => textProblems(o, lang, 'option ' + i).forEach(p => out.push(p)));

      /* 誘答抄題幹的數字。 */
      const stemNums = numbersIn(plainText(q.stem).replace(/一格是 1 公分|One square on the grid is 1 cm/g, ' '));
      q.opts.forEach(function(o, i){
        if (i === q.ans) return;
        const m = /^(\d+)\b/.exec(String(o));
        if (!m) return;
        const v = Number(m[1]);
        if (stemNums.indexOf(v) >= 0 && !(STEM_ECHO_ALLOWED[genId] && STEM_ECHO_ALLOWED[genId](d, v)))
          out.push('distractor ' + o + ' copies a number out of the stem');
      });

      /* 有圖沒圖要對得上，圖上不可以有文字，圖說不可以把被問的那個數算出來。 */
      const wantFig = FIG_GENS.indexOf(genId) >= 0;
      if (wantFig && !q.fig) out.push('this generator must come with a figure');
      if (!wantFig && q.fig) out.push('this generator must not come with a figure');
      if (q.fig){
        if (!q.cap) out.push('a figure with no caption');
        const capNums = numbersIn(String(q.cap).replace(/一格 1 公分|One square is 1 cm/g, ' '));
        if (capNums.length) out.push('figure caption contains a number: ' + q.cap);
        figProblems(q.fig, genId, d).forEach(p => out.push(p));
      }

      /* 解釋要真的講到正解那一件事。 */
      const whyNums = numbersIn(plainText(q.why));
      if (genId === 'perpDist' && (whyNums.indexOf(d.d) < 0 || whyNums.indexOf(d.slant) < 0)) out.push('why should give both the perpendicular length and the slanted one');
      if (genId === 'paraWidth' && (whyNums.indexOf(d.gap) < 0 || whyNums.indexOf(d.slant) < 0)) out.push('why should give both the width and the slanted measurement');
      if (genId === 'slantLonger' && whyNums.indexOf(d.longer) < 0) out.push('why should name the only possible length');
      if (genId === 'threeLines'){
        const says = lang === 'zh' ? (d.sameSide ? /相減/ : /相加/) : (d.sameSide ? /subtraction/ : /added/);
        if (!says.test(q.why)) out.push('why must say whether the two gaps are added or subtracted, matching the arrangement');
      }
      if (genId === 'splitRight' && whyNums.indexOf(90) < 0) out.push('why must say that a right angle is 90 degrees');
      if (genId === 'turnPair' && whyNums.indexOf(90) < 0) out.push('why must say the angle is still 90 degrees');
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{FIG_W, FIG_H, GW, GH, U, OX, OY, TOOL_L, TOOL_L3, RULER_LEN, RULER_W, MARK_S, DOT_R, DOT_R_S, ' +
                'add, sub, scale, dot, norm, unit, perp, segLen, P, clipLine, rightMark, toolPts, rulerPts, ' +
                'S1_A, S1_D, S1_VSTART, S1_CASES, S1_STEPS, perpPlan, S2_CASES, distData, distPlan, ' +
                'S3_A, S3_D, S3_VSTART, S3_PT, S3_STEPS, paraPlan, S4_CASES, widthData, widthPlan, ' +
                'S5_A, S5_D, S5_CASES, relData, relPlan, QUIZ_DIST, QUIZ_CROSS, crossPlan, QUIZ_FIGS, ' +
                'GAME_ORDER, GAME_W, pick, inBox, boxDist, gXY, segDist, gClip, ' +
                'SLIDE_G, GAME_SLIDE, slideStop, slideDot, slideTri, slideGrip, slideIdx, slideIdxFromGrip, slideOnLine, slideKind, slideDir, ' +
                'STR_G, GAME_STRING, strPeg, strFoot, strDist, strLen, strIdx, strLabel, strOnLine, strKind, strDir, ' +
                'GAME_STEPS, GAME_STEPS_DECOY, STEPS_G, stepsSlot, stepsNearest, stepsKind, stepsPlan, ' +
                'WIDTH_G, GAME_WIDTH, widthLayout, widthSegs, widthWant, widthBin, widthSpot, ' +
                'REL_G, GAME_REL, relStop, relPerp, relLines, relBoxes, relLabel, relHit, relKind}',
    optionValueMax: LEN_MAX_REF,

    check: function(data, I18N, fail, rawSrc){
      const sib = siblingSources();

      /* ---------- 1) 常數與畫布 ---------- */
      if (data.FIG_W !== FIG_W_REF || data.FIG_H !== FIG_H_REF) fail('the canvas must be ' + FIG_W_REF + '×' + FIG_H_REF);
      if (data.GW !== GW_REF || data.GH !== GH_REF) fail('the grid must be ' + GW_REF + ' × ' + GH_REF + ' squares');
      if (data.U !== U_REF || data.OX !== OX_REF || data.OY !== OY_REF) fail('one square must be ' + U_REF + 'px with its bottom-left corner at (' + OX_REF + ', ' + OY_REF + ')');
      if (data.MARK_S !== MARK_S_REF) fail('the right-angle mark must be ' + MARK_S_REF + ' squares');
      if (data.TOOL_L !== TOOL_L_REF || data.TOOL_L3 !== TOOL_L3_REF) fail('the set square legs must be ' + TOOL_L_REF + ' and ' + TOOL_L3_REF + ' squares');
      if (data.RULER_LEN !== RULER_LEN_REF || data.RULER_W !== RULER_W_REF) fail('the ruler must be ' + RULER_LEN_REF + ' × ' + RULER_W_REF + ' squares');
      if (data.DOT_R !== DOT_R_REF || data.DOT_R_S !== DOT_R_S_REF) fail('the dot radii must be ' + DOT_R_REF + ' and ' + DOT_R_S_REF + 'px');
      /* ⚠️ 這兩條要驗**頁面的**常數，驗參考常數的話它們永遠不會響。 */
      if (data.OX + data.GW * data.U > data.FIG_W) fail('the grid is wider than the canvas');
      if (data.OY - data.GH * data.U < 0) fail('the grid is taller than the canvas');

      /* ---------- 2) 每一張圖：量畫出來的座標 ---------- */
      /* 印出 planProblems 的每一筆，並回報「這張圖的形狀有沒有壞掉」——
         壞掉的話呼叫端必須停手，不要再走訪它。 */
      const checkPlan = (plan, label, want) => {
        const pp = planProblems(plan, label, want);
        pp.forEach(fail);
        return !pp.shapeBad;
      };
      /* want ＝ 這張圖裡「可以擺直角記號」的那些點（畫布座標）。不傳就不驗位置。 */
      const planProblems = (plan, label, want) => {
        const out = [];
        if (!plan){ out.push(label + ': no plan'); out.shapeBad = true; return out; }
        /* ⚠️ 響亮地失敗，不要安靜地爆炸：形狀不對就報出來，不要讓 forEach 丟 TypeError
           （例外會讓整份報告變成 stack trace，真正的錯誤訊息反而看不到）。 */
        if (!Array.isArray(plan.lines) || !Array.isArray(plan.marks) || !Array.isArray(plan.dots) || !Array.isArray(plan.polys)){
          out.push(label + ': the plan does not have lines/marks/dots/polys arrays'); out.shapeBad = true; return out;
        }
        /* ⚠️ 巢狀的東西也要先驗形狀再走訪：直接 forEach 進去的話，壞掉的資料會丟
           TypeError，整份報告變成 stack trace，真正的錯誤訊息反而看不到。 */
        /* ⚠️ 逐一（用索引，不用 some／forEach）驗：稀疏陣列的洞會被 some 與 forEach **跳過**，
           `[a, , c]` 這種洞就會靜靜溜過去。 */
        let shapeBad = false;
        for (let i = 0; i < plan.lines.length; i++){
          const l = plan.lines[i];
          if (!l || !l.a || !l.b || !num(l.a.x) || !num(l.a.y) || !num(l.b.x) || !num(l.b.y)){ out.push(label + ': line ' + i + ' has no usable endpoints'); shapeBad = true; }
        }
        for (let i = 0; i < plan.marks.length; i++){
          const m = plan.marks[i];
          let okm = Array.isArray(m) && m.length === 3;
          if (okm) for (let k = 0; k < 3; k++) if (!m[k] || !num(m[k].x) || !num(m[k].y)) okm = false;
          if (!okm){ out.push(label + ': right-angle mark ' + i + ' is not three usable points'); shapeBad = true; }
        }
        for (let i = 0; i < plan.dots.length; i++){
          const dt = plan.dots[i];
          if (!dt || !dt.p || !num(dt.p.x) || !num(dt.p.y)){ out.push(label + ': dot ' + i + ' has no usable position'); shapeBad = true; }
        }
        for (let i = 0; i < plan.polys.length; i++){
          const po = plan.polys[i];
          let okp = po && Array.isArray(po.pts) && po.pts.length >= 3;
          if (okp) for (let k = 0; k < po.pts.length; k++) if (!po.pts[k] || !num(po.pts[k].x) || !num(po.pts[k].y)) okp = false;
          if (!okp){ out.push(label + ': tool ' + i + ' has no usable points'); shapeBad = true; }
        }
        /* ⚠️ 這個旗標一定要傳回去給呼叫端：只 return out 的話，呼叫端接著
           plan.lines.filter(l => l.kind …) 就會在壞掉的資料上丟例外，
           整份報告變成 stack trace，真正的錯誤訊息反而看不到。 */
        if (shapeBad){ out.shapeBad = true; return out; }
        const pts = [];
        plan.lines.forEach(l => { pts.push(l.a, l.b); });
        plan.marks.forEach(m => m.forEach(p => pts.push(p)));
        plan.dots.forEach(dt => pts.push(dt.p));
        plan.polys.forEach(po => po.pts.forEach(p => pts.push(p)));
        pts.forEach(p => {
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) out.push(label + ': a coordinate is not a number');
          else if (p.x < MARGIN_REF || p.y < MARGIN_REF || p.x > FIG_W_REF - MARGIN_REF || p.y > FIG_H_REF - MARGIN_REF)
            out.push(label + ': a point falls outside the canvas at (' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ')');
        });
        plan.lines.forEach((l, i) => { if (len2(vecOf(l)) < 1) out.push(label + ': line ' + i + ' has no length'); });
        plan.marks.forEach((m, i) => {
          const u = [m[1].x - m[0].x, m[1].y - m[0].y], v = [m[2].x - m[1].x, m[2].y - m[1].y];
          if (!isPerpDrawn(u, v)) out.push(label + ': right-angle mark ' + i + ' is not a right angle');
          if (Math.abs(len2(u) - MARK_S_REF * U_REF) > 1e-6 || Math.abs(len2(v) - MARK_S_REF * U_REF) > 1e-6)
            out.push(label + ': right-angle mark ' + i + ' is the wrong size');
        });
        /* ⚠️ 「記號是不是直角」和「記號畫在哪裡」是兩件事：一個畫得完美的小方框
           被搬到別的角落、或畫到圖形外面，上面那幾條全部照樣是綠的
           （grade-4-angle-shape 就是這樣被鏡射到圖形外面的）。
           ⚠️ 而且要比**多重集合**，不是「是不是清單裡的某一點」—— 後者放行「四個記號
           全部疊在同一個允許的點上」，也放行「該標 A 的記號被搬到 B」。 */
        if (Array.isArray(want)) markPlaceProblems(plan.marks, want, label).forEach(x => out.push(x));
        return out;
      };

      /* --- 範例 1：畫垂線。 --- */
      const s1BaseDir = [S1_D_REF[0], -S1_D_REF[1]];       // 畫布 y 是反的
      if (!eqJ(data.S1_A, S1_A_REF) || !eqJ(data.S1_D, S1_D_REF)) fail('example 1 must use the line through ' + JSON.stringify(S1_A_REF) + ' in direction ' + JSON.stringify(S1_D_REF));
      if (!eqJ(data.S1_VSTART, S1_VSTART_REF)) fail('example 1 must start the set square at ' + JSON.stringify(S1_VSTART_REF));
      if (data.S1_STEPS !== S1_STEPS_REF) fail('example 1 must have ' + S1_STEPS_REF + ' steps');
      if (data.S1_CASES.length !== S1_CASES_REF.length) fail('example 1 must have ' + S1_CASES_REF.length + ' cases');
      /* ⚠️ 斜的直線是這一課的重點（垂直和「一橫一直」無關），所以基準線不可以是水平或垂直的。 */
      if (data.S1_D[0] === 0 || data.S1_D[1] === 0) fail('example 1 must use a slanted line, or it teaches that perpendicular means level-and-upright');
      S1_CASES_REF.forEach((ref, ci) => {
        const cs = data.S1_CASES[ci];
        if (!cs){ fail('example 1 case ' + ci + ' is missing'); return; }
        /* ⚠️ 這幾條結構性斷言一律驗**頁面的**資料（cs），不是驗設定檔自己的常數（ref）——
           驗 ref 的話它們永遠不會響，就變成一條假的覆蓋率。而且要排在
           「和參考完全一樣」之前，不然任何改動都先撞上那一條，這幾條從來沒被證明過。 */
        const rel = [cs.foot[0] - S1_A_REF[0], cs.foot[1] - S1_A_REF[1]];
        if (rel[0] * S1_D_REF[1] - rel[1] * S1_D_REF[0] !== 0) fail('example 1 case ' + cs.id + ': the foot is not on the line');
        const drop = [cs.pt[0] - cs.foot[0], cs.pt[1] - cs.foot[1]];
        if (drop[0] * S1_D_REF[0] + drop[1] * S1_D_REF[1] !== 0) fail('example 1 case ' + cs.id + ': the point is not perpendicular to the line from the foot');
        if (cs.id === 'onLine' && !eqJ(cs.pt, cs.foot)) fail('example 1 onLine: the point must be on the line');
        if (cs.id === 'offLine' && eqJ(cs.pt, cs.foot)) fail('example 1 offLine: the point must not be on the line');
        if (cs.id !== ref.id || !eqJ(cs.pt, ref.pt) || !eqJ(cs.foot, ref.foot)){ fail('example 1 case ' + ci + ' does not match the reference'); return; }

        for (let step = 0; step < S1_STEPS_REF; step++){
          const label = 'example 1 ' + ref.id + ' step ' + step;
          const plan = data.perpPlan(ci, step);
          /* 直角記號：步驟 0~2 畫在三角板的直角頂點上，步驟 3 畫在垂足上。 */
          const markAt = (step === 0) ? S1_VSTART_REF : cs.foot;
          if (!checkPlan(plan, label, [refP(markAt)])) continue;
          const base = plan.lines.filter(l => l.kind === 'base');
          if (base.length !== 1){ fail(label + ': the original line must be drawn exactly once'); continue; }
          if (!isParaDrawn(vecOf(base[0]), s1BaseDir)) fail(label + ': the original line is drawn in the wrong direction');
          const drawn = plan.lines.filter(l => l.kind === 'drawn');
          if ((step >= 2) !== (drawn.length === 1)) fail(label + ': the perpendicular must appear from step 2 onwards, exactly once');
          if (drawn.length){
            /* ⚠️ 這是這一課的核心斷言：畫出來的線和原來那條的夾角**量起來**要剛好 90 度。 */
            if (!isPerpDrawn(vecOf(drawn[0]), vecOf(base[0]))) fail(label + ': the line drawn is not at 90 degrees to the original — measured from the rendered coordinates');
            if (pointToSeg(refP(ref.pt), drawn[0]) > 1e-6) fail(label + ': the line drawn does not pass through the point');
            if (pointToSeg(refP(ref.foot), base[0]) > 1e-6) fail(label + ': the foot is not on the original line');
          }
          const tools = plan.polys.filter(p => p.kind === 'tool');
          if ((step <= 2) !== (tools.length === 1)) fail(label + ': the set square must be shown for steps 0~2 only');
          if (tools.length){
            const T = tools[0].pts;
            if (T.length !== 3){ fail(label + ': the set square is not a triangle'); continue; }
            const legA = [T[1].x - T[0].x, T[1].y - T[0].y], legB = [T[2].x - T[0].x, T[2].y - T[0].y];
            /* 45／45／90：兩條直角邊等長而且互相垂直 —— 「貼住的是直角邊，不是斜邊」靠這一條。 */
            if (!isPerpDrawn(legA, legB)) fail(label + ': the set square corner is not a right angle');
            if (Math.abs(len2(legA) - len2(legB)) > 1e-6) fail(label + ': the two sides of the right angle are not equal');
            if (Math.abs(len2(legA) - TOOL_L_REF * U_REF) > 1e-6) fail(label + ': the set square leg is not ' + TOOL_L_REF + ' squares long');
            /* 貼住直線的那一條腿必須真的躺在直線上（兩個端點都在線上）。 */
            if (!isParaDrawn(legA, s1BaseDir)) fail(label + ': the leg on the line is not along the line');
            if (pointToSeg(T[0], base[0]) > 1e-6 || pointToSeg(T[1], base[0]) > 1e-6) fail(label + ': the set square is not resting on the line');
            const V = toGrid(T[0]);
            const wantV = (step === 0) ? S1_VSTART_REF : ref.foot;
            if (Math.abs(V[0] - wantV[0]) > 1e-9 || Math.abs(V[1] - wantV[1]) > 1e-9) fail(label + ': the right-angle corner is at ' + JSON.stringify(V.map(x => +x.toFixed(3))) + ', expected ' + JSON.stringify(wantV));
            /* 步驟 1 以後，畫線的那一條腿一定要通過那個點 —— 這就是「滑到定位」的定義。 */
            if (step >= 1 && pointToSeg(refP(ref.pt), { a:T[0], b:T[2] }) > 1e-6) fail(label + ': after sliding, the drawing side of the right angle does not pass through the point');
          }
          if (plan.marks.length !== 1) fail(label + ': there must be exactly one right-angle mark');
          if (plan.polys.some(p => p.kind === 'ruler')) fail(label + ': example 1 uses no ruler');
        }
      });

      /* --- 範例 2：點到直線的距離。 --- */
      if (data.S2_CASES.length !== S2_CASES_REF.length) fail('example 2 must have ' + S2_CASES_REF.length + ' cases');
      let sawVertical = false;
      S2_CASES_REF.forEach((ref, ci) => {
        const cs = data.S2_CASES[ci];
        if (!cs){ fail('example 2 case ' + ci + ' is missing'); return; }
        /* ⚠️ 「有沒有一組是直的直線」要看**頁面的**資料，而且要排在「和參考完全一樣」
           之前 —— 看設定檔自己的常數的話它永遠不會響，就是一條假的覆蓋率。 */
        if (cs.axis === 'v') sawVertical = true;
        if (cs.id !== ref.id || cs.axis !== ref.axis || cs.at !== ref.at || !eqJ(cs.pt, ref.pt) || !eqJ(cs.offs, ref.offs)){
          fail('example 2 case ' + ci + ' does not match the reference'); return;
        }
        const label = 'example 2 ' + (cs.id || ref.id);
        const dd = data.distData(cs);
        const dist = distRef(ref);
        if (Math.abs(dd.dist - dist) > 1e-9) fail(label + ': the page distance disagrees with the reference');
        if (!isWholeCm(dist)) fail(label + ': the distance is not a whole number of centimetres');
        if (dist === 0) fail(label + ': the point is on the line, so there is no shortest segment to talk about');
        /* 窮舉：直線上每一個格點都試一次，垂足必須是唯一的最小值。 */
        const sf = shortestFootRef(ref);
        if (sf.ties !== 1) fail(label + ': the shortest segment is not unique, so "the perpendicular one is shortest" is not demonstrated');
        if (Math.abs(sf.min - dist) > 1e-9) fail(label + ': a foot other than the perpendicular one is at least as close');
        dd.segs.forEach((s, si) => {
          if (!isWholeCm(s.len)) fail(label + ' segment ' + si + ': ' + s.len.toFixed(4) + ' cm is not a whole number, so the child cannot read it off');
          if (!s.isPerp && !(s.len > dist + 1e-9)) fail(label + ' segment ' + si + ': a slanted segment is not longer than the perpendicular one');
        });
        if (dd.segs.filter(s => s.isPerp).length !== 1) fail(label + ': exactly one segment must be the perpendicular one');
        if (dd.segs.filter(s => !s.isPerp).length < 2) fail(label + ': at least two slanted segments are needed for the contrast');
        const plan = data.distPlan(cs);
        /* 垂足的**兩側**各畫一個記號，所以那個點要列兩次（多重集合）。 */
        if (!checkPlan(plan, label, [refP(footRef(cs)), refP(footRef(cs))])) return;
        const base = plan.lines.filter(l => l.kind === 'base');
        const perpSegs = plan.lines.filter(l => l.kind === 'perp');
        const slantSegs = plan.lines.filter(l => l.kind === 'slant');
        if (base.length !== 1) fail(label + ': the line must be drawn exactly once');
        if (perpSegs.length !== 1) fail(label + ': exactly one purple perpendicular segment');
        if (slantSegs.length !== dd.segs.length - 1) fail(label + ': every slanted segment must be drawn');
        if (base.length && perpSegs.length){
          if (!isPerpDrawn(vecOf(perpSegs[0]), vecOf(base[0]))) fail(label + ': the purple segment is not at 90 degrees to the line — measured from the rendered coordinates');
          if (Math.abs(cmOf(perpSegs[0]) - dist) > 1e-9) fail(label + ': the purple segment is drawn ' + cmOf(perpSegs[0]).toFixed(3) + ' cm long but the distance is ' + dist);
          slantSegs.forEach((l, i) => {
            if (isPerpDrawn(vecOf(l), vecOf(base[0]))) fail(label + ': an orange segment is drawn perpendicular, so it is not a slanted one');
            if (!(cmOf(l) > dist + 1e-9)) fail(label + ': orange segment ' + i + ' is not drawn longer than the purple one');
          });
        }
        if (plan.marks.length !== 2) fail(label + ': the right-angle mark must be drawn on both sides of the foot');
        if (plan.dots.filter(dt => dt.kind === 'point').length !== 1) fail(label + ': exactly one red point');
        if (plan.dots.filter(dt => dt.kind === 'foot').length !== 1) fail(label + ': exactly one green foot');
      });
      if (!sawVertical) fail('example 2 must include a vertical line, or the lesson only ever shows level ones');

      /* --- 範例 3：畫平行線。 --- */
      if (!eqJ(data.S3_A, S3_A_REF) || !eqJ(data.S3_D, S3_D_REF)) fail('example 3 must use the line through ' + JSON.stringify(S3_A_REF) + ' in direction ' + JSON.stringify(S3_D_REF));
      if (!eqJ(data.S3_VSTART, S3_VSTART_REF) || !eqJ(data.S3_PT, S3_PT_REF)) fail('example 3 must slide from ' + JSON.stringify(S3_VSTART_REF) + ' to ' + JSON.stringify(S3_PT_REF));
      if (data.S3_STEPS !== S3_STEPS_REF) fail('example 3 must have ' + S3_STEPS_REF + ' steps');
      if (data.S3_D[0] === 0 || data.S3_D[1] === 0) fail('example 3 must use a slanted line too');
      {
        /* ⚠️ 全部驗**頁面的**資料，而且排在「和參考完全一樣」之前。 */
        const relStart = [data.S3_VSTART[0] - data.S3_A[0], data.S3_VSTART[1] - data.S3_A[1]];
        if (relStart[0] * data.S3_D[1] - relStart[1] * data.S3_D[0] !== 0) fail('example 3: the set square does not start on the line');
        /* ⚠️ 那個點**不可以**在直線上：點在線上畫出來的是同一條線，這一課明講了。 */
        const relPt = [data.S3_PT[0] - data.S3_A[0], data.S3_PT[1] - data.S3_A[1]];
        if (relPt[0] * data.S3_D[1] - relPt[1] * data.S3_D[0] === 0) fail('example 3: the point is on the line, so the parallel drawn would be the same line');
        const slide = [data.S3_PT[0] - data.S3_VSTART[0], data.S3_PT[1] - data.S3_VSTART[1]];
        if (slide[0] * data.S3_D[0] + slide[1] * data.S3_D[1] !== 0) fail('example 3: the slide is not along the ruler (perpendicular to the line)');
      }
      const s3BaseDir = [S3_D_REF[0], -S3_D_REF[1]];
      let ruler1 = null;
      for (let step = 0; step < S3_STEPS_REF; step++){
        const label = 'example 3 step ' + step;
        const plan = data.paraPlan(step);
        /* 直角記號跟著三角板的直角頂點走；步驟 4 工具拿開了，一個都不該有。 */
        if (!checkPlan(plan, label, step > 3 ? [] : [refP(step <= 1 ? S3_VSTART_REF : S3_PT_REF)])) continue;
        const base = plan.lines.filter(l => l.kind === 'base');
        const drawn = plan.lines.filter(l => l.kind === 'drawn');
        if (base.length !== 1){ fail(label + ': the original line must be drawn exactly once'); continue; }
        if (!isParaDrawn(vecOf(base[0]), s3BaseDir)) fail(label + ': the original line is drawn in the wrong direction');
        if ((step >= 3) !== (drawn.length === 1)) fail(label + ': the parallel must appear from step 3 onwards, exactly once');
        if (drawn.length){
          /* 核心斷言：畫出來的線和原來那條**量起來**要剛好平行，而且不可以是同一條線。 */
          if (!isParaDrawn(vecOf(drawn[0]), vecOf(base[0]))) fail(label + ': the line drawn is not parallel to the original — measured from the rendered coordinates');
          if (pointToSeg(refP(S3_PT_REF), drawn[0]) > 1e-6) fail(label + ': the line drawn does not pass through the point');
          if (pointToSeg(drawn[0].a, base[0]) < 1e-6 && pointToSeg(drawn[0].b, base[0]) < 1e-6) fail(label + ': the line drawn is the same line as the original');
        }
        const tools = plan.polys.filter(p => p.kind === 'tool');
        const rulers = plan.polys.filter(p => p.kind === 'ruler');
        if ((step <= 3) !== (tools.length === 1)) fail(label + ': the set square must be shown for steps 0~3 only');
        if ((step >= 1 && step <= 3) !== (rulers.length === 1)) fail(label + ': the ruler must be shown for steps 1~3 only');
        if (tools.length){
          const T = tools[0].pts;
          if (T.length !== 3){ fail(label + ': the set square is not a triangle'); continue; }
          const legA = [T[1].x - T[0].x, T[1].y - T[0].y], legB = [T[2].x - T[0].x, T[2].y - T[0].y];
          if (!isPerpDrawn(legA, legB)) fail(label + ': the set square corner is not a right angle');
          if (Math.abs(len2(legA) - len2(legB)) > 1e-6) fail(label + ': the two sides of the right angle are not equal');
          if (Math.abs(len2(legA) - TOOL_L3_REF * U_REF) > 1e-6) fail(label + ': the set square leg is not ' + TOOL_L3_REF + ' squares long');
          /* 畫線的那一條邊，方向從頭到尾都不可以變 —— 那正是「滑動不改變方向」。 */
          if (!isParaDrawn(legA, s3BaseDir)) fail(label + ': the drawing edge of the set square is no longer parallel to the line, so sliding changed its direction');
          const V = toGrid(T[0]);
          const wantV = (step <= 1) ? S3_VSTART_REF : S3_PT_REF;
          if (Math.abs(V[0] - wantV[0]) > 1e-9 || Math.abs(V[1] - wantV[1]) > 1e-9) fail(label + ': the set square corner is at ' + JSON.stringify(V.map(x => +x.toFixed(3))) + ', expected ' + JSON.stringify(wantV));
          if (step <= 1 && pointToSeg(T[0], base[0]) > 1e-6) fail(label + ': before sliding, the set square must rest on the line');
          if (step >= 2 && pointToSeg(refP(S3_PT_REF), { a:T[0], b:T[1] }) > 1e-6) fail(label + ': after sliding, the drawing edge does not pass through the point');
        }
        if (rulers.length){
          const R = rulers[0].pts;
          if (R.length !== 4) fail(label + ': the ruler is not a rectangle');
          else {
            const e1 = [R[1].x - R[0].x, R[1].y - R[0].y], e2 = [R[3].x - R[0].x, R[3].y - R[0].y];
            if (!isPerpDrawn(e1, e2)) fail(label + ': the ruler is not a rectangle');
            if (Math.abs(len2(e1) - RULER_LEN_REF * U_REF) > 1e-6) fail(label + ': the ruler is the wrong length');
            if (Math.abs(len2(e2) - RULER_W_REF * U_REF) > 1e-6) fail(label + ': the ruler is the wrong width');
            /* 滑軌的工作邊必須和直線垂直 —— 三角板就是沿著它滑過去的。 */
            if (!isPerpDrawn(e1, vecOf(base[0]))) fail(label + ': the ruler edge is not perpendicular to the line, so it is not the rail the set square slides along');
            /* ⚠️ 直尺是滑軌，從頭到尾不可以動。 */
            if (!ruler1) ruler1 = R;
            else if (!R.every((p, i) => samePt(p, ruler1[i]))) fail(label + ': the ruler moved — it is the rail and must be held still');
          }
        }
      }

      /* --- 範例 4：平行線之間處處等寬。 --- */
      if (data.S4_CASES.length !== S4_CASES_REF.length) fail('example 4 must have ' + S4_CASES_REF.length + ' cases');
      S4_CASES_REF.forEach((ref, ci) => {
        const cs = data.S4_CASES[ci];
        if (!cs || cs.id !== ref.id || cs.axis !== ref.axis || cs.a !== ref.a || cs.b !== ref.b || !eqJ(cs.perpAt, ref.perpAt) || !eqJ(cs.slant, ref.slant)){
          fail('example 4 case ' + ci + ' does not match the reference'); return;
        }
        const label = 'example 4 ' + ref.id;
        const wd = data.widthData(cs);
        /* 窮舉：兩條線之間每一個格點位置都量一次，全部要相等。 */
        const vals = widthEverywhereRef(ref);
        if (!vals.every(v => Math.abs(v - vals[0]) < 1e-9)) fail(label + ': the perpendicular width is not the same everywhere');
        if (Math.abs(wd.gap - vals[0]) > 1e-9) fail(label + ': the page width disagrees with the reference');
        if (!isWholeCm(wd.gap)) fail(label + ': the width is not a whole number of centimetres');
        if (ref.perpAt[0] === ref.perpAt[1]) fail(label + ': the two perpendicular measurements are taken in the same place, so "everywhere" is not shown');
        const perps = wd.segs.filter(s => s.isPerp), slants = wd.segs.filter(s => !s.isPerp);
        if (perps.length !== 2) fail(label + ': exactly two perpendicular measurements');
        if (slants.length !== 1) fail(label + ': exactly one slanted measurement');
        perps.forEach((s, i) => { if (Math.abs(s.len - wd.gap) > 1e-9) fail(label + ' perpendicular ' + i + ': ' + s.len.toFixed(4) + ' cm, expected ' + wd.gap); });
        slants.forEach(s => {
          if (!isWholeCm(s.len)) fail(label + ': the slanted measurement is not a whole number of centimetres');
          if (!(s.len > wd.gap + 1e-9)) fail(label + ': the slanted measurement is not longer than the width, so the warning has no example');
        });
        const plan = data.widthPlan(cs);
        /* 直角記號只能畫在兩段垂直量的四個端點上。 */
        const wantMarks = [];
        wd.segs.forEach(sg => { if (sg.isPerp){ wantMarks.push(refP(sg.a), refP(sg.b)); } });
        if (!checkPlan(plan, label, wantMarks)) return;
        const base = plan.lines.filter(l => l.kind === 'base');
        if (base.length !== 2){ fail(label + ': two parallel lines must be drawn'); return; }
        if (!isParaDrawn(vecOf(base[0]), vecOf(base[1]))) fail(label + ': the two lines are not drawn parallel — measured from the rendered coordinates');
        /* ⚠️ 「處處一樣寬」要量**畫出來的**兩條線，沿線取樣好幾個位置。 */
        renderedGapProblems(base[0], base[1], wd.gap, label).forEach(fail);
        plan.lines.filter(l => l.kind === 'perp').forEach((l, i) => {
          if (!isPerpDrawn(vecOf(l), vecOf(base[0]))) fail(label + ': purple measurement ' + i + ' is not perpendicular to the lines');
          if (Math.abs(cmOf(l) - wd.gap) > 1e-9) fail(label + ': purple measurement ' + i + ' is drawn ' + cmOf(l).toFixed(3) + ' cm, expected ' + wd.gap);
        });
        plan.lines.filter(l => l.kind === 'slant').forEach(l => {
          if (isPerpDrawn(vecOf(l), vecOf(base[0]))) fail(label + ': the orange measurement is drawn perpendicular, so it is not a slanted one');
          if (!(cmOf(l) > wd.gap + 1e-9)) fail(label + ': the orange measurement is not drawn longer than the width');
        });
        if (plan.marks.length !== 4) fail(label + ': both ends of both perpendicular measurements need a right-angle mark');
      });
      /* 兩組要一橫一直，不然「和一橫一直無關」那句話沒有被示範。 */
      if (new Set(data.S4_CASES.map(c => c.axis)).size !== 2) fail('example 4 must show one level pair and one upright pair');

      /* --- 範例 5：都垂直於同一條線 → 互相平行。 --- */
      if (!eqJ(data.S5_A, S5_A_REF) || !eqJ(data.S5_D, S5_D_REF)) fail('example 5 must use the line through ' + JSON.stringify(S5_A_REF) + ' in direction ' + JSON.stringify(S5_D_REF));
      if (data.S5_CASES.length !== S5_CASES_REF.length) fail('example 5 must have ' + S5_CASES_REF.length + ' cases');
      let sawBoth = false, sawOnly = false;
      S5_CASES_REF.forEach((ref, ci) => {
        const cs = data.S5_CASES[ci];
        if (!cs || cs.id !== ref.id || !eqJ(cs.aAt, ref.aAt) || !eqJ(cs.aDir, ref.aDir) || !eqJ(cs.bAt, ref.bAt) || !eqJ(cs.bDir, ref.bDir)){
          fail('example 5 case ' + ci + ' does not match the reference'); return;
        }
        const label = 'example 5 ' + ref.id;
        const rd = data.relData(cs);
        const plan = data.relPlan(cs);
        /* 只有**真的是直角**的那些交點才該有記號 —— 兩個都列的話，「只有甲垂直」那一組
           把唯一的記號搬到乙身上也會通過。 */
        /* ⚠️ 期望值一律用設定檔自己的 relData2()（量角）算，不可以用頁面的 relData()
           —— 那是拿頁面當自己的神諭，頁面判錯的時候期望值會跟著一起錯。 */
        const rd2 = relData2(cs, data.S5_D);
        if (rd2.bad) fail(label + ': the case has no usable directions');
        const wantRelMarks = [];
        if (rd2.aPerp) wantRelMarks.push(refP(cs.aAt));
        if (rd2.bPerp) wantRelMarks.push(refP(cs.bAt));
        if (!checkPlan(plan, label, wantRelMarks)) return;
        const base = plan.lines.filter(l => l.kind === 'base');
        const la = plan.lines.filter(l => l.kind === 'drawn');
        const lb = plan.lines.filter(l => l.kind === 'perp');
        if (base.length !== 1 || la.length !== 1 || lb.length !== 1){ fail(label + ': C, A and B must each be drawn exactly once'); return; }
        /* 第二套判定：量畫出來的角。頁面用整數內積，這裡用 atan2。 */
        const aPerpDrawn = isPerpDrawn(vecOf(la[0]), vecOf(base[0]));
        const bPerpDrawn = isPerpDrawn(vecOf(lb[0]), vecOf(base[0]));
        const paraDrawn = isParaDrawn(vecOf(la[0]), vecOf(lb[0]));
        if (aPerpDrawn !== rd.aPerp) fail(label + ': the page says A is' + (rd.aPerp ? '' : ' not') + ' perpendicular to C, but the drawing says otherwise');
        if (bPerpDrawn !== rd.bPerp) fail(label + ': the page says B is' + (rd.bPerp ? '' : ' not') + ' perpendicular to C, but the drawing says otherwise');
        if (paraDrawn !== rd.parallel) fail(label + ': the page says A and B are' + (rd.parallel ? '' : ' not') + ' parallel, but the drawing says otherwise');
        /* 這一課教的規則：兩條都垂直 ⇔ 互相平行。 */
        if ((aPerpDrawn && bPerpDrawn) !== paraDrawn) fail(label + ': "both perpendicular to C" and "parallel to each other" disagree, so the rule of this example is not demonstrated');
        /* 只有真的是直角的地方才可以有小方框。 */
        const wantMarks = (rd.aPerp ? 1 : 0) + (rd.bPerp ? 1 : 0);
        if (plan.marks.length !== wantMarks) fail(label + ': ' + plan.marks.length + ' right-angle marks drawn but only ' + wantMarks + ' corner(s) are right angles');
        if (rd.abPerp) fail(label + ': A and B are perpendicular to each other, so that distractor would be true');
        if (ref.id === 'both'){ sawBoth = true; if (!rd.bothPerp || !rd.parallel) fail(label + ': this case must have both lines perpendicular to C and parallel to each other'); }
        if (ref.id === 'onlyA'){ sawOnly = true; if (rd.bothPerp || rd.parallel) fail(label + ': this case must have exactly one perpendicular and no parallel'); }
      });
      if (!sawBoth || !sawOnly) fail('example 5 must show both the "both perpendicular" case and the "only one" case');

      /* --- 試題的兩張圖。 --- */
      {
        const qd = data.QUIZ_FIGS.qDist();
        const qdOk = checkPlan(qd, 'quiz figure qDist', [refP(footRef(QUIZ_DIST_REF)), refP(footRef(QUIZ_DIST_REF))]);
        if (!qdOk) return;
        const base = qd.lines.filter(l => l.kind === 'base')[0];
        const pp = qd.lines.filter(l => l.kind === 'perp')[0];
        if (!base || !pp) fail('quiz figure qDist: needs a line and a perpendicular segment');
        else {
          if (!isPerpDrawn(vecOf(pp), vecOf(base))) fail('quiz figure qDist: the purple segment is not perpendicular');
          const dist = distRef(QUIZ_DIST_REF);
          if (Math.abs(cmOf(pp) - dist) > 1e-9) fail('quiz figure qDist: drawn ' + cmOf(pp).toFixed(3) + ' cm but the answer says ' + dist);
          const sf = shortestFootRef(QUIZ_DIST_REF);
          if (sf.ties !== 1 || Math.abs(sf.min - dist) > 1e-9) fail('quiz figure qDist: the perpendicular one is not the unique shortest');
          qd.lines.filter(l => l.kind === 'slant').forEach((l, i) => {
            if (!isWholeCm(cmOf(l))) fail('quiz figure qDist: slanted segment ' + i + ' is not a whole number of centimetres');
            if (!(cmOf(l) > dist + 1e-9)) fail('quiz figure qDist: slanted segment ' + i + ' is not longer');
          });
          /* 題庫寫死的正解 3 公分必須就是這張圖量出來的距離。 */
          const key = I18N.zh.qs[3].opts[I18N.zh.qs[3].ans];
          if (key !== dist + ' 公分') fail('quiz qs[3]: the key is "' + key + '" but the figure measures ' + dist + ' 公分');
        }
        const qc = data.QUIZ_FIGS.qCross();
        const qcOk = checkPlan(qc, 'quiz figure qCross', []);
        if (!qcOk) return;
        if (qc.lines.length !== 2) fail('quiz figure qCross: exactly two lines');
        else if (!isPerpDrawn(vecOf(qc.lines[0]), vecOf(qc.lines[1]))) fail('quiz figure qCross: the two lines are not drawn perpendicular, but the answer says they are');
        /* 交點一定要落在方格紙裡面，不然孩子看不到那個直角。 */
        {
          const a = QUIZ_CROSS_REF.aAt, ad = QUIZ_CROSS_REF.aDir, b = QUIZ_CROSS_REF.bAt, bd = QUIZ_CROSS_REF.bDir;
          const den = ad[0] * bd[1] - ad[1] * bd[0];
          if (den === 0) fail('quiz figure qCross: the two lines never cross');
          else {
            const t = ((b[0] - a[0]) * bd[1] - (b[1] - a[1]) * bd[0]) / den;
            const X = [a[0] + t * ad[0], a[1] + t * ad[1]];
            if (X[0] < 0 || X[0] > GW_REF || X[1] < 0 || X[1] > GH_REF) fail('quiz figure qCross: the crossing point is off the grid, so the right angle cannot be seen');
          }
        }
      }

      /* ---------- 2b) 小遊戲「製圖廠接訂單」（§六之五）：見 gameChecks ---------- */
      gameChecks(data, I18N, fail, rawSrc);

      /* ---------- 3) 圖上不可以有文字，也不可以繞過 svgEl ---------- */
      ['index', 'review'].forEach(name => {
        if (!sib[name]){ fail('[SETUP-FAIL] cannot read ' + name + '.html'); return; }
        const clean = stripComments(sib[name]);
        /* ⚠️ 這一條原本的註解宣稱「擋掉繞過 svgEl() 直接 createElementNS」，可是正規式
           只看第一個參數，createElementNS(NS, 'text') 照樣放行 —— 註解比程式強。
           程式真的做得到的是：把**呼叫次數**逐頁釘死（多開一個呼叫點就報出來），
           再加上下面那條「'text'／'tspan' 這兩個標籤名一個都不准出現」。 */
        const nsCalls = (clean.match(/createElementNS\(/g) || []).length;
        if (nsCalls !== NS_CALLS_REF[name]) fail(name + '.html: createElementNS is called ' + nsCalls + ' time(s), expected exactly ' + NS_CALLS_REF[name] + ' — a new call site is a new way to put something into the SVG that nothing checks');
        if (/createElementNS\((?!NS\b)/.test(clean)) fail(name + '.html: an SVG element is created without going through NS');
        /* ⚠️ 只擋 svgEl('text') 是擋不住的：createElementNS(NS, 'text')、svgEl( 'text' )、
           以及把標籤名放進變數都繞得過去。這一課的圖裡**沒有任何**文字，所以
           'text'／'tspan' 這兩個標籤名在整份腳本裡根本沒有正當用途 —— 直接一個都不准出現。 */
        [/(['"])text\1/, /(['"])tspan\1/].forEach(re => {
          const m = re.exec(clean);
          if (m) fail(name + '.html: the tag name ' + m[0] + ' appears in the script — every label on this lesson lives in HTML below the figure, never inside the SVG');
        });
        if (/<text[\s>]/i.test(clean)) fail(name + '.html: a literal text element in the markup');
      });
      ['reference', 'parents'].forEach(name => {
        if (!sib[name]){ fail('[SETUP-FAIL] cannot read ' + name + '.html'); return; }
        if (/<svg[\s>]/i.test(stripComments(sib[name]))) fail(name + '.html must have no SVG at all — it is a printable page');
      });

      /* ---------- 4) 畫布：每一張圖都要放得下它畫的東西 ---------- */
      {
        const svgOf = plan => {
          const parts = ['<svg viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '" width="' + FIG_W_REF + '" height="' + FIG_H_REF + '">'];
          /* ⚠️ 每一種畫出來的東西都要序列化：只放線和點的話，被裁掉的直角記號、
             三角板或直尺完全看不到，而畫布檢查照樣是綠的。 */
          plan.lines.forEach(l => parts.push('<line x1="' + l.a.x + '" y1="' + l.a.y + '" x2="' + l.b.x + '" y2="' + l.b.y + '" stroke-width="3.5"/>'));
          plan.dots.forEach(dt => parts.push('<circle cx="' + dt.p.x + '" cy="' + dt.p.y + '" r="' + (dt.kind === 'small' ? DOT_R_S_REF : DOT_R_REF) + '" stroke-width="2"/>'));
          /* lib/canvas.js 讀不懂 polyline／polygon（它會 fail-closed，那是對的行為），
             所以把它們拆成它讀得懂的線段再交出去。 */
          const seg = (a, b) => parts.push('<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke-width="2"/>');
          plan.marks.forEach(m => { for (let i = 0; i + 1 < m.length; i++) seg(m[i], m[i + 1]); });
          plan.polys.forEach(po => { for (let i = 0; i < po.pts.length; i++) seg(po.pts[i], po.pts[(i + 1) % po.pts.length]); });
          parts.push('</svg>');
          return parts.join('');
        };
        const every = [];
        S1_CASES_REF.forEach((c, ci) => { for (let s = 0; s < S1_STEPS_REF; s++) every.push(['s1 ' + c.id + ' ' + s, data.perpPlan(ci, s)]); });
        data.S2_CASES.forEach(c => every.push(['s2 ' + c.id, data.distPlan(c)]));
        for (let s = 0; s < S3_STEPS_REF; s++) every.push(['s3 ' + s, data.paraPlan(s)]);
        data.S4_CASES.forEach(c => every.push(['s4 ' + c.id, data.widthPlan(c)]));
        data.S5_CASES.forEach(c => every.push(['s5 ' + c.id, data.relPlan(c)]));
        every.push(['quiz qDist', data.QUIZ_FIGS.qDist()], ['quiz qCross', data.QUIZ_FIGS.qCross()]);
        for (let m = 0; m <= 4; m++) every.push(['game steps figure ' + m, data.stepsPlan(m)]);
        every.forEach(pair => {
          /* ⚠️ 這個迴圈自己重新取一次每一張圖，所以它也要先驗形狀 —— 不然一個 null 端點
             會在 svgOf() 裡丟例外，整份報告變成 stack trace。響亮地失敗，不要安靜地爆炸。 */
          if (!planUsable(pair[1])){ fail(pair[0] + ': the plan is malformed, so its extent cannot be checked'); return; }
          canvasProblems(svgOf(pair[1]), { name:pair[0] }).forEach(p => fail(pair[0] + ': ' + p));
        });
      }

      /* ---------- 4b) review.html 的取樣空間 ---------- */
      {
        const rv = sib.review ? stripComments(sib.review) : '';
        REVIEW_PINS.forEach(pin => {
          let n = 0, i = 0;
          while ((i = rv.indexOf(pin.text, i)) >= 0){ n++; i += pin.text.length; }
          if (n !== 1) fail('PIN: review.html has ' + n + ' copies of "' + pin.text.trim().slice(0, 60) + '", expected exactly 1 — ' + pin.why);
        });
      }

      /* ---------- 5) 四頁的措辭 ---------- */
      const prose = {};
      ['index', 'reference', 'review', 'parents'].forEach(name => {
        prose[name] = sib[name] ? proseOnly(stripComments(sib[name])) : '';
      });
      const countIn = (hay, needle) => {
        if (!needle) return 0;
        let n = 0, i = 0;
        while ((i = hay.indexOf(needle, i)) >= 0){ n++; i += needle.length; }
        return n;
      };
      SIBLING_RULES.concat(SIBLING_RULES_EN).forEach(rule => {
        Object.keys(rule.files).forEach(name => {
          const want = rule.files[name];
          const got = countIn(prose[name], rule.text);
          if (got !== want) fail('SIBLING: "' + rule.text + '" appears ' + got + ' time(s) in ' + name + '.html, expected ' + want);
        });
      });
      FORBIDDEN.forEach(bad => {
        ['index', 'reference', 'review', 'parents'].forEach(name => {
          if (prose[name].indexOf(bad) >= 0) fail('FORBIDDEN: ' + name + '.html says "' + bad + '", which is not true');
        });
      });
      HANDOFF_RULES.forEach(h => {
        ['index', 'reference', 'parents'].forEach(name => {
          const hay = prose[name];
          let i = 0;
          while ((i = hay.indexOf(h.word, i)) >= 0){
            const win = hay.slice(Math.max(0, i - h.span), i + h.word.length + h.span);
            if (!h.near.some(n => win.indexOf(n) >= 0))
              fail('HANDOFF: ' + name + '.html mentions "' + h.word + '" without "' + h.near.join('/') + '" nearby — this lesson only ever hands that topic on');
            i += h.word.length;
          }
        });
      });
      /* 規則必須住在指定的字典鍵裡（只看字典那一段，markup 的 fallback 不算數）。 */
      KEY_RULES.map(r => Object.assign({ lang:'zh' }, r))
        .concat(KEY_RULES_EN.map(r => Object.assign({}, r, { lang:'en' })))
        .forEach(rule => {
          const clean = sib[rule.file] ? stripComments(sib[rule.file]) : '';
          const region = langRegion(clean, rule.lang);
          if (!region){ fail('KEY: cannot find the ' + rule.lang + ' dictionary in ' + rule.file + '.html'); return; }
          const val = keyValue(region, rule.key);
          if (val === null){ fail('KEY: ' + rule.file + '.html ' + rule.lang + '.' + rule.key + ' is missing'); return; }
          rule.must.forEach(m => {
            if (val.indexOf(m) < 0) fail('KEY: ' + rule.file + '.html ' + rule.lang + '.' + rule.key + ' no longer says "' + m + '"');
          });
        });
      /* 成對出現：規則出現的那一頁，限定句也要出現。 */
      PAIRED_RULES.forEach(pr => {
        pr.pages.forEach(name => {
          if (prose[name].indexOf(pr.rule) >= 0 && prose[name].indexOf(pr.qualifier) < 0)
            fail('PAIRED: ' + name + '.html states "' + pr.rule + '" without the qualifier "' + pr.qualifier + '"');
        });
      });

      /* ---------- 6) 題庫神諭 ---------- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const ref = BANK_EXPECTED[bank];
        ['zh', 'en'].forEach(lang => {
          const list = I18N[lang][bank];
          if (!Array.isArray(list)){ fail('bank ' + bank + ' (' + lang + ') is missing'); return; }
          if (list.length !== ref.length) fail('bank ' + bank + ' (' + lang + ') has ' + list.length + ' questions, expected ' + ref.length);
          ref.forEach((r, i) => {
            const q = list[i];
            if (!q){ fail(bank + '[' + i + '] (' + lang + ') is missing'); return; }
            if (plainText(q.opts[q.ans]) !== plainText(r.expect[lang]))
              fail(bank + '[' + i + '] (' + lang + '): the key is "' + plainText(q.opts[q.ans]) + '", expected "' + plainText(r.expect[lang]) + '"');
            if (String(q.stem).indexOf(r.ask[lang]) < 0)
              fail(bank + '[' + i + '] (' + lang + '): the stem no longer asks "' + r.ask[lang] + '"');
            if (!!r.fig !== !!q.fig) fail(bank + '[' + i + '] (' + lang + '): figure presence is wrong');
            if (r.fig && q.fig !== r.fig) fail(bank + '[' + i + '] (' + lang + '): the figure is ' + q.fig + ', expected ' + r.fig);
            arithProblems(q.stem + ' ' + q.why).problems.forEach(p => fail(bank + '[' + i + '] (' + lang + '): ' + p));
            textProblems(q.stem, lang, bank + '[' + i + '] stem').forEach(fail);
            textProblems(q.why, lang, bank + '[' + i + '] why').forEach(fail);
            q.opts.forEach((o, oi) => textProblems(o, lang, bank + '[' + i + '] option ' + oi).forEach(fail));
            const nums = BANK_NUMS[bank] && BANK_NUMS[bank][i];
            if (nums){
              const got = numbersIn(plainText(q.stem));
              nums.forEach(n => { if (got.indexOf(n) < 0) fail(bank + '[' + i + '] (' + lang + '): the stem no longer gives the number ' + n); });
            }
          });
        });
        const zh = I18N.zh[bank], en = I18N.en[bank];
        if (Array.isArray(zh) && Array.isArray(en)) zh.forEach((q, i) => { if (en[i] && q.ans !== en[i].ans) fail(bank + '[' + i + ']: zh/en ans differ'); });
      });
      /* ⚠️ 正解不可以全押同一個位置。 */
      {
        const all = ['qs', 'qsAdv', 'qsBoost'].reduce((acc, b) => acc.concat((I18N.zh[b] || []).map(q => q.ans)), []);
        if (new Set(all).size < 3) fail('the quiz keys sit in fewer than three different option positions');
      }

      /* ---------- 7) 驗算器的覆蓋率 ---------- */
      if (arithProblems.unmatched().length) fail('wrongOnPurpose declared but never matched: ' + arithProblems.unmatched().join(' / '));
      const eqList = arithProblems.verifiedAll();
      const fp = crypto.createHash('sha1').update(eqList.join('\n')).digest('hex');
      if (VERIFIED_REF >= 0 && eqList.length !== VERIFIED_REF) fail('the arithmetic checker verified ' + eqList.length + ' equations, expected ' + VERIFIED_REF);
      if (FINGERPRINT_REF && fp !== FINGERPRINT_REF) fail('the set of verified equations changed (fingerprint ' + fp + ')');
      if (process.env.PERP_DUMP) console.log('verified=' + eqList.length + ' fingerprint=' + fp);
    }
  }
};
