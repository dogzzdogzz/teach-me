/* grade-1/math/two-digit 的檢查設定（兩位數加減：不進位／不退位、對齊、加減互逆）。

   ⚠️ 這一課的 review.html 每一題只有 3 個選項（正解 + 2 個錯的），不是全站慣例的 4 個
   （makeWrongs 保底迴圈用 `out.length < 2`、`out.slice(0, 2)`）。
   ✅ 2026-09-14：simgen.js／verify_lesson_data.js 已經支援每課自訂選項數，這一課用
   下面的 `sim.optCount: 3` 與 `data.optCount`（qs/qsAdv 3、qsBoost 2）宣告，
   所以選項數這一條現在是真的在看，不再是「結構上不可能全綠」。 */

const arithTD = require('./lib/arith.js').makeArith({ units: ['元'], unitsEn: ['dollars?'] });

/* 選項的合理範圍，依產生器分開給：兩位數加減宣稱「0~99」，刻意的「差 10」誘答
   （進位/借位教學常見的迷思）在 sum ≥ 90 時會變 100~109，2026-09-14 起由 review.html 的
   makeWrongs 擋掉（一年級的課不放三位數），所以這裡也是 99；20 以內加減、位值、
   分與合則各自更窄。 */
const RANGE = {
  /* 2026-09-14 起 review.html 的 makeWrongs 連明寫的候選都擋在 MAX_OPT = 99 以內（sum + 10 在
     sum ≥ 90 時會變 100~109，一年級「100 以內」的課不放三位數），所以這裡從 109 收緊到 99。 */
  addNoRegroup:[0,99], subNoRegroup:[0,99], addOneDigit:[0,99], subOneDigit:[0,99],
  inverseCheck:[0,99], wordProblem:[0,99], placeValue:[0,10], numberBonds:[0,10], addSub20:[0,21]
};

const { gameShuffleProblems } = require('./lib/gameshuffle.js');

module.exports = {
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:'    shuffle(round.choices).forEach(function(v){',
      replace:'    round.choices.forEach(function(v){' },
    { file:'review', expect:'ones carry but why says no regroup',
      find:'      if (da.o + db.o <= 9 && da.t + db.t <= 9) return { a:a, b:b, sum:a + b };',
      replace:'      if (da.o + db.o <= 10 && da.t + db.t <= 9) return { a:a, b:b, sum:a + b };' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 3 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (!seen[key] && c >= 0 && c <= MAX_OPT){ seen[key] = true; out.push(c); }',
      replace:'      if (c >= 0 && c <= MAX_OPT){ out.push(c); }' },
    /* 這一課的上限 MAX_OPT = 99 同時管 addOneDigit 的「wrongTens 變三位數就退而放 sum + 10」與
       makeWrongs 的候選／保底範圍；把它放寬到 999，141 那類三位數（以及 sum + 10 = 100~109）
       就會直接端出來，RANGE 那條「outside 0~99」要響。（以前那筆把 p 釘成 81 + 9 等 171：
       81 + 9 個位其實會進位，不變條件會先罵；而且現在 makeWrongs 會把 171 擋掉，證明不了 RANGE 在看。） */
    { file:'review', expect:'outside 0~99 for this generator',
      find:'  var MAX_OPT = 99;',
      replace:'  var MAX_OPT = 999;' },
    /* 2026-09-14：review 端的 makeWrongs 現在會避開題幹數字（avoid）。把 avoid 掏空，
       ±1 保底又會撞回題幹上的數字（例：subOneDigit 的 diff + 1 在 b = 1 時就是 a），
       simgen 那條「誘答抄題幹」要響。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    { file:'index', expect:'ADD_PAIRS[0] carries',
      find:'    { a:{t:3,o:2}, b:{t:2,o:5} },  // 32 + 25 = 57',
      replace:'    { a:{t:3,o:2}, b:{t:2,o:8} },  // deliberately broken: 2+8 carries' },
    { file:'index', expect:'SUB_PAIRS[0] needs a borrow',
      find:'    { a:{t:5,o:7}, b:{t:2,o:3} },  // 57 − 23 = 34',
      replace:'    { a:{t:5,o:7}, b:{t:2,o:9} },  // deliberately broken: 7-9 needs a borrow' },
    { file:'index', expect:'ROUNDS[0] 32+25 != 58',
      find:'    { op:\'add\', a:{t:3,o:2}, b:{t:2,o:5}, ans:57, choices:[57,37,75,52] },',
      replace:'    { op:\'add\', a:{t:3,o:2}, b:{t:2,o:5}, ans:58, choices:[57,37,75,52] },' }
    /* ⚠️ 資料裡 5 關都把正解放在 choices[0] —— 這**不是**缺陷：畫按鈕之前會
       shuffle()，所以畫面上的位置和陣列順序無關。真正要守的是「有沒有洗牌」，
       由 lib/gameshuffle.js 的斷言＋上面那一筆改壞測試負責。 */
  ],

  sim: {
    /* 這一課整份都是 3 選項（一年級的題目選項少一點才讀得完）。 */
    optCount: 3,
    blockStart: '  /* ---------- 靜態文字 ---------- */',
    INVARIANTS: {
      addNoRegroup: d => {
        const da = { t: Math.floor(d.p.a / 10), o: d.p.a % 10 }, db = { t: Math.floor(d.p.b / 10), o: d.p.b % 10 };
        if (da.o + db.o > 9) return 'ones carry but why says no regroup';
        if (da.t + db.t > 9) return 'tens overflow past two digits';
        if (d.p.a + d.p.b !== d.p.sum) return 'a+b != sum';
      },
      subNoRegroup: d => {
        const da = { t: Math.floor(d.p.a / 10), o: d.p.a % 10 }, db = { t: Math.floor(d.p.b / 10), o: d.p.b % 10 };
        if (da.o < db.o) return 'ones need a borrow but why says no regroup';
        if (da.t < db.t) return 'tens digit would go negative';
        if (d.p.a - d.p.b !== d.p.diff) return 'a-b != diff';
        if (d.p.diff <= 0) return 'non-positive difference';
      },
      addOneDigit: d => {
        const da = { t: Math.floor(d.p.a / 10), o: d.p.a % 10 };
        if (da.o + d.p.b > 9) return 'ones carry but why says the tens digit stays the same';
        if (d.p.a + d.p.b !== d.p.sum) return 'a+b != sum';
        if (d.p.b < 1 || d.p.b > 9) return 'b is not a one-digit number';
      },
      subOneDigit: d => {
        const da = { t: Math.floor(d.p.a / 10), o: d.p.a % 10 };
        if (da.o < d.p.b) return 'ones need a borrow but why says the tens digit stays the same';
        if (d.p.a - d.p.b !== d.p.diff) return 'a-b != diff';
        if (d.p.b < 1 || d.p.b > 9) return 'b is not a one-digit number';
      },
      inverseCheck: d => {
        if (d.p.a + d.p.b !== d.p.sum) return 'a+b != sum';
      },
      wordProblem: d => {
        const val = d.isAdd ? d.p.a + d.p.b : d.p.a - d.p.b;
        if (val !== (d.isAdd ? d.p.sum : d.p.diff)) return 'story arithmetic does not match the underlying pair';
        if (d.name < 0 || d.name > 3) return 'name index out of range';
      },
      placeValue: d => {
        if (Math.floor(d.n / 10) !== d.d.t) return 'floor(n/10) != tens digit';
        if (d.n % 10 !== d.d.o) return 'n%10 != ones digit';
        if (d.n < 10 || d.n > 99) return 'n outside 10~99';
      },
      numberBonds: d => {
        if (d.part1 + d.part2 !== d.whole) return 'part1+part2 != whole';
        if (d.part1 < 1 || d.part2 < 1) return 'a part is non-positive';
        if (d.whole < 5 || d.whole > 10) return 'whole outside 5~10';
      },
      addSub20: d => {
        const want = d.isAdd ? d.a + d.b : d.a - d.b;
        if (want !== d.ans2) return 'a op b != ans2';
        if (d.ans2 < 0 || d.ans2 > 20) return 'ans2 outside 0~20';
      }
    },
    /* 正解字串的第二套實作。
       ⚠️ 規則：**只讀題幹上真的印出來的那幾個數字**，然後自己算一次。
       不可以讀回 make() 算好的答案欄位（p.sum／p.diff／p.a／d.t／part2／ans2）——
       那等於拿課本的答案比課本的答案，課本算錯時兩邊一起錯，檢查照樣綠燈。
       ⚠️ inverseCheck 特別注意：題幹問的是 sum − b，**不是**把另一個加數 a 抄回來。
       兩者相等正是這一題要教的事（加減互逆），所以要算的必須是題目問的那一邊，
       這樣 randAddPair() 的 sum 算錯時才會被抓到。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        /* 「a + b = ?」（不進位） */
        case 'addNoRegroup': return String(d.p.a + d.p.b);
        /* 「a − b = ?」（不退位） */
        case 'subNoRegroup': return String(d.p.a - d.p.b);
        /* 「a + b = ?」（兩位數加一位數） */
        case 'addOneDigit':  return String(d.p.a + d.p.b);
        /* 「a − b = ?」（兩位數減一位數） */
        case 'subOneDigit':  return String(d.p.a - d.p.b);
        /* 「a + b = sum，所以 sum − b = ?」 */
        case 'inverseCheck': return String(d.p.sum - d.p.b);
        /* 「原本有 a 元，又得到／花掉 b 元，現在／還剩多少元？」 */
        case 'wordProblem':  return String(d.isAdd ? d.p.a + d.p.b : d.p.a - d.p.b);
        /* 「n 的十位是多少？」 */
        case 'placeValue':   return String(Math.floor(d.n / 10));
        /* 「whole 可以分成 part1 和多少？」 */
        case 'numberBonds':  return String(d.whole - d.part1);
        /* 「a + b = ?」或「a − b = ?」（20 以內） */
        case 'addSub20':     return String(d.isAdd ? d.a + d.b : d.a - d.b);
        default: throw new Error('unknown genId ' + genId);
      }
    },
    optionOk: function(s, genId){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      const [lo, hi] = RANGE[genId] || [0, 109];
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi + ' for this generator';
      return null;
    },
    /* inverseCheck 的題幹本來就把 b 和 sum 都印出來（a+b=sum，所以 sum-b=?），
       兩個候選誘答剛好就是這兩個數字，是刻意設計；numberBonds 的 whole 同理。
       其餘的題幹數字（a、b、part1……）review.html 的 makeWrongs 現在用 avoid 擋掉，
       這裡沒有放行 → 再出現就是缺陷（2026-09-14）。 */
    stemEchoOk: {
      inverseCheck: (d, opt) => Number(opt) === d.p.b || Number(opt) === d.p.sum,
      numberBonds: (d, opt) => Number(opt) === d.whole
    }
  },

  data: {
    /* qs／qsAdv 是 3 選項，qsBoost 那兩題是是非題（2 選項）。 */
    optCount: { qs: 3, qsAdv: 3, qsBoost: 2 },
    /* 這一課的畫圖工具（blocksSvg／opGroupsHTML／alignPicHTML）緊接在腳本最前面，
       和三張資料表、ROUNDS 同一段、不碰 DOM，剛好可以一次切出來。 */
    dataStart: '  /* ---------- 語言無關的畫圖工具 ---------- */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{blocksSvg, opGroupsHTML, alignPicHTML, ADD_PAIRS, ALIGN_PAIRS, SUB_PAIRS, ROUNDS}',
    optionValueMax: 109,
    check: function(data, I18N, fail, src){
      const { canvasProblems } = require('./lib/canvas.js');

      /* --- 範例 1：兩位數加兩位數（不進位） --- */
      data.ADD_PAIRS.forEach((p, i) => {
        if (p.a.o + p.b.o > 9) fail('ADD_PAIRS[' + i + '] carries in the ones place');
        if (p.a.t + p.b.t > 9) fail('ADD_PAIRS[' + i + '] carries past two digits in the tens place');
        /* opGroupsHTML wraps THREE separate <svg> blocks (a, b, result) inside one
           <div> — canvasProblems only understands a single root <svg>, so it has to
           be called on each blocksSvg() output on its own, not on the combined HTML
           (calling it on the combined blob makes canvasProblems read the FIRST
           svg's width/height as the canvas while it scans <circle>s from all three,
           which manufactures a fake out-of-bounds report — it already flags that
           shape as "nested <svg>", so anything else it says about that call is not
           trustworthy). */
        [[p.a.t, p.a.o], [p.b.t, p.b.o], [p.a.t + p.b.t, p.a.o + p.b.o]].forEach(([t, o]) => {
          canvasProblems(data.blocksSvg(t, o)).forEach(msg => fail('ADD_PAIRS[' + i + '] blocksSvg(' + t + ',' + o + '): ' + msg));
        });
        const aVal = p.a.t * 10 + p.a.o, bVal = p.b.t * 10 + p.b.o, sum = (p.a.t + p.b.t) * 10 + (p.a.o + p.b.o);
        ['zh','en'].forEach(L => {
          const t = I18N[L].addLine(aVal, bVal, p.a.t, p.a.o, p.b.t, p.b.o, p.a.t + p.b.t, p.a.o + p.b.o, sum);
          if (/undefined|NaN/.test(t)) fail('ADD_PAIRS[' + i + '] addLine ' + L + ': ' + t);
        });
      });

      /* --- 範例 2：直式對齊 --- */
      data.ALIGN_PAIRS.forEach((p, i) => {
        if (p.b < 1 || p.b > 9) fail('ALIGN_PAIRS[' + i + '] b is not a one-digit number');
        if (p.aO + p.b > 9) fail('ALIGN_PAIRS[' + i + '] correct alignment would still carry (aO+b>9)');
        const right = data.alignPicHTML(p.aT, p.aO, p.b, false, '十位', '個位');
        const wrong = data.alignPicHTML(p.aT, p.aO, p.b, true, '十位', '個位');
        const aVal = p.aT * 10 + p.aO;
        if (right.resultVal !== aVal + p.b) fail('ALIGN_PAIRS[' + i + '] correctly-aligned result != a+b');
        if (wrong.resultVal === aVal + p.b) fail('ALIGN_PAIRS[' + i + '] the misaligned demo accidentally gives the right answer — it no longer teaches the mistake');
        if (wrong.resultVal !== (p.aT + p.b) * 10 + p.aO) fail('ALIGN_PAIRS[' + i + '] misaligned result does not match "b added into the tens column"');
        ['zh','en'].forEach(L => {
          const t1 = I18N[L].alignExplainRight(aVal, p.b, right.resultVal);
          const t2 = I18N[L].alignExplainWrong(aVal, p.b, wrong.resultVal);
          [t1, t2].forEach(t => { if (/undefined|NaN/.test(t)) fail('ALIGN_PAIRS[' + i + '] ' + L + ' text has undefined/NaN: ' + t); });
        });
      });

      /* --- 範例 3：兩位數減兩位數（不退位） --- */
      data.SUB_PAIRS.forEach((p, i) => {
        if (p.a.o < p.b.o) fail('SUB_PAIRS[' + i + '] needs a borrow in the ones place');
        if (p.a.t < p.b.t) fail('SUB_PAIRS[' + i + '] would go negative in the tens place');
        [[p.a.t, p.a.o], [p.b.t, p.b.o], [p.a.t - p.b.t, p.a.o - p.b.o]].forEach(([t, o]) => {
          canvasProblems(data.blocksSvg(t, o)).forEach(msg => fail('SUB_PAIRS[' + i + '] blocksSvg(' + t + ',' + o + '): ' + msg));
        });
        const aVal = p.a.t * 10 + p.a.o, bVal = p.b.t * 10 + p.b.o, diff = (p.a.t - p.b.t) * 10 + (p.a.o - p.b.o);
        ['zh','en'].forEach(L => {
          const t = I18N[L].subLine(aVal, bVal, p.a.t, p.a.o, p.b.t, p.b.o, p.a.t - p.b.t, p.a.o - p.b.o, diff);
          if (/undefined|NaN/.test(t)) fail('SUB_PAIRS[' + i + '] subLine ' + L + ': ' + t);
        });
      });

      /* --- 範例 4：加減互逆（重用 ADD_PAIRS，見上面已驗過不進位） --- */

      /* --- 小遊戲 --- */
      data.ROUNDS.forEach((r, i) => {
        const aVal = r.a.t * 10 + r.a.o, bVal = r.b.t * 10 + r.b.o;
        const val = r.op === 'add' ? aVal + bVal : aVal - bVal;
        if (val !== r.ans) fail('ROUNDS[' + i + '] ' + aVal + (r.op === 'add' ? '+' : '-') + bVal + ' != ' + r.ans);
        if (r.choices.indexOf(r.ans) < 0) fail('ROUNDS[' + i + '] ans not among choices');
        if (new Set(r.choices).size !== r.choices.length) fail('ROUNDS[' + i + '] duplicate choices');
        ['zh','en'].forEach(L => {
          const ask = I18N[L].gAsk(aVal, bVal, r.op);
          const c1 = I18N[L].gCorrectFirst(r.ans), c2 = I18N[L].gCorrectRetry(r.ans);
          [ask, c1, c2].forEach(t => { if (/undefined|NaN/.test(t)) fail('ROUNDS[' + i + '] ' + L + ' text has undefined/NaN: ' + t); });
        });
      });
      /* 小遊戲的選項要洗牌（正解不可以固定在同一個位置）——
         守的是**畫出來的按鈕**，不是 choices 陣列裡的順序，實作在 lib/gameshuffle.js。 */
      gameShuffleProblems(src, 1).forEach(fail);

      /* --- 試題：解釋裡真的寫成算式的那幾條要逐條驗算 --- */
      {
        let vSum = 0, qSum = 0;
        ['qs','qsAdv','qsBoost'].forEach(bank => {
          ['zh','en'].forEach(L => {
            (I18N[L][bank] || []).forEach((q, i) => {
              [['stem', q && q.stem], ['why', q && q.why]].forEach(([field, text]) => {
                if (typeof text !== 'string') return;
                const r = arithTD(text);
                vSum += r.verified; qSum += r.questions;
                r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
              });
            });
          });
        });
        if (vSum !== 54) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 54`);
        if (qSum !== 7) fail(`question-shaped equations changed: found ${qSum}, expected 7`);
        arithTD.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale`));
      }
    }
  }
};
