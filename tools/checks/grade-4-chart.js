/* grade-4/math/chart —— 統計圖工作室（一格代表 1 個的長條圖與折線圖：報讀與繪製）
 *
 * 這一課的正確性有三塊，所以這份設定裡有三套獨立重寫的實作：
 *
 * 1) 版面。頁面的 chartPlan() 從**下緣往上**算（y ＝ y1 － v × cellH），
 *    長條的左緣由「中心點減半寬」推出來。這裡的參考實作走另一條路：
 *    從**上緣往下**算（y ＝ y0 ＋ (rows － v) × cellH），左緣由
 *    「一格寬的起點 ＋ 留白的一半」推出來。兩條路對每一組資料逐一比對。
 *    核心那一條是**每一條長條的頂端一定剛好落在第 v 條格線上** ——
 *    那正是「一格代表 1 個，有幾格就是幾個」在圖上成立的理由。
 *
 * 2) 統計本身。頁面用迴圈掃一遍；參考實作用**排序與 filter**重寫
 *    （最多 ＝ 排序後的第一個、唯一 ＝ filter 出來剛好一個），
 *    對 4 個項目 0~5 的全部 1296 組與 5 個項目 0~3 的全部 1024 組窮舉比對。
 *
 * 3) 字典。項目名與單位詞在設定檔裡另有一張真值表，逐字比對 ——
 *    拿頁面的字典去比頁面的字典等於自己比自己（'杯' 寫成 '碗' 抓不到）。
 *
 * ⚠️ 這一課教的規則有前提，設定檔必須分開驗：
 *    「長條有幾格就是幾個」只在**每一條都從 0 開始、每一格一樣高**時成立，
 *    所以每一條長條的下緣都必須剛好等於 y1、每一格的高度都必須相等。
 * ⚠️ 「格子最少要幾格」是一個**下界**，所以題目一定要問「最少」——
 *    只問「要幾格」的話，比最大值更多的格數也講得通（§六之二 的違反）。
 * ⚠️ 這一課不用負數、不用小數：每一個選項、每一個答案都是 0 ~ 99 的整數。
 */

const fs = require('fs');
const { extractFunction } = require('./lib/gameshuffle.js');
const path = require('path');

const OPT_MAX_REF = 99;
const VAL_MAX_REF = 9;
const EPS = 1e-9;
function inRangeRef(v){
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= OPT_MAX_REF;
}

/* ---------- 1) 版面：獨立重寫的排版 ---------- */
/* 課程頁 520×300／PAD 48-18-20-48；複習頁 400×230／PAD 38-14-14-38。
   規格在這裡**獨立寫死一份** —— 只跟頁面自己的常數互相一致是不夠的，
   三個一起改成別的數字檢查還是綠的。 */
const FIG_REF = {
  index:  { W:520, H:300, PL:48, PR:18, PT:20, PB:48, GAP:0.34, NDX:10, NFS:13, IFS:15, IDY:22, DOT:5 },
  review: { W:400, H:230, PL:38, PR:14, PT:14, PB:38, GAP:0.34, NDX:8,  NFS:11, IFS:13, IDY:18, DOT:4 }
};

function planRef(vals, rows, R){
  const x0 = R.PL, x1 = R.W - R.PR, y0 = R.PT, y1 = R.H - R.PB;
  const cellH = (y1 - y0) / rows;
  const slot = (x1 - x0) / vals.length;
  const gap = slot * R.GAP;
  const barW = slot - gap;
  const bars = vals.map((v, i) => ({
    i, v,
    x: x0 + i * slot + gap / 2,
    w: barW,
    y: y0 + (rows - v) * cellH,
    h: v * cellH,
    cx: x0 + i * slot + slot / 2
  }));
  const grid = [];
  for (let r = 0; r <= rows; r++) grid.push({ r, y: y0 + (rows - r) * cellH });
  const items = vals.map((v, i) => ({ i, cx: x0 + i * slot + slot / 2, y: y1 + R.IDY }));
  return { box:{ x0, x1, y0, y1 }, rows, cellH, slot, barW, bars, grid, items };
}

/* 字寬估計：全形（含中日韓）算一個字級寬，半形算 0.62 個字級寬。
   ⚠️ 標籤只驗錨點等於沒驗：置中的長標籤錨在畫布裡，兩端還是可能跑出去，
      也可能和隔壁那一格的標籤疊在一起。 */
function estTextW(s, fs){
  let w = 0;
  for (const ch of String(s)){
    const code = ch.codePointAt(0);
    const halfwidthKana = code >= 0xFF61 && code <= 0xFF9F;
    const wide = code > 0x2E7F && !halfwidthKana;
    w += wide ? fs : fs * 0.62;
  }
  return w;
}

function dirRef(a, b){ return a === b ? 'flat' : (a < b ? 'up' : 'down'); }

/* 把頁面算出來的那一份版面拿來驗。回傳問題字串陣列（空的表示過關）。 */
function checkPlan(plan, vals, rows, R, names, tag){
  const out = [];
  const ref = planRef(vals, rows, R);
  const near = (a, b) => typeof a === 'number' && Number.isFinite(a) && Math.abs(a - b) < EPS;

  if (!plan || !plan.box) return [tag + ': no plan was produced at all'];
  for (const k of ['x0', 'x1', 'y0', 'y1'])
    if (!near(plan.box[k], ref.box[k])) out.push(tag + ': box.' + k + ' is ' + plan.box[k] + ', the spec says ' + ref.box[k]);
  if (plan.rows !== rows) out.push(tag + ': rows is ' + plan.rows + ', not ' + rows);
  if (!near(plan.cellH, ref.cellH)) out.push(tag + ': cellH is ' + plan.cellH + ', the spec gives ' + ref.cellH);
  if (!near(plan.slot, ref.slot)) out.push(tag + ': slot is ' + plan.slot + ', the spec gives ' + ref.slot);
  if (!near(plan.barW, ref.barW)) out.push(tag + ': barW is ' + plan.barW + ', the spec gives ' + ref.barW);
  if (!(plan.cellH > 0)) out.push(tag + ': cellH is not positive, so the grid has no height');
  if (!(plan.barW > 0)) out.push(tag + ': barW is not positive, so no bar can be seen');

  if (!plan.bars || plan.bars.length !== vals.length){
    out.push(tag + ': ' + (plan.bars ? plan.bars.length : 0) + ' bars for ' + vals.length + ' items');
    return out;
  }
  if (!plan.grid || plan.grid.length !== rows + 1){
    out.push(tag + ': ' + (plan.grid ? plan.grid.length : 0) + ' grid lines, the spec needs ' + (rows + 1) +
             ' (a grid of ' + rows + ' cells always has one more line than cells)');
    return out;
  }

  /* ⚠️ 斷言的順序決定了哪一條真的被證明過。單調性排在逐條比對**前面**，
     否則任何把格線上下顛倒的改壞都會先撞上「grid line r sits at y=」，
     而單調那一條從頭到尾沒有被驗過。 */
  for (let r = 1; r <= rows; r++){
    if (!(plan.grid[r].y < plan.grid[r - 1].y - EPS)){
      out.push(tag + ': grid line ' + r + ' is not above grid line ' + (r - 1) + ' — the numbers would run the wrong way');
      return out;
    }
  }
  for (let r = 0; r <= rows; r++){
    if (plan.grid[r].r !== r) out.push(tag + ': grid line ' + r + ' is labelled ' + plan.grid[r].r);
    if (!near(plan.grid[r].y, ref.grid[r].y)) out.push(tag + ': grid line ' + r + ' sits at y=' + plan.grid[r].y + ', the spec gives ' + ref.grid[r].y);
    /* 縱軸的數字靠右對齊在 x0 － NDX，所以左緣是「錨點 － 字寬」。 */
    const left = ref.box.x0 - R.NDX - estTextW(String(r), R.NFS);
    if (left < 0) out.push(tag + ': the axis number ' + r + ' starts at x=' + left.toFixed(1) + ', outside the canvas');
  }
  if (!near(plan.grid[0].y, ref.box.y1)) out.push(tag + ': grid line 0 is not on the baseline');
  if (!near(plan.grid[rows].y, ref.box.y0)) out.push(tag + ': the top grid line is not at the top of the plot box');

  /* ⚠️ 順序同上：核心那兩條（頂端落在格線上、左右不可以顛倒）要排在
     逐欄比對**前面**，否則它們永遠會被 'bar i.y is …' 搶先，等於沒被驗過。 */
  for (let i = 0; i < vals.length; i++){
    const b = plan.bars[i];
    if (!near(b.y, plan.grid[vals[i]].y)){
      out.push(tag + ': bar ' + i + ' (value ' + vals[i] + ') does not top out on grid line ' + vals[i] +
               ' — "however many cells, that is how many there are" stops being readable off the picture');
      return out;
    }
    if (i > 0 && !(b.cx > plan.bars[i - 1].cx + EPS)){
      out.push(tag + ': bar ' + i + ' is not to the right of bar ' + (i - 1) + ' — the items are out of order');
      return out;
    }
  }
  for (let i = 0; i < vals.length; i++){
    const b = plan.bars[i], rb = ref.bars[i];
    if (b.v !== vals[i]) out.push(tag + ': bar ' + i + ' claims v=' + b.v + ' but the data says ' + vals[i]);
    for (const k of ['x', 'w', 'y', 'h', 'cx'])
      if (!near(b[k], rb[k])) out.push(tag + ': bar ' + i + '.' + k + ' is ' + b[k] + ', the spec gives ' + rb[k]);
    /* 每一條都從 0 開始：下緣一定是基線。 */
    if (!near(b.y + b.h, ref.box.y1))
      out.push(tag + ': bar ' + i + ' does not start from the 0 line, so the bars cannot be compared by height');
    if (b.x < ref.box.x0 - EPS || b.x + b.w > ref.box.x1 + EPS)
      out.push(tag + ': bar ' + i + ' runs from x=' + b.x + ' to ' + (b.x + b.w) + ', outside the plot box');
    if (b.y < ref.box.y0 - EPS)
      out.push(tag + ': bar ' + i + ' reaches y=' + b.y + ', above the top of the plot box');
  }

  if (!plan.items || plan.items.length !== vals.length){
    out.push(tag + ': ' + (plan.items ? plan.items.length : 0) + ' item labels for ' + vals.length + ' bars');
    return out;
  }
  for (let i = 0; i < vals.length; i++){
    const it = plan.items[i];
    if (!near(it.cx, ref.items[i].cx)) out.push(tag + ': item label ' + i + ' is not centred on its bar');
    if (!near(it.y, ref.box.y1 + R.IDY)) out.push(tag + ': item label ' + i + ' sits at y=' + it.y + ', the spec gives ' + (ref.box.y1 + R.IDY));
    /* 標籤的下緣（含下伸部）要留在畫布裡；置中的標籤兩端也要留在畫布裡，
       而且不可以碰到隔壁那一格。 */
    if (it.y + R.IFS * 0.3 > R.H)
      out.push(tag + ': item label ' + i + ' would be cut off by the bottom of the canvas');
    if (names){
      const half = estTextW(names[i], R.IFS) / 2;
      if (it.cx - half < 0 || it.cx + half > R.W)
        out.push(tag + ': item label "' + names[i] + '" runs off the side of the canvas');
      if (half > ref.slot / 2 - 4)
        out.push(tag + ': item label "' + names[i] + '" is ' + (half * 2).toFixed(1) +
                 'px wide but its slot is only ' + ref.slot.toFixed(1) + 'px — neighbouring labels would touch');
    }
  }
  return out;
}

/* 折線圖：點就是長條的頂端，段就是相鄰兩點。 */
function checkLine(plan, vals, rows, R, names, tag){
  const out = checkPlan(plan, vals, rows, R, names, tag);
  if (out.length) return out;
  if (!plan.pts || plan.pts.length !== vals.length){
    out.push(tag + ': ' + (plan.pts ? plan.pts.length : 0) + ' dots for ' + vals.length + ' items');
    return out;
  }
  /* ⚠️ NaN 讓每一條關聯比較靜靜通過（`Math.abs(NaN - x) > EPS` 是 false），
     所以比較之前一定要先確認兩邊都是有限的數（別課踩過這個坑）。 */
  const fin = v => typeof v === 'number' && Number.isFinite(v);
  for (let i = 0; i < vals.length; i++){
    for (const k of ['cx', 'cy'])
      if (!fin(plan.pts[i][k])) out.push(tag + ': dot ' + i + '.' + k + ' is not a finite number (' + plan.pts[i][k] + ')');
    if (Math.abs(plan.pts[i].cx - plan.bars[i].cx) > EPS)
      out.push(tag + ': dot ' + i + ' is not above the middle of its bar');
    if (Math.abs(plan.pts[i].cy - plan.bars[i].y) > EPS)
      out.push(tag + ': dot ' + i + ' is not on the top of its bar — the lesson says a dot IS the top of the bar');
    if (plan.pts[i].v !== vals[i]) out.push(tag + ': dot ' + i + ' claims v=' + plan.pts[i].v);
  }
  if (!plan.segs || plan.segs.length !== vals.length - 1){
    out.push(tag + ': ' + (plan.segs ? plan.segs.length : 0) + ' stretches for ' + vals.length + ' dots');
    return out;
  }
  for (let i = 0; i + 1 < vals.length; i++){
    const s = plan.segs[i];
    for (const k of ['x1', 'y1', 'x2', 'y2'])
      if (!fin(s[k])) out.push(tag + ': stretch ' + i + '.' + k + ' is not a finite number (' + s[k] + ')');
    if (Math.abs(s.x1 - plan.pts[i].cx) > EPS || Math.abs(s.y1 - plan.pts[i].cy) > EPS)
      out.push(tag + ': stretch ' + i + ' does not start on dot ' + i);
    if (Math.abs(s.x2 - plan.pts[i + 1].cx) > EPS || Math.abs(s.y2 - plan.pts[i + 1].cy) > EPS)
      out.push(tag + ': stretch ' + i + ' does not end on dot ' + (i + 1));
    if (s.dir !== dirRef(vals[i], vals[i + 1]))
      out.push(tag + ': stretch ' + i + ' says ' + s.dir + ', the reference says ' + dirRef(vals[i], vals[i + 1]));
    if (s.delta !== Math.abs(vals[i + 1] - vals[i]))
      out.push(tag + ': stretch ' + i + ' says delta ' + s.delta);
    /* 旁白是拿 va／vb 印出來的（「從週一（2 本）看到週二（5 本）」），
       所以那兩個數字也要對得上，不是只驗方向和差。 */
    if (s.va !== vals[i] || s.vb !== vals[i + 1])
      out.push(tag + ': stretch ' + i + ' remembers the pair (' + s.va + ', ' + s.vb +
               ') but the data says (' + vals[i] + ', ' + vals[i + 1] + ')');
    /* 往上的線在螢幕上要真的往上（y 往下是正的 —— triangle 那一課就栽在這裡）。 */
    if (s.dir === 'up' && !(s.y2 < s.y1 - EPS))
      out.push(tag + ': stretch ' + i + ' is "up" but the line does not rise on screen');
    if (s.dir === 'down' && !(s.y2 > s.y1 + EPS))
      out.push(tag + ': stretch ' + i + ' is "down" but the line does not fall on screen');
    if (s.dir === 'flat' && Math.abs(s.y2 - s.y1) > EPS)
      out.push(tag + ': stretch ' + i + ' is "flat" but the two ends sit at different heights');
  }
  return out;
}

/* ---------- 2) 統計：排序／filter 重寫的第二套實作 ---------- */
function maxRef(v){ return v.slice().sort((a, b) => b - a)[0]; }
function minRef(v){ return v.slice().sort((a, b) => a - b)[0]; }
function sumRef(v){ return v.reduce((a, b) => a + b, 0); }
function rowsRef(v){ return Math.max(1, maxRef(v)); }
function soleIndexRef(v, target){
  const hits = v.map((x, i) => [x, i]).filter(p => p[0] === target);
  return hits.length === 1 ? hits[0][1] : -1;
}
function soleMaxRef(v){ return soleIndexRef(v, maxRef(v)); }
function soleMinRef(v){ return soleIndexRef(v, minRef(v)); }
function overRef(v, k){ return v.filter(x => x > k).length; }
function segDirsRef(v){
  const out = [];
  for (let i = 0; i + 1 < v.length; i++) out.push(dirRef(v[i], v[i + 1]));
  return out;
}
function countDirRef(v, want){ return segDirsRef(v).filter(d => d === want).length; }

/* 全部的 n 位、0~hi 的組合。窮舉比抽樣可靠 —— 參數空間小的時候不要抽樣。 */
function allTuples(n, hi){
  let out = [[]];
  for (let k = 0; k < n; k++){
    const next = [];
    for (const t of out) for (let v = 0; v <= hi; v++) next.push(t.concat([v]));
    out = next;
  }
  return out;
}

/* ---------- 3) 字典真值表 ----------
   拿頁面的字典去比頁面的字典等於自己比自己。這一張表是獨立寫的，
   兩邊逐字相同才算過（'杯' 寫成 '碗' 這種錯只有這裡抓得到）。 */
const ITEM_REF = {
  zh:{
    apple:'蘋果', banana:'香蕉', grape:'葡萄', melon:'西瓜',
    dog:'狗', cat:'貓', fish:'魚', bird:'鳥',
    story:'故事', science:'科學', comic:'漫畫', poem:'詩集',
    juice:'果汁', milk:'牛奶', soda:'汽水', tea:'紅茶',
    red:'紅', blue:'藍', green:'綠', yellow:'黃',
    run:'跑步', jump:'跳繩', swim:'游泳', ball:'球類',
    mon:'週一', tue:'週二', wed:'週三', thu:'週四', fri:'週五',
    m1:'一月', m2:'二月', m3:'三月', m4:'四月'
  },
  en:{
    apple:'Apple', banana:'Banana', grape:'Grape', melon:'Melon',
    dog:'Dog', cat:'Cat', fish:'Fish', bird:'Bird',
    story:'Story', science:'Science', comic:'Comic', poem:'Poem',
    juice:'Juice', milk:'Milk', soda:'Soda', tea:'Tea',
    red:'Red', blue:'Blue', green:'Green', yellow:'Yellow',
    run:'Running', jump:'Skipping', swim:'Swimming', ball:'Ball',
    mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri',
    m1:'Jan', m2:'Feb', m3:'Mar', m4:'Apr'
  }
};
const UNIT_REF = {
  zh:{ fruit:'個', pet:'隻', book:'本', drink:'杯', craft:'張', sport:'人', week:'本', month:'次' },
  en:{ fruit:'piece', pet:'pet', book:'book', drink:'cup', craft:'sheet', sport:'child', week:'book', month:'visit' }
};
/* 情境名的真值表。圖說要逐字重建，就得連情境名一起釘 ——
   拿頁面的字典比頁面的字典等於自己比自己。 */
const SCENE_REF = {
  zh:{
    fruit:'水果店今天賣出的水果', pet:'班上同學養的寵物',
    book:'圖書館今天借出的書', drink:'福利社今天賣出的飲料',
    craft:'美勞課用掉的色紙', sport:'班上同學最喜歡的運動',
    week:'圖書館這一週每天借出的書', month:'小安每個月去圖書館的次數'
  },
  en:{
    fruit:'Fruit sold at the shop today', pet:'Pets our class keeps',
    book:'Books borrowed from the library today', drink:'Drinks sold at the tuck shop today',
    craft:'Craft paper used in art class', sport:'Favourite sports in our class',
    week:'Books borrowed each day this week', month:'Library visits each month'
  }
};
/* 課程頁只用到六個情境（沒有 sport／month，那兩個只出現在複習頁）。 */
const INDEX_UNIT_KEYS = ['fruit', 'pet', 'book', 'drink', 'craft', 'week'];

function plEnRef(n, w){ return n === 1 ? w : w + 's'; }
function unitPlRef(n, unit, lang){
  if (lang === 'zh') return unit;
  if (unit === 'child') return n === 1 ? 'child' : 'children';
  return plEnRef(n, unit);
}

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站共用的唯一一份）。
   ⚠️ 2026-09-02 從這裡抽出去的。不要把它複製回來：這個檢查原本只有這一課有，
   結果 add-sub／time／length／divide／multiply 五課完全沒有（issue #2）。
   量詞由各課自己給 —— 共用清單漏掉某一課的量詞時，那一課會多出一個假的運算元。 */
const arithProblems = require('./lib/arith.js').makeArith({
  units: ['格','個','本','杯','隻','張','人','次','段','項','條','題'],
  unitsEn: ['cells?','pieces?','pets?','books?','cups?','sheets?','children','child','visits?','items?','stretch(?:es)?']
});

/* ---------- 渲染出來的字串掃描 ---------- */
const EN_S_WORD_OK = ['is', 'has', 'was', 'its', 'less', 'plus', 'thus', 'this', 'does', 'yes', 'as',
  'gives', 'leaves', 'means', 'makes', 'needs', 'takes', 'lands', 'adds', 'comes', 'goes', 'says'];
const EN_S_ADVERB_RE = /(wards|ways)$/;
const EN_S_SINGULAR_OK = ['class', 'bus', 'glass', 'cross', 'pass', 'gas', 'lens', 'series', 'analysis', 'species'];
const EN_IRREGULAR_PLURAL_RE = /\b1 (people|children|men|women|feet|teeth|mice|geese)\b/;
const EN_ONE_RE_G = /\b1 ([a-z]+s)\b/g;
const EN_ARE_ONE_RE = /\b1 [a-z]+ are\b/;
function textProblems(s, lang, tag){
  const out = [];
  const shown = String(s).replace(/<[^>]+>/g, '');
  if (/undefined|NaN|\[object/.test(shown)) out.push(tag + ' leaks an internal value: ' + shown.slice(0, 90));
  if (!shown.trim()) out.push(tag + ' renders empty');
  /* ⚠️ 這一課不用負數。負號要**緊貼數字**才算負號，
     不然「6 － 2」這種減法算式會被誤判；前面是數字時也不算（2026-09-01 這種日期）。 */
  /* 負號 vs 減號只有一個判準：**減號前面（跳過空白之後）有沒有運算元**。
     運算元 ＝ 數字或右括號。有 → 那是減法；沒有 → 那是負號。
     `6 － 2`／`（6 ＋ 2）－3`／`2026-09-01` 都有運算元 → 放行；
     `是 －3`／`of － 3`／`＝ － 3`／句首的 `－ 3` 都沒有 → 抓到。
     ⚠️ 這一條走了兩次冤枉路：先是「前面不是數字」（把 `）－3` 誤判成負數），
     再是「前面是運算符號」（把 `of － 3` 這種散文裡的負數放掉）。
     兩次都是同一個錯誤 —— 去列舉前面**可以**是什麼，而不是問「有沒有運算元」。 */
  const neg = /(?:^|[^0-9)）\s])\s*[-−－]\s*\d/.exec(shown);
  if (neg) out.push(tag + ' shows a negative number ("' + neg[0].trim() + '"), but this lesson never uses negatives');
  if (lang === 'zh'){
    const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
    if (glued) out.push(tag + ' has Chinese glued to a digit: ' + [...new Set(glued)].join(' '));
  } else {
    if (/[一-鿿]/.test(shown)) out.push(tag + ' (English) contains Chinese: ' + shown.slice(0, 60));
    /* ⚠️ 這幾條規則原本大小寫敏感，`1 Books`／`1 Children` 就整個逃掉（codex 抓到）。 */
    const low = shown.toLowerCase();
    /* ⚠️ 用 exec() 只看得到**第一個**符合的字：`1 is one cell; 1 books` 會因為
       第一個 `1 is` 在白名單裡就整句放行。要每一個都看。 */
    for (const one of low.matchAll(EN_ONE_RE_G)){
      if (EN_S_WORD_OK.indexOf(one[1]) < 0 && !EN_S_ADVERB_RE.test(one[1]) &&
          EN_S_SINGULAR_OK.indexOf(one[1]) < 0)
        out.push(tag + ' has an English plural after 1: "' + one[0] + '"');
    }
    const irr = EN_IRREGULAR_PLURAL_RE.exec(low);
    if (irr) out.push(tag + ' has an irregular English plural after 1: "' + irr[0] + '"');
    const are = EN_ARE_ONE_RE.exec(low);
    if (are) out.push(tag + ' has "are" after a singular 1: "' + are[0] + '"');
  }
  const dbl = shown.match(/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/);
  if (dbl) out.push(tag + ' has doubled punctuation "' + dbl[0] + '"');
  return out;
}

/* ---------- 跨頁用詞釘樁 ----------
   同一條規則在四頁必須用同一句話講。這一課最危險的兩句是
   「一格代表 1 個 → 幾格就是幾個」與「格子最少要幾格」。
   ⚠️ `min` 一律寫成**當下真實的出現次數**，不是「至少 2」——
      實際有 3 份而只要求 2 份的話，拿掉其中一份還是綠的。
   ⚠️ 「必須出現」只有下界，擋不住「又多加了一句錯的」，所以規則類的釘樁要**成對**：
      一張必須出現的表 ＋ 一張 FORBIDDEN 一個字都不可以出現的表，中英各釘一次。 */
const SIBLING_RULES = [
  { file:'index', text:'這一課的每一格永遠代表 1 個', min:2,
    why:'is the single premise this whole lesson turns on' },
  { file:'index', text:'一格代表 2 個、5 個、10 個', min:2,
    why:'is the grade-5 boundary the scope note has to state' },
  { file:'index', text:'資料偵察隊', min:3,
    why:'names the grade-5 lesson that owns scaled cells' },
  { file:'index', text:'分類整理小達人', min:3,
    why:'names the grade-2 lesson that stopped at tables' },
  { file:'index', text:'表格讀心術', min:3,
    why:'names the grade-3 lesson that stopped at tables' },
  { file:'index', text:'格子最少要畫到「最多的那一項」那麼多格', min:2,
    why:'is the drawing rule, and it must stay a lower bound' },
  { file:'index', text:'In this lesson one cell always means 1.', min:1,
    why:'is the English half of the premise — pinning only the Chinese lets English drift' },
  { file:'reference', text:'這一課的每一格永遠代表 1 個', min:2,
    why:'must match the lesson page word for word' },
  { file:'reference', text:'最多的那一項是幾個，就至少要幾格', min:2,
    why:'is the drawing rule on the cheat sheet, and it must stay a lower bound' },
  { file:'reference', text:'格線永遠比格子多 1 條', min:3,
    why:'is the answer to the lesson’s headline misconception' },
  { file:'reference', text:'In this lesson one cell always means 1.', min:1,
    why:'is the English half of the premise on the cheat sheet' },
  { file:'parents', text:'永遠代表 1 個', min:4,
    why:'states the premise for the adult' },
  { file:'parents', text:'資料偵察隊', min:4,
    why:'is where the parent is told the next step lives' },
  { file:'parents', text:'統計圖工作室接訂單', min:2,
    why:'is the game name the mastery bar refers to' },
  { file:'review', text:'一格代表 1 ', min:8,
    why:'is what every generated chart caption must say' }
];
/* 這幾句話一個字都不可以出現 —— 它們是「規則被寫太滿」或「越界到五年級」的版本。 */
const FORBIDDEN = [
  { file:'index', text:'格子剛好要', why:'the grid size is a lower bound, never an exact requirement' },
  { file:'reference', text:'格子剛好要', why:'the grid size is a lower bound on the cheat sheet too' },
  { file:'index', text:'比比看哪一段變化最大', why:'comparing steepness is grade 5’s task, and this lesson must not take it on' },
  { file:'index', text:'找出變化最大的一段', why:'that is the grade-5 lesson’s own wording for its task' },
  { file:'review', text:'變化最大', why:'no generator may ask grade 5’s steepness question' },
  { file:'reference', text:'一格代表 2 個的長條圖', why:'scaled cells belong to grade 5, not here' }
];

const GEN_IDS = ['readBar', 'mostBar', 'leastBar', 'diffBars', 'totalBars', 'gridRowsQ',
                 'barCells', 'zeroItem', 'lineDir', 'linePoint', 'countOverQ', 'countSeg'];

/* ---------- 題庫神諭 ----------
   `verify_lesson_data.js` 內建的算術重算只認得「a ＋ b ＝ ?」那種題幹，
   這一課 12 題一題都不符合 —— 沒有這一張表的話，把 ans 改掉完全不會響。
   `stemExact` 逐字釘死題幹：白名單（集合比對）擋不掉「重複使用既有數字」的偷加。 */
const BANK_EXPECTED = {
  qs: [
    { stemExact:'一張長條圖<strong>一格代表 1 個</strong>。有一條長條疊了 <strong>7</strong> 格，那一項有幾個？',
      enStemExact:'On a bar chart <strong>one cell means 1</strong>. One bar is stacked <strong>7</strong> cells high. How many is that?',
      answer:'7' },
    { stemExact:'一張長條圖上，最多的那一項是 <strong>9</strong> 個。這張圖的格子<strong>最少</strong>要幾格？',
      enStemExact:'The item with the most on a bar chart is <strong>9</strong>. How many cells does the grid need <strong>at least</strong>?',
      answer:'9' },
    { stemExact:'長條圖上，蘋果 <strong>6</strong> 格、西瓜 <strong>2</strong> 格。蘋果比西瓜多幾個？',
      enStemExact:'On a bar chart Apple is <strong>6</strong> cells and Melon is <strong>2</strong> cells. How many more apples are there than melons?',
      answer:'4' },
    { stemExact:'折線圖上，週一是 <strong>3</strong> 本、週二是 <strong>7</strong> 本。週一到週二這一段線是怎麼變的？',
      enStemExact:'On a line graph Monday is <strong>3</strong> books and Tuesday is <strong>7</strong> books. How did that stretch of the line change?',
      answer:'往上，多了 4 本', enAnswer:'Up by 4 books' },
    { stemExact:'長條圖上四項分別是 <strong>3、5、0、2</strong> 個。<strong>一共</strong>幾個？',
      enStemExact:'The four bars on a chart are <strong>3, 5, 0, 2</strong>. How many are there <strong>altogether</strong>?',
      answer:'10' },
    { stemExact:'一張<strong>照著統計表畫好</strong>的長條圖上，有一項的長條<strong>一格都沒有</strong>。這表示什麼？',
      enStemExact:'Someone has <strong>finished</strong> drawing a bar chart from a table. One item has <strong>no cells at all</strong>. What does that mean?',
      answer:'那一項是 0 個', enAnswer:'That item is 0' }
  ],
  qsAdv: [
    { answer:'7' },
    { answer:'2' },
    { answer:'1' },
    { answer:'最多的那一項是 8 個', enAnswer:'The item with the most is 8' }
  ],
  qsBoost: [
    { answer:'他數的是格線不是格子，長條只有 5 格，是 5 個',
      enAnswer:'She counted grid lines, not cells — the bar is only 5 cells, so it is 5' },
    { answer:'名字要留著，長條畫 0 格 —— 這樣才看得出「有這一項，只是 0」',
      enAnswer:'The name stays and the bar is 0 cells tall — that is how a reader sees “counted, and it came out 0”' }
  ]
};
/* 「問的是什麼」單獨驗一次：只驗數字的話，把題幹改成問別的、正解不動，全部都是綠的。 */
const BANK_ASK = {
  qs: [
    { must:['那一項有幾個'], never:['最少'] },
    { must:['<strong>最少</strong>要幾格'], never:['一共'] },
    { must:['多幾個'], never:['一共'] },
    { must:['這一段線是怎麼變的'], never:['一共'] },
    { must:['<strong>一共</strong>幾個'], never:['最少'] },
    { must:['照著統計表畫好', '一格都沒有'], never:['一共'] }
  ],
  qsAdv: [
    { must:['最多的比最少的多幾本'], never:['一共'] },
    { must:['有幾項比 4 本多'], never:['一共'] },
    { must:['有幾段線是往下的'], never:['往上的'] },
    { must:['格子<strong>最少</strong>要 <strong>8</strong> 格'], never:['一共有幾本'] }
  ],
  qsBoost: [
    { must:['他錯在哪裡'], never:['一共'] },
    { must:['他錯在哪裡'], never:['一共'] }
  ]
};
/* 英文題幹也要單獨釘一次：只釘中文的話，英文可以問別的運算而保留同一個答案。 */
const BANK_ASK_EN = {
  qs: [
    { must:['cells high'], never:['at least'] },
    { must:['how many cells does the grid need <strong>at least</strong>'], never:['altogether'] },
    { must:['how many more apples'], never:['altogether'] },
    { must:['how did that stretch of the line change'], never:['altogether'] },
    { must:['<strong>altogether</strong>'], never:['at least'] },
    { must:['has <strong>finished</strong> drawing'], never:['altogether', 'not finished', 'has not'] }
  ],
  qsAdv: [
    { must:['how many more does the most have than the least'], never:['altogether'] },
    { must:['how many items are more than 4 books'], never:['altogether'] },
    { must:['how many stretches of the line go down'], never:['go up'] },
    { must:['grid needs <strong>at least 8</strong> cells'], never:['how many altogether'] }
  ],
  qsBoost: [
    { must:['what has she got wrong'], never:['altogether'] },
    { must:['what has he got wrong'], never:['altogether'] }
  ]
};

/* 這幾題的答案要從**題幹裡的數字**重算，不是拿設定檔自己的常數算 ——
   後者在題幹被改掉時不會響。 */
const BANK_RECOMPUTE = [
  { bank:'qs', i:0, from:[1, 7], calc:l => String(l[1]) },
  { bank:'qs', i:1, from:[9], calc:l => String(rowsRef([l[0]])) },
  { bank:'qs', i:2, from:[6, 2], calc:l => String(l[0] - l[1]) },
  { bank:'qs', i:4, from:[3, 5, 0, 2], calc:l => String(sumRef(l)) },
  { bank:'qsAdv', i:0, from:[6, 4, 8, 1], calc:l => String(maxRef(l) - minRef(l)) },
  { bank:'qsAdv', i:1, from:[6, 4, 8, 1, 4], calc:l => String(overRef(l.slice(0, 4), l[4])) },
  { bank:'qsAdv', i:2, from:[2, 5, 5, 3, 6], calc:l => String(countDirRef(l, 'down')) }
];

module.exports = {
  /* ================= 刻意改壞測試 ================= */
  breaks: [
    /* --- 版面：頁面的排版和獨立寫死的規格必須一致 --- */
    { file:"index", via:"index", expect:"does not top out on grid line",
      find:"                  y:b.y1 - vals[i] * cellH, h:vals[i] * cellH });",
      replace:"                  y:b.y1 - (vals[i] + 1) * cellH, h:vals[i] * cellH });",
      why:"every bar would be drawn one cell too tall for its own value" },
    { file:"index", via:"index", expect:"grid line 0 sits at y=",
      find:"    for (var r = 0; r <= rows; r++) grid.push({ r:r, y:b.y1 - r * cellH });",
      replace:"    for (var r = 0; r <= rows; r++) grid.push({ r:r, y:b.y1 - r * cellH - 4 });",
      why:"the grid would float off the baseline the bars start from" },
    { file:"index", via:"index", expect:"barW is",
      find:"    var barW = slot * (1 - GAP_RATIO);",
      replace:"    var barW = slot * (1 - GAP_RATIO / 2);",
      why:"the bars would be wider than the spec, so neighbours would touch" },
    { file:"index", via:"index", expect:"cellH is",
      find:"    var cellH = (b.y1 - b.y0) / rows;",
      replace:"    var cellH = (b.y1 - b.y0) / (rows + 1);",
      why:"one whole cell of height would go missing" },
    { file:"index", via:"index", expect:"slot is",
      find:"    var slot = (b.x1 - b.x0) / vals.length;",
      replace:"    var slot = (b.x1 - b.x0) / (vals.length + 1);",
      why:"the bars would not fill the plot box" },
    { file:"index", via:"index", expect:"does not have exactly one more line than cells",
      find:"    for (var r = 0; r <= rows; r++) grid.push({ r:r, y:b.y1 - r * cellH });",
      replace:"    for (var r = 0; r < rows; r++) grid.push({ r:r, y:b.y1 - r * cellH });",
      why:"the top grid line would be missing, so the tallest bar has nothing to top out on" },
    { file:"index", via:"index", expect:"box.x0 is",
      find:"  var PAD_L = 48, PAD_R = 18, PAD_T = 20, PAD_B = 48;",
      replace:"  var PAD_L = 20, PAD_R = 18, PAD_T = 20, PAD_B = 48;",
      why:"the left padding would no longer leave room for the axis numbers" },
    { file:"index", via:"index", expect:"layout constant FIG_H",
      find:"  var FIG_W = 520, FIG_H = 300;",
      replace:"  var FIG_W = 520, FIG_H = 280;",
      why:"the canvas would shrink without the spec following" },
    { file:"index", via:"index", expect:"layout constant ITEM_DY",
      find:"  var ITEM_DY = 22;          // 項目名的基線在橫軸下方多遠",
      replace:"  var ITEM_DY = 46;          // 項目名的基線在橫軸下方多遠",
      why:"the item names would be pushed off the bottom of the canvas" },
    { file:"index", via:"index", expect:"is not centred on its bar",
      find:"      items.push({ i:k, cx:b.x0 + slot * (k + 0.5), y:b.y1 + ITEM_DY });",
      replace:"      items.push({ i:k, cx:b.x0 + slot * k, y:b.y1 + ITEM_DY });",
      why:"every item name would sit on the gap instead of over its bar" },
    { file:"index", via:"index", expect:"is not to the right of bar",
      find:"      var cx = b.x0 + slot * (i + 0.5);",
      replace:"      var cx = b.x0 + slot * (vals.length - i - 0.5);",
      why:"the bars would be drawn right to left while the labels stay left to right" },
    { file:"index", via:"index", expect:"bar 0.x is",
      find:"      bars.push({ i:i, v:vals[i], cx:cx, x:cx - barW / 2, w:barW,",
      replace:"      bars.push({ i:i, v:vals[i], cx:cx, x:cx - barW / 3, w:barW,",
      why:"the bars would sit off-centre over their own labels (left/right order and the tops stay right, so only the column-by-column comparison can catch it)" },
    { file:"index", via:"index", expect:"the reference says",
      find:"                  dir:segDir(vals[i], vals[i + 1]), delta:segDelta(vals[i], vals[i + 1]) });",
      replace:"                  dir:'up', delta:segDelta(vals[i], vals[i + 1]) });",
      why:"every stretch would report itself as rising, whatever the numbers do" },
    { file:"index", via:"index", expect:"remembers the pair",
      find:"      segs.push({ i:i, x1:pts[i].cx, y1:pts[i].cy, x2:pts[i + 1].cx, y2:pts[i + 1].cy,\n                  va:vals[i], vb:vals[i + 1],",
      replace:"      segs.push({ i:i, x1:pts[i].cx, y1:pts[i].cy, x2:pts[i + 1].cx, y2:pts[i + 1].cy,\n                  va:vals[i], vb:vals[i + 1] + 1,",
      why:"the narration would quote the wrong pair of values for the stretch it is describing" },
    { file:"index", via:"index", expect:"stretch 0 says delta",
      find:"                  dir:segDir(vals[i], vals[i + 1]), delta:segDelta(vals[i], vals[i + 1]) });",
      replace:"                  dir:segDir(vals[i], vals[i + 1]), delta:segDelta(vals[i], vals[i + 1]) + 1 });",
      why:"every stretch would claim a change one bigger than the numbers give" },
    { file:"index", via:"index", expect:"layout constant AXIS_NUM_DX",
      find:"  var AXIS_NUM_DX = 10;      // 縱軸數字離軸線多遠（往左）",
      replace:"  var AXIS_NUM_DX = 46;      // 縱軸數字離軸線多遠（往左）",
      why:"the axis numbers would be pushed off the left edge of the canvas" },
    { file:"index", via:"index", expect:"is not above grid line",
      find:"    var grid = [];\n    for (var r = 0; r <= rows; r++) grid.push({ r:r, y:b.y1 - r * cellH });",
      replace:"    var grid = [];\n    for (var r = 0; r <= rows; r++) grid.push({ r:r, y:b.y0 + r * cellH });",
      why:"the axis numbers would count downwards instead of upwards" },
    { file:"index", via:"index", expect:"the .chartfig CSS size",
      find:"  .chartfig{width:100%;max-width:520px;height:300px;display:block;margin:0 auto}",
      replace:"  .chartfig{width:100%;max-width:520px;height:320px;display:block;margin:0 auto}",
      why:"the CSS height would stop matching the viewBox, squashing every chart" },

    /* --- 折線圖 --- */
    { file:"index", via:"index", expect:"is not on the top of its bar",
      find:"      return { i:bar.i, v:bar.v, cx:bar.cx, cy:bar.y };",
      replace:"      return { i:bar.i, v:bar.v, cx:bar.cx, cy:bar.y + 6 };",
      why:"the dots would float below the tops of the bars they are meant to be" },
    { file:"index", via:"index", expect:"does not end on dot",
      find:"      segs.push({ i:i, x1:pts[i].cx, y1:pts[i].cy, x2:pts[i + 1].cx, y2:pts[i + 1].cy,",
      replace:"      segs.push({ i:i, x1:pts[i].cx, y1:pts[i].cy, x2:pts[i + 1].cx, y2:pts[i].cy,",
      why:"every stretch would be drawn flat no matter what the numbers do" },
    { file:"index", via:"index", expect:"stretches for",
      find:"    for (var i = 0; i + 1 < pts.length; i++){\n      segs.push({ i:i,",
      replace:"    for (var i = 0; i + 2 < pts.length; i++){\n      segs.push({ i:i,",
      why:"the last stretch of the line would be missing" },
    { file:"index", via:"index", expect:"segDir disagrees with the reference on",
      find:"  function segDir(a, b){ return b > a ? 'up' : b < a ? 'down' : 'flat'; }",
      replace:"  function segDir(a, b){ return b > a ? 'down' : b < a ? 'up' : 'flat'; }",
      why:"up and down would be swapped everywhere the lesson names a direction" },
    { file:"index", via:"index", expect:"segDelta disagrees with the reference",
      find:"  function segDelta(a, b){ return Math.abs(b - a); }",
      replace:"  function segDelta(a, b){ return Math.abs(b - a) + 1; }",
      why:"every stated change would be one too many" },

    /* --- 統計核心 --- */
    { file:"index", via:"index", expect:"gridRows disagrees with the reference",
      find:"  function gridRows(vals){ return Math.max(1, maxOf(vals)); }",
      replace:"  function gridRows(vals){ return Math.max(1, maxOf(vals) + 1); }",
      why:"the grid would always be one cell taller than the fewest that fit" },
    { file:"index", via:"index", expect:"gridRows disagrees with the reference on [0,0,0,0]",
      find:"  function gridRows(vals){ return Math.max(1, maxOf(vals)); }",
      replace:"  function gridRows(vals){ return maxOf(vals) || (vals.length ? maxOf(vals) : 1); }",
      why:"an all-zero data set would ask for a grid of height 0" },
    { file:"index", via:"index", expect:"minOf disagrees with the reference",
      find:"    for (var i = 1; i < vals.length; i++) if (vals[i] < m) m = vals[i];",
      replace:"    for (var i = 1; i < vals.length; i++) if (vals[i] < m && vals[i] > 0) m = vals[i];",
      why:"a 0 item would never be found as the smallest" },
    { file:"index", via:"index", expect:"sumOf disagrees with the reference",
      find:"    for (var i = 0; i < vals.length; i++) s += vals[i];",
      replace:"    for (var i = 1; i < vals.length; i++) s += vals[i];",
      why:"the total would silently drop the first item" },
    { file:"index", via:"index", expect:"soleMaxIndex disagrees with the reference",
      find:"    var m = maxOf(vals), at = -1, n = 0;\n    for (var i = 0; i < vals.length; i++) if (vals[i] === m){ at = i; n++; }\n    return n === 1 ? at : -1;\n  }\n  function soleMinIndex(vals){",
      replace:"    var m = maxOf(vals), at = -1, n = 0;\n    for (var i = 0; i < vals.length; i++) if (vals[i] === m){ at = i; n++; }\n    return at;\n  }\n  function soleMinIndex(vals){",
      why:"a tie for the most would be reported as a single winner" },
    { file:"index", via:"index", expect:"soleMinIndex disagrees with the reference",
      find:"    var m = minOf(vals), at = -1, n = 0;\n    for (var i = 0; i < vals.length; i++) if (vals[i] === m){ at = i; n++; }\n    return n === 1 ? at : -1;",
      replace:"    var m = minOf(vals), at = -1, n = 0;\n    for (var i = 0; i < vals.length; i++) if (vals[i] === m){ at = i; n++; }\n    return at;",
      why:"a tie for the least would be reported as a single winner" },
    { file:"index", via:"index", expect:"countOver(",
      find:"    for (var i = 0; i < vals.length; i++) if (vals[i] > k) n++;",
      replace:"    for (var i = 0; i < vals.length; i++) if (vals[i] >= k) n++;",
      why:"“more than k” would start counting an item that is exactly k" },
    { file:"index", via:"index", expect:"countDir(",
      find:"    for (var i = 0; i + 1 < vals.length; i++) if (segDir(vals[i], vals[i + 1]) === want) n++;",
      replace:"    for (var i = 0; i + 1 < vals.length; i++) if (segDir(vals[i], vals[i + 1]) !== 'flat') n++;",
      why:"counting the stretches that go down would also count the ones that go up" },
    { file:"index", via:"index", expect:"s1Steps for",
      find:"    for (var i = 0; i < vals.length; i++) n += Math.max(1, vals[i]);",
      replace:"    for (var i = 0; i < vals.length; i++) n += vals[i];",
      why:"a 0 item would get no step of its own, so the lesson never pauses to explain it" },
    { file:"index", via:"index", expect:"s1Where says a 0 item has stacked",
      find:"      if (left <= need) return { at:i, done:Math.min(left, vals[i]) };",
      replace:"      if (left <= need) return { at:i, done:left };",
      why:"the 0 item would be narrated as having stacked one cell" },

    /* --- 資料集本身 --- */
    { file:"index", via:"index", expect:"has no single item with the most",
      find:"    { id:'fruit', keys:['apple', 'banana', 'grape', 'melon'], vals:[5, 3, 6, 2] },",
      replace:"    { id:'fruit', keys:['apple', 'banana', 'grape', 'melon'], vals:[6, 3, 6, 2] },",
      why:"“which item has the most” would stop having one answer" },
    { file:"index", via:"index", expect:"has no single item with the least",
      find:"    { id:'pet',   keys:['dog', 'cat', 'fish', 'bird'],        vals:[4, 7, 2, 1] },",
      replace:"    { id:'pet',   keys:['dog', 'cat', 'fish', 'bird'],        vals:[4, 7, 1, 1] },",
      why:"“which item has the least” would stop having one answer" },
    { file:"index", via:"index", expect:"needs an item that is 0",
      find:"    { id:'drink', keys:['juice', 'milk', 'soda', 'tea'],      vals:[3, 5, 0, 2] }",
      replace:"    { id:'drink', keys:['juice', 'milk', 'soda', 'tea'],      vals:[3, 5, 1, 2] }",
      why:"example 2 would lose the 0 item it exists to teach" },
    { file:"index", via:"index", expect:"exactly one of the four data sets should contain a 0",
      find:"    { id:'book',  keys:['story', 'science', 'comic', 'poem'], vals:[6, 4, 8, 1] },",
      replace:"    { id:'book',  keys:['story', 'science', 'comic', 'poem'], vals:[6, 4, 8, 0] },",
      why:"the 0 case would stop being the special case example 2 singles out" },
    { file:"index", via:"index", expect:"DRAW_ROWS must offer the fewest-that-fit",
      find:"  var DRAW_ROWS = [4, 5, 6, 7];",
      replace:"  var DRAW_ROWS = [4, 5, 7, 8];",
      why:"none of the offered grid heights would be the fewest that fit" },
    { file:"index", via:"index", expect:"DRAW_ROWS must offer a height that is too small",
      find:"  var DRAW_ROWS = [4, 5, 6, 7];",
      replace:"  var DRAW_ROWS = [6, 7, 8, 9];",
      why:"no offered height would be too small, so “not enough” is never shown" },
    { file:"index", via:"index", expect:"DRAW_ROWS must offer a height that fits but is not the fewest",
      find:"  var DRAW_ROWS = [4, 5, 6, 7];",
      replace:"  var DRAW_ROWS = [3, 4, 5, 6];",
      why:"no offered height would be more than enough, so “at least” is never demonstrated" },
    { file:"index", via:"index", expect:"LINE must show at least one \"flat\"",
      find:"  var LINE = { id:'week', keys:['mon', 'tue', 'wed', 'thu', 'fri'], vals:[2, 5, 5, 3, 6] };",
      replace:"  var LINE = { id:'week', keys:['mon', 'tue', 'wed', 'thu', 'fri'], vals:[2, 5, 6, 3, 8] };",
      why:"the line graph would never level off, so “no change” is never demonstrated" },
    { file:"index", via:"index", expect:"LINE must show at least one \"down\"",
      find:"  var LINE = { id:'week', keys:['mon', 'tue', 'wed', 'thu', 'fri'], vals:[2, 5, 5, 3, 6] };",
      replace:"  var LINE = { id:'week', keys:['mon', 'tue', 'wed', 'thu', 'fri'], vals:[2, 5, 5, 6, 8] };",
      why:"the line graph would never fall, so “down” is never demonstrated" },
    { file:"index", via:"index", expect:"makes the \"more than k\" answer degenerate",
      find:"  var TWO_OVER_K = 4;",
      replace:"  var TWO_OVER_K = 9;",
      why:"no item would clear the threshold, so the two-step example answers 0" },
    { file:"index", via:"index", expect:"must land exactly on one of the bars",
      find:"  var TWO_OVER_K = 4;",
      replace:"  var TWO_OVER_K = 5;",
      why:"no item would sit exactly on the threshold, so “exactly k does not count” is never shown" },

    /* --- 小遊戲「統計圖工作室接訂單」（§六之五，2026-10-08） --- */
    { file:"index", via:"index", expect:"does not check its board generation",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板：放開什麼都不做 */\n",
      replace:"",
      why:"a cell held across Restart could stack itself onto the new chart" },
    { file:"index", via:"index", expect:"losing pointer capture no longer puts the piece back",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"",
      why:"a piece whose capture is lost would stay stuck mid-drag" },
    { file:"index", via:"index", expect:"can be picked up by a second finger",
      find:"if (!e.isPrimary || P.locked || gSolved || start || gen !== gGen) return;",
      replace:"if (P.locked || gSolved || start || gen !== gGen) return;",
      why:"a second finger could pick a piece up" },
    { file:"index", via:"index", expect:"placed pieces still catch taps",
      find:".gpiece.locked{cursor:default;pointer-events:none}",
      replace:".gpiece.locked{cursor:default}",
      why:"a placed card would block taps on what is under it" },
    { file:"index", via:"index", expect:"a second finger can start a board tap",
      find:"      if (!e.isPrimary) return;   /* 第二根手指",
      replace:"      /* 第二根手指",
      why:"a second finger could tap the board (move the ✂️)" },
    { file:"index", via:"index", expect:"no longer snaps to a grid line while it is dragged",
      find:"if (o.axis === 'y') P.place(orig.x, o.snapY(orig.y + dy));",
      replace:"if (o.axis === 'y') P.place(orig.x, orig.y + dy);",
      why:"the ✂️ would float between lines while dragged, so release would judge something not shown" },
    { file:"index", via:"index", expect:"does not clear the hint",
      find:"    elHint.textContent = '';   /* 過關了",
      replace:"    /* 過關了",
      why:"the level-2 hint would keep saying how many cells are still missing on a solved board (verifier finding)" },
    { file:"index", via:"index", expect:"a round should give +20",
      find:"    var pts = gMistake ? 10 : 20;",
      replace:"    var pts = 20;",
      why:"mistakes would cost nothing at the end of a round" },
    { file:"index", via:"index", expect:"a mistake does not cost 5 (floored at 0)",
      find:"    gScore = Math.max(0, gScore - 5); elScore.textContent = gScore;",
      replace:"    gScore = gScore - 5; elScore.textContent = gScore;",
      why:"the score could go negative" },
    { file:"index", via:"index", expect:"shown although nothing was taken",
      find:"    var lost = gScore >= 5 ? 5 : 0;",
      replace:"    var lost = 5;",
      why:"at 0 points the message would still say −5" },
    { file:"index", via:"index", expect:"ahead mode no longer shows hint level 1",
      find:"    if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"    if (mode === 'ahead'){ hintLevel = 0; }",
      why:"ahead mode would lose its automatic first hint" },
    { file:"index", via:"index", expect:"not disabled after the second level",
      find:"    if (hintLevel >= 2) gHintBtn.disabled = true;\n",
      replace:"",
      why:"the hint button would keep counting past level 2" },
    { file:"index", via:"index", expect:"does not start a new board generation",
      find:"gSolved = false; gMistake = false; gCtx = {}; gGen++;",
      replace:"gSolved = false; gMistake = false; gCtx = {};",
      why:"pieces of the old board would stay live" },
    { file:"index", via:"index", expect:"does not really shuffle",
      find:"      var k = Math.floor(Math.random() * (j + 1));",
      replace:"      var k = j;",
      why:"the shuffle would leave every tray in order" },
    { file:"index", via:"index", expect:"stack drop zones: a drop at",
      find:"      if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"      if (!best){ bd = dd; bc = dc; best = b; }",
      why:"the first padded box in array order would win over the nearer one" },
    { file:"index", via:"index", expect:"measure to the box, not the centre",
      find:"      var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;",
      replace:"      var dd = dx * dx + dy * dy, dc = dd;",
      why:"a drop would go to the nearest centre, not the box it is in" },
    { file:"index", via:"index", expect:"skips it and lands in the next slot",
      find:"    return best && !best.done ? best : null;",
      replace:"    return best && !best.done ? best : (best ? list.filter(function(b){ return !b.done; })[0] || null : null);",
      why:"a drop on a filled box would slide into another box" },
    { file:"index", via:"index", expect:"grid line",
      find:"    for (var r = 0; r <= rows; r++) lines.push({ r:r, y:y1 - r * cellH });",
      replace:"    for (var r = 0; r <= rows; r++) lines.push({ r:r, y:y1 - r * cellH - 2 });",
      why:"the grid would float off the cells the bars are made of" },
    { file:"index", via:"index", expect:"does not top out on grid line",
      find:"  function gBarTop(ch, v){ return ch.y1 - v * ch.cellH; }",
      replace:"  function gBarTop(ch, v){ return ch.y1 - (v + 1) * ch.cellH; }",
      why:"every bar would end one line too high, so the picture would no longer determine the answer" },
    { file:"index", via:"index", expect:"GCH.gap is",
      find:"  var GCH = { x0:40, numDx:7, gap:0.3, itemDy:20 };",
      replace:"  var GCH = { x0:40, numDx:7, gap:0.02, itemDy:20 };",
      why:"the bars would touch each other" },
    { file:"index", via:"index", expect:"is not inside its slot",
      find:"x:x0 + (i + 0.5) * slot - barW / 2, w:barW",
      replace:"x:x0 + (i + 0.5) * slot - barW / 3, w:barW",
      why:"the bars would sit off-centre in their columns" },
    { file:"index", via:"index", expect:"stackRefuse() says",
      find:"  function stackRefuse(vals, have, i){ return have[i] < vals[i] ? null",
      replace:"  function stackRefuse(vals, have, i){ return have[i] <= vals[i] ? null",
      why:"a bar could be stacked one cell taller than the table" },
    { file:"index", via:"index", expect:"the column judged is not the one dropped on",
      find:"why = stackRefuse(e.vals, have, i), name",
      replace:"why = stackRefuse(e.vals.map(function(){ return 9; }), have, i), name",
      why:"every column would take cells up to the top of the grid (codex r1 #1)" },
    { file:"index", via:"index", expect:"does not cover the table cell, the bar and the name",
      find:"    var top = GTBL.y, bot = ch.itemY + 8;",
      replace:"    var top = ch.y0, bot = ch.itemY + 8;",
      why:"dropping a cell on the table number (a natural target) would be refused" },
    { file:"index", via:"index", expect:"no pad, so the columns",
      find:"  var STACK = { rows:7, x1:292, y0:72, cellH:28, pad:6, blockY:330 }",
      replace:"  var STACK = { rows:7, x1:292, y0:72, cellH:28, pad:0, blockY:330 }",
      why:"a drop just outside a column would be refused and the nearest rule never runs" },
    { file:"index", via:"index", expect:"do not fit a 6-cell grid",
      find:"    { id:'pet',   keys:['dog', 'cat', 'fish', 'bird'],        vals:[4, 2, 6, 1] },",
      replace:"    { id:'pet',   keys:['dog', 'cat', 'fish', 'bird'],        vals:[4, 2, 7, 1] },",
      why:"a bar would reach the top of the grid (the round would also teach that the grid must be exactly that tall)" },
    { file:"index", via:"index", expect:"does not stay selected after a tap-then-tap placement",
      find:"        if (pt.tap){ B.selected = P; P.el.classList.add('sel'); }",
      replace:"        if (false){ B.selected = P; P.el.classList.add('sel'); }",
      why:"tap-then-tap would need two taps per cell" },
    { file:"index", via:"index", expect:"gStackZero (zh): numbers should read 0,0",
      find:"return '「' + name + '」表上寫 0 ' + unit + '：0 就是一格都不疊",
      replace:"return '「' + name + '」表上寫 1 ' + unit + '：0 就是一格都不疊",
      why:"the reason would misquote the table" },
    { file:"index", via:"index", expect:"the \"full\" reason never says",
      find:"表上寫 ' + v + ' ' + unit + '，已經疊到 ' + v + ' 格了 —— 再疊就太高了。'",
      replace:"表上寫 ' + v + ' ' + unit + '，已經疊到 ' + v + ' 格了 —— 再疊一格吧。'",
      why:"the reason would stop saying why the cell was refused" },
    { file:"index", via:"index", expect:"readRefuse() for card",
      find:"  function readRefuse(vals, i, x){ return x === vals[i] ? null",
      replace:"  function readRefuse(vals, i, x){ return x >= vals[i] ? null",
      why:"a card bigger than the bar would be accepted" },
    { file:"index", via:"index", expect:"a wrong card is accepted",
      find:"x = P.data.v, name = d.item[e.keys[i]], why = readRefuse(e.vals, i, x);",
      replace:"x = v, name = d.item[e.keys[i]], why = readRefuse(e.vals, i, x);",
      why:"every card would be judged as if it were the right one (codex r1 #2)" },
    { file:"index", via:"index", expect:"readWhy(",
      find:"  function readWhy(v, x){ return v === 0 ? 'zero' : x === v + 1 ? 'line' :",
      replace:"  function readWhy(v, x){ return v === 0 ? 'zero' : x === v - 1 ? 'line' :",
      why:"the counted-the-lines reason would be given for the wrong card" },
    { file:"index", via:"index", expect:"can be filled again through its bar",
      find:"        slots[i].done = cols[i].done = true;",
      replace:"        slots[i].done = true;",
      why:"a filled item could be filled again by dropping on its bar" },
    { file:"index", via:"index", expect:"the bars themselves are no longer drop targets",
      find:"      var targets = slots.concat(cols);",
      replace:"      var targets = slots;",
      why:"dropping a card on the bar it reads (a natural target) would be refused" },
    { file:"index", via:"index", expect:"does not cover the whole bar up to the top line",
      find:"    var top = ch.y0 - ch.cellH / 2, bot = ch.itemY + 8;",
      replace:"    var top = ch.y0 + ch.cellH, bot = ch.itemY + 8;",
      why:"dropping a card on the top of a tall bar would be refused" },
    { file:"index", via:"index", expect:"the \"high\" reason never says",
      find:"' 那麼高：它的頂端在 ' + x + ' 那一條線的下面。'",
      replace:"' 那麼高：它的頂端在 ' + x + ' 那一條線的上面。'",
      why:"the too-high reason would point the wrong way" },
    { file:"index", via:"index", expect:"read drop zones: only",
      find:"  var READ = { rows:8, x1:292, y0:14, cellH:24, slotY:266, slotW:52, slotH:48, pad:10,",
      replace:"  var READ = { rows:8, x1:292, y0:14, cellH:24, slotY:266, slotW:52, slotH:48, pad:0,",
      why:"a drop just outside a box would be refused" },
    { file:"index", via:"index", expect:"sits inside a drop zone",
      find:"keysY:[328, 384], keyStep:56 }",
      replace:"keysY:[298, 384], keyStep:56 }",
      why:"a digit card would start inside a box's drop zone" },
    { file:"index", via:"index", expect:"cutRefuse() at line",
      find:"  function cutRefuse(vals, k){ var need = gridRows(vals); return k === need ? null",
      replace:"  function cutRefuse(vals, k){ var need = gridRows(vals); return k >= need ? null",
      why:"a grid taller than needed would be accepted as the fewest" },
    { file:"index", via:"index", expect:"a cut other than the fewest-that-fit is accepted",
      find:"        var why = cutRefuse(e.vals, k);",
      replace:"        var why = cutRefuse(e.vals, need);",
      why:"Cut would always accept" },
    { file:"index", via:"index", expect:"the line judged (k) is not updated",
      find:"if (nk !== k && !gSolved){ k = nk; draw(); }",
      replace:"if (nk !== k && !gSolved){ draw(); }",
      why:"the ✂️ would move while Cut still judged the old line (codex r1 #4)" },
    { file:"index", via:"index", expect:"does not snap to the grid line it is nearest to",
      find:"snapY:function(y){ return gBarTop(ch, cutLevel(ch, y)); },",
      replace:"snapY:function(y){ return y; },",
      why:"the ✂️ would not sit on the line being judged" },
    { file:"index", via:"index", expect:"goes to line",
      find:"Math.round((ch.y1 - y) / ch.cellH)",
      replace:"Math.floor((ch.y1 - y) / ch.cellH)",
      why:"a tap just under a line would pick the line below" },
    { file:"index", via:"index", expect:"is not counted as a tap on the paper",
      find:"p.y >= ch.y0 - ch.cellH / 2 && p.y <= ch.y1 + ch.cellH / 2",
      replace:"p.y >= ch.y0 && p.y <= ch.y1",
      why:"a tap just above the top line or below line 0 would do nothing" },
    { file:"index", via:"index", expect:"reaches under it",
      find:"  function cutOnPaper(ch, p){ return p.x >= 0 && p.x <= ch.x1 && ",
      replace:"  function cutOnPaper(ch, p){ return p.x >= 0 && p.x <= ch.x1 + 6 && ",
      why:"the paper zone would reach under the ✂️" },
    { file:"index", via:"index", expect:"can judge while the ✂️ is still being dragged",
      find:"        if (scis.busy()) return;   /* 另一根手指還拖著 ✂️：還沒停好，不判、不扣分 */\n",
      replace:"",
      why:"Cut could judge a half-dragged ✂️" },
    { file:"index", via:"index", expect:"does not start at the top of the paper",
      find:"name = d.item[e.keys[top]], k = ch.rows;",
      replace:"name = d.item[e.keys[top]], k = need;",
      why:"the ✂️ would start on the answer" },
    { file:"index", via:"index", expect:"no longer follows the lesson rule \"still draw 1 cell\"",
      find:"var need = gridRows(vals); return k === need",
      replace:"var need = maxOf(vals); return k === need",
      why:"an all-0 table would be cut to 0 cells, against the lesson's own rule" },
    { file:"index", via:"index", expect:"leaves no \"too few\" and \"too many\"",
      find:"    { id:'fruit', keys:['apple', 'banana', 'grape', 'melon'], vals:[4, 6, 2, 3] },",
      replace:"    { id:'fruit', keys:['apple', 'banana', 'grape', 'melon'], vals:[4, 8, 2, 3] },",
      why:"the fewest cells would be one line under the top, so “too many” has only one place" },
    { file:"index", via:"index", expect:"gCutFew (zh): numbers should read",
      find:"return k + ' 格不夠：最多的是「'",
      replace:"return (k + 1) + ' 格不夠：最多的是「'",
      why:"the reason would misquote the cut" },
    { file:"index", via:"index", expect:"the \"more\" reason never says",
      find:"' 格畫得下，可是最上面會空著 —— 題目問的是格子「最少」要幾格。'",
      replace:"' 格畫得下，可是最上面會空著 —— 再剪低一點。'",
      why:"the too-many reason would stop naming “at least”" },
    { file:"index", via:"index", expect:"sortRefuse() for stretch",
      find:"  function sortRefuse(vals, s, b){ var want = segBin(vals, s); return b === want ? null : want; }",
      replace:"  function sortRefuse(vals, s, b){ var want = segBin(vals, s); return null; }",
      why:"any basket would take any card" },
    { file:"index", via:"index", expect:"the stretch or basket judged is not the one dropped",
      find:"bad = sortRefuse(e.vals, s, bin.i)",
      replace:"bad = sortRefuse(e.vals, s, segBin(e.vals, s))",
      why:"any basket would take any card (codex r1 #3)" },
    { file:"index", via:"index", expect:"already in basket order",
      find:"    if (sorted) t.reverse();",
      replace:"    t.sort(function(p, q){ return segBin(vals, p) - segBin(vals, q); });",
      why:"the tray would start already sorted" },
    { file:"index", via:"index", expect:"segBin() puts stretch",
      find:"  function segBin(vals, i){ return SEG_DIRS.indexOf(segDir(vals[i], vals[i + 1])); }",
      replace:"  function segBin(vals, i){ return SEG_DIRS.indexOf(segDir(vals[i + 1], vals[i])); }",
      why:"reading right to left (the misconception) would become the rule" },
    { file:"index", via:"index", expect:"does not say only",
      find:"'點變高了，是變多' : dir === 'down' ? '點變低了，是變少'",
      replace:"'點變高了，是變少' : dir === 'down' ? '點變低了，是變少'",
      why:"the reason would name the wrong direction" },
    { file:"index", via:"index", expect:"the padded baskets never overlap",
      find:"x:[2, 102, 202], first:240, step:30, pad:8 }",
      replace:"x:[2, 102, 202], first:240, step:30, pad:2 }",
      why:"a drop in the gap between baskets would be refused" },
    { file:"index", via:"index", expect:"no \"flat\" stretch",
      find:"vals:[3, 5, 5, 2, 4] },",
      replace:"vals:[3, 5, 6, 2, 4] },",
      why:"a week without a level stretch never needs the third basket" },
    { file:"index", via:"index", expect:"starts inside a basket's drop zone",
      find:"SEG_TRAY = { x:[76, 224], y:[378, 432] }",
      replace:"SEG_TRAY = { x:[76, 224], y:[352, 432] }",
      why:"a card would start inside a basket" },
    { file:"index", via:"index", expect:"the dots are not drawn at the tops of the bars",
      find:"cy:gBarTop(ch, e.vals[c.i]), r:DOT_R",
      replace:"cy:gBarTop(ch, e.vals[c.i]) - 4, r:DOT_R",
      why:"the dots would float above their values" },
    { file:"index", via:"index", expect:"twoWhy(",
      find:"    if (e.kind === 'total' && n === hi) return 'tall';\n",
      replace:"",
      why:"typing the tallest bar for “altogether” would get a generic reason" },
    { file:"index", via:"index", expect:"parseCount(\" 12 \")",
      find:"    s = String(s).trim();\n",
      replace:"",
      why:"a trailing space would make a right answer a reminder" },
    { file:"index", via:"index", expect:"parseCount(\"012\")",
      find:"/^(0|[1-9][0-9]{0,2})$/",
      replace:"/^([0-9]{1,3})$/",
      why:"a leading 0 would be read as a number" },
    { file:"index", via:"index", expect:"not just a reminder",
      find:"if (v === null){ roundNote(d.gTwoBadInput); return; }",
      replace:"if (v === null){ roundMiss(d.gTwoBadInput); return; }",
      why:"a mistyped number would cost 5 points" },
    { file:"index", via:"index", expect:"the least is 0",
      find:"{ kind:'gap',   id:'pet',   keys:['dog', 'cat', 'fish', 'bird'],        vals:[6, 2, 4, 7] }",
      replace:"{ kind:'gap',   id:'pet',   keys:['dog', 'cat', 'fish', 'bird'],        vals:[6, 0, 4, 7] }",
      why:"“only wrote the most” would also be the right answer" },
    { file:"index", via:"index", expect:"gTwoDoneTotal (zh): numbers should read",
      find:"return list.join(' ＋ ') + ' ＝ ' + s + '，一共 '",
      replace:"return list.join(' ＋ ') + ' ＝ ' + (s + 1) + '，一共 '",
      why:"the worked sum would be wrong" },
    { file:"index", via:"index", expect:"GAME gTwoDoneTotal:",
      find:"      gTwoDoneTotal:function(list, s, unit){ return list.join(' + ') + ' = ' + s +",
      replace:"      gTwoDoneTotal:function(list, s, unit){ return list.join(' × ') + ' = ' + s +",
      why:"the English worked sum would multiply (digits unchanged — only the arithmetic check sees it)" },
    { file:"index", via:"index", expect:"English plural after 1",
      find:"return name + ': ' + v + ' ' + plEn(v, 'cell') + ', so ' + v",
      replace:"return name + ': ' + v + ' cells, so ' + v",
      why:"“1 cells” would show for a bar of 1" },
    { file:"index", via:"index", expect:"must never say \"格子剛好要\"",
      find:"        cut:'最多的那一項是幾個，就至少要幾格。',",
      replace:"        cut:'格子剛好要和最多的那一項一樣多。',",
      why:"the hint would teach the grid size as an exact rule" },
    { file:"index", via:"index", expect:"the chart to work from is not",
      find:"      gBars(svg, ch, e.vals);\n      gItems(svg, ch, e.keys);\n      capLine(d.cap(d.dsName[e.id], unit));\n      var row = actionRow();",
      replace:"      gBars(svg, ch, [0, 0, 0, 0]);\n      gItems(svg, ch, e.keys);\n      capLine(d.cap(d.dsName[e.id], unit));\n      var row = actionRow();",
      why:"the child would be scored against bars that are not drawn (codex r1 #5)" },
    { file:"index", via:"index", expect:"the stretches are not drawn from one day",
      find:"y2:gBarTop(ch, e.vals[s + 1]),",
      replace:"y2:gBarTop(ch, e.vals[s]),",
      why:"every stretch would look level (codex r1 #6)" },
    { file:"index", via:"index", expect:"points on the paper are not a tap on the paper",
      find:"  function cutOnPaper(ch, p){ return p.x >= 0 && p.x <= ch.x1 && ",
      replace:"  function cutOnPaper(ch, p){ return p.x >= 0 && p.x <= ch.x1 && !(p.x > 100 && p.x < 110) && ",
      why:"a strip of the paper would ignore taps (codex r1 #7)" },
    { file:"index", via:"index", expect:"a held Enter key hands the same answer in",
      find:"if (ev.key === 'Enter' && !ev.repeat) submit();",
      replace:"if (ev.key === 'Enter') submit();",
      why:"every key repeat of a held Enter would hand the answer in again; only the lastBad guard would then stop the deduction — each of the two guards is pinned on its own (codex r2 #2)" },
    { file:"index", via:"index", expect:"handing in the same wrong answer again",
      find:"        if (v === lastBad) return;\n",
      replace:"",
      why:"a double tap on Hand in would cost 10" },
    { file:"index", via:"index", expect:"the table does not print the round",
      find:"'glbl gl-num', String(e.vals[c.i])",
      replace:"'glbl gl-num', String(e.vals[c.i] + 1)",
      why:"the table would not match the chart the child is asked to build" },
    { file:"index", via:"index", expect:"the grid lines and their numbers are not drawn from gChart()",
      find:"      t.textContent = String(L.r);",
      replace:"      t.textContent = String(L.r + 1);",
      why:"every axis number would be one too high" },
    { file:"index", via:"index", expect:"drawn cell by cell from the bottom line",
      find:"gRect(svg, c.x, ch.y1 - (r + 1) * ch.cellH, c.w, ch.cellH,",
      replace:"gRect(svg, c.x, ch.y1 - (r + 2) * ch.cellH, c.w, ch.cellH,",
      why:"the bars would float one cell off the axis" },
    /* --- 小遊戲 end --- */
    /* --- 字典（項目名／單位詞） --- */
    { file:"index", via:"index", expect:"the item dictionary",
      find:"        juice:'果汁', milk:'牛奶', soda:'汽水', tea:'紅茶',\n        red:'紅', blue:'藍', green:'綠', yellow:'黃',\n        mon:'週一', tue:'週二', wed:'週三', thu:'週四', fri:'週五'",
      replace:"        juice:'果汁', milk:'鮮奶', soda:'汽水', tea:'紅茶',\n        red:'紅', blue:'藍', green:'綠', yellow:'黃',\n        mon:'週一', tue:'週二', wed:'週三', thu:'週四', fri:'週五'",
      why:"an item name would drift away from the one the checker pins" },
    { file:"index", via:"index", expect:"the unit dictionary",
      find:"    zh:{ fruit:'個', pet:'隻', book:'本', drink:'杯', craft:'張', week:'本' },",
      replace:"    zh:{ fruit:'個', pet:'隻', book:'本', drink:'碗', craft:'張', week:'本' },",
      why:"drinks would be counted in bowls" },
    { file:"index", via:"index", expect:"the unit dictionary",
      find:"    en:{ fruit:'piece', pet:'pet', book:'book', drink:'cup', craft:'sheet', week:'book' }",
      replace:"    en:{ fruit:'piece', pet:'pet', book:'book', drink:'cups', craft:'sheet', week:'book' }",
      why:"the English unit would already be plural, so plEn would print “cupss”" },

    /* --- 題庫神諭 --- */
    { file:"index", via:"index", expect:"qs[0]",
      find:"        { stem:'一張長條圖<strong>一格代表 1 個</strong>。有一條長條疊了 <strong>7</strong> 格，那一項有幾個？',\n          opts:['8','6','7','70'], ans:2,",
      replace:"        { stem:'一張長條圖<strong>一格代表 1 個</strong>。有一條長條疊了 <strong>7</strong> 格，那一項有幾個？',\n          opts:['8','6','7','70'], ans:0,",
      why:"the scored answer would be the grid-line count instead of the cell count" },
    { file:"index", via:"index", expect:"qs[1]",
      find:"        { stem:'一張長條圖上，最多的那一項是 <strong>9</strong> 個。這張圖的格子<strong>最少</strong>要幾格？',\n          opts:['9','8','10','1'], ans:0,",
      replace:"        { stem:'一張長條圖上，最多的那一項是 <strong>9</strong> 個。這張圖的格子<strong>最少</strong>要幾格？',\n          opts:['9','8','10','1'], ans:2,",
      why:"“at least how many cells” would be scored on a taller grid than the fewest" },
    { file:"index", via:"index", expect:"qs[2]",
      find:"        { stem:'長條圖上，蘋果 <strong>6</strong> 格、西瓜 <strong>2</strong> 格。蘋果比西瓜多幾個？',\n          opts:['8','3','12','4'], ans:3,",
      replace:"        { stem:'長條圖上，蘋果 <strong>6</strong> 格、西瓜 <strong>2</strong> 格。蘋果比西瓜多幾個？',\n          opts:['8','3','12','4'], ans:0,",
      why:"the difference question would be scored as the sum" },
    { file:"index", via:"index", expect:"qs[4]",
      find:"        { stem:'長條圖上四項分別是 <strong>3、5、0、2</strong> 個。<strong>一共</strong>幾個？',\n          opts:['5','10','3','8'], ans:1,",
      replace:"        { stem:'長條圖上四項分別是 <strong>3、5、0、2</strong> 個。<strong>一共</strong>幾個？',\n          opts:['5','10','3','8'], ans:0,",
      why:"“altogether” would be scored as the tallest bar" },
    { file:"index", via:"index", expect:"stem does not match the pinned wording",
      find:"        { stem:'長條圖上，蘋果 <strong>6</strong> 格、西瓜 <strong>2</strong> 格。蘋果比西瓜多幾個？',",
      replace:"        { stem:'長條圖上，蘋果 <strong>6</strong> 格、西瓜 <strong>2</strong> 格。蘋果和西瓜一共幾個？',",
      why:"the stem would ask a different question from the one being scored" },
    { file:"index", via:"index", expect:"stem does not match the pinned wording",
      find:"        { stem:'一張長條圖上，最多的那一項是 <strong>9</strong> 個。這張圖的格子<strong>最少</strong>要幾格？',",
      replace:"        { stem:'一張長條圖上，最多的那一項是 <strong>9</strong> 個。這張圖的格子要幾格？',",
      why:"dropping “at least” makes 10 a defensible answer too" },
    { file:"index", via:"index", expect:"arithmetic is wrong",
      find:"          why:'一格代表 1 個，所以蘋果 6 個、西瓜 2 個。<strong>差幾格就是差幾個</strong>：6 － 2 ＝ 4 個。（答 8 是把兩條加起來，那回答的是「一共幾個」。）' },",
      replace:"          why:'一格代表 1 個，所以蘋果 6 個、西瓜 2 個。<strong>差幾格就是差幾個</strong>：6 － 2 ＝ 5 個。（答 8 是把兩條加起來，那回答的是「一共幾個」。）' },",
      why:"the worked equation in the explanation would be wrong" },
    { file:"index", via:"index", expect:"the answers of the zh bank",
      find:"        { stem:'文字題：長條圖上，故事 <strong>6</strong> 本、科學 <strong>4</strong> 本、漫畫 <strong>8</strong> 本、詩集 <strong>1</strong> 本。<strong>最多的比最少的多幾本？</strong>',\n          opts:['7','9','2','8'], ans:0,",
      replace:"        { stem:'文字題：長條圖上，故事 <strong>6</strong> 本、科學 <strong>4</strong> 本、漫畫 <strong>8</strong> 本、詩集 <strong>1</strong> 本。<strong>最多的比最少的多幾本？</strong>',\n          opts:['7','9','2','8'], ans:1,",
      why:"the two-step word problem would be scored as the sum" },
    { file:"index", via:"index", expect:"recomputing from the stem",
      find:"        { stem:'文字題：折線圖上這一週每天借出的書是 <strong>2、5、5、3、6</strong> 本。<strong>有幾段線是往下的？</strong>',",
      replace:"        { stem:'文字題：折線圖上這一週每天借出的書是 <strong>2、5、5、3、7</strong> 本。<strong>有幾段線是往下的？</strong>',",
      why:"the numbers in the stem would drift away from the ones the answer was computed on" },

    /* --- 跨頁釘樁 --- */
    { file:"index", via:"index", expect:"這一課的每一格永遠代表 1 個",
      find:"<strong>這一課的每一格永遠代表 1 個。</strong></p>\n\n  <!-- 模式選擇 -->",
      replace:"<strong>這一課的每一格代表 1 個。</strong></p>\n\n  <!-- 模式選擇 -->",
      why:"the premise would lose the word that makes it hold for the whole lesson" },
    { file:"index", via:"index", expect:"In this lesson one cell always means 1.",
      find:"<strong>In this lesson one cell always means 1.</strong>',\n      modeTitle:'How do you want to learn today?",
      replace:"<strong>In this lesson one cell means 1.</strong>',\n      modeTitle:'How do you want to learn today?",
      why:"pinning only the Chinese lets the English half of the premise drift" },
    { file:"reference", via:"index", expect:"格線永遠比格子多 1 條",
      find:"<strong>格線永遠比格子多 1 條</strong>。最安全的讀法是看長條<strong>頂端</strong>對到左邊哪一個數字。',",
      replace:"<strong>格線和格子一樣多</strong>。最安全的讀法是看長條<strong>頂端</strong>對到左邊哪一個數字。',",
      why:"the cheat sheet would teach the misconception it exists to fix" },
    { file:"reference", via:"index", expect:"最多的那一項是幾個，就至少要幾格",
      find:"      f2:'格子要夠高：<strong>最多的那一項是幾個，就至少要幾格</strong><span class=\"cond\">全部都是 0 的時候還是要畫 1 格；畫得比這個多可以，畫得比這個少一定不行</span>',",
      replace:"      f2:'格子要夠高：<strong>最多的那一項是幾個，就要幾格</strong><span class=\"cond\">全部都是 0 的時候還是要畫 1 格；畫得比這個多可以，畫得比這個少一定不行</span>',",
      why:"the drawing formula would stop being a lower bound" },
    { file:"parents", via:"index", expect:"統計圖工作室接訂單",
      find:"      readyBox:'精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲「統計圖工作室接訂單」有通關</strong>",
      replace:"      readyBox:'精熟標準：課程頁的<strong>試題答對 2/3 以上</strong>，而且<strong>小遊戲有通關</strong>",
      why:"the mastery bar would stop naming the game the child has to finish" },
    { file:"parents", via:"index", expect:"資料偵察隊",
      find:"      s1why:'💡 為什麼值得花時間：統計圖是「把數字變成長度」的第一步，之後所有的圖表閱讀都建立在它上面。五年級的<strong>「資料偵察隊」</strong>",
      replace:"      s1why:'💡 為什麼值得花時間：統計圖是「把數字變成長度」的第一步，之後所有的圖表閱讀都建立在它上面。<strong>下一課</strong>",
      why:"one of the four places the grade-5 boundary is stated would go missing" },
    { file:"index", via:"index", expect:"must never say \"比比看哪一段變化最大\"",
      find:"      s4note:'💬 <strong>每一個點的高度，讀法跟長條完全一樣</strong>",
      replace:"      s4note:'💬 這一課也要<strong>比比看哪一段變化最大</strong>。<strong>每一個點的高度，讀法跟長條完全一樣</strong>",
      why:"the lesson would take on grade 5’s steepness question" },
    { file:"reference", via:"index", expect:"這一課的每一格永遠代表 1 個",
      find:"<strong>這一課的每一格永遠代表 1 個。</strong></p>\n\n  <section>",
      replace:"<strong>這一課的每一格代表 1 個。</strong></p>\n\n  <section>",
      why:"the cheat sheet would stop stating the premise the same way as the lesson" },

    /* --- review.html 的產生器 --- */
    { file:"review", via:"review", expect:"is one of the other bars on the same chart",
      find:"          var others = vals.filter(function(x, i){ return i !== at; });\n          var opts = numOpts(v, [v + 1, v - 1, v + 2], others);\n          if (!opts) return null;\n          return { sceneId:scene.id, keys:scene.keys.slice(), vals:vals, at:at, v:v,\n                   opts:opts, ans:opts.indexOf(v) };\n        });\n      },\n      fmt:function(d, lang){\n        var t = TXT[lang], names = namesOf(d.keys, lang), unit = t.unit[d.sceneId];\n        return {\n          stem: lang === 'zh'\n            ? '看這張長條圖：<strong>' + names[d.at] + '</strong> 有幾' + unit + '？'",
      replace:"          var others = vals.filter(function(x, i){ return i !== at; });\n          var opts = numOpts(v, [v + 1, v - 1, v + 2], []);\n          if (!opts) return null;\n          return { sceneId:scene.id, keys:scene.keys.slice(), vals:vals, at:at, v:v,\n                   opts:opts, ans:opts.indexOf(v) };\n        });\n      },\n      fmt:function(d, lang){\n        var t = TXT[lang], names = namesOf(d.keys, lang), unit = t.unit[d.sceneId];\n        return {\n          stem: lang === 'zh'\n            ? '看這張長條圖：<strong>' + names[d.at] + '</strong> 有幾' + unit + '？'",
      why:"a distractor could be another bar’s real height, so reading the wrong bar correctly is marked wrong" },
    { file:"review", via:"review", expect:"the item with the most is not unique",
      find:"          var hi = soleMaxIndex(vals);\n          if (hi < 0) return null;\n          var order = shuffle(scene.keys.slice());\n          return { sceneId:scene.id, keys:scene.keys.slice(), vals:vals, hi:hi,",
      replace:"          var hi = vals.indexOf(maxOf(vals));\n          if (hi < 0) return null;\n          var order = shuffle(scene.keys.slice());\n          return { sceneId:scene.id, keys:scene.keys.slice(), vals:vals, hi:hi,",
      why:"a tie for the tallest bar would still be asked as if it had one answer" },
    { file:"review", via:"review", expect:"the item with the least is not unique",
      find:"          var lo = soleMinIndex(vals);\n          if (lo < 0) return null;",
      replace:"          var lo = vals.indexOf(minOf(vals));\n          if (lo < 0) return null;",
      why:"a tie for the shortest bar would still be asked as if it had one answer" },
    { file:"review", via:"review", expect:"the difference is",
      find:"          var diff = vals[hi] - vals[lo];\n          if (diff < 2) return null;",
      replace:"          var diff = vals[hi] - vals[lo] + 1;\n          if (diff < 2) return null;",
      why:"the “how many more” generator would compute the sum" },
    { file:"review", via:"review", expect:"the total is",
      find:"          var total = sumOf(vals);\n          if (total < 6) return null;",
      replace:"          var total = sumOf(vals) - 1;\n          if (total < 6) return null;",
      why:"the total would be one short of the bars actually drawn" },
    { file:"review", via:"review", expect:"the \"only the tallest bar\" distractor is missing",
      find:"          var opts = numOpts(total, [vals[hi], missOne, total + 1], []);\n          if (!opts) return null;\n          if (opts.indexOf(vals[hi]) < 0) return null;",
      replace:"          var opts = numOpts(total, [total + 2, missOne, total + 1], []);\n          if (!opts) return null;",
      why:"the misconception the question exists to test would never be offered" },
    { file:"review", via:"review", expect:"the grid height is",
      find:"          var need = gridRows(vals);\n          if (need < 3) return null;\n          if (soleMaxIndex(vals) < 0) return null;",
      replace:"          var need = gridRows(vals.slice(1));\n          if (need < 3) return null;\n          if (soleMaxIndex(vals) < 0) return null;",
      why:"the answer would be one cell more than the fewest that fit" },
    { file:"review", via:"review", expect:"both the too-small and the more-than-enough",
      find:"          if (opts.indexOf(need - 1) < 0 || opts.indexOf(need + 1) < 0) return null;",
      replace:"          if (opts.indexOf(need - 1) < 0) return null;",
      why:"“more than enough is not the fewest” would stop being offered as a distractor" },
    { file:"review", via:"review", expect:"the grid-line distractor",
      find:"          var opts = numOpts(v, [v + 1, v + 2, v + 3, v + 4], vals.filter(function(x){ return x !== v; }).concat([1]));\n          if (!opts) return null;\n          if (opts.indexOf(v + 1) < 0) return null;",
      replace:"          var opts = numOpts(v, [v + 2, v + 3, v + 4, v + 5], vals.filter(function(x){ return x !== v; }).concat([1]));\n          if (!opts) return null;",
      why:"the headline misconception (counting lines) would never be offered" },
    { file:"review", via:"review", expect:"the 0 item is not the only smallest",
      find:"          vals[at] = 0;\n          if (soleMinIndex(vals) !== at) return null;",
      replace:"          vals[at] = 0;\n          vals[(at + 1) % vals.length] = 0;\n          if (soleMinIndex(vals) === -2) return null;",
      why:"two items could both be 0, so “which one has no cells” stops being one answer" },
    { file:"review", via:"review", expect:"the item asked about is not 0",
      find:"          var at = rand(vals.length);\n          vals[at] = 0;\n          if (soleMinIndex(vals) !== at) return null;",
      replace:"          var at = rand(vals.length);\n          vals[(at + 1) % vals.length] = 0;\n          if (soleMinIndex(vals) === -2) return null;",
      why:"the sentence question would be asked about a bar that is not actually 0" },
    { file:"review", via:"review", expect:"the direction is",
      find:"          var dir = segDir(vals[at], vals[at + 1]), delta = segDelta(vals[at], vals[at + 1]);",
      replace:"          var dir = segDir(vals[at + 1], vals[at]), delta = segDelta(vals[at], vals[at + 1]);",
      why:"the stretch would be read right to left instead of left to right" },
    { file:"review", via:"review", expect:"at least one item must sit exactly on the threshold",
      find:"          if (withEq === n) return null;\n          if (n < 1 || n >= vals.length) return null;",
      replace:"          if (n < 1 || n >= vals.length) return null;",
      why:"“exactly k does not count” would be untested whenever nothing equals k" },
    { file:"review", via:"review", expect:"the \"count k as well\" distractor is missing",
      find:"          if (opts.indexOf(withEq) < 0) return null;\n          return { sceneId:scene.id, keys:scene.keys.slice(), vals:vals, k:k, n:n, withEq:withEq,",
      replace:"          return { sceneId:scene.id, keys:scene.keys.slice(), vals:vals, k:k, n:n, withEq:withEq,",
      why:"the misconception this generator exists to test would never be offered" },
    { file:"review", via:"review", expect:"a level stretch is required",
      find:"          if (flat < 1 || n < 1) return null;",
      replace:"          if (n < 1) return null;",
      why:"“a level stretch does not count” would be untested whenever the line never levels off" },
    { file:"review", via:"review", expect:"the \"count the level ones too\" distractor is missing",
      find:"          var opts = numOpts(n, [n + flat, n + 1, n - 1, segs], []);\n          if (!opts) return null;\n          if (opts.indexOf(n + flat) < 0) return null;",
      replace:"          var opts = numOpts(n, [segs + 2, segs + 3, segs + 4, segs + 5], []);\n          if (!opts) return null;",
      why:"the misconception this generator exists to test would never be offered" },

    /* --- review.html 的圖與版面 --- */
    { file:"review", via:"review", expect:"does not top out on grid line",
      find:"                  y:b.y1 - vals[i] * cellH, h:vals[i] * cellH });",
      replace:"                  y:b.y1 - vals[i] * cellH - 3, h:vals[i] * cellH });",
      why:"every generated bar would sit three pixels above its own grid line" },
    { file:"review", via:"review", expect:"barW is",
      find:"    var barW = slot * (1 - GAP_RATIO);",
      replace:"    var barW = slot;",
      why:"the bars would touch each other, so a child cannot tell where one ends" },
    { file:"review", via:"review", expect:"box.y1 is",
      find:"  var FIG_W = 400, FIG_H = 230;",
      replace:"  var FIG_W = 400, FIG_H = 210;",
      why:"the generated canvas would shrink without the layout following" },
    { file:"review", via:"index", expect:"review.html no longer uses the pinned layout constants",
      find:"  var AXIS_NUM_DX = 8, AXIS_NUM_FS = 11, ITEM_FS = 13, ITEM_DY = 18, DOT_R = 4;",
      replace:"  var AXIS_NUM_DX = 8, AXIS_NUM_FS = 11, ITEM_FS = 26, ITEM_DY = 18, DOT_R = 4;",
      why:"the item names would grow until neighbouring labels overlap" },
    { file:"review", via:"review", expect:"is not on the top of its bar",
      find:"    p.pts = p.bars.map(function(bar){ return { i:bar.i, v:bar.v, cx:bar.cx, cy:bar.y }; });",
      replace:"    p.pts = p.bars.map(function(bar){ return { i:bar.i, v:bar.v, cx:bar.cx, cy:bar.y + 5 }; });",
      why:"the generated dots would float off the tops of their bars" },
    { file:"review", via:"review", expect:"rendered without a figure",
      find:"          fig: figOf('bar', d.vals, names),\n          cap: t.cap(t.scene[d.sceneId], unit),\n          opts: d.opts.map(String), ans:d.ans,\n          why: lang === 'zh'\n            ? names[d.at] + ' 的長條疊到第 ' + d.v + ' 條格線",
      replace:"          cap: t.cap(t.scene[d.sceneId], unit),\n          opts: d.opts.map(String), ans:d.ans,\n          why: lang === 'zh'\n            ? names[d.at] + ' 的長條疊到第 ' + d.v + ' 條格線",
      why:"a question about a chart would be asked with no chart drawn" },
    { file:"review", via:"review", expect:"the figure is drawn from different numbers",
      find:"  function figOf(kind, vals, names){\n    var plan = (kind === 'line') ? linePlan(vals, gridRows(vals)) : chartPlan(vals, gridRows(vals));",
      replace:"  function figOf(kind, vals, names){\n    vals = vals.map(function(v, i){ return i === 0 ? Math.max(0, v - 1) : v; });\n    var plan = (kind === 'line') ? linePlan(vals, gridRows(vals)) : chartPlan(vals, gridRows(vals));",
      why:"the first bar would be drawn one cell shorter than the number being scored" },
    { file:"review", via:"review", expect:"the caption does not match the pinned wording word for word",
      find:"      cap:function(name, unit){ return '📊 ' + name + '　一格代表 1 ' + unit; },\n      capLine:function(name, unit){ return '📈 ' + name + '　一格代表 1 ' + unit; },\n      listOf:function(a){ return a.join('、'); },",
      replace:"      cap:function(name, unit){ return '📊 ' + name + '　' + unit; },\n      capLine:function(name, unit){ return '📈 ' + name + '　' + unit; },\n      listOf:function(a){ return a.join('、'); },",
      why:"the chart would stop telling the reader what one cell represents" },
    { file:"review", via:"review", expect:"stem says",
      find:"            ? '看這張長條圖：<strong>一共</strong>幾' + unit + '？'",
      replace:"            ? '看這張長條圖：<strong>最多的那一項</strong>是幾' + unit + '？'",
      why:"the stem would ask which item has the most while the total is still scored" },
    { file:"review", via:"review", expect:"the rendered stem prints the numbers",
      find:"            ? '看這張長條圖：有幾項<strong>比 ' + d.k + ' ' + unit + '多</strong>？'",
      replace:"            ? '看這張長條圖：有幾項<strong>比 ' + (d.k + 1) + ' ' + unit + '多</strong>？'",
      why:"the stem would print a different threshold from the one being scored" },
    { file:"review", via:"review", expect:"arithmetic is wrong",
      find:"            ? '「一共」要把每一條都加起來，不是只看最高的那一條：' + d.vals.join(' ＋ ') + ' ＝ ' + d.total + '。（只看最高的會答 ' + d.vals[d.hi] + '，那回答的是<strong>最多的那一項</strong>是幾' + unit + '。）'",
      replace:"            ? '「一共」要把每一條都加起來，不是只看最高的那一條：' + d.vals.join(' ＋ ') + ' ＝ ' + (d.total + 1) + '。（只看最高的會答 ' + d.vals[d.hi] + '，那回答的是<strong>最多的那一項</strong>是幾' + unit + '。）'",
      why:"the worked sum in the explanation would not add up" },
    { file:"review", via:"review", expect:"the item name dictionary",
      find:"        run:'跑步', jump:'跳繩', swim:'游泳', ball:'球類',",
      replace:"        run:'慢跑', jump:'跳繩', swim:'游泳', ball:'球類',",
      why:"a generated item name would drift away from the one the checker pins" },
    { file:"review", via:"review", expect:"the rendered stem does not match the pinned wording word for word",
      find:"        craft:'張', sport:'人', week:'本', month:'次'",
      replace:"        craft:'張', sport:'位', week:'本', month:'次'",
      why:"a generated unit word would drift away from the one the checker pins" },
    { file:"review", via:"review", expect:"is outside 0..9",
      find:"  var VAL_MAX = 9;",
      replace:"  var VAL_MAX = 40;",
      why:"the charts would need forty grid lines, far past what a child can read" },
    { file:"review", via:"review", expect:"English plural after 1",
      find:"  function plEn(n, w){ return n === 1 ? w : w + 's'; }\n\n  /* --- 版面常數。和課程頁同一套規格",
      replace:"  function plEn(n, w){ return w + 's'; }\n\n  /* --- 版面常數。和課程頁同一套規格",
      why:"English would print “1 cells” and “1 books” everywhere a value is 1" },
    { file:"review", via:"review", expect:"irregular English plural after 1",
      find:"    if (unit === 'child') return n === 1 ? 'child' : 'children';",
      replace:"    if (unit === 'child') return 'children';",
      why:"English would print “1 children” whenever a sports bar is 1" },
    { file:"review", via:"review", expect:"missing space between Chinese and a digit",
      find:"        return names.map(function(n, i){ return n + ' ' + vals[i] + ' ' + unit; }).join('、');",
      replace:"        return names.map(function(n, i){ return n + vals[i] + ' ' + unit; }).join('、');",
      why:"the table in the stem would glue the item name to its number" },
    { file:"review", via:"review", expect:"review.html declares generators",
      find:"    /* 12. 折線圖有幾段往上／往下（兩步驟，而且持平不算）。 */\n    { id:'countSeg', cat:'line',",
      replace:"    /* 12. 折線圖有幾段往上／往下（兩步驟，而且持平不算）。 */\n    { id:'countSegments', cat:'line',",
      via:"index",
      why:"a generator would disappear from the roster and its whole assertion set with it" },
    /* ⚠️ 「make() 回 null」**故意沒有**改壞測試：simgen 在 INVARIANTS 之後仍然會呼叫
       fmt(d, lang)，d 是 null 就直接 TypeError，整批輸出連一行 [FAIL] 都沒有 ——
       當掉不算抓到，也不算通過。每一條 invariant 開頭的 `if (!d)` 留著當防線，
       但它證明不了，所以這裡不放一筆假的證明。 */
    { file:"review", via:"index", expect:"the .chartfig CSS size in review.html",
      find:"  .chartfig{width:100%;max-width:400px;height:230px;display:block;margin:0 auto}",
      replace:"  .chartfig{width:100%;max-width:400px;height:250px;display:block;margin:0 auto}",
      why:"the CSS height would stop matching the viewBox, squashing every generated chart" },
    { file:"index", via:"index", expect:"is not a finite number",
      find:"      return { i:bar.i, v:bar.v, cx:bar.cx, cy:bar.y };",
      replace:"      return { i:bar.i, v:bar.v, cx:bar.cx, cy:bar.y * Number('x') };",
      why:"the dots would carry NaN coordinates, and every geometry comparison would silently pass" },
    { file:"index", via:"index", expect:"has an English plural after 1",
      find:"      s3rowsMore:function(rows, need){\n        return '⭕ ' + rows + ' ' + plEn(rows, 'cell') + ' <strong>does fit</strong>",
      replace:"      s3rowsMore:function(rows, need){\n        return '⭕ 1 is not enough. 1 cells. ' + rows + ' ' + plEn(rows, 'cell') + ' <strong>does fit</strong>",
      why:"a whitelisted \"1 is\" earlier in the sentence would hide a real \"1 cells\" later in it" },
    { file:"index", via:"index", expect:"(en) stem does not match",
      find:"        { stem:'On a bar chart Apple is <strong>6</strong> cells and Melon is <strong>2</strong> cells. How many more apples are there than melons?',",
      replace:"        { stem:'On a bar chart Apple is <strong>6</strong> cells and Melon is <strong>2</strong> cells. How many are there altogether?',",
      why:"the English half of a question could ask a different operation while keeping the pinned answer" },
    { file:"review", via:"review", expect:"does not match the pinned wording word for word",
      find:"            ? '看這張長條圖：<strong>' + names[d.at] + '</strong> 有幾' + unit + '？'",
      replace:"            ? '看這張長條圖：<strong>' + names[(d.at + 1) % names.length] + '</strong> 有幾' + unit + '？'",
      why:"the stem would name one bar while the scored answer is read off another" },
    { file:"review", via:"review", expect:"hasAddTrap says",
      find:"          var hasAddTrap = (addTrap !== diff);",
      replace:"          var hasAddTrap = true;",
      why:"the generator would claim an \"added them instead\" distractor on the very draws where addition and subtraction give the same answer" },
    { file:"review", via:"review", expect:"does not carry the unit that says what is being counted",
      find:"          opts: d.opts.map(function(v){ return lang === 'zh' ? v + ' 項' : v + ' ' + plEn(v, 'item'); }), ans:d.ans,",
      replace:"          opts: d.opts.map(String), ans:d.ans,",
      why:"a bare number cannot be told apart from a value readable off the chart" },
    { file:"review", via:"review", expect:"does not carry the unit that says what is being counted",
      find:"          opts: d.opts.map(function(v){ return lang === 'zh' ? v + ' 段' : v + ' ' + plEn(v, 'stretch').replace('stretchs', 'stretches'); }), ans:d.ans,",
      replace:"          opts: d.opts.map(String), ans:d.ans,",
      why:"a bare number cannot be told apart from a value readable off the graph" },
    { file:"review", via:"review", expect:"does not match the pinned wording word for word",
      find:"            ? '看這張折線圖：從 <strong>' + names[d.at] + '</strong> 到 <strong>' + names[d.at + 1] + '</strong> 這一段線，是怎麼變的？'",
      replace:"            ? '看這張折線圖：從 <strong>' + names[d.at + 1] + '</strong> 到 <strong>' + names[d.at] + '</strong> 這一段線，是怎麼變的？'",
      why:"the two ends of the stretch would be named in the wrong order, turning \"up\" into \"down\" while direction, options and answer all stay put" },
    { file:"review", via:"review", expect:"does not match the pinned wording word for word",
      find:" 的長條圖，<strong>' + names[d.at] + '</strong> 那一條要疊幾格？'",
      replace:" 的長條圖，<strong>' + names[(d.at + 1) % names.length] + '</strong> 那一條要疊幾格？'",
      why:"the table stem lists every item, so naming the wrong one is invisible unless the question clause itself is pinned" },
    { file:"review", via:"review", expect:"is missing from the options",
      find:"          var lo = soleMinIndex(vals);\n          if (lo < 0) return null;\n          var order = shuffle(scene.keys.slice());",
      replace:"          var lo = soleMinIndex(vals);\n          if (lo < 0) return null;\n          var order = shuffle(scene.keys.map(function(k, i){ return i === (lo + 1) % scene.keys.length ? 'mon' : k; }));",
      why:"an item name from a different scene would still be four distinct dictionary names, so only checking the count would pass it" },
    { file:"review", via:"review", expect:"a distractor also says",
      find:"          forgot:name + '一定是忘了畫，應該把它補上去',",
      replace:"          forgot:name + '一定是忘了畫，長條的高度就是 0 格',",
      why:"two options would both be right, and only a keyword pinned to the answer can tell" },
    { file:"review", via:"review", expect:"the caption does not match the pinned wording word for word",
      find:"      cap:function(name, unit){ return '📊 ' + name + '　一格代表 1 ' + unit; },\n      capLine:function(name, unit){ return '📈 ' + name + '　一格代表 1 ' + unit; },\n      listOf:function(a){ return a.join('、'); },",
      replace:"      cap:function(name, unit){ return '📊 ' + unit + ' ' + name + '　一格代表 1 格'; },\n      capLine:function(name, unit){ return '📈 ' + unit + ' ' + name + '　一格代表 1 格'; },\n      listOf:function(a){ return a.join('、'); },",
      why:"the unit would appear in the title while the scale line names something else" },
    { file:"review", via:"review", expect:"an equals sign with nothing on one side",
      find:"' 條格線，也就是 ' + d.v + ' 格。一格代表 1 ' + unit + '，所以 ' + d.v + ' × 1 ＝ ' + d.v + ' ' + unit + '。'",
      replace:"' 條格線，也就是 ' + d.v + ' 格。一格代表 1 ' + unit + '，所以 ' + d.v + ' × 1 ＝＝ ' + d.v + ' ' + unit + '。'",
      why:"a doubled equals sign would be read as two equal sides and endorsed" },
    { file:"review", via:"review", expect:"an equals sign was trimmed away",
      find:"' 條格線，也就是 ' + d.v + ' 格。一格代表 1 ' + unit + '，所以 ' + d.v + ' × 1 ＝ ' + d.v + ' ' + unit + '。'",
      replace:"' 條格線，也就是 ' + d.v + ' 格。一格代表 1 ' + unit + '，所以 ' + d.v + ' × 1 ＝ ' + d.v + ' ' + unit + ' ＝。'",
      why:"a dangling equals sign would be trimmed off and the claim would vanish instead of failing" },
    { file:"review", via:"review", expect:"thousands separator",
      find:"' 條格線，也就是 ' + d.v + ' 格。一格代表 1 ' + unit + '，所以 ' + d.v + ' × 1 ＝ ' + d.v + ' ' + unit + '。'",
      replace:"' 條格線，也就是 ' + d.v + ' 格。一格代表 1 ' + unit + '，所以 ' + d.v + ' × 1 ＝ ' + d.v + ' ' + unit + '（1,000 ＝ 0）。'",
      why:"a comma would split the number and the verifier would check a different equation" },
    { file:"review", via:"review", expect:"arithmetic is wrong",
      find:"' 條格線，也就是 ' + d.v + ' 格。一格代表 1 ' + unit + '，所以 ' + d.v + ' × 1 ＝ ' + d.v + ' ' + unit + '。'",
      replace:"' 條格線，也就是 ' + d.v + ' 格。一格代表 1 ' + unit + '，所以 ' + d.v + ' × 1 ＝ ' + d.v + ' ' + unit + '（１ ＋ １ ＝ ３）。'",
      why:"a fullwidth-digit equation would register no equals sign at all and slip past unverified" },
    { file:"review", via:"review", expect:"has an English plural after 1",
      find:"            : 'The ' + names[d.at] + ' bar reaches grid line ' + d.v",
      replace:"            : '1 Books. The ' + names[d.at] + ' bar reaches grid line ' + d.v",
      why:"a capitalised plural after 1 would slip past a case-sensitive scanner" },
    { file:"review", via:"review", expect:"shows a negative number",
      find:"            : 'A dot reads exactly like a bar, because it is the top of the bar: the '",
      replace:"            : 'A drop of － 3 is impossible here. A dot reads exactly like a bar, because it is the top of the bar: the '",
      why:"a minus sign separated from its digit by a space would still be a negative number" },
    { file:"index", via:"index", expect:"(en) stem does not match",
      find:"        { stem:'Someone has <strong>finished</strong> drawing a bar chart from a table. One item has <strong>no cells at all</strong>. What does that mean?',",
      replace:"        { stem:'Someone has <strong>not finished</strong> drawing a bar chart from a table. One item has <strong>no cells at all</strong>. What does that mean?',",
      why:"negating the completed-chart premise is exactly the regression the pin exists to stop, and two independent substrings would not catch it" },
    { file:"index", via:"index", expect:"(en) stem does not match the pinned wording",
      find:"        { stem:'The four bars on a chart are <strong>3, 5, 0, 2</strong>. How many are there <strong>altogether</strong>?',",
      replace:"        { stem:'It is false that the four bars on a chart are <strong>3, 5, 0, 2</strong>. How many are there <strong>altogether</strong>?',",
      why:"a premise reversed by extra words in front would satisfy every keyword pin, so the English stem has to be pinned word for word" },
    { file:"review", via:"review", expect:"does not match the pinned wording word for word",
      find:"            ? '看這張長條圖：<strong>' + names[d.at] + '</strong> 有幾' + unit + '？'",
      replace:"            ? '看這張長條圖：<strong>' + names[d.at] + '</strong> 有幾' + unit + '？<strong>' + names[d.at] + '</strong> 有幾' + unit + '？'",
      why:"a second copy of the question clause would leave it ambiguous which one is being asked" },
    { file:"review", via:"review", expect:"does not match the pinned wording word for word",
      find:"            ? '看這張折線圖：<strong>' + names[d.at] + '</strong> 那一個點是幾' + unit + '？'",
      replace:"            ? '看這張折線圖：<strong>' + names[d.at] + '</strong> 那一個點是幾' + unit + '？（不是 ' + names[(d.at + 1) % names.length] + '）'",
      why:"naming a second item after the pinned clause would leave which dot is meant ambiguous" },
    { file:"review", via:"review", expect:"does not match the pinned wording word for word",
      find:"        return names.map(function(n, i){ return n + ' ' + vals[i] + ' ' + unitPl(vals[i], unit, 'en'); }).join(', ');",
      replace:"        return names.map(function(n, i){ return n + ' ' + vals[i] + ' ' + plEn(vals[i], unit); }).join(', ');",
      why:"the table in the stem would print \"6 childs\" — an irregular plural only a word-for-word stem pin catches" },
    { file:"review", via:"review", expect:"does not match the pinned wording word for word",
      find:"            ? '看這張長條圖：<strong>哪一項最多</strong>？'",
      replace:"            ? '看這張長條圖：<strong>哪一項最多</strong>？（其實要看總數）'",
      why:"a clause appended after the pinned question would reverse what is being asked while every substring assertion stayed green" },
    { file:"review", via:"review", expect:"the caption does not match the pinned wording word for word",
      find:"        craft:'美勞課用掉的色紙', sport:'班上同學最喜歡的運動',",
      replace:"        craft:'美勞課用掉的色紙', sport:'班上同學最愛的運動',",
      why:"a scenario name would drift away from the one the checker pins, and only a word-for-word caption catches it" },
    { file:"review", via:"review", expect:"the caption does not match the pinned wording word for word",
      find:"      cap:function(name, unit){ return '📊 ' + name + '　一格代表 1 ' + unit; },",
      replace:"      cap:function(name, unit){ return '📊 ' + name + '　一格代表 2 ' + unit + '　一格代表 1 ' + unit; },",
      why:"a second, contradictory scale in front of the canonical one satisfied every substring and counting check" },
    { file:"review", via:"review", expect:"the caption does not match the pinned wording word for word",
      find:"      capLine:function(name, unit){ return '📈 ' + name + '　一格代表 1 ' + unit; },",
      replace:"      capLine:function(name, unit){ return '📈 ' + name + '　一格代表 1 格　一格代表 1 ' + unit; },",
      why:"two scale statements in one caption would contradict each other while the ending still matched" },
    { file:"review", via:"review", expect:"the caption does not match the pinned wording word for word",
      find:"      cap:function(name, unit){ return '📊 ' + name + '　One cell means 1 ' + unit; },",
      replace:"      cap:function(name, unit){ return '📊 ' + name + '　One cell means 1 ' + unit + 'case'; },",
      why:"a longer word starting with the unit would satisfy a prefix match but names something else" },
    { file:"review", via:"review", expect:"arithmetic is wrong",
      find:"(d.dir === 'flat' ? 'Both dots are the same height (' + d.vals[d.at] + ' = ' + d.vals[d.at + 1] + '), so nothing changed.'",
      replace:"(d.dir === 'flat' ? 'Both dots are the same height ((' + d.vals[d.at] + ') = (' + (d.vals[d.at + 1] + 1) + ')), so nothing changed.'",
      why:"an equation wrapped in brackets on both sides would be dropped instead of verified" }
  ],

  /* ================= review.html 產生器模擬 ================= */
  sim: {
    INVARIANTS: {
      readBar: d => {
        if (!d) return 'readBar: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (!(d.at >= 0 && d.at < d.vals.length)) return 'readBar: at=' + d.at + ' is not one of the bars';
        if (d.v !== d.vals[d.at]) return 'readBar: v=' + d.v + ' is not the value of bar ' + d.at;
        for (const v of d.vals) if (!(Number.isInteger(v) && v >= 0 && v <= VAL_MAX_REF))
          return 'readBar: ' + v + ' is outside 0..' + VAL_MAX_REF;
        if (rowsRef(d.vals) < 3) return 'readBar: a grid of ' + rowsRef(d.vals) + ' cells is too short to read anything off';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'readBar: options are not four distinct numbers';
        if (d.opts[d.ans] !== d.v) return 'readBar: opts[ans] is not the height of the bar being asked about';
        for (const o of d.opts) if (o !== d.v && d.vals.indexOf(o) >= 0)
          return 'readBar: distractor ' + o + ' is one of the other bars on the same chart, so reading a different bar correctly is marked wrong';
      },
      mostBar: d => {
        if (!d) return 'mostBar: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const hi = soleMaxRef(d.vals);
        if (hi < 0) return 'mostBar: the item with the most is not unique, so the question has more than one answer';
        if (hi !== d.hi) return 'mostBar: hi=' + d.hi + ' but the reference says ' + hi;
        if (rowsRef(d.vals) < 3) return 'mostBar: the grid is too short to compare bars';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'mostBar: options are not the four item keys';
        for (const k of d.keys) if (d.opts.indexOf(k) < 0) return 'mostBar: item ' + k + ' is missing from the options';
        if (d.opts[d.ans] !== d.keys[hi]) return 'mostBar: opts[ans] is not the tallest bar';
      },
      leastBar: d => {
        if (!d) return 'leastBar: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const lo = soleMinRef(d.vals);
        if (lo < 0) return 'leastBar: the item with the least is not unique, so the question has more than one answer';
        if (lo !== d.lo) return 'leastBar: lo=' + d.lo + ' but the reference says ' + lo;
        if (rowsRef(d.vals) < 3) return 'leastBar: the grid is too short to compare bars';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'leastBar: options are not the four item keys';
        /* ⚠️ 只數個數的話，把別的情境的項目名混進來也是四個不重複的合法名字
           （optionOk 只認「字典裡有這個名字」）—— 訊息說的是「這四個」，就要真的驗這四個。 */
        for (const k of d.keys) if (d.opts.indexOf(k) < 0) return 'leastBar: item ' + k + ' is missing from the options';
        if (d.opts[d.ans] !== d.keys[lo]) return 'leastBar: opts[ans] is not the shortest bar';
      },
      diffBars: d => {
        if (!d) return 'diffBars: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const hi = soleMaxRef(d.vals), lo = soleMinRef(d.vals);
        if (hi < 0 || lo < 0) return 'diffBars: the most or the least is not unique';
        const want = d.vals[hi] - d.vals[lo];
        if (d.diff !== want) return 'diffBars: the difference is ' + d.diff + ' but the reference gives ' + want;
        if (!(d.diff >= 2)) return 'diffBars: a difference of ' + d.diff + ' is too small for the subtraction to be worth asking';
        /* ⚠️ 最少的那一項是 0 的時候，加法和減法真的是同一個答案 —— 那一批**沒有**
           相加誘答可以提供，所以不可以無條件要求它（無條件要求的話，下面那條 indexOf
           會比中**正解**、照樣放行，那才是真的 fail-open）。產生器把「這一批有沒有
           相加誘答」記在 hasAddTrap 上，兩邊都要驗：旗標必須誠實，而且該有的時候一定要有。
           ⚠️ 第一版的修正是「碰到就整批丟掉」—— 那是修正過度，會把「最少的是 0」這個
           這一課真正要練的情形整個排除掉（codex 第二輪抓到）。 */
        const addTrap = d.vals[hi] + d.vals[lo];
        if (d.hasAddTrap !== (addTrap !== d.diff))
          return 'diffBars: hasAddTrap says ' + d.hasAddTrap + ' but adding gives ' + addTrap + ' against an answer of ' + d.diff;
        if (d.hasAddTrap && d.opts.indexOf(addTrap) < 0)
          return 'diffBars: the "added them instead" distractor is missing, so the misconception is untested';
        if (d.opts[d.ans] !== d.diff) return 'diffBars: opts[ans] is not the computed difference';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'diffBars: options are not four distinct numbers';
        for (const o of d.opts) if (o !== d.diff && d.vals.indexOf(o) >= 0)
          return 'diffBars: distractor ' + o + ' is a value readable straight off the chart';
      },
      totalBars: d => {
        if (!d) return 'totalBars: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const want = sumRef(d.vals);
        if (d.total !== want) return 'totalBars: the total is ' + d.total + ' but adding the bars gives ' + want;
        if (!inRangeRef(d.total)) return 'totalBars: the total ' + d.total + ' is outside 0..' + OPT_MAX_REF;
        const hi = soleMaxRef(d.vals);
        if (hi < 0) return 'totalBars: the tallest bar is not unique, so the "only the tallest" distractor is ambiguous';
        if (d.opts.indexOf(d.vals[hi]) < 0)
          return 'totalBars: the "only the tallest bar" distractor is missing, so the misconception is untested';
        if (d.vals[hi] === d.total) return 'totalBars: the "only the tallest" distractor coincides with the answer';
        if (d.opts[d.ans] !== d.total) return 'totalBars: opts[ans] is not the sum of the bars';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'totalBars: options are not four distinct numbers';
      },
      gridRowsQ: d => {
        if (!d) return 'gridRowsQ: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const want = rowsRef(d.vals);
        if (d.need !== want) return 'gridRowsQ: the grid height is ' + d.need + ' but the reference gives ' + want;
        if (!(d.need >= 3)) return 'gridRowsQ: a grid of ' + d.need + ' cells is too small to be worth asking about';
        if (soleMaxRef(d.vals) < 0) return 'gridRowsQ: the tallest item is not unique, so the explanation cannot name it';
        if (d.opts.indexOf(d.need - 1) < 0 || d.opts.indexOf(d.need + 1) < 0)
          return 'gridRowsQ: both the too-small and the more-than-enough distractors are required — "at least" is the whole point';
        if (d.opts[d.ans] !== d.need) return 'gridRowsQ: opts[ans] is not the fewest cells that fit';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'gridRowsQ: options are not four distinct numbers';
      },
      barCells: d => {
        if (!d) return 'barCells: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.v !== d.vals[d.at]) return 'barCells: v=' + d.v + ' is not the value of item ' + d.at;
        if (!(d.v >= 2)) return 'barCells: a bar of ' + d.v + ' cells is too short for the line/cell confusion to bite';
        if (d.opts.indexOf(d.v + 1) < 0)
          return 'barCells: the grid-line distractor (' + (d.v + 1) + ') is missing, so the headline misconception is untested';
        if (d.opts[d.ans] !== d.v) return 'barCells: opts[ans] is not the number in the table';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'barCells: options are not four distinct numbers';
      },
      zeroItem: d => {
        if (!d) return 'zeroItem: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.vals[d.at] !== 0) return 'zeroItem: the item asked about is not 0, it is ' + d.vals[d.at];
        if (soleMinRef(d.vals) !== d.at) return 'zeroItem: the 0 item is not the only smallest one on the chart';
        if (rowsRef(d.vals) < 3) return 'zeroItem: the grid is too short for a 0 bar to stand out';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'zeroItem: options are not four distinct sentences';
        for (const k of ['zero', 'forgot', 'one', 'drop']) if (d.opts.indexOf(k) < 0)
          return 'zeroItem: sentence "' + k + '" is missing from the options';
        if (d.opts[d.ans] !== 'zero') return 'zeroItem: opts[ans] is not the sentence that says the bar is 0 cells tall';
      },
      lineDir: d => {
        if (!d) return 'lineDir: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const want = dirRef(d.vals[d.at], d.vals[d.at + 1]);
        if (d.dir !== want) return 'lineDir: the direction is ' + d.dir + ' but reading left to right gives ' + want;
        if (d.delta !== Math.abs(d.vals[d.at + 1] - d.vals[d.at])) return 'lineDir: the stated change is not the difference';
        if (rowsRef(d.vals) < 3) return 'lineDir: the grid is too short to see the line move';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'lineDir: options are not four distinct answers';
        if (d.opts[d.ans] !== d.dir + ':' + d.delta) return 'lineDir: opts[ans] is not the computed direction and change';
        for (const o of d.opts){
          const p = String(o).split(':');
          if (['up', 'down', 'flat'].indexOf(p[0]) < 0) return 'lineDir: option "' + o + '" is not one of the three directions';
          if (p[0] === 'flat' && p[1] !== '0') return 'lineDir: a level stretch cannot change by ' + p[1];
          if (p[0] !== 'flat' && !(Number(p[1]) > 0)) return 'lineDir: a moving stretch cannot change by ' + p[1];
        }
      },
      linePoint: d => {
        if (!d) return 'linePoint: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.v !== d.vals[d.at]) return 'linePoint: v=' + d.v + ' is not the value of dot ' + d.at;
        if (rowsRef(d.vals) < 3) return 'linePoint: the grid is too short to read a dot off';
        if (d.opts[d.ans] !== d.v) return 'linePoint: opts[ans] is not the height of the dot';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'linePoint: options are not four distinct numbers';
        for (const o of d.opts) if (o !== d.v && d.vals.indexOf(o) >= 0)
          return 'linePoint: distractor ' + o + ' is one of the other bars on the same chart, so reading a different dot correctly is marked wrong';
      },
      countOverQ: d => {
        if (!d) return 'countOverQ: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        const want = overRef(d.vals, d.k);
        if (d.n !== want) return 'countOverQ: the count is ' + d.n + ' but "more than ' + d.k + '" gives ' + want;
        const withEq = d.vals.filter(v => v >= d.k).length;
        if (d.withEq !== withEq) return 'countOverQ: withEq is ' + d.withEq + ', the reference gives ' + withEq;
        if (withEq === d.n)
          return 'countOverQ: at least one item must sit exactly on the threshold, otherwise "exactly k does not count" is never exercised';
        if (!(d.n >= 1 && d.n < d.vals.length)) return 'countOverQ: a count of ' + d.n + ' out of ' + d.vals.length + ' is degenerate';
        if (d.opts.indexOf(withEq) < 0)
          return 'countOverQ: the "count k as well" distractor is missing, so the misconception is untested';
        if (d.opts[d.ans] !== d.n) return 'countOverQ: opts[ans] is not the strict count';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'countOverQ: options are not four distinct numbers';
      },
      countSeg: d => {
        if (!d) return 'countSeg: make() returned nothing — 300 draws all failed, so this generator has no domain left';
        if (d.want !== 'up' && d.want !== 'down') return 'countSeg: the direction asked about is ' + d.want;
        const want = countDirRef(d.vals, d.want);
        if (d.n !== want) return 'countSeg: the count is ' + d.n + ' but the reference gives ' + want;
        const flat = countDirRef(d.vals, 'flat');
        if (d.flat !== flat) return 'countSeg: flat is ' + d.flat + ', the reference gives ' + flat;
        if (flat < 1) return 'countSeg: a level stretch is required, otherwise "level does not count" is never exercised';
        if (!(d.n >= 1)) return 'countSeg: the answer must not be zero, or the question teaches nothing';
        if (d.segs !== d.vals.length - 1) return 'countSeg: segs is ' + d.segs + ' for ' + d.vals.length + ' dots';
        if (d.opts.indexOf(d.n + flat) < 0)
          return 'countSeg: the "count the level ones too" distractor is missing, so the misconception is untested';
        if (d.opts[d.ans] !== d.n) return 'countSeg: opts[ans] is not the count of stretches in that direction';
        if (d.opts.length !== 4 || new Set(d.opts).size !== 4) return 'countSeg: options are not four distinct numbers';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不呼叫 review.html 的格式化函式，字典也用設定檔自己那一張。 */
    expectedCorrect: function(d, genId, lang){
      const item = k => ITEM_REF[lang][k];
      const unit = UNIT_REF[lang][d.sceneId];
      if (genId === 'readBar' || genId === 'linePoint' || genId === 'barCells') return String(d.vals[d.at]);
      if (genId === 'mostBar')  return item(d.keys[soleMaxRef(d.vals)]);
      if (genId === 'leastBar') return item(d.keys[soleMinRef(d.vals)]);
      if (genId === 'diffBars') return String(maxRef(d.vals) - minRef(d.vals));
      if (genId === 'totalBars') return String(sumRef(d.vals));
      if (genId === 'gridRowsQ') return String(rowsRef(d.vals));
      if (genId === 'countOverQ'){
        const n = overRef(d.vals, d.k);
        return lang === 'zh' ? n + ' 項' : n + ' ' + (n === 1 ? 'item' : 'items');
      }
      if (genId === 'countSeg'){
        const n = countDirRef(d.vals, d.want);
        return lang === 'zh' ? n + ' 段' : n + ' ' + (n === 1 ? 'stretch' : 'stretches');
      }
      if (genId === 'zeroItem'){
        const name = item(d.keys[d.at]);
        return lang === 'zh'
          ? name + '是 0 ' + unit + '，長條的高度就是 0 格'
          : name + ' is 0, so its bar is 0 cells tall';
      }
      if (genId === 'lineDir'){
        const dir = dirRef(d.vals[d.at], d.vals[d.at + 1]);
        const delta = Math.abs(d.vals[d.at + 1] - d.vals[d.at]);
        if (lang === 'zh')
          return dir === 'up' ? '往上，多了 ' + delta + ' ' + unit
               : dir === 'down' ? '往下，少了 ' + delta + ' ' + unit
               : '一樣高，沒有變';
        return dir === 'up' ? 'Up, ' + delta + ' more ' + unitPlRef(delta, unit, lang)
             : dir === 'down' ? 'Down, ' + delta + ' fewer ' + unitPlRef(delta, unit, lang)
             : 'Level, no change';
      }
      return null;
    },

    /* 這一課的選項長什麼樣。正解與誘答分開驗。 */
    optionOk: function(s, genId, lang, isCorrect){
      const NUMERIC = ['readBar', 'diffBars', 'totalBars', 'gridRowsQ', 'barCells', 'linePoint'];
      /* 「幾項」「幾段」的選項帶單位 —— 不帶的話，一個裸數字和圖上讀得到的
         「幾個」長得一模一樣，孩子分不出問的是項數還是數量（codex 抓到）。 */
      if (genId === 'countOverQ' || genId === 'countSeg'){
        const noun = genId === 'countOverQ' ? { zh:'項', en:['item', 'items'] }
                                            : { zh:'段', en:['stretch', 'stretches'] };
        const ok = lang === 'zh'
          ? new RegExp('^\\d+ ' + noun.zh + '$').test(s)
          : new RegExp('^(1 ' + noun.en[0] + '|\\d+ ' + noun.en[1] + ')$').test(s);
        if (!ok) return genId + ' option "' + s + '" does not carry the unit that says what is being counted';
        const n = Number(s.replace(/[^0-9]/g, ''));
        if (!inRangeRef(n)) return genId + ' option ' + n + ' is outside 0..' + OPT_MAX_REF;
        return null;
      }
      if (NUMERIC.indexOf(genId) >= 0){
        if (!/^\d+$/.test(s)) return genId + ' option "' + s + '" is not a whole number';
        const n = Number(s);
        if (!inRangeRef(n)) return genId + ' option ' + n + ' is outside 0..' + OPT_MAX_REF;
        return null;
      }
      if (genId === 'mostBar' || genId === 'leastBar'){
        const names = Object.keys(ITEM_REF[lang]).map(k => ITEM_REF[lang][k]);
        if (names.indexOf(s) < 0) return genId + ' option "' + s + '" is not one of the item names in the dictionary';
        return null;
      }
      if (genId === 'lineDir'){
        const ok = lang === 'zh'
          ? /^(往上，多了 \d+ .+|往下，少了 \d+ .+|一樣高，沒有變)$/.test(s)
          : /^(Up, \d+ more .+|Down, \d+ fewer .+|Level, no change)$/.test(s);
        if (!ok) return 'lineDir option "' + s + '" is not one of the three shapes the lesson teaches';
        return null;
      }
      if (genId === 'zeroItem'){
        if (s.length < 6 || s.length > 90) return 'zeroItem option "' + s + '" is not a readable sentence';
        if (/\d\d/.test(s)) return 'zeroItem option "' + s + '" quotes a multi-digit number, which no sentence here should';
        /* ⚠️ 選項是整句話的時候，光驗形狀等於沒驗正解 —— 這裡用 isCorrect 把
           「那一句話才是對的」釘住：只有正解可以說「長條的高度是 0 格」。
           ⚠️ 代價寫在這裡給後面的人看：**誘答不可以引用或否定這一句話**
           （「『長條的高度就是 0 格』是不對的」會被誤判）。要寫那種誘答的話，
           先把這裡的判準換成「整句相等」而不是「含有」。 */
        const KEY = lang === 'zh' ? '長條的高度就是 0 格' : 'its bar is 0 cells tall';
        const has = s.indexOf(KEY) >= 0;
        if (isCorrect && !has) return 'zeroItem: the correct option never says "' + KEY + '"';
        if (!isCorrect && has) return 'zeroItem: a distractor also says "' + KEY + '", so two options are right';
        return null;
      }
      return 'no optionOk rule for generator ' + genId;
    },

    /* 拿**渲染出來的那一題**再驗一次。INVARIANTS 只看得到資料，
       看不到題幹、解釋與圖 —— 而那三樣都是拼出來的。 */
    renderCheck: function(d, q, lang, genId){
      const out = [];
      if (!d) return 'make() returned nothing';
      const R = FIG_REF.review;
      const names = d.keys.map(k => ITEM_REF[lang][k]);
      const unit = UNIT_REF[lang][d.sceneId];

      /* 「問的是什麼」單獨驗一次：只驗數字的話，把題幹改成問別的、正解不動，全部都是綠的。 */
      const ASK = {
        zh:{
          readBar:    { must:['有幾'], never:['一共', '最多'] },
          mostBar:    { must:['哪一項最多'], never:['一共'] },
          leastBar:   { must:['哪一項最少'], never:['一共'] },
          diffBars:   { must:['最多的比最少的多幾'], never:['一共'] },
          totalBars:  { must:['<strong>一共</strong>幾'], never:['最多的那一項'] },
          gridRowsQ:  { must:['格子<strong>最少</strong>要幾格'], never:['一共'] },
          barCells:   { must:['那一條要疊幾格'], never:['一共'] },
          zeroItem:   { must:['一格都沒有'], never:['一共'] },
          lineDir:    { must:['這一段線，是怎麼變的'], never:['一共'] },
          linePoint:  { must:['那一個點是幾'], never:['一共'] },
          countOverQ: { must:['有幾項<strong>比'], never:['一共'] },
          countSeg:   { must:['有幾段線是'], never:['一共'] }
        },
        en:{
          readBar:    { must:['how many'], never:['altogether', 'the most'] },
          mostBar:    { must:['which item has the most'], never:['altogether'] },
          leastBar:   { must:['which item has the fewest'], never:['altogether'] },
          diffBars:   { must:['how many more'], never:['altogether'] },
          totalBars:  { must:['<strong>altogether</strong>'], never:['which item'] },
          gridRowsQ:  { must:['how many cells does the grid need <strong>at least</strong>'], never:['altogether'] },
          barCells:   { must:['how many cells tall'], never:['altogether'] },
          zeroItem:   { must:['has no cells at all'], never:['altogether'] },
          lineDir:    { must:['how did the line change'], never:['altogether'] },
          linePoint:  { must:['dot'], never:['altogether'] },
          countOverQ: { must:['more than'], never:['altogether'] },
          countSeg:   { must:['how many stretches'], never:['altogether'] }
        }
      };
      const ask = ASK[lang][genId];
      if (!ask) out.push('no ASK entry for ' + genId + ' in ' + lang);
      else {
        const hay = lang === 'en' ? q.stem.toLowerCase() : q.stem;
        for (const m of ask.must) if (hay.indexOf(lang === 'en' ? m.toLowerCase() : m) < 0)
          out.push('stem never says "' + m + '"');
        for (const nv of ask.never) if (hay.indexOf(lang === 'en' ? nv.toLowerCase() : nv) >= 0)
          out.push('stem says "' + nv + '", which is a different question');
      }

      /* ⚠️ 題幹裡的**每一個數字**都要對得上 make() 留下的參數。
         只驗關鍵字的話，題幹可以印別的門檻而正解仍然是原來的答案。 */
      const STEM_NUMS = {
        readBar:    () => [],
        mostBar:    () => [],
        leastBar:   () => [],
        diffBars:   () => [],
        totalBars:  () => [],
        gridRowsQ:  () => d.vals.concat([1]),
        barCells:   () => d.vals.concat([1]),
        zeroItem:   () => [],
        lineDir:    () => [],
        linePoint:  () => [],
        countOverQ: () => [d.k],
        countSeg:   () => []
      };
      if (!STEM_NUMS[genId]) out.push('no STEM_NUMS entry for ' + genId);
      else {
        const want = STEM_NUMS[genId]().map(Number).sort((x, y) => x - y).join(',');
        const got = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || [])
                      .map(Number).sort((x, y) => x - y).join(',');
        if (want !== got)
          out.push('the rendered stem prints the numbers [' + got + '] but make() implies [' + want +
                   '] — the stem and the scored answer are no longer about the same question');
      }

      /* ⚠️ 子字串的釘樁永遠留得下空間：在合法的那一句後面再接一句問別的、
         或在前面加一句「不是在問…」，每一條子字串斷言都還是綠的（codex 第五輪抓到）。
         唯一釘得死的做法是**把整句題幹重建一次**（第二套實作，和 BANK 的 stemExact 同一招）：
         多一個字少一個字都對不上。下面那幾條子字串斷言留著，因為它們的訊息比較好讀，
         但真正把門關上的是這一條。 */
      const tableOfRef = () => names.map((n, i) => lang === 'zh'
        ? n + ' ' + d.vals[i] + ' ' + unit
        : n + ' ' + d.vals[i] + ' ' + unitPlRef(d.vals[i], unit, lang)).join(lang === 'zh' ? '、' : ', ');
      const DIR_REF = { zh:{ up:'往上', down:'往下', flat:'一樣高' },
                        en:{ up:'up', down:'down', flat:'level' } };
      const STEM_EXACT = {
        zh:{
          readBar:    () => '看這張長條圖：<strong>' + names[d.at] + '</strong> 有幾' + unit + '？',
          mostBar:    () => '看這張長條圖：<strong>哪一項最多</strong>？',
          leastBar:   () => '看這張長條圖：<strong>哪一項最少</strong>？',
          diffBars:   () => '看這張長條圖：<strong>最多的比最少的多幾' + unit + '</strong>？',
          totalBars:  () => '看這張長條圖：<strong>一共</strong>幾' + unit + '？',
          gridRowsQ:  () => '統計表是：' + tableOfRef() + '。要把它畫成一格代表 1 ' + unit + ' 的長條圖，格子<strong>最少</strong>要幾格？',
          barCells:   () => '統計表是：' + tableOfRef() + '。畫成一格代表 1 ' + unit + ' 的長條圖，<strong>' + names[d.at] + '</strong> 那一條要疊幾格？',
          zeroItem:   () => '看這張長條圖：<strong>' + names[d.at] + '</strong> 一格都沒有。下面哪一句話<strong>對</strong>？',
          lineDir:    () => '看這張折線圖：從 <strong>' + names[d.at] + '</strong> 到 <strong>' + names[d.at + 1] + '</strong> 這一段線，是怎麼變的？',
          linePoint:  () => '看這張折線圖：<strong>' + names[d.at] + '</strong> 那一個點是幾' + unit + '？',
          countOverQ: () => '看這張長條圖：有幾項<strong>比 ' + d.k + ' ' + unit + '多</strong>？',
          countSeg:   () => '看這張折線圖：有幾段線是<strong>' + DIR_REF.zh[d.want] + '</strong>的？'
        },
        en:{
          readBar:    () => 'On this bar chart, how many does <strong>' + names[d.at] + '</strong> have?',
          mostBar:    () => 'On this bar chart, <strong>which item has the most</strong>?',
          leastBar:   () => 'On this bar chart, <strong>which item has the fewest</strong>?',
          diffBars:   () => 'On this bar chart, <strong>how many more ' + unitPlRef(2, unit, lang) + ' does the item with the most have than the item with the fewest</strong>?',
          totalBars:  () => 'On this bar chart, how many ' + unitPlRef(2, unit, lang) + ' are there <strong>altogether</strong>?',
          gridRowsQ:  () => 'A table reads: ' + tableOfRef() + '. To draw it as a bar chart where one cell means 1 ' + unit + ', how many cells does the grid need <strong>at least</strong>?',
          barCells:   () => 'A table reads: ' + tableOfRef() + '. Drawing it so that one cell means 1 ' + unit + ', how many cells tall is the <strong>' + names[d.at] + '</strong> bar?',
          zeroItem:   () => 'On this bar chart <strong>' + names[d.at] + '</strong> has no cells at all. Which sentence is <strong>right</strong>?',
          lineDir:    () => 'On this line graph, from <strong>' + names[d.at] + '</strong> to <strong>' + names[d.at + 1] + '</strong>, how did the line change?',
          linePoint:  () => 'On this line graph, how many does the <strong>' + names[d.at] + '</strong> dot show?',
          countOverQ: () => 'On this bar chart, how many items are <strong>more than ' + d.k + ' ' + unitPlRef(d.k, unit, lang) + '</strong>?',
          countSeg:   () => 'On this line graph, how many stretches of the line go <strong>' + DIR_REF.en[d.want] + '</strong>?'
        }
      };
      if (!STEM_EXACT[lang][genId]) out.push('no STEM_EXACT entry for ' + genId + ' in ' + lang);
      else {
        const want = STEM_EXACT[lang][genId]();
        if (q.stem !== want)
          out.push('the rendered stem does not match the pinned wording word for word:\n    got  ' +
                   q.stem + '\n    want ' + want);
      }

      /* 解釋裡的每一條算式都要真的算對，而且至少要有一條
         （純敘述型的那幾支除外 —— 它們的解釋本來就沒有算式）。 */
      const ar = arithProblems(q.why);
      for (const p of ar.problems) out.push('why: ' + p);
      const NO_EQUATION_OK = ['mostBar', 'leastBar', 'zeroItem', 'gridRowsQ', 'countOverQ', 'countSeg', 'barCells'];
      if (ar.verified < 1 && NO_EQUATION_OK.indexOf(genId) < 0)
        out.push('the explanation contains no checkable equation at all');

      /* 畫面上看得到的字：中文黏數字、英文的 1、重複標點、負數。 */
      for (const t of textProblems(q.stem, lang, 'stem')) out.push(t);
      for (const t of textProblems(q.why, lang, 'why')) out.push(t);
      for (let i = 0; i < q.opts.length; i++)
        for (const t of textProblems(q.opts[i], lang, 'option ' + i)) out.push(t);
      if (q.cap) for (const t of textProblems(q.cap, lang, 'caption')) out.push(t);

      /* 字典：項目名逐字比對（拿字典比字典等於自己比自己）。 */
      for (let i = 0; i < d.keys.length; i++)
        if (!ITEM_REF[lang][d.keys[i]]) out.push('the checker has no pinned name for item ' + d.keys[i]);

      /* 圖：有圖的題目必須真的畫出來，而且畫的是被計分的那一組數字。 */
      const NEEDS_FIG = ['readBar', 'mostBar', 'leastBar', 'diffBars', 'totalBars',
                         'zeroItem', 'lineDir', 'linePoint', 'countOverQ', 'countSeg'];
      const wantsFig = NEEDS_FIG.indexOf(genId) >= 0;
      if (wantsFig && !q.fig) out.push(genId + ' rendered without a figure, but the question is about a chart');
      else if (!wantsFig && q.fig) out.push(genId + ' rendered a figure it should not have');
      if (q.fig){
        const kind = (genId === 'lineDir' || genId === 'linePoint' || genId === 'countSeg') ? 'line' : 'bar';
        if (q.fig.kind !== kind) out.push('the figure is a ' + q.fig.kind + ' chart, but this question needs a ' + kind + ' one');
        if (String(q.fig.vals) !== String(d.vals))
          out.push('the figure is drawn from different numbers (' + q.fig.vals + ') than the ones being scored (' + d.vals + ')');
        if (String(q.fig.names) !== String(names))
          out.push('the item name dictionary renders [' + q.fig.names + '] but the checker pins [' + names + ']');
        const rows = rowsRef(d.vals);
        const bad = (kind === 'line')
          ? checkLine(q.fig, d.vals, rows, R, names, genId + ' fig')
          : checkPlan(q.fig, d.vals, rows, R, names, genId + ' fig');
        if (bad.length) out.push(bad[0]);
        /* ⚠️ 圖說和題幹同一個道理：子字串釘不死它。
           「有講一格代表 1」→ 被 `1 bookcase` 滿足（前綴）；改成比結尾 → 前面再加一句
           「Each cell means 2 books.」照樣過；改成數「一格代表 1」出現幾次 → 換個說法
           寫第二個刻度又躲掉了。同一個洞被抓到三次（第四、五、六輪各一次形狀不同）。
           唯一釘得死的還是**整句重建一次** —— 圖示、情境名、單位，一個字都不能差。 */
        if (!q.cap) out.push('the chart has no caption');
        else {
          const sceneName = SCENE_REF[lang][d.sceneId];
          if (!sceneName) out.push('the checker has no pinned name for scenario ' + d.sceneId);
          else {
            const icon = (kind === 'line') ? '📈' : '📊';
            const lead = lang === 'zh' ? '　一格代表 1 ' : '　One cell means 1 ';
            const wantCap = icon + ' ' + sceneName + lead + unit;
            if (q.cap !== wantCap)
              out.push('the caption does not match the pinned wording word for word:\n    got  ' +
                       q.cap + '\n    want ' + wantCap);
          }
        }
        /* 圖上讀得回來的高度必須就是被計分的那個答案（幾何 → 數字的反向驗證）。 */
        if (genId === 'readBar' || genId === 'linePoint'){
          const bar = q.fig.bars[d.at];
          const cells = Math.round((q.fig.box.y1 - bar.y) / q.fig.cellH);
          if (String(cells) !== String(q.opts[q.ans]))
            out.push('measuring the drawn bar gives ' + cells + ' cells but the scored answer is ' + q.opts[q.ans]);
        }
      }

      /* ⚠️ 一定要回字串或 null：空陣列在 JS 裡是 truthy，
         simgen 的 `if (r) fail(...)` 會把「沒問題」當成「有問題」。 */
      return out.length ? out.join('; ') : null;
    }
  },

  /* ================= index.html 靜態資料檢查 ================= */
  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{maxOf, minOf, sumOf, gridRows, soleMaxIndex, soleMinIndex, segDir, segDelta, ' +
                'countOver, countDir, s1Steps, s1Where, plEn, plotBox, chartPlan, linePlan, ' +
                'FIG_W, FIG_H, PAD_L, PAD_R, PAD_T, PAD_B, GAP_RATIO, AXIS_NUM_DX, AXIS_NUM_FS, ' +
                'ITEM_FS, ITEM_DY, DOT_R, UNIT, DATASETS, READ_DS, TWO_DS, DRAW, DRAW_ROWS, LINE, ' +
                'TWO_QS, TWO_OVER_K, GPICK, shuffle, GCH, gChart, gBarTop, GTBL, STACK, STACK_H, GAME_STACK, stackCols, ' +
                'stackRefuse, READ, READ_H, GAME_READ, readSlots, readCols, readWhy, readRefuse, CUTP, CUTP_H, GAME_CUT, cutLevel, cutOnPaper, cutRefuse, ' +
                'SEG, SEG_DIRS, SEG_BIN, SEG_CARD, SEG_TRAY, SEG_H, GAME_SEG, segBin, segTray, sortRefuse, ' +
                'TWO, TWO_H, GAME_TWO, twoAnswer, parseCount, twoWhy}',
    optionValueMax: OPT_MAX_REF,

    check: function(data, I18N, fail, src){
      const { DATASETS, DRAW, DRAW_ROWS, LINE, UNIT, TWO_QS, TWO_OVER_K, READ_DS, TWO_DS } = data;
      const R = FIG_REF.index;

      /* ---- 1. 版面常數必須對得上獨立寫死的規格 ---- */
      const CONSTS = [['FIG_W', R.W], ['FIG_H', R.H], ['PAD_L', R.PL], ['PAD_R', R.PR],
                      ['PAD_T', R.PT], ['PAD_B', R.PB], ['GAP_RATIO', R.GAP],
                      ['AXIS_NUM_DX', R.NDX], ['AXIS_NUM_FS', R.NFS],
                      ['ITEM_FS', R.IFS], ['ITEM_DY', R.IDY], ['DOT_R', R.DOT]];
      for (const pair of CONSTS)
        if (data[pair[0]] !== pair[1]) fail('layout constant ' + pair[0] + ' is ' + data[pair[0]] + ', the spec says ' + pair[1]);
      const box = data.plotBox();
      if (box.x0 !== R.PL || box.x1 !== R.W - R.PR || box.y0 !== R.PT || box.y1 !== R.H - R.PB)
        fail('plotBox() does not match the padding constants: ' + JSON.stringify(box));
      /* viewBox 與 CSS 高度要跟著版面常數走。 */
      const viewBoxes = [...new Set(src.match(/viewBox="0 0 \d+ \d+"/g) || [])];
      if (viewBoxes.length !== 1 || viewBoxes[0] !== 'viewBox="0 0 ' + R.W + ' ' + R.H + '"')
        fail('the page draws into viewBox(es) ' + viewBoxes.join(' / ') + ', the layout constants give "0 0 ' + R.W + ' ' + R.H + '"');
      if (src.indexOf('max-width:' + R.W + 'px;height:' + R.H + 'px') < 0)
        fail('the .chartfig CSS size no longer matches the layout constants (' + R.W + '×' + R.H + ')');

      /* ---- 2. 統計：對每一組小陣列窮舉比對，不抽樣 ---- */
      let statChecks = 0;
      for (const vals of allTuples(4, 5).concat(allTuples(5, 3))){
        if (data.maxOf(vals) !== maxRef(vals)){ fail('maxOf disagrees with the reference on [' + vals + ']'); return; }
        if (data.minOf(vals) !== minRef(vals)){ fail('minOf disagrees with the reference on [' + vals + ']'); return; }
        if (data.sumOf(vals) !== sumRef(vals)){ fail('sumOf disagrees with the reference on [' + vals + ']'); return; }
        if (data.gridRows(vals) !== rowsRef(vals)){ fail('gridRows disagrees with the reference on [' + vals + ']'); return; }
        if (data.soleMaxIndex(vals) !== soleMaxRef(vals)){ fail('soleMaxIndex disagrees with the reference on [' + vals + ']'); return; }
        if (data.soleMinIndex(vals) !== soleMinRef(vals)){ fail('soleMinIndex disagrees with the reference on [' + vals + ']'); return; }
        /* ⚠️ 順序：一對一對的 segDir／segDelta 要排在 countDir 前面。
           countDir 是用 segDir 算的，排在前面的話任何 segDir 的改壞都會先撞上它，
           而 segDir 那一條就從頭到尾沒有被證明過。 */
        for (let i = 0; i + 1 < vals.length; i++){
          if (data.segDir(vals[i], vals[i + 1]) !== dirRef(vals[i], vals[i + 1])){ fail('segDir disagrees with the reference on [' + vals + ']'); return; }
          if (data.segDelta(vals[i], vals[i + 1]) !== Math.abs(vals[i + 1] - vals[i])){ fail('segDelta disagrees with the reference on [' + vals + ']'); return; }
        }
        for (let k = 0; k <= 5; k++)
          if (data.countOver(vals, k) !== overRef(vals, k)){ fail('countOver(' + k + ') disagrees with the reference on [' + vals + ']'); return; }
        for (const w of ['up', 'down', 'flat'])
          if (data.countDir(vals, w) !== countDirRef(vals, w)){ fail('countDir("' + w + '") disagrees with the reference on [' + vals + ']'); return; }
        /* 格子數永遠是「格線數 － 1」——這一課的頭號迷思就住在這裡。 */
        if (data.chartPlan(vals, rowsRef(vals)).grid.length !== rowsRef(vals) + 1){
          fail('a grid of ' + rowsRef(vals) + ' ' + plEnRef(rowsRef(vals), 'cell') +
               ' does not have exactly one more line than cells');
          return;
        }
        statChecks++;
      }
      if (statChecks < 2000) fail('the statistics sweep only covered ' + statChecks + ' data sets');
      /* 全部是 0 的時候仍然要有一格，不然畫布高度是 0（除以 0）。 */
      if (data.gridRows([0, 0, 0, 0]) !== 1) fail('gridRows([0,0,0,0]) must still be 1, otherwise the chart has no height');

      /* ---- 3. 版面：兩套實作在整個取樣範圍上逐一比對 ---- */
      let planChecks = 0;
      const LABEL_SETS = [DATASETS[0].keys, DATASETS[1].keys, DATASETS[2].keys, DATASETS[3].keys,
                          DRAW.keys, LINE.keys];
      for (const keys of LABEL_SETS){
        const n = keys.length;
        for (let rows = 1; rows <= VAL_MAX_REF; rows++){
          /* 每一種高度都掃三組代表性的數值：全 0、全滿、以及一組混合（含 0 與滿）。 */
          const cases = [
            new Array(n).fill(0),
            new Array(n).fill(rows),
            keys.map((k, i) => (i === 0 ? 0 : (i === 1 ? rows : Math.min(rows, i))))
          ];
          for (const vals of cases){
            for (const lang of ['zh', 'en']){
              const names = keys.map(k => I18N[lang].item[k]);
              const bad = checkPlan(data.chartPlan(vals, rows), vals, rows, R, names, 'chartPlan ' + lang);
              if (bad.length){ fail(bad[0]); return; }
              const badL = checkLine(data.linePlan(vals, rows), vals, rows, R, names, 'linePlan ' + lang);
              if (badL.length){ fail(badL[0]); return; }
              planChecks += 2;
            }
          }
        }
      }
      if (planChecks < 300) fail('the layout sweep only compared ' + planChecks + ' plans — too few to prove the two implementations agree');

      /* ---- 4. s1 的一格一格疊：0 的那一項也要停一次 ---- */
      for (const ds of DATASETS){
        const total = data.s1Steps(ds.vals);
        let want = 0;
        for (const v of ds.vals) want += Math.max(1, v);
        if (total !== want) fail('s1Steps for ' + ds.id + ' is ' + total + ', the reference gives ' + want);
        const seen = {};
        for (let step = 1; step <= total; step++){
          const w = data.s1Where(ds.vals, step);
          if (!(w.at >= 0 && w.at < ds.vals.length)) fail('s1Where(' + step + ') points at bar ' + w.at);
          if (w.done > ds.vals[w.at]) fail('s1Where(' + step + ') stacks ' + w.done + ' cells on a bar of ' + ds.vals[w.at]);
          if (ds.vals[w.at] === 0 && w.done !== 0) fail('s1Where says a 0 item has stacked ' + w.done + ' cells');
          seen[w.at] = true;
        }
        for (let i = 0; i < ds.vals.length; i++)
          if (!seen[i]) fail('s1Steps for ' + ds.id + ' never pauses on item ' + i + ' — a 0 bar would be skipped silently');
        const last = data.s1Where(ds.vals, total);
        if (last.at !== ds.vals.length - 1 || last.done !== ds.vals[ds.vals.length - 1])
          fail('the last step of ' + ds.id + ' does not finish the last bar');
      }

      /* ---- 5. 資料集本身 ---- */
      for (const ds of DATASETS.concat([DRAW, LINE])){
        if (ds.keys.length !== ds.vals.length) fail(ds.id + ': keys and values do not line up');
        for (const v of ds.vals)
          if (!(Number.isInteger(v) && v >= 0 && v <= VAL_MAX_REF)) fail(ds.id + ': ' + v + ' is outside 0..' + VAL_MAX_REF);
        if (ds !== LINE){
          if (soleMaxRef(ds.vals) < 0) fail(ds.id + ' has no single item with the most, so "which is most" would have two answers');
          if (soleMinRef(ds.vals) < 0) fail(ds.id + ' has no single item with the least, so "which is least" would have two answers');
        }
      }
      if (DATASETS[READ_DS].vals.indexOf(0) < 0)
        fail('example 2 needs an item that is 0 — that is the special case it exists to teach');
      if (DATASETS.filter(ds => ds.vals.indexOf(0) >= 0).length !== 1)
        fail('exactly one of the four data sets should contain a 0, so the case stays a special case');
      for (const w of ['up', 'down', 'flat'])
        if (countDirRef(LINE.vals, w) < 1)
          fail('LINE must show at least one "' + w + '" stretch, otherwise example 4 never demonstrates it');
      if (LINE.vals.length < 5) fail('LINE needs at least five points for four stretches');

      /* ---- 6. 範例 3：格子最少要幾格 ---- */
      const need = rowsRef(DRAW.vals);
      if (DRAW_ROWS.filter(r => r === need).length !== 1)
        fail('DRAW_ROWS must offer the fewest-that-fit (' + need + ') exactly once, it offers [' + DRAW_ROWS + ']');
      if (!DRAW_ROWS.some(r => r < need))
        fail('DRAW_ROWS must offer a height that is too small, or "not enough" is never shown');
      if (!DRAW_ROWS.some(r => r > need))
        fail('DRAW_ROWS must offer a height that fits but is not the fewest, or "at least" is never demonstrated');
      for (let i = 1; i < DRAW_ROWS.length; i++)
        if (!(DRAW_ROWS[i] > DRAW_ROWS[i - 1])) fail('DRAW_ROWS is not increasing');

      /* ---- 7. 範例 5：兩步驟 ---- */
      const twoVals = DATASETS[TWO_DS].vals;
      if (TWO_QS.join(',') !== 'gap,total,over') fail('the two-step example no longer offers all three questions');
      if (!(overRef(twoVals, TWO_OVER_K) >= 1 && overRef(twoVals, TWO_OVER_K) < twoVals.length))
        fail('TWO_OVER_K=' + TWO_OVER_K + ' makes the "more than k" answer degenerate');
      if (twoVals.indexOf(TWO_OVER_K) < 0)
        fail('TWO_OVER_K=' + TWO_OVER_K + ' must land exactly on one of the bars, otherwise "exactly k does not count" is never shown');

      /* ---- 8. 小遊戲「統計圖工作室接訂單」（2026-10-08 改成五關五種玩法，§六之五） ----
         每一關用這份設定自己的讀法重算答案（格線由上往下算、排序找最多、自己判斷往上往下），並照遊戲的規則把題庫每一題玩一遍：
         疊長條把每一欄疊到滿再多疊一格、讀回表格把 0～9 每一張卡放進每一格、剪格子紙把剪刀停在每一條線按「剪下去」、
         分一分把每一張卡放進每一個籃子、算一算把 0～60 每一個數打進去。
         頁面的純函式（gChart／gBarTop／stackCols／readSlots／readCols／readWhy／cutLevel／cutOnPaper／segBin／segTray／
         twoAnswer／parseCount／twoWhy）拿整個題庫去呼叫、再和自己的算法比；nearestOpen()、roundMiss()、shuffle() 從原始碼切出來真的跑；
         只在 RENDER 裡、切不出來的關鍵規則用原始碼形狀守住（need()）。每一句說明逐個比數字，再交給第 10 段的文字與算式掃描。
         拖拉、點選、兩根手指、capture 遺失、375px 的實際尺寸由 teaching-workspace/game-harness/g4-chart 的端對端測試驗。 */
      const GAME_NARR = [];
      {
        const D = data, LANGS = ['zh', 'en'], W = 300, EPSG = 1e-9;
        const gsrc = src.replace(/<!--[\s\S]*?-->/g, ' ');
        const fin = v => typeof v === 'number' && isFinite(v);
        const nums = t => (String(t).replace(/<[^>]+>/g, '').match(/\d+/g) || []).map(Number);
        /* 一句畫面上的話：數字逐個比，然後交給第 10 段（英文單複數、中文黏數字、負號、算式逐條重算） */
        const say = (where, lang, text, want) => {
          if (typeof text !== 'string' || !text || /undefined|NaN|null|\[object/.test(text)){ fail('GAME ' + where + ' (' + lang + '): text is empty or has undefined/NaN/null: ' + text); return; }
          if (want && nums(text).join() !== want.join()) fail('GAME ' + where + ' (' + lang + '): numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
          GAME_NARR.push(['GAME ' + where, text, lang]);
        };
        /* 理由的話要說對那一種錯：每一種理由都要有自己的關鍵詞，而且不可以有同一組裡別種理由的關鍵詞 */
        const SEM = {
          stack:{ zero:{ zh:'一格都不疊', en:'no cells at all' }, full:{ zh:'太高', en:'too tall' } },
          read:{ zero:{ zh:'0 格', en:'0 cells' }, line:{ zh:'格線', en:'grid lines' }, high:{ zh:'下面', en:'below' }, low:{ zh:'上面', en:'above' } },
          cut:{ few:{ zh:'不夠', en:'not enough' }, more:{ zh:'最少', en:'fewest' } },
          two:{ tall:{ zh:'最高的那一條', en:'tallest' }, sum:{ zh:'把最多和最少加起來', en:'adds the most and the least' }, most:{ zh:'減掉最少', en:'take away the smallest' },
                high:{ zh:'太多', en:'too many' }, low:{ zh:'太少', en:'too few' } }
        };
        const means = (group, kind, lang, text) => {
          const G = SEM[group], plain = String(text).replace(/<[^>]+>/g, '');
          if (plain.indexOf(G[kind][lang]) < 0) fail('GAME ' + group + ' (' + lang + '): the "' + kind + '" reason never says "' + G[kind][lang] + '": ' + plain);
          for (const other of Object.keys(G)) if (other !== kind && plain.indexOf(G[other][lang]) >= 0)
            fail('GAME ' + group + ' (' + lang + '): the "' + kind + '" reason also says "' + G[other][lang] + '" (the "' + other + '" reason): ' + plain);
        };
        const scale = Math.min(1.5, 289 / W);   /* 375px 手機上卡片內寬約 289px，300 寬的畫板縮成約 0.963 倍 */
        const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail('GAME ' + what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
        const inside = (o, what, H) => { if (!(fin(o.x) && fin(o.y) && o.x >= -EPSG && o.y >= -EPSG && o.x + o.w <= W + EPSG && o.y + o.h <= H + EPSG)) fail('GAME ' + what + ' is outside the ' + W + '×' + H + ' board: ' + JSON.stringify(o)); };
        const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > EPSG && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > EPSG;
        const sq = (cx, cy, w, h) => ({ x:cx - w / 2, y:cy - h / 2, w:w, h:h });
        const zbox = (z, pad) => ({ x:z.cx - z.hw - (pad || 0), y:z.cy - z.hh - (pad || 0), w:2 * (z.hw + (pad || 0)), h:2 * (z.hh + (pad || 0)) });
        const noHits = (list, what) => { for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (hit(list[i], list[j])){ fail('GAME ' + what + ' ' + i + ' and ' + j + ' overlap'); return; } };
        const fits = (text, fs, room, what) => { if (estTextW(text, fs) > room) fail('GAME ' + what + ' "' + text + '" is about ' + Math.round(estTextW(text, fs)) + 'px wide at ' + fs + 'px, but only ' + room + 'px is drawn for it'); };
        const unitIn = (n, id, lang) => unitPlRef(n, UNIT_REF[lang][id], lang);
        const itemOf = (lang, k) => ITEM_REF[lang][k];

        /* --- 五關的順序、RENDER、題目與提示 --- */
        const TYPES = ['stack', 'read', 'cut', 'sort', 'two'];
        const order = (gsrc.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
        if (order === undefined) fail('GAME: cannot find GAME_ORDER in index.html');
        else {
          const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
          if (types.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ' (examples 1, 2, 3, 4, 5), got ' + types.join());
        }
        const body = name => (gsrc.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
        const RB = {};
        TYPES.forEach(t => {
          RB[t] = body(t);
          if (!RB[t]) fail('GAME: cannot cut RENDER.' + t + ' out of index.html');
          LANGS.forEach(L => {
            const a = I18N[L].gAsks && I18N[L].gAsks[t];
            if (typeof a !== 'string' || !a) fail('GAME: gAsks.' + t + ' missing in ' + L);
            else say('gAsks.' + t, L, a);
            const h = I18N[L].gHints && I18N[L].gHints[t];
            if (t === 'two'){
              if (!h || typeof h.total !== 'string' || typeof h.gap !== 'string') fail('GAME: gHints.two needs a total and a gap strategy in ' + L);
              else { say('gHints.two.total', L, h.total); say('gHints.two.gap', L, h.gap); }
            } else if (typeof h !== 'string' || !h) fail('GAME: gHints.' + t + ' missing in ' + L);
            else say('gHints.' + t, L, h);
          });
        });
        const need = (k, re, what) => { if (!re.test(RB[k] || '')) fail('GAME ' + k + ': ' + what); };
        if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(gsrc)) fail('GAME: ahead mode no longer shows hint level 1 automatically');
        if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(gsrc)) fail('GAME: the hint button is not disabled after the second level');
        if (!/if \(typeof h1 !== 'string'\) h1 = h1\[gCtx\.kind\];/.test(gsrc)) fail('GAME: the round-5 strategy hint no longer follows the question kind');
        if (!/gSolved = false; gMistake = false; gCtx = \{\}; gGen\+\+;/.test(gsrc)) fail('GAME: startRound() does not start a new board generation (gGen++) — a piece held across a restart could act on the new round');
        if (!/if \(gen !== gGen\) return;/.test(gsrc)) fail('GAME: a released piece does not check its board generation — a piece held across a restart could act on the new round');
        if (!/if \(!e\.isPrimary \|\| P\.locked \|\| gSolved \|\| start \|\| gen !== gGen\) return;/.test(gsrc)) fail('GAME: a piece can be picked up by a second finger, a locked piece, or a piece from an old board');
        if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(gsrc)) fail('GAME: losing pointer capture no longer puts the piece back');
        if (!/\.gpiece\.locked\{[^}]*pointer-events:none/.test(gsrc)) fail('GAME: placed pieces still catch taps (pointer-events)');
        if (!/if \(!e\.isPrimary\) return;   \/\* 第二根手指/.test(gsrc)) fail('GAME: a second finger can start a board tap');
        if (!/if \(o\.axis === 'y'\) P\.place\(orig\.x, o\.snapY\(orig\.y \+ dy\)\);/.test(gsrc)) fail('GAME: the ✂️ no longer snaps to a grid line while it is dragged');
        ['stack', 'read', 'cut', 'sort'].forEach(t => need(t, /useTapSelect\(B, function\(P, pt\)\{/, 'the round has no tap-then-tap alternative'));
        /* 畫出來的圖就是那一題的資料（codex 第一輪 #5）：格線與數字、一格一格的長條、表格的數字都從同一份 e.vals／ch 來 */
        if (!/lines\.forEach\(function\(L\)\{\s*if \(L\.r > top\) return;\s*svg\.appendChild\(svgEl\('line', \{ x1:ch\.x0, y1:L\.y, x2:ch\.x1, y2:L\.y,[\s\S]{0,260}t\.textContent = String\(L\.r\);/.test(gsrc)) fail('GAME: the grid lines and their numbers are not drawn from gChart()');
        if (!/for \(var r = 0; r < vals\[c\.i\]; r\+\+\)\s*gRect\(svg, c\.x, ch\.y1 - \(r \+ 1\) \* ch\.cellH, c\.w, ch\.cellH,/.test(gsrc)) fail('GAME: the bars are not drawn cell by cell from the bottom line');
        if (!/addZone\(B, c\.sx, y \+ h, ch\.slot, h, 'glbl gl-num', String\(e\.vals\[c\.i\]\)\);/.test(gsrc)) fail('GAME: the table does not print the round\'s own values');
        need('stack', /gBars\(svg, ch, have, /, 'the stacked chart does not show what was stacked');
        need('stack', /gTable\(B, ch, e\);/, 'the stack round has no table');
        need('read', /gGrid\(svg, ch\);\s*gBars\(svg, ch, e\.vals\);\s*gItems\(svg, ch, e\.keys\);/, 'the chart to read is not the round\'s own values on a numbered grid');
        need('cut', /gTable\(B, ch, e\);/, 'the cut round has no table');
        need('cut', /gGrid\(svg, ch, need\);\s*gBars\(svg, ch, e\.vals,/, 'after the cut the bars drawn are not the table\'s values on the cut grid');
        need('two', /gGrid\(svg, ch\);\s*gBars\(svg, ch, e\.vals\);\s*gItems\(svg, ch, e\.keys\);/, 'the chart to work from is not the round\'s own values on a numbered grid');
        ['GAME_STACK', 'GAME_READ', 'GAME_CUT', 'GAME_SEG', 'GAME_TWO'].forEach(k => {
          if (!Array.isArray(D[k]) || D[k].length < 4) fail('GAME: ' + k + ' should be a pool of at least 4 entries');
        });

        /* --- 計分：沒犯錯 +20、犯過錯 +10；放錯一次 −5，最低 0（§三 中年級） --- */
        {
          const rs = extractFunction(gsrc, 'roundSolved');
          if (!rs || !/elHint\.textContent = '';/.test(rs)) fail('GAME: roundSolved() does not clear the hint — a level-2 hint ("still N cells to go") stays on the solved board');
        }
        if (!/var pts = gMistake \? 10 : 20;/.test(gsrc)) fail('GAME scoring: a round should give +20 with no mistakes and +10 after mistakes');
        {
          const fsrc = extractFunction(gsrc, 'roundMiss');
          if (!fsrc) fail('GAME scoring: cannot find roundMiss() in index.html');
          else [[0, 0, false], [5, 0, true], [20, 15, true]].forEach(([s0, want, shows]) => {
            let r;
            try { r = new Function('var gMistake = false, gScore = ' + s0 + ', elScore = {}, gMsg = {}; function L(){ return { gMinus:"@MINUS@" }; }\n' + fsrc + '\nroundMiss("why"); return { s:gScore, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistake };')(); }
            catch (e){ return fail('GAME scoring: roundMiss() could not run: ' + e.message); }
            if (r.s !== want || String(r.shown) !== String(want)) fail('GAME scoring: a mistake at ' + s0 + ' leaves ' + r.s + ' — a mistake does not cost 5 (floored at 0)');
            if ((r.html.indexOf('@MINUS@') >= 0) !== shows) fail('GAME scoring: at ' + s0 + ' points the "−5" note is ' + (shows ? 'missing' : 'shown although nothing was taken'));
            if (r.html.indexOf('why') < 0 || !r.m) fail('GAME scoring: roundMiss() does not show the reason or record the mistake');
          });
        }
        /* 打字的寫法不對只是提醒：不可以走 roundMiss（不扣分、不記錯） */
        need('two', /if \(v === null\)\{ roundNote\(d\.gTwoBadInput\); return; \}/, 'a badly written number is not just a reminder');
        if (/function roundNote\(text\)\{[^}]*(gMistake|gScore)/.test(gsrc)) fail('GAME: roundNote() changes the score or records a mistake');
        LANGS.forEach(L => {
          const d = I18N[L];
          if (nums(d.gPts(20)).join() !== '20' || nums(d.gPts(10)).join() !== '10') fail('GAME gPts ' + L + ' does not show the points');
          if (nums(d.gMinus).join() !== '5') fail('GAME gMinus ' + L + ' should say 5');
          say('gWin', L, d.gWin(85), [85]);
          say('gClear', L, d.gClear, []);
        });

        /* --- shuffle()：切出來真的跑，必須是排列、而且真的會換順序 --- */
        let shuffleFn = null;
        {
          const fsrc = extractFunction(gsrc, 'shuffle');
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
        }

        /* --- nearestOpen()：從原始碼切出來真的跑 --- */
        let nearestOpen = null;
        {
          const fsrc = extractFunction(gsrc, 'nearestOpen');
          if (!fsrc) fail('GAME: cannot find nearestOpen() in index.html');
          else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('GAME: nearestOpen() could not be evaluated: ' + e.message); } }
          if (nearestOpen){
            const two = [{ id:0, cx:100, cy:100, hw:60, hh:20 }, { id:1, cx:170, cy:100, hw:10, hh:10 }];
            const r0 = nearestOpen(two, { x:155, y:100 }, 6);
            if (!r0 || r0.id !== 0) fail('GAME nearestOpen(): a point inside the big box near the small one is given to the small one (measure to the box, not the centre)');
            const done = [{ id:0, cx:100, cy:100, hw:20, hh:20, done:true }, { id:1, cx:142, cy:100, hw:20, hh:20 }];
            if (nearestOpen(done, { x:119, y:100 }, 6) !== null) fail('GAME nearestOpen(): a drop nearest to a finished slot skips it and lands in the next slot');
            if (nearestOpen(done, { x:300, y:300 }, 6) !== null) fail('GAME nearestOpen(): a drop far from every slot is accepted');
            const edge = [{ id:0, cx:100, cy:100, hw:20, hh:20 }];
            if (!nearestOpen(edge, { x:125.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop inside the pad is refused');
            if (nearestOpen(edge, { x:126.5, y:100 }, 6)) fail('GAME nearestOpen(): a drop outside the pad is accepted');
          }
        }
        /* 自己的「最近的方框」：到方框的距離最小；一樣近比到中心 */
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
        /* 一整片區域每 0.5px 問頁面的 nearestOpen 和自己的 nearestBox；重疊的地方（兩個以上的方框收得到）至少要有幾個點 */
        const sweep = (what, list, pad, x0, x1, y0, y1, minOverlap) => {
          if (!nearestOpen) return;
          let n = 0, overlap = 0;
          for (let y = y0; y <= y1; y += 0.5) for (let x = x0; x <= x1; x += 0.5){
            const p = { x:x, y:y }, got = nearestOpen(list, p, pad), want = nearestBox(list, p, pad);
            if (got !== want){ fail('GAME ' + what + ': a drop at (' + x + ', ' + y + ') goes to ' + (got ? got.i : 'nothing') + ', the nearest box is ' + (want ? want.i : 'nothing')); return; }
            /* 嚴格在兩個放寬的方框裡面才算重疊 —— 只是共用一條邊不算（不然沒有 pad 的相鄰方框也會被算成重疊） */
            if (list.filter(b => Math.abs(x - b.cx) < b.hw + pad && Math.abs(y - b.cy) < b.hh + pad).length > 1) overlap++;
            n++;
          }
          if (overlap < minOverlap) fail('GAME ' + what + ': only ' + overlap + ' of ' + n + ' sampled points lie where two padded boxes overlap — the nearest-box rule is never exercised');
        };

        /* --- 遊戲裡的統計圖：自己的排版（格線由上往下算：y ＝ y0 ＋ (rows − r) × cellH） --- */
        const GCH_REF = { x0:40, numDx:7, gap:0.3, itemDy:20 };
        for (const k of Object.keys(GCH_REF)) if (D.GCH[k] !== GCH_REF[k]) fail('GAME: GCH.' + k + ' is ' + D.GCH[k] + ', the spec says ' + GCH_REF[k]);
        const checkChart = (what, n, rows, x1, y0, cellH, H) => {
          const ch = D.gChart(n, rows, x1, y0, cellH), slot = (x1 - GCH_REF.x0) / n;
          if (ch.rows !== rows || ch.lines.length !== rows + 1 || ch.cols.length !== n){ fail('GAME ' + what + ': gChart() has ' + ch.lines.length + ' lines and ' + ch.cols.length + ' columns'); return ch; }
          ch.lines.forEach(Lr => { if (Math.abs(Lr.y - (y0 + (rows - Lr.r) * cellH)) > EPSG) fail('GAME ' + what + ': grid line ' + Lr.r + ' sits at y=' + Lr.y + ', the reference gives ' + (y0 + (rows - Lr.r) * cellH)); });
          /* ⚠️ 圖決定得了答案：v 格高的長條，頂端一定剛好在第 v 條格線上 */
          for (let v = 0; v <= rows; v++)
            if (Math.abs(D.gBarTop(ch, v) - (y0 + (rows - v) * cellH)) > EPSG) fail('GAME ' + what + ': a bar ' + v + ' cells tall does not top out on grid line ' + v);
          ch.cols.forEach((c, i) => {
            const sx = GCH_REF.x0 + i * slot;
            if (Math.abs(c.sx - sx) > EPSG || Math.abs(c.cx - (sx + slot / 2)) > EPSG) fail('GAME ' + what + ': column ' + i + ' is not centred in its own slot');
            if (!(c.x > c.sx + 2 && c.x + c.w < c.sx + slot - 2 && Math.abs(c.x + c.w / 2 - c.cx) < EPSG)) fail('GAME ' + what + ': bar ' + i + ' is not inside its slot with a gap on both sides');
          });
          if (Math.abs(ch.itemY - (y0 + rows * cellH + GCH_REF.itemDy)) > EPSG) fail('GAME ' + what + ': the item names are not ' + GCH_REF.itemDy + 'px under the axis');
          if (y0 - 6.5 < 0 || ch.itemY + 4 > H) fail('GAME ' + what + ': the top axis number or the item names fall off the board');
          if (!(cellH * scale >= 16)) fail('GAME ' + what + ': cells are only ' + (cellH * scale).toFixed(1) + 'px tall on a phone — too small to count');
          return ch;
        };
        /* 一份題庫資料：項目在字典裡、單位詞在 UNIT 裡、數值是 0 ～ rows 的整數 */
        const checkSet = (what, e, n, rows) => {
          if (!e || !Array.isArray(e.keys) || !Array.isArray(e.vals) || e.keys.length !== n || e.vals.length !== n){ fail('GAME ' + what + ': needs ' + n + ' items and ' + n + ' values'); return false; }
          if (!UNIT_REF.zh[e.id] || INDEX_UNIT_KEYS.indexOf(e.id) < 0) fail('GAME ' + what + ': scenario ' + e.id + ' is not one the lesson page names');
          e.keys.forEach(k => LANGS.forEach(L => { if (!ITEM_REF[L][k] || I18N[L].item[k] !== ITEM_REF[L][k]) fail('GAME ' + what + ': item ' + k + ' has no pinned ' + L + ' name'); }));
          if (!e.vals.every(v => Number.isInteger(v) && v >= 0 && v <= rows)){ fail('GAME ' + what + ': values ' + e.vals + ' do not fit a ' + rows + '-cell grid'); return false; }
          return true;
        };
        /* 表格（第 1、3 關）：兩排放得進圖的上面；每一格的字放得進那一欄 */
        const checkTable = (what, ch, sets) => {
          const T = D.GTBL;
          if (!(T.y >= 0 && T.y + 2 * T.rowH <= ch.y0 - 8)) fail('GAME ' + what + ': the table runs into the top of the chart');
          LANGS.forEach(L => {
            fits(I18N[L].gTblItem, 11, ch.x0 - 4, what + ' table header (' + L + ')');
            fits(I18N[L].gTblCount, 11, ch.x0 - 4, what + ' table header (' + L + ')');
            sets.forEach(e => e.keys.forEach(k => fits(itemOf(L, k), 13, ch.slot - 2, what + ' table name (' + L + ')')));
          });
          if (!/\.glbl\.gl-head\{[^}]*font-size:11px/.test(gsrc) || !/\.glbl\.gl-name\{font-size:13px\}/.test(gsrc)) fail('GAME: the table header / names are not drawn at 11px / 13px, so the width checks above are not about what is drawn');
        };
        const itemNamesFit = (what, ch, sets) => LANGS.forEach(L => sets.forEach(e => e.keys.forEach(k => fits(itemOf(L, k), 13, ch.slot - 2, what + ' item name under the axis (' + L + ')'))));

        /* ===== 第 1 關：疊長條 ===== */
        {
          const S = D.STACK, H = D.STACK_H, ch = checkChart('stack', 4, S.rows, S.x1, S.y0, S.cellH, H);
          checkTable('stack', ch, D.GAME_STACK);
          itemNamesFit('stack', ch, D.GAME_STACK);
          const blk = sq(150, S.blockY, 56, D.GPICK);
          inside(blk, 'stack: the cell block', H);
          tooSmall('stack: the cell block', Math.min(56, D.GPICK));
          need('stack', /addPiece\(B, \{ w:56, h:GPICK, cx:150, cy:STACK\.blockY, cls:'gblock'/, 'the cell block is not 56 × GPICK in the middle of the tray');
          if (!new RegExp('\\.gblock::after\\{[^}]*width:44px;height:' + S.cellH + 'px').test(gsrc) || Math.abs(ch.barW - 44) > 1) fail('GAME stack: the block drawn in the tray is not the size of one cell on the chart');
          const zones = D.stackCols(ch);
          zones.forEach((z, i) => {
            if (Math.abs(z.cx - ch.cols[i].cx) > EPSG || Math.abs(z.hw - ch.slot / 2) > EPSG) fail('GAME stack: column ' + i + '\'s drop zone is not exactly its slot');
            if (!(z.cy - z.hh <= D.GTBL.y && z.cy + z.hh >= ch.itemY + 4)) fail('GAME stack: column ' + i + '\'s drop zone does not cover the table cell, the bar and the name');
            if (hit(zbox(z, S.pad), blk)) fail('GAME stack: column ' + i + '\'s drop zone reaches the block in the tray');
          });
          if (!(S.pad > 0)) fail('GAME stack: no pad, so the columns\' zones never overlap and the nearest-column rule is never exercised');
          sweep('stack drop zones', zones, S.pad, 30, 300, 0, 300, 400);
          need('stack', /var z = nearestOpen\(zones, pt, STACK\.pad\);\s*if \(!z\) return false;/, 'a drop is not given to the nearest column (or a miss is not silent)');
          need('stack', /var i = z\.i, why = stackRefuse\(e\.vals, have, i\), name = d\.item\[e\.keys\[i\]\];\s*if \(why\)\{ roundMiss\(why === 'zero' \? d\.gStackZero\(name, unit\) : d\.gStackFull\(name, e\.vals\[i\], unit\)\); return false; \}\s*have\[i\]\+\+;/, 'a full column (or a 0 column) still takes another cell, the column judged is not the one dropped on, or the reason does not match');
          need('stack', /if \(doneN\(\) === todo\)\{/, 'the round does not finish when every column matches the table');
          need('stack', /if \(pt\.tap\)\{ B\.selected = P; P\.el\.classList\.add\('sel'\); \}/, 'the block does not stay selected after a tap-then-tap placement');
          need('stack', /var have = e\.vals\.map\(function\(\)\{ return 0; \}\);/, 'the chart does not start empty');
          let zeros = 0, plain = 0;
          D.GAME_STACK.forEach((e, ei) => {
            if (!checkSet('stack[' + ei + ']', e, 4, S.rows - 1)) return;
            const todo = e.vals.filter(v => v > 0).length, sum = e.vals.reduce((a, b) => a + b, 0);
            if (todo < 3) fail('GAME stack[' + ei + ']: only ' + todo + ' bars to stack');
            if (sum > 16) fail('GAME stack[' + ei + ']: ' + sum + ' cells to stack — too many drags for one round');
            if (e.vals.indexOf(0) >= 0) zeros++; else plain++;
            /* 照規則玩一遍：每一欄疊到表上的數字，每一格都收；再多疊一格 → 不收、說為什麼 */
            const have = [0, 0, 0, 0];
            for (let i = 0; i < 4; i++){
              for (let k = 0; k < e.vals[i]; k++){
                if (D.stackRefuse(e.vals, have, i) !== null) fail('GAME stack[' + ei + ']: stackRefuse() refuses column ' + i + ' at ' + k + ' cells, before it reaches ' + e.vals[i]);
                have[i]++;
                LANGS.forEach(L => say('gStack2', L, I18N[L].gStack2(itemOf(L, e.keys[i]), e.vals[i], k, UNIT_REF[L][e.id]), [e.vals[i], k, e.vals[i] - k]));
              }
              LANGS.forEach(L => {
                const name = itemOf(L, e.keys[i]), u = UNIT_REF[L][e.id];
                const ref = D.stackRefuse(e.vals, have, i), want = e.vals[i] === 0 ? 'zero' : 'full';
                if (ref !== want) fail('GAME stack[' + ei + ']: stackRefuse() says "' + ref + '" for one cell more than ' + e.vals[i] + ' on column ' + i + ', it should be "' + want + '"');
                if (e.vals[i] === 0){ say('gStackZero', L, I18N[L].gStackZero(name, u), [0, 0]); means('stack', 'zero', L, I18N[L].gStackZero(name, u)); }
                else { say('gStackFull', L, I18N[L].gStackFull(name, e.vals[i], u), [e.vals[i], e.vals[i]]); means('stack', 'full', L, I18N[L].gStackFull(name, e.vals[i], u)); }
              });
            }
            if (have.join() !== e.vals.join()) fail('GAME stack[' + ei + ']: replaying the rules does not end with the table');
            LANGS.forEach(L => {
              for (let n = 0; n <= todo; n++) say('gStackNow', L, I18N[L].gStackNow(n, todo), [n, todo]);
              say('gStackDone', L, I18N[L].gStackDone(e.vals.map(String)), e.vals);
            });
          });
          if (zeros < 2 || plain < 2) fail('GAME stack: the pool needs at least two tables with a 0 item (the "stack nothing" case) and two without — got ' + zeros + ' and ' + plain);
        }

        /* ===== 第 2 關：讀回表格 ===== */
        {
          const S = D.READ, H = D.READ_H, ch = checkChart('read', 4, S.rows, S.x1, S.y0, S.cellH, H);
          itemNamesFit('read', ch, D.GAME_READ);
          const slots = D.readSlots(ch), cols = D.readCols(ch);
          slots.forEach((z, i) => {
            if (Math.abs(z.cx - ch.cols[i].cx) > EPSG) fail('GAME read: box ' + i + ' is not under its bar');
            if (Math.abs(z.hw * 2 - S.slotW) > EPSG || Math.abs(z.hh * 2 - S.slotH) > EPSG) fail('GAME read: box ' + i + ' is not slotW × slotH');
            inside(zbox(z), 'read: box ' + i, H);
            tooSmall('read: a box to drop a card in', Math.min(S.slotW, S.slotH));
            if (!(z.cy - z.hh > ch.itemY + 6)) fail('GAME read: box ' + i + ' runs into the item names');
          });
          noHits(slots.map(z => zbox(z)), 'read: boxes');
          cols.forEach((z, i) => {
            if (Math.abs(z.cx - ch.cols[i].cx) > EPSG || Math.abs(z.hw - ch.slot / 2) > EPSG) fail('GAME read: bar ' + i + '\'s drop zone is not its slot');
            if (!(z.cy - z.hh <= ch.y0 - ch.cellH / 2 + EPSG && z.cy + z.hh >= ch.itemY + 4)) fail('GAME read: bar ' + i + '\'s drop zone does not cover the whole bar up to the top line and its name');
            if (hit(zbox(z), zbox(slots[i]))) fail('GAME read: bar ' + i + '\'s zone and its box overlap unpadded');
          });
          const keys = [];
          for (let j = 0; j <= 9; j++) keys.push(sq(150 + ((j < 5 ? j : j - 5) - 2) * S.keyStep, S.keysY[j < 5 ? 0 : 1], D.GPICK, D.GPICK));
          keys.forEach((k, j) => inside(k, 'read: digit card ' + j, H));
          noHits(keys, 'read: digit cards');
          tooSmall('read: a digit card', D.GPICK);
          keys.forEach((k, j) => slots.concat(cols).forEach(z => { if (hit(k, zbox(z, S.pad))) fail('GAME read: digit card ' + j + ' sits inside a drop zone'); }));
          need('read', /addPiece\(B, \{ w:GPICK, h:GPICK, cx:150 \+ \(col - 2\) \* READ\.keyStep, cy:READ\.keysY\[row\], text:String\(j\), cls:'gkey', data:\{ v:j \} \}\);/, 'the digit cards are not laid out the way this check assumes');
          sweep('read drop zones', slots.concat(cols), S.pad, 20, 300, 0, 310, 200);
          need('read', /var targets = slots\.concat\(cols\);/, 'the bars themselves are no longer drop targets');
          need('read', /var i = z\.i, v = e\.vals\[i\], x = P\.data\.v, name = d\.item\[e\.keys\[i\]\], why = readRefuse\(e\.vals, i, x\);\s*if \(why\)\{\s*roundMiss\(why === 'zero' \? d\.gReadZero\(name, x\) : why === 'line' \? d\.gReadLine\(name, x\) : why === 'high' \? d\.gReadHigh\(name, x\) : d\.gReadLow\(name, x\)\);\s*return false;/, 'a wrong card is accepted (the value judged is not the card dropped, or not the item dropped on), or its reason is not the one readRefuse() picked');
          need('read', /slots\[i\]\.done = cols\[i\]\.done = true;/, 'a filled item can be filled again through its bar');
          need('read', /gGrid\(svg, ch\);\s*gBars\(svg, ch, e\.vals\);/, 'the chart is not drawn with its numbered grid');
          let zeros = 0;
          D.GAME_READ.forEach((e, ei) => {
            if (!checkSet('read[' + ei + ']', e, 4, Math.min(S.rows, 9))) return;
            if (e.vals.indexOf(0) >= 0) zeros++;
            if (e.vals.filter(v => v > 0 && v + 1 <= 9).length < 2) fail('GAME read[' + ei + ']: the "counted the lines" card cannot be tried on enough bars');
            e.vals.forEach((v, i) => {
              if (D.readRefuse(e.vals, i, v) !== null) fail('GAME read[' + ei + ']: readRefuse() refuses the right card ' + v + ' for item ' + i);
              for (let x = 0; x <= 9; x++){
                if (x === v) continue;
                const want = v === 0 ? 'zero' : x === v + 1 ? 'line' : x > v ? 'high' : 'low';
                const got = D.readWhy(v, x), gotR = D.readRefuse(e.vals, i, x);
                if (got !== want){ fail('GAME read: readWhy(' + v + ', ' + x + ') is "' + got + '", the reason should be "' + want + '"'); continue; }
                if (gotR !== want){ fail('GAME read: readRefuse() for card ' + x + ' on a bar of ' + v + ' is "' + gotR + '", it should be "' + want + '"'); continue; }
                /* 理由的話要對：說「頂端在 x 那一條線的下面」就真的要 v < x */
                if ((want === 'high' && !(v < x)) || (want === 'low' && !(v > x))) fail('GAME read: the reason for ' + x + ' on a bar of ' + v + ' says the wrong side of the line');
                LANGS.forEach(L => {
                  const name = itemOf(L, e.keys[i]), d = I18N[L];
                  if (want === 'zero') say('gReadZero', L, d.gReadZero(name, x), [0, 0, x]);
                  else if (want === 'line') say('gReadLine', L, d.gReadLine(name, x), [x, 0]);
                  else if (want === 'high') say('gReadHigh', L, d.gReadHigh(name, x), [x, x]);
                  else say('gReadLow', L, d.gReadLow(name, x), [x, x]);
                  means('read', want, L, { zero:d.gReadZero, line:d.gReadLine, high:d.gReadHigh, low:d.gReadLow }[want](name, x));
                });
              }
              LANGS.forEach(L => {
                say('gReadOk', L, I18N[L].gReadOk(itemOf(L, e.keys[i]), v, UNIT_REF[L][e.id]), [v, v]);
                say('gRead2', L, I18N[L].gRead2(itemOf(L, e.keys[i]), v), [v]);
              });
            });
            LANGS.forEach(L => {
              for (let n = 0; n <= 4; n++) say('gReadNow', L, I18N[L].gReadNow(n, 4), [n, 4]);
              say('gReadDone', L, I18N[L].gReadDone(e.vals.map(String)), e.vals);
            });
          });
          if (zeros < 2) fail('GAME read: the pool needs at least two charts with a 0 bar (the "no cells is 0" case)');
        }

        /* ===== 第 3 關：剪格子紙 ===== */
        {
          const S = D.CUTP, H = D.CUTP_H, ch = checkChart('cut', 4, S.rows, S.x1, S.y0, S.cellH, H);
          checkTable('cut', ch, D.GAME_CUT);
          itemNamesFit('cut', ch, D.GAME_CUT);
          for (let k = 0; k <= S.rows; k++){
            const sc = sq(S.scisX, D.gBarTop(ch, k), D.GPICK, D.GPICK);
            inside(sc, 'cut: the ✂️ at line ' + k, H);
            if (sc.x <= ch.x1 + 1) fail('GAME cut: the ✂️ covers the paper');
          }
          tooSmall('cut: the ✂️', D.GPICK);
          /* 每一條線管它上下各半格：點、拖到哪裡，就是最近的那一條（自己的判斷：由上往下數） */
          for (let y = ch.y0 - ch.cellH; y <= ch.y1 + ch.cellH; y += 0.25){
            const t = (y - ch.y0) / ch.cellH, frac = t - Math.floor(t);
            if (Math.abs(frac - 0.5) < 1e-6) continue;   /* 正好在兩條線中間：兩條一樣近，不判 */
            const want = Math.max(0, Math.min(S.rows, S.rows - Math.round(t)));
            if (D.cutLevel(ch, y) !== want){ fail('GAME cut: a ✂️ at y=' + y + ' goes to line ' + D.cutLevel(ch, y) + ', the nearest line is ' + want); break; }
          }
          for (let k = 0; k <= S.rows; k++){
            const y = D.gBarTop(ch, k);
            [-0.49, -0.35, 0, 0.35, 0.49].forEach(f => [2, ch.x0 - 10, (ch.x0 + ch.x1) / 2, ch.x1].forEach(x => {
              if (!D.cutOnPaper(ch, { x:x, y:y + f * ch.cellH })) fail('GAME cut: a tap ' + f + ' of a cell from line ' + k + ' at x=' + x + ' is not counted as a tap on the paper');
            }));
          }
          if (D.cutOnPaper(ch, { x:S.scisX - D.GPICK / 2 + 2, y:(ch.y0 + ch.y1) / 2 })) fail('GAME cut: a tap in the ✂️ column moves the ✂️ — the paper zone reaches under it');
          /* 整張格子紙（含縱軸數字、上下各半格）每 0.5px 都要算點到；格子紙右邊（✂️ 那一欄）一點都不算（codex 第一輪 #7） */
          {
            let holes = 0, leaks = 0, firstHole = null;
            for (let y = ch.y0 - ch.cellH / 2; y <= ch.y1 + ch.cellH / 2 + EPSG; y += 0.5){
              for (let x = 0; x <= ch.x1 + EPSG; x += 0.5) if (!D.cutOnPaper(ch, { x:x, y:y })){ holes++; if (!firstHole) firstHole = x + ',' + y; }
              for (const x of [ch.x1 + 1e-6, ch.x1 + 0.1, ch.x1 + 0.25]) if (D.cutOnPaper(ch, { x:x, y:y })) leaks++;   /* 緊貼右緣（codex 第二輪） */
              for (let x = ch.x1 + 0.5; x <= W; x += 0.5) if (D.cutOnPaper(ch, { x:x, y:y })) leaks++;
            }
            if (holes) fail('GAME cut: ' + holes + ' points on the paper are not a tap on the paper (first at ' + firstHole + ')');
            if (leaks) fail('GAME cut: ' + leaks + ' points right of the paper count as a tap on it');
          }
          need('cut', /snapY:function\(y\)\{ return gBarTop\(ch, cutLevel\(ch, y\)\); \}/, 'the ✂️ does not snap to the grid line it is nearest to');
          need('cut', /var top = soleMaxIndex\(e\.vals\), need = gridRows\(e\.vals\), name = d\.item\[e\.keys\[top\]\], k = ch\.rows;/, 'the answer is not the fewest-that-fit, or the ✂️ does not start at the top of the paper');
          need('cut', /if \(scis\.busy\(\)\) return;/, '"Cut" can judge while the ✂️ is still being dragged');
          need('cut', /var why = cutRefuse\(e\.vals, k\);\s*if \(why\)\{ roundMiss\(why === 'few' \? d\.gCutFew\(k, name, need, unit\) : d\.gCutMore\(k\)\); return; \}/, 'a cut other than the fewest-that-fit is accepted, or the reason is on the wrong side');
          /* 判斷的 k 就是畫面上的那一條（codex 第一輪 #4）：✂️ 每停一次就把 k 換成它所在的線，虛線、讀數都畫 k */
          need('cut', /onPlace:function\(P\)\{ var nk = cutLevel\(ch, P\.cy\); if \(nk !== k && !gSolved\)\{ k = nk; draw\(\); \} \} \}\);/, 'the line judged (k) is not updated from where the ✂️ stops');
          need('cut', /var y = gBarTop\(ch, k\);\s*svg\.appendChild\(svgEl\('line', \{ x1:ch\.x0 - 2, y1:y, x2:ch\.x1 \+ 2, y2:y,[\s\S]{0,120}\}\)\);\s*line\.textContent = d\.gCutNow\(k\);/, 'the dashed cut line or the readout does not show the line being judged');
          need('cut', /function setK\(nk\)\{ nk = Math\.max\(0, Math\.min\(ch\.rows, nk\)\); scis\.rehome\(CUTP\.scisX, gBarTop\(ch, nk\)\); \}/, 'tap / ▲ ▼ do not move the ✂️ onto a grid line');
          need('cut', /if \(pt\.tap && !cutOnPaper\(ch, pt\)\) return false;/, 'a tap beside the paper still moves the ✂️');
          /* 全部都是 0 的時候還是要畫 1 格（這一課自己的規則，範例 3 的 s3note）：0 格不算夠、1 格剛好（codex 第二輪 #5 的情形；題庫不會出，規則照樣釘住） */
          if (D.cutRefuse([0, 0, 0, 0], 1) !== null || D.cutRefuse([0, 0, 0, 0], 0) !== 'few') fail('GAME cut: for an all-0 table, cutRefuse() no longer follows the lesson rule "still draw 1 cell"');
          D.GAME_CUT.forEach((e, ei) => {
            if (!checkSet('cut[' + ei + ']', e, 4, S.rows)) return;
            const hi = maxRef(e.vals), at = soleMaxRef(e.vals);
            if (at < 0){ fail('GAME cut[' + ei + ']: the biggest item is not unique, so "the biggest is …" has two answers'); return; }
            if (!(hi >= 2 && hi <= S.rows - 2)) fail('GAME cut[' + ei + ']: the fewest cells (' + hi + ') leaves no "too few" and "too many" on either side, or equals the starting height');
            if (D.gridRows(e.vals) !== rowsRef(e.vals)) fail('GAME cut[' + ei + ']: gridRows disagrees with the reference');
            for (let k = 0; k <= S.rows; k++){
              const refK = k === hi ? null : k < hi ? 'few' : 'more';
              if (D.cutRefuse(e.vals, k) !== refK) fail('GAME cut[' + ei + ']: cutRefuse() at line ' + k + ' is "' + D.cutRefuse(e.vals, k) + '", it should be "' + refK + '" (fewest that fit: ' + hi + ')');
              LANGS.forEach(L => {
                const d = I18N[L], name = itemOf(L, e.keys[at]);
                say('gCutNow', L, d.gCutNow(k), [k, k]);
                if (k < hi){ say('gCutFew', L, d.gCutFew(k, name, hi, UNIT_REF[L][e.id]), [k, hi, k]); means('cut', 'few', L, d.gCutFew(k, name, hi, UNIT_REF[L][e.id])); }
                else if (k > hi){ say('gCutMore', L, d.gCutMore(k), [k]); means('cut', 'more', L, d.gCutMore(k)); }
              });
            }
            LANGS.forEach(L => {
              say('gCutDone', L, I18N[L].gCutDone(hi, itemOf(L, e.keys[at]), UNIT_REF[L][e.id]), [hi, hi]);
              say('gCut2', L, I18N[L].gCut2(itemOf(L, e.keys[at]), hi, UNIT_REF[L][e.id]), [hi]);
            });
          });
        }

        /* ===== 第 4 關：分一分 ===== */
        {
          const S = D.SEG, BN = D.SEG_BIN, H = D.SEG_H, ch = checkChart('sort', 5, S.rows, S.x1, S.y0, S.cellH, H);
          itemNamesFit('sort', ch, D.GAME_SEG);
          if (D.SEG_DIRS.join() !== 'up,down,flat') fail('GAME sort: the baskets should be up, down, flat (left to right)');
          const bins = [0, 1, 2].map(i => ({ i:i, cx:BN.x[i] + BN.w / 2, cy:BN.y + BN.h / 2, hw:BN.w / 2, hh:BN.h / 2 }));
          bins.forEach((b, i) => { inside(zbox(b), 'sort: basket ' + i, H); if (!(b.cy - b.hh >= ch.itemY + 4)) fail('GAME sort: basket ' + i + ' runs into the day names'); });
          noHits(bins.map(b => zbox(b)), 'sort: baskets');
          if (!(BN.pad > BN.x[1] - (BN.x[0] + BN.w))) fail('GAME sort: the padded baskets never overlap, so the nearest-basket rule is never exercised');
          need('sort', /return \{ i:i, cx:BN\.x\[i\] \+ BN\.w \/ 2, cy:BN\.y \+ BN\.h \/ 2, hw:BN\.w \/ 2, hh:BN\.h \/ 2, n:0, done:false \};/, 'the baskets\' drop zones are not the drawn baskets');
          sweep('sort baskets', bins, BN.pad, 0, 300, BN.y - BN.pad - 2, BN.y + BN.h + BN.pad + 2, 100);
          const cards = [0, 1, 2, 3].map(j => sq(D.SEG_TRAY.x[j % 2], D.SEG_TRAY.y[Math.floor(j / 2)], D.SEG_CARD.w, D.SEG_CARD.h));
          cards.forEach((c, j) => { inside(c, 'sort: card ' + j, H); bins.forEach(b => { if (hit(c, zbox(b, BN.pad))) fail('GAME sort: card ' + j + ' starts inside a basket\'s drop zone'); }); });
          noHits(cards, 'sort: cards');
          tooSmall('sort: a card', Math.min(D.SEG_CARD.w, D.SEG_CARD.h));
          need('sort', /addPiece\(B, \{ w:SEG_CARD\.w, h:SEG_CARD\.h, cx:SEG_TRAY\.x\[j % 2\], cy:SEG_TRAY\.y\[Math\.floor\(j \/ 2\)\],/, 'the cards are not laid out the way this check assumes');
          need('sort', /var bin = nearestOpen\(bins, pt, BN\.pad\);\s*if \(!bin\) return false;/, 'a drop is not given to the nearest basket');
          need('sort', /var s = P\.data\.s, bad = sortRefuse\(e\.vals, s, bin\.i\), va = e\.vals\[s\], vb = e\.vals\[s \+ 1\];\s*if \(bad !== null\)\{ roundMiss\(d\.gSegWrong\(nm\(s\), nm\(s \+ 1\), va, vb, SEG_DIRS\[bad\]\)\); return false; \}/, 'a card in the wrong basket is accepted (the stretch or basket judged is not the one dropped), or the reason names the wrong direction');
          need('sort', /text:d\.gSegCard\(nm\(s\), nm\(s \+ 1\)\), cls:'gcard', data:\{ s:s \} \}\);/, 'a card\'s label is not the stretch it is judged as');
          /* 畫出來的每一段：從第 s 天的點連到第 s + 1 天的點（codex 第一輪 #6） */
          need('sort', /var a = ch\.cols\[s\], b = ch\.cols\[s \+ 1\];\s*svg\.appendChild\(svgEl\('line', \{ x1:a\.cx, y1:gBarTop\(ch, e\.vals\[s\]\), x2:b\.cx, y2:gBarTop\(ch, e\.vals\[s \+ 1\]\),/, 'the stretches are not drawn from one day\'s dot to the next day\'s dot');
          need('sort', /segTray\(e\.vals\)\.forEach\(/, 'the tray is not dealt by segTray()');
          need('sort', /cy:gBarTop\(ch, e\.vals\[c\.i\]\), r:DOT_R/, 'the dots are not drawn at the tops of the bars');
          LANGS.forEach(L => ['up', 'down', 'flat'].forEach(dir => fits(I18N[L].gBin[dir], 15, BN.w - 6, 'sort basket label (' + L + ')')));
          let maxPer = 0;
          D.GAME_SEG.forEach((e, ei) => {
            if (!checkSet('sort[' + ei + ']', e, 5, S.rows)) return;
            const dirs = segDirsRef(e.vals);
            ['up', 'down', 'flat'].forEach(w => { if (dirs.indexOf(w) < 0) fail('GAME sort[' + ei + ']: no "' + w + '" stretch, so that basket is never needed'); });
            [0, 1, 2].forEach(b => { maxPer = Math.max(maxPer, dirs.filter(w => w === ['up', 'down', 'flat'][b]).length); });
            for (let s = 0; s < 4; s++){
              if (D.segBin(e.vals, s) !== ['up', 'down', 'flat'].indexOf(dirs[s])) fail('GAME sort[' + ei + ']: segBin() puts stretch ' + s + ' in the wrong basket');
              for (let b = 0; b < 3; b++){
                const refB = b === ['up', 'down', 'flat'].indexOf(dirs[s]) ? null : ['up', 'down', 'flat'].indexOf(dirs[s]);
                if (D.sortRefuse(e.vals, s, b) !== refB) fail('GAME sort[' + ei + ']: sortRefuse() for stretch ' + s + ' in basket ' + b + ' is ' + D.sortRefuse(e.vals, s, b) + ', it should be ' + refB);
              }
              const va = e.vals[s], vb = e.vals[s + 1];
              LANGS.forEach(L => {
                const d = I18N[L], a = itemOf(L, e.keys[s]), b = itemOf(L, e.keys[s + 1]);
                const card = d.gSegCard(a, b);
                fits(card, 15, D.SEG_CARD.w - 10, 'sort card (' + L + ')');
                fits(card, 13, BN.w - 16, 'sort card in a basket (' + L + ')');
                say('gSegWrong', L, d.gSegWrong(a, b, va, vb, dirs[s]), [va, vb]);
                /* 理由要說對方向：往上的一段說「變高、變多」，不可以說成別的 */
                const w = d.gSegWrong(a, b, va, vb, dirs[s]), words = L === 'zh' ? { up:'變多', down:'變少', flat:'沒有變' } : { up:'more', down:'fewer', flat:'nothing changed' };
                for (const k of ['up', 'down', 'flat']) if ((w.indexOf(words[k]) >= 0) !== (k === dirs[s])) fail('GAME sort (' + L + '): the reason for ' + a + ' → ' + b + ' does not say only "' + words[dirs[s]] + '": ' + w);
                say('gSegOk', L, d.gSegOk(a, b, dirs[s], Math.abs(vb - va), UNIT_REF[L][e.id]), dirs[s] === 'flat' ? [] : [Math.abs(vb - va)]);
                say('gSeg2', L, d.gSeg2(a, b, va, vb), [va, vb]);
              });
            }
            /* 托盤：每一次都是 0～3 的排列，而且從來不是照籃子的順序 */
            for (let t = 0; t < 3000; t++){
              const tr = D.segTray(e.vals);
              if (tr.slice().sort().join() !== '0,1,2,3'){ fail('GAME sort[' + ei + ']: segTray() is not a permutation of the four stretches'); break; }
              const bs = tr.map(s => ['up', 'down', 'flat'].indexOf(dirs[s]));
              if (bs.every((b, k) => k === 0 || bs[k - 1] <= b)){ fail('GAME sort[' + ei + ']: segTray() dealt the cards already in basket order (' + tr + ')'); break; }
            }
          });
          LANGS.forEach(L => { for (let n = 0; n <= 4; n++) say('gSortNow', L, I18N[L].gSortNow(n, 4), [n, 4]); say('gSortDone', L, I18N[L].gSortDone, []); });
          if (BN.first - 13 < BN.y + BN.lbl || BN.first + (maxPer - 1) * BN.step + 13 > BN.y + BN.h - 2) fail('GAME sort: ' + maxPer + ' sorted cards do not fit inside one basket under its label');
        }

        /* ===== 第 5 關：算一算 ===== */
        {
          const S = D.TWO, H = D.TWO_H, ch = checkChart('two', 4, S.rows, S.x1, S.y0, S.cellH, H);
          itemNamesFit('two', ch, D.GAME_TWO);
          const kinds = { total:0, gap:0 };
          D.GAME_TWO.forEach((e, ei) => {
            if (!checkSet('two[' + ei + ']', e, 4, S.rows)) return;
            if (!(e.kind in kinds)){ fail('GAME two[' + ei + ']: kind ' + e.kind); return; }
            kinds[e.kind]++;
            const hi = maxRef(e.vals), lo = minRef(e.vals), sum = sumRef(e.vals), want = e.kind === 'total' ? sum : hi - lo;
            if (D.twoAnswer(e) !== want) fail('GAME two[' + ei + ']: twoAnswer() is ' + D.twoAnswer(e) + ', the reference gives ' + want);
            if (e.kind === 'gap'){
              if (soleMaxRef(e.vals) < 0 || soleMinRef(e.vals) < 0) fail('GAME two[' + ei + ']: "the most" or "the least" is not unique');
              if (lo < 1) fail('GAME two[' + ei + ']: the least is 0, so "only wrote the most" is also the right answer');
            } else if (e.vals.filter(v => v > 0).length < 2) fail('GAME two[' + ei + ']: the total is just one bar');
            /* 照規則打 0～60 每一個數：只有正解收；每一個錯的數都有一句對的理由 */
            for (let n = 0; n <= 60; n++){
              if (n === want) continue;
              const ref = (e.kind === 'total' && n === hi) ? 'tall' : (e.kind === 'gap' && n === hi + lo) ? 'sum' : (e.kind === 'gap' && n === hi) ? 'most' : n > want ? 'high' : 'low';
              const got = D.twoWhy(e, n);
              if (got !== ref){ fail('GAME two[' + ei + ']: twoWhy(' + n + ') is "' + got + '", it should be "' + ref + '"'); continue; }
              if ((ref === 'high' && !(n > want)) || (ref === 'low' && !(n < want))) fail('GAME two[' + ei + ']: ' + n + ' is called too ' + ref);
              LANGS.forEach(L => {
                const d = I18N[L], f = { tall:d.gTwoTall, sum:d.gTwoSum, most:d.gTwoMost, high:d.gTwoHigh, low:d.gTwoLow }[ref];
                if (n % 7 === 0 || ref !== 'high') say('gTwo.' + ref, L, f(n), [n]);
                means('two', ref, L, f(n));
              });
            }
            LANGS.forEach(L => {
              const d = I18N[L], u = UNIT_REF[L][e.id];
              say('gTwoAsk.' + e.kind, L, d.gTwoAsk[e.kind](u));
              if (e.kind === 'total'){
                say('gTwoDoneTotal', L, d.gTwoDoneTotal(e.vals.map(String), sum, u), e.vals.concat([sum, sum]));
                say('gTwo2.total', L, d.gTwo2.total(e.vals.map(String)), e.vals);
              } else {
                say('gTwoDoneGap', L, d.gTwoDoneGap(hi, lo, u), [hi, lo, hi - lo, hi - lo]);
                say('gTwo2.gap', L, d.gTwo2.gap(hi, lo), [hi, lo]);
              }
            });
          });
          if (kinds.total < 2 || kinds.gap < 2) fail('GAME two: the pool needs at least two "altogether" and two "most minus least" charts, got ' + kinds.total + ' / ' + kinds.gap);
          /* 打字：只收寫法正常的整數 */
          const TT = [['12', 12], [' 12 ', 12], ['0', 0], ['7', 7], ['012', null], ['1 2', null], ['1.5', null], ['', null], ['-3', null], ['１２', null], ['12a', null], ['1000', null]];
          TT.forEach(([s, w]) => { if (D.parseCount(s) !== w) fail('GAME two: parseCount("' + s + '") is ' + D.parseCount(s) + ', it should be ' + w); });
          need('two', /if \(v === twoAnswer\(e\)\)\{/, 'the typed answer is not compared with twoAnswer()');
          need('two', /var why = twoWhy\(e, v\);\s*lastBad = v;\s*roundMiss\(why === 'tall' \? d\.gTwoTall\(v\) : why === 'sum' \? d\.gTwoSum\(v\) : why === 'most' \? d\.gTwoMost\(v\) : why === 'high' \? d\.gTwoHigh\(v\) : d\.gTwoLow\(v\)\);/, 'a wrong number is accepted, or its reason is not the one twoWhy() picked');
          need('two', /inp\.setAttribute\('inputmode', 'numeric'\)/, 'the answer box does not bring up the number pad on a phone');
          need('two', /var v = parseCount\(inp\.value\);/, 'the number judged is not what is in the answer box');
          need('two', /if \(ev\.key === 'Enter' && !ev\.repeat\) submit\(\);/, 'a held Enter key hands the same answer in again and again');
          need('two', /if \(v === lastBad\) return;/, 'handing in the same wrong answer again (a double tap) costs another 5');
          need('two', /lastBad = v;\s*roundMiss\(/, 'the last wrong answer is not remembered');
          LANGS.forEach(L => say('gTwoBadInput', L, I18N[L].gTwoBadInput, [0]));
          if (!/\.ginput\{width:104px;height:52px/.test(gsrc)) fail('GAME two: the answer box is not 104 × 52');
          tooSmall('two: the answer box', 52);
        }
      }

      /* ---- 9. 字典：項目名、情境名、單位詞逐字比對 ---- */
      for (const lang of ['zh', 'en']){
        const d = I18N[lang];
        const usedKeys = [].concat.apply([], DATASETS.map(x => x.keys)).concat(DRAW.keys, LINE.keys);
        for (const k of usedKeys){
          if (!ITEM_REF[lang][k]){ fail('the checker has no pinned name for item ' + k); continue; }
          if (d.item[k] !== ITEM_REF[lang][k])
            fail('the item dictionary (' + lang + ') says "' + d.item[k] + '" for ' + k + ', the checker pins "' + ITEM_REF[lang][k] + '"');
        }
        for (const id of INDEX_UNIT_KEYS){
          if (UNIT[lang][id] !== UNIT_REF[lang][id])
            fail('the unit dictionary (' + lang + ') says "' + UNIT[lang][id] + '" for ' + id + ', the checker pins "' + UNIT_REF[lang][id] + '"');
          if (!d.dsName[id]) fail('scenario ' + id + ' has no name in ' + lang);
        }
        if (Object.keys(UNIT[lang]).length !== INDEX_UNIT_KEYS.length)
          fail('the unit dictionary (' + lang + ') has ' + Object.keys(UNIT[lang]).length + ' entries, the lesson uses ' + INDEX_UNIT_KEYS.length);
      }

      /* ---- 10. 旁白真的渲染出來再掃 ----
         拼接出來的字（'一個' + unit + '換成'）在原始碼裡看不出來會黏在一起。 */
      const narrated = GAME_NARR.slice();   /* 小遊戲的每一句（第 8 段照題庫渲染出來的）一起掃 */
      for (const lang of ['zh', 'en']){
        const d = I18N[lang];
        const push = (tag, s) => narrated.push([tag + ' (' + lang + ')', s, lang]);
        for (const ds of DATASETS){
          const u = UNIT[lang][ds.id];
          push('cap', d.cap(d.dsName[ds.id], u));
          push('capLine', d.capLine(d.dsName[ds.id], u));
          ds.vals.forEach((v, i) => {
            if (v === 0){
              push('s1narrZero', d.s1narrZero(d.item[ds.keys[i]]));
              push('s2narrZero', d.s2narrZero(d.item[ds.keys[i]], u));
            } else {
              push('s1narrCell', d.s1narrCell(d.item[ds.keys[i]], 1, v, u));
              push('s1narrCell', d.s1narrCell(d.item[ds.keys[i]], v, v, u));
              push('s2narr', d.s2narr(d.item[ds.keys[i]], v, u));
            }
            push('s2calc', d.s2calc(v, u));
            push('s2result', d.s2result(d.item[ds.keys[i]], v, u));
          });
        }
        push('s1narrDone', d.s1narrDone);
        push('s1result', d.s1result);
        push('s1narrStart', d.s1narrStart);
        push('s3narrTodo', d.s3narrTodo);
        push('s3resultWin', d.s3resultWin);
        /* 範例 3：三種格數的旁白都要走過一次。 */
        const tall = soleMaxRef(DRAW.vals), du = UNIT[lang][DRAW.id];
        for (const rows of DRAW_ROWS){
          if (rows < need) push('s3rowsTooFew', d.s3rowsTooFew(rows, need, d.item[DRAW.keys[tall]], du));
          else if (rows === need) push('s3rowsJust', d.s3rowsJust(rows, d.item[DRAW.keys[tall]], du));
          else push('s3rowsMore', d.s3rowsMore(rows, need));
          push('s3chip', d.s3chip(rows));
        }
        DRAW.vals.forEach((v, i) => {
          for (const got of [0, 1, v, Math.min(v + 1, 9)])
            push('s3narrOne', d.s3narrOne(d.item[DRAW.keys[i]], got, v, du));
        });
        push('s3resultGo', d.s3resultGo(0, DRAW.vals.length));
        push('s3resultGo', d.s3resultGo(1, DRAW.vals.length));
        /* 範例 4：四段都走一次。 */
        const lu = UNIT[lang][LINE.id];
        for (let i = 0; i + 1 < LINE.vals.length; i++){
          const a = LINE.vals[i], b = LINE.vals[i + 1];
          const dir = dirRef(a, b), delta = Math.abs(b - a);
          push('s4narr', d.s4narr(d.item[LINE.keys[i]], d.item[LINE.keys[i + 1]], a, b, dir, delta, lu));
          push('s4calc', d.s4calc(a, b, dir, delta));
          push('s4result', d.s4result(dir, delta, lu));
          push('s4chip', d.s4chip(d.item[LINE.keys[i]], d.item[LINE.keys[i + 1]]));
        }
        /* 範例 5：三個問題都走一次。 */
        const tds = DATASETS[TWO_DS], tu = UNIT[lang][tds.id];
        const hi = soleMaxRef(twoVals), lo = soleMinRef(twoVals);
        push('s5narrGap', d.s5narrGap(d.item[tds.keys[hi]], twoVals[hi], d.item[tds.keys[lo]], twoVals[lo], tu));
        push('s5calcGap', d.s5calcGap(twoVals[hi], twoVals[lo]));
        push('s5resultGap', d.s5resultGap(twoVals[hi] - twoVals[lo], tu));
        push('s5narrTotal', d.s5narrTotal(twoVals.map(String), tu));
        push('s5calcTotal', d.s5calcTotal(twoVals.map(String), sumRef(twoVals)));
        push('s5resultTotal', d.s5resultTotal(sumRef(twoVals), tu));
        const hits = [];
        twoVals.forEach((v, i) => { if (v > TWO_OVER_K) hits.push(d.item[tds.keys[i]]); });
        push('s5narrOver', d.s5narrOver(TWO_OVER_K, hits, tu));
        push('s5calcOver', d.s5calcOver(TWO_OVER_K, overRef(twoVals, TWO_OVER_K)));
        push('s5resultOver', d.s5resultOver(overRef(twoVals, TWO_OVER_K)));
        for (const k of TWO_QS) push('s5chip', d.s5chip[k]);
        /* 題庫 */
        ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
          d[bank].forEach((q, i) => {
            push(bank + '[' + i + '].stem', q.stem);
            push(bank + '[' + i + '].why', q.why);
            q.opts.forEach((o, oi) => push(bank + '[' + i + '].opt' + oi, o));
          });
        });
      }
      let narratedVerified = 0;
      for (const row of narrated){
        for (const p of textProblems(row[1], row[2], row[0])) fail(p);
        const ar = arithProblems(row[1]);
        for (const p of ar.problems) fail(row[0] + ': ' + p);
        narratedVerified += ar.verified;
      }
      /* 旁白裡至少要有一批真的算式被驗過 —— 全部不含等號的話，
         上面那個迴圈等於什麼都沒驗。 */
      if (narratedVerified < 40)
        fail('only ' + narratedVerified + ' equations in the rendered narration were actually checked — the arithmetic verifier is not reaching the page');

      /* ---- 11. 題庫神諭 ---- */
      ['qs', 'qsAdv', 'qsBoost'].forEach(bank => {
        const want = BANK_EXPECTED[bank];
        if (I18N.zh[bank].length !== want.length)
          fail(bank + ' has ' + I18N.zh[bank].length + ' questions, the oracle pins ' + want.length);
        /* ⚠️ 英文那一半也要數 —— 只數中文的話，刪掉一題英文只會讓下面的
           `if (!qe) return` 靜靜跳過，整題沒有人驗（codex 抓到）。 */
        if (I18N.en[bank].length !== want.length)
          fail(bank + ' (en) has ' + I18N.en[bank].length + ' questions, the oracle pins ' + want.length);
        want.forEach((w, i) => {
          const qz = I18N.zh[bank][i], qe = I18N.en[bank][i];
          if (!qz || !qe) return;
          if (w.stemExact && qz.stem !== w.stemExact)
            fail(bank + '[' + i + '] stem does not match the pinned wording:\n  got  ' + qz.stem + '\n  want ' + w.stemExact);
          /* ⚠️ 英文題幹也逐字釘死。只釘幾個關鍵字的話，把前提**否定**掉
             （「還沒畫完」）照樣通過（codex 第四輪抓到）。 */
          if (w.enStemExact && qe.stem !== w.enStemExact)
            fail(bank + '[' + i + '] (en) stem does not match the pinned wording:\n  got  ' + qe.stem + '\n  want ' + w.enStemExact);
          if (String(qz.opts[qz.ans]) !== String(w.answer))
            fail(bank + '[' + i + '] the answers of the zh bank say "' + qz.opts[qz.ans] + '", the oracle says "' + w.answer + '"');
          const wantEn = w.enAnswer || w.answer;
          if (String(qe.opts[qe.ans]) !== String(wantEn))
            fail(bank + '[' + i + '] the answers of the en bank say "' + qe.opts[qe.ans] + '", the oracle says "' + wantEn + '"');
          const ask = (BANK_ASK[bank] || [])[i];
          if (ask){
            for (const m of ask.must) if (qz.stem.indexOf(m) < 0) fail(bank + '[' + i + '] stem does not match: it never asks "' + m + '"');
            for (const nv of ask.never) if (qz.stem.indexOf(nv) >= 0) fail(bank + '[' + i + '] stem does not match: it asks "' + nv + '" instead');
          }
          /* 英文題幹也要釘 —— 不然英文可以問別的運算而保留同一個答案。 */
          const askEn = (BANK_ASK_EN[bank] || [])[i];
          if (askEn){
            const low = qe.stem.toLowerCase();
            for (const m of askEn.must) if (low.indexOf(m.toLowerCase()) < 0)
              fail(bank + '[' + i + '] (en) stem does not match: it never asks "' + m + '"');
            for (const nv of askEn.never) if (low.indexOf(nv.toLowerCase()) >= 0)
              fail(bank + '[' + i + '] (en) stem does not match: it asks "' + nv + '" instead');
          }
        });
      });
      for (const rc of BANK_RECOMPUTE){
        const q = I18N.zh[rc.bank][rc.i];
        if (!q) continue;
        const nums = (q.stem.replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
        const wantSet = rc.from.slice().sort((a, b) => a - b).join(',');
        const gotSet = nums.slice().sort((a, b) => a - b).join(',');
        if (wantSet !== gotSet){
          fail(rc.bank + '[' + rc.i + '] recomputing from the stem: it prints [' + gotSet + '] but the oracle expects [' + wantSet + ']');
          continue;
        }
        const want = rc.calc(rc.from);
        if (String(q.opts[q.ans]) !== want)
          fail(rc.bank + '[' + rc.i + '] recomputing from the stem gives "' + want + '" but the marked answer is "' + q.opts[q.ans] + '"');
      }

      /* ---- 12. 跨頁：產生器清單與複習頁的版面常數 ----
         ⚠️ 一定要用 process.argv[2] 推出資料夾，不可以用 __dirname ——
            breaktest.js 把四頁複製到暫存目錄再跑，__dirname 會讀到真的 repo，
            針對 reference／review／parents 的斷言就永遠是綠的。 */
      const dir = path.dirname(path.resolve(process.argv[2] || '.'));
      const readSib = name => {
        const p = path.join(dir, name);
        if (!fs.existsSync(p)) return null;
        return fs.readFileSync(p, 'utf8');
      };
      const reviewRaw = readSib('review.html');
      if (reviewRaw === null) fail('[SETUP] review.html is missing next to index.html');
      else {
        const reviewSrc = reviewRaw.replace(/<!--[\s\S]*?-->/g, '');
        const ids = (reviewSrc.match(/^\s*\{ id:'([a-zA-Z]+)', cat:'/gm) || [])
                      .map(s => s.replace(/^\s*\{ id:'/, '').replace(/', cat:'$/, ''));
        if (ids.join(',') !== GEN_IDS.join(','))
          fail('review.html declares generators [' + ids.join(', ') + '], the checker pins [' + GEN_IDS.join(', ') + ']');
        const RV = FIG_REF.review;
        if (reviewSrc.indexOf('var FIG_W = ' + RV.W + ', FIG_H = ' + RV.H + ';') < 0)
          fail('review.html no longer uses the pinned canvas size ' + RV.W + '×' + RV.H);
        /* ⚠️ checkPlan 拿的是**設定檔寫死的**規格，所以複習頁自己的字級與留白
           改掉之後幾何檢查完全沒感覺（改壞測試證明過）。這幾行要逐字釘住。 */
        const RV_LINES = [
          'var PAD_L = ' + RV.PL + ', PAD_R = ' + RV.PR + ', PAD_T = ' + RV.PT + ', PAD_B = ' + RV.PB + ';',
          'var GAP_RATIO = ' + RV.GAP + ';',
          'var AXIS_NUM_DX = ' + RV.NDX + ', AXIS_NUM_FS = ' + RV.NFS + ', ITEM_FS = ' + RV.IFS +
            ', ITEM_DY = ' + RV.IDY + ', DOT_R = ' + RV.DOT + ';'
        ];
        for (const line of RV_LINES)
          if (reviewSrc.indexOf(line) < 0)
            fail('review.html no longer uses the pinned layout constants — expected the line "' + line + '"');
        if (reviewSrc.indexOf("svg.setAttribute('viewBox', '0 0 " + RV.W + ' ' + RV.H + "')") < 0)
          fail('review.html draws into a viewBox that does not match its pinned canvas size');
        if (reviewSrc.indexOf('max-width:' + RV.W + 'px;height:' + RV.H + 'px') < 0)
          fail('the .chartfig CSS size in review.html no longer matches its pinned canvas size');
      }

      /* ---- 13. 跨頁用詞釘樁（含 FORBIDDEN 的那一半） ----
         ⚠️ 先把 HTML 註解拿掉，不然把規則搬進註解就過關了。
         ⚠️ 比「出現幾次」而不是「有沒有出現」：中文字串在這些頁面上一定有兩份
            （markup 的 fallback ＋ 字典），只改其中一份必須要被抓到。 */
      const strip = t => (t === null || t === undefined) ? t : t.replace(/<!--[\s\S]*?-->/g, '');
      const SRC = { index:strip(src), reference:strip(readSib('reference.html')),
                    review:strip(reviewRaw), parents:strip(readSib('parents.html')) };
      for (const rule of SIBLING_RULES){
        const text = SRC[rule.file];
        if (text === null || text === undefined){ fail('[SETUP] ' + rule.file + '.html is missing, so "' + rule.text + '" cannot be checked'); continue; }
        const hits = text.split(rule.text).length - 1;
        if (hits < rule.min)
          fail(rule.file + '.html says "' + rule.text + '" ' + hits + ' time(s), but it ' + rule.why + ' and must appear at least ' + rule.min + ' time(s)');
      }
      for (const rule of FORBIDDEN){
        const text = SRC[rule.file];
        if (text === null || text === undefined) continue;
        if (text.indexOf(rule.text) >= 0)
          fail(rule.file + '.html must never say "' + rule.text + '" — ' + rule.why);
      }
    }
  }
};
