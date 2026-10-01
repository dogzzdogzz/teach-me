/* grade-1/math/pattern 的檢查設定（規律：圖形規律、數的規律、加減互逆）。

   ⚠️ 和 grade-1/two-digit 一樣，這一課的 review.html 每一題只有 3 個選項
   （makeWrongs(correct, candidates, 2) → 正解 + 2 個錯的），不是全站慣例的 4 個。
   ✅ 2026-09-14：simgen.js／verify_lesson_data.js 已經支援每課自訂選項數，這一課用
   下面的 `optCount: 3` 宣告（sim 與 data 各一份），所以選項數這一條現在是真的在看。

   ⚠️ 不要看到 ROUNDS 裡 choices[0] 剛好是正解就假設「正解永遠在第一個」——
   畫按鈕之前會 shuffle()，畫面上的位置和陣列順序無關。這一條由
   lib/gameshuffle.js 統一守（六課共用），它是把 shuffle() 抽出來實際跑，
   不是看原始碼有沒有寫。 */

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

const { gameShuffleProblems } = require('./lib/gameshuffle.js');

module.exports = {
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:'    shuffle(items).forEach(function(it, i){ mk(it, x0 + i * step, y); });',
      replace:'    items.forEach(function(it, i){ mk(it, x0 + i * step, y); });' },
    /* 串珠子：前面看得到的不到兩組，規律推不出來（「圖要決定得了答案」）。 */
    { file:'index', expect:'fewer than two full groups',
      find:"    { unit:['🔺','⬜'],      reps:4, len:8, tray:['🔺','⬜','⭐'] },",
      replace:"    { unit:['🔺','⬜'],      reps:4, len:5, tray:['🔺','⬜','⭐'] }," },
    /* 數字火車：誘答卡就是空車廂要的數 —— 兩張一樣的卡，其中一張「錯」。 */
    { file:'index', expect:'decoy equals a number in the train',
      find:'    { start:2, step:2, n:6, blanks:[3,5], decoys:[9,14] },',
      replace:'    { start:2, step:2, n:6, blanks:[3,5], decoys:[8,14] },' },
    { file:'review', expect:'nums[3]-nums[2] != step',
      find:'        var nums = [start, start + step, start + 2 * step, start + 3 * step];\n        var next = start + 4 * step;\n        /* 誘答：多跳一步（next + step）、差一（next − 1）。舊的 next − step 就是題幹上最後一個數，\n           那是抄題不是迷思；四個已經印出來的數都不可以出現 */\n        var m = mixOpts(next, [next + step, next - 1], nums);\n        return { nums:nums, step:step, next:next, opts:m.opts, ans:m.ans };\n      },\n      fmt: function(d, lang){\n        return {\n          stem: lang === \'zh\' ? d.nums.join(\'、\') + \'、<br>下一個是多少？\' : d.nums.join(\', \') + \', …<br>What comes next?\',',
      replace:'        var nums = [start, start + step, start + 2 * step, start + 3 * step + 1];\n        var next = start + 4 * step;\n        /* 誘答：多跳一步（next + step）、差一（next − 1）。舊的 next − step 就是題幹上最後一個數，\n           那是抄題不是迷思；四個已經印出來的數都不可以出現 */\n        var m = mixOpts(next, [next + step, next - 1], nums);\n        return { nums:nums, step:step, next:next, opts:m.opts, ans:m.ans };\n      },\n      fmt: function(d, lang){\n        return {\n          stem: lang === \'zh\' ? d.nums.join(\'、\') + \'、<br>下一個是多少？\' : d.nums.join(\', \') + \', …<br>What comes next?\',' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 3 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (c >= 0 && c <= MAX_OPT && !seen[key]){ seen[key] = true; out.push(c); }',
      replace:'      if (c >= 0 && c <= MAX_OPT){ out.push(c); }' },
    /* 2026-09-14：review 端的 makeWrongs 現在會避開題幹數字（avoid）。把 avoid 掏空，
       ±1 保底又會撞回題幹上的數字（例：addsub 的 answer − 1 在 b = 1 時就是 a），
       simgen 那條「誘答抄題幹」要響。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    /* decNext 只放行 nums[2]（往回跳一步）；把誘答改回題幹上最後一個數（nums[3]），同一條要響。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'        var m = mixOpts(next, [next - step, nums[3] + step], avoidExcept(nums, [nums[2]]));',
      replace:'        var m = mixOpts(next, [next - step, nums[3]], avoidExcept(nums, [nums[2], nums[3]]));' },
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
    /* 整數欄位：每一條 isInt 分支各有一筆，證明它真的會響。 */
    { file:'index', expect:'start/step/n must be integers',
      find:'    { start:5, step:5, n:6, blanks:[2,5], decoys:[16,35] },',
      replace:'    { start:5, step:2.5, n:6, blanks:[2,5], decoys:[16,35] },' },
    { file:'index', expect:'needs at least one integer blank',
      find:'    { start:3, step:3, n:6, blanks:[4,5], decoys:[13,17] },',
      replace:'    { start:3, step:3, n:6, blanks:[], decoys:[13,17] },' },
    { file:'index', expect:'GAME_GROUPS[2] reps must be an integer',
      find:"    { unit:['🟢','🟡'],      reps:3 }",
      replace:"    { unit:['🟢','🟡'],      reps:2.5 }" },
    { file:'index', expect:'start/jump must be integers',
      find:'    { start:6, jump:3 },',
      replace:'    { start:6, jump:3.5 },' },
    { file:'index', expect:'reps/len must be integers',
      find:"    { unit:['🔴','🔵','🔵'], reps:3, len:8, tray:['🔴','🔵','🟨'] }",
      replace:"    { unit:['🔴','🔵','🔵'], reps:3, len:7.5, tray:['🔴','🔵','🟨'] }" },
    { file:'index', expect:'start/step/hops must be integers',
      find:'    { start:15, step:2, hops:3 }',
      replace:'    { start:15, step:2, hops:1.5 }' },
    /* reps: Infinity —— 檢查本身不可以卡死（要回報，不是掛住）。 */
    { file:'index', expect:'GAME_GROUPS[0] reps must be an integer',
      find:"    { unit:['🔺','⬜','⬜'], reps:2 },",
      replace:"    { unit:['🔺','⬜','⬜'], reps:Infinity }," },
    /* 往回跳要點 0 次 —— hopsLeft 會從 0 變 -1，永遠過不了關。 */
    { file:'index', expect:'hops >= 1',
      find:'    { start:18, step:4, hops:3 },',
      replace:'    { start:18, step:4, hops:0 },' },
    /* 點的珠子縮到手機上不到 44px。 */
    { file:'index', expect:'under 44',
      find:'      var C = 46, G = 4, x0 = (300 - (seq.length * C + (seq.length - 1) * G)) / 2, y0 = 24;',
      replace:'      var C = 40, G = 4, x0 = (300 - (seq.length * C + (seq.length - 1) * G)) / 2, y0 = 24;' },
    /* 往回跳那一關的畫板縮小，格子板放不下 —— 只改 down，hop 不動，檢查要看得出來是哪一關。 */
    { file:'index', expect:'down: the 0~20 frog grid does not fit its board',
      find:"      var B = makeBoard(300, 205);\n      var cells = drawGrid(B);",
      replace:"      var B = makeBoard(300, 150);\n      var cells = drawGrid(B);" },
    /* 往回跳的青蛙跳到 0 以下（格子板只有 0～20）。 */
    { file:'index', expect:'GAME_DOWN[0] hops below 0',
      find:'    { start:20, step:3, hops:3 },',
      replace:'    { start:5, step:3, hops:3 },' }
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
       這兩個數字，是刻意設計。decNext 放行 nums[2]：那是「以為規律還在變大、往回跳一步」
       的迷思（why 寫的就是「不是每個規律都越來越大」，上課頁的迷思檢查題 15、12、9、6 → 9
       也是這樣設計的）；只放行那一格，nums[3]（最後一個數）再出現就是抄題（2026-09-14）。
       其餘的題幹數字 review.html 的 makeWrongs 現在用 avoid 擋掉。 */
    stemEchoOk: {
      hop: (d, opt) => Number(opt) === d.b || Number(opt) === d.c,
      decNext: (d, opt) => Number(opt) === d.nums[2]
    }
  },

  data: {
    /* 三個題庫都是 3 選項。 */
    optCount: 3,
    dataStart: '  /* ---------- 語言無關的資料 ---------- */',
    dataEnd: '  /* ---------- i18n ---------- */',
    dataReturn: '{SHAPE_PATTERNS, INC_PATTERNS, DEC_PATTERNS, HOP_SETS, GAME_BEADS, GAME_GROUPS, GAME_TRAINS, GAME_DOWN, GAME_HOPS}',
    optionValueMax: 70,
    check: function(data, I18N, fail, src){
      /* 小遊戲的選項要洗牌（正解不可以固定在同一個位置）——
         守的是**畫出來的卡片**，不是資料陣列裡的順序，實作在 lib/gameshuffle.js。
         2026-10-01 起遊戲改成拖拉，選項卡片統一由 renderTray() 畫（串珠子、數字火車兩關共用），
         所以守的函式是 renderTray，不是 startRound。 */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);
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

      /* --- 小遊戲（五關五種玩法，§六之五）—— 每一條都從「畫面上看得到的東西」重新推，不讀課程算好的答案 --- */
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== 'beads,group,train,down,hop') fail('GAME_ORDER should be beads,group,train,down,hop, got ' + types.join());
        types.forEach(t => {
          if (!new RegExp('\\n {4}' + t + ': function\\(d\\)\\{').test(src)) fail('GAME_ORDER ' + t + ' has no RENDER.' + t);
          ['zh','en'].forEach(L => {
            if (!(I18N[L].gAsks && typeof I18N[L].gAsks[t] === 'string' && I18N[L].gAsks[t])) fail('gAsks.' + t + ' missing in ' + L);
            if (!(I18N[L].gHints && typeof I18N[L].gHints[t] === 'string' && I18N[L].gHints[t])) fail('gHints.' + t + ' missing in ' + L);
          });
        });
      }
      /* 最短週期：要「至少完整看得到兩輪」才算數（和 shapeAt 同一個道理，但不要求最後一輪完整，
         因為串珠子是從畫面上看得到的前幾格去推後面空著的格子）。 */
      const isInt = v => Number.isInteger(v);
      const minPeriod = seq => { for (let p = 1; 2 * p <= seq.length; p++) if (seq.every((x, i) => x === seq[i % p])) return p; return 0; };
      const repeatSeq = (unit, reps) => { let q = []; for (let r = 0; r < reps; r++) q = q.concat(unit); return q; };
      data.GAME_BEADS.forEach((g, i) => {
        /* 先驗整數、不合格就停 —— reps: Infinity 會讓下面的 repeatSeq 永遠跑不完 */
        if (!isInt(g.reps) || !isInt(g.len) || g.len < 3 || g.reps < 1 || g.reps > 20) return fail('GAME_BEADS[' + i + '] reps/len must be integers, len >= 3, 1 <= reps <= 20');
        const seq = repeatSeq(g.unit, g.reps).slice(0, g.len);
        if (seq.length !== g.len) fail('GAME_BEADS[' + i + '] reps × unit is shorter than len');
        const shown = seq.slice(0, g.len - 2);
        if (shown.length < 2 * g.unit.length) return fail('GAME_BEADS[' + i + '] shows fewer than two full groups before the blanks — the picture cannot decide the answer');
        const p = minPeriod(shown);
        if (p !== g.unit.length) fail('GAME_BEADS[' + i + '] the visible beads repeat every ' + p + ', not every ' + g.unit.length);
        [g.len - 2, g.len - 1].forEach(k => {
          const want = shown[k % p];
          if (want !== seq[k]) fail('GAME_BEADS[' + i + '] blank ' + k + ' should be ' + want + ' from the visible pattern, page expects ' + seq[k]);
          if (g.tray.indexOf(want) < 0) fail('GAME_BEADS[' + i + '] tray is missing the answer ' + want);
        });
        if (new Set(g.tray).size !== g.tray.length) fail('GAME_BEADS[' + i + '] duplicate tray tiles');
        if (!g.tray.some(t => g.unit.indexOf(t) < 0)) fail('GAME_BEADS[' + i + '] tray has no decoy outside the unit');
        if (g.len * 40 - 4 > 320) fail('GAME_BEADS[' + i + '] row is wider than the 320 board');
        g.tray.concat(g.unit).forEach(t => { if (ALL_SHAPES.indexOf(t) < 0) fail('GAME_BEADS[' + i + '] unknown shape ' + t); });
      });
      /* 「點」的目標在手機上至少 44px：從原始碼讀出畫板寬度 W 和格子 C，
         以 375px 手機（卡片內寬約 290px，畫板縮放 290 / W）換算實際大小。 */
      const PHONE_INNER = 290;
      /* 每一關的函式本體（從「    名字: function(d){」切到它自己的「\n    }」），regex 只在本體裡找，
         不會跨到別的關卡去。 */
      const roundBody = name => {
        const a = src.indexOf('\n    ' + name + ': function(d){');
        if (a < 0) return '';
        const b = src.indexOf('\n    }', a + 1);
        return b < 0 ? '' : src.slice(a, b);
      };
      const gm = roundBody('group').match(/makeBoard\((\d+), \d+\);\s*var C = (\d+), G = (\d+)/);
      const gw = gm ? { W:+gm[1], C:+gm[2], G:+gm[3] } : {};
      if (!gm) fail('cannot read the group round board layout (makeBoard(W, H); var C = .., G = ..)');
      else if (gw.C * Math.min(1.5, PHONE_INNER / gw.W) < 44) fail('group beads are ' + (gw.C * PHONE_INNER / gw.W).toFixed(1) + 'px on a 375px phone — under 44');
      const gridM = src.match(/var GRID_COLS = (\d+), GRID_CELL = (\d+), GRID_PITCH = (\d+);/);
      if (!gridM) fail('cannot read the frog grid layout (GRID_COLS / GRID_CELL / GRID_PITCH)');
      else ['down', 'hop'].forEach(name => {
        const gridB = roundBody(name).match(/makeBoard\((\d+), (\d+)\);/);
        if (!gridB) return fail('cannot read the ' + name + ' round board size');
        const [, cols, cellW, pitch] = gridM.map(Number), W = +gridB[1], H = +gridB[2];
        if (cellW * Math.min(1.5, PHONE_INNER / W) < 44) fail(name + ': frog grid squares are ' + (cellW * PHONE_INNER / W).toFixed(1) + 'px on a 375px phone — under 44');
        const rows = Math.ceil(21 / cols);
        if (2 + (cols - 1) * pitch + cellW > W || 5 + (rows - 1) * pitch + cellW > H) fail(name + ': the 0~20 frog grid does not fit its board');
      });
      data.GAME_GROUPS.forEach((g, i) => {
        if (!isInt(g.reps) || g.reps > 20) return fail('GAME_GROUPS[' + i + '] reps must be an integer (<= 20)');
        const seq = repeatSeq(g.unit, g.reps);
        if (g.reps < 2) fail('GAME_GROUPS[' + i + '] reps < 2 — nothing repeats');
        if (minPeriod(seq) !== g.unit.length) fail('GAME_GROUPS[' + i + '] the shortest repeating group is ' + minPeriod(seq) + ' long, not ' + g.unit.length);
        if (!(gw.W > 0) || seq.length * gw.C + (seq.length - 1) * gw.G > gw.W) fail('GAME_GROUPS[' + i + '] row of ' + seq.length + ' beads does not fit the ' + gw.W + ' board');
      });
      data.GAME_TRAINS.forEach((t, i) => {
        if (!isInt(t.start) || !isInt(t.step) || t.step < 1 || !isInt(t.n)) fail('GAME_TRAINS[' + i + '] start/step/n must be integers with step >= 1 (this round is the increasing pattern)');
        if (!Array.isArray(t.blanks) || t.blanks.length < 1 || !t.blanks.every(isInt)) fail('GAME_TRAINS[' + i + '] needs at least one integer blank');
        const nums = []; for (let k = 0; k < t.n; k++) nums.push(t.start + k * t.step);
        if (nums.some(v => v < RANGE.incNext[0] || v > RANGE.incNext[1])) fail('GAME_TRAINS[' + i + '] numbers leave ' + RANGE.incNext.join('~') + ': ' + nums.join(','));
        if (t.blanks.some(b => b < 0 || b >= t.n) || new Set(t.blanks).size !== t.blanks.length) fail('GAME_TRAINS[' + i + '] bad blanks ' + t.blanks.join(','));
        const shown = nums.map((v, k) => t.blanks.indexOf(k) < 0 ? k : -1).filter(k => k >= 0);
        if (shown.indexOf(0) < 0 || shown.indexOf(1) < 0 || shown.length < 3) fail('GAME_TRAINS[' + i + '] the first two cars (and a third) must be visible to see the step');
        t.decoys.forEach(v => { if (nums.indexOf(v) >= 0) fail('GAME_TRAINS[' + i + '] decoy equals a number in the train: ' + v); });
        if (new Set(t.decoys).size !== t.decoys.length) fail('GAME_TRAINS[' + i + '] duplicate decoys');
        if (t.blanks.length + t.decoys.length > 5) fail('GAME_TRAINS[' + i + '] more than 5 cards do not fit the tray');
        if (t.n * 52 - 6 > 320) fail('GAME_TRAINS[' + i + '] train is wider than the 320 board');
      });
      data.GAME_DOWN.forEach((t, i) => {
        if (![t.start, t.step, t.hops].every(isInt) || t.hops < 1) fail('GAME_DOWN[' + i + '] start/step/hops must be integers with hops >= 1');
        if (t.start > 20) fail('GAME_DOWN[' + i + '] starts beyond the 0~20 grid');
        /* 青蛙先示範一跳，孩子再點 hops 次 —— 總共 hops + 1 跳 */
        if (t.start - t.step * (t.hops + 1) < 0) fail('GAME_DOWN[' + i + '] hops below 0');
        if (t.step < 2) fail('GAME_DOWN[' + i + '] step < 2 is just counting back by ones');
      });
      data.GAME_HOPS.forEach((h, i) => {
        if (!isInt(h.start) || !isInt(h.jump)) fail('GAME_HOPS[' + i + '] start/jump must be integers');
        if (h.start < 0 || h.start + h.jump > 10) fail('GAME_HOPS[' + i + '] leaves the 0~10 hop range of the lesson');
        if (h.jump < 1) fail('GAME_HOPS[' + i + '] jump < 1');
      });
    }
  }
};
