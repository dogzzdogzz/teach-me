/* grade-4/math/angle-shape —— 拼角工作坊（三角板拼角與圖形裡的角）
 *
 * 這一課的正確性有三塊，所以這份設定裡有三套**獨立重寫**的實作：
 *
 * 1) 三角板做得出哪些角。課程頁從 PIECES 的 base 算出角度清單，再用「拼／疊」
 *    窮舉出可做的集合；這裡的參考實作**把兩片的三個角寫死成第二份表**
 *    （PIECE_REF），並且把「180° 以內做得出來的角」也寫死成第二份答案
 *    （TWO_PIECE_REF ＝ 15 的倍數但少了 165）。兩邊比對之外還要求**每一個成員
 *    都找得到見證**（獨立的窮舉搜尋），而 165° 找不到見證 —— 這樣「反過來不成立」
 *    那句話就不是文案，是被證明過的。
 *
 * 2) 圖上每一個角真的畫成幾度。課程頁用 tan／cos／sin 從角度算座標，再用
 *    arcSpan（兩條邊的方向差）決定弧線；參考實作走**另一條路**：
 *    拿畫布上的三個點用**餘弦定理**把角度算回來，和宣稱的度數比。
 *    弧線與扇形則是**解析 path 字串**（wedgePath／arcPath 吐出來的那一串）
 *    再用 atan2 把起訖角讀回來 —— 驗的是「頁面真的畫成什麼」。
 *
 * 3) 版面。課程頁的 centreFit 從**數學座標的 bbox** 置中；參考實作從**畫布上
 *    每一個畫出來的點**重新算 bbox，要求四個邊都留得下 MARGIN_REF。
 *
 * ⚠️ 這一課教的規則有前提，設定檔必須分開驗：
 *    - 「拼是相加」的前提是**共用一條邊而且不重疊**；「疊是相減」看的是**露出來**
 *      那一塊。兩句話都必須出現在四頁上（SIBLING_RULES），而且
 *      「一定是 15 的倍數」旁邊一定要有「反過來不成立」那一句（PAIRED_RULES）。
 *    - **內角和一個字都不可以教**：'內角和' 每一次出現都必須在「交給五年級」的
 *      句子裡（HANDOFF_RULES），'對頂角' 每一次出現都必須在「國中」旁邊。
 * ⚠️ 圖上**一個字都沒有**（只有 line／path／circle），所以整課碰不到
 *    「SVG 的字被畫布裁掉」那一類缺陷 —— 設定檔另外擋住任何人把 <text> 加回來。
 * ⚠️ 角度一律是**整數的度數**，1 ~ 180；「最少要幾片」的答案是 1 ~ 4。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const RIGHT_REF = 90, STRAIGHT_REF = 180, STEP_REF = 15;
const DEG_MIN_REF = 1, DEG_MAX_REF = 180;
const PIECE_MIN_REF = 1, PIECE_MAX_REF = 4;
/* 兩片三角板的三個角（由小到大）。這是第二份表 —— 課程頁是從 base 算出來的。 */
const PIECE_REF = [[30, 60, 90], [45, 45, 90]];
const ANGLE_SET_REF = [30, 45, 60, 90];
/* 兩片（含只用一片）做得出來的角，180° 以內。手算的第二份答案：
   15 的倍數 15~150 全部做得出來，165° 做不出來，180° 是 90 ＋ 90。 */
const TWO_PIECE_REF = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 180];
const NEEDS_THREE_REF = [165];
const EPS = 1e-6;
const MARGIN_REF = 8;          // 每一張圖四個邊至少要留這麼多
/* 驗算器在 data.check 跑完之後應該驗過的算式條數，以及那一組算式本身的指紋。
   兩個都要釘 —— 見下面 5) 的說明。裝上去的時候用實測值填。 */
const VERIFIED_REF = 444;
const FINGERPRINT_REF = '46e283cd1555a21c67cf516eb03af492835b92da';
const CANVAS_W_REF = 460, CANVAS_H_REF = 300;

function sortNum(a){ return a.slice().sort(function(x, y){ return x - y; }); }
function eqArr(a, b){ return JSON.stringify(a) === JSON.stringify(b); }
function isDeg(v){
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) &&
         v >= DEG_MIN_REF && v <= DEG_MAX_REF;
}
function gcdRef(a, b){ return b ? gcdRef(b, a % b) : a; }

/* 一個目標角度的所有做法 —— 獨立的窮舉搜尋（見證）。
   ⚠️⚠️ **一片出一個角**：拼或疊的兩個角一定分別來自不同的那一片。
   同一片上的兩個角沒辦法同時擺成兩個角，所以「60 ＝ 30 ＋ 30」不是見證。
   （第一版把四個角攤平成一個集合，於是把做不出來的做法端到孩子面前。）
   只用一片的角本身也算一種做法（'one'）。 */
const A_SET_REF = [...new Set(PIECE_REF[0])].sort((x, y) => x - y);
const B_SET_REF = [...new Set(PIECE_REF[1])].sort((x, y) => x - y);
function witnessRef(x){
  const out = [];
  if (ANGLE_SET_REF.indexOf(x) >= 0) out.push('one:' + x);
  A_SET_REF.forEach(function(a){
    B_SET_REF.forEach(function(b){
      if (a + b === x && x <= STRAIGHT_REF) out.push('join:' + a + '+' + b);
      if (Math.abs(a - b) === x && x > 0) out.push('lay:' + Math.max(a, b) + '-' + Math.min(a, b));
    });
  });
  return out;
}
/* 一副三角板做得出來的角，**由 PIECE_REF 推導**出來（不是抄一份答案）。
   TWO_PIECE_REF 是手算的第二份答案，兩邊必須一致 —— 那才叫「證明」而不是「宣告」。 */
function derivedSetRef(){
  const out = new Set();
  for (let x = 1; x <= DEG_MAX_REF; x++) if (witnessRef(x).length > 0) out.add(x);
  return [...out].sort((p, q) => p - q);
}
/* 15 的倍數裡做不出來的那些 —— 同樣是推導出來的集合差。 */
function derivedGapsRef(){
  const made = new Set(derivedSetRef());
  const out = [];
  for (let x = STEP_REF; x <= STRAIGHT_REF; x += STEP_REF) if (!made.has(x)) out.push(x);
  return out;
}
/* 最少要接幾個角：1 個（直接用）、2 個（一片出一個）、3 個（一步一步接，
   所以同一片可以再用一次）。 */
function minPiecesRef(x){
  if (ANGLE_SET_REF.indexOf(x) >= 0) return 1;
  if (witnessRef(x).length > 0) return 2;
  for (const a of ANGLE_SET_REF)
    for (const b of ANGLE_SET_REF)
      for (const c of ANGLE_SET_REF)
        if (a + b + c === x) return 3;
  return -1;
}
/* 一個做法是不是「一片出一個角」的合法做法。 */
function crossLegalRef(c){
  if (!c || ['join', 'lay', 'one'].indexOf(c.op) < 0) return false;
  if (c.op === 'one') return ANGLE_SET_REF.indexOf(c.a) >= 0;
  const inA = A_SET_REF.indexOf(c.a) >= 0, inB = B_SET_REF.indexOf(c.b) >= 0;
  const inA2 = A_SET_REF.indexOf(c.b) >= 0, inB2 = B_SET_REF.indexOf(c.a) >= 0;
  return (inA && inB) || (inA2 && inB2);
}

/* ---------- 幾何：從畫出來的座標把角度算回來 ---------- */
function distRef(p, q){
  return Math.sqrt((p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y));
}
/* 餘弦定理：三個點裡 b 是頂點。課程頁用 atan2 的方向差，這裡走另一條路。 */
function cornerDegRef(a, b, c){
  const ab = distRef(a, b), cb = distRef(c, b), ac = distRef(a, c);
  if (ab < EPS || cb < EPS) return null;
  let cos = (ab * ab + cb * cb - ac * ac) / (2 * ab * cb);
  if (cos > 1) cos = 1;
  if (cos < -1) cos = -1;
  return Math.acos(cos) * 180 / Math.PI;
}
/* 一個點在不在多邊形裡面（射線法）。**鏡射**的角記號張角完全正確，
   只有問「它畫在圖形裡面還是外面」才抓得到 —— 這一課真的踩過。 */
function pointInPolyRef(pt, poly){
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if (((yi > pt.y) !== (yj > pt.y)) &&
        (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
/* 解析 wedgePath 吐出來的字串：'M cx cy L x1 y1 A r r 0 0 sweep x2 y2 Z'。
   ⚠️ 讀不懂一律回 null，由呼叫端報錯 —— 讀不懂是「沒檢查」，不是「通過」。 */
const NUM = '(-?\\d+(?:\\.\\d+)?)';
const WEDGE_RE = new RegExp('^M ' + NUM + ' ' + NUM + ' L ' + NUM + ' ' + NUM +
                            ' A ' + NUM + ' ' + NUM + ' 0 0 ([01]) ' + NUM + ' ' + NUM + ' Z$');
const ARC_RE = new RegExp('^M ' + NUM + ' ' + NUM + ' A ' + NUM + ' ' + NUM +
                          ' 0 ([01]) ([01]) ' + NUM + ' ' + NUM + '$');
function degFromPoint(cx, cy, x, y){
  /* 畫布的 y 往下，所以要取負才回到「數學上的角度」。 */
  return Math.atan2(-(y - cy), x - cx) * 180 / Math.PI;
}
function normSpanRef(d1, d2){
  let diff = Math.abs(d1 - d2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}
/* 一段弧的 large-arc／sweep flag 對不對。⚠️ 兩個 flag 決定瀏覽器畫**小弧還是大弧**，
   而張角是從兩個端點算的 —— flag 反了的話畫面上是大弧，張角檢查卻完全綠燈
   （codex 第三輪抓到）。這一課每一段弧都不超過平角，所以 large 一律是 0，
   sweep 由方向決定（θ 變大在畫布上是逆時針＝0）。 */
function arcFlagProblem(parsed, fromDeg, toDeg, label){
  if (parsed.large !== 0)
    return label + ': the arc is drawn with large-arc-flag 1, so the browser draws the major arc';
  const wantSweep = (toDeg > fromDeg) ? 0 : 1;
  if (parsed.sweep !== wantSweep)
    return label + ': the arc sweep flag is ' + parsed.sweep + ' but the direction needs ' + wantSweep;
  return null;
}
/* 一段弧掃過的範圍（含中間的極值點），再加上線寬的一半。
   ⚠️ 只看兩個端點是不夠的：一段弧可以在**中間**凸出畫布，兩個端點卻都在裡面。 */
function arcBoxRef(cx, cy, fromDeg, toDeg, r, halfStroke){
  /* ⚠️ 讀不懂就回 null 由呼叫端報錯：NaN 算出來的 box 每一個比較都是 false（全通過）。 */
  const hh = (halfStroke === undefined) ? 0 : halfStroke;
  if (![cx, cy, fromDeg, toDeg, r, hh].every(Number.isFinite)) return null;
  if (!(r > 0) || hh < 0) return null;
  const lo = Math.min(fromDeg, toDeg), hi = Math.max(fromDeg, toDeg);
  const xs = [], ys = [];
  [fromDeg, toDeg].forEach(function(d){
    xs.push(cx + r * Math.cos(d * Math.PI / 180));
    ys.push(cy - r * Math.sin(d * Math.PI / 180));
  });
  /* 每一個「正東／正北／正西／正南」只要落在掃過的範圍裡，就是一個極值點。 */
  const first = Math.ceil(lo / 90) * 90;
  for (let k = first; k <= hi; k += 90){
    if (k >= lo && k <= hi){
      xs.push(cx + r * Math.cos(k * Math.PI / 180));
      ys.push(cy - r * Math.sin(k * Math.PI / 180));
    }
  }
  const h = hh;
  return { minX:Math.min.apply(null, xs) - h, maxX:Math.max.apply(null, xs) + h,
           minY:Math.min.apply(null, ys) - h, maxY:Math.max.apply(null, ys) + h };
}
/* 一個扇形實際畫出來的張角與半徑。 */
function parseWedgeRef(dStr){
  const m = WEDGE_RE.exec(String(dStr));
  if (!m) return null;
  const cx = +m[1], cy = +m[2], x1 = +m[3], y1 = +m[4];
  const r1 = +m[5], r2 = +m[6], x2 = +m[8], y2 = +m[9];
  if (Math.abs(r1 - r2) > EPS) return null;
  const rStart = distRef({ x:cx, y:cy }, { x:x1, y:y1 });
  const rEnd = distRef({ x:cx, y:cy }, { x:x2, y:y2 });
  if (Math.abs(rStart - r1) > 1e-3 || Math.abs(rEnd - r1) > 1e-3) return null;
  return { cx:cx, cy:cy, r:r1, large:0, sweep:Number(m[7]),
           span:normSpanRef(degFromPoint(cx, cy, x1, y1), degFromPoint(cx, cy, x2, y2)),
           pts:[{ x:cx, y:cy }, { x:x1, y:y1 }, { x:x2, y:y2 }] };
}
/* 一段弧（arcPath）實際畫出來的張角。中心要由呼叫端給。 */
function parseArcRef(dStr, cx, cy){
  const m = ARC_RE.exec(String(dStr));
  if (!m) return null;
  const x1 = +m[1], y1 = +m[2], r1 = +m[3], r2 = +m[4], x2 = +m[7], y2 = +m[8];
  if (Math.abs(r1 - r2) > EPS) return null;
  const rStart = distRef({ x:cx, y:cy }, { x:x1, y:y1 });
  const rEnd = distRef({ x:cx, y:cy }, { x:x2, y:y2 });
  if (Math.abs(rStart - r1) > 1e-3 || Math.abs(rEnd - r1) > 1e-3) return null;
  return { r:r1, large:Number(m[5]), sweep:Number(m[6]),
           span:normSpanRef(degFromPoint(cx, cy, x1, y1), degFromPoint(cx, cy, x2, y2)),
           pts:[{ x:x1, y:y1 }, { x:x2, y:y2 }] };
}

/* ---------- 算式逐條驗算（全站共用的那一份） ----------
   ⚠️ '°' 一定要當量詞交出去，否則 '90° － 35° ＝ 55°' 會被切成
   「讀不懂的 ＝ 55」，整條靜靜不驗。（裝上去之前實測過。） */
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['°', '片', '塊', '排', '個', '種', '條', '題'],
  unitsEn: ['°', 'pieces?', 'squares?', 'rows?', 'angles?', 'degrees?']
});

/* ---------- 題庫的第二套答案 ----------
   ⚠️ 只比對「頁面的 ans 等於設定檔寫死的索引」的話，把正解換成別的句子而 ans
   不動，所有檢查還是綠的。所以每一列都要有 expect（正解的**字面**）與
   ask（題幹在問什麼），兩邊都釘。 */
const BANK_EXPECTED = {
  qs: [
    { expect:{ zh:'45° 和 90°', en:'45° and 90°' },
      ask:{ zh:'另外兩個角是幾度', en:'what are the other two' } },
    { expect:{ zh:'75°', en:'75°' },
      ask:{ zh:'合起來是幾度', en:'How many degrees is the angle you get' } },
    { expect:{ zh:'60°', en:'60°' },
      ask:{ zh:'露出來</strong>的角是幾度', en:'left showing' } },
    { expect:{ zh:'都是 90°', en:'All of them 90°' },
      ask:{ zh:'四個角，各是幾度', en:'each of the four angles of a rectangle' } },
    { expect:{ zh:'55°', en:'55°' },
      ask:{ zh:'另一塊是幾度', en:'How many degrees is the other' } },
    { expect:{ zh:'65°', en:'65°' },
      ask:{ zh:'那一個角是幾度', en:'diagonally across' } }
  ],
  qsAdv: [
    { expect:{ zh:'把 60° 和 45° 拼起來', en:'Join 60° and 45°' },
      ask:{ zh:'哪一個做法做得出來', en:'Which of these gets her there' } },
    { expect:{ zh:'50°', en:'50°' },
      ask:{ zh:'不可能</strong>是兩片三角板', en:'cannot</strong> be built' } },
    { expect:{ zh:'180° 以內的 15 的倍數裡只有 165° 一次擺兩片做不出來，它要接三個角：90° ＋ 45° ＋ 30°',
               en:'Of the multiples of 15 up to 180°, only 165° is out of reach in one placing; it takes three corners: 90° + 45° + 30°' },
      ask:{ zh:'哪一句話是對的', en:'Which statement is true' } },
    { expect:{ zh:'70°', en:'70°' },
      ask:{ zh:'另一塊是幾度', en:'How many degrees is the other' } }
  ],
  qsBoost: [
    { expect:{ zh:'三角板大小不一樣，角度一模一樣 —— 角的大小和邊畫多長沒有關係',
               en:'The pieces are different sizes but the angles are exactly the same — the size of an angle has nothing to do with how long its sides are drawn' },
      ask:{ zh:'他錯在哪裡', en:'What has she got wrong' } },
    { expect:{ zh:'疊起來要看露出來的那一塊，是 45° － 30° ＝ 15°；要相加就不可以重疊，兩片要分別放在共用邊的兩邊',
               en:'Laying them means reading the part left showing, 45° − 30° = 15°; to add them they must not overlap, but sit on either side of the shared side' },
      ask:{ zh:'他錯在哪裡', en:'What has he got wrong' } }
  ]
};

/* ---------- 四頁一起釘的措辭 ----------
   ⚠️ min 要寫**當下真實的出現次數**，不是「至少 1」——
   實際有兩份而只要求一份的話，拿掉其中一份還是綠的。 */
const SIBLING_RULES = [
  { text:'角的大小和邊畫多長沒有關係', files:{ index:5, reference:2 } },
  { text:'15 的倍數', files:{ index:14, reference:11, review:4 } },
  { text:'165', files:{ index:15, reference:3, review:3 } },
  { text:'斜對面', files:{ index:16, reference:3, review:3, parents:6 } },
  { text:'兩塊加起來還是原來那個角', files:{ index:7, reference:2, review:1, parents:2 } },
  { text:'共用一條邊', files:{ index:8, reference:8, review:2 } },
  { text:'不可以重疊', files:{ index:3, parents:2 } },
  { text:'露出來', files:{ index:14, reference:6, review:4, parents:2 } },
  { text:'反過來', files:{ index:2, reference:2 } },
  { text:'各出一個角', files:{ index:5, reference:2, review:2 } }
];
const SIBLING_RULES_EN = [
  { text:'has nothing to do with how long its sides are drawn', files:{ index:4, reference:1 } },
  { text:'multiple of 15', files:{ index:4, reference:4, review:2 } },
  { text:'diagonally across', files:{ index:10, reference:2, review:2, parents:2 } },
  { text:'add up to the angle you started with', files:{ index:4, reference:1, review:1 } },
  { text:'left showing', files:{ index:11, reference:3, review:4, parents:1 } },
  { text:'not overlap', files:{ index:4, reference:1 } },
  { text:'one corner from each', files:{ index:3, reference:2, review:2 } },
  { text:'reverse is', files:{ index:1, reference:1 } }
];
/* 一個字都不可以出現的句子（都是**假話**）。
   ⚠️ 這一張表是 SIBLING_RULES 的另一半：只有下界擋不住「正確的留著、旁邊再加一句錯的」。 */
const FORBIDDEN = [
  '兩塊加起來是 180',
  '每一個 15 的倍數兩片都做得出來',
  '大的三角板角度比較大',
  '對角就是旁邊那一個',
  '旁邊那一個角也一樣大',
  '四邊形的四個角加起來',
  'multiple of 15 is always buildable',
  'the angle next to it matches'
];
/* 一句規則必須住在**指定的字典鍵**裡 —— 只數全檔次數的話，把規則從課文裡刪掉、
   在別處補一次（未用到的變數、按鈕文字、藏起來的元素）就照樣是「剛好等於」。
   （codex 第二輪抓到。）key 的值用單引號字面量，逐字取出來比對。 */
const KEY_RULES = [
  { file:'index', key:'s2note', must:['共用一條邊', '不可以重疊', '相加'] },
  { file:'index', key:'s3note', must:['各出一個角', '15 的倍數', '反過來', '165'] },
  { file:'index', key:'s4note', must:['斜對面', '90°'] },
  { file:'index', key:'s5note', must:['兩塊加起來還是原來那個角', '減法'] },
  { file:'index', key:'s1note', must:['角的大小和邊畫多長沒有關係'] },
  { file:'reference', key:'f2', must:['各出一個角', '15 的倍數'] },
  { file:'reference', key:'s3note', must:['反過來', '165', '接三個角'] },
  { file:'reference', key:'f3', must:['兩塊加起來'] },
  { file:'parents', key:'s1p2', must:['正方形和長方形四個角都是 90°', '對角', '兩塊加起來還是原來那個角'] }
];
function zhRegion(clean){
  const a = clean.indexOf('zh: {');
  const b = clean.indexOf('en: {', a < 0 ? 0 : a);
  if (a < 0 || b < 0 || b <= a) return null;
  return clean.slice(a, b);
}
/* ⚠️ 只在**中文字典那一段**裡找，而且必須剛好一個 ——
   「拿第一個匹配當中文」在字典順序被調換之後會靜靜地去檢查英文，
   而重複的鍵在 JS 裡是後面那個生效、這裡卻讀前面那個（codex 第三輪抓到）。
   讀不懂 zh 區塊就回 null，由呼叫端 fail-closed。 */
function keyValues(clean, key){
  const region = zhRegion(clean);
  if (region === null) return null;
  const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|[\\s{,])' + safeKey + "\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'", 'g');
  const out = [];
  let m;
  while ((m = re.exec(region)) !== null) out.push(m[1]);
  return out;
}


/* 成對出現：左邊那句話**只要出現**，右邊那句話就必須在同一頁出現。
   （規則寫太滿是這個專案的頭號缺陷類別 —— 逆命題不成立那一句一定要跟著。） */
const PAIRED_RULES = [
  { rule:'15 的倍數', qualifier:'反過來', pages:['index', 'reference'] },
  { rule:'multiple of 15', qualifier:'reverse is', pages:['index', 'reference'] }
];
/* 交給別的年級的詞：每一次出現都必須在指定的字眼附近，
   不然就是這一課自己教了超出年段的東西。 */
const HANDOFF_RULES = [
  { word:'內角和', near:['五年級'], span:150 },
  { word:'對頂角', near:['國中'], span:80 },
  { word:'vertical angles', near:['junior-high'], span:200 }
];

/* 把 HTML 註解與 JS 區塊註解拿掉 —— 註解可以拿來洗白：把一條被刪掉的規則
   原封不動貼進註解，只比字串的檢查就會以為它還在。
   ⚠️ 換成 '\n' 而不是 ''：換成空字串的話註解前後的字會接起來，
   生出原始碼裡根本不存在的匹配。 */
/* 把一段 JS 裡的註解拿掉。⚠️ 用**逐字掃描**，不是正規式：
   一格 lookbehind 的寫法兩邊都會出事 —— `dummy: // 一句規則` 這種
   冒號後面的行註解逃得掉（於是可以把規則藏進註解裡騙過措辭檢查），
   而 `'ratio // slope'` 這種字串裡的 `//` 又會被誤砍。（codex 第二輪抓到。）
   換成 '\n' 而不是 ''：註解前後的字接起來會生出原始碼裡沒有的匹配。 */
function stripJsComments(code){
  let out = '', i = 0;
  const n = code.length;
  while (i < n){
    const c = code[i], c2 = code[i + 1];
    if (c === '/' && c2 === '/'){
      while (i < n && code[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (c === '/' && c2 === '*'){
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      out += '\n';
      continue;
    }
    if (c === '"' || c === "'" || c === '`'){
      const q = c;
      out += c; i++;
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
  /* markup 裡的 `//`（網址）不可以碰，所以只在 <script> 區塊裡掃。
     ⚠️ `<script\b` 而不是 `<script` —— 少了字界的話 `<scripture>` 也會被當成 script
     而去動到 markup（codex 第三輪抓到）。 */
  return src.replace(/<script\b[\s\S]*?<\/script>/gi, function(block){ return stripJsComments(block); });
}
/* ⚠️ 掃描器不是 JS 詞法分析器：**正規式字面量**裡的引號和**樣板字串的 ${}**
   會讓它失去同步（註解逃得掉，或真的字串被砍掉）。這個專案不裝相依套件，
   所以改成 fail-closed：課程頁的 script 裡**不可以出現**那兩種語法；
   哪一天真的要用，就得先把這個檢查換成真的 parser。（codex 第三輪抓到。） */
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
  for (;;){
    const k = hay.indexOf(needle, i);
    if (k < 0) return n;
    n++; i = k + needle.length;
  }
}
/* 讀同一課的別頁。⚠️ 一定要用 process.argv[2] 推目錄，不可以用 __dirname ——
   breaktest.js 是把四頁複製到暫存目錄再跑的，用 __dirname 會讀到真的 repo，
   針對別頁的斷言就永遠是綠的。 */
function siblingSources(){
  const dir = path.dirname(process.argv[2] || '');
  const out = {};
  ['index', 'reference', 'review', 'parents'].forEach(function(name){
    const fp = path.join(dir, name + '.html');
    out[name] = fs.existsSync(fp) ? fs.readFileSync(fp, 'utf8') : null;
  });
  return out;
}

/* ---------- 渲染出來的字串該長什麼樣 ---------- */
function textProblems(s, lang, label){
  const out = [];
  const shown = String(s).replace(/<[^>]+>/g, '');
  if (/undefined|NaN|\[object/.test(shown)) out.push(label + ': undefined/NaN in "' + shown.slice(0, 60) + '"');
  if (lang === 'zh'){
    const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) out.push(label + ': missing space between Chinese and a digit: ' + [...new Set(glued)].join(' '));
  } else {
    /* 英文只有 1 會錯，而且動詞也要跟著（1 pieces／1 angles are）。 */
    const bad = shown.match(/\b1 (?:piece|angle|degree|row|square)s\b|\b1 \w+ are\b/g);
    if (bad) out.push(label + ': bad english singular: ' + [...new Set(bad)].join(' '));
  }
  const dbl = shown.match(/(?<!\.)\.\.(?!\.)|。。|，，|！！|？？/);
  if (dbl) out.push(label + ': doubled punctuation "' + dbl[0] + '"');
  return out;
}

/* ---------- review.html 的選項長什麼樣 ---------- */
const DEG_OPT_RE = /^(\d{1,3})°$/;
const COMBO_ZH_RE = /^把 (\d{1,3})° (?:和 (\d{1,3})° 拼起來|疊上 (\d{1,3})°)$/;
const COMBO_EN_RE = /^(?:Join (\d{1,3})° and (\d{1,3})°|Lay (\d{1,3})° on (\d{1,3})°)$/;
const KIND_WORDS = {
  zh:['銳角', '直角', '鈍角', '平角'],
  en:['an acute angle', 'a right angle', 'an obtuse angle', 'a straight angle']
};
const TRI_WORDS = {
  zh:['銳角三角形', '直角三角形', '鈍角三角形', '無法判斷'],
  en:['an acute triangle', 'a right triangle', 'an obtuse triangle', 'there is no way to tell']
};
const DEG_GENS = ['pieceOther', 'joinTwo', 'layTwo', 'notMakeable', 'rectCorner', 'paraOpp', 'splitRight', 'splitAny'];
const GEN_IDS = DEG_GENS.concat(['whichCombo', 'nameKind', 'triKind', 'minPieces']);

/* ---------- 小遊戲「拼角工作坊接訂單」（§六之五，2026-10-05 起五關五種玩法） ----------
   每一關都用**自己的實作**重算，不呼叫課程頁判斷對錯的那一行：
   - 圖：三角板、四邊形的每一個角用**餘弦定理**從畫布座標量回來；扇形從 SVG 字串讀回起訖角。
   - 規則：照遊戲的規則把每一題從頭玩一遍（第一個角、第二個角、每一張卡、每一對角、每一刀），
     證明一定解得完、而且只有對的做法收。
   - 範圍：判斷「放在哪一格／切在哪裡」的函式（nearestOpen、joinInGap、cutPick）有第二套實作掃整張畫板；
     看得到的目標（角、數字、刻度）放下去都要被收（自然動作的規則）。
   - 原始碼：RENDER 裡擋錯誤動作的那幾行用 need() 釘住；shuffle()、nearestOpen()、roundMiss() 切出來真的跑。 */
const GAME_ORDER_REF = ['piece', 'join', 'sort', 'opp', 'cut'];
const TOUCH_MIN_REF = 48;        /* 300 寬的畫板在 375px 手機上縮成約 0.96 倍：48 → 46px ≥ 44 */
const JOIN_TARGETS_REF = [75, 105, 120, 135, 150, 180];
function extractFn(src, name){
  const head = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = head.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  while (i < src.length && depth > 0){
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/'){ while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*'){ i = src.indexOf('*/', i + 2); if (i < 0) return null; i += 2; continue; }
    if (c === '"' || c === "'"){ const q = c; i++; while (i < src.length && src[i] !== q){ if (src[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{') depth++; else if (c === '}') depth--;
    i++;
  }
  return depth === 0 ? src.slice(m.index, i) : null;
}
function boxOf(cx, cy, w, h, name){ return { l:cx - w / 2, r:cx + w / 2, t:cy - h / 2, b:cy + h / 2, n:name }; }
function boxesOverlap(a, b){ return Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0.5 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0.5; }
function layoutProblems(label, boxes, W, H, allowed){
  const out = [];
  boxes.forEach(function(a, i){
    if (![a.l, a.r, a.t, a.b].every(Number.isFinite)) { out.push(label + ': ' + a.n + ' has no position'); return; }
    if (a.l < 0 || a.t < 0 || a.r > W || a.b > H) out.push(label + ': ' + a.n + ' sticks out of the ' + W + '×' + H + ' board');
    for (let j = i + 1; j < boxes.length; j++)
      if (boxesOverlap(a, boxes[j]) && !(allowed && allowed(a, boxes[j]))) out.push(label + ': ' + a.n + ' overlaps ' + boxes[j].n);
  });
  return out;
}
/* 'M cx cy L x1 y1 A r r 0 0 0 x2 y2 Z' → 起訖角（數學方向，度） */
function sectorAnglesRef(d){
  const m = /^M (-?[\d.]+) (-?[\d.]+) L (-?[\d.]+) (-?[\d.]+) A ([\d.]+) [\d.]+ 0 0 0 (-?[\d.]+) (-?[\d.]+) Z$/.exec(d);
  if (!m) return null;
  const cx = +m[1], cy = +m[2];
  const a1 = Math.atan2(cy - +m[4], +m[3] - cx) * 180 / Math.PI, a2 = Math.atan2(cy - +m[7], +m[6] - cx) * 180 / Math.PI;
  let span = a2 - a1; while (span < 0) span += 360; while (span >= 360) span -= 360;
  return { cx:cx, cy:cy, r:+m[5], from:a1, span:span };
}
function digitsOf(s){ return (String(s).replace(/<[^>]+>/g, '').match(/\d+/g) || []).map(Number); }
/* 四年級的 3 種角：直角、這一片最尖的、另一個（45°／45°／90° 那一片兩個尖角一樣） —— 第二套分類 */
function kindRef(angles, i){
  const d = angles[i];
  if (Math.abs(d - RIGHT_REF) < 1e-6) return 'right';
  const sharp = angles.filter(function(x){ return Math.abs(x - RIGHT_REF) > 1e-6; });
  if (Math.abs(sharp[0] - sharp[1]) < 1e-6) return 'eq';
  return d === Math.min.apply(null, sharp) ? 'min' : 'max';
}

function gameChecks(D, I18N, fail, src, narrated){
  function need(what, re, msg){ if (!re.test(src)) fail('game ' + what + ': ' + msg); }
  /* 擋不住的捷徑：handler 開頭到呼叫判斷函式之間，不可以有任何「收下」的動作（codex 第一輪：只釘判斷那一行，
     前面多插一條提早收下的分支照樣全綠）。nth ＝ 第幾個 useTapSelect（第 1 關是 0）。 */
  function noEarlyAccept(what, startRe, judgeRe, bad){
    const m = startRe.exec(src);
    if (!m){ fail('game ' + what + ': cannot find the handler start'); return; }
    const rest = src.slice(m.index + m[0].length), j = rest.search(judgeRe);
    if (j < 0){ fail('game ' + what + ': the handler never calls its judge function'); return; }
    const seg = rest.slice(0, j);
    bad.forEach(function(w){ if (seg.indexOf(w) >= 0) fail('game ' + what + ': early accept — "' + w + '" runs before the judge function'); });
  }
  if (JSON.stringify(D.GAME_ORDER) !== JSON.stringify(GAME_ORDER_REF)) fail('game: the five rounds are ' + JSON.stringify(D.GAME_ORDER) + ', expected ' + JSON.stringify(GAME_ORDER_REF));
  ['zh', 'en'].forEach(function(lang){
    const d = I18N[lang];
    GAME_ORDER_REF.forEach(function(k){
      if (typeof d.gAsks[k] !== 'string' || !d.gAsks[k]) fail('gAsks.' + k + ' missing in ' + lang);
      if (typeof d.gHints[k] !== 'string' || !d.gHints[k]) fail('gHints.' + k + ' missing in ' + lang);
    });
    if (digitsOf(d.gPts(20)).join() !== '20' || digitsOf(d.gMinus).join() !== '5') fail('gPts / gMinus (' + lang + ') do not say 20 / 5');
    if (digitsOf(d.gWin(85)).indexOf(85) < 0) fail('gWin (' + lang + ') does not show the score');
  });

  /* ---------- 計分、吸附、洗牌：從原始碼切出來真的跑 ---------- */
  need('scoring', /var pts = gMistake \? 10 : 20;/, 'a round must give +20 with no mistakes and +10 after mistakes');
  {
    const fsrc = extractFn(src, 'roundMiss');
    if (!fsrc) fail('game scoring: cannot find roundMiss()');
    else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(function(row){
      let r;
      try { r = new Function('var gMistake = false, gScore = ' + row[0] + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
      catch (e){ fail('game scoring: roundMiss() could not run: ' + e.message); return; }
      if (r.s !== row[1] || String(r.shown) !== String(row[1])) fail('game scoring: a mistake at ' + row[0] + ' points leaves ' + r.s + ' (−5, floored at 0)');
      if ((r.html.indexOf('@MINUS@') >= 0) !== row[2]) fail('game scoring: at ' + row[0] + ' points the "−5" note is ' + (row[2] ? 'missing' : 'shown although nothing was taken'));
      if (r.html.indexOf('why') < 0 || !r.m) fail('game scoring: roundMiss() does not show the reason or record the mistake');
    });
  }
  let nearestOpen = null;
  {
    const fsrc = extractFn(src, 'nearestOpen');
    if (!fsrc) fail('game: cannot find nearestOpen()');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('game: nearestOpen() could not run: ' + e.message); } }
    if (nearestOpen){
      const two = [ { id:0, cx:100, cy:100, hw:42, hh:42, done:false }, { id:1, cx:155, cy:100, hw:12, hh:12, done:false } ];
      const r0 = nearestOpen(two, { x:140, y:100 }, 6);
      if (!r0 || r0.id !== 0) fail('nearestOpen(): a point inside the big box near the small one goes to the small one (measure to the box, not the centre)');
      const two2 = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:false }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
      const r1 = nearestOpen(two2, { x:125, y:100 }, 6);
      if (!r1 || r1.id !== 1) fail('nearestOpen(): a drop just inside the second box goes to the first one (array order is not nearness)');
      const done = [ { id:0, cx:100, cy:100, hw:22, hh:22, done:true }, { id:1, cx:148, cy:100, hw:22, hh:22, done:false } ];
      if (nearestOpen(done, { x:121, y:100 }, 6) !== null) fail('nearestOpen(): a drop nearest to a finished slot skips it into the next slot');
      if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('nearestOpen(): a drop far from every slot is accepted');
    }
  }
  {
    /* 托盤不可以一開始就排成答案的順序（同一個答案的兩張卡也算） */
    let sorted = 0, seen = new Set();
    for (let i = 0; i < 4000; i++){
      const a = D.shuffle([3, 1, 2, 0]);
      if (a.join() === '0,1,2,3') sorted++;
      seen.add(a.join());
      const b = D.shuffle(['a', 'b', 'c', 'd'], function(x){ return { a:0, b:0, c:1, d:2 }[x]; });
      const kb = b.map(function(x){ return { a:0, b:0, c:1, d:2 }[x]; });
      if (kb[0] <= kb[1] && kb[1] <= kb[2] && kb[2] <= kb[3]) sorted++;
    }
    if (sorted) fail('shuffle(): ' + sorted + ' trays out of 8000 came out already in answer order');
    if (seen.size < 20) fail('shuffle(): only ' + seen.size + ' of the 23 allowed orders of four ever appear');
  }
  need('drag', /if \(gen !== gGen\) return;/, 'a piece released after its board was rebuilt must do nothing (generation guard)');
  need('drag', /el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/, 'a lost pointer capture must put the piece back');
  need('drag', /if \(!start \|\| e\.pointerId !== pid\) return;/, 'only the first finger may drag');
  need('drag', /\.gpiece\.locked\{[^}]*pointer-events:none/, 'placed pieces must not block taps (pointer-events:none)');
  need('drag', /\.gpiece\{[^}]*touch-action:none/, 'draggable pieces need touch-action:none');
  need('restart', /function startRound\(\)\{[\s\S]*?gGen\+\+;[\s\S]*?gameStage\.textContent = '';/, 'every round must start a new board generation and clear the stage');
  need('ahead', /if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/, 'ahead mode must show hint level 1 automatically');

  /* ---------- 第 1 關：認角 ---------- */
  {
    const G = D.PIECE_G;
    [G.card.w, G.card.h].forEach(function(s){ if (s < TOUCH_MIN_REF) fail('piece: a degree card side is ' + s + ' (< ' + TOUCH_MIN_REF + ')'); });
    if (D.GAME_PIECE.length < 6 || !D.GAME_PIECE.some(function(e){ return e.p === 0; }) || !D.GAME_PIECE.some(function(e){ return e.p === 1; }))
      fail('piece: the pool must use both set squares');
    D.GAME_PIECE.forEach(function(e, k){
      const label = 'piece pool ' + k, ref = D.pieceRef(e), big = D.pieceBig(e);
      const angRef = ref.pts.map(function(p, i){ return cornerDegRef(ref.pts[(i + 2) % 3], p, ref.pts[(i + 1) % 3]); });
      const angBig = big.pts.map(function(p, i){ return cornerDegRef(big.pts[(i + 2) % 3], p, big.pts[(i + 1) % 3]); });
      if (!eqArr(sortNum(angRef.map(Math.round)), PIECE_REF[e.p])) fail(label + ': the small piece is drawn with angles ' + angRef.map(Math.round).join('/'));
      angBig.forEach(function(a, i){
        if (Math.abs(a - big.corners[i].deg) > 0.01) fail(label + ': corner ' + i + ' of the big piece is drawn ' + a.toFixed(2) + '° but the game judges it as ' + big.corners[i].deg + '°');
        if (Math.abs(a - angRef[i]) > 0.01) fail(label + ': corner ' + i + ' is ' + a.toFixed(1) + '° on the big piece but ' + angRef[i].toFixed(1) + '° on the small one');
        if (Math.abs(ref.corners[i].deg - angRef[i]) > 0.01) fail(label + ': the small piece labels corner ' + i + ' ' + ref.corners[i].deg + '° but it is drawn ' + angRef[i].toFixed(1) + '°');
      });
      const sideR = distRef(ref.pts[0], ref.pts[1]), sideB = distRef(big.pts[0], big.pts[1]);
      if (!(sideB / sideR > 1.3)) fail(label + ': the big piece is not clearly bigger (' + (sideB / sideR).toFixed(2) + '×)');
      const dirR = Math.atan2(ref.pts[1].y - ref.pts[0].y, ref.pts[1].x - ref.pts[0].x), dirB = Math.atan2(big.pts[1].y - big.pts[0].y, big.pts[1].x - big.pts[0].x);
      const cross = (ref.pts[1].x - ref.pts[0].x) * (ref.pts[2].y - ref.pts[0].y) - (ref.pts[1].y - ref.pts[0].y) * (ref.pts[2].x - ref.pts[0].x);
      const crossB = (big.pts[1].x - big.pts[0].x) * (big.pts[2].y - big.pts[0].y) - (big.pts[1].y - big.pts[0].y) * (big.pts[2].x - big.pts[0].x);
      if (Math.abs(dirR - dirB) < 0.01 && Math.sign(cross) === Math.sign(crossB)) fail(label + ': the big piece is not turned or flipped — the round would only test copying by position');
      /* 托盤：這一片的三個角 ＋ 一張這一片沒有、另一片才有的角 */
      const decoy = D.pieceDecoy(e.p);
      if (PIECE_REF[e.p].indexOf(decoy) >= 0 || PIECE_REF[1 - e.p].indexOf(decoy) < 0) fail(label + ': the extra card (' + decoy + '°) must be a corner of the other set square only');
      /* 照規則玩一遍：每一張卡放到每一個角 —— 只有度數一樣的收；三個角一定放得完 */
      const cards = PIECE_REF[e.p].slice().concat([decoy]);
      big.corners.forEach(function(c, i){
        cards.forEach(function(v){
          const accept = Math.abs(v - angBig[i]) < 0.01;
          if (D.pieceJudge(v, c.deg) !== (accept ? 'ok' : 'miss')) fail(label + ': pieceJudge(' + v + ', ' + c.deg + ') is ' + D.pieceJudge(v, c.deg) + ' but the drawn corner is ' + angBig[i].toFixed(1) + '°');
          if (accept) return;
          const kind = kindRef(angBig.map(Math.round), i);
          if (D.cornerKind(big.angles, i) !== kind) fail(label + ': corner ' + i + ' is the "' + kind + '" corner but the game calls it "' + D.cornerKind(big.angles, i) + '"');
          ['zh', 'en'].forEach(function(lang){
            const s = I18N[lang].gPieceNo(v, c.deg, kind, PIECE_REF[e.p].indexOf(v) < 0);
            const want = kind === 'right' ? [v, 90] : [v, c.deg];
            if (PIECE_REF[e.p].indexOf(v) < 0) want.push(v);
            if (digitsOf(s).join() !== want.join()) fail(label + ' (' + lang + '): the reason for ' + v + '° on the ' + c.deg + '° corner reads ' + JSON.stringify(digitsOf(s)) + ', expected ' + JSON.stringify(want));
            narrated.push([lang, 'gPieceNo', s]);
          });
        });
      });
      /* 自然動作：看得到的角 —— 頂點、以及三角形裡離頂點 26 以內的點 —— 放下去都歸那一個角 */
      if (nearestOpen){
        const slots = big.corners.map(function(c, i){ return { id:i, cx:c.zx, cy:c.zy, hw:G.zone / 2, hh:G.zone / 2, done:false }; });
        big.corners.forEach(function(c, i){
          const u1 = { x:big.pts[(i + 1) % 3].x - c.x, y:big.pts[(i + 1) % 3].y - c.y }, u2 = { x:big.pts[(i + 2) % 3].x - c.x, y:big.pts[(i + 2) % 3].y - c.y };
          const n1 = Math.hypot(u1.x, u1.y), n2 = Math.hypot(u2.x, u2.y);
          let miss = 0;
          for (let s = 0; s <= 1; s += 0.1) for (let rr = 0; rr <= 26; rr += 2){
            const dx = (u1.x / n1) * (1 - s) + (u2.x / n2) * s, dy = (u1.y / n1) * (1 - s) + (u2.y / n2) * s, dn = Math.hypot(dx, dy);
            const pt = { x:c.x + dx / dn * rr, y:c.y + dy / dn * rr };
            const g = nearestOpen(slots, pt, D.GAME_PAD);
            if (!g || g.id !== i) miss++;
          }
          if (miss) fail(label + ': ' + miss + ' points on the drawn ' + c.deg + '° corner are not taken by that corner');
        });
      }
      const boxes = [];
      ref.corners.forEach(function(c){ boxes.push(boxOf(c.lx, c.ly, G.lblW, G.lblH, 'small-piece label ' + c.deg)); });
      big.corners.forEach(function(c){ boxes.push(boxOf(c.lx, c.ly, G.card.w, G.card.h, 'placed card at corner ' + c.i)); });
      G.trayX.forEach(function(x, j){ boxes.push(boxOf(x, G.trayY, G.card.w, G.card.h, 'tray card ' + j)); });
      boxes.push({ l:G.tag.x, r:G.tag.x + G.tag.w, t:G.tag.y, b:G.tag.y + G.tag.h, n:'the "small one" tag' });
      [ref, big].forEach(function(pl, q){
        const xs = pl.pts.map(function(p){ return p.x; }), ys = pl.pts.map(function(p){ return p.y; });
        boxes.push({ l:Math.min.apply(null, xs), r:Math.max.apply(null, xs), t:Math.min.apply(null, ys), b:Math.max.apply(null, ys), n:q ? 'big triangle' : 'small triangle' });
      });
      layoutProblems(label, boxes, G.W, G.H, function(a, b){
        return (a.n === 'big triangle' && b.n.indexOf('placed card') === 0) || (b.n === 'big triangle' && a.n.indexOf('placed card') === 0)
            || (a.n === 'small triangle' && b.n.indexOf('small-piece label') === 0) || (b.n === 'small triangle' && a.n.indexOf('small-piece label') === 0);
      }).forEach(fail);
      /* 放好的卡不可以蓋住別的角 */
      big.corners.forEach(function(c){ big.pts.forEach(function(p, j){ if (j !== c.i && Math.abs(p.x - c.lx) < G.card.w / 2 && Math.abs(p.y - c.ly) < G.card.h / 2) fail(label + ': the card placed on corner ' + c.i + ' covers corner ' + j); }); });
      ['zh', 'en'].forEach(function(lang){
        big.corners.forEach(function(c, i){
          const s = I18N[lang].gPiece2(kindRef(angBig.map(Math.round), i), c.deg);
          if (digitsOf(s).join() !== String(c.deg)) fail(label + ' (' + lang + '): the level-2 hint for corner ' + i + ' reads ' + JSON.stringify(digitsOf(s)));
          narrated.push([lang, 'gPiece2', s]);
        });
      });
    });
    need('piece', /if \(pieceJudge\(v, c\.deg\) !== 'ok'\)\{\s*roundMiss\(d\.gPieceNo\(/, 'a card must be judged against the corner it was dropped on');
    noEarlyAccept('piece', /piece: function\(d\)\{[\s\S]*?useTapSelect\(B, function\(P, pt\)\{/, /pieceJudge\(/, ['lock(', 'return true', '.done = true']);
    need('piece', /var s = nearestOpen\(slots, pt, GAME_PAD\);\s*if \(!s\) return false;/, 'a drop away from every corner must bounce silently');
    need('piece', /shuffle\(big\.angles\.concat\(\[pieceDecoy\(e\.p\)\]\)\)/, 'the tray must be the piece\'s three angles plus the decoy, shuffled');
  }

  /* ---------- 第 2 關：拼 ---------- */
  {
    const G = D.JOIN_G;
    const all = D.GAME_JOIN.trap.concat(D.GAME_JOIN.plain);
    if (JSON.stringify(sortNum(all)) !== JSON.stringify(JOIN_TARGETS_REF)) fail('join: the targets are ' + sortNum(all).join('/') + ', expected every one-from-each join ' + JOIN_TARGETS_REF.join('/'));
    [G.chip.w, G.chip.h].forEach(function(s){ if (s < TOUCH_MIN_REF) fail('join: a corner chip side is ' + s + ' (< ' + TOUCH_MIN_REF + ')'); });
    all.forEach(function(W){
      const label = 'join ' + W + '°';
      /* 一片出一個角：剛好一種 */
      const ways = [];
      PIECE_REF[0].forEach(function(a){ PIECE_REF[1].forEach(function(b){ if (a + b === W) ways.push(a + '+' + b); }); });
      if (new Set(ways).size !== 1) fail(label + ': one-from-each ways are ' + JSON.stringify([...new Set(ways)]) + ' — exactly one is needed');
      /* 同一片的兩個（不同的）角加起來也剛好 W —— 那就是陷阱 */
      let trap = false;
      [0, 1].forEach(function(p){ const c = PIECE_REF[p]; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (c[i] + c[j] === W) trap = true; });
      if (trap !== (D.GAME_JOIN.trap.indexOf(W) >= 0)) fail(label + ': listed as ' + (trap ? 'plain' : 'trap') + ' but two corners of one piece ' + (trap ? 'do' : 'do not') + ' add up to it');
      /* 照規則玩：六個角當第一個 —— 比 W 小、而且另一片有 W − v 才收；收了之後只有另一片的那一個值補得滿 */
      [0, 1].forEach(function(p){
        PIECE_REF[p].forEach(function(v){
          const mine = v < W && PIECE_REF[1 - p].indexOf(W - v) >= 0;
          const page = v < W && D.pieceHas(1 - p, W - v);
          if (mine !== page) fail(label + ': the first corner ' + v + '° (piece ' + p + ') is ' + (page ? 'accepted' : 'refused') + ' by pieceHas(), expected ' + (mine ? 'accepted' : 'refused'));
          const j1 = D.joinJudge(W, [], p, v), w1 = v >= W ? 'big' : (mine ? 'first' : 'nomate');
          if (j1 !== w1) fail(label + ': joinJudge() on a first ' + v + '° (piece ' + p + ') says ' + j1 + ', expected ' + w1);
          if (mine){
            [0, 1].forEach(function(p2){ PIECE_REF[p2].forEach(function(v2){
              const j2 = D.joinJudge(W, [{ p:p, deg:v }], p2, v2), w2 = p2 === p ? 'same' : (v + v2 === W ? 'ok' : 'sum');
              if (j2 !== w2) fail(label + ': joinJudge() on ' + v + '° (piece ' + p + ') then ' + v2 + '° (piece ' + p2 + ') says ' + j2 + ', expected ' + w2);
            }); });
            if (D.joinJudge(W, [{ p:p, deg:v }, { p:1 - p, deg:W - v }], 1 - p, 45) !== 'full') fail(label + ': joinJudge() accepts a third corner');
          }
          ['zh', 'en'].forEach(function(lang){
            const d = I18N[lang];
            if (v >= W){ const s = d.gJoinBig(v, W); if (digitsOf(s).slice(0, 2).join() !== [v, W].join()) fail(label + ' (' + lang + '): gJoinBig reads ' + digitsOf(s)); narrated.push([lang, 'gJoinBig', s]); }
            else if (!mine){
              const same = PIECE_REF[p].indexOf(W - v) >= 0 && (PIECE_REF[p].indexOf(W - v) !== PIECE_REF[p].indexOf(v) || PIECE_REF[p].filter(function(x){ return x === v; }).length > 1);
              const s = d.gJoinNoMate(v, W, W - v, d.pieceName[D.PIECES[1 - p].id], D.pieceHas(p, W - v));
              narrated.push([lang, 'gJoinNoMate', s]);
              if (s.indexOf(String(W - v)) < 0) fail(label + ' (' + lang + '): the "no mate" reason does not say ' + (W - v) + '° is missing');
              if (same && D.pieceHas(p, W - v) !== true) fail(label + ': the same-piece note is lost for ' + v + '°');
            } else {
              /* 收了：第二個角 —— 同一片的一律彈回（就算加起來剛好），另一片只有 W − v 收 */
              PIECE_REF[p].forEach(function(v2, j){
                if (j === PIECE_REF[p].indexOf(v) && PIECE_REF[p].filter(function(x){ return x === v; }).length === 1) return;
                narrated.push([lang, 'gJoinSame', d.gJoinSame(v, d.pieceName[D.PIECES[p].id])]);
              });
              PIECE_REF[1 - p].forEach(function(v2){
                if (v + v2 === W){ narrated.push([lang, 'gJoinOk', d.gJoinOk(v, v2, W)]); return; }
                const s = d.gJoinNo(v, v2, v + v2, W);
                if (sortNum(digitsOf(s)).join() !== sortNum([v, v2, v + v2, W, Math.abs(W - v - v2)]).join()) fail(label + ' (' + lang + '): gJoinNo reads ' + digitsOf(s));
                narrated.push([lang, 'gJoinNo', s]);
              });
              narrated.push([lang, 'gJoinFirst', d.gJoinFirst(v, W - v)]);
              narrated.push([lang, 'gJoin2b', d.gJoin2b(W - v, d.pieceName[D.PIECES[1 - p].id])]);
            }
          });
        });
      });
      const one = ways[0].split('+').map(Number);
      ['zh', 'en'].forEach(function(lang){
        const d = I18N[lang], s = d.gJoin2(W, one[0], d.pieceName[D.PIECES[0].id], one[1], d.pieceName[D.PIECES[1].id]);
        narrated.push([lang, 'gJoin2', s]);
      });
      /* 放下去的範圍：第二套 —— 畫出來的扇形（半徑 arm）裡、還沒補滿的那一塊，加上頂點 */
      [0].concat(PIECE_REF[0], PIECE_REF[1]).filter(function(lo){ return lo < W; }).forEach(function(lo){
        let bad = 0;
        for (let x = 0; x <= G.W; x += 3) for (let y = 0; y <= G.H; y += 3){
          const dx = x - G.vx, dy = G.vy - y, r = Math.hypot(dx, dy);
          let th = Math.atan2(dy, dx) * 180 / Math.PI;
          const inside = r <= G.arm - 1 && th >= lo + 1 && th <= W - 1 && r > G.inR + 1;
          const far = r > G.inR + 1 && (r > G.arm + G.pad + 1 || th < lo - G.angPad - 1 || th > W + G.angPad + 1);
          const got = D.joinInGap(W, lo, x, y);
          if (inside && !got) bad++;
          if (far && got) bad++;
        }
        if (!D.joinInGap(W, lo, G.vx, G.vy)) bad++;
        if (bad) fail(label + ': joinInGap() disagrees with the drawn gap (' + lo + '° filled) at ' + bad + ' points');
      });
      /* 畫出來的扇形：外框 0 → W；放好的角照度數畫 */
      const svg = D.joinSVG(W, [{ p:0, deg:one[0] }, { p:1, deg:one[1] }]);
      const secs = [...svg.matchAll(/<path class="(gj-[a-z]+)" d="([^"]+)"/g)].map(function(m){ return { cls:m[1], a:sectorAnglesRef(m[2]) }; });
      const out = secs.filter(function(s){ return s.cls === 'gj-out'; })[0], fills = secs.filter(function(s){ return s.cls === 'gj-fill'; });
      if (!out || !out.a || Math.abs(out.a.from) > 0.05 || Math.abs(out.a.span - W) > 0.05) fail(label + ': the dashed outline is not drawn 0° → ' + W + '°');
      if (fills.length !== 2 || !fills[0].a || !fills[1].a || Math.abs(fills[0].a.span - one[0]) > 0.05 || Math.abs(fills[1].a.from - one[0]) > 0.05 || Math.abs(fills[1].a.span - one[1]) > 0.05)
        fail(label + ': the two placed corners are not drawn side by side at their own sizes');
      /* 版面：W 的牌子、兩排角、兩行片名 */
      const boxes = [boxOf(D.polarX(G.vx, W / 2, G.wLblR), D.polarY(G.vy, W / 2, G.wLblR), G.wBadge.w, G.wBadge.h, 'the ' + W + '° badge')];
      [0, 1].forEach(function(p){
        boxes.push({ l:10, r:G.W - 10, t:G.grpY[p], b:G.grpY[p] + G.grpH, n:'piece name ' + p });
        G.rowX.forEach(function(x, j){ boxes.push(boxOf(x, G.rowY[p], G.chip.w, G.chip.h, 'chip ' + p + '.' + j)); });
      });
      boxes.push({ l:G.vx - G.arm, r:G.vx + G.arm, t:G.vy - G.arm, b:G.vy + 2, n:'the angle' });
      layoutProblems(label, boxes, G.W, G.H, function(a, b){ return a.n === 'the angle' || b.n === 'the angle'; }).forEach(fail);
    });
    need('join', /if \(placed\.length === 2 \|\| !joinInGap\(W, lo, pt\.x, pt\.y\)\) return false;/, 'a drop outside the dashed gap must bounce silently');
    need('join', /var v = P\.data\.deg, p = P\.data\.p, res = joinJudge\(W, placed, p, v\);/, 'the join handler must ask joinJudge()');
    need('join', /if \(res !== 'first' && res !== 'ok'\) return false;/, 'only "first" and "ok" may place a corner');
    /* 掃到最後那一道關卡為止（codex 第二輪：judge 之後、關卡之前插一條「same 也收下」照樣逃得掉） */
    noEarlyAccept('join', /join: function\(d\)\{[\s\S]*?useTapSelect\(B, function\(P, pt\)\{/, /if \(res !== 'first' && res !== 'ok'\) return false;/, ['lock(', 'return true', 'placed.push']);
    need('join', /pieceAngles\(PIECES\[p\]\)\.forEach\(function\(v, j\)\{\s*addPiece\(/, 'the tray must offer every corner of both pieces');
    need('join', /var list = swapMaybe\(\[pick\(GAME_JOIN\.trap\), pick\(GAME_JOIN\.plain\)\]\);/, 'each round needs one order with the same-piece trap and one without');
  }

  /* ---------- 第 3 關：拼還是疊 ---------- */
  {
    const G = D.SORT_G;
    [G.card.w, G.card.h].forEach(function(s){ if (s < TOUCH_MIN_REF) fail('sort: a card side is ' + s); });
    D.GAME_SORT.forEach(function(set, k){
      const label = 'sort set ' + k, cards = D.sortCards(set), bins = D.sortBins(cards);
      if (cards.length !== 4) fail(label + ': four cards expected');
      set.forEach(function(pr){
        if (!crossLegalRef({ op:'join', a:pr[0], b:pr[1] })) fail(label + ': ' + pr.join('/') + ' needs two corners of one set square');
        if (!(pr[0] > pr[1])) fail(label + ': the pair must be (big, small)');
      });
      if (set[0].join() === set[1].join()) fail(label + ': the two pairs are the same');
      const mine = [];
      cards.forEach(function(c){
        const v = c.op === 'join' ? c.big + c.small : c.big - c.small;
        bins.concat([v + 7]).forEach(function(bv){ const j = D.sortJudge(c, bv), w = bv === v ? 'ok' : c.op; if (j !== w) fail(label + ': sortJudge() puts ' + c.op + ' ' + c.big + '/' + c.small + ' in ' + bv + '° as ' + j + ', expected ' + w); });
        if (D.sortValue(c) !== v) fail(label + ': ' + c.op + ' ' + c.big + '/' + c.small + ' gives ' + D.sortValue(c) + ', expected ' + v);
        mine.push(v);
        /* 顏色：30、60 是橘色那一片，45 是藍色那一片，90 是另一個角不在的那一片 */
        const pieceOf = function(x, other){ return (x === 30 || x === 60) ? 0 : (x === 45 ? 1 : ((other === 30 || other === 60) ? 1 : 0)); };
        const want = [pieceOf(c.big, c.small), pieceOf(c.small, c.big)];
        if (c.pc.join() !== want.join()) fail(label + ': the colours of ' + c.big + '/' + c.small + ' are pieces ' + c.pc + ', expected ' + want);
        if (c.pc[0] === c.pc[1]) fail(label + ': both angles of a card come from one set square');
        /* 讀圖：並排 ＝ 第二塊從第一塊的邊開始；疊 ＝ 兩塊都從 0 開始 */
        const svg = D.sortCardSVG(c, G.sw, G.sh);
        const secs = [...svg.matchAll(/<path class="gs-[ab]" d="([^"]+)" fill="([^"]+)" stroke="([^"]+)"/g)].map(function(m){ return { a:sectorAnglesRef(m[1]), stroke:m[3] }; });
        if (secs.length !== 2 || !secs[0].a || !secs[1].a) { fail(label + ': cannot read the two angles on the ' + c.op + ' card'); return; }
        const ok = c.op === 'join'
          ? Math.abs(secs[0].a.from) < 0.05 && Math.abs(secs[0].a.span - c.big) < 0.05 && Math.abs(secs[1].a.from - c.big) < 0.05 && Math.abs(secs[1].a.span - c.small) < 0.05
          : Math.abs(secs[0].a.from) < 0.05 && Math.abs(secs[0].a.span - c.big) < 0.05 && Math.abs(secs[1].a.from) < 0.05 && Math.abs(secs[1].a.span - c.small) < 0.05;
        if (!ok) fail(label + ': the ' + c.op + ' card of ' + c.big + '/' + c.small + ' is not drawn as a ' + c.op);
        if (secs[0].stroke !== (want[0] === 0 ? '#E8871E' : '#3B7DD8') || secs[1].stroke !== (want[1] === 0 ? '#E8871E' : '#3B7DD8')) fail(label + ': a wedge on a card is not drawn in its set square\'s colour');
        ['zh', 'en'].forEach(function(lang){
          const d = I18N[lang];
          const s = c.op === 'join' ? d.gSortJoin(c.big, c.small, v) : d.gSortLay(c.big, c.small, v);
          if (digitsOf(s).join() !== [c.big, c.small, v].join()) fail(label + ' (' + lang + '): the ' + c.op + ' reason reads ' + digitsOf(s));
          narrated.push([lang, 'gSort', s]);
          narrated.push([lang, 'gSort2', d.gSort2(d.gSortPos[0], c.op === 'join', c.big, c.small, v)]);
        });
      });
      if (JSON.stringify(bins) !== JSON.stringify([...new Set(mine)].sort(function(a, b){ return a - b; }))) fail(label + ': the boxes are ' + bins + ', expected ' + mine);
      /* 陷阱一定在：同一組的另一種擺法的度數一定有盒子 */
      set.forEach(function(pr){ if (bins.indexOf(pr[0] + pr[1]) < 0 || bins.indexOf(pr[0] - pr[1]) < 0) fail(label + ': reading ' + pr.join('/') + ' the wrong way has no box to land in, so the trap is gone'); });
      const n = bins.length, boxes = [];
      bins.forEach(function(v, i){ boxes.push({ l:D.sortBinX(i, n), r:D.sortBinX(i, n) + G.binW, t:G.binY, b:G.binY + G.binH, n:'box ' + v }); });
      for (let j = 0; j < 4; j++) boxes.push(boxOf(G.cardX[j % 2], G.cardY[Math.floor(j / 2)], G.card.w, G.card.h, 'card ' + j));
      layoutProblems(label, boxes, G.W, G.H).forEach(fail);
      const most = Math.max.apply(null, bins.map(function(v){ return mine.filter(function(x){ return x === v; }).length; }));
      if (G.binLbl + 6 + (most - 1) * G.mini.dy + G.mini.h + 18 > G.binH) fail(label + ': ' + most + ' cards do not fit in one box');
      if (G.binW < G.mini.w) fail('sort: a box is narrower than a card inside it');
    });
    need('sort', /var cards = shuffle\(all, function\(c\)\{ return bins\.indexOf\(sortValue\(c\)\); \}\);/, 'the cards must be shuffled against the box order');
    need('sort', /var b = nearestOpen\(boxes, pt, GAME_PAD\);\s*if \(!b\) return false;/, 'a drop away from every box must bounce silently');
    need('sort', /res = sortJudge\(c, b\.v\);\s*if \(res !== 'ok'\)\{/, 'a card must only go into the box for the angle it makes');
    noEarlyAccept('sort', /sort: function\(d\)\{[\s\S]*?useTapSelect\(B, function\(P, pt\)\{/, /sortJudge\(/, ['lock(', 'return true', 'left--']);
  }

  /* ---------- 第 4 關：對角 ---------- */
  {
    const G = D.OPP_G;
    [G.badge.w, G.badge.h, G.hit].forEach(function(s){ if (s < 40) fail('opp: a tap target side is ' + s); });
    if (G.badge.h < 40 || G.hit < TOUCH_MIN_REF) fail('opp: the corner tap targets are too small');
    ['para', 'rhomb'].forEach(function(kind){
      if (!D.GAME_OPP[kind] || D.GAME_OPP[kind].length < 3) fail('opp: the ' + kind + ' pool is too small');
      D.GAME_OPP[kind].forEach(function(e, k){
        const label = 'opp ' + kind + ' ' + k, pl = D.oppPlace(e);
        if ((kind === 'rhomb') !== (e.w === e.h)) fail(label + ': a ' + kind + ' must have ' + (kind === 'rhomb' ? 'equal' : 'unequal') + ' sides');
        if (e.a === RIGHT_REF || Math.abs(e.a - (STRAIGHT_REF - e.a)) < 20) fail(label + ': ' + e.a + '° and its neighbour must look clearly different');
        const ang = pl.pts.map(function(p, i){ return cornerDegRef(pl.pts[(i + 3) % 4], p, pl.pts[(i + 1) % 4]); });
        ang.forEach(function(a, i){ if (Math.abs(a - pl.corners[i].deg) > 0.01) fail(label + ': corner ' + i + ' is drawn ' + a.toFixed(2) + '° but labelled ' + pl.corners[i].deg + '°'); });
        if (Math.abs(ang[0] - ang[2]) > 0.01 || Math.abs(ang[1] - ang[3]) > 0.01) fail(label + ': the angles diagonally across are not drawn equal');
        if (Math.abs(ang[0] - ang[1]) < 15) fail(label + ': neighbouring corners look alike, the picture does not tell the twin apart');
        const kn = pl.known;
        if (kn.length !== 2 || (kn[1] - kn[0] + 4) % 4 !== 1) fail(label + ': the two measured corners must be neighbours');
        /* 照規則：每一個量好的角配每一個「?」—— 只有斜對面那一個收；兩次一定配得完 */
        const unk = [0, 1, 2, 3].filter(function(i){ return kn.indexOf(i) < 0; });
        let goods = 0;
        kn.forEach(function(a){ unk.forEach(function(u){
          const across = (Math.abs(u - a) === 2);
          if (D.oppJudge(a, u) !== (across ? 'ok' : 'next')) fail(label + ': oppJudge(' + a + ', ' + u + ') is ' + D.oppJudge(a, u));
          if (across) goods++;
          ['zh', 'en'].forEach(function(lang){
            const d = I18N[lang];
            if (across){ narrated.push([lang, 'gOppOk', d.gOppOk(pl.corners[a].deg)]); return; }
            const s = d.gOppNo(pl.corners[a].deg, pl.corners[(u + 2) % 4].deg);
            if (digitsOf(s).join() !== [ang[a], ang[(u + 2) % 4]].map(Math.round).join()) fail(label + ' (' + lang + '): the reason reads ' + digitsOf(s));
            narrated.push([lang, 'gOppNo', s]);
          });
        }); });
        if (goods !== 2) fail(label + ': ' + goods + ' correct pairs, expected 2');
        ['zh', 'en'].forEach(function(lang){
          const d = I18N[lang];
          kn.forEach(function(a){ narrated.push([lang, 'gOpp2', d.gOpp2(pl.corners[a].deg, d.cornerName[a], d.cornerName[(a + 2) % 4])]); });
        });
        const boxes = [];
        pl.corners.forEach(function(c){ boxes.push(boxOf(c.lx, c.ly, G.badge.w, G.badge.h, 'badge ' + c.i)); boxes.push(boxOf(c.x, c.y, G.hit, G.hit, 'corner ' + c.i)); });
        layoutProblems(label, boxes, G.W, G.H, function(a, b){ return a.n.slice(-1) === b.n.slice(-1); }).forEach(fail);
      });
    });
    need('opp', /if \(oppJudge\(kn\.c\.i, un\.c\.i\) !== 'ok'\)\{\s*roundMiss\(d\.gOppNo\(/, 'only the corner diagonally across may take a measured angle');
    noEarlyAccept('opp', /function tapSpot\(s\)\{/, /oppJudge\(/, ['.done = true', 'matched++', 'links.push']);
    need('opp', /if \(!sel \|\| sel === s \|\| sel\.known === s\.known\)\{/, 'two measured corners (or two "?") tapped in a row must just change the selection');
    need('opp', /el\.addEventListener\('click', function\(\)\{ if \(gen === gGen\) tapSpot\(s\); \}\);/, 'the badge and the drawn corner must both be tap targets, guarded by the board generation');
  }

  /* ---------- 第 5 關：切一刀 ---------- */
  {
    const G = D.CUT_G;
    if (G.knob < TOUCH_MIN_REF) fail('cut: the handle is ' + G.knob + ' (< ' + TOUCH_MIN_REF + ')');
    const labels = D.cutLabels();
    if (labels.join() !== '10,20,30,40,50,60,70,80') fail('cut: the printed scale is ' + labels.join(','));
    /* 第二套 cutPick：數字的牌子上 → 那個數字；其他地方 → 方向四捨五入到 5° */
    function pickRef(x, y){
      for (let t = 10; t <= 80; t += 10){
        const cx = G.vx + G.lblR * Math.cos(t * Math.PI / 180), cy = G.vy + G.lblR * Math.sin(t * Math.PI / 180);
        if (Math.abs(x - cx) <= G.lblW / 2 && Math.abs(y - cy) <= G.lblH / 2) return t;
      }
      /* 只有長方形（四邊各放寬一點）裡面是切線的地方 —— 寫死的第二份邊界：左上 (40, 30)、236 × 216、放寬 8 */
      if (x < 32 || x > 284 || y < 22 || y > 254) return null;
      const dx = x - G.vx, dy = y - G.vy;
      if (Math.hypot(dx, dy) < G.minR) return null;
      let th = Math.atan2(dy, dx) * 180 / Math.PI;
      if (th < -90) th = 90;
      th = Math.min(90, Math.max(0, th));
      return 5 * Math.round(th / 5);
    }
    /* 每一個整數點都比（不只偶數點），長方形四邊各放寬 8 這一條也釘住（codex 第二輪：edge 改成 9 偶數格掃不到） */
    for (let x = 20; x <= 296; x++) for (let y of [20, 21, 22, 23, 253, 254, 255, 256]) if (D.cutPick(x, y) !== pickRef(x, y)) fail('cut: cutPick(' + x + ', ' + y + ') near the top/bottom edge is ' + D.cutPick(x, y) + ', expected ' + pickRef(x, y));
    for (let y = 20; y <= 258; y++) for (let x of [30, 31, 32, 33, 283, 284, 285, 286]) if (D.cutPick(x, y) !== pickRef(x, y)) fail('cut: cutPick(' + x + ', ' + y + ') near the left/right edge is ' + D.cutPick(x, y) + ', expected ' + pickRef(x, y));
    if (G.edge !== 8) fail('cut: the rectangle\'s tap margin is ' + G.edge + ', the second implementation uses 8');
    if (G.vx !== 40 || G.vy !== 30 || G.rw !== 236 || G.rh !== 216) fail('cut: the rectangle moved — update the second implementation\'s bounds');
    [[290, 258], [296, 10], [6, 250], [20, 20], [150, 8], [292, 140]].forEach(function(q){ if (D.cutPick(q[0], q[1]) !== null) fail('cut: tapping the empty board margin at (' + q + ') cuts at ' + D.cutPick(q[0], q[1])); });
    let bad = 0;
    for (let x = 0; x <= G.W; x += 2) for (let y = 0; y <= G.H; y += 2) if (D.cutPick(x, y) !== pickRef(x, y)) bad++;
    if (bad) fail('cut: cutPick() disagrees with the second implementation at ' + bad + ' points');
    /* 自然動作：每一個印出來的數字，中心和 ±35% 都是那個數字；每一根刻度上都是那一格 */
    labels.forEach(function(t){
      const c = D.cutLblXY(t);
      if (Math.abs(Math.atan2(c.y - G.vy, c.x - G.vx) * 180 / Math.PI - t) > 0.01) fail('cut: the number ' + t + ' is not printed at ' + t + '° from the top side');
      [[0, 0], [0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35], [0.35, 0.35], [-0.35, -0.35]].forEach(function(f){
        const got = D.cutPick(c.x + f[0] * G.lblW, c.y + f[1] * G.lblH);
        if (got !== t) fail('cut: tapping the printed ' + t + ' at ' + f + ' cuts at ' + got);
      });
      labels.forEach(function(u){ if (u > t){ const q = D.cutLblXY(u); if (boxesOverlap(boxOf(c.x, c.y, G.lblW, G.lblH, ''), boxOf(q.x, q.y, G.lblW, G.lblH, ''))) fail('cut: the printed ' + t + ' and ' + u + ' overlap'); } });
      if (!(c.x - G.lblW / 2 > G.vx && c.y - G.lblH / 2 > G.vy && c.x + G.lblW / 2 < G.vx + G.rw && c.y + G.lblH / 2 < G.vy + G.rh)) fail('cut: the printed ' + t + ' is not inside the rectangle');
    });
    const svg0 = D.cutSVG(25);
    const ticks = [...svg0.matchAll(/<line class="gx-tick" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map(function(m){ return { x1:+m[1], y1:+m[2], x2:+m[3], y2:+m[4] }; });
    if (ticks.length !== 17) fail('cut: ' + ticks.length + ' ticks drawn, expected 17 (5° to 85°)');
    ticks.forEach(function(l){
      const t = Math.round(Math.atan2(l.y1 - G.vy, l.x1 - G.vx) * 180 / Math.PI);
      if (t % 5 !== 0) fail('cut: a tick is drawn at ' + t + '°');
      if (D.cutPick((l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2) !== t) fail('cut: dropping on the ' + t + '° tick cuts elsewhere');
    });
    /* 每一刀：切線碰到長方形的邊；兩塊照度數畫 */
    for (let t = 5; t < 90; t += 5){
      const svg = D.cutSVG(t);
      const cl = /<line class="gx-cut" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/.exec(svg);
      if (!cl) { fail('cut: no cut line at ' + t); continue; }
      const x2 = +cl[3], y2 = +cl[4];
      const onRight = Math.abs(x2 - (G.vx + G.rw)) < 0.05 && y2 <= G.vy + G.rh + 0.05, onBottom = Math.abs(y2 - (G.vy + G.rh)) < 0.05 && x2 <= G.vx + G.rw + 0.05;
      if (!onRight && !onBottom) fail('cut: the cut at ' + t + ' does not end on the rectangle');
      if (Math.abs(Math.atan2(y2 - G.vy, x2 - G.vx) * 180 / Math.PI - t) > 0.05) fail('cut: the cut line for ' + t + ' points at the wrong angle');
      const wa = /<path class="gx-a" d="([^"]+)"/.exec(svg), wb = /<path class="gx-b" d="([^"]+)"/.exec(svg);
      const A = wa && sectorAnglesRef(wa[1]), Bq = wb && sectorAnglesRef(wb[1]);
      if (!A || !Bq || Math.abs(A.span - t) > 0.05 || Math.abs(Bq.span - (90 - t)) > 0.05) fail('cut: at ' + t + ' the orange / blue pieces are not drawn ' + t + '° / ' + (90 - t) + '°');
      const k = { x:D.polarX(G.vx, -t, G.knobR), y:D.polarY(G.vy, -t, G.knobR) };
      if (k.x - G.knob / 2 < 0 || k.y - G.knob / 2 < 0 || k.x + G.knob / 2 > G.W || k.y + G.knob / 2 > G.H) fail('cut: the handle at ' + t + ' sticks out of the board');
      if (D.cutPick(k.x, k.y) !== t) fail('cut: the handle at ' + t + ' does not read ' + t);
    }
    D.GAME_CUT.forEach(function(pr, k){
      const label = 'cut pool ' + k, tO = pr[0], tB = 90 - pr[1];
      if (pr[0] === 45 || pr[1] === 45) fail(label + ': 45° reads the same both ways, so it cannot show the subtraction');
      if (tO === tB) fail(label + ': both cuts are at the same place');
      if (tO % 10 === 0 && tB % 10 === 0) fail(label + ': both cuts are on printed numbers — one must need the 5° ticks');
      [tO, tB].forEach(function(t){ if (t < 5 || t > 85 || t % 5) fail(label + ': a cut at ' + t + ' is off the scale'); });
      ['zh', 'en'].forEach(function(lang){
        const d = I18N[lang];
        narrated.push([lang, 'gCutOk', d.gCutOk(tO, 90 - tO)]);
        narrated.push([lang, 'gCutOk', d.gCutOk(tB, 90 - tB)]);
        narrated.push([lang, 'gCutSwapO', d.gCutSwapO(90 - pr[0], pr[0])]);
        narrated.push([lang, 'gCutSwapB', d.gCutSwapB(pr[1], 90 - pr[1])]);
        narrated.push([lang, 'gCutNoO', d.gCutNoO(tB, pr[0])]);
        narrated.push([lang, 'gCutNoB', d.gCutNoB(tO, 90 - tO, pr[1])]);
        narrated.push([lang, 'gCutO2', d.gCutO2(pr[0])]);
        narrated.push([lang, 'gCutB2', d.gCutB2(pr[1], 90 - pr[1])]);
        if (digitsOf(d.gCutSwapB(pr[1], 90 - pr[1])).join() !== [pr[1], pr[1], 90, pr[1], 90 - pr[1]].join()) fail(label + ' (' + lang + '): the swapped-reading reason reads ' + digitsOf(d.gCutSwapB(pr[1], 90 - pr[1])));
        if (digitsOf(d.gCutAskO(pr[0], 1, 2)).pop() !== pr[0] || digitsOf(d.gCutAskB(pr[1], 2, 2)).pop() !== pr[1]) fail(label + ' (' + lang + '): the order line does not end with the wanted degrees');
      });
    });
    D.GAME_CUT.forEach(function(pr){
      [{ c:'o', v:pr[0] }, { c:'b', v:pr[1] }].forEach(function(o){
        const want = o.c === 'o' ? o.v : 90 - o.v, swap = o.c === 'o' ? 90 - o.v : o.v;
        for (let t = 0; t <= 90; t += 5){
          const w = (t === 0 || t === 90) ? 'zero' : t === want ? 'ok' : t === swap ? 'swap' : 'no';
          if (D.cutJudge(o, t) !== w) fail('cut: cutJudge(' + o.c + ' ' + o.v + ', ' + t + ') is ' + D.cutJudge(o, t) + ', expected ' + w);
        }
      });
    });
    need('cut', /var o = orders\[idx\], t = cur, res = cutJudge\(o, t\);\s*if \(res === 'zero'\)\{ roundInfo\(d\.gCutZero\); return; \}\s*if \(res !== 'ok'\)\{/, 'only the wanted cut is accepted; an uncut corner is a reminder, not a mistake');
    noEarlyAccept('cut', /var go = actionBtn\(row, d\.gCutBtn, function\(\)\{/, /cutJudge\(/, ['idx++', 'roundSolved', 'roundInfo(ok)']);
    need('cut', /knob\.abort\(\);/, 'pressing Cut while another finger turns must judge the released position');
    need('cut', /move: function\(p\)\{ var t = cutPick\(p\.x, p\.y\); if \(t !== null\) setCut\(t\); \}/, 'the cut must snap and show the snapped position while dragging');
  }
}

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 三角板與拼疊：課程頁改壞，走第二份表的參考實作要抓到 --- */
    { file:"index", via:"index", expect:"the set of angles on the two set squares",
      find:"    { id:'a', base:30 },   // 30°／60°／90°",
      replace:"    { id:'a', base:20 },   // 30°／60°／90°",
      why:"a set square would carry an angle that no real set square has" },
    { file:"index", via:"index", expect:"joinDeg is not an addition",
      find:"  function joinDeg(a, b){ return a + b; }",
      replace:"  function joinDeg(a, b){ return a + b + 1; }",
      why:"joining two angles would stop being exactly the two measurements added" },
    { file:"index", via:"index", expect:"layDeg is not a subtraction",
      find:"  function layDeg(big, small){ return big - small; }",
      replace:"  function layDeg(big, small){ return small - big; }",
      why:"the part left showing would come out negative, and this lesson never uses negatives" },
    { file:"index", via:"index", expect:"twoPieceList() does not match the hand-checked set",
      find:"        if (joinDeg(x, y) <= STRAIGHT_DEG) push({ op:'join', a:big, b:small });",
      replace:"        if (joinDeg(x, y) < STRAIGHT_DEG) push({ op:'join', a:big, b:small });",
      why:"180° (90° + 90°) would drop out of the buildable set while the pages still list it" },
    { file:"index", via:"index", expect:"needsMoreList() must be exactly",
      find:"    for (var x = STEP_DEG; x <= STRAIGHT_DEG; x += STEP_DEG) if (!canMakeTwo(x)) out.push(x);",
      replace:"    for (var x = STEP_DEG; x <= STRAIGHT_DEG; x += STEP_DEG) if (!canMakeTwo(x) && x < 165) out.push(x);",
      why:"165° would silently drop out of the exception list while the pages still call it the one exception" },
    { file:"index", via:"index", expect:"minPieces(",
      find:"    if (list.indexOf(target) >= 0) return 1;\n    if (canMakeTwo(target)) return 2;",
      replace:"    if (canMakeTwo(target)) return 2;\n    if (list.indexOf(target) >= 0) return 1;",
      why:"an angle already on a set square would be reported as needing two pieces" },
    { file:"index", via:"index", expect:"combosFor(",
      find:"    crossCombos().forEach(function(c){ if (comboValue(c) === x) out.push(c); });",
      replace:"    crossCombos().forEach(function(c){ if (comboValue(c) !== x) out.push(c); });",
      why:"combosFor() would hand back every method EXCEPT the ones that build the asked angle — twoPieceList() stays correct, so only the combosFor assertion can see it" },
    { file:"index", via:"index", expect:"STEP_DEG must be the largest",
      find:"  var RIGHT_DEG = 90, STRAIGHT_DEG = 180, STEP_DEG = 15;",
      replace:"  var RIGHT_DEG = 90, STRAIGHT_DEG = 180, STEP_DEG = 5;",
      why:"'always a multiple of 15' would become a weaker claim than the page states" },

    /* --- 圖形 --- */
    { file:"index", via:"index", expect:"the four angles are not a, 180-a",
      find:"  function shapeAngles(a){ return [a, STRAIGHT_DEG - a, a, STRAIGHT_DEG - a]; }",
      replace:"  function shapeAngles(a){ return [a, STRAIGHT_DEG - a, STRAIGHT_DEG - a, a]; }",
      why:"the opposite angles would stop being the ones diagonally across" },
    { file:"index", via:"index", expect:"oppositeIndex must pair",
      find:"  function oppositeIndex(i){ return (i + 2) % 4; }",
      replace:"  function oppositeIndex(i){ return (i + 1) % 4; }",
      why:"'opposite' would mean the neighbouring corner, which is this lesson's headline misconception" },
    { file:"index", via:"index", expect:"must have four right angles",
      find:"    { id:'square', a:90, w:150, h:150 },",
      replace:"    { id:'square', a:80, w:150, h:150 },",
      why:"a square would be drawn with corners that are not right angles" },
    { file:"index", via:"index", expect:"wedge span",
      find:"    if (diff <= 180) return { from:d1, to:d1 + diff };",
      replace:"    if (diff <= 180) return { from:d1, to:d1 + diff + 4 };",
      why:"every angle mark would be drawn 4° wider than the angle it marks" },
    { file:"index", via:"index", expect:"right-angle mark",
      find:"    var m = Math.min(MARK_LEN, r);",
      replace:"    var m = Math.min(MARK_LEN, r) * 2.4;",
      why:"the right-angle mark would grow past the arc radius and out over the shape's edges" },
    { file:"index", via:"index", expect:"outside the canvas",
      find:"  var PIECE_LX = [140, 230];     // 三角板的兩種大小（底邊長）",
      replace:"  var PIECE_LX = [140, 520];     // 三角板的兩種大小（底邊長）",
      why:"the larger set square would be drawn wider than the canvas" },
    { file:"index", via:"index", expect:"margin",
      find:"  var ARM_LEN = 190;             // 角的邊",
      replace:"  var ARM_LEN = 226;             // 角的邊",
      why:"the arms of the joined angle would reach past the canvas edge" },
    { file:"index", via:"index", expect:"same piece at two sizes",
      find:"    var p = PIECES[pieceIdx], lx = PIECE_LX[sizeIdx];",
      replace:"    var p = { id:PIECES[pieceIdx].id, base:(sizeIdx ? RIGHT_DEG - PIECES[pieceIdx].base : PIECES[pieceIdx].base) }, lx = PIECE_LX[sizeIdx];",
      why:"the large size would be drawn flipped, so the two sizes stop reading as one piece — every angle is still a real set-square angle, so only the same-piece assertion sees it" },

    { file:"index", via:"index", expect:"must cover the fattest thing drawn",
      find:"  var DOT_R = 3.5;               // 頂點上的小圓點",
      replace:"  var DOT_R = 9;                 // 頂點上的小圓點",
      why:"a dot fatter than the margin can cross the canvas edge while its centre — the only thing the bounds check sees — stays inside" },
    { file:"index", via:"index", expect:"the comment scanner cannot be trusted on it",
      find:"  var C_LINE = '#2B2A33', C_A = '#E8871E', C_B = '#3B7DD8',",
      replace:"  var C_TPL = `x`;\n  var C_LINE = '#2B2A33', C_A = '#E8871E', C_B = '#3B7DD8',",
      why:"a template literal is exactly what the comment scanner cannot follow, so the wording checks would stop being trustworthy — it must fail closed, not carry on" },
    { file:"index", via:"index", expect:"large-arc-flag 1",
      find:"    var large = (Math.abs(toDeg - fromDeg) > 180) ? 1 : 0;",
      replace:"    var large = 1;",
      why:"the browser would draw the MAJOR arc while the span check, which reads the two endpoints, stays green — only the flag assertion can see it" },
    { file:"index", via:"index", expect:"sweep flag",
      find:"    var sweep = (toDeg > fromDeg) ? 0 : 1;",
      replace:"    var sweep = (toDeg > fromDeg) ? 1 : 0;",
      why:"the arc would be drawn the other way round the circle, again with an unchanged span" },

    /* --- 切成兩塊 --- */
    { file:"index", via:"index", expect:"the two pieces must add to a right angle",
      find:"    var other = layDeg(RIGHT_DEG, cut);\n    return {\n      cut:cut, other:other, sum:RIGHT_DEG,",
      replace:"    var other = layDeg(STRAIGHT_DEG, cut);\n    return {\n      cut:cut, other:other, sum:RIGHT_DEG,",
      why:"the other piece would be worked out from a straight angle, the exact misconception the lesson names" },
    { file:"index", via:"index", expect:"cut line does not end on the rectangle",
      find:"    var len = Math.min(lenRight, lenDown);",
      replace:"    var len = Math.min(lenRight, lenDown) * 0.6;",
      why:"the cut would stop inside the rectangle instead of reaching the far side" },
    { file:"index", via:"index", expect:"is longer than the shortest arm",
      find:"  var SPLIT_R = 56;              // 切開那一張圖，兩塊扇形的半徑",
      replace:"  var SPLIT_R = 150;             // 切開那一張圖，兩塊扇形的半徑",
      why:"the two coloured pieces would spill out past the rectangle they sit in" },
    { file:"index", via:"index", expect:"S5_CUTS must include 45",
      find:"  var S5_CUTS = [20, 30, 45, 60, 70];",
      replace:"  var S5_CUTS = [20, 30, 60, 70];",
      why:"the 'two equal pieces' case would disappear while the narration still promises it" },

    /* --- 題庫 --- */
    { file:"index", via:"index", expect:"qs[1]",
      find:"合起來是幾度？',\n          opts:['15°','75°','90°','105°'], ans:1,",
      replace:"合起來是幾度？',\n          opts:['15°','75°','90°','105°'], ans:0,",
      why:"the join question would be marked as if joining were a subtraction" },
    { file:"index", via:"index", expect:"qsAdv[1]",
      find:"拼出來或疊出來的？',\n          opts:['15°','105°','50°','150°'], ans:2,",
      replace:"拼出來或疊出來的？',\n          opts:['15°','105°','50°','150°'], ans:3,",
      why:"150° really is buildable (90° + 60°), so marking it unbuildable is a false key" },
    { file:"index", via:"index", expect:"qsBoost[0]",
      find:"          opts:['他沒有錯，三角板越大角度越大','三角板大小不一樣，角度一模一樣 —— 角的大小和邊畫多長沒有關係','大的那一片是 30°，小的那一片其實是 15°','要用量角器量過才知道誰大'], ans:1,",
      replace:"          opts:['他沒有錯，三角板越大角度越大','三角板大小不一樣，角度差不多','大的那一片是 30°，小的那一片其實是 15°','要用量角器量過才知道誰大'], ans:1,",
      why:"the correct option would soften 'exactly the same' into 'about the same'" },
    { file:"index", via:"index", expect:"arithmetic is wrong",
      find:"          why:'拼起來就是<strong>相加</strong>：30° ＋ 45° ＝ <strong>75°</strong>。",
      replace:"          why:'拼起來就是<strong>相加</strong>：30° ＋ 45° ＝ <strong>85°</strong>。",
      why:"an explanation would carry an arithmetic error that no option check can see" },
    { file:"index", via:"index", expect:"the set of verified equations changed",
      find:"（90° ＋ 45° ＝ 135°；45° 疊上 60° 露出 15°",
      replace:"（45° ＋ 90° ＝ 135°；45° 疊上 60° 露出 15°",
      why:"one verified equation is swapped for the same sum written the other way round: it is still correct and the count stays at exactly the same number, and no exact-wording assertion covers that sentence — so only the fingerprint can see it" },

    /* --- 遊戲（2026-10-05 起五關五種玩法；gameChecks()） --- */
    { file:"index", via:"index", expect:"the extra card",
      find:"  function pieceDecoy(p){ return p === 0 ? 45 : 60; }",
      replace:"  function pieceDecoy(p){ return p === 0 ? 30 : 60; }",
      why:"the extra card in round 1 would be a real corner of the same piece, so two cards fit one corner" },
    { file:"index", via:"index", expect:"is not turned or flipped",
      find:"    { p:0, rot:90, flip:false }, { p:0, rot:180, flip:false },",
      replace:"    { p:0, rot:0, flip:false }, { p:0, rot:180, flip:false },",
      why:"the big piece would sit exactly like the small one, so the round tests copying by position, not reading the angle" },
    { file:"index", via:"index", expect:"points on the drawn",
      find:"zone:64, zoneIn:14,",
      replace:"zone:64, zoneIn:44,",
      why:"dropping a card ON the drawn corner (its vertex) would no longer count — the accept box would sit away from what the child sees" },
    { file:"index", via:"index", expect:"the game calls it",
      find:"    return d < others[0] ? 'min' : 'max';",
      replace:"    return d < others[0] ? 'max' : 'min';",
      why:"the reason for a wrong card would call the 30° corner 'not the sharpest' and the 60° corner 'the sharpest'" },
    { file:"index", via:"index", expect:"pieceJudge(",
      find:"  function pieceJudge(v, deg){ return v === deg ? 'ok' : 'miss'; }",
      replace:"  function pieceJudge(v, deg){ return v === deg || v === 45 ? 'ok' : 'miss'; }",
      why:"the 45° decoy would fit any corner of the 30/60/90 piece" },
    { file:"index", via:"index", expect:"early accept",
      find:"        var v = P.data.deg, c = s.c;\n",
      replace:"        var v = P.data.deg, c = s.c;\n        if (v === pieceDecoy(e.p)){ s.done = true; P.lock(c.lx, c.ly); return true; }\n",
      why:"an early branch before the judge would accept the decoy card — the pinned judge line itself stays intact" },
    { file:"index", via:"index", expect:"listed as",
      find:"  var GAME_JOIN = { trap:[120, 135, 150], plain:[75, 105, 180] };",
      replace:"  var GAME_JOIN = { trap:[120, 135, 105], plain:[75, 150, 180] };",
      why:"a round could get two orders without the same-piece trap" },
    { file:"index", via:"index", expect:"by pieceHas()",
      find:"  function pieceHas(p, need){ return pieceAngles(PIECES[p]).indexOf(need) >= 0; }",
      replace:"  function pieceHas(p, need){ return pieceAngleList().indexOf(need) >= 0; }",
      why:"the first-corner check would look on BOTH set squares, so a corner whose only partner is on its own piece would be accepted" },
    { file:"index", via:"index", expect:"joinInGap() disagrees",
      find:"    if (r <= G.inR) return true;\n",
      replace:"",
      why:"a corner put right on the vertex (the natural place to put an angle) would be refused" },
    { file:"index", via:"index", expect:"joinJudge()",
      find:"    if (p === placed[0].p) return 'same';\n",
      replace:"",
      why:"60° + 90° from the 30/60/90 piece would build 150° — two corners of one physical piece" },
    { file:"index", via:"index", expect:"early accept",
      find:"          var v = P.data.deg, p = P.data.p, res = joinJudge(W, placed, p, v);\n",
      replace:"          var v = P.data.deg, p = P.data.p;\n          if (placed.length === 1 && placed[0].deg + v === W){ placed.push({ p:p, deg:v }); P.lock(P.homeX, P.homeY); return true; }\n          var res = joinJudge(W, placed, p, v);\n",
      why:"an early branch would accept any second corner with the right sum, same piece or not, before joinJudge() runs" },
    { file:"index", via:"index", expect:"early accept",
      find:"          if (res === 'big'){ roundMiss(d.gJoinBig(v, W)); return false; }\n",
      replace:"          if (res === 'same'){ placed.push({ p:p, deg:v }); P.lock(P.homeX, P.homeY); return true; }\n          if (res === 'big'){ roundMiss(d.gJoinBig(v, W)); return false; }\n",
      why:"a branch AFTER joinJudge() but before the final gate would accept a same-piece corner (codex round 2)" },
    { file:"index", via:"index", expect:"cutPick(",
      find:"knobR:96, knob:48, wedgeR:82, minR:20, step:5, edge:8 };",
      replace:"knobR:96, knob:48, wedgeR:82, minR:20, step:5, edge:9 };",
      why:"the rectangle's tap margin would widen by one pixel — only an every-integer scan sees it (codex round 2)" },
    { file:"index", via:"index", expect:"side by side",
      find:"      lo += q.deg;\n",
      replace:"      lo += 0;\n",
      why:"the second corner would be drawn on top of the first instead of beside it" },
    { file:"index", via:"index", expect:"gives",
      find:"  function sortValue(c){ return c.op === 'join' ? joinDeg(c.big, c.small) : layDeg(c.big, c.small); }",
      replace:"  function sortValue(c){ return c.op === 'join' ? joinDeg(c.big, c.small) : joinDeg(c.big, c.small); }",
      why:"a laid card would be filed under the sum — exactly the misconception the round exists to catch" },
    { file:"index", via:"index", expect:"is not drawn as a lay",
      find:"      s += gSector('gs-b', cx, cy, r * 0.82, 0, c.small, pieceFill(c.pc[1]), pieceStroke(c.pc[1]));",
      replace:"      s += gSector('gs-b', cx, cy, r * 0.82, c.big, c.big + c.small, pieceFill(c.pc[1]), pieceStroke(c.pc[1]));",
      why:"a 'lay' card would be drawn side by side, so the picture contradicts the answer" },
    { file:"index", via:"index", expect:"the colours of",
      find:"    return [pb, ps];",
      replace:"    return [ps, pb];",
      why:"a 45° wedge would be painted in the 30/60/90 piece's colour" },
    { file:"index", via:"index", expect:"the two pairs are the same",
      find:"    [[45, 30], [60, 45]], [[90, 45], [90, 30]], [[90, 60], [45, 30]],",
      replace:"    [[45, 30], [60, 45]], [[90, 45], [90, 45]], [[90, 60], [45, 30]],",
      why:"a set would show the same two angles twice" },
    { file:"index", via:"index", expect:"sortJudge()",
      find:"  function sortJudge(c, binV){ return sortValue(c) === binV ? 'ok' : c.op; }",
      replace:"  function sortJudge(c, binV){ return sortValue(c) === binV || joinDeg(c.big, c.small) === binV ? 'ok' : c.op; }",
      why:"a laid card would also be accepted in the box of the sum" },
    { file:"index", via:"index", expect:"must be neighbours",
      find:"    return { pts:pts, angles:angles, known:[e.known, (e.known + 1) % 4], corners:pts.map(function(pt, i){",
      replace:"    return { pts:pts, angles:angles, known:[e.known, (e.known + 2) % 4], corners:pts.map(function(pt, i){",
      why:"the two measured corners would be a diagonal pair, so the '?' corners have no measured twin" },
    { file:"index", via:"index", expect:"look clearly different",
      find:"    para:[ { a:60, w:130, h:96, known:0 },",
      replace:"    para:[ { a:85, w:130, h:96, known:0 },",
      why:"85° and 95° look alike, so the picture would not tell the diagonal twin apart" },
    { file:"index", via:"index", expect:"oppJudge(",
      find:"  function oppJudge(k, u){ return u === oppositeIndex(k) ? 'ok' : 'next'; }",
      replace:"  function oppJudge(k, u){ return u !== k ? 'ok' : 'next'; }",
      why:"the neighbouring corner would take the measured angle" },
    { file:"index", via:"index", expect:"cutPick() disagrees",
      find:"    if (hit !== null) return hit;\n",
      replace:"",
      why:"tapping the edge of a printed number would round to the neighbouring 5°" },
    { file:"index", via:"index", expect:"empty board margin",
      find:"    if (x < G.vx - G.edge || x > G.vx + G.rw + G.edge || y < G.vy - G.edge || y > G.vy + G.rh + G.edge) return null;\n",
      replace:"",
      why:"tapping the blank margin outside the rectangle would be turned into a cut (codex round 1)" },
    { file:"index", via:"index", expect:"is not printed at",
      find:"  function cutLblXY(t){ return { x:CUT_G.vx + CUT_G.lblR * Math.cos(toRad(t)), y:CUT_G.vy + CUT_G.lblR * Math.sin(toRad(t)) }; }",
      replace:"  function cutLblXY(t){ return { x:CUT_G.vx + CUT_G.lblR * Math.cos(toRad(t + 3)), y:CUT_G.vy + CUT_G.lblR * Math.sin(toRad(t + 3)) }; }",
      why:"the numbers would drift 3° off their ticks" },
    { file:"index", via:"index", expect:"cutJudge(",
      find:"  function cutWant(o){ return o.c === 'o' ? o.v : layDeg(RIGHT_DEG, o.v); }",
      replace:"  function cutWant(o){ return o.v; }",
      why:"the blue order would accept the cut at Y — reading the scale from the wrong side" },
    { file:"index", via:"index", expect:"45° reads the same",
      find:"  var GAME_CUT = [[25, 30],",
      replace:"  var GAME_CUT = [[25, 45],",
      why:"45° reads the same from either side, so it cannot show the subtraction" },
    { file:"index", via:"index", expect:"both cuts are on printed numbers",
      find:"[35, 20], [20, 65]",
      replace:"[30, 20], [20, 65]",
      why:"neither cut would need the 5° ticks" },
    { file:"index", via:"index", expect:"does not end on the rectangle",
      find:"    return Math.min(G.rw / Math.cos(toRad(t)), G.rh / Math.sin(toRad(t)));",
      replace:"    return Math.min(G.rw / Math.cos(toRad(t)), G.rh / Math.sin(toRad(t))) * 0.9;",
      why:"the cut line would stop short of the far side" },
    { file:"index", via:"index", expect:"already in answer order",
      find:"    if (up && !same) a.push(a.shift());\n",
      replace:"    a.sort(function(x, y){ return kf(x) - kf(y); });\n",
      why:"the sort tray would start in box order" },
    { file:"index", via:"index", expect:"array order is not nearness",
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"if (!best){ bd = dd; bc = dc; best = b; }",
      why:"a drop in the overlap of two boxes would go to the first box in the array" },
    { file:"index", via:"index", expect:"the \"−5\" note is",
      find:"    var lost = gScore >= 5 ? 5 : 0;",
      replace:"    var lost = 5;",
      why:"at 0 points the game would still say −5" },
    { file:"index", via:"index", expect:"generation guard",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
      replace:"",
      why:"a card still held across Restart would act on the new board" },
    { file:"index", via:"index", expect:"lost pointer capture",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"",
      why:"a lost capture would leave a card stuck mid-drag" },
    { file:"index", via:"index", expect:"gJoinNo reads",
      find:"(s > w ? '多' : '少') + ' ' + Math.abs(w - s) + '°。'",
      replace:"(s > w ? '多' : '少') + ' ' + Math.abs(w - s + 5) + '°。'",
      why:"the 'how far off' number in the join reason would be wrong" },
    { file:"index", via:"index", expect:"the reason reads",
      find:"      gOppNo:function(kd, od){ return '那個角在 ' + kd + '° 的旁邊",
      replace:"      gOppNo:function(kd, od){ return '那個角在 ' + od + '° 的旁邊",
      why:"the opposite-angle reason would name the wrong measured corner" },
    { file:"index", via:"index", expect:"arithmetic is wrong",
      find:"藍色那一塊是 90° － ' + v + '° ＝ ' + t + '°。'; },",
      replace:"藍色那一塊是 90° － ' + v + '° ＝ ' + (t + 10) + '°。'; },",
      why:"a cut reason would carry a wrong subtraction" },
    { file:"index", via:"index", expect:"a degree card side is",
      find:"card:{ w:58, h:48 }, trayY:424,",
      replace:"card:{ w:40, h:48 }, trayY:424,",
      why:"the degree cards would be under the 44px phone touch size" },
    { file:"index", via:"index", expect:"overlaps",
      find:"card:{ w:58, h:48 }, trayY:424,",
      replace:"card:{ w:58, h:48 }, trayY:330,",
      why:"the tray would sit on top of the big set square" },
    { file:"index", via:"index", expect:"ahead mode must show",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }   /* 超前模式：自動給第一層提示 */",
      replace:"    if (mode === 'ahead'){ hintLevel = 1; }",
      why:"ahead mode would stop showing the first hint" },
    { file:"index", via:"index", expect:"every corner of both pieces",
      find:"          pieceAngles(PIECES[p]).forEach(function(v, j){\n            addPiece(",
      replace:"          pieceAngleSet(PIECES[p]).forEach(function(v, j){\n            addPiece(",
      why:"the tray would show only distinct angles, dropping a physical 45° corner" },

    /* --- 旁白 --- */
    { file:"index", via:"index", expect:"missing space between Chinese and a digit",
      find:"      s2result:function(t){ return '拼出來的角是 ' + t + '°'; },",
      replace:"      s2result:function(t){ return '拼出來的角是' + t + '°'; },",
      why:"Chinese glued to a digit is only visible once the sentence is rendered" },
    { file:"index", via:"index", expect:"example 5 narration",
      find:"      s5calc:function(cut, other){ return '90° － ' + cut + '° ＝ ' + other + '°'; },",
      replace:"      s5calc:function(cut, other){ return '180° － ' + cut + '° ＝ ' + other + '°'; },",
      why:"the calculation line would subtract from a straight angle while the answer stays right" },
    { file:"index", via:"index", expect:"example 4 narration",
      find:"        return '<strong>' + name + '</strong>的角不是直角：橘色那一組對角都是 <strong>' + a + '°</strong>，藍色那一組對角都是 <strong>' + b + '°</strong>。",
      replace:"        return '<strong>' + name + '</strong>的角不是直角：橘色那一組對角都是 <strong>' + b + '°</strong>，藍色那一組對角都是 <strong>' + a + '°</strong>。",
      why:"the two colours would be described the wrong way round while both numbers stay on the page" },

    /* --- 措辭與範圍（別頁） --- */
    { file:"index", via:"index", expect:"KEY: index.html s5note no longer says",
      find:"所以量了一塊，用<strong>減法</strong>就算得出另一塊：長方形的角是 90°，另一塊就是 <strong>90° － 量到的那一塊</strong>。',",
      replace:"所以量了一塊，用<strong>算式</strong>就算得出另一塊：長方形的角是 90°，另一塊就是 <strong>90° － 量到的那一塊</strong>。',",
      why:"the rule would stop naming subtraction inside the very note that teaches it — '減法' is pinned to that i18n key, not just counted across the file" },
    { file:"index", via:"index", expect:"SIBLING",
      find:"      s1note:'💬 三角板<strong>畫得大一點，角度一模一樣</strong> —— 這和「角度大搜查」教過的一樣：<strong>角的大小和邊畫多長沒有關係</strong>。",
      replace:"      // 角的大小和邊畫多長沒有關係\n      s1note:'💬 三角板<strong>畫得大一點，角度一模一樣</strong> —— 這和「角度大搜查」教過的一樣：<strong>角的張開程度和邊畫多長沒有關係</strong>。",
      why:"the rule is deleted from the lesson text and pasted into a JS line comment — the comment scanner must strip it, so the pinned count still drops" },
    { file:"reference", via:"index", expect:"SIBLING",
      find:"      f2:'兩片各出一個角做出來的角一定是 <strong>15 的倍數</strong>",
      replace:"      f2:'兩片各出一個角做出來的角一定是 <strong>五度的倍數</strong>",
      why:"the cheat sheet would state a weaker rule than the lesson's, and the pinned wording count drops" },
    { file:"reference", via:"index", expect:"PAIRED",
      find:"      s3note:'⚠️ The reverse is <strong>not</strong> true",
      replace:"      s3note:'⚠️ Also worth knowing<strong>:</strong> ",
      why:"the English cheat sheet would state the multiple-of-15 rule with no note that the converse fails" },
    { file:"parents", via:"index", expect:"FORBIDDEN",
      find:"      mis4:'把平行四邊形「旁邊」那個角當成一樣大',",
      replace:"      mis4:'旁邊那一個角也一樣大',",
      why:"a false claim would appear as if it were the lesson's own wording" },
    { file:"parents", via:"index", expect:"HANDOFF",
      find:"      s5note:'⚠️ 這一課刻意<strong>不教</strong>：<strong>內角和</strong>（三角形三個角加起來 180°、多邊形 (n－2)×180° 都在五年級的「角度偵探」與「多邊形轉轉盤」）",
      replace:"      s5note:'⚠️ 這一課也順便算<strong>內角和</strong>（三角形三個角加起來 180°、多邊形 (n－2)×180°）",
      why:"the lesson would start teaching the interior-angle sum, which belongs to grade 5" },
    { file:"index", via:"index", expect:"creates an SVG <text>",
      find:"  function drawDot(svg, x, y){\n    svg.appendChild(svgEl('circle', { cx:x, cy:y, r:DOT_R, fill:C_DOT }));",
      replace:"  function drawDot(svg, x, y){\n    svg.appendChild(svgEl('text', { x:x, y:y }));\n    svg.appendChild(svgEl('circle', { cx:x, cy:y, r:DOT_R, fill:C_DOT }));",
      why:"text in the SVG is the one defect class this lesson's drawing decisions rule out" },
    { file:"reference", via:"index", expect:"must not draw any SVG",
      find:"  <header>\n    <h1 data-i18n=\"h1\">🗂️ 速查卡：拼角工作坊</h1>",
      replace:"  <svg viewBox=\"0 0 10 10\"><circle cx=\"5\" cy=\"5\" r=\"4\"></circle></svg>\n  <header>\n    <h1 data-i18n=\"h1\">🗂️ 速查卡：拼角工作坊</h1>",
      why:"the cheat sheet is deliberately text-only; an SVG there would reopen the label-clipping defect class" },

    /* --- review.html 的產生器（走 simgen） --- */
    { file:"review", via:"review", expect:"the lay distractor must be the two angles subtracted",
      find:"          var opts = degOpts(v, [gap, v - 5, v + 15, RIGHT_DEG], [a, b]);\n          if (!opts) return null;\n          if (opts.indexOf(gap) < 0) return null;",
      replace:"          var opts = degOpts(v, [v - 5, v + 15, RIGHT_DEG], [a, b]);\n          if (!opts) return null;",
      why:"the 'they subtracted instead' distractor would vanish, so the question would stop testing the join/lay difference" },
    { file:"review", via:"review", expect:"the join distractor must be the two angles added",
      find:"          var opts = degOpts(v, [sum, big, v + 15], [big, small]);\n          if (!opts) return null;\n          if (opts.indexOf(sum) < 0) return null;\n          return { big:big, small:small, v:v, sum:sum, opts:opts, ans:opts.indexOf(v) };",
      replace:"          var opts = degOpts(v, [big, v + 15, v + 20], [big, small]);\n          if (!opts) return null;\n          return { big:big, small:small, v:v, sum:sum + 1, opts:opts, ans:opts.indexOf(v) };",
      why:"the 'they joined instead' distractor would stop being pinned to the sum" },
    { file:"review", via:"review", expect:"opts[ans] != correct",
      find:"  function layDeg(big, small){ return big - small; }\n  function comboValue(c)",
      replace:"  function layDeg(big, small){ return big - small - 5; }\n  function comboValue(c)",
      why:"every subtraction on the review page would be 5° short" },
    { file:"review", via:"review", expect:"is copied straight out of the stem",
      find:"          var opts = degOpts(v, [wrong, v + 10, joinDeg(RIGHT_DEG, cut)], [cut]);",
      replace:"          var opts = degOpts(v, [wrong, cut, joinDeg(RIGHT_DEG, cut)], []);",
      why:"a distractor would just repeat the number printed in the question" },
    { file:"review", via:"review", expect:"exactly one option must reach",
      find:"          seenVal[String(target)] = 1;\n          seenKey[comboKey(good)] = 1;\n          shuffle(all).forEach(function(c){\n            if (bad.length >= 3) return;\n            var v = comboValue(c);\n            if (v === target || seenVal[String(v)] || seenKey[comboKey(c)]) return;",
      replace:"          seenKey[comboKey(good)] = 1;\n          shuffle(all).forEach(function(c){\n            if (bad.length >= 3) return;\n            var v = comboValue(c);\n            if (seenVal[String(v)] || seenKey[comboKey(c)]) return;",
      why:"a second option could build the target angle, so a correct choice could be marked wrong" },
    { file:"review", via:"review", expect:"can be built after all",
      find:"          for (x = 10; x <= 170; x += 5) if (!canMakeTwo(x)) badPool.push(x);",
      replace:"          for (x = 10; x <= 170; x += 5) badPool.push(x);",
      why:"the 'cannot be built' question could pick an angle that two pieces do build" },
    { file:"review", via:"review", expect:"the printed measurement is not that corner",
      find:"          var v = angles[oppositeIndex(corner)];\n          var nb = angles[(corner + 1) % 4];\n          if (v !== angles[corner]) return null;      // 對角一定和它自己一樣大",
      replace:"          var v = angles[(corner + 1) % 4];\n          var nb = angles[oppositeIndex(corner)];",
      why:"the question would print the neighbour's measurement and expect the opposite angle's" },
    { file:"review", via:"review", expect:"piece(s), page says",
      find:"          var v = minPieces(target);\n          if (v < PIECE_MIN || v > PIECE_MAX) return null;",
      replace:"          var v = minPieces(target) + 1;\n          if (v < PIECE_MIN || v > PIECE_MAX) return null;",
      why:"every 'how many pieces' answer would be one too many" },
    { file:"review", via:"review", expect:"the largest angle of a triangle is always more than 60",
      find:"          var deg = pick([61 + rand(29), RIGHT_DEG, RIGHT_DEG + 1 + rand(70)]);",
      replace:"          var deg = pick([35 + rand(30), RIGHT_DEG, RIGHT_DEG + 1 + rand(70)]);",
      why:"a largest angle under 60° describes a triangle that cannot exist, so the question itself would be broken" },
    { file:"review", via:"review", expect:"outside the canvas",
      find:"    lines.push({ x1:v.x, y1:v.y, x2:polarX(v.x, -cut, len), y2:polarY(v.y, -cut, len), w:2 });",
      replace:"    lines.push({ x1:v.x, y1:v.y, x2:polarX(v.x, -cut, len * 2.4), y2:polarY(v.y, -cut, len * 2.4), w:2 });",
      why:"the cut line would run out of the rectangle and off the canvas" },
    { file:"review", via:"review", expect:"wedge is drawn",
      find:"    wedges.push({ tone:'a', deg:cut, r:SPLIT_R, from:0, to:-cut,\n                  d:wedgePath(v.x, v.y, 0, -cut, SPLIT_R) });",
      replace:"    wedges.push({ tone:'a', deg:cut, r:SPLIT_R, from:0, to:-cut,\n                  d:wedgePath(v.x, v.y, 0, -cut - 6, SPLIT_R) });",
      why:"the coloured piece would be drawn 6° wider than the measurement it stands for" },
    { file:"review", via:"review", expect:"figure caption contains a digit",
      find:"      capSplit:'📐 橘色那一塊是量到的，藍色那一塊是剩下的'",
      replace:"      capSplit:'📐 橘色那一塊是量到的 25°，藍色那一塊是剩下的'",
      why:"the caption would print a degree value, and in this generator that is the number being asked about" },
    { file:"review", via:"review", expect:"the two corners drawn in one colour",
      find:"          wedges.push({ tone:(i % 2 === 0) ? 'a' : 'b', deg:angles[i], r:r,",
      replace:"          wedges.push({ tone:(i < 2) ? 'a' : 'b', deg:angles[i], r:r,",
      why:"the two corners sharing a colour would stop being the opposite pair" }
  ],

  /* ================= review.html 的產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      /* 每一支都問：解釋說了什麼，資料就必須是那樣。 */
      pieceOther: function(d){
        if (!d) return 'pieceOther: make() returned nothing';
        const on = PIECE_REF.filter(function(p){ return p.indexOf(d.given) >= 0; });
        if (!on.length) return 'pieceOther: ' + d.given + '° is on neither set square';
        if (d.given + d.want !== RIGHT_REF) return 'pieceOther: the two non-right angles must add to a right angle';
        if (!isDeg(d.want)) return 'pieceOther: the answer is not a whole number of degrees';
        if (ANGLE_SET_REF.indexOf(d.want) < 0) return 'pieceOther: the answer is not a set-square angle';
        return null;
      },
      joinTwo: function(d){
        if (!d) return 'joinTwo: make() returned nothing';
        if (ANGLE_SET_REF.indexOf(d.a) < 0 || ANGLE_SET_REF.indexOf(d.b) < 0)
          return 'joinTwo: an operand is not a set-square angle';
        if (!crossLegalRef({ op:'join', a:Math.max(d.a, d.b), b:Math.min(d.a, d.b) }))
          return 'joinTwo: those two angles need two corners of the same set square';
        if (d.v !== d.a + d.b) return 'joinTwo: the answer is not the two angles added';
        if (d.v > STRAIGHT_REF) return 'joinTwo: the joined angle is over a straight angle';
        if (d.gap !== Math.abs(d.a - d.b) || d.gap <= 0)
          return 'joinTwo: the lay distractor must be the two angles subtracted';
        if (d.opts.indexOf(d.gap) < 0)
          return 'joinTwo: the lay distractor must be the two angles subtracted and offered';
        return null;
      },
      layTwo: function(d){
        if (!d) return 'layTwo: make() returned nothing';
        if (ANGLE_SET_REF.indexOf(d.big) < 0 || ANGLE_SET_REF.indexOf(d.small) < 0)
          return 'layTwo: an operand is not a set-square angle';
        if (!crossLegalRef({ op:'lay', a:d.big, b:d.small }))
          return 'layTwo: those two angles need two corners of the same set square';
        if (!(d.big > d.small)) return 'layTwo: the laid angle must be the smaller one';
        if (d.v !== d.big - d.small) return 'layTwo: the answer is not the part left showing';
        if (d.sum !== d.big + d.small) return 'layTwo: the join distractor must be the two angles added';
        if (d.opts.indexOf(d.sum) < 0)
          return 'layTwo: the join distractor must be the two angles added and offered';
        return null;
      },
      whichCombo: function(d){
        if (!d) return 'whichCombo: make() returned nothing';
        if (d.combos.length !== 4) return 'whichCombo: needs four methods';
        const vals = d.combos.map(function(c){ return c.op === 'join' ? c.a + c.b : c.a - c.b; });
        const hits = vals.filter(function(v){ return v === d.target; }).length;
        if (hits !== 1) return 'whichCombo: exactly one option must reach ' + d.target + '°, found ' + hits;
        if (vals[d.ans] !== d.target) return 'whichCombo: the marked option does not reach the target';
        if (new Set(vals).size !== 4) return 'whichCombo: two options build the same angle';
        for (const c of d.combos){
          if (ANGLE_SET_REF.indexOf(c.a) < 0 || ANGLE_SET_REF.indexOf(c.b) < 0)
            return 'whichCombo: an option uses an angle no set square carries';
          if (!crossLegalRef(c))
            return 'whichCombo: an option needs two corners of the same set square (' + c.a + '/' + c.b + ')';
          if (c.op === 'lay' && !(c.a > c.b)) return 'whichCombo: a lay must put the smaller angle on top';
        }
        return null;
      },
      notMakeable: function(d){
        if (!d) return 'notMakeable: make() returned nothing';
        if (witnessRef(d.bad).length > 0) return 'notMakeable: ' + d.bad + '° can be built after all';
        if (d.mul15 !== (d.bad % STEP_REF === 0)) return 'notMakeable: the multiple-of-15 flag is wrong';
        if (d.mul15 && NEEDS_THREE_REF.indexOf(d.bad) < 0)
          return 'notMakeable: ' + d.bad + '° is a multiple of 15 that is not the known exception';
        for (let i = 0; i < d.opts.length; i++){
          if (i === d.ans) continue;
          if (witnessRef(d.opts[i]).length === 0)
            return 'notMakeable: a distractor (' + d.opts[i] + '°) can be built after all — two answers';
        }
        return null;
      },
      rectCorner: function(d){
        if (!d) return 'rectCorner: make() returned nothing';
        if (d.v !== RIGHT_REF) return 'rectCorner: a square or rectangle corner must be a right angle';
        if (['square', 'rect'].indexOf(d.id) < 0) return 'rectCorner: not a right-angled shape';
        if (!(d.corner >= 0 && d.corner < 4)) return 'rectCorner: corner index out of range';
        return null;
      },
      paraOpp: function(d){
        if (!d) return 'paraOpp: make() returned nothing';
        const angles = [d.a, STRAIGHT_REF - d.a, d.a, STRAIGHT_REF - d.a];
        if (angles[d.corner] !== d.v) return 'paraOpp: the printed measurement is not that corner';
        if (angles[(d.corner + 2) % 4] !== d.v) return 'paraOpp: the opposite angle is not equal to it';
        if (angles[(d.corner + 1) % 4] !== d.nb) return 'paraOpp: the neighbour distractor is wrong';
        if (d.nb === d.v) return 'paraOpp: neighbour and opposite are equal, so the question has two answers';
        if (d.a === RIGHT_REF) return 'paraOpp: a right-angled shape makes the question trivial';
        /* ⚠️ 「旁邊那一個角」（180 － v）不可以當誘答：那個數字只有「相鄰兩角合起來
           180°」算得出來，而這一課明講不教那一條。 */
        if (d.opts.indexOf(d.nb) >= 0)
          return 'paraOpp: the neighbouring angle must not be offered — it needs a rule this lesson does not teach';
        return null;
      },
      splitRight: function(d){
        if (!d) return 'splitRight: make() returned nothing';
        if (d.cut + d.v !== RIGHT_REF) return 'splitRight: the two pieces must add to a right angle';
        if (d.wrong !== STRAIGHT_REF - d.cut) return 'splitRight: the straight-angle distractor is wrong';
        if (d.v === d.cut) return 'splitRight: the answer repeats the number in the question';
        if (d.opts.indexOf(d.wrong) < 0) return 'splitRight: the straight-angle distractor must be offered';
        return null;
      },
      splitAny: function(d){
        if (!d) return 'splitAny: make() returned nothing';
        if (d.cut + d.v !== d.whole) return 'splitAny: the two pieces must add to the original angle';
        if (d.whole === RIGHT_REF) return 'splitAny: this generator must not use a right angle';
        if (d.wrong !== RIGHT_REF - d.cut) return 'splitAny: the right-angle distractor is wrong';
        if (d.wrong === d.v) return 'splitAny: the distractor equals the answer';
        if (d.opts.indexOf(d.wrong) < 0) return 'splitAny: the right-angle distractor must be offered';
        return null;
      },
      nameKind: function(d){
        if (!d) return 'nameKind: make() returned nothing';
        const want = d.deg < RIGHT_REF ? 'acute' : d.deg === RIGHT_REF ? 'right'
                   : d.deg < STRAIGHT_REF ? 'obtuse' : 'straight';
        if (d.kind !== want) return 'nameKind: ' + d.deg + '° is ' + want + ', not ' + d.kind;
        if (!isDeg(d.deg)) return 'nameKind: the angle is out of range';
        return null;
      },
      triKind: function(d){
        if (!d) return 'triKind: make() returned nothing';
        /* ⚠️⚠️ 三角形裡**最大**的那一個角一定大於 60°：只有 59° 的話三個角
           加起來不到 180°，那個三角形不存在，題目本身就壞了（codex 抓到）。
           剛好 60° 也不行 —— 那時三個角都是 60°，要用內角和才說得清楚。 */
        if (!(d.deg > 60))
          return 'triKind: the largest angle of a triangle is always more than 60°, so ' + d.deg + '° is impossible';
        const want = d.deg < RIGHT_REF ? 'acuteTri' : d.deg === RIGHT_REF ? 'rightTri' : 'obtuseTri';
        if (d.kind !== want) return 'triKind: the largest angle ' + d.deg + '° gives ' + want;
        if (!(d.deg > 0 && d.deg < STRAIGHT_REF)) return 'triKind: the largest angle is out of range';
        return null;
      },
      minPieces: function(d){
        if (!d) return 'minPieces: make() returned nothing';
        const want = minPiecesRef(d.target);
        if (d.v !== want) return 'minPieces: ' + d.target + '° needs ' + want + ' piece(s), page says ' + d.v;
        if (!(d.v >= PIECE_MIN_REF && d.v <= PIECE_MAX_REF)) return 'minPieces: piece count out of range';
        if (d.v === 3 && NEEDS_THREE_REF.indexOf(d.target) < 0)
          return 'minPieces: only ' + NEEDS_THREE_REF.join('/') + '° should need three corners';
        return null;
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不呼叫 review.html 的格式化函式。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'pieceOther': return (RIGHT_REF - d.given) + '°';
        case 'joinTwo':    return (d.a + d.b) + '°';
        case 'layTwo':     return (d.big - d.small) + '°';
        case 'notMakeable':return d.bad + '°';
        case 'rectCorner': return RIGHT_REF + '°';
        case 'paraOpp':    return [d.a, STRAIGHT_REF - d.a, d.a, STRAIGHT_REF - d.a][(d.corner + 2) % 4] + '°';
        case 'splitRight': return (RIGHT_REF - d.cut) + '°';
        case 'splitAny':   return (d.whole - d.cut) + '°';
        case 'minPieces':  return String(minPiecesRef(d.target));
        case 'nameKind': {
          const k = d.deg < RIGHT_REF ? 0 : d.deg === RIGHT_REF ? 1 : d.deg < STRAIGHT_REF ? 2 : 3;
          return KIND_WORDS[lang][k];
        }
        case 'triKind': {
          const k = d.deg < RIGHT_REF ? 0 : d.deg === RIGHT_REF ? 1 : 2;
          return TRI_WORDS[lang][k];
        }
        case 'whichCombo': {
          const good = d.combos.filter(function(c){
            return (c.op === 'join' ? c.a + c.b : c.a - c.b) === d.target;
          })[0];
          if (!good) return '(no option builds the target)';
          if (lang === 'zh')
            return good.op === 'join' ? ('把 ' + good.a + '° 和 ' + good.b + '° 拼起來')
                                      : ('把 ' + good.b + '° 疊上 ' + good.a + '°');
          return good.op === 'join' ? ('Join ' + good.a + '° and ' + good.b + '°')
                                    : ('Lay ' + good.b + '° on ' + good.a + '°');
        }
        default: return '(no expectedCorrect rule for ' + genId + ')';
      }
    },

    /* 這一課的選項長什麼樣、範圍多少。正解與誘答分開驗。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (GEN_IDS.indexOf(genId) < 0) return 'no optionOk rule for generator ' + genId;
      if (DEG_GENS.indexOf(genId) >= 0){
        const m = DEG_OPT_RE.exec(s);
        if (!m) return 'option "' + s + '" is not a whole number of degrees';
        const v = Number(m[1]);
        if (!isDeg(v)) return 'option ' + s + ' is outside 1~180°';
        /* 三角板那一支的選項一定是 15 的倍數 —— 別的數字進不了這一題。 */
        if (genId === 'pieceOther' && v % STEP_REF !== 0)
          return 'option ' + s + ' is not a multiple of 15, so it cannot be a set-square angle';
        if (genId === 'notMakeable' && v % 5 !== 0) return 'option ' + s + ' is not a multiple of 5';
        return null;
      }
      if (genId === 'minPieces'){
        if (!/^[1-9]$/.test(s)) return 'option "' + s + '" is not a piece count';
        const v = Number(s);
        if (v < PIECE_MIN_REF || v > PIECE_MAX_REF) return 'piece count ' + s + ' out of range';
        return null;
      }
      if (genId === 'nameKind'){
        if (KIND_WORDS[lang].indexOf(s) < 0) return 'option "' + s + '" is not an angle name';
        return null;
      }
      if (genId === 'triKind'){
        if (TRI_WORDS[lang].indexOf(s) < 0) return 'option "' + s + '" is not a triangle name';
        return null;
      }
      /* whichCombo：整句話的做法。逐字釘死形狀，並且兩個角都要是三角板上的角。 */
      const re = (lang === 'zh') ? COMBO_ZH_RE : COMBO_EN_RE;
      const mm = re.exec(s);
      if (!mm) return 'option "' + s + '" is not a set-square method';
      const nums = mm.slice(1).filter(function(x){ return x !== undefined; }).map(Number);
      if (nums.length !== 2) return 'option "' + s + '" does not name two angles';
      for (const n of nums)
        if (ANGLE_SET_REF.indexOf(n) < 0) return 'option "' + s + '" uses ' + n + '°, which no set square carries';
      return null;
    },

    /* 拿**渲染出來的那一題**再驗一次：INVARIANTS 看不到題幹與圖。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!d) return 'make() returned nothing';

      /* ① 誘答不可以把題幹的數字抄回來。選項帶了 '°'，所以 simgen 內建那一條
            比不出來 —— 這裡自己剝掉 '°' 再比。 */
      const stemNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []);
      q.opts.forEach(function(o, oi){
        if (oi === q.ans) return;
        const m = DEG_OPT_RE.exec(String(o));
        if (m && stemNums.indexOf(m[1]) >= 0)
          out.push('distractor ' + o + ' is copied straight out of the stem');
      });

      /* ② 題幹與解釋的算式逐條驗算。 */
      arithProblems(q.stem + ' ' + q.why).problems.forEach(function(p){ out.push('why/stem: ' + p); });

      /* ③ 渲染出來的字。 */
      ['stem', 'why'].forEach(function(k){
        textProblems(q[k], lang, k).forEach(function(p){ out.push(p); });
      });
      q.opts.forEach(function(o, i){
        textProblems(o, lang, 'option ' + i).forEach(function(p){ out.push(p); });
      });

      /* ④ 有圖的那兩支：圖說一個數字都不可以有（不然答案就印在圖下面了），
            每一個畫出來的點都要在畫布裡，每一個扇形的張角都要等於它宣稱的度數。 */
      const wantFig = (genId === 'paraOpp' || genId === 'splitRight');
      if (wantFig && !q.fig) out.push('this generator must come with a figure');
      if (!wantFig && q.fig) out.push('this generator must not come with a figure');
      if (q.fig){
        if (!q.cap) out.push('a figure with no caption');
        if (/\d/.test(String(q.cap))) out.push('figure caption contains a digit: ' + q.cap);
        /* ⚠️ 畫布尺寸讀不懂的話，下面的 `p.x > q.fig.w` 全部是 false ——
           每一個點都會靜靜通過。所以先卡住尺寸。 */
        if (!(Number.isFinite(q.fig.w) && q.fig.w > 0 && Number.isFinite(q.fig.h) && q.fig.h > 0))
          return 'figure canvas dimensions are missing or invalid';
        /* ⚠️ 扇形的**個數**也要釘：四邊形四個角、切開那一張兩塊。
           少了這一條，一張「沒有任何角記號」的圖會讓下面每一個迴圈跑零次而全綠。 */
        const wedges = q.fig.wedges || [];
        const wantWedges = (q.fig.kind === 'shape') ? 4 : 2;
        if (wedges.length !== wantWedges)
          out.push('a ' + q.fig.kind + ' figure must carry ' + wantWedges + ' angle marks, found ' + wedges.length);
        const pts = [];
        (q.fig.lines || []).forEach(function(l){
          pts.push({ x:l.x1, y:l.y1 }, { x:l.x2, y:l.y2 });
          if (!(l.w > 0)) out.push('a line with a non-positive width');
        });
        (q.fig.dots || []).forEach(function(p){
          pts.push({ x:p.x, y:p.y });
          if (!(p.r > 0)) out.push('a dot with a non-positive radius');
        });
        if (!pts.length) out.push('the figure draws nothing');
        pts.forEach(function(p){
          if (!(Number.isFinite(p.x) && Number.isFinite(p.y))) out.push('a figure point is not a number');
          else if (p.x < 0 || p.x > q.fig.w || p.y < 0 || p.y > q.fig.h)
            out.push('figure point (' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') is outside the canvas');
        });
        wedges.forEach(function(w){
          const parsed = parseWedgeRef(w.d);
          if (!parsed){ out.push('wedge path unreadable: ' + w.d); return; }
          if (!isDeg(w.deg)){ out.push('a wedge claims ' + w.deg + '°, not a whole 1~180'); return; }
          if (Math.abs(parsed.span - w.deg) > 1e-3)
            out.push('wedge is drawn ' + parsed.span.toFixed(2) + '° wide but claims ' + w.deg + '°');
          if (!(parsed.r > 0)) out.push('wedge radius is not positive');
          parsed.pts.forEach(function(p){
            if (p.x < 0 || p.x > q.fig.w || p.y < 0 || p.y > q.fig.h)
              out.push('wedge point (' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') is outside the canvas');
          });
        });
        if (q.fig.kind === 'shape'){
          /* 角記號畫在圖形裡面嗎（鏡射的張角完全正確，只有這一條抓得到）。
             多邊形的四個頂點就是 dots。 */
          const poly = (q.fig.dots || []).map(function(p){ return { x:p.x, y:p.y }; });
          if (poly.length === 4){
            (q.fig.wedges || []).forEach(function(w){
              const mid = (w.from + w.to) / 2;
              const parsed = parseWedgeRef(w.d);
              if (!parsed) return;
              const probe = { x:parsed.cx + Math.cos(mid * Math.PI / 180) * parsed.r * 0.5,
                              y:parsed.cy - Math.sin(mid * Math.PI / 180) * parsed.r * 0.5 };
              if (!pointInPolyRef(probe, poly))
                out.push('an angle mark is drawn outside the shape (mirrored)');
            });
          } else {
            out.push('a shape figure must have four vertex dots, found ' + poly.length);
          }
          /* 對角那一組必須同色，而且同色的兩個角度數要一樣。 */
          const byTone = {};
          wedges.forEach(function(w){ (byTone[w.tone] = byTone[w.tone] || []).push(w.deg); });
          Object.keys(byTone).forEach(function(t){
            const list = byTone[t];
            if (list.length !== 2)
              out.push('tone ' + t + ' marks ' + list.length + ' corners, not the two opposite ones');
            else if (list[0] !== list[1])
              out.push('the two corners drawn in one colour are ' + list.join('° and ') + '°');
          });
        }
      }
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{RIGHT_DEG, STRAIGHT_DEG, STEP_DEG, PIECES, pieceAngles, pieceAngleList, ' +
                'joinDeg, layDeg, twoPieceList, canMakeTwo, needsMoreList, combosFor, comboValue, ' +
                'uniqSorted, pieceAngleSet, crossCombos, ' +
                'SHAPES, shapeAngles, allRight, oppositeIndex, shapePts, ' +
                'FIG_W, FIG_H, FIG_PAD, VX, VY, ARM_LEN, WEDGE_R, TOTAL_R, DOT_R, PIECE_LX, MARK_LEN, ' +
                'SHAPE_ARC_MAX, SHAPE_ARC_RATIO, SPLIT_R, SPLIT_W, SPLIT_H, ' +
                'toRad, polarX, polarY, arcPath, wedgePath, arcSpan, dirDeg, distOf, centreFit, ' +
                'piecePlan, joinPlan, layPlan, shapePlan, splitPlan, ' +
                'S1_CASES, S2_CASES, S3_CASES, S4_ORDER, S5_CUTS, plEn, isAreEn, ' +
                'minPieces, GAME_ORDER, GAME_PAD, shuffle, cornerKind, pieceJudge, joinJudge, sortJudge, oppJudge, cutJudge, PIECE_G, GAME_PIECE, pieceDecoy, pieceRef, pieceBig, ' +
                'JOIN_G, GAME_JOIN, joinInGap, pieceHas, joinSVG, SORT_G, GAME_SORT, sortCards, sortBins, sortValue, sortBinX, sortCardSVG, pairPieces, ' +
                'OPP_G, GAME_OPP, oppPlace, CUT_G, GAME_CUT, cutLabels, cutLblXY, cutPick, cutSVG}',
    optionValueMax: DEG_MAX_REF,

    check: function(data, I18N, fail, rawSrc){
      const src = stripComments(rawSrc);
      const sib = siblingSources();

      /* ---------- 1) 三角板與拼疊 ---------- */
      if (data.RIGHT_DEG !== RIGHT_REF || data.STRAIGHT_DEG !== STRAIGHT_REF)
        fail('a right angle is ' + RIGHT_REF + '° and a straight angle ' + STRAIGHT_REF + '°');
      if (data.PIECES.length !== PIECE_REF.length)
        fail('a pair of set squares has ' + PIECE_REF.length + ' pieces');
      data.PIECES.forEach(function(p, i){
        const got = sortNum(data.pieceAngles(p));
        if (!eqArr(got, PIECE_REF[i]))
          fail('the set of angles on the two set squares: piece ' + i + ' is ' + got.join('/') +
               ', expected ' + PIECE_REF[i].join('/'));
        if (got.indexOf(RIGHT_REF) < 0) fail('piece ' + i + ' has no right angle');
      });
      if (!eqArr(data.pieceAngleList(), ANGLE_SET_REF))
        fail('the set of angles on the two set squares is ' + data.pieceAngleList().join('/'));
      /* 「一定是 15 的倍數」必須是**最緊**的真話：15 要是四個角的最大公因數。 */
      let g = ANGLE_SET_REF[0];
      ANGLE_SET_REF.forEach(function(a){ g = gcdRef(g, a); });
      if (g !== STEP_REF || data.STEP_DEG !== STEP_REF)
        fail('STEP_DEG must be the largest number every set-square angle is a multiple of (' + g + ')');
      /* 拼與疊真的是加與減。 */
      ANGLE_SET_REF.forEach(function(a){
        ANGLE_SET_REF.forEach(function(b){
          if (data.joinDeg(a, b) !== a + b) fail('joinDeg is not an addition at ' + a + '/' + b);
          if (data.layDeg(a, b) !== a - b) fail('layDeg is not a subtraction at ' + a + '/' + b);
        });
      });
      /* ⚠️ 三方比對：**由 PIECE_REF 推導**出來的集合、手算的第二份答案，以及頁面算的。
         少了「推導」那一邊，就只是拿一份抄好的答案去對，那不叫證明。 */
      const derived = derivedSetRef();
      if (!eqArr(derived, TWO_PIECE_REF))
        fail('the set derived from the two set squares is ' + derived.join('/') +
             ', but the hand-checked answer says ' + TWO_PIECE_REF.join('/'));
      const two = data.twoPieceList();
      if (!eqArr(two, derived))
        fail('twoPieceList() does not match the hand-checked set: ' + two.join('/'));
      two.forEach(function(v){
        if (witnessRef(v).length === 0) fail('twoPieceList() offers ' + v + '° with no way to build it');
        if (!isDeg(v)) fail('twoPieceList() offers ' + v + '°, outside 1~180');
      });
      /* 15 的倍數裡做不出來的那些，也是**推導**出來的集合差。 */
      const gaps = derivedGapsRef();
      if (!eqArr(gaps, NEEDS_THREE_REF))
        fail('the multiples of 15 that cannot be built derive as ' + gaps.join('/') +
             ', but the pages call ' + NEEDS_THREE_REF.join('/') + '° the only exception');
      NEEDS_THREE_REF.forEach(function(v){
        if (witnessRef(v).length !== 0) fail(v + '° can be built in one placing after all');
        if (data.canMakeTwo(v)) fail('the page says ' + v + '° can be built in one placing');
        if (minPiecesRef(v) !== 3) fail(v + '° should need three corners');
        /* 三個角的那個做法要真的存在（不是文案）。 */
        let found = null;
        ANGLE_SET_REF.forEach(function(a){ ANGLE_SET_REF.forEach(function(b){ ANGLE_SET_REF.forEach(function(c){
          if (a + b + c === v) found = a + '+' + b + '+' + c;
        }); }); });
        if (!found) fail(v + '° cannot be built from three set-square corners either');
      });
      if (!eqArr(data.needsMoreList(), NEEDS_THREE_REF))
        fail('needsMoreList() must be exactly ' + NEEDS_THREE_REF.join('/') + '°, got ' +
             data.needsMoreList().join('/'));
      /* ⚠️ 每一個做法都要是「一片出一個角」—— 這一條是整課最容易靜靜壞掉的地方。 */
      data.crossCombos().forEach(function(c){
        if (!crossLegalRef(c))
          fail('crossCombos() offers ' + c.op + ' ' + c.a + '/' + c.b +
               ', which needs two corners of the same set square');
        if (c.op === 'lay' && !(c.a > c.b)) fail('crossCombos() lays the bigger angle on the smaller one');
        if (!isDeg(data.comboValue(c))) fail('crossCombos() offers a method worth ' + data.comboValue(c) + '°');
      });
      if (data.crossCombos().length < 8)
        fail('crossCombos() only found ' + data.crossCombos().length + ' methods — too few to cover the set');
      /* minPieces：整個定義域逐一比對（每 5° 一格）。 */
      for (let x = 5; x <= STRAIGHT_REF; x += 5){
        const want = minPiecesRef(x), got = data.minPieces(x);
        if (want !== got) fail('minPieces(' + x + ') is ' + got + ', reference says ' + want);
      }
      /* combosFor：每一個做法都要算得出目標，而且和獨立搜尋一致。 */
      TWO_PIECE_REF.concat([50, 100, 165]).forEach(function(x){
        const combos = data.combosFor(x);
        combos.forEach(function(c){
          if (c.op !== 'one' && data.comboValue(c) !== x)
            fail('combosFor(' + x + ') offers a method worth ' + data.comboValue(c) + '°');
          if (c.op === 'one' && c.a !== x)
            fail('combosFor(' + x + ') offers a single corner of ' + c.a + '°');
          if (!crossLegalRef(c))
            fail('combosFor(' + x + ') offers ' + c.op + ' ' + c.a + '/' + c.b +
                 ', which needs two corners of the same set square');
          if (c.op === 'lay' && !(c.a > c.b))
            fail('combosFor(' + x + ') lays the bigger angle on the smaller one');
          if (['join', 'lay', 'one'].indexOf(c.op) < 0) fail('combosFor(' + x + ') uses an unknown operation');
        });
        if ((combos.length > 0) !== (witnessRef(x).length > 0))
          fail('combosFor(' + x + ') disagrees with the independent search about whether it is buildable');
      });

      /* ---------- 2) 圖形 ---------- */
      if (data.FIG_W !== CANVAS_W_REF || data.FIG_H !== CANVAS_H_REF)
        fail('the canvas is ' + CANVAS_W_REF + '×' + CANVAS_H_REF);
      /* ⚠️ checkFigure() 量的是**中心點**：線的粗細與圓點的半徑要小於留白，
         留白才蓋得住它們 —— 不然粗線可以跨出畫布而中心還在裡面（codex 第三輪抓到）。 */
      const strokes = (src.match(/'stroke-width':\s*([\d.]+)/g) || [])
        .map(function(m){ return Number(m.split(':')[1]); });
      const widest = strokes.length ? Math.max.apply(null, strokes) : 0;
      if (!strokes.length) fail('cannot read any stroke width — unchecked, not passing');
      if (data.DOT_R + widest / 2 >= MARGIN_REF)
        fail('the margin (' + MARGIN_REF + 'px) must cover the fattest thing drawn (dot r=' +
             data.DOT_R + ' + half of stroke ' + widest + ')');
      const vbCount = countOf(src, 'viewBox="0 0 ' + CANVAS_W_REF + ' ' + CANVAS_H_REF + '"');
      /* 小遊戲改成畫板（2026-10-05）：460 × 300 的圖只剩五個範例。 */
      if (vbCount !== 5)
        fail('expected 5 figure canvases on the lesson page (the five examples), found ' + vbCount);
      if (src.indexOf('max-width:' + CANVAS_W_REF + 'px;height:' + CANVAS_H_REF + 'px') < 0)
        fail('the .anglefig CSS size must match the viewBox (' + CANVAS_W_REF + '×' + CANVAS_H_REF + ')');

      if (!eqArr(data.shapeAngles(45), [45, 135, 45, 135]))
        fail('the four angles are not a, 180-a, a, 180-a: ' + data.shapeAngles(45).join('/'));
      if (data.oppositeIndex(0) !== 2 || data.oppositeIndex(1) !== 3 ||
          data.oppositeIndex(2) !== 0 || data.oppositeIndex(3) !== 1)
        fail('oppositeIndex must pair 0 with 2 and 1 with 3');

      /* 每一張圖的共同檢查：四個邊的留白。 */
      function checkFigure(label, plan, extraPts){
        const pts = [];
        (plan.edges || []).forEach(function(e){ pts.push({ x:e.x1, y:e.y1 }, { x:e.x2, y:e.y2 }); });
        (plan.corners || []).forEach(function(c){ pts.push({ x:c.x, y:c.y }); });
        (extraPts || []).forEach(function(p){ pts.push(p); });
        if (!pts.length){ fail(label + ': the figure draws nothing'); return; }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, bad = false;
        pts.forEach(function(p){
          if (!(Number.isFinite(p.x) && Number.isFinite(p.y))){ bad = true; return; }
          minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
        });
        if (bad){ fail(label + ': a drawn point is not a number'); return; }
        if (minX < 0 || minY < 0 || maxX > CANVAS_W_REF || maxY > CANVAS_H_REF)
          fail(label + ': something is drawn outside the canvas (x ' + minX.toFixed(1) + '~' +
               maxX.toFixed(1) + ', y ' + minY.toFixed(1) + '~' + maxY.toFixed(1) + ')');
        else if (minX < MARGIN_REF || minY < MARGIN_REF ||
                 CANVAS_W_REF - maxX < MARGIN_REF || CANVAS_H_REF - maxY < MARGIN_REF)
          fail(label + ': less than ' + MARGIN_REF + 'px of margin (x ' + minX.toFixed(1) + '~' +
               maxX.toFixed(1) + ', y ' + minY.toFixed(1) + '~' + maxY.toFixed(1) + ')');
      }
      /* 一個多邊形計畫（三角板或四邊形）：用餘弦定理把每一個角算回來。 */
      function checkCorners(label, plan){
        const n = plan.corners.length;
        plan.corners.forEach(function(c, i){
          const prev = plan.corners[(i + n - 1) % n], next = plan.corners[(i + 1) % n];
          const drawn = cornerDegRef({ x:prev.x, y:prev.y }, { x:c.x, y:c.y }, { x:next.x, y:next.y });
          if (drawn === null){ fail(label + ' corner ' + i + ': two vertices sit on top of each other'); return; }
          /* ⚠️ 先確認宣稱的度數讀得懂：undefined 或 NaN 減出來是 NaN，
             而 NaN > 1e-3 是 false —— 少了這一條，沒有 deg 的角會靜靜通過。 */
          if (!isDeg(c.deg)){
            fail(label + ' corner ' + i + ': the claimed degree is ' + c.deg + ', not a whole 1~180');
            return;
          }
          if (Math.abs(drawn - c.deg) > 1e-3)
            fail(label + ' corner ' + i + ': claims ' + c.deg + '° but ' + drawn.toFixed(3) +
                 '° is not the drawn angle');
          if (!(c.r > 0)) fail(label + ' corner ' + i + ': the angle mark has a non-positive radius');
          const side = Math.min(Math.hypot(prev.x - c.x, prev.y - c.y), Math.hypot(next.x - c.x, next.y - c.y));
          if (c.r > side / 2)
            fail(label + ' corner ' + i + ': the angle mark (r=' + c.r.toFixed(1) +
                 ') is more than half the shorter side (' + side.toFixed(1) + ')');
          if (c.right !== (c.deg === RIGHT_REF))
            fail(label + ' corner ' + i + ': the right-angle flag disagrees with the degree');
          /* ⚠️ 張角對了不代表畫對了：把起訖角取負，記號會**鏡射到圖形外面**，
             而張角一模一樣。所以要問「記號畫在圖形裡面嗎」。 */
          const poly = plan.corners.map(function(p){ return { x:p.x, y:p.y }; });
          const mid = (c.from + c.to) / 2;
          const probe = { x:data.polarX(c.x, mid, c.r * 0.5), y:data.polarY(c.y, mid, c.r * 0.5) };
          if (!pointInPolyRef(probe, poly))
            fail(label + ' corner ' + i + ': the angle mark is drawn outside the shape (mirrored)');
          if (!c.right){
            const w = parseWedgeRef(data.wedgePath(c.x, c.y, c.from, c.to, c.r));
            if (!w) fail(label + ' corner ' + i + ': wedge path unreadable');
            else if (Math.abs(w.span - c.deg) > 1e-3)
              fail(label + ' corner ' + i + ': wedge span ' + w.span.toFixed(3) + '° != ' + c.deg + '°');
          } else {
            /* 直角記號：驗**頁面資料區算好的那一份**（c.mark），不是設定檔自己重算的
               —— 重算的話把繪圖那一邊改壞完全不會響。 */
            if (!c.mark){ fail(label + ' corner ' + i + ': a right angle with no right-angle mark'); return; }
            const mk = c.mark;
            /* ⚠️ 座標讀不懂的話下面每一條比較都是 NaN，而 NaN > eps 是 false（全部靜靜通過）。 */
            const finite = function(pt){ return pt && Number.isFinite(pt.x) && Number.isFinite(pt.y); };
            if (!(finite(mk.p1) && finite(mk.p2) && finite(mk.p3))){
              fail(label + ' corner ' + i + ': the right-angle mark has unreadable coordinates');
              return;
            }
            if (!(mk.m > 0)) fail(label + ' corner ' + i + ': the right-angle mark has no length');
            if (mk.m > c.r + EPS)
              fail(label + ' corner ' + i + ': the right-angle mark is longer than the angle mark radius');
            const dot = (mk.p1.x - c.x) * (mk.p2.x - c.x) + (mk.p1.y - c.y) * (mk.p2.y - c.y);
            if (Math.abs(dot) > 1e-3)
              fail(label + ' corner ' + i + ': the right-angle mark is not square (dot=' + dot.toFixed(3) + ')');
            const m1 = Math.hypot(mk.p1.x - c.x, mk.p1.y - c.y);
            const m2 = Math.hypot(mk.p2.x - c.x, mk.p2.y - c.y);
            if (Math.abs(m1 - mk.m) > 1e-6 || Math.abs(m2 - mk.m) > 1e-6)
              fail(label + ' corner ' + i + ': the right-angle mark legs are unequal');
            /* 小方框的第三個點也要在圖形裡面 —— 鏡射的話它會落在外面。 */
            if (!pointInPolyRef(mk.p3, poly))
              fail(label + ' corner ' + i + ': the right-angle mark sits outside the shape (mirrored)');
            /* 兩條腿要沿著兩條邊走（方向要對得上 dirs）。 */
            [0, 1].forEach(function(k){
              const want = { x:data.polarX(c.x, c.dirs[k], mk.m), y:data.polarY(c.y, c.dirs[k], mk.m) };
              const got = k === 0 ? mk.p1 : mk.p2;
              if (Math.hypot(want.x - got.x, want.y - got.y) > 1e-6)
                fail(label + ' corner ' + i + ': right-angle mark leg ' + k + ' does not run along the side');
            });
          }
        });
      }

      /* --- 範例 1：三角板 --- */
      if (data.S1_CASES.length !== 4) fail('example 1 must offer both pieces at both sizes');
      const seenPieceSize = {};
      data.S1_CASES.forEach(function(cs){
        const plan = data.piecePlan(cs.piece, cs.size);
        seenPieceSize[cs.piece + '/' + cs.size] = 1;
        const label = 'piecePlan(' + cs.piece + ',' + cs.size + ')';
        if (plan.corners.length !== 3 || plan.edges.length !== 3)
          fail(label + ': a set square is drawn with three corners and three edges, found ' +
               plan.corners.length + '/' + plan.edges.length);
        if (!eqArr(sortNum(plan.angles), PIECE_REF[cs.piece]))
          fail(label + ': angles ' + plan.angles.join('/') + ' are not this set square');
        checkCorners(label, plan);
        checkFigure(label, plan, []);
      });
      [0, 1].forEach(function(p){
        [0, 1].forEach(function(sz){
          if (!seenPieceSize[p + '/' + sz]) fail('example 1 never shows piece ' + p + ' at size ' + sz);
        });
        const a = data.piecePlan(p, 0), b = data.piecePlan(p, 1);
        if (!eqArr(a.angles, b.angles))
          fail('same piece at two sizes must carry the same angles: ' + a.angles.join('/') + ' vs ' + b.angles.join('/'));
        if (!(b.lx > a.lx)) fail('the larger size of piece ' + p + ' must be drawn larger');
        if (!(b.ly > a.ly)) fail('the larger size of piece ' + p + ' must be taller too');
      });

      /* --- 範例 2／3：拼與疊 --- */
      /* ⚠️ 「拼出直角」在一片出一個角的規則下做不到（45 ＋ 45、60 ＋ 30 都同片），
         所以要的是「拼出平角」，外加至少一組比直角小、一組比直角大。 */
      if (!data.S2_CASES.some(function(c){ return c.a + c.b === STRAIGHT_REF; }))
        fail('example 2 must include a pairing that joins to a straight angle');
      if (!data.S2_CASES.some(function(c){ return c.a + c.b < RIGHT_REF + 1; }))
        fail('example 2 must include a pairing that stays at or below a right angle');
      if (!data.S2_CASES.some(function(c){ return c.a + c.b > RIGHT_REF && c.a + c.b < STRAIGHT_REF; }))
        fail('example 2 must include a pairing between a right angle and a straight angle');
      data.S2_CASES.forEach(function(c){
        const plan = data.joinPlan(c.a, c.b);
        const label = 'joinPlan(' + c.a + ',' + c.b + ')';
        if (!crossLegalRef({ op:'join', a:Math.max(c.a, c.b), b:Math.min(c.a, c.b) }))
          fail(label + ': that pairing needs two corners of the same set square');
        if (plan.total !== c.a + c.b) fail(label + ': total is not the two angles added');
        if (plan.total > STRAIGHT_REF) fail(label + ': joins to more than a straight angle');
        if (plan.wedges.length !== 2) fail(label + ': needs one wedge per piece');
        if (plan.wedges[0].deg !== c.a || plan.wedges[1].deg !== c.b)
          fail(label + ': the wedges do not stand for the two pieces');
        if (Math.abs(plan.wedges[0].to - plan.wedges[1].from) > EPS)
          fail(label + ': the two pieces do not share the middle side');
        plan.wedges.forEach(function(w, wi){
          const p = parseWedgeRef(w.d);
          if (!p) fail(label + ': wedge ' + wi + ' path unreadable');
          else if (Math.abs(p.span - w.deg) > 1e-3)
            fail(label + ': wedge span ' + p.span.toFixed(3) + '° != ' + w.deg + '°');
        });
        const arc = parseArcRef(plan.totalArc.d, plan.cx, plan.cy);
        if (!arc) fail(label + ': the total arc is unreadable');
        else {
          const flagBad = arcFlagProblem(arc, plan.totalArc.from, plan.totalArc.to, label);
          if (flagBad) fail(flagBad);
          if (Math.abs(arc.span - plan.total) > 1e-3)
            fail(label + ': the total arc spans ' + arc.span.toFixed(3) + '° but the total is ' + plan.total + '°');
          if (!(arc.r > plan.wedges[0].r))
            fail(label + ': the total arc must sit outside the coloured pieces');
          /* ⚠️ 弧線的**整段**都要在畫布裡：只看端點的話，中間凸出去看不到。 */
          const box = arcBoxRef(plan.cx, plan.cy, plan.totalArc.from, plan.totalArc.to, arc.r, 1);
          if (!box) fail(label + ': the total arc has unreadable geometry — unchecked, not passing');
          else if (box.minX < 0 || box.minY < 0 || box.maxX > CANVAS_W_REF || box.maxY > CANVAS_H_REF)
            fail(label + ': the total arc leaves the canvas between its endpoints (x ' +
                 box.minX.toFixed(1) + '~' + box.maxX.toFixed(1) + ', y ' +
                 box.minY.toFixed(1) + '~' + box.maxY.toFixed(1) + ')');
        }
        if (plan.arms.length !== 3) fail(label + ': a joined angle is drawn with three arms');
        else if (Math.abs(plan.arms[1].deg - c.a) > EPS || Math.abs(plan.arms[2].deg - plan.total) > EPS)
          fail(label + ': the arms are not at 0°, a and a+b');
        checkFigure(label, { edges:[], corners:[] },
          plan.arms.map(function(a2){ return { x:a2.x2, y:a2.y2 }; })
            .concat([{ x:plan.cx, y:plan.cy }]).concat(arc ? arc.pts : []));
      });
      data.S3_CASES.forEach(function(c){
        const plan = data.layPlan(c.big, c.small);
        const label = 'layPlan(' + c.big + ',' + c.small + ')';
        if (!crossLegalRef({ op:'lay', a:c.big, b:c.small }))
          fail(label + ': that pairing needs two corners of the same set square');
        if (!(c.big > c.small)) fail(label + ': the laid piece must be the smaller one');
        if (plan.open !== c.big - c.small) fail(label + ': the part left showing is not a subtraction');
        if (plan.wedges[0].deg !== c.small || plan.wedges[1].deg !== plan.open)
          fail(label + ': the covered piece and the part left showing are mixed up');
        plan.wedges.forEach(function(w, wi){
          const p = parseWedgeRef(w.d);
          if (!p) fail(label + ': wedge ' + wi + ' path unreadable');
          else if (Math.abs(p.span - w.deg) > 1e-3)
            fail(label + ': wedge span ' + p.span.toFixed(3) + '° != ' + w.deg + '°');
          const box = arcBoxRef(plan.cx, plan.cy, w.from, w.to, w.r, 1);
          if (!box) fail(label + ': wedge ' + wi + ' has unreadable geometry — unchecked, not passing');
          else if (box.minX < 0 || box.minY < 0 || box.maxX > CANVAS_W_REF || box.maxY > CANVAS_H_REF)
            fail(label + ': wedge ' + wi + ' leaves the canvas between its endpoints');
        });
        const arc = parseArcRef(plan.totalArc.d, plan.cx, plan.cy);
        if (!arc) fail(label + ': the original-angle arc is unreadable');
        else {
          const flagBad = arcFlagProblem(arc, plan.totalArc.from, plan.totalArc.to, label);
          if (flagBad) fail(flagBad);
          if (Math.abs(arc.span - c.big) > 1e-3)
            fail(label + ': the outer arc must span the original ' + c.big + '°');
          const box = arcBoxRef(plan.cx, plan.cy, plan.totalArc.from, plan.totalArc.to, arc.r, 1);
          if (!box) fail(label + ': the outer arc has unreadable geometry — unchecked, not passing');
          else if (box.minX < 0 || box.minY < 0 || box.maxX > CANVAS_W_REF || box.maxY > CANVAS_H_REF)
            fail(label + ': the outer arc leaves the canvas between its endpoints');
        }
        checkFigure(label, { edges:[], corners:[] },
          plan.arms.map(function(a2){ return { x:a2.x2, y:a2.y2 }; })
            .concat([{ x:plan.cx, y:plan.cy }]).concat(arc ? arc.pts : []));
      });
      if (!data.S3_CASES.some(function(c){ return c.big - c.small === STEP_REF; }))
        fail('example 3 must include the smallest angle two pieces make (' + STEP_REF + '°)');

      /* --- 範例 4：四邊形 --- */
      let rightShapes = 0, slantShapes = 0;
      const seenShapeIds = data.S4_ORDER.map(function(i){ return data.shapePlan(i).id; });
      if (!eqArr(sortNum ? seenShapeIds.slice().sort() : seenShapeIds,
                 ['para', 'rect', 'rhomb', 'square']))
        fail('example 4 must show exactly the square, the rectangle, the parallelogram and the rhombus, ' +
             'once each — found ' + seenShapeIds.join('/'));
      data.S4_ORDER.forEach(function(idx){
        const plan = data.shapePlan(idx);
        const label = 'shapePlan(' + plan.id + ')';
        if (!eqArr(plan.angles, data.shapeAngles(plan.a)))
          fail(label + ': the four angles are not a, 180-a, a, 180-a');
        if (plan.allRight !== (plan.a === RIGHT_REF)) fail(label + ': allRight disagrees with the angle');
        if ((plan.id === 'square' || plan.id === 'rect') && !plan.allRight)
          fail(label + ': a shape called a ' + plan.id + ' must have four right angles');
        if ((plan.id === 'para' || plan.id === 'rhomb') && plan.allRight)
          fail(label + ': the parallelogram/rhombus example must not be drawn with right angles');
        if (plan.allRight) rightShapes++; else slantShapes++;
        if (plan.corners.length !== 4 || plan.edges.length !== 4)
          fail(label + ': a quadrilateral has four corners and four edges');
        checkCorners(label, plan);
        checkFigure(label, plan, []);
        plan.corners.forEach(function(c, i){
          const opp = plan.corners[data.oppositeIndex(i)];
          if (c.pair !== opp.pair) fail(label + ': corner ' + i + ' and its opposite are drawn in different colours');
          if (c.deg !== opp.deg) fail(label + ': corner ' + i + ' and its opposite differ in degrees');
          if (!plan.allRight && c.pair === plan.corners[(i + 1) % 4].pair)
            fail(label + ': two neighbouring corners share a colour');
        });
        const side = plan.edges.map(function(e){ return Math.hypot(e.x2 - e.x1, e.y2 - e.y1); });
        const eq = function(a, b){ return Math.abs(a - b) < 1e-6; };
        if (plan.id === 'square' || plan.id === 'rhomb'){
          if (!(eq(side[0], side[1]) && eq(side[1], side[2]) && eq(side[2], side[3])))
            fail(label + ': all four sides must be equal (' + side.map(function(s){ return s.toFixed(1); }).join('/') + ')');
        } else {
          if (!(eq(side[0], side[2]) && eq(side[1], side[3])))
            fail(label + ': opposite sides must be equal');
          if (eq(side[0], side[1])) fail(label + ': a rectangle drawn as a square hides what it is for');
        }
      });
      if (rightShapes < 2) fail('example 4 must show at least two shapes whose four angles are right angles');
      if (slantShapes < 2) fail('example 4 must show at least two shapes whose angles are not right angles');

      /* --- 範例 5：切成兩塊 --- */
      if (data.S5_CUTS.indexOf(45) < 0)
        fail('S5_CUTS must include 45 so the "two equal pieces" case the narration mentions really occurs');
      let hitsBottom = 0, hitsRight = 0;
      data.S5_CUTS.concat([25]).forEach(function(cut){
        const plan = data.splitPlan(cut);
        const label = 'splitPlan(' + cut + ')';
        if (plan.cut + plan.other !== RIGHT_REF)
          fail(label + ': the two pieces must add to a right angle, got ' + plan.cut + ' + ' + plan.other);
        if (plan.sum !== RIGHT_REF) fail(label + ': the angle being cut is a right angle');
        if (!(plan.other > 0 && plan.cut > 0)) fail(label + ': both pieces must be positive');
        if (plan.wedges[0].deg !== cut || plan.wedges[1].deg !== plan.other)
          fail(label + ': the two coloured pieces are not the two parts of the angle');
        plan.wedges.forEach(function(w, wi){
          const p = parseWedgeRef(w.d);
          if (!p) fail(label + ': wedge ' + wi + ' path unreadable');
          else if (Math.abs(p.span - w.deg) > 1e-3)
            fail(label + ': wedge span ' + p.span.toFixed(3) + '° != ' + w.deg + '°');
          if (!(w.r > 0)) fail(label + ': SPLIT_R must be positive');
          if (w.r > Math.min(data.SPLIT_W, data.SPLIT_H, plan.cutLen))
            fail(label + ': SPLIT_R (' + w.r + ') is longer than the shortest arm of the angle');
        });
        const dx = plan.cutLine.x2 - plan.cx, dy = plan.cutLine.y2 - plan.cy;
        const onRight = Math.abs(dx - data.SPLIT_W) < 1e-6;
        const onBottom = Math.abs(dy - data.SPLIT_H) < 1e-6;
        if (!(onRight || onBottom))
          fail(label + ': the cut line does not end on the rectangle (dx=' + dx.toFixed(2) +
               ', dy=' + dy.toFixed(2) + ')');
        if (!onRight && onBottom !== !!plan.hitsBottom)
          fail(label + ': the hitsBottom flag disagrees with where the cut ends');
        if (onBottom) hitsBottom++;
        if (onRight) hitsRight++;
        checkFigure(label, plan, [{ x:plan.cutLine.x2, y:plan.cutLine.y2 }, { x:plan.cx, y:plan.cy }]);
      });
      if (!hitsBottom || !hitsRight)
        fail('example 5 must include a cut that reaches the bottom edge and one that reaches the right edge');

      /* ---------- 3) 題庫 ---------- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(function(bank){
        const want = BANK_EXPECTED[bank];
        ['zh', 'en'].forEach(function(lang){
          const list = I18N[lang][bank];
          if (!list || list.length !== want.length){
            fail(bank + ' ' + lang + ': expected ' + want.length + ' questions, found ' + (list ? list.length : 0));
            return;
          }
          list.forEach(function(q, i){
            const label = bank + '[' + i + '] ' + lang;
            const got = String(q.opts[q.ans]);
            if (got !== want[i].expect[lang])
              fail(label + ': the marked answer is "' + got + '", expected "' + want[i].expect[lang] + '"');
            if (q.stem.indexOf(want[i].ask[lang]) < 0)
              fail(label + ': the stem no longer asks "' + want[i].ask[lang] + '"');
            arithProblems(q.stem + ' ' + q.why).problems.forEach(function(p){ fail(label + ': ' + p); });
            textProblems(q.stem, lang, label + ' stem').forEach(fail);
            textProblems(q.why, lang, label + ' why').forEach(fail);
            q.opts.forEach(function(o, oi){ textProblems(o, lang, label + ' option ' + oi).forEach(fail); });
            (String(q.opts.join(' ')).match(/(\d+)°/g) || []).forEach(function(m){
              const v = Number(m.replace('°', ''));
              if (!isDeg(v)) fail(label + ': option degree ' + v + ' is outside 1~180');
            });
          });
        });
      });

      /* ---------- 4) 遊戲：gameChecks()（見檔案上方） ---------- */
      const gameNarr = [];
      gameChecks(data, I18N, fail, src, gameNarr);

      /* ---------- 5) 旁白：真的渲染出來再掃 ---------- */
      const narrated = [];
      ['zh', 'en'].forEach(function(lang){
        const d = I18N[lang];
        function named(deg){ return deg === STRAIGHT_REF ? d.kindStraight : null; }
        data.S1_CASES.forEach(function(cs){
          const plan = data.piecePlan(cs.piece, cs.size);
          const piece = d.pieceName[data.PIECES[cs.piece].id];
          narrated.push([lang, 's1cap', d.s1cap(piece, d.sizeName[cs.size], d.sizeCmp[cs.size])]);
          narrated.push([lang, 's1narr', d.s1narr(d.sizeName[1 - cs.size], plan.angles)]);
          narrated.push([lang, 's1calc', d.s1calc(plan.angles)]);
          narrated.push([lang, 's1result', d.s1result(plan.angles)]);
        });
        data.S2_CASES.forEach(function(c){
          const plan = data.joinPlan(c.a, c.b);
          narrated.push([lang, 's2cap', d.s2cap(c.a, c.b)]);
          narrated.push([lang, 's2narr', d.s2narr(c.a, c.b, plan.total, named(plan.total))]);
          narrated.push([lang, 's2calc', d.s2calc(c.a, c.b, plan.total)]);
          narrated.push([lang, 's2result', d.s2result(plan.total)]);
        });
        data.S3_CASES.forEach(function(c){
          const plan = data.layPlan(c.big, c.small);
          narrated.push([lang, 's3cap', d.s3cap(c.big, c.small)]);
          narrated.push([lang, 's3narr', d.s3narr(c.big, c.small, plan.open)]);
          narrated.push([lang, 's3calc', d.s3calc(c.big, c.small, plan.open)]);
          narrated.push([lang, 's3result', d.s3result(plan.open)]);
        });
        data.S4_ORDER.forEach(function(idx){
          const plan = data.shapePlan(idx);
          const name = d.shapeName[plan.id];
          narrated.push([lang, 's4cap', plan.allRight ? d.s4capRight : d.s4capPair]);
          narrated.push([lang, 's4narr', plan.allRight ? d.s4narrRight(name)
                                                       : d.s4narrPair(name, plan.angles[0], plan.angles[1])]);
          narrated.push([lang, 's4calc', plan.allRight ? d.s4calcRight : d.s4calcPair(plan.angles)]);
          narrated.push([lang, 's4result', d.s4result(name, plan.angles)]);
        });
        data.S5_CUTS.forEach(function(cut){
          const plan = data.splitPlan(cut);
          narrated.push([lang, 's5cap', d.s5cap(cut)]);
          narrated.push([lang, 's5narr', d.s5narr(cut, plan.other, cut === plan.other)]);
          narrated.push([lang, 's5calc', d.s5calc(cut, plan.other)]);
          narrated.push([lang, 's5result', d.s5result(plan.other)]);
        });
        narrated.push([lang, 'gWin', d.gWin(100)]);
      });
      gameNarr.forEach(function(row){ narrated.push(row); });
      narrated.forEach(function(row){
        textProblems(row[2], row[0], row[1] + ' (' + row[0] + ')').forEach(fail);
        arithProblems(row[2]).problems.forEach(function(p){ fail(row[1] + ' (' + row[0] + '): ' + p); });
      });
      /* 例 2／3／5 的算式行必須**逐字**是那一條式子 ——
         「旁白有出現數字」擋不住寫錯的算式。 */
      ['zh', 'en'].forEach(function(lang){
        const d = I18N[lang];
        const plus = (lang === 'zh') ? ' ＋ ' : ' + ';
        const minus = (lang === 'zh') ? ' － ' : ' − ';
        const eqs = (lang === 'zh') ? ' ＝ ' : ' = ';
        data.S2_CASES.forEach(function(c){
          const t = data.joinPlan(c.a, c.b).total;
          const want = c.a + '°' + plus + c.b + '°' + eqs + t + '°';
          if (d.s2calc(c.a, c.b, t) !== want)
            fail('example 2 narration (' + lang + '): the calculation line must read "' + want + '"');
        });
        data.S3_CASES.forEach(function(c){
          const o = data.layPlan(c.big, c.small).open;
          const want = c.big + '°' + minus + c.small + '°' + eqs + o + '°';
          if (d.s3calc(c.big, c.small, o) !== want)
            fail('example 3 narration (' + lang + '): the calculation line must read "' + want + '"');
        });
        data.S5_CUTS.forEach(function(cut){
          const o = data.splitPlan(cut).other;
          const want = RIGHT_REF + '°' + minus + cut + '°' + eqs + o + '°';
          if (d.s5calc(cut, o) !== want)
            fail('example 5 narration (' + lang + '): the calculation line must read "' + want + '"');
        });
        data.S4_ORDER.forEach(function(idx){
          const plan = data.shapePlan(idx);
          if (plan.allRight) return;
          const s = d.s4narrPair(d.shapeName[plan.id], plan.angles[0], plan.angles[1]);
          const first = s.indexOf(plan.angles[0] + '°'), second = s.indexOf(plan.angles[1] + '°');
          if (first < 0 || second < 0 || !(first < second))
            fail('example 4 narration (' + lang + '): the orange pair (' + plan.angles[0] +
                 '°) must be named before the blue pair (' + plan.angles[1] + '°)');
        });
      });
      /* 驗算的覆蓋率要釘兩個東西：驗過幾條，以及**驗過的算式本身的指紋**
         —— 只釘數量擋不住「拿掉一條、再補一條」。 */
      const eqList = arithProblems.verifiedAll();
      /* ⚠️ 這兩個數字都要**釘死**：只釘「至少幾條」的話，一個壞掉的正規化
         會讓每一條算式靜靜讀不到，而 0 錯誤看起來和全部驗過一模一樣；
         只釘條數又擋不住「拿掉一條、再補一條」（數量一樣、驗的是別的宣稱）。 */
      if (eqList.length !== VERIFIED_REF)
        fail('the arithmetic verifier checked ' + eqList.length + ' equations, expected ' + VERIFIED_REF);
      const fingerprint = crypto.createHash('sha1').update(eqList.join(' | ')).digest('hex');
      if (fingerprint !== FINGERPRINT_REF)
        fail('the set of verified equations changed (fingerprint ' + fingerprint + ')');
      if (arithProblems.unmatched().length)
        fail('wrongOnPurpose declared but never matched: ' + arithProblems.unmatched().join(' / '));

      /* ---------- 6) 四頁的措辭 ---------- */
      const clean = {};
      ['index', 'reference', 'review', 'parents'].forEach(function(name){
        if (sib[name] === null){ fail('cannot read ' + name + '.html'); return; }
        clean[name] = stripComments(sib[name]);
      });
      SIBLING_RULES.concat(SIBLING_RULES_EN).forEach(function(rule){
        Object.keys(rule.files).forEach(function(name){
          if (clean[name] === undefined) return;
          const n = countOf(clean[name], rule.text);
          /* ⚠️ 「剛好等於」而不是「至少」：只有下界的話，先多加一份再刪掉真正那一份
             照樣是綠的（codex 抓到）。數字變了就是有人動了措辭，本來就該重新確認。 */
          if (n !== rule.files[name])
            fail('SIBLING: "' + rule.text + '" appears ' + n + ' time(s) in ' + name +
                 '.html, expected exactly ' + rule.files[name]);
        });
      });
      FORBIDDEN.forEach(function(bad){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (clean[name] === undefined) return;
          if (clean[name].indexOf(bad) >= 0)
            fail('FORBIDDEN: ' + name + '.html says "' + bad + '", which is not true');
        });
      });
      KEY_RULES.forEach(function(rule){
        if (clean[rule.file] === undefined) return;
        const vals = keyValues(clean[rule.file], rule.key);
        if (vals === null){
          fail('KEY: cannot find the zh dictionary in ' + rule.file + '.html — unchecked, not passing');
          return;
        }
        if (vals.length !== 1){
          fail('KEY: ' + rule.file + '.html has ' + vals.length + ' zh values for ' + rule.key +
               ' — exactly one is required to pin the rule to');
          return;
        }
        const zhVal = vals[0];
        rule.must.forEach(function(phrase){
          if (zhVal.indexOf(phrase) < 0)
            fail('KEY: ' + rule.file + '.html ' + rule.key + ' no longer says "' + phrase + '"');
        });
      });
      PAIRED_RULES.forEach(function(pair){
        pair.pages.forEach(function(name){
          if (clean[name] === undefined) return;
          if (clean[name].indexOf(pair.rule) >= 0 && clean[name].indexOf(pair.qualifier) < 0)
            fail('PAIRED: ' + name + '.html states "' + pair.rule + '" without "' + pair.qualifier + '"');
        });
      });
      HANDOFF_RULES.forEach(function(h){
        ['index', 'reference', 'review', 'parents'].forEach(function(name){
          if (clean[name] === undefined) return;
          const hay = clean[name];
          let i = 0;
          for (;;){
            const k = hay.indexOf(h.word, i);
            if (k < 0) break;
            /* ⚠️ 用**同一個句子**當範圍，不是固定的字元窗 —— 固定窗裡剛好有一個
               不相干的「五年級」就會替一句真的越界的話背書（codex 第三輪抓到）。 */
            const from = Math.max(hay.lastIndexOf('。', k), hay.lastIndexOf('>', k), 0);
            let to = hay.indexOf('。', k);
            if (to < 0) to = Math.min(hay.length, k + h.span);
            const win = hay.slice(from, to + 1);
            if (!h.near.some(function(w){ return win.indexOf(w) >= 0; }))
              fail('HANDOFF: ' + name + '.html mentions "' + h.word + '" without "' + h.near.join('/') +
                   '" nearby — this lesson only ever hands that topic on');
            i = k + h.word.length;
          }
        });
      });
      ['reference', 'parents'].forEach(function(name){
        if (clean[name] === undefined) return;
        if (clean[name].indexOf('<svg') >= 0)
          fail(name + '.html must not draw any SVG — it is deliberately text-only');
      });
      ['index', 'review'].forEach(function(name){
        if (clean[name] === undefined) return;
        if (clean[name].indexOf('<text') >= 0)
          fail(name + '.html must not put <text> in an SVG');
        /* ⚠️ 單引號、雙引號、空白都要收；另外**擋掉直接呼叫 createElementNS**
           （不然繞過 svgEl() 就等於繞過這一條）。 */
        const tags = [...clean[name].matchAll(/svgEl\s*\(\s*['"]([a-zA-Z]+)['"]/g)]
          .map(function(m){ return m[1].toLowerCase(); });
        const allowed = ['line', 'path', 'circle'];
        [...new Set(tags)].forEach(function(t){
          if (allowed.indexOf(t) < 0)
            fail(name + '.html creates an SVG <' + t + '>, which this lesson does not use');
        });
        if (!tags.length) fail(name + '.html draws nothing through svgEl() — has the drawing moved elsewhere?');
        /* ⚠️ 每一次呼叫的 tag 都要是**字面量**：svgEl('te' + 'xt') 這種算出來的名字
           會讓上面那一條靜靜放過（codex 第三輪抓到）。 */
        /* 宣告那一行（function svgEl(...)）不算呼叫。 */
        const calls = (clean[name].match(/(?<!function\s)svgEl\s*\(/g) || []).length;
        if (calls !== tags.length)
          fail(name + '.html has ' + calls + ' svgEl() calls but only ' + tags.length +
               ' literal tag names — a computed tag would bypass the allow-list');
        /* 掃描器讀不懂的語法一律 fail-closed。 */
        scannerSafe(sib[name]).forEach(function(w){
          fail(name + '.html contains ' + w + ' — the comment scanner cannot be trusted on it');
        });
        const direct = [...clean[name].matchAll(/createElementNS\s*\(\s*[^,]+,\s*['"]([a-zA-Z]+)['"]/g)]
          .map(function(m){ return m[1].toLowerCase(); });
        [...new Set(direct)].forEach(function(t){
          if (t !== 'svg')
            fail(name + '.html calls createElementNS for <' + t + '> directly, bypassing svgEl()');
        });
      });
      ['index', 'reference', 'review', 'parents'].forEach(function(name){
        if (clean[name] === undefined) return;
        ['nav1', 'nav2', 'nav3', 'nav4'].forEach(function(k){
          if (clean[name].indexOf('data-i18n="' + k + '"') < 0)
            fail(name + '.html is missing the ' + k + ' course-nav entry');
        });
      });
    }
  }
};
