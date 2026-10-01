/* grade-1/math/add-sub 的檢查設定（20 以內加減：情境分類、湊十、拆十）。 */

const arithAS = require('./lib/arith.js').makeArith({});
/* 小遊戲的結語（「10 + 3 = 13」「8 − 5 = 3」）另外用一個驗算器：試題那一個的覆蓋率摘要不要被遊戲的字串攪動。 */
const arithGame = require('./lib/arith.js').makeArith({});

const { gameShuffleProblems } = require('./lib/gameshuffle.js');

module.exports = {
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:"    shuffle(items).forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });",
      replace:"    items.forEach(function(it, i){ mk(it, x0 + (i % cols) * step, y + Math.floor(i / cols) * 56); });" },
    { file:'review', expect:'a+b != sum',
      find:'        var sum = a + b;\n        /* 誘答刻意放 |a − b|（該加卻減）；它有時剛好等於 a 或 b，那仍是同一個迷思，其餘的加數不可以出現 */\n        var m = mixOpts(sum, [sum - 1, sum + 1, Math.abs(a - b)], avoidExcept([a, b], [Math.abs(a - b)]));',
      replace:'        var sum = a + b + 1;\n        /* 誘答刻意放 |a − b|（該加卻減）；它有時剛好等於 a 或 b，那仍是同一個迷思，其餘的加數不可以出現 */\n        var m = mixOpts(sum, [sum - 1, sum + 1, Math.abs(a - b)], avoidExcept([a, b], [Math.abs(a - b)]));' },
    /* 2026-09-14：review 端的 makeWrongs 現在會避開題幹數字（avoid）。把 avoid 掏空，
       ±1 保底又會撞回題幹上的數字（例：addMore 的 total − 1 在 arrive = 1 時就是 start），
       simgen 那條「誘答抄題幹」要響。 */
    { file:'review', expect:'is copied straight out of the stem',
      find:'    (avoid || []).forEach(function(v){ seen[String(v)] = true; });',
      replace:'    ([]).forEach(function(v){ seen[String(v)] = true; });' },
    /* 這一課的上限 MAX_OPT = 20 同時管 compareDiff 的「a + b 衝出去就退而放 b」與 makeWrongs 的
       候選／保底範圍；把它放寬到 40，a + b（最大 39）就會直接端出來，RANGE 那條要響。
       （只拿掉 compareDiff 那個門檻是不夠的：makeWrongs 還會用 MAX_OPT 把 a + b 擋掉，證明不了 RANGE 在看。） */
    { file:'review', expect:'outside the lesson range',
      find:'  var MAX_OPT = 20;',
      replace:'  var MAX_OPT = 40;' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (c >= 0 && c <= MAX_OPT && !seen[key]){ seen[key] = true; out.push(c); }',
      replace:'      if (c >= 0 && c <= MAX_OPT){ out.push(c); }' },
    { file:'review', expect:'a+remain != 10',
      find:'        var a = pickUnused([6,7,8,9], used);\n        var remain = 10 - a;',
      replace:'        var a = pickUnused([6,7,8,9], used);\n        var remain = 10 - a + 1;' },
    { file:'index', expect:'REGROUP_UP[0] a+b does not cross ten',
      find:'  var REGROUP_UP = [ {a:8,b:5}, {a:7,b:5}, {a:9,b:4} ];',
      replace:'  var REGROUP_UP = [ {a:8,b:1}, {a:7,b:5}, {a:9,b:4} ];' },
    { file:'index', expect:'REGROUP_DOWN[0] b does not exceed the ones digit',
      find:'  var REGROUP_DOWN = [ {total:13,b:5}, {total:12,b:4}, {total:15,b:7} ];',
      replace:'  var REGROUP_DOWN = [ {total:13,b:2}, {total:12,b:4}, {total:15,b:7} ];' },
    { file:'index', expect:'arithmetic is wrong',
      find:"why:'這是合併：3 + 5 = 8。'",
      replace:"why:'這是合併：3 + 5 = 9。'" },
    /* --- 小遊戲（2026-10-01 改成五關五種玩法）：每一條不變量各有一筆，證明它真的會響 --- */
    { file:'index', expect:'STORY_OP.compare is +, expected −',
      find:"  var STORY_OP = { combine:'+', add:'+', remove:'−', compare:'−', totalLeft:'−' };",
      replace:"  var STORY_OP = { combine:'+', add:'+', remove:'−', compare:'+', totalLeft:'−' };" },
    { file:'index', expect:'GAME_STORIES[0] needs 2 adding and 2 subtracting stories',
      find:"    [ { t:'combine', a:3, b:4 }, { t:'add', a:5, b:2 }, { t:'remove', a:8, b:3 },",
      replace:"    [ { t:'combine', a:3, b:4 }, { t:'add', a:5, b:2 }, { t:'combine', a:8, b:3 }," },
    { file:'index', expect:'GAME_STORIES[3] compare needs a > b',
      find:"{ t:'compare', a:11, b:7 }",
      replace:"{ t:'compare', a:7, b:11 }" },
    { file:'index', expect:'GAME_STORIES[2] combine 8+16 outside 0..20',
      find:"    [ { t:'combine', a:8, b:6 },",
      replace:"    [ { t:'combine', a:8, b:16 }," },
    { file:'index', expect:'story card text must show a then b',
      find:"        remove:function(a, b){ return '盤子裡有 ' + a + ' 顆草莓，吃掉 ' + b + ' 顆，還剩幾顆？'; },",
      replace:"        remove:function(a, b){ return '盤子裡有 ' + b + ' 顆草莓，吃掉 ' + a + ' 顆，還剩幾顆？'; }," },
    { file:'index', expect:'gStoryNot.totalLeft zh does not say 減法',
      find:"        totalLeft:'看到「一共」不一定要加：球被拿走了，變少了，要用減法。'",
      replace:"        totalLeft:'看到「一共」就要用加法。'" },
    { file:'index', expect:'GAME_COMPARE[0] needs integers with 2 <= b < a <= 10',
      find:'    { a:8, b:5 }, { a:7, b:4 }, { a:9, b:6 }, { a:6, b:2 }, { a:10, b:7 }, { a:7, b:3 }',
      replace:'    { a:5, b:8 }, { a:7, b:4 }, { a:9, b:6 }, { a:6, b:2 }, { a:10, b:7 }, { a:7, b:3 }' },
    { file:'index', expect:'GAME_HOPS[4] lands on -2',
      find:"{ start:15, hop:7, op:'sub' }",
      replace:"{ start:5, hop:7, op:'sub' }" },
    { file:'index', expect:'GAME_HOPS[0] op must be add or sub',
      find:"    { start:9, hop:5, op:'add' },",
      replace:"    { start:9, hop:5, op:'plus' }," },
    { file:'index', expect:'GAME_MAKE10[5] 6+3 does not cross ten',
      find:'{ a:6, b:5 }, { a:7, b:5 }',
      replace:'{ a:6, b:3 }, { a:7, b:5 }' },
    { file:'index', expect:'GAME_MAKE10[3] leaves 6 outside, more than the 5 spots',
      find:'{ a:9, b:6 }, { a:8, b:7 }',
      replace:'{ a:9, b:7 }, { a:8, b:7 }' },
    { file:'index', expect:'GAME_BREAK10[1] b 2 does not exceed the 2 loose ones',
      find:'{ total:12, b:4 }, { total:15, b:7 },',
      replace:'{ total:12, b:2 }, { total:15, b:7 },' },
    { file:'index', expect:'GAME_BREAK10[5] total 17 leaves 7 loose',
      find:'{ total:15, b:9 }',
      replace:'{ total:17, b:9 }' },
    { file:'index', expect:'gM10Done',
      find:"' 個，10 + ' + r + ' = ' + s + '。所以 '",
      replace:"' 個，10 + ' + r + ' = ' + (s + 1) + '。所以 '" },
    /* 散文裡的數（「10 minus 2 leaves 7」）驗算器讀不到 —— 逐個比數字的那一條要響 */
    { file:'index', expect:'gB10Done: numbers should read',
      find:"return t + ' minus ' + ones + ' makes 10, then 10 minus ' + rest + ' leaves ' + res + '.",
      replace:"return t + ' minus ' + ones + ' makes 10, then 10 minus ' + rest + ' leaves ' + (res - 1) + '." },
    { file:'index', expect:'gCmpDone',
      find:"return n0 + '比' + n1 + '多 ' + (a - b) + ' 張：' + a + ' − ' + b + ' = ' + (a - b) + '。';",
      replace:"return n0 + '比' + n1 + '多 ' + (a - b) + ' 張：' + a + ' − ' + b + ' = ' + (a + b) + '。';" },
    { file:'index', expect:'out-box spots overlap',
      find:'  function outSpot(i){ return { cx:OUT_BOX.x + 30 + i * 48, cy:OUT_BOX.y + OUT_BOX.h / 2 }; }',
      replace:'  function outSpot(i){ return { cx:OUT_BOX.x + 30 + i * 40, cy:OUT_BOX.y + OUT_BOX.h / 2 }; }' },
    { file:'index', expect:'under 44',
      find:"        addPiece(B, { w:46, h:46, cx:cx, cy:cy, text:'', cls:'gdot',",
      replace:"        addPiece(B, { w:40, h:46, cx:cx, cy:cy, text:'', cls:'gdot'," },
    { file:'index', expect:'GRID_CELL',
      find:'  var GRID_COLS = 6, GRID_CELL = 46, GRID_PITCH = 50;',
      replace:'  var GRID_COLS = 6, GRID_CELL = 40, GRID_PITCH = 50;' },
    { file:'index', expect:'FRAME_CELL',
      find:'  var FRAME_CELL = 46, FRAME_PITCH = 50;',
      replace:'  var FRAME_CELL = 42, FRAME_PITCH = 50;' },
    { file:'index', expect:'TW',
      find:'      var TW = 46, TP = 56, tx0',
      replace:'      var TW = 40, TP = 56, tx0' },
    { file:'index', expect:'story cards in the tray overlap',
      find:"        pieces.push(addPiece(B, { w:288, h:50,",
      replace:"        pieces.push(addPiece(B, { w:288, h:60," },
    { file:'index', expect:'the second sorted card sticks out of the box',
      find:"bx.R.y + 60 + bx.items * 46);",
      replace:"bx.R.y + 60 + bx.items * 56);" },
    /* codex 第一輪：外面框的間距只拿 FRAME_CELL 比，湊十拖過去的點點變寬也不會響 */
    { file:'index', expect:'out-box spots overlap (pitch 48 < dot 50)',
      find:"        addPiece(B, { w:46, h:46, cx:cx, cy:cy, text:'', cls:'gdot',",
      replace:"        addPiece(B, { w:50, h:46, cx:cx, cy:cy, text:'', cls:'gdot'," },
    { file:'index', expect:'inside the borders of its 142-wide box',
      find:"P.w = 130; P.h = 42; P.el.style.width = '130px';",
      replace:"P.w = 150; P.h = 42; P.el.style.width = '150px';" },
    { file:'index', expect:'gClear missing',
      find:"      gClear:'按「下一關」繼續下一題。',\n      gWin:function(score){ return '五關全破！",
      replace:"      gWin:function(score){ return '五關全破！" }
  ],

  sim: {
    INVARIANTS: {
      combineSum: d => {
        if (d.a + d.b !== d.sum) return 'a+b != sum';
      },
      missingAddend: d => {
        if (d.a + d.b !== d.total) return 'a+b != total';
        if (d.total - d.a !== d.b) return 'total-a != b';
      },
      addMore: d => {
        if (d.start + d.arrive !== d.total) return 'start+arrive != total';
      },
      takeAway: d => {
        if (d.total - d.taken !== d.remain) return 'total-taken != remain';
        if (d.remain < 0) return 'negative remainder';
      },
      missingSubtrahend: d => {
        if (d.total - d.missing !== d.result) return 'total-missing != result';
        if (d.total - d.result !== d.missing) return 'total-result != missing';
      },
      compareDiff: d => {
        if (d.a - d.b !== d.gap) return 'a-b != gap';
        if (d.gap < 1) return 'non-positive gap: not a valid compare story';
      },
      makeTenAdd: d => {
        if (d.a + d.remain !== 10) return 'a+remain != 10';
        if (d.b <= d.remain) return 'why claims a carry (crossing ten) but b does not exceed remain';
        if (d.b - d.remain !== d.leftover) return 'b-remain != leftover';
        if (10 + d.leftover !== d.sum) return '10+leftover != sum';
        if (d.a + d.b !== d.sum) return 'a+b != sum';
      },
      breakTenSub: d => {
        if (d.total - 10 !== d.ones) return 'total-10 != ones';
        if (d.b <= d.ones) return 'why claims a borrow (crossing ten) but b does not exceed ones';
        if (d.total - d.b !== d.result) return 'total-b != result';
        if (10 - (d.b - d.ones) !== d.result) return '10-(b-ones) != result';
      }
    },
    /* 正解字串的第二套實作。
       ⚠️ 規則：**只讀題幹上真的印出來的那幾個數字**，然後自己算一次。
       不可以讀回 make() 算好的答案欄位（sum／b／total／remain／missing／gap／result）——
       那等於拿課本的答案比課本的答案，課本算錯時兩邊一起錯，檢查照樣綠燈。
       每一行上面的註解是「孩子看到的題幹」，答案就是從那句話推出來的。 */
    expectedCorrect: function(d, genId){
      switch (genId){
        /* 「a + b = ?」 */
        case 'combineSum':        return String(d.a + d.b);
        /* 「a + ? = total」 */
        case 'missingAddend':     return String(d.total - d.a);
        /* 「原本有 start 個。又來了 arrive 個。現在有幾個？」 */
        case 'addMore':           return String(d.start + d.arrive);
        /* 「原本有 total 個。拿走 taken 個。還剩幾個？」 */
        case 'takeAway':          return String(d.total - d.taken);
        /* 「原本有 total 個，拿走一些後剩下 result 個，拿走了幾個？」 */
        case 'missingSubtrahend': return String(d.total - d.result);
        /* 「小安有 a 個。小美有 b 個。小安比小美多幾個？」 */
        case 'compareDiff':       return String(d.a - d.b);
        /* 「a + b = ?」（湊十法只是算法，答案還是 a + b） */
        case 'makeTenAdd':        return String(d.a + d.b);
        /* 「total − b = ?」（拆十法只是算法，答案還是 total − b） */
        case 'breakTenSub':       return String(d.total - d.b);
        default: throw new Error('unknown genId ' + genId);
      }
    },
    /* 選項一律是非負整數。這一課宣稱「所有結果 0~20 之間」；2026-09-14 起 review.html 的
       makeWrongs 連明寫的候選都擋在 MAX_OPT = 20 以內（addMore 在 total = 20 時的 total + 1 不再出現），
       所以以前容許到 21 的邊界容差收緊成 20。compareDiff 以前用 a + b 當誘答會衝到 39，
       現在 a + b > 20 時退而放 b —— 上限只有收緊，沒有放寬。 */
    optionOk: function(s){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      if (!(v >= 0 && v <= 20)) return 'option ' + s + ' outside the lesson range (0~20)';
      return null;
    },
    /* 題幹本來就會印出來、刻意拿來當誘答的那個數字。
       combineSum 的 |a − b|（該加卻減）本身不是題幹數字，但 a = 2b 時剛好等於 b —— 仍是同一個
       迷思的結果，放行的是這一個值。compareDiff 平常放 a + b（不是題幹數字），只有 a + b > 20
       時退而放 b（直接抄小美的數量；上課頁的迷思檢查題就用了這個），所以謂詞連條件一起寫。
       其餘的題幹數字 review.html 的 makeWrongs 現在用 avoid 擋掉，這裡沒有放行 → 再出現就是缺陷。 */
    stemEchoOk: {
      combineSum: (d, opt) => Number(opt) === Math.abs(d.a - d.b),
      compareDiff: (d, opt) => d.a + d.b > 20 && Number(opt) === d.b,
      missingAddend: (d, opt) => Number(opt) === d.total,
      addMore: (d, opt) => Number(opt) === d.arrive,
      takeAway: (d, opt) => Number(opt) === d.taken,
      missingSubtrahend: (d, opt) => Number(opt) === d.result
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{SCENARIOS, LINE_PROBS, REGROUP_UP, REGROUP_DOWN, STORY_OP, GAME_STORIES, GAME_COMPARE, GAME_HOPS, GAME_MAKE10, GAME_BREAK10}',
    optionValueMax: 21,
    check: function(data, I18N, fail, src){
      /* --- 範例 1：四種情境類型 --- */
      data.SCENARIOS.forEach(s => {
        if (s.id === 'compare'){
          if (s.a <= s.b) fail('SCENARIOS[' + s.id + '] compare needs a > b, got a=' + s.a + ' b=' + s.b);
        } else if (s.id === 'remove'){
          if (s.a < s.b) fail('SCENARIOS[' + s.id + '] remove needs a >= b, got a=' + s.a + ' b=' + s.b);
        }
        if (s.a < 0 || s.b < 0) fail('SCENARIOS[' + s.id + '] has a negative quantity');
        ['zh','en'].forEach(L => {
          const info = I18N[L].scenarios[s.id];
          if (!info || !info.stem || !info.insight) fail('scenarios.' + s.id + ' ' + L + ': missing stem/insight');
        });
      });

      /* --- 範例 2：數線跳跳 --- */
      data.LINE_PROBS.forEach((p, i) => {
        const target = p.op === 'add' ? p.start + p.hop : p.start - p.hop;
        if (target < 0 || target > 20) fail('LINE_PROBS[' + i + '] target ' + target + ' outside 0~20');
        if (p.op === 'sub' && p.hop > p.start) fail('LINE_PROBS[' + i + '] would go negative');
        if (p.start < 0 || p.start > 20) fail('LINE_PROBS[' + i + '] start outside 0~20');
      });

      /* --- 範例 3：湊十好幫手（一定要真的跨過 10，不然「湊十」沒有意義） --- */
      data.REGROUP_UP.forEach((r, i) => {
        if (!(r.a >= 1 && r.a <= 9)) fail('REGROUP_UP[' + i + '] a outside 1~9');
        if (!(r.b >= 1 && r.b <= 9)) fail('REGROUP_UP[' + i + '] b outside 1~9');
        if (r.a + r.b <= 10) fail('REGROUP_UP[' + i + '] a+b does not cross ten — nothing to regroup');
        if (r.a + r.b > 18) fail('REGROUP_UP[' + i + '] a+b out of the lesson range');
      });

      /* --- 範例 4：拆十好幫手（一定要真的借過 10） --- */
      data.REGROUP_DOWN.forEach((r, i) => {
        if (!(r.total >= 11 && r.total <= 18)) fail('REGROUP_DOWN[' + i + '] total outside 11~18 (must be a two-digit teen number)');
        const ones = r.total - 10;
        if (r.b <= ones) fail('REGROUP_DOWN[' + i + '] b does not exceed the ones digit — nothing to borrow');
        if (r.b > 9) fail('REGROUP_DOWN[' + i + '] b outside 1~9');
        if (r.total - r.b < 0) fail('REGROUP_DOWN[' + i + '] negative result');
      });

      /* --- 小遊戲：加減大挑戰（五關五種玩法，§六之五）—— 每一條都從畫面上看得到的東西重新推，
             不呼叫頁面的答案邏輯；算法、答案、版面數字都在這裡自己算一次。 --- */
      const isInt = v => Number.isInteger(v);
      const order = (src.match(/var GAME_ORDER = \[([^\]]*)\]/) || [])[1];
      if (order === undefined) fail('cannot find GAME_ORDER in index.html');
      else {
        const types = order.split(',').map(x => x.trim().replace(/^'|'$/g, ''));
        if (types.join() !== 'story,compare,hop,make10,break10') fail('GAME_ORDER should be story,compare,hop,make10,break10, got ' + types.join());
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
      /* 結語的數字：照「孩子看到的順序」逐個比 —— 算式用驗算器驗，散文裡的數（「先減 3 變成 10」）用這個比。 */
      const seq = (where, text, want) => {
        if (/undefined|NaN/.test(text)) return fail(where + ': text has undefined/NaN: ' + text);
        const got = (text.match(/\d+/g) || []).map(Number).join();
        if (got !== want.join()) fail(where + ': numbers should read ' + want.join() + ', got ' + got + ' — ' + text);
        const r = arithGame(text);
        r.problems.forEach(p => fail(where + ': ' + p));
      };

      /* 第 1 關：故事分一分。算法用這裡自己的一份對照（不拿頁面的 STORY_OP 來推），再要求頁面的 STORY_OP 跟它一樣。
         「錯了」的說明是照種類寫的，所以要對**每一種**都說出正確的算法、而且不提另一種 —— 每一張卡都成立。 */
      const OP = { combine:'+', add:'+', remove:'−', compare:'−', totalLeft:'−' };
      Object.keys(OP).forEach(t => { if (data.STORY_OP[t] !== OP[t]) fail('STORY_OP.' + t + ' is ' + data.STORY_OP[t] + ', expected ' + OP[t]); });
      Object.keys(data.STORY_OP).forEach(t => { if (!(t in OP)) fail('STORY_OP has an unknown story type ' + t); });
      const OPWORD = { zh:{ '+':'加法', '−':'減法' }, en:{ '+':/\badding\b/i, '−':/\bsubtract/i } };
      const says = (m, w) => typeof w === 'string' ? m.indexOf(w) >= 0 : w.test(m);
      Object.keys(OP).forEach(t => {
        ['zh','en'].forEach(L => {
          const m = I18N[L].gStoryNot && I18N[L].gStoryNot[t];
          if (typeof m !== 'string' || !m) return fail('gStoryNot.' + t + ' missing in ' + L);
          const w = OPWORD[L][OP[t]], other = OPWORD[L][OP[t] === '+' ? '−' : '+'];
          if (!says(m, w)) fail('gStoryNot.' + t + ' ' + L + ' does not say ' + w);
          if (says(m, other)) fail('gStoryNot.' + t + ' ' + L + ' names the other operation: ' + m);
          if (!(I18N[L].gStory2 && typeof I18N[L].gStory2[t] === 'string' && I18N[L].gStory2[t])) fail('gStory2.' + t + ' missing in ' + L);
        });
      });
      ['zh','en'].forEach(L => {
        const one = I18N[L].gStoryOne;
        if (typeof one !== 'function') return fail('gStoryOne missing in ' + L);
        if (!says(one(true), OPWORD[L]['+']) || says(one(true), OPWORD[L]['−'])) fail('gStoryOne(true) ' + L + ' should name adding only');
        if (!says(one(false), OPWORD[L]['−']) || says(one(false), OPWORD[L]['+'])) fail('gStoryOne(false) ' + L + ' should name subtracting only');
      });
      data.GAME_STORIES.forEach((set, i) => {
        if (!Array.isArray(set) || set.length !== 4) return fail('GAME_STORIES[' + i + '] needs 4 story cards');
        let nAdd = 0, nSub = 0;
        set.forEach((c, j) => {
          if (!(c.t in OP)) return fail('GAME_STORIES[' + i + '][' + j + '] has an unknown type ' + c.t);
          if (!isInt(c.a) || !isInt(c.b) || c.a < 1 || c.b < 1) return fail('GAME_STORIES[' + i + '][' + j + '] needs positive integers');
          const op = OP[c.t], r = op === '+' ? c.a + c.b : c.a - c.b;
          if (op === '+') nAdd++; else nSub++;
          if (op === '−' && c.a <= c.b) fail('GAME_STORIES[' + i + '] ' + c.t + ' needs a > b, got ' + c.a + ' and ' + c.b);
          if (c.a > 20 || r < 0 || r > 20) fail('GAME_STORIES[' + i + '] ' + c.t + ' ' + c.a + op + c.b + ' outside 0..20');
          ['zh','en'].forEach(L => {
            const f = I18N[L].gStory && I18N[L].gStory[c.t];
            if (typeof f !== 'function') return fail('gStory.' + c.t + ' missing in ' + L);
            const txt = f(c.a, c.b), ns = (txt.match(/\d+/g) || []).map(Number);
            if (ns.join() !== c.a + ',' + c.b) fail('GAME_STORIES[' + i + '][' + j + '] ' + L + ' story card text must show a then b (' + c.a + ', ' + c.b + '): ' + txt);
          });
        });
        if (nAdd !== 2 || nSub !== 2) fail('GAME_STORIES[' + i + '] needs 2 adding and 2 subtracting stories, got ' + nAdd + '/' + nSub);
        if (new Set(set.map(c => c.t)).size < 3) fail('GAME_STORIES[' + i + '] should mix at least 3 kinds of story');
      });
      if (!data.GAME_STORIES.some(set => set.some(c => c.t === 'totalLeft'))) fail('no GAME_STORIES set has the 「一共剩下」 misconception card');

      /* 第 2 關：比一比。小明 a 張（兩排 × 5，最多 10）、小華 b 張（至少 2：說明寫「每一張」），多出來的是 a − b。 */
      data.GAME_COMPARE.forEach((g, i) => {
        if (!isInt(g.a) || !isInt(g.b) || g.b < 2 || g.b >= g.a || g.a > 10) return fail('GAME_COMPARE[' + i + '] needs integers with 2 <= b < a <= 10');
        ['zh','en'].forEach(L => {
          const n = I18N[L].compareNames;
          seq('GAME_COMPARE[' + i + '] ' + L + ' gCmpDone', I18N[L].gCmpDone(n[0], n[1], g.a, g.b), [g.a - g.b, g.a, g.b, g.a - g.b]);
        });
      });

      /* 第 3 關：數線跳跳。0～20 的格子板；一次跳一格，跳 hop 下，起點和終點都要在板子上。 */
      data.GAME_HOPS.forEach((h, i) => {
        if (h.op !== 'add' && h.op !== 'sub') return fail('GAME_HOPS[' + i + '] op must be add or sub');
        if (!isInt(h.start) || !isInt(h.hop) || h.hop < 2 || h.hop > 9) return fail('GAME_HOPS[' + i + '] start/hop must be integers, hop 2..9');
        const end = h.op === 'add' ? h.start + h.hop : h.start - h.hop;
        if (h.start < 0 || h.start > 20 || end < 0 || end > 20) fail('GAME_HOPS[' + i + '] lands on ' + end + ' — outside the 0..20 board');
      });

      /* 第 4、5 關：「外面」框放得下幾個 —— 框的大小與位置的間距都從原始碼讀，不在這裡另抄一份 */
      const obM = src.match(/var OUT_BOX = \{ x:(\d+), y:(\d+), w:(\d+), h:(\d+) \};/);
      const spM = src.match(/function outSpot\(i\)\{ return \{ cx:OUT_BOX\.x \+ (\d+) \+ i \* (\d+), cy:OUT_BOX\.y \+ OUT_BOX\.h \/ 2 \}; \}/);
      const frM = src.match(/var FRAME_CELL = (\d+), FRAME_PITCH = (\d+);/);
      let outCap = 0;
      if (!obM || !spM || !frM) fail('cannot read OUT_BOX / outSpot / FRAME_CELL from index.html');
      else {
        const [, , , obW, obH] = obM.map(Number), [, off, pitch] = spM.map(Number), [, fc, fp] = frM.map(Number);
        /* 外面框裡放兩種東西：湊十拖過去的點點（addPiece 的 w/h）、拆十畫好的散點（FRAME_CELL）。取兩者較大的那個驗。 */
        const m10 = src.match(/\n {4}make10: function\(d\)\{[\s\S]*?addPiece\(B, \{ w:(\d+), h:(\d+),/);
        if (!m10) fail('cannot read the make10 dot size');
        const dotW = Math.max(fc, m10 ? +m10[1] : 0), dotH = Math.max(fc, m10 ? +m10[2] : 0);
        if (pitch < dotW) fail('out-box spots overlap (pitch ' + pitch + ' < dot ' + dotW + ')');
        if (fp < fc) fail('ten-frame cells overlap (pitch ' + fp + ' < cell ' + fc + ')');
        if (off - dotW / 2 < 0 || obH < dotH) fail('out-box spots stick out of the box');
        while (off + outCap * pitch + dotW / 2 <= obW) outCap++;
      }
      data.GAME_MAKE10.forEach((g, i) => {
        if (!isInt(g.a) || !isInt(g.b) || g.a < 1 || g.a > 9 || g.b < 1 || g.b > 9) return fail('GAME_MAKE10[' + i + '] a and b must be integers 1..9');
        if (g.a + g.b <= 10) return fail('GAME_MAKE10[' + i + '] ' + g.a + '+' + g.b + ' does not cross ten — nothing to make');
        const fill = 10 - g.a, out = g.b - fill, s = g.a + g.b;
        if (out > outCap) fail('GAME_MAKE10[' + i + '] leaves ' + out + ' outside, more than the ' + outCap + ' spots');
        ['zh','en'].forEach(L => seq('GAME_MAKE10[' + i + '] ' + L + ' gM10Done', I18N[L].gM10Done(g.a, g.b, fill, out, s), [g.a, fill, 10, out, 10, out, s, g.a, g.b, s]));
      });
      data.GAME_BREAK10.forEach((g, i) => {
        if (!isInt(g.total) || !isInt(g.b) || g.total < 11 || g.total > 20 || g.b < 2 || g.b > 9) return fail('GAME_BREAK10[' + i + '] needs integers, total 11..20, b 2..9');
        const ones = g.total - 10, res = g.total - g.b;
        if (ones > outCap) fail('GAME_BREAK10[' + i + '] total ' + g.total + ' leaves ' + ones + ' loose, more than the ' + outCap + ' spots');
        if (g.b <= ones) fail('GAME_BREAK10[' + i + '] b ' + g.b + ' does not exceed the ' + ones + ' loose ones — nothing to break');
        ['zh','en'].forEach(L => seq('GAME_BREAK10[' + i + '] ' + L + ' gB10Done', I18N[L].gB10Done(g.total, g.b, ones, g.b - ones, res), [g.total, ones, 10, 10, g.b - ones, res, g.total, g.b, res]));
      });

      /* 手機上拿得起來、點得到的東西至少 44px：以 375px 手機（卡片內寬約 290px）換算 300 寬畫板。
         實際量測在端對端測試裡（375px 寬再跑一次）。 */
      const boards = (src.match(/makeBoard\((\d+), \d+\)/g) || []).map(m => +m.match(/\d+/)[0]);
      if (boards.length !== 5 || boards.some(W => W !== 300)) fail('expected five 300-wide game boards, got ' + boards.join());
      const scale = Math.min(1.5, 290 / 300);
      const tooSmall = (what, sz) => { if (sz * scale < 44) fail(what + ' is ' + (sz * scale).toFixed(1) + 'px on a 375px phone — under 44'); };
      const pieces = src.match(/addPiece\(B, \{ w:(\d+), h:(\d+),/g) || [];
      if (pieces.length < 3) fail('expected at least 3 addPiece calls in the game, found ' + pieces.length);
      pieces.forEach(m => { const [, w, h] = m.match(/w:(\d+), h:(\d+)/); tooSmall('a game piece (' + m + ')', Math.min(+w, +h)); });
      const grM = src.match(/var GRID_COLS = (\d+), GRID_CELL = (\d+), GRID_PITCH = (\d+);/);
      if (!grM) fail('cannot read GRID_CELL from index.html');
      else {
        tooSmall('a number-line cell (GRID_CELL ' + grM[2] + ')', +grM[2]);
        if (+grM[3] < +grM[2]) fail('number-line cells overlap (GRID_PITCH < GRID_CELL)');
        if (2 + (+grM[1] - 1) * (+grM[3]) + (+grM[2]) > 300) fail('number-line board is wider than 300');
      }
      if (frM) tooSmall('a ten-frame cell (FRAME_CELL ' + frM[1] + ')', +frM[1]);
      const tM = src.match(/var TW = (\d+), TP = (\d+), tx0/);
      if (!tM) fail('cannot read the compare tile size (TW/TP)');
      else { tooSmall('a compare sticker (TW ' + tM[1] + ')', +tM[1]); if (+tM[2] < +tM[1]) fail('compare stickers overlap (TP < TW)'); }
      /* 故事卡：托盤一排一張（renderTray 的排距從原始碼讀），卡片不能疊在一起、不能出界；
         放對之後縮成算式，一個箱子兩張，不能蓋住箱子上的字、不能伸出箱子。 */
      const storyBody = (src.match(/\n {4}story: function\(d\)\{([\s\S]*?)\n {4}\},\n/) || [])[1] || '';
      const rowPitch = +((src.match(/y \+ Math\.floor\(i \/ cols\) \* (\d+)\); \}\);/) || [])[1]);
      const cardM = storyBody.match(/addPiece\(B, \{ w:(\d+), h:(\d+),/);
      const sbM = storyBody.match(/makeBoard\(300, (\d+)\)/);
      const stM = storyBody.match(/renderTray\(B, set\.slice\(\), (\d+),/);
      const bxM = storyBody.match(/var R = \{ x:4 \+ i \* 150, y:(\d+), w:142, h:(\d+) \};/);
      const chM = storyBody.match(/P\.w = (\d+); P\.h = (\d+);/);
      const lkM = storyBody.match(/bx\.R\.y \+ (\d+) \+ bx\.items \* (\d+)\)/);
      if (!rowPitch || !cardM || !sbM || !stM || !bxM || !chM || !lkM) fail('cannot read the story-round layout from index.html');
      else {
        const cw = +cardM[1], ch = +cardM[2], H = +sbM[1], y0 = +stM[1], bxY = +bxM[1], bxH = +bxM[2], chipW = +chM[1], chipH = +chM[2], first = +lkM[1], step = +lkM[2];
        if (ch >= rowPitch) fail('story cards in the tray overlap (card height ' + ch + ' >= row pitch ' + rowPitch + ')');
        if (cw > 296) fail('story cards are wider than the board');
        if (y0 - ch / 2 < bxY + bxH) fail('the first story card covers the boxes');
        if (y0 + 3 * rowPitch + ch / 2 > H) fail('the last story card sticks out of the board');
        if (step < chipH) fail('the two sorted cards in a box overlap');
        if (first - chipH / 2 < 34) fail('a sorted card covers the box label');
        if (first + step + chipH / 2 > bxH) fail('the second sorted card sticks out of the box');
        if (chipW > 142 - 6) fail('a sorted card (' + chipW + ' wide) is wider than the 136px inside the borders of its 142-wide box');
      }
      /* 小遊戲的卡片要洗牌（正解不可以固定在同一個位置）—— 卡片統一由 renderTray() 畫，實作在 lib/gameshuffle.js。 */
      gameShuffleProblems(src, 1, { roundFn:'renderTray' }).forEach(fail);

      /* --- 試題：解釋裡真的寫成算式的那幾條要逐條驗算 --- */
      {
        let vSum = 0, qSum = 0;
        ['qs','qsAdv','qsBoost'].forEach(bank => {
          ['zh','en'].forEach(L => {
            (I18N[L][bank] || []).forEach((q, i) => {
              [['stem', q && q.stem], ['why', q && q.why]].forEach(([field, text]) => {
                if (typeof text !== 'string') return;
                const r = arithAS(text);
                vSum += r.verified; qSum += r.questions;
                r.problems.forEach(p => fail(`${bank}[${i}] ${L}.${field}: ${p}`));
              });
            });
          });
        });
        if (vSum !== 16) fail(`arithmetic coverage changed: verified ${vSum} equations, expected 16`);
        if (qSum !== 12) fail(`question-shaped equations changed: found ${qSum}, expected 12`);
        arithAS.unmatched().forEach(w => fail(`wrongOnPurpose "${w}" never matched — stale`));
        {
          const list = arithAS.verifiedAll();
          const digest = require('crypto').createHash('sha1').update(list.join(' | ')).digest('hex').slice(0, 12);
          if (digest !== 'b9e9287b74fe'){
            fail(`the set of verified equations changed (digest ${digest}, expected b9e9287b74fe)\n      now: ${list.join(' | ')}`);
          }
        }
      }
    }
  }
};
