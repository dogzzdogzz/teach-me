/* grade-2/math/capacity-weight（容量與重量：直接比較與間接比較）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課**不使用任何標準單位**（那是三年級的內容），量出來的東西
   一律是「幾杯」「幾個積木」。所以這份設定檔盯的是三件別處盯不到的事：

   1. **課程教的規則有沒有寫死條件**。「杯數多的容量比較大」只有在
      「同一個杯子」時才成立；「沉下去的那一邊比較重」只有在
      「兩邊各放一個」時才等於「那個東西比較重」。資料只要生出違反前提的組合，
      規則就變成假的 —— diffCup 的「大杯杯數必須比小杯少」就是這一條的化身。
   2. **圖和答案不可以打架**。容器的容量是從畫出來的寬高算出來的
      （cap ＝ w × h ÷ 600），所以「花瓶最高卻不是最多」在畫面上是真的，
      不是嘴巴說說。這裡逐一驗算。
   3. **名稱表要逐字比對**。渲染出來的每一句話都用同一本字典，
      只驗「有沒有填」等於拿字典比字典 —— 所以下面有一份獨立的真值表。 */

/* ---------- 設定檔自己的真值表（和課程檔對齊，但是獨立寫的一份） ---------- */
const AREA_PER_CUP = 600;
const CONTAINER_TRUTH = [
  { icon:'🫖', w:60,  h:80,  cap:8, zh:'水壺',   en:'kettle' },
  { icon:'🏺', w:30,  h:100, cap:5, zh:'花瓶',   en:'vase'   },
  { icon:'🥛', w:40,  h:60,  cap:4, zh:'玻璃杯', en:'glass'  },
  { icon:'🥣', w:100, h:36,  cap:6, zh:'碗',     en:'bowl'   },
  { icon:'🪣', w:90,  h:60,  cap:9, zh:'水桶',   en:'bucket' },
  { icon:'🍶', w:50,  h:60,  cap:5, zh:'瓶子',   en:'bottle' }
];
const ITEM_TRUTH = [
  { icon:'🍓', wt:2,  size:1, zh:'草莓',   en:'strawberry' },
  { icon:'🎈', wt:1,  size:5, zh:'氣球',   en:'balloon'    },
  { icon:'🍎', wt:4,  size:2, zh:'蘋果',   en:'apple'      },
  { icon:'🍊', wt:4,  size:2, zh:'橘子',   en:'orange'     },
  { icon:'🥔', wt:5,  size:2, zh:'馬鈴薯', en:'potato'     },
  { icon:'🧸', wt:6,  size:4, zh:'玩具熊', en:'teddy bear' },
  { icon:'🪨', wt:9,  size:1, zh:'石頭',   en:'stone'      },
  { icon:'🍉', wt:14, size:5, zh:'西瓜',   en:'watermelon' }
];
const BOX_TRUTH = [
  { icon:'🟥', wt:8, zh:'紅箱', en:'red box'    },
  { icon:'🟦', wt:5, zh:'藍箱', en:'blue box'   },
  { icon:'🟨', wt:3, zh:'黃箱', en:'yellow box' },
  { icon:'🟩', wt:6, zh:'綠箱', en:'green box'  }
];
/* 沒有名字的兩個瓶子：只在「杯子不一樣大」那一題出現，別處不會提到它們的杯數。 */
const UNKNOWN_TRUTH = [
  { icon:'🫙', zh:'甲瓶', en:'jar A' },
  { icon:'🍯', zh:'乙瓶', en:'jar B' }
];
/* 速查卡「什麼時候不能只看數字」那兩格的完整句子。只驗有沒有出現「一樣重」
   這種關鍵詞是擋不住極性的 —— 「積木不需要一樣重」也含有那三個字。 */
const REF_RULE = {
  r1c:{ zh:'<strong>每個都一樣重</strong>的積木', en:'blocks that <strong>all weigh the same</strong>' },
  r5b:{ zh:'兩邊用的<strong>不是同一個</strong>杯子', en:'the two sides did not use <strong>the same</strong> cup' },
  r5c:{ zh:'兩邊的積木<strong>不一樣重</strong>（一樣大也可能不一樣重）',
        en:'the blocks were <strong>not all the same weight</strong> (same size can still mean different weight)' }
};
const METHOD_TRUTH = {
  zh:[
    '用同一個小杯子分別裝滿，數各是幾杯',
    '看哪一個比較高',
    '一個用大杯、一個用小杯，比杯數',
    '看哪一個比較重',
    '放上天平：沉下去的那一邊比較重，平平的就一樣重',
    '看哪一個比較大',
    '一邊放大積木、一邊放小積木，比個數'
  ],
  en:[
    'fill both with the same small cup and count the cups',
    'look at which one is taller',
    'use a big cup for one and a small cup for the other, then compare the counts',
    'look at which one is heavier',
    'put one on each side of a balance: the lower side is heavier, and a level balance means they weigh the same',
    'look at which one is bigger',
    'put big blocks on one side and small blocks on the other, then compare the counts'
  ]
};

const fCName = (i, lang) => CONTAINER_TRUTH[i].icon + (lang === 'zh' ? ' ' : ' the ') + CONTAINER_TRUTH[i][lang];
const fIName = (i, lang) => ITEM_TRUTH[i].icon + (lang === 'zh' ? ' ' : ' the ') + ITEM_TRUTH[i][lang];
const fBName = (i, lang) => BOX_TRUTH[i].icon + (lang === 'zh' ? ' ' : ' the ') + BOX_TRUTH[i][lang];
const fUName = (i, lang) => UNKNOWN_TRUTH[i].icon + ' ' + UNKNOWN_TRUTH[i][lang];
const fName = (cat, i, lang) =>
  cat === 'C' ? fCName(i, lang) : cat === 'I' ? fIName(i, lang) : cat === 'U' ? fUName(i, lang) : fBName(i, lang);
const fCup = (n, lang) => lang === 'zh' ? (n + ' 杯') : (n + (n === 1 ? ' cup' : ' cups'));
const fBlk = (n, lang) => lang === 'zh' ? (n + ' 個') : (n + (n === 1 ? ' block' : ' blocks'));
const fPick = (cat, id, lang) => cat === 'I'
  ? (fIName(id, lang) + (lang === 'zh' ? '比較重' : ' is heavier'))
  : (fName(cat, id, lang) + (lang === 'zh' ? '裝得比較多' : ' holds more'));
const fSame = (dom, lang) => lang === 'zh'
  ? (dom === 'cap' ? '兩個一樣多' : '兩個一樣重')
  : (dom === 'cap' ? 'they hold the same' : 'they weigh the same');
const fNo = (dom, lang) => lang === 'zh' ? (dom === 'cap' ? '沒辦法比' : '沒辦法知道') : 'there is no way to tell';
const fRel = (a, b, lang) => lang === 'zh'
  ? (fBName(a, 'zh') + '比 ' + fBName(b, 'zh') + '重')
  : (fBName(a, 'en') + ' is heavier than ' + fBName(b, 'en'));
const fOrd = (cat, ids, lang) => ids.map(id => fName(cat, id, lang)).join(' → ');
/* 線索句子的第二套實作。只驗「有沒有提到第二個東西的名字」的話，
   把「紅箱比藍箱重」寫反成「藍箱比紅箱重」照樣過 —— 孩子照著畫面上的線索
   推理反而會選到錯的選項。所以整句連方向一起逐字比對。 */
const fClueW = (a, b, lang) => lang === 'zh'
  ? (fBName(a, 'zh') + '比 ' + fBName(b, 'zh') + '重')
  : (fBName(a, 'en') + ' is heavier than ' + fBName(b, 'en'));
const fClueC = (a, b, lang) => lang === 'zh'
  ? (fCName(a, 'zh') + '裝滿倒進 ' + fCName(b, 'zh') + '，水滿出來了')
  : ('pouring the full ' + CONTAINER_TRUTH[a].en + ' into ' + fCName(b, 'en') + ' makes the water spill over');

/* 選項物件的去重鍵。這一課最容易搞混的是單位，所以鍵一定要含「種類」——
   只比數字的話，「5 杯」和「5 個積木」會被當成同一個答案。 */
function keyOf(v){
  if (!v || typeof v !== 'object') return 'bad';
  if (v.u === 'pick') return 'pick#' + v.cat + '#' + v.id;
  if (v.u === 'same') return 'same#' + v.dom;
  if (v.u === 'no')   return 'no#' + v.dom;
  if (v.u === 'num')  return 'num#' + v.unit + '#' + v.n;
  if (v.u === 'rel')  return 'rel#' + v.a + '#' + v.b;
  if (v.u === 'ord')  return 'ord#' + v.cat + '#' + (v.ids || []).join(',');
  if (v.u === 'mt')   return 'mt#' + v.id;
  return 'bad';
}
function distinctOpts(d){
  if (!Array.isArray(d.opts) || d.opts.length !== 4) return 'option count is ' + (d.opts || []).length;
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
  if (!Number.isInteger(d.ans) || d.ans < 0 || d.ans >= d.opts.length) return 'ans ' + d.ans + ' is not a valid option index';
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (keyOf(d.correct) !== want) return 'correct is ' + keyOf(d.correct) + ', expected ' + want;
  return null;
}
/* 選項的集合要「剛剛好」等於這一題該有的那四個。少了這一條，把一個誘答換成
   別題的選項（糖果題冒出「5 籃」的同類問題）形狀還是對的，卻不屬於這一題。 */
function optSetIs(d, wantKeys){
  const got = d.opts.map(keyOf).slice().sort();
  const want = wantKeys.slice().sort();
  if (got.join('|') !== want.join('|')){
    return 'the option set is ' + got.join(' , ') + ' but this question needs ' + want.join(' , ');
  }
  return null;
}
function idxOk(v, len, label){
  if (!Number.isInteger(v) || v < 0 || v >= len) return label + ' index ' + v + ' is outside 0~' + (len - 1);
  return null;
}
/* 容器的容量必須就是畫出來的面積換算的杯數 —— 圖和答案不可以是兩套數字。 */
function capOk(i){
  const c = CONTAINER_TRUTH[i];
  if (c.w * c.h / AREA_PER_CUP !== c.cap) return 'container ' + i + ' cap ' + c.cap + ' does not match its drawn size';
  return null;
}

/* 選項字串的合法集合。有限而且列得完，所以用「是不是集合裡的一員」來驗，
   比正規式嚴格得多 —— 打錯一個字就會被抓到。 */
function legalPicks(cat, lang){
  const len = cat === 'C' ? CONTAINER_TRUTH.length : cat === 'I' ? ITEM_TRUTH.length : UNKNOWN_TRUTH.length;
  const out = [];
  for (let i = 0; i < len; i++) out.push(fPick(cat, i, lang));
  return out;
}
function legalRels(lang){
  const out = [];
  for (let a = 0; a < BOX_TRUTH.length; a++){
    for (let b = 0; b < BOX_TRUTH.length; b++){ if (a !== b) out.push(fRel(a, b, lang)); }
  }
  return out;
}
/* 每個產生器的選項只能長成這幾種樣子。 */
const SHAPE = {
  pourCompare:  ['pickC','sameCap','noCap'],
  balanceTilt:  ['pickI','sameW','noW'],
  sameCup:      ['pickC','sameCap','noCap'],
  diffCup:      ['pickU','sameCap','noCap'],
  blockWeigh:   ['pickI','sameW','noW'],
  cupDiff:      ['numCup'],
  blockDiff:    ['numBlk'],
  transitive:   ['rel','sameW','noW'],
  orderThree:   ['ordC','ordI'],
  howToCompare: ['mt']
};
/* 數字選項的範圍就是「這一課真的看得到的量」：杯數最多 9（容器杯數 4~9），
   積木最多 14（東西的積木數 1~14）。以前放寬到 17／23 是為了容納「兩個相加」
   的誘答，但那個數在這一課根本不存在 —— 誘答要換成範圍內的，不是把範圍放大。 */
const MAX_CUP = 9, MAX_BLK = 14;
const NUM_RANGE = { numCup:[1, MAX_CUP], numBlk:[1, MAX_BLK] };

function shapeMatch(kind, s, lang){
  if (kind === 'pickC') return legalPicks('C', lang).indexOf(s) >= 0;
  if (kind === 'pickI') return legalPicks('I', lang).indexOf(s) >= 0;
  if (kind === 'pickU') return legalPicks('U', lang).indexOf(s) >= 0;
  if (kind === 'sameCap') return s === fSame('cap', lang);
  if (kind === 'sameW') return s === fSame('w', lang);
  if (kind === 'noCap') return s === fNo('cap', lang);
  if (kind === 'noW') return s === fNo('w', lang);
  if (kind === 'rel') return legalRels(lang).indexOf(s) >= 0;
  if (kind === 'mt') return METHOD_TRUTH[lang].indexOf(s) >= 0;
  if (kind === 'numCup') return s === fCup(Number((s.match(/^\d+/) || ['x'])[0]), lang);
  if (kind === 'numBlk') return s === fBlk(Number((s.match(/^\d+/) || ['x'])[0]), lang);
  if (kind === 'ordC' || kind === 'ordI'){
    const cat = kind === 'ordC' ? 'C' : 'I';
    const len = cat === 'C' ? CONTAINER_TRUTH.length : ITEM_TRUTH.length;
    const parts = s.split(' → ');
    if (parts.length !== 3) return false;
    const all = [];
    for (let i = 0; i < len; i++) all.push(fName(cat, i, lang));
    if (parts.some(p => all.indexOf(p) < 0)) return false;
    return new Set(parts).size === 3;
  }
  return false;
}

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/capacity-weight */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] is not the correct value object',
      find:'    var opts = shuffle([correct].concat(others));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(others));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    /* mix4 這條路（cupDiff／blockDiff）的誘答本來就兩兩不同，所以「拿掉去重」
       什麼事都不會發生 —— 要證明守門的是 distinctOpts，就直接塞一個重複進去。 */
    { file:'review', expect:'two options are the same answer',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out.slice(0, 2)).concat([out[0]]));\n    return { opts:opts, ans:opts.indexOf(correct) };' },
    { file:'review', expect:'option count',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out.slice(0, 2)));\n    return { opts:opts, ans:opts.indexOf(correct) };' },
    /* fixed4 那條路（另外八個產生器）也要有自己的證明。 */
    { file:'review', expect:'two options are the same answer',
      find:'    var opts = shuffle([correct].concat(others));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct, correct].concat(others.slice(0, 2)));\n    return { opts:opts, ans:opts.indexOf(correct) };' },
    /* 候選被清空時，保底補上來的都是「正解附近的數」——
       cupDiff／blockDiff 一定要留著「答成題目給的那個數」那個誘答，不然迷思沒了。 */
    { file:'review', expect:'needs the',
      find:'    (cands || []).forEach(function(v){',
      replace:'    [].forEach(function(v){' },
    /* 去重鍵如果認不出「是哪一個容器／東西」，判斷題的誘答清單會被整組濾掉，
       選項只剩三個。（ord／rel／mt 那幾個分支走的是 fixed4，選項清單是逐一列出來的，
       由設定檔自己的 keyOf ＋ optSetIs 把關，不經過 vkeyOf。） */
    { file:'review', expect:'option count',
      find:"    if (v.u === 'pick') return 'pick#' + v.cat + '#' + v.id;",
      replace:"    if (v.u === 'pick') return 'pick';" },

    /* --- review.html：格式化寫錯（證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"  function nCup(n, lang){ return lang === 'zh' ? (n + ' 杯') : (n + (n === 1 ? ' cup' : ' cups')); }",
      replace:"  function nCup(n, lang){ return lang === 'zh' ? (n + ' 個') : (n + (n === 1 ? ' cup' : ' cups')); }" },
    { file:'review', expect:'bad option shape',
      find:"  function nBlk(n, lang){ return lang === 'zh' ? (n + ' 個') : (n + (n === 1 ? ' block' : ' blocks')); }",
      replace:"  function nBlk(n, lang){ return lang === 'zh' ? (n + ' 個') : (n + ' blocks'); }" },
    { file:'review', expect:'opts[ans] != correct',
      find:"        ? (iName(v.id, lang) + (lang === 'zh' ? '比較重' : ' is heavier'))",
      replace:"        ? (iName(v.id, lang) + (lang === 'zh' ? '比較輕' : ' is heavier'))" },
    { file:'review', expect:'opts[ans] != correct',
      find:"      if (lang === 'zh') return v.dom === 'cap' ? '兩個一樣多' : '兩個一樣重';",
      replace:"      if (lang === 'zh') return v.dom === 'cap' ? '兩個一樣重' : '兩個一樣重';" },
    { file:'review', expect:'opts[ans] != correct',
      find:"        ? (bName(v.a, 'zh') + '比 ' + bName(v.b, 'zh') + '重')",
      replace:"        ? (bName(v.b, 'zh') + '比 ' + bName(v.a, 'zh') + '重')" },
    { file:'review', expect:'opts[ans] != correct',
      find:"      return v.ids.map(function(id){ return nameOf(v.cat, id, lang); }).join(' → ');",
      replace:"      return v.ids.slice().reverse().map(function(id){ return nameOf(v.cat, id, lang); }).join(' → ');" },
    /* 名稱表打錯字（水壺 → 水壼）：後面每一句話用的都是同一本字典，
       只有逐字比對真值表才抓得到。 */
    { file:'review', expect:'bad option shape',
      find:"    { icon:'🫖', w:60,  h:80,  cap:8, zh:'水壺',   en:'kettle' },",
      replace:"    { icon:'🫖', w:60,  h:80,  cap:8, zh:'水壼',   en:'kettle' }," },
    { file:'review', expect:'bad option shape',
      find:"    { icon:'🪨', wt:9,  size:1, zh:'石頭',     en:'stone'      },",
      replace:"    { icon:'🪨', wt:9,  size:1, zh:'石頭',     en:'rock'       }," },

    /* --- review.html：課程規則本身被改壞 --- */
    /* 選項必須屬於「這一題自己的兩個容器」。少了這一條，倒水題會冒出一個
       題幹根本沒提到的容器 —— 形狀對、去重也過，孩子卻看到不相干的答案。 */
    { file:'review', expect:'but this question needs',
      find:"        var pool = [VP('C', a), VP('C', b), VS('cap'), VN('cap')]\n          .filter(function(v){ return vkeyOf(v) !== vkeyOf(correct); });\n        var mix = fixed4(correct, pool);\n        return { a:a, b:b, correct:correct, opts:mix.opts, ans:mix.ans };",
      replace:"        var pool = [VP('C', a), VP('C', (b + 1) % CONTAINERS.length), VS('cap'), VN('cap')]\n          .filter(function(v){ return vkeyOf(v) !== vkeyOf(correct); });\n        var mix = fixed4(correct, pool);\n        return { a:a, b:b, correct:correct, opts:mix.opts, ans:mix.ans };" },
    /* 「沉下去的比較重」講反了。 */
    { file:'review', expect:'correct is',
      find:'        var correct = wa > wb ? VP(\'I\', a) : (wa < wb ? VP(\'I\', b) : VS(\'w\'));\n        var pool = [VP(\'I\', a), VP(\'I\', b), VS(\'w\'), VN(\'w\')]\n          .filter(function(v){ return vkeyOf(v) !== vkeyOf(correct); });\n        var mix = fixed4(correct, pool);\n        return { a:a, b:b, correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'        var correct = wa > wb ? VP(\'I\', b) : (wa < wb ? VP(\'I\', a) : VS(\'w\'));\n        var pool = [VP(\'I\', a), VP(\'I\', b), VS(\'w\'), VN(\'w\')]\n          .filter(function(v){ return vkeyOf(v) !== vkeyOf(correct); });\n        var mix = fixed4(correct, pool);\n        return { a:a, b:b, correct:correct, opts:mix.opts, ans:mix.ans };' },
    /* 「倒出來滿出來的比較多」講反了。 */
    { file:'review', expect:'correct is',
      find:"        var correct = ca > cb ? VP('C', a) : (ca < cb ? VP('C', b) : VS('cap'));",
      replace:"        var correct = ca > cb ? VP('C', b) : (ca < cb ? VP('C', a) : VS('cap'));" },
    /* 「同一個杯子，杯數多的比較多」講反了。 */
    { file:'review', expect:'correct is',
      find:"        var correct = na > nb ? VP('C', a) : (na < nb ? VP('C', b) : VS('cap'));",
      replace:"        var correct = na > nb ? VP('C', b) : (na < nb ? VP('C', a) : VS('cap'));" },
    /* 「一樣的積木，個數多的比較重」講反了。 */
    { file:'review', expect:'correct is',
      find:"        var correct = na > nb ? VP('I', a) : (na < nb ? VP('I', b) : VS('w'));",
      replace:"        var correct = na > nb ? VP('I', b) : (na < nb ? VP('I', a) : VS('w'));" },
    /* sameCup 的杯數必須就是容器自己的杯數，不可以另外編一組。 */
    { file:'review', expect:'is not the container’s own cup count',
      find:'        var na = CONTAINERS[a].cap, nb = CONTAINERS[b].cap;\n        var correct = na > nb ? VP(\'C\', a) : (na < nb ? VP(\'C\', b) : VS(\'cap\'));',
      replace:'        var na = CONTAINERS[a].cap + 1, nb = CONTAINERS[b].cap;\n        var correct = na > nb ? VP(\'C\', a) : (na < nb ? VP(\'C\', b) : VS(\'cap\'));' },
    /* blockWeigh 的積木數必須就是東西自己的積木數。 */
    { file:'review', expect:'is not the item’s own block count',
      find:'        var na = ITEMS[a].wt, nb = ITEMS[b].wt;\n        var correct = na > nb ? VP(\'I\', a) : (na < nb ? VP(\'I\', b) : VS(\'w\'));',
      replace:'        var na = ITEMS[a].wt + 1, nb = ITEMS[b].wt;\n        var correct = na > nb ? VP(\'I\', a) : (na < nb ? VP(\'I\', b) : VS(\'w\'));' },
    /* **這一課最貴的一條**：大杯的杯數如果不比小杯少，「沒辦法比」就是錯的 ——
       3 大杯一定多過 2 小杯，孩子照著正確推理反而會被判錯。 */
    { file:'review', expect:'the big-cup count must be smaller',
      find:'        var nb = 3 + rand(6);          /* 小杯 3~8 杯 */\n        var na = 2 + rand(nb - 2);     /* 大杯 2~(小杯 − 1) 杯 */',
      replace:'        var nb = 3 + rand(6);          /* 小杯 3~8 杯 */\n        var na = nb + 1 + rand(3);     /* 大杯 2~(小杯 − 1) 杯 */' },
    /* diffCup 一定要用沒有名字的兩個瓶子。 */
    { file:'review', expect:'must use the unlabelled jars',
      find:'        var a = 0, b = 1;              /* 沒有名字的兩個瓶子，別題不會提到它們的杯數 */',
      replace:'        var a = 0, b = 0;              /* 沒有名字的兩個瓶子，別題不會提到它們的杯數 */' },
    /* 選項換回有固定杯數的容器 → 讀過整課的孩子可以從別題把答案推出來。 */
    { file:'review', expect:'but this question needs',
      find:"        var mix = fixed4(correct, [VP('U', a), VP('U', b), VS('cap')]);",
      replace:"        var mix = fixed4(correct, [VP('C', a), VP('C', b), VS('cap')]);" },
    /* 傳遞題的正解方向反了（丙比甲重）。 */
    { file:'review', expect:'correct is',
      find:'        var correct = RL(a, c);\n        var mix = fixed4(correct, [RL(c, a), VS(\'w\'), VN(\'w\')]);',
      replace:'        var correct = RL(c, a);\n        var mix = fixed4(correct, [RL(a, c), VS(\'w\'), VN(\'w\')]);' },
    /* 傳遞題三個箱子必須不一樣，不然線索接不起來。 */
    { file:'review', expect:'the three boxes must all differ',
      find:"        var rest = shuffle([0,1,2,3].filter(function(x){ return x !== first; })).slice(0, 2);",
      replace:"        var rest = [first, first];" },
    /* 排順序：三個值必須兩兩不同，不然「唯一的正確順序」不成立。 */
    { file:'review', expect:'the three measurements must all differ',
      find:'          (byVal[v] = byVal[v] || []).push(k);',
      replace:'          (byVal[k] = byVal[k] || []).push(k);' },
    /* 排順序的正解如果不是照真值排的，就是把答案寫死了。 */
    { file:'review', expect:'opts[ans] != correct',
      find:'        var order = ids.slice().sort(function(x, y){ return valOf(y) - valOf(x); });',
      replace:'        var order = ids.slice();' },
    /* 差幾杯／差幾個：na ＝ 2 × nb 時，「答成小的那個數」剛好等於正確答案 ——
       誘答變成第二個正解。組合表把它濾掉，這一筆證明那個濾網真的在擋。 */
    { file:'review', expect:'must not be twice',
      find:'        if (a > b && a !== 2 * b) out.push([i, j]);',
      replace:'        if (a > b) out.push([i, j]);' },
    /* 第一個一定要比第二個多，不然差會變成負的或 0。 */
    { file:'review', expect:'must take more',
      find:'        var a = valOf(i), b = valOf(j);\n        if (a > b && a !== 2 * b) out.push([i, j]);',
      replace:'        var a = valOf(i), b = valOf(j);\n        if (a !== b && a !== 2 * b) out.push([i, j]);' },
    /* 差幾杯的正解算成加的。 */
    { file:'review', expect:'opts[ans] != correct',
      find:'        var na = CONTAINERS[a].cap, nb = CONTAINERS[b].cap;\n        var diff = na - nb;',
      replace:'        var na = CONTAINERS[a].cap, nb = CONTAINERS[b].cap;\n        var diff = na + nb;' },
    /* 「該怎麼比」的正解換成一個已經在誘答清單裡的方法 → 選項塌成三個。 */
    { file:'review', expect:'two options are the same answer',
      find:"        var correct = dom === 'cap' ? MT(0) : MT(4);",
      replace:"        var correct = dom === 'cap' ? MT(1) : MT(4);" },
    /* 「把甲裝滿倒進乙」也是對的做法，放進誘答就有兩個正解 ——
       這裡改成把「用同一個杯子量」也放進容量題的誘答清單。 */
    { file:'review', expect:'the option set is',
      find:"        var others = dom === 'cap' ? [MT(1), MT(2), MT(3)] : [MT(5), MT(6), MT(1)];",
      replace:"        var others = dom === 'cap' ? [MT(1), MT(2), MT(5)] : [MT(5), MT(6), MT(1)];" },

    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? (d.na + ' － ' + d.nb + ' ＝ ' + d.diff + '，' + na + '多裝 ' + nCup(d.diff, 'zh') + '。')",
      replace:"            ? (d.na + ' － ' + d.nb + ' ＝ ' + d.diff + '，' + na + '多裝' + nCup(d.diff, 'zh') + '。')" },
    { file:'review', expect:'doubled punctuation',
      find:"            : (d.na + ' − ' + d.nb + ' = ' + d.diff + ', so ' + na + ' took ' + nCup(d.diff, 'en') + ' more.')",
      replace:"            : (d.na + ' − ' + d.nb + ' = ' + d.diff + ', so ' + na + ' took ' + nCup(d.diff, 'en') + ' more..')" },

    /* --- index.html：名稱表與資料 --- */
    { file:'index', expect:'does not match the drawn size',
      find:"    { icon:'🏺', w:30,  h:100, cap:5 },",
      replace:"    { icon:'🏺', w:30,  h:100, cap:6 }," },
    { file:'index', expect:'the checker expects',
      find:"      cn:['水壺','花瓶','玻璃杯','碗','水桶','瓶子'],",
      replace:"      cn:['水壺','花瓶','杯子','碗','水桶','瓶子']," },
    { file:'index', expect:'the checker expects',
      find:"      it:['strawberry','balloon','apple','orange','potato','teddy bear','stone','watermelon'],",
      replace:"      it:['strawberry','balloon','apple','orange','potato','teddy','stone','watermelon']," },
    { file:'index', expect:'must be a whole number',
      find:"    { icon:'🍶', w:50,  h:60,  cap:5 }",
      replace:"    { icon:'🍶', w:50,  h:30.5,  cap:5 }" },
    /* 箱子的重量必須兩兩不同，不然線索接龍會有兩個正確順序。 */
    { file:'index', expect:'must all weigh differently',
      find:"    { icon:'🟩', wt:6 }",
      replace:"    { icon:'🟩', wt:8 }" },

    /* --- index.html：範例資料 --- */
    { file:'index', expect:'POUR_CASES must cover',
      find:'    { a:1, b:5 }   /* 🏺 花瓶(5，高) → 🍶 瓶子(5，矮)：剛好裝滿 → 一樣多 */',
      replace:'    { a:0, b:2 }   /* 🏺 花瓶(5，高) → 🍶 瓶子(5，矮)：剛好裝滿 → 一樣多 */' },
    { file:'index', expect:'BAL_CASES must cover',
      find:'    { a:2, b:3 }   /* 🍎 蘋果(4) vs 🍊 橘子(4) → 平的 → 一樣重 */',
      replace:'    { a:2, b:5 }   /* 🍎 蘋果(4) vs 🍊 橘子(4) → 平的 → 一樣重 */' },
    { file:'index', expect:'the taller one must hold less',
      find:'  var CUP_EX = { a:1, b:3 };            /* 🏺 花瓶 5 杯 vs 🥣 碗 6 杯：高的反而少 */',
      replace:'  var CUP_EX = { a:0, b:2 };            /* 🏺 花瓶 5 杯 vs 🥣 碗 6 杯：高的反而少 */' },
    { file:'index', expect:'the big-cup count must be smaller',
      find:'  var CUP_WARN = { a:0, na:3, b:1, nb:5 };',
      replace:'  var CUP_WARN = { a:0, na:6, b:1, nb:5 };' },
    /* 杯數跑出這一課看得到的範圍。 */
    { file:'index', expect:'outside the 1~9 this lesson ever shows',
      find:'  var CUP_WARN = { a:0, na:3, b:1, nb:5 };',
      replace:'  var CUP_WARN = { a:0, na:3, b:1, nb:12 };' },
    /* 警告圖換回「別處已經量過」的容器（水桶＝索引 4）—— 那時「還不知道」
       就不再是唯一正解，因為別題已經給過那個容器的杯數。 */
    { file:'index', expect:'CUP_WARN.b index 4 is outside',
      find:'  var CUP_WARN = { a:0, na:3, b:1, nb:5 };',
      replace:'  var CUP_WARN = { a:0, na:3, b:4, nb:5 };' },
    /* 沒有名字的瓶子被改名成有名字的容器。 */
    { file:'index', expect:'the checker expects',
      find:"      un:['甲瓶','乙瓶'],",
      replace:"      un:['水壺','水桶'],", },
    { file:'index', expect:'BLK_CASES needs one pair where the bigger thing is lighter',
      find:'    { a:1, b:6 }   /* 🎈 氣球 1 個 vs 🪨 石頭 9 個（再看一次大 ≠ 重） */',
      replace:'    { a:0, b:6 }   /* 🎈 氣球 1 個 vs 🪨 石頭 9 個（再看一次大 ≠ 重） */' },
    /* 結論句沒有講出答案。 */
    { file:'index', expect:'p1s2 zh states',
      find:"        if (ca > cb) return '水滿出來 → <span class=\"bigans\">' + this.cName(c.a) + '裝得比較多</span>' + note;",
      replace:"        if (ca > cb) return '水滿出來 → <span class=\"bigans\">' + this.cName(c.b) + '裝得比較多</span>' + note;" },
    { file:'index', expect:'p2s2 zh states',
      find:"        if (wa > wb) return '沉下去的是左邊 → <span class=\"bigans\">' + this.iName(c.a) + '比較重</span>' + note;",
      replace:"        if (wa > wb) return '沉下去的是左邊 → <span class=\"bigans\">' + this.iName(c.b) + '比較重</span>' + note;" },
    /* 「高不代表多」那句註解如果永遠只寫同一種，一半的情況在說謊。 */
    { file:'index', expect:'the wrong height note',
      find:"        return tallCap > otherCap\n          ? '（這次比較高的 ' + tallName + '真的裝比較多，可是不能只看高矮。）'\n          : '（比較高的是 ' + tallName + '，卻沒有裝比較多 —— 高不代表多。）';",
      replace:"        return '（比較高的是 ' + tallName + '，卻沒有裝比較多 —— 高不代表多。）';" },
    { file:'index', expect:'the wrong size note',
      find:"        return bigWt > otherWt\n          ? '（這次比較大的 ' + bigName + '真的比較重，可是不能只看大小。）'\n          : '（比較大的是 ' + bigName + '，卻沒有比較重 —— 大不代表重。）';",
      replace:"        return '（比較大的是 ' + bigName + '，卻沒有比較重 —— 大不代表重。）';" },
    { file:'index', expect:'p3End zh states',
      find:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + more + '裝得比較多</span>';",
      replace:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + this.cName(e.a) + '裝得比較多</span>';" },
    { file:'index', expect:'p4s3 zh states',
      find:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + more + '比較重</span>（積木要一樣的才能比）';",
      replace:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + this.iName(c.a) + '比較重</span>（積木要一樣的才能比）';" },
    /* 間接比較的說明一定要提到「同一個杯子／一樣的積木」，否則規則就沒有前提了。 */
    { file:'index', expect:'never says the cup must be the same one',
      find:"      p3s0:function(e){ return '用同一個 🥤 小杯子。先把 ' + this.cName(e.a) + '裝滿，按「再倒一杯」。'; },",
      replace:"      p3s0:function(e){ return '用 🥤 小杯子。先把 ' + this.cName(e.a) + '裝滿，按「再倒一杯」。'; }," },
    { file:'index', expect:'never says the blocks must be identical',
      find:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + more + '比較重</span>（積木要一樣的才能比）';\n      },\n      blkLabel",
      replace:"               '。' + hi + ' 比 ' + lo + ' 多 → <span class=\"bigans\">' + more + '比較重</span>';\n      },\n      blkLabel" },

    /* --- index.html：遊戲關卡 --- */
    { file:'index', expect:'opts[ans] is not the true order',
      find:"    { cat:'I', dom:'w',   show:'count', ids:[0,7,2], opts:[[7,2,0],[0,2,7],[2,7,0]], ans:0 },",
      replace:"    { cat:'I', dom:'w',   show:'count', ids:[0,7,2], opts:[[7,2,0],[0,2,7],[2,7,0]], ans:1 }," },
    { file:'index', expect:'two options are the same order',
      find:"    { cat:'B', dom:'w',   show:'clue',  ids:[0,1,2], opts:[[1,0,2],[2,1,0],[0,1,2]], ans:2 },",
      replace:"    { cat:'B', dom:'w',   show:'clue',  ids:[0,1,2], opts:[[1,0,2],[1,0,2],[0,1,2]], ans:2 }," },
    { file:'index', expect:'measurements must all differ',
      find:"    { cat:'C', dom:'cap', show:'count', ids:[3,0,2], opts:[[2,3,0],[0,3,2],[3,0,2]], ans:1 },",
      replace:"    { cat:'C', dom:'cap', show:'count', ids:[3,5,1], opts:[[1,3,5],[5,3,1],[3,5,1]], ans:1 }," },
    { file:'index', expect:'ROUNDS needs a round where the tallest container',
      find:"    { cat:'C', dom:'cap', show:'count', ids:[1,3,4], opts:[[4,1,3],[4,3,1],[1,3,4]], ans:1 },",
      replace:"    { cat:'C', dom:'cap', show:'count', ids:[0,3,2], opts:[[2,0,3],[0,3,2],[3,0,2]], ans:1 }," },
    { file:'index', expect:'weight clue rounds must use the boxes',
      find:"    { cat:'B', dom:'w',   show:'clue',  ids:[0,1,2], opts:[[1,0,2],[2,1,0],[0,1,2]], ans:2 },\n    { cat:'C', dom:'cap', show:'count', ids:[1,3,4]",
      replace:"    { cat:'I', dom:'w',   show:'clue',  ids:[7,5,2], opts:[[5,7,2],[2,5,7],[7,5,2]], ans:2 },\n    { cat:'C', dom:'cap', show:'count', ids:[1,3,4]" },
    { file:'index', expect:'gWhy never states the order',
      find:"        return '從多到少是 ' + nums.join('、') + ' ' + unit + '，所以順序是 ' + this.gOpt(r, order) + '。';",
      replace:"        return '從多到少是 ' + nums.join('、') + ' ' + unit + '。';" },

    /* --- index.html：SVG 的寬度 --- */
    /* 水滿出來的水花畫在容器右邊，只算容器寬度的話那幾滴會被整段切掉。 */
    { file:'index', expect:'px wide but draws out to x=',
      find:"    var w = PAD + c.w + PAD + (drops > 0 ? 40 : 0);",
      replace:"    var w = PAD + c.w + PAD;" },
    /* 天平右盤上的積木排開來比盤子寬，只量盤子的話量不到。 */
    { file:'index', expect:'px wide but draws out to x=',
      find:"    var W = 260, H = 176, cx = 130, pivot = 56, arm = 92, drop = 16, hang = 30;",
      replace:"    var W = 200, H = 176, cx = 130, pivot = 56, arm = 92, drop = 16, hang = 30;" },
    /* 一排杯子只算到第九個的起點，最後一個會被切掉。 */
    { file:'index', expect:'px wide but draws out to x=',
      find:'    var w = cols * step + 14;',
      replace:'    var w = cols * step;' },

    /* --- index.html：三層題庫 --- */
    { file:'index', expect:'the checker expects',
      find:"          opts:['🥛 玻璃杯','🫖 水壺','兩個一樣多','沒辦法比'], ans:1,",
      replace:"          opts:['🥛 玻璃杯','🫖 水壺','兩個一樣多','沒辦法比'], ans:0," },
    { file:'index', expect:'is not a valid option index',
      find:"          opts:['🎈 氣球','兩個一樣重','🪨 石頭','沒辦法知道'], ans:2,",
      replace:"          opts:['🎈 氣球','兩個一樣重','🪨 石頭','沒辦法知道'], ans:9," },
    { file:'index', expect:'the stem contains an unexpected number',
      find:"        { stem:'🥤 用同一個小杯子量：🫖 水壺 8 杯、🥣 碗 6 杯。<br>哪一個裝得比較多？',",
      replace:"        { stem:'🥤 用同一個小杯子量：🫖 水壺 8 杯、🥣 碗 6 杯（另外還有 3 個杯子）。<br>哪一個裝得比較多？'," },
    { file:'index', expect:'never appears in the stem',
      find:"        { stem:'⚖️ 用一樣的積木秤：🍎 蘋果 4 個、🧸 玩具熊 6 個。<br>哪一個比較重？',",
      replace:"        { stem:'⚖️ 用一樣的積木秤：🍎 蘋果 5 個、🧸 玩具熊 6 個。<br>哪一個比較重？'," },
    { file:'index', expect:'the option set for',
      find:"          opts:['🏺 花瓶','🥣 碗','兩個一樣多','沒辦法比'], ans:1,\n          why:'同一個杯子量出來，6 杯比 5 杯多，所以碗裝得比較多。比較高的不一定裝得多。' }",
      replace:"          opts:['🏺 花瓶','🥣 碗','兩個一樣多','banana'], ans:1,\n          why:'同一個杯子量出來，6 杯比 5 杯多，所以碗裝得比較多。比較高的不一定裝得多。' }" },
    { file:'index', expect:'the big cup measured MORE cups',
      find:"        { stem:'🥤 用大杯量 🫙 甲瓶，量出 3 杯；用小杯量 🍯 乙瓶，量出 5 杯。<br>哪一個裝得比較多？',",
      replace:"        { stem:'🥤 用大杯量 🫙 甲瓶，量出 7 杯；用小杯量 🍯 乙瓶，量出 5 杯。<br>哪一個裝得比較多？'," },
    { file:'index', expect:'marked answer is',
      find:"          opts:['3 杯','6 杯','9 杯','15 杯'], ans:0,",
      replace:"          opts:['4 杯','6 杯','9 杯','15 杯'], ans:0," },
    { file:'index', expect:'expected answers recorded',
      find:"        { stem:'迷思檢查：🏺 花瓶比 🥣 碗高。用同一個小杯子量，花瓶 5 杯、碗 6 杯。<br>哪一個裝得比較多？',\n          opts:['🏺 花瓶','🥣 碗','兩個一樣多','沒辦法比'], ans:1,",
      replace:"        { stem:'🥤 一樣的題目再一次。<br>哪一個裝得比較多？',\n          opts:['🏺 花瓶','🥣 碗','兩個一樣多','沒辦法比'], ans:1, why:'重複的一題。' },\n        { stem:'迷思檢查：🏺 花瓶比 🥣 碗高。用同一個小杯子量，花瓶 5 杯、碗 6 杯。<br>哪一個裝得比較多？',\n          opts:['🏺 花瓶','🥣 碗','兩個一樣多','沒辦法比'], ans:1," },
    { file:'index', expect:'en qs: 5 questions but 6 expected',
      find:"        { stem:'⚖️ One thing on each side, and the balance stays level.<br>What does that tell you?',\n          opts:['the left side is heavier','the right side is heavier','they weigh the same','both of them are light'], ans:2,\n          why:'A level balance means the two sides weigh the same. It does not tell you whether they are light or heavy.' }\n      ],",
      replace:"      ]," },
    /* ===== 第三輪審查新增／改寫的斷言 ===== */
    /* 「同一個杯子」是充分條件，不是必要條件。必要性版本（「只有…才成立」）
       在「3 大杯 vs 2 小杯」那裡會說謊。 */
    { file:'parents', expect:'must keep the two directions apart',
      find:'      "s1p2": "<strong>大人最容易誤解的那一點：</strong>',
      replace:'      "s1p2": "「杯數多就是裝得多」只有在兩邊用同一個杯子時才成立。<strong>大人最容易誤解的那一點：</strong>' },
    { file:'parents', expect:'must keep the two directions apart',
      find:'      "s1p2": "<strong>The point adults most often miss:</strong>',
      replace:'      "s1p2": "Note that “more cups means it holds more” is only true when both were measured with the same cup. <strong>The point adults most often miss:</strong>' },
    /* 「滿出來了，所以這個裝得比較多」——「這個」可以指到接水的那一個。 */
    { file:'parents', expect:'must name which container it poured from',
      find:'並說出「滿出來了，所以<strong>倒出去的</strong>那個裝得比較多」或「還有空位，所以<strong>接水的</strong>那個裝得比較多」。</li>',
      replace:'並說出「滿出來了，所以這個裝得比較多」或「還有空位，所以那個裝得比較多」。</li>' },
    /* 速查卡的極性被反過來寫（「積木不需要一樣重」）—— 只找關鍵詞擋不住。 */
    { file:'reference', expect:'must not flip the polarity',
      find:"r5c:'兩邊的積木<strong>不一樣重</strong>（一樣大也可能不一樣重）',",
      replace:"r5c:'兩邊的積木<strong>不需要一樣重</strong>（一樣大就可以比）',", },
    { file:'reference', expect:'must not flip the polarity',
      find:"r1c:'blocks that <strong>all weigh the same</strong>',",
      replace:"r1c:'blocks that <strong>need not weigh the same</strong>',", },
    /* 家長頁把段落綁到別的 key 上：畫面上的文字整段被換掉，
       只在原始碼裡數字串的話這一筆是綠的。 */
    { file:'parents', expect:'is not bound to data-i18n="h1p"',
      find:'<p data-i18n="h1p">拿同一個碗',
      replace:'<p data-i18n="h1pX">拿同一個碗' },
    /* ===== 第二輪審查新增／改寫的斷言，每一條各配一筆改壞版本 ===== */
    /* 傳遞題的線索方向跟遊戲那邊的輕重真值相反 —— 同一個箱子兩頁講不同的話。 */
    { file:'review', expect:'contradicts the box weights',
      find:'        var tri = [first].concat(rest).sort(function(x, y){ return BOXES[y].wt - BOXES[x].wt; });',
      replace:'        var tri = [first].concat(rest).sort(function(x, y){ return BOXES[x].wt - BOXES[y].wt; });' },
    /* 課程自己的 truthOf 講錯話時，遊戲的真值不可以跟著它一起錯。 */
    { file:'index', expect:"the checker's own table says",
      find:"  function truthOf(cat, id){ return cat === 'C' ? CONTAINERS[id].cap : catalog(cat)[id].wt; }",
      replace:"  function truthOf(cat, id){ return cat === 'C' ? CONTAINERS[id].cap + 1 : catalog(cat)[id].wt; }" },
    /* 線索寫反了（藍箱比紅箱重）—— 照著畫面上的線索推理會選到錯的選項。 */
    { file:'index', expect:'the checker expects',
      find:"      gClueW:function(a, b){ return this.bName(a) + '比 ' + this.bName(b) + '重'; },",
      replace:"      gClueW:function(a, b){ return this.bName(b) + '比 ' + this.bName(a) + '重'; }," },
    /* 倒水的線索寫反了。 */
    { file:'index', expect:'the checker expects',
      find:"      gClueC:function(a, b){ return this.cName(a) + '裝滿倒進 ' + this.cName(b) + '，水滿出來了'; },",
      replace:"      gClueC:function(a, b){ return this.cName(b) + '裝滿倒進 ' + this.cName(a) + '，水滿出來了'; }," },
    /* 只有第二句線索寫反：只驗第一句的話這一筆會靜靜通過。 */
    { file:'index', expect:'clue 2 reads',
      find:"      gClueW:function(a, b){ return this.bName(a) + '比 ' + this.bName(b) + '重'; },",
      replace:"      gClueW:function(a, b){ return (b === 2 ? this.bName(b) + '比 ' + this.bName(a) : this.bName(a) + '比 ' + this.bName(b)) + '重'; }," },
    /* 尺寸寫在 style 裡的元素：清點得到、卻一條邊都量不到。 */
    { file:'index', expect:'cannot be measured',
      find:"    s += '<rect x=\"' + (PAD - 6) + '\" y=\"' + BASE + '\" width=\"' + (c.w + 12) +\n         '\" height=\"4\" rx=\"2\" fill=\"#E8E2D6\"/>';",
      replace:"    s += '<rect y=\"' + BASE + '\" style=\"width:' + (c.w + 12) + 'px;height:4px\" rx=\"2\" fill=\"#E8E2D6\"/>';" },
    /* --- 速查卡與家長頁：這一輪第一次有針對這兩頁的斷言 --- */
    /* 積木的關鍵是「一樣重」，不是「一樣大」：同樣大的木塊和金屬塊差很多。 */
    { file:'reference', expect:'must not make block comparison depend on size',
      find:"r5c:'兩邊的積木<strong>不一樣重</strong>（一樣大也可能不一樣重）',",
      replace:"r5c:'兩邊用了<strong>不一樣大</strong>的積木'," },
    { file:'reference', expect:'must not make block comparison depend on size',
      find:"r5c:'the blocks were <strong>not all the same weight</strong> (same size can still mean different weight)',",
      replace:"r5c:'the two sides used <strong>different-sized</strong> blocks'," },
    /* 盛飯活動量到的是鍋裡現在的飯，不是鍋子的容量 —— 一定要講清楚是哪一個。 */
    { file:'parents', expect:'must say what the bowl count measures',
      find:'      "h1p": "拿同一個碗，問「這鍋的飯可以盛幾碗？」一碗一碗盛、一起數（最後不滿一碗就說「還有半碗」）。換另一鍋再數一次，然後問「哪一鍋的<strong>飯</strong>比較多？你怎麼知道？」重點提醒兩件事：兩次都要用同一個碗，而且數的是<strong>飯</strong>有多少，不是鍋子能裝多少',
      replace:'      "h1p": "拿同一個碗，問「這鍋的飯可以盛幾碗？」一碗一碗盛、一起數（最後不滿一碗就說「還有半碗」）。換另一鍋再數一次，然後問「哪一鍋的<strong>飯</strong>比較多？你怎麼知道？」重點提醒兩件事：兩次都要用同一個碗，而且要數清楚' },
    /* ===== 這一輪新增／改寫的斷言，每一條各配一筆改壞版本 ===== */
    /* 畫布只算寬度的話，height 少算就沒人發現 —— 矮容器的第四滴水花會被切掉。 */
    { file:'index', expect:'px tall but draws out to y=',
      find:'    var h = Math.max(BASE + 14, drops > 0 ? (top + 18 + (drops - 1) * 11 + 6) : 0);',
      replace:'    var h = BASE + 14;' },
    /* 一排杯子的高度只算 size + 8 的話，大杯那一排的下緣會被切掉 ——
       文字的 y 是基線，emoji 還會往下掉大約三成字級。 */
    { file:'index', expect:'px tall but draws out to y=',
      find:'    var h = 4 + (rows - 1) * (size + 8) + size + Math.ceil(size * 0.3) + 3;',
      replace:'    var h = rows * (size + 8) + 6;' },
    /* 只量右下兩個邊的話，畫到畫布左邊外面去也是綠的。 */
    { file:'index', expect:'clipped by the left edge',
      find:"      s += '<text x=\"' + (5 + (i % perRow) * step) + '\" y=\"' +",
      replace:"      s += '<text x=\"' + (-20 + (i % perRow) * step) + '\" y=\"' +" },
    /* 上緣同理：容器比 BASE 還高的時候會頂出畫布。 */
    { file:'index', expect:'clipped by the top edge',
      find:'  var BASE = 118, PAD = 14;',
      replace:'  var BASE = 60, PAD = 14;' },
    /* viewBox 與畫布對不上時，整張圖會被瀏覽器縮放，量到的座標就不是畫面上的座標。 */
    { file:'index', expect:'the viewBox does not match the canvas',
      find:"    var s = '<svg data-count=\"' + n + '\" data-px=\"' + size + '\" width=\"' + w + '\" height=\"' + h +\n            '\" viewBox=\"0 0 ' + w + ' ' + h + '\" style=\"max-width:100%;height:auto\" ' +",
      replace:"    var s = '<svg data-count=\"' + n + '\" data-px=\"' + size + '\" width=\"' + w + '\" height=\"' + h +\n            '\" viewBox=\"0 0 ' + (w + 3) + ' ' + h + '\" style=\"max-width:100%;height:auto\" ' +" },
    /* 冒出一種量不到的元素時要報錯，不可以默默略過（fail-open）。 */
    { file:'index', expect:'which the geometry reader cannot measure',
      find:"    s += '</svg>';\n    return s;\n  }\n\n  /* ---------- i18n ---------- */",
      replace:"    s += '<circle cx=\"1\" cy=\"1\" r=\"1\"/></svg>';\n    return s;\n  }\n\n  /* ---------- i18n ---------- */" },
    /* 畫了 N 個元素卻只量到 M 個 —— 剩下那些是沒被量到的。 */
    { file:'index', expect:'the rest are unmeasured',
      find:"           (4 + Math.floor(i / perRow) * (size + 8) + size) + '\" font-size=\"' + size + '\">' + icon + '</text>';",
      replace:"           (4 + Math.floor(i / perRow) * (size + 8) + size) + '\" font-size=\"' + size + '\">' + icon + (i === 0 ? '' : '</text>');" },
    /* 中間那一句話（倒下去發生了什麼）說反了。 */
    { file:'index', expect:'but what happens is',
      find:"        if (ca > cb) return '倒下去 —— 水滿出來了！' + this.cName(c.b) + '裝不下。';",
      replace:"        if (ca > cb) return '倒完了 —— ' + this.cName(c.b) + '還有空位沒裝滿。';" },
    /* 天平往哪邊倒說反了。 */
    { file:'index', expect:'but what happens is',
      find:"        if (wa > wb) return '左邊沉下去了。';",
      replace:"        if (wa > wb) return '右邊沉下去了。';" },
    /* 索引越界時，覆蓋率的 .some() 以前會直接讀 undefined.size 把腳本弄爆。 */
    { file:'index', expect:'index 99 is outside',
      find:'    { a:1, b:6 },  /* 🎈 氣球(1，大) vs 🪨 石頭(9，小) → 石頭沉（大 ≠ 重） */',
      replace:'    { a:99, b:6 },  /* 🎈 氣球(1，大) vs 🪨 石頭(9，小) → 石頭沉（大 ≠ 重） */' },
    /* 題幹被改成另一種情況，正解卻沒動 —— 只驗數字與答案的話這是綠的。 */
    { file:'index', expect:'the stem never says',
      find:"        { stem:'🫖 把水壺裝滿的水倒進 🥛 玻璃杯，水滿出來了。<br>哪一個裝得比較多？',",
      replace:"        { stem:'🫖 把水壺裝滿的水倒進 🥛 玻璃杯，玻璃杯還有空位。<br>哪一個裝得比較多？'," },
    /* 題幹多說了一句「不該說」的話（天平是平的，卻又說沉下去）。 */
    { file:'index', expect:'turns it into a different question',
      find:"        { stem:'⚖️ 兩邊各放一個東西，天平是平的。<br>這表示什麼？',",
      replace:"        { stem:'⚖️ 兩邊各放一個東西，天平是平的，右邊沉下去。<br>這表示什麼？'," },
    /* 解釋把決定性的比較講反了 —— 以前 why 根本沒被讀過。 */
    { file:'index', expect:'the explanation never says',
      find:"          why:'同一個杯子量出來，8 杯比 6 杯多，所以水壺裝得比較多。' },",
      replace:"          why:'同一個杯子量出來，8 杯比 6 杯少，所以水壺裝得比較多。' }," },
    /* 解釋整個被清空。 */
    { file:'index', expect:'too short to explain anything',
      find:"          why:'天平平平的，就是兩邊一樣重。平的時候看不出輕或重，只知道一樣。' }",
      replace:"          why:'' }" },
    /* 解釋沒有引用題幹給的數字。 */
    { file:'index', expect:'never mentions',
      find:"          why:'每個積木都一樣重，6 個比 4 個多，所以玩具熊比較重。' },",
      replace:"          why:'每個積木都一樣重，多的那個比較重，所以玩具熊比較重。' }," },
    /* 方法句子（含「平平的就一樣重」）與設定檔的真值表對不上。 */
    { file:'review', expect:'bad option shape',
      find:"      '放上天平：沉下去的那一邊比較重，平平的就一樣重',",
      replace:"      '放上天平，看哪一邊沉下去'," },
  ],

  sim: {
    /* 這一課的選項幾乎都是句子（「🫖 水壺裝得比較多」），題幹的數字是「8」，
       字串比不到 —— 通用的「誘答抄題幹」檢查在這一課不會響。真正該擋的
       「把題目給的數字當答案」由 cupDiff／blockDiff 自己的不變條件把關
       （na ≠ 2 × nb，否則「答成小的那個數」剛好變成正解）。 */
    stemEchoOk: {},

    INVARIANTS: {
      /* 1. 倒倒看：滿出來 → 倒出去的那個比較多；還有空位 → 接的那個比較多；剛好 → 一樣多。 */
      pourCompare: d => {
        const bad = idxOk(d.a, CONTAINER_TRUTH.length, 'container a') || idxOk(d.b, CONTAINER_TRUTH.length, 'container b') ||
                    capOk(d.a) || capOk(d.b);
        if (bad) return bad;
        if (d.a === d.b) return 'the two containers must differ';
        const ca = CONTAINER_TRUTH[d.a].cap, cb = CONTAINER_TRUTH[d.b].cap;
        const want = ca > cb ? 'pick#C#' + d.a : ca < cb ? 'pick#C#' + d.b : 'same#cap';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#C#' + d.a, 'pick#C#' + d.b, 'same#cap', 'no#cap']) ||
          answerIs(d, want);
      },
      /* 2. 天平：沉下去的那一邊比較重（兩邊各放一個東西時）。 */
      balanceTilt: d => {
        const bad = idxOk(d.a, ITEM_TRUTH.length, 'item a') || idxOk(d.b, ITEM_TRUTH.length, 'item b');
        if (bad) return bad;
        if (d.a === d.b) return 'the two things must differ';
        const wa = ITEM_TRUTH[d.a].wt, wb = ITEM_TRUTH[d.b].wt;
        const want = wa > wb ? 'pick#I#' + d.a : wa < wb ? 'pick#I#' + d.b : 'same#w';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#I#' + d.a, 'pick#I#' + d.b, 'same#w', 'no#w']) ||
          answerIs(d, want);
      },
      /* 3. 同一個杯子：杯數多的容量比較大。杯數必須就是容器自己的杯數。 */
      sameCup: d => {
        const bad = idxOk(d.a, CONTAINER_TRUTH.length, 'container a') || idxOk(d.b, CONTAINER_TRUTH.length, 'container b') ||
                    capOk(d.a) || capOk(d.b);
        if (bad) return bad;
        if (d.a === d.b) return 'the two containers must differ';
        if (d.na !== CONTAINER_TRUTH[d.a].cap) return 'na ' + d.na + ' is not the container’s own cup count ' + CONTAINER_TRUTH[d.a].cap;
        if (d.nb !== CONTAINER_TRUTH[d.b].cap) return 'nb ' + d.nb + ' is not the container’s own cup count ' + CONTAINER_TRUTH[d.b].cap;
        const want = d.na > d.nb ? 'pick#C#' + d.a : d.na < d.nb ? 'pick#C#' + d.b : 'same#cap';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#C#' + d.a, 'pick#C#' + d.b, 'same#cap', 'no#cap']) ||
          answerIs(d, want);
      },
      /* 4. 杯子不一樣大：**大杯的杯數一定要比小杯少**，否則比得出來 ——
         大杯比小杯大，3 大杯一定多過 2 小杯，那時「沒辦法比」就是錯的。 */
      diffCup: d => {
        if (d.a !== 0 || d.b !== 1) return 'diffCup must use the unlabelled jars (0 and 1), got ' + d.a + ' / ' + d.b;
        if (!Number.isInteger(d.na) || !Number.isInteger(d.nb)) return 'the cup counts must be whole numbers';
        if (!(d.na >= 2 && d.nb <= 8)) return 'cup counts stay in 2~8, got ' + d.na + ' / ' + d.nb;
        if (!(d.na < d.nb)) return 'the big-cup count must be smaller than the small-cup count (' + d.na + ' vs ' + d.nb + '), otherwise the comparison IS decidable';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#U#0', 'pick#U#1', 'same#cap', 'no#cap']) ||
          answerIs(d, 'no#cap');
      },
      /* 5. 一樣的積木：個數多的比較重。個數必須就是東西自己的積木數。 */
      blockWeigh: d => {
        const bad = idxOk(d.a, ITEM_TRUTH.length, 'item a') || idxOk(d.b, ITEM_TRUTH.length, 'item b');
        if (bad) return bad;
        if (d.a === d.b) return 'the two things must differ';
        if (d.na !== ITEM_TRUTH[d.a].wt) return 'na ' + d.na + ' is not the item’s own block count ' + ITEM_TRUTH[d.a].wt;
        if (d.nb !== ITEM_TRUTH[d.b].wt) return 'nb ' + d.nb + ' is not the item’s own block count ' + ITEM_TRUTH[d.b].wt;
        const want = d.na > d.nb ? 'pick#I#' + d.a : d.na < d.nb ? 'pick#I#' + d.b : 'same#w';
        return distinctOpts(d) ||
          optSetIs(d, ['pick#I#' + d.a, 'pick#I#' + d.b, 'same#w', 'no#w']) ||
          answerIs(d, want);
      },
      /* 6. 多幾杯：差是算出來的。na ＝ 2 × nb 時「答成小的那個數」會等於正解。 */
      cupDiff: d => {
        const bad = idxOk(d.a, CONTAINER_TRUTH.length, 'container a') || idxOk(d.b, CONTAINER_TRUTH.length, 'container b') ||
                    capOk(d.a) || capOk(d.b);
        if (bad) return bad;
        if (d.na !== CONTAINER_TRUTH[d.a].cap || d.nb !== CONTAINER_TRUTH[d.b].cap){
          return 'the cup counts are not the containers’ own cup counts';
        }
        if (!(d.na > d.nb)) return 'the first container must take more cups (' + d.na + ' vs ' + d.nb + ')';
        if (d.na === 2 * d.nb) return 'na must not be twice nb, or the “answer with the given number” distractor equals the correct difference';
        if (d.diff !== d.na - d.nb) return 'diff ' + d.diff + ' is not ' + d.na + ' − ' + d.nb;
        const keys = d.opts.map(keyOf);
        if (keys.indexOf('num#cup#' + d.nb) < 0) return 'cupDiff needs the “answered with the given number” distractor ' + d.nb;
        /* 「用加的」這個誘答只有在範圍內時才放得進去（MAX_CUP 以上的杯數／個數
           在這一課根本看不到）；超出範圍時由 numOpts 換成範圍內的數。 */
        if (d.na + d.nb <= MAX_CUP && keys.indexOf('num#cup#' + (d.na + d.nb)) < 0){
          return 'cupDiff needs the “added instead of subtracted” distractor ' + (d.na + d.nb);
        }
        return distinctOpts(d) || answerIs(d, 'num#cup#' + (d.na - d.nb));
      },
      /* 7. 多幾個積木：同上。 */
      blockDiff: d => {
        const bad = idxOk(d.a, ITEM_TRUTH.length, 'item a') || idxOk(d.b, ITEM_TRUTH.length, 'item b');
        if (bad) return bad;
        if (d.na !== ITEM_TRUTH[d.a].wt || d.nb !== ITEM_TRUTH[d.b].wt){
          return 'the block counts are not the items’ own block counts';
        }
        if (!(d.na > d.nb)) return 'the first item must take more blocks (' + d.na + ' vs ' + d.nb + ')';
        if (d.na === 2 * d.nb) return 'na must not be twice nb, or the “answer with the given number” distractor equals the correct difference';
        if (d.diff !== d.na - d.nb) return 'diff ' + d.diff + ' is not ' + d.na + ' − ' + d.nb;
        const keys = d.opts.map(keyOf);
        if (keys.indexOf('num#blk#' + d.nb) < 0) return 'blockDiff needs the “answered with the given number” distractor ' + d.nb;
        /* 「用加的」這個誘答只有在範圍內時才放得進去（MAX_BLK 以上的杯數／個數
           在這一課根本看不到）；超出範圍時由 numOpts 換成範圍內的數。 */
        if (d.na + d.nb <= MAX_BLK && keys.indexOf('num#blk#' + (d.na + d.nb)) < 0){
          return 'blockDiff needs the “added instead of subtracted” distractor ' + (d.na + d.nb);
        }
        return distinctOpts(d) || answerIs(d, 'num#blk#' + (d.na - d.nb));
      },
      /* 8. 接龍：甲比乙重、乙比丙重 → 甲一定比丙重。三個箱子必須都不一樣，
         不然「中間那一個」不存在，線索接不起來。 */
      transitive: d => {
        const bad = idxOk(d.a, BOX_TRUTH.length, 'box a') || idxOk(d.b, BOX_TRUTH.length, 'box b') ||
                    idxOk(d.c, BOX_TRUTH.length, 'box c');
        if (bad) return bad;
        if (new Set([d.a, d.b, d.c]).size !== 3) return 'the three boxes must all differ';
        /* 線索是「a 比 b 重、b 比 c 重」。這三個箱子在上課頁的遊戲裡是有輕重真值的，
           所以複習題宣稱的鏈條必須跟那份真值同方向 —— 不然同一個 🟥 紅箱會在遊戲裡
           最重、在複習題裡最輕，兩頁互相打臉。 */
        if (!(BOX_TRUTH[d.a].wt > BOX_TRUTH[d.b].wt && BOX_TRUTH[d.b].wt > BOX_TRUTH[d.c].wt)){
          return 'the clue chain (' + [d.a, d.b, d.c].join(' > ') + ') contradicts the box weights (' +
                 [BOX_TRUTH[d.a].wt, BOX_TRUTH[d.b].wt, BOX_TRUTH[d.c].wt].join(' / ') + ')';
        }
        return distinctOpts(d) ||
          optSetIs(d, ['rel#' + d.a + '#' + d.c, 'rel#' + d.c + '#' + d.a, 'same#w', 'no#w']) ||
          answerIs(d, 'rel#' + d.a + '#' + d.c);
      },
      /* 9. 排順序：三個量出來的數必須兩兩不同，正解由真值排出來。 */
      orderThree: d => {
        if (d.dom !== 'cap' && d.dom !== 'w') return 'unknown domain ' + d.dom;
        const cat = d.dom === 'cap' ? 'C' : 'I';
        if (d.cat !== cat) return 'catalogue ' + d.cat + ' does not match domain ' + d.dom;
        const table = d.dom === 'cap' ? CONTAINER_TRUTH : ITEM_TRUTH;
        if (!Array.isArray(d.ids) || d.ids.length !== 3) return 'orderThree needs exactly 3 things';
        for (const id of d.ids){
          const e = idxOk(id, table.length, 'thing');
          if (e) return e;
          if (cat === 'C' && capOk(id)) return capOk(id);
        }
        if (new Set(d.ids).size !== 3) return 'the three things must all differ';
        const valOf = id => d.dom === 'cap' ? CONTAINER_TRUTH[id].cap : ITEM_TRUTH[id].wt;
        const vals = d.ids.map(valOf);
        if (new Set(vals).size !== 3) return 'the three measurements must all differ, got ' + vals.join(' / ');
        const want = d.ids.slice().sort((x, y) => valOf(y) - valOf(x));
        /* 只有一個選項可以是真正的順序，否則有兩個正確答案。 */
        const trueOnes = d.opts.filter(o => o && o.u === 'ord' && o.ids.join(',') === want.join(','));
        if (trueOnes.length !== 1) return 'exactly one option must be the true order, found ' + trueOnes.length;
        for (const o of d.opts){
          if (!o || o.u !== 'ord') return 'every option must be an ordering';
          if (o.cat !== cat) return 'an option uses catalogue ' + o.cat + ' but the question is ' + cat;
          if (o.ids.slice().sort().join(',') !== d.ids.slice().sort().join(',')){
            return 'an option orders a different set of things';
          }
        }
        return distinctOpts(d) || answerIs(d, 'ord#' + cat + '#' + want.join(','));
      },
      /* 10. 該怎麼比：正解唯一。「把甲裝滿倒進乙」也是對的做法，
         所以它不在誘答清單裡 —— 誘答清單也要逐一比對。 */
      howToCompare: d => {
        if (d.dom !== 'cap' && d.dom !== 'w') return 'unknown domain ' + d.dom;
        const table = d.dom === 'cap' ? CONTAINER_TRUTH : ITEM_TRUTH;
        const bad = idxOk(d.a, table.length, 'thing a') || idxOk(d.b, table.length, 'thing b');
        if (bad) return bad;
        if (d.a === d.b) return 'the two things must differ';
        const want = d.dom === 'cap' ? 'mt#0' : 'mt#4';
        const set = d.dom === 'cap' ? ['mt#0','mt#1','mt#2','mt#3'] : ['mt#4','mt#5','mt#6','mt#1'];
        return distinctOpts(d) || optSetIs(d, set) || answerIs(d, want);
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數與這個設定檔自己的真值表重算，
       完全不呼叫 review.html 的 valStr —— 拿產生器自己的格式化函式來比等於自己比自己。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'pourCompare':
        case 'sameCup': {
          const ca = CONTAINER_TRUTH[d.a].cap, cb = CONTAINER_TRUTH[d.b].cap;
          return ca > cb ? fPick('C', d.a, lang) : ca < cb ? fPick('C', d.b, lang) : fSame('cap', lang);
        }
        case 'balanceTilt':
        case 'blockWeigh': {
          const wa = ITEM_TRUTH[d.a].wt, wb = ITEM_TRUTH[d.b].wt;
          return wa > wb ? fPick('I', d.a, lang) : wa < wb ? fPick('I', d.b, lang) : fSame('w', lang);
        }
        case 'diffCup':   return fNo('cap', lang);
        case 'cupDiff':   return fCup(CONTAINER_TRUTH[d.a].cap - CONTAINER_TRUTH[d.b].cap, lang);
        case 'blockDiff': return fBlk(ITEM_TRUTH[d.a].wt - ITEM_TRUTH[d.b].wt, lang);
        case 'transitive': {
          /* 正解由原始的輕重排出來，不是照抄 make() 給的 a／c 順序。 */
          const tri = [d.a, d.b, d.c].slice().sort((x, y) => BOX_TRUTH[y].wt - BOX_TRUTH[x].wt);
          return fRel(tri[0], tri[2], lang);
        }
        case 'orderThree': {
          const cat = d.dom === 'cap' ? 'C' : 'I';
          const valOf = id => d.dom === 'cap' ? CONTAINER_TRUTH[id].cap : ITEM_TRUTH[id].wt;
          return fOrd(cat, d.ids.slice().sort((x, y) => valOf(y) - valOf(x)), lang);
        }
        case 'howToCompare': return METHOD_TRUTH[lang][d.dom === 'cap' ? 0 : 4];
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：形狀要是這個產生器允許的，數字要落在課程自己算得出來的範圍裡。
       形狀比對用的是「合法字串的集合」，不是寬鬆的正規式 —— 打錯一個字就會被抓到。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]|undefined|NaN/.test(t)) return 'junk option ' + t;
      const allowed = SHAPE[genId];
      if (!allowed) return 'no option shape recorded for ' + genId;
      const hit = allowed.filter(k => shapeMatch(k, t, lang));
      if (hit.length !== 1) return 'bad option shape for ' + genId + ': ' + t;
      const bounds = NUM_RANGE[hit[0]];
      if (bounds){
        const nums = (t.match(/\d+/g) || []).map(Number);
        if (!nums.length) return 'no number in option ' + t;
        for (const v of nums){
          if (!(v >= bounds[0] && v <= bounds[1])){
            return 'option ' + t + ' contains ' + v + ', outside ' + bounds[0] + '~' + bounds[1];
          }
        }
      }
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{AREA_PER_CUP, CONTAINERS, ITEMS, BOXES, UNKNOWNS, CUP_ICON, BLK_ICON, CUP_PX_SMALL, CUP_PX_BIG,' +
                ' POUR_CASES, BAL_CASES, CUP_EX, CUP_WARN, BLK_CASES, ROUNDS, truthOf, jarSVG, balanceSVG, rowSVG}',
    check: function(data, I18N, fail){
      const LANGS = ['zh','en'];

      /* --- 1. 三本目錄：資料區（大小、輕重）與字典（名字）用索引對齊 --- */
      if (data.AREA_PER_CUP !== AREA_PER_CUP) fail(`AREA_PER_CUP is ${data.AREA_PER_CUP}; the checker expects ${AREA_PER_CUP}`);
      if (data.CONTAINERS.length !== CONTAINER_TRUTH.length){
        fail(`CONTAINERS has ${data.CONTAINERS.length} entries; the checker knows ${CONTAINER_TRUTH.length}`);
      }
      data.CONTAINERS.forEach((c, i) => {
        const t = CONTAINER_TRUTH[i];
        if (!t){ fail(`CONTAINERS[${i}] is not in the checker catalogue`); return; }
        ['w','h','cap'].forEach(k => {
          if (!Number.isInteger(c[k])) fail(`CONTAINERS[${i}].${k} must be a whole number, got ${c[k]}`);
          else if (c[k] !== t[k]) fail(`CONTAINERS[${i}].${k} is ${c[k]}, the checker expects ${t[k]}`);
        });
        if (c.icon !== t.icon) fail(`CONTAINERS[${i}].icon is ${c.icon}, the checker expects ${t.icon}`);
        /* 容量必須就是畫出來的面積換算的杯數 —— 圖和答案不可以是兩套數字。 */
        if (c.w * c.h / data.AREA_PER_CUP !== c.cap){
          fail(`CONTAINERS[${i}] cap ${c.cap} does not match the drawn size (${c.w} × ${c.h} ÷ ${data.AREA_PER_CUP})`);
        }
      });
      if (data.ITEMS.length !== ITEM_TRUTH.length){
        fail(`ITEMS has ${data.ITEMS.length} entries; the checker knows ${ITEM_TRUTH.length}`);
      }
      data.ITEMS.forEach((t2, i) => {
        const t = ITEM_TRUTH[i];
        if (!t){ fail(`ITEMS[${i}] is not in the checker catalogue`); return; }
        ['wt','size'].forEach(k => {
          if (!Number.isInteger(t2[k])) fail(`ITEMS[${i}].${k} must be a whole number, got ${t2[k]}`);
          else if (t2[k] !== t[k]) fail(`ITEMS[${i}].${k} is ${t2[k]}, the checker expects ${t[k]}`);
        });
        if (t2.icon !== t.icon) fail(`ITEMS[${i}].icon is ${t2.icon}, the checker expects ${t.icon}`);
        if (!(t2.size >= 1 && t2.size <= 5)) fail(`ITEMS[${i}].size ${t2.size} is outside 1~5`);
      });
      if (data.BOXES.length !== BOX_TRUTH.length) fail(`BOXES has ${data.BOXES.length} entries; the checker knows ${BOX_TRUTH.length}`);
      data.BOXES.forEach((b, i) => {
        const t = BOX_TRUTH[i];
        if (!t){ fail(`BOXES[${i}] is not in the checker catalogue`); return; }
        if (b.icon !== t.icon || b.wt !== t.wt) fail(`BOXES[${i}] is ${b.icon}/${b.wt}, the checker expects ${t.icon}/${t.wt}`);
      });
      if (new Set(data.BOXES.map(b => b.wt)).size !== data.BOXES.length){
        fail('the boxes must all weigh differently, otherwise a clue chain can have two right answers');
      }

      /* 名字：每一個欄位都跟真值表逐字比對。只驗「有沒有填」擋不住錯字，
         而後面每一句話用的又是同一本字典 —— 那等於自己比自己。 */
      LANGS.forEach(L => {
        const d = I18N[L];
        [['cn', CONTAINER_TRUTH], ['it', ITEM_TRUTH], ['bx', BOX_TRUTH]].forEach(([key, truth]) => {
          const arr = d[key];
          if (!Array.isArray(arr) || arr.length !== truth.length){
            fail(`${L} ${key}: ${(arr || []).length} names but the checker knows ${truth.length}`);
            return;
          }
          arr.forEach((nm, i) => {
            if (nm !== truth[i][L]) fail(`${L} ${key}[${i}] is "${nm}", the checker expects "${truth[i][L]}"`);
          });
        });
        if (new Set(d.cn).size !== d.cn.length) fail(`${L} cn has two containers with the same name`);
        if (new Set(d.it).size !== d.it.length) fail(`${L} it has two things with the same name`);
      });

      /* 兩個迷思在「範例／關卡」層級各有一條檢查（見下面的 POUR_CASES／CUP_EX／
         BAL_CASES／BLK_CASES／ROUNDS）—— 那才是孩子真的會看到的地方，
         而且每一條都有自己的改壞測試。目錄層級不另外斷言：任何一個欄位動了，
         上面的逐字比對就會先響。 */

      /* --- 3. 畫布要蓋住它自己畫出去的四個邊 ---
         只量右緣的話，height="1" 會整批過關（垂直切掉沒人看得到）；
         靠「x 一定寫在 width 前面」認元素的話，把屬性換個順序整個元素就消失了。
         所以：屬性順序無關地各自抓、四個邊都量、而且清點
         「畫了幾個元素」vs「量到幾個元素」—— 對不上就表示有一種元素沒被量到。
         （做法沿用 tools/checks/grade-2-shapes.js 的 canvasOk。） */
      const num = (attrs, name, dflt) => {
        const m = attrs.match(new RegExp('\\b' + name + '="(-?\\d+(?:\\.\\d+)?)"'));
        return m ? Number(m[1]) : dflt;
      };
      const MEASURABLE = ['rect','polygon','line','text'];
      const edgesOf = (svg) => {
        const xs = [], ys = [], xsL = [], ysT = [], partial = [];
        let seen = 0, m;
        /* 「算不算量到了」要等幾何真的抓齊才算數。先 seen++ 再抓的話，
           一個把尺寸寫在 style 裡（或缺 x/width）的 <rect> 會通過清點，
           卻一條邊都沒有貢獻 —— 它畫到畫布外面也沒人看得見。 */
        const reRect = /<rect([^>]*?)\/?>/g;
        while ((m = reRect.exec(svg)) !== null){
          const a = m[1];
          const x = num(a, 'x', NaN), y = num(a, 'y', NaN);
          const w = num(a, 'width', NaN), h = num(a, 'height', NaN);
          const sw = num(a, 'stroke-width', 0) / 2;
          if (![x, y, w, h].every(Number.isFinite)){ partial.push('rect'); continue; }
          seen++;
          xs.push(x + w + sw); ys.push(y + h + sw);
          xsL.push(x - sw); ysT.push(y - sw);
        }
        const rePoly = /<polygon([^>]*?)\/?>/g;
        while ((m = rePoly.exec(svg)) !== null){
          const a = m[1];
          const sw = num(a, 'stroke-width', 0) / 2;
          const ptm = a.match(/\bpoints="([^"]+)"/);
          const pts = ptm ? ptm[1].trim().split(/\s+/).map(p => p.split(',').map(Number)) : [];
          if (!pts.length || !pts.every(xy => xy.length === 2 && xy.every(Number.isFinite))){
            partial.push('polygon'); continue;
          }
          seen++;
          pts.forEach(xy => {
            xs.push(xy[0] + sw); ys.push(xy[1] + sw);
            xsL.push(xy[0] - sw); ysT.push(xy[1] - sw);
          });
        }
        const reLine = /<line([^>]*?)\/?>/g;
        while ((m = reLine.exec(svg)) !== null){
          const a = m[1];
          const sw = num(a, 'stroke-width', 0) / 2;
          const co = ['x1','x2','y1','y2'].map(k => num(a, k, NaN));
          if (!co.every(Number.isFinite)){ partial.push('line'); continue; }
          seen++;
          [co[0], co[1]].forEach(v => { xs.push(v + sw); xsL.push(v - sw); });
          [co[2], co[3]].forEach(v => { ys.push(v + sw); ysT.push(v - sw); });
        }
        /* 文字的右緣不是 x ＋ 字級：還要算字數，以及 text-anchor 把字擺在 x 的哪一邊。
           一個字最寬算 1.2 個字級（emoji 比一個全形字略寬）。上緣抓基線往上一個字級。 */
        const reText = /<text([^>]*)>([^<]*)<\/text>/g;
        while ((m = reText.exec(svg)) !== null){
          const a = m[1], body = m[2];
          const x = num(a, 'x', NaN), y = num(a, 'y', NaN);
          if (!Number.isFinite(x) || !Number.isFinite(y)){ partial.push('text'); continue; }
          seen++;
          const fs = num(a, 'font-size', 20);
          const anchor = (a.match(/\btext-anchor="([a-z]+)"/) || [])[1] || 'start';
          const wide = Math.ceil(([...body].length || 1) * fs * 1.2);
          xs.push(anchor === 'middle' ? x + wide / 2 : (anchor === 'end' ? x : x + wide));
          xsL.push(anchor === 'middle' ? x - wide / 2 : (anchor === 'end' ? x - wide : x));
          /* y 是基線，不是下緣。emoji 與有 descender 的字會掉到基線下面
             大約三成字級，用 y + 2 量的話一個 20px 的字可以整個掉出畫布還過關。 */
          ys.push(y + Math.ceil(fs * 0.3)); ysT.push(y - fs);
        }
        const tags = (svg.match(/<([a-zA-Z][a-zA-Z0-9-]*)/g) || []).map(t => t.slice(1));
        const unsupported = tags.filter(t => t !== 'svg' && MEASURABLE.indexOf(t) < 0);
        const rawCount = tags.filter(t => MEASURABLE.indexOf(t) >= 0).length;
        return { xs, ys, xsL, ysT, seen, rawCount, unsupported, partial };
      };
      const widthOk = (label, svg) => {
        const w = num(svg, 'width', NaN), h = num(svg, 'height', NaN);
        const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
        const e = edgesOf(svg);
        if (!Number.isFinite(w) || !Number.isFinite(h) || !e.xs.length){
          fail(`${label}: cannot read the drawing geometry`); return;
        }
        if (e.unsupported.length){
          fail(`${label}: draws <${e.unsupported[0]}>, which the geometry reader cannot measure`); return;
        }
        if (e.partial.length){
          fail(`${label}: a <${e.partial[0]}> does not declare the coordinates its bounding box needs, so it cannot be measured`);
          return;
        }
        if (e.seen !== e.rawCount){
          fail(`${label}: the geometry reader measured ${e.seen} of ${e.rawCount} drawn elements — the rest are unmeasured`);
          return;
        }
        if (!vb || Number(vb[1]) !== w || Number(vb[2]) !== h){
          fail(`${label}: the viewBox does not match the canvas (${w} x ${h})`);
        }
        const right = Math.max.apply(null, e.xs), bottom = Math.max.apply(null, e.ys);
        const left = Math.min.apply(null, e.xsL), top = Math.min.apply(null, e.ysT);
        if (!(w >= right + 2)) fail(`${label} is ${w}px wide but draws out to x=${right}`);
        if (!(h >= bottom + 2)) fail(`${label} is ${h}px tall but draws out to y=${bottom}`);
        if (!(left >= 0)) fail(`${label} is clipped by the left edge (draws out to x=${left})`);
        if (!(top >= 0)) fail(`${label} is clipped by the top edge (draws out to y=${top})`);
      };
      /* 每一格孩子按得到的畫面都要驗，不只頭尾。 */
      data.CONTAINERS.forEach((c, ci) => {
        for (let f = 0; f <= c.cap; f++) widthOk(`jarSVG(container ${ci}, ${f} cups)`, data.jarSVG(c, f, 0));
        for (let sp = 1; sp <= 5; sp++) widthOk(`jarSVG(container ${ci}, spill ${sp})`, data.jarSVG(c, c.cap, sp));
      });
      [-1, 0, 1].forEach(tilt => {
        widthOk(`balanceSVG(empty, tilt ${tilt})`, data.balanceSVG(null, null, tilt));
        data.ITEMS.forEach((a, i) => {
          widthOk(`balanceSVG(items ${i}, tilt ${tilt})`, data.balanceSVG(a, data.ITEMS[(i + 1) % data.ITEMS.length], tilt));
        });
      });
      data.ITEMS.forEach((t2, i) => {
        widthOk(`balanceSVG(blocks ${t2.wt})`, data.balanceSVG(t2, { icon:data.BLK_ICON, count:t2.wt }, 0));
      });
      const maxCount = Math.max.apply(null, data.ITEMS.map(x => x.wt).concat(data.CONTAINERS.map(x => x.cap)));
      for (let n = 1; n <= maxCount; n++){
        [data.CUP_PX_SMALL, data.CUP_PX_BIG, 16, 18, 20].forEach(px => {
          widthOk(`rowSVG(${n} @ ${px}px)`, data.rowSVG(n, data.CUP_ICON, px));
        });
      }
      /* 一杯都還沒倒的時候是一張空圖 —— 空的沒有右緣可以量，但它必須真的是空的，
         而且還是要帶得出 data-count，不然檢查腳本連「畫了幾個」都讀不到。 */
      const empty = data.rowSVG(0, data.CUP_ICON, data.CUP_PX_SMALL);
      if (empty.indexOf('data-count="0"') < 0) fail('rowSVG(0) does not carry data-count="0"');
      if (/<text/.test(empty)) fail('rowSVG(0) still draws something');

      /* --- 4. 範例 1：倒倒看。三格必須涵蓋滿出來／還有空位／剛好三種結果 --- */
      const bigans = s => { const m = String(s).match(/<span class="bigans">([^<]*)<\/span>/); return m ? m[1] : null; };
      /* 「高不代表多」那句註解有兩個分支：比較高的真的裝比較多，和比較高的反而沒有。
         寫死一種，就有一半的情況在說謊 —— 兩個分支各自要出現在該出現的時候。 */
      /* 中間那一句話（倒下去發生了什麼／天平往哪邊倒）也要跟真值對得起來。
         只驗 undefined/NaN 的話，滿出來的那一格說成「還有空位」是綠的。
         三個狀態的關鍵詞互斥：該出現的要在，不該出現的兩個都不能在。 */
      const POUR_STATE = {
        zh:{ more:'滿出來', less:'還有空位', same:'剛好裝滿' },
        en:{ more:'spills over', less:'room left', same:'exactly full' }
      };
      const BAL_STATE = {
        zh:{ left:'左邊沉下去', right:'右邊沉下去', level:'天平是平的' },
        en:{ left:'The left side went down', right:'The right side went down', level:'level' }
      };
      const stateOk = (label, text, table, want) => {
        Object.keys(table).forEach(k => {
          const has = text.indexOf(table[k]) >= 0;
          if (k === want && !has) fail(`${label}: the sentence never says "${table[k]}", which is what actually happens`);
          if (k !== want && has) fail(`${label}: the sentence says "${table[k]}", but what happens is "${table[want]}"`);
        });
      };
      const HEIGHT_NOTE = {
        zh:{ more:'真的裝比較多', less:'卻沒有裝比較多' },
        en:{ more:'really does hold more', less:'does not hold more' }
      };
      const SIZE_NOTE = {
        zh:{ more:'真的比較重', less:'卻沒有比較重' },
        en:{ more:'really is heavier', less:'is not heavier' }
      };
      const seenPour = {};
      data.POUR_CASES.forEach((c, i) => {
        const e = idxOk(c.a, data.CONTAINERS.length, `POUR_CASES[${i}].a`) || idxOk(c.b, data.CONTAINERS.length, `POUR_CASES[${i}].b`);
        if (e){ fail(e); return; }
        if (c.a === c.b){ fail(`POUR_CASES[${i}] pours a container into itself`); return; }
        const ca = data.CONTAINERS[c.a].cap, cb = data.CONTAINERS[c.b].cap;
        seenPour[ca > cb ? 'more' : ca < cb ? 'less' : 'same'] = true;
        LANGS.forEach(L => {
          const d = I18N[L];
          const s0 = d.p1s0(c), s1 = d.p1s1(c), s2 = d.p1s2(c), chip = d.s1Chip(c);
          [s0, s1, s2, chip].forEach(s => { if (/undefined|NaN/.test(s)) fail(`POUR_CASES[${i}] ${L}: ${s}`); });
          stateOk(`POUR_CASES[${i}] ${L} p1s1`, s1, POUR_STATE[L], ca > cb ? 'more' : ca < cb ? 'less' : 'same');
          const want = ca > cb ? fPick('C', c.a, L) : ca < cb ? fPick('C', c.b, L) : fSame('cap', L);
          if (bigans(s2) !== want) fail(`POUR_CASES[${i}] ${L}: p1s2 zh states "${bigans(s2)}", the checker expects "${want}"`);
          const A = data.CONTAINERS[c.a], B = data.CONTAINERS[c.b];
          if (A.h !== B.h){
            const tallCap = A.h > B.h ? A.cap : B.cap, otherCap = A.h > B.h ? B.cap : A.cap;
            const wantNote = tallCap > otherCap ? HEIGHT_NOTE[L].more : HEIGHT_NOTE[L].less;
            const wrongNote = tallCap > otherCap ? HEIGHT_NOTE[L].less : HEIGHT_NOTE[L].more;
            if (s2.indexOf(wantNote) < 0) fail(`POUR_CASES[${i}] ${L}: the height note is missing "${wantNote}"`);
            if (s2.indexOf(wrongNote) >= 0) fail(`POUR_CASES[${i}] ${L}: the wrong height note "${wrongNote}" is shown`);
          }
        });
      });
      ['more','less','same'].forEach(k => {
        if (!seenPour[k]) fail(`POUR_CASES must cover all three outcomes; "${k}" is missing`);
      });

      /* --- 5. 範例 2：天平。三格必須涵蓋左沉／右沉／平的 --- */
      const seenBal = {};
      data.BAL_CASES.forEach((c, i) => {
        const e = idxOk(c.a, data.ITEMS.length, `BAL_CASES[${i}].a`) || idxOk(c.b, data.ITEMS.length, `BAL_CASES[${i}].b`);
        if (e){ fail(e); return; }
        if (c.a === c.b){ fail(`BAL_CASES[${i}] weighs a thing against itself`); return; }
        const wa = data.ITEMS[c.a].wt, wb = data.ITEMS[c.b].wt;
        seenBal[wa > wb ? 'left' : wa < wb ? 'right' : 'level'] = true;
        LANGS.forEach(L => {
          const d = I18N[L];
          const s0 = d.p2s0(c), s1 = d.p2s1(c), s2 = d.p2s2(c), chip = d.s2Chip(c);
          [s0, s1, s2, chip].forEach(s => { if (/undefined|NaN/.test(s)) fail(`BAL_CASES[${i}] ${L}: ${s}`); });
          stateOk(`BAL_CASES[${i}] ${L} p2s1`, s1, BAL_STATE[L], wa > wb ? 'left' : wa < wb ? 'right' : 'level');
          const want = wa > wb ? fPick('I', c.a, L) : wa < wb ? fPick('I', c.b, L) : fSame('w', L);
          if (bigans(s2) !== want) fail(`BAL_CASES[${i}] ${L}: p2s2 zh states "${bigans(s2)}", the checker expects "${want}"`);
          const A = data.ITEMS[c.a], B = data.ITEMS[c.b];
          if (A.size !== B.size){
            const bigWt = A.size > B.size ? A.wt : B.wt, otherWt = A.size > B.size ? B.wt : A.wt;
            const wantNote = bigWt > otherWt ? SIZE_NOTE[L].more : SIZE_NOTE[L].less;
            const wrongNote = bigWt > otherWt ? SIZE_NOTE[L].less : SIZE_NOTE[L].more;
            if (s2.indexOf(wantNote) < 0) fail(`BAL_CASES[${i}] ${L}: the size note is missing "${wantNote}"`);
            if (s2.indexOf(wrongNote) >= 0) fail(`BAL_CASES[${i}] ${L}: the wrong size note "${wrongNote}" is shown`);
          }
        });
      });
      ['left','right','level'].forEach(k => {
        if (!seenBal[k]) fail(`BAL_CASES must cover all three balance states; "${k}" is missing`);
      });
      /* 索引先過濾再算覆蓋率 —— 直接 .some() 會在越界時讀到 undefined.size，
         檢查腳本自己丟例外，原本想印的那筆錯誤反而不見了。 */
      const itemPairOk = c => Number.isInteger(c.a) && Number.isInteger(c.b) &&
        c.a >= 0 && c.a < data.ITEMS.length && c.b >= 0 && c.b < data.ITEMS.length;
      const biggerLighter = c => {
        const A = data.ITEMS[c.a], B = data.ITEMS[c.b];
        return (A.size > B.size && A.wt < B.wt) || (B.size > A.size && B.wt < A.wt);
      };
      if (!data.BAL_CASES.filter(itemPairOk).some(biggerLighter)){
        fail('BAL_CASES needs one pair where the bigger thing is lighter, or “bigger ≠ heavier” is never shown');
      }

      /* --- 6. 範例 3：用同一個杯子量。這一格必須示範「高的反而裝得少」 --- */
      const E = data.CUP_EX;
      {
        const e = idxOk(E.a, data.CONTAINERS.length, 'CUP_EX.a') || idxOk(E.b, data.CONTAINERS.length, 'CUP_EX.b');
        if (e) fail(e);
        else {
          const A = data.CONTAINERS[E.a], B = data.CONTAINERS[E.b];
          if (!(A.h > B.h && A.cap < B.cap)){
            fail(`CUP_EX: the taller one must hold less (a is ${A.h}px tall / ${A.cap} cups, b is ${B.h}px / ${B.cap} cups)`);
          }
          LANGS.forEach(L => {
            const d = I18N[L];
            const s0 = d.p3s0(E), sa = d.p3sA(E, 1), mid = d.p3sMid(E), sb = d.p3sB(E, 1), end = d.p3End(E);
            [s0, sa, mid, sb, end].forEach(s => { if (/undefined|NaN/.test(s)) fail(`CUP_EX ${L}: ${s}`); });
            const want = A.cap > B.cap ? fPick('C', E.a, L) : fPick('C', E.b, L);
            if (bigans(end) !== want) fail(`CUP_EX ${L}: p3End zh states "${bigans(end)}", the checker expects "${want}"`);
            /* 「同一個杯子」是這條規則的前提，開場白一定要講出來。 */
            const sameCue = L === 'zh' ? '同一個' : 'same';
            if (s0.indexOf(sameCue) < 0) fail(`CUP_EX ${L}: p3s0 never says the cup must be the same one ("${sameCue}")`);
            if (mid.indexOf(sameCue) < 0) fail(`CUP_EX ${L}: p3sMid never says the cup must be the same one ("${sameCue}")`);
            if (end.indexOf(String(A.cap)) < 0 || end.indexOf(String(B.cap)) < 0){
              fail(`CUP_EX ${L}: p3End never prints both counts (${A.cap} / ${B.cap})`);
            }
          });
        }
      }
      /* 警告圖：大杯的杯數一定要比小杯少，不然那兩個是比得出來的。 */
      {
        const W = data.CUP_WARN;
        /* 一定要用沒有名字的瓶子。換成水壺、水桶那種在別題有固定杯數的容器，
           讀過整課的孩子可以從別處把答案推出來，「還不知道」就不再成立。 */
        if (!Array.isArray(data.UNKNOWNS) || data.UNKNOWNS.length !== UNKNOWN_TRUTH.length){
          fail(`UNKNOWNS has ${(data.UNKNOWNS || []).length} entries; the checker knows ${UNKNOWN_TRUTH.length}`);
        } else {
          data.UNKNOWNS.forEach((u, i) => {
            if (u.icon !== UNKNOWN_TRUTH[i].icon) fail(`UNKNOWNS[${i}].icon is ${u.icon}, the checker expects ${UNKNOWN_TRUTH[i].icon}`);
          });
          LANGS.forEach(L => {
            const arr = I18N[L].un;
            if (!Array.isArray(arr) || arr.length !== UNKNOWN_TRUTH.length){
              fail(`${L} un: ${(arr || []).length} names but the checker knows ${UNKNOWN_TRUTH.length}`);
              return;
            }
            arr.forEach((nm, i) => {
              if (nm !== UNKNOWN_TRUTH[i][L]) fail(`${L} un[${i}] is "${nm}", the checker expects "${UNKNOWN_TRUTH[i][L]}"`);
            });
          });
        }
        const e = idxOk(W.a, UNKNOWN_TRUTH.length, 'CUP_WARN.a') || idxOk(W.b, UNKNOWN_TRUTH.length, 'CUP_WARN.b');
        /* 索引不合法時一定要停：再往下走就是拿 undefined 去讀 .cap，
           檢查腳本自己爆掉，真正的錯誤訊息反而印不出來。 */
        if (e){ fail(e); }
        else {
        if (W.a === W.b) fail('CUP_WARN uses the same jar twice');
        if (!Number.isInteger(W.na) || !Number.isInteger(W.nb)) fail('CUP_WARN counts must be whole numbers');
        else if (!(W.na >= 1 && W.nb <= MAX_CUP)){
          fail(`CUP_WARN counts ${W.na} / ${W.nb} are outside the 1~${MAX_CUP} this lesson ever shows`);
        }
        else if (!(W.na < W.nb)){
          fail(`CUP_WARN: the big-cup count must be smaller than the small-cup count (${W.na} vs ${W.nb}), otherwise the two ARE comparable and “cannot compare” is wrong`);
        }
        if (data.CUP_PX_BIG <= data.CUP_PX_SMALL) fail('the big cup must be drawn bigger than the small cup');
        LANGS.forEach(L => {
          const lb = I18N[L].warnLabel(W.a, W.na, true), ls = I18N[L].warnLabel(W.b, W.nb, false);
          [lb, ls].forEach(s => { if (/undefined|NaN/.test(s)) fail(`CUP_WARN ${L}: ${s}`); });
          if (lb === ls) fail(`CUP_WARN ${L}: the two labels are identical, so the different cups are invisible`);
        });
        }
      }

      /* --- 7. 範例 4：用一樣的積木秤 --- */
      data.BLK_CASES.forEach((c, i) => {
        const e = idxOk(c.a, data.ITEMS.length, `BLK_CASES[${i}].a`) || idxOk(c.b, data.ITEMS.length, `BLK_CASES[${i}].b`);
        if (e){ fail(e); return; }
        if (c.a === c.b){ fail(`BLK_CASES[${i}] weighs a thing against itself`); return; }
        const A = data.ITEMS[c.a], B = data.ITEMS[c.b];
        if (A.wt === B.wt) fail(`BLK_CASES[${i}]: the two things must differ in weight, otherwise there is nothing to compare`);
        LANGS.forEach(L => {
          const d = I18N[L];
          const s0 = d.p4s0(c), s1 = d.p4s1(c), s2 = d.p4s2(c), s3 = d.p4s3(c), chip = d.s4Chip(c);
          [s0, s1, s2, s3, chip].forEach(s => { if (/undefined|NaN/.test(s)) fail(`BLK_CASES[${i}] ${L}: ${s}`); });
          const want = A.wt > B.wt ? fPick('I', c.a, L) : fPick('I', c.b, L);
          if (bigans(s3) !== want) fail(`BLK_CASES[${i}] ${L}: p4s3 zh states "${bigans(s3)}", the checker expects "${want}"`);
          if (s1.indexOf(String(A.wt)) < 0) fail(`BLK_CASES[${i}] ${L}: p4s1 never prints ${A.wt}`);
          if (s2.indexOf(String(B.wt)) < 0) fail(`BLK_CASES[${i}] ${L}: p4s2 never prints ${B.wt}`);
          /* 「一樣的積木」是這條規則的前提。 */
          const sameCue = L === 'zh' ? '積木要一樣' : 'identical';
          if (s3.indexOf(sameCue) < 0) fail(`BLK_CASES[${i}] ${L}: p4s3 never says the blocks must be identical ("${sameCue}")`);
        });
      });
      if (!data.BLK_CASES.filter(itemPairOk).some(biggerLighter)){
        fail('BLK_CASES needs one pair where the bigger thing is lighter');
      }

      /* --- 8. 遊戲關卡：排排看 --- */
      /* 課程的 truthOf 先跟設定檔自己的表對過一次，之後遊戲的真值一律從
         設定檔的表算 —— 直接用 data.truthOf 等於拿課程自己的函式當標準答案，
         truthOf 寫錯時整個遊戲照樣是綠的。 */
      const TRUTH_TABLES = { C:CONTAINER_TRUTH, I:ITEM_TRUTH, B:BOX_TRUTH };
      Object.keys(TRUTH_TABLES).forEach(cat => {
        TRUTH_TABLES[cat].forEach((row, id) => {
          const want = cat === 'C' ? row.cap : row.wt;
          const got = data.truthOf(cat, id);
          if (got !== want) fail(`truthOf('${cat}', ${id}) returns ${got}, the checker's own table says ${want}`);
        });
      });
      const truth = (cat, id) => (cat === 'C' ? CONTAINER_TRUTH[id].cap : TRUTH_TABLES[cat][id].wt);

      const seenShow = {}, seenDom = {};
      let sawTallTrap = false;
      data.ROUNDS.forEach((r, idx) => {
        const i = idx + 1;
        if (['C','I','B'].indexOf(r.cat) < 0){ fail(`ROUND ${i}: unknown catalogue ${r.cat}`); return; }
        if (r.dom !== 'cap' && r.dom !== 'w'){ fail(`ROUND ${i}: unknown domain ${r.dom}`); return; }
        if (r.show !== 'count' && r.show !== 'clue'){ fail(`ROUND ${i}: unknown mode ${r.show}`); return; }
        if (r.dom === 'cap' && r.cat !== 'C') fail(`ROUND ${i}: a capacity round must use containers`);
        if (r.dom === 'w' && r.cat === 'C') fail(`ROUND ${i}: a weight round cannot use containers`);
        /* 線索題（只給兩兩比較）如果用真實的東西，孩子用生活經驗就答得出來，
           量不到「接龍」。重量的線索題一律用一樣大的箱子。 */
        if (r.show === 'clue' && r.dom === 'w' && r.cat !== 'B'){
          fail(`ROUND ${i}: weight clue rounds must use the boxes, otherwise everyday knowledge answers it without the chain`);
          return;   /* 目錄不對的話，下面組線索時會拿箱子的名字去查東西的表 */
        }
        seenShow[r.show] = true; seenDom[r.dom] = true;
        const table = r.cat === 'C' ? data.CONTAINERS : (r.cat === 'I' ? data.ITEMS : data.BOXES);
        if (!Array.isArray(r.ids) || r.ids.length !== 3){ fail(`ROUND ${i}: needs exactly 3 things`); return; }
        for (const id of r.ids){
          const e = idxOk(id, table.length, `ROUND ${i} thing`);
          if (e){ fail(e); return; }
        }
        if (new Set(r.ids).size !== 3){ fail(`ROUND ${i}: the three things must all differ`); return; }
        const val = id => truth(r.cat, id);
        const vals = r.ids.map(val);
        if (new Set(vals).size !== 3){
          fail(`ROUND ${i}: the three measurements must all differ, got ${vals.join(' / ')}`);
          return;
        }
        const want = r.ids.slice().sort((x, y) => val(y) - val(x));
        if (r.opts.length !== 3) fail(`ROUND ${i}: should offer 3 orderings, has ${r.opts.length}`);
        const keys = r.opts.map(o => o.join(','));
        if (new Set(keys).size !== keys.length) fail(`ROUND ${i}: two options are the same order`);
        r.opts.forEach((o, oi) => {
          if (o.slice().sort().join(',') !== r.ids.slice().sort().join(',')){
            fail(`ROUND ${i} option ${oi}: orders a different set of things`);
          }
        });
        if (keys.filter(k => k === want.join(',')).length !== 1){
          fail(`ROUND ${i}: exactly one option must be the true order`);
        }
        if (!Number.isInteger(r.ans) || r.ans < 0 || r.ans >= r.opts.length){
          fail(`ROUND ${i}: ans ${r.ans} is not a valid option index`);
          return;
        }
        if (keys[r.ans] !== want.join(',')) fail(`ROUND ${i}: opts[ans] is not the true order (${keys[r.ans]} vs ${want.join(',')})`);
        /* 至少一關要示範「最高的容器不是裝最多的」。 */
        if (r.cat === 'C' && r.show === 'count'){
          const tallest = r.ids.slice().sort((x, y) => data.CONTAINERS[y].h - data.CONTAINERS[x].h)[0];
          if (tallest !== want[0]) sawTallTrap = true;
        }
        LANGS.forEach(L => {
          const d = I18N[L];
          const ask = d.gAsk(r), h1 = d.gHint1(r), why = d.gWhy(r, want);
          const h2 = d.gHint2(r, d.nameOf(r.cat, want[0], L));
          const labels = r.opts.map(o => d.gOpt(r, o));
          [ask, h1, h2, why].concat(labels).forEach(s => { if (/undefined|NaN/.test(s)) fail(`ROUND ${i} ${L}: ${s}`); });
          if (new Set(labels).size !== labels.length) fail(`ROUND ${i} ${L}: two option labels are identical`);
          const wantLabel = fOrd(r.cat, want, L);
          if (labels[r.ans] !== wantLabel) fail(`ROUND ${i} ${L}: the marked label is "${labels[r.ans]}", the checker expects "${wantLabel}"`);
          if (why.indexOf(wantLabel) < 0) fail(`ROUND ${i} ${L}: gWhy never states the order "${wantLabel}"`);
          if (h2.indexOf(fName(r.cat, want[0], L)) < 0) fail(`ROUND ${i} ${L}: gHint2 never names the front runner`);
          if (r.show === 'count'){
            r.ids.forEach(id => {
              const lab = d.gCount(r.cat, id, val(id), r.dom);
              if (lab.indexOf(String(val(id))) < 0) fail(`ROUND ${i} ${L}: the label for thing ${id} never prints ${val(id)}`);
              if (lab.indexOf(fName(r.cat, id, L)) < 0) fail(`ROUND ${i} ${L}: the label for thing ${id} never names it`);
            });
          } else {
            /* 兩句線索都要驗，而且整句逐字比對（含方向）。只驗第二個名字在不在，
               把「紅箱比藍箱重」寫反成「藍箱比紅箱重」也會過。 */
            [[want[0], want[1]], [want[1], want[2]]].forEach((pr, pi) => {
              const clue = r.dom === 'w' ? d.gClueW(pr[0], pr[1]) : d.gClueC(pr[0], pr[1]);
              if (/undefined|NaN/.test(clue)){ fail(`ROUND ${i} ${L}: clue ${clue}`); return; }
              const wantClue = r.dom === 'w' ? fClueW(pr[0], pr[1], L) : fClueC(pr[0], pr[1], L);
              if (clue !== wantClue){
                fail(`ROUND ${i} ${L}: clue ${pi + 1} reads "${clue}", the checker expects "${wantClue}"`);
              }
            });
          }
        });
      });
      ['count','clue'].forEach(k => { if (!seenShow[k]) fail(`ROUNDS needs at least one "${k}" round`); });
      ['cap','w'].forEach(k => { if (!seenDom[k]) fail(`ROUNDS needs at least one "${k}" round`); });
      if (!sawTallTrap) fail('ROUNDS needs a round where the tallest container is not the one that holds most');
      if (data.ROUNDS.map(r => r.ans).every(x => x === 0)) fail('every game round has the answer first');

      /* --- 8b. 速查卡與家長頁：這兩頁也會教規則，也要被驗 ---
         breaktest 會把四頁都複製進暫存目錄，所以這裡的斷言真的跑得到。 */
      const fs2 = require('fs');
      const pageDir = require('path').dirname(process.argv[2]);
      const readPage = name => {
        try { return fs2.readFileSync(require('path').join(pageDir, name), 'utf8'); }
        catch (e){ fail(`cannot read ${name}: ${e.code}`); return ''; }
      };
      const refSrc = readPage('reference.html');
      const parSrc = readPage('parents.html');
      /* 積木能不能拿來比，看的是「每個一樣重」，不是「一樣大」。
         只找關鍵詞擋不住極性 —— 「積木不需要一樣重」也含有「一樣重」三個字。
         所以整句逐字比對設定檔自己寫的那一句。 */
      const refDict = { zh:'', en:'' };
      LANGS.forEach(L => {
        const m = refSrc.match(new RegExp("htmlLang:'" + (L === 'zh' ? 'zh-Hant' : 'en') + "'[\\s\\S]*?(?=\\n    \\}|$)"));
        refDict[L] = m ? m[0] : '';
        if (!refDict[L]) fail(`reference.html: cannot locate the ${L} dictionary`);
      });
      Object.keys(REF_RULE).forEach(key => {
        LANGS.forEach(L => {
          const want = REF_RULE[key][L];
          const got = (refDict[L].match(new RegExp(key + ":'((?:\\\\.|[^'\\\\])*)'")) || [])[1];
          if (got === undefined){
            fail(`reference.html ${L}: ${key} is missing`);
          } else if (got !== want){
            fail(`reference.html ${L}: ${key} reads "${got}", the checker expects "${want}" — must not make block comparison depend on size, and must not flip the polarity`);
          }
        });
      });
      /* 盛飯活動數出來的是鍋裡現在的飯，不是鍋子裝得下多少 ——
         不講清楚的話，12 碗的鍋裡放 4 碗飯會被判成「比 6 碗的鍋小」。 */
      /* 要驗的是「真的會顯示出來的那一段」：字典裡 h1p 的兩個語言值，
         加上 markup 真的把它綁在 data-i18n="h1p" 上。只在整份原始碼裡數字串的話，
         把 data-i18n 換成別的 key（畫面上的段落就被換掉了）仍然是綠的。 */
      /* 「同一個杯子」是充分條件、不是必要條件：必要性的說法
         （「只有…才成立」／“only true when”）在 3 大杯 vs 2 小杯 那裡是假的。 */
      [['只有在兩邊用同一個杯子時才成立', 'zh'], ['only true when both were measured with the same cup', 'en']].forEach(([bad, L]) => {
        if (parSrc.indexOf(bad) >= 0){
          fail(`parents.html ${L}: must keep the two directions apart — "${bad}" claims the same cup is NECESSARY, but 3 big cups already beat 2 small ones`);
        }
      });
      [['一定裝得多', 'zh'], ['does guarantee more', 'en']].forEach(([cue, L]) => {
        if (parSrc.indexOf(cue) < 0){
          fail(`parents.html ${L}: must keep the two directions apart — the guarantee direction ("${cue}") is missing`);
        }
      });
      /* 「滿出來了，所以這個裝得比較多」——「這個」可以指到接水的那一個，
         剛好是相反的結論。角色一定要指名。 */
      /* 中文在 markup 與字典各一份、英文只在字典裡。只驗「有沒有出現過」的話，
         改掉 markup 那一份（畫面第一眼看到的就是它）還是綠的。 */
      [['倒出去的', 'zh', 2], ['poured <strong>from</strong>', 'en', 1]].forEach(([cue, L, want]) => {
        const got = parSrc.split(cue).length - 1;
        if (got < want){
          fail(`parents.html ${L}: the spill criterion must name which container it poured from ("${cue}") ${want}x, found ${got}x — "this one" can point at the receiver`);
        }
      });
      if (!/<p data-i18n="h1p">/.test(parSrc)){
        fail('parents.html: the rice activity paragraph is not bound to data-i18n="h1p", so the visible text is not the one being checked');
      }
      [['不是鍋子能裝多少', 'zh'], ['not what the pot could hold', 'en']].forEach(([cue, L]) => {
        const m = parSrc.match(new RegExp('"h1p":\\s*"((?:\\\\.|[^"\\\\])*)"', 'g')) || [];
        const vals = m.map(x => x.replace(/^"h1p":\s*"/, '').replace(/"$/, ''));
        const hit = vals.filter(v => v.indexOf(cue) >= 0).length;
        if (!hit){
          fail(`parents.html ${L}: the h1p entry must say what the bowl count measures ("${cue}") — counting served bowls measures the rice, not the pot`);
        }
      });

      /* --- 9. 三層題庫的神諭表 ---
         每一題記三件事，都跟題目本身分開維護：
         - nums：題幹裡「剛剛好」該出現的數字（中英都驗）
         - derive：從真值表把正解「算出來」，不是抄答案
         - optSet：這一題四個選項的完整集合（只驗正解的話，把某個誘答換成
           「banana」也不會有人發現） */
      const CAP_SET = L => [fSame('cap', L), fNo('cap', L)];
      const W_SET = L => [fSame('w', L), fNo('w', L)];
      /* 題幹與解釋的語意神諭：must 是「這一題非說不可」的關鍵句，
         mustNot 是「說了就代表題目被改成另一題」的相反關鍵句。
         沒有這一層，把「水滿出來了」換成「還有空位」而正解不動，所有檢查都是綠的。 */
      const BANK_EXPECTED = {
        qs: [
          { nums:[], derive:{ k:'cname', id:0 },
            stem:{ zh:{ must:['把水壺裝滿的水倒進','水滿出來了'], mustNot:['還有空位','剛好裝滿'] },
                 en:{ must:['full kettle is poured into','spills over'], mustNot:['room left','exactly full'] } },
            why:{ zh:['水滿出來','水壺裝得比較多'], en:['Spilling over','the kettle holds more'] },
            optSet:{ zh:['🥛 玻璃杯','🫖 水壺'].concat(CAP_SET('zh')),
                     en:['🥛 the glass','🫖 the kettle'].concat(CAP_SET('en')) } },
          { nums:[], derive:{ k:'iname', id:6 },
            stem:{ zh:{ must:['天平兩邊各放一個','石頭那一邊沉下去'], mustNot:['氣球那一邊沉下去','天平是平的'] },
                 en:{ must:['One thing on each side','stone’s side went down'], mustNot:['balloon’s side went down','stays level'] } },
            why:{ zh:['沉下去的那一邊比較重','石頭比較重'], en:['side that goes down is the heavier one','the stone is heavier'] },
            optSet:{ zh:['🎈 氣球','🪨 石頭'].concat(W_SET('zh')),
                     en:['🎈 the balloon','🪨 the stone'].concat(W_SET('en')) } },
          { nums:[8,6], derive:{ k:'moreCups', ids:[0,3], counts:[8,6] },
            stem:{ zh:{ must:['用同一個小杯子量','水壺 8 杯','碗 6 杯'], mustNot:['大杯','不一樣'] },
                 en:{ must:['same small cup','kettle took 8 cups','bowl took 6 cups'], mustNot:['big cup','different'] } },
            why:{ zh:['8 杯比 6 杯多','水壺裝得比較多'], en:['8 cups is more than 6 cups','the kettle holds more'] },
            optSet:{ zh:['🫖 水壺','🥣 碗'].concat(CAP_SET('zh')),
                     en:['🫖 the kettle','🥣 the bowl'].concat(CAP_SET('en')) } },
          { nums:[4,6], derive:{ k:'moreBlocks', ids:[2,5], counts:[4,6] },
            stem:{ zh:{ must:['用一樣的積木秤','蘋果 4 個','玩具熊 6 個'], mustNot:['不一樣的積木'] },
                 en:{ must:['identical blocks','apple took 4 blocks','teddy bear took 6 blocks'], mustNot:['different blocks'] } },
            why:{ zh:['6 個比 4 個多','玩具熊比較重'], en:['6 blocks is more than 4 blocks','the teddy bear is heavier'] },
            optSet:{ zh:['🍎 蘋果','🧸 玩具熊'].concat(W_SET('zh')),
                     en:['🍎 the apple','🧸 the teddy bear'].concat(W_SET('en')) } },
          /* 這一題刻意用「別處從來沒量過」的兩個瓶子：換成花瓶／碗的話，
             孩子從別題記得碗是 6 杯、花瓶是 5 杯，「碗裝得比較多」就變成
             可以由正確回想到達的錯誤選項。 */
          { nums:[], derive:{ k:'lit', zh:'還不知道，要量量看', en:'nobody knows yet — measure them' },
            stem:{ zh:{ must:['甲瓶又高又細','乙瓶又矮又寬','只知道這件事'], mustNot:['杯','花瓶','碗'] },
                 en:{ must:['Jar A is tall and thin','jar B is short and wide','Knowing only that'], mustNot:['cup','vase','bowl'] } },
            why:{ zh:['決定不了裝得多不多'], en:['decides nothing on its own'] },
            optSet:{ zh:['甲瓶裝得比較多','乙瓶裝得比較多','兩個一樣多','還不知道，要量量看'],
                     en:['jar A holds more','jar B holds more','they hold the same','nobody knows yet — measure them'] } },
          { nums:[], derive:{ k:'lit', zh:'兩個一樣重', en:'they weigh the same' },
            stem:{ zh:{ must:['兩邊各放一個東西','天平是平的'], mustNot:['沉下去'] },
                 en:{ must:['One thing on each side','stays level'], mustNot:['went down'] } },
            why:{ zh:['兩邊一樣重'], en:['weigh the same'] },
            optSet:{ zh:['左邊比較重','右邊比較重','兩個一樣重','兩個都很輕'],
                     en:['the left side is heavier','the right side is heavier','they weigh the same','both of them are light'] } }
        ],
        qsAdv: [
          /* 大杯的杯數必須比小杯少，否則「沒辦法比」是錯的。 */
          { nums:[3,5], bigCupSmaller:true, derive:{ k:'lit', zh:'沒辦法比', en:'there is no way to tell' },
            stem:{ zh:{ must:['用大杯量','用小杯量','甲瓶','乙瓶'], mustNot:['同一個'] },
                 en:{ must:['with a big cup','with a small cup','jar A','jar B'], mustNot:['same small cup'] } },
            why:{ zh:['不一樣大','不一定裝得多','再量一次'], en:['different sizes','need not mean more','one single cup'] },
            optSet:{ zh:['🫙 甲瓶','🍯 乙瓶'].concat(CAP_SET('zh')),
                     en:['🫙 jar A','🍯 jar B'].concat(CAP_SET('en')) } },
          { nums:[], derive:{ k:'rel', a:0, b:2 },
            stem:{ zh:{ must:['三個一樣大的箱子','紅箱比 🟦 藍箱重','藍箱比 🟨 黃箱重'], mustNot:['黃箱比 🟦 藍箱重'] },
                 en:{ must:['boxes of the same size','red box is heavier than 🟦 the blue box','blue box is heavier than 🟨 the yellow box'], mustNot:['beats'] } },
            why:{ zh:['接起來就是紅比黃重','中間都是藍箱'], en:['red box is heavier than the yellow box','middle of both clues'] },
            optSet:{ zh:[fRel(2, 0, 'zh'), fRel(0, 2, 'zh')].concat(W_SET('zh')),
                     en:[fRel(2, 0, 'en'), fRel(0, 2, 'en')].concat(W_SET('en')) } },
          { nums:[9,6], derive:{ k:'cupsDiff', nums:[9,6] },
            stem:{ zh:{ must:['用同一個小杯子量','水桶 9 杯','碗 6 杯','多裝幾杯'], mustNot:['大杯'] },
                 en:{ must:['same small cup','bucket took 9 cups','bowl took 6 cups','How many more cups'], mustNot:['big cup'] } },
            why:{ zh:['9 － 6 ＝ 3','多 3 杯'], en:['9 − 6 = 3','3 more cups'] },
            optSet:{ zh:['3 杯','6 杯','9 杯','15 杯'], en:['3 cups','6 cups','9 cups','15 cups'] } },
          { nums:[14,4,6], derive:{ k:'ordIcons', ids:[7,2,5] },
            stem:{ zh:{ must:['用一樣的積木秤','從重到輕排排看'], mustNot:['從輕到重'] },
                 en:{ must:['identical blocks','heaviest first'], mustNot:['lightest first'] } },
            why:{ zh:['積木多的比較重'], en:['More blocks means heavier'] },
            optSet:{ zh:['🍉 → 🧸 → 🍎','🍉 → 🍎 → 🧸','🍎 → 🧸 → 🍉','🧸 → 🍉 → 🍎'],
                     en:['🍉 → 🧸 → 🍎','🍉 → 🍎 → 🧸','🍎 → 🧸 → 🍉','🧸 → 🍉 → 🍎'] } }
        ],
        qsBoost: [
          /* 大氣球比小石頭輕：真值表要真的是這樣，這一題才成立。 */
          { nums:[], bigLighter:[1,6], derive:{ k:'lit', zh:'石頭比較重，雖然比較小', en:'the stone is heavier, even though it is smaller' },
            stem:{ zh:{ must:['大氣球','小石頭','石頭那一邊沉下去'], mustNot:['氣球那一邊沉下去'] },
                 en:{ must:['big balloon','small stone','stone’s side goes down'], mustNot:['balloon’s side goes down'] } },
            why:{ zh:['石頭比較重','大小和輕重是兩件事'], en:['the stone is heavier','two different things'] },
            optSet:{ zh:['比較大的一定比較重','氣球比較重，因為比較大','石頭比較重，雖然比較小','兩個一樣重'],
                     en:['the bigger one is always the heavier one','the balloon is heavier, because it is bigger',
                         'the stone is heavier, even though it is smaller','they weigh the same'] } },
          /* 花瓶比碗高，卻裝得比較少：真值表要真的是這樣。 */
          { nums:[5,6], tallerSmaller:[1,3], derive:{ k:'moreCups', ids:[1,3], counts:[5,6] },
            stem:{ zh:{ must:['花瓶比 🥣 碗高','用同一個小杯子量','花瓶 5 杯','碗 6 杯'], mustNot:['大杯'] },
                 en:{ must:['vase is taller than','same small cup','vase took 5 cups','bowl took 6 cups'], mustNot:['big cup'] } },
            why:{ zh:['6 杯比 5 杯多','碗裝得比較多','比較高的不一定裝得多'], en:['6 cups is more than 5 cups','the bowl holds more','does not have to hold more'] },
            optSet:{ zh:['🏺 花瓶','🥣 碗'].concat(CAP_SET('zh')),
                     en:['🏺 the vase','🥣 the bowl'].concat(CAP_SET('en')) } }
        ]
      };
      const deriveStr = (dv, L) => {
        if (dv.k === 'cname') return fCName(dv.id, L);
        if (dv.k === 'iname') return fIName(dv.id, L);
        if (dv.k === 'lit') return dv[L];
        if (dv.k === 'rel') return fRel(dv.a, dv.b, L);
        if (dv.k === 'cupsDiff') return fCup(dv.nums[0] - dv.nums[1], L);
        if (dv.k === 'moreCups'){
          const win = dv.counts[0] > dv.counts[1] ? dv.ids[0] : dv.ids[1];
          return fCName(win, L);
        }
        if (dv.k === 'moreBlocks'){
          const win = dv.counts[0] > dv.counts[1] ? dv.ids[0] : dv.ids[1];
          return fIName(win, L);
        }
        if (dv.k === 'ordIcons'){
          return dv.ids.slice().sort((x, y) => ITEM_TRUTH[y].wt - ITEM_TRUTH[x].wt)
            .map(id => ITEM_TRUTH[id].icon).join(' → ');
        }
        return 'NO DERIVATION';
      };
      const hasNum = (text, n) => new RegExp('(?<![0-9])' + n + '(?![0-9])').test(text);
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        const oracle = BANK_EXPECTED[bank] || [];
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
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 1. 題幹的數字集合要「剛剛好」等於神諭記下的那一組。 */
            const plain = String(q.stem).replace(/<[^>]+>/g, ' ');
            o.nums.forEach(n => {
              if (!hasNum(plain, n)) fail(`${bank}[${i}] ${L}: the number ${n} never appears in the stem`);
            });
            [...new Set((plain.match(/\d+/g) || []).map(Number))].forEach(n => {
              if (o.nums.indexOf(n) < 0){
                fail(`${bank}[${i}] ${L}: the stem contains an unexpected number ${n} (the checker knows only ${o.nums.join(' / ') || 'none'})`);
              }
            });
            /* 2. 正解是從真值表算出來的，不是抄的。 */
            const want = deriveStr(o.derive, L);
            if (q.opts[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is "${q.opts[q.ans]}", the checker expects "${want}"`);
            }
            /* 2b. 題幹到底說了什麼。只驗數字和答案的話，把「水滿出來了」換成
               「還有空位」而正解不動，整題還是綠的 —— 而那時正確推理會選另一個。 */
            if (!o.stem || !o.stem[L]){
              fail(`${bank}[${i}] ${L}: no stem oracle recorded in the checker`);
            } else {
              (o.stem[L].must || []).forEach(phrase => {
                if (plain.indexOf(phrase) < 0) fail(`${bank}[${i}] ${L}: the stem never says "${phrase}"`);
              });
              (o.stem[L].mustNot || []).forEach(phrase => {
                if (plain.indexOf(phrase) >= 0) fail(`${bank}[${i}] ${L}: the stem says "${phrase}", which turns it into a different question`);
              });
            }
            /* 2c. 解釋要真的解釋。整個 why 從來沒被讀過，所以
               「8 比 6 少，所以水壺裝得比較多」也是綠的。 */
            const whyPlain = String(q.why || '').replace(/<[^>]+>/g, ' ');
            if (whyPlain.trim().length < 8){
              fail(`${bank}[${i}] ${L}: the explanation is empty or too short to explain anything`);
            }
            o.nums.forEach(n => {
              if (!hasNum(whyPlain, n)) fail(`${bank}[${i}] ${L}: the explanation never mentions ${n}, which the stem gives`);
            });
            if (!o.why || !o.why[L]){
              fail(`${bank}[${i}] ${L}: no explanation oracle recorded in the checker`);
            } else {
              o.why[L].forEach(phrase => {
                if (whyPlain.indexOf(phrase) < 0){
                  fail(`${bank}[${i}] ${L}: the explanation never says "${phrase}", so it does not state why the answer is right`);
                }
              });
            }
            /* 3. 四個選項的集合要剛剛好。 */
            const got = q.opts.slice().sort().join(' | ');
            const wantSet = o.optSet[L].slice().sort().join(' | ');
            if (got !== wantSet) fail(`${bank}[${i}] ${L}: the option set for this question is\n      ${got}\n    but the checker expects\n      ${wantSet}`);
            /* 4. 選項字串兩兩不同、數字在範圍裡。 */
            const trimmed = q.opts.map(x => x.replace(/\s+/g, ' ').trim());
            for (let a = 0; a < trimmed.length; a++){
              for (let b = a + 1; b < trimmed.length; b++){
                if (trimmed[a] === trimmed[b]) fail(`${bank}[${i}] ${L}: "${q.opts[a]}" appears twice`);
              }
            }
            q.opts.forEach(opt => {
              (String(opt).match(/\d+/g) || []).map(Number).forEach(x => {
                if (!(x >= 1 && x <= 20)) fail(`${bank}[${i}] ${L}: option "${opt}" contains ${x}, outside 1~20`);
              });
            });
            /* 5. 這一題賴以成立的前提，在真值表裡要是真的。 */
            if (o.bigCupSmaller){
              /* 從**題幹本身**讀出來，不是拿神諭自己的數字比自己：大杯的杯數
                 一定要比小杯少，否則 3 大杯 vs 2 小杯 是比得出來的，
                 「沒辦法比」就變成錯的答案。 */
              const inStem = (plain.match(/\d+/g) || []).map(Number);
              if (inStem.length !== 2){
                fail(`${bank}[${i}] ${L}: the two-cup question must print exactly two numbers, got ${inStem.join(' / ') || 'none'}`);
              } else if (!(inStem[0] < inStem[1])){
                fail(`${bank}[${i}] ${L}: the big cup measured MORE cups than the small cup (${inStem[0]} vs ${inStem[1]}), so the two ARE comparable and “cannot compare” is wrong`);
              }
            }
            if (o.bigLighter){
              const [big, small] = o.bigLighter;
              if (!(ITEM_TRUTH[big].size > ITEM_TRUTH[small].size && ITEM_TRUTH[big].wt < ITEM_TRUTH[small].wt)){
                fail(`${bank}[${i}]: this question needs item ${big} to be bigger AND lighter than item ${small}`);
              }
            }
            if (o.tallerSmaller){
              const [tall, wide] = o.tallerSmaller;
              if (!(CONTAINER_TRUTH[tall].h > CONTAINER_TRUTH[wide].h && CONTAINER_TRUTH[tall].cap < CONTAINER_TRUTH[wide].cap)){
                fail(`${bank}[${i}]: this question needs container ${tall} to be taller AND smaller than container ${wide}`);
              }
            }
            if (o.derive.k === 'moreCups'){
              o.derive.ids.forEach((id, k) => {
                if (CONTAINER_TRUTH[id].cap !== o.derive.counts[k]){
                  fail(`${bank}[${i}]: the stem says container ${id} takes ${o.derive.counts[k]} cups, but the lesson's own catalogue says ${CONTAINER_TRUTH[id].cap}`);
                }
              });
            }
            if (o.derive.k === 'moreBlocks'){
              o.derive.ids.forEach((id, k) => {
                if (ITEM_TRUTH[id].wt !== o.derive.counts[k]){
                  fail(`${bank}[${i}]: the stem says item ${id} takes ${o.derive.counts[k]} blocks, but the lesson's own catalogue says ${ITEM_TRUTH[id].wt}`);
                }
              });
            }
          });
        });
      });
    }
  }
};
