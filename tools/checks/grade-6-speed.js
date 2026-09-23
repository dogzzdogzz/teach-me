/* grade-6/math/speed —— 速率測速站（速率、距離、時間；時速／分速／秒速；大單位換到小單位；平均速率）
 *
 * 這一課的正確性有五塊，所以這份設定裡有五套**獨立重寫**的實作，都不呼叫課程頁的函式：
 *
 * 1) 「三個量」。課程頁直接做整數除法（d % t、d / t）；這裡**走約分之後的分數**：
 *    速率 ＝ 距離 / 時間 約分之後分母必須是 1，範圍另外檢查。
 * 2) 「換單位」。課程頁用 M_PER／SEC_PER／RANK 三張表；這裡**全部換成「每秒幾公尺」的分數**
 *    再換到目標單位，而「只做大單位到小單位」是用**時間與長度單位各自的大小**判斷（不是 RANK 表）。
 * 3) 「換算梯子」。每一列都重算一次，而且梯子本身要**說得通**：每往下一列，
 *    這一列的「時間」和「距離」都必須等於上一列的時間與距離各自換過單位之後的樣子（同一個快慢）。
 * 4) 課程明講的規則這裡是**列舉證明**，不是文案：
 *    - 「時間一樣，走得遠的快；距離一樣，花得少的快」→ 對每一組 (v, t) 驗。
 *    - 「走得比較遠不一定比較快」→ 範例 1 後兩題、試題迷思題、產生器 compareMix 都要**真的**是「遠的那一個比較慢」。
 *    - 「速率一樣時，時間變成幾倍，距離就變成幾倍」→ 對每一組 (v, t, k) 驗。
 *    - 「兩段路的平均速率不是兩個速率加起來除以 2」→ 產生器每一組都驗兩者**不相等**，而且平均速率夾在兩段中間。
 * 5) ⚠️ **從畫出來的跑道量回來**：每一個圖元座標在這裡重算一次再逐一比對，印成 SVG 餵 lib/canvas.js 驗四個邊；
 *    另外驗三件「畫的是不是那件事」：每一段一樣長（等速）；兩條跑道用**同一把尺**（長度和距離成正比）；
 *    段比較長的那一條就是比較快的那一個；遊戲「求時間」那一關**不可以把段數畫出來**（那是答案）。
 *
 * ⚠️ 這一課都是整數，但仍然用 `lib/decarith.js`（它對整數一樣精確，而且認得全形數字、括號、fail-closed 的那幾種形狀）。
 * ⚠️ **算式裡不可以夾單位**（`80 公尺 × 5`），下面 UNIT_IN_EQ 專門擋它。
 * ⚠️ decarith 的唯一 fail-open 是「左邊不是數字的等號」，所以四頁一律寫「一段是 1 分鐘走的路」，不寫「一段 ＝ 1 分鐘」。
 */

const fs = require('fs');
const path = require('path');
const { canvasProblems } = require('./lib/canvas.js');
const { decArith, seen: DEC_SEEN } = require('./lib/decarith.js')();

/* ---------- 0) 參考常數：獨立寫死的第二份，不從課程頁讀 ---------- */
const V_MAX_REF = { mps:40, mpm:2400, kmh:144 };
const T_MAX_REF = 120, D_MAX_REF = 100000;
const FIG_W_REF = 460, FIG_H_REF = 200;
const LABEL_X_REF = 16, LABEL_A_Y_REF = 20, LABEL_B_Y_REF = 192, LABEL_FS_REF = 14, LABEL_MAX_REF = 26;
const TRK_X0_REF = 40, TRK_W_REF = 380, TRK_H_REF = 26, TRK_Y_ONE_REF = 92, TRK_Y_TWO_REF = [56, 128];
const SEG_MAX_REF = 12, SEG_MIN_W_REF = 14, TRK_FS_REF = 14, TRK_TOP_DY_REF = 8, TRK_BOT_DY_REF = 18;
const C_LINE_REF = '#2B2A33', C_ORANGE_REF = '#E8871E', C_REST_REF = '#F2EEE6';
const TRK_FILL_REF = [['#BBD5F4', '#FFFFFF'], ['#C9EBD8', '#FFFFFF']];
const TRK_EDGE_REF = ['#9CC0EA', '#8FD1AE'];
/* 一公尺是幾公尺、一個時間單位是幾秒（第二份，換單位用） */
const METRES_REF = { m:1, km:1000 };
const SECONDS_REF = { s:1, min:60, h:3600 };
const DIST_REF = { mps:'m', mpm:'m', kmh:'km' };
const TIME_REF = { mps:'s', mpm:'min', kmh:'h' };

/* 每一個範例的案例，寫成第二份 */
const S1_CASES_REF = [['sameT', 350, 5, 400, 5], ['sameD', 400, 5, 400, 8], ['mixA', 400, 5, 450, 6], ['mixB', 320, 4, 270, 3]];
const S2_CASES_REF = [['walk', 480, 6, 'mpm'], ['bike', 45, 3, 'kmh'], ['run', 70, 10, 'mps'], ['train', 360, 4, 'kmh']];
const S3_CASES_REF = [['dist', 70, 8, 'mpm'], ['dist', 60, 3, 'kmh'], ['time', 60, 480, 'mpm'], ['time', 50, 150, 'kmh']];
const S4_CASES_REF = [[72, 'kmh'], [36, 'kmh'], [54, 'kmh'], [900, 'mpm']];
const S5_ANSWERS_REF = { train:240, walk:9000, bike:120, race:'a', trip:62 };
const GAME_ROUNDS_REF = 5;
const GEN_IDS = ['speedCalc', 'distCalc', 'timeCalc', 'meaning', 'compareEasy', 'compareMix',
                 'convOne', 'convHtoS', 'wordMix', 'avgTrip', 'interTime', 'interRatio'];

/* ---------- 1) 第二套實作：約分之後的分數 ---------- */
function isPosIntRef(n){ return typeof n === 'number' && Number.isInteger(n) && n >= 1; }
function gcdRef(a, b){ a = Math.abs(a); b = Math.abs(b); while (b){ const t = a % b; a = b; b = t; } return a; }
function fracRef(n, d){ if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) return null; const g = gcdRef(n, d) || 1; return { n:n / g, d:d / g }; }
function okUnitRef(su){ return Object.prototype.hasOwnProperty.call(V_MAX_REF, su); }
function speedRef(d, t, su){
  if (!okUnitRef(su) || !isPosIntRef(d) || !isPosIntRef(t) || d > D_MAX_REF || t > T_MAX_REF) return null;
  const f = fracRef(d, t);
  return f && f.d === 1 && f.n <= V_MAX_REF[su] ? f.n : null;
}
function distRef(v, t, su){
  if (!okUnitRef(su) || !isPosIntRef(v) || v > V_MAX_REF[su] || !isPosIntRef(t) || t > T_MAX_REF) return null;
  return v * t <= D_MAX_REF ? v * t : null;
}
function timeRef(d, v, su){
  if (!okUnitRef(su) || !isPosIntRef(d) || d > D_MAX_REF || !isPosIntRef(v) || v > V_MAX_REF[su]) return null;
  const f = fracRef(d, v);
  return f && f.d === 1 && f.n <= T_MAX_REF ? f.n : null;
}
/* 換單位：先變成「每秒幾公尺」的分數，再換到目標。
   「只做大單位到小單位」：目標的時間單位與長度單位**都不可以比原來大**。 */
function convRef(v, from, to){
  if (!okUnitRef(from) || !okUnitRef(to) || !isPosIntRef(v) || v > V_MAX_REF[from]) return null;
  if (SECONDS_REF[TIME_REF[to]] > SECONDS_REF[TIME_REF[from]]) return null;
  if (METRES_REF[DIST_REF[to]] > METRES_REF[DIST_REF[from]]) return null;
  const mps = fracRef(v * METRES_REF[DIST_REF[from]], SECONDS_REF[TIME_REF[from]]);
  const w = fracRef(mps.n * SECONDS_REF[TIME_REF[to]], mps.d * METRES_REF[DIST_REF[to]]);
  return w && w.d === 1 && w.n <= V_MAX_REF[to] ? w.n : null;
}
/* 換算梯子的第二份 */
function convRowsRef(v, from){
  if (from === 'kmh'){
    const m = v * 1000, a = fracRef(m, 60), b = fracRef(m, 3600);
    if (!a || !b || a.d !== 1 || b.d !== 1) return null;
    return [['h', v, 'km', null], ['h', m, 'm', 'x1000'], ['min', a.n, 'm', 'd60'], ['s', b.n, 'm', 'd60']];
  }
  if (from === 'mpm'){ const a = fracRef(v, 60); return a && a.d === 1 ? [['min', v, 'm', null], ['s', a.n, 'm', 'd60']] : null; }
  return null;
}
function fasterRef(va, vb){ return va > vb ? 'a' : (vb > va ? 'b' : 'same'); }
function plEnRef(n, w){
  if (String(n) === '1') return n + ' ' + w;
  return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');
}
const UW_REF = { zh:{ m:'公尺', km:'公里', s:'秒', min:'分鐘', h:'小時' }, en:{ m:'metre', km:'kilometre', s:'second', min:'minute', h:'hour' } };
const SPEED_NAME_REF = { mps:'秒速', mpm:'分速', kmh:'時速' };
function qtyRef(lang, n, u){ return lang === 'zh' ? n + ' ' + UW_REF.zh[u] : plEnRef(n, UW_REF.en[u]); }
function spdRef(lang, v, su){
  return lang === 'zh' ? SPEED_NAME_REF[su] + ' ' + v + ' ' + UW_REF.zh[DIST_REF[su]]
                       : plEnRef(v, UW_REF.en[DIST_REF[su]]) + ' per ' + UW_REF.en[TIME_REF[su]];
}

/* ---------- 2) 選項的解析：一個數 ＋ 一個單位（或一個速率）。回傳 { v, u } ---------- */
function parseOptRef(s, lang){
  const t = String(s).replace(/<[^>]+>/g, '').trim();
  let m;
  if (lang === 'zh'){
    if ((m = /^(秒速|分速|時速) (\d+) (公尺|公里)$/.exec(t))){
      const su = { '秒速':'mps', '分速':'mpm', '時速':'kmh' }[m[1]];
      if (UW_REF.zh[DIST_REF[su]] !== m[3]) return null;          /* 分速配公里這種寫法是錯的 */
      return { v:Number(m[2]), u:su };
    }
    if ((m = /^(\d+) (公尺|公里|秒|分鐘|小時)$/.exec(t))){
      const u = { '公尺':'m', '公里':'km', '秒':'s', '分鐘':'min', '小時':'h' }[m[2]];
      return { v:Number(m[1]), u:u };
    }
  } else {
    if ((m = /^(\d+) (metres?|kilometres?) per (second|minute|hour)$/.exec(t))){
      const du = /^kilo/.test(m[2]) ? 'km' : 'm', tu = { second:'s', minute:'min', hour:'h' }[m[3]];
      const su = Object.keys(DIST_REF).filter(k => DIST_REF[k] === du && TIME_REF[k] === tu)[0];
      if (!su) return null;
      if ((m[1] === '1') !== !/s$/.test(m[2])) return null;       /* 單複數要對 */
      return { v:Number(m[1]), u:su };
    }
    if ((m = /^(\d+) (metres?|kilometres?|seconds?|minutes?|hours?)$/.exec(t))){
      const base = m[2].replace(/s$/, '');
      if ((m[1] === '1') !== (base === m[2])) return null;
      const u = { metre:'m', kilometre:'km', second:'s', minute:'min', hour:'h' }[base];
      return { v:Number(m[1]), u:u };
    }
  }
  if ((m = /^(\d+)$/.exec(t))) return { v:Number(m[1]), u:'n' };
  return null;
}
function optKeyRef(s, lang){ const p = parseOptRef(s, lang); return p ? (p.v + '|' + p.u) : ('TEXT:' + String(s).replace(/<[^>]+>/g, '').trim()); }

/* ---------- 3) 複習頁的句庫（第二份，獨立寫死） ---------- */
const WHO_REF = { a:{ zh:'甲比較快', en:'A is faster' }, b:{ zh:'乙比較快', en:'B is faster' },
                  same:{ zh:'一樣快', en:'They are equally fast' }, cannot:{ zh:'時間不一樣，不能比', en:'The times differ, so they cannot be compared' } };
const WHO_KEYS_REF = ['a', 'b', 'same', 'cannot'];
function whoKeyOf(text, lang){ for (const k of WHO_KEYS_REF) if (WHO_REF[k][lang] === String(text).trim()) return k; return null; }
function meanRef(key, v, su, lang){
  const du = DIST_REF[su], tu = TIME_REF[su];
  /* ⚠️ 只有兩句帶數字（對的那一句與顛倒的那一句）。「一共走了 v 公尺」在剛好走 1 分鐘時會碰巧成立、
     「每 1 公尺要走 v 分鐘」和顛倒句是同一個比率 —— 兩個都是 codex 第一輪抓到的，換成不帶數字、一定錯的兩句。 */
  if (lang === 'zh') return { per:'每 1 ' + UW_REF.zh[tu] + '走 ' + v + ' ' + UW_REF.zh[du], inv:'走 ' + v + ' ' + UW_REF.zh[tu] + '才走 1 ' + UW_REF.zh[du],
                              total:'它說的是一共走了多遠', howLong:'它說的是一共走了多久' }[key];
  return { per:plEnRef(v, UW_REF.en[du]) + ' in each ' + UW_REF.en[tu], inv:'1 ' + UW_REF.en[du] + ' in ' + plEnRef(v, UW_REF.en[tu]),
           total:'It tells how far was travelled in all', howLong:'It tells how long the trip took' }[key];
}
/* 三種人（第二份）：[名字, 動詞]、速率單位、速率池、時間池 */
const FAM_REF = {
  walk:{ su:'mpm', vs:[50, 55, 60, 65, 70, 75, 80, 85, 90], tMin:2, tMax:12, zh:['小明', '走'], en:['Ming', 'walks'] },
  car: { su:'kmh', vs:[30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90], tMin:2, tMax:6, zh:['一輛汽車', '開'], en:['A car', 'drives'] },
  run: { su:'mps', vs:[3, 4, 5, 6, 7, 8, 9], tMin:5, tMax:20, zh:['一位選手', '跑'], en:['A runner', 'runs'] }
};

/* ---------- 4) 跨頁用詞釘樁：min 是**量出來的真實出現次數**（讀者看得到的文字） ---------- */
const PINS = [
  { key:'formula', pages:['index', 'reference', 'parents'], min:{ index:29, reference:18, parents:12 },
    re:/速率 ＝ 距離 ÷ 時間|距離 ＝ 速率 × 時間|時間 ＝ 距離 ÷ 速率|speed ＝ distance ÷ time|distance ＝ speed × time|time ＝ distance ÷ speed/gi,
    why:'the three speed–distance–time rules' },
  { key:'sameTime', pages:['index', 'reference', 'parents'], min:{ index:19, reference:11, parents:12 },
    re:/同樣的時間|時間一樣|same (?:amount of )?time|the time is the same/gi,
    why:'“faster means further in the same time”' },
  { key:'fartherNotFaster', pages:['index', 'reference', 'parents'], min:{ index:6, reference:3, parents:4 },
    re:/不一定比較快|走得比較遠就比較快|does not always mean going faster|whoever went further was faster|further was faster/gi,
    why:'the warning that going further does not mean going faster' },
  { key:'bigToSmall', pages:['index', 'reference', 'parents'], min:{ index:6, reference:6, parents:3 },
    re:/大單位換到小單位|大單位到小單位|from a bigger unit to a smaller one/gi,
    why:'the rule that units are only changed from big to small' },
  { key:'unitsFirst', pages:['index', 'reference', 'parents'], min:{ index:13, reference:11, parents:11 },
    re:/單位對齊|單位一樣了嗎|單位沒有對齊|units (?:are )?lined up|line the units up|units do not line up|do the units match/gi,
    why:'the habit of lining the units up first' },
  { key:'avgRule', pages:['index', 'reference', 'parents'], min:{ index:13, reference:4, parents:3 },
    re:/全部的距離 ÷ 全部的時間|all the distance ÷ all the time/gi,
    why:'average speed ＝ all the distance ÷ all the time' },
  { key:'divideBy60', pages:['index', 'reference'], min:{ index:19, reference:11 },
    re:/除以 60|÷ 60|divide by 60/gi,
    why:'the ÷ 60 step when the time unit gets smaller' }
];
/* 一個字都不可以出現：這一課明講不做、或寫出來就是錯的東西。 */
const UNIT_WORDS = '公尺|公里|分鐘|小時|秒|centimetres?|kilometres?|metres?|minutes?|hours?|seconds?';
const UNIT_IN_EQ = new RegExp('(?:' + UNIT_WORDS + ')\\s*[×÷＝=]|[×÷]\\s*(?:' + UNIT_WORDS + ')');
const FORBIDDEN = [
  { re:/秒速\s*\d+\s*公尺\s*(?:就是|是|換成)\s*時速\s*\d/, why:'changing metres per second into km/h (small to big) is not in this lesson' },
  { re:/幾小時幾分鐘的速率|\d+\s*小時\s*\d+\s*分鐘?.{0,6}(?:時速|分速)/, why:'hours-and-minutes speed calculations are not in this lesson' },
  { re:/\d+ (?:metres? per second|m\/s)\s*(?:is|into|equals|makes|→|->|＝|=|gives)\s*\d+ (?:kilometres? per hour|km\/h)/i, why:'changing m/s into km/h (small to big) is not in this lesson' },
  { re:/\d+ hours? (?:and )?\d+ minutes?.{0,30}(?:per hour|per minute|km\/h|m\/min)|(?:per hour|per minute|km\/h|m\/min).{0,30}\d+ hours? (?:and )?\d+ minutes?/i, why:'hours-and-minutes speed calculations are not in this lesson' },
  /* 這一課的數都是整數：任何小數（兩語）都是超出範圍 */
  { re:/\d\.\d/, why:'a decimal quantity appears, but every number in this lesson is whole' }
];
/* 交給別課的詞：出現的地方附近（±160 字）一定要說不在這一課。 */
const HANDOFF = [
  { term:'相遇', ok:/不在這一課|不做|留給後面/ },
  { term:'追趕', ok:/不在這一課|不做|留給後面/ },
  { term:'秒速換成時速', ok:/不在這一課|不做|反方向|留給後面/ },
  { term:'小單位換到大單位', ok:/不在這一課|不做|留給後面/ },
  { term:'Meeting problems', win:320, ok:/not in this lesson|not part of this lesson|not done here/ },
  { term:'catching-up problems', win:320, ok:/not in this lesson|not part of this lesson|not done here/ },
  { term:'m/s back to km/h', win:320, ok:/not done here|not in this lesson/ },
  { term:'from a smaller unit to a bigger one', win:320, ok:/not in this lesson|not part of this lesson|not done here/ }
];
/* 刻意引述再打掉的迷思：附近（±200 字）一定要有反駁。 */
const MISCONCEPTIONS = [
  { term:'加起來除以 2', ok:/不是|不能|不可以|想錯|假裝|全部的距離/, why:'“add the two speeds and halve them” must be refuted where it is quoted' },
  { term:'一定走得比較快', ok:/想錯|只有|不一定|錯/, why:'“whoever goes further must be faster” must be refuted where it is quoted' },
  { term:'走得比較遠就比較快', ok:/不一定|想錯|只有|先讓|引到/, why:'“further means faster” must be refuted where it is quoted' },
  { term:'added and halved', ok:/\bnot\b|cannot|pretends|all the distance/, why:'“add the two speeds and halve them” must be refuted where it is quoted (English)' },
  { term:'add the two speeds and halve them', ok:/\bnot\b|cannot|pretends|all the distance/, why:'“add the two speeds and halve them” must be refuted where it is quoted (English)' },
  { term:'must be going faster', ok:/wrong|Only when|not always/, why:'“whoever goes further must be faster” must be refuted where it is quoted (English)' }
];

/* ---------- 5) 題庫神諭：每一題要問什麼、正解是什麼，各自獨立算一次 ---------- */
const QBANK_REF = {
  qs: [
    { kind:'speed', d:320, t:4, su:'mpm' },
    { kind:'meaning', v:65, su:'mpm' },
    { kind:'dist', v:60, t:4, su:'kmh' },
    { kind:'time', d:450, v:90, su:'mpm' },
    { kind:'cmp', a:[600, 3], b:[720, 4] },
    { kind:'conv', v:600, from:'mpm', to:'mps' }
  ],
  qsAdv: [
    { kind:'conv', v:72, from:'kmh', to:'mps' },
    { kind:'mixT', v:80, h:2 },
    { kind:'mixD', km:36, v:300 },
    { kind:'sentence', ans:2 }
  ],
  qsBoost: [
    { kind:'sentence', ans:1 },
    { kind:'sentence', ans:3 }
  ]
};
function bankAnswerRef(q, lang){
  if (q.kind === 'speed'){ const v = speedRef(q.d, q.t, q.su); return v === null ? null : spdRef(lang, v, q.su); }
  if (q.kind === 'meaning') return lang === 'zh' ? '每 1 分鐘走 ' + q.v + ' 公尺' : q.v + ' metres walked in each minute';
  if (q.kind === 'dist'){ const d = distRef(q.v, q.t, q.su); return d === null ? null : qtyRef(lang, d, DIST_REF[q.su]); }
  if (q.kind === 'time'){ const t = timeRef(q.d, q.v, q.su); return t === null ? null : qtyRef(lang, t, TIME_REF[q.su]); }
  if (q.kind === 'cmp'){ const w = fasterRef(q.a[0] / q.a[1], q.b[0] / q.b[1]); return lang === 'zh' ? { a:'甲比較快', b:'乙比較快' }[w] : { a:'A is faster', b:'B is faster' }[w]; }
  if (q.kind === 'conv'){ const w = convRef(q.v, q.from, q.to); return w === null ? null : spdRef(lang, w, q.to); }
  if (q.kind === 'mixT'){ const d = distRef(q.v, q.h * 60, 'mpm'); return d === null ? null : qtyRef(lang, d, 'm'); }
  if (q.kind === 'mixD'){ const t = timeRef(q.km * 1000, q.v, 'mpm'); return t === null ? null : qtyRef(lang, t, 'min'); }
  return null;
}
function bankStemNumsRef(q){
  if (q.kind === 'speed') return [q.d, q.t];
  if (q.kind === 'meaning') return [q.v];
  if (q.kind === 'dist') return [q.v, q.t];
  if (q.kind === 'time') return [q.d, q.v];
  if (q.kind === 'cmp') return [q.a[0], q.a[1], q.b[0], q.b[1]];
  if (q.kind === 'conv') return [q.v];
  if (q.kind === 'mixT') return [q.v, q.h];
  if (q.kind === 'mixD') return [q.km, q.v];
  return [];
}

/* ---------- 6) 讀者看得到的文字 ---------- */
function stripJsComments(code){
  return String(code).replace(/\/\*[\s\S]*?\*\//g, '\n').replace(/(^|[^:])\/\/[^\n]*/g, '$1\n');
}
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
function i18nOf(raw){
  const src = String(raw), i = src.indexOf('var I18N = {');
  if (i < 0) return null;
  let depth = 0, end = -1, inStr = null;
  for (let k = src.indexOf('{', i); k < src.length; k++){
    const ch = src[k];
    if (inStr){ if (ch === '\\') k++; else if (ch === inStr) inStr = null; continue; }
    if (ch === "'" || ch === '"'){ inStr = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}'){ depth--; if (depth === 0){ end = k + 1; break; } }
  }
  if (end < 0) return null;
  try { return new Function('return ' + src.slice(src.indexOf('{', i), end) + ';')(); } catch (e){ return null; }
}
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
  if (/undefined|NaN|null|\[object/.test(t)) out.push(where + ' leaks an internal value');
  const shown = t.replace(/<(?:br|p|div|li|span class="cond")[^>]*>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  if (lang === 'zh' && /\p{Script=Han}\d|\d\p{Script=Han}/u.test(shown)) out.push(where + ' glues Chinese to a digit: ' + (shown.match(/.{0,6}(?:\p{Script=Han}\d|\d\p{Script=Han}).{0,6}/u) || [''])[0]);
  if (lang === 'en' && /(?<![\d.])1 (?:metres|kilometres|minutes|hours|seconds|pieces|times|lots)\b/.test(shown)) out.push(where + ' has a singular/plural slip: ' + shown.match(/(?<![\d.])1 [a-z]+s\b/)[0]);
  if (lang === 'en' && /(?<![\d.])(?:[02-9]|\d{2,}) (?:metre|kilometre|minute|hour|second)\b/.test(shown)) out.push(where + ' has a plural slip: ' + shown.match(/(?<![\d.])\d+ (?:metre|kilometre|minute|hour|second)\b/)[0]);
  if (lang === 'en' && /\p{Script=Han}/u.test(shown)) out.push(where + ' has Chinese in an English string');
  if (/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/.test(shown)) out.push(where + ' has doubled punctuation');
  if (UNIT_IN_EQ.test(shown)) out.push(where + ' puts a unit inside an equation: ' + (shown.match(new RegExp('.{0,12}(?:(?:' + UNIT_WORDS + ')\\s*[×÷＝=]|[×÷]\\s*(?:' + UNIT_WORDS + ')).{0,12}')) || [''])[0]);
  return out;
}

/* ---------- 6b) 驗算器自己的 PROBE ---------- */
const CLAIM_PROBES = [
  { text:'480 ÷ 6 ＝ 80', bad:false },
  { text:'72 × 1000 ＝ 72000，72000 ÷ 60 ＝ 1200，1200 ÷ 60 ＝ 20', bad:false },
  { text:'54 × 1000 ÷ 3600 ＝ 15', bad:false },
  { text:'100 ＋ 210 ＝ 310，2 ＋ 3 ＝ 5，310 ÷ 5 ＝ 62', bad:false },
  { text:'(50 ＋ 70) ÷ 2 ＝ 60', bad:false },
  { text:'2 × 60 ＋ 45 ＝ 165', bad:false },
  { text:'速率 ＝ 距離 ÷ 時間', bad:false },
  { text:'一段是 1 分鐘走的路', bad:false },
  { text:'80 × 120 ＝ 9600', bad:false },
  { text:'480 ÷ 6 ＝ 8', bad:true },
  { text:'72000 ÷ 60 ＝ 120', bad:true },
  { text:'54 × 1000 ÷ 3600 ＝ 16', bad:true },
  { text:'(50 ＋ 70) ÷ 2 ＝ 62', bad:true },
  { text:'速率 ＝ 80', bad:true },
  { text:'一段 ＝ 1 分鐘走的路', bad:true },
  { text:'80 × × 120 ＝ 9600', bad:true },
  { text:'３２０ ÷ ４ ＝ ８１', bad:true }
];

/* ---------- 7) 從畫出來的跑道量回來 ---------- */
function r1Ref(v){ return Math.round(v * 10) / 10; }
function normPrim(p){
  const n = v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
  if (p.k === 'rect') return ['rect', n(p.x), n(p.y), n(p.w), n(p.h), p.fill, p.stroke, n(p.sw)].join(' ');
  if (p.k === 'line') return ['line', n(p.x1), n(p.y1), n(p.x2), n(p.y2), p.stroke, n(p.sw)].join(' ');
  if (p.k === 'text') return ['text', n(p.x), n(p.y), p.t, n(p.fs), p.anchor, p.fill].join(' ');
  return 'unknown ' + JSON.stringify(p);
}
/* 第二份：每一條跑道的每一個圖元。x 座標用**距離 × 比例尺**直接算，不累加。 */
function refTrackPrims(rows){
  const maxD = Math.max.apply(null, rows.map(r => r.d)), scale = TRK_W_REF / maxD, out = [];
  rows.forEach((row, i) => {
    const y = rows.length === 1 ? TRK_Y_ONE_REF : TRK_Y_TWO_REF[i], per = row.d / row.t;
    const xAt = k => r1Ref(TRK_X0_REF + (k * per) * scale);
    const R = (x, yy, w, h, fill, stroke, sw) => ({ k:'rect', x, y:yy, w, h, fill, stroke, sw });
    if (row.mode === 'split'){
      for (let k = 0; k < row.t; k++) out.push(R(xAt(k), y, r1Ref(xAt(k + 1) - xAt(k)), TRK_H_REF, TRK_FILL_REF[i][k % 2], TRK_EDGE_REF[i], 1));
    } else {
      out.push(R(xAt(0), y, r1Ref(xAt(1) - xAt(0)), TRK_H_REF, TRK_FILL_REF[i][0], TRK_EDGE_REF[i], 1));
      out.push(R(xAt(1), y, r1Ref(xAt(row.t) - xAt(1)), TRK_H_REF, C_REST_REF, TRK_EDGE_REF[i], 1));
    }
    out.push(R(TRK_X0_REF, y, r1Ref(xAt(row.t) - TRK_X0_REF), TRK_H_REF, 'none', C_LINE_REF, 2));
    out.push(R(xAt(0), y, r1Ref(xAt(1) - xAt(0)), TRK_H_REF, 'none', C_ORANGE_REF, 3));
    out.push({ k:'line', x1:TRK_X0_REF, y1:y - 6, x2:TRK_X0_REF, y2:y + TRK_H_REF + 6, stroke:C_LINE_REF, sw:2 });
    out.push({ k:'text', x:r1Ref((xAt(0) + xAt(1)) / 2), y:y - TRK_TOP_DY_REF, t:row.top === '?' ? '?' : String(per), fs:TRK_FS_REF, anchor:'middle', fill:C_ORANGE_REF });
    out.push({ k:'text', x:xAt(row.t), y:y + TRK_H_REF + TRK_BOT_DY_REF, t:row.bot === '?' ? '?' : String(row.d), fs:TRK_FS_REF, anchor:'end', fill:C_LINE_REF });
  });
  return out;
}
function svgOfPlan(pl, labelA, labelB){
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = pl.prims.map(p => {
    if (p.k === 'rect') return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + p.fill + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    if (p.k === 'line') return '<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke="' + p.stroke + '" stroke-width="' + p.sw + '"/>';
    return '<text x="' + p.x + '" y="' + p.y + '" font-size="' + p.fs + '" text-anchor="' + p.anchor + '" fill="' + p.fill + '">' + esc(p.t) + '</text>';
  }).join('');
  const labels = pl.labels.map(lb =>
    '<text x="' + lb.x + '" y="' + lb.y + '" font-size="' + LABEL_FS_REF + '" text-anchor="start" fill="' + C_LINE_REF + '">' +
    esc(lb.slot === 'a' ? labelA : labelB) + '</text>').join('');
  return '<svg width="' + FIG_W_REF + '" height="' + FIG_H_REF + '" viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '">' + body + labels + '</svg>';
}
/* 一張跑道圖的共同檢查：尺寸、標籤位置、圖元逐一比對、四個邊，再加上三條「畫的是不是那件事」。 */
function trackProblems(tag, pl, rows, longLabel){
  const out = [];
  if (!pl || pl.tooBig){ out.push(tag + ': the figure refused to draw (tooBig) although its numbers are inside this lesson’s range'); return out; }
  if (pl.w !== FIG_W_REF || pl.h !== FIG_H_REF) out.push(tag + ': the canvas is ' + pl.w + '×' + pl.h + ', not ' + FIG_W_REF + '×' + FIG_H_REF);
  if (!Array.isArray(pl.labels) || pl.labels.length !== 2) out.push(tag + ': there are not exactly two label slots');
  else {
    const a = pl.labels[0], b = pl.labels[1];
    if (!(a.slot === 'a' && a.x === LABEL_X_REF && a.y === LABEL_A_Y_REF)) out.push(tag + ': the labels are not at y=' + LABEL_A_Y_REF + ' and x=' + LABEL_X_REF);
    if (!(b.slot === 'b' && b.x === LABEL_X_REF && b.y === LABEL_B_Y_REF)) out.push(tag + ': the labels are not at y=' + LABEL_B_Y_REF + ' and x=' + LABEL_X_REF);
  }
  const got = pl.prims.map(normPrim), want = refTrackPrims(rows).map(normPrim);
  if (got.length !== want.length) out.push(tag + ': the figure has ' + got.length + ' pieces, the rebuilt one has ' + want.length);
  else for (let i = 0; i < got.length; i++)
    if (got[i] !== want[i]){ out.push(tag + ': piece ' + i + ' is "' + got[i] + '", the rebuilt one is "' + want[i] + '"'); break; }
  canvasProblems(svgOfPlan(pl, longLabel, longLabel)).forEach(m => out.push(tag + ': ' + m));
  /* 從**頁面畫出來的圖元**量回來（不是從參考量）： */
  const maxD = Math.max.apply(null, rows.map(r => r.d));
  rows.forEach((row, i) => {
    const y = rows.length === 1 ? TRK_Y_ONE_REF : TRK_Y_TWO_REF[i];
    const segs = pl.prims.filter(p => p.k === 'rect' && p.y === y && p.stroke === TRK_EDGE_REF[i]);
    const outline = pl.prims.filter(p => p.k === 'rect' && p.y === y && p.stroke === C_LINE_REF && p.fill === 'none')[0];
    if (!outline){ out.push(tag + ': row ' + i + ' has no outline'); return; }
    /* 同一把尺：跑道的長度 ÷ 距離，每一條都一樣（誤差 0.15 px 以內） */
    const ruler = outline.w / row.d, wantRuler = TRK_W_REF / maxD;
    if (Math.abs(ruler - wantRuler) * row.d > 0.15) out.push(tag + ': row ' + i + ' is drawn ' + outline.w + ' px long for ' + row.d + ', not on the shared ruler');
    if (row.mode === 'split'){
      if (segs.length !== row.t) out.push(tag + ': row ' + i + ' is cut into ' + segs.length + ' pieces, not ' + row.t);
      /* 等速：每一段一樣長（四捨五入到 0.1 px，所以相差最多 0.2） */
      const ws = segs.map(s => s.w);
      if (ws.length && Math.max.apply(null, ws) - Math.min.apply(null, ws) > 0.2) out.push(tag + ': row ' + i + ' has pieces of different lengths (' + Math.min.apply(null, ws) + '..' + Math.max.apply(null, ws) + ') — the pace would not be steady');
      /* 段接段，不重疊、不留縫 */
      for (let k = 1; k < segs.length; k++) if (Math.abs(segs[k].x - (segs[k - 1].x + segs[k - 1].w)) > 0.11) { out.push(tag + ': row ' + i + ' piece ' + k + ' does not start where the last one ended'); break; }
    } else {
      /* 「只切第一段」：畫出來的切分只能有一段，後面一整塊 —— 段數就是答案，不可以畫出來 */
      const cut = segs.filter(s => s.fill !== C_REST_REF);
      if (cut.length !== 1) out.push(tag + ': row ' + i + ' shows ' + cut.length + ' cut pieces; a “how many pieces” round must show only the first one');
    }
    const first = segs[0];
    if (first && Math.abs(first.w - (row.d / row.t) * wantRuler) > 0.2) out.push(tag + ': row ' + i + ' first piece is ' + first.w + ' px, one unit of time should be ' + r1Ref((row.d / row.t) * wantRuler));
  });
  /* 兩條跑道：段比較長的那一條就是比較快的那一個 */
  if (rows.length === 2){
    const w0 = pl.prims.filter(p => p.k === 'rect' && p.y === TRK_Y_TWO_REF[0] && p.stroke === TRK_EDGE_REF[0])[0];
    const w1 = pl.prims.filter(p => p.k === 'rect' && p.y === TRK_Y_TWO_REF[1] && p.stroke === TRK_EDGE_REF[1])[0];
    const f = fasterRef(rows[0].d / rows[0].t, rows[1].d / rows[1].t);
    if (w0 && w1){
      const seen = w0.w > w1.w ? 'a' : (w1.w > w0.w ? 'b' : 'same');
      if (seen !== f) out.push(tag + ': the longer pieces are on row ' + seen + ' but the faster one is ' + f);
    }
  }
  return out;
}

/* ---------- 8) 整句題幹重建（每一支產生器、每一種語言） ---------- */
function stemRef(genId, d, lang){
  const F = d.f ? FAM_REF[d.f] : null;
  switch (genId){
    case 'speedCalc':
      return lang === 'zh'
        ? F.zh[0] + ' <strong>' + qtyRef('zh', d.t, TIME_REF[F.su]) + '</strong>' + F.zh[1] + '了 <strong>' + qtyRef('zh', d.d, DIST_REF[F.su]) + '</strong>，' + (d.f === 'car' ? '它' : '他') + '的<strong>' + SPEED_NAME_REF[F.su] + '</strong>是多少？'
        : F.en[0] + ' ' + F.en[1] + ' <strong>' + qtyRef('en', d.d, DIST_REF[F.su]) + '</strong> in <strong>' + qtyRef('en', d.t, TIME_REF[F.su]) + '</strong>. What is the speed in <strong>' + UW_REF.en[DIST_REF[F.su]] + 's per ' + UW_REF.en[TIME_REF[F.su]] + '</strong>?';
    case 'distCalc':
      return lang === 'zh'
        ? F.zh[0] + '的<strong>' + SPEED_NAME_REF[F.su] + '是 ' + d.v + ' ' + UW_REF.zh[DIST_REF[F.su]] + '</strong>，' + F.zh[1] + '了 <strong>' + qtyRef('zh', d.t, TIME_REF[F.su]) + '</strong>，一共' + F.zh[1] + '了多少' + UW_REF.zh[DIST_REF[F.su]] + '？'
        : F.en[0] + ' ' + F.en[1] + ' at <strong>' + spdRef('en', d.v, F.su) + '</strong> for <strong>' + qtyRef('en', d.t, TIME_REF[F.su]) + '</strong>. How many ' + UW_REF.en[DIST_REF[F.su]] + 's is that?';
    case 'timeCalc':
      return lang === 'zh'
        ? '一段 <strong>' + qtyRef('zh', d.d, DIST_REF[F.su]) + '</strong>的路，' + F.zh[0] + '用<strong>' + spdRef('zh', d.v, F.su) + '</strong>' + F.zh[1] + '，要' + F.zh[1] + '幾' + UW_REF.zh[TIME_REF[F.su]] + '？'
        : 'A route is <strong>' + qtyRef('en', d.d, DIST_REF[F.su]) + '</strong> long. ' + F.en[0] + ' ' + F.en[1] + ' it at <strong>' + spdRef('en', d.v, F.su) + '</strong>. How many ' + UW_REF.en[TIME_REF[F.su]] + 's does it take?';
    case 'meaning':
      return lang === 'zh' ? '「<strong>' + spdRef('zh', d.v, F.su) + '</strong>」是什麼意思？' : 'What does “<strong>' + spdRef('en', d.v, F.su) + '</strong>” mean?';
    case 'compareEasy': case 'compareMix':
      return lang === 'zh'
        ? '<strong>甲</strong> ' + d.ta + ' 分鐘走了 <strong>' + d.da + ' 公尺</strong>，<strong>乙</strong> ' + d.tb + ' 分鐘走了 <strong>' + d.db + ' 公尺</strong>。誰走得比較快？'
        : '<strong>A</strong> walks <strong>' + plEnRef(d.da, 'metre') + '</strong> in ' + plEnRef(d.ta, 'minute') + ' and <strong>B</strong> walks <strong>' + plEnRef(d.db, 'metre') + '</strong> in ' + plEnRef(d.tb, 'minute') + '. Who is faster?';
    case 'convOne':
      return lang === 'zh'
        ? '<strong>' + spdRef('zh', d.v, d.from) + '</strong>，換成<strong>' + SPEED_NAME_REF[d.to] + '</strong>是多少公尺？'
        : '<strong>' + spdRef('en', d.v, d.from) + '</strong> is how many <strong>metres per ' + UW_REF.en[TIME_REF[d.to]] + '</strong>?';
    case 'convHtoS':
      return lang === 'zh' ? '<strong>' + spdRef('zh', d.v, 'kmh') + '</strong>，換成<strong>秒速</strong>是多少公尺？'
                           : '<strong>' + spdRef('en', d.v, 'kmh') + '</strong> is how many <strong>metres per second</strong>?';
    case 'wordMix':
      if (d.kind === 'T') return lang === 'zh'
        ? '小明走路的<strong>分速是 ' + d.v + ' 公尺</strong>，走了 <strong>' + d.h + ' 小時</strong>，一共走了多少公尺？'
        : 'Ming walks at <strong>' + plEnRef(d.v, 'metre') + ' per minute</strong> for <strong>' + plEnRef(d.h, 'hour') + '</strong>. How many metres does he walk?';
      return lang === 'zh'
        ? '一段 <strong>' + d.km + ' 公里</strong>的路，腳踏車用<strong>分速 ' + d.v + ' 公尺</strong>騎，要騎幾分鐘？'
        : 'A road is <strong>' + plEnRef(d.km, 'kilometre') + '</strong> long, and a bike rides it at <strong>' + plEnRef(d.v, 'metre') + ' per minute</strong>. How many minutes does it take?';
    case 'avgTrip':
      return lang === 'zh'
        ? '一輛車先用 <strong>' + d.t1 + ' 小時</strong>開了 <strong>' + d.d1 + ' 公里</strong>，再用 <strong>' + d.t2 + ' 小時</strong>開了 <strong>' + d.d2 + ' 公里</strong>。全程的平均時速是多少公里？'
        : 'A car first covers <strong>' + plEnRef(d.d1, 'kilometre') + '</strong> in <strong>' + plEnRef(d.t1, 'hour') + '</strong>, then <strong>' + plEnRef(d.d2, 'kilometre') + '</strong> in <strong>' + plEnRef(d.t2, 'hour') + '</strong>. What is its average speed for the whole journey?';
    case 'interTime':
      return lang === 'zh' ? '（五年級）<strong>' + d.h + ' 小時 ' + d.m + ' 分鐘</strong>是幾分鐘？'
                           : 'Grade five: <strong>' + plEnRef(d.h, 'hour') + ' ' + plEnRef(d.m, 'minute') + '</strong> is how many minutes?';
    case 'interRatio':
      return lang === 'zh' ? '（六年級）<strong>' + (d.b * d.k) + ' : ' + d.b + '</strong> 的<strong>比值</strong>是多少？'
                           : 'Grade six: what is the <strong>ratio value</strong> of <strong>' + (d.b * d.k) + ' : ' + d.b + '</strong>?';
    default: return null;
  }
}
/* 每一支產生器的正解（值 ＋ 單位），從原始參數重算 */
function answerTokRef(genId, d){
  const F = d.f ? FAM_REF[d.f] : null;
  switch (genId){
    case 'speedCalc': return { v:speedRef(d.d, d.t, F.su), u:F.su };
    case 'distCalc': return { v:distRef(d.v, d.t, F.su), u:DIST_REF[F.su] };
    case 'timeCalc': return { v:timeRef(d.d, d.v, F.su), u:TIME_REF[F.su] };
    case 'convOne': return { v:convRef(d.v, d.from, d.to), u:d.to };
    case 'convHtoS': return { v:convRef(d.v, 'kmh', 'mps'), u:'mps' };
    case 'wordMix': return d.kind === 'T' ? { v:distRef(d.v, d.h * 60, 'mpm'), u:'m' } : { v:timeRef(d.km * 1000, d.v, 'mpm'), u:'min' };
    case 'avgTrip': return { v:speedRef(d.d1 + d.d2, d.t1 + d.t2, 'kmh'), u:'kmh' };
    case 'interTime': return { v:d.h * 60 + d.m, u:'min' };
    case 'interRatio': { const f = fracRef(d.b * d.k, d.b); return { v:f && f.d === 1 ? f.n : null, u:'n' }; }
    default: return null;
  }
}
function tokTextRef(v, u, lang){ if (u === 'n') return String(v); return okUnitRef(u) ? spdRef(lang, v, u) : qtyRef(lang, v, u); }
/* 產生器內部的編碼 `值|單位`：值是正整數、單位認得、兩兩不同，而且都在 max 以內 */
function tokProblems(id, opts, unit, max){
  const seen = new Set();
  for (const o of opts){
    const parts = String(o).split('|');
    if (parts.length !== 2) return id + ': option "' + o + '" is not encoded as value|unit';
    const v = Number(parts[0]);
    if (!Number.isInteger(v) || v < 1 || v > max) return id + ': option "' + o + '" carries the value ' + parts[0] + ', outside 1..' + max + ' (derived from this question’s own numbers)';
    if (parts[1] !== unit) return id + ': option "' + o + '" carries the unit "' + parts[1] + '", the answer is in "' + unit + '"';
    if (seen.has(String(o))) return id + ': two options share the token ' + o;
    seen.add(String(o));
  }
  return null;
}
function fourDistinct(id, d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return id + ': there are ' + (d.opts || []).length + ' options, not four';
  if (new Set(d.opts.map(String)).size !== 4) return id + ': two options are the same token: ' + d.opts.join(' | ');
  if (!(d.ans >= 0 && d.ans < 4)) return id + ': the answer index ' + d.ans + ' is out of range';
  return null;
}
function echoProblems(id, d, stemNums){
  for (let i = 0; i < d.opts.length; i++){
    if (i === d.ans) continue;
    const v = Number(String(d.opts[i]).split('|')[0]);
    if (stemNums.indexOf(v) >= 0) return id + ': the distractor ' + d.opts[i] + ' copies a number the stem prints';
  }
  return null;
}
function needs(id, d, tok, what){ return d.opts.indexOf(tok) < 0 ? id + ': the "' + what + '" distractor (' + tok + ') is missing' : null; }
function famProblems(id, d){
  const F = FAM_REF[d.f];
  if (!F) return id + ': unknown mover "' + d.f + '"';
  if (F.vs.indexOf(d.v) < 0) return id + ': the speed ' + d.v + ' is not in the ' + d.f + ' pool';
  if (!(d.t >= F.tMin && d.t <= F.tMax)) return id + ': the time ' + d.t + ' is outside ' + F.tMin + '..' + F.tMax + ' for ' + d.f;
  if (d.d !== d.v * d.t) return id + ': the distance ' + d.d + ' is not ' + d.v + ' × ' + d.t;
  return null;
}

module.exports = {
  /* ================= 產生器模擬（tools/simgen.js） ================= */
  sim: {
    INVARIANTS: {
      speedCalc: d => {
        const f = famProblems('speedCalc', d); if (f) return f;
        const su = FAM_REF[d.f].su, x = fourDistinct('speedCalc', d); if (x) return x;
        const t = tokProblems('speedCalc', d.opts, su, d.d * d.t); if (t) return t;
        if (String(d.opts[d.ans]) !== d.v + '|' + su) return 'speedCalc: opts[ans]=' + d.opts[d.ans] + ' is not the speed ' + d.v;
        const e = echoProblems('speedCalc', d, [d.d, d.t]); if (e) return e;
        return needs('speedCalc', d, d.d * d.t + '|' + su, 'multiplied instead of divided') || needs('speedCalc', d, (d.d + d.t) + '|' + su, 'added') || needs('speedCalc', d, (d.d - d.t) + '|' + su, 'subtracted');
      },
      distCalc: d => {
        const f = famProblems('distCalc', d); if (f) return f;
        const du = DIST_REF[FAM_REF[d.f].su], x = fourDistinct('distCalc', d); if (x) return x;
        const t = tokProblems('distCalc', d.opts, du, d.v * (d.t + 1)); if (t) return t;
        if (String(d.opts[d.ans]) !== d.d + '|' + du) return 'distCalc: opts[ans]=' + d.opts[d.ans] + ' is not the distance ' + d.d;
        const e = echoProblems('distCalc', d, [d.v, d.t]); if (e) return e;
        return needs('distCalc', d, d.v * (d.t + 1) + '|' + du, 'one piece too many') || needs('distCalc', d, d.v * (d.t - 1) + '|' + du, 'one piece too few') || needs('distCalc', d, (d.v + d.t) + '|' + du, 'added');
      },
      timeCalc: d => {
        const f = famProblems('timeCalc', d); if (f) return f;
        const tu = TIME_REF[FAM_REF[d.f].su], x = fourDistinct('timeCalc', d); if (x) return x;
        const t = tokProblems('timeCalc', d.opts, tu, d.d * d.v); if (t) return t;
        if (String(d.opts[d.ans]) !== d.t + '|' + tu) return 'timeCalc: opts[ans]=' + d.opts[d.ans] + ' is not the time ' + d.t;
        const e = echoProblems('timeCalc', d, [d.d, d.v]); if (e) return e;
        return needs('timeCalc', d, d.d * d.v + '|' + tu, 'multiplied instead of divided') || needs('timeCalc', d, (d.d + d.v) + '|' + tu, 'added') || needs('timeCalc', d, (d.d - d.v) + '|' + tu, 'subtracted');
      },
      meaning: d => {
        const f = famProblems('meaning', d); if (f) return f;
        const x = fourDistinct('meaning', d); if (x) return x;
        for (const k of ['per', 'inv', 'total', 'howLong']) if (d.opts.indexOf(k) < 0) return 'meaning: the sentence "' + k + '" is missing';
        if (d.opts[d.ans] !== 'per') return 'meaning: the marked sentence is "' + d.opts[d.ans] + '", not "per"';
      },
      compareEasy: d => {
        const x = fourDistinct('compareEasy', d); if (x) return x;
        if (FAM_REF.walk.vs.indexOf(d.va) < 0 || FAM_REF.walk.vs.indexOf(d.vb) < 0 || d.va === d.vb) return 'compareEasy: the two walking speeds ' + d.va + ', ' + d.vb + ' are not two different pool speeds';
        if (d.da !== d.va * d.ta || d.db !== d.vb * d.tb) return 'compareEasy: a distance is not speed × time';
        if (d.same === 't' && d.ta !== d.tb) return 'compareEasy: the “same time” question has different times';
        if (d.same === 'd' && (d.da !== d.db || d.ta === d.tb)) return 'compareEasy: the “same distance” question has different distances';
        if (d.same !== 't' && d.same !== 'd') return 'compareEasy: the question is neither same-time nor same-distance';
        /* 規則本身：時間一樣 → 遠的快；距離一樣 → 花得少的快 */
        const byRule = d.same === 't' ? (d.da > d.db ? 'a' : 'b') : (d.ta < d.tb ? 'a' : 'b');
        if (byRule !== fasterRef(d.va, d.vb)) return 'compareEasy: the rule the explanation uses picks ' + byRule + ' but the speeds say ' + fasterRef(d.va, d.vb);
        if (d.opts[d.ans] !== byRule) return 'compareEasy: the marked option is ' + d.opts[d.ans] + ', not ' + byRule;
      },
      compareMix: d => {
        const x = fourDistinct('compareMix', d); if (x) return x;
        if (d.ta === d.tb || d.da === d.db) return 'compareMix: the time or the distance is the same, so it is compareEasy’s job';
        if (d.da !== d.va * d.ta || d.db !== d.vb * d.tb) return 'compareMix: a distance is not speed × time';
        const w = fasterRef(d.va, d.vb), far = d.da > d.db ? 'a' : 'b';
        if (w === 'same') return 'compareMix: the two are equally fast';
        /* 這一支存在的理由：走得比較遠的那一個比較慢 */
        if (far === w) return 'compareMix: the one who went further is also the faster one, so the question cannot catch the misconception';
        if (d.opts[d.ans] !== w) return 'compareMix: the marked option is ' + d.opts[d.ans] + ', not ' + w;
      },
      convOne: d => {
        const x = fourDistinct('convOne', d); if (x) return x;
        if (!((d.from === 'kmh' && d.to === 'mpm') || (d.from === 'mpm' && d.to === 'mps'))) return 'convOne: ' + d.from + ' → ' + d.to + ' is not a one-step big-to-small change';
        const w = convRef(d.v, d.from, d.to);
        if (w === null) return 'convOne: ' + d.v + ' ' + d.from + ' does not change into a whole ' + d.to;
        if (w !== d.w) return 'convOne: the recorded answer ' + d.w + ' is not ' + w;
        const max = d.from === 'kmh' ? d.v * 1000 : d.v * 60;
        const t = tokProblems('convOne', d.opts, d.to, max); if (t) return t;
        if (String(d.opts[d.ans]) !== w + '|' + d.to) return 'convOne: opts[ans]=' + d.opts[d.ans] + ' is not ' + w;
        const e = echoProblems('convOne', d, [d.v]); if (e) return e;
        if (d.from === 'kmh') return needs('convOne', d, d.v * 1000 + '|mpm', 'stopped after kilometres to metres') || needs('convOne', d, d.v * 60 + '|mpm', 'multiplied by 60');
        return needs('convOne', d, d.v * 60 + '|mps', 'multiplied by 60 instead of dividing');
      },
      convHtoS: d => {
        const x = fourDistinct('convHtoS', d); if (x) return x;
        const w = convRef(d.v, 'kmh', 'mps');
        if (w === null || w !== d.w) return 'convHtoS: ' + d.v + ' km/h is not ' + d.w + ' m/s';
        const t = tokProblems('convHtoS', d.opts, 'mps', d.v * 1000); if (t) return t;
        if (String(d.opts[d.ans]) !== w + '|mps') return 'convHtoS: opts[ans]=' + d.opts[d.ans] + ' is not ' + w;
        const e = echoProblems('convHtoS', d, [d.v]); if (e) return e;
        return needs('convHtoS', d, convRef(d.v, 'kmh', 'mpm') + '|mps', 'stopped at metres per minute') || needs('convHtoS', d, d.v * 1000 + '|mps', 'only changed kilometres');
      },
      wordMix: d => {
        const x = fourDistinct('wordMix', d); if (x) return x;
        if (d.kind === 'T'){
          if (FAM_REF.walk.vs.indexOf(d.v) < 0 || [2, 3].indexOf(d.h) < 0) return 'wordMix T: the speed or the hours are outside the pool';
          const want = distRef(d.v, d.h * 60, 'mpm');
          if (want === null || want !== d.d) return 'wordMix T: the distance ' + d.d + ' is not ' + d.v + ' × ' + (d.h * 60);
          const t = tokProblems('wordMix', d.opts, 'm', d.v * 100 * d.h); if (t) return t;
          if (String(d.opts[d.ans]) !== want + '|m') return 'wordMix T: opts[ans]=' + d.opts[d.ans] + ' is not ' + want;
          const e = echoProblems('wordMix', d, [d.v, d.h]); if (e) return e;
          return needs('wordMix', d, d.v * d.h + '|m', 'units not lined up') || needs('wordMix', d, d.v * 100 * d.h + '|m', '1 hour taken as 100 minutes');
        }
        if (d.kind !== 'D') return 'wordMix: unknown kind ' + d.kind;
        const want = timeRef(d.km * 1000, d.v, 'mpm');
        if (want === null || want !== d.t) return 'wordMix D: ' + d.km + ' km at ' + d.v + ' m/min is not ' + d.t + ' minutes';
        const t = tokProblems('wordMix', d.opts, 'min', Math.max(d.t * 10, d.km * d.v)); if (t) return t;
        if (String(d.opts[d.ans]) !== want + '|min') return 'wordMix D: opts[ans]=' + d.opts[d.ans] + ' is not ' + want;
        const e = echoProblems('wordMix', d, [d.km, d.v]); if (e) return e;
        return needs('wordMix', d, d.t * 10 + '|min', 'one zero too many') || needs('wordMix', d, d.km * d.v + '|min', 'multiplied distance by speed');
      },
      avgTrip: d => {
        const x = fourDistinct('avgTrip', d); if (x) return x;
        /* ⚠️ 這一條沒有改壞測試：複習頁的池子有**三道**濾網都會擋掉「兩段一樣久」（t1 ≠ t2、mean ≠ V、誘答不可以等於正解），
           拿掉任何兩道，第三道照樣擋住，所以 breaktest 改頁面觸發不到它。它擋的是以後有人把三道一起改掉。 */
        if (d.t1 === d.t2 || d.v1 === d.v2) return 'avgTrip: the two legs have the same time or the same speed, so averaging the speeds would be right';
        if (d.d1 !== d.v1 * d.t1 || d.d2 !== d.v2 * d.t2) return 'avgTrip: a leg’s distance is not speed × time';
        const V = speedRef(d.d1 + d.d2, d.t1 + d.t2, 'kmh');
        if (V === null || V !== d.V) return 'avgTrip: the average ' + d.V + ' is not all the distance ÷ all the time';
        /* 課程說的兩件事：不是兩個速率的平均；而且一定夾在兩段中間 */
        if (V * 2 === d.v1 + d.v2) return 'avgTrip: the true average equals the average of the two speeds, so the misconception cannot be caught';
        if (!(V > Math.min(d.v1, d.v2) && V < Math.max(d.v1, d.v2))) return 'avgTrip: the average is not between the two legs’ speeds';
        const t = tokProblems('avgTrip', d.opts, 'kmh', Math.max(d.D, d.v1 + d.v2)); if (t) return t;
        if (String(d.opts[d.ans]) !== V + '|kmh') return 'avgTrip: opts[ans]=' + d.opts[d.ans] + ' is not ' + V;
        const e = echoProblems('avgTrip', d, [d.t1, d.d1, d.t2, d.d2]); if (e) return e;
        return needs('avgTrip', d, (d.v1 + d.v2) / 2 + '|kmh', 'averaged the two speeds') || needs('avgTrip', d, (d.v1 + d.v2) + '|kmh', 'added the two speeds');
      },
      interTime: d => {
        const x = fourDistinct('interTime', d); if (x) return x;
        if ([1, 2, 3].indexOf(d.h) < 0 || !(d.m >= 5 && d.m <= 55 && d.m % 5 === 0)) return 'interTime: ' + d.h + ' h ' + d.m + ' min is outside the pool';
        const t = tokProblems('interTime', d.opts, 'min', d.h * 100 + d.m); if (t) return t;
        if (String(d.opts[d.ans]) !== (d.h * 60 + d.m) + '|min') return 'interTime: opts[ans]=' + d.opts[d.ans] + ' is not ' + (d.h * 60 + d.m);
        const e = echoProblems('interTime', d, [d.h, d.m]); if (e) return e;
        return needs('interTime', d, (d.h * 100 + d.m) + '|min', 'counted in hundreds');
      },
      interRatio: d => {
        if (!(Number.isInteger(d.b) && d.b >= 2 && d.b <= 9 && Number.isInteger(d.k) && d.k >= 2 && d.k <= 9 && d.b * d.k <= 30)) return 'interRatio: ' + (d.b * d.k) + ' : ' + d.b + ' leaves the ratio lesson’s range';
        const x = fourDistinct('interRatio', d); if (x) return x;
        const t = tokProblems('interRatio', d.opts, 'n', d.b * d.k * d.b); if (t) return t;
        if (String(d.opts[d.ans]) !== d.k + '|n') return 'interRatio: opts[ans]=' + d.opts[d.ans] + ' is not ' + d.k;
        const e = echoProblems('interRatio', d, [d.b, d.b * d.k]); if (e) return e;
      }
    },

    /* 正解字串由這裡**獨立算一次**，只用 make() 留下的原始參數重算。 */
    expectedCorrect: function(d, genId, lang){
      if (genId === 'meaning') return meanRef('per', d.v, FAM_REF[d.f].su, lang);
      if (genId === 'compareEasy' || genId === 'compareMix'){ const w = fasterRef(d.va, d.vb); return WHO_REF[w] ? WHO_REF[w][lang] : null; }
      const a = answerTokRef(genId, d);
      return a && a.v !== null ? tokTextRef(a.v, a.u, lang) : null;
    },

    optionOk: function(s, genId, lang, isCorrect){
      const t = String(s).trim();
      if (!t) return 'empty option';
      if (/undefined|NaN|\[object|null/.test(t)) return 'option leaks an internal value: ' + t;
      if (/<[a-z]/i.test(t)) return 'option contains markup: ' + t;
      if (lang === 'en' && /\p{Script=Han}/u.test(t)) return 'English option contains Chinese: ' + t;
      if (genId === 'compareEasy' || genId === 'compareMix') return whoKeyOf(t, lang) !== null ? null : genId + ' option is not one of the pinned sentences: ' + t;
      if (genId === 'meaning') return null;              /* 句子型：由 renderCheck 逐句重建比對 */
      const p = parseOptRef(t, lang);
      if (!p) return genId + ' option is not "<number> <unit>" in this lesson’s writing: ' + t;
      const want = { speedCalc:null, distCalc:null, timeCalc:null, convOne:null, convHtoS:'mps', wordMix:null, avgTrip:'kmh', interTime:'min', interRatio:'n' }[genId];
      if (want && p.u !== want) return genId + ' option "' + t + '" carries the unit "' + p.u + '", expected "' + want + '"';
      if (p.v < 1 || p.v > 200000) return genId + ' option ' + t + ' leaves the lesson range';
      return null;
    },

    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!q.stem || !q.stem.trim()) out.push('empty stem');
      if (!q.why || !q.why.trim()) out.push('empty explanation');
      if (q.opts.length !== 4) out.push('there are ' + q.opts.length + ' options, not four');
      const want = stemRef(genId, d, lang);
      if (want === null || want === undefined) out.push('no stem reference for ' + genId);
      else if (q.stem !== want) out.push('the rendered stem is not the rebuilt sentence: "' + q.stem.replace(/<[^>]+>/g, '') + '"');
      /* 值去重（帶單位的也比單位） */
      const keys = q.opts.map(o => optKeyRef(o, lang));
      for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
        if (keys[i] === keys[j]) out.push('two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
      /* 所有數值選項的單位要一樣（「180 公里」和「分速 180 公尺」擺在一起就是送分） */
      const units = q.opts.map(o => parseOptRef(o, lang)).filter(Boolean).map(p => p.u);
      if (units.length && new Set(units).size !== 1) out.push('the options mix units: ' + q.opts.join(' | '));
      /* 從**印出來的題幹**讀回數字，誘答的值不可以抄題幹 */
      if (genId !== 'meaning' && genId !== 'compareEasy' && genId !== 'compareMix'){
        const stemNums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
        q.opts.forEach((o, oi) => {
          if (oi === q.ans) return;
          const p = parseOptRef(o, lang);
          if (p && stemNums.indexOf(p.v) >= 0) out.push('the distractor "' + o + '" copies a number the stem prints');
        });
      }
      if (genId === 'meaning'){
        const su = FAM_REF[d.f].su;
        const wantSet = ['per', 'inv', 'total', 'howLong'].map(k => meanRef(k, d.v, su, lang));
        q.opts.forEach(o => { if (wantSet.indexOf(o) < 0) out.push('meaning option is not one of the rebuilt sentences: ' + o); });
      }
      if (genId === 'compareEasy' || genId === 'compareMix'){
        const ks = q.opts.map(o => whoKeyOf(o, lang));
        if (ks.some(k => k === null) || new Set(ks).size !== 4) out.push('the four comparison sentences are not the pinned four');
      }
      const ar = decArith(q.stem + ' ' + q.why);
      ar.problems.forEach(m => out.push(m));
      if (ar.verified < 1) out.push('the explanation should contain an equation to verify, but none was read');
      stringProblems(q.stem, lang, 'stem').forEach(m => out.push(m));
      stringProblems(q.why, lang, 'why').forEach(m => out.push(m));
      q.opts.forEach((o, i) => stringProblems(o, lang, 'option ' + i).forEach(m => out.push(m)));
      FORBIDDEN.forEach(f => { if (f.re.test(q.stem + ' ' + q.why)) out.push('the question says something out of scope: ' + f.why); });
      /* 解釋裡講的「正確的算式」要真的算出正解：正解的數字必須出現在解釋裡某一條等式的右邊 */
      const wantText = module.exports.sim.expectedCorrect(d, genId, lang);
      if (wantText !== null && q.opts[q.ans] !== wantText) out.push('the marked option is not "' + wantText + '"');
      const a = answerTokRef(genId, d);
      if (a && a.v !== null){
        const re = new RegExp('[＝=]\\s*' + a.v + '(?!\\d)');
        if (!re.test(q.why.replace(/<[^>]+>/g, ''))) out.push('the explanation never works out the answer ' + a.v + ' in an equation');
      }
      return out.length ? out.join('; ') : null;
    },

    /* simgen 內建的抄題檢查比的是整個選項字串；這一課的選項幾乎都帶單位，比不到 ——
       真正的比對在 renderCheck（比**值**）。這裡一律不放行。 */
    stemEchoOk: {}
  },

  /* ================= index.html 靜態資料檢查（tools/verify_lesson_data.js） ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{DIST_OF, TIME_OF, V_MAX, T_MAX, D_MAX, isPosInt, okUnit, okV, okT, okD, speedOf, distOf, timeOf, convert, convRows, OP_TEXT, fasterOf, avgSpeed, ' +
                'FIG_W, FIG_H, LABEL_X, LABEL_A_Y, LABEL_B_Y, LABEL_FS, LABEL_MAX, TRK_X0, TRK_W, TRK_H, TRK_Y_ONE, TRK_Y_TWO, SEG_MAX, SEG_MIN_W, TRK_FS, TRK_TOP_DY, TRK_BOT_DY, ' +
                'C_LINE, C_ORANGE, C_REST, TRK_FILL, TRK_EDGE, planTracks, emptyPlan, ' +
                'S1_CASES, S2_CASES, S3_CASES, S4_CASES, S5_CASES, caseAnswer, s1Rows, s2Rows, s3Rows, ' +
                'ROUNDS, roundAnswer, roundAnswerIndex, roundRows, roundFigure, roundUnit, UW, SPEED_NAME, SPEED_NOTE, plEn, qty, spd, withUnit}',

    check: function(data, I18N, fail, src){
      /* ---- 0. 驗算器自己先過 PROBE ---- */
      CLAIM_PROBES.forEach((pr, i) => {
        const caught = decArith(pr.text).problems.length > 0;
        if (caught !== pr.bad) fail('claim probe ' + i + ' (' + (pr.bad ? 'must be caught' : 'must be clean') + ') failed on "' + pr.text + '"');
      });
      DEC_SEEN.length = 0;

      const lessonDir = path.dirname(process.argv[2]);   /* ⚠️ 不可以用 __dirname：breaktest 把四頁複製到暫存目錄 */
      const RAW = {}, TEXT = {}, DICT = {};
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        const f = path.join(lessonDir, pg + '.html');
        RAW[pg] = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
        if (!RAW[pg]) fail('the page ' + pg + '.html is missing');
        DICT[pg] = pg === 'index' ? I18N : i18nOf(RAW[pg]);
        if (!DICT[pg]) fail('the I18N dictionary of ' + pg + '.html could not be read — nothing on that page is being checked');
        /* 讀者看得到的文字 ＝ markup（先拿掉 <script>）＋ 字典裡的字串 */
        const markup = visibleText(String(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n'));
        const strs = [];
        if (DICT[pg]) ['zh', 'en'].forEach(lang => i18nStrings(DICT[pg][lang] || {}, []).forEach(t => strs.push(visibleText(t))));
        TEXT[pg] = markup + '\n' + strs.join('\n');
      });

      /* ---- 1. 常數對得上（設定檔的第二份 vs 課程頁） ---- */
      const CONSTS = { T_MAX:T_MAX_REF, D_MAX:D_MAX_REF, FIG_W:FIG_W_REF, FIG_H:FIG_H_REF, LABEL_X:LABEL_X_REF, LABEL_A_Y:LABEL_A_Y_REF,
                       LABEL_B_Y:LABEL_B_Y_REF, LABEL_FS:LABEL_FS_REF, LABEL_MAX:LABEL_MAX_REF, TRK_X0:TRK_X0_REF, TRK_W:TRK_W_REF, TRK_H:TRK_H_REF,
                       TRK_Y_ONE:TRK_Y_ONE_REF, SEG_MAX:SEG_MAX_REF, SEG_MIN_W:SEG_MIN_W_REF, TRK_FS:TRK_FS_REF, TRK_TOP_DY:TRK_TOP_DY_REF,
                       TRK_BOT_DY:TRK_BOT_DY_REF, C_LINE:C_LINE_REF, C_ORANGE:C_ORANGE_REF, C_REST:C_REST_REF };
      Object.keys(CONSTS).forEach(k => { if (data[k] !== CONSTS[k]) fail('layout constant ' + k + ' is ' + data[k] + ', the checker expects ' + CONSTS[k]); });
      if (JSON.stringify(data.TRK_Y_TWO) !== JSON.stringify(TRK_Y_TWO_REF)) fail('TRK_Y_TWO is ' + data.TRK_Y_TWO + ', the checker expects ' + TRK_Y_TWO_REF);
      if (JSON.stringify(data.TRK_FILL) !== JSON.stringify(TRK_FILL_REF)) fail('TRK_FILL is ' + JSON.stringify(data.TRK_FILL));
      if (JSON.stringify(data.TRK_EDGE) !== JSON.stringify(TRK_EDGE_REF)) fail('TRK_EDGE is ' + JSON.stringify(data.TRK_EDGE));
      if (JSON.stringify(data.V_MAX) !== JSON.stringify(V_MAX_REF)) fail('V_MAX is ' + JSON.stringify(data.V_MAX) + ', the checker expects ' + JSON.stringify(V_MAX_REF));
      /* 三個速率上限是**同一個快慢**：秒速 40 公尺 ＝ 分速 2400 公尺 ＝ 時速 144 公里（頁面註解是這樣說的） */
      if (convRef(144, 'kmh', 'mpm') !== 2400 || convRef(2400, 'mpm', 'mps') !== 40) fail('the three speed caps are not the same pace');
      if (JSON.stringify(data.DIST_OF) !== JSON.stringify(DIST_REF) || JSON.stringify(data.TIME_OF) !== JSON.stringify(TIME_REF)) fail('DIST_OF / TIME_OF do not match the checker’s unit table');

      /* ---- 1b. 畫布的 markup：viewBox 與 CSS 的框必須和座標系一致 ---- */
      const svgTags = RAW.index.match(/<svg class="spdfig"[^>]*>/g) || [];
      if (svgTags.length !== 4) fail('index.html has ' + svgTags.length + ' figure canvases, the checker expects 4');
      svgTags.forEach(t => { if (t.indexOf('viewBox="0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '"') < 0) fail('a canvas viewBox is not "0 0 ' + FIG_W_REF + ' ' + FIG_H_REF + '": ' + t); });
      const cssRule = RAW.index.match(/\.spdfig\{[^}]*\}/);
      if (!cssRule) fail('the .spdfig CSS rule is gone, so the figures have no box');
      else {
        const cw = /max-width:(\d+)px/.exec(cssRule[0]), ch = /height:(\d+)px/.exec(cssRule[0]);
        if (!cw || !ch || Number(cw[1]) !== FIG_W_REF || Number(ch[1]) !== FIG_H_REF)
          fail('the figures are not ' + FIG_W_REF + '×' + FIG_H_REF + ' in CSS — the browser would shrink every drawing: ' + cssRule[0]);
      }

      /* ---- 2. 三個量：兩套實作對整個定義域都要同意，範圍外一律 null ---- */
      let tripleRows = 0;
      ['mps', 'mpm', 'kmh'].forEach(su => {
        for (let v = 1; v <= V_MAX_REF[su]; v++){
          for (let t = 1; t <= T_MAX_REF; t++){
            tripleRows++;
            const d = data.distOf(v, t, su);
            if (d !== distRef(v, t, su)){ fail('distOf(' + v + ', ' + t + ', ' + su + ') is ' + d + ', the second implementation says ' + distRef(v, t, su)); return; }
            if (d === null) continue;
            if (data.speedOf(d, t, su) !== v){ fail('speedOf(' + d + ', ' + t + ', ' + su + ') does not give back ' + v); return; }
            if (data.timeOf(d, v, su) !== t){ fail('timeOf(' + d + ', ' + v + ', ' + su + ') does not give back ' + t); return; }
            /* 速率一樣，時間變成 k 倍，距離就變成 k 倍（s3note 那一句） */
            for (const k of [2, 3]) if (t * k <= T_MAX_REF && distRef(v, t * k, su) !== null && data.distOf(v, t * k, su) !== d * k){ fail('doubling the time did not double the distance for ' + v + ' ' + su); return; }
          }
        }
      });
      const TRIPLE_WANT = (V_MAX_REF.mps + V_MAX_REF.mpm + V_MAX_REF.kmh) * T_MAX_REF;
      if (tripleRows !== TRIPLE_WANT) fail('the speed–distance–time cross-check ran ' + tripleRows + ' times, not the whole domain (' + TRIPLE_WANT + ')');
      /* 除不盡、超出範圍、壞輸入：一律 null */
      [['speedOf', data.speedOf(100, 3, 'mpm')], ['speedOf', data.speedOf(0, 3, 'mpm')], ['speedOf', data.speedOf(100, 0, 'mpm')],
       ['speedOf', data.speedOf(9000, 2, 'mps')], ['timeOf', data.timeOf(100, 30, 'mpm')], ['timeOf', data.timeOf(100000, 1, 'mpm')],
       ['distOf', data.distOf(2401, 1, 'mpm')], ['distOf', data.distOf(10, 121, 'mpm')], ['speedOf', data.speedOf(100, 2, 'kmph')],
       ['distOf', data.distOf(1.5, 2, 'mpm')], ['timeOf', data.timeOf(Infinity, 2, 'mpm')]]
        .forEach(([fn, v]) => { if (v !== null) fail(fn + ' does not fail closed on a bad or inexact case (got ' + v + ')'); });

      /* ---- 3. 換單位：兩套實作對每一個速率、每一對單位都要同意；小單位到大單位一律 null ---- */
      let convRowsChecked = 0;
      ['mps', 'mpm', 'kmh'].forEach(from => ['mps', 'mpm', 'kmh'].forEach(to => {
        for (let v = 1; v <= V_MAX_REF[from]; v++){
          convRowsChecked++;
          if (data.convert(v, from, to) !== convRef(v, from, to)){ fail('convert(' + v + ', ' + from + ', ' + to + ') is ' + data.convert(v, from, to) + ', the second implementation says ' + convRef(v, from, to)); return; }
        }
      }));
      if (convRowsChecked < 7000) fail('the conversion cross-check only ran ' + convRowsChecked + ' times');
      if (data.convert(20, 'mps', 'kmh') !== null || data.convert(60, 'mpm', 'kmh') !== null || data.convert(5, 'mps', 'mpm') !== null) fail('convert changes a small unit into a big one, which this lesson says it does not do');
      if (data.convert(72, 'kmh', 'mps') !== 20 || data.convert(900, 'mpm', 'mps') !== 15) fail('convert gets the lesson’s own two headline conversions wrong');

      /* ---- 4. 換算梯子：逐列重算，而且每一列都是**同一個快慢** ---- */
      for (let v = 1; v <= V_MAX_REF.kmh; v++){
        const got = data.convRows(v, 'kmh'), want = convRowsRef(v, 'kmh');
        if ((got === null) !== (want === null)){ fail('convRows(' + v + ', kmh) is ' + JSON.stringify(got) + ', the checker says ' + JSON.stringify(want)); break; }
        if (!got) continue;
        if (JSON.stringify(got.map(r => [r.t, r.d, r.du, r.op])) !== JSON.stringify(want)){ fail('convRows(' + v + ', kmh) is ' + JSON.stringify(got) + ', the checker rebuilt ' + JSON.stringify(want)); break; }
      }
      [60, 900, 1800, 2400, 59, 61].forEach(v => {
        const got = data.convRows(v, 'mpm'), want = convRowsRef(v, 'mpm');
        if (JSON.stringify(got ? got.map(r => [r.t, r.d, r.du, r.op]) : null) !== JSON.stringify(want)) fail('convRows(' + v + ', mpm) is ' + JSON.stringify(got) + ', the checker rebuilt ' + JSON.stringify(want));
      });
      if (data.convRows(10, 'mps') !== null) fail('convRows starts a ladder from metres per second, which only goes small to big from there');
      /* 每一列的「每秒幾公尺」都一樣：那才是「同一個快慢換了寫法」 */
      data.S4_CASES.forEach(sc => {
        const rows = data.convRows(sc.v, sc.from);
        if (!rows){ fail('ladder for ' + sc.v + ' ' + sc.from + ': the lesson case has no ladder at all (it does not change into whole numbers)'); return; }
        const pace = rows.map(r => fracRef(r.d * METRES_REF[r.du], SECONDS_REF[r.t]));
        pace.forEach((p, i) => { if (!p || p.n * pace[0].d !== pace[0].n * p.d) fail('ladder for ' + sc.v + ' ' + sc.from + ': row ' + i + ' is not the same pace as row 0'); });
        rows.forEach((r, i) => { if (i > 0 && !data.OP_TEXT[r.op]) fail('ladder for ' + sc.v + ': row ' + i + ' has no printable step'); });
      });
      if (data.OP_TEXT.x1000 !== '× 1000' || data.OP_TEXT.d60 !== '÷ 60') fail('the ladder step labels are ' + JSON.stringify(data.OP_TEXT));

      /* ---- 5. 比快慢的規則：列舉證明 ---- */
      const W = FAM_REF.walk.vs;
      W.forEach(va => W.forEach(vb => { for (let t = 1; t <= 12; t++){
        const da = va * t, db = vb * t;
        /* 時間一樣：走得遠的快 */
        if (va !== vb && fasterRef(va, vb) !== (da > db ? 'a' : 'b')) fail('same time: the one who went further is not the faster one for ' + va + ', ' + vb);
        if (data.fasterOf(va, vb) !== fasterRef(va, vb)) fail('fasterOf(' + va + ', ' + vb + ') disagrees with the checker');
      } }));
      if (data.fasterOf(0, 3) !== null || data.fasterOf(3, 1.5) !== null) fail('fasterOf does not fail closed on a bad speed');
      /* 平均速率 */
      if (data.avgSpeed([{ d:100, t:2 }, { d:210, t:3 }], 'kmh') !== 62) fail('avgSpeed of the lesson’s own trip is not 62');
      if (data.avgSpeed([{ d:100, t:3 }, { d:210, t:3 }], 'kmh') !== null) fail('avgSpeed does not fail closed when the average does not come out whole');
      if (data.avgSpeed([{ d:100, t:2 }], 'kmh') !== null) fail('avgSpeed accepts a one-leg trip');

      /* ---- 6. 範例的案例表與圖 ---- */
      const eq = (got, want, what) => { if (JSON.stringify(got) !== JSON.stringify(want)) fail(what + ': the page has ' + JSON.stringify(got) + ', the checker expects ' + JSON.stringify(want)); };
      eq(data.S1_CASES.map(s => [s.id, s.a.d, s.a.t, s.b.d, s.b.t]), S1_CASES_REF, 'S1_CASES');
      eq(data.S2_CASES.map(s => [s.id, s.d, s.t, s.su]), S2_CASES_REF, 'S2_CASES');
      eq(data.S3_CASES.map(s => [s.kind, s.v, s.kind === 'dist' ? s.t : s.d, s.su]), S3_CASES_REF, 'S3_CASES');
      eq(data.S4_CASES.map(s => [s.v, s.from]), S4_CASES_REF, 'S4_CASES');
      const LONG = 'x'.repeat(LABEL_MAX_REF);
      /* 範例 1：兩條跑道；時間一樣、距離一樣、兩題「遠的那一個比較慢」 */
      S1_CASES_REF.forEach(([id, da, ta, db, tb]) => {
        const sc = data.S1_CASES.filter(s => s.id === id)[0]; if (!sc) return;
        const rows = [{ d:da, t:ta, top:'v', bot:'d', mode:'split' }, { d:db, t:tb, top:'v', bot:'d', mode:'split' }];
        trackProblems('s1 ' + id, data.planTracks(data.s1Rows(sc)), rows, LONG).forEach(fail);
        const w = fasterRef(da / ta, db / tb);
        if (id === 'sameT' && ta !== tb) fail('s1 sameT: the times are not the same');
        if (id === 'sameD' && da !== db) fail('s1 sameD: the distances are not the same');
        if ((id === 'mixA' || id === 'mixB') && (ta === tb || da === db || (da > db ? 'a' : 'b') === w)) fail('s1 ' + id + ': this case is meant to show the one who went further being slower, and it does not');
        ['zh', 'en'].forEach(lang => {
          const r = I18N[lang].s1result(sc), winner = lang === 'zh' ? (w === 'a' ? '小明' : '小華') : (w === 'a' ? 'Ming' : 'Hua');
          if (r.indexOf(winner) !== 0) fail('s1 ' + id + ' ' + lang + ': the result line names the wrong winner: ' + r);
        });
      });
      S2_CASES_REF.forEach(([id, d, t, su]) => {
        const sc = data.S2_CASES.filter(s => s.id === id)[0]; if (!sc) return;
        trackProblems('s2 ' + id, data.planTracks(data.s2Rows(sc)), [{ d, t, top:'v', bot:'d', mode:'split' }], LONG).forEach(fail);
        if (speedRef(d, t, su) === null) fail('s2 ' + id + ': the checker cannot work out this example’s speed');
      });
      data.S3_CASES.forEach((sc, i) => {
        const [kind, v, x, su] = S3_CASES_REF[i] || [];
        const rows = kind === 'dist' ? [{ d:distRef(v, x, su), t:x, top:'v', bot:'?', mode:'split' }] : [{ d:x, t:timeRef(x, v, su), top:'v', bot:'d', mode:'split' }];
        if (rows[0].d === null || rows[0].t === null) return fail('s3 case ' + i + ': the checker cannot work out this example');
        trackProblems('s3 ' + i, data.planTracks(data.s3Rows(sc)), rows, LONG).forEach(fail);
      });
      /* 範例 5：答案與它自己的單位換算 */
      data.S5_CASES.forEach(sc => {
        const want = S5_ANSWERS_REF[sc.id];
        if (want === undefined) return fail('s5: unknown case ' + sc.id);
        if (data.caseAnswer(sc) !== want) fail('s5 ' + sc.id + ': the answer is ' + data.caseAnswer(sc) + ', the checker expects ' + want);
      });
      const trip = data.S5_CASES.filter(s => s.id === 'trip')[0];
      if (trip){
        const v1 = trip.legs[0].d / trip.legs[0].t, v2 = trip.legs[1].d / trip.legs[1].t;
        if ((v1 + v2) / 2 === data.caseAnswer(trip)) fail('s5 trip: averaging the two speeds gives the right answer, so the example does not show the trap');
      }
      /* 範圍外的圖一律 tooBig 而且一個圖元都不畫（fail closed） */
      const OUT = [
        ['13 pieces', [{ d:130, t:13, top:'v', bot:'d', mode:'split' }]],
        ['does not divide', [{ d:100, t:3, top:'v', bot:'d', mode:'split' }]],
        ['piece narrower than 14 px', [{ d:1000, t:10, top:'v', bot:'d', mode:'split' }, { d:300, t:10, top:'v', bot:'d', mode:'split' }]],
        ['three rows', [{ d:10, t:2, top:'v', bot:'d', mode:'split' }, { d:10, t:2, top:'v', bot:'d', mode:'split' }, { d:10, t:2, top:'v', bot:'d', mode:'split' }]],
        ['unknown mode', [{ d:10, t:2, top:'v', bot:'d', mode:'all' }]],
        ['first mode with one piece', [{ d:10, t:1, top:'v', bot:'d', mode:'first' }]],
        ['unknown label', [{ d:10, t:2, top:'x', bot:'d', mode:'split' }]],
        ['no rows', []]
      ];
      OUT.forEach(([what, rows]) => {
        let pl;
        try { pl = data.planTracks(rows); } catch (e){ return fail('planTracks ' + what + ': threw ' + e.message + ' instead of refusing to draw'); }
        if (!pl || !pl.tooBig) fail('planTracks ' + what + ': the figure drew something although it is outside its range');
        else if (pl.prims.length !== 0) fail('planTracks ' + what + ': tooBig but ' + pl.prims.length + ' pieces were still drawn');
      });

      /* ---- 7. 小遊戲的五關 ---- */
      if (data.ROUNDS.length !== GAME_ROUNDS_REF) fail('the game has ' + data.ROUNDS.length + ' rounds, not ' + GAME_ROUNDS_REF);
      const ROUND_UNIT_REF = { speed:'spd:mpm', dist:'q:km', time:'q:min', conv:'spd:mps', cmp:'who' };
      data.ROUNDS.forEach((r, i) => {
        const tag = 'game round ' + (i + 1);
        if (!Object.prototype.hasOwnProperty.call(ROUND_UNIT_REF, r.kind)) return fail(tag + ': unknown round kind "' + r.kind + '"');
        /* 誘答不可以抄這一關題目給的數 */
        const givens = r.kind === 'speed' ? [r.d, r.t] : r.kind === 'dist' ? [r.v, r.t] : r.kind === 'time' ? [r.d, r.v] : r.kind === 'conv' ? [r.v] : [];
        r.opts.forEach((o, oi) => { if (oi !== r.ans && givens.indexOf(Number(o)) >= 0) fail(tag + ': the distractor "' + o + '" copies a number the round gives'); });
        if (data.roundUnit(r) !== ROUND_UNIT_REF[r.kind]) fail(tag + ': the unit is ' + data.roundUnit(r) + ', the checker expects ' + ROUND_UNIT_REF[r.kind]);
        if (new Set(r.opts.map(String)).size !== 4) fail(tag + ': the four options are not all different');
        let want = null, rows = null;
        if (r.kind === 'speed'){ want = String(speedRef(r.d, r.t, r.su)); rows = [{ d:r.d, t:r.t, top:'?', bot:'d', mode:'split' }]; }
        else if (r.kind === 'dist'){ want = String(distRef(r.v, r.t, r.su)); rows = [{ d:r.v * r.t, t:r.t, top:'v', bot:'?', mode:'split' }]; }
        else if (r.kind === 'time'){ const t = timeRef(r.d, r.v, r.su); want = String(t); rows = [{ d:r.d, t:t, top:'v', bot:'d', mode:'first' }]; }
        else if (r.kind === 'conv') want = String(convRef(r.v, r.from, r.to));
        else if (r.kind === 'cmp'){ want = fasterRef(r.a.d / r.a.t, r.b.d / r.b.t); rows = [{ d:r.a.d, t:r.a.t, top:'?', bot:'d', mode:'split' }, { d:r.b.d, t:r.b.t, top:'?', bot:'d', mode:'split' }]; }
        if (String(data.roundAnswer(r)) !== String(want)) fail(tag + ': roundAnswer is "' + data.roundAnswer(r) + '", the checker computes "' + want + '"');
        const at = data.roundAnswerIndex(r);
        if (at < 0) fail(tag + ': no option matches the computed answer');
        if (at !== r.ans) fail(tag + ': the computed answer sits at ' + at + ' but the data declares ' + r.ans);
        r.opts.forEach((o, oi) => { if (oi !== at && String(o) === String(want)) fail(tag + ': the distractor "' + o + '" equals the answer'); });
        const pl = data.roundFigure(r);
        if (rows) trackProblems(tag, pl, rows, LONG).forEach(fail);
        else if (!pl.tooBig) fail(tag + ': the conversion round draws a track, but a speed change is not a stretch of road');
        /* 圖不可以把答案寫出來：速率那一關橘框上面要是 ?，距離那一關末端要是 ?，比快慢那一關兩個橘框都是 ? */
        if (rows){
          /* 看**那一格**該不該是 ?，不是看同一個數字有沒有出現（答案剛好等於題目給的數時會誤報） */
          const tops = pl.prims.filter(p => p.k === 'text' && p.anchor === 'middle').map(p => p.t);
          const bots = pl.prims.filter(p => p.k === 'text' && p.anchor === 'end').map(p => p.t);
          if (r.kind === 'speed' && tops[0] !== '?') fail(tag + ': the figure prints the answer over the orange piece');
          if (r.kind === 'dist' && bots[0] !== '?') fail(tag + ': the figure prints the answer at the end of the track');
          if (r.kind === 'cmp' && tops.filter(t => t === '?').length !== 2) fail(tag + ': the comparison round shows the two speeds instead of hiding them');
        }
        if (r.kind === 'cmp' && (r.a.d > r.b.d ? 'a' : 'b') === want) fail(tag + ': the one who went further is the faster one, so the round does not test the misconception');
      });
      if (data.roundAnswer({ kind:'nope' }) !== null) fail('roundAnswer does not fail closed on an unknown round kind');
      if (data.withUnit('zh', 'q:nope', '9') !== '?' || data.withUnit('zh', null, '9') !== '?' || data.withUnit('zh', 'zz:m', '9') !== '?') fail('withUnit does not fail closed on an unknown unit');
      if (data.plEn(1, 'metre') !== '1 metre' || data.plEn(2, 'metre') !== '2 metres') fail('plEn gets the English plural wrong');
      if (data.spd('zh', 80, 'mpm') !== '分速 80 公尺' || data.spd('en', 1, 'kmh') !== '1 kilometre per hour' || data.spd('zh', 8, 'nope') !== '?') fail('spd does not write speeds the checker’s way');

      /* ---- 8. 題庫：每一題在問什麼、正解印成什麼字，都各自算一次 ---- */
      ['zh', 'en'].forEach(lang => {
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          const list = I18N[lang][bank], ref = QBANK_REF[bank];
          if (!Array.isArray(list) || list.length !== ref.length) return fail(lang + ' ' + bank + ' has ' + (list || []).length + ' questions, the checker expects ' + ref.length);
          list.forEach((q, qi) => {
            const tag = lang + ' ' + bank + '[' + qi + ']', r = ref[qi];
            if (q.opts.length !== 4) fail(tag + ': there are ' + q.opts.length + ' options, not four');
            if (q.ans !== I18N.zh[bank][qi].ans) fail(tag + ': the answer index differs from the Chinese bank');
            const keys = q.opts.map(o => optKeyRef(o, lang));
            for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
              if (keys[i] === keys[j]) fail(tag + ': two options are the same value: ' + q.opts[i] + ' / ' + q.opts[j]);
            const units = q.opts.map(o => parseOptRef(o, lang)).filter(Boolean).map(p => p.u);
            if (units.length && (units.length !== 4 || new Set(units).size !== 1)) fail(tag + ': the options do not all carry the same unit: ' + q.opts.join(' | '));
            const want = bankAnswerRef(r, lang);
            if (want !== null){
              const got = String(q.opts[q.ans]).replace(/<[^>]+>/g, '').trim();
              if (got !== want) fail(tag + ': the marked option is "' + got + '", the checker computes "' + want + '"');
            } else if (r.kind === 'sentence'){
              if (q.ans !== r.ans) fail(tag + ': the marked option sits at ' + q.ans + ', the checker pinned ' + r.ans);
            } else fail(tag + ': the checker cannot work out an answer for a "' + r.kind + '" question');
            const printed = (String(q.stem).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
            bankStemNumsRef(r).forEach(n => { if (printed.indexOf(n) < 0) fail(tag + ': the stem never prints ' + n + ' (it prints ' + printed.join(', ') + ')'); });
            /* 誘答不可以抄題幹的數（值比較） */
            q.opts.forEach((o, oi) => { if (oi === q.ans) return; const p = parseOptRef(o, lang); if (p && printed.indexOf(p.v) >= 0) fail(tag + ': the distractor "' + o + '" copies a number the stem prints'); });
            const ar = decArith(q.stem + ' ' + q.why);
            ar.problems.forEach(m => fail(tag + ': ' + m));
            if (ar.verified < 1) fail(tag + ': the explanation contains no equation to verify');
            stringProblems(q.stem, lang, tag + ' stem').forEach(fail);
            stringProblems(q.why, lang, tag + ' why').forEach(fail);
            q.opts.forEach((o, oi) => stringProblems(o, lang, tag + ' option ' + oi).forEach(fail));
          });
        });
        const all = I18N[lang].qs.concat(I18N[lang].qsAdv, I18N[lang].qsBoost).map(q => q.ans);
        if (new Set(all).size < 4) fail(lang + ': the correct option sits in only ' + new Set(all).size + ' distinct positions across the whole bank');
      });
      /* 兩題迷思題與比快慢題：題目裡的數字**真的**是它要示範的那件事 */
      /* 三題「哪一句對」：從**題幹印出來的數**重算，正解那一句必須寫出重算的結果，其他句子不可以寫出來 */
      ['zh', 'en'].forEach(lang => {
        const nums = q => (String(q.stem).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
        const plainOf = t => String(t).replace(/<[^>]+>/g, '');
        const onlyIn = (tag, q, needle) => q.opts.forEach((o, oi) => {
          const has = plainOf(o).indexOf(needle) >= 0;
          if (oi === q.ans && !has) fail(tag + ': the marked sentence does not contain the worked result "' + needle + '"');
          if (oi !== q.ans && has) fail(tag + ': a wrong sentence contains the worked result "' + needle + '"');
        });
        /* 只看算式字串不夠：錯的句子寫「平均時速是 62 公里」也等於變成第二個正解。錯的句子裡不可以出現正解的**值**。 */
        /* ⚠️ 已知極限（codex 第三輪）：這一條比的是**裸數字**，錯的句子如果用同一個數字講別的量（「一共開了 62 小時」）也會響。
           那是 fail-closed 的誤報，不是放行；放寬成「只比速率的寫法」會把第二輪抓到的洞再打開，所以維持。 */
        const noValue = (tag, q, v) => q.opts.forEach((o, oi) => {
          if (oi !== q.ans && new RegExp('(?<!\\d)' + v + '(?!\\d)').test(plainOf(o))) fail(tag + ': a wrong sentence states the true value ' + v + ', so it is a second right answer');
        });
        const a3 = I18N[lang].qsAdv[3], n3 = nums(a3);          /* 時速 54 公里、秒速 12 公尺 */
        const car = convRef(n3[0], 'kmh', 'mps');
        if (car === null || car <= n3[1]) fail(lang + ' qsAdv[3]: the car must really be faster once changed into m/s');
        else { onlyIn(lang + ' qsAdv[3]', a3, String(car)); noValue(lang + ' qsAdv[3]', a3, car); }
        /* 「結論對、理由錯」的那一句要真的是結論對：它說汽車快 */
        if (plainOf(a3.opts[0]).indexOf(lang === 'zh' ? '汽車比較快' : 'The car is faster') !== 0) fail(lang + ' qsAdv[3]: the “right verdict, wrong reason” sentence no longer has the right verdict');
        const b1 = I18N[lang].qsBoost[1], r1 = nums(b1);        /* zh 先印時間（2 小時 100 公里），en 先印距離（100 kilometres in 2 hours） */
        const n1 = lang === 'zh' ? r1 : [r1[1], r1[0], r1[3], r1[2]];
        const V = speedRef(n1[1] + n1[3], n1[0] + n1[2], 'kmh');
        if (V === null || V * 2 === n1[1] / n1[0] + n1[3] / n1[2]) fail(lang + ' qsBoost[1]: the stem no longer makes averaging the two speeds wrong');
        else { onlyIn(lang + ' qsBoost[1]', b1, (n1[1] + n1[3]) + ' ÷ ' + (n1[0] + n1[2]) + ' ＝ ' + V); noValue(lang + ' qsBoost[1]', b1, V); }
        const q4 = I18N[lang].qs[4], r4 = nums(q4);              /* zh：甲 3 分鐘 600；en：A runs 600 metres in 3 minutes */
        const n4 = lang === 'zh' ? r4 : [r4[1], r4[0], r4[3], r4[2]];
        if (!(n4[1] / n4[0] > n4[3] / n4[2] && n4[3] > n4[1])) fail(lang + ' qs[4]: the one who ran further must be the slower one');
        const b0 = I18N[lang].qsBoost[0];
        onlyIn(lang + ' qsBoost[0]', b0, lang === 'zh' ? '花了多久' : 'how long it took');
      });

      /* ---- 9. 範例的旁白、算式與結果：拿字典求值出來的字逐條驗算 ---- */
      let exampleEqs = 0;
      ['zh', 'en'].forEach(lang => {
        const d = I18N[lang], runs = [];
        data.S1_CASES.forEach(sc => runs.push(['s1', () => [d.s1cap, d.s1narr(sc), d.s1calc(sc), d.s1result(sc), d.s1labelA(sc), d.s1labelB(sc), d.s1chip(sc)], [4, 5]]));
        data.S2_CASES.forEach(sc => runs.push(['s2', () => [d.s2cap(sc), d.s2narr(sc), d.s2calc(sc), d.s2result(sc), d.s2labelA(sc), d.s2labelB(sc), d.s2chip(sc)], [4, 5]]));
        data.S3_CASES.forEach(sc => runs.push(['s3', () => [d.s3cap(sc), d.s3narr(sc), d.s3calc(sc), d.s3result(sc), d.s3labelA(sc), d.s3labelB(sc), d.s3chip(sc)], [4, 5]]));
        data.S4_CASES.forEach(sc => {
          const rows = data.convRows(sc.v, sc.from) || [];
          runs.push(['s4', () => [d.s4cap, d.s4narr(sc), d.s4calc(sc), d.s4result(sc), d.s4chip(sc)].concat(rows.map(r => d.s4time(r.t)), rows.map(r => d.s4dist(r.d, r.du))), []]);
          /* 梯子印出來的每一格，都要是**那一列的數**（沒有被別的數蓋掉） */
          rows.forEach(r => { if (d.s4dist(r.d, r.du) !== qtyRef(lang, r.d, r.du)) fail(lang + ' s4 ladder cell reads "' + d.s4dist(r.d, r.du) + '", the checker writes "' + qtyRef(lang, r.d, r.du) + '"'); });
        });
        data.S5_CASES.forEach(sc => runs.push(['s5', () => [d.s5stem(sc), d.s5calc(sc), d.s5result(sc), d.s5chip(sc)].concat(d.s5steps(sc)), []]));
        data.ROUNDS.forEach(r => runs.push(['game', () => [d.gCap[r.kind], d.gPrompt[r.kind](r), d.gLabelA(r), d.gLabelB(r), d.gHint1[r.kind], d.gHint2[r.kind](r)]
          .concat(r.opts.map((o, oi) => d.gOptText(r, oi))), [2, 3]]));
        runs.forEach(([tag, textsFn, labelIdx]) => {
          let texts;
          try { texts = textsFn(); } catch (e){ return fail(lang + ' ' + tag + ': building the narration threw ' + e.message); }
          texts.forEach((t, ti) => {
            const where = lang + ' ' + tag + '[' + ti + ']';
            if (typeof t !== 'string' || !t.trim()) return fail(where + ' is empty');
            if (labelIdx.indexOf(ti) >= 0 && [...String(t)].length > LABEL_MAX_REF) fail(where + ': the label is ' + [...String(t)].length + ' characters, over the ' + LABEL_MAX_REF + ' the canvas was measured for');
            const ar = decArith(t);
            ar.problems.forEach(m => fail(where + ': ' + m));
            exampleEqs += ar.verified;
            stringProblems(t, lang, where).forEach(fail);
          });
        });
        /* 範例 5：算式最後一個數就是答案（旁白沒有算到別的地方去） */
        data.S5_CASES.forEach(sc => {
          const a = data.caseAnswer(sc), calc = d.s5calc(sc);
          if (typeof a === 'number' && !new RegExp('[＝=]\\s*' + a + '$').test(calc)) fail(lang + ' s5 ' + sc.id + ': the calculation does not end on the answer ' + a + ': ' + calc);
        });
      });
      if (exampleEqs < 60) fail('the example narration only produced ' + exampleEqs + ' verified equations — the checker may have stopped reading them');

      /* ---- 10. 四頁的用詞：釘樁、禁語、交給別課的詞、迷思 ---- */
      PINS.forEach(pin => pin.pages.forEach(pg => {
        const n = (TEXT[pg].match(pin.re) || []).length;
        if (n < pin.min[pg]) fail('the ' + pg + ' page says ' + pin.why + ' only ' + n + ' time(s); it said it ' + pin.min[pg] + ' time(s) when this was pinned');
      }));
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        FORBIDDEN.forEach(f => { const m = TEXT[pg].match(f.re); if (m) fail(pg + '.html: ' + f.why + ' — "' + m[0].trim() + '"'); });
        HANDOFF.forEach(h => {
          let at = 0;
          for (;;){
            const i = TEXT[pg].indexOf(h.term, at);
            if (i < 0) break;
            /* 中文 ±160 字；英文的範圍說明一句就超過 200 字、結尾才說 not in this lesson，所以英文的詞各自寫 win:320。
               ⚠️ 不可以整體放寬：中文的窗口一放寬，改壞測試證明「相遇」會被別處那一句背書。 */
            const W = h.win || 160, win = TEXT[pg].slice(Math.max(0, i - W), i + h.term.length + W);
            if (!h.ok.test(win)) fail(pg + '.html: "' + h.term + '" is mentioned without saying it is left out of this lesson');
            at = i + h.term.length;
          }
        });
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
      /* 每一頁字典的字串都過同一套字串與算式檢查；數量釘成當下真實的數字 */
      const DICT_MIN = { index:120, reference:80, review:18, parents:49 };
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        ['zh', 'en'].forEach(lang => {
          const strs = i18nStrings((DICT[pg] || {})[lang], []);
          if (strs.length < DICT_MIN[pg]) fail(pg + '.html ' + lang + ': only ' + strs.length + ' dictionary strings were read, it had ' + DICT_MIN[pg] + ' when this was pinned');
          strs.forEach((t, i) => {
            stringProblems(t, lang, pg + ' dict ' + lang + '[' + i + ']').forEach(fail);
            decArith(t).problems.forEach(m => fail(pg + ' dict ' + lang + '[' + i + ']: ' + m));
          });
        });
        const markup = readerText(RAW[pg]).replace(/<script[\s\S]*?<\/script>/gi, '\n');
        decArith(markup).problems.forEach(m => fail(pg + '.html markup: ' + m));
      });
      /* 速查卡第四部分的換算表：每一列都要是同一個快慢，而且只做大單位到小單位 */
      const refData = (function(){
        const s = RAW.reference, a = s.indexOf('/* ---------- 語言無關的資料 ---------- */'), b = s.indexOf('/* ---------- i18n ---------- */');
        if (a < 0 || b < 0) return null;
        try { return new Function(s.slice(a, b) + '; return { CONV_KMH:CONV_KMH, kmhToMpm:kmhToMpm, mpmToMps:mpmToMps };')(); } catch (e){ return null; }
      })();
      if (!refData) fail('the cheat sheet’s conversion table data could not be read');
      else {
        if (refData.CONV_KMH.length < 4) fail('the cheat sheet’s conversion table has only ' + refData.CONV_KMH.length + ' rows');
        refData.CONV_KMH.forEach(v => {
          const m = refData.kmhToMpm(v), s = m === null ? null : refData.mpmToMps(m);
          if (m !== convRef(v, 'kmh', 'mpm') || s !== convRef(v, 'kmh', 'mps') || s === null) fail('cheat sheet row ' + v + ' km/h reads ' + m + ' m/min and ' + s + ' m/s, the checker says ' + convRef(v, 'kmh', 'mpm') + ' and ' + convRef(v, 'kmh', 'mps'));
        });
      }

      /* ---- 10b. markup 裡的中文 fallback 和字典的 zh 值必須一模一樣 ---- */
      let pairsChecked = 0;
      ['index', 'reference', 'review', 'parents'].forEach(pg => {
        const norm = t => String(t).replace(/\s+/g, ' ').trim();
        const re = /<(\w+)[^>]*\sdata-i18n="([A-Za-z0-9_]+)"[^>]*>([\s\S]*?)<\/\1>/g;
        let m;
        while ((m = re.exec(RAW[pg])) !== null){
          const key = m[2], markupText = norm(m[3]);
          const dictText = (DICT[pg] || {}).zh ? DICT[pg].zh[key] : undefined;
          if (typeof dictText !== 'string'){ fail(pg + '.html: the key "' + key + '" is used in the markup but has no Chinese dictionary string'); continue; }
          if (!markupText){ fail(pg + '.html: the element for "' + key + '" has no Chinese fallback in the markup'); continue; }
          pairsChecked++;
          if (norm(dictText) !== markupText)
            fail(pg + '.html: the Chinese in the markup and the dictionary disagree for "' + key + '" — the dictionary has ' + norm(dictText).length + ' characters, the markup has ' + markupText.length);
        }
      });
      if (pairsChecked < 160) fail('only ' + pairsChecked + ' markup/dictionary pairs were compared, there were more when this was pinned');

      /* ---- 11. 課程頁與複習頁的產生器沒有被偷偷改掉 ---- */
      const REVIEW = stripJsComments(RAW.review);
      GEN_IDS.forEach(id => { if (REVIEW.indexOf("id:'" + id + "'") < 0) fail('the review page no longer has the generator ' + id); });
      const genCount = (REVIEW.match(/\bid:'[a-zA-Z]+',\s*cat:'/g) || []).length;
      if (genCount !== GEN_IDS.length) fail('the review page has ' + genCount + ' generators, the checker expects ' + GEN_IDS.length);
      const INDEX = stripJsComments(RAW.index);
      if (INDEX.indexOf('function planTracks(') < 0) fail('index.html no longer defines planTracks');
      if (INDEX.indexOf('plan.prims.forEach') < 0) fail('index.html no longer draws from the plan’s piece list');
      if (INDEX.indexOf('roundAnswerIndex(round)') < 0) fail('the game no longer computes which option is correct; it may be reading the declared ans');
      if (INDEX.indexOf('convRows(sc.v, sc.from)') < 0) fail('the conversion ladder is no longer drawn from convRows');

      /* ---- 12. 覆蓋率 ---- */
      if (DEC_SEEN.length < 150) fail('the arithmetic checker only read ' + DEC_SEEN.length + ' equations in total — it may have stopped reading them');
    }
  },

  /* 刻意改壞的清單：證明上面每一條斷言真的會響（node tools/breaktest.js grade-6/math/speed）。 */
  breaks: [
    {"file": "index", "via": "index", "expect": "layout constant TRK_W", "find": "  var TRK_X0 = 40, TRK_W = 380, TRK_H = 26,", "replace": "  var TRK_X0 = 40, TRK_W = 420, TRK_H = 26,", "why": "the longest track would run off the right edge of the canvas"},
    {"file": "index", "via": "index", "expect": "TRK_Y_TWO is", "find": "TRK_Y_TWO = [56, 128];", "replace": "TRK_Y_TWO = [56, 110];", "why": "the two tracks would be drawn on top of each other's numbers"},
    {"file": "index", "via": "index", "expect": "a canvas viewBox is", "find": "<svg class=\"spdfig\" id=\"s1fig\" viewBox=\"0 0 460 200\"", "replace": "<svg class=\"spdfig\" id=\"s1fig\" viewBox=\"0 0 460 160\"", "why": "the comparison tracks would be drawn in a shorter coordinate system than they use"},
    {"file": "index", "via": "index", "expect": "in CSS", "find": ".spdfig{width:100%;max-width:460px;height:200px;", "replace": ".spdfig{width:100%;max-width:460px;height:240px;", "why": "every figure would be letterboxed and silently shrink"},
    {"file": "index", "via": "index", "expect": "labels are not at y=", "find": "var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 192, LABEL_FS = 14;", "replace": "var LABEL_X = 16, LABEL_A_Y = 20, LABEL_B_Y = 140, LABEL_FS = 14;", "why": "the lower caption would sit on top of the second track"},
    {"file": "index", "via": "index", "expect": "pieces of different lengths", "find": "      for (k = 0; k <= row.t; k++) xs.push(r1(TRK_X0 + k * per * scale));", "replace": "      for (k = 0; k <= row.t; k++) xs.push(r1(TRK_X0 + (k * k / row.t) * per * scale));", "why": "the pieces would grow along the track — a speeding-up walker, not a steady pace"},
    {"file": "index", "via": "index", "expect": "piece 0 is", "find": "          prims.push(prRect(xs[k], y, r1(xs[k + 1] - xs[k]), TRK_H, TRK_FILL[i][k % 2], TRK_EDGE[i], 1));", "replace": "          prims.push(prRect(xs[k], y, r1(xs[k + 1] - xs[k]), TRK_H, TRK_FILL[i][(k + 1) % 2], TRK_EDGE[i], 1));", "why": "the colour bands would start on white, so the first piece would not stand out"},
    {"file": "index", "via": "index", "expect": "piece", "find": "      prims.push(prRect(xs[0], y, r1(xs[1] - xs[0]), TRK_H, 'none', C_ORANGE, 3));", "replace": "      prims.push(prRect(xs[0], y, r1(xs[2] - xs[0]), TRK_H, 'none', C_ORANGE, 3));", "why": "the orange frame would ring two minutes instead of one, so it would not be the speed"},
    {"file": "index", "via": "index", "expect": "piece", "find": "      prims.push(prText(r1((xs[0] + xs[1]) / 2), y - TRK_TOP_DY, row.top === '?' ? '?' : String(per), TRK_FS, 'middle', C_ORANGE));", "replace": "      prims.push(prText(r1((xs[0] + xs[1]) / 2), y - TRK_TOP_DY, row.top === '?' ? '?' : String(row.d), TRK_FS, 'middle', C_ORANGE));", "why": "the number over one piece would be the whole distance instead of the speed"},
    {"file": "index", "via": "index", "expect": "must show only the first one", "find": "        prims.push(prRect(xs[1], y, r1(xs[row.t] - xs[1]), TRK_H, C_REST, TRK_EDGE[i], 1));", "replace": "        for (k = 1; k < row.t; k++) prims.push(prRect(xs[k], y, r1(xs[k + 1] - xs[k]), TRK_H, TRK_FILL[i][k % 2], TRK_EDGE[i], 1));", "why": "the how-many-pieces round would draw every piece, printing the answer on the picture"},
    {"file": "index", "via": "index", "expect": "planTracks three rows", "find": "    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 2) return emptyPlan();", "replace": "    if (!Array.isArray(rows) || rows.length < 1) return emptyPlan();", "why": "a third track would be drawn off the bottom of the canvas"},
    {"file": "index", "via": "index", "expect": "drew something although", "find": "      if (!r || !okD(r.d) || !isPosInt(r.t) || r.t > SEG_MAX || r.d % r.t !== 0) return emptyPlan();", "replace": "      if (!r || !okD(r.d) || !isPosInt(r.t) || r.d % r.t !== 0) return emptyPlan();", "why": "a 13-piece track would squeeze its pieces below readable width"},
    {"file": "index", "via": "index", "expect": "drew something although", "find": "      if (xs[1] - xs[0] < SEG_MIN_W) return emptyPlan();", "replace": "      if (xs[1] - xs[0] < 1) return emptyPlan();", "why": "a piece narrower than its own number would still be drawn"},
    {"file": "index", "via": "index", "expect": "drew something although", "find": "      if (r.mode === 'first' && r.t < 2) return emptyPlan();", "replace": "", "why": "a one-piece track in first mode would draw a zero-width block"},
    {"file": "index", "via": "index", "expect": "speedOf does not fail closed", "find": "    if (d % t !== 0) return null;\n    var v = d / t;", "replace": "    var v = Math.round(d / t);", "why": "an inexact speed would be rounded instead of refused"},
    {"file": "index", "via": "index", "expect": "does not fail closed", "find": "  function okT(t){ return isPosInt(t) && t <= T_MAX; }", "replace": "  function okT(t){ return isPosInt(t); }", "why": "times far beyond the lesson's stated 120 would be accepted"},
    {"file": "index", "via": "index", "expect": "distOf(", "find": "    var d = v * t;\n    return okD(d) ? d : null;", "replace": "    var d = v * t + 1;\n    return okD(d) ? d : null;", "why": "every distance would be one unit too long"},
    {"file": "index", "via": "index", "expect": "timeOf does not fail closed", "find": "    if (d % v !== 0) return null;\n    var t = d / v;", "replace": "    var t = Math.ceil(d / v);", "why": "a trip that does not come out in whole units would be rounded up"},
    {"file": "index", "via": "index", "expect": "changes a small unit into a big one", "find": "    if (RANK[to] > RANK[from]) return null;          /* 小單位到大單位不在這一課 */", "replace": "", "why": "m/s would be converted up into km/h, which the curriculum keeps out of primary school"},
    {"file": "index", "via": "index", "expect": "convert(", "find": "  var SEC_PER = { mps:1, mpm:60, kmh:3600 };", "replace": "  var SEC_PER = { mps:1, mpm:60, kmh:60 };", "why": "an hour would be treated as 60 seconds"},
    {"file": "index", "via": "index", "expect": "convRows(", "find": "      rows.push({ t:'min', d:v * 1000 / 60, du:'m', op:'d60' });", "replace": "      rows.push({ t:'min', d:v * 1000 / 100, du:'m', op:'d60' });", "why": "the ladder would divide by 100 while saying ÷ 60 — an hour of 100 minutes"},
    {"file": "index", "via": "index", "expect": "is not the same pace as row 0", "find": "      rows.push({ t:'s', d:v * 1000 / 3600, du:'m', op:'d60' });", "replace": "      rows.push({ t:'min', d:v * 1000 / 3600, du:'m', op:'d60' });", "why": "the last row would say “1 minute” next to the per-second distance"},
    {"file": "index", "via": "index", "expect": "the ladder step labels are", "find": "  var OP_TEXT = { x1000:'× 1000', d60:'÷ 60' };", "replace": "  var OP_TEXT = { x1000:'× 1000', d60:'× 60' };", "why": "the ladder would say × 60 while the numbers shrink"},
    {"file": "index", "via": "index", "expect": "fasterOf(", "find": "    return va > vb ? 'a' : (vb > va ? 'b' : 'same');", "replace": "    return va >= vb ? 'a' : 'b';", "why": "two equal speeds would be called a win for the first walker"},
    {"file": "index", "via": "index", "expect": "avgSpeed of the lesson", "find": "      D += legs[i].d; T += legs[i].t;", "replace": "      D += legs[i].d / legs[i].t; T += 1;", "why": "the average would be the two speeds averaged — the exact mistake the lesson warns against"},
    {"file": "index", "via": "index", "expect": "S1_CASES", "find": "    { id:'mixA',  a:{ d:400, t:5 }, b:{ d:450, t:6 } },", "replace": "    { id:'mixA',  a:{ d:400, t:5 }, b:{ d:500, t:6 } },", "why": "the “further but slower” example would stop being slower"},
    {"file": "index", "via": "index", "expect": "the lesson case has no ladder at all", "find": "var S4_CASES = [{ v:72, from:'kmh' }, { v:36, from:'kmh' }, { v:54, from:'kmh' }, { v:900, from:'mpm' }];", "replace": "var S4_CASES = [{ v:72, from:'kmh' }, { v:36, from:'kmh' }, { v:54, from:'kmh' }, { v:70, from:'kmh' }];", "why": "a conversion case that does not come out whole would reach the ladder"},
    {"file": "index", "via": "index", "expect": "averaging the two speeds gives the right answer", "find": "legs:[{ d:100, t:2 }, { d:210, t:3 }], su:'kmh' }", "replace": "legs:[{ d:100, t:2 }, { d:140, t:2 }], su:'kmh' }", "why": "two legs of equal time would make the naive average right, so the trap would vanish"},
    {"file": "index", "via": "index", "expect": "s5 walk: the answer is", "find": "    if (sc.kind === 'mixT'){ var t = sc.h * 60; return okT(t) ? distOf(sc.v, t, sc.su) : null; }", "replace": "    if (sc.kind === 'mixT'){ return distOf(sc.v, sc.h, sc.su); }", "why": "the mixed-units walk would be worked out without changing hours into minutes"},
    {"file": "index", "via": "index", "expect": "the result line names the wrong winner", "find": "        var who = w === 'a' ? '小明' : '小華';", "replace": "        var who = w === 'a' ? '小華' : '小明';", "why": "the Chinese result line would name the slower walker"},
    {"file": "index", "via": "index", "expect": "the computed answer sits at", "find": "{ kind:'speed', d:540, t:6, su:'mpm', opts:['534', '90', '3240', '546'], ans:1 },", "replace": "{ kind:'speed', d:540, t:6, su:'mpm', opts:['534', '90', '3240', '546'], ans:2 },", "why": "the declared answer would point at a distractor"},
    {"file": "index", "via": "index", "expect": "the four options are not all different", "find": "opts:['180', '49', '41', '1800'], ans:0 },", "replace": "opts:['180', '49', '49', '1800'], ans:0 },", "why": "a child would see three options, not four"},
    {"file": "index", "via": "index", "expect": "the conversion round draws a track", "find": "    if (r.kind === 'cmp') return [{ d:r.a.d, t:r.a.t, top:'?', bot:'d', mode:'split' }, { d:r.b.d, t:r.b.t, top:'?', bot:'d', mode:'split' }];\n    return null;", "replace": "    if (r.kind === 'cmp') return [{ d:r.a.d, t:r.a.t, top:'?', bot:'d', mode:'split' }, { d:r.b.d, t:r.b.t, top:'?', bot:'d', mode:'split' }];\n    return [{ d:r.v, t:2, top:'v', bot:'d', mode:'split' }];", "why": "the conversion round would show a road that has nothing to do with the question"},
    {"file": "index", "via": "index", "expect": "the figure prints the answer over the orange piece", "find": "    if (r.kind === 'speed') return [{ d:r.d, t:r.t, top:'?', bot:'d', mode:'split' }];", "replace": "    if (r.kind === 'speed') return [{ d:r.d, t:r.t, top:'v', bot:'d', mode:'split' }];", "why": "the speed round would print the speed over the orange piece"},
    {"file": "index", "via": "index", "expect": "shows the two speeds instead of hiding them", "find": "return [{ d:r.a.d, t:r.a.t, top:'?', bot:'d', mode:'split' }, { d:r.b.d, t:r.b.t, top:'?', bot:'d', mode:'split' }];\n    return null;", "replace": "return [{ d:r.a.d, t:r.a.t, top:'v', bot:'d', mode:'split' }, { d:r.b.d, t:r.b.t, top:'v', bot:'d', mode:'split' }];\n    return null;", "why": "the comparison round would print both speeds, so there is nothing left to compare"},
    {"file": "index", "via": "index", "expect": "does not test the misconception", "find": "{ kind:'cmp', a:{ d:1000, t:5 }, b:{ d:660, t:3 }, su:'mpm', opts:['a', 'b', 'same', 'cannot'], ans:1 }", "replace": "{ kind:'cmp', a:{ d:1000, t:5 }, b:{ d:540, t:3 }, su:'mpm', opts:['a', 'b', 'same', 'cannot'], ans:0 }", "why": "the one who went further would also be the faster one, so the round rewards the misconception"},
    {"file": "index", "via": "index", "expect": "the unit is", "find": "    if (r.kind === 'time') return 'q:' + TIME_OF[r.su];", "replace": "    if (r.kind === 'time') return 'q:' + DIST_OF[r.su];", "why": "the time answers would be labelled in metres"},
    {"file": "index", "via": "index", "expect": "withUnit does not fail closed", "find": "    if (p[0] === 'q') return qty(lang, t, p[1]);\n    return '?';", "replace": "    if (p[0] === 'q') return qty(lang, t, p[1]);\n    return String(t);", "why": "an unknown unit would print a bare number"},
    {"file": "index", "via": "index", "expect": "plEn gets the English plural wrong", "find": "  function plEn(n, w){\n    if (String(n) === '1') return n + ' ' + w;\n    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');\n  }\n  /* 一個帶單位的量", "replace": "  function plEn(n, w){\n    return n + ' ' + w + (/(s|x|z|ch|sh)$/.test(w) ? 'es' : 's');\n  }\n  /* 一個帶單位的量", "why": "the English would say “1 metres”"},
    {"file": "index", "via": "index", "expect": "the answer index differs from the Chinese bank", "find": "opts:['分速 80 公尺', '分速 1280 公尺', '分速 316 公尺', '分速 324 公尺'], ans:0,", "replace": "opts:['分速 80 公尺', '分速 1280 公尺', '分速 316 公尺', '分速 324 公尺'], ans:1,", "why": "the first question would mark “multiplied” as right"},
    {"file": "index", "via": "index", "expect": "the marked option is", "find": "opts:['15 公里', '240 公里', '64 公里', '56 公里'], ans:1,", "replace": "opts:['15 公里', '250 公里', '64 公里', '56 公里'], ans:1,", "why": "the distance answer would be 10 kilometres out"},
    {"file": "index", "via": "index", "expect": "the stem never prints", "find": "{ stem:'一段 <strong>450 公尺</strong>的路，用<strong>分速 90 公尺</strong>走，要走幾分鐘？',", "replace": "{ stem:'一段 <strong>540 公尺</strong>的路，用<strong>分速 90 公尺</strong>走，要走幾分鐘？',", "why": "the stem would ask a different question from the one the options answer"},
    {"file": "index", "via": "index", "expect": "two options are the same value", "find": "opts:['秒速 36000 公尺', '秒速 660 公尺', '秒速 10 公尺', '秒速 540 公尺'], ans:2,", "replace": "opts:['秒速 36000 公尺', '秒速 660 公尺', '秒速 10 公尺', '秒速 10 公尺'], ans:2,", "why": "a child would see three options, not four"},
    {"file": "index", "via": "index", "expect": "do not all carry the same unit", "find": "opts:['160 公尺', '4800 公尺', '96000 公尺', '9600 公尺'], ans:3,", "replace": "opts:['160 公尺', '4800 公里', '96000 公尺', '9600 公尺'], ans:3,", "why": "one distractor in kilometres would be eliminated on sight"},
    {"file": "index", "via": "index", "expect": "this claim is wrong", "find": "320 ÷ 4 ＝ 80，所以是分速 80 公尺。1280", "replace": "320 ÷ 4 ＝ 70，所以是分速 80 公尺。1280", "why": "the explanation would work the question out wrongly"},
    {"file": "index", "via": "index", "expect": "copies a number the stem prints", "find": "opts:['40500 分鐘', '540 分鐘', '360 分鐘', '5 分鐘'], ans:3,", "replace": "opts:['40500 分鐘', '540 分鐘', '90 分鐘', '5 分鐘'], ans:3,", "why": "a distractor would just copy the speed out of the stem"},
    {"file": "index", "via": "index", "expect": "puts a unit inside an equation", "find": "要先換成一樣的時間單位：2 小時是 120 分鐘（2 × 60 ＝ 120）。", "replace": "要先換成一樣的時間單位：2 小時是 120 分鐘（2 小時 × 60 ＝ 120）。", "why": "a unit inside an equation splits it so half goes unchecked"},
    {"file": "index", "via": "index", "expect": "glues Chinese to a digit", "find": "      s1labelA:function(sc){ return '上：小明 ' + sc.a.t + ' 分鐘 ' + sc.a.d + ' 公尺'; },", "replace": "      s1labelA:function(sc){ return '上：小明' + sc.a.t + ' 分鐘 ' + sc.a.d + ' 公尺'; },", "why": "the space between the name and the number would vanish"},
    {"file": "index", "via": "index", "expect": "over the 26 the canvas", "find": "      s1labelB:function(sc){ return 'Below: Hua ' + sc.b.t + ' min ' + sc.b.d + ' m'; },", "replace": "      s1labelB:function(sc){ return 'Below: Hua walked ' + sc.b.t + ' minutes ' + sc.b.d + ' metres'; },", "why": "the English caption would run off the canvas"},
    {"file": "index", "via": "index", "expect": "must be refuted where it is quoted", "find": "  <footer data-i18n=\"footer\">把整頁縮成一句：", "replace": "  <footer data-i18n=\"footer\">平均就是把兩個速率加起來除以 2。把整頁縮成一句：", "why": "the footer would state the misconception with nothing to knock it down"},
    {"file": "index", "via": "index", "expect": "is mentioned without saying it is left out", "find": "      s1note:'💬 跑道畫在<strong>同一把尺</strong>上", "replace": "      s1note:'💬 相遇的時候兩個人一起走。跑道畫在<strong>同一把尺</strong>上", "why": "the page would start on meeting problems without saying they are not in this lesson"},
    {"file": "index", "via": "index", "expect": "markup and the dictionary disagree", "find": "      s2h2:'速率 ＝ 距離 ÷ 時間',", "replace": "      s2h2:'速率 ＝ 距離',", "why": "the dictionary heading would be truncated while the markup fallback still looked right"},
    {"file": "reference", "via": "index", "expect": "has no Chinese dictionary string", "find": "      n4:'💬 時間的單位變小", "replace": "      n4x:'💬 時間的單位變小", "why": "the notebox would fall back to hard-coded Chinese and never switch to English"},
    {"file": "reference", "via": "index", "expect": "cheat sheet row", "find": "  function mpmToMps(v){ return isPosInt(v) && v % 60 === 0 ? v / 60 : null; }", "replace": "  function mpmToMps(v){ return isPosInt(v) && v % 60 === 0 ? v * 60 : null; }", "why": "the cheat sheet would multiply by 60 in its own conversion table"},
    {"file": "reference", "via": "index", "expect": "the reference page says the rule that units are only changed from big to small", "find": "      n4:'💬 時間的單位變小，一段時間走的路就變短，所以是<strong>除以 60</strong>。這一課只做<strong>大單位換到小單位</strong>", "replace": "      n4:'💬 時間的單位變小，一段時間走的路就變短，所以是<strong>除以 60</strong>。這一課只做換算", "why": "the cheat sheet would drop the big-to-small restriction"},
    {"file": "parents", "via": "index", "expect": "the parents page says the warning that going further", "find": "<td data-i18n=\"mis1\">覺得<strong>走得比較遠就比較快</strong></td>", "replace": "<td data-i18n=\"mis1\">覺得<strong>跑得遠</strong></td>", "why": "the parents page would stop naming the headline misconception"},
    {"file": "review", "via": "review", "expect": "\"multiplied instead of divided\" distractor", "find": "        var cands = [tok(p.d * p.t, su), tok(p.d + p.t, su), tok(p.d - p.t, su)];", "replace": "        var cands = [tok(p.d + p.t, su), tok(p.d - p.t, su)];", "why": "the commonest speed mistake would stop being offered"},
    {"file": "review", "via": "review", "expect": "one piece too many", "find": "        var cands = [tok(p.v * (p.t + 1), du), tok(p.v * (p.t - 1), du), tok(p.v + p.t, du)];", "replace": "        var cands = [tok(p.v * (p.t - 1), du), tok(p.v + p.t, du)];", "why": "the off-by-one-piece distractor would disappear"},
    {"file": "review", "via": "review", "expect": "is not the time", "find": "        var correct = tok(p.t, tu);", "replace": "        var correct = tok(p.t + 1, tu);", "why": "the time answer would be one unit out"},
    {"file": "review", "via": "review", "expect": "the marked sentence is", "find": "        return { f:p.f, v:p.v, t:p.t, d:p.d, opts:opts, ans:opts.indexOf('per') };", "replace": "        return { f:p.f, v:p.v, t:p.t, d:p.d, opts:opts, ans:opts.indexOf('inv') };", "why": "the meaning question would mark the upside-down sentence right"},
    {"file": "review", "via": "review", "expect": "a distance is not speed × time", "find": "      CMP_T.forEach(function(t){ out.push({ same:'t', ta:t, tb:t, da:va * t, db:vb * t, va:va, vb:vb }); });", "replace": "      CMP_T.forEach(function(t){ out.push({ same:'t', ta:t, tb:t, da:vb * t, db:va * t, va:va, vb:vb }); });", "why": "the same-time question would print the distances the wrong way round"},
    {"file": "review", "via": "review", "expect": "the one who went further is also the faster one", "find": "        if ((da > db) === (va < vb)) out.push({ same:'none', ta:ta, tb:tb, da:da, db:db, va:va, vb:vb });", "replace": "        if ((da > db) === (va > vb)) out.push({ same:'none', ta:ta, tb:tb, da:da, db:db, va:va, vb:vb });", "why": "the mixed comparison would only ever reward “further means faster”"},
    {"file": "review", "via": "review", "expect": "stopped after kilometres to metres", "find": "          cands = [tok(v * 1000, to), tok(v * 60, to), (v * 1000) % 3600 === 0 ? tok(v * 1000 / 3600, to) : null];", "replace": "          cands = [tok(v * 60, to), (v * 1000) % 3600 === 0 ? tok(v * 1000 / 3600, to) : null];", "why": "the stop-halfway distractor would disappear"},
    {"file": "review", "via": "review", "expect": "multiplied by 60 instead of dividing", "find": "          cands = [tok(v * 60, to), tok(v + 60, to), tok(v - 60, to)];", "replace": "          cands = [tok(v + 60, to), tok(v - 60, to)];", "why": "the ×60-instead-of-÷60 distractor would disappear"},
    {"file": "review", "via": "review", "expect": "stopped at metres per minute", "find": "        var cands = [tok(v * 1000 / 60, 'mps'), tok(v * 1000, 'mps'), tok(v * 60, 'mps')];", "replace": "        var cands = [tok(v * 1000, 'mps'), tok(v * 60, 'mps')];", "why": "the stop-at-m/min distractor would disappear"},
    {"file": "review", "via": "review", "expect": "units not lined up", "find": "          cands = [tok(p.v * p.h, 'm'), tok(p.v * 60, 'm'), tok(p.v * 100 * p.h, 'm')];", "replace": "          cands = [tok(p.v * 60, 'm'), tok(p.v * 100 * p.h, 'm')];", "why": "the not-lined-up distractor — the whole point of the question — would vanish"},
    {"file": "review", "via": "review", "expect": "is not", "find": "    WALK_V.forEach(function(v){ [2].forEach(function(h){ out.push({ v:v, h:h, d:v * 60 * h }); }); });", "replace": "    WALK_V.forEach(function(v){ [2].forEach(function(h){ out.push({ v:v, h:h, d:v * h }); }); });", "why": "the mixed-units answer would be worked out without converting hours"},
    {"file": "review", "via": "review", "expect": "averaged the two speeds", "find": "        var cands = [tok(p.mean, 'kmh'), tok(p.v1 + p.v2, 'kmh'), tok(p.D, 'kmh')];", "replace": "        var cands = [tok(p.v1 + p.v2, 'kmh'), tok(p.D, 'kmh')];", "why": "the average-of-speeds misconception would stop being offered"},
    {"file": "review", "via": "review", "expect": "counted in hundreds", "find": "        var cands = [tok(p.h * 100 + p.m, 'min'), tok(p.h + p.m, 'min'), tok(p.h * 60, 'min')];", "replace": "        var cands = [tok(p.h + p.m, 'min'), tok(p.h * 60, 'min')];", "why": "the base-100 time mistake would stop being offered"},
    {"file": "review", "via": "review", "expect": "opts[ans]=", "find": "        var correct = tok(p.k, 'n');", "replace": "        var correct = tok(p.b, 'n');", "why": "the ratio value would be answered with the second term"},
    {"file": "review", "via": "review", "expect": "the rendered stem is not the rebuilt sentence", "find": "'一段 <strong>' + qty('zh', d.d, DIST_OF[su]) + '</strong>的路，' + w[0] + '用<strong>'", "replace": "'一段 <strong>' + qty('zh', d.d + 1, DIST_OF[su]) + '</strong>的路，' + w[0] + '用<strong>'", "why": "the stem would print a distance one unit off the one the answer uses"},
    {"file": "review", "via": "review", "expect": "this claim is wrong", "find": "'分速配的是分鐘，時間卻是小時，要先換：' + d.h + ' × 60 ＝ ' + (d.h * 60)", "replace": "'分速配的是分鐘，時間卻是小時，要先換：' + d.h + ' × 60 ＝ ' + (d.h * 100)", "why": "the explanation would say 2 × 60 is 200"},
    {"file": "review", "via": "review", "expect": "never works out the answer", "find": "            ? '比值就是<strong>前項 ÷ 後項</strong>：' + first + ' ÷ ' + d.b + ' ＝ ' + d.k + '。", "replace": "            ? '比值就是<strong>前項 ÷ 後項</strong>：' + first + ' ÷ ' + d.b + '。", "why": "the explanation would stop before reaching the answer"},
    {"file": "review", "via": "review", "expect": "glues Chinese to a digit", "find": "  function qty(lang, n, u){ return lang === 'zh' ? n + ' ' + UW.zh[u] : plEn(n, UW.en[u]); }", "replace": "  function qty(lang, n, u){ return lang === 'zh' ? n + UW.zh[u] : plEn(n, UW.en[u]); }", "why": "the space between the number and the Chinese unit would vanish"},
    {"file": "review", "via": "review", "expect": "the options mix units", "find": "        var cands = [tok(p.d * p.v, tu), tok(p.d + p.v, tu), tok(p.d - p.v, tu)];", "replace": "        var cands = [tok(p.d * p.v, 'm'), tok(p.d + p.v, tu), tok(p.d - p.v, tu)];", "why": "one time distractor would be printed in metres"},
    {"file": "index", "via": "index", "expect": "the marked sentence does not contain the worked result", "find": "要用<strong>全部的距離 ÷ 全部的時間</strong>：310 ÷ 5 ＝ 62，平均時速 62 公里'], ans:3,", "replace": "要用<strong>全部的距離 ÷ 全部的時間</strong>，平均時速 62 公里'], ans:3,", "why": "the marked sentence would stop showing the worked average, so any sentence could be marked right"},
    {"file": "index", "via": "index", "expect": "is mentioned without saying it is left out", "find": "<strong>Meeting problems</strong>, <strong>catching-up problems</strong>, <strong>changing from a smaller unit to a bigger one</strong> (say m/s to km/h) and <strong>speed problems with times given as decimals or as hours and minutes together</strong> are <strong>not in this lesson</strong>.", "replace": "<strong>Meeting problems</strong> are fun, and so are catching-up problems.", "why": "the English page would start meeting problems without saying they are left out"},
    {"file": "index", "via": "index", "expect": "a decimal quantity appears", "find": "      s1note:'💬 跑道畫在<strong>同一把尺</strong>上", "replace": "      s1note:'💬 小明其實走了 3.5 分鐘。跑道畫在<strong>同一把尺</strong>上", "why": "a decimal time would slip into a lesson whose numbers are all whole"},
    {"file": "index", "via": "index", "expect": "has a plural slip", "find": "      s3labelB:function(sc){ return 'Orange piece: ' + sc.v + ' ' + SPEED_NOTE.en[sc.su]; },", "replace": "      s3labelB:function(sc){ return 'Orange: ' + sc.v + ' metre per min'; },", "why": "“70 metre per min” would pass as English"},
    {"file": "index", "via": "index", "expect": "copies a number the round gives", "find": "opts:['910', '770', '58800', '12'], ans:3 },", "replace": "opts:['910', '70', '58800', '12'], ans:3 },", "why": "a game distractor would just repeat the speed the round gives"},
    {"file": "index", "via": "index", "expect": "unknown round kind", "find": "    { kind:'dist', v:45, t:4, su:'kmh', opts:['180', '49', '41', '1800'], ans:0 },", "replace": "    { kind:'distance', v:45, t:4, su:'kmh', opts:['180', '49', '41', '1800'], ans:0 },", "why": "a round of an unknown kind would be accepted by the null === null path"},
    {"file": "review", "via": "review", "expect": "meaning option is not one of the rebuilt sentences", "find": "      if (key === 'total') return '它說的是一共走了多遠';", "replace": "      if (key === 'total') return '一共走了 ' + v + ' ' + UW.zh[du];", "why": "the “total” sentence would carry the stem number again and could be true for a one-minute walk"},
    {"file": "index", "via": "index", "expect": "so it is a second right answer", "find": "'應該只看比較久的第二段，平均時速是 70 公里'", "replace": "'應該用全部的距離除以全部的時間，平均時速是 62 公里'", "why": "a wrong sentence would state the true average, becoming a second right answer without repeating the exact equation"}
  ]
};
