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
    /* 散落那一堆的畫布寬度算錯：最後幾個會被切掉。 */
    { file:'index', expect:'draws out to x=',
      find:'    var w = cols * size + 12, h = rows * size + 10;',
      replace:'    var w = cols * size - 12, h = rows * size + 10;' },
    /* 畫出來的東西數量和資料對不上。 */
    { file:'index', expect:'draws',
      find:'  function mixIcons(wi, cats, counts){\n    var left = counts.slice(), out = [], any = true;',
      replace:'  function mixIcons(wi, cats, counts){\n    var left = counts.slice(); left[0] = left[0] - 1; var out = [], any = true;' },

    /* --- index.html：遊戲關卡 --- */
    { file:'index', expect:'opts[ans] does not equal the recomputed answer',
      find:"    { kind:'count', wi:0, cats:[0,1,2], counts:[4,2,5], t:0,        opts:[4,5,2],  ans:0 },",
      replace:"    { kind:'count', wi:0, cats:[0,1,2], counts:[4,2,5], t:0,        opts:[4,5,2],  ans:1 }," },
    { file:'index', expect:'cats and counts are index-aligned',
      find:"    { kind:'total', wi:2, cats:[0,1,2], counts:[2,3,4],             opts:[7,5,9],  ans:2 },",
      replace:"    { kind:'total', wi:2, cats:[0,1,2], counts:[2,3,4,5],           opts:[7,5,9],  ans:2 }," },
    { file:'index', expect:'the largest count is tied',
      find:"    { kind:'most',  wi:1, cats:[0,1,2], counts:[3,6,2],             opts:[0,2,1],  ans:2 },",
      replace:"    { kind:'most',  wi:1, cats:[0,1,2], counts:[6,6,2],             opts:[0,2,1],  ans:2 }," },
    { file:'index', expect:'the smallest count is tied',
      find:"    { kind:'least', wi:1, cats:[0,2,3], counts:[5,2,4],             opts:[0,2,1],  ans:2 }",
      replace:"    { kind:'least', wi:1, cats:[0,2,3], counts:[5,2,2],             opts:[0,2,1],  ans:2 }" },
    { file:'index', expect:'must have more of',
      find:"    { kind:'diff',  wi:0, cats:[1,2,3], counts:[6,2,3], a:0, b:1,   opts:[8,4,2],  ans:1 },",
      replace:"    { kind:'diff',  wi:0, cats:[1,2,3], counts:[6,2,3], a:1, b:0,   opts:[8,4,2],  ans:1 }," },
    { file:'index', expect:'duplicate options',
      find:"    { kind:'total', wi:2, cats:[0,1,2], counts:[2,3,4],             opts:[7,5,9],  ans:2 },",
      replace:"    { kind:'total', wi:2, cats:[0,1,2], counts:[2,3,4],             opts:[9,5,9],  ans:2 }," },
    { file:'index', expect:'is not a valid option index',
      find:"    { kind:'count', wi:0, cats:[0,1,2], counts:[4,2,5], t:0,        opts:[4,5,2],  ans:0 },",
      replace:"    { kind:'count', wi:0, cats:[0,1,2], counts:[4,2,5], t:0,        opts:[4,5,2],  ans:9 }," },
    { file:'index', expect:'gWhy never states the answer',
      find:"        if (r.kind === 'total') return r.counts.join(' ＋ ') + ' ＝ ' + t + '，全部一共 ' + this.qty(r.wi, t) + '。';",
      replace:"        if (r.kind === 'total') return r.counts.join(' ＋ ') + '，加起來就對了。';" },
    { file:'index', expect:'gHint2 never mentions',
      find:"        return '提示：' + r.cats.map(function(ci, i){\n          return self.catName(r.wi, ci) + ' ' + self.qty(r.wi, r.counts[i]);\n        }).join('、') + '。';",
      replace:"        return '提示：一類一類數。';" },
    { file:'index', expect:'the option label is',
      find:"        return (r.kind === 'most' || r.kind === 'least') ? this.catName(r.wi, r.cats[o]) : this.qty(r.wi, o);\n      },\n      gHintBtn:'💡 提示',",
      replace:"        return (r.kind === 'most' || r.kind === 'least') ? this.catName(r.wi, r.cats[o]) : String(o);\n      },\n      gHintBtn:'💡 提示'," },

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
    { file:'index', expect:'missing space between Chinese and a digit',
      find:"        if (r.kind === 'count') return '數出來' + this.catName(r.wi, r.cats[r.t]) + '有 ' + this.qty(r.wi, r.counts[r.t]) + '。';",
      replace:"        if (r.kind === 'count') return '數出來' + this.catName(r.wi, r.cats[r.t]) + '有' + this.qty(r.wi, r.counts[r.t]) + '。';" },
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
      find:'    s += \'</svg>\';\n    return s;\n  }\n\n  /* 把各類的東西輪流排開',
      replace:'    s += \'<rect width="1000" height="10"/></svg>\';\n    return s;\n  }\n\n  /* 把各類的東西輪流排開' },
    /* 座標讀不出來的元素要響亮地失敗，不可以靜靜不算。 */
    { file:'index', expect:'coordinates the geometry reader cannot read',
      find:'      var pts = (form === \'zh\') ? strokesZH(k, ox, oy) : strokesEN(k, ox, oy);',
      replace:'      s += \'<rect x="oops" y="0" width="4" height="4"/>\';\n      var pts = (form === \'zh\') ? strokesZH(k, ox, oy) : strokesEN(k, ox, oy);' },
    /* 解釋算對了，用的卻不是這一題的關係：1 ＋ 1 ＝ 2 也等於 2。 */
    { file:'index', expect:'why never shows the working "10 － 5 － 3 ＝ 2"',
      find:"          why:'各類加起來要等於總數：10 － 5 － 3 ＝ 2 張。' }",
      replace:"          why:'各類加起來要等於總數：1 ＋ 1 ＝ 2 張。' }" },
    /* 遊戲的最多／最少解釋把比較方向講反了。 */
    { file:'index', expect:'gWhy states the opposite comparison',
      find:"          return r.counts[mi] + ' 最大，所以' + this.catName(r.wi, r.cats[mi]) + '最多。';",
      replace:"          return r.counts[mi] + ' 最小，所以' + this.catName(r.wi, r.cats[mi]) + '最多。';" },
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
    /* 遊戲選項是字串 "9"：new Set 當成兩項、範圍比較也過，畫面上卻是兩個 9。 */
    { file:'index', expect:'is not a whole number',
      find:"    { kind:'total', wi:2, cats:[0,1,2], counts:[2,3,4],             opts:[7,5,9],  ans:2 },",
      replace:"    { kind:'total', wi:2, cats:[0,1,2], counts:[2,3,4],             opts:[7,'9',9], ans:2 }," },
    /* gWhy 說了答案，理由卻是假的算式。 */
    { file:'index', expect:'gWhy never shows the addition',
      find:"        if (r.kind === 'total') return r.counts.join(' ＋ ') + ' ＝ ' + t + '，全部一共 ' + this.qty(r.wi, t) + '。';",
      replace:"        if (r.kind === 'total') return '1 ＋ 1 ＝ 2，全部一共 ' + this.qty(r.wi, t) + '。';" },
    { file:'index', expect:'gWhy never shows the subtraction',
      find:"        return r.counts[r.a] + ' － ' + r.counts[r.b] + ' ＝ ' + (r.counts[r.a] - r.counts[r.b]) + '，多 ' +",
      replace:"        return '1 － 1 ＝ 0，多 ' +" },
    { file:'index', expect:'gWhy never states the deciding count',
      find:"          return r.counts[mi] + ' 最大，所以' + this.catName(r.wi, r.cats[mi]) + '最多。';",
      replace:"          return '所以' + this.catName(r.wi, r.cats[mi]) + '最多。';" },
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
    /* 刪掉一關：五種問法還是都出現過（count/most/total/diff/least 各一），
       但關卡數就不是 5 了 —— 只有順序真值表看得到。 */
    { file:'index', expect:'the checker expects 5',
      find:"    { kind:'least', wi:1, cats:[0,2,3], counts:[5,2,4],             opts:[0,2,1],  ans:2 }\n  ];",
      replace:"  ];" },
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
      replace:'    var gw = 24, gap = 10, rowH = 26, pad = 3, perRow = 5, spare = 0;' }
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
    dataReturn: '{WORLDS, CARD_ICONS, SORT_EX, TALLY_EX, READ_EX, ROUNDS, itemsSVG, tallySVG, mixIcons, countsUpTo}',
    check: function(data, I18N, fail){
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
        const h = Number((svg.match(/\bheight="(\d+)"/) || [])[1]);
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
      for (let n = 1; n <= 14; n++){
        const icons = [];
        for (let i = 0; i < n; i++) icons.push(data.WORLDS[0].icons[i % 4]);
        const svg = data.itemsSVG(icons);
        widthOk(`itemsSVG(${n})`, svg);
        const dc = Number((svg.match(/data-count="(\d+)"/) || [])[1]);
        if (dc !== n) fail(`itemsSVG(${n}): data-count is ${dc}, expected ${n}`);
        const drawn = (svg.match(/<text\b/g) || []).length;
        if (drawn !== n) fail(`itemsSVG(${n}): draws ${drawn} items, expected ${n}`);
      }

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

      /* --- 遊戲關卡 --- */
      const KINDS = ['count','most','least','total','diff'];
      /* 關卡順序的真值表。只驗「五種問法都出現過」的話，多一關或少一關都不會被發現。 */
      const ROUND_KINDS = ['count','most','total','diff','least'];
      if (data.ROUNDS.length !== ROUND_KINDS.length){
        fail(`ROUNDS has ${data.ROUNDS.length} rounds, the checker expects ${ROUND_KINDS.length}`);
      }
      data.ROUNDS.forEach((r, i) => {
        if (r.kind !== ROUND_KINDS[i]){
          fail(`ROUND ${i + 1} is a "${r.kind}" round, the checker expects "${ROUND_KINDS[i]}"`);
        }
      });
      const seenKinds = {};
      data.ROUNDS.forEach((r, idx) => {
        const i = idx + 1;
        if (KINDS.indexOf(r.kind) < 0){ fail(`ROUND ${i} has an unknown kind ${r.kind}`); return; }
        seenKinds[r.kind] = true;
        if (!Number.isInteger(r.wi) || r.wi < 0 || r.wi >= data.WORLDS.length){
          fail(`ROUND ${i}: world ${r.wi} does not exist`); return;
        }
        if (r.cats.length !== r.counts.length){
          fail(`ROUND ${i}: cats and counts are index-aligned but have different lengths (${r.cats.length} vs ${r.counts.length})`);
          return;
        }
        r.cats.forEach((ci, j) => {
          if (!Number.isInteger(ci) || ci < 0 || ci >= 4) fail(`ROUND ${i}: category ${ci} does not exist`);
          if (r.cats.indexOf(ci) !== j) fail(`ROUND ${i}: category ${ci} appears twice`);
        });
        const gHi = perCatMax(r.cats.length);
        r.counts.forEach(n => {
          if (!Number.isInteger(n) || n < 1 || n > gHi) fail(`ROUND ${i}: each row must hold 1~${gHi}, got ${n}`);
        });
        const total = r.counts.reduce((a, b) => a + b, 0);
        if (total > MAX_TOTAL) fail(`ROUND ${i}: total ${total} is above this lesson range of ${MAX_TOTAL}`);
        /* 畫出來的那一堆一定要剛好是表格說的數量，不然孩子數到的和答案不一樣。 */
        const icons = data.mixIcons(r.wi, r.cats, r.counts);
        if (icons.length !== total) fail(`ROUND ${i}: the picture draws ${icons.length} things but the rows add up to ${total}`);
        r.cats.forEach((ci, j) => {
          const drawn = icons.filter(x => x === data.WORLDS[r.wi].icons[ci]).length;
          if (drawn !== r.counts[j]) fail(`ROUND ${i}: the picture draws ${drawn} of row ${j} but the count says ${r.counts[j]}`);
        });
        const svg = data.itemsSVG(icons);
        widthOk(`ROUND ${i} itemsSVG`, svg);

        /* 每一種問法自己的前提條件，以及答案的第二套算法。 */
        let want = null;
        if (r.kind === 'count'){
          if (!Number.isInteger(r.t) || r.t < 0 || r.t >= r.cats.length){ fail(`ROUND ${i}: t ${r.t} is not a row`); return; }
          want = r.counts[r.t];
        } else if (r.kind === 'total'){
          want = total;
        } else if (r.kind === 'diff'){
          if (!Number.isInteger(r.a) || !Number.isInteger(r.b) || r.a === r.b ||
              r.a < 0 || r.b < 0 || r.a >= r.cats.length || r.b >= r.cats.length){
            fail(`ROUND ${i}: a and b must be two different rows`); return;
          }
          if (!(r.counts[r.a] > r.counts[r.b])){
            fail(`ROUND ${i}: row a must have more of them than row b, or "how many more" has no positive answer`);
            return;
          }
          want = r.counts[r.a] - r.counts[r.b];
        } else {
          const m = (r.kind === 'most') ? Math.max.apply(null, r.counts) : Math.min.apply(null, r.counts);
          if (r.counts.filter(x => x === m).length !== 1){
            fail(r.kind === 'most'
              ? `ROUND ${i}: the largest count is tied (${r.counts.join(',')}), so there is no unique answer`
              : `ROUND ${i}: the smallest count is tied (${r.counts.join(',')}), so there is no unique answer`);
            return;
          }
          want = r.counts.indexOf(m);
        }
        if (r.opts.length !== 3) fail(`ROUND ${i} should offer 3 options, has ${r.opts.length}`);
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i} has duplicate options`);
        if (!Number.isInteger(r.ans) || r.ans < 0 || r.ans >= r.opts.length){
          fail(`ROUND ${i}: ans ${r.ans} is not a valid option index`); return;
        }
        if (r.opts[r.ans] !== want){
          fail(`ROUND ${i}: opts[ans] does not equal the recomputed answer (${r.opts[r.ans]} vs ${want})`);
        }
        if (r.kind === 'most' || r.kind === 'least'){
          r.opts.forEach(o => {
            if (!Number.isInteger(o) || o < 0 || o >= r.cats.length) fail(`ROUND ${i}: option ${o} is not a row index`);
          });
        } else {
          /* 先驗「是整數」：`9` 和 `"9"` 在 new Set 裡是兩個項、範圍比較也會通過，
             畫面上卻是兩個一模一樣的選項。 */
          r.opts.forEach(o => {
            if (!Number.isInteger(o)) fail(`ROUND ${i}: option ${JSON.stringify(o)} is not a whole number`);
            else if (!(o >= 1 && o <= total)) fail(`ROUND ${i}: option ${o} is outside 1~${total}`);
          });
        }
        LANGS.forEach(L => {
          const d = I18N[L];
          const ask = d.gAsk(r), opt = d.gOpt(r, r.opts[r.ans]);
          const h1 = d.gHint1(r), h2 = d.gHint2(r), why = d.gWhy(r);
          [ask, opt, h1, h2, why].forEach(s => { if (/undefined|NaN/.test(s)) fail(`ROUND ${i} ${L}: ${s}`); });
          [['gAsk', ask], ['gOpt', opt], ['gHint1', h1], ['gHint2', h2], ['gWhy', why]]
            .forEach(pair => proseOk(`ROUND ${i} ${L} ${pair[0]}`, pair[1], L));
          if (ask.indexOf(d.thingName(r.wi)) < 0) fail(`ROUND ${i} ${L}: gAsk never says what the pile is`);
          /* 第二層提示要真的接近答案：每一列的「類別名 ＋ 數量」都要印出來。
             只驗數字的話，兩列剛好一樣多時少印一列也會過；只驗類別名的話，
             把數量整個拿掉也會過 —— 所以兩個要黏在一起比。 */
          r.counts.forEach((n, j) => {
            const cn = d.catName(r.wi, r.cats[j]);
            if (h2.indexOf(cn + ' ' + n) < 0) fail(`ROUND ${i} ${L}: gHint2 never mentions row ${j} ("${cn} ${n}")`);
          });
          if (why.indexOf(opt) < 0) fail(`ROUND ${i} ${L}: gWhy never states the answer "${opt}"`);
          /* 只驗「答案有出現」的話，「1 ＋ 1 ＝ 2，全部一共 9 顆」也會過 ——
             每一種問法都要驗它自己那個決定性的關係真的被寫出來。 */
          const PLUS = L === 'zh' ? ' ＋ ' : ' + ';
          const MINUS = L === 'zh' ? ' － ' : ' − ';
          const EQ = L === 'zh' ? ' ＝ ' : ' = ';
          if (r.kind === 'total'){
            const sentence = r.counts.join(PLUS) + EQ + total;
            if (why.indexOf(sentence) < 0) fail(`ROUND ${i} ${L}: gWhy never shows the addition "${sentence}"`);
          } else if (r.kind === 'diff'){
            const sentence = r.counts[r.a] + MINUS + r.counts[r.b] + EQ + want;
            if (why.indexOf(sentence) < 0) fail(`ROUND ${i} ${L}: gWhy never shows the subtraction "${sentence}"`);
          } else if (r.kind === 'count'){
            if (why.indexOf(d.catName(r.wi, r.cats[r.t])) < 0){
              fail(`ROUND ${i} ${L}: gWhy never names the row that was asked about`);
            }
          } else {
            /* 最多／最少：解釋要引用決勝的數字、指名是哪一類，**而且要說對方向**。
               只驗數字與類別名的話，「6 最小，所以月亮貼紙最多」兩個子字串都在，照樣通過。 */
            const m = r.counts[want];
            if (!new RegExp('(?<![0-9])' + m + '(?![0-9])').test(why)){
              fail(`ROUND ${i} ${L}: gWhy never states the deciding count ${m}`);
            }
            if (why.indexOf(d.catName(r.wi, r.cats[want])) < 0){
              fail(`ROUND ${i} ${L}: gWhy never names the winning row`);
            }
            const rel = (L === 'zh')
              ? (r.kind === 'most' ? m + ' 最大' : m + ' 最小')
              : (r.kind === 'most' ? m + ' is the biggest' : m + ' is the smallest');
            const wrongRel = (L === 'zh')
              ? (r.kind === 'most' ? m + ' 最小' : m + ' 最大')
              : (r.kind === 'most' ? m + ' is the smallest' : m + ' is the biggest');
            if (why.indexOf(rel) < 0) fail(`ROUND ${i} ${L}: gWhy never says "${rel}"`);
            if (why.indexOf(wrongRel) >= 0) fail(`ROUND ${i} ${L}: gWhy states the opposite comparison "${wrongRel}"`);
          }
          /* 選項的標籤要跟著問法走：問哪一類就用類別名，問幾個就用數量。 */
          const expect = (r.kind === 'most' || r.kind === 'least')
            ? d.catName(r.wi, r.cats[r.opts[r.ans]])
            : d.qty(r.wi, want);
          if (opt !== expect) fail(`ROUND ${i} ${L}: the option label is "${opt}", the checker expects "${expect}"`);
        });
      });
      KINDS.forEach(k => { if (!seenKinds[k]) fail(`ROUNDS is missing a "${k}" round`); });
      if (data.ROUNDS.map(r => r.ans).every(x => x === 0)) fail('every game round has the answer first');

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
