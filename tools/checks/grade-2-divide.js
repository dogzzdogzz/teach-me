/* grade-2/math/divide（分裝與平分）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課的關鍵在「同一個數字、不同的單位是不同的答案」：
   「4 包」和「4 顆」數字一樣，卻是兩個完全不同的答案（一個是份數，一個是每份的個數），
   而這正是這個單元最容易搞混的地方。所以：
   - 去重的鍵一定要含單位種類（grp／item），不能只比數字；
   - 正解字串要由這個設定檔自己的情境表（SCENE_TRUTH）重算一次，
     不能呼叫 review.html 的格式化函式 —— 那等於自己比自己。 */

/* ---------- 設定檔自己的情境表（和 review.html 的 SCENES 對齊，但是獨立的一份） ---------- */
const SCENE_TRUTH = [
  { zh:{ thing:'糖果', item:'顆', grp:'包' }, en:{ item:'sweet',   itemN:'sweets',   grp:'bag',    grpN:'bags'    } },
  { zh:{ thing:'蘋果', item:'個', grp:'籃' }, en:{ item:'apple',   itemN:'apples',   grp:'basket', grpN:'baskets' } },
  { zh:{ thing:'餅乾', item:'片', grp:'盤' }, en:{ item:'biscuit', itemN:'biscuits', grp:'plate',  grpN:'plates'  } },
  { zh:{ thing:'鉛筆', item:'枝', grp:'盒' }, en:{ item:'pencil',  itemN:'pencils',  grp:'box',    grpN:'boxes'   } }
];
function fItem(si, n, lang){
  const s = SCENE_TRUTH[si];
  return lang === 'zh' ? (n + ' ' + s.zh.item) : (n + ' ' + (n === 1 ? s.en.item : s.en.itemN));
}
function fGrp(si, n, lang){
  const s = SCENE_TRUTH[si];
  return lang === 'zh' ? (n + ' ' + s.zh.grp) : (n + ' ' + (n === 1 ? s.en.grp : s.en.grpN));
}

/* 這一課的選項一律是物件。去重鍵含單位種類 —— 只比數字的話，
   「4 包」和「4 顆」會被當成重複而被擋掉，可是它們是刻意的單位誘答。
   反過來說，只比字串就會放過「4 包」和「4 包」。 */
function keyOf(v){
  if (!v || typeof v !== 'object') return 'bad';
  if (v.u === 'item' || v.u === 'grp') return v.u + '#' + v.n;
  if (v.u === 'eq') return 'eq#' + v.op;
  if (v.u === 'phr') return 'phr#' + v.p + '#' + v.n;
  if (v.u === 'triple') return 'triple#' + v.a + ',' + v.b + ',' + v.c;
  return 'bad';
}
function distinctOpts(d){
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
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (keyOf(d.correct) !== want) return 'correct is ' + keyOf(d.correct) + ', expected ' + want;
  return null;
}
/* 每一個帶單位的選項都要用「這一題自己的情境」。少了這一條，一題糖果題裡
   冒出「5 籃」也會通過：形狀對、去重也過，孩子卻看到不相干的單位。 */
function optScenesOk(d){
  for (let i = 0; i < d.opts.length; i++){
    const o = d.opts[i];
    if (!o || (o.u !== 'item' && o.u !== 'grp' && o.u !== 'phr')) continue;
    if (!Number.isInteger(o.si) || o.si !== d.si){
      return 'option ' + i + ' uses scene ' + o.si + ', but the question is scene ' + d.si;
    }
  }
  return null;
}
/* 算式題的誘答不可以「照著算也得到正解」。乘法可以交換，而加法在
   k ＝ 2、答案 ＝ 2（總數 4）時剛好也成立（2 ＋ □ ＝ 4）——
   所以每一個誘答都要把 □ 解出來，跟正解比一次。 */
function eqDistractorsWrong(d, ansWant){
  for (let i = 0; i < d.opts.length; i++){
    const o = d.opts[i];
    if (!o || o.u !== 'eq') return 'option ' + i + ' is not a number sentence';
    if (o === d.correct) continue;
    let box = null;
    if (o.op === 'addBox') box = o.total - o.k;
    else if (o.op === 'subBox') box = o.k - o.total;
    else if (o.op === 'mulFlip') box = o.total * o.k;
    else if (o.op === 'mulBox' || o.op === 'boxMul') box = o.total / o.k;
    else return 'option ' + i + ' has an unknown sentence shape ' + o.op;
    if (box === ansWant){
      return 'distractor ' + o.op + ' also solves to the correct answer ' + ansWant;
    }
  }
  return null;
}
function base(d, want){ return distinctOpts(d) || optScenesOk(d) || answerIs(d, want); }
/* 情境編號一定要落在設定檔認得的範圍裡，否則 SCENE_TRUTH[si] 會是 undefined，
   接下來每一個字串比對都會變成 undefined 對 undefined —— 整題沒被驗到卻是綠的。 */
function sceneOk(d){
  if (!Number.isInteger(d.si) || d.si < 0 || d.si >= SCENE_TRUTH.length){
    return 'scene index ' + d.si + ' is outside the checker catalogue (0~' + (SCENE_TRUTH.length - 1) + ')';
  }
  return null;
}
/* 「總數 ＝ 每份幾個 × 幾份」是這一課唯一的算式，每個產生器都要成立。 */
function productOk(total, a, b){
  if (total !== a * b) return 'total is not per × groups (' + total + ' vs ' + a + ' × ' + b + ')';
  return null;
}
/* 每份至少 2 個、至少 2 份 —— 一份 1 個或只有 1 份的「分東西」沒有意義，
   而且會讓英文的單複數判斷失去保護對象。 */
function sizesOk(per, groups){
  if (!(per >= 2 && per <= 9)) return 'each group must hold 2~9 items, got ' + per;
  if (!(groups >= 2 && groups <= 9)) return 'there must be 2~9 groups, got ' + groups;
  return null;
}

/* 每個產生器的選項可以長什麼樣（單位種類），以及數字的範圍。
   每一條都要寫得出「這個上限是怎麼算出來的」—— 隨手給一個大數等於沒有範圍檢查。 */
const SHAPE = {
  packing:    ['grp'],
  sharing:    ['item'],
  packEq:     ['eq'],
  shareEq:    ['eq'],
  unitPick:   ['grp','item'],   /* 刻意的單位誘答：同一個數字、錯的單位 */
  totalCheck: ['item'],
  arrayRow:   ['item'],
  meaningOf:  ['phr'],
  equalCheck: ['triple']
};
const RANGE = {
  /* 每份 ≤ 9、份數 ≤ 6 → 總數 ≤ 54；最大的誘答是「把總數當份數」＝ 54。 */
  packing:    [1, 54],
  sharing:    [1, 54],
  /* 算式裡出現的數字：每份 2~9，總數 ＝ 每份 × 份數 ≤ 9 × 9 ＝ 81。 */
  packEq:     [2, 81],
  shareEq:    [2, 81],
  unitPick:   [1, 54],
  /* 誘答最大的是「每份的數字乘自己」9 × 9 ＝ 81（總數 ＋ 每份最多 54 ＋ 9 ＝ 63）。 */
  totalCheck: [1, 81],
  arrayRow:   [1, 54],
  /* 選項裡的數字就是份數，2~6（份數 < 2 由 sizesOk 先擋掉，這裡是第二道）。 */
  meaningOf:  [2, 6],
  /* 每人 3~9，最大的誘答是 q ＋ 2 ＝ 11。 */
  equalCheck: [1, 11]
};

/* 選項字串的形狀。單位詞的清單就是 SCENE_TRUTH 裡的那些，不多不少。 */
const ZH_ITEM = '顆|個|片|枝';
const ZH_GRP = '包|籃|盤|盒';
const EN_ITEM = 'sweet|sweets|apple|apples|biscuit|biscuits|pencil|pencils';
const EN_GRP = 'bag|bags|basket|baskets|plate|plates|box|boxes';
const EN_SING = ['bag','basket','plate','box','sweet','apple','biscuit','pencil'];
const EN_PLUR = ['bags','baskets','plates','boxes','sweets','apples','biscuits','pencils'];
const SHAPES = {
  zh: {
    item:   new RegExp('^\\d+ (?:' + ZH_ITEM + ')$'),
    grp:    new RegExp('^\\d+ (?:' + ZH_GRP + ')$'),
    eq:     /^(?:\d+ × □|□ × \d+|\d+ ＋ □|\d+ － □) ＝ \d+$|^\d+ × \d+ ＝ □$/,
    phr:    new RegExp('^(?:有 \\d+ (?:' + ZH_GRP + ')|每(?:' + ZH_GRP + ')有 \\d+ (?:' + ZH_ITEM +
                       ')|一共有 \\d+ (?:' + ZH_ITEM + ')|剩下 \\d+ (?:' + ZH_ITEM + '))$'),
    triple: /^\d+、\d+、\d+$/
  },
  en: {
    item:   new RegExp('^\\d+ (?:' + EN_ITEM + ')$'),
    grp:    new RegExp('^\\d+ (?:' + EN_GRP + ')$'),
    eq:     /^(?:\d+ × □|□ × \d+|\d+ \+ □|\d+ − □) = \d+$|^\d+ × \d+ = □$/,
    phr:    new RegExp('^(?:\\d+ (?:' + EN_GRP + ') in total|\\d+ (?:' + EN_ITEM + ') in each (?:bag|basket|plate|box)' +
                       '|\\d+ (?:' + EN_ITEM + ') in total|\\d+ (?:' + EN_ITEM + ') left over)$'),
    triple: /^\d+, \d+, \d+$/
  }
};

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   2026-09-02 補上（issue #2）：這個設定檔**從來沒有讀過 q.why**，所以解釋裡
   寫錯的算式一路綠燈。量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，
   那一課的算式會多出一個假的運算元，而且是靜靜地多出來。 */
const arithDivide = require('./lib/arith.js').makeArith({
  units: ["顆", "包", "盒", "個", "人", "份", "排", "袋", "塊", "張"],
  unitsEn: ["sweets?", "bags?", "boxes", "box", "pieces?", "people", "person", "plates?", "rows?", "packs?", "items?"]
});

const { canvasProblems } = require('./lib/canvas.js');

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/divide */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] is not the correct value object',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'two options are the same answer',
      find:'      if (ok(c)){ seen[vkeyOf(c)] = true; out.push(c); }',
      replace:'      if (c){ out.push(c); }' },
    { file:'review', expect:'option count',
      find:'    var i = 0;\n    while (out.length < 3 && i < 60){',
      replace:'    var i = 0;\n    while (out.length < 3 && i < 0){' },
    /* 去重鍵不含單位種類的話，「4 包」和「4 顆」會被當成重複 ——
       unitPick 的單位誘答就會被擋掉，選項只剩三個。 */
    { file:'review', expect:'needs the same-number-wrong-unit distractor',
      find:"    if (v.u === 'item' || v.u === 'grp') return v.u + '#' + v.n;",
      replace:"    if (v.u === 'item' || v.u === 'grp') return 'n#' + v.n;" },

    /* --- review.html：格式化寫錯（證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"    return lang === 'zh' ? (n + ' ' + s.zh.grp)",
      replace:"    return lang === 'zh' ? (n + ' ' + s.zh.item)" },
    { file:'review', expect:'plural does not match',
      find:"                         : (n + ' ' + (n === 1 ? s.en.grp : s.en.grpN));",
      replace:"                         : (n + ' ' + s.en.grp);" },
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.op === 'mulBox')  return v.k + ' × □' + eq + v.total;",
      replace:"    if (v.op === 'mulBox')  return v.k + ' × □' + eq + (v.total + 1);" },
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.op === 'boxMul')  return '□ × ' + v.k + eq + v.total;",
      replace:"    if (v.op === 'boxMul')  return '□ × ' + v.total + eq + v.k;" },
    { file:'review', expect:'opts[ans] != correct',
      find:"      if (v.p === 'grpCount')  return '有 ' + n + ' ' + grpWord(si, 'zh');",
      replace:"      if (v.p === 'grpCount')  return '有 ' + n + ' ' + itemWord(si, 'zh');" },

    /* --- review.html：每一個產生器算錯 --- */
    { file:'review', expect:'correct is',
      find:'        var correct = GR(si, g);\n        /* 誘答：把「每包幾顆」抄回來當包數（最經典的錯）、多數一包、用減的。 */',
      replace:'        var correct = GR(si, per);\n        /* 誘答：把「每包幾顆」抄回來當包數（最經典的錯）、多數一包、用減的。 */' },
    { file:'review', expect:'correct is',
      find:'        var correct = IT(si, q);\n        /* 誘答：把「幾個人」抄回來當每人幾個、多發一輪、用減的。 */',
      replace:'        var correct = IT(si, n);\n        /* 誘答：把「幾個人」抄回來當每人幾個、多發一輪、用減的。 */' },
    { file:'review', expect:'the answer must be counted in groups',
      find:'        var correct = GR(si, g);\n        /* 刻意的單位誘答：同一個數字、錯的單位。 */',
      replace:'        var correct = IT(si, g);\n        /* 刻意的單位誘答：同一個數字、錯的單位。 */' },
    { file:'review', expect:'correct is',
      find:'        var correct = IT(si, total);\n        /* 誘答：用加的、少乘一份、把每份的數字乘自己。 */',
      replace:'        var correct = IT(si, total - per);\n        /* 誘答：用加的、少乘一份、把每份的數字乘自己。 */' },
    { file:'review', expect:'correct is',
      find:'        var correct = IT(si, c);\n        var cands = [ IT(si, r), IT(si, c + 1), IT(si, total - r) ];',
      replace:'        var correct = IT(si, r);\n        var cands = [ IT(si, r), IT(si, c + 1), IT(si, total - r) ];' },
    { file:'review', expect:'total is not per × groups',
      find:"        var per = pickPer(g === 2 ? 2 : 0);\n        var total = per * g;\n        var correct = EQ('mulBox', per, total);",
      replace:"        var per = pickPer(g === 2 ? 2 : 0);\n        var total = per + g;\n        var correct = EQ('mulBox', per, total);" },
    { file:'review', expect:'total is not per × groups',
      find:"        var q = pickPer(n === 2 ? 2 : 0);\n        var total = n * q;\n        var correct = EQ('boxMul', n, total);",
      replace:"        var q = pickPer(n === 2 ? 2 : 0);\n        var total = n + q;\n        var correct = EQ('boxMul', n, total);" },
    { file:'review', expect:'total is not per × groups',
      find:'        var q = pickPer();\n        var total = n * q;\n        var correct = IT(si, q);',
      replace:'        var q = pickPer();\n        var total = n + q;\n        var correct = IT(si, q);' },
    { file:'review', expect:'total is not per × groups',
      find:'        var r = pickUnused([2,3,4,5,6], used);\n        var c = pickPer();\n        var total = r * c;',
      replace:'        var r = pickUnused([2,3,4,5,6], used);\n        var c = pickPer();\n        var total = r + c;' },
    { file:'review', expect:'total is not 3 shares',
      find:'        var q = pickUnused([3,4,5,6,7,8,9], used);\n        var total = 3 * q;',
      replace:'        var q = pickUnused([3,4,5,6,7,8,9], used);\n        var total = 4 * q;' },
    { file:'review', expect:'each share must be 3~9',
      find:'        var q = pickUnused([3,4,5,6,7,8,9], used);',
      replace:'        var q = pickUnused([1,2,3,4,5,6,7,8,9], used);' },
    /* 份額下限那一條要有自己的改壞版本：這一組誘答加起來還是總數，
       但 q ＝ 3 的時候會生出「0 份」—— 只驗總和的話這一筆會靜靜通過。 */
    { file:'review', expect:'a share must be at least 1',
      find:'        var opts = shuffle([correct, TR(q - 1, q, q + 1), TR(q - 2, q, q + 2), TR(q + 1, q + 1, q - 2)]);',
      replace:'        var opts = shuffle([correct, TR(q - 3, q, q + 3), TR(q - 2, q, q + 2), TR(q + 1, q + 1, q - 2)]);' },
    { file:'review', expect:'does not add up to the total',
      find:'        var opts = shuffle([correct, TR(q - 1, q, q + 1), TR(q - 2, q, q + 2), TR(q + 1, q + 1, q - 2)]);',
      replace:'        var opts = shuffle([correct, TR(q - 1, q, q + 2), TR(q - 2, q, q + 2), TR(q + 1, q + 1, q - 2)]);' },
    /* 這兩題的誘答只有在「每份 ≠ 份數」時才真的是錯的答案 ——
       每份 ＝ 份數 的時候，「每包 g 個」變成一句真話，就有兩個正確選項了。 */
    { file:'review', expect:'must differ from the number of groups',
      find:'        var per = pickPer(g);              /* per ≠ g，不然「每包 g 個」會變成真的 */',
      replace:'        var per = pickPer();              /* per ≠ g，不然「每包 g 個」會變成真的 */' },
    { file:'review', expect:'must differ from the number of groups',
      find:'        var per = pickPer(g);              /* per ≠ g，不然「每包 g 個」也會是對的 */',
      replace:'        var per = pickPer();              /* per ≠ g，不然「每包 g 個」也會是對的 */' },
    { file:'review', expect:'each group must hold 2~9 items',
      find:'    var pool = [2,3,4,5,6,7,8,9].filter(function(x){ return x !== avoid; });',
      replace:'    var pool = [1,2,3,4,5,6,7,8,9].filter(function(x){ return x !== avoid; });' },
    { file:'review', expect:'outside 1~54',
      find:'          return (v >= 1 && v <= 54) ? GR(si, v) : null;\n        });\n        return { si:si, per:per, g:g, total:total, correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'          return (v >= 1 && v <= 54) ? GR(si, v) : null;\n        });\n        mix.opts[(mix.ans + 1) % 4] = GR(si, 400);\n        return { si:si, per:per, g:g, total:total, correct:correct, opts:mix.opts, ans:mix.ans };' },

    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? (d.per + ' × ' + d.g + ' ＝ ' + d.total + '，' + d.total + ' 裡面有 ' + d.g + ' 個 ' + d.per +",
      replace:"            ? (d.per + ' × ' + d.g + ' ＝ ' + d.total + '，' + d.total + ' 裡面有' + d.g + ' 個 ' + d.per +" },
    { file:'review', expect:'doubled punctuation',
      find:"               ' groups of ' + d.per + ' — that is ' + qtyGrp(d.si, d.g, 'en') + '.')",
      replace:"               ' groups of ' + d.per + ' — that is ' + qtyGrp(d.si, d.g, 'en') + '..')" },

    /* --- index.html：範例資料、題庫與遊戲關卡 --- */
    { file:'index', expect:'PACK_EX total is not a whole number of groups',
      find:'  var PACK_EX = { si:0, total:12, per:3 };',
      replace:'  var PACK_EX = { si:0, total:13, per:3 };' },
    { file:'index', expect:'SHARE_EX total is not a whole number of shares',
      find:'  var SHARE_EX = { si:1, total:12, n:3 };',
      replace:'  var SHARE_EX = { si:1, total:12, n:5 };' },
    { file:'index', expect:'BOTH_EX total is not a whole number of groups',
      find:'  var BOTH_EX = { si:0, total:12, k:3 };',
      replace:'  var BOTH_EX = { si:0, total:12, k:5 };' },
    { file:'index', expect:'is not a whole number of parts',
      find:"    { kind:'share', si:2, total:20, k:4 },",
      replace:"    { kind:'share', si:2, total:20, k:3 }," },
    { file:'index', expect:'opts[ans] does not equal total/k',
      find:"    { kind:'pack',  si:2, total:20, k:5, opts:[5, 4, 15], ans:1 },",
      replace:"    { kind:'pack',  si:2, total:20, k:5, opts:[5, 4, 15], ans:0 }," },
    { file:'index', expect:'does not divide by',
      find:"    { kind:'share', si:1, total:12, k:4, opts:[4, 3, 8],  ans:1 },",
      replace:"    { kind:'share', si:1, total:13, k:4, opts:[4, 3, 8],  ans:1 }," },
    { file:'index', expect:'duplicate options',
      find:"    { kind:'share', si:3, total:18, k:3, opts:[9, 3, 6],  ans:2 },",
      replace:"    { kind:'share', si:3, total:18, k:3, opts:[6, 3, 6],  ans:2 }," },
    { file:'index', expect:'is outside 1~',
      find:"    { kind:'pack',  si:0, total:12, k:3, opts:[4, 3, 6],  ans:0 },",
      replace:"    { kind:'pack',  si:0, total:12, k:3, opts:[4, 3, 60],  ans:0 }," },
    { file:'index', expect:'the item unit and the group unit must differ',
      find:"        { thing:'蘋果', item:'個', grp:'籃' },",
      replace:"        { thing:'蘋果', item:'個', grp:'個' }," },
    { file:'index', expect:'singular and plural must differ',
      find:"        { item:'apple',   itemN:'apples',   grp:'basket', grpN:'baskets' },",
      replace:"        { item:'apple',   itemN:'apples',   grp:'basket', grpN:'basket' }," },
    { file:'index', expect:'p1End zh never shows the full number sentence',
      find:"               c.per + ' × ' + g + ' ＝ ' + c.total + '</span>';",
      replace:"               c.per + ' × ' + g + '</span>';" },
    { file:'index', expect:'p2End zh never states the answer with its unit',
      find:"        return '發完了！每人 <span class=\"bigans\">' + this.qtyItem(c.si, q) +",
      replace:"        return '發完了！每人 <span class=\"bigans\">' + q +" },
    { file:'index', expect:'b2 zh/pack never counts up to the total',
      find:"          for (var i = 1; i <= ans; i++) seq.push(i * c.k);\n          return '一' + this.grpWord(c.si) + '一' + this.grpWord(c.si) + '裝：' + seq.join('、') + ' —— 剛好裝完。';",
      replace:"          for (var i = 1; i <= ans; i++) seq.push(i * c.k + 1);\n          return '一' + this.grpWord(c.si) + '一' + this.grpWord(c.si) + '裝：' + seq.join('、') + ' —— 剛好裝完。';" },
    { file:'index', expect:'b3 zh/pack never states the answer with its unit',
      find:"          ? ('答案是 <span class=\"bigans\">' + this.qtyGrp(c.si, ans) + '</span>（單位是「' + this.grpWord(c.si) +",
      replace:"          ? ('答案是 <span class=\"bigans\">' + ans + '</span>（單位是「' + this.grpWord(c.si) +" },
    { file:'index', expect:'e2 never shows the empty box',
      find:"               (c.kind === 'pack' ? (c.k + ' × □ ＝ ' + c.total) : ('□ × ' + c.k + ' ＝ ' + c.total)) +",
      replace:"               (c.kind === 'pack' ? (c.k + ' × ? ＝ ' + c.total) : ('? × ' + c.k + ' ＝ ' + c.total)) +" },
    { file:'index', expect:'gWhy never states the answer',
      find:"          ? (r.k + ' × ' + ans + ' ＝ ' + r.total + '，所以是 ' + this.qtyGrp(r.si, ans) + '。')",
      replace:"          ? (r.k + ' × ' + ans + ' ＝ ' + r.total + '，分完了。')" },
    { file:'index', expect:'gHint2 never mentions',
      find:"        return '提示：想九九乘法 —— ' +\n               (r.kind === 'pack' ? (r.k + ' × □ ＝ ' + r.total) : ('□ × ' + r.k + ' ＝ ' + r.total));",
      replace:"        return '提示：想九九乘法。' +\n               (r.kind === 'pack' ? '' : '');" },
    { file:'index', expect:'the checker expects',
      find:"          opts:['3 包','4 包','9 包','12 包'], ans:1,",
      replace:"          opts:['3 包','4 包','9 包','12 包'], ans:0," },
    { file:'index', expect:'is not a valid option index',
      find:"          opts:['4 顆','5 包','4 包','20 包'], ans:2,",
      replace:"          opts:['4 顆','5 包','4 包','20 包'], ans:9," },
    /* --- 第一輪審查抓到的那幾筆，各自要有自己的改壞版本 --- */
    /* per ＝ g ＝ 2（總數 4）時，「2 ＋ □ ＝ 4」也解得出 2 —— 加法誘答變成第二個正解。 */
    { file:'review', expect:'also solves to the correct answer',
      find:"        var per = pickPer(g === 2 ? 2 : 0);\n        var total = per * g;\n        var correct = EQ('mulBox', per, total);",
      replace:"        var per = pickPer(0);\n        var total = per * g;\n        var correct = EQ('mulBox', per, total);" },
    { file:'review', expect:'also solves to the correct answer',
      find:"        var q = pickPer(n === 2 ? 2 : 0);\n        var total = n * q;\n        var correct = EQ('boxMul', n, total);",
      replace:"        var q = pickPer(0);\n        var total = n * q;\n        var correct = EQ('boxMul', n, total);" },
    /* 糖果題裡冒出「5 籃」：形狀對、去重也過，只有情境綁定擋得住。 */
    { file:'review', expect:'but the question is scene',
      find:'        var cands = [ GR(si, per), GR(si, g + 1), GR(si, total - per) ];',
      replace:'        var cands = [ GR((si + 1) % 4, per), GR(si, g + 1), GR(si, total - per) ];' },
    /* 字典的單位詞打錯字（顆 → 棵）：後面每一條渲染檢查用的都是同一本字典，
       只有逐字比對真值表才抓得到。 */
    { file:'index', expect:'zh scenes[0].item is',
      find:"        { thing:'糖果', item:'顆', grp:'包' },",
      replace:"        { thing:'糖果', item:'棵', grp:'包' }," },
    /* 12.5 顆糖分成每包 2.5 顆：整除、範圍、字串全都對得上。 */
    { file:'index', expect:'must be a whole number',
      find:'  var PACK_EX = { si:0, total:12, per:3 };',
      replace:'  var PACK_EX = { si:0, total:12.5, per:2.5 };' },
    /* 把題幹的 12 改成 13、答案還留著「4 包」—— 位置式神諭抓不到，數字神諭才抓得到。 */
    { file:'index', expect:'never appears in the stem',
      find:"        { stem:'🍬 12 顆糖果，每包裝 3 顆。<br>可以裝幾包？',",
      replace:"        { stem:'🍬 13 顆糖果，每包裝 3 顆。<br>可以裝幾包？'," },
    /* 只驗正解的話，把某個誘答換成垃圾字串也不會有人發現。 */
    { file:'index', expect:'does not look like an answer',
      find:"          opts:['3 包','4 包','9 包','12 包'], ans:1,",
      replace:"          opts:['3 包','4 包','banana','12 包'], ans:1," },
    /* 圖的寬度只算袋子／盤子的話，一開始那一排散落的東西會被整段切掉。 */
    { file:'index', expect:'px wide but the text',
      find:'    var w = Math.max(cols * (bagW + gap) + 10, looseW);',
      replace:'    var w = cols * (bagW + gap) + 10;' },
    { file:'index', expect:'px wide but the text',
      find:'    var w = Math.max(n * (plateW + gap) + 10, looseW);',
      replace:'    var w = n * (plateW + gap) + 10;' },
    /* --- 第二輪審查（審「修正本身」）抓到的那幾筆 --- */
    /* 只驗頭尾兩格的話，中間那一格被切掉不會有人發現。 */
    { file:'index', expect:'draws out to x=',
      find:'    var w = Math.max(cols * (bagW + gap) + 10, looseW);',
      replace:'    var w = (bags === 2) ? 40 : Math.max(cols * (bagW + gap) + 10, looseW);' },
    /* 只讀元素的起點 x 的話，一個比畫布還寬的矩形也會過關。 */
    { file:'index', expect:'draws out to x=',
      find:"      s += '<rect x=\"' + bx + '\" y=\"' + by + '\" width=\"' + bagW + '\" height=\"' + bagH +",
      replace:"      s += '<rect x=\"' + bx + '\" y=\"' + by + '\" width=\"' + (bagW * 3) + '\" height=\"' + bagH +" },
    /* 刪掉最後一題英文題目：中文長度還是對的，英文那一圈就少驗一題。 */
    { file:'index', expect:'en qs: 5 questions but 6 expected',
      find:"        { stem:'🍪 15 biscuits are shared equally among 3 children.<br>Which way of splitting them is equal sharing?',\n          opts:['4, 5, 6','5, 5, 5','3, 5, 7','6, 6, 3'], ans:1,\n          why:'Equal sharing means everyone gets the same: 5, 5, 5 adds up to exactly 15 biscuits.' }\n      ],",
      replace:"      ]," },
    /* 題幹多塞一個數字：原本的兩個運算元還在，答案照樣重算得出來。 */
    { file:'index', expect:'unexpected number',
      find:"        { stem:'🍎 12 個蘋果，平分給 3 個小朋友。<br>每人幾個？',",
      replace:"        { stem:'🍎 12 個蘋果，平分給 3 個小朋友（另外還有 7 個梨子）。<br>每人幾個？'," },
    /* --- 第三輪審查（審第二輪的修正）抓到的 --- */
    /* 只看 x 的話，一段「起點在畫布內、內容卻長到畫出去」的居中文字量不到 ——
       這一筆證明新的量法真的把字數與 text-anchor 算進去了。 */
    { file:'index', expect:'draws out to x=',
      find:"           '\" font-size=\"13\" text-anchor=\"middle\" fill=\"#3B7DD8\" font-weight=\"800\">' + rounds + '</text>';",
      replace:"           '\" font-size=\"13\" text-anchor=\"middle\" fill=\"#3B7DD8\" font-weight=\"800\">' + String(rounds).repeat(30) + '</text>';" },
    { file:'index', expect:'expected answers recorded',
      find:"        { stem:'🍪 15 片餅乾平分給 3 個小朋友。<br>哪一種分法才是平分？',\n          opts:['4、5、6','5、5、5','3、5、7','6、6、3'], ans:1,\n          why:'平分就是每個人一樣多：5、5、5，加起來剛好 15 片。' }",
      replace:"        { stem:'🍪 15 片餅乾平分給 3 個小朋友。<br>哪一種分法才是平分？',\n          opts:['4、5、6','5、5、5','3、5、7','6、6、3'], ans:1,\n          why:'平分就是每個人一樣多：5、5、5，加起來剛好 15 片。' },\n        { stem:'🍬 4 顆糖果平分給 2 個小朋友。<br>每人幾顆？',\n          opts:['2 顆','1 顆','3 顆','4 顆'], ans:0, why:'2 × 2 ＝ 4，每人 2 顆。' }" },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'一包一包裝：3、6、9、12 —— 裝了 4 包。3 × 4 ＝ 12。'",
      replace:"why:'一包一包裝：3、6、9、12 —— 裝了 4 包。3 × 4 ＝ 13。'" },
    { file:'index', expect:"arithmetic coverage changed",
      find:"why:'一個一個輪流發，發 4 輪剛好發完，每人 4 個。4 × 3 ＝ 12。'",
      replace:"why:'一個一個輪流發，發四輪剛好發完，每人四個。'" },
    { file:'index', expect:"px tall but",
      find:"    var w = cols * size + 14, h = rows * size + 12;",
      replace:"    var w = cols * size + 14, h = 1;" }
  ],

  sim: {
    /* simgen 的通用「誘答抄題幹」檢查在這一課永遠不會響：選項是「4 包」，
       題幹的數字是「4」，字串比不到。所以「刻意把題幹的數字當誘答」這件事
       由每個產生器自己的不變條件把關（例如 unitPick 與 meaningOf 的 per ≠ g），
       這裡不需要白名單。 */
    stemEchoOk: {},

    INVARIANTS: {
      /* 分裝：知道每份幾個，要找幾份。正解的單位是「份」。 */
      packing: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.g > 6 ? 'packing draws at most 6 groups, got ' + d.g : null) ||
        (d.correct.u !== 'grp' ? 'the answer must be counted in groups' : null) ||
        base(d, 'grp#' + (d.total / d.per)),
      /* 平分：知道幾份，要找每份幾個。正解的單位是「個」。 */
      sharing: d => sceneOk(d) || productOk(d.total, d.q, d.n) || sizesOk(d.q, d.n) ||
        (d.n > 6 ? 'sharing uses at most 6 shares, got ' + d.n : null) ||
        (d.correct.u !== 'item' ? 'the answer must be counted in items' : null) ||
        base(d, 'item#' + (d.total / d.n)),
      /* 分裝的算式：空格在後面（每份 × □ ＝ 總數）。 */
      packEq: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.correct.op !== 'mulBox' ? 'the packing sentence must be per × box = total' : null) ||
        /* 誘答不可以是「□ × 每份 ＝ 總數」—— 乘法可以交換，那也算得出答案。 */
        (d.opts.some(o => o.u === 'eq' && o.op === 'boxMul')
          ? 'box × per = total also solves it, so it cannot be a distractor' : null) ||
        eqDistractorsWrong(d, d.total / d.per) ||
        base(d, 'eq#mulBox'),
      /* 平分的算式：空格在前面（□ × 份數 ＝ 總數）。 */
      shareEq: d => sceneOk(d) || productOk(d.total, d.q, d.n) || sizesOk(d.q, d.n) ||
        (d.correct.op !== 'boxMul' ? 'the sharing sentence must be box × groups = total' : null) ||
        (d.opts.some(o => o.u === 'eq' && o.op === 'mulBox')
          ? 'per × box = total also solves it, so it cannot be a distractor' : null) ||
        eqDistractorsWrong(d, d.total / d.n) ||
        base(d, 'eq#boxMul'),
      /* 單位題：正解是份數，刻意放一個「同一個數字、錯的單位」的誘答。 */
      unitPick: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.per === d.g ? 'per must differ from the number of groups, otherwise the wrong-unit distractor is true too' : null) ||
        (d.correct.u !== 'grp' ? 'the answer must be counted in groups' : null) ||
        (!d.opts.some(o => o.u === 'item' && o.n === d.g)
          ? 'unitPick needs the same-number-wrong-unit distractor' : null) ||
        base(d, 'grp#' + (d.total / d.per)),
      /* 乘回去：每份幾個 × 幾份 ＝ 總數。 */
      totalCheck: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.correct.u !== 'item' ? 'the answer must be counted in items' : null) ||
        base(d, 'item#' + (d.per * d.g)),
      /* 排成幾排：等分除的另一種說法，正解是每排幾個。 */
      arrayRow: d => sceneOk(d) || productOk(d.total, d.c, d.r) || sizesOk(d.c, d.r) ||
        (d.r > 6 ? 'arrayRow uses at most 6 rows, got ' + d.r : null) ||
        (d.correct.u !== 'item' ? 'the answer must be counted in items' : null) ||
        base(d, 'item#' + (d.total / d.r)),
      /* 這個數字是什麼意思：正解是「有 g 份」。 */
      meaningOf: d => sceneOk(d) || productOk(d.total, d.per, d.g) || sizesOk(d.per, d.g) ||
        (d.per === d.g ? 'per must differ from the number of groups, otherwise the per-group phrase is true too' : null) ||
        (d.correct.p !== 'grpCount' ? 'the answer must be the group count' : null) ||
        base(d, 'phr#grpCount#' + (d.total / d.per)),
      /* 平分要一樣多：四種分法加起來都等於總數，只有一種是平分。 */
      equalCheck: d => {
        const bad = sceneOk(d);
        if (bad) return bad;
        if (d.total !== 3 * d.q) return 'total is not 3 shares of q (' + d.total + ' vs 3 × ' + d.q + ')';
        if (!(d.q >= 3 && d.q <= 9)) return 'each share must be 3~9, got ' + d.q;
        for (let i = 0; i < d.opts.length; i++){
          const o = d.opts[i];
          if (!o || o.u !== 'triple') return 'option ' + i + ' is not a three-way split';
          if (o.a + o.b + o.c !== d.total){
            return 'option ' + i + ' does not add up to the total (' + [o.a, o.b, o.c].join('+') + ' vs ' + d.total + ')';
          }
          if (!(o.a >= 1 && o.b >= 1 && o.c >= 1)) return 'a share must be at least 1 in option ' + i;
        }
        /* 只有一個選項可以是「三份一樣多」，不然就有兩個正確答案。 */
        const equalOnes = d.opts.filter(o => o.a === o.b && o.b === o.c);
        if (equalOnes.length !== 1) return 'exactly one option must be an equal split, found ' + equalOnes.length;
        return base(d, 'triple#' + d.q + ',' + d.q + ',' + d.q);
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數與這個設定檔自己的情境表重算，
       完全不呼叫 review.html 的 valStr／qtyGrp —— 拿產生器自己的格式化函式來比
       等於自己比自己（2026-08-25 time 那一課的教訓）。 */
    expectedCorrect: function(d, genId, lang){
      const eq = lang === 'zh' ? ' ＝ ' : ' = ';
      switch (genId){
        case 'packing':    return fGrp(d.si, d.total / d.per, lang);
        case 'unitPick':   return fGrp(d.si, d.total / d.per, lang);
        case 'sharing':    return fItem(d.si, d.total / d.n, lang);
        case 'arrayRow':   return fItem(d.si, d.total / d.r, lang);
        case 'totalCheck': return fItem(d.si, d.per * d.g, lang);
        case 'packEq':     return d.per + ' × □' + eq + d.total;
        case 'shareEq':    return '□ × ' + d.n + eq + d.total;
        case 'meaningOf': {
          const g = d.total / d.per;
          return lang === 'zh' ? ('有 ' + fGrp(d.si, g, 'zh')) : (fGrp(d.si, g, 'en') + ' in total');
        }
        case 'equalCheck': {
          const q = d.total / 3;
          return lang === 'zh' ? (q + '、' + q + '、' + q) : (q + ', ' + q + ', ' + q);
        }
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：形狀（單位種類）要是這個產生器允許的，數字要落在範圍裡，
       英文還要單複數一致。正解與誘答用同一組規則 —— 這一課沒有刻意寫錯的選項。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]/.test(t)) return 'junk option ' + t;
      const allowed = SHAPE[genId];
      if (!allowed) return 'no option shape recorded for ' + genId;
      const hit = allowed.filter(k => SHAPES[lang][k].test(t));
      if (hit.length !== 1) return 'bad option shape for ' + genId + ': ' + t;
      /* 英文的單複數：2 個以上一定要用複數，1 個一定要用單數。
         「4 bag」看起來像小事，但它是「複數規則整條被拿掉」的唯一症狀。 */
      if (lang === 'en'){
        const m = t.match(/(\d+) ([a-z]+)/);
        if (m){
          const n = Number(m[1]), w = m[2];
          if (EN_SING.indexOf(w) >= 0 && n !== 1) return 'plural does not match the number: ' + t;
          if (EN_PLUR.indexOf(w) >= 0 && n === 1) return 'plural does not match the number: ' + t;
        }
      }
      const bounds = RANGE[genId] || [1, 81];
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
    dataReturn: '{SCENES, PACK_EX, SHARE_EX, BOTH_EX, EQ_CASES, ROUNDS, itemsSVG, packSVG, shareSVG}',
    check: function(data, I18N, fail){
      const LANGS = ['zh','en'];

      /* --- 情境表：圖案（資料區）與單位詞（字典）用 si 對齊，兩邊長度一定要一樣 --- */
      if (data.SCENES.length !== 4) fail(`SCENES has ${data.SCENES.length} scenes; this lesson uses 4`);
      data.SCENES.forEach((s, i) => { if (!s.icon) fail(`SCENES[${i}] has no icon`); });
      LANGS.forEach(L => {
        const sc = I18N[L].scenes;
        if (!Array.isArray(sc) || sc.length !== data.SCENES.length){
          fail(`${L} scenes: ${(sc || []).length} entries but SCENES has ${data.SCENES.length}`);
          return;
        }
        sc.forEach((s, i) => {
          const t = SCENE_TRUTH[i] || { zh:{}, en:{} };
          /* 只驗「有沒有填」擋不住錯字：顆 → 棵、bag → sack 都會照樣通過，
             而後面每一條渲染檢查用的又是同一本字典 —— 等於自己比自己。
             所以每一個欄位都要跟設定檔的真值逐字比對。 */
          if (L === 'zh'){
            ['thing','item','grp'].forEach(k => {
              if (!s[k]) fail(`zh scenes[${i}] is missing ${k}`);
              else if (s[k] !== t.zh[k]) fail(`zh scenes[${i}].${k} is "${s[k]}", the checker expects "${t.zh[k]}"`);
            });
            /* 單位詞一樣的話，「4 包」和「4 顆」在畫面上就變成同一個字串 ——
               這一課刻意用「同一個數字、不同單位」當誘答，那時會出現兩個一樣的選項。 */
            if (s.item === s.grp) fail(`zh scenes[${i}]: the item unit and the group unit must differ (${s.item})`);
          } else {
            ['item','itemN','grp','grpN'].forEach(k => {
              if (!s[k]) fail(`en scenes[${i}] is missing ${k}`);
              else if (s[k] !== t.en[k]) fail(`en scenes[${i}].${k} is "${s[k]}", the checker expects "${t.en[k]}"`);
            });
            if (s.item === s.itemN) fail(`en scenes[${i}]: singular and plural must differ (${s.item})`);
            if (s.grp === s.grpN) fail(`en scenes[${i}]: singular and plural must differ (${s.grp})`);
            if (s.item === s.grp) fail(`en scenes[${i}]: the item unit and the group unit must differ (${s.item})`);
          }
        });
      });
      const sceneCount = data.SCENES.length;
      const siOk = (si, where) => {
        if (!Number.isInteger(si) || si < 0 || si >= sceneCount){
          fail(`${where}: scene index ${si} is outside 0~${sceneCount - 1}`);
        }
      };

      /* --- 範例 1：分裝。每份幾個是已知，份數是答案 --- */
      /* 每一個數量都必須是整數。只驗範圍與整除的話，total 12.5 / per 2.5 會整除、
         會落在範圍裡、字串也對得上 —— 一堂全整數的二年級課就這樣端出小數。 */
      const wholeOk = (where, obj, keys) => keys.forEach(k => {
        if (!Number.isInteger(obj[k])) fail(`${where}.${k} must be a whole number, got ${obj[k]}`);
      });
      const P = data.PACK_EX;
      siOk(P.si, 'PACK_EX');
      wholeOk('PACK_EX', P, ['total','per']);
      if (P.total % P.per !== 0) fail(`PACK_EX total is not a whole number of groups (${P.total} / ${P.per})`);
      const pg = P.total / P.per;
      if (!(P.per >= 2 && P.per <= 9)) fail(`PACK_EX per must be 2~9, got ${P.per}`);
      if (!(pg >= 2 && pg <= 6)) fail(`PACK_EX would need ${pg} bags; the picture holds 2~6`);
      LANGS.forEach(L => {
        const d = I18N[L];
        const start = d.p1Start(P), step = d.p1Step(P, 1, P.total - P.per), end = d.p1End(P, pg);
        [start, step, end].forEach(s => { if (/undefined|NaN/.test(s)) fail(`p1 ${L}: ${s}`); });
        if (start.indexOf(String(P.per)) < 0) fail(`p1Start ${L} never says how many go in each group`);
        if (step.indexOf(String(P.total - P.per)) < 0) fail(`p1Step ${L} never says how many are left`);
        if (end.indexOf(String(pg)) < 0) fail(`p1End ${L} never states the answer ${pg}`);
        /* 「有沒有印出總數」擋不住「算式整段被刪掉」—— 開頭的「12 顆糖果」裡本來就有 12。
           要驗的是算式的結果那一段（「＝ 12」／「= 12」）。 */
        const eqTail = (L === 'zh' ? ' ＝ ' : ' = ') + P.total;
        if (end.indexOf(eqTail) < 0) fail(`p1End ${L} never shows the full number sentence ending in "${eqTail}"`);
      });

      /* --- 圖的寬度：一開始（0 袋／0 輪）幾乎所有東西都還散在下面，
         只按袋子／盤子算寬度的話那一排會被整段切掉，孩子數到的總數就是錯的。
         這裡讀 SVG 真正吐出來的座標，不看樣式。 --- */
      /* 圖畫不畫得下 —— 實作在 tools/checks/lib/canvas.js（全站唯一一份）。
         ⚠️ 2026-09-02 之前這裡只驗**寬度**（當初那個事故是寬度的問題），
         所以一個 height="1" 的畫布可以通過所有幾何斷言（issue #2）。
         共用版本四個邊都驗，而且讀不到幾何、或碰到讀不懂的標籤都會回報 ——
         讀不到是「沒檢查」，不是「通過」。 */
      const widthOk = (label, svg) => {
        canvasProblems(svg).forEach(m => fail(`${label}: ${m}`));
      };
      /* 每一個孩子按得到的畫面都要驗，不只頭尾 —— 中間那幾格被切掉一樣是缺陷。 */
      for (let b = 0; b <= pg; b++) widthOk(`packSVG(${b} bags)`, data.packSVG(P.total, P.per, b, '🍬'));
      widthOk('itemsSVG', data.itemsSVG(P.total, '🍬'));

      /* --- 範例 2：平分。份數是已知，每份幾個是答案 --- */
      const S = data.SHARE_EX;
      siOk(S.si, 'SHARE_EX');
      wholeOk('SHARE_EX', S, ['total','n']);
      if (S.total % S.n !== 0) fail(`SHARE_EX total is not a whole number of shares (${S.total} / ${S.n})`);
      const sq = S.total / S.n;
      if (!(S.n >= 2 && S.n <= 4)) fail(`SHARE_EX draws 2~4 plates, got ${S.n}`);
      if (!(sq >= 2 && sq <= 9)) fail(`SHARE_EX gives ${sq} per plate; keep it 2~9`);
      LANGS.forEach(L => {
        const d = I18N[L];
        const start = d.p2Start(S), step = d.p2Step(S, 1, S.total - S.n), end = d.p2End(S, sq);
        [start, step, end].forEach(s => { if (/undefined|NaN/.test(s)) fail(`p2 ${L}: ${s}`); });
        if (start.indexOf(String(S.n)) < 0) fail(`p2Start ${L} never says how many children there are`);
        if (step.indexOf(String(S.total - S.n)) < 0) fail(`p2Step ${L} never says how many are left`);
        const unit = L === 'zh' ? I18N.zh.scenes[S.si].item : I18N.en.scenes[S.si].itemN;
        if (end.indexOf(sq + ' ' + unit) < 0) fail(`p2End ${L} never states the answer with its unit (${sq} ${unit})`);
      });

      for (let rd = 0; rd <= sq; rd++) widthOk(`shareSVG(${rd} rounds)`, data.shareSVG(S.total, S.n, rd, '🍎'));

      /* --- 範例 3：同一組數字、兩種問法。兩邊都要整除，答案的單位不一樣 --- */
      const B = data.BOTH_EX;
      siOk(B.si, 'BOTH_EX');
      wholeOk('BOTH_EX', B, ['total','k']);
      if (B.total % B.k !== 0) fail(`BOTH_EX total is not a whole number of groups (${B.total} / ${B.k})`);
      const bans = B.total / B.k;
      LANGS.forEach(L => {
        const d = I18N[L];
        ['pack','share'].forEach(kind => {
          const chip = d.bothChip(B, kind), b1 = d.b1(B, kind), b2 = d.b2(B, kind, bans), b3 = d.b3(B, kind, bans);
          [chip, b1, b2, b3].forEach(s => { if (/undefined|NaN/.test(s)) fail(`both ${L}/${kind}: ${s}`); });
          if (kind === 'pack' && b2.indexOf(String(B.total)) < 0){
            fail(`b2 ${L}/pack never counts up to the total ${B.total}`);
          }
          const unit = kind === 'pack'
            ? (L === 'zh' ? I18N.zh.scenes[B.si].grp : I18N.en.scenes[B.si].grpN)
            : (L === 'zh' ? I18N.zh.scenes[B.si].item : I18N.en.scenes[B.si].itemN);
          if (b3.indexOf(bans + ' ' + unit) < 0){
            fail(`b3 ${L}/${kind} never states the answer with its unit (${bans} ${unit})`);
          }
          /* 這一段的重點就是「數字一樣、單位不一樣」，所以結語一定要提到那個數字兩次以上。 */
          if (b3.split(String(bans)).length - 1 < 2) fail(`b3 ${L}/${kind} should point out that the number is the same`);
        });
        if (d.b0(B).indexOf(String(B.k)) < 0) fail(`b0 ${L} never mentions the shared number ${B.k}`);
      });

      /* --- 範例 4：用乘法算式找答案 --- */
      let sawPack = false, sawShare = false;
      data.EQ_CASES.forEach((c, i) => {
        siOk(c.si, `EQ_CASES[${i}]`);
        wholeOk(`EQ_CASES[${i}]`, c, ['total','k']);
        if (c.kind !== 'pack' && c.kind !== 'share') fail(`EQ_CASES[${i}] has an unknown kind ${c.kind}`);
        if (c.kind === 'pack') sawPack = true; else sawShare = true;
        if (c.total % c.k !== 0) fail(`EQ_CASES[${i}] total is not a whole number of parts (${c.total} / ${c.k})`);
        const ans = c.total / c.k;
        if (!(ans >= 2 && ans <= 9)) fail(`EQ_CASES[${i}] answer ${ans} should be inside the times tables (2~9)`);
        if (!(c.k >= 2 && c.k <= 9)) fail(`EQ_CASES[${i}] k must be 2~9, got ${c.k}`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const chip = d.eqChip(c), e1 = d.e1(c), e2 = d.e2(c), e3 = d.e3(c, ans), e4 = d.e4(c, ans);
          [chip, e1, e2, e3, e4].forEach(s => { if (/undefined|NaN/.test(s)) fail(`EQ_CASES[${i}] ${L}: ${s}`); });
          if (e2.indexOf('□') < 0) fail(`EQ_CASES[${i}] ${L}: e2 never shows the empty box`);
          if (e2.indexOf(String(c.total)) < 0) fail(`EQ_CASES[${i}] ${L}: e2 never prints the total`);
          if (e3.indexOf(String(ans)) < 0) fail(`EQ_CASES[${i}] ${L}: e3 never says what the box is`);
          const unit = c.kind === 'pack'
            ? (L === 'zh' ? I18N.zh.scenes[c.si].grp : I18N.en.scenes[c.si].grpN)
            : (L === 'zh' ? I18N.zh.scenes[c.si].item : I18N.en.scenes[c.si].itemN);
          if (e4.indexOf(ans + ' ' + unit) < 0){
            fail(`EQ_CASES[${i}] ${L}: e4 never states the answer with its unit (${ans} ${unit})`);
          }
        });
      });
      if (!sawPack) fail('EQ_CASES needs a packing case');
      if (!sawShare) fail('EQ_CASES needs an equal-sharing case');

      /* --- 遊戲關卡 --- */
      let gPack = false, gShare = false;
      data.ROUNDS.forEach((r, idx) => {
        const i = idx + 1;
        siOk(r.si, `ROUND ${i}`);
        wholeOk(`ROUND ${i}`, r, ['total','k']);
        if (r.kind !== 'pack' && r.kind !== 'share') fail(`ROUND ${i} has an unknown kind ${r.kind}`);
        if (r.kind === 'pack') gPack = true; else gShare = true;
        if (r.total % r.k !== 0) fail(`ROUND ${i}: total ${r.total} does not divide by ${r.k}`);
        const ans = r.total / r.k;
        if (r.opts.length !== 3) fail(`ROUND ${i} should offer 3 options, has ${r.opts.length}`);
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i} has duplicate options`);
        if (!Number.isInteger(r.ans) || r.ans < 0 || r.ans >= r.opts.length){
          fail(`ROUND ${i}: ans ${r.ans} is not a valid option index`);
          return;
        }
        if (r.opts[r.ans] !== ans) fail(`ROUND ${i}: opts[ans] does not equal total/k (${r.opts[r.ans]} vs ${ans})`);
        /* 一關裡最合理的誘答上限是「把總數當答案」，給一個固定的 30 等於沒有上限。 */
        r.opts.forEach(o => {
          if (!(o >= 1 && o <= r.total)) fail(`ROUND ${i}: option ${o} is outside 1~${r.total}`);
        });
        /* 誘答一定要包含「把題目給的另一個數字抄回來」那一個 —— 這一課的核心迷思。 */
        if (r.opts.indexOf(r.k) < 0) fail(`ROUND ${i} should offer ${r.k} as the slot-confusion distractor`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const ask = d.gAsk(r), opt = d.gOpt(r, ans), h1 = d.gHint1(r), h2 = d.gHint2(r), why = d.gWhy(r, ans);
          [ask, opt, h1, h2, why].forEach(s => { if (/undefined|NaN/.test(s)) fail(`ROUND ${i} ${L}: ${s}`); });
          if (ask.indexOf(String(r.total)) < 0) fail(`ROUND ${i} ${L}: gAsk never prints the total`);
          if (ask.indexOf(String(r.k)) < 0) fail(`ROUND ${i} ${L}: gAsk never prints the given number`);
          if (h2.indexOf(String(r.total)) < 0) fail(`ROUND ${i} ${L}: gHint2 never mentions the total`);
          if (h2.indexOf(String(r.k)) < 0) fail(`ROUND ${i} ${L}: gHint2 never mentions the given number`);
          if (why.indexOf(opt) < 0) fail(`ROUND ${i} ${L}: gWhy never states the answer "${opt}"`);
          /* 單位要跟著問法走：問幾份就用份的單位，問每份幾個就用個的單位。 */
          const grpW = L === 'zh' ? I18N.zh.scenes[r.si].grp : I18N.en.scenes[r.si].grpN;
          const itemW = L === 'zh' ? I18N.zh.scenes[r.si].item : I18N.en.scenes[r.si].itemN;
          const want = r.kind === 'pack' ? (ans + ' ' + grpW) : (ans + ' ' + itemW);
          if (opt !== want) fail(`ROUND ${i} ${L}: the option label is "${opt}", the checker expects "${want}"`);
        });
      });
      if (!gPack) fail('ROUNDS needs at least one packing round');
      if (!gShare) fail('ROUNDS needs at least one equal-sharing round');
      if (data.ROUNDS.map(r => r.ans).every(x => x === 0)) fail('every game round has the answer first');

      /* --- 三層題庫的神諭表 ---
         每一題記三件事，而且都跟題目本身分開維護：
         - nums：題幹裡「一定要出現」的數字（中英都驗）。少了這一條，把題幹的
           12 改成 13、答案還留著「4 包」，每一條檢查都會是綠的。
         - rel：從 nums 把答案「算出來」的方式，不是抄答案。
         - optRe：這一題四個選項各自該長什麼樣。只驗正解的話，把某個誘答換成
           「banana」也不會有人發現。 */
      const BANK_EXPECTED = {
        qs: [
          { nums:[12,3], rel:'groups', zh:'4 包',  en:'4 bags',
            optRe:{ zh:/^\d+ 包$/, en:/^\d+ bags?$/ } },
          { nums:[12,3], rel:'per',    zh:'4 個',  en:'4 apples',
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ apples?$/ } },
          { nums:[5,4],  rel:'total',  zh:'20 片', en:'20 biscuits',
            optRe:{ zh:/^\d+ 片$/, en:/^\d+ biscuits?$/ } },
          /* 這一題刻意混單位（同一個數字、錯的單位），所以兩種形狀都放行。 */
          { nums:[20,5], rel:'groups', zh:'4 包',  en:'4 bags',
            optRe:{ zh:/^\d+ (?:包|顆)$/, en:/^\d+ (?:bags?|sweets?)$/ } },
          { nums:[18,6], rel:'eq',     zh:'6 × □ ＝ 18', en:'6 × □ = 18',
            optRe:{ zh:/^(?:\d+ (?:×|＋|－) □ ＝ \d+|\d+ × \d+ ＝ □)$/,
                    en:/^(?:\d+ (?:×|\+|−) □ = \d+|\d+ × \d+ = □)$/ } },
          { nums:[15,3], rel:'triple', zh:'5、5、5', en:'5, 5, 5',
            optRe:{ zh:/^\d+、\d+、\d+$/, en:/^\d+, \d+, \d+$/ } }
        ],
        qsAdv: [
          { nums:[24,4], rel:'groups', zh:'6 包', en:'6 bags',
            optRe:{ zh:/^\d+ 包$/, en:/^\d+ bags?$/ } },
          { nums:[30,5], rel:'per',    zh:'6 個', en:'6 apples',
            optRe:{ zh:/^\d+ 個$/, en:/^\d+ apples?$/ } },
          { nums:[12,2,6], rel:'twostep', zh:'4 片', en:'4 biscuits',
            optRe:{ zh:/^\d+ 片$/, en:/^\d+ biscuits?$/ } },
          { nums:[28,7], rel:'phrase', zh:'一共有 4 盒', en:'4 boxes in total',
            optRe:{ zh:/^(?:每盒 \d+ 枝|一共有 \d+ 盒)$/,
                    en:/^(?:\d+ pencils? in each box|\d+ boxes? in total)$/ } }
        ],
        qsBoost: [
          { nums:[20,4], rel:'groups', zh:'5 包', en:'5 bags',
            optRe:{ zh:/^\d+ 包$/, en:/^\d+ bags?$/ } },
          { nums:[18,3,6], rel:'meaning', zh:'有 3 個小朋友', en:'there are 3 children',
            optRe:{ zh:/^(?:每人分到 \d+ 片|有 \d+ 個小朋友|一共 \d+ 片|剩下 \d+ 片)$/,
                    en:/^(?:each child gets \d+ biscuits?|there are \d+ children|\d+ biscuits? altogether|\d+ biscuits? left over)$/ } }
        ]
      };
      /* 答案是算出來的，不是抄的。 */
      const ansFor = (rel, n) => {
        if (rel === 'groups' || rel === 'per' || rel === 'phrase' || rel === 'triple') return n[0] / n[1];
        if (rel === 'total') return n[0] * n[1];
        if (rel === 'twostep') return n[0] * n[1] / n[2];
        if (rel === 'meaning') return n[1];
        return NaN;
      };
      const hasNum = (text, n) => new RegExp('(?<![0-9])' + n + '(?![0-9])').test(text);
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        const oracle = BANK_EXPECTED[bank] || [];
        /* 每一種語言各比一次。只比中文的話，刪掉最後一題英文題目時中文長度還是對的，
           而英文那一圈 forEach 會少跑一題 —— 那一題和它的選項就整個沒被驗到。 */
        LANGS.forEach(L => {
          if ((I18N[L][bank] || []).length !== oracle.length){
            fail(`${L} ${bank}: ${(I18N[L][bank] || []).length} questions but ${oracle.length} expected answers recorded`);
          }
        });
        LANGS.forEach(L => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const o = oracle[i];
            if (!o){ fail(`${bank}[${i}]: no expected answer recorded in the checker`); return; }
            /* ans 先驗合法，否則 q.opts[q.ans] 會是 undefined，接下來的檢查
               都在比對 undefined —— 整題沒被驗到卻是綠的。 */
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 1. 題幹的數字集合要「剛剛好」等於神諭記下的那一組。
               只驗「有沒有出現」擋不住「題幹多塞一個 13」——
               12 和 3 還在，答案照樣重算成 4，整題就這樣蒙過去。
               範圍說清楚：這一條只看**阿拉伯數字**。這一課每一個運算元都是
               阿拉伯數字，所以夠用；但如果哪天有人把數量寫成「七個梨子」或
               “seven pears”，這一條抓不到（中文數字沒辦法一律當數量看 ——
               「一共」「一盒」「一樣多」裡的「一」就不是）。 */
            const plain = String(q.stem).replace(/<[^>]+>/g, ' ');
            o.nums.forEach(n => {
              if (!hasNum(plain, n)) fail(`${bank}[${i}] ${L}: the number ${n} never appears in the stem`);
            });
            const stemNums = [...new Set((plain.match(/\d+/g) || []).map(Number))];
            stemNums.forEach(n => {
              if (o.nums.indexOf(n) < 0){
                fail(`${bank}[${i}] ${L}: the stem contains an unexpected number ${n} (the checker knows only ${o.nums.join(' / ')})`);
              }
            });
            /* 2. 標為正解的那一個要等於神諭寫下的字串。 */
            const want = L === 'zh' ? o.zh : o.en;
            if (q.opts[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", the checker expects "${want}"`);
            }
            /* 3. 神諭寫下的字串本身要能從 nums 重算出來。 */
            if (o.rel === 'eq'){
              const eqWant = o.nums[1] + (L === 'zh' ? ' × □ ＝ ' : ' × □ = ') + o.nums[0];
              if (want !== eqWant) fail(`${bank}[${i}] ${L}: the recorded answer "${want}" is not "${eqWant}"`);
            } else if (o.rel === 'triple'){
              const v = ansFor('triple', o.nums);
              const tWant = L === 'zh' ? [v, v, v].join('、') : [v, v, v].join(', ');
              if (want !== tWant) fail(`${bank}[${i}] ${L}: the recorded answer "${want}" is not "${tWant}"`);
            } else {
              const v = ansFor(o.rel, o.nums);
              if (!Number.isInteger(v)){
                fail(`${bank}[${i}]: ${o.nums.join(' / ')} does not give a whole-number answer`);
              } else if (!hasNum(want, v)){
                fail(`${bank}[${i}] ${L}: the recorded answer "${want}" does not contain ${v}, recomputed from ${o.nums.join(' / ')}`);
              }
              if (o.rel === 'meaning' && o.nums[0] / o.nums[1] !== o.nums[2]){
                fail(`${bank}[${i}]: the stem's own numbers are inconsistent (${o.nums.join(' / ')})`);
              }
            }
            /* 4. 每一個選項的形狀與數字範圍 —— 誘答也要驗，不只是正解。 */
            const re = L === 'zh' ? o.optRe.zh : o.optRe.en;
            q.opts.forEach(opt => {
              if (!re.test(opt)){
                fail(`${bank}[${i}] ${L}: option "${opt}" does not look like an answer to this question`);
              }
              (String(opt).match(/\d+/g) || []).map(Number).forEach(x => {
                if (!(x >= 1 && x <= 40)) fail(`${bank}[${i}] ${L}: option "${opt}" contains ${x}, outside 1~40`);
              });
            });
            /* 5. 選項字串兩兩不同（含空白正規化的版本）。 */
            const trimmed = q.opts.map(x => x.replace(/\s+/g, ' ').trim());
            for (let a = 0; a < trimmed.length; a++){
              for (let b = a + 1; b < trimmed.length; b++){
                if (trimmed[a] === trimmed[b]) fail(`${bank}[${i}] ${L}: "${q.opts[a]}" appears twice`);
              }
            }
          });
        });
      });

          /* --- 三層題庫的題幹與解釋：算式逐條驗算（issue #2） ---
             ⚠️ 光是「跑過沒報錯」不算數：一個壞掉的正規化會讓每一條算式都
             靜靜地讀不到，那樣也是零錯誤。所以**驗過幾條要對得上數字** ——
             少掉就表示有宣稱沒被驗到。 */
          {
            let vSum = 0, qSum = 0;
            ['qs','qsAdv','qsBoost'].forEach(bank => {
              ['zh','en'].forEach(L => {
                (I18N[L][bank] || []).forEach((q, i) => {
                  [['stem', q && q.stem], ['why', q && q.why]].forEach(([field, text]) => {
                    if (typeof text !== 'string') return;
                    const r = arithDivide(text);
                    vSum += r.verified; qSum += r.questions;
                    r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
                  });
                });
              });
            });
            if (vSum !== 20) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 20`);
            if (qSum !== 4) fail(`question-shaped equations changed: found ${qSum}, expected 4`);
            /* 宣告過卻沒對上的「刻意寫錯」是一個永遠擋著的洞。 */
            arithDivide.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
            /* ⚠️ 「刻意寫錯」是整課通用的放行。同一條錯式子跑到別的地方去也會
               被一起放行 —— 所以連「放行了幾次」都要釘住。 */
            {
              const want = {};
              const got = arithDivide.excuseCounts();
              Object.keys(want).forEach(k => {
                if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
              });
            }
            /* ⚠️ 只釘「驗過幾條」擋不住「拿掉一條、再補一條」：數字一樣，
               驗的卻是別的宣稱。所以把**驗過的每一條算式本身**排序後做指紋。 */
            {
              const list = arithDivide.verifiedAll();
              const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
              if (digest !== 'a3c2f6a74ecf'){
                fail(`the set of verified equations changed (digest ${digest}, expected a3c2f6a74ecf)\n      now: ${list.join(' | ')}`);
              }
            }
          }

    }
  }
};
