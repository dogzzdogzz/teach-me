/* grade-4/math/quadrilateral —— 四邊形家族（垂直、平行、平行四邊形、梯形、菱形）
 *
 * 這一課的正確性幾乎全部是**幾何**，所以這份設定裡有一套**獨立重寫**的向量判定：
 * 頁面說某個形狀是菱形，這裡不看它的標籤，自己從座標算一次。
 *
 * 整數座標讓所有判定完全精確（不需要容差）：
 *   平行 ⟺ 外積 ＝ 0；垂直 ⟺ 內積 ＝ 0；等長 ⟺ 長度平方相等。
 * 唯一的陷阱是**零向量**：它對任何向量的內積與外積都是 0，所以每條邊都要先
 * 確認不是一個點 —— 少了這一關，一個退化的「四邊形」會被判成什麼都是。
 */

/* ---------- 獨立參考實作（不從頁面 import 任何判定） ---------- */
function vsubRef(a, b){ return [b[0] - a[0], b[1] - a[1]]; }
function dotRef(u, v){ return u[0] * v[0] + u[1] * v[1]; }
function crossRef(u, v){ return u[0] * v[1] - u[1] * v[0]; }
function len2Ref(u){ return dotRef(u, u); }
function isSegRef(u){ return u[0] !== 0 || u[1] !== 0; }
function perpRef(u, v){ return isSegRef(u) && isSegRef(v) && dotRef(u, v) === 0; }
function paraRef(u, v){ return isSegRef(u) && isSegRef(v) && crossRef(u, v) === 0; }
function sidesRef(pts){
  const s = [];
  for (let i = 0; i < 4; i++) s.push(vsubRef(pts[i], pts[(i + 1) % 4]));
  return s;
}
function pairsRef(pts){
  const s = sidesRef(pts);
  return (paraRef(s[0], s[2]) ? 1 : 0) + (paraRef(s[1], s[3]) ? 1 : 0);
}
function rightRef(pts){
  const s = sidesRef(pts);
  let n = 0;
  for (let i = 0; i < 4; i++) if (perpRef(s[i], s[(i + 1) % 4])) n++;
  return n;
}
function eq4Ref(pts){
  const s = sidesRef(pts).map(len2Ref);
  return s[0] === s[1] && s[1] === s[2] && s[2] === s[3];
}
/* 梯形採「只有一組對邊平行」的定義 —— 平行四邊形不是梯形。四頁一致。 */
function classifyRef(pts){
  const p = pairsRef(pts);
  if (p === 2){
    const r = rightRef(pts) === 4, e = eq4Ref(pts);
    return (r && e) ? 'square' : r ? 'rect' : e ? 'rhom' : 'para';
  }
  if (p === 1){
    const s = sidesRef(pts).map(len2Ref);
    return (s[0] === s[2] || s[1] === s[3]) ? 'isotrap' : 'trap';
  }
  return 'quad';
}
const PARENTS_REF = { para:[], rect:['para'], rhom:['para'], square:['rect', 'rhom'],
                      trap:[], isotrap:['trap'], quad:[] };
function ancestorsRef(k){
  const out = [], seen = {};
  (function walk(x){
    (PARENTS_REF[x] || []).forEach(p => { if (!seen[p]){ seen[p] = true; out.push(p); walk(p); } });
  })(k);
  return out;
}
/* 退化檢查：沒有零長邊、相鄰邊不共線（共線的話那不是四邊形，是三角形或線段）。 */
function degenerate(pts){
  if (!Array.isArray(pts) || pts.length !== 4) return 'not four points';
  for (const p of pts){
    if (!Array.isArray(p) || p.length !== 2) return 'a vertex is not an [x,y] pair';
    for (const v of p) if (!Number.isFinite(v)) return 'a coordinate is not a finite number: ' + v;
  }
  const s = sidesRef(pts);
  for (let i = 0; i < 4; i++){
    if (!isSegRef(s[i])) return 'side ' + i + ' has zero length';
    if (crossRef(s[i], s[(i + 1) % 4]) === 0) return 'sides ' + i + ' and ' + ((i + 1) % 4) + ' are collinear';
  }
  return null;
}

/* ---------- 選項文字（刻意重抄一份，用來獨立算出「正解應該長什麼樣」） ---------- */
const SHAPE_TXT = {
  zh:{ para:'平行四邊形', rect:'長方形', rhom:'菱形', square:'正方形',
       trap:'梯形', isotrap:'等腰梯形', quad:'一般四邊形' },
  en:{ para:'a parallelogram', rect:'a rectangle', rhom:'a rhombus', square:'a square',
       trap:'a trapezium', isotrap:'an isosceles trapezium', quad:'an ordinary quadrilateral' }
};
const REL_TXT = {
  zh:{ perp:'互相垂直', para:'互相平行', neither:'既不垂直也不平行' },
  en:{ perp:'perpendicular', para:'parallel', neither:'neither perpendicular nor parallel' }
};
const PAIRS_TXT = {
  zh:n => n === 0 ? '一組都沒有' : (n === 1 ? '只有一組' : '兩組'),
  en:n => n === 0 ? 'none' : (n === 1 ? 'exactly one pair' : 'two pairs')
};
const GUARD_TXT = {
  zh:{ oppSide:'對邊一樣長', right4:'四個角都是直角', side4:'四邊都一樣長',
       onePair:'只有一組對邊平行', noPara:'沒有對邊平行' },
  en:{ oppSide:'opposite sides are equal', right4:'all four angles are right angles',
       side4:'all four sides are equal', onePair:'exactly one pair of opposite sides is parallel',
       noPara:'no opposite sides are parallel' }
};
const GUARANTEED_BY = { para:'oppSide', rect:'right4', rhom:'side4' };

const fs = require('fs');
const path = require('path');

/* 要比對的是**讀者看得到的字**，所以三種東西都要先剝掉：
   - 註解：我自己寫在程式裡的「只有一組」不該算進次數；
   - HTML 標籤：`和<strong>長短無關</strong>` 讀起來是「和長短無關」，
     可是當成字串比對時中間卡著一個標籤，永遠對不上（第一版就是這樣漏掉的）；
   - HTML 實體：`&lt;` 之類的不會出現在讀者眼裡的中文詞裡，順手還原。 */
function stripComments(src){
  return src.replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/\/\*[\s\S]*?\*\//g, ' ');
}
/* ⚠️ 剝標籤只能用在「數讀者看到的詞」上，**絕對不可以**拿來掃程式結構：
   `<[^>]+>` 碰到 JS 裡的 `i < 4; i++){ … >` 會把中間整段吃掉，
   於是 GEN_IDS 掃描會以為好幾支產生器不見了（第一版就是這樣自爆的）。 */
function readerText(src){
  return stripComments(src)
            .replace(/<[^>]+>/g, '')
            .replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
}

/* 四頁必須用同一句話講同一條規則。min 是**剝掉註解之後**實際出現的次數 ——
   少於它就表示有一頁被改鬆了或整段被刪掉。 */
const SIBLING_RULES = [
  /* 「只有一組」是這一課唯一**四頁都必須逐字相同**的說法 —— 梯形和平行四邊形的
     分界全靠這四個字，任何一頁鬆口成「有一組」，整個家族分類就垮了。 */
  { file:'index',     text:'只有一組',       min:12, why:'is the whole boundary between a trapezium and a parallelogram' },
  { file:'reference', text:'只有一組',       min:6,  why:'is the whole boundary between a trapezium and a parallelogram' },
  { file:'review',    text:'只有一組',       min:4,  why:'is the whole boundary between a trapezium and a parallelogram' },
  { file:'parents',   text:'只有一組',       min:3,  why:'is the whole boundary between a trapezium and a parallelogram' },
  /* 其餘的規則允許各頁用自己的語氣（給孩子看的和給大人看的本來就不同），
     但每一頁自己的說法要在，被刪掉或改弱就要噴。 */
  { file:'index',     text:'兩組對邊都平行', min:5, why:'is the definition of a parallelogram' },
  { file:'reference', text:'兩組對邊都平行', min:2, why:'is the definition of a parallelogram' },
  { file:'review',    text:'兩組對邊都平行', min:4, why:'is the definition of a parallelogram' },
  { file:'parents',   text:'兩組都平行',     min:2, why:'is how the parents page states the parallelogram definition' },
  { file:'index',     text:'不再算梯形',     min:2, why:'is why a parallelogram is excluded from the trapezium family' },
  { file:'reference', text:'不再算梯形',     min:1, why:'is why a parallelogram is excluded from the trapezium family' },
  { file:'review',    text:'不再算梯形',     min:1, why:'is why a parallelogram is excluded from the trapezium family' },
  { file:'parents',   text:'不算梯形',       min:2, why:'is how the parents page states the same exclusion' },
  { file:'index',     text:'和長短無關',     min:2, why:'kills the "parallel means the same length" misconception' },
  { file:'reference', text:'和長短無關',     min:1, why:'kills the "parallel means the same length" misconception' },
  /* codex 2026-08-28：只問「叫什麼」的話，正方形同時也是長方形、菱形、平行四邊形，
     好幾個選項都答得通。題幹一定要問「最精確」。 */
  { file:'review',    text:'最精確',         min:2, why:'is what makes a naming question have exactly one correct answer' }
];

/* 產生器清單：改名或刪掉一整支，它那一組不變式、expectedCorrect 與
   renderCheck 會一起靜靜消失，什麼都不會噴。 */
const GEN_IDS = ['relation', 'perpTurned', 'paraLength', 'countPairs', 'nameByRule',
                 'nameShape', 'alsoIs', 'notAlways', 'trapBases', 'isoTrap',
                 'guaranteed', 'oddOneOut'];

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 幾何核心：判定寫錯必須被抓到 --- */
    { file:'index', via:'index', expect:'but the coordinates give',
      find:'if (isPara(s[0], s[2])) out.para.push([0, 2]);',
      replace:'if (isPerp(s[0], s[2])) out.para.push([0, 2]);',
      why:'marksOf uses perpendicular where it means parallel' },
    { file:'index', via:'index', expect:'zero vector',
      find:'function isPerp(u, v){ return isSeg(u) && isSeg(v) && dot(u, v) === 0; }',
      replace:'function isPerp(u, v){ return dot(u, v) === 0; }',
      why:'dropping the zero-vector guard makes a degenerate edge perpendicular to everything' },
    { file:'index', via:'index', expect:'zero vector',
      find:'function isPara(u, v){ return isSeg(u) && isSeg(v) && cross(u, v) === 0; }',
      replace:'function isPara(u, v){ return cross(u, v) === 0; }',
      why:'same guard on the parallel test' },
    { file:'index', via:'index', expect:'disagrees with the reference implementation',
      find:"      if (right === 4 && eq4) return 'square';",
      replace:"      if (right === 4 && eq4) return 'rect';",
      /* 抓到它的是「頁面的 classify() 和參考實作不一致」——
         比 QUADS.square 自己的標籤更早、也更準地指出問題。 */
      why:'a square would be reported as a rectangle' },
    { file:'index', via:'index', expect:'disagrees with the reference implementation',
      find:"    if (pairs === 1) return (len2(s[0]) === len2(s[2]) || len2(s[1]) === len2(s[3])) ? 'isotrap' : 'trap';",
      replace:"    if (pairs === 1) return 'isotrap';",
      why:'every trapezium would claim to be isosceles' },
    /* --- 梯形的定義：兩組平行不可以還算梯形 --- */
    { file:'index', via:'index', expect:'disagrees with the reference implementation',
      find:'    if (pairs === 2){\n      if (right === 4 && eq4)',
      replace:'    if (pairs === 2 && false){\n      if (right === 4 && eq4)',
      why:'parallelograms would fall through into the trapezium branch' },
    /* --- 圖上的記號 --- */
    { file:'index', via:'index', expect:'UNEQUAL yet the figure ticks them',
      find:'if (legs) return (len2(s[0]) === len2(s[2])) ? [[0, 2]] : [];',
      replace:'if (legs) return [[0, 2]];',
      why:'an ordinary trapezium would be drawn with equal-leg ticks' },
    { file:'index', via:'index', expect:'arrow/tick positions',
      find:'var T_ARROW = 0.50, T_TICK = 0.28;',
      replace:'var T_ARROW = 0.50, T_TICK = 0.50;',
      why:'arrows and ticks would be drawn on top of each other again' },
    /* --- 家族圖 --- */
    { file:'index', via:'index', expect:'ancestors(square) missing',
      find:"    { key:'square', parents:['rect', 'rhom'] }",
      replace:"    { key:'square', parents:['rect'] }",
      why:'a square would stop being a rhombus' },
    { file:'index', via:'index', expect:'para should have no ancestors',
      find:"    { key:'para',   parents:[] },",
      replace:"    { key:'para',   parents:['rect'] },",
      why:'the family tree would gain a cycle upwards' },
    { file:'index', via:'index', expect:'equal-length narration',
      find:"    var sameLen = (len2(vsub(c.a[0], c.a[1])) === len2(vsub(c.b[0], c.b[1])));",
      replace:"    var sameLen = (s2idx === 0);",
      why:'the slanted pair is equal-length too, but would be narrated as "very different lengths"' },
    /* --- 遊戲關卡的答案索引 --- */
    { file:'index', via:'index', expect:'computed answer is',
      find:"    { kind:'name', shape:'trap',        opts:['para', 'trap', 'rhom', 'square'],  ans:1 }",
      replace:"    { kind:'name', shape:'trap',        opts:['para', 'trap', 'rhom', 'square'],  ans:0 }",
      why:'a game round would mark the wrong option correct' },
    /* --- 題庫：選項重複、答案索引越界 --- */
    { file:'index', via:'index', expect:'duplicate options',
      find:"opts:['互相平行','互相垂直','一樣長','不相交'], ans:1,",
      replace:"opts:['互相平行','互相平行','一樣長','不相交'], ans:1,",
      why:'two identical options in the quiz' },
    { file:'index', via:'index', expect:'answer index differs',
      find:"        { stem:'下面哪一句話是對的？', opts:['正方形是長方形，也是菱形','長方形一定是正方形','平行四邊形一定是長方形','菱形的四個角一定是直角'], ans:0,",
      replace:"        { stem:'下面哪一句話是對的？', opts:['正方形是長方形，也是菱形','長方形一定是正方形','平行四邊形一定是長方形','菱形的四個角一定是直角'], ans:2,",
      why:'zh and en would disagree about which option is correct' },
    /* --- review 的產生器 --- */
    { file:'review', via:'review', expect:'is not the shape it claims',
      find:"      if (pts && classify(pts) === kind) return pts;",
      replace:"      if (pts) return pts;",
      why:'makeShape would stop verifying what it produced' },
    { file:'review', via:'review', expect:'not an ancestor',
      find:"        var right = pick(ups);",
      replace:"        var right = pick(SHAPES);",
      why:'alsoIs could mark a non-ancestor as the answer' },
    { file:'review', via:'review', expect:'reachable by correct reasoning',
      find:"          return k !== kind && ups.indexOf(k) < 0;      // 只有「不是它上層」的才能當誘答",
      replace:"          return k !== kind;",
      why:'a distractor in alsoIs could itself be a correct ancestor' },
    { file:'review', via:'review', expect:'is not a trapezium',
      find:"        var odd = pick(['trap', 'isotrap']);",
      replace:"        var odd = pick(['trap', 'isotrap', 'rhom']);",
      why:'oddOneOut could pick a parallelogram as the odd one out' },
    { file:'review', via:'review', expect:'bases are equal',
      find:"        var bot = top + pick(rangeList(2, 6));",
      replace:"        var bot = top;",
      why:'the trapezium in trapBases would have equal bases, contradicting its own explanation' },
    { file:'review', via:'review', expect:'legs',
      find:"          var leg2 = iso ? leg : leg + pick(rangeList(1, 4));",
      replace:"          var leg2 = leg;",
      why:'isoTrap would call an isosceles trapezium an ordinary one half the time' },
    /* --- codex review 2026-08-28 找到的十件事，每一件配一筆改壞 --- */
    { file:'review', via:'review', expect:'triangle inequality',
      find:"          if (Math.abs(leg - leg2) < diff && diff < leg + leg2){",
      replace:"          if (true){",
      why:'isoTrap would emit side lengths no trapezium can actually have' },
    { file:'review', via:'review', expect:'must ask for the',
      find:"          stem: lang === 'zh' ? '圖上這個四邊形，<strong>最精確</strong>的名字是什麼？（箭頭＝平行，短撇＝等長，小方框＝直角）'",
      replace:"          stem: lang === 'zh' ? '圖上這個四邊形叫什麼？（箭頭＝平行，短撇＝等長，小方框＝直角）'",
      why:'nameShape would go back to asking a question with several correct answers' },
    { file:'review', via:'review', expect:'which is one of the three options shown',
      find:"              + d.fam.map(function(k){ return bareName(t, k); }).join('、')",
      replace:"              + ['長方形', '菱形', '正方形'].join('、')",
      why:'oddOneOut would name shapes that are not among the three options shown' },
    { file:'review', via:'review', expect:'article was mangled',
      find:"  function capName(t, k){ var s = t.shape[k]; return s.charAt(0).toUpperCase() + s.slice(1); }",
      replace:"  function capName(t, k){ return t.shape[k].replace(/^an? /, 'A '); }",
      why:'"an isosceles trapezium" would render as "A isosceles trapezium"' }
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      relation: d => {
        if (!Array.isArray(d.u) || !Array.isArray(d.v)) return 'relation: missing a direction vector';
        if (!isSegRef(d.u) || !isSegRef(d.v)) return 'relation: a direction vector is the zero vector';
        const want = perpRef(d.u, d.v) ? 'perp' : (paraRef(d.u, d.v) ? 'para' : 'neither');
        if (d.key !== want) return 'relation: marked ' + d.key + ' but the vectors are ' + want;
        if (d.key === 'para') return 'relation: two crossing lines can never be the parallel case';
        if (d.opts.indexOf('sameLen') < 0) return 'relation: the length distractor is missing';
        if (d.dp !== dotRef(d.u, d.v)) return 'relation: the reported dot product is wrong';
        if (d.cp !== crossRef(d.u, d.v)) return 'relation: the reported cross product is wrong';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'relation: options are not four distinct choices';
        if (d.opts[d.ans] !== d.key) return 'relation: opts[ans] is not the computed relation';
      },
      perpTurned: d => {
        if (!(d.deg > 0 && d.deg < 90)) return 'perpTurned: the turn ' + d.deg + ' should be a visible turn under a right angle';
        if (d.opts[d.ans] !== 'still') return 'perpTurned: the answer must be that it stays perpendicular';
        if (new Set(d.opts).size !== d.opts.length) return 'perpTurned: duplicate options';
      },
      paraLength: d => {
        if (!(d.a > d.b)) return 'paraLength: the two lengths must differ visibly (' + d.a + ' vs ' + d.b + ')';
        if (d.opts[d.ans] !== 'yes') return 'paraLength: same width everywhere always means parallel';
      },
      countPairs: d => {
        const bad = degenerate(d.pts);
        if (bad) return 'countPairs: ' + bad;
        if (classifyRef(d.pts) !== d.kind) return 'countPairs: the shape is not the shape it claims (' + classifyRef(d.pts) + ' vs ' + d.kind + ')';
        if (d.n !== pairsRef(d.pts)) return 'countPairs: the marked count is not what the coordinates give';
        if (d.n === 0) return 'countPairs: this lesson never shows a quadrilateral with no parallel pair';
        if (d.opts.indexOf(3) < 0) return 'countPairs: the impossible "three pairs" distractor is missing';
        if (d.opts.length !== 4) return 'countPairs: there must be four counts to choose from';
        if (new Set(d.opts).size !== d.opts.length) return 'countPairs: duplicate options';
        if (d.opts[d.ans] !== d.n) return 'countPairs: opts[ans] is not the computed count';
      },
      nameByRule: d => {
        if (!SHAPE_TXT.zh[d.kind]) return 'nameByRule: unknown shape ' + d.kind;
        if (d.kind === 'isotrap') return 'nameByRule: the stated rule set does not distinguish an isosceles trapezium';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'nameByRule: options are not four distinct shapes';
        if (d.opts[d.ans] !== d.kind) return 'nameByRule: opts[ans] is not the described shape';
      },
      nameShape: d => {
        const bad = degenerate(d.pts);
        if (bad) return 'nameShape: ' + bad;
        if (classifyRef(d.pts) !== d.kind) return 'nameShape: the shape is not the shape it claims (' + classifyRef(d.pts) + ' vs ' + d.kind + ')';
        if (d.pairs !== pairsRef(d.pts)) return 'nameShape: the quoted parallel-pair count is wrong';
        if (d.right !== rightRef(d.pts)) return 'nameShape: the quoted right-angle count is wrong';
        if (d.eq4 !== eq4Ref(d.pts)) return 'nameShape: the quoted "all sides equal" flag is wrong';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'nameShape: options are not four distinct shapes';
        if (d.opts[d.ans] !== d.kind) return 'nameShape: opts[ans] is not the drawn shape';
        /* 題幹唸出來的三個事實必須**剛好**指向一個名字，否則誘答也講得通。 */
        const fits = d.opts.filter(k => {
          const facts = { para:[2,0,false], rect:[2,4,false], rhom:[2,0,true], square:[2,4,true],
                          trap:[1,0,false], isotrap:[1,0,false] }[k];
          return facts && facts[0] === d.pairs && (facts[1] === 4) === (d.right === 4) && facts[2] === d.eq4;
        });
        if (fits.length !== 1 && !(d.kind === 'trap' || d.kind === 'isotrap'))
          return 'nameShape: the quoted facts fit ' + fits.length + ' of the options (' + fits + ')';
      },
      alsoIs: d => {
        const ups = ancestorsRef(d.kind);
        if (!ups.length) return 'alsoIs: ' + d.kind + ' has no ancestor to ask about';
        /* 上層太多的形狀（正方形有三個）湊不出三個「不是上層」的誘答 —— 不該進這個產生器。 */
        if (ups.length > 6 - 1 - 3) return 'alsoIs: ' + d.kind + ' has ' + ups.length +
          ' ancestors, too many to build three distractors that are all genuinely wrong';
        if (ups.indexOf(d.right) < 0) return 'alsoIs: ' + d.right + ' is not an ancestor of ' + d.kind;
        /* 先問「誘答本身是不是也講得通」，再問相異 —— 順序反了的話，
           訊息會變成籠統的「選項重複」，看不出真正壞掉的是誘答的挑選規則。 */
        for (let i2 = 0; i2 < d.opts.length; i2++){
          if (i2 === d.ans) continue;            // 只跳過「正解那一格」，不是跳過所有等於正解的字
          const o = d.opts[i2];
          if (ups.indexOf(o) >= 0) return 'alsoIs: distractor ' + o + ' is reachable by correct reasoning — it is also an ancestor of ' + d.kind;
          if (o === d.kind) return 'alsoIs: the shape itself is offered as a distractor';
        }
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'alsoIs: options are not four distinct shapes';
        if (d.opts[d.ans] !== d.right) return 'alsoIs: opts[ans] is not the chosen ancestor';
      },
      notAlways: d => {
        if (ancestorsRef(d.b).indexOf(d.a) < 0)
          return 'notAlways: ' + d.b + ' is not ' + d.a + ' plus a condition, so "not necessarily" is not the answer';
        if (ancestorsRef(d.a).indexOf(d.b) >= 0)
          return 'notAlways: the pair is the wrong way round (' + d.a + ' is already ' + d.b + ')';
        if (d.opts[d.ans] !== 'maybe') return 'notAlways: the answer must be "not necessarily"';
        if (new Set(d.opts).size !== d.opts.length) return 'notAlways: duplicate options';
      },
      trapBases: d => {
        if (d.top === d.bot) return 'trapBases: the bases are equal, which the explanation says is impossible';
        if (!(d.bot > d.top)) return 'trapBases: the bottom base should be the longer one';
        if (d.opts[d.ans] !== 'no') return 'trapBases: a trapezium can never have equal bases';
      },
      isoTrap: d => {
        if (d.iso !== (d.leg === d.leg2)) return 'isoTrap: the isosceles flag disagrees with the two legs';
        if (d.top === d.bot) return 'isoTrap: the bases must differ or it is not a trapezium at all';
        /* 這些邊長要真的畫得出來：把一支腰平移過去會得到邊長為
           (腰1, 腰2, 下底−上底) 的三角形，必須滿足三角不等式。 */
        const diff = d.bot - d.top;
        if (!(Math.abs(d.leg - d.leg2) < diff && diff < d.leg + d.leg2))
          return 'isoTrap: no trapezium can have bases ' + d.top + '/' + d.bot + ' with legs ' +
                 d.leg + '/' + d.leg2 + ' — the triangle inequality |leg-leg2| < bot-top < leg+leg2 fails';
        const want = d.iso ? 'iso' : 'plain';
        if (d.opts[d.ans] !== want) return 'isoTrap: opts[ans] is ' + d.opts[d.ans] + ' but the legs say ' + want;
        if (d.opts.indexOf('paraq') < 0) return 'isoTrap: the parallelogram distractor is missing';
        if (new Set(d.opts).size !== d.opts.length) return 'isoTrap: duplicate options';
      },
      guaranteed: d => {
        if (GUARANTEED_BY[d.kind] !== d.right)
          return 'guaranteed: ' + d.right + ' is not the property ' + d.kind + ' guarantees';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'guaranteed: options are not four distinct properties';
        /* 誘答不可以是這個形狀也保證的性質。 */
        const alsoTrue = { para:['oppSide'], rect:['oppSide', 'right4'], rhom:['oppSide', 'side4'] }[d.kind] || [];
        for (const o of d.opts){
          if (o === d.right) continue;
          if (alsoTrue.indexOf(o) >= 0) return 'guaranteed: distractor ' + o + ' is also guaranteed for ' + d.kind;
        }
        if (d.opts[d.ans] !== d.right) return 'guaranteed: opts[ans] is not the guaranteed property';
      },
      oddOneOut: d => {
        if (pairsRefOfKind(d.odd) !== 1) return 'oddOneOut: ' + d.odd + ' is not a trapezium, so it is not the odd one out';
        if (d.fam.length !== 3 || new Set(d.fam).size !== 3) return 'oddOneOut: the three parallelograms are not three distinct shapes';
        for (const k of d.fam){
          if (pairsRefOfKind(k) !== 2) return 'oddOneOut: distractor ' + k + ' is not a parallelogram';
        }
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'oddOneOut: options are not four distinct shapes';
        if (d.opts[d.ans] !== d.odd) return 'oddOneOut: opts[ans] is not the trapezium';
      }
    },

    /* 正解的文字由這裡**獨立算一次**，不看 d.ans 指到哪個選項。 */
    expectedCorrect: function(d, genId, lang){
      const S = SHAPE_TXT[lang], R = REL_TXT[lang];
      switch (genId){
        case 'relation':   return R[perpRef(d.u, d.v) ? 'perp' : (paraRef(d.u, d.v) ? 'para' : 'neither')];
        // 'sameLen' 永遠不是正解：它講長度，不是兩條線的關係
        case 'perpTurned': return lang === 'zh' ? '還是垂直' : 'Still perpendicular';
        case 'paraLength': return lang === 'zh' ? '平行' : 'They are parallel';
        case 'countPairs': return PAIRS_TXT[lang](pairsRef(d.pts));
        case 'nameByRule': return S[d.kind];
        case 'nameShape':  return S[classifyRef(d.pts)];
        case 'alsoIs':     return S[d.right];
        case 'notAlways':  return lang === 'zh' ? '不一定' : 'Not necessarily';
        case 'trapBases':  return lang === 'zh' ? '不可能，一定不一樣長' : 'Impossible — they are never equal';
        case 'isoTrap':    return (d.leg === d.leg2)
                                   ? (lang === 'zh' ? '等腰梯形' : 'An isosceles trapezium')
                                   : (lang === 'zh' ? '一般的梯形（不是等腰）' : 'An ordinary trapezium (not isosceles)');
        case 'guaranteed': return GUARD_TXT[lang][GUARANTEED_BY[d.kind]];
        case 'oddOneOut':  return S[d.odd];
        default: return null;
      }
    },

    /* 選項字串本身的健康檢查：不可以漏字、不可以印出程式內部的值。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (!s || !s.trim()) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(s)) return 'option leaks an internal value: ' + s;
      if (/<[a-z]/i.test(s)) return 'option contains markup: ' + s;
      if (lang === 'en' && /[㐀-鿿]/.test(s)) return 'English option contains Chinese: ' + s;
      return null;
    },

    /* 渲染後再驗一次：選項兩兩相異、題幹與說明都在、圖形是合法四邊形。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length < 3) out.push('fewer than three options');
      if (new Set(q.opts).size !== q.opts.length) out.push('two options render to the same text: ' + q.opts.join(' | '));
      if (!(q.ans >= 0 && q.ans < q.opts.length)) out.push('answer index out of range');
      if (lang === 'en' && /[㐀-鿿]/.test(q.stem + q.why)) out.push('English question contains Chinese');
      if (q.fig){
        const bad = degenerate(q.fig);
        if (bad) out.push('figure is not a valid quadrilateral: ' + bad);
        else {
          /* 圖上畫的形狀，必須就是說明裡講的那一個。 */
          const drawn = classifyRef(q.fig);
          if (SHAPE_TXT[lang][drawn] && q.why.indexOf(SHAPE_TXT[lang][drawn]) < 0 && genId === 'nameShape')
            out.push('the explanation never names the shape that is actually drawn (' + drawn + ')');
        }
      }
      /* 問「叫什麼」而選項裡有它的上層，等於好幾個答案都對 ——
         題幹一定要問「最精確」的名字。 */
      if (genId === 'nameShape' || genId === 'nameByRule'){
        const cue = (lang === 'zh') ? '最精確' : 'most specific';
        if (q.stem.indexOf(cue) < 0)
          out.push('a naming question whose options include ancestor families must ask for the ' + cue + ' name');
      }
      /* oddOneOut 的說明要列出「畫面上真的出現的那三個」，不可以寫死。
         ⚠️ 不可以一個一個名字去比對：說明裡本來就有「所以不是平行四邊形」，
         單獨比對「平行四邊形」會命中那一句，寫死的清單照樣過關。
         要比對的是**整串照 d.fam 順序接起來的清單**。 */
      if (genId === 'oddOneOut'){
        const listed = d.fam.map(k => SHAPE_TXT[lang][k].replace(/^an? /, ''))
                            .join(lang === 'zh' ? '、' : ', ');
        if (q.why.indexOf(listed) < 0)
          out.push('the explanation does not list the three options actually shown (' + listed +
                   '), which is one of the three options shown');
      }
      /* 英文冠詞：句首大寫不可以把 "an isosceles" 變成 "A isosceles"。 */
      if (lang === 'en' && /\bA (?=[aeiou])/.test(q.why + ' ' + q.stem))
        out.push('English text has "A" before a vowel — the article was mangled by capitalisation');
      /* 說明如果引用了數字，那個數字要真的在題幹裡出現過。 */
      const nums = (q.why.match(/\d+/g) || []);
      for (const n of nums){
        if (n.length >= 2 && q.stem.indexOf(n) < 0 && q.why.indexOf(n + ' 度') < 0)
          out.push('the explanation cites ' + n + ' but the stem never says it');
      }
      /* ⚠️ 一定要回字串或 null：空陣列 [] 在 JS 裡是 truthy，
         simgen 的 `if (r) fail(...)` 會把「沒問題」當成「有問題」，
         而且訊息是空的 —— 看起來像每一題都壞了。 */
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{PERP_CASES, PARA_CASES, QUADS, PARA_FAMILY, TRAP_FAMILY, FAMILY, ROUNDS, ' +
                'sidesOf, classify, marksOf, eqGroups, ancestors, roundAnswer, ' +
                'isPerp, isPara, isSeg, len2, dot, cross, T_ARROW, T_TICK}',

    check: function(data, I18N, fail, src){
      const { QUADS, PERP_CASES, PARA_CASES, ROUNDS, PARA_FAMILY, TRAP_FAMILY } = data;

      /* 1. 每個形狀都必須是它自己宣告的那一種 —— 由座標獨立算。 */
      for (const k of Object.keys(QUADS)){
        const bad = degenerate(QUADS[k]);
        if (bad) fail('QUADS.' + k + ': ' + bad);
        else if (classifyRef(QUADS[k]) !== k) fail('QUADS.' + k + ' classifies as ' + classifyRef(QUADS[k]));
        if (data.classify(QUADS[k]) !== classifyRef(QUADS[k]))
          fail('QUADS.' + k + ': the page classify() disagrees with the reference implementation');
      }
      /* 1a. marksOf 決定圖上畫哪些記號 —— 它和分類是兩段獨立的程式，要分別驗。
             （只驗 classify 的話，記號畫錯的圖可以一路綠燈。） */
      for (const k of Object.keys(QUADS)){
        const pts = QUADS[k], s2 = sidesRef(pts), m = data.marksOf(pts);
        const wantPara = [];
        if (paraRef(s2[0], s2[2])) wantPara.push('0,2');
        if (paraRef(s2[1], s2[3])) wantPara.push('1,3');
        const gotPara = m.para.map(x => x.join(',')).sort().join(' | ');
        if (gotPara !== wantPara.sort().join(' | '))
          fail('marksOf(' + k + ').para = [' + gotPara + '] but the coordinates give [' + wantPara.join(' | ') + ']');
        const wantRight = [];
        for (let i = 0; i < 4; i++) if (perpRef(s2[i], s2[(i + 1) % 4])) wantRight.push((i + 1) % 4);
        if (m.right.slice().sort().join(',') !== wantRight.sort().join(','))
          fail('marksOf(' + k + ').right = [' + m.right + '] but the right angles are at [' + wantRight + ']');
      }
      /* 1b. 箭頭和短撇不可以畫在邊上的同一點。 */
      if (!(data.T_ARROW > 0 && data.T_ARROW < 1) || !(data.T_TICK > 0 && data.T_TICK < 1))
        fail('arrow/tick positions must be fractions strictly inside the edge');
      if (data.T_ARROW === data.T_TICK)
        fail('arrow/tick positions are identical — the two marks would be drawn on top of each other');
      /* 2. 零向量必須被擋下來。 */
      if (data.isPara([0, 0], [1, 1]) || data.isPerp([0, 0], [1, 1]))
        fail('a zero vector is treated as a segment — every degenerate edge would count as parallel and perpendicular');
      /* 3. 梯形與平行四邊形互斥。 */
      for (const k of PARA_FAMILY){
        if (TRAP_FAMILY.indexOf(classifyRef(QUADS[k])) >= 0) fail(k + ' is classified as a trapezium');
      }
      /* 4. 梯形：剛好一組平行，上底下底不等長；兩腰只在真的等長時才標短撇。 */
      for (const k of TRAP_FAMILY){
        const pts = QUADS[k], s = sidesRef(pts).map(len2Ref);
        if (pairsRef(pts) !== 1){ fail(k + ' has ' + pairsRef(pts) + ' parallel pairs, expected exactly 1'); continue; }
        const bases = paraRef(sidesRef(pts)[0], sidesRef(pts)[2]) ? [0, 2] : [1, 3];
        if (s[bases[0]] === s[bases[1]]) fail(k + ': the two bases are equal — that makes it a parallelogram');
        const legs = [0, 1, 2, 3].filter(i => bases.indexOf(i) < 0);
        const marked = data.eqGroups(pts, true).flat();
        for (const m of marked) if (bases.indexOf(m) >= 0) fail(k + ': a leg tick is drawn on a base');
        if ((s[legs[0]] === s[legs[1]]) && marked.length !== 2) fail(k + ': legs are equal but ' + marked.length + ' ticked');
        if ((s[legs[0]] !== s[legs[1]]) && marked.length) fail(k + ': legs are UNEQUAL yet the figure ticks them as equal');
      }
      /* 5. 家族樹。 */
      const a = data.ancestors('square');
      if (new Set(a).size !== a.length) fail('ancestors(square) has duplicates: ' + a);
      for (const k of ['rect', 'rhom', 'para']) if (a.indexOf(k) < 0) fail('ancestors(square) missing ' + k);
      if (data.ancestors('para').length) fail('para should have no ancestors');
      for (const k of ['para', 'rect', 'rhom', 'square']){
        const mine = data.ancestors(k).slice().sort().join(','), ref = ancestorsRef(k).slice().sort().join(',');
        if (mine !== ref) fail('ancestors(' + k + ') = [' + mine + '] but the reference gives [' + ref + ']');
      }
      /* 6. 垂直與平行的樣本。 */
      PERP_CASES.forEach((c, i) => {
        if (!perpRef(c.u, c.v)) fail('PERP_CASES[' + i + '] dot=' + dotRef(c.u, c.v) + ', not perpendicular');
      });
      if (!PERP_CASES.some(c => c.turned)) fail('no turned perpendicular case — the "must be one across, one upright" misconception is never challenged');
      PARA_CASES.forEach((c, i) => {
        const u = vsubRef(c.a[0], c.a[1]), v = vsubRef(c.b[0], c.b[1]);
        if (paraRef(u, v) !== !!c.para) fail('PARA_CASES[' + i + '].para=' + c.para + ' but cross=' + crossRef(u, v));
      });
      if (!PARA_CASES.some(c => !c.para)) fail('PARA_CASES has no counter-example, so "parallel" is never contrasted');
      if (!PARA_CASES.some(c => c.para && len2Ref(vsubRef(c.a[0], c.a[1])) !== len2Ref(vsubRef(c.b[0], c.b[1]))))
        fail('no parallel pair with different lengths — the "parallel means same length" misconception is never challenged');
      /* 旁白說「一樣長 / 長短差很多」，那句話必須和座標一致。原本它是用
         「是不是第 0 筆」判斷的，於是第 2 筆（斜的，其實一樣長）被講成長短差很多。 */
      if (!/var sameLen = \(len2\(vsub\(c\.a\[0\], c\.a\[1\]\)\) === len2\(vsub\(c\.b\[0\], c\.b\[1\]\)\)\);/.test(src))
        fail('the equal-length narration is not computed from the coordinates');
      /* 7. 遊戲：每一關的答案位置都要指到重算出來的答案。 */
      ROUNDS.forEach((r, i) => {
        const want = data.roundAnswer(r);
        if (r.opts[r.ans] !== want) fail('round ' + (i + 1) + ': ans points at ' + r.opts[r.ans] + ', computed answer is ' + want);
        if (new Set(r.opts).size !== r.opts.length) fail('round ' + (i + 1) + ': duplicate option keys');
      });
      /* 8. 靜態題庫：zh/en 完全對齊，選項不重複，答案索引在範圍內。 */
      for (const bank of ['qs', 'qsAdv', 'qsBoost']){
        if (I18N.zh[bank].length !== I18N.en[bank].length){ fail(bank + ' length differs between zh and en'); continue; }
        I18N.zh[bank].forEach((q, i) => {
          const e = I18N.en[bank][i];
          if (q.ans !== e.ans) fail(bank + '[' + i + '] answer index differs: zh=' + q.ans + ' en=' + e.ans);
          if (q.opts.length !== e.opts.length) fail(bank + '[' + i + '] option count differs');
          for (const [tag, x] of [['zh', q], ['en', e]]){
            if (new Set(x.opts).size !== x.opts.length) fail(bank + '[' + i + '] ' + tag + ': duplicate options');
            if (!(x.ans >= 0 && x.ans < x.opts.length)) fail(bank + '[' + i + '] ' + tag + ': answer index out of range');
            if (!x.why || !x.why.trim()) fail(bank + '[' + i + '] ' + tag + ': no explanation');
          }
          if (/[㐀-鿿]/.test(e.stem + e.opts.join('') + e.why)) fail(bank + '[' + i + '] en contains Chinese');
        });
      }
      /* 9. zh/en 頂層鍵必須一一對應。 */
      const zk = Object.keys(I18N.zh).sort().join(','), ek = Object.keys(I18N.en).sort().join(',');
      if (zk !== ek) fail('zh and en have different key sets');

      /* 10. 四頁的措辭。⚠️ 路徑要從 process.argv[2] 推：用 __dirname 會讀到**真的 repo**，
             改壞測試複製出去的那一份永遠不會被看到，斷言就變成永遠是綠的。 */
      const dir = path.dirname(process.argv[2]);
      const SRC = {}, TEXT = {};
      for (const f of ['index', 'reference', 'parents', 'review']){
        const fp = path.join(dir, f + '.html');
        if (!fs.existsSync(fp)){ fail(f + '.html is missing, so its wording was never checked'); continue; }
        const raw = fs.readFileSync(fp, 'utf8');
        SRC[f] = stripComments(raw);      // 結構掃描用：保留程式碼原樣
        TEXT[f] = readerText(raw);        // 詞語比對用：只剩讀者看得到的字
      }
      SIBLING_RULES.forEach(rule => {
        const text = TEXT[rule.file];
        if (text === undefined) return;
        let count = 0, at = -1;
        while ((at = text.indexOf(rule.text, at + 1)) >= 0) count++;
        if (count < rule.min)
          fail(rule.file + '.html says "' + rule.text + '" ' + count + ' time(s), expected at least ' +
               rule.min + ' — it ' + rule.why);
      });

      /* 11. 產生器一支都不能少，也不能多出設定檔沒描述的。 */
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
      }
    }
  },

  /* ================= 跨頁用詞釘樁 =================
     同一條規則在四頁必須用同一句話講。這一課最危險的是「梯形只有一組」——
     只要有一頁鬆口說成「有一組」，整個家族的分界就垮了。
     實際的比對在 data.check 裡（SIBLING_RULES 只是資料，沒有人跑它就等於沒釘）。 */
  SIBLING_RULES: SIBLING_RULES,
  GEN_IDS: GEN_IDS
};

/* 一個 kind 名義上有幾組對邊平行 —— 給 oddOneOut 用（它只拿名字，沒有座標）。 */
function pairsRefOfKind(k){
  return { para:2, rect:2, rhom:2, square:2, trap:1, isotrap:1, quad:0 }[k];
}
