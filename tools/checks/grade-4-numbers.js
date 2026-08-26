/* grade-4/math/numbers（大數：萬、十萬、百萬、千萬、億）的檢查設定。

   範圍取自課程自己說的話：`index.html` 的資料區寫著「這一課的數字最多九位數
   （到 9 億多）」，`parents.html` 也對家長講了同一句，所以上限是 999999999，
   不是隨手給一個寬鬆的大數。

   這一課有兩個別課沒有的守門重點：
   ① **位名一律從右邊數起** —— 課程、速查卡、家長頁三頁都在教這條規則，
      產生器的題幹與解釋也靠它。所以位名表在這裡再寫一份（真值表），
      拿去和字典逐字比對；拿字典比字典等於自己比自己。
   ② **中文讀法** —— `toChineseBig()` 是這一課唯一「會算出一串字」的函式。
      神諭必須把它**跑起來**（每一個 READ_NUMS ＋ 三條補零規則的邊界），
      而期望值是手寫的，不是讓它自己回答自己。 */

const MAXN = 999999999;          // 九位數，課程自己宣告的上限
const P = [1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000];

/* 位名真值表（index 0 ＝ 個位）—— 和 index.html／review.html 的字典各自獨立。 */
const PLACES = {
  zh: ['個位','十位','百位','千位','萬位','十萬位','百萬位','千萬位','億位'],
  en: ['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','millions','ten-millions','hundred-millions']
};
/* 「幾個X」用的單位詞真值表。 */
const UNITS = {
  zh: ['一','十','百','千','萬','十萬','百萬','千萬','億'],
  en: ['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','millions','ten-millions','hundred-millions']
};

/* 中文讀法的期望值：**手寫**，不是從 toChineseBig 抄回來的。
   前五筆是 READ_NUMS（畫面上真的會出現的），後面是補零三條規則的邊界：
   ① 億級有值＋萬級不滿 1000 → 零   ② 億級有值＋萬級整節是 0 → 零
   ③ 上面有值＋個級不滿 1000 → 零   ＋「十」與「一十」的分界。 */
const READ_EXPECTED = {
  350020:    '三十五萬零二十',
  30040000:  '三千零四萬',
  100010000: '一億零一萬',
  60000700:  '六千萬零七百',
  90000000:  '九千萬',
  /* --- 邊界 --- */
  0:         '零',
  5:         '五',
  10:        '十',
  15:        '十五',
  115:       '一百一十五',
  1015:      '一千零一十五',
  3005:      '三千零五',
  10000:     '一萬',
  100000:    '十萬',
  150000:    '十五萬',
  1150000:   '一百一十五萬',
  1000000:   '一百萬',
  10000000:  '一千萬',
  100000000: '一億',
  100000001: '一億零一',
  100001000: '一億零一千',
  100200000: '一億零二十萬',
  120000000: '一億二千萬',
  123456789: '一億二千三百四十五萬六千七百八十九',
  305040000: '三億零五百零四萬',
  400300000: '四億零三十萬',
  400030000: '四億零三萬',
  47530000:  '四千七百五十三萬',
  999999999: '九億九千九百九十九萬九千九百九十九'
};

/* 每個產生器的選項範圍。沒列到的走預設 1~MAXN。
   digitOf 問的是「某一位的數字」，答案與誘答都只能是 0~9；
   howManyWan 問的是「幾個萬」，最多 99999 個（因為整個數最多九位）；
   unitSwap 問的是「幾個小一格的單位」，1~9 換過去最多 90。 */
const RANGE = { digitOf: [0, 9], howManyWan: [1, 99999], unitSwap: [1, 1000] };

/* 從 n 直接挖出第 pos 位的數字（不看產生器留下的 digs）。 */
function digitAt(n, pos){ return Math.floor(n / P[pos]) % 10; }

const fs = require('fs');
const path = require('path');

/* 三層題庫的第二套實作（codex 審查 #1）。`verify_lesson_data.js` 內建的算術重算
   只認得「a ＋ b ＝ ?」那種題幹，這一課一題都不符合 —— 也就是說在這之前，
   把 ans:2 改成 ans:0 是**完全不會被抓到**的。
   每一題記兩件事：題幹裡一定要出現的數字（位置式神諭擋不住「把 47530000 改成
   47531000」），以及**從那些數字重算一次**的正解字串。 */
/* 從題幹把「數字＋單位」的組合抓出來（中文「N 個X」，英文「N X」）。
   單位詞互為子字串（萬 ⊂ 十萬、millions ⊂ hundred-millions），所以由長到短掃，
   抓到就把那一段挖掉，避免同一個數字被兩個單位重複認領。 */
function unitPairs(stem, L){
  const order = UNITS[L].map((w, i) => ({ w:w, i:i }))
                        .sort((a, b) => b.w.length - a.w.length);
  let rest = stem;
  const found = [];
  order.forEach(u => {
    /* 邊界：中文的「3 個萬位數字」裡的「萬」是位名不是單位，所以單位後面
       不可以緊接著「位」；英文要求單位後面是非字母（第三輪 codex #5）。 */
    const pat = L === 'zh' ? '(\\d+)\\s*個' + u.w + '(?!位)'
                           : '(\\d+)\\s+' + u.w.replace(/-/g, '\\-') + '(?![A-Za-z-])';
    const re = new RegExp(pat);
    let m;
    while ((m = rest.match(re))){
      const at = rest.indexOf(m[0]);
      found.push({ at:at, count:Number(m[1]), unit:u.i });
      rest = rest.slice(0, at) + ' '.repeat(m[0].length) + rest.slice(at + m[0].length);
    }
  });
  return found.sort((a, b) => a.at - b.at).map(f => [f.count, f.unit]);
}

/* 「哪一個最大／最小」的方向也要從題幹讀 —— 不然把題幹的「最大」改成「最小」，
   神諭還是照樣算最大值（第二輪 codex #2）。 */
function directionFromStem(stem, L){
  const big = (L === 'zh') ? '最大' : 'biggest';
  const small = (L === 'zh') ? '最小' : 'smallest';
  const hasBig = stem.indexOf(big) >= 0, hasSmall = stem.indexOf(small) >= 0;
  if (hasBig === hasSmall) return null;      // 兩個都有或都沒有 → 題幹不明確
  /* 否定句會把意思整個翻過來（「哪一個不是最大？」），關鍵字卻還在
     —— 判為不明確，讓它響（第三輪 codex #6）。 */
  if (/不是|沒有/.test(stem) || /\bnot\b/i.test(stem)) return null;
  return hasBig ? 'max' : 'min';
}

const BANK_EXPECTED = {
  qs: [
    { nums:[47530000], zh:'3',        en:'3',        calc: n => String(digitAt(n[0], 4)) },
    { nums:[7, 6],     zh:'76000000', en:'76000000', calc: n => String(n[0] * P[7] + n[1] * P[6]) },
    { nums:[350000],   zh:'35',       en:'35',       calc: n => String(n[0] / 10000) },
    /* 「1 億等於幾個萬」：中文題幹只印得出 1，所以常數寫在這裡，
       但仍然是獨立算的（10^8 ÷ 10^4），不是從課程抄回來的。 */
    /* 兩種語言的題幹都印出 100000000，所以從題幹的那個數重算。
       在這之前這裡是一個常數，把題幹改成「1 百萬等於幾個萬」也不會響。 */
    { nums:[1, 100000000], zh:'10000', en:'10000',  calc: n => String(Math.max.apply(null, n) / P[4]) },
    /* 「哪一個最大」：方向從題幹讀，值從選項重算。兩邊都不是寫死的。 */
    { nums:[],         zh:'10000000', en:'10000000', byDirection:true },
    { nums:[45002000, 45020000], zh:'萬位', en:'ten-thousands',
      calc: (n, L) => {
        const a = String(n[0]), b = String(n[1]);
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return PLACES[L][a.length - 1 - i];
        return 'no difference';
      } }
  ],
  qsAdv: [
    { nums:[2450000, 1550000], zh:'400', en:'400', calc: n => String((n[0] + n[1]) / 10000) },
    { nums:[3, 4], zh:'340000000', en:'340000000', calc: n => String(n[0] * P[8] + n[1] * P[7]) },
    { nums:[10000, 68, 3500], zh:'683500', en:'683500', calc: n => String(n[1] * n[0] + n[2]) },
    /* 兩個「數量＋單位」都從題幹解析出來再比大小；標籤是那三個選項的字面值。
       在這之前單位是寫死的，把題幹的「5 個百萬」改成「5 個億」也不會響。 */
    { nums:[5, 60], zh:'乙數', en:'B', compareUnits:true,
      labels:{ A:{ zh:'甲數', en:'A' }, B:{ zh:'乙數', en:'B' },
               EQ:{ zh:'一樣大', en:'They are equal' } } },
  ],
  qsBoost: [
    { nums:[30040000], zh:'0', en:'0', calc: n => String(digitAt(n[0], 5)) },
    { nums:[3, 30], zh:'一樣大', en:'They are the same', compareUnits:true,
      labels:{ A:{ zh:'3 個十萬比較大', en:'3 hundred-thousands is bigger' },
               B:{ zh:'30 個萬比較大',  en:'30 ten-thousands is bigger' },
               EQ:{ zh:'一樣大', en:'They are the same' } } }
  ]
};

/* 速查卡與家長頁在這之前**一條斷言都沒有**（codex 審查 #2）——
   三頁都在教「位名從右邊數起」，可是只有上課頁被驗過。
   這兩張表釘的是「規則的措辭」與「位名表的順序」。 */
const SIBLING_RULES = {
  'reference.html': {
    /* [文字, 至少要出現幾次]。中文字串在這些頁面上一定出現兩次 —— markup 的
       fallback 一次、字典一次。只要求「至少一次」的話，改掉其中一份仍然是綠的，
       而畫面上第一眼看到的正是 markup 那一份。 */
    must: [['位名一律從右邊數起', 2], ['從右邊數第幾位', 2],
           ['位名從右邊數，不是從左邊', 2], ['from the right', 1],
           ['從右邊每四位切一刀', 2],
           /* 第一輪審查修好的化聚規則 —— 「整個數 ÷ 10000」在除不盡時是假的，
              現在寫的是「商就是幾個萬」。誰在盯它？這一條。 */
           ['商就是幾個萬', 2], ['商就是幾個千', 2], ['the quotient is the count', 2]],
    forbid: ['位名從左邊數', '從左邊數第幾位', '位名一律從左邊數起'],
    /* 位名表在速查卡上是九個 td，順序必須由高到低。 */
    orderedZh: ['億位','千萬位','百萬位','十萬位','萬位','千位','百位','十位','個位']
  },
  'parents.html': {
    must: [['位名一律從右邊數起', 2],
           ['place names are always counted from the right', 1],
           ['從右邊每四位切成一節', 2],
           /* 第一輪審查修好的範圍聲明 —— 數線那一段確實會算「最靠近的整千萬」，
              所以這一頁不能再說「不教四捨五入取概數」，只能說不教它的算則。 */
           ['不教四捨五入取概數的算則', 2],
           ['does not cover the rounding procedure', 1]],
    forbid: ['位名一律從左邊數起', 'counted from the left',
             '不教四捨五入取概數，也不教', 'does not cover rounding, and does not cover'],
    orderedZh: null
  }
};

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-4/math/numbers */
  breaks: [
    /* ---------- review.html：產生器 ---------- */
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'correct is not the digit at that place',
      find:'        var correct = digs[pos];\n        var others = [];',
      replace:'        var correct = digs[(pos + 1) % 8];\n        var others = [];' },
    { file:'review', expect:'does not name the',
      find:"            ? d.n + ' 的' + t.places[d.pos] + '數字是多少？'",
      replace:"            ? d.n + ' 的' + t.places[(d.pos + 1) % 9] + '數字是多少？'" },
    { file:'review', expect:'stem does not print the number',
      find:"            : 'What is the ' + t.places[d.pos] + ' digit of ' + d.n + '?',",
      replace:"            : 'What is the ' + t.places[d.pos] + ' digit of ' + (d.n + 1) + '?'," },
    /* 最高位變成 0 的話 n 會少一位，所以**長度**那一條先響。
       `digs[7] < 1` 因此是一條到不了的守門條件（留著無害，但它沒有被證明過）。 */
    { file:'review', expect:'digitOf needs an 8-digit number',
      find:'        digs[7] = 1 + rand(9);',
      replace:'        digs[7] = 0;' },
    { file:'review', expect:'correct != dg * placeValue',
      find:'        var correct = dg * POW[pos];',
      replace:'        var correct = dg * POW[pos - 1];' },
    { file:'review', expect:'appears more than once',
      find:'        var digs = shuffle([0,1,2,3,4,5,6,7,8,9]).slice(0, 8);',
      replace:'        var digs = [1,1,2,2,3,3,4,4];' },
    { file:'review', expect:'valueOfDigit does not name the',
      find:"            ? d.dg + ' 站在' + t.places[d.pos] + '，表示 ' + d.dg + ' 個' + t.units[d.pos] + '，也就是 ' + d.correct + '。'",
      replace:"            ? d.dg + ' 站在' + t.places[(d.pos + 1) % 9] + '，表示 ' + d.dg + ' 個' + t.units[d.pos] + '，也就是 ' + d.correct + '。'" },
    { file:'review', expect:'correct != b * 1000000',
      find:'        var correct = b * POW[6];',
      replace:'        var correct = b * POW[5];' },
    { file:'review', expect:'the expansion does not add up to n',
      find:'        var n = a * POW[7] + b * POW[6] + c * POW[4];',
      replace:'        var n = a * POW[7] + b * POW[6] + c * POW[3];' },
    { file:'review', expect:'expandBlank stem does not print',
      find:"        stem: d.n + ' ＝ ' + (d.a * POW[7]) + ' ＋ ? ＋ ' + (d.c * POW[4]),",
      replace:"        stem: d.n + ' ＝ ' + (d.a * POW[6]) + ' ＋ ? ＋ ' + (d.c * POW[4])," },
    { file:'review', expect:'n != a * 10000',
      find:'        var n = a * 10000;\n        var cands = [a * 10, Math.floor(a / 10), a + 1, a - 1, a + 10];',
      replace:'        var n = a * 1000;\n        var cands = [a * 10, Math.floor(a / 10), a + 1, a - 1, a + 10];' },
    { file:'review', expect:'howManyWan stem does not print',
      find:"          stem: lang === 'zh' ? d.n + ' 裡面有幾個萬？' : 'How many ten-thousands are there in ' + d.n + '?',",
      replace:"          stem: lang === 'zh' ? (d.n + 1) + ' 裡面有幾個萬？' : 'How many ten-thousands are there in ' + (d.n + 1) + '?'," },
    { file:'review', expect:'correct != a * 10000',
      find:'        var correct = a * 10000;\n        var cands = [a * 1000, a * 100000, a, correct + 10000, correct - 10000];',
      replace:'        var correct = a * 100000;\n        var cands = [a * 1000, a * 100000, a, correct + 10000, correct - 10000];' },
    { file:'review', expect:'correct != a * 10000 + b',
      find:'        var correct = a * 10000 + b;',
      replace:'        var correct = a * 10000 + b * 10;' },
    { file:'review', expect:'the loose ones must stay under one ten-thousand',
      find:'        var b = 1 + rand(9999);',
      replace:'        var b = 10000 + rand(9999);' },
    { file:'review', expect:'correct != a * 10',
      find:'        var correct = a * 10;\n        var cands = [a, a * 100, correct + 10, correct - 10, a + 10];',
      replace:'        var correct = a * 100;\n        var cands = [a, a * 100, correct + 10, correct - 10, a + 10];' },
    { file:'review', expect:'unitSwap does not name the',
      find:"        var big = t.units[d.p], small = t.units[d.p - 1];",
      replace:"        var big = t.units[d.p], small = t.units[d.p - 2];" },
    { file:'review', expect:'biggest: correct is not the largest option',
      find:'        var correct = Math.max.apply(null, nums);',
      replace:'        var correct = Math.min.apply(null, nums);' },
    { file:'review', expect:'do not all share it',
      find:'        var nums = tails.map(function(x){ return h * POW[7] + x; });',
      replace:'        var nums = tails.map(function(x){ return (1 + ((h + x) % 9)) * POW[7] + x; });' },
    { file:'review', expect:'smallest: correct is not the smallest option',
      find:'        var correct = Math.min.apply(null, nums);',
      replace:'        var correct = Math.max.apply(null, nums);' },
    { file:'review', expect:'the two 7-digit numbers tie there',
      find:'        var m2 = m1 + 1 + rand(9 - m1);',
      replace:'        var m2 = m1;' },
    { file:'review', expect:'smallest needs exactly two 7-digit',
      find:'          var v = (1 + rand(9)) * POW[7] + rand(POW[7]);',
      replace:'          var v = (1 + rand(9)) * POW[6] + rand(POW[6]);' },
    { file:'review', expect:'correct != start + 30000',
      find:'        var correct = start + 30000;',
      replace:'        var correct = start + 20000;' },
    { file:'review', expect:'the skip-wan stem is not start',
      find:"        stem: d.start + '、' + (d.start + 10000) + '、' + (d.start + 20000) + '、?',",
      replace:"        stem: d.start + '、' + (d.start + 10000) + '、' + (d.start + 30000) + '、?'," },
    { file:'review', expect:'crossWan: correct != k * 10000',
      find:'        var n = k * 10000 - 2;\n        var correct = k * 10000;',
      replace:'        var n = k * 10000 - 2;\n        var correct = k * 10000 + 1;' },
    { file:'review', expect:'crossWan: n must be two below',
      find:'        var n = k * 10000 - 2;\n        var correct',
      replace:'        var n = k * 10000 - 22;\n        var correct' },
    { file:'review', expect:'the counting stem is not n',
      find:"        stem: d.n + '、' + (d.n + 1) + '、?',",
      replace:"        stem: d.n + '、' + (d.n + 2) + '、?'," },
    /* 把頁面的 MAXV 調大**不會**讓任何選項越界（候選本來就被產生器自己的算式
       綁住），所以那樣的改壞什麼都證明不了。要證明 `optionOk` 的範圍表，
       就得直接讓產生器吐出一個超出宣告範圍的選項。 */
    /* 而且光放寬候選也不夠 —— `makeWrongs` 自己也吃 lo/hi，越界的候選先被它濾掉，
       而且 digitOf 的 `others`（n 自己的其他位數）幾乎每次就湊滿三個誘答，
       放寬後面的 pool 根本輪不到。要真的打到 `optionOk` 的範圍表，
       就得讓**會被選中的那幾個候選**越界，同時放寬 `mixOpts` 的範圍參數。 */
    { file:'review', expect:'outside 0~9',
      find:'        var m = mixOpts(correct, others.concat(shuffle(pool)), 0, 9);',
      replace:'        var m = mixOpts(correct, others.map(function(x){ return x + 10; }), 0, 99);' },
    { file:'review', expect:'outside 1~99999',
      find:'        var m = mixOpts(a, shuffle(cands), 1, 99999);',
      replace:'        var m = mixOpts(a, cands.map(function(v){ return v * 1000; }), 1, 9999999);' },

    /* ---------- index.html：中文讀法、範例資料、遊戲關卡 ---------- */
    { file:'index', expect:'toChineseBig',
      find:"      if (i === 2 && d === 1 && !started && lead) s += '十';",
      replace:"      if (i === 2 && d === 1 && !started && lead) s += '一十';" },
    { file:'index', expect:'toChineseBig',
      find:'      if (s.yi > 0 && s.wan < 1000) out += CN[0];',
      replace:'      if (s.yi > 0 && s.wan < 100) out += CN[0];' },
    { file:'index', expect:'toChineseBig',
      find:'      if ((s.yi > 0 && s.wan === 0) || ((s.yi > 0 || s.wan > 0) && s.ge < 1000)) out += CN[0];',
      replace:'      if ((s.yi > 0 || s.wan > 0) && s.ge < 1000) out += CN[0];' },
    { file:'index', expect:'toChineseBig',
      find:'      if (d === 0){ if (started) zero = true; continue; }',
      replace:'      if (d === 0){ continue; }' },
    { file:'index', expect:'does not rebuild n',
      find:'    return { yi: Math.floor(n / 100000000), wan: Math.floor(n / 10000) % 10000, ge: n % 10000 };',
      replace:'    return { yi: Math.floor(n / 100000000), wan: Math.floor(n / 10000) % 1000, ge: n % 10000 };' },
    { file:'index', expect:'digitsOf',
      find:'    for (var i = 0; i < 9; i++) a.push(Math.floor(n / Math.pow(10, i)) % 10);',
      replace:'    for (var i = 0; i < 9; i++) a.push(Math.floor(n / Math.pow(10, i + 1)) % 10);' },
    { file:'index', expect:'pad4',
      find:"    while (s.length < 4) s = '0' + s;",
      replace:"    while (s.length < 3) s = '0' + s;" },
    { file:'index', expect:'PLACE_NUMS has no number with a 0 in the middle',
      find:'  var PLACE_NUMS = [47530000, 305040000, 60000700, 123456789];',
      replace:'  var PLACE_NUMS = [47531234, 315141234, 61112345, 123456789];' },
    { file:'index', expect:'PLACE_NUMS has no number reaching the',
      find:'  var PLACE_NUMS = [47530000, 305040000, 60000700, 123456789];\n',
      replace:'  var PLACE_NUMS = [47530000, 30504000, 60000700, 12345678];\n' },
    { file:'index', expect:'REGROUP_NUMS never reaches a hundred-million',
      find:'  var REGROUP_NUMS = [350000, 35000000, 7000000, 120000000];',
      replace:'  var REGROUP_NUMS = [350000, 35000000, 7000000, 12000000];' },
    { file:'index', expect:'is not a whole number of ten-thousands',
      find:'  var REGROUP_NUMS = [350000, 35000000, 7000000, 120000000];\n',
      replace:'  var REGROUP_NUMS = [350500, 35000000, 7000000, 120000000];\n' },
    /* 兩對位數不同的都要改掉 —— 只改一對的話，另一對（9999999 vs 10000000）
       會替它撐住那個性質，改壞測試就會靜靜地過。 */
    { file:'index', expect:'PAIRS has no pair with a different number of digits',
      find:'    { a:98765,     b:102345 },\n    { a:35002000,  b:35020000 },\n    { a:400300000, b:400030000 },\n    { a:9999999,   b:10000000 }',
      replace:'    { a:198765,    b:102345 },\n    { a:35002000,  b:35020000 },\n    { a:400300000, b:400030000 },\n    { a:19999999,  b:10000000 }' },
    { file:'index', expect:'PAIRS has no pair that ties on the leading digit',
      find:'    { a:35002000,  b:35020000 },\n    { a:400300000, b:400030000 },',
      replace:'    { a:35002000,  b:45020000 },\n    { a:400300000, b:500030000 },' },
    { file:'index', expect:'sits exactly halfway',
      find:'  var LINE_NUMS = [8000000, 34000000, 62000000, 93000000];',
      replace:'  var LINE_NUMS = [8000000, 35000000, 62000000, 93000000];' },
    { file:'index', expect:'outside the number line',
      find:'  var LINE_NUMS = [8000000, 34000000, 62000000, 93000000];\n',
      replace:'  var LINE_NUMS = [8000000, 34000000, 62000000, 130000000];\n' },
    { file:'index', expect:'the parts do not add up to',
      find:'      opts:[ [[350,4],[2000,0]], [[3500,4],[2000,0]], [[3500,4],[200,0]], [[35,4],[2000,0]] ], ans:1 },',
      replace:'      opts:[ [[350,4],[2000,0]], [[3500,4],[2000,0]], [[3500,4],[200,0]], [[35,4],[2000,0]] ], ans:0 },' },
    { file:'index', expect:'ROUNDS never reaches the ten-millions',
      find:'      opts:[ [[1,8],[10,4]], [[1,8],[1,4]], [[1,8],[1,3]], [[1,7],[1,4]] ], ans:1 },\n    { ask:\'toNumber\', parts:[[7,7]],\n      opts:[ 7000000, 700000000, 7000, 70000000 ], ans:3 }',
      replace:'      opts:[ [[1,6],[10,4]], [[1,6],[1,4]], [[1,6],[1,3]], [[1,5],[1,4]] ], ans:1 },\n    { ask:\'toNumber\', parts:[[7,5]],\n      opts:[ 70000, 7000000, 7000, 700000 ], ans:3 }' },
    { file:'index', expect:'duplicate option values',
      find:'      opts:[ 4800000, 48000, 480000, 480 ], ans:2 },',
      replace:'      opts:[ 480000, 48000, 480000, 480 ], ans:2 },' },
    { file:'index', expect:'above the lesson range',
      find:'      opts:[ 7000000, 700000000, 7000, 70000000 ], ans:3 }',
      replace:'      opts:[ 7000000, 7000000000, 7000, 70000000 ], ans:3 }' },
    { file:'index', expect:'a part count must be a positive integer',
      find:'    { ask:\'toNumber\', parts:[[48,4]],',
      replace:'    { ask:\'toNumber\', parts:[[0,4],[48,4]],' },
    { file:'index', expect:'place-name table says',
      find:"      places:['個位','十位','百位','千位','萬位','十萬位','百萬位','千萬位','億位'],",
      replace:"      places:['個位','十位','百位','千位','萬位','十萬位','千萬位','百萬位','億位']," },
    { file:'index', expect:'unit table says',
      find:"      units:['一','十','百','千','萬','十萬','百萬','千萬','億'],",
      replace:"      units:['一','十','百','千','萬','十萬','千萬','百萬','億']," },
    { file:'index', expect:'place-name table says',
      find:"      places:['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','millions','ten-millions','hundred-millions'],\n      units:",
      replace:"      places:['ones','tens','hundreds','thousands','ten-thousands','hundred-thousands','ten-millions','millions','hundred-millions'],\n      units:" },

    /* ---------- codex 審查之後補上的斷言，每一條都要有自己的改壞版 ---------- */
    /* #1 三層題庫的第二套實作：改答案索引、改題幹數字、改解釋，三種都要響。 */
    { file:'index', expect:'marked answer is',
      find:"        { stem:'47530000 的萬位數字是多少？', opts:['4','7','3','5'], ans:2,",
      replace:"        { stem:'47530000 的萬位數字是多少？', opts:['4','7','3','5'], ans:0," },
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'350000 裡面有幾個萬？', opts:['350','35','3500','5'], ans:1,",
      replace:"        { stem:'351000 裡面有幾個萬？', opts:['350','35','3500','5'], ans:1," },
    { file:'index', expect:'the explanation never states the answer',
      find:"          why:'7 個千萬是 70000000，6 個百萬是 6000000，合起來是 76000000。' },",
      replace:"          why:'7 個千萬是 70000000，6 個百萬是 6000000，合起來很大。' }," },
    /* #2 速查卡與家長頁的規則措辭。 */
    /* 字典那一份是唯一的（markup 那一份寫在 <th> 裡），改掉它會讓出現次數
       從 2 掉到 1，count-aware 的斷言就會響。 */
    { file:'reference', expect:'reference.html no longer says',
      find:"pth3:'從右邊數第幾位'",
      replace:"pth3:'從左邊數第幾位'" },
    { file:'reference', expect:'reference.html says',
      find:"      sw1:'位名從右邊數，不是從左邊',",
      replace:"      sw1:'位名從右邊數，不是從左邊（位名從左邊數）'," },
    { file:'reference', expect:'place table has',
      find:'          <td data-i18n="pn7">千萬位</td>\n          <td data-i18n="pn6">百萬位</td>',
      replace:'          <td data-i18n="pn6">百萬位</td>\n          <td data-i18n="pn7">千萬位</td>' },
    /* 同理：`"s1p1": "` 這個前綴只出現在字典那一份，markup 那一份是
       `<p data-i18n="s1p1">`。改掉字典那一份，次數從 2 掉到 1。 */
    { file:'parents', expect:'parents.html no longer says',
      find:'"s1p1": "這一課對應 108 課綱四年級「數與計算」的大數單元：萬、十萬、百萬、千萬到億的位值結構、化聚與比大小。孩子要學會四件事：說出每一位的位名（<strong>位名一律從右邊數起</strong>',
      replace:'"s1p1": "這一課對應 108 課綱四年級「數與計算」的大數單元：萬、十萬、百萬、千萬到億的位值結構、化聚與比大小。孩子要學會四件事：說出每一位的位名（<strong>位名要看清楚</strong>' },
    { file:'parents', expect:'parents.html no longer says',
      find:'<strong>place names are always counted from the right</strong>',
      replace:'<strong>place names matter</strong>' },
    /* #3 產生器的解釋必須印出正解。 */
    { file:'review', expect:'why never prints the correct answer',
      find:"            ? d.a + ' 個萬就是 ' + d.a + ' × 10000 ＝ ' + d.correct + '。'",
      replace:"            ? d.a + ' 個萬就是 ' + d.a + ' × 10000 ＝ ' + (d.correct + 1) + '。'" },
    /* #4 digitsOf 要逐位驗。回傳 [n,0,0,…] 仍然「組得回 n」。 */
    { file:'index', expect:'is not a digit',
      find:'    for (var i = 0; i < 9; i++) a.push(Math.floor(n / Math.pow(10, i)) % 10);\n    return a;',
      replace:'    a.push(n); for (var i = 1; i < 9; i++) a.push(0);\n    return a;' },
    /* #5 compareSteps 的 da/db 與 tie 步驟。 */
    { file:'index', expect:'deciding step says',
      find:"        steps.push({ kind:'digit', idx:i, place:sa.length - 1 - i, da:da, db:db, winner: da > db ? 'a' : 'b' });",
      replace:"        steps.push({ kind:'digit', idx:i, place:sa.length - 1 - i, da:0, db:9, winner: da > db ? 'a' : 'b' });" },
    { file:'index', expect:'tie at index',
      find:"      steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:da });",
      replace:"      steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:9 });" },
    /* #6 遊戲選項必須是整數，不然範圍比較會靜靜放行。 */
    { file:'index', expect:'non-integer value',
      find:'      opts:[ 4800000, 48000, 480000, 480 ], ans:2 },',
      replace:"      opts:[ 'banana', 48000, 480000, 480 ], ans:2 }," },
    /* #7 pad4 要比對補出來的字串，不是只比長度。 */
    { file:'index', expect:'pad4',
      find:"    var s = String(x);\n    while (s.length < 4) s = '0' + s;\n    return s;",
      replace:"    var s = String(x);\n    return '0000';" },

    /* ---------- 第二輪 codex 審查（審「修正本身」）之後補上的斷言 ---------- */
    /* R2#1 單位比較題的單位要從題幹解析：把「5 個百萬」改成「5 個億」，
       正解就該變成甲數，神諭必須跟著改口。 */
    { file:'index', expect:'recomputed',
      find:"        { stem:'文字題：甲數是 5 個百萬，乙數是 60 個十萬。哪一個比較大？',",
      replace:"        { stem:'文字題：甲數是 5 個億，乙數是 60 個十萬。哪一個比較大？'," },
    { file:'index', expect:'recomputed',
      find:"        { stem:'迷思檢查：「3 個十萬」和「30 個萬」，哪一個比較大？',",
      replace:"        { stem:'迷思檢查：「3 個百萬」和「30 個萬」，哪一個比較大？'," },
    /* R2#2 「最大／最小」的方向要從題幹讀。 */
    { file:'index', expect:'recomputed',
      find:"        { stem:'下面哪一個數最大？', opts:['10000000','9999999','9099999','9909999'], ans:0,",
      replace:"        { stem:'下面哪一個數最小？', opts:['10000000','9999999','9099999','9909999'], ans:0," },
    /* R2#3 「1 億等於幾個萬」要從題幹印出來的數算。改成「1 百萬」之後，
       先響的是「題幹沒有印出 100000000」那一條 —— 那正是把神諭綁回題幹的那一條，
       所以期望訊息就是它。（設定檔自己的 calc 改壞不了：breaktest 只改那四頁。） */
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'1 億（100000000）等於幾個萬？',",
      replace:"        { stem:'1 百萬（1000000）等於幾個萬？'," },
    /* R2#4 解釋比對要用數字 token：400 不可以被 4000000 收編。 */
    { file:'index', expect:'the explanation never states the answer',
      find:"          why:'先加起來：2450000 ＋ 1550000 ＝ 4000000；再換算：4000000 ÷ 10000 ＝ 400，所以是 400 個萬。' },",
      replace:"          why:'先加起來：2450000 ＋ 1550000 ＝ 4000000；再換算：4000000 ÷ 100000 ＝ 40。' }," },
    /* R2#5 比大小的步驟串要完整，不能整段 tie 消失。 */
    { file:'index', expect:'step shape is',
      find:"      steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:da });",
      replace:"      if (i > 900) steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:da });" },
    /* R2#6 剛修好的兩條規則要有人盯。 */
    { file:'reference', expect:'the required number of times',
      find:"h1b:'整個數 ÷ 10000，商就是幾個萬（除不盡時，餘數就是剩下的零頭）'",
      replace:"h1b:'整個數 ÷ 10000'" },
    { file:'parents', expect:'which contradicts the rule this lesson teaches',
      find:'這一課<strong>不教四捨五入取概數的算則，也不教大數的直式乘除</strong>——那是同年級後面的單元；數線那一段只做「大概在哪裡、比較靠近哪一個整千萬」的數感判讀，不需要用到四捨五入的規則。頁面上的數字最多九位數（到 9 億多），刻意<strong>不加千分位逗號</strong>，理由見下。</p>',
      replace:'這一課<strong>不教四捨五入取概數，也不教大數的直式乘除</strong>——那是同年級後面的單元。頁面上的數字最多九位數（到 9 億多），刻意<strong>不加千分位逗號</strong>，理由見下。</p>' },
    /* R2#7 遊戲的「數量」也要是整數，不然畫面上會出現「350.5 個萬」。 */
    { file:'index', expect:'a part count must be a positive integer',
      find:'      opts:[ [[350,4],[2000,0]], [[3500,4],[2000,0]], [[3500,4],[200,0]], [[35,4],[2000,0]] ], ans:1 },',
      replace:'      opts:[ [[350.5,4],[2000,0]], [[3500,4],[2000,0]], [[3500,4],[200,0]], [[35,4],[2000,0]] ], ans:1 },' },

    /* ---------- 第三輪 codex 審查（只審檢查工具）之後補上的斷言 ---------- */
    /* R3#1 題幹的數字要「剛好就是這些」：把舊的數字當成例子補回去也要被抓到。 */
    { file:'index', expect:'the oracle expects exactly',
      find:"        { stem:'47530000 的萬位數字是多少？', opts:['4','7','3','5'], ans:2,",
      replace:"        { stem:'47531000 的萬位數字是多少？（例：47530000）', opts:['4','7','3','5'], ans:2," },
    /* R3#1b 這一課刻意不印千分位逗號 —— 那條規則以前沒人在盯。 */
    { file:'index', expect:'thousands separator',
      find:"        { stem:'350000 裡面有幾個萬？', opts:['350','35','3500','5'], ans:1,",
      replace:"        { stem:'350,000 裡面有幾個萬？', opts:['350','35','3500','5'], ans:1," },
    /* R3#3 tie 步驟的 index 要成序列，不能每一步都指著同一位。 */
    { file:'index', expect:'tie indices are',
      find:"      steps.push({ kind:'tie', idx:i, place:sa.length - 1 - i, d:da });",
      replace:"      steps.push({ kind:'tie', idx:0, place:sa.length - 1, d:Number(sa[0]) });" },
    /* R3#7 compareSteps 回傳空陣列時要響亮地失敗，不是丟例外。 */
    { file:'index', expect:'returned no steps',
      find:"    var sa = String(a), sb = String(b), steps = [];",
      replace:"    var sa = String(a), sb = String(b), steps = []; if (a) return steps;" }
  ],

  sim: {
    /* fmt() 要印位名與單位詞，兩張表都宣告在「工具」那一段之前的 TXT 裡，
       所以把切片起點往前移到 TXT。那一段是純資料，不碰 DOM。 */
    blockStart: '  var TXT = {',

    /* 每個產生器一組「解釋說了什麼，資料就必須是那樣」的不變條件。
       能從 n 重算的一律從 n 重算 —— 只比產生器留下的中間變數等於自己比自己。 */
    INVARIANTS: {
      digitOf: d => {
        if (String(d.n).length !== 8) return 'digitOf needs an 8-digit number, got ' + d.n;
        if (d.pos < 4 || d.pos > 7) return 'pos out of the big-number places (4~7)';
        if (digitAt(d.n, d.pos) !== d.correct) return 'correct is not the digit at that place';
        if (d.correct < 0 || d.correct > 9) return 'a place digit must be 0~9';
        /* digs 是產生器自己留的，要和 n 對得起來，否則題幹與資料是兩回事。 */
        let rebuilt = 0;
        for (let i = 0; i < 8; i++) rebuilt += d.digs[i] * P[i];
        if (rebuilt !== d.n) return 'digs does not rebuild n';
        if (d.digs[7] < 1) return 'the top digit must not be 0';
      },
      valueOfDigit: d => {
        if (String(d.n).length !== 8) return 'valueOfDigit needs an 8-digit number, got ' + d.n;
        if (d.pos < 3 || d.pos > 7) return 'pos out of range (3~7)';
        if (digitAt(d.n, d.pos) !== d.dg)
          return 'dg ' + d.dg + ' is not the digit at position ' + d.pos + ' of ' + d.n;
        if (d.dg * P[d.pos] !== d.correct) return 'correct != dg * placeValue';
        if (d.dg < 1) return 'the stem reads "the D stands for" — D must not be 0';
        if (String(d.n).split('').filter(c => c === String(d.dg)).length !== 1)
          return 'the digit ' + d.dg + ' appears more than once in ' + d.n + ', so "the D" is ambiguous';
      },
      expandBlank: d => {
        if (d.n !== d.a * P[7] + d.b * P[6] + d.c * P[4]) return 'the expansion does not add up to n';
        if (d.correct !== d.b * P[6]) return 'correct != b * 1000000';
        if (d.a < 1 || d.b < 1 || d.c < 1) return 'a 0 term would print an empty slot the stem does not intend';
        if (d.n > MAXN) return 'n above the lesson range';
      },
      howManyWan: d => {
        if (d.n !== d.a * 10000) return 'n != a * 10000';
        if (d.correct !== Math.floor(d.n / 10000)) return 'correct != n / 10000';
        if (d.n % 10000 !== 0) return 'why divides exactly, so n must be a whole number of ten-thousands';
        if (d.a < 2) return 'a single ten-thousand makes the question trivial';
        if (d.n > MAXN) return 'n above the lesson range';
      },
      wanToNumber: d => {
        if (d.correct !== d.a * 10000) return 'correct != a * 10000';
        if (d.a < 2) return 'a single ten-thousand makes the question trivial';
        if (d.correct > MAXN) return 'result above the lesson range';
      },
      buildFromParts: d => {
        if (d.correct !== d.a * 10000 + d.b) return 'correct != a * 10000 + b';
        if (d.a < 1) return 'why talks about ten-thousands, so a must be >= 1';
        if (d.b < 1 || d.b > 9999)
          return 'the loose ones must stay under one ten-thousand, or the split is not canonical';
        if (d.correct > MAXN) return 'result above the lesson range';
      },
      unitSwap: d => {
        if (d.p < 5 || d.p > 8) return 'p out of range (5~8)';
        if (d.correct !== d.a * 10) return 'correct != a * 10';
        if (d.a < 1 || d.a > 9) return 'a must be a single digit';
        /* 規則本身：往右一格的位值一定剛好是十分之一。 */
        if (P[d.p] !== P[d.p - 1] * 10) return 'the two units are not one place apart';
      },
      biggest: d => {
        const nums = d.opts.map(Number);
        if (Math.max.apply(null, nums) !== d.correct) return 'biggest: correct is not the largest option';
        if (nums.some(v => String(v).length !== 8)) return 'biggest: every option must be an 8-digit number';
        if (nums.some(v => Math.floor(v / P[7]) !== d.h))
          return 'why says every option shares the ten-millions digit, but they do not all share it';
      },
      smallest: d => {
        const nums = d.opts.map(Number);
        if (Math.min.apply(null, nums) !== d.correct) return 'smallest: correct is not the smallest option';
        const sevens = nums.filter(v => String(v).length === 7);
        const eights = nums.filter(v => String(v).length === 8);
        if (sevens.length !== 2 || eights.length !== 2)
          return 'smallest needs exactly two 7-digit and two 8-digit options (got ' + sevens.length + '/' + eights.length + ')';
        if (String(d.correct).length !== 7) return 'the smallest must be one of the 7-digit numbers';
        /* why 說「兩個 7 位數再從最左邊的百萬位比」—— 那兩個數的百萬位必須真的不同，
           而且正解的百萬位必須是比較小的那一個，否則決勝的其實是後面的位。 */
        const mils = sevens.map(v => Math.floor(v / P[6]));
        if (mils[0] === mils[1]) return 'why says the millions place decides it, but the two 7-digit numbers tie there';
        if (Math.min.apply(null, mils) !== Math.floor(d.correct / P[6]))
          return 'the smallest 7-digit number is not the one with the smaller millions digit';
        if (d.m1 >= d.m2) return 'm1 must be the smaller millions digit';
        if (Math.floor(d.correct / P[6]) !== d.m1) return 'correct does not sit in the m1 millions group';
      },
      skipWan: d => {
        if (d.correct !== d.start + 30000) return 'correct != start + 30000';
        if (d.correct > MAXN) return 'result above the lesson range';
      },
      crossWan: d => {
        if (d.correct !== d.k * 10000) return 'crossWan: correct != k * 10000';
        if (d.n !== d.correct - 2) return 'crossWan: n must be two below the round ten-thousand';
        if (d.n % 10000 !== 9998) return 'crossWan: the stem must end in 9998 so the carry story holds';
        if (d.correct > MAXN) return 'result above the lesson range';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數（或選項本身）重算，
       完全不讀 d.correct。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'digitOf':        return String(digitAt(d.n, d.pos));
        case 'valueOfDigit':   return String(digitAt(d.n, d.pos) * P[d.pos]);
        case 'expandBlank':    return String(d.b * P[6]);
        case 'howManyWan':     return String(Math.floor(d.n / 10000));
        case 'wanToNumber':    return String(d.a * 10000);
        case 'buildFromParts': return String(d.a * 10000 + d.b);
        case 'unitSwap':       return String(d.a * 10);
        /* 這兩題的選項就是那四個數，正解是其中的極值 —— 從選項重算。 */
        case 'biggest':        return String(Math.max.apply(null, d.opts.map(Number)));
        case 'smallest':       return String(Math.min.apply(null, d.opts.map(Number)));
        case 'skipWan':        return String(d.start + 30000);
        case 'crossWan':       return String(d.k * 10000);
        default: return null;
      }
    },

    /* 題幹與解釋是拼出來的：位名、單位詞、數列的三個數都是現算的。
       資料全對、選項全對，位名印錯一樣會教錯 —— 所以在這裡把
       「畫面上真的印了什麼」拿真值表再驗一次。 */
    renderCheck: function(d, q, lang, genId){
      const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
      const why = String(q.why).replace(/<[^>]+>/g, ' ');
      const nums = (stem.match(/\d+/g) || []).map(Number);
      const places = PLACES[lang];
      const units = UNITS[lang];

      /* 位名互為子字串（「萬位」⊂「十萬位」、'ones' ⊂ 'ten-thousands'），
         所以只留「沒有被更長的命中包住」的那些，不然每一題都會命中一堆。 */
      function longestHits(text, table){
        const hits = table.filter(w => text.indexOf(w) >= 0);
        return hits.filter(w => !hits.some(other => other !== w && other.indexOf(w) >= 0));
      }
      /* digitOf 的位名印在題幹，valueOfDigit 印在解釋 —— 分開驗，
         合起來驗的話只改壞其中一邊，另一邊會替它掩護。 */
      if (genId === 'digitOf'){
        const said = longestHits(stem, places);
        if (said.indexOf(places[d.pos]) < 0)
          return 'digitOf does not name the ' + places[d.pos] + ' place (said: ' + (said.join('/') || 'none') + ')';
        if (said.length !== 1) return 'digitOf names more than one place (' + said.join('/') + ')';
        if (nums.indexOf(d.n) < 0) return 'digitOf stem does not print the number ' + d.n;
      }
      if (genId === 'valueOfDigit'){
        const said = longestHits(why, places);
        if (said.indexOf(places[d.pos]) < 0)
          return 'valueOfDigit does not name the ' + places[d.pos] + ' place (said: ' + (said.join('/') || 'none') + ')';
        if (said.length !== 1) return 'valueOfDigit names more than one place (' + said.join('/') + ')';
        if (nums.indexOf(d.n) < 0) return 'valueOfDigit stem does not print the number ' + d.n;
        if (nums.indexOf(d.dg) < 0) return 'valueOfDigit stem does not print the digit ' + d.dg;
      }
      if (genId === 'unitSwap'){
        /* 兩個單位詞都要出現，而且必須剛好是相鄰的那一對。
           這裡不能用 longestHits：「萬」本來就是「十萬」的子字串，可是這一題
           兩個都是**真的**印出來的，濾掉短的那個就會把正確的題目判成錯的
           （第一版就是這樣誤報的）。改成「把要找的兩個依序遮掉，再看還剩什麼」——
           先遮大的那一個，因為小的可能是它的子字串（十萬 ⊃ 萬、ten-millions ⊃ millions）。 */
        const want = [units[d.p], units[d.p - 1]];
        let rest = stem;
        for (const w of want){
          const at = rest.indexOf(w);
          if (at < 0)
            return 'unitSwap does not name the ' + w + ' unit (stem: ' + stem.trim() + ')';
          rest = rest.slice(0, at) + rest.slice(at + w.length);
        }
        const leftover = units.filter(w => rest.indexOf(w) >= 0);
        if (leftover.length)
          return 'unitSwap also names ' + leftover.join('/') + ', so the question is ambiguous';
      }
      if (genId === 'expandBlank'){
        if (nums.indexOf(d.n) < 0 || nums.indexOf(d.a * P[7]) < 0 || nums.indexOf(d.c * P[4]) < 0)
          return 'expandBlank stem does not print n, a*10^7 and c*10^4 (printed ' + nums.join(',') + ')';
      }
      if (genId === 'howManyWan' && nums.indexOf(d.n) < 0)
        return 'howManyWan stem does not print the number ' + d.n;
      if (genId === 'skipWan' &&
          (nums[0] !== d.start || nums[1] !== d.start + 10000 || nums[2] !== d.start + 20000))
        return 'the skip-wan stem is not start, +10000, +20000 (printed ' + nums.join(',') + ')';
      if (genId === 'crossWan' && (nums[0] !== d.n || nums[1] !== d.n + 1))
        return 'the counting stem is not n, n+1 (printed ' + nums.join(',') + ')';

      /* 解釋必須把正解自己印出來（codex 審查 #3）。在這之前 `expectedCorrect`
         只驗 `opts[ans]`，把 why 裡的 d.correct 改成 d.correct + 1 整條鏈都是綠的，
         孩子卻讀到一個和正解不一樣的算式。正解由這裡自己重算，不讀 d.correct。 */
      const want = module.exports.sim.expectedCorrect(d, genId, lang);
      if (want !== null){
        const whyNums = (why.match(/\d+/g) || []);
        if (whyNums.indexOf(String(want)) < 0)
          return genId + ' why never prints the correct answer ' + want + ' (printed ' + whyNums.join(',') + ')';
      }
      return null;
    },

    /* 哪些「把題幹的數字放進選項」是刻意的迷思誘答 —— 各自只放行那一個值。 */
    stemEchoOk: {
      /* 「47530000 的 5 表示多少？」→ 直接答 5：只看數字，沒看它站在哪一位。 */
      valueOfDigit: function(d, opt){ return Number(opt) === d.dg; },
      /* 「48 個萬是多少？」→ 直接答 48：忘了乘 10000。 */
      wanToNumber: function(d, opt){ return Number(opt) === d.a; },
      /* 「7 個百萬是幾個十萬？」→ 直接答 7：忘了換單位。 */
      unitSwap: function(d, opt){ return Number(opt) === d.a; }
    },

    /* 選項一律是純數字，而且要落在這一課自己宣告的範圍裡。 */
    optionOk: function(s, genId){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const [lo, hi] = RANGE[genId] || [1, MAXN];
      const v = Number(s);
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{MAXN, PLACE_NUMS, READ_NUMS, REGROUP_NUMS, PAIRS, LINE_NUMS, LINE_MAX, ROUNDS, ' +
                'digitsOf, sectionsOf, pad4, readSection, toChineseBig, compareSteps}',
    /* 三層題庫的選項不可以超出這一課宣告的九位數上限。 */
    optionValueMax: MAXN,

    check: function(data, I18N, fail){
      const LANGS = ['zh', 'en'];

      if (data.MAXN !== MAXN) fail(`the lesson's MAXN is ${data.MAXN}, this config assumes ${MAXN}`);

      /* --- 三層題庫：從題幹的數字重算一次正解（codex 審查 #1） ---
         `verify_lesson_data.js` 內建的算術重算只認得「a ＋ b ＝ ?」那種題幹，
         這一課一題都不符合 —— 在這之前把 ans:2 改成 ans:0 完全不會被抓到。 */
      Object.keys(BANK_EXPECTED).forEach(bank => {
        const spec = BANK_EXPECTED[bank];
        LANGS.forEach(L => {
          const items = I18N[L][bank];
          if (!Array.isArray(items) || items.length !== spec.length){
            fail(bank + ' ' + L + ': ' + (items ? items.length : 'no') +
                 ' questions, the oracle describes ' + spec.length);
            return;
          }
          items.forEach((q, i) => {
            const e = spec[i];
            const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
            const nums = (stem.match(/\d+/g) || []).map(Number);
            /* 位置式神諭擋不住「把題幹的 47530000 改成 47531000」——
               所以先把題幹的數字和神諭的清單**逐一對齊**，再從那些數算答案。
               只要求「有包含」不夠：把舊的數字當成「（例：47530000）」補回去，
               檢查就會靜靜放行（第三輪 codex #1）。 */
            const sortNum = a => a.slice().sort((x, y) => x - y).join(',');
            if (sortNum(nums) !== sortNum(e.nums))
              fail(bank + '[' + i + '] ' + L + ': stem prints [' + nums.join(',') +
                   '], the oracle expects exactly [' + e.nums.join(',') + ']');
            /* 這一課刻意不印千分位逗號（家長頁對大人講了這件事）——
               在這之前那條規則沒有任何檢查在盯。 */
            if (/\d,\d/.test(stem))
              fail(bank + '[' + i + '] ' + L + ': the stem uses a thousands separator, which this lesson deliberately avoids');
            let want;
            if (e.byDirection){
              const dir = directionFromStem(stem, L);
              if (!dir){
                fail(bank + '[' + i + '] ' + L + ': the stem says neither "biggest" nor "smallest" (or says both)');
                return;
              }
              const vals = q.opts.map(Number);
              want = String(dir === 'max' ? Math.max.apply(null, vals) : Math.min.apply(null, vals));
            } else if (e.compareUnits){
              const pairs = unitPairs(stem, L);
              if (pairs.length !== 2){
                fail(bank + '[' + i + '] ' + L + ': expected two "count + unit" phrases in the stem, parsed ' +
                     JSON.stringify(pairs));
                return;
              }
              const va = pairs[0][0] * P[pairs[0][1]], vb = pairs[1][0] * P[pairs[1][1]];
              const key = (va === vb) ? 'EQ' : (va > vb ? 'A' : 'B');
              want = e.labels[key][L];
            } else {
              want = e.calc(e.nums.length ? e.nums : nums, L);
            }
            /* 重算的結果還要和手寫的期望值對得上：兩份都錯才會漏，
               只有一份錯一定響。三條路徑都要比，不是只比 calc 那一條。 */
            if (want !== e[L])
              fail(bank + '[' + i + '] ' + L + ': recomputed "' + want +
                   '" but the oracle table says "' + e[L] + '"');
            if (String(q.opts[q.ans]).trim() !== String(want))
              fail(bank + '[' + i + '] ' + L + ': marked answer is "' + q.opts[q.ans] +
                   '", recomputed "' + want + '"');
            /* 解釋也要印出正解，不然算式和答案可以各說各話。 */
            /* 數字答案要比「整個數字 token」——子字串比對會把 400 認在 4000000 裡面
               （第二輪 codex #4）。文字答案（「一樣大」）才用子字串，並統一大小寫。
               ⚠️ 已知限制（第三輪 codex #4）：這只驗「解釋裡有沒有出現正解」，
               不驗它出現在什麼位置 —— 「常見錯誤答案是 35」這種句子也會過。
               要真的擋住得解析算式，代價比它擋到的東西高，所以留著並記在這裡。 */
            const whyPlain = String(q.why).replace(/<[^>]+>/g, ' ');
            const stated = /^\d+$/.test(String(want))
              ? (whyPlain.match(/\d+/g) || []).indexOf(String(want)) >= 0
              : whyPlain.toLowerCase().indexOf(String(want).toLowerCase()) >= 0;
            if (!stated)
              fail(bank + '[' + i + '] ' + L + ': the explanation never states the answer "' + want + '"');
          });
        });
      });

      /* --- 速查卡與家長頁：規則的措辭（codex 審查 #2） ---
         這兩頁在這之前一條斷言都沒有。三頁教的是同一條規則，只驗上課頁等於
         沒在盯另外兩頁。資料夾用 `process.argv[2]` 推出來，改壞測試才會讀到
         它自己複製出來的那一份 —— 用 __dirname 會讀到真的 repo，
         那條斷言就永遠是綠的。 */
      const target = process.argv[2];
      if (!target){
        fail('cannot locate the lesson folder (no target path in argv) — the sibling-page checks did not run');
      } else {
        const dir = path.dirname(target);
        Object.keys(SIBLING_RULES).forEach(page => {
          const rule = SIBLING_RULES[page];
          let html;
          try {
            html = fs.readFileSync(path.join(dir, page), 'utf8');
          } catch (err){
            fail('cannot read ' + page + ': ' + err.code);
            return;
          }
          /* HTML 註解裡的文字畫面上看不到，不可以拿來充數 —— 不然把規則從
             畫面上拿掉、再貼進一個註解，次數不變，檢查就靜靜放行
             （第三輪 codex #2；這正是本專案「用字串讀 HTML 會 fail open」的老毛病）。 */
          html = html.replace(/<!--[\s\S]*?-->/g, ' ');
          rule.must.forEach(entry => {
            const t = entry[0], need = entry[1];
            const got = html.split(t).length - 1;
            if (got < need)
              fail(page + ' no longer says "' + t + '" the required number of times (' +
                   got + ' of ' + need + ')');
          });
          rule.forbid.forEach(t => {
            if (html.indexOf(t) >= 0)
              fail(page + ' says "' + t + '", which contradicts the rule this lesson teaches');
          });
          if (rule.orderedZh){
            /* 位名表的順序：由高位到低位，每一格都要在、而且順序不能顛倒。 */
            const at = rule.orderedZh.map(w => html.indexOf('>' + w + '<'));
            at.forEach((v, i) => {
              if (v < 0) fail(page + ' place table is missing a cell for ' + rule.orderedZh[i]);
            });
            for (let i = 1; i < at.length; i++){
              if (at[i - 1] >= 0 && at[i] >= 0 && at[i] < at[i - 1])
                fail(page + ' place table has ' + rule.orderedZh[i] + ' before ' + rule.orderedZh[i - 1]);
            }
          }
        });
      }

      /* --- 字典的位名／單位詞表要和這份設定的真值表逐字相同 --- */
      LANGS.forEach(L => {
        [['places', PLACES, 'place-name'], ['units', UNITS, 'unit']].forEach(([key, table, label]) => {
          const got = I18N[L][key];
          if (!Array.isArray(got) || got.length !== 9)
            return fail(`${L}.${key} is not a 9-entry ${label} table`);
          got.forEach((w, i) => {
            if (w !== table[L][i]) fail(`${L}.${key}[${i}] is "${w}", the ${label} table says "${table[L][i]}"`);
          });
        });
      });

      /* --- 中文讀法：把 toChineseBig 真的跑起來，比對手寫的期望值 --- */
      Object.keys(READ_EXPECTED).forEach(k => {
        const n = Number(k);
        const got = data.toChineseBig(n);
        if (got !== READ_EXPECTED[k])
          fail(`toChineseBig(${n}) = "${got}", expected "${READ_EXPECTED[k]}"`);
      });
      /* 期望值表本身要真的蓋到補零的三條規則，否則上面那一圈可能什麼都沒證明。 */
      const keys = Object.keys(READ_EXPECTED).map(Number);
      if (!keys.some(n => n >= 100000000 && Math.floor(n / 10000) % 10000 > 0 && Math.floor(n / 10000) % 10000 < 1000))
        fail('READ_EXPECTED never exercises "a yi group plus a wan group under 1000" (zero rule 1)');
      if (!keys.some(n => n >= 100000000 && Math.floor(n / 10000) % 10000 === 0 && n % 10000 > 0))
        fail('READ_EXPECTED never exercises "a yi group plus an all-zero wan group" (zero rule 2)');
      if (!keys.some(n => n > 10000 && n % 10000 > 0 && n % 10000 < 1000))
        fail('READ_EXPECTED never exercises "a ones group under 1000" (zero rule 3)');

      /* --- 三個節的切法：sectionsOf 要能把數重新組回來 --- */
      [0, 1, 9999, 10000, 99999999, 100000000, MAXN]
        .concat(data.PLACE_NUMS, data.READ_NUMS)
        .forEach(n => {
          const s = data.sectionsOf(n);
          if (s.yi * 100000000 + s.wan * 10000 + s.ge !== n) fail(`sectionsOf(${n}) does not rebuild n`);
          if (s.wan < 0 || s.wan > 9999 || s.ge < 0 || s.ge > 9999)
            fail(`sectionsOf(${n}) has a section outside 0~9999`);
          /* 只驗長度會 fail-open（codex 審查 #7）：永遠回傳 '0000' 也是四個字。
             拿獨立補出來的字串逐字比。 */
          const want4 = ('0000' + s.ge).slice(-4);
          if (data.pad4(s.ge) !== want4) fail(`pad4(${s.ge}) = "${data.pad4(s.ge)}", expected "${want4}"`);
        });

      /* --- 範例 1：位值表 --- */
      data.PLACE_NUMS.forEach(n => {
        if (n > MAXN) fail(`PLACE_NUMS ${n} above the lesson range`);
        if (String(n).length < 8) fail(`PLACE_NUMS ${n} is smaller than 8 digits — too easy for this lesson`);
        const dg = data.digitsOf(n);
        if (dg.length !== 9) fail(`digitsOf(${n}) returned ${dg.length} digits`);
        /* 只驗加權和會 fail-open（codex 審查 #4）：回傳 [n,0,0,…] 也「組得回 n」，
           畫面上卻會說整個數都是「幾個一」。每一位要各自等於獨立算出來的那一位。 */
        dg.forEach((v, i) => {
          if (!Number.isInteger(v) || v < 0 || v > 9) fail(`digitsOf(${n})[${i}] = ${v} is not a digit`);
          if (v !== digitAt(n, i)) fail(`digitsOf(${n})[${i}] = ${v}, the place says ${digitAt(n, i)}`);
        });
        let rebuilt = 0;
        dg.forEach((v, i) => { rebuilt += v * P[i]; });
        if (rebuilt !== n) fail(`digitsOf(${n}) does not rebuild n`);
        LANGS.forEach(L => {
          const parts = [];
          for (let p = 8; p >= 0; p--) if (dg[p] > 0) parts.push(I18N[L].s1part(dg[p], I18N[L].units[p]));
          const line = I18N[L].s1read(n, parts);
          if (/undefined|NaN/.test(line)) fail(`s1read ${L} ${n}: ${line}`);
          if (line.indexOf(String(n)) < 0) fail(`s1read ${L} ${n} does not print the number`);
        });
      });
      /* 這一課的兩個重點：中間有 0 的位、以及真的用到億位的數。 */
      if (!data.PLACE_NUMS.some(n => /\d0\d/.test(String(n))))
        fail('PLACE_NUMS has no number with a 0 in the middle (the placeholder case)');
      if (!data.PLACE_NUMS.some(n => n >= 100000000))
        fail('PLACE_NUMS has no number reaching the hundred-millions place');

      /* --- 範例 2：四位一節與讀法 --- */
      data.READ_NUMS.forEach(n => {
        if (n > MAXN) fail(`READ_NUMS ${n} above the lesson range`);
        if (READ_EXPECTED[n] === undefined) fail(`READ_NUMS ${n} has no hand-written reading in this config`);
        LANGS.forEach(L => {
          const line = I18N[L].s2line(n, data.sectionsOf(n));
          if (/undefined|NaN/.test(line)) fail(`s2line ${L} ${n}: ${line}`);
          if (line.indexOf(String(n)) < 0) fail(`s2line ${L} ${n} does not print the number`);
        });
        if (READ_EXPECTED[n] !== undefined){
          const zh = I18N.zh.s2line(n, data.sectionsOf(n));
          if (zh.indexOf(READ_EXPECTED[n]) < 0)
            fail(`s2line zh ${n} does not contain the reading ${READ_EXPECTED[n]}`);
        }
      });
      if (!data.READ_NUMS.some(n => n >= 100000000))
        fail('READ_NUMS never shows a three-group number');
      if (!data.READ_NUMS.some(n => n % 10000 > 0 && n % 10000 < 1000))
        fail('READ_NUMS never shows the spoken-zero case');

      /* --- 範例 3：化聚 --- */
      data.REGROUP_NUMS.forEach(n => {
        if (n > MAXN) fail(`REGROUP_NUMS ${n} above the lesson range`);
        if (n % 10000 !== 0)
          fail(`REGROUP_NUMS ${n} is not a whole number of ten-thousands, so the divide-by-10000 line would round`);
        LANGS.forEach(L => {
          const w = I18N[L].s3wan(n, Math.floor(n / 10000));
          const q = I18N[L].s3qian(n, Math.floor(n / 1000));
          if (/undefined|NaN/.test(w + q)) fail(`s3 ${L} ${n}: ${w} / ${q}`);
          if (w.indexOf(String(Math.floor(n / 10000))) < 0) fail(`s3wan ${L} ${n} does not print ${Math.floor(n / 10000)}`);
          if (q.indexOf(String(Math.floor(n / 1000))) < 0) fail(`s3qian ${L} ${n} does not print ${Math.floor(n / 1000)}`);
          if (n >= 100000000){
            const yi = Math.floor(n / 100000000);
            const rest = Math.floor((n - yi * 100000000) / 10000);
            const line = I18N[L].s3yi(yi, rest);
            if (/undefined|NaN/.test(line)) fail(`s3yi ${L} ${n}: ${line}`);
            if (line.indexOf(String(yi)) < 0) fail(`s3yi ${L} ${n} does not print ${yi}`);
            if (rest > 0 && line.indexOf(String(rest)) < 0) fail(`s3yi ${L} ${n} does not print the leftover ${rest}`);
          }
        });
      });
      if (!data.REGROUP_NUMS.some(n => n >= 100000000))
        fail('REGROUP_NUMS never reaches a hundred-million, so the yi line is never shown');

      /* --- 範例 4：比大小 --- */
      data.PAIRS.forEach(p => {
        if (p.a === p.b) fail(`PAIRS ${p.a}/${p.b} are equal, so there is nothing to compare`);
        if (p.a > MAXN || p.b > MAXN) fail(`PAIRS ${p.a}/${p.b} above the lesson range`);
        const steps = data.compareSteps(p.a, p.b);
        if (!Array.isArray(steps) || !steps.length){
          /* 空陣列的話下一行 last.kind 會直接丟例外，整份報告變成 stack trace，
             真正的錯誤訊息反而看不到（第三輪 codex #7）。要響亮地失敗。 */
          fail(`compareSteps ${p.a}/${p.b} returned no steps`);
          return;
        }
        const last = steps[steps.length - 1];
        const sameLen = String(p.a).length === String(p.b).length;
        const big = Math.max(p.a, p.b);
        if (sameLen){
          if (last.kind !== 'digit'){
            fail(`compareSteps ${p.a}/${p.b} never reaches a deciding digit`);
            return;
          }
          /* 決勝位要獨立算一次：第一個不同的位。 */
          const sa = String(p.a), sb = String(p.b);
          let idx = -1;
          for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]){ idx = i; break; }
          if (last.idx !== idx) fail(`compareSteps ${p.a}/${p.b} decides at index ${last.idx}, first difference is at ${idx}`);
          if (last.place !== sa.length - 1 - idx) fail(`compareSteps ${p.a}/${p.b} reports the wrong place index`);
        } else if (last.kind !== 'digitcount'){
          fail(`compareSteps ${p.a}/${p.b} should decide on the digit count`);
          return;
        }
        if ((last.winner === 'a' ? p.a : p.b) !== big)
          fail(`compareSteps ${p.a}/${p.b} picked the smaller number as the winner`);
        /* 每一步都要對得上畫面會講的話（codex 審查 #5）：在這之前只驗了決勝的
           index/place/winner，`da`／`db` 和前面每一個 tie 步驟完全沒被看過 ——
           回傳 da:0, db:9 仍然全綠，孩子卻讀到一組假的數字。 */
        const sa = String(p.a), sb = String(p.b);
        /* 只驗「存在的步驟」會 fail-open（第二輪 codex #5）：整段 tie 拿掉之後
           剩下的步驟仍然全對，可是畫面上就少了一位一位比的過程。
           所以先驗整串的形狀，再驗每一步的內容。 */
        if (sameLen){
          let firstDiff = -1;
          for (let k = 0; k < sa.length; k++) if (sa[k] !== sb[k]){ firstDiff = k; break; }
          const wantKinds = ['samecount'].concat(new Array(firstDiff).fill('tie')).concat(['digit']);
          const gotKinds = steps.map(st => st.kind);
          if (gotKinds.join(',') !== wantKinds.join(','))
            fail(`compareSteps ${p.a}/${p.b} step shape is ${gotKinds.join(',')}, expected ${wantKinds.join(',')}`);
          /* 只數 tie 的「個數」不夠：三步都指著第 0 位也會過，中間兩位就沒人講解
             （第三輪 codex #3）。index 必須是 0,1,…,firstDiff-1 這個序列。 */
          const tieIdx = steps.filter(st => st.kind === 'tie').map(st => st.idx).join(',');
          const wantTie = Array.from({ length: firstDiff }, (_, k) => k).join(',');
          if (tieIdx !== wantTie)
            fail(`compareSteps ${p.a}/${p.b} tie indices are [${tieIdx}], expected [${wantTie}]`);
        } else if (steps.length !== 1 || steps[0].kind !== 'digitcount'){
          fail(`compareSteps ${p.a}/${p.b} should be a single digitcount step, got ${steps.map(st => st.kind).join(',')}`);
        }
        steps.forEach(st => {
          if (st.kind === 'tie'){
            if (Number(sa[st.idx]) !== st.d || Number(sb[st.idx]) !== st.d)
              fail(`compareSteps ${p.a}/${p.b} tie at index ${st.idx} says ${st.d}, digits are ${sa[st.idx]}/${sb[st.idx]}`);
            if (st.place !== sa.length - 1 - st.idx)
              fail(`compareSteps ${p.a}/${p.b} tie at index ${st.idx} reports place ${st.place}`);
          }
          if (st.kind === 'digit'){
            if (Number(sa[st.idx]) !== st.da || Number(sb[st.idx]) !== st.db)
              fail(`compareSteps ${p.a}/${p.b} deciding step says ${st.da}/${st.db}, digits are ${sa[st.idx]}/${sb[st.idx]}`);
          }
          if (st.kind === 'samecount' && st.len !== sa.length)
            fail(`compareSteps ${p.a}/${p.b} says ${st.len} digits, actually ${sa.length}`);
          if (st.kind === 'digitcount' && (st.la !== sa.length || st.lb !== sb.length))
            fail(`compareSteps ${p.a}/${p.b} reports digit counts ${st.la}/${st.lb}, actually ${sa.length}/${sb.length}`);
        });
        LANGS.forEach(L => {
          const t = sameLen
            ? I18N[L].s4digit(last.place, last.da, last.db, big, I18N[L].places[last.place])
            : I18N[L].s4digitcount(String(p.a).length, String(p.b).length, p.a, p.b, big);
          if (/undefined|NaN/.test(t)) fail(`compare text ${L} ${p.a}/${p.b}: ${t}`);
          if (t.indexOf(String(big)) < 0) fail(`compare text ${L} ${p.a}/${p.b} does not name the winner`);
          if (sameLen && t.indexOf(I18N[L].places[last.place]) < 0)
            fail(`compare text ${L} ${p.a}/${p.b} does not name the deciding place`);
        });
      });
      if (!data.PAIRS.some(p => String(p.a).length !== String(p.b).length))
        fail('PAIRS has no pair with a different number of digits (the more-digits-wins case)');
      if (!data.PAIRS.some(p => String(p.a).length === String(p.b).length && String(p.a)[0] === String(p.b)[0]))
        fail('PAIRS has no pair that ties on the leading digit (the look-at-the-next-place case)');

      /* --- 範例 5：數線 --- */
      if (data.LINE_MAX !== 100000000) fail(`LINE_MAX is ${data.LINE_MAX}, the lesson says the line runs to 100000000`);
      data.LINE_NUMS.forEach(n => {
        if (n <= 0 || n >= data.LINE_MAX) fail(`LINE_NUMS ${n} outside the number line 0~${data.LINE_MAX}`);
        /* 「最靠近的整千萬」要唯一 —— 剛好在兩個整千萬正中間時那句話是假的。 */
        if (n % 10000000 === 5000000)
          fail(`LINE_NUMS ${n} sits exactly halfway between two ten-millions, so "closest" is not unique`);
        const nearest = Math.round(n / 10000000) * 10000000;
        LANGS.forEach(L => {
          const t = I18N[L].s5explain(n, nearest);
          if (/undefined|NaN/.test(t)) fail(`s5explain ${L} ${n}: ${t}`);
          if (t.indexOf(String(nearest)) < 0) fail(`s5explain ${L} ${n} does not print the nearest ten-million`);
        });
      });

      /* --- 遊戲：大數城市點名 --- */
      function partsValue(parts){
        return parts.reduce((sum, pr) => sum + pr[0] * P[pr[1]], 0);
      }
      data.ROUNDS.forEach((r, i) => {
        const target = (r.ask === 'toParts') ? r.n : partsValue(r.parts);
        if (target > MAXN) fail(`ROUND ${i+1}: target ${target} above the lesson range`);
        if (r.ans < 0 || r.ans >= r.opts.length){
          fail(`ROUND ${i+1}: ans index out of range`);
          return;
        }
        const values = r.opts.map(o => (r.ask === 'toParts') ? partsValue(o) : o);
        /* 先確認每個值是整數，否則 `'banana' > MAXN` 是 false，範圍檢查會靜靜放行
           （codex 審查 #6）。 */
        values.forEach((v, k) => {
          if (!Number.isInteger(v)) fail(`ROUND ${i+1}: option ${k} has a non-integer value ${JSON.stringify(r.opts[k])}`);
        });
        if (values[r.ans] !== target)
          fail(`ROUND ${i+1}: the parts do not add up to ${target} (marked option is ${values[r.ans]})`);
        if (new Set(values).size !== values.length) fail(`ROUND ${i+1}: duplicate option values`);
        values.forEach(v => {
          if (v <= 0 || v > MAXN) fail(`ROUND ${i+1}: option value ${v} above the lesson range`);
        });
        /* 每個 [數量, 次方] 都要合法，不然畫面上會印出「0 個萬」這種話。 */
        const partLists = (r.ask === 'toParts') ? r.opts : [r.parts];
        partLists.forEach(pl => {
          pl.forEach(pr => {
            if (!Number.isInteger(pr[0]) || !(pr[0] > 0))
              fail(`ROUND ${i+1}: a part count must be a positive integer, got ${pr[0]}`);
            if (pr[1] < 0 || pr[1] > 8) fail(`ROUND ${i+1}: a part unit index ${pr[1]} is outside 0~8`);
          });
        });
        LANGS.forEach(L => {
          partLists.forEach(pl => {
            const txt = pl.map(pr => I18N[L].gPart(pr[0], I18N[L].units[pr[1]])).join(I18N[L].gPartsJoin);
            if (/undefined|NaN/.test(txt)) fail(`ROUND ${i+1} ${L}: ${txt}`);
            pl.forEach(pr => {
              if (txt.indexOf(String(pr[0])) < 0) fail(`ROUND ${i+1} ${L} does not print the count ${pr[0]}`);
              if (txt.indexOf(UNITS[L][pr[1]]) < 0) fail(`ROUND ${i+1} ${L} does not print the unit ${UNITS[L][pr[1]]}`);
            });
          });
        });
      });
      if (data.ROUNDS.map(r => r.ans).every(x => x === 0))
        fail('every game round has the answer first');
      if (!data.ROUNDS.some(r => {
        const pl = (r.ask === 'toParts') ? r.opts[r.ans] : r.parts;
        return pl.some(pr => pr[1] >= 7);
      })) fail('ROUNDS never reaches the ten-millions or hundred-millions units');
      if (!data.ROUNDS.some(r => {
        const target = (r.ask === 'toParts') ? r.n : partsValue(r.parts);
        return /\d0\d/.test(String(target));
      })) fail('ROUNDS never exercises a 0 placeholder inside the number');
    }
  }
};
