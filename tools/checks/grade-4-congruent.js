/* grade-4/math/congruent —— 全等搬家公司（平移、旋轉、翻轉與全等）
 *
 * 這一課的正確性有四塊，所以這份設定裡有四套**獨立重寫**的實作：
 *
 * 1) 兩個圖形全等不全等。課程頁用一張 4 個數字的矩陣表（MATS）配 sameCycle 的雙迴圈；
 *    這裡的參考實作**不看那張表**：八種擺法由「轉 90° 四次 × 要不要先左右翻」生出來，
 *    多邊形則化成**標準字串**（頂點序列在所有起點與兩種方向裡取最小的那一個）再比對。
 *    兩條路對每一組圖形都要同意。
 * 2) 字母標在哪裡、對應到誰。課程頁用 labelOrder（從最上面那一個頂點順時針）；
 *    這裡另外寫一次（用有號面積判方向、用**同一個起點規則**），並且真的把字母的座標
 *    拿去做**射線法**：字母一定要在圖形外面、畫布裡面、彼此不疊、也不壓在邊上。
 * 3) 搬法是不是剛體。範例 2 的每一步 doMove 都要保持全等（用參考實作驗）、頂點還是整數、
 *    而且還在方格紙上；三個任務用 BFS 證明真的走得到。
 * 4) 版面。每一張圖的每一個頂點、每一個字母都要在畫布裡（四個邊），兩個圖形的外框不可以重疊。
 *
 * ⚠️ 這一課教的規則有前提，設定檔必須分開驗：
 *    - 「該用哪一種搬法」只對**沒有對稱**的圖形有唯一答案 —— 圖形庫的每一個圖形都要證明
 *      八種擺法畫出來互不相同（trivialSymRef）。長方形有對稱，只可以出現在「面積」那一段。
 *    - 「全等 → 面積一樣、周長一樣」旁邊一定要有「反過來不成立」（PAIRED_RULES）。
 *    - 「相似」「三邊都一樣長」每一次出現都要在「國中」旁邊，「線對稱」要在「五年級」旁邊
 *      （HANDOFF_RULES）—— 這一課只走「全等 → 對應邊一樣長」這個方向。
 * ⚠️ 圖上只有 line／path／circle 加上**單一個字母**的 text（A~H）。速查卡與家長頁沒有 SVG。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const FIG_W_REF = 460, FIG_H_REF = 300;
const CELL_REF = 28, COLS_REF = 16, ROWS_REF = 10;
const GX0_REF = (FIG_W_REF - COLS_REF * CELL_REF) / 2, GY0_REF = (FIG_H_REF - ROWS_REF * CELL_REF) / 2;
const MARGIN_REF = 8;             // 畫布四個邊至少留這麼多
const LABEL_BOX_W_REF = 10, LABEL_BOX_H_REF = 14;   // 一個字母的字框（14px 粗體約 10 寬 14 高）：兩個字框不可以疊
const LABEL_R_REF = 15;           // 字母中心離頂點多遠
const LABEL_EDGE_REF = 6;         // 字母中心離任何一條邊至少這麼遠
const SCALE_K_REF = 2;
const MINI_W_REF = 108, MINI_H_REF = 84;
const LEN_MIN_REF = 1, LEN_MAX_REF = 40, DEG_MIN_REF = 1, DEG_MAX_REF = 179, BIG_MAX_REF = 200;
/* 圖形庫的第二份。id 的順序也釘死。 */
const SHAPES_REF = {
  L4:   { pts:[[0, 0], [2, 0], [2, 1], [1, 1], [1, 3], [0, 3]], alt:[[0, 0], [3, 0], [3, 1], [2, 1], [2, 2], [1, 2], [1, 1], [0, 1]] },
  P5:   { pts:[[0, 0], [2, 0], [2, 2], [1, 2], [1, 3], [0, 3]], alt:[[0, 0], [2, 0], [2, 1], [1, 1], [1, 4], [0, 4]] },
  T34:  { pts:[[0, 0], [4, 0], [0, 3]],                          alt:[[0, 0], [6, 0], [0, 2]] },
  TRAP: { pts:[[0, 0], [3, 0], [2, 2], [0, 2]],                  alt:[[0, 0], [4, 0], [1, 2], [0, 2]] },
  Q2:   { pts:[[0, 0], [4, 0], [3, 1], [0, 2]],                  alt:[[0, 0], [4, 0], [4, 1], [0, 2]] },
  DART: { pts:[[0, 0], [4, 0], [4, 3], [2, 1]],                  alt:[[0, 0], [4, 0], [4, 3], [3, 1]] }
};
const SHAPE_IDS_REF = ['L4', 'P5', 'T34', 'TRAP', 'Q2', 'DART'];
const QUAD_IDS_REF = ['TRAP', 'Q2', 'DART'];
const LABELS_A_REF = ['A', 'B', 'C', 'D'], LABELS_B_REF = ['E', 'F', 'G', 'H'];
const PAIR_KEYS_REF = ['congSlide', 'congTurnFlip', 'notScale', 'notShape'];
const MOVE_KEYS_REF = ['slide', 'turn', 'flip', 'scale'];
const RECT_KEYS_REF = ['areaSameNotCong', 'areaSameSoCong', 'areaDiffNotCong', 'congBothRect'];
const CHANGE_KEYS_REF = ['congKeep', 'notScale', 'notShape', 'notPlace'];
const WHICH_TONES_REF = ['c', 'd', 'e', 'a'];
const WHICH_CELLS_REF = [[6, 5], [11, 5], [6, 0], [11, 0]];
const RECT_PAIRS_REF = [
  [[6, 2], [4, 3]], [[8, 2], [4, 4]], [[9, 2], [6, 3]], [[10, 2], [5, 4]],
  [[8, 3], [6, 4]], [[12, 2], [8, 3]], [[12, 2], [6, 4]], [[10, 3], [6, 5]],
  [[9, 4], [6, 6]], [[12, 3], [9, 4]], [[7, 2], [14, 1]], [[5, 3], [15, 1]]
];
const ANGLE_POOL_REF = [30, 40, 45, 50, 60, 70, 75, 80, 100, 110, 120, 130, 140, 150];
/* 驗算器在 data.check 跑完之後應該驗過的算式條數與指紋（裝上去的時候用實測值填）。 */
const VERIFIED_REF = 28;
const FINGERPRINT_REF = '15ee0d1650c7b37c1d803990a2a7bbdeb23af6f1';

/* ---------- 1) 參考實作：八種擺法與全等 ---------- */
function rot90(p){ return [-p[1], p[0]]; }
function flipX(p){ return [-p[0], p[1]]; }
/* 第 i 種擺法（0~7）：i < 4 是轉 i 次；i ≥ 4 是先左右翻再轉幾次 ——
   頁面那張表的順序是 fx／fy／fd／fa，也就是翻了之後各轉 0／2／3／1 次。 */
const ROT_AFTER_FLIP_REF = [0, 2, 3, 1];
function placeRef(P, i){
  const turns = i < 4 ? i : ROT_AFTER_FLIP_REF[i - 4];
  return P.map(function(p){
    let q = i >= 4 ? flipX(p) : p.slice();
    for (let k = 0; k < turns; k++) q = rot90(q);
    return q;
  });
}
function kindRef(i){ return i === 0 ? 'same' : i < 4 ? 'turn' : 'flip'; }
function bboxRef(P){
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys),
           w:Math.max(...xs) - Math.min(...xs), h:Math.max(...ys) - Math.min(...ys) };
}
function anchorRef(P){ const b = bboxRef(P); return P.map(p => [p[0] - b.minX, p[1] - b.minY]); }
/* 標準字串：所有起點 × 兩種方向裡字典序最小的那一個。 */
function canonRef(P){
  const n = P.length, cands = [];
  for (let s = 0; s < n; s++){
    const f = [], r = [];
    for (let i = 0; i < n; i++){ f.push(P[(s + i) % n].join(',')); r.push(P[((s - i) % n + n) % n].join(',')); }
    cands.push(f.join(';')); cands.push(r.join(';'));
  }
  cands.sort();
  return cands[0];
}
function samePolyRef(A, B){ return A.length === B.length && canonRef(A) === canonRef(B); }
function movesRef(A, B){
  const out = [], cB = canonRef(anchorRef(B));
  for (let i = 0; i < 8; i++) if (A.length === B.length && canonRef(anchorRef(placeRef(A, i))) === cB) out.push(i);
  return out;
}
function relationRef(A, B){
  const ms = movesRef(A, B);
  if (!ms.length) return 'none';
  if (ms.indexOf(0) >= 0) return 'same';
  if (ms.some(i => i < 4)) return 'turn';
  return 'flip';
}
function congRef(A, B){ return relationRef(A, B) !== 'none'; }
function scaleRef(P, k){ return P.map(p => [p[0] * k, p[1] * k]); }
function scaleFactorRef(A, B){
  for (let k = 2; k <= 3; k++) if (congRef(scaleRef(A, k), B)) return k;
  return null;
}
function trivialSymRef(P){
  const imgs = [];
  for (let i = 0; i < 8; i++) imgs.push(canonRef(anchorRef(placeRef(P, i))));
  return new Set(imgs).size === 8;
}
function area2Ref(P){
  let s = 0;
  for (let i = 0; i < P.length; i++){ const p = P[i], q = P[(i + 1) % P.length]; s += p[0] * q[1] - q[0] * p[1]; }
  return s;
}
function areaRef(P){ return Math.abs(area2Ref(P)) / 2; }
function axisRef(P){
  for (let i = 0; i < P.length; i++){ const p = P[i], q = P[(i + 1) % P.length]; if (p[0] !== q[0] && p[1] !== q[1]) return false; }
  return true;
}
function perimRef(P){
  if (!axisRef(P)) return null;
  let s = 0;
  for (let i = 0; i < P.length; i++){ const p = P[i], q = P[(i + 1) % P.length]; s += Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]); }
  return s;
}
function intPoly(P){ return Array.isArray(P) && P.length >= 3 && P.every(p => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1])); }
function cross3(o, a, b){ return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
function onSeg(p, q, r){
  return cross3(p, q, r) === 0 && Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0]) &&
         Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);
}
function segInter(p1, p2, p3, p4){
  const d1 = cross3(p3, p4, p1), d2 = cross3(p3, p4, p2), d3 = cross3(p1, p2, p3), d4 = cross3(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return onSeg(p3, p4, p1) || onSeg(p3, p4, p2) || onSeg(p1, p2, p3) || onSeg(p1, p2, p4);
}
/* 簡單多邊形：不相鄰的邊不相交，也沒有三個連續頂點共線。回傳 null 或問題描述。 */
function simpleProblem(P){
  const n = P.length;
  for (let i = 0; i < n; i++){
    if (cross3(P[(i + n - 1) % n], P[i], P[(i + 1) % n]) === 0) return 'three consecutive vertices are collinear at ' + i;
    for (let j = i + 1; j < n; j++){
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segInter(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return 'edges ' + i + ' and ' + j + ' cross';
    }
  }
  return null;
}
/* 射線法：畫布座標的點在不在畫布座標的多邊形裡。 */
function pointInPoly(pt, poly){
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function distPtSeg(p, a, b){
  const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
  let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}
function minEdgeDist(p, poly){
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, distPtSeg(p, poly[i], poly[(i + 1) % poly.length]));
  return best;
}
function pxRef(gx){ return GX0_REF + gx * CELL_REF; }
function pyRef(gy){ return GY0_REF + (ROWS_REF - gy) * CELL_REF; }
function toPxRef(P){ return P.map(p => ({ x:pxRef(p[0]), y:pyRef(p[1]) })); }
function inCanvas(q, w, h, margin){
  return Number.isFinite(q.x) && Number.isFinite(q.y) && q.x >= margin && q.y >= margin && q.x <= w - margin && q.y <= h - margin;
}

/* ---------- 2) 參考實作：字母順序與對應 ---------- */
/* 從最上面（一樣高就最左邊）的頂點開始，畫面上順時針。回傳「第 k 個字母是哪一個頂點」。 */
function labelOrderRef(P){
  const n = P.length;
  let start = 0;
  for (let i = 1; i < n; i++) if (P[i][1] > P[start][1] || (P[i][1] === P[start][1] && P[i][0] < P[start][0])) start = i;
  const clockwise = area2Ref(P) < 0;
  const out = [];
  for (let k = 0; k < n; k++) out.push(clockwise ? (start + k) % n : ((start - k) % n + n) % n);
  return out;
}
function labelOfRef(P, labels, i){ return labels[labelOrderRef(P).indexOf(i)]; }
function edgeNameRef(P, labels, i, j){
  const order = labelOrderRef(P), oi = order.indexOf(i), oj = order.indexOf(j), n = P.length;
  if (Math.min(oi, oj) === 0 && Math.max(oi, oj) === n - 1) return labels[0] + labels[n - 1];
  return labels[Math.min(oi, oj)] + labels[Math.max(oi, oj)];
}
function edgeLenRef(P, i, j){
  const p = P[i], q = P[j];
  if (p[0] === q[0]) return Math.abs(q[1] - p[1]);
  if (p[1] === q[1]) return Math.abs(q[0] - p[0]);
  return null;
}
function isRightRef(P, i){
  const n = P.length, v = P[i], a = P[(i + n - 1) % n], b = P[(i + 1) % n];
  return (a[0] - v[0]) * (b[0] - v[0]) + (a[1] - v[1]) * (b[1] - v[1]) === 0;
}
function isReflexRef(P, i){
  const n = P.length;
  const turn = cross3(P[(i + n - 1) % n], P[i], P[(i + 1) % n]);
  return area2Ref(P) > 0 ? turn < 0 : turn > 0;
}
/* 兩個角一樣大（整數比：cos 的平方交叉相乘，加上正負號與凹凸）。 */
function sameAngleRef(P, i, Q, j){
  function vecs(R, k){ const n = R.length, v = R[k], a = R[(k + n - 1) % n], b = R[(k + 1) % n]; return [[a[0] - v[0], a[1] - v[1]], [b[0] - v[0], b[1] - v[1]]]; }
  const [u1, w1] = vecs(P, i), [u2, w2] = vecs(Q, j);
  const d1 = u1[0] * w1[0] + u1[1] * w1[1], d2 = u2[0] * w2[0] + u2[1] * w2[1];
  const l1 = (u1[0] ** 2 + u1[1] ** 2) * (w1[0] ** 2 + w1[1] ** 2), l2 = (u2[0] ** 2 + u2[1] ** 2) * (w2[0] ** 2 + w2[1] ** 2);
  if (Math.sign(d1) !== Math.sign(d2)) return false;
  if (d1 * d1 * l2 !== d2 * d2 * l1) return false;
  return isReflexRef(P, i) === isReflexRef(Q, j);
}
/* 對應題的版面（和 review.html 的 corrLayout 同一個規格：A 在 (1,2)，B 靠右邊界 15、底 2）。 */
function corrLayoutRef(sid, mat){
  const base = anchorRef(SHAPES_REF[sid].pts);
  const A = base.map(p => [p[0] + 1, p[1] + 2]);
  const img = anchorRef(placeRef(base, mat)), b = bboxRef(img);
  const B = img.map(p => [p[0] + (15 - b.w), p[1] + 2]);
  return { A, B };
}

/* ---------- 3) 算式逐條驗算（全站共用的那一份） ---------- */
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['格', '公分', '平方公分', '步', '倍', '個', '組', '題', '°'],
  unitsEn: ['squares?', 'cm', 'square centimetres?', 'steps?', 'slides?', 'turns?', 'flips?', 'times', '°']
});

/* ---------- 4) 題庫的第二套答案 ---------- */
const BANK_EXPECTED = {
  qs: [
    { expect:{ zh:'疊起來能完全重合，形狀一樣、大小也一樣', en:'One fits exactly on top of the other: same shape and same size' },
      ask:{ zh:'是什麼意思', en:'What does it mean' } },
    { expect:{ zh:'要旋轉（轉方向再搬過去）', en:'A turn (rotated, then moved)' },
      ask:{ zh:'怎麼搬</strong>過來的', en:'Which move</strong> carried' }, fig:'q2' },
    { expect:{ zh:'全等，翻過來像鏡子裡的樣子，形狀和大小都沒變', en:'Yes: flipping shows it as in a mirror, and neither shape nor size changed' },
      ask:{ zh:'全等嗎', en:'congruent to the original' } },
    { expect:{ zh:'不全等，形狀一樣可是大小不一樣', en:'No: the same shape but not the same size' },
      ask:{ zh:'全等</strong>嗎', en:'congruent</strong>?' }, fig:'q4' },
    { expect:{ zh:'7 公分', en:'7 cm' },
      ask:{ zh:'乙最長的邊是幾公分', en:'How long is the longest side of B' } },
    { expect:{ zh:'一定有，全等的圖形對應角一樣大', en:'Yes: in congruent shapes matching angles are the same size' },
      ask:{ zh:'乙一定也有一個 110° 的角嗎', en:'Must B have a 110° angle too' } }
  ],
  qsAdv: [
    { expect:{ zh:'不全等，長和寬不一樣，疊起來不會完全重合', en:'No: the lengths and widths differ, so one would not fit exactly on the other' },
      ask:{ zh:'這兩個長方形全等嗎', en:'Are the two rectangles congruent' } },
    { expect:{ zh:'全等 —— 左右相反是翻過來的樣子，形狀和大小都沒變', en:'Yes — left-right swapped is just the flipped view, and neither shape nor size changed' },
      ask:{ zh:'從外面看到的圖形和原來的全等嗎', en:'congruent to the original' } },
    { expect:{ zh:'18 公分', en:'18 cm' },
      ask:{ zh:'乙的周長是多少', en:'What is the perimeter of B' } },
    { expect:{ zh:'不對，全等的圖形每一條對應邊都要一樣長，5 公分和 6 公分不一樣', en:'No: in congruent shapes every matching side must be the same length, and 5 cm is not 6 cm' },
      ask:{ zh:'他說得對嗎', en:'Is he right' } }
  ],
  qsBoost: [
    { expect:{ zh:'全等不看位置和方向 —— 轉過來能完全重合就是全等', en:'Congruence ignores place and direction — if a turn makes one fit exactly on the other, they are congruent' },
      ask:{ zh:'他錯在哪裡', en:'What has she got wrong' } },
    { expect:{ zh:'面積一樣不一定全等 —— 6 × 4 和 8 × 3 都是 24，可是疊起來不會重合', en:'The same area does not make them congruent — 6 × 4 and 8 × 3 are both 24, yet one does not fit on the other' },
      ask:{ zh:'他錯在哪裡', en:'What has he got wrong' } }
  ]
};

/* ---------- 5) 四頁一起釘的措辭 ----------
   ⚠️ min 要寫**當下真實的出現次數**，不是「至少 1」。 */
const SIBLING_RULES = [
  { text:'疊起來能完全重合', files:{ index:12, reference:8, parents:4 } },
  { text:'不改變形狀和大小', files:{ index:8, reference:6, review:2, parents:4 } },
  { text:'對應邊一樣長、對應角一樣大', files:{ index:6, reference:4, parents:4 } },
  { text:'面積一樣不一定全等', files:{ index:3, reference:4, parents:2 } },
  { text:'反過來不成立', files:{ index:2, reference:2 } },
  { text:'鏡子裡的樣子', files:{ index:4, reference:3, review:2 } },
  { text:'放大縮小不是搬法', files:{ index:1, reference:2, review:1, parents:2 } }
];
const SIBLING_RULES_EN = [
  { text:'fits exactly on top of the other', files:{ index:6, reference:2, parents:1 } },
  { text:'neither shape nor size', files:{ index:10, reference:2, review:3, parents:4 } },
  { text:'matching sides are the same length', files:{ index:5, reference:3, review:2, parents:2 } },
  { text:'reverse is not true', files:{ index:1, reference:1 } }
];
/* 一個字都不可以出現的句子（都是假話，連當誘答都不可以）。 */
const FORBIDDEN = [
  '面積一樣一定全等', '周長一樣一定全等', '翻轉會改變形狀', '旋轉會改變形狀', '平移會改變形狀',
  '三邊一樣長就全等', '放大的圖形也全等', '翻過來就不全等', 'SSS',
  'same area always means congruent', 'a flipped shape is not congruent', 'flipping changes the shape'
];
/* 交出去的詞每一頁出現幾次（markup 的 fallback ＋ 字典各一份）。 */
const HANDOFF_COUNTS = [
  { word:'相似', files:{ index:2, reference:2, parents:2 } },
  { word:'三邊都一樣長', files:{ parents:2 } },
  { word:'線對稱', files:{ index:2, reference:2, parents:2 } },
  { word:'similar', files:{ index:1, reference:1, parents:1 } },
  { word:'line symmetry', files:{ index:1, reference:1, parents:1 } },
  { word:'three equal sides', files:{ parents:1 } },
  { word:'all three sides equal', files:{} },
  { word:'sss', files:{} }
];
/* 英文字典也要釘：只釘中文的話，英文那一半可以自己漂走（codex 抓到）。 */
const KEY_RULES_EN = [
  { file:'index', key:'s1note', must:['fits exactly on top of the other', 'do not count'] },
  { file:'index', key:'s2note', must:['changes shape or size', 'mirror', 'not congruent'] },
  { file:'index', key:'s3note', must:['matching sides are the same length and matching angles are the same size'] },
  { file:'index', key:'s4note', must:['always have the same area and the same perimeter', 'reverse is not true'] },
  { file:'index', key:'scopeNote', must:['similar', 'junior-high', 'Line symmetry', 'grade 5'] },
  { file:'reference', key:'f0', must:['fits exactly on top'] },
  { file:'reference', key:'f3', must:['matching sides are the same length and matching angles are the same size'] },
  { file:'parents', key:'s1p2', must:['is congruent', 'junior high'] }
];
/* 規則必須住在指定的字典鍵裡。 */
const KEY_RULES = [
  { file:'index', key:'s1note', must:['疊起來能完全重合', '形狀一樣、大小也一樣', '不算'] },
  { file:'index', key:'s2note', must:['不會改變形狀和大小', '鏡子裡的樣子', '放大或縮小', '不全等'] },
  { file:'index', key:'s3note', must:['對應邊一樣長、對應角一樣大', '搬到另一個上面', '反過來'] },
  { file:'index', key:'s4note', must:['面積一定一樣、周長也一定一樣', '反過來不成立', '不一定全等'] },
  { file:'index', key:'scopeNote', must:['相似', '國中', '線對稱', '五年級'] },
  { file:'reference', key:'f0', must:['疊起來能完全重合', '形狀一樣 ＋ 大小一樣'] },
  { file:'reference', key:'f3', must:['對應邊一樣長、對應角一樣大'] },
  { file:'reference', key:'s5note', must:['反過來不成立', '不一定全等'] },
  { file:'parents', key:'s1p2', must:['也全等', '面積一樣不一定全等', '國中'] }
];
/* 成對出現：左邊那句話只要出現，右邊那句話就必須在同一頁出現。 */
const PAIRED_RULES = [
  { rule:'面積一定一樣', qualifier:'反過來不成立', pages:['index', 'reference'] },
  { rule:'always have the same area', qualifier:'reverse is not true', pages:['index', 'reference'] }
];
/* 交給別的年級的詞：每一次出現都必須在指定的字眼附近。 */
const HANDOFF_RULES = [
  { word:'相似', near:['國中'], span:40 },
  { word:'三邊都一樣長', near:['國中'], span:45 },
  { word:'線對稱', near:['五年級'], span:30 },
  { word:'similar', near:['junior-high'], span:60 },
  { word:'Line symmetry', near:['grade 5'], span:40 },
  { word:'three equal sides', near:['junior high'], span:70 }
];

function zhRegion(clean){
  const a = clean.indexOf('zh: {');
  const b = clean.indexOf('en: {', a < 0 ? 0 : a);
  if (a < 0 || b < 0 || b <= a) return null;
  return clean.slice(a, b);
}
/* 英文字典從 'en: {' 到它結束的 '\n  };'（I18N 物件的收尾）—— 不可以一路到檔尾，
   不然後面任何一個物件都可以替字典補一個缺掉的鍵（codex 抓到）。 */
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

/* ---------- 6) 渲染出來的字串該長什麼樣 ---------- */
function textProblems(s, lang, label){
  const out = [];
  const shown = String(s).replace(/<\/?[A-Za-z][^>]*>/g, '');
  if (/undefined|NaN|\[object/.test(shown)) out.push(label + ': undefined/NaN in "' + shown.slice(0, 60) + '"');
  if (lang === 'zh'){
    const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) out.push(label + ': missing space between Chinese and a digit: ' + [...new Set(glued)].join(' '));
  } else {
    const bad = shown.match(/\b1 (?:square|step|slide|turn|flip|centimetre|shape|side|angle|unit|polygon|vertex|corner)s\b|\b1 \w+ are\b/g);
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
    pairKindOpt:{ congSlide:'全等 —— 只要平移就完全重合', congTurnFlip:'全等 —— 要轉或翻才會完全重合', notScale:'不全等 —— 形狀一樣，可是放大了', notShape:'不全等 —— 形狀不一樣' },
    moveOpt:{ slide:'只要平移（直直搬過去）', turn:'要旋轉（轉方向再搬過去）', flip:'要翻轉（翻過來再搬過去）', scale:'放大（變大了）' },
    colorName:{ c:'綠色的', d:'紫色的', e:'紅色的', a:'橘色的' },
    rectStatement:{ areaSameNotCong:'面積一樣，可是不全等', areaSameSoCong:'面積一樣，所以全等', areaDiffNotCong:'面積不一樣，所以不全等', congBothRect:'全等，因為都是長方形' },
    changeOpt:{ congKeep:'全等 —— 形狀和大小都沒變', notScale:'不全等 —— 形狀一樣，可是大小變了', notShape:'不全等 —— 形狀變了', notPlace:'不全等 —— 位置變了就不全等' },
    cm:n => n + ' 公分', sqcm:n => n + ' 平方公分', deg:n => n + '°', sidesPerim:(n, p) => n + ' 條邊、' + p + ' 公分',
    actionText:{ slide:k => '往右平移 ' + k + ' 格', turn:d => '旋轉 ' + d + '°', flip:() => '翻過來（左右翻轉）', scale:k => '放大 ' + k + ' 倍（每一條邊都變成 ' + k + ' 倍長，形狀不變）' }
  },
  en: {
    pairKindOpt:{ congSlide:'Congruent — a slide alone makes them fit exactly', congTurnFlip:'Congruent — it takes a turn or a flip to fit exactly', notScale:'Not congruent — the same shape, but enlarged', notShape:'Not congruent — a different shape' },
    moveOpt:{ slide:'a slide only (moved straight across)', turn:'a turn (rotated, then moved)', flip:'a flip (turned over, then moved)', scale:'an enlargement (made bigger)' },
    colorName:{ c:'the green one', d:'the purple one', e:'the red one', a:'the orange one' },
    rectStatement:{ areaSameNotCong:'The same area, but not congruent', areaSameSoCong:'The same area, so congruent', areaDiffNotCong:'Different areas, so not congruent', congBothRect:'Congruent, because both are rectangles' },
    changeOpt:{ congKeep:'Congruent — neither shape nor size changed', notScale:'Not congruent — the same shape, but the size changed', notShape:'Not congruent — the shape changed', notPlace:'Not congruent — a new place means not congruent' },
    cm:n => n + ' cm', sqcm:n => n + ' square ' + (n === 1 ? 'centimetre' : 'centimetres'), deg:n => n + '°', sidesPerim:(n, p) => n + ' ' + (n === 1 ? 'side' : 'sides') + ', ' + p + ' cm',
    actionText:{ slide:k => 'slide it ' + k + ' ' + (k === 1 ? 'square' : 'squares') + ' to the right', turn:d => 'turn it ' + d + '°', flip:() => 'flip it over (left-right)', scale:k => 'enlarge it ' + k + ' times (every side ' + k + ' times as long, the shape unchanged)' }
  }
};
/* 十二題的題幹，**整句重建**（第二份）。子字串釘不死題幹，整句才釘得死。 */
const STEM_EXACT = {
  pairKind:d => ({ zh:'右邊的藍色圖形和左邊的橘色圖形<strong>全等</strong>嗎？', en:'Is the blue shape on the right <strong>congruent</strong> to the orange shape on the left?' }),
  moveName:d => ({ zh:'右邊的藍色圖形是左邊的橘色圖形<strong>怎麼搬</strong>過來的？', en:'<strong>Which move</strong> carried the orange shape on the left to where the blue one is?' }),
  corrVertex:d => {
    const lay = corrLayoutRef(d.sid, d.mat), la = labelOfRef(lay.A, LABELS_A_REF, d.vi);
    return { zh:'兩個圖形全等。左邊的頂點 <strong>' + la + '</strong> 對應右邊的哪一個頂點？',
             en:'The two shapes are congruent. Which vertex of the right shape matches vertex <strong>' + la + '</strong> of the left one?' };
  },
  corrSide:d => {
    const lay = corrLayoutRef(d.sid, d.mat), nameA = edgeNameRef(lay.A, LABELS_A_REF, d.ei, (d.ei + 1) % 4);
    return { zh:'兩個圖形全等。左邊的邊 <strong>' + nameA + '</strong> 對應右邊的哪一條邊？',
             en:'The two shapes are congruent. Which side of the right shape matches side <strong>' + nameA + '</strong> of the left one?' };
  },
  whichCong:d => ({ zh:'左邊的藍色圖形是目標。右邊四個圖形，哪一個和它<strong>全等</strong>？', en:'The blue shape on the left is the target. Which of the four shapes on the right is <strong>congruent</strong> to it?' }),
  corrLen:d => ({ zh:'甲、乙兩個圖形<strong>全等</strong>。甲的邊 AB 是 <strong>' + d.n + ' 公分</strong>，它對應乙的邊 EF。邊 EF 是幾公分？',
                  en:'Shapes P and Q are <strong>congruent</strong>. Side AB of P is <strong>' + d.n + ' cm</strong> long and matches side EF of Q. How long is side EF?' }),
  corrAngle:d => ({ zh:'甲、乙兩個圖形<strong>全等</strong>。甲有一個角是 <strong>' + d.x + '°</strong>，乙上面對應的那一個角是幾度？',
                    en:'Shapes P and Q are <strong>congruent</strong>. One angle of P is <strong>' + d.x + '°</strong>. How many degrees is the matching angle of Q?' }),
  perimCong:d => ({ zh:'甲是長 <strong>' + d.a + ' 公分</strong>、寬 <strong>' + d.b + ' 公分</strong>的長方形，乙和甲<strong>全等</strong>。乙的周長是幾公分？',
                    en:'P is a rectangle <strong>' + d.a + ' cm</strong> long and <strong>' + d.b + ' cm</strong> wide, and Q is <strong>congruent</strong> to P. What is the perimeter of Q?' }),
  areaCong:d => ({ zh:'甲是長 <strong>' + d.a + ' 公分</strong>、寬 <strong>' + d.b + ' 公分</strong>的長方形，乙和甲<strong>全等</strong>。乙的面積是多少平方公分？',
                   en:'P is a rectangle <strong>' + d.a + ' cm</strong> long and <strong>' + d.b + ' cm</strong> wide, and Q is <strong>congruent</strong> to P. What is the area of Q in square centimetres?' }),
  rectPair:d => ({ zh:'一個長 <strong>' + d.a + ' 公分</strong>、寬 <strong>' + d.b + ' 公分</strong>的長方形，和一個長 <strong>' + d.c + ' 公分</strong>、寬 <strong>' + d.d2 + ' 公分</strong>的長方形。下面哪一句話是對的？',
                   en:'One rectangle is <strong>' + d.a + ' cm</strong> long and <strong>' + d.b + ' cm</strong> wide; another is <strong>' + d.c + ' cm</strong> long and <strong>' + d.d2 + ' cm</strong> wide. Which statement is true?' }),
  sidesPerim:d => ({ zh:'甲、乙兩個圖形<strong>全等</strong>。甲有 <strong>' + d.n + ' 條邊</strong>，周長是 <strong>' + d.p + ' 公分</strong>。乙有幾條邊、周長是幾公分？',
                     en:'Shapes P and Q are <strong>congruent</strong>. P has <strong>' + d.n + ' sides</strong> and a perimeter of <strong>' + d.p + ' cm</strong>. How many sides does Q have, and what is its perimeter?' }),
  changeKind:d => ({ zh:'把一個圖形<strong>' + TXT_REF.zh.actionText[d.act](d.k) + '</strong>。新的圖形和原來的<strong>全等</strong>嗎？',
                     en:'Take a shape and <strong>' + TXT_REF.en.actionText[d.act](d.k) + '</strong>. Is the new shape <strong>congruent</strong> to the original?' })
};
const FIG_GENS = ['pairKind', 'moveName', 'corrVertex', 'corrSide', 'whichCong'];
const GEN_IDS = FIG_GENS.concat(['corrLen', 'corrAngle', 'perimCong', 'areaCong', 'rectPair', 'sidesPerim', 'changeKind']);

function isPerm(a, ref){ return Array.isArray(a) && a.length === ref.length && ref.every(k => a.indexOf(k) >= 0) && new Set(a).size === ref.length; }
function eqPoly(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
function sortNum(a){ return a.slice().sort((x, y) => x - y); }
function sumTimes(a, b){ let s = 0; for (let i = 0; i < b; i++) s += a; return s; }   // 面積：重複加法（第二條路）
/* whichCong 的正解：唯一和目標全等的候選；不唯一回 －1。 */
function whichAnsRef(target, cands){
  const hits = [];
  cands.forEach((C, i) => { if (congRef(target, C)) hits.push(i); });
  return hits.length === 1 ? hits[0] : -1;
}
/* 對應題的圖：字母位置的獨立檢查。 */
function labelProblems(fig, label){
  const out = [];
  const polys = fig.polys.map(p => p.pts);
  fig.labels.forEach(function(lb, k){
    if (!/^[A-H]$/.test(String(lb.t))) out.push(label + ': label "' + lb.t + '" is not a single letter A~H');
    if (!inCanvas(lb, fig.w, fig.h, MARGIN_REF)) out.push(label + ': label ' + lb.t + ' is outside the canvas');
    polys.forEach(function(poly, pi){
      if (pointInPoly(lb, poly)) out.push(label + ': label ' + lb.t + ' sits inside polygon ' + pi);
      if (minEdgeDist(lb, poly) < LABEL_EDGE_REF) out.push(label + ': label ' + lb.t + ' is on top of an edge');
    });
    for (let j = k + 1; j < fig.labels.length; j++){
      const o = fig.labels[j];
      if (Math.abs(lb.x - o.x) < LABEL_BOX_W_REF && Math.abs(lb.y - o.y) < LABEL_BOX_H_REF) out.push(label + ': labels ' + lb.t + ' and ' + o.t + ' overlap');
    }
  });
  return out;
}
function figProblems(fig, label){
  const out = [];
  if (!fig) return [label + ': no figure'];
  if (fig.w !== FIG_W_REF || fig.h !== FIG_H_REF) return [label + ': figure canvas is ' + fig.w + '×' + fig.h];
  if (!Array.isArray(fig.polys) || !fig.polys.length) return [label + ': figure draws no polygon'];
  fig.polys.forEach(function(p, i){
    if (!Array.isArray(p.pts) || p.pts.length < 3) out.push(label + ': polygon ' + i + ' has fewer than three points');
    (p.pts || []).forEach(function(q){
      if (!inCanvas(q, fig.w, fig.h, MARGIN_REF)) out.push(label + ': polygon ' + i + ' point (' + q.x + ',' + q.y + ') is outside the canvas');
    });
    if (['a', 'b', 'c', 'd', 'e'].indexOf(p.tone) < 0) out.push(label + ': polygon ' + i + ' has an unknown tone ' + p.tone);
  });
  /* 兩個圖形的外框不可以重疊（左右分開，中間至少空一格）。 */
  function pxBox(pts){ const xs = pts.map(q => q.x), ys = pts.map(q => q.y); return { minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys) }; }
  for (let i = 0; i < fig.polys.length; i++) for (let j = i + 1; j < fig.polys.length; j++){
    const a = pxBox(fig.polys[i].pts), b = pxBox(fig.polys[j].pts);
    const apart = a.maxX + CELL_REF <= b.minX || b.maxX + CELL_REF <= a.minX || a.maxY + CELL_REF <= b.minY || b.maxY + CELL_REF <= a.minY;
    if (!apart) out.push(label + ': polygons ' + i + ' and ' + j + ' are not a full square apart');
  }
  labelProblems(fig, label).forEach(p => out.push(p));
  (fig.dots || []).forEach(function(q){
    if (!inCanvas(q, fig.w, fig.h, MARGIN_REF)) out.push(label + ': a dot is outside the canvas');
    if (!(q.r > 0)) out.push(label + ': a dot with a non-positive radius');
  });
  return out;
}

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 課程頁：全等的核心 --- */
    { file:"index", via:"index", expect:"relation() disagrees with the reference",
      find:"    if (ms.indexOf(0) >= 0) return 'same';\n    if (ms.some(function(i){ return MATS[i].kind === 'turn'; })) return 'turn';\n    return 'flip';",
      replace:"    if (ms.indexOf(0) >= 0) return 'same';\n    return 'turn';",
      why:"every flipped copy would be called a turn, so 'flipping is a move too' would never be shown" },
    { file:"index", via:"index", expect:"MATS[",
      find:"    { id:'fy',   m:[1, 0, 0, -1],  kind:'flip' },   // 上下翻",
      replace:"    { id:'fy',   m:[1, 0, 0, -1],  kind:'turn' },   // 上下翻",
      why:"an up-down flip would be labelled a turn" },
    { file:"index", via:"index", expect:"sameCycle",
      find:"        if (!samePt(A[i], B[((s - i) % n + n) % n])) okR = false;",
      replace:"        okR = false;",
      why:"a flipped copy (traversed the other way round) would never count as the same polygon" },
    { file:"index", via:"index", expect:"has a symmetry",
      find:"    { id:'TRAP', pts:[[0, 0], [3, 0], [2, 2], [0, 2]],",
      replace:"    { id:'TRAP', pts:[[0, 0], [3, 0], [3, 2], [0, 2]],",
      why:"a rectangle has symmetries, so 'which move' would stop having one answer" },
    { file:"index", via:"index", expect:"is congruent to its own alt",
      find:"                 alt:[[0, 0], [6, 0], [0, 2]] },",
      replace:"                 alt:[[0, 0], [3, 0], [3, 4]] },",
      why:"the 'different shape' example would secretly be the same triangle" },
    { file:"index", via:"index", expect:"S1_CASES",
      find:"    { id:'flip',  A:BASE1, B:mapPts(BASE1, MATS[4].m) },",
      replace:"    { id:'flip',  A:BASE1, B:mapPts(BASE1, MATS[2].m) },",
      why:"the 'flipped' example would actually be a rotated copy" },
    { file:"index", via:"index", expect:"scale example",
      find:"    { id:'scale', A:BASE1, B:scaleP(BASE1, SCALE_K) },",
      replace:"    { id:'scale', A:BASE1, B:scaleP(BASE1, 3) },",
      why:"the narration would still say 2 times while the picture shows 3" },
    { file:"index", via:"index", expect:"overlay",
      find:"      over = moves.length ? moveOnto(B, moves[0], lay.A)",
      replace:"      over = moves.length ? translate(anchor(B), bbox(lay.A).minX, bbox(lay.A).minY)",
      why:"a congruent pair laid on top would no longer coincide" },
    { file:"index", via:"index", expect:"scaleFactor",
      find:"    for (var k = 2; k <= 3; k++) if (findMoves(scaleP(A, k), B).length) return k;",
      replace:"    for (var k = 2; k <= 3; k++) if (findMoves(scaleP(A, k), B).length) return k + 1;",
      why:"the narration would print the wrong enlargement factor" },

    /* --- 搬家任務 --- */
    { file:"index", via:"index", expect:"not a rigid move",
      find:"    else if (act === 'turn') out = translate(anchor(mapPts(P, MATS[1].m)), b.minX, b.minY);",
      replace:"    else if (act === 'turn') out = translate(anchor(scaleP(P, 1).map(function(p){ return [p[0], p[1] * 2]; })), b.minX, b.minY);",
      why:"the 'turn' button would stretch the shape" },
    { file:"index", via:"index", expect:"leaves the grid",
      find:"    return inGrid(out) ? out : null;",
      replace:"    return out;",
      why:"a slide could push the shape off the squared paper" },
    { file:"index", via:"index", expect:"PUZZLES",
      find:"    { id:'flip',  mat:4, at:[6, 3] }",
      replace:"    { id:'flip',  mat:2, at:[6, 3] }",
      why:"the 'flip' task would be solvable without flipping" },
    { file:"index", via:"index", expect:"already solved before any move",
      find:"  function puzzleSolved(P, T){ return sameCycle(P, T); }",
      replace:"  function puzzleSolved(P, T){ return sameCycle(anchor(P), anchor(T)); }",
      why:"the task would count as solved when the shape merely has the right orientation, anywhere on the paper" },
    { file:"index", via:"index", expect:"unreachable",
      find:"    { id:'slide', mat:0, at:[5, 4] },",
      replace:"    { id:'slide', mat:0, at:[15, 4] },",
      why:"the target would poke out of the squared paper" },

    /* --- 對應 --- */
    { file:"index", via:"index", expect:"labelOrder",
      find:"    for (i = 0; i < n; i++) out.push(ccw ? ((start - i) % n + n) % n : (start + i) % n);",
      replace:"    for (i = 0; i < n; i++) out.push(ccw ? (start + i) % n : ((start - i) % n + n) % n);",
      why:"letters would run anticlockwise, so the page's names would stop matching the reference's" },
    { file:"index", via:"index", expect:"name is wrong",
      find:"    if (Math.min(oi, oj) === 0 && Math.max(oi, oj) === n - 1) return labels[0] + labels[n - 1];",
      replace:"    if (Math.min(oi, oj) === 0 && Math.max(oi, oj) === n - 1) return labels[n - 1] + labels[0];",
      why:"the closing side would be called DA instead of AD" },
    { file:"index", via:"index", expect:"label",
      find:"  var LABEL_R = 15;        // 頂點字母離頂點多遠",
      replace:"  var LABEL_R = 3;         // 頂點字母離頂點多遠",
      why:"letters would sit on the vertices, on top of the edges" },
    { file:"index", via:"index", expect:"inside polygon",
      find:"    var sgn = isReflex(P, i) ? 1 : -1;        // 凸角往角平分線的反方向，凹角往正方向",
      replace:"    var sgn = isReflex(P, i) ? -1 : 1;        // 凸角往角平分線的反方向，凹角往正方向",
      why:"every letter would be pushed into the shape instead of out of it" },
    { file:"index", via:"index", expect:"CORR_SHAPES",
      find:"    { shape:'Q2',   mat:1, at:[11, 2] },",
      replace:"    { shape:'Q2',   mat:0, at:[11, 2] },",
      why:"the 'turned' example would be a plain slide, so finding the match would be trivial" },
    { file:"index", via:"index", expect:"is inside polygon",
      find:"    return shoelace2(P) > 0 ? left < 0 : left > 0;",
      replace:"    return shoelace2(P) > 0 ? left > 0 : left < 0;",
      why:"every convex corner would be called reflex and the arc would be drawn round the outside" },
    { file:"index", via:"index", expect:"right-angle mark",
      find:"      return { kind:'right', v:v, p1:p1, p2:p2, p3:{ x:p1.x + p2.x - v.x, y:p1.y + p2.y - v.y } };",
      replace:"      return { kind:'right', v:v, p1:p1, p2:p2, p3:{ x:p1.x + p2.x - v.x + 4, y:p1.y + p2.y - v.y } };",
      why:"the little square would stop being square" },
    { file:"index", via:"index", expect:"arc",
      find:"      if (!best || dd < best.dd) best = { sw:sw, dd:dd, arc:arc };",
      replace:"      if (!best || dd > best.dd) best = { sw:sw, dd:dd, arc:arc };",
      why:"the angle arc would be drawn on the outside of the corner" },
    { file:"index", via:"index", expect:"sameAngle",
      find:"    if (da * da * lb !== db * db * la) return false;",
      replace:"    if (da * da * lb !== db * db * la) return true;",
      why:"two different angles would be reported as the same size" },

    /* --- 面積 --- */
    { file:"index", via:"index", expect:"S4_CASES",
      find:"    { id:'areaOnly',  A:rect(6, 2), B:rect(4, 3) },",
      replace:"    { id:'areaOnly',  A:rect(6, 2), B:rect(5, 3) },",
      why:"the 'same area' example would no longer have the same area" },
    { file:"index", via:"index", expect:"areaCells",
      find:"  function areaCells(P){ return Math.abs(shoelace2(P)) / 2; }",
      replace:"  function areaCells(P){ return Math.abs(shoelace2(P)); }",
      why:"every area on the page would be doubled" },
    { file:"index", via:"index", expect:"perimGrid",
      find:"      s += Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);\n    }\n    return s;\n  }\n  /* 一條邊的長度",
      replace:"      s += Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]);\n    }\n    return s + 2;\n  }\n  /* 一條邊的長度",
      why:"every perimeter on the page would be 2 too many" },
    { file:"index", via:"index", expect:"must never justify congruence by area",
      find:"        if (congruent) return '藍色轉一下就和橘色<strong>完全重合</strong> —— <strong>全等</strong>。",
      replace:"        if (congruent) return '藍色轉一下就和橘色<strong>完全重合</strong> —— <strong>全等</strong>，因為面積一樣。",
      why:"the narration would justify congruence by area, the exact misconception the example refutes" },

    /* --- 題庫與遊戲 --- */
    { file:"index", via:"index", expect:"qs[1]",
      find:"          opts:['只要平移（直直搬過去）','要翻轉（翻過來再搬過去）','要旋轉（轉方向再搬過去）','怎麼搬都不會重合'], ans:2,",
      replace:"          opts:['只要平移（直直搬過去）','要翻轉（翻過來再搬過去）','要旋轉（轉方向再搬過去）','怎麼搬都不會重合'], ans:1,",
      why:"a rotated copy would be marked as a flip" },
    { file:"index", via:"index", expect:"QUIZ_FIGS.q2",
      find:"    q2:{ A:shapeById('L4').pts, B:mapPts(shapeById('L4').pts, MATS[2].m) },",
      replace:"    q2:{ A:shapeById('L4').pts, B:mapPts(shapeById('L4').pts, MATS[5].m) },",
      why:"the picture would show a flip while the key says a turn" },
    { file:"index", via:"index", expect:"QUIZ_FIGS.q4",
      find:"    q4:{ A:shapeById('TRAP').pts, B:scaleP(shapeById('TRAP').pts, SCALE_K) }",
      replace:"    q4:{ A:shapeById('TRAP').pts, B:mapPts(shapeById('TRAP').pts, MATS[1].m) }",
      why:"the picture would show a congruent pair while the key says not congruent" },
    { file:"index", via:"index", expect:"qsAdv[2]",
      find:"          opts:['9 公分','不一定','18 公分','36 公分'], ans:2,",
      replace:"          opts:['9 公分','不一定','18 公分','36 公分'], ans:1,",
      why:"the perimeter question would be keyed to 'it depends'" },
    { file:"index", via:"index", expect:"qsBoost[1]",
      find:"面積一樣不一定全等 —— 6 × 4 和 8 × 3 都是 24，可是疊起來不會重合','長方形都全等'], ans:2,",
      replace:"面積一樣不一定全等 —— 6 × 4 和 8 × 3 都是 25，可是疊起來不會重合','長方形都全等'], ans:2,",
      why:"the correct option would carry a wrong product" },
    { file:"index", via:"index", expect:"ROUNDS[0]",
      find:"      cands:[ mapPts(shapeById('P5').pts, MATS[4].m), scaleP(shapeById('P5').pts, SCALE_K),\n              shapeById('P5').alt, shapeById('L4').pts ] },",
      replace:"      cands:[ mapPts(shapeById('P5').pts, MATS[4].m), mapPts(shapeById('P5').pts, MATS[1].m),\n              shapeById('P5').alt, shapeById('L4').pts ] },",
      why:"two candidates would be congruent to the target, so a correct choice could be marked wrong" },
    { file:"index", via:"index", expect:"ROUNDS[1]",
      find:"    { kind:'moveName', shape:'T34', mat:6 },",
      replace:"    { kind:'moveName', shape:'T34', mat:0 },",
      why:"the 'which move' round would show an unmoved copy" },
    { file:"index", via:"index", expect:"ROUNDS[3]",
      find:"    { kind:'rectPair', A:rect(4, 4), B:rect(8, 2) },",
      replace:"    { kind:'rectPair', A:rect(4, 4), B:rect(8, 3) },",
      why:"the two rectangles would no longer have the same area, so the customer's claim would not even be tempting" },
    { file:"index", via:"index", expect:"less than two squares apart",
      find:"    { kind:'rectPair', A:rect(4, 4), B:rect(8, 2) },",
      replace:"    { kind:'rectPair', A:rect(6, 4), B:rect(8, 3) },",
      why:"the two rectangles would fill the row and touch, reading as one shape (the first draft did exactly this)" },
    { file:"index", via:"index", expect:"not the move actually used",
      find:"      return opts.indexOf(rel === 'same' ? 'slide' : rel);",
      replace:"      return opts.indexOf('turn');",
      why:"the answer would be hard-coded instead of computed from the shapes" },
    { file:"index", via:"index", expect:"the mini canvas is 108×84",
      find:"  var MINI_CELL = 12, MINI_COLS = 9, MINI_ROWS = 7;   // 遊戲選項裡的小圖",
      replace:"  var MINI_CELL = 12, MINI_COLS = 5, MINI_ROWS = 4;   // 遊戲選項裡的小圖",
      why:"the enlarged candidate would not fit inside its little canvas" },
    { file:"index", via:"index", expect:"game figure caption",
      find:"      gCapPair:'📐 左邊橘色、右邊藍色',",
      replace:"      gCapPair:'📐 左邊橘色、右邊藍色（4 × 4 和 8 × 2）',",
      why:"the caption under the game figure would print the rectangle sizes from the question" },

    /* --- 旁白 --- */
    { file:"index", via:"index", expect:"missing space between Chinese and a digit",
      find:"      s1calc:function(cellsA, cellsB){ return '橘色 ' + cellsA + ' 格　·　藍色 ' + cellsB + ' 格'; },",
      replace:"      s1calc:function(cellsA, cellsB){ return '橘色' + cellsA + ' 格　·　藍色 ' + cellsB + ' 格'; },",
      why:"Chinese glued to a digit is only visible once the sentence is rendered" },
    { file:"index", via:"index", expect:"bad english singular",
      find:"      s2calc:function(n){ return n + ' ' + plEn(n, 'step') + ' so far'; },",
      replace:"      s2calc:function(n){ return n + ' steps so far'; },",
      why:"'1 steps' is only visible once the sentence is rendered with n = 1" },
    { file:"index", via:"index", expect:"contradicts the computed relation",
      find:"        if (rel === 'flip') return '藍色是橘色<strong>翻過來</strong>的樣子（像鏡子裡的樣子）。翻過來再搬過去，還是<strong>完全重合</strong> —— 翻過來也不改變形狀和大小，所以它們<strong>全等</strong>。';",
      replace:"        if (rel === 'flip') return '藍色是橘色<strong>翻過來</strong>的樣子（像鏡子裡的樣子）。翻過來的左右相反了，所以它們<strong>不全等</strong>。';",
      why:"the flipped case would be narrated as not congruent — the headline misconception, taught as fact" },
    { file:"index", via:"index", expect:"s3narr",
      find:"        s += right ? ('角 ' + la + ' 是直角，角 ' + lb + ' 也是直角 —— <strong>對應角一樣大</strong>。')",
      replace:"        s += right ? ('角 ' + la + ' 是直角，角 ' + lb + ' 也是直角 —— <strong>對應角差不多大</strong>。')",
      why:"'the same size' would soften into 'about the same'" },

    /* --- 措辭與範圍 --- */
    { file:"index", via:"index", expect:"KEY: index.html s2note no longer says",
      find:"⚠️ 有一種變法<strong>不是</strong>搬法：把圖形<strong>放大或縮小</strong> —— 形狀雖然一樣，大小變了，就<strong>不全等</strong>了。',",
      replace:"⚠️ 有一種變法<strong>不是</strong>搬法：把圖形<strong>變大或變小</strong> —— 形狀雖然一樣，大小變了，就<strong>不全等</strong>了。',",
      why:"the note that names enlarging would stop naming it — pinned to that i18n key" },
    { file:"index", via:"index", expect:"SIBLING",
      find:"      s1note:'💬 <strong>全等</strong>的意思只有一個：<strong>疊起來能完全重合</strong>，",
      replace:"      // 疊起來能完全重合\n      s1note:'💬 <strong>全等</strong>的意思只有一個：<strong>疊起來能重合</strong>，",
      why:"the definition is weakened and the old wording pasted into a comment — the scanner must strip it, so the pinned count still drops" },
    { file:"index", via:"index", expect:"HANDOFF",
      find:"那種圖形叫「相似」，是國中的內容；<strong>要有哪些條件才保證兩個三角形全等</strong>也是國中的內容，這一課只用「全等，所以對應邊一樣長」這個方向。線對稱在五年級的「對摺魔鏡」。',",
      replace:"那種圖形叫「相似」，下一課就會學；<strong>要有哪些條件才保證兩個三角形全等</strong>也是國中的內容，這一課只用「全等，所以對應邊一樣長」這個方向。線對稱在五年級的「對摺魔鏡」。',",
      why:"'similar' would be promised for the next lesson instead of handed on to junior high" },
    { file:"index", via:"index", expect:"PAIRED",
      find:"      s4note:'💬 <strong>全等</strong>的圖形<strong>面積一定一樣、周長也一定一樣</strong>（每一條對應邊都一樣長）。可是<strong>反過來不成立</strong>：",
      replace:"      s4note:'💬 <strong>全等</strong>的圖形<strong>面積一定一樣、周長也一定一樣</strong>（每一條對應邊都一樣長）。所以：",
      why:"the guarantee would be stated with no note that the converse fails" },
    { file:"parents", via:"index", expect:"SIBLING",
      find:"      b3:'兩個全等的圖形一個標 A、B、C、D，另一個標 E、F、G、H 時，指得出<strong>哪一個頂點對應哪一個</strong>，而且說得出「對應邊一樣長、對應角一樣大」。',",
      replace:"      b3:'兩個全等的圖形一個標 A、B、C、D，另一個標 E、F、G、H 時，指得出<strong>哪一個頂點對應哪一個</strong>，而且說得出「對應邊一樣長」。',",
      why:"the parents page would drop half of the correspondence rule from the dictionary copy only — the pinned count still drops" },
    { file:"reference", via:"index", expect:"FORBIDDEN",
      find:"      m3b:'❌ 面積一樣，所以全等。',",
      replace:"      m3b:'❌ 面積一樣一定全等。',",
      why:"a phrase this lesson must never print, even as the wrong side of a contrast" },
    { file:"parents", via:"index", expect:"KEY: parents.html s1p2 no longer says",
      find:"      s1p2:'<strong>大人最容易誤解</strong>的有兩件事。第一，很多人覺得<strong>翻過來（鏡像）的圖形不算一樣</strong> —— 在四年級的定義裡，翻轉是三種搬法之一，翻過來的圖形<strong>也全等</strong>",
      replace:"      s1p2:'<strong>大人最容易誤解</strong>的有兩件事。第一，很多人覺得<strong>翻過來（鏡像）的圖形不算一樣</strong> —— 在四年級的定義裡，翻轉是三種搬法之一，翻過來的圖形<strong>大致上一樣</strong>",
      why:"the parents page would stop telling adults that a flipped shape is congruent" },
    { file:"reference", via:"index", expect:"must not draw any SVG",
      find:"  <header>\n    <h1 data-i18n=\"h1\">🗂️ 速查卡：全等搬家公司</h1>",
      replace:"  <svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"></circle></svg>\n  <header>\n    <h1 data-i18n=\"h1\">🗂️ 速查卡：全等搬家公司</h1>",
      why:"the cheat sheet is deliberately text-only" },
    { file:"index", via:"index", expect:"creates an SVG <rect>",
      find:"  function drawDot(svg, q, colour, r){\n    svg.appendChild(svgEl('circle', { cx:q.x, cy:q.y, r:r || DOT_R, fill:colour }));",
      replace:"  function drawDot(svg, q, colour, r){\n    svg.appendChild(svgEl('rect', { x:q.x, y:q.y, width:1, height:1 }));\n    svg.appendChild(svgEl('circle', { cx:q.x, cy:q.y, r:r || DOT_R, fill:colour }));",
      why:"an element outside the allow-list would bypass every geometry assertion" },
    { file:"index", via:"index", expect:"the comment scanner cannot be trusted on it",
      find:"  var C_LINE = '#2B2A33', C_A = '#E8871E', C_B = '#3B7DD8',",
      replace:"  var C_TPL = `x`;\n  var C_LINE = '#2B2A33', C_A = '#E8871E', C_B = '#3B7DD8',",
      why:"a template literal is exactly what the comment scanner cannot follow, so it must fail closed" },
    { file:"index", via:"index", expect:"teachme-last",
      find:"JSON.stringify({p:'grade-4/math/congruent/',",
      replace:"JSON.stringify({p:'grade-4/math/angle-shape/',",
      why:"the home page's 'continue' button would send the child to the wrong lesson" },

    /* --- review.html 的產生器（走 simgen） --- */
    { file:"review", via:"review", expect:"pairKind: key",
      find:"          var key = rel === 'same' ? 'congSlide' : (rel === 'turn' || rel === 'flip') ? 'congTurnFlip'\n                  : scaleFactor(A, B) ? 'notScale' : 'notShape';",
      replace:"          var key = rel === 'same' ? 'congSlide' : (rel === 'turn' || rel === 'flip') ? 'congTurnFlip'\n                  : 'notShape';",
      why:"the enlarged copy would be keyed as 'a different shape'" },
    { file:"review", via:"review", expect:"opts[ans] != correct",
      find:"          var key = rel === 'same' ? 'slide' : rel;\n          var keys = shuffle(MOVE_KEYS);\n          return { sid:s.id, mat:mat, A:s.pts, B:B, key:key, keys:keys, ans:keys.indexOf(key) };",
      replace:"          var key = rel === 'same' ? 'slide' : rel;\n          var keys = shuffle(MOVE_KEYS);\n          return { sid:s.id, mat:mat, A:s.pts, B:B, key:key, keys:keys, ans:keys.indexOf('turn') };",
      why:"every 'which move' question would be keyed to 'a turn'" },
    { file:"review", via:"review", expect:"corrVertex",
      find:"          var la = labelOf(lay.A, LABELS_A, vi), lb = labelOf(lay.B, LABELS_B, vi);",
      replace:"          var la = labelOf(lay.A, LABELS_A, vi), lb = labelOf(lay.B, LABELS_B, (vi + 1) % 4);",
      why:"the matching vertex would be off by one" },
    { file:"review", via:"review", expect:"corrSide",
      find:"          var nameA = edgeName(lay.A, LABELS_A, ei, j), nameB = edgeName(lay.B, LABELS_B, ei, j);",
      replace:"          var nameA = edgeName(lay.A, LABELS_A, ei, j), nameB = edgeName(lay.B, LABELS_B, j, (j + 1) % 4);",
      why:"the matching side would be the next side along" },
    { file:"review", via:"review", expect:"whichCong: not exactly one",
      find:"          var cands = shuffle([good].concat(bad));\n          var hits = [];\n          cands.forEach(function(C, i){ if (isCongruent(C, s.pts)) hits.push(i); });\n          if (hits.length !== 1) return null;",
      replace:"          var cands = shuffle([good, s.pts].concat(bad.slice(0, 2)));\n          var hits = [];\n          cands.forEach(function(C, i){ if (isCongruent(C, s.pts)) hits.push(i); });",
      why:"an unmoved copy of the target would be offered as a distractor, so two colours would be right" },
    { file:"review", via:"review", expect:"stem",
      find:"          stem: lang === 'zh' ? '甲、乙兩個圖形<strong>全等</strong>。甲的邊 AB 是 <strong>' + d.n + ' 公分</strong>，它對應乙的邊 EF。邊 EF 是幾公分？'",
      replace:"          stem: lang === 'zh' ? '甲、乙兩個圖形<strong>全等</strong>。甲的邊 AB 是 <strong>' + d.n + ' 公分</strong>，它對應乙的邊 EF。邊 EF 是幾公分？邊 EH 呢？'",
      why:"a second question would be tacked onto the stem — only the exact-stem rebuild can see it" },
    { file:"review", via:"review", expect:"the straight-angle distractor",
      find:"          var opts = numOpts(x, [180 - x, x + 10, x - 10, 90 - x], [], inDeg);\n          if (!opts) return null;\n          if (opts.indexOf(180 - x) < 0) return null;",
      replace:"          var opts = numOpts(x, [x + 10, x - 10, 90 - x], [], inDeg);\n          if (!opts) return null;",
      why:"the 'subtract from a straight line' distractor would vanish" },
    { file:"review", via:"review", expect:"perimCong",
      find:"          var p = 2 * (a + b), area = a * b;\n          var opts = numOpts(p, [area, a + b, 2 * a + b], [a, b], inBig);",
      replace:"          var p = 2 * a + b, area = a * b;\n          var opts = numOpts(p, [area, a + b, 2 * a + b], [a, b], inBig);",
      why:"the perimeter would be computed wrongly" },
    { file:"review", via:"review", expect:"areaCong",
      find:"          var area = a * b, p = 2 * (a + b);\n          var opts = numOpts(area, [p, a + b, 2 * area], [a, b], inBig);",
      replace:"          var area = a * b + 1, p = 2 * (a + b);\n          var opts = numOpts(area, [p, a + b, 2 * area], [a, b], inBig);",
      why:"the area would be one too many" },
    { file:"review", via:"review", expect:"rectPair",
      find:"    [[9, 4], [6, 6]], [[12, 3], [9, 4]], [[7, 2], [14, 1]], [[5, 3], [15, 1]]",
      replace:"    [[9, 4], [6, 6]], [[12, 3], [9, 4]], [[7, 2], [14, 1]], [[5, 3], [3, 5]]",
      why:"a congruent pair would be offered where the question expects two different rectangles" },
    { file:"review", via:"review", expect:"sidesPerim: two options are the same pair",
      find:"          var cands = shuffle([[n, 2 * p], [n + 1, p], [n, p + 2], [n - 1, p], [n, p - 2]]);\n          var opts = [correct], seen = {};\n          seen[correct.join()] = 1;",
      replace:"          var cands = shuffle([[n, p], [n + 1, p], [n, p + 2], [n - 1, p], [n, p - 2]]);\n          var opts = [correct], seen = {};",
      why:"a distractor equal to the key would slip past a disabled dedupe, so two options would be right" },
    { file:"review", via:"review", expect:"changeKind",
      find:"          var key = act === 'scale' ? 'notScale' : 'congKeep';",
      replace:"          var key = act === 'flip' ? 'notShape' : act === 'scale' ? 'notScale' : 'congKeep';",
      why:"a flip would be keyed as 'the shape changed'" },
    { file:"review", via:"review", expect:"outside the canvas",
      find:"  var PAIR_LEFT_X = 1, PAIR_Y = 2, PAIR_RIGHT_END = 15;\n  var SCALE_K = 2;\n  function px(gx)",
      replace:"  var PAIR_LEFT_X = 1, PAIR_Y = 2, PAIR_RIGHT_END = 17;\n  var SCALE_K = 2;\n  function px(gx)",
      why:"the right-hand shape would be drawn past the edge of the paper" },
    { file:"review", via:"review", expect:"label",
      find:"  var LABEL_R = 15, LABEL_FONT = 14, DOT_R = 3.5, LINE_W = 2.5;",
      replace:"  var LABEL_R = 2, LABEL_FONT = 14, DOT_R = 3.5, LINE_W = 2.5;",
      why:"letters would be drawn on top of the vertices and edges" },
    { file:"review", via:"review", expect:"not a full square apart",
      find:"    return { A:translate(anchor(A), PAIR_LEFT_X, PAIR_Y), B:translate(anchor(B), PAIR_RIGHT_END - bB.w, PAIR_Y) };",
      replace:"    return { A:translate(anchor(A), PAIR_LEFT_X, PAIR_Y), B:translate(anchor(B), PAIR_LEFT_X + bbox(A).w, PAIR_Y) };",
      why:"the two shapes would touch, so the picture would read as one shape" },
    { file:"review", via:"review", expect:"figure caption",
      find:"      capPair:'📐 左邊橘色、右邊藍色，都畫在同一張方格紙上',",
      replace:"      capPair:'📐 左邊橘色、右邊藍色，都畫在同一張方格紙上（右邊是翻過來的）',",
      why:"the caption would give away the answer of the 'which move' question" },
    { file:"review", via:"review", expect:"missing space between Chinese and a digit",
      find:"      cm:function(n){ return n + ' 公分'; },",
      replace:"      cm:function(n){ return n + '公分'; },",
      why:"Chinese glued to a digit is only visible once the option is rendered" }
  ],

  /* ================= review.html 的產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      pairKind: function(d){
        if (!d) return 'pairKind: make() returned nothing';
        const s = SHAPES_REF[d.sid];
        if (!s || !eqPoly(d.A, s.pts)) return 'pairKind: A is not the library shape ' + d.sid;
        if (!trivialSymRef(d.A)) return 'pairKind: the shape has a symmetry, so the move would not be unique';
        if (['same', 'turn', 'flip', 'scale', 'shape'].indexOf(d.kind) < 0) return 'pairKind: unknown kind ' + d.kind;
        const rel = relationRef(d.A, d.B);
        const keyRef = rel === 'same' ? 'congSlide' : (rel === 'turn' || rel === 'flip') ? 'congTurnFlip' : scaleFactorRef(d.A, d.B) ? 'notScale' : 'notShape';
        if (d.key !== keyRef) return 'pairKind: key ' + d.key + ' but the reference says ' + keyRef;
        if (d.kind === 'same' && rel !== 'same') return 'pairKind: the "same" case is not a plain slide';
        if (d.kind === 'turn' && rel !== 'turn') return 'pairKind: the "turn" case is ' + rel;
        if (d.kind === 'flip' && rel !== 'flip') return 'pairKind: the "flip" case is ' + rel;
        if (d.kind === 'scale' && !eqPoly(d.B, scaleRef(d.A, SCALE_K_REF))) return 'pairKind: the scale example is not exactly ' + SCALE_K_REF + ' times the shape';
        if (d.kind === 'shape' && !eqPoly(d.B, s.alt)) return 'pairKind: the shape example is not the library alt';
        if (!isPerm(d.keys, PAIR_KEYS_REF)) return 'pairKind: the four options are not the four conclusions';
        if (d.keys[d.ans] !== d.key) return 'pairKind: ans does not point at the key';
        return null;
      },
      moveName: function(d){
        if (!d) return 'moveName: make() returned nothing';
        const s = SHAPES_REF[d.sid];
        if (!s || !eqPoly(d.A, s.pts)) return 'moveName: A is not the library shape ' + d.sid;
        if (!(d.mat >= 0 && d.mat < 8)) return 'moveName: mat out of range';
        if (!congRef(d.A, d.B)) return 'moveName: B is not a moved copy of A';
        const rel = relationRef(d.A, d.B);
        const keyRef = rel === 'same' ? 'slide' : rel;
        if (d.key !== keyRef) return 'moveName: key ' + d.key + ' but the reference says ' + keyRef;
        if (d.key === 'scale') return 'moveName: a moved copy can never be an enlargement';
        if (!isPerm(d.keys, MOVE_KEYS_REF)) return 'moveName: options are not the four moves';
        if (d.keys[d.ans] !== d.key) return 'moveName: ans does not point at the key';
        return null;
      },
      corrVertex: function(d){
        if (!d) return 'corrVertex: make() returned nothing';
        if (QUAD_IDS_REF.indexOf(d.sid) < 0) return 'corrVertex: not a four-vertex shape';
        if (!(d.mat >= 1 && d.mat < 8)) return 'corrVertex: the right shape must be moved (mat 1~7)';
        if (!(d.vi >= 0 && d.vi < 4)) return 'corrVertex: vertex index out of range';
        const lay = corrLayoutRef(d.sid, d.mat);
        if (labelOfRef(lay.A, LABELS_A_REF, d.vi) !== d.la) return 'corrVertex: the left label is wrong';
        if (labelOfRef(lay.B, LABELS_B_REF, d.vi) !== d.lb) return 'corrVertex: the matching label is wrong';
        if (!isPerm(d.keys, LABELS_B_REF)) return 'corrVertex: options are not E~H';
        if (d.keys[d.ans] !== d.lb) return 'corrVertex: ans does not point at the match';
        if (d.right !== isRightRef(lay.A, d.vi)) return 'corrVertex: the right-angle flag is wrong';
        if (d.reflex !== isReflexRef(lay.A, d.vi)) return 'corrVertex: the reflex flag is wrong';
        return null;
      },
      corrSide: function(d){
        if (!d) return 'corrSide: make() returned nothing';
        if (QUAD_IDS_REF.indexOf(d.sid) < 0) return 'corrSide: not a four-vertex shape';
        if (!(d.mat >= 1 && d.mat < 8)) return 'corrSide: the right shape must be moved (mat 1~7)';
        const lay = corrLayoutRef(d.sid, d.mat), j = (d.ei + 1) % 4;
        if (edgeNameRef(lay.A, LABELS_A_REF, d.ei, j) !== d.nameA) return 'corrSide: the left side name is wrong';
        if (edgeNameRef(lay.B, LABELS_B_REF, d.ei, j) !== d.nameB) return 'corrSide: the matching side name is wrong';
        if (edgeLenRef(lay.A, d.ei, j) !== d.len) return 'corrSide: the side length is wrong';
        if (edgeLenRef(lay.B, d.ei, j) !== d.len) return 'corrSide: the matching side has a different length';
        const order = labelOrderRef(lay.B), want = [];
        for (let k = 0; k < 4; k++) want.push(edgeNameRef(lay.B, LABELS_B_REF, order[k], order[(k + 1) % 4]));
        if (!isPerm(d.keys, want)) return 'corrSide: options are not the four sides of the right shape';
        if (d.keys[d.ans] !== d.nameB) return 'corrSide: ans does not point at the match';
        return null;
      },
      whichCong: function(d){
        if (!d) return 'whichCong: make() returned nothing';
        const s = SHAPES_REF[d.sid];
        if (!s || !eqPoly(d.target, s.pts)) return 'whichCong: the target is not the library shape ' + d.sid;
        if (d.cands.length !== 4) return 'whichCong: needs four candidates';
        const ansRef = whichAnsRef(d.target, d.cands);
        if (ansRef < 0) return 'whichCong: not exactly one candidate is congruent to the target';
        if (d.ans !== ansRef) return 'whichCong: ans does not point at the congruent candidate';
        if (d.tone !== WHICH_TONES_REF[ansRef]) return 'whichCong: the tone does not match the answer';
        for (let i = 0; i < 4; i++){
          const b = bboxRef(d.cands[i]);
          if (b.w > 4 || b.h > 4) return 'whichCong: a candidate does not fit its quadrant';
          if (!intPoly(d.cands[i])) return 'whichCong: a candidate has non-integer vertices';
          for (let j = i + 1; j < 4; j++) if (congRef(d.cands[i], d.cands[j])) return 'whichCong: two candidates are congruent to each other';
        }
        return null;
      },
      corrLen: function(d){
        if (!d) return 'corrLen: make() returned nothing';
        if (!(Number.isInteger(d.n) && d.n >= 3 && d.n <= 20)) return 'corrLen: n out of range';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'corrLen: options not four distinct values';
        if (d.opts[d.ans] !== d.n) return 'corrLen: ans does not point at n';
        return null;
      },
      corrAngle: function(d){
        if (!d) return 'corrAngle: make() returned nothing';
        if (ANGLE_POOL_REF.indexOf(d.x) < 0) return 'corrAngle: x is not in the pool';
        if (d.opts.indexOf(180 - d.x) < 0) return 'corrAngle: the straight-angle distractor (180 − x) must be offered';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'corrAngle: options not four distinct values';
        if (d.opts[d.ans] !== d.x) return 'corrAngle: ans does not point at x';
        return null;
      },
      perimCong: function(d){
        if (!d) return 'perimCong: make() returned nothing';
        if (!(d.a >= 3 && d.a <= 12 && d.b >= 2 && d.b < d.a)) return 'perimCong: sides out of range';
        if (d.p !== (d.a + d.b) + (d.a + d.b)) return 'perimCong: the perimeter is not two lengths plus two widths';
        if (d.opts[d.ans] !== d.p) return 'perimCong: ans does not point at the perimeter';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'perimCong: options not four distinct values';
        if (d.opts.indexOf(d.a) >= 0 || d.opts.indexOf(d.b) >= 0) return 'perimCong: an option repeats a side from the stem';
        return null;
      },
      areaCong: function(d){
        if (!d) return 'areaCong: make() returned nothing';
        if (!(d.a >= 3 && d.a <= 12 && d.b >= 2 && d.b < d.a)) return 'areaCong: sides out of range';
        if (d.area !== sumTimes(d.a, d.b)) return 'areaCong: the area is not length × width';
        if (d.opts[d.ans] !== d.area) return 'areaCong: ans does not point at the area';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'areaCong: options not four distinct values';
        return null;
      },
      rectPair: function(d){
        if (!d) return 'rectPair: make() returned nothing';
        const hit = RECT_PAIRS_REF.some(pr => pr[0][0] === d.a && pr[0][1] === d.b && pr[1][0] === d.c && pr[1][1] === d.d2);
        if (!hit) return 'rectPair: the pair is not in the reference list';
        if (sumTimes(d.a, d.b) !== sumTimes(d.c, d.d2)) return 'rectPair: the two areas differ';
        if (d.area !== sumTimes(d.a, d.b)) return 'rectPair: area is wrong';
        if (sortNum([d.a, d.b]).join() === sortNum([d.c, d.d2]).join()) return 'rectPair: the two rectangles are congruent, so the question has no bite';
        if (d.key !== 'areaSameNotCong') return 'rectPair: key must be areaSameNotCong';
        if (!isPerm(d.keys, RECT_KEYS_REF)) return 'rectPair: options are not the four statements';
        if (d.keys[d.ans] !== d.key) return 'rectPair: ans does not point at the true statement';
        return null;
      },
      sidesPerim: function(d){
        if (!d) return 'sidesPerim: make() returned nothing';
        if ([3, 4, 5, 6].indexOf(d.n) < 0) return 'sidesPerim: side count out of range';
        if (!(Number.isInteger(d.p) && d.p >= 8 && d.p <= 40)) return 'sidesPerim: perimeter out of range';
        if (!Array.isArray(d.opts) || d.opts.length !== 4) return 'sidesPerim: needs four options';
        for (const o of d.opts){
          if (!Array.isArray(o) || o.length !== 2 || !Number.isInteger(o[0]) || !Number.isInteger(o[1])) return 'sidesPerim: an option is not two whole numbers';
        }
        const keys = d.opts.map(o => o.join(','));
        if (new Set(keys).size !== 4) return 'sidesPerim: two options are the same pair';
        const hit = d.opts.filter(o => o[0] === d.n && o[1] === d.p);
        if (hit.length !== 1) return 'sidesPerim: exactly one option must be n sides and p cm, found ' + hit.length;
        if (!(d.opts[d.ans] && d.opts[d.ans][0] === d.n && d.opts[d.ans][1] === d.p)) return 'sidesPerim: ans does not point at n sides and p cm';
        for (const o of d.opts){ if (o[0] < 3 || o[0] > 8 || o[1] < 1 || o[1] > BIG_MAX_REF) return 'sidesPerim: an option is out of range'; }
        return null;
      },
      changeKind: function(d){
        if (!d) return 'changeKind: make() returned nothing';
        if (['slide', 'turn', 'flip', 'scale'].indexOf(d.act) < 0) return 'changeKind: unknown action';
        if (d.act === 'slide' && !(d.k >= 1 && d.k <= 9)) return 'changeKind: slide distance out of range';
        if (d.act === 'turn' && [90, 180].indexOf(d.k) < 0) return 'changeKind: turn must be 90 or 180';
        if (d.act === 'scale' && !(d.k >= 2 && d.k <= 3)) return 'changeKind: scale factor out of range';
        const keyRef = d.act === 'scale' ? 'notScale' : 'congKeep';
        if (d.key !== keyRef) return 'changeKind: key ' + d.key + ' but the reference says ' + keyRef;
        if (!isPerm(d.keys, CHANGE_KEYS_REF)) return 'changeKind: options are not the four statements';
        if (d.keys[d.ans] !== d.key) return 'changeKind: ans does not point at the key';
        return null;
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      const t = TXT_REF[lang];
      switch (genId){
        case 'pairKind': {
          const rel = relationRef(d.A, d.B);
          const key = rel === 'same' ? 'congSlide' : (rel === 'turn' || rel === 'flip') ? 'congTurnFlip' : scaleFactorRef(d.A, d.B) ? 'notScale' : 'notShape';
          return t.pairKindOpt[key];
        }
        case 'moveName': { const rel = relationRef(d.A, d.B); return t.moveOpt[rel === 'same' ? 'slide' : rel]; }
        case 'corrVertex': { const lay = corrLayoutRef(d.sid, d.mat); return labelOfRef(lay.B, LABELS_B_REF, d.vi); }
        case 'corrSide': { const lay = corrLayoutRef(d.sid, d.mat); return edgeNameRef(lay.B, LABELS_B_REF, d.ei, (d.ei + 1) % 4); }
        case 'whichCong': { const a = whichAnsRef(d.target, d.cands); return a < 0 ? '(no unique congruent candidate)' : t.colorName[WHICH_TONES_REF[a]]; }
        case 'corrLen': return t.cm(d.n);
        case 'corrAngle': return t.deg(d.x);
        case 'perimCong': return t.cm((d.a + d.b) + (d.a + d.b));
        case 'areaCong': return t.sqcm(sumTimes(d.a, d.b));
        case 'rectPair': {
          const areaEq = sumTimes(d.a, d.b) === sumTimes(d.c, d.d2);
          const cong = sortNum([d.a, d.b]).join() === sortNum([d.c, d.d2]).join();
          return t.rectStatement[cong ? 'congBothRect' : areaEq ? 'areaSameNotCong' : 'areaDiffNotCong'];
        }
        case 'sidesPerim': return t.sidesPerim(d.n, d.p);
        case 'changeKind': return t.changeOpt[d.act === 'scale' ? 'notScale' : 'congKeep'];
        default: return '(no expectedCorrect rule for ' + genId + ')';
      }
    },

    /* 這一課的選項長什麼樣、範圍多少。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (GEN_IDS.indexOf(genId) < 0) return 'no optionOk rule for generator ' + genId;
      const t = TXT_REF[lang];
      const inSet = (obj) => Object.keys(obj).some(k => obj[k] === s);
      if (genId === 'pairKind') return inSet(t.pairKindOpt) ? null : 'option "' + s + '" is not one of the four conclusions';
      if (genId === 'moveName') return inSet(t.moveOpt) ? null : 'option "' + s + '" is not one of the four moves';
      if (genId === 'rectPair') return inSet(t.rectStatement) ? null : 'option "' + s + '" is not one of the four statements';
      if (genId === 'changeKind') return inSet(t.changeOpt) ? null : 'option "' + s + '" is not one of the four statements';
      if (genId === 'whichCong') return inSet(t.colorName) ? null : 'option "' + s + '" is not a colour';
      if (genId === 'corrVertex') return /^[EFGH]$/.test(s) ? null : 'option "' + s + '" is not a vertex of the right shape';
      if (genId === 'corrSide') return (/^[EFGH]{2}$/.test(s) && s[0] !== s[1]) ? null : 'option "' + s + '" is not a side of the right shape';
      let m;
      if (genId === 'corrLen' || genId === 'perimCong'){
        m = (lang === 'zh') ? /^(\d+) 公分$/.exec(s) : /^(\d+) cm$/.exec(s);
        if (!m) return 'option "' + s + '" is not a length in cm';
        const v = Number(m[1]);
        if (genId === 'corrLen' && !(v >= LEN_MIN_REF && v <= LEN_MAX_REF)) return 'option ' + s + ' is outside 1~40 cm';
        if (genId === 'perimCong' && !(v >= 1 && v <= BIG_MAX_REF)) return 'option ' + s + ' is outside 1~200 cm';
        return null;
      }
      if (genId === 'areaCong'){
        m = (lang === 'zh') ? /^(\d+) 平方公分$/.exec(s) : /^(\d+) square centimetres?$/.exec(s);
        if (!m) return 'option "' + s + '" is not an area in square cm';
        const v = Number(m[1]);
        if (lang === 'en' && ((v === 1) !== /centimetre$/.test(s))) return 'option "' + s + '" has the wrong singular/plural';
        return (v >= 1 && v <= BIG_MAX_REF) ? null : 'option ' + s + ' is outside 1~200';
      }
      if (genId === 'corrAngle'){
        m = /^(\d+)°$/.exec(s);
        if (!m) return 'option "' + s + '" is not a whole number of degrees';
        const v = Number(m[1]);
        return (v >= DEG_MIN_REF && v <= DEG_MAX_REF) ? null : 'option ' + s + ' is outside 1~179°';
      }
      if (genId === 'sidesPerim'){
        m = (lang === 'zh') ? /^(\d) 條邊、(\d+) 公分$/.exec(s) : /^(\d) (side|sides), (\d+) cm$/.exec(s);
        if (!m) return 'option "' + s + '" is not a side count with a perimeter';
        const n = Number(m[1]), p = Number(lang === 'zh' ? m[2] : m[3]);
        if (lang === 'en' && ((n === 1) !== (m[2] === 'side'))) return 'option "' + s + '" has the wrong singular/plural';
        if (n < 3 || n > 8) return 'option "' + s + '" has an impossible side count';
        if (p < 1 || p > BIG_MAX_REF) return 'option "' + s + '" perimeter out of range';
        return null;
      }
      return 'no optionOk rule for generator ' + genId;
    },

    /* 拿渲染出來的那一題再驗一次：題幹整句重建、圖的幾何、字、算式。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!d) return 'make() returned nothing';
      const want = STEM_EXACT[genId] ? STEM_EXACT[genId](d)[lang] : null;
      if (want === null) out.push('no exact stem for ' + genId);
      else if (q.stem !== want) out.push('stem is not the expected sentence: "' + q.stem.replace(/<\/?[A-Za-z][^>]*>/g, '') + '"');
      arithProblems(q.stem + ' ' + q.why).problems.forEach(p => out.push('why/stem: ' + p));
      ['stem', 'why'].forEach(k => textProblems(q[k], lang, k).forEach(p => out.push(p)));
      q.opts.forEach((o, i) => textProblems(o, lang, 'option ' + i).forEach(p => out.push(p)));
      const wantFig = FIG_GENS.indexOf(genId) >= 0;
      if (wantFig && !q.fig) out.push('this generator must come with a figure');
      if (!wantFig && q.fig) out.push('this generator must not come with a figure');
      if (q.fig){
        if (!q.cap) out.push('a figure with no caption');
        if (/\d/.test(String(q.cap))) out.push('figure caption contains a digit: ' + q.cap);
        if (/翻|轉|平移|放大|flip|turn|slide|enlarg/i.test(String(q.cap))) out.push('figure caption names a move, which gives the answer away');
        figProblems(q.fig, genId).forEach(p => out.push(p));
        const wantKind = (genId === 'whichCong') ? 'which' : (genId === 'corrVertex' || genId === 'corrSide') ? 'corr' : 'pair';
        if (q.fig.kind !== wantKind) out.push('figure kind ' + q.fig.kind + ' but expected ' + wantKind);
        const tones = q.fig.polys.map(p => p.tone).join('');
        if (wantKind === 'which' && tones !== 'bcdea') out.push('which-figure tones are ' + tones);
        if (wantKind !== 'which' && tones !== 'ab') out.push('pair-figure tones are ' + tones);
        if (wantKind === 'corr' && q.fig.labels.length !== 8) out.push('a corr figure must carry eight letters');
        if (wantKind !== 'corr' && q.fig.labels.length !== 0) out.push('only the corr figure may carry letters');
        /* 圖真的畫的是資料說的那兩個圖形（格點座標一致），而且畫布座標是格點算出來的。 */
        /* 每一個畫出來的多邊形都要對得上它的格點陣列（不只第一個）。 */
        const gridsOf = q.fig.kind === 'which' ? q.fig.grids : [q.fig.gridA, q.fig.gridB];
        if (!gridsOf || gridsOf.length !== q.fig.polys.length) out.push('figure has ' + q.fig.polys.length + ' polygons but ' + (gridsOf ? gridsOf.length : 0) + ' grid arrays');
        else gridsOf.forEach((G, k) => {
          const pts = q.fig.polys[k].pts;
          if (!G || pts.length !== G.length) { out.push('polygon ' + k + ' has ' + pts.length + ' points but its grid array has ' + (G ? G.length : 0)); return; }
          pts.forEach((p, i) => { if (Math.abs(p.x - pxRef(G[i][0])) > 1e-9 || Math.abs(p.y - pyRef(G[i][1])) > 1e-9) out.push('polygon ' + k + ' pixel ' + i + ' is not on its grid point'); });
        });
        if (wantKind === 'pair'){
          if (!eqPoly(anchorRef(q.fig.gridA), anchorRef(d.A))) out.push('the left polygon drawn is not A');
          if (!eqPoly(anchorRef(q.fig.gridB), anchorRef(d.B))) out.push('the right polygon drawn is not B');
        }
        if (wantKind === 'corr'){
          const lay = corrLayoutRef(d.sid, d.mat);
          if (!eqPoly(q.fig.gridA, lay.A) || !eqPoly(q.fig.gridB, lay.B)) out.push('the corr figure is not the reference layout');
          const letters = q.fig.labels.map(l => l.t).sort().join('');
          if (letters !== 'ABCDEFGH') out.push('corr letters are ' + letters);
          /* 每一個字母都要貼著**它自己的**頂點（離頂點剛好 LABEL_R），不是只有字母集合對。 */
          [[lay.A, LABELS_A_REF], [lay.B, LABELS_B_REF]].forEach(row => {
            const P = row[0], labels = row[1];
            P.forEach((g, i) => {
              const want = labelOfRef(P, labels, i), vx = pxRef(g[0]), vy = pyRef(g[1]);
              const near = q.fig.labels.filter(l => Math.abs(Math.hypot(l.x - vx, l.y - vy) - LABEL_R_REF) < 1e-6);
              if (near.length !== 1) out.push('vertex ' + want + ' has ' + near.length + ' letters at label distance');
              else if (near[0].t !== want) out.push('the letter beside vertex ' + want + ' reads ' + near[0].t);
            });
          });
        }
        if (wantKind === 'which'){
          if (!eqPoly(anchorRef(q.fig.grids[0]), anchorRef(d.target))) out.push('the blue target drawn is not the target');
          q.fig.grids.slice(1).forEach((P, k) => {
            if (!eqPoly(anchorRef(P), anchorRef(d.cands[k]))) out.push('candidate ' + k + ' drawn is not candidate ' + k);
            const cell = WHICH_CELLS_REF[k];
            P.forEach(p => { if (p[0] < cell[0] || p[0] > cell[0] + 5 || p[1] < cell[1] || p[1] > cell[1] + 5) out.push('candidate ' + k + ' leaves its quadrant'); });
          });
          q.fig.grids[0].forEach(p => { if (p[0] > 6) out.push('the target leaves its region'); });
        }
      }
      /* 解釋要真的講到正解那一件事。 */
      if (genId === 'corrAngle' && q.why.indexOf(String(180 - d.x)) < 0) out.push('why should name the straight-angle distractor ' + (180 - d.x));
      if (genId === 'whichCong' && q.why.indexOf(TXT_REF[lang].colorName[WHICH_TONES_REF[d.ans]]) < 0) out.push('why should name the correct colour');
      if (genId === 'corrVertex' && q.why.indexOf(d.lb) < 0) out.push('why should name the matching vertex');
      if (genId === 'corrSide' && q.why.indexOf(d.nameB) < 0) out.push('why should name the matching side');
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{FIG_W, FIG_H, CELL, COLS, ROWS, GX0, GY0, MINI_CELL, MINI_COLS, MINI_ROWS, MINI_W, MINI_H, ' +
                'LABEL_R, LABEL_FONT, DOT_R, LINE_W, MARK_LEN, ARC_R, PAIR_LEFT_X, PAIR_Y, PAIR_RIGHT_END, SCALE_K, ' +
                'px, py, MATS, applyMat, mapPts, translate, bbox, anchor, sameCycle, findMoves, relation, isCongruent, moveOnto, ' +
                'scaleP, scaleFactor, shoelace2, areaCells, axisAligned, perimGrid, edgeLen, edgeSq, cornerVecs, isRight, isReflex, sameAngle, ' +
                'SHAPES, shapeById, rect, L12, pairLayout, pairPlan, toPx, polyPath, BASE1, S1_CASES, ' +
                'PUZZLE_SHAPE, PUZZLE_START, PUZZLES, puzzleTarget, inGrid, doMove, moveKindOf, puzzleSolved, MOVE_ACTS, ' +
                'CORR_SHAPES, LABELS_A, LABELS_B, labelOrder, labelOf, edgeName, labelPos, arcOf, cornerMark, corrPlan, edgesAt, ' +
                'S4_CASES, shapeDesc, QUIZ_FIGS, plEn, isAreEn, MOVE_KEYS, RECT_STATEMENTS, ROUNDS, roundOptions, roundAnswer, candidatePlan, centrePlan}',
    optionValueMax: BIG_MAX_REF,

    check: function(data, I18N, fail, rawSrc){
      const src = stripComments(rawSrc);
      const sib = siblingSources();

      /* ---------- 1) 常數與畫布 ---------- */
      if (data.FIG_W !== FIG_W_REF || data.FIG_H !== FIG_H_REF) fail('the canvas is ' + FIG_W_REF + '×' + FIG_H_REF);
      if (data.CELL !== CELL_REF || data.COLS !== COLS_REF || data.ROWS !== ROWS_REF) fail('the grid is ' + COLS_REF + '×' + ROWS_REF + ' cells of ' + CELL_REF + 'px');
      if (data.GX0 < MARGIN_REF - 2 || data.GY0 < MARGIN_REF) fail('the grid must leave a margin inside the canvas');
      if (data.px(0) !== GX0_REF || data.py(0) !== GY0_REF + ROWS_REF * CELL_REF) fail('px()/py() do not map grid corners to the canvas');
      if (data.SCALE_K !== SCALE_K_REF) fail('the enlargement factor is ' + SCALE_K_REF);
      if (countOf(src, 'viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '"') !== 5)
        fail('expected 5 figure canvases in the lesson markup (four examples + the game), found ' + countOf(src, 'viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '"'));
      if (src.indexOf('max-width:' + FIG_W_REF + 'px;height:' + FIG_H_REF + 'px') < 0) fail('the .gridfig CSS size must match the viewBox');
      if (data.MINI_W !== MINI_W_REF || data.MINI_H !== MINI_H_REF) fail('the mini canvas is ' + MINI_W_REF + '×' + MINI_H_REF);
      if (src.indexOf('.degbtn svg{width:' + MINI_W_REF + 'px;height:' + MINI_H_REF + 'px') < 0) fail('the .degbtn svg CSS size must match the mini canvas');

      /* ---------- 2) 八種擺法：和參考實作逐一比對 ---------- */
      if (data.MATS.length !== 8) fail('MATS must list the eight placements');
      const probe = [[0, 0], [3, 0], [2, 2], [0, 1]];
      data.MATS.forEach(function(t, i){
        const det = t.m[0] * t.m[3] - t.m[1] * t.m[2];
        if (Math.abs(det) !== 1) fail('MATS[' + i + '] is not a rigid placement (det ' + det + ')');
        const wantKind = det === 1 ? (i === 0 ? 'same' : 'turn') : 'flip';
        if (t.kind !== wantKind) fail('MATS[' + i + '] (' + t.id + ') is marked ' + t.kind + ' but its determinant says ' + wantKind);
        if (i === 0 && t.m.join() !== '1,0,0,1') fail('MATS[0] must be the identity');
        /* 頁面的第 i 種擺法必須和參考的第 i 種擺法畫出同一個圖形（同一個索引）。 */
        if (!samePolyRef(anchorRef(data.mapPts(probe, t.m)), anchorRef(placeRef(probe, i))))
          fail('MATS[' + i + '] does not agree with the reference placement ' + i);
      });
      const imgs = new Set(data.MATS.map(t => canonRef(anchorRef(data.mapPts(probe, t.m)))));
      if (imgs.size !== 8) fail('the eight placements are not all different');
      /* 同一個多邊形反方向繞、或從別的頂點開始數，sameCycle 都要認得（翻過來的圖形繞的方向會反）。 */
      SHAPE_IDS_REF.forEach(function(id){
        const P = SHAPES_REF[id].pts;
        const rev = P.slice().reverse(), rot = P.slice(2).concat(P.slice(0, 2));
        if (!data.sameCycle(P, rev)) fail('sameCycle() must accept the same polygon traversed the other way round (' + id + ')');
        if (!data.sameCycle(P, rot)) fail('sameCycle() must accept the same polygon numbered from another vertex (' + id + ')');
        if (data.sameCycle(P, SHAPES_REF[id].alt)) fail('sameCycle() confuses ' + id + ' with its alt');
      });
      /* sameAngle 要對不一樣的角說不：直角梯形的直角 vs 它的銳角。 */
      const trap = SHAPES_REF.TRAP.pts;
      if (!data.sameAngle(trap, 0, trap, 3)) fail('sameAngle() must accept two right angles');
      if (data.sameAngle(trap, 0, trap, 1)) fail('sameAngle() must reject a right angle against an acute one');
      if (data.sameAngle(trap, 1, trap, 2)) fail('sameAngle() must reject an acute angle against an obtuse one');
      if (data.sameAngle(SHAPES_REF.DART.pts, 3, SHAPES_REF.DART.pts, 1)) fail('sameAngle() must reject a reflex corner against a convex one');
      /* 兩個都是銳角、可是大小不一樣（Q2 的頂點 1 與 3）：只比正負號會放過它。 */
      if (data.sameAngle(SHAPES_REF.Q2.pts, 1, SHAPES_REF.Q2.pts, 3)) fail('sameAngle() must reject two acute angles of different sizes');
      /* sameCycle vs 標準字串：對圖形庫的每一對圖形（含 alt 與八種擺法）比一次。 */
      SHAPE_IDS_REF.forEach(function(id){
        const P = SHAPES_REF[id].pts;
        for (let i = 0; i < 8; i++){
          const Q = anchorRef(placeRef(P, i));
          if (!data.sameCycle(anchorRef(P), Q) && samePolyRef(anchorRef(P), Q)) fail('sameCycle() misses a match the reference finds');
          if (data.sameCycle(anchorRef(P), Q) !== samePolyRef(anchorRef(P), Q)) fail('sameCycle() disagrees with the reference on ' + id + ' placement ' + i);
        }
        SHAPE_IDS_REF.forEach(function(id2){
          const Q = SHAPES_REF[id2].pts;
          if (data.relation(P, Q) !== relationRef(P, Q)) fail('relation() disagrees with the reference for ' + id + '/' + id2);
          if (data.relation(P, SHAPES_REF[id2].alt) !== relationRef(P, SHAPES_REF[id2].alt)) fail('relation() disagrees with the reference for ' + id + '/' + id2 + '.alt');
        });
        for (let i = 0; i < 8; i++){
          const Q = placeRef(P, i).map(p => [p[0] + 3, p[1] - 2]);
          if (data.relation(P, Q) !== relationRef(P, Q)) fail('relation() disagrees with the reference for ' + id + ' placement ' + i);
          if (data.relation(P, Q) !== kindRef(i)) fail('relation() of placement ' + i + ' should be ' + kindRef(i));
        }
      });

      /* ---------- 3) 圖形庫 ---------- */
      if (data.SHAPES.map(s => s.id).join() !== SHAPE_IDS_REF.join()) fail('SHAPES must be exactly ' + SHAPE_IDS_REF.join('/'));
      data.SHAPES.forEach(function(s){
        const ref = SHAPES_REF[s.id];
        if (!ref) return;
        /* 性質先驗、逐字比對放最後：不然改壞的圖形只會撞上「和參考不一樣」，
           它想證明的那條性質從頭到尾沒有響（codex 第二輪抓到）。 */
        if (!intPoly(s.pts) || !intPoly(s.alt)) fail(s.id + ': vertices must be integer grid points');
        const sp = simpleProblem(s.pts); if (sp) fail(s.id + ': not a simple polygon (' + sp + ')');
        const sa = simpleProblem(s.alt); if (sa) fail(s.id + '.alt: not a simple polygon (' + sa + ')');
        if (area2Ref(s.pts) <= 0) fail(s.id + ': vertices must run anticlockwise');
        if (!trivialSymRef(s.pts)) fail(s.id + ' has a symmetry, so "which move" would not have one answer');
        const b = bboxRef(s.pts);
        if (b.minX !== 0 || b.minY !== 0) fail(s.id + ' is not anchored at (0,0)');
        if (b.w > 4 || b.h > 4) fail(s.id + ' is bigger than 4×4 and will not fit a game quadrant');
        if (congRef(s.pts, s.alt)) fail(s.id + ' is congruent to its own alt');
        if (scaleFactorRef(s.pts, s.alt)) fail(s.id + '.alt is just an enlargement of the shape');
        const ba = bboxRef(s.alt);
        if (ba.w > 8 || ba.h > 6) fail(s.id + '.alt would not fit the pair layout');
        if (data.shapeById(s.id) !== s) fail('shapeById(' + s.id + ') does not return the shape');
        if (!eqPoly(s.pts, ref.pts)) fail(s.id + ': pts differ from the reference');
        if (!eqPoly(s.alt, ref.alt)) fail(s.id + ': alt differs from the reference');
      });
      if (data.shapeById('nope') !== null) fail('shapeById() must return null for an unknown id');
      if (!eqPoly(data.rect(3, 2), [[0, 0], [3, 0], [3, 2], [0, 2]])) fail('rect() does not build a rectangle');
      if (areaRef(data.L12) !== 12 || !intPoly(data.L12) || simpleProblem(data.L12)) fail('L12 must be a simple 12-square shape');
      /* 面積與周長的參考。 */
      [data.L12, data.rect(6, 2), data.rect(4, 3)].concat(SHAPE_IDS_REF.map(id => SHAPES_REF[id].pts)).forEach(function(P){
        if (data.areaCells(P) !== areaRef(P)) fail('areaCells() disagrees with the reference on ' + JSON.stringify(P));
        if (data.perimGrid(P) !== perimRef(P)) fail('perimGrid() disagrees with the reference on ' + JSON.stringify(P));
      });
      if (data.scaleFactor(SHAPES_REF.P5.pts, scaleRef(SHAPES_REF.P5.pts, 2)) !== 2) fail('scaleFactor() misses a 2× copy');
      if (data.scaleFactor(SHAPES_REF.P5.pts, SHAPES_REF.P5.pts) !== null) fail('scaleFactor() calls a congruent copy an enlargement');

      /* ---------- 4) 範例 1：五種對照 ---------- */
      if (data.S1_CASES.map(c => c.id).join() !== 'same,turn,flip,scale,shape') fail('S1_CASES must be same/turn/flip/scale/shape in that order');
      if (!eqPoly(data.BASE1, SHAPES_REF.P5.pts)) fail('example 1 must use the P shape');
      data.S1_CASES.forEach(function(c){
        const rel = relationRef(c.A, c.B), label = 'S1_CASES[' + c.id + ']';
        if (!eqPoly(c.A, data.BASE1)) fail(label + ': A must be the base shape');
        if ((c.id === 'same' || c.id === 'turn' || c.id === 'flip') && rel !== c.id) fail(label + ': the pair is ' + rel + ', not ' + c.id);
        if (c.id === 'scale'){
          if (rel !== 'none') fail(label + ': the scale example is congruent to the base');
          if (!eqPoly(c.B, scaleRef(c.A, SCALE_K_REF))) fail(label + ': the scale example is not exactly ' + SCALE_K_REF + ' times the base');
          if (scaleFactorRef(c.A, c.B) !== SCALE_K_REF) fail(label + ': scaleFactor of the scale example is not ' + SCALE_K_REF);
        }
        if (c.id === 'shape'){
          if (rel !== 'none') fail(label + ': the different-shape example is congruent to the base');
          if (!eqPoly(c.B, SHAPES_REF.P5.alt)) fail(label + ': the shape example must be the library alt');
          if (scaleFactorRef(c.A, c.B)) fail(label + ': the shape example is an enlargement');
        }
        [false, true].forEach(function(over){
          const plan = data.pairPlan(c.A, c.B, over);
          if (plan.rel !== rel) fail(label + ': pairPlan.rel disagrees with the reference (' + plan.rel + ' vs ' + rel + ')');
          if (plan.congruent !== (rel !== 'none')) fail(label + ': pairPlan.congruent is wrong');
          if (plan.cellsA !== areaRef(c.A) || plan.cellsB !== areaRef(c.B)) fail(label + ': cell counts are wrong');
          if (plan.scaleK !== (rel === 'none' ? scaleFactorRef(c.A, c.B) : null)) fail(label + ': scaleK is wrong');
          const bA = bboxRef(plan.A), bB = bboxRef(plan.B);
          if (bA.minX !== data.PAIR_LEFT_X || bA.minY !== data.PAIR_Y) fail(label + ': A is not at the left anchor');
          if (bB.maxX !== data.PAIR_RIGHT_END || bB.minY !== data.PAIR_Y) fail(label + ': B is not against the right end');
          if (bB.minX - bA.maxX < 2) fail(label + ': the two shapes are less than two squares apart');
          [plan.A, plan.B].forEach(P => P.forEach(p => { if (p[0] < 0 || p[0] > COLS_REF || p[1] < 0 || p[1] > ROWS_REF) fail(label + ': a shape leaves the grid'); }));
          if (over){
            if (!plan.overlay) fail(label + ': overlay requested but not built');
            else if (rel !== 'none' && !samePolyRef(plan.overlay, plan.A)) fail(label + ': a congruent pair laid on top does not coincide (overlay)');
            else if (rel === 'none'){
              const bo = bboxRef(plan.overlay);
              if (bo.minX !== bA.minX || bo.minY !== bA.minY) fail(label + ': a non-congruent overlay must share the left-bottom corner');
              if (samePolyRef(plan.overlay, plan.A)) fail(label + ': a non-congruent overlay coincides');
            }
          } else if (plan.overlay) fail(label + ': overlay built when not requested');
        });
      });

      /* ---------- 5) 範例 2：搬家任務 ---------- */
      if (data.PUZZLES.map(p => p.id).join() !== 'slide,turn,flip') fail('PUZZLES must be slide/turn/flip');
      if (!eqPoly(data.PUZZLE_SHAPE, SHAPES_REF.L4.pts)) fail('the puzzle shape must be the L shape');
      if (!trivialSymRef(data.PUZZLE_SHAPE)) fail('the puzzle shape has a symmetry');
      if (!data.inGrid(data.PUZZLE_START)) fail('the puzzle start is outside the grid');
      if (data.MOVE_ACTS.join() !== 'left,right,up,down,turn,flip') fail('MOVE_ACTS must be the six buttons');
      function keyOf(P){ return JSON.stringify(P); }
      data.PUZZLES.forEach(function(pz){
        const T = data.puzzleTarget(pz), label = 'PUZZLES[' + pz.id + ']';
        if (!data.inGrid(T)) fail(label + ': the target is unreachable — it pokes out of the grid');
        const rel = relationRef(data.PUZZLE_START, T);
        if ((pz.id === 'slide' ? 'same' : pz.id) !== rel) fail(label + ': the target relation is ' + rel);
        if (data.puzzleSolved(data.PUZZLE_START, T)) fail(label + ': already solved before any move');
        /* BFS：真的走得到，而且不必超過 12 步。 */
        let q = [[data.PUZZLE_START, 0]], seen = new Set([keyOf(data.PUZZLE_START)]), found = -1;
        while (q.length && found < 0){
          const [P, n] = q.shift();
          if (data.puzzleSolved(P, T)){ found = n; break; }
          if (n >= 12) continue;
          data.MOVE_ACTS.forEach(function(act){
            const nx = data.doMove(P, act);
            if (nx === null) return;
            const k = keyOf(nx);
            if (!seen.has(k)){ seen.add(k); q.push([nx, n + 1]); }
          });
        }
        if (found < 0) fail(label + ': unreachable within 12 moves');
        if (found >= 0 && found < 5) fail(label + ': solvable in ' + found + ' moves, too close to see the move');
      });
      /* doMove 是剛體、整數、留在方格紙上；出界回 null。 */
      let states = [data.PUZZLE_START], seenS = new Set([keyOf(data.PUZZLE_START)]), rigidChecked = 0, blocked = 0;
      for (let round = 0; round < 6; round++){
        const next = [];
        states.forEach(function(P){
          data.MOVE_ACTS.forEach(function(act){
            const nx = data.doMove(P, act);
            if (nx === null){ blocked++; return; }
            rigidChecked++;
            if (!intPoly(nx)) fail('doMove(' + act + ') produced non-integer vertices');
            if (!data.inGrid(nx)) fail('doMove(' + act + ') leaves the grid');
            nx.forEach(p => { if (p[0] < 0 || p[0] > COLS_REF || p[1] < 0 || p[1] > ROWS_REF) fail('doMove(' + act + ') leaves the grid (independent bounds)'); });
            if (!congRef(P, nx)) fail('doMove(' + act + ') is not a rigid move');
            const rel = relationRef(P, nx);
            if ((act === 'turn' && rel !== 'turn') || (act === 'flip' && rel !== 'flip') || (['left', 'right', 'up', 'down'].indexOf(act) >= 0 && rel !== 'same'))
              fail('doMove(' + act + ') is a ' + rel + ', not the move the button promises');
            if (data.moveKindOf(act) !== (act === 'turn' ? 'turn' : act === 'flip' ? 'flip' : 'slide')) fail('moveKindOf(' + act + ') is wrong');
            const k = keyOf(nx);
            if (!seenS.has(k)){ seenS.add(k); next.push(nx); }
          });
        });
        states = next;
      }
      if (rigidChecked < 100) fail('too few doMove states checked (' + rigidChecked + ')');
      if (!blocked) fail('doMove never refuses a move that would leave the grid');
      if (data.doMove(data.anchor(data.PUZZLE_SHAPE), 'left') !== null) fail('a slide off the left edge must be refused');
      if (data.doMove(data.anchor(data.PUZZLE_SHAPE), 'down') !== null) fail('a slide off the bottom edge must be refused');
      const bs = bboxRef(data.PUZZLE_SHAPE), corner = anchorRef(data.PUZZLE_SHAPE).map(p => [p[0] + COLS_REF - bs.w, p[1] + ROWS_REF - bs.h]);
      if (data.doMove(corner, 'right') !== null) fail('a slide off the right edge must be refused');
      if (data.doMove(corner, 'up') !== null) fail('a slide off the top edge must be refused');
      if (!data.inGrid(corner)) fail('inGrid() rejects a shape that touches the top-right corner from inside');
      if (data.doMove(data.PUZZLE_START, 'nonsense') !== null) fail('an unknown action must be refused');

      /* ---------- 6) 範例 3：對應 ---------- */
      if (data.LABELS_A.join('') !== 'ABCD' || data.LABELS_B.join('') !== 'EFGH') fail('vertex letters must be A~D and E~H');
      if (data.CORR_SHAPES.length !== 3) fail('example 3 must offer three shapes');
      const kindsSeen = {};
      data.CORR_SHAPES.forEach(function(c, ci){
        const label = 'CORR_SHAPES[' + c.shape + ']';
        if (QUAD_IDS_REF.indexOf(c.shape) < 0) fail(label + ': not a four-vertex shape');
        if (!(c.mat >= 1 && c.mat < 8)) fail(label + ': the right shape must be moved (mat 1~7)');
        const plan = data.corrPlan(ci);
        const rel = relationRef(plan.A, plan.B);
        kindsSeen[rel] = 1;
        if (plan.rel !== rel) fail(label + ': corrPlan.rel disagrees with the reference');
        if (rel === 'same' || rel === 'none') fail(label + ': the two shapes must be a turned or flipped pair, got ' + rel);
        if (!samePolyRef(anchorRef(plan.B), anchorRef(placeRef(anchorRef(plan.A), c.mat)))) fail(label + ': B is not A placed by mat ' + c.mat);
        const orderA = labelOrderRef(plan.A), orderB = labelOrderRef(plan.B);
        if (data.labelOrder(plan.A).join() !== orderA.join() || data.labelOrder(plan.B).join() !== orderB.join()) fail(label + ': labelOrder() disagrees with the reference');
        const polyA = toPxRef(plan.A), polyB = toPxRef(plan.B);
        const allLabels = [];
        plan.verts.forEach(function(v){
          if (v.labelA !== labelOfRef(plan.A, LABELS_A_REF, v.i)) fail(label + ': vertex ' + v.i + ' has the wrong left letter');
          if (v.labelB !== labelOfRef(plan.B, LABELS_B_REF, v.i)) fail(label + ': vertex ' + v.i + ' has the wrong right letter');
          if (!/^[A-D]$/.test(v.labelA) || !/^[E-H]$/.test(v.labelB)) fail(label + ': a label is not a single letter');
          [['a', v.a, plan.A], ['b', v.b, plan.B]].forEach(function(row){
            const q = row[1], P = row[2];
            if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) fail(label + ': vertex ' + v.i + ' pixel (' + row[0] + ') is not a number');
            else if (Math.abs(q.x - pxRef(P[v.i][0])) > 1e-9 || Math.abs(q.y - pyRef(P[v.i][1])) > 1e-9) fail(label + ': vertex ' + v.i + ' pixel (' + row[0] + ') does not match its grid point');
          });
          if (v.rightA !== isRightRef(plan.A, v.i) || v.rightB !== isRightRef(plan.B, v.i)) fail(label + ': right-angle flag is wrong at ' + v.i);
          if (v.rightA !== v.rightB) fail(label + ': a right angle must match a right angle');
          if (!v.sameAngle || !sameAngleRef(plan.A, v.i, plan.B, v.i)) fail(label + ': matching angles differ at vertex ' + v.i);
          [['A', v.labelPosA, polyA, v.labelA], ['B', v.labelPosB, polyB, v.labelB]].forEach(function(row){
            const lp = row[1], poly = row[2];
            if (!inCanvas(lp, FIG_W_REF, FIG_H_REF, MARGIN_REF)) fail(label + ': label ' + row[3] + ' is outside the canvas');
            if (Math.abs(Math.hypot(lp.x - (row[0] === 'A' ? v.a.x : v.b.x), lp.y - (row[0] === 'A' ? v.a.y : v.b.y)) - LABEL_R_REF) > 1e-6) fail(label + ': label ' + row[3] + ' is not LABEL_R from its own vertex');
            if (pointInPoly(lp, poly)) fail(label + ': label ' + row[3] + ' is inside polygon ' + row[0]);
            if (minEdgeDist(lp, poly) < LABEL_EDGE_REF) fail(label + ': label ' + row[3] + ' sits on an edge');
            allLabels.push({ t:row[3], x:lp.x, y:lp.y });
          });
          /* 角的記號：直角是正方形、腿沿著邊、第三點在圖形裡；弧的中點在圖形裡、大弧只給凹角。 */
          [['A', v.markA, plan.A, polyA], ['B', v.markB, plan.B, polyB]].forEach(function(row){
            const mk = row[1], P = row[2], poly = row[3], vx = pxRef(P[v.i][0]), vy = pyRef(P[v.i][1]);
            if (!mk) { fail(label + ': vertex ' + v.i + ' has no mark on ' + row[0]); return; }
            if ((mk.kind === 'right') !== isRightRef(P, v.i)) fail(label + ': mark kind disagrees with the angle at ' + v.i);
            if (Math.abs(mk.v.x - vx) > 1e-9 || Math.abs(mk.v.y - vy) > 1e-9) fail(label + ': mark is not at the vertex');
            if (mk.kind === 'right'){
              const d1 = { x:mk.p1.x - vx, y:mk.p1.y - vy }, d2 = { x:mk.p2.x - vx, y:mk.p2.y - vy };
              if (Math.abs(d1.x * d2.x + d1.y * d2.y) > 1e-6) fail(label + ': right-angle mark is not square at ' + v.i);
              if (Math.abs(Math.hypot(d1.x, d1.y) - data.MARK_LEN) > 1e-6 || Math.abs(Math.hypot(d2.x, d2.y) - data.MARK_LEN) > 1e-6) fail(label + ': right-angle mark legs are not MARK_LEN');
              if (Math.abs(mk.p3.x - (mk.p1.x + mk.p2.x - vx)) > 1e-9 || Math.abs(mk.p3.y - (mk.p1.y + mk.p2.y - vy)) > 1e-9) fail(label + ': right-angle mark is not a parallelogram closing at p3');
              if (!pointInPoly(mk.p3, poly)) fail(label + ': right-angle mark sits outside the shape at ' + v.i);
              /* 兩條腿要沿著兩條邊走。 */
              const n = P.length, prev = P[(v.i + n - 1) % n], next = P[(v.i + 1) % n];
              const along = function(d, q){ const ex = pxRef(q[0]) - vx, ey = pyRef(q[1]) - vy; return Math.abs(d.x * ey - d.y * ex) < 1e-6 && d.x * ex + d.y * ey > 0; };
              if (!((along(d1, prev) && along(d2, next)) || (along(d1, next) && along(d2, prev)))) fail(label + ': right-angle mark legs do not run along the sides at ' + v.i);
            } else {
              if (Math.abs(Math.hypot(mk.a1.x - vx, mk.a1.y - vy) - data.ARC_R) > 1e-6 || Math.abs(Math.hypot(mk.a2.x - vx, mk.a2.y - vy) - data.ARC_R) > 1e-6) fail(label + ': arc ends are not ARC_R from the vertex');
              if (!pointInPoly(mk.mid, poly)) fail(label + ': the angle arc is drawn outside the shape at ' + v.i);
              if (mk.large !== (isReflexRef(P, v.i) ? 1 : 0)) fail(label + ': large-arc flag must be 1 exactly for a reflex corner (' + v.i + ')');
              if (mk.reflex !== isReflexRef(P, v.i)) fail(label + ': reflex flag is wrong at ' + v.i);
              const m = /^M (-?[\d.]+) (-?[\d.]+) A ([\d.]+) ([\d.]+) 0 ([01]) ([01]) (-?[\d.]+) (-?[\d.]+)$/.exec(mk.d);
              if (!m) fail(label + ': arc path unreadable: ' + mk.d);
              else if (Number(m[5]) !== mk.large || Number(m[6]) !== mk.sweep) fail(label + ': arc path flags disagree with the mark');
            }
          });
        });
        for (let i = 0; i < allLabels.length; i++) for (let j = i + 1; j < allLabels.length; j++)
          if (Math.abs(allLabels[i].x - allLabels[j].x) < LABEL_BOX_W_REF && Math.abs(allLabels[i].y - allLabels[j].y) < LABEL_BOX_H_REF) fail(label + ': labels ' + allLabels[i].t + ' and ' + allLabels[j].t + ' overlap');
        plan.edges.forEach(function(e){
          if (e.nameA !== edgeNameRef(plan.A, LABELS_A_REF, e.i, e.j)) fail(label + ': edge ' + e.i + ' left name is wrong');
          if (e.nameB !== edgeNameRef(plan.B, LABELS_B_REF, e.i, e.j)) fail(label + ': edge ' + e.i + ' right name is wrong');
          if (e.lenA !== edgeLenRef(plan.A, e.i, e.j) || e.lenB !== edgeLenRef(plan.B, e.i, e.j)) fail(label + ': edge length is wrong');
          if (e.lenA !== e.lenB || e.sqA !== e.sqB) fail(label + ': matching sides differ in length');
        });
        const bA = bboxRef(plan.A), bB = bboxRef(plan.B);
        if (bB.minX - bA.maxX < 2) fail(label + ': the two shapes are too close');
        [plan.A, plan.B].forEach(P => P.forEach(p => { if (p[0] < 0 || p[0] > COLS_REF || p[1] < 0 || p[1] > ROWS_REF) fail(label + ': a shape leaves the grid'); }));
        plan.verts.forEach(function(v){
          const es = data.edgesAt(plan, v.i);
          if (es.length !== 2) fail(label + ': edgesAt() must return two sides at ' + v.i);
        });
      });
      if (!kindsSeen.turn || !kindsSeen.flip) fail('example 3 must include both a turned pair and a flipped pair');
      /* labelOrder：字母真的從最上面那一個頂點開始、順時針。 */
      [SHAPES_REF.TRAP.pts, SHAPES_REF.Q2.pts, SHAPES_REF.DART.pts].forEach(function(P){
        for (let i = 0; i < 8; i++){
          const Q = anchorRef(placeRef(P, i));
          const o = data.labelOrder(Q);
          if (o.join() !== labelOrderRef(Q).join()) fail('labelOrder() disagrees with the reference on a placed shape');
          const top = Q[o[0]];
          Q.forEach(p => { if (p[1] > top[1] || (p[1] === top[1] && p[0] < top[0])) fail('labelOrder() does not start at the top-left vertex'); });
          /* 順時針：從第一個字母走到第二個再到第三個，畫面上是右轉（有號面積為負）。 */
          const tri = [Q[o[0]], Q[o[1]], Q[o[2]]];
          if (area2Ref(tri) > 0 && !isReflexRef(Q, o[1])) fail('labelOrder() runs anticlockwise');
        }
      });

      /* ---------- 7) 範例 4：面積一樣 ---------- */
      if (data.S4_CASES.map(c => c.id).join() !== 'areaOnly,turnRect,areaL,perimOnly') fail('S4_CASES must be areaOnly/turnRect/areaL/perimOnly');
      data.S4_CASES.forEach(function(c){
        const label = 'S4_CASES[' + c.id + ']', plan = data.pairPlan(c.A, c.B, true);
        const areaEq = areaRef(c.A) === areaRef(c.B), pA = perimRef(c.A), pB = perimRef(c.B), cong = congRef(c.A, c.B);
        if (plan.areaEq !== areaEq || plan.perimEq !== (pA !== null && pA === pB) || plan.congruent !== cong) fail(label + ': the computed facts disagree with the reference');
        if (c.id === 'areaOnly' && !(areaEq && !cong && pA !== pB)) fail(label + ': must have equal areas, different perimeters and not be congruent');
        if (c.id === 'turnRect' && !(cong && relationRef(c.A, c.B) === 'turn')) fail(label + ': must be a turned congruent pair');
        if (c.id === 'areaL' && !(areaEq && !cong)) fail(label + ': must have equal areas and not be congruent');
        if (c.id === 'perimOnly' && !(pA === pB && !areaEq && !cong)) fail(label + ': must have equal perimeters, different areas and not be congruent');
        if (cong && !samePolyRef(plan.overlay, plan.A)) fail(label + ': the congruent pair laid on top does not coincide');
        if (!cong && samePolyRef(plan.overlay, plan.A)) fail(label + ': a non-congruent pair coincides when laid on top');
        const dA = data.shapeDesc(c.A), dB = data.shapeDesc(c.B);
        [[c.A, dA], [c.B, dB]].forEach(function(row){
          const P = row[0], d = row[1], b = bboxRef(P);
          const isRect = P.length === 4 && axisRef(P) && areaRef(P) === b.w * b.h;
          if ((d.kind === 'rect') !== isRect) fail(label + ': shapeDesc() misjudges a rectangle');
          if (isRect && (d.w !== b.w || d.h !== b.h)) fail(label + ': shapeDesc() reports the wrong sides');
        });
      });

      /* ---------- 8) 試題裡的圖 ---------- */
      if (relationRef(data.QUIZ_FIGS.q2.A, data.QUIZ_FIGS.q2.B) !== 'turn') fail('QUIZ_FIGS.q2 must be a turned pair');
      if (relationRef(data.QUIZ_FIGS.q4.A, data.QUIZ_FIGS.q4.B) !== 'none' || scaleFactorRef(data.QUIZ_FIGS.q4.A, data.QUIZ_FIGS.q4.B) !== SCALE_K_REF) fail('QUIZ_FIGS.q4 must be an enlarged copy, not a congruent one');
      Object.keys(data.QUIZ_FIGS).forEach(function(k){
        const f = data.QUIZ_FIGS[k], plan = data.pairPlan(f.A, f.B, false);
        [plan.A, plan.B].forEach(P => P.forEach(p => { if (p[0] < 0 || p[0] > COLS_REF || p[1] < 0 || p[1] > ROWS_REF) fail('QUIZ_FIGS.' + k + ' leaves the grid'); }));
      });
      ['zh', 'en'].forEach(function(lang){
        if (I18N[lang].qs[1].fig !== 'q2') fail('qs[1] (' + lang + ') must show QUIZ_FIGS.q2');
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

      /* ---------- 10) 遊戲 ---------- */
      if (data.ROUNDS.length !== 5) fail('the game has five job sheets');
      const kinds = {};
      data.ROUNDS.forEach(function(r, i){
        kinds[r.kind] = (kinds[r.kind] || 0) + 1;
        const label = 'ROUNDS[' + i + ']', opts = data.roundOptions(r), ans = data.roundAnswer(r);
        if (ans < 0 || ans >= opts.length) fail(label + ': roundAnswer() found no unique answer');
        if (opts.length !== 4) fail(label + ': needs four options');
        if (r.kind === 'which'){
          const T = SHAPES_REF[r.target] ? SHAPES_REF[r.target].pts : null;
          if (!T) { fail(label + ': unknown target shape'); return; }
          const ansRef = whichAnsRef(T, r.cands);
          if (ansRef < 0) fail(label + ': not exactly one candidate is congruent to the target');
          if (ans !== ansRef) fail(label + ': roundAnswer() disagrees with the reference');
          if (ansRef >= 0 && relationRef(T, r.cands[ansRef]) === 'same') fail(label + ': the congruent candidate is an unmoved copy, so the round is trivial');
          r.cands.forEach(function(C, k){
            const cp = data.candidatePlan(C);
            if (!cp.fits) fail(label + ': candidate ' + k + ' does not fit the mini canvas');
            cp.pts.forEach(p => { if (p.x < 0 || p.x > cp.w || p.y < 0 || p.y > cp.h) fail(label + ': candidate ' + k + ' is drawn outside the mini canvas'); });
            if (!intPoly(C)) fail(label + ': candidate ' + k + ' has non-integer vertices');
            for (let j = k + 1; j < r.cands.length; j++) if (congRef(C, r.cands[j])) fail(label + ': candidates ' + k + ' and ' + j + ' are congruent to each other');
          });
          const centre = data.centrePlan(T);
          centre.forEach(p => { if (p[0] < 0 || p[0] > COLS_REF || p[1] < 0 || p[1] > ROWS_REF) fail(label + ': the target leaves the grid'); });
          if (!samePolyRef(anchorRef(centre), anchorRef(T))) fail(label + ': centrePlan() changes the target');
        }
        if (r.kind === 'moveName'){
          const S = SHAPES_REF[r.shape] ? SHAPES_REF[r.shape].pts : null;
          if (!S) { fail(label + ': unknown shape'); return; }
          const rel = relationRef(S, placeRef(S, r.mat));
          if (rel === 'same') fail(label + ': the moved copy is unmoved');
          if (opts.join() !== MOVE_KEYS_REF.join()) fail(label + ': options must be the four moves');
          if (opts[ans] !== rel) fail(label + ': the answer is not the move actually used (' + rel + ')');
          if (!trivialSymRef(S)) fail(label + ': the shape has a symmetry');
        }
        if (r.kind === 'corrSide'){
          const plan = data.corrPlan(r.ci), e = plan.edges[r.edge];
          if (!e) { fail(label + ': edge index out of range'); return; }
          const lay = corrLayoutRef(plan.id, plan.mat);
          const order = labelOrderRef(plan.B), want = [];
          for (let k = 0; k < 4; k++) want.push(edgeNameRef(plan.B, LABELS_B_REF, order[k], order[(k + 1) % 4]));
          if (opts.join() !== want.join()) fail(label + ': options are not the four sides of the right shape in letter order');
          if (opts[ans] !== edgeNameRef(plan.B, LABELS_B_REF, e.i, e.j)) fail(label + ': the answer is not the matching side');
          if (!lay) fail(label + ': no layout');
        }
        if (r.kind === 'rectPair' || r.kind === 'moveName'){
          const pr = r.kind === 'rectPair' ? [r.A, r.B] : [SHAPES_REF[r.shape].pts, placeRef(SHAPES_REF[r.shape].pts, r.mat)];
          /* 兩個圖形中間至少空兩格，不然畫面上會黏成一個圖形（第一版 6 × 4 和 8 × 3 就黏在一起）。 */
          if (data.pairPlan(pr[0], pr[1], false).gap < 2) fail(label + ': the two shapes are less than two squares apart');
        }
        if (r.kind === 'rectPair'){
          const areaEq = areaRef(r.A) === areaRef(r.B), cong = congRef(r.A, r.B);
          if (!areaEq) fail(label + ': the two rectangles must have the same area, or the customer’s claim is not tempting');
          if (cong) fail(label + ': the two rectangles must not be congruent');
          if (opts.join() !== RECT_KEYS_REF.join()) fail(label + ': options must be the four statements');
          if (opts[ans] !== 'areaSameNotCong') fail(label + ': the true statement is "same area, not congruent"');
        }
      });
      if (!(kinds.which >= 1 && kinds.moveName && kinds.corrSide && kinds.rectPair)) fail('the game must cover which/moveName/corrSide/rectPair');
      ['zh', 'en'].forEach(function(lang){
        const d = I18N[lang];
        [d.gCapWhich, d.gCapPair, d.gCapCorr].forEach(function(cap, i){
          if (/\d/.test(String(cap))) fail('game figure caption ' + i + ' (' + lang + ') contains a digit: ' + cap);
          if (/翻|轉|平移|放大|flip|turn|slide|enlarg/i.test(String(cap))) fail('game figure caption ' + i + ' (' + lang + ') names a move');
        });
        ['which', 'moveName', 'corrSide', 'rectPair'].forEach(function(k){
          if (typeof d.gHint1[k] !== 'string') fail('gHint1.' + k + ' missing in ' + lang);
          if (k === 'which' ? typeof d.gHint2[k] !== 'string' : typeof d.gHint2[k] !== 'function') fail('gHint2.' + k + ' has the wrong shape in ' + lang);
        });
        MOVE_KEYS_REF.forEach(k => { if (typeof d.moveName[k] !== 'string') fail('moveName.' + k + ' missing in ' + lang); });
        RECT_KEYS_REF.forEach(k => { if (typeof d.rectStatement[k] !== 'string') fail('rectStatement.' + k + ' missing in ' + lang); });
      });

      /* ---------- 11) 旁白：真的渲染出來再掃 ---------- */
      const narrated = [];
      ['zh', 'en'].forEach(function(lang){
        const d = I18N[lang];
        data.S1_CASES.forEach(function(c){
          const plan = data.pairPlan(c.A, c.B, true);
          narrated.push([lang, 's1narr', d.s1narr(plan.rel, plan.scaleK, plan.cellsA, plan.cellsB)]);
          narrated.push([lang, 's1calc', d.s1calc(plan.cellsA, plan.cellsB)]);
          const zhCalc = '橘色 ' + plan.cellsA + ' 格　·　藍色 ' + plan.cellsB + ' 格';
          if (lang === 'zh' && d.s1calc(plan.cellsA, plan.cellsB) !== zhCalc) fail('example 1 calc line must read "' + zhCalc + '"');
          const narr = d.s1narr(plan.rel, plan.scaleK, plan.cellsA, plan.cellsB);
          const saysNot = lang === 'zh' ? /不全等/.test(narr) : /not congruent/i.test(narr);
          if (saysNot === plan.congruent) fail('example 1 narration (' + lang + ', ' + c.id + ') contradicts the computed relation');
          if (plan.scaleK && narr.indexOf(String(plan.scaleK)) < 0) fail('example 1 narration (' + lang + ', scale) must state the enlargement factor');
          if (c.id === 'flip' && !(lang === 'zh' ? /鏡子/.test(narr) : /mirror/.test(narr))) fail('the flipped case must mention the mirror');
        });
        [[1, 1, 0, 0], [7, 5, 1, 1], [12, 10, 1, 1], [0, 0, 0, 0]].forEach(function(row){
          narrated.push([lang, 's2narrSolved', d.s2narrSolved(row[0], row[1], row[2], row[3])]);
          narrated.push([lang, 's2calc', d.s2calc(row[0])]);
        });
        ['slide', 'turn', 'flip'].forEach(k => narrated.push([lang, 's2narrMove', d.s2narrMove(d.moveShort[k])]));
        data.CORR_SHAPES.forEach(function(c, ci){
          const plan = data.corrPlan(ci);
          narrated.push([lang, 's3cap', d.s3cap(plan.rel)]);
          plan.verts.forEach(function(v){
            const es = data.edgesAt(plan, v.i);
            const e1 = d.edgePair(es[0].nameA, es[0].nameB, es[0].lenA), e2 = d.edgePair(es[1].nameA, es[1].nameB, es[1].lenA);
            narrated.push([lang, 's3narr', d.s3narr(v.labelA, v.labelB, e1, e2, v.rightA && v.rightB)]);
            narrated.push([lang, 's3calc', d.s3calc(e1, e2)]);
            narrated.push([lang, 's3result', d.s3result(v.labelA, v.labelB)]);
            const s = d.s3narr(v.labelA, v.labelB, e1, e2, v.rightA && v.rightB);
            if (s.indexOf(v.labelA) < 0 || s.indexOf(v.labelB) < 0) fail('example 3 narration must name both letters');
            if (!(lang === 'zh' ? /對應角一樣大/.test(s) && /對應邊一樣長/.test(s) : /matching angles are the same size/.test(s) && /matching sides are the same length/.test(s)))
              fail('example 3 narration (s3narr, ' + lang + ') must state that matching sides are the same length and matching angles the same size');
            if (v.rightA && !(lang === 'zh' ? /直角/.test(s) : /right angle/.test(s))) fail('example 3 narration must say right angle at a right angle');
            if (!v.rightA && (lang === 'zh' ? /直角/.test(s) : /right angle/.test(s))) fail('example 3 narration must not say right angle at a non-right angle');
            es.forEach(function(e){
              const t = d.edgePair(e.nameA, e.nameB, e.lenA);
              if (e.lenA !== null && t.indexOf(String(e.lenA)) < 0) fail('edgePair must print the side length');
              if (e.lenA === null && /\d/.test(t)) fail('edgePair must not invent a length for a slanted side');
            });
          });
        });
        data.S4_CASES.forEach(function(c){
          const plan = data.pairPlan(c.A, c.B, true);
          narrated.push([lang, 's4narrGuess', d.s4narrGuess(plan.cellsA, plan.cellsB, plan.perimA, plan.perimB)]);
          narrated.push([lang, 's4narr', d.s4narr(plan.congruent, plan.areaEq, plan.perimEq)]);
          narrated.push([lang, 's4calc', d.s4calc(data.shapeDesc(c.A), data.shapeDesc(c.B), plan.perimA, plan.perimB)]);
          narrated.push([lang, 's4chip', d.s4chip(d.rectShort(6, 2), d.otherShort)]);
          const narr = d.s4narr(plan.congruent, plan.areaEq, plan.perimEq);
          const saysNot = lang === 'zh' ? /不全等/.test(narr) : /not congruent/i.test(narr);
          if (saysNot === plan.congruent) fail('example 4 narration (' + lang + ', ' + c.id + ') contradicts the computed relation');
          if (plan.congruent && /面積一樣|because the areas|因為面積/.test(narr)) fail('example 4 must never justify congruence by area');
          if (c.id === 'areaOnly' && !(lang === 'zh' ? /面積一樣，可是不全等/.test(narr) : /same area, yet not congruent/.test(narr))) fail('the same-area case must say so');
          if (c.id === 'perimOnly' && !(lang === 'zh' ? /周長一樣也不保證全等/.test(narr) : /same perimeter does not guarantee/.test(narr))) fail('the same-perimeter case must say so');
        });
        data.ROUNDS.forEach(function(r){
          if (r.kind === 'which'){ narrated.push([lang, 'gPrompt', d.gPrompt.which]); narrated.push([lang, 'gHint2', d.gHint2.which]); }
          else if (r.kind === 'moveName'){ narrated.push([lang, 'gPrompt', d.gPrompt.moveName]); narrated.push([lang, 'gHint2', d.gHint2.moveName(d.moveShort.flip)]); }
          else if (r.kind === 'corrSide'){ const plan = data.corrPlan(r.ci), e = plan.edges[r.edge]; narrated.push([lang, 'gPrompt', d.gPrompt.corrSide(e.nameA)]); narrated.push([lang, 'gHint2', d.gHint2.corrSide(plan.verts[e.i].labelA, plan.verts[e.i].labelB, e.nameB)]); }
          else { const a = bboxRef(r.A), b = bboxRef(r.B); narrated.push([lang, 'gPrompt', d.gPrompt.rectPair(a.w, a.h, b.w, b.h)]); narrated.push([lang, 'gHint2', d.gHint2.rectPair(areaRef(r.A))]); }
        });
        narrated.push([lang, 'gWrong0', d.gWrong(0)]);
        narrated.push([lang, 'gWrong5', d.gWrong(5)]);
        narrated.push([lang, 'gWin', d.gWin(100)]);
        narrated.push([lang, 'caseName', d.caseName(1)]);
        narrated.push([lang, 'taskName', d.taskName(3)]);
        narrated.push([lang, 'vertChip', d.vertChip('A')]);
        narrated.push([lang, 'cellsText1', d.cellsText(1)]);
        narrated.push([lang, 'cellsText5', d.cellsText(5)]);
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
      const clean = {};
      ['index', 'reference', 'review', 'parents'].forEach(function(name){
        if (sib[name] === null){ fail('cannot read ' + name + '.html'); return; }
        clean[name] = stripComments(sib[name]);
      });
      /* ⚠️ 只看**字典那一段**（zh 或 en）：看整個檔案的話，markup 裡的 fallback 副本會替字典裡
         被刪掉的那一句背書（改壞測試抓到）。字典讀不懂就 fail-closed。 */
      PAIRED_RULES.forEach(function(pair){
        const isZh = /[一-鿿]/.test(pair.rule);
        pair.pages.forEach(function(name){
          if (clean[name] === undefined) return;
          let region = null;
          if (isZh) region = zhRegion(clean[name]);
          else region = enRegion(clean[name]);
          if (region === null){ fail('PAIRED: cannot find the dictionary in ' + name + '.html — unchecked, not passing'); return; }
          if (region.indexOf(pair.rule) >= 0 && region.indexOf(pair.qualifier) < 0) fail('PAIRED: ' + name + '.html states "' + pair.rule + '" without "' + pair.qualifier + '"');
        });
      });
      HANDOFF_RULES.forEach(function(h){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (clean[name] === undefined) return;
          const hay = clean[name];
          let i = 0;
          for (;;){
            const k = hay.toLowerCase().indexOf(h.word.toLowerCase(), i);
            if (k < 0) break;
            /* ⚠️ 窗口要**貼著那個詞**（前後各幾十個字），不可以用整句：同一句的後半剛好有一個
               不相干的「國中」就會替前半那個越界的詞背書（改壞測試抓到）。 */
            const win = hay.slice(Math.max(0, k - h.span), k + h.word.length + h.span).toLowerCase();
            if (!h.near.some(w => win.indexOf(w.toLowerCase()) >= 0))
              fail('HANDOFF: ' + name + '.html mentions "' + h.word + '" without "' + h.near.join('/') + '" nearby — this lesson only ever hands that topic on');
            i = k + h.word.length;
          }
        });
      });
      SIBLING_RULES.concat(SIBLING_RULES_EN).forEach(function(rule){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (clean[name] === undefined) return;
          const n = countOf(clean[name], rule.text), want = rule.files[name] || 0;
          if (n !== want) fail('SIBLING: "' + rule.text + '" appears ' + n + ' time(s) in ' + name + '.html, expected exactly ' + want);
        });
      });
      /* ⚠️ 同時看**去掉標籤**的文字：`a flipped shape is <strong>not congruent</strong>` 在原始碼裡
         比不到，讀者看到的卻是整句（codex 抓到）。 */
      FORBIDDEN.forEach(function(bad){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (clean[name] === undefined) return;
          const plain = clean[name].replace(/<\/?[A-Za-z][^>]*>/g, '').replace(/&nbsp;/g, ' ').toLowerCase();
          if (clean[name].indexOf(bad) >= 0 || plain.indexOf(bad.toLowerCase()) >= 0) fail('FORBIDDEN: ' + name + '.html says "' + bad + '", which is not true');
        });
      });
      /* 交給別的年級的詞，每一頁出現幾次也釘死：多出一次就是有人在別處又講了一遍。 */
      HANDOFF_COUNTS.forEach(function(rule){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (clean[name] === undefined) return;
          const n = countOf(clean[name].toLowerCase(), rule.word.toLowerCase()), want = rule.files[name] || 0;
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
        if (clean[name].indexOf('<text') >= 0) fail(name + '.html must not put a <text> in the markup — letters come from svgEl only');
        const tags = [...clean[name].matchAll(/svgEl\s*\(\s*['"]([a-zA-Z]+)['"]/g)].map(m => m[1].toLowerCase());
        const allowed = ['line', 'path', 'circle', 'text', 'svg'];
        [...new Set(tags)].forEach(function(t){
          if (allowed.indexOf(t) < 0) fail(name + '.html creates an SVG <' + t + '>, which this lesson does not use');
        });
        if (!tags.length) fail(name + '.html draws nothing through svgEl()');
        const calls = (clean[name].match(/(?<!function\s)svgEl\s*\(/g) || []).length;
        if (calls !== tags.length) fail(name + '.html has ' + calls + ' svgEl() calls but only ' + tags.length + ' literal tag names');
        scannerSafe(sib[name]).forEach(w => fail(name + '.html contains ' + w + ' — the comment scanner cannot be trusted on it'));
        const direct = [...clean[name].matchAll(/createElementNS\s*\(\s*[^,]+,\s*['"]([a-zA-Z]+)['"]/g)].map(m => m[1].toLowerCase());
        [...new Set(direct)].forEach(function(t){ if (t !== 'svg') fail(name + '.html calls createElementNS for <' + t + '> directly, bypassing svgEl()'); });
        /* 字母只能透過 textContent ＝ 一個字母的變數放進 <text>：不可以有第二條路。 */
        const textUses = (clean[name].match(/svgEl\s*\(\s*['"]text['"]/g) || []).length;
        if (textUses !== 1) fail(name + '.html must create SVG text in exactly one place (drawLabel), found ' + textUses);
        /* 那一個 <text> 的內容只能是頂點的字母：課程頁只准 drawLabel(svg, v.labelPosX, v.labelX, …) 兩種呼叫，
           複習頁只准 t.textContent = lb.t（而 lb.t 由 renderCheck 驗過是單一個字母）。 */
        if (name === 'index'){
          const calls = clean[name].match(/drawLabel\s*\(/g) || [];
          if (calls.length !== 3) fail('index.html must call/define drawLabel exactly three times (one definition, two calls), found ' + calls.length);
          if (clean[name].indexOf('drawLabel(svg, v.labelPosA, v.labelA,') < 0 || clean[name].indexOf('drawLabel(svg, v.labelPosB, v.labelB,') < 0)
            fail('index.html must draw letters only from v.labelA / v.labelB');
          if ((clean[name].match(/\.textContent = letter;/g) || []).length !== 1) fail('index.html: the SVG text content must be assigned from the letter argument exactly once');
        } else {
          if ((clean[name].match(/t\.textContent = lb\.t;/g) || []).length !== 1) fail('review.html: the SVG text content must be assigned from lb.t exactly once');
        }
        /* 原始碼裡（markup 或字串）不可以出現允許清單以外的 SVG 元素，也不可以用 innerHTML 塞 SVG。 */
        /* 原始碼裡（markup 或字串）不可以出現允許清單以外的 SVG 元素（大小寫不分、換行也算），
           也不可以對 SVG 容器用 innerHTML，或用任何字串／文字節點的變更 API（那些路徑檢查跟不到）。 */
        const rawSvg = clean[name].match(/<\/?(?:rect|polygon|polyline|ellipse|image|use|foreignobject|g|line|path|circle|text|tspan)(?=[\s>\/])/gi);
        if (rawSvg) fail(name + '.html contains raw SVG markup ' + [...new Set(rawSvg.map(t => t.toLowerCase()))].join(' ') + ', which bypasses the drawing functions');
        if (/\b(?:svg|\w*fig|\w*Fig)\s*\.\s*innerHTML\s*\+?=/i.test(clean[name]) || /innerHTML\s*\+?=\s*[^;]*<\s*(?:svg|path|line|circle|text|rect|polygon)\b/i.test(clean[name]))
          fail(name + '.html builds SVG through innerHTML');
        /* ⚠️ 這兩條是**字面掃描**，不是資料流分析：`canvas.innerHTML = markup`（變數裡藏 SVG）或
           `node.data = …` 這種寫法它跟不到。真正守住圖的是上面的幾何斷言、瀏覽器 sweep 與接觸表截圖；
           這裡只擋「順手寫出來就會被看到」的那幾種寫法。要更緊就得換成真的 JS parser（codex 第五輪）。 */
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
      if (src.indexOf("JSON.stringify({p:'grade-4/math/congruent/'") < 0) fail('teachme-last must record this lesson’s own path');
    }
  }
};
