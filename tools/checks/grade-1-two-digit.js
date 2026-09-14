/* grade-1/math/two-digit 的檢查設定（兩位數加減：不進位／不退位、對齊、加減互逆）。

   ⚠️ 這一課的 review.html 每一題只有 3 個選項（正解 + 2 個錯的），不是全站慣例的 4 個
   （makeWrongs 保底迴圈用 `out.length < 2`、`out.slice(0, 2)`）。tools/simgen.js 的
   選項數檢查是寫死的 4（`if (!q.opts || q.opts.length !== 4)`），沒有讓各課覆寫，
   所以 simgen.js 對這一課「structurally」不可能全綠 —— 這不是這份設定檔的洞，
   是這一課的選項數和全站共用腳本的假設不一致。已如實記錄在 README 的段落與
   任務報告裡，沒有去改 simgen.js（不在這次任務的範圍內）。 */

const arithTD = require('./lib/arith.js').makeArith({ units: ['元'], unitsEn: ['dollars?'] });

/* 選項的合理範圍，依產生器分開給：兩位數加減本身宣稱「0~99」，但刻意的
   「差 10」誘答（進位/借位教學常見的迷思）容許到 109；20 以內加減、位值、
   分與合則各自更窄。 */
const RANGE = {
  addNoRegroup:[0,109], subNoRegroup:[0,99], addOneDigit:[0,109], subOneDigit:[0,99],
  inverseCheck:[0,109], wordProblem:[0,109], placeValue:[0,10], numberBonds:[0,10], addSub20:[0,21]
};

module.exports = {
  breaks: [
    { file:'review', expect:'ones carry but why says no regroup',
      find:'      if (da.o + db.o <= 9 && da.t + db.t <= 9) return { a:a, b:b, sum:a + b };',
      replace:'      if (da.o + db.o <= 10 && da.t + db.t <= 9) return { a:a, b:b, sum:a + b };' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 3 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (!seen[key] && c >= 0){ seen[key] = true; out.push(c); }',
      replace:'      if (c >= 0){ out.push(c); }' },
    { file:'review', expect:'option 171 outside',
      find:'    { id:\'addOneDigit\', cat:\'twodigit\',\n      make: function(){ var p = randAddOneDigit(); var da = digs(p.a); var wrongTens = (da.t + p.b) * 10 + da.o; var m = mixOpts(p.sum, [wrongTens, p.sum + 1]); return { p:p, opts:m.opts, ans:m.ans }; },',
      replace:'    { id:\'addOneDigit\', cat:\'twodigit\',\n      make: function(){ var p = { a:81, b:9, sum:90 }; var da = digs(p.a); var wrongTens = (da.t + p.b) * 10 + da.o; var m = mixOpts(p.sum, [wrongTens, p.sum + 1]); return { p:p, opts:m.opts, ans:m.ans }; },' },
    { file:'index', expect:'ADD_PAIRS[0] carries',
      find:'    { a:{t:3,o:2}, b:{t:2,o:5} },  // 32 + 25 = 57',
      replace:'    { a:{t:3,o:2}, b:{t:2,o:8} },  // deliberately broken: 2+8 carries' },
    { file:'index', expect:'SUB_PAIRS[0] needs a borrow',
      find:'    { a:{t:5,o:7}, b:{t:2,o:3} },  // 57 − 23 = 34',
      replace:'    { a:{t:5,o:7}, b:{t:2,o:9} },  // deliberately broken: 7-9 needs a borrow' },
    { file:'index', expect:'ROUNDS[0] 32+25 != 58',
      find:'    { op:\'add\', a:{t:3,o:2}, b:{t:2,o:5}, ans:57, choices:[57,37,75,52] },',
      replace:'    { op:\'add\', a:{t:3,o:2}, b:{t:2,o:5}, ans:58, choices:[57,37,75,52] },' }
    /* ⚠️ 沒有「每一關正解都在第一個」的獨立改壞測試：原檔本來就是這樣（5 關全部
       把正解放在 choices[0]），所以這條斷言在原檔上已經在響 —— 沒有「改壞前必須先
       過」的起點可以證明它。這是缺陷本身，不是設定檔的洞（見下面的缺陷紀錄）。 */
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
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'addNoRegroup': return String(d.p.sum);
        case 'subNoRegroup': return String(d.p.diff);
        case 'addOneDigit': return String(d.p.sum);
        case 'subOneDigit': return String(d.p.diff);
        case 'inverseCheck': return String(d.p.a);
        case 'wordProblem': return String(d.isAdd ? d.p.sum : d.p.diff);
        case 'placeValue': return String(d.d.t);
        case 'numberBonds': return String(d.part2);
        case 'addSub20': return String(d.ans2);
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
       兩個候選誘答剛好就是這兩個數字，是刻意設計；numberBonds 的 whole 同理。 */
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
    check: function(data, I18N, fail){
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
      /* ⚠️ 和其他幾課同一種缺陷：choices 陣列沒有洗牌，畫面上永遠是第一個按鈕正確。 */
      if (data.ROUNDS.every(r => r.choices.indexOf(r.ans) === 0))
        fail('every game round has the answer first (ROUNDS choices arrays all put ans at index 0, and startRound() never shuffles)');

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
