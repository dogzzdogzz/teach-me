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
/* 小遊戲的結語（「十位 3 + 2 = 5」「57 − 25 = 32」）另外用一個驗算器：試題那一個的覆蓋率摘要不要被遊戲的字串攪動。 */
const arithGame = require('./lib/arith.js').makeArith({});

module.exports = {
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });" },
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
    /* --- 小遊戲（2026-10-01 改成五關五種玩法）：每一條不變量各有一筆，證明它真的會響 --- */
    { file:'index', expect:'GAME_BANK[0] 35+25 carries',
      find:'    { a:32, b:25 }, { a:23, b:15 }, { a:41, b:34 },',
      replace:'    { a:35, b:25 }, { a:23, b:15 }, { a:41, b:34 },' },
    { file:'index', expect:'GAME_BANK[1] b = 16 needs 1..3 tens and 1..5 ones',
      find:'    { a:32, b:25 }, { a:23, b:15 }, { a:41, b:34 },',
      replace:'    { a:32, b:25 }, { a:23, b:16 }, { a:41, b:34 },' },
    { file:'index', expect:'GAME_ALIGN[4] 72 + 3: the misaligned tens 7 + 3',
      find:'{ a:62, b:3 }, { a:15, b:2 }',
      replace:'{ a:72, b:3 }, { a:15, b:2 }' },
    { file:'index', expect:'GAME_ALIGN[1] digit cards are not 4 different digits',
      find:'    { a:32, b:5 }, { a:24, b:3 },',
      replace:'    { a:32, b:5 }, { a:24, b:2 },' },
    { file:'index', expect:'GAME_SPOT[0] needs exactly 2 not lined up',
      find:'{ a:41, b:6, ok:true }',
      replace:'{ a:41, b:2, ok:false }' },
    { file:'index', expect:'GAME_SPOT[1] 72 + 9 carries in the ones',
      find:'{ a:72, b:5, ok:true }',
      replace:'{ a:72, b:9, ok:true }' },
    { file:'index', expect:'GAME_TAKE[0] 57 − 28 needs a borrow',
      find:'    { a:57, b:23 }, { a:68, b:24 },',
      replace:'    { a:57, b:28 }, { a:68, b:24 },' },
    { file:'index', expect:'GAME_TAKE[1] 78 has 7 tens, more than the 6-stick row',
      find:'    { a:57, b:23 }, { a:68, b:24 },',
      replace:'    { a:57, b:23 }, { a:78, b:24 },' },
    { file:'index', expect:'GAME_CHECK[1] 41 + 39 carries',
      find:'    { a:32, b:25 }, { a:41, b:36 }, { a:23, b:15 }, { a:52, b:34 },',
      replace:'    { a:32, b:25 }, { a:41, b:39 }, { a:23, b:15 }, { a:52, b:34 },' },
    { file:'index', expect:'GAME_CHECK[5] needs two different two-digit numbers',
      find:'{ a:44, b:13 }',
      replace:'{ a:44, b:44 }' },
    { file:'index', expect:'gBankDone: numbers should read',
      find:"'，個位 ' + aO + ' + ' + bO + ' = ' + (aO + bO) + '，'",
      replace:"'，個位 ' + aO + ' + ' + bO + ' = ' + (aO + bO + 1) + '，'" },
    { file:'index', expect:'gTakeDone: numbers should read',
      find:"'. Ones: ' + aO + ' − ' + bO + ' = ' + (aO - bO) + '. So '",
      replace:"'. Ones: ' + aO + ' − ' + bO + ' = ' + (aO - bO - 1) + '. So '" },
    { file:'index', expect:'gAlignResT: numbers should read',
      find:"'，下面沒有十，所以十位還是 ' + aT + '。'",
      replace:"'，下面沒有十，所以十位還是 ' + (aT + 1) + '。'" },
    { file:'index', expect:'gSpotOne: numbers should read',
      find:"'；對齊個位才對：' + a + ' + ' + b + ' = ' + (a + b) + '。'",
      replace:"'；對齊個位才對：' + a + ' + ' + b + ' = ' + (a + b * 10) + '。'" },
    { file:'index', expect:'gChkDone: numbers should read',
      find:"'：' + s + ' − ' + b + ' = ' + a + '，' + s + ' − ' + a + ' = ' + b + '。減回去都對",
      replace:"'：' + s + ' − ' + b + ' = ' + b + '，' + s + ' − ' + a + ' = ' + a + '。減回去都對" },
    { file:'index', expect:'gBankNotTen zh does not name 十位',
      find:"      gBankNotTen:'這是一條十（10 個一綁在一起），要放進「十位」。',",
      replace:"      gBankNotTen:'這是一條十（10 個一綁在一起），要放進「個位」。'," },
    { file:'index', expect:'gAlignTens en does not name the Ones column',
      find:"' has only one digit — it has no tens — so it goes in the Ones column, under the '",
      replace:"' has only one digit — so it goes in the Tens column, under the '" },
    { file:'index', expect:'under 44',
      find:'  var ROD_W = 46, ROD_H = 96, ONE_W = 46;',
      replace:'  var ROD_W = 40, ROD_H = 96, ONE_W = 46;' },
    { file:'index', expect:'align digit card',
      find:"addPiece(B, { w:50, h:50, cx:cx, cy:cy, text:String(v), cls:'gcard'",
      replace:"addPiece(B, { w:50, h:40, cx:cx, cy:cy, text:String(v), cls:'gcard'" },
    { file:'index', expect:'check cards in the tray overlap',
      find:'      renderTray(B, [g.a, g.a, g.b, g.b], 200, card, 66);',
      replace:'      renderTray(B, [g.a, g.a, g.b, g.b], 200, card, 50);' },
    { file:'index', expect:'the 9th banked ten sticks out of the Tens bin',
      find:'  function rodSpot(i){ return { cx:BIN_T.x + 15 + i * 14, cy:BIN_T.y + 82 }; }',
      replace:'  function rodSpot(i){ return { cx:BIN_T.x + 15 + i * 16, cy:BIN_T.y + 82 }; }' },
    { file:'index', expect:'the 9th banked one sticks out of the Ones bin',
      find:'cy:BIN_O.y + 54 + Math.floor(i / 3) * 28 }; }',
      replace:'cy:BIN_O.y + 54 + Math.floor(i / 3) * 48 }; }' },
    { file:'index', expect:'the bank tray rows overlap',
      find:'      renderTray(B, ones, 292, function(k, cx, cy){',
      replace:'      renderTray(B, ones, 252, function(k, cx, cy){' },
    { file:'index', expect:'a misaligned sum draws its one-digit number at x 104',
      find:"        cell(f.ok ? 104 : 62, 80, 38, 34, String(f.b));",
      replace:"        cell(f.ok ? 104 : 104, 80, 38, 34, String(f.b));" },
    { file:'index', expect:'gClear missing',
      find:"      gClear:'按「下一關」繼續下一題。',\n      gWin:function(score){ return '五關全破！",
      replace:"      gWin:function(score){ return '五關全破！" },
    { file:'index', expect:'quiz reveal points',
      find:"          var hid = stem.querySelectorAll('.sitbox.hide');",
      replace:"          var hid = [];" }
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
    dataReturn: '{blocksSvg, opGroupsHTML, alignPicHTML, ADD_PAIRS, ALIGN_PAIRS, SUB_PAIRS, GAME_BANK, GAME_ALIGN, GAME_SPOT, GAME_TAKE, GAME_CHECK}',
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

      /* --- 小遊戲：積木銀行（五關五種玩法，§六之五；2026-10-01 從選擇題改版）——
             每一條都從畫面上看得到的東西重新推，不呼叫頁面的答案邏輯；答案、版面數字都在這裡自己算一次。 --- */
      const isInt = v => Number.isInteger(v);
      const dg = n => ({ t: Math.floor(n / 10), o: n % 10 });
      const two = n => isInt(n) && n >= 10 && n <= 99;
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== 'bank,align,spot,take,check') fail('GAME_ORDER should be bank,align,spot,take,check, got ' + types.join());
        types.forEach(t => {
          if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
          ['zh','en'].forEach(L => {
            if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
            if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
          });
        });
      }
      /* 最後一關與過關的字：兩邊字典一起少的話 check_i18n 看不到（numbers 改版時真的發生過，最後一關會丟錯） */
      ['zh','en'].forEach(L => {
        if (typeof I18N[L].gClear !== 'string' || !I18N[L].gClear) fail('gClear missing in ' + L);
        if (typeof I18N[L].gWin !== 'function' || !/5/.test(I18N[L].gWin(5))) fail('gWin missing in ' + L);
      });
      /* 結語的數字：照「孩子看到的順序」逐個比 —— 算式用驗算器驗，散文裡的數用這個比。 */
      const seq = (where, text, want) => {
        if (typeof text !== 'string' || /undefined|NaN/.test(text)) return fail(where + ': text has undefined/NaN: ' + text);
        const got = (text.match(/\d+/g) || []).map(Number).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        arithGame(text).problems.forEach(p => fail(where + ': ' + p));
      };
      /* 「放錯了」的說明要說出**正確的那一位**，而且不提另一位 —— 對每一題都成立（字串不帶題目的數） */
      const PLACE = { zh:{ t:'十位', o:'個位' }, en:{ t:/\bTens\b/, o:/\bOnes\b/ } };
      const says = (m, w) => typeof w === 'string' ? m.indexOf(w) >= 0 : w.test(m);
      const placeOnly = (key, L, m, want) => {
        if (typeof m !== 'string' || !m) return fail(key + ' missing in ' + L);
        const other = want === 't' ? 'o' : 't';
        if (!says(m, PLACE[L][want])) fail(key + ' ' + L + ' does not name ' + (want === 't' ? (L === 'zh' ? '十位' : 'the Tens column') : (L === 'zh' ? '個位' : 'the Ones column')) + ': ' + m);
        if (says(m, PLACE[L][other])) fail(key + ' ' + L + ' also names the other column: ' + m);
      };
      ['zh','en'].forEach(L => {
        placeOnly('gBankNotTen', L, I18N[L].gBankNotTen, 't');
        placeOnly('gBankNotOne', L, I18N[L].gBankNotOne, 'o');
      });

      /* 版面數字一律從 index.html 讀（§六之五 第 6 點），不在這裡另抄一份 */
      const num = (re, what) => { const m = src.match(re); if (!m) fail('cannot read ' + what + ' from index.html'); return m ? m.slice(1).map(Number) : null; };
      const pcs = num(/var ROD_W = (\d+), ROD_H = (\d+), ONE_W = (\d+);/, 'ROD_W/ROD_H/ONE_W');
      const binT = num(/var BIN_T = \{ x:(\d+), y:(\d+), w:(\d+), h:(\d+) \}, BIN_O = \{ x:(\d+), y:(\d+), w:(\d+), h:(\d+) \};/, 'BIN_T/BIN_O');
      const rodM = num(/function rodSpot\(i\)\{ return \{ cx:BIN_T\.x \+ (\d+) \+ i \* (\d+), cy:BIN_T\.y \+ (\d+) \}; \}/, 'rodSpot');
      const oneM = num(/function oneSpot\(i\)\{ return \{ cx:BIN_O\.x \+ BIN_O\.w \/ 2 \+ \(i % 3 - 1\) \* (\d+), cy:BIN_O\.y \+ (\d+) \+ Math\.floor\(i \/ 3\) \* (\d+) \}; \}/, 'oneSpot');
      const shrinkR = num(/s = rodSpot\(nT\); nT\+\+; shrink\(P, (\d+), (\d+)\);/, 'the banked-ten size');
      const shrinkO = num(/s = oneSpot\(nO\); nO\+\+; shrink\(P, (\d+), (\d+)\);/, 'the banked-one size');
      /* 手機上拿得起來、點得到的東西至少 44px：以 375px 手機（卡片內寬約 290px）換算 300 寬畫板。
         實際量測在端對端測試裡（375px 寬再跑一次）。 */
      const boards = (src.match(/makeBoard\((\d+), \d+\)/g) || []).map(m => +m.match(/\d+/)[0]);
      if (boards.length !== 5 || boards.some(W => W !== 300)) fail('expected five 300-wide game boards, got ' + boards.join());
      const scale = Math.min(1.5, 290 / 300);
      const tooSmall = (what, sz) => { if (!(sz * scale >= 44)) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      if (pcs){ tooSmall('a ten-stick (ROD_W ' + pcs[0] + ')', Math.min(pcs[0], pcs[1])); tooSmall('a one (ONE_W ' + pcs[2] + ')', pcs[2]); }
      const body = name => (src.match(new RegExp('\\n {4}' + name + ': function\\(d\\)\\{([\\s\\S]*?)\\n {4}\\}(,|\\n)')) || [])[1] || '';
      const B = { bank: body('bank'), align: body('align'), spot: body('spot'), take: body('take'), check: body('check') };
      Object.keys(B).forEach(k => { if (!B[k]) fail('cannot cut RENDER.' + k + ' out of index.html'); });
      const boardH = k => +((B[k].match(/makeBoard\(300, (\d+)\)/) || [])[1]);

      /* 第 1 關：存積木。b 的十 1～3 條、一 1～5 個（托盤各一排 5 個）；十位、個位各自不進位；
         銀行的十位格最多 9 條、個位格最多 9 個 —— 第 9 個放下去也要在格子裡。 */
      data.GAME_BANK.forEach((g, i) => {
        const A = dg(g.a), Bd = dg(g.b);
        if (!two(g.a) || !two(g.b)) return fail('GAME_BANK[' + i + '] a and b must be two-digit integers');
        if (Bd.t < 1 || Bd.t > 3 || Bd.o < 1 || Bd.o > 5) fail('GAME_BANK[' + i + '] b = ' + g.b + ' needs 1..3 tens and 1..5 ones (one tray row each)');
        if (A.o + Bd.o > 9 || A.t + Bd.t > 9) fail('GAME_BANK[' + i + '] ' + g.a + '+' + g.b + ' carries');
        ['zh','en'].forEach(L => {
          seq('GAME_BANK[' + i + '] ' + L + ' gBankDone', I18N[L].gBankDone(A.t, Bd.t, A.o, Bd.o, g.a, g.b), [A.t, Bd.t, A.t + Bd.t, A.o, Bd.o, A.o + Bd.o, g.a, g.b, g.a + g.b]);
          seq('GAME_BANK[' + i + '] ' + L + ' gBankNow', I18N[L].gBankNow(g.a, g.b, A.t, A.o), [g.a, g.b, A.t, A.o]);
        });
      });
      if (binT && rodM && oneM && shrinkR && shrinkO && pcs){
        const [tx, ty, tw, th, ox, oy, ow, oh] = binT, [rOff, rPitch, rCy] = rodM, [oPitch, oCy, oRow] = oneM;
        if (rPitch < shrinkR[0] + 2) fail('banked tens touch each other (pitch ' + rPitch + ')');
        if (rOff - shrinkR[0] / 2 < 3 || rOff + 8 * rPitch + shrinkR[0] / 2 > tw - 3) fail('the 9th banked ten sticks out of the Tens bin');
        if (rCy - shrinkR[1] / 2 < 30 || rCy + shrinkR[1] / 2 > th) fail('banked tens cover the bin label or stick out of the bin');
        if (oPitch < shrinkO[0] + 2 || oRow < shrinkO[1] + 2) fail('banked ones touch each other');
        if (oCy - shrinkO[1] / 2 < 30 || oCy + 2 * oRow + shrinkO[1] / 2 > oh || ow / 2 + oPitch + shrinkO[0] / 2 > ow) fail('the 9th banked one sticks out of the Ones bin');
        if (tx + tw > ox || ty !== oy) fail('the Tens and Ones bins overlap');
        const rT = B.bank.match(/renderTray\(B, rods, (\d+), [\s\S]*?\}, (\d+), 5\);/), oT = B.bank.match(/renderTray\(B, ones, (\d+), [\s\S]*?\}, (\d+), 5\);/);
        if (!rT || !oT) fail('cannot read the bank tray rows');
        else {
          const [ry, rs] = [+rT[1], +rT[2]], [oy2, os] = [+oT[1], +oT[2]];
          if (rs < pcs[0] || os < pcs[2]) fail('bank tray pieces overlap side by side');
          if (ry - pcs[1] / 2 < ty + th) fail('the bank tray covers the bins');
          if (ry + pcs[1] / 2 > oy2 - pcs[2] / 2) fail('the bank tray rows overlap');
          if (oy2 + pcs[2] / 2 > boardH('bank')) fail('the bank tray sticks out of the board');
          if ((300 - 4 * os) / 2 - pcs[2] / 2 < 0) fail('a 5-piece bank tray row is wider than the board');
        }
      }

      /* 第 2 關：排直式。b 是一位數；托盤的四張數字卡 aT、aO + b、aT + b、aO 兩兩不同，而且都是一位數。 */
      data.GAME_ALIGN.forEach((g, i) => {
        const A = dg(g.a);
        if (!two(g.a) || !isInt(g.b) || g.b < 1 || g.b > 9) return fail('GAME_ALIGN[' + i + '] needs a two-digit a and a one-digit b');
        if (A.o + g.b > 9) fail('GAME_ALIGN[' + i + '] ' + g.a + ' + ' + g.b + ' carries in the ones');
        if (A.t + g.b > 9) fail('GAME_ALIGN[' + i + '] ' + g.a + ' + ' + g.b + ': the misaligned tens ' + A.t + ' + ' + g.b + ' is not one digit');
        const cards = [A.t, A.o + g.b, A.t + g.b, A.o];
        if (new Set(cards).size !== 4) fail('GAME_ALIGN[' + i + '] digit cards are not 4 different digits: ' + cards.join());
        ['zh','en'].forEach(L => {
          seq('GAME_ALIGN[' + i + '] ' + L + ' gAlignDone', I18N[L].gAlignDone(g.a, g.b), [g.b, g.a, g.b, g.a + g.b]);
          seq('GAME_ALIGN[' + i + '] ' + L + ' gAlignTens', I18N[L].gAlignTens(g.b, A.o), [g.b, A.o]);
          placeOnly('gAlignTens', L, I18N[L].gAlignTens(g.b, A.o), 'o');
          seq('GAME_ALIGN[' + i + '] ' + L + ' gAlignResT', I18N[L].gAlignResT(A.t), [A.t, A.t]);
          seq('GAME_ALIGN[' + i + '] ' + L + ' gAlignResO', I18N[L].gAlignResO(A.o, g.b), [A.o, g.b, A.o + g.b]);
        });
      });
      {
        const cM = B.align.match(/addPiece\(B, \{ w:(\d+), h:(\d+), cx:cx, cy:cy, text:String\(v\), cls:'gcard'/);
        const tM = B.align.match(/renderTray\(B, \[A\.t, r, A\.t \+ g\.b, A\.o\], (\d+), card, (\d+)\);/);
        const cellM = B.align.match(/var CX = \[(\d+), (\d+)\], CELL = (\d+);/);
        if (!cM || !tM || !cellM) fail('cannot read the align-round layout');
        else {
          tooSmall('an align digit card (' + cM[1] + 'x' + cM[2] + ')', Math.min(+cM[1], +cM[2]));
          tooSmall('an align box (CELL ' + cellM[3] + ')', +cellM[3]);
          if (+tM[2] < +cM[1]) fail('align cards in the tray overlap');
          if (+cellM[2] - +cellM[1] < +cellM[3]) fail('the tens and ones boxes overlap');
          if ((300 - 3 * +tM[2]) / 2 - +cM[1] / 2 < 0 || +tM[1] + +cM[2] / 2 > boardH('align')) fail('the align tray sticks out of the board');
        }
      }

      /* 第 3 關：找錯。每組四個不同的直式，剛好兩個沒對齊；對齊的照 a + b 算，沒對齊的照錯的位子算（十位 aT + b），
         兩種答案都要是兩位數、不進位，錯的答案和對的不一樣。 */
      data.GAME_SPOT.forEach((set, i) => {
        if (!Array.isArray(set) || set.length !== 4) return fail('GAME_SPOT[' + i + '] needs 4 column sums');
        if (set.filter(f => f.ok === false).length !== 2 || set.some(f => typeof f.ok !== 'boolean')) fail('GAME_SPOT[' + i + '] needs exactly 2 not lined up (ok:false)');
        if (new Set(set.map(f => f.a + '+' + f.b)).size !== 4) fail('GAME_SPOT[' + i + '] repeats a sum');
        set.forEach((f, j) => {
          const A = dg(f.a);
          if (!two(f.a) || !isInt(f.b) || f.b < 1 || f.b > 9) return fail('GAME_SPOT[' + i + '][' + j + '] needs a two-digit a and a one-digit b');
          if (A.o + f.b > 9) fail('GAME_SPOT[' + i + '] ' + f.a + ' + ' + f.b + ' carries in the ones');
          if (!f.ok && A.t + f.b > 9) fail('GAME_SPOT[' + i + '] misaligned ' + f.a + ' + ' + f.b + ' would show a three-digit answer');
          const w = (A.t + f.b) * 10 + A.o;
          ['zh','en'].forEach(L => {
            if (f.ok) seq('GAME_SPOT[' + i + '][' + j + '] ' + L + ' gSpotOk', I18N[L].gSpotOk(f.a, f.b), [f.b, f.a, f.b, f.a + f.b]);
            else seq('GAME_SPOT[' + i + '][' + j + '] ' + L + ' gSpotOne', I18N[L].gSpotOne(f.a, f.b, w), [f.b, w, f.a, f.b, f.a + f.b]);
          });
        });
      });
      /* 畫出來的答案要跟數字坐的位子一致：頁面的 res 公式從原始碼切出來，代入每一個直式驗 */
      {
        const rM = B.spot.match(/res = f\.ok \? ([^:]+) : ([^,]+), R = digits\(res\)/);
        if (!rM) fail('cannot read how the spot round works out each sum');
        else {
          let fn = null;
          try { fn = new Function('f', 'A', 'return [' + rM[1] + ', ' + rM[2] + '];'); } catch (e){ fail('spot res formula does not parse: ' + e.message); }
          if (fn) data.GAME_SPOT.forEach((set, i) => set.forEach(f => {
            const A = dg(f.a), [okR, badR] = fn(f, A);
            if (okR !== f.a + f.b) fail('GAME_SPOT[' + i + '] lined-up ' + f.a + ' + ' + f.b + ' is drawn as ' + okR);
            if (badR !== f.a + 10 * f.b) fail('GAME_SPOT[' + i + '] misaligned ' + f.a + ' + ' + f.b + ' is drawn as ' + badR + ', not as the shifted digits say');
          }));
        }
        /* 一位數 b 畫在哪一欄也要跟 ok 一致（codex 第一輪：只驗 res 公式的話，把 b 一律畫在個位，
           錯的那兩個看起來就是「對齊了卻算錯」，教的是假的）。十位、個位的 x 從表頭讀。 */
        const hM = B.spot.match(/cell\((\d+), \d+, \d+, \d+, d\.colTens\); cell\((\d+), \d+, \d+, \d+, d\.colOnes\);/);
        const aM = B.spot.match(/cell\((\d+), (\d+), \d+, \d+, String\(A\.t\)\); cell\((\d+), (\d+), \d+, \d+, String\(A\.o\)\);/);
        const bM = B.spot.match(/cell\(f\.ok \? (\d+) : (\d+), \d+, \d+, \d+, String\(f\.b\)\);/);
        const zM = B.spot.match(/cell\((\d+), (\d+), \d+, \d+, String\(R\.t\)\); cell\((\d+), (\d+), \d+, \d+, String\(R\.o\)\);/);
        if (!hM || !aM || !bM || !zM) fail('cannot read where the spot round draws each digit');
        else {
          const tX = +hM[1], oX = +hM[2];
          if (tX === oX) fail('spot: the Tens and Ones headers are in the same place');
          if (+bM[1] !== oX) fail('spot: a lined-up sum draws its one-digit number at x ' + bM[1] + ', not under the Ones header (' + oX + ')');
          if (+bM[2] !== tX) fail('spot: a misaligned sum draws its one-digit number at x ' + bM[2] + ', not under the Tens header (' + tX + ')');
          if (+aM[1] !== tX || +aM[3] !== oX || +zM[1] !== tX || +zM[3] !== oX) fail('spot: the top number or the answer is not under the Tens/Ones headers');
        }
        const fM = B.spot.match(/addZone\(B, x, y, (\d+), (\d+), 'gform'\)/), pM = B.spot.match(/var x = 4 \+ \(i % 2\) \* (\d+), y = 4 \+ Math\.floor\(i \/ 2\) \* (\d+);/);
        if (!fM || !pM) fail('cannot read the spot-round layout');
        else {
          tooSmall('a spot column sum', Math.min(+fM[1], +fM[2]));
          if (+pM[1] < +fM[1] || +pM[2] < +fM[2]) fail('spot column sums overlap');
          if (4 + +pM[1] + +fM[1] > 300 || 4 + +pM[2] + +fM[2] > boardH('spot')) fail('spot column sums stick out of the board');
        }
      }

      /* 第 4 關：拿走。a 的十最多 6 條（一排 6 個、間距 50）、一最多 9 個（兩排 × 5）；b 不退位。 */
      data.GAME_TAKE.forEach((g, i) => {
        const A = dg(g.a), Bd = dg(g.b);
        if (!two(g.a) || !two(g.b)) return fail('GAME_TAKE[' + i + '] a and b must be two-digit integers');
        if (A.t > 6) fail('GAME_TAKE[' + i + '] ' + g.a + ' has ' + A.t + ' tens, more than the 6-stick row');
        if (Bd.o < 1) fail('GAME_TAKE[' + i + '] b = ' + g.b + ' has no ones to take');
        if (Bd.o > A.o || Bd.t > A.t) fail('GAME_TAKE[' + i + '] ' + g.a + ' − ' + g.b + ' needs a borrow');
        ['zh','en'].forEach(L => {
          seq('GAME_TAKE[' + i + '] ' + L + ' gTakeDone', I18N[L].gTakeDone(A.t, Bd.t, A.o, Bd.o, g.a, g.b), [A.t, Bd.t, A.t - Bd.t, A.o, Bd.o, A.o - Bd.o, g.a, g.b, g.a - g.b]);
          seq('GAME_TAKE[' + i + '] ' + L + ' gTakeEnoughT', I18N[L].gTakeEnoughT(Bd.t, g.b), [Bd.t, g.b, Bd.t]);
          seq('GAME_TAKE[' + i + '] ' + L + ' gTakeEnoughO', I18N[L].gTakeEnoughO(Bd.o, g.b), [Bd.o, g.b, Bd.o]);
        });
      });
      if (pcs){
        const rp = B.take.match(/cx:150 \+ \(i - \(A\.t - 1\) \/ 2\) \* (\d+), cy:(\d+),/), op = B.take.match(/cx:150 \+ \(i % 5 - \(inRow - 1\) \/ 2\) \* (\d+), cy:(\d+) \+ row \* (\d+),/);
        const bx = B.take.match(/var BOX = \{ x:(\d+), y:(\d+), w:(\d+), h:(\d+) \};/);
        if (!rp || !op || !bx) fail('cannot read the take-round layout');
        else {
          if (+rp[1] < pcs[0] || +op[1] < pcs[2] || +op[3] < pcs[2]) fail('take-round blocks overlap');
          if (150 + 2.5 * +rp[1] + pcs[0] / 2 > 300 || 150 + 2 * +op[1] + pcs[2] / 2 > 300) fail('a full take-round row is wider than the board');
          if (+rp[2] + pcs[1] / 2 > +op[2] - pcs[2] / 2 - 20 || +op[2] + +op[3] + pcs[2] / 2 > +bx[2] - 22) fail('take-round rows run into each other or into the Take away box');
          if (+bx[2] + +bx[4] > boardH('take')) fail('the Take away box sticks out of the board');
        }
      }

      /* 第 5 關：驗算。a ≠ b、都是兩位數、不進位（所以 s − b、s − a 也不退位）。 */
      data.GAME_CHECK.forEach((g, i) => {
        if (!two(g.a) || !two(g.b) || g.a === g.b) return fail('GAME_CHECK[' + i + '] needs two different two-digit numbers');
        const A = dg(g.a), Bd = dg(g.b), s = g.a + g.b;
        if (A.o + Bd.o > 9 || A.t + Bd.t > 9) fail('GAME_CHECK[' + i + '] ' + g.a + ' + ' + g.b + ' carries');
        ['zh','en'].forEach(L => {
          seq('GAME_CHECK[' + i + '] ' + L + ' gChkDone', I18N[L].gChkDone(g.a, g.b), [g.a, g.b, s, s, g.b, g.a, s, g.a, g.b]);
          seq('GAME_CHECK[' + i + '] ' + L + ' gChkRow', I18N[L].gChkRow(s, g.b), [s, g.b, g.a]);
          seq('GAME_CHECK[' + i + '] ' + L + ' gChkFalse', I18N[L].gChkFalse(s, g.a, g.a), [s, g.a, g.b, g.a]);
          seq('GAME_CHECK[' + i + '] ' + L + ' gChk2', I18N[L].gChk2(s, g.b), [s, g.b, g.a]);
        });
      });
      {
        const cM = B.check.match(/addPiece\(B, \{ w:(\d+), h:(\d+), cx:cx, cy:cy, text:String\(v\), cls:'gcard'/);
        const tM = B.check.match(/renderTray\(B, \[g\.a, g\.a, g\.b, g\.b\], (\d+), card, (\d+)\);/);
        const yM = B.check.match(/var y = (\d+) \+ k \* (\d+);/);
        if (!cM || !tM || !yM) fail('cannot read the check-round layout');
        else {
          tooSmall('a check card', Math.min(+cM[1], +cM[2]));
          if (+tM[2] < +cM[1]) fail('check cards in the tray overlap (step ' + tM[2] + ' < card ' + cM[1] + ')');
          if ((300 - 3 * +tM[2]) / 2 - +cM[1] / 2 < 0 || +tM[1] + +cM[2] / 2 > boardH('check')) fail('the check tray sticks out of the board');
          if (+tM[1] - +cM[2] / 2 < +yM[1] + +yM[2] + 56) fail('the check tray covers the second row');
        }
      }
      /* 小遊戲的卡片要洗牌（正解不可以固定在同一個位置）—— 卡片統一由 renderTray() 畫，實作在 lib/gameshuffle.js。 */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);

      /* 試題的結果格不可以直接畫出答案（2026-09-25 Tony 抓到：舊版積木銀行
         最右邊那格把 57 的積木和數字都畫出來了）。小遊戲 2026-10-01 改版後不再畫 opGroupsHTML，
         這裡只剩試題：hide=true 時結果格真的蓋成「?」；兩題看積木試題都傳 hide=true；答完才把 .hide 拿掉。 */
      {
        const hidden = data.opGroupsHTML(3, 2, 2, 5, 'add', 5, 7, true);
        const shown = data.opGroupsHTML(3, 2, 2, 5, 'add', 5, 7);
        if (!/class="sitbox result hide"><div class="sitq">\?<\/div><div class="sitreal">/.test(hidden))
          fail('opGroupsHTML(..., hide=true) does not cover the result box with "?"');
        if (/sitbox result hide/.test(shown)) fail('opGroupsHTML without hide still hides the result (examples must show it)');
        /* 三條 CSS 缺一不可：少了第一條範例會多一個「?」；少了第二條結果格變空白；少了第三條答案又露出來 */
        [/\.sitq\{display:none;/, /\.sitbox\.hide \.sitq\{display:block\}/, /\.sitbox\.hide \.sitreal\{display:none\}/].forEach(re => {
          if (!re.test(src)) fail('result-box hide CSS rule missing: ' + re);
        });
        const quizCalls = (src.match(/opGroupsHTML\(\d,\d,\d,\d,'(?:add|sub)',\d,\d(,true)?\)/g) || []);
        if (quizCalls.length !== 4 || quizCalls.some(c => !/,true\)$/.test(c)))
          fail('quiz block-picture stems must be exactly 4 opGroupsHTML(...,true) calls, got ' + JSON.stringify(quizCalls));
        const reveals = (src.match(/stem\.querySelectorAll\('\.sitbox\.hide'\)/g) || []).length;
        if (reveals !== 1) fail('expected 1 quiz reveal points (inside the answer handler), found ' + reveals);
      }

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
        /* 54→50、7→11（2026-09-25）：兩題「看積木」試題的結果格改成「?」之後，
           題幹不再寫出「32 + 25 = 57」「57 − 23 = 34」（2 題 × 2 語言 = 4 條），
           這 4 條從「驗過的算式」變成「問句」。數字變回去 = 題幹又把答案畫出來了。 */
        if (vSum !== 50) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 50`);
        if (qSum !== 11) fail(`question-shaped equations changed: found ${qSum}, expected 11`);
        arithTD.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale`));
      }
    }
  }
};
