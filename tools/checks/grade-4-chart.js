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

    /* --- 遊戲關卡 --- */
    { file:"index", via:"index", expect:"round 0",
      find:"    { kind:'read', ds:0, at:2, opts:['5', '6', '4', '7'], ans:1 },",
      replace:"    { kind:'read', ds:0, at:2, opts:['5', '6', '4', '7'], ans:0 },",
      why:"the scored answer would no longer be the value the chart shows" },
    { file:"index", via:"index", expect:"round 2",
      find:"    { kind:'rows', ds:2, opts:['6', '4', '9', '8'], ans:3 },",
      replace:"    { kind:'rows', ds:2, opts:['6', '4', '9', '8'], ans:2 },",
      why:"“at least how many cells” would be scored on a taller grid than the fewest" },
    { file:"index", via:"index", expect:"round 3",
      find:"    { kind:'seg',  segAt:3, opts:['up:2', 'down:3', 'up:3', 'flat:0'], ans:2 },",
      replace:"    { kind:'seg',  segAt:3, opts:['up:2', 'down:3', 'up:3', 'flat:0'], ans:1 },",
      why:"the stretch would be scored as falling when the chart shows it rising" },
    { file:"index", via:"index", expect:"round 4",
      find:"    { kind:'gap',  ds:0, opts:['4', '8', '3', '5'], ans:0 }",
      replace:"    { kind:'gap',  ds:0, opts:['4', '8', '3', '5'], ans:1 }",
      why:"the two-step answer would be the sum instead of the difference" },
    { file:"index", via:"index", expect:"the game answers are all bunched",
      find:"    { kind:'rows', ds:2, opts:['6', '4', '9', '8'], ans:3 },\n    { kind:'seg',  segAt:3, opts:['up:2', 'down:3', 'up:3', 'flat:0'], ans:2 },\n    { kind:'gap',  ds:0, opts:['4', '8', '3', '5'], ans:0 }",
      replace:"    { kind:'rows', ds:2, opts:['4', '8', '9', '6'], ans:1 },\n    { kind:'seg',  segAt:3, opts:['up:2', 'up:3', 'down:3', 'flat:0'], ans:1 },\n    { kind:'gap',  ds:0, opts:['8', '4', '3', '5'], ans:1 }",
      why:"all five rounds would put the answer in the same slot" },
    { file:"index", via:"index", expect:"the game no longer has a \"rows\" round",
      find:"    { kind:'rows', ds:2, opts:['6', '4', '9', '8'], ans:3 },",
      replace:"    { kind:'read', ds:2, at:2, opts:['6', '4', '9', '8'], ans:3 },",
      why:"the drawing half of the lesson would drop out of the game entirely" },
    { file:"index", via:"index", expect:"opts[ans] is \"8\" but the data gives",
      find:"    if (r.kind === 'rows') return String(gridRows(vals));",
      replace:"    if (r.kind === 'rows') return String(vals.length);",
      why:"the grid-height round would be scored on the number of items" },

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
                'TWO_QS, TWO_OVER_K, ROUNDS, roundVals, roundAnswer}',
    optionValueMax: OPT_MAX_REF,

    check: function(data, I18N, fail, src){
      const { DATASETS, DRAW, DRAW_ROWS, LINE, ROUNDS, UNIT, TWO_QS, TWO_OVER_K, READ_DS, TWO_DS } = data;
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

      /* ---- 8. 遊戲關卡：答案由資料重算，位置要分散 ---- */
      const spread = {};
      ROUNDS.forEach((r, i) => {
        const want = data.roundAnswer(r);
        if (want === null){ fail('round ' + i + ' (' + r.kind + ') has no computable answer'); return; }
        if (String(r.opts[r.ans]) !== String(want))
          fail('round ' + i + ' (' + r.kind + '): opts[ans] is "' + r.opts[r.ans] + '" but the data gives "' + want + '"');
        if (r.opts.length !== 4 || new Set(r.opts).size !== 4) fail('round ' + i + ': options are not four distinct entries');
        const vals = data.roundVals(r);
        if (r.kind === 'read' && !(r.at >= 0 && r.at < vals.length)) fail('round ' + i + ': at is out of range');
        if (r.kind === 'seg' && !(r.segAt >= 0 && r.segAt + 1 < vals.length)) fail('round ' + i + ': segAt is out of range');
        if (r.kind === 'most' && soleMaxRef(vals) < 0) fail('round ' + i + ': the tallest bar is not unique');
        if (r.kind === 'gap' && (soleMaxRef(vals) < 0 || soleMinRef(vals) < 0)) fail('round ' + i + ': the most or the least is not unique');
        spread[r.ans] = (spread[r.ans] || 0) + 1;
      });
      if (Object.keys(spread).length < 3)
        fail('the game answers are all bunched into ' + Object.keys(spread).length + ' slot(s); spread them across the options');
      const KINDS = ROUNDS.map(r => r.kind);
      for (const k of ['read', 'most', 'rows', 'seg', 'gap'])
        if (KINDS.indexOf(k) < 0) fail('the game no longer has a "' + k + '" round');

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
      const narrated = [];
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
        /* 遊戲：每一關的題目、兩層提示、選項文字。 */
        ROUNDS.forEach(r => {
          const vals = data.roundVals(r);
          const keys = (r.kind === 'seg') ? LINE.keys : DATASETS[r.ds].keys;
          const id = (r.kind === 'seg') ? LINE.id : DATASETS[r.ds].id;
          if (r.kind === 'read') push('gPrompt.read', d.gPrompt.read(d.item[keys[r.at]], UNIT[lang][id]));
          if (r.kind === 'most') push('gPrompt.most', d.gPrompt.most());
          if (r.kind === 'rows') push('gPrompt.rows', d.gPrompt.rows());
          if (r.kind === 'seg')  push('gPrompt.seg', d.gPrompt.seg(d.item[keys[r.segAt]], d.item[keys[r.segAt + 1]]));
          if (r.kind === 'gap')  push('gPrompt.gap', d.gPrompt.gap());
          push('gHint1', d.gHint1[r.kind]);
          if (r.kind === 'read') push('gHint2.read', d.gHint2.read(vals[r.at]));
          if (r.kind === 'most') push('gHint2.most', d.gHint2.most(d.item[keys[soleMaxRef(vals)]], maxRef(vals)));
          if (r.kind === 'rows') push('gHint2.rows', d.gHint2.rows(rowsRef(vals)));
          if (r.kind === 'seg')  push('gHint2.seg', d.gHint2.seg(vals[r.segAt], vals[r.segAt + 1]));
          if (r.kind === 'gap')  push('gHint2.gap', d.gHint2.gap(maxRef(vals), minRef(vals)));
          r.opts.forEach(o => {
            if (r.kind === 'most') push('gOpt', d.item[o]);
            else if (r.kind === 'seg'){
              const p = String(o).split(':');
              push('gSegOpt', d.gSegOpt(p[0], Number(p[1])));
            } else push('gOpt', String(o));
          });
        });
        for (const lost of [0, 5]) push('gWrong', d.gWrong(lost));
        push('gWin', d.gWin(100));
        push('gCorrectFirst', d.gCorrectFirst);
        push('gCorrectRetry', d.gCorrectRetry);
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
