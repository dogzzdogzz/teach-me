/* grade-2/math/add-sub 的檢查設定（原本寫死在 tools/simgen.js 與
   tools/verify_lesson_data.js 裡，2026-08-25 拆出來，讓每一課都能各自驗）。 */

function digits(n){ return [n % 10, Math.floor(n / 10) % 10, Math.floor(n / 100) % 10]; }
function needsBorrow(a, b){ const A = digits(a), B = digits(b); return A.some((d, k) => d < B[k]); }

/* 這一課是「二、三位數的加減」：選項一律 0~999，問個位數字的那一題 0~9。 */
const RANGE = { onesDigit: [0, 9] };

module.exports = {
  /* 刻意改壞的清單：node tools/breaktest.js grade-2/math/add-sub */
  breaks: [
    { file:'review', expect:'copied straight out of the stem',
      find:'    function ok(v){ return v >= lo && v <= hi && ban.indexOf(v) < 0; }',
      replace:'    function ok(v){ return v >= lo && v <= hi; }' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (ok(c) && !seen[k]){ seen[k] = true; out.push(c); }',
      replace:'      if (ok(c)){ out.push(c); }' },
    { file:'review', expect:'correct is not the ones digit',
      find:'        var s = oa + ob;\n        var correct = s % 10;',
      replace:'        var s = oa + ob;\n        var correct = s;' },
    { file:'index', expect:'smudged digit of',
      find:"    { a:27,  b:18,  op:'+', res:45,  row:'a',   p:0, ans:7, opts:[7, 3, 5] },",
      replace:"    { a:27,  b:18,  op:'+', res:45,  row:'a',   p:0, ans:3, opts:[7, 3, 5] }," },
    { file:'index', expect:'CHECK_CASES should contain exactly one wrong answer',
      find:"    { a:45,  b:38,  op:'+', given:73 },",
      replace:"    { a:45,  b:38,  op:'+', given:83 }," }
  ],

  sim: {
    INVARIANTS: {
      addNoCarry: d => {
        if (d.oa + d.ob > 9) return 'ones carry but why says no carry';
        if (d.ta + d.tb > 9) return 'tens overflow but why says no carry';
        if (d.a + d.b !== d.correct) return 'correct != a+b';
      },
      addCarryOnes: d => {
        if (d.oa + d.ob < 10) return 'why claims a ones carry but there is none';
        if (d.ta + d.tb + 1 > 9) return 'result is not 2-digit as the why implies';
        if (d.a + d.b !== d.correct) return 'correct != a+b';
      },
      addCarryTens: d => {
        if (d.oa + d.ob > 9) return 'why says the ones do not carry, but they do';
        if (d.ta + d.tb < 10) return 'why says the tens carry, but they do not';
        if (d.ha + d.hb + 1 > 9) return 'sum exceeds 999';
        if (d.a + d.b !== d.correct) return 'correct != a+b';
      },
      subNoBorrow: d => {
        if (needsBorrow(d.a, d.b)) return 'why says no borrowing, but a borrow is needed';
        if (d.a - d.b !== d.correct) return 'correct != a-b';
        if (d.correct <= 0) return 'non-positive result';
      },
      subBorrowOnes: d => {
        if (d.oa >= d.ob) return 'why says the ones are too small, but they are not';
        if (d.ta - 1 < d.tb) return 'tens cannot cover after lending';
        if (d.a - d.b !== d.correct) return 'correct != a-b';
        if (d.correct <= 0) return 'non-positive result';
      },
      subBorrowZero: d => {
        if (Math.floor(d.a / 10) % 10 !== 0) return 'why says the tens are 0, but they are not';
        if (d.oa >= d.ob) return 'why says the ones are too small, but they are not';
        if (d.ha - 1 < d.hb) return 'hundreds cannot cover after lending';
        if (d.a - d.b !== d.correct) return 'correct != a-b';
        if (d.correct <= 0) return 'non-positive result';
      },
      onesDigit: d => {
        if (d.oa + d.ob < 10) return 'why says the 1 carries, but the ones do not reach ten';
        if ((d.oa + d.ob) % 10 !== d.correct) return 'correct is not the ones digit';
        if (d.a + d.b > 999) return 'sum out of lesson range';
      },
      missingAddend: d => {
        if (d.b + d.correct !== d.sum) return 'b + correct != sum';
        if (d.sum > 999) return 'sum out of lesson range';
      },
      missingMinuend: d => {
        if (d.correct - d.b !== d.c) return 'correct - b != c';
        if (d.correct > 999) return 'minuend out of lesson range';
      },
      wordAdd: d => {
        if (d.oa + d.ob < 10) return 'why says carry 1, but the ones do not reach ten';
        if (d.x + d.y !== d.correct) return 'correct != x+y';
        if (d.correct > 999) return 'sum out of lesson range';
      },
      wordSub: d => {
        if (d.oa >= d.ob) return 'why says the ones need a borrow, but they do not';
        if (d.x - d.y !== d.correct) return 'correct != x-y';
        if (d.correct <= 0) return 'non-positive result';
      }
    },
    /* 選項一律是純數字，而且要落在這一課自己的數字範圍裡。 */
    optionOk: function(s, genId){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^-?\d+$/.test(s)) return 'non-numeric option ' + s;
      const [lo, hi] = RANGE[genId] || [0, 999];
      const v = Number(s);
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi;
      return null;
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{ADD_CASES, SUB_CASES, CHECK_CASES, ROUNDS, planAdd, planSub, digitsOf}',
    /* 三層題庫的數字選項不可以超過這一課的範圍（qs 有「614」這種刻意的迷思誘答，故只驗進階／迷思兩層）。 */
    optionValueMax: 999,
    check: function(data, I18N, fail){
      /* --- 範例 1：加法逐步 --- */
      data.ADD_CASES.forEach(c => {
        const p = data.planAdd(c.a, c.b);
        if (p.res !== c.a + c.b) fail(`planAdd ${c.a}+${c.b} res=${p.res}`);
        const digs = String(p.res).split('').reverse().map(Number);
        p.steps.forEach(st => {
          if (st.digit !== (digs[st.p] || 0)) fail(`planAdd ${c.a}+${c.b} place ${st.p} digit ${st.digit} != ${digs[st.p]}`);
          if (st.da + st.db + st.cin !== st.sum) fail(`planAdd ${c.a}+${c.b} step sum mismatch`);
          ['zh','en'].forEach(L => {
            const t = I18N[L].addWhy(st, I18N[L].places[st.p], I18N[L].places[st.p+1] || '');
            if (/undefined|NaN/.test(t)) fail(`addWhy ${L} ${c.a}+${c.b}: ${t}`);
          });
        });
        if (p.steps.length !== String(p.res).length && p.steps.length !== Math.max(String(c.a).length, String(c.b).length))
          fail(`planAdd ${c.a}+${c.b} step count ${p.steps.length}`);
      });

      /* --- 範例 2：減法逐步（含連續退位） --- */
      data.SUB_CASES.forEach(c => {
        const p = data.planSub(c.a, c.b);
        if (p.res !== c.a - c.b) fail(`planSub ${c.a}-${c.b} res=${p.res}`);
        if (p.res < 0) fail(`planSub ${c.a}-${c.b} negative`);
        const digs = String(p.res).split('').reverse().map(Number);
        p.steps.forEach(st => {
          if (st.digit !== (digs[st.p] || 0)) fail(`planSub ${c.a}-${c.b} place ${st.p} digit ${st.digit} != ${digs[st.p]}`);
          if (st.digit < 0 || st.digit > 9) fail(`planSub ${c.a}-${c.b} bad digit ${st.digit}`);
          if (st.from !== null && st.da - 10 >= st.db) fail(`planSub ${c.a}-${c.b} borrowed when it did not need to`);
          if (st.from === null && st.da < st.db) fail(`planSub ${c.a}-${c.b} did not borrow when needed`);
          ['zh','en'].forEach(L => {
            const t = I18N[L].subWhy(st, I18N[L].places[st.p], st.from === null ? '' : I18N[L].places[st.from]);
            if (/undefined|NaN/.test(t)) fail(`subWhy ${L} ${c.a}-${c.b}: ${t}`);
          });
        });
      });
      const kinds = data.SUB_CASES.map(c => {
        const st = data.planSub(c.a, c.b).steps;
        if (st.every(s => s.from === null)) return 'none';
        if (st.some(s => s.across)) return 'across';
        return 'simple';
      });
      ['none','simple','across'].forEach(k => { if (kinds.indexOf(k) < 0) fail('SUB_CASES missing kind ' + k); });

      /* --- 範例 3：驗算 --- */
      let wrongCount = 0;
      data.CHECK_CASES.forEach(c => {
        const back = (c.op === '-') ? c.given + c.b : c.given - c.b;
        const right = (c.op === '-') ? c.a - c.b : c.a + c.b;
        const ok = back === c.a;
        if (!ok) wrongCount++;
        if (ok && c.given !== right) fail(`CHECK ${c.a}${c.op}${c.b}=${c.given}: check passes but the given answer is not the right one`);
        if (!ok && c.given === right) fail(`CHECK ${c.a}${c.op}${c.b}=${c.given}: check fails but the given answer IS right`);
        if (right < 0 || right > 999) fail(`CHECK ${c.a}${c.op}${c.b} out of lesson range`);
      });
      if (wrongCount !== 1) fail(`CHECK_CASES should contain exactly one wrong answer, found ${wrongCount}`);

      /* --- 遊戲關卡 --- */
      data.ROUNDS.forEach((r, i) => {
        const expect = r.op === '+' ? r.a + r.b : r.a - r.b;
        if (expect !== r.res) fail(`ROUND ${i+1}: ${r.a}${r.op}${r.b} != ${r.res}`);
        if (r.res < 0 || r.res > 999) fail(`ROUND ${i+1} out of lesson range`);
        const target = r.row === 'a' ? r.a : r.row === 'b' ? r.b : r.res;
        const digit = data.digitsOf(target)[r.p];
        if (digit !== r.ans) fail(`ROUND ${i+1}: smudged digit of ${target} at place ${r.p} is ${digit}, ans says ${r.ans}`);
        if (String(target).length <= r.p) fail(`ROUND ${i+1}: place ${r.p} is not printed for ${target}`);
        if (r.opts.indexOf(r.ans) < 0) fail(`ROUND ${i+1}: ans not among opts`);
        if (new Set(r.opts).size !== r.opts.length) fail(`ROUND ${i+1}: duplicate opts`);
        r.opts.forEach(o => { if (o < 0 || o > 9) fail(`ROUND ${i+1}: option ${o} is not a digit`); });
        ['zh','en'].forEach(L => {
          if (!I18N[L].gHints2[i] || !I18N[L].gWhys[i]) fail(`ROUND ${i+1}: missing ${L} hint/why`);
        });
      });
      if (data.ROUNDS.map(r => r.opts.indexOf(r.ans)).every(x => x === 0))
        fail('every game round has the answer first');
    }
  }
};
