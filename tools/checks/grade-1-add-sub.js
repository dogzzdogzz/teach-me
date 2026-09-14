/* grade-1/math/add-sub 的檢查設定（20 以內加減：情境分類、湊十、拆十）。 */

const arithAS = require('./lib/arith.js').makeArith({});

const { gameShuffleProblems } = require('./lib/gameshuffle.js');

module.exports = {
  breaks: [
    /* 把小遊戲畫選項那一行的 shuffle() 拿掉 —— 正解就會固定在同一個位置，
       孩子玩兩關就會發現「按第 N 個就對」。這是 2026-09-14 之前 `grade-1/length`
       真實存在的缺陷（選項排成 [count-1, count, count+1, count+2] 照順序畫，
       正解永遠是第二顆），而當時那條「正解不可以在 index 0」的斷言看不到它。 */
    { file:'index', expect:'without shuffle(...)',
      find:'    shuffle(round.opts).forEach(function(v){',
      replace:'    round.opts.forEach(function(v){' },
    { file:'review', expect:'a+b != sum',
      find:'        var sum = a + b;\n        var m = mixOpts(sum, [sum - 1, sum + 1, Math.abs(a - b)]);',
      replace:'        var sum = a + b + 1;\n        var m = mixOpts(sum, [sum - 1, sum + 1, Math.abs(a - b)]);' },
    { file:'review', expect:'opts[ans] != correct',
      find:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: opts.indexOf(correct) };',
      replace:'    var opts = shuffle([correct].concat(wrongs));\n    return { opts: opts, ans: (opts.indexOf(correct) + 1) % 4 };' },
    { file:'review', expect:'duplicate option value',
      find:'      if (c >= 0 && !seen[key]){ seen[key] = true; out.push(c); }',
      replace:'      if (c >= 0){ out.push(c); }' },
    { file:'review', expect:'a+remain != 10',
      find:'        var a = pickUnused([6,7,8,9], used);\n        var remain = 10 - a;',
      replace:'        var a = pickUnused([6,7,8,9], used);\n        var remain = 10 - a + 1;' },
    { file:'index', expect:'ROUNDS[1] crosses ten but mid=11, expected 10',
      find:"    { a:9,  b:5, op:'add', ans:14, opts:[14,13,15,4], mid:10 },",
      replace:"    { a:9,  b:5, op:'add', ans:14, opts:[14,13,15,4], mid:11 }," },
    { file:'index', expect:'REGROUP_UP[0] a+b does not cross ten',
      find:'  var REGROUP_UP = [ {a:8,b:5}, {a:7,b:5}, {a:9,b:4} ];',
      replace:'  var REGROUP_UP = [ {a:8,b:1}, {a:7,b:5}, {a:9,b:4} ];' },
    { file:'index', expect:'REGROUP_DOWN[0] b does not exceed the ones digit',
      find:'  var REGROUP_DOWN = [ {total:13,b:5}, {total:12,b:4}, {total:15,b:7} ];',
      replace:'  var REGROUP_DOWN = [ {total:13,b:2}, {total:12,b:4}, {total:15,b:7} ];' },
    { file:'index', expect:'arithmetic is wrong',
      find:"why:'這是合併：3 + 5 = 8。'",
      replace:"why:'這是合併：3 + 5 = 9。'" }
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
    /* 選項一律是非負整數。這一課宣稱「所有結果 0~20 之間」，邊界的 ±1 誘答容許到 21——
       超過這個容差就是缺陷，不是設計（compareDiff 用 a+b 當誘答就是這樣一個例子，
       見 tools/README.md 這一課的段落：候選值和正解無關，會衝出 0~20 很遠）。 */
    optionOk: function(s){
      if (/[·#]/.test(s)) return 'junk option ' + s;
      if (!/^\d+$/.test(s)) return 'non-numeric option ' + s;
      const v = Number(s);
      if (!(v >= 0 && v <= 21)) return 'option ' + s + ' outside the lesson range (0~20, ±1 slack at the edge)';
      return null;
    },
    /* 題幹本來就會印出來、刻意拿來當誘答的那個數字。 */
    stemEchoOk: {
      missingAddend: (d, opt) => Number(opt) === d.total,
      addMore: (d, opt) => Number(opt) === d.arrive,
      takeAway: (d, opt) => Number(opt) === d.taken,
      missingSubtrahend: (d, opt) => Number(opt) === d.result
    }
  },

  data: {
    dataStart: '/* ---------- 語言無關的資料 ---------- */',
    dataEnd: '/* ---------- i18n ---------- */',
    dataReturn: '{SCENARIOS, LINE_PROBS, REGROUP_UP, REGROUP_DOWN, ROUNDS}',
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

      /* --- 小遊戲：小火車過山洞 --- */
      data.ROUNDS.forEach((r, i) => {
        const val = r.op === 'add' ? r.a + r.b : r.a - r.b;
        if (val !== r.ans) fail('ROUNDS[' + i + '] ' + r.a + (r.op === 'add' ? '+' : '-') + r.b + ' != ' + r.ans);
        if (r.opts.indexOf(r.ans) < 0) fail('ROUNDS[' + i + '] ans not among opts');
        if (new Set(r.opts).size !== r.opts.length) fail('ROUNDS[' + i + '] duplicate opts');
        if (r.ans < 0 || r.ans > 20) fail('ROUNDS[' + i + '] ans out of the lesson range');
        /* 湊十／拆十跨過 10 的那幾關，提示的「中間會經過」一定是 10 —— 不然湊十／
           拆十的策略提示等於在教別的東西。 */
        const crosses = r.op === 'add' ? (r.a < 10 && r.a + r.b >= 10) : (r.a >= 10 && r.a - r.b < 10);
        if (crosses && r.mid !== 10) fail('ROUNDS[' + i + '] crosses ten but mid=' + r.mid + ', expected 10');
        ['zh','en'].forEach(L => {
          const ask = I18N[L].gAsk(r.a, r.b, r.op);
          const h1 = I18N[L].gHint1(r.op);
          const h2 = I18N[L].gHint2(r.mid);
          const c1 = I18N[L].gCorrectFirst(r.ans);
          const c2 = I18N[L].gCorrectRetry(r.ans);
          [ask, h1, h2, c1, c2].forEach(t => {
            if (/undefined|NaN/.test(t)) fail('ROUNDS[' + i + '] ' + L + ' text has undefined/NaN: ' + t);
          });
        });
      });
      /* 小遊戲的選項要洗牌（正解不可以固定在同一個位置）——
         守的是**畫出來的按鈕**，不是 opts 陣列裡的順序，實作在 lib/gameshuffle.js。 */
      gameShuffleProblems(src, 1).forEach(fail);

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
