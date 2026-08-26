/* grade-2/math/numbers（1000 以內的數）的檢查設定。

   這一課和 grade-2/multiply 是設定檔機制出現「之前」上線的，所以從 2026-08-25
   到 2026-08-26 之間，它們的產生器沒有任何 simgen／verify_lesson_data／breaktest
   的保護（`node tools/simgen.js …` 會直接報 no check config）。這份補上。

   範圍取自課程自己說的話：標題就是「1000 以內的數」，所以選項上限是 1000，
   不是隨手給一個寬鬆的大數 —— 2026-08-25 那一輪的教訓就是「斷言的上限要來自
   這一課自己宣告的限制」。 */

const PLACES = [100, 10, 1];          // 百、十、個
const MAX = 1000;                     // 課名就是 1000 以內

/* 每個產生器的選項範圍。沒列到的走預設 0~MAX。
   digitOf 問的是「某一位的數字」，答案與誘答都只能是一個數字。 */
const RANGE = { digitOf: [0, 9] };

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/numbers */
  breaks: [
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'correct is not the digit at that place',
      find:'        var correct = digs[pos];',
      replace:'        var correct = digs[(pos + 1) % 3];' },
    { file:'review', expect:'correct != dg * placeValue',
      find:'        var correct = dg * scale;',
      replace:'        var correct = dg * scale * 10;' },
    { file:'review', expect:'correct != t*10',
      find:'        var correct = t * 10;\n        /* 誘答都是「位值放錯」',
      replace:'        var correct = t * 100;\n        /* 誘答都是「位值放錯」' },
    { file:'review', expect:'correct != a*100 + b*10 + c',
      find:'        var n = a * 100 + b * 10 + c;\n        var m = mixOpts(n, [a * 100 + c * 10 + b,',
      replace:'        var n = a * 100 + b * 10 + c + 1;\n        var m = mixOpts(n, [a * 100 + c * 10 + b,' },
    { file:'review', expect:'correct != a*10',
      find:'        var correct = a * 10;\n        var m = mixOpts(correct, [a, correct + 10, correct - 10, correct + 100]);',
      replace:'        var correct = a * 100;\n        var m = mixOpts(correct, [a, correct + 10, correct - 10, correct + 100]);' },
    { file:'review', expect:'correct != b*100 + c',
      find:'        var correct = b * 100 + c;',
      replace:'        var correct = b * 100 + c * 10;' },
    { file:'review', expect:'biggest: correct is not the largest option',
      find:'        var correct = Math.max.apply(null, nums);',
      replace:'        var correct = Math.min.apply(null, nums);' },
    { file:'review', expect:'smallest: correct is not the smallest option',
      find:'        var correct = Math.min.apply(null, nums);\n        var m = pickAmong(nums, correct);\n        return { h1:h1,',
      replace:'        var correct = Math.max.apply(null, nums);\n        var m = pickAmong(nums, correct);\n        return { h1:h1,' },
    { file:'review', expect:'why says the tens decide it, but the tens are equal',
      find:'        var d1 = rand(10), d2 = rand(10);\n        while (d2 === d1) d2 = rand(10);',
      replace:'        var d1 = rand(10), d2 = d1;' },
    { file:'review', expect:'correct != n + 2',
      find:'        var correct = n + 2;',
      replace:'        var correct = n + 3;' },
    { file:'review', expect:'correct != start + 30',
      find:'        var correct = start + 30;',
      replace:'        var correct = start + 20;' },
    { file:'review', expect:'correct != n + 200',
      find:'        var correct = n + 200;',
      replace:'        var correct = n + 100;' },
    { file:'review', expect:'outside 0~1000',
      find:'        var base = pickUnused([1,2,3], used);\n        var n = base * 100 + rand(10) * 10 + rand(10);',
      replace:'        var base = pickUnused([7,8,9], used);\n        var n = base * 100 + rand(10) * 10 + rand(10);' },
    /* 這一行有兩個守門條件，只有 `v !== h * 100` 那一半有保護對象：
       把 9×9×9 的參數空間整個跑過一遍，`v === o` 一次都不會發生
       （候選只有 t、t*100、correct±10、correct+100，都碰不到個位數 o），
       所以改壞那一半不會有任何反應。改壞測試要打在打得到的那一半。
       `v !== o` 是多餘的守門條件，留著無害，但不要以為它有被驗過。 */
    { file:'review', expect:'copied straight out of the stem',
      find:'        cands = cands.filter(function(v){ return v !== h * 100 && v !== o; });',
      replace:'        cands = cands.filter(function(v){ return v !== o; });' },
    /* codex 第一輪（2026-08-26）指出的 fail-open：dg 與 pos 都是產生器給的，
       只比它們兩個等於自己比自己。 */
    { file:'review', expect:'is not the digit at position',
      find:'        var dg = digs[pos];',
      replace:'        var dg = digs[(pos + 1) % 3];' },
    { file:'review', expect:'does not name the',
      find:"            ? d.n + ' 的' + t.places[d.pos] + '數字是多少？'",
      replace:"            ? d.n + ' 的' + t.places[(d.pos + 1) % 3] + '數字是多少？'" },
    { file:'review', expect:'the skip-ten stem is not start',
      find:"        stem: d.start + '、' + (d.start + 10) + '、' + (d.start + 20) + '、?',",
      replace:"        stem: d.start + '、' + (d.start + 10) + '、' + (d.start + 30) + '、?'," },
    { file:'index', expect:'blocks say',
      find:'    { h:2, t:3,  o:4, ans:234, opts:[243, 234, 2304] },',
      replace:'    { h:2, t:3,  o:4, ans:243, opts:[243, 234, 2304] },' },
    { file:'index', expect:'ROUNDS never exercises 化聚',
      find:'    { h:0, t:12, o:0, ans:120, opts:[12, 102, 120] }',
      replace:'    { h:1, t:2,  o:0, ans:120, opts:[12, 102, 120] }' },
    { file:'index', expect:'PLACE_NUMS has no number with a 0 in the tens place',
      find:'  var PLACE_NUMS = [345, 508, 470, 906];',
      replace:'  var PLACE_NUMS = [345, 581, 470, 916];' },
    { file:'index', expect:'has no reading in',
      find:"      reads:{ 345:'三百四十五', 508:'五百零八', 470:'四百七十', 906:'九百零六' },",
      replace:"      reads:{ 345:'三百四十五', 508:'五百零八', 470:'四百七十' }," },
    { file:'index', expect:'PAIRS has no pair with a different number of digits',
      find:'    { a:89,  b:105 }',
      replace:'    { a:189, b:105 }' },
    { file:'index', expect:'PAIRS has no pair that ties on the hundreds',
      find:'    { a:307, b:370 },\n    { a:485, b:458 },',
      replace:'    { a:307, b:470 },\n    { a:485, b:258 },' },
    { file:'index', expect:'walks past 1000',
      find:'  var START_NUMS = [8, 97, 195];\n  var MAX_STEPS = 12;',
      replace:'  var START_NUMS = [8, 97, 995];\n  var MAX_STEPS = 12;' }
  ],

  sim: {
    /* 這一課的 fmt() 會用 TXT（題幹要印「百位／十位／個位」），而 TXT 宣告在
       「工具」那一段之前，所以把切片起點往前移到 TXT。中間那 37 行是純資料，
       不碰 DOM。 */
    blockStart: '  var TXT = {',

    /* 每個產生器一組「解釋說了什麼，資料就必須是那樣」的不變條件。
       沒有定義的產生器會被 simgen 判 NO INVARIANT DEFINED。 */
    INVARIANTS: {
      digitOf: d => {
        if (d.n !== d.h * 100 + d.t * 10 + d.o) return 'n != h*100+t*10+o';
        if (d.h < 1) return 'not a three-digit number';
        const digs = [d.h, d.t, d.o];
        if (digs[d.pos] !== d.correct) return 'correct is not the digit at that place';
        if (d.correct < 0 || d.correct > 9) return 'a place digit must be 0~9';
      },
      valueOfDigit: d => {
        /* dg 與 pos 都是產生器給的，只比它們兩個等於拿它自己比自己：
           先從 n 把那一位的數字挖出來，確認 dg 真的站在 pos 那一格。 */
        const digs = [Math.floor(d.n / 100), Math.floor(d.n / 10) % 10, d.n % 10];
        if (digs[d.pos] !== d.dg)
          return 'dg ' + d.dg + ' is not the digit at position ' + d.pos + ' of ' + d.n;
        if (d.dg * PLACES[d.pos] !== d.correct) return 'correct != dg * placeValue';
        /* 產生器刻意只挑非 0 的位（題幹是「N 表示多少」，N = 0 讀起來不成立）。
           將來若要出「0 表示多少」，這一條要連同題幹一起重新想。 */
        if (d.dg < 1) return 'why reads "the N stands for" — N must be a real digit, not 0';
        if (String(d.n).split('').filter(c => c === String(d.dg)).length !== 1)
          return 'the digit appears more than once, so "the {dg}" is ambiguous';
      },
      expandBlank: d => {
        if (d.correct !== d.t * 10) return 'correct != t*10';
        if (d.h * 100 + d.correct + d.o !== d.n) return 'the expansion does not add up to n';
        if (d.t < 1 || d.o < 1) return 'a 0 part would print "+ 0 +", which the stem does not intend';
      },
      buildFromParts: d => {
        if (d.n !== d.a * 100 + d.b * 10 + d.c) return 'correct != a*100 + b*10 + c';
        if (d.a < 1) return 'why talks about hundreds, so a must be >= 1';
      },
      regroupTens: d => {
        if (d.correct !== d.a * 10) return 'correct != a*10';
        if (d.a < 10) return 'why says "10 tens swap for 1 hundred" — needs at least 10 tens';
        if (d.correct > MAX) return 'result above the lesson range';
      },
      wordHundreds: d => {
        if (d.correct !== d.b * 100 + d.c) return 'correct != b*100 + c';
        if (d.c > 9) return 'the loose items must stay under one ten, or the stem is ambiguous';
        if (d.kind < 0 || d.kind > 2) return 'kind out of range';
      },
      biggest: d => {
        const nums = d.opts.map(Number);
        if (Math.max.apply(null, nums) !== d.correct) return 'biggest: correct is not the largest option';
        if (nums.some(v => Math.floor(v / 100) !== d.h))
          return 'why says every option shares the hundreds digit, but they do not';
      },
      smallest: d => {
        const nums = d.opts.map(Number);
        if (Math.min.apply(null, nums) !== d.correct) return 'smallest: correct is not the smallest option';
        if (Math.floor(d.correct / 100) !== d.h1) return 'the smallest is not in the low-hundreds group';
        /* why 說「百位一樣的再比十位」—— 要讓那句話成立，正解的十位必須**嚴格小於**
           同百位那一組裡其他每一個數的十位。（比「全部十位互不相同」寬，
           但更貼近解釋真正宣稱的事：決勝的是十位，不是個位。） */
        const lowOthers = nums.filter(v => Math.floor(v / 100) === d.h1 && v !== d.correct)
                              .map(v => Math.floor(v / 10) % 10);
        const ct = Math.floor(d.correct / 10) % 10;
        if (lowOthers.some(t => t <= ct)) return 'why says the tens decide it, but the tens are equal';
      },
      nextNumber: d => {
        if (d.correct !== d.n + 2) return 'correct != n + 2';
        if (d.n % 10 !== 8) return 'why is about crossing a ten — the stem must end in 8';
      },
      skipTen: d => {
        if (d.correct !== d.start + 30) return 'correct != start + 30';
        if (d.correct > MAX) return 'result above the lesson range';
      },
      skipHundred: d => {
        if (d.correct !== d.n + 200) return 'correct != n + 200';
        if (d.correct > MAX) return 'result above the lesson range';
        if (Math.floor(d.n / 100) + 2 > 9) return 'the hundreds digit would overflow';
      }
    },

    /* 正解字串的第二套實作：只用 make() 留下的原始參數重算，
       完全不碰產生器自己的 correct（拿它來比等於自己比自己）。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'digitOf':        return String([d.h, d.t, d.o][d.pos]);
        case 'valueOfDigit':   return String(d.dg * PLACES[d.pos]);
        case 'expandBlank':    return String(d.t * 10);
        case 'buildFromParts': return String(d.a * 100 + d.b * 10 + d.c);
        case 'regroupTens':    return String(d.a * 10);
        case 'wordHundreds':   return String(d.b * 100 + d.c);
        /* 這兩題的選項就是那四個數，正解是其中的極值 —— 從選項重算，
           不從 d.correct 讀。 */
        case 'biggest':        return String(Math.max.apply(null, d.opts.map(Number)));
        case 'smallest':       return String(Math.min.apply(null, d.opts.map(Number)));
        case 'nextNumber':     return String(d.n + 2);
        case 'skipTen':        return String(d.start + 30);
        case 'skipHundred':    return String(d.n + 200);
        default: return null;
      }
    },

    /* 題幹與解釋是拼出來的：位名（百位／十位／個位）從 TXT 取，數列的三個數
       也是現算的。資料全對、選項全對，印錯位名一樣會教錯 —— 所以在這裡把
       「畫面上真的印了什麼」再驗一次。位名在這裡寫第二份，正是神諭的意義。 */
    renderCheck: function(d, q, lang, genId){
      const PLACE_WORDS = { zh: ['百位', '十位', '個位'], en: ['hundreds', 'tens', 'ones'] };
      const stem = String(q.stem).replace(/<[^>]+>/g, ' ');
      const nums = (stem.match(/\d+/g) || []).map(Number);
      if (genId === 'digitOf' || genId === 'valueOfDigit'){
        const words = PLACE_WORDS[lang];
        const want = words[d.pos];
        /* 兩個產生器把位名印在不同地方：digitOf 的位名在**題幹**
           （「345 的十位數字是多少？」），valueOfDigit 的題幹只有數字，
           位名在**解釋**裡。所以要分開驗 —— 合起來驗的話，只改壞其中一邊
           另一邊會替它掩護（第一版就是這樣漏掉的）。 */
        const where = genId === 'digitOf' ? stem : String(q.why).replace(/<[^>]+>/g, ' ');
        const said = words.filter(w => where.indexOf(w) >= 0);
        if (said.indexOf(want) < 0)
          return genId + ' does not name the ' + want + ' place (said: ' + (said.join('/') || 'none') + ')';
        if (said.some(w => w !== want))
          return genId + ' names more than one place (' + said.join('/') + '), so the question is ambiguous';
        if (nums.indexOf(d.n) < 0) return genId + ' stem does not print the number ' + d.n;
      }
      if (genId === 'nextNumber' && (nums[0] !== d.n || nums[1] !== d.n + 1))
        return 'the counting stem is not n, n+1 (printed ' + nums.join(',') + ')';
      if (genId === 'skipTen' &&
          (nums[0] !== d.start || nums[1] !== d.start + 10 || nums[2] !== d.start + 20))
        return 'the skip-ten stem is not start, +10, +20 (printed ' + nums.join(',') + ')';
      if (genId === 'skipHundred' && (nums[0] !== d.n || nums[1] !== d.n + 100))
        return 'the skip-hundred stem is not n, n+100 (printed ' + nums.join(',') + ')';
      return null;
    },

    /* 哪些「把題幹的數字放進選項」是刻意的迷思誘答。
       兩個都是這一課明講要抓的錯，而且**只放行那一個值** —— 整個產生器全開的話，
       不小心抄回別的數字也會被一起蓋掉。 */
    stemEchoOk: {
      /* 「25 個十是多少？」→ 直接答 25：把「幾個十」的個數當成答案。 */
      regroupTens: function(d, opt){ return Number(opt) === d.a; },
      /* 「508 的 5 表示多少？」→ 直接答 5：只看數字、沒看它站在哪一位。 */
      valueOfDigit: function(d, opt){ return Number(opt) === d.dg; },
      /* 「1 個百、0 個十、0 個一」的誘答 a+b+c（把位值當成加起來）在數字小的時候
         剛好等於題幹印出來的某個數字。誘答本身是設計好的迷思，不是題幹被抄回來，
         所以只放行「剛好等於 a+b+c」的那一個值。 */
      buildFromParts: function(d, opt){ return Number(opt) === d.a + d.b + d.c; }
    },

    /* 選項一律是純數字，而且要落在這一課自己宣告的範圍裡。 */
    optionOk: function(s, genId){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const [lo, hi] = RANGE[genId] || [0, MAX];
      const v = Number(s);
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{START_NUMS, MAX_STEPS, PLACE_NUMS, PAIRS, ROUNDS, cmpNameZh, cmpNameEn}',
    /* 這一課**故意不設** optionValueMax。三層題庫裡「超出範圍」正是考點本身：
       608 寫成 6008、304 寫成 3004、30 個十算成 3000 —— 那些四位數誘答就是
       這一課要抓的迷思，設上限只會把刻意的教材判成缺陷。
       產生器那一側的範圍檢查在 sim.optionOk（0~1000），沒有放寬。 */

    check: function(data, I18N, fail){
      const LANGS = ['zh', 'en'];

      /* --- 範例 1：積木化聚（按 +1／+10 走 MAX_STEPS 步） --- */
      if (!data.START_NUMS.length) fail('START_NUMS is empty');
      data.START_NUMS.forEach(start => {
        if (start < 0 || start > MAX) fail(`START_NUMS ${start} outside 0~${MAX}`);
        /* 每一種步伐都要走得完 MAX_STEPS 步而不越界 —— 越界的話畫面上會出現
           四位數，而這一課只教到 1000。 */
        [1, 10].forEach(step => {
          const end = start + step * data.MAX_STEPS;
          if (end > MAX) fail(`START_NUMS ${start} +${step} × ${data.MAX_STEPS} = ${end} walks past ${MAX}`);
        });
      });
      /* 化聚是這一課的重點，所以起點裡一定要有一個會撞到「滿十進位」的。 */
      if (!data.START_NUMS.some(n => n % 10 === 8 || n % 10 === 9 || n % 100 >= 95))
        fail('no START_NUMS sits just below a regrouping boundary');

      /* --- 範例 2：位值表 --- */
      data.PLACE_NUMS.forEach(n => {
        if (n < 100 || n > 999) fail(`PLACE_NUMS ${n} is not a three-digit number`);
        LANGS.forEach(L => {
          const r = I18N[L].reads[n];
          if (!r) fail(`PLACE_NUMS ${n} has no reading in ${L}`);
          else if (/undefined|NaN/.test(String(r))) fail(`reads[${n}] ${L}: ${r}`);
        });
        const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
        LANGS.forEach(L => {
          const say = I18N[L].plcSay(h, t, o);
          if (/undefined|NaN/.test(say)) fail(`plcSay ${L} ${n}: ${say}`);
          [h, t, o].forEach(dg => {
            if (String(say).indexOf(String(dg)) < 0) fail(`plcSay ${L} ${n} does not mention ${dg}`);
          });
        });
      });
      /* 這一課明講的兩個迷思：0 佔位。範例裡一定要看得到。 */
      if (!data.PLACE_NUMS.some(n => Math.floor(n / 10) % 10 === 0))
        fail('PLACE_NUMS has no number with a 0 in the tens place (the lesson\'s main misconception)');
      if (!data.PLACE_NUMS.some(n => n % 10 === 0))
        fail('PLACE_NUMS has no number ending in 0');

      /* --- 範例 3：比大小 --- */
      data.PAIRS.forEach(p => {
        if (p.a === p.b) fail(`PAIRS ${p.a}/${p.b} are equal, so there is nothing to compare`);
        if (p.a > MAX || p.b > MAX) fail(`PAIRS ${p.a}/${p.b} outside the lesson range`);
        LANGS.forEach(L => {
          const big = Math.max(p.a, p.b), small = Math.min(p.a, p.b);
          const t = String(p.a).length !== String(p.b).length
            ? I18N[L].cmpLen(big, small)
            : I18N[L].cmpBig(0, String(big)[0], String(small)[0]);
          if (/undefined|NaN/.test(t)) fail(`compare text ${L} ${p.a}/${p.b}: ${t}`);
        });
      });
      if (!data.PAIRS.some(p => String(p.a).length !== String(p.b).length))
        fail('PAIRS has no pair with a different number of digits (the "more digits wins" case)');
      /* 兩個兩位數的 Math.floor(n/100) 都是 0，不加「三位數」這個條件的話，
         89/58 這種資料也會被當成「百位相同」而通過。 */
      if (!data.PAIRS.some(p => p.a >= 100 && p.b >= 100 &&
                                String(p.a).length === String(p.b).length &&
                                Math.floor(p.a / 100) === Math.floor(p.b / 100)))
        fail('PAIRS has no pair that ties on the hundreds (the "look at the next place" case)');

      /* --- 遊戲：倉庫點貨 --- */
      data.ROUNDS.forEach((r, i) => {
        const built = r.h * 100 + r.t * 10 + r.o;
        if (built !== r.ans) fail(`ROUND ${i+1}: blocks say ${built} but ans is ${r.ans}`);
        if (r.ans < 0 || r.ans > MAX) fail(`ROUND ${i+1}: answer ${r.ans} outside the lesson range`);
        if (r.opts.indexOf(r.ans) < 0) fail(`ROUND ${i+1}: ans not among opts`);
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i+1}: duplicate opts`);
        if (r.h < 0 || r.t < 0 || r.o < 0) fail(`ROUND ${i+1}: negative block count`);
        LANGS.forEach(L => {
          const aria = I18N[L].gAria(r.ans), hint = I18N[L].gHint2(r.h, r.t, r.o);
          if (/undefined|NaN/.test(aria)) fail(`gAria ${L} round ${i+1}: ${aria}`);
          if (/undefined|NaN/.test(hint)) fail(`gHint2 ${L} round ${i+1}: ${hint}`);
          if (String(aria).indexOf(String(r.ans)) < 0)
            fail(`gAria ${L} round ${i+1} does not say the number`);
        });
      });
      /* 化聚（十位超過 9）至少要出現一關，不然遊戲從沒考過這一課的重點。 */
      if (!data.ROUNDS.some(r => r.t > 9 || r.o > 9))
        fail('ROUNDS never exercises 化聚 (a tens/ones pile above 9)');
      /* 0 佔位也要考過一次。 */
      if (!data.ROUNDS.some(r => r.t === 0 || r.o === 0))
        fail('ROUNDS never exercises a 0 placeholder');
      if (data.ROUNDS.map(r => r.opts.indexOf(r.ans)).every(x => x === 0))
        fail('every game round has the answer first');
    }
  }
};
