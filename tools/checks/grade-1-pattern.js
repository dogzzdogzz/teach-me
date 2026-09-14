/* grade-1/math/pattern 的檢查設定（規律：圖形規律、數的規律、加減互逆）。

   ⚠️ 和 grade-1/two-digit 一樣，這一課的 review.html 每一題只有 3 個選項
   （makeWrongs(correct, candidates, 2) → 正解 + 2 個錯的），不是全站慣例的 4 個。
   tools/simgen.js 的選項數檢查寫死是 4，這一課因此結構性地不可能全綠 ——
   不是這份設定檔的洞，是這一課的選項數和全站共用腳本的假設不一致（見
   tools/checks/grade-1-two-digit.js 開頭同一段說明）。

   index.html 的小遊戲和其他幾課不一樣：`shuffle(round.choices).forEach(...)`
   真的有洗牌，所以「正解永遠在第一個」那個缺陷這一課沒有 —— 讀 render 的程式碼
   才知道，不能看到 ROUNDS 裡 choices[0] 剛好是正解就假設又中了同一個缺陷。 */

const ALL_SHAPES = ['🔺','⬜','⭐','🟢','🟡','🔷','🔴','🔵','🟨'];

const RANGE = {
  incNext:[0,40], decNext:[0,40], twoStep:[0,40], hop:[0,10], numbers:[0,70], bonds:[0,10], addsub:[0,21]
};

module.exports = {
  breaks: [
    { file:'review', expect:'nums[3]-nums[2] != step',
      find:'        var nums = [start, start + step, start + 2 * step, start + 3 * step];\n        var next = start + 4 * step;\n        var m = mixOpts(next, [next - step, next + step]);\n        return { nums:nums, step:step, next:next, opts:m.opts, ans:m.ans };\n      },\n      fmt: function(d, lang){\n        return {\n          stem: lang === \'zh\' ? d.nums.join(\'、\') + \'、<br>下一個是多少？\' : d.nums.join(\', \') + \', …<br>What comes next?\',',
      replace:'        var nums = [start, start + step, start + 2 * step, start + 3 * step + 1];\n        var next = start + 4 * step;\n        var m = mixOpts(next, [next - step, next + step]);\n        return { nums:nums, step:step, next:next, opts:m.opts, ans:m.ans };\n      },\n      fmt: function(d, lang){\n        return {\n          stem: lang === \'zh\' ? d.nums.join(\'、\') + \'、<br>下一個是多少？\' : d.nums.join(\', \') + \', …<br>What comes next?\',' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 3 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (c >= 0 && !seen[key]){ seen[key] = true; out.push(c); }',
      replace:'      if (c >= 0){ out.push(c); }' },
    { file:'review', expect:'unit[correctIdx] != correct',
      find:'        var correctIdx = (pos - 1) % len;\n        var correct = su.unit[correctIdx];',
      replace:'        var correctIdx = (pos - 1) % len;\n        var correct = su.unit[(correctIdx + 1) % len];' },
    { file:'index', expect:'INC_PATTERNS[0] step mismatch',
      find:'    { nums:[2,4,6,8],     step:2,  next:10 },',
      replace:'    { nums:[2,4,6,8],     step:3,  next:10 },' },
    { file:'index', expect:'DEC_PATTERNS[0] next != nums[3]-step',
      find:'    { nums:[20,18,16,14], step:2,  next:12 },',
      replace:'    { nums:[20,18,16,14], step:2,  next:13 },' },
    { file:'index', expect:'HOP_SETS[0] target exceeds the 0~10 hop grid',
      find:'    { start:3, jump:4 },',
      replace:'    { start:8, jump:4 },' },
    { file:'index', expect:'ROUNDS[1] num round arithmetic',
      find:"    { kind:'num',   seq:[1,4,7,10], step:3, dir:'+', correct:13, choices:[13,12,16] },",
      replace:"    { kind:'num',   seq:[1,4,7,10], step:3, dir:'+', correct:14, choices:[13,12,16] }," }
  ],

  sim: {
    /* 這一課整份都是 3 選項。 */
    optCount: 3,
    INVARIANTS: {
      incNext: d => {
        for (let k = 0; k < 3; k++) if (d.nums[k+1] - d.nums[k] !== d.step) return 'nums[' + (k+1) + ']-nums[' + k + '] != step';
        if (d.nums[3] + d.step !== d.next) return 'nums[3]+step != next';
      },
      decNext: d => {
        for (let k = 0; k < 3; k++) if (d.nums[k] - d.nums[k+1] !== d.step) return 'nums[' + k + ']-nums[' + (k+1) + '] != step';
        if (d.nums[3] - d.step !== d.next) return 'nums[3]-step != next';
        if (d.next < 0) return 'next went negative';
      },
      shapeNext: d => {
        if (d.unit[0] !== d.correct) return 'unit[0] != correct';
        if (d.seq.length % d.unit.length !== 0) return 'seq is not a whole number of repeats of unit';
      },
      shapePos: d => {
        const correctIdx = (d.pos - 1) % d.unit.length;
        if (d.unit[correctIdx] !== d.correct) return 'unit[correctIdx] != correct';
        if (d.pos <= d.seq.length) return 'pos is within the shown sequence, not actually being asked to extrapolate';
      },
      twoStep: d => {
        for (let k = 0; k < 3; k++) if (d.nums[k+1] - d.nums[k] !== d.step) return 'nums[' + (k+1) + ']-nums[' + k + '] != step';
        if (d.nums[3] + d.step !== d.blank1) return 'nums[3]+step != blank1';
        if (d.blank1 + d.step !== d.blank2) return 'blank1+step != blank2';
      },
      hop: d => {
        if (d.a + d.b !== d.c) return 'a+b != c';
        if (d.c - d.b !== d.a) return 'c-b != a (inverse should round-trip)';
      },
      numbers: d => {
        if (d.step * d.k !== d.answer) return 'step*k != answer';
        if ([2,5,10].indexOf(d.step) < 0) return 'step outside {2,5,10}';
      },
      bonds: d => {
        if (d.n + d.need !== 10) return 'n+need != 10';
      },
      addsub: d => {
        const want = d.isAdd ? d.a + d.b : d.a - d.b;
        if (want !== d.answer) return 'a op b != answer';
        if (d.answer < 0) return 'negative answer';
      }
    },
    expectedCorrect: function(d, genId){
      switch (genId){
        case 'incNext': return String(d.next);
        case 'decNext': return String(d.next);
        case 'shapeNext': return d.correct;
        case 'shapePos': return d.correct;
        case 'twoStep': return String(d.blank2);
        case 'hop': return String(d.a);
        case 'numbers': return String(d.answer);
        case 'bonds': return String(d.need);
        case 'addsub': return String(d.answer);
        default: throw new Error('unknown genId ' + genId);
      }
    },
    optionOk: function(s, genId){
      if (genId === 'shapeNext' || genId === 'shapePos'){
        return ALL_SHAPES.indexOf(s) < 0 ? ('option "' + s + '" is not one of this lesson\'s known shape icons') : null;
      }
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      const [lo, hi] = RANGE[genId] || [0, 40];
      if (!(v >= lo && v <= hi)) return 'option ' + s + ' outside ' + lo + '~' + hi + ' for this generator';
      return null;
    },
    /* hop 的題幹本來就把 b 和 c 都印出來（a+b=c，所以 c-b=?），兩個誘答剛好就是
       這兩個數字，是刻意設計。 */
    stemEchoOk: {
      hop: (d, opt) => Number(opt) === d.b || Number(opt) === d.c
    }
  },

  data: {
    /* 三個題庫都是 3 選項。 */
    optCount: 3,
    dataStart: '  /* ---------- 語言無關的資料 ---------- */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{SHAPE_PATTERNS, INC_PATTERNS, DEC_PATTERNS, HOP_SETS, ROUNDS}',
    optionValueMax: 70,
    check: function(data, I18N, fail){
      /* --- 範例：圖形規律 --- */
      data.SHAPE_PATTERNS.forEach((p, i) => {
        if (p.unit.indexOf(p.decoy) >= 0) fail('SHAPE_PATTERNS[' + i + '] decoy is also inside its own unit');
        if (p.reps < 2) fail('SHAPE_PATTERNS[' + i + '] reps < 2 — not enough repeats to show a pattern');
      });

      /* --- 範例：遞增／遞減數的規律 --- */
      data.INC_PATTERNS.forEach((p, i) => {
        for (let k = 0; k < 3; k++) if (p.nums[k+1] - p.nums[k] !== p.step) fail('INC_PATTERNS[' + i + '] step mismatch at index ' + k);
        if (p.nums[3] + p.step !== p.next) fail('INC_PATTERNS[' + i + '] next != nums[3]+step');
      });
      data.DEC_PATTERNS.forEach((p, i) => {
        for (let k = 0; k < 3; k++) if (p.nums[k] - p.nums[k+1] !== p.step) fail('DEC_PATTERNS[' + i + '] step mismatch at index ' + k);
        if (p.nums[3] - p.step !== p.next) fail('DEC_PATTERNS[' + i + '] next != nums[3]-step');
        if (p.next < 0) fail('DEC_PATTERNS[' + i + '] next went negative');
      });

      /* --- 範例：往前跳、往回跳（0~10 的跳格板） --- */
      data.HOP_SETS.forEach((h, i) => {
        if (h.start < 0 || h.start > 10) fail('HOP_SETS[' + i + '] start outside the 0~10 hop grid');
        if (h.start + h.jump > 10) fail('HOP_SETS[' + i + '] target exceeds the 0~10 hop grid');
        ['zh','en'].forEach(L => {
          const t = I18N[L].hopLine(h);
          if (/undefined|NaN/.test(t)) fail('HOP_SETS[' + i + '] hopLine ' + L + ': ' + t);
        });
      });

      /* --- 小遊戲 --- */
      data.ROUNDS.forEach((r, i) => {
        if (r.choices.indexOf(r.correct) < 0) fail('ROUNDS[' + i + '] correct not among choices');
        if (new Set(r.choices).size !== r.choices.length) fail('ROUNDS[' + i + '] duplicate choices');
        if (r.kind === 'shape'){
          if (r.unit[0] !== r.correct) fail('ROUNDS[' + i + '] shape round: unit[0] != correct');
          if (r.seq.length % r.unit.length !== 0) fail('ROUNDS[' + i + '] shape round: seq is not a whole number of repeats');
        } else if (r.kind === 'num'){
          const last = r.seq[r.seq.length - 1];
          const want = r.dir === '+' ? last + r.step : last - r.step;
          if (want !== r.correct) fail('ROUNDS[' + i + '] num round arithmetic: last=' + last + ' dir=' + r.dir + ' step=' + r.step + ' -> ' + want + ' != correct ' + r.correct);
          for (let k = 0; k < r.seq.length - 1; k++){
            const d = r.dir === '+' ? r.seq[k+1] - r.seq[k] : r.seq[k] - r.seq[k+1];
            if (d !== r.step) fail('ROUNDS[' + i + '] num round: seq step mismatch at index ' + k);
          }
        } else {
          fail('ROUNDS[' + i + '] unknown kind ' + r.kind);
        }
      });
      /* 這一課的遊戲會在 render 時 shuffle(round.choices)，所以「來源資料裡
         choices[0] 剛好是正解」不是缺陷 —— 特意不加「永遠在第一個」那條斷言。 */
    }
  }
};
