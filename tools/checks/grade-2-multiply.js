/* grade-2/math/multiply（九九乘法）的檢查設定。

   和 grade-2/numbers 一樣，這一課是設定檔機制出現「之前」上線的，補上之前
   `node tools/simgen.js grade-2/math/multiply/review.html` 會直接報 no check config。

   範圍取自課程自己說的話：這一課是「九九乘法」，乘數與被乘數都在 2~9，
   所以積最大 81，選項上限就是 81 —— 不是隨手給一個寬鬆的大數。 */

const MAXF = 9;            // 九九乘法：因數上限
const MAXP = MAXF * MAXF;  // 積上限 81

/* 選項是「算式字串」而不是數字的兩個產生器。 */
const EXPR_GENS = { repeatedAdd: true, sameTotal: true };

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/multiply */
  breaks: [
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'p != a*b',
      find:'        var p = a * b;\n        var m = mixOpts(p, [p - a, p + a, a + b]);',
      replace:'        var p = a * b + 1;\n        var m = mixOpts(p, [p - a, p + a, a + b]);' },
    { file:'review', expect:'p != a*b',
      find:'        var p = a * b;\n        var m = mixOpts(p, [a + b, p - a, p + a]);',
      replace:'        var p = a * b + 2;\n        var m = mixOpts(p, [a + b, p - a, p + a]);' },
    /* 這一筆會被「正解的第二套實作」先攔下來（expectedCorrect 從 a、b 重建
       `a × b` 字串），所以噴的是通用的 opts[ans] != correct，不是自訂訊息 ——
       比自訂訊息更強，因為那代表神諭真的獨立算過一次。 */
    { file:'review', expect:'opts[ans] != correct',
      find:"        var correct = { t: a + ' × ' + b, v: a * b };",
      replace:"        var correct = { t: a + ' × ' + (b + 1), v: a * b };" },
    { file:'review', expect:'the stem does not repeat a exactly b times',
      find:'        for (var i = 0; i < d.b; i++) adds.push(d.a);',
      replace:'        for (var i = 0; i < d.b + 1; i++) adds.push(d.a);' },
    { file:'review', expect:'correct is not the missing factor',
      find:'        var m = mixOpts(b, [p - a, b + 1, b - 1]);',
      replace:'        var m = mixOpts(b + 1, [p - a, b + 1, b - 1]);' },
    { file:'review', expect:'correct is not the multiplier k',
      find:'        var m = mixOpts(k, [p - a, k + 1, a]);',
      replace:'        var m = mixOpts(p - a, [k, k + 1, a]);' },
    { file:'review', expect:'p != r*c',
      find:'        var p = r * c;\n        var m = mixOpts(p, [r + c, p - c, p + c]);',
      replace:'        var p = r * c + 1;\n        var m = mixOpts(p, [r + c, p - c, p + c]);' },
    { file:'review', expect:'the commuted expression is not b × a',
      find:"        var correct = { t: b + ' × ' + a, v: a * b };",
      replace:"        var correct = { t: a + ' × ' + b, v: a * b };" },
    { file:'review', expect:'sameTotal: a and b are equal',
      find:'        var b = 2 + rand(8);\n        while (b === a) b = 2 + rand(8);',
      replace:'        var b = a;' },
    { file:'review', expect:'correct is not the per-plate share',
      find:'        var m = mixOpts(a, [p - b, a + 1, b]);',
      replace:'        var m = mixOpts(a + 1, [p - b, a + 1, b]);' },
    { file:'review', expect:'next != a*4',
      find:'        var next = a * 4;',
      replace:'        var next = a * 5;' },
    { file:'index', expect:'a×b',
      find:'    { a:3, b:2, ans:6,  opts:[5, 6, 9] },',
      replace:'    { a:3, b:2, ans:9,  opts:[5, 6, 9] },' },
    { file:'index', expect:'ARRAYS never shows a non-square array',
      find:'    { r:3, c:4 },\n    { r:2, c:5 },\n    { r:4, c:6 }',
      replace:'    { r:3, c:3 },\n    { r:2, c:2 },\n    { r:4, c:4 }' },
    { file:'index', expect:'outside the 九九 range',
      find:'  var TABLE_NS = [2, 3, 4, 5, 6, 7, 8, 9];',
      replace:'  var TABLE_NS = [2, 3, 4, 5, 6, 7, 8, 12];' },
    { file:'index', expect:'GROUP_SIZES 15 outside',
      find:'  var GROUP_SIZES = [2, 3, 4, 5];',
      replace:'  var GROUP_SIZES = [2, 3, 4, 15];' },
    { file:'index', expect:'one plate cannot show repeated groups',
      find:'  var MAX_PLATES = 5;',
      replace:'  var MAX_PLATES = 1;' },
    { file:'index', expect:'the last round is not harder than the first',
      find:'    { a:7, b:4, ans:28, opts:[21, 28, 32] }',
      replace:'    { a:2, b:2, ans:4,  opts:[21, 4, 32] }' },
    /* 正解全押第一個 —— 這一課的遊戲原本真的是這樣（2026-08-26 修）。 */
    { file:'index', expect:'every game round has the answer first',
      find:'    { a:3, b:2, ans:6,  opts:[5, 6, 9] },\n    { a:5, b:3, ans:15, opts:[8, 10, 15] },\n    { a:4, b:4, ans:16, opts:[16, 12, 20] },\n    { a:6, b:3, ans:18, opts:[9, 24, 18] },\n    { a:7, b:4, ans:28, opts:[21, 28, 32] }',
      replace:'    { a:3, b:2, ans:6,  opts:[6, 5, 9] },\n    { a:5, b:3, ans:15, opts:[15, 8, 10] },\n    { a:4, b:4, ans:16, opts:[16, 12, 20] },\n    { a:6, b:3, ans:18, opts:[18, 9, 24] },\n    { a:7, b:4, ans:28, opts:[28, 21, 32] }' }
  ],

  sim: {
    INVARIANTS: {
      productDirect: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a < 2 || d.a > MAXF || d.b < 2 || d.b > MAXF) return 'factors outside the 九九 range 2~9';
      },
      groupsOf: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        /* why 說「a 加 b 次」——這句話要成立，b 必須是「幾次」而不是別的東西。 */
        if (d.b < 2 || d.b > MAXF) return 'b must be a real repeat count in 2~9';
        if (d.a < 2 || d.a > MAXF) return 'a outside the 九九 range';
      },
      repeatedAdd: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a < 2 || d.a > MAXF) return 'a outside the 九九 range 2~9';
        if (d.b < 2) return 'the stem writes a repeated addition — it needs at least two terms';
        if (d.b > 5) return 'too many terms for a grade-2 stem';
        /* a + b === a × b（只有 2、2）時產生器自己就不會用連加式誘答，
           所以這裡**不能**判失敗 —— 那是它處理好的情況，不是缺陷。
           真正要驗的是「選項裡沒有和正解等值的東西」，那條在 simgen 本體。 */
      },
      missingFactor: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a < 2 || d.a > MAXF || d.b < 2 || d.b > MAXF) return 'factors outside the 九九 range 2~9';
        if (Number(d.opts[d.ans]) !== d.b) return 'correct is not the missing factor';
      },
      wordGroups: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.kind < 0 || d.kind > 2) return 'kind out of range';
        if (d.a < 2 || d.b < 2) return 'a one-item group makes the word problem trivial';
        if (d.a > MAXF || d.b > MAXF) return 'factors outside the 九九 range 2~9';
      },
      timesWord: d => {
        if (d.p !== d.a * d.k) return 'p != a*k';
        if (d.k < 2) return 'why says "k groups of a" — k must be at least 2';
        if (d.a < 2 || d.a > MAXF || d.k > MAXF) return 'a or k outside the 九九 range 2~9';
        if (d.a * (d.k + 1) > MAXP) return 'a distractor would leave the 九九 range';
      },
      howManyTimes: d => {
        if (d.p !== d.a * d.k) return 'p != a*k';
        if (d.a < 2 || d.a > MAXF || d.k < 2 || d.k > MAXF) return 'a or k outside the 九九 range 2~9';
        if (Number(d.opts[d.ans]) !== d.k) return 'correct is not the multiplier k';
        /* 這一題整個重點是「倍 ≠ 差」，所以那個誘答必須真的和正解不同，
           不然孩子選 p − a 也會被判對，迷思就考不到了。 */
        if (d.p - d.a === d.k) return 'the difference equals the multiple, so the misconception cannot be tested';
      },
      arrayCount: d => {
        if (d.p !== d.r * d.c) return 'p != r*c';
        if (d.r < 2 || d.c < 2) return 'a single row/column is not an array';
        if (d.r > MAXF || d.c > MAXF) return 'array outside the 九九 range';
      },
      sameTotal: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a === d.b) return 'sameTotal: a and b are equal, so the commuted expression is the stem itself';
        const key = String(d.opts[d.ans]).replace(/\s/g, '');
        if (key !== (d.b + '×' + d.a)) return 'the commuted expression is not b × a';
      },
      shareOut: d => {
        if (d.p !== d.a * d.b) return 'p != a*b';
        if (d.a < 2 || d.a > MAXF || d.b > MAXF) return 'a or b outside the 九九 range 2~9';
        if (Number(d.opts[d.ans]) !== d.a) return 'correct is not the per-plate share';
        if (d.b < 2) return 'sharing onto one plate is not sharing';
      },
      skipCount: d => {
        if (d.next !== d.a * 4) return 'next != a*4';
        if (d.a < 2 || d.a > MAXF) return 'a outside the 九九 range';
      }
    },

    /* 正解的第二套實作，只用原始參數重算。
       兩個「選項是算式」的產生器要重建字串，不是重算數字。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'productDirect': return String(d.a * d.b);
        case 'groupsOf':      return String(d.a * d.b);
        case 'repeatedAdd':   return d.a + ' × ' + d.b;
        case 'missingFactor': return String(d.b);
        case 'wordGroups':    return String(d.a * d.b);
        case 'timesWord':     return String(d.a * d.k);
        case 'howManyTimes':  return String(d.k);
        case 'arrayCount':    return String(d.r * d.c);
        case 'sameTotal':     return d.b + ' × ' + d.a;
        case 'shareOut':      return String(d.a);
        case 'skipCount':     return String(d.a * 4);
        default: return null;
      }
    },

    /* 選項形狀：多數是純數字（0~81）；兩個產生器的選項是算式字串。
       正解與誘答分開驗 —— 算式誘答可以是 `a + b`，但正解永遠是乘法算式。 */
    optionOk: function(s, genId, lang, isCorrect){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (EXPR_GENS[genId]){
        const m = String(s).match(/^\s*(\d+)\s*([×+])\s*(\d+)\s*$/);
        if (!m) return 'option ' + s + ' is not an a × b / a + b expression';
        if (isCorrect && m[2] !== '×') return 'the correct option must be a multiplication, got ' + s;
        const x = Number(m[1]), y = Number(m[3]);
        if (x < 2 || x > MAXF || y < 2 || y > MAXF)
          return 'option ' + s + ' uses a factor outside the 九九 range 2~9';
        if (m[2] === '×' && x * y > MAXP) return 'option ' + s + ' multiplies past ' + MAXP;
        return null;
      }
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      /* 正解一定是九九表裡的積（≤ 81）。誘答可以剛好越過一點點：「多加一組」
         在 9 × 9 時是 90，那是設計好的迷思，不是超綱 —— 但也不能無上限，
         最寬的誘答就是 p + a ≤ 81 + 9。正解與誘答分開驗。 */
      const hi = isCorrect ? MAXP : MAXP + MAXF;
      if (!(v >= 0 && v <= hi))
        return 'option ' + s + ' outside 0~' + hi + (isCorrect ? ' (key)' : ' (distractor)');
      return null;
    },

    /* 題幹是拼出來的，資料對不代表印出來的字是對的。連加題的題幹會印出
       b 個加項 —— 那個數量必須真的等於 b，不然孩子看到的是另一道題。 */
    renderCheck: function(d, q, lang, genId){
      if (genId === 'repeatedAdd'){
        const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
        const terms = (stem.match(new RegExp('(?<![0-9])' + d.a + '(?![0-9])', 'g')) || []).length;
        if (terms !== d.b)
          return 'the stem does not repeat a exactly b times (printed ' + terms + ', b = ' + d.b + ')';
      }
      if (genId === 'skipCount'){
        /* 抽出題幹裡真正的數字 token 再比對整個數列 —— 用 indexOf 的話，
           題幹印成 19 也會「含有」9，第三跳寫錯反而看不出來。 */
        const nums = (String(q.stem).replace(/<[^>]+>/g, ' ').match(/\d+/g) || []).map(Number);
        const want = [d.a, d.a * 2, d.a * 3];
        if (nums.length < want.length || want.some((v, i) => nums[i] !== v))
          return 'the skip-count stem is not a, 2a, 3a (printed ' + nums.join(',') + ')';
      }
      return null;
    },

    /* 刻意的迷思誘答：把題幹的數字端回來，而且那正是要考的錯。 */
    stemEchoOk: {
      /* 「p 是 a 的幾倍？」→ 誘答 a（把被比較的數本身當答案）與 p−a（差當成倍）。 */
      howManyTimes: function(d, opt){
        const v = Number(opt);
        return v === d.a || v === d.p - d.a;
      },
      /* 「p 顆平分到 b 盤」→ 誘答 b（把盤數當成每盤幾顆）。 */
      shareOut: function(d, opt){ return Number(opt) === d.b; },
      /* 「a × ? = p」→ 誘答 p−a（把乘法當成減法），以及 b±1（差一個）。
         b±1 在 b = a±1 時剛好等於題幹的 a，那是算術上的必然，不是題目被端回去。 */
      missingFactor: function(d, opt){
        const v = Number(opt);
        return v === d.p - d.a || v === d.b + 1 || v === d.b - 1;
      },
      /* 跳著數的題幹印了 a、2a、3a，誘答 3a 就是「沒有再跳一次」。 */
      skipCount: function(d, opt){ return Number(opt) === d.a * 3; },
      /* 「加起來」而不是「乘起來」是這一課最主要的迷思，所以 a+b 一定要在選項裡；
         而 b = 2（或 r = 2）時 p − a 剛好等於 a，看起來像把題幹抄回來 ——
         那是算術上的必然，不是把題目端回去。兩種都只放行「那一個算出來的值」。 */
      productDirect: function(d, opt){
        const v = Number(opt);
        return v === d.a + d.b || v === d.p - d.a || v === d.p + d.a;
      },
      groupsOf: function(d, opt){
        const v = Number(opt);
        return v === d.a + d.b || v === d.p - d.a || v === d.p + d.a;
      },
      wordGroups: function(d, opt){
        const v = Number(opt);
        return v === d.a + d.b || v === d.p - d.a || v === d.p + d.b;
      },
      timesWord: function(d, opt){
        const v = Number(opt);
        return v === d.a + d.k || v === d.p - d.a || v === d.a * (d.k + 1);
      },
      arrayCount: function(d, opt){
        const v = Number(opt);
        return v === d.r + d.c || v === d.p - d.c || v === d.p + d.c;
      },
      /* 連加式與交換律那兩題的選項本來就是用題幹的 a、b 組出來的算式。 */
      repeatedAdd: function(d, opt){ return /[×+]/.test(String(opt)); },
      sameTotal: function(d, opt){ return /[×+]/.test(String(opt)); }
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{GROUP_SIZES, MAX_PLATES, COOKIE, ARRAYS, TABLE_NS, ROUNDS}',
    optionValueMax: MAXP,

    check: function(data, I18N, fail){
      const LANGS = ['zh', 'en'];

      /* --- 範例 1：一盤一盤數 --- */
      if (data.MAX_PLATES < 2) fail(`MAX_PLATES ${data.MAX_PLATES} — one plate cannot show repeated groups`);
      data.GROUP_SIZES.forEach(a => {
        if (a < 2 || a > MAXF) fail(`GROUP_SIZES ${a} outside the 九九 range 2~${MAXF}`);
        if (a * data.MAX_PLATES > MAXP)
          fail(`GROUP_SIZES ${a} × MAX_PLATES ${data.MAX_PLATES} = ${a * data.MAX_PLATES} leaves the 九九 range`);
        LANGS.forEach(L => {
          for (let b = 1; b <= data.MAX_PLATES; b++){
            const say = I18N[L].grpSay(a, b, a * b);
            if (/undefined|NaN/.test(say)) fail(`grpSay ${L} ${a}×${b}: ${say}`);
            if (String(say).indexOf(String(a * b)) < 0)
              fail(`grpSay ${L} ${a}×${b} does not state the total ${a * b}`);
          }
          const plate = I18N[L].grpPlateNum(1);
          if (/undefined|NaN/.test(plate)) fail(`grpPlateNum ${L}: ${plate}`);
        });
      });
      if (!data.COOKIE) fail('COOKIE glyph is empty — the plates would render blank');

      /* --- 範例 2：排排隊看兩次（交換律） --- */
      data.ARRAYS.forEach(A => {
        if (A.r < 2 || A.c < 2) fail(`ARRAYS ${A.r}×${A.c}: a single row or column is not an array`);
        if (A.r > MAXF || A.c > MAXF) fail(`ARRAYS ${A.r}×${A.c} outside the 九九 range`);
        LANGS.forEach(L => {
          const total = A.r * A.c;
          const row = I18N[L].arrRow(A.r, A.c, total), col = I18N[L].arrCol(A.r, A.c, total);
          [row, col].forEach(t => {
            if (/undefined|NaN/.test(t)) fail(`array text ${L} ${A.r}×${A.c}: ${t}`);
            if (String(t).indexOf(String(total)) < 0)
              fail(`array text ${L} ${A.r}×${A.c} does not state the total ${total}`);
          });
          const aria = I18N[L].arrAria(A.r, A.c);
          if (/undefined|NaN/.test(aria)) fail(`arrAria ${L} ${A.r}×${A.c}: ${aria}`);
        });
      });
      /* 交換律要看得出來「橫著看和直著看一樣多」，正方形陣列示範不了那件事。 */
      if (!data.ARRAYS.some(A => A.r !== A.c))
        fail('ARRAYS never shows a non-square array, so 交換律 cannot be seen');

      /* --- 範例 3：乘法表跳跳看 --- */
      data.TABLE_NS.forEach(n => {
        if (n < 2 || n > MAXF) fail(`TABLE_NS ${n} outside the 九九 range 2~${MAXF}`);
        LANGS.forEach(L => {
          for (let k = 1; k <= MAXF; k++){
            const t = I18N[L].tabSay(n, k, n * k);
            if (/undefined|NaN/.test(t)) fail(`tabSay ${L} ${n}×${k}: ${t}`);
            if (String(t).indexOf(String(n * k)) < 0)
              fail(`tabSay ${L} ${n}×${k} does not state ${n * k}`);
          }
          const done = I18N[L].tabDone(n);
          if (/undefined|NaN/.test(done)) fail(`tabDone ${L} ${n}: ${done}`);
        });
      });

      /* --- 遊戲：餅乾工廠 --- */
      data.ROUNDS.forEach((r, i) => {
        if (r.a * r.b !== r.ans) fail(`ROUND ${i+1}: a×b = ${r.a * r.b} but ans is ${r.ans}`);
        if (r.a < 2 || r.a > MAXF || r.b < 2 || r.b > MAXF)
          fail(`ROUND ${i+1}: factors ${r.a}×${r.b} outside the 九九 range`);
        if (r.ans > MAXP) fail(`ROUND ${i+1}: answer ${r.ans} above ${MAXP}`);
        if (r.opts.indexOf(r.ans) < 0) fail(`ROUND ${i+1}: ans not among opts`);
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i+1}: duplicate opts`);
        r.opts.forEach(o => { if (o < 0 || o > MAXP) fail(`ROUND ${i+1}: option ${o} outside 0~${MAXP}`); });
        LANGS.forEach(L => {
          const ask = I18N[L].gAsk(r.a, r.b), aria = I18N[L].gAria(r.a, r.b);
          const h1 = I18N[L].gHint1(r.a), h2 = I18N[L].gHint2(r.a, r.a * (r.b - 1));
          [ask, aria, h1, h2].forEach(t => {
            if (/undefined|NaN/.test(t)) fail(`round ${i+1} ${L} text: ${t}`);
          });
          if (String(ask).indexOf(String(r.a)) < 0 || String(ask).indexOf(String(r.b)) < 0)
            fail(`gAsk ${L} round ${i+1} does not state both numbers`);
        });
      });
      if (data.ROUNDS.map(r => r.opts.indexOf(r.ans)).every(x => x === 0))
        fail('every game round has the answer first');
      /* 五關要真的越來越難，不然「下一關」沒有意義。 */
      const prods = data.ROUNDS.map(r => r.ans);
      if (prods[prods.length - 1] <= prods[0])
        fail('the last round is not harder than the first');
    }
  }
};
