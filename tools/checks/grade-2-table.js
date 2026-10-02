/* grade-2/math/table（分類與整理：畫記與統計表）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課的兩條規則決定了所有斷言：
   1. **各類加起來 ＝ 全部的總數**。每一組產生的資料都要成立，
      不是只寫在課文裡 —— 所以每個產生器的不變條件都先驗 sum(counts) === total。
   2. **「最多／最少」只有在最大／最小值唯一時才有唯一答案**。
      平手的那一批題目沒有正確答案，所以 mostCat／leastCat／whichHasN
      一定要驗「唯一」，不是只驗「有算對」。

   另外，類別（cats）與數量（counts）是同一件事的兩種寫法，索引對齊 ——
   長度一不一樣、對不對得起來，兩個方向都要驗。 */

/* ---------- 設定檔自己的世界表（和 review.html／index.html 的 WORLDS 對齊，但是獨立的一份） ---------- */
const WORLD_TRUTH = [
  { icons:['🟥','🟦','🟨','🟩'],
    zh:{ thing:'積木', unit:'個', cats:['紅色積木','藍色積木','黃色積木','綠色積木'] },
    en:{ thing:'blocks', unit:'block', unitN:'blocks',
         cats:['red blocks','blue blocks','yellow blocks','green blocks'] } },
  { icons:['⭐','🌙','🌸','🌈'],
    zh:{ thing:'貼紙', unit:'張', cats:['星星貼紙','月亮貼紙','花朵貼紙','彩虹貼紙'] },
    en:{ thing:'stickers', unit:'sticker', unitN:'stickers',
         cats:['star stickers','moon stickers','flower stickers','rainbow stickers'] } },
  { icons:['⚽','🏀','⚾','🎾'],
    zh:{ thing:'球', unit:'顆', cats:['足球','籃球','棒球','網球'] },
    en:{ thing:'balls', unit:'ball', unitN:'balls',
         cats:['footballs','basketballs','baseballs','tennis balls'] } }
];
const COLOR_TRUTH = [ { zh:'紅色', en:'red' }, { zh:'藍色', en:'blue' },
                      { zh:'黃色', en:'yellow' }, { zh:'綠色', en:'green' } ];
const SHAPE_TRUTH = [ { zh:'圓形', en:'circles', enS:'circle' },
                      { zh:'方形', en:'squares', enS:'square' },
                      { zh:'三角形', en:'triangles', enS:'triangle' } ];

/* 這一課自己的數字範圍，從課程規則推出來，不是隨手給的：
   每一類至少 1 個；類別最多 4 類，4 類時每類最多 6 個、3 類時最多 8 個
   → 總數上限 24。誘答的上限各自從「那個誘答是怎麼算出來的」推導（見 RANGE）。 */
const MAX_TOTAL = 24;
/* 每一列的上限跟著類別數走：4 類時最多 6（4 × 6 ＝ 24），3 類以下最多 8。
   給一個不分類別數的 8，`[8,8,4,4]` 這種 4 類表就會靜靜通過。 */
const MAX_PER_CAT = 8;
function perCatMax(k){ return k >= 4 ? 6 : MAX_PER_CAT; }

function fNum(wi, n, lang){
  const w = WORLD_TRUTH[wi];
  return lang === 'zh' ? (n + ' ' + w.zh.unit) : (n + ' ' + (n === 1 ? w.en.unit : w.en.unitN));
}
function fCat(wi, ci, lang){ return WORLD_TRUTH[wi][lang].cats[ci]; }
const sum = a => a.reduce((x, y) => x + y, 0);

/* 去重鍵含「種類」：「5 個」和「紅色積木」是兩種完全不同的答案，
   只比數字會把「5 個」和第 5 類混為一談，只比字串又會放過兩個一樣的「5 個」。 */
function keyOf(v){
  if (!v || typeof v !== 'object') return 'bad';
  if (v.u === 'num')  return 'num#' + v.n;
  if (v.u === 'cat')  return 'cat#' + v.ci;
  if (v.u === 'rule') return 'rule#' + v.k;
  return 'bad';
}
function distinctOpts(d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return 'this lesson always offers 4 options';
  const keys = d.opts.map(keyOf);
  for (let i = 0; i < keys.length; i++){
    if (keys[i] === 'bad') return 'option ' + i + ' is not a value object this lesson knows';
    for (let j = i + 1; j < keys.length; j++){
      if (keys[i] === keys[j]) return 'two options are the same answer: ' + keys[i];
    }
  }
  return null;
}
function answerIs(d, want){
  /* ans 一定要是整數索引。`"0"` 在 d.opts["0"] 查得到，整條不變條件就靜靜通過，
     可是渲染端用嚴格比較（oi === q.ans）時，這一題會變成沒有任何選項是對的。 */
  if (!Number.isInteger(d.ans) || d.ans < 0 || d.ans >= d.opts.length){
    return 'ans ' + JSON.stringify(d.ans) + ' is not a whole-number option index';
  }
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (keyOf(d.correct) !== want) return 'correct is ' + keyOf(d.correct) + ', expected ' + want;
  return null;
}
/* 每一個帶世界的選項都要用「這一題自己的世界」。少了這一條，一題積木題裡
   冒出「5 顆」也會通過：形狀對、去重也過，孩子卻看到不相干的單位。 */
function optWorldOk(d){
  for (let i = 0; i < d.opts.length; i++){
    const o = d.opts[i];
    if (!o || (o.u !== 'num' && o.u !== 'cat')) continue;
    if (!Number.isInteger(o.wi) || o.wi !== d.wi){
      return 'option ' + i + ' uses world ' + o.wi + ', but the question is world ' + d.wi;
    }
  }
  return null;
}
function worldOk(d){
  if (!Number.isInteger(d.wi) || d.wi < 0 || d.wi >= WORLD_TRUTH.length){
    return 'world index ' + d.wi + ' is outside the checker catalogue (0~' + (WORLD_TRUTH.length - 1) + ')';
  }
  return null;
}
/* 一組資料的共同條件：類別與數量索引對齊、長度相同、每一類至少 1 個、
   而且 **各類加起來 ＝ 總數**（這一課的核心規則，不能只寫在課文裡）。 */
function setOk(d, kMin, kMax){
  const bad = worldOk(d);
  if (bad) return bad;
  if (!Array.isArray(d.cats) || !Array.isArray(d.counts)) return 'cats/counts must both be arrays';
  if (d.cats.length !== d.counts.length){
    return 'cats and counts are index-aligned but have different lengths (' +
           d.cats.length + ' vs ' + d.counts.length + ')';
  }
  if (!(d.cats.length >= kMin && d.cats.length <= kMax)){
    return 'this generator uses ' + kMin + '~' + kMax + ' categories, got ' + d.cats.length;
  }
  for (let i = 0; i < d.cats.length; i++){
    const ci = d.cats[i];
    if (!Number.isInteger(ci) || ci < 0 || ci >= WORLD_TRUTH[d.wi].zh.cats.length){
      return 'category index ' + ci + ' is outside world ' + d.wi;
    }
    if (d.cats.indexOf(ci) !== i) return 'category ' + ci + ' appears twice in the same table';
    const n = d.counts[i];
    const hi = perCatMax(d.cats.length);
    if (!Number.isInteger(n) || n < 1 || n > hi){
      return 'each row must hold 1~' + hi + ' things, got ' + n + ' in a ' + d.cats.length + '-row table';
    }
  }
  if (sum(d.counts) !== d.total){
    return 'the rows do not add up to the total (' + d.counts.join('+') + ' vs ' + d.total + ')';
  }
  /* 第二道網：每列的上限（4 類 ≤ 6、3 類 ≤ 8）已經讓總數不可能超過 24，
     所以這一條沒有自己的改壞版本 —— 它是「有人放寬了每列上限」時的第二層保險。 */
  if (d.total > MAX_TOTAL) return 'total ' + d.total + ' is above this lesson range of ' + MAX_TOTAL;
  return null;
}
/* 「哪一類最多」沒有唯一最大值就沒有唯一答案 —— 這是這一課最容易漏掉的一條。 */
function strictMax(d){
  const m = Math.max.apply(null, d.counts);
  if (d.counts.filter(x => x === m).length !== 1){
    return 'the largest count is tied (' + d.counts.join(',') + '), so "which has the most" has no unique answer';
  }
  return null;
}
function strictMin(d){
  const m = Math.min.apply(null, d.counts);
  if (d.counts.filter(x => x === m).length !== 1){
    return 'the smallest count is tied (' + d.counts.join(',') + '), so "which has the fewest" has no unique answer';
  }
  return null;
}
/* 類別型的選項一定要剛好是這一題表格裡的那幾類，不多不少。 */
function catOptsAreRows(d){
  const want = d.cats.slice().sort((a, b) => a - b);
  const got = d.opts.map(o => (o && o.u === 'cat') ? o.ci : null);
  if (got.some(x => x === null)) return 'every option must be one of the table rows';
  const sorted = got.slice().sort((a, b) => a - b);
  if (sorted.join(',') !== want.join(',')){
    return 'the options are not exactly the table rows (' + sorted.join(',') + ' vs ' + want.join(',') + ')';
  }
  return null;
}
function base(d, want){ return distinctOpts(d) || optWorldOk(d) || answerIs(d, want); }

/* 每個產生器的選項可以長什麼樣，以及數字的範圍。
   每一條都要寫得出「這個上限是怎麼算出來的」—— 隨手給一個大數等於沒有範圍檢查。 */
const SHAPE = {
  mostCat:     ['cat'],
  leastCat:    ['cat'],
  readCell:    ['num'],
  tallyRead:   ['num'],
  totalSum:    ['num'],
  diffTwo:     ['num'],
  missingCell: ['num'],
  sortRule:    ['rule'],
  whichHasN:   ['cat'],
  equalGroups: ['num']
};
const RANGE = {
  /* 最大的誘答是「把總數抄回來」＝ 24。 */
  readCell:    [1, 24],
  /* 畫記最多 14 筆（見產生器），最大的誘答是 n ＋ 5 ＝ 19。 */
  tallyRead:   [1, 19],
  /* 這一課的任何選項都不可以超過總數上限 24（total ＋ 1 在 total ＝ 24 時會超出，已在產生器擋掉）。 */
  totalSum:    [1, MAX_TOTAL],
  /* 最大的誘答是「兩類加起來」，兩類各最多 8 → 16；保底還有 total ＝ 24。 */
  diffTwo:     [1, 24],
  /* 最大的誘答是「把總數抄回來」＝ 24。 */
  missingCell: [1, 24],
  /* 「多算一類」q × (k ＋ 1) 可能到 30，超過的已在產生器擋掉，這裡是第二道。 */
  equalGroups: [1, MAX_TOTAL]
};

/* 選項字串的形狀。單位詞與類別名的清單就是 WORLD_TRUTH 裡的那些，不多不少。 */
const ZH_UNIT = WORLD_TRUTH.map(w => w.zh.unit).join('|');
const EN_UNIT = WORLD_TRUTH.map(w => w.en.unit + '|' + w.en.unitN).join('|');
const ZH_CATS = WORLD_TRUTH.reduce((a, w) => a.concat(w.zh.cats), []).join('|');
const EN_CATS = WORLD_TRUTH.reduce((a, w) => a.concat(w.en.cats), []).join('|');
const ZH_COL = COLOR_TRUTH.map(c => c.zh).join('|');
const EN_COL = COLOR_TRUTH.map(c => c.en).join('|');
const ZH_SHP = SHAPE_TRUTH.map(s => s.zh).join('|');
const EN_SHP = SHAPE_TRUTH.map(s => s.en).join('|');
const EN_SING = WORLD_TRUTH.map(w => w.en.unit);
const EN_PLUR = WORLD_TRUTH.map(w => w.en.unitN);
const SHAPES = {
  zh: {
    num:  new RegExp('^\\d+ (?:' + ZH_UNIT + ')$'),
    cat:  new RegExp('^(?:' + ZH_CATS + ')$'),
    rule: new RegExp('^(?:照顏色分：(?:' + ZH_COL + ')(?:、(?:' + ZH_COL + ')){1,2}' +
                     '|先照顏色分，分到一半改照形狀分' +
                     '|分成(?:' + ZH_COL + ')和(?:' + ZH_SHP + '))$')
  },
  en: {
    num:  new RegExp('^\\d+ (?:' + EN_UNIT + ')$'),
    cat:  new RegExp('^(?:' + EN_CATS + ')$'),
    rule: new RegExp('^(?:Sort by colour: (?:' + EN_COL + ')(?:, (?:' + EN_COL + ')){1,2}' +
                     '|Start by colour, then switch to shape halfway' +
                     '|Sort into (?:' + EN_COL + ') and (?:' + EN_SHP + '))$')
  }
};

/* ---------- 小遊戲「分類整理大挑戰」（§六之五：五關五種玩法，2026-10-02 改版）----------
   分一分（範例 1：一次只看一個特徵）、畫一筆（範例 2：一個一筆、五筆一個正字）、填數量（範例 3：數畫記、各類加起來 ＝ 總數）、
   排名次（範例 4：最多／最少）、列算式（範例 4：多幾個 ＝ 大的減小的）。做法照 grade-2-length.js：
   - 每一關的 RENDER 函式本體**真的跑**：切出來放進假的 DOM（makeBoard／addZone／addPiece／useTapSelect 換成記錄用的替身，
     target／nearestOpen／renderTray／shuffle／drawTable／zoomSVG 用頁面自己的），對每一題做每一種動作
     （每一張卡 × 每一格、每一列的每一下），看頁面自己的程式收不收、說哪一句、什麼時候過關；
   - 答案用設定檔自己的規則算（自己的卡片表、自己數 records、自己排名次），不呼叫頁面的 sortBin／fillCards；
   - **畫記從筆畫的座標讀**（decodeTally），不是數 <line> 有幾條 —— 2026-08-26 的「正」畫錯、筆數卻對的教訓；
   - 每一句說明逐個比數字（兩種語言、每一題、每一種放錯），算式用 lib/arith.js 逐條驗算；
   - 版面與觸控 ≥ 44px：手機寬度從頁面的 CSS 算、位置從跑起來的 RENDER 記錄讀（不在這裡另抄一份數字）；
   - nearestOpen()、roundSolved()、roundMiss()、shuffle() 從原始碼切出來真的跑。
   已知極限：拖拉、點選、兩根手指、capture 遺失、畫板不跳動、375px 的實際尺寸、重新開始時還拿在手上的卡片，
   由 teaching-workspace/game-harness/g2-table 的端對端測試驗；這裡的替身 DOM 不跑 pointer 事件。 */
const { gameShuffleProblems, extractFunction } = require('./lib/gameshuffle.js');
const { makeArith } = require('./lib/arith.js');
const gameArith = makeArith({ units:['個', '張', '顆', '筆', '格'], unitsEn:['blocks?', 'stickers?', 'balls?', 'cards?', 'strokes?'] });

/* 設定檔自己的卡片表：代碼 → 圖案、顏色（0 紅 1 藍）、形狀（0 圓 1 方）。不呼叫頁面的 cardCol／cardShp。 */
const CARD_TRUTH = [ { icon:'🔴', col:0, shp:0 }, { icon:'🟥', col:0, shp:1 }, { icon:'🔵', col:1, shp:0 }, { icon:'🟦', col:1, shp:1 } ];

/* 畫記的讀法：從每一條 <line> 的座標判斷它是「正」（或柵欄）的第幾筆，整組不是那個字的前 k 筆就讀不出來（n = −1）。
   正（筆順）：1 上橫；2 長豎，從上橫往下；3 中短橫，在上下之間、從長豎**往右**；4 左短豎，在長豎左邊、從上橫下面（高於中短橫）往下到底；
   5 下橫，在長豎的底、穿過長豎。柵欄：四條一樣高的豎線由左到右，第五筆是斜線、橫跨四條。
   同一組：上下重疊、左右相隔不到 8（柵欄裡的豎線相隔 5；組和組之間相隔 16 以上）—— 門檻是這裡自己的，不讀頁面的版面常數。 */
function decodeTally(svg, form){
  const L = [], re = /<line\b([^>]*)>/g;
  let m;
  while ((m = re.exec(String(svg)))){
    /* 屬性用單引號或雙引號都讀得到（codex 第一輪：只認雙引號的話，一張正確的圖會讀不出來） */
    const a = m[1], g = k => { const mm = a.match(new RegExp('\\b' + k + '\\s*=\\s*["\'](-?\\d+(?:\\.\\d+)?)["\']')); return mm ? +mm[1] : NaN; };
    L.push([g('x1'), g('y1'), g('x2'), g('y2')]);
  }
  if (L.some(s => s.some(v => !Number.isFinite(v)))) return { n:-1, why:'a stroke has unreadable coordinates' };
  const groups = [];
  L.forEach(s => {
    const lo = Math.min(s[0], s[2]), hi = Math.max(s[0], s[2]), yl = Math.min(s[1], s[3]), yh = Math.max(s[1], s[3]);
    let G = groups.filter(q => lo < q.hi + 8 && hi > q.lo - 8 && yl <= q.yh && yh >= q.yl)[0];
    if (!G){ G = { lo, hi, yl, yh, s:[] }; groups.push(G); }
    G.lo = Math.min(G.lo, lo); G.hi = Math.max(G.hi, hi); G.yl = Math.min(G.yl, yl); G.yh = Math.max(G.yh, yh); G.s.push(s);
  });
  /* 筆畫要照寫字的方向：橫由左往右（x1 < x2）、豎由上往下（y1 < y2）—— codex 第一輪：只看最小／最大值的話，倒著寫的中短橫照樣讀得出來 */
  const H = s => s[1] === s[3] && s[0] < s[2], V = s => s[0] === s[2] && s[1] < s[3];
  /* 斜線真的穿過那一條豎線：在豎線的 x 上，斜線的 y 落在豎線的上下兩端之間（不是只比左右範圍） */
  const crosses = (dg, v) => { if (dg[0] === dg[2]) return false; const t = (v[0] - dg[0]) / (dg[2] - dg[0]); if (!(t >= 0 && t <= 1)) return false; const y = dg[1] + t * (dg[3] - dg[1]); return y >= Math.min(v[1], v[3]) && y <= Math.max(v[1], v[3]); };
  const mnx = s => Math.min(s[0], s[2]), mxx = s => Math.max(s[0], s[2]), mny = s => Math.min(s[1], s[3]), mxy = s => Math.max(s[1], s[3]);
  let n = 0;
  for (let gi = 0; gi < groups.length; gi++){
    const g = groups[gi].s, k = g.length;
    if (k > 5) return { n:-1, why:'group ' + gi + ' has ' + k + ' strokes' };
    if (k < 5 && gi < groups.length - 1) return { n:-1, why:'the unfinished group ' + gi + ' is not the last one' };
    if (gi > 0 && !(groups[gi].lo > groups[gi - 1].hi)) return { n:-1, why:'group ' + gi + ' is not to the right of group ' + (gi - 1) };
    if (form === 'zh'){
      if (!H(g[0])) return { n:-1, why:'正 stroke 1 is not a bar' };
      const top = g[0][1], l = mnx(g[0]), r = mxx(g[0]);
      if (k >= 2 && !(V(g[1]) && g[1][0] > l && g[1][0] < r && mny(g[1]) === top)) return { n:-1, why:'正 stroke 2 is not the long vertical from the top bar' };
      const vx = k >= 2 ? g[1][0] : 0, bot = k >= 2 ? mxy(g[1]) : 0;
      if (k >= 3 && !(H(g[2]) && g[2][1] > top && g[2][1] < bot && g[2][0] === vx && g[2][2] > vx)) return { n:-1, why:'正 stroke 3 is not the short bar to the RIGHT of the vertical (starting on it)' };
      if (k >= 4 && !(V(g[3]) && g[3][0] < vx && g[3][0] > l && mny(g[3]) > top && mny(g[3]) < g[2][1] && mxy(g[3]) === bot)) return { n:-1, why:'正 stroke 4 is not the short vertical LEFT of the vertical' };
      if (k >= 5 && !(H(g[4]) && g[4][1] === bot && mnx(g[4]) < vx && mxx(g[4]) > vx)) return { n:-1, why:'正 stroke 5 is not the bottom bar' };
    } else {
      for (let i = 0; i < Math.min(k, 4); i++){
        if (!V(g[i]) || (i > 0 && !(g[i][0] > g[i - 1][0] && mny(g[i]) === mny(g[0]) && mxy(g[i]) === mxy(g[0])))) return { n:-1, why:'gate stroke ' + (i + 1) + ' is not the next vertical' };
      }
      if (k === 5 && !(g[4][0] !== g[4][2] && g[4][1] !== g[4][3] && g.slice(0, 4).every(v => crosses(g[4], v)))) return { n:-1, why:'gate stroke 5 does not cross all four' };
    }
    n += k;
  }
  return { n, why:'' };
}

/* 讀法自己先過一遍正反例（不然它可能永遠讀得出來）：右邊的正、左邊的正、倒著寫、單引號、斜線沒穿過、平的斜線 */
function decodeSelfTest(){
  const ln = (s, q) => s.map(v => '<line x1=' + q + v[0] + q + ' y1=' + q + v[1] + q + ' x2=' + q + v[2] + q + ' y2=' + q + v[3] + q + '/>').join('');
  const ZH = [[2,3,20,3],[11,3,11,19],[11,11,18,11],[4,9,4,19],[2,19,20,19]], EN = [[3,3,3,19],[8,3,8,19],[13,3,13,19],[18,3,18,19],[1,18,20,4]];
  const cases = [
    [ln(ZH, '"'), 'zh', 5], [ln(ZH, "'"), 'zh', 5], [ln(ZH.slice(0, 3), '"'), 'zh', 3], [ln(EN, '"'), 'en', 5], [ln(EN.slice(0, 2), '"'), 'en', 2],
    [ln([ZH[0], ZH[1], [4,11,11,11], ZH[3], ZH[4]], '"'), 'zh', -1],     /* 中短橫在左邊（2026-08-26 的錯） */
    [ln([ZH[0], ZH[1], [18,11,11,11], ZH[3], ZH[4]], '"'), 'zh', -1],    /* 倒著寫 */
    [ln([ZH[0], ZH[1], ZH[2], [4,3,4,19], ZH[4]], '"'), 'zh', -1],       /* 第二條長豎 */
    [ln(EN.slice(0, 4).concat([[1,2,20,3.5]]), '"'), 'en', -1],          /* 斜線沒穿過 */
    [ln(EN.slice(0, 4).concat([[5,18,20,4]]), '"'), 'en', -1],           /* 斜線沒碰到第一條 */
    [ln(ZH, '"') + ln(ZH.slice(0, 2).map(v => [v[0] + 34, v[1], v[2] + 34, v[3]]), '"'), 'zh', 7],
    [ln(ZH.slice(0, 2), '"') + ln(ZH.map(v => [v[0] + 34, v[1], v[2] + 34, v[3]]), '"'), 'zh', -1]   /* 沒寫完的那一組不在最後 */
  ];
  return cases.map(([svg, f, want], i) => { const got = decodeTally(svg, f).n; return got === want ? null : 'decodeTally self-test ' + i + ': read ' + got + ', should be ' + want; }).filter(Boolean);
}

function gameCheck(D, I18N, fail, src, proseOk){
  decodeSelfTest().forEach(fail);
  const LANGS = ['zh', 'en'];
  const nums = t => (String(t).match(/\d+/g) || []).map(Number);
  const seq = (where, text, want) => {
    if (typeof text !== 'string' || /undefined|NaN|null/.test(text)) return fail(where + ': text has undefined/NaN/null: ' + text);
    if (nums(text).join() !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + nums(text).join() + ' — ' + text);
  };
  const lint = (where, text, L) => {
    if (typeof text !== 'string' || /undefined|NaN|null|\[object/.test(text)) fail(where + ': text has undefined/NaN/null: ' + text);
    proseOk(where, text, L);
  };
  /* 算式逐條驗算；mustCalc：這一句一定要有一條算式（只說答案不算） */
  const calc = (where, text, mustCalc) => {
    const r = gameArith(text);
    r.problems.forEach(p => fail(where + ': ' + p));
    if (mustCalc && !r.verified) fail(where + ': no number sentence was verified in "' + text + '"');
  };
  const sum = a => a.reduce((x, y) => x + y, 0);
  const W = D.GAME_W;
  const icon = (wi, ci) => WORLD_TRUTH[wi].icons[ci];
  const catT = (wi, ci, L) => WORLD_TRUTH[wi][L].cats[ci];

  /* --- 順序、每一關的題目與提示 --- */
  const TYPES = ['sort', 'tally', 'fill', 'rank', 'eq'];
  if (D.GAME_ORDER.join() !== TYPES.join()) fail('GAME_ORDER should be ' + TYPES.join() + ', got ' + D.GAME_ORDER.join());
  const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
  const B = {};
  TYPES.forEach(t => {
    B[t] = body(t); if (!B[t]) fail('cannot cut RENDER.' + t + ' out of index.html');
    LANGS.forEach(L => {
      ['gAsks', 'gHints'].forEach(k => { if (!(I18N[L][k] && typeof I18N[L][k][t] === 'string' && I18N[L][k][t].length > 4)) fail(k + '.' + t + ' missing in ' + L); });
      lint('gAsks.' + t + ' ' + L, I18N[L].gAsks[t], L); lint('gHints.' + t + ' ' + L, I18N[L].gHints[t], L);
    });
    if (!/gCtx\.hint2 = function\(\)\{/.test(B[t])) fail(t + ': no second-level hint (gCtx.hint2)');
    if (!/\broundSolved\(/.test(B[t].replace(/\/\*[\s\S]*?\*\//g, ''))) fail(t + ': the round never calls roundSolved()');
  });
  /* 第 2 關沒有拖拉，說明要寫出「這一關用點的」（§六之五第 4 點的例外）；其他四關要寫出「先點、再點」 */
  if (!/用點的/.test(I18N.zh.gAsks.tally) || !/all taps/.test(I18N.en.gAsks.tally)) fail('tally: the round has no drag — its instructions must say it is all taps');
  ['sort', 'fill', 'rank', 'eq'].forEach(t => {
    if (!/也可以先點/.test(I18N.zh.gAsks[t]) || !/Or tap/.test(I18N.en.gAsks[t])) fail(t + ': the instructions do not mention the tap-then-tap way');
  });
  if (/addPiece\(/.test(B.tally)) fail('tally: the tally round should have nothing to drag (a tap on a row IS the stroke)');
  gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
  if (!/if \(mode === 'ahead'\)\{ hintLevel = 1; showHint\(\); \}/.test(src)) fail('ahead mode does not show hint level 1 automatically');
  if (!/if \(hintLevel >= 2\) gHintBtn\.disabled = true;/.test(src)) fail('the hint button is not disabled after the second level');
  if (!/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;(?:\s*\/\*[\s\S]*?\*\/)*\s*if \(moved && B\.selected === P\)\{ el\.classList\.remove\('sel'\); B\.selected = null; \}\s*if \(cancelled \|\| gSolved\)\{ P\.home\(\); return; \}/.test(src))
    fail('a piece that was tapped and then dragged stays selected — a later tap would drop it again');
  if (!/el\.addEventListener\('lostpointercapture', function\(e\)\{ end\(e, true\); \}\);/.test(src)) fail('lost pointer capture does not put the piece back');
  if (!/if \(P\.locked \|\| gSolved \|\| start\) return;/.test(src)) fail('a second finger on a piece that is already being dragged is not ignored');
  if (!/var start = null, orig = null, moved = false, pid = null, gen = gGen;/.test(src) || !/el\.classList\.remove\('dragging'\);\s*if \(gen !== gGen\) return;/.test(src) || !/gCtx = \{\}; gGen\+\+;/.test(extractFunction(src, 'startRound') || ''))
    fail('a piece still held when the board is rebuilt (Restart, language switch) can still drop onto the new round');
  if (!/gameStage\.textContent = '';/.test(extractFunction(src, 'startRound') || '')) fail('startRound() does not clear the stage before rendering');
  if (!/if \(gSolved \|\| pos >= n\) return;/.test(B.tally)) fail('tally: a tap after the round is solved still draws a stroke');

  /* --- 觸控：375px 手機上畫板能用的寬度從頁面的 CSS 算 --- */
  const cssPx = (sel, re) => { const m = src.match(new RegExp('\\n\\s*' + sel.replace('.', '\\.') + '\\{([^}]*)\\}')); const v = m && m[1].match(re); return v ? v.slice(1).map(Number) : null; };
  const wrapPad = cssPx('.wrap', /padding:(\d+)px (\d+)px/), cardPad = cssPx('.card', /padding:(\d+)px/), cardBorder = cssPx('.card', /border:(\d+)px/), stagePad = cssPx('.gstage', /padding:\s*(\d+)px (\d+)/);
  if (!wrapPad || !cardPad || !cardBorder || !stagePad) fail('touch: cannot read .wrap / .card / .gstage padding from the CSS');
  const avail = 375 - 2 * ((wrapPad || [0, 0])[1] + (cardPad || [0])[0] + (cardBorder || [0])[0] + (stagePad || [0, 0])[1]);
  const scale = Math.min(1.5, avail / W);
  const small = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
  small('GPICK', D.GPICK);

  /* --- 星星：低年級不扣分（§三、§六之五第 3 點）。roundSolved()／roundMiss() 從原始碼切出來真的跑 --- */
  {
    const fs = extractFunction(src, 'roundSolved'), fm = extractFunction(src, 'roundMiss');
    if (!fs || !fm) fail('stars: cannot find roundSolved()/roundMiss() in index.html');
    else {
      const env = 'var gSolved = false, gScore = S0, gMistakes = 0, gRound = 0, GAME_ORDER = [1,2,3,4,5], elScore = {}, gMsg = {}, gNext = {}, gHintBtn = {};' +
        'var gameStage = { querySelectorAll: function(){ return []; } }; function L(){ return { gStars:function(n){ return "@" + n; }, gWin:function(s){ return "W" + s; }, gClear:"C" }; }\n';
      const run = (s0, misses, solves) => new Function(env.replace('S0', s0) + fm + '\n' + fs + '\nfor (var i = 0; i < ' + misses + '; i++) roundMiss("why");' +
        'var afterMiss = gScore;\nfor (var j = 0; j < ' + solves + '; j++) roundSolved("ok");\nreturn { s:gScore, afterMiss:afterMiss, shown:elScore.textContent, html:gMsg.innerHTML, m:gMistakes };')();
      try {
        [[0, 0, 2], [3, 0, 2], [3, 1, 1], [0, 4, 1]].forEach(([s0, misses, want]) => {
          const r = run(s0, misses, 1);
          if (r.afterMiss !== s0) fail('stars: a mistake changed the score ' + s0 + ' → ' + r.afterMiss + ' (low grades never lose points)');
          if (r.s !== s0 + want || String(r.shown) !== String(s0 + want)) fail('stars: a round with ' + misses + ' mistake(s) gives ' + (r.s - s0) + ' stars, should be ' + want);
          if (r.html.indexOf('@' + want) < 0) fail('stars: the message does not say ⭐ +' + want);
          if (misses && r.m !== misses) fail('stars: roundMiss() does not record the mistake');
        });
        if (run(0, 0, 2).s !== 2) fail('stars: a round can be scored twice');
      } catch (e){ fail('stars: roundSolved()/roundMiss() could not run: ' + e.message); }
    }
  }
  LANGS.forEach(L => {
    const d = I18N[L];
    seq('gStars ' + L, d.gStars(2), [2]);
    if (!/⭐ \+2/.test(d.gStars(2))) fail('gStars ' + L + ' should read "⭐ +2": ' + d.gStars(2));
    if (nums(d.gWin(7)).indexOf(7) < 0) fail('gWin ' + L + ' does not show the stars: ' + d.gWin(7));
    if (typeof d.gClear !== 'string' || !d.gClear || /\d/.test(d.gClear)) fail('gClear ' + L + ' missing or has a number in it');
  });

  /* --- shuffle()：排名次洗的是名次 0、1、2，托盤一開始不可以已經由多排到少。用「一定洗回原樣」的假亂數、再用真亂數 2000 次 --- */
  {
    const fsrc = extractFunction(src, 'shuffle');
    if (!fsrc) fail('cannot find shuffle() in index.html');
    else {
      try {
        const fake = Object.create(Math); fake.random = () => 0.999999;
        const forced = new Function('Math', fsrc + '\nreturn shuffle;')(fake);
        const real = new Function(fsrc + '\nreturn shuffle;')();
        const up = a => a.every((v, j) => j === 0 || a[j - 1] < v);
        const out = forced([0, 1, 2]);
        if (up(out) || out.slice().sort().join() !== '0,1,2') fail('shuffle() of an already ordered rank tray leaves it in order (' + out.join(',') + ')');
        for (let r = 0; r < 2000; r++){ const o = real([0, 1, 2]); if (up(o)){ fail('shuffle() produced a rank tray already in order'); break; } }
      } catch (e){ fail('shuffle() could not run: ' + e.message); }
    }
    if (!/renderTray\(B, order\.map\(function\(_, k\)\{ return k; \}\), Cd\.y,/.test(B.rank)) fail('rank: the tray is not built from the ranks 0, 1, 2 (shuffle() can only keep a NUMBER list out of order)');
  }

  /* --- nearestOpen()：從原始碼切出來真的跑 --- */
  let nearestOpen = null;
  {
    const fsrc = extractFunction(src, 'nearestOpen');
    if (!fsrc) fail('cannot find nearestOpen() in index.html');
    else { try { nearestOpen = new Function(fsrc + '\nreturn nearestOpen;')(); } catch (e){ fail('nearestOpen() could not be evaluated: ' + e.message); } }
  }

  /* ================= 題庫：資料本身的條件（用自己的規則） ================= */
  const MAXN = 9;   /* 一列最多 9 筆：一個正字加 4 筆 —— 第二層提示說的「5 ＋ k」只寫得出這種 */
  D.GAME_SORT.forEach((e, i) => {
    const w = 'GAME_SORT[' + i + ']';
    if (e.rule !== 0 && e.rule !== 1) fail(w + ': rule must be 0 (colour) or 1 (shape)');
    if (!(e.cards.length >= 7 && e.cards.length <= 8)) fail(w + ': ' + e.cards.length + ' cards, keep 7~8 (two tray rows of four)');
    if (!e.cards.every(c => Number.isInteger(c) && c >= 0 && c < 4)) fail(w + ': a card code is not 0~3');
    if (new Set(e.cards).size !== 4) fail(w + ': all four kinds of card must be there, or sorting by the wrong feature never shows');
    const per = [0, 1].map(b => e.cards.filter(c => (e.rule === 0 ? CARD_TRUTH[c].col : CARD_TRUTH[c].shp) === b).length);
    if (per.some(x => x < 2 || x > 8)) fail(w + ': the baskets would get ' + per.join(' / ') + ' cards (2~8 each)');
  });
  for (let c = 0; c < 4; c++){
    if (D.CARD_ICONS[D.cardCol(c)][D.cardShp(c)] !== CARD_TRUTH[c].icon) fail('card ' + c + ' draws ' + D.CARD_ICONS[D.cardCol(c)][D.cardShp(c)] + ', should be ' + CARD_TRUTH[c].icon);
    [0, 1].forEach(rule => { const want = rule === 0 ? CARD_TRUTH[c].col : CARD_TRUTH[c].shp; if (D.sortBin(rule, c) !== want) fail('sortBin(' + rule + ', ' + c + ') is ' + D.sortBin(rule, c) + ', should be ' + want); });
  }
  const tallyCounts = e => e.cats.map((_, j) => e.records.filter(r => r === j).length);
  D.GAME_TALLY.forEach((e, i) => {
    const w = 'GAME_TALLY[' + i + ']', c = tallyCounts(e);
    if (e.cats.length !== 3 || new Set(e.cats).size !== 3 || !e.cats.every(x => x >= 0 && x < 4)) fail(w + ': three different categories');
    if (!e.records.every(r => Number.isInteger(r) && r >= 0 && r < 3)) fail(w + ': a record is not a row 0~2');
    if (!(e.records.length >= 10 && e.records.length <= 12)) fail(w + ': ' + e.records.length + ' items, keep 10~12 (one row of chips)');
    if (!(Math.max.apply(null, c) >= 6 && Math.min.apply(null, c) >= 1 && Math.min.apply(null, c) < 5)) fail(w + ': rows ' + c.join(',') + ' — one must pass a full 正 (≥ 6), every row ≥ 1, one under 5');
    if (Math.max.apply(null, c) > MAXN) fail(w + ': a row of ' + Math.max.apply(null, c) + ' is above ' + MAXN);
  });
  D.GAME_FILL.forEach((e, i) => {
    const w = 'GAME_FILL[' + i + ']', T = sum(e.counts), big = e.counts.indexOf(Math.max.apply(null, e.counts));
    if (e.cats.length !== 3 || new Set(e.cats).size !== 3 || e.counts.length !== 3) fail(w + ': three different categories with three counts');
    if (!e.counts.every(n => Number.isInteger(n) && n >= 2 && n <= MAXN)) fail(w + ': each count must be 2~' + MAXN);
    if (!(e.counts[big] >= 6)) fail(w + ': the biggest row must pass a full 正, or the "a 正 is 1" trap is not a trap');
    const gate = Math.floor(e.counts[big] / 5) + e.counts[big] % 5, skip = T - e.counts[2];
    const want = e.counts.concat([T, gate, skip]);
    if (D.fillGateDecoy(e.counts[big]) !== gate) fail(w + ': fillGateDecoy(' + e.counts[big] + ') is ' + D.fillGateDecoy(e.counts[big]) + ', counting each 正 as 1 gives ' + gate);
    if (JSON.stringify(D.fillCards(e)) !== JSON.stringify(want)) fail(w + ': fillCards() is ' + JSON.stringify(D.fillCards(e)) + ', should be ' + JSON.stringify(want) + ' (three counts, the total, the 正-as-1 trap, the total without the last row)');
    if (new Set(want).size !== 6 || want.some(v => v < 1)) fail(w + ': the six cards ' + want.join(',') + ' must all differ — or one card fits two boxes');
    if (T > 24) fail(w + ': total ' + T + ' above the lesson range');
  });
  D.GAME_RANK.forEach((e, i) => {
    const w = 'GAME_RANK[' + i + ']';
    if (e.cats.length !== 3 || new Set(e.cats).size !== 3 || e.counts.length !== 3) fail(w + ': three different categories with three counts');
    if (new Set(e.counts).size !== 3) fail(w + ': counts ' + e.counts.join(',') + ' tie, so "most" has no single answer');
    if (!e.counts.every(n => n >= 2 && n <= MAXN)) fail(w + ': each count must be 2~' + MAXN);
    if (e.counts[0] > e.counts[1] && e.counts[1] > e.counts[2]) fail(w + ': the table already lists the rows from most to fewest');
  });
  D.GAME_EQ.forEach((e, i) => {
    const w = 'GAME_EQ[' + i + ']';
    if (e.cats.length !== 3 || new Set(e.cats).size !== 3 || e.counts.length !== 3) fail(w + ': three different categories with three counts');
    if (new Set(e.counts).size !== 3 || !e.counts.every(n => n >= 2 && n <= MAXN)) fail(w + ': three different counts 2~' + MAXN);
    if (!(e.a !== e.b && [e.a, e.b].every(x => x >= 0 && x < 3))) fail(w + ': a and b must be two different rows');
    else {
      const na = e.counts[e.a], nb = e.counts[e.b];
      if (!(na > nb)) fail(w + ': "how many more ' + e.a + ' than ' + e.b + '" needs counts[a] > counts[b], got ' + na + ', ' + nb);
      if (e.counts.indexOf(na - nb) >= 0 || e.counts.indexOf(na + nb) >= 0) fail(w + ': the difference ' + (na - nb) + ' or the sum ' + (na + nb) + ' is also a count on the table');
      if (na - nb < 2) fail(w + ': a difference of ' + (na - nb) + ' — keep it ≥ 2 (English "more X" is plural)');
    }
  });
  if (D.GAME_EQ.every(e => e.a === 0) || D.GAME_EQ.every(e => e.b === 2)) fail('GAME_EQ: the asked rows are always in the same place on the table');

  /* ================= 每一關的 RENDER 函式本體「真的跑」 ================= */
  const EXEC = (() => {
    const fns = ['target', 'nearestOpen', 'renderTray', 'shuffle', 'drawTable', 'zoomSVG'].map(n => {
      const f = extractFunction(src, n); if (!f) fail('exec: cannot cut ' + n + '() out of index.html'); return f || '';
    }).join('\n');
    const decl = Object.keys(D).map(k => 'var ' + k + ' = D.' + k + ';').join('\n');
    const stub = `
      var LOG = { miss:[], solved:[], info:[], zones:[], pieces:[], created:[], targets:[], board:null, line:null, drop:null };
      function el(){ var o = { style:{}, textContent:'', innerHTML:'', children:[], disabled:false, cls:{},
        classList:{ add:function(c){ o.cls[c] = true; }, remove:function(c){ delete o.cls[c]; }, contains:function(c){ return !!o.cls[c]; } },
        appendChild:function(x){ o.children.push(x); return x; }, setAttribute:function(){}, remove:function(){ o.removed = true; },
        addEventListener:function(t, f){ o['on' + t] = f; } }; return o; }
      var document = { createElement:function(tag){ var e = el(); e.tag = tag; LOG.created.push(e); return e; } };
      var gameStage = el(), gMsg = el(), gSolved = false, gCtx = {}, gMistakes = 0;
      function tallyForm(){ return FORM; }
      function pick(arr){ return arr[PICK]; }
      function makeBoard(W, H){ LOG.board = { W:W, H:H }; return { el:el(), W:W, k:1, selected:null }; }
      function addZone(B, x, y, w, h, cls, text){ var z = el(); z.x = x; z.y = y; z.w = w; z.h = h; z.className = cls; if (text !== undefined) z.textContent = text; LOG.zones.push(z); return z; }
      function trailLine(text){ LOG.line = el(); LOG.line.textContent = text; return LOG.line; }
      function addPiece(B, o){ var P = { el:el(), w:o.w, h:o.h, homeX:o.cx, homeY:o.cy, cx:o.cx, cy:o.cy, locked:false, data:o.data || {}, text:o.text, cls:o.cls };
        P.place = function(x, y){ P.cx = x; P.cy = y; }; P.home = function(){ P.place(P.homeX, P.homeY); }; P.lock = function(x, y){ P.locked = true; P.place(x, y); };
        P.shrink = function(s){ P.w = s; P.h = s; P.mini = true; };
        P.busy = function(){ return false; }; LOG.pieces.push(P); return P; }
      function useTapSelect(B, fn){ LOG.drop = fn; }
      function roundMiss(t){ gMistakes++; LOG.miss.push(t); }
      function roundSolved(t){ if (gSolved) return; gSolved = true; LOG.solved.push(t); }
      function roundInfo(t){ LOG.info.push(t); }
      function refreshHint(){}
    `;
    /* target() 回傳的物件就是 nearestOpen() 真正用的格子：包一層記下來（codex 第一輪：從畫出來的框重建一份的話，
       target() 把中心算偏也不會有人發現）。rnd：給了就把 Math.random 換成固定值，托盤的順序變成可以預測（codex 第一輪） */
    const wrapT = '\nvar __target = target; target = function(B, x, y, w, h, cls, more){ var t = __target(B, x, y, w, h, cls, more); LOG.targets.push(t); return t; };\n';
    return (type, pickIdx, d, L, rnd) => {
      const fixRnd = (rnd === undefined) ? '' : 'var Math = Object.create(globalThis.Math); Math.random = function(){ return ' + rnd + '; };\n';
      const code = decl + '\nvar PICK = ' + pickIdx + ', FORM = ' + JSON.stringify(L) + ';\n' + fixRnd + stub + fns + wrapT + '\n(function(d){' + B[type] + '\n})(d);\n' +
        'return { LOG:LOG, solved:function(){ return gSolved; }, misses:function(){ return gMistakes; }, msg:function(){ return gMsg.textContent; }, hint2:function(){ return gCtx.hint2 ? gCtx.hint2() : null; } };';
      try { return new Function('D', 'd', code)(D, d); }
      catch (e){ fail('exec: RENDER.' + type + ' could not run in the stub DOM: ' + e.message); return null; }
    };
  })();
  const H_OF = { sort:'SORT_H', tally:'TALLY_H', fill:'FILL_H', rank:'RANK_H', eq:'EQ_H' };
  const POOL = { sort:D.GAME_SORT, tally:D.GAME_TALLY, fill:D.GAME_FILL, rank:D.GAME_RANK, eq:D.GAME_EQ };
  const boxOf = o => ({ x:o.x, y:o.y, w:o.w, h:o.h });
  const pbox = P => ({ x:P.cx - P.w / 2, y:P.cy - P.h / 2, w:P.w, h:P.h });
  const hit = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0;
  const inside = (o, H) => o.x >= 0 && o.y >= 0 && o.x + o.w <= W && o.y + o.h <= H;
  /* 版面：每一題、兩種語言都真的跑一次；畫板高度、每一塊拿得起來的東西都在畫板裡、兩兩不碰、≥ 44px */
  TYPES.forEach(t => POOL[t].forEach((e, i) => LANGS.forEach(L => {
    const r = EXEC(t, i, I18N[L], L); if (!r) return;
    const w = 'exec ' + t + '[' + i + '] ' + L, H = D[H_OF[t]];
    if (!(r.LOG.board && r.LOG.board.W === W && r.LOG.board.H === H)) return fail(w + ': opens a board of ' + JSON.stringify(r.LOG.board) + ', should be ' + W + ' × ' + H);
    r.LOG.zones.forEach(z => { if (!inside(boxOf(z), H)) fail(w + ': a ' + z.className + ' zone is outside the board ' + JSON.stringify(boxOf(z))); });
    r.LOG.pieces.forEach(P => {
      if (!inside(pbox(P), H)) fail(w + ': a piece "' + P.text + '" is outside the board ' + JSON.stringify(pbox(P)));
      small(w + ': piece "' + P.text + '" (' + P.w + '×' + P.h + ')', Math.min(P.w, P.h));
      r.LOG.zones.forEach(z => { if (hit(pbox(P), boxOf(z))) fail(w + ': piece "' + P.text + '" sits on the ' + z.className + ' zone at ' + JSON.stringify(boxOf(z))); });
    });
    for (let a = 0; a < r.LOG.pieces.length; a++) for (let b = a + 1; b < r.LOG.pieces.length; b++){
      if (hit(pbox(r.LOG.pieces[a]), pbox(r.LOG.pieces[b]))) fail(w + ': pieces "' + r.LOG.pieces[a].text + '" and "' + r.LOG.pieces[b].text + '" overlap');
    }
    r.LOG.targets.forEach(T => {
      small(w + ': a drop box (' + (2 * T.hw) + '×' + (2 * T.hh) + ')', Math.min(2 * T.hw, 2 * T.hh));
      const z = T.z;
      if (!z || T.cx !== z.x + z.w / 2 || T.cy !== z.y + z.h / 2 || T.hw !== z.w / 2 || T.hh !== z.h / 2) fail(w + ': a drop box\'s centre/size (' + [T.cx, T.cy, T.hw, T.hh].join(',') + ') is not the box it draws ' + JSON.stringify(z && boxOf(z)));
    });
    r.LOG.created.filter(c => c.tag === 'button').forEach(b => {
      const o = { x:parseFloat(b.style.left), y:parseFloat(b.style.top), w:parseFloat(b.style.width), h:parseFloat(b.style.height) };
      if (![o.x, o.y, o.w, o.h].every(Number.isFinite) || !inside(o, H)) fail(w + ': a row button is outside the board ' + JSON.stringify(o));
    });
    if (!r.LOG.line || !r.LOG.line.textContent) fail(w + ': no trail line');
    lint(w + ' line', r.LOG.line.textContent, L);
    const h2 = r.hint2(); if (!h2) fail(w + ': the second-level hint is empty at the start'); else lint(w + ' hint2', h2, L);
  })));

  /* 托盤畫出來的順序就是 shuffle() 的結果（codex 第一輪：只證明 shuffle() 會洗、而且寫在 .forEach 前面，
     `(shuffle(items), items).forEach` 照樣全綠）。把 Math.random 固定成兩個值，各跑一次每一關，
     用頁面自己的 shuffle()（同一個固定值）算出應該的順序，和替身記下來的「卡片產生的順序」比；
     同一排的卡片由左到右就是那個順序。固定成「一定洗回原樣」時，排名次的托盤也不可以已經由多排到少。 */
  {
    const fsrc = extractFunction(src, 'shuffle');
    const shufWith = rnd => { const M = Object.create(Math); M.random = () => rnd; return new Function('Math', fsrc + '\nreturn shuffle;')(M); };
    const icons = c => CARD_TRUTH[c].icon;
    if (fsrc) [0, 0.999999].forEach(rnd => LANGS.forEach(L => {
      const d = I18N[L], sh = shufWith(rnd);
      const order = (w, r, want) => {
        const got = r.LOG.pieces.map(P => P.text);
        if (got.join('|') !== want.join('|')) fail(w + ': the tray is drawn as ' + got.join(' ') + ', shuffle() gave ' + want.join(' ') + ' — the shuffled order is not what is drawn');
        r.LOG.pieces.forEach((P, k) => { const Q = r.LOG.pieces[k - 1]; if (Q && Q.cy === P.cy && !(Q.cx < P.cx)) fail(w + ': tray cards ' + (k - 1) + ' and ' + k + ' are not left to right in the drawn order'); });
      };
      D.GAME_SORT.forEach((e, i) => { const r = EXEC('sort', i, d, L, rnd); if (r) order('tray sort[' + i + '] ' + L + ' rnd ' + rnd, r, sh(e.cards).map(icons)); });
      D.GAME_FILL.forEach((e, i) => {
        const T = sum(e.counts), big = e.counts.indexOf(Math.max.apply(null, e.counts));
        const own = e.counts.concat([T, Math.floor(e.counts[big] / 5) + e.counts[big] % 5, T - e.counts[2]]);
        const r = EXEC('fill', i, d, L, rnd); if (r) order('tray fill[' + i + '] ' + L + ' rnd ' + rnd, r, sh(own).map(String));
      });
      D.GAME_RANK.forEach((e, i) => {
        const own = [0, 1, 2].sort((a, b) => e.counts[b] - e.counts[a]);
        const r = EXEC('rank', i, d, L, rnd); if (!r) return;
        const want = sh([0, 1, 2]);
        order('tray rank[' + i + '] ' + L + ' rnd ' + rnd, r, want.map(k => icon(e.wi, e.cats[own[k]]) + '\n' + catT(e.wi, e.cats[own[k]], L)));
        const byX = r.LOG.pieces.slice().sort((a, b) => a.cx - b.cx).map(P => e.counts[e.cats.map(ci => icon(e.wi, ci) + '\n' + catT(e.wi, ci, L)).indexOf(P.text)]);
        if (byX[0] > byX[1] && byX[1] > byX[2]) fail('tray rank[' + i + '] ' + L + ' rnd ' + rnd + ': the tray starts in the answer order (' + byX.join(',') + ')');
      });
      D.GAME_EQ.forEach((e, i) => {
        const na = e.counts[e.a], nb = e.counts[e.b];
        const r = EXEC('eq', i, d, L, rnd); if (!r) return;
        const rows = sh([0, 1, 2]).map(j => icon(e.wi, e.cats[j]) + ' ' + e.counts[j]);
        const smalls = sh(['-', '+', 'd', 's']).map(x => x === '-' ? d.opMinus : x === '+' ? d.opPlus : String(x === 'd' ? na - nb : na + nb));
        order('tray eq[' + i + '] ' + L + ' rnd ' + rnd, r, rows.concat(smalls));
      });
    }));
  }

  /* 吸附目標（跑起來的 target() 記下來的格子）：每一點都判給「到方框最近」的那一格，一樣近才比中心。
     畫板上每 0.5px 掃一遍：重疊區、框裡、框外都要對（第一個符合的、量中心的寫法都會在重疊區錯）。 */
  const scanTargets = (w, list, pad, H) => {
    if (!nearestOpen) return;
    let bad = 0, overlap = 0, ex = '';
    for (let x = 0; x <= W; x += 0.5) for (let y = 0; y <= H; y += 0.5){
      let best = null, bd = Infinity, bc = Infinity, n = 0;
      list.forEach(b => {
        const dx = x - b.cx, dy = y - b.cy;
        if (Math.abs(dx) > b.hw + pad || Math.abs(dy) > b.hh + pad) return;
        n++;
        const ddx = Math.max(0, Math.abs(dx) - b.hw), ddy = Math.max(0, Math.abs(dy) - b.hh), dd = ddx * ddx + ddy * ddy, dc = dx * dx + dy * dy;
        if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }
      });
      if (n > 1) overlap++;
      const got = nearestOpen(list, { x, y }, pad);
      if (got !== best){ bad++; if (!ex) ex = '(' + x + ',' + y + ')'; }
    }
    if (bad) fail(w + ': nearestOpen() picks the wrong box at ' + bad + ' points, e.g. ' + ex);
    return overlap;
  };
  {

    const overlaps = {};
    ['sort', 'fill', 'rank', 'eq'].forEach(t => {
      const r = EXEC(t, 0, I18N.zh, 'zh'); if (!r) return;
      /* target() 真正回傳、nearestOpen() 真正用的那些物件 */
      const list = r.LOG.targets;
      if (!list.length) fail('nearest ' + t + ': the round creates no drop boxes');
      overlaps[t] = scanTargets('nearest ' + t, list, D.GPAD, D[H_OF[t]]);
    });
    ['sort', 'fill', 'rank', 'eq'].forEach(t => { if (!(overlaps[t] > 0)) fail('nearest ' + t + ': no two drop pads overlap — the e2e overlap-zone test has nothing to test (or the layout changed)'); });
  }

  /* 一題跑壞（找不到卡片、字典改壞讓替身拿到 undefined）要變成一行 [FAIL]，不可以讓整支檢查丟例外 */
  const guarded = (e, i, L, fn) => { try { fn(); } catch (err){ fail('exec round entry ' + i + ' ' + L + ' threw: ' + err.message + ' — a card or box the round needs is missing'); } };

  /* --- 第 1 關（跑起來）：每一張卡 × 每一個籃子；再照順序全部放好 --- */
  D.GAME_SORT.forEach((e, i) => LANGS.forEach(L => guarded(e, i, L, () => {
    const d = I18N[L], w = 'exec sort[' + i + '] ' + L;
    let r = EXEC('sort', i, d, L); if (!r) return;
    const bins = r.LOG.zones.filter(z => /\bgbin\b/.test(z.className)).sort((a, b) => a.x - b.x);
    const heads = r.LOG.zones.filter(z => z.className === 'gbinh').sort((a, b) => a.x - b.x).map(z => z.textContent);
    const rule = r.LOG.zones.filter(z => z.className === 'gorder')[0];
    const WANT_HEAD = L === 'zh' ? [['紅色', '藍色'], ['圓形', '方形']] : [['Red', 'Blue'], ['Circles', 'Squares']];
    if (heads.join() !== WANT_HEAD[e.rule].join()) fail(w + ': the baskets read ' + heads.join(' / ') + ', should be ' + WANT_HEAD[e.rule].join(' / '));
    if (!rule || !(L === 'zh' ? (e.rule === 0 ? /顏色/ : /形狀/) : (e.rule === 0 ? /colour/ : /shape/)).test(rule.textContent)) fail(w + ': the rule on top does not say ' + (e.rule === 0 ? 'colour' : 'shape'));
    if (r.LOG.pieces.length !== e.cards.length) return fail(w + ': ' + r.LOG.pieces.length + ' cards drawn, should be ' + e.cards.length);
    const drawn = r.LOG.pieces.map(P => CARD_TRUTH.map(c => c.icon).indexOf(P.text)).sort().join(), want0 = e.cards.slice().sort().join();
    if (drawn !== want0) fail(w + ': the tray shows ' + r.LOG.pieces.map(P => P.text).join('') + ', the pool is ' + e.cards.map(c => CARD_TRUTH[c].icon).join(''));
    /* 每一張 × 每一個籃子，各開一局 */
    r.LOG.pieces.forEach((P0, pi) => [0, 1].forEach(b => {
      const rr = EXEC('sort', i, d, L); const P = rr.LOG.pieces[pi], c = CARD_TRUTH.map(x => x.icon).indexOf(P.text);
      const own = e.rule === 0 ? CARD_TRUTH[c].col : CARD_TRUTH[c].shp;
      const got = rr.LOG.drop(P, { x:bins[b].x + bins[b].w / 2, y:bins[b].y + bins[b].h / 2 });
      if (b === own){
        if (got !== true || !P.locked || rr.LOG.miss.length) fail(w + ': ' + P.text + ' into its own basket ' + heads[b] + ' is not accepted');
        if (!(P.cx > bins[b].x && P.cx < bins[b].x + bins[b].w && P.cy > bins[b].y && P.cy < bins[b].y + bins[b].h)) fail(w + ': ' + P.text + ' is locked outside its basket');
      } else {
        if (got !== false || P.locked || rr.LOG.miss.length !== 1) fail(w + ': ' + P.text + ' into ' + heads[b] + ' is not bounced as a mistake');
        else {
          const m = rr.LOG.miss[0];
          if (m !== d.gSortWrong(e.rule, P.text, own)) fail(w + ': the reason is not gSortWrong for ' + P.text);
          if (m.indexOf(P.text) < 0 || m.indexOf('“' + heads[own] + '”') < 0 && m.indexOf('「' + heads[own] + '」') < 0) fail(w + ': the reason does not name ' + P.text + ' and its basket ' + heads[own] + ': ' + m);
          const featW = L === 'zh' ? [['紅色', '藍色'], ['圓形', '方形']][e.rule][own] : [['red', 'blue'], ['a circle', 'a square']][e.rule][own];
          if (m.indexOf(featW) < 0) fail(w + ': the reason does not say ' + P.text + ' is ' + featW + ': ' + m);
          lint(w + ' wrong', m, L);
        }
      }
    }));
    /* 空白處：靜靜的 */
    if (r.LOG.drop(r.LOG.pieces[0], { x:W / 2, y:bins[0].y + bins[0].h + D.GPAD + 4 }) !== false || r.LOG.miss.length) fail(w + ': a drop below the baskets is not silent');
    /* 全部放好（照托盤順序） */
    const per = [0, 0];
    r.LOG.pieces.forEach(P => {
      const c = CARD_TRUTH.map(x => x.icon).indexOf(P.text), own = e.rule === 0 ? CARD_TRUTH[c].col : CARD_TRUTH[c].shp;
      if (r.solved()) fail(w + ': solved before every card is in');
      r.LOG.drop(P, { x:bins[own].x + bins[own].w / 2, y:bins[own].y + bins[own].h / 2, tap:true });
      per[own]++;
      if (!P.mini) fail(w + ': a placed card is not shrunk into the basket');
      const cnts = r.LOG.zones.filter(z => z.className === 'gbinn').sort((a, b) => a.x - b.x).map(z => z.textContent);
      if (cnts.join() !== [d.cardQty(per[0]), d.cardQty(per[1])].join()) fail(w + ': basket labels read ' + cnts.join(' / ') + ' after ' + (per[0] + per[1]) + ' cards');
      if (r.LOG.line.textContent !== d.gSortNow(e.rule, per[0], per[1])) fail(w + ': the line reads ' + r.LOG.line.textContent);
    });
    const minis = r.LOG.pieces.map(P => pbox(P));
    for (let a = 0; a < minis.length; a++){
      const binA = bins.filter(z => minis[a].x >= z.x && minis[a].x + minis[a].w <= z.x + z.w && minis[a].y >= z.y && minis[a].y + minis[a].h <= z.y + z.h)[0];
      if (!binA) fail(w + ': a placed card sticks out of its basket ' + JSON.stringify(minis[a]));
      r.LOG.zones.filter(z => z.className === 'gbinh' || z.className === 'gbinn').forEach(z => { if (hit(minis[a], boxOf(z))) fail(w + ': a placed card covers the basket label "' + z.textContent + '"'); });
      for (let b = a + 1; b < minis.length; b++) if (hit(minis[a], minis[b])) fail(w + ': two placed cards overlap in the basket');
    }
    const own = [0, 1].map(b => e.cards.filter(c => (e.rule === 0 ? CARD_TRUTH[c].col : CARD_TRUTH[c].shp) === b).length);
    if (!r.solved() || r.LOG.solved.join() !== d.gSortDone(e.rule, own[0], own[1], e.cards.length)) fail(w + ': not solved with gSortDone(' + own.join(',') + ')');
    const done = r.LOG.solved[0] || '';
    seq(w + ' done', done, [own[0], own[1], e.cards.length]); calc(w + ' done', done, true); lint(w + ' done', done, L);
    /* 第二層提示：點名下一張還沒放的卡和它的籃子 */
    const r2 = EXEC('sort', i, d, L), P2 = r2.LOG.pieces[0], c2 = CARD_TRUTH.map(x => x.icon).indexOf(P2.text), o2 = e.rule === 0 ? CARD_TRUTH[c2].col : CARD_TRUTH[c2].shp;
    const hh = r2.hint2(); if (hh.indexOf(P2.text) < 0 || hh.indexOf(heads[o2]) < 0) fail(w + ': hint2 does not name the next card ' + P2.text + ' and its basket: ' + hh);
  })));

  /* --- 第 2 關（跑起來）：每一個東西、每一列各點一下；畫出來的筆畫用 decodeTally() 讀 --- */
  D.GAME_TALLY.forEach((e, i) => LANGS.forEach(L => guarded(e, i, L, () => {
    const d = I18N[L], w = 'exec tally[' + i + '] ' + L, n = e.records.length;
    const r = EXEC('tally', i, d, L); if (!r) return;
    const rows = r.LOG.created.filter(c => c.tag === 'button' && typeof c.onclick === 'function');
    if (rows.length !== 3) return fail(w + ': ' + rows.length + ' row buttons, should be 3');
    rows.forEach((b, j) => {
      if (parseFloat(b.style.height) * scale < 44 || parseFloat(b.style.width) * scale < 44) fail(w + ': row ' + j + ' is under 44px on a phone');
      const nm = b.children[0], tl = b.children[1];
      if (!nm || nm.textContent !== icon(e.wi, e.cats[j]) + ' ' + catT(e.wi, e.cats[j], L)) fail(w + ': row ' + j + ' is labelled "' + (nm && nm.textContent) + '"');
      if (!tl) fail(w + ': row ' + j + ' has no tally');
    });
    const chips = r.LOG.zones.filter(z => /^gchip/.test(z.className)).sort((a, b) => a.x - b.x);
    if (chips.map(z => z.textContent).join() !== e.records.map(x => icon(e.wi, e.cats[x])).join()) fail(w + ': the chips do not show the records in order');
    const read = () => rows.map(b => decodeTally(b.children[1].innerHTML, L));
    const want = [0, 0, 0];
    for (let k = 0; k < n; k++){
      const ri = e.records[k];
      const on = chips.filter(z => / on\b/.test(z.className));
      if (on.length !== 1 || on[0] !== chips[k]) fail(w + ': item ' + (k + 1) + ' is not the only one lit up');
      if (chips.slice(0, k).some(z => !/ done\b/.test(z.className))) fail(w + ': items already tallied are not faded');
      const hh = r.hint2(); if (hh !== d.gTally2(e.wi, e.cats[ri], icon(e.wi, e.cats[ri]))) fail(w + ': hint2 at item ' + (k + 1) + ' does not point at its row');
      [0, 1, 2].forEach(j => {
        if (j === ri) return;
        const m0 = r.LOG.miss.length; rows[j].onclick();
        if (r.LOG.miss.length !== m0 + 1 || r.LOG.miss[m0] !== d.gTallyWrong(e.wi, e.cats[ri], icon(e.wi, e.cats[ri]))) fail(w + ': tapping row ' + j + ' for item ' + (k + 1) + ' does not say why');
        if (read().map(x => x.n).join() !== want.join()) fail(w + ': a wrong tap drew a stroke');
      });
      const m1 = r.LOG.miss.length; rows[ri].onclick(); want[ri]++;
      if (r.LOG.miss.length !== m1) fail(w + ': the right row for item ' + (k + 1) + ' counts as a mistake');
      const got = read();
      got.forEach((x, j) => { if (x.n < 0) fail(w + ': after item ' + (k + 1) + ' row ' + j + ' does not read as tally strokes: ' + x.why); });
      if (got.map(x => x.n).join() !== want.join()) fail(w + ': after item ' + (k + 1) + ' the rows read ' + got.map(x => x.n).join(',') + ' from their strokes, should be ' + want.join(','));
      if (k < n - 1 && (r.solved() || r.LOG.line.textContent !== d.gTallyNow(e.wi, k + 1, n))) fail(w + ': after item ' + (k + 1) + ' line ' + r.LOG.line.textContent + (r.solved() ? ' and already solved' : ''));
    }
    const own = tallyCounts(e);
    if (want.join() !== own.join()) fail(w + ': tallied ' + want.join(',') + ', own count ' + own.join(','));
    if (!r.solved() || r.LOG.solved.join() !== d.gTallyDone(e.wi, own, n)) fail(w + ': not solved with gTallyDone after the last item');
    const done = r.LOG.solved[0] || '';
    seq(w + ' done', done, own.concat([n, n])); calc(w + ' done', done, true); lint(w + ' done', done, L);
    seq(w + ' line', r.LOG.line.textContent, [n]);
    const m2 = r.LOG.miss.length; rows.forEach(b => b.onclick());
    if (r.LOG.miss.length !== m2 || read().map(x => x.n).join() !== own.join()) fail(w + ': taps after the round is solved still do something');
    [0, 1].forEach(k => { const t = d.gTallyNow(e.wi, k, n); lint(w + ' now ' + k, t, L); seq(w + ' now ' + k, t, [k, n - k]); if (L === 'en' && k === 1 && !/^1 (block|sticker|ball) /.test(t)) fail(w + ': "' + t + '" — singular for 1'); });
  })));

  /* --- 第 3 關（跑起來）：每一張卡 × 每一格；表上的畫記用 decodeTally() 讀 --- */
  D.GAME_FILL.forEach((e, i) => LANGS.forEach(L => guarded(e, i, L, () => {
    const d = I18N[L], w = 'exec fill[' + i + '] ' + L, T = sum(e.counts), big = e.counts.indexOf(Math.max.apply(null, e.counts));
    const gate = Math.floor(e.counts[big] / 5) + e.counts[big] % 5, skip = T - e.counts[2];
    let r = EXEC('fill', i, d, L); if (!r) return;
    const tl = r.LOG.zones.filter(z => /\bgtly\b/.test(z.className) && !/\bgtot\b/.test(z.className)).sort((a, b) => a.y - b.y);
    const read = tl.map(z => decodeTally(z.innerHTML, L));
    read.forEach((x, j) => { if (x.n !== e.counts[j]) fail(w + ': row ' + j + ' reads ' + x.n + ' from its strokes (' + x.why + '), should be ' + e.counts[j]); });
    const cnt = r.LOG.zones.filter(z => /\bgcnt\b/.test(z.className));
    if (cnt.some(z => z.textContent !== '')) fail(w + ': the Count column is not empty at the start');
    const names = r.LOG.zones.filter(z => /\bgname\b/.test(z.className)).sort((a, b) => a.y - b.y).map(z => z.textContent);
    if (names.join() !== e.cats.map(ci => icon(e.wi, ci) + ' ' + catT(e.wi, ci, L)).concat([d.totalRow]).join()) fail(w + ': the row names are ' + names.join(' / '));
    const slots = r.LOG.zones.filter(z => /\bgslot\b/.test(z.className)).sort((a, b) => a.y - b.y);
    if (slots.length !== 4) return fail(w + ': ' + slots.length + ' boxes, should be 4');
    slots.forEach((z, k) => { small(w + ': box ' + k, Math.min(z.w, z.h)); const row = cnt.filter(c => c.y < z.y + z.h / 2 && c.y + c.h > z.y + z.h / 2)[0]; if (!row || z.x < row.x || z.x + z.w > row.x + row.w) fail(w + ': box ' + k + ' is not inside the Count column of its row'); });
    const want = e.counts.concat([T]);
    const vals = r.LOG.pieces.map(P => +P.text);
    if (vals.slice().sort((a, b) => a - b).join() !== e.counts.concat([T, gate, skip]).sort((a, b) => a - b).join()) fail(w + ': the cards are ' + vals.join(','));
    r.LOG.pieces.forEach((P0, pi) => slots.forEach((z, k) => {
      const rr = EXEC('fill', i, d, L), P = rr.LOG.pieces[pi], v = +P.text;
      const got = rr.LOG.drop(P, { x:z.x + z.w / 2, y:z.y + z.h / 2 });
      if (v === want[k]){ if (got !== true || !P.locked || rr.LOG.miss.length) fail(w + ': ' + v + ' into box ' + k + ' is not accepted'); return; }
      if (got !== false || P.locked || rr.LOG.miss.length !== 1) return fail(w + ': ' + v + ' into box ' + k + ' is not bounced as a mistake');
      const m = rr.LOG.miss[0];
      let expect;
      if (k === 3) expect = (v === skip) ? d.gFillSkip : d.gFillTotal(v);
      else if (e.counts[k] >= 5 && v === Math.floor(e.counts[k] / 5) + e.counts[k] % 5) expect = d.gFillGate;
      else expect = d.gFillRow(v, e.counts[k]);
      /* 那一句的理由要對得上那一列：寫滿一個正字還有剩的才說「再加上後面的幾筆」，剛好一個正字的不可以這樣說 */
      if (k < 3 && expect !== d.gFillGate){
        const after = L === 'zh' ? /再加上後面的幾筆/ : /then add the ones after it/;
        if (after.test(m) !== (e.counts[k] > 5)) fail(w + ': row ' + k + ' has ' + e.counts[k] + ' strokes, the reason "' + m + '" ' + (e.counts[k] > 5 ? 'should' : 'must not') + ' talk about strokes after a full 正');
      }
      if (m !== expect) fail(w + ': ' + v + ' into box ' + k + ' says "' + m + '", should be "' + expect + '"');
      lint(w + ' wrong', m, L);
      /* 那句話說的事要成立：說「不是 v」的，v 真的不是；說「漏加了一列」的，v 真的是少加一列 */
      if (k === 3 && v === skip && !(T - v === e.counts[2])) fail(w + ': "one row left out" but ' + v + ' is not the total minus a row');
    }));
    /* 依序填好（中間每一步的讀數、提示） */
    r = EXEC('fill', i, d, L);
    want.forEach((v, k) => {
      const hh = r.hint2();
      const wantH = k < 3 ? d.gFill2(e.wi, e.cats[k], e.counts[k]) : d.gFill2Total(e.counts, T);
      if (hh !== wantH) fail(w + ': hint2 before box ' + k + ' is "' + hh + '"');
      const n = e.counts[k];
      if (k < 3) seq(w + ' hint2 ' + k, hh, n === 5 ? [5] : n > 5 ? [5, n - 5, 5, n - 5, n] : [n]);
      else seq(w + ' hint2 total', hh, e.counts.concat([T]));
      calc(w + ' hint2 ' + k, hh, k === 3 || n > 5);
      if (r.solved()) fail(w + ': solved before every box is filled');
      const P = r.LOG.pieces.filter(p => !p.locked && +p.text === v)[0];
      const z = slots[k];
      if (!P || r.LOG.drop(P, { x:z.x + z.w / 2, y:z.y + z.h / 2, tap:true }) !== true) fail(w + ': cannot fill box ' + k + ' with ' + v);
      if (r.LOG.line.textContent !== d.gFillNow(k + 1)) fail(w + ': line ' + r.LOG.line.textContent);
      /* 放好的格子再放一次：靜靜彈回 */
      const other = r.LOG.pieces.filter(p => !p.locked)[0], m0 = r.LOG.miss.length;
      if (other && (r.LOG.drop(other, { x:z.x + z.w / 2, y:z.y + z.h / 2 }) !== false || r.LOG.miss.length !== m0)) fail(w + ': a drop on the filled box ' + k + ' is not silent');
    });
    if (!r.solved() || r.LOG.solved.join() !== d.gFillDone(e.counts, T)) fail(w + ': not solved with gFillDone');
    const done = r.LOG.solved[0] || '';
    seq(w + ' done', done, e.counts.concat([T])); calc(w + ' done', done, true); lint(w + ' done', done, L);
    if (r.LOG.pieces.filter(p => !p.locked).map(p => +p.text).sort().join() !== [gate, skip].sort().join()) fail(w + ': the two left-over cards are not the two traps');
    [d.gFillGate, d.gFillSkip].forEach(t => lint(w + ' fixed', t, L));
    seq(w + ' gFillGate', d.gFillGate, [5, 1]);
    /* 四種理由各自要說的事（不和頁面的字典比字典 —— codex 第一輪：gFillRow 改成回傳 gFillGate，上面那幾條會一起變、照樣全綠） */
    {
      const KW = L === 'zh'
        ? { gate:/算 5 筆，不是算 1 筆/, skip:/漏加了一列/, total:/總數要把三列都加起來：不是/, rowBig:/一個正字是 5 筆/, rowFive:/一個寫滿的正字就是 5 筆/, rowSmall:/一筆一筆數/ }
        : { gate:/counts as 5 strokes, not as 1/, skip:/row was left out/, total:/total is all three rows added together: not/, rowBig:/full gate is 5 strokes/, rowFive:/exactly 5 strokes/, rowSmall:/one by one/ };
      const v = 4;
      const R6 = { gate:d.gFillGate, skip:d.gFillSkip, total:d.gFillTotal(v), rowBig:d.gFillRow(v, 7), rowFive:d.gFillRow(v, 5), rowSmall:d.gFillRow(v, 3) };
      Object.keys(R6).forEach(k => {
        if (!KW[k].test(R6[k])) fail(w + ': the "' + k + '" reason does not say ' + KW[k] + ': ' + R6[k]);
        Object.keys(KW).forEach(k2 => { if (k2 !== k && KW[k2].test(R6[k])) fail(w + ': the "' + k + '" reason also reads like the "' + k2 + '" one: ' + R6[k]); });
      });
      if (new Set(Object.values(R6)).size !== 6) fail(w + ': two of the six fill reasons are the same sentence');
      seq(w + ' gFillTotal', R6.total, [v]); seq(w + ' gFillSkip', R6.skip, []);
      seq(w + ' gFillRow 7', R6.rowBig, [5, v]); seq(w + ' gFillRow 5', R6.rowFive, [5, v]); seq(w + ' gFillRow 3', R6.rowSmall, [v]);
    }
  })));

  /* --- 第 4 關（跑起來）：每一張卡 × 每一格 --- */
  D.GAME_RANK.forEach((e, i) => LANGS.forEach(L => guarded(e, i, L, () => {
    const d = I18N[L], w = 'exec rank[' + i + '] ' + L;
    const own = [0, 1, 2].sort((a, b) => e.counts[b] - e.counts[a]);
    let r = EXEC('rank', i, d, L); if (!r) return;
    const tl = r.LOG.zones.filter(z => /\bgtly\b/.test(z.className)).sort((a, b) => a.y - b.y);
    tl.forEach((z, j) => { const x = decodeTally(z.innerHTML, L); if (x.n !== e.counts[j]) fail(w + ': row ' + j + ' strokes read ' + x.n + ' (' + x.why + '), the count says ' + e.counts[j]); });
    const cnt = r.LOG.zones.filter(z => /\bgcnt\b/.test(z.className)).sort((a, b) => a.y - b.y).map(z => z.textContent);
    if (cnt.join() !== e.counts.join()) fail(w + ': the Count column reads ' + cnt.join(','));
    const labels = r.LOG.zones.filter(z => z.className === 'glbl').sort((a, b) => a.x - b.x).map(z => z.textContent);
    const WANT_L = L === 'zh' ? ['最多', '第二多', '最少'] : ['Most', 'Second', 'Fewest'];
    if (labels.join() !== WANT_L.join()) fail(w + ': the boxes are labelled ' + labels.join(' / '));
    const slots = r.LOG.zones.filter(z => /\bgslot\b/.test(z.className)).sort((a, b) => a.x - b.x);
    if (slots.length !== 3) return fail(w + ': ' + slots.length + ' boxes');
    const rowOf = P => e.cats.map(ci => icon(e.wi, ci) + '\n' + catT(e.wi, ci, L)).indexOf(P.text);
    if (r.LOG.pieces.map(rowOf).sort().join() !== '0,1,2') fail(w + ': the cards are ' + r.LOG.pieces.map(P => JSON.stringify(P.text)).join(' '));
    r.LOG.pieces.forEach((P0, pi) => slots.forEach((z, k) => {
      const rr = EXEC('rank', i, d, L), P = rr.LOG.pieces[pi], ri = rowOf(P);
      const got = rr.LOG.drop(P, { x:z.x + z.w / 2, y:z.y + z.h / 2 });
      if (ri === own[k]){ if (got !== true || !P.locked || rr.LOG.miss.length) fail(w + ': the k=' + k + ' card is not accepted'); return; }
      if (got !== false || P.locked || rr.LOG.miss.length !== 1) return fail(w + ': row ' + ri + ' into box ' + k + ' is not bounced as a mistake');
      const a = e.counts[ri], b = e.counts[own[k]], m = rr.LOG.miss[0];
      const expect = a < b ? d.gRankSmall(e.wi, e.cats[ri], a, e.cats[own[k]], b) : d.gRankBig(e.wi, e.cats[ri], a, e.cats[own[k]], b);
      if (m !== expect) fail(w + ': row ' + ri + ' into box ' + k + ' says "' + m + '"');
      seq(w + ' wrong ' + ri + '→' + k, m, a < b ? [a, b, b, a] : [a, b]);
      if (m.indexOf(catT(e.wi, e.cats[ri], L)) < 0 || m.indexOf(catT(e.wi, e.cats[own[k]], L)) < 0) fail(w + ': the reason does not name both kinds: ' + m);
      /* 方向：說「比較多／更前面」的那一句真的成立 */
      if (a < b && !(L === 'zh' ? /這一格要放比較多的/ : /needs the one with more/).test(m)) fail(w + ': a smaller card in a box for a bigger one must say this box needs more');
      if (a > b && !(L === 'zh' ? /要排在更前面/ : /further forward/).test(m)) fail(w + ': a bigger card in a box for a smaller one must say it goes further forward');
      lint(w + ' wrong', m, L);
    }));
    r = EXEC('rank', i, d, L);
    [0, 1, 2].forEach(k => {
      const ci = e.cats[own[k]], hh = r.hint2();
      if (hh !== d.gRank2(k, e.wi, ci, icon(e.wi, ci), e.counts[own[k]])) fail(w + ': hint2 before box ' + k + ' is "' + hh + '"');
      seq(w + ' hint2 ' + k, hh, [e.counts[own[k]]]);
      const P = r.LOG.pieces.filter(p => rowOf(p) === own[k])[0], z = slots[k];
      if (r.LOG.drop(P, { x:z.x + z.w / 2, y:z.y + z.h / 2, tap:true }) !== true) fail(w + ': cannot fill box ' + k);
      if (r.LOG.line.textContent !== d.gRankNow(k + 1)) fail(w + ': line ' + r.LOG.line.textContent);
    });
    const oc = own.map(j => e.counts[j]);
    if (!r.solved() || r.LOG.solved.join() !== d.gRankDone(e.wi, own.map(j => e.cats[j]), oc)) fail(w + ': not solved with gRankDone');
    const done = r.LOG.solved[0] || '';
    seq(w + ' done', done, [oc[0], oc[2]].concat(oc));
    if (done.indexOf(catT(e.wi, e.cats[own[0]], L)) < 0 || done.indexOf(catT(e.wi, e.cats[own[2]], L)) < 0) fail(w + ': gRankDone does not name the most and the fewest');
    lint(w + ' done', done, L);
  })));

  /* --- 第 5 關（跑起來）：每一張卡 × 每一格，算式排好前後各一次 --- */
  D.GAME_EQ.forEach((e, i) => LANGS.forEach(L => guarded(e, i, L, () => {
    const d = I18N[L], w = 'exec eq[' + i + '] ' + L, na = e.counts[e.a], nb = e.counts[e.b], c3 = 3 - e.a - e.b;
    let r = EXEC('eq', i, d, L); if (!r) return;
    const ask = r.LOG.line.textContent;
    if (ask !== d.gEqAsk(e.wi, e.cats[e.a], e.cats[e.b])) fail(w + ': the question is "' + ask + '"');
    if (nums(ask).length) fail(w + ': the question gives a number away: ' + ask);
    if (ask.indexOf(catT(e.wi, e.cats[e.a], L)) < 0 || ask.indexOf(catT(e.wi, e.cats[e.b], L)) < 0 || ask.indexOf(catT(e.wi, e.cats[e.a], L)) > ask.indexOf(catT(e.wi, e.cats[e.b], L))) fail(w + ': the question does not ask "' + catT(e.wi, e.cats[e.a], L) + '" than "' + catT(e.wi, e.cats[e.b], L) + '"');
    const cnt = r.LOG.zones.filter(z => /\bgcnt\b/.test(z.className)).sort((a, b) => a.y - b.y).map(z => z.textContent);
    if (cnt.join() !== e.counts.join()) fail(w + ': the Count column reads ' + cnt.join(','));
    r.LOG.zones.filter(z => /\bgtly\b/.test(z.className)).sort((a, b) => a.y - b.y).forEach((z, j) => { const x = decodeTally(z.innerHTML, L); if (x.n !== e.counts[j]) fail(w + ': row ' + j + ' strokes read ' + x.n + ' (' + x.why + ')'); });
    const slots = r.LOG.zones.filter(z => /\bgslot\b/.test(z.className)).sort((a, b) => a.x - b.x);
    if (slots.length !== 4) return fail(w + ': ' + slots.length + ' boxes, should be □ ○ □ ＝ □');
    const eqZ = r.LOG.zones.filter(z => z.className === 'gorder')[0];
    if (!eqZ || eqZ.textContent !== (L === 'zh' ? '＝' : '=') || !(eqZ.x > slots[2].x && eqZ.x < slots[3].x)) fail(w + ': no "=" between the second number box and the answer box');
    const kindOf = P => P.data.kind;
    const card = (rr, pred) => rr.LOG.pieces.filter(p => !p.locked && pred(p))[0];
    const rowText = j => icon(e.wi, e.cats[j]) + ' ' + e.counts[j];
    const texts = r.LOG.pieces.map(P => P.text).sort().join('|');
    const wantT = [0, 1, 2].map(rowText).concat([d.opMinus, d.opPlus, String(na - nb), String(na + nb)]).sort().join('|');
    if (texts !== wantT) fail(w + ': the cards read ' + texts + ', should be ' + wantT);
    /* 每一張卡 × 每一格（算式還沒排好時） */
    r.LOG.pieces.forEach((P0, pi) => slots.forEach((z, k) => {
      const rr = EXEC('eq', i, d, L), P = rr.LOG.pieces[pi];
      const got = rr.LOG.drop(P, { x:z.x + z.w / 2, y:z.y + z.h / 2 }), miss = rr.LOG.miss[0], info = rr.LOG.info[0];
      const kindSlot = ['row', 'op', 'row', 'ans'][k];
      if (kindOf(P) !== kindSlot){ if (got !== false || rr.LOG.miss.length || P.locked) fail(w + ': "' + P.text + '" in box ' + k + ' (another kind) is not silent'); return; }
      if (k === 3){ if (got !== false || rr.LOG.miss.length || rr.LOG.info.join() !== d.gEqWait) fail(w + ': an answer before the number sentence must only remind (gEqWait), not count'); return; }
      let ok = false, expect = null;
      if (k === 0){ ok = P.data.ri === e.a; expect = ok ? null : (P.data.ri === c3 ? d.gEqOther(e.wi, e.cats[e.a], e.cats[e.b]) : d.gEqOrder(na, nb)); }
      if (k === 2){ ok = P.data.ri === e.b; expect = ok ? null : (P.data.ri === c3 ? d.gEqOther(e.wi, e.cats[e.a], e.cats[e.b]) : d.gEqOrder(na, nb)); }
      if (k === 1){ ok = P.text === d.opMinus; expect = ok ? null : d.gEqPlus; }
      if (ok){ if (got !== true || !P.locked || rr.LOG.miss.length) fail(w + ': "' + P.text + '" into box ' + k + ' is not accepted'); }
      else if (got !== false || P.locked || miss !== expect) fail(w + ': "' + P.text + '" into box ' + k + ' says "' + miss + '", should be "' + expect + '"');
      if (info !== undefined && k !== 3) fail(w + ': a reminder shown for box ' + k);
    }));
    /* 排好算式之後的答案格 */
    r = EXEC('eq', i, d, L);
    if (r.hint2() !== d.gEq2(e.wi, e.cats[e.a], na, e.cats[e.b], nb)) fail(w + ': hint2 is "' + r.hint2() + '"');
    seq(w + ' hint2', r.hint2(), [na, nb, na, nb]);
    [[0, p => p.data.ri === e.a], [2, p => p.data.ri === e.b], [1, p => p.text === d.opMinus]].forEach(([k, pred]) => {
      const z = slots[k];
      if (r.LOG.drop(card(r, pred), { x:z.x + z.w / 2, y:z.y + z.h / 2, tap:true }) !== true) fail(w + ': cannot fill box ' + k);
      if (r.solved()) fail(w + ': solved before the answer');
    });
    const za = slots[3], m0 = r.LOG.miss.length;
    if (r.LOG.drop(card(r, p => p.text === String(na + nb)), { x:za.x + za.w / 2, y:za.y + za.h / 2 }) !== false || r.LOG.miss[m0] !== d.gEqSum(na, nb, na + nb)) fail(w + ': the sum ' + (na + nb) + ' as the answer is not bounced with gEqSum');
    if (r.LOG.drop(card(r, p => p.text === String(na - nb)), { x:za.x + za.w / 2, y:za.y + za.h / 2 }) !== true) fail(w + ': the difference ' + (na - nb) + ' is not accepted');
    if (!r.solved() || r.LOG.solved.join() !== d.gEqDone(e.wi, e.cats[e.a], e.cats[e.b], na, nb, na - nb)) fail(w + ': not solved with gEqDone');
    if (r.LOG.line.textContent !== d.gEqLine(na, nb, na - nb)) fail(w + ': the final line is "' + r.LOG.line.textContent + '"');
    const done = r.LOG.solved[0] || '';
    seq(w + ' done', done, [na, nb, na - nb, na - nb]); calc(w + ' done', done, true); lint(w + ' done', done, L);
    calc(w + ' line', r.LOG.line.textContent, true);
    const sm = d.gEqSum(na, nb, na + nb); seq(w + ' gEqSum', sm, [na, nb, na + nb]); calc(w + ' gEqSum', sm, true); lint(w + ' gEqSum', sm, L);
    const od = d.gEqOrder(na, nb); seq(w + ' gEqOrder', od, [na, nb]); lint(w + ' gEqOrder', od, L);
    [d.gEqPlus, d.gEqWait, d.gEqOther(e.wi, e.cats[e.a], e.cats[e.b])].forEach(t => { lint(w + ' fixed', t, L); if (nums(t).length) fail(w + ': "' + t + '" should carry no numbers'); });
  })));
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/table */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] is not the correct value object',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'two options are the same answer',
      find:'      if (ok(c)){ seen[vkeyOf(c)] = true; out.push(c); }',
      replace:'      if (c){ out.push(c); }' },
    { file:'review', expect:'this lesson always offers 4 options',
      find:'    var i = 0;\n    while (out.length < 3 && i < 60){',
      replace:'    var i = 0;\n    while (out.length < 3 && i < 0){' },

    /* --- review.html：格式化寫錯（證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (lang === 'zh') return n + ' ' + WORLDS[wi].zh.unit;",
      replace:"    if (lang === 'zh') return n + ' ' + WORLDS[wi].zh.thing;" },
    { file:'review', expect:'plural does not match',
      find:"    return n + ' ' + (n === 1 ? WORLDS[wi].en.unit : WORLDS[wi].en.unitN);",
      replace:"    return n + ' ' + WORLDS[wi].en.unit;" },
    { file:'review', expect:'opts[ans] != correct',
      find:'  function catName(wi, ci, lang){ return WORLDS[wi][lang].cats[ci]; }',
      replace:'  function catName(wi, ci, lang){ return WORLDS[wi][lang].cats[(ci + 1) % 4]; }' },
    { file:'review', expect:'opts[ans] != correct',
      find:"        ? ('照顏色分：' + v.cols.map(function(i){ return COLORS[i].zh; }).join('、'))",
      replace:"        ? ('照顏色分：' + v.cols.slice(0, 2).map(function(i){ return COLORS[i].zh; }).join('、'))" },

    /* --- review.html：每一個產生器算錯 --- */
    { file:'review', expect:'the answer must be the row with the largest count',
      find:'        var mi = d.counts.indexOf(Math.max.apply(null, d.counts));\n        var objs = d.cats.map(function(ci){ return CAT(wi, ci); });',
      replace:'        var mi = d.counts.indexOf(Math.min.apply(null, d.counts));\n        var objs = d.cats.map(function(ci){ return CAT(wi, ci); });' },
    { file:'review', expect:'the answer must be the row with the smallest count',
      find:'        var d = uniqueMinSet(4, wi);\n        var li = d.counts.indexOf(Math.min.apply(null, d.counts));',
      replace:'        var d = uniqueMinSet(4, wi);\n        var li = d.counts.indexOf(Math.max.apply(null, d.counts));' },
    { file:'review', expect:'correct is',
      find:'        var t = rand(d.cats.length);\n        var correct = NUM(wi, d.counts[t]);',
      replace:'        var t = rand(d.cats.length);\n        var correct = NUM(wi, d.total);' },
    { file:'review', expect:'correct is',
      find:'        var correct = NUM(wi, d.total);\n        /* 誘答：漏掉第一類、漏掉最後一類、多加 1。 */',
      replace:'        var correct = NUM(wi, d.total - 1);\n        /* 誘答：漏掉第一類、漏掉最後一類、多加 1。 */' },
    { file:'review', expect:'correct is',
      find:'        var diff = d.counts[a] - d.counts[b];\n        var correct = NUM(wi, diff);',
      replace:'        var diff = d.counts[a] - d.counts[b];\n        var correct = NUM(wi, d.counts[a] + d.counts[b]);' },
    { file:'review', expect:'correct is',
      find:'        var correct = NUM(wi, d.counts[h]);\n        /* 誘答：把看得到的加起來當答案、只減掉一列、把總數抄回來。 */',
      replace:'        var correct = NUM(wi, shown);\n        /* 誘答：把看得到的加起來當答案、只減掉一列、把總數抄回來。 */' },
    { file:'review', expect:'correct is',
      find:'        var correct = NUM(wi, k * q);\n        /* 誘答：用加的、少算一類、多算一類。 */',
      replace:'        var correct = NUM(wi, k + q);\n        /* 誘答：用加的、少算一類、多算一類。 */' },
    { file:'review', expect:'the answer must be the row the question names',
      find:'        var objs = d.cats.map(function(ci){ return CAT(wi, ci); });\n        var correct = objs[d.t];',
      replace:'        var objs = d.cats.map(function(ci){ return CAT(wi, ci); });\n        var correct = objs[(d.t + 1) % 4];' },
    { file:'review', expect:'the correct rule must be the single-colour one',
      find:"        var correct = RULE('good', cols, shps[0]);",
      replace:"        var correct = RULE('gap', cols, shps[0]);" },

    /* --- review.html：把課程規則本身弄壞 --- */
    /* 各類加起來 ≠ 總數 —— 這一課唯一的自我檢查規則。 */
    { file:'review', expect:'the rows do not add up to the total',
      find:'    return { wi:wi, cats:cats, counts:counts, total:sum(counts) };',
      replace:'    return { wi:wi, cats:cats, counts:counts, total:sum(counts) + 1 };' },
    /* 平手就沒有唯一答案。這兩筆證明「唯一最大／最小」真的有被驗。 */
    { file:'review', expect:'the largest count is tied',
      find:'      var m = Math.max.apply(null, d.counts);\n      if (d.counts.filter(function(x){ return x === m; }).length === 1) return d;',
      replace:'      var m = Math.max.apply(null, d.counts);\n      if (d.counts.filter(function(x){ return x === m; }).length >= 1) return d;' },
    { file:'review', expect:'the smallest count is tied',
      find:'      var m = Math.min.apply(null, d.counts);\n      if (d.counts.filter(function(x){ return x === m; }).length === 1) return d;',
      replace:'      var m = Math.min.apply(null, d.counts);\n      if (d.counts.filter(function(x){ return x === m; }).length >= 1) return d;' },
    /* 「哪一類剛好有 n 個」抽到重複的數量時，兩列都對。 */
    { file:'review', expect:'more than one row has that count',
      find:'        if (d.counts.filter(function(x){ return x === v; }).length === 1) singles.push(idx);',
      replace:'        if (d.counts.filter(function(x){ return x === v; }).length >= 1) singles.push(idx);' },
    /* 相差題抽到全部一樣多時，「多幾個」是 0。 */
    { file:'review', expect:'must have more than',
      find:'      if (Math.max.apply(null, d.counts) > Math.min.apply(null, d.counts)) return d;',
      replace:'      if (Math.max.apply(null, d.counts) >= Math.min.apply(null, d.counts)) return d;' },
    /* 每一類至少 1 個，不然表格裡會出現「0 個」而畫記是空的。 */
    { file:'review', expect:'each row must hold 1~',
      find:'    var counts = cats.map(function(){ return 1 + rand(hi); });',
      replace:'    var counts = cats.map(function(){ return rand(hi); });' },
    /* 類別重複的話，同一類會在表格裡出現兩列。 */
    { file:'review', expect:'appears twice in the same table',
      find:'    var cats = shuffle([0,1,2,3]).slice(0, k);\n    var counts = cats.map(function(){ return 1 + rand(hi); });',
      replace:'    var cats = shuffle([0,1,2,3]).slice(0, k).map(function(){ return 0; });\n    var counts = cats.map(function(){ return 1 + rand(hi); });' },
    /* 畫記題抽到 5 的倍數時，「只算滿的那幾組」的誘答會等於正解。 */
    { file:'review', expect:'must not be a multiple of 5',
      find:'        var n = pick([6,7,8,9,11,12,13,14]);',
      replace:'        var n = pick([6,7,8,9,10,11,12,13,14]);' },
    /* 畫記題至少要有一個滿組，不然「把一個正字算成 1」的誘答等於正解。 */
    { file:'review', expect:'must be at least 6',
      find:'        var n = pick([6,7,8,9,11,12,13,14]);',
      replace:'        var n = pick([3,6,7,8,9,11,12,13,14]);' },
    /* 選項用了別的世界的單位：一題積木題冒出「5 顆」。 */
    { file:'review', expect:'but the question is world',
      find:'        var cands = shuffle(d.counts.filter(function(_, i){ return i !== t; })\n                     .map(function(n){ return NUM(wi, n); })).concat([NUM(wi, d.total)]);',
      replace:'        var cands = shuffle(d.counts.filter(function(_, i){ return i !== t; })\n                     .map(function(n){ return NUM((wi + 1) % 3, n); })).concat([NUM(wi, d.total)]);' },
    /* 選項不是表格裡的那幾類。 */
    { file:'review', expect:'the options are not exactly the table rows',
      find:'        var objs = d.cats.map(function(ci){ return CAT(wi, ci); });\n        var correct = objs[mi];',
      replace:'        var objs = d.cats.map(function(ci){ return CAT(wi, ci + 4); });\n        var correct = objs[mi];' },
    /* 範圍：把一個誘答換成超出課程範圍的大數。 */
    { file:'review', expect:'outside 1~19',
      find:'        return { wi:wi, ci:ci, n:n, correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'        mix.opts[(mix.ans + 1) % 4] = NUM(wi, 300);\n        return { wi:wi, ci:ci, n:n, correct:correct, opts:mix.opts, ans:mix.ans };' },

    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? ('看' + cn + '那一列的數量欄：' + qtyStr(d.wi, d.counts[d.t], 'zh') + '。')",
      replace:"            ? ('看' + cn + '那一列的數量欄有' + qtyStr(d.wi, d.counts[d.t], 'zh') + '。')" },
    { file:'review', expect:'doubled punctuation',
      find:"            : ('Read the count column on the row for ' + cn + ': ' + qtyStr(d.wi, d.counts[d.t], 'en') + '.')",
      replace:"            : ('Read the count column on the row for ' + cn + ': ' + qtyStr(d.wi, d.counts[d.t], 'en') + '..')" },

    /* --- index.html：範例資料 --- */
    { file:'index', expect:'must give different bin sizes',
      find:'            { col:0, shp:0 } ]',
      replace:'            { col:0, shp:1 } ]' },
    { file:'index', expect:'every card must land in exactly one bin',
      find:'            { col:1, shp:0 }, { col:0, shp:1 }, { col:1, shp:1 }, { col:0, shp:1 },',
      replace:'            { col:2, shp:0 }, { col:0, shp:1 }, { col:1, shp:1 }, { col:0, shp:1 },' },
    { file:'index', expect:'TALLY_EX record',
      find:'  var TALLY_EX = { wi:1, cats:[0,1,2], records:[0,1,0,2,0,1,0,2,1,0] };',
      replace:'  var TALLY_EX = { wi:1, cats:[0,1,2], records:[0,1,0,2,0,1,0,2,1,5] };' },
    { file:'index', expect:'the largest count is tied',
      find:'  var TALLY_EX = { wi:1, cats:[0,1,2], records:[0,1,0,2,0,1,0,2,1,0] };',
      replace:'  var TALLY_EX = { wi:1, cats:[0,1,2], records:[0,1,0,2,0,1,0,2,1,1] };' },
    { file:'index', expect:'READ_EX row 0 must be the strict maximum',
      find:'  var READ_EX = { wi:2, cats:[0,1,2], counts:[6,4,3] };',
      replace:'  var READ_EX = { wi:2, cats:[0,1,2], counts:[3,4,6] };' },
    { file:'index', expect:'READ_EX.counts[2] must be 1~',
      find:'  var READ_EX = { wi:2, cats:[0,1,2], counts:[6,4,3] };',
      replace:'  var READ_EX = { wi:2, cats:[0,1,2], counts:[6,4,30] };' },

    /* --- index.html：畫記的畫法 --- */
    /* 少畫一筆：data-count 說 7 筆，實際只畫 6 筆。 */
    { file:'index', expect:'strokes, expected',
      find:'    return pts.slice(0, k);\n  }\n  function strokesEN(k, ox, oy){',
      replace:'    return pts.slice(0, Math.max(k - 1, 0));\n  }\n  function strokesEN(k, ox, oy){' },
    /* 一組算成 4 筆而不是 5 筆 —— 整個「五筆一組」的規則就錯了。 */
    { file:'index', expect:'strokes, expected',
      find:'      var k = (g < full) ? 5 : rest;\n      var ox = pad + (g % perRow) * (gw + gap);\n      var oy = pad + Math.floor(g / perRow) * rowH;\n      var pts = (form === \'zh\') ? strokesZH(k, ox, oy) : strokesEN(k, ox, oy);',
      replace:'      var k = (g < full) ? 4 : rest;\n      var ox = pad + (g % perRow) * (gw + gap);\n      var oy = pad + Math.floor(g / perRow) * rowH;\n      var pts = (form === \'zh\') ? strokesZH(k, ox, oy) : strokesEN(k, ox, oy);' },
    /* 畫布寬度只算一組：第二組整組被切掉。 */
    { file:'index', expect:'draws out to x=',
      find:'    var w = pad * 2 + cols * gw + (cols - 1) * gap;\n    var h = pad * 2 + rows * rowH;',
      replace:'    var w = pad * 2 + gw;\n    var h = pad * 2 + rows * rowH;' },

    /* --- index.html：字典的名稱與單位詞逐字比對 --- */
    { file:'index', expect:'zh worlds[0].unit is',
      find:"        { thing:'積木', unit:'個', cats:['紅色積木','藍色積木','黃色積木','綠色積木'] },",
      replace:"        { thing:'積木', unit:'塊', cats:['紅色積木','藍色積木','黃色積木','綠色積木'] }," },
    { file:'index', expect:'en worlds[1].cats[2] is',
      find:"        { thing:'stickers', unit:'sticker', unitN:'stickers', cats:['star stickers','moon stickers','flower stickers','rainbow stickers'] },",
      replace:"        { thing:'stickers', unit:'sticker', unitN:'stickers', cats:['star stickers','moon stickers','petal stickers','rainbow stickers'] }," },

    /* --- index.html：範例的說明文字 --- */
    { file:'index', expect:'o2 zh never shows the full number sentence',
      find:"        return '每一張都剛好進一個籃子。<br><span class=\"bigeq\">' + a + ' ＋ ' + b + ' ＝ ' + total +",
      replace:"        return '每一張都剛好進一個籃子。<br><span class=\"bigeq\">' + a + ' ＋ ' + b + ' ＝ ' + (total + 1) +" },
    { file:'index', expect:'b2 zh never shows the full number sentence',
      find:"        return '<span class=\"bigeq\">' + counts.join(' ＋ ') + ' ＝ ' + total + '</span><br>' +",
      replace:"        return '<span class=\"bigeq\">' + counts.join(' ＋ ') + '</span><br>' +" },
    { file:'index', expect:'r2 zh/1 never states the answer sentence',
      find:"        if (i === 1){\n          return '<span class=\"bigeq\">' + counts[0] + ' － ' + counts[2] + ' ＝ ' + (counts[0] - counts[2]) +",
      replace:"        if (i === 1){\n          return '<span class=\"bigeq\">' + counts[0] + ' － ' + counts[2] + ' ＝ ' + (counts[0] - counts[2] + 1) +" },

    /* --- index.html：三層題庫的神諭 --- */
    { file:'index', expect:'the checker expects',
      find:"          opts:['⭐ 星星貼紙','🌙 月亮貼紙','🌸 花朵貼紙','三類一樣多'], ans:0,",
      replace:"          opts:['⭐ 星星貼紙','🌙 月亮貼紙','🌸 花朵貼紙','三類一樣多'], ans:1," },
    /* 分類標準題的正解換成「分到一半改看形狀」—— 那是真的錯的做法。 */
    { file:'index', expect:'the checker expects "照顏色分：紅色、藍色"',
      find:"          opts:['先照顏色分，分到一半改照形狀分','分成紅色和圓形','照顏色分：紅色、藍色','只分成紅色一類'], ans:2,",
      replace:"          opts:['先照顏色分，分到一半改照形狀分','分成紅色和圓形','照顏色分：紅色、藍色','只分成紅色一類'], ans:0," },
    { file:'index', expect:'the stem numbers are',
      find:"        { stem:'統計表寫著：⚽ 6、🏀 4、⚾ 3。<br>足球比棒球多幾顆？',",
      replace:"        { stem:'統計表寫著：⚽ 6、🏀 4、⚾ 5。<br>足球比棒球多幾顆？'," },
    { file:'index', expect:'this lesson always offers 4',
      find:"          opts:['⭐ 星星貼紙','🌙 月亮貼紙','🌸 花朵貼紙','三類一樣多'], ans:0,",
      replace:"          opts:['⭐ 星星貼紙','🌙 月亮貼紙','🌸 花朵貼紙'], ans:0," },
    { file:'index', expect:'does not look like an answer',
      find:"          opts:['9 個','11 個','5 個','6 個'], ans:1,",
      replace:"          opts:['9 個','11 個','banana','6 個'], ans:1," },
    { file:'index', expect:'the tally picture in the stem carries',
      find:"        { stem:'⭐ 星星貼紙那一列的畫記長這樣：' + tallySVG(7, 'zh') + '<br>星星貼紙有幾張？',",
      replace:"        { stem:'⭐ 星星貼紙那一列的畫記長這樣：' + tallySVG(8, 'zh') + '<br>星星貼紙有幾張？'," },
    { file:'index', expect:'expected answers recorded',
      find:"        { stem:'迷思檢查：12 個積木只有 🟥🟦🟨 三種。<br>表上寫 🟥 5、🟦 4、🟨 2。<br>這張表對嗎？',\n          opts:['對，每一類都有數字','不對，加起來只有 11','不對，因為只有 3 類','對，總數不用管'], ans:1,\n          why:'各類加起來要等於總數：5 ＋ 4 ＋ 2 ＝ 11，比 12 少 1，表格一定有地方錯了，要回去一筆一筆對過。' }",
      replace:"        { stem:'迷思檢查：12 個積木只有 🟥🟦🟨 三種。<br>表上寫 🟥 5、🟦 4、🟨 2。<br>這張表對嗎？',\n          opts:['對，每一類都有數字','不對，加起來只有 11','不對，因為只有 3 類','對，總數不用管'], ans:1,\n          why:'各類加起來要等於總數：5 ＋ 4 ＋ 2 ＝ 11，比 12 少 1，一定有一個沒數到。' },\n        { stem:'迷思檢查：全部一共 6 個積木。<br>表上寫 🟥 4、🟦 2。<br>這張表對嗎？',\n          opts:['對','不對','不知道','都可以'], ans:0, why:'4 ＋ 2 ＝ 6。' }" },
    /* --- 第七輪審查（主控端 codex round 3） --- */
    /* 題幹用否定寫法：子字串比對放行，整行比對擋得住。 */
    { file:'index', expect:'no line of the stem is exactly',
      find:"        { stem:'10 張貼紙只有 ⭐🌙🌸 三種。<br>表上 ⭐ 是 5、🌙 是 3。<br>🌸 那一格是幾張？',",
      replace:"        { stem:'10 張貼紙不是只有 ⭐🌙🌸 三種。<br>表上 ⭐ 是 5、🌙 是 3。<br>🌸 那一格是幾張？'," },
    /* 沒有算式的題目：把「最多」的解釋寫成反向敘述，沒有算式可以被拒絕。 */
    { file:'index', expect:'the checker expects "比數量欄的數字：5 比 3 和 2 都大',
      find:"          why:'比數量欄的數字：5 比 3 和 2 都大，所以星星貼紙最多。' },",
      replace:"          why:'比數量欄的數字：5 最小，所以星星貼紙最多。' }," },
    /* 分類標準題的解釋同理。 */
    { file:'index', expect:'why is "隨便分都可以。',
      find:"          why:'這一課一次只看一個特徵，而且每一張都要剛好進一類。分到一半換特徵，",
      replace:"          why:'隨便分都可以。這一課一次只看一個特徵，而且每一張都要剛好進一類。分到一半換特徵," },
    /* 迷思題：算式對，結論卻相反。 */
    { file:'index', expect:'why states the opposite conclusion',
      find:"          why:'各類加起來要等於總數：5 ＋ 4 ＋ 2 ＝ 11，比 12 少 1，表格一定有地方錯了，要回去一筆一筆對過。' }",
      replace:"          why:'各類加起來要等於總數：5 ＋ 4 ＋ 2 ＝ 11，所以這張表是對的。' }" },
    /* 渲染後的句子：標點連兩個、中文黏數字，兩種各一筆。 */
    { file:'index', expect:'doubled punctuation',
      find:"          why:'把每一類加起來：4 ＋ 2 ＋ 5 ＝ 11 個。' },",
      replace:"          why:'把每一類加起來：4 ＋ 2 ＋ 5 ＝ 11 個。。' }," },
    /* missingCell 的英文題幹改成 "The row for X is covered up"。 */
    { file:'review', expect:'doubled punctuation',
      find:"                    ' is covered up. How many ' + ch + ' are there?')) +",
      replace:"                    ' is covered up.. How many ' + ch + ' are there?')) +" },

    /* --- 第六輪審查（主控端 codex round 2） --- */
    /* 重疊選項用了題幹沒保證交集的那個形狀 —— 在某些卡片組合下它其實是合法分類。 */
    { file:'review', expect:'the shape the stem guarantees an overlap for',
      find:"                            RULE('overlap', cols, shps[0]), RULE('gap', cols, shps[0])]);",
      replace:"                            RULE('overlap', cols, shps[1]), RULE('gap', cols, shps[0])]);" },
    /* 沒寫 x／y 的矩形：SVG 預設 0，以前被當成量不到而略過，seen 卻照加。 */
    { file:'index', expect:'draws out to x=1000',
      find:'    s += \'</svg>\';\n    return s;\n  }\n\n  /* 從 records 數出每一類的數量',
      replace:'    s += \'<rect width="1000" height="10"/></svg>\';\n    return s;\n  }\n\n  /* 從 records 數出每一類的數量' },
    /* 座標讀不出來的元素要響亮地失敗，不可以靜靜不算。 */
    { file:'index', expect:'coordinates the geometry reader cannot read',
      find:'      var pts = (form === \'zh\') ? strokesZH(k, ox, oy) : strokesEN(k, ox, oy);',
      replace:'      s += \'<rect x="oops" y="0" width="4" height="4"/>\';\n      var pts = (form === \'zh\') ? strokesZH(k, ox, oy) : strokesEN(k, ox, oy);' },
    /* 解釋算對了，用的卻不是這一題的關係：1 ＋ 1 ＝ 2 也等於 2。 */
    { file:'index', expect:'why never shows the working "10 － 5 － 3 ＝ 2"',
      find:"          why:'各類加起來要等於總數：10 － 5 － 3 ＝ 2 張。' }",
      replace:"          why:'各類加起來要等於總數：1 ＋ 1 ＝ 2 張。' }" },
    /* ans 是字串 "0"：d.opts["0"] 查得到，渲染端的嚴格比較卻會找不到正解。 */
    { file:'review', expect:'is not a whole-number option index',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:String(opts.indexOf(correct)) };' },
    /* 靜態題庫的英文選項單複數不一致，兩個方向各一筆。 */
    { file:'index', expect:'needs the plural',
      find:"          opts:['2 stickers','5 stickers','7 stickers','10 stickers'], ans:2,",
      replace:"          opts:['2 sticker','5 stickers','7 stickers','10 stickers'], ans:2," },
    { file:'index', expect:'needs the singular',
      find:"          opts:['9 balls','2 balls','13 balls','3 balls'], ans:3,",
      replace:"          opts:['9 balls','1 balls','13 balls','3 balls'], ans:3," },
    /* 速查卡與家長頁的五條規則，各一筆（改回缺了一半的舊寫法）。 */
    { file:'reference', expect:'zh.q1b is',
      find:"q1a:'哪一類最多', q1b:'找數量欄最大的數字；兩類一樣大就是平手',",
      replace:"q1a:'哪一類最多', q1b:'找數量欄最大的數字'," },
    { file:'reference', expect:'zh.q5b is',
      find:"q5a:'一個類別的數量看不到', q5b:'總數看得到時，減掉其他類別的數量',",
      replace:"q5a:'一個類別的數量看不到', q5b:'總數減掉看得到的'," },
    { file:'reference', expect:'zh.m3c is',
      find:"m3c:'對不上就一定有錯：可能畫記漏了或多了、數字抄錯，也可能加錯。回去一個一個對記號，再把加法重算一次。',",
      replace:"m3c:'表格一定有地方錯了：比總數少是漏記或加錯，比總數多是重複記'," },
    { file:'parents', expect:'en.s1p1 never states, word for word',
      find:'a mismatch proves something is wrong, while a match is only one check',
      replace:'a mismatch proves something is wrong' },
    /* 否定會讓子字串比對整個失效：「不是」＋那一句，意思剛好相反。 */
    { file:'parents', expect:'negates the required sentence',
      find:'and finally add all the counts and compare with the total',
      replace:'is not true and finally add all the counts and compare with the total' },
    { file:'parents', expect:'zh.h2p is',
      find:'三分鐘後停下來，數畫記說出哪一類最多；兩類一樣多就把兩類都說出來。",',
      replace:'三分鐘後停下來，數畫記說出哪一類最多。",' },
    /* 逐字神諭擋得住「含有關鍵字但把規則反過來教」—— 只比關鍵字的版本會放行。 */
    { file:'reference', expect:'zh.q1b is',
      find:"q1b:'找數量欄最大的數字；兩類一樣大就是平手',",
      replace:"q1b:'找數量欄最大的數字；平手時隨便選一類',", },
    /* 英文的相差問法不可以有方向（大的減小的在 A 比較小的時候是錯的）。 */
    { file:'reference', expect:'en.q3a is',
      find:"      q3a:'What is the difference between two kinds', q3b:'Bigger minus smaller',",
      replace:"      q3a:'How many more one kind has', q3b:'Bigger minus smaller'," },
    { file:'parents', expect:'zh.h3p is',
      find:'講完數畫記，說出票最多的是哪一個；有平手就把平手的都念出來，再問「全部幾票？和我們家幾個人一樣嗎？」",',
      replace:'講完數畫記，宣布哪一個最多票，再問「全部幾票？和我們家幾個人一樣嗎？」",' },

    /* --- 第五輪審查（主控端）：靜態題庫的解釋從來沒有被讀過 --- */
    /* 解釋裡的算式是假的（4 ＋ 2 ＋ 5 寫成 12），正解與選項都沒動。 */
    { file:'index', expect:'works out to 11',
      find:"          why:'把每一類加起來：4 ＋ 2 ＋ 5 ＝ 11 個。' },",
      replace:"          why:'把每一類加起來：4 ＋ 2 ＋ 5 ＝ 12 個。' }," },
    /* 解釋整個被清空。 */
    { file:'index', expect:'why is missing or empty',
      find:"          why:'一個正字是 5 筆，後面還有 2 筆：5 ＋ 2 ＝ 7 張。' },",
      replace:"          why:'' }," },
    /* 解釋算對了，講的卻是別的數 —— 沒有一條算式到得了重算出來的答案。 */
    { file:'index', expect:'never reach the recomputed answer',
      find:"          why:'各類加起來要等於總數：10 － 5 － 3 ＝ 2 張。' }",
      replace:"          why:'各類加起來要等於總數：10 － 5 ＝ 5 張。' }" },

    /* --- 第四輪審查（主控端 codex）補上的守門條件 --- */
    /* 題幹沒說「只有這三種」，剩下的數量就可以分給沒點名的第四類。 */
    { file:'index', expect:'so the named categories are not known to be all of them',
      find:"        { stem:'10 張貼紙只有 ⭐🌙🌸 三種。<br>表上 ⭐ 是 5、🌙 是 3。<br>🌸 那一格是幾張？',",
      replace:"        { stem:'全部一共 10 張貼紙。<br>表上 ⭐ 是 5、🌙 是 3。<br>🌸 那一格是幾張？'," },
    /* 4 類的表每一列最多 6（4 × 6 ＝ 24），給一個不分類別數的 8 就會放行 [8,8,4,4]。 */
    { file:'review', expect:'in a 4-row table',
      find:'    var hi = (k === 4) ? 6 : 8;',
      replace:'    var hi = 8;' },
    /* 誘答超出這一課的總數上限：totalSum 在總數 24 時的 total ＋ 1。 */
    { file:'review', expect:'outside 1~24',
      find:'        return { wi:wi, cats:d.cats, counts:d.counts, total:d.total,\n                 correct:correct, opts:mix.opts, ans:mix.ans };\n      },\n      fmt:function(d, lang){\n        return {\n          stem:(lang === \'zh\'\n                 ? (\'把每一類加起來。',
      replace:'        mix.opts[(mix.ans + 1) % 4] = NUM(wi, 25);\n        return { wi:wi, cats:d.cats, counts:d.counts, total:d.total,\n                 correct:correct, opts:mix.opts, ans:mix.ans };\n      },\n      fmt:function(d, lang){\n        return {\n          stem:(lang === \'zh\'\n                 ? (\'把每一類加起來。' },
    /* equalGroups 的「多算一類」q × (k ＋ 1) 最大到 30。 */
    { file:'review', expect:'outside 1~24',
      find:'                      (q * (k + 1) <= MAX_TOTAL) ? NUM(wi, q * (k + 1)) : null ];',
      replace:'                      NUM(wi, q * (k + 1)) ];' },
    /* 畫布的高度：只驗右緣的話，一張被壓扁的圖照樣過。 */
    { file:'index', expect:'px tall but draws out to y=',
      find:'    var h = pad * 2 + rows * rowH;\n    var s = ',
      replace:'    var h = 8;\n    var s = ' },
    /* viewBox 和畫布對不上：畫面會被縮放，量到的座標就不是看到的座標。 */
    { file:'index', expect:'does not match the canvas',
      find:'    var h = pad * 2 + rows * rowH;\n    var s = \'<svg data-count="\' + n + \'" width="\' + w + \'" height="\' + h + \'" viewBox="0 0 \' + w + \' \' + h +',
      replace:'    var h = pad * 2 + rows * rowH;\n    var s = \'<svg data-count="\' + n + \'" width="\' + w + \'" height="\' + h + \'" viewBox="0 0 5 5\' +' },
    /* 畫了一個量不到的元素：解析器認不得就要報錯，不能靜靜略過。 */
    { file:'index', expect:'which the geometry reader cannot measure',
      find:'             \'" stroke="#2B2A33" stroke-width="3" stroke-linecap="round"/>\';',
      replace:'             \'" stroke="#2B2A33" stroke-width="3" stroke-linecap="round"/><circle cx="1" cy="1" r="1"/>\';' },
    /* 畫到畫布左邊外面：只驗右緣與下緣的話，被左邊切掉不會有人發現。 */
    { file:'index', expect:'clipped by the left edge',
      find:'      var ox = pad + (g % perRow) * (gw + gap);',
      replace:'      var ox = -30 + (g % perRow) * (gw + gap);' },
    /* READ_EX 的類別索引重複：同一類會出現在兩列。 */
    { file:'index', expect:'READ_EX.cats[1] 0 appears twice',
      find:'  var READ_EX = { wi:2, cats:[0,1,2], counts:[6,4,3] };',
      replace:'  var READ_EX = { wi:2, cats:[0,0,2], counts:[6,4,3] };' },
    /* 是非題多出一個「也講得通」的選項：寬鬆的正規式放行，逐字真值表擋得住。 */
    { file:'index', expect:'the option set is',
      find:"          opts:['對，每一類都有數字','不對，加起來只有 11','不對，因為只有 3 類','對，總數不用管'], ans:1,",
      replace:"          opts:['對，每一類都有數字','不對，加起來只有 11','不對，🟨 那一列數錯了','對，總數不用管'], ans:1," },
    /* 前導零：字串不同、值一樣，孩子看到的其實只有三個選項。 */
    { file:'index', expect:'has a leading zero',
      find:"          opts:['2 張','5 張','7 張','10 張'], ans:2,",
      replace:"          opts:['2 張','05 張','7 張','10 張'], ans:2," },
    { file:'index', expect:'are the same value',
      find:"          opts:['9 個','11 個','5 個','6 個'], ans:1,",
      replace:"          opts:['9 個','11 個','05 個','5 個'], ans:1," },

    /* --- 第三輪審查（審檢查腳本自己）補上的守門條件 --- */
    /* 刪掉一張卡片：剩下的卡片全部合法、兩籃也還是加得到總數，只有逐格真值表看得到。 */
    { file:'index', expect:'cards in cell (0,0), the checker expects 3',
      find:'            { col:0, shp:0 } ]',
      replace:'            ]' },
    /* 題庫選項超出這一課自己的範圍。 */
    { file:'index', expect:'outside 1~16',
      find:"          opts:['7 個','8 個','16 個','12 個'], ans:3,",
      replace:"          opts:['7 個','8 個','40 個','12 個'], ans:3," },
    /* emoji 和名稱配錯對。 */
    { file:'index', expect:'does not look like an answer',
      find:"          opts:['⭐ 星星貼紙','🌙 月亮貼紙','🌸 花朵貼紙','三類一樣多'], ans:0,\n          why:'比數量欄的數字：5 比 3 和 2 都大，所以星星貼紙最多。' },",
      replace:"          opts:['⭐ 星星貼紙','⭐ 月亮貼紙','🌸 花朵貼紙','三類一樣多'], ans:0,\n          why:'比數量欄的數字：5 比 3 和 2 都大，所以星星貼紙最多。' }," },
    /* 分類標準的顏色清單重複。 */
    { file:'review', expect:'a colour is repeated in the sorting rule',
      find:'        var cols = shuffle([0,1,2,3]).slice(0, 3);',
      replace:'        var cols = [0,0,1];' },
    { file:'index', expect:'the checker expects "2 張"',
      find:"          opts:['8 張','2 張','5 張','10 張'], ans:1,",
      replace:"          opts:['8 張','4 張','5 張','10 張'], ans:1," },

    /* --- 正字畫記的筆畫位置（2026-08-26）---
       筆數對、位置錯：以前的檢查只比 data-count 和 <line> 的數目，所以
       「中間那一橫畫在長豎左邊」三頁一起錯了也全綠。三頁的斷言都住在
       data.check 裡（它自己去讀另外兩頁），所以 review 那一筆要寫 via:'index'。 */
    { file:'index', expect:'must extend to the RIGHT of the long vertical',
      find:'      [ox + 11, oy + 11, ox + 18, oy + 11],',
      replace:'      [ox + 4, oy + 11, ox + 11, oy + 11],' },
    { file:'reference', expect:'must extend to the RIGHT of the long vertical',
      find:'      [ox + 11, oy + 11, ox + 18, oy + 11],',
      replace:'      [ox + 4, oy + 11, ox + 11, oy + 11],' },
    { file:'review', via:'index', expect:'must extend to the RIGHT of the long vertical',
      find:'      [ox + 11, oy + 11, ox + 18, oy + 11],',
      replace:'      [ox + 4, oy + 11, ox + 11, oy + 11],' },
    /* 中短橫沒有接在長豎上：浮在右邊一格。 */
    { file:'index', expect:'must start on the long vertical',
      find:'      [ox + 11, oy + 11, ox + 18, oy + 11],',
      replace:'      [ox + 13, oy + 11, ox + 18, oy + 11],' },
    /* 左短豎跑到長豎右邊：兩豎都在右邊，那不是正字。 */
    { file:'index', expect:'must be to the LEFT of the long vertical',
      find:'      [ox + 4, oy + 9,  ox + 4,  oy + 19],',
      replace:'      [ox + 16, oy + 9,  ox + 16,  oy + 19],' },
    /* 左短豎接不到下橫：正字缺一角。 */
    { file:'index', expect:'it must reach the bottom bar',
      find:'      [ox + 4, oy + 9,  ox + 4,  oy + 19],',
      replace:'      [ox + 4, oy + 9,  ox + 4,  oy + 15],' },
    /* 五筆變四筆：一組五筆的規則整個垮掉。 */
    { file:'index', expect:'must be five strokes',
      find:'      [ox + 4, oy + 9,  ox + 4,  oy + 19],\n',
      replace:'' },
    /* 三頁畫的不是同一個正字：一頁改對、另一頁忘了跟上。 */
    { file:'reference', expect:'do not draw the same 正',
      find:'      [ox + 11, oy + 11, ox + 18, oy + 11],',
      replace:'      [ox + 11, oy + 11, ox + 17, oy + 11],' },
    /* 認不出 strokesZH：整組筆畫等於沒被檢查，要響亮地失敗。 */
    { file:'review', via:'index', expect:'not checked at all',
      find:'  function strokesZH(k, ox, oy){',
      replace:'  function strokesZH_renamed(k, ox, oy){' },
    /* 畫記倒著長：筆數、座標、陣列都沒變，畫出來卻是從最後一筆開始。
       只讀座標陣列的檢查看不到（第一輪 codex 審查的 HIGH）。 */
    { file:'index', expect:'the strokes have to grow in writing order',
      find:'    return pts.slice(0, k);\n  }\n  function strokesEN(k, ox, oy){',
      replace:'    return pts.slice(5 - k);\n  }\n  function strokesEN(k, ox, oy){' },
    /* 漏掉一個 ox：第一組（ox=0）完全正常，第二組會疊回第一組上面。 */
    { file:'index', expect:'does not move with ox/oy',
      find:'      [ox + 11, oy + 3, ox + 11, oy + 19],',
      replace:'      [11, oy + 3, ox + 11, oy + 19],' },
    /* 左短豎穿到上橫：變成兩條貫穿的豎線，那不是正字（第一輪審查的 MEDIUM）。 */
    { file:'index', expect:'must start below the top bar',
      find:'      [ox + 4, oy + 9,  ox + 4,  oy + 19],',
      replace:'      [ox + 4, oy + 1,  ox + 4,  oy + 19],' },
    /* 左短豎貼到長豎旁邊：兩條線黏成一條粗線。 */
    { file:'index', expect:'merge into one thick stroke',
      find:'      [ox + 4, oy + 9,  ox + 4,  oy + 19],',
      replace:'      [ox + 10, oy + 9,  ox + 10,  oy + 19],' },
    /* 中短橫短得看不見：畫面上只剩長豎。 */
    { file:'index', expect:'it disappears into the vertical',
      find:'      [ox + 11, oy + 11, ox + 18, oy + 11],',
      replace:'      [ox + 11, oy + 11, ox + 12, oy + 11],' },
    /* 左短豎起點只離上橫 1，圓頭線帽一蓋就接上去了：看起來還是兩條貫穿的豎線。 */
    { file:'index', expect:'below the top bar, less than the',
      find:'      [ox + 4, oy + 9,  ox + 4,  oy + 19],',
      replace:'      [ox + 4, oy + 4,  ox + 4,  oy + 19],' },
    /* 線寬 0：兩條「靠太近」的檢查會靜靜地什麼都不擋。 */
    { file:'index', expect:'must be a positive number',
      find:'stroke="#2B2A33" stroke-width="3" stroke-linecap="round"',
      replace:'stroke="#2B2A33" stroke-width="0" stroke-linecap="round"' },
    /* 只在 ox=0 與 ox=7 對的位移：抽兩個數字驗的話會過，真正的原點是 3、37…… */
    { file:'index', expect:'does not move with ox/oy',
      find:'      [ox + 2, oy + 3,  ox + 20, oy + 3],',
      replace:'      [ox + ox * (ox - 7) + 2, oy + 3,  ox + 20, oy + 3],' },
    /* 讀不到版面常數就等於沒有驗真正的原點 —— 要響亮地失敗。 */
    { file:'index', expect:'the real group origins are not checked',
      find:'    var gw = 24, gap = 10, rowH = 26, pad = 3, perRow = 5;',
      replace:'    var gw = 24, gap = 10, rowH = 26, pad = 3, perRow = 5, spare = 0;' },
    /* ---- 小遊戲（2026-10-02 改版，§六之五）：每一筆各改壞一條規則 ---- */
    /* first match instead of nearest */
    { file:'index', expect:"nearestOpen() picks the wrong box",
      find:"if (dd < bd || (dd === bd && dc < bc)){ bd = dd; bc = dc; best = b; }",
      replace:"if (!best){ bd = dd; bc = dc; best = b; }" },
    /* measure to the centre instead of the box */
    { file:'index', expect:"nearestOpen() picks the wrong box",
      find:"var dd = ex * ex + ey * ey, dc = dx * dx + dy * dy;",
      replace:"var dd = dx * dx + dy * dy, dc = dd;" },
    /* a mistake deducts a star */
    { file:'index', expect:"stars: a mistake changed the score",
      find:"function roundMiss(text){ gMistakes++; gMsg.innerHTML",
      replace:"function roundMiss(text){ gMistakes++; gScore = Math.max(0, gScore - 1); elScore.textContent = gScore; gMsg.innerHTML" },
    /* mistakes never cost the second star */
    { file:'index', expect:"gives 2 stars, should be 1",
      find:"var stars = gMistakes === 0 ? 2 : 1;",
      replace:"var stars = 2;" },
    /* the tray may start in the answer order */
    { file:'index', expect:"shuffle() of an already ordered rank tray",
      find:"    if (up){ var t0 = a[0]; a[0] = a[1]; a[1] = t0; }\n",
      replace:"" },
    /* no lost-capture safety */
    { file:'index', expect:"lost pointer capture does not put the piece back",
      find:"    el.addEventListener('lostpointercapture', function(e){ end(e, true); });\n",
      replace:"" },
    /* a stale piece acts on the new board */
    { file:'index', expect:"a piece still held when the board is rebuilt",
      find:"      if (gen !== gGen) return;   /* 這一塊屬於已經拿掉的畫板 */\n",
      replace:"" },
    /* ahead mode without the automatic hint */
    { file:'index', expect:"ahead mode does not show hint level 1",
      find:"if (mode === 'ahead'){ hintLevel = 1; showHint(); }",
      replace:"if (mode === 'ahead'){ hintLevel = 0; }" },
    /* the hint button stays on */
    { file:'index', expect:"the hint button is not disabled",
      find:"    if (hintLevel >= 2) gHintBtn.disabled = true;\n",
      replace:"" },
    /* sort: any basket takes any card */
    { file:'index', expect:"is not bounced as a mistake",
      find:"if (t.b !== want){ roundMiss(",
      replace:"if (t.b !== want && false){ roundMiss(" },
    /* sort: the rules are swapped */
    { file:'index', expect:"sortBin(0, 1) is",
      find:"function sortBin(rule, c){ return rule === 0 ? cardCol(c) : cardShp(c); }",
      replace:"function sortBin(rule, c){ return rule === 0 ? cardShp(c) : cardCol(c); }" },
    /* sort: the reason names the wrong basket */
    { file:'index', expect:"the reason does not name",
      find:"'的，要放進「' + this.sortCats[rule][b] + '」。這一關只看'",
      replace:"'的，要放進「' + this.sortCats[rule][1 - b] + '」。這一關只看'" },
    /* sort: a pool entry without 🔵 */
    { file:'index', expect:"all four kinds of card must be there",
      find:"{ rule:0, cards:[0,3,1,2,0,1,3] }",
      replace:"{ rule:0, cards:[0,3,1,0,0,1,3] }" },
    /* sort: placed cards run out of the basket */
    { file:'index', expect:"a placed card sticks out of its basket",
      find:"miniStep:35",
      replace:"miniStep:40" },
    /* sort: the baskets no longer share an overlap zone */
    { file:'index', expect:"nearest sort: no two drop pads overlap",
      find:"var SORT_BIN = { x:[6, 154]",
      replace:"var SORT_BIN = { x:[6, 160]" },
    /* sort: the closing sum is wrong */
    { file:'index', expect:"zh done: numbers should read",
      find:"return '每一張都剛好進一個籃子：' + a + ' ＋ ' + b + ' ＝ ' + this.cardQty(n) + '。';",
      replace:"return '每一張都剛好進一個籃子：' + a + ' ＋ ' + b + ' ＝ ' + this.cardQty(n + 1) + '。';" },
    /* tally: any row takes the stroke */
    { file:'index', expect:"does not say why",
      find:"if (i !== ri){ roundMiss(",
      replace:"if (i !== ri && false){ roundMiss(" },
    /* tally: the stroke lands on another row */
    { file:'index', expect:"from their strokes, should be",
      find:"        counts[i]++; pos++;",
      replace:"        counts[(i + 1) % 3]++; pos++;" },
    /* tally: the 正 middle bar drawn on the left (the 2026-08-26 bug) */
    { file:'index', expect:"is not the short bar to the RIGHT",
      find:"      [ox + 11, oy + 11, ox + 18, oy + 11],",
      replace:"      [ox + 4, oy + 11, ox + 11, oy + 11]," },
    /* tally: taps after the end still count */
    { file:'index', expect:"taps after the round is solved",
      find:"if (gSolved || pos >= n) return;",
      replace:"if (pos >= n + 99) return;" },
    /* tally: a pool entry where no row passes five */
    { file:'index', expect:"one must pass a full 正",
      find:"{ wi:1, cats:[0,1,3], records:[1,0,1,1,2,1,0,1,2,1] }",
      replace:"{ wi:1, cats:[0,1,3], records:[1,0,1,1,2,0,0,1,2,1] }" },
    /* tally: the English closing sum is wrong */
    { file:'index', expect:"en done: numbers should read",
      find:"' = ' + n + ', the same as all ' + this.qty(wi, n) + '.';",
      replace:"' = ' + (n + 1) + ', the same as all ' + this.qty(wi, n) + '.';" },
    /* tally: the wrong item is lit */
    { file:'index', expect:"is not the only one lit up",
      find:"(i === pos ? ' on' : '')",
      replace:"(i === pos + 1 ? ' on' : '')" },
    /* tally: the gate diagonal misses the first bar */
    { file:'index', expect:"gate stroke 5 does not cross all four",
      find:"      [ox + 1,  oy + 18, ox + 20, oy + 4]",
      replace:"      [ox + 5,  oy + 18, ox + 20, oy + 4]" },
    /* tally: one gate bar shorter than the others */
    { file:'index', expect:"is not the next vertical",
      find:"      [ox + 13, oy + 3,  ox + 13, oy + 19],",
      replace:"      [ox + 13, oy + 6,  ox + 13, oy + 19]," },
    /* fill: any box takes any card */
    { file:'index', expect:"is not bounced as a mistake",
      find:"if (v !== s.want){",
      replace:"if (v !== s.want && false){" },
    /* fill: the 正-as-1 trap is computed wrongly */
    { file:'index', expect:"counting each 正 as 1 gives",
      find:"function fillGateDecoy(n){ return Math.floor(n / 5) + n % 5; }",
      replace:"function fillGateDecoy(n){ return n - 1; }" },
    /* fill: the 正-as-1 reason never fires */
    { file:'index', expect:"should be \"一個正字算 5 筆，不是算 1 筆",
      find:"else if (e.counts[s.k] >= 5 && v === fillGateDecoy(e.counts[s.k])) roundMiss(d.gFillGate);",
      replace:"else if (false) roundMiss(d.gFillGate);" },
    /* fill: the left-out-row reason never fires */
    { file:'index', expect:"should be \"漏加了一列",
      find:"roundMiss(v === total - last ? d.gFillSkip : d.gFillTotal(v));",
      replace:"roundMiss(d.gFillTotal(v));" },
    /* fill: the boxes sit in the tally column */
    { file:'index', expect:"is not inside the Count column",
      find:"var sx = T.x + T.nameW + T.tallyW + (T.w - T.nameW - T.tallyW) / 2;",
      replace:"var sx = T.x + T.nameW + T.tallyW / 2;" },
    /* fill: number cards overlap in the tray */
    { file:'index', expect:"\" overlap",
      find:"var FILL_CARD = { w:GPICK, h:52, step:50,",
      replace:"var FILL_CARD = { w:GPICK, h:52, step:46," },
    /* fill: a trap card equals a real count */
    { file:'index', expect:"must all differ",
      find:"{ wi:1, cats:[0,1,2], counts:[7,4,2] }",
      replace:"{ wi:1, cats:[0,1,2], counts:[7,3,2] }" },
    /* fill: the table draws one stroke too many */
    { file:'index', expect:"from its strokes (",
      find:"if (!tot){ tz.innerHTML = tallySVG(e.counts[i], tallyForm());",
      replace:"if (!tot){ tz.innerHTML = tallySVG(e.counts[i] + 1, tallyForm());" },
    /* fill: the English second hint adds wrongly */
    { file:'index', expect:"hint2 0: numbers should read",
      find:"' more → 5 + ' + (n - 5) + ' = ' + n + '.';",
      replace:"' more → 5 + ' + (n - 4) + ' = ' + n + '.';" },
    /* rank: any box takes any card */
    { file:'index', expect:"is not bounced as a mistake",
      find:"if (ri !== want){\n          var a = e.counts[ri]",
      replace:"if (ri !== want && false){\n          var a = e.counts[ri]" },
    /* rank: ranked fewest first */
    { file:'index', expect:"card is not accepted",
      find:"sort(function(a, b){ return e.counts[b] - e.counts[a]; });\n      var line = trailLine(d.gRankNow(0));",
      replace:"sort(function(a, b){ return e.counts[a] - e.counts[b]; });\n      var line = trailLine(d.gRankNow(0));" },
    /* rank: the two reasons are swapped */
    { file:'index', expect:"must say this box needs more",
      find:"roundMiss(a < b ? d.gRankSmall(",
      replace:"roundMiss(a > b ? d.gRankSmall(" },
    /* rank: the zh reason compares the wrong way */
    { file:'index', expect:"zh wrong",
      find:"b + ' 比 ' + a + ' 大，這一格要放比較多的。';",
      replace:"a + ' 比 ' + b + ' 大，這一格要放比較多的。';" },
    /* rank: a pool entry with a tie for most */
    { file:'index', expect:"tie, so",
      find:"{ wi:1, cats:[0,1,2], counts:[3,7,5] }",
      replace:"{ wi:1, cats:[0,1,2], counts:[3,7,7] }" },
    /* rank: the tray is shuffled by reversed ranks, so it may start in the answer order */
    { file:'index', expect:"the tray is not built from the ranks",
      find:"renderTray(B, order.map(function(_, k){ return k; }), Cd.y,",
      replace:"renderTray(B, order.map(function(_, k){ return 2 - k; }), Cd.y," },
    /* rank: the zh box labels are reversed */
    { file:'index', expect:"the boxes are labelled",
      find:"gRankSlots:['最多', '第二多', '最少'],",
      replace:"gRankSlots:['最少', '第二多', '最多']," },
    /* eq: the plus sign is accepted */
    { file:'index', expect:"into box 1 says",
      find:"if (s.kind === 'op' && c.op !== '-'){",
      replace:"if (s.kind === 'op' && c.op !== '-' && false){" },
    /* eq: smaller first is accepted */
    { file:'index', expect:"into box 0 says",
      find:"if (s.kind === 'row' && c.ri !== s.want){",
      replace:"if (s.kind === 'row' && c.ri !== e.a && c.ri !== e.b){" },
    /* eq: the answer goes in before the number sentence */
    { file:'index', expect:"must only remind",
      find:"          if (!(s0.done && op.done && s2.done)){ roundInfo(d.gEqWait); return false; }   /* 只提醒、不算錯 */\n",
      replace:"" },
    /* eq: answering early counts as a mistake */
    { file:'index', expect:"must only remind",
      find:"if (!(s0.done && op.done && s2.done)){ roundInfo(d.gEqWait); return false; }",
      replace:"if (!(s0.done && op.done && s2.done)){ roundMiss(d.gEqWait); return false; }" },
    /* eq: the sum is accepted as "how many more" */
    { file:'index', expect:"is not bounced with gEqSum",
      find:"if (c.v !== diff){ roundMiss(",
      replace:"if (c.v !== diff && c.v !== sum){ roundMiss(" },
    /* eq: the difference equals a count on the table */
    { file:'index', expect:"is also a count on the table",
      find:"{ wi:0, cats:[0,1,3], counts:[3,8,4], a:1, b:0 }",
      replace:"{ wi:0, cats:[0,1,3], counts:[3,8,5], a:1, b:0 }" },
    /* eq: the boxes no longer share an overlap zone */
    { file:'index', expect:"nearest eq: no two drop pads overlap",
      find:"op:{ cx:108, w:48 }",
      replace:"op:{ cx:108, w:30 }" },
    /* eq: the zh closing line names the wrong number */
    { file:'index', expect:"zh done: numbers should read",
      find:"'多 ' + this.qty(wi, dd) + '。';\n      },\n      gEq2",
      replace:"'多 ' + this.qty(wi, na) + '。';\n      },\n      gEq2" },
    /* eq: the English question is reversed */
    { file:'index', expect:"the question does not ask",
      find:"return 'How many more ' + this.catName(wi, ca) + ' than ' + this.catName(wi, cb) + '?';",
      replace:"return 'How many more ' + this.catName(wi, cb) + ' than ' + this.catName(wi, ca) + '?';" },
    /* layout: sort cards too small to pick up */
    { file:'index', expect:"under 44",
      find:"var SORT_CARD = { size:56,",
      replace:"var SORT_CARD = { size:40," },
    /* layout: tally rows too short to tap */
    { file:'index', expect:"is under 44px on a phone",
      find:"var TALLY_ROW = { x:6, w:288, h:56,",
      replace:"var TALLY_ROW = { x:6, w:288, h:40," },
    /* layout: the rank board is cut short */
    { file:'index', expect:"opens a board of",
      find:"var B = makeBoard(GAME_W, RANK_H);",
      replace:"var B = makeBoard(GAME_W, 200);" },
    /* layout: the sign/answer cards hang off the board */
    { file:'index', expect:"is outside the board",
      find:"var EQ_SMALL = { w:GPICK, h:52, step:60, y:316 };",
      replace:"var EQ_SMALL = { w:GPICK, h:52, step:60, y:340 };" },
    /* text: the tap-only round does not say so */
    { file:'index', expect:"must say it is all taps",
      find:"tally:'這一關用點的：",
      replace:"tally:'這一關：" },
    /* ---- codex 第一輪（設定檔）之後補的 ---- */
    /* codex r1: the tray is drawn in pool order while shuffle() is still called */
    { file:'index', expect:"the shuffled order is not what is drawn",
      find:"shuffle(items).forEach(function(it, i){",
      replace:"(shuffle(items), items).forEach(function(it, i){" },
    /* codex r1: target() centres drift from the drawn box */
    { file:'index', expect:"is not the box it draws",
      find:"var t = { z:addZone(B, x, y, w, h, cls), cx:x + w / 2,",
      replace:"var t = { z:addZone(B, x, y, w, h, cls), cx:x + w / 2 + 0.5," },
    /* codex r1: rank boxes too short to tap */
    { file:'index', expect:"a drop box (",
      find:"var RANK_SLOT = { x:[50, 150, 250], y:200, w:94, h:64,",
      replace:"var RANK_SLOT = { x:[50, 150, 250], y:200, w:94, h:40," },
    /* codex r1: the tally rows are drawn off the board */
    { file:'index', expect:"a row button is outside the board",
      find:"var TALLY_ROW = { x:6, w:288, h:56, y:48,",
      replace:"var TALLY_ROW = { x:6, w:288, h:56, y:400," },
    /* codex r1: an ordinary miscount claims the 正 was counted as 1 */
    { file:'index', expect:"the \"rowBig\" reason does not say",
      find:"if (n > 5) return '一個正字是 5 筆，再加上後面的幾筆：這一列不是 ' + v + ' 筆。';",
      replace:"if (n > 5) return this.gFillGate;" },
    /* codex r1: the 正 middle bar written right-to-left */
    { file:'index', expect:"is not the short bar to the RIGHT",
      find:"      [ox + 11, oy + 11, ox + 18, oy + 11],",
      replace:"      [ox + 18, oy + 11, ox + 11, oy + 11]," },
    /* codex r1: a flat gate stroke that misses three of the bars */
    { file:'index', expect:"gate stroke 5 does not cross all four",
      find:"      [ox + 1,  oy + 18, ox + 20, oy + 4]",
      replace:"      [ox + 1,  oy + 2, ox + 20, oy + 3.5]" },
    /* fill: a row of exactly one 正 is told to add the strokes after it */
    { file:'index', expect:"must not talk about strokes after a full 正",
      find:"if (n === 5) return '一個寫滿的正字就是 5 筆：這一列不是 ' + v + ' 筆。';",
      replace:"if (n === 5) return '一個正字是 5 筆，再加上後面的幾筆：這一列不是 ' + v + ' 筆。';" }
  ],

  sim: {
    /* 這一課的選項都帶單位或是類別名（「5 個」「紅色積木」），
       simgen 的通用「誘答抄題幹」檢查比的是整個選項字串對題幹的數字，
       永遠比不到 —— 所以「刻意把題幹的數字當誘答」由每個產生器自己的
       不變條件把關（例如 diffTwo 的兩個誘答就是題幹的兩個數字，那是刻意的）。 */
    stemEchoOk: {},

    INVARIANTS: {
      mostCat: d => setOk(d, 4, 4) || strictMax(d) || distinctOpts(d) || optWorldOk(d) ||
        catOptsAreRows(d) ||
        (d.correct.ci !== d.cats[d.counts.indexOf(Math.max.apply(null, d.counts))]
          ? 'the answer must be the row with the largest count' : null) ||
        /* distinctOpts／optWorldOk 上面已經跑過了，這裡只剩「標對了嗎」。 */
        answerIs(d, 'cat#' + d.cats[d.counts.indexOf(Math.max.apply(null, d.counts))]),

      leastCat: d => setOk(d, 4, 4) || strictMin(d) || distinctOpts(d) || optWorldOk(d) ||
        catOptsAreRows(d) ||
        (d.correct.ci !== d.cats[d.counts.indexOf(Math.min.apply(null, d.counts))]
          ? 'the answer must be the row with the smallest count' : null) ||
        answerIs(d, 'cat#' + d.cats[d.counts.indexOf(Math.min.apply(null, d.counts))]),

      readCell: d => setOk(d, 3, 4) ||
        (!Number.isInteger(d.t) || d.t < 0 || d.t >= d.cats.length
          ? 'the row being asked about (' + d.t + ') is not a row of this table' : null) ||
        base(d, 'num#' + d.counts[d.t]),

      tallyRead: d => worldOk(d) ||
        (!Number.isInteger(d.ci) || d.ci < 0 || d.ci >= WORLD_TRUTH[d.wi].zh.cats.length
          ? 'category index ' + d.ci + ' is outside world ' + d.wi : null) ||
        /* 一組是五筆。少於 6 筆就沒有滿組，「把一個正字算成 1」的誘答會等於正解。 */
        (!(d.n >= 6 && d.n <= 14) ? 'the tally must be at least 6 and at most 14 strokes, got ' + d.n : null) ||
        (d.n % 5 === 0 ? 'the tally must not be a multiple of 5, or the ignore-the-leftovers distractor equals the answer' : null) ||
        base(d, 'num#' + d.n),

      totalSum: d => setOk(d, 3, 4) || base(d, 'num#' + sum(d.counts)),

      diffTwo: d => setOk(d, 3, 3) ||
        (!Number.isInteger(d.a) || !Number.isInteger(d.b) || d.a === d.b ||
         d.a < 0 || d.b < 0 || d.a >= d.cats.length || d.b >= d.cats.length
          ? 'the two rows being compared must be two different rows of this table' : null) ||
        (!(d.counts[d.a] > d.counts[d.b])
          ? 'row a must have more than row b, otherwise "how many more" has no positive answer' : null) ||
        base(d, 'num#' + (d.counts[d.a] - d.counts[d.b])),

      missingCell: d => setOk(d, 3, 3) ||
        (!Number.isInteger(d.h) || d.h < 0 || d.h >= d.cats.length
          ? 'the covered row (' + d.h + ') is not a row of this table' : null) ||
        base(d, 'num#' + (d.total - sum(d.counts.filter((_, i) => i !== d.h)))),

      sortRule: d => worldOk(d) ||
        (!Array.isArray(d.cols) || d.cols.length !== 3
          ? 'the stem must name exactly 3 colours, so that leaving one out is a real mistake' : null) ||
        (new Set(d.cols).size !== 3 ? 'the three colours must be different' : null) ||
        (d.cols.some(i => !Number.isInteger(i) || i < 0 || i >= COLOR_TRUTH.length)
          ? 'a colour index is outside the checker catalogue' : null) ||
        (!Array.isArray(d.shps) || d.shps.length !== 2 || new Set(d.shps).size !== 2
          ? 'the stem must name exactly 2 different shapes' : null) ||
        (d.shps.some(i => !Number.isInteger(i) || i < 0 || i >= SHAPE_TRUTH.length)
          ? 'a shape index is outside the checker catalogue' : null) ||
        (d.correct.k !== 'good' ? 'the correct rule must be the single-colour one covering all three colours' : null) ||
        distinctOpts(d) ||
        /* 四個選項要剛好是「對的那一個」＋三種各違反一條規則的錯法。 */
        (['good','switch','overlap','gap'].some(k => !d.opts.some(o => o.u === 'rule' && o.k === k))
          ? 'the four options must be the good rule plus the switch / overlap / gap mistakes' : null) ||
        /* 每一個選項的內容也要對得上題幹。只驗「四種 k 都在」的話，把重疊選項
           改成用第二種形狀（題幹沒有保證那個交集存在）也會通過 ——
           而那個選項在某些卡片組合下其實是合法分類，就變成「正確推理到得了的錯誤選項」。 */
        (d.opts.some(o => o.u !== 'rule' || o.cols.join(',') !== d.cols.join(','))
          ? 'every rule option must list this question\'s three colours in the stem order' : null) ||
        (d.opts.some(o => o.shp !== d.shps[0])
          ? 'every rule option must use the shape the stem guarantees an overlap for (shps[0])' : null) ||
        answerIs(d, 'rule#good'),

      whichHasN: d => setOk(d, 4, 4) ||
        (!Number.isInteger(d.t) || d.t < 0 || d.t >= d.cats.length
          ? 'the row being asked about (' + d.t + ') is not a row of this table' : null) ||
        (d.counts.filter(x => x === d.counts[d.t]).length !== 1
          ? 'more than one row has that count, so the question has no unique answer' : null) ||
        distinctOpts(d) || optWorldOk(d) || catOptsAreRows(d) ||
        (d.correct.ci !== d.cats[d.t] ? 'the answer must be the row the question names' : null) ||
        answerIs(d, 'cat#' + d.cats[d.t]),

      equalGroups: d => worldOk(d) ||
        (!Number.isInteger(d.k) || d.k < 3 || d.k > 4 ? 'this generator uses 3~4 rows, got ' + d.k : null) ||
        (!Number.isInteger(d.q) || d.q < 2 || d.q > 6 ? 'each row must hold 2~6 things, got ' + d.q : null) ||
        (d.k * d.q > MAX_TOTAL ? 'total ' + (d.k * d.q) + ' is above this lesson range of ' + MAX_TOTAL : null) ||
        base(d, 'num#' + (d.k * d.q))
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數與這個設定檔自己的世界表重算，
       完全不呼叫 review.html 的 valStr／qtyStr —— 拿產生器自己的格式化函式來比
       等於自己比自己（2026-08-25 time 那一課的教訓）。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'mostCat':     return fCat(d.wi, d.cats[d.counts.indexOf(Math.max.apply(null, d.counts))], lang);
        case 'leastCat':    return fCat(d.wi, d.cats[d.counts.indexOf(Math.min.apply(null, d.counts))], lang);
        case 'whichHasN':   return fCat(d.wi, d.cats[d.t], lang);
        case 'readCell':    return fNum(d.wi, d.counts[d.t], lang);
        case 'tallyRead':   return fNum(d.wi, d.n, lang);
        case 'totalSum':    return fNum(d.wi, sum(d.counts), lang);
        case 'diffTwo':     return fNum(d.wi, d.counts[d.a] - d.counts[d.b], lang);
        case 'missingCell': return fNum(d.wi, d.total - sum(d.counts.filter((_, i) => i !== d.h)), lang);
        case 'equalGroups': return fNum(d.wi, d.k * d.q, lang);
        case 'sortRule': {
          const cs = d.cols.map(i => COLOR_TRUTH[i][lang]);
          return lang === 'zh' ? ('照顏色分：' + cs.join('、')) : ('Sort by colour: ' + cs.join(', '));
        }
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：形狀（數量／類別／分類標準）要是這個產生器允許的，
       數字要落在範圍裡，英文還要單複數一致。正解與誘答用同一組規則 ——
       這一課沒有刻意寫錯的選項。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]/.test(t)) return 'junk option ' + t;
      const allowed = SHAPE[genId];
      if (!allowed) return 'no option shape recorded for ' + genId;
      const hit = allowed.filter(k => SHAPES[lang][k].test(t));
      if (hit.length !== 1) return 'bad option shape for ' + genId + ': ' + t;
      /* 分類標準的顏色清單不可以有重複 —— 正規式只管「每一項都是合法顏色」，
         「紅色、紅色」照樣會過。產生器那邊的不變條件也擋了一次，這是第二道。 */
      if (hit[0] === 'rule'){
        const m = t.match(/^(?:照顏色分：|Sort by colour: )(.+)$/);
        if (m){
          const parts = m[1].split(lang === 'zh' ? '、' : ', ');
          if (new Set(parts).size !== parts.length) return 'a colour is repeated in the sorting rule: ' + t;
        }
        return null;
      }
      /* 類別名沒有數字，數字範圍那一段跳過（但形狀已經逐字比對過了）。 */
      if (hit[0] !== 'num') return null;
      if (lang === 'en'){
        const m = t.match(/(\d+) ([a-z]+)/);
        if (m){
          const n = Number(m[1]), w = m[2];
          if (EN_SING.indexOf(w) >= 0 && n !== 1) return 'plural does not match the number: ' + t;
          if (EN_PLUR.indexOf(w) >= 0 && n === 1) return 'plural does not match the number: ' + t;
        }
      }
      const bounds = RANGE[genId];
      if (!bounds) return 'no numeric range recorded for ' + genId;
      const nums = (t.match(/\d+/g) || []).map(Number);
      if (!nums.length) return 'no number in option ' + t;
      for (const v of nums){
        if (!(v >= bounds[0] && v <= bounds[1])){
          return 'option ' + t + ' contains ' + v + ', outside ' + bounds[0] + '~' + bounds[1];
        }
      }
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{WORLDS, CARD_ICONS, SORT_EX, TALLY_EX, READ_EX, tallySVG, countsUpTo, ' +
      'GAME_W, GPICK, GPAD, GAME_ORDER, GAME_SORT, cardCol, cardShp, sortBin, SORT_H, SORT_BIN, SORT_CARD, ' +
      'GAME_TALLY, TALLY_H, TALLY_CHIP, TALLY_ROW, TALLY_ZOOM, GAME_FILL, fillGateDecoy, fillCards, FILL_H, FILL_TAB, FILL_CARD, ' +
      'GAME_RANK, RANK_H, RANK_TAB, RANK_SLOT, RANK_CARD, GAME_EQ, EQ_H, EQ_SLOT, EQ_ROWCARD, EQ_SMALL}',
    check: function(data, I18N, fail, src){
      const LANGS = ['zh','en'];

      /* --- 世界表：圖案（資料區）與名稱／單位詞（字典）用 wi/ci 對齊 --- */
      if (data.WORLDS.length !== WORLD_TRUTH.length){
        fail(`WORLDS has ${data.WORLDS.length} worlds; the checker knows ${WORLD_TRUTH.length}`);
      }
      data.WORLDS.forEach((w, i) => {
        const t = WORLD_TRUTH[i] || { icons:[] };
        if (!Array.isArray(w.icons) || w.icons.length !== 4) fail(`WORLDS[${i}] must have 4 icons`);
        else w.icons.forEach((ic, j) => {
          if (ic !== t.icons[j]) fail(`WORLDS[${i}].icons[${j}] is "${ic}", the checker expects "${t.icons[j]}"`);
          /* 帶變體選擇符的 emoji 在算文字寬度時會被當成兩個字，畫布檢查就會誤判。 */
          if ([...String(ic)].length !== 1) fail(`WORLDS[${i}].icons[${j}] must be a single code point, got "${ic}"`);
        });
      });
      LANGS.forEach(L => {
        const ws = I18N[L].worlds;
        if (!Array.isArray(ws) || ws.length !== data.WORLDS.length){
          fail(`${L} worlds: ${(ws || []).length} entries but WORLDS has ${data.WORLDS.length}`);
          return;
        }
        ws.forEach((w, i) => {
          const t = (WORLD_TRUTH[i] || { zh:{}, en:{} })[L];
          /* 只驗「有沒有填」擋不住錯字：個 → 塊、star → sun 都會照樣通過，
             而後面每一條渲染檢查用的又是同一本字典 —— 等於自己比自己。 */
          const keys = (L === 'zh') ? ['thing','unit'] : ['thing','unit','unitN'];
          keys.forEach(k => {
            if (!w[k]) fail(`${L} worlds[${i}] is missing ${k}`);
            else if (w[k] !== t[k]) fail(`${L} worlds[${i}].${k} is "${w[k]}", the checker expects "${t[k]}"`);
          });
          if (!Array.isArray(w.cats) || w.cats.length !== 4) fail(`${L} worlds[${i}] needs 4 category names`);
          else w.cats.forEach((c, j) => {
            if (c !== t.cats[j]) fail(`${L} worlds[${i}].cats[${j}] is "${c}", the checker expects "${t.cats[j]}"`);
          });
          if (L === 'en' && w.unit === w.unitN) fail(`en worlds[${i}]: singular and plural must differ (${w.unit})`);
        });
      });

      /* --- 渲染後的句子：標點不可以連兩個、中文與數字之間要有空格 ---
         這一套規則本來只跑在 review.html（simgen 內建）。index.html 的題庫、
         遊戲字串與範例字串都是拼出來的，同樣只有「把句子印出來看」才抓得到
         —— 第三輪審查點出這一塊完全沒有被 lint。 */
      const renderedText = (html) => String(html)
        .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
        .replace(/<\/?(?:br|p|div|li|tr|td|th|h[1-6]|ul|ol|table)\b[^>]*>/gi, ' ')
        .replace(/<[^>]+>/g, '');
      const proseOk = (label, html, L) => {
        const shown = renderedText(html);
        const dbl = shown.match(/(?<!\.)\.\.(?!\.)|。。|，，|,,|！！|？？|!!|\?\?|；；|：：/);
        if (dbl) fail(`${label}: doubled punctuation "${dbl[0]}" in "${shown.slice(0, 70)}"`);
        if (L === 'zh'){
          const glued = shown.match(/[一-鿿]\d|\d[一-鿿]/g);
          if (glued) fail(`${label}: missing space between Chinese and a digit (${[...new Set(glued)].join(' ')})`);
        }
      };

      /* --- SVG 幾何：畫布要蓋住它自己畫出去的四個邊，不是只有右緣 ---
         屬性一律各自抓一次，不假設順序（`<rect width="50" x="60">` 也要量到）；
         而且「解析器認得幾個元素」要等於「畫面上有幾個元素」——
         少了這一條，把 <line/> 改寫成 <line></line> 會讓那些線整批從計算裡消失，
         檢查照樣是綠的（fail-open）。 */
      const MEASURABLE = ['rect','line','text'];
      const edgesOf = (svg) => {
        const xs = [], ys = [], xsL = [], ysT = [];
        let m, seen = 0;
        /* SVG 的 x／y／x1…都預設為 0 —— 沒寫不等於量不到。
           以前把「沒寫」當成 NaN 直接略過，`<rect width="1000" height="10"/>`
           就會一邊不被量到、一邊仍然算進 seen，整張圖照樣過。 */
        const num = (a, k, dflt) => {
          const mm = a.match(new RegExp('\\b' + k + '="(-?\\d+(?:\\.\\d+)?)"'));
          if (mm) return Number(mm[1]);
          /* 「沒寫」才套 SVG 的預設值 0；「寫了但讀不出來」（x="oops"）一定要是 NaN，
             不然一個座標壞掉的元素會被當成畫在原點，靜靜地通過。 */
          if (new RegExp('\\b' + k + '="').test(a)) return NaN;
          return (dflt === undefined) ? NaN : dflt;
        };
        const unmeasured = [];
        const reRect = /<rect([^>]*?)\/?>/g;
        while ((m = reRect.exec(svg)) !== null){
          const a = m[1];
          const x = num(a, 'x', 0), y = num(a, 'y', 0), w = num(a, 'width'), h = num(a, 'height');
          const sw = (Number((a.match(/stroke-width="(\d+(?:\.\d+)?)"/) || [])[1]) || 0) / 2;
          if (![x, y, w, h].every(Number.isFinite)){ unmeasured.push('rect'); continue; }
          seen++;
          xs.push(x + w + sw); ys.push(y + h + sw);
          xsL.push(x - sw); ysT.push(y - sw);
        }
        /* 線段兩端都要算，起點在畫布內不代表終點也在；筆畫粗細也會畫出去一半。 */
        const reLine = /<line([^>]*?)\/?>/g;
        while ((m = reLine.exec(svg)) !== null){
          const a = m[1];
          const sw = (Number((a.match(/stroke-width="(\d+(?:\.\d+)?)"/) || [])[1]) || 0) / 2;
          const pts = [['x1','y1'], ['x2','y2']].map(pair => [num(a, pair[0], 0), num(a, pair[1], 0)]);
          if (!pts.every(pt => pt.every(Number.isFinite))){ unmeasured.push('line'); continue; }
          seen++;
          pts.forEach(pt => {
            xs.push(pt[0] + sw); xsL.push(pt[0] - sw);
            ys.push(pt[1] + sw); ysT.push(pt[1] - sw);
          });
        }
        /* 文字要算字數與 text-anchor：x 只是起點。變體選擇符與 ZWJ 不佔寬度，
           先拿掉再數碼位，否則單一 emoji 會被算成兩個字而誤報。
           y 是基線，上緣大約往上一個字級。 */
        const reText = /<text([^>]*)>([^<]*)<\/text>/g;
        while ((m = reText.exec(svg)) !== null){
          const a = m[1], body = m[2].replace(/[️‍]/g, '');
          const x = num(a, 'x', 0), y = num(a, 'y', 0);
          if (!Number.isFinite(x) || !Number.isFinite(y)){ unmeasured.push('text'); continue; }
          seen++;
          const fs = Number((a.match(/\bfont-size="(\d+)"/) || [])[1] || 20);
          const anchor = (a.match(/\btext-anchor="([a-z]+)"/) || [])[1] || 'start';
          const wide = Math.ceil(([...body].length || 1) * fs * 1.2);
          xs.push(anchor === 'middle' ? x + wide / 2 : (anchor === 'end' ? x : x + wide));
          xsL.push(anchor === 'middle' ? x - wide / 2 : (anchor === 'end' ? x - wide : x));
          ys.push(y + 2); ysT.push(y - fs);
        }
        const tags = (svg.match(/<([a-zA-Z][a-zA-Z0-9-]*)/g) || []).map(t => t.slice(1));
        const unsupported = tags.filter(t => t !== 'svg' && MEASURABLE.indexOf(t) < 0);
        const rawCount = tags.filter(t => MEASURABLE.indexOf(t) >= 0).length;
        return { xs, ys, xsL, ysT, seen, rawCount, unsupported, unmeasured };
      };
      const widthOk = (label, svg) => {
        const w = Number((svg.match(/(?:^|\s)width="(\d+)"/) || [])[1]);
        const h = Number((svg.match(/(?:^|\s)height="(\d+)"/) || [])[1]);
        const vb = (svg.match(/viewBox="0 0 (\d+) (\d+)"/) || []);
        const e = edgesOf(svg);
        if (!Number.isFinite(w) || !Number.isFinite(h) || !e.xs.length){
          fail(`${label}: cannot read the drawing geometry`); return;
        }
        if (e.unsupported.length){
          fail(`${label}: draws <${e.unsupported[0]}>, which the geometry reader cannot measure`); return;
        }
        if (e.unmeasured.length){
          fail(`${label}: a <${e.unmeasured[0]}> has coordinates the geometry reader cannot read`); return;
        }
        if (e.seen !== e.rawCount){
          fail(`${label}: the geometry reader measured ${e.seen} of ${e.rawCount} drawn elements — the rest are unmeasured`);
          return;
        }
        if (Number(vb[1]) !== w || Number(vb[2]) !== h){
          fail(`${label}: the viewBox (${vb[1]} x ${vb[2]}) does not match the canvas (${w} x ${h})`);
        }
        const right = Math.max.apply(null, e.xs), bottom = Math.max.apply(null, e.ys);
        const left = Math.min.apply(null, e.xsL), top = Math.min.apply(null, e.ysT);
        if (!(w >= right + 2)) fail(`${label} is ${w}px wide but draws out to x=${right}`);
        if (!(h >= bottom + 2)) fail(`${label} is ${h}px tall but draws out to y=${bottom}`);
        if (!(left >= 0)) fail(`${label} is clipped by the left edge (draws out to x=${left})`);
        if (!(top >= 0)) fail(`${label} is clipped by the top edge (draws out to y=${top})`);
      };
      /* 畫記：畫出來的筆畫數一定要等於 data-count 說的數量 ——
         「該畫卻沒畫」和「不該畫卻畫了」兩個方向都會噴錯。 */
      const strokesOk = (label, svg, n) => {
        const dc = Number((svg.match(/data-count="(\d+)"/) || [])[1]);
        if (dc !== n) fail(`${label}: data-count is ${dc}, expected ${n}`);
        const drawn = (svg.match(/<line\b/g) || []).length;
        if (drawn !== n) fail(`${label}: draws ${drawn} strokes, expected ${n}`);
      };
      ['zh','en'].forEach(form => {
        for (let n = 0; n <= 15; n++){
          const svg = data.tallySVG(n, form);
          strokesOk(`tallySVG(${n}, ${form})`, svg, n);
          if (n > 0) widthOk(`tallySVG(${n}, ${form})`, svg);
        }
      });
      /* --- 範例 1：訂一個分類標準 --- */
      const S = data.SORT_EX;
      const SN = S.cards.length;
      if (!(SN >= 6 && SN <= 12)) fail(`SORT_EX has ${SN} cards; keep it 6~12 so a child can tap through it`);
      /* 逐格的真值表。只驗「每張卡合法」＋「兩籃加起來是全部」的話，刪掉一張卡
         剩下的還是全部合法 —— 沒有人會發現。四格都要比，連張數一起比。 */
      const SORT_TRUTH = { '0,0':3, '0,1':3, '1,0':1, '1,1':2 };
      const cells = {};
      S.cards.forEach(c => { const k = c.col + ',' + c.shp; cells[k] = (cells[k] || 0) + 1; });
      Object.keys(SORT_TRUTH).forEach(k => {
        if ((cells[k] || 0) !== SORT_TRUTH[k]){
          fail(`SORT_EX has ${cells[k] || 0} cards in cell (${k}), the checker expects ${SORT_TRUTH[k]}`);
        }
      });
      Object.keys(cells).forEach(k => {
        if (!(k in SORT_TRUTH)) fail(`SORT_EX has cards in cell (${k}), which the checker does not know about`);
      });
      S.cards.forEach((c, i) => {
        if (c.col !== 0 && c.col !== 1) fail(`SORT_EX.cards[${i}].col must be 0 or 1, got ${c.col}`);
        if (c.shp !== 0 && c.shp !== 1) fail(`SORT_EX.cards[${i}].shp must be 0 or 1, got ${c.shp}`);
        if (!data.CARD_ICONS[c.col] || !data.CARD_ICONS[c.col][c.shp]){
          fail(`SORT_EX.cards[${i}] has no icon for (${c.col},${c.shp})`);
        }
      });
      const byCol = [0, 0], byShp = [0, 0];
      S.cards.forEach(c => { byCol[c.col]++; byShp[c.shp]++; });
      /* 每一張都剛好進一個籃子 —— 兩種標準的兩籃加起來都必須是全部。 */
      if (byCol[0] + byCol[1] !== SN) fail(`sorting by colour: every card must land in exactly one bin (${byCol.join('+')} vs ${SN})`);
      if (byShp[0] + byShp[1] !== SN) fail(`sorting by shape: every card must land in exactly one bin (${byShp.join('+')} vs ${SN})`);
      if (byCol.some(v => v < 1)) fail('sorting by colour leaves one bin empty; both bins must get cards');
      if (byShp.some(v => v < 1)) fail('sorting by shape leaves one bin empty; both bins must get cards');
      /* 這個範例的重點就是「換一個特徵就換一種分法」。畫面上孩子唯一看得到的
         差別是兩籃的張數，所以斷言的就是張數 —— 訊息也只講張數，不要說成
         「分法不同」（那是逐格真值表在管的）。 */
      if (byCol.slice().sort().join(',') === byShp.slice().sort().join(',')){
        fail(`the two sorting rules must give different bin sizes (colour ${byCol.join('/')} vs shape ${byShp.join('/')}), otherwise nothing on screen changes`);
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        if (!Array.isArray(d.sortStd) || d.sortStd.length !== 2) fail(`${L} sortStd needs exactly 2 standards`);
        if (!Array.isArray(d.sortCats) || d.sortCats.length !== 2) fail(`${L} sortCats needs 2 pairs of bin labels`);
        else d.sortCats.forEach((pair, i) => {
          if (!Array.isArray(pair) || pair.length !== 2) fail(`${L} sortCats[${i}] needs exactly 2 bin labels`);
          else if (pair[0] === pair[1]) fail(`${L} sortCats[${i}]: the two bins must have different labels`);
        });
        const o0 = d.o0(SN), o1 = d.o1(1, SN - 1), o2 = d.o2(byCol[0], byCol[1], SN);
        [o0, o1, o2].forEach(s => { if (/undefined|NaN/.test(s)) fail(`sort ${L}: ${s}`); });
        [['o0', o0], ['o1', o1], ['o2', o2]].forEach(pr => proseOk(`sort ${L} ${pr[0]}`, pr[1], L));
        if (o0.indexOf(String(SN)) < 0) fail(`o0 ${L} never says how many cards there are`);
        if (o1.indexOf(String(SN - 1)) < 0) fail(`o1 ${L} never says how many are left`);
        const eqTail = (L === 'zh' ? ' ＋ ' : ' + ') + byCol[1] + (L === 'zh' ? ' ＝ ' : ' = ') + SN;
        if (o2.indexOf(byCol[0] + eqTail) < 0){
          fail(`o2 ${L} never shows the full number sentence "${byCol[0] + eqTail}"`);
        }
      });

      /* --- 範例 2＋3：畫記與統計表 --- */
      const T = data.TALLY_EX;
      if (!Number.isInteger(T.wi) || T.wi < 0 || T.wi >= data.WORLDS.length) fail(`TALLY_EX.wi ${T.wi} is not a world`);
      T.cats.forEach((ci, i) => {
        if (!Number.isInteger(ci) || ci < 0 || ci >= 4) fail(`TALLY_EX.cats[${i}] ${ci} is not a category`);
        if (T.cats.indexOf(ci) !== i) fail(`TALLY_EX.cats[${i}] ${ci} appears twice`);
      });
      T.records.forEach((r, i) => {
        if (!Number.isInteger(r) || r < 0 || r >= T.cats.length){
          fail(`TALLY_EX record ${i} points at row ${r}, which is not a row of this table`);
        }
      });
      const tCounts = data.countsUpTo(T, T.records.length);
      const tTotal = tCounts.reduce((a, b) => a + b, 0);
      if (tCounts.length !== T.cats.length){
        fail(`TALLY_EX: cats and counts are index-aligned but have different lengths (${T.cats.length} vs ${tCounts.length})`);
      }
      /* 各類加起來 ＝ 總數：這一課的自我檢查規則，範例本身一定要成立。 */
      if (tTotal !== T.records.length){
        fail(`TALLY_EX: the rows do not add up to the total (${tCounts.join('+')} vs ${T.records.length})`);
      }
      if (tCounts.some(c => c < 1)) fail('TALLY_EX: every row must get at least one record');
      /* 範例 3 的結語明講「最多」和「最少」是誰，所以兩邊都必須唯一。 */
      const tMax = Math.max.apply(null, tCounts), tMin = Math.min.apply(null, tCounts);
      if (tCounts.filter(x => x === tMax).length !== 1){
        fail(`TALLY_EX: the largest count is tied (${tCounts.join(',')}), but the closing line names a single winner`);
      }
      if (tCounts.filter(x => x === tMin).length !== 1){
        fail(`TALLY_EX: the smallest count is tied (${tCounts.join(',')}), but the closing line names a single loser`);
      }
      /* 至少要有一個滿的正字，不然「五筆一組」在範例裡從來沒出現過。 */
      if (tMax < 5) fail(`TALLY_EX: no row reaches 5, so a full tally group never appears in the example`);
      const tMi = tCounts.indexOf(tMax), tLi = tCounts.indexOf(tMin);
      LANGS.forEach(L => {
        const d = I18N[L];
        if (!Array.isArray(d.tabHead) || d.tabHead.length !== 3) fail(`${L} tabHead needs 3 column titles`);
        if (!d.totalRow) fail(`${L} totalRow is missing`);
        const firstCat = d.catName(T.wi, T.cats[T.records[0]]);
        const t0 = d.t0(T.records.length), t1 = d.t1(1, firstCat), t2 = d.t2(T.records.length);
        [t0, t1, t2].forEach(s => { if (/undefined|NaN/.test(s)) fail(`tally ${L}: ${s}`); });
        [['t0', t0], ['t1', t1], ['t2', t2]].forEach(pr => proseOk(`tally ${L} ${pr[0]}`, pr[1], L));
        if (t0.indexOf(String(T.records.length)) < 0) fail(`t0 ${L} never says how many there are`);
        if (t1.indexOf(firstCat) < 0) fail(`t1 ${L} never names the category the record belongs to`);
        const b0 = d.b0;
        const b1 = d.b1(d.catName(T.wi, T.cats[0]), tCounts[0], T.wi);
        const b2 = d.b2(tCounts, tTotal, d.catName(T.wi, T.cats[tMi]), d.catName(T.wi, T.cats[tLi]), T.wi);
        [b0, b1, b2].forEach(s => { if (/undefined|NaN/.test(s)) fail(`table ${L}: ${s}`); });
        [['b0', b0], ['b1', b1], ['b2', b2]].forEach(pr => proseOk(`table ${L} ${pr[0]}`, pr[1], L));
        if (b1.indexOf(String(tCounts[0])) < 0) fail(`b1 ${L} never says how many strokes that row has`);
        /* 「有沒有印出總數」擋不住「算式整段被刪掉」—— 要驗算式的結果那一段。 */
        const sumTail = (L === 'zh' ? ' ＝ ' : ' = ') + tTotal;
        if (b2.indexOf(tCounts.join(L === 'zh' ? ' ＋ ' : ' + ') + sumTail) < 0){
          fail(`b2 ${L} never shows the full number sentence ending in "${sumTail}"`);
        }
        if (b2.indexOf(d.catName(T.wi, T.cats[tMi])) < 0) fail(`b2 ${L} never names the biggest row`);
        if (b2.indexOf(d.catName(T.wi, T.cats[tLi])) < 0) fail(`b2 ${L} never names the smallest row`);
        if (!d.tapRow) fail(`${L} tapRow tip is missing`);
      });

      /* --- 範例 4：讀表回答問題 --- */
      const R = data.READ_EX;
      /* wi 與類別索引也要驗 —— 少了這一條，cats:[0,0,2] 會讓同一類出現在兩列，
         而後面每一條檢查都照樣通過。 */
      if (!Number.isInteger(R.wi) || R.wi < 0 || R.wi >= data.WORLDS.length){
        fail(`READ_EX.wi ${R.wi} is not a world`);
      }
      R.cats.forEach((ci, i) => {
        if (!Number.isInteger(ci) || ci < 0 || ci >= 4) fail(`READ_EX.cats[${i}] ${ci} is not a category`);
        if (R.cats.indexOf(ci) !== i) fail(`READ_EX.cats[${i}] ${ci} appears twice`);
      });
      if (R.cats.length !== R.counts.length){
        fail(`READ_EX: cats and counts are index-aligned but have different lengths (${R.cats.length} vs ${R.counts.length})`);
      }
      if (R.cats.length !== 3) fail(`READ_EX draws 3 rows, got ${R.cats.length}`);
      const rHi = perCatMax(R.cats.length);
      R.counts.forEach((n, i) => {
        if (!Number.isInteger(n) || n < 1 || n > rHi) fail(`READ_EX.counts[${i}] must be 1~${rHi}, got ${n}`);
      });
      const rTotal = R.counts.reduce((a, b) => a + b, 0);
      if (rTotal > MAX_TOTAL) fail(`READ_EX: the rows do not add up to a total inside the lesson range (${rTotal} > ${MAX_TOTAL})`);
      /* 三個問題各自需要的條件：第一題說「cats[0] 最多」，第二題減 cats[2]。 */
      const rMax = Math.max.apply(null, R.counts);
      if (R.counts.filter(x => x === rMax).length !== 1 || R.counts[0] !== rMax){
        fail(`READ_EX row 0 must be the strict maximum, because the answer text names it as the most (${R.counts.join(',')})`);
      }
      if (!(R.counts[0] > R.counts[2])){
        fail(`READ_EX row 0 must have more than row 2, because the answer text subtracts them (${R.counts.join(',')})`);
      }
      LANGS.forEach(L => {
        const d = I18N[L];
        [0,1,2].forEach(i => {
          const chip = d.readQ(i, R.wi, R.cats, R.counts);
          const m1 = d.r1(i), m2 = d.r2(i, R.wi, R.cats, R.counts);
          [chip, m1, m2].forEach(s => { if (/undefined|NaN/.test(s)) fail(`read ${L}/${i}: ${s}`); });
          [['chip', chip], ['r1', m1], ['r2', m2]].forEach(pr => proseOk(`read ${L}/${i} ${pr[0]}`, pr[1], L));
          if (i === 0 && m2.indexOf(d.catName(R.wi, R.cats[0])) < 0){
            fail(`r2 ${L}/0 never states the answer (${d.catName(R.wi, R.cats[0])})`);
          }
          if (i === 1){
            const want = (L === 'zh' ? ' ＝ ' : ' = ') + (R.counts[0] - R.counts[2]);
            if (m2.indexOf(R.counts[0] + (L === 'zh' ? ' － ' : ' − ') + R.counts[2] + want) < 0){
              fail(`r2 ${L}/1 never states the answer sentence ending in "${want}"`);
            }
          }
          if (i === 2){
            const want = (L === 'zh' ? ' ＝ ' : ' = ') + rTotal;
            if (m2.indexOf(R.counts.join(L === 'zh' ? ' ＋ ' : ' + ') + want) < 0){
              fail(`r2 ${L}/2 never states the answer sentence ending in "${want}"`);
            }
          }
        });
        if (!d.r0) fail(`${L} r0 is missing`);
      });

      /* --- 小遊戲（§六之五：五關五種玩法）：見檔案前面的 gameCheck() --- */
      if (typeof src !== 'string' || !src) fail('the game checks need the index.html source (verify_lesson_data passes it as the 4th argument)');
      else gameCheck(data, I18N, fail, src, proseOk);

      /* --- 三層題庫的神諭表 ---
         每一題記四件事，都跟題目本身分開維護：
         - nums：題幹裡的阿拉伯數字，**照出現順序**、不多不少。只驗「有沒有出現」
           擋不住「題幹多塞一個數字」，只驗集合擋不住「兩個數字對調」。
         - tally：題幹裡的畫記圖應該是幾筆（沒有圖就是 null）。
         - calc：從 nums／tally 把答案重算一次的第二套實作，不是抄答案。
         - optRe：這一題四個選項各自該長什麼樣。只驗正解的話，把某個誘答換成
           「banana」也不會有人發現。 */
      const BANK_EXPECTED = {
        qs: [
          { nums:[], tally:null, calc:null, strictMaxAt:null,
            /* 這一題沒有算式可以驗，所以 why 逐字記下來 —— 不然「隨便怎麼寫」都會過。 */
            whyExact:{ zh:'這一課一次只看一個特徵，而且每一張都要剛好進一類。分到一半換特徵，前後就不是同一種分法；🔴 是紅色也是圓形，會被算兩次；只分紅色一類，🔵 和 🟦 就沒地方放。',
                       en:'In this lesson we look at one feature at a time, and every card must land in exactly one group. Switching feature halfway means the groups no longer match; 🔴 is both red and a circle, so it would be counted twice; and with only a red group 🔵 and 🟦 have nowhere to go.' },
            zh:'照顏色分：紅色、藍色', en:'Sort by colour: red, blue',
            optRe:{ zh:/^(?:先照顏色分，分到一半改照形狀分|分成紅色和圓形|照顏色分：紅色、藍色|只分成紅色一類)$/,
                    en:/^(?:Start by colour, then switch to shape halfway|Sort into red and circle|Sort by colour: red, blue|Make one group: red)$/ } },
          { nums:[], tally:7, calc:(n, t) => t, strictMaxAt:null, expr:[[5,'+',2]],
            zh:'7 張', en:'7 stickers',
            optRe:{ zh:/^\d+ 張$/, en:/^\d+ stickers?$/ } },
          { nums:[5,3,2], tally:null, calc:null, strictMaxAt:0,
            /* 同理：沒有算式，而且「5 最小，所以星星貼紙最多」這種反向敘述
               不含任何算式可以被拒絕（第三輪審查）。why 逐字記下來。 */
            whyExact:{ zh:'比數量欄的數字：5 比 3 和 2 都大，所以星星貼紙最多。',
                       en:'Compare the count column: 5 beats both 3 and 2, so the star stickers win.' },
            zh:'⭐ 星星貼紙', en:'⭐ star stickers',
            /* emoji 與名稱要成對枚舉。分開寫成兩個交替群組的話，「⭐ 月亮貼紙」也會通過。 */
            optRe:{ zh:/^(?:⭐ 星星貼紙|🌙 月亮貼紙|🌸 花朵貼紙|三類一樣多)$/,
                    en:/^(?:⭐ star stickers|🌙 moon stickers|🌸 flower stickers|All three are the same)$/ } },
          { nums:[6,4,3], tally:null, calc:n => n[0] - n[2], strictMaxAt:null, expr:[[6,'-',3]],
            zh:'3 顆', en:'3 balls',
            optRe:{ zh:/^\d+ 顆$/, en:/^\d+ balls?$/ } },
          { nums:[4,2,5], tally:null, calc:n => n[0] + n[1] + n[2], strictMaxAt:null, expr:[[4,'+',2,'+',5]],
            zh:'11 個', en:'11 blocks',
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ blocks?$/ } },
          { nums:[10,5,3], tally:null, calc:n => n[0] - n[1] - n[2], strictMaxAt:null, expr:[[10,'-',5,'-',3]],
            /* 這一題只點名三類，但那個世界有四類 —— 題幹一定要說「只有這三種」，
               不然剩下的 2 張可以分給第四類，答案就不唯一。 */
            mustLine:{ zh:'10 張貼紙只有 ⭐🌙🌸 三種。', en:'The 10 stickers are only ⭐, 🌙 and 🌸.' },
            zh:'2 張', en:'2 stickers',
            optRe:{ zh:/^\d+ 張$/, en:/^\d+ stickers?$/ } }
        ],
        qsAdv: [
          { nums:[12,5,4], tally:null, calc:n => n[0] - n[1] - n[2], strictMaxAt:null, expr:[[5,'+',4],[12,'-',9]],
            mustLine:{ zh:'12 個積木只有 🟥🟦🟨 三種。', en:'The 12 blocks are only 🟥, 🟦 and 🟨.' },
            zh:'3 個', en:'3 blocks',
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ blocks?$/ } },
          { nums:[6,4,3], tally:null, calc:n => (n[0] + n[2]) - n[1], strictMaxAt:null, expr:[[6,'+',3],[9,'-',4]],
            zh:'5 顆', en:'5 balls',
            optRe:{ zh:/^\d+ 顆$/, en:/^\d+ balls?$/ } },
          { nums:[8,3], tally:null, calc:n => n[0] - n[1], strictMaxAt:null, expr:[[8,'-',3]],
            zh:'5 張', en:'5 cards',
            optRe:{ zh:/^\d+ 張$/, en:/^\d+ cards?$/ } },
          { nums:[3,4], tally:null, calc:n => n[0] * n[1], strictMaxAt:null, expr:[[4,'x',3]],
            zh:'12 個', en:'12 blocks',
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ blocks?$/ } }
        ],
        qsBoost: [
          { nums:[], tally:6, calc:(n, t) => t, strictMaxAt:null, expr:[[5,'+',1]],
            zh:'6 個', en:'6 blocks',
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ blocks?$/ } },
          { nums:[12,5,4,2], tally:null, calc:n => n[1] + n[2] + n[3], strictMaxAt:null, expr:[[5,'+',4,'+',2]],
            mustLine:{ zh:'迷思檢查：12 個積木只有 🟥🟦🟨 三種。', en:'Misconception check: the 12 blocks are only 🟥, 🟦 and 🟨.' },
            /* C4：算式對、結論相反也會過，所以結論本身也要記下來。 */
            whyMust:{ zh:['表格一定有地方錯了'], en:['something in the table is wrong'] },
            whyForbid:{ zh:['是對的','沒有問題'], en:['is correct','is right','table is fine'] },
            zh:'不對，加起來只有 11', en:'No, the counts only add up to 11',
            /* 這一題的選項是句子，寬鬆的 /^(?:Yes|No), .+$/ 會放行「第二個也對的『不對…』」。
               所以整組選項逐字記在這裡，多一個、少一個、改一個字都會被抓到。 */
            optSet:{ zh:['對，每一類都有數字','不對，加起來只有 11','不對，因為只有 3 類','對，總數不用管'],
                     en:['Yes, every kind has a number','No, the counts only add up to 11',
                         'No, because there are only 3 kinds','Yes, the total does not matter'] },
            optRe:{ zh:/^(?:對，.+|不對，.+)$/, en:/^(?:Yes, .+|No, .+)$/ } }
        ]
      };
      /* --- 速查卡與家長頁 ---
         verify_lesson_data 只吃 index.html，所以這兩頁的規則寫錯了不會有人發現 ——
         第二輪審查的五筆頁面缺陷全部在那裡。從 index.html 的路徑推出同一個資料夾，
         把兩頁的字典執行起來，逐條比對「規則有沒有講滿」。 */
      const fsMod = require('fs');
      const pathMod = require('path');
      const lessonDir = pathMod.dirname(pathMod.resolve(process.argv[2] || '.'));
      const loadDict = (file) => {
        const abs = pathMod.join(lessonDir, file);
        if (!fsMod.existsSync(abs)){ fail(`${file} is missing from ${lessonDir} — this lesson is four pages`); return null; }
        const src = fsMod.readFileSync(abs, 'utf8');
        const a = src.indexOf('var I18N = {');
        const b = src.indexOf("var lang = 'zh';", a);
        if (a < 0 || b < 0){ fail(`${file}: cannot locate the I18N literal`); return null; }
        try { return new Function(src.slice(a, b) + '\n; return I18N;')(); }
        catch (e){ fail(`${file}: the I18N literal does not evaluate (${e.message})`); return null; }
      };
      /* --- 正字畫記的筆畫位置（2026-08-26 加）---
         三頁各有一份 strokesZH。以前的檢查只數「畫了幾筆」（data-count 對上 <line> 數目），
         沒有人看筆畫「畫在哪裡」—— 所以「中間那一橫畫在長豎的左邊」三頁一起錯了，
         六個靜態檢查、30000 批模擬、兩種語言的瀏覽器掃描全部綠燈。
         神諭不是程式碼本身，是「正」這個字的相對關係（拿 PingFang TC 渲染出來量的）：
         上下兩橫都貫穿長豎、長豎從上橫拉到下橫、中短橫**從長豎往右**、
         左短豎在長豎左邊、起點在上橫下面且高於中短橫、往下接到下橫。
         **把整個函式跑起來，不是只讀那個座標陣列**：真正畫出去的是回傳值，
         `return pts.slice(0, k)` 改成 `slice(5 - k)` 的話筆數一樣、陣列一樣，
         畫記卻會從最後一筆開始長（第一輪 codex 審查的 HIGH）。 */
      const STROKE_PAGES = ['index.html', 'reference.html', 'review.html'];
      const strokeSets = {};
      const j5 = v => JSON.stringify(v);
      STROKE_PAGES.forEach(file => {
        const abs = pathMod.join(lessonDir, file);
        if (!fsMod.existsSync(abs)){ fail(`${file} is missing from ${lessonDir} — this lesson is four pages`); return; }
        const src = fsMod.readFileSync(abs, 'utf8');
        const a = src.indexOf('function strokesZH(');
        const ret = (a < 0) ? -1 : src.indexOf('return pts.slice', a);
        const end = (ret < 0) ? -1 : src.indexOf('\n  }', ret);
        if (a < 0 || ret < 0 || end < 0){
          fail(`${file}: cannot locate the strokesZH function, so the 正 strokes are not checked at all`);
          return;
        }
        let fn;
        try { fn = new Function(src.slice(a, end + 4) + '\n; return strokesZH;')(); }
        catch (e){ fail(`${file}: strokesZH does not evaluate (${e.message})`); return; }
        const okShape = (v, label) => {
          if (!Array.isArray(v) || v.some(s => !Array.isArray(s) || s.length !== 4 || s.some(n => !Number.isFinite(n)))){
            fail(`${file}: ${label} is not a list of strokes with four finite coordinates: ${j5(v)}`);
            return false;
          }
          return true;
        };
        let full;
        try { full = fn(5, 0, 0); } catch (e){ fail(`${file}: strokesZH(5) throws (${e.message})`); return; }
        if (!okShape(full, 'strokesZH(5)')) return;
        if (full.length !== 5){ fail(`${file}: one tally group must be five strokes, strokesZH(5) draws ${full.length}`); return; }
        /* 逐筆長出來的順序：畫 k 筆一定是五筆的前 k 筆（按筆順長，不是倒著長）。 */
        for (let k = 0; k <= 5; k++){
          let got;
          try { got = fn(k, 0, 0); } catch (e){ fail(`${file}: strokesZH(${k}) throws (${e.message})`); return; }
          if (!okShape(got, `strokesZH(${k})`)) return;
          if (j5(got) !== j5(full.slice(0, k))){
            fail(`${file}: strokesZH(${k}) draws ${j5(got)}, it must be the first ${k} of the five strokes ${j5(full.slice(0, k))} — the strokes have to grow in writing order`);
            return;
          }
        }
        /* 位移要整組跟著走。漏掉一個 ox／oy 時 ox=0 的第一組完全正常，
           只有第二組會疊回第一組上面 —— 只有這一條抓得到。
           **偏移量用 tallySVG 自己算出來的那些原點**（pad／gw／gap／rowH 從同一頁讀），
           不是隨手挑兩個數字：挑兩個數字的話，「剛好只在那兩個數字對」的寫法照樣會過
           （`ox + ox * (ox - 7) + 2` 在 ox=0 與 ox=7 都對）—— 第二輪 codex 審查的 LOW。 */
        const layoutM = src.match(/var gw = (\d+), gap = (\d+), rowH = (\d+), pad = (\d+), perRow = (\d+);/);
        if (!layoutM) fail(`${file}: cannot find the tally layout constants (gw/gap/rowH/pad/perRow), so the real group origins are not checked`);
        const origins = [[7, 13]];
        if (layoutM){
          const gwV = +layoutM[1], gapV = +layoutM[2], rowHV = +layoutM[3], padV = +layoutM[4], perRowV = +layoutM[5];
          /* 和 tallySVG 裡的算法逐字一樣：前兩列（每列 perRow 組）的原點。 */
          for (let g = 0; g < perRowV * 2; g++){
            origins.push([padV + (g % perRowV) * (gwV + gapV), padV + Math.floor(g / perRowV) * rowHV]);
          }
        }
        let movedOk = true;
        origins.forEach(o => {
          const moved = fn(5, o[0], o[1]);
          const want = full.map(s => [s[0] + o[0], s[1] + o[1], s[2] + o[0], s[3] + o[1]]);
          if (j5(moved) !== j5(want)){
            movedOk = false;
            fail(`${file}: strokesZH does not move with ox/oy — at (${o[0]},${o[1]}) it draws ${j5(moved)}, expected ${j5(want)}`);
          }
        });
        if (!movedOk) return;
        strokeSets[file] = full;
        const isH = s => s[1] === s[3] && s[0] !== s[2];
        const isV = s => s[0] === s[2] && s[1] !== s[3];
        const top = full[0], vert = full[1], mid = full[2], left = full[3], bottom = full[4];
        const shape = [[top, isH, '1 (top horizontal)'], [vert, isV, '2 (the long vertical)'],
                       [mid, isH, '3 (the middle short horizontal)'], [left, isV, '4 (the left short vertical)'],
                       [bottom, isH, '5 (bottom horizontal)']];
        let shapeOk = true;
        shape.forEach(([s, test, name]) => {
          if (!test(s)){ shapeOk = false; fail(`${file}: 正 stroke ${name} is not drawn the right way round: ${j5(s)}`); }
        });
        /* 形狀不對的話，下面的左右上下比較沒有意義（拿 y 當 x 比會亂噴）。 */
        if (!shapeOk) return;
        const topY = top[1], botY = bottom[1], vx = vert[0], midY = mid[1];
        const spans = (bar, x) => Math.min(bar[0], bar[2]) <= x && x <= Math.max(bar[0], bar[2]);
        /* 兩筆平行線靠得比線寬還近，畫面上就黏成一條粗線 —— 線寬從同一頁讀出來，不要自己編一個數字。
           要讀**畫記那一行自己的**線寬（tallySVG 裡輸出的那個），不是整頁第一個 stroke-width：
           別的地方多一個細線就會把門檻調鬆，而 0 會讓下面兩條檢查靜靜消失
           （第二輪 codex 審查的 MEDIUM）。 */
        const svgA = src.indexOf('function tallySVG(');
        const svgEnd = (svgA < 0) ? -1 : src.indexOf('\n  }', svgA);
        const swM = (svgA < 0 || svgEnd < 0) ? null : src.slice(svgA, svgEnd).match(/stroke-width="(-?\d+(?:\.\d+)?)"/);
        const sw = (swM && Number(swM[1]) > 0) ? Number(swM[1]) : null;
        if (!swM) fail(`${file}: cannot find the tally stroke-width inside tallySVG, so “two strokes merge into one” cannot be checked`);
        else if (!(Number(swM[1]) > 0)) fail(`${file}: the tally stroke-width is "${swM[1]}", it must be a positive number — otherwise the clearance checks quietly pass anything`);
        if (!(topY < botY)) fail(`${file}: 正 stroke 1 is at y=${topY} and stroke 5 at y=${botY} — the top bar must sit above the bottom bar`);
        if (!spans(top, vx)) fail(`${file}: 正 stroke 1 does not cross the long vertical at x=${vx}`);
        if (!spans(bottom, vx)) fail(`${file}: 正 stroke 5 does not cross the long vertical at x=${vx}`);
        if (Math.min(vert[1], vert[3]) !== topY || Math.max(vert[1], vert[3]) !== botY){
          fail(`${file}: 正 stroke 2 runs y=${Math.min(vert[1], vert[3])}~${Math.max(vert[1], vert[3])}, it must run from the top bar (y=${topY}) to the bottom bar (y=${botY})`);
        }
        if (!(topY < midY && midY < botY)) fail(`${file}: 正 stroke 3 is at y=${midY}, it must sit between the two bars (y=${topY} and y=${botY})`);
        const midL = Math.min(mid[0], mid[2]), midR = Math.max(mid[0], mid[2]);
        if (midL !== vx) fail(`${file}: 正 stroke 3 starts at x=${midL}, it must start on the long vertical (x=${vx})`);
        if (!(midR > vx)) fail(`${file}: 正 stroke 3 ends at x=${midR}, it must extend to the RIGHT of the long vertical (x=${vx}) — a middle bar on the left is not the character 正`);
        else if (sw !== null && midR - vx < sw) fail(`${file}: 正 stroke 3 is only ${midR - vx} long, thinner than the ${sw} stroke width — it disappears into the vertical`);
        const outerR = Math.max(top[0], top[2], bottom[0], bottom[2]);
        const outerL = Math.min(top[0], top[2], bottom[0], bottom[2]);
        if (midR > outerR) fail(`${file}: 正 stroke 3 runs out to x=${midR}, past the outer bars (x=${outerR})`);
        if (!(left[0] < vx)) fail(`${file}: 正 stroke 4 sits at x=${left[0]}, it must be to the LEFT of the long vertical (x=${vx})`);
        else if (sw !== null && vx - left[0] < sw) fail(`${file}: 正 stroke 4 sits ${vx - left[0]} from the long vertical, closer than the ${sw} stroke width — the two verticals merge into one thick stroke`);
        if (!(left[0] > outerL)) fail(`${file}: 正 stroke 4 sits at x=${left[0]}, on or outside the left end of the bars (x=${outerL})`);
        if (Math.max(left[1], left[3]) !== botY) fail(`${file}: 正 stroke 4 ends at y=${Math.max(left[1], left[3])}, it must reach the bottom bar (y=${botY})`);
        if (!(Math.min(left[1], left[3]) < midY)) fail(`${file}: 正 stroke 4 starts at y=${Math.min(left[1], left[3])}, it must start above the middle horizontal (y=${midY})`);
        if (!(Math.min(left[1], left[3]) > topY)) fail(`${file}: 正 stroke 4 starts at y=${Math.min(left[1], left[3])}, it must start below the top bar (y=${topY}) — a second full-height vertical is not the character 正`);
        else if (sw !== null && Math.min(left[1], left[3]) - topY < sw){
          fail(`${file}: 正 stroke 4 starts ${Math.min(left[1], left[3]) - topY} below the top bar, less than the ${sw} stroke width — with round caps it still touches the bar and reads as a second full-height vertical`);
        }
      });
      /* 三頁畫的必須是同一個正字。一頁改對、另一頁忘了改，是這次缺陷的實際形狀。 */
      {
        const drawn = Object.keys(strokeSets);
        if (drawn.length > 1){
          const ref = drawn[0], refJSON = j5(strokeSets[ref]);
          drawn.slice(1).forEach(file => {
            if (j5(strokeSets[file]) !== refJSON){
              fail(`${file} and ${ref} do not draw the same 正: ${j5(strokeSets[file])} vs ${refJSON}`);
            }
          });
        }
      }
      /* 逐字神諭。只比關鍵字的話，「平手時隨便選一類」也含有「平手」——
         這一課整套規則的唯一性可以被反過來教，檢查照樣是綠的（第三輪審查的 CRITICAL）。
         所以這裡比的是整個字串，不是裡面有沒有某個詞。 */
      const PAGE_TRUTH = {
        'reference.html': {
          zh: {
            q1b:'找數量欄最大的數字；兩類一樣大就是平手',
            q2b:'找數量欄最小的數字；兩類一樣小就是平手',
            q3a:'兩類相差幾個',
            q3b:'大的減小的',
            q5a:'一個類別的數量看不到',
            q5b:'總數看得到時，減掉其他類別的數量',
            m3a:'各類加起來和總數對不上',
            m3c:'對不上就一定有錯：可能畫記漏了或多了、數字抄錯，也可能加錯。回去一個一個對記號，再把加法重算一次。'
          },
          en: {
            q1b:'Find the biggest number in the count column; if two kinds share it they are tied',
            q2b:'Find the smallest number in the count column; if two kinds share it they are tied',
            q3a:'What is the difference between two kinds',
            q3b:'Bigger minus smaller',
            q5a:'One category count is hidden',
            q5b:'When the total and the other counts are visible, subtract them from the total',
            m3a:'The counts do not match the total',
            m3c:'a mismatch proves an error somewhere — in the tallying, in the copying, or in the adding. Check each item against its mark again, then redo the addition.'
          }
        },
        'parents.html': {
          zh: {
            h2p:'等車或坐車時，拿張紙寫下三類（轎車、機車、公車），看到一台就畫一筆，五筆寫一個正字。三分鐘後停下來，數畫記說出哪一類最多；兩類一樣多就把兩類都說出來。',
            h3p:'問家裡每個人週末想吃什麼，讓孩子當記錄員：一個人講就畫一筆。講完數畫記，說出票最多的是哪一個；有平手就把平手的都念出來，再問「全部幾票？和我們家幾個人一樣嗎？」'
          },
          en: {
            h2p:'While waiting for a bus or riding in the car, write three kinds on a scrap of paper (cars, motorbikes, buses) and draw one stroke for each one you see, five to a gate. Stop after three minutes, count the strokes and say which kind won — and if two kinds are level, name them both.',
            h3p:'Ask everyone what they want to eat at the weekend and let your child be the recorder: one stroke per person who speaks. Count the strokes and say which meal has the most votes, naming them all if any are tied, then ask “how many votes altogether — is that the same as the number of people here?”'
          }
        }
      };
      /* s1p1 是一整段，逐字比對太脆；改成「必須含有這一整句」＋「不可以出現否定」。 */
      const PAGE_SENTENCE = {
        'parents.html': {
          zh: { s1p1:'最後把各類加起來對一次總數：對不上就一定有錯，對得上也只是通過其中一道檢查（漏記一個又重複記一個會互相抵銷），還要確認每個東西都剛好被畫記一次。' },
          en: { s1p1:'and finally add all the counts and compare with the total: a mismatch proves something is wrong, while a match is only one check — two opposite slips cancel out, so also confirm every item received exactly one tally.' }
        }
      };
      const pageDicts = {};
      const dictOf = (file) => {
        if (!(file in pageDicts)) pageDicts[file] = loadDict(file);
        return pageDicts[file];
      };
      Object.keys(PAGE_TRUTH).forEach(file => {
        const dict = dictOf(file);
        if (!dict) return;
        LANGS.forEach(L => {
          const want = PAGE_TRUTH[file][L];
          Object.keys(want).forEach(key => {
            const got = (dict[L] || {})[key];
            if (typeof got !== 'string'){ fail(`${file} ${L}.${key} is missing`); return; }
            if (got !== want[key]){
              fail(`${file} ${L}.${key} is "${got}", the checker expects "${want[key]}"`);
            }
          });
        });
      });
      Object.keys(PAGE_SENTENCE).forEach(file => {
        const dict = dictOf(file);
        if (!dict) return;
        LANGS.forEach(L => {
          const want = PAGE_SENTENCE[file][L];
          Object.keys(want).forEach(key => {
            const got = (dict[L] || {})[key];
            if (typeof got !== 'string'){ fail(`${file} ${L}.${key} is missing`); return; }
            if (got.indexOf(want[key]) < 0){
              fail(`${file} ${L}.${key} never states, word for word: "${want[key]}"`);
            }
            /* 否定會讓子字串比對整個失效（「不是只有…」含有「只有…」）。 */
            ['不是','並不','沒有真的','It is false','is not true'].forEach(neg => {
              if (got.indexOf(neg + want[key]) >= 0 || got.indexOf(neg + ' ' + want[key]) >= 0){
                fail(`${file} ${L}.${key} negates the required sentence with "${neg}"`);
              }
            });
          });
        });
      });

      const BANK_OPT_MAX = 16;
      /* 靜態題庫的英文選項也要單複數一致。`/^\d+ stickers?$/` 同時放行
         「1 stickers」和「2 sticker」—— 產生器那邊驗過，題庫這邊以前沒有。 */
      const BANK_SING = WORLD_TRUTH.map(w => w.en.unit).concat(['card']);
      const BANK_PLUR = WORLD_TRUTH.map(w => w.en.unitN).concat(['cards']);
      const hasNum = (text, n) => new RegExp('(?<![0-9])' + n + '(?![0-9])').test(text);
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        const oracle = BANK_EXPECTED[bank] || [];
        /* 每一種語言各比一次長度。只比中文的話，刪掉最後一題英文題目時
           中文長度還是對的，而英文那一圈會少跑一題 —— 那一題整個沒被驗到。 */
        LANGS.forEach(L => {
          if ((I18N[L][bank] || []).length !== oracle.length){
            fail(`${L} ${bank}: ${(I18N[L][bank] || []).length} questions but ${oracle.length} expected answers recorded`);
          }
        });
        LANGS.forEach(L => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const o = oracle[i];
            if (!o){ fail(`${bank}[${i}]: no expected answer recorded in the checker`); return; }
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`); return;
            }
            if (q.opts.length !== 4) fail(`${bank}[${i}] ${L}: ${q.opts.length} options, this lesson always offers 4`);
            /* 1. 畫記圖：該有的時候要有、不該有的時候不能有，而且筆數要對得上。 */
            const dcs = (String(q.stem).match(/data-count="(\d+)"/g) || []).map(x => Number(x.replace(/\D/g, '')));
            if (o.tally === null){
              if (dcs.length) fail(`${bank}[${i}] ${L}: the stem draws a tally the checker does not know about`);
            } else {
              if (dcs.length !== 1 || dcs[0] !== o.tally){
                fail(`${bank}[${i}] ${L}: the tally picture in the stem carries ${dcs.join('/') || 'nothing'}, the checker expects ${o.tally}`);
              }
            }
            /* 2. 題幹的數字要照出現順序剛剛好。 */
            const plain = String(q.stem).replace(/<[^>]+>/g, ' ');
            const order = (plain.match(/\d+/g) || []).map(Number);
            if (order.join(',') !== o.nums.join(',')){
              fail(`${bank}[${i}] ${L}: the stem numbers are ${order.join('/') || 'none'}, the checker expects ${o.nums.join('/') || 'none'}`);
              return;
            }
            /* 2b. 只點名部分類別的題目，題幹一定要說清楚「只有這幾種」。
                  比的是**整行**（題幹以 <br> 分行）而不是子字串 —— 子字串比對放行
                  「不是只有 ⭐🌙🌸 三種」，那一句的意思剛好相反（第三輪審查的 CRITICAL）。 */
            if (o.mustLine){
              const phrase = L === 'zh' ? o.mustLine.zh : o.mustLine.en;
              const lines = String(q.stem).split(/<br\s*\/?>/i)
                .map(x => x.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
                .filter(Boolean);
              if (lines.indexOf(phrase) < 0){
                fail(`${bank}[${i}] ${L}: no line of the stem is exactly "${phrase}", so the named categories are not known to be all of them`);
              }
            }
            /* 3. 標為正解的那一個要等於神諭寫下的字串。 */
            const want = L === 'zh' ? o.zh : o.en;
            if (q.opts[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", the checker expects "${want}"`);
            }
            /* 4. 神諭寫下的字串要能從題幹的數字重算出來。 */
            if (o.calc){
              const v = o.calc(o.nums, o.tally);
              if (!Number.isInteger(v)) fail(`${bank}[${i}]: the recomputed answer is not a whole number`);
              else if (!hasNum(want, v)){
                fail(`${bank}[${i}] ${L}: the recorded answer "${want}" does not contain ${v}, recomputed from the stem`);
              }
            }
            /* 5. 「哪一類最多」只有在最大值唯一時才有唯一答案。 */
            if (o.strictMaxAt !== null){
              const mx = Math.max.apply(null, o.nums);
              if (o.nums.filter(x => x === mx).length !== 1 || o.nums[o.strictMaxAt] !== mx){
                fail(`${bank}[${i}]: the number at position ${o.strictMaxAt} is not the strict maximum of ${o.nums.join('/')}, so the question has no unique answer`);
              }
            }
            /* 6. 每一個選項的形狀與數字範圍 —— 誘答也要驗，不只是正解。 */
            const re = L === 'zh' ? o.optRe.zh : o.optRe.en;
            q.opts.forEach(opt => {
              if (!re.test(opt)){
                fail(`${bank}[${i}] ${L}: option "${opt}" does not look like an answer to this question`);
              }
              if (L === 'en'){
                const pm = String(opt).match(/^(\d+) ([a-z]+)$/);
                if (pm){
                  const n = Number(pm[1]), word = pm[2];
                  if (BANK_SING.indexOf(word) >= 0 && n !== 1){
                    fail(`${bank}[${i}] en: option "${opt}" does not agree with the number (needs the plural)`);
                  }
                  if (BANK_PLUR.indexOf(word) >= 0 && n === 1){
                    fail(`${bank}[${i}] en: option "${opt}" does not agree with the number (needs the singular)`);
                  }
                }
              }
              /* 上限 16 是從題庫自己最大的誘答推出來的：qsAdv 最後一題「3 類、每類 4 個」
                 的「多算一類」誘答 4 × 4 ＝ 16。隨手給一個 40 等於沒有範圍檢查。 */
              (String(opt).match(/\d+/g) || []).map(Number).forEach(x => {
                if (!(x >= 1 && x <= BANK_OPT_MAX)) fail(`${bank}[${i}] ${L}: option "${opt}" contains ${x}, outside 1~${BANK_OPT_MAX}`);
              });
            });
            /* 7. 整組選項要跟真值表逐字一樣（有記的話）—— 句子型選項只靠正規式，
                  會放行「第二個也講得通的答案」。 */
            if (o.optSet){
              const wantSet = L === 'zh' ? o.optSet.zh : o.optSet.en;
              if (q.opts.length !== wantSet.length || q.opts.some((x, k) => x !== wantSet[k])){
                fail(`${bank}[${i}] ${L}: the option set is [${q.opts.join(' / ')}], the checker expects [${wantSet.join(' / ')}]`);
              }
            }
            /* 8. 選項字串兩兩不同，而且**按值**也要不同：「07 stickers」和「7 stickers」
                  字串不同、值卻一樣，孩子看到的其實只有三個選項。 */
            const trimmed = q.opts.map(x => x.replace(/\s+/g, ' ').trim());
            for (let a = 0; a < trimmed.length; a++){
              if (/(?:^|\s)0\d/.test(trimmed[a])) fail(`${bank}[${i}] ${L}: option "${q.opts[a]}" has a leading zero`);
              for (let b = a + 1; b < trimmed.length; b++){
                if (trimmed[a] === trimmed[b]) fail(`${bank}[${i}] ${L}: "${q.opts[a]}" appears twice`);
                const va = trimmed[a].match(/^(\d+)\s*(.*)$/), vb = trimmed[b].match(/^(\d+)\s*(.*)$/);
                if (va && vb && Number(va[1]) === Number(vb[1]) && va[2] === vb[2]){
                  fail(`${bank}[${i}] ${L}: "${q.opts[a]}" and "${q.opts[b]}" are the same value`);
                }
              }
            }
            /* 9. 解釋本身。前面八條沒有一條讀過 q.why —— 所以 why 可以寫
                  「5 ＋ 4 ＋ 2 ＝ 12，所以這張表是對的」：算式是假的、結論還跟正解矛盾，
                  檢查照樣全綠。這一條讀 why，而且做兩件事：
                  (a) why 裡的**每一條算式都要算得出它自己寫的答案**；
                  (b) 神諭知道答案怎麼算的時候（o.calc），其中一條算式的結果
                      一定要等於重算出來的那個值 —— 不然 why 講的是別的東西。 */
            proseOk(`${bank}[${i}] ${L} stem`, q.stem, L);
            q.opts.forEach((opt, oi) => proseOk(`${bank}[${i}] ${L} opt${oi}`, opt, L));
            const why = q.why;
            proseOk(`${bank}[${i}] ${L} why`, why, L);
            if (typeof why !== 'string' || !why.trim()){
              fail(`${bank}[${i}] ${L}: why is missing or empty`);
            } else {
              /* 中文用全形 ＋－×＝，英文用 + − × = ，兩套都要認。 */
              const reEq = /(\d+(?:\s*[+＋×\-−－]\s*\d+)+)\s*[=＝]\s*(\d+)/g;
              const results = [];
              let em;
              while ((em = reEq.exec(why)) !== null){
                const lhs = em[1], rhs = Number(em[2]);
                const toks = lhs.split(/\s*([+＋×\-−－])\s*/);
                let acc = Number(toks[0]);
                for (let k = 1; k < toks.length; k += 2){
                  const op = toks[k], v = Number(toks[k + 1]);
                  acc = (op === '×') ? acc * v : ((op === '+' || op === '＋') ? acc + v : acc - v);
                }
                if (acc !== rhs){
                  fail(`${bank}[${i}] ${L}: why states "${lhs} = ${rhs}", but ${lhs} works out to ${acc}`);
                }
                results.push(rhs);
              }
              if (o.calc){
                const v = o.calc(o.nums, o.tally);
                if (!results.length){
                  fail(`${bank}[${i}] ${L}: why shows no working, so nothing says why ${v} is the answer`);
                } else if (results.indexOf(v) < 0){
                  fail(`${bank}[${i}] ${L}: the sums in why (${results.join(', ')}) never reach the recomputed answer ${v}`);
                }
              }
              /* 「有一條算式剛好等於答案」還不夠：`1 ＋ 1 ＝ 2` 也等於 2，卻沒有用到
                 這一題的關係。神諭記下**該出現的那個算式**，逐字要求它在 why 裡。 */
              /* 沒有算式可驗的題目，用逐字神諭把 why 釘死。 */
              if (o.whyExact){
                const want = (L === 'zh') ? o.whyExact.zh : o.whyExact.en;
                if (why !== want) fail(`${bank}[${i}] ${L}: why is "${why}", the checker expects "${want}"`);
              }
              /* 結論本身：算式對、結論相反也是缺陷。 */
              if (o.whyMust){
                ((L === 'zh') ? o.whyMust.zh : o.whyMust.en).forEach(needle => {
                  if (why.indexOf(needle) < 0) fail(`${bank}[${i}] ${L}: why never concludes "${needle}"`);
                });
              }
              if (o.whyForbid){
                ((L === 'zh') ? o.whyForbid.zh : o.whyForbid.en).forEach(needle => {
                  if (why.indexOf(needle) >= 0) fail(`${bank}[${i}] ${L}: why states the opposite conclusion "${needle}"`);
                });
              }
              if (o.expr){
                const OP = (L === 'zh') ? { '+':' ＋ ', '-':' － ', 'x':' × ' }
                                        : { '+':' + ',  '-':' − ',  'x':' × ' };
                const EQ = (L === 'zh') ? ' ＝ ' : ' = ';
                let last = null;
                o.expr.forEach(ex => {
                  let acc = ex[0], text = String(ex[0]);
                  for (let k = 1; k < ex.length; k += 2){
                    const op = ex[k], val = ex[k + 1];
                    acc = (op === 'x') ? acc * val : (op === '+' ? acc + val : acc - val);
                    text += OP[op] + val;
                  }
                  last = acc;
                  const want = text + EQ + acc;
                  if (why.indexOf(want) < 0){
                    fail(`${bank}[${i}] ${L}: why never shows the working "${want}"`);
                  }
                });
                if (o.calc && last !== o.calc(o.nums, o.tally)){
                  fail(`${bank}[${i}]: the recorded working ends at ${last}, but the stem recomputes to ${o.calc(o.nums, o.tally)}`);
                }
              }
            }
          });
        });
      });
    }
  }
};
