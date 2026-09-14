/* grade-1/math/pattern 的檢查設定（規律：圖形規律、數的規律、加減互逆）。

   ⚠️ 和 grade-1/two-digit 一樣，這一課的 review.html 每一題只有 3 個選項
   （makeWrongs(correct, candidates, 2) → 正解 + 2 個錯的），不是全站慣例的 4 個。
   ✅ 2026-09-14：simgen.js／verify_lesson_data.js 已經支援每課自訂選項數，這一課用
   下面的 `optCount: 3` 宣告（sim 與 data 各一份），所以選項數這一條現在是真的在看。

   index.html 的小遊戲和其他幾課不一樣：`shuffle(round.choices).forEach(...)`
   真的有洗牌，所以「正解永遠在第一個」那個缺陷這一課沒有 —— 讀 render 的程式碼
   才知道，不能看到 ROUNDS 裡 choices[0] 剛好是正解就假設又中了同一個缺陷。 */

const ALL_SHAPES = ['🔺','⬜','⭐','🟢','🟡','🔷','🔴','🔵','🟨'];

/* 圖案規律題的第二套實作：**只看畫面上那一串圖案**，不讀課程算好的 unit／correct。
   做法是從 seq 自己找出最短的重複週期（seq[i] 必須等於 seq[i % p]，對每一個 i），
   再把規律延伸到第 idx 格（idx 從 0 起算）。
   ⚠️ 週期要**真的重複完整兩輪以上**才算數，兩個條件缺一不可：
     ① seq.length >= 2 * p  —— 至少看得到兩輪；
     ② seq.length % p === 0 —— 最後一輪是完整的。
   少了這兩條，🔺⬜⭐🔺 會被判成「週期 3」（因為最後一個剛好等於第一個），
   然後煞有介事地回一個推不出來的答案（codex 第一輪抓到）。
   ⚠️ 找不到這樣的週期就丟錯，不回一個看起來合理的值 —— 「這串圖案沒有在重複」
   本身就是缺陷，不可以被安靜吸收掉。 */
function shapeAt(seq, idx){
  if (!Array.isArray(seq) || seq.length === 0) throw new Error('shapeAt: empty seq');
  for (let p = 1; p <= Math.floor(seq.length / 2); p++){
    if (seq.length % p !== 0) continue;
    let ok = true;
    for (let i = 0; i < seq.length; i++){
      if (seq[i] !== seq[i % p]){ ok = false; break; }
    }
    if (ok) return seq[idx % p];
  }
  throw new Error('shapeAt: no repeating unit in ' + seq.join(''));
}

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
    /* 畫面上那一串圖案是把「重複的一組」**反過來**排的（shapeNext）。
       ⚠️ 這一筆是專門用來證明 expectedCorrect 真的在讀畫面上的 seq：
       INVARIANTS 的兩條（unit[0] === correct、seq.length % unit.length === 0）
       在這個改壞之下**全部照樣通過**，因為 unit 和 correct 一個字都沒有變，
       變的只有孩子真正看到的那一串。舊版 expectedCorrect（回傳 d.correct）
       會和課本一起錯，完全抓不到。
       ⚠️ 用「反過來」而不是「旋轉一格」：旋轉對 ['🟢','🟢','🟡'] 與 ['🔴','🔴','🔵']
       的第一個圖案沒有效果（仍然是 🟢／🔴），那樣三組裡只有一組真的會響
       （codex 第一輪抓到）。反過來之後三組的第一個圖案都變了。 */
    { file:'review', expect:'opts[ans] != correct',
      find:'        var reps = pick([2, 3]);\n        var seq = [];\n        for (var r = 0; r < reps; r++) seq = seq.concat(su.unit);',
      replace:'        var reps = pick([2, 3]);\n        var seq = [];\n        var rev = su.unit.slice().reverse();\n        for (var r = 0; r < reps; r++) seq = seq.concat(rev);' },
    /* 同一個改壞，但這一次動的是 shapePos —— 證明 shapeAt 兩個題型都在守。
       ⚠️ 這一筆**不是每一組 (unit, pos) 都會變**：['🟢','🟢','🟡'] 反過來是
       ['🟡','🟢','🟢']，位置落在該組第 2 個時兩邊都還是 🟢（pos = 8 就是），
       ['🔴','🔴','🔵'] 同理（codex 第二輪指出來的）。它靠的是 breaktest 跑 400 批
       一定會抽到會變的那些位置；breaktest 的種子是寫死的（SEED = '20260825'），
       所以結果是可重現的，不是碰運氣。**不要把它當成「每一種擺法都證明過了」。** */
    { file:'review', expect:'opts[ans] != correct',
      find:'        var reps = 2;\n        var seq = [];\n        for (var r = 0; r < reps; r++) seq = seq.concat(su.unit);',
      replace:'        var reps = 2;\n        var seq = [];\n        var rev = su.unit.slice().reverse();\n        for (var r = 0; r < reps; r++) seq = seq.concat(rev);' },
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
    /* 正解字串的第二套實作。
       ⚠️ 規則：**只讀孩子在題幹上真的看得到的東西**（數列 nums／圖案序列 seq／
       題幹印出來的數字），然後自己推一次。不可以讀回 make() 算好的答案欄位
       （next／correct／blank2／answer／need／a）—— 那等於拿課本的答案比課本的答案，
       課本算錯時兩邊一起錯，檢查照樣綠燈。
       ⚠️ 數列題連 step 都不讀：規律要從畫面上那四個數字自己量出來，
       這樣「印出來的數列」和「被當成正解的那個數」對不上時才會響。
       圖案題同理，重複的一組要從 seq 自己找出來，不讀 d.unit。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        /* 「nums[0]、nums[1]、nums[2]、nums[3]、下一個是多少？」——
           規律從畫面上最後兩個數量出來，遞增和遞減是同一條式子。 */
        case 'incNext':
        case 'decNext':   return String(d.nums[3] + (d.nums[3] - d.nums[2]));
        /* 「seq……接下來是哪一個？」——重複的一組由 seq 自己找，答案是再下一格。 */
        case 'shapeNext': return shapeAt(d.seq, d.seq.length);
        /* 「seq（共 N 個）……第 pos 個會是哪一個？」 */
        case 'shapePos':  return shapeAt(d.seq, d.pos - 1);
        /* 「nums[0]、…、nums[3]、___、___　第二個空格是多少？」——第二格跳兩步。 */
        case 'twoStep':   return String(d.nums[3] + 2 * (d.nums[3] - d.nums[2]));
        /* 「a + b = c，那麼 c − b = ?」——問的是 c − b，不是把 a 抄回來。 */
        case 'hop':       return String(d.c - d.b);
        /* 「從 0 開始，每次加 step，加了 k 次之後是多少？」 */
        case 'numbers':   return String(d.step * d.k);
        /* 「n + ___ = 10」 */
        case 'bonds':     return String(10 - d.n);
        /* 「a + b = ?」或「a − b = ?」 */
        case 'addsub':    return String(d.isAdd ? d.a + d.b : d.a - d.b);
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
