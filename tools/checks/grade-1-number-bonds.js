/* grade-1/math/number-bonds 的檢查設定（10 以內數的分與合：合成、分解、湊十、數字家族）。 */

/* 解釋裡的算式逐條驗算 —— 實作在 tools/checks/lib/arith.js（全站唯一一份）。
   這一課幾乎沒有量詞緊貼在算式旁邊（why 大多是「3 和 4 合起來是 7」這種散文，
   沒有運算符號），只有英文版兩題 qs 的 why 直接寫成 "3 + 2 = 5." 這種算式，
   以及 qsBoost[1] 刻意寫錯的 "7+3=4"（用來說明「整體要放在等號一邊」）。 */
const arithNB = require('./lib/arith.js').makeArith({
  wrongOnPurpose: ["7+3=4"]
});

const { gameShuffleProblems } = require('./lib/gameshuffle.js');

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-1/math/number-bonds */
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:'    shuffle(round.choices).forEach(function(v){',
      replace:'    round.choices.forEach(function(v){' },
    { file:'review', expect:'why says a+b=s but a+b != s',
      find:"        var s = a + b;\n        /* 誘答刻意放 max(a, b)（只抄了大的那個數）；另一個加數不可以出現 */\n        var m = mixOpts(s, [s - 1, s + 1, Math.max(a, b)], avoidExcept([a, b], [Math.max(a, b)]));",
      replace:"        var s = a + b + 1;\n        /* 誘答刻意放 max(a, b)（只抄了大的那個數）；另一個加數不可以出現 */\n        var m = mixOpts(s, [s - 1, s + 1, Math.max(a, b)], avoidExcept([a, b], [Math.max(a, b)]));" },
    /* 2026-09-14：review 端的 makeWrongs 現在會避開題幹數字（avoid）。把 avoid 掏空，
       ±1 保底又會撞回題幹上的數字（例：wordProblemAdd 的 s − 1 在 b = 1 時就是 a），
       simgen 那條「誘答抄題幹」要響。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    /* avoidExcept 把「刻意的那一個」以外的題幹數字都擋掉；改成什麼都不擋，同一條要響。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'    return stemNums.filter(function(v){ return keep.indexOf(v) < 0; });',
      replace:'    return [];' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (c >= 0 && c <= MAX_OPT && !seen[key]){ seen[key] = true; out.push(c); }',
      replace:'      if (c >= 0 && c <= MAX_OPT){ out.push(c); }' },
    /* ⚠️ 沒有「刻意抄題幹」這一條的獨立改壞測試：這一課的 makeWrongs() 沒有排除
       「題幹上已經印出來的數字」，只排除正解本身，所以 missing±1／s±1 這類保底候選
       常常會巧合等於題幹另一個數字（known／remainder／n／target／a／10）——這是
       review.html 自己的缺陷，不是設定檔的洞（見 tools/README.md 這一課的段落）。
       原檔在很多種子下就已經在噴這一句話，改壞測試的「原檔必須先過」前提不成立，
       所以這裡不硬湊一筆測不出東西的假證明。 */
    { file:'index', expect:'FAMILIES[0]',
      find:'    [3,4,7], [2,5,7], [6,2,8], [3,5,8], [5,5,10], [4,6,10]',
      replace:'    [3,4,8], [2,5,7], [6,2,8], [3,5,8], [5,5,10], [4,6,10]' },
    { file:'index', expect:'ROUNDS[0] given+correct != target',
      find:"    { target:10, given:6, correct:4, choices:[4,5,3,6] },",
      replace:"    { target:10, given:6, correct:5, choices:[4,5,3,6] }," },
    { file:'index', expect:'TEN_CHOICES has 10 outside 1..9',
      find:'  var TEN_CHOICES = [1,2,3,4,6,7,8,9];',
      replace:'  var TEN_CHOICES = [1,2,3,4,6,7,8,10];' },
    { file:'index', expect:'icon counts',
      find:"        { stem:'🍎🍎🍎 + 🍎🍎 = ?', opts:['4','7','6','5'], ans:3, why:'3 個加 2 個，一共是 5 個。' },",
      replace:"        { stem:'🍎🍎🍎🍎 + 🍎🍎 = ?', opts:['4','7','6','5'], ans:3, why:'3 個加 2 個，一共是 5 個。' }," },
    { file:'index', expect:'was excused 1 time(s), expected 2',
      find:"why:'整體 7 要放在等號一邊，不能寫成 7+3=4，因為 4 只是最小的那一部分。'",
      replace:"why:'整體 7 要放在等號一邊，不能寫成 3+4=7，因為 4 只是最小的那一部分。'" }
  ],

  sim: {
    blockStart: '/* ---------- 靜態文字 ---------- */',
    INVARIANTS: {
      composeCalc: d => {
        if (d.a + d.b !== d.s) return 'why says a+b=s but a+b != s';
        if (d.s > 10) return 'sum exceeds the lesson range (within 10)';
        if (d.a < 1 || d.b < 1) return 'addend below 1';
      },
      decomposeFindPart: d => {
        if (d.known + d.missing !== d.whole) return 'known+missing != whole';
        if (d.missing < 1 || d.missing >= d.whole) return 'missing out of range (1..whole-1)';
      },
      decomposeFindSubtrahend: d => {
        if (d.whole - d.missing !== d.remainder) return 'whole-missing != remainder';
        if (d.missing < 1 || d.missing >= d.whole) return 'missing out of range (1..whole-1)';
      },
      bondsToTen: d => {
        if (d.n + d.need !== 10) return 'n+need != 10';
        if (d.need < 1 || d.need > 9) return 'need out of range';
      },
      bondsToOther: d => {
        if (d.n + d.need !== d.target) return 'n+need != target';
        if (d.need < 1 || d.need >= d.target) return 'need out of range';
      },
      familyInverse: d => {
        if (d.whole - d.a !== d.b) return 'whole-a != b';
        if (d.a + d.b !== d.whole) return 'a+b != whole';
      },
      wordProblemAdd: d => {
        if (d.a + d.b !== d.s) return 'a+b != s';
        if (d.s > 9) return 'sum exceeds this generator\'s own bound';
      },
      wordProblemSplit: d => {
        if (d.known + d.missing !== d.whole) return 'known+missing != whole';
      }
    },
    /* 正解字串的第二套實作。
       ⚠️ 規則：**只讀題幹上真的印出來的那幾個數字**，然後自己算一次。
       不可以讀回 make() 算好的答案欄位（s／missing／need／b）—— 那等於拿課本的答案
       比課本的答案，課本算錯時兩邊一起錯，檢查照樣綠燈。
       每一行上面的註解是「孩子看到的題幹」，答案就是從那句話推出來的。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        /* 「a + b = ?」 */
        case 'composeCalc':             return String(d.a + d.b);
        /* 「whole 可以分成 known 和 ___？」 */
        case 'decomposeFindPart':       return String(d.whole - d.known);
        /* 「whole − ___ = remainder？」 */
        case 'decomposeFindSubtrahend': return String(d.whole - d.remainder);
        /* 「n + ___ = 10」 */
        case 'bondsToTen':              return String(10 - d.n);
        /* 「n + ___ = target」 */
        case 'bondsToOther':            return String(d.target - d.n);
        /* 「whole − a = b，那麼 a + ___ = whole？」—— 問的是 whole − a。 */
        case 'familyInverse':           return String(d.whole - d.a);
        /* 「小美有 a 顆，朋友再給 b 顆，一共幾顆？」 */
        case 'wordProblemAdd':          return String(d.a + d.b);
        /* 「whole 顆分成 2 盤，一盤 known 顆，另一盤幾顆？」 */
        case 'wordProblemSplit':        return String(d.whole - d.known);
        default: throw new Error('unknown genId ' + genId);
      }
    },
    /* 選項一律是 0~10 的純數字（這一課是「10 以內數的分與合」）。 */
    optionOk: function(s){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      if (!(v >= 0 && v <= 10)) return 'option ' + s + ' outside 0~10';
      return null;
    },
    /* 哪些「把題幹的數字抄回選項」是刻意的迷思誘答（不是缺陷）。
       composeCalc 的 max(a,b)、decomposeFindPart 的 whole、decomposeFindSubtrahend 的
       remainder、bondsToTen 的 n、bondsToOther 的 target、familyInverse 的 a、
       wordProblemSplit 的 whole，都是題幹本來就會印出來的數字，設計上刻意拿來當誘答。
       wordProblemAdd 的 |a − b|（該加卻減）本身不是題幹數字，但 a = 2b 時剛好等於 b、
       b = 2a 時剛好等於 a —— 那仍然是同一個迷思的結果，放行的是這一個值而不是整個產生器。
       其餘的題幹數字（另一個加數、分成「2 盤」的 2……）review.html 的 makeWrongs 現在
       用 avoid 擋掉，這裡沒有放行 → 再出現就是缺陷。 */
    stemEchoOk: {
      composeCalc: (d, opt) => Number(opt) === Math.max(d.a, d.b),
      wordProblemAdd: (d, opt) => Number(opt) === Math.abs(d.a - d.b),
      decomposeFindPart: (d, opt) => Number(opt) === d.whole,
      decomposeFindSubtrahend: (d, opt) => Number(opt) === d.remainder,
      bondsToTen: (d, opt) => Number(opt) === d.n,
      bondsToOther: (d, opt) => Number(opt) === d.target,
      familyInverse: (d, opt) => Number(opt) === d.a,
      wordProblemSplit: (d, opt) => Number(opt) === d.whole
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{COMBINE_ICONS, COMBINE_SETS, DOT_TOTAL, TEN_CHOICES, FAMILIES, ROUNDS}',
    optionValueMax: 10,
    check: function(data, I18N, fail, src){
      /* --- 範例 1：推在一起 --- */
      if (data.COMBINE_ICONS.length !== data.COMBINE_SETS.length)
        fail('COMBINE_ICONS/COMBINE_SETS length mismatch');
      ['zh','en'].forEach(L => {
        const labels = I18N[L].cSetLabels;
        if (!labels || labels.length !== data.COMBINE_SETS.length) fail('cSetLabels ' + L + ' length mismatch');
      });
      data.COMBINE_SETS.forEach((s, i) => {
        if (s.a < 1 || s.b < 1) fail('COMBINE_SETS[' + i + '] has a non-positive addend');
        if (s.a + s.b > 10) fail('COMBINE_SETS[' + i + '] sum exceeds the lesson range (within 10)');
      });

      /* --- 範例 2：分一分 --- */
      if (!(data.DOT_TOTAL >= 2 && data.DOT_TOTAL <= 10)) fail('DOT_TOTAL out of range: ' + data.DOT_TOTAL);

      /* --- 範例 3：湊十好朋友 --- */
      {
        const seenT = new Set();
        data.TEN_CHOICES.forEach(n => {
          if (!(n >= 1 && n <= 9)) fail('TEN_CHOICES has ' + n + ' outside 1..9');
          if (seenT.has(n)) fail('TEN_CHOICES has duplicate ' + n);
          seenT.add(n);
        });
      }

      /* --- 範例 4：數字家族 --- */
      data.FAMILIES.forEach((f, i) => {
        const a = f[0], b = f[1], c = f[2];
        if (a + b !== c) fail('FAMILIES[' + i + '] ' + a + '+' + b + ' != ' + c);
        if (c - a !== b) fail('FAMILIES[' + i + '] ' + c + '-' + a + ' != ' + b);
        if (c - b !== a) fail('FAMILIES[' + i + '] ' + c + '-' + b + ' != ' + a);
        if (c > 10) fail('FAMILIES[' + i + '] whole exceeds the lesson range (within 10)');
        if (a < 1 || b < 1) fail('FAMILIES[' + i + '] has a non-positive part');
      });

      /* --- 小遊戲：湊十小幫手 --- */
      data.ROUNDS.forEach((r, i) => {
        if (r.given + r.correct !== r.target) fail('ROUNDS[' + i + '] given+correct != target');
        if (r.choices.indexOf(r.correct) < 0) fail('ROUNDS[' + i + '] correct not among choices');
        if (new Set(r.choices).size !== r.choices.length) fail('ROUNDS[' + i + '] duplicate choices');
        r.choices.forEach(v => { if (!(v >= 0 && v <= 10)) fail('ROUNDS[' + i + '] choice ' + v + ' outside 0..10'); });
        if (!(r.target >= 1 && r.target <= 10)) fail('ROUNDS[' + i + '] target out of range');
        ['zh','en'].forEach(L => {
          const t1 = I18N[L].gCorrectFirst(r.given, r.correct, r.target);
          const t2 = I18N[L].gCorrectRetry(r.given, r.correct, r.target);
          const h1 = I18N[L].gHint1(r.target, r.given);
          const h2 = I18N[L].gHint2(r.target, r.given);
          const ask = I18N[L].gAsk(r.given, r.target);
          [t1, t2, h1, h2, ask].forEach(t => {
            if (/undefined|NaN/.test(t)) fail('ROUNDS[' + i + '] ' + L + ' text has undefined/NaN: ' + t);
          });
          if (h2.indexOf(String(r.target - r.given)) < 0)
            fail('ROUNDS[' + i + '] ' + L + ' hint2 does not state the actual difference');
        });
      });
      /* 小遊戲的選項要洗牌（正解不可以固定在同一個位置）——
         守的是**畫出來的按鈕**，不是 choices 陣列裡的順序，實作在 lib/gameshuffle.js。 */
      gameShuffleProblems(src, 1).forEach(fail);

      /* --- 試題：圖示型算式（🍎🍎🍎 + 🍎🍎 = ?）要真的數出來對得上答案 ---
         這種題幹沒有數字，一般的算式驗算器讀不到，一定要另外數 emoji。 */
      ['qs','qsAdv','qsBoost'].forEach(bank => {
        ['zh','en'].forEach(L => {
          (I18N[L][bank] || []).forEach((q, i) => {
            const m = q.stem.match(/^([^\d\s+=?<]+)\s*\+\s*([^\d\s+=?<]+)\s*=\s*\?$/);
            if (m){
              const c1 = [...m[1]].length, c2 = [...m[2]].length;
              const want = c1 + c2;
              if (Number(q.opts[q.ans]) !== want)
                fail(`${bank}[${i}] ${L}: icon counts ${c1}+${c2}=${want} but marked answer is ${q.opts[q.ans]}`);
            }
          });
        });
      });

      /* --- 試題：解釋裡真的寫成算式的那幾條要逐條驗算（issue #2 的做法） ---
         這一課的 why 大多是散文（「3 和 4 合起來是 7」），沒有運算符號，
         驗不到也是對的；只有英文版兩題直接寫成 "3 + 2 = 5." 這種算式，
         和 qsBoost[1] 刻意寫錯的 "7+3=4"，才會真的被驗算器咬到。 */
      {
        let vSum = 0, qSum = 0;
        ['qs','qsAdv','qsBoost'].forEach(bank => {
          ['zh','en'].forEach(L => {
            (I18N[L][bank] || []).forEach((q, i) => {
              if (typeof q.why !== 'string') return;
              const r = arithNB(q.why);
              vSum += r.verified; qSum += r.questions;
              r.problems.forEach(p => fail(`${bank}[${i}] ${L}.why: ${p}`));
            });
          });
        });
        if (vSum !== 2) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 2`);
        if (qSum !== 0) fail(`question-shaped equations changed: found ${qSum}, expected 0`);
        arithNB.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale, and it would silently excuse that equation`));
        {
          const want = { "7+3=4": 2 };
          const got = arithNB.excuseCounts();
          Object.keys(want).forEach(k => {
            if (got[k] !== want[k]) fail(`wrongOnPurpose "${k}" was excused ${got[k]} time(s), expected ${want[k]}`);
          });
        }
        {
          const list = arithNB.verifiedAll();
          const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
          if (digest !== 'd6e19c68a8e2'){
            fail(`the set of verified equations changed (digest ${digest}, expected d6e19c68a8e2)\n      now: ${list.join(' | ')}`);
          }
        }
      }
    }
  }
};
