/* grade-2/math/length（公分與公尺）的檢查設定。
   契約見 tools/README.md §3d：sim.INVARIANTS／sim.expectedCorrect／sim.optionOk／
   sim.stemEchoOk ＋ data.check ＋ breaks。

   這一課的關鍵在「同一個長度有好幾種寫法」：100 公分和 1 公尺是同一個答案，
   1 公尺 30 公分和 130 公分也是。字串比對看不出來（simgen 的 vkey 會說它們不同），
   孩子卻看得出來 —— 所以這裡所有的去重與比較一律換算成公分再比。 */

/* ---------- 長度值的工具（設定檔自己的一套，不呼叫 review.html 的） ---------- */
function cmOf(v){
  if (!v || typeof v !== 'object') return NaN;
  if (v.t === 'cm') return v.n;
  if (v.t === 'm') return v.n * 100;
  if (v.t === 'comp') return v.m * 100 + v.c;
  return NaN;
}
function fmtCm(n, lang){ return lang === 'zh' ? (n + ' 公分') : (n + ' cm'); }
function fmtM(n, lang){ return lang === 'zh' ? (n + ' 公尺') : (n + ' m'); }
function fmtComp(m, c, lang){
  return lang === 'zh' ? (m + ' 公尺 ' + c + ' 公分') : (m + ' m ' + c + ' cm');
}
function fmtVal(v, lang){
  if (v.t === 'cm') return fmtCm(v.n, lang);
  if (v.t === 'm') return fmtM(v.n, lang);
  return fmtComp(v.m, v.c, lang);
}
/* 從畫面上真的會顯示的字串反推長度（前面可以有物品名稱：「書桌 80 公分」）。 */
function parseLen(s, lang){
  const t = String(s).trim();
  let m;
  if (lang === 'zh'){
    m = t.match(/(\d+)\s*公尺\s*(\d+)\s*公分$/); if (m) return Number(m[1]) * 100 + Number(m[2]);
    m = t.match(/(\d+)\s*公尺$/); if (m) return Number(m[1]) * 100;
    m = t.match(/(\d+)\s*公分$/); if (m) return Number(m[1]);
    return null;
  }
  m = t.match(/(\d+)\s*m\s*(\d+)\s*cm$/); if (m) return Number(m[1]) * 100 + Number(m[2]);
  m = t.match(/(\d+)\s*cm$/); if (m) return Number(m[1]);
  m = t.match(/(\d+)\s*m$/); if (m) return Number(m[1]) * 100;
  return null;
}

/* 兩兩比對「換算成公分之後的值」—— simgen 的通用去重只比字串，
   在這一課會放過「100 公分」和「1 公尺」同時出現。 */
function distinctOpts(d){
  const vals = d.opts.map(cmOf);
  for (let i = 0; i < vals.length; i++){
    if (!Number.isFinite(vals[i])) return 'option ' + i + ' is not a length value';
    for (let j = i + 1; j < vals.length; j++){
      if (vals[i] === vals[j]) return 'two options are the same real length: ' + vals[i] + ' cm';
    }
  }
  return null;
}
function answerIs(d, cm){
  if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
  if (cmOf(d.correct) !== cm) return 'correct is ' + cmOf(d.correct) + ' cm, expected ' + cm + ' cm';
  return null;
}
function base(d, cm){ return distinctOpts(d) || answerIs(d, cm); }
/* 誘答不可以是題幹裡印出來的那幾個數字。 */
function noStemEcho(d, banned){
  for (let i = 0; i < d.opts.length; i++){
    if (i === d.ans) continue;
    if (banned.indexOf(cmOf(d.opts[i])) >= 0){
      return 'a distractor (' + cmOf(d.opts[i]) + ' cm) is copied straight out of the stem';
    }
  }
  return null;
}

/* 每個產生器的選項範圍（公分）。每一條都要寫得出「這個上限是怎麼算出來的」——
   隨手給一個大數等於沒有範圍檢查（2026-08-25 grade-2/numbers 的教訓）。 */
const RANGE = {
  /* 尺只到 15 公分，to ≤ 13、最大的誘答是 to+2 → 15。 */
  readRuler:       [1, 15],
  /* 正解 ≤ 11；最大的誘答是「頭尾相加」from+to ≤ 4+15 ＝ 19（那是真的會犯的錯，
     算出來本來就會超出尺長）。 */
  readRulerOffset: [1, 19],
  /* m ≤ 9，最大的誘答是「多一個 0」m×1000 ＝ 9000 公分。 */
  mToCm:           [1, 9000],
  /* 正解 m ≤ 9 公尺；最大的誘答是 m×10 ＝ 90 公尺 ＝ 9000 公分。 */
  cmToM:           [100, 9000],
  /* m ≤ 2、c ≤ 94 → 正解 ≤ 294；保底 n+10 ＝ 304。下限是誘答 CM(c)，c 最小 3。 */
  compoundToCm:    [3, 304],
  /* 最大的誘答是 (m+1) 公尺 c 公分 ≤ 3 公尺 95 公分 ＝ 395。 */
  cmToCompound:    [1, 395],
  /* a ≤ 68、b ≤ 39 → 和 ≤ 107；保底 sum+20 ＝ 127。
     下限留 1：誘答 a−b（用錯運算）可以小到個位數。 */
  addLength:       [1, 127],
  /* 最大的誘答是 a+b ≤ 96+34 ＝ 130。 */
  subLength:       [1, 130],
  /* 最大的誘答是 total+b ≤ 200+70 ＝ 270。 */
  meterMinus:      [1, 270],
  /* 最大的物品是 8 公尺，最大的誘答是 num×10 ＝ 80 公尺 ＝ 8000 公分。 */
  pickUnit:        [1, 8000],
  /* 四個長度都抽自 30~260 公分，選項就是那四個值本身。 */
  compareLength:   [30, 260]
};

/* C2-8：估測題的正解不能只靠 review.html 自己的物品表 —— 那等於自己比自己。
   這裡放一份設定檔自己的物品真值，索引和 review.html 的 OBJS 對齊。 */
const PICK_UNIT_TRUTH = [
  { unit:'cm', num:18 },   /* 一枝新鉛筆 */
  { unit:'cm', num:26 },   /* 課本的長邊 */
  { unit:'cm', num:75 },   /* 書桌的高度 */
  { unit:'cm', num:1  },   /* 小指的寬度 */
  { unit:'m',  num:2  },   /* 教室門的高度 */
  { unit:'m',  num:8  }    /* 教室的長邊 */
];

/* C2-1：三層題庫沒有答案神諭時，任何一個在範圍內的選項都會通過。
   這裡把每一題的正解（公分）獨立寫一次，中英共用 —— 改了選項或 ans 就會被抓到。 */
/* C2-6：哪幾題的題幹該畫出「被量的長條」，以及該畫多長（公分）。
   檢查腳本自己記著，所以「該畫卻沒畫」和「不該畫卻畫了」兩邊都會被抓到 ——
   只靠掃描渲染結果的話，樣式一改檢查就會靜靜失效。 */
const BANK_RULER = {
  qs:      { 1: 8 },
  qsBoost: { 0: 8 }
};

const BANK_EXPECTED = {
  qs:      [1, 8, 100, 200, 13, 200],
  qsAdv:   [55, 60, 125, 200],
  qsBoost: [8, 105]
};

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   2026-09-02 補上（issue #2）：這個設定檔**從來沒有讀過 q.why**，所以解釋裡
   寫錯的算式一路綠燈。量詞由這一課自己給 —— 共用清單漏掉某一課的量詞時，
   那一課的算式會多出一個假的運算元，而且是靜靜地多出來。 */
const arithLength = require('./lib/arith.js').makeArith({
  units: ["公分", "公尺", "個", "條", "枝", "根"],
  unitsEn: ["cm", "centimetres?", "centimeters?", "metres?", "meters?", "strings?", "sticks?"],
  conversions: {"公尺": 100, "公分": 1, "metre": 100, "metres": 100, "meter": 100, "meters": 100, "m": 100, "cm": 1, "centimetre": 1, "centimetres": 1}
});

const { canvasProblems } = require('./lib/canvas.js');

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/length */
  breaks: [
    /* --- review.html：選項的組法 --- */
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(out));\n    return { opts:opts, ans:(opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'the same real length',
      find:'      if (ok(c)){ seen[cmOf(c)] = true; out.push(c); }',
      replace:'      if (c !== null && c !== undefined){ out.push(c); }' },
    { file:'review', expect:'copied straight out of the stem',
      find:'      if (ban.indexOf(cmOf(v)) >= 0) return false;',
      replace:'      if (ban.indexOf(cmOf(v)) >= 0 && false) return false;' },
    /* review.html 的 cmOf 只被「去重」和「compareLength 選最大」用到 ——
       設定檔的不變條件有自己一套 cmOf，所以這一條的觀察點是比長短那一題。 */
    { file:'review', expect:'the correct option is not the longest',
      find:"    if (v.t === 'm') return v.n * 100;",
      replace:"    if (v.t === 'm') return v.n;" },
    /* --- review.html：格式化寫錯（這一條證明「正解字串不是自己比自己」） --- */
    { file:'review', expect:'opts[ans] != correct',
      find:"    if (v.t === 'm') return lang === 'zh' ? (v.n + ' 公尺') : (v.n + ' m');",
      replace:"    if (v.t === 'm') return lang === 'zh' ? (v.n + ' 公分') : (v.n + ' cm');" },
    { file:'review', expect:'bad option shape',
      find:"    return lang === 'zh' ? (v.m + ' 公尺 ' + v.c + ' 公分') : (v.m + ' m ' + v.c + ' cm');",
      replace:"    return lang === 'zh' ? (v.m + ' 公尺 ' + v.c) : (v.m + ' m ' + v.c);" },
    /* --- review.html：每一個產生器算錯 --- */
    { file:'review', expect:'correct is',
      find:'        var correct = CM(len);\n        var cands = [ CM(to), CM(from + to), CM(len + 1) ];',
      replace:'        var correct = CM(to);\n        var cands = [ CM(len), CM(from + to), CM(len + 1) ];' },
    { file:'review', expect:'n is not m*100 + c',
      find:'        var c = pickUnused([3,4,5,6,7,8,9,15,25,35,45,55,65,75,85,94], used);\n        var n = m * 100 + c;',
      replace:'        var c = pickUnused([3,4,5,6,7,8,9,15,25,35,45,55,65,75,85,94], used);\n        var n = m * 10 + c;' },
    { file:'review', expect:'not the right metres-and-centimetres split',
      find:'        var correct = COMP(m, c);',
      replace:'        var correct = COMP(c, m);' },
    { file:'review', expect:'correct != a + b',
      find:'        var sum = a + b;',
      replace:'        var sum = a - b;' },
    { file:'review', expect:'correct != m*100 - b',
      find:'        var total = m * 100;',
      replace:'        var total = m * 10;' },
    { file:'review', expect:'the correct option is not the longest',
      find:'        objs.forEach(function(o){ if (cmOf(o) > cmOf(best)) best = o; });',
      replace:'        objs.forEach(function(o){ if (cmOf(o) < cmOf(best)) best = o; });' },
    { file:'review', expect:'needs at least one length under 100 cm',
      find:'        var small = 30 + rand(14) * 5;',
      replace:'        var small = 130 + rand(14) * 5;' },
    { file:'review', expect:'why never mentions the answer number',
      find:"      zhWhy:'鉛筆放在尺上，大約從 0 量到 18，所以是 18 公分。',",
      replace:"      zhWhy:'鉛筆放在尺上量一量就知道了。'," },
    /* --- review.html：只有看渲染結果才看得到的兩類 --- */
    { file:'review', expect:'missing space between Chinese and a digit',
      find:"            ? '左邊對準 0，右邊對著 ' + d.to + ' → ' + (d.to - d.from) + ' 公分。'",
      replace:"            ? '左邊對準 0，右邊對著' + d.to + '→' + (d.to - d.from) + ' 公分。'" },
    { file:'review', expect:'doubled punctuation',
      find:"            : 'Left end on 0, right end at ' + d.to + ' → ' + (d.to - d.from) + ' cm.'",
      replace:"            : 'Left end on 0, right end at ' + d.to + ' → ' + (d.to - d.from) + ' cm..'" },
    /* --- index.html：範例資料、題庫與遊戲關卡 --- */
    { file:'index', expect:'opts[ans] does not equal to-from',
      find:"    { from:2, to:9,  icon:'🖊️', opts:[9, 7, 11],   ans:1 },",
      replace:"    { from:2, to:9,  icon:'🖊️', opts:[9, 7, 11],   ans:0 }," },
    { file:'index', expect:'the ruler drawn in the stem',
      find:"        { stem:'這枝鉛筆有多長？' + rulerSVG({ from:0, to:8, icon:'✏️', mark0:true }),\n          opts:['7 公分','9 公分','8 公分','8 公尺'], ans:2,",
      replace:"        { stem:'這枝鉛筆有多長？' + rulerSVG({ from:0, to:9, icon:'✏️', mark0:true }),\n          opts:['7 公分','9 公分','8 公分','8 公尺'], ans:2," },
    { file:'index', expect:'aUnit is m but a is not a whole number of metres',
      find:"    { op:'-', a:100, b:40, aUnit:'m'  }",
      replace:"    { op:'-', a:105, b:40, aUnit:'m'  }" },
    { file:'index', expect:'METER_MAX must be a whole number of METER_STEP blocks',
      find:'  var METER_MAX = 130;',
      replace:'  var METER_MAX = 135;' },
    { file:'index', expect:'ZERO_CASES needs a case that starts at 0',
      find:"    { from:0, to:9,  icon:'✏️' },",
      replace:"    { from:1, to:9,  icon:'✏️' }," },
    { file:'index', expect:'gWhys',
      find:"        '左邊對著 2，不是 0：9 － 2 ＝ 7 公分。',",
      replace:"        '左邊對著 2，不是 0：9 － 2 ＝ 8 公分。'," },
    /* --- 新加的守門條件也要各有一筆改壞版本（C2-7） --- */
    { file:'review', expect:'correct != a - b',
      find:'        var rest = a - b;',
      replace:'        var rest = a + b;' },
    { file:'review', expect:'cm is not a whole number of metres',
      find:'        var cm = m * 100;',
      replace:'        var cm = m * 100 + 1;' },
    { file:'review', expect:'outside 1~15',
      find:'          return (v >= 1 && v <= 15) ? CM(v) : null;\n        }, []);\n        return { from:0, to:to, icon:pick(PENS), correct:correct, opts:mix.opts, ans:mix.ans };',
      replace:'          return (v >= 1 && v <= 15) ? CM(v) : null;\n        }, []);\n        mix.opts[(mix.ans + 1) % 4] = CM(400);\n        return { from:0, to:to, icon:pick(PENS), correct:correct, opts:mix.opts, ans:mix.ans };' },
    { file:'review', expect:'but the checker says',
      find:"      zhAsk:'✏️ 一枝新鉛筆大約多長？',      enAsk:'✏️ About how long is a brand-new pencil?',",
      replace:"      zhAsk:'✏️ 一枝新鉛筆大約多長？',      enAsk:'✏️ About how long is a brand-new pencil?', num:19," },
    { file:'index', expect:"this lesson's ruler is 0~15 cm",
      find:'  var RULER_MAX = 15;',
      replace:'  var RULER_MAX = 16;' },
    { file:'index', expect:'the checker expects',
      find:"          opts:['100 公分','10 公分','1000 公分','50 公分'], ans:0,",
      replace:"          opts:['100 公分','10 公分','1000 公分','50 公分'], ans:3," },
    { file:'index', expect:'is not a valid option index',
      find:"          opts:['20 公尺','200 公尺','2 公尺','1 公尺'], ans:2,",
      replace:"          opts:['20 公尺','200 公尺','2 公尺','1 公尺'], ans:9," },
    { file:'index', expect:'cannot decode it',
      find:"      s = s.replace('<svg ', '<svg data-from=\"' + o.from + '\" data-to=\"' + o.to + '\" ');",
      replace:"      s = s.replace('<svg ', '<svg data-a=\"' + o.from + '\" data-b=\"' + o.to + '\" ');" },
    /* --- 第三輪審查後補的守門條件也要有改壞版本 --- */
    { file:'index', expect:'expected answers recorded',
      find:"        { stem:'200 公分是幾公尺？',\n          opts:['20 公尺','200 公尺','2 公尺','1 公尺'], ans:2,\n          why:'100 公分是 1 公尺，200 公分裡面有 2 個 100，所以是 2 公尺。' }",
      replace:"        { stem:'200 公分是幾公尺？',\n          opts:['20 公尺','200 公尺','2 公尺','1 公尺'], ans:2,\n          why:'100 公分是 1 公尺，200 公分裡面有 2 個 100，所以是 2 公尺。' },\n        { stem:'1 公分是幾公分？',\n          opts:['1 公分','2 公分','3 公分','4 公分'], ans:0, why:'一樣。' }" },
    { file:'index', expect:'no data-from/data-to for the checker to read',
      find:"      s = s.replace('<svg ', '<svg data-from=\"' + o.from + '\" data-to=\"' + o.to + '\" ');",
      replace:"      /* data-* 被拿掉了 */" },
    { file:'review', expect:'c is outside the draw pool (3~94)',
      find:'        var c = pickUnused([3,4,5,6,7,8,9,15,25,35,45,55,65,75,85,94], used);\n        var n = m * 100 + c;',
      replace:'        var c = pickUnused([3,4,5,6,7,8,9,15,25,35,45,55,65,75,85,95], used);\n        var n = m * 100 + c;' },
    { file:'index', expect:'does not know about',
      find:"        { stem:'1 公尺是幾公分？',",
      replace:"        { stem:'1 公尺是幾公分？' + rulerSVG({ from:0, to:5 })," },
    { file:'index', expect:'gHints2',
      find:"        '提示：左邊對著 4、右邊對著 13，要用減的。',",
      replace:"        '提示：左邊對著 4、右邊對著 12，要用減的。'," },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'接起來要用加的：8 ＋ 5 ＝ 13 公分。'",
      replace:"why:'接起來要用加的：8 ＋ 5 ＝ 14 公分。'" },
    { file:'index', expect:"arithmetic is wrong",
      find:"why:'1 公尺是 100 公分，100 ＋ 5 ＝ 105 公分，不是 15 公分。'",
      replace:"why:'1 公尺是 100 公分，100 ＋ 5 ＝ 106 公分，不是 15 公分。'" },
    { file:'index', expect:"px tall but",
      find:"    var h = rTop + rH + 4;",
      replace:"    var h = 1;" },
    { file:'index', expect:"px wide but",
      find:"    var w = padL + max * unit + padR;",
      replace:"    var w = padL + max * unit;" }
  ],

  sim: {
    /* simgen 的通用「誘答抄題幹」檢查在這一課永遠不會響：選項是「9 公分」，
       題幹的數字是「9」，字串比不到。所以每個「題幹裡真的印出數字」的產生器
       都要自己呼叫 noStemEcho。
       兩個讀尺的產生器不呼叫它，但理由不一樣：
       readRuler 從 0 開始，「讀另一端的數字」就是**正確解法**，正解本來就是那個數字；
       readRulerOffset 則是**刻意**把那個數字當誘答（沒對準 0 卻直接讀）。
       兩者的數字都畫在尺上而不是寫在題幹文字裡。 */
    stemEchoOk: {},

    INVARIANTS: {
      readRuler: d => {
        if (d.from !== 0) return 'why says it starts at 0, but from is ' + d.from;
        if (!(d.to >= 1 && d.to <= 15)) return 'to is outside the 0~15 ruler: ' + d.to;
        return base(d, d.to - d.from);
      },
      readRulerOffset: d => {
        if (d.from < 1) return 'why says it does NOT start at 0, but from is ' + d.from;
        if (d.to > 15) return 'to is off the 0~15 ruler: ' + d.to;
        if (d.to <= d.from) return 'the bar has no length (from ' + d.from + ', to ' + d.to + ')';
        return base(d, d.to - d.from);
      },
      mToCm: d => {
        if (!(d.m >= 1 && d.m <= 9)) return 'm outside the lesson range: ' + d.m;
        if (d.correct.t !== 'cm') return 'the answer must be written in centimetres';
        return base(d, d.m * 100) || noStemEcho(d, [d.m]);
      },
      cmToM: d => {
        if (d.cm !== d.m * 100) return 'cm is not a whole number of metres: ' + d.cm;
        if (!(d.m >= 2 && d.m <= 9)) return 'm outside the lesson range: ' + d.m;
        if (d.correct.t !== 'm') return 'the answer must be written in metres';
        /* 題幹印的是 d.cm，而正解剛好也是 d.cm 公分 —— noStemEcho 會跳過正解，
           所以這裡擋掉的是「把題幹的公分數原封不動當成公尺數」那種誘答。 */
        return base(d, d.m * 100) || noStemEcho(d, [d.cm]);
      },
      compoundToCm: d => {
        if (d.n !== d.m * 100 + d.c) return 'n is not m*100 + c (' + d.n + ')';
        if (!(d.c >= 3 && d.c <= 94)) return 'c is outside the draw pool (3~94): ' + d.c;
        if (!(d.m >= 1 && d.m <= 2)) return 'm must be 1~2, got ' + d.m;
        if (d.correct.t !== 'cm') return 'the answer must be written in centimetres only';
        /* 只擋 d.m：「1 公尺 25 公分」出現「1 公分」這種選項是沒有意義的。
           d.c（這裡是 25 公分）**刻意**留著 —— 那正是「把公尺整個忘掉」的迷思誘答，
           是這一題想抓的錯誤，不是抄題幹。 */
        return base(d, d.n) || noStemEcho(d, [d.m]);
      },
      cmToCompound: d => {
        if (d.n !== d.m * 100 + d.c) return 'n is not m*100 + c (' + d.n + ')';
        if (d.correct.t !== 'comp') return 'the answer must be written in metres and centimetres';
        if (d.correct.m !== Math.floor(d.n / 100) || d.correct.c !== d.n % 100){
          return 'correct is not the right metres-and-centimetres split of ' + d.n;
        }
        if (!(d.correct.c >= 1 && d.correct.c <= 99)) return 'the centimetre part must be 1~99';
        if (!(d.correct.m >= 1)) return 'a 0-metre compound form is not used in this lesson';
        if (!(d.m >= 1 && d.m <= 2)) return 'm must be 1~2, got ' + d.m;
        if (!(d.c >= 12 && d.c <= 95)) return 'c is outside the draw pool (12~95): ' + d.c;
        return base(d, d.n) || noStemEcho(d, [d.n]);
      },
      addLength: d => {
        if (!(d.a >= 12 && d.a <= 68)) return 'a outside the lesson range: ' + d.a;
        if (!(d.b >= 5 && d.b <= 39)) return 'b outside the lesson range: ' + d.b;
        if (d.a + d.b !== cmOf(d.correct)) return 'correct != a + b';
        if (d.a + d.b > 130) return 'the total is outside the lesson range';
        return base(d, d.a + d.b) || noStemEcho(d, [d.a, d.b]);
      },
      subLength: d => {
        if (!(d.a >= 42 && d.a <= 96)) return 'a outside the lesson range: ' + d.a;
        if (!(d.b >= 10 && d.b <= 34)) return 'b outside the lesson range: ' + d.b;
        if (d.a - d.b !== cmOf(d.correct)) return 'correct != a - b';
        if (d.a - d.b < 1) return 'nothing is left after cutting';
        return base(d, d.a - d.b) || noStemEcho(d, [d.a, d.b]);
      },
      meterMinus: d => {
        if (!(d.m >= 1 && d.m <= 2)) return 'm outside the lesson range: ' + d.m;
        if (!(d.b >= 10 && d.b <= 70)) return 'b outside the lesson range: ' + d.b;
        if (d.m * 100 - d.b !== cmOf(d.correct)) return 'correct != m*100 - b';
        if (!(d.b >= 1 && d.b < d.m * 100)) return 'you cannot cut off ' + d.b + ' cm here';
        return base(d, d.m * 100 - d.b) || noStemEcho(d, [d.b]);
      },
      pickUnit: d => {
        /* 正解不能只靠 review.html 的物品表 —— 拿設定檔自己的那一份比對。 */
        if (!Number.isInteger(d.idx) || d.idx < 0 || d.idx >= PICK_UNIT_TRUTH.length){
          return 'object index ' + d.idx + ' is outside the checker catalogue (0~' + (PICK_UNIT_TRUTH.length - 1) + ')';
        }
        const truth = PICK_UNIT_TRUTH[d.idx];
        if (d.obj.unit !== truth.unit || d.obj.num !== truth.num){
          return 'object ' + d.idx + ' is ' + d.obj.num + ' ' + d.obj.unit +
                 ', but the checker says ' + truth.num + ' ' + truth.unit;
        }
        const want = truth.unit === 'cm' ? truth.num : truth.num * 100;
        if (d.correct.t !== truth.unit) return 'correct uses the wrong unit for this object';
        /* 解釋一定要說出那個數字，不然「大約多長」等於沒回答。 */
        if (d.obj.zhWhy.indexOf(String(d.obj.num)) < 0) return 'the zh why never mentions the answer number';
        if (d.obj.enWhy.indexOf(String(d.obj.num)) < 0) return 'the en why never mentions the answer number';
        return base(d, want);
      },
      compareLength: d => {
        if (d.opts.length !== 4) return 'compareLength must offer 4 lengths';
        const vals = d.opts.map(cmOf);
        const max = Math.max.apply(null, vals);
        if (vals.filter(v => v === max).length !== 1) return 'there is no single longest length';
        if (cmOf(d.correct) !== max) return 'the correct option is not the longest';
        if (d.opts[d.ans] !== d.correct) return 'opts[ans] is not the correct value object';
        /* 至少要有一個 100 公分以上、一個 100 公分以下，這一題才真的需要換算。 */
        if (!vals.some(v => v >= 100)) return 'compareLength needs at least one length of 100 cm or more';
        if (!vals.some(v => v < 100)) return 'compareLength needs at least one length under 100 cm';
        return distinctOpts(d);
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不呼叫 review.html 的 lenStr —— 拿產生器自己的格式化函式來比
       等於自己比自己（2026-08-25 time 那一課的教訓）。 */
    expectedCorrect: function(d, genId, lang){
      switch (genId){
        case 'readRuler':
        case 'readRulerOffset': return fmtCm(d.to - d.from, lang);
        case 'mToCm':           return fmtCm(d.m * 100, lang);
        case 'cmToM':           return fmtM(d.cm / 100, lang);
        case 'compoundToCm':    return fmtCm(d.m * 100 + d.c, lang);
        case 'cmToCompound':    return fmtComp(Math.floor(d.n / 100), d.n % 100, lang);
        case 'addLength':       return fmtCm(d.a + d.b, lang);
        case 'subLength':       return fmtCm(d.a - d.b, lang);
        case 'meterMinus':      return fmtCm(d.m * 100 - d.b, lang);
        case 'pickUnit': {
          /* 用設定檔自己的物品真值，不是 review.html 的 OBJS。 */
          const t = PICK_UNIT_TRUTH[d.idx] || { unit:'?', num:NaN };
          return t.unit === 'cm' ? fmtCm(t.num, lang) : fmtM(t.num, lang);
        }
        case 'compareLength': {
          let best = d.opts[0];
          d.opts.forEach(o => { if (cmOf(o) > cmOf(best)) best = o; });
          return fmtVal(best, lang);
        }
        default: return 'NO expectedCorrect FOR ' + genId;
      }
    },

    /* 選項長什麼樣：一定帶單位，而且落在這一課自己的範圍裡。
       正解與誘答用同一組規則 —— 這一課沒有「刻意畫錯的選項」。 */
    optionOk: function(s, genId, lang){
      const t = String(s);
      if (/[·#]/.test(t)) return 'junk option ' + t;
      const shapes = lang === 'zh'
        ? [/^\d+ 公分$/, /^\d+ 公尺$/, /^\d+ 公尺 \d+ 公分$/]
        : [/^\d+ cm$/, /^\d+ m$/, /^\d+ m \d+ cm$/];
      if (!shapes.some(re => re.test(t))) return 'bad option shape: ' + t;
      const comp = lang === 'zh' ? t.match(/^(\d+) 公尺 (\d+) 公分$/) : t.match(/^(\d+) m (\d+) cm$/);
      if (comp){
        if (!(Number(comp[2]) >= 1 && Number(comp[2]) <= 99)) return 'the centimetre part of ' + t + ' must be 1~99';
        if (!(Number(comp[1]) >= 1)) return 'the metre part of ' + t + ' must be at least 1';
      }
      const cm = parseLen(t, lang);
      if (cm === null) return 'cannot read a length out of ' + t;
      const bounds = RANGE[genId] || [1, 400];
      if (!(cm >= bounds[0] && cm <= bounds[1])){
        return 'option ' + t + ' is ' + cm + ' cm, outside ' + bounds[0] + '~' + bounds[1];
      }
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{RULER_MAX, RULER_TARGET, ZERO_CASES, METER_STEP, METER_MAX, CALC_CASES, ROUNDS, rulerSVG}',
    check: function(data, I18N, fail){
      /* --- 這一課的常數：釘死，不然改了也沒人會發現 --- */
      if (data.RULER_MAX !== 15) fail(`RULER_MAX is ${data.RULER_MAX}; this lesson's ruler is 0~15 cm`);
      if (data.METER_STEP !== 10) fail(`METER_STEP is ${data.METER_STEP}; example 3 is built from 10 cm blocks`);

      /* --- 範例 1：一格一格量到 RULER_TARGET --- */
      if (!(data.RULER_TARGET >= 1 && data.RULER_TARGET <= data.RULER_MAX)){
        fail(`RULER_TARGET ${data.RULER_TARGET} does not fit on a 0~${data.RULER_MAX} ruler`);
      }
      ['zh','en'].forEach(L => {
        const t = I18N[L].r1Step(data.RULER_TARGET - 1);
        if (/undefined|NaN/.test(t)) fail(`r1Step ${L}: ${t}`);
        if (t.indexOf(String(data.RULER_TARGET - 1)) < 0) fail(`r1Step ${L} never prints the count`);
      });

      /* --- 範例 2：左邊對準 0 與沒對準 0 都要有 --- */
      if (!data.ZERO_CASES.some(c => c.from === 0)) fail('ZERO_CASES needs a case that starts at 0');
      if (!data.ZERO_CASES.some(c => c.from > 0)) fail('ZERO_CASES needs a case that does NOT start at 0');
      data.ZERO_CASES.forEach((c, i) => {
        if (c.to <= c.from) fail(`ZERO_CASES[${i}] has no length`);
        if (c.to > data.RULER_MAX) fail(`ZERO_CASES[${i}] runs off the ruler (to=${c.to})`);
        if (c.from < 0) fail(`ZERO_CASES[${i}] starts before 0`);
        ['zh','en'].forEach(L => {
          const line = I18N[L].z3(c.from, c.to, c.to - c.from);
          if (/undefined|NaN/.test(line)) fail(`z3 ${L} case ${i}: ${line}`);
          /* 結論那一行一定要印出答案，而且沒對準 0 的時候要真的出現相減。 */
          if (line.indexOf(String(c.to - c.from)) < 0) fail(`z3 ${L} case ${i} never prints the length`);
          if (c.from > 0 && line.indexOf(String(c.from)) < 0){
            fail(`z3 ${L} case ${i} never mentions the start number ${c.from}`);
          }
          const z1 = I18N[L].z1(c.from);
          if (/undefined|NaN/.test(z1)) fail(`z1 ${L} case ${i}: ${z1}`);
        });
      });

      /* --- 範例 3：10 公分一段，接到 1 公尺再多接幾段 --- */
      if (data.METER_MAX % data.METER_STEP !== 0){
        fail(`METER_MAX must be a whole number of METER_STEP blocks (${data.METER_MAX} / ${data.METER_STEP})`);
      }
      if (100 % data.METER_STEP !== 0) fail('METER_STEP must divide 100, otherwise 1 metre is never reached exactly');
      if (data.METER_MAX <= 100) fail('METER_MAX must go past 100 so both ways of writing it show up');
      ['zh','en'].forEach(L => {
        const over = data.METER_MAX;
        const line = I18N[L].mOver(over, over - 100);
        if (/undefined|NaN/.test(line)) fail(`mOver ${L}: ${line}`);
        if (line.indexOf(String(over - 100)) < 0) fail(`mOver ${L} never prints the leftover centimetres`);
        if (I18N[L].mHundred.indexOf('100') < 0) fail(`mHundred ${L} never prints 100`);
      });

      /* --- 範例 4：接起來、剪掉 --- */
      let sawPlus = false, sawMinus = false, sawMeter = false;
      data.CALC_CASES.forEach((c, i) => {
        if (c.op !== '+' && c.op !== '-') fail(`CALC_CASES[${i}] has an unknown op ${c.op}`);
        if (c.op === '+') sawPlus = true; else sawMinus = true;
        if (c.aUnit !== 'cm' && c.aUnit !== 'm') fail(`CALC_CASES[${i}] has an unknown aUnit ${c.aUnit}`);
        if (c.aUnit === 'm'){
          sawMeter = true;
          if (c.a % 100 !== 0) fail(`CALC_CASES[${i}] aUnit is m but a is not a whole number of metres (${c.a})`);
        }
        const res = c.op === '+' ? c.a + c.b : c.a - c.b;
        if (res < 1) fail(`CALC_CASES[${i}] leaves ${res} cm`);
        if (res > 300) fail(`CALC_CASES[${i}] result ${res} is outside the lesson range`);
        ['zh','en'].forEach(L => {
          const c1 = I18N[L].c1(c), c2 = I18N[L].c2(c), c3 = I18N[L].c3(c, res);
          [c1, c2, c3].forEach(s => { if (/undefined|NaN/.test(s)) fail(`CALC_CASES[${i}] ${L}: ${s}`); });
          if (c3.indexOf(String(res)) < 0) fail(`CALC_CASES[${i}] ${L}: the result line never prints ${res}`);
          if (c2.indexOf(String(c.b)) < 0) fail(`CALC_CASES[${i}] ${L}: the second step never prints ${c.b}`);
          /* 公尺的那一例一定要把換算講出來，不然孩子看不到 100 是哪裡來的。 */
          if (c.aUnit === 'm' && c1.indexOf(String(c.a)) < 0){
            fail(`CALC_CASES[${i}] ${L}: the metre case never shows the ${c.a} cm conversion`);
          }
          const chip = I18N[L].calcChip(c);
          if (/undefined|NaN/.test(chip)) fail(`calcChip ${L} case ${i}: ${chip}`);
        });
      });
      if (!sawPlus) fail('CALC_CASES needs an addition case');
      if (!sawMinus) fail('CALC_CASES needs a subtraction case');
      if (!sawMeter) fail('CALC_CASES needs a case whose first length is written in metres');

      /* --- 遊戲關卡 --- */
      data.ROUNDS.forEach((r, i) => {
        const len = r.to - r.from;
        if (r.from < 0 || r.to > data.RULER_MAX) fail(`ROUND ${i+1} runs off the 0~${data.RULER_MAX} ruler`);
        if (len < 1) fail(`ROUND ${i+1} has no length`);
        if (r.opts.length !== 3) fail(`ROUND ${i+1} should offer 3 options, has ${r.opts.length}`);
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i+1} has duplicate options`);
        if (r.opts[r.ans] !== len) fail(`ROUND ${i+1}: opts[ans] does not equal to-from (${r.opts[r.ans]} vs ${len})`);
        /* 一關裡最大的合理誘答只有兩種：多數一格（to+1）或頭尾相加（from+to）。
           給一個固定的 30 等於沒有上限。 */
        const optMax = Math.max(r.to + 1, r.from + r.to);
        r.opts.forEach(o => {
          if (!(o >= 1 && o <= optMax)) fail(`ROUND ${i+1}: option ${o} is outside 1~${optMax} cm`);
        });
        ['zh','en'].forEach(L => {
          const why = I18N[L].gWhys[i], hint = I18N[L].gHints2[i];
          if (!why || !hint){ fail(`ROUND ${i+1}: missing ${L} hint/why`); return; }
          const unit = L === 'zh' ? ' 公分' : ' cm';
          if (why.indexOf(len + unit) < 0) fail(`ROUND ${i+1} ${L}: gWhys never states the answer "${len}${unit}"`);
          if (why.indexOf(String(r.to)) < 0) fail(`ROUND ${i+1} ${L}: gWhys never mentions the end number ${r.to}`);
          if (r.from > 0){
            if (why.indexOf(String(r.from)) < 0) fail(`ROUND ${i+1} ${L}: gWhys never mentions the start number ${r.from}`);
            if (hint.indexOf(String(r.from)) < 0) fail(`ROUND ${i+1} ${L}: gHints2 never mentions the start number ${r.from}`);
            if (hint.indexOf(String(r.to)) < 0) fail(`ROUND ${i+1} ${L}: gHints2 never mentions the end number ${r.to}`);
          }
        });
      });
      if (data.ROUNDS.map(r => r.ans).every(x => x === 0)) fail('every game round has the answer first');
      if (!data.ROUNDS.some(r => r.from === 0)) fail('ROUNDS needs at least one round that starts at 0');
      if (!data.ROUNDS.some(r => r.from > 0)) fail('ROUNDS needs at least one round that does NOT start at 0');

      /* --- 三層題庫：選項一律是長度，換算成公分之後不可以有兩個一樣 --- */
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        /* 神諭表的長度要等於題庫長度 —— 只比對「有的題目」的話，
           刪掉一題不會有人發現（多的那筆神諭永遠不會被讀到）。 */
        const oracle = BANK_EXPECTED[bank] || [];
        if ((I18N.zh[bank] || []).length !== oracle.length){
          fail(`${bank}: ${(I18N.zh[bank] || []).length} questions but ${oracle.length} expected answers recorded`);
        }
        /* BANK_RULER 也一樣：留著一筆指向已刪除題目的設定等於什麼都沒驗。 */
        Object.keys(BANK_RULER[bank] || {}).forEach(k => {
          if (!(I18N.zh[bank] || [])[Number(k)]) fail(`BANK_RULER.${bank}[${k}] points at a question that no longer exists`);
        });
        ['zh','en'].forEach(L => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const cms = q.opts.map(o => parseLen(o, L));
            if (cms.some(v => v === null)){
              fail(`${bank}[${i}] ${L}: an option is not a length (${q.opts.join(' / ')})`);
              return;
            }
            for (let a = 0; a < cms.length; a++){
              for (let b = a + 1; b < cms.length; b++){
                if (cms[a] === cms[b]){
                  fail(`${bank}[${i}] ${L}: "${q.opts[a]}" and "${q.opts[b]}" are the same real length`);
                }
              }
            }
            /* ans 先驗合法，否則 cms[q.ans] 會是 undefined，而 undefined > 800 是 false ——
               題目整個沒有被驗到卻是綠的。 */
            if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length){
              fail(`${bank}[${i}] ${L}: ans ${q.ans} is not a valid option index`);
              return;
            }
            /* 上限 20000 公分來自 qs[5] 刻意的「200 公尺」誘答（把公分讀成公尺）。 */
            cms.forEach((v, k) => {
              if (!(v >= 1 && v <= 20000)) fail(`${bank}[${i}] ${L}: option "${q.opts[k]}" is ${v} cm, out of range`);
            });
            if (cms[q.ans] > 800){
              fail(`${bank}[${i}] ${L}: the correct answer ${cms[q.ans]} cm is outside what this lesson measures`);
            }
            /* 答案神諭：正解的公分數要等於設定檔自己寫下的那一份，中英共用。
               沒有這一條的話，任何一個在範圍內的選項被標成正解都會通過。 */
            const want = (BANK_EXPECTED[bank] || [])[i];
            if (typeof want !== 'number'){
              fail(`${bank}[${i}]: no expected answer recorded in the checker`);
            } else if (cms[q.ans] !== want){
              fail(`${bank}[${i}] ${L}: marked answer is ${cms[q.ans]} cm, the checker expects ${want} cm`);
            }
            /* 「哪一個最長」的題目，標為正解的那一個一定要真的是最長的。 */
            const asksLongest = L === 'zh' ? /最長/.test(q.stem) : /longest/i.test(q.stem);
            if (asksLongest && cms[q.ans] !== Math.max.apply(null, cms)){
              fail(`${bank}[${i}] ${L}: asks for the longest, but the marked answer is not the largest`);
            }
            /* 題幹裡畫出來的那把尺，長度一定要等於標為正解的那個長度。
               （只驗資料不夠：選項改了、圖沒改，靜態檢查是看不出來的。） */
            const bar = /data-from="(\d+)" data-to="(\d+)"/.exec(q.stem);
            const wantDrawn = (BANK_RULER[bank] || {})[i];
            /* 第二個、和 data-* 無關的偵測器：被量的長條是畫在尺上方的矩形
               （y="16" height="30"）。有這種矩形卻沒有 data-*，表示那張圖
               不是 rulerSVG 畫的，或 rulerSVG 不再輸出座標 —— 兩種都要噴錯，
               不能因為「這一題本來就不在 BANK_RULER 裡」而靜靜放過。 */
            if (/<rect[^>]*y="16"[^>]*height="30"/.test(q.stem) && !bar){
              fail(`${bank}[${i}] ${L}: the stem draws a measured bar with no data-from/data-to for the checker to read`);
            }
            if (typeof wantDrawn === 'number' && !bar){
              fail(`${bank}[${i}] ${L}: this question is supposed to draw a measured bar, but the checker cannot decode it — did rulerSVG stop emitting data-from/data-to?`);
            } else if (typeof wantDrawn !== 'number' && bar){
              fail(`${bank}[${i}] ${L}: the stem draws a measured bar the checker does not know about — add it to BANK_RULER`);
            } else if (bar){
              const from = Number(bar[1]), to = Number(bar[2]);
              const drawn = to - from;
              if (from < 0 || to > data.RULER_MAX){
                fail(`${bank}[${i}] ${L}: the bar runs from ${from} to ${to}, off the 0~${data.RULER_MAX} ruler`);
              }
              if (drawn !== wantDrawn){
                fail(`${bank}[${i}] ${L}: the ruler drawn in the stem is ${drawn} cm, the checker expects ${wantDrawn} cm`);
              }
              if (drawn !== cms[q.ans]){
                fail(`${bank}[${i}] ${L}: the ruler drawn in the stem is ${drawn} cm, but the marked answer is ${cms[q.ans]} cm`);
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
                    const r = arithLength(text);
                    vSum += r.verified; qSum += r.questions;
                    r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
                  });
                });
              });
            });
            if (vSum !== 13) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 13`);
            if (qSum !== 0) fail(`question-shaped equations changed: found ${qSum}, expected 0`);
            /* 宣告過卻沒對上的「刻意寫錯」是一個永遠擋著的洞。 */
            arithLength.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
            /* ⚠️ 「刻意寫錯」是整課通用的放行。同一條錯式子跑到別的地方去也會
               被一起放行 —— 所以連「放行了幾次」都要釘住。 */
            {
              const want = {};
              const got = arithLength.excuseCounts();
              Object.keys(want).forEach(k => {
                if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
              });
            }
            /* ⚠️ 只釘「驗過幾條」擋不住「拿掉一條、再補一條」：數字一樣，
               驗的卻是別的宣稱。所以把**驗過的每一條算式本身**排序後做指紋。 */
            {
              const list = arithLength.verifiedAll();
              const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
              if (digest !== 'b044e4cc2a53'){
                fail(`the set of verified equations changed (digest ${digest}, expected b044e4cc2a53)\n      now: ${list.join(' | ')}`);
              }
            }
          }


          /* --- 圖畫不畫得下（issue #2：這一課本來完全沒有幾何檢查） ---
             實作在 tools/checks/lib/canvas.js（全站唯一一份），四個邊都驗。 */
          /* ⚠️ rulerSVG 收的是**選項物件**，不是數字。傳數字進去的話 `o.max`
             永遠是 undefined，每一次都畫出同一張圖 —— 看起來跑了十幾次，
             其實只驗過一種輸入。要照頁面真正的用法涵蓋整個範圍。 */
          {
            const shots = [];
            for (let to = 0; to <= data.RULER_MAX; to++){
              shots.push([`from0-to${to}`, { from:0, to:to, icon:'✏️', mark0:true }]);
              for (let from = 0; from < to; from++) shots.push([`from${from}-to${to}`, { from:from, to:to, icon:'🖍️' }]);
            }
            shots.push(['max8-unit34', { max:8, unit:34 }]);
            data.ROUNDS.forEach((r, i) => shots.push([`round${i+1}`, { from:r.from, to:r.to, icon:r.icon, mark0:true }]));
            shots.forEach(([label, o]) => {
              canvasProblems(data.rulerSVG(o)).forEach(m => fail(`rulerSVG(${label}): ${m}`));
            });
            if (shots.length < data.RULER_MAX) fail(`rulerSVG canvas check only covered ${shots.length} drawings`);
          }

    }
  }
};
