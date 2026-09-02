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
const VERIFIED_REF = 90;
const FINGERPRINT_REF = '10514078101f4f444031b954f28d9a116f71739e';
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
/* 一段弧掃過的範圍（含中間的極值點），再加上線寬的一半。
   ⚠️ 只看兩個端點是不夠的：一段弧可以在**中間**凸出畫布，兩個端點卻都在裡面。 */
function arcBoxRef(cx, cy, fromDeg, toDeg, r, halfStroke){
  /* ⚠️ 讀不懂就回 null 由呼叫端報錯：NaN 算出來的 box 每一個比較都是 false（全通過）。 */
  if (![cx, cy, fromDeg, toDeg, r, halfStroke || 0].every(Number.isFinite)) return null;
  if (!(r > 0)) return null;
  const lo = Math.min(fromDeg, toDeg), hi = Math.max(fromDeg, toDeg);
  const xs = [], ys = [];
  [fromDeg, toDeg].forEach(function(d){
    xs.push(cx + r * Math.cos(d * Math.PI / 180));
    ys.push(cy - r * Math.sin(d * Math.PI / 180));
  });
  /* 每一個「正東／正北／正西／正南」只要落在掃過的範圍裡，就是一個極值點。 */
  for (let k = -720; k <= 720; k += 90){
    if (k >= lo && k <= hi){
      xs.push(cx + r * Math.cos(k * Math.PI / 180));
      ys.push(cy - r * Math.sin(k * Math.PI / 180));
    }
  }
  const h = halfStroke || 0;
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
  return { cx:cx, cy:cy, r:r1,
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
  return { r:r1,
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
  { text:'角的大小和邊畫多長沒有關係', files:{ index:4, reference:2 } },
  { text:'15 的倍數', files:{ index:14, reference:11, review:4 } },
  { text:'165', files:{ index:16, reference:3, review:3 } },
  { text:'斜對面', files:{ index:12, reference:3, review:3, parents:6 } },
  { text:'兩塊加起來還是原來那個角', files:{ index:6, reference:2, review:1, parents:2 } },
  { text:'共用一條邊', files:{ index:7, reference:8, review:2 } },
  { text:'不可以重疊', files:{ index:3, parents:2 } },
  { text:'露出來', files:{ index:13, reference:6, review:4, parents:2 } },
  { text:'反過來', files:{ index:2, reference:2 } },
  { text:'各出一個角', files:{ index:5, reference:2, review:2 } }
];
const SIBLING_RULES_EN = [
  { text:'has nothing to do with how long its sides are drawn', files:{ index:3, reference:1 } },
  { text:'multiple of 15', files:{ index:4, reference:4, review:2 } },
  { text:'diagonally across', files:{ index:5, reference:2, review:2, parents:2 } },
  { text:'add up to the angle you started with', files:{ index:3, reference:1, review:1 } },
  { text:'left showing', files:{ index:10, reference:3, review:4, parents:1 } },
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
function keyValues(clean, key){
  /* key:'…'（單引號，允許 \' 轉義）。中英兩本字典都會抓到，所以回傳一個陣列。 */
  const re = new RegExp('(?:^|[\\s{,])' + key + "\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'", 'g');
  const out = [];
  let m;
  while ((m = re.exec(clean)) !== null) out.push(m[1]);
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
  /* markup 裡的 `//`（網址）不可以碰，所以只在 <script> 區塊裡掃。 */
  return src.replace(/<script[\s\S]*?<\/script>/gi, function(block){ return stripJsComments(block); });
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

    /* --- 遊戲 --- */
    { file:"index", via:"index", expect:"ROUNDS[2]",
      find:"    { kind:'shapeOpp', shape:2, corner:0, opts:['90', '60', '30', '150'], ans:1 },",
      replace:"    { kind:'shapeOpp', shape:2, corner:0, opts:['90', '60', '30', '150'], ans:0 },",
      why:"the game would mark the neighbouring angle as the opposite one" },
    { file:"index", via:"index", expect:"an option uses an angle no set square carries",
      find:"      combos:[{ op:'join', a:45, b:30 }, { op:'join', a:90, b:30 },",
      replace:"      combos:[{ op:'join', a:45, b:30 }, { op:'join', a:90, b:15 },",
      why:"a distractor would offer a 15° angle that no set square carries — and it stays a distractor, so the unique-answer assertion cannot fire first" },
    { file:"index", via:"index", expect:"exactly one option must build",
      find:"      combos:[{ op:'join', a:45, b:30 }, { op:'lay', a:45, b:30 },\n              { op:'lay', a:90, b:30 }, { op:'lay', a:90, b:45 }], ans:1 },",
      replace:"      combos:[{ op:'join', a:45, b:30 }, { op:'lay', a:45, b:30 },\n              { op:'lay', a:60, b:45 }, { op:'lay', a:90, b:45 }], ans:1 },",
      why:"two options would build 15°, so a child reasoning correctly could be marked wrong" },
    { file:"index", via:"index", expect:"must use an angle that really needs three pieces",
      find:"    { kind:'minPieces', target:165, opts:['2', '3', '4', '5'], ans:1 }",
      replace:"    { kind:'minPieces', target:150, opts:['2', '3', '4', '5'], ans:1 }",
      why:"150° takes two pieces, so the round would teach the wrong count" },
    { file:"index", via:"index", expect:"game figure caption",
      find:"      gCapSplit:'📐 橘色那一塊是量到的，藍色那一塊是剩下的',",
      replace:"      gCapSplit:'📐 橘色那一塊是量到的 25°，藍色那一塊是剩下的',",
      why:"the caption under the game figure would print a number from the question" },
    { file:"index", via:"index", expect:"roundFig() disagrees",
      find:"    if (r.kind === 'splitRest') return { kind:'split', cut:r.cut };\n    return null;",
      replace:"    if (r.kind === 'splitRest') return { kind:'split', cut:r.cut };\n    if (r.kind === 'makeCombo') return { kind:'split', cut:30 };\n    return null;",
      why:"the two 'pick the method' rounds would come with a picture, which is where the answer would be visible" },

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
                'ROUNDS, minPieces, roundAnswer, roundFig}',
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
      const vbCount = countOf(src, 'viewBox="0 0 ' + CANVAS_W_REF + ' ' + CANVAS_H_REF + '"');
      if (vbCount !== 6)
        fail('expected 6 figure canvases on the lesson page (five examples + the game), found ' + vbCount);
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
        else if (Math.abs(arc.span - c.big) > 1e-3)
          fail(label + ': the outer arc must span the original ' + c.big + '°');
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

      /* ---------- 4) 遊戲 ---------- */
      if (data.ROUNDS.length !== 5) fail('the game has five orders');
      const kinds = {};
      data.ROUNDS.forEach(function(r, i){
        kinds[r.kind] = (kinds[r.kind] || 0) + 1;
        const label = 'ROUNDS[' + i + ']';
        const ans = data.roundAnswer(r);
        if (ans === null || ans === undefined) fail(label + ': roundAnswer() gave nothing');
        if (r.kind === 'makeCombo'){
          const vals = r.combos.map(function(c){ return c.op === 'join' ? c.a + c.b : c.a - c.b; });
          const hits = vals.filter(function(v){ return v === r.target; }).length;
          if (hits !== 1) fail(label + ': exactly one option must build ' + r.target + '°, found ' + hits);
          if (vals[r.ans] !== r.target) fail(label + ': the marked option does not build the target');
          if (new Set(vals).size !== vals.length) fail(label + ': two options build the same angle');
          r.combos.forEach(function(c){
            if (ANGLE_SET_REF.indexOf(c.a) < 0 || ANGLE_SET_REF.indexOf(c.b) < 0)
              fail(label + ': an option uses an angle no set square carries (' + c.a + '/' + c.b + ')');
            if (!crossLegalRef(c))
              fail(label + ': an option needs two corners of the same set square (' + c.a + '/' + c.b + ')');
            if (c.op === 'lay' && !(c.a > c.b)) fail(label + ': a lay must put the smaller angle on top');
          });
          if (String(data.comboValue(r.combos[r.ans])) !== ans)
            fail(label + ': roundAnswer() disagrees with the marked option');
        } else {
          if (r.opts[r.ans] !== ans) fail(label + ': opts[ans]=' + r.opts[r.ans] + ' but roundAnswer()=' + ans);
          if (new Set(r.opts).size !== r.opts.length) fail(label + ': duplicate options');
        }
        if (r.kind === 'shapeOpp'){
          const pl = data.shapePlan(r.shape);
          if (pl.allRight) fail(label + ': asking for the opposite angle of a right-angled shape is trivial');
          if (String(pl.angles[data.oppositeIndex(r.corner)]) !== ans)
            fail(label + ': the answer is not the opposite angle');
          if (pl.angles[(r.corner + 1) % 4] === pl.angles[r.corner])
            fail(label + ': neighbour and opposite are equal, so the question has two answers');
          /* ⚠️ 「旁邊那一個角」不可以當誘答：那個數字只有這一課不教的規則算得出來。 */
          if (r.opts.indexOf(String(pl.angles[(r.corner + 1) % 4])) >= 0)
            fail(label + ': the neighbouring angle (' + pl.angles[(r.corner + 1) % 4] +
                 '°) must not be offered — it needs a rule this lesson does not teach');
        }
        if (r.kind === 'splitRest'){
          if (String(RIGHT_REF - r.cut) !== ans) fail(label + ': the other piece is not 90 minus the cut');
          if (r.cut === RIGHT_REF - r.cut) fail(label + ': the answer repeats the number in the question');
        }
        if (r.kind === 'minPieces'){
          if (minPiecesRef(r.target) !== 3)
            fail(label + ': this round must use an angle that really needs three pieces');
          if (String(minPiecesRef(r.target)) !== ans) fail(label + ': the piece count is wrong');
        }
        const fig = data.roundFig(r);
        const wantFig = (r.kind === 'shapeOpp' || r.kind === 'splitRest');
        if (!!fig !== wantFig) fail(label + ': roundFig() disagrees with which rounds get a picture');
        if (fig && ['shape', 'split'].indexOf(fig.kind) < 0) fail(label + ': unknown figure kind');
      });
      if (!kinds.makeCombo || !kinds.shapeOpp || !kinds.splitRest || !kinds.minPieces)
        fail('the game must cover all four kinds of order');
      ['zh', 'en'].forEach(function(lang){
        const d = I18N[lang];
        [d.gCapShape, d.gCapSplit].forEach(function(cap, i){
          if (/\d/.test(String(cap)))
            fail('game figure caption ' + i + ' (' + lang + ') contains a digit: ' + cap);
        });
        ['makeCombo', 'shapeOpp', 'splitRest', 'minPieces'].forEach(function(k){
          if (typeof d.gHint1[k] !== 'string') fail('gHint1.' + k + ' missing in ' + lang);
          if (typeof d.gHint2[k] !== 'function') fail('gHint2.' + k + ' missing in ' + lang);
        });
      });

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
        data.ROUNDS.forEach(function(r){
          if (r.kind === 'makeCombo'){
            narrated.push([lang, 'gPrompt', d.gPrompt.makeCombo(r.target)]);
            narrated.push([lang, 'gHint2', d.gHint2.makeCombo(r.target)]);
            r.combos.forEach(function(c){ narrated.push([lang, 'comboText', d.comboText(c)]); });
          } else if (r.kind === 'shapeOpp'){
            const pl = data.shapePlan(r.shape);
            narrated.push([lang, 'gPrompt',
              d.gPrompt.shapeOpp(d.shapeName[pl.id], d.cornerName[r.corner], pl.angles[r.corner])]);
            narrated.push([lang, 'gHint2', d.gHint2.shapeOpp(pl.angles[r.corner])]);
          } else if (r.kind === 'splitRest'){
            narrated.push([lang, 'gPrompt', d.gPrompt.splitRest(r.cut)]);
            narrated.push([lang, 'gHint2', d.gHint2.splitRest(r.cut)]);
          } else {
            narrated.push([lang, 'gPrompt', d.gPrompt.minPieces(r.target)]);
            narrated.push([lang, 'gHint2', d.gHint2.minPieces(r.target)]);
          }
        });
        narrated.push([lang, 'gWrong0', d.gWrong(0)]);
        narrated.push([lang, 'gWrong5', d.gWrong(5)]);
        narrated.push([lang, 'gWin', d.gWin(100)]);
      });
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
        if (!vals.length){
          fail('KEY: ' + rule.file + '.html has no ' + rule.key + " value to pin the rule to");
          return;
        }
        /* 中文那一本一定要有；英文那一本用 SIBLING_RULES_EN 顧。 */
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
            const win = hay.slice(Math.max(0, k - h.span), k + h.word.length + h.span);
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
